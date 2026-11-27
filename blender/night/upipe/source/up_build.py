"""N12 U-ramp (halfpipe) kit: SM_UPipe_Section, SM_UPipe_End, SM_UPipe_Light.

Headless:  blender -b --factory-startup -P up_build.py -- <out_dir> <tmp_dir>
All geometry is written in glTF space (x across, h = y up, z downhill) and converted
to Blender space (x, -z, h) when the mesh is made, so the GLB comes out +Y up, downhill +Z.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = argv[1] if len(argv) > 1 else OUT
TEX = os.path.join(OUT, "source", "textures")
os.makedirs(TEX, exist_ok=True)

# ---------------------------------------------------------------- cross-section numbers
XF = 2.6          # half floor width
RT = 4.8          # transition radius (centre at (XF, RT))
NARC = 24         # segments on the quarter circle
XV = XF + RT      # 7.4, vertical wall plane
HV = RT           # 4.8, arc top
HD = 5.1          # deck height
DECK = 3.0        # deck width (x 7.4 .. 10.4)
RF = 0.03         # snow fillet behind the coping (hidden inside the tube)
RO = 0.20         # outer deck edge round
COP_R = 0.07      # coping tube radius
COP_S = 0.05      # coping centre 5 cm behind the wall plane -> sticks out 2 cm into the pipe
COP_N = 12        # coping sides
LEN = 10.0        # section length
KZ = 4            # rings along the section (2.5 m)
TILE = 2.5        # texture tile, 4 whole tiles per 10 m
RE = 3.6          # End: the closing wall reaches vertical 3.6 m after the joint
NC = 7            # End: segments per bowl corner
NS = 2            # End: segments straight across the floor width


def to_b(p):
    """glTF (x, h, z) -> Blender (x, y, z)."""
    return (p[0], -p[2], p[1])


def s_rows():
    """Profile beyond the arc top, as (s, h, ns, nh): s outward from the wall plane."""
    rows = [(0.0, HD - RF, -1.0, 0.0)]
    cs, ch = RF, HD - RF                      # fillet centre
    for k in (1, 2):
        a = math.radians(180 - 45 * k)
        rows.append((cs + RF * math.cos(a), ch + RF * math.sin(a), math.cos(a), math.sin(a)))
    cs, ch = DECK - RO, HD - RO               # outer round centre
    rows.append((cs, HD, 0.0, 1.0))
    for k in (1, 2, 3):
        a = math.radians(90 - 30 * k)
        rows.append((cs + RO * math.cos(a), ch + RO * math.sin(a), math.cos(a), math.sin(a)))
    rows.append((DECK, 0.0, 1.0, 0.0))        # outer wall down to the ground
    return rows


def arc_rows():
    """Riding rows: (theta, D=sin(theta), h)."""
    out = []
    for i in range(NARC + 1):
        t = math.radians(90.0 * i / NARC)
        out.append((t, math.sin(t), RT * (1 - math.cos(t))))
    return out


def half_profile():
    """Right half (x >= 0) of the section: [(x, h, nx, nh)] from the centre line out."""
    pts = [(0.0, 0.0, 0.0, 1.0)]
    for t, d, h in arc_rows():
        pts.append((XF + RT * d, h, -math.sin(t), math.cos(t)))
    for s, h, ns, nh in s_rows():
        pts.append((XV + s, h, ns, nh))
    return pts


def full_profile():
    hp = half_profile()
    left = [(-x, h, -nx, nh) for (x, h, nx, nh) in reversed(hp[1:])]
    return left + hp


def profile_u(prof):
    """Signed path length from the centre line (cumulative chords)."""
    c = len(prof) // 2
    u = [0.0] * len(prof)
    for i in range(c + 1, len(prof)):
        u[i] = u[i - 1] + math.dist(prof[i][:2], prof[i - 1][:2])
    for i in range(c - 1, -1, -1):
        u[i] = u[i + 1] - math.dist(prof[i][:2], prof[i + 1][:2])
    return u


# ---------------------------------------------------------------- textures
def save_img(name, arr, srgb):
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    path = os.path.join(TEX, name + ".jpg")
    img.file_format = "JPEG"
    img.save(filepath=path, quality=85)
    bpy.data.images.remove(img)
    im = bpy.data.images.load(path)
    im.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    return im


def tile_noise(n, freqs, seed):
    """Tileable noise: random phases on integer frequencies."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    out = np.zeros((n, n))
    for f, amp in freqs:
        for _ in range(3):
            fx, fy = rng.integers(-f, f + 1, 2)
            if fx == 0 and fy == 0:
                fx = f
            out += amp * np.sin(2 * np.pi * (fx * x + fy * y) + rng.uniform(0, 6.283))
    return out


