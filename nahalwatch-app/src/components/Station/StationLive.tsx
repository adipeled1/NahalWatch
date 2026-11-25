'use client';
/**
 * The client islands of the station page. Everything else on that page is rendered on the server
 * (StationDetail.tsx); only what depends on today's date or loads in the browser lives here.
 * The page is pre-rendered at build time, so these wait for the browser's clock (useNow is null
 * until hydration) and the server HTML always matches the first client render.
 */
import Link from 'next/link';
import { useMemo } from 'react';
import { CalendarClock, LineChart as LineIcon, Navigation } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { useSeries } from '@/hooks/useSeries';
import { forecastFcoli } from '@/lib/models';
import { STALE_DAYS, ageInDays, ageLabel, fmt, type Status } from '@/lib/quality';
import { pickSafeAlternative, type SafeCandidate } from '@/lib/alternatives';
import type { Station } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadError } from '@/components/ui/LoadError';
import { StatusBadge } from '@/components/ui/Status';
import { ForecastStrip } from './ForecastStrip';
import { HistoryChart } from './HistoryChart';

/** Sample days are calendar days: format them in UTC so server and browser print the same date. */
const sampleDateFmt =new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "דגימה אחרונה: <date> (<age>)", amber with a warning when the sample is stale. */
export function LatestSampleAge({ day, lab }: { day: string; lab?: string }) {
  const now = useNow();
  const stale = now ? ageInDays(day, now) > STALE_DAYS : false;
  return (
    <>
      <div className={`flex items-center gap-2 text-sm ${stale ? 'text-caution' : 'text-muted'}`}>
        <CalendarClock className="size-4 shrink-0" aria-hidden />
        דגימה אחרונה: {sampleDateFmt.format(new Date(day))}{now && ` (${ageLabel(day, now)})`}
        {lab && <span className="text-faint">· מעבדת {lab}</span>}
      </div>
      {stale && (
        <p className="rounded-lg bg-caution-soft px-3 py-2 text-xs text-caution">
          הנתון האחרון ישן מ-{Math.round(STALE_DAYS / 30)} חודשים. המצב בשטח עשוי להיות שונה — התחזית מבוססת על הנתונים ההיסטוריים של התחנה.
        </p>
      )}
    </>
  );
}

/** The 3-day forecast and, for a non-green station, the nearest green one with current data. */
export function ForecastAndAlternative({
  station,
  status,
  candidates,
}: {
  station: Pick<Station, 'latest' | 'fcoliMonthly'>;
  status: Status;
  candidates: SafeCandidate[];
}) {
  const now = useNow();
  const forecast = useMemo(() => (now ? forecastFcoli(station, now) : null), [station, now]);
  const alt = now && status !== 'safe' ? pickSafeAlternative(candidates, now) : null;

  return (
    <div className="flex flex-col gap-4">
      {forecast && (
        <Card>
          <CardHeader icon={<LineIcon className="size-4" />} title="תחזית ל-3 הימים הקרובים" subtitle="מודל גידול לוגיסטי — מהדגימה האחרונה אל הרמה העונתית האופיינית לתחנה" />
          <div className="px-4 pb-4">
            <ForecastStrip forecast={forecast} status={status} />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              N₀ = <span className="num">{fmt(forecast.n0)}</span> ({forecast.fromDate}), K = חציון חודשי היסטורי ={' '}
              <span className="num">{fmt(forecast.k)}</span>, r = 0.35 ליום. <Link href="/models" className="font-semibold text-water underline">איך זה עובד?</Link>
            </p>
          </div>
        </Card>
      )}
      {alt && now && (
        <Link href={`/station/${alt.id}`} className="flex items-center gap-3 rounded-2xl border border-safe/30 bg-safe-soft p-4">
          <Navigation className="size-6 shrink-0 text-safe" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-safe">חלופה בטוחה קרובה</div>
            <div className="truncate text-sm">{alt.stream} · {alt.name}</div>
            <div className="text-xs text-muted">
              {fmt(Math.round(alt.km))} ק״מ בקו אוויר · נדגמה {ageLabel(alt.d, now)}
            </div>
          </div>
          <StatusBadge status="safe" />
        </Link>
      )}
    </div>
  );
}

/** The history chart: loads /data/series/<id>.json in the browser. */
export function StationHistory({ id }: { id: string }) {
  const { data: series, error, retry } = useSeries(id);
  if (error) return <LoadError onRetry={retry} />;
  if (!series) return <div className="grid h-64 place-items-center text-sm text-muted">טוען נתונים…</div>;
  return <HistoryChart samples={series} expert />;
}
