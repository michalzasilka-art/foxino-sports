# Ice cave props (lane D, job W2): lanterns, ice ledge, ice lip sides, ice bridge.
# Run inside Blender 5.2 (live MCP: exec(open(path).read())) or headless with -P.
# Game space: +Y up, run along +Z (downhill). Blender: build along -Y, +Z up -> G(x, y, z).
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, noise as mnoise

SCR = os.environ.get("ICECAVE_D_TMP", r"C:\Users\micha\AppData\Local\Temp\claude\c036e47f4ddc8e51\5ce5d967-04ae-47cb-9336-95ea1785f125\scratchpad\icecave_d")
os.makedirs(SCR, exist_ok=True)
SCENE = "IceProps_D"
COLL = "IceProps_D"


def G(x, y, z):
    return Vector((x, -z, y))


def nz(p, seed, freq=1.0):
    return mnoise.noise(Vector(p) * freq + Vector((seed * 17.31, seed * 5.77, seed * 11.13)))


# ------------------------------------------------------------------ scene
def setup_scene():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    try:
        bpy.context.window.scene = sc
    except Exception:
        pass
    for ob in list(sc.collection.all_objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    return sc


# ------------------------------------------------------------------ textures
def periodic_noise(n, lo, hi, beta, seed):
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((n, n))
    f = np.fft.fftfreq(n) * n
    fr = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2)
    filt = np.where((fr >= lo) & (fr <= hi), 1.0 / np.maximum(fr, 1.0) ** beta, 0.0)
    h = np.real(np.fft.ifft2(np.fft.fft2(w) * filt))
    return (h - h.mean()) / (h.std() + 1e-9)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx, ny, nzz = -dx, -dy, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nzz * nzz)
    return np.stack([nx / ln * .5 + .5, ny / ln * .5 + .5, nzz / ln * .5 + .5], -1)


def make_image(name, rgb, noncolor, fmt='PNG'):
    n = rgb.shape[0]
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    img = bpy.data.images.new(name, n, n, alpha=False)
    if noncolor:
        img.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([rgb, np.ones((n, n, 1))], -1).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    ext = '.png' if fmt == 'PNG' else '.jpg'
    img.filepath_raw = os.path.join(SCR, name + ext)
    img.file_format = fmt
    if fmt == 'JPEG':
        img.save(quality=90)
    else:
        img.save()
    img.source = 'FILE'
    img.reload()
    return img


def textures():
    n = 512
    # ice: soft ripples + a few faint frost streaks
    h = periodic_noise(n, 2, 10, 1.2, 11) * 1.0 + periodic_noise(n, 20, 60, 1.0, 12) * 0.25
    ice_n = make_image("T_Ice_N", normal_from_height(h, 2.2), True, 'JPEG')
    # ice colour: deep blue to bright cyan clouds, faint frosty flecks (values are sRGB bytes)
    t = periodic_noise(n, 1, 7, 1.3, 13)
    t = np.clip(t * 0.32 + 0.5, 0, 1)[..., None]
    deep, bright = np.array((0.16, 0.50, 0.76)), np.array((0.52, 0.86, 0.97))
    col = deep * (1 - t) + bright * t
    fr = periodic_noise(n, 25, 90, 0.6, 14)
    frost = np.clip((fr - 1.6) * 0.6, 0, 0.55)[..., None]
    col = col * (1 - frost) + np.array((0.84, 0.94, 0.99)) * frost
    ice_c = make_image("T_Ice_C", col, False, 'JPEG')
    # rock: chunky bumps + grain
    h = periodic_noise(n, 3, 24, 1.4, 21) + periodic_noise(n, 30, 120, 0.8, 22) * 0.35
    rock_n = make_image("T_Rock_N", normal_from_height(h, 3.0), True, 'JPEG')
    # lantern palette 8x8: left half metal, right half rock
    pal = np.zeros((8, 8, 3))
    pal[:, :4] = (0.50, 0.30, 0.15)    # warm bronze (sRGB-ish values written as bytes)
    pal[:, 4:] = (0.36, 0.40, 0.46)
    pal_c = make_image("T_Lantern_C", pal, False)
    mr = np.zeros((8, 8, 3))
    mr[:, :4] = (0.0, 0.38, 0.75)     # G = roughness, B = metallic
    mr[:, 4:] = (0.0, 0.70, 0.0)
    pal_mr = make_image("T_Lantern_MR", mr, True)
    return ice_n, ice_c, rock_n, pal_c, pal_mr


