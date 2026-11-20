/** "מדד איכות מים" 0–100 on a red→yellow→green gradient, with the marker at the score. */
export function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return null;
  const label = score >= 75 ? 'טוב' : score >= 55 ? 'בינוני' : 'ירוד';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-muted">מדד איכות מים</span>
        <span className="font-bold">
          <span className="num text-sm">{score}</span>
          <span className="text-muted"> / 100 · {label}</span>
        </span>
      </div>
      <div
        className="relative h-2.5 rounded-full"
        style={{ background: 'linear-gradient(to left, var(--danger), var(--caution) 45%, var(--safe) 80%)' }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label="מדד איכות מים"
      >
        <span
          className="absolute top-1/2 size-4 -translate-y-1/2 translate-x-1/2 rounded-full border-[3px] border-surface bg-fg shadow"
          style={{ right: `${score}%` }}
        />
      </div>
    </div>
  );
}
