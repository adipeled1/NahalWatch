// Builds the "ask the papers" index: extracts the text of the PDFs in public/papers/
// page by page (needs `pdftotext` from poppler-utils), cleans it (running headers,
// hyphenation, tables, figure captions, reference lists) and splits it into short
// passages of 2–4 sentences that keep their page number.
//   public/data/papers.json — paper metadata (APA etc.) + passages
// Run with `npm run papers` when a PDF is added or replaced. Output is committed, so
// the app (and Vercel) never needs pdftotext: search runs in the browser (BM25).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF_DIR = path.join(ROOT, 'public', 'papers');
const OUT = path.join(ROOT, 'public', 'data', 'papers.json');

// APA citations as given by Google Scholar. `pageOffset` turns a PDF page into the
// journal page (Kistemann et al. is printed as pp. 2188–2197).
const PAPERS = [
  {
    id: 'dadon2018',
    file: '01_Dadon_2018_Leptospirosis_Northern_Israel.pdf',
    short: 'Dadon et al.',
    year: 2018,
    title: 'Outbreak of human leptospirosis linked to contaminated water bodies in Northern Israel, June to August 2018',
    topic: 'התפרצות עכברת אחרי רחצה בנחלים ובבריכות בצפון, 2018',
    apa: 'Dadon, Y., Haas, E. J., Kaliner, E., Anis, E., Singer, S. R., Atiya-Nasagi, Y., ... & Moran-Gilad, J. (2018). Outbreak of human leptospirosis linked to contaminated water bodies in Northern Israel, June to August 2018. Eurosurveillance, 23(38), 1800486.',
    doi: '10.2807/1560-7917.ES.2018.23.38.1800486',
    pageOffset: 0,
  },
  {
    id: 'kistemann2002',
    file: '02_Kistemann_2002_Microbial_load_rainfall_runoff.pdf',
    short: 'Kistemann et al.',
    year: 2002,
    title: 'Microbial load of drinking water reservoir tributaries during extreme rainfall and runoff',
    topic: 'עומס חיידקים בנחלים בזמן גשם קיצוני ונגר',
    apa: 'Kistemann, T., Claßen, T., Koch, C., Dangendorf, F., Fischeder, R., Gebel, J., ... & Exner, M. (2002). Microbial load of drinking water reservoir tributaries during extreme rainfall and runoff. Applied and environmental microbiology, 68(5), 2188-2197.',
    doi: '10.1128/AEM.68.5.2188-2197.2002',
    pageOffset: 2187,
  },
  {
    id: 'tornevi2014',
    file: '03_Tornevi_2014_Precipitation_microbial_pollution_river.pdf',
    short: 'Tornevi et al.',
    year: 2014,
    title: 'Precipitation effects on microbial pollution in a river: lag structures and seasonal effect modification',
    topic: 'השפעת משקעים על זיהום מיקרוביאלי בנהר, לפי ימים ועונות',
    apa: 'Tornevi, A., Bergstedt, O., & Forsberg, B. (2014). Precipitation effects on microbial pollution in a river: lag structures and seasonal effect modification. PloS one, 9(5), e98546.',
    doi: '10.1371/journal.pone.0098546',
    pageOffset: 0,
  },
  {
    id: 'rochellenewall2015',
    file: '04_RochelleNewall_2015_Fecal_indicator_bacteria_review.pdf',
    short: 'Rochelle-Newall et al.',
    year: 2015,
    title: 'A short review of fecal indicator bacteria in tropical aquatic ecosystems: knowledge gaps and future directions',
    topic: 'סקירה: חיידקים מדדי זיהום צואתי במים טרופיים',
    apa: 'Rochelle-Newall, E., Nguyen, T. M. H., Le, T. P. Q., Sengtaheuanghoung, O., & Ribolzi, O. (2015). A short review of fecal indicator bacteria in tropical aquatic ecosystems: knowledge gaps and future directions. Frontiers in microbiology, 6, 308.',
    doi: '10.3389/fmicb.2015.00308',
    pageOffset: 0,
  },
  {
    id: 'petersen2020',
    file: '05_Petersen_Hubbart_2020_Ecoli_survival_secondary_habitats.pdf',
    short: 'Petersen & Hubbart',
    year: 2020,
    title: 'Physical factors impacting the survival and occurrence of Escherichia coli in secondary habitats',
    topic: 'גורמים פיזיקליים לשרידות E. coli בסביבה (טמפרטורה, שמש, סדימנט)',
    apa: 'Petersen, F., & Hubbart, J. A. (2020). Physical factors impacting the survival and occurrence of Escherichia coli in secondary habitats. Water, 12(6), 1796.',
    doi: '10.3390/w12061796',
    pageOffset: 0,
  },
];

