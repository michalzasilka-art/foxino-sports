# Igloo W3 break-out effect pieces (lane D).
# Builds SM_Shard_1..4, SM_LightBurst and the sprites T_SnowPuff / T_Sparkle.
# Run inside Blender 5.2 (live or: blender -b --factory-startup -P igloo_fx_build.py -- <out_dir>).
# Everything is built in its own scene "IglooFX_D"; nothing else in the file is touched.
import bpy, bmesh, math, random, os, sys, struct, zlib
import numpy as np
from mathutils import Vector

OUT = globals().get("FX_OUT") or os.environ.get("FX_OUT")
if OUT is None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    OUT = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.abspath(OUT)

# Run headless on a factory-startup file: the default scene is emptied and used.
assert bpy.app.background, "run headless: blender -b --factory-startup -P igloo_fx_build.py -- <out_dir>"
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for d in list(coll):
        coll.remove(d)
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0


def clean_name(name):
    for coll in (bpy.data.meshes, bpy.data.materials):
        old = coll.get(name)
        if old:
            coll.remove(old)


# ---------------------------------------------------------------- materials
def mat_snow():
    clean_name("M_Shard_Snow")
    m = bpy.data.materials.new("M_Shard_Snow")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.86, 0.90, 0.96, 1.0)  # white with a faint blue (linear)
    b.inputs["Roughness"].default_value = 0.9
    m.use_backface_culling = True
    b.inputs["Metallic"].default_value = 0.0
    return m


def mat_ice():
    clean_name("M_Shard_Ice")
    m = bpy.data.materials.new("M_Shard_Ice")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.30, 0.70, 0.90, 1.0)  # cyan-blue (linear)
    b.inputs["Roughness"].default_value = 0.1
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Alpha"].default_value = 0.75
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = True
    return m


def mat_burst():
    """Unlit (exports as KHR_materials_unlit): Background(colour = COLOR_0) mixed with
    Transparent by COLOR_0 alpha, gated by Light Path 'Is Camera Ray'."""
    clean_name("M_LightBurst")
    m = bpy.data.materials.new("M_LightBurst")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    va = nt.nodes.new("ShaderNodeVertexColor"); va.layer_name = "Col"
    bg = nt.nodes.new("ShaderNodeBackground")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix2 = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(va.outputs["Color"], bg.inputs["Color"])
    nt.links.new(va.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(bg.outputs[0], mix.inputs[2])
    nt.links.new(lp.outputs["Is Camera Ray"], mix2.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix2.inputs[1])
    nt.links.new(mix.outputs[0], mix2.inputs[2])
    nt.links.new(mix2.outputs[0], out.inputs["Surface"])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    return m


# ---------------------------------------------------------------- shards
def fib_points(n):
    pts = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - y * y)
        pts.append(Vector((math.cos(ga * i) * r, math.sin(ga * i) * r, y)))
    return pts


def superellipsoid(d, e):
    """push a unit direction toward a rounded box (e<1 = boxier)"""
    s = (abs(d.x) ** (2 / e) + abs(d.y) ** (2 / e) + abs(d.z) ** (2 / e)) ** (e / 2)
    return d / s


