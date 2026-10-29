"""Carved stone for the walk, sculpted as height fields: Konark's plinth frieze (beads, niches
of dancers and musicians between pilasters, an elephant procession, a scrolling creeper, lotus
petals) and the weathered khondalite ashlar of its walls. No photographs: every figure is
built from rounded limbs, beads and mouldings, then weathered with tileable noise.

Each set is written to public/sites/konark/tex/ as webp: <name>-albedo (cavities darkened),
<name>-normal (tangent space, same convention as src/engine/textures.ts) and <name>-height.
The frieze tiles horizontally (4:1, the builder's 'frieze' uv), the wall in both directions.

  tools/.venv-tts/bin/python tools/blender/relief.py [frieze wall carved] [--res 1024]
  blender -b -P tools/blender/relief_preview.py -- frieze      # a lit render, to judge it
"""
import argparse
import math
import os
import subprocess

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "sites", "konark", "tex")
RAW = os.path.join(ROOT, "tools", "blender", "out", "tex")


class Field:
    """A height field in band units (u right, v up), tileable across u (and v if wrap_v)."""

    def __init__(self, w_units, h_units, px, wrap_v=False):
        self.px = px  # pixels per unit
        self.W, self.H = int(w_units * px), int(h_units * px)
        self.pad = int(0.25 * px)
        self.wrap_v = wrap_v
        P = self.pad
        self.h = np.zeros((self.H + 2 * P, self.W + 2 * P), np.float32)

    def window(self, x0, y0, x1, y1):
        """Pixel window (padded canvas) for a unit-space box, and the unit coords of its pixels."""
        P, px = self.pad, self.px
        c0, c1 = int(math.floor(x0 * px)) + P - 1, int(math.ceil(x1 * px)) + P + 2
        # rows run down: v=H at row 0
        r0, r1 = int(math.floor((self.H / px - y1) * px)) + P - 1, int(math.ceil((self.H / px - y0) * px)) + P + 2
        c0, r0 = max(c0, 0), max(r0, 0)
        c1, r1 = min(c1, self.h.shape[1]), min(r1, self.h.shape[0])
        if c1 <= c0 or r1 <= r0:
            return None
        xs = (np.arange(c0, c1) - P + 0.5) / px
        ys = self.H / px - (np.arange(r0, r1) - P + 0.5) / px
        X, Y = np.meshgrid(xs, ys)
        return (slice(r0, r1), slice(c0, c1)), X.astype(np.float32), Y.astype(np.float32)

    def put(self, box, fn):
        w = self.window(*box)
        if w is None:
            return
        sl, X, Y = w
        v = fn(X, Y)
        np.maximum(self.h[sl], v, out=self.h[sl])

    def finish(self):
        """Fold the padding back across the seams (max) and crop to the tile."""
        P, h = self.pad, self.h
        h[:, P:2 * P] = np.maximum(h[:, P:2 * P], h[:, -P:])
        h[:, -2 * P:-P] = np.maximum(h[:, -2 * P:-P], h[:, :P])
        if self.wrap_v:
            h[P:2 * P, :] = np.maximum(h[P:2 * P, :], h[-P:, :])
            h[-2 * P:-P, :] = np.maximum(h[-2 * P:-P, :], h[:P, :])
        return h[P:-P, P:-P].copy()


# ---------------------------------------------------------------- sculpting primitives
# every primitive raises the surface to base + amp × a rounded profile; overlapping parts keep
# the higher, so limbs in front simply stand proud of those behind

def cap(F, x1, y1, x2, y2, r1, r2=None, base=0.0, amp=0.02):
    """A tapered limb: round in section."""
    r2 = r1 if r2 is None else r2
    m = max(r1, r2)
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy + 1e-12

    def fn(X, Y):
        t = np.clip(((X - x1) * dx + (Y - y1) * dy) / L2, 0, 1)
        q = np.hypot(X - (x1 + t * dx), Y - (y1 + t * dy))
        r = r1 + (r2 - r1) * t
        return np.where(q < r, base + amp * np.sqrt(np.clip(1 - (q / r) ** 2, 0, 1)), 0)

    F.put((min(x1, x2) - m, min(y1, y2) - m, max(x1, x2) + m, max(y1, y2) + m), fn)


def ball(F, cx, cy, rx, ry=None, base=0.0, amp=0.02, rot=0.0):
    ry = rx if ry is None else ry
    c, s = math.cos(rot), math.sin(rot)
    m = max(rx, ry)

    def fn(X, Y):
        x, y = X - cx, Y - cy
        a, b = (x * c + y * s) / rx, (-x * s + y * c) / ry
        d = a * a + b * b
        return np.where(d < 1, base + amp * np.sqrt(np.clip(1 - d, 0, 1)), 0)

    F.put((cx - m, cy - m, cx + m, cy + m), fn)


