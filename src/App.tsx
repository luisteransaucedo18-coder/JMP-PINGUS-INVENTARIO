import ValidatedForm from "./components/ValidatedForm";
import { useState, useEffect, useRef } from 'react';
import { obtenerMiPerfil, type Perfil } from './services/perfilService';
import { UserProfileProvider, useUserProfile } from './store/UserProfileContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MobileNavigation from './components/MobileNavigation';
import { supabase, supabaseConfigError } from './services/supabase';
import { ASSETS } from './config/assets';
import { AppProvider, useAppStore } from './store/AppContext';
import WorkspaceGate from './components/WorkspaceTransition';
import NotificationsPanel, { useNotifications } from './components/NotificationsPanel';
import { getViewMeta } from './app/navigation';
import ViewRouter from './app/ViewRouter';
import OnboardingTour from './components/OnboardingTour';
import { readTourStatus } from './app/onboarding';

/* ─── Toast ─── */
function Toast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [msg]);
  return (
    <div className="toast">
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
      </div>
      <span style={{ color: '#18181B' }}>{msg}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', marginLeft: 8, padding: 0, display: 'flex', alignItems: 'center' }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
    </div>
  );
}

/* ─── Login Screen ─── */
function LoginScreen({ onLogin }: { onLogin: (profile: Perfil) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  setError('');
  setLoading(true);

  try {
    // 1. Login con Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (authError) {
      console.error('Error Auth:', authError);

      setError('Correo o contraseña incorrectos.');
      setLoading(false);

      return;
    }

    const user = authData.user;

    if (!user) {
      setError('No se encontró el usuario.');
      setLoading(false);

      return;
    }

    // 2. Obtener perfil
    const { data: perfil, error: perfilError } =
      await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (perfilError) {
      console.error('Error obteniendo perfil:', perfilError);

      setError('El usuario existe, pero no tiene un perfil válido.');
      setLoading(false);

      return;
    }

    // 3. Comprobar que esté activo
    if (perfil.estado !== 'ACTIVO') {
      setError('Tu usuario se encuentra inactivo.');

      await supabase.auth.signOut();

      setLoading(false);

      return;
    }

    // 4. Validar rol
    if (
      perfil.rol !== 'gerente' &&
      perfil.rol !== 'analista' &&
      perfil.rol !== 'coordinador'
    ) {
      setError('El usuario tiene un rol no válido.');
      setLoading(false);

      return;
    }

    // 5. Entrar al sistema
    onLogin(perfil as Perfil);

  } catch (error) {
    console.error('Error inesperado:', error);

    setError('Ocurrió un error al iniciar sesión.');
  } finally {
    setLoading(false);
  }
};



  return (
    <main className="auth-screen">
      <section className="auth-card" aria-label="Acceso al sistema JIP">
        <aside className="auth-visual">
          <img className="auth-mascot" src={ASSETS.mascota} alt="Mascota de JIP" />
        </aside>

        <div className="auth-form-panel">
          <div className="auth-form-wrap">
            <header className="auth-heading">
              <img className="auth-form-logo" src={ASSETS.logo} alt="JIP" />
              <span>Plataforma interna JIP</span>
              <h1>Bienvenido</h1>
              <p>Inicia sesión para continuar con la gestión de materiales.</p>
            </header>

            <br></br>
            <br></br>

            <ValidatedForm className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Correo electrónico</span>
                <span className="auth-control">
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="m2.5 4.5 6 4.5 6-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <input type="email" placeholder="correo@jip.pe" value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }} autoComplete="email" required />
                </span>
              </label>

              <label className="auth-field">
                <span>Contraseña</span>
                <span className="auth-control">
                  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" required />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {showPass
                      ? <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 8.5s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4S2 8.5 2 8.5Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8.5" cy="8.5" r="1.7" stroke="currentColor" strokeWidth="1.3"/><path d="m2.5 2.5 12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      : <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M2 8.5s2.2-4 6.5-4 6.5 4 6.5 4-2.2 4-6.5 4S2 8.5 2 8.5Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8.5" cy="8.5" r="1.7" stroke="currentColor" strokeWidth="1.3"/></svg>
                    }
                  </button>
                </span>
              </label>

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <><span className="auth-spinner" />Verificando...</> : 'Ingresar al sistema'}
              </button>
            </ValidatedForm>

            <p className="auth-legal">Acceso restringido para personal autorizado.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ─── Inner app (needs AppContext) ─── */
