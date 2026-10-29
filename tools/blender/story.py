"""The story of Konark as a paper-cut film, built and rendered in Blender (Cycles).

Six scenes, one per narrated line (reel-0..5). Each is rendered to its own clip in
public/sites/konark/story/scene-<n>.mp4, sized to the longest narration of that line across
the three languages (plus a hold), so the web player can lay any narration over it.

  blender -b -P tools/blender/story.py -- --shot 0 --still 40 --out /tmp/s0.png   # one frame
  blender -b -P tools/blender/story.py -- --shot 0 --render                         # the clip
  blender -b -P tools/blender/story.py -- --shot 0 --save /tmp/s0.blend             # to inspect
"""
import argparse
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
import paper as P  # noqa: E402
import figures as F  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FPS = 24


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P._mats.clear()


# ------------------------------------------------------------------ scene 0: dawn over the sea

def dawn(frames):
    """Long ago, on the coast of Odisha, people watched the sun rise out of the sea..."""
    P.stage(fps=FPS)
    P.backdrop("#161c4a", "#ff9a55", depth=2.4)
    # stars still out in the deep blue
    stars = P.group("stars", depth=2.2)
    rnd = random.Random(5)
    for k in range(26):
        x, y = rnd.uniform(-9, 9), rnd.uniform(3.4, 5.6)
        P.piece(f"star{k}", [P.star(x, y, rnd.uniform(0.05, 0.1), 0.02, 4, rnd.uniform(0, 1))], "#fff2c8", glow=1.5, parent=stars)
    # the sun, rising from behind the sea
    sun = P.group("sun", depth=1.6, at=(2.6, -1.4))
    P.piece("sun rays", [P.star(0, 0, 1.85, 1.3, 18)], "#f29a2e", glow=0.45, parent=sun)
    P.piece("sun rays 2", [P.star(0, 0, 1.55, 1.22, 26, math.pi / 26)], "#ffb340", depth=-0.02, glow=0.55, parent=sun)
    P.piece("sun disc", [P.circle(0, 0, 1.15, 96)] + [P.circle(math.cos(a) * 0.9, math.sin(a) * 0.9, 0.05, 16) for a in (i / 14 * math.tau for i in range(14))], "#ffc04a", depth=-0.04, glow=1.15, parent=sun)
    P.piece("sun face", [P.circle(0, 0, 0.72, 96), P.circle(0, 0, 0.66, 96)], "#ffe08a", depth=-0.06, glow=1.4, parent=sun)
    sl = bpy.data.lights.new("sunlight", "POINT")
    sl.energy = 900
    sl.color = (1.0, 0.6, 0.3)
    sl.shadow_soft_size = 1.2
    slo = bpy.data.objects.new("sunlight", sl)
    slo.parent = sun
    slo.location = (0, 0.5, 0)
    bpy.context.scene.collection.objects.link(slo)
    P.key(sun, 1, location=(2.6, 1.6, -2.1))
    P.key(sun, frames, location=(2.6, 1.6, 0.85))
    # clouds in three depths: far wisps, the main banks, a near drifting bank
    for j, (depth, rows, light, shade, speed) in enumerate([
        (2.0, [(-1.5, 2.2, 3.4, 0.35), (6.5, 2.6, 2.6, 0.3), (-6.8, 3.1, 2.2, 0.28)], "#f7a98c", "#b8687a", 0.4),
        (1.2, [(-4.8, 3.0, 4.2, 0.8), (4.9, 3.6, 3.0, 0.65), (0.4, 4.4, 2.6, 0.5)], "#ffc3a2", "#b56a78", 0.8),
        (0.4, [(-8.5, 1.4, 3.0, 0.55), (8.8, 2.0, 2.4, 0.5)], "#ffd0b0", "#a85e70", 1.3),
    ]):
        clouds = P.group(f"clouds{j}", depth=depth)
        for i, (cx, cy, w, h) in enumerate(rows):
            P.quilled_cloud(f"cloud{j}{i}", cx, cy, w, h, parent=clouds, color=light, shade=shade, seed=i + 3 + j)
        P.key(clouds, 1, location=(0.5 * speed, depth, 0))
        P.key(clouds, frames, location=(-0.5 * speed, depth, 0))
    # the coast to the left: a low headland of dunes and palms
    coast = P.group("coast", depth=0.95, at=(2.2, 0))
    P.piece("headland", [P.smooth([(-14, -1.2), (-14, -0.25), (-10, -0.05), (-7.4, -0.2), (-5.6, -0.42), (-4.6, -0.7), (-4.4, -1.2)], 8)], "#3b2a3a", parent=coast)
    for k, (x, h, lean) in enumerate([(-9.6, 1.5, 0.12), (-8.8, 1.2, -0.1), (-7.6, 1.35, 0.18), (-6.4, 0.9, -0.05)]):
        for m, o in enumerate(P.palm(x, -0.2, h, lean)):
            P.piece(f"palm{k}{m}", [o], "#2f2433", depth=-0.01, parent=coast)
    # the sea: five bands of card, foam on each crest, gold flecks on the sun's path
    cols = ["#4a7d93", "#3d7189", "#2e5d76", "#234960", "#173548"]
    for i, c in enumerate(cols):
        band = P.group(f"sea{i}", depth=0.8 - i * 0.42)
        y = -0.5 - i * 0.55
        amp, wl, ph = 0.13 + i * 0.03, 1.5 + i * 0.32, i * 0.37
        P.piece(f"sea{i}", [P.waves(-14, 14, y, -9, amp, wl, ph)], c, parent=band, translucency=0.3)
        foam = tuple(min(255, int(int(c[k:k + 2], 16) * 0.5 + 255 * 0.42)) for k in (1, 3, 5))
        P.piece(f"foam{i}", [P.wave_line(-14, 14, y + 0.004, amp, wl, ph, 0.045)], "#%02x%02x%02x" % foam, depth=-0.014, parent=band)
        rnd = random.Random(i)
        for k in range(3 + i):
            P.piece(f"fleck{i}{k}", [P.ellipse(2.6 + (k - (2 + i) / 2) * (0.42 + i * 0.12) + rnd.uniform(-0.15, 0.15), y - 0.22 - rnd.uniform(0, 0.22), 0.24 - i * 0.02, 0.04)], "#ffc65a", depth=-0.016, glow=1.2, parent=band)
        for f in range(1, frames + 1, 6):
            P.key(band, f, location=(math.sin(f / FPS * 0.5 + i * 1.3) * (0.1 + i * 0.05), 0.8 - i * 0.42, 0))
        if i == 1:
            # a fishing boat rides this band, heading out
            boat = P.group("boat", depth=-0.03, at=(-2.6, y - 0.08), parent=band)
            hull, mast, sail = P.boat(0, 0, 0.75)
            P.piece("sail", [sail], "#e8d2b0", parent=boat, translucency=0.55)
            P.piece("mast", [mast], "#3a2418", depth=-0.01, parent=boat)
            P.piece("hull", [hull], "#3a2418", depth=-0.02, parent=boat)
            P.piece("fisher", [P.capsule(-0.32, 0.08, -0.34, 0.42, 0.06), P.circle(-0.34, 0.5, 0.07, 16)][:1], "#2b1810", depth=-0.03, parent=boat)
            P.piece("fisher head", [P.circle(-0.34, 0.52, 0.07, 16)], "#2b1810", depth=-0.03, parent=boat)
            for f in range(1, frames + 1, 4):
                t = f / FPS
                P.key(boat, f, location=(-2.6 + t * 0.06, -0.03, y - 0.08 + math.sin(t * 1.6) * 0.04), rotation_euler=(0, math.sin(t * 1.3) * 0.04, 0))
    # in front, on the shore: a mother and child watching the sunrise
    shore = P.group("shore", depth=-1.6)
    P.piece("dune", [P.smooth([(-14, -6), (-14, -2.3), (-8, -2.1), (-4.6, -2.25), (-2.9, -2.6), (-1.9, -3.4), (-1.5, -6)], 8)], "#2a1a22", parent=shore)
    P.piece("mother", [P.woman(-4.3, -2.26, 1.0)], "#1e121a", depth=-0.02, parent=shore)
    P.piece("child", [P.child(-3.75, -2.32, 0.85)], "#1e121a", depth=-0.03, parent=shore)
    for m, o in enumerate(P.palm(-6.4, -2.2, 3.4, 0.18)):
        P.piece(f"fpalm{m}", [o], "#1a1018", depth=-0.04, parent=shore)
    for k, (bx, by, br) in enumerate([(-8.4, -2.2, 0.8), (-5.4, -2.3, 0.5)]):
        P.tissue_bush(f"bush{k}", bx, by, br, ["#140c14", "#1e1420", "#2a1c2a"], depth=-0.05 - k * 0.02, parent=shore, seed=k + 31)
    # birds crossing
    birds = P.group("birds", depth=0.2)
    for k, (bx, by, s) in enumerate([(0, 0, 0.22), (0.6, 0.3, 0.16), (1.2, -0.05, 0.19), (-0.7, 0.45, 0.14)]):
        pts = [(bx - s, by + s * 0.25), (bx - s * 0.45, by + s * 0.33), (bx, by - s * 0.05), (bx + s * 0.45, by + s * 0.33), (bx + s, by + s * 0.25), (bx + s * 0.45, by + s * 0.1), (bx, by - s * 0.22), (bx - s * 0.45, by + s * 0.1)]
        P.piece(f"bird{k}", [P.smooth(pts, 6)], "#2b1d2a", parent=birds)
    P.key(birds, 1, location=(-3.4, 0.2, 2.0))
    P.key(birds, frames, location=(2.2, 0.2, 2.7))
    # light: a soft warm key from the front, a cool fill from above, a rim from the sun's side
    P.area_light("key", (-4, -9, 6), (0, 0, 0), 2200, "#ffd6a8", size=8)
    P.area_light("fill", (5, -6, 9), (0, 0, 0), 500, "#b9c4ff", size=10)
    cam, aim, foc = P.camera((0, -15, 0.3), (0.3, 0, 0.3), lens=36, fstop=0.7, focus=(0.6, 0.0, 0.0))
    P.key(cam, 1, location=(-0.6, -15.8, 0.1))
    P.key(cam, frames, location=(0.4, -13.2, 0.45))
    P.key(aim, 1, location=(0.0, 0, 0.1))
    P.key(aim, frames, location=(0.6, 0, 0.4))


