-- Private avatars: immutable object names avoid cache collisions and failed-save replacement.
alter table public.perfiles add column if not exists foto_path text;
alter table public.perfiles add column if not exists foto_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy foto_propia_insert on storage.objects for insert to authenticated
with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
  and exists (select 1 from public.perfiles where id = (select auth.uid()) and estado = 'ACTIVO'));
create policy foto_propia_select on storage.objects for select to authenticated
using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.perfiles where id = (select auth.uid()) and estado = 'ACTIVO'));
create policy foto_propia_delete on storage.objects for delete to authenticated
using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.perfiles where id = (select auth.uid()) and estado = 'ACTIVO')
  and not exists (select 1 from public.perfiles where foto_path = storage.objects.name));

create schema if not exists perfil_privado;
revoke all on schema perfil_privado from public, anon;
create function perfil_privado.validar_foto() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.foto_path, new.foto_url) is not distinct from (old.foto_path, old.foto_url) then return new; end if;
  if auth.uid() is null or auth.uid() <> new.id then raise exception 'Solo puedes modificar tu propia foto'; end if;
  if new.foto_path is null or new.foto_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
    or new.foto_url is distinct from ('/storage/v1/object/authenticated/fotos-perfil/' || new.foto_path)
    or not exists (select 1 from storage.objects where bucket_id = 'fotos-perfil' and name = new.foto_path)
    then raise exception 'La foto debe ser un archivo propio de Storage'; end if;
  return new;
end $$;
revoke all on function perfil_privado.validar_foto() from public, anon, authenticated;
create trigger validar_foto_perfil before update of foto_path, foto_url on public.perfiles
for each row execute function perfil_privado.validar_foto();

-- No user id, role, sede, account state or email parameters: this API edits only the caller.
create function public.actualizar_mi_perfil(p_nombre text, p_telefono text, p_cargo text, p_bio text, p_foto_path text default null)
returns setof public.perfiles language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para actualizar tu perfil'; end if;
  if nullif(btrim(p_nombre),'') is null or length(btrim(p_nombre)) > 150
    or length(coalesce(p_telefono,'')) > 30 or length(coalesce(p_cargo,'')) > 120
    or length(coalesce(p_bio,'')) > 1000 then raise exception 'Revisa los campos de tu perfil'; end if;
  return query update public.perfiles set nombre = btrim(p_nombre),
    telefono = nullif(btrim(p_telefono),''), cargo = nullif(btrim(p_cargo),''), bio = nullif(btrim(p_bio),''),
    foto_path = coalesce(p_foto_path, foto_path),
    foto_url = case when p_foto_path is null then foto_url else '/storage/v1/object/authenticated/fotos-perfil/' || p_foto_path end,
    updated_at = now() where id = auth.uid() and estado = 'ACTIVO' returning *;
  if not found then raise exception 'No se pudo actualizar tu perfil activo'; end if;
end $$;
revoke all on function public.actualizar_mi_perfil(text,text,text,text,text) from public, anon;
grant execute on function public.actualizar_mi_perfil(text,text,text,text,text) to authenticated;
