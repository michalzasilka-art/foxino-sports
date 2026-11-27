"""Lane D, W2b: seam check + swatch for the cave floor maps (reads the written JPEGs back).

"C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P cf_floor_checks.py -- <icecave_dir> <seamcheck_png>
Writes <icecave_dir>/previews/cave_floor_swatch.png and <seamcheck_png> (maps offset by half + 3 x 3 base colour).
Seam metric: mean |difference| across the wrap edge vs the mean across ordinary neighbouring rows/columns (ratio ~1 = seamless).
"""
import json
import os
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, SEAM_PNG = argv[0], argv[1]
KEYS = ("BaseColor", "Normal", "Roughness")


def load(key):
    img = bpy.data.images.load(os.path.join(OUT, f"T_CaveFloor_{key}.jpg"))
    img.colorspace_settings.name = "Non-Color"      # raw bytes, no transform
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    info = {"size": [w, h], "channels": img.channels, "file_bytes": os.path.getsize(img.filepath)}
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[..., :3], info


def seam(a):
    res = {}
    # JPEG codes 16 x 16 blocks and 1024 is a block multiple, so the wrap edge is a block edge:
    # compare it with the other block edges inside the image (ratio ~1 = no seam), and with all neighbours.
    for axis, name in ((1, "u_wrap"), (0, "v_wrap")):
        d = np.abs(np.diff(a, axis=axis))
        other = tuple(i for i in range(3) if i != axis)
        blk = np.take(d, np.arange(15, a.shape[axis] - 1, 16), axis=axis).mean(axis=other)  # per block-edge line
        wrap = np.abs(np.take(a, 0, axis=axis) - np.take(a, -1, axis=axis)).mean()
        res[name] = {"vs_block_edges": round(float(wrap / blk.mean()), 3),
                     "vs_all": round(float(wrap / d.mean()), 3),
                     "percentile_among_block_edges": round(float((blk < wrap).mean() * 100), 1)}
    return res


def down(a, f):
    h, w, c = a.shape
    return a.reshape(h // f, f, w // f, f, c).mean((1, 3))


def save_png(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    px = np.ones((h, w, 4), np.float32)
    px[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.file_format = "PNG"
    img.save(filepath=path)
    bpy.data.images.remove(img)


maps, report = {}, {}
for k in KEYS:
    maps[k], info = load(k)
    info["seam"] = seam(maps[k])
    info["mean"] = [round(float(x), 3) for x in maps[k].reshape(-1, 3).mean(0)]
    info["min"] = round(float(maps[k].min()), 3)
    report[k] = info
r = maps["Roughness"]
report["Roughness"]["grey"] = bool(np.abs(r[..., 0] - r[..., 2]).max() < 0.02)
n = maps["Normal"] * 2 - 1
report["Normal"]["mean_vec"] = [round(float(x), 3) for x in n.reshape(-1, 3).mean(0)]

GAP, BG = 16, np.array([0.06, 0.07, 0.09], np.float32)


def strip(tiles):
    h = tiles[0].shape[0]
    parts = []
    for i, t in enumerate(tiles):
        if i:
            parts.append(np.broadcast_to(BG, (h, GAP, 3)))
        parts.append(t)
    return np.concatenate(parts, 1)


def frame(a):
    h, w = a.shape[:2]
    out = np.broadcast_to(BG, (h + 2 * GAP, w + 2 * GAP, 3)).copy()
    out[GAP:GAP + h, GAP:GAP + w] = a
    return out


# swatch: the three maps side by side (row 0 = bottom, as Blender stores pixels)
save_png(frame(strip([down(maps[k], 2) for k in KEYS])), os.path.join(OUT, "previews", "cave_floor_swatch.png"))

# seam check: each map rolled by half its size (old edges now cross the middle), above a 3 x 3 base colour tiling
half = [down(np.roll(np.roll(maps[k], 512, 0), 512, 1), 2) for k in KEYS]
top = strip(half)
tiled = down(np.tile(maps["BaseColor"], (3, 3, 1)), 2)            # 1536 px = 12 m
pad = top.shape[1] - tiled.shape[1]
tiled = np.concatenate([np.broadcast_to(BG, (tiled.shape[0], pad // 2, 3)), tiled,
                        np.broadcast_to(BG, (tiled.shape[0], pad - pad // 2, 3))], 1)
sheet = np.concatenate([tiled, np.broadcast_to(BG, (GAP, top.shape[1], 3)), top], 0)
save_png(frame(sheet), SEAM_PNG)
print("CFCHECK " + json.dumps(report))
