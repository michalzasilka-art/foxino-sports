"""Summer lake props, lane B (headless).
blender -b --factory-startup -P lake_props.py -- <out_dir> [<blend_out>]
Builds SM_Buoy, SM_Buoy_Big, SM_Tent, SM_TeamFlag (+ child SignFace) and exports one plain GLB each.
Blender axes: Z up, race runs along Blender -Y (= glTF +Z). glTF -Z (where racers come from) = Blender +Y.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.dirname(__file__)
BLEND = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
TAU = 2 * math.pi


# ---------------------------------------------------------------- helpers
def material(name, col, rough, metal=0.0, double=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.use_backface_culling = not double
    m.diffuse_color = (*col, 1)
    return m


class MB:
    """Tiny mesh builder: verts, faces with material index."""
    def __init__(self):
        self.v, self.f, self.mi = [], [], []

    def add_v(self, p):
        self.v.append(Vector(p))
        return len(self.v) - 1

    def face(self, idx, m=0):
        self.f.append(list(idx))
        self.mi.append(m)

    def ring(self, pts):
        return [self.add_v(p) for p in pts]

    def bridge(self, a, b, m=0, closed=True):
        n = len(a)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            self.face((a[i], a[j], b[j], b[i]), m)

    def fan(self, ring, c, m=0, flip=False):
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            self.face((ring[i], ring[j], c) if not flip else (ring[j], ring[i], c), m)

    def tube(self, path, radius, sides, m=0, rot=0.0, cap_end=False, cap_start=False):
        """Polyline tube. radius may be a float or a list per path point."""
        rings, prev_t, a = [], None, None
        for k, p in enumerate(path):
            p = Vector(p)
            t = (Vector(path[min(k + 1, len(path) - 1)]) - Vector(path[max(k - 1, 0)])).normalized()
            if prev_t is None:
                up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
                a = t.cross(up).normalized()
            else:  # parallel transport: no twist along bends
                a = (prev_t.rotation_difference(t) @ a).normalized()
            prev_t = t
            b = t.cross(a).normalized()
            r = radius[k] if isinstance(radius, (list, tuple)) else radius
            rings.append(self.ring([p + r * (math.cos(rot + TAU * i / sides) * a + math.sin(rot + TAU * i / sides) * b)
                                    for i in range(sides)]))
        for k in range(len(rings) - 1):
            self.bridge(rings[k], rings[k + 1], m)
        if cap_end:
            self.face(rings[-1], m)
        if cap_start:
            self.face(list(reversed(rings[0])), m)
        return rings

    def revolve(self, prof, n, m_of=lambda k: 0, rot=0.0):
        """prof: list of (r, h) from one pole to the other around Z (r=0 -> pole)."""
        rings = []
        for r, h in prof:
            if r < 1e-9:
                rings.append(self.add_v((0, 0, h)))
            else:
                rings.append(self.ring([(r * math.cos(rot + TAU * i / n), r * math.sin(rot + TAU * i / n), h)
                                        for i in range(n)]))
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            if isinstance(a, int):
                self.fan(b, a, m_of(k), flip=True)
            elif isinstance(b, int):
                self.fan(a, b, m_of(k))
            else:
                self.bridge(a, b, m_of(k))
        return rings

    def build(self, name, mats, smooth_angle=35, parent=None, recalc=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(p) for p in self.v], [], self.f)
        me.update()
        for m in mats:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.mi)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        if recalc:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        lim = math.radians(smooth_angle)
        for f in bm.faces:
            f.smooth = True
        for e in bm.edges:
            e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > lim)
        bm.to_mesh(me)
        bm.free()
        if parent:
            ob.parent = parent
        return ob


def set_normals(ob, fn):
    """Custom split normals: fn(co, material_index) -> Vector or None (keep the smooth/sharp result)."""
    me = ob.data
    cur = [Vector(cn.vector) for cn in me.corner_normals]
    out = list(cur)
    for poly in me.polygons:
        for li in poly.loop_indices:
            n = fn(me.vertices[me.loops[li].vertex_index].co, poly.material_index)
            if n is not None:
                out[li] = n.normalized()
    me.normals_split_custom_set([tuple(n) for n in out])


def unwrap(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(o is ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


# ---------------------------------------------------------------- materials
M_TINT_BUOY = material("Tint", (0.90, 0.90, 0.88), 0.35)
M_ORANGE = material("Buoy_Orange", (0.96, 0.40, 0.05), 0.35)
M_CAP = material("Buoy_Cap", (0.90, 0.89, 0.86), 0.40)
M_TINT_CLOTH = material("Tint", (0.92, 0.92, 0.90), 0.75, double=True)
M_FRAME = material("Frame", (0.70, 0.72, 0.75), 0.40)
M_POLE = material("Frame", (0.20, 0.22, 0.26), 0.40)
M_SIGN = material("SignFace", (0.94, 0.94, 0.92), 0.70)
for m, nm in ((M_TINT_BUOY, "Tint"), (M_TINT_CLOTH, "Tint"), (M_FRAME, "Frame"), (M_POLE, "Frame")):
    pass  # names get .001 suffixes in Blender; fixed at export time per model

models = {}

# ---------------------------------------------------------------- 1. SM_Buoy (lane-rope float)
# Rounded float 0.55 m across, 0.26 m long along the rope; dimpled poles = rope recess on the rope axis.
mb = MB()
prof = [(0.0, -0.085), (0.150, -0.130), (0.275, 0.0), (0.150, 0.130), (0.0, 0.085)]
mb.revolve(prof, 12)
# rope axis Z -> Blender Y (glTF Z)
mb.v = [Vector((p.x, -p.z, p.y)) for p in mb.v]
ob = mb.build("SM_Buoy", [M_TINT_BUOY], smooth_angle=80)
# analytic spheroid normals (A radial, B along the rope) so 72 tris shade like a smooth float
A_, B_ = 0.275, 0.16
set_normals(ob, lambda co, mi: Vector((co.x / A_ ** 2, co.y / B_ ** 2, co.z / A_ ** 2)))
models["SM_Buoy"] = [ob]

# ---------------------------------------------------------------- 2. SM_Buoy_Big (50 m marker)
mb = MB()
c, R = 0.15, 0.515
prof = [(0.0, c - R)]
for z in (-0.12, 0.10, 0.30, 0.47, 0.59):  # rings spent above the water line
    prof.append((math.sqrt(R * R - (z - c) ** 2), z))
rc = 0.10
prof += [(rc, c + math.sqrt(R * R - rc * rc)), (rc, 0.77), (0.0, 0.79)]
mb.revolve(prof, 14, m_of=lambda k: 1 if k >= 6 else 0)
ob = mb.build("SM_Buoy_Big", [M_ORANGE, M_CAP], smooth_angle=40)
set_normals(ob, lambda co, mi: (co - Vector((0, 0, c))) if mi == 0 else None)
models["SM_Buoy_Big"] = [ob]

# ---------------------------------------------------------------- 3. SM_Tent (pop-up event tent)
mb = MB()
H_EAVE, H_PEAK, S = 2.25, 3.0, 1.5


def canopy_z(s):
    return H_EAVE + (H_PEAK - H_EAVE) * (1 - s / S) ** 1.25


def sq_ring(s, z, n=4, sag=0.0):
    pts = []
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for k in range(4):
        (x0, y0), (x1, y1) = corners[k], corners[(k + 1) % 4]
        for j in range(n):
            t = j / n
            dz = -sag * math.sin(math.pi * t)
            pts.append((s * (x0 + (x1 - x0) * t), s * (y0 + (y1 - y0) * t), z + dz))
    return pts


rs = [1.5, 1.15, 0.8, 0.45, 0.15]
rings = [mb.ring(sq_ring(s, canopy_z(s), sag=0.0 if s == S else 0.045 * s / S)) for s in rs]
for k in range(len(rings) - 1):
    mb.bridge(rings[k], rings[k + 1], 0)  # winding -> normals up/out
peak = mb.add_v((0, 0, H_PEAK))
mb.fan(rings[-1], peak, 0)
# valance (skirt) hanging from the eave ring
skirt = mb.ring([(x, y, H_EAVE - 0.27) for x, y, _ in sq_ring(S, H_EAVE)])
mb.bridge(skirt, rings[0], 0)
from mathutils.bvhtree import BVHTree
canopy_bvh = BVHTree.FromPolygons([tuple(p) for p in mb.v], [list(f) for f in mb.f])
# legs (octagonal 25 mm), open ends (hidden in the foot plate and under the canopy)
LX = 1.45
legs = [(sx * LX, sy * LX) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
for x, y in legs:
    lr = mb.tube([(x, y, 0.0), (x, y, H_EAVE)], 0.025, 8, 1, rot=math.pi / 8)
    for vi in lr[-1]:  # leg top meets the canopy underside (1.5 mm below)
        hit = canopy_bvh.ray_cast(Vector((mb.v[vi].x, mb.v[vi].y, 4.0)), Vector((0, 0, -1)))[0]
        mb.v[vi].z = hit.z - 0.0015
    # foot plate 14 x 14 x 1.2 cm, no bottom face (sits on the ground)
    h, t = 0.07, 0.012
    b = mb.ring([(x - h, y - h, 0), (x + h, y - h, 0), (x + h, y + h, 0), (x - h, y + h, 0)])
    tp = mb.ring([(x - h, y - h, t), (x + h, y - h, t), (x + h, y + h, t), (x - h, y + h, t)])
    mb.bridge(b, tp, 1)
    mb.face(tp, 1)
# eave bars (square 40 mm) between the leg tops
ZB = 2.21
for k in range(4):
    (x0, y0), (x1, y1) = legs[k], legs[(k + 1) % 4]
    mb.tube([(x0, y0, ZB), (x1, y1, ZB)], 0.02 * math.sqrt(2), 4, 1, rot=math.pi / 4)
# scissor truss: two zig-zag bars per side, offset +-7 mm across the side plane
ZT, ZL = 2.16, 1.72
for k in range(4):
    (x0, y0), (x1, y1) = legs[k], legs[(k + 1) % 4]
    d = Vector((x1 - x0, y1 - y0, 0)).normalized()
    nrm = Vector((d.y, -d.x, 0))
    for sgn, zs in ((1, (ZT, ZL, ZT)), (-1, (ZL, ZT, ZL))):
        o = nrm * 0.007 * sgn
        pts = [(x0 + o.x, y0 + o.y, zs[0]), ((x0 + x1) / 2 + o.x, (y0 + y1) / 2 + o.y, zs[1]), (x1 + o.x, y1 + o.y, zs[2])]
        mb.tube(pts, 0.01 * math.sqrt(2), 4, 1, rot=math.pi / 4)
# corner ribs under the canopy: leg top -> centre hub
for x, y in legs:
    sx, sy = math.copysign(1, x), math.copysign(1, y)
    pts = []
    for s in (LX, 1.0, 0.55):
        pts.append((sx * s, sy * s, canopy_z(s) - 0.035))
    pts.append((0, 0, H_PEAK - 0.07))
    pts[0] = (x, y, H_EAVE - 0.02)
    mb.tube(pts, 0.015 * math.sqrt(2), 4, 1, rot=math.pi / 4)
ob = mb.build("SM_Tent", [M_TINT_CLOTH, M_FRAME], smooth_angle=50)
models["SM_Tent"] = [ob]

# ---------------------------------------------------------------- 4. SM_TeamFlag (teardrop beach flag)
# 2D design in (x, z), cloth flying toward +x; mirrored to -x afterwards so, seen from glTF -Z
# (Blender +Y), the pole is on the left and the cloth on the right. Gentle sail curve y = C*x^2.
C = 0.07


def bend(x, z, dy=0.0):
    return Vector((-x, C * x * x + dy, z))


pole2d = [(0, 0), (0, 2.3), (0.02, 2.65), (0.09, 2.98), (0.22, 3.24), (0.42, 3.42), (0.66, 3.49),
          (0.88, 3.43), (1.02, 3.27), (1.08, 3.08)]
trail2d = [(0.0, 0.75), (0.18, 0.95), (0.42, 1.30), (0.66, 1.75), (0.86, 2.25), (1.00, 2.65), (1.07, 2.90),
           (1.08, 3.08)]


def resample(pts, n):
    pts = [Vector(p) for p in pts]
    L = [0.0]
    for a, b in zip(pts, pts[1:]):
        L.append(L[-1] + (b - a).length)
    out = []
    for i in range(n + 1):
        t = L[-1] * i / n
        k = max(j for j in range(len(L)) if L[j] <= t + 1e-9)
        k = min(k, len(pts) - 2)
        u = (t - L[k]) / max(L[k + 1] - L[k], 1e-9)
        out.append(pts[k].lerp(pts[k + 1], u))
    return out


# leading edge: pole from z=0.75 up to its end
lead_src = [(0, 0.75)] + pole2d[1:]
N = 12
lead = resample(lead_src, N)
trail = resample(trail2d, N)
mb = MB()
rows = []
for i in range(N + 1):
    if i in (0, N):
        rows.append([mb.add_v(bend(*lead[i]))])
    else:
        L_, T_ = lead[i], trail[i]
        M_ = (L_ + T_) / 2
        rows.append([mb.add_v(bend(*L_)), mb.add_v(bend(*M_)), mb.add_v(bend(*T_))])
for i in range(N):
    a, b = rows[i], rows[i + 1]
    if len(a) == 1:
        mb.face((a[0], b[2], b[1]), 0); mb.face((a[0], b[1], b[0]), 0)
    elif len(b) == 1:
        mb.face((a[0], a[1], b[0]), 0); mb.face((a[1], a[2], b[0]), 0)
    else:
        mb.face((a[0], a[1], b[1], b[0]), 0); mb.face((a[1], a[2], b[2], b[1]), 0)
# pole: tapered hexagon tube
ppath = [bend(*p) for p in pole2d]
radii = [0.019 - 0.007 * k / (len(ppath) - 1) for k in range(len(ppath))]
pr = mb.tube(ppath, radii, 6, 1, cap_end=True)
# sleeve on the base
mb.tube([(0, 0, 0.0), (0, 0, 0.32)], 0.032, 6, 1, cap_end=False)
# cross base: X-shaped plate 0.9 m across, 35 mm thick, no bottom face
arm, w, th = 0.45, 0.035, 0.035
outline = []
for k in range(4):
    a = math.radians(45 + 90 * k)
    dx, dy = math.cos(a), math.sin(a)
    px, py = -dy, dx
    an = math.radians(45 + 90 * (k + 1))
    outline += [(arm * dx - w * px, arm * dy - w * py), (arm * dx + w * px, arm * dy + w * py)]
    # inner corner between this arm and the next
    bis = Vector((math.cos(a + math.pi / 4), math.sin(a + math.pi / 4)))
    outline.append(tuple(bis * (w * math.sqrt(2))))
bot = mb.ring([(x, y, 0) for x, y in outline])
top = mb.ring([(x, y, th) for x, y in outline])
mb.bridge(bot, top, 1)
for k in range(4):  # top as quads: 4 arms + centre
    mb.face((top[(3 * k - 1) % 12], top[3 * k], top[3 * k + 1], top[3 * k + 2]), 1)
mb.face((top[2], top[5], top[8], top[11]), 1)
flag = mb.build("SM_TeamFlag", [M_TINT_CLOTH, M_POLE], smooth_angle=65)
# SignFace: rectangle on the cloth, 8 mm in front (Blender +Y = glTF -Z), UV 0..1, readable from glTF -Z
mb = MB()
X0, X1, Z0, Z1, NX, NZ = 0.18, 0.72, 2.05, 2.95, 3, 3
grid = [[mb.add_v(bend(X0 + (X1 - X0) * i / NX, Z0 + (Z1 - Z0) * j / NZ, 0.008)) for i in range(NX + 1)]
        for j in range(NZ + 1)]
for j in range(NZ):
    for i in range(NX):
        mb.face((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]), 0)
sign = mb.build("SignFace", [M_SIGN], smooth_angle=80, parent=flag)
models["SM_TeamFlag"] = [flag, sign]

# ---------------------------------------------------------------- UVs, names, export
for name, obs in models.items():
    for ob in obs:
        if ob.name == "SignFace":
            me = ob.data
            uv = me.uv_layers.new(name="UVMap")
            for poly in me.polygons:
                for li in poly.loop_indices:
                    p = me.vertices[me.loops[li].vertex_index].co
                    # mirrored design: design x = -p.x; u grows toward Blender -X (viewer's right from +Y)
                    uv.data[li].uv = ((-p.x - X0) / (X1 - X0), (p.z - Z0) / (Z1 - Z0))
        else:
            unwrap(ob)

# cloth and sign face Blender +Y (glTF -Z, toward the racers)
def orient(ob, mat_index, axis):
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    fs = [f for f in bm.faces if f.material_index == mat_index]
    s = sum((f.normal.dot(axis) * f.calc_area() for f in fs))
    if s < 0:
        bmesh.ops.reverse_faces(bm, faces=fs)
    bm.to_mesh(me); bm.free(); me.update()
orient(flag, 0, Vector((0, 1, 0)))
orient(sign, 0, Vector((0, 1, 0)))
avg = sum((p.normal for p in sign.data.polygons), Vector()) / len(sign.data.polygons)
assert avg.y > 0.9, avg

report = {}
for name, obs in models.items():
    # material names must be exact per GLB: rename the copies in use to the canonical name
    for ob in obs:
        for slot in ob.material_slots:
            canon = slot.material.name.split(".")[0]
            for other in bpy.data.materials:
                if other is not slot.material and other.name == canon:
                    other.name = canon + "_tmp"
            slot.material.name = canon
    for o in bpy.context.scene.objects:
        o.select_set(o in obs)
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_cameras=False, export_lights=False,
                              export_materials="EXPORT", export_texcoords=True, export_normals=True,
                              export_extras=False)
    tris = {}
    for ob in obs:
        ob.data.calc_loop_triangles()
        tris[ob.name] = len(ob.data.loop_triangles)
    report[name] = tris
print("BUILD", report)
if BLEND:
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
