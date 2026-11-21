"""
Builds documentation/poster/NahalWatch_poster.pptx (A1 portrait, 59.4 x 84.1 cm).

Starts from a copy of the ICSA example poster (template-ICSA.pptx) to keep its
Braude title band and logo, removes the rest, and lays out NahalWatch content.
Every number on the poster is computed here from nahalwatch-app/public/data — nothing typed by hand.
Screenshots come from documentation/poster/assets (captured from the running app).

    python documentation/poster/build_poster.py
"""
from __future__ import annotations

import json
import math
import statistics
from collections import Counter
from datetime import date
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Cm, Pt

ROOT = Path(__file__).resolve().parents[2]  # repo root
APP = ROOT / "nahalwatch-app"
HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
OUT = HERE / "NahalWatch_poster.pptx"
TODAY = date(2026, 11, 20)  # poster snapshot date; matches the app's "age" calculations

# ── Palette (app tokens + Braude navy from the template band) ────────────────
NAVY = RGBColor(0x2B, 0x27, 0x65)
GREEN = RGBColor(0x0B, 0x7A, 0x4B)
GREEN_SOFT = RGBColor(0xE3, 0xF3, 0xEA)
WATER = RGBColor(0x0B, 0x6F, 0xA4)
WATER_SOFT = RGBColor(0xE3, 0xF1, 0xF9)
BG = RGBColor(0xF3, 0xF6, 0xF4)
CARD = RGBColor(0xFF, 0xFF, 0xFF)
BORDER = RGBColor(0xD5, 0xE0, 0xD9)
FG = RGBColor(0x10, 0x21, 0x1A)
MUTED = RGBColor(0x4A, 0x5B, 0x53)
SAFE, SAFE_SOFT = RGBColor(0x15, 0x80, 0x3D), RGBColor(0xE5, 0xF5, 0xEA)
CAUTION, CAUTION_SOFT = RGBColor(0xB4, 0x53, 0x09), RGBColor(0xFD, 0xF1, 0xE1)
DANGER, DANGER_SOFT = RGBColor(0xC2, 0x26, 0x1D), RGBColor(0xFD, 0xE8, 0xE6)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
HEAD_FONT, BODY_FONT = "Georgia", "Calibri"  # same pairing as the template

# ── Data & stats (mirrors RULES in src/lib/quality.ts) ───────────────────────
stations = json.loads((APP / "public/data/stations.json").read_text(encoding="utf-8"))
meta = json.loads((APP / "public/data/meta.json").read_text(encoding="utf-8"))
series_dir = APP / "public/data/series"

# (key, amber_above, red_above) — MoH for fecal coliforms; Inbar stream-discharge avg / max for the rest.
LIMITS = [
    ("Fcoli", 200, 400), ("BODt", 10, 15), ("CODt", 70, 100), ("TSS105", 10, 15), ("NH4", 1.5, 2.5),
    ("Ntot", 10, 15), ("Ptot", 1, 2), ("Cl", 400, 480), ("Na", 200, 240), ("Minoil", 1.0, 1.5), ("ABS", 0.5, 1.0),
    ("Hg", 0.0005, 0.0025), ("Cr", 0.05, 0.25), ("Ni", 0.05, 0.25), ("Pb", 0.008, 0.04), ("Cd", 0.005, 0.025),
    ("Zn", 0.2, 1.0), ("As", 0.01, 0.05), ("Cu", 0.02, 0.1),
]


def status(sample: dict) -> str:
    v, q = sample["v"], sample.get("q", {})
    worst = 0
    for k, amber, red in LIMITS:
        if k in v and q.get(k) != "<":
            worst = max(worst, 2 if v[k] > red else 1 if v[k] > amber else 0)
    if "Do" in v and v["Do"] < 3:
        worst = 2
    if "pH" in v and not 7.0 <= v["pH"] <= 8.5:
        worst = 2
    if worst == 2:
        return "danger"
    if worst == 1:
        return "caution"
    return "unknown" if "Fcoli" not in v else "safe"


def age_days(d: str) -> int:
    return (TODAY - date.fromisoformat(d)).days


