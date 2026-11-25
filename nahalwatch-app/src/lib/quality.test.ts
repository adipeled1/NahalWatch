import { describe, expect, it } from 'vitest';
import { ageInDays, ageLabel, assess, exceedances } from './quality';
import { backtestSeasonal, forecastFcoli, logistic, lotkaVolterra } from './models';
import { nearestSafe } from './stations';
import { pickSafeAlternative, safeCandidatesNear } from './alternatives';
import type { Station } from './types';

const sample = (v: Record<string, number>, q?: Record<string, '<' | '>'>) => ({ d: '2025-06-01', v, q });

describe('assess', () => {
  it('is red and names the bacteria + official threshold when fecal coliforms exceed 400', () => {
    const a = assess(sample({ Fcoli: 2400, BODt: 4 }));
    expect(a.status).toBe('danger');
    const [worst] = exceedances(a);
    expect(worst.key).toBe('Fcoli');
    expect(worst.message).toContain('קוליפורמים צואתיים');
    expect(worst.message).toContain('2,400');
    expect(worst.message).toContain('מעל הסף של 400');
    expect(worst.message).toContain('משרד הבריאות');
  });

  it('is green only when every official limit is met', () => {
    const a = assess(sample({ Fcoli: 40, BODt: 2, NH4: 0.1 }));
    expect(a.status).toBe('safe');
    expect(exceedances(a)).toHaveLength(0);
  });

  it('turns amber and lists each parameter above its Inbar limit', () => {
    const a = assess(sample({ Fcoli: 50, NH4: 2, Ptot: 1.5 }));
    expect(a.status).toBe('caution');
    const keys = exceedances(a).map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['NH4', 'Ptot']));
    expect(exceedances(a)[0].verdict).toContain('תקנות ענבר');
  });

  it('turns red when a parameter is above its Inbar maximum value', () => {
    const a = assess(sample({ Fcoli: 50, NH4: 12 }));
    expect(a.status).toBe('danger');
    expect(exceedances(a)[0].verdict).toContain('ערך מרבי');
  });

  it('is amber for fecal coliforms between 200 and 400', () => {
    expect(assess(sample({ Fcoli: 300 })).status).toBe('caution');
  });

  it('ignores parameters with no official limit', () => {
    expect(assess(sample({ Fcoli: 50, Ecoli: 5000, Temp: 30 })).status).toBe('safe');
  });

  it('is unknown without fecal coliforms unless something else exceeds', () => {
    expect(assess(sample({ BODt: 5 })).status).toBe('unknown');
    expect(assess(sample({ BODt: 12 })).status).toBe('caution');
  });

  it('does not count "<" values as exceedances', () => {
    expect(assess(sample({ Fcoli: 2000 }, { Fcoli: '<' })).status).toBe('safe');
  });

  it('flags low dissolved oxygen as red', () => {
    const a = assess(sample({ Fcoli: 10, Do: 1.2 }));
    expect(a.status).toBe('danger');
    expect(exceedances(a)[0].message).toContain('מתחת למינימום');
  });
});

describe('ageLabel', () => {
  it('formats relative ages', () => {
    const now = new Date('2026-01-10T12:00:00Z');
    expect(ageLabel('2026-01-10', now)).toBe('היום');
    expect(ageLabel('2026-01-05', now)).toBe('לפני 5 ימים');
    expect(ageLabel('2024-01-01', now)).toBe('לפני 2 שנים');
    expect(ageLabel('2025-01-12', now)).toBe('לפני שנה');
  });

  it('counts days in Israel time, not UTC', () => {
    // 01:00 in Israel on Nov 26 is still Nov 25 in UTC: yesterday's sample is "אתמול", not "היום".
    const afterMidnight = new Date('2026-11-25T23:00:00Z');
    expect(ageInDays('2026-11-25', afterMidnight)).toBe(1);
    expect(ageLabel('2026-11-25', afterMidnight)).toBe('אתמול');
    expect(ageLabel('2026-11-26', afterMidnight)).toBe('היום');
  });
});

