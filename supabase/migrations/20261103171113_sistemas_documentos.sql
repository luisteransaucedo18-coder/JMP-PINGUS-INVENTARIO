begin;
create table public.sistemas_documentos (
 id uuid primary key default gen_random_uuid(),
 tarea_id uuid not null references public.sistemas_tareas(id),
 nombre text not null check(length(nombre) between 1 and 255),
 ruta text not null unique,
 tamano integer not null check(tamano between 1 and 20971520),
 autor uuid not null default auth.uid() references public.perfiles(id),
 created_at timestamptz not null default now(),
 check(ruta like tarea_id::text||'/'||autor::text||'/%')
);
create index sistemas_documentos_tarea_idx on public.sistemas_documentos(tarea_id);
create index sistemas_documentos_autor_idx on public.sistemas_documentos(autor);
alter table public.sistemas_documentos enable row level security;
create policy documentos_leer on public.sistemas_documentos for select to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy documentos_crear on public.sistemas_documentos for insert to authenticated with check(autor=(select auth.uid()) and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy documentos_eliminar on public.sistemas_documentos for delete to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
grant select,insert,delete on public.sistemas_documentos to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sistemas-documentos','sistemas-documentos',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv','image/jpeg','image/png']);
create policy sistemas_archivos_leer on storage.objects for select to authenticated using(
 bucket_id='sistemas-documentos' and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy sistemas_archivos_subir on storage.objects for insert to authenticated with check(
 bucket_id='sistemas-documentos' and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.sistemas_tareas where id::text=(storage.foldername(name))[1])
 and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy sistemas_archivos_eliminar on storage.objects for delete to authenticated using(
 bucket_id='sistemas-documentos' and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
commit;
