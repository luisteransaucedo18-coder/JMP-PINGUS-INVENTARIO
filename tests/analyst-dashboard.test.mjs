import assert from "node:assert/strict"

import { readFileSync } from "node:fs"

import { test } from "node:test"

import ts from "typescript"

import * as jsx from "react/jsx-runtime"

import { renderToStaticMarkup } from "react-dom/server"

const load = (path, require) => {
  const exports = {}
  const js = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText
  new Function("exports", "require", js)(exports, require)
  return exports
}

const owner = load("../src/utils/recordOwner.ts", () => {})

const model = load("../src/views/analista/dashboardModel.ts", () => owner)

const profile = { id: "analyst-1", nombre: "Ana" }

const req = (id, estado, fecha = "2026-10-23", analistaId = profile.id) => ({
  id,
  estado,
  fecha,
  analistaId,
  analista: "Ana",
  proyecto: `Proyecto ${id}`,
  materiales: [],
})

const quotes = [
  { creado_por: profile.id, estado: "ACEPTADA" },
  { creado_por: "other", estado: "ACEPTADA" },
]

test("prioriza rechazadas y borradores sin incluir registros de otro usuario", () => {
  const result = model.analystDashboardModel(
    [
      req("sent", "ENVIADO"),
      req("draft", "BORRADOR"),
      req("rejected", "RECHAZADO", "2026-10-20"),
      req("foreign", "BORRADOR", "2026-10-23", "other"),
    ],
    quotes,
    profile,
  )

  assert.deepEqual(
    result.rows.map((r) => r.id),
    ["rejected", "draft", "sent"],
  )

  assert.equal(result.pending, 2)
  assert.equal(result.counts.BORRADOR, 1)
  assert.equal(result.ownQuotes.length, 1)
})

test("crear solicitudes requiere una cotización propia aceptada", () => {
  assert.equal(model.analystDashboardModel([], quotes, profile).canCreate, true)

  assert.equal(
    model.analystDashboardModel([], quotes.slice(1), profile).canCreate,
    false,
  )

  assert.equal(
    model.analystDashboardModel(
      [],
      [{ creado_por: profile.id, estado: "CERRADA" }],
      profile,
    ).canCreate,
    false,
  )
})

function dashboard(requirements, currentQuotes, error = null) {
  const navigations = [],
    intents = []

  const { default: Dashboard } = load(
    "../src/views/analista/AnalystWorkspace.tsx",
    (name) => {
      if (name === "react") return { useState: () => [null, () => {}] }

      if (name === "react/jsx-runtime") return jsx

      if (name.endsWith("/UserProfileContext"))
        return { useUserProfile: () => ({ profile }) }

      if (name.endsWith("/AppContext"))
        return {
          useAppStore: () => ({
            state: {
              requerimientos: requirements,
              cotizaciones: currentQuotes,
              cotizacionesError: error,
            },
          }),
        }

      if (name.endsWith("/publicCode")) return { publicCode: (r) => r.id }

      if (name.endsWith("/AnalistaHelpCenter")) return { default: () => null }

      if (name === "./dashboardModel") return model

      throw new Error(name)
    },
  )

  return {
    tree: Dashboard({
      data: model.analystDashboardModel(requirements, currentQuotes, profile),
      quotesUnavailable: Boolean(error),
      onNav: (view) => navigations.push(view),
      onOpenRequests: (intent) => intents.push(intent),
    }),
    navigations,
    intents,
  }
}

function nodes(node, predicate) {
  if (!node || typeof node !== "object") return []
  return [
    ...(predicate(node) ? [node] : []),
    ...[node.props?.children]
      .flat(Infinity)
      .flatMap((child) => nodes(child, predicate)),
  ]
}

test("estado vacío ofrece un único CTA y explica la cotización pendiente", () => {
  const { tree } = dashboard([], [])
  const html = renderToStaticMarkup(tree)

  assert.match(html, /primero necesitas un proyecto/)

  assert.equal(
    nodes(
      tree,
      (n) => n.type === "button" && n.props.className === "btn btn-primary",
    ).length,
    1,
  )

  assert.doesNotMatch(html, /Crear primera solicitud|Estado de mis solicitudes/)
})

test("tarjetas y filas abren el filtro y detalle correctos", () => {
  const app = dashboard([req("R-1", "RECHAZADO")], quotes)

  nodes(
    app.tree,
    (n) => n.type === "button" && n.props["data-status"] === "ENVIADO",
  )[0].props.onClick()

  nodes(
    app.tree,
    (n) =>
      n.type === "button" &&
      n.props["aria-label"] === "Revisar observación: R-1",
  )[0].props.onClick()

  assert.deepEqual(app.intents, [
    { filter: "ENVIADO" },
    { id: "R-1", filter: "RECHAZADO" },
  ])
})

test("la cabecera mantiene Nueva solicitud y el aviso de cotizaciones no disponibles", () => {
  const app = dashboard([], quotes, "sin conexión")

  nodes(
    app.tree,
    (n) => n.type === "button" && n.props.className === "btn btn-primary",
  )[0].props.onClick()

  assert.deepEqual(app.navigations, ["nueva-solicitud"])

  assert.match(renderToStaticMarkup(app.tree), /No pudimos consultar/)
})

test("el router conserva filtro e identificador al pasar del panel a mis solicitudes", () => {
  let intent

  let view = "dashboard"

  const { default: Router } = load("../src/app/ViewRouter.tsx", (name) => {
    if (name === "react")
      return {
        useState: () => [
          intent,
          (value) => {
            intent = value
          },
        ],
        useEffect: () => {},
      }

    if (name === "react/jsx-runtime") return jsx

    if (name === "./navigation") return { canAccessView: () => true }

    return { default: () => null }
  })

  const props = {
    role: "analista",
    view,
    userName: "Ana",
    userEmail: "ana@example.test",
    onNav: (next) => {
      view = next
    },
    onToast: () => {},
    onStartTour: () => {},
  }

  const panel = Router(props)

  panel.props.onOpenRequests({ filter: "RECHAZADO", id: "R-1" })

  const list = Router({ ...props, view })

  assert.equal(view, "mis-solicitudes")

  assert.equal(list.props.initialFilter, "RECHAZADO")

  assert.equal(list.props.initialSelectedId, "R-1")
})

test("Ver cotizaciones está en su sección y Nueva solicitud siempre abre el formulario", () => {
  const app = dashboard([], []);
  const primary = nodes(app.tree, n => n.type === "button" && n.props.className === "btn btn-primary")[0];
  assert.equal(primary.props.children, "+ Nueva solicitud");
  primary.props.onClick();
  const section = nodes(app.tree, n => n.type === "section" && n.props["aria-labelledby"] === "analyst-quotes-title")[0];
  const button = nodes(section, n => n.type === "button")[0];
  button.props.onClick();
  assert.deepEqual(app.navigations, ["nueva-solicitud", "cotizaciones"]);
});
