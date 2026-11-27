# Stand-in exit plug for the igloo W3 fracture pipeline (lane B).
# A 0.55 m thick patch of a 9 m inner-radius dome on Blender -Y (glTF +Z),
# |x| <= ~3.0, z 0..4.8, arch outline along snow-block joints, soft grooves.
import bpy, bmesh, math
from mathutils import Vector


def build_standin(name="SM_Igloo_ExitPlug_STANDIN", coll=None):
    RI, RO = 9.0, 9.55
    DX, DZ = 0.225, 0.2
    NX, NZ = 28, 24            # x -3.15..3.15, z 0..4.8
    X0 = -3.15
    CH = 0.6                   # course height
    BL = 0.9                   # block length
    GD = 0.035                 # groove depth

    def course_off(k):
        return 0.0 if k % 2 == 0 else 0.45

    def joints(k):
        o = course_off(k)
        return [o + n * BL for n in range(-6, 7)]

    def half_w(k):
        zc = (k + 0.5) * CH
        t = 3.0 * math.sqrt(max(0.0, 1 - (zc / 5.1) ** 2)) + 0.2
        js = [j for j in joints(k) if 0 < j <= t + 1e-6]
        return max(js) if js else 0.45

    W = [half_w(k) for k in range(8)]

    def cell_in(i, j):
        if i < 0 or j < 0 or i >= NX or j >= NZ:
            return False
        k = j // 3
        xc = X0 + (i + 0.5) * DX
        return abs(xc) < W[k]

    def on_joint(i, j):
        x = X0 + i * DX
        z = j * DZ
        if j % 3 == 0 and j > 0:
            return True
        # vertical joint of the course(s) this vertex touches
        ks = {min(7, j // 3)}
        if j % 3 == 0 and j > 0:
            ks.add(j // 3 - 1)
        for k in ks:
            if any(abs(x - jj) < 1e-6 for jj in joints(k)):
                return True
        return False

    def pos(i, j, r):
        x = X0 + i * DX
        z = j * DZ
        y = -math.sqrt(r * r - x * x - z * z)
        return Vector((x, y, z))

    bm = bmesh.new()
    vo, vi = {}, {}
    used = set()
    for i in range(NX):
        for j in range(NZ):
            if cell_in(i, j):
                for a in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                    used.add(a)
    for (i, j) in used:
        g = GD if on_joint(i, j) else 0.0
        vo[(i, j)] = bm.verts.new(pos(i, j, RO - g))
        vi[(i, j)] = bm.verts.new(pos(i, j, RI + g))
    for i in range(NX):
        for j in range(NZ):
            if not cell_in(i, j):
                continue
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            bm.faces.new([vo[a] for a in q])
            bm.faces.new([vi[a] for a in reversed(q)])
            # side walls on boundary edges
            nb = [((i, j - 1), (q[0], q[1])), ((i + 1, j), (q[1], q[2])),
                  ((i, j + 1), (q[2], q[3])), ((i - 1, j), (q[3], q[0]))]
            for (ni, nj), (a, b) in nb:
                if not cell_in(ni, nj):
                    bm.faces.new([vo[b], vo[a], vi[a], vi[b]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(n.z) > 0.7:
                uv.data[li].uv = (co.x * 0.5, co.y * 0.5)
            else:
                uv.data[li].uv = (co.x * 0.5 + co.y * 0.13, co.z * 0.5)
    for p in me.polygons:
        p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(35))
    mat = bpy.data.materials.get("M_Igloo_Snow_STANDIN") or bpy.data.materials.new("M_Igloo_Snow_STANDIN")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.86, 0.9, 0.95, 1)
        bsdf.inputs["Roughness"].default_value = 0.85
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob
