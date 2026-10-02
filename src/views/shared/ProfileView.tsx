import { useEffect, useRef, useState } from 'react';
import UserAvatar from '../../components/UserAvatar';
import { useUserProfile } from '../../store/UserProfileContext';
import { guardarMiPerfil, type DatosPersonales } from '../../services/perfilService';
import { supabase } from '../../services/supabase';
import { PROFILE_PHOTO_BUCKET, validateProfilePhoto } from '../../utils/profilePhoto';
import { useAppStore } from '../../store/AppContext';
import { Role } from '../../domain/types';

const ROLE_LABEL: Record<Role, string> = { gerente: 'Gerente General', analista: 'Analista de Campo', coordinador: 'Coordinador de Almacén' };
const ROLE_COLOR: Record<Role, { bg: string; text: string; grad: string }> = {
  gerente:     { bg: '#F3E8FF', text: '#7C3AED', grad: 'linear-gradient(135deg,#7C3AED,#4F46E5)' },
  analista:    { bg: '#DBEAFE', text: '#2563EB', grad: 'linear-gradient(135deg,#2563EB,#06B6D4)' },
  coordinador: { bg: '#CCFBF1', text: '#059669', grad: 'linear-gradient(135deg,#059669,#2563EB)' },
};

interface Props { role: Role; userName: string; userEmail: string; onToast: (m: string) => void; }

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--surface-radius)', boxShadow: 'var(--surface-shadow)', padding: '18px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function ProfileView({ role, userName, userEmail, onToast }: Props) {
  const { state, refreshRemoteData } = useAppStore();
  const { profile, avatarUrl, avatarError, reloadAvatar, updateProfile } = useUserProfile();
  const rc = ROLE_COLOR[role];

  /* Stats from real data */
  const myReqs  = state.requerimientos.filter(r => r.analista === userName);
  const sent    = myReqs.filter(r => r.estado !== 'BORRADOR').length;
  const conf    = myReqs.filter(r => r.estado === 'CONFIRMADO').length;
  const drafts  = myReqs.filter(r => r.estado === 'BORRADOR').length;
  const tasa    = sent > 0 ? Math.round((conf / sent) * 100) : 0;

  /* Editable info */
  const [editing, setEditing] = useState(false);
  const storedForm = (): DatosPersonales => ({ nombre: profile.nombre, telefono: profile.telefono ?? '', cargo: profile.cargo ?? '', bio: profile.bio ?? '' });
  const [form, setForm] = useState<DatosPersonales>(storedForm);
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; extension: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validatingPhoto, setValidatingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const savePending = useRef(false);
  const selectionVersion = useRef(0);
  useEffect(() => {
    if (!pendingPhoto) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(pendingPhoto.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPhoto]);
  useEffect(() => { if (!editing) setForm(storedForm()); }, [profile, editing]);
  const [pwForm, setPwForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [pwVisible, setPwVisible] = useState({ actual: false, nueva: false, confirmar: false });
  const [pwError, setPwError] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'seguridad' | 'actividad'>('info');

  const cancelEdit = () => {
    selectionVersion.current++;
    setForm(storedForm()); setPendingPhoto(null); setEditing(false); setSaveError(''); setSaveSuccess(''); setValidatingPhoto(false);
    if (fileInput.current) fileInput.current.value = '';
  };
  const selectPhoto = async (file?: File) => {
    if (!file) return;
    const version = ++selectionVersion.current;
    setValidatingPhoto(true); setSaveError(''); setSaveSuccess('');
    try {
      const extension = await validateProfilePhoto(file);
      try { const bitmap = await createImageBitmap(file); bitmap.close(); }
      catch { throw new Error('La imagen está dañada o no se puede abrir. Selecciona otra foto.'); }
      if (version !== selectionVersion.current) return;
      setPendingPhoto({ file, extension }); setEditing(true); setActiveTab('info');
    } catch (error) {
      if (version === selectionVersion.current) setSaveError(error instanceof Error ? error.message : 'No se pudo abrir la imagen. Selecciona otra foto.');
    } finally {
      if (version === selectionVersion.current) setValidatingPhoto(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const handleSave = async () => {
    if (savePending.current || validatingPhoto) return;
    if (!form.nombre.trim()) { setSaveError('Ingresa tu nombre completo.'); return; }
    if (form.nombre.trim().length > 150 || form.telefono.length > 30 || form.cargo.length > 120 || form.bio.length > 1000) {
      setSaveError('Revisa la longitud de los campos antes de guardar.'); return;
    }
    savePending.current = true; setSaving(true); setSaveError(''); setSaveSuccess('');
    let uploadedPath: string | undefined;
    let committed = false;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== profile.id) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
      if (pendingPhoto) {
        await validateProfilePhoto(pendingPhoto.file);
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${pendingPhoto.extension}`;
        const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(uploadedPath, pendingPhoto.file, {
          contentType: pendingPhoto.file.type, cacheControl: '3600', upsert: false,
        });
        if (error) throw new Error('No se pudo subir la foto. Revisa tu conexión e inténtalo nuevamente.');
      }
      const saved = await guardarMiPerfil(form, uploadedPath);
      committed = true;
      updateProfile(saved); setPendingPhoto(null); setEditing(false);
      setSaveSuccess('Perfil actualizado correctamente.'); onToast('Perfil actualizado correctamente.');
      void refreshRemoteData();
      if (uploadedPath && profile.foto_path && profile.foto_path !== uploadedPath) {
        // Storage denies deletion of any photo still referenced by a saved profile.
        void supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([profile.foto_path]);
      }
    } catch (error) {
      if (uploadedPath && !committed) await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([uploadedPath]).catch(() => undefined);
      setSaveError(error instanceof Error ? error.message : 'No se pudo actualizar tu perfil. Inténtalo nuevamente.');
    } finally { savePending.current = false; setSaving(false); }
  };
  const handleEditToggle = () => {
    if (editing) { cancelEdit(); return; }
    setForm(storedForm()); setEditing(true); setActiveTab('info'); setSaveError(''); setSaveSuccess('');
  };
  const passwordPending = useRef(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const handlePwSave = async () => {
    if (passwordPending.current) return;
    setPwError('');
    if (!pwForm.actual) { setPwError('Ingresa tu contraseña actual'); return; }
    if (pwForm.nueva.length < 8) { setPwError('La nueva contraseña debe tener al menos 8 caracteres'); return; }
    if (pwForm.nueva !== pwForm.confirmar) { setPwError('Las contraseñas no coinciden'); return; }
    passwordPending.current = true; setSavingPassword(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== profile.id || !user.email) throw new Error('Inicia sesión nuevamente.');
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: pwForm.actual });
      if (reauthError) throw new Error('La contraseña actual es incorrecta.');
      const { error } = await supabase.auth.updateUser({ password: pwForm.nueva });
      if (error) throw new Error('No se pudo actualizar la contraseña. Revisa sus requisitos e inténtalo nuevamente.');
      setPwForm({ actual: '', nueva: '', confirmar: '' }); onToast('Contraseña actualizada correctamente');
    } catch (error) { setPwError(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.'); }
    finally { passwordPending.current = false; setSavingPassword(false); }
  };

  const recentActivity = [...state.requerimientos]
    .filter(r => r.analista === userName)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

  const ESTADO_COLOR: Record<string, string> = { CONFIRMADO: '#059669', ENVIADO: '#D97706', RECHAZADO: '#DC2626', BORRADOR: '#8B8FA8' };
  const ESTADO_BG:    Record<string, string> = { CONFIRMADO: '#CCFBF1', ENVIADO: '#FEF3C7', RECHAZADO: '#FEE2E2', BORRADOR: '#F4F4F5' };

  return (
    <div className="profile-view" style={{ padding: 28, overflowY: 'auto', flex: 1, background: 'transparent' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Hero card ── */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--surface-radius)', boxShadow: 'var(--surface-shadow)', overflow: 'hidden' }}>
          {/* Banner */}
          <div style={{ height: 110, background: rc.grad, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.12 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ position: 'absolute', width: 120 + i * 40, height: 120 + i * 40, borderRadius: '50%', border: '1px solid #fff', top: -60 + i * 10, right: -40 + i * 20, opacity: 0.5 }} />
              ))}
            </div>
          </div>

          <div className="profile-hero-content" style={{ padding: '0 32px 28px', position: 'relative' }}>
            {/* Avatar */}
            <div className="profile-identity-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: -40 }}>
              <div className="profile-avatar" style={{ width: 88, height: 88, borderRadius: '50%', background: rc.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: '#fff', border: '4px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                <UserAvatar name={profile.nombre} src={previewUrl ?? avatarUrl} />
              </div>
              <div className="profile-identity-copy" style={{ paddingBottom: 4, flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1D23', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{profile.nombre}</div>
                <div className="profile-identity-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <span style={{ background: rc.bg, color: rc.text, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{ROLE_LABEL[role]}</span>
                  <span style={{ fontSize: 12.5, color: '#8B8FA8' }}>{userEmail}</span>
                </div>
              </div>
              <button disabled={saving || validatingPhoto} className="btn btn-ghost profile-edit-button" style={{ fontSize: 12.5, flexShrink: 0, marginBottom: 4 }} onClick={handleEditToggle}>
                {editing ? 'Cancelar edición' : 'Editar perfil'}
              </button>
            </div>
          </div>
        </div>

        <div className="panel profile-photo-controls">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="Archivo de foto de perfil" hidden disabled={saving || validatingPhoto} onChange={event => void selectPhoto(event.target.files?.[0])} />
          <div><strong>Foto de perfil</strong><p>JPG, PNG o WebP · Máximo 5 MB</p>{pendingPhoto && <p className="profile-preview-note">Vista previa sin guardar: {pendingPhoto.file.name}</p>}</div>
          <button type="button" className="btn btn-ghost" disabled={saving || validatingPhoto} onClick={() => fileInput.current?.click()}>{validatingPhoto ? 'Validando foto…' : 'Seleccionar foto'}</button>
        </div>
        {saveError && <p className="profile-feedback profile-feedback-error" role="alert">{saveError}</p>}
        {saveSuccess && <p className="profile-feedback profile-feedback-success" role="status">{saveSuccess}</p>}
        {avatarError && <p className="profile-feedback profile-feedback-error" role="alert">{avatarError} <button type="button" onClick={reloadAvatar}>Volver a cargar foto</button></p>}

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatCard label="Requerimientos enviados"   value={sent}  color="#2563EB" />
          <StatCard label="Confirmados"                value={conf}  color="#059669" />
          <StatCard label="Borradores activos"         value={drafts} color="#D97706" />
          <StatCard label="Tasa de aprobación"         value={`${tasa}%`} color={tasa >= 70 ? '#059669' : tasa >= 40 ? '#D97706' : '#DC2626'} />
        </div>

        {/* ── Tab panel ── */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--surface-radius)', boxShadow: 'var(--surface-shadow)', overflow: 'hidden' }}>
          {/* Tabs */}
          <div className="profile-tabs" style={{ display: 'flex', borderBottom: '1px solid #F0F2FF', padding: '0 24px' }}>
            {([['info', 'Información personal'], ['seguridad', 'Seguridad'], ['actividad', 'Actividad reciente']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                padding: '16px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'none',
                color: activeTab === id ? '#2563EB' : '#8B8FA8',
                borderBottom: activeTab === id ? '2.5px solid #2563EB' : '2.5px solid transparent',
                transition: 'all 0.15s', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* ── Tab: Info ── */}
          {activeTab === 'info' && (
            <div style={{ padding: '28px 28px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { label: 'Nombre completo', key: 'nombre' as const, type: 'text', placeholder: 'Tu nombre y apellido' },
                  { label: 'Cargo',           key: 'cargo' as const,  type: 'text', placeholder: 'Tu cargo' },
                  { label: 'Teléfono',        key: 'telefono' as const, type: 'tel', placeholder: '+51 999 999 999' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label htmlFor={`profile-${key}`} style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>{label}</label>
                    {editing ? (
                      <input id={`profile-${key}`} disabled={saving} maxLength={key === 'nombre' ? 150 : key === 'telefono' ? 30 : 120} className="input-field" type={type} placeholder={placeholder}
                        value={form[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1D23', padding: '9px 0' }}>{form[key] || <span style={{ color: '#C4C6D8' }}>Sin definir</span>}</div>
                    )}
                  </div>
                ))}

                {/* Sede */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Sede principal</label>
                  <div className="profile-readonly-value">{profile.sede ?? 'Sin sede asignada'}</div>
                  <small className="profile-permission-note">Asignada por la administración.</small>
                </div>

                {/* Correo — read only */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Correo electrónico</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1D23' }}>{userEmail}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#059669', background: '#CCFBF1', padding: '2px 7px', borderRadius: 4 }}>Solo lectura</span>
                  </div>
                </div>

                {/* Bio — full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="profile-bio" style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', marginBottom: 7 }}>Biografía / nota</label>
                  {editing ? (
                    <textarea id="profile-bio" disabled={saving} maxLength={1000} className="input-field" rows={3} placeholder="Describe tu rol, especialidad o cualquier información relevante…"
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
                  ) : (
                    <div style={{ fontSize: 13.5, color: form.bio ? '#1A1D23' : '#C4C6D8', lineHeight: 1.6, padding: '6px 0' }}>
                      {form.bio || 'Sin descripción. Haz clic en "Editar perfil" para agregar una nota.'}
                    </div>
                  )}
                </div>
              </div>

              {editing && (
                <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                  <button type="button" disabled={saving} className="btn btn-ghost" onClick={cancelEdit}>Cancelar</button>
                  <button type="button" disabled={saving || validatingPhoto} aria-busy={saving} className="btn btn-primary" onClick={() => void handleSave()}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Seguridad ── */}
          {activeTab === 'seguridad' && (
            <div style={{ padding: '28px 28px 32px' }}>
              <div style={{ maxWidth: 440 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1D23', marginBottom: 6 }}>Cambiar contraseña</div>
                <div style={{ fontSize: 12.5, color: '#8B8FA8', marginBottom: 22 }}>Elige una contraseña segura de al menos 8 caracteres.</div>

                {[
                  { label: 'Contraseña actual', key: 'actual' as const },
                  { label: 'Nueva contraseña',  key: 'nueva'  as const },
                  { label: 'Confirmar nueva',   key: 'confirmar' as const },
                ].map(({ label, key }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label htmlFor={`profile-password-${key}`} style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', marginBottom: 7 }}>{label}</label>
                    <div style={{ position: 'relative' }}>
                      <input id={`profile-password-${key}`} disabled={savingPassword} autoComplete={key === 'actual' ? 'current-password' : 'new-password'} className="input-field"
                        type={pwVisible[key] ? 'text' : 'password'}
                        placeholder="••••••••"
                        style={{ paddingRight: 40 }}
                        value={pwForm[key]}
                        onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} />
                      <button type="button" aria-label={pwVisible[key] ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} onClick={() => setPwVisible(p => ({ ...p, [key]: !p[key] }))}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8B8FA8', padding: 0, fontSize: 12 }}>
                        {pwVisible[key]
          ? <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 1l13 13M6.3 6.4A2 2 0 009.6 9.7M4 4.2C2.5 5.2 1.6 6.3 1 7.5c1.5 3 4 5 6.5 5 1.2 0 2.4-.4 3.4-1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M10.5 10.6C12 9.5 13 8.3 14 7.5c-1.5-3-4-5-6.5-5-.8 0-1.7.2-2.4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          : <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 7.5C2.5 4.5 5 2.5 7.5 2.5S12.5 4.5 14 7.5C12.5 10.5 10 12.5 7.5 12.5S2.5 10.5 1 7.5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
        }
                      </button>
                    </div>
                  </div>
                ))}

                {pwError && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#DC2626', marginBottom: 16 }}>{pwError}</div>
                )}

                <button disabled={savingPassword} aria-busy={savingPassword} className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={() => void handlePwSave()}>{savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}</button>

                {/* Security info */}
                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #F0F2FF' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1D23', marginBottom: 14 }}>Información de sesión</div>
                  {[
                    { label: 'Último acceso',        value: profile.ultimo_acceso ? new Date(profile.ultimo_acceso).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Sin registro' },
                    { label: 'Rol asignado',          value: ROLE_LABEL[role] },
                    { label: 'Estado de la cuenta',   value: profile.estado === 'ACTIVO' ? 'Activa' : 'Inactiva' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F8F9FF' }}>
                      <span style={{ fontSize: 12.5, color: '#8B8FA8' }}>{label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1D23' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Actividad ── */}
          {activeTab === 'actividad' && (
            <div>
              {recentActivity.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#C4C6D8', fontSize: 13 }}>No hay actividad registrada aún.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8F9FF', borderBottom: '1px solid #F0F2FF' }}>
                        {['ID', 'Proyecto', 'Sede', 'Materiales', 'Fecha', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '12px 20px', fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #F8F9FF' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F9FF'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                          <td style={{ padding: '13px 20px', fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{r.id}</td>
                          <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 500, color: '#1A1D23', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</td>
                          <td style={{ padding: '13px 20px', fontSize: 12, color: '#8B8FA8' }}>{r.sede}</td>
                          <td style={{ padding: '13px 20px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{r.materiales.length}</td>
                          <td style={{ padding: '13px 20px', fontFamily: 'monospace', fontSize: 11, color: '#8B8FA8' }}>{r.fecha}</td>
                          <td style={{ padding: '13px 20px' }}>
                            <span className="status-badge" style={{ background: ESTADO_BG[r.estado], color: ESTADO_COLOR[r.estado] }}>{r.estado}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
