import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/AppContext';
import { Role } from '../data/mockData';

/* ── Notification shape ── */
export interface Notif {
  id: string;
  type: 'success' | 'warning' | 'info' | 'danger' | 'purchase';
  title: string;
  body: string;
  date: string;
  ref?: string; // folio / id reference
}

const TYPE_ICON: Record<Notif['type'], React.ReactNode> = {
  success:  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  warning:  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 5.5V9M7.5 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  info:     <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 5v.5M7.5 7v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  danger:   <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  purchase: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 1h2l2 8h7l1.5-5H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="13" r="1" fill="currentColor"/><circle cx="11" cy="13" r="1" fill="currentColor"/></svg>,
};
const TYPE_COLOR: Record<Notif['type'], string> = {
  success:  '#059669',
  warning:  '#D97706',
  info:     '#2563EB',
  danger:   '#DC2626',
  purchase: '#7C3AED',
};
const TYPE_BG: Record<Notif['type'], string> = {
  success:  '#CCFBF1',
  warning:  '#FEF3C7',
  info:     '#DBEAFE',
  danger:   '#FEE2E2',
  purchase: '#F3E8FF',
};

/* ── Derive notifications from app state ── */
export function useNotifications(role: Role, userName: string): Notif[] {
  const { state } = useAppStore();
  const notifs: Notif[] = [];

  if (role === 'coordinador') {
    /* Pending reqs */
    const pendingReqs = state.requerimientos.filter(r => r.estado === 'ENVIADO');
    if (pendingReqs.length > 0) {
      notifs.push({
        id: 'coord-pending-reqs',
        type: 'warning',
        title: `${pendingReqs.length} requerimiento${pendingReqs.length > 1 ? 's' : ''} pendiente${pendingReqs.length > 1 ? 's' : ''}`,
        body: `Solicitudes de ${[...new Set(pendingReqs.map(r => r.analista))].slice(0,2).join(', ')} esperan tu confirmación.`,
        date: pendingReqs[0]?.fecha ?? '',
        ref: pendingReqs.map(r => r.id).join(', '),
      });
    }
    /* Pending purchase orders */
    const pendingCompras = state.compras.filter(c => c.estado === 'ENVIADO');
    if (pendingCompras.length > 0) {
      notifs.push({
        id: 'coord-pending-compras',
        type: 'purchase',
        title: `${pendingCompras.length} orden${pendingCompras.length > 1 ? 'es' : ''} de compra por aprobar`,
        body: `${pendingCompras.map(c => c.id).slice(0,3).join(', ')} requieren tu aprobación.`,
        date: pendingCompras[0]?.fecha ?? '',
      });
    }
    /* Approved compras waiting for delivery confirmation */
    const approvedCompras = state.compras.filter(c => c.estado === 'APROBADO');
    if (approvedCompras.length > 0) {
      notifs.push({
        id: 'coord-approved-compras',
        type: 'info',
        title: `${approvedCompras.length} compra${approvedCompras.length > 1 ? 's' : ''} aprobada${approvedCompras.length > 1 ? 's' : ''} — sin ingresar`,
        body: `Confirma la recepción para actualizar el stock: ${approvedCompras.map(c => c.id).slice(0,2).join(', ')}.`,
        date: approvedCompras[0]?.fechaAprobacion ?? '',
      });
    }
    /* Recently confirmed reqs */
    const recentConf = state.requerimientos.filter(r => r.estado === 'CONFIRMADO' && r.confirmadoPor === userName).slice(0,3);
    recentConf.forEach(r => {
      notifs.push({
        id: `coord-conf-${r.id}`,
        type: 'success',
        title: `Requerimiento confirmado`,
        body: `${r.id} · ${r.proyecto} — confirmado por ti.`,
        date: r.fechaConfirmacion ?? r.fecha,
        ref: r.id,
      });
    });
    /* Stock alerts */
    const criticos = state.materials.filter(m => m.estado === 'CRÍTICO' || m.estado === 'AGOTADO');
    if (criticos.length > 0) {
      notifs.push({
        id: 'coord-stock-critical',
        type: 'danger',
        title: `${criticos.length} material${criticos.length > 1 ? 'es' : ''} en stock crítico`,
        body: criticos.slice(0,3).map(m => m.nombre).join(', ') + (criticos.length > 3 ? ` y ${criticos.length - 3} más.` : '.'),
        date: new Date().toISOString().split('T')[0],
      });
    }
    const bajos = state.materials.filter(m => m.estado === 'BAJO');
    if (bajos.length > 0) {
      notifs.push({
        id: 'coord-stock-low',
        type: 'warning',
        title: `${bajos.length} material${bajos.length > 1 ? 'es' : ''} con stock bajo`,
        body: bajos.slice(0,3).map(m => m.nombre).join(', ') + (bajos.length > 3 ? ` y ${bajos.length - 3} más.` : '.'),
        date: new Date().toISOString().split('T')[0],
      });
    }
  }

  if (role === 'analista') {
    /* Own reqs confirmed */
    const myConf = state.requerimientos.filter(r => r.analista === userName && r.estado === 'CONFIRMADO');
    myConf.slice(0,3).forEach(r => {
      notifs.push({
        id: `ana-conf-${r.id}`,
        type: 'success',
        title: 'Solicitud confirmada',
        body: `${r.id} · ${r.proyecto} fue aprobada por ${r.confirmadoPor ?? 'el coordinador'}.`,
        date: r.fechaConfirmacion ?? r.fecha,
        ref: r.id,
      });
    });
    /* Own reqs rejected */
    const myRej = state.requerimientos.filter(r => r.analista === userName && r.estado === 'RECHAZADO');
    myRej.slice(0,3).forEach(r => {
      notifs.push({
        id: `ana-rej-${r.id}`,
        type: 'danger',
        title: 'Solicitud rechazada',
        body: `${r.id} · ${r.proyecto}${r.observaciones ? ': ' + r.observaciones : ''}.`,
        date: r.fecha,
        ref: r.id,
      });
    });
    /* Own reqs pending (sent, waiting) */
    const myPending = state.requerimientos.filter(r => r.analista === userName && r.estado === 'ENVIADO');
    if (myPending.length > 0) {
      notifs.push({
        id: 'ana-pending',
        type: 'info',
        title: `${myPending.length} solicitud${myPending.length > 1 ? 'es' : ''} en revisión`,
        body: `${myPending.map(r => r.id).join(', ')} esperan confirmación del coordinador.`,
        date: myPending[0]?.fecha ?? '',
      });
    }
    /* Purchase orders approved */
    const myPurchApproved = state.compras.filter(c => c.analista === userName && c.estado === 'APROBADO');
    myPurchApproved.slice(0,2).forEach(c => {
      notifs.push({
        id: `ana-compra-aprov-${c.id}`,
        type: 'purchase',
        title: 'Orden de compra aprobada',
        body: `${c.id} fue aprobada por ${c.coordinador ?? 'el coordinador'}. El material será adquirido en breve.`,
        date: c.fechaAprobacion ?? c.fecha,
        ref: c.id,
      });
    });
    /* Purchase orders completed — stock updated */
    const myPurchDone = state.compras.filter(c => c.analista === userName && c.estado === 'COMPRADO');
    myPurchDone.slice(0,2).forEach(c => {
      notifs.push({
        id: `ana-compra-done-${c.id}`,
        type: 'success',
        title: 'Materiales ingresados al stock',
        body: `${c.id} fue completada. El stock de ${c.sede} ya refleja las nuevas unidades.`,
        date: c.fechaCompra ?? c.fecha,
        ref: c.id,
      });
    });
    /* Purchase orders rejected */
    const myPurchRej = state.compras.filter(c => c.analista === userName && c.estado === 'RECHAZADO');
    myPurchRej.slice(0,2).forEach(c => {
      notifs.push({
        id: `ana-compra-rej-${c.id}`,
        type: 'danger',
        title: 'Orden de compra rechazada',
        body: `${c.id}${c.observaciones ? ': ' + c.observaciones : ' — fue rechazada por el coordinador.'}.`,
        date: c.fecha,
        ref: c.id,
      });
    });
    /* Stock alerts relevant to their recent reqs' sedes */
    const criticos = state.materials.filter(m => m.estado === 'CRÍTICO' || m.estado === 'AGOTADO');
    if (criticos.length > 0) {
      notifs.push({
        id: 'ana-stock-alert',
        type: 'warning',
        title: `${criticos.length} material${criticos.length > 1 ? 'es' : ''} en stock crítico`,
        body: 'Considera crear una solicitud de compra para reponer el inventario.',
        date: new Date().toISOString().split('T')[0],
      });
    }
  }

  if (role === 'gerente') {
    /* Stock critical */
    const criticos = state.materials.filter(m => m.estado === 'CRÍTICO' || m.estado === 'AGOTADO');
    if (criticos.length > 0) {
      notifs.push({
        id: 'ger-critical',
        type: 'danger',
        title: `Alerta: ${criticos.length} material${criticos.length > 1 ? 'es' : ''} críticos`,
        body: criticos.slice(0,3).map(m => `${m.nombre} (${m.estado})`).join(' · ') + (criticos.length > 3 ? ` y ${criticos.length - 3} más.` : '.'),
        date: new Date().toISOString().split('T')[0],
      });
    }
    const bajos = state.materials.filter(m => m.estado === 'BAJO');
    if (bajos.length > 0) {
      notifs.push({
        id: 'ger-bajo',
        type: 'warning',
        title: `${bajos.length} material${bajos.length > 1 ? 'es' : ''} con stock bajo`,
        body: bajos.slice(0,3).map(m => m.nombre).join(', ') + (bajos.length > 3 ? ` y ${bajos.length - 3} más.` : '.'),
        date: new Date().toISOString().split('T')[0],
      });
    }
    /* Pending reqs summary */
    const totalPending = state.requerimientos.filter(r => r.estado === 'ENVIADO').length;
    if (totalPending > 0) {
      notifs.push({
        id: 'ger-pending-reqs',
        type: 'info',
        title: `${totalPending} requerimiento${totalPending > 1 ? 's' : ''} sin confirmar`,
        body: 'Hay solicitudes de materiales esperando aprobación del coordinador.',
        date: new Date().toISOString().split('T')[0],
      });
    }
    /* Purchases pending */
    const pendCompras = state.compras.filter(c => c.estado === 'ENVIADO' || c.estado === 'APROBADO').length;
    if (pendCompras > 0) {
      notifs.push({
        id: 'ger-pending-compras',
        type: 'purchase',
        title: `${pendCompras} orden${pendCompras > 1 ? 'es' : ''} de compra en proceso`,
        body: 'Revisa el módulo de Reportes para ver el estado del presupuesto de compras.',
        date: new Date().toISOString().split('T')[0],
      });
    }
    /* Recent confirmed reqs */
    const recentConf = state.requerimientos.filter(r => r.estado === 'CONFIRMADO').slice(0, 3);
    if (recentConf.length > 0) {
      notifs.push({
        id: 'ger-recent-conf',
        type: 'success',
        title: `${recentConf.length} solicitud${recentConf.length > 1 ? 'es' : ''} confirmada${recentConf.length > 1 ? 's' : ''} recientemente`,
        body: recentConf.map(r => r.id + ' · ' + r.proyecto).join(' | '),
        date: recentConf[0]?.fechaConfirmacion ?? recentConf[0]?.fecha ?? '',
      });
    }
  }

  /* Sort by date descending */
  return notifs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/* ── Time-ago helper ── */
function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date('2026-09-22');
  const d   = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  if (diff < 30) return `Hace ${Math.floor(diff / 7)} semana${Math.floor(diff / 7) > 1 ? 's' : ''}`;
  return `Hace ${Math.floor(diff / 30)} mes${Math.floor(diff / 30) > 1 ? 'es' : ''}`;
}

