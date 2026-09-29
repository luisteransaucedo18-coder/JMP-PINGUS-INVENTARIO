import { createContext, useCallback, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import type { Entrega, Material, Proyecto, Requerimiento, RequerimientoCompra } from '../domain/types';
import { obtenerCompras } from '../services/compraService';
import { obtenerEntregas } from '../services/devolucionService';
import { obtenerMateriales } from '../services/materialService';
import { obtenerProyectos, obtenerRequerimientos } from '../services/requerimientoService';
import { supabase } from '../services/supabase';

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
    default: return state;
  }
}

interface AppContextType {
  state: AppState;
  refreshRemoteData: () => Promise<void>;
  initialLoad: 'loading' | 'ready' | 'error';
  retryInitialLoad: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [initialLoad, setInitialLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [state, dispatch] = useReducer(reducer, initialState);
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
    const refresh = async () => {
      try {
        await refreshRemoteData();
        if (active) setInitialLoad('ready');
      } catch (error) {
        console.error('No se pudo sincronizar datos remotos:', error);
        if (active) setInitialLoad('error');
      }
    };
    setInitialLoad('loading');
    void refresh();
    const channel = supabase.channel('datos-compartidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimiento_items' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimiento_abastecimiento' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiales' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_sedes' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entrega_items' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_compra' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orden_compra_items' }, () => { void refresh(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [refreshRemoteData, loadAttempt]);

  return <AppContext.Provider value={{ state, refreshRemoteData, initialLoad, retryInitialLoad: () => setLoadAttempt(value => value + 1) }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore debe usarse dentro de AppProvider');
  return context;
}