def make_shard(name, n, size, ratios, box_e, jitter, seed, mat, smooth_angle):
    rnd = random.Random(seed)
    pts = []
    for d in fib_points(n):
        d = Vector((d.x + rnd.uniform(-0.12, 0.12), d.y + rnd.uniform(-0.12, 0.12),
                    d.z + rnd.uniform(-0.12, 0.12))).normalized()
        p = superellipsoid(d, box_e) * rnd.uniform(1 - jitter, 1 + jitter * 0.4)
        pts.append(Vector((p.x * ratios[0], p.y * ratios[1], p.z * ratios[2])))
    clean_name(name)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    bm.verts.ensure_lookup_table()
    res = bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.delete(bm, geom=[v for v in res["geom_interior"] if isinstance(v, bmesh.types.BMVert)] +
                     [v for v in res["geom_unused"] if isinstance(v, bmesh.types.BMVert)], context='VERTS')
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # scale so the longest side is `size`
    xs = [v.co for v in bm.verts]
    ext = Vector((max(c.x for c in xs) - min(c.x for c in xs), max(c.y for c in xs) - min(c.y for c in xs),
                  max(c.z for c in xs) - min(c.z for c in xs)))
    k = size / max(ext)
    for v in bm.verts:
        v.co *= k
    # random orientation so the four pieces don't line up
    from mathutils import Euler
    R = Euler((rnd.uniform(0, 6.28), rnd.uniform(0, 6.28), rnd.uniform(0, 6.28))).to_matrix()
    for v in bm.verts:
        v.co = R @ v.co
    # volume centroid -> origin
    vol = 0.0; c = Vector()
    for f in bm.faces:
        a, b_, cc = (l.vert.co for l in f.loops)
        v6 = a.dot(b_.cross(cc))
        vol += v6; c += v6 * (a + b_ + cc) / 4
    c /= vol
    for v in bm.verts:
        v.co -= c
    # box-projected UVs (no textures, but keeps the mesh Unity-friendly)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        nrm = f.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        for l in f.loops:
            co = l.vert.co
            u, w = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            l[uv].uv = (u / size + 0.5, w / size + 0.5)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    if smooth_angle is not None:
        # sharp edges above the angle, smooth below (mesh-level, no modifier)
        me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    # replace the box projection with a non-overlapping smart unwrap
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=0.03)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------- light burst
def make_burst(mat):
    """A fan of soft light-ray planes opening out of the hole.
    Built in glTF space (x right, y up, z out of the hole); Blender (x, y, z) = (gx, -gz, gy)."""
    name = "SM_LightBurst"
    clean_name(name)
    WARM = (1.0, 0.92, 0.74)
    LEN = 6.0
    verts, cols, uvs, faces = [], [], [], []

    def grid(pos, alpha, nu, nv):
        """pos(u, v) -> Vector, alpha(i, j) -> float; i over nu+1 columns, j over nv+1 rows (v along the ray)."""
        base = len(verts)
        for j in range(nv + 1):
            for i in range(nu + 1):
                verts.append(pos(i / nu, j / nv))
                cols.append((*WARM, max(0.0, min(1.0, alpha(i, j)))))
                uvs.append((i / nu, j / nv))
        for j in range(nv):
            for i in range(nu):
                a = base + j * (nu + 1) + i
                faces.append((a, a + 1, a + nu + 2, a + nu + 1))

    def fade(v):                       # 1 at the hole -> 0 at the far end
        return (1 - v) ** 1.5

    # A fan of 9 soft ray planes radiating out of the hole: each starts narrow near the hole centre
    # (inside |x| <= 2.5, y 0 .. 4.5 at z = 0) and splays outward and wider to z ~ 6, so that seen
    # from inside the igloo the rays read as soft wedges spreading out of the opening.
    centre = Vector((0.0, 2.1, 0.0))
    rnd = random.Random(5)
    angles = [-6, 18, 43, 68, 92, 116, 141, 166, 186]          # degrees, 0 = +x, 90 = up (none point into the floor)
    for k, ang in enumerate(angles):
        ang = math.radians(ang + rnd.uniform(-4, 4))
        rad = Vector((math.cos(ang), math.sin(ang), 0.0))
        tang = Vector((-rad.y, rad.x, 0.0))
        r0 = rnd.uniform(0.08, 0.3)
        r1 = rnd.uniform(3.3, 4.3)
        length = rnd.uniform(5.4, 6.1)
        w0 = rnd.uniform(0.25, 0.4)
        w1 = rnd.uniform(2.2, 2.9)
        peak = 1.0 if k % 2 == 0 else rnd.uniform(0.7, 0.9)
        s0 = centre + rad * r0
        e0 = centre + rad * r1 + Vector((0, 0, length))

        def pos(u, v, s0=s0, e0=e0, tang=tang, w0=w0, w1=w1):
            return s0.lerp(e0, v) + tang * ((u - 0.5) * (w0 + (w1 - w0) * v))

        def alpha(i, j, peak=peak):
            u = i / 4 - 0.5
            return peak * math.cos(u * math.pi) ** 2 * fade(j / 4)   # soft across the ray, fades along it
        grid(pos, alpha, 4, 4)

    bverts = [(v.x, -v.z, v.y) for v in verts]
    me = bpy.data.meshes.new(name)
    me.from_pydata(bverts, [], faces)
    me.update()
    attr = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(cols):
        attr.data[i].color = c
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- sprites
def write_png_rgba(path, arr):
    """arr: HxWx4 float 0..1, row 0 = top"""
    a8 = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    h, w, _ = a8.shape
    raw = b"".join(b"\x00" + a8[y].tobytes() for y in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def value_noise(n, cells, rng):
    g = rng.random((cells + 1, cells + 1))
    g[-1, :] = g[0, :]; g[:, -1] = g[:, 0]
    x = np.linspace(0, cells, n, endpoint=False)
    i = x.astype(int); f = x - i
    f = f * f * (3 - 2 * f)
    a = g[np.ix_(i, i)]; b = g[np.ix_(i, i + 1)]; c = g[np.ix_(i + 1, i)]; d = g[np.ix_(i + 1, i + 1)]
    fy = f[:, None]; fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def snow_puff(n=256, seed=7):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1      # -1..1
    dens = np.zeros((n, n))
    # a few soft overlapping blobs make the cloudy outline
    for (cx, cy, r, w) in [(0, 0, 0.42, 1.0), (-0.22, 0.12, 0.30, 0.7), (0.24, 0.10, 0.28, 0.7),
                           (0.05, -0.24, 0.30, 0.65), (-0.12, -0.15, 0.25, 0.5), (0.15, 0.28, 0.22, 0.5)]:
        dens += w * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (r * 0.62) ** 2))
    fbm = sum(value_noise(n, c, rng) * a for c, a in [(4, 0.5), (8, 0.28), (16, 0.14), (32, 0.08)])
    dens *= 0.65 + 0.7 * fbm
    rr = np.sqrt(xx ** 2 + yy ** 2)
    window = np.clip(1 - (rr / 0.86), 0, 1) ** 1.5      # reaches 0 at r = 0.86 (well inside the border)
    alpha = 1 - np.exp(-1.9 * dens * window)
    alpha = alpha / alpha.max() * 0.92
    out = np.zeros((n, n, 4))
    out[..., 0] = 0.98; out[..., 1] = 0.99; out[..., 2] = 1.0   # white, straight alpha
    out[..., 3] = alpha
    return out


