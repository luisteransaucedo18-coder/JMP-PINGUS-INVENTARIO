create or replace function public.validar_saldo_devolucion_item() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_req_id uuid; v_entregado numeric; v_devuelto numeric;
begin
  select requerimiento_id into v_req_id from public.devoluciones_materiales where id = new.devolucion_id;
  if v_req_id is null then raise exception 'La devolución no existe'; end if;
  perform 1 from public.requerimientos where id = v_req_id for update;
  if not exists (select 1 from public.requerimiento_items where requerimiento_id = v_req_id and material_sku = new.material_sku) then raise exception 'El material no pertenece al requerimiento'; end if;
  select coalesce(sum(ei.cantidad_entregada), 0) into v_entregado from public.entregas e join public.entrega_items ei on ei.entrega_id = e.id where e.requerimiento_id = v_req_id and e.estado in ('PARCIAL', 'COMPLETA') and ei.material_sku = new.material_sku;
  select coalesce(sum(di.cantidad), 0) into v_devuelto from public.devoluciones_materiales d join public.devolucion_items di on di.devolucion_id = d.id where d.requerimiento_id = v_req_id and d.estado in ('PENDIENTE_VALIDACION', 'VALIDADA') and di.material_sku = new.material_sku;
  if v_devuelto > v_entregado then raise exception 'La devolución supera el saldo entregado del material %', new.material_sku; end if;
  return new;
end;
$$;
create trigger validar_saldo_devolucion_item before insert or update of cantidad, material_sku on public.devolucion_items for each row execute function public.validar_saldo_devolucion_item();
