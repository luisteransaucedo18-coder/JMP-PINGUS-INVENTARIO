-- Corrections and logical deletion keep execution records and client evidence.
create function proyecto_cotizaciones_privado.operar_aceptada(p_accion text, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid();
 q public.proyecto_cotizaciones;
 b jsonb; totals jsonb; x jsonb; mat public.materiales;
 canonical jsonb := '[]'; amount numeric;
begin
 if actor is null or not exists(select 1 from public.perfiles where id=actor and rol::text='coordinador' and estado::text='ACTIVO') then
  raise exception 'Solo el coordinador puede corregir o eliminar cotizaciones aceptadas';
 end if;
 if p_id is null or p_datos is null or p_accion not in ('corregir_aceptada','eliminar_aceptada') then raise exception 'Solicitud inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into q from public.proyecto_cotizaciones where id=p_id;
 if q.id is null then raise exception 'Cotización no encontrada'; end if;
 perform pg_advisory_xact_lock(hashtextextended(q.serie_id::text,2));
 select * into q from public.proyecto_cotizaciones where id=p_id for update;
 if q.eliminada_en is not null then raise exception 'Cotización eliminada'; end if;
 if q.estado<>'ACEPTADA' then raise exception 'La operación requiere una cotización aceptada'; end if;
 if (p_datos->>'revision')::integer is distinct from q.revision then raise exception 'La cotización cambió. Actualiza la vista antes de continuar'; end if;
 if p_accion='eliminar_aceptada' then
  if (p_datos->>'nombreProyecto') is distinct from (q.proyecto_snapshot->>'nombre') then
   raise exception 'Ingresa el nombre exacto del proyecto para confirmar la eliminación';
  end if;
  update public.proyecto_cotizaciones set estado='ANULADA',eliminada_en=now(),revision=revision+1,updated_at=now() where id=q.id;
  insert into public.cotizacion_eventos(cotizacion_id,accion,estado_anterior,estado_nuevo,usuario_id,detalle)
  values(q.id,p_accion,'ACEPTADA','ANULADA',actor,'Eliminación confirmada con el nombre del proyecto: '||(q.proyecto_snapshot->>'nombre'));
 else
  if nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Indica el motivo de la corrección'; end if;
  b:=p_datos->'presupuesto'; totals:=proyecto_cotizaciones_privado.calcular(b);
  amount:=round(proyecto_cotizaciones_privado.numero(p_datos->'importe',0.01),2);
  if b->>'moneda' is distinct from q.presupuesto->>'moneda' then raise exception 'No se puede cambiar la moneda de una ejecución iniciada'; end if;
  for x in select value from jsonb_array_elements(b->'materiales') loop
   select * into mat from public.materiales where sku=x->>'sku' and activo;
   if mat.sku is null then raise exception 'Material no disponible: %',x->>'sku'; end if;
   if x->>'unidadCotizada'=mat.unidad and (x->>'factorStock')::numeric<>1 then raise exception 'Para la unidad del catálogo usa factor 1'; end if;
   canonical:=canonical||jsonb_build_array(x||jsonb_build_object('nombre',mat.nombre,'unidadCatalogo',mat.unidad));
  end loop;
  b:=jsonb_set(b,'{materiales}',canonical);
  for x in select jsonb_build_object('item_id',a.item_id,'cantidad',sum(a.cantidad),'sku',min(a.material_sku))
   from public.cotizacion_asignaciones a join public.proyecto_cotizaciones z on z.id=a.cotizacion_id
   join public.requerimientos r on r.id=a.requerimiento_id
   where z.serie_id=q.serie_id and r.estado::text<>'RECHAZADO' group by a.item_id loop
   if not exists(select 1 from jsonb_array_elements(b->'materiales') m where m->>'id'=x->>'item_id' and m->>'sku'=x->>'sku'
    and (m->>'cantidad')::numeric*(m->>'factorStock')::numeric>=(x->>'cantidad')::numeric) then
    raise exception 'La corrección reduce o elimina materiales ya solicitados';
   end if;
  end loop;
  update public.proyecto_cotizaciones set presupuesto=b,totales=totals,importe_aceptado=amount,revision=revision+1,updated_at=now() where id=q.id;
  insert into public.cotizacion_eventos(cotizacion_id,accion,estado_anterior,estado_nuevo,usuario_id,detalle)
  values(q.id,p_accion,'ACEPTADA','ACEPTADA',actor,btrim(p_datos->>'detalle')||' · Importe aceptado: '||q.importe_aceptado||' → '||amount
   ||' · Presupuesto anterior: '||q.presupuesto::text||' · Totales anteriores: '||q.totales::text);
 end if;
 return q.id;
end $$;
revoke all on function proyecto_cotizaciones_privado.operar_aceptada(text,uuid,jsonb) from public,anon;
grant execute on function proyecto_cotizaciones_privado.operar_aceptada(text,uuid,jsonb) to authenticated;

create or replace function public.operar_cotizacion_proyecto(p_accion text,p_id uuid,p_datos jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if p_accion in ('corregir_aceptada','eliminar_aceptada') then
  return proyecto_cotizaciones_privado.operar_aceptada(p_accion,p_id,p_datos);
 end if;
 return proyecto_cotizaciones_privado.operar(p_accion,p_id,p_datos);
end $$;
revoke all on function public.operar_cotizacion_proyecto(text,uuid,jsonb) from public,anon;
grant execute on function public.operar_cotizacion_proyecto(text,uuid,jsonb) to authenticated;