# ------------------------------------------------------------------ materials
def _mat(name):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    return m, nt, b


def pbr(name, base, rough, metal=0.0, nimg=None, nstr=1.0, emit=None, estr=0.0, cimg=None):
    m, nt, b = _mat(name)
    b.inputs['Base Color'].default_value = (*base, 1)
    if cimg:
        tc = nt.nodes.new('ShaderNodeTexImage')
        tc.image = cimg
        nt.links.new(tc.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if nimg:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = nimg
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = nstr
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = estr
    m.diffuse_color = (*base, 1)
    return m


def palette_mat(name, cimg, mrimg):
    m, nt, b = _mat(name)
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = cimg
    t.interpolation = 'Closest'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    t2 = nt.nodes.new('ShaderNodeTexImage')
    t2.image = mrimg
    t2.interpolation = 'Closest'
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(t2.outputs['Color'], sep.inputs[0])
    nt.links.new(sep.outputs[1], b.inputs['Roughness'])
    nt.links.new(sep.outputs[2], b.inputs['Metallic'])
    m.diffuse_color = (0.5, 0.3, 0.15, 1)
    return m


# ------------------------------------------------------------------ mesh builder
class MB:
    def __init__(s):
        s.bm = bmesh.new()
        s.uv = s.bm.loops.layers.uv.new('UVMap')

    def v(s, co):
        return s.bm.verts.new(co)

    def f(s, vs, uvs, mat=0):
        face = s.bm.faces.new(vs)
        face.material_index = mat
        for l, uv in zip(face.loops, uvs):
            l[s.uv].uv = uv
        return face

    def tube(s, rings, us, vs, closed, matfn=lambda i, j: 0):
        n = len(rings[0])
        m = n if closed else n - 1
        for j in range(len(rings) - 1):
            for i in range(m):
                i2 = (i + 1) % n
                s.f([rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]],
                    [(us[j][i], vs[j]), (us[j][i + 1], vs[j]), (us[j + 1][i + 1], vs[j + 1]), (us[j + 1][i], vs[j + 1])],
                    matfn(i, j))

    def cap(s, ring, mat=0, uvbox=None, axes=(0, 1), scale=0.5):
        a0, a1 = axes
        if uvbox:
            uvs = [uvbox(i) for i in range(len(ring))]
        else:
            uvs = [(v.co[a0] * scale, v.co[a1] * scale) for v in ring]
        face = s.f(ring, uvs, mat)
        res = bmesh.ops.triangulate(s.bm, faces=[face], quad_method='BEAUTY', ngon_method='BEAUTY')
        return res

    def fan(s, ring, apex_co, uv_ring, uv_apex, mat=0):
        a = s.v(apex_co)
        n = len(ring)
        for i in range(n):
            i2 = (i + 1) % n
            s.f([ring[i], ring[i2], a], [uv_ring[i], uv_ring[i + 1], uv_apex], mat)

    def finish(s, name, mats, smooth_angle, coll):
        bm = s.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for f in bm.faces:
            f.smooth = True
        for e in bm.edges:
            if len(e.link_faces) == 2:
                e.smooth = e.calc_face_angle(0.0) <= math.radians(smooth_angle)
        me = bpy.data.meshes.get(name)
        if me:
            bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for m in mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        return ob


def ring_us(pts, tile=2.0, closed=True):
    seq = list(pts) + ([pts[0]] if closed else [])
    us, acc = [0.0], 0.0
    for a, b in zip(seq[:-1], seq[1:]):
        acc += (Vector(b) - Vector(a)).length
        us.append(acc / tile)
    return us if closed else us


