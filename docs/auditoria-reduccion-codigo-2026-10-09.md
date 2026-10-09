# Auditoría de reducción de código — 9 de octubre de 2026

## Resultado

Hay oportunidades verificables para reducir duplicación y retirar código desconectado. El mayor archivo funcional, inventario, también tiene un formato muy expandido: una reducción de líneas por formateo debe medirse por separado de la eliminación de lógica. No hay evidencia para prometer un porcentaje global de ahorro.

Esta auditoría no modifica funcionalidades, dependencias, permisos ni SQL. El resultado es un inventario medido y una lista de cambios candidatos. No equivale a certificar que toda rama del sistema se utiliza o que toda regla CSS es necesaria.

## Base y alcance

Referencia Git al revisar: `b6a3cd1`. Se inspeccionaron composición y rutas, dependencias/importaciones TypeScript, exportaciones, bloques repetidos, estilos, servicios, utilidades, historial SQL y pruebas. El inventario incluye todos los archivos de `src`, `supabase`, `tests` y `scripts`; la revisión semántica se concentró en los candidatos detectados y sus consumidores. También se revisaron `package.json`, `vite.config.ts`, `AGENTS.md` y la arquitectura documentada.

Se excluyen del objetivo de eliminación `node_modules`, `dist`, lockfiles, imágenes, documentos generados y archivos de configuración secretos. Las herramientas de desarrollo de Figma son parte de la integración del entorno y no se consideran sobrantes por no aparecer en el frontend.

| Grupo | Archivos de código | Líneas físicas | Líneas no vacías |
| --- | ---: | ---: | ---: |
| Frontend TS/TSX/CSS, incluidos tipos | 96 | 23.136 | 20.465 |
| SQL y scripts MJS en Supabase | 26 | 5.056 | 4.853 |
| Pruebas MJS, incluidas E2E | 22 | 3.150 | 3.074 |
| Scripts de auditoría MJS | 1 | 70 | 69 |
| Total de código de estos grupos | 145 | 31.412 | 28.461 |

Los dos JSON geográficos suman otras **11.735 líneas no vacías**. Se contabilizan como datos, no como lógica duplicada. La migración de ubicación contiene una carga de ubigeos: sus 1.928 líneas no vacías tampoco representan exclusivamente lógica SQL.

Método reproducible: enumerar recursivamente los cuatro directorios, leer UTF-8, dividir con `/\r?\n/` y contar segmentos; para líneas no vacías filtrar por `line.trim()`. El conteo físico incluye el segmento final vacío cuando el archivo termina en salto de línea. Los resultados por archivo y hashes SHA-256 están en `auditoria-reduccion-metricas-2026-10-09.json`.

Este conteo sustituye la aproximación inicial de 20.102 líneas en 93 archivos; usa una definición uniforme y registra exactamente los archivos medidos. Los resultados de auditoría se contabilizan aparte del código del producto.

## Hallazgos priorizados

Los rangos son estimaciones manuales de líneas no vacías netas, incluyendo imports y código compartido nuevos. No son ahorros ya obtenidos. No sumar rangos sin comprobar solapamientos. «Por medir» significa que la evidencia permite investigar, pero aún no estimar una reducción defendible.

