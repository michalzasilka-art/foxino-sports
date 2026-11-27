"""Lane D, W2b: tileable frozen cave floor maps (1024 px = 4 m, seamless by construction).

Everything is built on a torus: spectral noise (FFT), toroidal Voronoi and wrapped stroke
rasterising, and the normal map uses wrapped finite differences, so every map tiles exactly.

"C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P cf_floor_textures.py -- <out_dir>
Writes T_CaveFloor_BaseColor.jpg, T_CaveFloor_Normal.jpg (OpenGL, +Y green), T_CaveFloor_Roughness.jpg (q85).
"""
import json
import os
import sys

import numpy as np

N = 1024            # pixels per tile
TILE_M = 4.0        # metres per tile
PX = TILE_M / N     # metres per pixel
rng = np.random.default_rng(20261127)

# grid: column = u (x), row = v (from the bottom, Blender pixel order)
U = (np.arange(N, dtype=np.float32) + 0.5) / N
UU, VV = np.meshgrid(U, U)            # UU[row, col] = u, VV[row, col] = v
FX = np.fft.fftfreq(N) * N            # cycles per tile
FXX, FYY = np.meshgrid(FX, FX)
FR = np.sqrt(FXX ** 2 + FYY ** 2)


def norm(a):
    a = a - a.mean()
    return (a / (a.std() + 1e-9)).astype(np.float32)


def fbm(fmin, fmax, beta, aniso=1.0):
    """Periodic band-limited 1/f^beta noise, zero mean, unit std. aniso>1 stretches along v."""
    w = rng.standard_normal((N, N))
    r = np.sqrt(FXX ** 2 + (FYY * aniso) ** 2)
    amp = np.where(r > 0, np.power(np.maximum(r, 1e-6), -beta), 0.0)
    amp *= 1.0 / (1.0 + np.exp(-(r - fmin) * 3.0))          # soft high-pass
    amp *= 1.0 / (1.0 + np.exp((r - fmax) * (6.0 / fmax)))   # soft low-pass
    return norm(np.real(np.fft.ifft2(np.fft.fft2(w) * amp)))


def blur(a, sigma_px):
    """Periodic Gaussian blur (FFT)."""
    g = np.exp(-2.0 * (np.pi * sigma_px * FR / N) ** 2)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g)).astype(np.float32)


def sample(a, du, dv):
    """Bilinear wrapped lookup of a at (u+du, v+dv) (offsets in tile units)."""
    x = (UU + du) * N - 0.5
    y = (VV + dv) * N - 0.5
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = (x - x0).astype(np.float32)
    fy = (y - y0).astype(np.float32)
    x0 %= N
    y0 %= N
    x1 = (x0 + 1) % N
    y1 = (y0 + 1) % N
    return ((a[y0, x0] * (1 - fx) + a[y0, x1] * fx) * (1 - fy) +
            (a[y1, x0] * (1 - fx) + a[y1, x1] * fx) * fy)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def voronoi(npts, jitter_aniso=1.0):
    """Toroidal Voronoi: returns F1, F2 (tile units) and cell id."""
    pts = rng.random((npts, 2))
    f1 = np.full((N, N), 9.0, np.float32)
    f2 = np.full((N, N), 9.0, np.float32)
    cid = np.zeros((N, N), np.int32)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(UU - px)
        dx = np.minimum(dx, 1 - dx)
        dy = np.abs(VV - py)
        dy = np.minimum(dy, 1 - dy) * jitter_aniso
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        cid = np.where(closer, i, cid)
        f1 = np.where(closer, d, f1)
    return f1, f2, cid


def strokes(paths, sigma_px):
    """Rasterise wrapped polylines (lists of (u, v) in tile units, weight) into a periodic buffer."""
    acc = np.zeros((N, N), np.float64)
    for pts, wgt in paths:
        pts = np.asarray(pts) * N - 0.5
        seg = np.diff(pts, axis=0)
        ln = np.hypot(seg[:, 0], seg[:, 1])
        xs, ys, ws = [], [], []
        for (p, s, l, w) in zip(pts[:-1], seg, ln, wgt if hasattr(wgt, "__len__") else [wgt] * len(ln)):
            k = max(2, int(l / 0.4))
            t = np.linspace(0, 1, k, endpoint=False)
            xs.append(p[0] + s[0] * t)
            ys.append(p[1] + s[1] * t)
            ws.append(np.full(k, w * l / k))
        x = np.concatenate(xs)
        y = np.concatenate(ys)
        w = np.concatenate(ws)
        x0 = np.floor(x).astype(np.int64)
        y0 = np.floor(y).astype(np.int64)
        fx = x - x0
        fy = y - y0
        for ox, oy, ww in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
            np.add.at(acc, ((y0 + oy) % N, (x0 + ox) % N), w * ww)
    return blur(acc.astype(np.float32), sigma_px)


def lerp(a, b, t):
    return a + (b - a) * t


