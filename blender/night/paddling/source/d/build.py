"""Paddling N20 lane D: build Boat_Hare / Boat_Owl from the Tripo raw GLB (headless).
blender -b --factory-startup -P build.py -- <hare|owl> <raw.glb> <outdir>
Blender axes: +Z up, bow at -Y. glTF (x,y,z) = Blender (x, z, -y)."""
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import boatlib as L

argv = sys.argv[sys.argv.index("--") + 1:]
KEY, RAW, OUT = argv[0], argv[1], argv[2]
NORMALMAP = "--normal" in argv
cfg = L.CFG[KEY]
NAME = cfg["name"]

# per-boat layout (glTF z), found from the zoomed renders
P = {
    "hare": dict(za=-4.45, zb=4.68, ycap=1.15, drum=dict(z=(3.45, 4.32), x=0.45, y=(0.535, 1.02)),
                 floor=(0.80, 0.55, 0.30), wall=(0.92, 0.86, 0.74), flange=(0.22, 0.45, 0.18),
                 bench=(0.78, 0.50, 0.24), ped=(0.85, 0.42, 0.10)),
    "owl":  dict(za=-4.45, zb=4.62, ycap=1.10, drum=dict(z=(3.68, 4.58), x=0.40, y=(0.565, 1.06)),
                 floor=(0.62, 0.38, 0.20), wall=(0.36, 0.20, 0.13), flange=(0.33, 0.16, 0.42),
                 bench=(0.80, 0.48, 0.24), ped=(0.85, 0.62, 0.15)),
}[KEY]
ANG = float(os.environ.get("UVANG", "72"))
HEADW = float(os.environ.get("HEADW", {"hare": "0.75", "owl": "0.55"}[KEY]))
T_WALL = 0.05      # liner inset from the outer hull
H_KNEE = 0.30      # liner wall is vertical above this height
FLANGE = 0.07
LOD0_MAX, LOD1_MAX, DRUM_MAX = 3500, 1000, 200
DRUM_POS = (0.0, 0.55, 3.55)   # glTF; drum skin top centre (see report)
DRUM_R, DRUM_H = 0.21, 0.26

log = {}
def save_jpg(img, path, q):
    try:
        img.save(filepath=path, quality=q)
    except TypeError:
        img.save()
def B(x, y, z):  # glTF -> Blender
    return Vector((x, -z, y))

def tris(ob):
    ob.data.calc_loop_triangles(); return len(ob.data.loop_triangles)

def link(ob):
    bpy.context.scene.collection.objects.link(ob); return ob

def mesh_obj(name, verts, faces, mats=None, mat_idx=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); link(ob)
    if mats:
        for m in mats: me.materials.append(m)
        if mat_idx is not None:
            me.polygons.foreach_set("material_index", mat_idx)
    return ob

def flat_mat(name, col, plank=False, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    if not plank:
        bsdf.inputs["Base Color"].default_value = (*col, 1)
    else:
        # plank seams along the length + soft grain
        tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs[0])
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 1 / 0.16
        nt.links.new(sep.outputs["X"], mul.inputs[0])
        fr = nt.nodes.new("ShaderNodeMath"); fr.operation = "FRACT"; nt.links.new(mul.outputs[0], fr.inputs[0])
        cr = nt.nodes.new("ShaderNodeValToRGB"); el = cr.color_ramp.elements
        el[0].position = 0.0; el[0].color = (col[0] * 0.55, col[1] * 0.55, col[2] * 0.55, 1)
        el[1].position = 0.06; el[1].color = (*col, 1)
        e2 = el.new(0.94); e2.color = (col[0] * 0.92, col[1] * 0.92, col[2] * 0.92, 1)
        e3 = el.new(1.0); e3.color = (col[0] * 0.55, col[1] * 0.55, col[2] * 0.55, 1)
        nt.links.new(fr.outputs[0], cr.inputs[0])
        nt.links.new(cr.outputs[0], bsdf.inputs["Base Color"])
    return m

