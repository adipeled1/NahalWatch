import type { ReactNode } from 'react';

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}>{children}</As>;
}

export function CardHeader({ title, subtitle, icon, action }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children, title }: { active?: boolean; onClick?: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-border bg-surface text-fg hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'safe' | 'caution' | 'danger' | 'water' }) {
  const color = tone ? { safe: 'text-safe', caution: 'text-caution', danger: 'text-danger', water: 'text-water' }[tone] : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-extrabold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-faint">{hint}</div>}
    </div>
  );
}
