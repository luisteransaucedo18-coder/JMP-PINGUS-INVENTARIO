import type { Material, Sede, EstadoMaterial } from '../domain/types';

export const MINIMO_INICIAL_INVENTARIO = 30;

export function calcularEstado(stock: number, minimo: number): EstadoMaterial {
  if (stock <= 0) return 'AGOTADO';
  if (stock < minimo) return 'CRÍTICO';
  if (stock <= minimo * 1.5) return 'BAJO';
  return 'OK';
}

export function estadoPorSede(material: Material, sede: Sede): EstadoMaterial {
  return calcularEstado(Number(material.stockSedes[sede] ?? 0), material.minimo);
}

export function coincideEstadoSedes(material: Material, sedes: readonly Sede[], estado: string): boolean {
  return !estado || sedes.some(sede => estadoPorSede(material, sede) === estado);
}
