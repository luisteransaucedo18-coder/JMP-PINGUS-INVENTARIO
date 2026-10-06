export function ownedBy(record: { analistaId?: string; analista: string }, user: { id: string; nombre: string }): boolean {
  return record.analistaId ? record.analistaId === user.id : record.analista === user.nombre;
}
