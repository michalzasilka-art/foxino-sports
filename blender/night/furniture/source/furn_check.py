"""Read the exported furniture GLBs back (raw glTF, no Blender) and check the contract.

  python furn_check.py <furniture_dir> [out.json]

glTF axes: +Y up, +Z downhill, signs face -Z (uphill, toward the rider).
"""
import json
import os
import struct
import sys

import numpy as np

DIR = os.path.abspath(sys.argv[1])
OUTJ = sys.argv[2] if len(sys.argv) > 2 else None
BUDGET = {"SM_Arch_Start": 1500, "SM_Arch_Finish": 1500, "SM_Board": 1500, "SM_Fence": 1500,
          "SM_FlagPole": 1500, "SM_StartHut": 3000, "SM_Floodlight": 1500}
KIDS = {"SM_Arch_Start": ["SignFace"], "SM_Arch_Finish": ["SignFace"], "SM_Board": ["SignFace"], "SM_Fence": [],
        "SM_FlagPole": ["FlagCloth"], "SM_StartHut": ["SignFace", "glow"], "SM_Floodlight": ["glow"]}
SIGN = {"SM_Arch_Start": (18.0, 2.2), "SM_Arch_Finish": (22.0, 2.4), "SM_Board": (3.2, 1.6), "SM_StartHut": (1.6, 0.4)}
OPENING = {"SM_Arch_Start": 20.0, "SM_Arch_Finish": 24.0}
CT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load(path):
    b = open(path, "rb").read()
    magic, ver, length = struct.unpack_from("<III", b, 0)
    assert magic == 0x46546C67 and ver == 2
    off, js, binc = 12, None, None
    while off < length:
        cl, ct = struct.unpack_from("<II", b, off)
        chunk = b[off + 8:off + 8 + cl]
        if ct == 0x4E4F534A:
            js = json.loads(chunk)
        elif ct == 0x004E4942:
            binc = chunk
        off += 8 + cl
    return js, binc


def acc(js, binc, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    n, c = a["count"], NC[a["type"]]
    dt = np.dtype("<" + CT[a["componentType"]])
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or dt.itemsize * c
    raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (n - 1) + dt.itemsize * c, offset=start)
    out = np.lib.stride_tricks.as_strided(raw, shape=(n, c * dt.itemsize), strides=(stride, 1)).copy()
    return out.view(dt).reshape(n, c).astype(np.float64)


def tri_min_y_in_slab(P, T, hw):
    """Lowest y of the triangle area inside |x| < hw (clips each triangle to the slab)."""
    best = np.inf
    for t in T:
        pts = P[t]
        poly = [p for p in pts]
        for xc, keep in ((-hw, lambda q: q[0] >= -hw), (hw, lambda q: q[0] <= hw)):
            out = []
            for k in range(len(poly)):
                a, b = poly[k], poly[(k + 1) % len(poly)]
                ka, kb = keep(a), keep(b)
                if ka:
                    out.append(a)
                if ka != kb:
                    s = (xc - a[0]) / (b[0] - a[0])
                    out.append(a + s * (b - a))
            poly = out
            if not poly:
                break
        # a clipped polygon lying only on the boundary planes (x == +-hw, e.g. a post's inner face) is not inside
        if poly and not (all(q[0] > hw - 1e-4 for q in poly) or all(q[0] < -hw + 1e-4 for q in poly)):
            best = min(best, min(q[1] for q in poly))
    return best


