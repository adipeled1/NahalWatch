'use client'; // Error boundaries must be Client Components
/**
 * Last-resort boundary for errors in the root layout itself (AppShell). It replaces the whole
 * document, so it brings its own <html>/<body> and the global styles.
 */
import './globals.css';

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="he" dir="rtl" data-theme="light">
      <body className="grid min-h-dvh place-items-center bg-bg p-6 font-sans text-fg">
        <title>NahalWatch — שגיאה</title>
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
          <h1 className="text-xl font-extrabold">NahalWatch לא נטען כראוי</h1>
          <p className="text-sm text-muted">אירעה שגיאה בטעינת האתר. נסו שוב בעוד רגע.</p>
          {error.digest && <p className="text-xs text-faint" dir="ltr">ref: {error.digest}</p>}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-fg"
          >
            נסו שוב
          </button>
        </div>
      </body>
    </html>
  );
}
