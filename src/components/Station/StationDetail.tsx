'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Baby, CalendarClock, FlaskConical, LineChart as LineIcon, MapPin, Navigation, Star, TableProperties } from 'lucide-react';
import { STATION_BY_ID, useSeries } from '@/lib/data';
import { forecastFcoli } from '@/lib/models';
import { GROUP_LABEL, PARAMS, paramInfo, type ParamGroup } from '@/lib/params';
import { STALE_DAYS, ageInDays, ageLabel, assess, exceedances, fmt } from '@/lib/quality';
import { driveMinutes, nearestSafe, rateAll } from '@/lib/stations';
import { useFavorites } from '@/lib/storage';
import { Card, CardHeader, Chip, Stat } from '@/components/ui/Card';
import { FindingList, StatusBadge, statusTone } from '@/components/ui/Status';
import { ScoreBar } from './ScoreBar';
import { ForecastStrip } from './ForecastStrip';
import { HistoryChart } from './HistoryChart';
import { FieldReports } from './FieldReports';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

export default function StationDetail({ id }: { id: string }) {
  const station = STATION_BY_ID[id];
  const a = useMemo(() => assess(station.latest), [station]);
  const { data: series, loading } = useSeries(id);
  const { isFavorite, toggle } = useFavorites();
  const [mode, setMode] = useState<'simple' | 'expert'>('simple');
  const tone = statusTone(a.status);
  const issues = exceedances(a);
  const age = ageInDays(station.latest.d);
  const forecast = forecastFcoli(station);
  const alt = useMemo(() => (a.status === 'safe' ? null : nearestSafe(station, rateAll())), [a.status, station]);
  const fav = isFavorite(id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/streams" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
          <ArrowRight className="size-4" aria-hidden /> כל הנחלים
        </Link>
        <div className="flex rounded-full border border-border bg-surface p-0.5 text-sm font-semibold" role="tablist" aria-label="רמת פירוט">
          {(['simple', 'expert'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1.5 ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted'}`}
            >
              {m === 'simple' ? 'תצוגה פשוטה' : 'תצוגת מומחה'}
            </button>
          ))}
        </div>
      </div>

      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-water"><MapPin className="size-4" aria-hidden />{station.stream}</div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight lg:text-3xl">{station.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <StatusBadge status={a.status} />
            {a.kidFriendly && <span className="inline-flex items-center gap-1 rounded-full bg-safe-soft px-2 py-0.5 font-bold text-safe"><Baby className="size-3.5" />מתאים לילדים</span>}
            <span>קוד תחנה <span className="num">{station.code}</span></span>
            <span>·</span>
            <span><span className="num">{station.sampleCount}</span> דגימות מאז <span className="num">{station.firstSample.slice(0, 4)}</span></span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-pressed={fav}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold ${fav ? 'border-caution/40 bg-caution-soft text-caution' : 'border-border bg-surface text-muted'}`}
        >
          <Star className={`size-4 ${fav ? 'fill-current' : ''}`} aria-hidden />
          {fav ? 'בנחלים שלי' : 'הוספה לנחלים שלי'}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Answer card */}
        <Card className={`border-2 ${tone.border}`}>
          <div className={`rounded-t-2xl px-5 py-4 ${tone.bg}`}>
            <div className={`flex items-center gap-2 text-xl font-extrabold ${tone.text}`}>
              <tone.Icon className="size-6" aria-hidden />{a.headline}
            </div>
            <p className="mt-1 text-[15px]">{a.familyAnswer}</p>
          </div>
          <div className="flex flex-col gap-3 p-5">
            {issues.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-bold text-muted">למה?</div>
                <FindingList findings={issues} />
              </div>
            )}
            <ScoreBar score={a.score} />
            <div className={`flex items-center gap-2 text-sm ${age > STALE_DAYS ? 'text-caution' : 'text-muted'}`}>
              <CalendarClock className="size-4 shrink-0" aria-hidden />
              דגימה אחרונה: {dateFmt.format(new Date(station.latest.d))} ({ageLabel(station.latest.d)})
              {station.latest.lab && <span className="text-faint">· מעבדת {station.latest.lab}</span>}
            </div>
            {age > STALE_DAYS && (
              <p className="rounded-lg bg-caution-soft px-3 py-2 text-xs text-caution">
                הנתון האחרון ישן מ-{Math.round(STALE_DAYS / 30)} חודשים. המצב בשטח עשוי להיות שונה — השתמשו בתחזית ובדיווחי מטיילים כהשלמה.
              </p>
            )}
            <a
              href={`https://waze.com/ul?ll=${station.lat},${station.lng}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold hover:bg-surface-hover"
            >
              <Navigation className="size-4 text-water" aria-hidden /> ניווט לתחנה
              <span className="text-xs font-normal text-faint">(מיקום משוער)</span>
            </a>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {forecast && (
            <Card>
              <CardHeader icon={<LineIcon className="size-4" />} title="תחזית ל-3 הימים הקרובים" subtitle="מודל גידול לוגיסטי — מהדגימה האחרונה אל הרמה העונתית האופיינית לתחנה" />
              <div className="px-4 pb-4">
                <ForecastStrip forecast={forecast} />
                {mode === 'expert' && (
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    N₀ = <span className="num">{fmt(forecast.n0)}</span> ({forecast.fromDate}), K = חציון חודשי היסטורי ={' '}
                    <span className="num">{fmt(forecast.k)}</span>, r = 0.35 ליום. <Link href="/models" className="font-semibold text-water underline">איך זה עובד?</Link>
                  </p>
                )}
              </div>
            </Card>
          )}
          {alt && (
            <Link href={`/station/${alt.r.station.id}`} className="flex items-center gap-3 rounded-2xl border border-safe/30 bg-safe-soft p-4">
              <Navigation className="size-6 shrink-0 text-safe" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-safe">חלופה בטוחה קרובה</div>
                <div className="truncate text-sm">{alt.r.station.stream} · {alt.r.station.name}</div>
                <div className="text-xs text-muted">כ-{driveMinutes(alt.km)} דקות נסיעה · {fmt(Math.round(alt.km))} ק״מ</div>
              </div>
              <StatusBadge status="safe" />
            </Link>
          )}
          {mode === 'simple' && (
            <div className="grid grid-cols-3 gap-2">
              {(['Fcoli', 'Do', 'Temp'] as const).map((k) => {
                const v = station.latest.v[k];
                const info = paramInfo(k);
                return <Stat key={k} label={info.he} value={v == null ? '—' : <span className="num">{fmt(v)}</span>} hint={info.unit} />;
              })}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader icon={<LineIcon className="size-4" />} title="היסטוריית מדידות" subtitle={`${station.sampleCount} דגימות · קווי הסף מסומנים בגרף`} />
        <div className="px-2 pb-4 lg:px-4">
          {loading || !series ? (
            <div className="grid h-64 place-items-center text-sm text-muted">טוען נתונים…</div>
          ) : (
            <HistoryChart samples={series} expert={mode === 'expert'} />
          )}
        </div>
      </Card>

      {mode === 'expert' && <LatestTable />}

      <FieldReports stationId={id} />
    </div>
  );

  function LatestTable() {
    const groups = new Map<ParamGroup, { key: string; value: number; q?: string }[]>();
    for (const [key, value] of Object.entries(station.latest.v)) {
      const g = paramInfo(key).group;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push({ key, value, q: station.latest.q?.[key] });
    }
    const order = PARAMS.map((p) => p.key);
    return (
      <Card>
        <CardHeader icon={<TableProperties className="size-4" />} title="הדגימה האחרונה — כל הפרמטרים" subtitle={dateFmt.format(new Date(station.latest.d))} />
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...groups.entries()].map(([g, rows]) => (
            <div key={g}>
              <div className="mb-1 text-xs font-bold text-muted">{GROUP_LABEL[g]}</div>
              <table className="w-full text-sm">
                <tbody>
                  {rows.sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key)).map((r) => {
                    const info = paramInfo(r.key);
                    const f = a.findings.find((x) => x.key === r.key);
                    const color = f?.severity === 'danger' ? 'text-danger' : f?.severity === 'caution' ? 'text-caution' : '';
                    return (
                      <tr key={r.key} className="border-b border-border last:border-0">
                        <td className="py-1.5" title={info.explain}>{info.he}</td>
                        <td className={`num py-1.5 text-end font-semibold ${color}`}>{r.q}{fmt(r.value)}</td>
                        <td className="w-20 py-1.5 ps-2 text-xs text-faint" dir="ltr">{info.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs text-faint">
          <FlaskConical className="size-3.5" aria-hidden /> ערכים עם &quot;&lt;&quot; נמוכים מסף הגילוי של המעבדה.
        </p>
      </Card>
    );
  }
}