def slab(F, x0, y0, x1, y1, base, amp, edge, rough=0.0, seed=0):
    """A flat-topped block with rounded (worn) edges; rough > 0 chips the edges."""
    rng = np.random.default_rng(seed)
    ph = rng.uniform(0, 100, 4)

    def fn(X, Y):
        dx = np.minimum(X - x0, x1 - X)
        dy = np.minimum(Y - y0, y1 - Y)
        d = np.minimum(dx, dy)
        if rough:
            d = d - rough * (0.5 + 0.5 * np.sin(X * 37 + ph[0]) * np.sin(Y * 41 + ph[1]) + 0.5 * np.sin(X * 113 + Y * 97 + ph[2]))
        t = np.clip(d / edge, 0, 1)
        prof = np.sin(t * math.pi / 2)
        return np.where(d > 0, base + amp * prof, 0)

    F.put((x0, y0, x1, y1), fn)


def band(F, y0, y1, base, amp, shape="round"):
    """A horizontal moulding across the whole width."""

    def fn(X, Y):
        t = (Y - y0) / (y1 - y0)
        if shape == "round":
            p = np.sqrt(np.clip(1 - (2 * t - 1) ** 2, 0, 1))
        elif shape == "flat":
            p = np.clip(np.minimum(t, 1 - t) * 8, 0, 1)
        else:  # 'cove': a hollow
            p = 1 - np.sqrt(np.clip(1 - (2 * t - 1) ** 2, 0, 1)) * 0.6
        return np.where((t >= 0) & (t <= 1), base + amp * p, 0)

    F.put((-0.3, y0, F.W / F.px + 0.3, y1), fn)


# ---------------------------------------------------------------- figures (feet at x, y; height s)

FULL = 1.3  # limb thickness: Odishan figures are full and rounded


