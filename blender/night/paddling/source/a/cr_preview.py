# cr_preview.py - previews of the exported crew GLBs (lane A).
# blender -b --factory-startup -P cr_preview.py -- stroke <glb> <out.png> <tmpdir>
# blender -b --factory-startup -P cr_preview.py -- turntable <out.png> <tmpdir> <glb1> <glb2> <glb3>
# blender -b --factory-startup -P cr_preview.py -- gamecam <out.png> <tmpdir> <fox> <robot> <bear>
import bpy, sys, os, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
mode = argv[0]
sc = bpy.context.scene
sc.render.fps = 30
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def gb(v): return Vector((v[0], -v[2], v[1]))

def load(glb, loc_game=(0, 0, 0), rot_y=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.name.startswith('Icosphere'): bpy.data.objects.remove(o, do_unlink=True)
    new = [o for o in bpy.data.objects if o not in before]
    rig = [o for o in new if o.type == 'ARMATURE'][0]
    rig.location = gb(loc_game); rig.rotation_euler = (0, 0, rot_y)
    for o in new:
        if o.type == 'MESH' and o.name.endswith('_LOD1') or (o.type == 'MESH' and '_LOD1.' in o.name):
            o.hide_render = True
    return new

def play(objs, clip, t):
    for o in objs:
        ad = o.animation_data
        if not ad: continue
        ad.action = None
        for tr in ad.nla_tracks: tr.mute = (tr.name != clip)
    return 1 + t * 30

def setup_render(w, h, engine='BLENDER_EEVEE'):
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.resolution_percentage = 100
    try:
        sc.render.engine = engine
    except Exception:
        sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.compression = 90
    sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    w_ = bpy.data.worlds.new('w'); sc.world = w_; w_.use_nodes = True
    bg = w_.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.62, 0.74, 0.88, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(150)); sun.data.angle = math.radians(8)
    sun.data.color = (1.0, 0.95, 0.88)

def mat(name, col, rough=0.6, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    return m

def box(name, size, loc, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name
    o.scale = size; o.data.materials.append(m); return o

def water(size=30, alpha=0.75):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0)); o = bpy.context.object; o.name = 'water'
    o.data.materials.append(mat('water', (0.10, 0.36, 0.52), 0.08, alpha)); return o

def cam(loc_game, look_game, lens=35):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(c); sc.camera = c
    c.location = gb(loc_game); d = gb(look_game) - gb(loc_game)
    c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); c.data.lens = lens
    c.data.sensor_fit = 'VERTICAL'; c.data.sensor_height = 24 * 16 / 9 if False else 24
    return c

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

def montage(files, cols, out, w, h):
    imgs = []
    for f in files:
        im = bpy.data.images.load(f); a = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4); imgs.append(a)
        bpy.data.images.remove(im)
    rows = (len(files) + cols - 1) // cols
    cw, ch = w // cols, h // rows
    canvas = np.ones((h, w, 4), dtype=np.float32)
    for k, a in enumerate(imgs):
        r = rows - 1 - k // cols; c = k % cols
        hh, ww = min(ch, a.shape[0]), min(cw, a.shape[1])
        canvas[r * ch:r * ch + hh, c * cw:c * cw + ww] = a[:hh, :ww]
    img = bpy.data.images.new('m', w, h); img.pixels[:] = canvas.ravel()
    img.filepath_raw = out; img.file_format = 'PNG'; img.save()
    for f in files: os.remove(f)

