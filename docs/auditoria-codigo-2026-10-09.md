# Auditoría de código — 9 de octubre de 2026

Se analizaron automáticamente 103 archivos de `src`, se revisaron manualmente los puntos de guardado, validación y sincronización de inventario y devoluciones, y se verificaron los permisos de las funciones de inventario en Supabase. Las pruebas existentes cubren también solicitudes, entregas, transporte, cotizaciones, perfiles y seguimiento de proyectos. Esto no constituye una prueba de penetración ni garantiza ausencia de errores en todos los escenarios.

## Hallazgos corregidos

| Prioridad | Problema y consecuencia | Solución |
| --- | --- | --- |
| Crítica | Marcadores de conflicto de Git en el inventario y su prueba impedían compilar y ejecutar esa prueba. | Se conservaron los imports compartidos de precio y colores, el selector de unidades y los mocks necesarios de ambas versiones. |
| Alta | Una edición de stock abierta antes de una compra, traslado u otra edición podía sobrescribir las existencias nuevas. | El servicio envía el stock, unidad, longitud y mínimo originales; la función SQL bloquea las filas y compara esa información antes de escribir. Si cambió, rechaza toda la operación. |
| Media | Se validaba con `Number`, pero se guardaba con `parseFloat`; `1e3` podía acabar registrado como `1`. | Conversión única con `Number` y validación compartida para valores finitos, rango y tres decimales. El servidor también rechaza cantidades que habría redondeado. |
| Media | Un remanente inválido reemplazaba el stock del formulario por la cadena `NaN`. Además, longitudes decimales podían perder precisión al calcular los metros. | Los errores se guardan separados de la última cantidad válida; se bloquea el guardado hasta corregirlos. Los metros derivados conservan hasta seis decimales, necesarios para multiplicar dos valores con tres decimales. |
| Media | Clics repetidos podían iniciar varias operaciones de creación, edición o devolución. | Bloqueo inmediato mediante referencias, controles deshabilitados durante el guardado y liberación del bloqueo en `finally`. |
| Media | La pantalla de inventario conservaba una copia local sin seguir las actualizaciones del estado compartido. | Se sincroniza con el estado compartido y se refrescan los datos comunes después de guardar. El formulario conserva su instantánea original para detectar conflictos. |
| Media | Las funciones internas de cálculo de estado podían invocarse directamente por la API. Las funciones de escritura de materiales no comprobaban que el coordinador continuara activo. | Se revocó el acceso público y autenticado a tres helpers internos, manteniendo su uso por triggers. Crear y editar materiales exige un coordinador activo. |
| Media | En devoluciones no se validaba el contenido de las fotografías y el bucket carecía de límites. Los fallos de red podían dejar archivos sin registro. | Validación de todas las fotos antes de subirlas; JPG, PNG o WebP, máximo 5 MB. El bucket aplica límites de tamaño y MIME. Los errores de subida o registro limpian los archivos y preservan el error original. |
| Media | Una respuesta tardía al consultar saldos de otro proyecto podía reemplazar los saldos del proyecto actual. | Se descartan respuestas de consultas anteriores, se vacían los saldos al cambiar proyecto y se bloquea el registro mientras se carga. |

Los cambios principales están en `InventarioView.tsx`, `materialService.ts`, `stockQuantity.ts`, `rollStock.ts`, `RollStockInput.tsx`, `DevolucionesView.tsx`, `devolucionService.ts` y la migración `20261009164148_auditoria_guardado_inventario.sql`.

## Verificación

- `npm run check`: auditoría estática, pruebas y compilación completadas; 87 pruebas pasaron y una quedó omitida por la suite existente.
- Pruebas de regresión: modificación de stock después de abrir edición, permisos de usuario inactivo, cantidades fuera de rango, precisión, fotografías falsas y limpieza tras fallos de red/registro.
- Navegador aislado, con API simulada: edición de rollos en 1440 y 390 px; campos vacíos y remanentes inválidos bloquean el guardado y conservan la última cantidad válida. No se escribieron datos de producción desde el navegador de prueba.
- Supabase: migración aplicada y guardado con un coordinador activo comprobado dentro de una transacción revertida. Confirmados el bloqueo de acceso al helper interno y el límite de 5 MB del bucket.
- La auditoría no encontró marcadores de conflicto restantes, reglas CSS exactamente duplicadas, declaraciones CSS repetidas ni archivos vacíos. Los 15 selectores repetidos no se eliminaron automáticamente: pueden ser parte de la cascada y las reglas adaptables.
- Se añadió `npm run check`. La auditoría devuelve un error si encuentra marcadores de Git en código, pruebas, scripts o migraciones; se verificó introduciendo y retirando un archivo temporal de prueba.

## Observaciones pendientes

1. **Datos del catálogo:** los SKU `965958` (bushing), `985958` (cocineta) y `95` (conector) están registrados como `ROLLO`. Debe confirmarse su unidad real y sus cantidades antes de corregirlos. No se hizo una conversión automática. Las longitudes desconocidas de las demás tuberías también requieren confirmación.
2. **Configuración de Auth:** sigue desactivada la protección de contraseñas filtradas. Debe evaluarse su habilitación desde la configuración de Supabase: [guía oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
3. **Avisos de funciones privilegiadas:** los avisos bajaron de 15 a 12 al retirar los tres helpers. Las funciones de negocio restantes necesitan exposición para la aplicación; un aviso por `SECURITY DEFINER` no justifica quitarles acceso indiscriminadamente. [Referencia del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
4. **Rendimiento:** la compilación sigue avisando de un paquete principal de aproximadamente 1,59 MB antes de gzip. La siguiente optimización sería cargar vistas por demanda y medir la navegación; esta auditoría no cambió el enrutamiento.
5. **Publicación:** la base de datos quedó actualizada. El despliegue del frontend debe incluir estos cambios de servicio e inventario: los clientes anteriores que no envíen la instantánea del stock recibirán un rechazo al editar existencias. Las fotografías anteriores se conservaron.

La validación de contenido de imágenes del cliente y los límites de Storage reducen errores de carga; no sustituyen un análisis de archivos maliciosos en el servidor.