def dancer(F, x, y, s, base, amp, pose=0, flip=False):
    k = -1 if flip else 1

    def P(px, py):
        return x + k * px * s, y + py * s

    def C(a, b, r1, r2=None, lift=1.0):
        (x1, y1), (x2, y2) = P(*a), P(*b)
        cap(F, x1, y1, x2, y2, r1 * s * FULL, (r2 or r1) * s * FULL, base, amp * lift)

    def B(c, rx, ry=None, lift=1.0, rot=0.0):
        cx, cy = P(*c)
        ball(F, cx, cy, rx * s * FULL, (ry or rx) * s * FULL, base, amp * lift, rot * k)

    # tribhanga: hips one way, chest the other, head tilted back
    hip, chest, head = (-0.03, 0.55), (0.03, 0.74), (0.0, 0.885)
    if pose == 0:  # dancer, one leg crossed, an arm raised
        C((-0.07, 0.52), (-0.05, 0.29), 0.06, 0.045)
        C((-0.05, 0.29), (-0.07, 0.04), 0.045, 0.03)
        C((0.01, 0.52), (0.11, 0.32), 0.058, 0.042, 1.08)
        C((0.11, 0.32), (0.0, 0.06), 0.042, 0.028, 1.1)
        arms = [((0.09, 0.79), (0.18, 0.88), (0.12, 1.0)), ((-0.05, 0.79), (-0.15, 0.68), (-0.05, 0.59))]
    elif pose == 1:  # drummer: a drum held across the waist
        C((-0.07, 0.52), (-0.08, 0.28), 0.06, 0.045)
        C((-0.08, 0.28), (-0.09, 0.04), 0.045, 0.03)
        C((0.03, 0.52), (0.07, 0.28), 0.058, 0.044)
        C((0.07, 0.28), (0.08, 0.04), 0.044, 0.03)
        arms = [((0.09, 0.79), (0.16, 0.66), (0.19, 0.55)), ((-0.06, 0.79), (-0.15, 0.67), (-0.16, 0.55))]
    elif pose == 2:  # cymbals raised before the face
        C((-0.06, 0.52), (-0.04, 0.29), 0.06, 0.045)
        C((-0.04, 0.29), (-0.08, 0.05), 0.045, 0.03)
        C((0.02, 0.52), (0.12, 0.36), 0.058, 0.042, 1.06)
        C((0.12, 0.36), (0.16, 0.1), 0.042, 0.028, 1.08)
        arms = [((0.09, 0.79), (0.18, 0.74), (0.12, 0.86)), ((-0.05, 0.79), (-0.12, 0.72), (-0.05, 0.86))]
    elif pose == 4:  # flute player: legs crossed, the flute held out to one side
        C((-0.07, 0.52), (-0.05, 0.29), 0.06, 0.045)
        C((-0.05, 0.29), (-0.07, 0.04), 0.045, 0.03)
        C((0.01, 0.52), (0.1, 0.3), 0.058, 0.042, 1.08)
        C((0.1, 0.3), (-0.02, 0.07), 0.042, 0.028, 1.1)
        arms = [((0.09, 0.79), (0.17, 0.72), (0.22, 0.83)), ((-0.05, 0.79), (-0.03, 0.7), (0.08, 0.84))]
    elif pose == 5:  # a lady with a mirror, the other hand on her hip
        C((-0.08, 0.52), (-0.07, 0.29), 0.06, 0.045)
        C((-0.07, 0.29), (-0.09, 0.04), 0.045, 0.03)
        C((0.02, 0.52), (0.06, 0.29), 0.058, 0.044)
        C((0.06, 0.29), (0.1, 0.05), 0.044, 0.03)
        arms = [((0.09, 0.79), (0.19, 0.82), (0.15, 0.95)), ((-0.05, 0.79), (-0.15, 0.68), (-0.11, 0.58))]
    elif pose == 6:  # vina player: the long instrument across the body
        C((-0.07, 0.52), (-0.08, 0.28), 0.06, 0.045)
        C((-0.08, 0.28), (-0.09, 0.04), 0.045, 0.03)
        C((0.03, 0.52), (0.07, 0.28), 0.058, 0.044)
        C((0.07, 0.28), (0.08, 0.04), 0.044, 0.03)
        arms = [((0.09, 0.79), (0.15, 0.68), (0.08, 0.66)), ((-0.05, 0.79), (-0.1, 0.86), (0.0, 0.84))]
    elif pose == 7:  # attendant with a fly-whisk raised
        C((-0.06, 0.52), (-0.05, 0.29), 0.06, 0.045)
        C((-0.05, 0.29), (-0.06, 0.04), 0.045, 0.03)
        C((0.02, 0.52), (0.05, 0.29), 0.058, 0.044)
        C((0.05, 0.29), (0.06, 0.04), 0.044, 0.03)
        arms = [((0.09, 0.79), (0.18, 0.84), (0.2, 0.97)), ((-0.05, 0.79), (-0.11, 0.66), (-0.1, 0.52))]
    else:  # both arms in a wide dance gesture
        C((-0.05, 0.52), (-0.13, 0.32), 0.06, 0.045, 1.05)
        C((-0.13, 0.32), (-0.06, 0.06), 0.045, 0.03, 1.08)
        C((0.03, 0.52), (0.04, 0.29), 0.058, 0.044)
        C((0.04, 0.29), (0.05, 0.04), 0.044, 0.03)
        arms = [((0.09, 0.79), (0.2, 0.83), (0.27, 0.92)), ((-0.05, 0.79), (-0.16, 0.86), (-0.22, 0.97))]
    # feet
    B((-0.07, 0.035), 0.05, 0.022)
    # skirt: a flared drape over the thighs, carved lower than the legs it covers
    C(hip, (-0.02, 0.36), 0.12, 0.15, 0.82)
    B(hip, 0.13, 0.09, 1.05)
    # girdle of beads
    for i in range(9):
        a = math.pi * (1.1 + 0.8 * i / 8)
        B((hip[0] + math.cos(a) * 0.13, hip[1] + 0.03 + math.sin(a) * 0.05), 0.016, lift=1.25)
    C(hip, chest, 0.085, 0.1, 1.02)
    B((chest[0] - 0.035, chest[1] - 0.015), 0.045, lift=1.18)
    B((chest[0] + 0.045, chest[1] - 0.015), 0.045, lift=1.18)
    C(chest, (0.015, 0.84), 0.035, lift=1.0)
    B(head, 0.068, 0.078, 1.15)
    # tall crown with a row of beads and a finial
    C((0.0, 0.94), (-0.01, 1.03), 0.058, 0.03, 1.05)
    B((-0.012, 1.05), 0.025, lift=1.1)
    for i in range(5):
        B((-0.05 + i * 0.025, 0.945), 0.012, lift=1.25)
    # earrings
    B((0.06, 0.86), 0.018, lift=1.2)
    # necklace
    for i in range(9):
        a = math.pi * (1.15 + 0.7 * i / 8)
        B((chest[0] + math.cos(a) * 0.08, chest[1] + 0.07 + math.sin(a) * 0.05), 0.012, lift=1.3)
    for sh, el, hd in arms:
        C(sh, el, 0.036, 0.03, 1.12)
        C(el, hd, 0.03, 0.022, 1.16)
        B(hd, 0.026, lift=1.18)
        B(((el[0] + hd[0]) / 2 * 0.3 + hd[0] * 0.7, (el[1] + hd[1]) / 2 * 0.3 + hd[1] * 0.7), 0.024, 0.016, 1.24)  # bangle
    if pose == 1:
        B((0.015, 0.55), 0.19, 0.075, 1.35)  # drum
        for dxx in (-0.17, 0.2):
            B((dxx, 0.55), 0.03, 0.07, 1.4)
    if pose == 2:
        for c in ((0.12, 0.88), (-0.05, 0.88)):
            B(c, 0.05, 0.05, 1.3)
    if pose == 4:
        C((-0.04, 0.85), (0.32, 0.8), 0.012, 0.01, 1.45)  # flute
    if pose == 5:
        B((0.15, 0.99), 0.055, 0.06, 1.3)  # mirror
    if pose == 6:
        C((-0.2, 0.46), (0.22, 0.98), 0.016, 0.014, 1.42)  # vina
        B((-0.18, 0.49), 0.06, 0.06, 1.38)
        B((0.2, 0.94), 0.05, 0.05, 1.38)
    if pose == 7:
        C((0.2, 0.97), (0.24, 1.08), 0.012, None, 1.35)  # whisk handle and plume
        B((0.26, 1.14), 0.04, 0.07, 1.25, rot=-0.3)
    # anklets
    B((-0.07, 0.08), 0.034, 0.018, 1.2)


