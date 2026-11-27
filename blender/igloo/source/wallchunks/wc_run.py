# Igloo W3 driver (lane B): plug GLB -> SM_Igloo_WallChunks.glb + checks + previews.
# Run inside Blender (MCP or -b -P). Paths are passed through run(...).
import bpy, os, sys, json, struct, time
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else None
if HERE and HERE not in sys.path:
    sys.path.insert(0, HERE)
import wc_fracture as wf
import wc_preview as wp


def glb_material_names(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    jl = struct.unpack_from('<I', data, 12)[0]
    js = json.loads(data[20:20 + jl])
    return [m.get("name") for m in js.get("materials", [])]


def import_into(path, coll_name, scene):
    coll = bpy.data.collections.get(coll_name)
    if coll is None:
        coll = bpy.data.collections.new(coll_name)
        scene.collection.children.link(coll)
    for o in list(coll.objects):
        bpy.data.objects.remove(o)
    lc = bpy.context.view_layer.layer_collection.children[coll.name]
    bpy.context.view_layer.active_layer_collection = lc
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            if c != coll:
                c.objects.unlink(o)
        if coll not in o.users_collection:
            coll.objects.link(o)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection
    return coll, new


def fix_material_names(obs, wanted):
    """Imported materials may come in as 'Name.001' when the name already exists."""
    for o in obs:
        for s in o.material_slots:
            m = s.material
            if m and m.name not in wanted:
                base = m.name.rsplit('.', 1)[0]
                if base in wanted:
                    other = bpy.data.materials.get(base)
                    if other:
                        other.name = base + "_old"
                    m.name = base


def fracture(plug_glb, out_glb, scene, impact=1.75, tries=16, max_total=6000):
    rep = {}
    plug_names = glb_material_names(plug_glb)
    pc, new = import_into(plug_glb, "W3_Plug", scene)
    meshes = [o for o in new if o.type == 'MESH']
    rep["plug_nodes"] = [(o.name, o.type, o.parent.name if o.parent else None, tuple(round(x, 4) for x in o.matrix_world.translation)) for o in new]
    fix_material_names(meshes, plug_names)
    if len(meshes) != 1:
        # join world-space copies into one temporary plug
        cp = [o.copy() for o in meshes]
        for c, o in zip(cp, meshes):
            c.data = o.data.copy(); pc.objects.link(c); c.matrix_world = o.matrix_world
        bpy.ops.object.select_all(action='DESELECT')
        for c in cp:
            c.select_set(True)
        bpy.context.view_layer.objects.active = cp[0]
        bpy.ops.object.join()
        plug_ob = cp[0]
    else:
        plug_ob = meshes[0]
    P = wf.Plug(plug_ob)
    rep["plug_tris"] = len(P.tris)
    rep["plug_mats"] = [m.name for m in P.mats]
    C = Vector((0, 0, 0))
    Rmid = sum((v - C).length for v in P.V) / len(P.V)
    rep["Rmid"] = round(Rmid, 3)
    log = []
    best = wf.search(P, C, Rmid, impact, tries=tries, max_total=max_total, log=log)
    if best is None:
        log2 = []
        best = wf.search(P, C, Rmid, impact, tries=tries, target=(28, 31), rmin=0.6, rmax=1.5,
                         max_total=max_total, log=log2)
        log += log2
    rep["search"] = log
    if best is None:
        rep["error"] = "no valid fracture under budget"
        return rep, None
    tot, sd, cells, seeds = best[:4]
    rep["seed"] = sd
    cc = bpy.data.collections.get("W3_Chunks") or bpy.data.collections.new("W3_Chunks")
    if cc.name not in scene.collection.children:
        scene.collection.children.link(cc)
    for o in list(cc.objects):
        bpy.data.objects.remove(o)
    root, obs = wf.build_chunks(P, cells, seeds, impact, cc)
    bpy.context.view_layer.update()
    rep["coverage"] = wf.coverage(P, obs, len(P.mats))
    per = []
    for o in obs:
        bm = __import__("bmesh").new(); bm.from_mesh(o.data)
        s = wf.bm_stats(bm); bm.free()
        per.append(dict(name=o.name, tris=s["tris"], mindim=round(s["mindim"], 3), closed=s["closed"],
                        islands=s["islands"], vol=round(s["vol"], 4),
                        centroid_offset_mm=round(wf.bm_volume_centroid_mesh(o)[1].length * 1000, 3)))
    rep["chunks"] = per
    for m in P.mats:
        assert m.name in plug_names, (m.name, plug_names)
    wf.export_glb(root, obs, out_glb)
    rep["glb"] = wf.read_glb(out_glb)
    return rep, (P, plug_ob, root, obs)
