# NahalWatch — `nahalwatch-app`

This is the Next.js application (PWA) for NahalWatch.

For the project overview, data sources and the official traffic-light rules, see the repository root:

- [`../README.md`](../README.md) — project overview, team, data sources, structure
- [`../documentation/`](../documentation/) — poster, poster plan, station-locations sheet

```bash
npm install
npm run dev        # http://localhost:3000
npm run data       # rebuild public/data from data/raw/*.xlsx (+ ../documentation/station-locations.xlsx)
npm run papers     # rebuild public/data/papers.json from public/papers/*.pdf (needs pdftotext)
npm run verify     # lint + tests + build
```

## Ask the papers

The round button on every page opens a small chat that answers a question (Hebrew or English)
with **verbatim quotes** from the five open-access papers in `public/papers/`, each with its APA
citation, page and a link to that PDF page. There is no language model and no API key: the
passages are indexed at build time (`npm run papers`) and ranked with BM25 in the browser
(`src/lib/papers.ts`). Hebrew questions are mapped to English domain terms with the dictionary in
`src/lib/hebrewTerms.ts`; add words there when a question finds nothing.
