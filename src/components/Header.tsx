import { useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  userName?: string;
  userInitials?: string;
  onBellClick?: () => void;
  unreadCount?: number;
}

export default function Header({ title, subtitle, actions, userName, userInitials, onBellClick, unreadCount = 0 }: HeaderProps) {
  const [search, setSearch] = useState('');

  return (
    <div className="app-header" style={{
      padding: '0 28px',
      margin: '0 24px',
      height: 68,
      background: '#fff',
      border: '1px solid #E7E9F8',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(46, 61, 116, 0.10), 0 1px 2px rgba(46, 61, 116, 0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Title */}
      <div className="header-title" style={{ minWidth: 0, flex: '0 1 auto' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1A1D23', letterSpacing: 0, lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 2, fontWeight: 400 }}>{subtitle}</div>}
      </div>

      {/* Search */}
      <div className="header-search" style={{ flex: 1, maxWidth: 340, position: 'relative', marginLeft: 12 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="#A1A1AA" strokeWidth="1.4"/>
          <path d="M10.5 10.5L13 13" stroke="#A1A1AA" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar en el sistema…"
          style={{
            width: '100%',
            height: 38,
            paddingLeft: 34,
            paddingRight: 12,
            borderRadius: 20,
            border: '1.5px solid #E8EAFF',
            background: '#F8F9FF',
            fontSize: 13,
            color: '#1A1D23',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E8EAFF'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Action slot */}
      {actions && <div style={{ display: 'flex', alignItems: 'center' }}>{actions}</div>}

      {/* Notification bell */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={onBellClick} style={{ width: 38, height: 38, borderRadius: 12, border: '1.5px solid #E8EAFF', background: '#F8F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EEF0FF'; (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8F9FF'; (e.currentTarget as HTMLElement).style.borderColor = '#E8EAFF'; }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5A4 4 0 0111.5 5.5V9l1.5 2H2L3.5 9V5.5A4 4 0 017.5 1.5z" stroke="#8B8FA8" strokeWidth="1.3"/><path d="M6 11a1.5 1.5 0 003 0" stroke="#8B8FA8" strokeWidth="1.3"/></svg>
        </button>
        {unreadCount > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: '#DC2626', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 3px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="header-avatar" title={userName} style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(37,99,235,0.35)' }}>
        {userInitials ?? 'U'}
      </div>
    </div>
  );
}
