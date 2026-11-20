import type { Metadata } from 'next';
import StreamsList from '@/components/Streams/StreamsList';

export const metadata: Metadata = { title: 'נחלים ותחנות' };

export default function StreamsPage() {
  return <StreamsList />;
}
