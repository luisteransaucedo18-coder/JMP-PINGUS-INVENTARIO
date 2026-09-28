import { useMemo, useState } from 'react';

type HelpMode = 'faq' | 'manual';
type Step = { title: string; icon: string; description: string; tip?: string };
type Process = { id: string; icon: string; title: string; description: string; flow: string[]; steps: Step[] };

const faqs = [
  { category: 'Inventario', question: '¿Cómo puedo buscar un material?', answer: 'En Inventario usa el buscador con el nombre o código SKU del material.' },
  { category: 'Inventario', question: '¿Cómo consulto el stock?', answer: 'El listado muestra la disponibilidad registrada por sede para cada material.' },
  { category: 'Inventario', question: '¿Qué significan los estados del inventario?', answer: 'OK indica disponibilidad normal; BAJO, CRÍTICO y AGOTADO alertan niveles cada vez menores de stock.' },
  { category: 'Inventario', question: 'No encuentro un material.', answer: 'Revisa que el nombre o SKU estén escritos correctamente. Solo aparecen materiales registrados en el sistema.' },
  { category: 'Solicitudes', question: '¿Cómo consulto un requerimiento?', answer: 'En Mis Solicitudes puedes revisar tus requerimientos y filtrarlos por estado.' },
  { category: 'Solicitudes', question: '¿Qué significan los estados de un requerimiento?', answer: 'BORRADOR aún no se envía; ENVIADO espera revisión; CONFIRMADO fue atendido; RECHAZADO requiere revisar la observación si existe.' },
  { category: 'Solicitudes', question: '¿Por qué una acción se bloquea temporalmente?', answer: 'Mientras una operación se procesa, espera su confirmación y evita hacer clic varias veces para no duplicarla.' },
  { category: 'Compras', question: '¿Cómo creo una solicitud de compra?', answer: 'En Órdenes de Compra selecciona Crear una nueva solicitud y completa la sede, motivo y materiales.' },
  { category: 'Compras', question: '¿Cómo agrego materiales a una compra?', answer: 'Busca por nombre o SKU y selecciona un material existente. Luego indica la cantidad solicitada.' },
  { category: 'Compras', question: '¿Puedo crear un material desde una solicitud de compra?', answer: 'No. La solicitud permite seleccionar materiales que ya están registrados en el inventario.' },
  { category: 'Proyectos', question: '¿Cómo registro un proyecto?', answer: 'Desde Proyectos usa la opción para crear uno y completa la información solicitada antes de confirmar.' },
  { category: 'Proyectos', question: '¿Puedo repetir un proyecto?', answer: 'El sistema valida el nombre del proyecto para evitar registros duplicados.' },
  { category: 'Devoluciones', question: '¿Cómo registro una devolución?', answer: 'Selecciona el proyecto, los materiales entregados, las cantidades, la sede receptora y al menos una fotografía de evidencia.' },
  { category: 'Devoluciones', question: '¿Por qué debo seleccionar un proyecto?', answer: 'Así el sistema muestra los materiales entregados que siguen disponibles para devolver en ese proyecto.' },
  { category: 'Devoluciones', question: '¿Cuándo se actualiza el stock?', answer: 'El stock aumenta únicamente cuando el Coordinador valida la devolución.' },
  { category: 'Devoluciones', question: 'Mi devolución tiene una observación.', answer: 'Revisa el comentario del Coordinador y usa Corregir para ajustar y reenviar la devolución cuando el flujo lo habilite.' },
  { category: 'Cuenta y sesión', question: '¿Cómo cierro sesión?', answer: 'Usa Cerrar sesión en el menú lateral. Luego puedes volver a ingresar con tus credenciales.' },
  { category: 'Problemas frecuentes', question: 'Una operación está demorando.', answer: 'Espera el mensaje de confirmación del sistema. No presiones repetidamente el mismo botón.' },
  { category: 'Problemas frecuentes', question: 'No puedo registrar una devolución.', answer: 'Verifica el proyecto, las cantidades disponibles, la sede receptora y que hayas adjuntado al menos una fotografía.' },
];

