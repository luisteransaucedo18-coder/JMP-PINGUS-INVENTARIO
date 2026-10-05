import type { Quote } from './domain'

/** Read the originating version, so later quotations never replace request data. */
export function quoteForRequirement(quotes: Quote[], requirementId: string) {
  return quotes.find(q => q.asignaciones.some(a => a.requerimiento_id === requirementId))
}

export default function QuoteProjectInfo({ quote }: { quote: Quote }) {
  const { proyecto_snapshot: project, presupuesto: budget } = quote
  const rows = [
    ['Cotización de origen', `${quote.codigo} · versión ${quote.version}`],
    ['Cliente', project.cliente],
    ['Responsable del proyecto', project.responsable],
    ['Departamento', budget.excel.departamento],
    ['Provincia', budget.excel.provincia],
    ['Distrito', budget.excel.distrito],
    ['Dirección del proyecto', project.ubicacion],
    ['Alcance de los trabajos', budget.alcance],
  ]
  return <div className="quote-note">
    <strong>Datos del proyecto cotizado</strong>
    <dl className="quote-totals">
      {rows.filter(([, value]) => value).map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{value}</dd></div>,
      )}
    </dl>
  </div>
}
