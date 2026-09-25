import { useState, useEffect } from 'react';
import { Role } from './data/mockData';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { supabase, supabaseConfigError } from './service/supabase';
import { ASSETS } from './config/assets';

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
    inventario:        { title: 'Inventario', subtitle: 'Consulta de existencias por sede' },
    'nueva-compra':    { title: 'Nueva Solicitud de Compra', subtitle: 'Solicitar compra de materiales faltantes' },
    'mis-compras':     { title: 'Mis Órdenes de Compra', subtitle: 'Seguimiento de solicitudes de compra' },
  },
  coordinador: {
    dashboard:      { title: 'Panel de Coordinación', subtitle: 'Gestión de requerimientos e inventario' },
    requerimientos: { title: 'Requerimientos', subtitle: 'Validar y confirmar solicitudes de analistas' },
    proyectos:      { title: 'Proyectos', subtitle: 'Administrar proyectos y requerimientos' },
    entregas:       { title: 'Entregas al Técnico', subtitle: 'Preparar y registrar entregas de materiales' },
    inventario:     { title: 'Inventario', subtitle: 'Catálogo de materiales — edición habilitada' },
    usuarios:       { title: 'Gestión de Usuarios', subtitle: 'Crear, activar y desactivar cuentas' },
    compras:        { title: 'Órdenes de Compra', subtitle: 'Aprobar solicitudes y confirmar ingresos de stock' },
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
    <div className="login-screen" style={{ display: 'flex', minHeight: '100dvh', fontFamily: 'Inter, sans-serif' }}>
      {/* Left — form */}
      <div className="login-panel" style={{ width: '45%', minWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 56px', background: '#fff' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <img
                src={ASSETS.logo}
                alt="JIP"
                style={{
                  height: 52,
                  objectFit: 'contain'
                }}
              />       
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#18181B', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Iniciar Sesión</h1>
          <p style={{ fontSize: 14, color: '#71717A', margin: '0 0 28px', lineHeight: 1.5 }}>
            Bienvenido de vuelta.<br />Ingresa tus credenciales para acceder al sistema.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Correo electrónico</label>
              <input className="input-field" type="email" placeholder="correo@jip.pe" value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }} autoComplete="email" />
            </div>
            <div style={{ marginBottom: 22, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Contraseña</label>
              <input className="input-field" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password" style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, bottom: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 0 }}>
                {showPass
                  ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="#A1A1AA" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="#A1A1AA" strokeWidth="1.2"/><path d="M2 2l10 10" stroke="#A1A1AA" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="#A1A1AA" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.5" stroke="#A1A1AA" strokeWidth="1.2"/></svg>
                }
              </button>
            </div>

            {error && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, padding: '10px 12px', marginBottom: 16, fontSize: 12.5, color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, borderRadius: 8, fontWeight: 600 }} disabled={loading}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Verificando...</span>
                : 'Ingresar al Sistema'
              }
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#A1A1AA', marginTop: 20, marginBottom: 16 }}>Acceso restringido para personal autorizado.</p>

        </div>
      </div>

      {/* Right — hero */}
      <div className="login-hero" style={{
        flex: 1,
        background: 'linear-gradient(160deg, #3B82F6 0%, #2563EB 40%, #1D4ED8 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '52px 48px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 480, zIndex: 1 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Gestión integral de inventario y materiales
          </h2>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.6 }}>
            Optimiza tus procesos logísticos y controla el stock en tiempo real desde cualquier sede.
          </p>
        </div>
            <img
              src={ASSETS.mascota}
              alt="JIP mascota"
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: 560,
                height: 'auto',
                objectFit: 'contain',
                objectPosition: 'bottom',
                filter: 'drop-shadow(0 -8px 32px rgba(0,0,0,0.18))'
              }}
            />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'nueva-compra') return <NuevaCompraView onToast={onToast} usuario={usuario} onNav={onNav} />;
    if (view === 'mis-compras') return <MisComprasView usuario={usuario} onNav={onNav} />;
  }
  if (role === 'coordinador') {
    if (view === 'dashboard' || !view) return <CoordinadorDashboard onNav={onNav} />;
    if (view === 'requerimientos') return <RequerimientosView onToast={onToast} usuario={usuario} />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} />;
    if (view === 'entregas') return <EntregasView onToast={onToast} usuario={usuario} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'usuarios') return <UsuariosView onToast={onToast} />;
    if (view === 'compras') return <ComprasView onToast={onToast} usuario={usuario} />;
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

  if (supabaseConfigError) return <ConfigurationErrorScreen />;

  const handleLogin = (role: Role, name: string, email: string) => setSession({ role, name, email });

  if (!session) return <LoginScreen onLogin={handleLogin} />;
  return <AppShell session={session} onLogout={() => setSession(null)} />;
}
