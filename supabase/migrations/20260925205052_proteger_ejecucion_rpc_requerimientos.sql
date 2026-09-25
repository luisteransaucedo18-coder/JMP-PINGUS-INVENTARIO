-- Las operaciones del flujo se invocan exclusivamente con una sesión autenticada.
revoke all on function public.crear_requerimiento(uuid, text, text, text, text, jsonb, boolean) from public, anon;
grant execute on function public.crear_requerimiento(uuid, text, text, text, text, jsonb, boolean) to authenticated;
