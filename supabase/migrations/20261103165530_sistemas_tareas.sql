begin;
create table public.sistemas_tareas (
 id uuid primary key default gen_random_uuid(),
 titulo text not null check(length(btrim(titulo)) between 1 and 200),
 capa text not null default '' check(length(capa)<=100),
 rol text not null default '' check(length(rol)<=100),
 estado text not null default 'Pendiente' check(estado in ('Pendiente','En curso','En revisión','Completado','Cancelado')),
 prioridad text not null default 'Media' check(prioridad in ('Baja','Media','Alta','Urgente')),
 responsable uuid references public.perfiles(id),
 fecha_objetivo date,
 notas text not null default '' check(length(notas)<=10000),
 creado_por uuid not null default auth.uid() references public.perfiles(id),
 revision integer not null default 0,
 created_at timestamptz not null default now()
);
create index sistemas_tareas_responsable_idx on public.sistemas_tareas(responsable);
create index sistemas_tareas_creador_idx on public.sistemas_tareas(creado_por);
create table public.sistemas_comentarios (
 id uuid primary key default gen_random_uuid(),
 tarea_id uuid not null references public.sistemas_tareas(id),
 autor uuid not null default auth.uid() references public.perfiles(id),
 contenido text not null check(length(btrim(contenido)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index sistemas_comentarios_tarea_idx on public.sistemas_comentarios(tarea_id,created_at);
create index sistemas_comentarios_autor_idx on public.sistemas_comentarios(autor);
alter table public.sistemas_tareas enable row level security;
alter table public.sistemas_comentarios enable row level security;
create policy tareas_leer on public.sistemas_tareas for select to authenticated using (exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy tareas_crear on public.sistemas_tareas for insert to authenticated with check(creado_por=(select auth.uid()) and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy tareas_editar on public.sistemas_tareas for update to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO')) with check(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy comentarios_leer on public.sistemas_comentarios for select to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
create policy comentarios_crear on public.sistemas_comentarios for insert to authenticated with check(autor=(select auth.uid()) and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
grant select,insert,update on public.sistemas_tareas to authenticated;
grant select,insert on public.sistemas_comentarios to authenticated;
commit;
