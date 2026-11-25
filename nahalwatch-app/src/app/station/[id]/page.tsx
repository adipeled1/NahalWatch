import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { STATIONS, STATION_BY_ID } from '@/lib/stationIndex';
import { safeCandidatesNear } from '@/lib/alternatives';
import StationDetail from '@/components/Station/StationDetail';

type Props = { params: Promise<{ id: string }> };

// Every station is pre-built by generateStaticParams; any other id is a plain 404 from the router
// (no page render that bails out with notFound(), which re-rendered the layout on the client in dev).
export const dynamicParams = false;

export function generateStaticParams() {
  return STATIONS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = STATION_BY_ID[id];
  if (!s) return {};
  const title = `${s.stream} — ${s.name}`;
  const description = `איכות המים ב${s.stream}, תחנת ${s.name}: מצב רחצה, נתוני מעבדה ותחזית.`;
  return {
    title,
    description,
    alternates: { canonical: `/station/${s.id}` },
    openGraph: { title, description, type: 'article', locale: 'he_IL' },
  };
}

// Server component: the station index stays on the server. The page gets its one station, plus the
// nearby green stations the "safe alternative" may suggest (their age is checked in the browser).
export default async function StationPage({ params }: Props) {
  const { id } = await params;
  const station = STATION_BY_ID[id];
  if (!station) notFound();
  return <StationDetail station={station} candidates={safeCandidatesNear(station, STATIONS)} />;
}
