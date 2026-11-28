import bpy, sys, json, os
import numpy as np
GLB = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=GLB); bpy.context.view_layer.update()
rep = {"file": os.path.basename(GLB), "bytes": os.path.getsize(GLB), "meshes": {}, "materials": sorted(m.name for m in bpy.data.materials if m.users),
       "images": [(i.name, list(i.size)) for i in bpy.data.images]}
for ob in bpy.data.objects:
    if ob.type != "MESH": continue
    me = ob.data; me.calc_loop_triangles(); mw = ob.matrix_world
    co = np.array([(mw @ v.co)[:] for v in me.vertices]); g = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)
    base = g[g[:, 1] < g[:, 1].min() + 0.05]
    rep["meshes"][ob.name] = dict(tris=len(me.loop_triangles), parent=ob.parent.name if ob.parent else None,
        mats=[m.name for m in me.materials], height=round(float(g[:, 1].max()), 3), min_y=round(float(g[:, 1].min()), 4),
        base_centre_xz=[round(float(base[:, 0].mean()), 3), round(float(base[:, 2].mean()), 3)],
        width_x=round(float(np.ptp(g[:, 0])), 3), node_pos=[round(x, 4) for x in (mw.translation.x, mw.translation.z, -mw.translation.y)],
        scale=[round(x, 4) for x in mw.to_scale()])
print("TCHECK", json.dumps(rep))
