"""Summer lake lane D previews (headless).
blender -b --factory-startup -P shore_preview.py -- <inspect|shore|turntable> <out.png> <glb> [<glb> ...] [--boat <boat.glb>]
Lake frame (Blender): race runs along Blender -Y (glTF +Z), lanes x -17.5..17.5, water at z 0."""
import bpy, sys, math, random, os
import numpy as np
from mathutils import Vector, Euler, Matrix
argv = sys.argv[sys.argv.index("--") + 1:]
BOAT = None
if "--boat" in argv:
    i = argv.index("--boat"); BOAT = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
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
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.52, 0.72, 0.95, 1); bg.inputs[1].default_value = 1.0
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 3.2; sun.data.color = (1.0, 0.96, 0.88); sun.rotation_euler = Euler((math.radians(40), math.radians(10), math.radians(-35)))

def mat(name, col, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m
grass = mat("grass", (0.20, 0.42, 0.09), 0.9)
water = mat("water", (0.05, 0.30, 0.42), 0.08)
rock = mat("rock", (0.30, 0.42, 0.40), 0.85)
sand = mat("sand", (0.62, 0.54, 0.38), 0.9)

protos = []
def load(g):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=g)
    new = [o for o in bpy.data.objects if o not in before]
    l0 = [o for o in new if o.parent is None and not o.name.endswith("_LOD1") and o.type in ("MESH", "EMPTY")]
    l1 = [o for o in new if o.name.endswith("_LOD1")]
    return (os.path.basename(g)[:-4], new, l0, l1)
for g in GLBS: protos.append(load(g))
boat = load(BOAT) if BOAT else None

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.clip_end = 900
def look(loc, tgt, lens):
    cam.location = Vector(loc); cam.data.lens = lens
    cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()

def place(proto, loc, rot=0.0, scale=1.0, lod=0):
    name, new, l0, l1 = proto
    srcs = l0 if (lod == 0 or not l1) else l1
    for o in srcs:
        c = o.copy(); sc.collection.objects.link(c); c.hide_render = False
        c.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Scale(scale, 4)
        for ch in o.children:
            cc = ch.copy(); sc.collection.objects.link(cc); cc.hide_render = False; cc.parent = c; cc.matrix_parent_inverse = Matrix()
    if lod == 1:  # root-level extras (e.g. glow) follow LOD1 too
        pass
def hide(objs):
    for o in objs: o.hide_render = True
for p in protos: hide(p[1])
if boat: hide(boat[1])
def find(key): return [p for p in protos if key in p[0]]

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

if MODE == "inspect":
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    x = 0
    for p in protos:
        w = max((max(o.dimensions.x, o.dimensions.y) for o in p[2] if o.type == "MESH"), default=5)
        place(p, Vector((x, 0, 0))); x += w + 1.5
        if p[3]: place(p, Vector((x, 0, 0)), lod=1); x += w + 2.5
    bpy.ops.mesh.primitive_plane_add(size=300); bpy.context.object.data.materials.append(grass)
    cx = (x - 6) / 2; look((cx, -x * 0.85, x * 0.22), (cx, 0, 3.5), 35)
    render(OUT)

elif MODE == "shore":
    # water + banks; lake 35 m lanes, shores at |x| >= 24
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -150, 0)); w_ = bpy.context.object
    w_.scale = (60, 420, 1); w_.data.materials.append(water)
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1); b = bpy.context.object
        b.scale = (60, 420, 1.2); b.location = (side * (22 + 30), -150, 0.0); b.data.materials.append(grass)
        bpy.ops.mesh.primitive_cube_add(size=1); s_ = bpy.context.object
        s_.scale = (3.0, 420, 0.5); s_.location = (side * 21.3, -150, 0.05); s_.rotation_euler = (0, side * math.radians(-8), 0); s_.data.materials.append(sand)
    # distant hills / mountains
    rnd = random.Random(5)
    for k in range(9):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1); m_ = bpy.context.object
        m_.scale = (rnd.uniform(40, 70), rnd.uniform(30, 50), rnd.uniform(25, 55))
        m_.location = (-160 + k * 40 + rnd.uniform(-10, 10), -420 - rnd.uniform(0, 60), -8); m_.data.materials.append(rock)
        bpy.ops.object.shade_smooth()
    leafy = find("Leafy"); pine = find("Pine")
    trees = leafy + pine
    for side in (-1, 1):
        y = 10.0
        while y > -260:
            for row in range(2):
                x = side * (24.5 + row * 6 + rnd.uniform(0, 4))
                p = rnd.choice(trees)
                place(p, Vector((x, y + rnd.uniform(-2, 2), 0.55)), rnd.uniform(0, 6.28), rnd.uniform(0.85, 1.15), lod=0 if y > -70 else 1)
            y -= rnd.uniform(6.0, 10.0)
    st = find("Grandstand")
    if st:
        # stand on the right bank: local -Y(Blender)=glTF +Z ... crowd faces glTF -Z; turn so it faces the lake (-X)
        for k in range(3):
            place(st[0], Vector((26.0, -40 - k * 12.0, 0.6)), math.radians(90) if False else -math.pi / 2)
    if boat:
        place(boat, Vector((0, 4.0, 0)), 0.0)
        look((0, 4.0 + 11.0, 6.5), (0, -28, 0.0), 24)
    else:
        look((0, 13.5, 4.2), (0, -30, 1.0), 26)
    render(OUT)

else:  # turntable: one row per model, 3 angles
    tiles = []
    W, Hh = 240, 1280 // len(protos)
    sc.render.resolution_x, sc.render.resolution_y = W, Hh
    bpy.ops.mesh.primitive_plane_add(size=300); bpy.context.object.data.materials.append(grass)
    for p in protos:
        for q in protos:
            for o in q[1]: o.hide_render = (q is not p) or o.name.endswith("_LOD1") or o.type != "MESH"
        h = max(o.dimensions.z for o in p[2] if o.type == "MESH"); wdt = max(max(o.dimensions.x, o.dimensions.y) for o in p[2] if o.type == "MESH")
        d = max(h, wdt * 0.8) * 1.9
        for a in (0, 120, 240):
            t = math.radians(a)
            look((d * math.sin(t), -d * math.cos(t), h * 0.62 + d * 0.15), (0, 0, h * 0.45), 50)
            path = OUT[:-4] + "_%s_%d.png" % (p[0], a); render(path); tiles.append(path)
    imgs = [bpy.data.images.load(p) for p in tiles]
    sheet = np.zeros((Hh * len(protos), W * 3, 4), dtype=np.float32)
    for k, im in enumerate(imgs):
        px = np.array(im.pixels[:], dtype=np.float32).reshape(Hh, W, 4)
        r, c = divmod(k, 3)
        sheet[(len(protos) - 1 - r) * Hh:(len(protos) - r) * Hh, c * W:(c + 1) * W] = px
    out = bpy.data.images.new("sheet", W * 3, Hh * len(protos), alpha=False)
    out.pixels[:] = sheet.ravel(); out.filepath_raw = OUT; out.file_format = "PNG"; out.save()
    for p in tiles: os.remove(p)
