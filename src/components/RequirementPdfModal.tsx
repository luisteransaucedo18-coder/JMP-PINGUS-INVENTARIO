import { useEffect, useRef, useState } from 'react';
import type { Entrega, Material, Requerimiento } from '../data/mockData';
import PdfDocumentViewer from './PdfDocumentViewer';
import { createRequirementPdf, REQUIREMENT_PDF_LOGO } from '../utils/requirementPdf';

interface Props {
  requirement: Requerimiento;
  materials: Material[];
  deliveries: Entrega[];
  onClose: () => void;
}

export default function RequirementPdfModal({ requirement, materials, deliveries, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setUrl(''); setError('');
    async function generate() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${REQUIREMENT_PDF_LOGO.slice(1)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('No se pudo cargar el logo del formato.');
        const bytes = await createRequirementPdf(requirement, materials, deliveries, new Uint8Array(await response.arrayBuffer()));
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
        setUrl(objectUrl);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
      }
    }
    void generate();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [requirement, materials, deliveries, attempt]);

  return (
    <dialog ref={dialog} aria-labelledby="requirement-pdf-title" onCancel={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      style={{ margin: 'auto', padding: 0, border: '1px solid #E4E4E7', borderRadius: 12, width: 'min(1100px, 96vw)', maxWidth: '96vw', height: '90dvh', maxHeight: '90dvh', background: '#fff', color: '#18181B' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="modal-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 id="requirement-pdf-title" style={{ margin: 0, fontSize: 16 }}>Pedido de materiales · {requirement.codigo ?? requirement.id}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: '#71717A' }}>Formato JM-FI-GL-07 · Solicitud confirmada</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {url && <>
              <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
              <a className="btn btn-ghost" href={url} download={`JM-FI-GL-07-${requirement.codigo ?? requirement.id}.pdf`}>Descargar</a>
            </>}
            <button autoFocus className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        {error ? (
          <div role="alert" style={{ margin: 'auto', padding: 24, textAlign: 'center' }}>
            <p style={{ color: '#B91C1C' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
          </div>
        ) : url ? (
          <PdfDocumentViewer url={url} />
        ) : <p role="status" style={{ margin: 'auto', padding: 24 }}>Generando PDF…</p>}
      </div>
    </dialog>
  );
}
