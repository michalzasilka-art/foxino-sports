# WINTER STADIUM kit: the streetball kit (game coordinates: x right, y up, z toward the camera) plus the winter palette,
# polar helpers round the stadium centre, chamfered oriented boxes, puffy snow caps, pines, lanterns, a per-face
# shade jitter (COLOR_0, multiplied by the material colour in three.js) and dusk previews over the painted sky.
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix
_WSP = r"."  # the folder holding these scripts
exec(open(os.path.join(_WSP, 'sb_kit.py'), encoding='utf-8').read(), globals())
OUT = REPO + r"\blender\winter-stadium"
SKY = REPO + r"\blender\refs\winter-sky.png"

PAL.update({
    'Snow': 'f4f1ff', 'SnowShade': 'c9c2ea', 'Ice': 'bfe6ff', 'IceDeep': '8fcdf2',
    'StadiumWhite': 'f7f5ff', 'StadiumShade': 'ddd6f2', 'StadiumPurple': '5b3fb0', 'StadiumCyan': '3cc6ef', 'Mullion': '3a2a78',
    'WindowLit': 'ffcf7a', 'LampLit': 'ffcf7a', 'Glow': 'e8fbff',
    'Stone': 'c7c0e2', 'StoneDark': 'a69ecb', 'Paving': 'dcd6f1', 'Paving2': 'd2cbea', 'Paving3': 'e4dff6',
    'BPurple': '8f52d9', 'BMagenta': 'e0479e', 'BTeal': '1fb5a8', 'BOrange': 'ff8a2a', 'BBlue': '3a6fe0',
    'RYellow': 'ffcd1c', 'RPurple': '8f52d9', 'RCyan': '3cc6ef', 'ROrange': 'ff7d22', 'RPink': 'ff5fb8',
    'Gold': 'ffc94a', 'Bronze': 'd08a4c', 'PineGreen': '2f7f6e', 'PineDark': '215a50', 'Trunk': '6b4a3a', 'Wood': '9a6440',
    'Rock': '8f88b8', 'RockShade': '726a9e', 'Mountain': 'b3a8e0', 'MountainShade': '8e82c6', 'Forest': '45678a', 'ForestDark': '36527a',
    'Coal': '2a2433', 'Carrot': 'ff7d22', 'Hat': '8f52d9', 'Scarf': 'ff5fb8', 'FlagWhite': 'ffffff', 'PoleWhite': 'eeeaf8',
})
GLOW.update({'WindowLit': 3.5, 'LampLit': 5.0, 'Glow': 4.0})
CZ = -78.0
RNG = random.Random(2026)

def PP(th, r, y):
    return Vector((r * math.sin(th), y, CZ + r * math.cos(th)))

def Ry(th):
    return Matrix.Rotation(th, 3, 'Y')

def snow_mat(n):
    return 'Snow' if n.y > -0.35 else 'SnowShade'

def obox(mb, c, yaw, w, d, y0, y1, b, mat, skip_down=True):
    """A chamfered box: local x (tangent) width w, local z (outward) depth d, centred on c (x, z), rotated by yaw."""
    pts = []
    x0, x1, z0, z1 = -w / 2, w / 2, -d / 2, d / 2
    for x, sx in ((x0, 1), (x1, -1)):
        for y, sy in ((y0, 1), (y1, -1)):
            for z, sz in ((z0, 1), (z1, -1)):
                pts += [(x + sx * b, y, z + sz * b * 0.999), (x, y + sy * b, z + sz * b), (x + sx * b, y + sy * b * 1.001, z)]
    R = Ry(yaw); C = Vector((c[0], 0, c[1]))
    hull(mb, [C + R @ Vector(p) for p in pts], mat, skip_down)

def snowcap(mb, outline, y, h=0.22, over=0.07, seed=0):
    """A puffy snow slab on a convex outline [(x, z)] at height y: bulges out by `over`, rounded top."""
    rnd = random.Random(seed)
    cx = sum(p[0] for p in outline) / len(outline); cz = sum(p[1] for p in outline) / len(outline)
    pts = []
    for (x, z) in outline:
        dx, dz = x - cx, z - cz; L = math.hypot(dx, dz) or 1
        ux, uz = dx / L, dz / L
        pts.append((x + ux * over * 0.4, y - 0.02, z + uz * over * 0.4))
        pts.append((x + ux * over, y + h * 0.45, z + uz * over))
        k = rnd.uniform(0.75, 1.0)
        pts.append((x - ux * min(L * 0.25, 0.3), y + h * k, z - uz * min(L * 0.25, 0.3)))
    hull(mb, pts, snow_mat)

