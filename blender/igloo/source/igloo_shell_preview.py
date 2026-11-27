# Headless previews of the igloo shell + exit plug GLBs (EEVEE, preview lights/camera never exported).
# blender -b --factory-startup -P igloo_shell_preview.py -- <glb_dir> <out_dir> <which...>
#   which: inside outside turntable closeup mark
import bpy, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT, WHICH = argv[0], argv[1], argv[2:]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
for n in ("SM_Igloo_Shell", "SM_Igloo_ExitPlug"):
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, n + ".glb"))
plug = bpy.data.objects["SM_Igloo_ExitPlug"]

import bmesh
me = bpy.data.meshes.new("_ground")
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=80)
bm.to_mesh(me)
bm.free()
gnd = bpy.data.objects.new("_ground", me)
sc.collection.objects.link(gnd)
gnd.location.z = -0.002
gm = bpy.data.materials.new("_groundmat")
gm.use_nodes = True
bs = gm.node_tree.nodes["Principled BSDF"]
bs.inputs["Base Color"].default_value = (0.78, 0.82, 0.88, 1)
bs.inputs["Roughness"].default_value = 0.9
me.materials.append(gm)


def light(name, kind, energy, color, loc=None, size=None):
    L = bpy.data.lights.new(name, kind)
    L.energy = energy
    L.color = color
    if size is not None:
        if kind == 'AREA':
            L.size = size
        else:
            L.shadow_soft_size = size
    o = bpy.data.objects.new(name, L)
    sc.collection.objects.link(o)
    if loc:
        o.location = loc
    return o


fire = light("_fire", 'POINT', 9000, (1.0, 0.55, 0.25), (4.4, -0.5, 0.8), 0.4)
glow = light("_snowglow", 'AREA', 1200, (0.72, 0.84, 1.0), (0, 0, 8.5), 10)
sun = light("_sun", 'SUN', 4.0, (1.0, 0.97, 0.92))
sun.data.angle = math.radians(3)
sun.rotation_euler = Vector((-0.45, 0.75, -0.55)).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new("_w")
w.use_nodes = True
bg = w.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.55, 0.68, 0.9, 1)
sc.world = w
cd = bpy.data.cameras.new("_cam")
cd.clip_end = 300
cam = bpy.data.objects.new("_cam", cd)
sc.collection.objects.link(cam)
sc.camera = cam
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 48
try:
    sc.eevee.use_raytracing = True
except Exception:
    pass
sc.view_settings.view_transform = 'AgX'
sc.render.image_settings.file_format = 'PNG'


def aim(loc, tgt, lens, fit='VERTICAL', sensor=24):
    cam.location = loc
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cd.lens = lens
    cd.sensor_fit = fit
    if fit == 'VERTICAL':
        cd.sensor_height = sensor


def interior():
    fire.hide_render = glow.hide_render = False
    sun.hide_render = True
    bg.inputs[1].default_value = 0.25


def exterior():
    fire.hide_render = glow.hide_render = True
    sun.hide_render = False
    bg.inputs[1].default_value = 0.8


def render(path, rx, ry):
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


for wh in WHICH:
    if wh in ("inside", "mark"):
        interior()
        aim((0, 5.0, 2.5), (0, -9.0, 1.6), 20)
        if wh == "mark":
            m = bpy.data.materials.new("_mark")
            m.use_nodes = True
            m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 0.2, 0.2, 1)
            keep = plug.data.materials[0]
            plug.data.materials[0] = m
            render(os.path.join(OUT, "inside_mark.png"), 270, 480)
            plug.data.materials[0] = keep
        else:
            render(os.path.join(OUT, "SM_Igloo_Shell_inside.png"), 540, 960)
    elif wh in ("closeup", "closemark"):
        # about 3 m of wall across the plug's border, warm light from the fire
        interior()
        aim((1.6, -5.4, 2.1), (2.6, -8.75, 2.0), 50, fit='HORIZONTAL')
        cd.sensor_width = 36
        if wh == "closemark":
            m = bpy.data.materials.new("_mark2")
            m.use_nodes = True
            m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 0.2, 0.2, 1)
            keep = plug.data.materials[0]
            plug.data.materials[0] = m
            render(os.path.join(OUT, "closeup_mark.png"), 300, 300)
            plug.data.materials[0] = keep
        else:
            render(os.path.join(OUT, "SM_Igloo_Snow_closeup.png"), 900, 900)
    elif wh == "outside":
        exterior()
        aim((5.0, -35.0, 3.0), (0, 0.0, 4.3), 24)
        render(os.path.join(OUT, "SM_Igloo_Shell_outside.png"), 540, 960)
    elif wh == "turntable":
        exterior()
        tiles = []
        tgt = Vector((0, 3.0, 3.0))
        for i, az in enumerate((-90, 0, 90, 180)):
            a = math.radians(az)
            aim(tgt + Vector((math.cos(a), math.sin(a), 0)) * 40 + Vector((0, 0, 18)), tgt, 35, fit='AUTO')
            p = os.path.join(OUT, "_tt%d.png" % i)
            render(p, 640, 640)
            tiles.append(p)
        arr = []
        for p in tiles:
            im = bpy.data.images.load(p)
            arr.append(np.array(im.pixels[:], dtype=np.float32).reshape(640, 640, 4))
            bpy.data.images.remove(im)
            os.remove(p)
        sheet = np.concatenate([np.concatenate([arr[0], arr[1]], 1), np.concatenate([arr[2], arr[3]], 1)], 0)
        img = bpy.data.images.new("_tt", 1280, 1280, alpha=True)
        img.pixels.foreach_set(sheet.ravel())
        img.filepath_raw = os.path.join(OUT, "SM_Igloo_Shell_turntable.png")
        img.file_format = 'PNG'
        img.save()
