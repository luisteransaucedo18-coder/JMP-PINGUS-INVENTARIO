const labels: Record<string, string> = {
  nombre: 'Proyecto', cliente: 'Cliente', ubicacion: 'Dirección', responsable: 'Responsable', sede: 'Sede',
  ciudad: 'Localidad', modalidad: 'Modalidad', tipo: 'Tipo', puntos: 'Puntos', alcance: 'Alcance',
  concesion: 'Concesión', condiciones: 'Condiciones', precioOfrecido: 'Precio ofrecido',
  utilidad: 'Utilidad', generales: 'Gastos generales', comision: 'Comisión', igv: 'IGV',
  financiamiento: 'Financiamiento', partidas: 'Partidas', cantidad: 'Cantidad', unidad: 'Unidad',
  nombreMaterial: 'Material', material_nombre: 'Material', material_sku: 'SKU', sku: 'SKU',
  descripcion: 'Descripción', costoUnitario: 'Costo unitario', precioUnitario: 'Precio unitario',
  costo_unitario: 'Costo unitario', precio_unitario: 'Precio unitario', total: 'Total', subtotal: 'Subtotal',
  costo: 'Costo', precio: 'Precio', rubro: 'Rubro', materiales: 'Materiales', gastos: 'Gastos',
  dias: 'Días', horas: 'Horas', factorStock: 'Factor de conversión', unidadCotizada: 'Unidad cotizada',
};
function display(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(display).filter(Boolean).join('\n');
  if (typeof value === 'object') return Object.entries(value).filter(([key]) => labels[key]).map(([key, item]) => {
    const text = display(item);
    return text ? `${labels[key]}: ${text}` : '';
  }).filter(Boolean).join(' · ');
  const text = String(value);
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text) ? '' : text;
}
export function legacyQuoteFields(budget: Record<string, unknown>) {
  return Object.entries(budget).filter(([key]) => labels[key]).map(([key, value]) => ({ label: labels[key], value: display(value) })).filter(field => field.value);
}
