"""Build the hand-drawn India map data (SVG path strings) from DataMeet sources.

India outline: DataMeet `Country/india-composite.geojson` (CC0) — land area of India
including all territories per the official boundary of India (Survey of India).
States: DataMeet `States/Admin2` (CC BY 4.0).

Run: tools/.venv-translate/bin/python tools/map/build_india.py
Writes: src/world/india-map.json
"""
import json
import math
import os

import shapefile

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "..", "src", "world", "india-map.json")

# Simple equidistant projection centred on India; y grows downwards (SVG).
LON0, LAT0 = 82.5, 22.0
K = math.cos(math.radians(LAT0))
SCALE = 30.0  # svg units per degree of latitude


def proj(lon, lat):
    return ((lon - LON0) * K * SCALE, -(lat - LAT0) * SCALE)


def dp(points, tol):
    """Douglas-Peucker simplification (iterative)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(points, keep) if k]


def area(ring):
    s = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def ring_path(ring):
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in ring) + "Z"


def rings_to_path(rings, tol, min_area):
    out = []
    for ring in rings:
        pts = [proj(lon, lat) for lon, lat in ring]
        if area(pts) < min_area:
            continue
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]
        # split the closed ring at its farthest point so the simplifier has a real baseline
        far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
        simp = dp(pts[: far + 1], tol)[:-1] + dp(pts[far:] + [pts[0]], tol)[:-1]
        if len(simp) < 3:
            # tiny island: keep as a small diamond so it still shows on the map
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            simp = [(cx, cy - 0.6), (cx + 0.6, cy), (cx, cy + 0.6), (cx - 0.6, cy)]
        out.append(ring_path(simp))
    return "".join(out)


def geojson_rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def shape_rings(shape):
    pts = shape.points
    parts = list(shape.parts) + [len(pts)]
    return [pts[parts[i]:parts[i + 1]] for i in range(len(parts) - 1)]


def main():
    with open(os.path.join(HERE, "src", "india-composite.geojson")) as f:
        gj = json.load(f)
    india_rings = []
    for feat in gj["features"]:
        india_rings += geojson_rings(feat["geometry"])
    india = rings_to_path(india_rings, tol=0.5, min_area=0.02)

    r = shapefile.Reader(os.path.join(HERE, "src", "Admin2"))
    states = []
    for sr in r.iterShapeRecords():
        name = sr.record[0]
        d = rings_to_path(shape_rings(sr.shape), tol=0.9, min_area=0.4)
        if d:
            states.append({"name": name, "d": d})

    # bounds of the outline
    xs, ys = [], []
    for ring in india_rings:
        for lon, lat in ring:
            x, y = proj(lon, lat)
            xs.append(x)
            ys.append(y)
    pad = 20
    box = [min(xs) - pad, min(ys) - pad, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad]

    data = {
        "source": "India outline: DataMeet india-composite.geojson (CC0), per the official boundary of India (Survey of India). States: DataMeet States/Admin2 (CC BY 4.0).",
        "projection": {"lon0": LON0, "lat0": LAT0, "k": K, "scale": SCALE},
        "viewBox": [round(v, 1) for v in box],
        "india": india,
        "states": states,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT), "bytes;", len(states), "states; viewBox", data["viewBox"])


if __name__ == "__main__":
    main()
