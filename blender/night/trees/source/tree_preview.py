"""N9 lane D tree previews (headless).
blender -b --factory-startup -P tree_preview.py -- <inspect|course|cluster|turntable> <out.png> <glb> [<glb> ...]"""
import bpy, sys, math, random, os
import numpy as np
from mathutils import Vector, Euler, Matrix
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
sc.render.image_settings.compression = 90
try: sc.eevee.taa_render_samples = 32
except Exception: pass
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.70, 0.79, 0.92, 1); bg.inputs[1].default_value = 1.0
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 2.1; sun.rotation_euler = Euler((math.radians(45), math.radians(15), math.radians(-30)))

def mat(name, col, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    return m

# load each GLB into its own collection (LOD0 + children; LOD1 kept separately)
protos = []
for g in GLBS:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=g)
    new = [o for o in bpy.data.objects if o not in before]
    l0 = [o for o in new if o.parent is None and not o.name.endswith("_LOD1")]
    l1 = [o for o in new if o.name.endswith("_LOD1")]
    protos.append((os.path.basename(g)[:-4], new, l0, l1))

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.clip_end = 500
def look(loc, tgt, lens):
    cam.location = Vector(loc); cam.data.lens = lens
    cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()

def place(proto, loc, rot=0.0, scale=1.0, lod=0):
    """instance a tree: copy the LOD objects (linked data)"""
    name, new, l0, l1 = proto
    srcs = l0 if lod == 0 else l1
    for o in srcs:
        c = o.copy(); sc.collection.objects.link(c); c.hide_render = False
        c.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Scale(scale, 4)
        for ch in o.children:
            cc = ch.copy(); sc.collection.objects.link(cc); cc.hide_render = False; cc.parent = c; cc.matrix_parent_inverse = Matrix()
    return

def hide_protos():
    for p in protos:
        for o in p[1]:
            o.hide_render = True

snow = mat("snow", (0.66, 0.72, 0.84), 0.85)

if MODE == "inspect":
    hide_protos()
    sc.render.resolution_x, sc.render.resolution_y = 1100, 800
    x = 0
    for p in protos:
        h = max((o.dimensions.z for o in p[2]), default=5)
        place(p, Vector((x, 0, 0))); place(p, Vector((x + h * 0.8, 0, 0)), lod=1); x += h * 2.0
    bpy.ops.mesh.primitive_plane_add(size=200); bpy.context.object.data.materials.append(snow)
    look((x / 2 - 2, -x * 0.9, x * 0.35), (x / 2 - 2, 0, x * 0.12), 35)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)

elif MODE == "course":
    hide_protos()
    slope = math.radians(17)
    # Blender: downhill toward -Y, surface z = y * tan(slope)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -20, 0))
    pl = bpy.context.object; pl.scale = (80, 200, 1); pl.rotation_euler = (slope, 0, 0)
    pl.location = (0, -40, -40 * math.tan(slope)); pl.data.materials.append(snow)
    def zs(y): return y * math.tan(slope)
    rnd = random.Random(3)
    trees = [p for p in protos if "Xmas" not in p[0]]
    for side in (-1, 1):
        y = 10.0
        while y > -120:
            x = side * (4.2 + rnd.uniform(0, 7))
            p = rnd.choice(trees)
            place(p, Vector((x, y, zs(y) - 0.15)), rnd.uniform(0, 6.28), rnd.uniform(0.85, 1.15), lod=0 if y > -45 else 1)
            y -= rnd.uniform(3.0, 6.0)
    xm = [p for p in protos if "Xmas" in p[0]]
    if xm: place(xm[0], Vector((-3.2, -15, zs(-15) - 0.1)), 0.6)
    # stand-in rider on a board
    rider = mat("rider", (0.95, 0.45, 0.12), 0.6); board = mat("board", (0.2, 0.45, 0.85), 0.5)
    ry = -4.0
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, ry, zs(ry) + 0.05)); b = bpy.context.object
    b.scale = (0.28, 1.4, 0.04); b.rotation_euler = (slope, 0, math.radians(70)); b.data.materials.append(board)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.8, location=(0, ry, zs(ry) + 0.55)); bpy.context.object.data.materials.append(rider)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(0, ry, zs(ry) + 1.08)); bpy.context.object.data.materials.append(rider)
    look((0, ry + 8.0, zs(ry) + 5.0), (0, ry - 10, zs(ry - 10) + 0.8), 22)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)

elif MODE == "cluster":
    hide_protos()
    bpy.ops.mesh.primitive_plane_add(size=300); bpy.context.object.data.materials.append(snow)
    rnd = random.Random(11)
    trees = [p for p in protos if "Xmas" not in p[0]]
    pts = []
    while len(pts) < 20:
        q = Vector((rnd.uniform(-9, 9), rnd.uniform(-9, 9), 0))
        if all((q - r).length > 3.0 for r in pts): pts.append(q)
    for i, q in enumerate(pts):
        place(trees[i % len(trees)], q, rnd.uniform(0, 6.28), rnd.uniform(0.85, 1.15))
    look((0, -34, 17), (0, 0, 2.5), 32)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)

else:  # turntable: one row per tree, 3 angles side by side
    tiles = []
    W, Hh = 240, 1280 // len(protos)
    sc.render.resolution_x, sc.render.resolution_y = W, Hh
    for p in protos:
        for q in protos:
            for o in q[1]: o.hide_render = (q is not p) or o.name.endswith("_LOD1")
        h = max(o.dimensions.z for o in p[2])
        for a in (0, 120, 240):
            t = math.radians(a); d = h * 1.9
            look((d * math.sin(t), -d * math.cos(t), h * 0.62), (0, 0, h * 0.5), 50)
            path = OUT[:-4] + "_%s_%d.png" % (p[0], a); sc.render.filepath = path; bpy.ops.render.render(write_still=True)
            tiles.append(path)
    imgs = [bpy.data.images.load(p) for p in tiles]
    sheet = np.zeros((Hh * len(protos), W * 3, 4), dtype=np.float32)
    for k, im in enumerate(imgs):
        px = np.array(im.pixels[:], dtype=np.float32).reshape(Hh, W, 4)
        r, c = divmod(k, 3)
        sheet[(len(protos) - 1 - r) * Hh:(len(protos) - r) * Hh, c * W:(c + 1) * W] = px
    out = bpy.data.images.new("sheet", W * 3, Hh * len(protos), alpha=False)
    out.pixels[:] = sheet.ravel(); out.filepath_raw = OUT; out.file_format = "PNG"; out.save()
    for p in tiles: os.remove(p)
