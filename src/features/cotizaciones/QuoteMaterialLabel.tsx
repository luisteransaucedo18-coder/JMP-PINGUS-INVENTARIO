import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Material } from '../../domain/types'
import MaterialPreviewModal from '../../components/MaterialPreviewModal'

function Preview({ material, onClose }: { material: Material; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => { element?.close(); trigger?.focus() }
  }, [])
  return createPortal(
    <dialog ref={dialog} className="quote-material-dialog" aria-label={`Material ${material.nombre} · SKU ${material.id}`}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <MaterialPreviewModal material={material} onClose={onClose} />
    </dialog>, document.body,
  )
}

export default function QuoteMaterialLabel({ material, sku, nombre }: {
  material?: Material
  sku: string
  nombre: string
}) {
  const [open, setOpen] = useState(false)
  const [failedImage, setFailedImage] = useState<string>()
  const image = material?.imagen
  return <div className="quote-material-label">
    <button type="button" className="quote-material-preview" disabled={!material}
      aria-label={`Ver material ${nombre} · SKU ${sku}`} title={material ? 'Vista previa del material' : 'Material no disponible en el catálogo'}
      onClick={event => { event.stopPropagation(); setOpen(true) }}>
      {image && failedImage !== image
        ? <img src={image} alt={nombre} loading="lazy" onError={() => setFailedImage(image)} />
        : <span>Sin imagen</span>}
    </button>
    <div className="quote-material-identity"><strong>{nombre}</strong><small>SKU {sku}</small></div>
    {open && material && <Preview material={material} onClose={() => setOpen(false)} />}
  </div>
}
