"""N10 snowboard park rails and boxes: SM_Rail_Cane, SM_Box, SM_Rail_Rainbow, SM_FunBox.
Headless: blender -b --factory-startup -P rl_build.py -- <out_dir> <tex_dir> [<blend_out>]
Built LEVEL in glTF axes (+Y up, downhill +Z); B() maps glTF (x,y,z) -> Blender (x,-z,y).
Slide surfaces are exact over z = 0..L at x = 0; rounded ends overhang by the cap / bevel radius.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT, TEX = argv[0], argv[1]
BLEND = argv[2] if len(argv) > 2 else None
os.makedirs(OUT, exist_ok=True); os.makedirs(TEX, exist_ok=True)
TAU = 2 * math.pi


def B(gx, gy, gz):
    return Vector((gx, -gz, gy))


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb(r, g, b):
    return (lin(r), lin(g), lin(b))


# ---------------------------------------------------------------- textures (sRGB bytes -> JPEG q85)
def save_jpeg(name, arr):
    """arr: (H, W, 3) floats 0..1 sRGB, row 0 = bottom (v = 0)."""
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), np.float32); px[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(px.ravel())
    path = os.path.join(TEX, name + '.jpg')
    img.file_format = 'JPEG'
    try:
        img.save(filepath=path, quality=85)
    except TypeError:
        img.filepath_raw = path; img.save()
    bpy.data.images.remove(img)
    return path


def bands_1d(cols, widths, w=128, h=16, soft=1.0):
    """horizontal (u) stripe texture: cols sRGB 0..255, widths relative."""
    edges = np.cumsum([0] + list(widths)) / float(sum(widths))
    u = (np.arange(w) + 0.5) / w
    out = np.zeros((w, 3))
    for i, c in enumerate(cols):
        a, b = edges[i], edges[i + 1]
        s = soft / w
        cov = np.clip((u - a) / s + 0.5, 0, 1) * np.clip((b - u) / s + 0.5, 0, 1)
        out += cov[:, None] * (np.array(c) / 255.0)
    return np.repeat(out[None, :, :], h, axis=0)


def tex_candy():
    R, W = (214, 30, 45), (246, 242, 236)
    return save_jpeg('T_CandyStripe', bands_1d([R, W, R, W], [38, 24, 10, 28]))


def tex_rainbow():
    cols = [(230, 57, 70), (247, 140, 40), (250, 210, 50), (80, 190, 90), (60, 130, 230), (150, 80, 200)]
    return save_jpeg('T_RainbowRings', bands_1d(cols, [1] * 6, soft=2.0))


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def tex_funside():
    """side panel, 2.0 m x ~0.55 m per tile: green swag garland, bulbs, red bows at the tile seam, snow lip."""
    W, H = 512, 128
    LU, LV = 2.0, 0.55                      # metres per tile in u, v
    um = (np.arange(W) + 0.5) / W * LU
    vm = (np.arange(H) + 0.5) / H * LV
    U, V = np.meshgrid(um, vm)               # (H, W), row 0 = bottom
    px = LU / W
    rng = np.random.default_rng(7)
    bot, top = np.array((150, 185, 226)) / 255, np.array((206, 226, 246)) / 255
    t = (V / LV)[..., None]
    img = bot * (1 - t) + top * t
    # soft frosted dots on the panel
    n1 = rng.random((H, W))
    img += (n1[..., None] - 0.5) * 0.025

    def over(img, a, col):
        a = a[..., None]
        return img * (1 - a) + np.asarray(col, float) * a

    # snow lip along the top of the panel, wavy lower edge with drips
    wave = 0.505 - 0.012 * (1 + np.sin(U * 9.0)) * 0.5 - 0.010 * np.maximum(0, np.sin(U * 23 + 0.7)) ** 6
    a_lip = smooth((V - wave) / px + 0.5)
    img = over(img, a_lip, (0.91, 0.94, 0.98))

    # garland swag: centre line v = 0.45 - 0.17 sin(pi u / LU)
    vc = 0.44 - 0.20 * np.sin(np.pi * U / LU)
    dv = -0.20 * np.pi / LU * np.cos(np.pi * U / LU)
    d = (V - vc) / np.sqrt(1 + dv ** 2)          # signed perpendicular distance (m)
    rg = 0.046
    a_g = smooth((rg - np.abs(d)) / px + 0.5)
    needles = 0.5 + 0.5 * np.sin(U * 190 + np.sin(V * 90) * 2.0) * np.sin(V * 230 + U * 40)
    shade = 0.75 + 0.35 * np.clip(d / rg, -1, 1)
    g = np.stack([0.11 + 0.08 * needles, 0.40 + 0.16 * needles, 0.20 + 0.06 * needles], -1) * shade[..., None]
    img = over(img, a_g, 0) if False else img * (1 - a_g[..., None]) + g * a_g[..., None]
    # snow on the upper half of the garland
    sn = 0.5 + 0.5 * np.sin(U * 61) * np.cos(U * 23 + 1.3)
    a_s = smooth((d - (0.030 - 0.014 * sn)) / px) * a_g
    img = over(img, a_s * 0.95, (0.93, 0.95, 0.98))
    # bulbs along the swag
    cols = [(0.86, 0.12, 0.15), (0.98, 0.78, 0.20), (0.25, 0.50, 0.92), (0.98, 0.78, 0.20), (0.86, 0.12, 0.15)]
    for k, uu in enumerate([0.32, 0.66, 1.0, 1.34, 1.68]):
        vb = 0.44 - 0.20 * math.sin(math.pi * uu / LU) - 0.042
        r = np.hypot(U - uu, V - vb)
        a_b = smooth((0.023 - r) / px + 0.5)
        c = np.array(cols[k])
        hl = smooth((0.008 - np.hypot(U - uu + 0.006, V - vb - 0.006)) / px + 0.5)
        img = over(img, a_b, c * 0.85)
        img = over(img, hl * 0.8, (1, 1, 1) * 0.95 if False else (0.97, 0.96, 0.93))
    # bow at the tile seam (u = 0 == u = LU), centre v = 0.46
    du = ((U + LU / 2) % LU) - LU / 2
    cy = 0.445
    red, dark = np.array((0.80, 0.10, 0.13)), np.array((0.55, 0.05, 0.08))
    # tails
    for sgn in (-1, 1):
        # quad tail from knot down-out: param along tail
        p0 = np.array((0.0, cy)); p1 = np.array((sgn * 0.055, cy - 0.105))
        dvec = p1 - p0; L = np.linalg.norm(dvec); dn = dvec / L
        q = np.stack([du - p0[0], V - p0[1]], -1)
        along = q @ dn
        perp = np.abs(q @ np.array((-dn[1], dn[0])))
        wdt = 0.016 + 0.006 * np.clip(along / L, 0, 1)
        notch = np.clip(along / L, 0, 1) > 0.92
        a_t = smooth((wdt - perp) / px + 0.5) * smooth((L - along) / px + 0.5) * smooth(along / px)
        a_t = a_t * (~(notch & (perp < 0.006)))
        img = over(img, a_t, red * 0.92)
    # loops
    for sgn in (-1, 1):
        ex, ey = sgn * 0.046, cy + 0.008
        rr = np.sqrt(((du - ex) / 0.046) ** 2 + ((V - ey) / 0.030) ** 2)
        a_l = smooth((1 - rr) / (px / 0.035) + 0.5)
        inner = smooth((0.55 - rr) / (px / 0.035) + 0.5)
        img = over(img, a_l, red)
        img = over(img, inner * 0.85, dark)
        hl = smooth((0.35 - np.sqrt(((du - ex - sgn * 0.012) / 0.03) ** 2 + ((V - ey - 0.014) / 0.008) ** 2)) * 4)
        img = over(img, hl * 0.6, (0.98, 0.55, 0.55))
    rk = np.hypot(du, V - cy)
    img = over(img, smooth((0.016 - rk) / px + 0.5), red * 0.9)
    img = over(img, smooth((0.007 - np.hypot(du + 0.004, V - cy - 0.005)) / px + 0.5) * 0.6, (0.98, 0.6, 0.6))
    # darker snow-splash band at the very bottom
    a_bt = smooth((0.035 - V) / 0.02) * 0.5
    img = over(img, a_bt, (0.80, 0.87, 0.95))
    return save_jpeg('T_FunBoxSide', np.clip(img, 0, 1))


# ---------------------------------------------------------------- materials
def mat(name, col=(1, 1, 1), rough=0.5, metal=0.0, tex=None):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*col, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if tex:
        img = bpy.data.images.load(tex)
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img; tn.interpolation = 'Linear'
        tn.extension = 'REPEAT'
        nt.links.new(tn.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    return m


# ---------------------------------------------------------------- mesh builder (glTF coords)
class MB:
    def __init__(s):
        s.V, s.F = [], []

    def v(s, p):
        s.V.append(tuple(float(c) for c in p)); return len(s.V) - 1

    def f(s, idx, m, uv=None):
        s.F.append((list(idx), m, uv))


def box_uv(face, uvl, scale=0.5):
    n = face.normal
    ax = max(range(3), key=lambda i: abs(n[i]))
    for l in face.loops:
        co = l.vert.co
        if ax == 0:
            l[uvl].uv = (co.y * scale, co.z * scale)
        elif ax == 1:
            l[uvl].uv = (co.x * scale, co.z * scale)
        else:
            l[uvl].uv = (co.x * scale, co.y * scale)


def mb_to_bm(mb, bm=None):
    bm = bm or bmesh.new()
    uvl = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    base = len(bm.verts)
    bv = [bm.verts.new(B(*p)) for p in mb.V]
    bm.verts.ensure_lookup_table()
    newf = []
    for idx, m, uv in mb.F:
        face = bm.faces.new([bv[i] for i in idx])
        face.material_index = m; face.smooth = True
        newf.append((face, uv))
    bm.normal_update()
    for face, uv in newf:
        if uv:
            for l, t in zip(face.loops, uv):
                l[uvl].uv = t
        else:
            box_uv(face, uvl)
    return bm


def finish(name, bm, mats, sharp_deg=35.0):
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    try:
        me.set_sharp_from_angle(angle=math.radians(sharp_deg))
    except Exception as e:
        print('sharp_from_angle failed', e)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tube(mb, T, Tt, r, nside, m, ufun, Mcap=3):
    """Round bar whose TOP line (x = 0) passes exactly through the points T (glTF yz-plane curve).
    T: (n,3) top points, Tt: (n,3) unit tangents. Centre = T - r * up-normal. Rounded caps beyond both ends."""
    X = np.array((1.0, 0, 0))
    Nn = np.array([np.cross(t, X) for t in Tt])       # up normal in the yz plane: t x X
    Nn = Nn / np.linalg.norm(Nn, axis=1)[:, None]
    for i in range(len(Nn)):
        if Nn[i][1] < 0:
            Nn[i] = -Nn[i]
    C = T - r * Nn
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
    phis = [TAU * k / nside for k in range(nside + 1)]

    def ring(c, n, rad, back):
        return [mb.v(c + rad * (math.cos(p) * n + math.sin(p) * X) + back) for p in phis[:-1]]

    rings, ss = [], []
    # start cap rings (pole first)
    capS, capE = [], []
    for mm in range(Mcap - 1, 0, -1):
        a = (math.pi / 2) * mm / Mcap
        capS.append((ring(C[0], Nn[0], r * math.cos(a), -r * math.sin(a) * Tt[0]), s[0] - r * math.sin(a)))
    body = [(ring(C[j], Nn[j], r, 0 * X), s[j]) for j in range(len(C))]
    for mm in range(1, Mcap):
        a = (math.pi / 2) * mm / Mcap
        capE.append((ring(C[-1], Nn[-1], r * math.cos(a), r * math.sin(a) * Tt[-1]), s[-1] + r * math.sin(a)))
    seq = capS + body + capE
    for (ra, sa), (rb, sb) in zip(seq[:-1], seq[1:]):
        for k in range(nside):
            k1 = (k + 1) % nside
            pa, pb = phis[k], phis[k + 1]
            idx = [ra[k], ra[k1], rb[k1], rb[k]]
            uv = [(ufun(sa, pa), pa / TAU), (ufun(sa, pb), pb / TAU), (ufun(sb, pb), pb / TAU), (ufun(sb, pa), pa / TAU)]
            mb.f(idx, m, uv)
    # poles
    for (rg, sr), c, t, sgn in ((seq[0], C[0], Tt[0], -1), (seq[-1], C[-1], Tt[-1], 1)):
        sp = (s[0] - r) if sgn < 0 else (s[-1] + r)
        pole = mb.v(c + sgn * r * t)
        for k in range(nside):
            k1 = (k + 1) % nside
            pa, pb = phis[k], phis[k + 1]; pm = 0.5 * (pa + pb)
            mb.f([rg[k], rg[k1], pole], m, [(ufun(sr, pa), pa / TAU), (ufun(sr, pb), pb / TAU), (ufun(sp, pm), pm / TAU)])


def lathe(mb, x0, z0, prof, nside, m, rmul=None, phase=0.0):
    """vertical lathe around (x0, z0); prof: [(radius, y)] bottom -> top, open ends."""
    rows = []
    for i, (rad, y) in enumerate(prof):
        row = []
        for k in range(nside):
            p = TAU * k / nside + phase
            rr = rad * (rmul(p, i) if rmul else 1.0)
            row.append(mb.v((x0 + rr * math.cos(p), y, z0 + rr * math.sin(p))))
        rows.append(row)
    for a, b in zip(rows[:-1], rows[1:]):
        for k in range(nside):
            k1 = (k + 1) % nside
            mb.f([a[k], a[k1], b[k1], b[k]], m)


def slab_bm(hw, zs, Hf, ybot, close_bottom, close_top=True, bevel=0.0, segs=3):
    """box-like extrusion along z with top height Hf(z); bevels edges sharper than 30 deg (not open borders)."""
    mb = MB()
    rows = []
    for z in zs:
        h = Hf(z)
        rows.append([mb.v((-hw, ybot, z)), mb.v((-hw, h, z)), mb.v((hw, h, z)), mb.v((hw, ybot, z))])
    for a, b in zip(rows[:-1], rows[1:]):
        mb.f([a[0], b[0], b[1], a[1]], 0)          # left (-x)
        if close_top:
            mb.f([a[1], b[1], b[2], a[2]], 0)      # top
        mb.f([a[2], b[2], b[3], a[3]], 0)          # right
        if close_bottom:
            mb.f([a[3], b[3], b[0], a[0]], 0)
    mb.f([rows[0][3], rows[0][2], rows[0][1], rows[0][0]], 0)
    mb.f(list(rows[-1]), 0)
    bm = mb_to_bm(mb)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(30)]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, offset_type='OFFSET', segments=segs, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
    bm.normal_update()
    return bm


def g_of(co):
    """Blender co -> glTF (x, y, z)."""
    return co.x, co.z, -co.y


# ---------------------------------------------------------------- models
def build_cane(M):
    L, r, top = 13.0, 0.06, 0.5
    mb = MB()
    zs = np.linspace(0, L, 5)
    T = np.array([(0, top, z) for z in zs]); Tt = np.array([(0, 0, 1.0)] * len(zs))
    pitch = 0.36
    tube(mb, T, Tt, r, 16, 0, lambda s, p: s / pitch + p / TAU, Mcap=3)
    yc = top - r
    post = [(0.09, -0.05), (0.09, 0.01), (0.045, 0.085), (0.045, 0.305), (0.085, 0.325), (0.085, 0.355),
            (0.035, 0.372), (0.035, yc + 0.012)]
    for zp in (1.0, 6.5, 12.0):
        lathe(mb, 0, zp, post, 12, 1)
    snow = [(0.093, 0.334), (0.118, 0.346), (0.136, 0.368), (0.130, 0.396), (0.102, 0.421), (0.05, 0.436)]
    lump = lambda p, i: 1.0 if i == len(snow) - 1 else 1 + 0.05 * (1 + math.sin(3 * p + 0.5)) + 0.03 * (1 + math.cos(5 * p))
    for zp in (1.0, 12.0):
        lathe(mb, 0, zp, snow, 12, 2, rmul=lump)
    bm = mb_to_bm(mb)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish('SM_Rail_Cane', bm, [M['CandyStripe'], M['PostMetal'], M['Snow']])


def build_rainbow(M):
    L, r, base, amp = 14.0, 0.06, 0.45, 1.0
    mb = MB()
    zs = np.linspace(0, L, 33)
    k = math.pi / L
    T = np.array([(0, base + amp * math.sin(k * z), z) for z in zs])
    Tt = np.array([(0, amp * k * math.cos(k * z), 1.0) for z in zs])
    Tt = Tt / np.linalg.norm(Tt, axis=1)[:, None]
    period = 1.2                                    # 6 colour rings of 0.2 m each, rings go ACROSS the bar
    tube(mb, T, Tt, r, 12, 0, lambda s, p: s / period, Mcap=3)
    for zp in (1.4, 4.2, 7.0, 9.8, 12.6):
        ytop = base + amp * math.sin(k * zp) - r
        lathe(mb, 0, zp, [(0.075, -0.05), (0.04, 0.045), (0.034, ytop)], 10, 1)
    bm = mb_to_bm(mb)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish('SM_Rail_Rainbow', bm, [M['RainbowStripe'], M['PostMetal']])


def build_box(M):
    L, hw, top = 13.0, 0.35, 0.42
    bev = 0.03
    deck = slab_bm(hw, [-bev, L + bev], lambda z: top, top - 0.08, True, bevel=bev, segs=4)
    for f in deck.faces:
        ys = [g_of(v.co)[1] for v in f.verts]
        f.material_index = 0 if (f.normal.z > 0.999 and min(ys) > top - 1e-5) else 1
    basew = 0.29
    base = slab_bm(basew, [0.25, L - 0.25], lambda z: top - 0.055, -0.05, False, close_top=False, bevel=0.02, segs=2)
    for f in base.faces:
        f.material_index = 2
    return finish('SM_Box', merge_bms(deck, base), [M['BoxPurple'], M['BoxYellow'], M['BoxBase']])


def merge_bms(*bms):
    tmp = []
    for b in bms:
        me = bpy.data.meshes.new('tmp_merge'); b.to_mesh(me); b.free(); tmp.append(me)
    out = bmesh.new()
    for me in tmp:
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
    return out


def fun_profile(z):
    """top height: 0.5 flat, cosine ramp up over z 1..3 to 0.6, flat 0.6 over 3..9, cosine down 9..11, flat 0.5 to 12."""
    if z <= 1.0 or z >= 11.0:
        return 0.5
    if z < 3.0:
        return 0.5 + 0.05 * (1 - math.cos(math.pi * (z - 1.0) / 2.0))
    if z <= 9.0:
        return 0.6
    return 0.5 + 0.05 * (1 - math.cos(math.pi * (11.0 - z) / 2.0))


def build_funbox(M):
    L, hw, bev = 12.0, 0.8, 0.04
    zs = [-bev, 1.0] + [1.0 + 2.0 * i / 8 for i in range(1, 9)] + [6.0] + [9.0 + 2.0 * i / 8 for i in range(0, 9)] + [L + bev]
    bm = slab_bm(hw, zs, fun_profile, -0.05, False, bevel=bev, segs=4)
    uvl = bm.loops.layers.uv.active
    for f in bm.faces:
        gs = [g_of(v.co) for v in f.verts]
        n = f.normal
        if n.z > 0.95 and all(abs(g[0]) < hw - bev + 1e-4 for g in gs) and \
                all(abs(g[1] - fun_profile(min(max(g[2], 0), L))) < 1e-4 for g in gs):
            f.material_index = 0                                   # top
        elif abs(n.x) > 0.999:
            f.material_index = 1                                   # side panel (garland)
            for l in f.loops:
                gx, gy, gz = g_of(l.vert.co)
                hs = fun_profile(min(max(gz, 0), L)) - bev
                l[uvl].uv = (gz / 2.0, (gy + 0.05) / (hs + 0.05))
        elif abs(n.y) > 0.999:
            f.material_index = 1                                   # end face: plain lower band of the panel
            for l in f.loops:
                gx, gy, gz = g_of(l.vert.co)
                l[uvl].uv = (0.5 + gx * 0.12, 0.04 + (gy + 0.05) * 0.4)
        else:
            f.material_index = 2                                   # snowy rounded trim
    return finish('SM_FunBox', bm, [M['FunTop'], M['FunSide'], M['FunTrim']])


def main():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for d in list(coll):
            coll.remove(d)
    t_c, t_r, t_f = tex_candy(), tex_rainbow(), tex_funside()
    M = {
        'CandyStripe': mat('CandyStripe', rough=0.35, tex=t_c),
        'PostMetal': mat('PostMetal', srgb(178, 192, 212), rough=0.35, metal=0.9),
        'Snow': mat('Snow', srgb(232, 240, 250), rough=0.8),
        'RainbowStripe': mat('RainbowStripe', rough=0.35, tex=t_r),
        'BoxPurple': mat('BoxPurple', srgb(118, 58, 190), rough=0.45),
        'BoxYellow': mat('BoxYellow', srgb(250, 200, 40), rough=0.45),
        'BoxBase': mat('BoxBase', srgb(84, 52, 150), rough=0.6),
        'FunTop': mat('FunTop', srgb(200, 38, 48), rough=0.45),
        'FunSide': mat('FunSide', rough=0.6, tex=t_f),
        'FunTrim': mat('FunTrim', srgb(232, 240, 250), rough=0.8),
    }
    obs = [build_cane(M), build_box(M), build_rainbow(M), build_funbox(M)]
    for ob in obs:
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print('BUILT', ob.name, 'tris', tris, 'dims', tuple(round(d, 3) for d in ob.dimensions))
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True); bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUT, ob.name + '.glb')
        kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                  export_cameras=False, export_lights=False, export_texcoords=True, export_normals=True,
                  export_tangents=False, export_materials='EXPORT', export_image_format='AUTO',
                  export_draco_mesh_compression_enable=False, export_vertex_color='NONE',
                  export_all_vertex_colors=False, export_animations=False)
        for bad in range(6):
            try:
                bpy.ops.export_scene.gltf(**kw); break
            except TypeError as e:
                msg = str(e); key = msg.split('"')[1] if '"' in msg else None
                print('drop kw', key, msg)
                if key in kw:
                    kw.pop(key)
                else:
                    raise
        print('EXPORTED', path, os.path.getsize(path))
    if BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)


main()
