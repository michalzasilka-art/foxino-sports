# cr_anim.py - Paddling crews (lane A): props + 4 clips (paddle_L, paddle_R, cheer, drum) + GLB export.
# Run: blender -b <crew_x_s1.blend> -P cr_anim.py -- <Tag> <out.glb> <team_hex> <torso_r>
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
TAG, OUTGLB, TEAM, TORSO_R = argv[0], argv[1], argv[2], float(argv[3])
NAME = 'Crew_' + TAG
FPS = 30
sc = bpy.context.scene
sc.render.fps = FPS; sc.render.fps_base = 1.0
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
lod0 = bpy.data.objects[NAME]; lod1 = bpy.data.objects[NAME + '_LOD1']
P = arm.pose.bones
def B(n): return P['mixamorig:' + n]
for pb in P: pb.rotation_mode = 'QUATERNION'
report = {}

def upd(): bpy.context.view_layer.update()
def gb(v):  # game (x, up, fwd) -> blender
    return Vector((v[0], -v[2], v[1]))
def bg(v):
    return Vector((v[0], v[2], -v[1]))
# drop tiny loose islands left by decimation (floating bits)
def drop_small_islands(o, min_verts=12):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen = set(); kill = []
    for v in bm.verts:
        if v.index in seen: continue
        comp = [v]; seen.add(v.index); st = [v]
        while st:
            x = st.pop()
            for e in x.link_edges:
                w = e.other_vert(x)
                if w.index not in seen: seen.add(w.index); comp.append(w); st.append(w)
        if len(comp) < min_verts: kill += comp
    if kill: bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(o.data); bm.free(); return len(kill)
report['dropped_island_verts'] = {o.name: drop_small_islands(o) for o in (lod0, lod1)}
# re-encode the character maps for size: base colour 1024 q80, normal 512 q85
for im in list(bpy.data.images):
    nm = im.name.lower()
    if 'basecolor' in nm or 'normal' in nm:
        src = bpy.path.abspath(im.filepath)
        dst = os.path.join(os.path.dirname(src), NAME + ('_basecolor_s.jpg' if 'basecolor' in nm else '_normal_s.jpg'))
        if 'normal' in nm: im.scale(512, 512)
        im.save(filepath=dst, quality=80 if 'basecolor' in nm else 85)
        im.filepath = dst; im.reload()
def hexcol(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]

# ---------------------------------------------------------------- props material (tiny palette JPEG)
outdir = os.path.dirname(OUTGLB)
tmpdir = os.path.join(os.path.dirname(bpy.data.filepath))
pal = np.zeros((32, 32, 4), dtype=np.float32); pal[..., 3] = 1
sw = {0: [0.62, 0.43, 0.25], 1: [0.42, 0.27, 0.15], 2: hexcol(TEAM), 3: [0.93, 0.88, 0.78]}
for k, c in sw.items():
    r, cc = divmod(k, 2)
    pal[r * 16:(r + 1) * 16, cc * 16:(cc + 1) * 16, :3] = c
img = bpy.data.images.new(NAME + '_props', 32, 32); img.pixels[:] = pal.ravel()
ppath = os.path.join(tmpdir, NAME + '_props.jpg')
img.filepath_raw = ppath; img.file_format = 'JPEG'; img.save()
bpy.data.images.remove(img)
pimg = bpy.data.images.load(ppath)
def swuv(k):
    r, cc = divmod(k, 2); return ((cc * 16 + 8) / 32, (r * 16 + 8) / 32)
pm = bpy.data.materials.new(NAME + '_Props'); pm.use_nodes = True
pnt = pm.node_tree; pb_ = pnt.nodes.get('Principled BSDF')
pt = pnt.nodes.new('ShaderNodeTexImage'); pt.image = pimg; pt.interpolation = 'Closest'
pnt.links.new(pt.outputs['Color'], pb_.inputs['Base Color'])
pb_.inputs['Roughness'].default_value = 0.6; pb_.inputs['Metallic'].default_value = 0.0

def mesh_obj(name, build):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    build(bm, uvl)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + '_mesh'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    me.materials.append(pm)
    for p in me.polygons: p.use_smooth = True
    return o