def couple(F, x, y, s, base, amp, seed=0):
    """Mithuna: a couple leaning together, his arm about her shoulders."""
    dancer(F, x - 0.045 * s / 0.31, y, s * 1.04, base, amp * 0.92, pose=7, flip=False)
    dancer(F, x + 0.05 * s / 0.31, y, s * 0.96, base, amp, pose=5, flip=True)


def horse_r(F, x, y, s, base, amp, flip=False, rider=True, phase=0.0):
    """A horse at the gallop (from the side), with or without a rider."""
    k = -1 if flip else 1

    def P(px, py):
        return x + k * px * s, y + py * s

    def C(a, b, r1, r2=None, lift=1.0):
        (x1, y1), (x2, y2) = P(*a), P(*b)
        cap(F, x1, y1, x2, y2, r1 * s * 1.3, (r2 or r1) * s * 1.3, base, amp * lift)

    def B(c, rx, ry=None, lift=1.0, rot=0.0):
        cx, cy = P(*c)
        ball(F, cx, cy, rx * s * 1.12, (ry or rx) * s * 1.25, base, amp * lift, rot * k)

    sw = math.sin(phase)
    # legs: hind pair pushing back, fore pair reaching (far legs carved lower)
    for (hx, fx), lift in (((-0.42, 0.38), 0.8), ((-0.36, 0.44), 1.0)):
        C((hx, 0.45), (hx - 0.12 - 0.04 * sw, 0.24), 0.07, 0.045, lift)
        C((hx - 0.12 - 0.04 * sw, 0.24), (hx - 0.2, 0.04), 0.04, 0.03, lift)
        C((fx, 0.45), (fx + 0.16 + 0.04 * sw, 0.3), 0.06, 0.04, lift)
        C((fx + 0.16 + 0.04 * sw, 0.3), (fx + 0.14, 0.08), 0.035, 0.028, lift)
    B((0.0, 0.55), 0.5, 0.2, 1.0)
    B((-0.3, 0.55), 0.22, 0.2, 1.02)
    C((0.36, 0.62), (0.56, 0.86), 0.13, 0.08, 1.06)  # neck
    C((0.56, 0.88), (0.74, 0.74), 0.07, 0.045, 1.12)  # head
    B((0.55, 0.96), 0.03, 0.05, 1.15)  # ear
    C((0.38, 0.8), (0.52, 0.94), 0.03, 0.02, 1.18)  # mane
    C((-0.5, 0.6), (-0.66, 0.36), 0.05, 0.02, 0.95)  # tail
    for i in range(6):
        B((0.38 + i * 0.03, 0.66 + i * 0.04), 0.018, lift=1.25)  # bridle beads
    if rider:
        B((-0.02, 0.74), 0.16, 0.06, 1.15)  # saddle cloth
        C((-0.02, 0.75), (0.02, 1.02), 0.075, 0.065, 1.25)  # torso
        B((0.04, 1.11), 0.065, 0.075, 1.3)  # head
        C((0.04, 1.16), (0.03, 1.24), 0.05, 0.025, 1.25)  # helmet
        C((-0.04, 0.77), (0.1, 0.56), 0.05, 0.035, 1.3)  # leg
        C((0.05, 0.96), (0.2, 0.86), 0.03, 0.025, 1.32)  # rein arm
        C((-0.02, 0.98), (-0.12, 1.12), 0.03, 0.025, 1.32)  # sword arm
        C((-0.12, 1.12), (-0.02, 1.32), 0.015, 0.01, 1.35)  # sword


