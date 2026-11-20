'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BellRing, ChevronLeft, Lightbulb, LineChart, Sunrise } from 'lucide-react';
import { REGION_LABEL } from '@/lib/data';
import { ageLabel, exceedances, type Status } from '@/lib/quality';
import { countByStatus, driveMinutes, nearestSafe, rateAll, type RatedStation } from '@/lib/stations';
import { useFavorites } from '@/lib/storage';
import type { Region } from '@/lib/types';
import { Card, Chip, PageHeader } from '@/components/ui/Card';
import { FindingList, statusTone } from '@/components/ui/Status';

const TITLE: Record<Status, string> = {
  danger: 'אזהרת זיהום',
  caution: 'חשד לזיהום',
  safe: 'עדכון איכות מים — תקין',
  unknown: 'דגימה חדשה',
};

const TIPS = [
  'אל תבלעו מים מהנחל — גם כשהם נראים צלולים, חיידקים לא נראים בעין.',
  'אחרי גשם ראשון הזיהום בנחלים עולה: שפכים ונגר נשטפים פנימה. עדיף לחכות כמה ימים.',
  'פצע פתוח? עדיף לא להיכנס למים — זו הדרך הקלה ביותר לזיהום.',
  'שמרו על הנחל: קחו את הפסולת איתכם, אל תשתמשו בסבון במים ואל תאכילו דגים.',
];

