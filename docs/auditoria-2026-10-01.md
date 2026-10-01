# Auditoría de código y base de datos — 01/10/2026

## Resultado

El proyecto compila y las pruebas locales pasan, pero **no se puede afirmar que todo esté correctamente definido**. Hay fallos de persistencia, integridad de entregas, autorización de usuarios inactivos y diferencias entre documentación, interfaz y base de datos.

Esta revisión modifica únicamente documentación. No se actualizaron dependencias, registros, funciones, políticas ni migraciones de Supabase. Las excepciones de acceso de entregas y transporte documentadas en el README se conservan.

## Alcance y método

- Inventario y análisis estático de `src`, configuración, servicios, tipos, componentes, vistas por rol, utilidades, pruebas y las 18 migraciones SQL versionadas. Revisión dirigida de manejadores de operaciones, autenticación, sincronización, stock y permisos.
- Revisión de `package.json`, `tsconfig.json`, `vite.config.ts`, `.mise.toml`, archivos de entrada, recursos públicos, documentación e historial Git disponible. Los archivos vacíos `src/service/materialService.ts` y `src/views/analista/NuevaSolicitudView.tsx` no son implementaciones alternativas.
- Consultas de solo lectura sobre el proyecto Supabase `Jmp-pingus-inventario`: funciones vigentes, políticas, restricciones, triggers, privilegios, publicación Realtime, migraciones y conteos de integridad. No se extrajeron datos personales ni credenciales.
- Compilación TypeScript estricta, build de producción, pruebas locales y auditoría de dependencias.

No es una certificación de seguridad ni una prueba exhaustiva de todas las pantallas. No se ejecutaron escrituras de prueba en producción. No se ejecutó la prueba de navegador porque Playwright no está instalado; tampoco la prueba de dos conexiones PostgreSQL porque no se configuró `TRANSPORTE_PG_MODULE`. Las pruebas SQL utilizan esquemas de prueba y no reproducen toda la base remota.

## Verificaciones ejecutadas

| Verificación | Resultado | Límite |
|---|---|---|
| `pnpm typecheck` | Correcto | Verifica tipos y símbolos sin uso; no garantiza reglas de negocio. |
| `pnpm build` | Correcto | Advertencia por el paquete principal de 1.183,60 kB, 370,05 kB comprimido. |
| `node --test tests/*.test.mjs` | 28 pruebas: 27 aprobadas, 0 fallidas, 1 omitida | La omitida verifica bloqueo entre dos conexiones. |
| `pnpm audit --json` | 9 avisos: 6 altos y 3 moderados | Dependencias de desarrollo: Vite, PostCSS y nanoid; no se demostró explotación. |
| Supabase Security Advisors | 15 funciones `SECURITY DEFINER` ejecutables por autenticados y protección de contraseñas filtradas desactivada | Son advertencias para revisar individualmente, no 15 vulnerabilidades demostradas. |
| Supabase Performance Advisors | 11 avisos de evaluación RLS por fila, 9 de políticas permisivas múltiples y 34 índices sin uso observado | No eliminar índices solo por estas estadísticas. |
| Tablas públicas con RLS | Las 26 tablas públicas inspeccionadas tienen RLS habilitado | Habilitar RLS no demuestra que sus políticas sean correctas. |
| Vistas | `v_inventario`, `v_requerimientos` y `v_compras` usan `security_invoker=true` | Confirmado en la base remota. |
| Integridad agregada | 0 stocks negativos; 0 combinaciones material/sede faltantes; 1 grupo repetido de nombre/sede en proyectos activos; 1 línea con entregas acumuladas superiores a lo solicitado | Los grupos de proyectos requieren criterio de negocio antes de considerarse duplicados indebidos. |

## Hallazgos prioritarios

### A01 — Alta: cambio de contraseña y perfil sin persistencia

**Evidencia:** `src/views/shared/ProfileView.tsx`, `handleSave` y `handlePwSave`.

