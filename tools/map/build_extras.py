"""Rivers and mountain marks for the hand-drawn India map (Scene 3).

Rivers: Natural Earth 10m rivers & lake centerlines (public domain), clipped to India's
outline (DataMeet india-composite, CC0, per the official boundary of India). Mountains:
small inked peak marks placed along the Himalaya and the Western and Eastern Ghats,
kept inside India. Same projection as build_india.py.

Run: tools/.venv-translate/bin/python tools/map/build_extras.py
Writes: src/world/india-extras.json
"""
import json
import math
import os
import random

import shapefile
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.ops import unary_union

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "..", "src", "world", "india-extras.json")
base = json.load(open(os.path.join(HERE, "..", "..", "src", "world", "india-map.json")))
P = base["projection"]


def proj(lon, lat):
    return ((lon - P["lon0"]) * P["k"] * P["scale"], -(lat - P["lat0"]) * P["scale"])


gj = json.load(open(os.path.join(HERE, "src", "india-composite.geojson")))
india = unary_union([shape(f["geometry"]) for f in gj["features"]])
inner = india.buffer(-0.12)  # keep marks off the coast and border lines

MAJOR = {
    "Ganges": ("Ganga", "गंगा", "ଗଙ୍ଗା"),
    "Yamuna": ("Yamuna", "यमुना", "ଯମୁନା"),
    "Brahmaputra": ("Brahmaputra", "ब्रह्मपुत्र", "ବ୍ରହ୍ମପୁତ୍ର"),
    "Godävari": ("Godavari", "गोदावरी", "ଗୋଦାବରୀ"),
    "Krishna": ("Krishna", "कृष्णा", "କୃଷ୍ଣା"),
    "Cauvery": ("Kaveri", "कावेरी", "କାବେରୀ"),
    "Mahäna Nadï": ("Mahanadi", "महानदी", "ମହାନଦୀ"),
    "Narmada": ("Narmada", "नर्मदा", "ନର୍ମଦା"),
}
MINOR = {"Indus", "Sutlej", "Chenab", "Jhelum", "Ravi", "Beas", "Chambal", "Son", "Ghäghara", "Gandak", "Sapt", "Tapi", "Mahi", "Tungabhadra", "Bhima", "Wainganga", "Penner", "Brahmani", "Tista", "Dihang", "Betwa", "Kolidam", "Indravati"}


def simplify_line(coords, tol):
    ls = LineString([proj(*c) for c in coords]).simplify(tol)
    return list(ls.coords)


