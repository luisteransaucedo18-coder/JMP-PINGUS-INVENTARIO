export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_BUCKET = 'fotos-perfil';
export async function validateProfilePhoto(file: File): Promise<'jpg' | 'png' | 'webp'> {
  if (file.size > MAX_PROFILE_PHOTO_BYTES) throw new Error('La foto debe pesar como máximo 5 MB.');
  if (!file.size) throw new Error('El archivo está vacío. Selecciona una foto válida.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b);
  const webp = String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (file.type === 'image/jpeg' && /\.jpe?g$/i.test(file.name) && jpg) return 'jpg';
  if (file.type === 'image/png' && /\.png$/i.test(file.name) && png) return 'png';
  if (file.type === 'image/webp' && /\.webp$/i.test(file.name) && webp) return 'webp';
  throw new Error('Selecciona una imagen JPG, PNG o WebP válida.');
}
