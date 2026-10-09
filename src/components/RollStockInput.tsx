import { useState } from 'react';
import { rollParts, stockFromRollParts } from '../utils/rollStock';

export default function RollStockInput({ stock, length, sede, onChange }: { stock: string; length: number; sede: string; onChange: (value: string) => void }) {
  const initial = rollParts(Number(stock) || 0, length);
  const [rollos, setRollos] = useState(String(initial.rollos));
  const [metros, setMetros] = useState(String(initial.metros));
  const [error, setError] = useState('');
  function update(nextRollos: string, nextMetros: string) {
    setRollos(nextRollos); setMetros(nextMetros);
    try {
      const value = stockFromRollParts(Number(nextRollos), Number(nextMetros), length);
      setError(''); onChange(String(value));
    } catch (err) { setError((err as Error).message); onChange('NaN'); }
  }
  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <label>Rollos completos — {sede}<input className="input-field" type="number" min="0" step="1" value={rollos} onChange={event => update(event.target.value, metros)} /></label>
      <label>Metros restantes — {sede}<input className="input-field" type="number" min="0" max={length} step={length / 1000} value={metros} aria-invalid={!!error} onChange={event => update(rollos, event.target.value)} /></label>
    </div>
    {error && <p role="alert" style={{ color: '#DC2626', fontSize: 12 }}>{error}</p>}
  </div>;
}
