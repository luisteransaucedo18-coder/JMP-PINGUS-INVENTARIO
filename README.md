# JMP-PINGUS-INVENTARIO
## Políticas y Reglas de Negocio

Este documento define las **políticas, restricciones, permisos y reglas de negocio** que deben cumplirse dentro del sistema **JMP-PINGUS-INVENTARIO**.

Estas reglas deben considerarse tanto en el **frontend** como en el **backend y la base de datos**, evitando depender únicamente de validaciones visuales.

---

# 1. Objetivo del sistema

JMP-PINGUS-INVENTARIO es un sistema orientado a la gestión y control de:

- Inventario de materiales.
- Stock por sede.
- Proyectos.
- Requerimientos de materiales.
- Solicitudes de compra.
- Entregas.
- Devoluciones.
- Usuarios y roles.
- Evidencias.
- Trazabilidad de operaciones.

El sistema trabaja actualmente con las siguientes sedes:

- Chiclayo
- Chimbote
- Trujillo

---

# 2. Roles del sistema

El sistema contempla tres roles principales:

```text
GERENTE
ANALISTA
COORDINADOR
```

Cada usuario debe poseer un único rol activo y una sede asociada cuando corresponda.

Los permisos deben validarse por rol y no solamente ocultando elementos de la interfaz.

---

## 2.1. Gerente

El Gerente posee principalmente permisos de consulta y supervisión.

Puede:

- Consultar el dashboard ejecutivo.
- Consultar inventario.
- Visualizar stock por sede.
- Consultar proyectos.
- Consultar reportes.
- Revisar información consolidada.

El acceso al inventario del Gerente es principalmente de **solo lectura**.

No debe modificar directamente movimientos operativos de inventario que correspondan al Analista o Coordinador.

---

## 2.2. Analista

El Analista se encarga principalmente de las operaciones relacionadas con requerimientos, compras, entregas y devoluciones.

Puede:

- Consultar inventario.
- Crear requerimientos.
- Editar requerimientos permitidos.
- Enviar requerimientos.
- Solicitar compras.
- Registrar entregas según el flujo definido.
- Registrar devoluciones.
- Seleccionar proyectos existentes.
- Seleccionar materiales existentes.
- Adjuntar evidencias de devolución.

No puede aprobar sus propias solicitudes cuando dicha aprobación corresponda al Coordinador.

---

## 2.3. Coordinador

El Coordinador tiene funciones de validación y administración operativa.

Puede:

- Validar requerimientos.
- Confirmar o rechazar requerimientos.
- Gestionar el abastecimiento de requerimientos con faltante mediante compra o traslado interno.
- Administrar inventario.
- Gestionar usuarios según permisos.
- Gestionar entregas.
- Aprobar solicitudes de compra.
- Confirmar compras.
- Validar devoluciones.
- Registrar observaciones sobre devoluciones.

Las operaciones que modifican stock deben mantener trazabilidad del usuario responsable.

---

# 3. Autenticación y sesión

La autenticación del sistema se realiza mediante **Supabase Auth**.

El acceso debe realizarse mediante:

```text
correo + contraseña
```

Reglas:

1. El usuario debe estar autenticado para acceder a módulos privados.
2. Las credenciales inválidas deben impedir el acceso.
3. Un usuario inactivo no debe operar en el sistema.
4. Después del login debe identificarse el perfil del usuario.
5. El sistema debe obtener su rol y permisos.
6. Después de la pantalla de transición, el usuario debe ser dirigido al módulo correspondiente según su rol.
7. Al cerrar sesión deben eliminarse correctamente los datos locales de autenticación.
8. Después de cerrar sesión, el usuario debe poder iniciar sesión nuevamente sin errores.
9. Las rutas protegidas no deben poder abrirse directamente sin una sesión válida.

---

# 4. Usuarios

Cada usuario debe contar como mínimo con:

```text
Nombre
Correo
Rol
Sede
Estado
```

Estados permitidos:

```text
ACTIVO
INACTIVO
```

Reglas:

