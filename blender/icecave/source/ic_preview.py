"""Previews for the ice-cave mouths (lane C, W2b), run inside the lane's Blender after ic_mouths/ic_bake.
Scene "IceCaveMouths" holds the mouths, the segments (PV_Seg*) and the PV_* lights; this file builds the game's
trench (level: the head-on 24 m ramp that sinks 7.8 m, the snow cap at 7.8 over the cave, trench walls rising
from |x| 8.6 to 14 m, as sports/snow/halfpipe.js builds it) and renders:
  SM_IceCave_Entrance.png        rider on the ramp, camera 6 m behind and 2.5 m up, head-on (9:16)
  SM_IceCave_Entrance_ridge.png  from the top of the ramp: the ridge sticking ~2 m out of the snow
  SM_IceCave_Exit.png            from inside, riding out through the exit throat
  SM_IceCave_Mouths_turntable.png  4 angles x 2 mouths
Use:  exec(open(PATH).read()); render_all(out_dir)
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

SC = "IceCaveMouths"
CAP = 7.8


def ss5(t):
    t = max(0.0, min(1.0, t))
    return t * t * t * (t * (t * 6 - 15) + 10)


def trench(kind):
    """kind entrance: outside = +Blender y, ramp bottom 4 m out; exit: outside = -y, ramp bottom 7.3 m out."""
    sgn, a, split = (1.0, 4.0, -0.6) if kind == "entrance" else (-1.0, 7.3, 2.7)  # split: the code wall (cap behind it)

    def H(x, y):
        u = sgn * y
        if u < split:
            return CAP
        s = 1 - ss5((u - a) / 24.0)
        ax = abs(x)
        m = 1 if ax <= 8.6 else (0 if ax >= 14 else 1 - ss5((ax - 8.6) / 5.4))
        return CAP - CAP * s * m
    name = "PV_Trench"
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name])
    bm = bmesh.new()
    xs = [-400.0, -150.0, -70.0] + [-40 + 0.5 * i for i in range(161)] + [70.0, 150.0, 400.0]
    ys = [-400.0, -200.0, -110.0] + [-70 + 0.5 * i for i in range(281)] + [110.0, 200.0, 400.0]
    V = [[bm.verts.new((x, y, H(x, y) - 0.002)) for x in xs] for y in ys]
    for i in range(len(ys) - 1):
        for j in range(len(xs) - 1):
            bm.faces.new((V[i][j], V[i][j + 1], V[i + 1][j + 1], V[i + 1][j]))
    # the cap's step down into the cave hides behind the face: drop it (the throat stays open)
    step = [f for f in bm.faces if max(v.co.z for v in f.verts) - min(v.co.z for v in f.verts) > 2.5
            and abs(sgn * f.calc_center_median().y - split) <= 0.6]
    bmesh.ops.delete(bm, geom=step, context="FACES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.data.scenes[SC].collection.objects.link(ob)
    me.materials.append(bpy.data.materials["PV_Snow"])
    return ob


def floor(kind):
    name = "PV_Floor"
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name])
    y0, y1 = (-60, 0.3) if kind == "entrance" else (-0.3, 60)
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-8.3, y0, 0.003), (8.3, y0, 0.003), (8.3, y1, 0.003), (-8.3, y1, 0.003)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    bpy.data.scenes[SC].collection.objects.link(ob)
    me.materials.append(bpy.data.materials["PV_Snow"])


def code_wall(kind):
    """The game keeps its own code rock wall 0.6 m into the hill (halfpipe.js mouth loop: from the trench floor up to
    the snow cap across |x| <= 14, with the cave profile as its hole). It fills the gap beside the face's shoulders."""
    name = "PV_CodeWall"
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name])
    half = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25),
            (4.95, 4.95), (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
    ring = half + [(-x, z) for (x, z) in reversed(half[:-1])]

    def tw(ax):
        m = 1 if ax <= 8.6 else (0 if ax >= 14 else 1 - ss5((ax - 8.6) / 5.4))
        return CAP - CAP * m
    cols = [(x, tw(x)) for x in (14, 12.5, 11, 9.6)] + ring[1:-1] + [(-x, tw(x)) for x in (9.6, 11, 12.5, 14)]
    y = -0.6 if kind == "entrance" else -2.7  # m1 + 0.6 / m2 - 0.6 in mouth-local space
    vs, fs = [], []
    for i, (x, z) in enumerate(cols):
        vs += [(x, y, z - 0.05), (x, y, CAP + 0.05)]
        if i:
            a = 2 * (i - 1)
            fs.append((a, a + 2, a + 3, a + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    ob = bpy.data.objects.new(name, me)
    bpy.data.scenes[SC].collection.objects.link(ob)
    mat = bpy.data.materials.get("PV_CodeRock") or bpy.data.materials.new("PV_CodeRock")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.13, 0.12, 0.11, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    me.materials.append(mat)


def look(ob, eye, tgt):
    ob.location = eye
    ob.rotation_euler = (Vector(tgt) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()


def show(names):
    sc = bpy.data.scenes[SC]
    for o in sc.objects:
        if o.type == "MESH":
            o.hide_render = o.name not in names
            o.hide_viewport = o.hide_render


def render(path, w=720, h=1280, samples=64):
    sc = bpy.data.scenes[SC]
    sc.render.engine = "CYCLES"
    sc.cycles.device = "GPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=SC)


def night_lights(lanterns, blue):
    O = bpy.data.objects
    sun = O["IC_Sun"]
    sun.rotation_euler = (0.40, 0, 3.55)
    sun.data.energy = 1.1
    bpy.data.scenes[SC].world.node_tree.nodes["Background"].inputs[1].default_value = 1.6
    for nm, (loc, e) in zip(("PV_Lantern", "PV_Lantern2"), lanterns):
        O[nm].location = loc
        O[nm].data.energy = e
    O["PV_Blue"].location, O["PV_Blue"].data.energy = blue


ENT_SEGS = ["PV_SegEntA_SM_IceCave_Segment_A", "PV_SegEntB_SM_IceCave_Segment_B", "PV_SegEntC", "PV_SegEntD"]
EX_SEGS = ["PV_SegExA_SM_IceCave_Segment_A", "PV_SegExB_SM_IceCave_Segment_B", "PV_SegExC", "PV_SegExD"]


def render_all(out):
    O = bpy.data.objects
    sc = bpy.data.scenes[SC]
    cam = O["IC_Cam"]
    sc.camera = cam
    cam.data.lens, cam.data.sensor_width = 20.78, 36
    # entrance: head-on down the ramp
    trench("entrance")
    floor("entrance")
    code_wall("entrance")
    show(["SM_IceCave_Entrance", "PV_Trench", "PV_Floor", "PV_Back", "PV_CodeWall"] + ENT_SEGS)
    O["PV_Back"].location = (0, 0, 0)
    night_lights((((-6.0, 4.0, 1.4), 140), ((6.5, 5.0, 2.4), 160)), ((0, -22, 3.0), 40))
    # rider 16 m out on the ramp (ground 3.9 m), camera 6 m behind and 2.5 m up (ground 6.99 there)
    look(cam, (0, 22, 6.99 + 2.5), (0, 0, 3.6))
    render(f"{out}/SM_IceCave_Entrance.png")
    # ridge: from the top of the ramp (snow level 7.8), camera 6 m behind, 2.5 m up
    look(cam, (0, 34, CAP + 2.5), (0, 0, 5.2))
    render(f"{out}/SM_IceCave_Entrance_ridge.png")
    # exit: riding out, camera 6 m behind the rider, 2.5 m up
    trench("exit")
    floor("exit")
    code_wall("exit")
    O["PV_Back"].location = (0, 86, 0)  # behind the camera, closes the cave's far end
    show(["SM_IceCave_Exit", "PV_Trench", "PV_Floor", "PV_Back", "PV_CodeWall"] + EX_SEGS)
    night_lights((((-6.5, -5.5, 1.4), 140), ((6.0, -9.0, 2.2), 160)), ((0, 9, 3.0), 30))
    look(cam, (0, 21.0, 2.5), (0, -10, 1.6))  # rider 15 m inside the exit
    render(f"{out}/SM_IceCave_Exit.png")
    turntable(out)


def turntable(out):
    O = bpy.data.objects
    sc = bpy.data.scenes[SC]
    cam = O["IC_Cam"]
    cam.data.lens = 40
    O["PV_Ground"].location.z = -0.26
    night_lights((((-6.0, 4.0, 1.4), 0), ((6.5, 5.0, 2.4), 0)), ((0, 0, -50), 0))
    O["IC_Sun"].data.energy = 2.6
    O["IC_Sun"].rotation_euler = (0.75, 0, 2.6)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 3.0
    tiles = []
    for name, front in (("SM_IceCave_Entrance", 1.0), ("SM_IceCave_Exit", -1.0)):
        show([name, "PV_Ground"])
        c = Vector((0, 0.5 * front, 4.2))
        row = []
        for k, yaw in enumerate((35, -35, 90, 180)):
            a = math.radians(yaw)
            d = 44.0
            eye = c + Vector((math.sin(a) * d * front, math.cos(a) * d * front, 13.0))
            look(cam, eye, c)
            p = f"{out}/_tt_{name}_{k}.png"
            render(p, 400, 260, 32)
            row.append(p)
        tiles.append(row)
    W, Hh = 400, 260
    sheet = np.zeros((Hh * 2, W * 4, 4), np.float32)
    for r, row in enumerate(tiles):
        for k, p in enumerate(row):
            im = bpy.data.images.load(p)
            px = np.array(im.pixels[:], np.float32).reshape(Hh, W, 4)
            sheet[(1 - r) * Hh:(2 - r) * Hh, k * W:(k + 1) * W] = px
            bpy.data.images.remove(im)
    img = bpy.data.images.new("PV_TT_SHEET", W * 4, Hh * 2, alpha=False)
    img.pixels[:] = sheet.ravel()
    img.filepath_raw = f"{out}/SM_IceCave_Mouths_turntable.png"
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    O["PV_Ground"].location.z = -0.001
    cam.data.lens = 20.78
    return tiles
