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

## Alertas compartidas del sistema

Los avisos generales de todos los módulos ahora usan una tarjeta central con icono, cierre y botón Entendido. Se encolan sin caducidad automática para que los errores no desaparezcan antes de leerlos. Los avisos sin tipo explícito usan tono informativo, sin asumir que la operación fue exitosa.

Descarte y entregas usan SystemAlert con acciones explícitas, foco en la opción de revisión, Escape y bloqueo durante operaciones pendientes. Compras, requerimientos y cotizaciones conservan sus formularios y resúmenes, con iconografía compartida para sus decisiones. Los errores contextuales conservan su ubicación y adoptan la paleta común.

Pendiente en pantalla: comprobar avisos de éxito y error de inventario, usuarios, perfil, solicitudes, proyectos, compras, transporte, devoluciones, valorizaciones y cotizaciones; probar dos mensajes seguidos; teclado y móvil; registro de entrega en curso no debe poder confirmarse dos veces ni cerrarse desde el aviso. El aviso nativo de recarga/cierre de pestaña depende del navegador y no se puede personalizar.

## Primera tarea pendiente: menos escritura

Compras y cotizaciones comparten MaterialAutocomplete. Muestra hasta ocho sugerencias desde el primer carácter o al enfocar el buscador; busca sin tildes, por palabras en cualquier orden, código o categoría. Cada resultado muestra nombre, código, categoría y unidad; en compras incluye stock de la sede elegida. Los materiales agregados se excluyen del listado. La selección conserva la identidad y datos del catálogo; no se permite inventar unidades o materiales desde el buscador.

Cotizaciones sigue cargando automáticamente unidad de inventario, unidad cotizada y costo referencial. Compras sigue obteniendo unidad y categoría desde el material seleccionado, sin pedir que se escriban; conserva la propuesta de cantidad por déficit. Los requerimientos continúan vinculados a las partidas aceptadas del proyecto, sin ampliar el catálogo permitido.

Revisión manual pendiente: seleccionar por clic y por flechas/Enter, descartar sugerencias con Escape, recorrer con Tab, probar una búsqueda sin resultados y agregar varios materiales. Confirmar que no aparecen duplicados ni se envía el formulario al elegir. Revisar en móvil el desplazamiento de sugerencias y el menú cerca del final de la página.

La mejora de búsqueda incluye controles de teclado propios del autocompletado. Las tareas posteriores siguen pendientes: persistencia de filtros y acciones cercanas, reducción de detalle visible y revisión general del teclado. Guardar y agregar otro ya estaba implementado.
