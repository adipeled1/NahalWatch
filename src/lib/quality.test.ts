import { describe, expect, it } from 'vitest';
import { ageLabel, assess, exceedances } from './quality';
import { backtestSeasonal, forecastFcoli, logistic, lotkaVolterra } from './models';

const sample = (v: Record<string, number>, q?: Record<string, '<' | '>'>) => ({ d: '2025-06-01', v, q });

describe('assess', () => {
  it('is red and names the bacteria + threshold when fecal coliforms exceed 1000', () => {
    const a = assess(sample({ Fcoli: 2400, BODt: 4 }));
    expect(a.status).toBe('danger');
    const [worst] = exceedances(a);
    expect(worst.key).toBe('Fcoli');
    expect(worst.message).toContain('קוליפורמים צואתיים');
    expect(worst.message).toContain('2,400');
    expect(worst.message).toContain('מעל הסף של 1,000');
  });

  it('is green and kid friendly for clean water', () => {
    const a = assess(sample({ Fcoli: 40, BODt: 2, NH4: 0.1 }));
    expect(a.status).toBe('safe');
    expect(a.kidFriendly).toBe(true);
    expect(exceedances(a)).toHaveLength(0);
  });

  it('chemistry alone can only raise to caution', () => {
    expect(assess(sample({ Fcoli: 50, NH4: 12 })).status).toBe('caution');
  });

  it('is unknown without any bacteria measurement', () => {
    expect(assess(sample({ BODt: 40 })).status).toBe('unknown');
  });

  it('does not count "<" values as exceedances', () => {
    expect(assess(sample({ Fcoli: 2000 }, { Fcoli: '<' })).status).toBe('safe');
  });

  it('flags low dissolved oxygen', () => {
    const a = assess(sample({ Fcoli: 10, Do: 1.2 }));
    expect(a.status).toBe('caution');
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
