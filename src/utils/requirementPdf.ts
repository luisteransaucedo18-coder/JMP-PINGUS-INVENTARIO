import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { Entrega, Material, Requerimiento } from '../data/mockData';

export const REQUIREMENT_PDF_LOGO = '/templates/pedido-materiales-logo.jpg';
const COMPANY = 'JM-PINGUS SAC';
const RUC = '20606333189';
const WIDTH = 555;
const LEFT = 20;
const HEIGHT = 841.89;
const COLUMNS = [22, 170, 40, 49, 49, 49, 35, 48, 33, 60];
const HEADERS = ['N°', 'MATERIALES', 'UNIDAD MEDIDA', 'CANTIDAD SOLICITADA', 'CANTIDAD ENTREGADA', 'CANTIDAD REPORTADA', 'CRUCE', 'MARCA', 'TIPO', 'OBSERVACIÓN'];
const BLUE = rgb(11 / 255, 102 / 255, 212 / 255);
const DEEP_BLUE = rgb(7 / 255, 85 / 255, 182 / 255);
const PALE_BLUE = rgb(234 / 255, 243 / 255, 254 / 255);
const LABEL_BLUE = rgb(217 / 255, 233 / 255, 251 / 255);
const INK = rgb(51 / 255, 65 / 255, 85 / 255);
const GRID = rgb(154 / 255, 190 / 255, 230 / 255);

function date(value?: string) {
  return value?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') ?? '';
}

// Standard PDF fonts support Spanish accents. Keep unsupported symbols from
// breaking an entire document, without interpreting any user text as markup.
function printable(value: string, font: PDFFont) {
  return Array.from(value.normalize('NFC')).map(char => {
    if (char === '\n') return char;
    try { font.encodeText(char); return char; } catch { return '?'; }
  }).join('');
}

function wrap(value: string, width: number, font: PDFFont, size: number): string[] {
  return printable(value, font).split('\n').flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line); line = '';
        }
        line += char;
      }
    }
    lines.push(line);
    return lines;
  });
}