function AppShell({ onLogout, loggingOut, logoutError }: { loggingOut: boolean; logoutError: string; onLogout: () => void }) {
  const { profile, avatarUrl } = useUserProfile();
  const { syncErrors, refreshRemoteData } = useAppStore();
  const session = { role: profile.rol, name: profile.nombre, email: profile.email };
  const [view, setView] = useState('dashboard');
  const [tourOpen, setTourOpen] = useState(() => readTourStatus(profile.id) === null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => { if (!media.matches) setMenuOpen(false); };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const navigate = (next: string) => { setView(next); setMenuOpen(false); };
  const sidebarProps = { role: session.role, activeView: view, onNav: navigate, onLogout,
    userName: session.name, userEmail: session.email, avatarUrl, loggingOut, logoutError };

  const [toast, setToast] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifications = useNotifications(session.role, session.name);
  const unread = notifications.filter(n => !readIds.has(n.id)).length;

  const titles = getViewMeta(session.role, view);

  return (
    <div className="app-shell" data-role={session.role} style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 48%, #2563EB 100%)', position: 'relative' }}>
      <Sidebar {...sidebarProps} />
      <MobileNavigation open={menuOpen} onClose={() => setMenuOpen(false)} triggerRef={menuTrigger}>
        <Sidebar {...sidebarProps} mobile onClose={() => setMenuOpen(false)} />
      </MobileNavigation>
      <div className="app-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 0 0', gap: 12 }}>
        <Header
          menuButton={<button ref={menuTrigger} className="mobile-menu-trigger" aria-label="Abrir menú"
            aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => { setNotifOpen(false); setMenuOpen(true); }}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>}
          title={titles?.title || 'Sistema de Gestión'}
          subtitle={titles?.subtitle}
          onProfile={() => navigate('perfil')}
          avatarUrl={avatarUrl}
          userName={session.name}
          userInitials={session.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          unreadCount={unread}
          notificationsOpen={notifOpen}
          notificationPanel={<NotificationsPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            role={session.role}
            userName={session.name}
            readIds={readIds}
            onMarkRead={setReadIds}
          />}
          onBellClick={() => setNotifOpen(open => !open)}
        />
        <div className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {syncErrors.length > 0 && <div className="quote-error" role="alert" style={{ margin: '0 24px', padding: 12 }}>
            No se pudieron actualizar: {syncErrors.join(', ')}. Los datos mostrados pueden estar desactualizados.
            <button type="button" className="btn btn-ghost" onClick={() => void refreshRemoteData()}>Reintentar actualización</button>
          </div>}
          <div className="app-view-content" data-tour-view={view}>
            <ViewRouter role={session.role} view={view} onToast={msg => setToast(msg)} onNav={setView} userName={session.name} userEmail={session.email}
              onStartTour={() => { setMenuOpen(false); setNotifOpen(false); setTourOpen(true); }} />
          </div>
        </div>
      </div>
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}
      {tourOpen && <OnboardingTour key={`${profile.id}:${session.role}`} role={session.role} userId={profile.id} navigate={setView}
        onClose={() => setTourOpen(false)} onStorageError={() => setToast('Tu navegador no permitió guardar el tutorial. Podría aparecer nuevamente al ingresar.')} />}
    </div>
  );
}

/* ─── App root ─── */
function ConfigurationErrorScreen() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#EEF0FF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 560, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 8px 30px rgba(30, 41, 59, 0.12)' }}>
        <h1 style={{ margin: '0 0 12px', color: '#18181B', fontSize: 22 }}>Configuración incompleta</h1>
        <p style={{ margin: '0 0 18px', color: '#52525B', lineHeight: 1.6 }}>
          Este despliegue no tiene configuradas las variables de Supabase. Agrégalas en Vercel y vuelve a desplegar el proyecto.
        </p>
        <pre style={{ margin: 0, padding: 16, overflowX: 'auto', borderRadius: 8, background: '#F4F4F5', color: '#18181B' }}>{'VITE_SUPABASE_URL\nVITE_SUPABASE_PUBLISHABLE_KEY'}</pre>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Perfil | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (supabaseConfigError) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const profile = await obtenerMiPerfil();
      if (active) setSession(profile);
    }).catch(() => { if (active) setSessionError('No se pudo recuperar tu sesión. Inicia sesión nuevamente.'); })
      .finally(() => { if (active) setRestoring(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        active = false;
        setRestoring(false);
        setSession(null);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const handleLogin = (profile: Perfil) => {
    setSession(profile);
    setSessionError('');
  };

  const logout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    setSessionError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      // Unmounting AppProvider clears inventory, notifications and view state.
      setSession(null);
    } catch {
      setSessionError('No se pudo cerrar la sesión. Inténtalo nuevamente.');
    } finally {
      logoutPending.current = false;
      setLoggingOut(false);
    }
  };

  if (supabaseConfigError) return <ConfigurationErrorScreen />;
  if (restoring) return <main className="session-restoring" role="status">Cargando tu sesión…</main>;

  return <>
    {!session && sessionError && <div role="alert" className="sidebar-session-error">{sessionError} Si la sesión local ya se cerró, inicia sesión para reintentar.</div>}
    {session ? <UserProfileProvider key={session.id} initialProfile={session} onChange={next => setSession(current => current?.id === next.id ? next : current)}><AppProvider><WorkspaceGate loggingOut={loggingOut} logoutError={sessionError} onLogout={() => void logout()}><AppShell loggingOut={loggingOut} logoutError={sessionError} onLogout={() => void logout()} /></WorkspaceGate></AppProvider></UserProfileProvider>
      : <LoginScreen onLogin={handleLogin} />}
  </>;
}
