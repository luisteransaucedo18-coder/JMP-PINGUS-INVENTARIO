import { useState, useEffect } from 'react';
import type { Role } from './domain/types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { supabase, supabaseConfigError } from './services/supabase';
import { ASSETS } from './config/assets';
import { AppProvider } from './store/AppContext';
import WorkspaceGate from './components/WorkspaceTransition';
import NotificationsPanel, { useNotifications } from './components/NotificationsPanel';
import { getViewMeta } from './app/navigation';
import ViewRouter from './app/ViewRouter';

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
function LoginScreen({ onLogin }: { onLogin: (role: Role, name: string, email: string) => void }) {
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
    onLogin(
      perfil.rol as Role,
      perfil.nombre,
      perfil.email
    );

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

            <form className="auth-form" onSubmit={handleSubmit}>
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
            </form>

            <p className="auth-legal">Acceso restringido para personal autorizado.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ─── Inner app (needs AppContext) ─── */
function AppShell({ session, onLogout }: { session: { role: Role; name: string; email: string }; onLogout: () => void }) {
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifications = useNotifications(session.role, session.name);
  const unread = notifications.filter(n => !readIds.has(n.id)).length;

  const titles = getViewMeta(session.role, view);

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 48%, #2563EB 100%)', position: 'relative' }}>
      <Sidebar role={session.role} activeView={view} onNav={setView} onLogout={onLogout} userName={session.name} userEmail={session.email} />
      <div className="app-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 0 0', gap: 12 }}>
        <Header
          title={titles?.title || 'Sistema de Gestión'}
          subtitle={titles?.subtitle}
          userName={session.name}
          userInitials={session.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          unreadCount={unread}
          onBellClick={() => setNotifOpen(open => !open)}
        />
        <div className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <ViewRouter role={session.role} view={view} onToast={msg => setToast(msg)} onNav={setView} userName={session.name} userEmail={session.email} />
        </div>
      </div>
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        role={session.role}
        userName={session.name}
        readIds={readIds}
        onMarkRead={setReadIds}
      />
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}
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
  const [session, setSession] = useState<{ role: Role; name: string; email: string } | null>(null);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    if (supabaseConfigError) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (role: Role, name: string, email: string) => {
    setSession({ role, name, email });
    setSessionError('');
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { setSessionError('No se pudo cerrar la sesión. Inténtalo nuevamente.'); return; }
    setSession(null);
    setSessionError('');
  };

  if (supabaseConfigError) return <ConfigurationErrorScreen />;

  return <>
    {sessionError && <div role="alert" style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C' }}>{sessionError}</div>}
    {session ? <AppProvider key={session.email}><WorkspaceGate onLogout={() => void logout()}><AppShell session={session} onLogout={() => void logout()} /></WorkspaceGate></AppProvider>
      : <LoginScreen onLogin={handleLogin} />}
  </>;
}
