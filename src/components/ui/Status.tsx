import { AlertTriangle, CheckCircle2, CircleHelp, OctagonAlert } from 'lucide-react';
import type { Finding, Status } from '@/lib/quality';
import { STATUS_LABEL } from '@/lib/quality';

const TONE: Record<Status, { text: string; bg: string; border: string; Icon: typeof CheckCircle2 }> = {
  safe: { text: 'text-safe', bg: 'bg-safe-soft', border: 'border-safe/30', Icon: CheckCircle2 },
  caution: { text: 'text-caution', bg: 'bg-caution-soft', border: 'border-caution/30', Icon: AlertTriangle },
  danger: { text: 'text-danger', bg: 'bg-danger-soft', border: 'border-danger/30', Icon: OctagonAlert },
  unknown: { text: 'text-unknown', bg: 'bg-unknown-soft', border: 'border-unknown/30', Icon: CircleHelp },
};
export const statusTone = (s: Status) => TONE[s];

/** Pill with icon + text — status is never conveyed by color alone (WCAG 1.4.1). */
export function StatusBadge({ status, size = 'sm', label }: { status: Status; size?: 'sm' | 'md'; label?: string }) {
  const t = TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${t.text} ${t.bg} ${t.border} ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <t.Icon className={size === 'md' ? 'size-4' : 'size-3.5'} aria-hidden />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  const t = TONE[status];
  return <t.Icon className={`size-5 shrink-0 ${t.text}`} aria-label={STATUS_LABEL[status]} />;
}

/**
 * The red/yellow "why" list: one line per exceeded parameter, e.g.
 * "קוליפורמים צואתיים (Fecal coliforms): 2,400 cfu/100ml — מעל הסף של 1,000".
 */
export function FindingList({ findings, compact }: { findings: Finding[]; compact?: boolean }) {
  if (!findings.length) return null;
  return (
    <ul className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {findings.map((f) => {
        const danger = f.severity === 'danger';
        const Icon = danger ? OctagonAlert : AlertTriangle;
        return (
          <li
            key={f.key}
            className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
              danger ? 'bg-danger-soft text-danger' : 'bg-caution-soft text-caution'
            }`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {f.label}: <bdi dir="ltr" className="num font-extrabold whitespace-nowrap">{f.valueText}</bdi> — {f.verdict}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