def ring(bm, center, axis_y, r, n, phase=0.0):
    vs = []
    for i in range(n):
        a = 2 * math.pi * i / n + phase
        vs.append(bm.verts.new((center[0] + r * math.cos(a), axis_y, center[1] + r * math.sin(a))))
    return vs

def setuv(faces, uvl, k):
    u = swuv(k)   # small non-degenerate UV fan inside the flat swatch (no zero-area UV faces)
    for f in faces:
        n = len(f.loops)
        for i, l in enumerate(f.loops):
            a = 2 * math.pi * i / n
            l[uvl].uv = (u[0] + 0.1 * math.cos(a), u[1] + 0.1 * math.sin(a))

def build_paddle(bm, uvl):
    # local: T-grip centre at origin, shaft along -Y, blade width along X, blade normal along Z
    n = 8; r = 0.016
    top = ring(bm, (0, 0), -0.012, r, n); bot = ring(bm, (0, 0), -0.90, r, n)
    sh = [bm.faces.new((top[i], top[(i + 1) % n], bot[(i + 1) % n], bot[i])) for i in range(n)]
    setuv(sh, uvl, 0)
    # T-grip bar along X
    m = 8; rb = 0.018; L = 0.055
    a = []; b = []
    for i in range(m):
        t = 2 * math.pi * i / m
        a.append(bm.verts.new((-L, rb * math.cos(t), rb * math.sin(t))))
        b.append(bm.verts.new((L, rb * math.cos(t), rb * math.sin(t))))
    tg = [bm.faces.new((a[i], a[(i + 1) % m], b[(i + 1) % m], b[i])) for i in range(m)]
    tg.append(bm.faces.new(list(reversed(a)))); tg.append(bm.faces.new(b))
    bmesh.ops.triangulate(bm, faces=tg[-2:])
    setuv([f for f in bm.faces if f not in sh], uvl, 1)
    # blade: rounded outline, slight thickness
    outline = []
    prof = [(-0.018, -0.80), (-0.05, -0.86), (-0.085, -0.93), (-0.095, -1.02), (-0.095, -1.14), (-0.088, -1.22), (-0.065, -1.275), (-0.03, -1.30)]
    pts = prof + [(-x, y) for x, y in reversed(prof)]
    th = 0.009
    F = [bm.verts.new((x, y, th)) for x, y in pts]; Bk = [bm.verts.new((x, y, -th)) for x, y in pts]
    k = len(pts)
    bl = [bm.faces.new((F[i], F[(i + 1) % k], Bk[(i + 1) % k], Bk[i])) for i in range(k)]
    ff = bm.faces.new(F); fb = bm.faces.new(list(reversed(Bk)))
    tri = bmesh.ops.triangulate(bm, faces=[ff, fb], quad_method='BEAUTY', ngon_method='BEAUTY')
    setuv(bl + tri['faces'], uvl, 2)

def build_mallet(bm, uvl):
    n = 6; r = 0.011
    lo = ring(bm, (0, 0), -0.05, r, n); hi = ring(bm, (0, 0), 0.19, r, n)
    sd = [bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i])) for i in range(n)]
    cap = bm.faces.new(list(reversed(lo)))
    caps = bmesh.ops.triangulate(bm, faces=[cap])['faces']
    setuv(sd + caps, uvl, 0)
    # head: low sphere r 0.036 at y 0.22
    c = 0.22; R = 0.036; rings = [math.radians(a) for a in (-55, 0, 55)]
    rs = []
    for la in rings:
        rs.append([bm.verts.new((R * math.cos(la) * math.cos(2 * math.pi * i / n), c + R * math.sin(la), R * math.cos(la) * math.sin(2 * math.pi * i / n))) for i in range(n)])
    pS = bm.verts.new((0, c - R, 0)); pN = bm.verts.new((0, c + R, 0))
    hf = []
    for j in range(2):
        for i in range(n):
            hf.append(bm.faces.new((rs[j][i], rs[j][(i + 1) % n], rs[j + 1][(i + 1) % n], rs[j + 1][i])))
    for i in range(n):
        hf.append(bm.faces.new((pS, rs[0][(i + 1) % n], rs[0][i])))
        hf.append(bm.faces.new((rs[2][i], rs[2][(i + 1) % n], pN)))
    setuv(hf, uvl, 3)

