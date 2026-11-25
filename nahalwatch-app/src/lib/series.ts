/** A station's full history, fetched on demand from /data/series/<id>.json (browser only). */
import type { Sample } from './types';

const seriesCache = new Map<string, Promise<Sample[]>>();

export function loadSeries(id: string): Promise<Sample[]> {
  if (!seriesCache.has(id)) {
    const p = fetch(`/data/series/${encodeURIComponent(id)}.json`).then((r) => {
      if (!r.ok) throw new Error(`series ${id}: ${r.status}`);
      return r.json() as Promise<Sample[]>;
    });
    p.catch(() => seriesCache.delete(id));
    seriesCache.set(id, p);
  }
  return seriesCache.get(id)!;
}
