export const ESTADOS_OBRA = {
  PLANIFICADO: 'Planificado', EN_CONSTRUCCION: 'En construcción', PAUSADO: 'Pausado', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
} as const;
export type EstadoObra = keyof typeof ESTADOS_OBRA;
export const ESTADOS_INCIDENCIA = {
  ABIERTA: 'Abierta', EN_REVISION: 'En revisión', PROGRAMADA: 'Programada', EN_ATENCION: 'En atención', RESUELTA: 'Resuelta', RECHAZADA: 'Rechazada',
} as const;
export const COBERTURAS = { PENDIENTE: 'Pendiente de revisión', CUBIERTA: 'Cubierta por garantía', NO_CUBIERTA: 'Sin cobertura' } as const;
export const ETAPAS_EVIDENCIA = { PROCESO: 'Proceso de construcción', INSTALACION_FINAL: 'Instalación final', INCIDENCIA: 'Incidencia' } as const;
export type EtapaEvidencia = keyof typeof ETAPAS_EVIDENCIA;
export interface EvidenciaProyecto {
  id: string; proyecto_id: string; incidencia_id: string | null; etapa: EtapaEvidencia;
  ruta: string; nombre: string; descripcion: string; autor_nombre: string; created_at: string; url?: string;
}
export interface IncidenciaProyecto {
  id: string; proyecto_id: string; producto: string; material_sku: string | null; descripcion: string;
  fecha_incidencia: string; estado: keyof typeof ESTADOS_INCIDENCIA; cobertura: keyof typeof COBERTURAS;
  plazo_garantia: 'DENTRO' | 'FUERA' | 'SIN_INICIO'; garantia_hasta: string | null;
  fecha_atencion: string | null; resolucion: string; requerimiento_id: string | null;
  autor_nombre: string; revisor_nombre: string | null; created_at: string; updated_at: string; revision: number;
}
export function hoyPeru(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function fechaProyecto(value?: string | null) {
  if (!value) return 'Sin registrar';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(`${value.slice(0, 10)}T12:00:00-05:00`));
}
export function garantiaProyecto(inicio?: string, fin?: string, hoy = hoyPeru()) {
  if (!inicio || !fin) return 'Pendiente de finalización';
  if (hoy < inicio) return 'Aún no iniciada';
  return hoy <= fin ? 'Garantía vigente' : 'Garantía vencida';
}
