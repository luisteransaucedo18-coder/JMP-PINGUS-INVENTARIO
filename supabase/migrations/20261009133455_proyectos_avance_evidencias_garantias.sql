-- Avance, fotos privadas y solicitudes de atención vinculadas a cada proyecto.
begin;
create schema if not exists proyectos_seguimiento_privado;
grant usage on schema proyectos_seguimiento_privado to authenticated;

create function proyectos_seguimiento_privado.rol_activo() returns text
language sql stable security invoker set search_path='' as $$
  select rol::text from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO';
$$;
revoke all on function proyectos_seguimiento_privado.rol_activo() from public,anon;
grant execute on function proyectos_seguimiento_privado.rol_activo() to authenticated;

alter table public.proyectos
  add column estado_obra text not null default 'PLANIFICADO' check(estado_obra in ('PLANIFICADO','EN_CONSTRUCCION','PAUSADO','FINALIZADO','CANCELADO')),
  add column fecha_finalizacion date,
  add column garantia_hasta date generated always as ((fecha_finalizacion + interval '1 year')::date) stored,
  add column revision_obra integer not null default 0;

create table public.proyecto_incidencias (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id),
  producto text not null check(length(btrim(producto)) between 1 and 150),
  material_sku text references public.materiales(sku),
  descripcion text not null check(length(btrim(descripcion)) between 1 and 2000),
  fecha_incidencia date not null,
  estado text not null default 'ABIERTA' check(estado in ('ABIERTA','EN_REVISION','PROGRAMADA','EN_ATENCION','RESUELTA','RECHAZADA')),
  cobertura text not null default 'PENDIENTE' check(cobertura in ('PENDIENTE','CUBIERTA','NO_CUBIERTA')),
  plazo_garantia text not null check(plazo_garantia in ('DENTRO','FUERA','SIN_INICIO')),
  garantia_hasta date,
  fecha_atencion date,
  resolucion text not null default '' check(length(resolucion)<=2000),
  requerimiento_id uuid references public.requerimientos(id),
  creado_por uuid not null references public.perfiles(id),
  autor_nombre text not null,
  actualizado_por uuid references public.perfiles(id),
  revisor_nombre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 0,
  unique(id,proyecto_id)
);
create index proyecto_incidencias_proyecto_idx on public.proyecto_incidencias(proyecto_id,created_at desc);
create index proyecto_incidencias_creador_idx on public.proyecto_incidencias(creado_por);
create index proyecto_incidencias_revisor_idx on public.proyecto_incidencias(actualizado_por);
create index proyecto_incidencias_material_idx on public.proyecto_incidencias(material_sku);
create index proyecto_incidencias_requerimiento_idx on public.proyecto_incidencias(requerimiento_id);

create table public.proyecto_evidencias (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id),
  incidencia_id uuid,
  etapa text not null check(etapa in ('PROCESO','INSTALACION_FINAL','INCIDENCIA')),
  ruta text not null unique,
  nombre text not null check(length(nombre) between 1 and 255),
  descripcion text not null default '' check(length(descripcion)<=1000),
  creado_por uuid not null references public.perfiles(id),
  autor_nombre text not null,
  created_at timestamptz not null default now(),
  foreign key(incidencia_id,proyecto_id) references public.proyecto_incidencias(id,proyecto_id),
  check((etapa='INCIDENCIA')=(incidencia_id is not null))
);
create index proyecto_evidencias_proyecto_idx on public.proyecto_evidencias(proyecto_id,created_at desc);
create index proyecto_evidencias_incidencia_idx on public.proyecto_evidencias(incidencia_id,proyecto_id);
create index proyecto_evidencias_creador_idx on public.proyecto_evidencias(creado_por);

alter table public.proyecto_incidencias enable row level security;
alter table public.proyecto_evidencias enable row level security;
revoke all on public.proyecto_incidencias, public.proyecto_evidencias from anon,authenticated;
grant select on public.proyecto_incidencias,public.proyecto_evidencias to authenticated;
grant insert(id,proyecto_id,producto,material_sku,descripcion,fecha_incidencia) on public.proyecto_incidencias to authenticated;
grant update(estado,cobertura,fecha_atencion,resolucion,requerimiento_id) on public.proyecto_incidencias to authenticated;
grant insert(id,proyecto_id,incidencia_id,etapa,ruta,nombre,descripcion) on public.proyecto_evidencias to authenticated;
create policy proyecto_incidencias_lectura on public.proyecto_incidencias for select to authenticated
using((select proyectos_seguimiento_privado.rol_activo()) in ('gerente','analista','coordinador'));
create policy proyecto_incidencias_registro on public.proyecto_incidencias for insert to authenticated
with check((select proyectos_seguimiento_privado.rol_activo()) in ('analista','coordinador') and creado_por=(select auth.uid())
  and exists(select 1 from public.proyectos p where p.id=proyecto_id and p.activo and p.estado_obra<>'CANCELADO'));
