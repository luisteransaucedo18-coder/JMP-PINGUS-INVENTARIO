-- Validate persisted requirement quantities under one lock per requirement.
-- Existing deliveries remain untouched: excesses require operational review.
create or replace function public.registrar_entrega(
  p_requerimiento_id uuid, p_tecnico text, p_dni_tecnico text,
  p_observaciones text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_req public.requerimientos%rowtype;
  v_id uuid := gen_random_uuid();
  v_item jsonb;
  v_requested numeric;
  v_delivered numeric;
  v_quantity numeric;
  v_state public.estado_entrega;
begin
  if auth.uid() is null or public.rol_actual() not in ('analista','coordinador')
    or not exists(select 1 from public.perfiles where id=auth.uid() and estado='ACTIVO')
  then raise exception 'No tienes permisos para registrar una entrega'; end if;
  select * into v_req from public.requerimientos where id=p_requerimiento_id for update;
  if not found or v_req.estado<>'CONFIRMADO' then raise exception 'El requerimiento no está confirmado'; end if;
  if public.rol_actual()='analista' and v_req.analista_id<>auth.uid()
  then raise exception 'Solo puedes entregar materiales de tus requerimientos'; end if;
  if coalesce(btrim(p_tecnico),'')='' then raise exception 'El técnico es obligatorio'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Registra al menos un material'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Registra al menos un material'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'material_sku' having count(*)>1)
  then raise exception 'No repitas materiales en la entrega'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select cantidad into v_requested from public.requerimiento_items
      where requerimiento_id=p_requerimiento_id and material_sku=v_item->>'material_sku';
    if not found then raise exception 'El material no pertenece al requerimiento'; end if;
    v_quantity := (v_item->>'cantidad_entregada')::numeric;
    if v_quantity is null or v_quantity<0 or v_quantity::text in ('NaN','Infinity','-Infinity')
    then raise exception 'Cantidad de entrega inválida'; end if;
    select coalesce(sum(i.cantidad_entregada),0) into v_delivered
      from public.entrega_items i join public.entregas e on e.id=i.entrega_id
      where e.requerimiento_id=p_requerimiento_id and e.estado<>'CANCELADA'
        and i.material_sku=v_item->>'material_sku';
    if v_quantity>greatest(0,v_requested-v_delivered)
    then raise exception 'La cantidad excede el saldo pendiente del requerimiento'; end if;
    if exists(select 1 from public.requerimiento_items where requerimiento_id=p_requerimiento_id
      and material_sku=v_item->>'material_sku' and unidad in ('UND','ROLLO','PAR') and v_quantity<>trunc(v_quantity))
    then raise exception 'Esta unidad requiere cantidades enteras'; end if;
  end loop;
  if not exists(select 1 from jsonb_array_elements(p_items) x where (x->>'cantidad_entregada')::numeric>0)
  then raise exception 'Registra una cantidad mayor que cero'; end if;
  -- Document state reflects this delivery, independently of accumulated request state.
  select case when not exists(
    select 1 from public.requerimiento_items r
    where r.requerimiento_id=p_requerimiento_id and r.cantidad>coalesce((
      select (x->>'cantidad_entregada')::numeric from jsonb_array_elements(p_items) x
      where x->>'material_sku'=r.material_sku),0)
  ) then 'COMPLETA'::public.estado_entrega else 'PARCIAL'::public.estado_entrega end into v_state;
  insert into public.entregas(id,requerimiento_id,proyecto_nombre,tecnico,dni_tecnico,responsable_entrega_id,fecha_hora,estado,observaciones)
  values(v_id,p_requerimiento_id,(select nombre from public.proyectos where id=v_req.proyecto_id),
    btrim(p_tecnico),nullif(btrim(p_dni_tecnico),''),auth.uid(),now(),v_state,nullif(btrim(p_observaciones),''));
  insert into public.entrega_items(entrega_id,material_sku,material_nombre,cantidad_solicitada,cantidad_entregada)
  select v_id,r.material_sku,r.material_nombre,r.cantidad,(x->>'cantidad_entregada')::numeric
  from jsonb_array_elements(p_items) x join public.requerimiento_items r
    on r.requerimiento_id=p_requerimiento_id and r.material_sku=x->>'material_sku';
  return v_id;
end;
$$;
revoke all on function public.registrar_entrega(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.registrar_entrega(uuid,text,text,text,jsonb) to authenticated;

-- All writes use the validated RPC. Analysts read their own request deliveries.
revoke all on public.entregas, public.entrega_items from anon, authenticated;
grant select on public.entregas, public.entrega_items to authenticated;
alter table public.entregas enable row level security;
alter table public.entrega_items enable row level security;
drop policy if exists "coordinador administra entregas" on public.entregas;
drop policy if exists "entregas visibles para autenticados" on public.entregas;
drop policy if exists "coordinador administra items de entrega" on public.entrega_items;
drop policy if exists "items de entrega visibles" on public.entrega_items;
create policy entregas_lectura_por_rol on public.entregas for select to authenticated using (
  exists(select 1 from public.perfiles where id=(select auth.uid()) and estado='ACTIVO')
  and ((select public.rol_actual()) in ('coordinador','gerente') or exists(
    select 1 from public.requerimientos r where r.id=requerimiento_id and r.analista_id=(select auth.uid())
  ))
);
create policy entrega_items_lectura_por_rol on public.entrega_items for select to authenticated using (
  exists(select 1 from public.entregas e where e.id=entrega_id)
);