# ------------------------------------------------------------------ SM_IceLedge
def build_ledge(coll, M_ICE, M_ROCK):
    mb = MB()
    # ice block profile (game x, y), loop
    def ice_profile(z, bul):
        r = [(0.385, 0.5), (0.3956, 0.4956), (0.4, 0.485), (0.43 + bul[0], 0.40), (0.452 + bul[1], 0.30),
             (0.438 + bul[2], 0.20), (0.39, 0.12)]
        left = [(-x, y) for (x, y) in reversed(r)]
        return r + [(0.0, 0.09)] + left        # 15 pts, closed loop
    zs_mid = [float(z) for z in range(1, 12)]
    r = 0.025
    zs = [(0.0, r), (r - r * math.cos(math.radians(45)), r - r * math.sin(math.radians(45))), (r, 0.0)] + \
         [(z, 0.0) for z in zs_mid] + \
         [(12 - r, 0.0), (12 - (r - r * math.cos(math.radians(45))), r - r * math.sin(math.radians(45))), (12.0, r)]
    rings, us, vs = [], [], []
    for z, inset in zs:
        bul = [0.018 * nz((z * 0.45, k * 0.7, 0), 1) + 0.01 for k in range(3)]
        prof = ice_profile(z, bul)
        c = Vector((0.0, 0.3))
        pts = []
        for (x, y) in prof:
            p = Vector((x, y))
            if inset > 0:
                p = p + (c - p).normalized() * inset
            pts.append(p)
        rings.append([mb.v(G(p.x, p.y, z)) for p in pts])
        us.append(ring_us([tuple(p) for p in pts], 1.5))
        vs.append(z / 1.5)
    mb.tube(rings, us, vs, True, lambda i, j: 0)
    mb.cap(rings[0], 0, axes=(0, 2), scale=1 / 1.5)
    mb.cap(list(reversed(rings[-1])), 0, axes=(0, 2), scale=1 / 1.5)
    # rock ledge: open strip (floor to floor), rows along z
    def rock_profile(z, k):
        w = 1.0 + 0.07 * nz((z * 0.5, 0, 0), 2)
        h = 1.0 + 0.10 * nz((z * 0.6, 3, 0), 3)
        r_ = [(0.72, 0.0), (0.77, 0.08), (0.71, 0.17), (0.58, 0.25), (0.41, 0.29), (0.2, 0.305)]
        out = []
        for i, (x, y) in enumerate(r_):
            jx = 0.035 * nz((z * 0.9, i * 1.3, 0), 4) if i > 0 else 0.02 * nz((z, 0, 0), 9)
            jy = 0.025 * nz((z * 0.9, i * 1.3, 5), 5) if i > 0 else 0.0
            out.append((x * w + jx, max(0.0, y * h + jy)))
        left = [(-x, y) for (x, y) in reversed(out)]
        return out + [(0.0, 0.31 * h)] + left   # right floor -> top -> left floor
    rows = [(-0.30, 0.45, 0.45), (-0.17, 0.80, 0.82)] + [(z, 1.0, 1.0) for z in np.arange(0.1, 11.95, 0.74)] + \
           [(12.17, 0.80, 0.82), (12.30, 0.45, 0.45)]
    rings, us, vs = [], [], []
    for z, sx, sy in rows:
        prof = rock_profile(z, 0)
        pts = [(x * sx, y * sy) for (x, y) in prof]
        rings.append([mb.v(G(x, y, z)) for (x, y) in pts])
        us.append(ring_us(pts, 1.5, closed=False))
        vs.append(z / 1.5)
    mb.tube(rings, us, vs, False, lambda i, j: 1)
    mb.cap(rings[0], 1, axes=(0, 2), scale=1 / 1.5)
    mb.cap(list(reversed(rings[-1])), 1, axes=(0, 2), scale=1 / 1.5)
    return mb.finish("SM_IceLedge", [M_ICE, M_ROCK], 35, coll)


# ------------------------------------------------------------------ SM_IceLip_Sides
def build_lip(coll, M_ICE, M_ROCK):
    mb = MB()
    UV = [(0, 0), (0, .5), (.025, .82), (.1, .96), (.23, 1), (.42, .98), (.6, .9), (.78, .72), (.9, .48), (.97, .22), (1, 0)]
    def h_of(z):
        return 0.4 + 1.25 * (max(0.0, min(z, 4.0)) / 4.0) ** 1.4
    rows = [(0.0, 0.55, 0.85), (0.12, 0.92, 0.96)] + [(z, 1, 1) for z in np.arange(0.35, 3.66, 0.25)] + \
           [(3.78, 1.0, 0.99), (3.90, 0.90, 0.94), (3.97, 0.68, 0.84), (4.0, 0.40, 0.66)]
    for side in (1, -1):
        rings, us, vs, icecut = [], [], [], []
        for j, (z, hs, ws) in enumerate(rows):
            h = h_of(z) * hs
            wout = (1.0 + 0.45 * (h_of(z) / 1.6)) * ws
            pts = []
            for i, (u, v) in enumerate(UV):
                x = 2.1 + u * wout
                y = v * h
                if 0 < i < len(UV) - 1:
                    x += 0.06 * nz((z * 0.8, i * 0.9, side), 6) * min(1.0, u * 8)
                    y += 0.05 * nz((z * 0.8, i * 0.9, side + 3), 7) * (1 if i > 1 else 0.5)
                x = max(2.1, x)
                y = max(0.0, y)
                pts.append((x, y))
            rings.append([mb.v(G(side * x, y, z)) for (x, y) in pts])
            us.append(ring_us(pts, 1.5, closed=False))
            vs.append(z / 1.5)
            icecut.append(7)
        def matfn(i, j, icecut=icecut):
            return 0 if 1 <= i < icecut[j] else 1
        if side == 1:
            mb.tube(rings, us, vs, False, matfn)
        else:
            mb.tube(rings, us, vs, False, matfn)
        mb.cap(rings[0], 0, axes=(0, 2), scale=1 / 1.5)
        mb.cap(list(reversed(rings[-1])), 0, axes=(0, 2), scale=1 / 1.5)
    return mb.finish("SM_IceLip_Sides", [M_ICE, M_ROCK], 35, coll)


