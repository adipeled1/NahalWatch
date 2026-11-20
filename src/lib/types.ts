export type Region = 'north' | 'center' | 'south';

/** One field/lab sample as produced by scripts/build-data.mjs. */
export interface Sample {
  /** ISO day, e.g. "2025-11-04" */
  d: string;
  /** parameter key -> numeric value (keys are the Excel header token, e.g. "Fcoli", "BODt") */
  v: Record<string, number>;
  /** "<" / ">" qualifiers for values reported as below/above detection limits */
  q?: Record<string, '<' | '>'>;
  color?: string;
  note?: string;
  lab?: string;
}

export interface Station {
  id: string;
  code: number;
  name: string;
  stream: string;
  region: Region;
  lat: number;
  lng: number;
  /** Coordinates were placed by hand from the station name — the source data has no GPS. */
  approxLocation: boolean;
  sampleCount: number;
  firstSample: string;
  latest: Sample;
  /** Median fecal coliforms per calendar month (Jan..Dec), null where never measured. */
  fcoliMonthly: (number | null)[] | null;
}

export interface DataMeta {
  source: string;
  sourceDescription: string;
  generatedAt: string;
  rowCount: number;
  stationCount: number;
  streamCount: number;
  firstSample: string;
  lastSample: string;
  parameters: string[];
}
