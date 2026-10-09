begin;
alter table public.materiales add column metros_por_rollo numeric(12,3);
alter table public.materiales add constraint material_metros_por_rollo_valido check(metros_por_rollo is null or (unidad='ROLLO' and metros_por_rollo>0 and metros_por_rollo<=100000));
-- Longitud explícita en el nombre; no se infiere la de otros productos.
update public.materiales set metros_por_rollo=100 where sku='25958' and unidad='ROLLO' and nombre ilike '%ROLLO X 100m%';
create or replace function transporte_privado.cantidad_valida(p_cantidad numeric,p_unidad text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_cantidad >= 0 and p_cantidad < 100000000000 and p_cantidad=round(p_cantidad,3)
   and (upper(trim(p_unidad)) in ('MTS','GLD','ROLLO') or p_cantidad=trunc(p_cantidad)),false)
$$;
create or replace function public.crear_material_con_inventario(
  p_material jsonb,
  p_stock_sedes jsonb
)
returns public.materiales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.materiales%rowtype;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador'::public.rol_usuario then
    raise exception using errcode = '42501', message = 'Solo un coordinador puede crear materiales';
  end if;

  if jsonb_typeof(p_material) is distinct from 'object'
    or p_material - array['sku', 'nombre', 'descripcion', 'categoria_id', 'unidad', 'marca', 'stock_minimo', 'precio_unitario', 'estado', 'imagen_url', 'metros_por_rollo'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Los datos del material no son válidos';
  end if;

  if jsonb_typeof(p_stock_sedes) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_stock_sedes)) <> 3
    or exists (
      select 1 from jsonb_each(p_stock_sedes) as stock(sede, valor)
      where sede not in ('Chiclayo', 'Chimbote', 'Trujillo')
        or jsonb_typeof(valor) is distinct from 'number'
    ) then
    raise exception using errcode = '22023', message = 'Indica un stock numérico para cada sede';
  end if;

  if exists (
    select 1 from jsonb_each_text(p_stock_sedes) as stock(sede, cantidad)
    where cantidad::numeric < 0
  ) then
    raise exception using errcode = '22023', message = 'El stock no puede ser negativo';
  end if;

  insert into public.materiales (
    sku, nombre, descripcion, categoria_id, unidad, marca,
    stock_minimo, precio_unitario, estado, imagen_url, metros_por_rollo
  ) values (
    p_material->>'sku',
    p_material->>'nombre',
    p_material->>'descripcion',
    (p_material->>'categoria_id')::bigint,
    coalesce(p_material->>'unidad', 'UND'),
    p_material->>'marca',
    coalesce((p_material->>'stock_minimo')::numeric, 0),
    coalesce((p_material->>'precio_unitario')::numeric, 0),
    coalesce(p_material->>'estado', 'AGOTADO')::public.estado_material,
    p_material->>'imagen_url', (p_material->>'metros_por_rollo')::numeric
  ) returning * into v_material;

  insert into public.inventario_sedes (material_sku, sede, stock, updated_at)
  select v_material.sku, sede, cantidad::numeric, now()
  from jsonb_each_text(p_stock_sedes) as stock(sede, cantidad);

  select * into v_material
  from public.materiales
  where sku = v_material.sku;

  return v_material;
end;
$$;

create or replace function public.actualizar_material_con_inventario(
  p_sku text,
  p_campos jsonb,
  p_stock_sedes jsonb default null
)
returns public.materiales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material public.materiales%rowtype;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador'::public.rol_usuario then
    raise exception using errcode = '42501', message = 'Solo un coordinador puede actualizar materiales';
  end if;

  if jsonb_typeof(p_campos) is distinct from 'object'
    or p_campos - array['nombre', 'descripcion', 'categoria_id', 'unidad', 'marca', 'stock_minimo', 'estado', 'imagen_url', 'metros_por_rollo'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Los campos del material no son válidos';
  end if;

  if p_stock_sedes is not null then
    if jsonb_typeof(p_stock_sedes) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(p_stock_sedes)) <> 3
      or exists (
        select 1 from jsonb_each(p_stock_sedes) as stock(sede, valor)
        where sede not in ('Chiclayo', 'Chimbote', 'Trujillo')
          or jsonb_typeof(valor) is distinct from 'number'
      ) then
      raise exception using errcode = '22023', message = 'Indica un stock numérico para cada sede';
    end if;

    if exists (
      select 1 from jsonb_each_text(p_stock_sedes) as stock(sede, cantidad)
      where cantidad::numeric < 0
    ) then
      raise exception using errcode = '22023', message = 'El stock no puede ser negativo';
    end if;
  end if;

  update public.materiales
  set nombre = case when p_campos ? 'nombre' then p_campos->>'nombre' else nombre end,
      descripcion = case when p_campos ? 'descripcion' then p_campos->>'descripcion' else descripcion end,
      categoria_id = case when p_campos ? 'categoria_id' then (p_campos->>'categoria_id')::bigint else categoria_id end,
      unidad = case when p_campos ? 'unidad' then p_campos->>'unidad' else unidad end,
      marca = case when p_campos ? 'marca' then p_campos->>'marca' else marca end,
      metros_por_rollo = case when coalesce(p_campos->>'unidad', unidad) <> 'ROLLO' then null when p_campos ? 'metros_por_rollo' then (p_campos->>'metros_por_rollo')::numeric else metros_por_rollo end,
      stock_minimo = case when p_campos ? 'stock_minimo' then (p_campos->>'stock_minimo')::numeric else stock_minimo end,
      estado = case when p_campos ? 'estado' then (p_campos->>'estado')::public.estado_material else estado end,
      imagen_url = case when p_campos ? 'imagen_url' then p_campos->>'imagen_url' else imagen_url end,
      updated_at = now()
  where sku = p_sku
  returning * into v_material;

  if not found then
    raise exception using errcode = 'P0002', message = 'No existe el material solicitado';
  end if;

  if p_stock_sedes is not null then
    insert into public.inventario_sedes (material_sku, sede, stock, updated_at)
    select v_material.sku, sede, cantidad::numeric, now()
    from jsonb_each_text(p_stock_sedes) as stock(sede, cantidad)
    on conflict (material_sku, sede) do update
      set stock = excluded.stock, updated_at = excluded.updated_at;
  end if;

  select * into v_material
  from public.materiales
  where sku = p_sku;

  return v_material;
end;
$$;

revoke all on function public.crear_material_con_inventario(jsonb, jsonb) from public, anon;
revoke all on function public.actualizar_material_con_inventario(text, jsonb, jsonb) from public, anon;
grant execute on function public.crear_material_con_inventario(jsonb, jsonb) to authenticated;
grant execute on function public.actualizar_material_con_inventario(text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

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
    if v_quantity is null or v_quantity<0 or v_quantity<>round(v_quantity,3) or v_quantity::text in ('NaN','Infinity','-Infinity')
    then raise exception 'Cantidad de entrega inválida'; end if;
    select coalesce(sum(i.cantidad_entregada),0) into v_delivered
      from public.entrega_items i join public.entregas e on e.id=i.entrega_id
      where e.requerimiento_id=p_requerimiento_id and e.estado<>'CANCELADA'
        and i.material_sku=v_item->>'material_sku';
    if v_quantity>greatest(0,v_requested-v_delivered)
    then raise exception 'La cantidad excede el saldo pendiente del requerimiento'; end if;
    if exists(select 1 from public.requerimiento_items where requerimiento_id=p_requerimiento_id
      and material_sku=v_item->>'material_sku' and unidad in ('UND','PAR') and v_quantity<>trunc(v_quantity))
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


notify pgrst, 'reload schema';
commit;

