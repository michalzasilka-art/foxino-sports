# Independent check of an exported crew GLB: own glTF evaluator (numpy), no Blender importer involved.
# usage: python glbcheck.py <file.glb>
import json, struct, sys, math
import numpy as np

F = sys.argv[1]
d = open(F, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]
J = json.loads(d[20:20 + jl])
o = 20 + jl
bl = struct.unpack('<I', d[o:o + 4])[0]
BIN = d[o + 8:o + 8 + bl]
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def acc(i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0) or dt.itemsize * n
    raw = np.frombuffer(BIN, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * n), strides=(stride, 1)).copy()
    arr = out.view(dt).reshape(a['count'], n)
    if a.get('normalized'):
        arr = arr.astype(np.float64) / np.iinfo(dt).max
    return arr.astype(np.float64) if dt == np.float32 else arr

nodes = J['nodes']
names = [n.get('name', '') for n in nodes]
parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i

def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def trs(t, r, s):
    M = np.eye(4); M[:3, :3] = qmat(r) * np.array(s)[None, :]; M[:3, 3] = t; return M

base = [(np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float),
         np.array(n.get('scale', [1, 1, 1]), float)) for n in nodes]

anims = {}
for a in J['animations']:
    ch = []
    for c in a['channels']:
        s = a['samplers'][c['sampler']]
        ch.append((c['target']['node'], c['target']['path'], acc(s['input'])[:, 0], acc(s['output']), s.get('interpolation', 'LINEAR')))
    anims[a['name']] = ch

def sample(name, t):
    loc = [list(b) for b in base]
    if name:
        for ni, path, ti, vo, interp in anims[name]:
            if t <= ti[0]: v = vo[0]
            elif t >= ti[-1]: v = vo[-1]
            else:
                k = np.searchsorted(ti, t) - 1; u = (t - ti[k]) / (ti[k + 1] - ti[k])
                a, b = vo[k], vo[k + 1]
                if path == 'rotation':
                    if np.dot(a, b) < 0: b = -b
                    v = a * (1 - u) + b * u; v = v / np.linalg.norm(v)
                else:
                    v = a * (1 - u) + b * u
            idx = {'translation': 0, 'rotation': 1, 'scale': 2}[path]
            loc[ni][idx] = np.array(v, float)
    W = [None] * len(nodes)
    def world(i):
        if W[i] is None:
            L = trs(*loc[i]); W[i] = world(parent[i]) @ L if i in parent else L
        return W[i]
    for i in range(len(nodes)): world(i)
    return W

rep = {'file': F.split('\\')[-1].split('/')[-1], 'bytes': len(d)}
# meshes / tris
mesh_nodes = {names[i]: i for i, n in enumerate(nodes) if 'mesh' in n}
rep['tris'] = {}
MESH = {}
for nm, ni in mesh_nodes.items():
    m = J['meshes'][nodes[ni]['mesh']]
    tot = 0
    for p in m['primitives']:
        idx = acc(p['indices'])[:, 0]; tot += len(idx) // 3
        MESH[nm] = dict(pos=acc(p['attributes']['POSITION']), idx=idx.reshape(-1, 3),
                        uv=acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else None,
                        j=acc(p['attributes']['JOINTS_0']) if 'JOINTS_0' in p['attributes'] else None,
                        w=acc(p['attributes']['WEIGHTS_0']) if 'WEIGHTS_0' in p['attributes'] else None,
                        skin=nodes[ni].get('skin'), mat=J['materials'][p['material']]['name'] if 'material' in p else None)
    rep['tris'][nm] = tot
rep['materials'] = {nm: MESH[nm]['mat'] for nm in MESH}
skin = J['skins'][0]
joints = skin['joints']
IBM = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
rep['bones'] = len(joints)
rep['bones_bad_prefix'] = [names[j] for j in joints if not names[j].startswith('mixamorig:')]
rep['bone_names'] = [names[j] for j in joints]
rep['skins'] = len(J['skins'])
rep['anims'] = {a: round(float(max(c[2][-1] for c in ch)), 4) for a, ch in anims.items()}
for p in ('Paddle', 'Mallet_L', 'Mallet_R'):
    rep[p + '_parent'] = names[parent[mesh_nodes[p]]] if mesh_nodes.get(p) in parent else None
rep['extensions'] = J.get('extensionsUsed', [])
rep['images'] = [(im.get('name'), im.get('mimeType')) for im in J['images']]

def skinned(nm, W):
    m = MESH[nm]
    Jm = np.stack([W[j] @ IBM[k] for k, j in enumerate(joints)])
    P = np.c_[m['pos'], np.ones(len(m['pos']))]
    out = np.zeros((len(P), 3))
    for k in range(4):
        out += m['w'][:, k:k + 1] * np.einsum('nij,nj->ni', Jm[m['j'][:, k].astype(int)], P)[:, :3]
    return out

def rigid(nm, W):
    P = np.c_[MESH[nm]['pos'], np.ones(len(MESH[nm]['pos']))]
    return (W[mesh_nodes[nm]] @ P.T).T[:, :3]

LOD0 = [nm for nm in MESH if MESH[nm]['skin'] is not None and not nm.endswith('_LOD1')][0]
LOD1 = LOD0 + '_LOD1'
jn = {names[j]: j for j in joints}
W0 = sample(None, 0)
r0 = skinned(LOD0, W0)
rep['rest_bounds'] = {'min': np.round(r0.min(0), 3).tolist(), 'max': np.round(r0.max(0), 3).tolist()}
rep['rest_hips_y'] = round(float(W0[jn['mixamorig:Hips']][1, 3]), 3)
rep['rest_hips_xz'] = [round(float(W0[jn['mixamorig:Hips']][0, 3]), 3), round(float(W0[jn['mixamorig:Hips']][2, 3]), 3)]
feet = [jn['mixamorig:LeftFoot'], jn['mixamorig:RightFoot']]
fv = [i for i in range(len(r0)) if MESH[LOD0]['j'][i, 0] in [joints.index(f) for f in feet] or MESH[LOD0]['j'][i, 0] in [joints.index(jn['mixamorig:LeftToeBase']), joints.index(jn['mixamorig:RightToeBase'])]]
rep['rest_feet_min_y'] = round(float(r0[fv, 1].min()), 3)

