import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPinOff } from 'lucide-react';

export const metadata: Metadata = { title: 'העמוד לא נמצא' };

/** 404 for any unknown URL (including /station/<id> for an id that doesn't exist). */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted">
        <MapPinOff className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-extrabold">העמוד לא נמצא</h1>
      <p className="text-sm text-muted">ייתכן שהקישור שגוי, או שהתחנה כבר לא קיימת בנתונים.</p>
      <div className="flex gap-2">
        <Link href="/" className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-fg hover:bg-accent-hover">למפה</Link>
        <Link href="/streams" className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-surface-hover">כל הנחלים</Link>
      </div>
    </div>
  );
}
