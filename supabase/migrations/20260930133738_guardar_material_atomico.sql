begin;

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
    or p_material - array['sku', 'nombre', 'descripcion', 'categoria_id', 'unidad', 'marca', 'stock_minimo', 'precio_unitario', 'estado', 'imagen_url'] <> '{}'::jsonb then
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
    stock_minimo, precio_unitario, estado, imagen_url
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
    p_material->>'imagen_url'
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
    or p_campos - array['nombre', 'descripcion', 'categoria_id', 'unidad', 'marca', 'stock_minimo', 'estado', 'imagen_url'] <> '{}'::jsonb then
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
commit;
