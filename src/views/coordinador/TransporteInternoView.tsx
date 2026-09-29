import { useEffect, useRef, useState } from "react"
import { useAppStore } from "../../store/AppContext"
import {
  SEDES_TRANSPORTE,
  ESTADOS_TRANSPORTE,
  cargarTransporte,
  crearTransporte,
  operarTransporte,
  adjuntarTransporte,
  abrirArchivoTransporte,
  validarArchivo,
  validarCantidad,
  admiteDecimales,
  mensajeTransporte,
} from "../../service/transporteService"
import type {
  Transporte,
  TransporteItem,
  MaterialTransporte,
  DatosTransporte,
  TransporteArchivo,
} from "../../service/transporteService"
import "./TransporteInternoView.css"
const labelEstado = (estado: string) =>
  estado.replace(/_/g, " ").replace("TRANSITO", "TRÁNSITO")
const fechaLocal = () => new Date().toLocaleDateString("en-CA")
const inicial = (): DatosTransporte => ({
  destino: "",
  fecha_envio: fechaLocal(),
  observaciones: "",
  transportista: "",
  guia: "",
  costo: 0,
  moneda: "PEN",
  numero_comprobante: "",
  fecha_comprobante: "",
})
export default function TransporteInternoView({
  onToast,
}: {
  onToast: (message: string) => void
}) {
  const { refreshRemoteData } = useAppStore()
  const [sede, setSede] = useState("")
  const [traslados, setTraslados] = useState<Transporte[]>([])
  const [materiales, setMateriales] = useState<MaterialTransporte[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [estado, setEstado] = useState("")
  const [filtroSede, setFiltroSede] = useState("")
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [datos, setDatos] = useState(inicial)
  const [items, setItems] = useState<{
    material_sku: string
    cantidad: number
  }[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [factura, setFactura] = useState<File | null>(null)
  const [borradorId, setBorradorId] = useState(() => crypto.randomUUID())
  const [nota, setNota] = useState("")
  const [recepcion, setRecepcion] = useState<TransporteItem[]>([])
  const [enlace, setEnlace] = useState<{ url: string; nombre: string } | null>(
    null,
  )
  const seleccionado = traslados.find((t) => t.id === seleccion)
  async function cargar() {
    const result = await cargarTransporte()
    setSede(result.sede)
    setTraslados(result.traslados)
    setMateriales(result.materiales)
  }
  useEffect(() => {
    let active = true
    cargarTransporte()
      .then((r) => {
        if (active) {
          setSede(r.sede)
          setTraslados(r.traslados)
          setMateriales(r.materiales)
        }
      })
      .catch((e) => {
        if (active) setError(mensajeTransporte(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    setNota("")
    setEnlace(null)
    setRecepcion(
      seleccionado?.traslado_items.map((i) => ({
        ...i,
        cantidad: Number(i.cantidad),
        recibida: Number(i.recibida),
        aceptada: Number(i.aceptada),
        danada: Number(i.danada),
      })) ?? [],
    )
  }, [seleccionado])
  async function ejecutar(action: () => Promise<void>, message: string) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    setSuccess("")
    setEnlace(null)
    try {
      await action()
      setSuccess(message)
      onToast(message)
    } catch (e) {
      setError(mensajeTransporte(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function actualizar() {
    await cargar()
    await refreshRemoteData()
  }
  async function guardar() {
    if (!items.length) throw new Error("Selecciona al menos un material.")
    for (const i of items) {
      const m = materiales.find((m) => m.sku === i.material_sku)
      if (!m || !validarCantidad(i.cantidad, m.unidad, m.stock))
        throw new Error(
          `Cantidad inválida o stock insuficiente: ${m?.nombre ?? i.material_sku}.`,
        )
    }
    if (factura) await validarArchivo(factura)
    await crearTransporte(borradorId, datos, items)
    // El borrador queda recuperable aun si Storage falla; nunca se vuelve a crear con otro UUID al reintentar.
    setNuevo(false)
    setSeleccion(borradorId)
    try {
      if (factura) await adjuntarTransporte(borradorId, "COMPROBANTE", factura)
    } finally {
      await actualizar()
    }
  }
  function empezar() {
    setBorradorId(crypto.randomUUID())
    setDatos(inicial())
    setItems([])
    setFactura(null)
    setBusqueda("")
    setNuevo(true)
    setSeleccion(null)
    setError("")
    setSuccess("")
  }
  async function accion(tipo: string) {
    if (!seleccionado) return
    if (["RECIBIR", "RESOLVER"].includes(tipo)) {
      for (const i of recepcion)
        if (
          !validarCantidad(i.recibida, i.unidad, i.cantidad, true) ||
          !validarCantidad(i.danada, i.unidad, i.recibida, true)
        )
          throw new Error(`Revisa las cantidades de ${i.nombre}.`)
    }
    await operarTransporte(seleccionado.id, tipo, nota, recepcion)
    await actualizar()
  }
  function cantidadRecepcion(
    sku: string,
    campo: "recibida" | "danada",
    value: number,
  ) {
    setRecepcion((prev) =>
      prev.map((i) => {
        if (i.material_sku !== sku) return i
        const updated = { ...i, [campo]: value }
        return {
          ...updated,
          aceptada: Number((updated.recibida - updated.danada).toFixed(3)),
        }
      }),
    )
  }
  async function verArchivo(archivo: TransporteArchivo, descargar: boolean) {
    setEnlace({
      url: await abrirArchivoTransporte(archivo, descargar),
      nombre: archivo.nombre,
    })
  }
  const visibles = traslados.filter(
    (t) =>
      (!estado || t.estado === estado) &&
      (!filtroSede || t.origen === filtroSede || t.destino === filtroSede),
  )
  const origen = seleccionado?.origen === sede
  const puedeRecibir =
    seleccionado?.destino === sede &&
    !seleccionado.reversion_solicitada &&
    (seleccionado.estado === "EN_TRANSITO" ||
      (seleccionado.estado === "INCIDENCIA" && !!seleccionado.recibido_at))
  return (
    <section className="transporte-view" aria-busy={busy || loading}>
      <div className="transporte-heading">
        <div>
          <h2>Transporte interno de mercadería</h2>
          <p>
            {sede
              ? `Coordinación · ${sede}`
              : "Envíos entre Chiclayo, Chimbote y Trujillo"}
          </p>
        </div>
        <div className="transporte-actions">
          <button
            className="btn btn-ghost"
            disabled={busy || loading}
            onClick={() => void ejecutar(actualizar, "Datos actualizados")}
          >
            Actualizar
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !sede}
            onClick={empezar}
          >
            Nuevo traslado
          </button>
        </div>
      </div>
      {error && (
        <div className="transporte-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <p className="transporte-success" role="status">
          {success}
        </p>
      )}
      {(loading || busy) && (
        <p role="status">
          {loading
            ? "Cargando traslados e inventario…"
            : "Procesando; espera antes de realizar otra acción…"}
        </p>
      )}
      {nuevo ? (
        <form
          className="panel transporte-panel"
          onSubmit={(e) => {
            e.preventDefault()
            void ejecutar(guardar, "Borrador guardado")
          }}
        >
          <h3>Nuevo traslado</h3>
          <p>
            El borrador no reserva ni descuenta existencias. El stock se valida
            nuevamente al despachar.
          </p>
          <fieldset disabled={busy} className="transporte-fields">
            <label>
              Origen
              <input value={sede} readOnly />
            </label>
            <label>
              Destino
              <select
                required
                value={datos.destino}
                onChange={(e) =>
                  setDatos({ ...datos, destino: e.target.value })
                }
              >
                <option value="">Selecciona una sede</option>
                {SEDES_TRANSPORTE.filter((s) => s !== sede).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha de envío
              <input
                required
                type="date"
                value={datos.fecha_envio}
                onChange={(e) =>
                  setDatos({ ...datos, fecha_envio: e.target.value })
                }
              />
            </label>
            <label>
              Transportista
              <input
                value={datos.transportista}
                onChange={(e) =>
                  setDatos({ ...datos, transportista: e.target.value })
                }
              />
            </label>
            <label>
              Número de guía
              <input
                value={datos.guia}
                onChange={(e) => setDatos({ ...datos, guia: e.target.value })}
              />
            </label>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Materiales del inventario</legend>
            <label>
              Buscar por nombre o SKU
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar material…"
              />
            </label>
            {busqueda.trim() && (
              <ul className="transporte-results">
                {materiales
                  .filter(
                    (m) =>
                      `${m.nombre} ${m.sku}`
                        .toLowerCase()
                        .includes(busqueda.toLowerCase()) &&
                      !items.some((i) => i.material_sku === m.sku),
                  )
                  .slice(0, 30)
                  .map((m) => (
                    <li key={m.sku}>
                      <button
                        type="button"
                        disabled={m.stock <= 0}
                        onClick={() => {
                          setItems([
                            ...items,
                            {
                              material_sku: m.sku,
                              cantidad: Math.min(1, m.stock),
                            },
                          ])
                          setBusqueda("")
                        }}
                      >
                        {m.nombre} · {m.sku} · {m.stock} {m.unidad} disponibles
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <div className="transporte-table">
              <table>
                <thead>
                  <tr>
                    <th>Material / SKU</th>
                    <th>Disponible</th>
                    <th>Cantidad solicitada</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const m = materiales.find((m) => m.sku === i.material_sku)!
                    return (
                      <tr key={i.material_sku}>
                        <td>
                          {m.nombre}
                          <small>
                            {m.sku} · {m.unidad}
                          </small>
                        </td>
                        <td>{m.stock}</td>
                        <td>
                          <input
                            aria-label={`Cantidad de ${m.nombre}`}
                            required
                            type="number"
                            min={admiteDecimales(m.unidad) ? 0.001 : 1}
                            max={m.stock}
                            step={admiteDecimales(m.unidad) ? 0.001 : 1}
                            value={Number.isNaN(i.cantidad) ? "" : i.cantidad}
                            onChange={(e) =>
                              setItems(
                                items.map((item) =>
                                  item.material_sku === i.material_sku
                                    ? {
                                        ...item,
                                        cantidad: e.target.valueAsNumber,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            aria-label={`Quitar ${m.nombre}`}
                            onClick={() =>
                              setItems(
                                items.filter(
                                  (item) =>
                                    item.material_sku !== i.material_sku,
                                ),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!items.length && (
              <p>Busca y selecciona los materiales que enviarás.</p>
            )}
          </fieldset>
          <fieldset disabled={busy} className="transporte-fields">
            <legend>Costo del transporte</legend>
            <label>
              Costo de envío
              <input
                required
                type="number"
                min="0"
                max="999999999999.99"
                step="0.01"
                value={Number.isNaN(datos.costo) ? "" : datos.costo}
                onChange={(e) =>
                  setDatos({ ...datos, costo: e.target.valueAsNumber })
                }
              />
            </label>
            <label>
              Moneda
              <select
                value={datos.moneda}
                onChange={(e) => setDatos({ ...datos, moneda: e.target.value })}
              >
                <option>PEN</option>
                <option>USD</option>
              </select>
            </label>
            <label>
              Número de comprobante
              <input
                required={datos.costo > 0}
                value={datos.numero_comprobante}
                onChange={(e) =>
                  setDatos({ ...datos, numero_comprobante: e.target.value })
                }
              />
            </label>
            <label>
              Fecha del comprobante
              <input
                required={datos.costo > 0}
                type="date"
                value={datos.fecha_comprobante}
                onChange={(e) =>
                  setDatos({ ...datos, fecha_comprobante: e.target.value })
                }
              />
            </label>
            <label>
              Factura o comprobante
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFactura(null)
                  if (f)
                    void validarArchivo(f)
                      .then(() => {
                        setFactura(f)
                        setError("")
                      })
                      .catch((err) => {
                        e.target.value = ""
                        setError(mensajeTransporte(err))
                      })
                }}
              />
              <small>
                PDF, JPG, PNG o WebP · hasta 10 MB. Obligatorio antes del
                despacho si hay costo.
              </small>
            </label>
          </fieldset>
          <label>
            Observaciones
            <textarea
              value={datos.observaciones}
              disabled={busy}
              onChange={(e) =>
                setDatos({ ...datos, observaciones: e.target.value })
              }
            />
          </label>
          <p>
            El comprobante acredita el transporte; no cambia el valor de los
            materiales.
          </p>
          <div className="transporte-actions">
            <button className="btn btn-primary" disabled={busy} type="submit">
              Guardar borrador
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              type="button"
              onClick={() => setNuevo(false)}
            >
              Volver al listado
            </button>
          </div>
        </form>
      ) : seleccionado ? (
        <div className="panel transporte-panel">
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setSeleccion(null)}
          >
            ← Volver al listado
          </button>
          <div className="transporte-heading">
            <div>
              <h3>
                {seleccionado.origen} → {seleccionado.destino}
              </h3>
              <small>Traslado {seleccionado.id}</small>
            </div>
            <span className={`transporte-status estado-${seleccionado.estado}`}>
              {labelEstado(seleccionado.estado)}
            </span>
          </div>
          <dl className="transporte-fields">
            <div>
              <dt>Envío</dt>
              <dd>{seleccionado.fecha_envio}</dd>
            </div>
            <div>
              <dt>Transportista / guía</dt>
              <dd>
                {seleccionado.transportista || "Sin transportista"} ·{" "}
                {seleccionado.guia || "Sin guía"}
              </dd>
            </div>
            <div>
              <dt>Costo</dt>
              <dd>
                {seleccionado.moneda} {Number(seleccionado.costo).toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Comprobante</dt>
              <dd>
                {seleccionado.numero_comprobante || "Sin número"} ·{" "}
                {seleccionado.fecha_comprobante || "Sin fecha"}
              </dd>
            </div>
          </dl>
          <p>{seleccionado.observaciones || "Sin observaciones"}</p>
          <div className="transporte-table">
            <table>
              <thead>
                <tr>
                  <th>Material / SKU</th>
                  <th>Enviado</th>
                  <th>Recibido físico</th>
                  <th>Dañado / rechazado</th>
                  <th>Aceptado</th>
                  <th>Faltante</th>
                </tr>
              </thead>
              <tbody>
                {recepcion.map((i) => (
                  <tr key={i.material_sku}>
                    <td>
                      {i.nombre}
                      <small>
                        {i.material_sku} · {i.unidad}
                      </small>
                    </td>
                    <td>{i.cantidad}</td>
                    <td>
                      {puedeRecibir ? (
                        <input
                          disabled={busy}
                          aria-label={`Recibido ${i.nombre}`}
                          type="number"
                          min="0"
                          max={i.cantidad}
                          step={admiteDecimales(i.unidad) ? 0.001 : 1}
                          value={Number.isNaN(i.recibida) ? "" : i.recibida}
                          onChange={(e) =>
                            cantidadRecepcion(
                              i.material_sku,
                              "recibida",
                              e.target.valueAsNumber,
                            )
                          }
                        />
                      ) : (
                        i.recibida
                      )}
                    </td>
                    <td>
                      {puedeRecibir ? (
                        <input
                          disabled={busy}
                          aria-label={`Dañado ${i.nombre}`}
                          type="number"
                          min="0"
                          max={i.recibida}
                          step={admiteDecimales(i.unidad) ? 0.001 : 1}
                          value={Number.isNaN(i.danada) ? "" : i.danada}
                          onChange={(e) =>
                            cantidadRecepcion(
                              i.material_sku,
                              "danada",
                              e.target.valueAsNumber,
                            )
                          }
                        />
                      ) : (
                        i.danada
                      )}
                    </td>
                    <td>{Number.isFinite(i.aceptada) ? i.aceptada : "—"}</td>
                    <td>
                      {Number.isFinite(i.recibida)
                        ? Number((i.cantidad - i.recibida).toFixed(3))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {puedeRecibir && (
            <p>
              Ingresa cantidades acumuladas. Solo se agregan las unidades
              aceptadas nuevas. Al resolver, documenta el destino final de
              cualquier faltante o daño; no se ingresará al stock.
            </p>
          )}
          {seleccionado.traslado_incidencias.map((i) => (
            <div className="transporte-incidencia" key={i.id}>
              <strong>Incidencia</strong>
              <p>{i.observaciones}</p>
              <p>
                {i.resolucion
                  ? `Resolución: ${i.resolucion}`
                  : "Pendiente de resolución"}
              </p>
            </div>
          ))}
          {!["RECIBIDO", "CANCELADO"].includes(seleccionado.estado) && (
            <label>
              Observaciones de la operación / resolución
              <textarea
                disabled={busy}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Explica diferencias, resolución o motivo de cancelación. Para revertir, confirma el retorno físico completo."
              />
            </label>
          )}
          <div className="transporte-actions">
            {origen && seleccionado.estado === "BORRADOR" && (
              <>
                <button
                  disabled={busy}
                  className="btn btn-primary"
                  onClick={() =>
                    void ejecutar(
                      () => accion("DESPACHAR"),
                      "Despacho registrado",
                    )
                  }
                >
                  Confirmar salida
                </button>
                <button
                  disabled={busy}
                  className="btn btn-ghost"
                  onClick={() =>
                    void ejecutar(
                      () => accion("CANCELAR"),
                      "Borrador cancelado",
                    )
                  }
                >
                  Cancelar borrador
                </button>
              </>
            )}
            {puedeRecibir && (
              <button
                disabled={busy}
                className="btn btn-primary"
                onClick={() =>
                  void ejecutar(
                    () =>
                      accion(
                        seleccionado.estado === "EN_TRANSITO"
                          ? "RECIBIR"
                          : "RESOLVER",
                      ),
                    "Recepción o resolución registrada",
                  )
                }
              >
                {seleccionado.estado === "EN_TRANSITO"
                  ? "Confirmar recepción"
                  : "Resolver incidencia y cerrar"}
              </button>
            )}
            {origen &&
              ["EN_TRANSITO", "INCIDENCIA"].includes(seleccionado.estado) &&
              !seleccionado.reversion_solicitada &&
              seleccionado.traslado_items.every(
                (i) => Number(i.aceptada) === 0,
              ) && (
                <button
                  disabled={busy}
                  className="btn btn-ghost"
                  onClick={() =>
                    void ejecutar(
                      () => accion("SOLICITAR_REVERSION"),
                      "Retorno solicitado a destino",
                    )
                  }
                >
                  Solicitar retorno completo
                </button>
              )}
            {!origen &&
              seleccionado.estado === "INCIDENCIA" &&
              seleccionado.reversion_solicitada &&
              !seleccionado.reversion_autorizada && (
                <button
                  disabled={busy}
                  className="btn btn-primary"
                  onClick={() =>
                    void ejecutar(
                      () => accion("AUTORIZAR_REVERSION"),
                      "Retorno autorizado",
                    )
                  }
                >
                  Autorizar retorno a origen
                </button>
              )}
            {origen &&
              seleccionado.estado === "INCIDENCIA" &&
              seleccionado.reversion_autorizada && (
                <button
                  disabled={busy}
                  className="btn btn-primary"
                  onClick={() =>
                    void ejecutar(
                      () => accion("REVERTIR"),
                      "Retorno confirmado y stock restituido",
                    )
                  }
                >
                  Confirmar retorno físico completo
                </button>
              )}
          </div>
          <h3>Comprobantes y evidencias</h3>
          <ul className="transporte-files">
            {seleccionado.traslado_archivos.map((a) => (
              <li key={a.id}>
                <span>
                  {a.tipo}: {a.nombre}
                </span>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void ejecutar(
                      () => verArchivo(a, false),
                      "Enlace disponible durante 60 segundos",
                    )
                  }
                >
                  Visualizar
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    void ejecutar(
                      () => verArchivo(a, true),
                      "Descarga disponible durante 60 segundos",
                    )
                  }
                >
                  Descargar
                </button>
              </li>
            ))}
          </ul>
          {enlace && (
            <a
              className="btn btn-primary"
              href={enlace.url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir {enlace.nombre}
            </a>
          )}
          {((origen && seleccionado.estado === "BORRADOR") ||
            ["EN_TRANSITO", "INCIDENCIA"].includes(seleccionado.estado)) && (
            <label>
              Adjuntar{" "}
              {seleccionado.estado === "BORRADOR" ? "comprobante" : "evidencia"}
              <input
                disabled={busy}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file)
                    void ejecutar(async () => {
                      await adjuntarTransporte(
                        seleccionado.id,
                        seleccionado.estado === "BORRADOR"
                          ? "COMPROBANTE"
                          : "EVIDENCIA",
                        file,
                      )
                      await cargar()
                    }, "Archivo adjuntado")
                }}
              />
              <small>PDF, JPG, PNG o WebP · hasta 10 MB</small>
            </label>
          )}
          <h3>Línea de tiempo</h3>
          <ol className="transporte-timeline">
            {[...seleccionado.traslado_historial]
              .sort((a, b) => a.id - b.id)
              .map((h) => (
                <li key={h.id}>
                  <strong>{labelEstado(h.tipo)}</strong>
                  <span>
                    {h.usuario_nombre} ·{" "}
                    {new Date(h.created_at).toLocaleString("es-PE")}
                  </span>
                  {h.observaciones && <p>{h.observaciones}</p>}
                </li>
              ))}
          </ol>
        </div>
      ) : (
        <div className="panel transporte-panel">
          <div className="transporte-fields">
            <label>
              Estado
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {ESTADOS_TRANSPORTE.map((s) => (
                  <option key={s} value={s}>
                    {labelEstado(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sede involucrada
              <select
                value={filtroSede}
                onChange={(e) => setFiltroSede(e.target.value)}
              >
                <option value="">Todas las sedes</option>
                {SEDES_TRANSPORTE.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="transporte-table">
            <table>
              <thead>
                <tr>
                  <th>Traslado</th>
                  <th>Ruta</th>
                  <th>Fecha de envío</th>
                  <th>Estado</th>
                  <th>Costo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => (
                  <tr key={t.id}>
                    <td title={t.id}>{t.id.slice(0, 8).toUpperCase()}</td>
                    <td>
                      {t.origen} → {t.destino}
                    </td>
                    <td>{t.fecha_envio}</td>
                    <td>
                      <span className={`transporte-status estado-${t.estado}`}>
                        {labelEstado(t.estado)}
                      </span>
                    </td>
                    <td>
                      {t.moneda} {Number(t.costo).toFixed(2)}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => setSeleccion(t.id)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !visibles.length && (
            <p className="transporte-empty">
              {error
                ? "No se pudieron cargar los traslados. Usa Actualizar para reintentar."
                : "No hay traslados que coincidan con los filtros."}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
