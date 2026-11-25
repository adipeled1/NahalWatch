'use client'; // Error boundaries must be Client Components
/**
 * Error boundary for every page under the root layout: if a page crashes, the shell (navigation,
 * theme, "Ask the papers") stays up and only the page area shows this message.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error('[NahalWatch] page error', error.digest ?? '', error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-caution-soft text-caution">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-extrabold">משהו השתבש בעמוד הזה</h1>
      <p className="text-sm text-muted">
        לא הצלחנו להציג את העמוד. אפשר לנסות שוב, או לחזור למפה. אם אתם בשטח בלי קליטה, ייתכן שהעמוד לא נשמר במכשיר.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-fg hover:bg-accent-hover"
        >
          <RotateCcw className="size-4" aria-hidden /> נסו שוב
        </button>
        <Link href="/" className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-surface-hover">
          חזרה למפה
        </Link>
      </div>
    </div>
  );
}
