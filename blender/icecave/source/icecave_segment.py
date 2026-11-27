"""SM_IceCave_Segment_A / _B / _C builder (FoxSports Snowboard, Austria ice cave, job W2b lane A).

W2b look: "a rock cave covered in ice, mostly". Dark grey-brown rock masses, ledges and floor rubble
break the surface; ice sheets, flows and drip curtains lie over the rock; ~30 % rock shows.

Run inside Blender 5.2 (MCP or headless):  exec(open(this_file).read()); build_all()
Game frame (three.js): +Y up, cave runs along +Z (downhill). Blender build: (x, y, z)_game -> (x, -z, y)_blender.

Contract kept from W2: both ends are the exact 41-point end ring (the 21-point profile, every segment split
in two), displacement tapers to 0 (with zero slope) at z = 0 and z = 10, end-ring normals are the pure 2D
profile normals, and within END_BLEND of each end the textures blend into one shared, z-periodic pattern,
so A, B and C chain in any order without a seam.

Geometry: a dense height field over (arc length S, run Z) is displaced along the smoothed inward profile
normal, then reduced with a collapse decimate in which the 41 + 41 end-ring vertices are locked (weight 0),
then closed with the hidden outer shell (floor strips, outer box, end caps) of the W2 build.
"""
import math

import bmesh
import bpy
import numpy as np

