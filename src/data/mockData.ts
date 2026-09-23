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
  {
    id: 'OC-2026-001',
    sede: 'Chiclayo',
    analista: 'María García Soto',
    fecha: '2026-09-10',
    motivo: 'Stock de reguladores de presión baja agotado. Se requiere reposición urgente para proyecto Las Flores.',
    items: [
      { skuId: 'GAS-0001', nombre: 'Regulador de Presión Alta — 1/2"', cantidadSolicitada: 10, precioUnitario: 85 },
      { skuId: 'GAS-0002', nombre: 'Medidor de Gas Residencial G4', cantidadSolicitada: 5,  precioUnitario: 210 },
    ],
    estado: 'APROBADO',
    coordinador: 'Roberto Torres Díaz',
    fechaAprobacion: '2026-09-12',
  },
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
  {
    id: 'PRY-001',
    nombre: 'Urbanización Las Flores — Etapa 3',
    ubicacion: 'Av. José Balta 450, Mz. C, Lotes 12–18',
    sede: 'Chiclayo',
    responsable: 'Luis Alberto Reyes Castillo',
    cliente: 'Inmobiliaria Las Flores SAC',
    observaciones: 'Proyecto residencial de gas natural para 6 viviendas nuevas.',
    creadoEn: '2026-09-01',
  },
  {
    id: 'PRY-002',
    nombre: 'Conjunto Residencial El Mirador',
    ubicacion: 'Av. El Golf 1200, Torre B, Pisos 1–4',
    sede: 'Trujillo',
    responsable: 'Carlos Enrique Vásquez Morales',
    cliente: 'Constructora El Mirador EIRL',
    observaciones: 'Extensión de red hacia nuevo bloque de 12 apartamentos.',
    creadoEn: '2026-09-10',
  },
  {
    id: 'PRY-003',
    nombre: 'Planta Industrial Siderperú',
    ubicacion: 'Panamericana Norte Km 435, Galpón 7',
    sede: 'Chimbote',
    responsable: 'Jorge Primitivo Llanos Ríos',
    cliente: 'Siderperú SA',
    observaciones: 'Sistema de gas industrial para horno de tratamiento térmico.',
    creadoEn: '2026-09-12',
  },
  {
    id: 'PRY-004',
    nombre: 'Urbanización Costa Verde',
    ubicacion: 'Jr. Los Pinos 800, Sector A',
    sede: 'Trujillo',
    responsable: 'Pedro Alonso Méndez Torres',
    cliente: 'Municipalidad de Trujillo',
    creadoEn: '2026-09-14',
  },
  {
    id: 'PRY-005',
    nombre: 'Hospital Regional de Chiclayo',
    ubicacion: 'Av. Luis González 635, Pabellón Nuevo',
    sede: 'Chiclayo',
    responsable: 'Marco Antonio Silva Espinoza',
    cliente: 'GORE Lambayeque',
    observaciones: 'Instalación de gas medicinal (GLP) para nuevo pabellón. Proyecto prioritario.',
    creadoEn: '2026-09-15',
  },
  {
    id: 'PRY-006',
    nombre: 'Centro Comercial Real Plaza',
    ubicacion: 'Av. Miguel Grau 100, Zona de Restaurantes',
    sede: 'Chiclayo',
    responsable: 'Rafael Domingo Quispe Huanca',
    cliente: 'Real Plaza SA',
    observaciones: 'Ampliación de red para 8 nuevas acometidas de restaurantes.',
    creadoEn: '2026-09-18',
  },
];

