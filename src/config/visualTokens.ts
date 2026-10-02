import type { EstadoCompra, Requerimiento, Sede } from '../domain/types';

export const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };
export const SEDE_BG: Record<Sede, string> = { Chiclayo: '#DBEAFE', Chimbote: '#CCFBF1', Trujillo: '#F3E8FF' };
export const REQUERIMIENTO_COLOR: Record<Requerimiento['estado'], string> = { BORRADOR: '#71717A', ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626' };
export const REQUERIMIENTO_BG: Record<Requerimiento['estado'], string> = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', CONFIRMADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };
export const COMPRA_COLOR: Record<EstadoCompra, string> = { BORRADOR: '#8B8FA8', ENVIADO: '#D97706', APROBADO: '#2563EB', COMPRADO: '#059669', RECHAZADO: '#DC2626' };
export const COMPRA_BG: Record<EstadoCompra, string> = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', APROBADO: '#DBEAFE', COMPRADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };
