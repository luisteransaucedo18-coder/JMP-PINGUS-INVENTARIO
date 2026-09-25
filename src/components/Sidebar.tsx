import { useEffect, useState } from 'react';
import { Role } from '../data/mockData';
import { useAppStore } from '../store/AppContext';
import { ASSETS } from '../config/assets';

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
    { id: 'devoluciones',     label: 'Devoluciones',     icon: <ReturnIcon /> },
    { id: 'mis-compras',      label: 'Órdenes de Compra', icon: <CartIcon /> },
    { id: 'inventario',       label: 'Inventario',       icon: <BoxIcon /> },
  ],
  coordinador: [
    { id: 'dashboard',       label: 'Dashboard',        icon: <GridIcon /> },
    { id: 'requerimientos',  label: 'Requerimientos',   icon: <DocIcon /> },
    { id: 'compras',         label: 'Compras',          icon: <CartIcon /> },
    { id: 'proyectos',       label: 'Proyectos',        icon: <MapIcon /> },
    { id: 'entregas',        label: 'Entregas',         icon: <InIcon /> },
    { id: 'devoluciones',    label: 'Devoluciones',     icon: <ReturnIcon /> },
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
  const [hovered, setHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const nav = navByRole[role];
  const badge = roleBadgeColors[role];
  const pendingReqs    = state.requerimientos.filter(r => r.estado === 'ENVIADO').length;
  const pendingCompras = state.compras.filter(c => c.estado === 'ENVIADO').length;
  const initials = userName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const expanded = isMobile || hovered;
  const W = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <aside
      className="app-sidebar"
      data-expanded={expanded}
      onMouseEnter={() => { if (!isMobile) setHovered(true); }}
      onMouseLeave={() => { if (!isMobile) setHovered(false); }}
      style={{
        width: W,
        minWidth: W,
      }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        {expanded ? (
          <img className="sidebar-logo-full" src={ASSETS.logo} alt="JIP" />
        ) : (
          <div className="sidebar-logo-mark">
            <img src={ASSETS.logoIcon} alt="JIP" />
          </div>
        )}
      </div>

      {/* Role badge */}
      <div className="sidebar-role">
        {expanded ? (
          <>
            <div className="sidebar-role-label">Rol activo</div>
            <span className="sidebar-role-chip" style={{ background: badge.bg, color: badge.text }}>
              <span className="sidebar-role-signal" style={{ background: badge.text }} />
              {roleLabels[role]}
            </span>
          </>
        ) : (
          <div className="sidebar-role-orb" title={roleLabels[role]} style={{ color: badge.text }}>
            <span style={{ background: badge.text }} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {expanded && (
          <div className="sidebar-nav-label">Navegación</div>
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
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNav(item.id)}
            >
              <span className="sidebar-link-icon">
                {item.icon}
              </span>
              {expanded && (
                <>
                  <span className="sidebar-link-label">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="sidebar-link-badge">
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
              {!expanded && badgeCount > 0 && (
                <span className="sidebar-link-alert" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer user */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <button className={`sidebar-user-avatar${activeView === 'perfil' ? ' active' : ''}`} title={!expanded ? userName : undefined} onClick={() => onNav('perfil')} style={{ background: badge.bg, color: badge.text }}>
            {initials}
          </button>
          {expanded && (
            <div className="sidebar-user-copy">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-email">{userEmail}</div>
            </div>
          )}
        </div>
        {expanded && (
          <button className="sidebar-logout" onClick={onLogout}>
            <LogoutIcon />
            <span>Cerrar sesión</span>
          </button>
        )}
        {!expanded && (
          <button className="sidebar-logout-compact" title="Cerrar sesión" onClick={onLogout}>
            <LogoutIcon />
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
function ReturnIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M6 4H3V1M3.4 4a5.5 5.5 0 1 1-.7 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="m3 4 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}
function LogoutIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M6 2H2v11h4M10 10l3-2.5L10 5M13 7.5H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
