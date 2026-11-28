"""Paddling N20 lane D previews (headless).
blender -b --factory-startup -P preview.py -- <mode race|turntable|inspect> <out.png> <glb1> [<glb2>]"""
import bpy, sys, math
from mathutils import Vector, Euler
argv = sys.argv[sys.argv.index("--") + 1:]
MODE, OUT, GLBS = argv[0], argv[1], argv[2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        sc.render.engine = eng; break
    except TypeError:
        pass
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.view_settings.view_transform = "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.compression = 90
try:
    sc.eevee.taa_render_samples = 32
except Exception:
    pass
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.72, 0.86, 1); bg.inputs[1].default_value = 0.9
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 3.2; sun.rotation_euler = Euler((math.radians(50), math.radians(10), math.radians(-35)))
try:
    sun.data.use_shadow = True
except Exception:
    pass

def mat(name, col, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    return m

boats = []
spacing = 3.0
for i, g in enumerate(GLBS):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=g)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    off = (i - (len(GLBS) - 1) / 2) * spacing
    lod1 = [o for o in new if o.name.endswith("_LOD1")]
    lod0 = [o for o in roots if o.type == "MESH" and not o.name.endswith("_LOD1")][0]
    if MODE == "lod1":
        lod0.hide_render = True
        for c in lod0.children:
            if c.type == "MESH": c.hide_render = True
    else:
        for o in lod1: o.hide_render = True
    for r in roots: r.location.x += off
    boats.append((lod0, new, off))

if MODE in ("race", "inspect", "lod1"):
    water = mat("water", (0.16, 0.42, 0.55), 0.15)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0.0)); bpy.context.object.data.materials.append(water)
    skin = mat("fig", (0.86, 0.62, 0.40)); shirt = mat("shirt", (0.82, 0.18, 0.16))
    # stand-in seated figures at the seats (origin = seat - 0.36 in y; face +Z, drummer faces -Z)
    for lod0, new, off in boats:
        bpy.context.view_layer.update()
        for o in new:
            if not o.name.startswith("Seat_"): continue
            p = o.matrix_world.translation
            face = -1 if o.name == "Seat_Drum" else 1   # glTF +Z = Blender -Y
            base = Vector((p.x, p.y, p.z - 0.36))
            def add(prim, loc, scale, m):
                if prim == "cyl":
                    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1, depth=1, location=loc)
                else:
                    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=loc)
                ob = bpy.context.object; ob.scale = scale; ob.data.materials.append(m); return ob
            add("cyl", base + Vector((0, 0, 0.62)), (0.15, 0.12, 0.26), shirt)          # torso
            add("sph", base + Vector((0, 0, 0.92)), (0.12, 0.12, 0.12), skin)           # head
            th = add("cyl", base + Vector((0, -face * 0.18, 0.40)), (0.13, 0.20, 0.07), shirt)  # thighs
            th.rotation_euler = (math.radians(90), 0, 0)
            add("cyl", base + Vector((0, -face * 0.36, 0.20)), (0.12, 0.06, 0.20), skin)  # shins

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.clip_end = 300

def look(loc, tgt, lens):
    cam.location = Vector(loc); cam.data.lens = lens
    cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()

if MODE == "race":
    # behind (stern, glTF -Z = Blender +Y) and above
    look((0, 12.5, 5.6), (0, -1.2, 0.3), 26)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
elif MODE == "lod1":
    look((0, 30, 12), (0, -1.0, 0.2), 32)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
elif MODE == "inspect":
    shots = [("a", (4.0, 7.5, 5.0), (0, 0.5, 0.3), 24), ("b", (2.2, -1.2, 2.6), (0, -4.3, 0.4), 24),
             ("c", (-9, -2, 1.2), (0, -1, 0.4), 28), ("d", (0.0, 3.5, 3.0), (0, -0.6, 0.3), 22)]
    sc.render.resolution_x, sc.render.resolution_y = 1000, 700
    for k, loc, tgt, lens in shots:
        look(loc, tgt, lens); sc.render.filepath = OUT + "_" + k + ".png"; bpy.ops.render.render(write_still=True)
else:
    # turntable sheet: 6 views per boat stacked into one 720x1280 image via compositing in python
    import numpy as np
    tiles = []
    W, H = 720, 213
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.film_transparent = False
    for lod0, new, off in boats:
        for r in new:
            if r.parent is None: r.location.x -= off
    angles = [35, 145, 255]
    for bi, (lod0, new, off) in enumerate(boats):
        for o in [x for b in boats if b is not boats[bi] for x in b[1]]:
            o.hide_render = True
        for o in new:
            if not o.name.endswith("_LOD1"): o.hide_render = False
        for a in angles:
            t = math.radians(a); d = 18.5
            look((d * math.sin(t), d * math.cos(t), 5.2), (0, 0, 0.45), 40)
            path = OUT + "_t%d_%d.png" % (bi, a); sc.render.filepath = path; bpy.ops.render.render(write_still=True)
            tiles.append(path)
    imgs = [bpy.data.images.load(p) for p in tiles]
    tw, th = imgs[0].size
    cols, rows = 1, 6
    sheet = np.zeros((rows * th, cols * tw, 4), dtype=np.float32)
    for k, im in enumerate(imgs):
        px = np.array(im.pixels[:], dtype=np.float32).reshape(th, tw, 4)
        bi, ai = divmod(k, len(angles))
        r = ai + bi * 3; c = 0
        sheet[(rows - 1 - r) * th:(rows - r) * th, c * tw:(c + 1) * tw] = px
    out = bpy.data.images.new("sheet", cols * tw, rows * th, alpha=False)
    out.pixels[:] = sheet.ravel()
    out.filepath_raw = OUT; out.file_format = "PNG"; out.save()
    import os
    for p in tiles: os.remove(p)
