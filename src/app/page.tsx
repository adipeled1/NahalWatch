import { Suspense } from 'react';
import MapScreen from '@/components/Map/MapScreen';

export default function HomePage() {
  // useSearchParams (the ?station= deep link) needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <MapScreen />
    </Suspense>
  );
}
