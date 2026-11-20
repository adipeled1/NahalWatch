/** Derived, app-wide views over the station index (computed once per load). */
import { STATIONS, distanceKm } from './data';
import { ageInDays, assess, type Assessment, type Status } from './quality';
import type { Station } from './types';

/** Stations not sampled for this long are dimmed on the map and hidden by default. */
export const OLD_DAYS = 3 * 365;

export interface RatedStation {
  station: Station;
  assessment: Assessment;
  ageDays: number;
  old: boolean;
}

export function rateAll(now: Date = new Date()): RatedStation[] {
  return STATIONS.map((station) => {
    const ageDays = ageInDays(station.latest.d, now);
    return { station, assessment: assess(station.latest), ageDays, old: ageDays > OLD_DAYS };
  });
}

/** Closest station with green status and reasonably recent data — the "safe alternative". */
export function nearestSafe(from: Station, rated: RatedStation[], maxKm = 40) {
  let best: { r: RatedStation; km: number } | null = null;
  for (const r of rated) {
    if (r.station.id === from.id || r.old || r.assessment.status !== 'safe') continue;
    const km = distanceKm(from, r.station);
    if (km <= maxKm && (!best || km < best.km)) best = { r, km };
  }
  return best;
}

export function countByStatus(list: RatedStation[]): Record<Status, number> {
  const c: Record<Status, number> = { safe: 0, caution: 0, danger: 0, unknown: 0 };
  for (const r of list) c[r.assessment.status]++;
  return c;
}

/** Rough driving time for the alternative-stream hint (winding rural roads ≈ 50 km/h). */
export const driveMinutes = (km: number) => Math.max(5, Math.round((km * 1.3) / 50 * 60 / 5) * 5);
