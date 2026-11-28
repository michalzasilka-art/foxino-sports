# Stage 2: seated rest pose, props (Paddle, Mallet_L, Mallet_R), 4 clips (IK solved per frame, baked to bones), GLB export.
# usage: blender -b <NAME>_prep.blend -P anim.py -- <NAME> <outdir> <glb_out>
import bpy, bmesh, sys, math, json, os
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
NAME, OUT, GLB = argv[0], argv[1], argv[2]
FPS = 30
CFG = {
    'Crew_Hare': dict(team=(0.87, 0.16, 0.45), team2=(0.20, 0.52, 0.22), auto_seat=False, thigh=80, splay=6,
                      gamma=4, hips=0.41, squash=False, sep=0.32, curl=55, reach=(1.0, 0.0, 0)),
    'Crew_Owl': dict(team=(0.30, 0.62, 0.88), team2=(0.48, 0.25, 0.62), auto_seat=False, thigh=28, splay=4,
                     gamma=0, hips=0.455, squash=True, sep=0.30, curl=35, reach=(0.9, 0.08, 6)),
}[NAME]
log = {'name': NAME}

sc = bpy.context.scene
sc.render.fps = FPS
arm = bpy.data.objects[NAME + '_Rig']
LODS = [bpy.data.objects[NAME], bpy.data.objects[NAME + '_LOD1']]
for o in list(bpy.data.objects):
    if o.name.endswith('_hi'):
        bpy.data.objects.remove(o, do_unlink=True)
P = arm.pose.bones
def B(n): return P['mixamorig:' + n]
def upd(): bpy.context.view_layer.update()
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
def G(x, y, z):  # glTF (x, y up, z fwd) -> Blender
    return Vector((x, -z, y))

def reset():
    for pb in P:
        pb.rotation_mode = 'QUATERNION'; pb.matrix_basis = Matrix()
    upd()

def rotw(pb, axis, ang, pivot=None):
    if abs(ang) < 1e-9: return
    M = pb.matrix.copy(); h = pivot if pivot is not None else M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(ang, 4, axis) @ Matrix.Translation(-h) @ M
    upd()

def movew(pb, d):
    pb.matrix = Matrix.Translation(d) @ pb.matrix; upd()

def set_dir(pb, newY):
    M = pb.matrix.copy(); y = M.col[1].xyz.normalized()
    q = y.rotation_difference(newY.normalized())
    h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
    upd()

def evald(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    e = ob.evaluated_get(dg); m = e.to_mesh()
    co = [v.co.copy() for v in m.vertices]; e.to_mesh_clear(); return co

def wsum(ob, names):
    idx = {ob.vertex_groups[n].index for n in names if n in ob.vertex_groups}
    return [sum(g.weight for g in v.groups if g.group in idx) for v in ob.data.vertices]

# ---------------- seated rest pose ----------------
reset()
lod0 = LODS[0]
legw = wsum(lod0, ['mixamorig:%s%s' % (s, b) for s in ('Left', 'Right') for b in ('Leg', 'Foot', 'ToeBase')])
seatw = wsum(lod0, ['mixamorig:Hips', 'mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg', 'mixamorig:Spine'])
L1 = B('LeftUpLeg').bone.length; L2 = B('LeftLeg').bone.length
ankle0 = B('LeftFoot').bone.head_local.z

def seat(H, beta=None):
    reset()
    hp = B('Hips'); h = hp.matrix.translation
    movew(hp, Vector((-h.x, -h.y, H - h.z)))
    up = B('LeftUpLeg').matrix.translation.z
    if CFG['thigh'] is None:
        g = math.radians(CFG['gamma'])
        s = (up - ankle0 - L2 * math.cos(g)) / L1
        beta = math.degrees(math.asin(max(-1, min(1, s))))
        a1 = -(90 - beta)
        a2 = (90 - beta) - CFG['gamma']
    else:
        a1 = -CFG['thigh']; a2 = CFG['thigh'] - CFG['gamma']
    for sd, sg in (('Left', 1), ('Right', -1)):
        rotw(B(sd + 'UpLeg'), X, math.radians(a1))
        rotw(B(sd + 'UpLeg'), Z, math.radians(-sg * CFG['splay']))   # knees slightly apart
        rotw(B(sd + 'Leg'), X, math.radians(a2))
        rotw(B(sd + 'Leg'), Z, math.radians(sg * CFG['splay']))
        rotw(B(sd + 'Foot'), X, math.radians(-(a1 + a2)))
    return beta

H = CFG['hips'] or B('Hips').bone.head_local.z * 0.8
for it in range(4):
    beta = seat(H)
    co = evald(lod0)
    zs = [c.z for c, lw, sw in zip(co, legw, seatw) if lw < 0.2 and sw > 0.5 and c.y > -0.05 and abs(c.x) < 0.2 and c.z < H + 0.1]
    butt = min(zs)
    if not CFG['auto_seat']: break
    H += 0.365 - butt
log['seat'] = {'hips': round(H, 4), 'beta': beta, 'butt_min': round(butt, 4)}

# apply as rest
for ob in LODS:
    bpy.context.view_layer.objects.active = ob
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier='Armature')
bpy.context.view_layer.objects.active = arm
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
for ob in LODS:
    md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm

