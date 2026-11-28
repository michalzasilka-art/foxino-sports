"""Lane B summer-lake previews (headless, EEVEE).
blender -b --factory-startup -P lake_preview.py -- <race|turntable> <out.png> <glb_dir> [<boat.glb>]
race: 720x1280 race camera behind/above a boat (lane 5), lane ropes of SM_Buoy every 2 m, SM_Buoy_Big markers,
      shore with SM_Tent and SM_TeamFlag tinted in 5 team colours (tints are for the preview only).
turntable: 720x1280 sheet, 4 rows (Buoy, Buoy_Big, Tent, TeamFlag) x 2 views."""
import bpy, sys, math, os
from mathutils import Vector, Euler
argv = sys.argv[sys.argv.index("--") + 1:]
MODE, OUT, GD = argv[0], argv[1], argv[2]
BOAT = argv[3] if len(argv) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.image_settings.compression = 90
try:
    sc.eevee.taa_render_samples = 32
except Exception:
    pass
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.38, 0.58, 0.92, 1); bg.inputs[1].default_value = 0.75
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 2.9; sun.data.color = (1.0, 0.96, 0.88)
sun.rotation_euler = Euler((math.radians(42), math.radians(8), math.radians(-150)))
sun.data.angle = math.radians(2)

TEAMS = [(0.92, 0.22, 0.20), (0.18, 0.45, 0.92), (0.25, 0.74, 0.32), (0.99, 0.80, 0.16), (0.62, 0.34, 0.88)]


def mat(name, col, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GD, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    root = [o for o in new if o.parent is None][0]
    return root, new


def tinted(obj_list, col):
    """Per-object material override of the 'Tint' slot (preview only)."""
    for o in obj_list:
        for s in o.material_slots:
            if s.material and s.material.name.startswith("Tint"):
                m = s.material.copy(); m.name = "TintPrev"
                b = m.node_tree.nodes.get("Principled BSDF")
                base = b.inputs["Base Color"].default_value
                b.inputs["Base Color"].default_value = (base[0] * col[0], base[1] * col[1], base[2] * col[2], 1)
                s.link = "OBJECT"; s.material = m


def instance(src_objs, loc, rot_z=0.0):
    """Linked duplicate of a loaded model (root + children)."""
    root = [o for o in src_objs if o.parent is None][0]
    mp = {}
    for o in src_objs:
        c = o.copy(); sc.collection.objects.link(c); mp[o] = c
    for o, c in mp.items():
        if o.parent in mp:
            c.parent = mp[o.parent]
    r = mp[root]; r.location = Vector(loc); r.rotation_euler = (0, 0, rot_z)
    return list(mp.values())


cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.clip_end = 900


def look(loc, tgt, lens):
    cam.location = Vector(loc); cam.data.lens = lens
    cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()


buoy, buoy_o = load("SM_Buoy")
big, big_o = load("SM_Buoy_Big")
tent, tent_o = load("SM_Tent")
flag, flag_o = load("SM_TeamFlag")

if MODE == "race":
    water = mat("water", (0.02, 0.16, 0.24), 0.08)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -150, 0)); w = bpy.context.object
    w.scale = (60, 520, 1); w.location = (8, -150, 0); w.data.materials.append(water)
    sand = mat("sand", (0.62, 0.50, 0.30), 0.85); grass = mat("grass", (0.12, 0.34, 0.07), 0.8)
    rope_m = mat("rope", (0.85, 0.85, 0.8), 0.6)
    # shore: sand slope from the waterline, then grass
    bpy.ops.mesh.primitive_plane_add(size=1); s = bpy.context.object
    s.scale = (5, 520, 1); s.location = (23.2, -150, 0.12); s.rotation_euler = (0, math.radians(-3), 0)
    s.data.materials.append(sand)
    bpy.ops.mesh.primitive_plane_add(size=1); gr = bpy.context.object
    gr.scale = (60, 520, 1); gr.location = (55.6, -150, 0.25); gr.data.materials.append(grass)
    # far hills / mountains (soft shapes)
    hill = mat("hill", (0.07, 0.20, 0.06), 0.9); rock = mat("rock", (0.20, 0.24, 0.32), 0.8)
    for x, y, r, h, m in ((-120, -420, 160, 140, rock), (60, -460, 180, 190, rock), (220, -380, 150, 120, rock),
                          (110, -300, 90, 45, hill), (-60, -330, 110, 50, hill)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=(x, y, 0))
        o = bpy.context.object; o.scale = (r, r * 0.6, h); o.data.materials.append(m)
        bpy.ops.object.shade_smooth()
    # lane ropes: boundaries of 5 lanes x 7 m
    red = mat("Tint_red", (0.92 * 0.9, 0.9 * 0.2, 0.88 * 0.18), 0.35)
    for x in (-17.5, -10.5, -3.5, 3.5, 10.5, 17.5):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.012, depth=180, location=(x, -80, 0),
                                            rotation=(math.radians(90), 0, 0))
        bpy.context.object.data.materials.append(rope_m)
        for i in range(90):
            y = 8 - 2 * i
            objs = instance(buoy_o, (x, y, 0))
            if i % 2 == 0:
                for o in objs:
                    o.material_slots[0].link = "OBJECT"; o.material_slots[0].material = red
    # 50 m / 100 m markers just outside the course
    for y in (-25, -50, -100):  # 25 m extra, preview only
        for x in (-19.5, 19.5):
            instance(big_o, (x, y, 0))
    # shore: tents and team flags, 5 team colours
    for i in range(10):
        col = TEAMS[i % 5]
        tinted(instance(tent_o, (26.8, -4 - 10 * i, 0.25)), col)
        tinted(instance(flag_o, (23.4, 1 - 10 * i, 0.18)), col)
    # the camera's boat (lane 5)
    if BOAT:
        bpy.ops.import_scene.gltf(filepath=BOAT)
        for o in bpy.context.selected_objects:
            if o.parent is None:
                o.location.x += 14
    for o in buoy_o + big_o + tent_o + flag_o:
        o.hide_render = True
    look((14.6, 12.5, 5.8), (19.5, -24, 0.0), 21)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