PROF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25),
        (4.95, 4.95), (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
LEN = 10.0          # segment length (m)
SUB = 2             # ring: sub-segments per profile segment -> 41 points
DSUB = 4            # dense columns per ring interval -> 161 columns
DROWS = 100         # dense rows along the run (0.1 m)
TEX = 1024          # base colour + normal size
SMALL = 512         # roughness (ORM) + emissive mask size
U1 = 0.968          # inner surface uses u in [0, U1]; [0.972, 1] holds the hidden outer faces
END_BLEND = 1.5     # metres at each end that blend into the shared texture pattern
CLEAR_X, CLEAR_Y = 6.55, 4.05     # rider clear box (+5 cm margin): no inward bulge into it
DMAX = 0.60         # wall/ceiling bulge limit (m, either way)
RUBMAX = 0.90       # floor-line rubble limit (inward, m) -> foot stays at |x| >= 7.1
TRI_BUDGET = 2500
ROCK_TARGET = 0.30  # rock share of the inner surface (brief: 25-35 %)
HF, FLOW, MASS_K = 0.05, 0.16, 1.35
BAND = 0.15
ROCK_PROUD = 0.9
CEIL = 0.10           # icier crown: fewer small rock spots overhead
EMIT = 0.08         # emissive strength (glTF emissiveFactor), masked to thick ice
OUTER = [(9.9, 0.0), (9.9, 5.2), (6.6, 8.1), (-6.6, 8.1), (-9.9, 5.2), (-9.9, 0.0)]

# per-segment character: A = buttress + frozen fall, B = strata ledges + curtains, C = rock boss + ice flow
# heroes: (S as fraction of the arc, Z, width S, width Z, amplitude); falls: (side -1/1, Z, width, lowest y, thickness)
SEGMENTS = {
    "A": dict(seed=1101, mass=0.36, ledge=0.20, lper=1.15, lph=0.20, drip=2.3, plinth=0.30, rub_amp=1.0, rub_len=1.0,
              heroes=[(0.17, 5.0, 1.6, 2.0, 0.34), (0.70, 2.8, 1.8, 1.4, 0.16)],
              falls=[(1, 6.6, 0.9, 0.35, 0.34)]),
    "B": dict(seed=2202, mass=0.24, ledge=0.36, lper=0.95, lph=0.55, drip=1.7, plinth=0.36, rub_amp=0.85, rub_len=1.2,
              heroes=[(0.83, 5.4, 1.5, 2.4, 0.22)],
              falls=[(-1, 3.6, 0.6, 1.2, 0.22), (1, 7.8, 0.5, 1.4, 0.20)]),
    "C": dict(seed=3303, mass=0.40, ledge=0.16, lper=1.30, lph=0.80, drip=2.8, plinth=0.26, rub_amp=1.15, rub_len=0.85,
              heroes=[(0.56, 5.6, 2.0, 2.2, 0.36), (0.26, 7.6, 1.2, 1.3, 0.18)],
              falls=[(-1, 3.4, 1.3, 0.30, 0.38)]),
}
SHARED = dict(seed=7070, mass=0.30, ledge=0.24, lper=1.10, lph=0.40, drip=2.2, plinth=0.30, rub_amp=1.0, rub_len=1.0,
              heroes=[], falls=[])


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smax(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return a + (b - a) * h + k * h * (1 - h)


def smin(a, b, k):
    return -smax(-a, -b, k)


def arch(sub, smooth_m=0.0):
    left = [(-x, y) for x, y in PROF]
    right = [(x, y) for x, y in reversed(PROF[:-1])]
    pts = left + right
    out = []
    for i in range(len(pts) - 1):
        a, b = np.array(pts[i]), np.array(pts[i + 1])
        for k in range(sub):
            out.append(a + (b - a) * (k / sub))
    out.append(np.array(pts[-1]))
    P = np.array(out, dtype=np.float64)
    s = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    t = np.zeros_like(P)
    t[1:-1] = P[2:] - P[:-2]
    t[0] = P[1] - P[0]
    t[-1] = P[-1] - P[-2]
    t /= np.linalg.norm(t, axis=1)[:, None]
    if smooth_m > 0:            # gaussian-smoothed tangent: displacement directions turn gently at corners
        w = np.exp(-((s[:, None] - s[None, :]) / smooth_m) ** 2)
        t = w @ t
        t /= np.linalg.norm(t, axis=1)[:, None]
    n_in = np.stack([t[:, 1], -t[:, 0]], axis=1)  # inward (towards the cave axis)
    return P, s, n_in


PC, SC, NIN = arch(SUB)                    # the 41-point end ring
PD, SDn, ND = arch(SUB * DSUB, 0.45)       # dense columns (every 4th is a ring point)
L = float(SC[-1])


# ---------------------------------------------------------------- noise (periodic in Z with period LEN)
def vnoise(S, Z, fs, nzc, seed):
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
    F1 = np.full(np.shape(x), 9.0, np.float32)
    F2 = np.full(np.shape(x), 9.0, np.float32)
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


# ---------------------------------------------------------------- scalar fields
_BOULDERS = {}


def boulders(p):
    key = p["seed"]
    if key not in _BOULDERS:
        rng = np.random.default_rng(p["seed"] + 77)
        out = []
        for side in (0, 1):
            z = rng.uniform(-0.6, 0.2)
            while z < LEN + 0.6:
                a = rng.uniform(0.35, 0.85) * p["rub_len"]
                h = rng.uniform(0.32, 0.88)
                A = min(rng.uniform(0.28, 0.78) * p["rub_amp"], 0.85)
                out.append((side, z, a, h, A))
                z += a * rng.uniform(1.05, 1.9)
        _BOULDERS[key] = out
    return _BOULDERS[key]


def rubble(S, Z, p):
    """Floor-line rubble (inward metres): half-buried boulders against the wall foot plus a low rock plinth."""
    R = np.zeros(np.shape(S), np.float64)
    for side, zc, a, h, A in boulders(p):
        sf = S if side == 0 else L - S
        dz = np.mod(Z - zc + LEN / 2, LEN) - LEN / 2      # periodic in Z like every other field
        v = 1 - (sf / h) ** 2 - (dz / a) ** 2
        R = np.maximum(R, A * np.sqrt(np.clip(v, 0, 1)))
    sF = np.minimum(S, L - S)
    pl = p["plinth"] * (0.55 + 0.9 * fbm(S, Z, 0.45, 6, 2, p["seed"] + 40))
    R = np.maximum(R, pl * np.sqrt(np.clip(1 - (sF / 0.48) ** 2, 0, 1)))
    return R


def scal(S, Z, p, ice_off=0.0):
    """Macro fields of one pattern (seeded): rock relief, ice thickness, curtains, rubble."""
    sd = p["seed"]
    y = np.interp(S, SC, PC[:, 1])
    sF = np.minimum(S, L - S)
    wa = fbm(S, Z, 0.18, 2, 2, sd + 11) - 0.5
    wb = fbm(S, Z, 0.18, 2, 2, sd + 12) - 0.5
    Rlow = 0.20 * (2 * fbm(S, Z, 0.10, 2, 2, sd + 1) - 1)
    # big rock masses: warped cellular domes, creased between cells
    F1, F2 = worley(S + 2.6 * wa, Z + 2.6 * wb, 0.27, 3, sd + 2)
    dome = np.clip(1 - 1.15 * F1, 0, 1)
    dome = dome * dome * (3 - 2 * dome)
    crease = 1 - sstep(0.0, 0.12, F2 - F1)
    amp = MASS_K * p["mass"] * (0.55 + 0.9 * fbm(S, Z, 0.09, 2, 1, sd + 3))
    for fs_, z0, ws, wz, a in p["heroes"]:
        amp = amp + a * np.exp(-((S - fs_ * L) / ws) ** 2 - ((Z - z0) / wz) ** 2)
    mf = fbm(S + 1.5 * wb, Z + 1.5 * wa, 0.32, 4, 2, sd + 13)
    masses = amp * (0.10 + 0.90 * (0.62 * dome + 0.38 * mf)) * (1 - 0.12 * crease)
    # rock ledges (strata shelves) on the walls: slow rise, sharp drop = shelf top
    lw = fbm(S, Z, 0.22, 4, 2, sd + 4) - 0.5
    ph = (y + 0.9 * lw) / p["lper"] + p["lph"]
    tt = ph - np.floor(ph)
    saw = sstep(0.0, 0.75, tt) * (1 - sstep(0.80, 0.96, tt))
    on = sstep(0.42, 0.58, fbm(S, Z, 0.15, 5, 2, sd + 5)) * sstep(0.7, 1.2, y) * (1 - sstep(3.3, 4.3, y))
    ledges = p["ledge"] * saw * on
    Rhigh = np.maximum(masses, ledges)
    # ice: thicker with height, flows, fingered drip curtains, frozen falls
    hfac = sstep(0.6, 4.8, y)
    streak = fbm(S, Z, 0.30, 36, 2, sd + 8)
    flow = FLOW * (2 * fbm(S, Z, 0.20, 4, 2, sd + 7) - 1)
    yd = p["drip"] + 1.3 * (2 * fbm(S, Z, 0.08, 14, 2, sd + 9) - 1) + 0.35 * (2 * streak - 1)
    curt = sstep(yd - 0.08, yd + 0.40, y) * (1 - sstep(4.2, 5.4, y))
    jag = 2 * fbm(S, Z, 1.1, 11, 2, sd + 14) - 1          # ragged ice edges
    t = ice_off + HF * hfac + CEIL * sstep(5.0, 6.1, y) + flow + curt * (0.04 + 0.12 * streak) + 0.05 * jag
    for side, z0, wz, ybot, a in p["falls"]:
        sm = (S > L / 2) if side > 0 else (S < L / 2)
        g = np.exp(-((Z - z0) / wz) ** 2) * sm * sstep(ybot, ybot + 0.7, y) * (1 - sstep(4.0, 5.2, y))
        t = t + a * g * (0.75 + 0.5 * streak)
    rub = rubble(S, Z, p)
    t = t - BAND * (1 - sstep(0.45, 1.35, sF)) - 1.2 * rub
    lip = np.exp(-((y - yd) / 0.22) ** 2) * (1 - sstep(4.0, 5.0, y))
    return dict(y=y, sF=sF, Rlow=Rlow, Rhigh=Rhigh, t=t, rub=rub, crease=crease, dome=dome,
                streak=streak, curt=curt, lip=lip, ledge_on=on * sstep(0.84, 0.95, tt))


def calibrate(p, n=220):
    """Ice offset so ROCK_TARGET of the surface is bare rock; D centre offset so walls keep the mean ring."""
    S, Z = np.meshgrid((np.arange(n) + 0.5) / n * L, (np.arange(n) + 0.5) / n * LEN)
    base = scal(S, Z, p, 0.0)
    lo, hi = -0.8, 1.2
    for _ in range(30):
        mid = 0.5 * (lo + hi)
        share = float(((base["t"] + mid - base["Rhigh"]) < 0).mean())
        if share > ROCK_TARGET:
            lo = mid
        else:
            hi = mid
    p["ice_off"] = 0.5 * (lo + hi)
    ti = base["t"] + p["ice_off"]
    surf = base["Rlow"] + smax(base["Rhigh"] + ROCK_PROUD * np.maximum(base["Rhigh"] - ti, 0.0), ti, 0.06)
    p["c0"] = float(surf[base["sF"] > 1.4].mean())
    return p


for _p in list(SEGMENTS.values()) + [SHARED]:
    calibrate(_p)


def taper(Z, a, b):
    return sstep(a, b, np.minimum(Z, LEN - Z))


def clear_limit(P, N):
    """Per column: how far (m) a point may move inward before entering the rider clear box."""
    x, y = np.abs(P[:, 0]), P[:, 1]
    nx, ny = -np.abs(N[:, 0]), N[:, 1]          # inward moves |x| down
    inside = (x < CLEAR_X) & (y < CLEAR_Y)
    with np.errstate(divide="ignore", invalid="ignore"):
        tx = np.where(x > CLEAR_X, np.where(nx < 0, (x - CLEAR_X) / -nx, np.inf), 0.0)
        ty = np.where(y > CLEAR_Y, np.where(ny < 0, (y - CLEAR_Y) / -ny, np.inf), 0.0)
    lim = np.maximum(tx, ty)
    lim[inside] = 0.0
    return np.minimum(lim, 3.0)


DLIM = clear_limit(PD, ND)


def geo_D(S, Z, p):
    f = scal(S, Z, p, p["ice_off"])
    proud = f["Rhigh"] + ROCK_PROUD * np.maximum(f["Rhigh"] - f["t"], 0.0)   # rock masses stand out of the ice
    D = f["Rlow"] + smax(proud, f["t"], 0.06) - p["c0"]
    D = DMAX * np.tanh(D / DMAX)
    D = D * sstep(0.15, 1.1, f["sF"]) + f["rub"] * taper(Z, 0.05, 0.85)
    D = np.where(D > DMAX, DMAX + (RUBMAX - DMAX) * np.tanh((D - DMAX) / (RUBMAX - DMAX)), D)
    return D, f


# ---------------------------------------------------------------- textures
def tex_fields(S, Z, p):
    a = scal(S, Z, p, p["ice_off"])
    b = scal(S, Z, SHARED, SHARED["ice_off"])
    w = 1 - sstep(0.0, END_BLEND, np.minimum(Z, LEN - Z))
    f = {k: a[k] + (b[k] - a[k]) * w for k in a}
    y = f["y"]
    hn = y / 6.2
    th = f["t"] - f["Rhigh"]                     # ice thickness over the rock (m)
    M = sstep(-0.012, 0.012, th)                 # ice cover
    thick = sstep(0.0, 0.07, th)
    # fine detail: one common pattern for every segment (no seam), periodic in Z
    fine = fbm(S, Z, 3.0, 30, 3, 501)
    lum = fbm(S, Z, 1.1, 11, 3, 502)
    lumps = fbm(S, Z, 0.8, 8, 2, 503)
    rip = fbm(S, Z, 0.6, 6, 3, 504)
    cw = fbm(S, Z, 0.5, 5, 2, 507) - 0.5
    G1, G2 = worley(S + 0.8 * cw, Z + 0.8 * cw, 0.65, 7, 505)
    crack = (1 - sstep(0.0, 0.045, G2 - G1)) * sstep(0.42, 0.62, fbm(S, Z, 0.4, 4, 2, 508))
    pebble = np.abs(2 * fbm(S, Z, 1.6, 16, 3, 509) - 1)          # ridged grain: soft facets, no tiles
    strata = np.sin(2 * np.pi * (y * 1.7 + 0.8 * fbm(S, Z, 0.3, 3, 2, 506)))
    # rock: dark grey-brown, lighter on protrusions and boulders, dark creases and recesses
    rdark, rlight = np.array([0.11, 0.10, 0.093]), np.array([0.40, 0.36, 0.32])
    rt = np.clip(0.18 + 0.75 * (lum - 0.5) + 0.20 * f["dome"] + 0.40 * sstep(0.0, 0.22, -th) + 0.25 * (fine - 0.5) + 0.18 * pebble
                 + 0.25 * sstep(0.05, 0.45, f["rub"]) + 0.25 * f["ledge_on"], 0, 1)
    rock = rdark + (rlight - rdark) * rt[..., None]
    rock = rock * (1 + 0.06 * strata)[..., None] * (1 - 0.30 * f["crease"] - 0.35 * crack)[..., None]
    rock = rock * (0.72 + 0.28 * sstep(-0.15, 0.30, f["Rhigh"] + f["rub"]))[..., None]
    rock = np.maximum(rock, 0.045)
    # ice: thin glaze over rock -> deep blue body -> cyan highlights in curtains and flows
    deep, mid, cyan = np.array([0.03, 0.15, 0.32]), np.array([0.07, 0.31, 0.53]), np.array([0.20, 0.55, 0.72])
    v = np.clip(0.42 + 0.9 * (f["streak"] - 0.5) * (0.4 + f["curt"]) + 0.6 * (rip - 0.5) - 0.22 * hn
                + 0.25 * f["lip"], 0, 1)
    v1 = np.clip(v * 2, 0, 1)[..., None]
    v2 = np.clip(v * 2 - 1, 0, 1)[..., None]
    body = deep + (mid - deep) * v1 + (cyan - mid) * v2
    glaze = rock * 0.45 + np.array([0.09, 0.30, 0.44]) * 0.55
    icec = glaze + (body - glaze) * thick[..., None]
    frost = np.array([0.46, 0.73, 0.85])
    icec = icec + (frost - icec) * (0.45 * f["lip"] * f["curt"])[..., None]
    col = rock + (icec - rock) * M[..., None]
    rough = 0.75 + 0.03 * (fine - 0.5)
    rough_i = 0.20 + (0.12 + 0.06 * f["streak"] - 0.20) * thick
    rough = rough + (rough_i - rough) * M
    emis = M * sstep(0.10, 0.30, th)
    # height for the normal map (m): rock grain and cracks, smooth glassy ice with flow ridges and drip lips
    Hr = 0.06 * (lumps - 0.5) - 0.025 * pebble + 0.015 * (fine - 0.5) - 0.012 * crack - 0.02 * f["crease"] + 0.008 * strata
    Hi = 0.035 + 0.012 * (2 * f["streak"] - 1) * (0.3 + f["curt"]) + 0.010 * (rip - 0.5) + 0.016 * f["lip"]
    H = Hr + (Hi - Hr) * M
    return dict(col=col, rough=rough, emis=emis, H=H, M=M)


def make_textures(tag, p):
    u = (np.arange(TEX) + 0.5) / TEX
    U, V = np.meshgrid(u, u)            # row 0 = v bottom = z 0
    S = np.clip(U / U1 * L, 0, L)
    Z = V * LEN
    f = tex_fields(S, Z, p)
    strip = U > 0.970
    col, H, rough, emis = f["col"], f["H"], f["rough"], f["emis"]
    inner = U < U1
    stats = dict(rock_share_field=float((f["M"][inner] < 0.5).mean()))
    col[strip] = [0.16, 0.15, 0.14]
    H[strip] = 0.0
    rough[strip] = 0.75
    emis[strip] = 0.0
    ds = L / (U1 * TEX)
    dz = LEN / TEX
    dHs = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) / (2 * ds)
    dHz = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) / (2 * dz)
    k = 1.5
    n = np.stack([-dHs * k, -dHz * k, np.ones_like(H)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    n[strip] = [0, 0, 1]
    nrm = n * 0.5 + 0.5
    r = TEX // SMALL
    r2 = rough.reshape(SMALL, r, SMALL, r).mean(axis=(1, 3))
    orm = np.stack([np.ones_like(r2), r2, np.zeros_like(r2)], -1)     # R occlusion 1, G roughness, B metal 0
    e2 = emis.reshape(SMALL, r, SMALL, r).mean(axis=(1, 3))
    ecol = np.array([0.30, 0.70, 0.95])[None, None, :] * e2[..., None]  # sRGB glow colour x thick-ice mask

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
            img(f"T_IceCave_Segment_{tag}_ORM", orm, SMALL, True),
            img(f"T_IceCave_Segment_{tag}_Normal", nrm, TEX, True),
            img(f"T_IceCave_Segment_{tag}_Emissive", np.clip(ecol, 0, 1), SMALL, False)), stats


def make_material(tag, bc, orm, nrm, emi):
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
    te = nt.nodes.new("ShaderNodeTexImage"); te.image = emi
    sp = nt.nodes.new("ShaderNodeSeparateColor")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    out.location, bs.location = (400, 0), (100, 0)
    tb.location, to.location, tn.location, te.location = (-500, 300), (-500, 0), (-500, -300), (-500, -600)
    sp.location, nm.location = (-200, 0), (-200, -300)
    L_ = nt.links.new
    L_(tb.outputs["Color"], bs.inputs["Base Color"])
    L_(te.outputs["Color"], bs.inputs["Emission Color"])
    bs.inputs["Emission Strength"].default_value = EMIT
    L_(to.outputs["Color"], sp.inputs["Color"])
    L_(sp.outputs["Green"], bs.inputs["Roughness"])
    L_(sp.outputs["Blue"], bs.inputs["Metallic"])
    L_(tn.outputs["Color"], nm.inputs["Color"])
    L_(nm.outputs["Normal"], bs.inputs["Normal"])
    L_(bs.outputs["BSDF"], out.inputs["Surface"])
    return m


# ---------------------------------------------------------------- geometry
def g2b(p):
    return (float(p[0]), float(-p[2]), float(p[1]))


def dense_surface(p):
    zr = np.linspace(0, LEN, DROWS + 1)
    Sv, Zv = np.meshgrid(SDn, zr)
    D, f = geo_D(Sv, Zv, p)
    D = smin(D, DLIM[None, :], 0.05)            # rider clear box (soft, never above the limit)
    D = D * taper(Zv, 0.10, 1.4)                # zero with zero slope at both end rings
    X = PD[None, :, 0] + ND[None, :, 0] * D
    Y = np.maximum(PD[None, :, 1] + ND[None, :, 1] * D, 0.0)
    Y[:, 0] = 0.0
    Y[:, -1] = 0.0
    return X, Y, zr, D


def decimate_inner(p, coll, target):
    """Dense inner surface -> collapse decimate (end rings locked) -> bmesh."""
    X, Y, zr, D = dense_surface(p)
    C = X.shape[1]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rows = []
    ring_ids = []
    for r in range(DROWS + 1):
        if r in (0, DROWS):
            row = [bm.verts.new(g2b((PC[c, 0], PC[c, 1], zr[r]))) for c in range(len(PC))]
            ring_ids.append(row)
        else:
            row = [bm.verts.new(g2b((X[r, c], Y[r, c], zr[r]))) for c in range(C)]
        rows.append(row)
    uvv = {}
    for r in range(DROWS + 1):
        ss = SC if r in (0, DROWS) else SDn
        for c, v in enumerate(rows[r]):
            uvv[v] = (U1 * ss[c] / L, zr[r] / LEN)
    faces = []
    for r in range(1, DROWS - 1):
        for c in range(C - 1):
            faces.append((rows[r][c], rows[r][c + 1], rows[r + 1][c + 1], rows[r + 1][c]))
    for k in range(len(PC) - 1):
        a, b = rows[0][k], rows[0][k + 1]
        d = rows[1][DSUB * k:DSUB * k + DSUB + 1]
        faces += [(a, b, d[2]), (a, d[2], d[1]), (a, d[1], d[0]), (b, d[4], d[3]), (b, d[3], d[2])]
        a2, b2 = rows[DROWS][k], rows[DROWS][k + 1]
        e = rows[DROWS - 1][DSUB * k:DSUB * k + DSUB + 1]
        faces += [(e[0], e[1], a2), (e[1], e[2], a2), (e[2], b2, a2), (e[2], e[3], b2), (e[3], e[4], b2)]
    for q in faces:
        fc = bm.faces.new(q)
        for lp in fc.loops:
            lp[uvl].uv = uvv[lp.vert]
    bm.verts.index_update()
    locked = {v.index for row in ring_ids for v in row}
    # triangles where the game camera looks (walls, floor line) cost more to collapse than the ceiling
    wts = {}
    for v in bm.verts:
        if v.index in locked:
            continue
        yg = v.co.z
        wts[v.index] = 0.55 + 0.45 * float(sstep(2.5, 5.0, yg))
    me = bpy.data.meshes.new("_dense_tmp")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("_dense_tmp", me)
    coll.objects.link(ob)
    vg = ob.vertex_groups.new(name="dec")
    for i, w in wts.items():
        vg.add([i], w, "REPLACE")
    md = ob.modifiers.new("dec", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.vertex_group = "dec"
    md.vertex_group_factor = 0.02
    dense_tris = sum(len(pl.vertices) - 2 for pl in me.polygons)
    ratio = target / dense_tris
    m2 = None
    for _ in range(8):
        md.ratio = ratio
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        ev = ob.evaluated_get(dg)
        if m2:
            bpy.data.meshes.remove(m2)
        m2 = bpy.data.meshes.new_from_object(ev)
        got = sum(len(pl.vertices) - 2 for pl in m2.polygons)
        if target - 12 <= got <= target:
            break
        ratio *= (target - 4) / got
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bm = bmesh.new()
    bm.from_mesh(m2)
    bpy.data.meshes.remove(m2)
    dl = bm.verts.layers.deform.active
    if dl:
        bm.verts.layers.deform.remove(dl)
    return bm, D


def build(tag, p, coll, target=2330):
    name = f"SM_IceCave_Segment_{tag}"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old)
    bm, D = decimate_inner(p, coll, target)
    uvl = bm.loops.layers.uv.active
    inner_faces = list(bm.faces)
    # snap: nothing below the floor, foot chain exactly on y = 0
    for v in bm.verts:
        if v.co.z < 0.0:
            v.co.z = 0.0
    bm.edges.ensure_lookup_table()
    foot = set()
    for e in bm.edges:
        if e.is_boundary:
            a, b = e.verts
            ends = all(abs(v.co.y) < 1e-5 or abs(v.co.y + LEN) < 1e-5 for v in (a, b)) and \
                abs(a.co.y - b.co.y) < 1e-6
            if not ends:
                foot.add(a)
                foot.add(b)
    for v in foot:
        v.co.z = 0.0

    def chain(side):
        vs = [v for v in foot if (v.co.x < 0) == (side < 0)]
        return sorted(vs, key=lambda v: -v.co.y)          # by game z (= -blender y)
    left, right = chain(-1), chain(1)
    def ring_order(vs):   # order along the profile: index of the matching end-ring point
        return sorted(vs, key=lambda v: int(np.argmin(np.hypot(PC[:, 0] - v.co.x, PC[:, 1] - v.co.z))))
    ring0 = ring_order([v for v in bm.verts if abs(v.co.y) < 1e-6])
    ring1 = ring_order([v for v in bm.verts if abs(v.co.y + LEN) < 1e-6])
    assert len(ring0) == len(PC) and len(ring1) == len(PC), (len(ring0), len(ring1))
    # hidden outer shell
    O0 = [bm.verts.new(g2b((x, y, 0.0))) for x, y in OUTER]
    O1 = [bm.verts.new(g2b((x, y, LEN))) for x, y in OUTER]
    hidden = [[bm.faces.new((O0[i], O0[i + 1], O1[i + 1], O1[i]))] for i in range(len(OUTER) - 1)]
    ngons = [
        bm.faces.new(right + [O1[0], O0[0]]),
        bm.faces.new(left + [O1[-1], O0[-1]]),
        bm.faces.new(ring0 + O0),
        bm.faces.new(ring1 + O1),
    ]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    for f in ngons:
        tri = bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")
        hidden.append(tri["faces"])
    bm.normal_update()
    slot_h = 1.0 / len(hidden)
    for gi, grp in enumerate(hidden):
        pts = [v.co for f in grp for v in f.verts]
        nrm = grp[0].normal
        ax = sorted(range(3), key=lambda i: abs(nrm[i]))[:2]
        lo = [min(q[a] for q in pts) for a in ax]
        hi = [max(q[a] for q in pts) for a in ax]
        for f in grp:
            f.smooth = False
            for lp in f.loops:
                a = (lp.vert.co[ax[0]] - lo[0]) / max(hi[0] - lo[0], 1e-6)
                b = (lp.vert.co[ax[1]] - lo[1]) / max(hi[1] - lo[1], 1e-6)
                lp[uvl].uv = (0.975 + 0.022 * a, gi * slot_h + 0.01 + (slot_h - 0.02) * b)
    for f in inner_faces:
        f.smooth = True
    ring_n = {}
    for rv in (ring0, ring1):
        for v, n in zip(rv, NIN):
            ring_n[v] = (float(n[0]), 0.0, float(n[1]))
    me = bpy.data.meshes.get(name)
    if me:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    inner_set = set(inner_faces)
    flags = []
    for f in bm.faces:
        for lp in f.loops:
            flags.append(ring_n.get(lp.vert) if f in inner_set else None)
    bm.to_mesh(me)
    bm.free()
    cn = [tuple(c.vector) for c in me.corner_normals]
    me.normals_split_custom_set([fl if fl is not None else c for fl, c in zip(flags, cn)])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob, D


def build_all(sc=None, tags=None):
    sc = sc or bpy.context.scene
    coll = bpy.data.collections.get("IceCave_Segments")
    if not coll:
        coll = bpy.data.collections.new("IceCave_Segments")
        sc.collection.children.link(coll)
    info = {}
    for tag, p in SEGMENTS.items():
        if tags and tag not in tags:
            continue
        (bc, orm, nrm, emi), st = make_textures(tag, p)
        mat = make_material(tag, bc, orm, nrm, emi)
        ob, D = build(tag, p, coll)
        tris = sum(len(pl.vertices) - 2 for pl in ob.data.polygons)
        if tris > TRI_BUDGET:
            ob, D = build(tag, p, coll, 2330 - (tris - TRI_BUDGET) - 8)
        ob.data.materials.append(mat)
        info[tag] = dict(tris=sum(len(pl.vertices) - 2 for pl in ob.data.polygons), dmin=float(D.min()),
                         dmax=float(D.max()), ice_off=p["ice_off"], c0=p["c0"], **st)
    return info


def export_all(out_dir, tags=None):
    """One GLB per segment: +Y up, plain glTF (no Draco/meshopt), JPEG q85 textures, no cameras/lights."""
    sc = bpy.context.scene
    paths = {}
    for tag in SEGMENTS:
        if tags and tag not in tags:
            continue
        ob = bpy.data.objects[f"SM_IceCave_Segment_{tag}"]
        for o in sc.objects:
            o.select_set(o == ob)
        bpy.context.view_layer.objects.active = ob
        pth = f"{out_dir}/SM_IceCave_Segment_{tag}.glb"
        bpy.ops.export_scene.gltf(filepath=pth, export_format="GLB", use_selection=True, export_yup=True,
                                  export_apply=True, export_image_format="JPEG", export_image_quality=85,
                                  export_jpeg_quality=85, export_tangents=True, export_normals=True,
                                  export_cameras=False, export_lights=False, export_materials="EXPORT",
                                  export_draco_mesh_compression_enable=False, export_extras=False,
                                  export_animations=False, export_skins=False, export_morph=False)
        paths[tag] = pth
    return paths
