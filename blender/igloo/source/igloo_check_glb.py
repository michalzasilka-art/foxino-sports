# Numeric checks on the exported igloo GLBs (glTF coords: +Y up, entrance -Z, exit +Z).
# Usage: python igloo_check_glb.py <SM_Igloo_Shell.glb> <SM_Igloo_ExitPlug.glb>
import json, struct, sys, math
import numpy as np

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load(path):
    b = open(path, "rb").read()
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    bin_ = b[20 + jl + 8:]

    def acc(i):
        a = js["accessors"][i]
        bv = js["bufferViews"][a["bufferView"]]
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = NC[a["type"]]
        dt = CT[a["componentType"]]
        stride = bv.get("byteStride", 0)
        if stride and stride != n * np.dtype(dt).itemsize:
            raise ValueError("strided")
        return np.frombuffer(bin_, dt, a["count"] * n, off).reshape(a["count"], n) if n > 1 else np.frombuffer(bin_, dt, a["count"], off)
    out = []
    for node in js["nodes"]:
        if "mesh" not in node:
            continue
        for pr in js["meshes"][node["mesh"]]["primitives"]:
            P = acc(pr["attributes"]["POSITION"]).astype(np.float64)
            N = acc(pr["attributes"]["NORMAL"]).astype(np.float64)
            UV = acc(pr["attributes"]["TEXCOORD_0"]).astype(np.float64)
            I = acc(pr["indices"]).astype(np.int64).reshape(-1, 3)
            mat = js["materials"][pr["material"]]["name"]
            out.append(dict(node=node["name"], trs={k: node[k] for k in ("translation", "rotation", "scale") if k in node},
                            P=P, N=N, UV=UV, I=I, mat=mat))
    return js, out


def tri_box(tri, lo, hi):
    """SAT test triangle vs AABB"""
    c = (lo + hi) / 2
    h = (hi - lo) / 2
    v = tri - c
    e = [v[1] - v[0], v[2] - v[1], v[0] - v[2]]
    for i in range(3):
        if v[:, i].min() > h[i] or v[:, i].max() < -h[i]:
            return False
    n = np.cross(e[0], e[1])
    r = np.abs(n) @ h
    if abs(n @ v[0]) > r:
        return False
    for ei in e:
        for ax in np.eye(3):
            a = np.cross(ei, ax)
            if not a.any():
                continue
            p = v @ a
            r = np.abs(a) @ h
            if p.min() > r or p.max() < -r:
                return False
    return True


