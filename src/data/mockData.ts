export type Role = 'gerente' | 'analista' | 'coordinador';
export type Sede = 'Chiclayo' | 'Chimbote' | 'Trujillo';
export type EstadoMaterial = 'OK' | 'BAJO' | 'CRÍTICO' | 'AGOTADO';
export type EstadoReq = 'BORRADOR' | 'ENVIADO' | 'CONFIRMADO' | 'RECHAZADO';
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';
export type EstadoEntrega = 'PENDIENTE' | 'PARCIAL' | 'COMPLETA' | 'CANCELADA';
export type EstadoCompra = 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'COMPRADO' | 'RECHAZADO';
import tuberia15958 from '../productos/tuberiapealpe1216.webp';

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

export const compras: RequerimientoCompra[] = [
  
];

export interface Material {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidad: 'UND';
  marca?: string;
  stockSedes: Record<Sede, number>;
  minimo: number;
  estado: EstadoMaterial;
  imagen?: string;
}

export interface ReqMaterial {
  skuId: string;
  nombre: string;
  cantidad: number;
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

export const SEDES: Sede[] = ['Chiclayo', 'Chimbote', 'Trujillo'];

export const proyectos: Proyecto[] = [
  
];

export const materials: Material[] = [

];

export const requerimientos: Requerimiento[] = [
 
];

export const entregas: Entrega[] = [
  
];