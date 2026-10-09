import { useState } from 'react';
import { rollParts, stockFromRollParts } from '../utils/rollStock';

export default function RollStockInput({ stock, length, sede, onChange, onError }: { stock: string; length: number; sede: string; onChange: (value: string) => void; onError: (error: string) => void }) {
  const initial = rollParts(Number(stock) || 0, length);
  const [rollos, setRollos] = useState(String(initial.rollos));
  const [metros, setMetros] = useState(String(initial.metros));
  const [error, setError] = useState('');
  function update(nextRollos: string, nextMetros: string) {
    setRollos(nextRollos); setMetros(nextMetros);
    try {
      if (!nextRollos.trim() || !nextMetros.trim()) throw new Error('Completa ambos campos; usa cero cuando no haya existencias.');
      const value = stockFromRollParts(Number(nextRollos), Number(nextMetros), length);
      setError(''); onError(''); onChange(String(value));
    } catch (err) { const message = (err as Error).message; setError(message); onError(message); }
  }
  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <label>Rollos completos — {sede}<input className="input-field" type="number" min="0" step="1" value={rollos} onChange={event => update(event.target.value, metros)} /></label>
      <label>Metros restantes — {sede}<input className="input-field" type="number" min="0" max={length} step={length / 1000} value={metros} aria-invalid={!!error} onChange={event => update(rollos, event.target.value)} /></label>
    </div>
    {error && <p role="alert" style={{ color: '#DC2626', fontSize: 12 }}>{error}</p>}
  </div>;
}