Ambos manejadores muestran mensajes de éxito sin invocar un servicio remoto. La contraseña actual no se autentica y la nueva no se envía a Supabase Auth. La sede y el teléfono iniciales son valores fijos, no datos del perfil autenticado. El usuario puede creer que cambió una contraseña que sigue siendo la anterior.

**Acción propuesta:** cargar el perfil real, persistir los campos permitidos y efectuar el cambio de contraseña en Auth con la comprobación requerida. Mostrar éxito únicamente después de la respuesta del backend. Probar fallo remoto, contraseña actual incorrecta y reingreso con la nueva contraseña.

### A02 — Alta: un usuario inactivo conserva autorización en varias operaciones

**Evidencia remota:** `public.rol_actual()` devuelve el rol por `auth.uid()` sin filtrar `estado = 'ACTIVO'`. `actualizar_material_con_inventario`, `registrar_entrega` y `registrar_devolucion` dependen de ese rol y no comprueban por separado el estado. Las políticas de administración de materiales y stock también dependen del rol.

El login comprueba el estado, pero desactivar un usuario que mantiene una sesión no elimina esa autorización en el backend. La aplicación tampoco escucha cambios de su perfil para retirar el acceso durante la sesión. El transporte sí cuenta con controles específicos de usuario activo.

**Acción propuesta:** revisar de forma coordinada helpers, políticas y RPC para garantizar el estado activo en cada operación protegida; verificar sesiones ya abiertas. No asumir que ocultar la interfaz resuelve la autorización. No se cambiaron permisos en esta auditoría.

### A03 — Alta: entregas acumuladas pueden superar el requerimiento

**Evidencia:** `supabase/migrations/20260925210145_persistir_entregas_para_devolucion.sql` y definición remota de `registrar_entrega`.

La función compara cada cantidad entregada con la cantidad original solicitada, pero no descuenta entregas anteriores ni utiliza un identificador estable de reintento. Calcula el estado usando `cantidad_solicitada` enviada por el cliente. El formulario se inicializa con la cantidad completa del requerimiento, incluso al completar una entrega parcial.

Ejemplo: para 10 unidades solicitadas, registrar 6 y luego otras 6 satisface la validación individual, aunque acumula 12. La consulta de solo lectura encontró **una línea requerimiento/material con entregas acumuladas superiores a su cantidad solicitada**. Como las devoluciones usan la suma de entregas para calcular el saldo, ese exceso puede permitir devoluciones superiores a lo realmente autorizado.

**Acción propuesta:** bloquear el requerimiento durante el registro, validar el saldo acumulado por SKU, rechazar ítems duplicados y derivar cantidades/estado desde la base. Proteger reintentos y cargar el saldo pendiente en el formulario. Revisar el caso existente sin eliminar historial. Mantener separada esta corrección de la excepción aceptada de acceso a entregas ajenas.

### A04 — Alta: creación y administración de usuarios no corresponden al backend

**Evidencia:** `src/features/usuarios/pages/UsuariosView.tsx`, `src/services/perfilService.ts`, políticas y esquema remoto de `perfiles`.

`crearPerfil` inserta nombre, correo, rol, sede y estado, pero no crea una cuenta Auth ni aporta `id`. En la base, `perfiles.id` es obligatorio, no tiene valor por defecto y referencia `auth.users(id)`. Además, la interfaz ofrece administración al Coordinador, mientras la política de administración y el trigger `transporte_privado.proteger_perfil` reservan la modificación de rol/sede/estado al Gerente activo.

Crear o activar/desactivar usuarios desde el flujo del Coordinador puede fallar. Las operaciones tampoco tienen un bloqueo local dedicado mientras se procesan.

**Acción propuesta:** definir quién administra cuentas y ofrecer un flujo de creación/invitación Auth desde un backend autorizado, vinculado al perfil. Alinear interfaz y políticas después de resolver esa decisión. Nunca incorporar una clave `service_role` al cliente.

