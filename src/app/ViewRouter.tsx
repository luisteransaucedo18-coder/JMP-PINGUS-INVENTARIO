import { lazy, Suspense, useEffect, useState } from 'react';
import type { RequestIntent } from '../views/analista/dashboardModel';
import type { Role } from '../domain/types';
import { canAccessView } from './navigation';
import type { ConsultaGerente } from '../features/consultas/pages/ConsultaGerenteView';
const ProfileView = lazy(() => import('../views/shared/ProfileView'));
const ManualUsuarioView = lazy(() => import('../views/shared/ManualUsuarioView'));
const InventarioView = lazy(() => import('../features/inventario/pages/InventarioView'));
const ProyectosView = lazy(() => import('../features/proyectos/pages/ProyectosView'));
const EntregasView = lazy(() => import('../features/entregas/pages/EntregasView'));
const DevolucionesView = lazy(() => import('../features/devoluciones/pages/DevolucionesView'));
const GerenteDashboard = lazy(() => import('../views/gerente/GerenteDashboard'));
const ReportesView = lazy(() => import('../features/reportes/pages/ReportesView'));
const ConsultaGerenteView = lazy(() => import('../features/consultas/pages/ConsultaGerenteView'));
const AnalistaDashboard = lazy(() => import('../views/analista/AnalistaDashboard'));
const NuevaSolicitudView = lazy(() => import('../features/requerimientos/pages/NuevaSolicitudView'));
const MisSolicitudesView = lazy(() => import('../features/requerimientos/pages/MisSolicitudesView'));
const NuevaCompraView = lazy(() => import('../features/compras/pages/NuevaCompraView'));
const MisComprasView = lazy(() => import('../features/compras/pages/MisComprasView'));
const CoordinadorDashboard = lazy(() => import('../views/coordinador/CoordinadorDashboard'));
const TransporteInternoView = lazy(() => import('../features/transporte/pages/TransporteInternoView'));
const RequerimientosView = lazy(() => import('../features/requerimientos/pages/RequerimientosView'));
const ComprasView = lazy(() => import('../features/compras/pages/ComprasView'));
const UsuariosView = lazy(() => import('../features/usuarios/pages/UsuariosView'));
const CotizacionesView = lazy(() => import('../features/cotizaciones/CotizacionesView'));
const ValorizacionesView = lazy(() => import('../features/valorizaciones/ValorizacionesView'));
const TesoreriaDashboard = lazy(() => import('../views/tesoreria/TesoreriaDashboard'));

type Props = {
  role: Role;
  view: string;
  onToast: (message: string) => void;
  onNav: (view: string) => void;
  userId?: string;
  userName: string;
  userEmail: string;
  onStartTour: () => void;
};

const MANAGER_DATA_VIEWS: ConsultaGerente[] = [
  'requerimientos', 'compras', 'entregas', 'devoluciones', 'transporte', 'usuarios',
];

export default function ViewRouter(props: Props) {
  return <Suspense fallback={<div className="view-loading" role="status" aria-live="polite">Cargando sección…</div>}>
    <ResolvedView {...props} />
  </Suspense>;
}

function ResolvedView({ role, view, onToast, onNav, userId, userName, userEmail, onStartTour }: Props) {
  const [requestIntent, setRequestIntent] = useState<RequestIntent>();
  useEffect(() => { if (view !== 'mis-solicitudes') setRequestIntent(undefined); }, [view]);
  const openRequests = (intent: RequestIntent) => { setRequestIntent(intent); onNav('mis-solicitudes'); };
  if (!canAccessView(role, view)) return <ViewMessage message="No tienes acceso a esta vista." />;
  if (role === 'tesoreria' && view === 'dashboard') return <TesoreriaDashboard onNav={onNav} />;
  if (view === 'valorizaciones') return <ValorizacionesView role={role} onToast={onToast} />;
  if (view === 'cotizaciones') return <CotizacionesView role={role} onToast={onToast} onNav={onNav} />;
  if (view === 'nueva-cotizacion') return <CotizacionesView key="nueva-cotizacion" role={role} onToast={onToast} onNav={onNav} nueva />;
  if (view === 'perfil') return <ProfileView role={role} userName={userName} userEmail={userEmail} onToast={onToast} />;
  if (view === 'manual') return <ManualUsuarioView role={role} onNav={onNav} onStartTour={onStartTour} />;

  if (role === 'gerente') {
    if (view === 'dashboard') return <GerenteDashboard onNav={onNav} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} preferenceKey={userId} />;
    if (view === 'reportes') return <ReportesView />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} onNav={onNav} />;
    if (MANAGER_DATA_VIEWS.includes(view as ConsultaGerente)) return <ConsultaGerenteView type={view as ConsultaGerente} />;
  }

  if (role === 'analista') {
    if (view === 'dashboard') return <AnalistaDashboard usuario={userName} onNav={onNav} onOpenRequests={openRequests} />;
    if (view === 'nueva-solicitud') return <NuevaSolicitudView onToast={onToast} onNav={onNav} />;
    if (view === 'mis-solicitudes') return <MisSolicitudesView usuario={userName} onToast={onToast} onNav={onNav} initialFilter={requestIntent?.filter} initialSelectedId={requestIntent?.id} />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} onNav={onNav} />;
    if (view === 'entregas') return <EntregasView onToast={onToast} usuario={userName} />;
    if (view === 'devoluciones') return <DevolucionesView onToast={onToast} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} preferenceKey={userId} />;
    if (view === 'nueva-compra') return <NuevaCompraView onToast={onToast} onNav={onNav} />;
    if (view === 'mis-compras') return <MisComprasView usuario={userName} onNav={onNav} onToast={onToast} />;
  }

  if (role === 'coordinador') {
    if (view === 'dashboard') return <CoordinadorDashboard onNav={onNav} />;
    if (view === 'transporte') return <TransporteInternoView onToast={onToast} />;
    if (view === 'requerimientos') return <RequerimientosView onToast={onToast} onNav={onNav} />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} onNav={onNav} />;
    if (view === 'entregas') return <EntregasView onToast={onToast} usuario={userName} />;
    if (view === 'devoluciones') return <DevolucionesView onToast={onToast} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} preferenceKey={userId} />;
    if (view === 'usuarios') return <UsuariosView onToast={onToast} />;
    if (view === 'compras') return <ComprasView onToast={onToast} />;
  }

  return <ViewMessage message="Vista en construcción" />;
}

function ViewMessage({ message }: { message: string }) {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717A' }}>{message}</div>;
}
