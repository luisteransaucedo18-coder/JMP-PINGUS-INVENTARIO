/** Serialize refreshes; many invalidations during a fetch request one follow-up pass. */
export function createCoalescedTask(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let pending = false;
  return () => {
    pending = true;
    if (!running) {
      running = Promise.resolve().then(async () => {
        try {
          while (pending) {
            pending = false;
            await task();
          }
        } finally {
          running = null;
        }
      });
    }
    return running;
  };
}
