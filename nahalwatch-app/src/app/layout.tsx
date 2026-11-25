import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import AppShell from '@/components/Shell/AppShell';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo', display: 'swap' });

// Same resolution order as the reference app: explicit site URL → Vercel URL → localhost.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'NahalWatch', template: '%s · NahalWatch' },
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

// "Ask the papers" writes answers only when the deployment has a Gemini key. Decided at build time
// (the pages are static), so with no key the chat never calls the server. Only a yes/no reaches the
// browser, never the key. Changing the key on Vercel takes effect on the next deploy.
const canWriteAnswers = Boolean(process.env.GEMINI_API_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" data-theme="light" className={`${heebo.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        {/* next/script (not a raw <script>): Next injects it into <head> before hydration, and React
            doesn't warn about a script tag when a page such as the 404 is rendered on the client. */}
        <Script id="nw-boot" strategy="beforeInteractive">{bootScript}</Script>
        <AppShell canWriteAnswers={canWriteAnswers}>{children}</AppShell>
      </body>
    </html>
  );
}
