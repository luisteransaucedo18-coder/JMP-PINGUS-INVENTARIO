import type { Material, Requerimiento, Sede } from '../data/mockData';

export interface FaltanteRequerimiento {
  sku: string;
  nombre: string;
  unidad: string;
  solicitado: number;
  disponible: number;
  faltante: number;
  stockAlternativo: Partial<Record<Sede, number>>;
}

export function obtenerFaltantesRequerimiento(
  requerimiento: Requerimiento,
  materiales: Material[],
): FaltanteRequerimiento[] {
  return requerimiento.materiales.flatMap(item => {
    const material = materiales.find(candidate => candidate.id === item.skuId);
    const disponible = Number(material?.stockSedes[requerimiento.sede] ?? 0);
    const faltante = Math.max(Number(item.cantidad) - disponible, 0);
    if (faltante <= 0) return [];
    const stockAlternativo: Partial<Record<Sede, number>> = {};
    for (const [sede, stock] of Object.entries(material?.stockSedes ?? {})) {
      if (sede !== requerimiento.sede && Number(stock) > 0) {
        stockAlternativo[sede as Sede] = Number(stock);
      }
    }
    return [{
      sku: item.skuId,
      nombre: item.nombre,
      unidad: item.unidad ?? material?.unidad ?? 'UND',
      solicitado: Number(item.cantidad),
      disponible,
      faltante,
      stockAlternativo,
    }];
  });
}

export function sugerirSedeOrigen(
  faltantes: FaltanteRequerimiento[],
  destino: Sede,
): Sede | undefined {
  const sedes: Sede[] = ['Chiclayo', 'Chimbote', 'Trujillo'];
  const opciones = sedes
    .filter(sede => sede !== destino)
    .map(sede => ({
      sede,
      cobertura: faltantes.reduce(
        (total, item) => total + Math.min(item.faltante, item.stockAlternativo[sede] ?? 0),
        0,
      ),
    }))
    .sort((a, b) => b.cobertura - a.cobertura);
  return opciones[0]?.cobertura > 0 ? opciones[0].sede : undefined;
}

export function sedesConStockParaTraslado(
  faltantes: FaltanteRequerimiento[],
  destino: Sede,
): Sede[] {
  const sedes: Sede[] = ['Chiclayo', 'Chimbote', 'Trujillo'];
  return sedes.filter(sede =>
    sede !== destino && faltantes.some(item => (item.stockAlternativo[sede] ?? 0) > 0),
  );
}
