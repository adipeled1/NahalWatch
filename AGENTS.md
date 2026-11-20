# NahalWatch — Agent Instructions

NahalWatch ("אקולוגיה בכף היד") is a public, no-login, news-style PWA that answers
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
- `npm run dev` · `npm run build` · `npm run lint` · `npm test`
- `npm run verify` — lint + tests + build

## Conventions
- All swim-safety thresholds live in `RULES` in `src/lib/quality.ts`; change them there only.
  A red/yellow status must always list the parameter, measured value and the threshold
  it crossed (`Finding.verdict`) — never color alone.
- Colors come from the CSS tokens in `src/app/globals.css` (light + dark), used through
  the semantic Tailwind names (`bg-surface`, `text-danger`, …). No raw hex in components.
- Station coordinates are hand-placed approximations in `data/station-coords.json`
  (the source has no GPS). Keys are `stream|station name` exactly as in the Excel.
- `src/lib/*` must stay importable from server components: no `'use client'` there.
- Leaflet must only load via `next/dynamic({ ssr: false })` (see `MapScreen.tsx`).
- Mobile grids use `grid-cols-1` so wide children can't push the page past the viewport.
- Allowed external hosts are listed in the CSP in `next.config.mjs`; add new ones there.
