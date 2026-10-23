# QA: productividad de materiales

Rama: `qa`. El merge a `main` queda pendiente de revisión.

## Cambios

- Búsqueda compartida sin tildes y con palabras en cualquier orden, combinando código, nombre y categoría. Primero aparecen códigos exactos, luego prefijos de código y nombre.
- Inventario utiliza la misma búsqueda que los selectores existentes de materiales.
- Guardar y agregar otro mantiene categoría, unidad, metros por rollo y mínimo; limpia SKU, nombre, descripción y stocks. Conserva validaciones y bloqueo de guardado duplicado.
- Cancelar o pulsar fuera del formulario pide confirmación solamente con cambios pendientes. Escape en la confirmación vuelve a editar. Recargar o cerrar la pestaña con modificaciones activa el aviso nativo del navegador.

## Revisión en pantalla pendiente

Usar una cuenta autorizada y materiales de prueba en QA.

1. Buscar un material con tildes sin escribirlas; invertir el orden de sus palabras. Buscar su SKU exacto y comprobar que aparece primero. Combinar categoría, estado y sede.
2. Abrir Nuevo SKU, cancelar sin escribir: debe cerrar sin aviso. Escribir datos, cancelar o pulsar fuera: elegir Seguir editando conserva los campos; Descartar cambios cierra.
3. Crear dos materiales con Guardar y agregar otro. Verificar valores conservados, campos limpios, foco en SKU y ausencia de duplicados. Probar SKU repetido y campos inválidos: no debe perder datos ni cerrar.
4. Editar stock, cancelar y seguir editando; luego descartar. Comprobar que la base no cambió. Guardar una modificación válida y comprobar stock por sede.
5. Probar confirmación con Tab, Shift+Tab y Escape; repetir en pantalla móvil. Recargar con cambios pendientes y cancelar la salida.

## Medición

Con la misma persona y datos equivalentes, medir en la versión anterior y QA: buscar un material, registrar tres materiales de la misma categoría y corregir stock. Anotar segundos, clics, correcciones y si completó sin ayuda. No se han medido todavía mejoras de tiempo ni satisfacción.

## Alcance

La protección implementada cubre cierre de los formularios de inventario y salida/recarga del navegador. No incluye un bloqueo general al cambiar de sección o cerrar sesión. No cambia la generación de SKU ni el buscador de secciones del encabezado.