def snowcap_box(mb, c, yaw, w, d, y, h=0.22, over=0.07, seed=0):
    R = Ry(yaw); C = Vector((c[0], 0, c[1]))
    ol = []
    for lx, lz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)):
        p = C + R @ Vector((lx, 0, lz)); ol.append((p.x, p.z))
    snowcap(mb, ol, y, h, over, seed)

def pine(mb, x, z, h=6.0, seed=0, tiers=3, y=0.0):
    rnd = random.Random(seed)
    rt = h * 0.045
    prism(mb, (x, y - 0.1, z), (x, y + h * 0.22, z), rt, 5, 'Trunk', caps=(False, False))
    r0 = h * 0.36; base = y + h * 0.16
    for t in range(tiers):
        f = t / tiers
        r = r0 * (1 - 0.28 * t) * rnd.uniform(0.92, 1.05); ht = h * (0.46 - 0.06 * t)
        y0 = base + (h - h * 0.16 - ht) * f * 1.05
        rot = rnd.uniform(0, 1)
        lathe(mb, [(r, y0), (0.0, y0 + ht)], 7, 'PineGreen', c=(x, 0, z), rot=rot)
        cap_disc(mb, (x, 0, z), r, 7, y0, 'PineDark', up=False, rot=rot)
        lathe(mb, [(r * 0.66, y0 + ht * 0.33), (0.0, y0 + ht + 0.05)], 7, 'Snow', c=(x, 0, z), rot=rot + 0.22)

def lantern(mb, x, y, z, s=1.0, post=0.0):
    if post > 0:
        prism(mb, (x, y, z), (x, y + post, z), 0.05 * s, 6, 'Mullion', caps=(False, False))
        y = y + post
    bbox(mb, x - 0.13 * s, x + 0.13 * s, y, y + 0.05 * s, z - 0.13 * s, z + 0.13 * s, 0.01, 'Mullion')
    box(mb, x - 0.1 * s, x + 0.1 * s, y + 0.05 * s, y + 0.3 * s, z - 0.1 * s, z + 0.1 * s, 'LampLit', skip=('bot',))
    hull(mb, [(x + a * 0.15 * s, y + 0.3 * s, z + b * 0.15 * s) for a in (-1, 1) for b in (-1, 1)] + [(x, y + 0.45 * s, z)], 'Mullion')
    hull(mb, [(x + a * 0.11 * s, y + 0.36 * s, z + b * 0.11 * s) for a in (-1, 1) for b in (-1, 1)] + [(x, y + 0.5 * s, z)], 'Snow')

def build_ws(mb, name, c, origin=(0, 0, 0), jit=0.07, seed=1):
    ob = build(mb, name, c, origin)
    me = ob.data; rnd = random.Random(seed * 7919 + len(me.polygons))
    ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    flat = {'WindowLit', 'LampLit', 'Glow', 'Ice', 'IceDeep'}
    names = [m.name for m in me.materials]
    vals = []
    for p in me.polygons:
        v = 1.0 if names[p.material_index] in flat else 1.0 - rnd.random() * jit
        for _ in p.loop_indices: vals += [v, v, v, 1.0]
    ca.data.foreach_set('color', vals)
    me.color_attributes.active_color = ca; me.color_attributes.render_color_index = 0
    return ob

def ws_export(cname, fname=None):
    os.makedirs(OUT, exist_ok=True)
    for sc in bpy.data.scenes:
        for vl in sc.view_layers:
            for o in vl.objects:
                if o is not None: o.select_set(False, view_layer=vl)
    c = bpy.data.collections[cname]
    for o in c.all_objects: o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(c.all_objects))
    preview_mats(False)
    path = OUT + '\\' + (fname or cname) + '.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_animations=False, export_cameras=False, export_lights=False, export_extras=False,
                              export_materials='EXPORT', export_texcoords=True, export_normals=True, export_vertex_color='ACTIVE')
    for o in c.all_objects: o.select_set(False)
    return os.path.getsize(path)

