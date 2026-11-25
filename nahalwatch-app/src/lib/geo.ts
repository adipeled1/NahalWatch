/** Map geography: regions, default view and distance. No station data here. */
import type { Region } from './types';

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

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
