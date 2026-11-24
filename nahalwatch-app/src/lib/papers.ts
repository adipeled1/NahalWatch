/**
 * "Ask the papers": extractive search over passages from five open-access papers.
 * No language model and no network call — BM25 ranking in the browser over
 * `public/data/papers.json` (built by `npm run papers`). Hebrew questions are mapped to
 * English domain terms with the dictionary in `hebrewTerms.ts`.
 * Answers are always verbatim passages with their citation, never generated text.
 */
import { HE_TERMS, LOW_WEIGHT } from './hebrewTerms';

export interface Paper {
  id: string;
  file: string;
  short: string;
  year: number;
  title: string;
  topic: string;
  apa: string;
  doi: string;
  pageOffset: number;
  pdf: string;
}
export interface Chunk { p: number; pg: number; t: string }
export interface PapersData { papers: Paper[]; chunks: Chunk[] }

/** One idea in the question; its English terms are alternatives (synonyms/translations). */
export interface Concept { source: string; terms: string[]; words: string[]; weight: number }

export interface SearchHit {
  chunk: Chunk;
  paper: Paper;
  score: number;
  /** Journal page (what you'd cite) and PDF page (what the link opens). */
  page: number;
  pdfPage: number;
  href: string;
}
export interface SearchResult { hits: SearchHit[]; concepts: Concept[]; terms: Set<string> }

// ── English tokenizer ──────────────────────────────────────────────────────
const STOP = new Set(('a an and are as at be been being but by can could did do does for from had has have how if in into is it its ' +
  'may might more most no nor not of on or other our over such than that the their them then there these they this those ' +
  'through to under up was we were what when where which while who why will with within would also both each between ' +
  'during after before about than very however only same so some any all however thus i you your he she his her us off ' +
  'et al eg ie fig figure table per two one three').split(' '));

/** Light suffix stemmer: enough to match rain/rains/raining, survive/survival, contaminated/contamination. */
export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  else if (s.endsWith('ly') && s.length > 5) s = s.slice(0, -2);
  if (s.endsWith('al') && s.length > 6) s = s.slice(0, -2);
  else if (s.endsWith('ia') && s.length > 6) s = s.slice(0, -1);
  if (s.endsWith('tion') && s.length > 6) s = s.slice(0, -3);
  else if (s.endsWith('ity') && s.length > 6) s = s.slice(0, -3);
  if (s.endsWith('e') && s.length > 4) s = s.slice(0, -1);
  if (/([b-df-hj-np-tv-z])\1$/.test(s) && !/(ll|ss|zz)$/.test(s)) s = s.slice(0, -1);
  return s;
}

