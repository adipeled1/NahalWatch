import { describe, expect, it } from 'vitest';
import data from '../../public/data/papers.json';
import { buildIndex, expandQuery, highlight, normHe, search, stem, tokenize, type PapersData } from './papers';

const index = buildIndex(data as PapersData);
const firstPaper = (q: string) => search(index, q).hits[0]?.paper.id;
const termsOf = (q: string) => expandQuery(q).flatMap((c) => c.terms);

describe('tokenize', () => {
  it('lowercases, drops stopwords and numbers, and stems', () => {
    expect(tokenize('The Rains were raining on 3 rivers')).toEqual(['rain', 'rain', 'river']);
  });

  it('matches word families through the stemmer', () => {
    expect(stem('contaminated')).toBe(stem('contamination'));
    expect(stem('survival')).toBe(stem('survive'));
    expect(stem('bacterial')).toBe(stem('bacteria'));
    expect(stem('temperatures')).toBe(stem('temperature'));
    expect(stem('turbidity')).toBe(stem('turbid'));
    expect(stem('seasonal')).toBe(stem('season'));
  });

  it('treats every spelling of E. coli as one term and unifies faecal/fecal', () => {
    expect(tokenize('E. coli')).toEqual(['ecoli']);
    expect(tokenize('Escherichia coli')).toEqual(['ecoli']);
    expect(tokenize('Escherichia (E.) coli')).toEqual(['ecoli']);
    expect(tokenize('faecal')).toEqual(tokenize('fecal'));
  });
});

describe('Hebrew expansion', () => {
  it('normalizes final letters and niqqud', () => {
    expect(normHe('גֶּשֶׁם')).toBe('גשמ');
  });

  it('maps Hebrew domain words to English terms', () => {
    expect(termsOf('גשם')).toEqual(expect.arrayContaining(['rain', 'rainfall', stem('precipitation')]));
    expect(termsOf('עכירות')).toContain(stem('turbidity'));
    expect(termsOf('עכברת')).toContain(stem('leptospirosis'));
    expect(termsOf('אי-קולי')).toEqual(['ecoli']);
  });

  it('strips the prefixes ו ה ב ל מ ש כ', () => {
    expect(termsOf('בנחל')).toEqual(termsOf('נחל'));
    expect(termsOf('והטמפרטורה')).toEqual(termsOf('טמפרטורה'));
    expect(termsOf('מהגשם')).toEqual(termsOf('גשם'));
    expect(termsOf('לנחלים')).toContain('stream');
  });

  it('keeps words that start with a prefix letter whole when they are known (מים, שמש)', () => {
    expect(termsOf('מים')).toEqual(['water']);
    expect(termsOf('שמש')).toContain('sunlight');
  });

  it('matches multi-word terms and keeps English words typed in a Hebrew question', () => {
    expect(termsOf('מי שתייה')).toEqual(expect.arrayContaining(['drink', 'water']));
    expect(termsOf('מה משפיע על E. coli')).toContain('ecoli');
  });

  it('gives generic words ("משפיע") a lower weight than domain words', () => {
    const [effect, rain] = expandQuery('משפיע גשם');
    expect(effect.weight).toBeLessThan(rain.weight);
  });

  it('ignores words it does not know', () => {
    expect(expandQuery('איך מה האם')).toEqual([]);
  });
});

describe('BM25 search over the papers', () => {
  it('has passages from all five papers, each with a page', () => {
    const papers = new Set((data as PapersData).chunks.map((c) => c.p));
    expect(papers.size).toBe(5);
    expect((data as PapersData).chunks.every((c) => c.pg >= 1 && c.t.length > 40)).toBe(true);
  });

  it('ranks Tornevi or Kistemann first for rainfall questions', () => {
    expect(['tornevi2014', 'kistemann2002']).toContain(firstPaper('איך גשם משפיע על חיידקים צואתיים בנחל?'));
    expect(['tornevi2014', 'kistemann2002']).toContain(firstPaper('כמה ימים אחרי גשם איכות המים הכי גרועה?'));
    expect(['tornevi2014', 'kistemann2002']).toContain(firstPaper('rainfall and river water quality'));
  });

  it('ranks Dadon first for leptospirosis and bathing in Israel', () => {
    expect(firstPaper('עכברת')).toBe('dadon2018');
    expect(firstPaper('מה הסיכון ברחצה בנחלים מזוהמים בישראל?')).toBe('dadon2018');
    expect(firstPaper('leptospirosis outbreak')).toBe('dadon2018');
  });

  it('ranks Petersen & Hubbart first for E. coli die-off', () => {
    expect(firstPaper('מה משפיע על קצב הדעיכה של E. coli במים?')).toBe('petersen2020');
  });

  it('returns at most 5 hits, at most 2 per paper, best first, with a PDF page link', () => {
    const { hits } = search(index, 'איך טמפרטורה ואור שמש משפיעים על שרידות החיידקים?');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(5);
    const perPaper = new Map<string, number>();
    hits.forEach((h) => perPaper.set(h.paper.id, (perPaper.get(h.paper.id) || 0) + 1));
    expect(Math.max(...perPaper.values())).toBeLessThanOrEqual(2);
    expect(hits.map((h) => h.score)).toEqual([...hits.map((h) => h.score)].sort((a, b) => b - a));
    expect(hits[0].href).toMatch(/^\/papers\/.+\.pdf#page=\d+$/);
  });

  it('cites journal pages (Kistemann is printed as pp. 2188–2197)', () => {
    const hit = search(index, 'Wahnbach Nauholzbach Kall').hits.find((h) => h.paper.id === 'kistemann2002');
    expect(hit?.page).toBe(hit!.pdfPage + 2187);
  });

  it('returns nothing for a question with no known terms', () => {
    expect(search(index, 'שלום מה נשמע').hits).toEqual([]);
  });
});

describe('highlight', () => {
  it('marks words that match the query terms, including E. coli', () => {
    const parts = highlight('Rainfall increased E. coli in the river.', new Set(['rainfall', 'ecoli']));
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['Rainfall', 'E. coli']);
    expect(parts.map((p) => p.text).join('')).toBe('Rainfall increased E. coli in the river.');
  });
});