/** Generates the JM-FI-GL-07 form using only the selected confirmed request. */
export async function createRequirementPdf(
  requirement: Requerimiento,
  materials: Material[],
  deliveries: Entrega[],
  logoBytes: Uint8Array,
): Promise<Uint8Array> {
  if (requirement.estado !== 'CONFIRMADO') throw new Error('La solicitud aún no está confirmada.');
  const reference = requirement.codigo ?? requirement.id;
  const doc = await PDFDocument.create();
  doc.setTitle(`JM-FI-GL-07 - ${reference}`);
  doc.setAuthor(COMPANY);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedJpg(logoBytes);
  const actualDeliveries = deliveries.filter(d => d.requerimientoId === requirement.id && d.estado !== 'CANCELADA');
  let page: PDFPage;

  function cell(text: string, x: number, top: number, width: number, height: number,
    options: { bold?: boolean; center?: boolean; size?: number; fill?: RGB; textColor?: RGB; borderColor?: RGB } = {}) {
    const font = options.bold ? bold : regular;
    const size = options.size ?? 7;
    page.drawRectangle({ x, y: HEIGHT - top - height, width, height, borderColor: options.borderColor ?? GRID, borderWidth: 0.45,
      ...(options.fill ? { color: options.fill } : {}) });
    const lines = text ? wrap(text, width - 6, font, size) : [];
    if (lines.length * (size + 2) + 6 > height) throw new Error('Un campo del documento excede el espacio disponible. Reduce su longitud e inténtalo de nuevo.');
    lines.forEach((line, i) => page.drawText(line, {
      x: options.center ? x + (width - font.widthOfTextAtSize(line, size)) / 2 : x + 3,
      y: HEIGHT - top - (height - lines.length * (size + 2)) / 2 - size - i * (size + 2), size, font, color: options.textColor ?? INK,
    }));
  }
  function band(text: string, top: number, dark = false) {
    cell(text, LEFT, top, WIDTH, 17, { bold: true, fill: dark ? BLUE : PALE_BLUE, textColor: dark ? rgb(1, 1, 1) : DEEP_BLUE, borderColor: dark ? BLUE : GRID });
  }
  function newPage() {
    page = doc.addPage([595.28, HEIGHT]);
    cell('', LEFT, 20, 88, 54, { fill: rgb(1, 1, 1) });
    page.drawImage(logo, { x: LEFT + 5, y: HEIGHT - 69, width: 78, height: 42 });
    ['CÓDIGO:', 'NOMBRE:', 'VERSIÓN:'].forEach((label, index) => {
      cell(label, 108, 20 + index * 18, 49, 18, { bold: true, size: 7, fill: BLUE, textColor: rgb(1, 1, 1), borderColor: BLUE });
      cell(['JM-FI-GL-07', 'PEDIDO DE MATERIALES PARA LA CONTRUCCION DE REDES INTERNAS', '1'][index], 157, 20 + index * 18, 418, 18, { bold: true, size: 7, fill: rgb(247 / 255, 250 / 255, 254 / 255), textColor: DEEP_BLUE });
    });
    cell('DATOS DE LA EMPRESA', LEFT, 81, 479, 17, { bold: true, fill: PALE_BLUE, textColor: DEEP_BLUE });
    cell('CORRELATIVO', 499, 81, 76, 17, { bold: true, fill: BLUE, textColor: rgb(1, 1, 1), borderColor: BLUE, center: true });
    const widths = [85, 70, 178, 65, 81, 30, 46];
    const labels = ['RAZÓN SOCIAL', 'RUC', 'PROYECTO', 'CIUDAD', 'FECHA REQUERIDA', 'AÑO', 'NÚMERO'];
    // The current request has no required-date field. Do not substitute its creation date.
    const values = [COMPANY, RUC, requirement.proyecto, requirement.sede, '', requirement.fecha.slice(0, 4), reference.split('-').slice(-1)[0] ?? reference];
    const valueHeight = Math.max(28, ...values.map((v, i) => wrap(v, widths[i] - 6, regular, 7).length * 9 + 6));
    if (valueHeight > 100) throw new Error('El nombre del proyecto es demasiado largo para el formato.');
    let x = LEFT;
    widths.forEach((w, i) => {
      cell(labels[i], x, 98, w, 27, { bold: true, fill: LABEL_BLUE, textColor: DEEP_BLUE, center: true, size: 6.5 });
      cell(values[i], x, 125, w, valueHeight, { center: true, fill: rgb(1, 1, 1) }); x += w;
    });
    const tableTop = 125 + valueHeight + 9;
    band('DETALLES DE PEDIDO', tableTop, true);
    x = LEFT;
    COLUMNS.forEach((w, i) => {
      cell(HEADERS[i], x, tableTop + 17, w, 36, { bold: true, fill: DEEP_BLUE, textColor: rgb(1, 1, 1), borderColor: DEEP_BLUE, center: true, size: 6 }); x += w;
    });
    return tableTop + 53;
  }
  function footer() {
    band('Responsable de Solicitud', 625);
    const requester = `Nombre: ${requirement.analista}`;
    cell(requester, LEFT, 642, 260, 35);
    cell(`Empresa: ${COMPANY}`, 280, 642, 120, 35);
    cell(`Fecha: ${date(requirement.fecha)}`, 400, 642, 90, 35);
    cell('Firma:', 490, 642, 85, 35);
    band('Responsable de Recepción', 677);
    cell(`Nombre: ${requirement.tecnico}`, LEFT, 694, 260, 35);
    cell('Empresa:', 280, 694, 120, 35);
    const dni = actualDeliveries.find(d => d.tecnico === requirement.tecnico && d.dniTecnico)?.dniTecnico ?? '';
    cell(`DNI: ${dni}`, 400, 694, 90, 35);
    cell('Firma:', 490, 694, 85, 35);
    band('Comentarios', 729);
    cell('', LEFT, 746, WIDTH, 65);
  }
  let top = newPage();
  const rows = requirement.materiales.map((item, index) => {
    const material = materials.find(m => m.id === item.skuId);
    const deliveredItems = actualDeliveries.flatMap(d => d.items).filter(m => m.skuId === item.skuId);
    return [String(index + 1), item.nombre, item.unidad ?? material?.unidad ?? 'UND',
      String(item.cantidad), deliveredItems.length ? String(deliveredItems.reduce((sum, m) => sum + m.cantidadEntregada, 0)) : '',
      '', '', item.marca ?? material?.marca ?? '', '', ''];
  });
  for (const row of rows) {
    const height = Math.max(14, ...row.map((v, i) => wrap(v, COLUMNS[i] - 6, regular, 7).length * 9 + 6));
    if (height > 420) throw new Error('La descripción de un material es demasiado larga para el formato.');
    if (top + height > 616) { footer(); top = newPage(); }
    if (top + height > 616) throw new Error('La descripción de un material es demasiado larga para el formato.');
    let x = LEFT;
    row.forEach((value, i) => { cell(value, x, top, COLUMNS[i], height, { center: i !== 1 }); x += COLUMNS[i]; });
    top += height;
  }
  while (top + 14 <= 616) {
    let x = LEFT;
    COLUMNS.forEach(w => { cell('', x, top, w, 14); x += w; });
    top += 14;
  }
  footer();

  // Long comments continue on additional pages rather than shrinking or truncating them.
  const comments = [requirement.descripcion, requirement.observaciones ? `Observación del coordinador: ${requirement.observaciones}` : ''].filter(Boolean).join('\n');
  const commentLines = wrap(comments, WIDTH - 6, regular, 7);
  if (comments && commentLines.length <= 6) {
    cell(comments, LEFT, 746, WIDTH, 65);
  } else if (comments) {
    cell('Ver comentarios en la página siguiente.', LEFT, 746, WIDTH, 65);
    for (let offset = 0; offset < commentLines.length; offset += 72) {
      page = doc.addPage([595.28, HEIGHT]);
      band(`Comentarios - ${reference}`, 20, true);
      cell(commentLines.slice(offset, offset + 72).join('\n'), LEFT, 37, WIDTH, 730);
    }
  }
  doc.getPages().forEach((p, index, pages) => {
    p.drawText(`${reference} - CONFIRMADO`, { x: LEFT, y: 17, size: 7, font: regular });
    p.drawText(`Página ${index + 1} de ${pages.length}`, { x: 495, y: 17, size: 7, font: regular });
  });
  return doc.save();
}

