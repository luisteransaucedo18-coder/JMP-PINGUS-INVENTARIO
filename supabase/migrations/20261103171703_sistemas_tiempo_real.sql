begin;
do $$
declare tabla text;
begin
  foreach tabla in array array['sistemas_tareas','sistemas_comentarios','sistemas_documentos'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tabla) then
      execute format('alter publication supabase_realtime add table public.%I',tabla);
    end if;
  end loop;
end $$;
commit;
