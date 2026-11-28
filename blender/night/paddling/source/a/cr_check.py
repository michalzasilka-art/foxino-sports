# cr_check.py - independent checks on an exported crew GLB (lane A). Pure numpy glTF evaluator + Blender re-import.
# blender -b --factory-startup -P cr_check.py -- <glb> [<glb> ...]
import bpy, sys, json, struct, math, os
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load(p):
    b = open(p, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
    o = 20 + jl; bl = struct.unpack('<I', b[o:o + 4])[0]; binc = b[o + 8:o + 8 + bl]
    return j, binc, len(b)

def acc(j, binc, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    dt = CT[a['componentType']]; n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0); cnt = a['count']
    isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (cnt - 1) + isz, offset=off)
        arr = np.stack([np.frombuffer(raw[k * stride:k * stride + isz].tobytes(), dtype=dt) for k in range(cnt)])
    else:
        arr = np.frombuffer(binc, dtype=dt, count=cnt * n, offset=off).reshape(cnt, n)
    arr = arr.astype(np.float64)
    if a.get('normalized'):
        arr = arr / {np.uint8: 255.0, np.uint16: 65535.0, np.int8: 127.0, np.int16: 32767.0}[dt]
    return arr

def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def trs(t, r, s):
    M = np.eye(4); M[:3, :3] = qmat(r) * np.array(s)[None, :]; M[:3, 3] = t; return M

class G:
    def __init__(s, p):
        s.j, s.b, s.size = load(p); j = s.j
        s.N = len(j['nodes']); s.parent = [-1] * s.N
        for i, n in enumerate(j['nodes']):
            for c in n.get('children', []): s.parent[c] = i
        s.base = [(np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float),
                   np.array(n.get('scale', [1, 1, 1]), float)) for n in j['nodes']]
        s.anims = {}
        for a in j.get('animations', []):
            ch = []
            for c in a['channels']:
                sm = a['samplers'][c['sampler']]
                ch.append((c['target']['node'], c['target']['path'], acc(j, s.b, sm['input'])[:, 0], acc(j, s.b, sm['output']), sm.get('interpolation', 'LINEAR')))
            s.anims[a['name']] = ch
        s.name = {n.get('name'): i for i, n in enumerate(j['nodes'])}
    def world(s, clip=None, t=0.0):
        loc = [list(x) for x in s.base]
        if clip:
            for node, path, ti, out, interp in s.anims[clip]:
                k = {'translation': 0, 'rotation': 1, 'scale': 2}[path]
                if t <= ti[0]: v = out[0]
                elif t >= ti[-1]: v = out[-1]
                else:
                    i = np.searchsorted(ti, t) - 1; f = (t - ti[i]) / (ti[i + 1] - ti[i])
                    if interp == 'STEP': v = out[i]
                    else:
                        a, b = out[i], out[i + 1]
                        if path == 'rotation' and np.dot(a, b) < 0: b = -b
                        v = a * (1 - f) + b * f
                        if path == 'rotation': v = v / np.linalg.norm(v)
                loc[node][k] = v
        W = [None] * s.N
        def get(i):
            if W[i] is None:
                M = trs(*loc[i]); W[i] = M if s.parent[i] < 0 else get(s.parent[i]) @ M
            return W[i]
        return [get(i) for i in range(s.N)]

def mesh_of(g, node):
    j = g.j; m = j['meshes'][j['nodes'][node]['mesh']]; pr = m['primitives'][0]
    pos = acc(j, g.b, pr['attributes']['POSITION']); idx = acc(j, g.b, pr['indices']).astype(int).reshape(-1, 3)
    jw = None
    if 'JOINTS_0' in pr['attributes']:
        jw = (acc(j, g.b, pr['attributes']['JOINTS_0']).astype(int), acc(j, g.b, pr['attributes']['WEIGHTS_0']))
    return pos, idx, jw

def skin_pos(g, node, W):
    j = g.j; sk = j['skins'][j['nodes'][node]['skin']]
    ibm = acc(j, g.b, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    joints = sk['joints']
    J = np.stack([W[jn] @ ibm[k] for k, jn in enumerate(joints)])
    pos, idx, (jt, wt) = mesh_of(g, node)
    ph = np.c_[pos, np.ones(len(pos))]
    out = np.zeros((len(pos), 4))
    for c in range(4):
        out += wt[:, c:c + 1] * np.einsum('nij,nj->ni', J[jt[:, c]], ph)
    return out[:, :3], idx

def edges(idx):
    e = np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]]); e.sort(1); return np.unique(e, axis=0)

