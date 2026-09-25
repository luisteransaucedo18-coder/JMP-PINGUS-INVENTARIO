import { createContext, useContext, useEffect, useReducer, useState, ReactNode } from 'react';
import {
  Material, Requerimiento, Usuario, ReqMaterial, Proyecto, Entrega, EntregaItem,
  RequerimientoCompra, CompraItem,
  EstadoMaterial, Sede,
  materials as initMaterials,
  requerimientos as initReqs,
  usuarios as initUsuarios,
  proyectos as initProyectos,
  entregas as initEntregas,
  compras as initCompras,
} from '../data/mockData';
import { obtenerMateriales } from '../service/materialService';
import { crearProyecto, obtenerProyectos } from '../service/proyectoService';
import { supabase } from '../service/supabase';
import {
  crearRequerimiento,
  enviarRequerimiento,
  obtenerRequerimientos,
  revisarRequerimiento,
} from '../service/requerimientoService';

interface AppState {
  materials: Material[];
  requerimientos: Requerimiento[];
  users: Usuario[];
  proyectos: Proyecto[];
  entregas: Entrega[];
  compras: RequerimientoCompra[];
}

type Action =
  | { type: 'SET_MATERIALS'; payload: Material[] }
  | { type: 'SET_PROYECTOS'; payload: Proyecto[] }
  | { type: 'SET_REQUERIMIENTOS'; payload: Requerimiento[] }
  | { type: 'UPSERT_PROYECTO'; payload: Proyecto }
  | { type: 'UPSERT_REQUERIMIENTO'; payload: Requerimiento }
  | { type: 'ADD_MATERIAL'; payload: Omit<Material, 'id' | 'estado'> }
  | { type: 'UPDATE_MATERIAL_STOCK'; payload: { id: string; stockSedes: Record<Sede, number>; minimo?: number } }
  | { type: 'CREATE_USER'; payload: { nombre: string; email: string; rol: string; sede: Sede } }
  | { type: 'TOGGLE_USER_STATUS'; payload: string }
  | { type: 'CREATE_ENTREGA'; payload: { requerimientoId: string; proyectoNombre: string; tecnico: string; dniTecnico: string; responsableEntrega: string; items: EntregaItem[]; observaciones?: string } }
  | { type: 'CREATE_COMPRA'; payload: { sede: Sede; analista: string; motivo: string; items: CompraItem[]; draft: boolean } }
  | { type: 'APPROVE_COMPRA'; payload: { id: string; coordinador: string; observaciones?: string } }
  | { type: 'REJECT_COMPRA'; payload: { id: string; coordinador: string; observaciones: string } }
  | { type: 'CONFIRM_COMPRA'; payload: { id: string; coordinador: string; notaCompra?: string } };

function calcEstado(stockSedes: Record<Sede, number>, minimo: number): EstadoMaterial {
  const total = Object.values(stockSedes).reduce((s, v) => s + v, 0);
  if (total === 0) return 'AGOTADO';
  if (total <= Math.ceil(minimo * 0.3)) return 'CRÍTICO';
  if (total <= minimo) return 'BAJO';
  return 'OK';
}

