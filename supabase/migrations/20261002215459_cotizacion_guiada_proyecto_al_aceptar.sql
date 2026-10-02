-- A quote precedes the project. Existing historical projects and requests are preserved.
alter table public.proyecto_cotizaciones alter column proyecto_id drop not null;
alter table public.proyecto_cotizaciones add column eliminada_en timestamptz;
create or replace function proyecto_cotizaciones_privado.operar(p_accion text,p_id uuid,p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.proyecto_cotizaciones; oldstate text; actor uuid:=auth.uid(); role_name text; b jsonb; totals jsonb; proj public.proyectos;
 newid uuid; reqid uuid; x jsonb; mat public.materiales; canonical jsonb:='[]'; items jsonb:='[]'; allocated numeric; amount numeric; expense public.proyecto_gastos; target text;
begin
 select rol::text into role_name from public.perfiles where id=actor and estado::text='ACTIVO';
 if actor is null or role_name not in ('analista','coordinador') or role_name is null then raise exception 'No tienes permiso para modificar cotizaciones'; end if;
 if p_id is null or p_datos is null then raise exception 'Solicitud inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 if p_accion='periodo' then
  if role_name<>'coordinador' then raise exception 'Solo coordinación configura Gastos Generales JMP'; end if;
  if extract(day from (p_datos->>'periodo')::date)<>1 or nullif(p_datos->>'periodo','') is null then raise exception 'Selecciona un período mensual'; end if;
  amount:=proyecto_cotizaciones_privado.numero(p_datos->'gastosGeneralesJmp');
  if jsonb_typeof(coalesce(p_datos->'controlBonos','{}'))<>'object' then raise exception 'Control de bonos inválido'; end if;
  for x in select value from jsonb_each(coalesce(p_datos->'controlBonos','{}')) loop
   if coalesce(x->>'control','') not in ('>','>=') then raise exception 'Control del bono inválido'; end if;
   allocated:=proyecto_cotizaciones_privado.numero(x->'cant',0,1000000); if allocated<>trunc(allocated) then raise exception 'Cant de los controles de bonos debe ser entero'; end if;
  end loop;
  insert into public.cotizacion_periodos(periodo,gastos_generales_jmp,control_bonos,actualizado_por) values((p_datos->>'periodo')::date,amount,coalesce(p_datos->'controlBonos','{}'),actor)
  on conflict(periodo) do update set gastos_generales_jmp=excluded.gastos_generales_jmp,control_bonos=excluded.control_bonos,actualizado_por=actor,updated_at=now();
  return p_id;
 end if;
 if p_accion='plantilla' then
  if role_name<>'coordinador' then raise exception 'Solo el coordinador administra tarifas'; end if;
  b:=p_datos->'presupuesto'; perform proyecto_cotizaciones_privado.calcular(b);
  if nullif(btrim(p_datos->>'nombre'),'') is null then raise exception 'Indica el nombre de la plantilla'; end if;
  if exists(select 1 from public.cotizacion_plantillas where id=p_id and updated_at is distinct from (p_datos->>'actualizadaEn')::timestamptz) then raise exception 'La plantilla cambió. Actualiza la vista'; end if;
  insert into public.cotizacion_plantillas(id,nombre,modalidad,ciudad,tipo,puntos,tasas,gastos,parametros,actualizado_por)
  values(p_id,btrim(p_datos->>'nombre'),b->>'modalidad',b->>'ciudad',b->>'tipo',(b->>'puntos')::integer,b->'tasas',b->'gastos',jsonb_build_object('excel',b->'excel','fise',b->'fise'),actor)
  on conflict(id) do update set nombre=excluded.nombre,modalidad=excluded.modalidad,ciudad=excluded.ciudad,tipo=excluded.tipo,puntos=excluded.puntos,tasas=excluded.tasas,gastos=excluded.gastos,parametros=excluded.parametros,actualizado_por=actor,updated_at=now();
  return p_id;
 end if;
 select * into q from public.proyecto_cotizaciones where id=p_id;
 if q.id is not null then
  perform pg_advisory_xact_lock(hashtextextended(q.serie_id::text,2));
  select * into q from public.proyecto_cotizaciones where id=p_id for update;
  if q.eliminada_en is not null then raise exception 'Cotización eliminada'; end if;
  if q.creado_por<>actor and role_name<>'coordinador' then raise exception 'La cotización pertenece a otro usuario'; end if;
  if p_accion='requerimiento' and exists(select 1 from public.cotizacion_asignaciones where cotizacion_id=q.id and requerimiento_id=(p_datos->>'requerimientoId')::uuid) then return (p_datos->>'requerimientoId')::uuid; end if;
  if p_accion='gasto' and exists(select 1 from public.proyecto_gastos where id=(p_datos->>'gastoId')::uuid and cotizacion_id=q.id) then return (p_datos->>'gastoId')::uuid; end if;
  if p_accion='version' and exists(select 1 from public.proyecto_cotizaciones where id=(p_datos->>'nuevoId')::uuid and serie_id=q.serie_id and creado_por=actor) then return (p_datos->>'nuevoId')::uuid; end if;
  if (p_datos->>'revision')::integer is distinct from q.revision then raise exception 'La cotización cambió. Actualiza la vista antes de continuar'; end if;
 end if;
 oldstate:=q.estado;
 if p_accion='guardar' then
  if role_name<>'analista' or (q.id is not null and (q.creado_por<>actor or q.estado not in ('BORRADOR','OBSERVADA'))) then raise exception 'Solo el analista autor puede editar borradores'; end if;
  b:=p_datos->'presupuesto'; totals:=proyecto_cotizaciones_privado.calcular(b);
  if q.id is null and nullif(p_datos->>'proyectoId','') is not null then
   select * into proj from public.proyectos where id=(p_datos->>'proyectoId')::uuid and activo;
   if proj.id is null then raise exception 'Proyecto no disponible'; end if;
   if not exists(select 1 from public.proyecto_cotizaciones where proyecto_id=proj.id and creado_por=actor and estado in ('ACEPTADA','CERRADA')) then raise exception 'Cotiza un proyecto nuevo o crea una versión de su cotización aceptada'; end if;
  end if;
  if q.id is null or q.proyecto_id is null then
   if jsonb_typeof(p_datos->'proyecto') is distinct from 'object' then raise exception 'Completa los datos del proyecto'; end if;
   for x in select to_jsonb(k) from unnest(array['nombre','cliente','ubicacion','responsable']) k loop
    if nullif(btrim(p_datos->'proyecto'->>(x#>>'{}')),'') is null or length(p_datos->'proyecto'->>(x#>>'{}'))>3000 then raise exception 'Completa nombre, cliente, ubicación y responsable del proyecto'; end if;
   end loop;
  end if;
  for x in select value from jsonb_array_elements(b->'materiales') loop
   select * into mat from public.materiales where sku=x->>'sku' and activo;
   if mat.sku is null then raise exception 'Material no disponible: %',x->>'sku'; end if;
   if x->>'unidadCotizada'=mat.unidad and (x->>'factorStock')::numeric<>1 then raise exception 'Para la unidad del catálogo usa factor 1'; end if;
   canonical:=canonical||jsonb_build_array(x||jsonb_build_object('nombre',mat.nombre,'unidadCatalogo',mat.unidad));
  end loop;
  b:=jsonb_set(b,'{materiales}',canonical);
  if q.id is null then
   insert into public.proyecto_cotizaciones(id,proyecto_id,serie_id,version,creado_por,presupuesto,totales,proyecto_snapshot)
   values(p_id,proj.id,p_id,1,actor,b,totals,case when proj.id is null then p_datos->'proyecto' else jsonb_build_object('nombre',proj.nombre,'cliente',proj.cliente,'ubicacion',proj.ubicacion,'responsable',proj.responsable) end);
  else update public.proyecto_cotizaciones set presupuesto=b,totales=totals,proyecto_snapshot=case when proyecto_id is null then p_datos->'proyecto' else proyecto_snapshot end,revision=revision+1,updated_at=now() where id=q.id; end if;
 elsif q.id is null then raise exception 'Cotización no encontrada';
 elsif p_accion='eliminar' then
  if role_name<>'analista' or q.creado_por<>actor or q.estado<>'RECHAZADA' then raise exception 'Solo puedes eliminar cotizaciones que el cliente no aceptó'; end if;
  if exists(select 1 from public.proyecto_cotizaciones where serie_id=q.serie_id and (importe_aceptado is not null or estado in ('ACEPTADA','CERRADA','SUPERADA'))) then raise exception 'Una cotización aceptada no se puede eliminar'; end if;
  update public.proyecto_cotizaciones set eliminada_en=now(),revision=revision+1,updated_at=now() where id=q.id;
 elsif p_accion='version' then
  if role_name<>'analista' or q.creado_por<>actor then raise exception 'Solo el autor puede crear versiones'; end if;
  if exists(select 1 from public.proyecto_cotizaciones where serie_id=q.serie_id and estado='CERRADA') then raise exception 'El proyecto cotizado ya está cerrado'; end if;
  newid:=(p_datos->>'nuevoId')::uuid;
  insert into public.proyecto_cotizaciones(id,proyecto_id,serie_id,version,creado_por,presupuesto,totales,proyecto_snapshot)
  select newid,q.proyecto_id,q.serie_id,max(version)+1,actor,q.presupuesto,q.totales,q.proyecto_snapshot from public.proyecto_cotizaciones where serie_id=q.serie_id;
  insert into public.cotizacion_eventos(cotizacion_id,accion,estado_nuevo,usuario_id,detalle) values(newid,'version','BORRADOR',actor,'Nueva versión de '||q.codigo);
  update public.proyecto_cotizaciones set revision=revision+1,updated_at=now() where id=q.id;
  insert into public.cotizacion_eventos(cotizacion_id,accion,estado_anterior,estado_nuevo,usuario_id,detalle) values(q.id,'version',q.estado,q.estado,actor,'Creada nueva versión '||newid);
  return newid;
 elsif p_accion='estado' then
  target:=p_datos->>'estado';
  if role_name='analista' and q.creado_por=actor and (
   (q.estado in ('BORRADOR','OBSERVADA','EN_REVISION','APROBADA') and target in ('PRESENTADA','RECHAZADA'))
   or (q.estado='PRESENTADA' and target in ('ACEPTADA','RECHAZADA','VENCIDA'))
  ) then null;
  else raise exception 'Solo el analista autor presenta la cotización y registra la decisión del cliente'; end if;
  if target in ('OBSERVADA','RECHAZADA','ANULADA') and nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Explica el motivo'; end if;
  if target in ('EN_REVISION','PRESENTADA','ACEPTADA') and (q.presupuesto->>'vigencia')::date<(now() at time zone 'America/Lima')::date then raise exception 'La vigencia terminó. Crea una nueva versión'; end if;
  if target='VENCIDA' and (q.presupuesto->>'vigencia')::date>=(now() at time zone 'America/Lima')::date then raise exception 'La cotización todavía está vigente'; end if;
  if target='PRESENTADA' and (q.totales->>'total')::numeric<=0 then raise exception 'El total debe ser positivo'; end if;
  if target in ('PRESENTADA','ACEPTADA') then amount:=round(proyecto_cotizaciones_privado.numero(p_datos->'importe',0.01),2); end if;
  if target='ACEPTADA' then
   if nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Registra la evidencia de aceptación del cliente'; end if;
   if q.proyecto_id is null then
    select z.proyecto_id into newid from public.proyecto_cotizaciones z where z.serie_id=q.serie_id and z.proyecto_id is not null limit 1;
    if newid is null then
     newid:=gen_random_uuid();
     insert into public.proyectos(id,nombre,cliente,ubicacion,responsable,sede)
     values(newid,q.proyecto_snapshot->>'nombre',q.proyecto_snapshot->>'cliente',q.proyecto_snapshot->>'ubicacion',q.proyecto_snapshot->>'responsable',q.presupuesto->>'sede');
    end if;
    update public.proyecto_cotizaciones set proyecto_id=newid where serie_id=q.serie_id;
   end if;
   if exists(select 1 from public.proyecto_cotizaciones where serie_id=q.serie_id and estado='CERRADA') then raise exception 'La serie ya está cerrada'; end if;
   if exists(select 1 from public.proyecto_cotizaciones z where z.serie_id=q.serie_id and z.estado='ACEPTADA' and z.presupuesto->>'moneda'<>q.presupuesto->>'moneda') then raise exception 'No se puede cambiar la moneda de una ejecución iniciada'; end if;
   for x in select jsonb_build_object('item_id',a.item_id,'cantidad',sum(a.cantidad),'sku',min(a.material_sku)) from public.cotizacion_asignaciones a join public.proyecto_cotizaciones z on z.id=a.cotizacion_id join public.requerimientos r on r.id=a.requerimiento_id where z.serie_id=q.serie_id and r.estado::text<>'RECHAZADO' group by a.item_id loop
    if not exists(select 1 from jsonb_array_elements(q.presupuesto->'materiales') m where m->>'id'=x->>'item_id' and m->>'sku'=x->>'sku' and (m->>'cantidad')::numeric*(m->>'factorStock')::numeric>=(x->>'cantidad')::numeric) then raise exception 'La nueva versión reduce o elimina materiales ya solicitados'; end if;
   end loop;
   insert into public.cotizacion_eventos(cotizacion_id,accion,estado_anterior,estado_nuevo,usuario_id,detalle) select id,'sustitucion','ACEPTADA','SUPERADA',actor,'Sustituida por '||q.codigo from public.proyecto_cotizaciones where serie_id=q.serie_id and estado='ACEPTADA';
   update public.proyecto_cotizaciones set estado='SUPERADA',revision=revision+1,updated_at=now() where serie_id=q.serie_id and estado='ACEPTADA';
   update public.proyecto_cotizaciones set fecha_habilitacion=(select max(fecha_habilitacion) from public.proyecto_cotizaciones where serie_id=q.serie_id) where id=q.id;
  end if;
  update public.proyecto_cotizaciones set estado=target,revision=revision+1,updated_at=now(),observaciones=nullif(btrim(p_datos->>'detalle'),''),
   importe_presentado=case when target='PRESENTADA' then amount else importe_presentado end,
   importe_aceptado=case when target='ACEPTADA' then amount else importe_aceptado end,
   evidencia=case when target='ACEPTADA' then p_datos->>'detalle' else evidencia end where id=q.id;
 elsif p_accion='requerimiento' then
  if role_name<>'analista' or q.creado_por<>actor or q.estado<>'ACEPTADA' then raise exception 'Solo el autor de una cotización aceptada puede generar solicitudes'; end if;
  reqid:=(p_datos->>'requerimientoId')::uuid;
  if reqid is null or exists(select 1 from public.requerimientos where id=reqid) then raise exception 'Identificador de requerimiento inválido'; end if;
  if jsonb_typeof(p_datos->'items') is distinct from 'array' or jsonb_array_length(p_datos->'items')=0 then raise exception 'Selecciona materiales pendientes'; end if;
  if exists(select 1 from jsonb_array_elements(p_datos->'items') z group by z->>'itemId' having count(*)>1) then raise exception 'Partidas repetidas'; end if;
  for x in select value from jsonb_array_elements(p_datos->'items') loop
   select value into b from jsonb_array_elements(q.presupuesto->'materiales') where value->>'id'=x->>'itemId';
   if b is null then raise exception 'Material fuera del presupuesto'; end if;
   amount:=proyecto_cotizaciones_privado.numero(x->'cantidad',0.000001);
   select coalesce(sum(a.cantidad),0) into allocated from public.cotizacion_asignaciones a join public.proyecto_cotizaciones z on z.id=a.cotizacion_id join public.requerimientos r on r.id=a.requerimiento_id where z.serie_id=q.serie_id and a.item_id=(b->>'id')::uuid and r.estado::text<>'RECHAZADO';
   if allocated+amount>(b->>'cantidad')::numeric*(b->>'factorStock')::numeric then raise exception 'La cantidad excede el saldo del presupuesto'; end if;
   items:=items||jsonb_build_array(jsonb_build_object('skuId',b->>'sku','cantidad',amount));
  end loop;
  perform public.crear_requerimiento(reqid,jsonb_build_object('proyecto_id',q.proyecto_id,'sede',q.presupuesto->>'sede','ubicacion',q.proyecto_snapshot->>'ubicacion','descripcion',q.codigo||' v'||q.version||': '||(q.presupuesto->>'alcance'),'tecnico',q.presupuesto->>'tecnico'),items,true);
  for x in select value from jsonb_array_elements(p_datos->'items') loop
   select value into b from jsonb_array_elements(q.presupuesto->'materiales') where value->>'id'=x->>'itemId';
   insert into public.cotizacion_asignaciones(cotizacion_id,item_id,requerimiento_id,material_sku,cantidad) values(q.id,(x->>'itemId')::uuid,reqid,b->>'sku',(x->>'cantidad')::numeric);
  end loop;
  perform public.enviar_requerimiento(reqid);
  update public.proyecto_cotizaciones set revision=revision+1,updated_at=now() where id=q.id;
 elsif p_accion='gasto' then
  if q.estado<>'ACEPTADA' then raise exception 'Los gastos se registran en la versión aceptada'; end if;
  if coalesce(p_datos->>'rubro','') not in ('MATERIALES','MANO_OBRA','HABILITACION','MURETES','FIJOS','VARIABLES','FLETE','MOVILIDAD','SUPERVISION','VIATICOS','HOSPEDAJE','ALIMENTACION','PASAJES','COMBUSTIBLE','PEAJES','ANCLAJE','ALTURA','IG3','DOCUMENTACION','PAQUETE','FINANCIAMIENTO','GENERALES','COMISION','BONO','ADICIONALES') or nullif(btrim(p_datos->>'descripcion'),'') is null or nullif(btrim(p_datos->>'comprobante'),'') is null then raise exception 'Completa rubro, descripción y comprobante'; end if;
  if coalesce(p_datos->>'naturaleza','COSTO') not in ('COSTO','ABONO') then raise exception 'Tipo de costo inválido'; end if;
  if (p_datos->>'fecha')::date>(now() at time zone 'America/Lima')::date or nullif(p_datos->>'fecha','') is null then raise exception 'Fecha de gasto inválida'; end if;
  amount:=round(proyecto_cotizaciones_privado.numero(p_datos->'monto',0.01),2);
  if p_datos->>'rubro'='BONO' and coalesce(p_datos->>'naturaleza','COSTO')='COSTO' and (q.presupuesto->'excel'->>'bonoCondicionado')::boolean then
   if q.fecha_habilitacion is null then raise exception 'El Bono Administrativo se asigna posterior a la habilitacion'; end if;
   select coalesce(sum((part->>'cantidad')::numeric*(part->>'costoUnitario')::numeric),0) into allocated from jsonb_array_elements(q.presupuesto->'gastos') part where part->>'rubro'='BONO';
   select coalesce(sum(case when g.naturaleza='ABONO' then -g.monto else g.monto end),0) into amount from public.proyecto_gastos g join public.proyecto_cotizaciones z on z.id=g.cotizacion_id where z.serie_id=q.serie_id and g.estado='REGISTRADO' and g.rubro<>'BONO';
   allocated:=greatest(0,allocated-greatest(0,amount-((q.totales->>'costoDirecto')::numeric+(q.totales->>'financiamiento')::numeric+(q.totales->>'generales')::numeric+(q.totales->>'comision')::numeric-allocated)));
   select allocated-coalesce(sum(case when g.naturaleza='ABONO' then -g.monto else g.monto end),0) into allocated from public.proyecto_gastos g join public.proyecto_cotizaciones z on z.id=g.cotizacion_id where z.serie_id=q.serie_id and g.estado='REGISTRADO' and g.rubro='BONO';
   amount:=round(proyecto_cotizaciones_privado.numero(p_datos->'monto',0.01),2);
   if amount>allocated then raise exception 'El Bono Administrativo excede el saldo disponible después de la desviacion'; end if;
  end if;
  if p_datos->>'rubro'='MATERIALES' then
   perform proyecto_cotizaciones_privado.numero(p_datos->'cantidad',0.000001);
   if not exists(select 1 from jsonb_array_elements(q.presupuesto->'materiales') m where m->>'sku'=p_datos->>'material_sku') then raise exception 'Selecciona un material del presupuesto'; end if;
  end if;
  insert into public.proyecto_gastos(id,cotizacion_id,rubro,naturaleza,descripcion,monto,fecha,comprobante,material_sku,cantidad,creado_por)
  values((p_datos->>'gastoId')::uuid,q.id,p_datos->>'rubro',coalesce(p_datos->>'naturaleza','COSTO'),btrim(p_datos->>'descripcion'),amount,(p_datos->>'fecha')::date,btrim(p_datos->>'comprobante'),case when p_datos->>'rubro'='MATERIALES' then p_datos->>'material_sku' end,case when p_datos->>'rubro'='MATERIALES' then (p_datos->>'cantidad')::numeric end,actor);
  update public.proyecto_cotizaciones set revision=revision+1,updated_at=now() where id=q.id;
 elsif p_accion='anular_gasto' then
  select g.* into expense from public.proyecto_gastos g join public.proyecto_cotizaciones z on z.id=g.cotizacion_id where g.id=(p_datos->>'gastoId')::uuid and z.serie_id=q.serie_id for update of g;
  if q.estado<>'ACEPTADA' or expense.id is null or expense.estado<>'REGISTRADO' or (expense.creado_por<>actor and role_name<>'coordinador') then raise exception 'No se puede anular este gasto'; end if;
  if nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Explica el motivo de anulación'; end if;
  update public.proyecto_gastos set estado='ANULADO',motivo_anulacion=p_datos->>'detalle' where id=expense.id;
  update public.proyecto_cotizaciones set revision=revision+1,updated_at=now() where id=q.id;
 elsif p_accion='habilitar' then
  if q.estado<>'ACEPTADA' then raise exception 'La habilitación requiere una cotización aceptada'; end if;
  if nullif(p_datos->>'fechaHabilitacion','') is null or (p_datos->>'fechaHabilitacion')::date>(now() at time zone 'America/Lima')::date then raise exception 'Registra la fecha de habilitación'; end if;
  update public.proyecto_cotizaciones set fecha_habilitacion=(p_datos->>'fechaHabilitacion')::date,revision=revision+1,updated_at=now() where id=q.id;
 elsif p_accion='cerrar' then
  if role_name<>'coordinador' or q.estado<>'ACEPTADA' or nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'El coordinador debe registrar la conciliación para cerrar'; end if;
  if not exists(select 1 from public.proyecto_gastos g join public.proyecto_cotizaciones z on z.id=g.cotizacion_id where z.serie_id=q.serie_id and g.estado='REGISTRADO') then raise exception 'Registra costos reales antes del cierre'; end if;
  if exists(select 1 from public.cotizacion_asignaciones a join public.proyecto_cotizaciones z on z.id=a.cotizacion_id join public.requerimientos r on r.id=a.requerimiento_id where z.serie_id=q.serie_id and (r.estado::text in ('BORRADOR','ENVIADO') or (r.estado::text='CONFIRMADO' and not exists(select 1 from public.entregas e where e.requerimiento_id=r.id and e.estado::text='COMPLETA')))) then raise exception 'Hay solicitudes o entregas pendientes'; end if;
  if exists(select 1 from public.devoluciones_materiales d where d.estado::text<>'VALIDADA' and d.requerimiento_id in (select a.requerimiento_id from public.cotizacion_asignaciones a join public.proyecto_cotizaciones z on z.id=a.cotizacion_id where z.serie_id=q.serie_id)) then raise exception 'Hay devoluciones pendientes de validación'; end if;
  if nullif(p_datos->>'fechaHabilitacion','') is null or (p_datos->>'fechaHabilitacion')::date>(now() at time zone 'America/Lima')::date then raise exception 'Registra la fecha de habilitación'; end if;
  update public.proyecto_cotizaciones set estado='CERRADA',cierre=p_datos->>'detalle',fecha_habilitacion=(p_datos->>'fechaHabilitacion')::date,revision=revision+1,updated_at=now() where id=q.id;
 else raise exception 'Acción desconocida'; end if;
 select * into q from public.proyecto_cotizaciones where id=p_id;
 insert into public.cotizacion_eventos(cotizacion_id,accion,estado_anterior,estado_nuevo,usuario_id,detalle) values(q.id,p_accion,oldstate,q.estado,actor,coalesce(p_datos->>'detalle',case when p_accion='requerimiento' then 'Solicitud '||reqid::text when p_accion='gasto' then 'Comprobante '||(p_datos->>'comprobante') else '' end));
 return case when p_accion='requerimiento' then reqid when p_accion='gasto' then (p_datos->>'gastoId')::uuid else p_id end;
end $$;

-- Deferred checks allow the transactional quotation operation to create allocations
-- before commit, while rejecting direct project/request creation from other paths.
create function proyecto_cotizaciones_privado.verificar_origen() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='proyectos' then
  if not exists(select 1 from public.proyecto_cotizaciones q where q.proyecto_id=new.id and q.estado in ('ACEPTADA','CERRADA')) then
   raise exception 'Crea una cotización y registra la aceptación del cliente para crear el proyecto';
  end if;
 else
  if not exists(select 1 from public.cotizacion_asignaciones a join public.proyecto_cotizaciones q on q.id=a.cotizacion_id where a.requerimiento_id=new.id and q.proyecto_id=new.proyecto_id and q.estado='ACEPTADA') then
   raise exception 'Selecciona materiales desde la cotización aceptada del proyecto';
  end if;
 end if;
 return new;
end $$;
revoke all on function proyecto_cotizaciones_privado.verificar_origen() from public,anon,authenticated;
create constraint trigger proyecto_desde_cotizacion after insert on public.proyectos deferrable initially deferred for each row execute function proyecto_cotizaciones_privado.verificar_origen();
create constraint trigger requerimiento_desde_cotizacion after insert on public.requerimientos deferrable initially deferred for each row execute function proyecto_cotizaciones_privado.verificar_origen();
revoke insert on public.proyectos from authenticated,anon;