| ID | Prioridad | Evidencia | Acción candidata | Ahorro estimado | Riesgo |
| --- | --- | --- | --- | --- | --- |
| R01 | Alta | `LegacyQuotations.tsx` no tiene importadores estáticos ni dinámicos detectados en `src` | Retirar el componente y la consulta/tipo que solo él consume; evaluar su utilidad de presentación por separado | 45–65 | Bajo para rutas actuales; requiere confirmar que no es una función pendiente |
| R02 | Alta | `coincideEstadoSedes` y `validLocation` aparecen solo en sus definiciones | Eliminar estas dos funciones si la búsqueda completa sigue sin encontrar consumidores | 5–8 | Bajo |
| R03 | Alta | `formatPrecio` repite exactamente ocho líneas en inventario y vista previa | Compartir el formato de precio de catálogo, incluyendo «Sin precio» | 4–7 | Bajo |
| R04 | Alta | `SEDE_COLOR` se redeclara en inventario, vista previa y dashboard coordinador; ya existe en `visualTokens.ts` | Reutilizar el token existente en esos tres consumidores | 3–5 | Bajo |
| R05 | Media | Cotizaciones, reporte y `newBudget` repiten fecha explícita de Lima; existe `limaDate` | Reutilizar la utilidad donde la semántica ya es idéntica | 3–10 | Bajo, con ajuste del cargador de pruebas |
| R06 | Media | `.input-field:focus` y `.select-field:focus` tienen declaraciones idénticas; los KPI de dashboard y reporte repiten otro bloque | Agrupar los dos pares de selectores conservando posición y media query | 4–8 | Medio por cascada CSS |
| R07 | Media | `uniqueMaterials.ts` no tiene importadores de producto; solo `consistencia.test.mjs` lo carga | Decidir si se integra en una validación real o se retira junto con el caso que solo prueba esta utilidad | Por medir | Medio: preservar controles reales contra duplicados |
| R08 | Media | `ValidatedForm.inspect` y `collectFieldIssues` repiten mensajes y límites, pero filtran controles de forma distinta | Compartir únicamente la evaluación de un control, manteniendo reglas de pasos y foco | Por medir | Medio |
| R09 | Media | `InventarioView.tsx`: 2.593 líneas físicas, 1.946 no vacías; JSX y estilos muy expandidos, campos y etiquetas semejantes | Separar el ahorro de formato del ahorro estructural; consolidar campos o estilos solo con reducción neta | Por medir | Medio |
| R10 | Media | Lista de sedes en tipos, transporte, cálculo de faltantes y stock inicial | Reutilizar `SEDES` donde desaparezcan ramas o listas repetidas | Por medir | Medio por dependencias de pruebas y stock |
| R11 | Baja | `AppShell` y `NotificationsPanel` llaman a `useNotifications` con el mismo contexto | Calcular la colección una vez y pasarla al panel si simplifica su contrato | Por medir | Bajo/medio; probablemente ahorro pequeño de líneas |
| R12 | Baja | Perfil y transporte comprueban firmas JPG/PNG/WebP por separado | Evaluar un detector mínimo común; conservar tipos, extensiones, tamaños y mensajes propios | Por medir | Medio; no unificar políticas distintas |

### Evidencia y límites de los candidatos principales

**R01 — cadena legacy desconectada.** `src/features/cotizaciones/LegacyQuotations.tsx:6` exporta el componente; no hay importadores detectados. `src/services/cotizacionService.ts:11` define `obtenerCotizacionesAnteriores`, cuyo único consumidor de producto es ese componente. `LegacyQuote` también pertenece a esa cadena. `legacyQuoteFields` sí tiene una prueba directa en `tests/data-consistency.test.mjs`; su retiro necesita revisar ese contrato. No borrar tablas ni registros históricos: la propuesta se limita al código frontend desconectado.

**R02 — funciones sin consumidores detectados.** `src/utils/inventoryStatus.ts:22` y `src/features/cotizaciones/locations.ts:40`. Las funciones vecinas sí se usan y se mantienen. Un export sin consumidores externos no es automáticamente código muerto: `roundMoney`, `normalizeLocation`, `buildQuotationPdf` y `tourStorageKey` tienen consumidores internos o pruebas.

**R03 — precio de catálogo.** `src/components/MaterialPreviewModal.tsx:20` y `src/features/inventario/pages/InventarioView.tsx:70`. Ambos usan PEN y muestran «Sin precio» para valores no positivos. `money` en cotizaciones permite PEN/USD y formatea cero como dinero; sustituirlos directamente por esa función cambiaría el comportamiento.

**R04 — colores existentes.** `src/config/visualTokens.ts:3` ya es la fuente usada por varios módulos. Los duplicados están en `MaterialPreviewModal.tsx:18`, `InventarioView.tsx:64` y `CoordinadorDashboard.tsx:7`. No se necesita crear otro sistema de tokens.