def rgb(c):
    return np.array(c, np.float32).reshape(1, 1, 3)


def build():
    # ---------- rock / ice layout ----------
    warp_u = fbm(2, 10, 1.0) * 0.035
    warp_v = fbm(2, 10, 1.0) * 0.035
    lay = 0.72 * fbm(2, 9, 1.4) + 0.22 * fbm(6, 24, 1.2) + 0.10 * fbm(20, 90, 0.9)
    lay = norm(sample(lay, warp_u, warp_v))
    t_rock = np.quantile(lay, 1.0 - 0.24)                    # ~24 % rock showing
    rock = smoothstep(t_rock - 0.05, t_rock + 0.05, lay)     # 1 = bare rock
    thick = smoothstep(t_rock - 0.05, t_rock - 1.6, lay)      # 0 at rock edge .. 1 deep ice
    shallow = 1.0 - smoothstep(t_rock - 0.9, t_rock - 0.05, lay)  # where rock sits under thin ice

    # ---------- rock surface ----------
    r_mid = fbm(8, 60, 1.1)
    r_fine = fbm(60, 400, 0.6)
    f1, f2, cid = voronoi(70, 1.0)
    crack = 1.0 - smoothstep(0.0, 0.006, f2 - f1)           # thin cracks between rock plates
    plate = (np.sin(cid * 12.9898) * 43758.5453) % 1.0        # per-plate tone
    rock_h = 0.012 * r_mid + 0.003 * r_fine + 0.008 * (plate - 0.5) - 0.006 * crack
    rock_c = lerp(rgb((0.27, 0.245, 0.22)), rgb((0.36, 0.325, 0.29)), (0.5 + 0.22 * r_mid + 0.25 * (plate - 0.5))[..., None])
    rock_c = lerp(rock_c, rgb((0.31, 0.31, 0.32)), (0.5 * np.clip(0.5 + 0.4 * fbm(4, 20, 1.0), 0, 1))[..., None])  # grey-brown mix
    rock_c = rock_c * (1.0 + 0.10 * r_fine[..., None])
    rock_c = lerp(rock_c, rgb((0.17, 0.155, 0.15)), (0.75 * crack)[..., None])

    # ---------- ice ----------
    i_cloud = fbm(3, 30, 1.3)
    i_fine = fbm(30, 200, 0.8)
    g1, g2, _ = voronoi(26, 0.8)
    fracture = (1.0 - smoothstep(0.0, 0.0035, g2 - g1)) * smoothstep(0.2, 0.8, 0.5 + 0.5 * fbm(2, 8, 1.0))
    ice_thin = rgb((0.25, 0.31, 0.36))
    ice_deep = rgb((0.12, 0.18, 0.25))
    ice_c = lerp(ice_thin, ice_deep, thick[..., None])
    ice_c = lerp(ice_c, rgb((0.30, 0.40, 0.47)), (0.22 * smoothstep(0.3, 1.8, i_cloud))[..., None])  # milky clouds
    ice_c = ice_c * (1.0 + 0.04 * i_fine[..., None])
    ice_c = lerp(ice_c, rgb((0.36, 0.45, 0.52)), (0.45 * fracture * (0.3 + 0.7 * thick))[..., None])
    # rock seen through thin ice: tinted, darker
    under = rock_c * rgb((0.62, 0.78, 0.92)) + rgb((0.02, 0.04, 0.07))
    ice_c = lerp(ice_c, under, (0.55 * shallow * (1 - rock))[..., None])
    ice_h = 0.0012 * fbm(4, 40, 1.2) + 0.0002 * i_fine

    # ---------- carve marks + scratches (on the ice) ----------
    carves = []
    for _ in range(11):                                       # long carving arcs along the run (v)
        k = int(rng.integers(1, 3))
        a = rng.uniform(0.02, 0.09)
        ph = rng.uniform(0, 2 * np.pi)
        x0 = rng.random()
        v = np.linspace(0, 1, 400)
        u = x0 + a * np.sin(2 * np.pi * k * v + ph) + 0.01 * np.sin(2 * np.pi * 3 * v + 2 * ph)
        wg = 0.55 + 0.45 * np.sin(2 * np.pi * v * int(rng.integers(1, 4)) + ph * 1.7) ** 2  # fade in/out
        carves.append((np.stack([u, v], 1), wg[:-1]))
        if rng.random() < 0.6:                                # board edges come in pairs
            off = rng.uniform(0.004, 0.009)
            carves.append((np.stack([u + off, v], 1), (wg[:-1] * 0.6)))
    carve = strokes(carves, 1.3)
    carve = 1.0 - np.exp(-carve * 4.0)
    spray = 1.0 - np.exp(-blur(carve, 5.0) * 1.6)
    fines = []
    for _ in range(260):                                      # short fine scratches
        ln = rng.uniform(0.01, 0.07)
        ang = np.pi / 2 + rng.normal(0, 0.45)
        cu, cv = rng.random(), rng.random()
        bend = rng.normal(0, 0.15)
        t = np.linspace(-0.5, 0.5, 12)
        u = cu + np.cos(ang + bend * t) * ln * t
        v = cv + np.sin(ang + bend * t) * ln * t
        fines.append((np.stack([u, v], 1), rng.uniform(0.3, 1.0)))
    fine = strokes(fines, 0.6)
    fine = 1.0 - np.exp(-fine * 2.5)
    on_ice = 1.0 - 0.85 * rock
    carve *= on_ice
    spray *= on_ice
    fine *= on_ice

    # ---------- frost dusting ----------
    f_lo = fbm(2, 12, 1.2)
    f_mid = fbm(15, 80, 0.9)
    f_hi = blur(fbm(60, 260, 0.5), 0.8)
    edge = smoothstep(0.0, 0.5, rock) * (1 - smoothstep(0.6, 1.0, rock))   # rims of the rock patches
    fmask = smoothstep(0.7, 1.9, f_lo + 0.9 * edge + 0.5 * f_mid) * (0.5 + 0.5 * smoothstep(-1.2, 1.2, f_hi))
    fmask = blur(np.clip(fmask + 0.25 * spray * smoothstep(-0.2, 1.0, f_hi), 0, 1), 1.2)
    frost_c = rgb((0.44, 0.50, 0.56)) * (1.0 + 0.05 * f_hi[..., None])

    # ---------- composite ----------
    base = lerp(ice_c, rock_c, rock[..., None])
    base = lerp(base, rgb((0.40, 0.48, 0.55)), (0.55 * carve)[..., None])     # whitened carved ice
    base = lerp(base, rgb((0.34, 0.42, 0.49)), (0.30 * fine)[..., None])
    base = lerp(base, frost_c, (0.55 * fmask)[..., None])
    base = np.clip(base, 0.07, 0.80)

    ice_r = 0.17 + 0.025 * i_fine + 0.03 * fracture
    ice_r = ice_r + 0.10 * carve + 0.06 * fine + 0.04 * spray                    # scratched ice is rougher (<= ~0.32)
    rock_r = 0.75 + 0.04 * r_fine - 0.03 * crack
    rough = lerp(ice_r, rock_r, rock)
    rough = lerp(rough, 0.80 + 0.03 * f_hi, fmask * 0.95)
    rough = np.clip(rough, 0.12, 0.88)

    height = lerp(ice_h, rock_h + 0.004, rock) - 0.0016 * carve - 0.0005 * fine + 0.0006 * fmask * (0.5 + 0.5 * f_hi)
    dhdu = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * PX)
    dhdv = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) / (2 * PX)
    nrm = np.stack([-dhdu, -dhdv, np.ones_like(dhdu)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    nmap = nrm * 0.5 + 0.5

    stats = {"rock_frac": float((rock > 0.5).mean()), "frost_frac": float((fmask > 0.5).mean()),
             "carve_frac": float((carve > 0.3).mean()),
             "base_min": float(base.min()), "base_mean": [float(x) for x in base.reshape(-1, 3).mean(0)],
             "rough_mean": float(rough.mean()),
             "rough_ice_mean": float(rough[(rock < 0.1) & (fmask < 0.1)].mean()),
             "rough_ice_p95": float(np.quantile(rough[(rock < 0.1) & (fmask < 0.1)], 0.95)),
             "rough_rock_mean": float(rough[(rock > 0.9) & (fmask < 0.1)].mean()),
             "rough_frost_mean": float(rough[fmask > 0.9].mean()) if (fmask > 0.9).any() else None,
             "normal_z_min": float(nrm[..., 2].min())}
    return base, np.repeat(rough[..., None], 3, -1), nmap, stats


def save_jpg(arr, path, q=85):
    """arr: (N, N, 3) display values 0..1, row 0 = bottom. Written byte-exact (no colour transform)."""
    import bpy
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "sRGB"
    px = np.ones((h, w, 4), np.float32)
    # quantise ourselves with a tiny dither so byte buffers stay exact
    px[..., :3] = np.round(np.clip(arr, 0, 1) * 255 + rng.uniform(-0.35, 0.35, arr.shape)) / 255
    img.pixels.foreach_set(np.clip(px, 0, 1).ravel())
    img.file_format = "JPEG"
    img.save(filepath=path, quality=q)
    bpy.data.images.remove(img)


if __name__ == "__main__":
    out = sys.argv[sys.argv.index("--") + 1]
    os.makedirs(out, exist_ok=True)
    base, rough, nmap, stats = build()
    save_jpg(base, os.path.join(out, "T_CaveFloor_BaseColor.jpg"))
    save_jpg(nmap, os.path.join(out, "T_CaveFloor_Normal.jpg"))
    save_jpg(rough, os.path.join(out, "T_CaveFloor_Roughness.jpg"))
    print("CFSTATS " + json.dumps(stats))
