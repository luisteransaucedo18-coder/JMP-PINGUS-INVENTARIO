/** Operational references only. Database IDs stay in relationships and API calls. */
export function publicCode(record: { codigo?: string | null; id?: string | null }, fallback = 'Sin código'): string {
  const isInternal = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const code = record.codigo?.trim();
  if (code && !isInternal(code)) return code;
  const legacy = record.id?.trim();
  return legacy && !isInternal(legacy) ? legacy : fallback;
}