def sunburst(name, r, depth, at, glow=1.0):
    """A big sun with two rings of rays (root['rays'] and root['rays2'] turn against each other)."""
    root = P.group(name, depth=depth, at=at)
    rays = P.group(f"{name} rays", parent=root)
    P.piece(f"{name} r1", [P.star(0, 0, r * 1.62, r * 1.14, 16)], "#f29a2e", depth=0.04, glow=0.45 * glow, parent=rays)
    rays2 = P.group(f"{name} rays2", parent=root)
    P.piece(f"{name} r2", [P.star(0, 0, r * 1.38, r * 1.08, 24, math.pi / 24)], "#ffb340", depth=0.02, glow=0.6 * glow, parent=rays2)
    for i in range(20):
        a = i / 20 * math.tau
        P.piece(f"{name} petal{i}", [P.ellipse(math.cos(a) * r * 1.02, math.sin(a) * r * 1.02, r * 0.16, r * 0.09, a, 20)], "#ffa83a", depth=0.01, glow=0.7 * glow, parent=root)
    P.piece(f"{name} disc", [P.circle(0, 0, r, 96)] + [P.circle(math.cos(a) * r * 0.78, math.sin(a) * r * 0.78, r * 0.045, 16) for a in (i / 12 * math.tau for i in range(12))], "#ffc04a", glow=1.1 * glow, parent=root)
    P.piece(f"{name} face", [P.circle(0, 0, r * 0.62, 96), P.circle(0, 0, r * 0.56, 96)], "#ffe08a", depth=-0.01, glow=1.4 * glow, parent=root)
    root["rays"], root["rays2"] = rays.name, rays2.name
    return root


