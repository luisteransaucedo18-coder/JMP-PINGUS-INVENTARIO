import type { Proyecto } from '../data/mockData';
import { supabase } from './supabase';

type ProyectoRow = {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  sede: Proyecto['sede'];
  responsable: string;
  cliente: string;
  observaciones: string | null;
  created_at: string;
};

function mapProyecto(row: ProyectoRow): Proyecto {
  return {
    dbId: row.id,
    id: row.codigo,
    nombre: row.nombre,
    ubicacion: row.ubicacion,
    sede: row.sede,
    responsable: row.responsable,
    cliente: row.cliente,
    observaciones: row.observaciones ?? undefined,
    creadoEn: row.created_at.split('T')[0],
  };
}

export async function obtenerProyectos(): Promise<Proyecto[]> {
  const { data, error } = await supabase
    .from('proyectos')
    .select('id,codigo,nombre,ubicacion,sede,responsable,cliente,observaciones,created_at')
    .eq('activo', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(row => mapProyecto(row as ProyectoRow));
}

export async function crearProyecto(
  proyecto: Omit<Proyecto, 'id' | 'dbId' | 'creadoEn'>,
): Promise<Proyecto> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error('Sesion no valida.');

  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      nombre: proyecto.nombre,
      ubicacion: proyecto.ubicacion,
      sede: proyecto.sede,
      responsable: proyecto.responsable,
      cliente: proyecto.cliente,
      observaciones: proyecto.observaciones ?? null,
      creado_por: authData.user.id,
    })
    .select('id,codigo,nombre,ubicacion,sede,responsable,cliente,observaciones,created_at')
    .single();

  if (error) throw error;
  return mapProyecto(data as ProyectoRow);
}
