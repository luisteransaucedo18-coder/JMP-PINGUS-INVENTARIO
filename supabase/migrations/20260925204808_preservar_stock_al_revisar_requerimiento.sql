create or replace function public.revisar_requerimiento(
  p_requerimiento_id uuid,
  p_confirmar boolean,
  p_observaciones text default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_requerimiento public.requerimientos%rowtype;
  v_item record;
  v_stock_anterior numeric;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador' then
    raise exception 'Solo un coordinador puede revisar solicitudes';
  end if;

  select * into v_requerimiento from public.requerimientos
  where id = p_requerimiento_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_requerimiento.estado <> 'ENVIADO' then
    raise exception 'La solicitud ya fue revisada. Actualiza la lista';
  end if;

  if p_confirmar then
    for v_item in select material_sku, material_nombre, cantidad from public.requerimiento_items
      where requerimiento_id = p_requerimiento_id order by id loop
      select stock into v_stock_anterior from public.inventario_sedes
      where material_sku = v_item.material_sku and sede = v_requerimiento.sede for update;
      if not found or v_stock_anterior < v_item.cantidad then
        raise exception 'Stock insuficiente para % (%) en %', v_item.material_nombre, v_item.material_sku, v_requerimiento.sede;
      end if;
      update public.inventario_sedes set stock = stock - v_item.cantidad
      where material_sku = v_item.material_sku and sede = v_requerimiento.sede;
      insert into public.movimientos_inventario(material_sku,sede,tipo,cantidad,stock_anterior,stock_nuevo,referencia_tipo,referencia_id,motivo,creado_por)
      values(v_item.material_sku,v_requerimiento.sede,'SALIDA_ENTREGA',v_item.cantidad,v_stock_anterior,v_stock_anterior-v_item.cantidad,
        'requerimiento',p_requerimiento_id,nullif(btrim(p_observaciones),''),auth.uid());
    end loop;
    update public.requerimientos set estado='CONFIRMADO', observaciones=nullif(btrim(p_observaciones), '')
    where id=p_requerimiento_id;
  else
    if nullif(btrim(p_observaciones),'') is null then raise exception 'Indica el motivo del rechazo'; end if;
    update public.requerimientos set estado='RECHAZADO', observaciones=btrim(p_observaciones)
    where id=p_requerimiento_id;
  end if;
end $$;
