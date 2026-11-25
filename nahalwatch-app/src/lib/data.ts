/**
 * Data access. The station index is small (~100 KB) and imported straight into
 * the bundle so the map renders without a round-trip; each station's full
 * history is fetched on demand from /data/series/<id>.json.
 */
import { useCallback, useEffect, useState } from 'react';
import stationsJson from '../../public/data/stations.json';
import metaJson from '../../public/data/meta.json';
import type { DataMeta, Region, Sample, Station } from './types';

export const STATIONS = stationsJson as unknown as Station[];
export const META = metaJson as DataMeta;
export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

export const REGION_LABEL: Record<Region | 'all', string> = {
  all: 'כל הארץ',
  north: 'צפון',
  center: 'מרכז',
  south: 'דרום',
};

/** Default map focus: where the Snir (Hatzbani), Dan and Hermon (Banias) join to form the Jordan, by Kfar Blum & Amir. */
export const HOME_VIEW = { center: [33.185, 35.622] as [number, number], zoom: 12 };
export const CONFLUENCE = { lat: 33.196, lng: 35.62, label: 'מפגש השניר, הדן והחרמון — תחילת הירדן' };

export const REGION_BOUNDS: Record<Region | 'all', [[number, number], [number, number]]> = {
  all: [[29.5, 34.2], [33.35, 35.9]],
  north: [[32.45, 34.85], [33.33, 35.75]],
  center: [[31.55, 34.6], [32.5, 35.6]],
  south: [[30.9, 34.25], [31.6, 35.2]],
};

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

/** A station's full history. `error` is set when it can't be loaded (e.g. offline); `retry` tries again. */
export function useSeries(id: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; data: Sample[] | null; error: string | null }>({
    key: null, data: null, error: null,
  });
  const key = id ? `${id}#${attempt}` : null;
  useEffect(() => {
    if (!id || !key) return;
    let alive = true;
    loadSeries(id)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: Error) => alive && setState({ key, data: null, error: e.message || 'load failed' }));
    return () => { alive = false; };
  }, [id, key]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!id && !current, retry };
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
