# 💧 NahalWatch — Is the Stream Safe Today?

**🚀 Live Demo:** *coming soon (Vercel)* · installable on any phone as a web app ([PWA](#-what-is-a-pwa))

> **This is a student academic project.** The traffic light is computed from the latest sample in an official
> dataset and does not replace current notices from the Ministry of Health or the Nature and Parks Authority.
> On-site "no bathing" signs always take precedence.

<p align="center">
  <img src="documentation/poster/assets/phone-map.png" width="230" alt="Traffic-light map of the Upper Jordan sources by Kfar Blum and Amir" />
  &nbsp;
  <img src="documentation/poster/assets/phone-station.png" width="230" alt="Station page with the official limits that were crossed" />
  &nbsp;
  <img src="documentation/poster/assets/phone-updates.png" width="230" alt="Updates feed of the latest samples" />
</p>

---

## 📋 Overview

NahalWatch is a public, no-login web app that answers one question for hikers and families in Israel:
**can I go into the water at this stream today?**

It turns **6,545 field and lab samples from 214 monitoring stations (1995–2025)**, published by the Ministry of
Environmental Protection, into a green / amber / red map. Every color follows **official Israeli limits**, and every
warning spells out which parameter crossed which limit, for example
*"Fecal coliforms: 950 cfu/100 ml, above the 400 limit (Ministry of Health)"*.

---

## ✨ Features

- **🗺️ Traffic-Light Map** — Every station on a map of Israel, opening on the Upper Jordan sources by Kfar Blum and Amir, where the Snir, Dan and Hermon meet. Filter by region and status; shareable links (`/?station=<id>`).
- **🚦 Official Limits Only** — Colors come from the Ministry of Health bathing limit for streams and the Inbar regulations (2010). Parameters without an official limit are shown but never change the color.
- **🔎 "Why is it red?"** — Each amber or red card lists every exceeded parameter, its measured value, the limit, and its source.
- **📍 Station Pages** — The latest values, a history chart with the limits drawn in, a full lab table, official ITM / GPS coordinates where available, and navigation with Waze.
- **📈 Ecological Models** — A 3-day bacteria forecast (logistic growth), a Lotka–Volterra bacteria/grazer simulator, monthly seasonality, and a "model vs. field" backtest.
- **🔎 Ask the Papers (RAG)** — A chat that answers research questions from five open-access papers. Search runs in the browser (BM25, Hebrew or English) and always shows the exact quotes with page, PDF link and APA citation. If the server has a Gemini key, it also writes a short answer from those quotes only; without a key it shows the quotes alone.
- **📰 Updates Feed** — The latest samples from all stations as a news feed, with a regional status ring.
- **📱 Installable & Offline** — "Add to Home Screen" on iPhone and Android, full-screen, and keeps working with weak reception.

---

## 📱 What Is a PWA?

A **Progressive Web App (PWA)** is a website that behaves like a phone app. NahalWatch is one:

- **Home-screen icon** — install it straight from the browser, with no App Store or Google Play:
  - **iPhone (Safari):** Share → *Add to Home Screen*
  - **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*
- **Full screen** — opens without the address bar, like a native app.
- **Works with weak or no reception** — pages and data you have already viewed are cached on the phone.
- **Always up to date** — every new deployment reaches all users immediately; there is nothing to update.

Three pieces make it a PWA:

| Piece | What it does | In this repo |
|---|---|---|
| Web app manifest | App name, icons, colors, full-screen mode | [`src/app/manifest.ts`](nahalwatch-app/src/app/manifest.ts) |
| Service worker | Caches pages, data and map tiles for offline use | [`public/sw.js`](nahalwatch-app/public/sw.js) |
| HTTPS | Required by browsers to install the app | provided by the host (Vercel) |

---

## 🚦 How the Traffic Light Works

| Color | When |
|---|---|
| 🟢 **Green** | Every measured parameter is within the official limits |
| 🟡 **Amber** | Fecal coliforms 200–400 /100 ml, **or** a parameter above the Inbar *monthly-average* value |
| 🔴 **Red** | Fecal coliforms above 400 /100 ml, **or** a parameter above the Inbar *maximum* value, **or** dissolved oxygen below 3 mg/l / pH outside 7–8.5 |

**Sources**
1. Ministry of Health, Environmental Health Department — *2024 Activity Report, Water Quality* (May 2025): streams with public water contact, up to 400 fecal coliforms per 100 ml.
2. Ministry of Health, Chief Engineer's guidelines (10 March 2010) — seasonal geometric mean up to 200, maximum 400.
3. *Public Health Regulations (Effluent Quality Standards and Rules for Sewage Treatment), 2010* ("Inbar regulations"), First Schedule — quality required for discharge to streams.

All limits live in one place: [`nahalwatch-app/src/lib/quality.ts`](nahalwatch-app/src/lib/quality.ts).

---

## 🗄️ Data Sources

| Data | Source (data.gov.il) | Updated |
|---|---|---|
| Stream samples | Ministry of Environmental Protection — *Raw stream monitoring results 1996–2025* (`stream-monitoring`) | Sampled twice a year (spring and autumn) |
| Official station coordinates | Water Authority — *List of hydrometric stations* (`hydro_station`), ITM grid | Rarely changes |

46 stations are placed at the matching Water Authority station (same bridge or spring), and the rest are
estimated from the station name. The full name ↔ coordinate table is in
[`documentation/station-locations.xlsx`](documentation/station-locations.xlsx).

---

## 🗂️ Repository Structure

```
NahalWatch/
├── README.md                        ← you are here (overview)
├── documentation/
└── nahalwatch-app/                  ← Next.js application (PWA)
    ├── data/
    │   ├── raw/                     — the official monitoring spreadsheet
    │   ├── official/                — Water Authority station list (ITM)
    │   └── station-coords*.json     — official and estimated station locations
    ├── scripts/                     — data pipeline (Excel → JSON) and icon generator
    ├── public/
    │   ├── data/                    — generated station index + per-station history
    │   └── sw.js                    — service worker (offline)
    └── src/
        ├── app/                     — pages: map, updates, streams, station, models, about
        ├── components/              — Map, Station, Updates, Streams, Models, Shell, ui
        └── lib/                     — traffic-light rules, ecological models, data access
```

---

## 🛠️ Tech Stack

- **Next.js** (App Router) + React + TypeScript + **Tailwind CSS**
- **Leaflet** + **OpenStreetMap** — interactive map (Esri imagery for the satellite layer)
- **Recharts** — history, seasonality and model charts
- **SheetJS (`xlsx`)** — spreadsheet import and the locations sheet
- **Vitest** — unit tests for the traffic-light rules and the models
- **Vercel** — deployment *(planned)*

No accounts: the data is pre-built into static JSON, so pages load fast and work offline. The only server code is the optional `/api/ask` route that writes answers in "Ask the papers".

---

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   cd nahalwatch-app
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

3. **Update the data** when a new version is published on data.gov.il: replace the file in
   `nahalwatch-app/data/raw/` and run:
   ```bash
   npm run data
   ```

4. **Written answers in "Ask the papers"** (optional): copy `nahalwatch-app/.env.example` to `.env.local` and set
   `GEMINI_API_KEY` (a free key from Google AI Studio). On Vercel, add it under Project → Settings → Environment Variables
   and redeploy (the choice is made at build time). The key stays on the server. Without it the chat shows the retrieved
   quotes only and never calls the server; with a bad key or a Gemini error it falls back to quotes only.

5. **Check everything** (lint + tests + production build):
   ```bash
   npm run verify
   ```

To rebuild the poster from the repository root, run `python documentation/poster/build_poster.py`.

---

## 👥 Contributors

- [ororbach](https://github.com/ororbach) — Or Orbach
- [adipeled1](https://github.com/adipeled1) — Adi Peled
- [shakedm341-lang](https://github.com/shakedm341-lang) — Shaked Malul

---

## 🎓 Project Context

| | |
|---|---|
| Institution | Braude College of Engineering, Karmiel, Israel |
| Advisor | Dr. Naomi Unkelos-Shpigel |
| Data | Ministry of Environmental Protection; Water Authority (data.gov.il) |