# ------------------------------------------------------------------ scene 1: the Sun's chariot

def chariot(frames):
    """Seven horses pull it through the clouds. Its great wheels turn the days, the months, and the seasons."""
    P.stage(fps=FPS)
    P.backdrop("#e98a34", "#b9462a", depth=2.6, glow=0.55)
    sun = sunburst("sun", 2.2, 2.0, (1.6, 1.6), glow=0.8)
    for f in (1, frames):
        P.key(bpy.data.objects[sun["rays"]], f, rotation_euler=(0, -f / FPS * 0.08, 0))
        P.key(bpy.data.objects[sun["rays2"]], f, rotation_euler=(0, f / FPS * 0.12, 0))
    sl = bpy.data.lights.new("sunlight", "POINT")
    sl.energy = 1400
    sl.color = (1.0, 0.75, 0.4)
    sl.shadow_soft_size = 2.0
    slo = bpy.data.objects.new("sunlight", sl)
    slo.location = (1.6, 1.2, 1.6)
    bpy.context.scene.collection.objects.link(slo)
    # clouds racing past: three depths, faster nearer the camera (the chariot flies right)
    for j, (depth, row_y, size, light, shade, speed) in enumerate([
        (1.5, 0.9, 0.9, "#fff0d8", "#f0c89a", 1.2), (0.95, -0.4, 1.1, "#fff8ec", "#f3d2a8", 2.2), (-0.9, -2.9, 1.3, "#fffbf3", "#f4dab6", 3.6)]):
        clouds = P.group(f"clouds{j}", depth=depth)
        # enough clouds to keep the sky filled for the whole flight past
        for i in range(int((speed * frames / FPS + 30) / 6.2) + 1):
            cx = -12 + i * 6.2 + (j * 1.7)
            cy = row_y + math.sin(i * 1.7 + j) * 0.5
            w = (3.8 + (i % 3) * 0.9) * size
            P.quilled_cloud(f"cl{j}{i}", cx, cy, w, size, parent=clouds, color=light, shade=shade, seed=i + j * 7)
        # steady drift (keys every few frames keep it linear under Bezier easing)
        for f in range(1, frames + 1, 8):
            P.key(clouds, f, location=(-speed * f / FPS, depth, 0))
        P.key(clouds, frames, location=(-speed * frames / FPS, depth, 0))
    # the chariot
    car = P.group("car", depth=0.45, at=(-2.9, -0.7))
    P.piece("lining", [P.rect(-1.25, 0.25, 2.4, 1.75)], "#5a1a22", depth=0.06, parent=car)
    F.surya("surya", parent=car, at=(0, -0.15), depth=0.03, scale=0.95)
    canopy = P.smooth([(-1.5, 2.0), (1.5, 2.0), (1.1, 2.35), (0.0, 2.75), (-1.1, 2.35)], 8)
    holes = [P.circle(-1.05 + i * 0.42, 2.28 + math.sin(i * 0.6) * 0.05, 0.05, 16) for i in range(6)]
    P.piece("canopy", [canopy] + holes, "#a8283a", parent=car)
    P.piece("scallops", [P.scallop_band(-1.5, 1.5, 2.02, 0.17, 9)], "#a8283a", depth=0.004, parent=car)
    P.piece("canopy trim", [P.rect(-1.55, 1.98, 3.1, 0.07)], "#e8b04a", depth=-0.004, glow=0.2, parent=car)
    P.piece("finial", [P.circle(0, 2.86, 0.12, 24)], "#e8b04a", depth=-0.004, glow=0.3, parent=car)
    P.piece("finial tip", [[(-0.06, 2.8), (0.06, 2.8), (0, 3.18)]], "#e8b04a", depth=-0.004, glow=0.3, parent=car)
    P.piece("post l", [P.rect(-1.35, 0.2, 0.08, 1.85)], "#8a1f2e", depth=-0.004, parent=car)
    P.piece("post r", [P.rect(1.1, 0.25, 0.08, 1.78)], "#8a1f2e", depth=-0.004, parent=car)
    body = [(-1.5, -0.35), (1.1, -0.35), (1.5, 0.25), (1.2, 0.32), (-1.3, 0.22)]
    P.piece("body", [body] + [P.circle(-1.1 + i * 0.48, -0.06, 0.08, 20) for i in range(5)], "#a8283a", depth=-0.008, parent=car)
    P.piece("body trim", [P.rect(-1.55, -0.2, 2.9, 0.08)], "#e8b04a", depth=-0.012, glow=0.2, parent=car)
    P.piece("pole", [P.capsule(1.2, -0.1, 3.4, 0.25, 0.05)], "#7a4a1c", depth=0.02, parent=car)
    w = F.wheel("wheel", 1.05, parent=car, at=(-0.2, -0.75), depth=-0.03, colors=("#c98a3a", "#f0c070", "#7a4a1c"), glow=0.05)
    P.key(bpy.data.objects[w["spin"]], 1, rotation_euler=(0, 0, 0))
    P.key(bpy.data.objects[w["spin"]], frames, rotation_euler=(0, frames / FPS * 1.6, 0))
    # a pennant on the canopy, flapping
    flag = P.group("flag", depth=0.0, at=(0, 3.15), parent=car)
    P.piece("flagpole", [P.rect(-0.02, 0, 0.04, 0.7)], "#7a4a1c", parent=flag)
    pts = [(0.02, 0.68)] + [(0.02 + k * 0.12, 0.62 - k * 0.02 + math.sin(-k) * 0.05) for k in range(1, 7)] + [(0.02 + k * 0.12, 0.44 + k * 0.01 + math.sin(-k) * 0.05) for k in range(6, 0, -1)] + [(0.02, 0.42)]
    P.piece("flag cloth", [pts], "#ffcf5a", depth=-0.004, glow=0.2, parent=flag)
    for f in range(1, frames + 1, 3):
        P.key(flag, f, rotation_euler=(0, math.sin(f / FPS * 6) * 0.06, 0))
    # seven horses in two rows, the far row darker and behind
    team = P.group("team", depth=0.3)
    for i in range(7):
        row = i % 2
        hx, hy = -0.6 + i * 0.68, -1.55 + row * 0.42 - i * 0.02
        h = F.horse(f"horse{i}", parent=team, at=(hx, hy), depth=(0.18 if row else -0.02) - i * 0.008, scale=1.05,
                    coat="#e9dcc4" if row else "#f6ecd8")
        F.gallop_keys(h, frames, FPS, speed=7.0, phase=i * 0.9)
        # reins from each muzzle back to the car
        P.piece(f"rein{i}", [P.capsule(-1.75, -0.55, hx + 1.0 * 1.05, hy + 1.45 * 1.05, 0.012)], "#e0a032", depth=0.1, glow=0.2, parent=team)
    for f in range(1, frames + 1, 6):
        t = f / FPS
        P.key(car, f, location=(-2.9, 0.45, -0.7 + math.sin(t * 1.3) * 0.06))
    # light
    P.area_light("key", (-6, -9, 7), (0, 0, 0), 2400, "#fff0d0", size=9)
    P.area_light("fill", (6, -7, 3), (0, 0, 0), 500, "#ffd0a0", size=8)
    cam, aim, foc = P.camera((0, -15, 0.3), (0, 0, 0.3), lens=36, fstop=0.8, focus=(0.0, 0.3, 0.0))
    P.key(cam, 1, location=(-1.0, -15.2, 0.4))
    P.key(cam, frames, location=(0.9, -13.6, 0.55))
    P.key(aim, 1, location=(-0.9, 0, 0.3))
    P.key(aim, frames, location=(0.8, 0, 0.35))