def hamsa(F, x, y, s, base, amp, flip=False):
    """A goose (hamsa), wings folded, neck curved, with a lotus bud in its beak."""
    k = -1 if flip else 1

    def P(px, py):
        return x + k * px * s, y + py * s

    def C(a, b, r1, r2=None, lift=1.0):
        (x1, y1), (x2, y2) = P(*a), P(*b)
        cap(F, x1, y1, x2, y2, r1 * s, (r2 or r1) * s, base, amp * lift)

    def B(c, rx, ry=None, lift=1.0, rot=0.0):
        cx, cy = P(*c)
        ball(F, cx, cy, rx * s, (ry or rx) * s, base, amp * lift, rot * k)

    B((0.0, 0.32), 0.42, 0.22, 1.0, rot=0.12)
    B((-0.06, 0.38), 0.3, 0.14, 1.12, rot=0.2)  # folded wing
    for i in range(4):
        C((-0.28 + i * 0.07, 0.4), (-0.18 + i * 0.07, 0.3), 0.012, None, 1.2)  # feathers
    C((-0.36, 0.38), (-0.56, 0.56), 0.06, 0.02, 1.05)  # tail
    C((0.3, 0.42), (0.42, 0.7), 0.07, 0.05, 1.08)  # neck
    C((0.42, 0.7), (0.36, 0.92), 0.05, 0.045, 1.08)
    B((0.4, 0.95), 0.07, 0.06, 1.14)  # head
    C((0.45, 0.94), (0.58, 0.9), 0.025, 0.012, 1.18)  # beak
    B((0.63, 0.86), 0.04, 0.06, 1.2)  # lotus bud
    C((0.2, 0.12), (0.26, -0.02), 0.025, None, 0.9)  # leg


def elephant(F, x, y, s, base, amp, flip=False):
    k = -1 if flip else 1

    def P(px, py):
        return x + k * px * s, y + py * s

    def C(a, b, r1, r2=None, lift=1.0):
        (x1, y1), (x2, y2) = P(*a), P(*b)
        cap(F, x1, y1, x2, y2, r1 * s, (r2 or r1) * s, base, amp * lift)

    def B(c, rx, ry=None, lift=1.0, rot=0.0):
        cx, cy = P(*c)
        ball(F, cx, cy, rx * s, (ry or rx) * s, base, amp * lift, rot * k)

    # legs (far pair lower), body, head, trunk curling down, ear, tusk, a saddle cloth
    for lx, lift in ((-0.42, 0.8), (0.3, 0.8), (-0.32, 1.0), (0.4, 1.0)):
        C((lx, 0.45), (lx + 0.02, 0.04), 0.09, 0.08, lift)
    B((-0.02, 0.62), 0.58, 0.34, 1.0)
    B((0.55, 0.7), 0.24, 0.26, 1.08)
    C((0.7, 0.62), (0.78, 0.35), 0.08, 0.06, 1.15)
    C((0.78, 0.35), (0.74, 0.12), 0.06, 0.04, 1.15)
    C((0.74, 0.12), (0.66, 0.1), 0.04, 0.035, 1.15)
    B((0.47, 0.66), 0.13, 0.19, 1.22, rot=0.2)
    C((0.66, 0.5), (0.86, 0.46), 0.03, 0.012, 1.3)
    C((-0.58, 0.72), (-0.66, 0.35), 0.025, 0.015, 0.9)
    B((-0.05, 0.86), 0.3, 0.1, 1.12)
    for i in range(7):
        B((-0.3 + i * 0.09, 0.78), 0.022, lift=1.3)


def scroll(F, x0, x1, y, amp_y, wl, base, amp, s):
    """A scrolling creeper: a wavy stem, a curl in every hollow, and leaves."""
    n = int((x1 - x0) / wl)
    steps = 160 * n
    pts = [(x0 + (x1 - x0) * i / steps, y + amp_y * math.sin((i / steps) * n * math.tau)) for i in range(steps + 1)]
    for (a, b), (c, d) in zip(pts, pts[1:]):
        cap(F, a, b, c, d, 0.011 * s, None, base, amp * 0.9)
    for i in range(n * 2):
        cx = x0 + (i + 0.5) * wl / 2
        up = 1 if i % 2 == 0 else -1
        cy = y - up * amp_y * 0.35
        # a spiral curl: beads of shrinking radius around a centre
        for j in range(26):
            t = j / 25
            a = up * (math.pi / 2 + t * math.tau * 1.15)
            r = amp_y * 0.7 * (1 - t * 0.75)
            ball(F, cx + math.cos(a) * r * 0.9, cy + math.sin(a) * r, 0.012 * s * (1 - t * 0.4), None, base, amp * 1.05)
        # two leaves off the stem
        for side in (-1, 1):
            lx = cx + side * wl * 0.14
            ball(F, lx, y + up * amp_y * 0.55, wl * 0.08, amp_y * 0.22, base, amp * 0.95, rot=side * up * 0.8)


