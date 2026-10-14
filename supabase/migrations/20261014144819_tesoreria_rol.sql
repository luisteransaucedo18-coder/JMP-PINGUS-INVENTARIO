-- Separate transaction: PostgreSQL must commit a new enum value before using it.
alter type public.rol_usuario add value if not exists 'tesoreria';
