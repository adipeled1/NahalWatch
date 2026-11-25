/**
 * In-memory rate limits for /api/ask, so nobody can loop the route and spend the Gemini quota.
 *
 * Limits are per server instance (memory isn't shared between serverless instances), which is
 * enough to stop a single client from looping the route. For a hard global cap, move the counters
 * to a shared store (e.g. Vercel KV / Upstash).
 */

export interface Limit { max: number; windowMs: number }

export const ASK_LIMITS = {
  /** Per visitor (IP): a burst of questions, then a daily allowance. */
  perMinute: { max: 6, windowMs: 60_000 },
  perDay: { max: 60, windowMs: 86_400_000 },
  /** All visitors together, per instance. */
  global: { max: 1000, windowMs: 86_400_000 },
} satisfies Record<string, Limit>;

interface Window { start: number; count: number }

/** Fixed-window counters. `hit` counts one request and says whether it is allowed. */
export class RateLimiter {
  private windows = new Map<string, Window>();
  constructor(private limit: Limit, private maxKeys = 10_000) {}

  hit(key: string, now = Date.now()): boolean {
    let w = this.windows.get(key);
    if (!w || now - w.start >= this.limit.windowMs) {
      if (!w && this.windows.size >= this.maxKeys) this.prune(now);
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    if (w.count >= this.limit.max) return false;
    w.count++;
    return true;
  }

  /** Drops expired windows (and, if still full, the oldest) so memory stays bounded. */
  private prune(now: number) {
    for (const [k, w] of this.windows) if (now - w.start >= this.limit.windowMs) this.windows.delete(k);
    while (this.windows.size >= this.maxKeys) this.windows.delete(this.windows.keys().next().value!);
  }
}

/** The client's IP as the platform reports it (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || headers.get('x-real-ip')?.trim() || 'unknown';
}

/** A browser POST from another site carries its Origin; only our own host may call the route. */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const origin = headers.get('origin');
  if (!origin) return true; // same-origin GET/HEAD or a non-browser client; the IP limits still apply
  try {
    const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? new URL(requestUrl).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
