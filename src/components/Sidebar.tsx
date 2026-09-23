import { useState } from 'react';
import { Role } from '../data/mockData';
import { useAppStore } from '../store/AppContext';

interface NavItem { id: string; label: string; icon: React.ReactNode; badge?: number | (() => number); }

const navByRole: Record<Role, NavItem[]> = {
  gerente: [
    { id: 'dashboard',  label: 'Dashboard',   icon: <GridIcon /> },
    { id: 'reportes',   label: 'Reportes',    icon: <ChartIcon /> },
    { id: 'proyectos',  label: 'Proyectos',   icon: <MapIcon /> },
    { id: 'inventario', label: 'Inventario',  icon: <BoxIcon /> },
  ],
  analista: [
    { id: 'dashboard',        label: 'Dashboard',         icon: <GridIcon /> },
    { id: 'nueva-solicitud',  label: 'Nueva Solicitud',  icon: <PlusIcon /> },
    { id: 'mis-solicitudes',  label: 'Mis Solicitudes',  icon: <ClipboardIcon /> },
    { id: 'proyectos',        label: 'Proyectos',        icon: <MapIcon /> },
    { id: 'entregas',         label: 'Entregas',         icon: <InIcon /> },
    { id: 'mis-compras',      label: 'Órdenes de Compra', icon: <CartIcon /> },
    { id: 'inventario',       label: 'Inventario',       icon: <BoxIcon /> },
  ],
  coordinador: [
    { id: 'dashboard',       label: 'Dashboard',        icon: <GridIcon /> },
    { id: 'requerimientos',  label: 'Requerimientos',   icon: <DocIcon /> },
    { id: 'compras',         label: 'Compras',          icon: <CartIcon /> },
    { id: 'proyectos',       label: 'Proyectos',        icon: <MapIcon /> },
    { id: 'entregas',        label: 'Entregas',         icon: <InIcon /> },
    { id: 'inventario',      label: 'Inventario',       icon: <BoxIcon /> },
    { id: 'usuarios',        label: 'Usuarios',         icon: <UsersIcon /> },
  ],
};

const roleLabels: Record<Role, string> = {
  gerente:     'Gerente',
  analista:    'Analista',
  coordinador: 'Coordinador',
};

const roleBadgeColors: Record<Role, { bg: string; text: string }> = {
  gerente:     { bg: '#F3E8FF', text: '#7C3AED' },
  analista:    { bg: '#DBEAFE', text: '#1D4ED8' },
  coordinador: { bg: '#CCFBF1', text: '#0F766E' },
};

interface Props { role: Role; activeView: string; onNav: (v: string) => void; onLogout: () => void; userName: string; userEmail: string; onProfile?: () => void; }

const COLLAPSED_W = 62;
const EXPANDED_W  = 225;

