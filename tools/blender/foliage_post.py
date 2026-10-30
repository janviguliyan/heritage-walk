"""Turn foliage.py's raw renders into the site's textures (public/foliage/ and the lawn into
public/sites/konark/tex/): colour bled out under transparent pixels (so mipmaps don't darken the
edges of leaves and blades), normal maps renormalised, then cwebp.

  tools/.venv-tts/bin/python tools/blender/foliage_post.py
"""
import os
import subprocess

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "tools", "blender", "out", "foliage")
FOL = os.path.join(ROOT, "public", "foliage")
TEX = os.path.join(ROOT, "public", "sites", "konark", "tex")


def load(name):
    return np.asarray(Image.open(os.path.join(RAW, name)).convert("RGBA"), np.float32) / 255


def bleed(rgb, a, steps=24):
    """Spread colour from covered pixels out into transparent ones."""
    rgb = rgb * (a[..., None] > 0.5)
    w = (a > 0.5).astype(np.float32)
    for _ in range(steps):
        s = np.zeros_like(rgb)
        n = np.zeros_like(w)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            s += np.roll(np.roll(rgb * w[..., None], dy, 0), dx, 1)
            n += np.roll(np.roll(w, dy, 0), dx, 1)
        grow = (w == 0) & (n > 0)
        rgb[grow] = s[grow] / n[grow][:, None]
        w = np.maximum(w, grow.astype(np.float32))
    # anything still empty: the mean colour
    rgb[w == 0] = rgb[w > 0].mean(0)
    return rgb


def normal(c, a=None):
    n = c[..., :3] * 2 - 1
    n[..., 2] = np.abs(n[..., 2])
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-6
    if a is not None:
        flat = np.array([0, 0, 1], np.float32)
        n = np.where(a[..., None] > 0.02, n, flat)
    return n * 0.5 + 0.5


def half(c):
    return np.asarray(Image.fromarray((c * 255 + 0.5).astype(np.uint8)).resize((c.shape[1] // 2, c.shape[0] // 2), Image.LANCZOS), np.float32) / 255


def save(arr, path, q, alpha=False):
    png = path.replace(".webp", ".png")
    mode = "RGBA" if alpha else "RGB"
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), mode).save(png)
    args = ["cwebp", "-quiet", "-q", str(q)] + (["-alpha_q", "100", "-exact"] if alpha else []) + [png, "-o", path]
    subprocess.run(args, check=True)
    os.remove(png)
    print(f"{os.path.relpath(path, ROOT)}: {os.path.getsize(path) // 1024} KB")


def main():
    os.makedirs(FOL, exist_ok=True)
    for name in ("leaf", "needle", "branchlet", "frond", "tuft"):
        c = load(f"{name}-albedo.png")
        a = c[..., 3]
        rgb = bleed(c[..., :3].copy(), a)
        save(np.concatenate([rgb, a[..., None]], -1), os.path.join(FOL, f"{name}-albedo.webp"), 90, True)
        if os.path.exists(os.path.join(RAW, f"{name}-normal.png")):
            n = normal(load(f"{name}-normal.png"), a)
            save(n, os.path.join(FOL, f"{name}-normal.webp"), 92)
        print(name, "mean colour (sRGB):", np.round(rgb[a > 0.5].mean(0), 3))
    # the lawn at 1024: 5 mm a pixel over its 5 m tile, plenty at eye height
    c = half(load("lawn-albedo.png"))
    save(c[..., :3], os.path.join(TEX, "lawn-albedo.webp"), 86)
    save(normal(half(normal(load("lawn-normal.png")))), os.path.join(TEX, "lawn-normal.webp"), 82)
    print("lawn mean colour (sRGB):", np.round(c[..., :3].reshape(-1, 3).mean(0), 3))


if __name__ == "__main__":
    main()
