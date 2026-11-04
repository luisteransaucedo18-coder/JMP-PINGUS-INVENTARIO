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
