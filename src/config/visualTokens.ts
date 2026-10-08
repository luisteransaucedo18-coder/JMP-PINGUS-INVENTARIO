import type { EstadoCompra, Requerimiento, Sede } from '../domain/types';

export const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };
export const SEDE_BG: Record<Sede, string> = { Chiclayo: '#DBEAFE', Chimbote: '#CCFBF1', Trujillo: '#F3E8FF' };
export const REQUERIMIENTO_COLOR: Record<Requerimiento['estado'], string> = { BORRADOR: '#526174', ENVIADO: '#8A5A19', CONFIRMADO: '#276749', RECHAZADO: '#9C3442' };
export const REQUERIMIENTO_BG: Record<Requerimiento['estado'], string> = { BORRADOR: '#EEF1F5', ENVIADO: '#FBF1DC', CONFIRMADO: '#E8F3EC', RECHAZADO: '#F9EAED' };
export const COMPRA_COLOR: Record<EstadoCompra, string> = { BORRADOR: '#526174', ENVIADO: '#8A5A19', APROBADO: '#105583', COMPRADO: '#276749', RECHAZADO: '#9C3442' };
export const COMPRA_BG: Record<EstadoCompra, string> = { BORRADOR: '#EEF1F5', ENVIADO: '#FBF1DC', APROBADO: '#E8F0F7', COMPRADO: '#E8F3EC', RECHAZADO: '#F9EAED' };