else:
    import numpy as np
    floor = mat("floor", (0.42, 0.47, 0.52), 0.8)
    bpy.ops.mesh.primitive_plane_add(size=60); fl = bpy.context.object; fl.data.materials.append(floor)
    wat = mat("water", (0.03, 0.18, 0.27), 0.1)
    rows = [(buoy_o, 0.0, 1.05, 0.0, None), (big_o, 0.0, 2.1, 0.25, None),
            (tent_o, 0.0, 7.4, 1.4, TEAMS[1]), (flag_o, 0.0, 7.0, 1.75, TEAMS[0])]
    W, H = 360, 320
    sc.render.resolution_x, sc.render.resolution_y = W, H
    tiles = []
    allo = buoy_o + big_o + tent_o + flag_o
    for objs, _, dist, zt, col in rows:
        if col:
            tinted(objs, col)
        for o in allo:
            o.hide_render = o not in objs
        # buoys float: show the water line by lifting the floor to the lowest point for the land models only
        land = objs is tent_o or objs is flag_o
        fl.data.materials[0] = floor if land else wat
        for a in (30, 210):
            t = math.radians(a)
            # view from glTF -Z side (Blender +Y) first, then from behind
            look((dist * math.sin(t), dist * math.cos(t), zt + dist * 0.35), (0, 0, zt), 35)
            p = OUT + "_tile%d_%d.png" % (len(tiles), a); sc.render.filepath = p
            bpy.ops.render.render(write_still=True); tiles.append(p)
    sheet = np.zeros((1280, 720, 4), dtype=np.float32)
    for k, p in enumerate(tiles):
        im = bpy.data.images.load(p)
        px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
        r, c = k // 2, k % 2
        y0 = 1280 - (r + 1) * H
        sheet[y0:y0 + H, c * W:(c + 1) * W] = px
        bpy.data.images.remove(im); os.remove(p)
    out = bpy.data.images.new("sheet", 720, 1280, alpha=False)
    out.pixels = sheet.ravel().tolist()
    out.filepath_raw = OUT; out.file_format = "PNG"; out.save()
print("PREVIEW done", OUT)