def palms(prefix, items, color, depth, parent=None):
    g = P.group(prefix, depth=depth, parent=parent)
    for k, (x, y, h, lean) in enumerate(items):
        for m, o in enumerate(P.palm(x, y, h, lean)):
            P.piece(f"{prefix}{k}{m}", [o], color, depth=-0.002 * m, parent=g)
    return g


def sea_bands(prefix, ys, cols, x0=-15, x1=15, frames=1, rock=True):
    for i, (y, c) in enumerate(zip(ys, cols)):
        band = P.group(f"{prefix}{i}", depth=0.0)
        P.piece(f"{prefix}{i}w", [P.waves(x0, x1, y, -9, 0.06 + i * 0.02, 1.3 + i * 0.3, i * 0.3)], c, parent=band, translucency=0.3)
        foam = tuple(min(255, int(int(c[k:k + 2], 16) * 0.5 + 255 * 0.42)) for k in (1, 3, 5))
        P.piece(f"{prefix}{i}f", [P.wave_line(x0, x1, y + 0.003, 0.06 + i * 0.02, 1.3 + i * 0.3, i * 0.3, 0.03)], "#%02x%02x%02x" % foam, depth=-0.01, parent=band)
        if rock:
            for f in range(1, frames + 1, 8):
                P.key(band, f, location=(math.sin(f / FPS * 0.5 + i) * 0.08, 0.0, 0))
        yield band


# ------------------------------------------------------------------ scene 2: the king's command

