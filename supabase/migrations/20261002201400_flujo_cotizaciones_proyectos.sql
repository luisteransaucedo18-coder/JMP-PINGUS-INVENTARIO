-- Budget snapshots and actual expenses are independent. Existing stock workflows remain authoritative.
create schema if not exists proyecto_cotizaciones_privado;
revoke all on schema proyecto_cotizaciones_privado from public, anon;
grant usage on schema proyecto_cotizaciones_privado to authenticated;
create sequence public.proyecto_cotizacion_codigo_seq;
create table public.proyecto_cotizaciones (
 id uuid primary key, codigo text not null default ('COT-P-'||lpad(nextval('public.proyecto_cotizacion_codigo_seq')::text,6,'0')) unique,
 proyecto_id uuid not null references public.proyectos(id), serie_id uuid not null, version integer not null check(version>0),
 revision integer not null default 1, estado text not null default 'BORRADOR' check(estado in ('BORRADOR','EN_REVISION','OBSERVADA','APROBADA','PRESENTADA','ACEPTADA','RECHAZADA','VENCIDA','ANULADA','SUPERADA','CERRADA')),
 creado_por uuid not null references public.perfiles(id), presupuesto jsonb not null, totales jsonb not null, proyecto_snapshot jsonb not null,
 importe_presentado numeric(16,2), importe_aceptado numeric(16,2), evidencia text, documento_path text,
 observaciones text, cierre text, fecha_habilitacion date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(serie_id,version), check(importe_presentado is null or importe_presentado>0), check(importe_aceptado is null or importe_aceptado>0)
);
create unique index cotizacion_aceptada_por_serie on public.proyecto_cotizaciones(serie_id) where estado in ('ACEPTADA','CERRADA');
create index cotizacion_proyecto on public.proyecto_cotizaciones(proyecto_id);
create index cotizacion_autor on public.proyecto_cotizaciones(creado_por);
create index cotizacion_estado_actualizacion on public.proyecto_cotizaciones(estado,updated_at);
create table public.cotizacion_eventos (
 id bigint generated always as identity primary key, cotizacion_id uuid not null references public.proyecto_cotizaciones(id),
 accion text not null, estado_anterior text, estado_nuevo text not null, usuario_id uuid not null references public.perfiles(id),
 detalle text not null default '', created_at timestamptz not null default now()
);
create index cotizacion_eventos_padre on public.cotizacion_eventos(cotizacion_id);
create index cotizacion_eventos_usuario on public.cotizacion_eventos(usuario_id);
create table public.cotizacion_asignaciones (
 id uuid primary key default gen_random_uuid(), cotizacion_id uuid not null references public.proyecto_cotizaciones(id), item_id uuid not null,
 requerimiento_id uuid not null references public.requerimientos(id), material_sku text not null references public.materiales(sku), cantidad numeric not null check(cantidad>0),
 unique(requerimiento_id,item_id)
);
create index cotizacion_asignaciones_padre on public.cotizacion_asignaciones(cotizacion_id);
create index cotizacion_asignaciones_req on public.cotizacion_asignaciones(requerimiento_id);
create table public.proyecto_gastos (
 id uuid primary key, cotizacion_id uuid not null references public.proyecto_cotizaciones(id), rubro text not null,
 descripcion text not null, naturaleza text not null default 'COSTO' check(naturaleza in ('COSTO','ABONO')), monto numeric(16,2) not null check(monto>0), fecha date not null, comprobante text not null,
 documento_path text, material_sku text references public.materiales(sku), cantidad numeric check(cantidad>0),
 estado text not null default 'REGISTRADO' check(estado in ('REGISTRADO','ANULADO')), motivo_anulacion text,
 creado_por uuid not null references public.perfiles(id), created_at timestamptz not null default now()
);
create index proyecto_gastos_padre on public.proyecto_gastos(cotizacion_id);
create index proyecto_gastos_usuario on public.proyecto_gastos(creado_por);
create index proyecto_gastos_material on public.proyecto_gastos(material_sku);
create table public.cotizacion_plantillas (
 id uuid primary key, nombre text not null, modalidad text not null, ciudad text not null, tipo text not null,
 puntos integer not null check(puntos>0), tasas jsonb not null, gastos jsonb not null, parametros jsonb not null,
 actualizado_por uuid references public.perfiles(id), updated_at timestamptz not null default now()
);
create table public.cotizacion_periodos (
 periodo date primary key check(extract(day from periodo)=1), gastos_generales_jmp numeric(16,2) not null check(gastos_generales_jmp>=0),
 control_bonos jsonb not null default '{}', actualizado_por uuid not null references public.perfiles(id), updated_at timestamptz not null default now()
);
create index cotizacion_plantillas_usuario on public.cotizacion_plantillas(actualizado_por);
create index cotizacion_periodos_usuario on public.cotizacion_periodos(actualizado_por);

