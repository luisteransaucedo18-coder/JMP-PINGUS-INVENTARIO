# Google Analytics 4

La aplicación usa el flujo web de JMP Pingus `G-ZKDSTJE4RD`. El identificador es público; no requiere una clave secreta ni una dependencia adicional.

La etiqueta `gtag.js` se carga una sola vez desde `src/main.tsx`. Solo se activa en builds de producción servidos en `jmpingus.com` o `www.jmpingus.com`; localhost y despliegues de vista previa quedan excluidos.

Se envía `page_view` al mostrar el acceso y cada sección del sistema, para todos los roles. Las ubicaciones son virtuales, por ejemplo `/app/dashboard` y `/app/sistemas`; no son nuevas rutas de navegación. Los eventos usan títulos estáticos y no incluyen nombres, correos, identificadores de usuarios, contenido de tareas, parámetros de URL ni tokens de sesión. Las funciones publicitarias están desactivadas.

## Activación y comprobación

1. Publicar el build que contiene esta integración en el dominio de producción.
2. En Analytics, abrir Administrar → Flujos de datos → JMPINGUS → Medición mejorada. Desactivar las vistas de página basadas en cambios del historial, porque la aplicación envía sus propias vistas. Desactivar también la medición de formularios y las demás mediciones automáticas que no se necesiten en este sistema interno.
3. Usar **Test installation / Probar instalación** en la pantalla de la etiqueta de Google, con `https://www.jmpingus.com`.
4. Visitar el sitio publicado con un navegador que permita Analytics y revisar **Informes → Tiempo real**. Al cambiar de sección deben aparecer sus visitas, sin duplicados.
5. Si no aparecen datos, comprobar que se descargue `https://www.googletagmanager.com/gtag/js?id=G-ZKDSTJE4RD` y que las solicitudes `g/collect` no estén bloqueadas por extensiones o por una política del navegador.

Las pruebas locales verifican la inicialización única, la exclusión de desarrollo y vistas previas, la navegación, los duplicados y los parámetros enviados. No acreditan recepción en la propiedad de Google: esa comprobación requiere el despliegue y el informe de Tiempo real.

Referencias oficiales: [vistas de página](https://developers.google.com/analytics/devguides/collection/ga4/views), [aplicaciones de una sola página](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).

## Comparar interacción entre módulos

El código envía `module_id` (por ejemplo `sistemas`, `inventario`, `dashboard`) y `user_role` (rol general, sin identificar a la persona). Cada sección sigue generando una sola visita `page_view` al entrar. Además actualiza el contexto global de la etiqueta para atribuir la medición automática de engagement de Google a la sección actual.

El evento `module_interaction` cuenta estas interacciones dentro del contenido del módulo, excluyendo el menú lateral y la cabecera general:

| `interaction_type` | Qué cuenta |
|---|---|
| `button_click` | Activación de un botón, incluyendo acciones por teclado. |
| `link_click` | Activación de un enlace. No se envía su dirección ni su texto. |
| `field_change` | Cambios en selectores, casillas, opciones, archivos y fechas. No se envía su valor. |
| `form_submit` | Intento de envío de un formulario; no acredita una operación guardada. |

No se registran pulsaciones de teclas ni cambios por carácter en campos de texto. Una misma acción puede producir un clic y un envío: son dos interacciones distintas, no dos operaciones completadas. No marcar este evento genérico como evento clave, para no convertir todos los clics en conversiones.

### Configurar la propiedad de Analytics

Después de publicar estos cambios:

1. Ir a **Administrar → Visualización de datos → Definiciones personalizadas → Crear dimensión personalizada**.
2. Crear estas tres dimensiones con ámbito **Evento**:

   | Nombre visible | Parámetro de evento |
   |---|---|
   | Módulo del sistema | `module_id` |
   | Rol del sistema | `user_role` |
   | Tipo de interacción | `interaction_type` |

3. En **Explorar → Formato libre**, importar las dimensiones anteriores y **Nombre del evento**, más las métricas **Número de eventos** y **Usuarios activos**.
4. Poner **Módulo del sistema** en Filas; las dos métricas en Valores; filtrar **Nombre del evento coincide exactamente con `module_interaction`**. Ordenar Número de eventos de mayor a menor. Se obtiene el ranking de interacción. Usar Rol del sistema como columna o filtro para comparar roles.
5. Para visitas y tiempo, usar **Informes → Interacción → Páginas y pantallas** (la ubicación depende de las colecciones publicadas), con **Ruta de página y clase de pantalla**. Comparar `/app/sistemas`, `/app/inventario`, etc., por Vistas, Usuarios activos y Tiempo de interacción medio. Si el informe no aparece, publicarlo desde la Biblioteca de informes con permisos de edición.
6. En **Tiempo real**, revisar que llegue `module_interaction` al usar botones y selectores. Las dimensiones personalizadas nuevas pueden tardar 24–48 horas en estar disponibles para informes y no se aplican retroactivamente a datos anteriores.

El tiempo de interacción corresponde a la página en primer plano, no a una medida de productividad. Los usuarios de GA4 representan identidades del navegador/dispositivo según la configuración de la propiedad, no un directorio de empleados. Los clics y el tiempo deben interpretarse junto con el número de usuarios y las visitas; más clics también pueden indicar dificultad de uso.

Referencias: [parámetros y dimensiones personalizadas](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters), [Páginas y pantallas](https://support.google.com/analytics/answer/12926732).
