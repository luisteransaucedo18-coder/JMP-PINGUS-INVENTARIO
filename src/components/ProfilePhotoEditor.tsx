import { useEffect, useRef, useState } from 'react';

export default function ProfilePhotoEditor({ file, saving, error, onSave, onClose }: {
  file: File; saving: boolean; error: string; onSave: (file: File) => Promise<boolean>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [localError, setLocalError] = useState('');
  const [exporting, setExporting] = useState(false);
  const busy = saving || exporting;
  const busyRef = useRef(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let active = true;
    img.onload = () => { if (active) setImage(img); };
    img.onerror = () => { if (active) setLocalError('No se pudo abrir la imagen. Selecciona otra foto.'); };
    img.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !image) return;
    const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 512, 512);
    context.drawImage(image, (image.naturalWidth - side) * x / 100,
      (image.naturalHeight - side) * y / 100, side, side, 0, 0, 512, 512);
  }, [image, zoom, x, y]);
  const save = async () => {
    if (busyRef.current || busy || !image || !canvas.current) return;
    busyRef.current = true; setExporting(true); setLocalError('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(
        result => result ? resolve(result) : reject(new Error('No se pudo preparar la foto. Inténtalo nuevamente.')), 'image/jpeg', 0.9));
      if (await onSave(new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' }))) onClose();
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'No se pudo preparar la foto.'); }
    finally { busyRef.current = false; setExporting(false); }
  };
  return <dialog ref={dialog} className="profile-photo-dialog" aria-labelledby="photo-editor-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="photo-editor-title">Ajustar foto de perfil</h2>
    <p>Acerca la imagen y ajusta su posición. Así se verá tu foto en el sistema.</p>
    <div className="profile-crop-preview"><canvas ref={canvas} width={512} height={512} aria-label="Vista previa del recorte de la foto" /></div>
    <fieldset disabled={busy || !image} className="profile-crop-controls">
      <label>Acercar<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <label>Posición horizontal<input type="range" min="0" max="100" value={x} onChange={event => setX(Number(event.target.value))} /></label>
      <label>Posición vertical<input type="range" min="0" max="100" value={y} onChange={event => setY(Number(event.target.value))} /></label>
    </fieldset>
    {(localError || error) && <p role="alert" className="profile-feedback profile-feedback-error">{localError || error}</p>}
    <div className="profile-form-actions">
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={busy || !image} aria-busy={busy} onClick={() => void save()}>{busy ? 'Guardando foto…' : 'Guardar foto'}</button>
    </div>
  </dialog>;
}
