# Previews for the igloo W3 wall chunks (lane B). Lights/cameras live in a
# separate "W3_Preview" collection that never goes into the GLB.
import bpy, math, random, os
import numpy as np
from mathutils import Vector, Euler


def prev_coll(scene):
    c = bpy.data.collections.get("W3_Preview")
    if c is None:
        c = bpy.data.collections.new("W3_Preview")
        scene.collection.children.link(c)
    return c


def clear_coll(c):
    for o in list(c.objects):
        bpy.data.objects.remove(o)


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def setup(scene, interior=True):
    c = prev_coll(scene)
    clear_coll(c)
    scene.render.engine = 'BLENDER_EEVEE'
    try:
        scene.eevee.taa_render_samples = 48
        scene.eevee.use_shadows = True
    except Exception:
        pass
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    w = scene.world or bpy.data.worlds.new("W3_World")
    scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.55, 0.68, 0.85, 1)
    bg.inputs[1].default_value = 0.35 if interior else 1.0
    # campfire glow (game has its own fire): glTF (4.4, y, 0.5) -> Blender (4.4, -0.5, z)
    fire = bpy.data.lights.new("W3_Fire", 'POINT')
    fire.energy = 4500
    fire.color = (1.0, 0.55, 0.26)
    fire.shadow_soft_size = 0.6
    fo = bpy.data.objects.new("W3_Fire", fire)
    fo.location = (4.4, -0.5, 0.9)
    c.objects.link(fo)
    # soft cool daylight through the snow
    sky = bpy.data.lights.new("W3_Sky", 'AREA')
    sky.energy = 900
    sky.size = 10
    sky.color = (0.78, 0.86, 1.0)
    so = bpy.data.objects.new("W3_Sky", sky)
    so.location = (0, 0, 8.6)
    c.objects.link(so)
    sun = bpy.data.lights.new("W3_Sun", 'SUN')
    sun.energy = 2.5
    sun.color = (1.0, 0.95, 0.88)
    sn = bpy.data.objects.new("W3_Sun", sun)
    sn.rotation_euler = Euler((math.radians(50), 0, math.radians(200)))
    c.objects.link(sn)
    # preview-only snow ground (the game has its own floor); never exported
    gm = bpy.data.meshes.new("W3_Ground")
    import bmesh as _bm
    b = _bm.new(); _bm.ops.create_circle(b, cap_ends=True, segments=64, radius=40.0); b.to_mesh(gm); b.free()
    gmat = bpy.data.materials.new("W3_GroundSnow"); gmat.use_nodes = True
    gb = gmat.node_tree.nodes.get("Principled BSDF")
    gb.inputs["Base Color"].default_value = (0.82, 0.86, 0.92, 1); gb.inputs["Roughness"].default_value = 0.85
    gm.materials.append(gmat)
    go = bpy.data.objects.new("W3_Ground", gm); go.location = (0, 0, -0.01); c.objects.link(go)
    cam = bpy.data.cameras.new("W3_Cam")
    co = bpy.data.objects.new("W3_Cam", cam)
    c.objects.link(co)
    scene.camera = co
    return c, co


def game_cam(scene, co):
    # rider ~1.1 m tall at glTF z=+1.5, camera 2.5 m up and 6 m behind, looking +Z (Blender -Y)
    co.location = (0.0, 4.5, 2.5)
    look_at(co, (0.0, -9.0, 1.7))
    co.data.lens_unit = 'FOV'
    co.data.sensor_fit = 'VERTICAL'
    co.data.angle = math.radians(62)
    scene.render.resolution_x = 720
    scene.render.resolution_y = 1280
    scene.render.resolution_percentage = 100


def render(scene, path):
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def explode(chunks, hit=(0.0, -9.3, 1.75), push=2.2, spin=35, seed=3, spread=0.55):
    """Push chunks outward (Blender -Y = glTF +Z) with some rotation; returns restore data."""
    rng = random.Random(seed)
    saved = [(o, o.location.copy(), o.rotation_euler.copy()) for o in chunks]
    h = Vector(hit)
    for o in chunks:
        d = Vector((o.location.x - h.x, 0, o.location.z - h.z))
        near = max(0.0, 1.0 - d.length / 4.0)
        out = Vector((0, -1, 0)) * (push * (0.45 + near)) + d.normalized() * (spread * d.length * (0.4 + near)) if d.length > 1e-6 else Vector((0, -push, 0))
        o.location = o.location + out
        a = math.radians(spin) * (0.4 + near)
        o.rotation_euler = Euler((rng.uniform(-a, a), rng.uniform(-a, a), rng.uniform(-a, a)))
    return saved


def restore(saved):
    for o, l, r in saved:
        o.location = l
        o.rotation_euler = r


def sheet(paths, cols, out):
    imgs = [bpy.data.images.load(p, check_existing=False) for p in paths]
    w, h = imgs[0].size
    rows = math.ceil(len(imgs) / cols)
    big = np.ones((rows * h, cols * w, 4), dtype=np.float32)
    for k, im in enumerate(imgs):
        a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
        r, c = divmod(k, cols)
        r = rows - 1 - r
        big[r * h:(r + 1) * h, c * w:(c + 1) * w] = a
    o = bpy.data.images.new("W3_sheet", cols * w, rows * h, alpha=True)
    o.pixels = big.ravel()
    o.filepath_raw = out
    o.file_format = 'PNG'
    o.save()
    for im in imgs:
        bpy.data.images.remove(im)
    bpy.data.images.remove(o)
    return out


def turntable(scene, co, target, radius, height, n, tmpdir, out, lens=40, res=(640, 640), cols=3):
    scene.render.resolution_x, scene.render.resolution_y = res
    co.data.lens_unit = 'MILLIMETERS'
    co.data.sensor_fit = 'AUTO'
    co.data.lens = lens
    paths = []
    t = Vector(target)
    for k in range(n):
        a = 2 * math.pi * k / n
        # start from outside (Blender -Y side) of the wall
        co.location = t + Vector((radius * math.sin(a), -radius * math.cos(a), height))
        look_at(co, t)
        paths.append(render(scene, os.path.join(tmpdir, "tt_%02d.png" % k)))
    sheet(paths, cols, out)
    for p in paths:
        os.remove(p)
    return out
