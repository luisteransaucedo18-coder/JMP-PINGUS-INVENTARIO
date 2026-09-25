-- Persist requests atomically, enforce the approval workflow and publish changes.
alter table public.requerimiento_items add column if not exists unidad text;
alter table public.requerimiento_items add column if not exists marca text;

drop policy "requerimientos visibles según rol" on public.requerimientos;
create policy "requerimientos visibles según rol" on public.requerimientos for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.estado = 'ACTIVO')
  and (analista_id = (select auth.uid()) or (estado <> 'BORRADOR' and (select public.rol_actual()) in ('coordinador','gerente'))));
drop policy "analista crea sus requerimientos" on public.requerimientos;
create policy "analista crea sus requerimientos" on public.requerimientos for insert to authenticated
with check ((select public.rol_actual()) = 'analista' and analista_id = (select auth.uid()) and estado = 'BORRADOR'
  and confirmado_por is null and fecha_confirmacion is null
  and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.estado = 'ACTIVO'));
drop policy "analista edita borradores y coordinador revisa" on public.requerimientos;
create policy "analista edita borradores y coordinador revisa" on public.requerimientos for update to authenticated
using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.estado = 'ACTIVO')
  and (((select public.rol_actual()) = 'analista' and analista_id = (select auth.uid()) and estado = 'BORRADOR')
    or ((select public.rol_actual()) = 'coordinador' and estado = 'ENVIADO')))
with check (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.estado = 'ACTIVO')
  and (((select public.rol_actual()) = 'analista' and analista_id = (select auth.uid()) and estado in ('BORRADOR','ENVIADO') and confirmado_por is null)
    or ((select public.rol_actual()) = 'coordinador' and estado in ('CONFIRMADO','RECHAZADO') and confirmado_por = (select auth.uid()))));
drop policy "items de requerimiento visibles" on public.requerimiento_items;
create policy "items de requerimiento visibles" on public.requerimiento_items for select to authenticated
using (exists (select 1 from public.requerimientos r where r.id = requerimiento_id));

create or replace function public.validar_flujo_requerimiento() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para modificar solicitudes'; end if;
  if not exists (select 1 from public.perfiles where id = auth.uid() and estado = 'ACTIVO') then
    raise exception 'Tu perfil no tiene acceso activo';
  end if;
  if tg_op = 'INSERT' then
    if public.rol_actual() <> 'analista' or new.analista_id <> auth.uid() or new.estado <> 'BORRADOR' then
      raise exception 'Solo el analista puede crear su solicitud como borrador';
    end if;
    new.confirmado_por := null; new.fecha_confirmacion := null; new.observaciones := null;
    new.fecha := (now() at time zone 'America/Lima')::date;
  else
    if new.id <> old.id or new.codigo <> old.codigo or new.analista_id <> old.analista_id or new.fecha <> old.fecha then
      raise exception 'No se puede cambiar la identidad de la solicitud';
    end if;
    if old.estado = 'BORRADOR' then
      if public.rol_actual() <> 'analista' or old.analista_id <> auth.uid() or new.estado not in ('BORRADOR','ENVIADO') then
        raise exception 'Solo el analista puede enviar su borrador';
      end if;
      new.confirmado_por := null; new.fecha_confirmacion := null; new.observaciones := null;
    elsif old.estado = 'ENVIADO' then
      if public.rol_actual() <> 'coordinador' or new.estado not in ('CONFIRMADO','RECHAZADO') then
        raise exception 'Solo el coordinador puede confirmar o rechazar una solicitud enviada';
      end if;
      if (to_jsonb(new) - array['estado','observaciones','confirmado_por','fecha_confirmacion','updated_at'])
        is distinct from (to_jsonb(old) - array['estado','observaciones','confirmado_por','fecha_confirmacion','updated_at']) then
        raise exception 'La revisión no puede modificar los datos enviados por el analista';
      end if;
      if new.estado = 'RECHAZADO' and nullif(btrim(new.observaciones),'') is null then
        raise exception 'Indica el motivo del rechazo';
      end if;
      new.confirmado_por := auth.uid();
      new.fecha_confirmacion := (now() at time zone 'America/Lima')::date;
    else
      raise exception 'La solicitud ya fue revisada';
    end if;
  end if;
  if new.estado = 'ENVIADO' and (nullif(btrim(new.tecnico),'') is null or not exists
    (select 1 from public.requerimiento_items where requerimiento_id = new.id)) then
    raise exception 'Completa el técnico y agrega materiales antes de enviar';
  end if;
  return new;
end $$;
create trigger validar_flujo_requerimiento before insert or update on public.requerimientos
for each row execute function public.validar_flujo_requerimiento();

create or replace function public.validar_items_requerimiento() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_req public.requerimientos;
begin
  if tg_op = 'UPDATE' and new.requerimiento_id <> old.requerimiento_id then
    raise exception 'No se pueden mover materiales entre solicitudes';
  end if;
  select * into v_req from public.requerimientos
    where id = case when tg_op = 'DELETE' then old.requerimiento_id else new.requerimiento_id end for update;
  if not found or v_req.estado <> 'BORRADOR' or v_req.analista_id <> auth.uid()
    or public.rol_actual() <> 'analista' then raise exception 'Solo puedes editar los materiales de tu borrador'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.cantidad is null or not (new.cantidad > 0 and new.cantidad < 100000000000) then
    raise exception 'La cantidad debe ser un número positivo válido';
  end if;
  select m.nombre,m.unidad,m.marca into new.material_nombre,new.unidad,new.marca
    from public.materiales m where m.sku = new.material_sku and m.activo;
  if not found then raise exception 'El material no existe o está inactivo'; end if;
  return new;