- Solo deben utilizarse roles registrados en el sistema.
- Solo deben utilizarse sedes válidas.
- Los usuarios inactivos no deben ejecutar operaciones protegidas.
- Los permisos de cada usuario se determinan según su rol.
- El sistema debe impedir operaciones para las que el usuario no tenga autorización.

---

# 5. Inventario

El inventario utiliza un catálogo central de materiales.

Cada material debe poseer información como:

```text
SKU
Nombre
Descripción
Categoría
Unidad
Marca
Stock por sede
Stock mínimo
Estado
Imagen
```

El **SKU identifica al material** dentro de las operaciones del sistema.

---

# 6. Stock por sede

El stock debe administrarse independientemente para:

```text
Chiclayo
Chimbote
Trujillo
```

Conceptualmente:

```text
Material
 ├── stock Chiclayo
 ├── stock Chimbote
 └── stock Trujillo
```

Una modificación del stock de Chiclayo no debe modificar automáticamente el stock de Chimbote o Trujillo.

Todo movimiento debe identificar la sede correspondiente.

---

# 7. Estados de materiales

Los estados permitidos son:

```text
OK
BAJO
CRÍTICO
AGOTADO
```

Los estados deben representar la situación del material respecto de su disponibilidad y stock mínimo.

El sistema debe mantener criterios uniformes para calcular o asignar estos estados.

---

# 8. Selección de materiales

En requerimientos, solicitudes de compra, devoluciones y demás operaciones que utilicen materiales existentes:

- Se debe buscar por nombre.
- Se debe buscar por código SKU.
- Se debe mostrar el SKU.
- Se debe mostrar el nombre.
- Se debe mostrar la categoría cuando corresponda.
- Se debe mostrar el estado.
- Se debe permitir visualizar información del material.
- El usuario debe seleccionar materiales existentes en el catálogo.

### Regla crítica

**No se puede crear un nuevo material desde un selector de materiales.**

El selector sirve exclusivamente para buscar y seleccionar registros existentes.

Cuando el usuario haga clic sobre el contenedor destinado a seleccionar materiales, debe abrirse o activarse el buscador correspondiente.

Si no existen coincidencias:

```text
No se encontraron materiales
```

---

# 9. Requerimientos

Estados permitidos:

```text
BORRADOR
ENVIADO
CONFIRMADO
RECHAZADO
```

Flujo general:

```text
BORRADOR
   ↓
ENVIADO
   ↓
CONFIRMADO
```

También puede producirse:

```text
ENVIADO
   ↓
RECHAZADO
```

---

## 9.1. Creación del requerimiento

El Analista puede crear un requerimiento seleccionando materiales existentes.

Cada línea debe mantener como mínimo:

```text
Material
SKU
Cantidad
```

El sistema debe validar:

- Material válido.
- Cantidad válida.
- Proyecto válido cuando corresponda.
- Sede correspondiente.
- Datos obligatorios completos.

---

## 9.2. Envío del requerimiento

Un requerimiento en estado:

```text
BORRADOR
```

puede enviarse para validación.

Al enviarse pasa a:

```text
ENVIADO
```

Una vez enviado, deben restringirse las modificaciones que puedan alterar información ya sometida a revisión.

---

## 9.3. Validación

El Coordinador puede revisar un requerimiento enviado.

Puede:

```text
CONFIRMAR
RECHAZAR
```

Cuando sea rechazado debe mantenerse la trazabilidad de la decisión y, cuando corresponda, su observación.

## 9.4. Requerimientos con stock insuficiente

La falta de stock no impide que el Analista envíe un requerimiento. Antes del envío se informa la disponibilidad y el faltante por material, pero el requerimiento puede pasar a `ENVIADO` para que el Coordinador defina el abastecimiento.

Al enviarlo, la base de datos registra el stock y faltante observados. Si hay faltantes, se crea una alerta persistente para los Coordinadores y el requerimiento permanece en `ENVIADO` hasta que se cubra su necesidad.

El Coordinador puede elegir una de estas rutas:

```text
COMPRA
TRASLADO INTERNO
```

La compra crea una orden vinculada al requerimiento solo por la cantidad faltante. El traslado solo se puede seleccionar desde una sede distinta que tenga existencias de al menos uno de los materiales faltantes. Si no hay stock en otra sede, la interfaz debe indicarlo y dirigir la gestión hacia compra; no debe permitir seleccionar una sede sin disponibilidad para luego mostrar un error evitable.

