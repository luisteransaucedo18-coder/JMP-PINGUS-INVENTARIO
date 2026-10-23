import { SEDES, type Sede } from '../domain/types';
export type InventoryPreferences = { search: string; category: string; status: string; sede: Sede | 'todas'; technical: boolean };
export const DEFAULT_INVENTORY_PREFERENCES: InventoryPreferences = { search: '', category: '', status: '', sede: 'todas', technical: false };
export function readInventoryPreferences(userId?: string): InventoryPreferences {
  if (!userId || typeof window === 'undefined') return { ...DEFAULT_INVENTORY_PREFERENCES };
  try {
    const value = JSON.parse(window.sessionStorage.getItem(`inventory-filters:${userId}`) || '{}');
    return {
      search: typeof value?.search === 'string' ? value.search.slice(0, 300) : '',
      category: typeof value?.category === 'string' ? value.category : '',
      status: ['OK', 'BAJO', 'CRÍTICO', 'AGOTADO'].includes(value?.status) ? value.status : '',
      sede: value?.sede === 'todas' || SEDES.includes(value?.sede) ? value.sede : 'todas',
      technical: value?.technical === true,
    };
  } catch { return { ...DEFAULT_INVENTORY_PREFERENCES }; }
}
export function saveInventoryPreferences(userId: string | undefined, value: InventoryPreferences) {
  if (!userId || typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(`inventory-filters:${userId}`, JSON.stringify(value)); } catch { /* Filtering still works when storage is unavailable. */ }
}
