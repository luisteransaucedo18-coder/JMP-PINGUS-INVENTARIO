import { useEffect, useState } from 'react'
import { obtenerCotizacionesAnteriores, type LegacyQuote } from '../../services/cotizacionService'

export default function LegacyQuotations({ projectId }: { projectId?: string }) {
  const [quotes, setQuotes] = useState<LegacyQuote[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    obtenerCotizacionesAnteriores().then(data => {
      if (active) setQuotes(data)
    }).catch(error => {
      if (active) setError(error.message)
    })
    return () => { active = false }
  }, [])
  const visible = quotes.filter(q => !projectId || q.proyecto_id === projectId)
  if (error) return <p role="alert">No se pudieron consultar las cotizaciones anteriores: {error}</p>
  if (!visible.length) return null
  return <details className="panel quote-section">
    <summary>Cotizaciones existentes — formato anterior ({visible.length})</summary>
    <p className="quote-muted">Consulta del registro original. Para utilizar el nuevo flujo, prepara una cotización con las variables del Excel.</p>
    {visible.map(q => <details key={q.id} className="quote-section">
      <summary>{q.codigo} · versión {q.version_actual}</summary>
      {q.versiones.slice().sort((a,b) => b.numero-a.numero).map(v => <div key={v.numero}>
        <h3>Versión {v.numero} · {v.estado}</h3>
        <dl>{Object.entries(v.presupuesto).map(([name,value]) => <div key={name}>
          <dt>{name}</dt>
          <dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{typeof value === 'object' ? JSON.stringify(value,null,2) : String(value ?? '')}</dd>
        </div>)}</dl>
      </div>)}
    </details>)}
  </details>
}
