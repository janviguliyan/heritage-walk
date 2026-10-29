"""The land beyond Konark's walls, modelled and rendered in Blender (Cycles) as a panorama band
round the horizon (no photographs): the coastal plain of Puri district as it is today, with
groves of mango and cashew, casuarina plantations, coconut palms, villages of tiled and thatched
roofs among their trees, open fields, and the Bay of Bengal three kilometres to the east-southeast.

Nothing nearer than the site's own green belt (~280 m) is drawn: the walk has those trees in 3D.
Lit by the walk's morning sun (azimuth 100°, elevation 26°).

Writes two equirectangular strips (north at the centre, east a quarter turn to the right),
elevation -4° to +9°, to tools/blender/out/distant/:
  horizon-color.png   the landscape, lit, on transparency (the sky is the walk's own)
  horizon-dist.png    the distance to each pixel, sqrt(d / 8000 m), so the walk hazes it with
                      its own live fog
foliage_post.py's sibling, distant_post.py, turns them into the site's webp files.

  blender -b -P tools/blender/distant.py -- [--width 8192] [--samples 96]
"""
import argparse
import math
import os
import sys

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "tools", "blender", "out", "distant")
EL_LO, EL_HI = -4.0, 9.0
EYE = 2.5
NEAR = 280.0
FAR = 8000.0
# the walk's site, in Blender's frame (x east, y north): its centre is roughly at the origin


def lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


class Mesh:
    """Accumulates triangles and quads with a colour per vertex."""

    def __init__(self):
        self.v, self.f, self.c = [], [], []
        self.n = 0

    def add(self, verts, faces, cols):
        self.v.append(verts)
        self.f.extend([[i + self.n for i in f] for f in faces])
        self.c.append(cols)
        self.n += len(verts)

    def object(self, name):
        v = np.concatenate(self.v).astype(np.float32)
        c = np.concatenate(self.c).astype(np.float32)
        me = bpy.data.meshes.new(name)
        me.from_pydata(v.tolist(), [], self.f)
        me.update()
        ca = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
        ca.data.foreach_set("color", np.concatenate([c, np.ones((len(c), 1), np.float32)], 1).ravel())
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        print(f"{name}: {len(v):,} vertices, {len(self.f):,} faces")
        return ob


def ico():
    """A unit icosphere (one subdivision): vertices and triangles."""
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    v = [np.array(p, float) / np.linalg.norm(p) for p in v]
    mid = {}
    out = []

    def m(a, b):
        k = (min(a, b), max(a, b))
        if k not in mid:
            p = v[a] + v[b]
            v.append(p / np.linalg.norm(p))
            mid[k] = len(v) - 1
        return mid[k]

    for a, b, c in f:
        ab, bc, ca = m(a, b), m(b, c), m(c, a)
        out += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    return np.array(v), out


ICO_V, ICO_F = ico()


def blob(m, rng, c, r, col):
    """A lumpy crown: an icosphere pushed in and out, darker underneath."""
    n = rng.normal(0, 1, (len(ICO_V), 1))
    k = 1 + 0.18 * n
    v = ICO_V * k * r + c
    shade = (0.55 + 0.45 * (ICO_V[:, 2:3] + 1) / 2) * rng.uniform(0.9, 1.1)
    m.add(v, ICO_F, np.clip(np.asarray(col) * shade, 0, 1))


def trunk(m, base, h, r, col):
    a = np.linspace(0, 2 * math.pi, 6, endpoint=False)
    bot = np.stack([base[0] + np.cos(a) * r, base[1] + np.sin(a) * r, np.full(6, base[2])], 1)
    top = np.stack([base[0] + np.cos(a) * r * 0.6, base[1] + np.sin(a) * r * 0.6, np.full(6, base[2] + h)], 1)
    f = [(i, (i + 1) % 6, 6 + (i + 1) % 6, 6 + i) for i in range(6)]
    m.add(np.concatenate([bot, top]), f, np.tile(col, (12, 1)))