paddle = mesh_obj('Paddle', build_paddle)
malL = mesh_obj('Mallet_L', build_mallet)
malR = mesh_obj('Mallet_R', build_mallet)
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
report['props_tris'] = {o.name: tris(o) for o in (paddle, malL, malR)}
BLADE_C = 1.06   # blade centre distance from the T-grip along the shaft

hand_bone = {'L': 'mixamorig:LeftHand', 'R': 'mixamorig:RightHand'}
for o, s in ((paddle, 'R'), (malL, 'L'), (malR, 'R')):
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = hand_bone[s]
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.rotation_mode = 'QUATERNION'

def bone_parent_world(s):
    pbn = P[hand_bone[s]]
    return arm.matrix_world @ pbn.matrix @ Matrix.Translation((0, pbn.bone.length, 0))

def set_prop_world(o, s, Mw):
    """Mw: desired world matrix (blender). Writes basis relative to the bone tail."""
    o.matrix_basis = bone_parent_world(s).inverted() @ Mw

# ---------------------------------------------------------------- skeleton numbers
rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
def rhead(n): return rest['mixamorig:' + n].translation.copy()
def blen(a, b): return (rhead(b) - rhead(a)).length
GRIP = 0.035
ARM = {s: (blen(s + 'Arm', s + 'ForeArm'), blen(s + 'ForeArm', s + 'Hand') + GRIP) for s in ('Left', 'Right')}
report['arm_lengths'] = {k: [round(x, 3) for x in v] for k, v in ARM.items()}
hips_rest = rhead('Hips'); neck_rest = rhead('Neck'); head_rest = rhead('Head')

# ---------------------------------------------------------------- posing helpers
KEYB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
        'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']

def reset_pose():
    for pb in P:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)

def rot_world(pb, q):
    upd(); M = pb.matrix.copy(); h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M

def aim(pb, direction):
    upd(); M = pb.matrix.copy()
    cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    q = cur.rotation_difference(Vector(direction).normalized())
    h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M

def qaxis(axis_game, deg):
    return Quaternion(gb(axis_game).normalized(), math.radians(deg))

def pose_trunk(tp):
    """tp: dict lean (fwd, deg), twist (deg, + brings -X shoulder forward), side (deg, + tilts head toward +X),
    bob (m), head_pitch, head_twist, head_roll"""
    reset_pose(); upd()
    hp = B('Hips'); M = hp.matrix.copy(); M.translation += gb((0, tp.get('bob', 0), tp.get('shift_z', 0))); hp.matrix = M
    rot_world(hp, qaxis((0, 1, 0), tp.get('twist', 0) * 0.15) @ qaxis((1, 0, 0), tp.get('lean', 0) * 0.2))
    for n, f in (('Spine', 0.35), ('Spine1', 0.35), ('Spine2', 0.3)):
        q = qaxis((1, 0, 0), tp.get('lean', 0) * f * 0.8)            # + about game X leans forward (head toward +Z)
        q = qaxis((0, 1, 0), tp.get('twist', 0) * f * 0.85) @ q
        q = qaxis((0, 0, 1), -tp.get('side', 0) * f) @ q
        rot_world(B(n), q)
    qn = qaxis((1, 0, 0), tp.get('head_pitch', 0) * 0.4)
    rot_world(B('Neck'), qn)
    qh = qaxis((0, 1, 0), tp.get('head_twist', 0)) @ qaxis((0, 0, 1), -tp.get('head_roll', 0)) @ qaxis((1, 0, 0), tp.get('head_pitch', 0) * 0.6)
    rot_world(B('Head'), qh)
    upd()

def shoulder(s):
    upd(); return bg(B(s + 'Arm').matrix.translation)