let matCounter = 100;
let userCounter = 20;
let entCounter = 10;
let ocCounter = 10;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'SET_MATERIALS':
      return { ...state, materials: action.payload };

    case 'SET_PROYECTOS':
      return { ...state, proyectos: action.payload };

    case 'SET_REQUERIMIENTOS':
      return { ...state, requerimientos: action.payload };

    case 'UPSERT_PROYECTO':
      return {
        ...state,
        proyectos: [action.payload, ...state.proyectos.filter(item => item.id !== action.payload.id)],
      };

    case 'UPSERT_REQUERIMIENTO':
      return {
        ...state,
        requerimientos: [action.payload, ...state.requerimientos.filter(item => item.id !== action.payload.id)],
      };

    case 'ADD_MATERIAL': {
      const prefix = action.payload.categoria.substring(0, 3).toUpperCase();
      matCounter++;
      const id = `${prefix}-${String(matCounter).padStart(4, '0')}`;
      const { stockSedes, minimo } = action.payload;
      return {
        ...state,
        materials: [...state.materials, {
          ...action.payload,
          id,
          unidad: 'UND',
          estado: calcEstado(stockSedes, minimo),
        }],
      };
    }

    case 'UPDATE_MATERIAL_STOCK': {
      return {
        ...state,
        materials: state.materials.map(m => {
          if (m.id !== action.payload.id) return m;
          const stockSedes = action.payload.stockSedes;
          const minimo = action.payload.minimo ?? m.minimo;
          return { ...m, stockSedes, minimo, estado: calcEstado(stockSedes, minimo) };
        }),
      };
    }

    case 'CREATE_USER': {
      userCounter++;
      const id = `USR-${String(userCounter).padStart(3, '0')}`;
      return {
        ...state,
        users: [...state.users, {
          id,
          nombre: action.payload.nombre,
          email: action.payload.email,
          rol: action.payload.rol as any,
          sede: action.payload.sede,
          estado: 'ACTIVO',
          ultimo_acceso: '—',
          codigo: ''
        }],
      };
    }

    case 'TOGGLE_USER_STATUS': {
      return {
        ...state,
        users: state.users.map(u =>
          u.id === action.payload ? { ...u, estado: u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' } : u
        ),
      };
    }

    case 'CREATE_ENTREGA': {
      entCounter++;
      const id = `ENT-2026-${String(entCounter).padStart(3, '0')}`;
      const today = new Date().toISOString().split('T')[0];
      const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const allComplete = action.payload.items.every(i => i.cantidadEntregada >= i.cantidadSolicitada);
      const someDelivered = action.payload.items.some(i => i.cantidadEntregada > 0);
      const estado = allComplete ? 'COMPLETA' : someDelivered ? 'PARCIAL' : 'PENDIENTE';
      return {
        ...state,
        entregas: [...state.entregas, {
          id,
          requerimientoId: action.payload.requerimientoId,
          proyectoNombre: action.payload.proyectoNombre,
          tecnico: action.payload.tecnico,
          dniTecnico: action.payload.dniTecnico,
          responsableEntrega: action.payload.responsableEntrega,
          fecha: today,
          hora,
          items: action.payload.items,
          estado,
          observaciones: action.payload.observaciones,
        }],
      };
    }

    case 'CREATE_COMPRA': {
      ocCounter++;
      const id = `OC-2026-${String(ocCounter).padStart(3, '0')}`;
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        compras: [...state.compras, {
          id,
          sede: action.payload.sede,
          analista: action.payload.analista,
          fecha: today,
          motivo: action.payload.motivo,
          items: action.payload.items,
          estado: action.payload.draft ? 'BORRADOR' : 'ENVIADO',
        }],
      };
    }

    case 'APPROVE_COMPRA': {
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        compras: state.compras.map(c =>
          c.id !== action.payload.id ? c : {
            ...c,
            estado: 'APROBADO',
            coordinador: action.payload.coordinador,
            observaciones: action.payload.observaciones,
            fechaAprobacion: today,
          }
        ),
      };
    }

    case 'REJECT_COMPRA': {
      return {
        ...state,
        compras: state.compras.map(c =>
          c.id !== action.payload.id ? c : {
            ...c,
            estado: 'RECHAZADO',
            coordinador: action.payload.coordinador,
            observaciones: action.payload.observaciones,
          }
        ),
      };
    }

    case 'CONFIRM_COMPRA': {
      const today = new Date().toISOString().split('T')[0];
      const compra = state.compras.find(c => c.id === action.payload.id);
      if (!compra) return state;
      const updatedMaterials = state.materials.map(mat => {
        const item = compra.items.find(i => i.skuId === mat.id);
        if (!item) return mat;
        const newStock = { ...mat.stockSedes };
        newStock[compra.sede] = (newStock[compra.sede] ?? 0) + item.cantidadSolicitada;
        return { ...mat, stockSedes: newStock, estado: calcEstado(newStock, mat.minimo) };
      });
      return {
        ...state,
        materials: updatedMaterials,
        compras: state.compras.map(c =>
          c.id !== action.payload.id ? c : {
            ...c,
            estado: 'COMPRADO',
            coordinador: action.payload.coordinador,
            fechaCompra: today,
            notaCompra: action.payload.notaCompra,
          }
        ),
      };
    }

    default: return state;
  }
}

