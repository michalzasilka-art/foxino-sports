"""SM_IceCave_Entrance / SM_IceCave_Exit generator (FoxSports Snowboard, Austria ice cave, job W2 lane C).

Blender Z-up; the cave runs along Blender -Y (glTF +Z). One sheet mesh per mouth:
ring (exact shared profile) -> ice lining -> rounded lip -> cliff face -> snow cornice/top -> back plate -> ring,
plus icicles joined into the same mesh. One material (baked base colour, roughness, normal, emissive).

Use inside Blender:  exec(open(PATH).read()); build_mouth("entrance")  /  build_mouth("exit")
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector, noise

HALF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25),
        (4.95, 4.95), (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
RING21 = HALF + [(-x, z) for (x, z) in reversed(HALF[:-1])]


def _ring41():
    pts = []
    for i in range(20):
        a, b = RING21[i], RING21[i + 1]
        pts.append(a)
        pts.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
    pts.append(RING21[20])
    return pts


RING = _ring41()
NC = len(RING)  # 41 columns, even ones are the exact profile points


def _normals(pts):
    ns = []
    for j in range(len(pts)):
        if j == 0:
            ns.append((1.0, 0.0)); continue
        if j == len(pts) - 1:
            ns.append((-1.0, 0.0)); continue
        a, b = pts[j - 1], pts[j + 1]
        nx, nz = b[1] - a[1], -(b[0] - a[0])
        l = math.hypot(nx, nz)
        ns.append((nx / l, nz / l))
    return ns


NRM = _normals(RING)

STYLES = {
    # H*: cliff top height (right/left), flat*: half-width of the flat top, foot*: where the snow shoulder meets the ground
    "entrance": dict(seed=1, HR=8.7, HL=8.8, flatR=8.2, flatL=8.0, footR=15.0, footL=15.2, spur=0.0, spur_x=0.0,
                     sil_noise=0.35, lean=0.35, shoulder=3.2, relief=0.85, cornice=1.0, bulge=0.32, lipflare=0.75,
                     icicles="fringe"),
    "exit": dict(seed=7, HR=8.1, HL=8.5, flatR=7.0, flatL=9.0, footR=14.2, footL=16.0, spur=0.9, spur_x=-5.2,
                 sil_noise=0.5, lean=0.7, shoulder=2.5, relief=1.15, cornice=0.75, bulge=0.38, lipflare=0.85,
                 icicles="clusters"),
}


def fbm(x, y, z, seed, octaves=3):
    s = tot = 0.0
    amp, f = 1.0, 1.0
    for _ in range(octaves):
        s += amp * noise.noise(Vector((x * f + seed * 17.31, y * f + seed * 5.13, z * f - seed * 9.71)))
        tot += amp
        amp *= 0.5
        f *= 2.03
    return s / tot


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def outline_h(x, st):
    """cliff outline height above the floor at x: flat rock top, rounded shoulders, snow foot at the sides.
    Left/right parameters blend smoothly across the middle (no crease)."""
    w = smooth(-4.0, 4.0, x)
    ax = abs(x)
    H = st["HL"] + (st["HR"] - st["HL"]) * w
    flat = st["flatL"] + (st["flatR"] - st["flatL"]) * w
    foot = st["footL"] + (st["footR"] - st["footL"]) * w
    if ax >= foot:
        return 0.0
    k = smooth(flat, foot, ax)
    h = H * (1 - k) ** 1.4
    h += st["spur"] * math.exp(-((x - st["spur_x"]) / 1.8) ** 2) * (1 - k)
    h += st["sil_noise"] * fbm(x * 0.28, 0.3, 0.0, st["seed"] + 3, 3) * 2 * (1 - k)
    return h


def silhouette(th, st):
    """ray from the floor centre at angle th to the cliff outline."""
    c, s = math.cos(th), math.sin(th)
    lo, hi = 0.0, 30.0
    for _ in range(50):
        r = (lo + hi) / 2
        if r * s - outline_h(r * c, st) < 0 and abs(r * c) < 30:
            lo = r
        else:
            hi = r
    r = (lo + hi) / 2
    return (r * c, max(0.0, r * s))


def column_rows(j, st, S, M):
    """List of (x, d, z, kind, rowparam) for column j. d = depth from the ring (0) toward the face (~3.3)."""
    seed = st["seed"]
    px, pz = RING[j]
    nx, nz = NRM[j]
    th = math.atan2(pz, px)
    edge = j in (0, NC - 1)
    rows = []

    def at_r(r, d, kind, prm):
        z = pz + nz * r
        if edge:
            z = 0.0
        rows.append([px + nx * r, d, z, kind, prm])

    # ice lining: bulges outward only (rider space stays clear)
    for d in (0.0, 0.75, 1.5, 2.2):
        b = st["bulge"] * (0.55 + 0.45 * fbm(px * 0.33, d * 0.6, pz * 0.33, seed, 3)) * smooth(0.0, 1.2, d)
        at_r(max(0.0, b), d, "lining", d / 3.0)
    # rounded, flared lip
    fl = st["lipflare"] * (1 + 0.3 * fbm(px * 0.4, 7.0, pz * 0.4, seed + 1, 2))
    for r, d, prm in ((0.20, 2.62, 0.0), (0.55 * fl, 2.95, 0.33), (1.05 * fl, 3.17, 0.66), (1.6 * fl, 3.28, 1.0)):
        b = st["bulge"] * 0.5 * smooth(0.0, 1.2, d)
        at_r(r + b * (1 - prm), d, "lip", prm)
    lipx, lipd, lipz = rows[-1][0], rows[-1][1], rows[-1][2]
    # cliff face
    sx, sz = S[j]
    c4 = math.cos(th) ** 4
    dS = None
    for t in (0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1.0):
        e = t ** 1.15
        x = lipx + (sx - lipx) * e
        z = lipz + (sz - lipz) * e
        bump = math.sin(math.pi * t)
        d = lipd + st["lean"] * t * math.sin(th) + st["shoulder"] * c4 * t ** 1.5
        d += st["relief"] * fbm(x * 0.22, z * 0.22, 3.0, seed + 2, 3) * bump * 1.6
        x += 0.45 * fbm(x * 0.3, z * 0.3, 11.0, seed + 4, 2) * bump
        if edge:
            z = -0.25 * t
        else:
            z += 0.45 * fbm(x * 0.3, z * 0.3, 23.0, seed + 5, 2) * bump
            if pz < 1.5:  # ground-level columns: keep the shoulder foot on / just under the ground
                z = max(-0.25, min(z, z * smooth(0.0, 1.5, pz) + (1 - smooth(0.0, 1.5, pz)) * (-0.2 * t)))
        rows.append([x, d, z, "face", t])
        dS = d
    # snow cornice, roll-over top and back slope
    mx, mz = M[j]
    top = max(0.0, math.sin(th)) ** 2
    cf = st["cornice"] * top * (1 + 0.35 * fbm(sx * 0.4, 5.0, sz * 0.4, seed + 6, 2))
    sx, sz = rows[-1][0], rows[-1][2]
    rim = ((0.30, dS + 0.25 + 0.55 * cf, -0.10 * cf, 0.0), (0.72, dS + 0.15 + 0.30 * cf, 0.0, 0.25),
           (0.98, dS - 0.45, 0.0, 0.5), (1.08, 0.5 * dS + 0.9, 0.0, 0.75), (0.88, 1.05, 0.0, 0.9),
           (0.58, 0.58, 0.0, 1.0))
    for u, d, dz, prm in rim:
        z = sz + mz * u + dz
        if edge:
            z = -0.25
        rows.append([sx + mx * u, d, z, "rim", prm])
    # back plate toward the ring
    bx, bd, bz = rows[-1][0], rows[-1][1], rows[-1][2]
    for t in (0.4, 0.75):
        x = bx + (px + nx * 0.3 - bx) * t
        z = bz + (pz + nz * 0.3 - bz) * t
        d = bd + (0.10 - bd) * t
        if edge:
            z = -0.25 * (1 - t)
        rows.append([x, d, z, "back", t])
    return rows


def build_sheet(st):
    S = [silhouette(math.atan2(p[1], p[0]), st) for p in RING]
    M = []
    for j in range(NC):
        if j == 0:
            M.append((1.0, 0.0)); continue
        if j == NC - 1:
            M.append((-1.0, 0.0)); continue
        a, b = S[j - 1], S[j + 1]
        mx, mz = b[1] - a[1], -(b[0] - a[0])
        l = math.hypot(mx, mz)
        M.append((mx / l, mz / l))
    cols = [column_rows(j, st, S, M) for j in range(NC)]
    return cols


def frame(x, d, z, kind):
    """local (x, depth, z) -> Blender coords for the mouth kind."""
    if kind == "entrance":
        return Vector((x, d - 3.0, z))
    return Vector((x, -d, z))


def build_icicles(st, cols, kind):
    """Return list of icicle specs: (top Vector, length, radius)."""
    rnd = random.Random(st["seed"] * 101)
    specs = []
    # fringe along the lip, columns of the upper arch
    k = 0
    pos = 3.0
    while pos < NC - 4.0:
        j = int(pos)
        f = pos - j
        a, b = cols[j][6], cols[j + 1][6]
        x = a[0] + (b[0] - a[0]) * f
        d = a[1] + (b[1] - a[1]) * f
        z = a[2] + (b[2] - a[2]) * f
        nz = NRM[j][1] * (1 - f) + NRM[j + 1][1] * f
        nx = NRM[j][0] * (1 - f) + NRM[j + 1][0] * f
        if nz > 0.45:
            if st["icicles"] == "fringe":
                L = rnd.uniform(0.55, 1.6) * (1.0 if k % 3 else 1.35)
                step = rnd.uniform(0.55, 0.85)
            else:  # clusters: 3-5 together, then a gap; a curtain of uneven lengths
                if k % 5 == 4:
                    L, step = 0.0, rnd.uniform(1.2, 1.8)
                else:
                    L = rnd.uniform(0.4, 2.2)
                    step = rnd.uniform(0.35, 0.55)
            top = Vector((x + nx * 0.25, d, z + nz * 0.25))
            ztip_min = 4.3 if abs(x) < 6.9 else 1.2
            L = min(L, top.z - ztip_min)
            if L > 0.3:
                specs.append((top, L, 0.09 + 0.10 * L, d))
            k += 1
        else:
            step = 0.8
        pos += step
    # cornice icicles: under the snow nose on the top
    pos = 6.0
    cnt = 0
    while pos < NC - 7.0:
        j = int(pos)
        f = pos - j
        a, b = cols[j][16], cols[j + 1][16]  # first rim row = cornice nose
        x = a[0] + (b[0] - a[0]) * f
        d = a[1] + (b[1] - a[1]) * f - 0.05
        z = a[2] + (b[2] - a[2]) * f
        th = math.atan2(RING[j][1], RING[j][0])
        if math.sin(th) > 0.55:
            if st["icicles"] == "fringe":
                L = rnd.uniform(0.35, 0.9)
            else:
                L = rnd.uniform(0.3, 1.3) if cnt % 3 != 2 else 0.0
            if L > 0.3:
                specs.append((Vector((x, d, z + 0.14)), L, 0.09 + 0.10 * L, d))
            cnt += 1
        pos += rnd.uniform(1.1, 1.9) if st["icicles"] == "fringe" else rnd.uniform(0.8, 2.6)
    return specs


def build_mouth(kind, name=None):
    st = STYLES[kind]
    name = name or ("SM_IceCave_Entrance" if kind == "entrance" else "SM_IceCave_Exit")
    cols = build_sheet(st)
    NR = len(cols[0])
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    a_ice = bm.verts.layers.float.new("ice")
    a_snow = bm.verts.layers.float.new("snow")
    a_kind = bm.verts.layers.int.new("rowkind")
    kinds = {"lining": 0, "lip": 1, "face": 2, "rim": 3, "back": 4, "icicle": 5}
    V = [[None] * NC for _ in range(NR)]
    for j in range(NC):
        for r in range(NR):
            x, d, z, kd, prm = cols[j][r]
            v = bm.verts.new(frame(x, d, z, kind))
            v[a_kind] = kinds[kd]
            ice = snow = 0.0
            if kd == "lining":
                ice = 1.0
            elif kd == "lip":
                ice = 1.0 - 0.55 * prm
            elif kd == "face":
                ice = max(0.0, 0.45 - prm * 1.6)
                th = math.atan2(RING[j][1], RING[j][0])
                snow = smooth(0.6, 0.95, prm) * (0.35 + 0.65 * math.cos(th) ** 2)
            elif kd == "rim":
                snow = 1.0
            elif kd == "back":
                snow = 0.6 - 0.4 * prm
            v[a_ice] = ice
            v[a_snow] = snow
            V[r][j] = v
    # average row arc length for v coords
    seg = []
    for r in range(NR):
        r2 = (r + 1) % NR
        seg.append(sum((V[r][j].co - V[r2][j].co).length for j in range(NC)) / NC)
    tot = sum(seg)
    vco = [0.0]
    for s in seg:
        vco.append(vco[-1] + s / tot * 0.86)
    for r in range(NR):
        r2 = (r + 1) % NR
        for j in range(NC - 1):
            quad = (V[r][j], V[r][j + 1], V[r2][j + 1], V[r2][j])
            uvs = ((j / (NC - 1), vco[r]), ((j + 1) / (NC - 1), vco[r]), ((j + 1) / (NC - 1), vco[r + 1]),
                   (j / (NC - 1), vco[r + 1]))
            if kind == "exit":
                quad = quad[::-1]
                uvs = uvs[::-1]
            f = bm.faces.new(quad)
            for lp, uv in zip(f.loops, uvs):
                lp[uvl].uv = (uv[0] * 0.98 + 0.01, uv[1] + 0.01)
    # icicles
    specs = build_icicles(st, cols, kind)
    rnd = random.Random(st["seed"] * 7)
    K = max(1, len(specs))
    cw = 0.98 / K
    SIDES = 6
    for k, (top, L, R, dloc) in enumerate(specs):
        top = frame(top.x, top.y, top.z, kind)
        lean = Vector((rnd.uniform(-0.06, 0.06), rnd.uniform(-0.06, 0.06), 0))
        prof = ((0.0, 1.0), (0.38, 0.62), (0.72, 0.3))
        rings = []
        rot0 = rnd.uniform(0, math.tau)
        for s, rf in prof:
            c = top + Vector((0, 0, -L * s)) + lean * s * L
            ring = []
            for i in range(SIDES):
                ang = rot0 + i * math.tau / SIDES
                wob = 1 + 0.12 * math.sin(3 * ang + k)
                v = bm.verts.new(c + Vector((math.cos(ang), math.sin(ang), 0)) * R * rf * wob)
                v[a_ice] = 1.0
                v[a_snow] = 0.0
                v[a_kind] = kinds["icicle"]
                ring.append(v)
            rings.append(ring)
        tip = bm.verts.new(top + Vector((0, 0, -L)) + lean * L)
        tip[a_ice] = 1.0
        tip[a_kind] = kinds["icicle"]
        u0 = 0.01 + k * cw
        vv = (0.885, 0.925, 0.96, 0.99)
        for ri in range(2):
            for i in range(SIDES):
                i2 = (i + 1) % SIDES
                q = (rings[ri][i], rings[ri + 1][i], rings[ri + 1][i2], rings[ri][i2])
                uu = (u0 + cw * 0.9 * i / SIDES, u0 + cw * 0.9 * (i + 1) / SIDES)
                uvs = ((uu[0], vv[ri]), (uu[0], vv[ri + 1]), (uu[1], vv[ri + 1]), (uu[1], vv[ri]))
                f = bm.faces.new(q)
                for lp, uv in zip(f.loops, uvs):
                    lp[uvl].uv = uv
        for i in range(SIDES):
            i2 = (i + 1) % SIDES
            f = bm.faces.new((rings[2][i], tip, rings[2][i2]))
            uu = (u0 + cw * 0.9 * i / SIDES, u0 + cw * 0.9 * (i + 1) / SIDES)
            for lp, uv in zip(f.loops, ((uu[0], vv[2]), ((uu[0] + uu[1]) / 2, vv[3]), (uu[1], vv[2]))):
                lp[uvl].uv = uv
    bm.normal_update()
    # orientation: the lining face at the apex must point down (into the cave)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    return ob, len(specs)