end $$;
create trigger validar_items_requerimiento before insert or update or delete on public.requerimiento_items
for each row execute function public.validar_items_requerimiento();

create or replace function public.crear_requerimiento(p_id uuid, p_datos jsonb, p_items jsonb, p_borrador boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_proyecto uuid; v_req public.requerimientos; v_item record;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'analista' then raise exception 'Solo un analista puede crear solicitudes'; end if;
  if p_id is null then raise exception 'Falta el identificador de la solicitud'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
  select * into v_req from public.requerimientos where id = p_id;
  if found then return v_req.id; end if;
  if nullif(btrim(p_datos->>'ubicacion'),'') is null or nullif(btrim(p_datos->>'descripcion'),'') is null then
    raise exception 'Completa la ubicación y descripción';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Materiales inválidos'; end if;
  v_proyecto := nullif(p_datos->>'proyecto_id','')::uuid;
  if v_proyecto is null then
    if nullif(btrim(p_datos->>'proyecto'),'') is null then raise exception 'Selecciona o crea un proyecto'; end if;
    insert into public.proyectos(nombre,ubicacion,sede,responsable,cliente,creado_por)
    values(btrim(p_datos->>'proyecto'),p_datos->>'ubicacion',p_datos->>'sede',coalesce(p_datos->>'tecnico',''),'',auth.uid())
    returning id into v_proyecto;
  end if;
  insert into public.requerimientos(id,proyecto_id,sede,ubicacion,descripcion,tecnico,analista_id)
  values(p_id,v_proyecto,p_datos->>'sede',p_datos->>'ubicacion',p_datos->>'descripcion',coalesce(p_datos->>'tecnico',''),auth.uid());
  if exists (select 1 from jsonb_array_elements(p_items) item where nullif(item->>'skuId','') is null
    or (item->>'cantidad') is null or not ((item->>'cantidad')::numeric > 0 and (item->>'cantidad')::numeric < 100000000000)) then
    raise exception 'Selecciona materiales del catálogo e indica cantidades positivas';
  end if;
  for v_item in select item->>'skuId' sku,sum((item->>'cantidad')::numeric) cantidad
    from jsonb_array_elements(p_items) item group by item->>'skuId' loop
    insert into public.requerimiento_items(requerimiento_id,material_sku,material_nombre,cantidad)
    values(p_id,v_item.sku,'',v_item.cantidad);
  end loop;
  if not coalesce(p_borrador,false) then update public.requerimientos set estado='ENVIADO' where id=p_id; end if;
  return p_id;
end $$;

create or replace function public.enviar_requerimiento(p_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_req public.requerimientos;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'analista' then raise exception 'Solo el analista puede enviar solicitudes'; end if;
  select * into v_req from public.requerimientos where id=p_id and analista_id=auth.uid() for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_req.estado='ENVIADO' then return p_id; end if;
  if v_req.estado<>'BORRADOR' then raise exception 'La solicitud ya fue revisada'; end if;
  update public.requerimientos set estado='ENVIADO' where id=p_id;
  return p_id;
end $$;

create or replace function public.revisar_requerimiento(p_id uuid,p_confirmar boolean,p_observaciones text default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_req public.requerimientos; v_estado public.estado_requerimiento;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador' then raise exception 'Solo el coordinador puede revisar solicitudes'; end if;
  select * into v_req from public.requerimientos where id=p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  v_estado := case when p_confirmar then 'CONFIRMADO'::public.estado_requerimiento else 'RECHAZADO'::public.estado_requerimiento end;
  if v_req.estado=v_estado and v_req.confirmado_por=auth.uid() then return p_id; end if;
  if v_req.estado<>'ENVIADO' then raise exception 'La solicitud ya fue revisada. Actualiza la lista'; end if;
  update public.requerimientos set estado=v_estado,observaciones=nullif(btrim(p_observaciones),'') where id=p_id;
  return p_id;
end $$;

revoke all on function public.crear_requerimiento(uuid,jsonb,jsonb,boolean) from public,anon;
revoke all on function public.enviar_requerimiento(uuid) from public,anon;
revoke all on function public.revisar_requerimiento(uuid,boolean,text) from public,anon;
revoke all on function public.validar_flujo_requerimiento() from public,anon;
revoke all on function public.validar_items_requerimiento() from public,anon;
grant execute on function public.crear_requerimiento(uuid,jsonb,jsonb,boolean),public.enviar_requerimiento(uuid),public.revisar_requerimiento(uuid,boolean,text) to authenticated;
revoke all on public.requerimientos,public.requerimiento_items from anon;
revoke truncate,trigger,references,delete on public.requerimientos from authenticated;
revoke truncate,trigger,references on public.requerimiento_items from authenticated;
grant select,insert,update on public.requerimientos to authenticated;
grant select,insert,update,delete on public.requerimiento_items to authenticated;
grant usage,select on sequence public.requerimiento_codigo_seq,public.requerimiento_items_id_seq,public.proyecto_codigo_seq to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='requerimientos') then
    alter publication supabase_realtime add table public.requerimientos;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='requerimiento_items') then
    alter publication supabase_realtime add table public.requerimiento_items;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='proyectos') then
    alter publication supabase_realtime add table public.proyectos;
  end if;
end $$;
