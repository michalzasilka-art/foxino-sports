"""Preview renders for the course furniture (headless EEVEE).

  blender -b --factory-startup -P furn_render.py -- <furniture_dir> <tmp_dir>

1) previews/furniture_gamecam.png  720x1280: game camera behind and above, looking downhill (+Z glTF),
   start arch, start hut, boards, fence sections, flagpoles, floodlights and the finish arch far down.
2) previews/furniture_turntable.png 720x1280: 7 rows (one per model) x 3 angles
   (uphill/rider view, 3/4, downhill back). Each cell is framed to its model, so sizes are not to scale.
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
DIR, TMP = os.path.abspath(ARGS[0]), os.path.abspath(ARGS[1])
PREV = os.path.join(DIR, "previews")
os.makedirs(PREV, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
NAMES = ["SM_Arch_Start", "SM_Arch_Finish", "SM_Board", "SM_Fence", "SM_FlagPole", "SM_StartHut", "SM_Floodlight"]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
sc = bpy.context.scene
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
try:
    sc.eevee.taa_render_samples = 32
except AttributeError:
    pass
for vt in ("Khronos PBR Neutral", "Standard"):
    try:
        sc.view_settings.view_transform = vt
        break
    except TypeError:
        pass
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.image_settings.compression = 100
sc.render.film_transparent = False

world = bpy.data.worlds.new("Sky")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
sky_col = (0.52, 0.66, 0.86, 1.0)
bg.inputs["Color"].default_value = sky_col
bg.inputs["Strength"].default_value = 0.9

# --------------------------------------------------------------------------- import
SRC = {}
hold = bpy.data.collections.new("src")
sc.collection.children.link(hold)
for n in NAMES:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(DIR, n + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        hold.objects.link(o)
    SRC[n] = next(o for o in new if o.parent is None)
hold.hide_render = True
hold.hide_viewport = True

WORLD = [Matrix()]
live = bpy.data.collections.new("live")
sc.collection.children.link(live)


def place(name, loc, rz=0.0, col=None):
    col = col or live
    src = SRC[name]
    root = src.copy()
    col.objects.link(root)
    root.matrix_world = WORLD[0] @ Matrix.Translation(Vector(loc)) @ Matrix.Rotation(math.radians(rz), 4, "Z")
    for ch in src.children:
        c = ch.copy()
        col.objects.link(c)
        c.parent = root
        c.matrix_parent_inverse = Matrix()
        c.matrix_basis = Matrix()
    return root


def plain_mat(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def plane(name, x0, x1, y0, y1, z, mat, col=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    (col or live).objects.link(o)
    o.matrix_world = WORLD[0]
    return o


def cone(name, loc, r, h, mat, n=16, col=None):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=0, depth=h, location=(loc[0], loc[1], loc[2] + h / 2))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    for c in list(o.users_collection):
        c.objects.unlink(o)
    (col or live).objects.link(o)
    o.matrix_world = WORLD[0] @ o.matrix_world
    return o


snow = plain_mat("snow_ground", (0.80, 0.86, 0.94), 0.85)
groom = plain_mat("snow_run", (0.86, 0.90, 0.96), 0.75)
pine = plain_mat("pine", (0.03, 0.14, 0.07), 0.8)
tipm = plain_mat("tip", (0.86, 0.90, 0.96), 0.85)
rockm = plain_mat("mountain", (0.42, 0.48, 0.60), 0.9)


def sun(rot, energy, col):
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = energy
    ld.color = col
    ld.angle = math.radians(3)
    o = bpy.data.objects.new("sun", ld)
    live.objects.link(o)
    o.rotation_euler = Euler([math.radians(a) for a in rot])
    return o


# --------------------------------------------------------------------------- game camera scene
def aim(cam, loc, target=None, direction=None):
    cam.location = loc
    d = (Vector(target) - Vector(loc)) if target is not None else Vector(direction)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def game_scene():
    S = Matrix.Rotation(math.radians(17), 4, "X")         # the game's 17 deg slope, downhill = -Y (glTF +Z)
    WORLD[0] = S
    plane("ground", -300, 300, -520, 120, 0.0, snow)
    plane("run", -10, 10, -200, 40, 0.004, groom)
    place("SM_Arch_Start", (0, -10, 0))
    # start area in front of the arch (preview layout only; the game places the pieces)
    place("SM_StartHut", (-3.9, 4.0, 0), 0)
    place("SM_Board", (3.9, 7.0, 0), 18)
    place("SM_FlagPole", (4.4, 1.0, 0))
    place("SM_Floodlight", (-7.0, -3.0, 0), -10)
    place("SM_FlagPole", (-9.0, -7.5, 0), 180)
    for s_ in (1, -1):
        for y in (10.0, 6.0, 2.0, -2.0):
            place("SM_Fence", (s_ * 7.6, y, 0), 90)
        for i in range(30):
            place("SM_Fence", (s_ * 10.6, -16.0 - 4.0 * i, 0), 90)
    for k, y in enumerate((-26, -44, -62, -80, -98)):
        place("SM_Board", (8.4, y, 0), 14)
        place("SM_Board", (-8.4, y - 9, 0), -14)
    place("SM_FlagPole", (8.8, -40, 0))
    place("SM_Floodlight", (12.6, -34, 0), 12)
    place("SM_Floodlight", (-12.6, -70, 0), -12)
    place("SM_Floodlight", (12.6, -106, 0), 12)
    place("SM_Arch_Finish", (0, -135, 0))
    rnd = random.Random(4)
    for i in range(110):
        s_ = rnd.choice((1, -1))
        x = s_ * rnd.uniform(14.5, 60)
        y = rnd.uniform(-260, 10)
        h = rnd.uniform(4.5, 9.0)
        cone(f"tree{i}", (x, y, 0), h * 0.3, h, pine, 16)
        cone(f"tip{i}", (x, y, h * 0.62), h * 0.3 * 0.38 + 0.05, h * 0.38, tipm, 16)
    WORLD[0] = Matrix()
    for i, (x, y, r, h) in enumerate(((-160, -620, 170, 260), (90, -700, 210, 300), (300, -600, 160, 220), (-380, -560, 180, 240))):
        cone(f"mtn{i}", (x, y, -230), r, h, rockm, 24)
        cone(f"mtnc{i}", (x, y, -230 + h * 0.62), r * 0.38 + 1, h * 0.38, tipm, 24)
    sun((50, 0, 160), 3.2, (1.0, 0.93, 0.82))
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 22
    cam_d.clip_end = 2000
    cam = bpy.data.objects.new("cam", cam_d)
    live.objects.link(cam)
    loc = S @ Vector((0, 16, 11.0))
    dirn = S.to_3x3() @ Vector((0, -math.cos(math.radians(24)), -math.sin(math.radians(24))))
    aim(cam, loc, direction=dirn)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 720, 1280
    sc.render.filepath = os.path.join(PREV, "furniture_gamecam.png")
    bpy.ops.render.render(write_still=True)


def closeups():
    plane("ground", -300, 300, -300, 300, 0.0, snow)
    sun((50, 0, 160), 3.2, (1.0, 0.93, 0.82))
    cam_d = bpy.data.cameras.new("ccam")
    cam_d.lens = 40
    cam = bpy.data.objects.new("ccam", cam_d)
    live.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 512, 512
    shots = [("SM_Arch_Start", (6.0, 9.0, 6.0), (9.8, 0, 5.2)), ("SM_Arch_Finish", (3.0, 17.0, 7.0), (0, 0, 9.0)),
             ("SM_StartHut", (-4.5, 6.5, 2.8), (0, 0, 1.6)), ("SM_Floodlight", (1.8, 3.5, 9.0), (0, 0.3, 9.6)),
             ("SM_Board", (-2.5, 4.5, 2.2), (0, 0, 1.4)), ("SM_Fence", (-2.5, 4.0, 1.4), (0, 0, 0.6))]
    for n, loc, tgt in shots:
        root = place(n, (0, 0, 0))
        aim(cam, loc, target=tgt)
        sc.render.filepath = os.path.join(TMP, f"close_{n}.png")
        bpy.ops.render.render(write_still=True)
        for o in [root] + list(root.children):
            bpy.data.objects.remove(o)


def clear_live():
    for o in list(live.objects):
        bpy.data.objects.remove(o)


# --------------------------------------------------------------------------- turntable sheet
def bounds(root):
    pts = []
    for o in [root] + list(root.children):
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    return pts


def sheet():
    bg.inputs["Color"].default_value = (0.62, 0.72, 0.86, 1)
    plane("ground", -500, 500, -500, 500, 0.0, snow)
    sun((50, 0, 140), 3.0, (1.0, 0.94, 0.85))
    cam_d = bpy.data.cameras.new("tcam")
    cam_d.type = "ORTHO"
    cam_d.clip_end = 2000
    cam = bpy.data.objects.new("tcam", cam_d)
    live.objects.link(cam)
    sc.camera = cam
    cw, ch = 240, 182
    sc.render.resolution_x, sc.render.resolution_y = cw, ch
    canvas = np.full((1280, 720, 3), 0.94)
    angles = [(0, 14), (-40, 18), (155, 16)]   # azimuth from +Y (uphill/rider view), elevation
    for r, n in enumerate(NAMES):
        root = place(n, (0, 0, 0))
        bpy.context.view_layer.update()
        pts = bounds(root)
        for k, (az, el) in enumerate(angles):
            a, e = math.radians(az), math.radians(el)
            fwd = -Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))   # camera looks along fwd
            right = fwd.cross(Vector((0, 0, 1))).normalized()
            up = right.cross(fwd).normalized()
            xs = [p.dot(right) for p in pts]
            ys = [p.dot(up) for p in pts]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            cam_d.ortho_scale = 1.12 * max(max(xs) - min(xs), (max(ys) - min(ys)) * cw / ch)
            cam.matrix_world = Matrix((
                (right.x, up.x, -fwd.x, 0), (right.y, up.y, -fwd.y, 0), (right.z, up.z, -fwd.z, 0), (0, 0, 0, 1)))
            cam.location = right * cx + up * cy - fwd * 300
            f = os.path.join(TMP, f"tt_{r}_{k}.png")
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(f)
            px = np.array(img.pixels[:]).reshape(ch, cw, 4)[::-1, :, :3]
            bpy.data.images.remove(img)
            os.remove(f)
            y0 = 3 + r * ch
            canvas[y0:y0 + ch, k * cw:(k + 1) * cw] = px
        for o in [root] + list(root.children):
            bpy.data.objects.remove(o)
    out = bpy.data.images.new("sheet", 720, 1280, alpha=False)
    rgba = np.concatenate([canvas[::-1], np.ones((1280, 720, 1))], axis=2).astype(np.float32)
    out.pixels.foreach_set(rgba.ravel())
    out.filepath_raw = os.path.join(PREV, "furniture_turntable.png")
    out.file_format = "PNG"
    out.save()


which = ARGS[2] if len(ARGS) > 2 else "both"
if which in ("both", "game"):
    game_scene()
    clear_live()
if which in ("both", "sheet"):
    sheet()
if which == "close":
    closeups()
print("RENDER_DONE")
