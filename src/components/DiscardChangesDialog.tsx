import SystemAlert from './SystemAlert';

export default function DiscardChangesDialog({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  return <SystemAlert title="¿Descartar los cambios?" tone="warning" onClose={onCancel} onConfirm={onDiscard}
    cancelLabel="Seguir editando" confirmLabel="Descartar cambios">
    <p>Los datos sin guardar se perderán.</p>
  </SystemAlert>;
}
