-- Transporte interno. Adaptado al esquema remoto inspeccionado el 2026-09-29.
-- Aplicar una sola vez, en una transacción. No requiere ejecutar migraciones antiguas.
begin;
create schema if not exists transporte_privado;
revoke all on schema transporte_privado from public, anon;
grant usage on schema transporte_privado to authenticated;

-- El trigger de alta existente confiaba en raw_user_meta_data para rol/sede.
-- Solo Auth Admin/service_role puede establecer raw_app_meta_data.
create or replace function public.crear_perfil_nuevo_usuario() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_rol public.rol_usuario; v_sede text;
begin
 v_rol:=case new.raw_app_meta_data->>'rol'
  when 'gerente' then 'gerente'::public.rol_usuario
  when 'coordinador' then 'coordinador'::public.rol_usuario
  else 'analista'::public.rol_usuario end;
 v_sede:=nullif(new.raw_app_meta_data->>'sede','');
 if v_sede is not null and not exists(select 1 from public.sedes where nombre=v_sede) then raise exception 'Sede inválida'; end if;
 insert into public.perfiles(id,nombre,email,rol,sede)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'nombre',''),split_part(new.email,'@',1)),new.email,v_rol,v_sede);
 return new;
end $$;
revoke all on function public.crear_perfil_nuevo_usuario() from public,anon,authenticated;

-- Impide que la política de edición del perfil propio permita elevar privilegios.
create function transporte_privado.proteger_perfil() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') and
     (new.id, new.rol, new.sede, new.estado) is distinct from (old.id, old.rol, old.sede, old.estado)
     and not exists (select 1 from public.perfiles where id=auth.uid() and rol='gerente' and estado='ACTIVO') then
    raise exception 'Rol, sede y estado requieren administración autorizada';
  end if;
  return new;
end $$;
create trigger transporte_proteger_perfil before update on public.perfiles
for each row execute function transporte_privado.proteger_perfil();

create table public.traslados (
 id uuid primary key,
 origen text not null references public.sedes(nombre),
 destino text not null references public.sedes(nombre),
 estado text not null default 'BORRADOR' check (estado in ('BORRADOR','EN_TRANSITO','RECIBIDO','INCIDENCIA','CANCELADO')),
 fecha_envio date not null, observaciones text not null default '',
 transportista text not null default '', guia text not null default '',
 costo numeric(14,2) not null check(costo >= 0 and costo < 1000000000000),
 moneda text not null check(moneda in ('PEN','USD')),
 numero_comprobante text not null default '', fecha_comprobante date,
 creado_por uuid not null references public.perfiles(id), created_at timestamptz not null default now(),
 despachado_at timestamptz, recibido_at timestamptz,
 reversion_solicitada boolean not null default false, reversion_autorizada boolean not null default false,
 check(origen <> destino),
 check(origen in ('Chiclayo','Chimbote','Trujillo') and destino in ('Chiclayo','Chimbote','Trujillo'))
);
create index traslados_origen_estado on public.traslados(origen,estado,created_at desc);
create index traslados_destino_estado on public.traslados(destino,estado,created_at desc);
create table public.traslado_items (
 traslado_id uuid not null references public.traslados(id),
 material_sku text not null references public.materiales(sku) on update cascade,
 nombre text not null, unidad text not null,
 cantidad numeric(14,3) not null check(cantidad > 0 and cantidad < 100000000000),
 recibida numeric(14,3) not null default 0, aceptada numeric(14,3) not null default 0,
 danada numeric(14,3) not null default 0,
 primary key(traslado_id,material_sku),
 check(aceptada >= 0 and danada >= 0 and recibida=aceptada+danada and recibida <= cantidad)
);
create table public.traslado_historial (
 id bigint generated always as identity primary key, traslado_id uuid not null references public.traslados(id),
 tipo text not null, usuario_id uuid not null references public.perfiles(id), usuario_nombre text not null,
 observaciones text not null default '', datos jsonb not null default '{}', created_at timestamptz not null default now()
);
create index traslado_historial_padre on public.traslado_historial(traslado_id,id);
create table public.traslado_incidencias (
 id bigint generated always as identity primary key, traslado_id uuid not null references public.traslados(id),
 observaciones text not null, detalle jsonb not null, creado_por uuid not null references public.perfiles(id),
 created_at timestamptz not null default now(), resolucion text, resuelto_por uuid references public.perfiles(id), resuelto_at timestamptz
);
create index traslado_incidencias_padre on public.traslado_incidencias(traslado_id);
create table public.traslado_archivos (
 id uuid primary key, traslado_id uuid not null references public.traslados(id),
 tipo text not null check(tipo in ('COMPROBANTE','EVIDENCIA')),
 ruta text not null unique, nombre text not null, mime text not null,
 tamano bigint not null check(tamano > 0 and tamano <= 10485760),
 creado_por uuid not null references public.perfiles(id), created_at timestamptz not null default now()
);
create index traslado_archivos_padre on public.traslado_archivos(traslado_id);
-- Usa el historial existente sin modificar su enum ni los módulos que dependen de él.
-- AJUSTE_MANUAL + referencia_tipo='TRASLADO' se detalla con transporte_tipo.
alter table public.movimientos_inventario add column traslado_id uuid references public.traslados(id),
 add column transporte_tipo text check(transporte_tipo in ('DESPACHO','RECEPCION','RESOLUCION','REVERSION')),
 add column transporte_nombre text, add column sede_contraparte text references public.sedes(nombre);
