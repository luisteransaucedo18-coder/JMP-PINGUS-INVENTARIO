export type Role = 'gerente' | 'analista' | 'coordinador';

export type Sede = 'Chiclayo' | 'Chimbote' | 'Trujillo';

export type EstadoMaterial = 'OK' | 'BAJO' | 'CRÍTICO' | 'AGOTADO';

export type EstadoReq =
  | 'BORRADOR'
  | 'ENVIADO'
  | 'CONFIRMADO'
  | 'RECHAZADO';

export type EstadoUsuario =
  | 'ACTIVO'
  | 'INACTIVO';

export type EstadoEntrega =
  | 'PENDIENTE'
  | 'PARCIAL'
  | 'COMPLETA'
  | 'CANCELADA';

export type EstadoCompra =
  | 'BORRADOR'
  | 'ENVIADO'
  | 'APROBADO'
  | 'COMPRADO'
  | 'RECHAZADO';


// ======================================================
// COMPRAS
// ======================================================

export interface CompraItem {
  skuId: string;
  nombre: string;
  cantidadSolicitada: number;
  precioUnitario?: number;
}

export interface RequerimientoCompra {
  id: string;
  sede: Sede;
  analista: string;
  fecha: string;
  motivo: string;
  observaciones?: string;
  items: CompraItem[];
  estado: EstadoCompra;
  coordinador?: string;
  fechaAprobacion?: string;
  fechaCompra?: string;
  notaCompra?: string;
}

export const compras: RequerimientoCompra[] = [];


// ======================================================
// MATERIALES
// ======================================================

export interface Material {
  // En Supabase este valor corresponde al SKU
  id: string;

  nombre: string;
  descripcion: string;

  categoria: string;

  unidad: string;

  marca?: string;

  // Stock por sede.
  // Más adelante puede venir de otra tabla de Supabase.
  stockSedes: Record<Sede, number>;

  minimo: number;

  precioUnitario: number;

  estado: EstadoMaterial;

  // URL de Supabase Storage
  imagen?: string;
}


// ======================================================
// REQUERIMIENTOS
// ======================================================

export interface ReqMaterial {
  skuId: string;
  nombre: string;
  cantidad: number;
  unidad?: string;
  marca?: string;
}

export interface Requerimiento {
  id: string;
  proyectoId: string;
  proyecto: string;
  sede: Sede;
  ubicacion: string;
  descripcion: string;
  tecnico: string;
  analista: string;
  fecha: string;
  materiales: ReqMaterial[];
  estado: EstadoReq;
  observaciones?: string;
  confirmadoPor?: string;
  fechaConfirmacion?: string;
}


// ======================================================
// PROYECTOS
// ======================================================

export interface Proyecto {
  id: string;
  nombre: string;
  ubicacion: string;
  sede: Sede;
  responsable: string;
  cliente: string;
  observaciones?: string;
  creadoEn: string;
}


// ======================================================
// ENTREGAS
// ======================================================

export interface EntregaItem {
  skuId: string;
  nombre: string;
  cantidadSolicitada: number;
  cantidadEntregada: number;
}

export interface Entrega {
  id: string;
  requerimientoId: string;
  proyectoNombre: string;
  tecnico: string;
  dniTecnico: string;
  responsableEntrega: string;
  fecha: string;
  hora: string;
  items: EntregaItem[];
  estado: EstadoEntrega;
  observaciones?: string;
}


// ======================================================
// USUARIOS
// ======================================================

export interface Usuario {
  id: string;
  codigo?: string;
  nombre: string;
  email: string;
  rol: Role;
  sede: Sede | null;
  estado: EstadoUsuario;
  telefono?: string | null;
  cargo?: string | null;
  bio?: string | null;
  ultimo_acceso?: string | null;
  created_at?: string;
  updated_at?: string;
}


// ======================================================
// CONSTANTES
// ======================================================

export const SEDES: Sede[] = [
  'Chiclayo',
  'Chimbote',
  'Trujillo',
];


// ======================================================
// DATOS MOCK
// ======================================================

export const proyectos: Proyecto[] = [];

export const materials: Material[] = [];

export const usuarios: Usuario[] = [];

export const requerimientos: Requerimiento[] = [];

export const entregas: Entrega[] = [];
