import { useState, useEffect } from 'react';
import { Role } from './data/mockData';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { supabase, supabaseConfigError } from './service/supabase';
import { ASSETS } from './config/assets';
import { AppProvider } from './store/AppContext';

import GerenteDashboard from './views/gerente/GerenteDashboard';
import ReportesView from './views/gerente/ReportesView';
import AnalistaDashboard from './views/analista/AnalistaDashboard';
import NuevaSolicitudView from './views/analista/NuevaSolicitudView';
import MisSolicitudesView from './views/analista/MisSolicitudesView';
import CoordinadorDashboard from './views/coordinador/CoordinadorDashboard';
import RequerimientosView from './views/coordinador/RequerimientosView';
import InventarioView from './views/shared/InventarioView';
import ProyectosView from './views/shared/ProyectosView';
import EntregasView from './views/shared/EntregasView';
import UsuariosView from './views/admin/UsuariosView';
import ProfileView from './views/shared/ProfileView';
import NotificationsPanel, { useNotifications } from './components/NotificationsPanel';
import NuevaCompraView from './views/analista/NuevaCompraView';
import MisComprasView from './views/analista/MisComprasView';
import ComprasView from './views/coordinador/ComprasView';


const VIEW_TITLES: Record<string, Record<string, { title: string; subtitle?: string }>> = {
  perfil: { perfil: { title: 'Mi Perfil', subtitle: 'Información personal, seguridad y actividad reciente' } },
  gerente: {
    dashboard:  { title: 'Dashboard General', subtitle: 'Resumen ejecutivo del sistema' },
    inventario: { title: 'Inventario', subtitle: 'Stock por sede — solo lectura' },
    reportes:   { title: 'Reportes', subtitle: 'Análisis de requerimientos, stock e indicadores operativos' },
    proyectos:  { title: 'Proyectos', subtitle: 'Todos los proyectos registrados' },
  },
  analista: {
    dashboard:         { title: 'Mi Panel', subtitle: 'Resumen de mis solicitudes' },
    'nueva-solicitud': { title: 'Nueva Solicitud', subtitle: 'Registrar requerimiento de materiales' },
    'mis-solicitudes': { title: 'Mis Solicitudes', subtitle: 'Historial de requerimientos enviados' },
    proyectos:         { title: 'Proyectos', subtitle: 'Gestionar y buscar proyectos' },
    entregas:          { title: 'Entregas al Técnico', subtitle: 'Registrar entrega de materiales aprobados' },
    devoluciones:      { title: 'Devoluciones', subtitle: 'Registrar materiales devueltos por el técnico' },
    inventario:        { title: 'Inventario', subtitle: 'Consulta de existencias por sede' },
    'nueva-compra':    { title: 'Nueva Solicitud de Compra', subtitle: 'Solicitar compra de materiales faltantes' },
    'mis-compras':     { title: 'Mis Órdenes de Compra', subtitle: 'Seguimiento de solicitudes de compra' },
    devoluciones:      { title: 'Devoluciones', subtitle: 'Registrar devoluciones de materiales entregados' },
  },
  coordinador: {
    dashboard:      { title: 'Panel de Coordinación', subtitle: 'Gestión de requerimientos e inventario' },
    requerimientos: { title: 'Requerimientos', subtitle: 'Validar y confirmar solicitudes de analistas' },
    proyectos:      { title: 'Proyectos', subtitle: 'Administrar proyectos y requerimientos' },
    entregas:       { title: 'Entregas al Técnico', subtitle: 'Preparar y registrar entregas de materiales' },
    devoluciones:   { title: 'Devoluciones', subtitle: 'Registrar materiales devueltos por el técnico' },
    inventario:     { title: 'Inventario', subtitle: 'Catálogo de materiales — edición habilitada' },
    usuarios:       { title: 'Gestión de Usuarios', subtitle: 'Crear, activar y desactivar cuentas' },
    compras:        { title: 'Órdenes de Compra', subtitle: 'Aprobar solicitudes y confirmar ingresos de stock' },
    devoluciones:   { title: 'Devoluciones', subtitle: 'Validar devoluciones y registrar ingresos de stock' },
  },
};

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

  const handleSsoUnavailable = (provider: string) => {
    setError(`El acceso con ${provider} aún no está habilitado. Usa tu correo institucional.`);
  };

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

    console.log('USUARIO AUTH:', user);

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

    console.log('PERFIL:', perfil);

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