def sparkle(n=128):
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    c = (n - 1) / 2
    x = (xx - c) / c; y = (yy - c) / c                    # -1..1
    r = np.sqrt(x * x + y * y)
    core = np.exp(-(r / 0.06) ** 2)
    glow = 0.55 * np.exp(-(r / 0.22) ** 2) + 0.18 * np.exp(-(r / 0.45) ** 2)
    def streak(a, b):          # thin along b, long along a
        return np.exp(-(b / (0.035 + 0.05 * np.abs(a))) ** 2) * np.clip(1 - np.abs(a) / 0.85, 0, 1) ** 2.2
    star = 0.9 * (streak(x, y) + streak(y, x))
    d1 = (x + y) / math.sqrt(2); d2 = (x - y) / math.sqrt(2)
    star += 0.25 * (np.exp(-(d2 / 0.03) ** 2) * np.clip(1 - np.abs(d1) / 0.35, 0, 1) ** 2
                    + np.exp(-(d1 / 0.03) ** 2) * np.clip(1 - np.abs(d2) / 0.35, 0, 1) ** 2)
    a = np.clip(core + glow + star, 0, 1)
    a *= np.clip((0.97 - r) / 0.25, 0, 1) ** 2            # 0 at the border and the corners
    out = np.zeros((n, n, 4))
    out[..., 0] = 1.0; out[..., 1] = 0.98; out[..., 2] = 0.92   # warm white, straight alpha
    out[..., 3] = a
    return out


# ---------------------------------------------------------------- export
def export_glb(ob, path):
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_cameras=False,
                              export_lights=False, export_draco_mesh_compression_enable=False,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_animations=False, export_extras=False)


def patch_glb_json(path, fn):
    """Edit the JSON chunk of a GLB in place (binary chunk untouched)."""
    import json
    d = open(path, "rb").read()
    jl = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    fn(j)
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    rest = d[20 + jl:]
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest
    open(path, "wb").write(out)


def _burst_material_fix(j):
    # The Blender exporter keeps the unlit extension and COLOR_0 but writes the unlit mix as OPAQUE;
    # the effect needs vertex-alpha blending (the game draws it additively).
    for m in j["materials"]:
        if m["name"] == "M_LightBurst":
            m["alphaMode"] = "BLEND"
            m["doubleSided"] = True
            m["pbrMetallicRoughness"] = {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1}


def build():
    os.makedirs(OUT, exist_ok=True)
    ms, mi, mb = mat_snow(), mat_ice(), mat_burst()
    shards = [
        make_shard("SM_Shard_1", 30, 0.46, (1.0, 0.82, 0.62), 0.55, 0.10, 11, ms, None),  # big snow block bit
        make_shard("SM_Shard_2", 18, 0.24, (1.0, 0.9, 0.75), 0.75, 0.12, 23, ms, None),   # small snow lump
        make_shard("SM_Shard_3", 24, 0.36, (1.0, 0.62, 0.45), 1.15, 0.08, 37, mi, 50),    # ice slab
        make_shard("SM_Shard_4", 14, 0.20, (1.0, 0.8, 0.6), 1.0, 0.10, 41, mi, 50),       # small ice bit
    ]
    x = -0.9
    for s in shards:
        s.location = (0, 0, 0)
    burst = make_burst(mb)
    for ob in shards + [burst]:
        export_glb(ob, os.path.join(OUT, ob.name + ".glb"))
    patch_glb_json(os.path.join(OUT, "SM_LightBurst.glb"), _burst_material_fix)
    write_png_rgba(os.path.join(OUT, "T_SnowPuff.png"), snow_puff())
    write_png_rgba(os.path.join(OUT, "T_Sparkle.png"), sparkle())
    return {o.name: len(o.data.polygons) for o in shards + [burst]}


result = build()
