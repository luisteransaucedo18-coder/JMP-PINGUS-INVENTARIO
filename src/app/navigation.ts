import type { Role } from '../domain/types';

export type NavigationIcon = 'grid' | 'chart' | 'document' | 'cart' | 'delivery' | 'return' | 'transfer' | 'map' | 'box' | 'users' | 'plus' | 'clipboard';

export type ViewMeta = { title: string; subtitle?: string };
export type NavigationItem = ViewMeta & { id: string; label: string; icon: NavigationIcon };

export const ROLE_LABELS: Record<Role, string> = {
  gerente: 'Gerente', analista: 'Analista', coordinador: 'Coordinador',
};

export const NAVIGATION_BY_ROLE: Record<Role, NavigationItem[]> = {
  gerente: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', title: 'Dashboard General', subtitle: 'Resumen ejecutivo del sistema' },
    { id: 'reportes', label: 'Reportes', icon: 'chart', title: 'Reportes', subtitle: 'Análisis de requerimientos, stock e indicadores operativos' },
    { id: 'requerimientos', label: 'Requerimientos', icon: 'document', title: 'Requerimientos', subtitle: 'Consulta general de solicitudes — solo lectura' },
    { id: 'compras', label: 'Compras', icon: 'cart', title: 'Órdenes de Compra', subtitle: 'Seguimiento de compras — solo lectura' },
    { id: 'entregas', label: 'Entregas', icon: 'delivery', title: 'Entregas', subtitle: 'Historial de entregas — solo lectura' },
    { id: 'devoluciones', label: 'Devoluciones', icon: 'return', title: 'Devoluciones', subtitle: 'Historial de devoluciones — solo lectura' },
    { id: 'transporte', label: 'Transporte interno', icon: 'transfer', title: 'Transporte interno', subtitle: 'Movimientos entre sedes — solo lectura' },
    { id: 'proyectos', label: 'Proyectos', icon: 'map', title: 'Proyectos', subtitle: 'Todos los proyectos registrados' },
    { id: 'inventario', label: 'Inventario', icon: 'box', title: 'Inventario', subtitle: 'Stock por sede — solo lectura' },
    { id: 'usuarios', label: 'Usuarios', icon: 'users', title: 'Usuarios', subtitle: 'Directorio del sistema — solo lectura' },
  ],
  analista: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', title: 'Mi Panel', subtitle: 'Resumen de mis solicitudes' },
    { id: 'nueva-solicitud', label: 'Nueva Solicitud', icon: 'plus', title: 'Nueva Solicitud', subtitle: 'Registrar requerimiento de materiales' },
    { id: 'mis-solicitudes', label: 'Mis Solicitudes', icon: 'clipboard', title: 'Mis Solicitudes', subtitle: 'Historial de requerimientos enviados' },
    { id: 'proyectos', label: 'Proyectos', icon: 'map', title: 'Proyectos', subtitle: 'Gestionar y buscar proyectos' },
    { id: 'entregas', label: 'Entregas', icon: 'delivery', title: 'Entregas al Técnico', subtitle: 'Registrar entrega de materiales aprobados' },
    { id: 'devoluciones', label: 'Devoluciones', icon: 'return', title: 'Devoluciones', subtitle: 'Registrar materiales devueltos por el técnico' },
    { id: 'mis-compras', label: 'Órdenes de Compra', icon: 'cart', title: 'Mis Órdenes de Compra', subtitle: 'Seguimiento de solicitudes de compra' },
    { id: 'inventario', label: 'Inventario', icon: 'box', title: 'Inventario', subtitle: 'Consulta de existencias por sede' },
  ],
  coordinador: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', title: 'Panel de Coordinación', subtitle: 'Gestión de requerimientos e inventario' },
    { id: 'requerimientos', label: 'Requerimientos', icon: 'document', title: 'Requerimientos', subtitle: 'Validar y confirmar solicitudes de analistas' },
    { id: 'compras', label: 'Compras', icon: 'cart', title: 'Órdenes de Compra', subtitle: 'Aprobar solicitudes y confirmar ingresos de stock' },
    { id: 'entregas', label: 'Entregas', icon: 'delivery', title: 'Entregas al Técnico', subtitle: 'Preparar y registrar entregas de materiales' },
    { id: 'devoluciones', label: 'Devoluciones', icon: 'return', title: 'Devoluciones', subtitle: 'Registrar materiales devueltos por el técnico' },
    { id: 'transporte', label: 'Transporte interno', icon: 'transfer', title: 'Transporte interno', subtitle: 'Control de mercadería entre sedes' },
    { id: 'proyectos', label: 'Proyectos', icon: 'map', title: 'Proyectos', subtitle: 'Administrar proyectos y requerimientos' },
    { id: 'inventario', label: 'Inventario', icon: 'box', title: 'Inventario', subtitle: 'Catálogo de materiales — edición habilitada' },
    { id: 'usuarios', label: 'Usuarios', icon: 'users', title: 'Gestión de Usuarios', subtitle: 'Crear, activar y desactivar cuentas' },
  ],
};

const SHARED_VIEWS: Record<string, ViewMeta> = {
  perfil: { title: 'Mi Perfil', subtitle: 'Información personal, seguridad y actividad reciente' },
  manual: { title: 'Manual de Usuario' },
};

const ROLE_EXTRA_VIEWS: Partial<Record<Role, Record<string, ViewMeta>>> = {
  analista: {
    'nueva-compra': { title: 'Nueva Solicitud de Compra', subtitle: 'Solicitar compra de materiales faltantes' },
  },
};

export function getViewMeta(role: Role, view: string): ViewMeta | undefined {
  const shared = SHARED_VIEWS[view];
  if (shared) return view === 'manual'
    ? { ...shared, subtitle: `Funciones disponibles para el rol ${ROLE_LABELS[role].toLowerCase()}` }
    : shared;
  return NAVIGATION_BY_ROLE[role].find(item => item.id === view) ?? ROLE_EXTRA_VIEWS[role]?.[view];
}

export function canAccessView(role: Role, view: string): boolean {
  return Boolean(
    SHARED_VIEWS[view]
    || NAVIGATION_BY_ROLE[role].some(item => item.id === view)
    || ROLE_EXTRA_VIEWS[role]?.[view],
  );
}
