'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bug, CalendarRange, GitCompareArrows, Sprout } from 'lucide-react';
import { STATIONS, STATION_BY_ID } from '@/lib/stationIndex';
import { useSeries } from '@/hooks/useSeries';
import { backtestSeasonal, logisticSeries, lotkaVolterra, seasonalK } from '@/lib/models';
import { FCOLI_RULE, fmt, severityOf } from '@/lib/quality';
import { useNow } from '@/hooks/useNow';
import { Card, CardHeader, PageHeader, Stat } from '@/components/ui/Card';
import { LoadError } from '@/components/ui/LoadError';

const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, direction: 'rtl' as const };
// Official fecal-coliform limits (Ministry of Health), from RULES in quality.ts.
const FCOLI_CAUTION = FCOLI_RULE.cautionAbove!;
const FCOLI_DANGER = FCOLI_RULE.dangerAbove!;
const DEFAULT_ID = 's734'; // Hermon @ Kfar Szold bridge — longest record near the Jordan sources

// Stations with enough bacteria history to model.
const CANDIDATES = STATIONS
  .filter((s) => s.fcoliMonthly && s.fcoliMonthly.filter((x) => x != null).length >= 8 && s.sampleCount >= 20)
  .sort((a, b) => b.lat - a.lat);

export default function ModelsLab() {
  const [id, setId] = useState(STATION_BY_ID[DEFAULT_ID] ? DEFAULT_ID : CANDIDATES[0].id);
  const station = STATION_BY_ID[id];
  // K defaults to this month's median: wait for the browser's clock (the page is pre-rendered).
  const now = useNow();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="מעבדת מודלים אקולוגיים"
        subtitle="מריצים מודלים מקובלים באקולוגיה על נתוני אמת מהנחלים, ובודקים עד כמה התחזית פוגשת את המציאות."
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          תחנה
          <select
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="h-10 max-w-[320px] rounded-xl border border-border bg-surface px-3 text-sm text-fg"
          >
            {CANDIDATES.map((s) => <option key={s.id} value={s.id}>{s.stream} · {s.name}</option>)}
          </select>
        </label>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {now ? (
          <LogisticCard key={`log-${id}`} stationId={id} now={now} />
        ) : (
          <Card className="grid h-80 place-items-center text-sm text-muted">טוען מודל…</Card>
        )}
        <SeasonCard monthly={station.fcoliMonthly ?? []} />
      </div>
      <BacktestCard stationId={id} />
      <LotkaVolterraCard />
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs">
        <span className="font-semibold text-muted">{label}</span>
        <span className="num font-bold">{display ?? fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--accent)]" dir="ltr" />
    </label>
  );
}