export const materials: Material[] = [
  {
    id: '15958',
    nombre: 'TUBERIA PEALPE TCL 1216 X 200 (AMARILLA) S/C',
    descripcion: 'Un rollo de 200 metros de tubería multicapa (polietileno - aluminio - polietileno) de 1/2" nominal (12 mm interior / 16 mm exterior), diseñada para instalaciones interiores de gas natural o GLP',
    categoria: 'Gas Natural',
    marca: 'TCL',
    unidad: 'UND',
    stockSedes: { Chiclayo: 48, Chimbote: 15, Trujillo: 32 },
    minimo: 30,
    estado: 'OK',
    imagen: tuberia15958,
  },
  {
    id: 'GAS-0002',
    nombre: 'Válvula de corte esférica 3/4"',
    descripcion: 'Válvula esférica de paso total para línea de gas, PN16, con manija de palanca. Cuerpo latón, bola acero inoxidable.',
    categoria: 'Gas Natural',
    marca: 'Watts / Giacomini',
    unidad: 'UND',
    stockSedes: { Chiclayo: 120, Chimbote: 45, Trujillo: 80 },
    minimo: 60,
    estado: 'OK',
  },
  {
    id: 'GAS-0003',
    nombre: 'Medidor de gas G4 residencial',
    descripcion: 'Medidor volumétrico de gas residencial, Q_max 6 m³/h, con conexión 1/2". Clase de exactitud 1.5%. Homologado OSINERGMIN.',
    categoria: 'Gas Natural',
    marca: 'Elster / Landis+Gyr',
    unidad: 'UND',
    stockSedes: { Chiclayo: 8, Chimbote: 3, Trujillo: 5 },
    minimo: 15,
    estado: 'CRÍTICO',
  },
  {
    id: 'GAS-0004',
    nombre: 'Tubería PE-80 DN25 SDR-11',
    descripcion: 'Tubería de polietileno alta densidad para distribución de gas DN25, SDR-11, presión máx. 4 bar, rollo 50m. Color amarillo.',
    categoria: 'Gas Natural',
    marca: 'Tubos Tigre / Pavco',
    unidad: 'UND',
    stockSedes: { Chiclayo: 22, Chimbote: 8, Trujillo: 14 },
    minimo: 20,
    estado: 'BAJO',
  },
  {
    id: 'GAS-0005',
    nombre: 'Conector de compresión DN25 × 3/4"',
    descripcion: 'Accesorio de transición polietileno-acero para empalme de tubería PE a metálica. Cuerpo latón, manga PE.',
    categoria: 'Gas Natural',
    marca: 'Georg Fischer / Friatec',
    unidad: 'UND',
    stockSedes: { Chiclayo: 85, Chimbote: 30, Trujillo: 60 },
    minimo: 50,
    estado: 'OK',
  },
  {
    id: 'GAS-0006',
    nombre: 'Codo 90° PE-80 DN25',
    descripcion: 'Accesorio de curva 90° para tubería de polietileno gas DN25. Soldadura por electrofusión. Radio largo.',
    categoria: 'Gas Natural',
    marca: 'Georg Fischer',
    unidad: 'UND',
    stockSedes: { Chiclayo: 200, Chimbote: 75, Trujillo: 110 },
    minimo: 80,
    estado: 'OK',
  },
  {
    id: 'GAS-0007',
    nombre: 'Tee PE-80 DN25',
    descripcion: 'Accesorio de derivación igual para tubería de polietileno gas DN25. Unión por electrofusión.',
    categoria: 'Gas Natural',
    marca: 'Georg Fischer',
    unidad: 'UND',
    stockSedes: { Chiclayo: 95, Chimbote: 20, Trujillo: 55 },
    minimo: 60,
    estado: 'BAJO',
  },
  {
    id: 'GAS-0008',
    nombre: 'Válvula de seguridad anti-retorno 1/2"',
    descripcion: 'Válvula de seguridad con corte automático por sobrepresión y anti-retorno integrado. Homologada para GLP y GN.',
    categoria: 'Gas Natural',
    marca: 'Watts / Honeywell',
    unidad: 'UND',
    stockSedes: { Chiclayo: 0, Chimbote: 0, Trujillo: 2 },
    minimo: 10,
    estado: 'AGOTADO',
  },
  {
    id: 'GAS-0009',
    nombre: 'Sellador de juntas anaeróbico',
    descripcion: 'Sellador de roscas para gas, rango -55°C a +150°C, tubo 50ml. Resistente a GLP y GN. Aprobado DIN 30660.',
    categoria: 'Gas Natural',
    marca: 'Loctite 577',
    unidad: 'UND',
    stockSedes: { Chiclayo: 30, Chimbote: 12, Trujillo: 18 },
    minimo: 20,
    estado: 'OK',
  },
  {
    id: 'EPP-0001',
    nombre: 'Casco de seguridad clase E',
    descripcion: 'Casco dieléctrico clase E para trabajos en zonas de gas, con visera y arnés ajustable de 6 puntos. Color amarillo.',
    categoria: 'EPP',
    marca: '3M / MSA',
    unidad: 'UND',
    stockSedes: { Chiclayo: 15, Chimbote: 8, Trujillo: 12 },
    minimo: 10,
    estado: 'OK',
  },
  {
    id: 'EPP-0002',
    nombre: 'Guantes de nitrilo resistentes a gas',
    descripcion: 'Par de guantes protectores con resistencia química a GLP y GN, talla M/L. Certificado EN 374.',
    categoria: 'EPP',
    marca: 'Ansell / Showa',
    unidad: 'UND',
    stockSedes: { Chiclayo: 40, Chimbote: 15, Trujillo: 22 },
    minimo: 30,
    estado: 'OK',
  },
  {
    id: 'EPP-0003',
    nombre: 'Detector portátil de fuga de gas',
    descripcion: 'Detector electrónico de gas combustible con alarma visual y sonora, rango 0–100% LEL. Certificado ATEX.',
    categoria: 'EPP',
    marca: 'GFG / GMI',
    unidad: 'UND',
    stockSedes: { Chiclayo: 4, Chimbote: 1, Trujillo: 2 },
    minimo: 5,
    estado: 'CRÍTICO',
  },
  {
    id: 'HER-0001',
    nombre: 'Llave de grifo para gas 1/2"–3/4"',
    descripcion: 'Llave de servicio para instalación y mantenimiento de accesorios de gas roscado. Acero cromo vanadio.',
    categoria: 'Herramientas',
    marca: 'Stanley / Bahco',
    unidad: 'UND',
    stockSedes: { Chiclayo: 8, Chimbote: 3, Trujillo: 5 },
    minimo: 6,
    estado: 'OK',
  },
  {
    id: 'HER-0002',
    nombre: 'Equipo de presurización manual',
    descripcion: 'Bomba manual de prueba hidráulica con manómetro para pruebas de estanqueidad gas. Rango 0–25 bar.',
    categoria: 'Herramientas',
    marca: 'Reed / Rothenberger',
    unidad: 'UND',
    stockSedes: { Chiclayo: 3, Chimbote: 1, Trujillo: 2 },
    minimo: 2,
    estado: 'OK',
  },
  {
    id: 'SEN-0001',
    nombre: 'Cinta señalización peligro gas (rollo)',
    descripcion: 'Cinta amarilla/negro "PELIGRO GAS NATURAL" para demarcación de zona, rollo 50m. Polipropileno resistente a UV.',
    categoria: 'Señalética',
    marca: 'Brady / Labelmaster',
    unidad: 'UND',
    stockSedes: { Chiclayo: 10, Chimbote: 4, Trujillo: 6 },
    minimo: 8,
    estado: 'OK',
  },
];