// ── Text cleanup ─────────────────────────────────────────────────────────────
// Glyphs some publishers' fonts map to odd code points.
const GLYPHS = { '◦': '°', '⫻': '×', '⫽': '=', '␣': 'α', '⬍': '<', '⬎': '>', '⫹': '+', '⬘': '′', '−': '-', '∗': '*' };
const fixGlyphs = (s) => s
  .normalize('NFKC')
  .replace(/[◦⫻⫽␣⬍⬎⫹⬘−∗]/g, (c) => GLYPHS[c])
  .replace(/(\d)\s?uC\b/g, '$1 °C') // PLOS font: "35uC" is 35 °C
  .replace(/\bof \.(\d+ mm)/g, 'of >$1') // PLOS font: ".15 mm" is ">15 mm"
  .replace(/[ \t]+/g, ' ');

const META_RE = /(@|https?:\/\/|www\.|\bdoi\b|copyright|©|creative commons|licensee|open[- ]access|citation:|citation style|correspondence|received:|accepted:|published:|editor:|edited by|reviewed by|specialty section|competing interests|this article was submitted|article submitted on|funding:)/i;
// Figure/table captions ("FIGURE 1 |", "Fig. 2.", "TABLE 1.") are dropped; in-text "Figure S1 shows" is kept.
const CAPTION_RE = /^(fig(ure)?\.?|table|box)\s*([A-Z]?\d+[a-z]?\s*[.|:]|([A-Z]?\d+[a-z]?|[a-z])?$)/i;
const STOP_HEADINGS = /^(references|literature cited|acknowledge?ments?|author contributions?|funding|conflicts? of interest|supporting information)\b/i;
// "e.g." etc. never end a sentence; a single capital ("A.") is an initial.
const ABBREV = /(?:\b(?:e\.g|i\.e|et al|al|fig|figs|eq|vs|approx|ca|cf|resp|no|spp|sp|var|ref|refs|vol|pp|p|incl|min|max|tab|st|dr|mr|ms)\.|\b[A-Z]\.)$/i;
const SENT_END = /[.!?]["”’)\]]?$/;

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

/** Prose, not a table row or an author list: mostly ordinary (mostly lowercase) words. */
function looksLikeProse(text) {
  const toks = text.split(/\s+/).filter(Boolean);
  if (toks.length < 10) return false;
  const words = toks.filter((t) => /^[(“"‘'[]?[A-Za-z][a-z’'-]+[)”"’',.;:\]]*$/.test(t)).length;
  const lower = toks.filter((t) => /^[(“"‘'[]?[a-z][a-z’'-]*[)”"’',.;:\]]*$/.test(t)).length;
  return words / toks.length >= 0.6 && lower / toks.length >= 0.45;
}

/** Drops equation fragments and supplementary-file captions ("(TIFF) Figure S2 …"). */
function sentenceOk(text) {
  if (/^\((tiff?|docx?|xlsx?|pdf)\)/i.test(text)) return false;
  const toks = text.split(/\s+/).filter(Boolean);
  if (toks.length < 6) return true;
  if (toks.length > 12 && new Set(toks).size / toks.length < 0.6) return false; // axis labels ("Jun Jun Jun …")
  return toks.filter((t) => /^[(“"‘'[]?[A-Za-z][a-z’'-]+[)”"’',.;:\]]*$/.test(t)).length / toks.length >= 0.5;
}

// `-raw` keeps the publisher's reading order, so two-column pages come out column by column.
function extractPages(file) {
  const raw = execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const pages = raw.split('\f').map((p) => fixGlyphs(p).split('\n').map((l) => l.trim()).filter(Boolean));
  while (pages.length && !pages.at(-1).length) pages.pop();
  return pages;
}

function paperChunks(paper) {
  const pages = extractPages(path.join(PDF_DIR, paper.file));
  const ownTitle = paper.title.toLowerCase().slice(0, 40); // the paper citing itself (front matter)
  // Running headers/footers: short lines that repeat on 3+ pages (ignoring page numbers).
  const key = (l) => l.replace(/\d+/g, '#');
  const seen = new Map();
  pages.forEach((lines) => new Set(lines.filter((l) => l.length < 90).map(key)).forEach((k) => seen.set(k, (seen.get(k) || 0) + 1)));
  const isNoise = (l) => (l.length < 90 && (seen.get(key(l)) || 0) >= 3) || /^\d{1,4}$/.test(l) || /^\d+ of \d+$/.test(l) ||
    /\|\s*(www\.|volume|article)/i.test(l) || /^(vol\.|volume)\s*\d+/i.test(l) || /^page \d+/i.test(l);

  // 1. Lines → paragraphs (with the page of every piece). A paragraph ends at a short line that
  //    closes a sentence; headings (short, unpunctuated, after a sentence end) are dropped.
  //    A caption interrupts the paragraph around it; that paragraph resumes after the caption.
  const paras = [];
  let cur = null;
  let suspended = null;
  const close = () => {
    if (cur) paras.push(cur);
    cur = suspended;
    suspended = null;
  };
  outer: for (let i = 0; i < pages.length; i++) {
    const lines = pages[i].filter((l) => !isNoise(l));
    const lens = lines.map((l) => l.length).sort((a, b) => a - b);
    const typical = lens[Math.floor(lens.length * 0.75)] || 80;
    for (const l of lines) {
      if (i >= pages.length / 2 && STOP_HEADINGS.test(l)) break outer; // back matter
      if (CAPTION_RE.test(l)) {
        if (cur?.caption) close();
        suspended = cur && !SENT_END.test(cur.text) ? cur : (cur && paras.push(cur), null);
        // "Table b" alone: the caption is that label plus one title line. "Figure 1. …": up to its full stop.
        const labelOnly = wordCount(l) <= 2;
        cur = { text: l, caption: true, titleLines: labelOnly ? 1 : Infinity, parts: [{ at: 0, page: i + 1 }] };
        if (!labelOnly && SENT_END.test(l) && wordCount(l) > 3) close();
        continue;
      }
      if (cur?.caption) {
        cur.text += ' ' + l;
        if (--cur.titleLines <= 0 || SENT_END.test(l)) close();
        continue;
      }
      const atBoundary = !cur || SENT_END.test(cur.text) || /:$/.test(cur.text);
      if (atBoundary && wordCount(l) <= 6 && !/[.,;:]$/.test(l) && /^[A-Z0-9]/.test(l)) { if (cur) { paras.push(cur); cur = null; } continue; }
      if (!cur) cur = { text: '', parts: [{ at: 0, page: i + 1 }] };
      else if (cur.parts.at(-1).page !== i + 1) cur.parts.push({ at: cur.text.length + 1, page: i + 1 });
      if (!cur.text) cur.text = l;
      else if (/[A-Za-z]-$/.test(cur.text) && /^[a-z]/.test(l)) cur.text = cur.text.slice(0, -1) + l; // de-hyphenate
      else cur.text += ' ' + l;
      if (SENT_END.test(l) && l.length < typical * 0.8) close();
    }
  }
  close();

  // 2. Sentences → passages of 2–4 sentences (~45–120 words), prose only.
  const chunks = [];
  for (const para of paras) {
    if (para.caption) continue;
    const text = para.text.replace(/\s+/g, ' ').trim();
    const sents = [];
    let start = 0;
    const re = /[.!?]["”’)\]]?\s+(?=[A-Z(“"[])/g;
    let m;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      if (ABBREV.test(text.slice(start, m.index + 1))) continue;
      sents.push({ text: text.slice(start, end).trim(), at: start });
      start = end;
    }
    if (start < text.length) sents.push({ text: text.slice(start).trim(), at: start });
    const pageAt = (at) => para.parts.filter((p) => p.at <= at).at(-1).page;

    const groups = [];
    let g = [];
    for (const s of sents) {
      if (wordCount(s.text) < 3 || META_RE.test(s.text) || !sentenceOk(s.text) || s.text.toLowerCase().includes(ownTitle)) { if (g.length) groups.push(g); g = []; continue; }
      g.push(s);
      const words = wordCount(g.map((x) => x.text).join(' '));
      if (g.length >= 4 || (g.length >= 2 && words >= 55) || words >= 110) { groups.push(g); g = []; }
    }
    // A short tail joins the previous passage when they are contiguous.
    if (g.length) {
      const prev = groups.at(-1);
      const tailWords = wordCount(g.map((x) => x.text).join(' '));
      if (prev && tailWords < 30 && wordCount(prev.map((x) => x.text).join(' ')) + tailWords <= 140 &&
        sents.indexOf(prev.at(-1)) + 1 === sents.indexOf(g[0])) prev.push(...g);
      else groups.push(g);
    }
    for (const grp of groups) {
      let t = grp.map((s) => s.text).join(' ').replace(/^[a-z] (?=[A-Z])/, ''); // stray footnote mark
      const words = wordCount(t);
      if (words < 14 || words > 170 || !looksLikeProse(t)) continue;
      // Starts mid-sentence: lowercase, or a ")" closing something we never saw.
      const firstClose = t.indexOf(')');
      if (/^[a-z]/.test(t) || /^\([^)]*\) [a-z]/.test(t) || (firstClose >= 0 && firstClose < 80 && !t.slice(0, firstClose).includes('('))) t = '…' + t;
      if (!SENT_END.test(t)) t += '…';
      chunks.push({ pg: pageAt(grp[0].at), t });
    }
  }
  return chunks;
}

const out = { papers: [], chunks: [] };
PAPERS.forEach((paper, idx) => {
  const chunks = paperChunks(paper);
  out.papers.push({ ...paper, pdf: `/papers/${paper.file}` });
  for (const c of chunks) out.chunks.push({ p: idx, pg: c.pg, t: c.t });
  console.log(`${paper.short} ${paper.year}: ${chunks.length} passages`);
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`Wrote ${out.chunks.length} passages → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