create function proyecto_cotizaciones_privado.activo() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and estado::text='ACTIVO')
$$;
revoke all on function proyecto_cotizaciones_privado.activo() from public,anon;
grant execute on function proyecto_cotizaciones_privado.activo() to authenticated;
alter table public.proyecto_cotizaciones enable row level security;
alter table public.cotizacion_eventos enable row level security;
alter table public.cotizacion_asignaciones enable row level security;
alter table public.proyecto_gastos enable row level security;
alter table public.cotizacion_plantillas enable row level security;
alter table public.cotizacion_periodos enable row level security;
create policy cotizaciones_lectura on public.proyecto_cotizaciones for select to authenticated using (
 (select proyecto_cotizaciones_privado.activo()) and (creado_por=(select auth.uid()) or (select public.rol_actual())::text in ('coordinador','gerente'))
);
create policy eventos_lectura on public.cotizacion_eventos for select to authenticated using(exists(select 1 from public.proyecto_cotizaciones q where q.id=cotizacion_id));
create policy asignaciones_lectura on public.cotizacion_asignaciones for select to authenticated using(exists(select 1 from public.proyecto_cotizaciones q where q.id=cotizacion_id));
create policy gastos_lectura on public.proyecto_gastos for select to authenticated using(exists(select 1 from public.proyecto_cotizaciones q where q.id=cotizacion_id));
create policy plantillas_lectura on public.cotizacion_plantillas for select to authenticated using((select proyecto_cotizaciones_privado.activo()));
create policy periodos_lectura on public.cotizacion_periodos for select to authenticated using((select proyecto_cotizaciones_privado.activo()) and (select public.rol_actual())::text in ('coordinador','gerente'));
revoke all on public.proyecto_cotizaciones,public.cotizacion_eventos,public.cotizacion_asignaciones,public.proyecto_gastos,public.cotizacion_plantillas from anon,authenticated;
grant select on public.proyecto_cotizaciones,public.cotizacion_eventos,public.cotizacion_asignaciones,public.proyecto_gastos,public.cotizacion_plantillas to authenticated;
revoke all on public.cotizacion_periodos from anon,authenticated; grant select on public.cotizacion_periodos to authenticated;

create function proyecto_cotizaciones_privado.numero(v jsonb, minimo numeric default 0, maximo numeric default 100000000) returns numeric
 language plpgsql immutable security invoker set search_path='' as $$
