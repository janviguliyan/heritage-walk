"""Paper-cut kit for Blender: shapes cut from coloured card, lit like a shadow box.

Shapes are 2D outlines (lists of (x, y), y up) turned into filled, extruded curve objects, so
holes come for free (inner outlines in the same piece are cut out) and edges are bevelled. A
piece stands upright in the XZ plane facing the camera (-Y); `depth` pushes it back (+Y is away).
Units match the web version: a scene is about 16 wide and 9 tall.

Used by tools/blender/story.py. Run inside Blender (bpy).
"""
import math
import random

import bpy
from mathutils import Vector

# ---------------------------------------------------------------- materials

_mats = {}


def _hex(c):
    c = c.lstrip("#")
    srgb = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in srgb]
    return (*lin, 1.0)


def card(color, glow=0.0, translucency=0.22):
    """Coloured card: mottled fibrous paper, a paler cut edge, and some light passing through."""
    key = (color, glow, translucency)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f"card {color}")
    m.use_nodes = True
    nt = m.node_tree
    n, links = nt.nodes, nt.links
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    base = _hex(color)
    # mottling and fibres: two noises, one fine and stretched, one broad
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1, 1, 1)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    broad = n.new("ShaderNodeTexNoise")
    broad.inputs["Scale"].default_value = 1.4
    broad.inputs["Detail"].default_value = 6
    fib = n.new("ShaderNodeTexNoise")
    fib.inputs["Scale"].default_value = 22.0
    fib.inputs["Detail"].default_value = 12
    fib.inputs["Roughness"].default_value = 0.7
    fib.inputs["Distortion"].default_value = 3.0
    links.new(mp.outputs["Vector"], broad.inputs["Vector"])
    links.new(mp.outputs["Vector"], fib.inputs["Vector"])
    mot = n.new("ShaderNodeMapRange")
    mot.inputs["To Min"].default_value = 0.84
    mot.inputs["To Max"].default_value = 1.08
    links.new(broad.outputs["Fac"], mot.inputs["Value"])
    col = n.new("ShaderNodeRGB")
    col.outputs[0].default_value = base
    mul = n.new("ShaderNodeVectorMath")
    mul.operation = "SCALE"
    links.new(col.outputs[0], mul.inputs[0])
    links.new(mot.outputs[0], mul.inputs["Scale"])
    # the cut edge: faces turned away from the camera's axis show the paler core of the card
    geo = n.new("ShaderNodeNewGeometry")
    sep = n.new("ShaderNodeSeparateXYZ")
    links.new(geo.outputs["Normal"], sep.inputs[0])
    absy = n.new("ShaderNodeMath")
    absy.operation = "ABSOLUTE"
    links.new(sep.outputs["Y"], absy.inputs[0])
    edge = n.new("ShaderNodeMath")
    edge.operation = "LESS_THAN"
    edge.inputs[1].default_value = 0.5
    links.new(absy.outputs[0], edge.inputs[0])
    core = n.new("ShaderNodeMix")
    core.data_type = "RGBA"
    links.new(edge.outputs[0], core.inputs["Factor"])
    links.new(mul.outputs[0], core.inputs[6])
    pale = [base[i] * 0.55 + 0.45 * 0.92 for i in range(3)]
    core.inputs[7].default_value = (*pale, 1)
    links.new(core.outputs[2], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Specular IOR Level"].default_value = 0.2
    # fibre bump
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.01
    links.new(fib.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if glow:
        links.new(core.outputs[2], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = glow
    # light through the card
    tr = n.new("ShaderNodeBsdfTranslucent")
    links.new(core.outputs[2], tr.inputs["Color"])
    mix = n.new("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = translucency
    links.new(bsdf.outputs[0], mix.inputs[1])
    links.new(tr.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    _mats[key] = m
    return m


# ---------------------------------------------------------------- pieces

def piece(name, outlines, color, depth=0.0, thick=0.012, glow=0.0, translucency=0.22, parent=None, at=(0, 0)):
    """A piece of card from outlines [(x, y), ...]; outlines inside another become holes.
    Several separate outlines that overlap should be separate pieces (or they cut each other)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = thick / 2
    cu.bevel_depth = min(0.0025, thick * 0.2)
    cu.bevel_resolution = 1
    cu.resolution_u = 2
    for pts in outlines:
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, (x, y) in zip(sp.points, pts):
            p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(card(color, glow, translucency))
    ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.location = (at[0], depth, at[1])
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def group(name, depth=0.0, at=(0, 0), parent=None):
    """An empty to move several pieces together (a layer, a figure, a limb)."""
    e = bpy.data.objects.new(name, None)
    e.location = (at[0], depth, at[1])
    bpy.context.scene.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


# ---------------------------------------------------------------- quilling and tissue

def coil(cx, cy, r, turns=3.0, w=0.014, phase=0.0, ccw=True, n=44):
    """A quilled coil: a paper strip rolled into a loose spiral, as one thin outline."""
    k = 1 if ccw else -1
    pts = int(n * turns)
    total = math.tau * turns
    path = []
    for i in range(pts + 1):
        t = i / pts
        a = phase + k * t * total
        rr = r * (1 - 0.86 * t)
        path.append((a, rr))
    outer = [(cx + math.cos(a) * (rr + w / 2), cy + math.sin(a) * (rr + w / 2)) for a, rr in path]
    inner = [(cx + math.cos(a) * (rr - w / 2), cy + math.sin(a) * (rr - w / 2)) for a, rr in path]
    return outer + inner[::-1]


def quilled_cloud(name, cx, cy, w, h, depth=0.0, parent=None, color="#fbf6ee", shade="#e6dccb", seed=1, thread=True):
    """A cloud of quilled paper: coils of strip standing on edge over a solid backing, hung on a
    thread (as in hand-made paper art). The coils catch light and shadow on their own."""
    rnd = random.Random(seed)
    g = group(name, depth=depth, parent=parent)
    n = max(3, round(w / h) + 1)
    puffs = []
    for i in range(n):
        x = cx - w / 2 + h * 0.5 + (w - h) * i / (n - 1)
        mid = 1 - abs(i / (n - 1) - 0.5) * 2
        puffs.append((x, cy + h * (0.1 + 0.35 * mid), h * (0.34 + 0.3 * mid + rnd.random() * 0.1)))
    # the backing sits inside the coils, a shade off the paper's colour, so the coils make the edge
    back = cloud(cx, cy - h * 0.02, w * 0.92, h * 0.86, seed)
    piece(f"{name} back", [back], shade, depth=0.05, parent=g)
    for i, (x, y, r) in enumerate(puffs):
        # a tight roll: many turns, filling its puff
        piece(f"{name} coil{i}", [coil(x, y, r * 0.92, 4.2 + rnd.random() * 0.8, 0.018, rnd.random() * math.tau, rnd.random() < 0.5)], color, depth=-0.01, thick=0.08, translucency=0.3, parent=g)
    # one small roll tucked under each join
    for i in range(n - 1):
        (x0, y0, r0), (x1, y1, r1) = puffs[i], puffs[i + 1]
        r = min(r0, r1) * 0.42
        piece(f"{name} small{i}", [coil((x0 + x1) / 2, cy - h * 0.2, r, 3.0 + rnd.random(), 0.015, rnd.random() * math.tau, rnd.random() < 0.5)], color, depth=-0.014, thick=0.07, translucency=0.3, parent=g)
    if thread:
        top = max(y + r for x, y, r in puffs)
        piece(f"{name} thread", [rect(cx - 0.005, top - 0.1, 0.01, 14)], "#efe8dc", depth=0.02, thick=0.006, parent=g)
    return g


def tissue_bush(name, cx, cy, r, colors, depth=0.0, parent=None, seed=1, n=16):
    """A bush of crumpled tissue: many small irregular blobs, light ones over dark, layered."""
    rnd = random.Random(seed)
    g = group(name, depth=depth, parent=parent)
    for i in range(n):
        t = i / n
        a = rnd.random() * math.tau
        d = r * (1 - t) * 0.7 * rnd.random()
        bx, by = cx + math.cos(a) * d * 1.3, cy + abs(math.sin(a)) * d + r * 0.2 * t
        br = r * (0.28 + rnd.random() * 0.2)
        pts = []
        for k in range(28):
            ang = k / 28 * math.tau
            rr = br * (1 + 0.16 * math.sin(ang * 5 + i) + 0.08 * math.sin(ang * 11 + i * 2) + (rnd.random() - 0.5) * 0.1)
            pts.append((bx + math.cos(ang) * rr, by + math.sin(ang) * rr * 0.85))
        piece(f"{name} {i}", [pts], colors[min(len(colors) - 1, int(t * len(colors)))], depth=-0.006 * i, parent=g)
    return g


# ---------------------------------------------------------------- outlines (y up)

def circle(cx, cy, r, n=48):
    return [(cx + math.cos(a) * r, cy + math.sin(a) * r) for a in (i / n * math.tau for i in range(n))]


def ellipse(cx, cy, rx, ry, rot=0.0, n=48):
    c, s = math.cos(rot), math.sin(rot)
    out = []
    for i in range(n):
        a = i / n * math.tau
        x, y = math.cos(a) * rx, math.sin(a) * ry
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


def rect(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def smooth(pts, n=10, closed=True):
    """Catmull-Rom through the points."""
    out = []
    m = len(pts)
    for i in range(m if closed else m - 1):
        p0, p1, p2, p3 = (pts[(i + k) % m] for k in (-1, 0, 1, 2))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    return out


def capsule(x1, y1, x2, y2, r1, r2=None, n=16):
    r2 = r1 if r2 is None else r2
    a = math.atan2(y2 - y1, x2 - x1)
    out = []
    for i in range(n + 1):
        t = a + math.pi / 2 + math.pi * i / n
        out.append((x1 + math.cos(t) * r1, y1 + math.sin(t) * r1))
    for i in range(n + 1):
        t = a - math.pi / 2 + math.pi * i / n
        out.append((x2 + math.cos(t) * r2, y2 + math.sin(t) * r2))
    return out


def star(cx, cy, r_out, r_in, n, rot=0.0):
    return [(cx + math.cos(rot + i / (2 * n) * math.tau) * (r_in if i % 2 else r_out), cy + math.sin(rot + i / (2 * n) * math.tau) * (r_in if i % 2 else r_out)) for i in range(2 * n)]


def waves(x0, x1, y, y_bottom, amp, wavelength, phase=0.0):
    pts = [(x0, y_bottom)]
    steps = int((x1 - x0) / wavelength * 20)
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        k = ((x - x0) / wavelength + phase) * math.tau
        pts.append((x, y + amp * (1 - abs(math.sin(k / 2))) * 1.6 - amp * 0.6))
    pts.append((x1, y_bottom))
    return pts


def wave_line(x0, x1, y, amp, wavelength, phase, thick):
    top = []
    steps = int((x1 - x0) / wavelength * 20)
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        k = ((x - x0) / wavelength + phase) * math.tau
        top.append((x, y + amp * (1 - abs(math.sin(k / 2))) * 1.6 - amp * 0.6))
    return top + [(x, yy - thick) for x, yy in reversed(top)]


def scallop_band(x0, x1, y, r, n=None):
    """A row of half-circle scallops hanging from a line (a canopy edge)."""
    n = n or max(2, int((x1 - x0) / (2 * r)))
    w = (x1 - x0) / n
    pts = [(x0, y)]
    for i in range(n):
        cx = x0 + w * (i + 0.5)
        for k in range(13):
            a = math.pi + k / 12 * math.pi
            pts.append((cx - math.cos(a) * w / 2, y + math.sin(a) * w / 2 * 0.9))
    pts.append((x1, y))
    pts.append((x1, y + 0.08))
    pts.append((x0, y + 0.08))
    return pts


def cloud_puffs(cx, cy, w, h, seed=1):
    """Overlapping circles along a line, as separate outlines (make one piece per outline)."""
    rnd = random.Random(seed)
    out = [capsule(cx - w / 2 + h * 0.35, cy, cx + w / 2 - h * 0.35, cy, h * 0.35)]
    n = max(3, round(w / h) + 1)
    for i in range(n):
        x = cx - w / 2 + h * 0.5 + (w - h) * i / (n - 1)
        mid = 1 - abs(i / (n - 1) - 0.5) * 2
        out.append(circle(x, cy + h * (0.1 + 0.35 * mid), h * (0.32 + 0.3 * mid + rnd.random() * 0.1)))
    return out


def cloud(cx, cy, w, h, seed=1):
    """One cloud as a single cut outline: the upper envelope of its puffs over a flat, rounded base."""
    rnd = random.Random(seed)
    n = max(3, round(w / h) + 1)
    puffs = []
    for i in range(n):
        x = cx - w / 2 + h * 0.5 + (w - h) * i / (n - 1)
        mid = 1 - abs(i / (n - 1) - 0.5) * 2
        puffs.append((x, cy + h * (0.1 + 0.35 * mid), h * (0.34 + 0.3 * mid + rnd.random() * 0.1)))
    base = cy - h * 0.32
    x0 = min(x - r for x, _, r in puffs)
    x1 = max(x + r for x, _, r in puffs)
    top = []
    steps = int((x1 - x0) / (h * 0.02)) + 2
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        y = base
        for px, py, r in puffs:
            if abs(x - px) < r:
                y = max(y, py + math.sqrt(r * r - (x - px) ** 2))
        top.append((x, y))
    # round the ends down to the base
    r = h * 0.32
    out = [(x0 + r * (1 - math.cos(a)), base + r * math.sin(a) - r) for a in (k / 8 * math.pi / 2 for k in range(9))][::-1]
    out = top[:]
    out.append((x1, base))
    out.append((x0, base))
    return out


def union_outline(outlines, res=0.02):
    """Merge overlapping outlines into one silhouette (a marching-squares trace of their union)."""
    xs = [x for o in outlines for x, _ in o]
    ys = [y for o in outlines for _, y in o]
    x0, x1, y0, y1 = min(xs) - res * 2, max(xs) + res * 2, min(ys) - res * 2, max(ys) + res * 2
    nx, ny = int((x1 - x0) / res) + 1, int((y1 - y0) / res) + 1

    def inside(px, py, poly):
        c = False
        j = len(poly) - 1
        for i in range(len(poly)):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi:
                c = not c
            j = i
        return c

    grid = [[any(inside(x0 + i * res, y0 + j * res, o) for o in outlines) for i in range(nx)] for j in range(ny)]
    # boundary walk (Moore neighbour tracing) from the first filled cell
    start = next(((i, j) for j in range(ny) for i in range(nx) if grid[j][i]), None)
    if not start:
        return []
    dirs = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    path = [start]
    cur, d = start, 6
    for _ in range(nx * ny * 2):
        for k in range(8):
            dd = (d + 6 + k) % 8
            ni, nj = cur[0] + dirs[dd][0], cur[1] + dirs[dd][1]
            if 0 <= ni < nx and 0 <= nj < ny and grid[nj][ni]:
                cur, d = (ni, nj), dd
                break
        if cur == start:
            break
        path.append(cur)
    pts = [(x0 + i * res, y0 + j * res) for i, j in path]
    # relax the staircase a little
    for _ in range(3):
        pts = [((pts[i - 1][0] + pts[i][0] * 2 + pts[(i + 1) % len(pts)][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[(i + 1) % len(pts)][1]) / 4) for i in range(len(pts))]
    return pts[::2]


# ---------------------------------------------------------------- figures (silhouettes, facing right, feet at 0)

def woman(x, y, s=1.0):
    """A woman in a sari, standing, her pallu over her head."""
    pts = [(0.05, 0), (0.32, 0), (0.28, 0.35), (0.22, 0.75), (0.2, 1.05), (0.24, 1.3), (0.2, 1.42), (0.17, 1.55),
           (0.14, 1.66), (0.06, 1.72), (-0.06, 1.7), (-0.12, 1.6), (-0.16, 1.42), (-0.22, 1.2), (-0.26, 0.9), (-0.3, 0.5), (-0.34, 0.1), (-0.3, 0)]
    return [(x + px * s, y + py * s) for px, py in smooth(pts, 6)]


def child(x, y, s=1.0):
    pts = [(0.04, 0), (0.14, 0), (0.13, 0.45), (0.17, 0.62), (0.14, 0.82), (0.12, 0.9), (0.14, 0.98), (0.08, 1.06),
           (-0.02, 1.06), (-0.08, 0.98), (-0.08, 0.88), (-0.13, 0.72), (-0.14, 0.5), (-0.1, 0.45), (-0.1, 0)]
    return [(x + px * s, y + py * s) for px, py in smooth(pts, 6)]


def boat(x, y, s=1.0):
    """An Odisha fishing boat: a long upturned hull, a mast and a square-ish sail (three outlines)."""
    hull = [(-1.1, 0.12), (-0.8, -0.05), (0.8, -0.05), (1.15, 0.14), (1.05, 0.2), (0.6, 0.08), (-0.6, 0.08), (-1.0, 0.22)]
    mast = rect(-0.04, 0.05, 0.05, 1.5)
    sail = [(0.04, 0.35), (0.75, 0.42), (0.68, 1.45), (0.04, 1.5)]
    f = lambda pts: [(x + px * s, y + py * s) for px, py in pts]
    return f(smooth(hull, 6)), f(mast), f(sail)


def palm(x, y, h, lean=0.15):
    """A coconut palm as separate outlines: trunk, crown, fronds."""
    out = []
    tx, ty = x + lean * h, y + h
    trunk = []
    for i in range(13):
        t = i / 12
        cx = x + lean * h * t * t
        trunk.append((cx - 0.09 * (1 - t * 0.5), y + h * t))
    for i in range(12, -1, -1):
        t = i / 12
        cx = x + lean * h * t * t
        trunk.append((cx + 0.11 * (1 - t * 0.5), y + h * t))
    out.append(trunk)
    for i in range(8):
        a = math.pi * (0.06 + i / 7 * 0.88)
        ln = h * (0.42 + (i % 2) * 0.1)
        ex, ey = tx + math.cos(a) * ln, ty + math.sin(a) * ln * 0.35 - ln * 0.3
        mx, my = tx + math.cos(a) * ln * 0.5, ty + math.sin(a) * ln * 0.45 + 0.1
        pts = []
        for k in range(11):
            t = k / 10
            px = (1 - t) ** 2 * tx + 2 * (1 - t) * t * mx + t * t * ex
            py = (1 - t) ** 2 * (ty + 0.03) + 2 * (1 - t) * t * (my + 0.08) + t * t * ey
            pts.append((px, py))
        for k in range(10, -1, -1):
            t = k / 10
            px = (1 - t) ** 2 * tx + 2 * (1 - t) * t * mx + t * t * ex
            py = (1 - t) ** 2 * (ty - 0.03) + 2 * (1 - t) * t * (my - 0.05) + t * t * ey
            pts.append((px, py))
        out.append(pts)
    out.append(circle(tx, ty, 0.1, 16))
    return out


# ---------------------------------------------------------------- stage

def stage(fps=24, res=(1920, 1080), engine="CYCLES", samples=96):
    sc = bpy.context.scene
    sc.render.fps = fps
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.engine = engine
    if engine == "CYCLES":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = "GPU"
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True
        sc.cycles.max_bounces = 6
        sc.cycles.transmission_bounces = 4
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.015, 0.012, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.3
    sc.world = world
    return sc


def camera(loc, look, lens=55, fstop=2.8, focus=None):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    ob = bpy.data.objects.new("cam", cam)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    aim = bpy.data.objects.new("aim", None)
    aim.location = look
    bpy.context.scene.collection.objects.link(aim)
    c = ob.constraints.new("TRACK_TO")
    c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    foc = bpy.data.objects.new("focus", None)
    foc.location = focus or look
    bpy.context.scene.collection.objects.link(foc)
    cam.dof.focus_object = foc
    bpy.context.scene.camera = ob
    return ob, aim, foc


def area_light(name, loc, look, energy, color="#ffffff", size=4.0):
    li = bpy.data.lights.new(name, "AREA")
    li.energy = energy
    li.size = size
    li.color = _hex(color)[:3]
    ob = bpy.data.objects.new(name, li)
    ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def backdrop(top, bottom, depth=1.6, w=40, h=24, glow=0.6):
    """The sky: a sheet of paper behind everything, its colour a vertical gradient, partly self-lit."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    ob = bpy.context.active_object
    ob.name = "sky"
    ob.scale = (w, h, 1)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.location = (0, depth, 0)
    m = card("#ffffff", 0, 0.0).copy()
    m.name = "sky"
    nt = m.node_tree
    n, links = nt.nodes, nt.links
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    links.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = _hex(bottom)
    ramp.color_ramp.elements[1].color = _hex(top)
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[1].position = 0.7
    links.new(sep.outputs["Y"], ramp.inputs[0])
    mix = next(x for x in n if x.type == "MIX" and x.data_type == "RGBA")
    rgb = next(x for x in n if x.type == "RGB")
    mul = next(x for x in n if x.type == "VECT_MATH")
    links.new(ramp.outputs[0], mul.inputs[0])
    n.remove(rgb)
    bsdf = next(x for x in n if x.type == "BSDF_PRINCIPLED")
    links.new(mix.outputs[2], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = glow
    ob.data.materials.append(m)
    return ob, ramp


def key(ob, frame, **props):
    """Keyframe properties: key(ob, 10, location=(..), rotation_euler=(..), scale=(..))."""
    for k, v in props.items():
        setattr(ob, k, v)
        ob.keyframe_insert(k, frame=frame)
