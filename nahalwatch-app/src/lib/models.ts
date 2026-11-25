/**
 * Ecological models used by the app.
 *
 * 1. Logistic growth  dN/dt = r·N·(1 − N/K)
 *    Closed form: N(t) = K / (1 + ((K − N0)/N0)·e^(−r·t))
 *    Used for the 3-day bacteria forecast: the population starts at the last
 *    measured value N0 and relaxes toward the station's seasonal carrying
 *    capacity K (the historical median for that calendar month).
 *
 * 2. Lotka–Volterra predator–prey
 *    dB/dt = α·B − β·B·P      (B = bacteria, prey)
 *    dP/dt = δ·B·P − γ·P      (P = protozoan grazers, predator)
 *    Integrated with RK4 for the interactive "Models lab".
 */
import { severityOf } from './quality';
import { DAY_MS as DAY, dayValue, israelDay } from './time';
import type { Sample, Station } from './types';

export function logistic(t: number, n0: number, r: number, k: number): number {
  if (n0 <= 0) return 0;
  return k / (1 + ((k - n0) / n0) * Math.exp(-r * t));
}

export interface ForecastPoint {
  date: string;
  value: number;
  kind: 'measured' | 'forecast';
}

const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Seasonal carrying capacity K for a date: the station's monthly median, falling back to the yearly median. */
export function seasonalK(station: Pick<Station, 'fcoliMonthly'>, date: Date): number | null {
  const m = station.fcoliMonthly;
  if (!m) return null;
  const own = m[date.getUTCMonth()];
  if (own != null) return own;
  const known = m.filter((x): x is number => x != null).sort((a, b) => a - b);
  return known.length ? known[Math.floor(known.length / 2)] : null;
}

/**
 * Fecal-coliform forecast for today and the next `days` days.
 * r = 0.35/day ≈ half-way to the seasonal level in ~2–3 weeks, a typical
 * die-off/re-growth time scale for fecal indicator bacteria in streams.
 */
export function forecastFcoli(
  station: Pick<Station, 'fcoliMonthly' | 'latest'>,
  now: Date = new Date(),
  days = 3,
  r = 0.35,
): { points: ForecastPoint[]; k: number; n0: number; fromDate: string } | null {
  const n0 = station.latest.v.Fcoli;
  if (n0 == null) return null;
  const start = dayValue(station.latest.d);
  // "Today" is the Israeli calendar day (UTC is 2–3 hours behind just after midnight).
  const today = dayValue(israelDay(now));
  const points: ForecastPoint[] = [];
  let k = 0;
  for (let i = 0; i <= days; i++) {
    const t = today + i * DAY;
    const kt = seasonalK(station, new Date(t)) ?? n0;
    if (i === 0) k = kt;
    const elapsed = Math.max(0, (t - start) / DAY);
    points.push({ date: toIso(t), value: Math.round(logistic(elapsed, Math.max(n0, 1), r, Math.max(kt, 1))), kind: 'forecast' });
  }
  return { points, k, n0, fromDate: station.latest.d };
}

export interface LVParams {
  alpha: number; // bacteria growth rate
  beta: number;  // grazing rate
  delta: number; // grazer efficiency
  gamma: number; // grazer mortality
  b0: number;
  p0: number;
  days: number;
  dt?: number;
}

export function lotkaVolterra(p: LVParams): { t: number; prey: number; predator: number }[] {
  const dt = p.dt ?? 0.05;
  const f = (b: number, q: number) => [p.alpha * b - p.beta * b * q, p.delta * b * q - p.gamma * q];
  let b = p.b0;
  let q = p.p0;
  const out = [{ t: 0, prey: b, predator: q }];
  const steps = Math.round(p.days / dt);
  const every = Math.max(1, Math.round(0.25 / dt));
  for (let i = 1; i <= steps; i++) {
    const [k1b, k1q] = f(b, q);
    const [k2b, k2q] = f(b + (dt / 2) * k1b, q + (dt / 2) * k1q);
    const [k3b, k3q] = f(b + (dt / 2) * k2b, q + (dt / 2) * k2q);
    const [k4b, k4q] = f(b + dt * k3b, q + dt * k3q);
    b = Math.max(0, b + (dt / 6) * (k1b + 2 * k2b + 2 * k3b + k4b));
    q = Math.max(0, q + (dt / 6) * (k1q + 2 * k2q + 2 * k3q + k4q));
    if (i % every === 0) out.push({ t: +(i * dt).toFixed(2), prey: b, predator: q });
  }
  return out;
}

export function logisticSeries(n0: number, r: number, k: number, days: number) {
  return Array.from({ length: days * 4 + 1 }, (_, i) => {
    const t = i / 4;
    return { t, value: logistic(t, n0, r, k) };
  });
}

/**
 * "Model vs. field": leave-one-year-out seasonal model. Each measured sample is
 * predicted by the median of the same calendar month in OTHER years; returns the
 * pairs plus the share of samples whose traffic-light class the model got right.
 */
export function backtestSeasonal(samples: Sample[]) {
  const withF = samples.filter((s) => s.v.Fcoli != null);
  // Traffic-light class from the official rule in RULES (never a local copy of the limits).
  const cls = (v: number) => severityOf('Fcoli', v);
  const pairs: { date: string; measured: number; predicted: number }[] = [];
  for (const s of withF) {
    const month = s.d.slice(5, 7);
    const year = s.d.slice(0, 4);
    const pool = withF
      .filter((o) => o.d.slice(5, 7) === month && o.d.slice(0, 4) !== year)
      .map((o) => o.v.Fcoli)
      .sort((a, b) => a - b);
    if (!pool.length) continue;
    pairs.push({ date: s.d, measured: s.v.Fcoli, predicted: pool[Math.floor(pool.length / 2)] });
  }
  const hits = pairs.filter((p) => cls(p.measured) === cls(p.predicted)).length;
  return { pairs, accuracy: pairs.length ? hits / pairs.length : null };
}
