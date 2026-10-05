import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { Quote } from "../features/cotizaciones/domain"
import { money } from "../features/cotizaciones/domain"

const COMPANY = 'JM-PINGUS SAC'
const HEIGHT = 841.89, LEFT = 20, WIDTH = 555
const BLUE = rgb(11 / 255, 102 / 255, 212 / 255)
const DEEP_BLUE = rgb(7 / 255, 85 / 255, 182 / 255)
const PALE_BLUE = rgb(234 / 255, 243 / 255, 254 / 255)
const INK = rgb(51 / 255, 65 / 255, 85 / 255)
const GRID = rgb(154 / 255, 190 / 255, 230 / 255)
const WHITE = rgb(1, 1, 1)

function wrap(value: string, width: number, font: PDFFont, size = 9): string[] {
  const printable = Array.from(value.normalize('NFC')).map(char => {
    if (char === '\n') return char
    try { font.encodeText(char); return char } catch { return '?' }
  }).join('')
  return printable.split('\n').flatMap(paragraph => {
    const lines: string[] = []
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue }
      if (line) lines.push(line)
      line = ''
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = '' }
        line += char
      }
    }
    lines.push(line)
    return lines
  })
}

export async function buildQuotationPdf(quote: Quote, logoBytes?: Uint8Array) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Cotización ${quote.codigo} - versión ${quote.version}`)
  pdf.setAuthor(COMPANY)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = logoBytes ? await pdf.embedJpg(logoBytes) : undefined
  let page: PDFPage
  let top = 88

  function cell(lines: string[], x: number, y: number, width: number, height: number,
    options: { heading?: boolean; dark?: boolean; right?: boolean; pale?: boolean; size?: number } = {}) {
    page.drawRectangle({ x, y: HEIGHT - y - height, width, height, borderColor: GRID, borderWidth: .45,
      color: options.dark ? BLUE : options.pale ? PALE_BLUE : WHITE })
    const face = options.heading ? bold : font
    const size = options.size ?? 9
    lines.forEach((line, index) => page.drawText(line, {
      x: options.right ? x + width - 7 - face.widthOfTextAtSize(line, size) : x + 7,
      y: HEIGHT - y - 7 - size - index * 12, size, font: face,
      color: options.dark ? WHITE : options.heading ? DEEP_BLUE : INK,
    }))
  }
  function newPage() {
    page = pdf.addPage([595.28, HEIGHT])
    cell([], LEFT, 20, 88, 54)
    if (logo) page.drawImage(logo, { x: LEFT + 5, y: HEIGHT - 69, width: 78, height: 42 })
    else cell(wrap(COMPANY, 74, bold, 9), LEFT, 20, 88, 54, { heading: true })
    ;[['CÓDIGO:', quote.codigo], ['NOMBRE:', 'COTIZACIÓN DE PROYECTO'], ['VERSIÓN:', String(quote.version)]].forEach(([label, value], index) => {
      const y = 20 + index * 18
      page.drawRectangle({ x: 108, y: HEIGHT - y - 18, width: 65, height: 18, color: BLUE })
      page.drawText(label, { x: 112, y: HEIGHT - y - 12, font: bold, size: 7, color: WHITE })
      cell(wrap(value, 388, bold, 7), 173, y, 402, 18, { heading: true, pale: true, size: 7 })
    })
    top = 88
  }
  function ensure(height: number) { if (top + height > 793) newPage() }
  function band(title: string) {
    cell(wrap(title, WIDTH - 14, bold), LEFT, top, WIDTH, 22, { heading: true, dark: true })
    top += 22
  }
  function section(title: string) { ensure(65); band(title) }
  function textBlock(title: string, text: string) {
    section(title)
    const lines = wrap(text, WIDTH - 14, font)
    for (let offset = 0; offset < lines.length;) {
      if (top + 26 > 793) { newPage(); band(`${title} (continuación)`) }
      const count = Math.min(lines.length - offset, Math.floor((793 - top - 14) / 12))
      const height = count * 12 + 14
      cell(lines.slice(offset, offset + count), LEFT, top, WIDTH, height)
      top += height; offset += count
    }
    top += 10
  }
  function detail(label: string, value: string) {
    const labels = wrap(label, 108, bold), values = wrap(value, WIDTH - 136, font)
    const count = Math.max(labels.length, values.length)
    for (let offset = 0; offset < count;) {
      ensure(26)
      const take = Math.min(count - offset, Math.floor((793 - top - 14) / 12))
      const height = take * 12 + 10
      cell(labels.slice(offset, offset + take), LEFT, top, 122, height, { heading: true, pale: true })
      cell(values.slice(offset, offset + take), LEFT + 122, top, WIDTH - 122, height)
      top += height; offset += take
    }
  }
  function table(title: string, rows: string[][]) {
    if (!rows.length) return
    const columns = [28, 357, 85, 85]
    const header = () => {
      band(title)
      let x = LEFT
      ;['N°', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD'].forEach((value, index) => {
        cell([value], x, top, columns[index], 26, { heading: true, dark: true, size: 8 }); x += columns[index]
      })
      top += 26
    }
    ensure(85); header()
    rows.forEach((row, rowIndex) => {
      const cells = row.map((value, index) => wrap(value, columns[index] - 14, font))
      const count = Math.max(...cells.map(lines => lines.length))
      for (let offset = 0; offset < count;) {
        if (top + Math.min(count - offset, 3) * 12 + 14 > 793) { newPage(); header() }
        const take = Math.min(count - offset, Math.floor((793 - top - 14) / 12))
        const height = take * 12 + 10
        let x = LEFT
        cells.forEach((lines, index) => {
          cell(lines.slice(offset, offset + take), x, top, columns[index], height, { pale: rowIndex % 2 === 1, right: index === 3 }); x += columns[index]
        })
        top += height; offset += take
      }
    })
    top += 10
  }

  newPage()
  section('DATOS DE LA EMPRESA')
  detail('RAZÓN SOCIAL', COMPANY)
  detail('RUC', '20606333189')
  top += 10
  section('DATOS DEL PROYECTO Y CLIENTE')
  detail('PROYECTO', quote.proyecto_snapshot.nombre)
  detail('CLIENTE', quote.proyecto_snapshot.cliente)
  detail('DIRECCIÓN DEL PROYECTO', quote.proyecto_snapshot.ubicacion)
  detail('DEPARTAMENTO', quote.presupuesto.excel.departamento)
  if (quote.presupuesto.excel.provincia) detail('PROVINCIA', quote.presupuesto.excel.provincia)
  detail(quote.presupuesto.excel.distrito ? 'DISTRITO' : 'LOCALIDAD', quote.presupuesto.excel.distrito || quote.presupuesto.ciudad)
  detail('MODALIDAD / PUNTOS', `${quote.presupuesto.modalidad} / ${quote.presupuesto.puntos}`)
  detail('VIGENCIA', quote.presupuesto.vigencia.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1'))
  top += 10
  textBlock('ALCANCE DE LOS TRABAJOS', quote.presupuesto.alcance)
  table('MATERIALES INCLUIDOS', quote.presupuesto.materiales.map((m, index) => [String(index + 1), m.nombre, m.unidadCotizada, String(m.cantidad)]))
  const services = quote.presupuesto.gastos.filter(g => ['MANO_OBRA', 'HABILITACION', 'MURETES', 'ANCLAJE', 'ALTURA', 'IG3', 'DOCUMENTACION', 'PAQUETE', 'ADICIONALES'].includes(g.rubro))
  table('SERVICIOS INCLUIDOS', services.map((g, index) => [String(index + 1), g.descripcion, 'SERVICIO', String(g.cantidad)]))
  const total = quote.importe_aceptado ?? quote.importe_presentado ?? quote.totales.total
  const base = Math.round(total / (1 + quote.presupuesto.tasas.igv / 100) * 100) / 100
  ensure(26 + 3 * 28)
  band('IMPORTE COMERCIAL')
  ;[['Valor sin IGV', base], [`IGV (${quote.presupuesto.tasas.igv}%)`, total - base], ['TOTAL INCLUIDO IGV', total]].forEach(([label, value], index) => {
    cell([String(label)], LEFT, top, WIDTH - 165, 28, { heading: index === 2, pale: index === 2 })
    cell([money(Number(value), quote.presupuesto.moneda)], LEFT + WIDTH - 165, top, 165, 28, { heading: true, right: true, dark: index === 2 })
    top += 28
  })
  top += 10
  textBlock('CONDICIONES COMERCIALES', quote.presupuesto.condiciones || 'Según alcance descrito.')
  pdf.getPages().forEach((p, index, pages) => {
    p.drawLine({ start: { x: LEFT, y: 35 }, end: { x: LEFT + WIDTH, y: 35 }, color: GRID, thickness: .45 })
    p.drawText(`${quote.codigo} - Versión ${quote.version} | ${COMPANY}`, { x: LEFT, y: 20, size: 7, font, color: INK })
    p.drawText(`Página ${index + 1} de ${pages.length}`, { x: 495, y: 20, size: 7, font, color: INK })
  })
  return pdf.save()
}

export async function downloadQuotation(quote: Quote) {
  const response = await fetch(`${import.meta.env.BASE_URL}templates/pedido-materiales-logo.jpg`)
  if (!response.ok) throw new Error('No se pudo cargar el logo del documento. Inténtalo nuevamente.')
  const bytes = await buildQuotationPdf(quote, new Uint8Array(await response.arrayBuffer()))
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${quote.codigo}-v${quote.version}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
