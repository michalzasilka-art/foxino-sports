"""Read the exported GLBs back and check them.
blender -b --factory-startup -P rl_check.py -- <glb_dir> <json_out>
- raw GLB parse: triangles, nodes, materials, images (mime), cameras/lights, extensions, bounds in glTF axes
- slide top: ray straight down at x = 0 every 1 cm over z = 0..L (glTF), worst |y - target|
"""
import bpy, json, math, os, struct, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:]
GLB_DIR, OUT = argv[0], argv[1]


def fun_profile(z):
    if z <= 1.0 or z >= 11.0:
        return 0.5
    if z < 3.0:
        return 0.5 + 0.05 * (1 - math.cos(math.pi * (z - 1.0) / 2.0))
    if z <= 9.0:
        return 0.6
    return 0.5 + 0.05 * (1 - math.cos(math.pi * (11.0 - z) / 2.0))


TARGETS = {
    'SM_Rail_Cane': (13.0, lambda z: 0.5),
    'SM_Box': (13.0, lambda z: 0.42),
    'SM_Rail_Rainbow': (14.0, lambda z: 0.45 + 1.0 * math.sin(math.pi * z / 14.0)),
    'SM_FunBox': (12.0, fun_profile),
}


def raw(path):
    data = open(path, 'rb').read()
    magic, ver, length = struct.unpack_from('<III', data, 0)
    clen, ctype = struct.unpack_from('<II', data, 12)
    js = json.loads(data[20:20 + clen])
    tris = 0
    bmin, bmax = [1e9] * 3, [-1e9] * 3
    for m in js.get('meshes', []):
        for p in m['primitives']:
            acc = js['accessors'][p['indices']]
            tris += acc['count'] // 3
            pa = js['accessors'][p['attributes']['POSITION']]
            bmin = [min(a, b) for a, b in zip(bmin, pa['min'])]
            bmax = [max(a, b) for a, b in zip(bmax, pa['max'])]
    return {
        'bytes': len(data), 'tris': tris,
        'nodes': [n.get('name') for n in js.get('nodes', [])],
        'node_trs': [{k: n[k] for k in ('translation', 'rotation', 'scale') if k in n} for n in js.get('nodes', [])],
        'materials': [m.get('name') for m in js.get('materials', [])],
        'images': [i.get('mimeType') for i in js.get('images', [])],
        'cameras': len(js.get('cameras', [])), 'lights': 'KHR_lights_punctual' in json.dumps(js.get('extensions', {})),
        'extensionsUsed': js.get('extensionsUsed', []),
        'attributes': sorted({a for m in js['meshes'] for p in m['primitives'] for a in p['attributes']}),
        'bounds_gltf': [[round(v, 4) for v in bmin], [round(v, 4) for v in bmax]],
    }


res = {}
for name, (L, tgt) in TARGETS.items():
    path = os.path.join(GLB_DIR, name + '.glb')
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    bpy.ops.import_scene.gltf(filepath=path)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for o in obs:
        me = o.evaluated_get(dg).to_mesh()
        off = len(verts)
        verts += [o.matrix_world @ v.co for v in me.vertices]
        polys += [[off + i for i in p.vertices] for p in me.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    worst, wz, miss = 0.0, None, 0
    n = int(round(L * 100))
    for i in range(n + 1):
        z = L * i / n
        hit = bvh.ray_cast(Vector((0.0, -z, 5.0)), Vector((0, 0, -1)))   # glTF (0, ., z) -> Blender (0, -z, .)
        if hit[0] is None:
            miss += 1; continue
        d = hit[0].z - tgt(z)
        if abs(d) > abs(worst):
            worst, wz = d, z
    r = raw(path)
    r.update({'samples': n + 1, 'misses': miss, 'worst_dev_m': round(worst, 6), 'worst_at_z': wz,
              'import_objects': [o.name for o in bpy.context.scene.objects]})
    res[name] = r
    print('CHECK', name, json.dumps(r))
json.dump(res, open(OUT, 'w'), indent=1)