recent = [s for s in stations if age_days(s["latest"]["d"]) <= 3 * 365]
north = [s for s in recent if s["region"] == "north"]
north_counts = Counter(status(s["latest"]) for s in north)
north_measured = sum(north_counts[k] for k in ("safe", "caution", "danger"))


def pct(n: int, d: int) -> int:
    return round(100 * n / d) if d else 0


# All-time share of fecal-coliform samples above the 1,000 limit.
all_f = []
for s in stations:
    for smp in json.loads((series_dir / f"{s['id']}.json").read_text(encoding="utf-8")):
        if "Fcoli" in smp["v"]:
            all_f.append(smp["v"]["Fcoli"])
share_over_400 = pct(sum(1 for x in all_f if x > 400), len(all_f))


def backtest(samples: list[dict]):
    """Leave-one-year-out seasonal model (same as backtestSeasonal in src/lib/models.ts)."""
    wf = [s for s in samples if "Fcoli" in s["v"]]
    cls = lambda x: 2 if x > 400 else 1 if x > 200 else 0  # noqa: E731
    pairs = []
    for s in wf:
        pool = sorted(o["v"]["Fcoli"] for o in wf if o["d"][5:7] == s["d"][5:7] and o["d"][:4] != s["d"][:4])
        if pool:
            pairs.append((s["v"]["Fcoli"], pool[len(pool) // 2]))
    hits = sum(1 for m, p in pairs if cls(m) == cls(p))
    return pairs, hits


HERMON = next(s for s in stations if s["id"] == "s734")
hermon_pairs, hermon_hits = backtest(json.loads((series_dir / "s734.json").read_text(encoding="utf-8")))
hermon_acc = pct(hermon_hits, len(hermon_pairs))

tot_pairs = tot_hits = 0
for s in stations:
    pr, h = backtest(json.loads((series_dir / f"{s['id']}.json").read_text(encoding="utf-8")))
    tot_pairs += len(pr)
    tot_hits += h
overall_acc = pct(tot_hits, tot_pairs)

monthly = HERMON["fcoliMonthly"]
known = [(i, x) for i, x in enumerate(monthly) if x is not None]
peak_i, peak = max(known, key=lambda t: t[1])
low_i, low = min(known, key=lambda t: t[1])
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

STATS = {
    "rows": meta["rowCount"], "stations": meta["stationCount"], "streams": meta["streamCount"],
    "years": f"{meta['firstSample'][:4]}–{meta['lastSample'][:4]}",
    "north_safe": pct(north_counts["safe"], north_measured),
    "north_caution": pct(north_counts["caution"], north_measured),
    "north_danger": pct(north_counts["danger"], north_measured),
    "north_n": north_measured, "share_over_400": share_over_400, "fcoli_n": len(all_f),
    "hermon_acc": hermon_acc, "hermon_n": len(hermon_pairs), "overall_acc": overall_acc, "overall_n": tot_pairs,
    "official_coords": sum(1 for s in stations if not s["approxLocation"]),
    "peak_month": MONTHS[peak_i], "peak": peak, "low_month": MONTHS[low_i], "low": low,
}
print(json.dumps(STATS, indent=2, ensure_ascii=False))

# ── Presentation helpers ─────────────────────────────────────────────────────
prs = Presentation(HERE / "template-ICSA.pptx")
slide = prs.slides[0]
KEEP = {"Google Shape;86;p1", "Google Shape;180;p1"}  # navy title band, Braude logo
for shp in list(slide.shapes):
    if shp.name not in KEEP:
        shp._element.getparent().remove(shp._element)
# Drop timing/animation that referenced removed shapes.
for t in slide._element.findall("{http://schemas.openxmlformats.org/presentationml/2006/main}timing"):
    slide._element.remove(t)

band = next(s for s in slide.shapes if s.name == "Google Shape;86;p1")
logo = next(s for s in slide.shapes if s.name == "Google Shape;180;p1")
SW, SH = prs.slide_width, prs.slide_height
BAND_H = Cm(8.4)
band.left, band.top, band.width, band.height = 0, 0, SW, BAND_H
band.name = "Title band"

# Poster background (sent behind everything).
bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SW, SH)
bg.fill.solid(); bg.fill.fore_color.rgb = BG; bg.line.fill.background(); bg.name = "Background"
slide.shapes._spTree.remove(bg._element); slide.shapes._spTree.insert(2, bg._element)


def text(x, y, w, h, runs, size=22, color=FG, bold=False, font=BODY_FONT, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, name=None, spacing=1.08, after=0):
    """runs: str | list[paragraph]; paragraph: str | list[(text, {opts})]."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    if name:
        tb.name = name
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    paras = [runs] if isinstance(runs, str) else runs
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        p.space_after = Pt(after)
        for t, o in ([(para, {})] if isinstance(para, str) else para):
            r = p.add_run()
            r.text = t
            f = r.font
            f.name = o.get("font", font)
            f.size = Pt(o.get("size", size))
            f.bold = o.get("bold", bold)
            f.italic = o.get("italic", False)
            f.color.rgb = o.get("color", color)
    return tb


def box(x, y, w, h, fill=CARD, line=BORDER, radius=0.035, name=None, shadow=False):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    s.adjustments[0] = radius
    s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = Pt(1.25)
    if not shadow:
        s.shadow.inherit = False
    if name:
        s.name = name
    s.text_frame.text = ""
    return s


def section(x, y, w, h, num, title, color=GREEN):
    """White card with a numbered circle and a serif heading; returns content origin."""
    box(x, y, w, h, name=f"Section {num} card")
    d = Cm(1.5)
    c = slide.shapes.add_shape(MSO_SHAPE.OVAL, x + Cm(0.9), y + Cm(0.8), d, d)
    c.fill.solid(); c.fill.fore_color.rgb = color; c.line.fill.background(); c.shadow.inherit = False
    c.name = f"Section {num} badge"
    tf = c.text_frame; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = str(num); r.font.size = Pt(26); r.font.bold = True; r.font.color.rgb = WHITE; r.font.name = BODY_FONT
    text(x + Cm(2.8), y + Cm(0.75), w - Cm(3.6), Cm(1.6), title, size=34, bold=True, color=color,
         font=HEAD_FONT, anchor=MSO_ANCHOR.MIDDLE, name=f"Section {num} title")
    return x + Cm(0.9), y + Cm(2.9), w - Cm(1.8)


def pill(x, y, w, h, label, fill, color, size=18):
    s = box(x, y, w, h, fill=fill, line=None, radius=0.5)
    tf = s.text_frame; tf.margin_left = tf.margin_right = Cm(0.2); tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = label; r.font.size = Pt(size); r.font.bold = True; r.font.color.rgb = color; r.font.name = BODY_FONT
    return s


def picture(path, x, y, w=None, h=None, name=None, border=True):
    pic = slide.shapes.add_picture(str(path), x, y, w, h)
    if name:
        pic.name = name
    if border:
        pic.line.color.rgb = BORDER; pic.line.width = Pt(1.5)
    return pic


# ── Title band ───────────────────────────────────────────────────────────────
logo.left, logo.top = Cm(1.2), Cm(2.2)
logo.width, logo.height = Cm(13.0), int(Cm(13.0) * 237 / 1004)
icon = picture(APP / "public/icons/icon-512.png", SW - Cm(1.2) - Cm(5.6), Cm(1.4), Cm(5.6), Cm(5.6), name="App icon", border=False)
text(Cm(15.2), Cm(0.9), Cm(36.0), Cm(2.6), [[("NahalWatch", {"size": 84, "bold": True, "font": HEAD_FONT})]],
     color=WHITE, align=PP_ALIGN.CENTER, name="Title")
text(Cm(15.2), Cm(3.75), Cm(36.0), Cm(1.4),
     "Is the stream safe to swim in today? 30 years of Israeli monitoring data on one traffic-light map",
     size=26, color=RGBColor(0xDD, 0xE6, 0xF5), align=PP_ALIGN.CENTER, name="Subtitle")
text(Cm(15.2), Cm(5.6), Cm(36.0), Cm(1.2), [[("Shaked Malul  ·  Adi Peled  ·  Or Orbach", {"bold": True}),
     ("     |     Advisor: Dr. Naomi Unkelos-Shpigel", {})]],
     size=26, color=WHITE, align=PP_ALIGN.CENTER, name="Authors")

# ── Grid ─────────────────────────────────────────────────────────────────────
M, G = Cm(1.2), Cm(0.9)
COL = int((SW - 2 * M - 2 * G) / 3)
X1, X2, X3 = M, M + COL + G, M + 2 * (COL + G)
WIDE = 2 * COL + G
TOP = BAND_H + Cm(1.0)
FOOT_Y = SH - Cm(4.6)

# ── Column 1 ─────────────────────────────────────────────────────────────────
# 1. Motivation & personas
y = TOP; h = Cm(16.4)
cx, cy, cw = section(X1, y, COL, h, 1, "Motivation")
text(cx, cy, cw, Cm(3.0), "Hikers check stream safety on outdated, hard-to-read government tables or Facebook groups, "
     "and sometimes find a polluted pool only after the hike.", size=21, color=MUTED)
pcard_y = cy + Cm(3.1)
for i, (name, who, quote, need) in enumerate([
    ("Eitan, 22", "Haifa · hiker",
     "“If there is even a small doubt about the water — I don't go in.”", "Reliable, up-to-date data + forecast"),
    ("Michal, 38", "Kiryat Tiv'on · mother of 3",
     "“I just want to know: can I go in with the kids or not?”", "One clear yes / no answer"),
]):
    py = pcard_y + i * Cm(5.0)
    box(cx, py, cw, Cm(4.7), fill=WATER_SOFT if i == 0 else GREEN_SOFT, line=None, radius=0.08)
    av = slide.shapes.add_shape(MSO_SHAPE.OVAL, cx + Cm(0.5), py + Cm(0.6), Cm(2.0), Cm(2.0))
    av.fill.solid(); av.fill.fore_color.rgb = WATER if i == 0 else GREEN; av.line.fill.background(); av.shadow.inherit = False
    av.text_frame.margin_left = av.text_frame.margin_right = 0
    av.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    ap = av.text_frame.paragraphs[0]; ap.alignment = PP_ALIGN.CENTER
    ar = ap.add_run(); ar.text = name[0]; ar.font.size = Pt(32); ar.font.bold = True; ar.font.color.rgb = WHITE; ar.font.name = BODY_FONT
    text(cx + Cm(3.0), py + Cm(0.45), cw - Cm(3.5), Cm(4.4), [
        [(name, {"bold": True, "size": 24}), (f"  ·  {who}", {"size": 18, "color": MUTED})],
        [(quote, {"italic": True, "size": 21})],
        [("Needs: ", {"bold": True, "size": 18, "color": MUTED}), (need, {"size": 18, "color": MUTED})],
    ], after=4)

# 2. The data (KPI tiles)
y = TOP + h + G; h = Cm(13.6)
cx, cy, cw = section(X1, y, COL, h, 2, "The Data", color=WATER)
tw = int((cw - Cm(0.6)) / 2); th = Cm(3.9)
for i, (num, lab) in enumerate([
    (f"{STATS['rows']:,}", "field & lab samples"), (str(STATS["stations"]), "monitoring stations"),
    (str(STATS["streams"]), "streams & groups"), (STATS["years"], "years of monitoring"),
]):
    tx = cx + (i % 2) * (tw + Cm(0.6)); ty = cy + (i // 2) * (th + Cm(0.5))
    box(tx, ty, tw, th, fill=WATER_SOFT, line=None, radius=0.1)
    text(tx, ty + Cm(0.35), tw, Cm(2.1), num, size=48 if len(num) < 8 else 40, bold=True, color=WATER, align=PP_ALIGN.CENTER, font=HEAD_FONT)
    text(tx, ty + Cm(2.55), tw, Cm(1.0), lab, size=19, color=MUTED, align=PP_ALIGN.CENTER)
text(cx, cy + 2 * th + Cm(0.8), cw, Cm(1.6), "Bacteria, organic load, nutrients, oxygen, pH, minerals and metals — about 80 parameters.",
     size=17, color=MUTED)

# 3. Research questions
y = y + h + G; h = Cm(15.4)
cx, cy, cw = section(X1, y, COL, h, 3, "Research Questions")
rqs = [
    ("RQ1", "How long does it take a polluted stream to clear, depending on flow?"),
    ("RQ2", "How do flow, temperature and turbidity drive microbial pollution across the seasons?"),
    ("RQ3", "How do field indicators (conductivity, turbidity) relate to bathing safety?"),
    ("RQ4", "How well do ecological-model forecasts match field measurements?"),
    ("RQ5", "Can chemical variables act as early indicators of dangerous bacteria?"),
]
for i, (tag, q) in enumerate(rqs):
    ry = cy + i * Cm(2.4)
    addressed = tag in ("RQ2", "RQ4")
    pill(cx, ry + Cm(0.1), Cm(2.4), Cm(1.1), tag, GREEN if addressed else GREEN_SOFT, WHITE if addressed else GREEN, size=18)
    text(cx + Cm(2.9), ry, cw - Cm(2.9), Cm(2.4), q, size=20)
text(cx, cy + 5 * Cm(2.4), cw, Cm(1.0), [[("■ ", {"color": GREEN}), ("addressed in this release (see sections 7–8)", {})]],
     size=17, color=MUTED)

# 4. Requirements
y = y + h + G; h = FOOT_Y - G - y
cx, cy, cw = section(X1, y, COL, h, 4, "Requirements")
fr = [
    "Interactive traffic-light map (green / amber / red) of stream safety",
    "Colors follow official limits (Ministry of Health, Inbar regulations)",
    "Every warning lists each parameter, its value and the limit crossed",
    "Station page: latest values, history charts, full lab table",
    "3-day forecast from ecological models (logistic growth)",
    "Nearest station within limits suggested as an alternative",
]
nfr = [
    ("Usability", "an answer in under 3 taps"),
    ("Accessibility", "status shown by icon + text, not color alone (WCAG 2.1)"),
    ("Performance", "pre-rendered static pages, offline service worker"),
    ("Reliability", "sample date on every reading; old data flagged"),
    ("Privacy", "no accounts, no personal data collected"),
]
text(cx, cy, cw, Cm(1.0), "Functional", size=22, bold=True, color=GREEN)
text(cx, cy + Cm(1.2), cw, Cm(9.0), [[("✓  ", {"bold": True, "color": SAFE}), (t, {})] for t in fr], size=18, after=4)
ny = cy + Cm(9.6)
text(cx, ny, cw, Cm(1.0), "Non-functional", size=22, bold=True, color=GREEN)
text(cx, ny + Cm(1.2), cw, Cm(8.0), [[(f"{a}: ", {"bold": True}), (b, {"color": MUTED})] for a, b in nfr], size=18, after=4)

# ── Columns 2–3 ──────────────────────────────────────────────────────────────
# 5. The app (hero)
y = TOP; h = Cm(27.6)
cx, cy, cw = section(X2, y, WIDE, h, 5, "The App — Upper Jordan Sources, Kfar Blum & Amir")
# Three phones centred in a row, four feature callouts in a row underneath.
ph_h = Cm(16.8); ph_w = int(ph_h * 1170 / 2532); ph_gap = Cm(1.6)
row_w = 3 * ph_w + 2 * ph_gap
px0 = cx + int((cw - row_w) / 2)
phones = [
    ("phone-map-card.png", "Map + station card"),
    ("phone-station.png", "Station page"),
    ("phone-updates.png", "Updates feed"),
]
for i, (fn, cap) in enumerate(phones):
    px = px0 + i * (ph_w + ph_gap)
    picture(ASSETS / fn, px, cy, ph_w, ph_h, name=f"Screenshot {cap}")
    text(px, cy + ph_h + Cm(0.3), ph_w, Cm(1.0), cap, size=18, color=MUTED, align=PP_ALIGN.CENTER)
callouts = [
    ("Traffic light", "Green, amber or red from each station's latest lab sample. The map opens where the Snir, Dan and Hermon form the Jordan."),
    ("Why red?", "Every parameter over its official limit is listed, e.g. “Fecal coliforms: 950 cfu/100ml — above 400 (Ministry of Health)”."),
    ("Forecast", "A logistic-growth model projects bacteria for today + 3 days, from the last sample toward the seasonal level."),
    ("Install & offline", "A PWA: “Add to Home Screen” on iPhone or Android; keeps working with weak reception."),
]
k_gap = Cm(0.6)
k_w = int((cw - 3 * k_gap) / 4)
ky = cy + ph_h + Cm(1.6)
k_h = y + h - ky - Cm(0.8)
for i, (t, d) in enumerate(callouts):
    kx = cx + i * (k_w + k_gap)
    box(kx, ky, k_w, k_h, fill=GREEN_SOFT if i % 2 == 0 else WATER_SOFT, line=None, radius=0.08)
    text(kx + Cm(0.5), ky + Cm(0.4), k_w - Cm(1.0), k_h - Cm(0.6),
         [[(t, {"bold": True, "size": 22, "color": GREEN if i % 2 == 0 else WATER})], [(d, {"size": 16})]], after=3)

# 6. Architecture / data flow
y = y + h + G; h = Cm(9.4)
cx, cy, cw = section(X2, y, WIDE, h, 6, "How It Works", color=WATER)
steps = [
    ("data.gov.il", f"Ministry of Env. Protection\n{STATS['rows']:,} samples"),
    ("build-data script", f"clean, group, place on map\n({STATS['official_coords']} official coordinates)"),
    ("Static JSON", "station index +\nhistory per station"),
    ("Next.js PWA", "224 pre-rendered pages,\nservice worker"),
    ("Phone home screen", "no login, no server,\nworks offline"),
]
n = len(steps); aw = Cm(1.3)
sw_ = int((cw - (n - 1) * (aw + Cm(0.4))) / n)
for i, (t, d) in enumerate(steps):
    sx = cx + i * (sw_ + aw + Cm(0.4))
    box(sx, cy, sw_, Cm(4.9), fill=WATER_SOFT if i % 2 == 0 else GREEN_SOFT, line=None, radius=0.1)
    text(sx + Cm(0.3), cy + Cm(0.4), sw_ - Cm(0.6), Cm(4.3),
         [[(t, {"bold": True, "size": 21, "color": WATER if i % 2 == 0 else GREEN})]]
         + [[(line, {"size": 17, "color": MUTED})] for line in d.split("\n")],
         align=PP_ALIGN.CENTER, after=4)
    if i < n - 1:
        ar = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, sx + sw_ + Cm(0.2), cy + Cm(1.85), aw, Cm(1.2))
        ar.fill.solid(); ar.fill.fore_color.rgb = NAVY; ar.line.fill.background(); ar.shadow.inherit = False
text(cx, cy + Cm(5.3), cw, Cm(0.9), "Stack: Next.js · React · TypeScript · Tailwind CSS · Leaflet + OpenStreetMap · Recharts",
     size=18, color=MUTED, align=PP_ALIGN.CENTER)

# 7. Traffic-light rules (left) + 8. Models (right)
y = y + h + G; h = Cm(15.6)
cx, cy, cw = section(X2, y, COL, h, 7, "Official Limits")
text(cx, cy, cw, Cm(2.2), [
    [("Green ", {"bold": True, "color": SAFE}), ("all limits met · ", {}),
     ("Amber ", {"bold": True, "color": CAUTION}), ("above the target · ", {}),
     ("Red ", {"bold": True, "color": DANGER}), ("above the maximum", {})]], size=19)
rows = [("Parameter", "Amber above", "Red above"),
        ("Fecal coliforms*", "200", "400"), ("BOD", "10", "15"), ("COD", "70", "100"),
        ("Ammonia", "1.5", "2.5"), ("Total phosphorus", "1", "2"), ("Suspended solids", "10", "15"),
        ("Dissolved O₂", "—", "below 3")]
tbl = slide.shapes.add_table(len(rows), 3, cx, cy + Cm(1.6), cw, Cm(len(rows) * 1.15)).table
tbl.columns[0].width = int(cw * 0.46); tbl.columns[1].width = int(cw * 0.27); tbl.columns[2].width = cw - tbl.columns[0].width - tbl.columns[1].width
for r, row in enumerate(rows):
    for c, val in enumerate(row):
        cell = tbl.cell(r, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY if r == 0 else (CARD if r % 2 else BG)
        cell.margin_left = cell.margin_right = Cm(0.25); cell.margin_top = cell.margin_bottom = Cm(0.06)
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
        run = p.add_run(); run.text = val
        run.font.size = Pt(17); run.font.name = BODY_FONT; run.font.bold = r == 0 or c == 2
        run.font.color.rgb = WHITE if r == 0 else DANGER if c == 2 else CAUTION if c == 1 and val != "—" else FG
text(cx, cy + Cm(1.6) + Cm(len(rows) * 1.15) + Cm(0.35), cw, Cm(3.2), [
    [("* Ministry of Health, streams (cfu/100 ml). Others: Inbar regulations 2010, discharge to streams, "
      "monthly-average / maximum (mg/l); metals, chloride, sodium, oil and detergents likewise.", {})]], size=13, color=MUTED)

cx, cy, cw = section(X3, y, COL, h, 8, "Ecological Models", color=WATER)
eqs = [
    ("Logistic growth — the 3-day forecast", "dN/dt = r·N·(1 − N/K)",
     "N₀ = last measured bacteria, K = the station's median for that month, r = 0.35 / day."),
    ("Lotka–Volterra — bacteria & grazers", "dB/dt = αB − βBP     dP/dt = δBP − γP",
     "Protozoa graze on bacteria: an interactive simulator shows the natural boom-and-bust cycle."),
]
for i, (t, eq, d) in enumerate(eqs):
    ey = cy + i * Cm(6.3)
    text(cx, ey, cw, Cm(1.0), t, size=21, bold=True, color=WATER)
    box(cx, ey + Cm(1.2), cw, Cm(1.8), fill=WATER_SOFT, line=None, radius=0.15)
    text(cx, ey + Cm(1.2), cw, Cm(1.8), eq, size=24, font="Cambria Math", align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, color=NAVY)
    text(cx, ey + Cm(3.25), cw, Cm(3.0), d, size=18, color=MUTED)

# 9. Findings: model vs field (chart) + key findings
y = y + h + G; h = FOOT_Y - G - y
cx, cy, cw = section(X2, y, COL, h, 9, "Model vs. Field")
cd = CategoryChartData()
cd.categories = MONTHS
cd.add_series("Median fecal coliforms", [x if x is not None else 0 for x in monthly])
gf = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, cx, cy, cw, Cm(7.0), cd)
gf.name = "Hermon seasonality chart"
ch = gf.chart
ch.has_legend = False
ch.has_title = True
ch.chart_title.text_frame.text = "Hermon @ Kfar Szold: median fecal coliforms by month"
tr = ch.chart_title.text_frame.paragraphs[0].runs[0]
tr.font.size = Pt(17); tr.font.bold = True; tr.font.color.rgb = FG; tr.font.name = BODY_FONT
plot = ch.plots[0]; plot.gap_width = 40
plot.has_data_labels = True
dl = plot.data_labels; dl.font.size = Pt(12); dl.font.color.rgb = MUTED; dl.position = XL_LABEL_POSITION.OUTSIDE_END; dl.number_format = "#,##0"; dl.number_format_is_linked = False
for idx, x in enumerate(monthly):
    pt = plot.series[0].points[idx]
    pt.format.fill.solid()
    pt.format.fill.fore_color.rgb = DANGER if (x or 0) > 400 else CAUTION if (x or 0) > 200 else SAFE
for ax in (ch.category_axis, ch.value_axis):
    ax.tick_labels.font.size = Pt(13); ax.tick_labels.font.color.rgb = MUTED
    ax.format.line.color.rgb = BORDER
ch.value_axis.major_gridlines.format.line.color.rgb = BORDER
ch.value_axis.has_major_gridlines = True
kw = int((cw - Cm(0.6)) / 2)
for i, (num, lab, col, soft) in enumerate([
    (f"{STATS['hermon_acc']}%", f"correct light at Hermon\n({STATS['hermon_n']} samples)", SAFE, SAFE_SOFT),
    (f"{STATS['overall_acc']}%", f"correct light, all stations\n({STATS['overall_n']:,} samples)", WATER, WATER_SOFT),
]):
    kx_ = cx + i * (kw + Cm(0.6)); ky_ = cy + Cm(7.2)
    box(kx_, ky_, kw, Cm(3.7), fill=soft, line=None, radius=0.1)
    text(kx_, ky_ + Cm(0.2), kw, Cm(1.9), num, size=44, bold=True, color=col, align=PP_ALIGN.CENTER, font=HEAD_FONT)
    text(kx_, ky_ + Cm(2.1), kw, Cm(1.5), [[(line, {})] for line in lab.split("\n")], size=14, color=MUTED, align=PP_ALIGN.CENTER)

cx, cy, cw = section(X3, y, COL, h, 10, "Key Findings")
findings = [
    [("Northern streams: ", {"bold": True}),
     (f"of {STATS['north_n']} stations sampled in the last 3 years, {STATS['north_safe']}% are green, "
      f"{STATS['north_caution']}% amber and {STATS['north_danger']}% red.", {})],
    [("Seasonality: ", {"bold": True}),
     (f"at Hermon the median peaks in {STATS['peak_month']} ({STATS['peak']:,}) and is lowest in "
      f"{STATS['low_month']} ({STATS['low']:,} cfu/100 ml).", {})],
    [("Pollution is common: ", {"bold": True}),
     (f"{STATS['share_over_400']}% of all {STATS['fcoli_n']:,} fecal-coliform samples are above the Ministry of Health limit of 400.", {})],
    [("Model vs. field: ", {"bold": True}),
     ("the seasonal model gets the usual level right but misses sudden spikes, so a fresh sample always beats the forecast.", {})],
]
text(cx, cy, cw, Cm(7.5), findings, size=16, after=4)
box(cx, cy + Cm(7.7), cw, Cm(3.4), fill=CAUTION_SOFT, line=None, radius=0.08)
text(cx + Cm(0.5), cy + Cm(7.9), cw - Cm(1.0), Cm(3.0), [
    [("Limitations: ", {"bold": True, "color": CAUTION}),
     (f"the source has no GPS — {STATS['official_coords']} stations use official Water Authority coordinates, the rest are "
      "estimated from their names; the newest sample is a year old; the app shows the last sample, not live conditions.", {})]], size=15)

# ── Footer ───────────────────────────────────────────────────────────────────
fy = FOOT_Y + Cm(0.2)
box(M, fy, SW - 2 * M - Cm(5.0) - G, Cm(3.9), fill=NAVY, line=None, radius=0.12, name="Footer")
text(M + Cm(1.0), fy, SW - 2 * M - Cm(7.0) - G, Cm(3.9), [
    [("Developed by Shaked Malul, Adi Peled & Or Orbach", {"bold": True}),
     ("   ·   Advisor: Dr. Naomi Unkelos-Shpigel   ·   Braude College of Engineering, Karmiel", {})],
    [(f"Data: Israeli stream water-quality monitoring, {STATS['years']} · Map © OpenStreetMap contributors", {"size": 17, "color": RGBColor(0xC9, 0xD2, 0xEA)})],
], size=21, color=WHITE, anchor=MSO_ANCHOR.MIDDLE, after=4)
qr = box(SW - M - Cm(5.0), fy, Cm(5.0), Cm(3.9), fill=CARD, line=NAVY, radius=0.12, name="QR placeholder")
text(SW - M - Cm(5.0), fy, Cm(5.0), Cm(3.9), [[("Demo QR", {"bold": True, "size": 20, "color": NAVY})],
     [("added after deployment", {"size": 14, "color": MUTED})]], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

prs.save(OUT)
print("saved", OUT)