describe('nearestSafe', () => {
  const station = (id: string, d: string, Fcoli: number, lat = 33): Station => ({
    id, code: 1, name: id, stream: 'נחל', region: 'north', lat, lng: 35.6, approxLocation: true,
    sampleCount: 1, firstSample: d, latest: { d, v: { Fcoli } }, fcoliMonthly: null,
  });
  const now = new Date('2026-11-25T12:00:00Z');
  const rate = (s: Station) => ({ station: s, assessment: assess(s.latest), ageDays: ageInDays(s.latest.d, now), old: false });

  it('never suggests a station whose data is stale', () => {
    const from = station('bad', '2026-11-20', 5000);
    const staleSafe = station('stale', '2024-06-01', 20, 33.01); // ~2.5 years old: not "old", but stale
    const recentSafe = station('recent', '2026-10-01', 20, 33.1);
    expect(nearestSafe(from, [rate(staleSafe)])).toBeNull();
    expect(nearestSafe(from, [rate(staleSafe), rate(recentSafe)])?.r.station.id).toBe('recent');
  });

  it('station page: the server lists nearby green stations, the browser skips stale ones', () => {
    const from = station('bad', '2026-11-20', 5000);
    const all = [from, station('stale', '2024-06-01', 20, 33.01), station('red', '2026-11-01', 900, 33.02), station('recent', '2026-10-01', 20, 33.1), station('far', '2026-10-01', 20, 34)];
    const candidates = safeCandidatesNear(from, all);
    expect(candidates.map((c) => c.id)).toEqual(['stale', 'recent']); // green, within 40 km, nearest first
    expect(pickSafeAlternative(candidates, now)?.id).toBe('recent');
  });
});

describe('models', () => {
  it('logistic converges to K', () => {
    expect(logistic(0, 10, 0.5, 1000)).toBeCloseTo(10);
    expect(logistic(100, 10, 0.5, 1000)).toBeCloseTo(1000, 0);
    expect(logistic(100, 5000, 0.5, 300)).toBeCloseTo(300, 0);
  });

  it('forecast relaxes the last sample toward the seasonal median', () => {
    const monthly = Array(12).fill(300);
    const f = forecastFcoli({ fcoliMonthly: monthly, latest: { d: '2026-01-01', v: { Fcoli: 5000 } } }, new Date('2026-01-02T00:00:00Z'));
    expect(f).not.toBeNull();
    expect(f!.points).toHaveLength(4);
    expect(f!.points[0].value).toBeLessThan(5000);
    expect(f!.points[3].value).toBeLessThan(f!.points[0].value);
    expect(f!.points[3].value).toBeGreaterThan(300);
  });

  it('forecast starts on the Israeli calendar day', () => {
    const f = forecastFcoli({ fcoliMonthly: null, latest: { d: '2026-11-20', v: { Fcoli: 100 } } }, new Date('2026-11-25T23:00:00Z'));
    expect(f!.points[0].date).toBe('2026-11-26');
  });

  it('Lotka-Volterra stays positive and oscillates', () => {
    const s = lotkaVolterra({ alpha: 1, beta: 0.1, delta: 0.075, gamma: 1.5, b0: 10, p0: 5, days: 30 });
    expect(s.every((p) => p.prey >= 0 && p.predator >= 0)).toBe(true);
    const preys = s.map((p) => p.prey);
    expect(Math.max(...preys)).toBeGreaterThan(Math.min(...preys) * 2);
  });

  it('backtest pairs samples with other-year monthly medians', () => {
    const samples = [
      { d: '2020-06-01', v: { Fcoli: 100 } },
      { d: '2021-06-01', v: { Fcoli: 150 } },
      { d: '2022-06-01', v: { Fcoli: 120 } },
      { d: '2023-06-01', v: { Fcoli: 5000 } },
    ];
    const r = backtestSeasonal(samples);
    expect(r.pairs).toHaveLength(4);
    // The 5000 spike is the one the seasonal model cannot foresee.
    expect(r.accuracy).toBeCloseTo(3 / 4);
  });
});
