"""Summer lake lane D: SM_Tree_Leafy, a round friendly deciduous tree (procedural, headless).
blender -b --factory-startup -P leafy_build.py -- <outdir>
Blender: +Z up. glTF +Y up. Origin = trunk base centre on the ground.
Hi canopy = metaball cluster + clumpy displacement (bake source); LOD0/LOD1 = decimated canopy + trunk.
One material, baked 512 base colour + tangent normal (JPEG)."""
import bpy, bmesh, sys, os, math, json, random
from mathutils import Vector, Matrix, noise

OUT = sys.argv[sys.argv.index("--") + 1]
NAME = "SM_Tree_Leafy"; H = 7.0; TEX = 512
LOD0_MAX, LOD1_MAX = 900, 150
log = {"name": NAME}
rnd = random.Random(11)

def tris(o):
    o.data.calc_loop_triangles(); return len(o.data.loop_triangles)
def link(o):
    bpy.context.scene.collection.objects.link(o); return o
def sel(*obs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = active or obs[0]
def apply_mods(o):
    sel(o)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
def decimate_to(o, target):
    sel(o)
    for _ in range(10):
        t = tris(o)
        if t <= target: break
        m = o.modifiers.new("d", "DECIMATE"); m.use_collapse_triangulate = True; m.ratio = target / t * 0.995
        bpy.ops.object.modifier_apply(modifier="d")
    return tris(o)
def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); return link(bpy.data.objects.new(name, me))

bpy.ops.wm.read_factory_settings(use_empty=True)

# ------------------------------------------------ canopy: metaball cluster (soft lumpy dome)
CZ = 4.55  # canopy centre height
mb = bpy.data.metaballs.new("CanopyMB"); mb.resolution = 0.09; mb.render_resolution = 0.09; mb.threshold = 0.6
mbo = link(bpy.data.objects.new("CanopyMB", mb))
blobs = [((0, 0, CZ + 0.15), 2.05)]
for i in range(7):  # middle ring
    a = 2 * math.pi * i / 7 + 0.3
    blobs.append(((1.75 * math.cos(a), 1.75 * math.sin(a), CZ - 0.15 + 0.35 * rnd.uniform(-1, 1)), 1.45 + 0.15 * rnd.random()))
for i in range(4):  # upper ring
    a = 2 * math.pi * i / 4 + 0.9
    blobs.append(((1.0 * math.cos(a), 1.0 * math.sin(a), CZ + 1.05 + 0.2 * rnd.random()), 1.3 + 0.1 * rnd.random()))
blobs.append(((0.1, -0.1, CZ + 1.55), 1.25))
for i in range(5):  # lower ring, slightly tucked in
    a = 2 * math.pi * i / 5 + 0.1
    blobs.append(((1.3 * math.cos(a), 1.3 * math.sin(a), CZ - 1.05), 1.15))
for c, r in blobs:
    e = mb.elements.new(); e.co = c; e.radius = r; e.stiffness = 2.0