### A05 — Alta: dependencias de desarrollo con avisos de seguridad

**Evidencia:** salida de `pnpm audit --json` sobre el lockfile instalado. Vite 8.0.5, PostCSS 8.5.8 y nanoid 3.3.11 acumulan 9 avisos.

Vite incluye un aviso sobre lectura de archivos mediante rutas alternativas de Windows, relevante para este entorno. PostCSS incluye avisos sobre carga de mapas de origen; nanoid incluye avisos sobre generadores. La presencia de una dependencia vulnerable no prueba que todos esos escenarios sean alcanzables en esta aplicación.

**Acción propuesta:** actualizar de forma controlada dentro de versiones compatibles y repetir auditoría, pruebas, build y preview. Consultar los avisos para verificar las versiones corregidas vigentes; no aplicar cambios automáticos indiscriminados.

Referencias: [Vite en Windows](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), [PostCSS y mapas de origen](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [nanoid](https://github.com/advisories/GHSA-2v37-7h3g-55p8).

### A06 — Media: carga inicial exitosa con fuentes fallidas

**Evidencia:** `src/store/AppContext.tsx`, `refreshRemoteData`.

`Promise.allSettled` conserva resultados exitosos y escribe los errores en consola, pero la función termina normalmente. El efecto asigna `initialLoad = 'ready'`; el bloque que debería habilitar reintento no se activa por esos rechazos. La aplicación puede presentar listas vacías o datos antiguos como si todas las consultas hubieran terminado correctamente.

**Acción propuesta:** distinguir carga completa, parcial y fallida; comunicar los errores y permitir reintentar. Separar una operación ya guardada de un fallo al refrescar la lista para no inducir a repetir la escritura. Evitar que respuestas de refrescos anteriores sobrescriban datos más recientes.

### A07 — Media: sincronización Realtime incompleta y estados locales separados

**Evidencia:** suscripciones en `AppContext.tsx` y publicación remota `supabase_realtime`.

La aplicación escucha `materiales`, `entregas`, `entrega_items`, `ordenes_compra` y `orden_compra_items`, pero esas tablas no están en la publicación consultada. La publicación sí incluye inventario, proyectos, requerimientos, abastecimiento y devoluciones. Por tanto, una compra aprobada o una entrega nueva no garantiza refresco inmediato en otros clientes.

Además, Inventario mantiene su propio listado, y Devoluciones consulta al entrar y después de un registro local. No aprovechan de manera uniforme la sincronización global. Cada evento global vuelve a consultar cinco fuentes completas, sin agrupación de ráfagas.

**Acción propuesta:** verificar publicación, permisos y suscripciones por tabla; unificar fuentes o invalidar listados locales y agrupar refrescos. Probar dos sesiones para aprobación, entrega y ajuste de stock.

### A08 — Media: identificación por nombre en vez de UUID

**Evidencia:** `MisSolicitudesView.tsx`, `MisComprasView.tsx`, `AnalistaDashboard.tsx`, `NotificationsPanel.tsx` y `ProfileView.tsx`.

Los filtros comparan nombres y algunos aceptan coincidencias con el primer nombre. Los contratos de requerimiento/compra no conservan `analista_id`. Homónimos, cambios de nombre o coincidencias parciales pueden producir conteos y selección incorrectos dentro de los datos que permita RLS. No se demostró por esto una evasión de RLS.

**Acción propuesta:** conservar UUID del usuario y propietario en los modelos; usar nombres solo para presentación.

### A09 — Media: reglas de devolución documentadas no describen lo vigente

**Evidencia:** secciones 13, 14 y matriz del README frente a `20260928120000_devoluciones_inventario_directo.sql`, `DevolucionesView.tsx` y función remota.

El comportamiento actual permite a Analista y Coordinador registrar devoluciones; se guardan como `VALIDADA` y aumentan el stock inmediatamente. Las RPC de corrección y resolución fueron revocadas en la migración local. El README heredado exige revisión posterior del Coordinador y atribuye el registro únicamente al Analista.

**Acción propuesta:** decidir si se mantiene el ingreso directo o se recupera la validación posterior. El README ahora señala explícitamente la diferencia y describe el comportamiento observado, sin considerar aprobada una modificación de reglas por el solo hecho de existir código.

### A10 — Media: saldo de devolución obsoleto al cambiar proyecto rápidamente

**Evidencia:** efecto dependiente de `selectedProject` en `DevolucionesView.tsx`.

La consulta anterior no se cancela ni comprueba si el proyecto sigue seleccionado antes de ejecutar `setSaldos`. Cambiar de A a B mientras A responde lentamente puede mostrar materiales de A bajo el proyecto B. Las cantidades seleccionadas tampoco se reinician en ese efecto.

**Acción propuesta:** invalidar respuestas anteriores, limpiar cantidades y saldos al cambiar proyecto y bloquear el envío mientras se carga. Verificar de nuevo la relación proyecto/requerimiento al registrar.

### A11 — Media: pérdida de trazabilidad y precisión en presentación de entregas

**Evidencia:** `obtenerEntregas` en `devolucionService.ts` y `EntregaForm` en `EntregasView.tsx`.

El responsable se muestra como `Usuario registrado` en vez de consultar el perfil vinculado a `responsable_entrega_id`. La fecha se obtiene en UTC y la hora en zona local, lo que puede mostrar días distintos. Las cantidades se editan con `parseInt` y los comprobantes imprimen `UND` para todos los materiales, aunque el sistema contempla metros y otras unidades.

**Acción propuesta:** obtener responsable, unidad y timestamp completos; formatear fecha y hora en `America/Lima`; permitir decimales según unidad.

### A12 — Media: ajustes de inventario sin movimiento auditado

**Evidencia:** RPC remota `actualizar_material_con_inventario` y triggers consultados de `inventario_sedes`.

El guardado es atómico, pero reemplaza stocks con valores absolutos y no registra en esa función un movimiento con motivo, usuario y valores anterior/nuevo. Los triggers de inventario observados recalculan estado y fecha; no crean ese movimiento. Un formulario abierto antes de una compra puede sobrescribir existencias recientes con valores antiguos.

**Acción propuesta:** registrar ajustes con diferencia, motivo y actor, y detectar edición sobre una versión obsoleta. No confundir atomicidad de una operación con protección frente a edición basada en datos antiguos.

### A13 — Media: migraciones locales y remotas no se pueden reconciliar por versión

**Evidencia:** 18 archivos locales frente a 19 entradas del historial remoto consultado.

Ejemplos: `transporte_interno` figura localmente como `20260929141950` y remotamente como `20260929144132`; `sync_requerimientos_analista_coordinador` también tiene versiones distintas. Hay entradas remotas sin archivo equivalente y cambios locales como devolución directa y planificación de compra que no aparecen con esos nombres en el historial remoto, aunque la función de devolución directa sí existe.

Las primeras migraciones dependen de tablas y enums preexistentes que no están definidos por completo en el repositorio. Aplicar todos los SQL sobre una base vacía no reconstruye por sí solo el sistema.

**Acción propuesta:** obtener un esquema base y reconciliar historia con herramientas oficiales antes de desplegar en otro entorno. No volver a ejecutar todas las migraciones ni renombrar versiones para forzar coincidencias sin verificar diferencias.

### A14 — Media: prevención de proyectos repetidos limitada

**Evidencia:** `crearProyecto`, restricciones remotas y conteo agregado de proyectos.

La base tiene unicidad por `codigo`; el frontend no aporta ese código. No se observó una restricción única para nombre normalizado/sede. Hay un grupo de proyectos activos con nombre normalizado y sede iguales. Esto es un candidato a duplicado, no prueba que sean el mismo proyecto según el negocio.

**Acción propuesta:** definir el identificador real de negocio, revisar el grupo existente y agregar protección de unicidad/idempotencia acorde con esa definición. Un botón deshabilitado no protege solicitudes concurrentes desde distintos clientes.

### A15 — Baja: mantenimiento, contratos y configuración

- `InventarioView.tsx` tiene 2.580 líneas y varias pantallas superan 800. Separar composición, formularios y lógica reduce riesgo de cambios.
- Se contaron 12 tipos `any` explícitos en TypeScript, principalmente en transformaciones remotas y plugins Vite. El cliente Supabase no utiliza un contrato `Database` generado para validar tablas y RPC.
- `actualizarMaterial` acepta `Partial<Material>`, pero no persiste `precioUnitario`; la RPC de actualización tampoco lo admite. El contrato debe expresar qué campos son editables.
- `package.json` declara pnpm 10.12.4 y `.mise.toml` 10.34.3; el ejecutable disponible fue pnpm 11.25.0. Unificar la versión documentada y de instalación.
- No hay script general `test`; `inventory-status.test.mjs` requiere el comando global indicado en este informe. Las pruebas de navegador dependen de Playwright externo.
- El enrutador importa todas las páginas de forma estática. El paquete principal excede el límite configurado de 800 kB; evaluar carga diferida por vista.
- Los estados de notificaciones leídas viven en memoria del shell; se reinician al cerrar sesión, aunque hay una tabla remota `notificaciones_leidas`.
- La separación servicios/vistas descrita en `docs/arquitectura-frontend.md` es una convención deseada: aún hay consultas Supabase directas desde páginas, por ejemplo Inventario y Nueva Solicitud.
- El trigger `validar_saldo_devolucion_item` suma filas existentes en un `BEFORE INSERT/UPDATE` sin incorporar correctamente la cantidad de `NEW`. Una comprobación aislada con PGlite confirmó que ese trigger por sí solo no impide exceder el saldo. La RPC vigente de devolución directa añade validación previa y bloqueo; no se demostró que ese fallo del trigger sea explotable por el flujo actual. Corregirlo como defensa adicional y probar inserción y actualización respetando las restricciones reales.

## Avisos Supabase para seguimiento

| Aviso | Interpretación | Referencia |
|---|---|---|
| Funciones `SECURITY DEFINER` ejecutables por autenticados | Revisar autorización interna y exposición. Los helpers usados por RLS y RPC operativas requieren evaluación individual; una función trigger no equivale a una RPC de negocio utilizable. | [Guía del aviso 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| Protección de contraseñas filtradas desactivada | Evaluar habilitación conforme al plan disponible. | [Seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| Evaluaciones RLS por fila | Evaluar uso de subconsultas para funciones de autenticación sin alterar permisos. | [Guía del aviso 0003](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) |
| Políticas permisivas múltiples | Revisar combinación y coste conservando el alcance aprobado. | [Guía del aviso 0006](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) |
| Índices sin uso observado | Medir carga y antigüedad de estadísticas antes de decidir. | [Guía del aviso 0005](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) |

También se observaron privilegios de tabla amplios para `authenticated`, incluido `TRUNCATE` en las tablas consultadas. Revisar mínimo privilegio y los caminos realmente alcanzables; esta auditoría no ejecutó esas operaciones ni demostró que sean accesibles desde PostgREST.

## Orden recomendado de corrección

1. Resolver contraseña/perfil, bloqueo efectivo de usuarios inactivos e integridad de entregas; revisar el exceso existente.
2. Definir administración de usuarios y flujo oficial de devoluciones; alinear interfaz, reglas y backend.
3. Actualizar dependencias de desarrollo y reconciliar esquema e historial de migraciones.
4. Corregir carga parcial, Realtime, identificación por UUID, saldos obsoletos y trazabilidad de ajustes.
5. Mejorar contratos, tamaño de módulos, precisión de unidades, herramientas y cobertura de pruebas.

Cada corrección debe incluir evidencia de validación y actualizar este documento. Los hallazgos se mantienen **pendientes**; documentarlos no significa haberlos corregido.
