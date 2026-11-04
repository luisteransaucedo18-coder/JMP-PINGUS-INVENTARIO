begin;
create table public.sistemas_listas (
 id uuid primary key default gen_random_uuid(),
 tarea_id uuid not null references public.sistemas_tareas(id) on delete cascade,
 titulo text not null check(length(btrim(titulo)) between 1 and 150),
 creado_por uuid not null default auth.uid() references public.perfiles(id),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),
 unique(id,tarea_id)
);
create table public.sistemas_pasos (
 id uuid primary key default gen_random_uuid(),
 tarea_id uuid not null references public.sistemas_tareas(id) on delete cascade,
 lista_id uuid,
 tipo text not null check(tipo in ('SUBTAREA','CONTROL')),
 titulo text not null check(length(btrim(titulo)) between 1 and 200),
 completado boolean not null default false,
 creado_por uuid not null default auth.uid() references public.perfiles(id),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),
 foreign key(lista_id,tarea_id) references public.sistemas_listas(id,tarea_id) on delete cascade,
 check((tipo='CONTROL')=(lista_id is not null))
);
create index sistemas_listas_tarea_idx on public.sistemas_listas(tarea_id,created_at);
create index sistemas_listas_autor_idx on public.sistemas_listas(creado_por);
create index sistemas_pasos_tarea_idx on public.sistemas_pasos(tarea_id,created_at);
create index sistemas_pasos_lista_idx on public.sistemas_pasos(lista_id,tarea_id);
create index sistemas_pasos_autor_idx on public.sistemas_pasos(creado_por);
alter table public.sistemas_listas enable row level security;
alter table public.sistemas_pasos enable row level security;
do $$
declare tabla text;
begin
 foreach tabla in array array['sistemas_listas','sistemas_pasos'] loop
  execute format('create policy leer on public.%I for select to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text=''ACTIVO''))',tabla);
  execute format('create policy crear on public.%I for insert to authenticated with check(creado_por=(select auth.uid()) and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text=''ACTIVO''))',tabla);
  execute format('create policy editar on public.%I for update to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text=''ACTIVO'')) with check(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text=''ACTIVO''))',tabla);
  execute format('create policy eliminar on public.%I for delete to authenticated using(exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text=''ACTIVO''))',tabla);
  execute format('grant select,insert,delete on public.%I to authenticated',tabla);
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tabla) then
   execute format('alter publication supabase_realtime add table public.%I',tabla);
  end if;
 end loop;
end $$;
grant update(titulo,revision) on public.sistemas_listas to authenticated;
grant update(titulo,completado,revision) on public.sistemas_pasos to authenticated;
commit;
