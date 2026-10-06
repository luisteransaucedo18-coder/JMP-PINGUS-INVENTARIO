-- Validate new/changed fields without rewriting or truncating historical data.
create schema if not exists validacion_campos_privado;
revoke all on schema validacion_campos_privado from public, anon, authenticated;

create function validacion_campos_privado.validar_fila() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare actual jsonb := to_jsonb(new); anterior jsonb; campo text; regla jsonb; valor jsonb; texto text; numero numeric;
begin
 if TG_OP = 'UPDATE' then anterior := to_jsonb(old); end if;
 for campo, regla in select key, value from jsonb_each(TG_ARGV[0]::jsonb) loop
  valor := actual -> campo;
  if TG_OP = 'UPDATE' and valor is not distinct from anterior -> campo then continue; end if;
  if valor is null or valor = 'null'::jsonb then continue; end if;
  if jsonb_typeof(regla) = 'number' then
   if jsonb_typeof(valor) <> 'string' then raise exception '%: ingresa texto.', campo; end if;
   texto := valor #>> '{}';
   if char_length(texto) > (regla #>> '{}')::integer then
    raise exception '%: máximo % caracteres.', campo, regla #>> '{}';
   end if;
   if campo = 'nombre' and btrim(texto) = '' then raise exception 'El nombre es requerido.'; end if;
  else
   if jsonb_typeof(valor) <> 'number' then raise exception '%: ingresa un número.', campo; end if;
   numero := (valor #>> '{}')::numeric;
   if not (numero >= (regla->>0)::numeric and numero <= (regla->>1)::numeric) then
    raise exception '%: número fuera del rango permitido.', campo;
   end if;
  end if;
 end loop;
 if TG_TABLE_NAME = 'proyecto_cotizaciones' and (TG_OP = 'INSERT' or actual->'proyecto_snapshot' is distinct from anterior->'proyecto_snapshot') then
  for campo, regla in select key,value from jsonb_each('{"nombre":100,"cliente":150,"responsable":150,"ubicacion":300}'::jsonb) loop
   valor := actual->'proyecto_snapshot'->campo;
   if jsonb_typeof(valor) is distinct from 'string' or btrim(valor #>> '{}') = '' then
    raise exception 'Proyecto: completa %.', campo;
   end if;
   if char_length(valor #>> '{}') > (regla #>> '{}')::integer then
    raise exception 'Proyecto, %: máximo % caracteres.', campo, regla #>> '{}';
   end if;
  end loop;
 end if;
 if TG_TABLE_NAME = 'entregas' and (TG_OP = 'INSERT' or actual->'dni_tecnico' is distinct from anterior->'dni_tecnico') then
  texto := coalesce(actual->>'dni_tecnico','');
  if texto <> '' and texto !~ '^[0-9]{8}$' then raise exception 'DNI: ingresa exactamente 8 dígitos.'; end if;
 end if;
 if TG_TABLE_NAME = 'perfiles' then
  if TG_OP = 'INSERT' or actual->'email' is distinct from anterior->'email' then
   if coalesce(actual->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo electrónico inválido.'; end if;
  end if;
  if TG_OP = 'INSERT' or actual->'telefono' is distinct from anterior->'telefono' then
   texto := coalesce(actual->>'telefono','');
   if texto <> '' and (texto !~ '^\+?[0-9 ()-]+$' or regexp_replace(texto,'[^0-9]','','g') !~ '^[0-9]{7,15}$') then
    raise exception 'Teléfono: ingresa entre 7 y 15 dígitos.';
   end if;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function validacion_campos_privado.validar_fila() from public, anon, authenticated;

create trigger validar_campos before insert or update on public.proyectos for each row
 execute function validacion_campos_privado.validar_fila('{"nombre":100,"cliente":150,"responsable":150,"ubicacion":300,"observaciones":1000}');
create trigger validar_campos before insert or update on public.proyecto_cotizaciones for each row
 execute function validacion_campos_privado.validar_fila('{"observaciones":1000,"cierre":1000,"importe_presentado":[0.01,100000000],"importe_aceptado":[0.01,100000000]}');
create trigger validar_campos before insert or update on public.cotizacion_plantillas for each row
 execute function validacion_campos_privado.validar_fila('{"nombre":100}');
create trigger validar_campos before insert or update on public.materiales for each row
 execute function validacion_campos_privado.validar_fila('{"sku":50,"nombre":150,"descripcion":1000,"unidad":20,"stock_minimo":[0,100000000],"precio_unitario":[0,100000000]}');
create trigger validar_campos before insert or update on public.inventario_sedes for each row
 execute function validacion_campos_privado.validar_fila('{"stock":[0,100000000]}');
create trigger validar_campos before insert or update on public.perfiles for each row
 execute function validacion_campos_privado.validar_fila('{"nombre":150,"email":254,"telefono":30,"cargo":120,"bio":1000}');
create trigger validar_campos before insert or update on public.entregas for each row
 execute function validacion_campos_privado.validar_fila('{"tecnico":150,"dni_tecnico":8,"observaciones":1000}');
create trigger validar_campos before insert or update on public.ordenes_compra for each row
 execute function validacion_campos_privado.validar_fila('{"motivo":1000,"observaciones":1000,"nota_compra":150}');
create trigger validar_campos before insert or update on public.requerimientos for each row
 execute function validacion_campos_privado.validar_fila('{"tecnico":150,"observaciones":1000}');
create trigger validar_campos before insert or update on public.traslados for each row
 execute function validacion_campos_privado.validar_fila('{"transportista":150,"guia":150,"numero_comprobante":150,"observaciones":1000,"costo":[0,999999999999.99]}');
create trigger validar_campos before insert or update on public.proyecto_gastos for each row
 execute function validacion_campos_privado.validar_fila('{"descripcion":150,"comprobante":300,"motivo_anulacion":1000,"monto":[0.01,100000000],"cantidad":[0.000001,100000000]}');
