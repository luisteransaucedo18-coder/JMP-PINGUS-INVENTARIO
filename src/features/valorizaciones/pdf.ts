import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { PDFPage, PDFFont } from "pdf-lib"
import {
  CHECKLIST,
  money,
  type Valuation,
  type Evidence,
  type Discount,
  netAmount,
} from "./domain"
import { downloadEvidence } from "../../services/valorizacionService"

// WinAnsi fonts do not accept arbitrary Unicode from user-entered descriptions.
const safe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
function lines(text: string, font: PDFFont, size: number, width: number) {
  const result: string[] = []
  let line = ""
  for (const word of safe(text).split(/\s+/)) {
    if (font.widthOfTextAtSize(`${line} ${word}`, size) > width && line) {
      result.push(line)
      line = ""
    }
    if (font.widthOfTextAtSize(word, size) > width) {
      for (const ch of word) {
        if (font.widthOfTextAtSize(line + ch, size) > width) {
          result.push(line)
          line = ""
        }
        line += ch
      }
    } else line += (line ? " " : "") + word
  }
  if (line) result.push(line)
  return result
}
async function base(title: string, v: Valuation, project: string) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = () => {
    const p = pdf.addPage([595, 842])
    p.drawText(title, {
      x: 40,
      y: 797,
      size: 16,
      font: bold,
      color: rgb(0.1, 0.2, 0.35),
    })
    p.drawText(`${v.codigo} | ${v.etapa} | ${v.tipo}`, {
      x: 40,
      y: 776,
      size: 10,
      font,
    })
    return p
  }
  let p = page()
  let y = 748
  const text = (value: string) => {
    for (const line of lines(value, font, 10, 515)) {
      if (y < 50) {
        p = page()
        y = 748
      }
      p.drawText(line, { x: 40, y, size: 10, font })
      y -= 16
    }
    y -= 4
  }
  text(`Proyecto: ${project}`)
  text(`Técnico responsable: ${v.tecnico} | DNI: ${v.dni}`)
  return {
    pdf,
    font,
    bold,
    page,
    text,
    get current() {
      return p
    },
    get y() {
      return y
    },
  }
}
export async function photographicReport(
  v: Valuation,
  project: string,
  documents: Evidence[],
) {
  const b = await base("REPORTE FOTOGRÁFICO Y CHECKLIST", v, project)
  b.text(
    "Fecha y ubicación de las fotografías declaradas por el analista. La calidad de obra se confirma bajo su responsabilidad.",
  )
  for (const [id, label] of CHECKLIST) {
    const a = v.checklist[id]
    b.text(
      `${label}: ${a?.estado || "PENDIENTE"}${a?.nota ? " | " + a.nota : ""}`,
    )
  }
  for (const photo of documents.filter((d) => d.tipo === "FOTO")) {
    const blob = await downloadEvidence(photo.path)
    const img = await b.pdf.embedJpg(await blob.arrayBuffer())
    const p: PDFPage = b.page()
    const dims = img.scale(Math.min(515 / img.width, 570 / img.height))
    p.drawImage(img, {
      x: (595 - dims.width) / 2,
      y: 155 + (570 - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    })
    let y = 135
    const label =
      CHECKLIST.find((c) => c[0] === photo.punto)?.[1] ?? photo.punto ?? ""
    for (const line of lines(
      `${label} | Fecha: ${photo.fecha} | Ubicación: ${photo.ubicacion}`,
      b.font,
      10,
      515,
    )) {
      p.drawText(line, { x: 40, y, size: 10, font: b.font })
      y -= 14
    }
  }
  return new Blob([new Uint8Array(await b.pdf.save())], {
    type: "application/pdf",
  })
}
export async function valuationPdf(
  v: Valuation,
  project: string,
  discounts: Discount[] = v.descuentos,
) {
  const b = await base("VALORIZACIÓN DE INSTALACIÓN DE GAS", v, project)
  b.text(
    `Mano de obra ${
      v.tipo === "ADELANTO" ? "(adelanto excepcional)" : "presupuestada"
    }: ${money(v.monto)}`,
  )
  if (v.motivo) b.text(`Motivo: ${v.motivo}`)
  b.text(`Adelantos previamente pagados: ${money(v.adelantos)}`)
  for (const d of discounts)
    b.text(
      `Descuento: ${d.nombre} | Cantidad: ${d.cantidad} | Referencia inventario: ${money(d.referencia)} por unidad | Descuento total: ${money(d.monto)} | ${d.motivo}`,
    )
  b.text(`NETO A PAGAR: ${money(netAmount(v.monto, v.adelantos, discounts))}`)
  b.text(
    "El técnico debe devolver este PDF con su firma digital. Tesorería adjuntará la versión firmada y el recibo por honorarios antes de solicitar autorización de pago.",
  )
  b.text("Firma digital del técnico responsable:")
  return new Blob([new Uint8Array(await b.pdf.save())], {
    type: "application/pdf",
  })
}
export function savePdf(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