dg = bpy.context.evaluated_depsgraph_get()
me_c = bpy.data.meshes.new_from_object(mbo.evaluated_get(dg))
bpy.data.objects.remove(mbo); bpy.data.metaballs.remove(mb)
hic = link(bpy.data.objects.new("HiCanopy", me_c))
# fit: canopy top at H exactly
zs = [v.co.z for v in me_c.vertices]; z0c, z1c = min(zs), max(zs)
sz = (H - 0.0 - z0c) / (z1c - z0c)
me_c.transform(Matrix.Translation((0, 0, z0c)) @ Matrix.Diagonal((1, 1, sz, 1)) @ Matrix.Translation((0, 0, -z0c)))
log["canopy_raw"] = dict(bottom=round(z0c, 3), top=round(z1c, 3), zscale=round(sz, 3), width=round(max(v.co.x for v in me_c.vertices) - min(v.co.x for v in me_c.vertices), 3))
sel(hic); bpy.ops.object.shade_smooth()
# low canopy (before fine displacement): smooth the metaball, then decimate
loc_ = hic.copy(); loc_.data = hic.data.copy(); link(loc_); loc_.name = "LoCanopy"
m = loc_.modifiers.new("s", "SMOOTH"); m.factor = 0.5; m.iterations = 4
apply_mods(loc_)
# hi detail: leaf clumps (voronoi bumps) along the normal
tx = bpy.data.textures.new("clumps", "VORONOI"); tx.noise_scale = 0.42; tx.distance_metric = "DISTANCE"
tx.color_mode = "INTENSITY"; tx.noise_intensity = 1.0
m = hic.modifiers.new("sub", "SUBSURF"); m.levels = 1; m.render_levels = 1
m = hic.modifiers.new("disp", "DISPLACE"); m.texture = tx; m.strength = -0.22; m.mid_level = 0.35; m.texture_coords = "LOCAL"
m = hic.modifiers.new("s", "SMOOTH"); m.factor = 0.5; m.iterations = 2
apply_mods(hic)
log["hi_canopy_tris"] = tris(hic)