La confirmación se habilita únicamente cuando el stock actual de la sede solicitante cubre todos los materiales. Antes de descontar inventario, PostgreSQL debe validar y bloquear nuevamente las existencias de forma atómica.

---

# 10. Solicitudes de compra

Estados permitidos:

```text
BORRADOR
ENVIADO
APROBADO
COMPRADO
RECHAZADO
```

Flujo esperado:

```text
BORRADOR
   ↓
ENVIADO
   ↓
APROBADO
   ↓
COMPRADO
```

Flujo alternativo:

```text
ENVIADO
   ↓
RECHAZADO
```

---

## 10.1. Datos de una solicitud

Una solicitud puede contener:

```text
Sede
Analista
Fecha
Motivo
Observaciones
Materiales
Cantidades
Precio unitario
Stock actual
Estado
Coordinador
Fecha de aprobación
Fecha de compra
```

---

## 10.2. Materiales de compra

Los materiales deben seleccionarse del catálogo existente.

El usuario puede buscarlos mediante:

```text
Nombre
SKU
```

No debe utilizarse esta pantalla para registrar un material nuevo.

---

## 10.3. Aprobación

La aprobación corresponde al Coordinador.

El sistema debe registrar:

- Usuario que aprobó.
- Fecha de aprobación.
- Estado resultante.

Una solicitud rechazada debe conservar su historial y no debe desaparecer del sistema.

---

## 10.4. Confirmación de compra

La compra debe considerarse finalizada únicamente cuando haya sido confirmada según el flujo correspondiente.

La actualización del stock debe producirse sobre la sede asociada a la operación.

Ejemplo:

```text
Stock actual: 20
Compra confirmada: 15

Nuevo stock: 35
```

No debe incrementarse el stock simplemente por crear o enviar una solicitud.

---

## 10.5. Cancelación de órdenes de compra

Las órdenes que aún no han ingresado materiales al inventario se pueden cancelar por error operativo. En la interfaz, el estado y la acción deben mostrarse como:

```text
CANCELAR
CANCELADA
```

La cancelación requiere un motivo y conserva el registro para auditoría.

- El Analista creador puede cancelar una orden en `BORRADOR` o `ENVIADO`.
- El Coordinador puede cancelar una orden pendiente o aprobada si todavía no está `COMPRADO`.
- Una orden `COMPRADO` no se puede cancelar porque ya incrementó el stock de su sede.
- Si la orden proviene de un requerimiento con faltante, la ruta de abastecimiento vuelve a `PENDIENTE` para elegir una nueva compra o traslado.

---

## 10.6. Transporte interno de mercadería

El módulo de transporte interno registra materiales que se movilizan entre Chiclayo, Chimbote y Trujillo.

Solo el rol `COORDINADOR` puede acceder al módulo. El Coordinador de la sede de origen crea y despacha el traslado; el de destino confirma la recepción o registra una incidencia. Ambos consultan únicamente traslados que involucren su sede. Estas reglas se validan en la base de datos además de la interfaz.

Estados oficiales:

```text
BORRADOR → EN_TRANSITO → RECIBIDO
INCIDENCIA
CANCELADO
```

- `BORRADOR` no modifica stock.
- El despacho vuelve a validar stock y descuenta una sola vez en origen dentro de una operación atómica.
- La recepción incrementa únicamente las unidades aceptadas en destino, también de forma atómica.
- Faltantes o daños mantienen el traslado en `INCIDENCIA`; las unidades no aceptadas no ingresan al stock de destino.
- Un borrador se cancela sin movimiento. Si ya fue despachado, la reversión debe ser controlada y registrada antes de restituir el stock de origen.

Los comprobantes de transporte se almacenan en Supabase Storage, nunca como binarios en la base de datos. Solo se admiten PDF o imágenes autorizadas dentro del límite definido; el costo acredita el envío, pero no cambia el costo ni la cantidad del inventario.

---

# 11. Proyectos

Los proyectos utilizados en requerimientos, devoluciones u otros módulos deben provenir de registros existentes.

