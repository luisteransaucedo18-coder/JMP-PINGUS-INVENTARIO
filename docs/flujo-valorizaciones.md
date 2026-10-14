# Trabajos y valorizaciones

Cada cotización aceptada representa una instalación de gas. El módulo toma por separado los gastos `MANO_OBRA` (interna) y `HABILITACION`; no toma el precio de venta al cliente como pago al técnico. Primera versión en PEN, sin conversiones implícitas. Cada etapa identifica un técnico responsable y su DNI.

## Responsables y estados

Analista: crea el expediente de una cotización propia, evalúa calidad de obra y checklist, carga fotos y formatos, genera el reporte PDF y envía a Tesorería. No se crean cuentas para técnicos. Coordinación consulta.

Tesorería: revisa contrato, formatos, materiales y devoluciones; observa, retiene o propone descuentos. Cada ítem muestra el precio de inventario por unidad como referencia y recibe cantidad, descuento total y motivo. El servidor conserva el precio de inventario al revisar; no añade un margen automático. La clasificación de consumo frente a sobrante pendiente corresponde al revisor, no se deduce de todo material entregado.

Tesorería guarda los descuentos y el neto definitivo antes de descargar la valorización. Recibe la firma digital externa y carga el PDF firmado y el recibo por honorarios. Confirma la correspondencia de sus importes. Cambiar descuentos exige nuevos documentos firmados y recibo. No se implementa firma electrónica ni verificación criptográfica de la firma dentro del sistema.

Gerente: autoriza el pago o devuelve a Tesorería con motivo. Puede revocar autorización mientras el pago no haya sido registrado. Tesorería carga comprobante y registra fecha, referencia y neto autorizado. La operación crea automáticamente un costo real en la cotización vigente. No registrar este mismo pago como un gasto manual adicional.

Estados: BORRADOR → EN_TESORERIA → EN_GERENCIA → AUTORIZADA → PAGADA. OBSERVADA y RETENIDA conservan el motivo. Cada operación guarda actor, fecha, detalle y una revisión para rechazar ediciones desactualizadas.

El gerente puede asignar Tesorería a una cuenta activa existente desde el módulo. La cuenta debe iniciar sesión nuevamente. No se modifica ninguna cuenta al aplicar la migración.

## Evidencias

Checklist basado en el Excel de valorización de internas proporcionado: 19 puntos, con Conforme, Observado o No aplica justificado. Los puntos fotográficos requieren fecha y ubicación declaradas por el analista; cocina requiere dos fotos. No se inventa georreferenciación ni se valida calidad de obra automáticamente.

Se cargan isométrico final, resumen de materiales, plano en planta, prueba de hermeticidad, declaración jurada, certificado de garantía y contrato de instalación. El isométrico posterior a construcción es opcional. El reporte fotográfico se genera con las fotos y el checklist guardados. Cambiar fotos, checklist o formatos exige regenerarlo antes del envío. Se conservan las versiones de los documentos. Un nuevo envío exige documentos firmados y recibo vigentes.

Archivos en bucket privado `valorizaciones`, URLs firmadas de corta duración. Fotos JPG, PNG y WebP originales hasta 15 MB: se convierten a JPEG, lado máximo de 1600 px, calidad 80%, máximo 1 MB resultante y 40 fotos por expediente. PDFs hasta 15 MB por archivo. La revisión humana debe comprobar que la compresión conserva los detalles necesarios.

## Adelantos y cierre

Los adelantos son excepcionales: importe y motivo, revisión de Tesorería, firma y recibo, autorización de gerente y comprobante de pago. Deben dejar saldo positivo de mano de obra. La valorización final se crea después de completar los adelantos, descuenta lo pagado y evita nuevos adelantos de esa etapa. Se mantiene una valorización final por etapa y serie de cotización.

El servidor bloquea el cierre existente de cotizaciones si no hay abonos registrados que cubran el 100% del importe aceptado, si hay expedientes pendientes o si falta pagar la valorización final de alguna etapa con mano de obra presupuestada. Se mantienen los controles existentes de materiales y devoluciones. Los otros costos deben conciliarse y registrarse en el módulo de costos; no existe en esta versión una agenda de cuentas por pagar a proveedores.

Una corrección de presupuesto no autoriza sobrepagos: el servidor revalida importes al pagar. Para actualizar un final: devolver la autorización si procede, observar, guardar nuevamente checklist (recalcula mano de obra desde presupuesto vigente), regenerar reporte y volver a revisar y firmar.

## Capacidad

Escenario orientativo: 10 instalaciones/mes, 12 fotos de 500 KB por etapa y dos etapas → 12 MB de fotos/instalación. Sumando reportes y formatos, planificar inicialmente 30–50 MB por instalación: 0,3–0,5 GB/mes, 3,6–6 GB/año. No es una medición de archivos reales; las versiones y PDFs grandes aumentan el consumo. Los 100 GB incluidos en Pro se comparten con los demás archivos del sistema y no se renuevan mensualmente.

Sin borrado automático. Revisar consumo en Supabase y definir con la empresa conservación/archivo antes de alcanzar la cuota. La base de datos almacena estados y referencias, no imágenes en base64.

## Migraciones y validación

Aplicar primero `20261014144819_tesoreria_rol.sql` en una transacción independiente y después `20261014144823_trabajos_valorizaciones.sql`. La separación permite usar el nuevo valor del enum de PostgreSQL.

`tests/valorizaciones.test.mjs` ejecuta las migraciones en PostgreSQL local con PGlite y prueba permisos, evidencia obligatoria, cocina con dos fotos, importes, adelantos, descuentos, revisiones, pago único y cierre. `scripts/preview-valorizaciones.mjs` crea una vista visual aislada en `test-results`, sin login ni escrituras a Supabase.
