'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Crosshair, History, Home, Layers, Search, X } from 'lucide-react';
import { HOME_VIEW, REGION_BOUNDS, REGION_LABEL, distanceKm } from '@/lib/geo';
import type { Status } from '@/lib/quality';
import { STATUS_LABEL } from '@/lib/quality';
import { countByStatus, rateAll } from '@/lib/stations';
import type { Region } from '@/lib/types';
import { Chip } from '@/components/ui/Card';
import StationSummary from '@/components/Station/StationSummary';
import type { FlyTarget } from './StreamMap';

const StreamMap = dynamic(() => import('./StreamMap'), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-surface-2 text-sm text-muted">טוען מפה…</div>,
});

const STATUS_ORDER: Status[] = ['safe', 'caution', 'danger', 'unknown'];
const LEGEND_DOT: Record<Status, string> = { safe: 'bg-safe', caution: 'bg-caution', danger: 'bg-danger', unknown: 'bg-unknown' };

export default function MapScreen() {
  const rated = useMemo(() => rateAll(), []);
  // Shareable deep link: /?station=<id> opens the map on that station's card.
  const linkedId = useSearchParams().get('station');
  const linked = rated.find((r) => r.station.id === linkedId) ?? null;

  const [region, setRegion] = useState<Region | 'all'>(linked?.station.region ?? 'north');
  const [statuses, setStatuses] = useState<Set<Status>>(new Set(STATUS_ORDER));
  const [showOld, setShowOld] = useState(linked?.old ?? false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(linked?.station.id ?? null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(
    linked ? { kind: 'point', lat: linked.station.lat, lng: linked.station.lng, zoom: 12 } : null,
  );
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');

  const visible = useMemo(
    () => rated.filter((r) =>
      (region === 'all' || r.station.region === region)
      && statuses.has(r.assessment.status)
      && (showOld || !r.old)),
    [rated, region, statuses, showOld],
  );
  const counts = countByStatus(visible);
  const selected = rated.find((r) => r.station.id === selectedId) ?? null;

  const q = query.trim();
  const matches = q.length >= 2
    ? rated.filter((r) => r.station.name.includes(q) || r.station.stream.includes(q)).slice(0, 8)
    : [];

  const pick = (id: string) => {
    const r = rated.find((x) => x.station.id === id);
    if (!r) return;
    setSelectedId(id);
    setFlyTo({ kind: 'point', lat: r.station.lat, lng: r.station.lng });
    if (r.old) setShowOld(true);
    if (region !== 'all' && r.station.region !== region) setRegion('all');
    setQuery('');
  };

  const chooseRegion = (r: Region | 'all') => {
    setRegion(r);
    setFlyTo({ kind: 'bounds', bounds: REGION_BOUNDS[r] });
  };

  const toggleStatus = (s: Status) => {
    const next = new Set(statuses);
    if (next.has(s) && next.size > 1) next.delete(s);
    else next.add(s);
    setStatuses(next);
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserPos(pos);
        setLocating(false);
        // "SOS safety": jump to the nearest station with recent data.
        const nearest = rated
          .filter((r) => !r.old)
          .map((r) => ({ r, km: distanceKm(pos, r.station) }))
          .sort((a, b) => a.km - b.km)[0];
        setRegion('all');
        if (nearest && nearest.km < 60) pick(nearest.r.station.id);
        else setFlyTo({ kind: 'point', ...pos, zoom: 11 });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div className="relative h-[calc(100dvh-57px-64px-env(safe-area-inset-bottom))] lg:h-dvh">
      <StreamMap
        items={visible.map((r) => ({ station: r.station, status: r.assessment.status, stale: r.old }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
        flyTo={flyTo}
        userPos={userPos}
        layer={layer}
      />

      {/* ── Top controls ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-2 p-3 lg:max-w-[440px]">
        <div className="pointer-events-auto relative">
          <Search className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש נחל או תחנה…"
            aria-label="חיפוש נחל או תחנה"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-10 pl-10 text-[15px] shadow-pop outline-none placeholder:text-faint focus:border-accent"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="ניקוי חיפוש" className="absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted">
              <X className="size-4" />
            </button>
          )}
          {matches.length > 0 && (
            <ul className="absolute inset-x-0 top-12 overflow-hidden rounded-xl border border-border bg-surface shadow-pop">
              {matches.map((r) => (
                <li key={r.station.id}>
                  <button type="button" onClick={() => pick(r.station.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-surface-hover">
                    <span className={`size-2.5 shrink-0 rounded-full ${LEGEND_DOT[r.assessment.status]}`} aria-hidden />
                    <span className="font-semibold">{r.station.stream}</span>
                    <span className="truncate text-muted">{r.station.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="scrollbar-none pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {(['north', 'center', 'south', 'all'] as const).map((r) => (
            <Chip key={r} active={region === r} onClick={() => chooseRegion(r)}>{REGION_LABEL[r]}</Chip>
          ))}
          <Chip active={showOld} onClick={() => setShowOld(!showOld)} title="תחנות שלא נדגמו מעל 3 שנים">
            <History className="size-4" aria-hidden /> ישנות
          </Chip>
        </div>
      </div>

      {/* ── Legend / status filter ── */}
      <div className={`absolute left-3 z-[500] rounded-xl border border-border bg-surface/95 p-1.5 shadow-pop backdrop-blur ${selected ? 'hidden lg:block' : ''} top-[118px]`}>
        <ul className="flex flex-col">
          {STATUS_ORDER.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => toggleStatus(s)}
                aria-pressed={statuses.has(s)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold ${statuses.has(s) ? '' : 'opacity-40'}`}
              >
                <span className={`size-3 rounded-full ${LEGEND_DOT[s]}`} aria-hidden />
                <span className="flex-1 text-start">{STATUS_LABEL[s]}</span>
                <span className="num text-muted">{counts[s]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Map buttons ── */}
      <div className={`absolute bottom-4 left-3 z-[500] flex flex-col gap-2 ${selected ? 'max-lg:hidden' : ''}`}>
        <MapButton label={layer === 'street' ? 'תצלום אוויר' : 'מפת רחובות'} onClick={() => setLayer(layer === 'street' ? 'satellite' : 'street')}>
          <Layers className="size-5" />
        </MapButton>
        <MapButton label="מיקום שלי — התחנה הקרובה" onClick={locate} busy={locating}><Crosshair className="size-5" /></MapButton>
        <MapButton
          label="חזרה למפגש מקורות הירדן"
          onClick={() => { setRegion('north'); setFlyTo({ kind: 'point', lat: HOME_VIEW.center[0], lng: HOME_VIEW.center[1], zoom: HOME_VIEW.zoom }); }}
        >
          <Home className="size-5" />
        </MapButton>
      </div>

      {/* ── Selected station: bottom sheet (mobile) / floating card (desktop) ── */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-[600] max-h-[72%] overflow-y-auto rounded-t-3xl border-t border-border bg-surface shadow-pop lg:inset-x-auto lg:top-[112px] lg:right-3 lg:bottom-auto lg:max-h-[calc(100%-124px)] lg:w-[416px] lg:rounded-2xl lg:border">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border-strong lg:hidden" aria-hidden />
          <StationSummary rated={selected} all={rated} onClose={() => setSelectedId(null)} onPick={pick} />
        </div>
      )}
    </div>
  );
}

function MapButton({ children, label, onClick, busy }: { children: React.ReactNode; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-full border border-border bg-surface text-fg shadow-pop hover:bg-surface-hover ${busy ? 'animate-pulse text-accent' : ''}`}
    >
      {children}
    </button>
  );
}
