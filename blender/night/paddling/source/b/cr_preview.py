# Previews for the crews (headless): blender -b --factory-startup -P preview.py -- <hare.glb> <owl.glb> <outdir>
import bpy, sys, math, os
import numpy as np
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
HARE, OWL, OUT = argv[0], argv[1], argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30

def G(x, y, z): return Vector((x, -z, y))

def mat(name, col, rough=0.6, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    return m

def load(path):
    before_o = set(bpy.data.objects); before_a = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before_o]
    acts = {a.name.split('.')[0]: a for a in bpy.data.actions if a not in before_a}
    ico = [o for o in objs if o.name.startswith('Icosphere')]
    objs = [o for o in objs if o not in ico]
    for o in ico:
        o.hide_render = True
    rig = [o for o in objs if o.type == 'ARMATURE'][0]
    return rig, objs, acts

def pose(rig, objs, acts, clip, frame, lod1=False):
    a = acts[clip]
    for o in objs:
        if o.type == 'MESH' and o.name.split('.')[0].endswith('_LOD1'):
            o.hide_render = not lod1
        elif o.type == 'MESH' and o.parent == rig and o.parent_type != 'BONE':
            o.hide_render = lod1
        ad = o.animation_data
        if ad is None: continue
        for tr in ad.nla_tracks: tr.mute = True
        ad.action = a
        base = o.name.split('.')[0]
        ok = False
        for s in a.slots:
            if s.identifier.split('.')[0] == 'OB' + base:
                ad.action_slot = s; ok = True
        if not ok:
            raise RuntimeError('no slot for ' + o.name + ' in ' + a.name + ' ' + str([s.identifier for s in a.slots]))
    rig['frame'] = frame

def place(rig, pos_gltf, yaw_deg=0):
    # the importer leaves an object-level channel on the rig, so place it through a parent empty
    e = bpy.data.objects.new('Seat', None); sc.collection.objects.link(e)
    e.location = G(*pos_gltf); e.rotation_euler = (0, 0, math.radians(yaw_deg))
    rig.parent = e

def light_world():
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.55, 0.65, 0.8, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 3.2; sun.rotation_euler = Euler((math.radians(50), math.radians(10), math.radians(-35)))
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'AgX'
    sc.render.film_transparent = False

def cam(loc, target, lens=35, ortho=None):
    c = bpy.data.cameras.new('cam'); c.lens = lens
    if ortho: c.type = 'ORTHO'; c.ortho_scale = ortho
    o = bpy.data.objects.new('cam', c); sc.collection.objects.link(o); sc.camera = o
    o.location = loc; o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

def render(path, w, h, frame):
    sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.frame_set(frame)
    sc.render.filepath = path; sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.compression = 90
    bpy.ops.render.render(write_still=True)

def set_frames(entries):
    # entries: list of (rig, objs, acts, clip, frame)
    for rig, objs, acts, clip, fr in entries:
        pose(rig, objs, acts, clip, fr)

def eval_at(entries, frame_of):
    pass

def water(size=40, alpha=0.75):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    p = bpy.context.active_object; p.name = 'Water'
    m = mat('Water', (0.10, 0.32, 0.52), 0.15, alpha); p.data.materials.append(m)
    return p

def boat():
    # simple stand-in hull: open box with tapered ends, gunwale top y 0.42, 11.4 m long, 1.4 m wide
    import bmesh
    bm = bmesh.new()
    L, Wd = 11.4, 1.4
    prof = []
    for i in range(25):
        z = -L / 2 + L * i / 24
        t = abs(z) / (L / 2)
        half = Wd / 2 * (1 - max(0, t - 0.7) / 0.3 * 0.85)
        prof.append((z, half))
    def ring(z, half, yb, yt, inset):
        h = max(0.02, half - inset)
        return [G(-h, yt, z), G(-h * 0.85, yb, z), G(h * 0.85, yb, z), G(h, yt, z)]
    outer = [[bm.verts.new(v) for v in ring(z, h, -0.18, 0.42, 0)] for z, h in prof]
    inner = [[bm.verts.new(v) for v in ring(z, h, 0.0, 0.42, 0.06)] for z, h in prof]
    for k in range(24):
        for j in range(3):
            bm.faces.new((outer[k][j], outer[k + 1][j], outer[k + 1][j + 1], outer[k][j + 1]))
            bm.faces.new((inner[k][j + 1], inner[k + 1][j + 1], inner[k + 1][j], inner[k][j]))
        bm.faces.new((outer[k][0], inner[k][0], inner[k + 1][0], outer[k + 1][0]))
        bm.faces.new((outer[k + 1][3], inner[k + 1][3], inner[k][3], outer[k][3]))
    me = bpy.data.meshes.new('Boat'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Boat', me); sc.collection.objects.link(o)
    o.data.materials.append(mat('Hull', (0.62, 0.18, 0.14), 0.55))
    wood = mat('Bench', (0.62, 0.45, 0.28), 0.6)
    for zz in (2.3, 0.6, -1.1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=G(0, 0.36 - 0.025, zz)); b = bpy.context.active_object
        b.scale = (1.3, 0.26, 0.05); b.data.materials.append(wood)
    bpy.ops.mesh.primitive_cube_add(size=1, location=G(0, 0.36 - 0.025, 4.0)); b = bpy.context.active_object
    b.scale = (0.5, 0.3, 0.05); b.data.materials.append(wood)
    # drum in front of the drummer (drummer faces -Z, drum at its local (0, 0.55, +0.45) -> boat z 3.55)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.17, depth=0.3, location=G(0, 0.40, 3.55)); d = bpy.context.active_object
    d.data.materials.append(mat('Drum', (0.75, 0.15, 0.12), 0.5))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.165, depth=0.01, location=G(0, 0.552, 3.55)); d = bpy.context.active_object
    d.data.materials.append(mat('DrumSkin', (0.92, 0.86, 0.72), 0.6))
    return o

