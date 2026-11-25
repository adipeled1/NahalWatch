/**
 * The current time for client components, without breaking hydration.
 * Kept apart from time.ts so server components can import the date helpers (no React hook there).
 */
import { useSyncExternalStore } from 'react';

// ── useNow ─────────────────────────────────────────────────────────────────
// The pages are pre-rendered at build time. Anything that depends on "now" (sample age, the
// forecast, which stations count as old) would differ between that HTML and the browser and
// break hydration. `useNow()` is null on the server and during hydration, then the real time;
// it refreshes every 10 minutes so a tab left open rolls over to the next day.
let now: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, 10 * 60 * 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const getSnapshot = () => (now ??= Date.now());
const getServerSnapshot = () => null;

/** Current time in the browser; null on the server and during hydration. */
export function useNow(): Date | null {
  const t = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return t == null ? null : new Date(t);
}
