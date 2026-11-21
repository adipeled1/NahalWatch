import { TrendingUp } from 'lucide-react';
import type { forecastFcoli } from '@/lib/models';
import { fmt } from '@/lib/quality';

type Forecast = NonNullable<ReturnType<typeof forecastFcoli>>;
const dayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });

const cls = (v: number) =>
  v > 400 ? { text: 'text-danger', bg: 'bg-danger-soft', label: 'אזהרה' }
  : v > 200 ? { text: 'text-caution', bg: 'bg-caution-soft', label: 'חשוד' }
  : { text: 'text-safe', bg: 'bg-safe-soft', label: 'תקין' };

/** Today + 3 days of modelled fecal coliforms (logistic growth toward the seasonal level). */
export function ForecastStrip({ forecast, compact }: { forecast: Forecast; compact?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <TrendingUp className="size-4 text-water" aria-hidden />
        תחזית מודל לוגיסטי · קוליפורמים צואתיים
      </div>
      <ol className="grid grid-cols-4 gap-1.5">
        {forecast.points.map((p, i) => {
          const c = cls(p.value);
          return (
            <li key={p.date} className={`rounded-lg px-1.5 py-1.5 text-center ${c.bg}`}>
              <div className="text-[11px] text-muted">{i === 0 ? 'היום' : dayFmt.format(new Date(p.date))}</div>
              <div className={`num text-sm font-extrabold ${c.text}`}>{fmt(p.value)}</div>
              {!compact && <div className={`text-[11px] font-semibold ${c.text}`}>{c.label}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
