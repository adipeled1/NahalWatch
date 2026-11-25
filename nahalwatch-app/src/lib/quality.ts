/**
 * Swim-safety "traffic light" for a single sample, built ONLY from official Israeli limits:
 *
 * 1. Ministry of Health — bathing/wading in streams (Environmental Health Dept., 2024 activity
 *    report, May 2025, based on the Chief Engineer's 2010 bathing-water guideline):
 *    fecal coliforms ≤ 200 /100 ml seasonal geometric mean; > 400 /100 ml is an exceedance,
 *    after which the Ministry warns that entering the stream may be dangerous.
 *    → green ≤ 200 · amber 200–400 · red > 400.
 * 2. Inbar regulations — Public Health Regulations (Effluent Quality Standards and Rules for
 *    Sewage Treatment), 2010, First Schedule, "quality required for discharge to streams".
 *    Each parameter has a "maximum monthly average" and a "maximum value":
 *    → amber above the monthly-average value · red above the maximum value.
 *    Parameters with a single hard limit (dissolved-oxygen minimum, pH range) → red when breached.
 *
 * Parameters with no official limit (E. coli, fecal streptococci, temperature, …) are shown
 * but never change the color. Every limit lives in RULES.
 */
import { paramInfo } from './params';
import { DAY_MS, dayValue, israelDay } from './time';
import type { Sample } from './types';

export type Status = 'safe' | 'caution' | 'danger' | 'unknown';
export type Severity = 'ok' | 'caution' | 'danger';
export type RuleSource = 'moh' | 'inbar';

export interface Rule {
  key: string;
  source: RuleSource;
  /** Value above which the reading is amber / red. */
  cautionAbove?: number;
  dangerAbove?: number;
  /** Hard minimum (dissolved oxygen) — red when breached. */
  dangerBelow?: number;
  /** Hard allowed range (pH) — red when breached. */
  range?: [number, number];
}

export const SOURCE_LABEL: Record<RuleSource, string> = {
  moh: 'משרד הבריאות',
  inbar: 'תקנות ענבר',
};

export const RULES: Rule[] = [
  // Ministry of Health — bathing in streams
  { key: 'Fcoli', source: 'moh', cautionAbove: 200, dangerAbove: 400 },
  // Inbar regulations, First Schedule, discharge to streams: monthly-average value / maximum value
  { key: 'BODt', source: 'inbar', cautionAbove: 10, dangerAbove: 15 },
  { key: 'CODt', source: 'inbar', cautionAbove: 70, dangerAbove: 100 },
  { key: 'TSS105', source: 'inbar', cautionAbove: 10, dangerAbove: 15 },
  // The schedule limits ammonia nitrogen; the lab column is NH4 and is compared as reported.
  { key: 'NH4', source: 'inbar', cautionAbove: 1.5, dangerAbove: 2.5 },
  { key: 'Ntot', source: 'inbar', cautionAbove: 10, dangerAbove: 15 },
  { key: 'Ptot', source: 'inbar', cautionAbove: 1, dangerAbove: 2 },
  { key: 'Cl', source: 'inbar', cautionAbove: 400, dangerAbove: 480 },
  { key: 'Na', source: 'inbar', cautionAbove: 200, dangerAbove: 240 },
  { key: 'Minoil', source: 'inbar', cautionAbove: 1.0, dangerAbove: 1.5 },
  { key: 'ABS', source: 'inbar', cautionAbove: 0.5, dangerAbove: 1.0 },
  { key: 'Hg', source: 'inbar', cautionAbove: 0.0005, dangerAbove: 0.0025 },
  { key: 'Cr', source: 'inbar', cautionAbove: 0.05, dangerAbove: 0.25 },
  { key: 'Ni', source: 'inbar', cautionAbove: 0.05, dangerAbove: 0.25 },
  { key: 'Pb', source: 'inbar', cautionAbove: 0.008, dangerAbove: 0.04 },
  { key: 'Cd', source: 'inbar', cautionAbove: 0.005, dangerAbove: 0.025 },
  { key: 'Zn', source: 'inbar', cautionAbove: 0.2, dangerAbove: 1.0 },
  { key: 'As', source: 'inbar', cautionAbove: 0.01, dangerAbove: 0.05 },
  { key: 'Cu', source: 'inbar', cautionAbove: 0.02, dangerAbove: 0.1 },
  { key: 'Do', source: 'inbar', dangerBelow: 3 },
  { key: 'pH', source: 'inbar', range: [7.0, 8.5] },
];

export interface Finding {
  key: string;
  label: string;
  value: number;
  unit: string;
  severity: Severity;
  source: RuleSource;
  /** The limit that was crossed (or the nearest one, for "ok" readings). */
  limit: number | null;
  /** Formatted value with unit, e.g. "2,400 cfu/100ml" (render LTR-isolated). */
  valueText: string;
  /** e.g. "מעל הסף של 400 (משרד הבריאות)" */
  verdict: string;
  /** Human sentence, e.g. "קוליפורמים צואתיים: 2,400 cfu/100ml — מעל הסף של 400 (משרד הבריאות)" */
  message: string;
}