export const requerimientos: Requerimiento[] = [
  {
    id: 'REQ-2026-001',
    proyectoId: 'PRY-001',
    proyecto: 'Urbanización Las Flores — Etapa 3',
    sede: 'Chiclayo',
    ubicacion: 'Av. José Balta 450, Mz. C, Lotes 12–18',
    descripcion: 'Instalación de red de distribución interna de gas natural para 6 viviendas nuevas. Acometida y medición.',
    tecnico: 'Luis Alberto Reyes Castillo',
    analista: 'María García',
    fecha: '2026-09-15',
    materiales: [
      { skuId: 'GAS-0001', nombre: 'Regulador de presión media 1/2"', cantidad: 6 },
      { skuId: 'GAS-0003', nombre: 'Medidor de gas G4 residencial', cantidad: 6 },
      { skuId: 'GAS-0004', nombre: 'Tubería PE-80 DN25 SDR-11', cantidad: 3 },
      { skuId: 'GAS-0005', nombre: 'Conector de compresión DN25 × 3/4"', cantidad: 12 },
    ],
    estado: 'CONFIRMADO',
    observaciones: 'Materiales aprobados. Coordinar entrega el 17/09.',
    confirmadoPor: 'Roberto Torres',
    fechaConfirmacion: '2026-09-16',
  },
  {
    id: 'REQ-2026-002',
    proyectoId: 'PRY-002',
    proyecto: 'Conjunto Residencial El Mirador',
    sede: 'Trujillo',
    ubicacion: 'Av. El Golf 1200, Torre B, Pisos 1–4',
    descripcion: 'Extensión de red hacia nuevo bloque de 12 apartamentos. Tubería adicional, válvulas y accesorios.',
    tecnico: 'Carlos Enrique Vásquez Morales',
    analista: 'María García',
    fecha: '2026-09-18',
    materiales: [
      { skuId: 'GAS-0002', nombre: 'Válvula de corte esférica 3/4"', cantidad: 12 },
      { skuId: 'GAS-0004', nombre: 'Tubería PE-80 DN25 SDR-11', cantidad: 5 },
      { skuId: 'GAS-0006', nombre: 'Codo 90° PE-80 DN25', cantidad: 24 },
      { skuId: 'GAS-0007', nombre: 'Tee PE-80 DN25', cantidad: 8 },
    ],
    estado: 'ENVIADO',
  },
  {
    id: 'REQ-2026-003',
    proyectoId: 'PRY-003',
    proyecto: 'Planta Industrial Siderperú',
    sede: 'Chimbote',
    ubicacion: 'Panamericana Norte Km 435, Galpón 7',
    descripcion: 'Instalación de sistema de gas industrial para horno de tratamiento térmico.',
    tecnico: 'Jorge Primitivo Llanos Ríos',
    analista: 'Ana Sofía Paredes',
    fecha: '2026-09-19',
    materiales: [
      { skuId: 'GAS-0002', nombre: 'Válvula de corte esférica 3/4"', cantidad: 8 },
      { skuId: 'GAS-0008', nombre: 'Válvula de seguridad anti-retorno 1/2"', cantidad: 4 },
      { skuId: 'EPP-0003', nombre: 'Detector portátil de fuga de gas', cantidad: 2 },
      { skuId: 'EPP-0001', nombre: 'Casco de seguridad clase E', cantidad: 4 },
    ],
    estado: 'ENVIADO',
  },
  {
    id: 'REQ-2026-004',
    proyectoId: 'PRY-004',
    proyecto: 'Urbanización Costa Verde',
    sede: 'Trujillo',
    ubicacion: 'Jr. Los Pinos 800, Sector A',
    descripcion: 'Mantenimiento preventivo de red existente. Reemplazo de válvulas con 5 años de servicio.',
    tecnico: 'Pedro Alonso Méndez Torres',
    analista: 'María García',
    fecha: '2026-09-20',
    materiales: [
      { skuId: 'GAS-0001', nombre: 'Regulador de presión media 1/2"', cantidad: 4 },
      { skuId: 'GAS-0002', nombre: 'Válvula de corte esférica 3/4"', cantidad: 10 },
      { skuId: 'GAS-0009', nombre: 'Sellador de juntas anaeróbico', cantidad: 5 },
    ],
    estado: 'RECHAZADO',
    observaciones: 'Stock insuficiente de válvulas en sede Trujillo. Reprogramar para octubre.',
    confirmadoPor: 'Roberto Torres',
    fechaConfirmacion: '2026-09-21',
  },
  {
    id: 'REQ-2026-005',
    proyectoId: 'PRY-005',
    proyecto: 'Hospital Regional de Chiclayo',
    sede: 'Chiclayo',
    ubicacion: 'Av. Luis González 635, Pabellón Nuevo',
    descripcion: 'Instalación de red de gas medicinal (GLP) para nuevo pabellón hospitalario. Proyecto prioritario.',
    tecnico: 'Marco Antonio Silva Espinoza',
    analista: 'Ana Sofía Paredes',
    fecha: '2026-09-21',
    materiales: [
      { skuId: 'GAS-0001', nombre: 'Regulador de presión media 1/2"', cantidad: 10 },
      { skuId: 'GAS-0008', nombre: 'Válvula de seguridad anti-retorno 1/2"', cantidad: 6 },
      { skuId: 'EPP-0003', nombre: 'Detector portátil de fuga de gas', cantidad: 2 },
      { skuId: 'SEN-0001', nombre: 'Cinta señalización peligro gas (rollo)', cantidad: 4 },
    ],
    estado: 'ENVIADO',
  },
  {
    id: 'REQ-2026-006',
    proyectoId: 'PRY-006',
    proyecto: 'Centro Comercial Real Plaza',
    sede: 'Chiclayo',
    ubicacion: 'Av. Miguel Grau 100, Zona de Restaurantes',
    descripcion: 'Ampliación de red de gas para nueva zona de restaurantes. 8 nuevas acometidas.',
    tecnico: 'Rafael Domingo Quispe Huanca',
    analista: 'María García',
    fecha: '2026-09-22',
    materiales: [
      { skuId: 'GAS-0003', nombre: 'Medidor de gas G4 residencial', cantidad: 8 },
      { skuId: 'GAS-0004', nombre: 'Tubería PE-80 DN25 SDR-11', cantidad: 4 },
      { skuId: 'GAS-0005', nombre: 'Conector de compresión DN25 × 3/4"', cantidad: 16 },
    ],
    estado: 'BORRADOR',
  },
];

