"""Read the exported segment GLBs back (no Blender needed) and check the size contract and the seam.
"C:\\Program Files\\Blender Foundation\\Blender 5.2\\5.2\\python\\bin\\python.exe" check_glb.py <icecave_dir>
"""
import itertools
import json
import struct
import sys

import numpy as np

PROF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25),
        (4.95, 4.95), (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
POLY = np.array([(-x, y) for x, y in PROF] + [(x, y) for x, y in reversed(PROF[:-1])])
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load(path):
    b = open(path, "rb").read()
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    binc = b[20 + jl + 8:]

    def acc(i):
        a = js["accessors"][i]
        bv = js["bufferViews"][a["bufferView"]]
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = NC[a["type"]]
        arr = np.frombuffer(binc, CT[a["componentType"]], a["count"] * n, off)
        return arr.reshape(a["count"], n) if n > 1 else arr
    return js, acc, len(b)


def seg_dist(p, poly):
    best = np.full(len(p), 1e9)
    for a, b in zip(poly[:-1], poly[1:]):
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        d = np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
        best = np.minimum(best, d)
    return best


def inside_profile(p):
    """True where (x, y) is inside the end-profile arch (towards the axis)."""
    yx = np.interp(p[:, 1], [y for _, y in PROF][::1], [x for x, _ in PROF])
    return np.abs(p[:, 0]) < yx - 1e-3


def main(d):
    out, ends = {}, {}
    for tag in ("A", "B"):
        js, acc, size = load(f"{d}/SM_IceCave_Segment_{tag}.glb")
        prim = js["meshes"][0]["primitives"][0]
        P = acc(prim["attributes"]["POSITION"]).astype(np.float64)
        N = acc(prim["attributes"]["NORMAL"]).astype(np.float64)
        idx = acc(prim["indices"])
        mat = js["materials"][0]
        r = dict(size=size, tris=len(idx) // 3, verts=len(P), nodes=[n.get("name") for n in js["nodes"]],
                 node_trs={k: js["nodes"][0][k] for k in ("translation", "rotation", "scale") if k in js["nodes"][0]},
                 meshes=len(js["meshes"]), materials=[m["name"] for m in js["materials"]],
                 images=[(im.get("name"), im.get("mimeType")) for im in js.get("images", [])],
                 emissive=mat.get("emissiveFactor"), extensions=js.get("extensionsUsed", []),
                 cameras=len(js.get("cameras", [])), bbox=[P.min(0).round(4).tolist(), P.max(0).round(4).tolist()])
        # run goes along +Z, up is +Y: apex near y 6.2, z spans 0..10
        r["axes_ok"] = bool(abs(P[:, 2].min()) < 1e-4 and abs(P[:, 2].max() - 10) < 1e-4 and P[:, 1].min() > -1e-4)
        # inner surface: normals face the cave interior (caps carry +-Z, outer box/floor strips face away)
        toc = np.stack([-P[:, 0], 2.0 - P[:, 1]], 1)
        inner = (np.abs(N[:, 2]) < 0.5) & ((N[:, :2] * toc).sum(1) > 0)
        e = {}
        for z in (0.0, 10.0):
            m = inner & (np.abs(P[:, 2] - z) < 1e-4)
            pts, nrm = P[m][:, :2], N[m]
            dist = seg_dist(pts, POLY)
            have = np.linalg.norm(POLY[:, None] - pts[None], axis=2).min(1)  # each profile point has a vertex
            e[z] = (pts, nrm)
            r[f"end_z{int(z)}"] = dict(verts=int(m.sum()), max_off_profile_mm=float(dist.max() * 1000),
                                       profile_points_missing=int((have > 1e-3).sum()))
        ends[tag] = e
        # floor and clear space (inner surface only)
        Pi = P[inner]
        r["min_y"] = float(P[:, 1].min())
        r["floor_faces_inside"] = 0
        tri = P[idx.reshape(-1, 3)]
        flat = (np.abs(tri[:, :, 1]) < 1e-4).all(1) & (np.abs(tri[:, :, 0]) < 8 - 1e-3).any(1)
        r["floor_faces_inside"] = int(flat.sum())
        box = (Pi[:, 1] < 4.0) & (np.abs(Pi[:, 0]) < 6.5)
        r["clear_box_verts"] = int(box.sum())
        r["clear_box_verts_inward_of_profile"] = int((box & inside_profile(Pi)).sum())
        out[tag] = r
    # seam: every pairing (A->A, A->B, B->A, B->B): end of first at z10 vs start of second at z0
    seams = {}
    for a, b in itertools.product("AB", "AB"):
        pa, na = ends[a][10.0]
        pb, nb = ends[b][0.0]
        dmat = np.linalg.norm(pa[:, None] - pb[None], axis=2)
        j = dmat.argmin(1)
        pos_gap = dmat.min(1).max()
        unmatched_b = (dmat.min(0) > 1e-3).sum()
        ang = np.degrees(np.arccos(np.clip((na * nb[j]).sum(1), -1, 1))).max()
        seams[f"{a}->{b}"] = dict(max_pos_gap_mm=float(pos_gap * 1000), unmatched=int(unmatched_b),
                                  max_normal_angle_deg=float(ang))
    out["seams"] = seams
    print(json.dumps(out, indent=1))


main(sys.argv[1])
