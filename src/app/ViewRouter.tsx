import type { Role } from '../domain/types';
import { canAccessView } from './navigation';
import ProfileView from '../views/shared/ProfileView';
import ManualUsuarioView from '../views/shared/ManualUsuarioView';
import InventarioView from '../features/inventario/pages/InventarioView';
import ProyectosView from '../features/proyectos/pages/ProyectosView';
import EntregasView from '../features/entregas/pages/EntregasView';
import DevolucionesView from '../features/devoluciones/pages/DevolucionesView';
import GerenteDashboard from '../views/gerente/GerenteDashboard';
import ReportesView from '../features/reportes/pages/ReportesView';
import ConsultaGerenteView, { type ConsultaGerente } from '../features/consultas/pages/ConsultaGerenteView';
import AnalistaDashboard from '../views/analista/AnalistaDashboard';
import NuevaSolicitudView from '../features/requerimientos/pages/NuevaSolicitudView';
import MisSolicitudesView from '../features/requerimientos/pages/MisSolicitudesView';
import NuevaCompraView from '../features/compras/pages/NuevaCompraView';
import MisComprasView from '../features/compras/pages/MisComprasView';
import CoordinadorDashboard from '../views/coordinador/CoordinadorDashboard';
import TransporteInternoView from '../features/transporte/pages/TransporteInternoView';
import RequerimientosView from '../features/requerimientos/pages/RequerimientosView';
import ComprasView from '../features/compras/pages/ComprasView';
import UsuariosView from '../features/usuarios/pages/UsuariosView';
import CotizacionesView from '../features/cotizaciones/CotizacionesView';

type Props = {
  role: Role;
  view: string;
  onToast: (message: string) => void;
  onNav: (view: string) => void;
  userName: string;
  userEmail: string;
  onStartTour: () => void;
};

const MANAGER_DATA_VIEWS: ConsultaGerente[] = [
  'requerimientos', 'compras', 'entregas', 'devoluciones', 'transporte', 'usuarios',
];

export default function ViewRouter({ role, view, onToast, onNav, userName, userEmail, onStartTour }: Props) {
  if (!canAccessView(role, view)) return <ViewMessage message="No tienes acceso a esta vista." />;
  if (view === 'cotizaciones') return <CotizacionesView role={role} onToast={onToast} onNav={onNav} />;
  if (view === 'perfil') return <ProfileView role={role} userName={userName} userEmail={userEmail} onToast={onToast} />;
  if (view === 'manual') return <ManualUsuarioView role={role} onNav={onNav} onStartTour={onStartTour} />;

  if (role === 'gerente') {
    if (view === 'dashboard') return <GerenteDashboard onNav={onNav} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'reportes') return <ReportesView />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} onNav={onNav} />;
    if (MANAGER_DATA_VIEWS.includes(view as ConsultaGerente)) return <ConsultaGerenteView type={view as ConsultaGerente} />;
  }

  if (role === 'analista') {
    if (view === 'dashboard') return <AnalistaDashboard usuario={userName} onNav={onNav} />;
    if (view === 'nueva-solicitud') return <NuevaSolicitudView onToast={onToast} onNav={onNav} />;
    if (view === 'mis-solicitudes') return <MisSolicitudesView usuario={userName} onToast={onToast} onNav={onNav} />;
    if (view === 'proyectos') return <ProyectosView role={role} onToast={onToast} onNav={onNav} />;
    if (view === 'entregas') return <EntregasView onToast={onToast} usuario={userName} />;
    if (view === 'devoluciones') return <DevolucionesView onToast={onToast} />;
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
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
    if (view === 'inventario') return <InventarioView role={role} onToast={onToast} />;
    if (view === 'usuarios') return <UsuariosView onToast={onToast} />;
    if (view === 'compras') return <ComprasView onToast={onToast} />;
  }

  return <ViewMessage message="Vista en construcción" />;
}

function ViewMessage({ message }: { message: string }) {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717A' }}>{message}</div>;
}
