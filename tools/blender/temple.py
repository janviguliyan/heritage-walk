"""Konark in Blender: import the walk's scene exactly as the site builds it (export_konark.mjs),
for high-quality work on it (Cycles lighting bakes into the site's lightmap layout, carving detail).

three.js is y-up, Blender z-up: (x, y, z) -> (x, -z, y). The lightmap uvs ("uv1") come across as
the "lm" UV layer, so anything baked into it lines up with the site's lm-*/sun-* textures.

  blender -b -P tools/blender/temple.py -- --save tools/blender/out/konark.blend
  blender -b -P tools/blender/temple.py -- --still /tmp/k.png --view 0      # a stop's view (content.json)
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "tools", "blender", "out", "konark")

STONE = {
    "khondalite": "#9a8670", "laterite": "#8a5a3c", "chlorite": "#3c4a3e", "carved": "#a08a72", "frieze": "#9c8670",
    "recess": "#5a4a3c", "lawn": "#5f7a3a", "path": "#b9a27e", "sand": "#d2b98e", "grass": "#6b7a40",
    # trees (occluders for the light bake)
    "occ:trunk": "#5a4632", "occ:crown": "#4a6a32",
}


def lin(c):
    c = c.lstrip("#")
    return tuple(((int(c[i:i + 2], 16) / 255) / 12.92 if int(c[i:i + 2], 16) / 255 <= 0.04045 else ((int(c[i:i + 2], 16) / 255 + 0.055) / 1.055) ** 2.4) for i in (0, 2, 4)) + (1.0,)


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(STONE.get(name, "#999999"))
    b.inputs["Roughness"].default_value = 0.9
    return m


def load():
    man = json.load(open(os.path.join(SRC, "manifest.json")))
    objs = []
    for m in man["meshes"]:
        raw = open(os.path.join(SRC, m["file"]), "rb").read()

        def arr(name, dtype):
            L = m["layout"].get(name)
            if not L:
                return None
            return np.frombuffer(raw, dtype=dtype, count=L["count"], offset=L["offset"])

        pos = arr("position", np.float32).reshape(-1, 3)
        idx_l = m["layout"].get("index")
        idx = arr("index", np.uint32 if idx_l and idx_l["type"] == "Uint32Array" else np.uint16)
        idx = np.arange(len(pos), dtype=np.uint32) if idx is None else idx.astype(np.uint32)
        p = np.empty_like(pos)
        p[:, 0], p[:, 1], p[:, 2] = pos[:, 0], -pos[:, 2], pos[:, 1]
        me = bpy.data.meshes.new(m["key"])
        me.vertices.add(len(p))
        me.vertices.foreach_set("co", p.ravel())
        tris = idx.reshape(-1, 3)
        me.loops.add(tris.size)
        me.loops.foreach_set("vertex_index", tris.ravel())
        me.polygons.add(len(tris))
        me.polygons.foreach_set("loop_start", np.arange(0, tris.size, 3, dtype=np.int32))
        me.polygons.foreach_set("loop_total", np.full(len(tris), 3, dtype=np.int32))
        for name, layer in (("uv", "uv"), ("uv1", "lm")):
            uv = arr(name, np.float32)
            if uv is not None:
                lay = me.uv_layers.new(name=layer)
                lay.data.foreach_set("uv", uv.reshape(-1, 2)[tris.ravel()].ravel())
        me.update()
        me.validate()
        nrm = arr("normal", np.float32)
        if nrm is not None:
            n = nrm.reshape(-1, 3)
            nn = np.empty_like(n)
            nn[:, 0], nn[:, 1], nn[:, 2] = n[:, 0], -n[:, 2], n[:, 1]
            me.normals_split_custom_set_from_vertices(nn)
        ob = bpy.data.objects.new(m["key"], me)
        ob.data.materials.append(material(m["key"].split("#")[0]))
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    return objs


def view(i):
    c = json.load(open(os.path.join(ROOT, "src", "sites", "konark", "content.json")))
    v = c["hotspots"][i]["view"]
    to = lambda a: Vector((a[0], -a[2], a[1]))
    eye = to(v["position"]) + Vector((0, 0, 1.6))
    return eye, to(v["lookAt"])


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--save")
    ap.add_argument("--still")
    ap.add_argument("--view", type=int, default=0)
    ap.add_argument("--samples", type=int, default=64)
    a = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = load()
    sc = bpy.context.scene
    print(f"imported {len(objs)} meshes, {sum(len(o.data.vertices) for o in objs):,} vertices")
    # the site's morning: sun at azimuth 100°, elevation 26° (src/bake/run.ts), a clear sky
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.5
    sun.angle = math.radians(0.6)
    sun.color = (1.0, 0.9, 0.78)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    az, el = math.radians(100), math.radians(26)
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    so.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    nt = world.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    nt.links.new(sky.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 0.35
    sc.world = world
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dv in prefs.devices:
        dv.use = True
    sc.cycles.device = "GPU"
    sc.cycles.samples = a.samples
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "AgX"
    if a.save:
        bpy.ops.wm.save_as_mainfile(filepath=a.save)
    if a.still:
        eye, at = view(a.view)
        cam = bpy.data.cameras.new("cam")
        cam.lens = 24
        co = bpy.data.objects.new("cam", cam)
        sc.collection.objects.link(co)
        co.location = eye
        co.rotation_euler = (at - eye).to_track_quat("-Z", "Y").to_euler()
        sc.camera = co
        sc.render.resolution_x, sc.render.resolution_y = 1600, 900
        sc.render.filepath = a.still
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