export default function UpdatesFeed() {
  const rated = useMemo(() => rateAll(), []);
  const { favorites } = useFavorites();
  const [filter, setFilter] = useState<'all' | 'alerts' | 'mine'>('all');
  const [region, setRegion] = useState<Region | 'all'>('north');
  const [notif, setNotif] = useState<string | null>(null);

  const recent = rated.filter((r) => !r.old);
  const regional = recent.filter((r) => region === 'all' || r.station.region === region);
  const counts = countByStatus(regional);
  const measured = counts.safe + counts.caution + counts.danger;
  const pctSafe = measured ? Math.round((counts.safe / measured) * 100) : 0;

  const feed = regional
    .filter((r) => (filter === 'alerts' ? r.assessment.status === 'danger' || r.assessment.status === 'caution' : true))
    .filter((r) => (filter === 'mine' ? favorites.includes(r.station.id) : true))
    .sort((a, b) => b.station.latest.d.localeCompare(a.station.latest.d))
    .slice(0, 40);

  const myAlerts = rated.filter((r) => favorites.includes(r.station.id) && (r.assessment.status === 'danger' || r.assessment.status === 'caution'));
  const morning = myAlerts[0];
  const morningAlt = morning ? nearestSafe(morning.station, rated) : null;
  const tip = TIPS[new Date().getDate() % TIPS.length];

  const enableNotifications = async () => {
    if (!('Notification' in window)) { setNotif('הדפדפן לא תומך בהתראות. ב-iPhone יש להוסיף קודם את האפליקציה למסך הבית.'); return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { setNotif('ההתראות לא אושרו. אפשר לשנות זאת בהגדרות הדפדפן.'); return; }
    const body = myAlerts.length
      ? `${myAlerts.length} מהנחלים שלך במצב חשוד או אזהרה. ${myAlerts[0].station.stream}: ${myAlerts[0].assessment.headline}`
      : favorites.length ? 'כל הנחלים שלך במצב תקין.' : 'סמנו נחלים בכוכב כדי לקבל עליהם התראות.';
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification('NahalWatch', { body, icon: '/icons/icon-192.png', lang: 'he', dir: 'rtl' });
    else new Notification('NahalWatch', { body, icon: '/icons/icon-192.png', lang: 'he', dir: 'rtl' });
    setNotif('ההתראות פעילות במכשיר הזה.');
  };

  return (
    <div>
      <PageHeader title="התראות ועדכונים" subtitle="הדגימות האחרונות מכל תחנות הניטור, כמו מהדורת חדשות של הנחלים." />

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        {/* Regional status ring */}
        <Card className="flex items-center gap-4 p-4 lg:col-span-1">
          <Ring pct={pctSafe} />
          <div className="min-w-0">
            <div className="text-sm font-bold">מצב כללי · {REGION_LABEL[region]}</div>
            <p className="mt-0.5 text-xs text-muted">
              מהתחנות שנדגמו ב-3 השנים האחרונות במצב תקין
            </p>
            <div className="mt-1.5 flex gap-2 text-xs font-semibold">
              <span className="text-safe">{counts.safe} תקין</span>
              <span className="text-caution">{counts.caution} חשוד</span>
              <span className="text-danger">{counts.danger} אזהרה</span>
            </div>
          </div>
        </Card>

        {/* Morning alert (persona: Michal) */}
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-water-soft text-water"><Sunrise className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">התראת בוקר לנחלים שלי</div>
              {morning ? (
                <p className="mt-1 text-sm">
                  <b className={statusTone(morning.assessment.status).text}>{morning.station.stream} ({morning.station.name}): {morning.assessment.headline}.</b>{' '}
                  {morningAlt
                    ? <>נחל חלופי במרחק כ-{driveMinutes(morningAlt.km)} דקות נסיעה מסומן בירוק: <Link className="font-semibold text-water underline" href={`/station/${morningAlt.r.station.id}`}>{morningAlt.r.station.stream} · {morningAlt.r.station.name}</Link></>
                    : 'לא נמצאה חלופה תקינה קרובה.'}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  {favorites.length ? 'כל הנחלים שסימנתם במצב תקין. טיול מהנה!' : 'סמנו נחלים בכוכב ⭐ כדי לקבל כאן עדכון בבוקר הטיול.'}
                </p>
              )}
              <button type="button" onClick={enableNotifications} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-surface-hover">
                <BellRing className="size-4 text-water" /> הפעלת התראות במכשיר
              </button>
              {notif && <p className="mt-1.5 text-xs text-muted">{notif}</p>}
            </div>
          </div>
        </Card>
      </div>

      <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>הכל</Chip>
        <Chip active={filter === 'alerts'} onClick={() => setFilter('alerts')}>אזהרות בלבד</Chip>
        <Chip active={filter === 'mine'} onClick={() => setFilter('mine')}>הנחלים שלי</Chip>
        <span className="mx-1 w-px shrink-0 bg-border" aria-hidden />
        {(['north', 'center', 'south', 'all'] as const).map((r) => (
          <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{REGION_LABEL[r]}</Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <ol className="flex flex-col gap-3">
          {feed.length === 0 && <li className="py-10 text-center text-muted">אין עדכונים להצגה.</li>}
          {feed.map((r) => <FeedItem key={r.station.id} r={r} />)}
        </ol>

        <aside className="flex flex-col gap-3">
          <Link href="/models" className="block">
            <Card className="p-4 transition-colors hover:bg-surface-hover">
              <div className="flex items-center gap-2 text-sm font-bold"><LineChart className="size-4 text-water" /> תחזית אקולוגית</div>
              <p className="mt-1 text-xs text-muted">מודל לוטקה–וולטרה ומודל גידול לוגיסטי: איך אוכלוסיית החיידקים בנחל צפויה להשתנות בימים הקרובים.</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-water">למעבדת המודלים <ChevronLeft className="size-3.5" /></span>
            </Card>
          </Link>
          <Card className="border-caution/30 bg-caution-soft p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-caution"><Lightbulb className="size-4" /> טיפ מהטבע</div>
            <p className="mt-1 text-sm">{tip}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FeedItem({ r }: { r: RatedStation }) {
  const s = r.assessment.status;
  const tone = statusTone(s);
  const issues = exceedances(r.assessment).filter((f) => f.severity === 'danger' || s !== 'danger');
  return (
    <li>
      <Link href={`/station/${r.station.id}`} className={`block rounded-2xl border bg-surface p-4 shadow-card transition-colors hover:bg-surface-hover ${tone.border}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone.bg} ${tone.text}`}><tone.Icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={`font-bold ${tone.text}`}>{TITLE[s]} — {r.station.stream}</h3>
              <span className="shrink-0 text-xs text-faint">{ageLabel(r.station.latest.d)}</span>
            </div>
            <p className="text-sm text-muted">{r.station.name} · {r.assessment.familyAnswer}</p>
            {issues.length > 0 && <div className="mt-2"><FindingList findings={issues.slice(0, 2)} compact /></div>}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--safe)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-lg font-extrabold">{pct}%</span>
    </div>
  );
}
