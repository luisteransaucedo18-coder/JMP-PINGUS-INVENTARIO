create type public.estado_devolucion as enum ('PENDIENTE_VALIDACION', 'OBSERVADA', 'VALIDADA');

create table public.devoluciones_materiales (
  id uuid primary key,
  codigo text not null unique default ('DEV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  proyecto_id uuid not null references public.proyectos(id),
  requerimiento_id uuid not null references public.requerimientos(id),
  ubicacion_proyecto text not null,
  sede_receptora text not null,
  analista_id uuid not null references public.perfiles(id),
  estado public.estado_devolucion not null default 'PENDIENTE_VALIDACION',
  observacion text,
  observado_por uuid references public.perfiles(id),
  fecha_observacion timestamptz,
  validado_por uuid references public.perfiles(id),
  fecha_validacion timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devolucion_items (
  id bigint generated always as identity primary key,
  devolucion_id uuid not null references public.devoluciones_materiales(id) on delete cascade,
  material_sku text not null references public.materiales(sku),
  material_nombre text not null,
  unidad text,
  cantidad numeric not null check (cantidad > 0),
  unique (devolucion_id, material_sku)
);

create table public.devolucion_evidencias (
  id bigint generated always as identity primary key,
  devolucion_id uuid not null references public.devoluciones_materiales(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table public.devolucion_historial (
  id bigint generated always as identity primary key,
  devolucion_id uuid not null references public.devoluciones_materiales(id) on delete cascade,
  estado public.estado_devolucion not null,
  comentario text,
  actor_id uuid not null references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index devoluciones_materiales_analista_idx on public.devoluciones_materiales (analista_id, created_at desc);
create index devoluciones_materiales_estado_idx on public.devoluciones_materiales (estado, created_at desc);
create index devolucion_items_sku_idx on public.devolucion_items (material_sku);

alter table public.devoluciones_materiales enable row level security;
alter table public.devolucion_items enable row level security;
alter table public.devolucion_evidencias enable row level security;
alter table public.devolucion_historial enable row level security;

create policy "devoluciones visibles a participantes" on public.devoluciones_materiales for select to authenticated
using (analista_id = auth.uid() or public.rol_actual() in ('coordinador', 'gerente'));
create policy "items de devolucion visibles a participantes" on public.devolucion_items for select to authenticated
using (exists (select 1 from public.devoluciones_materiales d where d.id = devolucion_id and (d.analista_id = auth.uid() or public.rol_actual() in ('coordinador', 'gerente'))));
create policy "evidencias de devolucion visibles a participantes" on public.devolucion_evidencias for select to authenticated
using (exists (select 1 from public.devoluciones_materiales d where d.id = devolucion_id and (d.analista_id = auth.uid() or public.rol_actual() in ('coordinador', 'gerente'))));
create policy "historial de devolucion visible a participantes" on public.devolucion_historial for select to authenticated
using (exists (select 1 from public.devoluciones_materiales d where d.id = devolucion_id and (d.analista_id = auth.uid() or public.rol_actual() in ('coordinador', 'gerente'))));

insert into storage.buckets (id, name, public) values ('evidencias-devoluciones', 'evidencias-devoluciones', false)
on conflict (id) do nothing;

create policy "analista carga sus evidencias de devolucion" on storage.objects for insert to authenticated
with check (bucket_id = 'evidencias-devoluciones' and public.rol_actual() = 'analista' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "participantes leen evidencias de devolucion" on storage.objects for select to authenticated
using (bucket_id = 'evidencias-devoluciones' and (owner_id = auth.uid()::text or public.rol_actual() in ('coordinador', 'gerente')));
create policy "analista elimina sus evidencias no enviadas" on storage.objects for delete to authenticated
using (bucket_id = 'evidencias-devoluciones' and owner_id = auth.uid()::text and public.rol_actual() = 'analista');

create or replace function public.registrar_devolucion(
  p_id uuid,
  p_requerimiento_id uuid,
  p_sede_receptora text,
  p_items jsonb,
  p_evidencias jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_requerimiento public.requerimientos%rowtype;
  v_item jsonb;
  v_sku text;
  v_cantidad numeric;
  v_entregado numeric;
  v_devuelto numeric;
  v_path text;
begin
  if auth.uid() is null or public.rol_actual() <> 'analista' then raise exception 'Solo un analista activo puede registrar devoluciones'; end if;
  select * into v_requerimiento from public.requerimientos where id = p_requerimiento_id and analista_id = auth.uid() and estado = 'CONFIRMADO';
  if not found then raise exception 'El requerimiento no está confirmado o no pertenece al analista'; end if;
  if p_sede_receptora not in ('Chiclayo', 'Chimbote', 'Trujillo') then raise exception 'La sede receptora no es válida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Registra al menos un material'; end if;
  if jsonb_typeof(p_evidencias) <> 'array' or jsonb_array_length(p_evidencias) = 0 then raise exception 'Adjunta al menos una fotografía'; end if;
  if exists (select 1 from public.devoluciones_materiales where id = p_id) then raise exception 'Esta devolución ya fue registrada'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_sku := v_item->>'material_sku';
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_sku is null or v_cantidad is null or v_cantidad <= 0 then raise exception 'Cada material debe tener una cantidad positiva'; end if;
    if not exists (select 1 from public.requerimiento_items where requerimiento_id = p_requerimiento_id and material_sku = v_sku) then raise exception 'El material % no pertenece al requerimiento', v_sku; end if;
    select coalesce(sum(ei.cantidad_entregada), 0) into v_entregado from public.entregas e join public.entrega_items ei on ei.entrega_id = e.id where e.requerimiento_id = p_requerimiento_id and e.estado in ('PARCIAL', 'COMPLETA') and ei.material_sku = v_sku;
    select coalesce(sum(di.cantidad), 0) into v_devuelto from public.devoluciones_materiales d join public.devolucion_items di on di.devolucion_id = d.id where d.requerimiento_id = p_requerimiento_id and d.estado in ('PENDIENTE_VALIDACION', 'VALIDADA') and di.material_sku = v_sku;
    if v_cantidad > v_entregado - v_devuelto then raise exception 'La cantidad a devolver de % supera el saldo entregado', v_sku; end if;
  end loop;

  for v_path in select jsonb_array_elements_text(p_evidencias) loop
    if v_path !~ ('^' || auth.uid()::text || '/' || p_id::text || '/') then raise exception 'La evidencia no pertenece al analista o a esta devolución'; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'evidencias-devoluciones' and name = v_path and owner_id = auth.uid()::text) then raise exception 'No se encontró la evidencia cargada'; end if;
  end loop;

  insert into public.devoluciones_materiales (id, proyecto_id, requerimiento_id, ubicacion_proyecto, sede_receptora, analista_id)
  values (p_id, v_requerimiento.proyecto_id, p_requerimiento_id, v_requerimiento.ubicacion, p_sede_receptora, auth.uid());
  insert into public.devolucion_items (devolucion_id, material_sku, material_nombre, unidad, cantidad)
  select p_id, value->>'material_sku', value->>'material_nombre', value->>'unidad', (value->>'cantidad')::numeric from jsonb_array_elements(p_items);
  insert into public.devolucion_evidencias (devolucion_id, storage_path) select p_id, jsonb_array_elements_text(p_evidencias);
  insert into public.devolucion_historial (devolucion_id, estado, comentario, actor_id) values (p_id, 'PENDIENTE_VALIDACION', 'Devolución registrada para validación', auth.uid());
  return p_id;
end;
$$;

create or replace function public.corregir_devolucion(p_id uuid, p_sede_receptora text, p_items jsonb, p_evidencias jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare v_req_id uuid; v_item jsonb; v_sku text; v_cantidad numeric; v_entregado numeric; v_devuelto numeric; v_path text;
begin
  select requerimiento_id into v_req_id from public.devoluciones_materiales where id = p_id and analista_id = auth.uid() and estado = 'OBSERVADA' for update;
  if not found or public.rol_actual() <> 'analista' then raise exception 'Solo el analista responsable puede corregir una devolución observada'; end if;
  delete from public.devolucion_items where devolucion_id = p_id;
  delete from public.devolucion_evidencias where devolucion_id = p_id;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_typeof(p_evidencias) <> 'array' or jsonb_array_length(p_evidencias) = 0 then raise exception 'Debes registrar materiales y al menos una fotografía'; end if;
  if p_sede_receptora not in ('Chiclayo', 'Chimbote', 'Trujillo') then raise exception 'La sede receptora no es válida'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_sku := v_item->>'material_sku'; v_cantidad := (v_item->>'cantidad')::numeric;
    if v_sku is null or v_cantidad is null or v_cantidad <= 0 then raise exception 'Cada material debe tener una cantidad positiva'; end if;
    if not exists (select 1 from public.requerimiento_items where requerimiento_id = v_req_id and material_sku = v_sku) then raise exception 'El material % no pertenece al requerimiento', v_sku; end if;
    select coalesce(sum(ei.cantidad_entregada), 0) into v_entregado from public.entregas e join public.entrega_items ei on ei.entrega_id = e.id where e.requerimiento_id = v_req_id and e.estado in ('PARCIAL', 'COMPLETA') and ei.material_sku = v_sku;
    select coalesce(sum(di.cantidad), 0) into v_devuelto from public.devoluciones_materiales d join public.devolucion_items di on di.devolucion_id = d.id where d.requerimiento_id = v_req_id and d.id <> p_id and d.estado in ('PENDIENTE_VALIDACION', 'VALIDADA') and di.material_sku = v_sku;
    if v_cantidad > v_entregado - v_devuelto then raise exception 'La cantidad a devolver de % supera el saldo entregado', v_sku; end if;
  end loop;
  for v_path in select jsonb_array_elements_text(p_evidencias) loop
    if v_path !~ ('^' || auth.uid()::text || '/' || p_id::text || '/') or not exists (select 1 from storage.objects where bucket_id = 'evidencias-devoluciones' and name = v_path and owner_id = auth.uid()::text) then raise exception 'La evidencia no pertenece al analista o no fue cargada'; end if;
  end loop;
  update public.devoluciones_materiales set sede_receptora = p_sede_receptora, estado = 'PENDIENTE_VALIDACION', observacion = null, observado_por = null, fecha_observacion = null, updated_at = now() where id = p_id;
  insert into public.devolucion_items (devolucion_id, material_sku, material_nombre, unidad, cantidad) select p_id, value->>'material_sku', value->>'material_nombre', value->>'unidad', (value->>'cantidad')::numeric from jsonb_array_elements(p_items);
  insert into public.devolucion_evidencias (devolucion_id, storage_path) select p_id, jsonb_array_elements_text(p_evidencias);
  insert into public.devolucion_historial (devolucion_id, estado, comentario, actor_id) values (p_id, 'PENDIENTE_VALIDACION', 'Devolución corregida y reenviada', auth.uid());
end;
$$;

create or replace function public.resolver_devolucion(p_id uuid, p_validar boolean, p_observacion text default null) returns void
language plpgsql security definer set search_path = public
as $$
declare v_devolucion public.devoluciones_materiales%rowtype; v_item record; v_stock numeric;
begin
  if auth.uid() is null or public.rol_actual() <> 'coordinador' then raise exception 'Solo un coordinador activo puede resolver devoluciones'; end if;
  select * into v_devolucion from public.devoluciones_materiales where id = p_id for update;
  if not found then raise exception 'La devolución no existe'; end if;
  if v_devolucion.estado <> 'PENDIENTE_VALIDACION' then raise exception 'La devolución ya fue resuelta'; end if;
  if not p_validar then
    if coalesce(trim(p_observacion), '') = '' then raise exception 'La observación es obligatoria'; end if;
    update public.devoluciones_materiales set estado = 'OBSERVADA', observacion = trim(p_observacion), observado_por = auth.uid(), fecha_observacion = now(), updated_at = now() where id = p_id;
    insert into public.devolucion_historial (devolucion_id, estado, comentario, actor_id) values (p_id, 'OBSERVADA', trim(p_observacion), auth.uid());
    return;
  end if;
  for v_item in select * from public.devolucion_items where devolucion_id = p_id loop
    select stock into v_stock from public.inventario_sedes where material_sku = v_item.material_sku and sede = v_devolucion.sede_receptora for update;
    if not found then
      insert into public.inventario_sedes (material_sku, sede, stock) values (v_item.material_sku, v_devolucion.sede_receptora, v_item.cantidad);
      v_stock := 0;
    else
      update public.inventario_sedes set stock = stock + v_item.cantidad, updated_at = now() where material_sku = v_item.material_sku and sede = v_devolucion.sede_receptora;
    end if;
    insert into public.movimientos_inventario (material_sku, sede, tipo, cantidad, stock_anterior, stock_nuevo, referencia_tipo, referencia_id, motivo, creado_por)
    values (v_item.material_sku, v_devolucion.sede_receptora, 'INGRESO_DEVOLUCION', v_item.cantidad, v_stock, v_stock + v_item.cantidad, 'DEVOLUCION', p_id, 'Devolución validada', auth.uid());
  end loop;
  update public.devoluciones_materiales set estado = 'VALIDADA', validado_por = auth.uid(), fecha_validacion = now(), updated_at = now() where id = p_id;
  insert into public.devolucion_historial (devolucion_id, estado, comentario, actor_id) values (p_id, 'VALIDADA', 'Devolución validada e ingreso de stock registrado', auth.uid());
end;
$$;

revoke all on function public.registrar_devolucion(uuid, uuid, text, jsonb, jsonb) from public, anon;
revoke all on function public.corregir_devolucion(uuid, text, jsonb, jsonb) from public, anon;
revoke all on function public.resolver_devolucion(uuid, boolean, text) from public, anon;
grant execute on function public.registrar_devolucion(uuid, uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.corregir_devolucion(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.resolver_devolucion(uuid, boolean, text) to authenticated;

alter publication supabase_realtime add table public.devoluciones_materiales, public.devolucion_items, public.devolucion_evidencias, public.devolucion_historial;