# ------------------------------------------------------------------ SM_IceBridge
PROF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25), (4.95, 4.95),
        (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]


def wall_in(i):
    a = Vector(PROF[max(i - 1, 0)])
    b = Vector(PROF[min(i + 1, len(PROF) - 1)])
    t = (b - a).normalized()
    return Vector((-t.y, t.x))


def build_bridge(coll, M_ICE):
    mb = MB()
    yu = lambda x: 5.2 - 0.58 * (abs(x) / 5.3) ** 1.7
    half = []   # (I, O, depth) from centre outwards
    for x in [0.0, 1.1, 2.2, 3.2, 4.1, 4.8, 5.3]:
        half.append((Vector((x, yu(x))), Vector((x, yu(x) + 0.50 + 1.0 * (x / 5.3) ** 2.2)), 1.1 + 0.4 * (x / 5.3) ** 2))
    half += [(Vector((5.9, 4.63)), Vector((6.1, 5.35)), 1.45),
             (Vector((6.53, 4.63)), Vector((6.95, 5.0)), 1.40),
             (Vector((6.53, 4.0)), Vector((7.0, 4.05)), 1.30)]
    for i, d in [(4, 1.22), (3, 1.12), (2, 1.02), (1, 0.94)]:
        P = Vector(PROF[i])
        n = wall_in(i)
        half.append((P + n * 0.13, P - n * 0.25, d))
    half.append((Vector((7.88, 0.0)), Vector((8.25, 0.0)), 0.86))
    path = [(Vector((-I.x, I.y)), Vector((-O.x, O.y)), d) for (I, O, d) in reversed(half[1:])] + half
    N = 10
    f = lambda c: math.copysign(abs(c) ** 0.85, c)
    rings, us, vs = [], [], []
    acc, prev = 0.0, None
    for k, (I, O, d) in enumerate(path):
        mid = (I + O) / 2
        if prev is not None:
            acc += (mid - prev).length
        prev = mid
        zc = d / 2 + 0.14 * (nz((mid.x * 0.5, mid.y * 0.5, 0), 10) + 1) / 2
        pts = []
        for q in range(N):
            th = 2 * math.pi * q / N
            a = 0.5 - 0.5 * f(math.cos(th))         # 0 at I, 1 at O
            p2 = I + (O - I) * a
            z = zc + 0.5 * d * f(math.sin(th))
            lump = 0.06 * nz((p2.x * 0.8, p2.y * 0.8, z * 0.8), 11)
            p2 = p2 + (O - I).normalized() * lump
            z = max(0.0, z + 0.03 * nz((p2.x, p2.y, z), 12))
            x, y = p2.x, max(0.0, p2.y)
            if abs(x) < 6.5 and y < 4.6:
                y = 4.6
            pts.append((x, y, z))
        rings.append([mb.v(G(*p)) for p in pts])
        per = [Vector((p[0], p[1], p[2])) for p in pts]
        u = [0.0]
        for a_, b_ in zip(per, per[1:] + per[:1]):
            u.append(u[-1] + (b_ - a_).length / 1.5)
        us.append(u)
        vs.append(acc / 1.5)
    mb.tube(rings, us, vs, True)
    mb.cap(rings[0], 0, axes=(0, 1), scale=1 / 1.5)
    mb.cap(list(reversed(rings[-1])), 0, axes=(0, 1), scale=1 / 1.5)
    # drips under the arch
    rnd = random.Random(7)
    for x, zf in [(-3.9, .55), (-2.6, .35), (-1.3, .7), (-0.2, .45), (1.0, .62), (2.3, .4), (3.6, .66)]:
        top = yu(x)
        L = max(0.10, min(0.36, top - 4.63) * rnd.uniform(0.8, 1.0))
        d = 1.15 + 0.3 * (x / 5.3) ** 2
        zc = d * zf
        rb, S = 0.075 * rnd.uniform(0.85, 1.2), 6
        base = [mb.v(G(x + rb * math.cos(2 * math.pi * q / S), top + 0.07, zc + rb * math.sin(2 * math.pi * q / S))) for q in range(S)]
        midr = [mb.v(G(x + 0.55 * rb * math.cos(2 * math.pi * q / S + .3), top - 0.45 * L, zc + 0.55 * rb * math.sin(2 * math.pi * q / S + .3))) for q in range(S)]
        uq = [q / S for q in range(S + 1)]
        mb.tube([base, midr], [uq, uq], [0.0, 0.3], True)
        mb.fan(midr, G(x, top - L, zc), [(uq[q], 0.3) for q in range(S + 1)], (0.5, 0.5))
    ob = mb.finish("SM_IceBridge", [M_ICE], 35, coll)
    dy = max(v.co.y for v in ob.data.vertices)      # uphill face exactly at game z = 0
    for v in ob.data.vertices:
        v.co.y -= dy
    return ob