def king(frames):
    """Around the year 1250, King Narasimha Deva the First chose to build that chariot on earth..."""
    P.stage(fps=FPS)
    P.backdrop("#e9c48a", "#f3a56a", depth=2.6, glow=0.6)
    sunburst("sun", 0.7, 2.3, (5.6, 2.6), glow=0.9)
    for j, (depth, rows) in enumerate([(2.1, [(-5.5, 3.3, 3.2, 0.5), (2.5, 3.9, 2.6, 0.42)]), (1.6, [(7.4, 2.4, 2.6, 0.45), (-1.0, 2.9, 2.0, 0.36)])]):
        cl = P.group(f"clouds{j}", depth=depth)
        for i, (cx, cy, w, h) in enumerate(rows):
            P.quilled_cloud(f"c{j}{i}", cx, cy, w, h, parent=cl, color="#fff1dc", shade="#e4b48a", seed=i + 20)
        P.key(cl, 1, location=(0.3, depth, 0))
        P.key(cl, frames, location=(-0.3, depth, 0))
    # the sea behind the shore
    sea = P.group("sea", depth=1.4)
    for b in sea_bands("sea", [-0.15, -0.45], ["#5a8ea2", "#4a7d93"], frames=frames):
        b.parent = sea
    # the temple as he imagines it: pale gold card rising in the air above the shore
    vision = F.temple("vision", at=(2.6, -3.6), depth=1.2, tower="full", stone="#f6dea4", dark="#efcf8c", light="#fff2cc", glow=0.6, scale=0.46)
    P.key(vision, 1, location=(2.6, 1.2, -3.8))
    P.key(vision, int(frames * 0.25), location=(2.6, 1.2, -3.8))
    P.key(vision, int(frames * 0.6), location=(2.6, 1.2, -0.1))
    P.key(vision, frames, location=(2.6, 1.2, 0.1))
    halo = P.group("vision halo", depth=1.35, at=(2.95, -1.6))
    P.piece("vision rays", [P.star(0, 0, 3.0, 1.6, 28)], "#fff0c0", glow=0.6, parent=halo)
    P.key(halo, 1, scale=(0.001, 0.001, 0.001), location=(2.95, 1.35, 1.2))
    P.key(halo, int(frames * 0.3), scale=(0.001, 0.001, 0.001), location=(2.95, 1.35, 1.2))
    P.key(halo, int(frames * 0.65), scale=(1, 1, 1), location=(2.95, 1.35, 1.4), rotation_euler=(0, 0, 0))
    P.key(halo, frames, scale=(1.05, 1.05, 1.05), location=(2.95, 1.35, 1.5), rotation_euler=(0, 0.15, 0))
    # dunes and palms
    P.piece("dune far", [P.smooth([(-15, -9), (-15, -0.75), (-7, -0.6), (0, -0.95), (6, -0.7), (15, -0.9), (15, -9)], 6)], "#e5c28c", depth=0.9)
    palms("palmsb", [(-6.6, -0.8, 3.0, 0.12), (-5.4, -0.8, 2.5, -0.1), (6.6, -0.8, 2.9, -0.15), (7.6, -0.8, 2.2, 0.12)], "#3f5c35", 0.75)
    P.piece("sand", [P.smooth([(-15, -9), (-15, -1.9), (-4, -1.7), (3, -2.05), (15, -1.8), (15, -9)], 6)], "#d6ae74", depth=0.2)
    # the king, a parasol bearer, and a master builder holding a palm-leaf plan
    people = P.group("people", depth=-0.2)
    bearer = F.person("bearer", parent=people, at=(-4.6, -2.05), depth=0.06, skin="#6b3f24", cloth="#f0e2c6", sash="#c4562e", turban="#c4562e", arm="raise", scale=1.15)
    P.piece("parasol pole", [P.capsule(-4.18, -0.2, -4.25, 1.45, 0.025)], "#5b3d22", depth=0.08, parent=people)
    P.piece("parasol", [P.smooth([(-5.05, 1.25), (-3.45, 1.25), (-3.7, 1.62), (-4.25, 1.8), (-4.8, 1.62)], 6)], "#b0303a", depth=0.06, parent=people)
    P.piece("parasol fringe", [P.scallop_band(-5.05, -3.45, 1.27, 0.08, 9)], "#e8b04a", depth=0.055, glow=0.2, parent=people)
    kng = F.person("king", parent=people, at=(-3.5, -2.05), depth=0.0, skin="#7a4a2c", cloth="#f5e4c0", sash="#b0303a", crown=True, arm="point", scale=1.3)
    builder = F.person("builder", parent=people, at=(-1.9, -2.05), depth=0.03, skin="#835232", cloth="#efe2c8", sash="#4c7d8f", turban="#4c7d8f", arm="work", scale=1.12, flip=True)
    P.piece("palm leaf", [P.rect(-2.55, -0.72, 0.62, 0.11)], "#c9a45c", depth=-0.03, parent=people)
    arm = bpy.data.objects[kng["arm"]]
    for f in range(1, frames + 1, 6):
        P.key(arm, f, rotation_euler=(0, -(1.35 + math.sin(f / FPS * 1.4) * 0.06), 0))
    palms("palmsf", [(-8.4, -3.6, 4.6, 0.18), (8.2, -3.6, 4.2, -0.2)], "#2c4226", -1.4)
    for k, (bx, by, br) in enumerate([(-7.6, -3.3, 0.9), (-5.9, -3.6, 0.6), (5.2, -3.4, 0.7), (7.4, -3.2, 1.0), (1.0, -3.9, 0.5)]):
        P.tissue_bush(f"bush{k}", bx, by, br, ["#2f4a2a", "#3f6534", "#56803f", "#7aa04e"], depth=-1.2 - k * 0.04, seed=k + 3)
    P.area_light("key", (5, -9, 7), (0, 0, 0), 2300, "#fff2d8", size=9)
    P.area_light("fill", (-6, -7, 4), (0, 0, 0), 600, "#d8e2ff", size=8)
    cam, aim, foc = P.camera((0, -15, 0.3), (0, 0, 0.3), lens=36, fstop=0.8, focus=(-2.5, -0.2, 0.0))
    P.key(cam, 1, location=(-1.4, -15.0, 0.2))
    P.key(cam, frames, location=(-0.6, -12.6, 0.3))
    P.key(aim, 1, location=(-0.6, 0, 0.1))
    P.key(aim, frames, location=(0.0, 0, 0.1))


# ------------------------------------------------------------------ scene 3: the temple rises

