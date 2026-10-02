# Auditoría de consistencia — 2 de octubre de 2026

## Resultado y alcance

Se revisaron el estado compartido, las solicitudes y compras, la navegación por proyecto, los cálculos y estilos de Dashboard/Reportes, y las claves de unicidad de la base. Las consultas remotas fueron de lectura: no se eliminaron ni fusionaron registros. El análisis distingue repeticiones accidentales de movimientos, versiones y estados que representan hechos diferentes.

## Correcciones realizadas

| Hallazgo | Corrección | Lógica preservada |
| --- | --- | --- |
| Solicitudes y compras mantenían copias locales del catálogo y repetían su consulta. | Ambos formularios consumen `state.materials`. | Catálogo y existencias compartidos, sin alterar precios ni cantidades. |
| Cambios en tiempo real podían iniciar sincronizaciones simultáneas. | Se serializan y agrupan las peticiones mediante `createCoalescedTask`; una actualización durante la ejecución programa una pasada posterior. | Se sigue reemplazando cada colección, sin concatenar registros. |
| La carga inicial podía abrir el sistema con fuentes fallidas. | Se exige una sincronización inicial completa; se ofrece reintentar. | Cada fuente conserva su tratamiento independiente. |
| Un material podía seleccionarse en varias líneas del mismo formulario. | Se impide repetir SKU al seleccionar y se comprueba antes de guardar. | El mismo material puede aparecer en documentos distintos; la cantidad se modifica en su línea existente. |
| Pulsaciones repetidas podían iniciar la misma operación antes del siguiente render. | Bloqueo inmediato con referencias para solicitudes, compras y creación de proyecto. | Un fallo permite reintentar; una escritura exitosa permanece bloqueada hasta abandonar el formulario. |
| Buscar un proyecto por nombre podía resolver una coincidencia ambigua. | Se requiere el proyecto seleccionado y su identificador. | Proyectos con nombres iguales siguen siendo registros independientes. |
| Colores de sedes y estados se copiaban entre vistas. | Se centralizan en `src/config/visualTokens.ts`. | Etiquetas específicas de cada rol permanecen en su vista. |
| Reportes almacenaba fechas y un período redundante. | El período se deriva de un único rango de fechas. | Rangos abiertos y accesos rápidos mantienen sus cálculos. |
| Reglas de tooltip y menú móvil repetían el mismo selector. | Se consolidan conservando los valores efectivos, transiciones y reglas de accesibilidad. | Se respetan la cascada y los diseños adaptables. |
| Dos archivos vacíos podían confundirse con implementaciones vigentes. | Se retiran `src/service/materialService.ts` y `src/views/analista/NuevaSolicitudView.tsx`, sin referencias. | Permanecen las implementaciones de `services` y `features`. |

## Comparación de clases y variables

El análisis final de 64 archivos detecta **0 bloques CSS idénticos, 0 declaraciones idénticas repetidas dentro de una regla, 0 candidatos de literales grandes repetidos y 0 archivos vacíos**. Son comprobaciones estructurales, no una prueba de equivalencia semántica de todas las variables.

Se conservan 10 grupos de selectores repetidos para ajustes de cascada o diseño adaptable. Hay 40 clases candidatas sin referencia literal en JSX: no se eliminan automáticamente, porque existen clases construidas dinámicamente, como los estados de transporte. Una coincidencia de nombre o color por sí sola no justifica fusionar clases ni estados de negocio.

Para repetir el análisis: `npm run audit:consistencia`. El detalle se genera en `test-results/auditoria/consistencia.json`.

## Comprobación de datos existentes

| Clave revisada | Grupos duplicados |
| --- | ---: |
| Material y sede en inventario | 0 |
| Requerimiento y material | 0 |
| Orden de compra y material con SKU | 0 |
| Entrega y material | 0 |
| Traslado y material | 0 |
| Cotización y número de versión | 0 |
| Nombre y unidad de material normalizados | 0 |
| Nombre normalizado y sede de proyectos activos | **1 por revisar** |

Las claves de inventario, líneas y versiones cuentan con restricciones de unicidad en la base. El grupo de proyectos puede representar trabajos distintos; necesita comprobar ubicación y alcance antes de fusionarlo. No se añadió una restricción sobre el nombre. Las líneas de compra sin SKU no quedan cubiertas por la comprobación de SKU.

## Pendientes y límites

- **Concordancia de cotizaciones:** la base remota registra cuatro migraciones de cotizaciones del 2 de octubre que no están en este checkout, y aquí no aparece el módulo de cotizaciones. Es necesario reconciliar la versión o rama correspondiente antes de continuar ese flujo. Esta auditoría no reconstruye migraciones ni modifica la base.
- **Reintentos tras pérdida de conexión:** el bloqueo del formulario previene dobles pulsaciones, pero no garantiza idempotencia entre sesiones o ante una respuesta perdida después de guardar. Esa garantía requeriría una clave de operación persistida y validada en el servidor.
- **Sincronización posterior:** una fuente fallida conserva sus últimos datos y registra el fallo. No existe un indicador visible por fuente de la antigüedad de los datos.
- Las consultas agregadas describen el estado observado durante la auditoría; no garantizan que nunca aparezcan nuevos duplicados.

## Validación

- Compilación de producción y comprobación de TypeScript: satisfactorias. Persiste el aviso de tamaño del paquete de producción.
- Suite de lógica: **47 pruebas, 46 aprobadas, 0 fallidas y 1 omitida**. La omitida requiere dos conexiones PostgreSQL y configuración externa para transporte.
- Pruebas de gerente en 1440, 1024 y 390 px: búsqueda, fechas, unidades, tooltips y visualización sin errores de ejecución.
- Pruebas de formularios en 1440 y 390 px: carga inicial incompleta y reintento, reutilización del catálogo, bloqueo de material repetido y una sola orden ante doble pulsación. Se usa autenticación y API simuladas, sin escrituras en la base real.

Las pruebas de lógica pueden repetirse con `npm test`; las de navegador requieren Playwright/Edge y el servidor de desarrollo. No se publicó ni desplegó el proyecto.
