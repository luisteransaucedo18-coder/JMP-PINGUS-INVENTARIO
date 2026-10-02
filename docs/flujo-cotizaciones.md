# Cotizaciones de proyectos

Ramas: `main` → `dev` → `codex/flujo-cotizaciones-proyectos`.

El módulo se abre desde Cotizaciones, el resumen del dashboard o el detalle de un proyecto. Conserva presupuestos por versión y una serie común para requerimientos, gastos y trazabilidad.

## Flujo y responsabilidades

| Paso | Responsable | Resultado |
| --- | --- | --- |
| Borrador | Analista autor | Proyecto, alcance, modalidad, ciudad, tipo, puntos, variables del Excel, materiales, servicios y porcentajes |
| Presentada | Analista autor | Importe comercial presentado, incluido IGV |
| Aceptada / Rechazada | Analista autor | Importe aceptado y evidencia verificable, o motivo de rechazo |
| Ejecución | Autor y coordinación | Solicitudes por etapas, abastecimiento habitual, entregas, devoluciones y costos con comprobantes |
| Habilitación | Autor o coordinación | Fecha de habilitación para control del bono y resumen mensual |
| Cierre | Coordinador | Conciliación explícita de costos, consumo y devoluciones; resultado final |

Gerencia consulta. Los analistas solo modifican sus cotizaciones; coordinación administra tarifas y concilia/cierra. Los permisos se comprueban en la base de datos, incluyendo usuarios inactivos. No se autorizan escrituras directas sobre las tablas del módulo.

Una presentación congela el presupuesto. Los cambios requieren una nueva versión. Una nueva aceptación sustituye la aceptación anterior, conserva gastos y solicitudes y no admite eliminar/reducir materiales ya solicitados ni cambiar la moneda de la serie aceptada. La serie cerrada no puede reabrirse con otra versión. Cada operación guarda actor, fecha, estado y detalle. La revisión optimista evita sobrescribir cambios de otra sesión.

## Recorrido guiado y reglas del proyecto

El formulario tiene cuatro pasos: Datos del proyecto, Materiales y costos, Condiciones y márgenes, Revisar cotización. Cada paso conserva los nombres del Excel y valida sus datos antes de avanzar.

El presupuesto guarda nombre, cliente, ubicación y responsable sin crear el proyecto. El analista presenta directamente al cliente. Su aceptación crea el proyecto y vincula las versiones de la serie en una sola transacción; los materiales quedan disponibles para requerimientos por etapas, sin crear solicitudes automáticamente ni duplicar el catálogo.

Para editar una cotización aceptada se crea una nueva versión: la anterior sigue vigente hasta la nueva aceptación del cliente. La eliminación solo corresponde al analista autor tras registrar el rechazo, y queda prohibida si la serie fue aceptada alguna vez. Se oculta el registro de la lista conservando el historial en `eliminada_en`.

Se retiró la creación directa desde Proyectos y Requerimientos. “Cotizar un nuevo proyecto” abre el asistente. Nuevo requerimiento permite seleccionar únicamente una cotización aceptada del autor y sus materiales con saldo. La base usa verificaciones diferidas para impedir la creación de proyectos y requerimientos por rutas que omitan este flujo.

Migración adicional: `20261002215459_cotizacion_guiada_proyecto_al_aceptar.sql`. Conserva los proyectos y requerimientos históricos. Los estados antiguos de revisión permanecen legibles, pero la presentación actual no exige coordinación.

## Excel: nombres y ubicación de las variables

Referencia: `CONTROL DE COSTOS PROYECTOS COMERCIALES MYPES.xlsx`. No se modificó el archivo ni se importaron cotizaciones históricas de clientes. Los precios y tarifas deben configurarse y revisarse antes de su uso.