export interface Assessment {
  status: Status;
  /** Every rule-checked parameter in the sample, worst first. */
  findings: Finding[];
  headline: string;
  familyAnswer: string;
}

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 4 });
/** Number format for measured values (keeps small metal concentrations readable). */
export const fmt = (n: number) => nf.format(n);

function evaluate(rule: Rule, value: number, qualifier?: string): Finding {
  const info = paramInfo(rule.key);
  const unit = info.unit ? ` ${info.unit}` : '';
  const label = info.en && info.en !== info.he ? `${info.he} (${info.en})` : info.he;
  const src = SOURCE_LABEL[rule.source];
  // "<x" means the true value is below x — never count it as an exceedance.
  const below = qualifier === '<';

  let severity: Severity = 'ok';
  let limit: number | null = rule.dangerAbove ?? rule.cautionAbove ?? rule.dangerBelow ?? null;
  let verdict = 'בתקן';

  if (rule.dangerAbove != null && value > rule.dangerAbove && !below) {
    severity = 'danger';
    limit = rule.dangerAbove;
    verdict = `מעל הסף של ${fmt(rule.dangerAbove)} (${src}${rule.source === 'inbar' ? ', ערך מרבי' : ''})`;
  } else if (rule.cautionAbove != null && value > rule.cautionAbove && !below) {
    severity = 'caution';
    limit = rule.cautionAbove;
    verdict = `מעל ${fmt(rule.cautionAbove)} (${src}${rule.source === 'inbar' ? ', ממוצע חודשי' : ''})`;
  } else if (rule.dangerBelow != null && value < rule.dangerBelow) {
    severity = 'danger';
    limit = rule.dangerBelow;
    verdict = `מתחת למינימום של ${fmt(rule.dangerBelow)} (${src})`;
  } else if (rule.range && (value < rule.range[0] || value > rule.range[1])) {
    severity = 'danger';
    limit = value < rule.range[0] ? rule.range[0] : rule.range[1];
    verdict = `מחוץ לטווח ${fmt(rule.range[0])}–${fmt(rule.range[1])} (${src})`;
  }
  const valueText = `${qualifier ?? ''}${fmt(value)}${unit}`;
  return {
    key: rule.key, label, value, unit: info.unit, severity, source: rule.source, limit, valueText, verdict,
    message: `${label}: ${valueText} — ${verdict}`,
  };
}

const RANK: Record<Severity, number> = { danger: 2, caution: 1, ok: 0 };

const HEADLINE: Record<Status, string> = {
  safe: 'כל המדדים בתקן',
  caution: 'חשד — יש חריגה מהתקן',
  danger: 'אזהרה: לא להיכנס למים',
  unknown: 'אין מדידת קוליפורמים',
};
const ANSWER: Record<Status, string> = {
  safe: 'כן. כל המדדים שנבדקו בדגימה האחרונה בתוך הערכים הרשמיים.',
  caution: 'יש מדדים מעל היעד הרשמי — הפירוט למטה. מומלץ להיזהר ולא לבלוע מים.',
  danger: 'לא. יש מדדים מעל הערך המרבי הרשמי, והכניסה למים עלולה להיות מסוכנת.',
  unknown: 'בדגימה האחרונה לא נמדדו קוליפורמים צואתיים, ולכן אי אפשר לקבוע אם בטוח להיכנס.',
};

export function assess(sample: Sample | undefined | null): Assessment {
  if (!sample) {
    return { status: 'unknown', findings: [], headline: 'אין נתונים', familyAnswer: 'אין לנו נתונים על התחנה הזו.' };
  }
  const findings = RULES.filter((r) => sample.v[r.key] != null)
    .map((r) => evaluate(r, sample.v[r.key], sample.q?.[r.key]))
    .sort((a, b) => RANK[b.severity] - RANK[a.severity]);

  let status: Status;
  if (findings.some((f) => f.severity === 'danger')) status = 'danger';
  else if (findings.some((f) => f.severity === 'caution')) status = 'caution';
  else if (sample.v.Fcoli == null) status = 'unknown';
  else status = 'safe';

  return { status, findings, headline: HEADLINE[status], familyAnswer: ANSWER[status] };
}

/** Findings that crossed a limit — what the red/amber card spells out. */
export const exceedances = (a: Assessment) => a.findings.filter((f) => f.severity !== 'ok');

export const STATUS_LABEL: Record<Status, string> = {
  safe: 'בתקן',
  caution: 'חשוד',
  danger: 'אזהרה',
  unknown: 'אין נתונים',
};

/** Severity of one reading against its official rule ('ok' when the parameter has no rule). */
export function severityOf(key: string, value: number): Severity {
  const rule = RULES.find((r) => r.key === key);
  return rule ? evaluate(rule, value).severity : 'ok';
}

/** The official fecal-coliform rule (amber / red limits), for charts and the forecast. */
export const FCOLI_RULE = RULES.find((r) => r.key === 'Fcoli')!;

export const STATUS_RANK: Record<Status, number> = { unknown: 0, safe: 0, caution: 1, danger: 2 };

/** Whole calendar days (Israel time) between a sample day and now. */
export function ageInDays(isoDay: string, now: Date = new Date()): number {
  return Math.round((dayValue(israelDay(now)) - dayValue(isoDay)) / DAY_MS);
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
