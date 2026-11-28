"""N9 lane D: snowy course trees from the Tripo raw GLBs (headless).
blender -b --factory-startup -P tree_build.py -- <tall|full|young> <raw.glb> <outdir> [--xmas]
Blender: +Z up. glTF +Y up. Origin = trunk base centre on the ground."""
import bpy, bmesh, sys, os, math, json, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
KEY, RAW, OUT = argv[0], argv[1], argv[2]
XMAS = "--xmas" in argv
CFG = {
    "tall":  dict(name="SM_Tree_Tall", h=9.0, grade=False),
    "full":  dict(name="SM_Tree_Full", h=6.0, grade=True),
    "young": dict(name="SM_Tree_Young", h=2.5, grade=True),
}[KEY]
NAME = CFG["name"]; H = CFG["h"]
LOD0_MAX, LOD1_MAX = 900, 250
TEX = 512
log = {"name": NAME}

def tris(o):
    o.data.calc_loop_triangles(); return len(o.data.loop_triangles)
def link(o):
    bpy.context.scene.collection.objects.link(o); return o
def sel(*obs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = active or obs[0]
def drop_small(o, min_tris):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    seen = set(); kill = []
    for f in bm.faces:
        if f in seen: continue
        st = [f]; seen.add(f); comp = []
        while st:
            g = st.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen: seen.add(h); st.append(h)
        if sum(len(x.verts) - 2 for x in comp) < min_tris: kill += comp
    n = sum(len(x.verts) - 2 for x in kill)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(o.data); bm.free(); return n
def decimate_to(o, target, vg=None):
    sel(o)
    for _ in range(8):
        t = tris(o)
        if t <= target: break
        m = o.modifiers.new("d", "DECIMATE"); m.use_collapse_triangulate = True; m.ratio = target / t * 0.995
        bpy.ops.object.modifier_apply(modifier="d")
    return tris(o)

# ------------------------------------------------ import + scale + origin
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RAW)
hi = [o for o in bpy.data.objects if o.type == "MESH"][0]
bpy.context.view_layer.update()
hi.data.transform(hi.matrix_world); hi.matrix_world = Matrix()
for o in list(bpy.data.objects):
    if o.type != "MESH": bpy.data.objects.remove(o)
hi.name = "Hi"
log["raw_tris"] = tris(hi)
log["dropped_tris"] = drop_small(hi, 12)
co = np.array([v.co for v in hi.data.vertices])
z0, z1 = co[:, 2].min(), co[:, 2].max()
s = H / (z1 - z0)
base = co[co[:, 2] < z0 + 0.015 * (z1 - z0)]
cx, cy = base[:, 0].mean(), base[:, 1].mean()
hi.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -z0)))
hi.data.update()
log["trunk_base_offset_raw"] = [round(float(cx), 4), round(float(cy), 4)]

# ------------------------------------------------ colour grade on the source: deeper blue-green foliage
mat_src = hi.data.materials[0]
if CFG["grade"]:
    nt = mat_src.node_tree
    bsdf = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    lk = bsdf.inputs["Base Color"].links[0]; src_sock = lk.from_socket
    nt.links.remove(lk)
    hsv = nt.nodes.new("ShaderNodeHueSaturation")
    hsv.inputs["Hue"].default_value = 0.585; hsv.inputs["Saturation"].default_value = 0.85; hsv.inputs["Value"].default_value = 0.72
    nt.links.new(src_sock, hsv.inputs["Color"])
    sep = nt.nodes.new("ShaderNodeSeparateColor"); sep.mode = "HSV"; nt.links.new(src_sock, sep.inputs[0])
    mh = nt.nodes.new("ShaderNodeMapRange"); mh.inputs[1].default_value = 0.17; mh.inputs[2].default_value = 0.24
    nt.links.new(sep.outputs[0], mh.inputs[0])
    ms = nt.nodes.new("ShaderNodeMapRange"); ms.inputs[1].default_value = 0.22; ms.inputs[2].default_value = 0.40
    nt.links.new(sep.outputs[1], ms.inputs[0])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    nt.links.new(mh.outputs[0], mul.inputs[0]); nt.links.new(ms.outputs[0], mul.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    nt.links.new(mul.outputs[0], mix.inputs["Factor"])
    nt.links.new(src_sock, mix.inputs[6]); nt.links.new(hsv.outputs[0], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])