def preview_mats(on):
    for m in bpy.data.materials:
        if not m.use_nodes or m.name not in PAL: continue
        nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
        if b is None: continue
        mix = nt.nodes.get('WSmix'); ca = nt.nodes.get('WScol')
        if on:
            if mix is None:
                ca = nt.nodes.new('ShaderNodeVertexColor'); ca.name = 'WScol'; ca.layer_name = 'Col'
                mix = nt.nodes.new('ShaderNodeMix'); mix.name = 'WSmix'; mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
                mix.inputs['Factor'].default_value = 1.0
            mix.inputs[6].default_value = b.inputs['Base Color'].default_value
            nt.links.new(ca.outputs['Color'], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs['Base Color'])
        else:
            for l in list(b.inputs['Base Color'].links): nt.links.remove(l)

def dusk_setup():
    sc = bpy.context.scene
    c = coll('WSPreview')
    def sun(name, color, energy, travel):
        o = bpy.data.objects.get(name)
        if o is None:
            o = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN')); c.objects.link(o)
        o.data.color = color; o.data.energy = energy; o.data.angle = math.radians(3)
        t = Vector((travel[0], -travel[2], travel[1]))
        o.rotation_euler = t.to_track_quat('-Z', 'Y').to_euler(); return o
    sun('WSFront', (0.8, 0.84, 1.0), 2.2, (0.25, -0.75, -0.6))
    sun('WSRim', (1.0, 0.58, 0.48), 3.2, (-0.15, -0.28, 0.95))
    w = sc.world or bpy.data.worlds.new('World'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.5, 0.42, 0.85, 1); bg.inputs[1].default_value = 0.7
    cam = bpy.data.objects.get('WSCam')
    if cam is None:
        cam = bpy.data.objects.new('WSCam', bpy.data.cameras.new('WSCam')); c.objects.link(cam)
    sc.camera = cam; cam.data.clip_end = 1500; cam.data.clip_start = 0.1
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0.0
    sc.render.film_transparent = True
    try:
        sc.eevee.use_shadows = True
    except Exception: pass
    return cam

def ws_render(path, pos, tgt, res, vfov, sky=True):
    import numpy as np
    sc = bpy.context.scene; cam = dusk_setup()
    look(cam, pos, tgt); cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(vfov)
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    tmp = os.path.join(_WSP, 'ws_tmp.png'); sc.render.filepath = tmp
    preview_mats(True)
    bpy.ops.render.render(write_still=True)
    preview_mats(False)
    im = bpy.data.images.load(tmp); W, H = im.size
    fg = np.array(im.pixels[:], np.float32).reshape(H, W, 4); bpy.data.images.remove(im)
    if sky:
        s = bpy.data.images.load(SKY); sw, sh = s.size
        sk = np.array(s.pixels[:], np.float32).reshape(sh, sw, 4); bpy.data.images.remove(s)
        # cover-crop the painting to the frame, keep its bottom (the horizon glow) at the bottom
        ar = W / H
        if sw / sh > ar:
            cw = int(sh * ar); x0 = (sw - cw) // 2; crop = sk[:, x0:x0 + cw]
        else:
            ch = int(sw / ar); crop = sk[:ch, :]
        yi = (np.arange(H) * crop.shape[0] / H).astype(int); xi = (np.arange(W) * crop.shape[1] / W).astype(int)
        bg = crop[yi][:, xi]
        a = fg[..., 3:4]
        out = fg.copy(); out[..., :3] = fg[..., :3] * a + bg[..., :3] * (1 - a); out[..., 3] = 1
    else:
        out = fg
    o = bpy.data.images.new('ws_out', W, H, alpha=True); o.pixels.foreach_set(out.ravel())
    o.filepath_raw = path; o.file_format = 'PNG'; o.save(); bpy.data.images.remove(o)
    return path

CAM_PHONE = ((0.78, 1.55, 23.4), (0.6, 4.2, -6), (1080, 1920), 58)
CAM_WIDE = ((1.1, 1.5, 21.8), (0.7, 3.4, -6), (1920, 1080), 40)

def refresh_mats():
    for nm, h in PAL.items():
        m = bpy.data.materials.get(nm)
        if m is None or not m.use_nodes: continue
        b = m.node_tree.nodes.get('Principled BSDF')
        rgb = [_lin(int(h[i:i + 2], 16)) for i in (0, 2, 4)]
        b.inputs['Base Color'].default_value = (*rgb, 1); m.diffuse_color = (*rgb, 1)
        b.inputs['Roughness'].default_value = 0.1 if nm == 'Ice' else 0.85
refresh_mats()
