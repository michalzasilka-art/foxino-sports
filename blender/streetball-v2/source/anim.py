# Rig-independent animation: clips are written as body-relative controls (hips, spine, head, IK hand / foot targets,
# tail, antenna), solved per frame for a given Mixamo-named rig and baked into one action per clip (NLA tracks for the
# glTF exporter). Body frame (Blender armature space): forward F = -Y, up U = +Z, his left = +X.
import bpy, math
from mathutils import Vector, Matrix, Quaternion

FPS = 30
D2R = math.pi / 180
F, U = Vector((0, -1, 0)), Vector((0, 0, 1))

def E(p=0.0, y=0.0, r=0.0, k=1.0):
    """pitch forward (about +X), yaw to his left (about +Z), roll to his left (about +Y), degrees, scaled by k."""
    return (Matrix.Rotation(y * k * D2R, 3, 'Z') @ Matrix.Rotation(p * k * D2R, 3, 'X') @ Matrix.Rotation(r * k * D2R, 3, 'Y'))

def basis(d, ref):
    x = d.normalized(); z = ref - x * ref.dot(x)
    if z.length < 1e-6: z = x.orthogonal()
    z.normalize(); y = z.cross(x)
    return Matrix((x, y, z)).transposed()

def ik2(A, T, l1, l2, pole):
    d = T - A; L = d.length
    L = max(abs(l1 - l2) + 1e-4, min(l1 + l2 - 1e-4, L)) if L > 1e-6 else l1 + l2 - 1e-4
    x = d.normalized() if d.length > 1e-6 else Vector((0, 0, -1))
    ca = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L); ca = max(-1, min(1, ca)); sa = math.sqrt(1 - ca * ca)
    p = pole - x * pole.dot(x)
    if p.length < 1e-6: p = x.orthogonal()
    p.normalize()
    E_ = A + x * (l1 * ca) + p * (l1 * sa)
    return E_, A + x * L, p

