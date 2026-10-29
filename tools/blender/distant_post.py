"""Turn distant.py's horizon renders into the site's textures (public/sites/konark/horizon/):
colour bled out under the sky (so the edges of tree lines don't darken in mipmaps), then cwebp.

  tools/.venv-tts/bin/python tools/blender/distant_post.py
"""
import os
import subprocess

import numpy as np
from PIL import Image

from foliage_post import bleed

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "tools", "blender", "out", "distant")
OUT = os.path.join(ROOT, "public", "sites", "konark", "horizon")


def webp(img, name, args):
    png = os.path.join(OUT, name.replace(".webp", ".png"))
    img.save(png)
    out = os.path.join(OUT, name)
    subprocess.run(["cwebp", "-quiet"] + args + [png, "-o", out], check=True)
    os.remove(png)
    print(f"{os.path.relpath(out, ROOT)}: {os.path.getsize(out) // 1024} KB")


def main():
    os.makedirs(OUT, exist_ok=True)
    c = np.asarray(Image.open(os.path.join(RAW, "horizon-color.png")).convert("RGBA"), np.float32) / 255
    a = c[..., 3]
    rgb = bleed(c[..., :3].copy(), a, 12)
    rgba = np.concatenate([rgb, a[..., None]], -1)
    webp(Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA"), "color.webp", ["-q", "88", "-alpha_q", "100", "-exact"])
    d = np.asarray(Image.open(os.path.join(RAW, "horizon-dist.png")).convert("L"), np.float32) / 255
    # under the sky there is nothing: as far as can be (the colour there is transparent anyway)
    d = np.where(a > 0.01, d, 1.0)
    webp(Image.fromarray((d * 255 + 0.5).astype(np.uint8), "L"), "dist.webp", ["-q", "90"])


if __name__ == "__main__":
    main()
