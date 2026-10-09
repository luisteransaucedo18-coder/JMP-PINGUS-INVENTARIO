import type { Material } from '../domain/types';
import { validRollLength, validStockQuantity } from './stockQuantity';

export function rollParts(stock: number, metrosPorRollo: number) {
  const rolls = Math.floor(stock + 1e-9);
  // Both persisted factors have three decimals, so their product can need six.
  return { rollos: rolls, metros: Number(((stock - rolls) * metrosPorRollo).toFixed(6)) };
}
export function stockFromRollParts(rollos: number, metros: number, metrosPorRollo: number) {
  if (!Number.isInteger(rollos) || rollos < 0 || !Number.isFinite(metros) || metros < 0 || !validRollLength(metrosPorRollo) || metros >= metrosPorRollo)
    throw new Error('Indica rollos completos y metros restantes menores a la longitud de un rollo.');
  const stock = rollos + metros / metrosPorRollo;
  if (Math.abs(stock * 1000 - Math.round(stock * 1000)) > 0.000001)
    throw new Error(`Los metros restantes deben ser múltiplos de ${Number((metrosPorRollo / 1000).toFixed(6))} m para conservar la precisión del inventario.`);
  if (!validStockQuantity(stock)) throw new Error('La cantidad excede el límite del inventario.');
  return Number(stock.toFixed(3));
}
export function formatStock(cantidad: number, material: Pick<Material, 'unidad' | 'metrosPorRollo'>) {
  const number = (value: number) => value.toLocaleString('es-PE', { maximumFractionDigits: 3 });
  if (material.unidad !== 'ROLLO' || !material.metrosPorRollo) return `${number(cantidad)} ${material.unidad || 'UND'}`;
  const parts = rollParts(cantidad, material.metrosPorRollo);
  const metros = parts.metros.toLocaleString('es-PE', { maximumFractionDigits: 6 });
  return `${number(parts.rollos)} ${parts.rollos === 1 ? 'rollo' : 'rollos'}${parts.metros > 0 ? ` + ${metros} m` : ''}`;
}
