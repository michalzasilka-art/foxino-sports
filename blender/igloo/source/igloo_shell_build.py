# Igloo W3 (FoxSports Snowboard): SM_Igloo_Shell + SM_Igloo_ExitPlug.
# Blender 5.2, Z-up. Entrance (tunnel) on Blender +Y (= glTF -Z), exit plug on Blender -Y (= glTF +Z).
# Snow blocks: one spiral course per turn; the block joints (bevels, faint blue) live in a tiling
# 1024x256 texture (1 course tall, 4 blocks long); the mesh has an edge along every bed joint and
# along the head joints that bound the exit plug, so plug and shell share the exact border.
# Run inside Blender: exec(open(this).read()); build_all()
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

OUT = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\a-igloo\blender\igloo"
TMP = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\a-tmp"

RI, RO = 9.0, 9.55                 # inner / outer dome radius
RM = 0.5 * (RI + RO)
DPHI = math.asin(4.5 / RI) / 8.5   # course height in elevation angle (strip 7 tops out at inner h 4.5 on the exit)
K = 23                             # last spiral strip index (top wedge)
PHIC = DPHI * (K + 1)              # cap circle elevation
TS = math.pi / 2                   # spiral starts on the entrance meridian (+Y)
TWO = 2 * math.pi
UB = [0.0, 0.24, 0.51, 0.74]       # head-joint positions inside the 4-block texture tile
A_ = DPHI / TWO
B_ = DPHI / 2
G = {"LT": 3.6, "PH": 0.0, "DS": 0.75, "DSF": 0.25,"LTK": {}, "PHK": {}}
MAT = "M_IglooSnow"

# tunnel (inner = channel, outer = tunnel skin); x half width, wall height, arch semi-axis
TUN_IN = (2.5, 2.4, 1.7)           # inner 5.0 wide, 2.4 + 1.7 = 4.1 high
TUN_OUT = (3.05, 2.4, 2.25)        # 0.55 thick
TUN_END = 15.6                     # Blender +Y of the open end (= glTF z -15.6)
LIP = 0.08                         # rounded lip radius at the mouth and the doorway


def Jc(T):
    return min(max(DPHI * T / TWO, 0.0), PHIC)


def Uk(k, a):
    """U along course k (strip k) at alpha a: arc length / per-course tile length, continuous along the spiral"""
    return G["PHK"][k] + RM * (math.sin(A_ * (TWO * k + a) + B_) - math.sin(A_ * TWO * k + B_)) / (A_ * G["LTK"][k])


def Uik(k, U):
    return (math.asin(math.sin(A_ * TWO * k + B_) + (U - G["PHK"][k]) * A_ * G["LTK"][k] / RM) - B_) / A_ - TWO * k


def joints(k, a0=0.0, a1=TWO):
    u0, u1 = Uk(k, a0), Uk(k, a1)
    out = []
    for n in range(math.floor(u0) - 1, math.ceil(u1) + 1):
        for ub in UB:
            u = n + ub
            if u0 < u < u1:
                out.append(Uik(k, u))
    return sorted(out)


def pair_cost(k):
    """stagger cost of course k against course k-1 (joints closer than 0.3 m), doorway side skipped"""
    lo = np.array(joints(k - 1))
    cost, bad, mind = 0.0, 0, 9.0
    for a in joints(k):
        if a < 0.4 or a > TWO - 0.4:
            continue
        r = RO * math.cos(Jc(TWO * k + a))
        d = float(np.min(np.abs(lo - a))) * r
        mind = min(mind, d)
        if d < 0.3:
            cost += (0.3 - d) * (6.0 if abs(a - math.pi) < 0.7 else 1.0)
            bad += d < 0.2
    return cost, bad, mind


def plug_width(k):
    a, b = plug_ranges_k(k)
    top = Jc(TWO * (k + 1) + math.pi)
    return max(abs(RI * math.cos(top) * math.sin(x - math.pi)) for x in (a, b))


def set_courses(ph0):
    G["LTK"], G["PHK"] = {-1: 3.6}, {-1: ph0}
    tot = 0.0
    for k in range(0, K + 1):
        G["PHK"][k] = Uk(k - 1, TWO)
        best = None
        for lt in np.arange(3.48, 3.7001, 0.004):
            G["LTK"][k] = float(lt)
            c, bad, mind = pair_cost(k)
            if k <= 7:
                c += 0.5 * max(0.0, plug_width(k) - 2.95)
            if best is None or c < best[0]:
                best = (c, float(lt))
        G["LTK"][k] = best[1]
        tot += best[0]
    return tot


def stagger_score(kmax=K):
    bad, mind = 0, 9.0
    for k in range(1, kmax + 1):
        c, b, m = pair_cost(k)
        bad += b
        mind = min(mind, m)
    return bad, mind


