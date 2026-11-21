// Converts the raw monitoring spreadsheet (data/raw/*.xlsx) into the static JSON
// the app serves from /public/data:
//   stations.json        — one entry per station: location, latest sample, monthly bacteria medians
//   series/<id>.json     — full sample history for one station (loaded on demand)
//   meta.json            — source + coverage summary
// Run with `npm run data` whenever the spreadsheet changes. Output is committed so
// the app needs no backend.
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const normKey = (k) => k.replace(/\s+/g, ' ').trim();
const COORDS = Object.fromEntries(
  Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'station-coords.json'), 'utf8')))
    .map(([k, v]) => [normKey(k), v]),
);
// Official coordinates (Water Authority hydrometric stations, matched by hand) override the estimates.
const OFFICIAL = Object.fromEntries(
  Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'station-coords-official.json'), 'utf8')))
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => [normKey(k), v]),
);

const xlsxFile = fs.readdirSync(RAW_DIR).find((f) => f.endsWith('.xlsx'));
if (!xlsxFile) throw new Error(`No .xlsx file in ${RAW_DIR}`);
const wb = XLSX.read(fs.readFileSync(path.join(RAW_DIR, xlsxFile)), { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
const header = rows[0].map((h) => (h == null ? '' : String(h).trim()));

const COL = {
  code: header.indexOf('קוד מקווה מים'),
  name: header.indexOf('שם תחנה'),
  stream: header.indexOf('נחל/קבוצה'),
  date: header.indexOf('תאריך'),
  lab: header.indexOf('מעבדה'),
  collector: header.indexOf('Collector'),
  color: header.indexOf('צבע שדה'),
  note: header.indexOf('Note'),
};
for (const [k, v] of Object.entries(COL)) if (v < 0) throw new Error(`Missing column for ${k}`);

// Every measurement column: key = header token before the unit, e.g. "Fcoli (cfu/100 ml)" -> "Fcoli".
const META_COLS = new Set(Object.values(COL));
const PARAM_COLS = header
  .map((h, i) => ({ i, key: h.split(' ')[0].replace(/[^A-Za-z0-9_]/g, '') }))
  .filter(({ i, key }) => !META_COLS.has(i) && key);

function parseDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)); // Excel serial
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    }
  }
  return null;
}
const isoDay = (d) => {
  // SheetJS dates can carry a historical-timezone offset of a few minutes/hours; snap to the nearest UTC day.
  const day = Math.round((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  return new Date(day * 86400000).toISOString().slice(0, 10);
};

/** Returns { value, qualifier } or null. "<0.2" -> {0.2,'<'}; "LOQ"/text -> null. */
function parseValue(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : null;
  const s = String(v).trim().replace(',', '.');
  const m = s.match(/^([<>])\s*(\d+(?:\.\d+)?)$/);
  if (m) return { value: Number(m[2]), qualifier: m[1] };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { value: Number(s) };
  return null;
}
const clean = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

// ── Group rows by (stream, station name): codes in the sheet are not unique per site.
const groups = new Map();
let skipped = 0;
for (const r of rows.slice(1)) {
  const stream = clean(r[COL.stream]);
  const name = clean(r[COL.name]);
  const date = parseDate(r[COL.date]);
  if (!stream || !name || !date) { skipped++; continue; }
  const key = `${stream}|${name}`;
  if (!groups.has(key)) groups.set(key, { stream, name, codes: new Map(), samples: [] });
  const g = groups.get(key);
  const code = Number(r[COL.code]);
  g.codes.set(code, (g.codes.get(code) ?? 0) + 1);

  const v = {};
  const q = {};
  for (const { i, key: pk } of PARAM_COLS) {
    const p = parseValue(r[i]);
    if (!p) continue;
    v[pk] = p.value;
    if (p.qualifier) q[pk] = p.qualifier;
  }
  const sample = { d: isoDay(date), v };
  if (Object.keys(q).length) sample.q = q;
  const color = clean(r[COL.color]);
  if (color) sample.color = color;
  const note = clean(r[COL.note]);
  if (note) sample.note = note;
  const lab = clean(r[COL.lab]);
  if (lab) sample.lab = lab;
  g.samples.push(sample);
}

// ── Station anchors per stream: mean of known coords (fallback for any unplaced station).
const streamAnchor = {};
for (const [k, c] of Object.entries(COORDS)) {
  if (k.startsWith('_')) continue;
  const s = k.split('|')[0];
  (streamAnchor[s] ??= []).push(c);
}
const anchorOf = (s) => {
  const list = streamAnchor[s];
  if (!list) return null;
  return [list.reduce((a, c) => a + c[0], 0) / list.length, list.reduce((a, c) => a + c[1], 0) / list.length];
};

const regionOf = (lat) => (lat >= 32.48 ? 'north' : lat >= 31.6 ? 'center' : 'south');
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

fs.rmSync(path.join(OUT_DIR, 'series'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT_DIR, 'series'), { recursive: true });

const usedIds = new Set();
const stations = [];
const missingCoords = [];
for (const g of groups.values()) {
  g.samples.sort((a, b) => a.d.localeCompare(b.d));
  const code = [...g.codes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let id = `s${code}`;
  for (let n = 2; usedIds.has(id); n++) id = `s${code}-${n}`;
  usedIds.add(id);

  const official = OFFICIAL[`${g.stream}|${g.name}`];
  let coord = official ? [official.lat, official.lng] : COORDS[`${g.stream}|${g.name}`];
  if (!coord) {
    coord = anchorOf(g.stream);
    missingCoords.push(`${g.stream}|${g.name}`);
  }
  if (!coord) continue;

  // Monthly medians of fecal coliforms — the "seasonal baseline" the forecast model converges to.
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const s of g.samples) if (s.v.Fcoli != null) byMonth[Number(s.d.slice(5, 7)) - 1].push(s.v.Fcoli);
  const fcoliMonthly = byMonth.map((xs) => median(xs));

  const latest = g.samples[g.samples.length - 1];
  stations.push({
    id,
    code,
    name: g.name,
    stream: g.stream,
    region: regionOf(coord[0]),
    lat: coord[0],
    lng: coord[1],
    approxLocation: !official,
    ...(official
      ? { official: { id: official.hydroId, name: official.hydroName, itmX: official.itmX, itmY: official.itmY } }
      : {}),
    sampleCount: g.samples.length,
    firstSample: g.samples[0].d,
    latest,
    fcoliMonthly: fcoliMonthly.some((x) => x != null) ? fcoliMonthly : null,
  });
  fs.writeFileSync(path.join(OUT_DIR, 'series', `${id}.json`), JSON.stringify(g.samples));
}

stations.sort((a, b) => a.stream.localeCompare(b.stream, 'he') || a.name.localeCompare(b.name, 'he'));
fs.writeFileSync(path.join(OUT_DIR, 'stations.json'), JSON.stringify(stations));

const allDates = stations.flatMap((s) => [s.firstSample, s.latest.d]).sort();
const meta = {
  source: xlsxFile,
  sourceDescription: 'נתוני ניטור איכות מים בנחלי ישראל — דיגום שדה ומעבדה',
  generatedAt: new Date().toISOString(),
  rowCount: rows.length - 1,
  skippedRows: skipped,
  stationCount: stations.length,
  streamCount: new Set(stations.map((s) => s.stream)).size,
  firstSample: allDates[0],
  lastSample: allDates[allDates.length - 1],
  parameters: PARAM_COLS.map((p) => p.key),
};
fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

// Human-readable list of every station and where its map location comes from.
const locRows = stations.map((s) => ({
  'נחל/קבוצה': s.stream,
  'שם תחנה (אצלנו)': s.name,
  'קוד מקווה מים': s.code,
  'מקור המיקום': s.official ? 'רשמי — רשות המים' : 'משוער לפי שם התחנה',
  'מס׳ תחנה הידרומטרית': s.official?.id ?? '',
  'שם התחנה הרשמית': s.official?.name ?? '',
  'ITM X': s.official?.itmX ?? '',
  'ITM Y': s.official?.itmY ?? '',
  'קו רוחב (lat)': s.lat,
  'קו אורך (lng)': s.lng,
  'דגימות': s.sampleCount,
  'דגימה אחרונה': s.latest.d,
}));
const wbOut = XLSX.utils.book_new();
const wsOut = XLSX.utils.json_to_sheet(locRows);
wsOut['!cols'] = [14, 34, 10, 20, 14, 30, 10, 10, 12, 12, 8, 12].map((wch) => ({ wch }));
wsOut['!views'] = [{ RTL: true }];
XLSX.utils.book_append_sheet(wbOut, wsOut, 'מיקומי תחנות');
const hydro = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'official', 'water-authority-hydro-stations.json'), 'utf8'));
const wsHydro = XLSX.utils.json_to_sheet(hydro.stations.map((h) => ({
  'מס׳ תחנה': h.id, 'שם עברית': h.nameHe, 'שם אנגלית': h.nameEn, 'אגן': h.basin, 'סטטוס': h.status,
  'ITM X': h.itmX, 'ITM Y': h.itmY, 'קו רוחב (lat)': h.lat ?? '', 'קו אורך (lng)': h.lng ?? '',
})));
wsHydro['!cols'] = [10, 34, 34, 14, 10, 10, 10, 12, 12].map((wch) => ({ wch }));
wsHydro['!views'] = [{ RTL: true }];
XLSX.utils.book_append_sheet(wbOut, wsHydro, 'רשות המים - תחנות רשמיות');
const DOC_DIR = path.join(ROOT, '..', 'documentation');
fs.mkdirSync(DOC_DIR, { recursive: true });
XLSX.writeFile(wbOut, path.join(DOC_DIR, 'station-locations.xlsx'));

console.log(`✓ ${meta.stationCount} stations · ${meta.streamCount} streams · ${meta.rowCount} rows (${skipped} skipped)`);
console.log(`  ${meta.firstSample} → ${meta.lastSample}`);
if (missingCoords.length) console.log(`  ⚠ ${missingCoords.length} stations placed at stream anchor:`, missingCoords);
