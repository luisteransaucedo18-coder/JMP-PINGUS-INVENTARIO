begin;
alter table public.sistemas_pasos
 add column responsable uuid references public.perfiles(id),
 add column fecha_objetivo date,
 add column prioridad text not null default 'Media' check(prioridad in ('Baja','Media','Alta','Urgente'));
create index sistemas_pasos_responsable_idx on public.sistemas_pasos(responsable);
grant update(responsable,fecha_objetivo,prioridad) on public.sistemas_pasos to authenticated;
commit;
