import type { Quote } from './domain'
import DataDetails, { type DetailField } from '../../components/DataDetails'

/** Read the originating version, so later quotations never replace request data. */
export function quoteForRequirement(quotes: Quote[], requirementId: string) {
  return quotes.find(q => q.asignaciones.some(a => a.requerimiento_id === requirementId))
}

export default function QuoteProjectInfo({ quote }: { quote: Quote }) {
  const { proyecto_snapshot: project, presupuesto: budget } = quote
  const fields: DetailField[] = [
    { label: 'Cliente', value: project.cliente },
    { label: 'Responsable del proyecto', value: project.responsable },
    { label: 'Sede de abastecimiento', value: budget.sede },
    { label: 'Departamento', value: budget.excel.departamento },
    { label: 'Provincia', value: budget.excel.provincia },
    { label: 'Distrito', value: budget.excel.distrito },
    { label: 'Técnico', value: budget.tecnico },
    { label: 'Dirección del proyecto', value: project.ubicacion, wide: true },
    { label: 'Alcance de los trabajos', value: budget.alcance, wide: true },
  ]
  return <DataDetails title="Datos del proyecto cotizado"
    reference={<>Cotización de origen: {quote.codigo} · versión {quote.version}</>}
    fields={fields} />
}