def tile(paths, cols, out, w, h):
    rows = []
    ims = []
    for p in paths:
        im = bpy.data.images.load(p); ims.append(np.array(im.pixels[:]).reshape(im.size[1], im.size[0], 4)); bpy.data.images.remove(im); os.remove(p)
    r = [np.concatenate(ims[i:i + cols], axis=1) for i in range(0, len(ims), cols)]
    sheet = np.concatenate(r[::-1], axis=0)
    img = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0]); img.pixels[:] = sheet.ravel()
    img.filepath_raw = out; img.file_format = 'PNG'; img.save()

MODE = argv[3] if len(argv) > 3 else 'all'
light_world()

# drivers for per-rig frame offsets: simplest is one shared scene frame, all clips at the same phase
if MODE in ('all', 'game'):
    BOAT = os.environ.get('BOAT')
    seats = [((+0.42, 2.3), HARE), ((-0.42, 2.3), OWL), ((+0.42, 0.6), OWL), ((-0.42, 0.6), HARE), ((+0.42, -1.1), HARE), ((-0.42, -1.1), OWL)]
    if BOAT:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=BOAT)
        found = {}
        for o in bpy.data.objects:
            if o not in before and o.name.startswith('Seat_'):
                p_ = o.matrix_world.translation; found[o.name] = (p_.x, -p_.y)   # Blender -> glTF (x, z)
        print('SEATS>>', found)
        order = ['Seat_L1', 'Seat_R1', 'Seat_L2', 'Seat_R2', 'Seat_L3', 'Seat_R3']
        if all(k in found for k in order):
            seats = [((found[k][0], found[k][1]), f) for k, (_, f) in zip(order, seats)]
        water(60, 0.88)
    else:
        boat(); water(60, 0.88)
    for (x, z), f in seats:
        rig, objs, acts = load(f)
        place(rig, (x, 0, z))
        pose(rig, objs, acts, 'paddle_L' if x > 0 else 'paddle_R', 10)
    rig, objs, acts = load(HARE)
    place(rig, (0, 0, 4.0), 180)
    pose(rig, objs, acts, 'drum', 0)
    cam(G(0.0, 2.6, -3.4), G(0, 0.25, 1.7), lens=30)
    render(os.path.join(OUT, 'crews_B_gamecam.png'), 720, 1280, 10)

if MODE in ('all', 'turn'):
    for o in list(bpy.data.objects):
        if o.type != 'LIGHT': bpy.data.objects.remove(o, do_unlink=True)
    chars = []
    for f in (HARE, OWL):
        rig, objs, acts = load(f); place(rig, (0, 0, 0))
        for o in objs:
            if o.animation_data:
                for tr in o.animation_data.nla_tracks: tr.mute = True
                o.animation_data.action = None
            if o.name.startswith('Paddle') or o.name.startswith('Mallet') or o.name.split('.')[0].endswith('_LOD1'): o.hide_render = True
        for pb in rig.pose.bones: pb.matrix_basis = Matrix()
        chars.append(objs)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); bpy.context.active_object.data.materials.append(mat('Floor', (0.8, 0.82, 0.86), 0.8))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.335)); b_ = bpy.context.active_object; b_.scale = (0.6, 0.26, 0.05)
    b_.data.materials.append(mat('Bench2', (0.62, 0.45, 0.28)))
    c = cam((0, -5, 0.6), (0, 0, 0.6), ortho=1.35)
    shots = []
    for ang in (0, 45, 180, 270):
        for ci, objs in enumerate(chars):
            vis = {id(o) for o in objs}
            for k, o2 in enumerate(chars):
                for o in o2:
                    if o.type == 'MESH' and not (o.name.startswith('Paddle') or o.name.startswith('Mallet') or o.name.split('.')[0].endswith('_LOD1')):
                        o.hide_render = (k != ci)
            a_ = math.radians(ang)
            d = Vector((math.sin(a_), -math.cos(a_), 0.2)).normalized()
            c.location = Vector((0, 0, 0.58)) + d * 6; c.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            p = os.path.join(OUT, '_t%d_%d.png' % (ang, ci)); render(p, 360, 320, 0); shots.append(p)
    tile(shots, 2, os.path.join(OUT, 'crews_B_turntable.png'), 720, 1280)

if MODE in ('all', 'stroke'):
    for o in list(bpy.data.objects):
        if o.type != 'LIGHT': bpy.data.objects.remove(o, do_unlink=True)
    rig, objs, acts = load(HARE); place(rig, (0, 0, 0)); pose(rig, objs, acts, 'paddle_R', 0)
    w = water(8, 0.55)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.335)); b = bpy.context.active_object; b.scale = (0.5, 0.26, 0.05)
    b.data.materials.append(mat('Bench3', (0.62, 0.45, 0.28)))
    sc.render.engine = 'BLENDER_EEVEE'
    c = cam((-5, -0.25, 1.25), (0, -0.25, 0.35), ortho=1.75)
    shots = []
    for fr in (0, 5, 10, 15, 20, 25):
        p = os.path.join(OUT, '_s%d.png' % fr); render(p, 360, 426, fr); shots.append(p)
    tile(shots, 2, os.path.join(OUT, 'crews_B_stroke.png'), 720, 1278)
