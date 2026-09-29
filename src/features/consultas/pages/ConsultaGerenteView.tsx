import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppStore } from '../../../store/AppContext';
import { obtenerDevoluciones, type Devolucion } from '../../../services/devolucionService';
import { obtenerPerfiles } from '../../../services/perfilService';
import { obtenerTransportes, type Transporte } from '../../../services/transporteService';

export type ConsultaGerente = 'requerimientos' | 'compras' | 'entregas' | 'devoluciones' | 'transporte' | 'usuarios';

type UsuarioConsulta = {
  id: string;
  codigo?: string | null;
  nombre: string;
  email: string;
  rol: string;
  sede: string;
  estado: string;
};

type Row = {
  id: string;
  cells: ReactNode[];
  search: string;
  status: string;
  sede: string;
  date: string;
};

const FILTERABLE_TYPES: ConsultaGerente[] = ['requerimientos', 'compras', 'entregas', 'devoluciones', 'transporte'];

const CONFIG: Record<ConsultaGerente, { heading: string; description: string }> = {
  requerimientos: { heading: 'Requerimientos', description: 'Seguimiento general de solicitudes y materiales requeridos.' },
  compras: { heading: 'Órdenes de compra', description: 'Consulta del ciclo de compras y abastecimiento.' },
  entregas: { heading: 'Entregas', description: 'Historial de materiales entregados a técnicos.' },
  devoluciones: { heading: 'Devoluciones', description: 'Trazabilidad de materiales devueltos al inventario.' },
  transporte: { heading: 'Transporte interno', description: 'Movimientos de mercadería entre sedes.' },
  usuarios: { heading: 'Usuarios', description: 'Directorio y estado de las cuentas del sistema.' },
};

const HEADERS: Record<ConsultaGerente, string[]> = {
  requerimientos: ['Código', 'Proyecto', 'Sede', 'Analista', 'Fecha', 'Materiales', 'Estado'],
  compras: ['Orden', 'Sede', 'Analista', 'Fecha', 'Motivo', 'Unidades', 'Estado'],
  entregas: ['Entrega', 'Proyecto', 'Técnico', 'Fecha', 'Responsable', 'Unidades', 'Estado'],
  devoluciones: ['Código', 'Proyecto', 'Sede receptora', 'Analista', 'Fecha', 'Unidades', 'Estado'],
  transporte: ['Origen', 'Destino', 'Fecha de envío', 'Transportista', 'Guía', 'Unidades', 'Estado'],
  usuarios: ['Código', 'Nombre', 'Email', 'Rol', 'Sede', 'Estado'],
};

function Status({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const color = ['COMPLETA', 'COMPRADO', 'CONFIRMADO', 'VALIDADA', 'RECIBIDO', 'ACTIVO'].includes(normalized)
    ? 'green'
    : ['RECHAZADO', 'CANCELADA', 'CANCELADO', 'INACTIVO'].includes(normalized)
      ? 'red'
      : ['ENVIADO', 'EN_TRANSITO', 'PARCIAL', 'APROBADO'].includes(normalized)
        ? 'blue'
        : 'yellow';
  return <span className={`badge badge-${color}`}>{value.replace(/_/g, ' ')}</span>;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 8).toUpperCase() : value;
}