create policy proyecto_incidencias_revision on public.proyecto_incidencias for update to authenticated
using((select proyectos_seguimiento_privado.rol_activo())='coordinador')
with check((select proyectos_seguimiento_privado.rol_activo())='coordinador');
create policy proyecto_evidencias_lectura on public.proyecto_evidencias for select to authenticated
using((select proyectos_seguimiento_privado.rol_activo()) in ('gerente','analista','coordinador'));
create policy proyecto_evidencias_registro on public.proyecto_evidencias for insert to authenticated
with check((select proyectos_seguimiento_privado.rol_activo()) in ('analista','coordinador') and creado_por=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('proyectos-evidencias','proyectos-evidencias',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy proyecto_fotos_lectura on storage.objects for select to authenticated using(
  bucket_id='proyectos-evidencias' and (select proyectos_seguimiento_privado.rol_activo()) in ('gerente','analista','coordinador')
  and exists(select 1 from public.proyectos p where p.id::text=(storage.foldername(name))[1] and p.activo));
create policy proyecto_fotos_carga on storage.objects for insert to authenticated with check(
  bucket_id='proyectos-evidencias' and (select proyectos_seguimiento_privado.rol_activo()) in ('analista','coordinador')
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  and exists(select 1 from public.proyectos p where p.id::text=(storage.foldername(name))[1] and p.activo and p.estado_obra<>'CANCELADO'));
create policy proyecto_fotos_limpiar_carga on storage.objects for delete to authenticated using(
  bucket_id='proyectos-evidencias' and (storage.foldername(name))[2]=(select auth.uid())::text
  and (select proyectos_seguimiento_privado.rol_activo()) in ('analista','coordinador')
  and not exists(select 1 from public.proyecto_evidencias e where e.ruta=name));

create function proyectos_seguimiento_privado.validar_evidencia() returns trigger
language plpgsql security invoker set search_path='' as $$
declare estado_actual text;
begin
  select estado_obra into estado_actual from public.proyectos where id=new.proyecto_id and activo for share;
  if estado_actual is null or estado_actual='CANCELADO' then raise exception 'El proyecto no admite evidencias'; end if;
  if new.etapa='PROCESO' and estado_actual not in ('EN_CONSTRUCCION','PAUSADO') then
    raise exception 'Las fotos del proceso corresponden a proyectos en construcción o pausados'; end if;
  if new.etapa='INSTALACION_FINAL' and estado_actual not in ('EN_CONSTRUCCION','PAUSADO','FINALIZADO') then
    raise exception 'Inicia la construcción antes de registrar la instalación final'; end if;
  new.creado_por:=auth.uid();
  select nombre into new.autor_nombre from public.perfiles where id=auth.uid() and estado::text='ACTIVO';
  new.created_at:=now();
  if new.ruta not like new.proyecto_id::text||'/'||auth.uid()::text||'/%'
    or not exists(select 1 from storage.objects where bucket_id='proyectos-evidencias' and name=new.ruta) then
    raise exception 'Primero carga una fotografía propia para este proyecto'; end if;
  return new;
end; $$;
create trigger validar_proyecto_evidencia before insert on public.proyecto_evidencias
for each row execute function proyectos_seguimiento_privado.validar_evidencia();

create function proyectos_seguimiento_privado.validar_avance() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.estado_obra<>'PLANIFICADO' or new.fecha_finalizacion is not null or new.revision_obra<>0 then
      raise exception 'Los proyectos nuevos empiezan como planificados'; end if;
    return new;
  end if;
  if row(new.estado_obra,new.fecha_finalizacion,new.revision_obra) is not distinct from
     row(old.estado_obra,old.fecha_finalizacion,old.revision_obra) then return new; end if;
  if coalesce(proyectos_seguimiento_privado.rol_activo(),'')<>'coordinador' then
    raise exception 'Solo el coordinador actualiza el avance del proyecto'; end if;
  if old.estado_obra in ('FINALIZADO','CANCELADO') then raise exception 'El proyecto ya está cerrado'; end if;
  if new.estado_obra='PLANIFICADO' and old.estado_obra<>'PLANIFICADO' then raise exception 'El proyecto ya inició su ejecución'; end if;
  if new.estado_obra='FINALIZADO' then
    if new.fecha_finalizacion is null or new.fecha_finalizacion>(now() at time zone 'America/Lima')::date then
      raise exception 'Indica una fecha de finalización válida, no futura'; end if;
    if not exists(select 1 from public.proyecto_evidencias where proyecto_id=new.id and etapa='INSTALACION_FINAL') then
      raise exception 'Adjunta al menos una foto de la instalación final antes de finalizar'; end if;
  elsif new.fecha_finalizacion is not null then raise exception 'La fecha de finalización corresponde a un proyecto finalizado'; end if;
  new.revision_obra:=old.revision_obra+1;
  return new;
end; $$;
create trigger validar_proyecto_avance before insert or update on public.proyectos
for each row execute function proyectos_seguimiento_privado.validar_avance();

create function proyectos_seguimiento_privado.validar_incidencia() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.proyectos; hoy date:=(now() at time zone 'America/Lima')::date;
begin
  if tg_op='INSERT' and coalesce(proyectos_seguimiento_privado.rol_activo(),'') not in ('analista','coordinador') then
    raise exception 'No tienes permiso para registrar incidencias'; end if;
  select * into p from public.proyectos where id=new.proyecto_id and activo for share;
  if p.id is null then raise exception 'Proyecto no disponible'; end if;
  if tg_op='INSERT' then
    if new.fecha_incidencia>hoy then raise exception 'La fecha de incidencia no puede ser futura'; end if;
    new.estado:='ABIERTA'; new.cobertura:='PENDIENTE'; new.revision:=0;
    new.creado_por:=auth.uid();
    select nombre into new.autor_nombre from public.perfiles where id=auth.uid() and estado::text='ACTIVO';
    new.created_at:=now(); new.updated_at:=now();
    new.garantia_hasta:=p.garantia_hasta;
    new.plazo_garantia:=case when p.fecha_finalizacion is null or new.fecha_incidencia<p.fecha_finalizacion then 'SIN_INICIO'
      when new.fecha_incidencia<=p.garantia_hasta then 'DENTRO' else 'FUERA' end;
  else
    if old.estado in ('RESUELTA','RECHAZADA') then raise exception 'La incidencia ya está cerrada'; end if;
    if new.estado='ABIERTA' and old.estado<>'ABIERTA' then raise exception 'La incidencia ya está en revisión'; end if;
    if new.cobertura='CUBIERTA' and new.plazo_garantia<>'DENTRO' then raise exception 'La incidencia está fuera del plazo de garantía'; end if;
    if new.estado in ('PROGRAMADA','EN_ATENCION','RESUELTA','RECHAZADA') and new.cobertura='PENDIENTE' then
      raise exception 'Primero revisa la cobertura de garantía'; end if;
    if new.estado='PROGRAMADA' and (new.fecha_atencion is null or new.fecha_atencion<hoy) then
      raise exception 'Indica una fecha de atención vigente'; end if;
    if new.estado in ('RESUELTA','RECHAZADA') and nullif(btrim(new.resolucion),'') is null then
      raise exception 'Describe la resolución o el motivo de rechazo'; end if;
    if new.requerimiento_id is not null and not exists(select 1 from public.requerimientos r where r.id=new.requerimiento_id and r.proyecto_id=new.proyecto_id) then
      raise exception 'El requerimiento debe pertenecer a este proyecto'; end if;
    new.actualizado_por:=auth.uid();
    select nombre into new.revisor_nombre from public.perfiles where id=auth.uid();
    new.updated_at:=now(); new.revision:=old.revision+1;
  end if;
  return new;
end; $$;
create trigger validar_proyecto_incidencia before insert or update on public.proyecto_incidencias
for each row execute function proyectos_seguimiento_privado.validar_incidencia();

revoke all on function proyectos_seguimiento_privado.validar_evidencia(),proyectos_seguimiento_privado.validar_avance(),proyectos_seguimiento_privado.validar_incidencia() from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.proyecto_evidencias,public.proyecto_incidencias;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
