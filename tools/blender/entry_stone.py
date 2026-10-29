"""The chamber's stone tablet (the slab the India map and Konark's plan are cut into), sculpted as
one height field the size of the slab, so no tile repeats across it: honey sandstone with fine
sand grain, faint bedding, clouded colour, a few hairline cracks and edges worn by hands.

Writes public/entry/slab-albedo.webp and slab-height.webp (2048 x 1418, the slab's carving
canvas, so the carving and the stone share one uv). The site adds the carving's grooves to this
height before it derives the normals (src/entry/carve.ts).

  tools/.venv-tts/bin/python tools/blender/entry_stone.py
"""
import os
import subprocess

import numpy as np
from PIL import Image

from relief import blur, fbm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "entry")
RAW = os.path.join(ROOT, "tools", "blender", "out", "tex")
W, H = 2048, 1418  # SLAB in src/entry/indiaCarving.ts
# the slab's size on the platform is about 2.6 m: ~790 px a metre
PX = 790.0

# sandstone, sRGB: honey, a paler sand, a rust cloud, the dark of a crack
HONEY = (205, 160, 104)
PALE = (222, 190, 140)
RUST = (150, 88, 44)
DARK = (70, 44, 24)


def lines(shape, seed, n, length, wander):
    """Hairline cracks: random walks drawn as a thin mask (0..1)."""
    rng = np.random.default_rng(seed)
    m = np.zeros(shape, np.float32)
    Hh, Ww = shape
    for _ in range(n):
        x, y = rng.uniform(0, Ww), rng.uniform(0, Hh)
        a = rng.uniform(0, np.pi * 2)
        steps = int(length * rng.uniform(0.5, 1.2))
        for i in range(steps):
            a += rng.normal(0, wander)
            x += np.cos(a)
            y += np.sin(a)
            if not (0 <= x < Ww and 0 <= y < Hh):
                break
            # cracks fade in and out along their length
            w = np.sin(np.pi * i / steps) ** 0.5
            m[int(y), int(x)] = max(m[int(y), int(x)], w)
    return np.clip(blur(m, 0.7) * 3.0, 0, 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    shape = (H, W)
    # height in metres
    cloud = fbm(shape, 1, 3.0, lo=1.5)
    mid = fbm(shape, 2, 2.6, lo=6)
    grain = fbm(shape, 3, 1.2, lo=200)
    sand = np.clip(fbm(shape, 4, 0.6, lo=500) - 2.0, 0, None)
    # bedding: the stone's layers, faint, slightly wavy, running across the slab at a slant
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    bed_phase = (yy * 0.92 + xx * 0.18) / PX * 9.0 + fbm(shape, 5, 3.2, lo=1.5) * 0.9
    bed = np.sin(bed_phase * 2 * np.pi)
    # few, short and nearly straight: they must never be mistaken for the carving
    crack = lines(shape, 6, 3, 420, 0.025)
    # pits: a sparse scatter of small hollows where grains have weathered out
    pits = np.clip(fbm(shape, 7, 1.0, lo=120) - 2.3, 0, None)
    # worn edges: the border of the slab is rounded and smoother where hands rested
    ex = np.minimum(xx, W - 1 - xx) / PX
    ey = np.minimum(yy, H - 1 - yy) / PX
    edge = np.clip(np.minimum(ex, ey) / 0.05, 0, 1)
    h = (
        mid * 0.0006
        + bed * 0.00012
        + grain * 0.00018
        - sand * 0.00025
        - pits * 0.0012
        - crack * 0.0004
        - (1 - edge) ** 2 * 0.004
    )
    h = h.astype(np.float32)

    # colour
    c0 = np.array(HONEY, np.float32) / 255
    c1 = np.array(PALE, np.float32) / 255
    cr = np.array(RUST, np.float32) / 255
    cd = np.array(DARK, np.float32) / 255
    t = np.clip(0.5 + 0.2 * cloud + 0.06 * bed, 0, 1)[..., None]
    c = c0 * (1 - t) + c1 * t
    rust = np.clip((fbm(shape, 8, 3.4, lo=1.2) - 0.3) * 0.3, 0, 0.22)[..., None]
    c = c * (1 - rust) + cr * rust
    # a fine speckle of darker and paler grains, like real sandstone seen close
    speck = fbm(shape, 9, 0.4, lo=400)
    c = c * (1 + 0.045 * np.clip(speck, -2, 2)[..., None])
    # hollows hold dust and grime; cracks are dark lines
    hollow = np.clip((blur(h, 6) - h) / 0.0006, 0, 1)[..., None]
    c = c * (1 - 0.1 * hollow)
    k = (crack * 0.3)[..., None]
    c = c * (1 - k) + cd * k
    # weathered stone is duller than fresh: a quarter of the way to grey
    lum = (c * np.array([0.3, 0.59, 0.11], np.float32)).sum(-1, keepdims=True)
    c = c * 0.78 + lum * np.array([1.0, 0.97, 0.92], np.float32) * 0.22
    c = np.clip(c, 0, 1)

    hn = (h - h.min()) / (h.max() - h.min())
    print("height range (mm):", round(float(h.min()) * 1000, 2), round(float(h.max()) * 1000, 2))
    files = {
        "albedo": Image.fromarray((c * 255 + 0.5).astype(np.uint8)),
        "height": Image.fromarray((hn * 255 + 0.5).astype(np.uint8)),
    }
    for k, im in files.items():
        png = os.path.join(RAW, f"slab-{k}.png")
        im.save(png)
        subprocess.run(["cwebp", "-quiet", "-q", "88" if k == "albedo" else "92", png, "-o", os.path.join(OUT, f"slab-{k}.webp")], check=True)
    # the height's range in metres, for the site to scale it back
    with open(os.path.join(OUT, "slab.json"), "w") as f:
        f.write('{"min": %.6f, "max": %.6f, "px": %.1f}\n' % (h.min(), h.max(), PX))
    print("slab ->", OUT)


if __name__ == "__main__":
    main()
