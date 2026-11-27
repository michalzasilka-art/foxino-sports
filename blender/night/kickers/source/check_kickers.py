"""Read each exported kicker GLB directly (no Blender) and check the contract.

Run with Blender's bundled Python:
  python check_kickers.py <kickers_dir>

Checks: node names/hierarchy, materials, images (JPEG), no cameras/lights/compression
extensions, triangle counts, bounds in glTF axes (+Y up, +Z downhill), and the riding
surface: the top surface sampled along z every 1 cm at x = 0 and x = +/-(w/2 - 0.2),
compared with the game profile.
"""
import json
import os
import struct
import sys

import numpy as np

PAD = 0.35
MODELS = {
    "SM_Kicker":   dict(len=4.0,  lip=1.0,  w=3.6, table=0.0, back=1.4),
    "SM_TableTop": dict(len=4.5,  lip=1.3,  w=5.0, table=6.0, back=1.8),
    "SM_GapJump":  dict(len=5.0,  lip=1.5,  w=4.4, table=0.0, back=1.6),
    "SM_StepUp":   dict(len=4.0,  lip=1.15, w=4.0, table=0.0, back=1.4),
    "SM_BigAir":   dict(len=12.0, lip=4.6,  w=9.0, table=0.0, back=5.0),
}
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def prof(z, P):
    L = P["len"]
    zt1 = L + PAD + P["table"]
    z = np.asarray(z, float)
    ramp = P["lip"] * np.clip(z / L, 0, 1) ** 1.7
    back = P["lip"] * np.clip(1 - (z - zt1) / P["back"], 0, 1)
    return np.where(z <= L, ramp, np.where(z <= zt1, P["lip"], back))


def load(path):
    b = open(path, "rb").read()
    assert b[:4] == b"glTF"
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    bin_ = b[20 + jl + 8:]
    return js, bin_


def acc(js, bin_, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    n = NC[a["type"]]
    dt = np.dtype(CT[a["componentType"]])
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or dt.itemsize * n
    raw = np.frombuffer(bin_, np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * n, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], n * dt.itemsize), strides=(stride, 1))
    return np.ascontiguousarray(out).view(dt).reshape(a["count"], n)


def node_mat(nd):
    if "matrix" in nd:
        return np.array(nd["matrix"], float).reshape(4, 4).T
    t = np.array(nd.get("translation", [0, 0, 0]), float)
    x, y, z, w = nd.get("rotation", [0, 0, 0, 1])
    s = np.array(nd.get("scale", [1, 1, 1]), float)
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def top_y(tris, xs, zs):
    """Highest surface y over each (x, z) from world triangles (n,3,3)."""
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    out = np.full(len(xs), -np.inf)
    v0 = (b - a)[:, [0, 2]]
    v1 = (c - a)[:, [0, 2]]
    d00 = (v0 * v0).sum(1)
    d01 = (v0 * v1).sum(1)
    d11 = (v1 * v1).sum(1)
    den = d00 * d11 - d01 * d01
    ok = np.abs(den) > 1e-14
    for k, (x, z) in enumerate(zip(xs, zs)):
        v2 = np.array([x, z]) - a[:, [0, 2]]
        d20 = (v2 * v0).sum(1)
        d21 = (v2 * v1).sum(1)
        with np.errstate(divide="ignore", invalid="ignore"):
            v = (d11 * d20 - d01 * d21) / den
            w = (d00 * d21 - d01 * d20) / den
        u = 1 - v - w
        e = -1e-7
        m = ok & (u >= e) & (v >= e) & (w >= e)
        if m.any():
            y = u[m] * a[m, 1] + v[m] * b[m, 1] + w[m] * c[m, 1]
            out[k] = y.max()
    return out


def check(path, name, P):
    js, bin_ = load(path)
    res = {"file": os.path.basename(path), "bytes": os.path.getsize(path)}
    res["extensionsUsed"] = js.get("extensionsUsed", [])
    res["cameras"] = len(js.get("cameras", []))
    res["lights"] = len(js.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", []))
    res["images"] = [im.get("mimeType") for im in js.get("images", [])]
    res["materials"] = [m["name"] for m in js.get("materials", [])]
    nodes = js["nodes"]
    roots = js["scenes"][js.get("scene", 0)]["nodes"]
    res["roots"] = [nodes[i]["name"] for i in roots]
    res["children"] = {nodes[i]["name"]: [nodes[c]["name"] for c in nodes[i].get("children", [])] for i in roots}
    tris_by, all_tris, lip_tris = {}, [], []

    def walk(i, M):
        nd = nodes[i]
        W = M @ node_mat(nd)
        if "mesh" in nd:
            mesh = js["meshes"][nd["mesh"]]
            cnt = 0
            for pr in mesh["primitives"]:
                pos = acc(js, bin_, pr["attributes"]["POSITION"]).astype(float)
                idx = acc(js, bin_, pr["indices"]).ravel() if "indices" in pr else np.arange(len(pos))
                pw = (np.c_[pos, np.ones(len(pos))] @ W.T)[:, :3]
                t = pw[idx.reshape(-1, 3)]
                cnt += len(t)
                all_tris.append(t)
                mname = js["materials"][pr["material"]]["name"] if "material" in pr else None
                res.setdefault("prim_materials", {})[nd["name"]] = mname
                if nd["name"] == "Lip":
                    lip_tris.append(t)
            tris_by[nd["name"]] = cnt
        for c in nd.get("children", []):
            walk(c, W)
    for r in roots:
        walk(r, np.eye(4))
    T = np.concatenate(all_tris)
    res["tris"] = tris_by
    res["tris_total"] = int(sum(tris_by.values()))
    res["bbox_min"] = np.round(T.reshape(-1, 3).min(0), 4).tolist()
    res["bbox_max"] = np.round(T.reshape(-1, 3).max(0), 4).tolist()
    # face orientation: riding surface normals must point +Y
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    res["down_facing_tris"] = int((n[:, 1] < -1e-9).sum())
    # profile
    L = P["len"]
    ze = L + PAD + P["table"] + P["back"]
    zs = np.round(np.arange(0.0, ze + 1e-9, 0.01), 6)
    zs = np.clip(zs, 1e-4, ze - 1e-4)        # float32 ends: sample just inside z = 0 and z = end
    worst = {}
    for x in (0.0, -(P["w"] / 2 - 0.2), P["w"] / 2 - 0.2):
        y = top_y(T, np.full(len(zs), x), zs)
        d = y - prof(zs, P)
        k = int(np.nanargmax(np.abs(d)))
        worst[f"x={x:+.2f}"] = dict(max_abs_cm=round(float(abs(d[k])) * 100, 3), at_z=float(zs[k]),
                                    missing=int(np.isinf(y).sum()))
    res["profile"] = worst
    res["profile_worst_cm"] = max(v["max_abs_cm"] for v in worst.values())
    # Lip strip extent
    if lip_tris:
        Lt = np.concatenate(lip_tris).reshape(-1, 3)
        res["lip_extent"] = dict(x=[round(Lt[:, 0].min(), 4), round(Lt[:, 0].max(), 4)],
                                 z=[round(Lt[:, 2].min(), 4), round(Lt[:, 2].max(), 4)])
    return res


def main():
    d = sys.argv[1]
    out = {}
    for name, P in MODELS.items():
        out[name] = check(os.path.join(d, name + ".glb"), name, P)
    print(json.dumps(out, indent=1))


main()