# ------------------------------------------------ LOD0: decimated Tripo mesh
lo = hi.copy(); lo.data = hi.data.copy(); link(lo); lo.name = NAME
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
log["lod0_dec"] = decimate_to(lo, LOD0_MAX - 4)
log["lod0_dropped_bits"] = drop_small(lo, 4)
def tidy(o, eps=0.001):
    """consistent winding, no same-facing overlaps (z-fight), base on the ground"""
    from mathutils.geometry import intersect_point_tri
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bad = set()
    for e in bm.edges:
        ll = e.link_loops
        if len(ll) == 2 and ll[0].vert == ll[1].vert:
            f0, f1 = ll[0].face, ll[1].face
            bad.add(f0 if f0.calc_area() <= f1.calc_area() else f1)
    bmesh.ops.delete(bm, geom=list(bad), context="FACES")
    bm.faces.ensure_lookup_table()
    bvh_ = BVHTree.FromBMesh(bm, epsilon=0.0); kill = set()
    for f in bm.faces:
        if f in kill: continue
        n = f.normal
        if n.length < 0.5: continue
        a, b, c = (v.co for v in f.verts); cen = (a + b + c) / 3; hit = False
        for p_ in (cen, cen.lerp(a, .6), cen.lerp(b, .6), cen.lerp(c, .6)):
            for _, _, j, _ in bvh_.find_nearest_range(p_, eps):
                if j is None or j == f.index: continue
                g_ = bm.faces[j]
                if g_ in kill or n.dot(g_.normal) < 0.999: continue
                q = p_ - g_.normal * g_.normal.dot(p_ - g_.verts[0].co)
                if intersect_point_tri(q, *(v.co for v in g_.verts)):
                    kill.add(f if f.calc_area() <= g_.calc_area() else g_); hit = True; break
            if hit: break
    bmesh.ops.delete(bm, geom=list(kill), context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(o.data); bm.free()
    mz = min(v.co.z for v in o.data.vertices)
    o.data.transform(Matrix.Translation((0, 0, -mz))); o.data.update()
    return len(bad), len(kill), round(mz, 4)
log["lod0_tidy"] = tidy(lo)

# ------------------------------------------------ LOD1: stacked tier cones + trunk, fitted to the Tripo silhouette
TIERS = {"tall": 6, "full": 5, "young": 4}[KEY]
SEG = 10
co = np.array([v.co for v in hi.data.vertices]); rr = np.hypot(co[:, 0], co[:, 1]); zz = co[:, 2]
NB = 60; edges = np.linspace(0, H, NB + 1)
prof = np.array([np.percentile(rr[(zz >= edges[i]) & (zz < edges[i + 1])], 92) if ((zz >= edges[i]) & (zz < edges[i + 1])).sum() > 3 else 0 for i in range(NB)])
rt = max(prof[1], 0.02 * H)
fol = np.nonzero(prof > 2.6 * rt)[0]
zf0 = max(edges[fol[0]] if len(fol) else 0.25 * H, 0.08 * H)
step = (H - zf0) / TIERS
bm = bmesh.new()
def ring(z, r, ph=0.0):
    return [bm.verts.new((r * math.cos(2 * math.pi * (k + ph) / SEG), r * math.sin(2 * math.pi * (k + ph) / SEG), z)) for k in range(SEG)]
tiers = []
for i in range(TIERS):
    zb = zf0 + i * step
    span = step * (1.75 if i < TIERS - 1 else 1.0)
    zt = min(H, zb + span)
    m_ = (edges[:-1] >= zb - 0.5 * step) & (edges[:-1] < zb + 0.8 * step)
    rb = float(prof[m_].max()) if m_.any() else rt * 3
    base = ring(zb, rb, 0.5 * (i % 2))
    apex = bm.verts.new((0, 0, zt)); under = bm.verts.new((0, 0, zb + 0.30 * step))
    for k in range(SEG):
        a, b = base[k], base[(k + 1) % SEG]
        bm.faces.new((a, b, apex)); bm.faces.new((b, a, under))
    tiers.append((round(zb, 3), round(zt, 3), round(rb, 3)))
TS = 6
tb = ring(0.0, rt * 1.05); tt = ring(zf0 + 0.35 * step, rt * 0.8)
for k in range(TS if TS == SEG else SEG):
    a, b = tb[k], tb[(k + 1) % SEG]; c, d = tt[(k + 1) % SEG], tt[k]
    bm.faces.new((a, b, c, d))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me1 = bpy.data.meshes.new(NAME + "_LOD1"); bm.to_mesh(me1); bm.free()
l1 = link(bpy.data.objects.new(NAME + "_LOD1", me1))
log["lod1_tiers"] = tiers; log["lod1_trunk_r"] = round(float(rt), 3); log["lod1_dec"] = tris(l1)
for o in (lo, l1):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free(); o.data.validate()

# ------------------------------------------------ shared UVs, bake colour + normal
for o, v in ((lo, 0), (l1, 1)):
    a = o.data.attributes.new("part", "INT", "FACE"); a.data.foreach_set("value", [v] * len(o.data.polygons))
sel(lo, l1, active=lo); bpy.ops.object.join()
tg = lo; me = tg.data
me.materials.clear()
me.shade_smooth(); me.set_sharp_from_angle(angle=math.radians(70))
me.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
part = [a.value for a in me.attributes["part"].data]; uvd = me.uv_layers["UVMap"].data
for p in me.polygons:
    if part[p.index] == 1:
        for li in p.loop_indices: uvd[li].uv = uvd[li].uv * 0.6
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.pack_islands(margin=0.004, rotate=True, scale=True)
bpy.ops.object.mode_set(mode="OBJECT")

# split LOD1 back out
for p in me.polygons: p.select = part[p.index] == 1
vs = set(i for p in me.polygons if p.select for i in p.vertices)
for v in me.vertices: v.select = v.index in vs
for e in me.edges: e.select = all(i in vs for i in e.vertices)
sel(tg); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
lod1 = [o for o in bpy.context.selected_objects if o != tg][0]
lod1.name = NAME + "_LOD1"; lod1.data.name = NAME + "_LOD1"; tg.data.name = NAME
for o in (tg, lod1):
    if "part" in o.data.attributes: o.data.attributes.remove(o.data.attributes["part"])

sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 4
bk = sc.render.bake
bk.use_selected_to_active = True; bk.cage_extrusion = 0.02 * H; bk.max_ray_distance = 0.10 * H; bk.margin = 4
mat = bpy.data.materials.new("M_" + NAME); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.8; bsdf.inputs["Metallic"].default_value = 0.0
img = bpy.data.images.new("T_%s_BC" % NAME, TEX, TEX, alpha=False)
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
imn = bpy.data.images.new("T_%s_N" % NAME, TEX, TEX, alpha=False, is_data=True)
texn = nt.nodes.new("ShaderNodeTexImage"); texn.image = imn
nm = nt.nodes.new("ShaderNodeNormalMap")
nt.links.new(texn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
me.materials.append(mat); lod1.data.materials.clear(); lod1.data.materials.append(mat)
# foliage-only source for the LOD1 cones (long rays must not land on the trunk)
hif = hi.copy(); hif.data = hi.data.copy(); link(hif); hif.name = "HiFoliage"
bm = bmesh.new(); bm.from_mesh(hif.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if math.hypot(*f.calc_center_median().xy) < 1.8 * rt], context="FACES")
bm.to_mesh(hif.data); bm.free()
def flatmat(n, c):
    m = bpy.data.materials.new(n); m.use_nodes = True; m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*c, 1); return m