export default function Sidebar({ role, activeView, onNav, onLogout, userName, userEmail }: Props) {
  const { state } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const nav = navByRole[role];
  const badge = roleBadgeColors[role];
  const pendingReqs    = state.requerimientos.filter(r => r.estado === 'ENVIADO').length;
  const pendingCompras = state.compras.filter(c => c.estado === 'ENVIADO').length;
  const initials = userName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const W = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <aside
      className="app-sidebar"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width: W,
        minWidth: W,
        background: '#fff',
        boxShadow: '2px 0 16px rgba(99,102,241,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        zIndex: 20,
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="sidebar-logo" style={{ padding: expanded ? '20px 20px 16px' : '18px 14px 16px', borderBottom: '1px solid #F0F2FF', transition: 'padding 0.22s', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {expanded
          ? <img src="/public/logo.png" alt="JIP" style={{ height: 38, objectFit: 'contain', display: 'block' }} />
          : <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/public/logo-icon.png" alt="JIP" style={{ width: 28, height: 28, objectFit: 'contain', filter: 'brightness(10)' }} />
            </div>
        }
      </div>

      {/* Role badge */}
      <div className="sidebar-role" style={{ padding: expanded ? '12px 18px' : '10px 0', borderBottom: '1px solid #F0F2FF', display: 'flex', flexDirection: 'column', alignItems: expanded ? 'flex-start' : 'center', justifyContent: 'center', transition: 'padding 0.22s', overflow: 'hidden' }}>
        {expanded ? (
          <>
            <div style={{ fontSize: 10, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Rol activo</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', background: badge.bg, color: badge.text, borderRadius: 4, padding: '3px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.text }} />
              {roleLabels[role]}
            </span>
          </>
        ) : (
          <div title={roleLabels[role]} style={{ width: 8, height: 8, borderRadius: '50%', background: badge.text, margin: '0 auto' }} />
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ flex: 1, padding: expanded ? '10px 0 10px 8px' : '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {expanded && (
          <div style={{ fontSize: 10, color: '#C4C6D8', letterSpacing: '0.10em', textTransform: 'uppercase', padding: '6px 14px', marginBottom: 2, fontWeight: 600 }}>Menú</div>
        )}
        {nav.map(item => {
          const badgeCount =
            (item.id === 'requerimientos' && role === 'coordinador') ? pendingReqs :
            (item.id === 'compras'        && role === 'coordinador') ? pendingCompras :
            (typeof item.badge === 'number' ? item.badge : 0);
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              title={!expanded ? item.label : undefined}
              className={`sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => onNav(item.id)}
              style={expanded ? undefined : {
                justifyContent: 'center',
                padding: '10px 0',
                width: COLLAPSED_W,
                borderRadius: 0,
                borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
              }}
            >
              <span style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#2563EB' : '#8B8FA8' }}>
                {item.icon}
              </span>
              {expanded && (
                <>
                  <span style={{ flex: 1, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.label}</span>
                  {badgeCount > 0 && (
                    <span style={{ background: '#DC2626', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center', flexShrink: 0, marginRight: 4 }}>
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
              {!expanded && badgeCount > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#DC2626', border: '1.5px solid #fff' }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="sidebar-footer" style={{ padding: expanded ? '14px 16px' : '14px 0', borderTop: '1px solid #F0F2FF', display: 'flex', flexDirection: 'column', alignItems: expanded ? 'stretch' : 'center', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 10 : 0, justifyContent: expanded ? 'flex-start' : 'center' }}>
          <div title={expanded ? undefined : userName} onClick={() => onNav('perfil')} style={{ width: 32, height: 32, borderRadius: '50%', background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: badge.text, flexShrink: 0, cursor: 'pointer', outline: activeView === 'perfil' ? `2px solid ${badge.text}` : 'none', outlineOffset: 2 }}>
            {initials}
          </div>
          {expanded && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ fontSize: 11, color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
            </div>
          )}
        </div>
        {expanded && (
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12, justifyContent: 'center', padding: '6px' }} onClick={onLogout}>
            ← Cerrar sesión
          </button>
        )}
        {!expanded && (
          <button title="Cerrar sesión" onClick={onLogout} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#C4C6D8', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M6 2H2v11h4M10 10l3-2.5L10 5M13 7.5H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
    </aside>
  );
}

/* ─── Inline SVG icons ─── */
function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
function BoxIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L13 4.5V10.5L7.5 14L2 10.5V4.5L7.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 1V14M2 4.5L13 4.5" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
function DocIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 2h7l3 3v9H3V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M10 2v3h3M5 7h5M5 9.5h5M5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function UsersIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M10.5 3.5a2 2 0 010 4M14 13c0-2-1.5-3.5-3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function ChartIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 13h13M3 13V8M6.5 13V5M10 13V9M13.5 13V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function InIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v8M4 7l3.5 4L11 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function MapIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 3l4.5 1.5L9 3l5 2v7l-5-2-3.5 1.5L1 10V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 4.5V12M9 3v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function ClipboardIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="3" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 3V2.5A1.5 1.5 0 016.5 1h2A1.5 1.5 0 0110 2.5V3" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 8h6M4.5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function CartIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 1h2l2 8h7l1.5-5H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="13" r="1" fill="currentColor"/><circle cx="11" cy="13" r="1" fill="currentColor"/></svg>;
}