export const entregas: Entrega[] = [
  {
    id: 'ENT-2026-001',
    requerimientoId: 'REQ-2026-001',
    proyectoNombre: 'Urbanización Las Flores — Etapa 3',
    tecnico: 'Luis Alberto Reyes Castillo',
    dniTecnico: '43215678',
    responsableEntrega: 'Roberto Torres Díaz',
    fecha: '2026-09-17',
    hora: '09:30',
    items: [
      { skuId: 'GAS-0001', nombre: 'Regulador de presión media 1/2"', cantidadSolicitada: 6, cantidadEntregada: 6 },
      { skuId: 'GAS-0003', nombre: 'Medidor de gas G4 residencial', cantidadSolicitada: 6, cantidadEntregada: 4 },
      { skuId: 'GAS-0004', nombre: 'Tubería PE-80 DN25 SDR-11', cantidadSolicitada: 3, cantidadEntregada: 3 },
      { skuId: 'GAS-0005', nombre: 'Conector de compresión DN25 × 3/4"', cantidadSolicitada: 12, cantidadEntregada: 12 },
    ],
    estado: 'PARCIAL',
    observaciones: 'Faltan 2 medidores G4. Se completará en siguiente recojo.',
  },
];

export const usuarios: Usuario[] = [
  {
    id: 'USR-001',
    nombre: 'Carlos Mendoza Vargas',
    email: 'gerente@jip.pe',
    rol: 'gerente',
    sede: 'Chiclayo',
    estado: 'ACTIVO',
    ultimo_acceso: '22/09/2026 08:30',
    codigo: ''
  },
  {
    id: 'USR-002',
    nombre: 'María García Soto',
    email: 'analista@jip.pe',
    rol: 'analista',
    sede: 'Chiclayo',
    estado: 'ACTIVO',
    ultimo_acceso: '22/09/2026 09:15',
    codigo: ''
  },
  {
    id: 'USR-003',
    nombre: 'Roberto Torres Díaz',
    email: 'coordinador@jip.pe',
    rol: 'coordinador',
    sede: 'Chiclayo',
    estado: 'ACTIVO',
    ultimo_acceso: '22/09/2026 08:50',
    codigo: ''
  },
  {
    id: 'USR-004',
    nombre: 'Patricia Chávez Llanos',
    email: 'coord3@jip.pe',
    rol: 'coordinador',
    sede: 'Chimbote',
    estado: 'ACTIVO',
    ultimo_acceso: '20/09/2026 17:00',
    codigo: ''
  },
  {
    id: 'USR-005',
    nombre: 'Ana Sofía Paredes Luna',
    email: 'analista2@jip.pe',
    rol: 'analista',
    sede: 'Chimbote',
    estado: 'ACTIVO',
    ultimo_acceso: '21/09/2026 14:20',
    codigo: ''
  },
  {
    id: 'USR-006',
    nombre: 'Juan Carlos Rojas Peña',
    email: 'coord2@jip.pe',
    rol: 'coordinador',
    sede: 'Trujillo',
    estado: 'ACTIVO',
    ultimo_acceso: '22/09/2026 07:45',
    codigo: ''
  },
  {
    id: 'USR-007',
    nombre: 'Lucía Fernández Castro',
    email: 'gerente2@jip.pe',
    rol: 'gerente',
    sede: 'Trujillo',
    estado: 'INACTIVO',
    ultimo_acceso: '10/09/2026 16:00',
    codigo: ''
  }
];