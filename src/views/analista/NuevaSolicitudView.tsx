import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede, Proyecto } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';
import { Material } from '../../data/mockData';

interface Props { onToast: (msg: string) => void; usuario: string; onNav: (v: string) => void; }

interface LineaMat { skuId: string; nombre: string; cantidad: string; query: string; showDrop: boolean; }

const BLANK_FORM = { sede: 'Chiclayo' as Sede, ubicacion: '', descripcion: '', tecnico: '' };

export default function NuevaSolicitudView({ onToast, usuario, onNav }: Props) {
  const { state, dispatch } = useAppStore();
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [lineas, setLineas] = useState<LineaMat[]>([{ skuId: '', nombre: '', cantidad: '', query: '', showDrop: false }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [previewMat, setPreviewMat] = useState<Material | null>(null);

  /* ─── Project selector state ─── */
  const [proyectoQuery, setProyectoQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ nombre: '', cliente: '', responsable: '' });
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const matchingProjects = state.proyectos.filter(p =>
    proyectoQuery.length >= 2 &&
    (p.nombre.toLowerCase().includes(proyectoQuery.toLowerCase()) ||
     p.cliente.toLowerCase().includes(proyectoQuery.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectProject = (p: Proyecto) => {
    setSelectedProject(p);
    setProyectoQuery(p.nombre);
    setForm(prev => ({ ...prev, sede: p.sede, ubicacion: p.ubicacion, tecnico: p.responsable }));
    setShowDropdown(false);
    setShowCreateProject(false);
    setErrors(prev => ({ ...prev, proyecto: '' }));
  };

  const clearProject = () => {
    setSelectedProject(null);
    setProyectoQuery('');
    setForm({ ...BLANK_FORM });
  };

  const handleCreateProject = () => {
    const e: Record<string, string> = {};
    if (!newProject.nombre.trim()) e.nombre = 'Requerido';
    if (!newProject.cliente.trim()) e.cliente = 'Requerido';
    if (!newProject.responsable.trim()) e.responsable = 'Requerido';
    if (!form.ubicacion.trim()) e.ubicacion = 'Ingresa la ubicación del proyecto';
    if (Object.keys(e).length) { setProjectErrors(e); return; }
    const dup = state.proyectos.find(p => p.nombre.toLowerCase() === newProject.nombre.toLowerCase());
    if (dup) { setProjectErrors({ nombre: 'Ya existe un proyecto con este nombre' }); return; }
    dispatch({ type: 'CREATE_PROYECTO', payload: { nombre: newProject.nombre, cliente: newProject.cliente, responsable: newProject.responsable, sede: form.sede, ubicacion: form.ubicacion, observaciones: '' } });
    // After dispatch the project will be in state next render — for now use a temporary id
    setProyectoQuery(newProject.nombre);
    setShowCreateProject(false);
    setShowDropdown(false);
    onToast('✓ Proyecto creado y seleccionado');
  };

  const setField = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  const addLinea = () => setLineas(p => [...p, { skuId: '', nombre: '', cantidad: '', query: '', showDrop: false }]);
  const removeLinea = (i: number) => setLineas(p => p.filter((_, j) => j !== i));

  const selectMaterial = (i: number, mat: { id: string; nombre: string }) => {
    setLineas(p => p.map((l, j) => j !== i ? l : { ...l, skuId: mat.id, nombre: mat.nombre, query: mat.nombre, showDrop: false }));
  };

  const updateMatQuery = (i: number, q: string) => {
    setLineas(p => p.map((l, j) => j !== i ? l : { ...l, query: q, skuId: '', nombre: '', showDrop: true }));
  };

  const updateCantidad = (i: number, v: string) => {
    setLineas(p => p.map((l, j) => j !== i ? l : { ...l, cantidad: v }));
  };

  const closeDrop = (i: number) => {
    setLineas(p => p.map((l, j) => j !== i ? l : { ...l, showDrop: false }));
  };

  const getMatchingMats = (query: string) =>
    query.length < 2 ? [] : state.materials.filter(m =>
      m.nombre.toLowerCase().includes(query.toLowerCase()) ||
      m.id.toLowerCase().includes(query.toLowerCase()) ||
      (m.categoria && m.categoria.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 8);

  const validate = (draft: boolean) => {
    const e: Record<string, string> = {};
    if (!selectedProject && !proyectoQuery.trim()) e.proyecto = 'Selecciona o crea un proyecto';
    if (!form.ubicacion.trim()) e.ubicacion = 'Requerido';
    if (!form.descripcion.trim()) e.descripcion = 'Requerido';
    if (!draft && !form.tecnico.trim()) e.tecnico = 'Requerido para enviar';
    const validLineas = lineas.filter(l => (l.skuId || l.nombre) && parseFloat(l.cantidad) > 0);
    if (!draft && validLineas.length === 0) e.materiales = 'Agrega al menos un material con cantidad';
    return e;
  };

  const handleSave = (draft: boolean) => {
    const e = validate(draft);
    if (Object.keys(e).length) { setErrors(e); return; }
    const validLineas = lineas.filter(l => (l.skuId || l.nombre) && parseFloat(l.cantidad) > 0);

    // find project id — either selected or recently created
    const resolvedProject = selectedProject || state.proyectos.find(p => p.nombre === proyectoQuery);
    const proyectoId = resolvedProject?.id ?? '';
    const proyectoNombre = resolvedProject?.nombre ?? proyectoQuery;
    const tecnico = form.tecnico || resolvedProject?.responsable || '';

    dispatch({
      type: 'CREATE_REQUERIMIENTO',
      payload: {
        proyectoId,
        proyecto: proyectoNombre,
        sede: form.sede,
        ubicacion: form.ubicacion,
        descripcion: form.descripcion,
        tecnico,
        analista: usuario,
        materiales: validLineas.map(l => ({ skuId: l.skuId, nombre: l.nombre, cantidad: parseFloat(l.cantidad) })),
        draft,
      },
    });
    setSubmitted(true);
    onToast(draft ? 'Borrador guardado correctamente' : 'Solicitud enviada al coordinador');
    setTimeout(() => onNav('mis-solicitudes'), 1200);
  };

  if (submitted) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}><svg width="26" height="26" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#18181B' }}>Solicitud enviada</div>
        <div style={{ fontSize: 13, color: '#71717A' }}>Redirigiendo...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Sección 1: Proyecto */}
        <div className="panel">
          <div className="section-header"><span className="section-title">1 · Proyecto</span></div>
          <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Project autocomplete */}
            <div style={{ gridColumn: '1/-1' }} ref={dropdownRef}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>
                Proyecto <span style={{ color: '#DC2626' }}>*</span>
                <span style={{ fontWeight: 400, color: '#A1A1AA', marginLeft: 6 }}>Busca un proyecto existente o crea uno nuevo</span>
              </label>
              <div style={{ position: 'relative' }}>
                {selectedProject ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{selectedProject.nombre}</div>
                      <div style={{ fontSize: 11, color: '#71717A' }}>{selectedProject.sede} · {selectedProject.cliente}</div>
                    </div>
                    <button onClick={clearProject} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', fontSize: 16, padding: '0 4px' }}>✕</button>
                  </div>
                ) : (
                  <input className="input-field"
                    placeholder="Escribe para buscar… (mín. 2 caracteres)"
                    value={proyectoQuery}
                    style={{ borderColor: errors.proyecto ? '#DC2626' : undefined }}
                    onChange={e => { setProyectoQuery(e.target.value); setShowDropdown(true); setShowCreateProject(false); setErrors(p => ({ ...p, proyecto: '' })); }}
                    onFocus={() => setShowDropdown(true)}
                  />
                )}
                {errors.proyecto && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.proyecto}</div>}

                {/* Dropdown */}
                {!selectedProject && showDropdown && proyectoQuery.length >= 2 && (
                  <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                    {matchingProjects.length > 0 ? (
                      matchingProjects.map(p => (
                        <div key={p.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F4F4F5', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F9FAFB'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                          onClick={() => selectProject(p)}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{p.nombre}</div>
                          <div style={{ fontSize: 11, color: '#71717A' }}>{p.sede} · {p.cliente} · Resp: {p.responsable}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '10px 14px', fontSize: 13, color: '#71717A' }}>
                        No se encontraron proyectos con "{proyectoQuery}"
                      </div>
                    )}
                    <div style={{ padding: '10px 14px', background: '#F9FAFB', borderTop: '1px solid #E4E4E7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EFF6FF'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F9FAFB'}
                      onClick={() => { setShowDropdown(false); setShowCreateProject(true); setNewProject({ nombre: proyectoQuery, cliente: '', responsable: '' }); }}>
                      <span style={{ color: '#2563EB', fontWeight: 700, fontSize: 16 }}>+</span>
                      <span style={{ fontSize: 13, color: '#2563EB', fontWeight: 600 }}>Crear nuevo proyecto: "{proyectoQuery}"</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Create project inline panel */}
            {showCreateProject && !selectedProject && (
              <div style={{ gridColumn: '1/-1', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', marginBottom: 14 }}>+ Nuevo proyecto</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#52525B', marginBottom: 4 }}>Nombre *</label>
                    <input className="input-field" value={newProject.nombre}
                      style={{ borderColor: projectErrors.nombre ? '#DC2626' : undefined }}
                      onChange={e => { setNewProject(p => ({ ...p, nombre: e.target.value })); setProjectErrors(p => ({ ...p, nombre: '' })); }} />
                    {projectErrors.nombre && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{projectErrors.nombre}</div>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#52525B', marginBottom: 4 }}>Cliente *</label>
                    <input className="input-field" placeholder="Razón social del cliente" value={newProject.cliente}
                      style={{ borderColor: projectErrors.cliente ? '#DC2626' : undefined }}
                      onChange={e => { setNewProject(p => ({ ...p, cliente: e.target.value })); setProjectErrors(p => ({ ...p, cliente: '' })); }} />
                    {projectErrors.cliente && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{projectErrors.cliente}</div>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#52525B', marginBottom: 4 }}>Responsable técnico *</label>
                    <input className="input-field" placeholder="Nombre y apellido" value={newProject.responsable}
                      style={{ borderColor: projectErrors.responsable ? '#DC2626' : undefined }}
                      onChange={e => { setNewProject(p => ({ ...p, responsable: e.target.value })); setProjectErrors(p => ({ ...p, responsable: '' })); }} />
                    {projectErrors.responsable && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{projectErrors.responsable}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleCreateProject}>Guardar proyecto</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowCreateProject(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Sede & Ubicacion — pre-filled if project selected */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Sede <span style={{ color: '#DC2626' }}>*</span></label>
              <select className="select-field" style={{ width: '100%' }} value={form.sede}
                disabled={!!selectedProject}
                onChange={e => setField('sede', e.target.value)}>
                {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Ubicación específica <span style={{ color: '#DC2626' }}>*</span></label>
              <input className="input-field" placeholder="Ej. Av. La Marina 450, Mz. B"
                style={{ borderColor: errors.ubicacion ? '#DC2626' : undefined }}
                value={form.ubicacion} onChange={e => setField('ubicacion', e.target.value)} />
              {errors.ubicacion && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.ubicacion}</div>}
            </div>
          </div>
        </div>

        {/* Sección 2: Descripción */}
        <div className="panel">
          <div className="section-header"><span className="section-title">2 · Descripción del Requerimiento</span></div>
          <div style={{ padding: '20px 22px' }}>
            <textarea className="input-field" rows={4}
              placeholder="Describe el trabajo a realizar, el alcance del proyecto y la necesidad de los materiales solicitados…"
              style={{ resize: 'vertical', fontFamily: 'inherit', borderColor: errors.descripcion ? '#DC2626' : undefined }}
              value={form.descripcion} onChange={e => setField('descripcion', e.target.value)} />
            {errors.descripcion && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.descripcion}</div>}
          </div>
        </div>

        {/* Sección 3: Técnico */}
        <div className="panel">
          <div className="section-header"><span className="section-title">3 · Técnico Responsable</span></div>
          <div style={{ padding: '20px 22px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>
              Nombre y apellido del técnico <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input className="input-field" style={{ maxWidth: 380, borderColor: errors.tecnico ? '#DC2626' : undefined }}
              placeholder="Ej. Luis Alberto Reyes Castillo"
              value={form.tecnico} onChange={e => setField('tecnico', e.target.value)} />
            {errors.tecnico && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.tecnico}</div>}
            {selectedProject && (
              <div style={{ fontSize: 11, color: '#059669', marginTop: 5 }}>
                ↑ Pre-completado desde el proyecto. Puedes modificarlo si el técnico es diferente.
              </div>
            )}
          </div>
        </div>

        {/* Sección 4: Materiales */}
<div className="panel">
  <div className="section-header">
    <span className="section-title">4 · Materiales Requeridos</span>

    <button
      className="btn btn-ghost"
      style={{ fontSize: 12 }}
      onClick={addLinea}
    >
      + Agregar material
    </button>
  </div>

  {errors.materiales && (
    <div
      style={{
        margin: '0 16px 8px',
        background: '#FEE2E2',
        borderRadius: 5,
        padding: '6px 12px',
        fontSize: 12,
        color: '#DC2626',
      }}
    >
      {errors.materiales}
    </div>
  )}

  <div style={{ padding: '8px 16px 16px' }}>

    {/* Encabezados */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) 110px 120px 36px 36px',
        gap: 10,
        alignItems: 'center',
        marginBottom: 7,
        padding: '0 2px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#71717A',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Material (nombre o código)
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#71717A',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Cant.
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#71717A',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign: 'center',
        }}
      >
        Stock en sede
      </div>

      <div />
      <div />
    </div>

    {/* Líneas de materiales */}
    {lineas.map((linea, i) => {
      const mat = state.materials.find(m => m.id === linea.skuId);

      const stockSede = mat
        ? mat.stockSedes[form.sede]
        : null;

      const cantNum = parseFloat(linea.cantidad) || 0;

      const overStock =
        stockSede !== null &&
        cantNum > stockSede;

      const matches = getMatchingMats(linea.query);

      return (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) 110px 120px 36px 36px',
            gap: 10,
            alignItems: 'center',
            marginBottom: 10,
          }}
        >

          {/* Material */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              minWidth: 0,
            }}
          >
            {linea.skuId ? (
              <div
                style={{
                  width: '100%',
                  height: 42,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 8,
                  padding: '0 12px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#18181B',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {linea.nombre}
                  </div>

                  <div
                    style={{
                      fontSize: 10.5,
                      color: '#71717A',
                      fontFamily: 'monospace',
                    }}
                  >
                    {linea.skuId}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateMatQuery(i, '')}
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#71717A',
                    fontSize: 15,
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <input
                className="input-field"
                placeholder="Escribe el nombre del material…"
                value={linea.query}
                style={{
                  width: '100%',
                  height: 42,
                  boxSizing: 'border-box',
                }}
                onChange={e =>
                  updateMatQuery(i, e.target.value)
                }
                onFocus={() =>
                  setLineas(p =>
                    p.map((l, j) =>
                      j !== i
                        ? l
                        : {
                            ...l,
                            showDrop: true,
                          }
                    )
                  )
                }
                onBlur={() =>
                  setTimeout(() => closeDrop(i), 150)
                }
              />
            )}

            {/* Autocomplete */}
            {!linea.skuId &&
              linea.showDrop &&
              linea.query.length >= 2 && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 50,
                    top: 'calc(100% + 3px)',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #E4E4E7',
                    borderRadius: 10,
                    boxShadow:
                      '0 8px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  {matches.length > 0 ? (
                    matches.map(m => (
                      <div
                        key={m.id}
                        onMouseDown={() =>
                          selectMaterial(i, m)
                        }
                        style={{
                          padding: '9px 14px',
                          cursor: 'pointer',
                          borderBottom:
                            '1px solid #F4F4F5',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                        onMouseEnter={e =>
                          (
                            e.currentTarget as HTMLElement
                          ).style.background = '#F8F9FF'
                        }
                        onMouseLeave={e =>
                          (
                            e.currentTarget as HTMLElement
                          ).style.background = ''
                        }
                      >
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: '#18181B',
                            }}
                          >
                            {m.nombre}
                          </div>

                          <div
                            style={{
                              fontSize: 10.5,
                              color: '#8B8FA8',
                              fontFamily: 'monospace',
                            }}
                          >
                            {m.id} · {m.categoria}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 11,
                            color:
                              m.stockSedes[
                                form.sede
                              ] > 0
                                ? '#059669'
                                : '#DC2626',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {m.stockSedes[form.sede]} UND
                        </span>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: '9px 14px',
                        fontSize: 12.5,
                        color: '#71717A',
                      }}
                    >
                      Sin coincidencias — se registrará
                      como nuevo material
                    </div>
                  )}

                  {matches.length > 0 && (
                    <div
                      onMouseDown={() =>
                        selectMaterial(i, {
                          id: `NEW-${Date.now()}`,
                          nombre: linea.query,
                        })
                      }
                      style={{
                        padding: '9px 14px',
                        background: '#F8F9FF',
                        borderTop:
                          '1px solid #E4E4E7',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={e =>
                        (
                          e.currentTarget as HTMLElement
                        ).style.background = '#EFF6FF'
                      }
                      onMouseLeave={e =>
                        (
                          e.currentTarget as HTMLElement
                        ).style.background = '#F8F9FF'
                      }
                    >
                      <span
                        style={{
                          color: '#2563EB',
                          fontWeight: 700,
                        }}
                      >
                        +
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          color: '#2563EB',
                          fontWeight: 600,
                        }}
                      >
                        Usar "{linea.query}" como nuevo
                        material
                      </span>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Cantidad */}
          <div
            style={{
              width: '100%',
              height: 42,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <input
              className="input-field"
              type="number"
              min="1"
              placeholder="0"
              value={linea.cantidad}
              onChange={e =>
                updateCantidad(i, e.target.value)
              }
              style={{
                width: '100%',
                minWidth: 0,
                height: 42,
                boxSizing: 'border-box',
                textAlign: 'right',
                padding: '0 8px',
                borderColor: overStock
                  ? '#DC2626'
                  : undefined,
              }}
            />

            <span
              style={{
                fontSize: 16,
                color: '#71717A',
                whiteSpace: 'nowrap',
              }}
            >
              UND
            </span>
          </div>

          {/* Stock */}
          <div
            style={{
              height: 42,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontFamily: 'monospace',
              textAlign: 'center',
              color: overStock
                ? '#DC2626'
                : stockSede === null
                  ? '#A1A1AA'
                  : stockSede === 0
                    ? '#DC2626'
                    : '#059669',
              fontWeight: 600,
            }}
          >
            <span>
              {stockSede === null
                ? '—'
                : `${stockSede} UND`}
            </span>

            {overStock && (
              <span
                style={{
                  fontSize: 9.5,
                  lineHeight: 1,
                  marginTop: 2,
                  color: '#DC2626',
                }}
              >
                insuficiente
              </span>
            )}
          </div>

          {/* Vista previa */}
          <div
            style={{
              width: 36,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {mat && (
              <PreviewBtn
                onClick={e => {
                  e.stopPropagation();
                  setPreviewMat(mat);
                }}
              />
            )}
          </div>

          {/* Eliminar */}
          <div
            style={{
              width: 36,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => removeLinea(i)}
              style={{
                width: 36,
                height: 42,
                borderRadius: 8,
                border: '1px solid #ffffff',
                background: '#DC2626',
                cursor: 'pointer',
                color: '#ffffff',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>
      );
    })}

    <button
      className="btn btn-ghost"
      style={{
        marginTop: 8,
        fontSize: 12,
      }}
      onClick={addLinea}
    >
      + Agregar línea
    </button>
  </div>
</div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 24 }}>
          <button className="btn btn-ghost" onClick={() => onNav('mis-solicitudes')}>Cancelar</button>
          <button className="btn btn-ghost" style={{ borderColor: '#2563EB', color: '#2563EB', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleSave(true)}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 2h9l2 2v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 2v4h5V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="8.5" width="7" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.3"/></svg>
            Guardar borrador
          </button>
          <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleSave(false)}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 1l13 6.5L1 14V9l8-1.5L1 6V1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            Enviar al coordinador
          </button>
        </div>
      </div>

      {previewMat && <MaterialPreviewModal material={previewMat} onClose={() => setPreviewMat(null)} />}
    </div>
  );
}