def solve_arm(s, P_game, hint_game):
    """two-bone IK in game space. s = 'Left'/'Right'. returns actual grip point (game)."""
    upd()
    S = bg(B(s + 'Arm').matrix.translation)
    a, b = ARM[s]
    d = P_game - S; dist = d.length
    x = d.normalized()
    dist_c = min(max(dist, abs(a - b) + 1e-3), (a + b) * 0.999)
    h = Vector(hint_game).normalized()
    y = (h - h.dot(x) * x)
    if y.length < 1e-4: y = Vector((0, -1, 0)) - Vector((0, -1, 0)).dot(x) * x
    y.normalize()
    cosA = (a * a + dist_c * dist_c - b * b) / (2 * a * dist_c); cosA = max(-1, min(1, cosA))
    sinA = math.sqrt(1 - cosA * cosA)
    E = S + a * (cosA * x + sinA * y)
    Pc = S + dist_c * x
    aim(B(s + 'Arm'), gb(E - S))
    aim(B(s + 'ForeArm'), gb(Pc - E))
    upd()
    return grip(s)

def grip(s):
    upd()
    E = bg(B(s + 'ForeArm').matrix.translation); W = bg(B(s + 'Hand').matrix.translation)
    return W + GRIP * (W - E).normalized()

def capsule_pen(pts):
    """penetration of points into torso capsule / head sphere (game space, current pose)."""
    upd()
    h0 = bg(B('Hips').matrix.translation) + Vector((0, 0.04, 0)); h1 = bg(B('Neck').matrix.translation)
    hc = bg(B('Head').matrix.translation) + Vector((0, 0.17, 0.02))
    pen = np.zeros(len(pts))
    A = np.array(h0); Bv = np.array(h1); AB = Bv - A
    t = np.clip(((pts - A) @ AB) / (AB @ AB), 0, 1)
    cl = A + t[:, None] * AB
    pen += np.maximum(0, TORSO_R - np.linalg.norm(pts - cl, axis=1))
    pen += np.maximum(0, 0.19 - np.linalg.norm(pts - np.array(hc), axis=1))
    return pen

def optimize_hands(top, bot, C, sep, gpref):
    """find top grip G and bottom grip L = G + sep*u with u toward C so that |C-G| ~ BLADE_C, both reachable."""
    St = np.array(shoulder(top)); Sb = np.array(shoulder(bot))
    rt = sum(ARM[top]) * 0.97; rb = sum(ARM[bot]) * 0.97
    g = np.arange(-rt, rt + 1e-6, 0.012)
    X, Y, Z = np.meshgrid(g, g, g, indexing='ij')
    G = St + np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    G = G[np.linalg.norm(G - St, axis=1) <= rt]
    Cn = np.array(C)
    dv = Cn - G; dl = np.linalg.norm(dv, axis=1); u = dv / dl[:, None]
    L = G + sep * u
    cost = 60 * (dl - BLADE_C) ** 2
    cost += 300 * np.maximum(0, np.linalg.norm(L - Sb, axis=1) - rb) ** 2
    cost += 0.6 * np.sum((G - np.array(gpref)) ** 2, axis=1)
    cost += 40 * np.maximum(0, L[:, 1] + 0.10 - G[:, 1]) ** 2       # top hand above the bottom hand
    # body clearance for hands and the upper shaft
    pen = capsule_pen(G) + capsule_pen(L) + capsule_pen(G + 0.5 * sep * u) + capsule_pen(G + 1.6 * sep * u)
    cost += 200 * pen ** 2
    i = int(np.argmin(cost))
    return Vector(G[i]), Vector(L[i]), float(dl[i])

# ---------------------------------------------------------------- keying
clips = {}
def key_frame(act_name, f, extra_objs):
    d = clips.setdefault(act_name, {'bones': {}, 'objs': {}})
    for n in KEYB:
        pb = B(n)
        d['bones'].setdefault(n, []).append((f, pb.location.copy(), pb.rotation_quaternion.copy()))
    for o in extra_objs:
        d['objs'].setdefault(o.name, []).append((f, o.location.copy(), o.rotation_quaternion.copy(), o.scale.copy()))

def hide(o):
    o.matrix_basis = Matrix.Identity(4); o.scale = (0, 0, 0)

def paddle_world(Gg, ug):
    """T-grip at Gg, shaft direction ug (toward blade), game space -> blender world matrix"""
    u = ug.normalized(); Fw = Vector((0, 0, 1))
    n = (Fw - Fw.dot(u) * u).normalized()
    Yl = -u; Zl = n; Xl = Yl.cross(Zl).normalized()
    M = Matrix.Identity(4)
    M.col[0][:3] = gb(Xl); M.col[1][:3] = gb(Yl); M.col[2][:3] = gb(Zl); M.col[3][:3] = gb(Gg)
    return M

