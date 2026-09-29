import { Role } from '../../domain/types';

type ManualSection = {
  title: string;
  summary: string;
  tasks: string[];
};

type RoleManual = {
  label: string;
  description: string;
  accent: string;
  bg: string;
  sections: ManualSection[];
};

const MANUAL_BY_ROLE: Record<Role, RoleManual> = {
  gerente: {
    label: 'Gerente',
    accent: '#7C3AED',
    bg: '#F3E8FF',
    description:
      'Supervisa el comportamiento general del sistema, revisa indicadores operativos y consulta la información consolidada de proyectos, stock y requerimientos.',
    sections: [
      {
        title: 'Dashboard general',
        summary:
          'Muestra una lectura ejecutiva de solicitudes, aprobaciones, rechazos y alertas de inventario.',
        tasks: [
          'Revisar el total de solicitudes registradas y separar pendientes, confirmadas y rechazadas.',
          'Detectar materiales en estado bajo, critico o agotado para priorizar coordinaciones.',
          'Comparar actividad por sede para identificar donde se concentran los requerimientos.',
          'Consultar la actividad reciente para ver proyecto, sede, analista, fecha y estado.',
        ],
      },
      {
        title: 'Reportes',
        summary:
          'Centraliza analisis de requerimientos, stock e indicadores para tomar decisiones de gestion.',
        tasks: [
          'Evaluar tendencias por sede, estado y periodo operativo.',
          'Identificar cuellos de botella entre solicitudes pendientes y confirmadas.',
          'Usar los indicadores para revisar desempeno y necesidades de abastecimiento.',
        ],
      },
      {
        title: 'Proyectos',
        summary:
          'Permite consultar los proyectos registrados y su relacion con sedes, responsables y requerimientos.',
        tasks: [
          'Buscar proyectos por nombre, sede, cliente o responsable.',
          'Revisar ubicacion, observaciones y datos de responsabilidad de cada proyecto.',
          'Usar la informacion del proyecto como contexto para validar volumen de materiales solicitados.',
        ],
      },
      {
        title: 'Inventario',
        summary:
          'Es una vista de consulta para ver existencias y estado de materiales sin modificar el catalogo.',
        tasks: [
          'Consultar stock por sede y stock total disponible.',
          'Revisar unidad, marca, categoria, precio referencial y stock minimo.',
          'Detectar materiales con alertas para pedir seguimiento al coordinador.',
        ],
      },
    ],
  },
  analista: {
    label: 'Analista',
    accent: '#2563EB',
    bg: '#DBEAFE',
    description:
      'Registra requerimientos de materiales, hace seguimiento a sus solicitudes, prepara entregas y solicita compras cuando el stock no cubre la necesidad.',
    sections: [
      {
        title: 'Mi panel',
        summary:
          'Resume tus solicitudes, estados actuales y accesos directos para continuar el trabajo diario.',
        tasks: [
          'Ver cuantas solicitudes tienes en borrador, enviadas, confirmadas y rechazadas.',
          'Abrir solicitudes recientes para revisar proyecto, tecnico, sede, fecha y materiales.',
          'Entrar rapidamente a nueva solicitud, historial o inventario.',
        ],
      },
      {
        title: 'Nueva solicitud',
        summary:
          'Sirve para registrar un requerimiento de materiales asociado a un proyecto y tecnico.',
        tasks: [
          'Seleccionar proyecto, sede, ubicacion, tecnico responsable y descripcion del trabajo.',
          'Agregar materiales por SKU, nombre, cantidad, unidad y marca cuando aplique.',
          'Guardar como borrador si falta informacion o enviar al coordinador para revision.',
          'Corregir cantidades antes de enviar para evitar rechazos o demoras.',
        ],
      },
      {
        title: 'Mis solicitudes',
        summary:
          'Lista el historial de requerimientos creados por tu usuario y permite revisar su avance.',
        tasks: [
          'Filtrar solicitudes por estado: borrador, enviado, confirmado o rechazado.',
          'Revisar observaciones del coordinador cuando una solicitud fue rechazada.',
          'Dar seguimiento a solicitudes confirmadas antes de preparar la entrega al tecnico.',
        ],
      },
      {
        title: 'Proyectos',
        summary:
          'Permite ubicar el proyecto correcto antes de crear una solicitud o revisar su contexto.',
        tasks: [
          'Buscar proyectos disponibles por sede, cliente, responsable o ubicacion.',
          'Confirmar que el requerimiento se cargue al proyecto correspondiente.',
          'Consultar observaciones del proyecto antes de solicitar materiales.',
        ],
      },
      {
        title: 'Entregas',
        summary:
          'Registra la salida de materiales aprobados hacia el tecnico responsable.',
        tasks: [
          'Seleccionar requerimientos confirmados pendientes de entrega.',
          'Registrar DNI del tecnico, responsable de entrega, cantidades entregadas y observaciones.',
          'Marcar entregas completas o parciales segun la cantidad despachada.',
        ],
      },
      {
        title: 'Devoluciones',
        summary:
          'Permite registrar materiales que el tecnico devuelve luego de una entrega.',
        tasks: [
          'Seleccionar la entrega relacionada y validar el requerimiento de origen.',
          'Indicar cantidades devueltas por material y registrar observaciones.',
          'Adjuntar o describir evidencias cuando corresponda para mantener trazabilidad.',
        ],
      },
      {
        title: 'Ordenes de compra',
        summary:
          'Se usa cuando necesitas pedir materiales faltantes o insuficientes para cubrir una solicitud.',
        tasks: [
          'Crear una solicitud de compra con sede, motivo, items y cantidades requeridas.',
          'Enviar la compra al coordinador para aprobacion.',
          'Revisar si fue aprobada, comprada o rechazada desde Mis Ordenes de Compra.',
        ],
      },
      {
        title: 'Inventario',
        summary:
          'Permite consultar existencias antes de solicitar materiales o generar una compra.',
        tasks: [
          'Ver stock por sede para confirmar disponibilidad real.',
          'Identificar materiales bajos, criticos o agotados.',
          'Usar SKU, nombre, categoria y unidad para armar solicitudes con precision.',
        ],
      },
    ],
  },
  coordinador: {
    label: 'Coordinador',
    accent: '#0F766E',
    bg: '#CCFBF1',
    description:
      'Valida requerimientos, administra inventario, controla compras, gestiona usuarios y mantiene la trazabilidad de entregas y devoluciones.',
    sections: [
      {
        title: 'Panel de coordinacion',
        summary:
          'Concentra pendientes, alertas de stock y actividad por sede para priorizar el trabajo.',
        tasks: [
          'Ver solicitudes enviadas que requieren revision.',
          'Entrar a requerimientos pendientes desde las tarjetas o botones de revision.',
          'Controlar alertas de inventario y acceder al catalogo completo.',
        ],
      },
      {
        title: 'Requerimientos',
        summary:
          'Es el espacio principal para aprobar o rechazar solicitudes enviadas por analistas.',
        tasks: [
          'Revisar proyecto, sede, tecnico, descripcion y lista de materiales solicitados.',
          'Confirmar solicitudes cuando la informacion y el stock son correctos.',
          'Rechazar solicitudes con observaciones claras para que el analista pueda corregir.',
          'Mantener trazabilidad de quien confirma y cuando se realiza la validacion.',
        ],
      },
      {
        title: 'Compras',
        summary:
          'Permite aprobar solicitudes de compra y registrar cuando el material ya fue comprado.',
        tasks: [
          'Evaluar motivo, sede, items y cantidades solicitadas por el analista.',
          'Aprobar o rechazar la compra incluyendo observaciones cuando sea necesario.',
          'Confirmar la compra para reflejar el ingreso o avance del abastecimiento.',
        ],
      },
      {
        title: 'Inventario',
        summary:
          'El coordinador puede mantener el catalogo y revisar stock por sede.',
        tasks: [
          'Consultar SKU, nombre, descripcion, unidad, categoria, marca y precio referencial.',
          'Revisar stock minimo y estado del material: OK, bajo, critico o agotado.',
          'Actualizar informacion del catalogo cuando el flujo de inventario lo requiera.',
        ],
      },
      {
        title: 'Usuarios',
        summary:
          'Administra cuentas del sistema y controla quienes pueden ingresar.',
        tasks: [
          'Crear usuarios con nombre, correo, rol, sede y datos complementarios.',
          'Activar o desactivar cuentas segun corresponda.',
          'Filtrar usuarios por rol, estado o texto para auditoria rapida.',
        ],
      },
      {
        title: 'Proyectos',
        summary:
          'Gestiona y consulta proyectos para ordenar requerimientos por sede y responsabilidad.',
        tasks: [
          'Crear o revisar proyectos con cliente, ubicacion, sede y responsable.',
          'Usar el proyecto como referencia al validar requerimientos de materiales.',
          'Mantener informacion clara para que los analistas soliciten contra el proyecto correcto.',
        ],
      },
      {
        title: 'Entregas',
        summary:
          'Permite registrar la salida fisica de materiales aprobados.',
        tasks: [
          'Preparar entregas a partir de requerimientos confirmados.',
          'Registrar tecnico, DNI, cantidades entregadas y observaciones.',
          'Controlar entregas parciales cuando no se despacha todo el material solicitado.',
        ],
      },
      {
        title: 'Devoluciones',
        summary:
          'Registra el retorno de materiales entregados para cerrar el ciclo operativo.',
        tasks: [
          'Seleccionar entrega y requerimiento relacionados.',
          'Registrar materiales, cantidades devueltas y observaciones.',
          'Conservar evidencia y trazabilidad del responsable de recepcion.',
        ],
      },
    ],
  },
};

