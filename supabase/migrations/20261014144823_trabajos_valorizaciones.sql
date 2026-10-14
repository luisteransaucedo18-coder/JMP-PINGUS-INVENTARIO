begin;
create schema if not exists valorizaciones_privado;
revoke all on schema valorizaciones_privado from public,anon;
grant usage on schema valorizaciones_privado to authenticated;
create function valorizaciones_privado.rol() returns text language sql stable security invoker set search_path='' as $$
 select rol::text from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'
$$;
create sequence public.valorizacion_codigo_seq;
create table public.trabajo_valorizaciones (
 id uuid primary key default gen_random_uuid(), codigo text not null unique default ('VAL-'||lpad(nextval('public.valorizacion_codigo_seq')::text,6,'0')),
 cotizacion_id uuid not null references public.proyecto_cotizaciones(id), serie_id uuid not null, proyecto_id uuid not null references public.proyectos(id),
 analista_id uuid not null references public.perfiles(id), tecnico text not null, dni text not null,
 etapa text not null check(etapa in ('INTERNA','HABILITACION')), tipo text not null check(tipo in ('FINAL','ADELANTO')),
 estado text not null default 'BORRADOR' check(estado in ('BORRADOR','EN_TESORERIA','OBSERVADA','RETENIDA','EN_GERENCIA','AUTORIZADA','PAGADA')),
 monto numeric(16,2) not null check(monto>0), adelantos numeric(16,2) not null default 0 check(adelantos>=0),
 descuentos jsonb not null default '[]' check(jsonb_typeof(descuentos)='array'), neto numeric(16,2) not null check(neto>=0),
 checklist jsonb not null default '{}' check(jsonb_typeof(checklist)='object'), motivo text not null default '', observacion text not null default '',
 revision integer not null default 1, reporte_revision integer, enviado_en timestamptz, firma_desde timestamptz, pago_fecha date, pago_referencia text,
 creado_en timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index valorizacion_final_etapa on public.trabajo_valorizaciones(serie_id,etapa) where tipo='FINAL';
create index valorizacion_cotizacion on public.trabajo_valorizaciones(cotizacion_id);
create index valorizacion_proyecto on public.trabajo_valorizaciones(proyecto_id);
create index valorizacion_analista on public.trabajo_valorizaciones(analista_id);
create table public.valorizacion_documentos (
 id uuid primary key default gen_random_uuid(), valorizacion_id uuid not null references public.trabajo_valorizaciones(id),
 tipo text not null check(tipo in ('FOTO','ISOMETRICO_INICIAL','ISOMETRICO_FINAL','RESUMEN','PLANTA','HERMETICIDAD','DECLARACION','GARANTIA','CONTRATO','REPORTE','FIRMADA','HONORARIOS','PAGO')),
 punto text, path text not null unique, nombre text not null, fecha date, ubicacion text not null default '',
 creado_por uuid not null references public.perfiles(id), created_at timestamptz not null default now()
);
create index valorizacion_documentos_padre on public.valorizacion_documentos(valorizacion_id);
create index valorizacion_documentos_autor on public.valorizacion_documentos(creado_por);
create table public.valorizacion_eventos (
 id bigint generated always as identity primary key, valorizacion_id uuid not null references public.trabajo_valorizaciones(id),
 accion text not null, usuario_id uuid not null references public.perfiles(id), actor_nombre text not null, detalle text not null default '', created_at timestamptz not null default now()
);
create index valorizacion_eventos_padre on public.valorizacion_eventos(valorizacion_id);
create index valorizacion_eventos_usuario on public.valorizacion_eventos(usuario_id);
alter table public.trabajo_valorizaciones enable row level security;
alter table public.valorizacion_documentos enable row level security;
alter table public.valorizacion_eventos enable row level security;
revoke all on public.trabajo_valorizaciones,public.valorizacion_documentos,public.valorizacion_eventos from anon,authenticated;
grant select on public.trabajo_valorizaciones,public.valorizacion_documentos,public.valorizacion_eventos to authenticated;
create policy valorizacion_lectura on public.trabajo_valorizaciones for select to authenticated using(
 (select valorizaciones_privado.rol()) in ('tesoreria','gerente','coordinador') or ((select valorizaciones_privado.rol())='analista' and analista_id=(select auth.uid())));
create policy valorizacion_documentos_lectura on public.valorizacion_documentos for select to authenticated using(exists(select 1 from public.trabajo_valorizaciones v where v.id=valorizacion_id));
create policy valorizacion_eventos_lectura on public.valorizacion_eventos for select to authenticated using(exists(select 1 from public.trabajo_valorizaciones v where v.id=valorizacion_id));
-- Treasury can read accepted project budgets and actual receipts/costs, without granting stock mutations.
create policy tesoreria_cotizaciones_lectura on public.proyecto_cotizaciones for select to authenticated using((select valorizaciones_privado.rol())='tesoreria' and estado in ('ACEPTADA','CERRADA','SUPERADA') and eliminada_en is null);
create policy tesoreria_gastos_lectura on public.proyecto_gastos for select to authenticated using((select valorizaciones_privado.rol())='tesoreria');
create policy tesoreria_proyectos_lectura on public.proyectos for select to authenticated using((select valorizaciones_privado.rol())='tesoreria');
create policy tesoreria_materiales_lectura on public.materiales for select to authenticated using((select valorizaciones_privado.rol())='tesoreria');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('valorizaciones','valorizaciones',false,15728640,array['application/pdf','image/jpeg']);
create function valorizaciones_privado.archivo_permitido(ruta text, escritura boolean) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.trabajo_valorizaciones v where v.id::text=split_part(ruta,'/',1) and
 (not escritura or ((select valorizaciones_privado.rol())='analista' and v.analista_id=(select auth.uid()) and v.estado in ('BORRADOR','OBSERVADA','RETENIDA'))
 or ((select valorizaciones_privado.rol())='tesoreria' and v.estado in ('EN_TESORERIA','RETENIDA','AUTORIZADA'))))