def mallet_world(Pg, mg):
    m = mg.normalized(); side = Vector((1, 0, 0))
    z = (side - side.dot(m) * m).normalized(); x = m.cross(z).normalized()
    M = Matrix.Identity(4)
    M.col[0][:3] = gb(x); M.col[1][:3] = gb(m); M.col[2][:3] = gb(z); M.col[3][:3] = gb(Pg)
    return M

def periodic_interp(keys, t, period):
    """keys: list of (t, value) sorted, values numpy arrays; Catmull-Rom periodic"""
    ts = [k[0] for k in keys]; vs = [np.array(k[1], dtype=float) for k in keys]; n = len(keys)
    t = t % period
    i = max(j for j in range(n) if ts[j] <= t + 1e-9)
    j = (i + 1) % n
    t0 = ts[i]; t1 = ts[j] if j > i else ts[j] + period
    s = (t - t0) / (t1 - t0) if t1 > t0 else 0
    p0, p1, p2, p3 = vs[(i - 1) % n], vs[i], vs[j], vs[(j + 1) % n]
    return 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s ** 3)

TP_KEYS = ['lean', 'twist', 'side', 'bob', 'head_pitch', 'head_twist', 'head_roll']
def tp_vec(tp): return [tp.get(k, 0) for k in TP_KEYS]
def vec_tp(v): return {k: float(x) for k, x in zip(TP_KEYS, v)}

# ---------------------------------------------------------------- paddle clips
SEP = 0.24
def make_paddle(side):
    """Corrected contract (dispatcher): paddle_L = blade on the character's anatomical LEFT (x > 0), right hand on
    the T-grip, left hand low. paddle_R = blade at x < 0, left hand on the T-grip, right hand low.
    geo = the side name in -X/+X geometry terms used below ('L' meant x < 0)."""
    geo = 'R' if side == 'L' else 'L'
    sx = -1 if geo == 'L' else 1
    bot = 'Right' if geo == 'L' else 'Left'      # anatomical hand nearest the blade (Right arm is at -X)
    top = 'Left' if geo == 'L' else 'Right'
    tw = 1 if geo == 'L' else -1                   # + twist brings the -X shoulder forward
    # phase design: time, blade centre aim (game, character space), trunk
    phases = [
        (0.00, (0.72, 0.08, 0.88), dict(lean=30, twist=26, side=-6, bob=0.0, head_pitch=-18, head_twist=-15, head_roll=5)),
        (0.25, (0.72, -0.24, 0.78), dict(lean=34, twist=24, side=-8, bob=-0.008, head_pitch=-20, head_twist=-14, head_roll=6)),
        (0.45, (0.72, -0.26, 0.36), dict(lean=18, twist=10, side=-5, bob=-0.005, head_pitch=-10, head_twist=-6, head_roll=3)),
        (0.62, (0.70, -0.14, -0.02), dict(lean=4, twist=-4, side=-2, bob=0.0, head_pitch=-2, head_twist=2, head_roll=1)),
        (0.72, (0.76, 0.16, -0.10), dict(lean=6, twist=-2, side=0, bob=0.004, head_pitch=-3, head_twist=1, head_roll=0)),
        (0.86, (0.74, 0.24, 0.50), dict(lean=20, twist=15, side=-3, bob=0.002, head_pitch=-11, head_twist=-9, head_roll=2)),
    ]
    keysG, keysL, keysT = [], [], []
    for t, C, tp in phases:
        tpp = dict(tp); tpp['twist'] *= tw; tpp['head_twist'] *= tw
        tpp['side'] = tp['side'] * (1 if geo == 'L' else -1)
        tpp['head_roll'] = tp['head_roll'] * (1 if geo == 'L' else -1)
        pose_trunk(tpp)
        Cg = Vector((sx * C[0], C[1], C[2]))
        mid = (shoulder('Left') + shoulder('Right')) / 2
        gpref = mid + Vector((sx * 0.03, 0.10, 0.15))
        G, L, dl = optimize_hands(top, bot, Cg, SEP, gpref)
        keysG.append((t, list(G))); keysL.append((t, list(L))); keysT.append((t, tp_vec(tpp)))
    name = 'paddle_' + side
    blade = []; resid = []; hand_err = []
    for f in range(0, 31):
        t = f / FPS
        tp = vec_tp(periodic_interp(keysT, t, 1.0))
        pose_trunk(tp)
        G = Vector(periodic_interp(keysG, t, 1.0)); L = Vector(periodic_interp(keysL, t, 1.0))
        sig_top = 1 if top == 'Left' else -1; sig_bot = -sig_top
        Ga = solve_arm(top, G, (sig_top * 0.9, -0.5, -0.35))
        La = solve_arm(bot, L, (sig_bot * 0.9, -0.6, -0.2))
        u = (La - Ga).normalized()
        hand_err.append(max((Ga - G).length, (La - L).length))
        Mw = paddle_world(Ga, u)
        set_prop_world(paddle, 'R', Mw)
        hide(malL); hide(malR)
        upd()
        bc = Ga + BLADE_C * u
        blade.append((f, [round(x, 3) for x in bc]))
        key_frame(name, f, (paddle, malL, malR))
    report[name] = {'blade_centre': blade, 'max_hand_err': round(max(hand_err), 3),
                    'catch': blade[round(0.25 * FPS)][1]}

