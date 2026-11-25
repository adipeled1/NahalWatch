/**
 * The station index (~100 KB): every station with its latest sample. Import it only where all stations
 * are needed (map, lists, models, server pages); a single station page gets its station as a prop.
 */
import stationsJson from '../../public/data/stations.json';
import type { Station } from './types';

export const STATIONS = stationsJson as unknown as Station[];
export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
