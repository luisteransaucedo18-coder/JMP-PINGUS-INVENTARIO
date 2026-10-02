import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { Quote } from "../features/cotizaciones/domain"
import { money } from "../features/cotizaciones/domain"

export async function buildQuotationPdf(quote: Quote) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([595.28, 841.89])
  let y = 790
  const safe = (text: string) =>
    Array.from(text)
      .map((char) => {
        try {
          font.encodeText(char)
          return char
        } catch {
          return "?"
        }
      })
      .join("")
  const line = (text: string, heading = false) => {
    const chosenFont=heading?bold:font;
    const size=heading?13:10;
    const words = safe(text).split(/\s+/).flatMap(word=>{
      const parts:string[]=[]; let part='';
      for(const char of word){if(chosenFont.widthOfTextAtSize(part+char,size)>505&&part){parts.push(part);part='';}part+=char;} if(part)parts.push(part);return parts;
    });
    let row = ""
    const write = () => {
      if (y < 55) {
        page = pdf.addPage([595.28, 841.89])
        y = 790
      }
      page.drawText(row, {
        x: 45,
        y,
        size: heading ? 13 : 10,
        font: heading ? bold : font,
        color: rgb(0.12, 0.14, 0.18),
      })
      y -= heading ? 23 : 16
    }
    for (const word of words) {
      const next = row ? `${row} ${word}` : word
      if (chosenFont.widthOfTextAtSize(next,size) > 505 && row) {
        write()
        row = word
      } else row = next
    }
    if (row) write()
    y -= 5
  }
  line(`JMP · Propuesta ${quote.codigo} · Versión ${quote.version}`, true)
  line(quote.proyecto_snapshot.nombre, true)
  line(`Cliente: ${quote.proyecto_snapshot.cliente}`)
  line(
    `Ubicación: ${quote.proyecto_snapshot.ubicacion} · Ciudad: ${quote.presupuesto.ciudad}`,
  )
  line(
    `Modalidad: ${quote.presupuesto.modalidad} · Puntos: ${quote.presupuesto.puntos} · Vigencia: ${quote.presupuesto.vigencia}`,
  )
  line("Alcance", true)
  line(quote.presupuesto.alcance)
  if (quote.presupuesto.materiales.length) {
    line("Materiales incluidos", true)
    quote.presupuesto.materiales.forEach((m) =>
      line(`${m.nombre}: ${m.cantidad} ${m.unidadCotizada}`),
    )
  }
  if (quote.presupuesto.gastos.length) {
    line("Servicios incluidos", true)
    quote.presupuesto.gastos.filter(g=>['MANO_OBRA','HABILITACION','MURETES','ANCLAJE','ALTURA','IG3','DOCUMENTACION','PAQUETE','ADICIONALES'].includes(g.rubro)).forEach((g) =>
      line(`${g.descripcion}: ${g.cantidad}`),
    )
  }
  const total =
    quote.importe_aceptado ?? quote.importe_presentado ?? quote.totales.total
  const base =
    Math.round((total / (1 + quote.presupuesto.tasas.igv / 100)) * 100) / 100
  line("Importe comercial", true)
  line(`Valor sin IGV: ${money(base, quote.presupuesto.moneda)}`)
  line(
    `IGV (${quote.presupuesto.tasas.igv}%): ${money(total - base, quote.presupuesto.moneda)}`,
  )
  line(`Total incluido IGV: ${money(total, quote.presupuesto.moneda)}`, true)
  line("Condiciones", true)
  line(quote.presupuesto.condiciones || "Según alcance descrito.")
  pdf
    .getPages()
    .forEach((p, i) =>
      p.drawText(`Página ${i + 1} de ${pdf.getPageCount()}`, {
        x: 45,
        y: 30,
        size: 9,
        font,
      }),
    )
  return pdf.save();
}

export async function downloadQuotation(quote: Quote) {
  const bytes=await buildQuotationPdf(quote);
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = `${quote.codigo}-v${quote.version}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