declare n numeric;
begin
 if v is null or jsonb_typeof(v)<>'number' then raise exception 'Importe o cantidad inválidos'; end if;
 n:=(v#>>'{}')::numeric;
 if not(n>=minimo and n<=maximo) then raise exception 'Importe o cantidad fuera del rango permitido'; end if;
 return n;
end $$;
create function proyecto_cotizaciones_privado.calcular(b jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare m numeric:=0; g numeric:=0; d numeric; f numeric; gg numeric; u numeric; s numeric; c numeric; v numeric; i numeric; x jsonb; t jsonb:=b->'tasas';
begin
 if b is null or jsonb_typeof(b)<>'object' or coalesce(b->>'modalidad','') not in ('COBRE','PEALPE','PEQUENOS','FISE')
 or coalesce(b->>'moneda','') not in ('PEN','USD') or coalesce(b->>'sede','') not in ('Chiclayo','Chimbote','Trujillo')
 or coalesce(b->>'tipo','') not in ('TIPICO','NO_TIPICO') then raise exception 'Parámetros del presupuesto inválidos'; end if;
 if nullif(btrim(b->>'ciudad'),'') is null or nullif(btrim(b->>'alcance'),'') is null or nullif(btrim(b->>'tecnico'),'') is null
 or nullif(b->>'vigencia','') is null then raise exception 'Completa ciudad, alcance, técnico y vigencia'; end if;
 perform (b->>'vigencia')::date;
 perform proyecto_cotizaciones_privado.numero(b->'tipoCambio',0.000001);
 d:=proyecto_cotizaciones_privado.numero(b->'puntos',1,10000);
 if d<>trunc(d) then raise exception 'Los puntos deben ser enteros'; end if;
 if jsonb_typeof(b->'materiales') is distinct from 'array' or jsonb_typeof(b->'gastos') is distinct from 'array'
 or jsonb_array_length(b->'materiales')+jsonb_array_length(b->'gastos') not between 1 and 200 then raise exception 'Agrega de 1 a 200 partidas'; end if;
 for x in select value from jsonb_array_elements(b->'materiales') loop
  if nullif(x->>'id','') is null then raise exception 'Material sin identificador'; end if; perform (x->>'id')::uuid;
  if nullif(x->>'sku','') is null or nullif(btrim(x->>'unidadCotizada'),'') is null then raise exception 'Material sin SKU o unidad'; end if;
  d:=proyecto_cotizaciones_privado.numero(x->'factorStock',0.000001)*proyecto_cotizaciones_privado.numero(x->'cantidad',0.000001);
  if d>100000000 then raise exception 'La conversión excede la cantidad permitida'; end if;
  m:=m+round(proyecto_cotizaciones_privado.numero(x->'cantidad',0.000001)*proyecto_cotizaciones_privado.numero(x->'costoUnitario'),2);
 end loop;
 if exists(select 1 from jsonb_array_elements(b->'materiales') entry group by entry->>'id' having count(*)>1) then raise exception 'Identificadores de material repetidos'; end if;
 for x in select value from jsonb_array_elements(b->'gastos') loop
  if nullif(x->>'id','') is null then raise exception 'Partida sin identificador'; end if; perform (x->>'id')::uuid;
  if coalesce(x->>'rubro','') not in ('MANO_OBRA','HABILITACION','MURETES','FIJOS','VARIABLES','FLETE','MOVILIDAD','SUPERVISION','VIATICOS','HOSPEDAJE','ALIMENTACION','PASAJES','COMBUSTIBLE','PEAJES','ANCLAJE','ALTURA','IG3','DOCUMENTACION','PAQUETE','FINANCIAMIENTO','GENERALES','COMISION','BONO','ADICIONALES') or nullif(btrim(x->>'descripcion'),'') is null then raise exception 'Partida de servicio inválida'; end if;
  g:=g+round(proyecto_cotizaciones_privado.numero(x->'cantidad',0.000001)*proyecto_cotizaciones_privado.numero(x->'costoUnitario'),2);
 end loop;
 d:=m+g;
 if d>100000000 then raise exception 'Costo directo fuera del rango permitido'; end if;
 if exists(select 1 from jsonb_array_elements(b->'gastos') entry group by entry->>'id' having count(*)>1) then raise exception 'Identificadores de partida repetidos'; end if;
 if exists(select 1 from jsonb_array_elements(b->'gastos') a where a->>'rubro' in ('FINANCIAMIENTO','GENERALES','COMISION')) then raise exception 'Configura cargos porcentuales en Porcentajes y financiamiento'; end if;
 if exists(select 1 from jsonb_array_elements(b->'gastos') a where (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0 and ((a->>'variableExcel'='mureteCachimbo' and b->'excel'->>'muretesCachimbo'='NO') or (a->>'variableExcel'='mureteValvula' and b->'excel'->>'muretesValvula'='NO'))) then raise exception 'Indica SI en el murete para incluir su costo'; end if;
 if exists(select 1 from jsonb_array_elements(b->'gastos') a where a->>'rubro'='VARIABLES' and (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0) and exists(select 1 from jsonb_array_elements(b->'gastos') a where (a->>'rubro' in ('FLETE','MOVILIDAD','SUPERVISION') or (b->>'modalidad'='COBRE' and a->>'rubro' in ('VIATICOS','HOSPEDAJE','ALIMENTACION','PASAJES','COMBUSTIBLE','PEAJES'))) and (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0) then raise exception 'Usa Gastos Variables globales o detallados, no ambos'; end if;
 if exists(select 1 from jsonb_array_elements(b->'gastos') a where a->>'variableExcel'='redInterna' and (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0) and exists(select 1 from jsonb_array_elements(b->'gastos') a where a->>'variableExcel' like 'cobre%' and (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0) then raise exception 'Mano de obra global o por diámetro, no ambas'; end if;
 if exists(select 1 from jsonb_array_elements(b->'gastos') a where a->>'rubro'='PAQUETE' and (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0) and (m>0 or exists(select 1 from jsonb_array_elements(b->'gastos') a where a->>'rubro'='MANO_OBRA' and (a->>'cantidad')::numeric*(a->>'costoUnitario')::numeric>0)) then raise exception 'El paquete de mano de obra y materiales sustituye el detalle'; end if;
 perform proyecto_cotizaciones_privado.numero(b->'excel'->'diasProyectados',0,10000);
 if coalesce(b->'excel'->>'muretesCachimbo','') not in ('SI','NO') or coalesce(b->'excel'->>'muretesValvula','') not in ('SI','NO') then raise exception 'Indica SI o NO para los muretes'; end if;
 f:=round(d*proyecto_cotizaciones_privado.numero(t->'financiamientoMensual',0,100)*proyecto_cotizaciones_privado.numero(t->'meses',0,120)/100,2);
 gg:=round(d*proyecto_cotizaciones_privado.numero(t->'generales',0,100)/100,2);
 u:=round(d*proyecto_cotizaciones_privado.numero(t->'utilidad',0,100)/100,2);
 s:=d+f+gg+u; c:=round(s*proyecto_cotizaciones_privado.numero(t->'comision',0,100)/100,2); v:=s+c;
 if b->>'modalidad'='FISE' then
  if nullif(btrim(b->'fise'->>'configuracion'),'') is null or nullif(btrim(b->'fise'->>'instalacion'),'') is null or nullif(btrim(b->'fise'->>'acometida'),'') is null then raise exception 'Completa la configuración FISE'; end if;
  if nullif(btrim(b->'fise'->>'configuracionInterna'),'') is null or coalesce(b->'fise'->>'presionArtefactos','') !~ '^(23|340)(\s*-\s*(23|340))*$' or cardinality(regexp_split_to_array(b->'fise'->>'presionArtefactos','\s*-\s*'))<>(b->>'puntos')::integer then raise exception 'Completa Configuración interna y Presión de artefactos (23 - 340), una presión por punto'; end if;
  v:=round(proyecto_cotizaciones_privado.numero(b->'fise'->'ingresoSinIgv',0.01),2);
  c:=round(v*proyecto_cotizaciones_privado.numero(t->'comision',0,100)/100,2); u:=v-d-f-gg-c; s:=v-c;
 end if;
 i:=round(v*proyecto_cotizaciones_privado.numero(t->'igv',0,100)/100,2);
 if v+i>100000000 then raise exception 'Total fuera del rango permitido'; end if;
 return jsonb_build_object('materiales',m,'gastos',g,'costoDirecto',d,'financiamiento',f,'generales',gg,'utilidad',u,'subtotal',s,'comision',c,'valorVenta',v,'igv',i,'total',v+i);
end $$;

create function proyecto_cotizaciones_privado.operar(p_accion text,p_id uuid,p_datos jsonb) returns uuid
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
  select * into proj from public.proyectos where id=(p_datos->>'proyectoId')::uuid and activo;
  if proj.id is null then raise exception 'Selecciona un proyecto activo'; end if;
  if q.id is not null and q.proyecto_id<>proj.id then raise exception 'El proyecto de una versión no puede cambiar'; end if;
  for x in select value from jsonb_array_elements(b->'materiales') loop
   select * into mat from public.materiales where sku=x->>'sku' and activo;
   if mat.sku is null then raise exception 'Material no disponible: %',x->>'sku'; end if;
   if x->>'unidadCotizada'=mat.unidad and (x->>'factorStock')::numeric<>1 then raise exception 'Para la unidad del catálogo usa factor 1'; end if;
   canonical:=canonical||jsonb_build_array(x||jsonb_build_object('nombre',mat.nombre,'unidadCatalogo',mat.unidad));
  end loop;
  b:=jsonb_set(b,'{materiales}',canonical);
  if q.id is null then
   insert into public.proyecto_cotizaciones(id,proyecto_id,serie_id,version,creado_por,presupuesto,totales,proyecto_snapshot)
   values(p_id,proj.id,p_id,1,actor,b,totals,jsonb_build_object('nombre',proj.nombre,'cliente',proj.cliente,'ubicacion',proj.ubicacion,'responsable',proj.responsable));
  else update public.proyecto_cotizaciones set presupuesto=b,totales=totals,revision=revision+1,updated_at=now() where id=q.id; end if;
 elsif q.id is null then raise exception 'Cotización no encontrada';
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
  if role_name='coordinador' and q.estado='EN_REVISION' and target in ('APROBADA','OBSERVADA') then null;
  elsif role_name='analista' and q.creado_por=actor and ((q.estado in ('BORRADOR','OBSERVADA') and target='EN_REVISION') or (q.estado='APROBADA' and target='PRESENTADA') or (q.estado='PRESENTADA' and target in ('ACEPTADA','RECHAZADA','VENCIDA')) or (q.estado in ('BORRADOR','OBSERVADA','EN_REVISION','APROBADA','PRESENTADA') and target='ANULADA')) then null;
  else raise exception 'Transición de estado no permitida para tu rol'; end if;
  if target in ('OBSERVADA','RECHAZADA','ANULADA') and nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Explica el motivo'; end if;
  if target in ('EN_REVISION','PRESENTADA','ACEPTADA') and (q.presupuesto->>'vigencia')::date<(now() at time zone 'America/Lima')::date then raise exception 'La vigencia terminó. Crea una nueva versión'; end if;
  if target='VENCIDA' and (q.presupuesto->>'vigencia')::date>=(now() at time zone 'America/Lima')::date then raise exception 'La cotización todavía está vigente'; end if;
  if target='EN_REVISION' and (q.totales->>'total')::numeric<=0 then raise exception 'El total debe ser positivo'; end if;
  if target in ('PRESENTADA','ACEPTADA') then amount:=round(proyecto_cotizaciones_privado.numero(p_datos->'importe',0.01),2); end if;
  if target='ACEPTADA' then
   if nullif(btrim(p_datos->>'detalle'),'') is null then raise exception 'Registra la evidencia de aceptación del cliente'; end if;
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
create function public.operar_cotizacion_proyecto(p_accion text,p_id uuid,p_datos jsonb) returns uuid language sql security invoker set search_path='' as $$
 select proyecto_cotizaciones_privado.operar(p_accion,p_id,p_datos)
$$;
revoke all on all functions in schema proyecto_cotizaciones_privado from public,anon;
revoke all on function public.operar_cotizacion_proyecto(text,uuid,jsonb) from public,anon;
grant execute on function public.operar_cotizacion_proyecto(text,uuid,jsonb),proyecto_cotizaciones_privado.operar(text,uuid,jsonb),proyecto_cotizaciones_privado.activo() to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.proyecto_cotizaciones,public.proyecto_gastos,public.cotizacion_plantillas,public.cotizacion_periodos;
 end if;
end $$;