if mode == 'stroke':
    glb, out, tmp = argv[1], argv[2], argv[3]
    objs = load(glb)
    water(alpha=0.55)
    box('bench', (0.5, 0.3, 0.04), gb((0, 0.34, 0)), mat('wood', (0.45, 0.3, 0.18)))
    setup_render(360, 426)
    view = argv[4] if len(argv) > 4 else 'side'
    if view == 'side':
        c = cam((4.0, 0.45, 0.3), (0.0, 0.45, 0.2)); c.data.type = 'ORTHO'; c.data.ortho_scale = 1.95
        box('under', (0.02, 3.0, 0.8), gb((-0.3, -0.4, 0.0)), mat('waterside', (0.25, 0.52, 0.68), 0.3))
        box('line', (0.03, 3.0, 0.012), gb((-0.28, 0.0, 0.0)), mat('waterline', (0.08, 0.25, 0.4), 0.3))
    else:
        c = cam((1.6, 1.3, 2.4), (0.2, 0.4, 0.3), lens=40)
    files = []
    for k, t in enumerate([0.0, 0.15, 0.25, 0.45, 0.62, 0.8]):
        sc.frame_set(int(round(play(objs, 'paddle_L', t))))
        f = os.path.join(tmp, f'_st{k}.png'); render(f); files.append(f)
    montage(files, 2, out, 720, 1280)

elif mode == 'turntable':
    out, tmp = argv[1], argv[2]; glbs = argv[3:]
    setup_render(240, 426)
    files = []
    c = cam((0, 0.6, 3), (0, 0.55, 0), lens=50)
    floor = box('floor', (3, 3, 0.02), gb((0, -0.01, 0)), mat('snow', (0.85, 0.88, 0.92), 0.8))
    box('bench', (0.5, 0.3, 0.04), gb((0, 0.34, 0)), mat('wood', (0.45, 0.3, 0.18)))
    for glb in glbs:
        objs = load(glb)
        sc.frame_set(int(round(play(objs, 'paddle_L', 0.3))))
        for ang in (0, 135, 270):
            a = math.radians(ang); r = 3.0
            c.location = gb((r * math.sin(a), 0.75, r * math.cos(a)))
            c.rotation_euler = (gb((0, 0.55, 0)) - c.location).to_track_quat('-Z', 'Y').to_euler()
            f = os.path.join(tmp, f'_tt{len(files)}.png'); render(f); files.append(f)
        for o in objs: bpy.data.objects.remove(o, do_unlink=True)
    montage(files, 3, out, 720, 1280)

elif mode == 'gamecam':
    out, tmp, fox, robot, bear = argv[1], argv[2], argv[3], argv[4], argv[5]
    setup_render(720, 1280)
    water(size=80, alpha=1.0)
    # stand-in boat: hull + gunwale rails + benches
    wood = mat('hull', (0.55, 0.36, 0.2)); trim = mat('trim', (0.85, 0.82, 0.74))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=12, radius=1, location=(0, 0, 0.1))
    h = bpy.context.object; h.name = 'hull'; h.scale = (0.7, 5.7, 0.4); h.data.materials.append(wood)
    for nm_, size_, c_ in (('cut1', (1.6, 12, 0.8), 0.82), ('cut2', (1.24, 10.4, 1.2), 0.65)):
        cut = box(nm_, size_, gb((0, c_, 0)), wood); cut.hide_render = True; cut.hide_viewport = True
        md = h.modifiers.new(nm_, 'BOOLEAN'); md.object = cut; md.operation = 'DIFFERENCE'
    for z in (2.3, 0.6, -1.1, 4.0):
        box('bench', (1.3, 0.24, 0.04), gb((0, 0.34, z)), trim)
    box('drum', (0.3, 0.3, 0.18), gb((0, 0.46, 4.0 - 0.45)), mat('drum', (0.75, 0.15, 0.12)))
    # corrected contract: paddle_L blade at +X, so paddle_L riders sit on the +X side
    crew = [(fox, 'P1', (0.42, 2.3), 'paddle_L'), (robot, 'P1', (-0.42, 2.3), 'paddle_R'),
            (bear, 'P2', (0.42, 0.6), 'paddle_L'), (fox, 'P2', (-0.42, 0.6), 'paddle_R'),
            (bear, 'Drum', (0.0, 4.0), 'drum')]
    allo = []
    for glb, seat, (x, z), clip in crew:
        objs = load(glb, (x, 0, z), math.pi if seat == 'Drum' else 0.0)
        play(objs, clip, 0)
        allo.append(objs)
    sc.frame_set(1 + 9)  # t=0.3      # t = 0.3 s: just after the catch
    cam((0.0, 2.3, -3.6), (0.0, 0.35, 2.0), lens=30)
    render(out)