| Nombre en el Excel | Ubicación en el sistema |
| --- | --- |
| ID, MATERIAL, UND, PRECIO | Materiales del catálogo; cantidad y conversión explícita a la unidad de inventario |
| Ciudad:, Tipo:, Numero de Puntos: | Proyecto y alcance |
| DEPARTAMENTO, CONSECION | Proyecto y alcance; se conserva la escritura de BD PEQUEÑOS |
| Muretes Interiores Cachimbo:, Muretes Interiores Valvula: | Variables del Excel, selección SI / NO |
| Costo Mano de Obra + Materiales Muretes Cachimbo: / Valvula: | Variables del Excel → Muretes; cantidad de muretes × tarifa |
| Costo Mano de Obra de redes internas: | Variables del Excel → Mano de obra |
| Costo de Mano de Obra de Habilitacion: | Variables del Excel → Mano de obra |
| PRECIO MANO DE OBRA ESPECIFICA POR PROYECTO | Seis partidas de INSTALACIÓN DE COBRE: 1/2'', 3/4'', 1'', 1 1/4'', 1 1/2'' y 2'' ADOSADO/EMPOTRADO/ENTERRADO; cantidad instalada × tarifa |
| Gastos Fijos  - Costo de Proyecto, Cotizacion: | Variables del Excel → Gastos fijos y variables |
| Gastos Variables - Flete, Impresiones, Movilidad, Supervision: | Partida global o detalle individual, con validación contra doble conteo |
| GASTOS VARIABLES - FLETE, IMPRESIONES, MOVILIDAD, SUPERVISION, VIATICOS | Partida global de COBRE o su detalle |
| Flete, Impresiones  y Movilidad, Supervision | Variables del Excel → Detalle de gastos variables |
| ESTRUCTURA METÁLICA DE ANCLAJE | Variables del Excel → Trabajos complementarios |
| TRABAJOS EN ALTURA COSTA (ANDAMIOS ACROW CERTIFICADOS 4 CUERPOS + BARANDAS) X 1DÍA | Trabajos complementarios; días × tarifa |
| TRABAJO DE ALTURAS (SILLA COLGANTE), INSTALACION DE GABINETE | Trabajos complementarios; se registran como servicios |
| VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS | Días proyectados y detalle de viáticos; el número de días se propone al agregar hospedaje, alimentación y andamios y queda editable |
| HOSPEDAJE, ALIMENTACIÓN, PASAJES - FLETES, COMBUSTIBLE, PEAJES | Partidas separadas de viáticos |
| Bono Administrativo: / BONO ADMINISTRATIVO (*): | Partida de bono y condición posterior a habilitación; la desviación reduce el saldo que puede registrarse como costo real |
| GASTOS DE FINANCIAMIENTO: (2.5%/MES), GASTOS GENERALES, Utilidad, Comision Venta, IGV | Porcentajes y financiamiento, con tasa aplicada y meses explícitos |
| Costo Directo:, Sub Total:, Total:, Total Venta: | Resumen de cálculo |
| COTIZACIÓN PRESENTADA | Registro de presentación, separado del cálculo |
| COTIZACIÓN APROBADA / COTIZACIÓN APROBADA POR CLIENTE (CON IGV) | Registro de aceptación del cliente; no requiere aprobación interna |
| Configuración FISE, Configuración interna | Convenio FISE |
| Presión de artefactos (23 - 340) | Presiones ordenadas por punto; admite combinaciones de 23 y 340 mbar |
| Instalación interna, Acometida | Convenio FISE; A LA VISTA / EMPOTRADA, G4/G6 y murete existente/construido |
| INGRESO CONVENIO FISE (SIN IGV) | Ingreso de convenio; el impuesto se aplica una sola vez |
| Firme IG3 / Firma IG3 | Partida FISE; se conserva Firme IG3 de la hoja visible y la referencia Firma IG3 de ESTRUCTURA FISE |
| PLAZO, Dia, Horario, Tiempo | PROPUETA PROVEEDOR → Programación del trabajo |
| Administracion de caja Chica | Nombre del comercio en el apartado de bono y caja chica |
| ELABORACIÓN DE PRESUPUESTO, DOCUMENTACIÓN Y ELABORACIÓN DE ENTREGABLES | Variables del Excel → Conforme a obra |
| MANO DE OBRA + MATERIALES (NO INCLUYE GABINETE) | Partida global; reemplaza el detalle de esos costos |
| FACTURA ..., PLANILLA DE ENVIO | Comprobante/referencia verificable y descripción del costo real; nombres de proveedor y documento libres |
| COSTO MATERIALES Y ACCESORIOS, COSTO FLETES Y ENVÍOS, COSTOS VIATICOS Y TRANSPORTE | Rubros de costos reales; las facturas no se vuelven a sumar automáticamente desde compras |
| MATERIAL EXISTENTE / MATERIAL UTILIZADO EXISTENTE | Cantidad consumida registrada expresamente con valoración en costos reales |
| MATERIAL NO UTILIZADO (EN ALMACEN) | Devoluciones validadas de solicitudes de la serie, en la unidad de inventario |
| A CUENTA DEL MATERIAL SOBRANTE | Abono documentado que disminuye el costo neto; la devolución física no genera este abono automáticamente |
| TOTAL COSTOS (SIN IGV), TOTAL COTIZADO (SIN IGV), UTILIDAD | Ejecución y costos reales; provisional hasta cierre |
| Relación Beneficio / Costo (%) | Utilidad / costo real neto; no disponible si el costo neto no es positivo |
| Variables, Fise, No Fise, Total | Resumen mensual por fecha de habilitación y moneda |
| Gastos Generales JMP: | Importe global mensual en soles configurado por coordinación; no se duplica en cada proyecto |
| Gastos Generales:, # Habilitadas:, Ingreso S/., Utilidad: | Resumen mensual; versiones vigentes habilitadas, gastos fijos reales e ingreso neto acordado |
| BONOS POR PROYECTO, SEGUNDO MES ADELANTE | Controles del período por INDUSTRIAL/ GNV, MYPES y MULTIFAMILIAR / INMOBILIARIO |
| Prospectos, Clientes con Cotizacion, Clientes con alta probabilidad de captacion, Clientes con contrato Firmado | Metas mensuales con Control (> / >=) y Cant, configuradas por coordinación; se proponen los valores del Excel y no generan pagos automáticos |

