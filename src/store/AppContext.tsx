import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Entrega, Material, Proyecto, Requerimiento, RequerimientoCompra } from '../data/mockData';
import { obtenerCompras } from '../service/compraService';
import { obtenerEntregas } from '../service/devolucionService';
import { obtenerMateriales } from '../service/materialService';
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

interface AppContextType {
  state: AppState;
  refreshRemoteData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
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
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [refreshRemoteData]);

  return <AppContext.Provider value={{ state, refreshRemoteData }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore debe usarse dentro de AppProvider');
  return context;
}
