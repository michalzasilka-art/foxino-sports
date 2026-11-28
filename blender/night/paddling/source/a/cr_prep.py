# cr_prep.py - Paddling crews (lane A): Tripo crew -> cleaned, seated-rest, LOD0/LOD1, baked 1024 maps, transferred weights.
# Run: blender -b --factory-startup -P cr_prep.py -- <raw.glb> <outdir> <Tag> [voxel] [scale]
import bpy, bmesh, sys, os, math, json
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
RAW, OUT, TAG = argv[0], argv[1], argv[2]
VOXEL = float(argv[3]) if len(argv) > 3 else 0.005
SCALE = float(argv[4]) if len(argv) > 4 else 1.07
NAME = 'Crew_' + TAG
LOD0_T, LOD1_T = 1190, 396
BENCH = 0.36
os.makedirs(OUT, exist_ok=True)
log = {}

def upd():
    bpy.context.view_layer.update()

def ctx(o, sel=None):
    return bpy.context.temp_override(active_object=o, object=o, selected_objects=sel or [o],
                                     selected_editable_objects=sel or [o])

def set_active(o):
    for x in bpy.context.view_layer.objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True)

def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

# ---------------- import + strip ----------------
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=RAW)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
high = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('tripo')][0]
for o in list(bpy.data.objects):
    if o not in (arm, high): bpy.data.objects.remove(o, do_unlink=True)
for pb in arm.pose.bones: pb.custom_shape = None
mw_mesh = high.matrix_world.copy(); mw_arm = arm.matrix_world.copy()
high.parent = None; high.matrix_world = Matrix.Identity(4)
high.data.transform(Matrix.Scale(SCALE, 4) @ mw_mesh)
arm.data.transform(Matrix.Scale(SCALE, 4) @ mw_arm); arm.matrix_world = Matrix.Identity(4)
high.parent = arm; high.matrix_parent_inverse = Matrix.Identity(4)
for m in high.modifiers:
    if m.type == 'ARMATURE': m.object = arm
upd()

# drop leaf marker bones (*_End, *4) so all crews share one clean Mixamo set
set_active(arm); bpy.ops.object.mode_set(mode='EDIT')
removed = []
for eb in list(arm.data.edit_bones):
    n = eb.name.split(':')[-1]
    if n.endswith('_End') or (n[-1] == '4' and 'Hand' in n):
        removed.append(eb.name); arm.data.edit_bones.remove(eb)
bpy.ops.object.mode_set(mode='OBJECT')
for n in removed:
    vg = high.vertex_groups.get(n)
    if vg: high.vertex_groups.remove(vg)
log['removed_bones'] = removed
log['bones'] = [b.name for b in arm.data.bones]

# weld
bm = bmesh.new(); bm.from_mesh(high.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(high.data); bm.free()
log['high_tris'] = tris(high)
log['standing_height'] = max((v.co.z for v in high.data.vertices))

# ---------------- seated pose ----------------
P = arm.pose.bones
def B(n): return P['mixamorig:' + n]

def aim(pb, direction, extra=None):
    """rotate pose bone (minimal arc) so its Y axis points along direction (armature space)."""
    upd()
    M = pb.matrix.copy()
    cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    if extra is not None: q = extra @ q
    h = M.translation.copy()
    R = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h)
    pb.matrix = R @ M
    upd()

def rot_world(pb, q):
    upd(); M = pb.matrix.copy(); h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
    upd()

for pb in P:
    pb.rotation_mode = 'QUATERNION'
thigh_a = math.radians(6)     # thigh tilt below horizontal
shin_b = math.radians(18)     # shin forward from vertical
for s in ('Left', 'Right'):
    aim(B(s + 'UpLeg'), (0, -math.cos(thigh_a), -math.sin(thigh_a)))
    aim(B(s + 'Leg'), (0, -math.sin(shin_b), -math.cos(shin_b)))
    # foot: undo the leg chain pitch so the sole stays nearly level, toes slightly down
    upd()
    fd = (B(s + 'Foot').matrix.to_3x3() @ Vector((0, 1, 0)))
    rest_fd = (arm.data.bones['mixamorig:' + s + 'Foot'].matrix_local.to_3x3() @ Vector((0, 1, 0)))
    tgt = rest_fd.copy(); tgt = Quaternion((1, 0, 0), math.radians(-12)) @ tgt
    aim(B(s + 'Foot'), tgt)
# open the armpits before the voxel remesh: lift both upper arms 25 deg toward horizontal
for s in ('Left', 'Right'):
    upd(); M = B(s + 'Arm').matrix
    d = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    rot_world(B(s + 'Arm'), Quaternion(d.cross(Vector((0, 0, 1))).normalized(), math.radians(25)))
# slight forward lean of the trunk
rot_world(B('Spine'), Quaternion((1, 0, 0), math.radians(5)))
upd()

