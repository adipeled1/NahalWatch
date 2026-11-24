# NahalWatch — Agent Instructions

This folder (`nahalwatch-app/`) is the Next.js app. Project docs, the poster and the station-locations
sheet live in `../documentation/`; the project overview is `../README.md`.

NahalWatch is a public, no-login, news-style PWA that answers
"is this stream safe to swim in today?" for Israeli streams, using ~30 years of
monitoring samples (data/raw/*.xlsx) plus ecological models (logistic growth,
Lotka–Volterra). Hebrew, RTL, mobile-first; installable to the home screen.

## Stack
- Next.js (App Router) + React, TypeScript, Tailwind CSS v4
- Leaflet / react-leaflet (OpenStreetMap + Esri imagery tiles), Recharts, lucide-react
- No backend: data is static JSON in `public/data/`, user state in localStorage

## Commands
- `npm run data` — rebuild `public/data/*` from the spreadsheet in `data/raw/`
- `npm run icons` — regenerate PWA / iOS icons
- `npm run papers` — rebuild `public/data/papers.json` (passages + APA) from `public/papers/*.pdf` (needs `pdftotext`)
- `npm run dev` · `npm run build` · `npm run lint` · `npm test`
- `npm run verify` — lint + tests + build

## Conventions
- Show only information that comes from the spreadsheet (or is computed from it). Do not invent
  data the Excel lacks (e.g. shade, parking, stroller access, drive times). If it's missing, leave it out.
- There are no hiker field reports, favorites or accounts. These were dropped on purpose.
- The station page is a single view (no simple/expert toggle): answer → forecast → latest values
  → history chart → full table.
- Traffic-light limits come ONLY from official sources (Ministry of Health for fecal coliforms,
  Inbar regulations 2010 for the rest) and live in `RULES` in `src/lib/quality.ts`. Never invent
  a threshold. A red/amber status must list every parameter, value and limit crossed.
- Official station coordinates: `data/station-coords-official.json` (hand-reviewed matches to the
  Water Authority list in `data/official/`); everything else is an estimate in `data/station-coords.json`.
- `npm run data` also writes `../documentation/station-locations.xlsx`.
- Poster (repo root): `python documentation/poster/build_poster.py` rebuilds
  `documentation/poster/NahalWatch_poster.pptx` from `template-ICSA.pptx`, the screenshots in
  `documentation/poster/assets/`, and the data. Keep every shape's
  width/height positive (PowerPoint rejects the file otherwise).
- Colors come from the CSS tokens in `src/app/globals.css` (light + dark), used through
  the semantic Tailwind names (`bg-surface`, `text-danger`, …). No raw hex in components.
- Station coordinates are hand-placed approximations in `data/station-coords.json`
  (the source has no GPS). Keys are `stream|station name` exactly as in the Excel.
- `src/lib/*` must stay importable from server components: no `'use client'` there.
- Leaflet must only load via `next/dynamic({ ssr: false })` (see `MapScreen.tsx`).
- Mobile grids use `grid-cols-1` so wide children can't push the page past the viewport.
- Allowed external hosts are listed in the CSP in `next.config.mjs`; add new ones there.
- "Ask the papers" (`src/components/PapersChat/`, `src/lib/papers.ts`): retrieval (BM25) runs in the browser
  and always shows verbatim passages from the PDFs with APA citation + page. Generation is optional:
  `src/app/api/ask/route.ts` + `src/lib/answer.ts` call Gemini only when `GEMINI_API_KEY` is set (server-side
  env var, optional `GEMINI_MODEL`), using the server's own copy of the passages the client found.
  Whether a key exists is decided at build time in `layout.tsx` (`canWriteAnswers`, a boolean only), so with
  no key the chat never calls the server; on any Gemini error the reply is `{ mode: 'quotes' }`.
  Paper metadata (APA) lives in `scripts/build-papers.mjs`; Hebrew → English terms in `src/lib/hebrewTerms.ts`.
