"""Paddling N20 (lane D): shared helpers for the Tripo dragon-boat clean-up.
Blender axes in here: +Z up, bow at Blender -Y (glTF +Z), width along X.
glTF (x, y, z) = Blender (x, z, -y)."""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

LENGTH = 11.4
GUNWALE = 0.42

CFG = {
    "hare": dict(name="Boat_Hare", rot=+1, s=8.0, sx=1.05, stretch=(-0.37, 0.28), ramp=0.05),
    "owl":  dict(name="Boat_Owl",  rot=-1, s=6.8, sx=1.03, under=0.72, stretch=(-0.37, 0.31), ramp=0.05),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_raw(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    obs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    ob = obs[0]
    bpy.context.view_layer.update()
    ob.data.transform(ob.matrix_world)
    ob.matrix_world = Matrix()
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    ob.name = "Src"
    return ob


def weld_and_drop_islands(ob, min_tris=60):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.faces.ensure_lookup_table()
    seen = set(); kill = []
    for f in bm.faces:
        if f.index in seen:
            continue
        st = [f]; seen.add(f.index); comp = []
        while st:
            g = st.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index); st.append(h)
        ntri = sum(len(x.verts) - 2 for x in comp)
        if ntri < min_tris:
            kill += comp
    dropped = sum(len(x.verts) - 2 for x in kill)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(ob.data); bm.free()
    return dropped


def length_map(cfg, bmin, bmax):
    """Table b -> F(b) (glTF z) : uniform scale s at the ends, stretched in the middle."""
    s = cfg["s"]; a, c = cfg["stretch"]; r = cfg["ramp"]
    bs = np.linspace(bmin, bmax, 4001)
    def sstep(t):
        t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
    w = sstep((bs - a) / r) * (1 - sstep((bs - (c - r)) / r))
    db = bs[1] - bs[0]
    W = np.trapezoid(w, bs) if hasattr(np, "trapezoid") else np.trapz(w, bs)
    m = 1 + (LENGTH / s / (bmax - bmin) * (bmax - bmin) - (bmax - bmin)) / W
    k = s * (1 + (m - 1) * w)
    F = np.concatenate([[0], np.cumsum((k[1:] + k[:-1]) / 2 * db)])
    F -= (F[0] + F[-1]) / 2
    return bs, F, m


def transform_to_contract(ob, cfg):
    """Rotate bow to Blender -Y, stretch length to 11.4 m, scale section by s. Returns stretch factor."""
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get("co", co); co = co.reshape(n, 3)
    if cfg["rot"] > 0:   # +90 about Z: (x,y,z)->(-y,x,z)
        x, y = -co[:, 1], co[:, 0]
    else:                # -90 about Z: (x,y,z)->(y,-x,z)
        x, y = co[:, 1], -co[:, 0]
    z = co[:, 2]
    b = -y
    bs, F, m = length_map(cfg, b.min(), b.max())
    zf = np.interp(b, bs, F)
    s = cfg["s"]
    out = np.stack([x * s * cfg.get('sx', 1.0), -zf, z * s], axis=1)
    me.vertices.foreach_set("co", out.ravel())
    me.update()
    return m


def bvh_of(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
    t = BVHTree.FromBMesh(bm); bm.free(); return t


def ray(bvh, o, d):
    loc, nor, idx, dist = bvh.ray_cast(Vector(o), Vector(d))
    return loc


def g2b(p):
    """glTF (x,y,z) -> Blender (x,-z,y)"""
    return Vector((p[0], -p[2], p[1]))


SEATS = {
    "Seat_L1": (-0.42, 0.36, 2.3), "Seat_R1": (0.42, 0.36, 2.3),
    "Seat_L2": (-0.42, 0.36, 0.6), "Seat_R2": (0.42, 0.36, 0.6),
    "Seat_L3": (-0.42, 0.36, -1.1), "Seat_R3": (0.42, 0.36, -1.1),
    "Seat_Drum": (0.0, 0.36, 4.0),
}
ROWS = [2.3, 0.6, -1.1]