class Rig:
    def __init__(s, arm, tail=(), antenna=None):
        s.arm = arm; s.B = arm.data.bones; s.P = arm.pose.bones
        s.N = lambda n: n if n in s.B else 'mixamorig:' + n
        s.M = {b.name: b.matrix_local.to_3x3() for b in s.B}
        s.H = {b.name: b.head_local.copy() for b in s.B}
        s.par = {b.name: (b.parent.name if b.parent else None) for b in s.B}
        s.order = [b.name for b in s.B]          # parents come before children
        s.tail = list(tail); s.antenna = antenna
        h = lambda n: s.H[s.N(n)]
        s.reach = (h('LeftForeArm') - h('LeftArm')).length + (h('LeftHand') - h('LeftForeArm')).length
        s.l_arm = ((h('LeftForeArm') - h('LeftArm')).length, (h('LeftHand') - h('LeftForeArm')).length)
        s.l_leg = ((h('LeftLeg') - h('LeftUpLeg')).length, (h('LeftFoot') - h('LeftLeg')).length)
        s.leg = (h('LeftUpLeg') - h('LeftFoot')).length
        s.rest_hand = {sd: h(f'{sd}Hand') for sd in ('Left', 'Right')}
        s.rest_ctrl = {}
        for sd, sg, k in (('Left', 1, 'l'), ('Right', -1, 'r')):
            v = (h(f'{sd}Hand') - h(f'{sd}Arm')) / s.reach
            s.rest_ctrl[k + 'h'] = (sg * v.x, v.z, -v.y)

    def solve(s, c):
        """c: control dict -> {bone: (quaternion, location or None)}."""
        N = s.N; D = {}; pos = {}
        u = s.leg
        hip = s.H[N('Hips')] + Vector((c.get('hx', 0) * u, -c.get('hz', 0) * u, c.get('hy', 0) * u))
        D[N('Hips')] = E(*c.get('hr', (0, 0, 0)))
        sp = c.get('sp', (0, 0, 0)); hd = c.get('hd', (0, 0, 0))
        D[N('Spine')] = D[N('Hips')] @ E(*sp, k=0.3)
        D[N('Spine1')] = D[N('Spine')] @ E(*sp, k=0.35)
        D[N('Spine2')] = D[N('Spine1')] @ E(*sp, k=0.35)
        D[N('Neck')] = D[N('Spine2')] @ E(*hd, k=0.4)
        D[N('Head')] = D[N('Neck')] @ E(*hd, k=0.6)
        for sd, sg, k in (('Left', 1, 'l'), ('Right', -1, 'r')):
            shr = c.get(k + 's', 0.0)
            D[N(f'{sd}Shoulder')] = D[N('Spine2')] @ Matrix.Rotation(-sg * shr * D2R, 3, 'Y')
        # positions down the chain for the IK roots
        def P(b):
            if b in pos: return pos[b]
            p = s.par[b]
            if p is None: pos[b] = hip.copy(); return pos[b]
            pos[b] = P(p) + D.get(p, Matrix.Identity(3)) @ (s.H[b] - s.H[p]); return pos[b]
        def Dof(b):
            while b not in D:
                b = s.par[b]
                if b is None: return Matrix.Identity(3)
            return D[b]
        for b in s.order:
            if b not in D and s.par[b] in D and not any(x in b for x in ('Arm', 'Hand', 'Leg', 'Foot', 'Toe')) and b not in s.tail and b != s.antenna:
                D[b] = D[s.par[b]]
        # arms
        for sd, sg, k in (('Left', 1, 'l'), ('Right', -1, 'r')):
            for b in (N(f'{sd}Arm'),): pass
            A = P(N(f'{sd}Arm'))
            tv = c.get(k + 'h')
            if tv is None:
                T = A + Dof(N('Spine2')) @ (s.rest_hand[sd] - s.H[N(f'{sd}Arm')])
            else:
                o, up, fw = tv
                T = A + Dof(N('Spine2')) @ (Vector((sg * o, -fw, up)) * s.reach)
            pe = c.get(k + 'e', (0.6, -0.5, -0.6))
            pole = Dof(N('Spine2')) @ Vector((sg * pe[0], -pe[2], pe[1]))
            El, Hd, pn = ik2(A, T, s.l_arm[0], s.l_arm[1], pole)
            for b, d0, d1 in ((N(f'{sd}Arm'), s.H[N(f'{sd}ForeArm')] - s.H[N(f'{sd}Arm')], El - A),
                              (N(f'{sd}ForeArm'), s.H[N(f'{sd}Hand')] - s.H[N(f'{sd}ForeArm')], Hd - El)):
                r0 = Vector((0, 1, 0))
                D[b] = basis(d1, pn) @ basis(d0, r0).transposed()
            D[N(f'{sd}Hand')] = D[N(f'{sd}ForeArm')] @ E(*c.get(k + 'w', (0, 0, 0)))
            pos[N(f'{sd}ForeArm')] = El; pos[N(f'{sd}Hand')] = Hd
        # legs
        for sd, sg, k in (('Left', 1, 'l'), ('Right', -1, 'r')):
            A = P(N(f'{sd}UpLeg'))
            o, up, fw = c.get(k + 'f', (0, 0, 0))
            fy = c.get('fy', 0.0) * D2R; Rf = Matrix.Rotation(fy, 3, 'Z')
            base = s.H[N(f'{sd}Foot')]
            T = Rf @ (base + Vector((sg * o * u, -fw * u, 0))) + Vector((0, 0, up * u))
            ko = c.get('kp', 0.15)
            pole = Rf @ Vector((sg * ko, -1, 0))
            Kn, An, pn = ik2(A, T, s.l_leg[0], s.l_leg[1], pole)
            for b, d0, d1 in ((N(f'{sd}UpLeg'), s.H[N(f'{sd}Leg')] - s.H[N(f'{sd}UpLeg')], Kn - A),
                              (N(f'{sd}Leg'), s.H[N(f'{sd}Foot')] - s.H[N(f'{sd}Leg')], An - Kn)):
                D[b] = basis(d1, pn) @ basis(d0, Vector((0, -1, 0))).transposed()
            fr = c.get(k + 'fr', (0, 0, 0))
            D[N(f'{sd}Foot')] = Rf @ E(fr[0], fr[1], fr[2])
            D[N(f'{sd}ToeBase')] = D[N(f'{sd}Foot')] @ E(-c.get(k + 'toe', 0))
        # tail / antenna (relative to their parent)
        for i, b in enumerate(s.tail):
            D[b] = Dof(s.par[b]) @ E(*c.get(f't{i + 1}', (0, 0, 0)))
        if s.antenna:
            D[s.antenna] = Dof(s.par[s.antenna]) @ E(*c.get('an', (0, 0, 0)))
        out = {}
        for b in s.order:
            if b not in D: continue
            p = s.par[b]; Dp = Dof(p) if p else Matrix.Identity(3)
            Lm = s.M[b].inverted() @ Dp.inverted() @ D[b] @ s.M[b]
            loc = None
            if p is None: loc = s.M[b].inverted() @ (hip - s.H[b])
            out[b] = (Lm.to_quaternion(), loc)
        out['_pos'] = (hip, pos); out['_D'] = D
        return out

