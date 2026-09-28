create sequence public.orden_compra_codigo_seq;

create table public.ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  sede text not null check (sede in ('Chiclayo', 'Chimbote', 'Trujillo')),
  analista_id uuid not null references public.perfiles(id),
  coordinador_id uuid references public.perfiles(id),
  fecha date not null default current_date,
  motivo text not null,
  estado text not null check (estado in ('BORRADOR', 'ENVIADO', 'APROBADO', 'COMPRADO', 'RECHAZADO')),
  observaciones text,
  fecha_aprobacion date,
  fecha_compra date,
  nota_compra text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orden_compra_items (
  id bigint generated always as identity primary key,
  orden_id uuid not null references public.ordenes_compra(id) on delete cascade,
  material_sku text references public.materiales(sku),
  material_nombre text not null,
  cantidad_solicitada numeric not null check (cantidad_solicitada > 0),
  precio_unitario numeric check (precio_unitario is null or precio_unitario >= 0)
);

create index ordenes_compra_analista_idx on public.ordenes_compra (analista_id, created_at desc);
create index ordenes_compra_estado_idx on public.ordenes_compra (estado, created_at desc);
create index orden_compra_items_orden_idx on public.orden_compra_items (orden_id);

alter table public.ordenes_compra enable row level security;
alter table public.orden_compra_items enable row level security;

create policy "ordenes visibles por rol" on public.ordenes_compra
for select to authenticated
using (analista_id = (select auth.uid()) or public.rol_actual() in ('coordinador', 'gerente'));

create policy "items de ordenes visibles por rol" on public.orden_compra_items
for select to authenticated
using (exists (
  select 1 from public.ordenes_compra orden
  where orden.id = orden_id
    and (orden.analista_id = (select auth.uid()) or public.rol_actual() in ('coordinador', 'gerente'))
));

grant select on public.ordenes_compra, public.orden_compra_items to authenticated;

create or replace function public.crear_orden_compra(
  p_sede text,
  p_motivo text,
  p_items jsonb,
  p_borrador boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_codigo text;
  v_item jsonb;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'analista' then
    raise exception 'Solo un analista puede crear órdenes de compra';
  end if;
  if p_sede not in ('Chiclayo', 'Chimbote', 'Trujillo') then raise exception 'Sede inválida'; end if;
  if nullif(btrim(p_motivo), '') is null then raise exception 'El motivo es obligatorio'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Los materiales no son válidos'; end if;
  if not p_borrador and jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un material'; end if;

  v_codigo := 'OC-' || extract(year from current_date)::text || '-' || lpad(nextval('public.orden_compra_codigo_seq')::text, 4, '0');
  insert into public.ordenes_compra (id, codigo, sede, analista_id, motivo, estado)
  values (v_id, v_codigo, p_sede, auth.uid(), btrim(p_motivo), case when p_borrador then 'BORRADOR' else 'ENVIADO' end);

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'cantidad_solicitada')::numeric, 0) <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
    if not p_borrador and nullif(v_item->>'material_sku', '') is null then raise exception 'Selecciona materiales del catálogo'; end if;
    insert into public.orden_compra_items (orden_id, material_sku, material_nombre, cantidad_solicitada, precio_unitario)
    values (
      v_id,
      nullif(v_item->>'material_sku', ''),
      btrim(v_item->>'material_nombre'),
      (v_item->>'cantidad_solicitada')::numeric,
      nullif(v_item->>'precio_unitario', '')::numeric
    );
  end loop;
  return v_id;
end;
$$;

create or replace function public.revisar_orden_compra(
  p_id uuid,
  p_aprobar boolean,
  p_observaciones text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador' then
    raise exception 'Solo un coordinador puede revisar órdenes';
  end if;
  if not p_aprobar and nullif(btrim(p_observaciones), '') is null then raise exception 'Indica el motivo del rechazo'; end if;

  update public.ordenes_compra
  set estado = case when p_aprobar then 'APROBADO' else 'RECHAZADO' end,
      coordinador_id = auth.uid(),
      observaciones = nullif(btrim(p_observaciones), ''),
      fecha_aprobacion = case when p_aprobar then current_date else null end,
      updated_at = now()
  where id = p_id and estado = 'ENVIADO';
  if not found then raise exception 'La orden ya fue revisada o no existe'; end if;
end;
$$;

create or replace function public.confirmar_orden_compra(
  p_id uuid,
  p_nota_compra text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_orden public.ordenes_compra%rowtype;
  v_item record;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador' then
    raise exception 'Solo un coordinador puede confirmar compras';
  end if;
  select * into v_orden from public.ordenes_compra where id = p_id and estado = 'APROBADO' for update;
  if not found then raise exception 'La orden no está aprobada o no existe'; end if;

  for v_item in select material_sku, cantidad_solicitada from public.orden_compra_items where orden_id = p_id loop
    if v_item.material_sku is null then raise exception 'Todos los materiales deben pertenecer al catálogo'; end if;
    insert into public.inventario_sedes (material_sku, sede, stock)
    values (v_item.material_sku, v_orden.sede, v_item.cantidad_solicitada)
    on conflict (material_sku, sede) do update
    set stock = public.inventario_sedes.stock + excluded.stock, updated_at = now();
  end loop;

  update public.ordenes_compra
  set estado = 'COMPRADO', coordinador_id = auth.uid(), fecha_compra = current_date,
      nota_compra = nullif(btrim(p_nota_compra), ''), updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.crear_orden_compra(text, text, jsonb, boolean) from public, anon;
revoke all on function public.revisar_orden_compra(uuid, boolean, text) from public, anon;
revoke all on function public.confirmar_orden_compra(uuid, text) from public, anon;
grant execute on function public.crear_orden_compra(text, text, jsonb, boolean) to authenticated;
grant execute on function public.revisar_orden_compra(uuid, boolean, text) to authenticated;
grant execute on function public.confirmar_orden_compra(uuid, text) to authenticated;

alter publication supabase_realtime add table public.ordenes_compra, public.orden_compra_items;
