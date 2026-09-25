import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export default function PdfDocumentViewer({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const printFrame = useRef<HTMLIFrameElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [printHtml, setPrintHtml] = useState('');
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    let canceled = false;
    let task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    setDocument(null); setError(''); setPageNumber(1);
    void import('pdfjs-dist').then(pdfjs => {
      if (canceled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      task = pdfjs.getDocument({ url });
      return task.promise.then(pdf => { if (!canceled) setDocument(pdf); });
    }).catch(() => { if (!canceled) setError('No se pudo mostrar la vista previa. Puedes descargar o abrir el PDF.'); });
    return () => { canceled = true; active.current = false; void task?.destroy(); };
  }, [url]);

  useEffect(() => {
    if (!document || !canvas.current) return;
    let canceled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setRendering(true);
    void document.getPage(pageNumber).then(page => {
      if (canceled || !canvas.current) return;
      const viewport = page.getViewport({ scale: 1.6 });
      const target = canvas.current;
      target.width = viewport.width; target.height = viewport.height;
      task = page.render({ canvas: target, viewport });
      return task.promise;
    }).then(() => { if (!canceled) { setRendering(false); scrollArea.current?.scrollTo(0, 0); } }).catch(() => {
      if (!canceled) { setError('No se pudo mostrar esta página. Puedes abrir o descargar el PDF.'); setRendering(false); }
    });
    return () => { canceled = true; task?.cancel(); };
  }, [document, pageNumber]);

  async function print() {
    if (!document || printing) return;
    setPrinting(true); setPrintHtml('');
    try {
      const pages: string[] = [];
      for (let number = 1; number <= document.numPages; number++) {
        if (!active.current) return;
        const page = await document.getPage(number);
        const viewport = page.getViewport({ scale: 2 });
        const target = window.document.createElement('canvas');
        target.width = viewport.width; target.height = viewport.height;
        await page.render({ canvas: target, viewport }).promise;
        pages.push(`<img alt="Página ${number}" src="${target.toDataURL('image/png')}">`);
        target.width = 0; target.height = 0;
      }
      if (!active.current) return;
      setPrintHtml(`<!doctype html><html><head><title>Pedido de materiales</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm;break-after:page}img:last-child{break-after:auto}</style></head><body>${pages.join('')}</body></html>`);
    } catch {
      if (active.current) { setError('No se pudo preparar la impresión. Puedes abrir o descargar el PDF para imprimirlo.'); setPrinting(false); }
    }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8, background: '#F4F4F5' }}>
      <button className="btn btn-ghost" aria-label="Página anterior" disabled={!document || pageNumber === 1 || rendering} onClick={() => setPageNumber(n => n - 1)}>Anterior</button>
      <span aria-live="polite" style={{ fontSize: 12 }}>{document ? `Página ${pageNumber} de ${document.numPages}` : 'Cargando visor…'}</span>
      <button className="btn btn-ghost" aria-label="Página siguiente" disabled={!document || pageNumber === document.numPages || rendering} onClick={() => setPageNumber(n => n + 1)}>Siguiente</button>
      <button className="btn btn-primary" disabled={!document || printing} onClick={() => void print()}>{printing ? 'Preparando impresión…' : 'Imprimir'}</button>
    </div>
    {error && <p role="alert" style={{ margin: 0, padding: 12, background: '#FEF2F2', color: '#B91C1C' }}>{error}</p>}
    <div ref={scrollArea} style={{ flex: 1, minHeight: 0, overflow: 'auto', overflowAnchor: 'none', background: '#52525B', padding: 16, textAlign: 'center' }}>
      {rendering && !error && <p role="status" style={{ color: '#fff' }}>Cargando página…</p>}
      <canvas ref={canvas} role="img" aria-label={`Página ${pageNumber} del pedido de materiales. El PDF descargable contiene texto seleccionable.`}
        style={{ display: document ? 'block' : 'none', margin: '0 auto', maxWidth: '100%', height: 'auto', background: '#fff', boxShadow: '0 2px 8px #18181B' }} />
    </div>
    {printHtml && <iframe ref={printFrame} title="Impresión del pedido de materiales" srcDoc={printHtml}
      style={{ position: 'fixed', width: 1, height: 1, left: -10000, border: 0 }}
      onLoad={() => {
        setPrinting(false);
        try { printFrame.current?.contentWindow?.focus(); printFrame.current?.contentWindow?.print(); }
        catch { setError('Abre o descarga el PDF para imprimirlo desde tu navegador.'); }
      }} />}
  </div>;
}