def build(frames):
    """Tradition says that twelve hundred artisans worked for twelve years. Stone by stone, the temple rose..."""
    P.stage(fps=FPS)
    P.backdrop("#f0cf98", "#d99a5c", depth=2.6, glow=0.55)
    P.piece("hills", [P.smooth([(-15, -9), (-15, -0.5), (-8, 0.3), (-3, -0.3), (3, 0.2), (9, -0.4), (15, 0.1), (15, -9)], 6)], "#c9945e", depth=2.0)
    P.piece("hills2", [P.smooth([(-15, -9), (-15, -1.0), (-6, -0.6), (1, -1.1), (8, -0.7), (15, -1.0), (15, -9)], 6)], "#b98454", depth=1.5)
    tmp = F.temple("temple", at=(-0.6, -1.9), depth=0.7, tower="full", stone="#b98c5c", dark="#8a6040", light="#dcb582", scale=0.66)
    tiers = [bpy.data.objects[n] for n in tmp["tiers"]]
    n = len(tiers)
    for i, t in enumerate(tiers):
        # each part springs up in turn, from the plinth to the crown
        start = 1 + int(frames * 0.7 * i / n)
        P.key(t, 1, scale=(1, 1, 0.001))
        P.key(t, start, scale=(1, 1, 0.001))
        P.key(t, start + 14, scale=(1, 1, 1.06))
        P.key(t, start + 22, scale=(1, 1, 1.0))
    # bamboo scaffolding round the tower
    sc = P.group("scaffold", depth=0.4)
    for i in range(5):
        P.piece(f"pole{i}", [P.capsule(-3.3 + i * 0.55, -1.9, -3.3 + i * 0.55 + 0.03, 3.4 - abs(i - 2) * 0.5, 0.025)], "#8a6440", parent=sc)
    for j in range(5):
        P.piece(f"bar{j}", [P.capsule(-3.4, -1.2 + j * 0.9, -0.9, -1.2 + j * 0.9, 0.02)], "#8a6440", depth=-0.004, parent=sc)
    P.key(sc, 1, scale=(1, 1, 1))
    P.key(sc, int(frames * 0.85), scale=(1, 1, 1))
    P.key(sc, int(frames * 0.92), scale=(1, 1, 0.001))
    # a ramp with an elephant hauling a block
    P.piece("ramp", [[(3.0, -2.2), (8.0, -2.2), (3.0, -0.75)]], "#a97b4f", depth=0.25)
    haul = P.group("haul", depth=0.18)
    haul.scale = (-1, 1, 1)
    P.piece("ele", [F.elephant_outline(0, 0, 0.75)], "#6e5a4c", parent=haul)
    P.piece("ele ear", [P.ellipse(0.38, 0.6, 0.15, 0.2, 0.2, 24)], "#5e4c40", depth=-0.004, parent=haul)
    P.piece("ele cloth", [P.rect(-0.25, 0.48, 0.45, 0.25)], "#b0303a", depth=-0.004, parent=haul)
    P.piece("block", [P.rect(-1.35, 0.05, 0.55, 0.4)], "#b98c5c", depth=0.0, parent=haul)
    P.piece("rope", [P.capsule(-0.8, 0.3, -0.45, 0.45, 0.015)], "#3a2412", depth=-0.002, parent=haul)
    for f in range(1, frames + 1, 4):
        u = (f / frames)
        x = 7.0 - u * 3.6
        P.key(haul, f, location=(x, 0.18, -2.2 + (8.0 - x) * 0.29), rotation_euler=(0, -0.28, 0))
    # artisans at their stones, chisels rising and falling
    crew = P.group("crew", depth=-0.6)
    P.piece("ground", [P.smooth([(-15, -9), (-15, -2.45), (-5, -2.3), (2, -2.55), (15, -2.35), (15, -9)], 6)], "#c99a66", parent=crew)
    for i, (x, sash, skin) in enumerate([(-5.0, "#c4562e", "#6b3f24"), (-2.0, "#4c7d8f", "#7a4a2c"), (1.6, "#b0303a", "#835232")]):
        p = F.person(f"artisan{i}", parent=crew, at=(x, -2.5), depth=-0.02, skin=skin, cloth="#efe2c8", sash=sash, turban=sash if i != 1 else None, arm="work", scale=0.95)
        P.piece(f"stone{i}", [P.rect(x + 0.36, -2.5, 0.78, 1.02)], "#b98c5c", depth=-0.05, parent=crew)
        P.piece(f"carving{i}", [P.circle(x + 0.75, -1.98, 0.22, 32), P.circle(x + 0.75, -1.98, 0.1, 20)], "#dcb582", depth=-0.054, parent=crew)
        P.piece(f"chisel{i}", [P.capsule(x + 0.52, -1.45, x + 0.62, -1.7, 0.018)], "#3a2412", depth=-0.06, parent=crew)
        arm = bpy.data.objects[p["arm"]]
        for f in range(1, frames + 1, 2):
            ph = f / FPS * 5.2 + i * 2.1
            P.key(arm, f, rotation_euler=(0, -(0.9 + max(0, math.sin(ph)) * 0.55), 0))
    for k, (bx, by, br) in enumerate([(-7.8, -2.9, 0.9), (7.6, -2.8, 0.8), (4.6, -3.3, 0.5)]):
        P.tissue_bush(f"bush{k}", bx, by, br, ["#2f4a2a", "#3f6534", "#56803f", "#7aa04e"], depth=-0.75 - k * 0.04, seed=k + 11)
    # dust in the light
    dust = P.group("dust", depth=-0.9)
    rnd = random.Random(9)
    for k in range(40):
        P.piece(f"mote{k}", [P.circle(rnd.uniform(-7, 7), rnd.uniform(-2, 3.5), rnd.uniform(0.012, 0.03), 8)], "#fff0cf", glow=1.5, parent=dust)
    P.key(dust, 1, location=(0, -0.9, 0))
    P.key(dust, frames, location=(0.6, -0.9, 0.5))
    P.area_light("key", (-6, -8, 8), (0, 0, 0), 2400, "#ffe3b8", size=9)
    P.area_light("fill", (6, -7, 3), (0, 0, 0), 500, "#ffe8cc", size=8)
    cam, aim, foc = P.camera((0, -15, 0.3), (0, 0, 0.3), lens=36, fstop=0.8, focus=(-0.6, 0.5, 0.0))
    P.key(cam, 1, location=(0.2, -14.6, -0.2))
    P.key(cam, frames, location=(-0.3, -13.0, 0.6))
    P.key(aim, 1, location=(0.0, 0, -0.3))
    P.key(aim, frames, location=(-0.4, 0, 0.6))


