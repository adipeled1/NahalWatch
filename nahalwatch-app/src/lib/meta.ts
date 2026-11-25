/**
 * Dataset summary (source, coverage, counts): ~1 KB, safe to import anywhere.
 * Deliberately separate from the station index, so the shell and other pages don't ship 100 KB of stations.
 */
import metaJson from '../../public/data/meta.json';
import type { DataMeta } from './types';

export const META = metaJson as DataMeta;
