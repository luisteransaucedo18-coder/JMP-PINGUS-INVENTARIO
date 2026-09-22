import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede } from '../../data/mockData';

interface Props { onToast: (msg: string) => void; }

const ROL_BADGE: Record<string, string> = { gerente: 'purple', analista: 'blue', coordinador: 'green' };
const ROL_LABEL: Record<string, string> = { gerente: 'Gerente', analista: 'Analista', coordinador: 'Coordinador' };

export default function UsuariosView({ onToast }: Props) {
  const { state, dispatch } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'analista' as string, sede: 'Chiclayo' as Sede });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rolFilter, setRolFilter] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');

  const filtered = state.users.filter(u =>
    (!rolFilter || u.rol === rolFilter) &&
    (!sedeFilter || u.sede === sedeFilter)
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email inválido';
    if (state.users.find(u => u.email === form.email)) e.email = 'Este email ya está registrado';
    return e;
  };

  const handleCreate = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    dispatch({ type: 'CREATE_USER', payload: { nombre: form.nombre, email: form.email, rol: form.rol, sede: form.sede } });
    onToast(`✓ Usuario creado: ${form.nombre} (${ROL_LABEL[form.rol]})`);
    setShowNew(false);
    setForm({ nombre: '', email: '', rol: 'analista', sede: 'Chiclayo' });
    setErrors({});
  };

  const handleToggle = (u: typeof state.users[0]) => {
    dispatch({ type: 'TOGGLE_USER_STATUS', payload: u.id });
    onToast(`${u.estado === 'ACTIVO' ? 'Usuario desactivado' : 'Usuario activado'}: ${u.nombre}`);
  };

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        {['gerente', 'coordinador', 'analista'].map(rol => {
          const cnt = state.users.filter(u => u.rol === rol).length;
          const activos = state.users.filter(u => u.rol === rol && u.estado === 'ACTIVO').length;
          const colors: Record<string, string> = { gerente: '#7C3AED', coordinador: '#059669', analista: '#2563EB' };
          const bgs: Record<string, string> = { gerente: '#F3E8FF', coordinador: '#CCFBF1', analista: '#DBEAFE' };
          return (
            <div key={rol} className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, color: '#71717A', fontWeight: 500 }}>{ROL_LABEL[rol]}</span>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: bgs[rol], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke={colors[rol]} strokeWidth="1.3"/><path d="M1 13c0-2.5 2-4 6.5-4s6.5 1.5 6.5 4" stroke={colors[rol]} strokeWidth="1.3" strokeLinecap="round"/></svg>
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colors[rol] }}>{cnt}</div>
              <div style={{ fontSize: 11, color: '#71717A', marginTop: 4 }}>{activos} activo{activos !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E4E4E7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select-field" value={rolFilter} onChange={e => setRolFilter(e.target.value)}>
            <option value="">Todos los roles</option>
            {['gerente', 'coordinador', 'analista'].map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
          <select className="select-field" value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}>
            <option value="">Todas las sedes</option>
            {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} de {state.users.length} usuarios</div>
          <button className="btn btn-primary" onClick={() => { setShowNew(true); setErrors({}); }}>+ Nuevo usuario</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Sede</th><th>Último acceso</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ color: '#71717A', fontSize: 12, fontFamily: 'monospace' }}>{u.id}</td>
                <td style={{ fontWeight: 500 }}>{u.nombre}</td>
                <td style={{ fontSize: 12, color: '#71717A' }}>{u.email}</td>
                <td><span className={`badge badge-${ROL_BADGE[u.rol] || 'gray'}`}>{ROL_LABEL[u.rol]}</span></td>
                <td style={{ fontSize: 12, color: '#71717A' }}>{u.sede}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A' }}>{u.ultimoAcceso}</td>
                <td><span className={`badge badge-${u.estado === 'ACTIVO' ? 'green' : 'gray'}`}>{u.estado}</span></td>
                <td>
                  <button className={`btn ${u.estado === 'ACTIVO' ? 'btn-danger' : 'btn-ghost'}`} style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => handleToggle(u)}>
                    {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => { setShowNew(false); setErrors({}); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>Nuevo Usuario</h2>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowNew(false); setErrors({}); }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['Nombre completo', 'nombre', 'text', 'Ej. María García Soto'], ['Correo electrónico', 'email', 'email', 'usuario@jip.pe']].map(([lbl, key, type, ph]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>{lbl}</label>
                  <input className="input-field" type={type} placeholder={ph}
                    style={{ borderColor: errors[key] ? '#DC2626' : undefined }}
                    value={(form as any)[key]} onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: '' })); }} />
                  {errors[key] && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors[key]}</div>}
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Rol</label>
                <select className="select-field" style={{ width: '100%' }} value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}>
                  <option value="analista">Analista</option>
                  <option value="coordinador">Coordinador</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Sede asignada</label>
                <select className="select-field" style={{ width: '100%' }} value={form.sede} onChange={e => setForm(p => ({ ...p, sede: e.target.value as Sede }))}>
                  {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleCreate}>Crear usuario</button>
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setErrors({}); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