function LogisticCard({ stationId, now }: { stationId: string; now: Date }) {
  const s = STATION_BY_ID[stationId];
  const k0 = Math.round(seasonalK(s, now) ?? 500);
  const n00 = Math.round(s.latest.v.Fcoli ?? 50);
  const [n0, setN0] = useState(Math.max(1, n00));
  const [k, setK] = useState(Math.max(1, k0));
  const [r, setR] = useState(0.35);
  const data = useMemo(() => logisticSeries(n0, r, k, 14), [n0, r, k]);
  const day = data.find((d) => Math.abs(d.value - k) / k < 0.05)?.t;

  return (
    <Card>
      <CardHeader icon={<Sprout className="size-4" />} title="מודל גידול לוגיסטי" subtitle="dN/dt = r·N·(1 − N/K) · התחזית שמוצגת בכל כרטיס נחל" />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-xs leading-relaxed text-muted">
          אוכלוסיית החיידקים (N) נעה מהערך שנמדד לאחרונה אל &quot;כושר הנשיאה&quot; העונתי של הנחל (K) — החציון ההיסטורי של אותו חודש.
          r קובע כמה מהר זה קורה (קצב התרבות/תמותה ביום).
        </p>
        <div className="h-52" dir="ltr">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" type="number" domain={[0, 14]} tickCount={8} stroke="var(--faint)" fontSize={11} tickFormatter={(t) => `${t}d`} />
              <YAxis stroke="var(--faint)" fontSize={11} width={48} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `יום ${Number(t).toFixed(1)}`} formatter={(v) => [fmt(Math.round(Number(v))), 'cfu/100ml']} />
              <ReferenceLine y={k} stroke="var(--water)" strokeDasharray="4 4" label={{ value: 'K', fill: 'var(--water)', fontSize: 11, position: 'right' }} />
              <ReferenceLine y={FCOLI_DANGER} stroke="var(--danger)" strokeDasharray="5 4" />
              <ReferenceLine y={FCOLI_CAUTION} stroke="var(--caution)" strokeDasharray="5 4" />
              <Line dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Slider label="N₀ — מדידה אחרונה" value={n0} min={1} max={Math.max(5000, n00 * 2)} step={1} onChange={setN0} />
          <Slider label="K — רמה עונתית" value={k} min={1} max={Math.max(5000, k0 * 2)} step={1} onChange={setK} />
          <Slider label="r — קצב ליום" value={r} min={0.05} max={2} step={0.05} onChange={setR} display={r.toFixed(2)} />
        </div>
        <p className="text-xs text-muted">
          {day != null ? <>האוכלוסייה מגיעה ל-95% מהרמה העונתית אחרי כ-<b className="num text-fg">{day.toFixed(1)}</b> ימים.</> : 'בטווח של שבועיים האוכלוסייה עוד לא מתייצבת.'}
        </p>
      </div>
    </Card>
  );
}