/** Unifies spellings so "E. coli", "Escherichia coli", "faecal" match their usual forms. */
function normalizeEnglish(text: string): string {
  return text
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(?:escherichia\s*(?:\(e\.\)\s*)?|e\.\s?)coli\b/g, ' ecoli ')
    .replace(/\bfaec/g, 'fec')
    .replace(/\bhalf-life\b/g, 'halflife')
    .replace(/\bdie-off\b/g, 'dieoff')
    .replace(/\brun-off\b/g, 'runoff');
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of normalizeEnglish(text).split(/[^a-z0-9]+/)) {
    if (!raw || raw.length < 2 || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

// ── Hebrew → English ───────────────────────────────────────────────────────
const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
/** Hebrew without niqqud/geresh and with final letters made regular, so "גשם" and "גשמים" share a root. */
export const normHe = (s: string) => s.replace(/[֑-ׇ׳״'"]/g, '').replace(/[ךםןףץ]/g, (c) => FINALS[c]);
const PREFIXES = new Set(['ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ']);
const HE_DICT = new Map(Object.entries(HE_TERMS).map(([k, v]) => [normHe(k), { key: k, en: v }]));
const isHebrew = (s: string) => /[א-ת]/.test(s);

/** Candidate base forms of a Hebrew word: as typed, then with up to 3 prefix letters removed, then without a plural/feminine ending. */
function heForms(word: string): string[] {
  const forms: string[] = [];
  let w = word;
  for (let i = 0; i <= 3 && w.length >= 2; i++) {
    forms.push(w);
    if (!PREFIXES.has(w[0]) || w.length < 4) break;
    w = w.slice(1);
  }
  const withSuffix = [...forms];
  for (const f of withSuffix) {
    for (const suf of ['ימ', 'ות', 'ה', 'ת', 'י']) if (f.endsWith(suf) && f.length - suf.length >= 2) forms.push(f.slice(0, -suf.length));
  }
  return forms;
}

function lookupHe(words: string[]) {
  // Longest phrase first (e.g. "מי שתייה", "אי קולי"); only the first word may carry prefixes.
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const rest = words.slice(1, n).join(' ');
    for (const f of heForms(words[0])) {
      const hit = HE_DICT.get(n > 1 ? `${f} ${rest}` : f);
      if (hit) return { n, ...hit };
    }
  }
  return null;
}

/** Turns a question (Hebrew, English or mixed) into weighted concepts of stemmed English terms. */
export function expandQuery(query: string): Concept[] {
  const concepts: Concept[] = [];
  const add = (source: string, words: string[], weight: number) => {
    const terms = [...new Set(words.flatMap(tokenize))];
    if (!terms.length) return;
    const same = concepts.find((c) => c.terms.join() === terms.join());
    if (same) { same.weight = Math.max(same.weight, weight); return; }
    concepts.push({ source, terms, words, weight });
  };

  const q = query.replace(/\b(?:escherichia|e)\.?\s?coli\b/gi, ' ecoli ');
  const tokens = q.split(/[\s\-־–—,;:!?()[\]{}״"/\\.]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (isHebrew(tok)) {
      const heWords = tokens.slice(i, i + 3).filter(isHebrew).map(normHe);
      const hit = lookupHe(heWords);
      if (hit) {
        add(hit.key, hit.en, LOW_WEIGHT.has(hit.key) ? 0.3 : 1);
        i += hit.n - 1;
      }
    } else if (/[a-z]/i.test(tok)) {
      add(tok, [tok], 1);
    }
  }
  return concepts;
}

// ── BM25 ───────────────────────────────────────────────────────────────────
export interface PapersIndex {
  data: PapersData;
  tf: Map<string, number>[];
  len: number[];
  avgLen: number;
  df: Map<string, number>;
}

export function buildIndex(data: PapersData): PapersIndex {
  const df = new Map<string, number>();
  const tf = data.chunks.map((c) => {
    const m = new Map<string, number>();
    for (const t of tokenize(c.t)) m.set(t, (m.get(t) || 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
    return m;
  });
  const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  return { data, tf, len, avgLen: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length), df };
}

const K1 = 1.2;
const B = 0.75;

/**
 * Score = Σ over concepts of weight × (best term + ¼ of the other terms), so one idea with many
 * synonyms can't drown out another; then scaled by how many of the concepts the passage covers.
 */
export function search(index: PapersIndex, query: string, { limit = 5, perPaper = 2 } = {}): SearchResult {
  const concepts = expandQuery(query);
  const terms = new Set(concepts.flatMap((c) => c.terms));
  if (!concepts.length) return { hits: [], concepts, terms };
  const N = index.data.chunks.length;
  const idf = (t: string) => {
    const n = index.df.get(t) || 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };
  const totalWeight = concepts.reduce((a, c) => a + c.weight, 0);

  const scored: { i: number; score: number }[] = [];
  index.tf.forEach((tf, i) => {
    let score = 0;
    let covered = 0;
    const norm = K1 * (1 - B + (B * index.len[i]) / index.avgLen);
    for (const c of concepts) {
      const parts = c.terms.map((t) => {
        const f = tf.get(t) || 0;
        return f ? (idf(t) * f * (K1 + 1)) / (f + norm) : 0;
      }).sort((a, b) => b - a);
      if (!parts[0]) continue;
      covered += c.weight;
      score += c.weight * (parts[0] + 0.25 * parts.slice(1).reduce((a, b) => a + b, 0));
    }
    if (score > 0) scored.push({ i, score: score * (0.5 + 0.5 * (covered / totalWeight)) });
  });
  scored.sort((a, b) => b.score - a.score);

  const hits: SearchHit[] = [];
  const perPaperCount = new Map<number, number>();
  const top = scored[0]?.score ?? 0;
  for (const { i, score } of scored) {
    if (hits.length >= limit || score < top * 0.3) break;
    const chunk = index.data.chunks[i];
    const used = perPaperCount.get(chunk.p) || 0;
    if (used >= perPaper) continue;
    perPaperCount.set(chunk.p, used + 1);
    const paper = index.data.papers[chunk.p];
    hits.push({ chunk, paper, score, page: chunk.pg + paper.pageOffset, pdfPage: chunk.pg, href: `${paper.pdf}#page=${chunk.pg}` });
  }
  return { hits, concepts, terms };
}

/** Splits a passage into plain and matched pieces, for highlighting the query terms. */
export function highlight(text: string, terms: Set<string>): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  const re = /(?:Escherichia\s*(?:\(E\.\)\s*)?|E\.\s?)coli|[A-Za-z][A-Za-z-]*[A-Za-z]|[A-Za-z]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const toks = tokenize(m[0]);
    const hit = toks.length > 0 && toks.some((t) => terms.has(t));
    if (!hit) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