res_all = {}
for p in argv:
    g = G(p); j = g.j; R = {'file': os.path.basename(p), 'bytes': g.size}
    nm = lambda i: j['nodes'][i].get('name')
    meshes = {nm(i): i for i, n in enumerate(j['nodes']) if 'mesh' in n}
    R['tris'] = {k: int(len(mesh_of(g, i)[1])) for k, i in meshes.items()}
    sk = j['skins'][0]; jn = [nm(i) for i in sk['joints']]
    R['bones'] = len(jn); R['bones_all_mixamorig'] = all(n.startswith('mixamorig:') for n in jn)
    R['tail_like_names'] = [n for n in [x.get('name', '') for x in j['nodes']] + [m.get('name', '') for m in j['meshes']] if 'tail' in n.lower()]
    R['clips'] = {}
    for a in j['animations']:
        mx = max(acc(j, g.b, sm['input'])[-1, 0] for sm in a['samplers'])
        tn = sorted(set(nm(c['target']['node']) for c in a['channels']))
        R['clips'][a['name']] = {'dur': round(float(mx), 4), 'channels': len(a['channels']),
                                 'non_bone_targets': [t for t in tn if not t.startswith('mixamorig:')]}
    for k in ('Paddle', 'Mallet_L', 'Mallet_R'):
        R[k + '_parent'] = nm(g.parent[meshes[k]])
    R['skinned_nodes_parent'] = {k: nm(g.parent[meshes[k]]) if g.parent[meshes[k]] >= 0 else None for k in meshes if 'Crew' in k}
    R['images'] = [(im.get('mimeType'), j['bufferViews'][im['bufferView']]['byteLength']) for im in j.get('images', [])]
    R['materials'] = [m['name'] for m in j['materials']]
    # rest bounds
    W0 = g.world()
    lod0 = [k for k in meshes if k.startswith('Crew_') and not k.endswith('_LOD1')][0]
    lod1 = lod0 + '_LOD1'
    p0, i0 = skin_pos(g, meshes[lod0], W0)
    R['rest_bounds'] = [list(np.round(p0.min(0), 3)), list(np.round(p0.max(0), 3))]
    R['rest_hips_y'] = round(float(W0[g.name['mixamorig:Hips']][1, 3]), 3)
    rest_len = {}
    for k in (lod0, lod1):
        pp, ii = skin_pos(g, meshes[k], W0); E = edges(ii); rest_len[k] = (E, np.linalg.norm(pp[E[:, 0]] - pp[E[:, 1]], axis=1))
    # paddle blade & mallet head local points
    ppos = mesh_of(g, meshes['Paddle'])[0]; blade_local = ppos[ppos[:, 2] > 0.8].mean(0)
    mpos = mesh_of(g, meshes['Mallet_L'])[0]; head_local = mpos[mpos[:, 2] < -0.18].mean(0)
    def pt(W, node, lp):
        return (W[node] @ np.r_[lp, 1])[:3]
    def scl(W, node):
        return float(abs(np.linalg.det(W[node][:3, :3])) ** (1 / 3))
    samples = {}
    worst = {'stretch': 0, 'nan': False}
    for clip, info in R['clips'].items():
        dur = info['dur']; out = []
        for t in np.linspace(0, dur, 7 if dur < 1.2 else 10):
            W = g.world(clip, t)
            row = {'t': round(float(t), 3)}
            for k in (lod0, lod1):
                pp, ii = skin_pos(g, meshes[k], W)
                if not np.all(np.isfinite(pp)): worst['nan'] = True
                E, L0 = rest_len[k]; L = np.linalg.norm(pp[E[:, 0]] - pp[E[:, 1]], axis=1)
                ratio = L / np.maximum(L0, 1e-5)
                st = float(np.max(ratio))
                if st > worst['stretch']:
                    worst['stretch'] = st
                    jt, wt = mesh_of(g, meshes[k])[2]
                    jnames = [nm(x) for x in j['skins'][0]['joints']]
                    pr, _ = skin_pos(g, meshes[k], W0)
                    top = np.argsort(-ratio)[:6]
                    worst['where'] = [(k, clip, round(float(t), 2), round(float(ratio[e]), 2), round(float(L0[e]), 4),
                                       [round(float(x), 3) for x in (pr[E[e, 0]] + pr[E[e, 1]]) / 2],
                                       [jnames[jt[E[e, q], int(np.argmax(wt[E[e, q]]))]].replace('mixamorig:', '') for q in (0, 1)]) for e in top]
                if k == lod0:
                    row['min_y'] = round(float(pp[:, 1].min()), 3); row['max_y'] = round(float(pp[:, 1].max()), 3)
                    row['stretch0'] = round(st, 2)
                else: row['stretch1'] = round(st, 2)
            row['paddle_scale'] = round(scl(W, meshes['Paddle']), 3)
            row['mallet_scale'] = [round(scl(W, meshes['Mallet_L']), 3), round(scl(W, meshes['Mallet_R']), 3)]
            if row['paddle_scale'] > 0.5: row['blade'] = [round(float(x), 3) for x in pt(W, meshes['Paddle'], blade_local)]
            if clip == 'drum':
                row['heads_y'] = [round(float(pt(W, meshes[m], head_local)[1]), 3) for m in ('Mallet_L', 'Mallet_R')]
                row['heads_z'] = [round(float(pt(W, meshes[m], head_local)[2]), 3) for m in ('Mallet_L', 'Mallet_R')]
            out.append(row)
        samples[clip] = out
    # exact event checks
    ev = {}
    for clip in ('paddle_L', 'paddle_R'):
        W = g.world(clip, 0.25); ev[clip + '@catch'] = [round(float(x), 3) for x in pt(W, meshes['Paddle'], blade_local)]
        ys = []
        for t in np.arange(0.0, 1.0001, 1 / 60):
            W = g.world(clip, t); ys.append((round(float(t), 3), [round(float(x), 3) for x in pt(W, meshes['Paddle'], blade_local)]))
        inw = [t for t, b in ys if b[1] < 0]
        ev[clip + '_blade_in_water'] = [min(inw), max(inw)] if inw else None
        ev[clip + '_blade_x_range'] = [min(b[0] for t, b in ys), max(b[0] for t, b in ys)]
        ev[clip + '_blade_z_range_in_water'] = [min(b[2] for t, b in ys if b[1] < 0), max(b[2] for t, b in ys if b[1] < 0)] if inw else None
    for tt, lab in ((0.0, 'hit_L'), (0.25, 'hit_R')):
        W = g.world('drum', tt)
        ev['drum_' + lab] = [[round(float(x), 3) for x in pt(W, meshes[m], head_local)] for m in ('Mallet_L', 'Mallet_R')]
    R['events'] = ev; R['samples'] = samples; R['worst'] = worst
    res_all[p] = R