if CFG['squash']:
    # soft bottom: the round body rests on the bench top (y 0.36) instead of sinking through it
    for ob in LODS:
        lw = wsum(ob, ['mixamorig:%s%s' % (s, b) for s in ('Left', 'Right') for b in ('Leg', 'Foot', 'ToeBase')])
        zmin = min(v.co.z for v, w in zip(ob.data.vertices, lw) if w < 0.3)
        top = 0.43; floor_ = 0.366
        for v, w in zip(ob.data.vertices, lw):
            if w < 0.3 and v.co.z < top:
                t = (v.co.z - zmin) / (top - zmin)
                nz = floor_ + t * (top - floor_)
                v.co.z = v.co.z + (nz - v.co.z) * (1 - w / 0.3)
        ob.data.update()
reset()

# ---------------- measurements ----------------
_hw = wsum(lod0, ['mixamorig:Head'])
_hb = arm.data.bones['mixamorig:Head']
_cut = _hb.tail_local.z + 0.02
_pts = [v.co.copy() for v, w in zip(lod0.data.vertices, _hw) if w > 0.5 and v.co.z < _cut]
HEAD_C = sum(_pts, Vector()) / len(_pts)
_dd = sorted((p_ - HEAD_C).length for p_ in _pts)
HEAD_R = _dd[int(len(_dd) * 0.85)]
HEAD_C_LOCAL = _hb.matrix_local.inverted() @ HEAD_C
log['head'] = [round(x, 3) for x in HEAD_C] + [round(HEAD_R, 3)]
def head(n): return B(n).matrix.translation.copy()
def palm_off(sd):
    h = B(sd + 'Hand').bone
    m = P['mixamorig:%sHandMiddle1' % sd].bone.head_local
    return (m - h.head_local).length * 1.15
OFF = {sd: palm_off(sd) for sd in ('Left', 'Right')}
LEN = {sd: (B(sd + 'Arm').bone.length, B(sd + 'ForeArm').bone.length) for sd in ('Left', 'Right')}
log['arm'] = {sd: [round(LEN[sd][0], 3), round(LEN[sd][1], 3), round(OFF[sd], 3)] for sd in LEN}

# finger curl sign: the one that brings the middle fingertip toward the thumb base
FING = ['Index', 'Middle', 'Ring', 'Pinky']
CURL_SIGN = {}
for sd in ('Left', 'Right'):
    d = {}
    for sgn in (1, -1):
        reset()
        for f in FING:
            for k in (1, 2, 3):
                pb = P['mixamorig:%sHand%s%d' % (sd, f, k)]; pb.rotation_quaternion = Quaternion(X, sgn * 0.6)
        upd()
        tip = P['mixamorig:%sHandMiddle3' % sd].matrix @ Vector((0, P['mixamorig:%sHandMiddle3' % sd].bone.length, 0))
        d[sgn] = (tip - head(sd + 'HandThumb2')).length
    CURL_SIGN[sd] = 1 if d[1] < d[-1] else -1
reset()

def curl(sd, deg):
    for f in FING:
        for k in (1, 2, 3):
            P['mixamorig:%sHand%s%d' % (sd, f, k)].rotation_quaternion = Quaternion(X, CURL_SIGN[sd] * math.radians(deg) * (0.8 if k == 1 else 1))
    for k in (1, 2, 3):
        P['mixamorig:%sHandThumb%d' % (sd, k)].rotation_quaternion = Quaternion(X, CURL_SIGN[sd] * math.radians(deg) * 0.4)
    upd()

# ---------------- body helpers ----------------
def trunk(lean=0, twist=0, bend=0, nod=0, look=0):
    for n in ('Spine', 'Spine1', 'Spine2'):
        rotw(B(n), X, math.radians(lean) / 3)
        rotw(B(n), Z, math.radians(twist) / 3)
        rotw(B(n), Y, math.radians(bend) / 3)
    rotw(B('Neck'), X, math.radians(-lean * 0.35))
    rotw(B('Head'), X, math.radians(-lean * 0.25 + nod))
    rotw(B('Head'), Z, math.radians(-twist * 0.6 + look))
    rotw(B('Head'), Y, math.radians(-bend * 0.5))

