import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NahalWatch — אקולוגיה בכף היד',
    short_name: 'NahalWatch',
    description: 'האם אפשר להיכנס למים היום? מפת רמזור לאיכות המים בנחלי ישראל.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'he',
    background_color: '#f3f6f4',
    theme_color: '#0b7a4b',
    categories: ['education', 'health', 'travel', 'weather'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
