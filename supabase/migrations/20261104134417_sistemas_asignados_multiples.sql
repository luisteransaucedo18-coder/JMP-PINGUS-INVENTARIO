begin;
alter table public.sistemas_tareas add column asignados uuid[] not null default '{}';
update public.sistemas_tareas set asignados=array[responsable] where responsable is not null;
create function public.validar_asignados_sistemas() returns trigger language plpgsql security invoker set search_path='' as $$
declare validar boolean;
begin
 if TG_OP='INSERT' then
  if cardinality(NEW.asignados)=0 and NEW.responsable is not null then NEW.asignados=array[NEW.responsable]; end if;
  validar:=true;
 else
  if NEW.asignados is not distinct from OLD.asignados and NEW.responsable is distinct from OLD.responsable then
   NEW.asignados:=case when NEW.responsable is null then '{}'::uuid[] else array[NEW.responsable] end;
  end if;
  validar:=NEW.asignados is distinct from OLD.asignados;
 end if;
 if validar then
  if NEW.asignados is null or cardinality(NEW.asignados)>50 or exists(select 1 from unnest(NEW.asignados) a(id) where id is null)
    or cardinality(NEW.asignados)<>(select count(distinct id) from unnest(NEW.asignados) a(id)) then raise exception 'La lista de asignados no es válida'; end if;
  if cardinality(NEW.asignados)<>(select count(*) from public.perfiles where id=any(NEW.asignados) and estado::text='ACTIVO') then raise exception 'Solo puedes asignar usuarios activos del sistema'; end if;
 end if;
 NEW.responsable:=NEW.asignados[1];
 return NEW;
end $$;
revoke all on function public.validar_asignados_sistemas() from public,anon;
grant execute on function public.validar_asignados_sistemas() to authenticated;
create trigger validar_asignados_sistemas before insert or update on public.sistemas_tareas for each row execute function public.validar_asignados_sistemas();
create index sistemas_tareas_asignados_idx on public.sistemas_tareas using gin(asignados);
commit;