Reglas:

- El proyecto debe guardarse antes de continuar con operaciones dependientes.
- No debe permitirse continuar si el guardado del proyecto falla.
- Deben evitarse proyectos duplicados bajo las mismas credenciales o identificadores definidos por el negocio.
- Los clics repetidos en "Guardar" o "Crear proyecto" no deben generar registros duplicados.
- El botón debe bloquearse temporalmente mientras la operación se procesa.

---

# 12. Entregas

Estados permitidos:

```text
PENDIENTE
PARCIAL
COMPLETA
CANCELADA
```

Una entrega debe estar relacionada con la operación que la originó.

El sistema debe conservar:

- Material.
- Cantidad.
- Sede.
- Proyecto relacionado.
- Usuario responsable.
- Fecha.
- Estado.

Una entrega parcial no debe marcarse automáticamente como completa.

---

# 13. Devoluciones

El módulo de devoluciones es gestionado inicialmente por el **Analista**.

El objetivo es registrar materiales no utilizados y devolverlos al inventario correspondiente.

---

## 13.1. Registro de devolución

El Analista debe seleccionar:

```text
Proyecto
Material
SKU
Cantidad
Sede de devolución
Evidencia
```

El proyecto debe seleccionarse mediante su nombre a partir de proyectos existentes.

Los materiales deben buscarse mediante:

```text
Nombre
SKU
```

---

## 13.2. Evidencias

La devolución debe permitir adjuntar fotografías o evidencias del material no utilizado.

Las evidencias deben quedar relacionadas con la devolución correspondiente.

---

## 13.3. Procesamiento

Al registrar una devolución puede mostrarse un estado visual de procesamiento durante aproximadamente:

```text
3 – 5 segundos
```

Esto no reemplaza la confirmación real de la operación en la base de datos.

La interfaz no debe indicar éxito hasta recibir confirmación del backend.

---

## 13.4. Validación de devolución

Después del registro realizado por el Analista, el **Coordinador** debe revisar la devolución.

El Coordinador puede:

```text
VALIDAR
```

o registrar:

```text
OBSERVACIÓN
```

La devolución debe mantener la trazabilidad de quién realizó cada acción.

---

# 14. Actualización de stock por devolución

Una devolución validada debe incrementar el stock de la sede indicada.

Ejemplo:

```text
Material: MAT-001
Sede: Trujillo

Stock anterior: 15
Cantidad devuelta: 5

Stock nuevo: 20
```

Regla:

```text
stock_nuevo = stock_actual + cantidad_devuelta
```

La operación debe aplicarse únicamente a la sede correspondiente.

El sistema debe impedir que una misma devolución incremente el stock más de una vez.

---

# 15. Prevención de duplicados

Las operaciones críticas deben protegerse contra clics repetidos.

Esto aplica especialmente a:

- Crear proyecto.
- Crear requerimiento.
- Enviar requerimiento.
- Crear solicitud de compra.
- Aprobar solicitud.
- Confirmar compra.
- Registrar devolución.
- Validar devolución.

Mientras una operación esté siendo procesada, el botón correspondiente debe quedar temporalmente deshabilitado.

---

# 16. Limitación temporal de acciones

Las operaciones sensibles deben implementar mecanismos para impedir solicitudes repetitivas en intervalos muy cortos.

Especialmente:

- Consulta/envío de requerimientos.
- Creación de solicitudes de compra.
- Creación de proyectos.

El control debe aplicarse por usuario.

La validación no debe depender exclusivamente del frontend.

---

# 17. Integridad del stock

El stock nunca debe quedar en un estado inconsistente.

Antes de realizar una salida:

```text
cantidad_solicitada <= stock_disponible
```

Cuando corresponda una salida:

```text
stock_nuevo = stock_actual - cantidad
```

Cuando corresponda un ingreso:

```text
stock_nuevo = stock_actual + cantidad
```

El stock de una sede solo debe modificarse cuando la operación correspondiente haya sido confirmada.

---

# 18. Trazabilidad

Las operaciones importantes deben conservar información suficiente para identificar:

