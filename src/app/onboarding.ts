import type { Role } from '../domain/types';
import { NAVIGATION_BY_ROLE, ROLE_LABELS } from './navigation';

export type TourStep = { id: string; title: string; description: string; view: string; target?: string };
export type TourStatus = 'completed' | 'skipped';

const descriptions: Record<Role, Record<string, string>> = {
  gerente: {
    cotizaciones: 'Consulta presupuestos, importes presentados y aceptados, versiones y resultados de proyectos. El resultado permanece provisional hasta conciliar los costos reales y cerrar la ejecución.',
    dashboard: 'Revisa solicitudes pendientes, confirmadas y rechazadas, actividad por sede y alertas de stock. Los indicadores resumen los datos visibles del sistema.',
    reportes: 'Elige un período para comparar solicitudes por sede, actividad de analistas y materiales solicitados. El estado del inventario muestra las existencias actuales.',
    requerimientos: 'Consulta solicitudes, sus proyectos, responsables y estados. Esta vista de gerencia permite revisar la información sin aprobar ni modificar solicitudes.',
    compras: 'Consulta las órdenes de compra y su avance para supervisar el abastecimiento. La gestión de aprobaciones e ingresos corresponde al coordinador.',
    entregas: 'Revisa el historial de materiales entregados a los técnicos y su relación con las solicitudes.',
    devoluciones: 'Consulta los materiales devueltos y sus entregas de origen para seguir su trazabilidad.',
    transporte: 'Supervisa los movimientos de mercadería entre sedes y consulta su estado y comprobantes.',
    proyectos: 'Busca proyectos y revisa sus datos, sede, responsables y observaciones para entender el contexto de los requerimientos.',
    inventario: 'Consulta los materiales, stock por sede, unidades y alertas. Tu rol dispone de consulta del catálogo.',
    usuarios: 'Consulta el directorio de usuarios y sus roles. La administración de las cuentas corresponde al coordinador.',
  },
  analista: {
    cotizaciones: 'Prepara el presupuesto del proyecto y envíalo a revisión. Después de la aprobación, registra la presentación y aceptación del cliente; solicita materiales por etapas y registra costos reales con comprobantes.',
    dashboard: 'Consulta el resumen de tus solicitudes y sus estados. Los accesos directos te llevan a las tareas habituales y el centro de ayuda explica los procesos.',
    'nueva-solicitud': 'Selecciona el proyecto, sede y técnico; describe el trabajo y agrega materiales con sus cantidades. Puedes guardar un borrador o enviar la solicitud al coordinador.',
    'mis-solicitudes': 'Filtra tus requerimientos por estado y revisa sus detalles. Consulta las observaciones si una solicitud fue rechazada y sigue el avance de las confirmadas.',
    proyectos: 'Busca y gestiona los proyectos disponibles. Revisa sede, cliente, ubicación y responsable antes de asociar una solicitud.',
    entregas: 'Registra la entrega de materiales aprobados al técnico. Identifica al responsable y las cantidades entregadas para dejar constancia de entregas parciales o completas.',
    devoluciones: 'Selecciona la entrega de origen y registra los materiales que devuelve el técnico, sus cantidades y observaciones.',
    'mis-compras': 'Sigue tus órdenes de compra y crea solicitudes de abastecimiento cuando falten materiales. Revisa el estado y las observaciones del coordinador.',
    inventario: 'Busca materiales por nombre o SKU y consulta las existencias de cada sede antes de pedir materiales o solicitar una compra.',
  },
  coordinador: {
    cotizaciones: 'Revisa los presupuestos enviados y aprueba u observa. Configura plantillas de tarifas por ciudad y modalidad, sigue la ejecución y cierra después de conciliar costos, consumo y devoluciones.',
    dashboard: 'Revisa solicitudes por confirmar, necesidades de abastecimiento y alertas de stock. Los accesos del panel te llevan a requerimientos e inventario.',
    requerimientos: 'Revisa las solicitudes enviadas por analistas, comprueba las cantidades y la disponibilidad, y confirma o rechaza según corresponda. Atiende los faltantes con compras o traslados.',
    compras: 'Revisa las solicitudes de compra, aprueba o rechaza y confirma el ingreso de los materiales adquiridos al stock.',
    entregas: 'Prepara y registra entregas de materiales de solicitudes aprobadas. Verifica técnico, responsable y cantidades despachadas.',
    devoluciones: 'Registra materiales devueltos por los técnicos vinculándolos con la entrega de origen y sus cantidades.',
    transporte: 'Gestiona envíos y recepciones de mercadería entre sedes y consulta sus comprobantes para mantener la trazabilidad del stock.',
    proyectos: 'Administra los proyectos, sus responsables y datos operativos que sirven de referencia para los requerimientos.',
    inventario: 'Busca y administra materiales del catálogo, consulta el stock por sede y revisa mínimos y alertas de disponibilidad.',
    usuarios: 'Crea cuentas, asigna los roles disponibles y activa o desactiva usuarios según sus responsabilidades.',
  },
};

