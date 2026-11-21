'use client';
import Link from 'next/link';
import { CalendarClock, ChevronLeft, MapPin, Navigation, X } from 'lucide-react';
import { forecastFcoli } from '@/lib/models';
import { STALE_DAYS, ageLabel, exceedances, fmt } from '@/lib/quality';
import { nearestSafe, type RatedStation } from '@/lib/stations';
import { FindingList, StatusBadge, statusTone } from '@/components/ui/Status';
import { ForecastStrip } from './ForecastStrip';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

/** The card shown when a pin is tapped: one-sentence answer first, then the "why". */
export default function StationSummary({
  rated,
  all,
  onClose,
  onPick,
}: {
  rated: RatedStation;
  all: RatedStation[];
  onClose?: () => void;
  onPick?: (id: string) => void;
}) {
  const { station, assessment: a, ageDays } = rated;
  const tone = statusTone(a.status);
  const issues = exceedances(a);
  const fcoli = a.findings.find((f) => f.key === 'Fcoli' || f.key === 'Ecoli');
  const forecast = forecastFcoli(station);
  const alt = a.status === 'danger' || a.status === 'caution' ? nearestSafe(station, all) : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-water">
            <MapPin className="size-3.5" aria-hidden />
            {station.stream}
          </div>
          <h2 className="mt-0.5 text-lg font-extrabold leading-tight">{station.name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onClose && (
            <button type="button" onClick={onClose} aria-label="סגירה" className="grid size-9 place-items-center rounded-full hover:bg-surface-hover">
              <X className="size-5 text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* One-sentence answer first, then the details */}
      <div className={`rounded-xl border px-3.5 py-3 ${tone.bg} ${tone.border}`}>
        <div className={`flex items-center gap-2 text-base font-extrabold ${tone.text}`}>
          <tone.Icon className="size-5" aria-hidden />
          {a.headline}
        </div>
        <p className="mt-1 text-sm text-fg">{a.familyAnswer}</p>
      </div>

      {issues.length > 0 ? (
        <FindingList findings={issues} />
      ) : fcoli ? (
        <p className="text-sm text-muted">
          {fcoli.label}: <bdi dir="ltr" className="num font-bold whitespace-nowrap text-safe">{fcoli.valueText}</bdi> — {fcoli.verdict}
        </p>
      ) : null}

      <div className={`flex items-center gap-2 text-xs ${ageDays > STALE_DAYS ? 'text-caution' : 'text-muted'}`}>
        <CalendarClock className="size-4 shrink-0" aria-hidden />
        <span>
          דגימה אחרונה: {dateFmt.format(new Date(station.latest.d))} ({ageLabel(station.latest.d)})
          {ageDays > STALE_DAYS && ' — המידע אינו עדכני'}
        </span>
      </div>

      {forecast && <ForecastStrip forecast={forecast} compact />}

      {alt && (
        <button
          type="button"
          onClick={() => onPick?.(alt.r.station.id)}
          className="flex items-center gap-3 rounded-xl border border-safe/30 bg-safe-soft px-3 py-2.5 text-start"
        >
          <Navigation className="size-5 shrink-0 text-safe" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold text-safe">חלופה בטוחה קרובה</div>
            <div className="truncate text-fg">
              {alt.r.station.stream} · {alt.r.station.name} — {fmt(Math.round(alt.km))} ק״מ בקו אוויר
            </div>
          </div>
          <StatusBadge status="safe" />
        </button>
      )}

      <Link
        href={`/station/${station.id}`}
        className="flex items-center justify-center gap-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-accent-fg hover:bg-accent-hover"
      >
        כל הנתונים, גרפים ותחזית
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