`src/features/cotizaciones/excelVariables.ts` guarda los nombres y referencias de hoja/celda de las partidas. El formulario muestra cada referencia para localizar el concepto. La modalidad filtra las partidas específicas; los gastos adicionales se pueden describir sin inventar un SKU de inventario.

## Cálculos y límites

Todos los costos unitarios y reales se ingresan sin IGV y en la moneda de la cotización. El tipo de cambio es una referencia guardada, no una conversión automática de precios del catálogo. PEN y USD se reportan separados.

Cada partida se redondea a dos decimales; el servidor vuelve a calcular. Costo directo = materiales + servicios. Financiamiento = directo × tasa mensual × meses. Generales y utilidad = directo × su tasa. Subtotal = directo + financiamiento + generales + utilidad. Comisión = subtotal × tasa. Total Venta = (subtotal + comisión) + IGV.

En FISE, Valor de venta = INGRESO CONVENIO FISE (SIN IGV); comisión = ingreso × tasa; utilidad = ingreso − directo − financiamiento − generales − comisión. El porcentaje de utilidad no se usa para fijar el ingreso FISE. Los campos describen la configuración y se guardan con la versión; los importes del convenio se ingresan/configuran expresamente.

El archivo contiene diferencias entre rótulos y fórmulas: PEALPE indica Utilidad (25%) pero calcula 20%; hay columnas COBRE que omiten el bono, referencias cruzadas a otros proyectos y columnas FISE que vuelven a dividir un ingreso etiquetado sin IGV entre 1.18. El sistema usa porcentajes explícitos y bases coherentes; no reproduce esos errores ni interpreta un precio histórico como tarifa vigente.

Las solicitudes usan cantidad cotizada × factor de stock. Un factor 1 es obligatorio cuando ambas unidades son iguales. La asignación es transaccional, bloquea la serie y limita el saldo entre versiones. Los reintentos con el mismo identificador de solicitud/gasto/versión no duplican registros. Un requerimiento rechazado libera su asignación. El abastecimiento y movimiento de stock se realizan con las funciones existentes.

Costos reales = cargos activos − abonos activos. Las compras, entregas y devoluciones se muestran vinculadas, pero no se valorizan automáticamente ni se suman como un segundo costo. El consumo debe registrarse y conciliarse. El cierre requiere costos registrados, solicitudes/entregas completas o rechazadas, devoluciones validadas, fecha de habilitación y confirmación del coordinador.

## Instalación y validación

Migración aditiva: `supabase/migrations/20261002201400_flujo_cotizaciones_proyectos.sql`. Crea cotizaciones, eventos, asignaciones, gastos, plantillas, variables mensuales, políticas RLS y una RPC con verificaciones de actor. Las funciones de escritura están en un esquema privado y el punto público usa SECURITY INVOKER. No modifica rutinas anteriores.

El flujo utiliza `proyecto_cotizaciones`, `proyecto_cotizacion_codigo_seq` y la RPC `operar_cotizacion_proyecto`, con códigos `COT-P-`. Conserva las tablas, secuencia y RPC del módulo anterior (`cotizaciones`, `cotizacion_versiones`, `operar_cotizacion`). Los registros anteriores se consultan en “Cotizaciones existentes — formato anterior” respetando sus permisos originales; no se transforman automáticamente ni cambian sus presupuestos históricos.

Validación: `npm run test:cotizaciones`, `npm run typecheck`, `npm run build` y las pruebas existentes. Las pruebas de migración usan PostgreSQL aislado con PGlite y funciones de requerimiento de referencia; las funciones existentes conservan sus pruebas operativas. Se comprueban cálculo, permisos, estados, versiones, saldos, idempotencia, costos/abonos, devoluciones pendientes, cierres, plantillas y PDF comercial paginado sin costos internos.

Los documentos externos se conservan como referencias verificables de aceptación o comprobante; no se suben automáticamente al sistema. El PDF se descarga localmente y no envía propuestas a clientes.
