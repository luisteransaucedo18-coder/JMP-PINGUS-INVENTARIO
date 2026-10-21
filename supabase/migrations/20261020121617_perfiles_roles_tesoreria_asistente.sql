-- Roles admitidos por public.perfiles.rol; no modifica usuarios ni permisos.
alter type public.rol_usuario add value if not exists 'tesoreria';
alter type public.rol_usuario add value if not exists 'asistente';