def solve_arm(sd, grip, hand_dir, pole):
    sh, a, f, h = B(sd + 'Shoulder'), B(sd + 'Arm'), B(sd + 'ForeArm'), B(sd + 'Hand')
    l1, l2 = LEN[sd]
    W = grip - hand_dir * OFF[sd]
    S = head(sd + 'Arm')
    d = (W - S).length
    if d > 0.9 * (l1 + l2):  # clavicle helps reach
        c = head(sd + 'Shoulder'); v1 = S - c; v2 = W - c
        ax = v1.cross(v2)
        if ax.length > 1e-6:
            ang = min(math.radians(22), v1.angle(v2)) * min(1.0, (d - 0.9 * (l1 + l2)) / (0.12 * (l1 + l2)) + 0.25)
            rotw(sh, ax.normalized(), ang)
        S = head(sd + 'Arm'); d = (W - S).length
    dc = max(abs(l1 - l2) + 1e-3, min(d, 0.998 * (l1 + l2)))
    u = (W - S).normalized()
    aa = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc)
    hh = math.sqrt(max(l1 * l1 - aa * aa, 0))
    v = pole - u * pole.dot(u); v.normalize()
    E = S + u * aa + v * hh
    W2 = S + u * dc
    set_dir(a, E - S)
    set_dir(f, W2 - head(sd + 'ForeArm'))
    set_dir(h, hand_dir)
    real = head(sd + 'Hand') + B(sd + 'Hand').matrix.col[1].xyz.normalized() * OFF[sd]
    return (real - grip).length

def hand_dir_for(grip, axis, sd):
    s = head(sd + 'Arm')
    v = grip - s; v = v - axis * v.dot(axis)
    fd = head(sd + 'ForeArm')
    w = (grip - fd).normalized()
    out = (v.normalized() * 0.6 + w * 0.4)
    out = out - axis * out.dot(axis)
    return out.normalized()

