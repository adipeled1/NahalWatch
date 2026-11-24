import papersJson from '../../../../public/data/papers.json';
import type { PapersData } from '@/lib/papers';
import { DEFAULT_MODEL, buildPrompt, callGemini, parseAskBody, passagesFor, type AskResponse } from '@/lib/answer';

// "Ask the papers", server side. Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in the Vercel
// project's Environment Variables to get written answers. The key never reaches the browser.
// Without it the chat still works: it shows the retrieved quotes only.

const data = papersJson as PapersData;
const noStore = { 'cache-control': 'no-store' };

/** Lets the chat know whether written answers are available. */
export async function GET() {
  return Response.json({ generation: Boolean(process.env.GEMINI_API_KEY) }, { headers: noStore });
}

export async function POST(request: Request) {
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

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  try {
    const answer = await callGemini(buildPrompt(parsed.question, passagesFor(data, parsed.ids)), { apiKey, model });
    return reply({ mode: 'answer', answer, model });
  } catch (e) {
    console.error('[ask] Gemini failed, falling back to quotes:', e instanceof Error ? e.message : e);
    return reply({ mode: 'quotes', reason: 'error' });
  }
}