def to_path(lines):
    return "".join("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in l) for l in lines if len(l) > 1)


r = shapefile.Reader(os.path.join(HERE, "src", "ne", "ne_10m_rivers_lake_centerlines"))
rivers = {}
for sr in r.iterShapeRecords():
    name = sr.record.as_dict()["name"]
    if name not in MAJOR and name not in MINOR:
        continue
    g = shape(sr.shape.__geo_interface__).intersection(india)
    if g.is_empty:
        continue
    parts = [g] if isinstance(g, LineString) else list(getattr(g, "geoms", []))
    for p in parts:
        if isinstance(p, LineString) and p.length > 0.15:
            rivers.setdefault(name, []).append(list(p.coords))

out_rivers = []
labels = []
for name, lines in rivers.items():
    major = name in MAJOR
    proj_lines = [simplify_line(l, 0.6) for l in lines]
    out_rivers.append({"name": MAJOR[name][0] if major else name, "major": major, "d": to_path(proj_lines)})
    if major:
        # label along the longest stretch, at its middle, rotated with the river
        longest = max((LineString(l) for l in proj_lines), key=lambda l: l.length)
        mid = longest.interpolate(0.5, normalized=True)
        a = longest.interpolate(0.45, normalized=True)
        b = longest.interpolate(0.55, normalized=True)
        ang = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
        if ang > 90:
            ang -= 180
        if ang < -90:
            ang += 180
        en, hi, od = MAJOR[name]
        labels.append({"en": en, "hi": hi, "or": od, "x": round(mid.x, 1), "y": round(mid.y, 1), "a": round(ang, 1)})

RANGES = {
    "Himalaya": [(73.9, 34.6), (75.3, 33.7), (76.8, 32.9), (78.2, 31.6), (79.6, 30.6), (80.9, 29.9), (82.6, 29.0), (84.2, 28.5), (85.9, 28.1), (87.7, 27.9), (88.5, 27.7), (89.9, 27.6), (91.6, 27.8), (93.0, 28.0), (94.6, 28.4), (96.2, 28.5)],
    "Karakoram": [(76.0, 35.6), (77.2, 35.3), (78.2, 34.9), (79.0, 34.4)],
    "Western Ghats": [(73.7, 20.8), (73.6, 19.2), (73.7, 17.6), (74.0, 16.0), (74.4, 14.6), (75.0, 13.2), (75.6, 12.0), (76.4, 10.9), (77.0, 9.8), (77.3, 8.7)],
    "Eastern Ghats": [(85.6, 21.4), (84.4, 20.1), (83.2, 18.9), (81.9, 17.7), (80.7, 16.2), (79.7, 14.7), (79.0, 13.4), (78.4, 12.3)],
}
rng = random.Random(7)
peaks = []
for name, pts in RANGES.items():
    line = LineString(pts)
    big = name in ("Himalaya", "Karakoram")
    step = 0.32 if big else 0.36
    width = 0.75 if big else 0.32
    n = int(line.length / step)
    for i in range(n + 1):
        c = line.interpolate(i * step)
        rows = 3 if big else 1
        for row in range(rows):
            # a little band of peaks across the range, offset perpendicular
            off = (row - (rows - 1) / 2) * width * 0.9 + rng.uniform(-0.08, 0.08)
            a = line.interpolate(max(0, i * step - 0.1))
            b = line.interpolate(min(line.length, i * step + 0.1))
            dx, dy = b.x - a.x, b.y - a.y
            nl = math.hypot(dx, dy) or 1
            lon = c.x + (-dy / nl) * off + rng.uniform(-0.06, 0.06)
            lat = c.y + (dx / nl) * off + rng.uniform(-0.06, 0.06)
            if not inner.contains(Point(lon, lat)):
                continue
            x, y = proj(lon, lat)
            s = (1.0 if big else 0.7) * rng.uniform(0.75, 1.15) * (1.15 if row == 1 else 0.9)
            peaks.append([round(x, 1), round(y, 1), round(s, 2)])

seas = [
    {"en": "Arabian Sea", "hi": "अरब सागर", "or": "ଆରବ ସାଗର", "x": proj(66.0, 15.0)[0], "y": proj(66.0, 15.0)[1]},
    {"en": "Bay of Bengal", "hi": "बंगाल की खाड़ी", "or": "ବଙ୍ଗୋପସାଗର", "x": proj(89.0, 15.0)[0], "y": proj(89.0, 15.0)[1]},
    {"en": "Indian Ocean", "hi": "हिंद महासागर", "or": "ଭାରତ ମହାସାଗର", "x": proj(79.0, 4.0)[0], "y": proj(79.0, 4.0)[1]},
]
ranges = [
    {"en": "Himalaya", "hi": "हिमालय", "or": "ହିମାଳୟ", "x": proj(83.0, 30.1)[0], "y": proj(83.0, 30.1)[1], "a": -16},
    {"en": "Western Ghats", "hi": "पश्चिमी घाट", "or": "ପଶ୍ଚିମଘାଟ", "x": proj(74.9, 15.0)[0], "y": proj(74.9, 15.0)[1], "a": -70},
    {"en": "Eastern Ghats", "hi": "पूर्वी घाट", "or": "ପୂର୍ବଘାଟ", "x": proj(80.6, 17.5)[0], "y": proj(80.6, 17.5)[1], "a": 52},
]
data = {
    "source": "Rivers: Natural Earth 10m rivers (public domain), clipped to India. Mountains: hand-placed marks along the ranges.",
    "rivers": out_rivers,
    "riverLabels": labels,
    "peaks": peaks,
    "seas": [{**s, "x": round(s["x"], 1), "y": round(s["y"], 1)} for s in seas],
    "ranges": [{**g, "x": round(g["x"], 1), "y": round(g["y"], 1)} for g in ranges],
}
with open(OUT, "w") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes;", len(out_rivers), "rivers;", len(peaks), "peaks;", [l["en"] for l in labels])
