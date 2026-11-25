/**
 * The station page, rendered on the server (at build time: every station is pre-built).
 * Answer → forecast → latest values → history chart → full table. Only the parts that depend on
 * today's date or load in the browser are client islands (StationLive.tsx); they get this one
 * station as a prop, so the page doesn't ship the whole station index.
 */
import Link from 'next/link';
import { ArrowRight, FlaskConical, Gauge, LineChart as LineIcon, MapPin, Navigation, TableProperties } from 'lucide-react';
import { GROUP_LABEL, PARAMS, paramInfo, type ParamGroup } from '@/lib/params';
import { assess, exceedances, fmt, type Assessment } from '@/lib/quality';
import type { SafeCandidate } from '@/lib/alternatives';
import type { Station } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { FindingList, StatusBadge, statusTone } from '@/components/ui/Status';
import { ForecastAndAlternative, LatestSampleAge, StationHistory } from './StationLive';

/** Sample days are calendar days: format them in UTC so the date never shifts with the server's zone. */
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Key parameters shown as tiles (when measured in the latest sample), in this order. */
const TILE_KEYS = ['Fcoli', 'Ecoli', 'Fstrp', 'BODt', 'CODt', 'NH4', 'NO3', 'Ptot', 'TSS105', 'Do', 'Temp', 'pH', 'Ec', 'Cl'];

export default function StationDetail({ station, candidates }: { station: Station; candidates: SafeCandidate[] }) {
  const a = assess(station.latest);
  const tone = statusTone(a.status);
  const issues = exceedances(a);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/streams" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> כל הנחלים
      </Link>

      <header>
        <div className="flex items-center gap-1.5 text-sm font-bold text-water"><MapPin className="size-4" aria-hidden />{station.stream}</div>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight lg:text-3xl">{station.name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusBadge status={a.status} />
          <span>קוד תחנה <span className="num">{station.code}</span></span>
          <span>·</span>
          <span><span className="num">{station.sampleCount}</span> דגימות מאז <span className="num">{station.firstSample.slice(0, 4)}</span></span>
        </div>
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
            <LatestSampleAge day={station.latest.d} lab={station.latest.lab} />
            <a
              href={`https://waze.com/ul?ll=${station.lat},${station.lng}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold hover:bg-surface-hover"
            >
              <Navigation className="size-4 text-water" aria-hidden /> ניווט לתחנה
              <span className="text-xs font-normal text-faint">
                {station.approxLocation ? '(מיקום משוער)' : '(מיקום רשמי — רשות המים)'}
              </span>
            </a>
            <p className="text-xs leading-relaxed text-muted">
              {station.official ? (
                <>
                  נ״צ רשמי: תחנה הידרומטרית <span className="num">{station.official.id}</span> &quot;{station.official.name}&quot; ·
                  ITM <span className="num">{station.official.itmX} / {station.official.itmY}</span> ·{' '}
                  <span className="num">{station.lat.toFixed(5)}, {station.lng.toFixed(5)}</span>
                </>
              ) : (
                <>
                  נ״צ משוער לפי שם התחנה: <span className="num">{station.lat.toFixed(4)}, {station.lng.toFixed(4)}</span>
                </>
              )}
            </p>
          </div>
        </Card>

        <ForecastAndAlternative
          station={{ latest: station.latest, fcoliMonthly: station.fcoliMonthly }}
          status={a.status}
          candidates={candidates}
        />
      </div>

      <LatestTiles station={station} a={a} />

      <Card>
        <CardHeader icon={<LineIcon className="size-4" />} title="היסטוריית מדידות" subtitle={`${station.sampleCount} דגימות · קווי הסף מסומנים בגרף`} />
        <div className="px-2 pb-4 lg:px-4">
          <StationHistory id={station.id} />
        </div>
      </Card>

      <LatestTable station={station} a={a} />
    </div>
  );
}

/** Latest-sample numbers for the key parameters that were actually measured. */
function LatestTiles({ station, a }: { station: Station; a: Assessment }) {
  const keys = TILE_KEYS.filter((k) => station.latest.v[k] != null);
  if (!keys.length) return null;
  return (
    <Card>
      <CardHeader icon={<Gauge className="size-4" />} title="המדידות האחרונות" subtitle={dateFmt.format(new Date(station.latest.d))} />
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-5">
        {keys.map((k) => {
          const info = paramInfo(k);
          const sev = a.findings.find((f) => f.key === k)?.severity;
          const style = sev === 'danger' ? 'border-danger/30 bg-danger-soft text-danger'
            : sev === 'caution' ? 'border-caution/30 bg-caution-soft text-caution' : 'border-border bg-surface-2 text-fg';
          return (
            <div key={k} className={`rounded-xl border px-3 py-2.5 ${style}`} title={info.explain}>
              <div className="truncate text-xs text-muted">{info.he}</div>
              <div className="num mt-0.5 text-xl font-extrabold">{station.latest.q?.[k] ?? ''}{fmt(station.latest.v[k])}</div>
              <div className="text-[11px] text-faint" dir="ltr">{info.unit || ' '}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Every parameter in the latest sample, grouped. */
function LatestTable({ station, a }: { station: Station; a: Assessment }) {
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
      <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
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
