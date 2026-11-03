import { resetInventoryPageScroll } from '../../../utils/inventoryPagination';
import { readInventoryPreferences, saveInventoryPreferences } from '../../../utils/inventoryPreferences';
import { searchMaterials } from '../../../utils/materialSearch';
import DiscardChangesDialog from '../../../components/DiscardChangesDialog';
import RollStockInput from '../../../components/RollStockInput';
import { formatStock } from '../../../utils/rollStock';
import FieldError from "../../../components/FieldError";
import { formatPrecio } from '../../../utils/materialPrice';
import { SEDE_COLOR } from '../../../config/visualTokens';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../store/AppContext';
import { validRollLength, validStockQuantity } from '../../../utils/stockQuantity';
import { calcularEstado, estadoPorSede, estadoGeneral, matchesInventoryState, MINIMO_INICIAL_INVENTARIO } from '../../../utils/inventoryStatus';


import {
  obtenerMateriales,
  obtenerCategoriasMaterial,
  crearMaterial,
  actualizarMaterial,
} from '../../../services/materialService';

import {
  Role,
  SEDES,
  Sede,
  Material,
} from '../../../domain/types';

import StockStatusDialog from './StockStatusDialog';

import MaterialPreviewModal from '../../../components/MaterialPreviewModal';

// ======================================================
// TIPOS
// ======================================================

interface Props {
  preferenceKey?: string;
  role: Role;
  onToast: (msg: string) => void;
}

// ======================================================
// FORMULARIOS
// ======================================================

const FILTER_LABEL_STYLE = {
    fontSize: 12,
    color: '#71717A',
    fontWeight: 500,
    marginBottom: 8,
} as const;

const MATERIAL_CODE_STYLE = {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
} as const;

const DETAIL_LABEL_STYLE = {
    fontSize: 10,
    color: '#71717A',
    textTransform: 'uppercase',
    marginBottom: 4,
} as const;

const DETAIL_VALUE_STYLE = {
    fontSize: 13,
    fontWeight: 500,
} as const;

const STOCK_LABEL_STYLE = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: '#52525B',
    marginBottom: 6,
} as const;

const FULL_WIDTH_STYLE = {
    gridColumn: '1/-1',
} as const;

const BLANK_FORM = {
  id: '',
  nombre: '',
  descripcion: '',
  categoria: '',
  unidad: 'UND',
  metrosPorRollo: '',
  stockChiclayo: '',
  stockChimbote: '',
  stockTrujillo: '',
  minimo: String(MINIMO_INICIAL_INVENTARIO),
};

const BLANK_STOCK = {
  Chiclayo: '',
  Chimbote: '',
  Trujillo: '',
};

// ======================================================
// ESTILOS / CONFIG
// ======================================================

const ESTADO_BADGE: Record<string, string> = {
  OK: 'green',
  BAJO: 'amber',
  CRÍTICO: 'red',
  AGOTADO: 'red',
};

const UNIDADES_MATERIAL: Record<string, string> = {
  UND: 'Unidades (UND)', ROLLO: 'Rollos (ROLLO)', MTS: 'Metros (MTS)', GLD: 'Galones (GLD)', PAR: 'Pares (PAR)',
};

function ModalActions({ primaryLabel, onPrimary, onCancel, busy = false }: { primaryLabel: string; onPrimary: () => void; onCancel: () => void; busy?: boolean }) {
  return <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-divider)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
    <button className="btn btn-primary" disabled={busy} onClick={onPrimary}>{primaryLabel}</button>
    <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancelar</button>
  </div>;
}

function EstadosSedes({ material, sedes }: { material: Material; sedes: readonly Sede[] }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
    {sedes.map(sede => {
      const estado = estadoPorSede(material, sede);
      return <span key={sede} className={`badge status-badge badge-${ESTADO_BADGE[estado]}`}>
        {sedes.length > 1 ? `${sede}: ` : ''}{estado}
      </span>;
    })}
  </div>;
}

function MaterialModalHeader({ material, editing = false }: { material: Material; editing?: boolean }) {
  return <div className="modal-header">
    <div>
      <div style={{ fontSize: 11, color: '#2563EB', fontFamily: 'monospace', marginBottom: 3 }}>{material.id}</div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>{editing ? 'Editar stock — ' : ''}{material.nombre}</h2>
    </div>
  </div>;
}

function MaterialThumbnail({ material, onPreview }: { material: Material; onPreview: () => void }) {
  const [failedImage, setFailedImage] = useState<string>();
  const image = material.imagen?.trim();
  return <button
    type="button"
    className="inventory-material-thumbnail"
    aria-label={`Ver imagen de ${material.nombre}`}
    title={`Ver imagen de ${material.nombre}`}
    onClick={event => { event.stopPropagation(); onPreview(); }}
  >
    {image && failedImage !== image
      ? <img src={image} alt={material.nombre} loading="lazy" decoding="async" onError={() => setFailedImage(image)} />
      : <span>{image ? 'Imagen no disponible' : 'Sin imagen'}</span>}
  </button>;
}

// ======================================================
// COMPONENTE
// ======================================================