extra = {}
fill_c = {"tall": (0.05, 0.20, 0.20), "full": (0.05, 0.22, 0.20), "young": (0.07, 0.26, 0.20)}[KEY]
for kind_ in ("fill", "trunk"):
    c_ = lod1.copy(); c_.data = lod1.data.copy(); link(c_)
    while c_.data.uv_layers: c_.data.uv_layers.remove(c_.data.uv_layers[0])
    bm = bmesh.new(); bm.from_mesh(c_.data)
    is_trunk = lambda f: all(math.hypot(v.co.x, v.co.y) < 1.2 * rt for v in f.verts)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if is_trunk(f) != (kind_ == "trunk")], context="FACES")
    if kind_ == "fill":
        for v in bm.verts: v.co.x *= 0.72; v.co.y *= 0.72
    bm.to_mesh(c_.data); bm.free()
    c_.data.materials.clear(); c_.data.materials.append(flatmat(kind_, fill_c if kind_ == "fill" else (0.33, 0.19, 0.10)))
    c_.name = kind_ + 'Src'; extra[kind_] = c_
bk.normal_space = "TANGENT"
for node, kind in ((tex, "DIFFUSE"), (texn, "NORMAL")):
    nt.nodes.active = node
    for tgt_, dist_, marg_, clear_ in ((tg, 0.12, 4, True), (lod1, 0.22, 1, False)):
        srcs_ = (hi, extra['fill']) if tgt_ is tg else (hif, extra['fill'], extra['trunk'])
        sel(*srcs_, tgt_, active=tgt_)
        bk.max_ray_distance = dist_ * H; bk.margin = marg_; bk.use_clear = clear_
        if kind == "DIFFUSE": bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
        else: bpy.ops.object.bake(type="NORMAL")
