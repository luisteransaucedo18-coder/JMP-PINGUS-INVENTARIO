import type { QuoteBudget } from './domain';

export default function BudgetContext({ budget:b }: { budget:QuoteBudget }) {
  const values: [string,string|number][] = [
    ['DEPARTAMENTO',b.excel.departamento],['CONSECION',b.excel.concesion],['Muretes Interiores Cachimbo:',b.excel.muretesCachimbo],['Muretes Interiores Valvula:',b.excel.muretesValvula],['DIAS PROYECTADOS',b.excel.diasProyectados],['PLAZO',b.excel.plazo],['Dia',b.excel.dia],['Horario',b.excel.horario],['Tiempo',b.excel.tiempo],['Administracion de caja Chica',b.excel.cajaChica],
    ['GASTOS DE FINANCIAMIENTO: (%/MES)',b.tasas.financiamientoMensual],['MESES DE FINANCIAMIENTO',b.tasas.meses],['GASTOS GENERALES (%)',b.tasas.generales],['Utilidad (%):',b.tasas.utilidad],['Comision Venta (%):',b.tasas.comision],['IGV (%):',b.tasas.igv],
  ];
  if(b.modalidad==='FISE')values.push(['Configuración FISE',b.fise.configuracion],['Configuración interna',b.fise.configuracionInterna],['Presión de artefactos (23 - 340)',`${b.fise.presionArtefactos} mbar`],['Instalación interna',b.fise.instalacion],['Acometida',b.fise.acometida],['INGRESO CONVENIO FISE (SIN IGV)',b.fise.ingresoSinIgv],['Utilidad FISE','Derivada del ingreso del convenio menos costos y cargos']);
  return <details className="quote-line"><summary>Variables y porcentajes guardados del Excel</summary><dl className="quote-totals">{values.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value===''?'Sin registrar':value}</dd></div>)}</dl>{b.excel.bonoCondicionado&&<p className="quote-muted">Bono Administrativo: asignado posterior a la habilitacion, sujeto a mantener los costos presupuestados; la desviacion se toma del Bono.</p>}</details>;
}