# place hips: pelvis over origin, butt on bench
def eval_co(o):
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); me = oe.to_mesh()
    cos = [oe.matrix_world @ v.co for v in me.vertices]; oe.to_mesh_clear(); return cos
hp = B('Hips')
upd()
hh = hp.matrix.translation.copy()
cos = eval_co(high)
butt = [c for c in cos if c.y > hh.y - 0.01 and abs(c.x) < 0.18 and c.z < hh.z]
bz = min(c.z for c in butt)
dz = (BENCH + 0.004) - bz
if hh.z + dz > 0.45: dz = 0.45 - hh.z
shift = Vector((-hh.x, -hh.y, dz))
M = hp.matrix.copy(); M.translation += shift; hp.matrix = M; upd()
cos = eval_co(high)
log['seated'] = {'hips': list(hp.matrix.translation), 'min_z': min(c.z for c in cos), 'max_z': max(c.z for c in cos),
                 'thigh_under_min_z': min(c.z for c in cos if hh.y - 0.2 < c.y - shift.y < hh.y and abs(c.x) < 0.2)}

# apply pose as rest
set_active(high)
with ctx(high):
    mod = [m for m in high.modifiers if m.type == 'ARMATURE'][0]
    bpy.ops.object.modifier_apply(modifier=mod.name)
set_active(arm); bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
for pb in P:
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
m = high.modifiers.new('Armature', 'ARMATURE'); m.object = arm
upd()
log['rest_hips'] = list(arm.data.bones['mixamorig:Hips'].head_local)

# ---------------- LOD0: voxel remesh + decimate ----------------
def dup(o, name):
    d = o.copy(); d.data = o.data.copy(); d.name = name; d.data.name = name + '_mesh'
    bpy.context.scene.collection.objects.link(d); return d

lod0 = dup(high, NAME)
for mm in list(lod0.modifiers): lod0.modifiers.remove(mm)
lod0.vertex_groups.clear()
while lod0.data.uv_layers: lod0.data.uv_layers.remove(lod0.data.uv_layers[0])
lod0.data.materials.clear()
r = lod0.modifiers.new('rm', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = VOXEL; r.use_smooth_shade = True
set_active(lod0)
with ctx(lod0): bpy.ops.object.modifier_apply(modifier='rm')
log['remesh_tris'] = tris(lod0)

# protect group: head front (face) and hands
hb = arm.data.bones
pg = lod0.vertex_groups.new(name='protect')
head_z = hb['mixamorig:Head'].head_local.z
hands = [hb['mixamorig:LeftHand'].head_local, hb['mixamorig:RightHand'].head_local]
for v in lod0.data.vertices:
    w = 0.0
    if v.co.z > head_z and v.co.y < hb['mixamorig:Head'].head_local.y - 0.02: w = 1.0   # face side
    elif v.co.z > head_z: w = 0.4
    for hc in hands:
        if (v.co - hc).length < 0.07: w = max(w, 0.8)
    if w > 0: pg.add([v.index], w, 'REPLACE')

def decimate_to(o, target, protect=True):
    lo, hi = 0.0005, 1.0
    base = o.data.copy()
    for it in range(18):
        ratio = (lo + hi) / 2
        o.data = base.copy()
        d = o.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = ratio
        d.use_symmetry = True; d.symmetry_axis = 'X'; d.use_collapse_triangulate = True
        if protect and 'protect' in o.vertex_groups:
            d.vertex_group = 'protect'; d.vertex_group_factor = 4.0
        with ctx(o): bpy.ops.object.modifier_apply(modifier='dec')
        t = tris(o)
        print('DEC', o.name, round(ratio,5), t)
        if t > target: hi = ratio
        else:
            lo = ratio
            if t > target - 25: break
    if tris(o) > target:
        o.data = base.copy()
        d = o.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = lo
        d.use_symmetry = True; d.symmetry_axis = 'X'; d.use_collapse_triangulate = True
        with ctx(o): bpy.ops.object.modifier_apply(modifier='dec')
    return tris(o)

set_active(lod0)
log['lod0_tris'] = decimate_to(lod0, LOD0_T, protect=False)
lod0.vertex_groups.clear()
for p in lod0.data.polygons: p.use_smooth = True

# clean: tiny islands, recalc normals
bm = bmesh.new(); bm.from_mesh(lod0.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(lod0.data); bm.free()

# UV: smart project + pack
set_active(lod0); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.pack_islands(rotate=True, margin=0.008)
bpy.ops.object.mode_set(mode='OBJECT')

# LOD1 from LOD0 (keeps LOD0's UV atlas, shares the material)
lod1 = dup(lod0, NAME + '_LOD1')
set_active(lod1)
log['lod1_tris'] = decimate_to(lod1, LOD1_T, protect=False)

# ---------------- bake 1024 base colour + normal from the seated Tripo mesh ----------------
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
sc.render.bake.use_selected_to_active = True
sc.render.bake.cage_extrusion = 0.025; sc.render.bake.max_ray_distance = 0.07; sc.render.bake.margin = 8

mat = bpy.data.materials.new(NAME); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes.get('Principled BSDF')
img_c = bpy.data.images.new(NAME + '_basecolor', 1024, 1024, alpha=False)
img_n = bpy.data.images.new(NAME + '_normal', 1024, 1024, alpha=False); img_n.colorspace_settings.name = 'Non-Color'
tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = img_c
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img_n
lod0.data.materials.append(mat)
lod1.data.materials.clear(); lod1.data.materials.append(mat)

# high material: drop roughness/metal maps so they can't leak; keep colour + normal
for o in bpy.data.objects: o.select_set(False)
high.hide_render = False
high.select_set(True); lod0.select_set(True); bpy.context.view_layer.objects.active = lod0
for n in nt.nodes: n.select = False
tc.select = True; nt.nodes.active = tc
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=True,
                    cage_extrusion=0.025, max_ray_distance=0.07, margin=8)
tn.select = True; tc.select = False; nt.nodes.active = tn
bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                    cage_extrusion=0.025, max_ray_distance=0.07, margin=8)

sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 85
pc = os.path.join(OUT, NAME + '_basecolor.jpg'); pn = os.path.join(OUT, NAME + '_normal.jpg')
img_c.save_render(pc, scene=sc); img_n.save_render(pn, scene=sc)
# rewire material to the saved JPEGs
bpy.data.images.remove(img_c); bpy.data.images.remove(img_n)
ic = bpy.data.images.load(pc); inn = bpy.data.images.load(pn); inn.colorspace_settings.name = 'Non-Color'
tc.image = ic; tn.image = inn
nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.45 if TAG == 'Robot' else 0.75
bsdf.inputs['Metallic'].default_value = 0.0
nt.nodes.active = tc

# ---------------- weights: transfer from the seated Tripo mesh ----------------
def transfer(dst):
    dst.vertex_groups.clear()
    for vg in high.vertex_groups: dst.vertex_groups.new(name=vg.name)
    dt = dst.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = high
    dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    set_active(dst)
    with ctx(dst): bpy.ops.object.modifier_apply(modifier='dt')
    me = dst.data
    W = [{g.group: g.weight for g in v.groups if g.weight > 0} for v in me.vertices]
    nb = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices; nb[a].append(b); nb[b].append(a)
    for it in range(1):   # one light smoothing pass against spikes
        NW = []
        for i, w in enumerate(W):
            acc = {}
            for j in nb[i]:
                for g, x in W[j].items(): acc[g] = acc.get(g, 0) + x / max(1, len(nb[i]))
            keys = set(w) | set(acc)
            NW.append({g: 0.65 * w.get(g, 0) + 0.35 * acc.get(g, 0) for g in keys})
        W = NW
    for i, w in enumerate(W):
        items = sorted(((x, g) for g, x in w.items() if x >= 0.01), reverse=True)[:4]
        s = sum(x for x, g in items)
        for vg in dst.vertex_groups: vg.remove([i])
        for x, g in items: dst.vertex_groups[g].add([i], x / s, 'REPLACE')
    # drop empty groups
    used = set(g.group for v in dst.data.vertices for g in v.groups if g.weight > 0)
    drop = [vg.name for vg in dst.vertex_groups if vg.index not in used]
    for n in drop: dst.vertex_groups.remove(dst.vertex_groups[n])
    unw = sum(1 for v in dst.data.vertices if not v.groups)
    mm = dst.modifiers.new('Armature', 'ARMATURE'); mm.object = arm
    dst.parent = arm; dst.matrix_parent_inverse = Matrix.Identity(4)
    return unw
log['lod0_unweighted'] = transfer(lod0)
log['lod1_unweighted'] = transfer(lod1)

# ---------------- remove the high mesh + Tripo images, save ----------------
oldmats = [s.material for s in high.material_slots]
bpy.data.objects.remove(high, do_unlink=True)
for mm in oldmats:
    if mm: bpy.data.materials.remove(mm)
for im in list(bpy.data.images):
    if im not in (ic, inn): bpy.data.images.remove(im)
bpy.ops.outliner.orphans_purge(do_recursive=True)
arm.name = NAME + '_Rig'; arm.data.name = NAME + '_Rig'
log['lod0_tris'] = tris(lod0); log['lod1_tris'] = tris(lod1)
log['bounds'] = [[min(v.co[i] for v in lod0.data.vertices) for i in range(3)], [max(v.co[i] for v in lod0.data.vertices) for i in range(3)]]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, NAME.lower() + '_s1.blend'), compress=True)
print('LOG' + json.dumps(log))
