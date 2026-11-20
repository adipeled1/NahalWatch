/**
 * On-device state. NahalWatch has no accounts (it's a public, news-style site),
 * so favorites and theme live in localStorage only — nothing is
 * sent anywhere (privacy NFR). Every access is guarded: storage can be blocked.
 */
import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener('storage', l);
  return () => { listeners.delete(l); window.removeEventListener('storage', l); };
};

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  emit();
}

function useStoredJson<T>(key: string, fallback: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = fallback;
  if (raw) { try { value = JSON.parse(raw) as T; } catch { /* corrupt → fallback */ } }
  const set = useCallback((v: T) => write(key, JSON.stringify(v)), [key]);
  return [value, set];
}

// ── Favorites ──────────────────────────────────────────────────────────────
const EMPTY: string[] = [];
export function useFavorites() {
  const [ids, setIds] = useStoredJson<string[]>('nw-favorites', EMPTY);
  const toggle = useCallback(
    (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    [ids, setIds],
  );
  return { favorites: ids, isFavorite: (id: string) => ids.includes(id), toggle };
}

// ── Theme ──────────────────────────────────────────────────────────────────
export type Theme = 'light' | 'dark';
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
    () => 'light' as Theme,
  ) as Theme;
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    write('nw-theme', next);
  }, [theme]);
  return [theme, toggle];
}