# ---------------- props ----------------
def palette():
    img = bpy.data.images.new('T_Props_' + NAME.split('_')[1], 64, 64)
    wood = (0.72, 0.50, 0.30); grip = (0.36, 0.22, 0.13)
    cols = [wood, CFG['team'], CFG['team2'], grip]
    px = []
    for yy in range(64):
        for xx in range(64):
            c = cols[(xx // 32) + 2 * (yy // 32)]
            px += [c[0], c[1], c[2], 1.0]
    img.pixels[:] = px
    img.filepath_raw = os.path.join(OUT, img.name + '.jpg'); img.file_format = 'JPEG'
    img.save(filepath=img.filepath_raw, quality=90); img.source = 'FILE'; img.reload()
    mat = bpy.data.materials.new('M_Props_' + NAME.split('_')[1]); mat.use_nodes = True
    nt = mat.node_tree; bs = nt.nodes['Principled BSDF']
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Closest'
    nt.links.new(tx.outputs['Color'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.6; bs.inputs['Metallic'].default_value = 0.0
    return mat
UVC = {'wood': (0.25, 0.25), 'team': (0.75, 0.25), 'team2': (0.25, 0.75), 'grip': (0.75, 0.75)}

class MB:
    def __init__(s): s.v = []; s.f = []; s.c = []
    def ring(s, center, ax, r, n, phase=0.0, ex=None, ey=None):
        ax = ax.normalized()
        ex = ex or (ax.orthogonal().normalized()); ey = ey or ax.cross(ex)
        i0 = len(s.v)
        for k in range(n):
            a = 2 * math.pi * (k + phase) / n
            s.v.append(center + ex * (r * math.cos(a)) + ey * (r * math.sin(a)))
        return list(range(i0, i0 + n))
    def bridge(s, r1, r2, col):
        n = len(r1)
        for k in range(n):
            s.f.append((r1[k], r1[(k + 1) % n], r2[(k + 1) % n], r2[k])); s.c.append(col)
    def cap(s, r, col, flip=False):
        s.f.append(tuple(reversed(r)) if flip else tuple(r)); s.c.append(col)
    def point(s, p):
        s.v.append(p); return len(s.v) - 1
    def fan(s, r, pi, col, flip=False):
        n = len(r)
        for k in range(n):
            t = (r[k], r[(k + 1) % n], pi)
            s.f.append(tuple(reversed(t)) if flip else t); s.c.append(col)
    def build(s, name, mat):
        me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in s.v], [], s.f)
        me.update()
        uv = me.uv_layers.new(name='UVMap')
        corner = [(-0.09, -0.09), (0.09, -0.09), (0.09, 0.09), (-0.09, 0.09)]
        for poly, col in zip(me.polygons, s.c):
            for k, li in enumerate(poly.loop_indices):
                # each face gets a small non-degenerate patch inside its flat colour block
                a_ = 2 * math.pi * k / poly.loop_total
                c = (0.09 * math.cos(a_), 0.09 * math.sin(a_))
                uv.data[li].uv = (UVC[col][0] + c[0], UVC[col][1] + c[1])
        ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
        me.materials.append(mat)
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        me.calc_loop_triangles()
        return ob

PLEN = 1.30; BLADE = 0.42; GRIP_AT = 1.265
CHEST_R = 0.13
def make_paddle(mat):
    m = MB(); Yd = Vector((0, 1, 0))
    # blade: rounded outline in the local XY plane, thickness along Z
    outline = []
    for k in range(7):
        a = math.pi * k / 6
        outline.append(Vector((0.085 * math.cos(a + math.pi), 0.0 + 0.05 * (1 - math.sin(a)) * 0 + 0.045 - 0.045 * math.sin(a), 0)))
    outline = [Vector((-0.085, 0.05, 0)), Vector((-0.07, 0.012, 0)), Vector((-0.035, 0.0, 0)), Vector((0.035, 0.0, 0)),
               Vector((0.07, 0.012, 0)), Vector((0.085, 0.05, 0)), Vector((0.08, 0.30, 0)), Vector((0.05, 0.38, 0)),
               Vector((0.02, BLADE, 0)), Vector((-0.02, BLADE, 0)), Vector((-0.05, 0.38, 0)), Vector((-0.08, 0.30, 0))]
    t = 0.007
    top = [m.point(p + Vector((0, 0, t))) for p in outline]
    bot = [m.point(p - Vector((0, 0, t))) for p in outline]
    ct = m.point(Vector((0, 0.2, t * 1.6))); cb = m.point(Vector((0, 0.2, -t * 1.6)))
    m.fan(top, ct, 'team'); m.fan(bot, cb, 'team', flip=True)
    m.bridge(bot, top, 'team')
    # throat: from blade top into the shaft (team2 band)
    r0 = m.ring(Vector((0, BLADE - 0.03, 0)), Yd, 0.022, 12, ex=Vector((1, 0, 0)), ey=Vector((0, 0, -1)))
    r1 = m.ring(Vector((0, BLADE + 0.06, 0)), Yd, 0.016, 12, ex=Vector((1, 0, 0)), ey=Vector((0, 0, -1)))
    m.bridge(r0, r1, 'team2')
    r2 = m.ring(Vector((0, GRIP_AT + 0.004, 0)), Yd, 0.016, 12, ex=Vector((1, 0, 0)), ey=Vector((0, 0, -1)))
    m.bridge(r1, r2, 'wood')
    m.cap(r0, 'team2', flip=False)
    # T-grip crossbar along X
    Xd = Vector((1, 0, 0))
    g0 = m.ring(Vector((-0.06, GRIP_AT + 0.005, 0)), Xd, 0.019, 10, ex=Vector((0, 1, 0)), ey=Vector((0, 0, 1)))
    g1 = m.ring(Vector((0.06, GRIP_AT + 0.005, 0)), Xd, 0.019, 10, ex=Vector((0, 1, 0)), ey=Vector((0, 0, 1)))
    m.bridge(g0, g1, 'grip')
    m.fan(g0, m.point(Vector((-0.068, GRIP_AT + 0.005, 0))), 'grip', flip=True)
    m.fan(g1, m.point(Vector((0.068, GRIP_AT + 0.005, 0))), 'grip')
    ob = m.build('Paddle', mat)
    return ob

MLEN = 0.25; MBALL = 0.034
def make_mallet(name, mat):
    m = MB(); Yd = Vector((0, 1, 0))
    r0 = m.ring(Vector((0, -0.03, 0)), Yd, 0.011, 8)
    r1 = m.ring(Vector((0, MLEN - MBALL * 0.4, 0)), Yd, 0.011, 8)
    m.bridge(r0, r1, 'wood'); m.fan(r0, m.point(Vector((0, -0.036, 0))), 'wood', flip=True)
    c = Vector((0, MLEN, 0))
    b1 = m.ring(c + Vector((0, -MBALL * 0.5, 0)), Yd, MBALL * 0.87, 8)
    b2 = m.ring(c + Vector((0, MBALL * 0.5, 0)), Yd, MBALL * 0.87, 8)
    m.fan(b1, m.point(c - Vector((0, MBALL, 0))), 'team', flip=True)
    m.bridge(b1, b2, 'team')
    m.fan(b2, m.point(c + Vector((0, MBALL, 0))), 'team')
    return m.build(name, mat)

pmat = palette()
paddle = make_paddle(pmat)
mal = {'Left': make_mallet('Mallet_L', pmat), 'Right': make_mallet('Mallet_R', pmat)}
PROPS = {'Paddle': (paddle, 'Right'), 'Mallet_L': (mal['Left'], 'Left'), 'Mallet_R': (mal['Right'], 'Right')}
for nm, (ob, sd) in PROPS.items():
    ob.parent = arm; ob.parent_type = 'BONE'; ob.parent_bone = 'mixamorig:%sHand' % sd
    ob.matrix_parent_inverse = Matrix(); ob.rotation_mode = 'QUATERNION'
log['props_tris'] = {nm: len(ob.data.loop_triangles) for nm, (ob, sd) in PROPS.items()}

def frame_from(origin, yax, xhint):
    yax = yax.normalized(); xax = (xhint - yax * xhint.dot(yax)).normalized(); zax = xax.cross(yax)
    M = Matrix.Identity(4)
    for i in range(3):
        M[i][0], M[i][1], M[i][2], M[i][3] = xax[i], yax[i], zax[i], origin[i]
    return M

def prop_local(ob, sd, Mw, scale=1.0):
    pb = B(sd + 'Hand')
    Mb = pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    L = Mb.inverted() @ Mw
    loc, rot, _ = L.decompose()
    return (loc, rot, Vector((scale, scale, scale)))

# ---------------- keyframe capture ----------------
def capture():
    return {pb.name: (pb.location.copy(), pb.rotation_quaternion.copy()) for pb in P}

def interp(keys, t):
    """periodic cubic Hermite over (time, tuple) keys, period 1.0"""
    n = len(keys); ts = [k[0] for k in keys]
    def get(i):
        j = i % n; return ts[j] + (i // n), keys[j][1]
    i = max(k for k in range(n) if ts[k] <= t + 1e-9) if t >= ts[0] else -1
    t0, p0 = get(i); t1, p1 = get(i + 1); tm, pm = get(i - 1); t2, p2 = get(i + 2)
    u = (t - t0) / (t1 - t0)
    out = []
    for a, b, c, d in zip(pm, p0, p1, p2):
        m0 = (c - a) / (t1 - tm) * (t1 - t0); m1 = (d - b) / (t2 - t0) * (t1 - t0)
        h00 = 2 * u ** 3 - 3 * u ** 2 + 1; h10 = u ** 3 - 2 * u ** 2 + u; h01 = -2 * u ** 3 + 3 * u ** 2; h11 = u ** 3 - u ** 2
        out.append(h00 * b + h10 * m0 + h01 * c + h11 * m1)
    return out

# ---------------- paddle stroke ----------------
# keys: t, tip (glTF |x|, y, z), lean, twist, bend
STROKE = [
    (0.00, (0.76, 0.10, 0.76), 30, 24, 9),
    (0.25, (0.78, -0.26, 0.72), 32, 26, 11),  # catch
    (0.45, (0.79, -0.28, 0.36), 18, 14, 9),
    (0.60, (0.78, -0.16, 0.02), 2, 2, 5),     # beside the hips
    (0.70, (0.76, 0.12, -0.06), -2, -2, 3),   # exit
    (0.86, (0.75, 0.22, 0.44), 16, 14, 5),    # recovery
]

def best_dir(sigma, tip_b, top_sd, low_sd, d_ref=None, d_prev=None, wref=0.0):
    """choose paddle shaft direction (tip -> grip) and where each hand holds it: both hands in reach,
    the shaft clear of head and chest, the T-grip in front of the chest"""
    St, Sl = head(top_sd + 'Arm'), head(low_sd + 'Arm')
    hb = B('Head'); Hc = hb.matrix @ HEAD_C_LOCAL
    Hr = HEAD_R
    chest = [head('Spine1'), head('Spine2'), head('Neck')]
    def segd(p, a, b):
        ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (a + ab * t - p).length
    Rt = sum(LEN[top_sd]) * 0.96 + OFF[top_sd]; Rl = sum(LEN[low_sd]) * 0.96 + OFF[low_sd]
    nl = GRIP_AT - CFG['sep']
    best = None
    for ei in range(0, 36):
        el = math.radians(25 + ei * 1.8)
        for ai in range(0, 36):
            az = math.radians(-55 + ai * 3.2)
            dg = Vector((-sigma * math.cos(el) * math.cos(az), math.sin(el), -math.cos(el) * math.sin(az)))
            d = G(*dg).normalized()
            # hands slide a little along the shaft toward their shoulders
            st = max(GRIP_AT - 0.12, min(GRIP_AT, (St - tip_b).dot(d)))
            sl = max(nl - 0.10, min(nl + 0.06, (Sl - tip_b).dot(d), st - 0.24))
            gt = tip_b + d * st; gl = tip_b + d * sl
            et = max(0, (gt - St).length - Rt); el_ = max(0, (gl - Sl).length - Rl)
            low_out = max(0, 0.12 - sigma * gl.x)  # lower hand stays on the paddle side
            top_end = tip_b + d * (PLEN + 0.03)
            hd_ = max(0, Hr + 0.05 - segd(Hc, tip_b + d * 0.45, top_end))
            ch_ = max(0, CHEST_R - min(segd(cp, tip_b + d * 0.45, top_end) for cp in chest))
            fw = max(0, (top_end.y) - (min(chest[1].y, Hc.y) - 0.12)) + max(0, (tip_b + d * 0.95).y - (chest[1].y - 0.06))   # the T-grip stays in front of the chest (-Y is forward)
            c = 60 * (et * et + el_ * el_) + 4 * low_out * low_out + 400 * hd_ * hd_ + 300 * ch_ * ch_ + 150 * fw * fw                 + 0.003 * (el - math.radians(60)) ** 2 + 0.001 * az ** 2 + 0.3 * (GRIP_AT - st) ** 2 + 0.3 * (sl - nl) ** 2
            if d_ref is not None: c += wref * (d - d_ref).length_squared
            if d_prev is not None: c += wref * (d - d_prev).length_squared
            if best is None or c < best[0]:
                best = (c, d, et, el_, st, sl, hd_, ch_, fw)
    return best

def smooth_loop(vals, k=2):
    n = len(vals)
    return [sum(vals[(i + j) % n] for j in range(-k, k + 1)) / (2 * k + 1) for i in range(n)]

def paddle_clip(sigma):
    top_sd = 'Left' if sigma < 0 else 'Right'   # inboard hand on the T-grip
    low_sd = 'Right' if sigma < 0 else 'Left'   # outboard hand low on the shaft
    keys = []
    zs, dy, dl = CFG['reach']
    for t, tip, lean, tw, bend in STROKE:
        # short-armed crews: catch a little closer and shallower (still 0.6+ m ahead, blade below the water)
        tip = (tip[0], tip[1] + dy if tip[1] < 0 else tip[1], tip[2] * zs if tip[2] > 0.3 else tip[2])
        lean = lean + dl * max(0, lean) / 30
        reset(); trunk(lean, -sigma * tw, sigma * bend)
        tipb = G(sigma * tip[0], tip[1], tip[2])
        r = best_dir(sigma, tipb, top_sd, low_sd)
        d = r[1]
        keys.append((t, (tipb.x, tipb.y, tipb.z, d.x, d.y, d.z, lean, tw, bend)))
    N = 30
    sol = []
    dprev = None
    for fr in range(N):
        t = fr / N
        v = interp(keys, t)
        tipb = Vector(v[0:3]); dref = Vector(v[3:6]).normalized(); lean, tw, bend = v[6:9]
        reset(); trunk(lean, -sigma * tw, sigma * bend)
        r = best_dir(sigma, tipb, top_sd, low_sd, dref, dprev, wref=0.6)
        dprev = r[1]
        sol.append([tipb, r[1], r[4], r[5], (lean, tw, bend), r[6:9]])
    # smooth directions and hand slides around the loop
    ds = [s_[1] for s_ in sol]
    for c in range(3):
        comp = smooth_loop([d_[c] for d_ in ds])
        for i in range(N): sol[i][1] = sol[i][1].copy() if c == 0 else sol[i][1]; sol[i][1][c] = comp[i]
    for k in (2, 3):
        comp = smooth_loop([s_[k] for s_ in sol])
        for i in range(N): sol[i][k] = comp[i]
    frames = []
    errs = []
    for fr in range(0, N + 1):
        tipb, d, st, sl, (lean, tw, bend), pen = sol[fr % N]
        d = d.normalized(); t = fr / N
        reset(); trunk(lean, -sigma * tw, sigma * bend, nod=2 * math.sin(2 * math.pi * t))
        Mw = frame_from(tipb, d, Vector((0, -1, 0)).cross(d) * -1)
        gt = tipb + d * st; gl = tipb + d * sl
        pole_low = Vector((sigma * 0.7, 0.25, -0.6)); pole_top = Vector((-sigma * 0.6, 0.1, -0.75))
        e1 = solve_arm(low_sd, gl, hand_dir_for(gl, d, low_sd), pole_low)
        e2 = solve_arm(top_sd, gt, hand_dir_for(gt, d, top_sd), pole_top)
        curl('Left', CFG['curl']); curl('Right', CFG['curl'])
        errs.append((fr, round(e1, 3), round(e2, 3), tuple(round(x, 3) for x in pen)))
        props = {'Paddle': prop_local(paddle, 'Right', Mw),
                 'Mallet_L': prop_local(mal['Left'], 'Left', B('LeftHand').matrix, 0.0),
                 'Mallet_R': prop_local(mal['Right'], 'Right', B('RightHand').matrix, 0.0)}
        tipw = Mw @ Vector((0, 0, 0)); bladec = Mw @ Vector((0, BLADE * 0.5, 0))
        frames.append((fr, capture(), props, {'tip': tuple(round(x, 3) for x in tipw), 'blade_c': tuple(round(x, 3) for x in bladec)}))
    return frames, errs

# ---------------- cheer ----------------
def cheer_clip():
    frames = []
    for fr in range(0, 46):
        t = fr / 45.0
        up = math.sin(math.pi * min(1, max(0, (t - 0.0) / 0.22)) / 2) if t < 0.5 else math.sin(math.pi * min(1, max(0, (1.0 - t) / 0.22)) / 2)
        bounce = math.sin(2 * math.pi * 3 * t) * up
        reset()
        rotw(B('Hips'), Z, 0)
        trunk(lean=-6 * up + 3 * bounce, twist=8 * math.sin(2 * math.pi * 1.5 * t) * up, bend=6 * math.sin(2 * math.pi * 1.5 * t) * up,
              nod=-10 * up + 6 * bounce, look=0)
        movew(B('Hips'), Vector((0, 0, 0.015 * max(0, bounce))))
        for sd, sg in (('Left', 1), ('Right', -1)):
            sh = head(sd + 'Arm')
            rest_t = sh + Vector((sg * 0.06, -0.16, -0.16))
            up_t = sh + Vector((sg * (0.12 + 0.03 * bounce), -0.06, 0.24 + 0.02 * bounce))
            tgt = rest_t.lerp(up_t, up)
            hd = Vector((sg * 0.25, -0.3, 1.0 * up - 0.4 * (1 - up))).normalized()
            solve_arm(sd, tgt, hd, Vector((sg * 1.0, 0.3, -0.4)))
        curl('Left', 20 + 20 * up); curl('Right', CFG['curl'])
        rh = B('RightHand'); gr = head('RightHand') + rh.matrix.col[1].xyz.normalized() * OFF['Right']
        # paddle held mid-shaft, blade up (raised high when cheering), upright and tilted outwards
        # paddle held near the T-grip with the blade up, lifted high like a trophy when cheering
        d = Vector((-0.7 + 0.45 * up, 0.05, 1.0)).normalized()
        Mw = frame_from(gr + d * 0.97, -d, Vector((0, -1, 0)).cross(-d) * -1)
        props = {'Paddle': prop_local(paddle, 'Right', Mw),
                 'Mallet_L': prop_local(mal['Left'], 'Left', B('LeftHand').matrix, 0.0),
                 'Mallet_R': prop_local(mal['Right'], 'Right', B('RightHand').matrix, 0.0)}
        frames.append((fr, capture(), props, {}))
    return frames

# ---------------- drum ----------------
DRUM = G(0, 0.55, 0.45)
def drum_clip():
    frames = []
    errs = []
    for fr in range(0, 16):
        t = fr / 30.0
        reset()
        ph = 2 * math.pi * t / 0.25
        trunk(lean=14 + 3 * math.cos(ph), twist=0, bend=0, nod=4 * math.cos(ph))
        props = {'Paddle': (Vector((0, 0, 0)), Quaternion(), Vector((0, 0, 0)))}
        for sd, sg, th in (('Left', 1, 0.0), ('Right', -1, 0.25)):
            # height of the mallet head over the drum: 0 at its hit time, up to 0.16 half a beat later
            u = ((t - th) / 0.5) % 1.0
            lift = 0.5 - 0.5 * math.cos(2 * math.pi * u)
            hitp = DRUM + Vector((sg * 0.075, 0, MBALL))
            headp = hitp + Vector((0, 0.03 * lift, 0.17 * lift))
            pitch = math.radians(-10 + 42 * lift)   # mallet angle from horizontal (down at the hit)
            d = Vector((sg * 0.12, -math.cos(pitch), math.sin(pitch))).normalized()
            grip = headp - d * MLEN
            hd = (d * 0.6 + Vector((0, 0, -0.4))).normalized()
            e = solve_arm(sd, grip, hd, Vector((sg * 1.0, 0.2, -0.5)))
            errs.append((fr, sd, round(e, 3)))
            curl(sd, CFG['curl'])
            g2 = head(sd + 'Hand') + B(sd + 'Hand').matrix.col[1].xyz.normalized() * OFF[sd]
            Mw = frame_from(g2, headp - g2, Vector((1, 0, 0)))
            props['Mallet_' + sd[0]] = prop_local(mal[sd], sd, Mw)
        frames.append((fr, capture(), props, {}))
    return frames, errs

# ---------------- write actions + NLA ----------------
def write_clip(name, frames):
    acts = {}
    def act_for(ob, suffix):
        a = bpy.data.actions.new(name if suffix == '' else name + '__' + suffix)
        ob.animation_data_create(); ob.animation_data.action = a
        return a
    act_for(arm, '')
    prevq = {}
    for fr, pose, props, _ in frames:
        for pb in P:
            if any(k in pb.name for k in ('UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End')):
                continue   # legs stay in the seated rest pose in every clip
            loc, q = pose[pb.name]
            if pb.name in prevq and prevq[pb.name].dot(q) < 0: q = -q
            prevq[pb.name] = q
            pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=fr)
            if pb.name == 'mixamorig:Hips':
                pb.location = loc; pb.keyframe_insert('location', frame=fr)
    a = arm.animation_data.action; arm.animation_data.action = None
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, a)
    for nm, (ob, sd) in PROPS.items():
        act_for(ob, nm)
        pq = None
        for fr, pose, props, _ in frames:
            loc, q, s = props[nm]
            if pq is not None and pq.dot(q) < 0: q = -q
            pq = q
            ob.location = loc; ob.rotation_quaternion = q; ob.scale = s
            for path in ('location', 'rotation_quaternion', 'scale'):
                ob.keyframe_insert(path, frame=fr)
        a = ob.animation_data.action; ob.animation_data.action = None
        tr = ob.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, a)
    for a in bpy.data.actions:
        if a.name.startswith(name):
            for fc in a.fcurves if hasattr(a, 'fcurves') else []:
                for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