**R05 — fechas.** `src/utils/limaDate.ts:1` ya define la conversión. Hay repeticiones en `CotizacionesView`, `QuotationReport` y `domain.newBudget`. `fechaLocal` de transporte usa la zona del navegador: reemplazarla por Lima sería además un cambio de comportamiento y se evalúa aparte. Las pruebas importan TypeScript transpilado como URL de datos; añadir imports relativos exige actualizar ese cargador.

**R06 — CSS.** Los pares se encontraron en `src/index.css` alrededor de 629/648 y 2087/2092. Otro bloque idéntico aparece en `.returns-evidence-heading`, `.stock-state-row-top` y `.onboarding-topline`, pero su igualdad textual no demuestra que convenga acoplar tres componentes. No se recomienda eliminar selectores simplemente por no aparecer como cadenas literales: existen clases construidas dinámicamente y estados responsivos.

**R08 — validación compartida con diferencias.** `ValidatedForm` omite controles deshabilitados y comprueba correo, checkbox, rango y archivo; `collectFieldIssues` restringe la revisión al paso, omite checkbox/readOnly y añade enteros y etiquetas. Compartir la regla elemental puede reducir repetición; sustituir una implementación por otra perdería comportamientos.

**R09 — inventario.** La sección de edición desde aproximadamente la línea 1968 repite estilos de etiquetas, indicadores de sede y controles. La creación desde aproximadamente la línea 2164 también repite envoltorios de campos. Ya existen `MaterialModalHeader`, `ModalActions`, `FieldError` y `MaterialPreviewModal`: usar y extender lo existente antes de añadir componentes. Mover JSX a un archivo nuevo no es ahorro por sí mismo.

**R10 — sedes.** `transporteService.ts:8` contiene `SEDES_TRANSPORTE`; `requirementStock.ts:44/62` declara listas locales. `materialService` crea mapas de stock cero y valida nombres de sede. Preservar el contrato de las tres sedes y las pruebas que sustituyen imports durante la transpilación.

**R12 — archivos.** `transporteValidation.validarArchivo` acepta PDF e imágenes hasta 10 MB; `validateProfilePhoto` acepta solo imágenes hasta 5 MB y exige extensión concordante. Compartir lectura de firmas no permite eliminar esas diferencias ni la validación del servidor.

## Backend, dependencias y pruebas

El SQL redefine funciones a través de migraciones que registran correcciones de compras, requerimientos, entregas y cotizaciones. Esa repetición histórica es necesaria para reconstruir la evolución; no se cuenta como ahorro inmediato. Antes de simplificar una función vigente se necesita establecer la última definición aplicable y verificar permisos, locks, reintentos y rollback. No se conectó a una base remota ni se certificó el esquema desplegado.

Los cálculos y validaciones presentes tanto en cliente como en servidor protegen contratos diferentes: experiencia de uso y autoridad transaccional. La reducción debe buscar repetición dentro de cada capa, conservando la comprobación del servidor. Las migraciones de pruebas verifican stock, roles, RLS e idempotencia.

No se encontró una dependencia runtime evidentemente sobrante: React, Supabase, Leaflet, pdf-lib y pdfjs tienen consumidores. Se revisó su presencia en código, sin actualizar versiones ni evaluar exhaustivamente todas las dependencias transitivas. Retirar una librería solo desplazaría código si se reemplaza con implementación propia.

Las pruebas repiten cargadores TypeScript y montajes PGlite. La consolidación merece una revisión posterior si reduce el total; el aislamiento de fixtures de negocio tiene valor y no debe confundirse con código sobrante. Algunas pruebas inspeccionan texto fuente, por lo que un refactor puede requerir actualizar assertions aunque el comportamiento se conserve.

## Validación de la base

- `npm run typecheck`: aprobado, con `noUnusedLocals` y `noUnusedParameters`.
- `npm test`: 80 casos; 79 aprobados, 0 fallidos y 1 omitido. El omitido es el caso de dos conexiones concurrentes para despacho/recepción.
- `npm run build`: aprobado. Vite advierte chunks superiores a 800 kB; no bloquea la compilación. Reducir líneas no garantiza reducir bundle ni tiempos de carga.
- No se ejecutaron las E2E `*.e2e.mjs` ni una revisión visual autenticada. `npm test` selecciona solo `*.test.mjs`.

