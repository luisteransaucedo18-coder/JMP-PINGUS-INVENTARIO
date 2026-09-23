import { useEffect, useState } from 'react';
import { SEDES, Sede } from '../../data/mockData';

import {
  obtenerPerfiles,
  crearPerfil,
  actualizarPerfil,
} from '../../service/perfilService';

interface Props {
  onToast: (msg: string) => void;
}

type RolUsuario = 'gerente' | 'analista' | 'coordinador';
type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

interface Usuario {
  id: string;
  codigo?: string | null;
  nombre: string;
  email: string;
  rol: RolUsuario;
  sede: Sede;
  estado: EstadoUsuario;
  telefono?: string | null;
  cargo?: string | null;
  bio?: string | null;
  ultimo_acceso?: string | null;
  created_at?: string;
  updated_at?: string;
}

const ROL_BADGE: Record<RolUsuario, string> = {
  gerente: 'purple',
  analista: 'blue',
  coordinador: 'green',
};

const ROL_LABEL: Record<RolUsuario, string> = {
  gerente: 'Gerente',
  analista: 'Analista',
  coordinador: 'Coordinador',
};

export default function UsuariosView({ onToast }: Props) {
  // =========================================================
  // USUARIOS DESDE SUPABASE
  // =========================================================

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // MODAL / FORMULARIO
  // =========================================================

  const [showNew, setShowNew] = useState(false);

  const [form, setForm] = useState<{
    nombre: string;
    email: string;
    rol: RolUsuario;
    sede: Sede;
  }>({
    nombre: '',
    email: '',
    rol: 'analista',
    sede: 'Chiclayo',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // =========================================================
  // FILTROS
  // =========================================================

  const [rolFilter, setRolFilter] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');

  // =========================================================
  // CARGAR USUARIOS DESDE SUPABASE
  // =========================================================

  const cargarUsuarios = async () => {
    try {
      setLoading(true);

      const data = await obtenerPerfiles();

      console.log('PERFILES SUPABASE:', data);

      setUsuarios((data ?? []) as Usuario[]);
    } catch (error) {
      console.error('Error cargando usuarios:', error);

      onToast('Error al cargar usuarios desde Supabase');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // CARGAR AL ENTRAR A LA VISTA
  // =========================================================

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // =========================================================
  // FILTRAR USUARIOS
  // =========================================================

  const filtered = usuarios.filter(
    (u) =>
      (!rolFilter || u.rol === rolFilter) &&
      (!sedeFilter || u.sede === sedeFilter)
  );

  // =========================================================
  // VALIDAR FORMULARIO
  // =========================================================

  const validate = () => {
    const e: Record<string, string> = {};

    if (!form.nombre.trim()) {
      e.nombre = 'El nombre es requerido';
    }

    if (!form.email.trim() || !form.email.includes('@')) {
      e.email = 'Email inválido';
    }

    const emailExiste = usuarios.find(
      (u) => u.email.toLowerCase() === form.email.toLowerCase()
    );

    if (emailExiste) {
      e.email = 'Este email ya está registrado';
    }

    return e;
  };

  // =========================================================
  // CREAR USUARIO EN SUPABASE
  // =========================================================

  const handleCreate = async () => {
    const e = validate();

    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    try {
      await crearPerfil({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rol: form.rol,
        sede: form.sede,
        estado: 'ACTIVO',
      });

      onToast(
        `✓ Usuario creado: ${form.nombre} (${ROL_LABEL[form.rol]})`
      );

      // Cerrar modal
      setShowNew(false);

      // Limpiar formulario
      setForm({
        nombre: '',
        email: '',
        rol: 'analista',
        sede: 'Chiclayo',
      });

      setErrors({});

      // Volver a consultar Supabase
      await cargarUsuarios();
    } catch (error) {
      console.error('Error creando usuario:', error);

      onToast('Error al crear el usuario');
    }
  };

  // =========================================================
  // ACTIVAR / DESACTIVAR USUARIO
  // =========================================================

  const handleToggle = async (u: Usuario) => {
    try {
      const nuevoEstado: EstadoUsuario =
        u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';

      await actualizarPerfil(u.id, {
        estado: nuevoEstado,
      });

      onToast(
        `${
          nuevoEstado === 'INACTIVO'
            ? 'Usuario desactivado'
            : 'Usuario activado'
        }: ${u.nombre}`
      );

      // Actualizar lista
      await cargarUsuarios();
    } catch (error) {
      console.error('Error actualizando usuario:', error);

      onToast('Error al actualizar el usuario');
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: '#71717A',
        }}
      >
        Cargando usuarios...
      </div>
    );
  }

  // =========================================================
  // VISTA
  // =========================================================

  return (
    <div
      style={{
        padding: 24,
        overflowY: 'auto',
        flex: 1,
      }}
    >
      {/* =====================================================
          KPI POR ROL
      ====================================================== */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {(['gerente', 'coordinador', 'analista'] as RolUsuario[]).map(
          (rol) => {
            const cnt = usuarios.filter((u) => u.rol === rol).length;

            const activos = usuarios.filter(
              (u) => u.rol === rol && u.estado === 'ACTIVO'
            ).length;

            const colors: Record<RolUsuario, string> = {
              gerente: '#7C3AED',
              coordinador: '#059669',
              analista: '#2563EB',
            };

            const bgs: Record<RolUsuario, string> = {
              gerente: '#F3E8FF',
              coordinador: '#CCFBF1',
              analista: '#DBEAFE',
            };

            return (
              <div key={rol} className="kpi-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: '#71717A',
                      fontWeight: 500,
                    }}
                  >
                    {ROL_LABEL[rol]}
                  </span>

                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: bgs[rol],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <circle
                        cx="7.5"
                        cy="5"
                        r="2.5"
                        stroke={colors[rol]}
                        strokeWidth="1.3"
                      />

                      <path
                        d="M1 13c0-2.5 2-4 6.5-4s6.5 1.5 6.5 4"
                        stroke={colors[rol]}
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: colors[rol],
                  }}
                >
                  {cnt}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: '#71717A',
                    marginTop: 4,
                  }}
                >
                  {activos} activo{activos !== 1 ? 's' : ''}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* =====================================================
          PANEL USUARIOS
      ====================================================== */}

      <div className="panel">
        {/* FILTROS */}

        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #E4E4E7',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <select
            className="select-field"
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value)}
          >
            <option value="">Todos los roles</option>

            {(
              ['gerente', 'coordinador', 'analista'] as RolUsuario[]
            ).map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>

          <select
            className="select-field"
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
          >
            <option value="">Todas las sedes</option>

            {SEDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: '#71717A',
            }}
          >
            {filtered.length} de {usuarios.length} usuarios
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setShowNew(true);
              setErrors({});
            }}
          >
            + Nuevo usuario
          </button>
        </div>

        {/* ===================================================
            TABLA
        ==================================================== */}

        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Sede</th>
              <th>Último acceso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    padding: 30,
                    color: '#71717A',
                  }}
                >
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  {/* CÓDIGO */}

                  <td
                    style={{
                      color: '#71717A',
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                  >
                    {u.codigo || u.id.substring(0, 8)}
                  </td>

                  {/* NOMBRE */}

                  <td style={{ fontWeight: 500 }}>
                    {u.nombre}
                  </td>

                  {/* EMAIL */}

                  <td
                    style={{
                      fontSize: 12,
                      color: '#71717A',
                    }}
                  >
                    {u.email}
                  </td>

                  {/* ROL */}

                  <td>
                    <span
                      className={`badge badge-${
                        ROL_BADGE[u.rol] || 'gray'
                      }`}
                    >
                      {ROL_LABEL[u.rol] || u.rol}
                    </span>
                  </td>

                  {/* SEDE */}

                  <td
                    style={{
                      fontSize: 12,
                      color: '#71717A',
                    }}
                  >
                    {u.sede || '-'}
                  </td>

                  {/* ÚLTIMO ACCESO */}

                  <td
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: '#71717A',
                    }}
                  >
                    {u.ultimo_acceso
                      ? new Date(u.ultimo_acceso).toLocaleString('es-PE')
                      : 'Sin acceso'}
                  </td>

                  {/* ESTADO */}

                  <td>
                    <span
                      className={`badge status-badge badge-${
                        u.estado === 'ACTIVO'
                          ? 'green'
                          : 'gray'
                      }`}
                    >
                      {u.estado}
                    </span>
                  </td>

                  {/* ACCIONES */}

                  <td>
                    <button
                      className={`btn ${
                        u.estado === 'ACTIVO'
                          ? 'btn-danger'
                          : 'btn-ghost'
                      }`}
                      style={{
                        padding: '3px 9px',
                        fontSize: 11,
                      }}
                      onClick={() => handleToggle(u)}
                    >
                      {u.estado === 'ACTIVO'
                        ? 'Desactivar'
                        : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          MODAL NUEVO USUARIO
      ====================================================== */}

      {showNew && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowNew(false);
            setErrors({});
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}

            <div className="modal-header">
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#18181B',
                }}
              >
                Nuevo Usuario
              </h2>

              <button
                className="btn btn-ghost"
                style={{
                  padding: '5px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => {
                  setShowNew(false);
                  setErrors({});
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 15 15"
                  fill="none"
                >
                  <path
                    d="M2.5 2.5l10 10M12.5 2.5l-10 10"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* BODY */}

            <div
              style={{
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* NOMBRE */}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#52525B',
                    marginBottom: 6,
                  }}
                >
                  Nombre completo
                </label>

                <input
                  className="input-field"
                  type="text"
                  placeholder="Ej. María García Soto"
                  style={{
                    borderColor: errors.nombre
                      ? '#DC2626'
                      : undefined,
                  }}
                  value={form.nombre}
                  onChange={(e) => {
                    setForm((p) => ({
                      ...p,
                      nombre: e.target.value,
                    }));

                    setErrors((p) => ({
                      ...p,
                      nombre: '',
                    }));
                  }}
                />

                {errors.nombre && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#DC2626',
                      marginTop: 3,
                    }}
                  >
                    {errors.nombre}
                  </div>
                )}
              </div>

              {/* EMAIL */}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#52525B',
                    marginBottom: 6,
                  }}
                >
                  Correo electrónico
                </label>

                <input
                  className="input-field"
                  type="email"
                  placeholder="usuario@jip.pe"
                  style={{
                    borderColor: errors.email
                      ? '#DC2626'
                      : undefined,
                  }}
                  value={form.email}
                  onChange={(e) => {
                    setForm((p) => ({
                      ...p,
                      email: e.target.value,
                    }));

                    setErrors((p) => ({
                      ...p,
                      email: '',
                    }));
                  }}
                />

                {errors.email && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#DC2626',
                      marginTop: 3,
                    }}
                  >
                    {errors.email}
                  </div>
                )}
              </div>

              {/* ROL */}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#52525B',
                    marginBottom: 6,
                  }}
                >
                  Rol
                </label>

                <select
                  className="select-field"
                  style={{
                    width: '100%',
                  }}
                  value={form.rol}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      rol: e.target.value as RolUsuario,
                    }))
                  }
                >
                  <option value="analista">
                    Analista
                  </option>

                  <option value="coordinador">
                    Coordinador
                  </option>

                  <option value="gerente">
                    Gerente
                  </option>
                </select>
              </div>

              {/* SEDE */}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#52525B',
                    marginBottom: 6,
                  }}
                >
                  Sede asignada
                </label>

                <select
                  className="select-field"
                  style={{
                    width: '100%',
                  }}
                  value={form.sede}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      sede: e.target.value as Sede,
                    }))
                  }
                >
                  {SEDES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* FOOTER */}

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #E4E4E7',
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
              }}
            >
              <button
                className="btn btn-primary"
                onClick={handleCreate}
              >
                Crear usuario
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowNew(false);
                  setErrors({});
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}