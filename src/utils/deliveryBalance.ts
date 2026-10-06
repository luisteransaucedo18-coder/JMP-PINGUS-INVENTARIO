import type { Entrega, EstadoEntrega, Requerimiento } from '../domain/types';

export function deliveryBalance(requirement: Requerimiento, deliveries: Entrega[]) {
  const actual = deliveries.filter(e => e.requerimientoId === requirement.id && e.estado !== 'CANCELADA');
  const rows = requirement.materiales.map(material => {
    const delivered = actual.reduce((sum, delivery) => sum + delivery.items.filter(i => i.skuId === material.skuId).reduce((n, i) => n + i.cantidadEntregada, 0), 0);
    return { ...material, delivered, remaining: Math.max(0, material.cantidad - delivered), excess: Math.max(0, delivered - material.cantidad) };
  });
  const status: EstadoEntrega | null = !actual.length ? null : rows.every(r => r.remaining === 0) ? 'COMPLETA' : rows.some(r => r.delivered > 0) ? 'PARCIAL' : 'PENDIENTE';
  return { rows, status, hasExcess: rows.some(r => r.excess > 0) };
}
