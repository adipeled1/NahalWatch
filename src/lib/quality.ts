/**
 * Swim-safety "traffic light" for a single sample.
 *
 * The rules are an EDUCATIONAL index built for this project, not an official
 * Ministry of Health ruling. Thresholds follow commonly used recreational-water
 * guidance (fecal indicator bacteria, EU Bathing Water Directive inland classes)
 * and Israeli stream-quality targets (Inbar committee) for the chemical
 * indicators. Every threshold lives in RULES so the team can tune them in one place.
 */
import { paramInfo } from './params';
import type { Sample } from './types';

export type Status = 'safe' | 'caution' | 'danger' | 'unknown';
export type Severity = 'ok' | 'caution' | 'danger';

interface Rule {
  key: string;
  /** Value above which the reading is a caution / danger. */
  cautionAbove?: number;
  dangerAbove?: number;
  /** For parameters where LOW is bad (dissolved oxygen). */
  cautionBelow?: number;
  /** pH-style acceptable range. */
  range?: [number, number];
  /** Bacteria decide the status on their own; chemistry can only raise it to "caution". */
  decisive: boolean;
}

export const RULES: Rule[] = [
  { key: 'Fcoli', cautionAbove: 200, dangerAbove: 1000, decisive: true },
  { key: 'Ecoli', cautionAbove: 500, dangerAbove: 1000, decisive: true },
  { key: 'Fstrp', cautionAbove: 200, dangerAbove: 400, decisive: true },
  { key: 'BODt', cautionAbove: 15, decisive: false },
  { key: 'NH4', cautionAbove: 1.5, decisive: false },
  { key: 'Do', cautionBelow: 3, decisive: false },
  { key: 'pH', range: [6.5, 8.5], decisive: false },
  { key: 'Minoil', cautionAbove: 1, decisive: false },
  { key: 'TSS105', cautionAbove: 50, decisive: false },
];

const BACTERIA_KEYS = RULES.filter((r) => r.decisive).map((r) => r.key);

export interface Finding {
  key: string;
  label: string;
  value: number;
  unit: string;
  severity: Severity;
  /** The limit that was crossed (or the nearest one, for "ok" readings). */
  limit: number | null;
  /** Formatted value with unit, e.g. "2,400 cfu/100ml" (render LTR-isolated). */
  valueText: string;
  /** e.g. "מעל הסף של 1,000" */
  verdict: string;
  /** Human sentence, e.g. "קוליפורמים צואתיים: 2,400 cfu/100ml — מעל הסף של 1,000" */
  message: string;
}

export interface Assessment {
  status: Status;
  /** Every rule-checked parameter in the sample, worst first. */
  findings: Finding[];
  /** 0 (very polluted) … 100 (clean). null when no rule parameter was measured. */
  score: number | null;
  /** Suitable for small children: safe AND fecal coliforms at "excellent" level. */
  kidFriendly: boolean;
  headline: string;
  familyAnswer: string;
}

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
export const fmt = (n: number) => nf.format(n);

function evaluate(rule: Rule, value: number, qualifier?: string): Finding {
  const info = paramInfo(rule.key);
  const unit = info.unit ? ` ${info.unit}` : '';
  const label = info.en && info.en !== info.he ? `${info.he} (${info.en})` : info.he;
  // "<x" means the true value is below x — never count it as an exceedance.
  const below = qualifier === '<';

  let severity: Severity = 'ok';
  let limit: number | null = rule.dangerAbove ?? rule.cautionAbove ?? rule.cautionBelow ?? null;
  let verdict = 'תקין';

  if (rule.dangerAbove != null && value > rule.dangerAbove && !below) {
    severity = 'danger';
    limit = rule.dangerAbove;
    verdict = `מעל הסף של ${fmt(rule.dangerAbove)}`;
  } else if (rule.cautionAbove != null && value > rule.cautionAbove && !below) {
    severity = 'caution';
    limit = rule.cautionAbove;
    verdict = `מעל ${fmt(rule.cautionAbove)}`;
  } else if (rule.cautionBelow != null && value < rule.cautionBelow) {
    severity = 'caution';
    limit = rule.cautionBelow;
    verdict = `מתחת למינימום של ${fmt(rule.cautionBelow)}`;
  } else if (rule.range && (value < rule.range[0] || value > rule.range[1])) {
    severity = 'caution';
    limit = value < rule.range[0] ? rule.range[0] : rule.range[1];
    verdict = `מחוץ לטווח ${rule.range[0]}–${rule.range[1]}`;
  }
  const valueText = `${qualifier ?? ''}${fmt(value)}${unit}`;
  return { key: rule.key, label, value, unit: info.unit, severity, limit, valueText, verdict,
    message: `${label}: ${valueText} — ${verdict}` };
}

