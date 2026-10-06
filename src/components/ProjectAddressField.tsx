import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ExpandingTextField from './ExpandingTextField';

type Place = { lat: string; lon: string; display_name: string; boundingbox?: string[] };
const cache = new Map<string, unknown>();
let queue = Promise.resolve();
let lastRequest = 0;
// Serialize and cache geocoding requests, including requests from other instances.
function geocode<T>(parameters: Record<string, string>, signal: AbortSignal): Promise<T> {
  const url = `${import.meta.env.VITE_GEOCODING_URL || 'https://nominatim.openstreetmap.org'}/${parameters.lat ? 'reverse' : 'search'}?${new URLSearchParams({ format: 'jsonv2', 'accept-language': 'es', ...parameters })}`;
  const result = queue.then(async () => {
    signal.throwIfAborted();
    if (cache.has(url)) return cache.get(url) as T;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastRequest))));
    signal.throwIfAborted();
    lastRequest = Date.now();
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('No se pudo consultar la ubicación.');
    const data = await response.json() as T;
    cache.set(url, data);
    return data;
  });
  queue = result.then(() => undefined, () => undefined);
  return result;
}

type Props = { value: string; onChange: (value: string) => void; departamento: string; provincia: string; distrito: string; readOnly?: boolean; error?: string };
export default function ProjectAddressField(props: Props) {
  const [open, setOpen] = useState(false);
  const ready = Boolean(props.departamento && props.provincia && props.distrito);
  return <div className="quote-field project-address-field" data-field-label="Dirección del proyecto">
    <label htmlFor="project-address">Dirección del proyecto</label>
    <div className="project-address-control">
      <ExpandingTextField id="project-address" aria-invalid={props.error ? true : undefined} aria-describedby={props.error ? 'project-address-error' : undefined} className="input-field" autoComplete="street-address" placeholder="Ej. Av. José Balta 123, interior 2" required readOnly={props.readOnly} value={props.value} onChange={e => props.onChange(e.target.value)} />
      <button type="button" className="project-address-map-button" aria-label="Seleccionar ubicación en el mapa" title={ready ? 'Seleccionar ubicación en el mapa' : 'Selecciona departamento, provincia y distrito'} disabled={!ready || props.readOnly} onClick={() => setOpen(true)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m9 18-6 3V6l6-3 6 3 6-3v8M9 3v15M3 6l6-3 6 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 16c0 3-4 6-4 6s-4-3-4-6a4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="18" cy="16" r="1" fill="currentColor"/></svg>
      </button>
    </div>
    {props.error && <small id="project-address-error" className="field-validation-message">{props.error}</small>}
    {!ready && <small>Selecciona departamento, provincia y distrito para abrir el mapa.</small>}
    {props.readOnly && <small>La dirección pertenece al proyecto vinculado y no se puede modificar desde esta cotización.</small>}
    {open && <AddressMap {...props} onClose={() => setOpen(false)} />}
  </div>;
}

function AddressMap({ value, onChange, departamento, provincia, distrito, onClose }: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef<(point: L.LatLng) => void>(() => {});
  const [address, setAddress] = useState(value);
  const [point, setPoint] = useState<L.LatLng | null>(null);
  const [status, setStatus] = useState('Buscando el distrito…');
  const [loading, setLoading] = useState(true);
  const [located, setLocated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let reverse: AbortController | undefined;
    let marker: L.Marker | undefined;
    let revision = 0;
    const instance = L.map(container.current!).setView([-9.19, -75.015], 5);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
    const icon = L.divIcon({ className: 'project-map-pin', html: '<span aria-hidden="true">📍</span>', iconSize: [32, 40], iconAnchor: [16, 38] });
    const choose = (position: L.LatLng) => {
      setPoint(position);
      setAddress('');
      marker ??= L.marker(position, { draggable: true, icon, title: 'Ubicación del proyecto' }).addTo(instance).on('dragend', () => choose(marker!.getLatLng()));
      marker.setLatLng(position);
      reverse?.abort();
      reverse = new AbortController();
      const current = ++revision;
      setLoading(true);
      setStatus('Buscando la dirección del punto seleccionado…');
      void geocode<Place>({ lat: String(position.lat), lon: String(position.lng), zoom: '18' }, reverse.signal).then(result => {
        if (current !== revision || controller.signal.aborted) return;
        setAddress(result.display_name || '');
        setStatus(result.display_name ? 'Revisa la dirección y completa el número, interior o referencia.' : 'No hay dirección registrada. Escribe la dirección exacta para este punto.');
      }).catch(() => {
        if (current === revision && !controller.signal.aborted) setStatus('No se pudo obtener la dirección. Puedes escribirla manualmente para este punto.');
      }).finally(() => { if (current === revision && !controller.signal.aborted) setLoading(false); });
    };
    setLoading(true);
    setLocated(false);
    setPoint(null);
    setStatus('Buscando el distrito…');
    void geocode<Place[]>({ q: `${distrito}, ${provincia}, ${departamento}, Perú`, countrycodes: 'pe', limit: '1' }, controller.signal).then(results => {
      if (controller.signal.aborted) return;
      const place = results[0];
      if (!place) throw new Error('Distrito no encontrado');
      if (place.boundingbox) {
        const [south, north, west, east] = place.boundingbox.map(Number);
        instance.fitBounds([[south, west], [north, east]], { maxZoom: 15 });
      } else instance.setView([Number(place.lat), Number(place.lon)], 14);
      setLocated(true);
      instance.on('click', event => choose(event.latlng));
      select.current = choose;
      setStatus('Haz clic en el mapa o usa el centro del mapa para colocar el puntero. Puedes arrastrarlo para ajustar la ubicación.');
    }).catch(() => { if (!controller.signal.aborted) setStatus('No se pudo localizar el distrito. Reintenta o cierra el mapa y escribe la dirección.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); reverse?.abort(); instance.remove(); map.current = null; };
  }, [departamento, provincia, distrito, attempt]);
  return createPortal(<dialog ref={dialog} className="project-map-dialog" aria-labelledby="project-map-heading" onCancel={onClose}>
    <div className="project-map-header"><div><h2 id="project-map-heading">Ubicación del proyecto</h2><p>{departamento} / {provincia} / {distrito}</p></div><button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Cerrar mapa">Cerrar</button></div>
    <div ref={container} className="project-map-canvas" aria-label="Mapa de ubicación del proyecto" />
    <p role="status">{status}</p>
    {!located && !loading && <button type="button" className="btn btn-ghost" onClick={() => setAttempt(a => a + 1)}>Reintentar</button>}
    <button type="button" className="btn btn-ghost" disabled={!located || loading} onClick={() => map.current && select.current(map.current.getCenter())}>Colocar puntero en el centro del mapa</button>
    {point && <small>Coordenadas: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</small>}
    <label className="quote-field">Dirección exacta<ExpandingTextField className="input-field" value={address} disabled={!point || loading} onChange={e => setAddress(e.target.value)} placeholder="Completa calle, número, interior y referencias" /></label>
    <div className="project-map-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={!point || loading || !address.trim()} onClick={() => { onChange(address.trim()); onClose(); }}>Usar esta dirección</button></div>
  </dialog>, document.body);
}
