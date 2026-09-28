import type { Material } from '../data/mockData';

export function searchMaterials(materials: Material[], query: string, limit: number, minLength = 0) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < minLength) return [];
  return materials.filter(material =>
    [material.id, material.nombre, material.categoria]
      .some(value => value?.toLowerCase().includes(normalized))
  ).slice(0, limit);
}
