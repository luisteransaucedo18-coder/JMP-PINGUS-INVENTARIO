import { supabase } from '../service/supabase';

const { data: logo } = supabase.storage
  .from('JMP')
  .getPublicUrl('logo.png');

const { data: logoIcon } = supabase.storage
  .from('JMP')
  .getPublicUrl('logo-icon.png');

const { data: mascota } = supabase.storage
  .from('JMP')
  .getPublicUrl('mascota.png');

export const ASSETS = {
  logo: logo.publicUrl,
  logoIcon: logoIcon.publicUrl,
  mascota: mascota.publicUrl,
};