const processes: Process[] = [
  { id: 'inventario', icon: '📦', title: 'Consultar inventario', description: 'Busca materiales y revisa su disponibilidad por sede.', flow: ['Inventario', 'Buscar', 'Revisar material', 'Consultar stock', 'Ver estado'], steps: [
    { icon: '📦', title: 'Abre Inventario', description: 'Ingresa al módulo Inventario desde el menú lateral.' },
    { icon: '🔎', title: 'Usa el buscador', description: 'Escribe el nombre o el código SKU del material que necesitas consultar.' },
    { icon: '🏢', title: 'Consulta el stock por sede', description: 'Revisa las cantidades disponibles para Chiclayo, Chimbote y Trujillo.' },
    { icon: '●', title: 'Revisa el estado', description: 'El estado muestra si el material está OK, BAJO, CRÍTICO o AGOTADO.', tip: 'Puedes usar los filtros del listado para concentrarte en un estado o sede.' },
  ]},
  { id: 'requerimientos', icon: '📋', title: 'Gestionar requerimientos', description: 'Crea y consulta tus solicitudes de materiales.', flow: ['Nueva solicitud', 'Proyecto', 'Datos', 'Materiales', 'Guardar o enviar'], steps: [
    { icon: '📋', title: 'Inicia una nueva solicitud', description: 'Selecciona Nueva Solicitud desde el menú o desde tus accesos rápidos.' },
    { icon: '🏗️', title: 'Selecciona el proyecto', description: 'Busca un proyecto existente. Si corresponde, el formulario permite registrar uno con sus datos requeridos.' },
    { icon: '📝', title: 'Completa la información', description: 'Indica sede, ubicación, técnico y la descripción del requerimiento.' },
    { icon: '📦', title: 'Agrega materiales', description: 'Busca cada material por nombre o SKU e indica la cantidad solicitada.' },
    { icon: '✓', title: 'Guarda o envía', description: 'Un borrador queda como BORRADOR. Al enviarlo, pasa a ENVIADO para su revisión; después podrá quedar CONFIRMADO o RECHAZADO.' },
  ]},
  { id: 'compras', icon: '🛒', title: 'Crear solicitud de compra', description: 'Solicita la compra de materiales existentes.', flow: ['Órdenes de compra', 'Nueva solicitud', 'Motivo', 'Materiales', 'Cantidad', 'Enviar'], steps: [
    { icon: '🛒', title: 'Abre Órdenes de Compra', description: 'Entra a Órdenes de Compra y selecciona Crear una nueva solicitud.' },
    { icon: '🏢', title: 'Indica sede y motivo', description: 'Selecciona la sede para la compra y describe el motivo de la solicitud.' },
    { icon: '🔎', title: 'Busca el material', description: 'Busca por nombre o SKU y selecciona el material del listado disponible.' },
    { icon: '➕', title: 'Añade cantidades', description: 'Indica la cantidad solicitada. El precio unitario es un dato opcional de estimación.' },
    { icon: '✓', title: 'Revisa y envía', description: 'Confirma los materiales y envía la solicitud. También puedes guardarla como borrador.', tip: 'Solo puedes seleccionar materiales que ya existen en el inventario.' },
  ]},
  { id: 'proyectos', icon: '🏗️', title: 'Gestionar proyectos', description: 'Consulta, crea y localiza proyectos registrados.', flow: ['Proyectos', 'Nuevo proyecto', 'Información', 'Validar', 'Registrar'], steps: [
    { icon: '🏗️', title: 'Abre Proyectos', description: 'Ingresa al módulo Proyectos desde el menú lateral.' },
    { icon: '➕', title: 'Crea un proyecto', description: 'Selecciona la opción de nuevo proyecto y completa los datos solicitados.' },
    { icon: '📝', title: 'Verifica la información', description: 'Revisa nombre, cliente, responsable, sede y ubicación antes de registrar.' },
    { icon: '✓', title: 'Confirma el registro', description: 'El sistema valida el nombre para evitar proyectos duplicados.' },
  ]},
  { id: 'devoluciones', icon: '↩️', title: 'Registrar devolución', description: 'Devuelve materiales entregados y adjunta su evidencia.', flow: ['Proyecto', 'Materiales', 'Cantidades', 'Sede', 'Evidencias', 'Registrar', 'Revisión'], steps: [
    { icon: '🏗️', title: 'Selecciona el proyecto', description: 'Elige el proyecto relacionado con los materiales que vas a devolver.' },
    { icon: '🔎', title: 'Busca materiales entregados', description: 'Usa el buscador por nombre o SKU para encontrar los materiales disponibles para devolución.' },
    { icon: '🔢', title: 'Indica las cantidades', description: 'Ingresa una cantidad que no supere la disponible para cada material.' },
    { icon: '🏢', title: 'Selecciona la sede receptora', description: 'Elige la sede donde se recibirá la devolución.' },
    { icon: '📷', title: 'Adjunta evidencias', description: 'Carga al menos una fotografía del material. Puedes adjuntar varias imágenes.', tip: 'Usa fotografías claras donde el material pueda identificarse.' },
    { icon: '✓', title: 'Registra la devolución', description: 'Revisa el resumen y selecciona Registrar devolución. Quedará pendiente de validación.' },
    { icon: '👥', title: 'Espera la revisión', description: 'El Analista registra la devolución. El Coordinador la valida o registra una observación. El stock solo aumenta al validarla.' },
  ]},
];

