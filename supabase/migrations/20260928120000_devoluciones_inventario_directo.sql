alter table public.devoluciones_materiales
  alter column estado set default 'VALIDADA';

drop policy if exists "analista carga sus evidencias de devolucion" on storage.objects;
create policy "participantes cargan evidencias de devolucion" on storage.objects for insert to authenticated
with check (bucket_id = 'evidencias-devoluciones' and public.rol_actual() in ('analista', 'coordinador') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "analista elimina sus evidencias no enviadas" on storage.objects;
create policy "participantes eliminan sus evidencias no enviadas" on storage.objects for delete to authenticated
using (bucket_id = 'evidencias-devoluciones' and owner_id = auth.uid()::text and public.rol_actual() in ('analista', 'coordinador'));

do $$
declare
  v_devolucion record;
  v_item record;
  v_stock_anterior numeric;
  v_stock_nuevo numeric;
begin
  for v_devolucion in
    select * from public.devoluciones_materiales
    where estado = 'PENDIENTE_VALIDACION'
    order by created_at, id
    for update
  loop
    for v_item in
      select * from public.devolucion_items where devolucion_id = v_devolucion.id
    loop
      insert into public.inventario_sedes (material_sku, sede, stock)
      values (v_item.material_sku, v_devolucion.sede_receptora, 0)
      on conflict (material_sku, sede) do nothing;

      select stock into v_stock_anterior
      from public.inventario_sedes
      where material_sku = v_item.material_sku and sede = v_devolucion.sede_receptora
      for update;

      update public.inventario_sedes
      set stock = stock + v_item.cantidad, updated_at = now()
      where material_sku = v_item.material_sku and sede = v_devolucion.sede_receptora
      returning stock into v_stock_nuevo;

      insert into public.movimientos_inventario
        (material_sku, sede, tipo, cantidad, stock_anterior, stock_nuevo, referencia_tipo, referencia_id, motivo, creado_por)
      values
        (v_item.material_sku, v_devolucion.sede_receptora, 'INGRESO_DEVOLUCION', v_item.cantidad,
         v_stock_anterior, v_stock_nuevo, 'DEVOLUCION', v_devolucion.id,
         'Devolución registrada al habilitar el ingreso directo', v_devolucion.analista_id);
    end loop;

    update public.devoluciones_materiales
    set estado = 'VALIDADA', updated_at = now()
    where id = v_devolucion.id;

    insert into public.devolucion_historial (devolucion_id, estado, comentario, actor_id)
    values (v_devolucion.id, 'VALIDADA', 'Inventario actualizado al habilitar el registro directo', v_devolucion.analista_id);
  end loop;
end;
$$;

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
  v_rol text;
  v_item jsonb;
  v_sku text;
  v_cantidad numeric;
  v_entregado numeric;
  v_devuelto numeric;
  v_stock_anterior numeric;
  v_stock_nuevo numeric;
  v_path text;
begin
  v_rol := public.rol_actual();
  if auth.uid() is null or v_rol not in ('analista', 'coordinador') then
    raise exception 'Solo un analista o coordinador activo puede registrar devoluciones';
  end if;

  select * into v_requerimiento
  from public.requerimientos
  where id = p_requerimiento_id
    and estado = 'CONFIRMADO'
    and (v_rol = 'coordinador' or analista_id = auth.uid())
  for update;
  if not found then raise exception 'El requerimiento no está confirmado o no está disponible'; end if;
  if p_sede_receptora not in ('Chiclayo', 'Chimbote', 'Trujillo') then raise exception 'La sede receptora no es válida'; end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Registra al menos un material'; end if;
  if coalesce(jsonb_typeof(p_evidencias), '') <> 'array' or jsonb_array_length(p_evidencias) = 0 then raise exception 'Adjunta al menos una fotografía'; end if;
  if exists (select 1 from public.devoluciones_materiales where id = p_id) then raise exception 'Esta devolución ya fue registrada'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_sku := v_item->>'material_sku';
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_sku is null or v_cantidad is null or v_cantidad <= 0 then raise exception 'Cada material debe tener una cantidad positiva'; end if;
    if not exists (select 1 from public.requerimiento_items where requerimiento_id = p_requerimiento_id and material_sku = v_sku) then raise exception 'El material % no pertenece al requerimiento', v_sku; end if;
    select coalesce(sum(ei.cantidad_entregada), 0) into v_entregado
    from public.entregas e join public.entrega_items ei on ei.entrega_id = e.id
    where e.requerimiento_id = p_requerimiento_id and e.estado in ('PARCIAL', 'COMPLETA') and ei.material_sku = v_sku;
    select coalesce(sum(di.cantidad), 0) into v_devuelto
    from public.devoluciones_materiales d join public.devolucion_items di on di.devolucion_id = d.id
    where d.requerimiento_id = p_requerimiento_id and d.estado in ('PENDIENTE_VALIDACION', 'VALIDADA') and di.material_sku = v_sku;
    if v_cantidad > v_entregado - v_devuelto then raise exception 'La cantidad a devolver de % supera el saldo entregado', v_sku; end if;
  end loop;

  for v_path in select jsonb_array_elements_text(coalesce(p_evidencias, '[]'::jsonb)) loop
    if v_path !~ ('^' || auth.uid()::text || '/' || p_id::text || '/') then raise exception 'La evidencia no pertenece al usuario o a esta devolución'; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'evidencias-devoluciones' and name = v_path and owner_id = auth.uid()::text) then raise exception 'No se encontró la evidencia cargada'; end if;
  end loop;

  insert into public.devoluciones_materiales
    (id, proyecto_id, requerimiento_id, ubicacion_proyecto, sede_receptora, analista_id, estado)
  values
    (p_id, v_requerimiento.proyecto_id, p_requerimiento_id, v_requerimiento.ubicacion, p_sede_receptora, auth.uid(), 'VALIDADA');

  insert into public.devolucion_items (devolucion_id, material_sku, material_nombre, unidad, cantidad)
  select p_id, value->>'material_sku', value->>'material_nombre', value->>'unidad', (value->>'cantidad')::numeric
  from jsonb_array_elements(p_items);

  insert into public.devolucion_evidencias (devolucion_id, storage_path)
  select p_id, jsonb_array_elements_text(coalesce(p_evidencias, '[]'::jsonb));

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_sku := v_item->>'material_sku';
    v_cantidad := (v_item->>'cantidad')::numeric;

    insert into public.inventario_sedes (material_sku, sede, stock)
    values (v_sku, p_sede_receptora, 0)
    on conflict (material_sku, sede) do nothing;

    select stock into v_stock_anterior
    from public.inventario_sedes
    where material_sku = v_sku and sede = p_sede_receptora
    for update;

    update public.inventario_sedes
    set stock = stock + v_cantidad, updated_at = now()
    where material_sku = v_sku and sede = p_sede_receptora
    returning stock into v_stock_nuevo;

    insert into public.movimientos_inventario
      (material_sku, sede, tipo, cantidad, stock_anterior, stock_nuevo, referencia_tipo, referencia_id, motivo, creado_por)
    values
      (v_sku, p_sede_receptora, 'INGRESO_DEVOLUCION', v_cantidad, v_stock_anterior, v_stock_nuevo,
       'DEVOLUCION', p_id, 'Devolución registrada', auth.uid());
  end loop;

  insert into public.devolucion_historial (devolucion_id, estado, comentario, actor_id)
  values (p_id, 'VALIDADA', 'Devolución registrada e inventario actualizado automáticamente', auth.uid());
  return p_id;
end;
$$;

revoke all on function public.registrar_devolucion(uuid, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_devolucion(uuid, uuid, text, jsonb, jsonb) to authenticated;
revoke all on function public.corregir_devolucion(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.resolver_devolucion(uuid, boolean, text) from public, anon, authenticated;