const RANK: Record<Severity, number> = { danger: 2, caution: 1, ok: 0 };

/** Score: 100 minus a penalty per parameter, bacteria weighted heaviest (log scale). */
function computeScore(sample: Sample): number | null {
  let penalty = 0;
  let measured = 0;
  const f = sample.v.Fcoli ?? sample.v.Ecoli;
  if (f != null) {
    measured++;
    // 10 cfu → 0, 200 → ~23, 1000 → ~37, 10 000 → ~55, 100 000+ → 70
    penalty += Math.min(70, Math.max(0, (Math.log10(Math.max(f, 1)) - 1) * 17.5));
  }
  for (const r of RULES.filter((x) => !x.decisive)) {
    const v = sample.v[r.key];
    if (v == null) continue;
    measured++;
    if (evaluate(r, v, sample.q?.[r.key]).severity !== 'ok') penalty += 8;
  }
  if (!measured) return null;
  return Math.max(0, Math.round(100 - penalty));
}

export function assess(sample: Sample | undefined | null): Assessment {
  if (!sample) {
    return { status: 'unknown', findings: [], score: null, kidFriendly: false,
      headline: 'אין נתונים', familyAnswer: 'אין לנו נתונים על התחנה הזו.' };
  }
  const findings = RULES.filter((r) => sample.v[r.key] != null)
    .map((r) => evaluate(r, sample.v[r.key], sample.q?.[r.key]))
    .sort((a, b) => RANK[b.severity] - RANK[a.severity]);

  const bact = findings.filter((f) => BACTERIA_KEYS.includes(f.key));
  const chem = findings.filter((f) => !BACTERIA_KEYS.includes(f.key));

  let status: Status;
  if (!bact.length) status = 'unknown';
  else if (bact.some((f) => f.severity === 'danger')) status = 'danger';
  else if (bact.some((f) => f.severity === 'caution') || chem.some((f) => f.severity !== 'ok')) status = 'caution';
  else status = 'safe';

  const fcoli = sample.v.Fcoli;
  const kidFriendly = status === 'safe' && (fcoli == null || fcoli <= 100);

  const HEADLINE: Record<Status, string> = {
    safe: 'מים תקינים לרחצה',
    caution: 'חשד — מומלץ להיזהר',
    danger: 'אזהרה: אין להיכנס למים',
    unknown: 'אין מדידת חיידקים',
  };
  const FAMILY: Record<Status, string> = {
    safe: kidFriendly ? 'כן, אפשר להיכנס עם הילדים.' : 'אפשר להיכנס, אבל עדיף שילדים קטנים לא יבלעו מים.',
    caution: 'עדיף לא להכניס ילדים למים. מבוגרים — רק בזהירות.',
    danger: 'לא. המים מזוהמים ואין להיכנס אליהם.',
    unknown: 'אין לנו מספיק מידע כדי לומר. כדאי לבדוק תחנה סמוכה.',
  };

  return { status, findings, score: computeScore(sample), kidFriendly, headline: HEADLINE[status], familyAnswer: FAMILY[status] };
}

/** Findings that crossed a limit — what the red/yellow card spells out. */
export const exceedances = (a: Assessment) => a.findings.filter((f) => f.severity !== 'ok');

export const STATUS_LABEL: Record<Status, string> = {
  safe: 'מותר לרחצה',
  caution: 'חשוד',
  danger: 'אזהרה',
  unknown: 'אין נתונים',
};

/** Whole days between a sample and now. */
export function ageInDays(isoDay: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(`${isoDay}T00:00:00Z`).getTime()) / 86400000);
}

export function ageLabel(isoDay: string, now: Date = new Date()): string {
  const d = ageInDays(isoDay, now);
  if (d <= 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 31) return `לפני ${d} ימים`;
  const m = Math.round(d / 30.4);
  if (m < 12) return m === 1 ? 'לפני חודש' : `לפני ${m} חודשים`;
  const y = Math.max(1, Math.floor(d / 365));
  return y === 1 ? 'לפני שנה' : `לפני ${y} שנים`;
}

/** Data older than this is shown with a "stale" warning (NFR: show when data is old). */
export const STALE_DAYS = 180;