def blur_wrap(a, sigma):
    n = a.shape[0]
    f = np.fft.fftfreq(n)
    g = np.exp(-0.5 * (2 * np.pi * sigma) ** 2 * (f[:, None] ** 2 + f[None, :] ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def snow_textures():
    n = 1024
    rng = np.random.default_rng(7)
    u = np.arange(n) / n
    ridges = 40                                     # 40 grooming ridges per 2.5 m tile (6.25 cm)
    ph = (u * ridges) % 1.0
    prof = 0.5 - 0.5 * np.cos(2 * np.pi * ph)       # soft corduroy ridge across U
    prof = prof ** 0.75
    hgt = np.tile(prof[None, :], (n, 1)) * 1.0
    wob = tile_noise(n, [(2, 0.5), (3, 0.3), (5, 0.2)], 3)     # big soft undulation
    grain = blur_wrap(rng.standard_normal((n, n)), 1.2)
    grain /= grain.std()
    streak = blur_wrap(rng.standard_normal((n, n)), 1.0)
    streak = blur_wrap(np.repeat(streak[::8, :], 8, axis=0), 2.0)  # stretched along V (grooming)
    streak /= streak.std()
    H = 1.0 * hgt + 0.9 * wob + 0.10 * grain + 0.12 * streak
    gx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) * 0.5
    gy = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) * 0.5
    k = 1.6
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(H)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5], -1)
    # base colour (sRGB): cool white, grooves a touch darker and bluer
    m = 512
    hs = hgt[::2, ::2]
    gs = grain[::2, ::2]
    ws = wob[::2, ::2]
    base = np.zeros((m, m, 3))
    shade = 0.965 + 0.035 * hs + 0.008 * gs + 0.01 * ws
    base[..., 0] = 0.865 * shade
    base[..., 1] = 0.905 * shade
    base[..., 2] = 0.955 * (0.99 + 0.01 * hs)
    sparkle = (rng.random((m, m)) > 0.9975) * 0.05
    base += sparkle[..., None]
    orm = np.zeros((m, m, 3))
    orm[..., 0] = 1.0
    orm[..., 1] = 0.85 + 0.035 * (0.5 - hs) + 0.015 * gs
    orm[..., 2] = 0.0
    return (save_img("T_UPipeSnow_BaseColor", base, True),
            save_img("T_UPipeSnow_Normal", nrm, False),
            save_img("T_UPipeSnow_ORM", orm, False))


def candy_texture():
    n = 256
    y, x = np.mgrid[0:n, 0:n] / n
    t = ((x + y) * 3.0) % 1.0                          # 3 diagonal stripes per tile (tileable)
    m = 0.5 + 0.5 * np.tanh((np.abs(t - 0.5) - 0.25) * 40)
    red = np.array([0.80, 0.10, 0.12])
    wht = np.array([0.93, 0.92, 0.89])
    arr = red[None, None, :] * (1 - m[..., None]) + wht[None, None, :] * m[..., None]
    return save_img("T_UPipeLight_Candy", arr, True)


# ---------------------------------------------------------------- materials
def principled(name):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    return mat, nt, bsdf


def mat_snow(base, nrm, orm):
    mat, nt, b = principled("M_UPipeSnow")
    tb = nt.nodes.new("ShaderNodeTexImage"); tb.image = base
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm
    to = nt.nodes.new("ShaderNodeTexImage"); to.image = orm
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.0
    sp = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tb.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    nt.links.new(to.outputs["Color"], sp.inputs["Color"])
    nt.links.new(sp.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sp.outputs["Blue"], b.inputs["Metallic"])
    return mat


