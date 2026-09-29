# Requerimientos con stock insuficiente

El analista puede enviar un requerimiento aunque la sede del proyecto no tenga todas las existencias. La pantalla informa el faltante antes del envío, pero no bloquea la operación.

Al pasar de `BORRADOR` a `ENVIADO`, PostgreSQL guarda por material el stock y el faltante observados. Si existe al menos un faltante, crea una alerta persistente en `requerimiento_abastecimiento`. El coordinador ve la alerta en notificaciones, panel, listado y detalle.

El coordinador dispone de dos rutas:

1. **Compra:** crea una orden `ENVIADO` vinculada al requerimiento y solamente por las cantidades que siguen faltando. Luego se revisa y recibe desde el módulo Compras.
2. **Traslado interno:** registra la sede de origen sugerida y abre Transporte interno. La pantalla muestra el stock disponible en las otras sedes para apoyar la decisión. El coordinador de origen mantiene el control del despacho.

El requerimiento permanece `ENVIADO` durante el abastecimiento. Cuando el inventario de la sede solicitante cubre todas las cantidades, el botón de confirmación se habilita. La confirmación vuelve a bloquear y validar stock en PostgreSQL, descuenta una sola vez y marca el abastecimiento como resuelto.

La migración aplicada es `supabase/migrations/20260929145711_gestionar_desabastecimiento_requerimientos.sql`.
