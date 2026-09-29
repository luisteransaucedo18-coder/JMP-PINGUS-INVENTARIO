begin;

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
      codigo, sede, analista_id, motivo, estado, requerimiento_id
    ) values (
      'OC-' || extract(year from current_date)::text || '-' ||
        lpad(nextval('public.orden_compra_codigo_seq')::text, 4, '0'),
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
      orden_id, material_sku, material_nombre,
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
      and not exists (
        select 1
        from public.orden_compra_items existing
        where existing.orden_id = v_orden_id
          and existing.material_sku = ri.material_sku
      );
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

notify pgrst, 'reload schema';
commit;