$$;
create policy valorizaciones_archivos_lectura on storage.objects for select to authenticated using(bucket_id='valorizaciones' and valorizaciones_privado.archivo_permitido(name,false));
create policy valorizaciones_archivos_carga on storage.objects for insert to authenticated with check(
 bucket_id='valorizaciones' and (storage.foldername(name))[2]=(select auth.uid())::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|pdf)$' and valorizaciones_privado.archivo_permitido(name,true));
create policy valorizaciones_archivos_huerfanos on storage.objects for delete to authenticated using(bucket_id='valorizaciones' and owner_id=(select auth.uid())::text and valorizaciones_privado.archivo_permitido(name,true) and not exists(select 1 from public.valorizacion_documentos d where d.path=name));

create function valorizaciones_privado.operar(p_accion text,p_id uuid,p_revision integer,p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); role_name text; actor_name text; v public.trabajo_valorizaciones; q public.proyecto_cotizaciones;
 amount numeric; advances numeric; discounts numeric; item jsonb; k text; status text; min_photos integer; available numeric; actual numeric; expense uuid; normalized jsonb; reference_price numeric; material_name text;
begin
 select rol::text,nombre into role_name,actor_name from public.perfiles where id=actor and estado::text='ACTIVO';
 if actor is null or role_name is null or role_name not in ('analista','tesoreria','gerente') then raise exception 'No tienes permiso para esta operación'; end if;
 if p_accion='crear' then
  if role_name<>'analista' then raise exception 'Solo el analista crea valorizaciones'; end if;
  select * into q from public.proyecto_cotizaciones where id=(p_datos->>'cotizacion_id')::uuid for update;
  if q.id is null or q.estado<>'ACEPTADA' or q.eliminada_en is not null or q.creado_por<>actor then raise exception 'Selecciona una cotización aceptada propia'; end if;
  if q.presupuesto->>'moneda' is distinct from 'PEN' then raise exception 'Este módulo requiere cotizaciones en soles'; end if;
  if p_datos->>'etapa' not in ('INTERNA','HABILITACION') or p_datos->>'tipo' not in ('FINAL','ADELANTO') then raise exception 'Etapa o tipo inválido'; end if;
  if nullif(btrim(p_datos->>'tecnico'),'') is null or coalesce(p_datos->>'dni','') !~ '^[0-9]{8}$' then raise exception 'Registra técnico responsable y DNI de ocho dígitos'; end if;
  select coalesce(sum((g->>'cantidad')::numeric*(g->>'costoUnitario')::numeric),0) into amount from jsonb_array_elements(q.presupuesto->'gastos') g where g->>'rubro'=case when p_datos->>'etapa'='INTERNA' then 'MANO_OBRA' else 'HABILITACION' end;
  if amount<=0 then raise exception 'No existe mano de obra presupuestada para esta etapa'; end if;
  select coalesce(sum(monto),0) into advances from public.trabajo_valorizaciones where serie_id=q.serie_id and etapa=p_datos->>'etapa' and tipo='ADELANTO';
  if exists(select 1 from public.trabajo_valorizaciones where serie_id=q.serie_id and etapa=p_datos->>'etapa' and tecnico<>btrim(p_datos->>'tecnico')) then raise exception 'El técnico debe coincidir con los adelantos de la etapa'; end if;
  if p_datos->>'tipo'='ADELANTO' then
   if exists(select 1 from public.trabajo_valorizaciones where serie_id=q.serie_id and etapa=p_datos->>'etapa' and tipo='FINAL') then raise exception 'Ya existe valorización final: no se permiten nuevos adelantos'; end if;
   actual:=(p_datos->>'monto')::numeric;
   if actual is null or actual<=0 or actual<>round(actual,2) or actual+advances>=amount or nullif(btrim(p_datos->>'motivo'),'') is null then raise exception 'El adelanto requiere motivo y debe dejar saldo de mano de obra'; end if;
   amount:=actual;
  else
   if exists(select 1 from public.trabajo_valorizaciones where serie_id=q.serie_id and etapa=p_datos->>'etapa' and tipo='ADELANTO' and estado<>'PAGADA') then raise exception 'Completa los adelantos antes de crear la valorización final'; end if;
  end if;
  insert into public.trabajo_valorizaciones(id,cotizacion_id,serie_id,proyecto_id,analista_id,tecnico,dni,etapa,tipo,monto,adelantos,neto,motivo)
  values(p_id,q.id,q.serie_id,q.proyecto_id,actor,btrim(p_datos->>'tecnico'),p_datos->>'dni',p_datos->>'etapa',p_datos->>'tipo',amount,case when p_datos->>'tipo'='FINAL' then advances else 0 end,amount-case when p_datos->>'tipo'='FINAL' then advances else 0 end,coalesce(p_datos->>'motivo','')) returning * into v;
 else
  select * into v from public.trabajo_valorizaciones where id=p_id;
  if v.id is null then raise exception 'Valorización no encontrada'; end if;
  -- Serialize all stage payments with quotation corrections and project closure.
  select * into q from public.proyecto_cotizaciones where serie_id=v.serie_id and estado='ACEPTADA' and eliminada_en is null for update;
  if q.id is null then raise exception 'El proyecto no tiene cotización aceptada vigente'; end if;
  select * into v from public.trabajo_valorizaciones where id=p_id for update;
  if v.revision<>p_revision then raise exception 'La valorización cambió. Actualiza y vuelve a intentar'; end if;
  if role_name='analista' and v.analista_id<>actor then raise exception 'La valorización pertenece a otro analista'; end if;
  if p_accion='checklist' then
   if role_name<>'analista' or v.estado not in ('BORRADOR','OBSERVADA','RETENIDA') or v.tipo<>'FINAL' then raise exception 'No puedes editar este checklist'; end if;
   if jsonb_typeof(p_datos->'checklist') is distinct from 'object' then raise exception 'Checklist inválido'; end if;
   select coalesce(sum((g->>'cantidad')::numeric*(g->>'costoUnitario')::numeric),0) into amount from jsonb_array_elements(q.presupuesto->'gastos') g where g->>'rubro'=case when v.etapa='INTERNA' then 'MANO_OBRA' else 'HABILITACION' end;
   if amount<=v.adelantos then raise exception 'La mano de obra corregida no cubre los adelantos pagados'; end if;
   update public.trabajo_valorizaciones set checklist=p_datos->'checklist',estado='BORRADOR',reporte_revision=null,monto=amount,neto=amount-adelantos,descuentos='[]',cotizacion_id=q.id where id=v.id;
  elsif p_accion='documento' then
   k:=p_datos->>'tipo';
   if k in ('FIRMADA','HONORARIOS','PAGO') then
    if role_name<>'tesoreria' or v.estado not in ('EN_TESORERIA','RETENIDA','AUTORIZADA') then raise exception 'Solo Tesorería carga los documentos de pago'; end if;
    if (k='PAGO' and v.estado<>'AUTORIZADA') or (k<>'PAGO' and v.estado='AUTORIZADA') then raise exception 'La documentación firmada se fija antes de la autorización; el comprobante se carga después'; end if;
   elsif role_name<>'analista' or v.estado not in ('BORRADOR','OBSERVADA','RETENIDA') then raise exception 'Solo el analista puede cargar evidencias antes de la revisión'; end if;
   if split_part(p_datos->>'path','/',1)<>v.id::text or split_part(p_datos->>'path','/',2)<>actor::text or not exists(select 1 from storage.objects where bucket_id='valorizaciones' and name=p_datos->>'path') then raise exception 'Archivo no disponible'; end if;
   if nullif(btrim(p_datos->>'nombre'),'') is null then raise exception 'Falta el nombre del archivo'; end if;
   if (k='FOTO' and p_datos->>'path' !~ '\.jpg$') or (k<>'FOTO' and p_datos->>'path' !~ '\.pdf$') then raise exception 'El formato del archivo no corresponde al documento'; end if;
   if k='FOTO' then
    if v.tipo<>'FINAL' or (p_datos->>'fecha')::date is null or (p_datos->>'fecha')::date>(now() at time zone 'America/Lima')::date or nullif(btrim(p_datos->>'ubicacion'),'') is null then raise exception 'Registra fecha real y ubicación de la foto'; end if;
    if p_datos->>'punto' not in ('fachada','gabinete','malla','profundidad','resane','transito','recorrido','valvulas','cocina','ventilacion','artefactos','adicionales') then raise exception 'Punto fotográfico inválido'; end if;
    if (select count(*) from public.valorizacion_documentos where valorizacion_id=v.id and tipo='FOTO')>=40 then raise exception 'Máximo 40 fotos por valorización'; end if;
   end if;
   insert into public.valorizacion_documentos(valorizacion_id,tipo,punto,path,nombre,fecha,ubicacion,creado_por) values(v.id,k,p_datos->>'punto',p_datos->>'path',p_datos->>'nombre',nullif(p_datos->>'fecha','')::date,coalesce(p_datos->>'ubicacion',''),actor);
   update public.trabajo_valorizaciones set reporte_revision=case when k='REPORTE' then revision+1 when k in ('FIRMADA','HONORARIOS','PAGO') then reporte_revision else null end where id=v.id;
  elsif p_accion='enviar' then
   if role_name<>'analista' or v.estado not in ('BORRADOR','OBSERVADA','RETENIDA') then raise exception 'No puedes enviar esta valorización'; end if;
   if v.tipo='FINAL' then
    foreach k in array array['fachada','gabinete','malla','profundidad','resane','transito','recorrido','valvulas','cocina','ventilacion','artefactos','adicionales','costos','materiales','cargos','constructivo','portal','supervision','formatos'] loop
     status:=v.checklist->k->>'estado';
     if status is null or status not in ('CONFORME','NO_APLICA') then raise exception 'Checklist incompleto u observado: %',k; end if;
     if status='NO_APLICA' and nullif(btrim(v.checklist->k->>'nota'),'') is null then raise exception 'Justifica el punto no aplicable: %',k; end if;
     min_photos:=case when k='cocina' then 2 when k in ('fachada','gabinete','malla','profundidad','resane','transito','recorrido','valvulas','ventilacion','artefactos') then 1 else 0 end;
     if status='CONFORME' and (select count(*) from public.valorizacion_documentos where valorizacion_id=v.id and tipo='FOTO' and punto=k and fecha is not null and btrim(ubicacion)<>'')<min_photos then raise exception 'Faltan fotografías para %',k; end if;
    end loop;
    foreach k in array array['ISOMETRICO_FINAL','RESUMEN','PLANTA','HERMETICIDAD','DECLARACION','GARANTIA','CONTRATO','REPORTE'] loop
     if not exists(select 1 from public.valorizacion_documentos where valorizacion_id=v.id and tipo=k) then raise exception 'Falta documento: %',k; end if;
    end loop;
    if v.reporte_revision is distinct from v.revision then raise exception 'Genera nuevamente el reporte fotográfico antes de enviar'; end if;
   end if;
   update public.trabajo_valorizaciones set estado='EN_TESORERIA',observacion='',descuentos='[]',neto=monto-adelantos,enviado_en=now(),firma_desde=now() where id=v.id;
  elsif p_accion in ('observar','retener') then
   if role_name<>'tesoreria' or v.estado not in ('EN_TESORERIA','RETENIDA') then raise exception 'Solo Tesorería puede observar o retener'; end if;
   if nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Explica el motivo'; end if;
   update public.trabajo_valorizaciones set estado=case when p_accion='observar' then 'OBSERVADA' else 'RETENIDA' end,observacion=p_datos->>'detalle',reporte_revision=null where id=v.id;
  elsif p_accion in ('descuentos','revisar') then
   if role_name<>'tesoreria' or v.estado not in ('EN_TESORERIA','RETENIDA') then raise exception 'Solo Tesorería envía a gerencia'; end if;
   if p_accion='revisar' and coalesce((p_datos->>'documentacionConforme')::boolean,false) is not true then raise exception 'Confirma la revisión de documentos y materiales'; end if;
   if jsonb_typeof(p_datos->'descuentos') is distinct from 'array' then raise exception 'Descuentos inválidos'; end if;
   if v.tipo='ADELANTO' and jsonb_array_length(p_datos->'descuentos')>0 then raise exception 'Los descuentos se aplican en la valorización final'; end if;
   discounts:=0; normalized:='[]';
   for item in select * from jsonb_array_elements(p_datos->'descuentos') loop
    if not exists(select 1 from public.materiales where sku=item->>'sku') or coalesce((item->>'cantidad')::numeric,0)<=0 or coalesce((item->>'monto')::numeric,0)<=0 or nullif(btrim(item->>'motivo'),'') is null then raise exception 'Cada descuento requiere material, cantidad, monto y motivo'; end if;
    if (item->>'monto')::numeric<>round((item->>'monto')::numeric,2) then raise exception 'El descuento admite dos decimales'; end if;
    if exists(select 1 from jsonb_array_elements(normalized) d where d->>'sku'=item->>'sku') then raise exception 'Agrupa las cantidades del mismo material en un solo descuento'; end if;
    select precio_unitario,nombre into reference_price,material_name from public.materiales where sku=item->>'sku';
    normalized:=normalized||jsonb_build_array(item||jsonb_build_object('referencia',coalesce(reference_price,0),'nombre',material_name));
    discounts:=discounts+(item->>'monto')::numeric;
   end loop;
   if discounts>=v.monto-v.adelantos then raise exception 'El descuento debe dejar saldo positivo; retén la valorización si no hay saldo'; end if;
   if p_accion='revisar' then
    if normalized is distinct from v.descuentos then raise exception 'Guarda primero los descuentos y vuelve a solicitar la firma del neto definitivo'; end if;
    if not exists(select 1 from public.valorizacion_documentos where valorizacion_id=v.id and tipo='FIRMADA' and created_at>=v.firma_desde) or not exists(select 1 from public.valorizacion_documentos where valorizacion_id=v.id and tipo='HONORARIOS' and created_at>=v.firma_desde) then raise exception 'Carga valorización firmada y recibo por honorarios vigentes antes de solicitar autorización'; end if;
    update public.trabajo_valorizaciones set estado='EN_GERENCIA',observacion=coalesce(p_datos->>'detalle','') where id=v.id;
   else
    update public.trabajo_valorizaciones set descuentos=normalized,neto=monto-adelantos-discounts,firma_desde=case when normalized is distinct from descuentos then now() else firma_desde end where id=v.id;
   end if;
  elsif p_accion in ('autorizar','devolver') then
   if role_name<>'gerente' or v.estado<>'EN_GERENCIA' then raise exception 'Solo el gerente autoriza pagos enviados a gerencia'; end if;
   if p_accion='devolver' and nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Explica el motivo de devolución'; end if;
   update public.trabajo_valorizaciones set estado=case when p_accion='autorizar' then 'AUTORIZADA' else 'EN_TESORERIA' end,observacion=coalesce(p_datos->>'detalle','') where id=v.id;
  elsif p_accion='revocar' then
   if role_name<>'gerente' or v.estado<>'AUTORIZADA' or nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Solo el gerente puede revocar un pago aún no registrado, indicando el motivo'; end if;
   update public.trabajo_valorizaciones set estado='EN_TESORERIA',observacion=p_datos->>'detalle' where id=v.id;
  elsif p_accion='pagar' then
   if role_name<>'tesoreria' or v.estado<>'AUTORIZADA' then raise exception 'El pago requiere autorización del gerente'; end if;
   if nullif(btrim(p_datos->>'referencia'),'') is null or (p_datos->>'fecha')::date is null or (p_datos->>'fecha')::date>(now() at time zone 'America/Lima')::date then raise exception 'Registra fecha y referencia del pago'; end if;
   if not exists(select 1 from public.valorizacion_documentos where valorizacion_id=v.id and tipo='PAGO') then raise exception 'Carga el comprobante del pago'; end if;
   select coalesce(sum((g->>'cantidad')::numeric*(g->>'costoUnitario')::numeric),0) into available from jsonb_array_elements(q.presupuesto->'gastos') g where g->>'rubro'=case when v.etapa='INTERNA' then 'MANO_OBRA' else 'HABILITACION' end;
   select coalesce(sum(monto),0) into actual from public.trabajo_valorizaciones where serie_id=v.serie_id and etapa=v.etapa and tipo='ADELANTO' and estado='PAGADA' and id<>v.id;
   if (v.tipo='FINAL' and (v.monto<>available or v.adelantos<>actual)) or (v.tipo='ADELANTO' and actual+v.monto>=available) then raise exception 'El presupuesto cambió: revisa la valorización antes de pagar'; end if;
   select id into expense from public.proyecto_gastos where valorizacion_id=v.id;
   if expense is not null then raise exception 'El pago ya fue registrado'; end if;
   insert into public.proyecto_gastos(id,cotizacion_id,rubro,naturaleza,descripcion,monto,fecha,comprobante,documento_path,creado_por,valorizacion_id)
   select gen_random_uuid(),q.id,case when v.etapa='INTERNA' then 'MANO_OBRA' else 'HABILITACION' end,'COSTO',v.codigo||' · '||v.tecnico||' · '||v.tipo,v.neto,(p_datos->>'fecha')::date,p_datos->>'referencia',d.path,actor,v.id from public.valorizacion_documentos d where d.valorizacion_id=v.id and d.tipo='PAGO' order by d.created_at desc limit 1;
   update public.trabajo_valorizaciones set estado='PAGADA',pago_fecha=(p_datos->>'fecha')::date,pago_referencia=p_datos->>'referencia' where id=v.id;
   update public.proyecto_cotizaciones set revision=revision+1,updated_at=now() where id=q.id;
  else raise exception 'Acción desconocida'; end if;
  update public.trabajo_valorizaciones set revision=revision+1,updated_at=now() where id=v.id;
 end if;
 insert into public.valorizacion_eventos(valorizacion_id,accion,usuario_id,actor_nombre,detalle) values(v.id,p_accion,actor,actor_name,coalesce(p_datos->>'detalle',p_datos->>'motivo',''));
 return v.id;
