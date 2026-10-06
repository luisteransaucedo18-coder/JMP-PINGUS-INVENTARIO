export function limaDate(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}
export function limaTime(date = new Date()): string {
  return date.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
}
