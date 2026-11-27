"""SM_IceCave_Segment_A / _B builder (FoxSports Snowboard, Austria ice cave, job W2 lane A).

Run inside Blender 5.2 (MCP or headless):  exec(open(this_file).read()); build_all()
Game frame (three.js): +Y up, cave runs along +Z (downhill). Blender build: (x, y, z)_game -> (x, -z, y)_blender.
Both segment ends are the exact shared end profile (W2 brief); displacement tapers to 0 at z = 0 and z = 10,
end-ring normals are the pure 2D profile normals, and within 1.5 m of each end the textures blend into one
shared, z-periodic pattern, so A and B chain in any order without a seam.
"""
import math

import bmesh
import bpy
import numpy as np

PROF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25),
        (4.95, 4.95), (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
LEN = 10.0          # segment length (m)
NROWS = 28          # face rows along the run
SUB = 2             # sub-segments per profile segment (midpoints lie exactly on the profile polyline)
TEX = 1024          # base colour + normal size
ORM = 512           # roughness map size
U1 = 0.968          # inner surface uses u in [0, U1]; [0.972, 1] holds the hidden outer faces
SHARED_SEED = 7070  # the end-blend pattern every segment shares
END_BLEND = 1.5     # metres at each end that blend into the shared pattern
CLEAR_X, CLEAR_Y = 6.5, 4.0
OUTER = [(9.4, 0.0), (9.4, 5.0), (6.2, 7.6), (-6.2, 7.6), (-9.4, 5.0), (-9.4, 0.0)]

SEGMENTS = {"A": 1101, "B": 2202}


def arch():
    left = [(-x, y) for x, y in PROF]
    right = [(x, y) for x, y in reversed(PROF[:-1])]
    pts = left + right
    out = []
    for i in range(len(pts) - 1):
        a, b = np.array(pts[i]), np.array(pts[i + 1])
        for k in range(SUB):
            out.append(a + (b - a) * k / SUB)
    out.append(np.array(pts[-1]))
    P = np.array(out, dtype=np.float64)
    s = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    t = np.zeros_like(P)
    t[1:-1] = P[2:] - P[:-2]
    t[0] = P[1] - P[0]
    t[-1] = P[-1] - P[-2]
    t /= np.linalg.norm(t, axis=1)[:, None]
    n_in = np.stack([t[:, 1], -t[:, 0]], axis=1)  # inward (towards the cave axis)
    return P, s, n_in


PC, SC, NIN = arch()
L = float(SC[-1])


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def vnoise(S, Z, fs, nzc, seed):
    """Value noise, periodic in Z with period LEN (nzc cells per period)."""
    rng = np.random.default_rng(seed)
    ns = int(math.ceil(26 * fs)) + 4
    G = rng.random((ns, nzc)).astype(np.float32)
    x = S * fs + 1.0
    y = Z / LEN * nzc
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    fx, fy = x - xi, y - yi
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    x0, x1 = np.clip(xi, 0, ns - 1), np.clip(xi + 1, 0, ns - 1)
    y0, y1 = yi % nzc, (yi + 1) % nzc
    a, b, c, d = G[x0, y0], G[x1, y0], G[x0, y1], G[x1, y1]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def fbm(S, Z, fs, nzc, octaves, seed):
    tot, amp, norm = 0.0, 1.0, 0.0
    for k in range(octaves):
        tot = tot + amp * vnoise(S, Z, fs * 2 ** k, nzc * 2 ** k, seed + 101 * k)
        norm += amp
        amp *= 0.5
    return tot / norm


def worley(S, Z, fs, nzc, seed):
    """F1/F2 cellular distances (cell units), periodic in Z."""
    rng = np.random.default_rng(seed)
    ns = int(math.ceil(26 * fs)) + 6
    RX = rng.random((ns, nzc)).astype(np.float32)
    RY = rng.random((ns, nzc)).astype(np.float32)
    x = S * fs + 2.0
    y = Z / LEN * nzc
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    F1 = np.full(x.shape, 9.0, np.float32)
    F2 = np.full(x.shape, 9.0, np.float32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cx = np.clip(xi + dx, 0, ns - 1)
            cy = yi + dy
            px = cx + RX[cx, cy % nzc]
            py = cy + RY[cx, cy % nzc]
            d = np.sqrt((x - px) ** 2 + (y - py) ** 2)
            F2 = np.where(d < F1, F1, np.minimum(F2, d))
            F1 = np.minimum(F1, d)
    return F1, F2


def fields(S, Z, seed, edge_m=0.08, edge_n=0.02):
    """Ice mask, height (m), colour (sRGB) and roughness at arc-length S / run Z."""
    y = np.interp(S, SC, PC[:, 1])
    hn = y / 6.2
    # ice curtains: ice covers the arch from the top down to a fingered drip line
    f1 = fbm(S, Z, 0.10, 16, 2, seed + 1)
    yd = 0.35 + 3.1 * np.clip((f1 - 0.30) / 0.42, 0, 1)
    drip = sstep(yd - edge_m, yd + edge_m, y)
    # rock windows higher up (fewer on the ceiling)
    rp = fbm(S, Z, 0.30, 4, 3, seed + 2)
    ceil = sstep(0.78, 0.95, hn)
    thr = 0.61 + 0.10 * ceil
    rockwin = sstep(thr - edge_n, thr + edge_n, rp)
    M = drip * (1 - rockwin)
    th = fbm(S, Z, 0.25, 5, 3, seed + 3)
    streak = fbm(S, Z, 0.35, 48, 2, seed + 4)          # slow along the arc, fast along the run
    ripple = fbm(S, Z, 0.6, 6, 3, seed + 10)            # blobby flow ice on the ceiling
    wcl = sstep(0.72, 0.95, hn)
    streak = streak * (1 - wcl) + ripple * wcl
    lip = np.exp(-((y - yd) / 0.30) ** 2)               # rounded drip ends
    base = fbm(S, Z, 1.0, 10, 4, seed + 5)
    wa = fbm(S, Z, 0.7, 7, 2, seed + 11) - 0.5          # domain warp: irregular, non-tiled lumps
    wb = fbm(S, Z, 0.7, 7, 2, seed + 12) - 0.5
    F1, F2 = worley(S + 0.9 * wa, Z + 0.9 * wb, 0.9, 9, seed + 6)   # soft rounded rock lumps
    lump = 1 - np.clip(F1, 0, 1) ** 2
    crack = (1 - sstep(0.0, 0.10, F2 - F1)) * sstep(0.45, 0.6, base)
    fine = fbm(S, Z, 3.0, 30, 3, seed + 9)
    # height (m): ice sits ~3.5 cm proud of the rock, glassy flow ridges, rounded lips
    Hr = 0.045 * lump - 0.012 * crack + 0.04 * (base - 0.5) + 0.012 * (fine - 0.5) - 0.03
    Hi = 0.013 * (streak - 0.5) * 2 + 0.018 * (th - 0.5) + 0.016 * lip + 0.035 + 0.002 * (fine - 0.5)
    H = Hr * (1 - M) + Hi * M
    # colours (sRGB)
    rdark, rlight = np.array([0.19, 0.25, 0.36]), np.array([0.37, 0.46, 0.59])
    rt = np.clip(0.25 + 0.9 * (base - 0.5) + 0.55 * lump + 0.3 * (fine - 0.5), 0, 1)[..., None]
    rock = (rdark + (rlight - rdark) * rt) * (1 - 0.18 * crack)[..., None]
    fr = sstep(0.9, 0.0, y) * sstep(0.35, 0.62, fbm(S, Z, 0.8, 8, 2, seed + 7))
    snow = np.array([0.80, 0.87, 0.95])
    rock = rock + (snow - rock) * (0.85 * fr)[..., None]
    deep, mid, bright = np.array([0.07, 0.28, 0.54]), np.array([0.17, 0.52, 0.77]), np.array([0.50, 0.84, 0.95])
    t = np.clip(0.55 + 1.1 * (th - 0.5) + 0.9 * (streak - 0.5) - 0.30 * hn, 0, 1)
    t1 = np.clip(t * 2, 0, 1)[..., None]
    t2 = np.clip(t * 2 - 1, 0, 1)[..., None]
    ice = deep + (mid - deep) * t1 + (bright - mid) * t2
    frosty = np.array([0.74, 0.90, 0.97])
    ice = ice + (frosty - ice) * (0.55 * lip * (1 - ceil))[..., None]
    col = rock + (ice - rock) * M[..., None]
    rough = (0.7 + 0.1 * fr) * (1 - M) + (0.12 + 0.06 * streak + 0.05 * lip) * M
    return dict(M=M, H=H, col=col, rough=rough)


def end_weight(Z):
    return 1 - sstep(0.0, END_BLEND, np.minimum(Z, LEN - Z))


def blended(S, Z, seed, **kw):
    a = fields(S, Z, seed, **kw)
    b = fields(S, Z, SHARED_SEED, **kw)
    w = end_weight(Z)
    out = {}
    for k in a:
        ww = w[..., None] if a[k].ndim == 3 else w
        out[k] = a[k] + (b[k] - a[k]) * ww
    return out


# ---------------------------------------------------------------- textures
def make_textures(tag, seed):
    u = (np.arange(TEX) + 0.5) / TEX
    v = (np.arange(TEX) + 0.5) / TEX
    U, V = np.meshgrid(u, v)            # row 0 = v bottom = z 0
    S = np.clip(U / U1 * L, 0, L)
    Z = V * LEN
    f = blended(S, Z, seed)
    strip = U > 0.970
    col, H, rough = f["col"], f["H"], f["rough"]
    col[strip] = [0.24, 0.28, 0.35]
    H[strip] = 0.0
    rough[strip] = 0.7
    ds = L / (U1 * TEX)
    dz = LEN / TEX
    dHs = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) / (2 * ds)
    dHz = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) / (2 * dz)
    k = 1.6
    n = np.stack([-dHs * k, -dHz * k, np.ones_like(H)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    n[strip] = [0, 0, 1]
    nrm = n * 0.5 + 0.5
    # ORM at half size (R occlusion 1, G roughness, B metal 0)
    r2 = rough.reshape(ORM, TEX // ORM, ORM, TEX // ORM).mean(axis=(1, 3))
    orm = np.stack([np.ones_like(r2), r2, np.zeros_like(r2)], -1)

    def img(name, arr, size, data):
        im = bpy.data.images.get(name)
        if im:
            bpy.data.images.remove(im)
        im = bpy.data.images.new(name, size, size, alpha=False)
        im.colorspace_settings.name = "Non-Color" if data else "sRGB"
        rgba = np.concatenate([arr.reshape(-1, 3), np.ones((size * size, 1))], 1).astype(np.float32)
        im.pixels.foreach_set(rgba.ravel())
        im.pack()
        return im

    return (img(f"T_IceCave_Segment_{tag}_BaseColor", np.clip(col, 0, 1), TEX, False),
            img(f"T_IceCave_Segment_{tag}_ORM", orm, ORM, True),
            img(f"T_IceCave_Segment_{tag}_Normal", nrm, TEX, True))


def make_material(tag, bc, orm, nrm):
    name = f"M_IceCave_Segment_{tag}"
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True   # single-sided: only the inside faces are ever seen
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tb = nt.nodes.new("ShaderNodeTexImage"); tb.image = bc
    to = nt.nodes.new("ShaderNodeTexImage"); to.image = orm
    tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm
    sp = nt.nodes.new("ShaderNodeSeparateColor")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    out.location, bs.location = (400, 0), (100, 0)
    tb.location, to.location, tn.location = (-500, 300), (-500, 0), (-500, -300)
    sp.location, nm.location = (-200, 0), (-200, -300)
    L_ = nt.links.new
    L_(tb.outputs["Color"], bs.inputs["Base Color"])
    L_(tb.outputs["Color"], bs.inputs["Emission Color"])
    bs.inputs["Emission Strength"].default_value = 0.10
    L_(to.outputs["Color"], sp.inputs["Color"])
    L_(sp.outputs["Green"], bs.inputs["Roughness"])
    L_(sp.outputs["Blue"], bs.inputs["Metallic"])
    L_(tn.outputs["Color"], nm.inputs["Color"])
    L_(nm.outputs["Normal"], bs.inputs["Normal"])
    L_(bs.outputs["BSDF"], out.inputs["Surface"])
    return m


# ---------------------------------------------------------------- geometry
def displacement(seed):
    zr = np.linspace(0, LEN, NROWS + 1)
    Sv, Zv = np.meshgrid(SC, zr)        # [row, col]
    f = blended(Sv, Zv, seed, edge_m=0.55, edge_n=0.07)
    g = fbm(Sv, Zv, 0.22, 3, 3, seed + 8)
    D = 0.30 * (2 * g - 1) + 0.26 * (f["M"] - 0.45)
    D = np.clip(D, -0.45, 0.45)
    D *= sstep(0.0, 1.8, np.minimum(Zv, LEN - Zv))
    D[:, 0] = 0.0                        # wall foot stays on x = +-8, y = 0 (meets the game floor, no floor faces inside)
    D[:, -1] = 0.0
    D[0, :] = 0.0
    D[-1, :] = 0.0
    # positions (game frame)
    X = PC[None, :, 0] + NIN[None, :, 0] * D
    Y = PC[None, :, 1] + NIN[None, :, 1] * D
    # rider clear space: no inward bulge into |x| < 6.5, y < 4
    for _ in range(40):
        bad = (Y < CLEAR_Y) & (np.abs(X) < CLEAR_X) & (D > 0)
        if not bad.any():
            break
        D[bad] = np.maximum(D[bad] - 0.03, 0)
        X = PC[None, :, 0] + NIN[None, :, 0] * D
        Y = PC[None, :, 1] + NIN[None, :, 1] * D
    Y = np.maximum(Y, 0.0)
    Y[:, 0] = 0.0
    Y[:, -1] = 0.0
    Zg = np.broadcast_to(zr[:, None], X.shape)
    P = np.stack([X, Y, Zg], -1)
    # normals: cross(dP/ds, dP/dz), inward
    dPs = np.zeros_like(P)
    dPs[:, 1:-1] = P[:, 2:] - P[:, :-2]
    dPs[:, 0] = P[:, 1] - P[:, 0]
    dPs[:, -1] = P[:, -1] - P[:, -2]
    dPz = np.zeros_like(P)
    dPz[1:-1] = P[2:] - P[:-2]
    dPz[0] = P[1] - P[0]
    dPz[-1] = P[-1] - P[-2]
    N = np.cross(dPs, dPz)
    N /= np.linalg.norm(N, axis=-1, keepdims=True)
    end = np.stack([NIN[:, 0], NIN[:, 1], np.zeros(len(NIN))], -1)
    N[0] = end
    N[-1] = end
    return P, N, zr, D


def g2b(p):
    return (float(p[0]), float(-p[2]), float(p[1]))


def build(tag, seed, coll):
    name = f"SM_IceCave_Segment_{tag}"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old)
    P, N, zr, D = displacement(seed)
    R, C = P.shape[0], P.shape[1]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    V = [[bm.verts.new(g2b(P[r, c])) for c in range(C)] for r in range(R)]
    custom = {}  # loop -> normal (blender frame)
    inner = []
    for r in range(R - 1):
        for c in range(C - 1):
            q = (V[r][c], V[r][c + 1], V[r + 1][c + 1], V[r + 1][c])
            f = bm.faces.new(q)
            inner.append((f, ((r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c))))
    # outer shell: bottom strips, outer box, end caps
    O0 = [bm.verts.new(g2b((x, y, 0.0))) for x, y in OUTER]
    O1 = [bm.verts.new(g2b((x, y, LEN))) for x, y in OUTER]
    hidden = []
    for i in range(len(OUTER) - 1):
        hidden.append(bm.faces.new((O0[i], O0[i + 1], O1[i + 1], O1[i])))
    # floor strips and caps share every boundary vertex of the inner surface (no T-junctions)
    ngons = [
        bm.faces.new([V[r][C - 1] for r in range(R)] + [O1[0], O0[0]]),        # right floor strip
        bm.faces.new([O0[-1], O1[-1]] + [V[r][0] for r in reversed(range(R))]),  # left floor strip
        bm.faces.new([V[0][c] for c in range(C)] + O0),                          # uphill cap
        bm.faces.new([V[R - 1][c] for c in range(C)] + O1),                      # downhill cap
    ]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    ngroups = []
    for f in ngons:
        tri = bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")
        ngroups.append(tri["faces"])
    bm.normal_update()
    # UVs: inner = arc length / run, hidden faces packed into the right strip
    for f, ids in inner:
        for lp, (r, c) in zip(f.loops, ids):
            lp[uvl].uv = (U1 * SC[c] / L, zr[r] / LEN)
            n = N[r, c]
            custom[lp] = (float(n[0]), float(-n[2]), float(n[1]))
    groups = [[f] for f in hidden] + ngroups
    slot_h = 1.0 / len(groups)
    for gi, grp in enumerate(groups):
        pts = [v.co for f in grp for v in f.verts]
        # project on the face plane's two largest axes
        nrm = grp[0].normal
        ax = sorted(range(3), key=lambda i: abs(nrm[i]))[:2]
        lo = [min(p[a] for p in pts) for a in ax]
        hi = [max(p[a] for p in pts) for a in ax]
        for f in grp:
            for lp in f.loops:
                a = (lp.vert.co[ax[0]] - lo[0]) / max(hi[0] - lo[0], 1e-6)
                b = (lp.vert.co[ax[1]] - lo[1]) / max(hi[1] - lo[1], 1e-6)
                lp[uvl].uv = (0.975 + 0.022 * a, gi * slot_h + 0.01 + (slot_h - 0.02) * b)
                custom[lp] = tuple(f.normal)
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.get(name)
    if me:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    # loop order of me matches bm loop order (faces/loops in index order)
    loop_normals = []
    for f in bm.faces:
        for lp in f.loops:
            loop_normals.append(custom[lp])
    bm.free()
    me.normals_split_custom_set(loop_normals)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob, D


def build_all(sc=None):
    sc = sc or bpy.data.scenes.get("LaneA_IceCave") or bpy.data.scenes.new("LaneA_IceCave")
    coll = bpy.data.collections.get("IceCave_Segments")
    if not coll:
        coll = bpy.data.collections.new("IceCave_Segments")
        sc.collection.children.link(coll)
    info = {}
    for tag, seed in SEGMENTS.items():
        bc, orm, nrm = make_textures(tag, seed)
        mat = make_material(tag, bc, orm, nrm)
        ob, D = build(tag, seed, coll)
        ob.data.materials.append(mat)
        info[tag] = dict(tris=sum(len(p.vertices) - 2 for p in ob.data.polygons), dmin=float(D.min()), dmax=float(D.max()))
    return info


def export_all(out_dir):
    """One GLB per segment: +Y up, plain glTF (no Draco/meshopt), JPEG textures, no cameras/lights.
    Run headless with the segments in the context scene."""
    sc = bpy.context.scene
    paths = {}
    for tag in SEGMENTS:
        ob = bpy.data.objects[f"SM_IceCave_Segment_{tag}"]
        for o in sc.objects:
            o.select_set(o == ob)
        bpy.context.view_layer.objects.active = ob
        p = f"{out_dir}/SM_IceCave_Segment_{tag}.glb"
        bpy.ops.export_scene.gltf(filepath=p, export_format="GLB", use_selection=True, export_yup=True,
                                  export_apply=True, export_image_format="JPEG", export_image_quality=85,
                                  export_jpeg_quality=85, export_tangents=True, export_normals=True,
                                  export_cameras=False, export_lights=False, export_materials="EXPORT",
                                  export_draco_mesh_compression_enable=False, export_extras=False,
                                  export_animations=False, export_skins=False, export_morph=False)
        paths[tag] = p
    return paths
