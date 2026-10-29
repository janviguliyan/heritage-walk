"""Render a carved-stone set from tools/blender/relief.py in raking morning light, as true
displaced geometry, to judge it before it goes into the walk.

  blender -b -P tools/blender/relief_preview.py -- frieze [--out /tmp/frieze.png] [--depth 0.06]
"""
import argparse
import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "tools", "blender", "out", "tex")
SIZE = {"frieze": (4, 1), "wall": (2, 2), "carved": (1, 1)}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--out")
    ap.add_argument("--depth", type=float, default=0.06)
    ap.add_argument("--width", type=float, default=2.0, help="units of the set to show")
    a = ap.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    w, h = SIZE[a.name]
    show = min(a.width, w)
    res = 1024 if a.name == "frieze" else 700
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=int(res * show), y_subdivisions=int(res * min(h, 1.0)), size=1)
    ob = bpy.context.object
    ob.scale = (show, min(h, 1.0), 1)
    bpy.ops.object.transform_apply(scale=True)
    # uv: show the left `show` units of the tile, and its top unit
    uv = ob.data.uv_layers.active.data
    for loop in ob.data.loops:
        co = ob.data.vertices[loop.vertex_index].co
        uv[loop.index].uv = ((co.x + show / 2) / w, 1 - (min(h, 1.0) / 2 - co.y) / h)
    tex = bpy.data.textures.new("h", "IMAGE")
    tex.image = bpy.data.images.load(os.path.join(RAW, f"{a.name}-height16.png"))
    tex.image.colorspace_settings.name = "Non-Color"
    d = ob.modifiers.new("d", "DISPLACE")
    d.texture = tex
    d.texture_coords = "UV"
    d.strength = a.depth
    d.mid_level = 0
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new("stone")
    m.use_nodes = True
    nt = m.node_tree
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(RAW, f"{a.name}-albedo.png"))
    bsdf = nt.nodes["Principled BSDF"]
    nt.links.new(img.outputs[0], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    ob.data.materials.append(m)
    # morning sun raking across from the upper left, a soft sky
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.0
    sun.angle = math.radians(1.5)
    sun.color = (1.0, 0.88, 0.74)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(52), math.radians(-38), 0)
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.66, 0.85, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    sc.world = world
    cam = bpy.data.cameras.new("c")
    cam.type = "ORTHO"
    cam.ortho_scale = show
    co = bpy.data.objects.new("c", cam)
    sc.collection.objects.link(co)
    co.location = (0, 0, 5)
    sc.camera = co
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dv in prefs.devices:
        dv.use = True
    sc.cycles.device = "GPU"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "AgX"
    sc.render.resolution_x = 1600
    sc.render.resolution_y = int(1600 * min(h, 1.0) / show)
    sc.render.filepath = a.out or os.path.join(RAW, f"{a.name}-preview.png")
    bpy.ops.render.render(write_still=True)


main()
