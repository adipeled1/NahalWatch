'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, FlaskConical, Info, Map as MapIcon, Moon, Sun, Waves } from 'lucide-react';
import type { ReactNode } from 'react';
import { META } from '@/lib/data';
import { useTheme } from '@/lib/storage';

const NAV = [
  { href: '/', label: 'מפה', Icon: MapIcon },
  { href: '/updates', label: 'עדכונים', Icon: Bell },
  { href: '/streams', label: 'נחלים', Icon: Waves },
  { href: '/models', label: 'מודלים', Icon: FlaskConical },
  { href: '/about', label: 'מידע', Icon: Info },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href)) ||
  (href === '/streams' && path.startsWith('/station'));

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [theme, toggleTheme] = useTheme();
  const isMap = path === '/';

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Desktop side rail (right side in RTL) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-l border-border bg-surface lg:flex">
        <Brand />
        <nav className="mt-2 flex flex-col gap-0.5 px-3" aria-label="ניווט ראשי">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-fg'
                }`}
              >
                <Icon className="size-[18px]" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border p-4 text-[11px] leading-relaxed text-faint">
          <div className="font-semibold text-muted">מקור הנתונים</div>
          {META.stationCount} תחנות · {META.streamCount} נחלים
          <br />
          <span className="num">{META.firstSample.slice(0, 4)}–{META.lastSample.slice(0, 4)}</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-semibold text-muted hover:bg-surface-hover"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="safe-top sticky top-0 z-[1000] flex items-center justify-between border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <Brand compact />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            className="grid size-9 place-items-center rounded-full border border-border text-muted"
          >
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
        </header>

        <main className={isMap ? 'relative flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 lg:px-8 lg:pb-10'}>
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="safe-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
          aria-label="ניווט ראשי"
        >
          <ul className="grid grid-cols-5">
            {NAV.map(({ href, label, Icon }) => {
              const active = isActive(path, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? 'text-accent' : 'text-muted'}`}
                  >
                    <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.4 : 2} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${compact ? '' : 'px-5 pt-5 pb-3'}`}>
      <Image src="/icons/icon-192.png" alt="" width={compact ? 34 : 40} height={compact ? 34 : 40} className="rounded-xl" priority />
      <div className={`font-extrabold leading-tight tracking-tight ${compact ? 'text-lg' : 'text-xl'}`}>NahalWatch</div>
    </Link>
  );
}
