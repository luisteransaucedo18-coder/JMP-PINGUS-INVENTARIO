import { useEffect, useState } from 'react';


import {
  obtenerMateriales,
  crearMaterial,
  actualizarMaterial,
} from '../../service/materialService';

import {
  Role,
  SEDES,
  Sede,
  Material,
  EstadoMaterial,
} from '../../data/mockData';

import MaterialPreviewModal, {
  PreviewBtn,
} from '../../components/MaterialPreviewModal';

// ======================================================
// TIPOS
// ======================================================

interface Props {
  role: Role;
  onToast: (msg: string) => void;
}

// ======================================================
// FORMULARIOS
// ======================================================

const BLANK_FORM = {
  id: '',
  nombre: '',
  descripcion: '',
  categoria: '',
  stockChiclayo: '',
  stockChimbote: '',
  stockTrujillo: '',
  minimo: '',
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

const SEDE_COLOR: Record<string, string> = {
  Chiclayo: '#2563EB',
  Chimbote: '#059669',
  Trujillo: '#7C3AED',
};

const formatPrecio = (precio: number) =>
  precio > 0
    ? new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
      }).format(precio)
    : 'Sin precio';

// ======================================================
// COMPONENTE
// ======================================================

export default function InventarioView({
  role,
  onToast,
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

  const [search, setSearch] =
    useState('');

  const [catFilter, setCatFilter] =
    useState('');

  const [estadoFilter, setEstadoFilter] =
    useState('');

  const [sedeView, setSedeView] =
    useState<Sede | 'todas'>('todas');

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

  // ====================================================
  // CARGAR MATERIALES
  // ====================================================

  const cargarMateriales = async () => {
    try {
      setLoading(true);

      const data =
        await obtenerMateriales();

      console.log(
        'MATERIALES SUPABASE:',
        data
      );

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

  const filtered =
    materiales.filter((m) => {

      const q =
        search.toLowerCase();

      return (
        (
          !q ||
          m.id
            .toLowerCase()
            .includes(q) ||

          m.nombre
            .toLowerCase()
            .includes(q) ||

          m.categoria
            .toLowerCase()
            .includes(q)
        ) &&

        (
          !catFilter ||
          m.categoria === catFilter
        ) &&

        (
          !estadoFilter ||
          m.estado === estadoFilter
        )
      );
    });

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
      e.id = 'Requerido';
    }

    if (!form.nombre.trim()) {
      e.nombre = 'Requerido';
    }

    if (!form.descripcion.trim()) {
      e.descripcion = 'Requerido';
    }

    if (!form.categoria.trim()) {
      e.categoria = 'Requerido';
    }

    if (
      form.minimo === '' ||
      isNaN(
        parseFloat(form.minimo)
      )
    ) {
      e.minimo = 'Inválido';
    }

    return e;
  };

  // ====================================================
  // CALCULAR ESTADO
  // ====================================================

  const calcularEstado = (
    stockTotal: number,
    minimo: number
  ): EstadoMaterial => {

    if (stockTotal === 0) {
      return 'AGOTADO';
    }

    if (stockTotal < minimo) {
      return 'CRÍTICO';
    }

    if (stockTotal <= minimo * 1.5) {
      return 'BAJO';
    }

    return 'OK';
  };

  // ====================================================
  // CREAR MATERIAL
  // ====================================================

  const handleAddMaterial =
    async () => {

      const e =
        validateAdd();

      if (
        Object.keys(e).length
      ) {
        setErrors(e);
        return;
      }

      try {

        const chiclayo =
          parseFloat(
            form.stockChiclayo
          ) || 0;

        const chimbote =
          parseFloat(
            form.stockChimbote
          ) || 0;

        const trujillo =
          parseFloat(
            form.stockTrujillo
          ) || 0;

        const minimo =
          parseFloat(
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

          unidad: 'UND',

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

        setShowAdd(false);

        setForm({
          ...BLANK_FORM,
        });

        setErrors({});

        await cargarMateriales();

      } catch (error) {

        console.error(
          'Error creando material:',
          error
        );

        onToast(
          'Error al agregar material'
        );
      }
    };

  // ====================================================
  // ABRIR EDICIÓN
  // ====================================================

  const openEditStock = (
    m: Material
  ) => {

    setSelected(m);

    setEditMode(true);

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

  const handleSaveStock =
    async () => {

      if (!selected) {
        return;
      }

      try {

        const chiclayo =
          parseFloat(
            editStock.Chiclayo
          ) || 0;

        const chimbote =
          parseFloat(
            editStock.Chimbote
          ) || 0;

        const trujillo =
          parseFloat(
            editStock.Trujillo
          ) || 0;

        const minimo =
          parseFloat(
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
            stockSedes: {
              Chiclayo: chiclayo,
              Chimbote: chimbote,
              Trujillo: trujillo,
            },

            minimo,

            estado,
          }
        );

        onToast(
          `✓ Stock actualizado: ${selected.nombre}`
        );

        setSelected(null);

        setEditMode(false);

        await cargarMateriales();

      } catch (error) {

        console.error(
          'Error actualizando stock:',
          error
        );

        onToast(
          'Error al actualizar stock'
        );
      }
    };

  // ====================================================
  // KPI STOCK TOTAL
  // ====================================================

  const totalStock =
    materiales.reduce(
      (total, material) =>
        total +
        obtenerStockTotal(
          material
        ),
      0
    );

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {

    return (
      <div
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
      style={{
        padding: 24,
        overflowY: 'auto',
        flex: 1,
      }}
    >

      {/* ===============================================
          KPIs
      ================================================ */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(5, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >

        <div className="kpi-card">

          <div
            style={{
              fontSize: 12,
              color: '#71717A',
              fontWeight: 500,
              marginBottom: 8,
            }}
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


        <div className="kpi-card">

          <div
            style={{
              fontSize: 12,
              color: '#71717A',
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Stock total
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#18181B',
            }}
          >
            {totalStock.toLocaleString(
              'es-PE'
            )}

            {' '}

            <span
              style={{
                fontSize: 12,
              }}
            >
              UND
            </span>
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

            <div
              key={s}
              className="kpi-card"
            >

              <div
                style={{
                  fontSize: 12,
                  color: '#71717A',
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                {s}
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: c,
                }}
              >
                {
                  materiales.filter(
                    (m) =>
                      m.estado === s
                  ).length
                }
              </div>

            </div>

          )
        )}

      </div>


      {/* ===============================================
          SEDES
      ================================================ */}

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >

        <button
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
            setSedeView(
              'todas'
            )
          }
        >
          Todas las sedes
        </button>


        {SEDES.map(
          (s) => (

            <button
              key={s}

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
                setSedeView(s)
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

      <div className="panel">

        {/* FILTROS */}

        <div
          style={{
            padding:
              '14px 16px',

            borderBottom:
              '1px solid #E4E4E7',

            display: 'flex',

            gap: 10,

            alignItems:
              'center',

            flexWrap:
              'wrap',
          }}
        >

          <input
            className="input-field"

            style={{
              maxWidth: 240,
            }}

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
                  {c}
                </option>
              )
            )}

          </select>


          <select
            className="select-field"

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


          {canEdit && (

            <button
              className=
                "btn btn-primary"

              onClick={() => {

                setShowAdd(
                  true
                );

                setForm({
                  ...BLANK_FORM,
                });

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
          style={{
            overflowX:
              'auto',
          }}
        >

          <table className="data-table">

            <thead>

              <tr>

              <th>SKU</th>
                <th>Imagen</th>
                  <th>Material</th>

                <th>
                  Categoría
                </th>

                <th>
                  Unidad
                </th>


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
                  Mínimo
                </th>

                <th>
                  Precio unitario
                </th>

                <th>
                  Estado
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
                        ? canEdit ? 13 : 12
                        : canEdit ? 10 : 9
                    }

                    style={{
                      textAlign:
                        'center',

                      padding: 30,

                      color:
                        '#71717A',
                    }}
                  >
                    No hay materiales registrados.
                  </td>

                </tr>

              ) : (

                filtered.map(
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
                          {m.imagen ? (
                            <img
                              src={m.imagen}
                              alt={m.nombre}
                              onClick={() => setPreviewMat(m)}
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: 'contain',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: '#F9FAFB',
                                border: '1px solid #E4E4E7',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 6,
                                background: '#F4F4F5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                color: '#A1A1AA',
                              }}
                            >
                              Sin imagen
                            </div>
                          )}
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
                          {m.nombre}
                        </td>


                        <td
                          style={{
                            fontSize:
                              12,

                            color:
                              '#71717A',
                          }}
                        >
                          {m.categoria}
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
                                  {stock}
                                </td>

                              );
                            }
                          )}


                        {sedeView !==
                          'todas' && (

                          <td
                            style={{
                              fontFamily:
                                'monospace',

                              fontSize:
                                13,

                              fontWeight:
                                700,
                            }}
                          >

                            {
                              obtenerStockSede(
                                m,
                                sedeView
                              )
                            }

                          </td>

                        )}


                        {sedeView ===
                          'todas' && (

                          <td
                            style={{
                              fontFamily:
                                'monospace',

                              fontSize:
                                13,

                              fontWeight:
                                700,
                            }}
                          >
                            {total}
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


                        <td>

                          <span
                            className={`badge status-badge badge-${
                              ESTADO_BADGE[
                                m.estado
                              ] ||
                              'gray'
                            }`}
                          >
                            {m.estado}
                          </span>

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

      </div>


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

            <div className="modal-header">

              <div>

                <div
                  style={{
                    fontSize: 11,

                    color:
                      '#2563EB',

                    fontFamily:
                      'monospace',

                    marginBottom:
                      3,
                  }}
                >
                  {selected.id}
                </div>

                <h2
                  style={{
                    margin: 0,

                    fontSize: 15,

                    fontWeight:
                      700,

                    color:
                      '#18181B',
                  }}
                >
                  {selected.nombre}
                </h2>

              </div>


              <span
                className={`badge status-badge badge-${
                  ESTADO_BADGE[
                    selected.estado
                  ]
                }`}
              >
                {selected.estado}
              </span>

            </div>


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
                    style={{
                      fontSize:
                        10,

                      color:
                        '#71717A',

                      textTransform:
                        'uppercase',

                      marginBottom:
                        4,
                    }}
                  >
                    Categoría
                  </div>

                  <div
                    style={{
                      fontSize:
                        13,

                      fontWeight:
                        500,
                    }}
                  >
                    {selected.categoria}
                  </div>

                </div>


                <div>

                  <div
                    style={{
                      fontSize:
                        10,

                      color:
                        '#71717A',

                      textTransform:
                        'uppercase',

                      marginBottom:
                        4,
                    }}
                  >
                    Unidad
                  </div>

                  <div
                    style={{
                      fontSize:
                        13,

                      fontWeight:
                        500,
                    }}
                  >
                    {selected.unidad ||
                      'UND'}
                  </div>

                </div>


                <div>

                  <div
                    style={{
                      fontSize:
                        10,

                      color:
                        '#71717A',

                      textTransform:
                        'uppercase',

                      marginBottom:
                        4,
                    }}
                  >
                    Stock mínimo
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
                    {selected.minimo}
                    {' UND'}
                  </div>

                </div>


                <div>

                  <div
                    style={{
                      fontSize: 10,
                      color: '#71717A',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
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
                    style={{
                      fontSize:
                        10,

                      color:
                        '#71717A',

                      textTransform:
                        'uppercase',

                      marginBottom:
                        4,
                    }}
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
                    {
                      obtenerStockTotal(
                        selected
                      )
                    }
                    {' UND'}
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
                          {stock}

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
                            UND
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
                  '1px solid #E4E4E7',

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

          onClick={() => {

            setEditMode(
              false
            );

            setSelected(
              null
            );
          }}
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

            <div className="modal-header">

              <div>

                <div
                  style={{
                    fontSize: 11,

                    color:
                      '#2563EB',

                    fontFamily:
                      'monospace',

                    marginBottom:
                      3,
                  }}
                >
                  {selected.id}
                </div>

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
                  Editar stock —{' '}
                  {selected.nombre}
                </h2>

              </div>

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
                      style={{
                        display:
                          'block',

                        fontSize:
                          12,

                        fontWeight:
                          500,

                        color:
                          '#52525B',

                        marginBottom:
                          6,
                      }}
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
                      {' (UND)'}

                    </label>


                    <input
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
                    />

                  </div>

                )
              )}


              <div>

                <label
                  style={{
                    display:
                      'block',

                    fontSize:
                      12,

                    fontWeight:
                      500,

                    color:
                      '#52525B',

                    marginBottom:
                      6,
                  }}
                >
                  Stock mínimo
                  {' (total)'}
                </label>


                <input
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

              </div>

            </div>


            <div
              style={{
                padding:
                  '14px 22px',

                borderTop:
                  '1px solid #E4E4E7',

                display:
                  'flex',

                gap: 10,

                justifyContent:
                  'flex-end',
              }}
            >

              <button
                className=
                  "btn btn-primary"

                onClick={
                  handleSaveStock
                }
              >
                Guardar cambios
              </button>


              <button
                className=
                  "btn btn-ghost"

                onClick={() => {

                  setEditMode(
                    false
                  );

                  setSelected(
                    null
                  );
                }}
              >
                Cancelar
              </button>

            </div>

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

          onClick={() =>
            setShowAdd(
              false
            )
          }
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
                style={{
                  gridColumn:
                    '1/-1',
                }}
              >

                <label>
                  SKU *
                </label>

                <input
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
                style={{
                  gridColumn:
                    '1/-1',
                }}
              >

                <label>
                  Nombre del material *
                </label>

                <input
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

              </div>


              {/* DESCRIPCIÓN */}

              <div
                style={{
                  gridColumn:
                    '1/-1',
                }}
              >

                <label>
                  Descripción técnica *
                </label>

                <textarea
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

              </div>


              {/* CATEGORÍA */}

              <div>

                <label>
                  Categoría *
                </label>

                <select
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

                  {[
                    'Gas Natural',
                    'EPP',
                    'Herramientas',
                    'Señalética',
                    'Otro',
                  ].map(
                    (c) => (

                      <option
                        key={c}
                        value={c}
                      >
                        {c}
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* MÍNIMO */}

              <div>

                <label>
                  Stock mínimo
                </label>

                <input
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
                  Stock inicial por sede
                </div>


                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      '1fr 1fr 1fr',

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

                          <input
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
                          />

                        </div>

                      );
                    }
                  )}

                </div>

              </div>

            </div>


            <div
              style={{
                padding:
                  '14px 22px',

                borderTop:
                  '1px solid #E4E4E7',

                display:
                  'flex',

                gap: 10,

                justifyContent:
                  'flex-end',
              }}
            >

              <button
                className=
                  "btn btn-primary"

                onClick={
                  handleAddMaterial
                }
              >
                Agregar al catálogo
              </button>


              <button
                className=
                  "btn btn-ghost"

                onClick={() =>
                  setShowAdd(
                    false
                  )
                }
              >
                Cancelar
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ===============================================
          PREVIEW
      ================================================ */}

      {previewMat && (

        <MaterialPreviewModal
          material={
            previewMat as any
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
