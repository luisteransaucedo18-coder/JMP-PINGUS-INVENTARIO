import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Material, Sede } from '../domain/types';
import { searchMaterials } from '../utils/materialSearch';

interface Props {
  materials: Material[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (material: Material) => void;
  excludedIds?: string[];
  sede?: Sede;
  id?: string;
  label?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}
export default function MaterialAutocomplete({ materials, value, onChange, onSelect, excludedIds = [], sede, id, label = 'Buscar material por nombre, código o categoría', invalid, describedBy, disabled }: Props) {
  const uid = useId();
  const listId = `${uid}-results`;
  const activeOption = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const available = materials.filter(material => !excludedIds.includes(material.id));
  const matches = searchMaterials(available, value, 8);
  const active = matches.findIndex(material => material.id === activeId);
  const expanded = open && !disabled;
  useEffect(() => { if (expanded) activeOption.current?.scrollIntoView({ block: 'nearest' }); }, [activeId, expanded]);
  const select = (material: Material) => { setOpen(false); setActiveId(null); onSelect(material); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActiveId(null); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const next = event.key === 'ArrowDown' ? (active + 1) % matches.length : active < 0 ? matches.length - 1 : (active - 1 + matches.length) % matches.length;
      setActiveId(matches[next]?.id ?? null);
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault();
      if (active >= 0) select(matches[active]);
    } else if (event.key === 'Tab') { setOpen(false); setActiveId(null); }
  };
  return <div className="material-autocomplete" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveId(null); } }}>
    <input id={id} className="input-field" role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && active >= 0 ? `${uid}-option-${active}` : undefined}
      aria-invalid={invalid || undefined} aria-describedby={describedBy} autoComplete="off" disabled={disabled} value={value}
      placeholder="Nombre, código o categoría…" onKeyDown={keyDown} onFocus={() => setOpen(true)}
      onChange={event => { onChange(event.target.value); setActiveId(null); setOpen(true); }} />
    {expanded && <div className="material-autocomplete-panel">
      <ul id={listId} role="listbox" aria-label="Materiales disponibles">
        {matches.map((material, index) => <li key={material.id} id={`${uid}-option-${index}`} role="option" aria-selected={activeId === material.id}
          className="material-autocomplete-option" ref={activeId === material.id ? activeOption : undefined} onMouseDown={event => event.preventDefault()}
          onClick={() => select(material)} onMouseEnter={() => setActiveId(material.id)}>
          <strong>{material.nombre}</strong>
          <span>{material.id} · {material.categoria} · {material.unidad}</span>
          {sede && <small>{material.stockSedes[sede] ?? 0} {material.unidad} en {sede}</small>}
        </li>)}
      </ul>
      {!matches.length && <p role="status">{available.length ? 'Sin coincidencias. Prueba otro nombre o código.' : 'No hay materiales disponibles para agregar.'}</p>}
      {matches.length > 0 && <p className="material-autocomplete-hint">Hasta 8 sugerencias. Escribe para afinar la búsqueda.</p>}
    </div>}
  </div>;
}
