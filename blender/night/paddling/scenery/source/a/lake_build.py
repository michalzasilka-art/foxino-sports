"""Summer lake paddling scenery, lane A: SM_RaceArch, SM_Pontoon, SM_LanePost (headless).

blender -b --factory-startup -P lake_build.py -- <arch|pontoon|post> <out_dir> <tex_dir>

Blender axes: Z up. glTF (x, y, z) = Blender (x, z, -y): the race runs along Blender -Y
(glTF +Z) and the racers come from Blender +Y (glTF -Z), so every SignFace faces Blender +Y.
"""
import bpy, bmesh, sys, math, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MODEL, OUT, TEX = argv[0], argv[1], argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
RNG = np.random.default_rng(11)


# ------------------------------------------------------------------ materials / textures
def save_jpeg(name, arr, non_color=False):
    """arr: (h, w, 3) float 0..1, row 0 = bottom. Saved as JPEG q85, then reloaded from disk."""
    h, w, _ = arr.shape
    img = bpy.data.images.new(name + "_gen", w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32); rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    path = os.path.join(TEX, name + ".jpg")
    img.file_format = "JPEG"
    img.save(filepath=path, quality=85)
    bpy.data.images.remove(img)
    im = bpy.data.images.load(path); im.name = name
    if non_color:
        im.colorspace_settings.is_data = True
    return im


def material(name, col=(0.8, 0.8, 0.8), rough=0.6, metal=0.0, base_img=None, normal_img=None,
             double=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if base_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = base_img
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if normal_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = normal_img
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    m.use_backface_culling = not double          # glTF doubleSided = not backface culling
    return m


def srgb(c):
    return np.array(c, np.float32)


def fill(arr, x0, y0, x1, y1, col):
    arr[y0:y1, x0:x1] = srgb(col)


# ------------------------------------------------------------------ geometry
class Part:
    """One closed (or open) piece in its own bmesh; becomes an object, then everything is joined."""

    def __init__(self, name, mats):
        self.name, self.mats = name, mats
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")

    def v(self, co):
        return self.bm.verts.new(Vector(co))

    def face(self, verts, uvs, mi=0):
        f = self.bm.faces.new(verts)
        for l, uv in zip(f.loops, uvs):
            l[self.uv].uv = uv
        f.material_index = mi
        return f

    def sweep(self, p0, p1, stations, nseg, mi, uvr, ref=None, cap0=None, cap1=None, expo=2.0):
        """Tube along p0->p1. stations: [(s metres from p0, r_u, r_w)].
        cap: None | 'flat' | ('dome', length, rings). r_u along ref (default Z or X), r_w = dn x u."""
        p0, p1 = Vector(p0), Vector(p1)
        dn = (p1 - p0).normalized()
        ref = Vector(ref) if ref else (Vector((0, 0, 1)) if abs(dn.z) < 0.9 else Vector((1, 0, 0)))
        u = (ref - dn * ref.dot(dn)).normalized()
        w = dn.cross(u)

        def ring(s, ru, rw):
            c = p0 + dn * s; out = []
            for j in range(nseg):
                a = 2 * math.pi * j / nseg
                ca, sa = math.cos(a), math.sin(a)
                if expo != 2.0:
                    ca = math.copysign(abs(ca) ** (2 / expo), ca)
                    sa = math.copysign(abs(sa) ** (2 / expo), sa)
                out.append(self.v(c + u * (ru * ca) + w * (rw * sa)))
            return out

        rings = []          # (s, verts or single pole vert)
        s0, ru0, rw0 = stations[0]; s1, ru1, rw1 = stations[-1]
        if isinstance(cap0, tuple):
            _, ln, n = cap0
            rings.append((s0 - ln, self.v(p0 + dn * (s0 - ln))))
            for k in range(n - 1, 0, -1):
                a = k / n * math.pi / 2
                rings.append((s0 - ln * math.sin(a), ring(s0 - ln * math.sin(a), ru0 * math.cos(a), rw0 * math.cos(a))))
        for s, ru, rw in stations:
            rings.append((s, ring(s, ru, rw)))
        if isinstance(cap1, tuple):
            _, ln, n = cap1
            for k in range(1, n):
                a = k / n * math.pi / 2
                rings.append((s1 + ln * math.sin(a), ring(s1 + ln * math.sin(a), ru1 * math.cos(a), rw1 * math.cos(a))))
            rings.append((s1 + ln, self.v(p0 + dn * (s1 + ln))))
        smin, smax = rings[0][0], rings[-1][0]
        x0, y0, x1, y1 = uvr

        def UV(uu, s):
            return (x0 + (x1 - x0) * uu, y0 + (y1 - y0) * (s - smin) / max(smax - smin, 1e-6))

        for (sa, A), (sb, B) in zip(rings[:-1], rings[1:]):
            for j in range(nseg):
                j1 = (j + 1) % nseg; ua, ub = j / nseg, (j + 1) / nseg
                if isinstance(A, list) and isinstance(B, list):
                    self.face([A[j], A[j1], B[j1], B[j]], [UV(ua, sa), UV(ub, sa), UV(ub, sb), UV(ua, sb)], mi)
                elif isinstance(B, list):       # start pole
                    self.face([A, B[j1], B[j]], [UV((ua + ub) / 2, sa), UV(ub, sb), UV(ua, sb)], mi)
                else:                           # end pole
                    self.face([A[j], A[j1], B], [UV(ua, sa), UV(ub, sa), UV((ua + ub) / 2, sb)], mi)
        def disk(a):     # flat caps: a disk inside the UV rect (no zero-area UV faces)
            return (x0 + (x1 - x0) * (0.5 + 0.45 * math.cos(a)), y0 + (y1 - y0) * (0.5 + 0.45 * math.sin(a)))

        if cap0 == "flat":
            r = rings[0][1]
            self.face(list(reversed(r)), [disk(2 * math.pi * j / nseg) for j in reversed(range(nseg))], mi)
        if cap1 == "flat":
            r = rings[-1][1]
            self.face(r, [disk(2 * math.pi * j / nseg) for j in range(nseg)], mi)

    def finish(self, recalc=True, drop_faces=()):
        if recalc:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        if drop_faces:
            bmesh.ops.delete(self.bm, geom=list(drop_faces), context="FACES_ONLY")
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me); self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        SC.collection.objects.link(ob)
        return ob