export default function AnalistaHelpCenter({ mode, onClose }: { mode: HelpMode; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const [selected, setSelected] = useState<Process | null>(null);
  const [step, setStep] = useState(0);
  const filteredFaqs = useMemo(() => faqs.filter(item => `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const isLast = selected && step === selected.steps.length - 1;

  const choose = (process: Process) => { setSelected(process); setStep(0); };
  const closeGuide = () => { setSelected(null); setStep(0); };

  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="help-center-title">
    <section className="modal analista-help-modal">
      <header className="modal-header"><div><h2 id="help-center-title">{mode === 'faq' ? 'Preguntas frecuentes' : 'Manual de Usuario'}</h2><p>{mode === 'faq' ? 'Respuestas para las tareas disponibles en tu rol.' : selected ? selected.title : '¿Qué deseas aprender a realizar?'}</p></div><button className="btn btn-ghost" onClick={onClose}>Cerrar</button></header>
      <div className="analista-help-body">
        {mode === 'faq' ? <>
          <input className="input-field" value={query} onChange={event => { setQuery(event.target.value); setOpenQuestion(null); }} placeholder="Buscar por tema, pregunta o palabra clave" aria-label="Buscar preguntas frecuentes" />
          <p className="analista-help-count">{filteredFaqs.length} respuesta{filteredFaqs.length === 1 ? '' : 's'} disponible{filteredFaqs.length === 1 ? '' : 's'}</p>
          <div className="analista-faq-list">{filteredFaqs.map((item, index) => <article key={`${item.category}-${item.question}`} className="analista-faq-item"><button onClick={() => setOpenQuestion(openQuestion === index ? null : index)} aria-expanded={openQuestion === index}><span><small>{item.category}</small>{item.question}</span><span aria-hidden="true">{openQuestion === index ? '−' : '+'}</span></button>{openQuestion === index && <p>{item.answer}</p>}</article>)}</div>
        </> : !selected ? <>
          <p className="analista-help-intro">Selecciona un proceso para conocer paso a paso cómo utilizar las principales funciones disponibles para tu rol.</p>
          <div className="analista-process-grid">{processes.map(process => <button className="analista-process-card" key={process.id} onClick={() => choose(process)}><span className="analista-process-icon">{process.icon}</span><strong>{process.title}</strong><span>{process.description}</span><span className="analista-process-link">Ver guía</span></button>)}</div>
        </> : <>
          <button className="analista-back" onClick={closeGuide}>← Volver al manual</button>
          <div className="analista-flow" aria-label="Flujo del proceso">{selected.flow.map((node, index) => <span key={node}>{node}{index < selected.flow.length - 1 && <i>›</i>}</span>)}</div>
          <div className="analista-guide-progress"><div><strong>Paso {Math.min(step + 1, selected.steps.length)} de {selected.steps.length}</strong><span>{Math.round(((step + 1) / selected.steps.length) * 100)}%</span></div><div className="analista-progress-track"><span style={{ width: `${((step + 1) / selected.steps.length) * 100}%` }} /></div></div>
          {isLast ? <div className="analista-complete"><div>✓</div><h3>¡Proceso completado!</h3><p>Ya conoces el procedimiento para {selected.title.toLowerCase()}.</p><div><button className="btn btn-ghost" onClick={() => setStep(0)}>Revisar nuevamente</button><button className="btn btn-primary" onClick={closeGuide}>Volver al manual</button></div></div> : <article className="analista-step" key={`${selected.id}-${step}`}><span className="analista-step-icon">{selected.steps[step].icon}</span><div><span className="analista-step-number">Paso {step + 1}</span><h3>{selected.steps[step].title}</h3><p>{selected.steps[step].description}</p>{selected.steps[step].tip && <aside><strong>Consejo</strong>{selected.steps[step].tip}</aside>}</div></article>}
          {!isLast && <div className="analista-guide-actions"><button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>← Anterior</button><button className="btn btn-primary" onClick={() => setStep(value => Math.min(selected.steps.length - 1, value + 1))}>Siguiente →</button></div>}
        </>}
      </div>
    </section>
  </div>;
}