def main(shell_p, plug_p):
    rep = {}
    js_s, S = load(shell_p)
    js_p, Pl = load(plug_p)
    s, p = S[0], Pl[0]
    rep["nodes"] = {"shell": [m["node"] for m in S], "plug": [m["node"] for m in Pl], "trs_shell": s["trs"], "trs_plug": p["trs"]}
    rep["tris"] = {"shell": int(sum(len(m["I"]) for m in S)), "plug": int(sum(len(m["I"]) for m in Pl))}
    rep["materials"] = [s["mat"], p["mat"]]
    rep["has"] = {k: [k in js_s, k in js_p] for k in ("cameras", "lights", "animations", "skins", "extensionsUsed")}
    # ride line: |x|<2.6, 0<y<4.4, -15.6<z<9.6 (glTF)
    lo, hi = np.array([-2.6, 0.0, -15.6]), np.array([2.6, 4.4, 9.6])
    def hits(m, lo, hi):
        T = m["P"][m["I"]]
        cand = np.where((T[:, :, 0].min(1) < hi[0]) & (T[:, :, 0].max(1) > lo[0]) & (T[:, :, 1].min(1) < hi[1]) &
                        (T[:, :, 1].max(1) > lo[1]) & (T[:, :, 2].min(1) < hi[2]) & (T[:, :, 2].max(1) > lo[2]))[0]
        return [int(i) for i in cand if tri_box(T[i], lo, hi)]
    hs = hits(s, lo, hi)
    zs = s["P"][s["I"][hs]][:, :, 2] if hs else np.zeros((0, 3))
    rep["ride_shell_hits"] = {"count": len(hs), "z_range": [float(zs.min()), float(zs.max())] if hs else None}
    # dome part only (in front of the doorway, z > -7.5)
    lo2 = np.array([-2.6, 0.0, -7.5])
    rep["ride_shell_hits_dome_z>-7.5"] = len(hits(s, lo2, hi))
    # tunnel channel inner profile corridor (|x|<2.5 minus arch) is checked via a slimmer box too
    rep["ride_shell_hits_tunnel_box_|x|<2.45_y<2.35"] = len(hits(s, np.array([-2.45, 0.0, -15.6]), np.array([2.45, 2.35, 9.6])))
    rep["ride_plug_hits"] = len(hits(p, lo, hi))
    # plug covers the corridor at the exit: rays along +z through the corridor must hit the plug
    # border: plug outer/inner verts with r ~ 9.55 / 9.0 that coincide with shell verts
    def rad(P):
        return np.linalg.norm(P, axis=1)
    from collections import defaultdict
    key = lambda q: tuple(np.round(q / 0.0005).astype(np.int64))
    sh = defaultdict(list)
    for i, q in enumerate(s["P"]):
        sh[key(q)].append(i)
    match, worst_d, worst_a, nb, uvsame = 0, 0.0, 0.0, 0.0, 0
    pr_ = rad(p["P"])
    for i, q in enumerate(p["P"]):
        r = pr_[i]
        surf = (abs(r - 9.55) < 0.002 or abs(r - 9.0) < 0.002)
        if not surf:
            continue
        # only loops on the outer/inner surface: normal radial
        rn = q / r
        if abs(abs(p["N"][i] @ rn) - 1) > 1e-3:
            continue
        cands = sh.get(key(q), [])
        best = None
        for j in cands:
            d = np.linalg.norm(s["P"][j] - q)
            if d < 0.001 and abs(abs(s["N"][j] @ rn) - 1) < 1e-3:
                ang = math.degrees(math.acos(min(1, max(-1, s["N"][j] @ p["N"][i]))))
                uvd = float(np.linalg.norm(s["UV"][j] - p["UV"][i]))
                if best is None or (uvd, ang) < (best[2], best[1]):
                    best = (d, ang, uvd)
        if best:
            match += 1
            worst_d = max(worst_d, best[0])
            worst_a = max(worst_a, best[1])
            nb = max(nb, best[2])
            uvsame += best[2] < 1e-4
    rep["border"] = {"plug_surface_verts_matched_in_shell": match, "max_dist_mm": worst_d * 1000, "max_normal_deg": worst_a, "verts_with_identical_uv_in_shell": uvsame, "max_uv_diff": nb}
    # plug extent
    P = p["P"]
    rep["plug_extent"] = {"x": [float(P[:, 0].min()), float(P[:, 0].max())], "y": [float(P[:, 1].min()), float(P[:, 1].max())],
                          "z": [float(P[:, 2].min()), float(P[:, 2].max())]}
    # plug closed? (weld by position)
    kk = {}
    ids = np.array([kk.setdefault(key(q), len(kk)) for q in P])
    E = defaultdict(int)
    for t in p["I"]:
        a, b, c = ids[t]
        for e in ((a, b), (b, c), (c, a)):
            E[tuple(sorted(e))] += 1
    rep["plug_open_edges"] = sum(1 for v in E.values() if v != 2)
    # sizes
    Q = s["P"]
    r = rad(Q)
    inner = Q[(np.abs(r - 9.0) < 0.003) & (Q[:, 2] > -8)]
    rep["dome"] = {"inner_r_min_vertex": float(r[(Q[:, 1] > 0.5) & (Q[:, 2] > -8) & (r < 9.3)].min()),
                   "inner_r_max_vertex": float(r[(Q[:, 1] > 0.5) & (Q[:, 2] > -8) & (r < 9.3)].max()),
                   "outer_r_max": float(r.max() if True else 0), "top_y": float(Q[:, 1].max()),
                   "inner_top_y": float(Q[(np.abs(Q[:, 0]) < 0.5) & (np.abs(Q[:, 2]) < 0.5), 1].min())}
    tun = Q[Q[:, 2] < -9.6]
    chan = tun[np.abs(tun[:, 0]) < 2.75]
    rep["tunnel"] = {"open_end_z": float(Q[:, 2].min()), "inner_half_width": float(np.abs(chan[(chan[:, 1] > 0.2) & (chan[:, 1] < 2.3), 0]).min()),
                     "inner_crown_y": float(chan[np.abs(chan[:, 0]) < 0.3, 1].min()), "outer_crown_y": float(tun[:, 1].max()),
                     "outer_half_width": float(np.abs(tun[:, 0]).max())}
    rep["y_min"] = [float(s["P"][:, 1].min()), float(p["P"][:, 1].min())]
    return rep


if __name__ == "__main__":
    print(json.dumps(main(sys.argv[1], sys.argv[2]), indent=1))