def join(name, parts, sharp_deg):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name; ob.data.name = name
    finalize(ob, sharp_deg)
    return ob


def finalize(ob, sharp_deg):
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    ng = [f for f in bm.faces if len(f.verts) > 4]
    if ng:
        bmesh.ops.triangulate(bm, faces=ng, quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    if sharp_deg:
        me.set_sharp_from_angle(angle=math.radians(sharp_deg))
    me.update()


def sign_plane(name, mat, xh, y, z0, z1):
    """Plane facing Blender +Y (glTF -Z). Seen from the front: u=0 at the viewer's left (x=+xh),
    u=1 at the right (x=-xh), v=0 at the bottom, v=1 at the top."""
    p = Part(name, [mat])
    a, b, c, d = p.v((xh, y, z0)), p.v((-xh, y, z0)), p.v((-xh, y, z1)), p.v((xh, y, z1))
    p.face([a, b, c, d], [(0, 0), (1, 0), (1, 1), (0, 1)])
    ob = p.finish(recalc=False)
    finalize(ob, 0)
    return ob


# ------------------------------------------------------------------ SM_RaceArch
def build_arch():
    # trim atlas: floats (top half) soft navy rubber with a lighter waterline band, rope (quarter) cream twist
    T = np.zeros((512, 512, 3), np.float32)
    yy, xx = np.mgrid[0:512, 0:512] / 512.0
    T[:] = srgb((0.70, 0.72, 0.74))
    float_col = srgb((0.13, 0.27, 0.48)); top_col = srgb((0.20, 0.38, 0.62))
    f = (yy >= 0.5)
    # floats: u (x) runs around the cross-section, j=0 is the top -> lighter near u 0/1
    shade = np.clip(np.cos(xx * 2 * np.pi), 0, 1)[..., None]
    T[f] = (float_col * (1 - shade) + top_col * shade)[f]
    r = (yy >= 0.25) & (yy < 0.5)
    tw = 0.5 + 0.5 * np.sin((xx * 6 + yy * 40) * 2 * np.pi)
    rope = srgb((0.86, 0.79, 0.62)) * (0.86 + 0.14 * tw[..., None])
    T[r] = rope[r]
    trim_img = save_jpeg("T_ArchTrim", T)

    tint = material("Tint", (0.80, 0.81, 0.83), 0.42)
    trim = material("ArchTrim", rough=0.5, base_img=trim_img)
    signm = material("SignFace", (0.86, 0.86, 0.86), 0.6, double=True)
    mats = [tint, trim]
    TINT_UV = (0, 0, 1, 1); FLOAT_UV = (0.0, 0.5, 1.0, 1.0); ROPE_UV = (0.0, 0.25, 1.0, 0.5)
    parts = []
    for sx in (1, -1):
        X = 20.0 * sx
        # leg: inflatable tube, r 1.0, three pinched sections then one long section beside the banner
        zs = [(0.25, .9), (0.70, 1), (1.67, 1), (2.12, .9), (2.57, 1), (3.41, 1), (3.86, .9),
              (4.31, 1), (5.15, 1), (5.60, .9), (6.05, 1), (10.3, 1)]
        p = Part("leg", mats)
        p.sweep((X, 0, 0.0), (X, 0, 10.3), [(z, r, r) for z, r in zs], 20, 0, TINT_UV,
                ref=(1, 0, 0), cap0="flat", cap1=("dome", 1.0, 4))
        parts.append(p.finish())
        # floating base: rounded pontoon float, inner side exactly at |x| = 19
        p = Part("float", mats)
        FX = 20.2 * sx
        p.sweep((FX, -1.4, 0.10), (FX, 1.4, 0.10), [(0, 0.45, 1.2), (2.8, 0.45, 1.2)], 16, 1, FLOAT_UV,
                ref=(0, 0, 1), cap0=("dome", 0.8, 3), cap1=("dome", 0.8, 3), expo=3.0)
        parts.append(p.finish())
        # tether ropes, leg -> float ends
        for sy in (1, -1):
            a = Vector((X, 0.9 * sy, 4.6)); b = Vector((FX, 1.95 * sy, 0.35))
            p = Part("rope", mats)
            p.sweep(a, b, [(0, 0.035, 0.035), ((b - a).length, 0.035, 0.035)], 6, 1, ROPE_UV,
                    cap0="flat", cap1="flat")
            parts.append(p.finish())
    # top beam, pinched every 8 m, ends hidden in the leg domes
    st = []
    for k in range(6):
        s = 8.0 * k
        if k > 0: st.append((s - 1.2, 0.8, 0.8))
        st.append((s, 0.72, 0.72))
        if k < 5: st.append((s + 1.2, 0.8, 0.8))
    p = Part("beam", mats)
    p.sweep((-20, 0, 10.3), (20, 0, 10.3), st, 16, 0, TINT_UV, ref=(0, 0, 1), cap0="flat", cap1="flat")
    parts.append(p.finish())
    root = join("SM_RaceArch", parts, 50)
    sf = sign_plane("SignFace", signm, 19.0, 0.0, 6.2, 9.6)
    sf.parent = root
    return root


# ------------------------------------------------------------------ SM_Pontoon
def build_pontoon():
    W, H = 1024, 1024
    A = np.zeros((H, W, 3), np.float32); Hh = np.zeros((H, W), np.float32)
    # deck planks: rows 512..1023 = deck depth 2.2 m (Blender y -1.1 .. 1.1), cols = 7.4 m along x
    n_pl = 8; ph = 512 // n_pl
    u = np.arange(W) / W
    tones = [(0.80, 0.58, 0.35), (0.76, 0.53, 0.31), (0.83, 0.62, 0.38), (0.78, 0.56, 0.33)]
    for k in range(n_pl):
        r0 = 512 + k * ph
        vl = (np.arange(ph) / ph)[:, None]
        phase = RNG.uniform(0, 6.28); kk = RNG.uniform(2, 5)
        g = np.sin((vl * RNG.uniform(14, 22) + 0.6 * np.sin(u[None, :] * 2 * np.pi * kk + phase)
                    + 0.25 * np.sin(u[None, :] * 2 * np.pi * 17 + phase * 2)) * 2 * np.pi)
        lowf = 0.5 + 0.5 * np.sin(u[None, :] * 2 * np.pi * RNG.integers(1, 4) + phase)
        base = srgb(tones[k % 4]) * RNG.uniform(0.95, 1.05)
        A[r0:r0 + ph] = base * (0.90 + 0.06 * g[..., None] + 0.05 * lowf[..., None])
        Hh[r0:r0 + ph] = 1.0
        # plank gap (dark, grooved) on the lower edge of each plank
        A[r0:r0 + 3] = srgb((0.30, 0.20, 0.12)); Hh[r0:r0 + 3] = 0.0
        # one staggered butt joint inside the module, plus the module ends (half gaps meet when tiled)
        jx = int(RNG.uniform(0.2, 0.8) * W)
        for c0, c1 in ((jx - 1, jx + 2), (0, 2), (W - 2, W)):
            A[r0:r0 + ph, c0:c1] = srgb((0.33, 0.22, 0.13)); Hh[r0:r0 + ph, c0:c1] = 0.2
        # nail heads next to the joints
        for cx in (jx - 8, jx + 9, 8, W - 9):
            for ry in (r0 + ph // 4, r0 + 3 * ph // 4):
                A[ry - 2:ry + 2, cx - 2:cx + 2] = srgb((0.42, 0.40, 0.38)); Hh[ry - 2:ry + 2, cx - 2:cx + 2] = 0.8
    # fascia wood (rows 256..511)
    vv = (np.arange(256) / 256)[:, None]
    g = np.sin((vv * 9 + 0.4 * np.sin(u[None, :] * 2 * np.pi * 3)) * 2 * np.pi)
    A[256:512] = srgb((0.66, 0.45, 0.27)) * (0.92 + 0.08 * g[..., None]); Hh[256:512] = 1
    fill(A, 0, 128, 512, 256, (0.24, 0.56, 0.84))       # float plastic, sunny sky blue
    fill(A, 512, 128, 1024, 256, (0.22, 0.26, 0.33))    # rubber fender
    eg = np.sin(np.hypot(*np.mgrid[0:128, 0:512] - np.array([64, 256])[:, None, None]) * 0.25)
    A[0:128, 0:512] = srgb((0.72, 0.52, 0.31)) * (0.93 + 0.07 * eg[..., None])   # end grain
    fill(A, 512, 0, 1024, 128, (0.74, 0.76, 0.78))      # cleat metal
    # normal map from the height field (OpenGL / glTF convention, rows go up = +V)
    gy, gx = np.gradient(Hh)
    s = 2.5
    N = np.dstack([-gx * s, -gy * s, np.ones_like(Hh)])
    N /= np.linalg.norm(N, axis=2, keepdims=True)
    base_img = save_jpeg("T_Pontoon_BaseColor", A)
    nrm_img = save_jpeg("T_Pontoon_Normal", N * 0.5 + 0.5, non_color=True)
    wood = material("Pontoon", rough=0.6, base_img=base_img, normal_img=nrm_img)
    mats = [wood]
    parts = []
    # deck slab: profile in (y, z), extruded along x from -3.7 to +3.7 (flat ends for tiling)
    c = 0.035; zt, zb, yh = 0.35, 0.23, 1.07   # deck 2.14 deep + fenders = 2.2 m footprint
    prof = [(yh, zb), (yh, zt - c), (yh - c + c * math.cos(math.pi / 4), zt - c + c * math.sin(math.pi / 4)),
            (yh - c, zt), (-yh + c, zt),
            (-yh + c - c * math.cos(math.pi / 4), zt - c + c * math.sin(math.pi / 4)), (-yh, zt - c), (-yh, zb)]
    p = Part("deck", mats)
    L = [p.v((-3.7, y, z)) for y, z in prof]; R = [p.v((3.7, y, z)) for y, z in prof]
    n = len(prof)
    per = [0.0]
    for i in range(n):
        a, b = prof[i], prof[(i + 1) % n]
        per.append(per[-1] + math.hypot(a[0] - b[0], a[1] - b[1]))
    for i in range(n):
        i1 = (i + 1) % n
        if i == 3:      # top face -> deck planks: u = x across 7.4 m, v = y across 2.2 m
            uvs = [(0, 0.5 + 0.5 * (prof[i][0] + yh) / (2 * yh)), (0, 0.5 + 0.5 * (prof[i1][0] + yh) / (2 * yh)),
                   (1, 0.5 + 0.5 * (prof[i1][0] + yh) / (2 * yh)), (1, 0.5 + 0.5 * (prof[i][0] + yh) / (2 * yh))]
        else:           # sides -> fascia
            va = 0.25 + 0.25 * per[i] / per[-1]; vb = 0.25 + 0.25 * per[i + 1] / per[-1]
            uvs = [(0, va), (0, vb), (1, vb), (1, va)]
        p.face([L[i], L[i1], R[i1], R[i]], uvs)
    for ring_, flip in ((L, True), (R, False)):
        vs = list(reversed(ring_)) if flip else ring_
        p.face(vs, [(0.02 + 0.46 * (0.5 + 0.5 * v.co.y / yh), 0.02 + 0.2 * (v.co.z - zb) / (zt - zb)) for v in vs])
    parts.append(p.finish())
    # two plastic floats under the deck
    for sy in (1, -1):
        p = Part("float", mats)
        p.sweep((-3.2, 0.6 * sy, -0.06), (3.2, 0.6 * sy, -0.06), [(0, 0.34, 0.34), (6.4, 0.34, 0.34)], 14, 0,
                (0.01, 0.13, 0.49, 0.245), ref=(0, 0, 1), cap0=("dome", 0.3, 3), cap1=("dome", 0.3, 3), expo=2.6)
        parts.append(p.finish())
    # rubber fenders along both long edges (outer face at y = +-1.1), ending 1 cm inside the module ends
    # so their caps never sit in the plane of the deck end (no z-fight at the end of a row)
    for sy in (1, -1):
        p = Part("fender", mats)
        p.sweep((-3.69, 1.035 * sy, 0.285), (3.69, 1.035 * sy, 0.285), [(0, 0.065, 0.065), (7.38, 0.065, 0.065)],
                12, 0, (0.51, 0.13, 0.99, 0.245), ref=(0, 0, 1), cap0="flat", cap1="flat")
        parts.append(p.finish())
    # two low mooring cleats on the boat-side (glTF +Z = Blender -Y) edge
    for sx in (1, -1):
        p = Part("cleat", mats)
        cx = 2.6 * sx
        p.sweep((cx - 0.14, -0.92, 0.375), (cx + 0.14, -0.92, 0.375), [(0, 0.032, 0.04), (0.28, 0.032, 0.04)], 8, 0,
                (0.51, 0.01, 0.99, 0.12), ref=(0, 0, 1), cap0=("dome", 0.05, 2), cap1=("dome", 0.05, 2))
        parts.append(p.finish())
    return join("SM_Pontoon", parts, 35)


# ------------------------------------------------------------------ SM_LanePost
def build_post():
    T = np.zeros((256, 256, 3), np.float32)
    fill(T, 0, 128, 128, 256, (0.98, 0.76, 0.22))     # board rim: sunny yellow
    fill(T, 128, 128, 256, 256, (0.78, 0.80, 0.83))   # post: light painted metal
    fill(T, 0, 0, 256, 128, (0.36, 0.40, 0.46))       # foot plate
    img = save_jpeg("T_LanePost", T)
    pm = material("LanePost", rough=0.45, base_img=img)
    signm = material("SignFace", (0.86, 0.86, 0.86), 0.6)
    mats = [pm]
    RIM = (0.02, 0.52, 0.48, 0.98); POST = (0.52, 0.52, 0.98, 0.98); FOOT = (0.02, 0.02, 0.98, 0.48)
    parts = []
    p = Part("foot", mats)
    p.sweep((0, 0, 0), (0, 0, 0.03), [(0, 0.14, 0.14), (0.03, 0.14, 0.14)], 10, 0, FOOT, ref=(1, 0, 0),
            cap0="flat", cap1="flat")
    parts.append(p.finish())
    p = Part("pole", mats)
    p.sweep((0, 0, 0.02), (0, 0, 2.45), [(0, 0.05, 0.05), (2.43, 0.05, 0.05)], 10, 0, POST, ref=(1, 0, 0),
            cap0="flat", cap1="flat")
    parts.append(p.finish())
    # sign board: rounded square 1.32 m, 5 cm thick; its front is a rim around the 1.2 m SignFace hole
    p = Part("board", mats)
    zc, yc, th, half, rad = 1.9, 0.07, 0.05, 0.66, 0.1
    yf, yb = yc + th / 2, yc - th / 2
    outer = []
    for k, (cx, cz) in enumerate(((half - rad, half - rad), (-half + rad, half - rad),
                                  (-half + rad, -half + rad), (half - rad, -half + rad))):
        for i in range(3):
            a = math.pi / 2 * k + math.pi / 4 * i
            outer.append((cx + rad * math.cos(a), cz + rad * math.sin(a)))
    inner = [(0.6, 0.6), (-0.6, 0.6), (-0.6, -0.6), (0.6, -0.6)]

    def uvr(x, z):
        return (RIM[0] + (RIM[2] - RIM[0]) * (0.5 - x / 1.4), RIM[1] + (RIM[3] - RIM[1]) * (0.5 + z / 1.4))
    F = [p.v((x, yf, zc + z)) for x, z in outer]; B = [p.v((x, yb, zc + z)) for x, z in outer]
    I = [p.v((x, yf, zc + z)) for x, z in inner]
    for k in range(4):
        for i in range(2):
            o0, o1 = outer[3 * k + i], outer[3 * k + i + 1]
            p.face([I[k], F[3 * k + i], F[3 * k + i + 1]], [uvr(*inner[k]), uvr(*o0), uvr(*o1)])
        k1 = (k + 1) % 4
        p.face([I[k], F[3 * k + 2], F[3 * k1], I[k1]],
               [uvr(*inner[k]), uvr(*outer[3 * k + 2]), uvr(*outer[3 * k1]), uvr(*inner[k1])])
    p.face(list(reversed(B)), [uvr(*outer[i]) for i in reversed(range(12))])
    for i in range(12):
        i1 = (i + 1) % 12
        ua, ub = uvr(*outer[i]), uvr(*outer[i1])
        p.face([F[i], B[i], B[i1], F[i1]], [ua, (ua[0] + 0.02, ua[1] + 0.02), (ub[0] + 0.02, ub[1] + 0.02), ub])
    filler = p.face(I, [uvr(*c) for c in inner])     # temporary, closes the solid for the normal recalc
    parts.append(p.finish(drop_faces=[filler]))
    root = join("SM_LanePost", parts, 35)
    sf = sign_plane("SignFace", signm, 0.6, yf, zc - 0.6, zc + 0.6)
    sf.parent = root
    return root


root = {"arch": build_arch, "pontoon": build_pontoon, "post": build_post}[MODEL]()
# clean file: purge orphans, no cameras/lights
bpy.ops.outliner.orphans_purge(do_recursive=True)
# asset QA on the built (welded) meshes before export
sys.path.insert(0, r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts")
import json, qa_check
q = qa_check.run(objects=[o.name for o in bpy.data.objects if o.type == "MESH"], profile="game")
print("QA_PRE", json.dumps({k: q[k] for k in ("pass", "errors", "warnings")}))
name = root.name
path = os.path.join(OUT, name + ".glb")
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False,
                          export_draco_mesh_compression_enable=False, export_image_format="AUTO",
                          export_extras=False)
print("EXPORTED", path, os.path.getsize(path))