# Blender re-import: play each clip, sample frames, check evaluated meshes
bpy.context.scene.render.fps = 30
for p in argv:
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=p)
    objs = [o for o in bpy.data.objects]
    rig = [o for o in objs if o.type == 'ARMATURE'][0]
    out = {}
    clips = [t.name for t in rig.animation_data.nla_tracks]
    for clip in clips:
        for o in objs:
            ad = o.animation_data
            if not ad: continue
            ad.action = None
            for tr in ad.nla_tracks: tr.mute = (tr.name != clip)
        tr = [t for t in rig.animation_data.nla_tracks if t.name == clip][0]
        f0, f1 = tr.strips[0].frame_start, tr.strips[0].frame_end
        mins, maxs, bad = [], [], 0
        for f in np.linspace(f0, f1, 6):
            bpy.context.scene.frame_set(int(round(f)))
            dg = bpy.context.evaluated_depsgraph_get()
            for o in objs:
                if o.type != 'MESH' or not o.name.startswith('Crew_'): continue
                oe = o.evaluated_get(dg); me = oe.to_mesh()
                co = np.array([tuple(oe.matrix_world @ v.co) for v in me.vertices])
                oe.to_mesh_clear()
                if not np.all(np.isfinite(co)): bad += 1
                mins.append(co.min(0)); maxs.append(co.max(0))
        mn = np.min(mins, 0); mx = np.max(maxs, 0)
        out[clip] = {'frames': [f0, f1], 'blender_bounds_min': list(np.round(mn, 3)), 'blender_bounds_max': list(np.round(mx, 3)), 'nan_frames': bad,
                     'rig_loc': list(np.round(rig.matrix_world.translation, 3))}
    res_all[p]['blender_reimport'] = out
print('CHECK' + json.dumps(res_all, default=float))
