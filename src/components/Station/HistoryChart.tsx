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

  const [param, setParam] = useState<string>('Fcoli');
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('10');
  const key = available.includes(param) ? param : available[0];
  const info = paramInfo(key ?? 'Fcoli');
  const rule = RULES.find((r) => r.key === key);
  const log = LOG_KEYS.has(key ?? '');

  const data = useMemo(() => {
    if (!key) return [];
    const years = RANGES.find((r) => r.id === range)!.years;
    const last = samples.length ? new Date(samples[samples.length - 1].d) : new Date();
    const cutoff = new Date(last);
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return samples
      .filter((s) => s.v[key] != null && new Date(s.d) >= cutoff)
      .map((s) => ({ t: new Date(s.d).getTime(), v: log ? Math.max(1, s.v[key]) : s.v[key] }));
  }, [samples, key, range, log]);

  if (!key) return <p className="p-4 text-sm text-muted">אין מספיק נתונים לגרף.</p>;

  const values = data.map((d) => d.v);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const max = values.length ? Math.max(...values) : 0;

  return (
    <div>
      <div className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto px-2">
        {available.map((k) => (
          <Chip key={k} active={k === key} onClick={() => setParam(k)}>{paramInfo(k).he}</Chip>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
        <p className="max-w-xl text-xs text-muted">{info.explain}</p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
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
            {rule?.cautionBelow != null && (
              <ReferenceLine y={rule.cautionBelow} stroke="var(--caution)" strokeDasharray="5 4" label={{ value: `מינימום ${fmt(rule.cautionBelow)}`, fill: 'var(--caution)', fontSize: 11, position: 'insideBottomLeft' }} />
            )}
            <Line type="monotone" dataKey="v" stroke="var(--water)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--water)' }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 px-2 text-xs text-muted">
        <span>מדידות: <b className="num text-fg">{data.length}</b></span>
        <span>ממוצע: <b className="num text-fg">{fmt(avg)}</b> {info.unit}</span>
        <span>מקסימום: <b className="num text-fg">{fmt(max)}</b> {info.unit}</span>
        {log && <span className="text-faint">ציר לוגריתמי</span>}
      </div>
    </div>
  );
}
