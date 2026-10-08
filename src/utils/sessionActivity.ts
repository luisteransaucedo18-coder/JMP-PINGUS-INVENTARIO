export const SESSION_IDLE_MS = 5 * 60 * 1000;
const ACTIVITY_KEY = 'jmp:session:last-activity';
let memoryActivity = 0;

export function readSessionActivity(): number {
  try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0; }
  catch { return memoryActivity; }
}
export function recordSessionActivity(now = Date.now()): void {
  memoryActivity = now;
  try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* In-memory expiry still applies. */ }
}
export function sessionIsIdle(now = Date.now()): boolean {
  const last = readSessionActivity();
  return !last || now - last >= SESSION_IDLE_MS;
}
