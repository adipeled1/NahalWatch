import { TrendingUp } from 'lucide-react';
import type { forecastFcoli } from '@/lib/models';
import { STATUS_RANK, fmt, severityOf, type Severity, type Status } from '@/lib/quality';

type Forecast = NonNullable<ReturnType<typeof forecastFcoli>>;
const dayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });

const TONE: Record<Severity, { text: string; bg: string; label: string }> = {
  danger: { text: 'text-danger', bg: 'bg-danger-soft', label: 'אזהרה' },
  caution: { text: 'text-caution', bg: 'bg-caution-soft', label: 'חשוד' },
  ok: { text: 'text-safe', bg: 'bg-safe-soft', label: 'תקין' },
};
const BY_RANK: Severity[] = ['ok', 'caution', 'danger'];
const SEV_RANK: Record<Severity, number> = { ok: 0, caution: 1, danger: 2 };

/**
 * Today + 3 days of modelled fecal coliforms (logistic growth toward the seasonal level).
 * The model can predict a drop, but only a new sample can clear a warning: a day is never shown in
 * a better color than the measured status (`status`), so the strip can't say "תקין" under "לא להיכנס".
 */
export function ForecastStrip({ forecast, status, compact }: { forecast: Forecast; status: Status; compact?: boolean }) {
  const floor = STATUS_RANK[status];
  const held = forecast.points.some((p) => SEV_RANK[severityOf('Fcoli', p.value)] < floor);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <TrendingUp className="size-4 text-water" aria-hidden />
        תחזית מודל לוגיסטי · קוליפורמים צואתיים
      </div>
      <ol className="grid grid-cols-4 gap-1.5">
        {forecast.points.map((p, i) => {
          const c = TONE[BY_RANK[Math.max(SEV_RANK[severityOf('Fcoli', p.value)], floor)]];
          return (
            <li key={p.date} className={`rounded-lg px-1.5 py-1.5 text-center ${c.bg}`}>
              <div className="text-[11px] text-muted">{i === 0 ? 'היום' : dayFmt.format(new Date(p.date))}</div>
              <div className={`num text-sm font-extrabold ${c.text}`}>{fmt(p.value)}</div>
              {!compact && <div className={`text-[11px] font-semibold ${c.text}`}>{c.label}</div>}
            </li>
          );
        })}
      </ol>
      {held && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          המודל צופה ירידה, אבל הצבע נשאר לפי הדגימה האחרונה: רק דגימה חדשה יכולה לבטל אזהרה.
        </p>
      )}
    </div>
  );
}