/* ─── View router ─── */
function renderView(role: Role, view: string, onToast: (m: string) => void, onNav: (v: string) => void, usuario: string, userEmail: string) {
  if (view === 'perfil') return <ProfileView role={role} userName={usuario} userEmail={userEmail} onToast={onToast} />;
  if (role === 'gerente') {
    if (view === 'dashboard' || !view) return <GerenteDashboard />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'reportes') return <ReportesView />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} />;
  }
  if (role === 'analista') {
    if (view === 'dashboard' || !view) return <AnalistaDashboard usuario={usuario} onNav={onNav} />;
    if (view === 'nueva-solicitud') return <NuevaSolicitudView onToast={onToast} usuario={usuario} onNav={onNav} />;
    if (view === 'mis-solicitudes') return <MisSolicitudesView usuario={usuario} onToast={onToast} onNav={onNav} />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} />;
    if (view === 'entregas') return <EntregasView onToast={onToast} usuario={usuario} />;
    if (view === 'devoluciones') return <DevolucionesView onToast={onToast} usuario={usuario} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'nueva-compra') return <NuevaCompraView onToast={onToast} usuario={usuario} onNav={onNav} />;
    if (view === 'mis-compras') return <MisComprasView usuario={usuario} onNav={onNav} />;
    if (view === 'devoluciones') return <DevolucionesView role="analista" onToast={onToast} />;
  }
  if (role === 'coordinador') {
    if (view === 'dashboard' || !view) return <CoordinadorDashboard onNav={onNav} />;
    if (view === 'requerimientos') return <RequerimientosView onToast={onToast} usuario={usuario} />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} />;
    if (view === 'entregas') return <EntregasView onToast={onToast} usuario={usuario} />;
    if (view === 'devoluciones') return <DevolucionesView onToast={onToast} usuario={usuario} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'usuarios') return <UsuariosView onToast={onToast} />;
    if (view === 'compras') return <ComprasView onToast={onToast} usuario={usuario} />;
    if (view === 'devoluciones') return <DevolucionesView role="coordinador" onToast={onToast} />;
  }
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717A' }}>Vista en construcción</div>;
}

/* ─── Inner app (needs AppContext) ─── */
function AppShell({ session, onLogout }: { session: { role: Role; name: string; email: string }; onLogout: () => void }) {
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifications = useNotifications(session.role, session.name);
  const unread = notifications.filter(n => !readIds.has(n.id)).length;

  const titles = view === 'perfil'
    ? { title: 'Mi Perfil', subtitle: 'Información personal, seguridad y actividad reciente' }
    : (VIEW_TITLES as any)[session.role]?.[view];

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
          {renderView(session.role, view, msg => setToast(msg), setView, session.name, session.email)}
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
  const [restoring, setRestoring] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    if (supabaseConfigError) { setRestoring(false); return; }
    let active = true;
    let version = 0;
    const restore = async () => {
      const current = ++version;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) { if (active && version === current) setSession(null); return; }
        const { data: perfil, error: profileError } = await supabase.from('perfiles')
          .select('nombre,email,rol,estado').eq('id', data.session.user.id).single();
        if (profileError) throw profileError;
        if (!active || version !== current) return;
        if (perfil.estado !== 'ACTIVO' || !['analista', 'coordinador', 'gerente'].includes(perfil.rol)) {
          setSession(null); setSessionError('Tu perfil no tiene acceso activo.'); return;
        }
        setSession({ role: perfil.rol as Role, name: perfil.nombre, email: perfil.email });
        setSessionError('');
      } catch {
        if (active && version === current) { setSession(null); setSessionError('No se pudo recuperar tu sesión. Vuelve a iniciar sesión.'); }
      } finally { if (active && version === current) setRestoring(false); }
    };
    void restore();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { version++; setSession(null); setRestoring(false); }
      // Defer Supabase calls until the auth callback has released its lock.
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') { queueMicrotask(() => { if (active) void restore(); }); }
    });
    return () => { active = false; version++; subscription.unsubscribe(); };
  }, []);

  if (supabaseConfigError) return <ConfigurationErrorScreen />;

  const handleLogin = (role: Role, name: string, email: string) => setSession({ role, name, email });

  const logout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { setSessionError('No se pudo cerrar la sesión. Inténtalo nuevamente.'); return; }
    setSession(null); setSessionError('');
  };

  if (restoring) return <div role="status" style={{ padding: 32 }}>Recuperando sesión…</div>;
  return <>
    {sessionError && <div role="alert" style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C' }}>{sessionError}</div>}
    {session ? <AppProvider key={session.email}><AppShell session={session} onLogout={() => void logout()} /></AppProvider>
      : <LoginScreen onLogin={handleLogin} />}
  </>;
}