## Orden de implementación propuesto

1. R02, R03 y R04: recortes pequeños con evidencia directa. Medir antes/después y ejecutar tipos, build y pruebas afectadas.
2. Resolver el destino de R01 y R07: retirar código desconectado si no corresponde a una función que deba recuperarse. Conservar datos y validaciones activas.
3. R05 y R06: reutilización de fechas y agrupación mínima de CSS. Validar medianoche de Lima, escritorio/móvil, foco de campos y KPI.
4. R08 y R09: un cambio piloto de validación o campos de inventario. Extenderlo únicamente si demuestra reducción neta sin empeorar claridad o accesibilidad.
5. Revisar R10–R12 y SQL vigente según el ahorro observado. Evitar una abstracción genérica de todos los servicios o formularios.

Cada lote debe registrar líneas no vacías y físicas antes/después, archivos retirados, pruebas ejecutadas y comprobaciones de comportamiento. Contar también los helpers y pruebas que se añadan. Documentación y datos estáticos se reportan aparte. No fijar una meta porcentual ni aprobar una eliminación basándose solo en un contador.

## Criterio aplicado

La habilidad `reducing-entropy` y su referencia `data-over-abstractions` orientaron la auditoría: expresar variaciones con datos compartidos cuando sustituya implementación repetida y medir el código total que queda. La revisión SQL siguió la habilidad Supabase. No se realizaron cambios de implementación durante esta fase.

## Implementación — lote 1 completado

Se aplicaron R02, R03 y R04: retiro de `coincideEstadoSedes` y `validLocation`, formato de precio compartido en `src/utils/materialPrice.ts` y reutilización de `SEDE_COLOR` en inventario, vista previa y dashboard coordinador. Se retiró el import `Sede` que quedó sin uso en la vista previa y se adaptó el cargador de las pruebas de inventario para consumir las utilidades reales compartidas.

Reducción medida: **16 líneas no vacías de producto**, menos una línea añadida al cargador de pruebas; **15 líneas netas de código**. El total de los cuatro grupos pasa de 28.461 a 28.446. El inventario JSON original se conserva como base anterior al cambio. No se retiró código legacy ni se modificaron migraciones.

Validación final del lote: build con comprobación de tipos aprobado; 79 pruebas aprobadas, 0 fallidas y 1 omitida; `git diff --check` sin errores de espacios. Una comprobación adicional comparó el formato de precio anterior y compartido con siete valores, incluidos cero, negativos y decimales. No se ejecutaron E2E ni revisión visual; se mantiene la advertencia preexistente de chunks grandes.

## Implementación — lotes 2 a 5 revisados y cerrados

Se aplicaron las simplificaciones que conservan el comportamiento demostrado y se descartaron las que no ofrecían reducción neta clara o mezclaban políticas distintas. «Cerrado» no significa que toda propuesta se haya convertido en un refactor: R08 y R12 se conservan por las razones siguientes.

| Lote | Resultado |
| --- | --- |
| 2: código desconectado | Retirados `LegacyQuotations`, su consulta/tipo y `legacyQuoteDisplay`; retirado `uniqueMaterials`. No tenían consumidores alcanzables desde la aplicación. Se retiraron los dos casos que ejercitaban exclusivamente esas utilidades; permanecen las pruebas de duplicados del flujo real y del servidor. Datos y tablas históricos intactos. |
| 3: fechas y CSS | Cotizaciones, presupuesto nuevo y reporte usan `limaDate`. Conservada la fecha del navegador de transporte. Agrupados únicamente los pares de selectores de foco y KPI identificados; valores y media queries conservados. Adaptados los cargadores de pruebas para resolver el import de fecha real. |
| 4: inventario y validación | Seis objetos de estilos constantes sustituyen 17 declaraciones repetidas de inventario. No se añadieron nodos DOM, componentes ni nuevos flujos. Conservados los dos evaluadores de formulario: el orden de errores, filtros por paso, readOnly, checkbox y foco difieren; una capa configurable no mostró un ahorro neto claro. |
| 5: sedes, notificaciones, archivos y SQL | Los faltantes y transporte reutilizan `SEDES`. El panel recibe la misma colección que el encabezado y deja de calcularla por segunda vez. Su contrato requiere las lecturas y callbacks que su único consumidor real ya proporcionaba. Conservadas las validaciones separadas de archivo y todas las migraciones: tamaños, formatos y reglas de seguridad diferentes; no hay un recorte seguro demostrable. |

