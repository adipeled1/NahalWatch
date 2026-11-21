# NahalWatch — `nahalwatch-app`

This is the Next.js application (PWA) for NahalWatch.

For the project overview, data sources and the official traffic-light rules, see the repository root:

- [`../README.md`](../README.md) — project overview, team, data sources, structure
- [`../documentation/`](../documentation/) — poster, poster plan, station-locations sheet

```bash
npm install
npm run dev        # http://localhost:3000
npm run data       # rebuild public/data from data/raw/*.xlsx (+ ../documentation/station-locations.xlsx)
npm run verify     # lint + tests + build
```
