# Igloo W3 texture pass: packed hand-cut snow blocks for M_IglooSnow (1024x256 tiling, 4 blocks x 1 course).
# Same layout as before: bed joints at V = 0/1, head joints at U = 0, 0.24, 0.51, 0.74 (the plug border uses them).
# Headless: blender -b --factory-startup -P igloo_snow_tex.py -- <out_dir> [<preview_png>]
import bpy, math, os, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREV = argv[1] if len(argv) > 1 else None
W, H = 1024, 256
LT, CH = 3.6, 0.57                 # tile length (m) and course height (m) the UVs were made with
UB = [0.0, 0.24, 0.51, 0.74]
rs = np.random.RandomState(11)
px, py = LT / W, CH / H

fu = np.fft.fftfreq(W, d=px)[None, :]
fv = np.fft.fftfreq(H, d=py)[:, None]
fr = np.sqrt(fu ** 2 + fv ** 2)


def band(lam_lo, lam_hi, aniso=1.0):
    """periodic band-limited noise, wavelengths lam_lo..lam_hi metres, unit std"""
    f = np.sqrt((fu * aniso) ** 2 + fv ** 2)
    F = np.fft.fft2(rs.standard_normal((H, W)))
    f0, f1 = 1 / lam_hi, 1 / lam_lo
    sig = math.log(f1 / f0) / 2.5
    m = np.exp(-((np.log(f + 1e-9) - math.log(math.sqrt(f0 * f1))) ** 2) / (2 * sig * sig))
    m[0, 0] = 0
    n = np.real(np.fft.ifft2(F * m))
    return n / n.std()


u = (np.arange(W) + 0.5) / W
v = (np.arange(H) + 0.5) / H
U, V = np.meshgrid(u, v)            # row 0 = V ~ 0 (Blender pixel order: bottom row first)
bi = np.searchsorted(np.array(UB[1:]), U, side='right')
st = np.array(UB)[bi]
wb = (np.array(UB[1:] + [1.0]) - np.array(UB))[bi] * LT
s = (U - st) * LT
t = V * CH
du = np.minimum(s, wb - s)
dv = np.minimum(t, CH - t)

# per-block character (4 blocks in the tile)
P = dict(
    bev=np.array([0.080, 0.070, 0.088, 0.075]),     # bevel width (m)
    rc=np.array([0.105, 0.090, 0.120, 0.098]),          # corner rounding (m)
    shade=np.array([-0.032, 0.022, -0.012, 0.036]),
    warm=np.array([0.004, -0.003, 0.002, -0.004]),
    pil=np.array([0.014, 0.010, 0.017, 0.012]),     # pillow bulge (m)
    pcx=np.array([0.42, 0.58, 0.47, 0.55]),         # bulge centre along the block
    pcy=np.array([0.55, 0.45, 0.52, 0.40]),
)
g = 0.005                                           # flat joint bottom half width (keeps joint centres uniform)
a = np.maximum(du - g, 0)
b = np.maximum(dv - g, 0)
rc = P["rc"][bi]
d = rc - np.sqrt(np.maximum(rc - a, 0) ** 2 + np.maximum(rc - b, 0) ** 2)
wob = band(0.08, 0.35) * 0.005 + band(0.03, 0.08) * 0.0008       # hand-cut, not ruler straight
d = np.maximum(d + wob * np.clip(d / 0.02, 0, 1), 0)
bev = P["bev"][bi]
x = np.clip(d / bev, 0, 1)
depth = 0.036
h_bev = depth * (1 - (1 - x) ** 2.4)                # soft round shoulder, no hard lip
mask = x * x * (3 - 2 * x)

# pillow: an off-centre soft bulge per block
fx = np.clip(s / wb, 0, 1)
fy = np.clip(t / CH, 0, 1)
cx, cy = P["pcx"][bi], P["pcy"][bi]
fx2 = np.where(fx < cx, 0.5 * fx / cx, 0.5 + 0.5 * (fx - cx) / (1 - cx))
fy2 = np.where(fy < cy, 0.5 * fy / cy, 0.5 + 0.5 * (fy - cy) / (1 - cy))
pill = (np.sin(np.pi * fx2) * np.sin(np.pi * fy2)) ** 0.8 * P["pil"][bi]

lumps = band(0.10, 0.40) * 0.0028                   # packed-snow undulation
grain = band(0.012, 0.035) * 0.00038                # snow grain
fine = band(0.004, 0.011) * 0.00012
streak = band(0.03, 0.09, aniso=0.25) * 0.0005      # faint cut strokes along the block
Hm = h_bev + mask * (pill + lumps + grain + fine + streak)

dx = (np.roll(Hm, -1, axis=1) - np.roll(Hm, 1, axis=1)) / (2 * px)
dy = (np.roll(Hm, -1, axis=0) - np.roll(Hm, 1, axis=0)) / (2 * py)
n = np.dstack([-dx, -dy, np.ones_like(dx)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
nrm = np.dstack([(n + 1) * 0.5, np.ones((H, W, 1))])

snow = np.array([0.925, 0.940, 0.962])
blue = np.array([0.805, 0.868, 0.948])
gn = (grain + fine) / 0.00038
mot = band(0.15, 0.7)
shade = (P["shade"][bi] + 0.010 * mot + 0.010 * gn) * mask
warm = P["warm"][bi] * mask
col = snow[None, None, :] * (1 + shade[..., None])
col[..., 0] += warm
col[..., 2] -= warm
wj = 0.85 * (1 - x) ** 2.6                          # faint blue in the joints, fading up the bevel
col = col * (1 - wj[..., None]) + blue[None, None, :] * wj[..., None]
col = np.clip(col, 0, 0.97)
col = np.dstack([col, np.ones((H, W, 1))])

os.makedirs(OUT, exist_ok=True)
for nm, arr, data in (("T_IglooSnow_BaseColor", col, False), ("T_IglooSnow_Normal", nrm, True)):
    img = bpy.data.images.new(nm, W, H, alpha=False)
    if data:
        img.colorspace_settings.is_data = True
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    p = os.path.join(OUT, nm + ".jpg")
    img.filepath_raw = p
    img.file_format = 'JPEG'
    img.save(filepath=p, quality=85)
    print("saved", p, os.path.getsize(p))

if PREV:   # 2 courses x 2 tiles, the upper course shifted, simple lambert shading with the normal map
    L = np.array([-0.45, 0.55, 0.70]); L /= np.linalg.norm(L)
    lam = np.clip((n * L).sum(2), 0, 1) * 0.75 + 0.3
    sh = col[..., :3] * lam[..., None]
    row = np.concatenate([sh, sh], axis=1)
    row2 = np.roll(row, W // 3, axis=1)
    pv = np.concatenate([row, row2], axis=0)
    pv = np.dstack([np.clip(pv, 0, 1), np.ones(pv.shape[:2] + (1,))])
    img = bpy.data.images.new("prev", pv.shape[1], pv.shape[0], alpha=False)
    img.pixels.foreach_set(pv.astype(np.float32).ravel())
    img.filepath_raw = PREV
    img.file_format = 'PNG'
    img.save()
