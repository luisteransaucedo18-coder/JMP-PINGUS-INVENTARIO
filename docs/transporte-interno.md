# Transporte interno de mercadería

Implementación conectada a Supabase; no usa registros de demostración en la aplicación. El esquema de producción se inspeccionó el 29/09/2026. La migración se aplicó al proyecto `Jmp-pingus-inventario` con la versión remota `20260929144132`.

## Aplicación en Supabase

1. La migración `supabase/migrations/20260929141950_transporte_interno.sql` ya fue aplicada al proyecto **Jmp-pingus-inventario**. No volver a ejecutarla. No ejecutar todo el historial antiguo: hay diferencias entre algunas migraciones antiguas del repositorio y el esquema remoto.
2. Mantener `public` como esquema expuesto en Data API. **No exponer `transporte_privado`**. La migración concede los permisos de lectura y RPC necesarios a `authenticated`; `anon` no recibe acceso.
3. La migración crea automáticamente el bucket privado **transporte-interno**, sus políticas y límites. No es necesario crear el bucket manualmente ni convertirlo en público.
4. Desplegar la aplicación con las variables existentes `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. No se necesita una clave de servicio en React.
5. Verificar el flujo con coordinadores activos de origen y destino. El módulo aparece únicamente en su menú y panel. Usar **Actualizar** para consultar cambios hechos por otra sede; no requiere configurar Realtime.

## Storage

- Bucket privado `transporte-interno`.
- Tamaño máximo por archivo: **10 MiB (10 485 760 bytes)**.
- MIME permitidos: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Ruta: `<traslado UUID>/<COMPROBANTE o EVIDENCIA>/<archivo UUID>.<extensión>`.
- Comprobantes: solo origen y mientras sea borrador. Evidencias: coordinadores de ambas sedes durante tránsito/incidencia.
- Lectura: coordinadores activos de las sedes involucradas. Enlaces firmados de 60 segundos para visualizar/descargar. Sin reemplazo o eliminación desde el cliente para preservar evidencias.
- Se comprueban tamaño, MIME y firma del archivo en el navegador antes de subir; Storage limita tamaño/MIME. El registro SQL verifica existencia, propietario y metadatos del objeto. No se almacenan binarios en tablas.
- Storage y PostgreSQL no comparten una transacción. Si falla el enlace después de subir, se informa el error y el borrador se conserva; se puede adjuntar nuevamente. Un objeto huérfano puede quedar en el bucket y debe revisarse administrativamente antes de eliminarlo. Nunca habilitar una política de borrado general para solucionarlo.

## Modelo y reglas

- Reutiliza `perfiles`, `materiales`, `sedes`, `inventario_sedes` y `movimientos_inventario` existentes. El trigger actual de estado de material sigue ejecutándose.
- Añade `traslados`, `traslado_items`, `traslado_archivos`, `traslado_incidencias` y `traslado_historial`, con RLS y sin permisos de escritura directa desde el cliente.
- Borrador no reserva ni descuenta. El despacho vuelve a validar disponibilidad y descuenta origen. La recepción solo suma lo aceptado a destino.
- Movimientos en la tabla existente con `referencia_tipo='TRASLADO'`, `referencia_id=traslado_id`, cantidad firmada y saldos anterior/nuevo. `tipo='AJUSTE_MANUAL'` conserva compatibilidad con el enum existente; `transporte_tipo` distingue DESPACHO, RECEPCION, RESOLUCION y REVERSION. También se guarda nombre del material y sede contraparte.
- Cantidades de hasta 3 decimales para **MTS y GLD**; **UND y ROLLO** exigen enteros. Una unidad desconocida exige enteros por defecto. Esta regla está centralizada en `transporteValidation.ts` y `transporte_privado.cantidad_valida`; adaptar ambas si se agregan otras unidades fraccionarias.
- `recibida = aceptada + danada`; faltante = solicitada menos recibida. Lo dañado/rechazado no entra al stock.
- Una recepción parcial exige observación y deja INCIDENCIA. La resolución registra cantidades acumuladas; solo agrega aceptaciones adicionales. Puede cerrar con faltantes/daños definitivos mediante una explicación obligatoria, conservando cantidades originales y resolución. No disminuye cantidades ya aceptadas.
- Cancelar borrador no mueve stock. Un despacho sin unidades aceptadas requiere solicitud de origen, autorización de destino y confirmación explícita de retorno físico **completo** en origen. Solo entonces se restituye origen y se cancela. Una recepción con unidades aceptadas no se cancela: se resuelve la incidencia. Un traslado recibido es inmutable.
- Costo, moneda y comprobante son independientes del precio/cantidad del inventario. Para despachar un traslado con costo positivo se requiere número, fecha y archivo del comprobante.
- Cada RPC es una transacción. Bloqueo de cabecera, material y stock, orden por SKU, validación de estado, historial y un índice único de movimientos impiden duplicaciones. Una excepción revierte stock, detalles, historial y estado. Los reintentos de creación usan el mismo UUID; las acciones ya ejecutadas son idempotentes.

## Correcciones de autorización necesarias

La inspección encontró dos vías de elevación de privilegios en el sistema existente. La migración las corrige para que las restricciones del módulo sean efectivas:

- Un usuario no puede editar su propio rol, sede o estado para concederse acceso. Los cambios administrativos de esos campos requieren gerente activo o backend autorizado.
- El trigger `crear_perfil_nuevo_usuario` toma **rol y sede de `raw_app_meta_data`**, administrado por Auth Admin/service role; ignora esos campos de `raw_user_meta_data`. El nombre puede seguir viniendo de los metadatos del usuario. Las altas sin metadatos administrados quedan como analista sin sede, para asignación administrativa. No cambia los perfiles existentes.

La revisión de Supabase Advisors también encontró avisos **preexistentes** fuera del módulo: vistas `v_inventario` y `v_compras` con privilegios del propietario, funciones antiguas expuestas y `set_updated_at` sin search_path fijo. No se modificaron esos módulos. Referencias de revisión: [vistas](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [funciones expuestas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

## Verificación reproducible

Resultado de esta entrega: **15/15 pruebas aprobadas en PostgreSQL nativo 17.6**, incluida concurrencia con dos conexiones, y `npm run build` aprobado. Vite conserva un aviso de tamaño de bundle; no impide la compilación.

```powershell
npm run test:transporte
npm run build
```

La suite usa PostgreSQL embebido PGlite y un esquema de prueba aislado basado en las tablas inspeccionadas. No conecta a producción. La prueba de conexiones concurrentes se omite en PGlite porque solo tiene una conexión.

Para ejecutar también concurrencia con PostgreSQL nativo (se verificó en PostgreSQL **17.6**, igual a la versión remota inspeccionada):

```powershell
npm install --prefix .tmp-transporte-pg embedded-postgres@17.6.0-beta.15
$env:TRANSPORTE_PG_MODULE = (Resolve-Path .tmp-transporte-pg/node_modules/embedded-postgres/dist/index.js).Path
npm run test:transporte
Remove-Item Env:TRANSPORTE_PG_MODULE
```

Usa el puerto local 55439, crea un clúster temporal dentro de `.tmp-transporte-pg` (ignorado por Git) y detiene el servidor al terminar. No se añade PostgreSQL nativo a las dependencias del producto.

Casos cubiertos: traslado entre sedes, disponibilidad al guardar/despachar, doble solicitud de creación/despacho/recepción, dos conexiones esperando el bloqueo real de PostgreSQL, recepción parcial y dañados, resolución, cancelación y reversión, usuario analista/inactivo/sede ajena, escritura directa, elevación por perfil/metadatos de alta, archivos inválidos y reglas SQL de Storage, error inyectado a mitad de un movimiento y rollback.

Pendiente operativo: comprobar el flujo de extremo a extremo en el navegador con las cuentas de las dos sedes y un archivo real en Supabase Storage. Las pruebas locales de Storage verifican sus políticas/tablas, no ejecutan su servicio HTTP.

## Archivos

- `src/App.tsx`: ruta y título solo para coordinador.
- `src/components/Sidebar.tsx`: entrada del menú de coordinador.
- `src/views/coordinador/CoordinadorDashboard.tsx`: acceso desde el panel.
- `src/views/coordinador/TransporteInternoView.tsx` y `.css`: listado, filtros, formulario, detalle, recepción, archivos, incidencias y línea de tiempo, con adaptación móvil.
- `src/services/transporteService.ts`: consultas reales, RPC y Storage.
- `src/services/transporteValidation.ts`: validaciones de cantidad y archivo.
- `supabase/migrations/20260929141950_transporte_interno.sql`: tablas, permisos, RPC atómicas, Storage y protección de perfiles.
- `tests/transporte.test.mjs`: suite SQL, archivos y concurrencia.
- `package.json`, `package-lock.json`, `pnpm-lock.yaml`: comando de pruebas y dependencia de desarrollo PGlite fijada a 0.5.8.
- `docs/transporte-interno.md`: instalación y decisiones operativas.
