'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { REGION_LABEL } from '@/lib/geo';
import { ageLabel, fmt, type Status } from '@/lib/quality';
import { rateAll, type RatedStation } from '@/lib/stations';
import { useNow } from '@/hooks/useNow';
import type { Region } from '@/lib/types';
import { Card, Chip, PageHeader } from '@/components/ui/Card';
import { StatusBadge, StatusDot } from '@/components/ui/Status';

const RANK: Record<Status, number> = { safe: 0, caution: 1, danger: 2, unknown: 3 };

export default function StreamsList() {
  // Ages and the "old station" filter depend on today's date, so the list waits for the browser's clock
  // (the page is pre-rendered at build time; see useNow).
  const now = useNow();
  const rated = useMemo(() => (now ? rateAll(now) : null), [now]);
  const [region, setRegion] = useState<Region | 'all'>('north');
  const [q, setQ] = useState('');
  const [showOld, setShowOld] = useState(false);

  const groups = useMemo(() => {
    if (!rated || !now) return null;
    const map = new Map<string, RatedStation[]>();
    for (const r of rated) {
      if (region !== 'all' && r.station.region !== region) continue;
      if (!showOld && r.old) continue;
      if (q && !r.station.stream.includes(q) && !r.station.name.includes(q)) continue;
      if (!map.has(r.station.stream)) map.set(r.station.stream, []);
      map.get(r.station.stream)!.push(r);
    }
    return [...map.entries()]
      .map(([stream, list]) => ({
        stream,
        list: list.sort((a, b) => RANK[a.assessment.status] - RANK[b.assessment.status]),
        // A stream's headline status = its best recent station ("is there anywhere to swim?").
        best: list.reduce((b, r) => (RANK[r.assessment.status] < RANK[b] ? r.assessment.status : b), 'unknown' as Status),
      }))
      .sort((a, b) => RANK[a.best] - RANK[b.best] || a.stream.localeCompare(b.stream, 'he'));
  }, [rated, now, region, q, showOld]);

  return (
    <div>
      <PageHeader title="נחלים ותחנות" subtitle="כל תחנות הניטור, מסודרות לפי נחל. נחלים שיש בהם מקום תקין לרחצה מופיעים ראשונים." />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value.trim())}
            placeholder="חיפוש נחל או תחנה…"
            aria-label="חיפוש נחל או תחנה"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-10 pl-3 outline-none focus:border-accent"
          />
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {(['north', 'center', 'south', 'all'] as const).map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{REGION_LABEL[r]}</Chip>
          ))}
          <Chip active={showOld} onClick={() => setShowOld(!showOld)}>כולל תחנות ישנות</Chip>
        </div>
      </div>

      {!groups && <p className="py-10 text-center text-muted">טוען תחנות…</p>}
      {groups?.length === 0 && <p className="py-10 text-center text-muted">לא נמצאו תחנות.</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups?.map((g) => (
          <Card key={g.stream}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-lg font-extrabold">{g.stream}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted"><span className="num">{g.list.length}</span> תחנות</span>
                <StatusBadge status={g.best} />
              </div>
            </div>
            <ul className="divide-y divide-border">{g.list.map((r) => <Row key={r.station.id} r={r} now={now!} />)}</ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Row({ r, now, showStream }: { r: RatedStation; now: Date; showStream?: boolean }) {
  const f = r.station.latest.v.Fcoli;
  return (
    <li>
      <Link href={`/station/${r.station.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover">
        <StatusDot status={r.assessment.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{showStream ? `${r.station.stream} · ` : ''}{r.station.name}</div>
          <div className={`text-xs ${r.old ? 'text-caution' : 'text-faint'}`}>{ageLabel(r.station.latest.d, now)}</div>
        </div>
        {f != null && (
          <div className="text-end text-xs text-muted">
            <div className="num font-bold text-fg">{fmt(f)}</div>
            <div dir="ltr">cfu/100ml</div>
          </div>
        )}
        <ChevronLeft className="size-4 text-faint" aria-hidden />
      </Link>
    </li>
  );
}