# ---------------------------------------------------------------- cheer (1.5 s, loops)
def make_cheer():
    N = 45
    for f in range(0, N + 1):
        t = f / FPS; ph = 2 * math.pi * t / 0.5          # three bounces
        tp = dict(lean=-4 + 2 * math.sin(ph), twist=6 * math.sin(2 * math.pi * t / 1.5), side=4 * math.sin(2 * math.pi * t / 1.5),
                  bob=0.012 * max(0, math.sin(ph)), head_pitch=-8 + 3 * math.sin(ph), head_twist=0, head_roll=8 * math.sin(2 * math.pi * t / 1.5))
        pose_trunk(tp)
        for s, sg in (('Left', 1), ('Right', -1)):
            S = shoulder(s); r = sum(ARM[s]) * 0.98
            pump = 0.5 + 0.5 * math.sin(ph + (0.0 if s == 'Left' else math.pi * 0.5))
            d = Vector((sg * (0.55 - 0.15 * pump), 0.80 + 0.12 * pump, 0.18 + 0.1 * math.sin(ph * 0.5 + sg))).normalized()
            solve_arm(s, S + r * (0.86 + 0.12 * pump) * d, (sg * 1.0, -0.3, -0.5))
        gR = grip('Right')
        u = Vector((-0.10 - 0.06 * math.sin(2 * math.pi * t / 1.5), 1.0, 0.08)).normalized()  # blade up
        Mw = paddle_world(gR - 0.30 * u, u)
        set_prop_world(paddle, 'R', Mw)
        hide(malL); hide(malR); upd()
        key_frame('cheer', f, (paddle, malL, malR))