pL, errL = paddle_clip(+1)   # corrected contract: paddle_L blade at +X (the character's anatomical left)
pR, errR = paddle_clip(-1)   # paddle_R blade at -X (anatomical right)
ch = cheer_clip()
dr, errD = drum_clip()
log['ik_err_L'] = errL
log['ik_err_max'] = {'paddle_L': max(max(e[1], e[2]) for e in errL), 'paddle_R': max(max(e[1], e[2]) for e in errR),
                     'drum': max(e[2] for e in errD)}
log['blade'] = {'paddle_L': {f: m for f, _, _, m in pL if f in (0, 7, 8, 13, 18, 21, 26)},
                'paddle_R': {f: m for f, _, _, m in pR if f in (7, 8)}}
write_clip('paddle_L', pL); write_clip('paddle_R', pR); write_clip('cheer', ch); write_clip('drum', dr)
reset()
for pb in P: pb.location = (0, 0, 0)
for nm, (ob, sd) in PROPS.items():
    ob.location = (0, 0, 0); ob.rotation_quaternion = Quaternion(); ob.scale = (1, 1, 1)

# rest pose of the props: paddle as in paddle_L frame 0, mallets hidden
for nm, (ob, sd) in PROPS.items():
    loc, q, s = pL[0][2][nm]
    ob.location = loc; ob.rotation_quaternion = q; ob.scale = s
sc.frame_start = 0; sc.frame_end = 45
# NLA tracks muted so the scene (and the exported node defaults) shows the rest pose; the exporter still writes every track
for ob in [arm] + [o for o, _ in PROPS.values()]:
    for tr in ob.animation_data.nla_tracks: tr.mute = True
sc.frame_set(0)

# ---------------- export ----------------
events = {"paddle_L": {"catch": 0.25, "exit": 0.70}, "paddle_R": {"catch": 0.25, "exit": 0.70},
          "drum": {"hit_L": 0.0, "hit_R": 0.25}}
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, NAME + '_anim.blend'), compress=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in [arm] + LODS + [paddle, mal['Left'], mal['Right']]:
    ob.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                          export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=1,
                          export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False, export_optimize_animation_keep_anim_object=True, export_def_bones=False, export_skins=True,
                          export_image_format='AUTO', export_cameras=False, export_lights=False,
                          export_vertex_color='MATERIAL', export_all_vertex_colors=False, export_draco_mesh_compression_enable=False,
                          export_extras=False, export_tangents=False)
json.dump(events, open(GLB.replace('.glb', '.events.json'), 'w'), indent=1)
print('ANIM>>' + json.dumps(log, default=str))