# ------------------------------------------------------------------ scene 4: the wheel

def wheel_shot(frames):
    """Along its base, they carved twenty-four great wheels. Some say that, even now, their shadows tell the time."""
    P.stage(fps=FPS)
    P.backdrop("#b98c5c", "#8a6444", depth=1.2, glow=0.15)
    wall = P.group("wall", depth=0.6)
    P.piece("wall", [P.rect(-15, -9, 30, 18)], "#b48a5c", parent=wall)
    # courses of the plinth, light and shadowed in turn
    for k, (yy, h, c) in enumerate([(3.4, 0.55, "#d8b385"), (2.9, 0.18, "#8a6040"), (-3.95, 0.55, "#d8b385"), (-3.4, 0.18, "#8a6040"), (4.6, 0.3, "#c49a6c")]):
        P.piece(f"band{k}", [P.rect(-15, yy, 30, h)], c, depth=-0.01, parent=wall)
    for i in range(12):
        P.piece(f"ele{i}", [F.elephant_outline(-9.5 + i * 1.7, 4.0, 0.5)], "#7a5534", depth=-0.02, parent=wall)
        F.person(f"dancer{i}", parent=wall, at=(-9.0 + i * 1.7, -3.9), depth=-0.02, skin="#7a5534", cloth="#7a5534", arm="raise" if i % 2 else "point", scale=0.42)
    w = F.wheel("wheel", 3.0, at=(0, 0), depth=0.2, colors=("#9a6c40", "#e6c28e", "#3e2614"), beads=True)
    P.piece("axle", [P.circle(0, 0, 0.42, 48)], "#8a6444", depth=-0.5)
    P.piece("axle cap", [P.circle(0, 0, 0.18, 32)], "#c9a273", depth=-0.52)
    # the sun crosses: low in the east, high at noon, low in the west; the spokes' shadows turn
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 6.5
    sun.angle = math.radians(2.0)
    sun.color = (1.0, 0.88, 0.7)
    so = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(so)
    for f in range(1, frames + 1, 6):
        a = math.pi * (0.12 + 0.76 * f / frames)
        d = mathutils_dir(math.cos(a) * 0.8, 0.6, -math.sin(a) * 0.8)
        so.rotation_euler = d
        so.keyframe_insert("rotation_euler", frame=f)
    P.area_light("fill", (0, -10, 2), (0, 0, 0), 300, "#ffe0c0", size=12)
    cam, aim, foc = P.camera((0, -15, 0.3), (0, 0, 0.3), lens=36, fstop=1.2, focus=(0, 0.2, 0))
    P.key(cam, 1, location=(0, -16.5, 0))
    P.key(cam, frames, location=(0.3, -13.0, 0.2))
    P.key(aim, 1, location=(0, 0, 0))
    P.key(aim, frames, location=(0.2, 0, 0.1))


def mathutils_dir(x, y, z):
    """Euler rotation that points a sun lamp's -Z along (x, y, z) towards the scene."""
    from mathutils import Vector
    return Vector((x, y, z)).to_track_quat("-Z", "Y").to_euler()


# ------------------------------------------------------------------ scene 5: Konark today

