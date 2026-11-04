begin;
alter table public.sistemas_comentarios drop constraint sistemas_comentarios_tarea_id_fkey;
alter table public.sistemas_comentarios add constraint sistemas_comentarios_tarea_id_fkey
  foreign key(tarea_id) references public.sistemas_tareas(id) on delete cascade;
create policy tareas_eliminar on public.sistemas_tareas for delete to authenticated
  using (exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'));
grant delete on public.sistemas_tareas to authenticated;
commit;