nt.nodes.active = tex

def export(path, objs):
    for o in bpy.data.objects: o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                              export_image_format="JPEG", export_jpeg_quality=85, export_draco_mesh_compression_enable=False,
                              export_cameras=False, export_lights=False, export_materials="EXPORT", export_texcoords=True,
                              export_normals=True, export_tangents=False)
    return os.path.getsize(path)

for o_ in (hi, hif, extra['fill'], extra['trunk']): bpy.data.objects.remove(o_, do_unlink=True)
os.makedirs(OUT, exist_ok=True)
log["tris"] = {tg.name: tris(tg), lod1.name: tris(lod1)}
log["bytes"] = export(os.path.join(OUT, NAME + ".glb"), [tg, lod1])

# ------------------------------------------------ Christmas variant (from the Full tree)
if XMAS:
    XN = "SM_Tree_Snowy_Xmas"
    x0 = tg.copy(); x0.data = tg.data.copy(); link(x0); x0.name = XN; x0.data.name = XN
    mat.name = "M_" + XN
    x1 = lod1.copy(); x1.data = lod1.data.copy(); link(x1); x1.name = XN + "_LOD1"; x1.data.name = XN + "_LOD1"
    bm = bmesh.new(); bm.from_mesh(x0.data); bvh = BVHTree.FromBMesh(bm); bm.free()
    gm = bpy.data.materials.new("glow"); gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    warm = (1.0, 0.70, 0.32, 1)
    gb.inputs["Base Color"].default_value = warm; gb.inputs["Emission Color"].default_value = warm
    gb.inputs["Emission Strength"].default_value = 1.4; gb.inputs["Roughness"].default_value = 0.4
    gbm = bmesh.new()
    rnd = random.Random(7)
    golden = math.pi * (3 - math.sqrt(5))
    n_b = 10; placed = 0; k = 0
    while placed < n_b and k < 60:
        t = 0.16 + 0.68 * (k + 0.5) / 12; ang = k * golden * 1.0 + 0.4; k += 1
        z = H * t
        d = Vector((math.cos(ang), math.sin(ang), 0))
        loc, nor, idx, dist = bvh.ray_cast(Vector((0, 0, z)) + d * H, -d)
        if loc is None: continue
        r = 0.085
        c = loc + d * (r * 0.45)
        ret = bmesh.ops.create_icosphere(gbm, subdivisions=1, radius=r, matrix=Matrix.Translation(c))
        placed += 1
    # star on top: 5 points, extruded, standing upright facing +/-Y (Blender), tip pierces the tree top
    top = max((v.co.z for v in x0.data.vertices))
    tz = top + 0.08; R1, R2, th = 0.32, 0.14, 0.09
    ring = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5; rr = R1 if i % 2 == 0 else R2
        ring.append((rr * math.cos(a), rr * math.sin(a)))
    fr = [gbm.verts.new((x, -th / 2, tz + y)) for x, y in ring]
    bk_ = [gbm.verts.new((x, th / 2, tz + y)) for x, y in ring]
    cf = gbm.verts.new((0, -th * 0.9, tz)); cb = gbm.verts.new((0, th * 0.9, tz))
    for i in range(10):
        j = (i + 1) % 10
        gbm.faces.new((cf, fr[j], fr[i])); gbm.faces.new((cb, bk_[i], bk_[j]))
        gbm.faces.new((fr[i], fr[j], bk_[j], bk_[i]))
    bmesh.ops.recalc_face_normals(gbm, faces=gbm.faces)
    bmesh.ops.triangulate(gbm, faces=gbm.faces)
    gme = bpy.data.meshes.new("glow"); gbm.to_mesh(gme); gbm.free()
    gme.materials.append(gm); gme.shade_smooth()
    gme.uv_layers.new(name="UVMap")
    # root level (sibling of LOD0 and LOD1) so the star and bulbs also show while LOD1 is visible
    glow = link(bpy.data.objects.new("glow", gme))
    sel(glow); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02); bpy.ops.object.mode_set(mode="OBJECT")
    log["xmas"] = {"bulbs": placed, "star_bottom_z": round(tz - R1, 3), "tree_top_z": round(top, 3),
                   "tris": {XN: tris(x0), "glow": tris(glow), XN + "_LOD1": tris(x1)}}
    log["xmas"]["bytes"] = export(os.path.join(OUT, XN + ".glb"), [x0, x1, glow])
print("LOG", json.dumps(log))