def broadleaf(m, rng, p, h):
    green = lin([rng.uniform(0.16, 0.26), rng.uniform(0.24, 0.34), rng.uniform(0.08, 0.14)])
    trunk(m, p, h * 0.45, h * 0.035, lin([0.25, 0.2, 0.16]))
    for _ in range(rng.integers(3, 6)):
        o = rng.normal(0, h * 0.13, 3) * [1, 1, 0.6]
        blob(m, rng, p + [0, 0, h * 0.68] + o, h * rng.uniform(0.2, 0.3), green)


def casuarina(m, rng, p, h):
    green = lin([rng.uniform(0.22, 0.3), rng.uniform(0.3, 0.36), rng.uniform(0.2, 0.26)])
    trunk(m, p, h * 0.7, h * 0.015, lin([0.3, 0.25, 0.2]))
    for j in range(3):
        z = h * (0.45 + j * 0.2)
        r = h * (0.13 - j * 0.03)
        v = ICO_V * [r, r, r * 1.8] * (1 + 0.15 * rng.normal(0, 1, (len(ICO_V), 1))) + p + [0, 0, z]
        m.add(v, ICO_F, np.clip(green * (0.6 + 0.4 * (ICO_V[:, 2:3] + 1) / 2), 0, 1))


def palm(m, rng, p, h):
    lean = rng.normal(0, 0.06, 2)
    top = p + [lean[0] * h, lean[1] * h, h]
    trunk(m, p, h, h * 0.014, lin([0.42, 0.38, 0.32]))
    # the trunk leans: shift its top ring by moving the last six vertices
    m.v[-1][6:] += [lean[0] * h, lean[1] * h, 0]
    green = lin([0.3, 0.38, 0.14])
    for k in range(9):
        a = k / 9 * 2 * math.pi + rng.uniform(0, 0.3)
        d = np.array([math.cos(a), math.sin(a), 0])
        s = np.array([-math.sin(a), math.cos(a), 0])
        L = h * 0.35
        pts = [top, top + d * L * 0.5 + [0, 0, L * 0.15], top + d * L + [0, 0, -L * 0.3]]
        w = h * 0.05
        v = [pts[0] - s * w * 0.3, pts[0] + s * w * 0.3, pts[1] - s * w, pts[1] + s * w, pts[2] - s * w * 0.2, pts[2] + s * w * 0.2]
        m.add(np.array(v), [(0, 1, 3, 2), (2, 3, 5, 4)], np.tile(green, (6, 1)))