def petals(F, x0, x1, y0, y1, n, base, amp):
    """Two rows of lotus petals, pointing up: broad and round at the root, tapering to a tip."""
    w = (x1 - x0) / n
    hgt = y1 - y0
    for i in range(n + 1):
        cx = x0 + i * w
        cx2 = cx + w / 2
        cap(F, cx2, y0 + hgt * 0.25, cx2, y1 - hgt * 0.22, w * 0.3, w * 0.08, base, amp * 0.65)
        cap(F, cx, y0 + hgt * 0.3, cx, y1 - hgt * 0.06, w * 0.34, w * 0.07, base, amp)
        cap(F, cx, y0 + hgt * 0.35, cx, y1 - hgt * 0.12, w * 0.07, w * 0.03, base, amp * 1.2)


def beads(F, x0, x1, y, r, base, amp, gap=2.4):
    n = int((x1 - x0) / (r * gap))
    for i in range(n):
        ball(F, x0 + (i + 0.5) * (x1 - x0) / n, y, r, None, base, amp)


# ---------------------------------------------------------------- noise (periodic, so it tiles)

def fbm(shape, seed, beta=2.0, lo=2.0, aspect=(1.0, 1.0)):
    rng = np.random.default_rng(seed)
    H, W = shape
    fy = np.fft.fftfreq(H)[:, None] * H / aspect[1]
    fx = np.fft.rfftfreq(W)[None, :] * W / aspect[0]
    f = np.sqrt(fx * fx + fy * fy)
    spec = np.fft.rfft2(rng.standard_normal(shape))
    spec *= np.where(f < lo, 0, 1) / np.maximum(f, 1) ** (beta / 2)
    n = np.fft.irfft2(spec, s=shape)
    return (n - n.mean()) / (n.std() + 1e-9)


def blur(a, sigma_px):
    H, W = a.shape
    fy = np.fft.fftfreq(H)[:, None]
    fx = np.fft.rfftfreq(W)[None, :]
    g = np.exp(-2 * (math.pi * sigma_px) ** 2 * (fx * fx + fy * fy))
    return np.fft.irfft2(np.fft.rfft2(a) * g, s=a.shape)


# ---------------------------------------------------------------- finishing

def weather(h, px, seed, depth):
    """Wear the carving: soften it, pit it, grain it; returns the new height and an exposure map."""
    soft = blur(h, px * 0.0035)
    grain = fbm(h.shape, seed, 1.6, lo=40) * depth * 0.012
    mid = fbm(h.shape, seed + 1, 3.2, lo=6) * depth * 0.05
    pits = np.clip(fbm(h.shape, seed + 2, 1.2, lo=60) - 2.4, 0, None) * depth * 0.25
    return soft + grain + mid - pits


def cavity(h, px, depth):
    """Ambient occlusion of a height field, approximated at several radii (tileable)."""
    ao = np.zeros_like(h)
    for r, w in ((0.004, 0.12), (0.012, 0.4), (0.035, 0.48)):
        d = blur(h, px * r) - h
        ao += w * np.clip(d / (depth * 0.3), 0, 1)
    return np.clip(1 - ao * 1.6, 0, 1)


