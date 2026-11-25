import { RotateCcw, WifiOff } from 'lucide-react';

/** Shown in place of a chart when a station's history can't be loaded (usually offline). */
export function LoadError({ onRetry, className = 'h-64' }: { onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={`grid place-items-center px-4 text-center ${className}`}>
      <div className="flex flex-col items-center gap-2 text-sm text-muted">
        <WifiOff className="size-6 text-faint" aria-hidden />
        <p>לא הצלחנו לטעון את היסטוריית המדידות. בדקו את החיבור ונסו שוב.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg hover:bg-surface-hover"
        >
          <RotateCcw className="size-3.5" aria-hidden /> נסו שוב
        </button>
      </div>
    </div>
  );
}
