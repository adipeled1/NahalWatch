'use client';
// Leaflet touches `window`, so this module is only ever loaded via next/dynamic({ ssr: false }).
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { CONFLUENCE, HOME_VIEW } from '@/lib/data';
import type { Status } from '@/lib/quality';
import type { Station } from '@/lib/types';

export interface MapStation {
  station: Station;
  status: Status;
  stale: boolean;
}

const GLYPH: Record<Status, string> = { safe: '✓', caution: '!', danger: '✕', unknown: '?' };
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(status: Status, stale: boolean, selected: boolean) {
  const key = `${status}-${stale}-${selected}`;
  if (!iconCache.has(key)) {
    iconCache.set(key, L.divIcon({
      className: '',
      html: `<div class="nw-pin nw-pin--${status}${stale ? ' nw-pin--stale' : ''}${selected ? ' nw-pin--selected' : ''}">${GLYPH[status]}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    }));
  }
  return iconCache.get(key)!;
}

const confluenceIcon = L.divIcon({
  className: '',
  html: `<div class="nw-confluence">◆ ${CONFLUENCE.label}</div>`,
  iconSize: [0, 0],
  iconAnchor: [-10, 6],
});

// "You are here" dot; colors come from the theme tokens (.nw-userpos in globals.css).
const userPosIcon = L.divIcon({ className: '', html: '<div class="nw-userpos"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

export type FlyTarget =
  | { kind: 'bounds'; bounds: [[number, number], [number, number]] }
  | { kind: 'point'; lat: number; lng: number; zoom?: number };

function Controller({ target, onMapClick }: { target: FlyTarget | null; onMapClick: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (target.kind === 'bounds') map.flyToBounds(target.bounds, { duration: 0.8, padding: [20, 20] });
    else map.flyTo([target.lat, target.lng], target.zoom ?? Math.max(map.getZoom(), 12), { duration: 0.8 });
  }, [map, target]);
  useMapEvents({ click: onMapClick });
  return null;
}

export default function StreamMap({
  items,
  selectedId,
  onSelect,
  flyTo,
  userPos,
  layer = 'street',
}: {
  items: MapStation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  flyTo: FlyTarget | null;
  userPos: { lat: number; lng: number } | null;
  layer?: 'street' | 'satellite';
}) {
  // Draw danger last so red pins sit on top of green ones.
  const ordered = useMemo(() => {
    const rank: Record<Status, number> = { unknown: 0, safe: 1, caution: 2, danger: 3 };
    return [...items].sort((a, b) => Number(!a.stale) - Number(!b.stale) || rank[a.status] - rank[b.status]);
  }, [items]);

  return (
    <MapContainer
      center={HOME_VIEW.center}
      zoom={HOME_VIEW.zoom}
      minZoom={7}
      maxZoom={17}
      zoomControl={false}
      className={`h-full w-full ${layer === 'street' ? 'nw-street' : ''}`}
      attributionControl
    >
      {layer === 'satellite' ? (
        <TileLayer
          key="sat"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxNativeZoom={17}
        />
      ) : (
        <TileLayer
          key="osm"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxNativeZoom={19}
        />
      )}
      <Controller target={flyTo} onMapClick={() => onSelect(null)} />
      <Marker position={[CONFLUENCE.lat, CONFLUENCE.lng]} icon={confluenceIcon} interactive={false} />
      {userPos && (
        <Marker
          position={[userPos.lat, userPos.lng]}
          icon={userPosIcon}
          interactive={false}
        />
      )}
      {ordered.map(({ station, status, stale }) => (
        <Marker
          key={station.id}
          position={[station.lat, station.lng]}
          icon={pinIcon(status, stale, station.id === selectedId)}
          zIndexOffset={station.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(station.id) }}
          keyboard
          title={`${station.stream} — ${station.name}`}
        >
          <Tooltip direction="top" offset={[0, -14]} className="nw-tip">
            {station.stream} · {station.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