# ---------------------------------------------------------------- 1. raw -> contract space
L.reset()
hi = L.import_raw(RAW)
log["raw_tris"] = tris(hi)
log["dropped_island_tris"] = L.weld_and_drop_islands(hi)
log["stretch"] = L.transform_to_contract(hi, cfg)
bvh = L.bvh_of(hi)
tops = []
for zg in np.arange(-2, 2.01, 0.1):
    for xx in (0.62, 0.64, 0.66, -0.62, -0.64, -0.66):
        p = L.ray(bvh, (xx, -zg, 5), (0, 0, -1))
        if p: tops.append(p.z)
gmed = float(np.median(tops))
hi.data.transform(Matrix.Translation((0, 0, L.GUNWALE - gmed)))
hi.data.update()
uf = cfg.get("under", 1.0)
if uf != 1.0:   # shallower draft: squash only the part below the waterline
    for v in hi.data.vertices:
        if v.co.z < 0: v.co.z *= uf
    hi.data.update()
hi.name = "Hull_hi"
pre = hi.copy(); pre.data = hi.data.copy(); link(pre); pre.name = "PreLOD1"

# ---------------------------------------------------------------- 2. separate the Tripo drum
D = P["drum"]
bm = bmesh.new(); bm.from_mesh(hi.data)
drum_faces = []
for f in bm.faces:
    c = f.calc_center_median(); zg = -c.y
    if D["z"][0] < zg < D["z"][1] and abs(c.x) < D["x"] and D["y"][0] < c.z < D["y"][1]:
        drum_faces.append(f)
dbm = bmesh.new()
vmap = {}
uvl = bm.loops.layers.uv.active; duv = dbm.loops.layers.uv.new("UVMap")
for f in drum_faces:
    vs = []
    for v in f.verts:
        if v not in vmap: vmap[v] = dbm.verts.new(v.co)
        vs.append(vmap[v])
    nf = dbm.faces.new(vs)
    for l0, l1 in zip(f.loops, nf.loops): l1[duv].uv = l0[uvl].uv
bmesh.ops.delete(bm, geom=drum_faces, context="FACES")
bm.to_mesh(hi.data); bm.free()
dme = bpy.data.meshes.new("DrumSrc"); dbm.to_mesh(dme); dbm.free()
dme.materials.append(hi.data.materials[0])
drum_src = link(bpy.data.objects.new("DrumSrc", dme))
dco = np.array([v.co for v in dme.vertices])
dlo, dhi = dco.min(0), dco.max(0)
log["drum_src"] = dict(tris=tris(drum_src), lo=dlo.tolist(), hi=dhi.tolist())

# ---------------------------------------------------------------- 3. hull profiles in the crew zone
bvh = L.bvh_of(hi)
za, zb = P["za"], P["zb"]
Z = np.round(np.arange(za - 0.6, zb + 0.61, 0.05), 3)
HS = np.round(np.arange(-0.15, 0.46, 0.05), 3)
outer = np.full((len(Z), len(HS)), np.nan); ybot = np.full(len(Z), np.nan)
for i, zg in enumerate(Z):
    p = L.ray(bvh, (0, -zg, -5), (0, 0, 1)); ybot[i] = p.z if p else np.nan
    for j, h in enumerate(HS):
        a = L.ray(bvh, (4, -zg, h), (-1, 0, 0)); b = L.ray(bvh, (-4, -zg, h), (1, 0, 0))
        if a and b: outer[i, j] = min(abs(a.x), abs(b.x))
outer = np.nan_to_num(outer, nan=0.0)
win = int(round(0.4 / 0.05))
outer_f = np.array([outer[max(0, i - win):i + win + 1].min(0) for i in range(len(Z))])
ybot_f = np.array([np.nanmax(ybot[max(0, i - 2):i + 3]) for i in range(len(Z))])

