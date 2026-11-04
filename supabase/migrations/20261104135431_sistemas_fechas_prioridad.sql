begin;
alter table public.sistemas_tareas
 add column fecha_inicio date,
 alter column prioridad drop not null,
 add constraint sistemas_tareas_rango_fechas check(fecha_inicio is null or fecha_objetivo is null or fecha_inicio<=fecha_objetivo);
commit;