export default function ConsultaGerenteView({ type }: { type: ConsultaGerente }) {
  const { state } = useAppStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioConsulta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery('');
    setStatusFilter('');
    setSedeFilter('');
    setDateFrom('');
    setDateTo('');
    setError('');
    if (!['devoluciones', 'transporte', 'usuarios'].includes(type)) return;

    let active = true;
    setLoading(true);
    const load = async () => {
      if (type === 'devoluciones') setDevoluciones(await obtenerDevoluciones());
      if (type === 'usuarios') setUsuarios((await obtenerPerfiles()) as UsuarioConsulta[]);
      if (type === 'transporte') setTransportes(await obtenerTransportes());
    };
    void load()
      .catch(() => { if (active) setError('No se pudieron cargar los datos. Intenta actualizar la vista.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type]);

  const rows = useMemo<Row[]>(() => {
    if (type === 'requerimientos') return state.requerimientos.map(item => ({
      id: item.dbId ?? item.id,
      cells: [item.codigo ?? item.id, item.proyecto, item.sede, item.analista, item.fecha, `${item.materiales.length} SKU`, <Status value={item.estado} />],
      search: `${item.codigo} ${item.proyecto} ${item.sede} ${item.analista} ${item.estado}`,
      status: item.estado,
      sede: item.sede,
      date: item.fecha,
    }));
    if (type === 'compras') return state.compras.map(item => ({
      id: item.uuid ?? item.id,
      cells: [item.id, item.sede, item.analista, item.fecha, item.motivo, item.items.reduce((sum, row) => sum + row.cantidadSolicitada, 0), <Status value={item.estado} />],
      search: `${item.id} ${item.sede} ${item.analista} ${item.motivo} ${item.estado}`,
      status: item.estado,
      sede: item.sede,
      date: item.fecha,
    }));
    if (type === 'entregas') return state.entregas.map(item => ({
      id: item.id,
      cells: [shortId(item.id), item.proyectoNombre, item.tecnico, `${item.fecha} ${item.hora}`, item.responsableEntrega, item.items.reduce((sum, row) => sum + row.cantidadEntregada, 0), <Status value={item.estado} />],
      search: `${item.id} ${item.proyectoNombre} ${item.tecnico} ${item.responsableEntrega} ${item.estado}`,
      status: item.estado,
      sede: state.requerimientos.find(req => req.id === item.requerimientoId || req.dbId === item.requerimientoId)?.sede ?? '',
      date: item.fecha,
    }));
    if (type === 'devoluciones') return devoluciones.map(item => ({
      id: item.id,
      cells: [item.codigo, item.proyecto, item.sedeReceptora, item.analista, new Date(item.createdAt).toLocaleDateString('es-PE'), item.items.reduce((sum, row) => sum + row.cantidad, 0), <Status value={item.estado} />],
      search: `${item.codigo} ${item.proyecto} ${item.sedeReceptora} ${item.analista} ${item.estado}`,
      status: item.estado,
      sede: item.sedeReceptora,
      date: item.createdAt.slice(0, 10),
    }));
    if (type === 'transporte') return transportes.map(item => ({
      id: item.id,
      cells: [item.origen, item.destino, item.fecha_envio, item.transportista || 'Sin registrar', item.guia || 'Sin guía', item.traslado_items.reduce((sum, row) => sum + Number(row.cantidad), 0), <Status value={item.estado} />],
      search: `${item.origen} ${item.destino} ${item.transportista} ${item.guia} ${item.estado}`,
      status: item.estado,
      sede: `${item.origen}|${item.destino}`,
      date: item.fecha_envio.slice(0, 10),
    }));
    return usuarios.map(item => ({
      id: item.id,
      cells: [item.codigo ?? shortId(item.id), item.nombre, item.email, item.rol, item.sede, <Status value={item.estado} />],
      search: `${item.codigo} ${item.nombre} ${item.email} ${item.rol} ${item.sede} ${item.estado}`,
      status: item.estado,
      sede: item.sede,
      date: '',
    }));
  }, [devoluciones, state.compras, state.entregas, state.requerimientos, transportes, type, usuarios]);

  const statuses = [...new Set(rows.map(row => row.status).filter(Boolean))].sort();
  const sedes = [...new Set(rows.flatMap(row => row.sede.split('|')).filter(Boolean))].sort();
  const visibleRows = rows.filter(row => {
    const matchesQuery = row.search.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = !statusFilter || row.status === statusFilter;
    const matchesSede = !sedeFilter || row.sede.split('|').includes(sedeFilter);
    const matchesFrom = !dateFrom || !row.date || row.date >= dateFrom;
    const matchesTo = !dateTo || !row.date || row.date <= dateTo;
    return matchesQuery && matchesStatus && matchesSede && matchesFrom && matchesTo;
  });
  const config = CONFIG[type];
  const showFilters = FILTERABLE_TYPES.includes(type);
  const hasActiveFilters = Boolean(query || statusFilter || sedeFilter || dateFrom || dateTo);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('');
    setSedeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <section style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #E4E6F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#18181B' }}>{config.heading}</h2>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: '#71717A' }}>{config.description}</p>
            </div>
            <span className="badge badge-purple">Solo lectura</span>
          </div>
          <div aria-label={`Filtros de ${config.heading}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap', padding: showFilters ? 10 : 0, borderRadius: 8, background: showFilters ? '#F8F9FD' : 'transparent', border: showFilters ? '1px solid #E8EAF2' : 'none' }}>
            <input
              aria-label={`Buscar en ${config.heading}`}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por código, sede, persona o estado"
              className="input-field"
              style={{ width: showFilters ? 280 : 'min(390px, 100%)', minHeight: 38, background: '#FFFFFF' }}
            />
            {showFilters && (
              <>
                <select aria-label="Filtrar por estado" className="select-field" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={{ width: 160, minHeight: 38 }}>
                  <option value="">Todos los estados</option>
                  {statuses.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                </select>
                <select aria-label="Filtrar por sede" className="select-field" value={sedeFilter} onChange={event => setSedeFilter(event.target.value)} style={{ width: 145, minHeight: 38 }}>
                  <option value="">Todas las sedes</option>
                  {sedes.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                </select>
                <input aria-label="Fecha desde" title="Fecha desde" type="date" className="input-field" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} style={{ width: 145, minHeight: 38, background: '#FFFFFF' }} />
                <input aria-label="Fecha hasta" title="Fecha hasta" type="date" className="input-field" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} style={{ width: 145, minHeight: 38, background: '#FFFFFF' }} />
                {hasActiveFilters && <button type="button" className="btn btn-ghost" onClick={clearFilters} style={{ minHeight: 38, padding: '7px 11px', fontSize: 12 }}>Limpiar</button>}
              </>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A', fontVariantNumeric: 'tabular-nums' }}>{visibleRows.length} de {rows.length} registros</span>
          </div>
        </div>

        {error ? (
          <div role="alert" style={{ padding: 28, color: '#B91C1C', textAlign: 'center' }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: 34, color: '#71717A', textAlign: 'center' }}>Cargando datos...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>{HEADERS[type].map(header => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr><td colSpan={HEADERS[type].length} style={{ textAlign: 'center', padding: 34, color: '#71717A' }}>No hay registros que coincidan con la búsqueda.</td></tr>
                ) : visibleRows.map(row => (
                  <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${HEADERS[type][index]}`}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