def pick_lt():
    best = None
    for ph in np.arange(0.0, 1.0, 0.025):
        tot = set_courses(float(ph))
        tot += 0.5 * max(0.0, plug_width(-1) - 2.95)
        if best is None or tot < best[0]:
            best = (tot, float(ph))
    set_courses(best[1])
    return {"cost": round(best[0], 3), "ph0": best[1], "stagger": stagger_score(),
            "widths": {k: round(plug_width(k), 2) for k in range(-1, 8)}}


def plug_ranges_k(k):
    lim = math.asin(4.4 / RI)
    js = joints(k)

    def ok(al):
        phe = min(Jc(TWO * (k + 1) + al), lim)
        return RI * math.cos(phe) * abs(math.sin(al - math.pi)) >= 2.65
    R = [a for a in js if math.pi < a < 1.5 * math.pi and ok(a)]
    L = [a for a in js if 0.5 * math.pi < a < math.pi and ok(a)]
    return (max(L), min(R))


def plug_ranges():
    return {k: plug_ranges_k(k) for k in range(-1, 8)}


# ------------------------------------------------------------------ dome
def turn_samples(PR):
    """per turn m (-1..K+1): sorted list of alpha in [0, 2pi]"""
    turns = {}
    for m in range(-1, K + 2):
        phi = Jc(TWO * m + math.pi)
        n = max(36, math.ceil(TWO * RO * math.cos(phi) / G["DS"]))
        step = TWO / n
        if -1 <= m <= 8:
            # finer tessellation over the exit plug (and a ramp around it) for lane B's fracture
            def loc(a):
                d = abs(a - math.pi)
                f = min(max((d - 0.42) / 0.25, 0.0), 1.0)
                ds = G["DSF"] * (1 - f) + G["DS"] * f
                return min(step, ds / (RO * math.cos(Jc(TWO * m + a))))
            base, a = [0.0], 0.0
            while True:
                a += loc(a)
                if a >= TWO - 0.5 * step:
                    break
                base.append(a)
            base.append(TWO)
        else:
            base = [TWO * i / n for i in range(n + 1)]
        forced = []
        for k in (m, m - 1):
            if k in PR:
                forced += list(PR[k])
        fs = G["DSF"] / (RO * math.cos(Jc(TWO * m + math.pi))) if -1 <= m <= 8 else step
        al = [a for a in base if all(abs(a - f) > 0.35 * fs for f in forced)] + forced
        turns[m] = sorted(al)
    return turns


