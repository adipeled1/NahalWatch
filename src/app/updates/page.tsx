import type { Metadata } from 'next';
import UpdatesFeed from '@/components/Updates/UpdatesFeed';

export const metadata: Metadata = { title: 'התראות ועדכונים' };

export default function UpdatesPage() {
  return <UpdatesFeed />;
}
