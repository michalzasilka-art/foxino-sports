# Stage 1: raw Tripo crew GLB -> cleaned, scaled, symmetric skeleton, LOD0/LOD1 with baked textures and weights.
# usage: blender -b --factory-startup -P prep.py -- <raw.glb> <name> <scale> <src_side Left|Right> <outdir>
import bpy, bmesh, sys, os, math, json
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

argv = sys.argv[sys.argv.index('--') + 1:]
RAW, NAME, S, SRC, OUT = argv[0], argv[1], float(argv[2]), argv[3], argv[4]
DST = 'Right' if SRC == 'Left' else 'Left'
LOD0_MAX, LOD1_MAX = 1200, 400
log = {}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RAW)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
hi = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('tripo')][0]
for o in list(bpy.data.objects):
    if o not in (arm, hi):
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# bake world transforms into data, scale
mw = hi.matrix_world.copy()
hi.parent = None
hi.data.transform(Matrix.Scale(S, 4) @ mw)
hi.matrix_world = Matrix()
arm.data.transform(Matrix.Scale(S, 4) @ arm.matrix_world)
arm.matrix_world = Matrix()
for m in hi.modifiers:
    hi.modifiers.remove(m)
arm.name = NAME + '_Rig'; arm.data.name = NAME + '_Rig'
hi.name = NAME + '_hi'

