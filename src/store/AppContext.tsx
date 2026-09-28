<<<<<<< HEAD
import { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState } from 'react';
import { supabase } from '../service/supabase';
=======
import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Entrega, Material, Proyecto, Requerimiento, RequerimientoCompra } from '../data/mockData';
import { obtenerCompras } from '../service/compraService';
import { obtenerEntregas } from '../service/devolucionService';
import { obtenerMateriales } from '../service/materialService';
>>>>>>> f27575ceeb1ae5b146f35b060c087ac60403816d
import { obtenerProyectos, obtenerRequerimientos } from '../service/requerimientoService';
import { supabase } from '../service/supabase';

interface AppState {
  materials: Material[];
  requerimientos: Requerimiento[];
  proyectos: Proyecto[];
  entregas: Entrega[];
  compras: RequerimientoCompra[];
}

type Action =
  | { type: 'REPLACE_REQUERIMIENTOS'; payload: Requerimiento[] }
  | { type: 'REPLACE_PROYECTOS'; payload: Proyecto[] }
  | { type: 'REPLACE_MATERIALS'; payload: Material[] }
  | { type: 'REPLACE_ENTREGAS'; payload: Entrega[] }
  | { type: 'REPLACE_COMPRAS'; payload: RequerimientoCompra[] };

const initialState: AppState = {
  materials: [],
  requerimientos: [],
  proyectos: [],
  entregas: [],
  compras: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'REPLACE_REQUERIMIENTOS': return { ...state, requerimientos: action.payload };
    case 'REPLACE_PROYECTOS': return { ...state, proyectos: action.payload };
    case 'REPLACE_MATERIALS': return { ...state, materials: action.payload };
    case 'REPLACE_ENTREGAS': return { ...state, entregas: action.payload };
    case 'REPLACE_COMPRAS': return { ...state, compras: action.payload };
  }
}

<<<<<<< HEAD
interface AppContextType { state: AppState; dispatch: React.Dispatch<Action>; refreshRemoteData: () => Promise<void>; initialLoad: 'loading' | 'ready' | 'error'; retryInitialLoad: () => void }
const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [initialLoad, setInitialLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [state, dispatch] = useReducer(reducer, {
    materials: initMaterials.map(m => ({ ...m })),
    requerimientos: initReqs.map(r => ({ ...r })),
    users: initUsuarios.map(u => ({ ...u })),
    proyectos: initProyectos.map(p => ({ ...p })),
    entregas: initEntregas.map(e => ({ ...e })),
    devoluciones: initDevoluciones.map(d => ({ ...d })),
    compras: initCompras.map(c => ({ ...c })),
  });
=======
interface AppContextType {
  state: AppState;
  refreshRemoteData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

>>>>>>> f27575ceeb1ae5b146f35b060c087ac60403816d
  const refreshRemoteData = useCallback(async () => {
    const results = await Promise.allSettled([
      obtenerRequerimientos(),
      obtenerProyectos(),
      obtenerMateriales(),
      obtenerEntregas(),
      obtenerCompras(),
    ]);
    const [requirements, projects, materials, deliveries, purchases] = results;
    if (requirements.status === 'fulfilled') dispatch({ type: 'REPLACE_REQUERIMIENTOS', payload: requirements.value });
    if (projects.status === 'fulfilled') dispatch({ type: 'REPLACE_PROYECTOS', payload: projects.value });
    if (materials.status === 'fulfilled') dispatch({ type: 'REPLACE_MATERIALS', payload: materials.value });
    if (deliveries.status === 'fulfilled') dispatch({ type: 'REPLACE_ENTREGAS', payload: deliveries.value });
    if (purchases.status === 'fulfilled') dispatch({ type: 'REPLACE_COMPRAS', payload: purchases.value });
    results.forEach(result => {
      if (result.status === 'rejected') console.error('No se pudo sincronizar una fuente remota:', result.reason);
    });
  }, []);

  useEffect(() => {
    let active = true;
<<<<<<< HEAD
    const refresh = async () => { try { await refreshRemoteData(); } catch (error) { console.error('No se pudo sincronizar datos remotos:', error); } };
    setInitialLoad('loading');
    void refreshRemoteData().then(() => { if (active) setInitialLoad('ready'); })
      .catch(() => { if (active) setInitialLoad('error'); });
    const channel = supabase.channel('requerimientos-compartidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos' }, () => { if (active) void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimiento_items' }, () => { if (active) void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => { if (active) void refresh(); })
=======
    const refresh = () => { if (active) void refreshRemoteData(); };
    refresh();
    const channel = supabase.channel('datos-compartidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimiento_items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiales' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_sedes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entrega_items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_compra' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orden_compra_items' }, refresh)
>>>>>>> f27575ceeb1ae5b146f35b060c087ac60403816d
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [refreshRemoteData, loadAttempt]);

<<<<<<< HEAD
  return <AppContext.Provider value={{ state, dispatch, refreshRemoteData, initialLoad, retryInitialLoad: () => setLoadAttempt(n => n + 1) }}>{children}</AppContext.Provider>;
=======
  return <AppContext.Provider value={{ state, refreshRemoteData }}>{children}</AppContext.Provider>;
>>>>>>> f27575ceeb1ae5b146f35b060c087ac60403816d
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore debe usarse dentro de AppProvider');
  return context;
}
