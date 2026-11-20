import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import stations from '../../../../public/data/stations.json';
import StationDetail from '@/components/Station/StationDetail';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return (stations as { id: string }[]).map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = (stations as { id: string; name: string; stream: string }[]).find((x) => x.id === id);
  return s ? { title: `${s.stream} — ${s.name}`, description: `איכות המים ב${s.stream}, תחנת ${s.name}: מצב רחצה, נתוני מעבדה ותחזית.` } : {};
}

export default async function StationPage({ params }: Props) {
  const { id } = await params;
  if (!(stations as { id: string }[]).some((s) => s.id === id)) notFound();
  return <StationDetail id={id} />;
}
