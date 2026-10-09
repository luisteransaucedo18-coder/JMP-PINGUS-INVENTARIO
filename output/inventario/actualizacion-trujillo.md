# Conteo físico de Trujillo: revisión e incorporación

El archivo `conteo-trujillo-borrador.json` transcribe las tres páginas del PDF. Es un borrador de extracción, no un payload de actualización. La sede procede de lo indicado por el usuario: el formulario no completa el centro de operaciones. La fecha real de conteo no está identificada en el documento.

## Interpretación del JSON

- `descripcion_transcrita`: descripción del documento, con espacios y separadores de medidas normalizados. No es una propuesta de renombrar el catálogo.
- `codigo_documento`: referencia impresa conservada como texto. En página 1 parece un código de catálogo; en página 3 son números de renglón. Ninguno se ha validado contra Supabase.
- `cantidad_original`: anotación numérica o mixta transcrita; `null` si está vacía.
- `cantidad_leida`: lectura numérica cuando es suficientemente clara. No significa que esté aprobada para importar ni que pertenezca a la unidad de la BD.
- `cantidad_lectura_propuesta`: interpretación tentativa de una cifra dudosa; exige revisión visual o confirmación del responsable.
- `desglose`: rollos y metros sueltos separados. Las longitudes nominales de la descripción son hipótesis de conversión hasta confirmar rollos completos y unidad del SKU.
- `material_sku` y `cantidad_importar`: permanecen `null` hasta completar la conciliación.
- `pagina`, `renglon` e `id_fuente`: permiten localizar cada observación. El renglón es el orden de transcripción; no siempre coincide con el número impreso.

Las casillas vacías no significan cero. Las tres hojas no se han sumado: existen descripciones similares, códigos distintos y una lista identificada como Rifeng. Unirlas sin validar marca, medida, rosca y tipo de accesorio podría duplicar cantidades o combinar materiales diferentes.

## Secuencia recomendada

1. Confirmar fecha/hora del conteo, significado de casillas vacías y relación entre las hojas (listas adicionales o recuentos repetidos). Resolver las cifras marcadas como dudosas y las longitudes de rollos.
2. Consultar el catálogo y el stock de Trujillo en modo lectura. Vincular referencias por SKU exacto cuando sea posible. Para el resto, proponer coincidencias de nombre, marca, medida y unidad que se revisen antes de aceptar. No crear un SKU a partir del número de renglón.
3. Producir una conciliación por SKU: stock actual, conteo físico validado, unidad, diferencia, referencia del PDF y acción propuesta. Separar material existente, material nuevo y casos pendientes. Una coincidencia ambigua debe quedar fuera del lote aplicable.
4. Si el conteo corresponde a una fecha anterior, conciliar movimientos posteriores al corte. Reemplazar el stock de hoy por un conteo antiguo ignoraría entregas, devoluciones o traslados posteriores. La diferencia debe representar un ajuste por conteo, no una compra o devolución ficticia.
5. Preparar una operación transaccional que afecte exclusivamente `inventario_sedes` para `sede = 'Trujillo'`. Validar autorización, SKU existentes, unidades y cantidades. Registrar lote, usuario, origen, stock anterior, stock nuevo y diferencia; bloquear las filas y detectar modificaciones desde la conciliación. Evitar reaplicar el mismo lote mediante una referencia única.
6. Revisar el resultado propuesto antes de aplicarlo. Aplicar cantidades confirmadas, verificar el resultado y comprobar que Chiclayo y Chimbote conservan sus valores. Retener el inventario anterior y la trazabilidad para una eventual corrección auditada.

PostgreSQL permite agrupar operaciones en una transacción para que todas se apliquen o ninguna si ocurre un error: [documentación oficial de transacciones](https://www.postgresql.org/docs/current/tutorial-transactions.html).

## Particularidad del sistema actual

En el código local, `actualizarMaterial` llama a `actualizar_material_con_inventario`. La migración de esa función exige valores para las tres sedes cuando se proporciona stock y los escribe juntos. Para una importación masiva de Trujillo conviene una operación específica de una sola sede, evitando reenviar valores de Chiclayo y Chimbote que podrían quedar desactualizados durante el proceso.

Esta observación se basa en `src/services/materialService.ts` y `supabase/migrations/20260930133738_guardar_material_atomico.sql`; todavía debe verificarse la definición vigente en la base remota. Antes de implementar el ajuste también debe comprobarse el contrato actual de movimientos y sus tipos admitidos. No inventar un tipo `AJUSTE` ni escribir SQL sobre una tabla de auditoría sin verificar su esquema.

No se consultó ni modificó la base remota. No se generó un script ejecutable de actualización, porque faltan conciliación, unidades y fecha de corte. No se modificó el PDF ni el código de la aplicación.