def normal_map(h, px, scale=1.0):
    # height and position share units, so the gradient is the true slope
    gx = (np.roll(h, 1, 1) - np.roll(h, -1, 1)) * px / 2 * scale
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * px / 2 * scale
    n = np.stack([gx, gy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def albedo(h, ao, seed, palette, depth):
    lo = fbm(h.shape, seed + 10, 2.6, lo=1.5)
    mid = fbm(h.shape, seed + 11, 3.0, lo=8)
    streak = np.clip(fbm(h.shape, seed + 12, 2.2, lo=2, aspect=(4.0, 0.25)) - 0.4, 0, None)
    base, alt, dark, grime = (np.array(c, np.float32) / 255 for c in palette)
    t = np.clip(0.5 + 0.28 * lo + 0.12 * mid, 0, 1)[..., None]
    c = base * (1 - t) + alt * t
    # grey-green patches (lichen) and darker streaks running down from ledges
    lich = np.clip(fbm(h.shape, seed + 13, 3.6, lo=2) - 1.0, 0, 1)[..., None] * 0.45
    c = c * (1 - lich) + grime * lich
    c = c * (1 - 0.16 * np.clip(streak, 0, 1)[..., None])
    # raised edges catch light and wear pale; hollows hold dirt
    edge = np.clip((h - blur(h, h.shape[0] * 0.004)) / (depth * 0.05), 0, 1)[..., None]
    c = c * (1 + 0.14 * edge)
    a = ao[..., None]
    c = c * (0.5 + 0.5 * a) * (1 - 0.18 * (1 - a)) + dark * (1 - a) * 0.12
    return np.clip(c, 0, 1)


def save(name, h, px, depth, palette, seed, nscale=1.0):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    ao = cavity(h, px, depth)
    alb = albedo(h, ao, seed, palette, depth)
    nrm = normal_map(h, px, nscale)
    hn = (h - h.min()) / (h.max() - h.min() + 1e-9)
    files = {
        "albedo": Image.fromarray((alb ** (1 / 1.0) * 255 + 0.5).astype(np.uint8)),
        "normal": Image.fromarray((nrm * 255 + 0.5).astype(np.uint8)),
        "height": Image.fromarray((hn * 255 + 0.5).astype(np.uint8)),
    }
    for k, im in files.items():
        png = os.path.join(RAW, f"{name}-{k}.png")
        im.save(png)
        q = "92" if k == "albedo" else "95"
        subprocess.run(["cwebp", "-quiet", "-q", q, *(["-exact"] if k != "albedo" else []), png, "-o", os.path.join(OUT, f"{name}-{k}.webp")], check=True)
    # a 16-bit height for the Blender preview
    Image.fromarray((hn * 65535).astype(np.uint16)).save(os.path.join(RAW, f"{name}-height16.png"))
    print(name, h.shape, "->", OUT)


KHONDALITE = ((150, 128, 102), (186, 160, 128), (52, 40, 30), (110, 112, 96))


# ---------------------------------------------------------------- the sets

# the four frieze designs: which figures stand in the niches, and what walks along the band below
VARIANTS = [
    {"niche": [0, 1, 2, 3], "band": "elephants"},
    {"niche": ["couple", 7, "couple", 5], "band": "riders"},
    {"niche": [4, 6, 1, 2], "band": "geese"},
    {"niche": [5, 3, 7, 0], "band": "hunt"},
]


def frieze_variant(px, v):
    """One design, 4 × 1 units (the builder's 'frieze' uv): one unit is the band's height."""
    V = VARIANTS[v]
    F = Field(4, 1, px)
    D = FRIEZE_D
    band(F, 0.0, 0.05, 0.0, D * 0.6, "flat")
    petals(F, 0, 4, 0.05, 0.17, 24, D * 0.25, D * 0.55)
    band(F, 0.17, 0.2, D * 0.2, D * 0.45, "round")
    # a procession on a sunk ground
    band(F, 0.2, 0.36, 0.0, D * 0.15, "flat")
    for i in range(8):
        x = 0.25 + i * 0.5
        flip = (i // 2) % 2 == 1
        kind = V["band"] if V["band"] != "hunt" else ("elephants" if i % 2 == 0 else "riders")
        if kind == "elephants":
            elephant(F, x, 0.215, 0.14, D * 0.15, D * 0.75, flip=flip)
        elif kind == "riders":
            horse_r(F, x - 0.02, 0.205, 0.135, D * 0.15, D * 0.75, flip=flip, phase=i * 1.3)
        else:
            hamsa(F, x - 0.06, 0.225, 0.13, D * 0.15, D * 0.75, flip=flip)
            hamsa(F, x + 0.09, 0.225, 0.12, D * 0.15, D * 0.7, flip=not flip)
    band(F, 0.36, 0.39, D * 0.25, D * 0.5, "round")
    # the niche band: 8 niches, each a figure between pilasters (the tile's edges fall on pilasters)
    band(F, 0.39, 0.83, 0.0, D * 0.1, "flat")
    for i in range(8):
        x = i * 0.5
        # pilasters, with a stepped capital
        for px_ in (x + 0.03, x + 0.47):
            slab(F, px_ - 0.025, 0.39, px_ + 0.025, 0.8, D * 0.1, D * 0.55, 0.008, 0.002, seed=i)
            for j in range(5):
                cap(F, px_ - 0.022, 0.43 + j * 0.08, px_ + 0.022, 0.43 + j * 0.08, 0.006, None, D * 0.55, D * 0.25)
            slab(F, px_ - 0.04, 0.78, px_ + 0.04, 0.81, D * 0.4, D * 0.35, 0.006)
        # the niche: sunk ground under a cusped arch, a stepped roof (pidha) and a finial above
        slab(F, x + 0.065, 0.4, x + 0.435, 0.72, D * 0.02, D * 0.08, 0.01)
        for j in range(7):
            a = math.pi * (j + 0.5) / 7
            ball(F, x + 0.25 + math.cos(a) * 0.16, 0.705 + math.sin(a) * 0.025, 0.028, 0.018, D * 0.2, D * 0.4)
        for j in range(4):
            y = 0.735 + j * 0.02
            slab(F, x + 0.1 + j * 0.03, y, x + 0.4 - j * 0.03, y + 0.016, D * 0.2, D * (0.5 + 0.05 * j), 0.005)
        ball(F, x + 0.25, 0.817, 0.026, 0.014, D * 0.5, D * 0.5)
        who = V["niche"][i % 4]
        if who == "couple":
            couple(F, x + 0.25, 0.41, 0.29, D * 0.1, D * 0.95)
        else:
            dancer(F, x + 0.25, 0.41, 0.31 if who not in (6, 7) else 0.29, D * 0.1, D * 0.95, pose=who, flip=i % 2 == 1)
    band(F, 0.83, 0.87, D * 0.3, D * 0.55, "round")
    scroll(F, 0, 4, 0.91, 0.022, 0.25, D * 0.15, D * 0.45, 1.0)
    band(F, 0.87, 0.95, 0.0, D * 0.12, "flat")
    beads(F, 0, 4, 0.97, 0.016, D * 0.25, D * 0.4)
    band(F, 0.95, 1.0, 0.0, D * 0.2, "flat")
    return weather(F.finish(), px, 7 + v, D)


FRIEZE_D = 0.06  # relief depth, in band heights


def frieze(px):
    """The four designs stacked in one atlas (rows top to bottom: 0..3); the walk picks one per tile."""
    h = np.concatenate([frieze_variant(px, v) for v in range(len(VARIANTS))], 0)
    save("frieze", h, px, FRIEZE_D, KHONDALITE, 7)


def wall(px):
    """2 × 2 units = 2 m (the builder's world uv, tile 2): four courses of ashlar."""
    F = Field(2, 2, px, wrap_v=True)
    D = 0.05
    rng = np.random.default_rng(3)
    for row in range(4):
        y0 = row * 0.5
        x = rng.uniform(0, 0.4)
        while x < 2 + 0.01:
            w = rng.uniform(0.55, 1.15)
            x1 = min(x + w, x + 2)
            lift = rng.uniform(0.8, 1.0)
            slab(F, x + 0.006, y0 + 0.006, x1 - 0.006, y0 + 0.494, 0, D * lift, 0.03, 0.006, seed=row * 50 + int(x * 10))
            # copy blocks crossing the seam (Field folds the padding back)
            x = x1
    h = F.finish()
    # broad undulation of each face, then weathering
    h = h + np.where(h > 0, fbm(h.shape, 31, 2.4, lo=3) * D * 0.12, 0)
    h = weather(h, px, 21, D * 0.7)
    save("wall", h, px, D, KHONDALITE, 21, 1.0)


PATH = ((196, 158, 126), (220, 186, 152), (90, 66, 48), (150, 140, 110))


def paving(px):
    """3.6 × 3.6 m (the paths' world uv): courses of laterite flags of mixed lengths, worn smooth
    and pale by feet, chipped at the corners, with dark joints."""
    F = Field(3.6, 3.6, px, wrap_v=True)
    D = 0.03
    rng = np.random.default_rng(11)
    y = 0.0
    while y < 3.6 - 0.01:
        h = 3.6 / 6
        x = rng.uniform(0, 0.6)
        while x < 3.6 + 0.01:
            w = rng.uniform(0.5, 1.1)
            slab(F, x + 0.008, y + 0.008, x + w - 0.008, y + h - 0.008, 0, D * rng.uniform(0.75, 1.0), 0.04, 0.008, seed=int(x * 100 + y * 10))
            x += w
        y += h
    h = F.finish()
    h = h + np.where(h > 0, fbm(h.shape, 51, 2.8, lo=2) * D * 0.15, 0)
    h = weather(h, px, 51, D * 0.8)
    save("paving", h, px, D, PATH, 51)


def carved(px):
    """Dressed stone for the sculpture: no joints; chisel tooling, pitting, streaks. 1 × 1 m."""
    F = Field(1, 1, px, wrap_v=True)
    h = F.finish()
    D = 0.02
    tool = np.abs(np.sin((np.arange(h.shape[1])[None, :] / px * 90) + fbm(h.shape, 41, 2.6, lo=2) * 2)) * D * 0.08
    h = h + tool
    h = weather(h, px, 41, D)
    save("carved", h, px, D, KHONDALITE, 41)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sets", nargs="*", default=["frieze", "wall", "carved", "paving"])
    ap.add_argument("--res", type=int, default=768, help="pixels per unit (frieze: per band height)")
    a = ap.parse_args()
    for s in a.sets:
        {"frieze": lambda: frieze(a.res), "wall": lambda: wall(a.res), "carved": lambda: carved(a.res), "paving": lambda: paving(a.res // 2)}[s]()


if __name__ == "__main__":
    main()