### Medición final acumulada, incluidos los cinco lotes

| Grupo | Antes: no vacías | Después: no vacías | Reducción |
| --- | ---: | ---: | ---: |
| Producto TS/TSX/CSS | 20.465 | 20.268 | 197 |
| Pruebas MJS, incluidas E2E | 3.074 | 3.066 | 8 |
| SQL y scripts de Supabase | 4.853 | 4.853 | 0 |
| Scripts de auditoría | 69 | 69 | 0 |
| Total | 28.461 | 28.256 | **205** |

Líneas físicas: 31.412 → 31.176, reducción de 236 con el mismo método de conteo. Archivos de código: 145 → 143; tres retirados y uno compartido añadido. El primer lote ya está incluido en estos números. La documentación generada no se incluye como código del producto. No se aplicó un formateador masivo ni se minificó el código para aparentar ahorro.

### Evidencia de conservación de comportamiento

- Build y comprobación estricta de tipos aprobados después de los cambios de producto.
- Suite final: 78 casos; 77 aprobados, 0 fallidos y el mismo caso de dos conexiones omitido. Dos casos menos por las utilidades desconectadas retiradas.
- Cuatro pruebas de faltantes aprobadas con el catálogo de sedes compartido; diez pruebas de inventario aprobadas tras limpiar el mock sobrante.
- Comparación HTML de inventario anterior/posterior: igualdad exacta en ocho combinaciones de los roles `coordinador` y `analista`, con tabla, detalle, edición y alta. Los subcomponentes ajenos a la consolidación de estilos se sustituyeron por los mismos stubs en ambas versiones.
- Comparación en Edge de CSS anterior (`HEAD`) y posterior: igualdad de background, borde, sombra, columnas, gap y radio en 12 casos; campos enfocados y KPI a 1440, 640 y 390 px. Transiciones desactivadas para comparar valores finales, no fotogramas intermedios.
- `cotizacion-ubicacion.e2e.mjs`: aprobado a 1440 y 390 px; selectores provincia/distrito, dirección y datos heredados antes/después de crear una solicitud, con backend simulado.
- Comprobaciones de notificaciones extraídas de la prueba visual existente: aprobadas para los tres roles a 1440 y 390 px; apertura, lectura, teclado, devolución de foco, cierre, límites de viewport y ausencia de escrituras. No equivalen a ejecutar toda la suite visual.
- Hashes de los archivos Supabase idénticos al inventario inicial. No se hicieron cambios ni consultas en una base remota.

### Límites de la verificación

La suite visual general no pasó completa: su expectativa de tarjetas de 12 px quedó desactualizada frente al token de 24 px que ya existía en `HEAD`; en otra ejecución también apareció una discrepancia en móvil. Se conserva esa expectativa para que su revisión de diseño sea una tarea explícita. La paridad de estilos afectados se comprobó por separado contra `HEAD`.

`consistencia-frontend.e2e.mjs` no pasó completa: intenta usar el selector manual «Selecciona o busca un material...» de una pantalla de solicitud que ya redirige a `RequerimientoCotizado` en la base anterior. No se cambió ese flujo para satisfacer el test antiguo. Se actualizó únicamente su selector de acceso por el nombre accesible actual.

La prueba visual también recibió el selector de acceso actual y una preferencia de tutorial completado para su usuario simulado, evitando que la primera visita intercepte clics. Estas adaptaciones están en las pruebas, no en la aplicación. Continúan pendientes actualizar integralmente esas dos E2E antiguas y ejecutar el caso de concurrencia omitido. El build conserva la advertencia de chunks grandes. Las comprobaciones aprobadas aportan evidencia de conservación; no constituyen una garantía absoluta de ausencia de regresiones.