def check(name):
    path = os.path.join(DIR, name + ".glb")
    js, binc = load(path)
    r = {"file": name + ".glb", "bytes": os.path.getsize(path)}
    nodes = js["nodes"]
    scene_roots = js["scenes"][js.get("scene", 0)]["nodes"]
    r["roots"] = [nodes[i]["name"] for i in scene_roots]
    root = nodes[scene_roots[0]]
    r["root_transform"] = {k: root[k] for k in ("translation", "rotation", "scale", "matrix") if k in root}
    kids = [nodes[i] for i in root.get("children", [])]
    r["children"] = [k["name"] for k in kids]
    r["extensionsUsed"] = js.get("extensionsUsed", [])
    r["no_draco_meshopt"] = not any(e in r["extensionsUsed"] for e in ("KHR_draco_mesh_compression", "EXT_meshopt_compression"))
    r["cameras_lights"] = len(js.get("cameras", [])) + len(js.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", []))
    r["images"] = [im.get("mimeType") for im in js.get("images", [])]
    mats = js.get("materials", [])
    tris, allP, allT, per = 0, [], [], {}
    base = 0
    for nd in [root] + kids:
        if "mesh" not in nd:
            continue
        assert not any(k in nd for k in ("translation", "rotation", "scale", "matrix")), nd["name"]
        info = {"tris": 0, "materials": [], "uv": True}
        for pr in js["meshes"][nd["mesh"]]["primitives"]:
            P = acc(js, binc, pr["attributes"]["POSITION"])
            I = acc(js, binc, pr["indices"]).astype(np.int64).reshape(-1, 3)
            info["tris"] += len(I)
            info["materials"].append(mats[pr["material"]]["name"] if "material" in pr else None)
            info["uv"] &= "TEXCOORD_0" in pr["attributes"]
            allP.append(P)
            allT.append(I + base)
            base += len(P)
            if nd["name"] == "SignFace":
                UV = acc(js, binc, pr["attributes"]["TEXCOORD_0"])
                n = np.cross(P[I[0][1]] - P[I[0][0]], P[I[0][2]] - P[I[0][0]])
                n /= np.linalg.norm(n)
                lo, hi = P.min(0), P.max(0)
                corner = lambda sx, sy: int(np.argmin(np.abs(P[:, 0] - (hi[0] if sx > 0 else lo[0])) + np.abs(P[:, 1] - (hi[1] if sy > 0 else lo[1]))))
                info["sign"] = {
                    "verts": len(P), "width_x": round(hi[0] - lo[0], 4), "height_y": round(hi[1] - lo[1], 4),
                    "z": [round(lo[2], 4), round(hi[2], 4)], "bottom_y": round(lo[1], 4), "top_y": round(hi[1], 4),
                    "normal": [round(x, 4) for x in n],
                    "uv_min": [round(x, 4) for x in UV.min(0)], "uv_max": [round(x, 4) for x in UV.max(0)],
                    "uv_stored_at_rider_left_bottom(+x,low y)": [round(x, 4) for x in UV[corner(1, -1)]],
                    "uv_stored_at_rider_right_top(-x,high y)": [round(x, 4) for x in UV[corner(-1, 1)]],
                }
        per[nd["name"]] = info
        tris += info["tris"]
    P = np.concatenate(allP)
    T = np.concatenate(allT)
    r["tris_total"], r["budget"], r["per_node"] = tris, BUDGET[name], per
    r["bounds_min"] = [round(x, 4) for x in P.min(0)]
    r["bounds_max"] = [round(x, 4) for x in P.max(0)]
    r["kids_ok"] = sorted(r["children"]) == sorted(KIDS[name]) and all(
        per[k]["materials"] == [k] for k in KIDS[name])
    ok = r["kids_ok"] and tris <= BUDGET[name] and r["no_draco_meshopt"] and r["cameras_lights"] == 0
    ok &= abs(P.min(0)[1]) < 1e-4 and not r["root_transform"]
    if name in SIGN:
        s = per["SignFace"]["sign"]
        w, h = SIGN[name]
        s["size_err"] = round(max(abs(s["width_x"] - w), abs(s["height_y"] - h)), 5)
        s["uv_ok"] = (s["uv_min"] == [0.0, 0.0] and s["uv_max"] == [1.0, 1.0]
                      and s["uv_stored_at_rider_left_bottom(+x,low y)"] == [0.0, 1.0]
                      and s["uv_stored_at_rider_right_top(-x,high y)"] == [1.0, 0.0])
        s["faces_uphill(-Z)"] = s["normal"][2] < -0.999
        ok &= s["size_err"] < 1e-3 and s["uv_ok"] and s["faces_uphill(-Z)"]
    if name in OPENING:
        hw = OPENING[name] / 2
        lowest = tri_min_y_in_slab(P, T, hw)
        r["opening_width"] = OPENING[name]
        r["lowest_geometry_inside_opening_y"] = round(float(lowest), 4)
        inner = P[(P[:, 1] < 4.5)]
        r["min_abs_x_below_4.5m"] = round(float(np.abs(inner[:, 0]).min()), 4)
        ok &= lowest >= 4.5 and r["min_abs_x_below_4.5m"] >= hw - 1e-4
    if name == "SM_Fence":
        e0 = P[np.abs(P[:, 0] + 2.0) < 1e-5][:, 1:]
        e1 = P[np.abs(P[:, 0] - 2.0) < 1e-5][:, 1:]
        k0 = {tuple(np.round(q, 4)) for q in e0}
        k1 = {tuple(np.round(q, 4)) for q in e1}
        r["fence"] = {"verts_at_x-2": len(k0), "verts_at_x+2": len(k1), "end_profiles_match": k0 == k1,
                      "geometry_x_range": [round(P[:, 0].min(), 4), round(P[:, 0].max(), 4)]}
        # posts: vertices above the drift and near the ends -> centre
        for s_ in (-1, 1):
            m = (P[:, 1] > 0.5) & (P[:, 1] < 1.2) & (np.abs(P[:, 0] - 2 * s_) < 0.1) & (np.abs(P[:, 2]) < 0.1)
            r["fence"][f"post_centre_{'+' if s_ > 0 else '-'}"] = [round(float(np.mean(P[m][:, 0])), 4), round(float(np.mean(P[m][:, 2])), 4)]
        ok &= r["fence"]["end_profiles_match"] and len(k0) > 0
    if name == "SM_FlagPole":
        f = per["FlagCloth"]
        r["flag_double_sided"] = [m.get("doubleSided", False) for m in mats if m["name"] == "FlagCloth"]
    r["glow_emissive"] = [m.get("emissiveFactor") for m in mats if m["name"] == "glow"]
    r["PASS"] = bool(ok)
    return r


res = {n: check(n) for n in BUDGET}
txt = json.dumps(res, indent=1, default=lambda o: o.item())
print(txt)
if OUTJ:
    open(OUTJ, "w").write(txt)
print("ALL_PASS", all(v["PASS"] for v in res.values()))
