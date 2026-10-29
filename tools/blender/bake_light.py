"""Bake Konark's morning light with Cycles (true bounced light, from every surface and the trees),
into the walk's own lightmap format, replacing the three.js bake (src/bake/):

  lm-<page>.webp   RGB: all light except the direct sun (sky, and every bounce), ÷ scale
  sun-<page>.webp  grey: how much of the sun's disc each texel sees (its shadows)
  v-<mat>.bin      the same for the per-vertex parts: two bytes a vertex (sky luminance, sun)

The site keeps its live sun (so normal maps still read), scales it by the sun channel, and takes
the RGB as its ambient light. Run tools/blender/export_konark.mjs first.

  blender -b -P tools/blender/bake_light.py -- [--samples 256] [--pages 0 1 ...] [--no-vertex]
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import temple  # noqa: E402

ROOT = temple.ROOT
OUT = os.path.join(ROOT, "public", "sites", "konark", "bake")
RAW = os.path.join(ROOT, "tools", "blender", "out", "bake")
PAGE = 4096
SCALE = 3  # baked irradiance is stored ÷ this (manifest "scale")
# the site's morning (src/bake/run.ts): sun at azimuth 100°, elevation 26°, and the live sun's
# intensity at that hour (src/engine/Atmosphere.tsx), so the units match the walk's own light
AZ, EL = 100, 26
SUN = 3.16
SKY = 2.3  # irradiance of the open sky on an up-facing surface (as src/bake/run.ts)


def sun_dir():
    az, el = math.radians(AZ), math.radians(EL)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def lights():
    sc = bpy.context.scene
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = SUN
    sun.angle = math.radians(2.4)  # the disc, softened a little (as the three.js bake)
    sun.color = (1.0, 1.0, 1.0)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (-sun_dir()).to_track_quat("-Z", "Y").to_euler()
    # a dawn sky: warm at the horizon, blue overhead, brightest toward the sun; radiance chosen
    # so an up-facing surface under open sky receives SKY
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    nt = w.node_tree
    N = nt.nodes
    L = nt.links
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Generated"], sep.inputs[0])
    up = N.new("ShaderNodeMath")
    up.operation = "MAXIMUM"
    up.inputs[1].default_value = 0.0
    L.new(sep.outputs[2], up.inputs[0])
    pw = N.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 0.5
    L.new(up.outputs[0], pw.inputs[0])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = temple.lin("#f2d7b8")
    mix.inputs[7].default_value = temple.lin("#a9c3df")
    L.new(pw.outputs[0], mix.inputs[0])
    # toward the sun (horizontally): up to 1.8× near the horizon
    d = sun_dir()
    hs = Vector((d.x, d.y, 0)).normalized()
    dot = N.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = (hs.x, hs.y, 0)
    L.new(tc.outputs["Generated"], dot.inputs[0])
    tw = N.new("ShaderNodeMath")
    tw.operation = "MAXIMUM"
    tw.inputs[1].default_value = 0.0
    L.new(dot.outputs["Value"], tw.inputs[0])
    t3 = N.new("ShaderNodeMath")
    t3.operation = "POWER"
    t3.inputs[1].default_value = 3.0
    L.new(tw.outputs[0], t3.inputs[0])
    low = N.new("ShaderNodeMath")
    low.operation = "SUBTRACT"
    low.inputs[0].default_value = 1.0
    L.new(up.outputs[0], low.inputs[1])
    k = N.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    L.new(t3.outputs[0], k.inputs[0])
    L.new(low.outputs[0], k.inputs[1])
    k2 = N.new("ShaderNodeMath")
    k2.operation = "MULTIPLY_ADD"
    k2.inputs[1].default_value = 0.8
    k2.inputs[2].default_value = 1.0
    L.new(k.outputs[0], k2.inputs[0])
    boost = N.new("ShaderNodeVectorMath")
    boost.operation = "SCALE"
    L.new(mix.outputs[2], boost.inputs[0])
    L.new(k2.outputs[0], boost.inputs["Scale"])
    bg = N["Background"]
    L.new(boost.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = SKY / math.pi
    sc.world = w
    return so, bg


def setup(samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dv in prefs.devices:
        dv.use = True
    sc.cycles.device = "GPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 3
    sc.render.bake.margin = 2
    sc.render.bake.margin_type = "EXTEND"
    sc.render.bake.use_clear = True


def bake(objs, kind, direct=True, indirect=True, target="IMAGE_TEXTURES"):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    sc = bpy.context.scene
    sc.render.bake.target = target
    kw = {"type": kind}
    if kind == "DIFFUSE":
        kw["pass_filter"] = {p for p, on in (("DIRECT", direct), ("INDIRECT", indirect)) if on}
    if kind == "NORMAL":
        kw.update(normal_space="OBJECT")
    bpy.ops.object.bake(**kw)


def to_webp(arr, name):
    """arr: H×W×3 floats 0..1, rows bottom-up (Blender's order)."""
    os.makedirs(RAW, exist_ok=True)
    img = bpy.data.images.new(name, arr.shape[1], arr.shape[0], alpha=False)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.ones((arr.shape[0], arr.shape[1], 4), np.float32)
    rgba[..., :3] = arr
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    png = os.path.join(RAW, name + ".png")
    img.filepath_raw = png
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print(name, "mean", float(arr.mean()))
    subprocess.run(["cwebp", "-quiet", "-q", "90", png, "-o", os.path.join(OUT, name + ".webp")], check=True)


def smooth(a, valid, n, iters=2):
    """Quiet the sampling noise: average neighbours that lie on the same surface (same normal)."""
    for _ in range(iters):
        acc = a * valid[..., None]
        w = valid.astype(np.float32).copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                sh = lambda x: np.roll(np.roll(x, dy, 0), dx, 1)
                same = (np.sum(n * sh(n), -1) > 0.97) & valid & sh(valid)
                acc += sh(a) * same[..., None]
                w += same
        a = np.where(valid[..., None], acc / np.maximum(w, 1)[..., None], a)
    return a


def page(p, objs, world_bg, sky_strength):
    t0 = time.time()
    img = bpy.data.images.new(f"lm{p}", PAGE, PAGE, alpha=True, float_buffer=True)
    for o in objs:
        m = o.active_material.copy()
        o.active_material = m
        nt = m.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.select = True
        nt.nodes.active = node
        # bake through the lightmap uvs
        o.data.uv_layers.active = o.data.uv_layers["lm"]

    def grab():
        return np.array(img.pixels[:], np.float32).reshape(PAGE, PAGE, 4)

    bake(objs, "NORMAL")
    nrm = grab()
    print("normal bake: covered", float((nrm[..., 3] > 0.5).mean()), "max", float(nrm.max()))
    valid = nrm[..., 3] > 0.5
    n = nrm[..., :3] * 2 - 1
    bake(objs, "DIFFUSE", True, True)
    total = grab()[..., :3]
    world_bg.inputs[1].default_value = 0.0
    bake(objs, "DIFFUSE", True, False)
    world_bg.inputs[1].default_value = sky_strength
    direct = grab()[..., :3]
    print("light bake: total max", float(total.max()), "mean", float(total[valid].mean()), "direct max", float(direct.max()))
    print(f"page {p}: baked in {time.time() - t0:.0f} s")
    return finish(total, direct, n, valid)


def finish(total, direct, n, valid, smooth_it=True):
    # Cycles' diffuse light pass is irradiance / π
    e_all = total * math.pi
    e_sun = direct.mean(-1) * math.pi
    d = sun_dir()
    ndl = n[..., 0] * d.x + n[..., 1] * d.y + n[..., 2] * d.z
    vis = np.where(ndl > 0.03, np.clip(e_sun / (SUN * np.maximum(ndl, 0.03)), 0, 1), 0)
    ambient = np.clip(e_all - direct * math.pi, 0, None)
    if smooth_it:
        ambient = smooth(ambient, valid, n)
    return ambient, vis


def vertex_parts(vobjs, world_bg, sky_strength):
    """Per-vertex light for the dense sculpture: baked into a colour attribute per vertex."""
    out = {}
    for o in vobjs:
        t0 = time.time()
        me = o.data
        for name in ("all", "sun"):
            if name in me.color_attributes:
                me.color_attributes.remove(me.color_attributes[name])
        ca = me.color_attributes.new("all", "FLOAT_COLOR", "POINT")
        me.color_attributes.active_color = ca
        bake([o], "DIFFUSE", True, True, "VERTEX_COLORS")
        allv = np.empty(len(me.vertices) * 4, np.float32)
        ca.data.foreach_get("color", allv)
        world_bg.inputs[1].default_value = 0.0
        bake([o], "DIFFUSE", True, False, "VERTEX_COLORS")
        world_bg.inputs[1].default_value = sky_strength
        dirv = np.empty(len(me.vertices) * 4, np.float32)
        ca.data.foreach_get("color", dirv)
        nv = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("normal", nv)
        ambient, vis = finish(allv.reshape(-1, 4)[:, :3], dirv.reshape(-1, 4)[:, :3], nv.reshape(-1, 3), None, False)
        rgb = np.clip(ambient / SCALE * 255, 0, 255)
        two = np.empty((len(rgb), 2), np.uint8)
        two[:, 0] = np.clip(rgb[:, 0] * 0.3 + rgb[:, 1] * 0.55 + rgb[:, 2] * 0.15, 0, 255)
        two[:, 1] = np.clip(vis * 255, 0, 255)
        file = f"v-{o.name.replace('#v', '')}.bin"
        open(os.path.join(OUT, file), "wb").write(two.tobytes())
        out[o.name] = file
        print(f"vertices {o.name}: {len(rgb):,} in {time.time() - t0:.0f} s")
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", type=int, default=256)
    ap.add_argument("--pages", type=int, nargs="*")
    ap.add_argument("--no-vertex", action="store_true")
    a = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = temple.load()
    setup(a.samples)
    so, bg = lights()
    sky_strength = bg.inputs[1].default_value
    man_path = os.path.join(OUT, "manifest.json")
    man = json.load(open(man_path))
    keys = [o.name for o in objs if not o.name.startswith("occ:")]
    pages = sorted({int(k.split("#")[1]) for k in keys if k.split("#")[1] != "v"})
    # the walk only uses a bake whose mesh list matches the scene as built now
    man["keys"] = keys
    man["pages"] = max(pages) + 1
    for p in a.pages if a.pages is not None else pages:
        ambient, vis = page(p, [o for o in objs if o.name.endswith(f"#{p}")], bg, sky_strength)
        to_webp(np.clip(ambient / SCALE, 0, 1), f"lm-{p}")
        to_webp(np.repeat(vis[..., None], 3, -1), f"sun-{p}")
    if not a.no_vertex:
        man["vertex"] = vertex_parts([o for o in objs if o.name.endswith("#v")], bg, sky_strength)
    man["version"] = int(time.time() * 1000)
    man["baker"] = f"cycles {bpy.app.version_string}, {a.samples} samples"
    json.dump(man, open(man_path, "w"), indent=1)
    print("done")


main()
