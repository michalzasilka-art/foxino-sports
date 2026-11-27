"""Numeric checks on the exported mouth GLBs (run with Blender's bundled Python):
triangles, bounds, +Y up / +Z run, the inner profile ring within 1 mm, rider clearance, materials, textures, extras.
usage: python ic_check_glb.py <SM_IceCave_Entrance.glb> <SM_IceCave_Exit.glb>
"""
import json
import struct
import sys

import numpy as np

HALF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25),
        (4.95, 4.95), (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
PROFILE = HALF + [(-x, y) for (x, y) in reversed(HALF[:-1])]
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load(path):
    b = open(path, "rb").read()
    magic, ver, length = struct.unpack_from("<III", b, 0)
    assert magic == 0x46546C67
    off = 12
    js = binc = None
    while off < length:
        clen, ctype = struct.unpack_from("<II", b, off)
        chunk = b[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            binc = chunk
        off += 8 + clen
    return js, binc


def acc(js, binc, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    n = NCOMP[a["type"]]
    dt = CT[a["componentType"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = np.frombuffer(binc, dtype=dt, count=a["count"] * n, offset=start)
    return arr.reshape(a["count"], n) if n > 1 else arr


def check(path, ring_z):
    js, binc = load(path)
    out = {"file": path.split("\\")[-1].split("/")[-1], "bytes": len(open(path, "rb").read())}
    out["nodes"] = [(nd.get("name"), nd.get("translation"), nd.get("rotation"), nd.get("scale")) for nd in js["nodes"]]
    out["meshes"] = len(js["meshes"])
    out["materials"] = [m["name"] for m in js.get("materials", [])]
    out["images"] = [(im.get("name"), im.get("mimeType")) for im in js.get("images", [])]
    out["extensionsUsed"] = js.get("extensionsUsed", [])
    out["cameras_lights"] = ("cameras" in js, "KHR_lights_punctual" in js.get("extensionsUsed", []))
    tris = 0
    P = []
    for m in js["meshes"]:
        for pr in m["primitives"]:
            pos = acc(js, binc, pr["attributes"]["POSITION"]).astype(np.float64)
            idx = acc(js, binc, pr["indices"])
            tris += len(idx) // 3
            out["attrs"] = sorted(pr["attributes"].keys())
            P.append(pos)
    P = np.concatenate(P)
    out["tris"] = tris
    out["bbox_min"] = [round(float(v), 3) for v in P.min(0)]
    out["bbox_max"] = [round(float(v), 3) for v in P.max(0)]
    # profile ring: every shared point must have a vertex at (x, y, ring_z) within 1 mm
    worst = 0.0
    for (x, y) in PROFILE:
        d = np.sqrt(((P - np.array([x, y, ring_z])) ** 2).sum(1)).min()
        worst = max(worst, float(d))
    out["ring_worst_mm"] = round(worst * 1000, 4)
    out["ring_pass"] = worst <= 0.001
    # ring vertices lying in the ring plane must lie on the shared profile polyline (midpoints included)
    onplane = P[np.abs(P[:, 2] - ring_z) < 1e-4]
    seg_d = []
    for v in onplane:
        best = 9.0
        for i in range(len(PROFILE) - 1):
            a = np.array(PROFILE[i]); b = np.array(PROFILE[i + 1])
            t = np.clip(np.dot(v[:2] - a, b - a) / np.dot(b - a, b - a), 0, 1)
            best = min(best, float(np.linalg.norm(v[:2] - (a + t * (b - a)))))
        seg_d.append(best)
    out["ring_plane_verts"] = int(len(onplane))
    out["ring_plane_offprofile_max_mm"] = round(max(seg_d) * 1000, 4) if seg_d else None
    # rider space: nothing inside |x|<6.5 below y=4.0, and icicles (anything) inside |x|<6.5 stays above 4.2
    inner = P[(np.abs(P[:, 0]) < 6.5)]
    out["min_y_inside_x6.5"] = round(float(inner[:, 1].min()), 3)
    out["below_floor_inside_cave"] = int(((np.abs(P[:, 0]) < 8.0) & (P[:, 1] < -1e-6) &
                                          (P[:, 2] > min(ring_z, 3 - ring_z) - 0.01)).sum())
    return out


if __name__ == "__main__":
    ent, ext = sys.argv[1], sys.argv[2]
    print(json.dumps([check(ent, 3.0), check(ext, 0.0)], indent=1))