# ------------------------------------------------------------------------------------------------- clip evaluation
def ease(t, kind):
    if kind == 'lin': return t
    if kind == 'in': return t * t
    if kind == 'out': return 1 - (1 - t) * (1 - t)
    if kind == 'snap': return 1 - (1 - t) ** 3
    return t * t * (3 - 2 * t)

def lerpv(a, b, t):
    if isinstance(a, (tuple, list)): return tuple(x + (y - x) * t for x, y in zip(a, b))
    return a + (b - a) * t

DEFAULTS = {'hx': 0.0, 'hy': 0.0, 'hz': 0.0, 'hr': (0, 0, 0), 'sp': (0, 0, 0), 'hd': (0, 0, 0), 'rs': 0.0, 'ls': 0.0,
            'rh': None, 'lh': None, 're': (0.6, -0.5, -0.6), 'le': (0.6, -0.5, -0.6), 'rw': (0, 0, 0), 'lw': (0, 0, 0),
            'rf': (0, 0, 0), 'lf': (0, 0, 0), 'rfr': (0, 0, 0), 'lfr': (0, 0, 0), 'rtoe': 0.0, 'ltoe': 0.0, 'kp': 0.15,
            't1': (0, 0, 0), 't2': (0, 0, 0), 'an': (0, 0, 0), 'fy': 0.0}
REST_HAND = (0.0, 0.0, 0.0)   # marker: None = rest hand

def full(k, rig):
    out = dict(DEFAULTS); out.update(k)
    for h in ('rh', 'lh'):
        if out[h] is None: out[h] = rig.rest_ctrl[h]
    return out

def controls_at(clip, t, rig):
    keys = clip['keys']
    if t <= keys[0][0]: return full(keys[0][1], rig)
    for (t0, k0), (t1, k1) in zip(keys, keys[1:]):
        if t <= t1:
            a = full(k0, rig); b = full(k1, rig)
            x = ease((t - t0) / (t1 - t0) if t1 > t0 else 1.0, k1.get('e', 'io'))
            return {n: lerpv(a[n], b[n], x) for n in a if n != 'e'}
    return full(keys[-1][1], rig)

def mirror(pose):
    m = {}
    for k, v in pose.items():
        k2 = k
        if k[0] in 'rl' and k not in ('e',):
            k2 = ('l' if k[0] == 'r' else 'r') + k[1:]
        if k in ('hr', 'sp', 'hd', 't1', 't2') : v = (v[0], -v[1], -v[2])
        if k in ('rfr', 'lfr', 'rw', 'lw'): v = (v[0], -v[1], -v[2])
        if k == 'hx': v = -v
        if k == 'an': v = (v[0], v[1], -v[2])
        m[k2] = v
    return m

# --------------------------------------------------------------------------------------------- secondary motion
def spring_track(signal, k=120.0, c=9.0, dt=1.0 / FPS, loops=1):
    """A damped spring following an input signal (list of floats); for loops the signal is run 3 times and the last
    pass is returned, so the result loops."""
    n = len(signal); x = 0.0; v = 0.0; out = []
    reps = 3 if loops else 1
    for r in range(reps):
        for i in range(n):
            target = signal[i]
            for _ in range(4):
                a = k * (target - x) - c * v; v += a * dt / 4; x += v * dt / 4
            if r == reps - 1: out.append(x)
    return out

def bake(rig, clip, act_name=None, secondary=None):
    arm = rig.arm; n = int(round(clip['len'] * FPS))
    frames = n + 1
    ctr = [controls_at(clip, f / FPS, rig) for f in range(frames)]
    if secondary: ctr = secondary(rig, clip, ctr)
    act = bpy.data.actions.get(act_name or clip['name'])
    if act: bpy.data.actions.remove(act)
    act = bpy.data.actions.new(act_name or clip['name']); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    keyed = set()
    for f, c in enumerate(ctr):
        res = rig.solve(c)
        for b, val in res.items():
            if b.startswith('_'): continue
            q, loc = val
            pb = arm.pose.bones[b]
            pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=f + 1)
            if loc is not None: pb.location = loc; pb.keyframe_insert('location', frame=f + 1)
            keyed.add(b)
    arm.animation_data.action = None
    return act, frames

def push_nla(arm, act, name):
    ad = arm.animation_data or arm.animation_data_create()
    tr = ad.nla_tracks.get(name) or ad.nla_tracks.new(); tr.name = name
    for s in list(tr.strips): tr.strips.remove(s)
    st = tr.strips.new(name, 1, act); st.name = name
    tr.mute = False
    return tr
