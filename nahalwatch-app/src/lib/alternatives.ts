/**
 * The "safe alternative" for the station page, split so the page's client island doesn't pull in the
 * station index: the server picks the nearby green stations, the browser checks their age.
 * (This module must not import lib/stationIndex.ts.)
 */
import { distanceKm } from './geo';
import { STALE_DAYS, ageInDays, assess } from './quality';
import type { Station } from './types';

/** A green station near another one, small enough to send to the browser with a single station page. */
export interface SafeCandidate { id: string; name: string; stream: string; d: string; km: number }

/**
 * Green stations within `maxKm`, nearest first: computed on the server for the station page.
 * Age isn't checked here (it depends on today's date); `pickSafeAlternative` does that in the browser.
 */
export function safeCandidatesNear(from: Station, stations: Station[], maxKm = 40, limit = 30): SafeCandidate[] {
  return stations
    .filter((s) => s.id !== from.id && assess(s.latest).status === 'safe')
    .map((s) => ({ id: s.id, name: s.name, stream: s.stream, d: s.latest.d, km: distanceKm(from, s) }))
    .filter((c) => c.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/** The nearest candidate with current data (sampled within STALE_DAYS), or null. */
export function pickSafeAlternative(candidates: SafeCandidate[], now: Date): SafeCandidate | null {
  return candidates.find((c) => ageInDays(c.d, now) <= STALE_DAYS) ?? null;
}