# ---------------------------------------------------------------- drum (0.5 s loop, hits L 0.0, R 0.25)
ML = 0.22
def make_drum():
    N = 15
    drum_y, drum_z = 0.55, 0.45
    lean = 14
    pose_trunk(dict(lean=lean))
    hit = {}; up = {}
    for s, sg in (('Left', 1), ('Right', -1)):
        Hh = Vector((sg * 0.085, drum_y + 0.036, drum_z)); Hu = Vector((sg * 0.11, drum_y + 0.25, drum_z - 0.10))
        res = []
        for H, pref in ((Hh, Vector((sg * 0.12, 0.52, 0.24))), (Hu, Vector((sg * 0.14, 0.66, 0.16)))):
            S = np.array(shoulder(s)); r = sum(ARM[s]) * 0.97
            g = np.arange(-r, r + 1e-6, 0.01)
            X, Y, Z = np.meshgrid(g, g, g, indexing='ij')
            Pp = S + np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
            Pp = Pp[np.linalg.norm(Pp - S, axis=1) <= r]
            dl = np.linalg.norm(np.array(H) - Pp, axis=1)
            cost = 80 * (dl - ML) ** 2 + 0.5 * np.sum((Pp - np.array(pref)) ** 2, axis=1) + 200 * capsule_pen(Pp) ** 2
            res.append(Vector(Pp[int(np.argmin(cost))]))
        hit[s] = (Hh, res[0]); up[s] = (Hu, res[1])
    def lift(phase):  # 0 at hit, fast rise, slower fall
        d = 0.068  # contact dwell so both 30 fps frames around a half-frame hit touch the drum
        return math.sin(math.pi * (phase - d) / (1 - 2 * d)) ** 0.8 if d < phase < 1 - d else 0.0
    errs = []
    for f in range(0, N + 1):
        t = f / FPS
        lL = lift(((t - 0.0) % 0.5) / 0.5); lR = lift(((t - 0.25) % 0.5) / 0.5)
        pulse = math.exp(-((((t + 0.02) % 0.25) / 0.06) ** 2))
        pose_trunk(dict(lean=lean + 3 * pulse, twist=4 * (lL - lR), bob=-0.006 * pulse, head_pitch=-10 - 4 * pulse))
        for s, l, o in (('Left', lL, malL), ('Right', lR, malR)):
            H = hit[s][0].lerp(up[s][0], l); Pg = hit[s][1].lerp(up[s][1], l)
            sg = 1 if s == 'Left' else -1
            ga = solve_arm(s, Pg, (sg * 0.9, -0.6, -0.2))
            m = (H - ga).normalized()
            set_prop_world(o, s[0], mallet_world(ga, m))
            o.scale = (1, 1, 1)
            if l == 0: errs.append(((ga + ML * m) - H).length)
        hide(paddle)
        upd()
        key_frame('drum', f, (paddle, malL, malR))
    report['drum_hit_err'] = round(max(errs), 3) if errs else None

make_paddle('L'); make_paddle('R'); make_cheer(); make_drum()

# ---------------------------------------------------------------- write actions + NLA tracks
def ensure_cont(qs):
    out = []; prev = None
    for q in qs:
        q = q.copy()
        if prev is not None and q.dot(prev) < 0: q.negate()
        out.append(q); prev = q
    return out

def write_action(obj, name, items, kind):
    act = bpy.data.actions.new(name if kind == 'arm' else name + '_' + obj.name)
    obj.animation_data_create()
    obj.animation_data.action = act
    if kind == 'arm':
        for bn, seq in items.items():
            pb = B(bn); path = pb.path_from_id()
            qs = ensure_cont([s[2] for s in seq])
            for (f, loc, _), q in zip(seq, qs):
                if bn == 'Hips':
                    pb.location = loc; pb.keyframe_insert('location', frame=f)
                pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=f)
    else:
        qs = ensure_cont([s[2] for s in items])
        for (f, loc, _, scl), q in zip(items, qs):
            obj.location = loc; obj.rotation_quaternion = q; obj.scale = scl
            obj.keyframe_insert('location', frame=f); obj.keyframe_insert('rotation_quaternion', frame=f)
            obj.keyframe_insert('scale', frame=f)
    # linear interpolation
    for fc in act_fcurves(act):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    obj.animation_data.action = None
    tr = obj.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 0, act)
    try:
        if len(act.slots): st.action_slot = act.slots[0]
    except Exception:
        pass
    st.name = name
    tr.mute = True
    return act

def act_fcurves(act):
    try:
        return list(act.fcurves)
    except Exception:
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags: out += list(cb.fcurves)
        return out

reset_pose()
for cname, d in clips.items():
    write_action(arm, cname, d['bones'], 'arm')
    for on, seq in d['objs'].items():
        write_action(bpy.data.objects[on], cname, seq, 'obj')
report['clip_frames'] = {k: len(v['bones']['Hips']) for k, v in clips.items()}

# default (non-animated) prop transforms: paddle as at paddle_L frame 0, mallets hidden
reset_pose(); upd()
f0 = clips['paddle_L']['objs']['Paddle'][0]
paddle.location = f0[1]; paddle.rotation_quaternion = f0[2]; paddle.scale = (1, 1, 1)
hide(malL); hide(malR)
upd()