interface Props {
  role: Role;
  onNav: (view: string) => void;
}

export default function ManualUsuarioView({ role, onNav }: Props) {
  const manual = MANUAL_BY_ROLE[role];

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1, minWidth: 0 }}>
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E4E7',
          borderRadius: 12,
          padding: 24,
          marginBottom: 18,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <span
            style={{
              background: manual.bg,
              color: manual.accent,
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Manual de Usuario
          </span>
          <span style={{ color: '#71717A', fontSize: 13 }}>Rol: {manual.label}</span>
        </div>
        <h2 style={{ margin: '0 0 10px', color: '#18181B', fontSize: 26, lineHeight: 1.15 }}>
          Que puede hacer el {manual.label.toLowerCase()} en el sistema
        </h2>
        <p style={{ margin: 0, color: '#52525B', fontSize: 14.5, lineHeight: 1.65, maxWidth: 900 }}>
          {manual.description}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {manual.sections.map((section, index) => (
          <section
            key={section.title}
            className="panel"
            style={{
              minWidth: 0,
              overflow: 'hidden',
              borderTop: `4px solid ${manual.accent}`,
            }}
          >
            <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #F4F4F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: manual.bg,
                    color: manual.accent,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <h3 style={{ margin: 0, fontSize: 15, color: '#18181B', lineHeight: 1.25 }}>
                  {section.title}
                </h3>
              </div>
              <p style={{ margin: 0, color: '#52525B', fontSize: 13, lineHeight: 1.55 }}>
                {section.summary}
              </p>
            </div>

            <ul style={{ margin: 0, padding: '14px 18px 18px 34px', color: '#3F3F46', fontSize: 12.5, lineHeight: 1.6 }}>
              {section.tasks.map((task) => (
                <li key={task} style={{ marginBottom: 7 }}>
                  {task}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={() => onNav('dashboard')}>
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