def house(m, rng, p, a):
    w, d, hgt = rng.uniform(5, 9), rng.uniform(4, 6), rng.uniform(2.6, 3.4)
    ca, sa = math.cos(a), math.sin(a)

    def T(x, y, z):
        return [p[0] + x * ca - y * sa, p[1] + x * sa + y * ca, p[2] + z]

    wall = lin([rng.uniform(0.7, 0.85), rng.uniform(0.62, 0.75), rng.uniform(0.5, 0.62)])
    # some walls whitewashed, some washed blue or ochre, as in the villages round Konark
    r = rng.random()
    if r < 0.25:
        wall = lin([0.86, 0.86, 0.82])
    elif r < 0.35:
        wall = lin([0.55, 0.66, 0.74])
    v = [T(x, y, z) for z in (0, hgt) for x, y in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    m.add(np.array(v), f, np.tile(wall, (8, 1)))
    roof = lin([0.55, 0.3, 0.2]) if rng.random() < 0.55 else lin([0.5, 0.42, 0.28])
    o = 0.5
    rv = [T(-w / 2 - o, -d / 2 - o, hgt - 0.2), T(w / 2 + o, -d / 2 - o, hgt - 0.2), T(w / 2 + o, 0, hgt + d * 0.35), T(-w / 2 - o, 0, hgt + d * 0.35),
          T(-w / 2 - o, d / 2 + o, hgt - 0.2), T(w / 2 + o, d / 2 + o, hgt - 0.2)]
    m.add(np.array(rv), [(0, 1, 2, 3), (3, 2, 5, 4)], np.tile(roof, (6, 1)))


def noise2(x, y, seed):
    """Smooth value noise for grove and field patterns (numpy, vectorised)."""
    rng = np.random.default_rng(seed)
    g = rng.random((64, 64))
    fx, fy = x % 64, y % 64
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    tx, ty = fx - ix, fy - iy
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = g[iy % 64, ix % 64]
    b = g[iy % 64, (ix + 1) % 64]
    c = g[(iy + 1) % 64, ix % 64]
    d = g[(iy + 1) % 64, (ix + 1) % 64]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def sea_x(y):
    """The coast: the shore line runs NNE-SSW about 3 km east of the temple."""
    return 3000 + 0.35 * y


def build(rng):
    trees = Mesh()
    # tree sites: dense near the belt, thinning with distance; groves where the noise is high,
    # open fields where it is low
    N = 60000
    r = NEAR + (FAR - NEAR) * rng.random(N) ** 2.2
    a = rng.uniform(0, 2 * math.pi, N)
    x, y = np.cos(a) * r, np.sin(a) * r
    grove = noise2(x / 180, y / 180, 3) * 0.7 + noise2(x / 60, y / 60, 4) * 0.3
    keep = (grove > 0.5) & (x < sea_x(y) - 150)
    kind = noise2(x / 400, y / 400, 5)
    print("trees:", int(keep.sum()))
    for xi, yi, ki in zip(x[keep], y[keep], kind[keep]):
        p = np.array([xi, yi, 0.0])
        near_coast = xi > sea_x(yi) - 900
        u = rng.random()
        if near_coast and u < 0.6 or ki > 0.62 and u < 0.7:
            casuarina(trees, rng, p, rng.uniform(14, 24))
        elif u < 0.22 or near_coast and u < 0.85:
            palm(trees, rng, p, rng.uniform(11, 18))
        else:
            broadleaf(trees, rng, p, rng.uniform(8, 16))
    trees.object("trees")
    # villages: clusters of houses among their own trees
    homes = Mesh()
    villages = [(-1400, 900), (-2200, -600), (900, 2100), (1200, -1800), (-600, -2600), (2300, 400), (-3200, 2400), (3500 - 1500, -3200)]
    for vx, vy in villages:
        for _ in range(rng.integers(30, 70)):
            p = np.array([vx + rng.normal(0, 120), vy + rng.normal(0, 120), 0.0])
            if math.hypot(p[0], p[1]) < NEAR + 60:
                continue
            house(homes, rng, p, rng.uniform(0, math.pi) if rng.random() < 0.3 else math.atan2(vy, vx) + rng.normal(0, 0.15))
            if rng.random() < 0.7:
                (palm if rng.random() < 0.5 else broadleaf)(homes, rng, p + [rng.normal(0, 8), rng.normal(0, 8), 0], rng.uniform(8, 15))
    homes.object("villages")


def ground():
    """Fields, scrub and sand; the beach and the sea to the east."""
    bpy.ops.mesh.primitive_plane_add(size=2 * FAR * 1.4, location=(0, 0, 0))
    g = bpy.context.object
    m = bpy.data.materials.new("ground")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 1.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.0012
    nz.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = 0.35, tuple(lin([0.36, 0.4, 0.2])) + (1,)
    cr.elements[1].position, cr.elements[1].color = 0.65, tuple(lin([0.55, 0.5, 0.32])) + (1,)
    e = cr.elements.new(0.5)
    e.color = tuple(lin([0.3, 0.38, 0.16])) + (1,)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    g.data.materials.append(m)
    # the sea: a plane east of the shore line, with a pale beach strip before it
    for name, off, z, col, rough in (("beach", 0, 0.02, [0.8, 0.72, 0.56], 1.0), ("sea", 140, 0.05, [0.2, 0.32, 0.38], 0.08)):
        L = FAR * 3
        verts = [(sea_x(-L) + off, -L, z), (sea_x(L) + off, L, z), (FAR * 2, L, z), (FAR * 2, -L, z)]
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        mm = bpy.data.materials.new(name)
        mm.use_nodes = True
        bb = mm.node_tree.nodes["Principled BSDF"]
        bb.inputs["Base Color"].default_value = tuple(lin(col)) + (1,)
        bb.inputs["Roughness"].default_value = rough
        ob.data.materials.append(mm)


def lights():
    sc = bpy.context.scene
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.5
    sun.angle = math.radians(0.6)
    sun.color = (1.0, 0.9, 0.78)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    az, el = math.radians(100), math.radians(26)
    d = np.array([math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)])
    from mathutils import Vector

    so.rotation_euler = (-Vector(d)).to_track_quat("-Z", "Y").to_euler()
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    sky = w.node_tree.nodes.new("ShaderNodeTexSky")
    w.node_tree.links.new(sky.outputs[0], w.node_tree.nodes["Background"].inputs[0])
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    sc.world = w


