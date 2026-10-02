export function fechaLima(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}

export function inicioPeriodo(dias: number, hasta: string): string {
  const date = new Date(`${hasta}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - dias + 1);
  return date.toISOString().slice(0, 10);
}

export function enPeriodo(fecha: string, desde: string, hasta: string): boolean {
  const day = fecha.slice(0, 10);
  return !(desde && hasta && desde > hasta) && (!desde || day >= desde) && (!hasta || day <= hasta);
}

export function describirPeriodo(desde: string, hasta: string): string {
  const format = (date: string) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  if (desde && hasta) return `Del ${format(desde)} al ${format(hasta)}`;
  if (desde) return `Desde el ${format(desde)}`;
  if (hasta) return `Hasta el ${format(hasta)}`;
  return 'Todo el historial disponible';
}