create index movimientos_traslado_idx on public.movimientos_inventario(traslado_id);
create unique index movimiento_traslado_unico on public.movimientos_inventario(traslado_id,material_sku,transporte_tipo) where traslado_id is not null;

create function transporte_privado.sede() returns text language sql stable security definer set search_path='' as $$
 select sede from public.perfiles where id=auth.uid() and rol='coordinador' and estado='ACTIVO'
$$;
create function transporte_privado.visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.traslados where id=p_id and transporte_privado.sede() in (origen,destino))
$$;
create function transporte_privado.cantidad_valida(p_cantidad numeric,p_unidad text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_cantidad >= 0 and p_cantidad < 100000000000 and p_cantidad=round(p_cantidad,3)
   and (upper(trim(p_unidad)) in ('MTS','GLD') or p_cantidad=trunc(p_cantidad)),false)
$$;
-- Solo RPC puede escribir en las nuevas tablas. RLS limita lectura por sede.
alter table public.traslados enable row level security;
create policy transporte_lectura on public.traslados for select to authenticated using (transporte_privado.sede() in (origen,destino));
do $$ declare t text; begin
 foreach t in array array['traslado_items','traslado_historial','traslado_incidencias','traslado_archivos'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy transporte_lectura on public.%I for select to authenticated using (transporte_privado.visible(traslado_id))',t);
 end loop;
end $$;
revoke all on public.traslados, public.traslado_items, public.traslado_historial, public.traslado_incidencias, public.traslado_archivos from anon, authenticated;
grant select on public.traslados, public.traslado_items, public.traslado_historial, public.traslado_incidencias, public.traslado_archivos to authenticated;
-- Las políticas restrictivas complementan las políticas antiguas, que permiten lectura global.
create policy transporte_movimientos_lectura on public.movimientos_inventario as restrictive for select to authenticated
 using (traslado_id is null or transporte_privado.visible(traslado_id));
create policy transporte_movimientos_insert on public.movimientos_inventario as restrictive for insert to authenticated
 with check(traslado_id is null and transporte_tipo is null and referencia_tipo is distinct from 'TRASLADO');
create policy transporte_movimientos_update on public.movimientos_inventario as restrictive for update to authenticated
 using(traslado_id is null) with check(traslado_id is null and transporte_tipo is null and referencia_tipo is distinct from 'TRASLADO');
create policy transporte_movimientos_delete on public.movimientos_inventario as restrictive for delete to authenticated using(traslado_id is null);

create function transporte_privado.evento(p_id uuid,p_tipo text,p_nota text,p_datos jsonb default '{}') returns void
language sql security definer set search_path='' as $$
 insert into public.traslado_historial(traslado_id,tipo,usuario_id,usuario_nombre,observaciones,datos)
 select p_id,p_tipo,id,nombre,coalesce(p_nota,''),p_datos from public.perfiles where id=auth.uid()
$$;
create function transporte_privado.mover(p_id uuid,p_sku text,p_sede text,p_delta numeric,p_tipo text) returns void
language plpgsql security definer set search_path='' as $$
declare v_stock numeric; v_otro text; v_nombre text;
begin
 if p_delta=0 then return; end if;
 select case when origen=p_sede then destino else origen end into v_otro from public.traslados where id=p_id;
 select nombre into v_nombre from public.traslado_items where traslado_id=p_id and material_sku=p_sku;
 insert into public.inventario_sedes(material_sku,sede,stock) values(p_sku,p_sede,0) on conflict do nothing;
 select stock into v_stock from public.inventario_sedes where material_sku=p_sku and sede=p_sede for update;
 if v_stock+p_delta < 0 then raise exception 'Stock insuficiente para %',p_sku; end if;
 update public.inventario_sedes set stock=stock+p_delta,updated_at=now() where material_sku=p_sku and sede=p_sede;
 insert into public.movimientos_inventario(material_sku,sede,tipo,cantidad,stock_anterior,stock_nuevo,referencia_tipo,referencia_id,motivo,creado_por,traslado_id,transporte_tipo,transporte_nombre,sede_contraparte)
 values(p_sku,p_sede,'AJUSTE_MANUAL',p_delta,v_stock,v_stock+p_delta,'TRASLADO',p_id,p_tipo,auth.uid(),p_id,p_tipo,v_nombre,v_otro);
end $$;

create function transporte_privado.crear(p_id uuid,p_datos jsonb,p_items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_sede text:=transporte_privado.sede(); v_item jsonb; v_m public.materiales%rowtype; v_q numeric;
begin
 if v_sede is null then raise exception 'Solo coordinadores activos'; end if;
 -- Serializa también los reintentos de creación con el UUID generado por el cliente.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 if exists(select 1 from public.traslados where id=p_id and creado_por=auth.uid() and origen=v_sede) then return p_id; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Selecciona materiales'; end if;
 insert into public.traslados(id,origen,destino,fecha_envio,observaciones,transportista,guia,costo,moneda,numero_comprobante,fecha_comprobante,creado_por)
 values(p_id,v_sede,p_datos->>'destino',(p_datos->>'fecha_envio')::date,coalesce(p_datos->>'observaciones',''),coalesce(p_datos->>'transportista',''),coalesce(p_datos->>'guia',''),(p_datos->>'costo')::numeric,p_datos->>'moneda',coalesce(p_datos->>'numero_comprobante',''),nullif(p_datos->>'fecha_comprobante','')::date,auth.uid());
 for v_item in select value from jsonb_array_elements(p_items) loop
  select * into v_m from public.materiales where sku=v_item->>'material_sku' and activo;
  if not found then raise exception 'Material inexistente o inactivo'; end if;
  v_q:=(v_item->>'cantidad')::numeric;
  if not transporte_privado.cantidad_valida(v_q,coalesce(v_m.unidad,'UND')) or v_q<=0 then raise exception 'Cantidad inválida para %',v_m.sku; end if;
  if v_q>coalesce((select stock from public.inventario_sedes where material_sku=v_m.sku and sede=v_sede),0) then raise exception 'Stock insuficiente para %',v_m.sku; end if;
  insert into public.traslado_items(traslado_id,material_sku,nombre,unidad,cantidad) values(p_id,v_m.sku,v_m.nombre,coalesce(v_m.unidad,'UND'),v_q);
 end loop;
 perform transporte_privado.evento(p_id,'CREACION','Borrador creado');
 return p_id;
end $$;

create function transporte_privado.operar(p_id uuid,p_accion text,p_nota text default '',p_items jsonb default '[]') returns void
language plpgsql security definer set search_path='' as $$
declare v_t public.traslados%rowtype; v_sede text:=transporte_privado.sede(); v_i record; v_j jsonb;
 v_a numeric; v_d numeric; v_r numeric; v_diferencia boolean:=false; v_destino boolean;
begin
 if v_sede is null then raise exception 'Solo coordinadores activos'; end if;
 select * into v_t from public.traslados where id=p_id for update;
 if not found or v_sede not in (v_t.origen,v_t.destino) then raise exception 'Traslado no accesible'; end if;
 v_destino:=p_accion in ('RECIBIR','RESOLVER','AUTORIZAR_REVERSION');
 if (v_destino and v_sede<>v_t.destino) or (not v_destino and v_sede<>v_t.origen) then raise exception 'Acción no autorizada para esta sede'; end if;
 -- Idempotencia: una operación ya confirmada no vuelve a modificar existencias.
 if exists(select 1 from public.traslado_historial where traslado_id=p_id and tipo=p_accion) then return; end if;
 if p_accion='DESPACHAR' then
  if v_t.estado<>'BORRADOR' then raise exception 'Solo se despachan borradores'; end if;
  if v_t.costo>0 and (nullif(trim(v_t.numero_comprobante),'') is null or v_t.fecha_comprobante is null or not exists(select 1 from public.traslado_archivos where traslado_id=p_id and tipo='COMPROBANTE')) then raise exception 'Adjunta comprobante, número y fecha para acreditar el costo'; end if;
 elsif p_accion in ('RECIBIR','RESOLVER') then
  if (p_accion='RECIBIR' and (v_t.estado<>'EN_TRANSITO' or v_t.recibido_at is not null)) or
     (p_accion='RESOLVER' and (v_t.estado<>'INCIDENCIA' or v_t.recibido_at is null)) or v_t.reversion_solicitada then raise exception 'Estado no válido para recepción o resolución'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Detalle de recepción inválido'; end if;
  if jsonb_array_length(p_items)<>(select count(*) from public.traslado_items where traslado_id=p_id) or
     (select count(distinct value->>'material_sku') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) or
     exists(select 1 from jsonb_array_elements(p_items) j where not exists(select 1 from public.traslado_items where traslado_id=p_id and material_sku=j->>'material_sku')) then raise exception 'Incluye cada material exactamente una vez'; end if;
 elsif p_accion='CANCELAR' then
  if v_t.estado<>'BORRADOR' then raise exception 'Un envío despachado requiere reversión controlada'; end if;
 elsif p_accion='SOLICITAR_REVERSION' then
  if v_t.estado not in ('EN_TRANSITO','INCIDENCIA') or exists(select 1 from public.traslado_items where traslado_id=p_id and aceptada>0) then raise exception 'No se puede revertir una recepción con unidades aceptadas'; end if;
 elsif p_accion='AUTORIZAR_REVERSION' then
  if v_t.estado<>'INCIDENCIA' or not v_t.reversion_solicitada then raise exception 'No hay reversión solicitada'; end if;
 elsif p_accion='REVERTIR' then
  if v_t.estado<>'INCIDENCIA' or not v_t.reversion_autorizada then raise exception 'Destino debe autorizar el retorno'; end if;
 else raise exception 'Acción desconocida'; end if;
 if p_accion not in ('DESPACHAR','RECIBIR') and nullif(trim(p_nota),'') is null then raise exception 'Las observaciones son obligatorias'; end if;
 -- Orden estable y bloqueo del material, antes del stock: compatible con el trigger existente que actualiza materiales.
 if p_accion in ('DESPACHAR','RECIBIR','RESOLVER','REVERTIR') then
  perform m.sku from public.materiales m join public.traslado_items i on i.material_sku=m.sku where i.traslado_id=p_id order by m.sku for update of m;
  for v_i in select * from public.traslado_items where traslado_id=p_id order by material_sku loop
   if p_accion='DESPACHAR' then
    perform transporte_privado.mover(p_id,v_i.material_sku,v_t.origen,-v_i.cantidad,'DESPACHO');
   elsif p_accion='REVERTIR' then
    perform transporte_privado.mover(p_id,v_i.material_sku,v_t.origen,v_i.cantidad,'REVERSION');
   else
    select value into v_j from jsonb_array_elements(p_items) where value->>'material_sku'=v_i.material_sku;
    v_a:=(v_j->>'aceptada')::numeric; v_d:=(v_j->>'danada')::numeric; v_r:=(v_j->>'recibida')::numeric;
    if not transporte_privado.cantidad_valida(v_a,v_i.unidad) or not transporte_privado.cantidad_valida(v_d,v_i.unidad) or not transporte_privado.cantidad_valida(v_r,v_i.unidad)
      or v_a<v_i.aceptada or v_r<>v_a+v_d or v_r>v_i.cantidad then raise exception 'Cantidades recibidas inválidas para %',v_i.material_sku; end if;
    perform transporte_privado.mover(p_id,v_i.material_sku,v_t.destino,v_a-v_i.aceptada,case when p_accion='RECIBIR' then 'RECEPCION' else 'RESOLUCION' end);
    update public.traslado_items set recibida=v_r,aceptada=v_a,danada=v_d where traslado_id=p_id and material_sku=v_i.material_sku;
    v_diferencia:=v_diferencia or v_a<v_i.cantidad;
   end if;
  end loop;
 end if;
 if p_accion='DESPACHAR' then update public.traslados set estado='EN_TRANSITO',despachado_at=now() where id=p_id;
 elsif p_accion='RECIBIR' then
  if v_diferencia and nullif(trim(p_nota),'') is null then raise exception 'Explica los faltantes o daños'; end if;
  update public.traslados set estado=case when v_diferencia then 'INCIDENCIA' else 'RECIBIDO' end,recibido_at=now() where id=p_id;
  if v_diferencia then insert into public.traslado_incidencias(traslado_id,observaciones,detalle,creado_por) values(p_id,p_nota,p_items,auth.uid()); end if;
 elsif p_accion='RESOLVER' then
  update public.traslados set estado='RECIBIDO' where id=p_id;
  update public.traslado_incidencias set resolucion=p_nota,resuelto_por=auth.uid(),resuelto_at=now() where traslado_id=p_id and resuelto_at is null;
 elsif p_accion='SOLICITAR_REVERSION' then
  update public.traslados set estado='INCIDENCIA',reversion_solicitada=true where id=p_id;
  insert into public.traslado_incidencias(traslado_id,observaciones,detalle,creado_por) values(p_id,p_nota,'{"tipo":"RETORNO"}',auth.uid());
 elsif p_accion='AUTORIZAR_REVERSION' then update public.traslados set reversion_autorizada=true where id=p_id;
 elsif p_accion in ('CANCELAR','REVERTIR') then
  update public.traslados set estado='CANCELADO' where id=p_id;
  update public.traslado_incidencias set resolucion=p_nota,resuelto_por=auth.uid(),resuelto_at=now() where traslado_id=p_id and resuelto_at is null;
 end if;
 perform transporte_privado.evento(p_id,p_accion,p_nota,p_items);
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('transporte-interno','transporte-interno',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
create function transporte_privado.archivo_permitido(p_ruta text,p_escritura boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.traslados t where t.id::text=split_part(p_ruta,'/',1)
 and transporte_privado.sede() in (t.origen,t.destino)
 and (not p_escritura or (split_part(p_ruta,'/',2)='COMPROBANTE' and t.estado='BORRADOR' and transporte_privado.sede()=t.origen)
 or (split_part(p_ruta,'/',2)='EVIDENCIA' and t.estado in ('EN_TRANSITO','INCIDENCIA'))))
$$;
create policy transporte_storage_select on storage.objects for select to authenticated
 using(bucket_id='transporte-interno' and transporte_privado.archivo_permitido(name,false));
create policy transporte_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='transporte-interno' and transporte_privado.archivo_permitido(name,true));
-- No UPDATE/DELETE: los comprobantes y evidencias son inmutables, tampoco se sustituyen por upsert.
create function transporte_privado.adjuntar(p_id uuid,p_archivo uuid,p_tipo text,p_nombre text,p_mime text,p_tamano bigint,p_ruta text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.traslados where id=p_id for update;
 if not transporte_privado.archivo_permitido(p_ruta,true) or split_part(p_ruta,'/',1)<>p_id::text or split_part(p_ruta,'/',2)<>p_tipo then raise exception 'Archivo no autorizado'; end if;
 if p_mime not in ('application/pdf','image/jpeg','image/png','image/webp') or p_tamano<=0 or p_tamano>10485760 then raise exception 'Archivo inválido'; end if;
 if not exists(select 1 from storage.objects where bucket_id='transporte-interno' and name=p_ruta and owner_id=auth.uid()::text and (metadata->>'size')::bigint=p_tamano and metadata->>'mimetype'=p_mime) then raise exception 'El archivo no está almacenado o sus metadatos no coinciden'; end if;
 insert into public.traslado_archivos(id,traslado_id,tipo,ruta,nombre,mime,tamano,creado_por) values(p_archivo,p_id,p_tipo,p_ruta,p_nombre,p_mime,p_tamano,auth.uid()) on conflict(id) do nothing;
 if found then perform transporte_privado.evento(p_id,'ARCHIVO',p_nombre,jsonb_build_object('tipo',p_tipo,'ruta',p_ruta)); end if;
end $$;

-- API invoker: la lógica privilegiada permanece fuera de los esquemas expuestos.
create function public.transporte_crear(p_id uuid,p_datos jsonb,p_items jsonb) returns uuid language sql security invoker set search_path='' as $$ select transporte_privado.crear(p_id,p_datos,p_items) $$;
create function public.transporte_operar(p_id uuid,p_accion text,p_nota text default '',p_items jsonb default '[]') returns void language sql security invoker set search_path='' as $$ select transporte_privado.operar(p_id,p_accion,p_nota,p_items) $$;
create function public.transporte_adjuntar(p_id uuid,p_archivo uuid,p_tipo text,p_nombre text,p_mime text,p_tamano bigint,p_ruta text) returns void language sql security invoker set search_path='' as $$ select transporte_privado.adjuntar(p_id,p_archivo,p_tipo,p_nombre,p_mime,p_tamano,p_ruta) $$;
revoke all on all functions in schema transporte_privado from public, anon, authenticated;
grant execute on function transporte_privado.sede(),transporte_privado.visible(uuid),transporte_privado.archivo_permitido(text,boolean),transporte_privado.crear(uuid,jsonb,jsonb),transporte_privado.operar(uuid,text,text,jsonb),transporte_privado.adjuntar(uuid,uuid,text,text,text,bigint,text) to authenticated;
revoke all on function public.transporte_crear(uuid,jsonb,jsonb),public.transporte_operar(uuid,text,text,jsonb),public.transporte_adjuntar(uuid,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.transporte_crear(uuid,jsonb,jsonb),public.transporte_operar(uuid,text,text,jsonb),public.transporte_adjuntar(uuid,uuid,text,text,text,bigint,text) to authenticated;
commit;