# ------------------------------------------------ trunk + two branches (tapered, slightly bent)
def tube(bm, pts, radii, seg):
    rings = []
    for i, (p, r) in enumerate(zip(pts, radii)):
        p = Vector(p)
        t = (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        u = t.orthogonal().normalized(); w = t.cross(u)
        rings.append([bm.verts.new(p + r * (math.cos(2 * math.pi * k / seg) * u + math.sin(2 * math.pi * k / seg) * w)) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    return rings
def trunk_mesh(name, seg, seg_b, branches=True):
    bm = bmesh.new()
    pts = [(0, 0, 0), (0.03, 0, 0.9), (0.0, 0.04, 1.9), (-0.05, 0.02, 2.9), (-0.06, 0.0, 3.9)]
    rad = [0.36, 0.25, 0.215, 0.185, 0.14]
    if not branches: pts, rad = [pts[0], pts[2], pts[4]], [0.33, 0.215, 0.14]
    tube(bm, pts, rad, seg)
    top = bm.verts.new(Vector(pts[-1]) + Vector((0, 0, 0.12)))
    ring = list(bm.verts)[-seg - 1:-1]
    for k in range(seg): bm.faces.new((ring[k], ring[(k + 1) % seg], top))
    if branches:
        for ang, tilt in ((0.4, 0.62), (0.4 + 2.6, 0.55)):
            d = Vector((math.cos(ang) * math.sin(tilt), math.sin(ang) * math.sin(tilt), math.cos(tilt)))
            p0 = Vector((0.0, 0.03, 2.35)); p1 = p0 + d * 1.0; p2 = p0 + d * 1.9 + Vector((0, 0, 0.25))
            rr = tube(bm, [p0, p1, p2], [0.13, 0.10, 0.06], seg_b)
            tip = bm.verts.new(p2 + d * 0.1)
            for k in range(seg_b): bm.faces.new((rr[-1][k], rr[-1][(k + 1) % seg_b], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm)
hit = trunk_mesh("HiTrunk", 16, 10)
m = hit.modifiers.new("sub", "SUBSURF"); m.levels = 1; apply_mods(hit)
lot = trunk_mesh("LoTrunk", 12, 6)
l1t = trunk_mesh("L1Trunk", 6, 4, branches=False)
log["trunk_tris"] = tris(lot)

# ------------------------------------------------ LODs from the smoothed canopy
l1c = loc_.copy(); l1c.data = loc_.data.copy(); link(l1c); l1c.name = "L1Canopy"
log["lod0_canopy"] = decimate_to(loc_, LOD0_MAX - 6 - tris(lot))
log["lod1_canopy"] = decimate_to(l1c, LOD1_MAX - 2 - tris(l1t))
for o in (loc_, l1c, lot, l1t):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free(); o.data.validate()

# ------------------------------------------------ shared UVs across LOD0 + LOD1 (LOD1 islands at 0.6 scale)
parts = [(loc_, 0), (lot, 1), (l1c, 2), (l1t, 3)]
for o, v in parts:
    a = o.data.attributes.new("part", "INT", "FACE"); a.data.foreach_set("value", [v] * len(o.data.polygons))
sel(*[p[0] for p in parts], active=loc_); bpy.ops.object.join()
tg = loc_; me = tg.data; me.materials.clear()
me.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
part = [a.value for a in me.attributes["part"].data]; uvd = me.uv_layers["UVMap"].data
for p in me.polygons:
    if part[p.index] >= 2:
        for li in p.loop_indices: uvd[li].uv = uvd[li].uv * 0.6
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.pack_islands(margin=0.010, rotate=True, scale=True)
bpy.ops.object.mode_set(mode="OBJECT")
def split(o, keep):
    """separate faces whose part is in keep into a new object"""
    me_ = o.data; pt = [a.value for a in me_.attributes["part"].data]
    for p in me_.polygons: p.select = pt[p.index] in keep
    vs = set(i for p in me_.polygons if p.select for i in p.vertices)
    for v in me_.vertices: v.select = v.index in vs
    for e in me_.edges: e.select = all(i in vs for i in e.vertices)
    sel(o); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    return [x for x in bpy.context.selected_objects if x != o][0]
l1t = split(tg, {3}); l1c = split(tg, {2}); lot = split(tg, {1}); loc_ = tg

# ------------------------------------------------ source materials (procedural), bake target material
def leaf_mat():
    m = bpy.data.materials.new("LeafSrc"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sxyz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["Normal"], sxyz.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    up = nt.nodes.new("ShaderNodeMapRange"); up.inputs[1].default_value = -0.7; up.inputs[2].default_value = 0.9
    nt.links.new(sxyz.outputs["Z"], up.inputs[0])
    hz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], hz.inputs[0])
    hr = nt.nodes.new("ShaderNodeMapRange"); hr.inputs[1].default_value = 2.6; hr.inputs[2].default_value = 7.0
    nt.links.new(hz.outputs["Z"], hr.inputs[0])
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 2.4; vor.feature = "F1"
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    vinv = nt.nodes.new("ShaderNodeMapRange"); vinv.inputs[1].default_value = 0.0; vinv.inputs[2].default_value = 0.55
    vinv.inputs[3].default_value = 1.0; vinv.inputs[4].default_value = 0.0
    nt.links.new(vor.outputs["Distance"], vinv.inputs[0])
    noi = nt.nodes.new("ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 1.3; noi.inputs["Detail"].default_value = 3
    nt.links.new(tc.outputs["Object"], noi.inputs["Vector"])
    def mul(a, b, op="MULTIPLY"):
        n = nt.nodes.new("ShaderNodeMath"); n.operation = op; nt.links.new(a, n.inputs[0])
        if isinstance(b, float): n.inputs[1].default_value = b
        else: nt.links.new(b, n.inputs[1])
        return n.outputs[0]
    # tone = 0.45*up + 0.25*height + 0.2*clump centre + 0.25*(noise-0.5)
    t = mul(up.outputs[0], 0.45)
    t = mul(t, mul(hr.outputs[0], 0.25), "ADD")
    t = mul(t, mul(vinv.outputs[0], 0.2), "ADD")
    t = mul(t, mul(mul(noi.outputs["Fac"], 0.5, "SUBTRACT"), 0.25), "ADD")
    cr = nt.nodes.new("ShaderNodeValToRGB"); el = cr.color_ramp.elements
    el[0].position = 0.08; el[0].color = (0.045, 0.16, 0.045, 1)
    el[1].position = 0.92; el[1].color = (0.46, 0.72, 0.17, 1)
    mid = el.new(0.5); mid.color = (0.15, 0.42, 0.08, 1)
    nt.links.new(t, cr.inputs[0]); nt.links.new(cr.outputs[0], b.inputs["Base Color"])
    return m
def bark_mat():
    m = bpy.data.materials.new("BarkSrc"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (7, 7, 0.9)
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    noi = nt.nodes.new("ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 3.0; noi.inputs["Detail"].default_value = 4
    nt.links.new(mp.outputs[0], noi.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB"); el = cr.color_ramp.elements
    el[0].position = 0.3; el[0].color = (0.15, 0.08, 0.04, 1); el[1].position = 0.75; el[1].color = (0.33, 0.19, 0.095, 1)
    nt.links.new(noi.outputs["Fac"], cr.inputs[0]); nt.links.new(cr.outputs[0], b.inputs["Base Color"])
    return m
hic.data.materials.append(leaf_mat()); hit.data.materials.append(bark_mat())
# hi trunk gets bark grooves for the normal map
tb = bpy.data.textures.new("bark", "CLOUDS"); tb.noise_scale = 0.08
m = hit.modifiers.new("sub", "SUBSURF"); m.levels = 2
m = hit.modifiers.new("disp", "DISPLACE"); m.texture = tb; m.strength = 0.025; m.texture_coords = "LOCAL"
apply_mods(hit)

sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 4
bk = sc.render.bake; bk.use_selected_to_active = True; bk.normal_space = "TANGENT"
mat = bpy.data.materials.new("M_" + NAME); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.75; bsdf.inputs["Metallic"].default_value = 0.0
img = bpy.data.images.new("T_%s_BC" % NAME, TEX, TEX, alpha=False)
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
imn = bpy.data.images.new("T_%s_N" % NAME, TEX, TEX, alpha=False, is_data=True)
texn = nt.nodes.new("ShaderNodeTexImage"); texn.image = imn
nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.65  # softer lumps, hides UV-seam steps
nt.links.new(texn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
for o in (loc_, lot, l1c, l1t):
    o.data.materials.clear(); o.data.materials.append(mat)
    sel(o); bpy.ops.object.shade_smooth()
# one bake per LOD (canopy + trunk joined) so a later bake's margin never paints over an earlier island
sel(loc_, lot, active=loc_); bpy.ops.object.join(); lod0 = loc_; lod0.name = NAME; lod0.data.name = NAME
sel(l1c, l1t, active=l1c); bpy.ops.object.join(); lod1 = l1c; lod1.name = NAME + "_LOD1"; lod1.data.name = NAME + "_LOD1"
for node, kind in ((tex, "DIFFUSE"), (texn, "NORMAL")):
    nt.nodes.active = node
    first = True
    for tgt, ext, dist, marg in ((lod0, 0.30, 0.7, 3), (lod1, 0.55, 1.3, 2)):
        sel(hic, hit, tgt, active=tgt)
        bk.cage_extrusion = ext; bk.max_ray_distance = dist; bk.margin = marg; bk.use_clear = first; first = False
        if kind == "DIFFUSE": bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
        else: bpy.ops.object.bake(type="NORMAL")
nt.nodes.active = tex

# ------------------------------------------------ tidy, export
for o in (lod0, lod1):
    if "part" in o.data.attributes: o.data.attributes.remove(o.data.attributes["part"])
    mz = min(v.co.z for v in o.data.vertices); o.data.transform(Matrix.Translation((0, 0, -mz)))
    o.data.update()
for o_ in (hic, hit): bpy.data.objects.remove(o_, do_unlink=True)
for m_ in list(bpy.data.materials):
    if m_.users == 0: bpy.data.materials.remove(m_)
os.makedirs(OUT, exist_ok=True)
p = os.path.join(OUT, NAME + ".glb")
for o in bpy.data.objects: o.select_set(o in (lod0, lod1))
bpy.ops.export_scene.gltf(filepath=p, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                          export_image_format="JPEG", export_jpeg_quality=85, export_draco_mesh_compression_enable=False,
                          export_cameras=False, export_lights=False, export_materials="EXPORT", export_texcoords=True,
                          export_normals=True, export_tangents=False)
log["tris"] = {lod0.name: tris(lod0), lod1.name: tris(lod1)}; log["bytes"] = os.path.getsize(p)
print("LOG", json.dumps(log))
