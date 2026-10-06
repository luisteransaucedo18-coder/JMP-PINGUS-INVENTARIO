# Datos, roles y referencias visibles — 6 de octubre de 2026

## Alcance y criterio

Revisión de servicios, estado compartido, navegación, dashboards, requerimientos, compras, proyectos, entregas, devoluciones, cotizaciones, usuarios, transporte y PDF de requerimientos. El usuario confirmó que los registros actuales son de demostración y que el inventario real se ingresará posteriormente. No se eliminaron, fusionaron ni corrigieron cantidades históricas.

Los códigos operativos se conservan en pantalla: SKU, requerimiento, compra, entrega, devolución, cotización y código de usuario en las vistas autorizadas. Los UUID, claves de relaciones y referencias técnicas se mantienen para consultas, operaciones y claves de React, sin mostrarse como folios. Los proyectos se identifican visualmente por nombre, dirección, sede y cliente; los traslados por guía/comprobante y ruta. No se inventan folios a partir de fragmentos del UUID.

## Cambios

| Problema | Corrección |
| --- | --- |
| Requerimientos mostraban UUID en dashboards, proyectos, entregas y notificaciones. | Referencia pública compartida, usada también en PDF. |
| Entregas omitían su código y mostraban un responsable genérico. | Se consultan código, requerimiento y nombre del responsable registrado. |
| Historial de cotización mostraba UUID del actor; formato anterior volcaba JSON sin filtrar. | Nombre del actor y lista de campos de negocio, con filtrado de referencias internas anidadas. |
| Directorio y traslados mostraban UUID truncados como códigos. | Código de usuario; guía o comprobante del traslado. |
| Proyectos del mismo nombre podían compartir solicitudes y contadores. | Asociación exclusivamente por ID persistido, sin coincidencia por nombre. |
| “Mis” registros dependían del nombre o de su primera palabra. | Identidad persistida del analista; compatibilidad histórica solo con nombre exacto cuando falta identidad. |
| Estado de entrega del requerimiento dependía del último comprobante. | Saldo acumulado por SKU, excluyendo comprobantes cancelados. |
| Formulario volvía a ofrecer la cantidad original después de una entrega parcial. | Cantidad pendiente real; aviso/bloqueo ante exceso histórico; bloqueo inmediato de doble pulsación. |
| Entregas trataban todos los materiales como UND y truncaban decimales. | Unidad del requerimiento, decimales donde corresponden, totales separados por unidad. |
| Consulta gerencial sumaba cantidades de unidades diferentes como un único total. | Número de líneas de materiales, con encabezado “Materiales”. |
| Fecha UTC y hora del navegador podían pertenecer a días distintos. | Fecha y hora de Lima para entregas; fecha de devolución consistente en filtros gerenciales. |
| Una sincronización fallida conservaba datos anteriores sin aviso global. | Aviso con las fuentes fallidas y acción de reintento en los tres roles. |
| Devoluciones gerenciales mantenían otra copia; directorio y traslados no reaccionaban a cambios. | Devoluciones desde estado compartido; suscripción y carga agrupada para las otras consultas. |

## Base de datos

Se aplicó y registró `20261006142652_entrega_saldos_y_roles.sql` en el proyecto configurado. La función de entrega:

- Exige sesión activa y rol analista/coordinador; el analista opera sus propios requerimientos.
- Bloquea el requerimiento durante la operación para serializar entregas concurrentes.
- Verifica cantidades contra el saldo persistido y rechaza SKU repetidos, desconocidos, cantidades negativas, cero total y fracciones de UND/ROLLO/PAR.
- Conserva nombres y cantidades solicitadas del requerimiento, aunque el cliente envíe otros valores.
- Permite escritura por la función validada; revoca escritura directa en entregas y sus líneas.
- Restringe lectura del analista a sus requerimientos; gerente y coordinador consultan entregas conforme a su rol. Usuarios inactivos no obtienen registros.

Se comprobó la lectura con los usuarios activos de la base, dentro de una transacción revertida. También se verificó que el servidor rechaza una nueva cantidad sobre el requerimiento que ya tiene exceso, sin añadir comprobantes.

## Datos de demostración observados

Sin duplicados en inventario por SKU/sede, líneas de requerimiento, compra o entrega, ni versiones de cotización. Sin stock ni precios/mínimos negativos. Los requerimientos, compras y entregas tienen códigos públicos.

Hay un grupo de proyectos activos con igual nombre/sede; se conservan como registros diferentes. REQ-2026-111 / SKU 104 solicita 12 y acumula 31 en ENT-2026-100 (12), ENT-2026-102 (12) y ENT-2026-103 (7). Estos datos demo se conservan por indicación del usuario; no se utilizan para ajustar inventario real ni se presentan como datos saneados.

## Verificación y límites

Compilación de producción satisfactoria. Suite: 68 pruebas, 67 aprobadas, ninguna fallida, una omitida por requerir dos conexiones PostgreSQL. Las pruebas nuevas cubren códigos visibles, identidad del propietario, saldos acumulados, unidades, fechas, lectura por rol, rechazo de cantidades y reversión atómica de errores.

La auditoría de navegador usa API simulada y comprueba referencias públicas, responsable real y separación de proyectos con nombres iguales, en gerente/analista/coordinador a 1440 y 390 px. No realiza escrituras en producción. El antiguo script `consistencia-frontend.e2e.mjs` no corresponde al flujo actual de solicitud desde cotización; quedó sustituido para este alcance por `public-codes-frontend.e2e.mjs`.

Los avisos del asesor de Supabase son una revisión adicional, no una auditoría exhaustiva de seguridad: dos catálogos privados sin políticas de lectura, 15 funciones con SECURITY DEFINER ejecutables por usuarios autenticados y protección de contraseñas filtradas desactivada. La función de entrega conserva SECURITY DEFINER para ejecutar la escritura protegida, con verificaciones explícitas de rol y propietario. No se cambiaron funciones ajenas ni la configuración de Auth. Referencias: [funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [catálogos con RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Se verificó el código y el estado demo observado; esto no garantiza ausencia de toda inconsistencia futura. No se ingresó inventario real ni se publicó el frontend.
