import { createContext, useContext, useReducer, ReactNode } from 'react';
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

interface AppState {
  materials: Material[];
  requerimientos: Requerimiento[];
  users: Usuario[];
  proyectos: Proyecto[];
  entregas: Entrega[];
  compras: RequerimientoCompra[];
}

type Action =
  | { type: 'ADD_MATERIAL'; payload: Omit<Material, 'id' | 'estado'> }
  | { type: 'UPDATE_MATERIAL_STOCK'; payload: { id: string; stockSedes: Record<Sede, number>; minimo?: number } }
  | { type: 'CREATE_REQUERIMIENTO'; payload: { proyectoId: string; proyecto: string; sede: Sede; ubicacion: string; descripcion: string; tecnico: string; analista: string; materiales: ReqMaterial[]; draft: boolean } }
  | { type: 'SUBMIT_REQUERIMIENTO'; payload: string }
  | { type: 'CONFIRM_REQUERIMIENTO'; payload: { id: string; coordinador: string; observaciones?: string } }
  | { type: 'REJECT_REQUERIMIENTO'; payload: { id: string; coordinador: string; observaciones: string } }
  | { type: 'CREATE_USER'; payload: { nombre: string; email: string; rol: string; sede: Sede } }
  | { type: 'TOGGLE_USER_STATUS'; payload: string }
  | { type: 'CREATE_PROYECTO'; payload: Omit<Proyecto, 'id' | 'creadoEn'> }
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
let reqCounter = 10;
let userCounter = 20;
let pryCounter = 10;
let entCounter = 10;
let ocCounter = 10;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

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

    case 'CREATE_REQUERIMIENTO': {
      reqCounter++;
      const pad = String(reqCounter).padStart(3, '0');
      const id = `REQ-2026-${pad}`;
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        requerimientos: [...state.requerimientos, {
          id,
          proyectoId: action.payload.proyectoId,
          proyecto: action.payload.proyecto,
          sede: action.payload.sede,
          ubicacion: action.payload.ubicacion,
          descripcion: action.payload.descripcion,
          tecnico: action.payload.tecnico,
          analista: action.payload.analista,
          fecha: today,
          materiales: action.payload.materiales,
          estado: action.payload.draft ? 'BORRADOR' : 'ENVIADO',
        }],
      };
    }

    case 'SUBMIT_REQUERIMIENTO': {
      return {
        ...state,
        requerimientos: state.requerimientos.map(r =>
          r.id === action.payload && r.estado === 'BORRADOR'
            ? { ...r, estado: 'ENVIADO' }
            : r
        ),
      };
    }

    case 'CONFIRM_REQUERIMIENTO': {
      const req = state.requerimientos.find(r => r.id === action.payload.id);
      if (!req || req.estado !== 'ENVIADO') return state;
      const updatedMaterials = state.materials.map(mat => {
        const reqMat = req.materiales.find(m => m.skuId === mat.id);
        if (!reqMat) return mat;
        const newSedes = { ...mat.stockSedes };
        newSedes[req.sede] = Math.max(0, newSedes[req.sede] - reqMat.cantidad);
        return { ...mat, stockSedes: newSedes, estado: calcEstado(newSedes, mat.minimo) };
      });
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        materials: updatedMaterials,
        requerimientos: state.requerimientos.map(r =>
          r.id === action.payload.id
            ? { ...r, estado: 'CONFIRMADO', observaciones: action.payload.observaciones, confirmadoPor: action.payload.coordinador, fechaConfirmacion: today }
            : r
        ),
      };
    }

    case 'REJECT_REQUERIMIENTO': {
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        requerimientos: state.requerimientos.map(r =>
          r.id === action.payload.id
            ? { ...r, estado: 'RECHAZADO', observaciones: action.payload.observaciones, confirmadoPor: action.payload.coordinador, fechaConfirmacion: today }
            : r
        ),
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

    case 'CREATE_PROYECTO': {
      pryCounter++;
      const id = `PRY-${String(pryCounter).padStart(3, '0')}`;
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        proyectos: [...state.proyectos, { ...action.payload, id, creadoEn: today }],
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

interface AppContextType { state: AppState; dispatch: React.Dispatch<Action> }
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
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}