def build_dome():
    PR = plug_ranges()
    turns = turn_samples(PR)
    verts, tv = [], {}       # tv[m] = list of (alpha, vid)
    first = None
    for m in range(-1, K + 2):
        lst = []
        for i, a in enumerate(turns[m]):
            if i == 0 and m > -1:
                vid = tv[m - 1][-1][1]
            elif m == -1 and i == len(turns[m]) - 1:
                vid = lst[0][1]
            elif m == K + 1 and i == len(turns[m]) - 1:
                vid = lst[0][1]
            else:
                vid = len(verts)
                verts.append((TS + a, Jc(TWO * m + a)))
            lst.append((a, vid))
        tv[m] = lst
    NV = len(verts)
    pole = 2 * NV
    P = []
    for R in (RO, RI):
        for th, ph in verts:
            P.append((R * math.cos(ph) * math.cos(th), R * math.cos(ph) * math.sin(th), R * math.sin(ph)))
    P.append((0, 0, RO))
    P.append((0, 0, RI))
    faces = []   # (vids, uvs, kind, plug)  kind: 1 outer 2 inner 3 bottom 4 side

    def h_of(k, a):
        return Jc(TWO * (k + 1) + a) - Jc(TWO * k + a)

    for k in range(-1, K + 1):
        bot, top = tv[k], tv[k + 1]
        ba = [a for a, _ in bot]
        ta = [a for a, _ in top]
        rungs = sorted(set(round(a, 9) for a in ba) & set(round(a, 9) for a in ta))
        rng = PR.get(k)
        def loopuv(a, is_top):
            U = Uk(k, a)
            V = 1.0 if is_top else 1.0 - h_of(k, a) / DPHI
            return (U, V)
        for r0, r1 in zip(rungs[:-1], rungs[1:]):
            b = [(a, v) for a, v in bot if r0 - 1e-9 <= a <= r1 + 1e-9]
            t = [(a, v) for a, v in top if r0 - 1e-9 <= a <= r1 + 1e-9]
            i = j = 0
            while i < len(b) - 1 or j < len(t) - 1:
                if i < len(b) - 1 and (j == len(t) - 1 or b[i + 1][0] <= t[j + 1][0]):
                    tri = [(b[i], 0), (b[i + 1], 0), (t[j], 1)]
                    i += 1
                else:
                    tri = [(b[i], 0), (t[j + 1], 1), (t[j], 1)]
                    j += 1
                vids = [x[0][1] for x in tri]
                if len(set(vids)) < 3:
                    continue
                uvs = [loopuv(x[0][0], x[1]) for x in tri]
                amin = min(x[0][0] for x in tri)
                amax = max(x[0][0] for x in tri)
                plug = rng is not None and amin >= rng[0] - 1e-9 and amax <= rng[1] + 1e-9
                faces.append((vids, uvs, 1, plug))
                faces.append(([v + NV for v in vids[::-1]], uvs[::-1], 2, plug))
    # cap
    cap = tv[K + 1]
    for (a0, v0), (a1, v1) in zip(cap[:-1], cap[1:]):
        uv = [(0.30 + 0.15 * a0 / TWO, 0.0), (0.30 + 0.15 * a1 / TWO, 0.0), (0.30 + 0.15 * (a0 + a1) / (2 * TWO), 0.5)]
        faces.append(([v0, v1, pole], uv, 1, False))
        faces.append(([pole + 1, v1 + NV, v0 + NV], uv[::-1], 2, False))
    # bottom ring
    fl = tv[-1]
    rb = PR[-1]
    for (a0, v0), (a1, v1) in zip(fl[:-1], fl[1:]):
        u0, u1 = Uk(-1, a0), Uk(-1, a1)
        plug = a0 >= rb[0] - 1e-9 and a1 <= rb[1] + 1e-9
        faces.append(([v1, v0, v0 + NV, v1 + NV], [(u1, 0.9), (u0, 0.9), (u0, 1.0), (u1, 1.0)], 3, plug))
    # border of the plug patch on the outer surface -> side faces
    edge_faces = {}
    for fi, (vids, uvs, kind, plug) in enumerate(faces):
        if kind != 1:
            continue
        n = len(vids)
        for e in range(n):
            a, b2 = vids[e], vids[(e + 1) % n]
            edge_faces.setdefault(frozenset((a, b2)), []).append((fi, a, b2))
    side = []
    for key, lst in edge_faces.items():
        if len(lst) == 2:
            p0, p1 = faces[lst[0][0]][3], faces[lst[1][0]][3]
            if p0 != p1:
                fi, a, b2 = lst[0] if p0 else lst[1]   # edge as walked by the plug face
                side.append((a, b2))
    return P, faces, side, NV, PR


def side_uv(P, a, b, NV):
    """faces through the wall along the plug cut: a plain block-interior strip of the tile"""
    L = math.dist(P[a], P[b])
    return 0.30, 0.30 + 0.15 * min(1.0, L / 0.54)


