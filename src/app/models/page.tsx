import type { Metadata } from 'next';
import ModelsLab from '@/components/Models/ModelsLab';

export const metadata: Metadata = { title: 'מעבדת מודלים' };

export default function ModelsPage() {
  return <ModelsLab />;
}
