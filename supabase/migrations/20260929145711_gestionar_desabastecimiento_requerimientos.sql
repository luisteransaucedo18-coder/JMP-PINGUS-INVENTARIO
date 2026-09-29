begin;

create schema if not exists requerimientos_privado;
revoke all on schema requerimientos_privado from public, anon;
grant usage on schema requerimientos_privado to authenticated;

alter table public.requerimiento_items
  add column stock_al_envio numeric,
  add column faltante_al_envio numeric;

alter table public.requerimiento_items
  add constraint requerimiento_items_stock_al_envio_check
    check (stock_al_envio is null or stock_al_envio >= 0),
  add constraint requerimiento_items_faltante_al_envio_check
    check (faltante_al_envio is null or faltante_al_envio >= 0);

alter table public.ordenes_compra
  add column requerimiento_id uuid references public.requerimientos(id) on delete set null;
create unique index orden_compra_requerimiento_unica
  on public.ordenes_compra(requerimiento_id)
  where requerimiento_id is not null;

create table public.requerimiento_abastecimiento (
  requerimiento_id uuid primary key references public.requerimientos(id) on delete cascade,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','EN_GESTION','RESUELTO')),
  tipo text check (tipo in ('COMPRA','TRASLADO')),
  origen_sugerido text references public.sedes(nombre),
  observaciones text,
  gestionado_por uuid references public.perfiles(id) on delete set null,
  gestionado_at timestamptz,
  orden_compra_id uuid references public.ordenes_compra(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (estado = 'PENDIENTE' and tipo is null and gestionado_por is null and gestionado_at is null)
    or (estado in ('EN_GESTION','RESUELTO') and tipo is not null and gestionado_por is not null and gestionado_at is not null)
  )
);

alter table public.requerimiento_abastecimiento enable row level security;
create policy "abastecimiento visible a participantes"
on public.requerimiento_abastecimiento for select to authenticated
using (
  exists (
    select 1
    from public.requerimientos r
    where r.id = requerimiento_id
      and (
        r.analista_id = (select auth.uid())
        or (select public.rol_actual()) in ('coordinador','gerente')
      )
  )
);
revoke all on public.requerimiento_abastecimiento from anon, authenticated;
grant select on public.requerimiento_abastecimiento to authenticated;

