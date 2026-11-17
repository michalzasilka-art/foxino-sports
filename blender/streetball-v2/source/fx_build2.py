# foxino-baller, step 3: the tail bones (Tail1, Tail2 under Hips) and weights, the "10" decals front and back, the
# wristbands. Added geometry is joined into the Foxino mesh (one skinned mesh, one material: its UVs point at flat
# colour texels of the atlas).
import bpy, bmesh, math, json
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

def add_tail(arm, mo, tv):
    vs = mo.data.vertices; tv = sorted(tv)
    hips = arm.data.bones['mixamorig:Hips'].head_local
    root_i = min(tv, key=lambda i: (vs[i].co - (hips + Vector((0, 0.12, -0.05)))).length)
    root = vs[root_i].co.copy()
    near = [vs[i].co for i in tv if (vs[i].co - root).length < 0.05]
    root = sum(near, Vector()) / len(near)
    d = {i: (vs[i].co - root).length for i in tv}; dmax = max(d.values())
    def cen(t0, t1):
        pts = [vs[i].co for i in tv if t0 <= d[i] / dmax <= t1]; return sum(pts, Vector()) / len(pts)
    mid = cen(0.42, 0.58); tip = cen(0.85, 1.0)
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects: o.select_set(False)
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for nm in ('Tail1', 'Tail2'):
        if nm in eb: eb.remove(eb[nm])
    t1 = eb.new('Tail1'); t1.head = root; t1.tail = mid; t1.parent = eb['mixamorig:Hips']; t1.use_connect = False
    t2 = eb.new('Tail2'); t2.head = mid; t2.tail = tip; t2.parent = t1; t2.use_connect = True
    t1.roll = 0; t2.roll = 0
    bpy.ops.object.mode_set(mode='OBJECT')
    G = {nm: (mo.vertex_groups.get(nm) or mo.vertex_groups.new(name=nm)) for nm in ('Tail1', 'Tail2', 'mixamorig:Hips')}
    others = [g for g in mo.vertex_groups if g.name not in G]
    for g in others: g.remove(tv)
    for i in tv:
        t = d[i] / dmax
        wh = max(0.0, 1 - t / 0.12)
        w2 = min(1.0, max(0.0, (t - 0.38) / 0.25))
        w1 = (1 - w2) * (1 - wh); w2 = w2 * (1 - wh)
        for nm, w in (('mixamorig:Hips', wh), ('Tail1', w1), ('Tail2', w2)):
            if w > 1e-4: G[nm].add([i], w, 'REPLACE')
            else: G[nm].remove([i])
    return (tuple(root), tuple(mid), tuple(tip))

def _skin_from(mo, obj):
    """Give obj the vertex groups of the nearest Foxino vertices."""
    kd = KDTree(len(mo.data.vertices))
    for v in mo.data.vertices: kd.insert(v.co, v.index)
    kd.balance()
    names = {g.index: g.name for g in mo.vertex_groups}
    for nm in names.values():
        if nm not in obj.vertex_groups: obj.vertex_groups.new(name=nm)
    for v in obj.data.vertices:
        co, idx, dist = kd.find(v.co)
        for e in mo.data.vertices[idx].groups:
            obj.vertex_groups[names[e.group]].add([v.index], e.weight, 'REPLACE')

def _mesh_obj(name, bm, uv_xy, coll):
    me = bpy.data.meshes.new(name); bm.to_mesh(me)
    lay = me.uv_layers.new(name='UVMap')
    for l in lay.data: l.uv = uv_xy
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob

def number_decals(mo, text_polys, sw, coll):
    """A purple 10 with a white outline on the chest and on the back, projected onto the shirt."""
    bvh = BVHTree.FromObject(mo, bpy.context.evaluated_depsgraph_get())
    obs = []
    for side, zc, hgt in ((-1, 0.66, 0.095), (1, 0.665, 0.12)):
        for layer, off, lift, col in (('o', 0.014, 0.005, 'white'), ('f', 0.004, 0.008, 'purple')):
            polys = text_polys('10', size=hgt / 0.72, offset=off, res=3, spacing=0.92)
            bm = bmesh.new()
            for pts in polys:
                vv = [bm.verts.new((x * (-side), 0.0, y + zc - hgt / 2)) for x, y in pts]
                try: bm.faces.new(vv)
                except ValueError: pass
            bmesh.ops.triangulate(bm, faces=bm.faces[:])
            bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if e.calc_length() > 0.025], cuts=1, use_grid_fill=True)
            bmesh.ops.triangulate(bm, faces=bm.faces[:])
            hits = {}
            for v in bm.verts:
                o = Vector((v.co.x, side * 1.0, v.co.z)); dvec = Vector((0, -side, 0))
                hits[v] = bvh.ray_cast(o, dvec)
            ys = sorted(h[0].y for h in hits.values() if h[0] is not None); ym = ys[len(ys) // 2]
            for v, h in hits.items():
                y = h[0].y if (h[0] is not None and abs(h[0].y - ym) < 0.015) else ym
                v.co = Vector((v.co.x, y + side * lift, v.co.z))
            for f in bm.faces:
                n = f.normal
                if n.y * side < 0: f.normal_flip()
            ob = _mesh_obj(f'Num{side}{layer}', bm, sw[col], coll); bm.free()
            obs.append(ob)
    return obs

def wristbands(mo, arm, sw, coll):
    obs = []
    for nm in ('Left', 'Right'):
        b = arm.data.bones[f'mixamorig:{nm}ForeArm']
        h, t = b.head_local, b.tail_local; ax = (t - h).normalized()
        c = h + (t - h) * 0.62
        rad = [((v.co - c) - ax * (v.co - c).dot(ax)).length for v in mo.data.vertices if abs((v.co - c).dot(ax)) < 0.015 and (v.co - c).length < 0.05]
        r = (max(rad) if rad else 0.03) + 0.003
        bm = bmesh.new()
        a = ax.orthogonal().normalized(); bb = ax.cross(a)
        rings = []
        for k, (off, rr) in enumerate(((-0.016, r), (-0.016, r + 0.004), (0.016, r + 0.004), (0.016, r))):
            rings.append([bm.verts.new(c + ax * off + (a * math.cos(2 * math.pi * j / 10) + bb * math.sin(2 * math.pi * j / 10)) * rr) for j in range(10)])
        for i in range(3):
            for j in range(10):
                q = [rings[i][j], rings[i][(j + 1) % 10], rings[i + 1][(j + 1) % 10], rings[i + 1][j]]
                f = bm.faces.new(q)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        ob = _mesh_obj(f'Band{nm}', bm, sw['purple'], coll); bm.free()
        obs.append(ob)
    return obs

def join_into(mo, arm, obs):
    for ob in obs: _skin_from(mo, ob)
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for ob in obs:
        ob.data.materials.append(mo.data.materials[0]); ob.select_set(True)
    mo.select_set(True); bpy.context.view_layer.objects.active = mo
    bpy.ops.object.join()
    return sum(len(p.vertices) - 2 for p in mo.data.polygons)
