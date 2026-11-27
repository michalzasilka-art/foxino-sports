"""Previews from the exported GLBs (headless):
  blender -b --factory-startup -P up_render.py -- <upipe_dir>
previews/upipe_gamecam.png  720x1280: 3 sections + end + light posts, looking down the pipe (+Z)
previews/upipe_section.png  1280x720: end-on view with the exact cross-section drawn in red at z = 0
"""
import math
import os
import sys

import bpy
from mathutils import Vector

DIR = sys.argv[sys.argv.index("--") + 1]
PREV = os.path.join(DIR, "previews")
os.makedirs(PREV, exist_ok=True)


def gl(x, h, z):
    return Vector((x, -z, h))


def imp(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(DIR, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    return next(o for o in new if o.parent is None)


def copy_tree(root):
    r2 = root.copy()
    bpy.context.scene.collection.objects.link(r2)
    for c in root.children:
        c2 = c.copy()
        bpy.context.scene.collection.objects.link(c2)
        c2.parent = r2
    return r2


def mat_emit(name, rgb, s):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*rgb, 1)
    e.inputs["Strength"].default_value = s
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def setup_common(ground=True):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        sc.eevee.taa_render_samples = 48
    except AttributeError:
        pass
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.compression = 90
    sc.render.resolution_percentage = 100
    w = bpy.data.worlds.new("Sky")
    sc.world = w
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.30, 0.42, 0.66, 1)
    bg.inputs["Strength"].default_value = 0.9
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.2
    sun.color = (1.0, 0.88, 0.74)
    sun.angle = math.radians(3)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(62), 0, math.radians(215))
    sc.collection.objects.link(so)
    if not ground:
        return
    # snow ground around the pipe (preview only)
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, -60, -0.002))
    g = bpy.context.active_object
    gm = bpy.data.materials.new("Ground")
    b = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.80, 0.85, 0.92, 1)
    b.inputs["Roughness"].default_value = 0.9
    g.data.materials.append(gm)


def lamp_lights(posts):
    for p in posts:
        l = bpy.data.lights.new("lamp", "POINT")
        l.energy = 60
        l.color = (1.0, 0.70, 0.40)
        l.shadow_soft_size = 0.08
        lo = bpy.data.objects.new("lamp", l)
        lo.location = p.location + Vector((0, 0, 1.665))
        bpy.context.scene.collection.objects.link(lo)


def camera(loc, target, lens, w, h, ortho=None):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    c = bpy.data.objects.new("Cam", cd)
    c.location = loc
    c.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(c)
    sc.camera = c
    sc.render.resolution_x, sc.render.resolution_y = w, h
    return c


def place_posts(light, spots):
    posts = []
    for (x, z) in spots:
        p = copy_tree(light)
        p.location = gl(x, 5.1, z)
        posts.append(p)
    return posts


def gamecam():
    setup_common()
    secs = [imp("SM_UPipe_Section") for _ in range(3)]
    for i, s in enumerate(secs):
        s.location = gl(0, 0, 10 * i)
    end = imp("SM_UPipe_End")
    end.location = gl(0, 0, 30)
    light = imp("SM_UPipe_Light")
    light.location = gl(-8.4, 5.1, 6.0)
    spots = [(8.4, 6.0), (-8.4, 13.5), (8.4, 13.5), (-8.4, 21.0), (8.4, 21.0), (-8.4, 28.5), (8.4, 28.5),
             (-8.6, 33.0), (8.6, 33.0)]
    posts = [light] + place_posts(light, spots)
    lamp_lights(posts)
    camera(gl(0, 6.8, -5.0), gl(0, 2.0, 26.0), 17, 720, 1280)
    bpy.context.scene.render.filepath = os.path.join(PREV, "upipe_gamecam.png")
    bpy.ops.render.render(write_still=True)


def section_view():
    setup_common(ground=False)
    w = bpy.context.scene.world
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.16, 0.22, 0.38, 1)
    sec = imp("SM_UPipe_Section")
    end = imp("SM_UPipe_End")
    end.location = gl(0, 0, 10)
    light = imp("SM_UPipe_Light")
    light.location = gl(-9.0, 5.1, 1.0)
    posts = [light] + place_posts(light, [(9.0, 1.0)])
    lamp_lights(posts)
    # exact cross-section (floor, R 4.8 transition, 0.3 vertical, deck) drawn at z = 0
    pts = []
    for sg in (-1, 1):
        half = [(10.4, 5.1), (7.4, 5.1), (7.4, 4.8)]
        for i in range(1, 48):
            t = math.radians(90 - 90 * i / 48)
            half.append((2.6 + 4.8 * math.sin(t), 4.8 * (1 - math.cos(t))))
        half.append((2.6, 0.0))
        if sg > 0:
            half = half[::-1]
        pts += [(sg * x, h) for x, h in half]
    pts = [(-10.4, 5.1)] + pts[1:]
    cu = bpy.data.curves.new("Profile", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.035
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, (x, h) in zip(sp.points, pts):
        v = gl(x, h, -0.03)
        p.co = (v.x, v.y, v.z, 1)
    co = bpy.data.objects.new("Profile", cu)
    cu.materials.append(mat_emit("Red", (1.0, 0.08, 0.05), 3.0))
    bpy.context.scene.collection.objects.link(co)
    camera(gl(0, 2.7, -20.0), gl(0, 2.7, 0.0), 30, 1280, 720)
    bpy.context.scene.render.filepath = os.path.join(PREV, "upipe_section.png")
    bpy.ops.render.render(write_still=True)


gamecam()
section_view()
print("RENDER_OK")
