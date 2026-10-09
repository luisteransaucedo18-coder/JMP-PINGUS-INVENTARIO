export type Role = "gerente" | "analista" | "coordinador"

export type Sede = "Chiclayo" | "Chimbote" | "Trujillo"

export type EstadoMaterial = "OK" | "BAJO" | "CRÍTICO" | "AGOTADO"

type EstadoReq = "BORRADOR" | "ENVIADO" | "CONFIRMADO" | "RECHAZADO"

export type EstadoEntrega = "PENDIENTE" | "PARCIAL" | "COMPLETA" | "CANCELADA"

export type EstadoCompra = "BORRADOR" | "ENVIADO" | "APROBADO" | "COMPRADO" | "RECHAZADO"

// ======================================================

// COMPRAS

// ======================================================

export interface CompraItem {
  skuId: string

  nombre: string

  cantidadSolicitada: number

  precioUnitario?: number
}

export interface RequerimientoCompra {
  analistaId?: string
  requerimientoId?: string
  uuid?: string

  id: string

  sede: Sede

  analista: string

  fecha: string

  motivo: string

  observaciones?: string

  items: CompraItem[]

  estado: EstadoCompra

  coordinador?: string

  fechaAprobacion?: string

  fechaCompra?: string

  notaCompra?: string
}

// ======================================================

// MATERIALES

// ======================================================

export interface Material {
  // En Supabase este valor corresponde al SKU

  id: string

  nombre: string

  descripcion: string

  categoria: string

  unidad: string

  marca?: string

  // Stock por sede.

  // Más adelante puede venir de otra tabla de Supabase.

  stockSedes: Record<Sede, number>

  minimo: number

  precioUnitario: number

  estado: EstadoMaterial

  // URL de Supabase Storage

  imagen?: string
}

// ======================================================

// REQUERIMIENTOS

// ======================================================

export interface ReqMaterial {
  skuId: string

  nombre: string

  cantidad: number

  unidad?: string

  marca?: string

  stockAlEnvio?: number

  faltanteAlEnvio?: number
}

export interface Requerimiento {
  analistaId?: string
  dbId?: string

  id: string

  codigo?: string

  proyectoId: string

  proyecto: string

  sede: Sede

  ubicacion: string

  descripcion: string

  tecnico: string

  analista: string

  fecha: string

  materiales: ReqMaterial[]

  estado: EstadoReq

  observaciones?: string

  confirmadoPor?: string
  confirmadoPorId?: string

  fechaConfirmacion?: string

  abastecimiento?: {
    estado: "PENDIENTE" | "EN_GESTION" | "RESUELTO"
    tipo?: "COMPRA" | "TRASLADO"
    origenSugerido?: Sede
    observaciones?: string
    ordenCompraId?: string
  }
}

// ======================================================

// PROYECTOS

// ======================================================

export interface Proyecto {
  dbId?: string

  id: string

  nombre: string

  ubicacion: string

  sede: Sede

  responsable: string

  cliente: string

  observaciones?: string

  creadoEn: string

  estadoObra?: 'PLANIFICADO' | 'EN_CONSTRUCCION' | 'PAUSADO' | 'FINALIZADO' | 'CANCELADO'
  fechaFinalizacion?: string
  garantiaHasta?: string
  revisionObra?: number
}

// ======================================================

// ENTREGAS

// ======================================================

export interface EntregaItem {
  skuId: string

  nombre: string

  cantidadSolicitada: number

  cantidadEntregada: number
}

export interface Entrega {
  id: string

  codigo?: string

  requerimientoCodigo?: string

  fechaHora?: string

  requerimientoId: string

  proyectoNombre: string

  tecnico: string

  dniTecnico: string

  responsableEntrega: string

  fecha: string

  hora: string

  items: EntregaItem[]

  estado: EstadoEntrega

  observaciones?: string
}

// ======================================================

// CONSTANTES

// ======================================================

export const SEDES: Sede[] = [
  "Chiclayo",

  "Chimbote",

  "Trujillo",
]