function SeasonCard({ monthly }: { monthly: (number | null)[] }) {
  const data = MONTHS.map((m, i) => ({ m, v: monthly[i] ?? 0, has: monthly[i] != null }));
  const color = (v: number) => {
    const sev = severityOf('Fcoli', v);
    return sev === 'danger' ? 'var(--danger)' : sev === 'caution' ? 'var(--caution)' : 'var(--safe)';
  };
  return (
    <Card>
      <CardHeader icon={<CalendarRange className="size-4" />} title="עונתיות החיידקים" subtitle="חציון קוליפורמים צואתיים לפי חודש, מכל שנות הניטור" />
      <div className="px-4 pb-4">
        <div className="h-52" dir="ltr">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" stroke="var(--faint)" fontSize={11} reversed />
              <YAxis stroke="var(--faint)" fontSize={11} width={48} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)), 'חציון cfu/100ml']} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                {data.map((d) => <Cell key={d.m} fill={d.has ? color(d.v) : 'var(--border)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          שאלת המחקר: כיצד משפיעים שינויי טמפרטורה וספיקה לאורך השנה על הזיהום המיקרוביאלי? עמודה גבוהה = חודש שבו הנחל מזוהם יותר בדרך כלל.
        </p>
      </div>
    </Card>
  );
}

function BacktestCard({ stationId }: { stationId: string }) {
  const { data: series, error, retry } = useSeries(stationId);
  const result = useMemo(() => (series ? backtestSeasonal(series) : null), [series]);
  const chart = result?.pairs.map((p) => ({ t: new Date(p.date).getTime(), measured: Math.max(1, p.measured), predicted: Math.max(1, p.predicted) })) ?? [];
  const within = result ? result.pairs.filter((p) => p.predicted / 3 <= p.measured && p.measured <= p.predicted * 3).length : 0;

  return (
    <Card>
      <CardHeader icon={<GitCompareArrows className="size-4" />} title="מודל מול שטח" subtitle="כל דגימה אמיתית מול תחזית המודל העונתי שנבנה משנים אחרות בלבד (leave-one-year-out)" />
      <div className="px-4 pb-4">
        {error ? (
          <LoadError onRetry={retry} className="h-56" />
        ) : !result ? (
          <div className="grid h-56 place-items-center text-sm text-muted">טוען נתונים…</div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Stat label="דגימות שנבדקו" value={<span className="num">{result.pairs.length}</span>} />
              <Stat label="צבע רמזור נכון" value={<span className="num">{result.accuracy == null ? '—' : `${Math.round(result.accuracy * 100)}%`}</span>} tone="safe" />
              <Stat label="בטווח פי 3" value={<span className="num">{result.pairs.length ? `${Math.round((within / result.pairs.length) * 100)}%` : '—'}</span>} tone="water" />
            </div>
            <div className="h-60" dir="ltr">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => String(new Date(t).getFullYear())} stroke="var(--faint)" fontSize={11} />
                  <YAxis scale="log" domain={[1, 'auto']} allowDataOverflow stroke="var(--faint)" fontSize={11} width={52} tickFormatter={(v) => fmt(v)} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => new Date(Number(t)).toLocaleDateString('he-IL')} formatter={(v, n) => [fmt(Number(v)), n === 'measured' ? 'נמדד' : 'מודל']} />
                  <Legend formatter={(v) => (v === 'measured' ? 'נמדד בשטח' : 'תחזית המודל')} wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={FCOLI_DANGER} stroke="var(--danger)" strokeDasharray="5 4" />
                  <Line dataKey="measured" stroke="var(--water)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
                  <Line dataKey="predicted" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              המודל העונתי תופס את הרמה הרגילה של הנחל, אבל מפספס קפיצות פתאומיות — לכן כל דגימה חדשה חשובה יותר מהתחזית.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function LotkaVolterraCard() {
  const [alpha, setAlpha] = useState(1.0);
  const [beta, setBeta] = useState(0.1);
  const [delta, setDelta] = useState(0.075);
  const [gamma, setGamma] = useState(1.5);
  const data = useMemo(() => lotkaVolterra({ alpha, beta, delta, gamma, b0: 10, p0: 5, days: 30 }), [alpha, beta, delta, gamma]);

  return (
    <Card>
      <CardHeader icon={<Bug className="size-4" />} title="מודל לוטקה–וולטרה: חיידקים וטורפיהם" subtitle="dB/dt = αB − βBP · dP/dt = δBP − γP" />
      <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="h-60" dir="ltr">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" type="number" domain={[0, 30]} stroke="var(--faint)" fontSize={11} tickFormatter={(t) => `${t}d`} />
                <YAxis stroke="var(--faint)" fontSize={11} width={40} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `יום ${t}`} formatter={(v, n) => [Number(v).toFixed(1), n === 'prey' ? 'חיידקים (B)' : 'פרוטוזואה (P)']} />
                <Legend formatter={(v) => (v === 'prey' ? 'חיידקים (טרף)' : 'פרוטוזואה (טורף)')} wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="prey" stroke="var(--danger)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="predator" stroke="var(--water)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            בנחל, חד-תאיים (פרוטוזואה) &quot;רועים&quot; חיידקים. כשיש הרבה חיידקים — הטורפים מתרבים ומורידים אותם, ואז הטורפים עצמם מתמעטים. זה המחזור שמסביר למה רמות החיידקים תנודתיות גם בלי זיהום חדש.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Slider label="α — התרבות חיידקים" value={alpha} min={0.2} max={2} step={0.05} onChange={setAlpha} display={alpha.toFixed(2)} />
          <Slider label="β — קצב רעייה" value={beta} min={0.02} max={0.3} step={0.005} onChange={setBeta} display={beta.toFixed(3)} />
          <Slider label="δ — יעילות הטורף" value={delta} min={0.01} max={0.2} step={0.005} onChange={setDelta} display={delta.toFixed(3)} />
          <Slider label="γ — תמותת הטורף" value={gamma} min={0.2} max={3} step={0.05} onChange={setGamma} display={gamma.toFixed(2)} />
          <p className="rounded-lg bg-surface-2 p-2.5 text-xs text-muted">
            נקודת שיווי משקל: B* = γ/δ = <b className="num text-fg">{(gamma / delta).toFixed(1)}</b>, P* = α/β = <b className="num text-fg">{(alpha / beta).toFixed(1)}</b>
          </p>
        </div>
      </div>
    </Card>
  );
}