# ------------------------------------------------------------------ lanterns
def lathe(mb, prof, segs, ox=0.0, oy=0.0, oz=0.0, ucell=(0.0, 1.0), jitter=None, rot=0.0):
    rings, us, vs = [], [], []
    tot = sum((Vector(b) - Vector(a)).length for a, b in zip(prof[:-1], prof[1:])) or 1.0
    acc = 0.0
    for j, (r, z) in enumerate(prof):
        if j:
            acc += (Vector(prof[j]) - Vector(prof[j - 1])).length
        ring = []
        for q in range(segs):
            a = 2 * math.pi * q / segs + rot
            rr, zz = r, z
            if jitter:
                rr += jitter * r * nz((math.cos(a) * 2, math.sin(a) * 2, z * 4), 13 + j)
                zz += jitter * 0.3 * nz((math.cos(a) * 2, math.sin(a) * 2, z * 4), 23 + j)
            ring.append(mb.v((ox + rr * math.cos(a), oy + rr * math.sin(a), oz + zz)))
        rings.append(ring)
        u0, u1 = ucell
        us.append([u0 + (u1 - u0) * q / segs for q in range(segs + 1)])
        vs.append(0.08 + 0.84 * acc / tot)
    return rings, us, vs


MET, ROCKC = (0.10, 0.40), (0.60, 0.90)   # palette cells (u range)


def lantern_body(mb, z0):
    """Lantern frame (palette metal cell) with its base at z0. Returns glow builder args."""
    S = 10
    cap_uv = lambda ring, cell: (lambda i: (cell[0] + (cell[1] - cell[0]) * (0.5 + 0.5 * math.cos(2 * math.pi * i / len(ring))),
                                            0.5 + 0.4 * math.sin(2 * math.pi * i / len(ring))))
    # base
    r, u, v = lathe(mb, [(0.15, 0.0), (0.156, 0.03), (0.12, 0.055)], S, oz=z0, ucell=MET)
    mb.tube(r, u, v, True)
    mb.cap(list(reversed(r[0])), 0, uvbox=cap_uv(r[0], MET))
    mb.cap(r[-1], 0, uvbox=cap_uv(r[-1], MET))
    # roof
    r, u, v = lathe(mb, [(0.15, 0.32), (0.158, 0.345), (0.05, 0.44)], S, oz=z0, ucell=MET)
    mb.tube(r, u, v, True)
    mb.cap(list(reversed(r[0])), 0, uvbox=cap_uv(r[0], MET))
    mb.fan(r[-1], (0, 0, z0 + 0.5), [(u_, 0.85) for u_ in u[-1]], (0.25, 0.92))
    # 4 bars
    w = 0.008
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        c, s_ = math.cos(a), math.sin(a)
        rad, tan = Vector((c, s_, 0)), Vector((-s_, c, 0))
        ctr = rad * 0.126
        rings = []
        for zz in (z0 + 0.045, z0 + 0.33):
            rings.append([mb.v(ctr + rad * dr + tan * dt + Vector((0, 0, zz))) for dr, dt in ((-w, -w), (w, -w), (w, w), (-w, w))])
        uq = [MET[0] + (MET[1] - MET[0]) * q / 4 for q in range(5)]
        mb.tube(rings, [uq, uq], [0.1, 0.9], True)
    # handle ring (vertical, XZ plane)
    R, zc, tw = 0.05, z0 + 0.54, 0.008
    rings = []
    for q in range(6):
        phi = 2 * math.pi * q / 6 + math.pi / 2
        radial = Vector((math.cos(phi), 0, math.sin(phi)))
        C = Vector((0, 0, zc)) + radial * R
        rings.append([mb.v(C + radial * dr + Vector((0, dy, 0))) for dr, dy in ((-tw, -tw), (tw, -tw), (tw, tw), (-tw, tw))])
    rings.append(rings[0])
    uq = [MET[0] + (MET[1] - MET[0]) * q / 4 for q in range(5)]
    mb.tube(rings, [uq] * 7, [0.1 + 0.8 * q / 6 for q in range(7)], True)