def out_at(zg, h):
    i = np.interp(zg, Z, np.arange(len(Z))); i0 = int(np.clip(np.floor(i), 0, len(Z) - 2)); t = i - i0
    row = outer_f[i0] * (1 - t) + outer_f[i0 + 1] * t
    return float(np.interp(h, HS, row))

def floor_at(zg):
    return max(0.0, float(np.interp(zg, Z, ybot_f)) + 0.10)

# rim height just outside the liner wall
grim = np.full(len(Z), np.nan)
for i, zg in enumerate(Z):
    wt = out_at(zg, H_KNEE + 0.02) - T_WALL
    hs = []
    for sgn in (1, -1):
        p = L.ray(bvh, (sgn * (wt + 0.03), -zg, 4), (0, 0, -1))
        if p and p.z < 0.62: hs.append(p.z)
    grim[i] = np.mean(hs) if hs else np.nan
gv = ~np.isnan(grim)
grim = np.interp(np.arange(len(Z)), np.nonzero(gv)[0], grim[gv])
gm = np.array([np.median(grim[max(0, i - win):i + win + 1]) for i in range(len(Z))])

def sect(zg):
    f = floor_at(zg)
    wt = out_at(zg, H_KNEE + 0.02) - T_WALL
    wf = min(out_at(zg, f + 0.03) - T_WALL, wt)
    g = min(float(np.interp(zg, Z, gm)), 0.56)
    return f, max(wf, 0.05), max(wt, 0.08), g

def wall_x(zg, y):
    f, wf, wt, g = sect(zg)
    if y >= H_KNEE: return wt
    t = (y - f) / max(H_KNEE - f, 1e-3)
    return wf + (wt - wf) * min(max(t, 0), 1)

