# Auditoría de formularios y validaciones — 06/10/2026

## Alcance y resultado

Revisión de todos los `input` y `textarea` de `src`, componentes numéricos, manejadores de guardado, servicios de persistencia y migraciones relacionadas. Se corrigieron formularios de cotizaciones/proyectos, inventario, compras, entregas, devoluciones, transporte, usuarios y perfil; también límites de observaciones de requerimientos y correo de ingreso. Las búsquedas conservan entrada libre.

Las correcciones están en el código local. La migración `20261006132816_validar_campos_formularios.sql` se aplicó al proyecto Supabase configurado en `.env`. Se verificaron 11 triggers activos; la función usa `SECURITY INVOKER`, `search_path` vacío y no tiene ejecución directa para usuarios autenticados. No se desplegó el frontend.

## Reglas

| Campo | Validación |
|---|---|
| Nombre de proyecto | Obligatorio, máximo 100 caracteres, contador visible. Se valida al avanzar, guardar y persistir el proyecto o su copia en la cotización. |
| Nombre de plantilla | Máximo 100 caracteres. |
| Cliente, responsable, técnico, nombre de usuario/material y textos breves | Máximo 150 caracteres. Se permiten tildes, espacios, signos y números cuando tienen sentido, como «Proyecto 2026». |
| Dirección de proyecto | Máximo 300 caracteres. |
| SKU / unidad cotizada | Máximo 50 / 20 caracteres. Los códigos pueden ser alfanuméricos. |
| Observaciones, motivo y textos extensos | Máximo 1000 caracteres. |
| DNI de entrega | Opcional; si se informa, exactamente 8 dígitos. Se conservan ceros iniciales. |
| Correo | Formato con usuario, dominio y extensión; máximo 254 caracteres. |
| Teléfono | Entre 7 y 15 dígitos, permitiendo prefijo +, espacios, paréntesis y guiones. |
| Cantidades, stock, mínimos e importes | Números finitos, positivos o no negativos según el campo y con límites superiores. Se rechazan letras, exponentes escritos y signos negativos en el control numérico. |
| Unidades enteras de compra | Cantidades enteras positivas; no se truncan decimales. |
| Entregas/devoluciones/transporte | Entrada decimal para MTS y GLD; entrada entera para las otras unidades. Se conservan los límites de disponibilidad/solicitud. |
| Porcentajes | Entre 0 y 100; financiamiento hasta 120 meses. |
| Fechas, archivos y contraseñas | Conservan sus controles específicos; no se les aplica una regla genérica de nombres. |

## Correcciones relevantes

- Sustitución del análisis parcial con `parseInt`/`parseFloat`: una cadena inválida no se convierte en su prefijo numérico.
- Cantidades de entrega en metros conservan sus decimales.
- Los servicios rechazan textos demasiado largos y números no válidos antes de solicitar persistencia. Devoluciones valida cantidades antes de cargar evidencias.
- El precio de compra igual a cero se conserva como cero en vez de convertirse en un valor ausente.
- El correo de usuarios se valida con dominio y se compara con el correo registrado después de quitar espacios exteriores.
- Las comprobaciones de base de datos se ejecutan sobre campos nuevos o modificados; los datos históricos no se recortan ni reescriben. Se encontraron cero nombres de proyectos remotos superiores a 100 caracteres.

## Comprobaciones

- `npm run build` y `npm run typecheck`: correctos. Persiste la advertencia de tamaño del paquete principal de Vite.
- `npm test`: 67 pruebas, 66 correctas y una omitida de concurrencia real entre dos conexiones PostgreSQL. Las nuevas pruebas cubren 100/101 caracteres, tipos incorrectos, DNI con ceros iniciales, correos/teléfonos, entrada numérica y validación SQL bajo rol autenticado.
- `npm run audit:consistencia`: 83 archivos inspeccionados; sin reglas CSS exactamente duplicadas, declaraciones repetidas ni archivos vacíos. Hay 10 selectores repetidos y clases candidatas sin referencia estática; esto no prueba que sean errores o código muerto.
- No se ejecutó una prueba visual de todos los formularios con una sesión autenticada ni se hicieron escrituras de prueba en producción.

## Hallazgos adicionales pendientes

1. `npm audit --json` reporta una dependencia transitiva de severidad alta: `source-map-js` 1.2.1. El aviso recomienda 1.2.2 o posterior por denegación de servicio al procesar mapas de código maliciosos. No se actualizó la dependencia dentro de esta corrección de formularios. Referencia: https://github.com/advisories/GHSA-68fv-2mgg-jv7q.
2. Supabase mantiene 15 avisos previos de funciones `SECURITY DEFINER` ejecutables por autenticados. Requieren revisar autorización función por función: no equivalen a 15 vulnerabilidades demostradas. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.
3. La protección de Supabase Auth contra contraseñas filtradas está desactivada. Referencia: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
4. Dos tablas privadas de ubicación tienen RLS sin políticas: acceso directo cerrado por defecto. Es un aviso informativo, no motivo para abrirlas. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

Los avisos de Supabase se comprobaron antes y después de aplicar la migración y no aumentaron. Esta auditoría concentra las correcciones en tipos y límites de entrada; los hallazgos adicionales no constituyen una certificación completa de seguridad.
