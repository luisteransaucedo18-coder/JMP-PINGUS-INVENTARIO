begin;

-- Una orden rechazada conserva el vínculo histórico, pero no debe impedir que el
-- requerimiento genere una nueva compra si aún existe el faltante.
drop index if exists public.orden_compra_requerimiento_unica;
create unique index orden_compra_requerimiento_unica
  on public.ordenes_compra(requerimiento_id)
  where requerimiento_id is not null and estado <> 'RECHAZADO';

create or replace function public.revisar_orden_compra(
  p_id uuid,
  p_aprobar boolean,
  p_observaciones text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_orden public.ordenes_compra%rowtype;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'coordinador' then
    raise exception 'Solo un coordinador puede revisar órdenes';
  end if;
  if not p_aprobar and nullif(btrim(p_observaciones), '') is null then
    raise exception 'Indica el motivo del rechazo';
  end if;

  select * into v_orden
  from public.ordenes_compra
  where id = p_id
  for update;

  if not found then raise exception 'La orden no existe'; end if;
  if p_aprobar and v_orden.estado <> 'ENVIADO' then
    raise exception 'Solo se pueden aprobar órdenes pendientes';
  end if;
  if not p_aprobar and v_orden.estado not in ('ENVIADO', 'APROBADO') then
    raise exception 'La orden ya fue rechazada, comprada o no puede modificarse';
  end if;

  update public.ordenes_compra
  set estado = case
        when p_aprobar then 'APROBADO'::public.estado_compra
        else 'RECHAZADO'::public.estado_compra
      end,
      coordinador_id = auth.uid(),
      observaciones = nullif(btrim(p_observaciones), ''),
      fecha_aprobacion = case when p_aprobar then current_date else null end,
      updated_at = now()
  where id = p_id;

  if not p_aprobar and v_orden.requerimiento_id is not null then
    update public.requerimiento_abastecimiento
    set estado = 'PENDIENTE', tipo = null, origen_sugerido = null,
        observaciones = null, gestionado_por = null, gestionado_at = null,
        orden_compra_id = null, updated_at = now()
    where requerimiento_id = v_orden.requerimiento_id
      and orden_compra_id = p_id;
  end if;
end;
$$;

create or replace function public.cancelar_orden_compra(
  p_id uuid,
  p_motivo text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_orden public.ordenes_compra%rowtype;
begin
  if auth.uid() is null or public.rol_actual() is distinct from 'analista' then
    raise exception 'Solo el analista creador puede cancelar su orden';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Indica el motivo de la cancelación';
  end if;

  select * into v_orden
  from public.ordenes_compra
  where id = p_id
  for update;

  if not found then raise exception 'La orden no existe'; end if;
  if v_orden.analista_id <> auth.uid() then
    raise exception 'No puedes cancelar una orden de otro usuario';
  end if;
  if v_orden.estado not in ('BORRADOR', 'ENVIADO') then
    raise exception 'Solo puedes cancelar una orden antes de que sea aprobada';
  end if;

  update public.ordenes_compra
  set estado = 'RECHAZADO',
      observaciones = 'Cancelada por el solicitante: ' || btrim(p_motivo),
      updated_at = now()
  where id = p_id;

  if v_orden.requerimiento_id is not null then
    update public.requerimiento_abastecimiento
    set estado = 'PENDIENTE', tipo = null, origen_sugerido = null,
        observaciones = null, gestionado_por = null, gestionado_at = null,
        orden_compra_id = null, updated_at = now()
    where requerimiento_id = v_orden.requerimiento_id
      and orden_compra_id = p_id;
  end if;
end;
$$;

revoke all on function public.cancelar_orden_compra(uuid, text) from public, anon;
grant execute on function public.cancelar_orden_compra(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