def make_mesh(name, P, flist):
    """flist: (vids, uvs, kind). Unused verts dropped."""
    used = sorted(set(v for f in flist for v in f[0]))
    remap = {v: i for i, v in enumerate(used)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([P[v] for v in used], [], [[remap[v] for v in f[0]] for f in flist])
    uvl = me.uv_layers.new(name="UVMap")
    li = 0
    for poly, f in zip(me.polygons, flist):
        for k, uv in enumerate(f[1]):
            uvl.data[poly.loop_start + k].uv = uv
    kind = me.attributes.new("kind", 'INT', 'FACE')
    kind.data.foreach_set("value", [f[2] for f in flist])
    me.update()
    return me


def dome_meshes():
    P, faces, side, NV, PR = build_dome()
    shell, plug = [], []
    for vids, uvs, kind, p in faces:
        (plug if p else shell).append((vids, uvs, kind))
    for a, b in side:
        ua, ub = side_uv(P, a, b, NV)
        # plug: walk the shared edge reversed (b -> a) then down to the inner face
        plug.append(([b, a, a + NV, b + NV], [(ub, 0.3), (ua, 0.3), (ua, 0.7), (ub, 0.7)], 4))
        shell.append(([a, b, b + NV, a + NV], [(ua, 0.3), (ub, 0.3), (ub, 0.7), (ua, 0.7)], 4))
    return P, shell, plug, PR, side


# ------------------------------------------------------------------ tunnel
def profile(a, zw, b, d, zlow=0.0, n=38, ext=False):
    """open profile from (+x, z=0) over the arch to (-x, z=0), resampled at n segments (fractions of
    the d=0 perimeter are the same for any offset d). ext adds points at zlow on both ends."""
    A2, B2 = a + d, b + d
    dense = [(A2, 0.0)]
    dense += [(A2, zw * i / 40) for i in range(1, 41)]
    dense += [(A2 * math.cos(t), zw + B2 * math.sin(t)) for t in np.linspace(0, math.pi, 400)[1:]]
    dense += [(-A2, zw * (1 - i / 40)) for i in range(1, 41)]
    dense = np.array(dense)
    seg = np.linalg.norm(np.diff(dense, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    # parametrize by the d=0 perimeter fractions: use per-piece normalization so walls/arch map alike
    f = np.linspace(0, 1, n + 1)
    pts = [tuple(np.array([np.interp(fi * s[-1], s, dense[:, 0]), np.interp(fi * s[-1], s, dense[:, 1])])) for fi in f]
    if ext:
        pts = [(pts[0][0], zlow)] + pts + [(pts[-1][0], zlow)]
    return pts


def prof_normal(x, z, a, zw, b):
    if z <= zw + 1e-6:
        return Vector((1.0 if x > 0 else -1.0, 0, 0))
    n = Vector((x / (a * a), 0, (z - zw) / (b * b)))
    return n.normalized()


def tube(rings, ncourse, closed_caps=True, bottom=True, ext=False):
    """rings: list of lists of 3D points (same count). Returns verts, faces(vids, uvs, kind)."""
    verts, faces = [], []
    npt = len(rings[0])
    for r in rings:
        verts += r
    off = 1 if ext else 0
    nseg = npt - 1 - 2 * off
    for j in range(len(rings) - 1):
        for i in range(npt - 1):
            ii = i - off
            c = max(0, min(ncourse - 1, ii // 2))
            ph = (0.37 * c + 0.1) % 1.0
            def uv(jj, iii):
                y = verts[jj * npt + iii][1]
                return (y / G["LT"] + ph, (iii - off - 2 * c) / 2.0)
            q = [j * npt + i, (j + 1) * npt + i, (j + 1) * npt + i + 1, j * npt + i + 1]
            faces.append((q, [uv(j, i), uv(j + 1, i), uv(j + 1, i + 1), uv(j, i + 1)], 5))
        if bottom:
            q = [j * npt + npt - 1, (j + 1) * npt + npt - 1, (j + 1) * npt, j * npt]
            faces.append((q, [(verts[v][0] / G["LT"], verts[v][1] / G["LT"]) for v in q], 6))
    if closed_caps:
        for j, sgn in ((0, 1), (len(rings) - 1, -1)):
            r = rings[j]
            c = Vector((sum(p[0] for p in r) / npt, sum(p[1] for p in r) / npt, sum(p[2] for p in r) / npt))
            ci = len(verts)
            verts.append(tuple(c))
            for i in range(npt):
                a, b = j * npt + i, j * npt + (i + 1) % npt
                faces.append(([a, b, ci], [(verts[a][0] / G["LT"], verts[a][2] / 0.6), (verts[b][0] / G["LT"], verts[b][2] / 0.6), (c.x / G["LT"], c.z / 0.6)], 6))
    return verts, faces


def tunnel_outer():
    a, zw, b = TUN_OUT
    base = profile(a, zw, b, 0.0, n=44)
    Rr = 9.3
    rings = [[(x, math.sqrt(Rr * Rr - x * x - z * z), z) for x, z in base]]
    for beta in (0, 30, 60, 90):
        br = math.radians(beta)
        d = -(LIP - LIP * math.cos(br))
        y = TUN_END - LIP + LIP * math.sin(br)
        rings.append([(x, y, z) for x, z in profile(a, zw, b, d, n=44)])
    return tube(rings, 22, bottom=True)


def tunnel_cutter():
    a, zw, b = TUN_IN
    rings = []
    # doorway lip on the inner dome sphere (quarter round in radius), then straight, then mouth lip
    def sph_ring(rho, d):
        return [(x, math.sqrt(max(rho * rho - x * x - z * z, 0.01)), z) for x, z in profile(a, zw, b, d, zlow=-0.5, ext=True)]
    rings.append(sph_ring(RI - 0.6, LIP))
    for beta in (0, 30, 60, 90):
        br = math.radians(beta)
        rings.append(sph_ring(RI + LIP - LIP * math.cos(br), LIP - LIP * math.sin(br)))
    for beta in (0, 30, 60, 90):
        br = math.radians(beta)
        d = LIP - LIP * math.cos(br)
        y = TUN_END - LIP + LIP * math.sin(br)
        rings.append([(x, y, z) for x, z in profile(a, zw, b, d, zlow=-0.5, ext=True)])
    rings.append([(x, TUN_END + 0.9, z) for x, z in profile(a, zw, b, LIP, zlow=-0.5, ext=True)])
    return tube(rings, 19, bottom=True, ext=True)
