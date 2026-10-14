import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import ts from "typescript"
const dir = "test-results/valorizaciones"
mkdirSync(dir, { recursive: true })
const url = (src) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString("base64")}`
const domain = url(
  readFileSync("src/features/valorizaciones/domain.ts", "utf8"),
)
// Report without photographs validates checklist pagination; image layout is tested with an actual JPEG below.
let source = readFileSync("src/features/valorizaciones/pdf.ts", "utf8")
  .replace(/(["'])pdf-lib\1/, JSON.stringify(import.meta.resolve("pdf-lib")))
  .replace(/(["'])\.\/domain\1/, JSON.stringify(domain))
source = source.replace(
  /import\s*\{[^}]*\bdownloadEvidence\b[^}]*\}\s*from\s*["'][^"']+["'];?/,
  'const downloadEvidence=async()=>new Blob([new Uint8Array(await import("node:fs").then(fs=>fs.readFileSync("test-results/valorizaciones/foto-qa.jpg")))]);',
)
const { valuationPdf, photographicReport } = await import(url(source))
const { CHECKLIST } = await import(domain)
const v = {
  codigo: "VAL-000001",
  etapa: "INTERNA",
  tipo: "FINAL",
  tecnico: "Técnico responsable",
  dni: "12345678",
  monto: 550,
  adelantos: 100,
  motivo: "",
  descuentos: [
    {
      nombre: "Tubería PEALPE",
      cantidad: 2,
      referencia: 10,
      monto: 25,
      motivo: "Material sobrante no devuelto",
    },
  ],
  checklist: Object.fromEntries(
    CHECKLIST.map(([id]) => [
      id,
      { estado: "CONFORME", nota: "Revisado por el analista responsable." },
    ]),
  ),
}
writeFileSync(
  `${dir}/valorizacion-qa.pdf`,
  new Uint8Array(
    await (
      await valuationPdf(v, "Instalación de gas en comercio de Piura")
    ).arrayBuffer(),
  ),
)
writeFileSync(
  `${dir}/reporte-qa.pdf`,
  new Uint8Array(
    await (
      await photographicReport(v, "Instalación de gas en comercio de Piura", [
        {
          tipo: "FOTO",
          punto: "fachada",
          path: "foto",
          fecha: "2026-10-12",
          ubicacion: "Piura · ubicación declarada para prueba visual",
        },
      ])
    ).arrayBuffer(),
  ),
)
console.log("PDFs de prueba generados, sin datos ni cargas a Supabase.")
