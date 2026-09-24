import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/AppContext';

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: '#A1A1AA',
  ENVIADO: '#D97706',
  CONFIRMADO: '#059669',
  RECHAZADO: '#DC2626',
};

const ESTADO_BG: Record<string, string> = {
  BORRADOR: '#F4F4F5',
  ENVIADO: '#FEF3C7',
  CONFIRMADO: '#CCFBF1',
  RECHAZADO: '#FEE2E2',
};

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR: 'gray',
  ENVIADO: 'amber',
  CONFIRMADO: 'green',
  RECHAZADO: 'red',
};

interface Props {
  usuario: string;
  onNav: (v: string) => void;
}

export default function AnalistaDashboard({
  usuario,
  onNav,
}: Props) {

  const { state } = useAppStore();

  // =====================================================
  // RESPONSIVE
  // =====================================================

  const [width, setWidth] = useState(
    typeof window !== 'undefined'
      ? window.innerWidth
      : 1200
  );

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      );
    };
  }, []);

  const isMobile = width <= 640;
  const isSmallMobile = width <= 420;
  const isTablet = width <= 850;
  const isLaptop = width <= 1100;

  // =====================================================
  // DATOS
  // =====================================================

  const misReqs =
    state.requerimientos.filter(
      (r) =>
        r.analista === usuario ||
        r.analista.includes(
          usuario.split(' ')[0]
        )
    );

  const recent = [...misReqs]
    .sort((a, b) =>
      b.fecha.localeCompare(a.fecha)
    )
    .slice(0, 4);

  // =====================================================
  // KPIS
  // =====================================================

  const kpis = [
    {
      label: 'Mis solicitudes',
      value: misReqs.length,
      color: '#2563EB',
    },
    {
      label: 'En revisión',
      value: misReqs.filter(
        (r) => r.estado === 'ENVIADO'
      ).length,
      color: '#D97706',
    },
    {
      label: 'Confirmadas',
      value: misReqs.filter(
        (r) =>
          r.estado === 'CONFIRMADO'
      ).length,
      color: '#059669',
    },
    {
      label: 'Borradores',
      value: misReqs.filter(
        (r) =>
          r.estado === 'BORRADOR'
      ).length,
      color: '#71717A',
    },
  ];

  return (
    <div
      style={{
        padding: isSmallMobile
          ? 10
          : isMobile
            ? 14
            : 24,

        overflowY: 'auto',
        overflowX: 'hidden',

        flex: 1,

        minWidth: 0,

        boxSizing: 'border-box',
      }}
    >

      {/* =================================================
          KPIS
      ================================================= */}

      <div
        style={{
          display: 'grid',

          gridTemplateColumns:
            isSmallMobile
              ? '1fr'
              : isMobile
                ? 'repeat(2, minmax(0, 1fr))'
                : isLaptop
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(4, minmax(0, 1fr))',

          gap: isMobile ? 10 : 16,

          marginBottom:
            isMobile ? 14 : 24,
        }}
      >
        {kpis.map(
          ({
            label,
            value,
            color,
          }) => (
            <div
              key={label}
              className="kpi-card"
              style={{
                minWidth: 0,

                padding:
                  isSmallMobile
                    ? 14
                    : undefined,
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: '#71717A',
                  fontWeight: 500,
                  marginBottom: 10,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  fontSize:
                    isSmallMobile
                      ? 26
                      : 32,

                  fontWeight: 800,
                  color,
                }}
              >
                {value}
              </div>
            </div>
          )
        )}
      </div>

      {/* =================================================
          CONTENIDO PRINCIPAL
      ================================================= */}

      <div
        style={{
          display: 'grid',

          gridTemplateColumns:
            isTablet
              ? 'minmax(0, 1fr)'
              : isLaptop
                ? 'minmax(0, 1fr) 240px'
                : 'minmax(0, 1fr) 280px',

          gap: isMobile ? 14 : 20,

          minWidth: 0,
        }}
      >

        {/* =================================================
            SOLICITUDES RECIENTES
        ================================================= */}

        <div
          className="panel"
          style={{
            minWidth: 0,
            overflow: 'hidden',
          }}
        >

          {/* CABECERA */}

          <div
            className="section-header"
            style={{
              display: 'flex',

              flexDirection:
                isMobile
                  ? 'column'
                  : 'row',

              alignItems:
                isMobile
                  ? 'stretch'
                  : 'center',

              gap:
                isMobile
                  ? 10
                  : undefined,
            }}
          >
            <span className="section-title">
              Mis Solicitudes Recientes
            </span>

            <button
              className="btn btn-primary"

              style={{
                width:
                  isMobile
                    ? '100%'
                    : undefined,

                justifyContent:
                  'center',
              }}

              onClick={() =>
                onNav(
                  'nueva-solicitud'
                )
              }
            >
              + Nueva solicitud
            </button>
          </div>

          {/* SIN SOLICITUDES */}

          {recent.length === 0 ? (
            <div
              style={{
                padding:
                  '40px 20px',

                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  fontSize: 13,

                  color:
                    '#71717A',

                  marginBottom:
                    12,
                }}
              >
                No tienes solicitudes aún.
              </div>

              <button
                className="btn btn-primary"

                onClick={() =>
                  onNav(
                    'nueva-solicitud'
                  )
                }
              >
                Crear primera solicitud
              </button>
            </div>
          ) : (

            /* SOLICITUDES */

            recent.map((r) => (
              <div
                key={r.id}

                style={{
                  padding:
                    isMobile
                      ? '12px 14px'
                      : '14px 16px',

                  borderBottom:
                    '1px solid #F4F4F5',

                  minWidth: 0,
                }}
              >

                {/* FILA SUPERIOR */}

                <div
                  style={{
                    display:
                      'flex',

                    flexDirection:
                      isSmallMobile
                        ? 'column'
                        : 'row',

                    justifyContent:
                      'space-between',

                    alignItems:
                      isSmallMobile
                        ? 'flex-start'
                        : 'center',

                    gap: 6,

                    marginBottom:
                      6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: 8,
                      flexWrap:
                        'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,

                        color:
                          '#2563EB',

                        fontFamily:
                          'monospace',
                      }}
                    >
                      {r.id}
                    </span>

                    <span
                      className={`badge status-badge badge-${ESTADO_BADGE[r.estado]}`}
                    >
                      {r.estado}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,

                      color:
                        '#71717A',

                      fontFamily:
                        'monospace',

                      flexShrink: 0,
                    }}
                  >
                    {r.fecha}
                  </span>
                </div>

                {/* PROYECTO */}

                <div
                  style={{
                    fontSize: 13.5,

                    fontWeight:
                      600,

                    color:
                      '#18181B',

                    marginBottom:
                      6,

                    overflowWrap:
                      'anywhere',
                  }}
                >
                  {r.proyecto}
                </div>

                {/* INFORMACIÓN */}

                <div
                  style={{
                    display: 'flex',

                    flexWrap:
                      'wrap',

                    gap:
                      isMobile
                        ? 8
                        : 12,

                    fontSize:
                      11.5,

                    color:
                      '#71717A',
                  }}
                >

                  {/* SEDE */}

                  <span
                    style={{
                      display:
                        'inline-flex',

                      alignItems:
                        'center',

                      gap: 3,
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <circle
                        cx="7.5"
                        cy="6"
                        r="2.5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />

                      <path
                        d="M7.5 1C5 1 3 3 3 6c0 3.5 4.5 8 4.5 8S12 9.5 12 6c0-3-2-5-4.5-5z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>

                    {r.sede}
                  </span>

                  {/* TECNICO */}

                  <span
                    style={{
                      display:
                        'inline-flex',

                      alignItems:
                        'center',

                      gap: 3,
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <path
                        d="M9 2l-1 1-5 5 1 3 3 1 5-5 1-1-4-4zM8 3l4 4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    {r.tecnico}
                  </span>

                  {/* MATERIALES */}

                  <span
                    style={{
                      display:
                        'inline-flex',

                      alignItems:
                        'center',

                      gap: 3,
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <path
                        d="M7.5 1L13 4.5V10.5L7.5 14L2 10.5V4.5L7.5 1Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M7.5 1V14M2 4.5L13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>

                    {r.materiales.length}{' '}
                    materiales
                  </span>
                </div>

                {/* OBSERVACIONES */}

                {r.observaciones && (
                  <div
                    style={{
                      marginTop: 8,

                      background:
                        r.estado ===
                        'RECHAZADO'
                          ? '#FFF5F5'
                          : '#F0FDF4',

                      border: `1px solid ${
                        r.estado ===
                        'RECHAZADO'
                          ? '#FECACA'
                          : '#BBF7D0'
                      }`,

                      borderRadius:
                        5,

                      padding:
                        '6px 10px',

                      fontSize:
                        11.5,

                      color:
                        r.estado ===
                        'RECHAZADO'
                          ? '#DC2626'
                          : '#15803D',

                      overflowWrap:
                        'anywhere',
                    }}
                  >
                    {r.observaciones}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* =================================================
            COLUMNA DERECHA
        ================================================= */}

        <div
          style={{
            display:
              isTablet
                ? 'grid'
                : 'flex',

            gridTemplateColumns:
              isTablet &&
              !isMobile
                ? 'repeat(2, minmax(0, 1fr))'
                : '1fr',

            flexDirection:
              'column',

            gap: 14,

            minWidth: 0,
          }}
        >

          {/* ESTADOS */}

          <div className="panel">
            <div className="section-header">
              <span className="section-title">
                Estado de mis solicitudes
              </span>
            </div>

            <div
              style={{
                padding:
                  '14px 16px',
              }}
            >
              {[
                'BORRADOR',
                'ENVIADO',
                'CONFIRMADO',
                'RECHAZADO',
              ].map(
                (estado) => {

                  const cnt =
                    misReqs.filter(
                      (r) =>
                        r.estado ===
                        estado
                    ).length;

                  return (
                    <div
                      key={estado}

                      style={{
                        display:
                          'flex',

                        alignItems:
                          'center',

                        gap: 10,

                        marginBottom:
                          12,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,

                          borderRadius:
                            '50%',

                          background:
                            ESTADO_COLOR[
                              estado
                            ],

                          flexShrink: 0,
                        }}
                      />

                      <span
                        style={{
                          fontSize: 12,

                          flex: 1,

                          color:
                            '#52525B',
                        }}
                      >
                        {estado}
                      </span>

                      <span
                        style={{
                          fontSize: 14,

                          fontWeight:
                            700,

                          color:
                            ESTADO_COLOR[
                              estado
                            ],
                        }}
                      >
                        {cnt}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* ACCESOS RAPIDOS  */}

          <div
            className="panel"
            style={{
              background: '#EFF6FF',
              borderColor: '#BFDBFE',
            }}
          >
            <div
              style={{
                padding: '18px 18px',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1D4ED8',
                  marginBottom: 12,
                }}
              >
                Accesos rápidos
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <button
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                  }}
                  onClick={() => onNav('nueva-solicitud')}
                >
                    Manual de Usuario
                </button>

                <button
                  className="btn btn-ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    borderColor: '#BFDBFE',
                    color: '#1D4ED8',
                  }}
                  onClick={() => onNav('mis-solicitudes')}
                >
                  Pregunta Frecuentes
                </button>

                <button
                  className="btn btn-ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    borderColor: '#BFDBFE',
                    color: '#1D4ED8',
                  }}
                  onClick={() => onNav('inventario')}
                >
                  Consultar inventario
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}