/* ── Panel component ── */
interface Props {
  open: boolean;
  onClose: () => void;
  role: Role;
  userName: string;
  readIds?: Set<string>;
  onMarkRead?: (ids: Set<string>) => void;
}

export default function NotificationsPanel({ open, onClose, role, userName, readIds, onMarkRead }: Props) {
  const notifications = useNotifications(role, userName);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());
  const read = readIds ?? localRead;
  const setRead = onMarkRead ?? setLocalRead;
  const [filter, setFilter] = useState<Notif['type'] | 'all'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const markAllRead = () => setRead(new Set(notifications.map(n => n.id)) as any);
  const markRead = (id: string) => setRead((prev: Set<string>) => new Set([...prev, id]) as any);

  const unread = notifications.filter(n => !read.has(n.id)).length;

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);

  const FILTER_OPTIONS: { value: Notif['type'] | 'all'; label: string }[] = [
    { value: 'all',      label: 'Todas' },
    { value: 'danger',   label: 'Alertas' },
    { value: 'warning',  label: 'Avisos' },
    { value: 'success',  label: 'Éxitos' },
    { value: 'info',     label: 'Info' },
    { value: 'purchase', label: 'Compras' },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 98, backdropFilter: 'blur(1px)' }} onClick={onClose} />
      )}

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        className="notifications-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: '#fff',
          zIndex: 99,
          boxShadow: '-8px 0 40px rgba(99,102,241,0.15)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '20px 0 0 20px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 22px 14px', borderBottom: '1px solid #F0F2FF', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: '#EEF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5A4 4 0 0111.5 5.5V9l1.5 2H2L3.5 9V5.5A4 4 0 017.5 1.5z" stroke="#2563EB" strokeWidth="1.3"/><path d="M6 11a1.5 1.5 0 003 0" stroke="#2563EB" strokeWidth="1.3"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1D23', letterSpacing: '-0.01em' }}>Notificaciones</div>
                {unread > 0 && (
                  <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 1 }}>{unread} sin leer</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ fontSize: 11.5, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 8px', borderRadius: 6, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                  Marcar todo leído
                </button>
              )}
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: '#F8F9FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B8FA8', fontSize: 18, lineHeight: 1, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FF'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F8F9FF'}>
                ×
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
            {FILTER_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setFilter(opt.value)} style={{
                padding: '5px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s',
                background: filter === opt.value ? '#2563EB' : '#F8F9FF',
                color: filter === opt.value ? '#fff' : '#8B8FA8',
                boxShadow: filter === opt.value ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
              }}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F8F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4C6D8' }}><svg width="24" height="24" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5A4 4 0 0111.5 5.5V9l1.5 2H2L3.5 9V5.5A4 4 0 017.5 1.5z" stroke="currentColor" strokeWidth="1.3"/><path d="M6 11a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3"/></svg></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1D23' }}>Sin notificaciones</div>
              <div style={{ fontSize: 12.5, color: '#8B8FA8', textAlign: 'center', maxWidth: 220 }}>
                {filter === 'all' ? 'Todo está al día. Aquí aparecerán los eventos relevantes del sistema.' : `No hay notificaciones de este tipo.`}
              </div>
            </div>
          ) : (
            filtered.map(n => {
              const isRead = read.has(n.id);
              return (
                <div key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display: 'flex', gap: 13, padding: '14px 20px', cursor: 'pointer',
                    borderBottom: '1px solid #F8F9FF',
                    background: isRead ? '#fff' : '#FAFBFF',
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F9FF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isRead ? '#fff' : '#FAFBFF'}
                >
                  {/* Unread dot */}
                  {!isRead && (
                    <div style={{ position: 'absolute', top: 18, right: 18, width: 7, height: 7, borderRadius: '50%', background: TYPE_COLOR[n.type] }} />
                  )}

                  {/* Icon */}
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: TYPE_BG[n.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, fontWeight: 800, color: TYPE_COLOR[n.type] }}>
                    {TYPE_ICON[n.type]}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: '#1A1D23', lineHeight: 1.3 }}>{n.title}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#8B8FA8', lineHeight: 1.5, marginBottom: 5 }}>{n.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {n.ref && (
                        <span style={{ fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: TYPE_COLOR[n.type], background: TYPE_BG[n.type], borderRadius: 5, padding: '1px 6px' }}>{n.ref.split(',')[0]}</span>
                      )}
                      <span style={{ fontSize: 11, color: '#C4C6D8' }}>{timeAgo(n.date)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F2FF', flexShrink: 0, background: '#FAFBFF' }}>
          <div style={{ fontSize: 11.5, color: '#C4C6D8', textAlign: 'center' }}>
            Las notificaciones se generan automáticamente desde el estado del sistema.
          </div>
        </div>
      </div>
    </>
  );
}
