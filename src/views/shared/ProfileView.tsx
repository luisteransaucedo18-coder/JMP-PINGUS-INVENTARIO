import DataDetails from '../../components/DataDetails';
import { authErrorMessage, isInvalidCredentials } from '../../utils/authErrors';
import FieldError from "../../components/FieldError";
import { ownedBy } from "../../utils/recordOwner";
import { publicCode } from "../../utils/publicCode";
import { useEffect, useRef, useState } from 'react';
import ProfilePhotoEditor from '../../components/ProfilePhotoEditor';
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

export default function ProfileView({ role, userEmail, onToast }: Props) {
  const { state, refreshRemoteData } = useAppStore();
  const { profile, avatarUrl, avatarError, reloadAvatar, updateProfile } = useUserProfile();
  const rc = ROLE_COLOR[role];

  /* Stats from real data */
  const myReqs  = state.requerimientos.filter(r => ownedBy(r, profile));
  const sent    = myReqs.filter(r => r.estado !== 'BORRADOR').length;
  const conf    = myReqs.filter(r => r.estado === 'CONFIRMADO').length;
  const drafts  = myReqs.filter(r => r.estado === 'BORRADOR').length;
  const tasa    = sent > 0 ? Math.round((conf / sent) * 100) : 0;

  /* Editable info */
  const [editing, setEditing] = useState(false);
  const storedForm = (): DatosPersonales => ({ nombre: profile.nombre, telefono: profile.telefono ?? '', cargo: profile.cargo ?? '', bio: profile.bio ?? '' });
  const [form, setForm] = useState<DatosPersonales>(storedForm);
  const [photoSource, setPhotoSource] = useState<File | null>(null);
  const [validatingPhoto, setValidatingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const savePending = useRef(false);
  const selectionVersion = useRef(0);
  useEffect(() => { if (!editing) setForm(storedForm()); }, [profile, editing]);
  const [pwForm, setPwForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [pwVisible, setPwVisible] = useState({ actual: false, nueva: false, confirmar: false });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'seguridad' | 'actividad'>('actividad');

  const cancelEdit = () => {
    selectionVersion.current++;
    setForm(storedForm()); setEditing(false); setProfileWarnings({}); setSaveError(''); setSaveSuccess(''); setValidatingPhoto(false);
    if (fileInput.current) fileInput.current.value = '';
  };
  const selectPhoto = async (file?: File) => {
    if (!file) return;
    const version = ++selectionVersion.current;
    setValidatingPhoto(true); setSaveError(''); setSaveSuccess('');
    try {
      await validateProfilePhoto(file);
      try { const bitmap = await createImageBitmap(file); bitmap.close(); }
      catch { throw new Error('La imagen está dañada o no se puede abrir. Selecciona otra foto.'); }
      if (version !== selectionVersion.current) return;
      setPhotoSource(file);
    } catch (error) {
      if (version === selectionVersion.current) setSaveError(error instanceof Error ? error.message : 'No se pudo abrir la imagen. Selecciona otra foto.');
    } finally {
      if (version === selectionVersion.current) setValidatingPhoto(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const [profileWarnings, setProfileWarnings] = useState<Record<string,string>>({});
  const [passwordWarnings, setPasswordWarnings] = useState<Record<string,string>>({});
  const handleSave = async (photo?: File): Promise<boolean> => {
    const fields = photo ? storedForm() : form;
    if (savePending.current || validatingPhoto) return false;
    const warnings: Record<string,string> = {};
    if (!fields.nombre.trim()) warnings.nombre = 'Completa tu nombre.';
    for (const [key, max] of [['nombre',150],['telefono',30],['cargo',120],['bio',1000]] as const) if(fields[key].length>max) warnings[key] = `Usa como máximo ${max} caracteres.`;
    setProfileWarnings(warnings);
    if(Object.keys(warnings).length) { document.getElementById(`profile-${Object.keys(warnings)[0]}`)?.focus(); return false; }
    savePending.current = true; setSaving(true); setSaveError(''); setSaveSuccess('');
    let uploadedPath: string | undefined;
    let committed = false;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== profile.id) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
      if (photo) {
        const extension = await validateProfilePhoto(photo);
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(uploadedPath, photo, {
          contentType: photo.type, cacheControl: '3600', upsert: false,
        });
        if (error) throw new Error('No se pudo subir la foto. Revisa tu conexión e inténtalo nuevamente.');
      }
      const saved = await guardarMiPerfil(fields, uploadedPath);
      committed = true;
      updateProfile(saved); if (!photo) setEditing(false);
      const message = photo ? 'Foto de perfil actualizada.' : 'Datos personales actualizados.';
      setSaveSuccess(message); onToast(message);
      void refreshRemoteData();
      if (uploadedPath && profile.foto_path && profile.foto_path !== uploadedPath) {
        // Storage denies deletion of any photo still referenced by a saved profile.
        void supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([profile.foto_path]);
      }
      return true;
    } catch (error) {
      if (uploadedPath && !committed) await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([uploadedPath]).catch(() => undefined);
      setSaveError(error instanceof Error ? error.message : 'No se pudo actualizar tu perfil. Inténtalo nuevamente.');
      return false;
    } finally { savePending.current = false; setSaving(false); }
  };
  const handleEditToggle = () => {
    setForm(storedForm()); setEditing(true); setActiveTab('info'); setSaveError(''); setSaveSuccess('');
  };
  const passwordPending = useRef(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const handlePwSave = async () => {
    if (passwordPending.current) return;
    setPwError(''); setPwSuccess('');
    const warnings: Record<string,string> = {};
    if(!pwForm.actual) warnings.actual = 'Completa la contraseña actual.';
    if(pwForm.nueva.length<8) warnings.nueva = 'Ingresa al menos 8 caracteres.';
    if(!pwForm.confirmar) warnings.confirmar = 'Confirma la nueva contraseña.';
    else if(pwForm.nueva!==pwForm.confirmar) warnings.confirmar = 'La confirmación debe coincidir con la nueva contraseña.';
    setPasswordWarnings(warnings);
    if(Object.keys(warnings).length) { document.getElementById(`profile-password-${Object.keys(warnings)[0]}`)?.focus(); return; }
    passwordPending.current = true; setSavingPassword(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== profile.id || !user.email) throw new Error('Inicia sesión nuevamente.');
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: pwForm.actual });
      if (reauthError) {
        if (isInvalidCredentials(reauthError)) setPasswordWarnings({ actual: 'La contraseña actual es incorrecta.' });
        else setPwError(authErrorMessage(reauthError));
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwForm.nueva });
      if (error) throw new Error('No se pudo actualizar la contraseña. Revisa sus requisitos e inténtalo nuevamente.');
      setPwForm({ actual: '', nueva: '', confirmar: '' }); setPwVisible({ actual: false, nueva: false, confirmar: false }); setPwSuccess('Contraseña actualizada correctamente.'); onToast('Contraseña actualizada correctamente');
    } catch (error) { setPwError(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.'); }
    finally { passwordPending.current = false; setSavingPassword(false); }
  };

  const recentActivity = [...state.requerimientos]
    .filter(r => ownedBy(r, profile))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

  const ESTADO_COLOR: Record<string, string> = { CONFIRMADO: '#059669', ENVIADO: '#D97706', RECHAZADO: '#DC2626', BORRADOR: '#8B8FA8' };
  const ESTADO_BG:    Record<string, string> = { CONFIRMADO: '#CCFBF1', ENVIADO: '#FEF3C7', RECHAZADO: '#FEE2E2', BORRADOR: '#F4F4F5' };

  const openSettings = () => {
    if (editing) setActiveTab('info');
    else handleEditToggle();
  };
  return (
    <div className="profile-view profile-redesign">
      <div className="profile-layout">
        <aside className="profile-person-card">
          <div className="profile-person-accent" style={{ background: rc.grad }} />
          <button type="button" className="profile-avatar-trigger" disabled={saving || validatingPhoto || savingPassword} onClick={() => { setSaveError(''); fileInput.current?.click(); }} aria-label="Cambiar foto de perfil" title="Cambiar foto de perfil">
            <span className="profile-avatar" style={{ background: rc.grad }}><UserAvatar name={profile.nombre} src={avatarUrl} /></span>
            <span className="profile-avatar-pencil" aria-hidden="true">✎</span>
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="Archivo de foto de perfil" hidden disabled={saving || validatingPhoto} onChange={event => void selectPhoto(event.target.files?.[0])} />
          <span className="profile-photo-hint">{validatingPhoto ? 'Validando foto…' : 'Haz clic en tu foto para cambiarla'}</span>
          <div className="profile-identity-copy"><h2>{profile.nombre}</h2><span className="profile-role-chip" style={{ background: rc.bg, color: rc.text }}>{ROLE_LABEL[role]}</span></div>
          <button className="btn btn-primary profile-settings-button" disabled={saving || savingPassword} onClick={openSettings}>⚙ Configuración</button>
          <DataDetails className="data-details-compact profile-account-details" fields={[
            { label: 'Correo electrónico', value: userEmail },
            { label: 'Teléfono', value: profile.telefono || 'Sin completar' },
            { label: 'Cargo', value: profile.cargo || 'Sin completar' },
            { label: 'Sede principal', value: profile.sede || 'Sin sede asignada' },
          ]} />
          {profile.bio && <div className="profile-person-bio"><h3>Sobre mí</h3><p>{profile.bio}</p></div>}
          {(!profile.telefono || !profile.cargo) && <button className="profile-complete-link" disabled={saving || savingPassword} onClick={openSettings}>Completar mis datos</button>}
          <span className="profile-account-state"><span aria-hidden="true" />{profile.estado === 'ACTIVO' ? 'Cuenta activa' : 'Cuenta inactiva'}</span>
        </aside>
        <div className="profile-main-column">
          {saveError && !photoSource && <p className="profile-feedback profile-feedback-error" role="alert">{saveError}</p>}
          {saveSuccess && <p className="profile-feedback profile-feedback-success" role="status">{saveSuccess}</p>}
          {avatarError && <p className="profile-feedback profile-feedback-error" role="alert">{avatarError} <button type="button" onClick={reloadAvatar}>Volver a cargar foto</button></p>}
          <div className="profile-summary-grid">
            <StatCard label="Requerimientos enviados" value={sent} color="#2563EB" />
            <StatCard label="Confirmados" value={conf} color="#059669" />
            <StatCard label="Borradores" value={drafts} color="#D97706" />
          </div>
          <section className="profile-content-card">
            <nav className="profile-section-nav" aria-label="Secciones del perfil">
              <button type="button" aria-current={activeTab === 'actividad' ? 'page' : undefined} disabled={saving || savingPassword} onClick={() => setActiveTab('actividad')}>Mi actividad</button>
              <button type="button" aria-current={activeTab !== 'actividad' ? 'page' : undefined} disabled={saving || savingPassword} onClick={() => { if (!editing) handleEditToggle(); else setActiveTab('info'); }}>Configuración</button>
            </nav>
            {activeTab !== 'actividad' && <nav className="profile-settings-nav" aria-label="Configuración del perfil">
              <button type="button" disabled={saving || savingPassword} aria-current={activeTab === 'info' ? 'page' : undefined} onClick={() => { setEditing(true); setActiveTab('info'); }}>Datos personales</button>
              <button type="button" disabled={saving || savingPassword} aria-current={activeTab === 'seguridad' ? 'page' : undefined} onClick={() => setActiveTab('seguridad')}>Contraseña</button>
            </nav>}
          {/* ── Tab: Info ── */}
          {activeTab === 'info' && (
            <form className="profile-settings-form" onSubmit={event => { event.preventDefault(); void handleSave(); }}>
              <h2>Datos personales</h2><p className="profile-section-help">Completa tu información de contacto. El correo, el rol y la sede son administrados por JIP.</p><div className="profile-fields-grid">
                {[
                  { label: 'Nombre completo', key: 'nombre' as const, type: 'text', placeholder: 'Tu nombre y apellido' },
                  { label: 'Cargo',           key: 'cargo' as const,  type: 'text', placeholder: 'Tu cargo' },
                  { label: 'Teléfono',        key: 'telefono' as const, type: 'tel', placeholder: '+51 999 999 999' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label htmlFor={`profile-${key}`} style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', marginBottom: 7 }}>{label}</label>
                    {editing ? (
                      <><input aria-invalid={profileWarnings[key] ? true : undefined} aria-describedby={profileWarnings[key] ? `profile-${key}-error` : undefined} id={`profile-${key}`} disabled={saving} maxLength={key === 'nombre' ? 150 : key === 'telefono' ? 30 : 120} className="input-field" type={type} placeholder={placeholder}
                        value={form[key]}
                        onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setProfileWarnings(p => { const next = {...p}; delete next[key]; return next; }); }} />
<FieldError id={`profile-${key}-error`} message={profileWarnings[key]} /></>
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
                  <label htmlFor="profile-bio" style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', marginBottom: 7 }}>Sobre mí</label>
                  {editing ? (
                    <textarea aria-invalid={profileWarnings.bio ? true : undefined} aria-describedby={profileWarnings.bio ? "profile-bio-error" : undefined} id="profile-bio" disabled={saving} maxLength={1000} className="input-field" rows={3} placeholder="Describe tu rol, especialidad o cualquier información relevante…"
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      value={form.bio} onChange={e => { setForm(p => ({ ...p, bio: e.target.value })); setProfileWarnings(p => ({ ...p, bio: '' })); }} />
                  ) : (
                    <div style={{ fontSize: 13.5, color: form.bio ? '#1A1D23' : '#C4C6D8', lineHeight: 1.6, padding: '6px 0' }}>
                      {form.bio || 'Sin descripción. Haz clic en "Editar perfil" para agregar una nota.'}
                    </div>
                  )}
                  <FieldError id="profile-bio-error" message={profileWarnings.bio} />
                </div>
              </div>

              {editing && (
                <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                  <button type="button" disabled={saving} className="btn btn-ghost" onClick={() => { cancelEdit(); setActiveTab('actividad'); }}>Cancelar</button>
                  <button type="submit" disabled={saving || validatingPhoto} aria-busy={saving} className="btn btn-primary">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                </div>
              )}
            </form>
          )}

          {/* ── Tab: Seguridad ── */}
          {activeTab === 'seguridad' && (
            <form className="profile-settings-form" onSubmit={event => { event.preventDefault(); void handlePwSave(); }}>
              <div style={{ maxWidth: 440 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1D23', marginBottom: 6 }}>Cambiar contraseña</div>
                <div style={{ fontSize: 12.5, color: '#8B8FA8', marginBottom: 22 }}>Elige una contraseña segura de al menos 8 caracteres.</div>

                {[
                  { label: 'Contraseña actual', key: 'actual' as const },
                  { label: 'Nueva contraseña',  key: 'nueva'  as const },
                  { label: 'Confirmar nueva contraseña',   key: 'confirmar' as const },
                ].map(({ label, key }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label htmlFor={`profile-password-${key}`} style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', marginBottom: 7 }}>{label}</label>
                    <div style={{ position: 'relative' }}>
                      <input aria-invalid={passwordWarnings[key] ? true : undefined} aria-describedby={passwordWarnings[key] ? `profile-password-${key}-error` : undefined} id={`profile-password-${key}`} disabled={savingPassword} autoComplete={key === 'actual' ? 'current-password' : 'new-password'} className="input-field"
                        type={pwVisible[key] ? 'text' : 'password'}
                        placeholder="••••••••"
                        style={{ paddingRight: 40 }}
                        value={pwForm[key]}
                        onChange={e => { setPwForm(p => ({ ...p, [key]: e.target.value })); setPasswordWarnings(p => { const next = {...p}; delete next[key]; return next; }); }} />
                      <button type="button" aria-label={pwVisible[key] ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} onClick={() => setPwVisible(p => ({ ...p, [key]: !p[key] }))}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8B8FA8', padding: 0, fontSize: 12 }}>
                        {pwVisible[key]
          ? <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 1l13 13M6.3 6.4A2 2 0 009.6 9.7M4 4.2C2.5 5.2 1.6 6.3 1 7.5c1.5 3 4 5 6.5 5 1.2 0 2.4-.4 3.4-1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M10.5 10.6C12 9.5 13 8.3 14 7.5c-1.5-3-4-5-6.5-5-.8 0-1.7.2-2.4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          : <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 7.5C2.5 4.5 5 2.5 7.5 2.5S12.5 4.5 14 7.5C12.5 10.5 10 12.5 7.5 12.5S2.5 10.5 1 7.5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
        }
                      </button>
                    </div>
<FieldError id={`profile-password-${key}-error`} message={passwordWarnings[key]} />
                  </div>
                ))}

                {pwSuccess && <p role="status" className="profile-feedback profile-feedback-success">{pwSuccess}</p>}
                {pwError && (
                  <div role="alert" style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#DC2626', marginBottom: 16 }}>{pwError}</div>
                )}

                <button type="submit" disabled={savingPassword} aria-busy={savingPassword} className="btn btn-primary" style={{ padding: '10px 24px' }}>{savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}</button>

                {/* Security info */}
                <div className="profile-session-details"><DataDetails title="Información de sesión" fields={[
                  { label: 'Último acceso', value: profile.ultimo_acceso ? new Date(profile.ultimo_acceso).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Sin registro' },
                  { label: 'Rol asignado', value: ROLE_LABEL[role] },
                  { label: 'Estado de la cuenta', value: profile.estado === 'ACTIVO' ? 'Activa' : 'Inactiva' },
                ]} /></div>

              </div>
            </form>
          )}


            {activeTab === 'actividad' && <div className="profile-activity" role="region" aria-label="Mi actividad reciente" tabIndex={0}>
              <div className="profile-activity-heading"><div><h2>Requerimientos recientes</h2><p>Los últimos movimientos que registraste en el sistema.</p></div><span>{myReqs.length} en total</span></div>
              {recentActivity.length === 0 ? <div className="profile-empty"><h3>Aún no tienes requerimientos</h3><p>Cuando registres un requerimiento, podrás consultar su estado aquí.</p></div> : <ul className="profile-activity-list">
                {recentActivity.map(r => <li key={r.id}>
                  <div className="profile-activity-date"><strong>{r.fecha.slice(8,10) || '—'}</strong><span>{r.fecha.slice(0,7)}</span></div>
                  <div className="profile-activity-detail"><strong>{r.proyecto}</strong><span>{publicCode(r)} · {r.sede} · {r.materiales.length} materiales</span></div>
                  <span className="status-badge" style={{ background: ESTADO_BG[r.estado], color: ESTADO_COLOR[r.estado] }}>{r.estado}</span>
                </li>)}
              </ul>}
              <div className="profile-approval"><span>Tasa de aprobación <strong>{sent ? tasa + '%' : 'Sin envíos'}</strong></span><progress max="100" value={tasa} aria-label="Tasa de aprobación" /><small>{conf} confirmados de {sent} enviados</small></div>
            </div>}
          </section>
        </div>
      </div>
      {photoSource && <ProfilePhotoEditor file={photoSource} saving={saving} error={saveError} onSave={handleSave} onClose={() => { setPhotoSource(null); setSaveError(''); }} />}
    </div>
  );
}
