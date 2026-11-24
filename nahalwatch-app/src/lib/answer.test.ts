import { afterEach, describe, expect, it, vi } from 'vitest';
import papersJson from '../../public/data/papers.json';
import type { PapersData } from './papers';
import { buildIndex, search } from './papers';
import { MAX_PASSAGES, buildPrompt, callGemini, parseAskBody, passagesFor, splitCitations } from './answer';
import { GET, POST } from '@/app/api/ask/route';

const data = papersJson as PapersData;
const N = data.chunks.length;
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const geminiReply = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseAskBody', () => {
  it('accepts a question with valid passage ids and drops duplicates', () => {
    expect(parseAskBody({ question: '  גשם? ', ids: [3, 3, 7] }, N)).toEqual({ question: 'גשם?', ids: [3, 7] });
  });
  it('rejects bad input', () => {
    expect(parseAskBody(null, N)).toHaveProperty('error');
    expect(parseAskBody({ question: '', ids: [] }, N)).toHaveProperty('error');
    expect(parseAskBody({ question: 'x'.repeat(501), ids: [] }, N)).toHaveProperty('error');
    expect(parseAskBody({ question: 'q', ids: [N] }, N)).toHaveProperty('error');
    expect(parseAskBody({ question: 'q', ids: [1.5] }, N)).toHaveProperty('error');
    expect(parseAskBody({ question: 'q', ids: Array.from({ length: MAX_PASSAGES + 1 }, (_, i) => i) }, N)).toHaveProperty('error');
  });
});

describe('prompt', () => {
  it('numbers the server-side passages in the order given and keeps the question', () => {
    const passages = passagesFor(data, [10, 2]);
    expect(passages.map((p) => p.n)).toEqual([1, 2]);
    expect(passages[0].text).toBe(data.chunks[10].t);
    const prompt = buildPrompt('איך גשם משפיע?', passages);
    expect(prompt).toContain('[1] (');
    expect(prompt).toContain('[2] (');
    expect(prompt).toContain('Question: איך גשם משפיע?');
    expect(prompt).toMatch(/ONLY the numbered quotes/);
  });
});

describe('splitCitations', () => {
  it('turns [n] into citation parts and leaves out-of-range numbers as text', () => {
    expect(splitCitations('גשם מעלה חיידקים [1][2]. ראו [9].', 3)).toEqual([
      { text: 'גשם מעלה חיידקים ' }, { text: '[1]', cite: 1 }, { text: '[2]', cite: 2 }, { text: '. ראו [9].' },
    ]);
  });
});

describe('callGemini', () => {
  it('sends the key in a header (not the URL) and returns the text', async () => {
    const f = vi.fn().mockResolvedValue(geminiReply(' answer [1] '));
    await expect(callGemini('p', { apiKey: 'k', fetchImpl: f as unknown as typeof fetch })).resolves.toBe('answer [1]');
    const [url, init] = f.mock.calls[0];
    expect(String(url)).not.toContain('k=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
  });
  it('throws on an HTTP error', async () => {
    const f = vi.fn().mockResolvedValue(new Response('quota', { status: 429 }));
    await expect(callGemini('p', { apiKey: 'k', fetchImpl: f as unknown as typeof fetch })).rejects.toThrow('429');
  });
});

describe('/api/ask', () => {
  const ids = search(buildIndex(data), 'איך גשם משפיע על חיידקים צואתיים בנחל?').hits.map((h) => h.idx);

  it('without a key: GET reports no generation and POST answers with quotes only', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await (await GET()).json()).toEqual({ generation: false });
    const res = await post({ question: 'גשם', ids });
    expect(await res.json()).toEqual({ mode: 'quotes', reason: 'no-key' });
  });

  it('with a key: returns the written answer', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const f = vi.fn().mockResolvedValue(geminiReply('גשם כבד מעלה את ריכוז החיידקים [1].'));
    vi.stubGlobal('fetch', f);
    expect(await (await GET()).json()).toEqual({ generation: true });
    const body = await (await post({ question: 'איך גשם משפיע?', ids })).json();
    expect(body).toMatchObject({ mode: 'answer', answer: 'גשם כבד מעלה את ריכוז החיידקים [1].' });
    const sent = JSON.parse(f.mock.calls[0][1].body).contents[0].parts[0].text as string;
    expect(sent).toContain(data.chunks[ids[0]].t); // passages come from the server's own copy
  });

  it('with a key but Gemini failing: falls back to quotes', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await (await post({ question: 'גשם', ids })).json()).toEqual({ mode: 'quotes', reason: 'error' });
  });

  it('rejects invalid requests with 400', async () => {
    expect((await post({ question: 'q', ids: [-1] })).status).toBe(400);
  });
});
