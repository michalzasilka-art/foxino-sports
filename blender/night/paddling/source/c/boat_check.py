# Paddling N20 (lane C): contract checks on the exported GLBs (plain GLB reader, no Blender needed).
# python boat_check.py <glb> [<glb> ...]
import json, struct, sys, os
import numpy as np

SEATS = {"Seat_L1": (0.42, 0.36, 2.3), "Seat_R1": (-0.42, 0.36, 2.3), "Seat_L2": (0.42, 0.36, 0.6),
         "Seat_R2": (-0.42, 0.36, 0.6), "Seat_L3": (0.42, 0.36, -1.1), "Seat_R3": (-0.42, 0.36, -1.1),
         "Seat_Drum": (0.0, 0.36, 4.0)}
ROWS = [2.3, 0.6, -1.1]
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load(p):
    b = open(p, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    off = 20 + n
    blen = struct.unpack("<I", b[off:off + 4])[0]
    binc = b[off + 8: off + 8 + blen]
    return j, binc


def acc(j, binc, i):
    a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]
    dt = CT[a["componentType"]]; nc = NC[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = np.frombuffer(binc, dtype=dt, count=a["count"] * nc, offset=start)
    return arr.reshape(a["count"], nc) if nc > 1 else arr


def check(p):
    j, binc = load(p)
    rep = {"file": os.path.basename(p), "size_kb": round(os.path.getsize(p) / 1024, 1), "ok": True, "notes": []}
    nodes = j["nodes"]
    roots = j["scenes"][0]["nodes"]
    rep["roots"] = [nodes[i]["name"] for i in roots]
    rep["children"] = {nd["name"]: [nodes[c]["name"] for c in nd["children"]] for nd in nodes if nd.get("children")}
    for nd in nodes:
        if any(k in nd for k in ("rotation", "scale", "matrix")):
            rep["notes"].append("node %s has rotation/scale/matrix" % nd["name"])
    meshes = {}
    for nd in nodes:
        if "mesh" in nd:
            t = np.array(nd.get("translation", [0, 0, 0]))
            m = j["meshes"][nd["mesh"]]
            P = []; T = 0; F = []
            for pr in m["primitives"]:
                pos = acc(j, binc, pr["attributes"]["POSITION"]).astype(np.float64) + t
                idx = acc(j, binc, pr["indices"]).astype(np.int64).reshape(-1, 3)
                T += len(idx); P.append(pos); F.append(pos[idx])
            meshes[nd["name"]] = (np.vstack(P), T, np.vstack(F), len(m["primitives"]))
    rep["tris"] = {k: v[1] for k, v in meshes.items()}
    rep["materials"] = [m.get("name") for m in j.get("materials", [])]
    rep["images"] = [(im.get("name"), im.get("mimeType")) for im in j.get("images", [])]
    name = [k for k in meshes if k.startswith("Boat_") and not k.endswith("_LOD1")][0]
    for lod in (name, name + "_LOD1"):
        P, T, F, npr = meshes[lod]
        mn, mx = P.min(0), P.max(0)
        r = {"min": [round(float(v), 3) for v in mn], "max": [round(float(v), 3) for v in mx],
             "length_z": round(float(mx[2] - mn[2]), 3), "width_x": round(float(mx[0] - mn[0]), 3)}
        # gunwale top: highest point of the rim band (|x| > 0.55) along the crew zone, per 0.25 m station
        tops = []
        for z in np.arange(-2.5, 3.01, 0.25):
            band = np.abs(P[:, 2] - z) < 0.125
            mid = band & (P[:, 1] > 0.2) & (P[:, 1] < 0.5)
            if not mid.any():
                continue
            W = np.abs(P[mid, 0]).max()
            sel = band & (np.abs(P[:, 0]) > W - 0.15) & (P[:, 1] < 0.7)
            if sel.any():
                tops.append(float(P[sel, 1].max()))
        r["gunwale_top_median"] = round(float(np.median(tops)), 3)
        r["gunwale_top_range"] = [round(min(tops), 3), round(max(tops), 3)]
        # open interior: any triangle with a part above 0.36 inside |x| < 0.6 at z +-0.5 of a row
        cen = F.mean(1)
        # test every vertex of every triangle and the centroid
        pts = np.concatenate([F, cen[:, None, :]], 1)  # (n,4,3)
        inside = (np.abs(pts[..., 0]) < 0.6) & (pts[..., 1] > 0.36 + 1e-4) & \
                 np.any([np.abs(pts[..., 2] - row) <= 0.5 for row in ROWS], 0)
        bad = int(inside.any(1).sum())
        if bad:
            r["violating_tris"] = [[[round(float(c), 3) for c in v] for v in F[i]] for i in np.where(inside.any(1))[0][:6]]
        r["crew_space_violations"] = bad
        # floor: centre line samples (lowest interior surface near x 0 at the rows)
        r["below_water_depth"] = round(float(mn[1]), 3)
        rep[lod] = r
        if bad:
            rep["ok"] = False
        if T > (3500 if lod == name else 1000):
            rep["ok"] = False; rep["notes"].append("%s over budget" % lod)
    P, T, F, _ = meshes["Drum"]
    top = P[P[:, 1] > P[:, 1].max() - 1e-4]
    rep["Drum"] = {"tris": T, "top_y": round(float(P[:, 1].max()), 3),
                   "top_centre": [round(float(v), 3) for v in top.mean(0)],
                   "radius": round(float(np.abs(P[:, 0]).max()), 3)}
    if T > 200: rep["ok"] = False
    seats = {}
    for nd in nodes:
        if nd["name"].startswith("Seat_"):
            if "mesh" in nd:
                rep["ok"] = False; rep["notes"].append(nd["name"] + " has a mesh")
            t = nd.get("translation", [0, 0, 0])
            want = SEATS[nd["name"]]
            err = max(abs(a - b) for a, b in zip(t, want))
            seats[nd["name"]] = ([round(v, 4) for v in t], round(err, 6))
            if err > 1e-4:
                rep["ok"] = False
    rep["seats"] = seats
    if set(seats) != set(SEATS):
        rep["ok"] = False; rep["notes"].append("seat names differ")
    return rep


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(json.dumps(check(p), indent=1))
