create or replace function public.obtener_saldos_devolucion(p_proyecto_id uuid)
returns table (
  requerimiento_id uuid,
  requerimiento_codigo text,
  material_sku text,
  material_nombre text,
  unidad text,
  cantidad_disponible numeric
)
language sql security definer set search_path = public
as $$
  with entregado as (
    select e.requerimiento_id, ei.material_sku, sum(ei.cantidad_entregada) as cantidad
    from public.entregas e join public.entrega_items ei on ei.entrega_id = e.id
    where e.estado in ('PARCIAL', 'COMPLETA') group by e.requerimiento_id, ei.material_sku
  ), devuelto as (
    select d.requerimiento_id, di.material_sku, sum(di.cantidad) as cantidad
    from public.devoluciones_materiales d join public.devolucion_items di on di.devolucion_id = d.id
    where d.estado in ('PENDIENTE_VALIDACION', 'VALIDADA') group by d.requerimiento_id, di.material_sku
  )
  select r.id, r.codigo, ri.material_sku, ri.material_nombre, ri.unidad,
    greatest(coalesce(en.cantidad, 0) - coalesce(de.cantidad, 0), 0)
  from public.requerimientos r join public.requerimiento_items ri on ri.requerimiento_id = r.id
  left join entregado en on en.requerimiento_id = r.id and en.material_sku = ri.material_sku
  left join devuelto de on de.requerimiento_id = r.id and de.material_sku = ri.material_sku
  where r.proyecto_id = p_proyecto_id and r.estado = 'CONFIRMADO'
    and (r.analista_id = auth.uid() or public.rol_actual() in ('coordinador', 'gerente'));
$$;

revoke all on function public.obtener_saldos_devolucion(uuid) from public, anon;
grant execute on function public.obtener_saldos_devolucion(uuid) to authenticated;
