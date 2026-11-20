import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/Shell/AppShell';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo', display: 'swap' });

// Same resolution order as the reference app: explicit site URL → Vercel URL → localhost.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'NahalWatch | אקולוגיה בכף היד', template: '%s · NahalWatch' },
  description: 'מפת רמזור לאיכות המים בנחלי ישראל — האם אפשר להיכנס למים היום? מבוסס על 30 שנות נתוני ניטור ומודלים אקולוגיים.',
  applicationName: 'NahalWatch',
  appleWebApp: { capable: true, title: 'NahalWatch', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f6f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0a120f' },
  ],
};

// Runs before paint: apply saved/system theme (no flash) and register the service worker.
const bootScript = `(function(){try{var t=localStorage.getItem('nw-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}
if('serviceWorker'in navigator&&location.hostname!=='localhost'){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" data-theme="light" className={`${heebo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
