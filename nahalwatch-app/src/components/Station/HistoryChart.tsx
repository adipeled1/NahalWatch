'use client';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PARAMS, paramInfo } from '@/lib/params';
import { RULES, fmt } from '@/lib/quality';
import type { Sample } from '@/lib/types';
import { Chip } from '@/components/ui/Card';

const RANGES = [
  { id: '5', label: '5 שנים', years: 5 },
  { id: '10', label: '10 שנים', years: 10 },
  { id: 'all', label: 'הכל', years: 100 },
] as const;

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const LOG_KEYS = new Set(['Fcoli', 'Ecoli', 'Fstrp', 'Coli', 'TOTB']);

export function HistoryChart({ samples, expert }: { samples: Sample[]; expert: boolean }) {
  // Parameters this station actually has (≥ 3 values), featured first.
  const available = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of samples) for (const k of Object.keys(s.v)) counts[k] = (counts[k] ?? 0) + 1;
    const keys = PARAMS.filter((p) => (counts[p.key] ?? 0) >= 3 && (expert || p.featured)).map((p) => p.key);
    return keys;
  }, [samples, expert]);

  // Ranges count back from the station's last sample.
  const last = useMemo(() => (samples.length ? new Date(samples[samples.length - 1].d) : new Date()), [samples]);
  const pointsIn = (k: string, years: number) => {
    const cutoff = new Date(last);
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return samples.filter((s) => s.v[k] != null && new Date(s.d) >= cutoff).length;
  };
  // Default is 10 years; if that window has fewer than 2 points (no line), show the whole history.
  const rangeFor = (k: string | undefined): (typeof RANGES)[number]['id'] => (k && pointsIn(k, 10) < 2 ? 'all' : '10');

  const [param, setParam] = useState<string>('Fcoli');
  const key = available.includes(param) ? param : available[0];
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>(() => rangeFor(key));
  const [autoAll, setAutoAll] = useState(() => rangeFor(key) === 'all');
  const info = paramInfo(key ?? 'Fcoli');
  const rule = RULES.find((r) => r.key === key);
  const log = LOG_KEYS.has(key ?? '');

  const pickParam = (k: string) => {
    const r = rangeFor(k);
    setParam(k);
    setRange(r);
    setAutoAll(r === 'all');
  };

  const data = useMemo(() => {
    if (!key) return [];
    const years = RANGES.find((r) => r.id === range)!.years;
    const cutoff = new Date(last);
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return samples
      .filter((s) => s.v[key] != null && new Date(s.d) >= cutoff)
      .map((s) => ({ t: new Date(s.d).getTime(), v: log ? Math.max(1, s.v[key]) : s.v[key] }));
  }, [samples, key, range, log, last]);

  if (!key) return <p className="p-4 text-sm text-muted">אין מספיק נתונים לגרף.</p>;

  const values = data.map((d) => d.v);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const max = values.length ? Math.max(...values) : 0;

  return (
    <div>
      <div className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto px-2">
        {available.map((k) => (
          <Chip key={k} active={k === key} onClick={() => pickParam(k)}>{paramInfo(k).he}</Chip>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="max-w-xl text-xs text-muted">
          <p>{info.explain}</p>
          {autoAll && range === 'all' && (
            <p className="mt-1 font-semibold text-caution">אין מספיק מדידות ב-10 השנים האחרונות — מוצג כל הטווח.</p>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setRange(r.id); setAutoAll(false); }}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${range === r.id ? 'bg-surface-hover text-fg' : 'text-muted'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full lg:h-72" dir="ltr">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t) => new Date(t).getFullYear().toString()}
              stroke="var(--faint)"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              scale={log ? 'log' : 'auto'}
              domain={log ? [1, 'auto'] : ['auto', 'auto']}
              allowDataOverflow={log}
              tickFormatter={(v) => fmt(v)}
              stroke="var(--faint)"
              fontSize={11}
              width={52}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, direction: 'rtl' }}
              labelFormatter={(t) => dateFmt.format(new Date(Number(t)))}
              formatter={(v) => [`${fmt(Number(v))} ${info.unit}`, info.he]}
            />
            {rule?.dangerAbove != null && (
              <ReferenceLine y={rule.dangerAbove} stroke="var(--danger)" strokeDasharray="5 4" label={{ value: `אזהרה ${fmt(rule.dangerAbove)}`, fill: 'var(--danger)', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {rule?.cautionAbove != null && (
              <ReferenceLine y={rule.cautionAbove} stroke="var(--caution)" strokeDasharray="5 4" label={{ value: `חשוד ${fmt(rule.cautionAbove)}`, fill: 'var(--caution)', fontSize: 11, position: 'insideBottomLeft' }} />
            )}
            {rule?.dangerBelow != null && (
              <ReferenceLine y={rule.dangerBelow} stroke="var(--danger)" strokeDasharray="5 4" label={{ value: `מינימום ${fmt(rule.dangerBelow)}`, fill: 'var(--danger)', fontSize: 11, position: 'insideBottomLeft' }} />
            )}
            <Line type="monotone" dataKey="v" stroke="var(--water)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--water)' }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 px-2 text-xs text-muted">
        <span>מדידות: <b className="num text-fg">{data.length}</b></span>
        <span>ממוצע: <b className="num text-fg">{fmt(Math.round(avg * 100) / 100)}</b> {info.unit}</span>
        <span>מקסימום: <b className="num text-fg">{fmt(max)}</b> {info.unit}</span>
        {log && <span className="text-faint">ציר לוגריתמי</span>}
      </div>
    </div>
  );
}
