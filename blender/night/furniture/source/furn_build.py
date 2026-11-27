"""FoxSports snowboard course furniture (night job N11, lane C).

Builds SM_Arch_Start, SM_Arch_Finish, SM_Board, SM_Fence, SM_FlagPole, SM_StartHut, SM_Floodlight
as smooth, softly bevelled, snowy-Christmas props. One main material per model (M_Furniture: a
4x4 painted-colour atlas, base colour + ORM JPEG 512), plus the named child meshes the game finds:
SignFace (brand art, UV 0..1), FlagCloth (plain white, game tints), glow (emissive).

Run headless:
  blender -b --factory-startup -P furn_build.py -- <furniture_dir> [report.json]

Axes: built in Blender with z up and downhill along Blender -Y (glTF +Z), uphill along Blender +Y.
Signs face uphill (Blender +Y = glTF -Z). Origins at the base centre on the snow (z = 0).
SignFace UV (Blender convention, origin bottom-left) as seen by the rider coming downhill:
u = 0 at the rider's left (Blender +X), u = 1 at the rider's right (Blender -X), v = 0 bottom, 1 top.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0])
REPORT = ARGS[1] if len(ARGS) > 1 else os.path.join(OUT, "source", "build_report.json")
TEX = os.path.join(OUT, "source", "textures")
QA_DIR = r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts"
V = Vector
TAU = 2 * math.pi

# ----------------------------------------------------------------------------- palette atlas
# name, sRGB colour, roughness, metallic, texture kind  (4 x 4 cells of 128 px, row 0 at the bottom)
CELLS = [
    ("SNOW", (0.90, 0.93, 0.97), 0.80, 0.0, "snow"),
    ("RED", (0.74, 0.11, 0.11), 0.50, 0.0, "paint"),
    ("GREEN", (0.10, 0.40, 0.24), 0.50, 0.0, "paint"),
    ("CREAM", (0.93, 0.89, 0.80), 0.55, 0.0, "paint"),
    ("WOOD", (0.60, 0.40, 0.23), 0.60, 0.0, "wood"),
    ("DARKWOOD", (0.36, 0.23, 0.14), 0.65, 0.0, "wood"),
    ("GOLD", (0.88, 0.66, 0.26), 0.35, 0.4, "metal"),
    ("STEEL", (0.58, 0.62, 0.67), 0.35, 0.6, "metal"),
    ("PINE", (0.09, 0.32, 0.17), 0.70, 0.0, "pine"),
    ("BERRY", (0.86, 0.10, 0.12), 0.35, 0.0, "paint"),
    ("WINDOW", (1.00, 0.84, 0.50), 0.20, 0.0, "flat"),
    ("SLATE", (0.30, 0.33, 0.39), 0.50, 0.2, "stone"),
    ("FALU", (0.60, 0.14, 0.11), 0.60, 0.0, "wood"),
    ("BLUE", (0.17, 0.35, 0.64), 0.50, 0.0, "paint"),
    ("ICE", (0.62, 0.80, 0.93), 0.20, 0.0, "flat"),
    ("CORD", (0.14, 0.18, 0.16), 0.60, 0.0, "flat"),
]
PI = {c[0]: i for i, c in enumerate(CELLS)}


def periodic_noise(n, beta, seed):
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((n, n)))
    fx = np.fft.fftfreq(n)[None, :]
    fy = np.fft.fftfreq(n)[:, None]
    r = np.sqrt(fx * fx + fy * fy)
    r[0, 0] = 1.0
    f *= 1.0 / r ** beta
    f[0, 0] = 0
    a = np.real(np.fft.ifft2(f))
    a -= a.min()
    return a / a.max()


def save_jpeg(name, rgb, path, q=85):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.concatenate([rgb, np.ones((h, w, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = "JPEG"
    img.filepath_raw = path
    img.save(filepath=path, quality=q)
    bpy.data.images.remove(img)


def make_textures():
    os.makedirs(TEX, exist_ok=True)
    n, c = 512, 128
    low, mid, fine = periodic_noise(n, 2.0, 1), periodic_noise(n, 1.3, 2), periodic_noise(n, 0.6, 3)
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    col = np.zeros((n, n, 3))
    rough = np.zeros((n, n))
    metal = np.zeros((n, n))
    for i, (name, rgb, r, m, kind) in enumerate(CELLS):
        cx, cy = i % 4, i // 4
        sl = (slice(cy * c, (cy + 1) * c), slice(cx * c, (cx + 1) * c))
        L, M, F = low[sl] - 0.5, mid[sl] - 0.5, fine[sl] - 0.5
        if kind == "snow":
            s = 1 + 0.03 * L + 0.025 * F
        elif kind == "paint":
            s = 1 + 0.05 * L + 0.02 * F
        elif kind == "wood":
            grain = np.sin(xx[sl] * 0.45 + 9.0 * M)
            s = 1 + 0.06 * grain + 0.04 * L + 0.02 * F
        elif kind == "metal":
            s = 1 + 0.03 * L + 0.03 * F
        elif kind == "pine":
            s = 1 + 0.22 * F + 0.08 * L
        elif kind == "stone":
            s = 1 + 0.08 * L + 0.06 * F
        else:
            s = 1 + 0.015 * L
        col[sl] = np.clip(np.array(rgb)[None, None, :] * s[..., None], 0.0, 0.98)
        rough[sl] = np.clip(r + 0.06 * M + (0.04 * F if kind in ("snow", "pine", "stone") else 0), 0.05, 1.0)
        metal[sl] = m
    paths = {"BaseColor": os.path.join(TEX, "T_Furniture_BaseColor.jpg"),
             "ORM": os.path.join(TEX, "T_Furniture_ORM.jpg"),
             "Sign": os.path.join(TEX, "T_SignFace_Placeholder.jpg")}
    save_jpeg("col", col, paths["BaseColor"])
    save_jpeg("orm", np.stack([np.ones_like(rough), rough, metal], 2), paths["ORM"])
    # tiny light placeholder for SignFace (keeps TEXCOORD_0 in every pipeline; game swaps the map)
    save_jpeg("sgn", np.full((16, 16, 3), (0.90, 0.89, 0.86)), paths["Sign"], q=90)
    return paths


# ----------------------------------------------------------------------------- materials
def _bsdf(m):
    m.use_nodes = True
    return next(nd for nd in m.node_tree.nodes if nd.type == "BSDF_PRINCIPLED")


def _img(nt, path, data, x, y):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    t.image.colorspace_settings.is_data = data
    t.location = (x, y)
    return t


def mat_furniture(paths):
    m = bpy.data.materials.new("M_Furniture")
    b = _bsdf(m)
    m.use_backface_culling = True
    nt = m.node_tree
    c = _img(nt, paths["BaseColor"], False, -700, 300)
    nt.links.new(c.outputs["Color"], b.inputs["Base Color"])
    o = _img(nt, paths["ORM"], True, -700, 0)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    sep.location = (-400, 0)
    nt.links.new(o.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    return m


def mat_sign(paths):
    m = bpy.data.materials.new("SignFace")
    b = _bsdf(m)
    m.use_backface_culling = True
    t = _img(m.node_tree, paths["Sign"], False, -500, 200)
    m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.6
    b.inputs["Metallic"].default_value = 0.0
    return m


def mat_flag():
    m = bpy.data.materials.new("FlagCloth")
    b = _bsdf(m)
    m.use_backface_culling = False          # double-sided cloth
    b.inputs["Base Color"].default_value = (0.86, 0.86, 0.86, 1.0)   # ~0.94 sRGB, never pure white
    b.inputs["Roughness"].default_value = 0.8
    b.inputs["Metallic"].default_value = 0.0
    return m


def mat_glow(name, rgb):
    m = bpy.data.materials.new(name)
    b = _bsdf(m)
    m.use_backface_culling = True
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Emission Color"].default_value = (*rgb, 1.0)
    b.inputs["Emission Strength"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.3
    return m


# ----------------------------------------------------------------------------- primitives
def ensure_ccw(prof):
    a = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1]
            for i in range(len(prof)))
    return list(prof) if a > 0 else list(reversed(prof))


def loft(rings, cap0=True, cap1=True):
    """Rings of Vectors (or a single point); each ring CCW about the path direction."""
    bm = bmesh.new()
    R = [[bm.verts.new(p) for p in ring] for ring in rings]
    for a, b in zip(R[:-1], R[1:]):
        n = max(len(a), len(b))
        for j in range(n):
            j1 = (j + 1) % n
            if len(a) == 1:
                q = [a[0], b[j1], b[j]]
            elif len(b) == 1:
                q = [a[j], a[j1], b[0]]
            else:
                q = [a[j], a[j1], b[j1], b[j]]
            bm.faces.new(q)
    if cap0 and len(R[0]) > 2:
        bm.faces.new(list(reversed(R[0])))
    if cap1 and len(R[-1]) > 2:
        bm.faces.new(R[-1])
    return bm


def _area(prof):
    return sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1]
               for i in range(len(prof)))


def prism(profiles, centers, N, B, caps):
    """Loft of same-topology profiles (in (N, B)) through centers; end caps split into the given
    planar index polygons (avoids concave n-gon caps)."""
    n = len(profiles[0])
    if _area(profiles[0]) < 0:
        profiles = [list(reversed(p)) for p in profiles]
        caps = [[n - 1 - i for i in c] for c in caps]
    bm = loft([ring(c, N, B, p) for c, p in zip(centers, profiles)], False, False)
    bm.verts.ensure_lookup_table()
    T = (centers[-1] - centers[0]).normalized()
    for k, exp in ((0, -T), (len(centers) - 1, T)):
        for c in caps:
            f = bm.faces.new([bm.verts[k * n + i] for i in c])
            f.normal_update()
            if f.normal.dot(exp) < 0:
                f.normal_flip()
    return bm


def xform(bm, M):
    for v in bm.verts:
        v.co = M @ v.co
    return bm


def ring(c, N, B, prof):
    return [c + a * N + b * B for a, b in prof]


def circle(r, n, rot=0.0, ry=None):
    ry = r if ry is None else ry
    return [(r * math.cos(rot + TAU * k / n), ry * math.sin(rot + TAU * k / n)) for k in range(n)]


X, Y, Z = V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1))


def cyl_z(cx, cy, z0, z1, r0, r1, n=12, tb=0.0, cap0=True, cap1=True):
    c = V((cx, cy, 0))
    rings = [ring(c + Z * z0, X, Y, circle(r0, n))]
    rings.append(ring(c + Z * (z1 - tb), X, Y, circle(r1, n)))
    if tb > 0:
        rings.append(ring(c + Z * z1, X, Y, circle(r1 - tb, n)))
    return loft(rings, cap0, cap1)


def dome(cx, cy, z0, rx, ry, h, n=12, phis=(0.0, 0.55, 1.05), bottom=True):
    c = V((cx, cy, z0))
    rings = [ring(c + Z * (h * math.sin(p)), X, Y, circle(rx * math.cos(p), n, ry=ry * math.cos(p))) for p in phis]
    rings.append([c + Z * h])
    return loft(rings, bottom, False)


def sphere(c, r, n=8, m=4, scale=(1, 1, 1), M=None):
    c = V(c)
    rings = [[V((0, 0, -1))]]
    for k in range(1, m):
        p = -math.pi / 2 + math.pi * k / m
        rings.append([V((math.cos(p) * a, math.cos(p) * b, math.sin(p))) for a, b in circle(1.0, n)])
    rings.append([V((0, 0, 1))])
    S = Matrix.Diagonal(V(scale)).to_4x4() * r
    S[3][3] = 1.0
    T = Matrix.Translation(c) @ (M.to_4x4() if M is not None else Matrix()) @ S
    rings = [[T @ p for p in rg] for rg in rings]
    return loft(rings, False, False)


def box(x0, x1, y0, y1, z0, z1, bev=0.0, seg=1, bottom=True):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = V((x0 if v.co.x < 0 else x1, y0 if v.co.y < 0 else y1, z0 if v.co.z < 0 else z1))
    at_bot = lambda e: all(abs(v.co.z - z0) < 1e-7 for v in e.verts)
    if bev > 0:
        es = [e for e in bm.edges if bottom or not at_bot(e)]
        bmesh.ops.bevel(bm, geom=es, offset=bev, offset_type="OFFSET", segments=seg, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    bm.normal_update()
    if not bottom:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.99 and
                                   all(abs(v.co.z - z0) < 1e-7 for v in f.verts)], context="FACES")
    return bm


def box_m(M, sx, sy, sz, bev=0.0, seg=1):
    bm = box(-sx / 2, sx / 2, -sy / 2, sy / 2, -sz / 2, sz / 2, bev, seg)
    for v in bm.verts:
        v.co = M @ v.co
    return bm


def torus(c, axis, R, r, nu=12, nv=6):
    c = V(c)
    if axis == "y":
        e1, e2, ax = Z, X, Y
    else:
        e1, e2, ax = X, Y, Z
    bm = bmesh.new()
    vs = [[bm.verts.new(c + (R + r * math.cos(TAU * j / nv)) * (math.cos(TAU * i / nu) * e1 + math.sin(TAU * i / nu) * e2)
                        + r * math.sin(TAU * j / nv) * ax) for j in range(nv)] for i in range(nu)]
    for i in range(nu):
        for j in range(nv):
            i1, j1 = (i + 1) % nu, (j + 1) % nv
            bm.faces.new([vs[i][j], vs[i1][j], vs[i1][j1], vs[i][j1]])
    return bm


def pillow(a0, a1, c_lat, z0, w, t, axis="x", seed=1, step=2.0, lump=0.08, ends=True, endprof=None, K=6):
    """Rounded snow lump along X (or Y) from a0 to a1, flat bottom at z0, width w, height t."""
    rnd = random.Random(seed)
    if axis == "x":
        T, L = X, Y
        base = lambda s: V((s, c_lat, z0))
    else:
        T, L = Y, -X
        base = lambda s: V((c_lat, s, z0))
    p = 3.0
    prof = []
    for k in range(K + 1):
        th = math.pi * k / K
        cs, sn = math.cos(th), math.sin(th)
        prof.append(((w / 2) * math.copysign(abs(cs) ** (2 / p), cs), t * abs(sn) ** (2 / p)))
    prof = ensure_ccw(prof)           # CCW in (lateral, up); lateral x up = T
    L_ = a1 - a0
    e = min(0.9 * t + 0.05, L_ / 4)
    st = []
    if ends:
        st += [(a0, 0.55, 0.35), (a0 + 0.35 * e, 0.85, 0.8)]
    st.append((a0 + (e if ends else 0), 1.0, 1.0))
    inner0, inner1 = a0 + (e if ends else 0), a1 - (e if ends else 0)
    nmid = max(0, int(math.ceil((inner1 - inner0) / step)) - 1)
    for i in range(1, nmid + 1):
        s = inner0 + (inner1 - inner0) * i / (nmid + 1)
        st.append((s, 1.0 + rnd.uniform(-0.03, 0.03), 1.0 + rnd.uniform(-lump, lump)))
    st.append((a1 - (e if ends else 0), 1.0, 1.0))
    if ends:
        st += [(a1 - 0.35 * e, 0.85, 0.8), (a1, 0.55, 0.35)]
    rings = [[base(s) + (sa * a) * L + (sb * b) * Z for a, b in prof] for s, sa, sb in st]
    return loft(rings)


def sweep(path, prof, Bax=Y, cap0=True, cap1=True, scales=None):
    rings = []
    for i, p in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, len(path) - 1)]
        T = (b - a).normalized()
        N = Bax.cross(T).normalized()
        s = scales[i] if scales else (1.0, 1.0, 0.0)
        rings.append([p + (s[2] + s[0] * (pa - s[2])) * N + s[1] * pb * Bax for pa, pb in prof])
    return loft(rings, cap0, cap1)


def bulb(top, r=0.04, L=0.12, n=6):
    top = V(top)
    return loft([[top], ring(top - Z * (0.35 * L), Y, X, circle(r, n)), [top - Z * L]], False, False)


def sign_frame(cx, yf, zc, W, H, D, w, h, rec, bev=0.03):
    """Board (x cx+-W/2, y yf-D..yf, z zc+-H/2) with a w x h recess (depth rec) in its uphill (+Y) face.
    Returns (frame bmesh, SignFace bmesh with UVs)."""
    bm = bmesh.new()
    x0, x1, z0, z1, yb = cx - W / 2, cx + W / 2, zc - H / 2, zc + H / 2, yf - D
    o = [bm.verts.new(V(p)) for p in ((x0, yf, z0), (x1, yf, z0), (x1, yf, z1), (x0, yf, z1))]
    k = [bm.verts.new(V(p)) for p in ((x0, yb, z0), (x1, yb, z0), (x1, yb, z1), (x0, yb, z1))]
    i0 = [bm.verts.new(V(p)) for p in ((cx - w / 2, yf, zc - h / 2), (cx + w / 2, yf, zc - h / 2),
                                       (cx + w / 2, yf, zc + h / 2), (cx - w / 2, yf, zc + h / 2))]
    i1 = [bm.verts.new(V((p.co.x, yf - rec, p.co.z))) for p in i0]

    def face(vs, expect):
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(expect) < 0:
            f.normal_flip()
        return f
    face(list(reversed(k)), -Y)
    face([k[0], k[1], o[1], o[0]], -Z)
    face([k[1], k[2], o[2], o[1]], X)
    face([k[2], k[3], o[3], o[2]], Z)
    face([k[3], k[0], o[0], o[3]], -X)
    for j in range(4):
        j1 = (j + 1) % 4
        face([o[j], o[j1], i0[j1], i0[j]], Y)
        mid = (i0[j].co + i0[j1].co) / 2
        face([i0[j], i0[j1], i1[j1], i1[j]], V((cx, 0, zc)) - V((mid.x, 0, mid.z)))
    if bev > 0:
        outer = set(o) | set(k)
        es = [e for e in bm.edges if all(v in outer for v in e.verts)]
        bmesh.ops.bevel(bm, geom=es, offset=bev, offset_type="OFFSET", segments=1, profile=0.5,
                        affect="EDGES", clamp_overlap=True)
    # SignFace: u from the rider's left (+X) to right (-X), v bottom to top, normal +Y (uphill)
    sb = bmesh.new()
    ys = yf - rec
    zb, zt = zc - h / 2, zc + h / 2
    q = [sb.verts.new(V(p)) for p in ((cx + w / 2, ys, zb), (cx - w / 2, ys, zb), (cx - w / 2, ys, zt), (cx + w / 2, ys, zt))]
    f = sb.faces.new(q)
    uvl = sb.loops.layers.uv.new("UVMap")
    for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uvl].uv = uv
    f.smooth = False
    return bm, sb


# ----------------------------------------------------------------------------- mesh builder
class MB:
    def __init__(self):
        self.bm = bmesh.new()
        self.pl = self.bm.faces.layers.int.new("pal")

    def add(self, src, pal, smooth=True):
        src.verts.index_update()
        vm = [self.bm.verts.new(v.co) for v in src.verts]
        for f in src.faces:
            nf = self.bm.faces.new([vm[v.index] for v in f.verts])
            nf[self.pl] = PI[pal]
            nf.smooth = smooth
        src.free()


def finish_bm(bm, sharp_deg=60.0):
    ng = [f for f in bm.faces if len(f.verts) > 4]
    if ng:
        bmesh.ops.triangulate(bm, faces=ng, quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.normal_update()
    lim = math.radians(sharp_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim:
            e.smooth = False


def make_obj(name, bm, mat, parent=None, wn=True):
    finish_bm(bm)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    if wn:
        md = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
        md.mode = "FACE_AREA"
        md.weight = 50
        md.keep_sharp = True
    return ob


def uv_cells(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="FACE")
    me = ob.data
    bm = bmesh.from_edit_mesh(me)
    pl = bm.faces.layers.int.get("pal")
    groups = sorted({f[pl] for f in bm.faces})
    ins, sz = 8 / 512, 0.25 - 16 / 512
    for g in groups:
        bm = bmesh.from_edit_mesh(me)
        pl = bm.faces.layers.int.get("pal")
        for f in bm.faces:
            f.select_set(f[pl] == g)
        bmesh.update_edit_mesh(me)
        bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.02)
        bm = bmesh.from_edit_mesh(me)
        pl = bm.faces.layers.int.get("pal")
        uvl = bm.loops.layers.uv.active
        cx, cy = g % 4, g // 4
        for f in bm.faces:
            if f[pl] == g:
                for lp in f.loops:
                    u, v = lp[uvl].uv
                    lp[uvl].uv = (cx * 0.25 + ins + u * sz, cy * 0.25 + ins + v * sz)
        bmesh.update_edit_mesh(me)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.attributes.remove(me.attributes["pal"])


def uv_full(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


# ----------------------------------------------------------------------------- models
def xr(s, a, b):
    return (min(s * a, s * b), max(s * a, s * b))


def wreath_bow(mb, c, R, r):
    """Pine wreath (torus facing +Y) with a red bow at the bottom."""
    c = V(c)
    mb.add(torus(c, "y", R, r, 12, 6), "PINE")
    k = c + V((0, r * 0.9, -R))
    mb.add(sphere(k, 0.6 * r, 8, 4), "BERRY")
    for s in (1, -1):
        M = Matrix.Rotation(s * math.radians(20), 3, "Y")
        mb.add(sphere(k + V((s * 1.25 * r, 0.0, 0.25 * r)), r, 8, 4, scale=(1.4, 0.55, 0.85), M=M), "BERRY")


def build_arch_start():
    mb, kids = MB(), []
    for s in (1, -1):
        mb.add(box(*xr(s, 10.0, 10.85), -0.45, 0.45, 0.0, 0.7, bev=0.05), "DARKWOOD")       # plinth
        mb.add(box(*xr(s, 10.0, 10.6), -0.3, 0.3, 0.7, 7.4, bev=0.05, bottom=False), "GREEN")   # column
        mb.add(box(*xr(s, 9.95, 10.65), -0.35, 0.35, 7.35, 7.55, bev=0.04), "GOLD")              # cap
        mb.add(dome(s * 10.3, 0.0, 7.52, 0.36, 0.36, 0.28), "SNOW")
        wreath_bow(mb, (s * 9.5, 0.25 + 0.03, 5.8), 0.30, 0.085)
    fr, sf = sign_frame(0.0, 0.25, 5.8, 20.6, 2.4, 0.5, 18.0, 2.2, 0.03, bev=0.04)           # banner beam
    mb.add(fr, "RED")
    mb.add(pillow(-10.02, 10.02, 0.0, 6.97, 0.62, 0.30, "x", seed=3, step=2.2), "SNOW")
    kids.append(("SignFace", sf, "SignFace"))
    return mb, kids


def build_arch_finish():
    mb, kids = MB(), []
    a, b, z7, xc = 12.35, 3.8, 7.2, 12.35
    for s in (1, -1):
        mb.add(box(*xr(s, 12.0, 12.95), -0.5, 0.5, 0.0, 0.6, bev=0.05), "SLATE")
    # tube: legs + elliptical arch, decagon section with flats at +-0.35 (inner face exactly at |x| = 12)
    narc = 20
    path = [V((xc, 0, 0.6)), V((xc, 0, 3.9))]
    path += [V((a * math.cos(math.pi * i / narc), 0, z7 + b * math.sin(math.pi * i / narc))) for i in range(narc + 1)]
    path += [V((-xc, 0, 3.9)), V((-xc, 0, 0.6))]
    octo = ensure_ccw(circle(0.35 / math.cos(math.pi / 10), 10, rot=math.pi / 10))   # 10 sides, flats at a = +-0.35
    mb.add(sweep(path, octo, Y, False, False), "RED")

    def arc(th):
        return V((a * math.cos(th), 0, z7 + b * math.sin(th)))
    # snow along the flatter top of the arch
    ns, t0, t1 = 14, 0.12 * math.pi, 0.88 * math.pi
    sp = [arc(t0 + (t1 - t0) * i / ns) for i in range(ns + 1)]
    bs = [0.42, 0.30, 0.15, 0.0, -0.15, -0.30, -0.42]
    cres = [(0.30, 0.42)] + [(0.33 + 0.22 * (1 - (q / 0.42) ** 2) ** 0.6, q) for q in bs[1:-1]] + [(0.30, -0.42)]
    cres = ensure_ccw(cres)
    sc = [(0.35, 0.45, 0.30), (0.8, 0.85, 0.30)] + [(1, 1, 0.30)] * (ns - 3) + [(0.8, 0.85, 0.30), (0.35, 0.45, 0.30)]
    mb.add(sweep(sp, cres, Y, True, True, scales=sc), "SNOW")
    # garland swags hanging (world down) in front of the arch, baubles at the low points
    g0, g1, nsw, ng = 0.10 * math.pi, 0.90 * math.pi, 5, 30
    gp = []
    for i in range(ng + 1):
        th = g0 + (g1 - g0) * i / ng
        frac = (i / ng * nsw) % 1.0
        gp.append(arc(th) + V((0, 0.44, 0)) - Z * (0.10 + 0.45 * math.sin(math.pi * frac)))
    mb.add(sweep(gp, ensure_ccw(circle(0.17, 5)), Y, True, True), "PINE")
    for k in range(nsw):
        th = g0 + (g1 - g0) * (k + 0.5) / nsw
        c = arc(th) + V((0, 0.44, 0)) - Z * (0.10 + 0.45 + 0.30)
        mb.add(sphere(c, 0.24, 8, 4), "GOLD" if k % 2 == 0 else "BERRY")
    fr, sf = sign_frame(0.0, 0.2, 5.9, 24.7, 2.6, 0.4, 22.0, 2.4, 0.03, bev=0.04)
    mb.add(fr, "CREAM")
    kids.append(("SignFace", sf, "SignFace"))
    return mb, kids


def build_board():
    mb, kids = MB(), []
    fr, sf = sign_frame(0.0, 0.06, 1.3, 3.4, 1.8, 0.12, 3.2, 1.6, 0.025, bev=0.025)
    mb.add(fr, "RED")
    for s in (1, -1):
        mb.add(cyl_z(s * 1.2, -0.123, 0.05, 2.1, 0.075, 0.07, 12, tb=0.02, cap0=False), "DARKWOOD")
        mb.add(dome(s * 1.2, -0.12, 0.0, 0.32, 0.28, 0.16), "SNOW")
    mb.add(pillow(-1.72, 1.72, 0.0, 2.17, 0.20, 0.17, "x", seed=5, step=1.2), "SNOW")
    # holly sprig on the top-left corner (rider's view)
    hx = 1.42
    for s in (1, -1):
        M = Matrix.Rotation(s * math.radians(28), 3, "Z") @ Matrix.Rotation(math.radians(-15), 3, "X")
        mb.add(sphere((hx + s * 0.11, 0.03, 2.33), 0.14, 8, 4, scale=(1.0, 0.45, 0.16), M=M), "PINE")
    for p in ((hx - 0.03, 0.06, 2.36), (hx + 0.04, 0.07, 2.365), (hx, 0.02, 2.375)):
        mb.add(sphere(p, 0.04, 8, 4), "BERRY")
    kids.append(("SignFace", sf, "SignFace"))
    return mb, kids


def build_fence():
    mb, kids = MB(), []
    for s in (1, -1):
        mb.add(cyl_z(s * 2.0, 0.0, 0.02, 1.25, 0.065, 0.06, 12, tb=0.02, cap0=False), "WOOD")
        mb.add(dome(s * 2.0, 0.0, 1.23, 0.105, 0.105, 0.12), "SNOW")
    for z0, z1 in ((0.32, 0.38), (0.98, 1.04)):
        mb.add(box(-2.0, 2.0, -0.02, 0.02, z0, z1, bev=0.006), "WOOD")
    ns, wd = 24, 0.075
    for i in range(ns):
        x = -2.0 + (i + 0.5) * 4.0 / ns
        prof = ensure_ccw([(0.12, -wd / 2), (0.12, wd / 2), (1.12, wd / 2), (1.18, 0.0), (1.12, -wd / 2)])
        rings = [ring(V((x, y, 0)), Z, X, prof) for y in (0.015, 0.037)]   # (Z, X) x-product = +Y
        mb.add(loft(rings), "RED" if i % 2 == 0 else "CREAM")
    # snow drift along the base: identical end profiles at x = +-2 so sections tile without a gap
    K, w, t = 6, 0.80, 0.24
    prof = ensure_ccw([((w / 2) * math.copysign(abs(math.cos(math.pi * k / K)) ** (2 / 2.6), math.cos(math.pi * k / K)) + 0.02,
                        t * abs(math.sin(math.pi * k / K)) ** (2 / 2.6)) for k in range(K + 1)])
    rings = []
    for i in range(9):
        x = -2.0 + 0.5 * i
        f = 1.0 + 0.10 * math.sin(math.pi * x) + 0.05 * math.sin(1.5 * math.pi * x)
        rings.append([V((x, 0, 0)) + a * Y + (f * b) * Z for a, b in prof])
    mb.add(loft(rings), "SNOW")
    return mb, kids


def build_flagpole():
    mb, kids = MB(), []
    mb.add(dome(0.0, 0.0, 0.0, 0.5, 0.5, 0.22), "SNOW")
    mb.add(cyl_z(0.0, 0.0, 0.05, 6.0, 0.055, 0.04, 12, tb=0.012, cap0=False), "STEEL")
    mb.add(sphere((0, 0, 6.06), 0.08, 10, 6), "GOLD")
    # FlagCloth: 1.6 x 1.0, hoist edge on the pole axis, soft static wave, UV 0..1
    nx, nz, Lx, Hz, zb = 12, 6, 1.6, 1.0, 4.75
    fb = bmesh.new()
    uvl = fb.loops.layers.uv.new("UVMap")
    vs = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            x = Lx * u * 0.97
            amp = 0.11 * u ** 0.8
            y = amp * math.sin(TAU * (x / 0.95) - 0.4 + 0.9 * v)
            z = zb + Hz * v - 0.07 * u * u * (1.0 - 0.3 * v)
            row.append((fb.verts.new(V((x, y, z))), (u, v)))
        vs.append(row)
    for j in range(nz):
        for i in range(nx):
            q = [vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]]
            f = fb.faces.new([p[0] for p in q])
            f.smooth = True
            for lp, p in zip(f.loops, q):
                lp[uvl].uv = p[1]
    fb.normal_update()
    if sum(f.normal.y for f in fb.faces) < 0:
        bmesh.ops.reverse_faces(fb, faces=fb.faces[:])
    kids.append(("FlagCloth", fb, "FlagCloth"))
    return mb, kids


HUT = dict(ridge=3.05, wall=2.25, hw=1.45, hd=1.2, ov=0.3, slab=0.10)


def build_hut():
    mb, kids = MB(), []
    R, Wt, hw, hd, ov, sl = HUT["ridge"], HUT["wall"], HUT["hw"], HUT["hd"], HUT["ov"], HUT["slab"]
    tan_a = (R - Wt) / hw
    al = math.atan(tan_a)
    zb = lambda x: R - tan_a * abs(x)                  # roof slab underside
    zt = lambda x: zb(x) + sl / math.cos(al)           # roof slab top
    mb.add(box(-1.56, 1.56, -1.31, 1.31, 0.0, 0.24, bev=0.04), "SLATE")
    # walls: pentagon loft along +Y (top lines 4 cm inside the roof slabs)
    pent = ensure_ccw([(0.2, -hw), (0.2, hw), (Wt + 0.04, hw), (R + 0.04, 0.0), (Wt + 0.04, -hw)])   # (z, x)
    mb.add(loft([ring(V((0, y, 0)), Z, X, pent) for y in (-hd, hd)]), "FALU")
    for sx in (1, -1):
        for sy in (1, -1):
            mb.add(box(sx * hw - 0.08, sx * hw + 0.08, sy * hd - 0.08, sy * hd + 0.08, 0.22, 2.32, bev=0.02), "CREAM")
    # roof: one mitred inverted-V slab (loft along +Y), profile in (z, x)
    xe0 = hw + ov
    rp = [(xe0, zb(xe0)), (0.0, zb(0.0)), (-xe0, zb(xe0)), (-xe0, zt(xe0)), (0.0, zt(0.0)), (xe0, zt(xe0))]
    rp = [(z, x) for x, z in rp]
    mb.add(prism([rp, rp], [V((0, -(hd + ov), 0)), V((0, hd + ov, 0))], Z, X, [[0, 1, 4, 5], [1, 2, 3, 4]]), "DARKWOOD")
    # roof snow blanket: loft along +Y, profile in (z, x)
    xe = hw + ov

    xs = [xe + 0.05, 1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5, -(xe + 0.05)]

    def snow_prof(tf):
        top = [(x, zt(x) + tf * (0.17 if abs(x) < xe - 0.2 else 0.12) + tf * 0.03 * max(0.0, 1 - abs(x) / 0.5)) for x in xs]
        bot = [(x, zt(x) - 0.02) for x in reversed(xs)]
        pts = [(xe + 0.10, zt(xe + 0.10) + 0.04 * tf)] + top + [(-(xe + 0.10), zt(xe + 0.10) + 0.04 * tf)] + bot
        return [(z, x) for x, z in pts]
    m = len(xs)
    caps = [[1 + i, 2 + i, (m + 2) + (m - 2 - i), (m + 2) + (m - 1 - i)] for i in range(m - 1)]
    caps += [[0, 1, 2 * m + 1], [m + 1, m, m + 2]]
    yy = [(-(hd + ov + 0.07), 0.45), (-(hd + ov), 1.0), (-0.5, 1.05), (0.5, 0.95), (hd + ov, 1.0), (hd + ov + 0.07, 0.45)]
    mb.add(prism([snow_prof(tf) for _, tf in yy], [V((0, y, 0)) for y, _ in yy], Z, X, caps), "SNOW")
    # chimney
    mb.add(box(0.55, 0.9, -0.75, -0.4, 2.5, 3.45, bev=0.02), "SLATE")
    mb.add(dome(0.725, -0.575, 3.43, 0.22, 0.22, 0.14), "SNOW")
    # door, frame, knob, wreath
    yf = hd
    mb.add(box(-0.47, 0.47, yf - 0.03, yf + 0.03, 0.26, 1.90, bev=0.015), "GREEN")
    for s in (1, -1):
        mb.add(box(*xr(s, 0.45, 0.55), yf - 0.04, yf + 0.05, 0.22, 1.94, bev=0.012), "CREAM")
    mb.add(box(-0.57, 0.57, yf - 0.045, yf + 0.055, 1.88, 1.98, bev=0.012), "CREAM")
    mb.add(sphere((0.32, yf + 0.05, 1.05), 0.035, 8, 4), "GOLD")
    mb.add(torus((0.0, yf + 0.04, 1.45), "y", 0.17, 0.045, 12, 6), "PINE")
    mb.add(sphere((0.0, yf + 0.075, 1.29), 0.04, 8, 4), "BERRY")
    # sign board above the door
    fr, sf = sign_frame(0.0, yf + 0.06, 2.26, 1.72, 0.52, 0.08, 1.6, 0.4, 0.015, bev=0.012)
    mb.add(fr, "GREEN")
    kids.append(("SignFace", sf, "SignFace"))
    # windows on both side walls
    for s in (1, -1):
        mb.add(box(*xr(s, 1.43, 1.47), -0.37, 0.37, 0.96, 1.72), "WINDOW")
        for t in (1, -1):
            mb.add(box(*xr(s, 1.42, 1.50), *xr(t, 0.35, 0.43), 0.95, 1.74, bev=0.01), "CREAM")
        mb.add(box(*xr(s, 1.41, 1.51), -0.46, 0.46, 1.70, 1.79, bev=0.01), "CREAM")
        mb.add(box(*xr(s, 1.40, 1.56), -0.5, 0.5, 0.88, 0.97, bev=0.012), "CREAM")
        mb.add(pillow(-0.48, 0.48, s * 1.48, 0.955, 0.14, 0.07, "y", seed=7 + s, step=1.0, lump=0.0), "SNOW")
    # Christmas lights: bulbs hang from the slab underside along the front gable and both side eaves
    gb = bmesh.new()
    for s in (1, -1):
        for x in np.linspace(0.2, 1.68, 8):
            src = bulb((s * x, hd + 0.24, zb(x) + 0.02), 0.04, 0.12)
            _append(gb, src)
        for y in np.linspace(-1.35, 1.35, 8):
            src = bulb((s * 1.69, y, zb(1.69) + 0.02), 0.04, 0.12)
            _append(gb, src)
    kids.append(("glow", gb, "glow"))
    return mb, kids


def _append(dst, src):
    src.verts.index_update()
    vm = [dst.verts.new(v.co) for v in src.verts]
    for f in src.faces:
        nf = dst.faces.new([vm[v.index] for v in f.verts])
        nf.smooth = True
    src.free()


def build_floodlight():
    mb, kids = MB(), []
    mb.add(box(-0.35, 0.35, -0.35, 0.35, 0.0, 0.45, bev=0.04), "SLATE")
    mb.add(dome(0.0, 0.0, 0.43, 0.36, 0.36, 0.10), "SNOW")
    mb.add(cyl_z(0.0, 0.0, 0.40, 10.0, 0.11, 0.075, 12, tb=0.02, cap0=False), "STEEL")
    mb.add(box(-0.12, 0.12, 0.08, 0.22, 1.2, 1.55, bev=0.015), "SLATE")
    mb.add(box(-1.2, 1.2, -0.06, 0.06, 9.5, 9.62, bev=0.015), "STEEL")
    mb.add(pillow(-1.18, 1.18, 0.0, 9.6, 0.15, 0.08, "x", seed=9, step=0.7), "SNOW")
    tilt = math.radians(25)
    d = V((0, math.cos(tilt), -math.sin(tilt)))
    B = X
    N = B.cross(d)
    gb = bmesh.new()
    for xl in (-0.8, 0.0, 0.8):
        mb.add(box(xl - 0.04, xl + 0.04, 0.0, 0.30, 9.52, 9.59), "STEEL")
        Q = V((xl, 0.26, 9.56))
        rings = [[Q]]
        for t, r in ((0.06, 0.20), (0.16, 0.28), (0.40, 0.28), (0.40, 0.245), (0.37, 0.245)):
            rings.append(ring(Q + d * t, N, B, circle(r, 16)))
        mb.add(loft(rings, False, False), "SLATE")
        top = Q + d * 0.26 + N * 0.255
        mb.add(xform(dome(0.0, 0.0, 0.0, 0.18, 0.16, 0.09, n=10), Matrix.Translation(top) @ Matrix.Rotation(-tilt, 4, "X")), "SNOW")
        lens = [ring(Q + d * 0.37, N, B, circle(0.245, 16)), [Q + d * 0.40]]
        _append(gb, loft(lens, False, False))
    kids.append(("glow", gb, "glow"))
    return mb, kids


MODELS = [
    ("SM_Arch_Start", build_arch_start, 1500),
    ("SM_Arch_Finish", build_arch_finish, 1500),
    ("SM_Board", build_board, 1500),
    ("SM_Fence", build_fence, 1500),
    ("SM_FlagPole", build_flagpole, 1500),
    ("SM_StartHut", build_hut, 3000),
    ("SM_Floodlight", build_floodlight, 1500),
]


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    paths = make_textures()
    m_main, m_sign, m_flag = mat_furniture(paths), mat_sign(paths), mat_flag()
    sys.path.insert(0, QA_DIR)
    import qa_check
    only = [a for a in ARGS[2:]] if len(ARGS) > 2 else None
    report = {}
    for name, fn, budget in MODELS:
        if only and name not in only:
            continue
        mb, kids = fn()
        main_ob = make_obj(name, mb.bm, m_main)
        uv_cells(main_ob)
        obs = [main_ob]
        for kname, kbm, kmat in kids:
            if kmat == "SignFace":
                mat = m_sign
            elif kmat == "FlagCloth":
                mat = m_flag
            else:
                old = bpy.data.materials.get("glow")
                if old is not None:
                    old.name = "glow_prev"
                mat = mat_glow("glow", (0.80, 0.90, 1.0) if name == "SM_Floodlight" else (1.0, 0.70, 0.32))
            ko = make_obj(kname, kbm, mat, parent=main_ob, wn=False)
            if not ko.data.uv_layers:
                uv_full(ko)
            obs.append(ko)
        bpy.context.view_layer.update()
        qa = qa_check.run(objects=[o.name for o in obs], profile="game")
        tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs}
        lo = [min((o.matrix_world @ v.co)[i] for o in obs for v in o.data.vertices) for i in range(3)]
        hi = [max((o.matrix_world @ v.co)[i] for o in obs for v in o.data.vertices) for i in range(3)]
        report[name] = dict(tris=tris, total=sum(tris.values()), budget=budget, qa_pass=qa["pass"],
                            qa_errors=qa["errors"], qa_warnings=qa["warnings"],
                            bounds_blender=[[round(a, 4) for a in lo], [round(b, 4) for b in hi]])
        report[name]["qa_detail"] = {k: qa.get(k) for k in ("zfighting", "floating", "enclosed", "contact", "back_to_back") if k in qa}
        print("MODEL", name, json.dumps(report[name]))
        bpy.ops.object.select_all(action="DESELECT")
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = main_ob
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", use_selection=True,
            export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
            export_image_format="AUTO", export_materials="EXPORT",
            export_draco_mesh_compression_enable=False, export_animations=False,
            export_extras=False, export_tangents=False)
        for o in reversed(obs):
            me = o.data
            bpy.data.objects.remove(o)
            bpy.data.meshes.remove(me)
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w") as f:
        json.dump(report, f, indent=1)
    print("BUILD_DONE", REPORT)


if not os.environ.get("FURN_NOMAIN"):
    main()
