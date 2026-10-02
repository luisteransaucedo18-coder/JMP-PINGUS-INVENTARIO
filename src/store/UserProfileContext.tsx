import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Perfil } from '../services/perfilService';
import { supabase } from '../services/supabase';
import { PROFILE_PHOTO_BUCKET } from '../utils/profilePhoto';

type Value = { profile: Perfil; avatarUrl: string | null; avatarError: string; updateProfile: (profile: Perfil) => void; reloadAvatar: () => void };
const Context = createContext<Value | null>(null);
export function UserProfileProvider({ initialProfile, onChange, children }: { initialProfile: Perfil; onChange: (profile: Perfil) => void; children: ReactNode }) {
  const [profile, setProfile] = useState(initialProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarAttempt, setAvatarAttempt] = useState(0);
  const updateProfile = useCallback((next: Perfil) => { setProfile(next); onChange(next); }, [onChange]);
  useEffect(() => {
    let active = true;
    setAvatarUrl(null);
    setAvatarError('');
    if (!profile.foto_path) return;
    const load = async () => {
      const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(profile.foto_path!, 3600);
      if (!active) return;
      if (error) { setAvatarError('No se pudo cargar la foto guardada.'); return; }
      setAvatarError(''); setAvatarUrl(data.signedUrl);
    };
    void load();
    const timer = window.setInterval(() => void load(), 45 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [profile.foto_path, avatarAttempt]);
  return <Context.Provider value={{ profile, avatarUrl, avatarError, updateProfile, reloadAvatar: () => setAvatarAttempt(n => n + 1) }}>{children}</Context.Provider>;
}
export function useUserProfile() {
  const context = useContext(Context);
  if (!context) throw new Error('El perfil requiere una sesión autenticada.');
  return context;
}