```text
Quién realizó la acción
Qué acción realizó
Cuándo la realizó
Sobre qué registro
Estado anterior
Estado nuevo
Sede
Observación, cuando corresponda
```

Esto aplica especialmente a:

- Requerimientos.
- Compras.
- Entregas.
- Devoluciones.
- Inventario.
- Proyectos.
- Usuarios.

---

# 19. Eliminación de información

Los registros que formen parte de operaciones históricas no deberían eliminarse físicamente si su eliminación rompe la trazabilidad.

Cuando corresponda, debe preferirse:

```text
ACTIVO → INACTIVO
```

o estados equivalentes.

Los registros históricos deben mantenerse disponibles para consultas y auditoría.

---

# 20. Generación de PDF

Los documentos PDF generados desde requerimientos deben utilizar el diseño oficial definido para el sistema.

La plantilla puede estar representada mediante JSON.

La plantilla base debe permanecer sin datos específicos del requerimiento.

Los campos se completarán dinámicamente utilizando la información de cada operación.

Conceptualmente:

```text
PLANTILLA JSON
      ↓
Datos del requerimiento
      ↓
Renderizado
      ↓
PDF final
```

No deben almacenarse datos específicos de un requerimiento directamente dentro de la plantilla base.

---

# 21. Seguridad

Las restricciones de seguridad deben implementarse tanto en frontend como en backend/base de datos.

No es suficiente:

```text
ocultar un botón
```

Debe existir también validación real de autorización.

Ejemplo:

```text
Frontend:
Coordinador → botón "Aprobar"

Backend:
¿Usuario autenticado?
¿Usuario activo?
¿Rol = coordinador?
¿Solicitud = ENVIADO?

Sí → ejecutar
No → rechazar
```

---

# 22. Reglas de Supabase

El sistema utiliza Supabase para persistencia y autenticación.

Las operaciones sensibles deben considerar políticas de acceso que permitan que cada rol interactúe únicamente con los recursos autorizados.

Cuando sea aplicable deben utilizarse políticas **RLS (Row Level Security)**.

Nunca se debe confiar en el rol enviado directamente desde el frontend como única fuente de autorización.

---

# 23. Estados oficiales del sistema

Para evitar inconsistencias entre frontend y base de datos, deben respetarse exactamente los siguientes valores.

### Material

```text
OK
BAJO
CRÍTICO
AGOTADO
```

### Requerimiento

```text
BORRADOR
ENVIADO
CONFIRMADO
RECHAZADO
```

### Usuario

```text
ACTIVO
INACTIVO
```

### Entrega

```text
PENDIENTE
PARCIAL
COMPLETA
CANCELADA
```

### Compra

```text
BORRADOR
ENVIADO
APROBADO
COMPRADO
RECHAZADO
```

No deben crearse variantes como:

```text
Confirmado
confirmado
APROBADA
Finalizado
COMPLETADO
```

si no forman parte del dominio oficial.

---

# 24. Reglas generales de interfaz

La interfaz debe:

- Mostrar estados de forma uniforme.
- Mantener los mismos nombres en todos los módulos.
- Evitar acciones duplicadas innecesarias.
- Mostrar mensajes claros de éxito y error.
- Indicar visualmente cuando una operación está procesándose.
- Deshabilitar acciones mientras una solicitud crítica está en curso.
- Mantener diseño responsive.
- No mostrar funciones que el rol actual no puede utilizar.
- Solicitar confirmación cuando una acción tenga consecuencias importantes.

---

# 25. Reglas de errores

Una operación fallida no debe mostrarse como exitosa.

Ejemplo incorrecto:

```text
Usuario hace clic
→ aparece "Proyecto creado"
→ Supabase falla
→ proyecto realmente no existe
```

Comportamiento esperado:

```text
Usuario hace clic
        ↓
Validación
        ↓
Solicitud a backend/Supabase
        ↓
¿Operación exitosa?
   ↙             ↘
 Sí               No
 ↓                 ↓
Confirmar        Mostrar error
```

---

# 26. Principios generales del negocio

Toda implementación nueva debe respetar los siguientes principios:

**Integridad:** ningún módulo debe generar inconsistencias en inventario.

