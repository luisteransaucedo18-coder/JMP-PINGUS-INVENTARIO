begin;
alter table public.sistemas_comentarios add constraint sistemas_comentarios_id_tarea_unique unique(id,tarea_id);
alter table public.sistemas_documentos add column comentario_id uuid;
alter table public.sistemas_documentos add constraint sistemas_documentos_comentario_fk foreign key(comentario_id,tarea_id) references public.sistemas_comentarios(id,tarea_id);
create index sistemas_documentos_comentario_idx on public.sistemas_documentos(comentario_id,tarea_id);
-- Preserve existing files by moving them into comments with their original author and date.
do $$
declare doc record; comentario uuid;
begin
 for doc in select * from public.sistemas_documentos where comentario_id is null loop
  comentario := gen_random_uuid();
  insert into public.sistemas_comentarios(id,tarea_id,autor,contenido,created_at)
   values(comentario,doc.tarea_id,doc.autor,'Archivo adjunto',doc.created_at);
  update public.sistemas_documentos set comentario_id=comentario where id=doc.id;
 end loop;
end $$;
alter table public.sistemas_comentarios drop constraint sistemas_comentarios_contenido_check;
alter table public.sistemas_comentarios add constraint sistemas_comentarios_contenido_check check(length(btrim(contenido))<=3000);
grant update(comentario_id) on public.sistemas_documentos to authenticated;
create policy documentos_vincular on public.sistemas_documentos for update to authenticated
 using(autor=(select auth.uid()) and comentario_id is null and exists(select 1 from public.perfiles where id=(select auth.uid()) and estado::text='ACTIVO'))
 with check(autor=(select auth.uid()) and exists(select 1 from public.sistemas_comentarios c where c.id=comentario_id and c.tarea_id=sistemas_documentos.tarea_id and c.autor=(select auth.uid())));
create function public.publicar_comentario_sistemas(p_id uuid,p_tarea uuid,p_contenido text,p_documentos uuid[] default '{}')
returns public.sistemas_comentarios language plpgsql security invoker set search_path='' as $$
declare resultado public.sistemas_comentarios; cantidad integer;
begin
 if not exists(select 1 from public.perfiles where id=auth.uid() and estado::text='ACTIVO') then raise exception 'Se requiere una sesión activa'; end if;
 if p_contenido is null or length(btrim(p_contenido))>3000 or (length(btrim(p_contenido))=0 and coalesce(cardinality(p_documentos),0)=0) then raise exception 'Escribe un comentario o adjunta un archivo'; end if;
 select * into resultado from public.sistemas_comentarios where id=p_id;
 if found then
  if resultado.autor<>auth.uid() or resultado.tarea_id<>p_tarea or resultado.contenido<>btrim(p_contenido) then raise exception 'El comentario ya existe con otro contenido'; end if;
  return resultado;
 end if;
 perform 1 from public.sistemas_documentos where id=any(p_documentos) for update;
 select count(*) into cantidad from public.sistemas_documentos where id=any(p_documentos) and tarea_id=p_tarea and autor=auth.uid() and comentario_id is null;
 if cantidad<>coalesce(cardinality(p_documentos),0) then raise exception 'Los archivos no están disponibles para este comentario'; end if;
 insert into public.sistemas_comentarios(id,tarea_id,contenido) values(p_id,p_tarea,btrim(p_contenido)) returning * into resultado;
 update public.sistemas_documentos set comentario_id=p_id where id=any(p_documentos);
 return resultado;
end $$;
revoke all on function public.publicar_comentario_sistemas(uuid,uuid,text,uuid[]) from public,anon;
grant execute on function public.publicar_comentario_sistemas(uuid,uuid,text,uuid[]) to authenticated;
commit;
