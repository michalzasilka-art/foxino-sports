# Preview sheets for the igloo break-out effect pieces (lane D).
# blender -b --factory-startup -P igloo_fx_preview.py -- <igloo_dir> <tmp_dir>
# Imports the exported GLBs (round-trip check) and writes previews/FX_pieces.png and previews/FX_turntable.png.
import bpy, bmesh, math, os, sys, struct, zlib
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
IGLOO, TMP = os.path.abspath(argv[0]), os.path.abspath(argv[1])
PREV = os.path.join(IGLOO, "previews")
os.makedirs(PREV, exist_ok=True); os.makedirs(TMP, exist_ok=True)
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.taa_render_samples = 64
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'


def write_png(path, arr):
    a8 = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    h, w, ch = a8.shape
    raw = b"".join(b"\x00" + a8[y].tobytes() for y in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ct = {3: 2, 4: 6}[ch]
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ct, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def load_png(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, 4)[::-1]          # row 0 = top


def world(col, strength):
    w = bpy.data.worlds.get("PW") or bpy.data.worlds.new("PW")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (*col, 1); bg.inputs[1].default_value = strength
    scene.world = w


def light(name, kind, loc, energy, col, size=1.0, rot=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = col
    if kind == 'AREA':
        ld.size = size
    ob = bpy.data.objects.new(name, ld); scene.collection.objects.link(ob)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    else:
        d = Vector((0, 0, 0.0)) - Vector(loc)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def camera(loc, target, lens=50):
    cd = bpy.data.cameras.new("Cam"); cd.lens = lens
    ob = bpy.data.objects.new("Cam", cd); scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = ob
    return ob


def render(path, w, h):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return load_png(path)[..., :3]


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(IGLOO, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    return [o for o in new if o.type == 'MESH'][0]


SHARDS = ["SM_Shard_1", "SM_Shard_2", "SM_Shard_3", "SM_Shard_4"]


def shard_row(rot_z=0.0):
    obs = []
    xs = [-0.70, -0.20, 0.26, 0.68]
    for n, x in zip(SHARDS, xs):
        o = import_glb(n)
        o.location = (x, 0, 0.25)
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (0.35, 0.2, rot_z)
        obs.append(o)
    return obs


def shards_stage():
    world((0.018, 0.022, 0.03), 1.0)
    light("Key", 'AREA', (1.6, -2.2, 2.4), 260, (1.0, 0.86, 0.7), 1.5)
    light("Rim", 'AREA', (-1.8, 2.0, 1.6), 200, (0.6, 0.78, 1.0), 1.5)
    light("Fill", 'AREA', (-2.0, -2.4, 0.8), 50, (0.8, 0.88, 1.0), 2.0)
    camera((0, -2.9, 0.95), (0, 0, 0.22), 50)


# --- panel A: shards on dark ----------------------------------------------------------
shards_stage(); shard_row(0.4)
A = render(os.path.join(TMP, "pA.png"), 1080, 600)

# --- turntable: 4 rows, each 90 degrees further -----------------------------------------
rows = []
for k in range(4):
    clear(); shards_stage(); shard_row(0.4 + k * math.pi / 2)
    rows.append(render(os.path.join(TMP, "tt%d.png" % k), 1600, 420))
write_png(os.path.join(PREV, "FX_turntable.png"), np.concatenate(rows, 0))

# --- panel B: sprites on dark blue (alpha-over; the sparkle also shown additive) --------
def over(bg, spr, x0, y0, scale=1, additive=False):
    if scale != 1:
        spr = np.kron(spr, np.ones((scale, scale, 1)))
    h, w = spr.shape[:2]
    reg = bg[y0:y0 + h, x0:x0 + w]
    a = spr[..., 3:4]
    if additive:
        reg[:] = np.clip(reg + spr[..., :3] * a, 0, 1)
    else:
        reg[:] = spr[..., :3] * a + reg * (1 - a)

B = np.zeros((560, 1080, 3)); B[:] = (0.06, 0.10, 0.22)
puff = load_png(os.path.join(IGLOO, "T_SnowPuff.png"))
spk = load_png(os.path.join(IGLOO, "T_Sparkle.png"))
over(B, puff, 40, 24, 2)                      # puff at 512 px
over(B, spk, 600, 24, 2)                      # sparkle at 256 px, normal blend
over(B, spk, 600 + 216, 280, 2, additive=True)  # sparkle at 256 px, additive

# --- panel C: light burst seen from inside, through a hole in a snow wall ---------------
clear()
world((0.30, 0.45, 0.75), 0.30)
snow = bpy.data.materials.new("PrevSnow"); snow.use_nodes = True
bs = snow.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = (0.80, 0.85, 0.92, 1); bs.inputs["Roughness"].default_value = 0.85
# wall from Blender y 0 .. +0.55 (inside is +y), hole |x| < 2.5, up to 4.5 (arch)
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = Vector((v.co.x * 16, v.co.y * 0.55 + 0.275, v.co.z * 8 + 4))
me = bpy.data.meshes.new("Wall"); bm.to_mesh(me); bm.free()
wall = bpy.data.objects.new("Wall", me); scene.collection.objects.link(wall); me.materials.append(snow)
outline = [(2.5, -0.2)] + [(2.5 * math.cos(a), 2.0 + 2.5 * math.sin(a)) for a in np.linspace(0, math.pi, 25)] + [(-2.5, -0.2)]
bm = bmesh.new()
top = [bm.verts.new((x, -1.0, z)) for x, z in outline]
f = bm.faces.new(top)
r = bmesh.ops.extrude_face_region(bm, geom=[f])
for v in [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]:
    v.co.y = 2.0
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
mc = bpy.data.meshes.new("Cut"); bm.to_mesh(mc); bm.free()
cut = bpy.data.objects.new("Cut", mc); scene.collection.objects.link(cut); cut.hide_render = True
mod = wall.modifiers.new("Hole", 'BOOLEAN'); mod.object = cut; mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); bpy.context.object.data.materials.append(snow)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 6.3, 8.0)); bpy.context.object.scale = (16, 11.5, 0.3); bpy.context.object.data.materials.append(snow)  # igloo roof stand-in
bpy.ops.mesh.primitive_cube_add(size=1, location=(-8.2, 6.3, 4)); bpy.context.object.scale = (0.3, 11.5, 8); bpy.context.object.data.materials.append(snow)
bpy.ops.mesh.primitive_cube_add(size=1, location=(8.2, 6.3, 4)); bpy.context.object.scale = (0.3, 11.5, 8); bpy.context.object.data.materials.append(snow)
light("Sun", 'SUN', (0, -10, 10), 3.0, (1.0, 0.95, 0.88), rot=(math.radians(50), 0, math.radians(10)))
light("Fire", 'POINT', (3.2, 4.0, 0.6), 600, (1.0, 0.55, 0.25))
light("Fill", 'POINT', (-2.5, 6.5, 3.5), 150, (1.0, 0.8, 0.6))
burst = import_glb("SM_LightBurst")
cname = burst.data.color_attributes[0].name
pm = bpy.data.materials.new("PrevBurstAdditive"); pm.use_nodes = True; nt = pm.node_tree; nt.nodes.clear()
o = nt.nodes.new("ShaderNodeOutputMaterial"); ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = cname
mul = nt.nodes.new("ShaderNodeMath"); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 3.0
em = nt.nodes.new("ShaderNodeEmission"); tr = nt.nodes.new("ShaderNodeBsdfTransparent"); add = nt.nodes.new("ShaderNodeAddShader")
nt.links.new(ca.outputs["Alpha"], mul.inputs[0]); nt.links.new(mul.outputs[0], em.inputs["Strength"])
nt.links.new(ca.outputs["Color"], em.inputs["Color"])
nt.links.new(em.outputs[0], add.inputs[0]); nt.links.new(tr.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], o.inputs[0])
pm.surface_render_method = 'BLENDED'; pm.use_backface_culling = False
burst.data.materials.clear(); burst.data.materials.append(pm)
camera((0.3, 6.0, 2.5), (0, -3.0, 2.4), 22)
C = render(os.path.join(TMP, "pC.png"), 1080, 760)

sheet = np.concatenate([A, B, C], 0)          # 1080 x 1920 (9:16)
write_png(os.path.join(PREV, "FX_pieces.png"), sheet)
print("PREVIEW_OK", sheet.shape)
