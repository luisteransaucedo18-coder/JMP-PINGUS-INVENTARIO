-- Keep the street address in the quote snapshot and inherit the full location
-- in the request, including PDFs and existing downstream delivery screens.
create function proyecto_cotizaciones_privado.direccion_cotizada(proyecto jsonb, presupuesto jsonb)
returns text language sql immutable security invoker set search_path = '' as $$
 select concat_ws(' — ',
  nullif(btrim(proyecto->>'ubicacion'), ''),
  nullif(concat_ws(' / ',
   nullif(presupuesto->'excel'->>'departamento', ''),
   nullif(presupuesto->'excel'->>'provincia', ''),
   coalesce(nullif(presupuesto->'excel'->>'distrito', ''), nullif(presupuesto->>'ciudad', ''))
  ), '')
 );
$$;
revoke all on function proyecto_cotizaciones_privado.direccion_cotizada(jsonb,jsonb) from public,anon,authenticated;

-- Patch only the inherited location expression; retain the current operation's
-- authorization, concurrency controls, stock accounting and idempotency.
do $$
declare definition text; old_expression text := '''ubicacion'',q.proyecto_snapshot->>''ubicacion''';
begin
 definition := pg_get_functiondef('proyecto_cotizaciones_privado.operar(text,uuid,jsonb)'::regprocedure);
 if position(old_expression in definition) = 0 then
  raise exception 'No se encontró la ubicación heredada del requerimiento';
 end if;
 execute replace(definition, old_expression,
  '''ubicacion'',proyecto_cotizaciones_privado.direccion_cotizada(q.proyecto_snapshot,q.presupuesto)');
end $$;
