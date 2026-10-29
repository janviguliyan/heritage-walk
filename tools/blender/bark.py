"""Bark for the walk's trees, as one tileable texture (no photographs): deep vertical furrows
between rough plates, fine grain, and grey-green lichen. Near-neutral grey-brown, so each tree's
own wood colour tints it; the furrows are already dark, so it reads without a normal map.

Writes public/foliage/bark-albedo.webp (512 x 1024: about 0.5 m round by 1 m up a trunk).

  cd tools/blender && ../.venv-tts/bin/python bark.py
"""
import os
import subprocess

import numpy as np
from PIL import Image

from relief import blur, fbm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "foliage")
W, H = 512, 1024


def main():
    shape = (H, W)
    # plates: noise stretched up the trunk (aspect < 1 on v damps vertical detail), furrows where
    # it crosses zero
    plates = fbm(shape, 3, 3.4, lo=3, aspect=(1.0, 0.16))
    warp = fbm(shape, 4, 3.6, lo=2, aspect=(1.0, 0.3))
    ridge = np.abs(plates + 0.35 * warp)
    furrow = 1 - np.clip(ridge / 0.35, 0, 1) ** 0.7
    # cross-cracks breaking the plates into blocks
    cross = np.abs(fbm(shape, 5, 3.0, lo=4, aspect=(0.5, 1.0)))
    crack = np.clip(1 - cross / 0.06, 0, 1) * np.clip(ridge, 0, 1) * 0.6
    grain = fbm(shape, 6, 1.6, lo=60, aspect=(1.0, 0.2))
    lichen = np.clip(fbm(shape, 7, 3.0, lo=3) - 0.8, 0, None)
    lichen = np.clip(blur(lichen, 2) * 1.6, 0, 1) * (1 - furrow)
    # value: the plates' faces lit, the furrows deep and dark
    v = 0.78 - 0.55 * furrow - 0.25 * crack + 0.05 * grain
    v = np.clip(v, 0.08, 1)
    bark = np.array([0.62, 0.55, 0.48])
    moss = np.array([0.6, 0.64, 0.5])
    c = v[..., None] * (bark * (1 - lichen[..., None] * 0.7) + moss * lichen[..., None] * 0.7)
    c = np.clip(c, 0, 1)
    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(OUT, "bark-albedo.png")
    Image.fromarray((c * 255 + 0.5).astype(np.uint8)).save(png)
    out = os.path.join(OUT, "bark-albedo.webp")
    subprocess.run(["cwebp", "-quiet", "-q", "86", png, "-o", out], check=True)
    os.remove(png)
    print(f"{out}: {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    main()
