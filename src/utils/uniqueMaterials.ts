/** A material may appear once per document; the same SKU across documents is valid. */
export function tieneMaterialesRepetidos(items: ReadonlyArray<{ skuId: string }>): boolean {
  const seen = new Set<string>();
  for (const { skuId } of items) {
    if (!skuId) continue;
    if (seen.has(skuId)) return true;
    seen.add(skuId);
  }
  return false;
}
