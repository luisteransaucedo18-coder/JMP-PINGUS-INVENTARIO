# Catálogo de ubicación de Perú

Fuente: [Ubigeos INEI, Plataforma Nacional de Datos Abiertos](https://www.datosabiertos.gob.pe/dataset/datos-de-registros-de-nacidos-vivos/resource/573f433b-0d44-46e2-932e-14abb9757860).

Archivo: https://www.datosabiertos.gob.pe/sites/default/files/Lista_Ubigeos_INEI.csv

Publicación del recurso: 17 de septiembre de 2025. Consultado: 5 de octubre de 2026.

Contiene 25 departamentos (incluido Callao), 196 provincias y 1892 distritos con su código UBIGEO. Se conserva la jerarquía del CSV; se cambia la capitalización para mostrarla en los selectores y se usan los nombres de departamentos ya establecidos por la aplicación.

`peruUbigeo.json` es el catálogo del formulario. La migración `cotizacion_provincia_distrito_peru` contiene los mismos registros para validar el guardado. Al actualizar el catálogo deben actualizarse ambos mediante una nueva migración.

Los campos `excel.departamento`, `excel.provincia` y `excel.distrito` quedan separados y se conservan en cotizaciones y plantillas. `ciudad` sigue almacenando el distrito como valor de compatibilidad para los procesos existentes. Los presupuestos históricos sin los nuevos campos conservan la validación anterior; el editor solo infiere el distrito cuando su nombre identifica una provincia de manera unívoca.
