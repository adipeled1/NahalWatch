import papersJson from '../../../../public/data/papers.json';
import type { PapersData } from '@/lib/papers';
import { DEFAULT_MODEL, buildPrompt, callGemini, parseAskBody, passagesFor, type AskResponse } from '@/lib/answer';
import { ASK_LIMITS, RateLimiter, clientIp, isSameOrigin } from '@/lib/rateLimit';

// "Ask the papers", server side. Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in the Vercel
// project's Environment Variables and redeploy to get written answers. The key never reaches the
// browser. Without a key the chat never calls this route (see layout.tsx); if it is called anyway,
// or Gemini fails, it replies { mode: 'quotes' } and the chat shows the quotes only.
// Every call to Gemini costs quota, so the route only answers our own site and is rate-limited
// per visitor and in total (see rateLimit.ts); over the limit it replies 429 and the chat shows quotes.

const data = papersJson as PapersData;
const noStore = { 'cache-control': 'no-store' };

const perMinute = new RateLimiter(ASK_LIMITS.perMinute);
const perDay = new RateLimiter(ASK_LIMITS.perDay);
const total = new RateLimiter(ASK_LIMITS.global);

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, request.url)) {
    return Response.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400, headers: noStore });
  }
  const parsed = parseAskBody(body, data.chunks.length);
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400, headers: noStore });

  const reply = (r: AskResponse) => Response.json(r, { headers: noStore });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply({ mode: 'quotes', reason: 'no-key' });
  if (!parsed.ids.length) return reply({ mode: 'quotes', reason: 'no-passages' });

  // Counted only for requests that would reach Gemini.
  const ip = clientIp(request.headers);
  if (!perMinute.hit(ip) || !perDay.hit(ip) || !total.hit('all')) {
    return Response.json({ error: 'rate limited' }, { status: 429, headers: { ...noStore, 'retry-after': '60' } });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  try {
    const answer = await callGemini(buildPrompt(parsed.question, passagesFor(data, parsed.ids)), { apiKey, model });
    return reply({ mode: 'answer', answer, model });
  } catch (e) {
    console.error('[ask] Gemini failed, falling back to quotes:', e instanceof Error ? e.message : e);
    return reply({ mode: 'quotes', reason: 'error' });
  }
}