def glow_obj(name, z0, coll, M_GLOW, parent):
    mb = MB()
    r, u, v = lathe(mb, [(0.10, 0.05), (0.118, 0.19), (0.10, 0.33)], 10, oz=z0)
    mb.tube(r, u, v, True)
    ob = mb.finish(name, [M_GLOW], 65, coll)
    ob.parent = parent
    return ob


def build_lantern(kind, coll, M_LAN, M_GLOW):
    mb = MB()
    if kind == 1:
        z0 = -0.89
        r, u, v = lathe(mb, [(0.11, 0.0), (0.075, -0.12), (0.038, -0.24)], 10, ucell=ROCKC, jitter=0.12, rot=0.2)
        for q in range(10):
            r[0][q].co.z = 0.0
        mb.tube(r, u, v, True)
        mb.fan(r[-1], (0.0, 0.0, -0.345), [(u_, 0.9) for u_ in u[-1]], (0.75, 0.95))
    else:
        z0 = 0.345
        r, u, v = lathe(mb, [(0.24, 0.0), (0.175, 0.19), (0.11, 0.35)], 10, ucell=ROCKC, jitter=0.10, rot=0.2)
        for q in range(10):
            r[0][q].co.z = 0.0
        mb.tube(r, u, v, True)
        mb.cap(r[-1], 0, uvbox=lambda i: (0.75 + 0.12 * math.cos(i), 0.5 + 0.3 * math.sin(i)))
    lantern_body(mb, z0)
    name = "SM_Lantern_Ice_%d" % kind
    ob = mb.finish(name, [M_LAN], 65, coll)
    g = glow_obj("glow_L%d" % kind, z0, coll, M_GLOW, ob)
    return ob, g


# ------------------------------------------------------------------ main
def build_all():
    sc = setup_scene()
    coll = sc.collection
    ice_n, ice_c, rock_n, pal_c, pal_mr = textures()
    M_ICE = pbr("M_Ice", (0.36, 0.72, 0.92), 0.14, 0.0, ice_n, 0.7, emit=(0.30, 0.78, 0.95), estr=0.12, cimg=ice_c)
    M_ROCK = pbr("M_Rock", (0.27, 0.31, 0.38), 0.7, 0.0, rock_n, 1.0)
    M_LAN = palette_mat("M_Lantern", pal_c, pal_mr)
    M_GLOW = pbr("glow", (1.0, 0.62, 0.25), 0.35, 0.0, emit=(1.0, 0.50, 0.14), estr=1.6)
    out = {}
    out["SM_IceLedge"] = build_ledge(coll, M_ICE, M_ROCK)
    out["SM_IceLip_Sides"] = build_lip(coll, M_ICE, M_ROCK)
    out["SM_IceBridge"] = build_bridge(coll, M_ICE)
    l1, g1 = build_lantern(1, coll, M_LAN, M_GLOW)
    l2, g2 = build_lantern(2, coll, M_LAN, M_GLOW)
    out["SM_Lantern_Ice_1"], out["SM_Lantern_Ice_2"] = l1, l2
    return out


if __name__ == "__main__" or True:
    _built = build_all()
