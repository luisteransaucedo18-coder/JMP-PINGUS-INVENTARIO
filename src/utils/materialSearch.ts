import type { Material } from '../domain/types';

export const normalizeMaterialSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export function searchMaterials(materials: Material[], query: string, limit: number, minLength = 0, categoryLabel?: (material: Material) => string) {
  const normalized = normalizeMaterialSearch(query);
  if (normalized.length < minLength) return [];
  const words = normalized.split(/\s+/).filter(Boolean);
  return materials.map((material, index) => {
    const code = normalizeMaterialSearch(material.id);
    const name = normalizeMaterialSearch(material.nombre);
    const text = `${code} ${name} ${normalizeMaterialSearch(material.categoria || '')} ${normalizeMaterialSearch(categoryLabel?.(material) || '')}`;
    return { material, index, matches: words.every(word => text.includes(word)), rank: normalized && code === normalized ? 0 : normalized && code.startsWith(normalized) ? 1 : normalized && name.startsWith(normalized) ? 2 : 3 };
  }).filter(result => result.matches).sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, limit).map(result => result.material);
}
