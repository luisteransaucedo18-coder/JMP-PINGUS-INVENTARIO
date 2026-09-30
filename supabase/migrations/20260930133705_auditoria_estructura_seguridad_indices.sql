begin;

-- Endurecimiento no destructivo detectado por Supabase Advisors el 2026-09-30.
-- Las vistas siguen disponibles, pero pasan a respetar permisos/RLS del invocador.
alter view if exists public.v_inventario set (security_invoker = true);
alter view if exists public.v_compras set (security_invoker = true);

-- Evita ejecucion anonima de funciones SECURITY DEFINER expuestas por PostgREST.
-- Se conserva authenticated donde el frontend usa RPC o las politicas RLS dependen de helpers.
revoke all on function public.actualizar_estado_por_minimo() from public, anon;
revoke all on function public.actualizar_estado_por_stock() from public, anon;
revoke all on function public.confirmar_compra(uuid, text) from public, anon;
revoke all on function public.recalcular_estado_material(text) from public, anon;
revoke all on function public.rol_actual() from public, anon;
revoke all on function public.sede_actual() from public, anon;
revoke all on function public.validar_saldo_devolucion_item() from public, anon;

-- Reduce riesgo de hijacking por search_path mutable en trigger comun.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Indices para claves foraneas reportadas sin cobertura. Son no destructivos y ayudan
-- a joins, cascadas/checks de FK y filtros habituales por entidades relacionadas.
create index if not exists auditoria_usuario_id_idx on public.auditoria(usuario_id);
create index if not exists configuracion_sistema_updated_by_idx on public.configuracion_sistema(updated_by);
create index if not exists devolucion_evidencias_devolucion_id_idx on public.devolucion_evidencias(devolucion_id);
create index if not exists devolucion_historial_actor_id_idx on public.devolucion_historial(actor_id);
create index if not exists devolucion_historial_devolucion_id_idx on public.devolucion_historial(devolucion_id);
create index if not exists devoluciones_materiales_observado_por_idx on public.devoluciones_materiales(observado_por);
create index if not exists devoluciones_materiales_proyecto_id_idx on public.devoluciones_materiales(proyecto_id);
create index if not exists devoluciones_materiales_requerimiento_id_idx on public.devoluciones_materiales(requerimiento_id);
create index if not exists devoluciones_materiales_validado_por_idx on public.devoluciones_materiales(validado_por);
create index if not exists entrega_items_material_sku_idx on public.entrega_items(material_sku);
create index if not exists entregas_responsable_entrega_id_idx on public.entregas(responsable_entrega_id);
create index if not exists movimientos_inventario_creado_por_idx on public.movimientos_inventario(creado_por);
create index if not exists movimientos_inventario_sede_contraparte_idx on public.movimientos_inventario(sede_contraparte);
create index if not exists movimientos_inventario_sede_idx on public.movimientos_inventario(sede);
create index if not exists orden_compra_items_material_sku_idx on public.orden_compra_items(material_sku);
create index if not exists ordenes_compra_coordinador_id_idx on public.ordenes_compra(coordinador_id);
create index if not exists ordenes_compra_sede_idx on public.ordenes_compra(sede);
create index if not exists proyectos_creado_por_idx on public.proyectos(creado_por);
create index if not exists requerimiento_abastecimiento_gestionado_por_idx on public.requerimiento_abastecimiento(gestionado_por);
create index if not exists requerimiento_abastecimiento_orden_compra_id_idx on public.requerimiento_abastecimiento(orden_compra_id);
create index if not exists requerimiento_abastecimiento_origen_sugerido_idx on public.requerimiento_abastecimiento(origen_sugerido);
create index if not exists requerimiento_items_material_sku_idx on public.requerimiento_items(material_sku);
create index if not exists requerimientos_confirmado_por_idx on public.requerimientos(confirmado_por);
create index if not exists requerimientos_sede_idx on public.requerimientos(sede);
create index if not exists traslado_archivos_creado_por_idx on public.traslado_archivos(creado_por);
create index if not exists traslado_historial_usuario_id_idx on public.traslado_historial(usuario_id);
create index if not exists traslado_incidencias_creado_por_idx on public.traslado_incidencias(creado_por);
create index if not exists traslado_incidencias_resuelto_por_idx on public.traslado_incidencias(resuelto_por);
create index if not exists traslado_items_material_sku_idx on public.traslado_items(material_sku);
create index if not exists traslados_creado_por_idx on public.traslados(creado_por);

notify pgrst, 'reload schema';

commit;
