import type { Modalidad, Rubro } from "./domain"

// Labels are transcribed from the workbook; no client amounts or historic prices are imported.
export type ExcelPartida = {
  key: string
  label: string
  rubro: Rubro
  group: string
  hojas: string
  modalidades: readonly Modalidad[]
}
const all = ["COBRE", "PEALPE", "PEQUENOS", "FISE"] as const
const construction = ["COBRE", "PEALPE"] as const
export const EXCEL_PARTIDAS: ExcelPartida[] = [
  {
    key: "mureteCachimbo",
    label: "Costo Mano de Obra + Materiales Muretes Cachimbo:",
    rubro: "MURETES",
    group: "Muretes",
    hojas: "COTIZACION COBRE · A154 / COTIZACION PEALPE · B141",
    modalidades: construction,
  },
  {
    key: "mureteValvula",
    label: "Costo Mano de Obra + Materiales Muretes Valvula:",
    rubro: "MURETES",
    group: "Muretes",
    hojas: "COTIZACION COBRE · A155 / COTIZACION PEALPE · B142",
    modalidades: construction,
  },
  {
    key: "redInterna",
    label: "Costo Mano de Obra de redes internas:",
    rubro: "MANO_OBRA",
    group: "Mano de obra",
    hojas:
      "COTIZACION COBRE · A156 / COTIZACION PEALPE · B143 / PEQUEÑOS CLIENTES · B139 / FISE - CONFORME A OBRA · B145",
    modalidades: all,
  },
  {
    key: "habilitacion",
    label: "Costo de Mano de Obra de Habilitacion:",
    rubro: "HABILITACION",
    group: "Mano de obra",
    hojas:
      "COTIZACION COBRE · A157 / COTIZACION PEALPE · B144 / PEQUEÑOS CLIENTES · B140 / FISE - CONFORME A OBRA · B146",
    modalidades: all,
  },
  {
    key: "fijos",
    label: "Gastos Fijos  - Costo de Proyecto, Cotizacion:",
    rubro: "FIJOS",
    group: "Gastos fijos y variables",
    hojas:
      "COTIZACION COBRE · A158 / COTIZACION PEALPE · B145 / PEQUEÑOS CLIENTES · B141 / FISE - CONFORME A OBRA · B147",
    modalidades: all,
  },
  {
    key: "variables",
    label: "Gastos Variables - Flete, Impresiones, Movilidad, Supervision:",
    rubro: "VARIABLES",
    group: "Gastos fijos y variables",
    hojas:
      "COTIZACION PEALPE · B146 / PEQUEÑOS CLIENTES · B142 / FISE - CONFORME A OBRA · B148",
    modalidades: ["PEALPE", "PEQUENOS", "FISE"],
  },
  {
    key: "variablesCobre",
    label:
      "GASTOS VARIABLES - FLETE, IMPRESIONES, MOVILIDAD, SUPERVISION, VIATICOS",
    rubro: "VARIABLES",
    group: "Gastos fijos y variables",
    hojas: "COTIZACION COBRE · A159",
    modalidades: ["COBRE"],
  },
  {
    key: "flete",
    label: "Flete",
    rubro: "FLETE",
    group: "Detalle de gastos variables",
    hojas: "BD COBRE · F3 / BD PEALPE · I3 / BD PEQUEÑOS · H3",
    modalidades: all,
  },
  {
    key: "movilidad",
    label: "Impresiones  y Movilidad",
    rubro: "MOVILIDAD",
    group: "Detalle de gastos variables",
    hojas: "BD COBRE · G3 / BD PEALPE · J3 / BD PEQUEÑOS · I3",
    modalidades: all,
  },
  {
    key: "supervision",
    label: "Supervision",
    rubro: "SUPERVISION",
    group: "Detalle de gastos variables",
    hojas: "BD COBRE · H3 / BD PEALPE · K3 / BD PEQUEÑOS · J3",
    modalidades: all,
  },
  {
    key: "anclaje",
    label: "ESTRUCTURA METÁLICA DE ANCLAJE",
    rubro: "ANCLAJE",
    group: "Trabajos complementarios",
    hojas: "COTIZACION COBRE · A160",
    modalidades: ["COBRE"],
  },
  {
    key: "altura",
    label:
      "TRABAJOS EN ALTURA COSTA (ANDAMIOS ACROW CERTIFICADOS 4 CUERPOS + BARANDAS) X 1DÍA",
    rubro: "ALTURA",
    group: "Trabajos complementarios",
    hojas: "COTIZACION COBRE · A161",
    modalidades: ["COBRE"],
  },
  {
    key: "silla",
    label: "TRABAJO DE ALTURAS (SILLA COLGANTE)",
    rubro: "ALTURA",
    group: "Trabajos complementarios",
    hojas: "COTIZACION COBRE · B146",
    modalidades: ["COBRE"],
  },
  {
    key: "gabinete",
    label: "INSTALACION DE GABINETE",
    rubro: "ADICIONALES",
    group: "Trabajos complementarios",
    hojas: "COTIZACION COBRE · B147",
    modalidades: all,
  },
  {
    key: "bono",
    label: "Bono Administrativo:",
    rubro: "BONO",
    group: "Bono administrativo",
    hojas: "COTIZACION COBRE · A162 / COTIZACION PEALPE · B147",
    modalidades: construction,
  },
  ...["1/2''", "3/4''", "1''", "1 1/4''", "1 1/2''", "2''"].map(
    (diametro, i) => ({
      key: `cobre${i}`,
      label: `INSTALACIÓN DE COBRE ${diametro} ADOSADO/EMPOTRADO/ENTERRADO`,
      rubro: "MANO_OBRA" as const,
      group: "PRECIO MANO DE OBRA ESPECIFICA POR PROYECTO",
      hojas: `COTIZACION COBRE · A${179 + i}`,
      modalidades: ["COBRE"] as const,
    }),
  ),
  {
    key: "hospedaje",
    label: "HOSPEDAJE",
    rubro: "HOSPEDAJE",
    group: "VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS",
    hojas: "COTIZACION COBRE · A188 / PROYECTOS · B20",
    modalidades: all,
  },
  {
    key: "alimentacion",
    label: "ALIMENTACIÓN",
    rubro: "ALIMENTACION",
    group: "VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS",
    hojas: "COTIZACION COBRE · A189 / PROYECTOS · B21",
    modalidades: all,
  },
  {
    key: "pasajes",
    label: "PASAJES - FLETES",
    rubro: "PASAJES",
    group: "VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS",
    hojas: "COTIZACION COBRE · A190",
    modalidades: all,
  },
  {
    key: "combustible",
    label: "COMBUSTIBLE",
    rubro: "COMBUSTIBLE",
    group: "VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS",
    hojas: "PROYECTOS · B22",
    modalidades: all,
  },
  {
    key: "peajes",
    label: "PEAJES",
    rubro: "PEAJES",
    group: "VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS",
    hojas: "PROYECTOS · B23",
    modalidades: all,
  },
  {
    key: "ig3",
    label: "Firme IG3",
    rubro: "IG3",
    group: "Convenio FISE",
    hojas: "FISE - CONFORME A OBRA · B150 (ESTRUCTURA FISE · B140: Firma IG3)",
    modalidades: ["FISE"],
  },
  {
    key: "documentacion",
    label: "DOCUMENTACIÓN Y ELABORACIÓN DE ENTREGABLES",
    rubro: "DOCUMENTACION",
    group: "Conforme a obra",
    hojas: "PROYECTOS · B79 / B224",
    modalidades: all,
  },
  {
    key: "presupuesto",
    label: "ELABORACIÓN DE PRESUPUESTO",
    rubro: "FIJOS",
    group: "Conforme a obra",
    hojas: "PROYECTOS · B42 / B142",
    modalidades: all,
  },
  {
    key: "materialesMo",
    label: "MANO DE OBRA + MATERIALES (NO INCLUYE GABINETE)",
    rubro: "PAQUETE",
    group: "Conforme a obra",
    hojas: "PROYECTOS · B78 / B223",
    modalidades: all,
  },
]
export const EXCEL_MODALIDADES: Record<Modalidad, string> = {
  COBRE: "COTIZACION COBRE",
  PEALPE: "COTIZACION PEALPE",
  PEQUENOS: "PEQUEÑOS CLIENTES",
  FISE: "FISE - CONFORME A OBRA",
}
export const EXCEL_LABELS = {
  materiales: "Costo de Materiales:",
  ciudad: "Ciudad:",
  tipo: "Tipo:",
  puntos: "Numero de Puntos:",
  mureteCachimbo: "Muretes Interiores Cachimbo:",
  mureteValvula: "Muretes Interiores Valvula:",
  directo: "Costo Directo:",
  financiamiento: "GASTOS DE FINANCIAMIENTO:",
  generales: "GASTOS GENERALES",
  utilidad: "Utilidad:",
  subtotal: "Sub Total:",
  comision: "Comision Venta:",
  venta: "Total:",
  igv: "IGV:",
  total: "Total Venta:",
  presentada: "COTIZACIÓN PRESENTADA",
  aceptada: "COTIZACIÓN APROBADA POR CLIENTE (CON IGV)",
}
export const BONOS_EXCEL = [
  ['INDUSTRIAL/ GNV','Prospectos','>',6],
  ['INDUSTRIAL/ GNV','Clientes con Cotizacion','>',3],
  ['INDUSTRIAL/ GNV','Clientes con alta probabilidad de captacion','>=',1],
  ['MYPES','Prospectos','>',30],
  ['MYPES','Clientes con Cotizacion','>',25],
  ['MYPES','Clientes con alta probabilidad de captacion','>',20],
  ['MYPES','Clientes con contrato Firmado','>',15],
  ['MULTIFAMILIAR / INMOBILIARIO','Prospectos','>',15],
  ['MULTIFAMILIAR / INMOBILIARIO','Clientes con Cotizacion','>',10],
  ['MULTIFAMILIAR / INMOBILIARIO','Clientes con alta probabilidad de captacion','>',8],
  ['MULTIFAMILIAR / INMOBILIARIO','Clientes con contrato Firmado','>',4],
] as const;
