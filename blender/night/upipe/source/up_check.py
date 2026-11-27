"""Contract checks on the exported GLBs (headless):
  blender -b --factory-startup -P up_check.py -- <upipe_dir> <out_json>
- GLB JSON: nodes/children, materials, images, extensions, triangles, bounds (raw glTF space)
- riding surface of SM_UPipe_Section vs the analytic cross-section at z = 0, 5, 10
- end profiles z = 0 vs z = 10 (Section) and End z = 0 vs Section z = 0 (positions, normals, UV phase)
"""
import json
import math
import os
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
DIR, OUTJ = argv[0], argv[1]
XF, RT, XV, HV, HD = 2.6, 4.8, 7.4, 4.8, 5.1

CT = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    b = open(path, "rb").read()
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    bin_off = 20 + jl + 8
    return js, b[bin_off:]


def accessor(js, binb, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    n, c = a["count"], NC[a["type"]]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a["componentType"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0)
    if stride and stride != c * np.dtype(dt).itemsize:
        raw = np.frombuffer(binb, np.uint8, count=stride * n, offset=off).reshape(n, stride)
        return raw[:, :c * np.dtype(dt).itemsize].copy().view(dt).reshape(n, c)
    return np.frombuffer(binb, dt, count=n * c, offset=off).reshape(n, c) if c > 1 else \
        np.frombuffer(binb, dt, count=n, offset=off)


def glb_meshes(path):
    """{node name: dict(pos, nrm, uv, idx, material names)} in raw glTF space (identity nodes)."""
    js, binb = read_glb(path)
    out = {}
    for nd in js["nodes"]:
        if "mesh" not in nd:
            continue
        m = js["meshes"][nd["mesh"]]
        P, N, UV, I, mats = [], [], [], [], []
        base = 0
        for pr in m["primitives"]:
            at = pr["attributes"]
            p = accessor(js, binb, at["POSITION"])
            P.append(p); N.append(accessor(js, binb, at["NORMAL"]))
            UV.append(accessor(js, binb, at["TEXCOORD_0"]) if "TEXCOORD_0" in at else np.zeros((len(p), 2)))
            I.append(accessor(js, binb, pr["indices"]).astype(np.int64) + base)
            base += len(p)
            mats.append(js["materials"][pr["material"]]["name"])
        out[nd["name"]] = dict(pos=np.vstack(P), nrm=np.vstack(N), uv=np.vstack(UV),
                               idx=np.concatenate(I).reshape(-1, 3), mats=mats,
                               trs={k: nd[k] for k in ("translation", "rotation", "scale") if k in nd})
    return js, out


def glb_summary(path):
    js, ms = glb_meshes(path)
    names = [n["name"] for n in js["nodes"]]
    kids = {js["nodes"][i]["name"]: [js["nodes"][c]["name"] for c in js["nodes"][i].get("children", [])]
            for i in range(len(js["nodes"]))}
    allp = np.vstack([m["pos"] for m in ms.values()])
    return dict(
        file=os.path.basename(path), bytes=os.path.getsize(path),
        nodes=names, children={k: v for k, v in kids.items() if v},
        scene_roots=[js["nodes"][i]["name"] for i in js["scenes"][0]["nodes"]],
        tris={k: int(len(m["idx"])) for k, m in ms.items()},
        tris_total=int(sum(len(m["idx"]) for m in ms.values())),
        materials={k: m["mats"] for k, m in ms.items()},
        node_trs={k: m["trs"] for k, m in ms.items() if m["trs"]},
        images=[(im.get("name"), im.get("mimeType")) for im in js.get("images", [])],
        extensionsUsed=js.get("extensionsUsed", []),
        cameras=len(js.get("cameras", [])), lights="KHR_lights_punctual" in js.get("extensionsUsed", []),
        bounds_min=[round(float(v), 4) for v in allp.min(0)],
        bounds_max=[round(float(v), 4) for v in allp.max(0)],
    ), ms


def profile_dense():
    """Dense polyline of the exact right half riding profile (floor, arc, vertical to 5.1)."""
    pts = [(0.0, 0.0), (XF, 0.0)]
    for i in range(1, 20001):
        t = math.radians(90 * i / 20000)
        pts.append((XF + RT * math.sin(t), RT * (1 - math.cos(t))))
    pts.append((XV, HD))
    return np.array(pts)


def dist_to_poly(p, poly):
    a, b = poly[:-1], poly[1:]
    ab = b - a
    t = np.clip(((p - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-18), 0, 1)
    q = a + ab * t[:, None]
    return float(np.sqrt(((q - p) ** 2).sum(1)).min())


def riding_samples(ms):
    m = ms["SM_UPipe_Section"]
    verts = [Vector(v) for v in m["pos"]]
    bvh = BVHTree.FromPolygons(verts, [tuple(int(i) for i in f) for f in m["idx"]])
    poly = profile_dense()
    res = {}
    worst = (0.0, None)
    for z in (0.0, 5.0, 10.0):
        zz = min(max(z, 1e-4), 10 - 1e-4)
        devs = {"floor": 0.0, "transition": 0.0, "vertical": 0.0}
        n = 0
        for x in np.linspace(-7.4, 7.4, 593):
            ax = abs(x)
            sg = 1 if x >= 0 else -1
            if ax <= XF:
                hit = bvh.ray_cast(Vector((x, 3.0, zz)), Vector((0, -1, 0)))
                region = "floor"
            elif ax < XV - 1e-9:
                t = math.asin((ax - XF) / RT)
                c = Vector((sg * XF, RT, zz))
                d = Vector((sg * math.sin(t), -math.cos(t), 0))
                hit = bvh.ray_cast(c, d)
                region = "transition"
            else:
                hit = None
                region = "vertical"
            if region != "vertical":
                if hit[0] is None:
                    raise RuntimeError("no hit at x=%f z=%f" % (x, z))
                p = hit[0]
                e = dist_to_poly(np.array([[abs(p.x), p.y]]), poly)
                devs[region] = max(devs[region], e)
                if e > worst[0]:
                    worst = (e, (round(float(x), 4), z, region))
                n += 1
        # vertical wall: horizontal rays from the centre line at heights 4.8 .. 5.07 (5.07-5.10 is under the coping)
        for h in np.linspace(4.8, 5.07, 28):
            for sg in (-1, 1):
                hit = bvh.ray_cast(Vector((0, h, zz)), Vector((sg, 0, 0)))
                e = abs(abs(hit[0].x) - XV)
                devs["vertical"] = max(devs["vertical"], e)
                if e > worst[0]:
                    worst = (e, (sg * XV, round(float(h), 4), z, "vertical"))
                n += 1
        res["z=%g" % z] = {k: round(v * 1000, 3) for k, v in devs.items()} | {"samples": n}
    chord_sag = RT * (1 - math.cos(math.radians(90 / 24 / 2)))
    return dict(per_z_mm=res, worst_mm=round(worst[0] * 1000, 3), worst_at=worst[1],
                chord_sag_theory_mm=round(chord_sag * 1000, 3))


def ring(m, z, tol=1e-4):
    sel = np.abs(m["pos"][:, 2] - z) < tol
    return m["pos"][sel], m["nrm"][sel], m["uv"][sel]


def match(a, b):
    """max nearest distance both ways between two point sets (+ index pairs a->b)."""
    d = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(-1))
    return float(max(d.min(1).max(), d.min(0).max())), d.argmin(1)


def profile_match(ms_a, name_a, za, ms_b, name_b, zb, shift):
    out = {}
    for part in ("root", "Coping"):
        ka = name_a if part == "root" else "Coping"
        kb = name_b if part == "root" else "Coping"
        pa, na, ua = ring(ms_a[ka], za)
        pb, nb, ub = ring(ms_b[kb], zb)
        pa2 = pa.copy(); pa2[:, 2] = 0
        pb2 = pb.copy(); pb2[:, 2] = 0
        dmax, j = match(pa2, pb2)
        nd = float(np.degrees(np.arccos(np.clip((na * nb[j]).sum(1), -1, 1))).max())
        du = np.abs(ua[:, 0] - ub[j][:, 0]).max()
        dv = np.abs(((ua[:, 1] - ub[j][:, 1]) + 0.5) % 1.0 - 0.5).max()
        out[part] = dict(verts=(int(len(pa)), int(len(pb))), pos_max_mm=round(dmax * 1000, 4),
                         normal_max_deg=round(nd, 4), uv_u_max=round(float(du), 6),
                         uv_v_phase_max=round(float(dv), 6))
    return out


def main():
    rep = {}
    ms_all = {}
    for f in ("SM_UPipe_Section", "SM_UPipe_End", "SM_UPipe_Light"):
        s, ms = glb_summary(os.path.join(DIR, f + ".glb"))
        rep[f] = s
        ms_all[f] = ms
    sec, end = ms_all["SM_UPipe_Section"], ms_all["SM_UPipe_End"]
    rep["riding_surface"] = riding_samples(sec)
    rep["section_z0_vs_z10"] = profile_match(sec, "SM_UPipe_Section", 0.0, sec, "SM_UPipe_Section", 10.0, 0)
    rep["end_z0_vs_section_z0"] = profile_match(end, "SM_UPipe_End", 0.0, sec, "SM_UPipe_Section", 0.0, 0)
    # end: no geometry before the joint, wall closes within ~3.6 m
    e = end["SM_UPipe_End"]["pos"]
    rep["end_extra"] = dict(min_z=round(float(e[:, 2].min()), 5),
                            riding_wall_vertical_at_z=3.6,
                            max_z=round(float(e[:, 2].max()), 4))
    # axes sanity: section runs along +Z, up is +Y
    rep["axes"] = dict(section_z_range=[rep["SM_UPipe_Section"]["bounds_min"][2], rep["SM_UPipe_Section"]["bounds_max"][2]],
                       section_y_range=[rep["SM_UPipe_Section"]["bounds_min"][1], rep["SM_UPipe_Section"]["bounds_max"][1]])
    with open(OUTJ, "w") as fh:
        json.dump(rep, fh, indent=1)
    print("CHECK_DONE")


main()
