"""Foliage for the walk, modelled and rendered in Blender (Cycles), no photographs:

  leaf      a cluster of folded, pointed leaves on twigs (broadleaf trees, shrubs, banyan)
  needle    casuarina needles: fine jointed strands falling from a twig
  branchlet a casuarina tuft: fine jointed branchlets hanging from a twig
  frond     a coconut palm frond: midrib and drooping leaflets
  tuft      a tuft of grass blades seen from the side (the 3D grass on the lawns)
  lawn      a mown lawn, 250,000 blades on a seamless 5 m tile, seen from above

Each is rendered orthographically on transparency as an albedo (with the occlusion between
leaves and blades) and, for leaf / needle / lawn, a tangent-space normal map. Leaves and needles
are near-white so each tree's own green tints them. Raw PNGs go to tools/blender/out/foliage;
foliage_post.py turns them into the site's webp files.

  blender -b -P tools/blender/foliage.py -- [leaf needle tuft lawn]
"""
import math
import os
import sys

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "tools", "blender", "out", "foliage")


def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


class Mesh:
    """Accumulates quads with a colour per vertex."""

    def __init__(self):
        self.v, self.f, self.c = [], [], []
        self.n = 0

    def strips(self, pts, cols):
        """pts: (N, rows, 2, 3) — N strips, each `rows` pairs of points; cols: (N, rows, 2, 3)."""
        N, R = pts.shape[:2]
        self.v.append(pts.reshape(-1, 3))
        self.c.append(cols.reshape(-1, 3))
        base = self.n + np.arange(N)[:, None] * R * 2 + np.arange(R - 1)[None, :] * 2
        q = np.stack([base, base + 1, base + 3, base + 2], -1).reshape(-1, 4)
        self.f.append(q)
        self.n += N * R * 2

    def grid(self, pts, cols):
        """pts: (rows, cols, 3) one surface."""
        R, C = pts.shape[:2]
        self.v.append(pts.reshape(-1, 3))
        self.c.append(cols.reshape(-1, 3))
        i = self.n + np.arange(R - 1)[:, None] * C + np.arange(C - 1)[None, :]
        self.f.append(np.stack([i, i + 1, i + C + 1, i + C], -1).reshape(-1, 4))
        self.n += R * C

    def object(self, name):
        v = np.concatenate(self.v).astype(np.float32)
        f = np.concatenate(self.f).astype(np.int32)
        c = np.concatenate(self.c).astype(np.float32)
        me = bpy.data.meshes.new(name)
        me.vertices.add(len(v))
        me.vertices.foreach_set("co", v.ravel())
        me.loops.add(f.size)
        me.loops.foreach_set("vertex_index", f.ravel())
        me.polygons.add(len(f))
        me.polygons.foreach_set("loop_start", np.arange(0, f.size, 4, dtype=np.int32))
        me.polygons.foreach_set("loop_total", np.full(len(f), 4, np.int32))
        me.update()
        me.validate()
        ca = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
        rgba = np.concatenate([c, np.ones((len(c), 1), np.float32)], 1)
        ca.data.foreach_set("color", rgba.ravel())
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        print(f"{name}: {len(v):,} vertices")
        return ob


def blades(base, az, height, lean, width, curl=0.0, rows=5):
    """Tapered grass blades, vectorised. base (N,3); az, height, lean (radians from upright),
    width: (N,). Each blade bends further over toward its tip. Returns (N, rows, 2, 3)."""
    N = len(base)
    t = np.linspace(0, 1, rows)[None, :]
    bend = lean[:, None] * (0.35 + 0.65 * t) + curl * t ** 2
    # walk up the blade in small steps so it arcs
    seg = height[:, None] / (rows - 1)
    ang = bend
    dh = np.cumsum(np.concatenate([np.zeros((N, 1)), seg * np.sin(ang[:, 1:])], 1), 1)
    dv = np.cumsum(np.concatenate([np.zeros((N, 1)), seg * np.cos(ang[:, 1:])], 1), 1)
    d = np.stack([np.cos(az), np.sin(az)], -1)
    side = np.stack([-np.sin(az), np.cos(az)], -1)
    w = width[:, None] * (1 - t ** 1.6) * 0.5 + 1e-4
    c = np.empty((N, rows, 3))
    c[..., 0] = base[:, None, 0] + d[:, None, 0] * dh
    c[..., 1] = base[:, None, 1] + d[:, None, 1] * dh
    c[..., 2] = base[:, None, 2] + dv
    out = np.empty((N, rows, 2, 3))
    for k, s in enumerate((-1, 1)):
        out[..., k, 0] = c[..., 0] + side[:, None, 0] * w * s
        out[..., k, 1] = c[..., 1] + side[:, None, 1] * w * s
        out[..., k, 2] = c[..., 2]
    return out


