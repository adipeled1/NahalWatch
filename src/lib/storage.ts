/**
 * On-device state. NahalWatch has no accounts (it's a public, news-style site),
 * so favorites, field reports and theme live in localStorage only — nothing is
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

// ── Field reports (device-only MVP) ────────────────────────────────────────
export type ReportKind = 'clear' | 'turbid' | 'trash' | 'smell' | 'crowded' | 'dry';
export interface FieldReport {
  id: string;
  stationId: string;
  kind: ReportKind;
  text: string;
  photo?: string; // downscaled JPEG data URL
  at: string;     // ISO timestamp
}

export const REPORT_KIND: Record<ReportKind, { label: string; tone: 'safe' | 'caution' | 'danger' }> = {
  clear: { label: 'מים צלולים', tone: 'safe' },
  turbid: { label: 'מים עכורים', tone: 'caution' },
  trash: { label: 'פסולת', tone: 'caution' },
  smell: { label: 'ריח חריג', tone: 'danger' },
  crowded: { label: 'עומס מטיילים', tone: 'caution' },
  dry: { label: 'יבש / אין זרימה', tone: 'caution' },
};

const NO_REPORTS: FieldReport[] = [];
export function useReports(stationId?: string) {
  const [all, setAll] = useStoredJson<FieldReport[]>('nw-reports', NO_REPORTS);
  const add = useCallback(
    (r: Omit<FieldReport, 'id' | 'at'>) =>
      setAll([{ ...r, id: crypto.randomUUID(), at: new Date().toISOString() }, ...all].slice(0, 100)),
    [all, setAll],
  );
  const remove = useCallback((id: string) => setAll(all.filter((r) => r.id !== id)), [all, setAll]);
  return { reports: stationId ? all.filter((r) => r.stationId === stationId) : all, add, remove };
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

/** Downscale a picked photo to ≤ 800px JPEG so it fits comfortably in localStorage. */
export async function compressPhoto(file: File, max = 800): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}