def mat_flat(name, rgb, rough, metal=0.0, emit=None, strength=1.0):
    mat, nt, b = principled(name)
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return mat


def mat_candy(img):
    mat, nt, b = principled("M_CandyStripe")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.45
    return mat


# ---------------------------------------------------------------- mesh helper
def make_mesh(name, verts, normals, faces, uvs, mat, smooth_custom=True, sharp_angle=None):
    """verts/normals in glTF space; faces = lists of vertex ids; uvs = per-face lists of (u, v).
    Faces are flipped where they disagree with the analytic vertex normals."""
    bm = bmesh.new()
    bv = [bm.verts.new(to_b(p)) for p in verts]
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    uvl = bm.loops.layers.uv.new("UVMap")
    for f, fu in zip(faces, uvs):
        bf = bm.faces.new([bv[i] for i in f])
        for lp, uv in zip(bf.loops, fu):
            lp[uvl].uv = uv
    big = [f for f in bm.faces if len(f.verts) > 4]   # flat caps: fan-free triangulation, same tri count
    if big:
        bmesh.ops.triangulate(bm, faces=big, quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.normal_update()
    for bf in bm.faces:
        ref = sum((bmesh_vec(normals[v.index]) for v in bf.verts), bmesh_vec((0, 0, 0)))
        if bf.normal.dot(ref) < 0:
            bf.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    me.shade_smooth()
    if smooth_custom:
        me.normals_split_custom_set_from_vertices([to_b(n) for n in normals])
    elif sharp_angle is not None:
        me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def bmesh_vec(t):
    from mathutils import Vector
    return Vector(to_b(t))


# ---------------------------------------------------------------- coping
def coping_mesh(name, path, mat):
    """path: [(cx, ch, cz, nx, nz, v)] ring centres in glTF space with the horizontal outward
    normal of the lip (pointing away from the pipe) and the texture V."""
    verts, norms, faces, uvs = [], [], [], []
    for (cx, ch, cz, nx, nz, v) in path:
        for k in range(COP_N):
            a = 2 * math.pi * k / COP_N
            ca, sa = math.cos(a), math.sin(a)
            nrm = (ca * nx, sa, ca * nz)
            verts.append((cx + COP_R * nrm[0], ch + COP_R * nrm[1], cz + COP_R * nrm[2]))
            norms.append(nrm)
    for r in range(len(path) - 1):
        for k in range(COP_N):
            k2 = (k + 1) % COP_N
            a, b = r * COP_N + k, r * COP_N + k2
            c, d = (r + 1) * COP_N + k2, (r + 1) * COP_N + k
            faces.append([a, b, c, d])
            u0, u1 = k / COP_N, (k + 1) / COP_N
            v0, v1 = path[r][5], path[r + 1][5]
            uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    return make_mesh(name, verts, norms, faces, uvs, mat)


# ---------------------------------------------------------------- SM_UPipe_Section
def build_section(m_snow, m_cop):
    prof = full_profile()
    U = profile_u(prof)
    P = len(prof)
    verts, norms, faces, uvs = [], [], [], []
    for r in range(KZ + 1):
        z = LEN * r / KZ
        for (x, h, nx, nh) in prof:
            verts.append((x, h, z))
            norms.append((nx, nh, 0.0))
    for r in range(KZ):
        z0, z1 = LEN * r / KZ / TILE, LEN * (r + 1) / KZ / TILE
        for i in range(P - 1):
            a, b = r * P + i, r * P + i + 1
            c, d = (r + 1) * P + i + 1, (r + 1) * P + i
            faces.append([a, b, c, d])
            uvs.append([(U[i] / TILE, z0), (U[i + 1] / TILE, z0), (U[i + 1] / TILE, z1), (U[i] / TILE, z1)])
    root = make_mesh("SM_UPipe_Section", verts, norms, faces, uvs, m_snow)
    # coping: two straight tubes, joined into one child mesh
    parts = []
    for sg in (-1, 1):
        path = [(sg * (XV + COP_S), HD, z, float(sg), 0.0, z / TILE) for z in (0.0, LEN)]
        parts.append(coping_mesh("Coping_%d" % sg, path, m_cop))
    cop = join(parts, "Coping")
    cop.parent = root
    return root, cop


def join(obs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


# ---------------------------------------------------------------- SM_UPipe_End
def end_columns():
    """Plan columns around the end: (sigma, phi) for the bowl corners, ('t', x) straight."""
    cols = []
    for j in range(NC + 1):                         # left corner, phi 0 -> 90
        cols.append(("c", -1, math.radians(90.0 * j / NC)))
    for j in range(1, NS):                          # straight interior
        cols.append(("t", -XF + 2 * XF * j / NS, None))
    for j in range(NC, -1, -1):                     # right corner, phi 90 -> 0
        cols.append(("c", 1, math.radians(90.0 * j / NC)))
    return cols


def end_point(col, row):
    """Vertex (x, h, z) and analytic normal for a column and a profile row.
    row = ('d', theta, D, h) on the riding surface, or ('s', s, h, ns, nh) beyond the arc top."""
    kind, sg, ph = col
    if kind == "c":
        cphi, sphi = math.cos(ph), math.sin(ph)
        # plan normal of the rim ellipse (semi-axes RT across, RE along z)
        nx, nz = sg * cphi / RT, sphi / RE
    else:
        cphi, sphi = 0.0, 1.0
        nx, nz = 0.0, 1.0 / RE
    ln = math.hypot(nx, nz)
    nx, nz = nx / ln, nz / ln
    if row[0] == "d":
        _, t, d, h = row
        if kind == "c":
            x = sg * (XF + RT * d * cphi)
        else:
            x = sg
        z = RE * d * sphi
        st, ct = math.sin(t), math.cos(t)
        n = (-st * (sg * cphi if kind == "c" else 0.0), ct, -st * (RT / RE) * sphi)
        ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
        return (x, h, z), (n[0] / ln, n[1] / ln, n[2] / ln)
    _, s, h, ns, nh = row
    if kind == "c":
        bx, bz = sg * (XF + RT * cphi), RE * sphi
    else:
        bx, bz = sg, RE
    return (bx + s * nx, h, bz + s * nz), (ns * nx, nh, ns * nz)


def build_end(m_snow, m_cop):
    cols = end_columns()
    rows = [("d", t, d, h) for (t, d, h) in arc_rows()] + [("s",) + r for r in s_rows()]
    C, R = len(cols), len(rows)
    verts, norms, key = [], [], {}
    grid = [[0] * C for _ in range(R)]
    for r, row in enumerate(rows):
        for c, col in enumerate(cols):
            p, n = end_point(col, row)
            k = (round(p[0], 6), round(p[1], 6), round(p[2], 6))
            if k not in key:                       # the two bowl poles collapse to one vertex each
                key[k] = len(verts)
                verts.append(p)
                norms.append(n)
            grid[r][c] = key[k]
    # texture: corners unrolled as a polar quadrant around their pole, straight part flat;
    # matches the section's U (signed profile length) and V = 0 at the joint
    rho = [[0.0] * C for _ in range(R)]
    for c in range(C):
        for r in range(1, R):
            rho[r][c] = rho[r - 1][c] + math.dist(verts[grid[r][c]], verts[grid[r - 1][c]])

    def uv(r, c):
        kind, sg, ph = cols[c]
        if kind == "c":
            return (sg * (XF + rho[r][c] * math.cos(ph)) / TILE, rho[r][c] * math.sin(ph) / TILE)
        return (sg / TILE, rho[r][c] / TILE)

    faces, uvs = [], []
    for r in range(R - 1):
        for c in range(C - 1):
            ids = [(r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c)]
            f, fu = [], []
            for (rr, cc) in ids:
                v = grid[rr][cc]
                if v in f:
                    continue
                f.append(v)
                fu.append(uv(rr, cc))
            if len(f) >= 3:
                faces.append(f)
                uvs.append(fu)
    root = make_mesh("SM_UPipe_End", verts, norms, faces, uvs, m_snow)
    # coping along the rim, continuing the section's tubes at the joint
    path, plen, prev = [], 0.0, None
    for col in cols:
        p, n = end_point(col, ("s", COP_S, HD, 1.0, 0.0))
        if prev is not None:
            plen += math.dist(p, prev)
        prev = p
        path.append([p[0], HD, p[2], n[0], n[2], plen / TILE])
    k = max(1, round(plen / TILE)) / (plen / TILE)    # whole tiles, so V matches at both joints
    path = [tuple(q[:5]) + (q[5] * k,) for q in path]
    cop = coping_mesh("Coping", path, m_cop)
    cop.parent = root
    return root, cop


# ---------------------------------------------------------------- SM_UPipe_Light
def lathe(rings, seg, close_top=False, close_bot=False, u_rep=1.0, v_scale=1.0, phase=0.0):
    """rings: [(r, y)] bottom to top -> verts/normals/faces/uvs in glTF space (y up).
    A ring with r = 0 is a single pole vertex (triangle fan)."""
    verts, norms, faces, uvs = [], [], [], []
    vlen = [0.0]
    for i in range(1, len(rings)):
        vlen.append(vlen[-1] + math.dist(rings[i], rings[i - 1]))
    ids = []
    for i, (r, y) in enumerate(rings):
        if i == 0:
            dr, dy = rings[1][0] - r, rings[1][1] - y
        elif i == len(rings) - 1:
            dr, dy = r - rings[i - 1][0], y - rings[i - 1][1]
        else:
            dr, dy = rings[i + 1][0] - rings[i - 1][0], rings[i + 1][1] - rings[i - 1][1]
        ln = math.hypot(dr, dy) or 1.0
        pn = (dy / ln, -dr / ln)                    # outward profile normal (r, y)
        if r < 1e-9:
            ids.append([len(verts)] * seg)
            verts.append((0.0, y, 0.0))
            norms.append((0.0, 1.0 if i == len(rings) - 1 else -1.0, 0.0))
            continue
        row = []
        for k in range(seg):
            a = 2 * math.pi * k / seg + phase
            row.append(len(verts))
            verts.append((r * math.cos(a), y, r * math.sin(a)))
            norms.append((pn[0] * math.cos(a), pn[1], pn[0] * math.sin(a)))
        ids.append(row)
    for i in range(len(rings) - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            quad = [ids[i][k], ids[i + 1][k], ids[i + 1][k2], ids[i][k2]]
            u0, u1 = k / seg * u_rep, (k + 1) / seg * u_rep
            q_uv = [(u0, vlen[i] * v_scale), (u0, vlen[i + 1] * v_scale),
                    (u1, vlen[i + 1] * v_scale), (u1, vlen[i] * v_scale)]
            f, fu = [], []
            for v, t in zip(quad, q_uv):
                if v not in f:
                    f.append(v); fu.append(t)
            faces.append(f); uvs.append(fu)
    for flag, i, sgn in ((close_bot, 0, -1), (close_top, len(rings) - 1, 1)):
        if flag:
            # flat cap with its own verts so it does not bend the side normals
            base = len(verts)
            r, y = rings[i]
            for k in range(seg):
                a = 2 * math.pi * k / seg + phase
                verts.append((r * math.cos(a), y, r * math.sin(a)))
                norms.append((0.0, float(sgn), 0.0))
            faces.append([base + k for k in range(seg)])
            uvs.append([(0.5 + 0.5 * math.cos(2 * math.pi * k / seg), 0.5 + 0.5 * math.sin(2 * math.pi * k / seg))
                        for k in range(seg)])
    return verts, norms, faces, uvs


def merge_parts(parts):
    V, N, F, UV = [], [], [], []
    for (v, n, f, uv) in parts:
        o = len(V)
        V += v; N += n; UV += uv
        F += [[i + o for i in face] for face in f]
    return V, N, F, UV


def box(cx, cy, cz, sx, sy, sz):
    """Four side faces of an axis box (no caps), centre (cx, cy, cz), glTF space."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    corners = [(-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz)]
    verts, norms, faces, uvs = [], [], [], []
    for k in range(4):
        (ax, az), (bx, bz) = corners[k], corners[(k + 1) % 4]
        nx, nz = (bz - az), -(bx - ax)
        ln = math.hypot(nx, nz)
        nx, nz = nx / ln, nz / ln
        o = len(verts)
        for (px, pz, py) in ((ax, az, -hy), (bx, bz, -hy), (bx, bz, hy), (ax, az, hy)):
            verts.append((cx + px, cy + py, cz + pz))
            norms.append((nx, 0.0, nz))
        faces.append([o, o + 1, o + 2, o + 3])
        uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])
    return verts, norms, faces, uvs


def build_light(m_candy, m_green, m_glow):
    # candy post with a small flared foot, base at y = 0
    post = lathe([(0.075, 0.0), (0.05, 0.08), (0.05, 1.55)], 12,
                 u_rep=1.0, v_scale=1 / 0.45)
    root = make_mesh("SM_UPipe_Light", *post[:3], post[3], m_candy)
    # lantern: plate, four corner bars, roof with a knob (green painted metal)
    plate = lathe([(0.10, 1.55), (0.10, 1.58)], 12, close_top=True, close_bot=True)
    bars = [box(0.068 * math.cos(a), 1.665, 0.068 * math.sin(a), 0.018, 0.17, 0.018)
            for a in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4)]
    roof = lathe([(0.125, 1.75), (0.03, 1.86), (0.0, 1.875)], 12, close_bot=True)
    knob = lathe([(0.0, 1.862), (0.027, 1.886), (0.0, 1.91)], 8)
    lan = make_mesh("Lantern", *merge_parts([plate] + bars + [roof, knob]), m_green,
                    smooth_custom=True)
    # glow: the warm glass body
    glow = lathe([(0.072, 1.58), (0.08, 1.665), (0.072, 1.75)], 12)
    g = make_mesh("glow", *glow, m_glow)
    root.data.materials.append(m_green)
    # merge the lantern frame into the root mesh (one draw per material), keep glow a child
    bpy.ops.object.select_all(action="DESELECT")
    lan.select_set(True); root.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.join()
    root = bpy.context.view_layer.objects.active
    me = root.data
    for p in me.polygons:
        p.material_index = 0 if p.material_index == 0 else 1
    # remove duplicate slot if join appended one
    while len(me.materials) > 2:
        me.materials.pop()
    g.parent = root
    return root, g


# ---------------------------------------------------------------- export
def export(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for c in root.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_yup=True, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_image_format="JPEG", export_jpeg_quality=85,
        export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=False,
        export_extras=False, export_animations=False, export_skins=False, export_morph=False)


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    base, nrm, orm = snow_textures()
    candy = candy_texture()
    m_snow = mat_snow(base, nrm, orm)
    m_cop = mat_flat("Coping", (0.06, 0.24, 0.72), 0.4, 0.0)
    m_glow = mat_flat("glow", (1.0, 0.78, 0.45), 0.35, 0.0, emit=(1.0, 0.72, 0.38), strength=1.0)
    m_green = mat_flat("M_LanternGreen", (0.05, 0.22, 0.12), 0.4, 0.0)
    m_candy = mat_candy(candy)

    sec, scop = build_section(m_snow, m_cop)
    end, ecop = build_end(m_snow, m_cop)
    lig, glow = build_light(m_candy, m_green, m_glow)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(TMP, "upipe_build.blend"))
    # export one model at a time: the two copings share the name "Coping" in their own files
    jobs = [(sec, scop), (end, ecop), (lig, glow)]
    for root, child in jobs:
        names = {}
        for r2, c2 in jobs:
            if r2 is not root and c2.name.startswith("Coping"):
                names[c2] = c2.name
                c2.name = "tmp_" + c2.name
        if child.name.startswith("Coping"):
            child.name = "Coping"
            child.data.name = "Coping"
        export(root, os.path.join(OUT, root.name + ".glb"))
        for o, n in names.items():
            o.name = n
    print("BUILD_OK")


main()
