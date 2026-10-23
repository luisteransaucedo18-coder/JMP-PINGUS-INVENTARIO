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

## Rediseño de Costos y servicios

- Búsqueda por nombre, grupo y referencia, limitada a la modalidad activa; las coincidencias se expanden automáticamente. Enter en la búsqueda no cambia de paso.
- Partidas del catálogo con cantidad y costo unitario en la misma fila. Se crea el gasto al ingresar un valor; las siguientes ediciones conservan el identificador, las cantidades y la descripción canónica del Excel.
- Subtotal y número de partidas incluidas por grupo; referencias y descripción completa bajo Ver referencia. Los grupos mantienen su estado al buscar y limpiar.
- Resumen de cantidad de partidas, gastos y costo directo junto al pie de navegación. Separadores principales azules y separadores de fila azul suave.
- Las partidas del catálogo ya no se repiten en Servicios y otros costos. Los gastos libres y las partidas heredadas de otras modalidades siguen disponibles para edición allí.
- Se conservan las cantidades iniciales por días en hospedaje, alimentación y altura. Seleccionar NO en muretes no borra gastos; se muestra una indicación para revisar su correspondencia.

Validación: pruebas de alta/edición sin duplicados, conservación de identidad y cantidades por días; suite y build del proyecto. Prueba visual aislada del componente real en navegador a escritorio y 390 px: búsqueda, escritura sin pérdida de foco, cantidad por costo, conservación al filtrar y quitar con subtotal en cero. Datos de prueba, sin guardar operaciones remotas. Falta revisar el flujo autenticado completo y medir tiempos con usuarios.

## Panel del analista orientado al trabajo pendiente

- Una acción principal fija en cabecera: + Nueva solicitud abre el formulario. Ver cotizaciones está siempre en Mis cotizaciones. Inventario permanece como acción secundaria; el formulario conserva el requisito de cotización aceptada para seleccionar materiales.
- Cuatro tarjetas con estados consistentes y navegación a Mis solicitudes con el filtro correspondiente.
- Lista de hasta seis solicitudes: rechazadas primero, borradores después y el resto por fecha. Cada fila abre su detalle; los borradores permiten Revisar y enviar, sin prometer edición no disponible.
- Estado vacío compacto que explica la necesidad de una cotización aceptada. Se elimina el resumen lateral duplicado y el segundo botón para crear solicitud. Ayuda queda en enlaces secundarios.
- La selección inicial del detalle vuelve a comprobar propiedad del registro. Los contadores y el resumen de cotizaciones solo consideran datos del usuario.

Verificación: pruebas de prioridad, propiedad, requisito de cotización, CTA único, estados de error e intención de navegación entre panel y lista. Revisión visual del componente real con datos locales de prueba: vacío y con pendientes, a escritorio y 390 px. Pendiente comprobar con sesión autenticada que el detalle y filtros recibidos se muestran con los datos reales.

## Consulta de inventario

- Sede y buscador antes de los indicadores; sede activa marcada visualmente y con aria-pressed. Cuatro indicadores compactos y existencias por unidad bajo un desplegable, sin sumar unidades incompatibles.
- Categorías con su nombre del catálogo; búsqueda por ese nombre conservando el identificador interno. Si no existe una correspondencia, se muestra Categoría y su identificador.
- Alerta general mantiene la clasificación por la peor sede; se muestran las sedes que originan ese estado y se conserva el detalle por sede. La explicación completa queda bajo Cómo se interpreta la alerta general.
- Páginas de 25 resultados, reiniciadas al cambiar filtros. Resumen del rango visible y controles Anterior/Siguiente; no cambia el conteo total filtrado.
- Búsqueda, categoría, estado, sede y datos técnicos se conservan por identificador de usuario en sessionStorage. No se guardan existencias; el almacenamiento bloqueado no impide filtrar.

Verificación: pruebas de reglas por sede, cantidades por unidad, búsqueda por nombre de categoría, paginación, filtros por usuario y almacenamiento inválido/bloqueado. Revisión de distribución con HTML generado desde el componente real y datos de prueba a escritorio y 390 px; esa vista no ejecuta operaciones remotas. Pendiente revisar interacciones con sesión autenticada.