# weld hi
bm = bmesh.new(); bm.from_mesh(hi.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(hi.data); bm.free()
hi.data.update()

# ---------- symmetric skeleton ----------
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
def swap(n):
    return n.replace(SRC, DST)
CENTER = ['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head']
for n in CENTER:
    b = eb[n]; b.head.x = 0; b.tail.x = 0; b.roll = 0
# complete missing third finger joints on the source side
for fing in ('Index', 'Middle', 'Ring', 'Pinky', 'Thumb'):
    for side in (SRC,):
        n2 = 'mixamorig:%sHand%s2' % (side, fing); n3 = 'mixamorig:%sHand%s3' % (side, fing)
        if n2 in eb and n3 not in eb:
            b2 = eb[n2]; b3 = eb.new(n3); b3.head = b2.tail.copy()
            b3.tail = b2.tail + (b2.tail - b2.head) * 0.8; b3.roll = b2.roll; b3.parent = b2; b3.use_connect = True
            log.setdefault('added', []).append(n3)
src_names = [b.name for b in eb if SRC in b.name]
for n in src_names:
    d = swap(n)
    if d not in eb:
        nb = eb.new(d); log.setdefault('added', []).append(d)
for n in src_names:
    s = eb[n]; d = eb[swap(n)]
    d.head = Vector((-s.head.x, s.head.y, s.head.z)); d.tail = Vector((-s.tail.x, s.tail.y, s.tail.z))
    d.roll = -s.roll
for n in src_names:
    s = eb[n]; d = eb[swap(n)]
    if s.parent:
        pn = swap(s.parent.name) if SRC in s.parent.name else s.parent.name
        d.parent = eb[pn]; d.use_connect = s.use_connect
for b in list(eb):
    if DST in b.name and b.name.replace(DST, SRC) not in eb:
        log.setdefault('removed', []).append(b.name); eb.remove(b)
bpy.ops.object.mode_set(mode='OBJECT')
BONES = [b.name for b in arm.data.bones]

# ---------- weights source (hi) ----------
hi.data.calc_loop_triangles()
hv = [v.co.copy() for v in hi.data.vertices]
tris = [tuple(t.vertices) for t in hi.data.loop_triangles]
bvh = BVHTree.FromPolygons(hv, tris)
gname = {g.index: g.name for g in hi.vertex_groups}
hw = []
for v in hi.data.vertices:
    hw.append({gname[g.group]: g.weight for g in v.groups if g.weight > 0})

def weights_at(p, mirror):
    q = Vector((-p.x, p.y, p.z)) if mirror else p
    loc, nrm, fi, dist = bvh.find_nearest(q)
    t = tris[fi]
    bw = poly_3d_calc([hv[i] for i in t], loc)
    acc = {}
    for i, w in zip(t, bw):
        for g, gw in hw[i].items():
            if mirror:
                g = g.replace(SRC, '#').replace(DST, SRC).replace('#', DST)
            acc[g] = acc.get(g, 0) + gw * w
    return acc

HEAD_TOP = arm.data.bones['mixamorig:Head'].tail_local.z

def skin(ob):
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    vg = {n: ob.vertex_groups.new(name=n) for n in BONES}
    eps = 0.004
    for v in ob.data.vertices:
        p = v.co
        # source side is +X for Left, -X for Right
        on_dst = (p.x < -eps) if SRC == 'Left' else (p.x > eps)
        acc = weights_at(p, on_dst)
        if p.z > HEAD_TOP - 0.02 * S:   # ears / head top: rigid with head
            acc = {'mixamorig:Head': 1.0}
        acc = {g: w for g, w in acc.items() if g in vg}
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(w for _, w in top)
        top = [(g, w / tot) for g, w in top if w / tot >= 0.02]
        tot = sum(w for _, w in top)
        for g, w in top:
            vg[g].add([v.index], w / tot, 'REPLACE')

# ---------- LODs ----------
def tri_count(ob):
    ob.data.calc_loop_triangles(); return len(ob.data.loop_triangles)

def make_lod(label, target):
    best = None
    for sym in (True, False):
        best = _make_lod(label, target, sym, hi)
        if best: break
    if not best:
        rm = hi.copy(); rm.data = hi.data.copy(); bpy.context.collection.objects.link(rm)
        md = rm.modifiers.new('rm', 'REMESH'); md.mode = 'VOXEL'; md.voxel_size = 0.006 * S
        with bpy.context.temp_override(object=rm, active_object=rm):
            bpy.ops.object.modifier_apply(modifier='rm')
        best = _make_lod(label, target, True, rm) or _make_lod(label, target, False, rm)
        log.setdefault('remesh', []).append(label)
        bpy.data.objects.remove(rm, do_unlink=True)
    return _finish_lod(label, best)

def _make_lod(label, target, sym, src):
    best = None
    lo, hi_r = 0.002, 0.5
    for it in range(16):
        r = (lo + hi_r) / 2
        ob = src.copy(); ob.data = src.data.copy(); bpy.context.collection.objects.link(ob)
        for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
        md = ob.modifiers.new('dec', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = r
        md.use_symmetry = sym; md.symmetry_axis = 'X'; md.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = ob
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.modifier_apply(modifier='dec')
        n = tri_count(ob); print("DEC>>", label, r, n)
        if n <= target:
            if best: bpy.data.objects.remove(best[0], do_unlink=True)
            best = (ob, n, r); lo = r
        else:
            bpy.data.objects.remove(ob, do_unlink=True); hi_r = r
        if best and target - best[1] < target * 0.015:
            break
    if best: log.setdefault('sym', {})[label] = sym
    return best

def _finish_lod(label, best):
    ob, n, r = best
    ob.name = label; ob.data.name = label
    # clean: weld, recalc normals, remove degenerate
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    # drop tiny loose islands left by the decimation (single stray triangles)
    seen = set(); small = []
    for f in bm.faces:
        if f in seen: continue
        isl = []; st = [f]; seen.add(f)
        while st:
            g = st.pop(); isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen: seen.add(h); st.append(h)
        if len(isl) < 12: small += isl
    if small:
        log.setdefault('dropped_islands', {})[label] = len(small)
        bmesh.ops.delete(bm, geom=small, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    for f in ob.data.polygons: f.use_smooth = True
    # drop old uv / attrs, new smart uv
    while ob.data.uv_layers: ob.data.uv_layers.remove(ob.data.uv_layers[0])
    for a in [a.name for a in ob.data.attributes if a.name in ('custom_normal', 'sharp_edge', 'sharp_face')]:
        ob.data.attributes.remove(ob.data.attributes[a])
    ob.data.uv_layers.new(name='UVMap')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=0.006, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    log[label] = {'tris': tri_count(ob), 'ratio': round(r, 4), 'verts': len(ob.data.vertices)}
    return ob

lod0 = make_lod(NAME, LOD0_MAX)
lod1 = make_lod(NAME + '_LOD1', LOD1_MAX)

# ---------- bake base colour from hi ----------
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
sc.render.bake.use_selected_to_active = True
sc.render.bake.cage_extrusion = 0.015 * S; sc.render.bake.max_ray_distance = 0.06 * S
sc.render.bake.margin = 6
sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True

def bake(ob, size, fname, ext=0.015, ray=0.06):
    img = bpy.data.images.new(fname, size, size)
    mat = bpy.data.materials.new('M_' + NAME); mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.75; bsdf.inputs['Metallic'].default_value = 0.0
    ob.data.materials.clear(); ob.data.materials.append(mat)
    nt.nodes.active = tex
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=True,
                        cage_extrusion=ext * S, max_ray_distance=ray * S, margin=6)
    img.filepath_raw = os.path.join(OUT, fname + '.jpg'); img.file_format = 'JPEG'
    sc.render.image_settings.quality = 85
    img.save(filepath=img.filepath_raw, quality=85)
    img.source = 'FILE'; img.reload()
    return mat

m0 = bake(lod0, 1024, 'T_%s_BaseColor' % NAME)
m1 = bake(lod1, 256, 'T_%s_LOD1_BaseColor' % NAME, 0.05, 0.16)
m1.name = 'M_%s_LOD1' % NAME

# ---------- weights ----------
skin(lod0); skin(lod1)
for ob in (lod0, lod1):
    ob.parent = arm
    md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm

bpy.data.objects.remove(hi, do_unlink=True) if '--drop-hi' in argv else None
bpy.ops.outliner.orphans_purge(do_recursive=True) if False else None
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, NAME + '_prep.blend'), compress=True)
log['bones'] = BONES
print('PREP>>' + json.dumps(log))