type NuevoProyecto = Omit<Proyecto, 'id' | 'dbId' | 'creadoEn'>;
type NuevoRequerimiento = {
  proyectoId: string;
  proyecto: string;
  sede: Sede;
  ubicacion: string;
  descripcion: string;
  tecnico: string;
  analista: string;
  materiales: ReqMaterial[];
  draft: boolean;
};

interface DatabaseActions {
  createProject: (payload: NuevoProyecto) => Promise<Proyecto>;
  createRequirement: (payload: NuevoRequerimiento) => Promise<Requerimiento>;
  submitRequirement: (id: string) => Promise<Requerimiento>;
  reviewRequirement: (id: string, confirm: boolean, observations?: string) => Promise<Requerimiento>;
  refresh: () => Promise<void>;
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  dbActions: DatabaseActions;
  loadingDatabase: boolean;
}
const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    materials: initMaterials.map(m => ({ ...m })),
    requerimientos: initReqs.map(r => ({ ...r })),
    users: initUsuarios.map(u => ({ ...u })),
    proyectos: initProyectos.map(p => ({ ...p })),
    entregas: initEntregas.map(e => ({ ...e })),
    compras: initCompras.map(c => ({ ...c })),
  });
  const [loadingDatabase, setLoadingDatabase] = useState(true);

  const refresh = async () => {
    const [materials, projects, requirements] = await Promise.all([
      obtenerMateriales(),
      obtenerProyectos(),
      obtenerRequerimientos(),
    ]);
    dispatch({ type: 'SET_MATERIALS', payload: materials });
    dispatch({ type: 'SET_PROYECTOS', payload: projects });
    dispatch({ type: 'SET_REQUERIMIENTOS', payload: requirements });
  };

  useEffect(() => {
    let active = true;
    setLoadingDatabase(true);
    refresh()
      .catch(error => console.error('Error cargando datos de Supabase:', error))
      .finally(() => { if (active) setLoadingDatabase(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const syncFromDatabase = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refresh().catch(error => console.error('Error sincronizando cambios de Supabase:', error));
      }, 150);
    };

    const channel = supabase
      .channel('operational-data-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, syncFromDatabase)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos' }, syncFromDatabase)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimiento_items' }, syncFromDatabase)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_sedes' }, syncFromDatabase)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const dbActions: DatabaseActions = {
    createProject: async payload => {
      const project = await crearProyecto(payload);
      dispatch({ type: 'UPSERT_PROYECTO', payload: project });
      return project;
    },
    createRequirement: async payload => {
      const project = state.proyectos.find(item => item.id === payload.proyectoId || item.nombre === payload.proyecto);
      if (!project?.dbId) throw new Error('Selecciona un proyecto guardado en la base de datos.');
      const requirement = await crearRequerimiento({
        proyectoDbId: project.dbId,
        sede: payload.sede,
        ubicacion: payload.ubicacion,
        descripcion: payload.descripcion,
        tecnico: payload.tecnico,
        materiales: payload.materiales,
        draft: payload.draft,
      });
      dispatch({ type: 'UPSERT_REQUERIMIENTO', payload: requirement });
      return requirement;
    },
    submitRequirement: async id => {
      const current = state.requerimientos.find(item => item.id === id);
      if (!current) throw new Error('No se encontro el requerimiento.');
      const requirement = await enviarRequerimiento(current);
      dispatch({ type: 'UPSERT_REQUERIMIENTO', payload: requirement });
      return requirement;
    },
    reviewRequirement: async (id, confirm, observations) => {
      const current = state.requerimientos.find(item => item.id === id);
      if (!current) throw new Error('No se encontro el requerimiento.');
      const requirement = await revisarRequerimiento(current, confirm, observations);
      dispatch({ type: 'UPSERT_REQUERIMIENTO', payload: requirement });
      if (confirm) {
        const materials = await obtenerMateriales();
        dispatch({ type: 'SET_MATERIALS', payload: materials });
      }
      return requirement;
    },
    refresh,
  };

  return <AppContext.Provider value={{ state, dispatch, dbActions, loadingDatabase }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}
