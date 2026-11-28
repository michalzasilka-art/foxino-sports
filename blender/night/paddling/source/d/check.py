"""Paddling N20 lane D: contract checks on an exported boat GLB (glTF axes in the report).
blender -b --factory-startup -P check.py -- <boat.glb>"""
import bpy, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import bmesh
GLB = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
bpy.context.view_layer.update()
SEATS = {"Seat_L1": (-0.42, 0.36, 2.3), "Seat_R1": (0.42, 0.36, 2.3), "Seat_L2": (-0.42, 0.36, 0.6),
         "Seat_R2": (0.42, 0.36, 0.6), "Seat_L3": (-0.42, 0.36, -1.1), "Seat_R3": (0.42, 0.36, -1.1),
         "Seat_Drum": (0.0, 0.36, 4.0)}
ROWS = [2.3, 0.6, -1.1]
def g(v):  # Blender -> glTF
    return np.array([v[0], v[2], -v[1]])
rep = {"file": GLB.replace("\\", "/").split("/")[-1], "objects": {}}
tri_pts = {}
for ob in bpy.data.objects:
    d = {"type": ob.type, "parent": ob.parent.name if ob.parent else None}
    if ob.type == "MESH":
        me = ob.data; me.calc_loop_triangles()
        mw = ob.matrix_world
        co = np.array([g(mw @ v.co) for v in me.vertices])
        d["tris"] = len(me.loop_triangles); d["verts"] = len(me.vertices)
        d["min"] = co.min(0).round(4).tolist(); d["max"] = co.max(0).round(4).tolist()
        d["materials"] = [m.name for m in me.materials]
        d["scale"] = [round(x, 5) for x in ob.matrix_world.to_scale()]
        tri_pts[ob.name] = np.array([[co[t.vertices[0]], co[t.vertices[1]], co[t.vertices[2]]] for t in me.loop_triangles])
    d["pos"] = g(ob.matrix_world.translation).round(5).tolist()
    rep["objects"][ob.name] = d
# seats
seat_err = {}
for k, p in SEATS.items():
    if k not in rep["objects"]:
        seat_err[k] = "MISSING"; continue
    seat_err[k] = round(float(np.abs(np.array(rep["objects"][k]["pos"]) - np.array(p)).max()), 6)
rep["seat_max_err"] = seat_err
lod0 = [n for n in rep["objects"] if n.startswith("Boat_") and not n.endswith("_LOD1")][0]
L0 = rep["objects"][lod0]
rep["length_z"] = round(L0["max"][2] - L0["min"][2], 4)
rep["z_range"] = [L0["min"][2], L0["max"][2]]
rep["x_range"] = [L0["min"][0], L0["max"][0]]
rep["y_range"] = [L0["min"][1], L0["max"][1]]
# rim / gunwale top: first hit from above just outside the liner flange, midship
ob0 = bpy.data.objects[lod0]
bm = bmesh.new(); bm.from_mesh(ob0.data); bm.transform(ob0.matrix_world); bvh = BVHTree.FromBMesh(bm)
def hit_down(x, zg):
    loc, n, i, dd = bvh.ray_cast(Vector((x, -zg, 5)), Vector((0, 0, -1)))
    return loc.z if loc else None
rim, flange, width = [], [], []
for zg in np.arange(-2.0, 2.01, 0.1):
    for x in (0.70, -0.70, 0.66, -0.66):
        h = hit_down(x, zg)
        if h is not None and h < 0.8: rim.append(h)
    for x in (0.64, -0.64):
        h = hit_down(x, zg)
        if h is not None and h < 0.8: flange.append(h)
    a, n_, i_, d_ = bvh.ray_cast(Vector((3, -zg, 0.3)), Vector((-1, 0, 0)))
    b, n_, i_, d_ = bvh.ray_cast(Vector((-3, -zg, 0.3)), Vector((1, 0, 0)))
    if a and b: width.append(a.x - b.x)
rep["gunwale_top_midship_median"] = round(float(np.median(rim)), 4)
rep["gunwale_top_p10_p90"] = [round(float(np.percentile(rim, 10)), 4), round(float(np.percentile(rim, 90)), 4)]
rep["hull_width_midship_median_at_y0.3"] = round(float(np.median(width)), 4)
bot, n_, i_, d_ = bvh.ray_cast(Vector((0, 0, -5)), Vector((0, 0, 1)))
rep["keel_y_midship"] = round(bot.z, 4)
cen = [(L0["min"][i] + L0["max"][i]) / 2 for i in range(3)]
rep["bbox_centre_xz"] = [round(cen[0], 4), round(cen[2], 4)]
# open interior: any triangle sample in |x|<0.6, y>0.36, |z-row|<0.5
def viol(tp):
    bad = 0
    us = [(i / 8, j / 8) for i in range(9) for j in range(9 - i)]
    W = np.array([[1 - a - b, a, b] for a, b in us])
    pts = np.einsum("sk,tkd->tsd", W, tp)   # tris x samples x 3
    res = {}
    for r in ROWS:
        m = (np.abs(pts[..., 0]) < 0.6) & (pts[..., 1] > 0.3601) & (np.abs(pts[..., 2] - r) < 0.5)
        res[r] = int(m.any(axis=1).sum())
    return res
rep["interior_violations"] = {n: viol(tp) for n, tp in tri_pts.items()}
drum = rep["objects"].get("Drum")
if drum:
    rep["drum_top_centre"] = drum.get("pos")
print("CHECK", json.dumps(rep))
