import { useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { createCoalescedTask } from '../../utils/coalescedTask';

// Postgres notifies immediately; polling also recovers missed changes after a disconnect.
export function useSistemasLive(tables: readonly string[], refresh: () => Promise<void>, enabled = true) {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; });
  const key = tables.join(',');
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const reload = createCoalescedTask(async () => { if (active) await callback.current(); });
    const notify = () => { if (active && document.visibilityState !== 'hidden') void reload().catch(() => { /* Callers display load errors. */ }); };
    const channel = supabase.channel(`sistemas-${crypto.randomUUID()}`);
    // DELETE notifications cannot reliably use row filters; refresh the visible resource.
    for (const table of key.split(',')) channel.on('postgres_changes', { event: '*', schema: 'public', table }, notify);
    channel.subscribe(status => { if (status === 'SUBSCRIBED') notify(); });
    const timer = window.setInterval(notify, 5000);
    window.addEventListener('focus', notify);
    window.addEventListener('online', notify);
    document.addEventListener('visibilitychange', notify);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', notify);
      window.removeEventListener('online', notify);
      document.removeEventListener('visibilitychange', notify);
      void supabase.removeChannel(channel);
    };
  }, [key, enabled]);
}