def arrive(frames):
    """Centuries have passed. Its great tower has fallen, but the hall still stands, facing the morning sun..."""
    P.stage(fps=FPS)
    P.backdrop("#2e2d5c", "#f39a58", depth=2.6, glow=0.6)
    sun = sunburst("sun", 0.75, 2.3, (5.4, -0.6), glow=1.0)
    P.key(sun, 1, location=(5.4, 2.3, -0.9))
    P.key(sun, frames, location=(5.4, 2.3, 0.5))
    stars = P.group("stars", depth=2.4)
    rnd = random.Random(3)
    for k in range(20):
        P.piece(f"star{k}", [P.star(rnd.uniform(-9, 9), rnd.uniform(3.2, 5.6), rnd.uniform(0.05, 0.09), 0.02, 4)], "#fff2c8", glow=1.2, parent=stars)
    sea = P.group("sea", depth=1.7)
    for b in sea_bands("sea", [-0.95, -1.2], ["#4a6f88", "#3c5f7a"], frames=frames):
        b.parent = sea
    P.piece("glint", [P.ellipse(5.4, -1.05, 1.0, 0.06, 0, 48)], "#ffcf6a", depth=1.65, glow=2.0)
    P.piece("beach", [P.smooth([(-15, -9), (-15, -1.3), (-6, -1.2), (0, -1.45), (6, -1.25), (15, -1.4), (15, -9)], 6)], "#6e4e34", depth=1.2)
    t = F.temple("konark", at=(-1.2, -1.95), depth=0.9, tower="ruin", stone="#7d5a3e", dark="#4e3420", light="#a37b55", scale=0.8)
    for i in range(2):
        F.horse(f"horse{i}", at=(2.75 + i * 0.5, -1.95), depth=0.75 - i * 0.05, coat="#8a6444", mane="#6b4a2a", jewel="#a37b55", cloth="#6b4a2a", scale=0.46)
    palms("palms", [(-7.6, -2.2, 3.6, 0.1), (-6.5, -2.2, 3.0, -0.12), (7.2, -2.1, 3.4, -0.14), (8.2, -2.1, 2.7, 0.1)], "#253a24", 0.4)
    P.piece("fg", [P.smooth([(-15, -9), (-15, -2.0), (-6, -1.85), (0, -2.15), (6, -1.9), (15, -2.05), (15, -9)], 6)], "#3a2a1c", depth=-0.3)
    for k, (bx, by, br) in enumerate([(-6.2, -2.0, 0.8), (-4.6, -2.1, 0.5), (4.4, -2.0, 0.6), (6.4, -1.95, 0.9)]):
        P.tissue_bush(f"bush{k}", bx, by, br, ["#0f160f", "#141e14", "#1a281a", "#223422"], depth=-0.35 - k * 0.04, seed=k + 21)
    birds = P.group("birds", depth=0.5)
    for k, (bx, by, s) in enumerate([(0, 0, 0.2), (0.5, 0.25, 0.14), (1.0, -0.05, 0.17)]):
        pts = [(bx - s, by + s * 0.25), (bx - s * 0.45, by + s * 0.33), (bx, by - s * 0.05), (bx + s * 0.45, by + s * 0.33), (bx + s, by + s * 0.25), (bx + s * 0.45, by + s * 0.1), (bx, by - s * 0.22), (bx - s * 0.45, by + s * 0.1)]
        P.piece(f"bird{k}", [P.smooth(pts, 6)], "#2b1d2a", parent=birds)
    P.key(birds, 1, location=(-4, 0.5, 2.6))
    P.key(birds, frames, location=(3, 0.5, 3.4))
    P.area_light("key", (7, -8, 4), (0, 0, 0), 2000, "#ffc994", size=9)
    P.area_light("fill", (-6, -7, 6), (0, 0, 0), 500, "#b8c4ff", size=10)
    cam, aim, foc = P.camera((0, -15, 0.3), (0, 0, 0.3), lens=36, fstop=1.0, focus=(-1.0, 0.9, 0.0))
    P.key(cam, 1, location=(-0.6, -10.5, 0.0))
    P.key(cam, frames, location=(0.0, -15.5, 0.6))
    P.key(aim, 1, location=(-0.8, 0, 0.2))
    P.key(aim, frames, location=(0.0, 0, 0.4))


SHOTS = [dawn, chariot, king, build, wheel_shot, arrive]


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", type=int, default=0)
    ap.add_argument("--frames", type=int, default=240)
    ap.add_argument("--still", type=int)
    ap.add_argument("--out")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--res", type=float, default=1.0)
    ap.add_argument("--save")
    ap.add_argument("--eevee", action="store_true")
    ap.add_argument("--render", action="store_true")
    a = ap.parse_args(argv)
    reset()
    SHOTS[a.shot](a.frames)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, a.frames
    sc.cycles.samples = a.samples
    if a.eevee:
        sc.render.engine = "BLENDER_EEVEE"
        sc.eevee.taa_render_samples = 24
        sc.eevee.use_raytracing = False
        sc.eevee.use_shadows = True
        sc.eevee.shadow_ray_count = 2
        sc.eevee.shadow_step_count = 8
    sc.render.resolution_percentage = int(a.res * 100)
    # card pieces never change shape: make them plain meshes once, so frames don't re-evaluate curves
    curves = [o for o in sc.objects if o.type == "CURVE"]
    if curves:
        bpy.ops.object.select_all(action="DESELECT")
        for o in curves:
            o.select_set(True)
        bpy.context.view_layer.objects.active = curves[0]
        bpy.ops.object.convert(target="MESH")
    # smooth eases between keys
    for ob in bpy.data.objects:
        if ob.animation_data and ob.animation_data.action:
            for fc in getattr(ob.animation_data.action, "fcurves", []):
                for kp in fc.keyframe_points:
                    kp.interpolation = "BEZIER"
    if a.save:
        bpy.ops.wm.save_as_mainfile(filepath=a.save)
    if a.still is not None:
        sc.frame_set(a.still)
        sc.render.filepath = a.out or "/tmp/still.png"
        bpy.ops.render.render(write_still=True)
    elif a.render:
        # frames first, then a web-friendly encode with ffmpeg (H.264, fast start)
        frames_dir = os.path.join(ROOT, "tools", "blender", "out", f"scene-{a.shot}")
        os.makedirs(frames_dir, exist_ok=True)
        sc.render.image_settings.file_format = "PNG"
        sc.render.filepath = os.path.join(frames_dir, "f")
        # resumable: frames already on disk are skipped
        sc.render.use_overwrite = False
        sc.render.use_placeholder = True
        bpy.ops.render.render(animation=True)
        out = os.path.join(ROOT, "public", "sites", "konark", "story")
        os.makedirs(out, exist_ok=True)
        import subprocess

        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(frames_dir, "f%04d.png"),
                        "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-maxrate", "3500k", "-bufsize", "7000k",
                        "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                        os.path.join(out, f"scene-{a.shot}.mp4")], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(frames_dir, "f0001.png"), "-q:v", "4",
                        os.path.join(out, f"scene-{a.shot}.jpg")], check=True)

main()