export function buildTourSteps(role: Role): TourStep[] {
  const sections = NAVIGATION_BY_ROLE[role].map(item => ({
    id: item.id, title: item.title, description: descriptions[role][item.id], view: item.id,
    target: item.id === 'dashboard' ? '[data-tour="dashboard-summary"]' : '[data-tour-view] > :first-child',
  }));
  if (role === 'gerente') sections.splice(1, 0, {
    id: 'graphs', title: 'Cómo interpretar los gráficos', view: 'dashboard', target: '.dashboard-chart',
    description: 'Las barras comparan solicitudes confirmadas y pendientes por sede. Pasa el mouse por las barras y puntos para ver nombre, valor y explicación. La línea de stock compara sedes, no una evolución en el tiempo. Al cerrar el tutorial podrás explorar estos recuadros.',
  });
  return [
    { id: 'welcome', title: 'Bienvenido a JMP - Sistema de Gestión de Inventarios', view: 'dashboard', description: `Te acompañaremos en un recorrido por las funciones de tu rol ${ROLE_LABELS[role].toLowerCase()}. Usa Anterior y Siguiente para avanzar, o vuelve al tutorial desde el Manual de Usuario cuando lo necesites.` },
    { id: 'navigation', title: 'Tu menú de navegación', view: 'dashboard', target: 'navigation', description: 'El menú reúne las secciones disponibles para tu rol. En computadora se despliega al acercar el mouse o usar el teclado; en celular se abre con el botón de menú de la cabecera.' },
    ...sections,
    { id: 'profile', title: 'Tu perfil', view: 'perfil', target: '[data-tour-view] > :first-child', description: 'Consulta tu información personal, foto, seguridad y actividad reciente desde tu perfil en la cabecera o el menú.' },
    { id: 'manual', title: 'Ayuda y Manual de Usuario', view: 'manual', target: '[data-tour="restart"]', description: 'El manual explica las funciones de tu rol. Aquí puedes volver a iniciar este recorrido cuando quieras; también tienes un acceso permanente en el menú.' },
    { id: 'finish', title: 'Todo listo para comenzar', view: 'dashboard', description: 'Ya conoces las principales secciones de tu espacio de trabajo. Puedes volver a consultar el manual o repetir el recorrido cuando lo necesites.' },
  ];
}

export function tourStorageKey(userId: string) { return `jip:onboarding:v1:${userId}`; }

export function readTourStatus(userId: string): TourStatus | null {
  try {
    const value = localStorage.getItem(tourStorageKey(userId));
    return value === 'completed' || value === 'skipped' ? value : null;
  } catch { return null; }
}

export function saveTourStatus(userId: string, status: TourStatus): boolean {
  try { localStorage.setItem(tourStorageKey(userId), status); return true; }
  catch { return false; }
}
