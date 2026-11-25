/**
 * Calendar days in Israel time. (The client clock hook is `useNow` in useNow.ts.)
 *
 * Samples are calendar days ("2025-11-04"). "Today" must be the Israeli calendar day, not the UTC
 * one, or a sample from yesterday reads as "today" between midnight and 02:00/03:00.
 */
export const DAY_MS = 86400000;

const IL_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day in Israel at `date`, as "YYYY-MM-DD". */
export function israelDay(date: Date): string {
  const parts = Object.fromEntries(IL_DAY.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Midnight UTC of a "YYYY-MM-DD" day, in ms: one number per calendar day, for day arithmetic. */
export const dayValue = (isoDay: string) => Date.parse(`${isoDay}T00:00:00Z`);