# ---------------------------------------------------------------- 4. cut the old interior
def cut_interior(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    kill = []
    for fc in bm.faces:
        c = fc.calc_center_median(); zg = -c.y
        if not (za < zg < zb): continue
        f = floor_at(zg)
        if f - 0.005 < c.z < P["ycap"]:
            if abs(c.x) < wall_x(zg, c.z) + 0.025:
                kill.append(fc)
        elif c.z <= f - 0.005:
            p = L.ray(bvh, (c.x, c.y, c.z - 0.004), (0, 0, -1))
            if p is not None and (c.z - p.z) < 0.6:
                kill.append(fc)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(obj.data); bm.free()
    return kill
kill = cut_interior(hi)
log["cut_faces"] = len(kill)
log["dropped_after_cut"] = L.weld_and_drop_islands(hi, min_tris=40)
log["hull_hi_tris"] = tris(hi)

# ---------------------------------------------------------------- 5. liner (floor + walls + flange) and bulkheads
zs = [za]
while zs[-1] < zb - 1e-6:
    zc = zs[-1]
    step = 0.6 if (-2.2 < zc < 3.0) else 0.3
    zs.append(min(zb, zc + step))
verts, faces, midx = [], [], []
prof = []
for zg in zs:
    f, wf, wt, g = sect(zg)
    top = g + 0.012
    sec = [(-(wt + FLANGE), top), (-wt, top), (-wt, H_KNEE), (-wf, f), (wf, f), (wt, H_KNEE), (wt, top), (wt + FLANGE, top)]
    prof.append(dict(z=zg, f=round(f, 3), wf=round(wf, 3), wt=round(wt, 3), g=round(g, 3)))
    for (x, y) in sec: verts.append(B(x, y, zg))
n = 8
kinds = [2, 1, 1, 0, 1, 1, 2]   # 0 floor 1 wall 2 flange
for i in range(len(zs) - 1):
    for k in range(7):
        a, b = i * n + k, i * n + k + 1
        c, d = (i + 1) * n + k + 1, (i + 1) * n + k
        faces.append((a, d, c, b)); midx.append(kinds[k])
m_floor = flat_mat("liner_floor", P["floor"], plank=True)
m_wall = flat_mat("liner_wall", P["wall"])
m_flange = flat_mat("liner_flange", P["flange"])
liner = mesh_obj("Liner", verts, faces, [m_floor, m_wall, m_flange], midx)
# floor normal must point up
liner.data.calc_normals_split() if hasattr(liner.data, "calc_normals_split") else None
fl = [p for p in liner.data.polygons if p.material_index == 0][0]
if fl.normal.z < 0:
    bm = bmesh.new(); bm.from_mesh(liner.data); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(liner.data); bm.free()
log["liner_profile"] = prof

def prism(name, z0, z1, f, wf, wt, ytop, mat):
    """trapezoid bulkhead box between glTF z0..z1"""
    sec = [(-wf, f), (wf, f), (wt, ytop), (-wt, ytop)]
    vs = [B(x, y, z0) for x, y in sec] + [B(x, y, z1) for x, y in sec]
    fs = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    ob = mesh_obj(name, vs, fs, [mat])
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
    return ob

m_bench = flat_mat("bench_wood", P["bench"], plank=True)
m_bench_b = flat_mat("bulk_wood", P["bench"])
parts = []
for zz, s in ((za, 1), (zb, -1)):
    f, wf, wt, g = sect(zz)
    parts.append(prism("Bulk", zz - 0.05, zz + 0.05, f - 0.06, wf + 0.01, wt + 0.03, g + 0.035, m_bench_b))

# ---------------------------------------------------------------- 6. benches + drummer stool
def box(name, cx, cy, cz, sx, sy, sz, mat, bevel=0.012):
    """glTF centre/size"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = B(cx + v.co.x * sx, cy + v.co.z * sy, cz - v.co.y * sz)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me)); me.materials.append(mat); return ob

for rz in L.ROWS:
    wx = wall_x(rz, 0.335) + 0.02
    parts.append(box("Bench", 0, 0.33, rz, 2 * wx, 0.06, 0.32, m_bench))
    parts.append(box("Post", 0, 0.15, rz, 0.10, 0.30, 0.10, m_bench, bevel=0.0))
parts.append(box("Stool", 0, 0.33, 4.0, 0.44, 0.06, 0.32, m_bench))
parts.append(box("StoolPost", 0, 0.15, 4.0, 0.10, 0.30, 0.10, m_bench, bevel=0.0))
for p_ in parts:
    bpy.context.view_layer.objects.active = p_
bpy.ops.object.select_all(action="DESELECT")
for p_ in parts: p_.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
fit = parts[0]; fit.name = "Fittings"
# drop the hidden bottoms of the posts (they stand on the floor)
bm = bmesh.new(); bm.from_mesh(fit.data)
bot = [f for f in bm.faces if f.normal.z < -0.99 and f.calc_center_median().z < 0.01]
bot += [f for f in bm.faces if f.normal.z > 0.99 and abs(f.calc_center_median().z - 0.30) < 0.002 and f.calc_area() < 0.0101]
bmesh.ops.delete(bm, geom=bot, context="FACES"); bm.to_mesh(fit.data); bm.free()

# ---------------------------------------------------------------- 7. drum proxy fitted on the Tripo drum
cx, cyB = (dlo[0] + dhi[0]) / 2, (dlo[1] + dhi[1]) / 2
rx, ry = (dhi[0] - dlo[0]) / 2, (dhi[1] - dlo[1]) / 2
y0, y1 = dlo[2], dhi[2]
SEG = 16
rings = [(0.0, 0.90), (0.10, 0.985), (0.5, 1.0), (0.90, 0.985), (1.0, 0.90)]
dv, dfc = [], []
for (t, rf) in rings:
    for k in range(SEG):
        a = 2 * math.pi * k / SEG
        dv.append((cx + rx * rf * math.cos(a), cyB + ry * rf * math.sin(a), y0 + (y1 - y0) * t))
for r in range(len(rings) - 1):
    for k in range(SEG):
        a, b = r * SEG + k, r * SEG + (k + 1) % SEG
        dfc.append((a, b, b + SEG, a + SEG))
dfc.append(tuple(range(SEG))[::-1]); dfc.append(tuple(range((len(rings) - 1) * SEG, len(rings) * SEG)))
# final transform proxy -> contract position
sx_, sy_ = DRUM_R / rx, DRUM_R / ry; sh = DRUM_H / (y1 - y0)
tgt = B(*DRUM_POS)
def to_final(p):
    return Vector((tgt.x + (p[0] - cx) * sx_, tgt.y + (p[1] - cyB) * sy_, tgt.z + (p[2] - y1) * sh))
def to_fit(p):
    return Vector((cx + (p[0] - tgt.x) / sx_, cyB + (p[1] - tgt.y) / sy_, y1 + (p[2] - tgt.z) / sh))
# pedestal (8 sides) from the floor to the drum bottom, authored in final space
PS = 8; pr = 0.06; pv0 = len(dv)
for yy in (0.0, DRUM_POS[1] - DRUM_H + 0.01):
    for k in range(PS):
        a = 2 * math.pi * (k + 0.5) / PS
        q = to_fit(B(DRUM_POS[0] + pr * math.cos(a), yy, DRUM_POS[2] + pr * math.sin(a)))
        dv.append(tuple(q))
for k in range(PS):
    a, b = pv0 + k, pv0 + (k + 1) % PS
    dfc.append((a, b, b + PS, a + PS))
m_ped = flat_mat("drum_stand", P["ped"], rough=0.5)
drum = mesh_obj("DrumProxy", dv, dfc, [hi.data.materials[0], m_ped], [0] * (len(dfc) - PS) + [1] * PS)
bm = bmesh.new(); bm.from_mesh(drum.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(drum.data); bm.free()
ped_src = drum.copy(); ped_src.data = drum.data.copy(); link(ped_src); ped_src.name = "PedSrc"
bm = bmesh.new(); bm.from_mesh(ped_src.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == 0], context="FACES"); bm.to_mesh(ped_src.data); bm.free()
log["drum_tris"] = tris(drum)

# ---------------------------------------------------------------- 8. low target: decimated hull + fittings + liner + drum
liner_src = liner.copy(); liner_src.data = liner.data.copy(); link(liner_src); liner_src.name = "LinerSrc"
fit_src = fit.copy(); fit_src.data = fit.data.copy(); link(fit_src); fit_src.name = "FitSrc"
lo = hi.copy(); lo.data = hi.data.copy(); link(lo); lo.name = "HullLo"
budget = LOD0_MAX - 40 - tris(liner) - tris(fit)
hi_t = tris(hi)
vg = lo.vertex_groups.new(name="protect")
vg.add(list(range(len(lo.data.vertices))), 1.0, "REPLACE")
vg.add([v.index for v in lo.data.vertices if -v.co.y > zb or -v.co.y < za], HEADW, "REPLACE")
mod = lo.modifiers.new("dec", "DECIMATE"); mod.decimate_type = "COLLAPSE"; mod.use_collapse_triangulate = True
mod.vertex_group = "protect"; mod.vertex_group_factor = 1.0
mod.ratio = budget / hi_t
bpy.context.view_layer.objects.active = lo
bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True)
bpy.ops.object.modifier_apply(modifier="dec")
for _ in range(6):
    t = tris(lo)
    if t <= budget: break
    mod = lo.modifiers.new("dec", "DECIMATE"); mod.ratio = budget / t * 0.995; mod.vertex_group = "protect"; mod.vertex_group_factor = 1.0
    bpy.ops.object.modifier_apply(modifier="dec")
def clamp_rows(obj, xmin=0.612):
    """keep the seated rows clear: nothing above y 0.36 inside |x| < 0.6 (z +-0.5 around each row)"""
    n_ = 0
    for v in obj.data.vertices:
        zg = -v.co.y
        if v.co.z > 0.3605 and abs(v.co.x) < xmin and any(abs(zg - r) < 0.56 for r in L.ROWS):
            v.co.x = xmin if v.co.x >= 0 else -xmin; n_ += 1
    obj.data.update(); return n_
log["clamped_lo"] = clamp_rows(lo)
log["hull_lo_tris"] = tris(lo)
lo.data.calc_loop_triangles(); log["hull_lo_headtail_tris"] = sum(1 for t_ in lo.data.loop_triangles if -t_.center.y > zb or -t_.center.y < za)
lo.vertex_groups.clear()

# LOD1 = decimated copy of hull + liner + fittings, made before any UVs (no seams to stall the collapse)
l1parts = []
# voxel remesh of the closed pre-cut hull (closes the tiny Tripo tunnels that stop the collapse), then the same cut
bpy.ops.object.select_all(action="DESELECT"); pre.select_set(True); bpy.context.view_layer.objects.active = pre
while pre.data.uv_layers: pre.data.uv_layers.remove(pre.data.uv_layers[0])
rm = pre.modifiers.new("rm", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.025; rm.adaptivity = 0.0
bpy.ops.object.modifier_apply(modifier="rm")
log["lod1_remesh_tris"] = tris(pre)
cut_interior(pre)
L.weld_and_drop_islands(pre, min_tris=200)
l1parts.append(pre)
c_ = liner.copy(); c_.data = liner.data.copy(); link(c_); l1parts.append(c_)
bpy.ops.object.select_all(action="DESELECT")
for c_ in l1parts: c_.select_set(True)
bpy.context.view_layer.objects.active = l1parts[0]
bpy.ops.object.join()
lod1 = l1parts[0]; lod1.name = NAME + "_LOD1"
while lod1.data.uv_layers: lod1.data.uv_layers.remove(lod1.data.uv_layers[0])
bm = bmesh.new(); bm.from_mesh(lod1.data)
nm0 = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.003)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=0.001)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
log["lod1_nonmanifold"] = (nm0, sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary))
bm.to_mesh(lod1.data); bm.free()
bpy.ops.object.select_all(action="DESELECT"); lod1.select_set(True); bpy.context.view_layer.objects.active = lod1
for _ in range(8):
    t = tris(lod1)
    if t <= LOD1_MAX - 140: break
    mod = lod1.modifiers.new("dec", "DECIMATE"); mod.use_collapse_triangulate = True
    mod.ratio = (LOD1_MAX - 150) / t
    bpy.ops.object.modifier_apply(modifier="dec")
bm = bmesh.new(); bm.from_mesh(lod1.data)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-4)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(lod1.data); bm.free(); lod1.data.validate()
log["clamped_lod1"] = clamp_rows(lod1)
# plain (unbevelled) benches, stool, posts and bulkheads for LOD1
f1 = []
for rz in L.ROWS:
    wx = wall_x(rz, 0.335) + 0.02
    f1.append(box("Bench1", 0, 0.33, rz, 2 * wx, 0.06, 0.32, m_bench, bevel=0.0))
    f1.append(box("Post1", 0, 0.15, rz, 0.10, 0.30, 0.10, m_bench, bevel=0.0))
f1.append(box("Stool1", 0, 0.33, 4.0, 0.44, 0.06, 0.32, m_bench, bevel=0.0))
f1.append(box("StoolPost1", 0, 0.15, 4.0, 0.10, 0.30, 0.10, m_bench, bevel=0.0))
for zz in (za, zb):
    f, wf, wt, g = sect(zz)
    f1.append(prism("Bulk1", zz - 0.05, zz + 0.05, f - 0.06, wf + 0.01, wt + 0.03, g + 0.035, m_bench_b))
bpy.ops.object.select_all(action="DESELECT")
for o_ in f1: o_.select_set(True)
lod1.select_set(True); bpy.context.view_layer.objects.active = lod1
bpy.ops.object.join()
bm = bmesh.new(); bm.from_mesh(lod1.data)
bot = [f for f in bm.faces if f.normal.z < -0.99 and f.calc_center_median().z < 0.01 and f.calc_area() < 0.05]
bot += [f for f in bm.faces if f.normal.z > 0.99 and abs(f.calc_center_median().z - 0.30) < 0.002 and f.calc_area() < 0.0101 and len(f.verts) == 4]
bmesh.ops.delete(bm, geom=bot, context="FACES"); bm.to_mesh(lod1.data); bm.free()
log["lod1_tris_pre"] = tris(lod1)

# mark drum faces, join everything into the bake target
for ob_, flag in ((lo, 0), (liner, 0), (fit, 0), (drum, 1), (lod1, 2)):
    a = ob_.data.attributes.new("isdrum", "INT", "FACE")
    a.data.foreach_set("value", [flag] * len(ob_.data.polygons))
    ob_.data.uv_layers.clear() if hasattr(ob_.data.uv_layers, "clear") else None
    while ob_.data.uv_layers: ob_.data.uv_layers.remove(ob_.data.uv_layers[0])
bpy.ops.object.select_all(action="DESELECT")
for ob_ in (lo, liner, fit, drum, lod1): ob_.select_set(True)
bpy.context.view_layer.objects.active = lo
bpy.ops.object.join()
tgt_ob = lo; tgt_ob.name = NAME
me = tgt_ob.data
me.materials.clear()
# triangulate everything (quads stay planar; also gives exact counts)
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
me.shade_smooth()
me.set_sharp_from_angle(angle=math.radians(40))
me.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(ANG), island_margin=0.002, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
part = [a.value for a in me.attributes["isdrum"].data]
uvd = me.uv_layers["UVMap"].data
for p_ in me.polygons:
    if part[p_.index] == 2:
        for li in p_.loop_indices: uvd[li].uv = uvd[li].uv * 0.45
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.pack_islands(margin=0.003, rotate=True, scale=True)
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- 9. bake base colour (+ normal)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 4
sc.render.bake.use_selected_to_active = True
sc.render.bake.cage_extrusion = 0.03
sc.render.bake.max_ray_distance = 0.15
sc.render.bake.margin = 6
mat = bpy.data.materials.new("M_" + NAME); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.6
bsdf.inputs["Metallic"].default_value = 0.0
img_bc = bpy.data.images.new("T_" + NAME + "_BC", 1024, 1024, alpha=False)
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img_bc
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
me.materials.append(mat)
for ob_ in bpy.data.objects: ob_.select_set(False)
for ob_ in (hi, liner_src, fit_src, drum_src, ped_src): ob_.select_set(True)
tgt_ob.select_set(True); bpy.context.view_layer.objects.active = tgt_ob
nt.nodes.active = tex
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
os.makedirs(OUT, exist_ok=True)
bc_path = os.path.join(OUT, "T_%s_BC.jpg" % NAME)
img_bc.filepath_raw = bc_path; img_bc.file_format = "JPEG"
sc.render.image_settings.quality = 85
save_jpg(img_bc, bc_path, 85)
if NORMALMAP:
    img_n = bpy.data.images.new("T_" + NAME + "_N", 1024, 1024, alpha=False, is_data=True)
    texn = nt.nodes.new("ShaderNodeTexImage"); texn.image = img_n
    nt.nodes.active = texn
    sc.render.bake.normal_space = "TANGENT"
    bpy.ops.object.bake(type="NORMAL")
    n_path = os.path.join(OUT, "T_%s_N.jpg" % NAME)
    img_n.filepath_raw = n_path; img_n.file_format = "JPEG"
    save_jpg(img_n, n_path, 88)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(texn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
nt.nodes.active = tex

# ---------------------------------------------------------------- 10. split Drum, LOD1, seats
def split_part(val, newname):
    attr = [a.value for a in me.attributes["isdrum"].data]
    dv_ = set()
    for p_ in me.polygons:
        p_.select = attr[p_.index] == val
        if p_.select: dv_.update(p_.vertices)
    for v in me.vertices: v.select = v.index in dv_
    for e in me.edges: e.select = all(i in dv_ for i in e.vertices)
    bpy.ops.object.select_all(action="DESELECT"); tgt_ob.select_set(True); bpy.context.view_layer.objects.active = tgt_ob
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    o_ = [o for o in bpy.context.selected_objects if o != tgt_ob][0]
    o_.name = newname; o_.data.name = newname
    return o_
drum_ob = split_part(1, "Drum")
lod1 = split_part(2, NAME + "_LOD1")
# move the drum to its contract place
for v in drum_ob.data.vertices: v.co = to_final(v.co)
drum_ob.data.update()
# origin at the drum skin top centre
o = B(*DRUM_POS)
drum_ob.data.transform(Matrix.Translation(-o)); drum_ob.location = o
for ob_ in (tgt_ob, drum_ob, lod1):
    if "isdrum" in ob_.data.attributes: ob_.data.attributes.remove(ob_.data.attributes["isdrum"])

tgt_ob.data.name = NAME

# z-fight fixer (same test as blender-asset-qa: parallel same-facing tris within 1 mm that overlap)
def zfix(obj, eps=0.001):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.faces.ensure_lookup_table()
    bvh_ = BVHTree.FromBMesh(bm, epsilon=0.0)
    kill, info = set(), []
    for f in bm.faces:
        if f in kill or len(f.verts) != 3: continue
        n = f.normal
        if n.length < 0.5: continue
        a, b, c = (v.co for v in f.verts); cen = (a + b + c) / 3
        vs = set(f.verts)
        for p in (cen, cen.lerp(a, .6), cen.lerp(b, .6), cen.lerp(c, .6)):
            hit = False
            for _, _, j, _ in bvh_.find_nearest_range(p, eps):
                if j is None or j == f.index: continue
                g_ = bm.faces[j]
                if g_ in kill: continue
                if n.dot(g_.normal) < 0.999: continue
                a2 = g_.verts[0].co; q = p - g_.normal * g_.normal.dot(p - a2)
                from mathutils.geometry import intersect_point_tri
                if intersect_point_tri(q, *(v.co for v in g_.verts)):
                    victim = f if f.calc_area() <= g_.calc_area() else g_
                    kill.add(victim); info.append([round(x, 3) for x in victim.calc_center_median()]); hit = True; break
            if hit: break
    bmesh.ops.delete(bm, geom=list(kill), context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(obj.data); bm.free()
    return info
log["zfix_lod0"] = zfix(tgt_ob)
log["zfix_lod1"] = zfix(lod1)

# seats
for nm_, p in L.SEATS.items():
    e = bpy.data.objects.new(nm_, None); link(e); e.empty_display_type = "PLAIN_AXES"; e.empty_display_size = 0.15
    e.location = B(*p)
    e.parent = tgt_ob
drum_ob.parent = tgt_ob

# ---------------------------------------------------------------- 11. clean scene + export
for ob_ in (hi, liner_src, fit_src, drum_src, ped_src):
    bpy.data.objects.remove(ob_, do_unlink=True)
bpy.data.orphans_purge(do_recursive=True) if hasattr(bpy.data, "orphans_purge") else bpy.ops.outliner.orphans_purge(do_recursive=True)
log["final_tris"] = {o.name: tris(o) for o in bpy.data.objects if o.type == "MESH"}
glb = os.path.join(OUT, NAME + ".glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False, export_apply=True, export_yup=True,
                          export_image_format="JPEG", export_jpeg_quality=85, export_draco_mesh_compression_enable=False,
                          export_cameras=False, export_lights=False, export_materials="EXPORT", export_texcoords=True,
                          export_normals=True, export_tangents=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, NAME + "_build.blend"), compress=True)
log["glb_bytes"] = os.path.getsize(glb)
print("LOG", json.dumps(log))