**Trazabilidad:** las operaciones críticas deben poder rastrearse.

**Autorización:** cada rol ejecuta únicamente las acciones permitidas.

**Consistencia:** estados, sedes, roles y nombres deben mantenerse uniformes.

**No duplicidad:** una misma acción no debe ejecutarse múltiples veces accidentalmente.

**Validación:** ninguna operación crítica debe confiar únicamente en datos enviados por el frontend.

**Persistencia real:** una acción se considera exitosa únicamente después de ser confirmada por la base de datos.

**Stock por sede:** todo movimiento de materiales debe afectar únicamente la sede correspondiente.

**Historial:** las operaciones importantes deben conservarse para consulta y auditoría.

---

# 27. Resumen de permisos

| Funcionalidad | Gerente | Analista | Coordinador |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Consultar inventario | ✅ | ✅ | ✅ |
| Modificar inventario | ❌ | Limitado | ✅ |
| Crear requerimiento | ❌ | ✅ | ❌ |
| Enviar requerimiento | ❌ | ✅ | ❌ |
| Validar requerimiento | ❌ | ❌ | ✅ |
| Crear solicitud de compra | ❌ | ✅ | ❌ |
| Aprobar compra | ❌ | ❌ | ✅ |
| Cancelar compra pendiente o aprobada | ❌ | Propia, antes de aprobación | ✅ |
| Gestionar transporte interno | ❌ | ❌ | Solo traslados de su sede |
| Consultar proyectos | ✅ | ✅ | ✅ |
| Registrar entrega | ❌ | ✅ | ✅ |
| Registrar devolución | ❌ | ✅ | ❌ |
| Validar devolución | ❌ | ❌ | ✅ |
| Observar devolución | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ✅ |
| Consultar reportes | ✅ | Según permiso | ✅ |

---

# 28. Regla final

> Toda nueva funcionalidad implementada en JMP-PINGUS-INVENTARIO debe respetar estas reglas de negocio antes de modificar datos persistentes.

Cuando exista conflicto entre una acción disponible visualmente y los permisos definidos por el negocio, **prevalecen las reglas de negocio**.

---

# 29. Excepciones vigentes de acceso

Las siguientes diferencias entre el comportamiento actual de Supabase y la matriz de permisos quedan **documentadas y aceptadas temporalmente**. Esta sección no autoriza a corregirlas ni a ampliar o reducir permisos de forma implícita. No modificar políticas RLS, funciones RPC ni permisos relacionados sin una solicitud y aprobación explícitas.

## 29.1. Entregas

- Actualmente, las políticas de lectura permiten a un Analista consultar entregas e ítems de entrega que no pertenecen a sus requerimientos.
- La función `registrar_entrega` permite actualmente a un Analista registrar una entrega asociada a un requerimiento confirmado de otro usuario.
- Este comportamiento se conserva por decisión del proyecto. No cambiarlo como parte de otros trabajos ni asumir que la interfaz limita el acceso real.
- Cualquier cambio futuro requiere revisar conjuntamente la función RPC, RLS de `entregas` y RLS de `entrega_items`, y probar los roles involucrados antes de aplicarlo.

## 29.2. Transporte interno

- La interfaz ofrece al Gerente una vista de consulta de transporte, pero la política actual de la base de datos no le muestra traslados.
- Se conserva esta diferencia por decisión del proyecto. No ampliar la lectura del Gerente ni cambiar los permisos de escritura sin aprobación explícita.
- Cualquier cambio futuro debe validar por separado la lectura del Gerente y los permisos operativos del Coordinador.

Estas excepciones describen el estado vigente observado; no deben interpretarse como un modelo recomendado de seguridad. Al modificarlas, actualizar esta sección y la matriz de permisos para que reflejen la política aprobada.

---

## Stack relacionado

```text
Frontend
React + TypeScript + Vite

Backend / Servicios
Supabase

Base de datos
PostgreSQL

Autenticación
Supabase Auth

Almacenamiento
Supabase Storage
```

---

**Proyecto:** JMP-PINGUS-INVENTARIO  
**Documento:** Políticas y Reglas de Negocio  
**Versión:** 1.1  
**Última actualización:** 29/09/2026
