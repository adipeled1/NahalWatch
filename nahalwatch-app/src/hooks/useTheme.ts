/**
 * Light/dark theme. NahalWatch has no accounts (it's a public, news-style site), so the only
 * saved state is the theme, in localStorage — nothing is sent anywhere (privacy NFR).
 * Every access is guarded: storage can be blocked. The boot script in layout.tsx applies the saved
 * theme before paint; this hook reads it from <html data-theme> and toggles it.
 */
import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener('storage', l);
  return () => { listeners.delete(l); window.removeEventListener('storage', l); };
};

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  emit();
}

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
    save('nw-theme', next);
  }, [theme]);
  return [theme, toggle];
}
