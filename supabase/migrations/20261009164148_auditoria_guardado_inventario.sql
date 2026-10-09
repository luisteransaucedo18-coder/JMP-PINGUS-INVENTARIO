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
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador'::public.rol_usuario
    or not exists(select 1 from public.perfiles where id=auth.uid() and estado='ACTIVO') then
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


  if p_stock_sedes is not null and exists (
    select 1 from jsonb_each_text(p_stock_sedes) as stock(sede,cantidad)
    where cantidad::numeric >= 100000000000 or cantidad::numeric <> round(cantidad::numeric,3)
  ) then raise exception using errcode='22023', message='El stock debe tener hasta tres decimales y estar dentro del límite del inventario'; end if;


  if (p_material->>'stock_minimo')::numeric < 0 or (p_material->>'stock_minimo')::numeric >= 100000000000 then raise exception using errcode='22023', message='El mínimo está fuera del límite del inventario'; end if;
  if (p_material->>'metros_por_rollo')::numeric is distinct from round((p_material->>'metros_por_rollo')::numeric,3)
     or (p_material->>'stock_minimo')::numeric is distinct from round((p_material->>'stock_minimo')::numeric,3)
  then raise exception using errcode='22023', message='La longitud y el mínimo deben tener hasta tres decimales'; end if;

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
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador'::public.rol_usuario
    or not exists(select 1 from public.perfiles where id=auth.uid() and estado='ACTIVO') then
    raise exception using errcode = '42501', message = 'Solo un coordinador puede actualizar materiales';
  end if;

  if jsonb_typeof(p_campos) is distinct from 'object'
    or p_campos - array['nombre', 'descripcion', 'categoria_id', 'unidad', 'marca', 'stock_minimo', 'estado', 'imagen_url', 'metros_por_rollo', 'inventario_esperado'] <> '{}'::jsonb then
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


  if p_stock_sedes is not null and exists (
    select 1 from jsonb_each_text(p_stock_sedes) as stock(sede,cantidad)
    where cantidad::numeric >= 100000000000 or cantidad::numeric <> round(cantidad::numeric,3)
  ) then raise exception using errcode='22023', message='El stock debe tener hasta tres decimales y estar dentro del límite del inventario'; end if;

  select * into v_material from public.materiales where sku=p_sku for update;
  if not found then raise exception using errcode='P0002', message='No existe el material solicitado'; end if;
  if p_stock_sedes is not null then
    if jsonb_typeof(p_campos->'inventario_esperado') is distinct from 'object' then
      raise exception using errcode='22023', message='Actualiza el inventario antes de editar el stock';
    end if;
    perform 1 from public.inventario_sedes where material_sku=p_sku order by sede for update;
    if (p_campos->'inventario_esperado'->>'unidad') is distinct from v_material.unidad
      or (p_campos->'inventario_esperado'->>'metros_por_rollo')::numeric is distinct from v_material.metros_por_rollo
      or (p_campos->'inventario_esperado'->>'stock_minimo')::numeric is distinct from v_material.stock_minimo
      or (select jsonb_object_agg(s.nombre,coalesce(i.stock,0)) from public.sedes s
          left join public.inventario_sedes i on i.sede=s.nombre and i.material_sku=p_sku
          where s.nombre in ('Chiclayo','Chimbote','Trujillo'))
         is distinct from p_campos->'inventario_esperado'->'stock_sedes'
    then raise exception using errcode='40001', message='El stock o la unidad cambiaron desde que abriste la edición. Actualiza la vista antes de guardar'; end if;
  end if;


  if (p_campos->>'stock_minimo')::numeric < 0 or (p_campos->>'stock_minimo')::numeric >= 100000000000 then raise exception using errcode='22023', message='El mínimo está fuera del límite del inventario'; end if;
  if (p_campos->>'metros_por_rollo')::numeric is distinct from round((p_campos->>'metros_por_rollo')::numeric,3)
     or (p_campos->>'stock_minimo')::numeric is distinct from round((p_campos->>'stock_minimo')::numeric,3)
  then raise exception using errcode='22023', message='La longitud y el mínimo deben tener hasta tres decimales'; end if;

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


-- Internal trigger helpers must not be callable through the Data API.
revoke execute on function public.recalcular_estado_material(text) from public,anon,authenticated;
revoke execute on function public.actualizar_estado_por_stock() from public,anon,authenticated;
revoke execute on function public.actualizar_estado_por_minimo() from public,anon,authenticated;
-- Existing files remain intact; new evidence must be a supported photo.
update storage.buckets set file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='evidencias-devoluciones';
notify pgrst, 'reload schema';
commit;
