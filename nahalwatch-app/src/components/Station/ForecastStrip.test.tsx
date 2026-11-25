import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ForecastStrip } from './ForecastStrip';

afterEach(cleanup);

const forecast = {
  k: 100,
  n0: 2400,
  fromDate: '2026-11-23',
  points: [
    { date: '2026-11-25', value: 191, kind: 'forecast' as const },
    { date: '2026-11-26', value: 140, kind: 'forecast' as const },
    { date: '2026-11-27', value: 120, kind: 'forecast' as const },
    { date: '2026-11-28', value: 110, kind: 'forecast' as const },
  ],
};

describe('ForecastStrip', () => {
  it('never shows "תקין" under a red verdict, even when the model predicts a drop', () => {
    render(<ForecastStrip forecast={forecast} status="danger" />);
    expect(screen.queryByText('תקין')).toBeNull();
    expect(screen.getAllByText('אזהרה')).toHaveLength(4);
    expect(screen.getByText(/רק דגימה חדשה יכולה לבטל אזהרה/)).toBeTruthy();
  });

  it('shows the modelled color when the measured status is green', () => {
    render(<ForecastStrip forecast={forecast} status="safe" />);
    expect(screen.getAllByText('תקין')).toHaveLength(4);
    expect(screen.queryByText(/רק דגימה חדשה/)).toBeNull();
  });
});