def edges(idx):
    e = np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]]); e.sort(1); return np.unique(e, axis=0)
E = {nm: edges(MESH[nm]['idx']) for nm in (LOD0, LOD1)}
R = {nm: skinned(nm, W0) for nm in (LOD0, LOD1)}
RL = {nm: np.linalg.norm(R[nm][E[nm][:, 0]] - R[nm][E[nm][:, 1]], axis=1) for nm in (LOD0, LOD1)}

def team_center(nm, W, block):
    uv = MESH[nm]['uv']; pts = rigid(nm, W)
    if block == 'team': sel = (uv[:, 0] > 0.5) & (uv[:, 1] > 0.5)   # glTF v is flipped
    return pts[sel], pts

def segdist(p, a, b):
    ab = b - a; t = np.clip(np.dot(p - a, ab) / np.dot(ab, ab), 0, 1); return float(np.linalg.norm(a + ab * t - p))

clips = {}
for an, dur in rep['anims'].items():
    n = int(round(dur * 30))
    st = {'frames': n + 1, 'stretch_max': 0, 'stretch_min': 9, 'far_max': 0, 'body_min_y': 9}
    for f in range(n + 1):
        t = f / 30.0
        W = sample(an, t)
        for nm in (LOD0, LOD1):
            P = skinned(nm, W)
            L = np.linalg.norm(P[E[nm][:, 0]] - P[E[nm][:, 1]], axis=1)
            r = L / np.maximum(RL[nm], 1e-6)
            st['stretch_max'] = max(st['stretch_max'], float(r.max())); st['stretch_min'] = min(st['stretch_min'], float(r.min()))
            st['far_max'] = max(st['far_max'], float(np.linalg.norm(P, axis=1).max()))
            ex = L - 1.5 * RL[nm]          # metres an edge grows beyond 1.5x its rest length
            k = int(np.argmax(ex))
            if ex[k] > st.get('spike_' + nm[-4:], [-1])[0]:
                v = E[nm][k][0]; bone = names[joints[int(MESH[nm]['j'][v, int(np.argmax(MESH[nm]['w'][v]))])]]
                st['spike_' + nm[-4:]] = [round(float(ex[k]), 4), nm, f, bone, round(float(RL[nm][k]), 4), round(float(L[k]), 4)]
            st['body_min_y'] = min(st['body_min_y'], float(P[:, 1].min()))
        scl = {p: float(np.linalg.norm(W[mesh_nodes[p]][:3, 0])) for p in ('Paddle', 'Mallet_L', 'Mallet_R')}
        st.setdefault('prop_scale_minmax', {p: [9, 0] for p in scl})
        for p, v in scl.items():
            mm = st['prop_scale_minmax'][p]; mm[0] = min(mm[0], round(v, 3)); mm[1] = max(mm[1], round(v, 3))
        if an.startswith('paddle'):
            blade, allp = team_center('Paddle', W, 'team')
            low = allp[np.argmin(allp[:, 1])]
            top = allp[np.argmax(np.linalg.norm(allp - low, axis=1))]
            hd = {sd: segdist(W[jn['mixamorig:%sHand' % sd]][:3, 3], low, top) for sd in ('Left', 'Right')}
            st.setdefault('hand_to_shaft_max', {'Left': 0, 'Right': 0})
            for sd in hd: st['hand_to_shaft_max'][sd] = round(max(st['hand_to_shaft_max'][sd], hd[sd]), 3)
            st.setdefault('blade', {})[f] = {'lowest': np.round(low, 3).tolist(), 'blade_c': np.round(blade.mean(0), 3).tolist(),
                                            'blade_min_y': round(float(blade[:, 1].min()), 3), 'blade_max_y': round(float(blade[:, 1].max()), 3)}
        if an == 'drum':
            for p in ('Mallet_L', 'Mallet_R'):
                ball, _ = team_center(p, W, 'team')
                st.setdefault('mallet_ball', {}).setdefault(p, {})[f] = np.round(ball.mean(0), 3).tolist()
    for k in ('stretch_max', 'stretch_min', 'far_max', 'body_min_y'): st[k] = round(st[k], 3)
    if 'blade' in st:
        bl = st['blade']
        st['catch'] = {f: bl[f] for f in (7, 8)}
        st['exit'] = {f: bl[f] for f in (19, 20, 21, 22)}
        st['blade_x_range_in_water'] = [min(v['blade_c'][0] for v in bl.values() if v['blade_min_y'] < 0), max(v['blade_c'][0] for v in bl.values() if v['blade_min_y'] < 0)]
        st['in_water_frames'] = [f for f, v in bl.items() if v['blade_c'][1] < 0.05]
        del st['blade']
    clips[an] = st
rep['clips'] = clips
# loop check: frame 0 vs last
for an in ('paddle_L', 'paddle_R', 'drum'):
    W0_ = sample(an, 0); W1_ = sample(an, rep['anims'][an])
    rep.setdefault('loop_err', {})[an] = round(float(max(np.abs(W0_[j] - W1_[j]).max() for j in range(len(nodes)))), 5)
print(json.dumps(rep, indent=1))