end $$;
alter table public.proyecto_gastos add column valorizacion_id uuid unique references public.trabajo_valorizaciones(id);
create function public.operar_valorizacion(p_accion text,p_id uuid,p_revision integer,p_datos jsonb default '{}') returns uuid language sql security invoker set search_path='' as $$
 select valorizaciones_privado.operar(p_accion,p_id,p_revision,p_datos)
$$;

-- The same closing guard applies to the existing quotation closing action.
create function valorizaciones_privado.validar_cierre() returns trigger language plpgsql security definer set search_path='' as $$
declare income numeric; amount numeric; rubro text;
begin
 if new.estado='CERRADA' and old.estado is distinct from 'CERRADA' then
  select coalesce(sum(g.monto),0) into income from public.proyecto_gastos g join public.proyecto_cotizaciones q on q.id=g.cotizacion_id where q.serie_id=new.serie_id and g.estado='REGISTRADO' and g.naturaleza='ABONO';
  if income<new.importe_aceptado then raise exception 'El cliente debe pagar el 100%% del contrato antes del cierre'; end if;
  if exists(select 1 from public.trabajo_valorizaciones where serie_id=new.serie_id and estado<>'PAGADA') then raise exception 'Hay valorizaciones o adelantos pendientes'; end if;
  foreach rubro in array array['MANO_OBRA','HABILITACION'] loop
   select coalesce(sum((g->>'cantidad')::numeric*(g->>'costoUnitario')::numeric),0) into amount from jsonb_array_elements(new.presupuesto->'gastos') g where g->>'rubro'=rubro;
   if amount>0 and not exists(select 1 from public.trabajo_valorizaciones where serie_id=new.serie_id and etapa=case when rubro='MANO_OBRA' then 'INTERNA' else 'HABILITACION' end and tipo='FINAL' and estado='PAGADA') then raise exception 'Falta completar valorización final: %',rubro; end if;
  end loop;
 end if;
 -- Preserve cost traceability: a paid valuation cannot be annulled as a generic project expense.
 return new;
end $$;
create trigger valorizacion_cierre before update on public.proyecto_cotizaciones for each row execute function valorizaciones_privado.validar_cierre();
create function valorizaciones_privado.proteger_gasto() returns trigger language plpgsql set search_path='' as $$ begin
 if old.valorizacion_id is not null then raise exception 'El pago de una valorización no se puede anular ni modificar como gasto genérico'; end if; return new; end $$;
create trigger valorizacion_gasto_inmutable before update or delete on public.proyecto_gastos for each row execute function valorizaciones_privado.proteger_gasto();
revoke all on all functions in schema valorizaciones_privado from public,anon;
revoke all on function public.operar_valorizacion(text,uuid,integer,jsonb) from public,anon;
grant execute on function valorizaciones_privado.rol(),valorizaciones_privado.archivo_permitido(text,boolean),valorizaciones_privado.operar(text,uuid,integer,jsonb),public.operar_valorizacion(text,uuid,integer,jsonb) to authenticated;
commit;
