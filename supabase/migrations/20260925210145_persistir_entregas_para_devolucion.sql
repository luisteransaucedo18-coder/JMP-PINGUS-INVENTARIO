create or replace function public.registrar_entrega(
  p_requerimiento_id uuid,
  p_tecnico text,
  p_dni_tecnico text,
  p_observaciones text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_req public.requerimientos%rowtype; v_id uuid := gen_random_uuid(); v_item jsonb; v_cantidad numeric; v_estado public.estado_entrega;
begin
  if auth.uid() is null or public.rol_actual() not in ('analista', 'coordinador') then raise exception 'No tienes permisos para registrar una entrega'; end if;
  select * into v_req from public.requerimientos where id = p_requerimiento_id and estado = 'CONFIRMADO';
  if not found then raise exception 'El requerimiento no está confirmado'; end if;
  if coalesce(trim(p_tecnico), '') = '' then raise exception 'El técnico es obligatorio'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Registra al menos un material'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad_entregada')::numeric;
    if v_cantidad is null or v_cantidad < 0 or v_cantidad > coalesce((select cantidad from public.requerimiento_items where requerimiento_id = p_requerimiento_id and material_sku = v_item->>'material_sku'), -1) then raise exception 'Cantidad de entrega inválida'; end if;
  end loop;
  select case when bool_and((value->>'cantidad_entregada')::numeric >= (value->>'cantidad_solicitada')::numeric) then 'COMPLETA'::public.estado_entrega when bool_or((value->>'cantidad_entregada')::numeric > 0) then 'PARCIAL'::public.estado_entrega else 'PENDIENTE'::public.estado_entrega end into v_estado from jsonb_array_elements(p_items);
  insert into public.entregas (id, requerimiento_id, proyecto_nombre, tecnico, dni_tecnico, responsable_entrega_id, fecha_hora, estado, observaciones)
  values (v_id, p_requerimiento_id, (select nombre from public.proyectos where id = v_req.proyecto_id), trim(p_tecnico), nullif(trim(p_dni_tecnico), ''), auth.uid(), now(), v_estado, nullif(trim(p_observaciones), ''));
  insert into public.entrega_items (entrega_id, material_sku, material_nombre, cantidad_solicitada, cantidad_entregada)
  select v_id, value->>'material_sku', value->>'material_nombre', (value->>'cantidad_solicitada')::numeric, (value->>'cantidad_entregada')::numeric from jsonb_array_elements(p_items);
  return v_id;
end;
$$;
revoke all on function public.registrar_entrega(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.registrar_entrega(uuid, text, text, text, jsonb) to authenticated;