export default function InventarioView({
  role,
  onToast,
  preferenceKey,
}: Props) {

  // ====================================================
  // DATOS SUPABASE
  // ====================================================

  const [materiales, setMateriales] =
    useState<Material[]>([]);

  const [loading, setLoading] =
    useState(true);

  // ====================================================
  // PERMISOS
  // ====================================================

  const canEdit =
    role === 'coordinador';

  // ====================================================
  // FILTROS
  // ====================================================

  const savedFilters = useRef(readInventoryPreferences(preferenceKey)).current;
  const [showTechnical, setShowTechnical] = useState(savedFilters.technical);

  const [search, setSearch] =
    useState(savedFilters.search);

  const [catFilter, setCatFilter] =
    useState(savedFilters.category);

  const [estadoFilter, setEstadoFilter] =
    useState(savedFilters.status);

  const [sedeView, setSedeView] =
    useState<Sede | 'todas'>(savedFilters.sede);

  // ====================================================
  // MODALES
  // ====================================================

  const [selected, setSelected] =
    useState<Material | null>(null);

  const [showAdd, setShowAdd] =
    useState(false);

  const [editMode, setEditMode] =
    useState(false);

  const [previewMat, setPreviewMat] =
    useState<Material | null>(null);

  // ====================================================
  // FORMULARIO NUEVO MATERIAL
  // ====================================================

  const [form, setForm] =
    useState({
      ...BLANK_FORM,
    });

  const [addBaseline, setAddBaseline] = useState({ ...BLANK_FORM });
  const [discardTarget, setDiscardTarget] = useState<'add' | 'edit' | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] =
    useState<Record<string, string>>({});

  // ====================================================
  // EDITAR STOCK
  // ====================================================

  const [editStock, setEditStock] =
    useState<Record<string, string>>({
      ...BLANK_STOCK,
    });

  const [editMinimo, setEditMinimo] =
    useState('');
  const [editUnidad, setEditUnidad] = useState('UND');
  const [editMetrosPorRollo, setEditMetrosPorRollo] = useState('');
  const [categorias, setCategorias] = useState<Array<{ id: string; nombre: string }>>([]);
  const { state, refreshRemoteData } = useAppStore();
  const [saving, setSaving] = useState(false);
  const pendingSave = useRef(false);
  const [editRollErrors, setEditRollErrors] = useState<Record<string,string>>({});
  const [newRollErrors, setNewRollErrors] = useState<Record<string,string>>({});
  useEffect(() => setEditRollErrors({}), [editUnidad, editMetrosPorRollo]);
  useEffect(() => setNewRollErrors({}), [form.unidad, form.metrosPorRollo]);
  useEffect(() => setMateriales(state.materials), [state.materials]);

  const [pagination, setPagination] = useState({ page: 1, key: '' });
  const catalogTop = useRef<HTMLDivElement>(null);
  useEffect(() => saveInventoryPreferences(preferenceKey, { search, category: catFilter, status: estadoFilter, sede: sedeView, technical: showTechnical }), [preferenceKey, search, catFilter, estadoFilter, sedeView, showTechnical]);
  const categoryName = (id: string) => categorias.find(category => category.id === id)?.nombre || (/^\d+$/.test(id) ? `Categoría ${id}` : id);

  const addDirty = showAdd && JSON.stringify(form) !== JSON.stringify(addBaseline);
  const editDirty = editMode && selected !== null && (
    SEDES.some(sede => editStock[sede] !== String(selected.stockSedes[sede] ?? 0)) ||
    editMinimo !== String(selected.minimo ?? 0) || editUnidad !== (selected.unidad || 'UND') ||
    editMetrosPorRollo !== (selected.metrosPorRollo ? String(selected.metrosPorRollo) : '')
  );
  const closeEditor = (target: 'add' | 'edit') => {
    if (pendingSave.current) return;
    if (target === 'add') setShowAdd(false);
    else { setEditMode(false); setSelected(null); }
  };
  const requestClose = (target: 'add' | 'edit') => {
    if (pendingSave.current) return;
    if (target === 'add' ? addDirty : editDirty) setDiscardTarget(target);
    else closeEditor(target);
  };
  useEffect(() => {
    if (!addDirty && !editDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [addDirty, editDirty]);

  // ====================================================
  // CARGAR MATERIALES
  // ====================================================

  const [statusMaterial, setStatusMaterial] = useState<Material | null>(null);

  const cargarMateriales = async () => {
    try {
      setLoading(true);

      const [data, catalogoCategorias] = await Promise.all([obtenerMateriales(), obtenerCategoriasMaterial()]);
      setCategorias(catalogoCategorias);

      setMateriales(
        data ?? []
      );
    } catch (error) {
      console.error(
        'Error cargando materiales:',
        error
      );

      onToast(
        'Error al cargar materiales'
      );
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // CARGAR AL ENTRAR
  // ====================================================

  useEffect(() => {
    cargarMateriales();
  }, []);

  // ====================================================
  // CATEGORÍAS
  // ====================================================

  const cats = Array.from(
    new Set(
      materiales.map(
        (m) => m.categoria
      )
    )
  );

  // ====================================================
  // FILTROS
  // ====================================================

  const sedesVisibles = sedeView === 'todas' ? SEDES : [sedeView];

  const estadoVisible = (material: Material) => sedeView === 'todas' ? estadoGeneral(material) : estadoPorSede(material, sedeView);
  const scopedMaterials = searchMaterials(materiales, search, materiales.length, 0, material => categoryName(material.categoria)).filter(material =>
    !catFilter || material.categoria === catFilter
  );
  const filtered = scopedMaterials.filter(material => matchesInventoryState(material, sedeView, estadoFilter));
  const displayedState = (material: Material) => sedeView === 'todas' && estadoFilter ? estadoFilter : estadoVisible(material);
  const pageKey = JSON.stringify([search, catFilter, estadoFilter, sedeView]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = pagination.key === pageKey ? Math.min(pagination.page, pageCount) : 1;
  const pageMaterials = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const changePage = (page: number) => { setPagination({ page, key: pageKey }); resetInventoryPageScroll(catalogTop.current); };
  const changeSede = (sede: Sede | 'todas') => { setSedeView(sede); setPagination({ page: 1, key: '' }); };



  // ====================================================
  // STOCK DE UNA SEDE
  // ====================================================

  const obtenerStockSede = (
    material: Material,
    sede: Sede
  ) => {

    if (sede === 'Chiclayo') {
      return material.stockSedes.Chiclayo ?? 0;
    }

    if (sede === 'Chimbote') {
      return material.stockSedes.Chimbote ?? 0;
    }

    return material.stockSedes.Trujillo ?? 0;
  };

  // ====================================================
  // STOCK TOTAL
  // ====================================================

  const obtenerStockTotal = (
    material: Material
  ) => {
    return (
      Number(
        material.stockSedes.Chiclayo ?? 0
      ) +

      Number(
        material.stockSedes.Chimbote ?? 0
      ) +

      Number(
        material.stockSedes.Trujillo ?? 0
      )
    );
  };

  // ====================================================
  // VALIDACIÓN
  // ====================================================

  const validateAdd = () => {

    const e:
      Record<string, string> = {};

    if (!form.id.trim()) {
      e.id = 'Completa el código SKU.';
    }

    if (!form.nombre.trim()) {
      e.nombre = 'Completa el nombre del material.';
    }

    if (!form.descripcion.trim()) {
      e.descripcion = 'Completa la descripción técnica.';
    }

    if (!form.categoria.trim()) {
      e.categoria = 'Selecciona una categoría.';
    }

    if (
      form.minimo === '' ||
      isNaN(
        Number(form.minimo)
      )
    ) {
      e.minimo = 'Ingresa un stock mínimo válido.';
    }

    if (!validStockQuantity(Number(form.minimo))) e.minimo = 'Ingresa un valor mayor o igual a cero.';
    if (form.unidad === 'ROLLO' && form.metrosPorRollo && !validRollLength(Number(form.metrosPorRollo))) e.metrosPorRollo = 'Indica una longitud válida mayor que cero.';
    for (const sede of SEDES) { const key = `stock${sede}` as 'stockChiclayo' | 'stockChimbote' | 'stockTrujillo'; if (!validStockQuantity(Number(form[key])) || newRollErrors[sede]) e[key] = newRollErrors[sede] || 'Usa un stock válido con hasta tres decimales.'; }
    return e;
  };

  useEffect(() => {
    const validation = validateAdd();
    setErrors(previous => Object.fromEntries(Object.keys(previous).filter(key => validation[key]).map(key => [key, validation[key]])));
  }, [form]);

  // ====================================================
  // CREAR MATERIAL
  // ====================================================

  const handleAddMaterial =
    async (keepOpen = false) => {
      if (!canEdit || pendingSave.current) return;

      const e =
        validateAdd();

      if (
        Object.keys(e).length
      ) {
        setErrors(e);
        return;
      }

      pendingSave.current = true; setSaving(true);
      try {

        const chiclayo =
          Number(
            form.stockChiclayo
          ) || 0;

        const chimbote =
          Number(
            form.stockChimbote
          ) || 0;

        const trujillo =
          Number(
            form.stockTrujillo
          ) || 0;

        const minimo =
          Number(
            form.minimo
          ) || 0;

        const total =
          chiclayo +
          chimbote +
          trujillo;

        const estado =
          calcularEstado(
            total,
            minimo
          );

        await crearMaterial({
          id: form.id.trim(),

          nombre:
            form.nombre.trim(),

          descripcion:
            form.descripcion.trim(),

          categoria:
            form.categoria,

          unidad: form.unidad,
          metrosPorRollo: form.unidad === 'ROLLO' ? Number(form.metrosPorRollo) || undefined : undefined,

          stockSedes: {
            Chiclayo: chiclayo,
            Chimbote: chimbote,
            Trujillo: trujillo,
          },

          minimo,

          precioUnitario: 0,

          estado,
        });

        onToast(
          `✓ Material agregado: ${form.nombre}`
        );

        const nextForm = { ...BLANK_FORM, ...(keepOpen ? { categoria: form.categoria, unidad: form.unidad, metrosPorRollo: form.metrosPorRollo, minimo: form.minimo } : {}) };
        setShowAdd(keepOpen);
        setForm(nextForm);
        setAddBaseline(nextForm);
        if (keepOpen) addInputRef.current?.focus();

        setErrors({});

        await refreshRemoteData();
        await cargarMateriales();

      } catch (error) {

        console.error(
          'Error creando material:',
          error
        );

        onToast(
          error instanceof Error || (error && typeof error === 'object' && 'message' in error) ? String(error.message) : 'Error al agregar material'
        );
      } finally { pendingSave.current = false; setSaving(false); }
    };

  // ====================================================
  // ABRIR EDICIÓN
  // ====================================================

  const openEditStock = (
    m: Material
  ) => {

    setSelected(m);

    setEditMode(true);
    setEditUnidad(m.unidad || 'UND');
    setEditMetrosPorRollo(m.metrosPorRollo ? String(m.metrosPorRollo) : '');

    setEditStock({
      Chiclayo:
        String(
          m.stockSedes.Chiclayo ?? 0
        ),

      Chimbote:
        String(
          m.stockSedes.Chimbote ?? 0
        ),

      Trujillo:
        String(
          m.stockSedes.Trujillo ?? 0
        ),
    });

    setEditMinimo(
      String(
        m.minimo ?? 0
      )
    );
  };

  // ====================================================
  // GUARDAR STOCK
  // ====================================================

  const [editWarnings,setEditWarnings] = useState<Record<string,string>>({});
  useEffect(() => {
    setEditWarnings(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => {
      const value = key==='minimo' ? editMinimo : editStock[key];
      return !value?.trim() || !validStockQuantity(Number(value)) || !!editRollErrors[key];
    })));
  }, [editStock,editMinimo,editRollErrors]);
  const handleSaveStock =
    async () => {

      if (!selected || !canEdit || pendingSave.current) {
        return;
      }

      const warnings: Record<string,string> = {};
      if (editUnidad === 'ROLLO' && editMetrosPorRollo && !validRollLength(Number(editMetrosPorRollo))) { onToast('Indica una longitud de rollo válida, mayor que cero y hasta 100000 m.'); return; }
      for(const sede of SEDES) if(!editStock[sede]?.trim() || !validStockQuantity(Number(editStock[sede])) || editRollErrors[sede]) warnings[sede] = editRollErrors[sede] || 'Completa el stock con un valor válido y hasta tres decimales.';
      if(!editMinimo.trim() || !validStockQuantity(Number(editMinimo))) warnings.minimo = 'Ingresa un mínimo válido mayor o igual a cero.';
      setEditWarnings(warnings);
      if(Object.keys(warnings).length) return;
      pendingSave.current = true; setSaving(true);
      try {

        const chiclayo =
          Number(
            editStock.Chiclayo
          ) || 0;

        const chimbote =
          Number(
            editStock.Chimbote
          ) || 0;

        const trujillo =
          Number(
            editStock.Trujillo
          ) || 0;

        const minimo =
          Number(
            editMinimo
          ) || 0;

        const total =
          chiclayo +
          chimbote +
          trujillo;

        const estado =
          calcularEstado(
            total,
            minimo
          );

        await actualizarMaterial(
          selected.id,
          {
            unidad: editUnidad,
            metrosPorRollo: editUnidad === 'ROLLO' ? Number(editMetrosPorRollo) || 0 : 0,
            stockSedes: {
              Chiclayo: chiclayo,
              Chimbote: chimbote,
              Trujillo: trujillo,
            },

            minimo,

            estado,
          },
          selected
        );

        onToast(
          `✓ Stock actualizado: ${selected.nombre}`
        );

        setSelected(null);

        setEditMode(false);

        await refreshRemoteData();
        await cargarMateriales();

      } catch (error) {

        console.error(
          'Error actualizando stock:',
          error
        );

        onToast(
          error instanceof Error || (error && typeof error === 'object' && 'message' in error) ? String(error.message) : 'Error al actualizar stock'
        );
      } finally { pendingSave.current = false; setSaving(false); }
    };

  // ====================================================
  // KPI STOCK TOTAL
  // ====================================================

  const stockPorUnidad =
    materiales.reduce(
      (totales, material) => {
        const unidad = material.unidad || 'UND';
        totales[unidad] = (totales[unidad] ?? 0) + sedesVisibles.reduce((sum, sede) => sum + obtenerStockSede(material, sede), 0);
        return totales;
      },
      {} as Record<string, number>
    );

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {

    return (
      <div
        className={`inventory-view ${role === 'gerente' ? 'manager-view-surface manager-inventory-view' : ''}`}
        style={{
          padding: 24,
          flex: 1,
          display: 'flex',
          alignItems:
            'center',
          justifyContent:
            'center',
          color: '#71717A',
        }}
      >
        Cargando inventario...
      </div>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (

    <div
      className={`inventory-view ${role === 'gerente' ? 'manager-view-surface manager-inventory-view' : ''}`}
      style={{
        padding: 24,
        overflowY: 'auto',
        flex: 1,
      }}
    >

      <header className="inventory-section-heading"><div><h2>Existencias y alertas</h2><p>Consulta el stock por sede y localiza los materiales que necesitan atención.</p></div></header>
      {/* ===============================================
          KPIs
      ================================================ */}

      {/* ===============================================
          SEDES
      ================================================ */}

      <div className="inventory-site-switch" role="group" aria-label="Consultar existencias por sede"
        style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}
      >

        <button type="button" aria-pressed={sedeView === 'todas'}
          className="btn btn-ghost"

          style={{
            padding:
              '6px 14px',

            fontSize: 12,

            background:
              sedeView ===
              'todas'
                ? '#EFF6FF'
                : undefined,

            color:
              sedeView ===
              'todas'
                ? '#2563EB'
                : undefined,

            borderColor:
              sedeView ===
              'todas'
                ? '#BFDBFE'
                : undefined,
          }}

          onClick={() =>
            changeSede(
              'todas'
            )
          }
        >
          Todas las sedes
        </button>


        {SEDES.map(
          (s) => (

            <button
              key={s} type="button" aria-pressed={sedeView === s}

              className="btn btn-ghost"

              style={{
                padding:
                  '6px 14px',

                fontSize: 12,

                background:
                  sedeView === s
                    ? `${SEDE_COLOR[s]}15`
                    : undefined,

                color:
                  sedeView === s
                    ? SEDE_COLOR[s]
                    : undefined,

                borderColor:
                  sedeView === s
                    ? SEDE_COLOR[s]
                    : undefined,
              }}

              onClick={() =>
                changeSede(s)
              }
            >
              {s}
            </button>

          )
        )}

      </div>


      {/* ===============================================
          PANEL
      ================================================ */}

      <section className="panel inventory-catalog" aria-labelledby="inventory-catalog-title">
        <header className="inventory-section-heading"><div><h2 id="inventory-catalog-title">Catálogo de materiales</h2><p>Busca un material y consulta su disponibilidad. Abre su nombre para ver el detalle.</p></div>
          <button type="button" className="btn btn-ghost" aria-pressed={showTechnical} onClick={() => setShowTechnical(value => !value)}>{showTechnical ? 'Ocultar datos técnicos' : 'Mostrar datos técnicos'}</button>
        </header>

        {/* FILTROS */}

        <div
          className="inventory-filters"
          style={{
            padding:
              '14px 16px',

            borderBottom:
              '1px solid var(--color-divider)',

            display: 'flex',

            gap: 10,

            alignItems:
              'center',

            flexWrap:
              'wrap',
          }}
        >

          <label className="inventory-search-label" htmlFor="inventory-material-search">Buscar material</label>
          <input id="inventory-material-search" type="search"
            className="input-field"

            style={{
              maxWidth: 240,
            }}

            aria-label="Buscar material por SKU, nombre o categoría"
            placeholder=
              "Buscar SKU, nombre, categoría…"

            value={search}

            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />


          <select
            className="select-field"

            aria-label="Filtrar por categoría"
            value={catFilter}

            onChange={(e) =>
              setCatFilter(
                e.target.value
              )
            }
          >

            <option value="">
              Todas las categorías
            </option>

            {cats.map(
              (c) => (
                <option
                  key={c}
                  value={c}
                >
                  {categoryName(c)}
                </option>
              )
            )}

          </select>


          <select
            className="select-field"

            aria-label="Filtrar por estado"
            value={estadoFilter}

            onChange={(e) =>
              setEstadoFilter(
                e.target.value
              )
            }
          >

            <option value="">
              Todos los estados
            </option>

            <option value="OK">
              OK
            </option>

            <option value="BAJO">
              Bajo
            </option>

            <option value="CRÍTICO">
              Crítico
            </option>

            <option value="AGOTADO">
              Agotado
            </option>

          </select>


          <div
            style={{
              marginLeft:
                'auto',

              fontSize: 12,

              color:
                '#71717A',
            }}
          >
            {filtered.length}

            {' de '}

            {materiales.length}

            {' SKU'}
          </div>
          {(search || catFilter || estadoFilter || sedeView !== 'todas') && <div className="active-filters" aria-label="Filtros activos">
            <span>Filtros activos:</span>
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Quitar búsqueda">Búsqueda: {search} ×</button>}
            {catFilter && <button type="button" onClick={() => setCatFilter('')} aria-label="Quitar categoría">{categoryName(catFilter)} ×</button>}
            {estadoFilter && <button type="button" onClick={() => setEstadoFilter('')} aria-label="Quitar estado">{estadoFilter} ×</button>}
            {sedeView !== 'todas' && <button type="button" onClick={() => changeSede('todas')} aria-label="Quitar sede">{sedeView} ×</button>}
            <button type="button" className="filter-reset" onClick={() => { setSearch(''); setCatFilter(''); setEstadoFilter(''); changeSede('todas'); }}>Restablecer filtros</button>
          </div>}
          {sedeView==='todas' && <details className="inventory-filter-note"><summary>Cómo se filtran los estados por sede</summary><p>Al elegir un estado se muestran los materiales que lo cumplen en al menos una sede y se indican las sedes coincidentes. Un material puede contar en varios estados. Sin filtro, la alerta general corresponde a la sede con mayor necesidad de atención.</p></details>}



          {canEdit && (

            <button
              className=
                "btn btn-primary"

              onClick={() => {

                setShowAdd(
                  true
                );

                setForm({ ...BLANK_FORM });
                setAddBaseline({ ...BLANK_FORM });

                setErrors({});
              }}
            >
              + Nuevo SKU
            </button>

          )}

        </div>


        {/* ===============================================
            TABLA
        ================================================ */}

      <div
        className="inventory-summary-grid"
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(4, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >

        <div className="kpi-card inventory-compact-kpi">

          <div
            style={FILTER_LABEL_STYLE}
          >
            Total SKU
          </div>

          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#2563EB',
            }}
          >
            {materiales.length}
          </div>

        </div>


        {[
          {
            s: 'CRÍTICO',
            c: '#DC2626',
          },
          {
            s: 'AGOTADO',
            c: '#DC2626',
          },
          {
            s: 'BAJO',
            c: '#D97706',
          },
        ].map(
          ({ s, c }) => (

            <button
              type="button"
              aria-pressed={estadoFilter===s}
              onClick={() => setEstadoFilter(previous => previous===s ? "" : s)}
              style={{ textAlign:"left", cursor:"pointer", borderColor:estadoFilter===s ? c : undefined }}
              key={s}
              className="kpi-card inventory-compact-kpi"
            >

              <div
                style={FILTER_LABEL_STYLE}
              >
                {s} {sedeView === 'todas' ? '(en alguna sede)' : `(${sedeView})`}
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: c,
                }}
              >
                {
                  scopedMaterials.filter(material => matchesInventoryState(material, sedeView, s)).length
                }
              </div>

            </button>

          )
        )}

      </div>


      <details className="inventory-stock-totals"><summary>Ver existencias por unidad {sedeView !== 'todas' && `en ${sedeView}`}</summary><div className="inventory-unit-totals">

          <div
            style={FILTER_LABEL_STYLE}
          >
            {sedeView === 'todas' ? 'Stock total' : `Stock en ${sedeView}`}
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#18181B',
            }}
          >
            {Object.entries(stockPorUnidad).sort(([a], [b]) => a.localeCompare(b)).map(([unidad, cantidad]) =>
              <div key={unidad} style={{ fontSize: 18, lineHeight: 1.5 }}>{cantidad.toLocaleString('es-PE', { maximumFractionDigits: 3 })} <span style={{ fontSize: 12 }}>{unidad}</span></div>
            )}
            {!materiales.length && 'Sin existencias'}
          </div>

        </div></details>
        <div ref={catalogTop} />
        <p className="inventory-scroll-hint" id="inventory-scroll-help">Desliza la tabla horizontalmente para consultar todas las columnas.</p>
        <div
          className="inventory-table-scroll"
          role="region" aria-label="Existencias de materiales" aria-describedby="inventory-scroll-help" tabIndex={0}
          style={{
            overflowX:
              'auto',
          }}
        >

          <table className="data-table inventory-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: (sedeView === 'todas' ? 1320 : 1080) + (canEdit ? 140 : 0) + (showTechnical ? 120 : 0) }}>
            <caption className="sr-only">Disponibilidad de materiales por sede</caption>
            <colgroup>
              <col style={{ width: 88 }} />
              <col style={{ width: 72 }} />
              <col />
              <col style={{ width: 132 }} />
              <col style={{ width: 72 }} />
              {sedeView === 'todas' ? <><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 96 }} /></> : <col style={{ width: 112 }} />}
              <col style={{ width: 120 }} />
              {showTechnical && <col style={{ width: 120 }} />}
              <col style={{ width: 220 }} />
              {canEdit && <col style={{ width: 140 }} />}
            </colgroup>

            <thead>

              <tr>

              <th>SKU</th>
                <th>Imagen</th>
                  <th>Material</th>

                <th>
                  Categoría
                </th>

                <th>Unidad</th>


                {sedeView ===
                'todas' ? (
                  <>
                    <th>
                      Chiclayo
                    </th>

                    <th>
                      Chimbote
                    </th>

                    <th>
                      Trujillo
                    </th>

                    <th>
                      Total
                    </th>
                  </>
                ) : (
                  <th>
                    Stock ({sedeView})
                  </th>
                )}


                <th>
                  Mínimo por sede
                </th>

                {showTechnical && <th>Precio unitario</th>}

                <th>
                  {sedeView === 'todas' && !estadoFilter ? 'Alerta general' : 'Estado por sede'}
                </th>

                {canEdit && (
                  <th>
                    Acciones
                  </th>
                )}

              </tr>

            </thead>


            <tbody>

              {filtered.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={
                      sedeView === 'todas'
                        ? (canEdit ? 12 : 11) + (showTechnical ? 1 : 0)
                        : (canEdit ? 9 : 8) + (showTechnical ? 1 : 0)
                    }

                    style={{
                      textAlign:
                        'center',

                      padding: 30,

                      color:
                        '#71717A',
                    }}
                  >
                    {materiales.length ? 'No hay materiales que coincidan. Ajusta o restablece los filtros.' : 'No hay materiales registrados.'}
                  </td>

                </tr>

              ) : (

                pageMaterials.map(
                  (m) => {

                    const total =
                      obtenerStockTotal(
                        m
                      );

                    return (

                      <tr
                        key={m.id}

                        style={{
                          cursor:
                            'pointer',
                        }}

                        onClick={() => {

                          setSelected(m);

                          setEditMode(
                            false
                          );
                        }}
                      >

                        <td
                          style={{
                            fontFamily:
                              'monospace',

                            fontSize: 11,

                            color:
                              '#2563EB',

                            fontWeight:
                              600,
                          }}
                        >
                          {m.id}
                        </td>

                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '6px',
                            textAlign: 'center',
                          }}
                        >
                          <MaterialThumbnail material={m} onPreview={() => setPreviewMat(m)} />
                        </td>

                        <td
                          style={{
                            fontWeight:
                              500,

                            maxWidth:
                              220,

                            overflow:
                              'hidden',

                            textOverflow:
                              'ellipsis',

                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          <button type="button" className="inventory-material-link" onClick={event => { event.stopPropagation(); setSelected(m); setEditMode(false); }}>{m.nombre}</button>
                        </td>


                        <td
                          style={{
                            fontSize:
                              12,

                            color:
                              '#71717A',
                          }}
                        >
                          {categoryName(m.categoria)}
                        </td>


                        <td
                          style={{
                            fontSize:
                              11,

                            color:
                              '#71717A',

                            textAlign:
                              'center',
                          }}
                        >
                          {m.unidad ||
                            'UND'}
                        </td>



                        {sedeView ===
                        'todas' &&

                          SEDES.map(
                            (s) => {

                              const stock =
                                obtenerStockSede(
                                  m,
                                  s
                                );

                              return (

                                <td
                                  key={s}

                                  style={{
                                    fontFamily:
                                      'monospace',

                                    fontSize:
                                      12,

                                    textAlign:
                                      'center',

                                    fontWeight:
                                      stock ===
                                      0
                                        ? 700
                                        : 400,

                                    color:
                                      stock ===
                                      0
                                        ? '#DC2626'
                                        : '#18181B',
                                  }}
                                >
                                  {m.unidad === 'ROLLO' ? formatStock(stock, m) : stock}
                                </td>

                              );
                            }
                          )}


                        {sedeView !==
                          'todas' && (

                          <td
                            style={MATERIAL_CODE_STYLE}
                          >

                            {
                              formatStock(obtenerStockSede(m, sedeView), m)
                            }

                          </td>

                        )}


                        {sedeView ===
                          'todas' && (

                          <td
                            style={MATERIAL_CODE_STYLE}
                          >
                            {m.unidad === 'ROLLO' ? formatStock(total, m) : total}
                          </td>

                        )}


                        <td
                          style={{
                            fontFamily:
                              'monospace',

                            fontSize:
                              12,

                            color:
                              '#71717A',
                          }}
                        >
                          {m.minimo}
                        </td>


                        {showTechnical && <>
                        <td
                          style={{
                            fontVariantNumeric:
                              'tabular-nums',

                            fontSize:
                              12,

                            fontWeight:
                              600,

                            color:
                              m.precioUnitario > 0
                                ? '#18181B'
                                : '#A1A1AA',

                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {formatPrecio(
                            m.precioUnitario
                          )}
                        </td>
                        </>}


                        <td>

                          <div className="inventory-state-cell">
                            {sedeView !== 'todas' ? <EstadosSedes material={m} sedes={sedesVisibles} /> : <span className={`badge status-badge badge-${ESTADO_BADGE[displayedState(m)]}`}>{displayedState(m)}</span>}
                            {sedeView === 'todas' && (Boolean(estadoFilter) || estadoVisible(m) !== 'OK') && <small className="inventory-alert-context">{SEDES.filter(sede => estadoPorSede(m, sede) === displayedState(m)).join(', ')}</small>}
                            <button type="button" className="inventory-state-trigger" aria-label={`Ver estados por sede de ${m.id}`} title="Consultar alertas por sede" aria-haspopup="dialog"
                              onClick={event => { event.stopPropagation(); setStatusMaterial(m); }}>
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 20V10m7 10V4m7 16v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="19" cy="7" r="2" stroke="currentColor" strokeWidth="1.6"/></svg>
                              <span className="sr-only">Ver estados</span>
                            </button>
                          </div>

                        </td>


                        {canEdit && (

                          <td
                            onClick={(e) =>
                              e.stopPropagation()
                            }
                          >

                            <button
                              className=
                                "btn btn-ghost"

                              style={{
                                padding:
                                  '3px 10px',

                                fontSize:
                                  11,
                              }}

                              onClick={() =>
                                openEditStock(
                                  m
                                )
                              }
                            >
                              Editar stock
                            </button>

                          </td>

                        )}

                      </tr>

                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>
        <nav className="inventory-pagination" aria-label="Páginas del inventario">
          <span role="status">{filtered.length ? `${(currentPage - 1) * 25 + 1}–${Math.min(currentPage * 25, filtered.length)} de ${filtered.length} materiales` : 'Sin resultados'}</span>
          <div><button type="button" className="btn btn-ghost" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Anterior</button>
          <span>Página {currentPage} de {pageCount}</span>
          <button type="button" className="btn btn-ghost" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Siguiente</button></div>
        </nav>


      </section>


      {/* ===============================================
          DETALLE
      ================================================ */}

      {selected &&
        !editMode && (

        <div
          className=
            "modal-overlay"

          onClick={() =>
            setSelected(null)
          }
        >

          <div
            className="modal"

            style={{
              width: 560,
            }}

            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <MaterialModalHeader material={selected} />


            <div
              style={{
                padding:
                  '18px 22px',
              }}
            >

              <div
                style={{
                  fontSize: 12,

                  color:
                    '#52525B',

                  lineHeight:
                    1.6,

                  marginBottom:
                    18,
                }}
              >
                {selected.descripcion}
              </div>


              <div
                style={{
                  display: 'grid',

                  gridTemplateColumns:
                    '1fr 1fr',

                  gap: 14,

                  marginBottom:
                    18,
                }}
              >

                <div>

                  <div
                    style={DETAIL_LABEL_STYLE}
                  >
                    Categoría
                  </div>

                  <div
                    style={DETAIL_VALUE_STYLE}
                  >
                    {categoryName(selected.categoria)}
                  </div>

                </div>


                <div>

                  <div
                    style={DETAIL_LABEL_STYLE}
                  >
                    Unidad
                  </div>

                  <div
                    style={DETAIL_VALUE_STYLE}
                  >
                    {selected.unidad ||
                      'UND'}
                  </div>

                </div>


                <div>

                  <div
                    style={DETAIL_LABEL_STYLE}
                  >
                    Stock mínimo por sede
                  </div>

                  <div
                    style={{
                      fontSize:
                        13,

                      fontWeight:
                        700,

                      color:
                        '#DC2626',
                    }}
                  >
                    {formatStock(selected.minimo, selected)}
                  </div>

                </div>


                <div>

                  <div
                    style={DETAIL_LABEL_STYLE}
                  >
                    Precio unitario
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: selected.precioUnitario > 0
                        ? '#18181B'
                        : '#A1A1AA',
                    }}
                  >
                    {formatPrecio(
                      selected.precioUnitario
                    )}
                  </div>

                </div>


                <div>

                  <div
                    style={DETAIL_LABEL_STYLE}
                  >
                    Stock total
                  </div>

                  <div
                    style={{
                      fontSize:
                        13,

                      fontWeight:
                        700,

                      color:
                        '#059669',
                    }}
                  >
                    {formatStock(obtenerStockTotal(selected), selected)}
                  </div>

                </div>

              </div>


              <div
                style={{
                  background:
                    '#F9FAFB',

                  border:
                    '1px solid #E4E4E7',

                  borderRadius:
                    8,

                  padding:
                    '14px 16px',
                }}
              >

                <div
                  style={{
                    fontSize: 11,

                    fontWeight:
                      600,

                    color:
                      '#52525B',

                    textTransform:
                      'uppercase',

                    marginBottom:
                      12,
                  }}
                >
                  Stock por sede
                </div>


                {SEDES.map(
                  (s) => {

                    const stock =
                      obtenerStockSede(
                        selected,
                        s
                      );

                    return (

                      <div
                        key={s}

                        style={{
                          display:
                            'flex',

                          alignItems:
                            'center',

                          gap: 12,

                          marginBottom:
                            10,
                        }}
                      >

                        <div
                          style={{
                            width: 10,

                            height:
                              10,

                            borderRadius:
                              '50%',

                            background:
                              SEDE_COLOR[
                                s
                              ],
                          }}
                        />


                        <span
                          style={{
                            fontSize:
                              12.5,

                            flex: 1,

                            color:
                              '#52525B',
                          }}
                        >
                          {s}
                        </span>
                        <EstadosSedes material={selected} sedes={[s]} />


                        <span
                          style={{
                            fontSize:
                              14,

                            fontWeight:
                              700,

                            color:
                              stock ===
                              0
                                ? '#DC2626'
                                : '#18181B',

                            fontFamily:
                              'monospace',
                          }}
                        >
                          {selected.unidad === 'ROLLO' ? formatStock(stock, selected) : stock}

                          {' '}

                          <span
                            style={{
                              fontSize:
                                11,

                              fontWeight:
                                400,

                              color:
                                '#A1A1AA',
                            }}
                          >
                            {selected.unidad || 'UND'}
                          </span>

                        </span>

                      </div>

                    );
                  }
                )}

              </div>

            </div>


            <div
              style={{
                padding:
                  '14px 22px',

                borderTop:
                  '1px solid var(--color-divider)',

                display:
                  'flex',

                gap: 10,

                justifyContent:
                  'flex-end',
              }}
            >

              {canEdit && (

                <button
                  className=
                    "btn btn-primary"

                  onClick={() =>
                    openEditStock(
                      selected
                    )
                  }
                >
                  Editar stock
                </button>

              )}


              <button
                className=
                  "btn btn-ghost"

                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                Cerrar
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ===============================================
          EDITAR STOCK
      ================================================ */}

      {selected &&
        editMode && (

        <div
          className=
            "modal-overlay"

          onClick={() => requestClose('edit')}
        >

          <div
            className="modal"

            style={{
              width: 480,
            }}

            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <MaterialModalHeader material={selected} editing />

            <div style={{ padding: '16px 22px 0' }}>
              <label htmlFor="edit-material-unit">Unidad de inventario</label>
              <select id="edit-material-unit" className="select-field" style={{ width: '100%', marginTop: 6 }} value={editUnidad} onChange={event => setEditUnidad(event.target.value)}>
                {Object.entries(UNIDADES_MATERIAL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {editUnidad !== selected.unidad && <p style={{ fontSize: 12, color: '#52525B', margin: '8px 0 0' }}>Revisa el stock de cada sede y el mínimo en {editUnidad}. Cambiar la unidad no convierte las cantidades ni los precios automáticamente.</p>}
              {editUnidad === 'ROLLO' && <label style={{ display: 'block', marginTop: 12 }}>Metros por rollo<input className="input-field" type="number" min="0.001" max="100000" step="0.001" value={editMetrosPorRollo} onChange={event => setEditMetrosPorRollo(event.target.value)} /><span style={{ fontSize: 12 }}>Configura la longitud para registrar y visualizar metros restantes. El stock actual se conserva.</span></label>}
            </div>


            <div
              style={{
                padding:
                  '20px 22px',

                display:
                  'flex',

                flexDirection:
                  'column',

                gap: 14,
              }}
            >

              {SEDES.map(
                (s) => (

                  <div key={s}>

                    <label
                      style={STOCK_LABEL_STYLE}
                    >

                      <span
                        style={{
                          display:
                            'inline-block',

                          width:
                            10,

                          height:
                            10,

                          borderRadius:
                            '50%',

                          background:
                            SEDE_COLOR[
                              s
                            ],

                          marginRight:
                            6,
                        }}
                      />

                      Stock {s}
                      {` (${editUnidad})`}

                    </label>


                    {editUnidad === 'ROLLO' && Number(editMetrosPorRollo) > 0 ? <RollStockInput key={`${s}-${editMetrosPorRollo}`} stock={editStock[s]} length={Number(editMetrosPorRollo)} sede={s} onError={message => setEditRollErrors(previous => ({ ...previous, [s]: message }))} onChange={value => setEditStock(previous => ({ ...previous, [s]: value }))} /> :                     <input aria-invalid={editWarnings[s] ? true : undefined}
                      className=
                        "input-field"

                      type="number"

                      min="0"

                      value={
                        editStock[
                          s
                        ]
                      }

                      onChange={(e) =>
                        setEditStock(
                          (p) => ({
                            ...p,

                            [s]:
                              e
                                .target
                                .value,
                          })
                        )
                      }
                    />}
<FieldError message={editWarnings[s]} />

                  </div>

                )
              )}


              <div>

                <label
                  style={STOCK_LABEL_STYLE}
                >
                  Stock mínimo
                  {` (por sede, ${editUnidad})`}
                </label>


                <input aria-invalid={editWarnings.minimo ? true : undefined}
                  className=
                    "input-field"

                  type="number"

                  min="0"

                  value={
                    editMinimo
                  }

                  onChange={(e) =>
                    setEditMinimo(
                      e.target
                        .value
                    )
                  }
                />
<FieldError message={editWarnings.minimo} />

              </div>

            </div>


            <ModalActions busy={saving} primaryLabel="Guardar cambios" onPrimary={handleSaveStock} onCancel={() => requestClose('edit')} />

          </div>

        </div>

      )}


      {/* ===============================================
          NUEVO MATERIAL
      ================================================ */}

      {showAdd && (

        <div
          className=
            "modal-overlay"

          onClick={() => requestClose('add')}
        >

          <div
            className="modal"

            style={{
              width: 580,
            }}

            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h2
                style={{
                  margin: 0,

                  fontSize:
                    15,

                  fontWeight:
                    700,

                  color:
                    '#18181B',
                }}
              >
                Nuevo SKU — Agregar material
              </h2>

            </div>


            <div
              style={{
                padding:
                  '20px 22px',

                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap: 14,
              }}
            >

              {/* SKU */}

              <div
                style={FULL_WIDTH_STYLE}
              >

                <label>
                  SKU *
                </label>

                <input ref={addInputRef} autoFocus
                  className=
                    "input-field"

                  placeholder=
                    "Ej. GAS-0010"

                  value={
                    form.id
                  }

                  onChange={(e) => {

                    setForm(
                      (p) => ({
                        ...p,

                        id:
                          e.target
                            .value,
                      })
                    );

                    setErrors(
                      (p) => ({
                        ...p,

                        id: '',
                      })
                    );
                  }}
                />

                {errors.id && (
                  <div
                    style={{
                      fontSize:
                        11,

                      color:
                        '#DC2626',
                    }}
                  >
                    {errors.id}
                  </div>
                )}

              </div>


              {/* NOMBRE */}

              <div
                style={FULL_WIDTH_STYLE}
              >

                <label>
                  Nombre del material *
                </label>

                <input aria-invalid={errors.nombre ? true : undefined} aria-describedby={errors.nombre ? "material-nombre-error" : undefined}
                  className=
                    "input-field"

                  placeholder=
                    "Ej. Regulador de presión"

                  value={
                    form.nombre
                  }

                  onChange={(e) =>
                    setForm(
                      (p) => ({
                        ...p,

                        nombre:
                          e.target
                            .value,
                      })
                    )
                  }
                />
<FieldError id="material-nombre-error" message={errors.nombre} />

              </div>


              {/* DESCRIPCIÓN */}

              <div
                style={FULL_WIDTH_STYLE}
              >

                <label>
                  Descripción técnica *
                </label>

                <textarea aria-invalid={errors.descripcion ? true : undefined} aria-describedby={errors.descripcion ? "material-descripcion-error" : undefined}
                  className=
                    "input-field"

                  rows={2}

                  value={
                    form.descripcion
                  }

                  onChange={(e) =>
                    setForm(
                      (p) => ({
                        ...p,

                        descripcion:
                          e.target
                            .value,
                      })
                    )
                  }
                />
<FieldError id="material-descripcion-error" message={errors.descripcion} />

              </div>


              {/* CATEGORÍA */}

              <div>

                <label>
                  Categoría *
                </label>

                <select aria-invalid={errors.categoria ? true : undefined} aria-describedby={errors.categoria ? "material-categoria-error" : undefined}
                  className=
                    "select-field"

                  style={{
                    width:
                      '100%',
                  }}

                  value={
                    form.categoria
                  }

                  onChange={(e) =>
                    setForm(
                      (p) => ({
                        ...p,

                        categoria:
                          e.target
                            .value,
                      })
                    )
                  }
                >

                  <option value="">
                    — Seleccionar —
                  </option>

                  {categorias.map(
                    (c) => (

                      <option
                        key={c.id}
                        value={c.id}
                      >
                        {c.nombre}
                      </option>

                    )
                  )}

                </select>
<FieldError id="material-categoria-error" message={errors.categoria} />

              </div>


              {/* MÍNIMO */}

              <div>
                <label htmlFor="new-material-unit">Unidad de inventario *</label>
                <select id="new-material-unit" className="select-field" style={{ width: '100%' }} value={form.unidad} onChange={event => setForm(previous => ({ ...previous, unidad: event.target.value }))}>
                  {Object.entries(UNIDADES_MATERIAL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {form.unidad === 'ROLLO' && <label style={{ display: 'block', marginTop: 12 }}>Metros por rollo<input className="input-field" type="number" min="0.001" max="100000" step="0.001" value={form.metrosPorRollo} onChange={event => setForm(previous => ({ ...previous, metrosPorRollo: event.target.value }))} /><FieldError message={errors.metrosPorRollo} /></label>}
              </div>

              <div>

                <label>
                  Stock mínimo por sede ({form.unidad})
                </label>

                <input aria-invalid={errors.minimo ? true : undefined} aria-describedby={errors.minimo ? "material-minimo-error" : undefined}
                  className=
                    "input-field"

                  type="number"

                  min="0"

                  value={
                    form.minimo
                  }

                  onChange={(e) =>
                    setForm(
                      (p) => ({
                        ...p,

                        minimo:
                          e.target
                            .value,
                      })
                    )
                  }
                />
<FieldError id="material-minimo-error" message={errors.minimo} />

              </div>


              {/* STOCK */}

              <div
                style={{
                  gridColumn:
                    '1/-1',

                  background:
                    '#F9FAFB',

                  borderRadius:
                    8,

                  border:
                    '1px solid #E4E4E7',

                  padding:
                    '14px 16px',
                }}
              >

                <div
                  style={{
                    marginBottom:
                      12,

                    fontSize:
                      11,

                    fontWeight:
                      600,
                  }}
                >
                  Stock inicial por sede ({form.unidad})
                </div>


                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      form.unidad === 'ROLLO' && Number(form.metrosPorRollo) > 0 ? '1fr' : '1fr 1fr 1fr',

                    gap: 10,
                  }}
                >

                  {SEDES.map(
                    (s) => {

                      const key =
                        `stock${s}` as
                        | 'stockChiclayo'
                        | 'stockChimbote'
                        | 'stockTrujillo';

                      return (

                        <div
                          key={s}
                        >

                          <label>
                            {s}
                          </label>

                          {form.unidad === 'ROLLO' && Number(form.metrosPorRollo) > 0 ? <RollStockInput key={`${s}-${form.metrosPorRollo}`} stock={form[key]} length={Number(form.metrosPorRollo)} sede={s} onError={message => setNewRollErrors(previous => ({ ...previous, [s]: message }))} onChange={value => setForm(previous => ({ ...previous, [key]: value }))} /> : <input
                            className=
                              "input-field"

                            type=
                              "number"

                            min="0"

                            value={
                              form[
                                key
                              ]
                            }

                            onChange={(
                              e
                            ) =>
                              setForm(
                                (
                                  p
                                ) => ({
                                  ...p,

                                  [key]:
                                    e
                                      .target
                                      .value,
                                })
                              )
                            }
                          />}<FieldError message={errors[key]} />

                        </div>

                      );
                    }
                  )}

                </div>

              </div>

            </div>


            <div style={{ padding: '8px 24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => void handleAddMaterial(true)}>Guardar y agregar otro</button>
            </div>
            <ModalActions busy={saving} primaryLabel="Agregar al catálogo" onPrimary={() => void handleAddMaterial()} onCancel={() => requestClose('add')} />

          </div>

        </div>

      )}


      {statusMaterial && <StockStatusDialog material={statusMaterial} onClose={() => setStatusMaterial(null)} />}

      {/* ===============================================
          PREVIEW
      ================================================ */}

      {discardTarget && <DiscardChangesDialog onCancel={() => setDiscardTarget(null)} onDiscard={() => { closeEditor(discardTarget); setDiscardTarget(null); }} />}
    {previewMat && (

        <MaterialPreviewModal
          material={
            previewMat
          }

          onClose={() =>
            setPreviewMat(
              null
            )
          }
        />

      )}

    </div>
  );
}