def vertex_colour_material():
    m = bpy.data.materials.new("vc")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.9
    at = nt.nodes.new("ShaderNodeVertexColor")
    at.layer_name = "col"
    nt.links.new(at.outputs["Color"], b.inputs["Base Color"])
    return m


def distance_material():
    """Emission = sqrt(distance / FAR), read raw."""
    m = bpy.data.materials.new("dist")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    cd = nt.nodes.new("ShaderNodeCameraData")
    dv = nt.nodes.new("ShaderNodeMath")
    dv.operation = "DIVIDE"
    dv.inputs[1].default_value = FAR
    sq = nt.nodes.new("ShaderNodeMath")
    sq.operation = "SQRT"
    sq.use_clamp = True
    nt.links.new(cd.outputs["View Distance"], dv.inputs[0])
    nt.links.new(dv.outputs[0], sq.inputs[0])
    nt.links.new(sq.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=8192)
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dv in prefs.devices:
        dv.use = True
    sc.cycles.device = "GPU"
    sc.render.film_transparent = True
    rng = np.random.default_rng(a.seed)
    build(rng)
    vc = vertex_colour_material()
    for o in sc.objects:
        if o.type == "MESH" and not o.data.materials:
            o.data.materials.append(vc)
    ground()
    lights()
    cam = bpy.data.cameras.new("cam")
    cam.type = "PANO"
    cam.panorama_type = "EQUIRECTANGULAR"
    cam.clip_end = FAR * 2
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    co.location = (0, 0, EYE)
    co.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = co
    W = a.width
    sc.render.resolution_x, sc.render.resolution_y = W, W // 2
    sc.render.resolution_percentage = 100
    # render only the band round the horizon
    sc.render.use_border = True
    sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = 0.0, 1.0
    sc.render.border_min_y = (90 + EL_LO) / 180
    sc.render.border_max_y = (90 + EL_HI) / 180
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "16"
    os.makedirs(OUT, exist_ok=True)
    # 1. the landscape, lit
    sc.cycles.samples = a.samples
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "AgX"
    sc.render.filepath = os.path.join(OUT, "horizon-color.png")
    bpy.ops.render.render(write_still=True)
    # 2. distance, raw
    dm = distance_material()
    for o in sc.objects:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(dm)
    sc.world = None
    sc.cycles.samples = 4
    sc.cycles.use_denoising = False
    sc.view_settings.view_transform = "Raw"
    sc.render.filepath = os.path.join(OUT, "horizon-dist.png")
    bpy.ops.render.render(write_still=True)
    print("done")


main()