def reset(w, h, extent, ao_dist, samples=128):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dv in prefs.devices:
        dv.use = True
    sc.cycles.device = "GPU"
    sc.cycles.samples = samples
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "16"
    sc.world = bpy.data.worlds.new("w")
    sc.world.color = (0, 0, 0)
    sc["ao"] = ao_dist
    sc["extent"] = extent


def camera(center, ortho, look="down"):
    sc = bpy.context.scene
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = ortho
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    if look == "down":
        co.location = (center[0], center[1], 50)
        co.rotation_euler = (0, 0, 0)
    else:  # side: looking along +Y at the XZ plane
        co.location = (center[0], -50, center[1])
        co.rotation_euler = (math.pi / 2, 0, 0)
    cam.clip_end = 200
    sc.camera = co


def material(kind):
    """'albedo': vertex colour darkened by occlusion; 'normal': camera-space normal as colour."""
    sc = bpy.context.scene
    m = bpy.data.materials.new(kind)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    if kind == "albedo":
        at = nt.nodes.new("ShaderNodeVertexColor")
        at.layer_name = "col"
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.samples = 16
        ao.inputs["Distance"].default_value = sc["ao"]
        # occlusion: 1 in the open, down to ~0.45 deep in a cluster
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.45
        nt.links.new(ao.outputs["AO"], mr.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(at.outputs["Color"], mul.inputs[6])
        nt.links.new(mr.outputs[0], mul.inputs[7])
        nt.links.new(mul.outputs[2], em.inputs["Color"])
    else:
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        vt = nt.nodes.new("ShaderNodeVectorTransform")
        vt.vector_type = "NORMAL"
        vt.convert_from = "WORLD"
        vt.convert_to = "CAMERA"
        nt.links.new(geo.outputs["Normal"], vt.inputs[0])
        # faces seen from behind: flip toward the camera (Blender's camera looks down -Z)
        flip = nt.nodes.new("ShaderNodeMath")
        flip.operation = "MULTIPLY_ADD"
        flip.inputs[1].default_value = -2.0
        flip.inputs[2].default_value = 1.0
        nt.links.new(geo.outputs["Backfacing"], flip.inputs[0])
        sm = nt.nodes.new("ShaderNodeVectorMath")
        sm.operation = "SCALE"
        nt.links.new(vt.outputs[0], sm.inputs[0])
        nt.links.new(flip.outputs[0], sm.inputs["Scale"])
        # camera space has +Z toward the viewer; the map wants it in blue: n * 0.5 + 0.5
        ma = nt.nodes.new("ShaderNodeVectorMath")
        ma.operation = "MULTIPLY_ADD"
        nt.links.new(sm.outputs[0], ma.inputs[0])
        ma.inputs[1].default_value = (0.5, 0.5, 0.5)
        ma.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(ma.outputs[0], em.inputs["Color"])
    return m


def render(name, passes=("albedo", "normal")):
    sc = bpy.context.scene
    os.makedirs(OUT, exist_ok=True)
    obs = [o for o in sc.objects if o.type == "MESH"]
    for kind in passes:
        m = material(kind)
        for o in obs:
            o.data.materials.clear()
            o.data.materials.append(m)
        sc.view_settings.view_transform = "Standard" if kind == "albedo" else "Raw"
        sc.cycles.samples = sc.cycles.samples if kind == "albedo" else 8
        sc.cycles.use_denoising = kind == "albedo"
        sc.render.filepath = os.path.join(OUT, f"{name}-{kind}.png")
        bpy.ops.render.render(write_still=True)
        print("wrote", sc.render.filepath)


def leaf_shape(m, rng, origin, az, tilt, L, W, lum):
    """One leaf: lanceolate, folded along the midrib, curling down toward the tip."""
    nu, nv = 12, 7
    t = np.linspace(0, 1, nu)[:, None]
    v = np.linspace(-1, 1, nv)[None, :]
    half = W * np.sin(np.pi * np.clip(t, 0, 1) ** 0.75) ** 0.9
    x = t * L
    y = v * half
    fold = 0.35 * W * np.abs(v) * np.sin(np.pi * t) ** 0.5
    z = fold - 0.25 * L * t ** 2 + rng.uniform(-0.03, 0.03) * L * np.sin(np.pi * t)
    p = np.stack([x + 0 * v, y, z], -1)
    # tilt up out of the plane, then turn about the twig
    ct, st = math.cos(tilt), math.sin(tilt)
    p = np.stack([p[..., 0] * ct - p[..., 2] * st, p[..., 1], p[..., 0] * st + p[..., 2] * ct], -1)
    ca, sa = math.cos(az), math.sin(az)
    p = np.stack([p[..., 0] * ca - p[..., 1] * sa, p[..., 0] * sa + p[..., 1] * ca, p[..., 2]], -1) + origin
    # colour: the leaf's own value, a paler midrib, faint paired veins, edges a shade darker
    k = lum * np.ones((nu, nv))
    k = k * np.where(np.abs(v) < 0.2, 1.1, 1.0) * np.where(np.abs(v) > 0.85, 0.9, 1.0)
    k = k * (1 + 0.04 * np.sin(t * 40 - np.abs(v) * 6))
    col = srgb_to_lin(np.clip(np.stack([k * 0.93, k, k * 0.84], -1), 0, 1))
    m.grid(p, col)


def leaf():
    reset(512, 512, 2.0, 0.35)
    camera((0, 0), 2.0)
    rng = np.random.default_rng(17)
    m = Mesh()
    # a few twigs in three depth layers; each a spray of leaves round its tip
    for layer in range(3):
        for _ in range(7):
            o = np.array([rng.uniform(-0.42, 0.42), rng.uniform(-0.42, 0.42), (layer - 1) * 0.18])
            base = rng.uniform(0, 2 * math.pi)
            for k in range(6):
                az = base + (k - 2.5) * 0.55 + rng.uniform(-0.15, 0.15)
                L = rng.uniform(0.32, 0.5)
                leaf_shape(m, rng, o + rng.uniform(-0.02, 0.02, 3), az, rng.uniform(-0.25, 0.35), L, L * rng.uniform(0.2, 0.27), rng.uniform(0.62, 1.0))
    m.object("leaves")
    render("leaf")


def needle():
    # 2:1 card, x in [-1, 1], y in [-0.5, 0.5]; strands hang from the top edge
    reset(512, 256, 2.0, 0.08)
    camera((0, 0), 2.0)
    rng = np.random.default_rng(29)
    N = 280
    m = Mesh()
    rows = 14
    x0 = rng.uniform(-0.97, 0.97, N)
    top = 0.48 - rng.uniform(0, 0.08, N)
    L = rng.uniform(0.45, 0.93, N)
    sway = rng.uniform(-0.12, 0.12, N)
    t = np.linspace(0, 1, rows)[None, :]
    cx = x0[:, None] + sway[:, None] * t ** 1.5
    cy = top[:, None] - L[:, None] * t
    cz = rng.uniform(-0.1, 0.1, N)[:, None] + 0 * t
    # jointed: the strand narrows a little at each joint
    w = rng.uniform(0.0028, 0.0048, N)[:, None] * (1 - 0.35 * (np.abs(np.sin(t * L[:, None] * 60)) < 0.25)) * (1 - 0.5 * t)
    pts = np.empty((N, rows, 2, 3))
    for k, s in enumerate((-1, 1)):
        pts[..., k, 0] = cx + w * s
        pts[..., k, 1] = cy
        pts[..., k, 2] = cz
    lum = rng.uniform(0.6, 1.0, N)[:, None, None] * (1 - 0.15 * t[..., None])
    col = srgb_to_lin(np.clip(np.concatenate([lum * 0.92, lum, lum * 0.9], -1), 0, 1))
    m.strips(pts, np.repeat(col[:, :, None, :], 2, 2))
    m.object("needles")
    render("needle")


def branchlet():
    """A casuarina tuft: a twig across the top, and from it hundreds of fine jointed branchlets
    (the 'needles') hanging and fanning out below. Near-white, tinted in the walk."""
    # card 2 wide by 3 tall: x in [-1, 1], y in [-1.5, 1.5]
    reset(512, 768, 3.0, 0.12)
    camera((0, 0), 3.0)
    rng = np.random.default_rng(61)
    m = Mesh()
    # the twig: an arc across the top, from which the branchlets hang
    nodes = 14
    tt = np.linspace(0, 1, nodes)
    tx = -0.75 + 1.5 * tt
    ty = 1.32 - 0.25 * (2 * tt - 1) ** 2
    rows = 18
    strands = []
    for i in range(nodes):
        for _ in range(rng.integers(14, 22)):
            L = rng.uniform(0.7, 2.3) * (0.7 + 0.3 * np.sin(np.pi * tt[i]))
            spread = rng.normal(0, 0.22) + (tt[i] - 0.5) * 0.5
            t = np.linspace(0, 1, rows)
            x = tx[i] + rng.normal(0, 0.03) + spread * L * t ** 1.3 + rng.normal(0, 0.01) * np.sin(t * 9)
            y = ty[i] - L * t * (0.9 + 0.1 * t)
            z = rng.uniform(-0.25, 0.25) * t
            # jointed: a little narrower at each joint, and tapering to the tip
            w = rng.uniform(0.0045, 0.007) * (1 - 0.55 * t) * (1 - 0.3 * (np.abs(np.sin(t * L * 40)) < 0.2))
            if np.any(np.abs(x) > 0.98) or np.any(y < -1.48):
                keep = (np.abs(x) < 0.98) & (y > -1.48)
                n = max(2, int(np.argmin(keep)) if not keep.all() else rows)
                x, y, z, w, t = x[:n], y[:n], z[:n], w[:n], t[:n]
                if n < 3:
                    continue
            strands.append((x, y, z, w, t))
    for x, y, z, w, t in strands:
        pts = np.zeros((1, len(x), 2, 3))
        for k, sg in enumerate((-1, 1)):
            pts[0, :, k, 0] = x + w * sg
            pts[0, :, k, 1] = y
            pts[0, :, k, 2] = z
        lum = rng.uniform(0.62, 1.0) * (1 - 0.18 * t)
        col = srgb_to_lin(np.clip(np.stack([lum * 0.93, lum, lum * 0.9], -1), 0, 1))
        m.strips(pts, np.repeat(col[None, :, None, :], 2, 2))
    # the twig itself, a shade darker and browner
    tw = np.zeros((1, nodes, 2, 3))
    for k, sg in enumerate((-1, 1)):
        tw[0, :, k, 0] = tx
        tw[0, :, k, 1] = ty + sg * 0.012
        tw[0, :, k, 2] = 0.3
    m.strips(tw, np.broadcast_to(srgb_to_lin([0.55, 0.5, 0.42]), (1, nodes, 2, 3)).copy())
    m.object("branchlet")
    render("branchlet")


def frond():
    """A coconut frond seen from above, base at the bottom: a stiff midrib with ~70 leaflets a
    side, longest at the middle, angled forward and drooping (shading from occlusion)."""
    # card 1 wide (x in [-0.5, 0.5]) by 4 long (y in [0, 4])
    reset(256, 1024, 4.0, 0.12)
    camera((0, 2.0), 4.0)
    rng = np.random.default_rng(53)
    m = Mesh()
    # the midrib: a tapering strip, paler and yellower
    rows = 24
    t = np.linspace(0, 1, rows)
    y = 0.05 + t * 3.9
    w = 0.03 * (1 - 0.8 * t) + 0.004
    rib = np.zeros((1, rows, 2, 3))
    rib[0, :, 0, 0], rib[0, :, 1, 0] = -w, w
    rib[0, :, :, 1] = y[:, None]
    rib[0, :, :, 2] = 0.03
    m.strips(rib, np.broadcast_to(srgb_to_lin([0.62, 0.6, 0.32]), (1, rows, 2, 3)).copy())
    # leaflets along both sides
    n = 70
    for side in (-1, 1):
        tt = np.sort(rng.uniform(0.04, 0.98, n))
        L = 0.48 * np.sin(np.pi * np.clip(tt, 0, 1) ** 0.85) ** 0.6 * rng.uniform(0.85, 1.05, n) + 0.04
        ang = np.radians(rng.uniform(52, 66, n))  # from the midrib, pointing toward the tip
        sag = rng.uniform(-0.15, 0.05, n)
        k = 9
        u = np.linspace(0, 1, k)[None, :]
        base = np.stack([side * 0.01 + 0 * tt, 0.05 + tt * 3.9], -1)
        dx = side * np.sin(ang)[:, None] * L[:, None] * u
        dy = np.cos(ang)[:, None] * L[:, None] * u + sag[:, None] * L[:, None] * u ** 2
        half = 0.022 * np.sin(np.pi * np.clip(u, 0, 1) ** 0.7) + 0.002
        # the leaflet's width runs across its own direction
        nx = -np.cos(ang)[:, None] * side
        ny = np.sin(ang)[:, None]
        pts = np.empty((n, k, 2, 3))
        for j, sg in enumerate((-1, 1)):
            pts[..., j, 0] = base[:, None, 0] + dx + nx * half * sg
            pts[..., j, 1] = base[:, None, 1] + dy + ny * half * sg
            # folded down from the midrib (V-shaped frond) and drooping toward the tip
            pts[..., j, 2] = -0.08 * u - 0.05 * u ** 2 + 0.006 * sg
        lum = rng.uniform(0.8, 1.05, n)[:, None, None]
        c = np.array([0.45, 0.55, 0.2]) * lum * (0.85 + 0.15 * u[..., None])
        # the odd browned leaflet tip
        c = np.where((rng.random(n) < 0.08)[:, None, None] & (u[..., None] > 0.7), np.array([0.55, 0.45, 0.22]), c)
        m.strips(pts, np.repeat(srgb_to_lin(np.clip(c, 0, 1))[:, :, None, :], 2, 2))
    m.object("frond")
    render("frond")


def grass_cols(rng, N, rows, dry=0.12, root=(0.16, 0.24, 0.07)):
    """Grass greens, darker at the root, with the odd sun-dried blade."""
    t = np.linspace(0, 1, rows)[None, :, None]
    root = np.array(root)
    tip = np.array([0.44, 0.55, 0.2]) * rng.uniform(0.8, 1.15, (N, 1, 1))
    c = root + (tip - root) * t ** 0.7
    d = (rng.random(N) < dry)[:, None, None]
    c = np.where(d, c * np.array([1.45, 1.2, 0.85]), c)
    return np.repeat(srgb_to_lin(np.clip(c, 0, 1))[:, :, None, :], 2, 2)


def tuft():
    # a square card seen side on: x in [-0.5, 0.5], height z in [0, 1]
    reset(512, 512, 1.0, 0.25)
    camera((0, 0.5), 1.0, "side")
    rng = np.random.default_rng(41)
    N = 70
    r = rng.uniform(0, 0.16, N) ** 0.8
    a = rng.uniform(0, 2 * math.pi, N)
    base = np.stack([np.cos(a) * r, np.sin(a) * r, np.zeros(N)], -1)
    az = a + rng.uniform(-0.6, 0.6, N)
    h = rng.uniform(0.45, 0.88, N)
    lean = rng.uniform(0.03, 0.32, N) + r * 1.2
    w = rng.uniform(0.025, 0.045, N)
    pts = blades(base, az, h, lean, w, curl=0.15, rows=8)
    m = Mesh()
    # the root only a little darker than the lawn it stands in, so tufts don't read as spots
    m.strips(pts, grass_cols(rng, N, 8, 0.15, (0.26, 0.33, 0.1)))
    m.object("tuft")
    render("tuft", ("albedo",))


def lawn():
    # a 5 m tile (the lawns' uv tile) seen from above, seamless: blades near an edge repeat
    # across it
    S = 5.0
    reset(2048, 2048, S, 0.04, 96)
    camera((S / 2, S / 2), S)
    rng = np.random.default_rng(71)
    N = 250000
    base = np.stack([rng.uniform(0, S, N), rng.uniform(0, S, N), np.zeros(N)], -1)
    # clumps: blades crowd and grow taller in patches; mown, so short
    cl = np.sin(base[:, 0] * 2.3 + np.sin(base[:, 1] * 1.7)) * np.sin(base[:, 1] * 2.9 + 1.3)
    h = rng.uniform(0.04, 0.08, N) * (1 + 0.35 * cl)
    lean = rng.uniform(0.5, 1.35, N)
    az = rng.uniform(0, 2 * math.pi, N)
    w = rng.uniform(0.005, 0.009, N)
    rows = 3
    m = Mesh()
    pts = blades(base, az, h, lean, w, rows=rows)
    cols = grass_cols(rng, N, rows, 0.08)
    m.strips(pts, cols)
    # a blade by the left edge reappears just off the right (shifted +S), and so on, so blades
    # leaning across an edge show on the far side too
    def edge(c, o):
        return np.ones(N, bool) if o == 0 else (c < 0.1) if o > 0 else (c > S - 0.1)

    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            if ox == 0 and oy == 0:
                continue
            near = edge(base[:, 0], ox) & edge(base[:, 1], oy)
            p = pts[near].copy()
            p[..., 0] += ox
            p[..., 1] += oy
            m.strips(p, cols[near])
    # the thatch under the blades: old dry grass and earth, mostly hidden
    soil = np.array([[[-0.2, -0.2, -0.002], [S + 0.2, -0.2, -0.002]], [[-0.2, S + 0.2, -0.002], [S + 0.2, S + 0.2, -0.002]]])
    m.grid(soil, np.full((2, 2, 3), srgb_to_lin([0.27, 0.27, 0.11])))
    m.object("lawn")
    render("lawn")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    which = argv or ["leaf", "needle", "branchlet", "frond", "tuft", "lawn"]
    for w in which:
        globals()[w]()


main()