# ---------------------------------------------------------------- export
for o in bpy.data.objects: o.select_set(o in (arm, lod0, lod1, paddle, malL, malR))
bpy.context.view_layer.objects.active = arm
sc.frame_set(0)
bpy.ops.export_scene.gltf(filepath=OUTGLB, export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=False, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True,
                          export_optimize_animation_keep_anim_armature=False, export_optimize_animation_keep_anim_object=True,
                          export_anim_slide_to_zero=True, export_skins=True, export_def_bones=False,
                          export_image_format='AUTO', export_materials='EXPORT', export_texcoords=True,
                          export_normals=True, export_tangents=False, export_vertex_color='NONE',
                          export_cameras=False, export_lights=False, export_extras=False, export_draco_mesh_compression_enable=False)
# drop the constant channels the exporter adds on the rig root node (the game must be free to move it)
def strip_root_channels(path, root):
    import struct
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
    o = 20 + jl; bl = struct.unpack('<I', b[o:o + 4])[0]; binc = b[o + 8:o + 8 + bl]
    ri = [i for i, n in enumerate(j['nodes']) if n.get('name') == root]
    removed = 0
    for a in j.get('animations', []):
        keep = [c for c in a['channels'] if c['target']['node'] not in ri]
        removed += len(a['channels']) - len(keep)
        used = sorted(set(c['sampler'] for c in keep))
        remap = {old: new for new, old in enumerate(used)}
        a['samplers'] = [a['samplers'][k] for k in used]
        for c in keep: c['sampler'] = remap[c['sampler']]
        a['channels'] = keep
    # drop accessors no longer referenced (and their buffer views), then repack the binary chunk
    refs = set()
    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ('accessors', 'bufferViews', 'buffers'): continue
                if k in ('input', 'output', 'indices', 'inverseBindMatrices') and isinstance(v, int): refs.add(v)
                elif k == 'attributes' and isinstance(v, dict): refs.update(v.values())
                else: walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(j)
    acc_keep = sorted(refs); amap = {old: new for new, old in enumerate(acc_keep)}
    def rewalk(x):
        if isinstance(x, dict):
            for k, v in list(x.items()):
                if k in ('accessors', 'bufferViews', 'buffers'): continue
                if k in ('input', 'output', 'indices', 'inverseBindMatrices') and isinstance(v, int): x[k] = amap[v]
                elif k == 'attributes' and isinstance(v, dict): x[k] = {kk: amap[vv] for kk, vv in v.items()}
                else: rewalk(v)
        elif isinstance(x, list):
            for v in x: rewalk(v)
    rewalk(j)
    j['accessors'] = [j['accessors'][i] for i in acc_keep]
    bv_used = sorted(set(a_['bufferView'] for a_ in j['accessors'] if 'bufferView' in a_) | set(im['bufferView'] for im in j.get('images', []) if 'bufferView' in im))
    bmap = {old: new for new, old in enumerate(bv_used)}
    newbin = bytearray(); nbv = []
    for old in bv_used:
        v = dict(j['bufferViews'][old]); data = binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        while len(newbin) % 4: newbin += bytes(1)
        v['byteOffset'] = len(newbin); newbin += data; nbv.append(v)
    while len(newbin) % 4: newbin += bytes(1)
    j['bufferViews'] = nbv; j['buffers'][0]['byteLength'] = len(newbin)
    for a_ in j['accessors']:
        if 'bufferView' in a_: a_['bufferView'] = bmap[a_['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im: im['bufferView'] = bmap[im['bufferView']]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(newbin))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(newbin), 0x004E4942) + bytes(newbin)
    open(path, 'wb').write(out)
    return removed
report['root_channels_removed'] = strip_root_channels(OUTGLB, arm.name)
ev = {"paddle_L": {"catch": 0.25, "exit": 0.65}, "paddle_R": {"catch": 0.25, "exit": 0.65},
      "drum": {"hit_L": 0.0, "hit_R": 0.25}}
with open(OUTGLB[:-4] + '.events.json', 'w') as fh: json.dump(ev, fh)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(tmpdir, NAME.lower() + '_s2.blend'), compress=True)
print('REPORT' + json.dumps(report))