create or replace function requerimientos_privado.registrar_faltantes_al_enviar()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'BORRADOR' and new.estado = 'ENVIADO' then
    update public.requerimiento_items ri
    set stock_al_envio = coalesce(inv.stock, 0),
        faltante_al_envio = greatest(ri.cantidad - coalesce(inv.stock, 0), 0)
    from (
      select item.id, stock.stock
      from public.requerimiento_items item
      left join public.inventario_sedes stock
        on stock.material_sku = item.material_sku
       and stock.sede = new.sede
      where item.requerimiento_id = new.id
    ) inv
    where ri.id = inv.id;

    if exists (
      select 1 from public.requerimiento_items
      where requerimiento_id = new.id and faltante_al_envio > 0
    ) then
      insert into public.requerimiento_abastecimiento(requerimiento_id)
      values(new.id)
      on conflict (requerimiento_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger zz_registrar_faltantes_al_enviar
before update of estado on public.requerimientos
for each row execute function requerimientos_privado.registrar_faltantes_al_enviar();

create or replace function requerimientos_privado.cerrar_abastecimiento_confirmado()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'ENVIADO' and new.estado = 'CONFIRMADO' then
    update public.requerimiento_abastecimiento
    set estado = 'RESUELTO', updated_at = now()
    where requerimiento_id = new.id and estado = 'EN_GESTION';
  end if;
  return new;
end;
$$;

create trigger cerrar_abastecimiento_confirmado
after update of estado on public.requerimientos
for each row execute function requerimientos_privado.cerrar_abastecimiento_confirmado();

create or replace function requerimientos_privado.planificar_abastecimiento(
  p_requerimiento_id uuid,
  p_tipo text,
  p_origen_sugerido text default null,
  p_observaciones text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.requerimientos%rowtype;
  v_plan public.requerimiento_abastecimiento%rowtype;
  v_orden_id uuid;
  v_faltantes integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'coordinador' and estado = 'ACTIVO'
  ) then
    raise exception 'Solo un coordinador activo puede gestionar el abastecimiento';
  end if;
  if p_tipo not in ('COMPRA','TRASLADO') then
    raise exception 'Selecciona compra o traslado interno';
  end if;

  select * into v_req from public.requerimientos
  where id = p_requerimiento_id for update;
  if not found or v_req.estado <> 'ENVIADO' then
    raise exception 'El requerimiento ya no está pendiente';
  end if;

  select count(*) into v_faltantes
  from public.requerimiento_items ri
  left join public.inventario_sedes inv
    on inv.material_sku = ri.material_sku and inv.sede = v_req.sede
  where ri.requerimiento_id = p_requerimiento_id
    and ri.cantidad > coalesce(inv.stock, 0);
  if v_faltantes = 0 then
    raise exception 'El requerimiento ya cuenta con stock suficiente y puede confirmarse';
  end if;

  select * into v_plan from public.requerimiento_abastecimiento
  where requerimiento_id = p_requerimiento_id for update;
  if not found then
    insert into public.requerimiento_abastecimiento(requerimiento_id)
    values(p_requerimiento_id)
    returning * into v_plan;
  end if;
  if v_plan.estado = 'EN_GESTION' then
    if v_plan.tipo = p_tipo then return v_plan.orden_compra_id; end if;
    raise exception 'Este requerimiento ya tiene una ruta de abastecimiento en gestión';
  end if;

  if p_tipo = 'TRASLADO' then
    if p_origen_sugerido is null or p_origen_sugerido = v_req.sede then
      raise exception 'Selecciona una sede de origen distinta a la sede solicitante';
    end if;
    if not exists (
      select 1
      from public.requerimiento_items ri
      join public.inventario_sedes inv
        on inv.material_sku = ri.material_sku and inv.sede = p_origen_sugerido
      where ri.requerimiento_id = p_requerimiento_id and inv.stock > 0
    ) then
      raise exception 'La sede sugerida no tiene existencias para los materiales faltantes';
    end if;
  else
    insert into public.ordenes_compra(
      sede, analista_id, motivo, estado, requerimiento_id
    ) values (
      v_req.sede,
      v_req.analista_id,
      'Abastecimiento automático para ' || v_req.codigo,
      'ENVIADO',
      p_requerimiento_id
    )
    on conflict (requerimiento_id) where requerimiento_id is not null
    do update set updated_at = now()
    returning id into v_orden_id;

    insert into public.orden_compra_items(
      orden_compra_id, material_sku, material_nombre,
      cantidad_solicitada, precio_unitario
    )
    select
      v_orden_id,
      ri.material_sku,
      ri.material_nombre,
      greatest(ri.cantidad - coalesce(inv.stock, 0), 0),
      coalesce(m.precio_unitario, 0)
    from public.requerimiento_items ri
    join public.materiales m on m.sku = ri.material_sku
    left join public.inventario_sedes inv
      on inv.material_sku = ri.material_sku and inv.sede = v_req.sede
    where ri.requerimiento_id = p_requerimiento_id
      and ri.cantidad > coalesce(inv.stock, 0)
    on conflict (orden_compra_id, material_sku) do nothing;
  end if;

  update public.requerimiento_abastecimiento
  set estado = 'EN_GESTION',
      tipo = p_tipo,
      origen_sugerido = case when p_tipo = 'TRASLADO' then p_origen_sugerido else null end,
      observaciones = nullif(btrim(p_observaciones),''),
      gestionado_por = auth.uid(),
      gestionado_at = now(),
      orden_compra_id = v_orden_id,
      updated_at = now()
  where requerimiento_id = p_requerimiento_id;

  return v_orden_id;
end;
$$;

create or replace function public.planificar_abastecimiento_requerimiento(
  p_requerimiento_id uuid,
  p_tipo text,
  p_origen_sugerido text default null,
  p_observaciones text default null
) returns uuid
language sql security invoker set search_path = '' as $$
  select requerimientos_privado.planificar_abastecimiento(
    p_requerimiento_id, p_tipo, p_origen_sugerido, p_observaciones
  )
$$;

revoke all on all functions in schema requerimientos_privado from public, anon, authenticated;
grant execute on function
  requerimientos_privado.planificar_abastecimiento(uuid,text,text,text)
to authenticated;
revoke all on function
  public.planificar_abastecimiento_requerimiento(uuid,text,text,text)
from public, anon;
grant execute on function
  public.planificar_abastecimiento_requerimiento(uuid,text,text,text)
to authenticated;

-- Recupera alertas para requerimientos enviados antes de esta migración.
update public.requerimiento_items ri
set stock_al_envio = coalesce((
      select inv.stock
      from public.inventario_sedes inv
      join public.requerimientos r on r.sede = inv.sede
      where r.id = ri.requerimiento_id
        and inv.material_sku = ri.material_sku
    ), 0),
    faltante_al_envio = greatest(ri.cantidad - coalesce((
      select inv.stock
      from public.inventario_sedes inv
      join public.requerimientos r on r.sede = inv.sede
      where r.id = ri.requerimiento_id
        and inv.material_sku = ri.material_sku
    ), 0), 0)
where exists (
  select 1 from public.requerimientos r
  where r.id = ri.requerimiento_id and r.estado = 'ENVIADO'
);

insert into public.requerimiento_abastecimiento(requerimiento_id)
select distinct r.id
from public.requerimientos r
join public.requerimiento_items ri on ri.requerimiento_id = r.id
where r.estado = 'ENVIADO' and ri.faltante_al_envio > 0
on conflict (requerimiento_id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'requerimiento_abastecimiento'
  ) then
    alter publication supabase_realtime add table public.requerimiento_abastecimiento;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
