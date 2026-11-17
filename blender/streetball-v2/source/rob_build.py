# rob-baller: Rob the robot, modelled from the reference, rigged with Mixamo bone names (+ Antenna), A-pose like the
# Football Foxino rig, facing -Y (glTF +Z). One body mesh "Rob" (material "Rob": a 64 px palette, emissive palette
# for the battery / heart) and the screen "Face" (material "FaceScreen": 512 px 2x2 atlas happy / focus / oops / sad).
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix

PALR = ['3cc4ef', '2a98c2', '3b1f8f', '1c1c26', 'ff8a1e', 'f5f8fc', 'ff9a2e', 'ff3d4a', '4a505c', 'ffd83a', '48d8ff', 'c9d6e0',
        '0b0b12', '7a3fd0', 'ffffff', '000000']
CI = {n: i for i, n in enumerate(['cyan', 'cyand', 'purple', 'black', 'orange', 'white', 'glow', 'red', 'grey', 'bolt', 'jersey', 'light',
                                  'screen', 'violet', 'pure', 'none'])}
EMIT = {'glow': 1.0, 'bolt': 1.0, 'red': 0.35}
DEG = math.pi / 180
ARM_DOWN = 46.6 * DEG          # Foxino's rest arm angle below horizontal

# bone layout (head, tail) in Blender coordinates, facing -Y
SH = Vector((0.3, 0.0, 0.86))
AD = Vector((math.cos(ARM_DOWN), 0, -math.sin(ARM_DOWN)))
BONES = {
    'Hips': ((0, 0, 0.42), (0, 0, 0.47), None),
    'Spine': ((0, 0, 0.47), (0, 0, 0.58), 'Hips'),
    'Spine1': ((0, 0, 0.58), (0, 0, 0.72), 'Spine'),
    'Spine2': ((0, 0, 0.72), (0, 0, 0.9), 'Spine1'),
    'Neck': ((0, 0, 0.9), (0, 0, 0.98), 'Spine2'),
    'Head': ((0, 0, 0.98), (0, 0, 1.25), 'Neck'),
    'HeadTop_End': ((0, 0, 1.25), (0, 0, 1.38), 'Head'),
    'Antenna': ((0, 0, 1.34), (0, 0, 1.47), 'Head'),
}
for s, nm in ((1, 'Left'), (-1, 'Right')):
    sx = Vector((s, 1, 1))
    j = SH * 1; j.x *= s; ad = AD.copy(); ad.x *= s
    BONES[f'{nm}Shoulder'] = ((s * 0.06, 0, 0.84), tuple(j), 'Spine2')
    BONES[f'{nm}Arm'] = (tuple(j), tuple(j + ad * 0.19), f'{nm}Shoulder')
    BONES[f'{nm}ForeArm'] = (tuple(j + ad * 0.19), tuple(j + ad * 0.37), f'{nm}Arm')
    BONES[f'{nm}Hand'] = (tuple(j + ad * 0.37), tuple(j + ad * 0.47), f'{nm}ForeArm')
    BONES[f'{nm}UpLeg'] = ((s * 0.12, 0, 0.38), (s * 0.125, 0, 0.23), 'Hips')
    BONES[f'{nm}Leg'] = ((s * 0.125, 0, 0.23), (s * 0.13, 0, 0.1), f'{nm}UpLeg')
    BONES[f'{nm}Foot'] = ((s * 0.13, 0, 0.1), (s * 0.13, -0.1, 0.03), f'{nm}Leg')
    BONES[f'{nm}ToeBase'] = ((s * 0.13, -0.1, 0.03), (s * 0.13, -0.17, 0.03), f'{nm}Foot')
    BONES[f'{nm}Toe_End'] = ((s * 0.13, -0.17, 0.03), (s * 0.13, -0.22, 0.03), f'{nm}ToeBase')

def MN(n): return n if n in ('Antenna',) else 'mixamorig:' + n

class RB:
    def __init__(s):
        s.bm = bmesh.new(); s.dl = s.bm.verts.layers.deform.verify(); s.cl = s.bm.faces.layers.int.new('col')
        s.groups = [MN(n) for n in BONES]
    def _finish(s, verts, col, wfn, smooth=True):
        faces = set()
        for v in verts:
            for f in v.link_faces: faces.add(f)
            w = wfn(v.co) if callable(wfn) else {wfn: 1.0}
            for b, x in w.items():
                if x > 1e-4: v[s.dl][s.groups.index(MN(b))] = x
        for f in faces:
            f[s.cl] = CI[col] if isinstance(col, str) else col(f); f.smooth = smooth
        return verts
    def sphere(s, c, r, col, w, seg=16, ring=10, e=None, M=None, smooth=True, zclip=None):
        res = bmesh.ops.create_uvsphere(s.bm, u_segments=seg, v_segments=ring, radius=1.0)
        vs = res['verts']
        for v in vs:
            p = v.co.copy()
            if e:
                p = Vector([math.copysign(abs(p[i]) ** e[i], p[i]) for i in range(3)])
            p = Vector((p.x * r[0], p.y * r[1], p.z * r[2]))
            if M is not None: p = M @ p
            v.co = Vector(c) + p
        return s._finish(vs, col, w, smooth)
    def tube(s, p0, p1, r0, r1, col, w, seg=12, caps=True, smooth=True):
        p0, p1 = Vector(p0), Vector(p1); d = p1 - p0
        res = bmesh.ops.create_cone(s.bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=d.length)
        q = d.normalized().to_track_quat('Z', 'Y')
        M = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        for v in res['verts']: v.co = M @ v.co
        return s._finish(res['verts'], col, w, smooth)
    def ring(s, c, axis, R, r, col, w, seg=20, mseg=6, sx=1.0, sy=1.0):
        axis = Vector(axis).normalized(); a = axis.orthogonal().normalized(); b = axis.cross(a)
        if abs(axis.z) > 0.9: a, b = Vector((1, 0, 0)), Vector((0, 1, 0))
        vs = []; grid = []
        for i in range(seg):
            t = 2 * math.pi * i / seg; dirv = a * math.cos(t) * sx + b * math.sin(t) * sy
            rowv = []
            for j in range(mseg):
                u = 2 * math.pi * j / mseg
                p = Vector(c) + dirv * (R + r * math.cos(u)) + axis * r * math.sin(u)
                v = s.bm.verts.new(p); rowv.append(v); vs.append(v)
            grid.append(rowv)
        for i in range(seg):
            for j in range(mseg):
                s.bm.faces.new((grid[i][j], grid[(i + 1) % seg][j], grid[(i + 1) % seg][(j + 1) % mseg], grid[i][(j + 1) % mseg]))
        bmesh.ops.recalc_face_normals(s.bm, faces=list({f for v in vs for f in v.link_faces}))
        return s._finish(vs, col, w)
    def poly(s, pts, col, w, smooth=False, ref=None):
        vs = [s.bm.verts.new(p) for p in pts]
        f = s.bm.faces.new(vs); f.normal_update()
        if ref is not None and f.normal.dot(f.calc_center_median() - Vector(ref)) < 0: f.normal_flip()
        return s._finish(vs, col, w, smooth)

def lerpw(z, stops):
    """stops: [(z, bone)] ascending; linear blend between neighbours."""
    if z <= stops[0][0]: return {stops[0][1]: 1.0}
    for (z0, b0), (z1, b1) in zip(stops, stops[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return {b0: 1 - t, b1: t} if b0 != b1 else {b0: 1.0}
    return {stops[-1][1]: 1.0}

TORSO_W = [(0.40, 'Hips'), (0.5, 'Spine'), (0.62, 'Spine1'), (0.78, 'Spine2')]
TC, TR = Vector((0, 0.01, 0.645)), Vector((0.335, 0.3, 0.345))

def torso_pt(az, z, off=0.0):
    """A point on the egg torso at height z, azimuth az (0 = front -Y), pushed out by off."""
    u = (z - TC.z) / TR.z; u = max(-0.999, min(0.999, u)); k = math.sqrt(1 - u * u)
    n = Vector((math.sin(az) * k / TR.x, -math.cos(az) * k / TR.y, u / TR.z)).normalized()
    p = Vector((TC.x + TR.x * k * math.sin(az), TC.y - TR.y * k * math.cos(az), z))
    return p + n * off, n

def build_rob_mesh():
    R = RB()
    tw = lambda co: lerpw(co.z, TORSO_W)
    # torso, trim bands, battery window
    R.sphere(TC, TR, 'cyan', tw, seg=24, ring=16)
    for z, col in ((0.905, 'purple'), (0.44, 'purple')):
        u = (z - TC.z) / TR.z; k = math.sqrt(1 - u * u)
        R.ring((0, TC.y, z), (0, 0, 1), 1.0, 0.016, col, tw, seg=24, mseg=5, sx=TR.x * k + 0.004, sy=TR.y * k + 0.004)
    # battery window: frame, glow, bolt (flat facets on the belly)
    def belly(x, z, off):
        az = math.asin(max(-1, min(1, x / (TR.x * 0.98)))); return torso_pt(az, z, off)[0]
    W, H, ZC = 0.13, 0.085, 0.545
    sq = lambda c: math.copysign(abs(c) ** 0.5, c)
    ts = [2 * math.pi * i / 24 for i in range(24)]
    frame = [belly(W * 1.18 * sq(math.cos(t)), ZC + H * 1.25 * sq(math.sin(t)), 0.006) for t in ts]
    inner = [belly(W * sq(math.cos(t)), ZC + H * sq(math.sin(t)), 0.008) for t in ts]
    def patch(sx, sz, off, col):
        rings = [[belly(sx * k / 3 * sq(math.cos(t)), ZC + sz * k / 3 * sq(math.sin(t)), off) for t in ts] for k in (1, 2, 3)]
        ctr = belly(0, ZC, off)
        for i in range(24): R.poly([ctr, rings[0][i], rings[0][(i + 1) % 24]], col, tw, ref=TC)
        for k in range(2):
            for i in range(24): R.poly([rings[k][i], rings[k + 1][i], rings[k + 1][(i + 1) % 24], rings[k][(i + 1) % 24]], col, tw, ref=TC)
    patch(W * 1.18, H * 1.25, 0.006, 'grey')
    patch(W, H, 0.009, 'glow')
    bolt = [(0.012, 0.06), (-0.03, -0.004), (-0.002, -0.004), (-0.014, -0.06), (0.03, 0.008), (0.002, 0.008)]
    R.poly([belly(x, ZC + z, 0.013) for x, z in bolt], 'bolt', tw, ref=TC)
    # the tank top: a white shell over the chest, cyan hem / collar / side panels; a cyan 7 front and back
    vs = R.sphere(TC + Vector((0, 0, 0)), TR + Vector((0.014, 0.014, 0.014)), lambda f: CI['white'], tw, seg=24, ring=16)
    kill = [v for v in vs if v.co.z < 0.655 or v.co.z > 0.93]
    bmesh.ops.delete(R.bm, geom=kill, context='VERTS')
    for f in R.bm.faces:
        if f[R.cl] == CI['white']:
            c = f.calc_center_median()
            if abs(c.x) > 0.27: f[R.cl] = CI['jersey']
    for z in (0.665, 0.915):
        u = (z - TC.z) / (TR.z + 0.014); k = math.sqrt(max(0, 1 - u * u))
        R.ring((0, TC.y, z), (0, 0, 1), 1.0, 0.012, 'jersey', tw, seg=24, mseg=5, sx=(TR.x + 0.014) * k + 0.003, sy=(TR.y + 0.014) * k + 0.003)
    for side in (-1, 1):
        seven = [(-0.05, 0.06), (0.055, 0.06), (0.055, 0.035), (0.0, -0.065), (-0.032, -0.065), (0.02, 0.035), (-0.05, 0.035)]
        pts = []
        for x, z in seven:
            xx = x * (-side)
            az = math.asin(max(-1, min(1, xx / (TR.x * 0.98))))
            if side > 0: az = math.pi - az
            pts.append(torso_pt(az, 0.79 + z, 0.022)[0])
        R.poly(pts, 'jersey', tw, ref=TC)
    # neck, head, cap, antenna and heart, ear pods, face bezel
    R.tube((0, 0, 0.9), (0, 0, 1.0), 0.07, 0.07, 'black', 'Neck', seg=12, caps=False)
    HC = Vector((0, 0, 1.13)); HR = Vector((0.275, 0.26, 0.255))
    R.sphere(HC, HR, 'cyan', 'Head', seg=24, ring=16)
    R.sphere((0, 0, 1.37), (0.075, 0.075, 0.045), 'cyan', 'Head', seg=12, ring=6)
    R.tube((0, 0, 1.39), (0, 0, 1.47), 0.009, 0.007, 'black', 'Antenna', seg=6)
    heart = []
    for i in range(16):
        t = 2 * math.pi * i / 16
        heart.append((math.sin(t) ** 3, (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 16))
    for dy, flip in ((-0.012, False), (0.012, True)):
        pts = [Vector((0.045 * x, dy, 1.5 + 0.045 * y)) for x, y in heart]
        R.poly(pts, 'red', 'Antenna', ref=(0, 0, 1.5))
    hl = [Vector((0.045 * x, -0.012, 1.5 + 0.045 * y)) for x, y in heart]; hr = [Vector((0.045 * x, 0.012, 1.5 + 0.045 * y)) for x, y in heart]
    for i in range(16):
        R.poly([hl[i], hr[i], hr[(i + 1) % 16], hl[(i + 1) % 16]], 'red', 'Antenna', ref=(0, 0, 1.5))
    for s in (-1, 1):
        x = s * (HR.x - 0.012)
        R.tube((x, 0, HC.z - 0.02), (x + s * 0.05, 0, HC.z - 0.02), 0.08, 0.075, 'orange', 'Head', seg=16)
        R.ring((x + s * 0.052, 0, HC.z - 0.02), (s, 0, 0), 0.055, 0.012, 'purple', 'Head', seg=16, mseg=5)
        R.sphere((x + s * 0.05, 0, HC.z - 0.02), (0.02, 0.048, 0.048), 'light', 'Head', seg=12, ring=6)
    # arms
    for s, nm in ((1, 'Left'), (-1, 'Right')):
        j = Vector(BONES[f'{nm}Arm'][0]); e = Vector(BONES[f'{nm}ForeArm'][0]); wr = Vector(BONES[f'{nm}Hand'][0]); ad = (e - j).normalized()
        R.sphere(j, (0.1, 0.1, 0.1), 'cyan', f'{nm}Arm', seg=16, ring=10)
        R.ring(j + ad * 0.06, ad, 0.083, 0.012, 'purple', f'{nm}Arm', seg=16, mseg=5)
        R.tube(j + ad * 0.04, e - ad * 0.03, 0.068, 0.062, 'cyan', f'{nm}Arm', seg=12)
        R.sphere(e, (0.055, 0.055, 0.055), 'black', f'{nm}ForeArm', seg=12, ring=8)
        R.tube(e + ad * 0.03, wr - ad * 0.025, 0.07, 0.075, 'cyan', f'{nm}ForeArm', seg=12)
        R.ring(wr - ad * 0.06, ad, 0.077, 0.011, 'purple', f'{nm}ForeArm', seg=16, mseg=5)
        R.tube(wr - ad * 0.045, wr + ad * 0.005, 0.082, 0.082, 'white', f'{nm}ForeArm', seg=12)
        # the hand: palm, thumb, three chunky fingers (all black)
        side = Vector((0, -1, 0))
        R.sphere(wr + ad * 0.05, (0.048, 0.04, 0.055), 'black', f'{nm}Hand', seg=12, ring=8,
                 M=ad.to_track_quat('Z', 'Y').to_matrix())
        R.tube(wr + ad * 0.03 + side * 0.035, wr + ad * 0.07 + side * 0.06, 0.017, 0.016, 'black', f'{nm}Hand', seg=6)
        for k in range(3):
            o = Vector((0, (k - 1) * 0.026, 0))
            R.tube(wr + ad * 0.085 + o, wr + ad * 0.13 + o + Vector((0, -0.01, 0)), 0.014, 0.013, 'black', f'{nm}Hand', seg=6)
    # legs and boots
    for s, nm in ((1, 'Left'), (-1, 'Right')):
        hp = Vector(BONES[f'{nm}UpLeg'][0]); kn = Vector(BONES[f'{nm}Leg'][0]); an = Vector(BONES[f'{nm}Foot'][0])
        R.sphere(hp, (0.07, 0.07, 0.06), 'black', f'{nm}UpLeg', seg=12, ring=8)
        R.tube(hp + Vector((0, 0, -0.03)), kn + Vector((0, 0, 0.03)), 0.075, 0.07, 'cyan', f'{nm}UpLeg', seg=12)
        R.sphere(kn, (0.06, 0.06, 0.05), 'black', f'{nm}Leg', seg=12, ring=8)
        R.tube(kn + Vector((0, 0, -0.025)), an + Vector((0, 0, -0.02)), 0.085, 0.095, 'cyan', f'{nm}Leg', seg=14)
        R.ring(kn + Vector((0, 0, -0.03)), (0, 0, 1), 0.087, 0.01, 'purple', f'{nm}Leg', seg=16, mseg=5)
        fc = Vector((s * 0.13, -0.045, 0.06))
        R.sphere(fc, (0.105, 0.155, 0.07), 'cyan', f'{nm}Foot', seg=16, ring=10, e=(0.7, 0.7, 0.8))
        R.sphere(fc + Vector((0, 0, -0.045)), (0.11, 0.16, 0.025), 'black', f'{nm}Foot', seg=16, ring=6, e=(0.6, 0.6, 1.0))
        R.sphere((s * 0.232, 0.005, 0.085), (0.008, 0.032, 0.032), 'purple', f'{nm}Foot', seg=10, ring=6)
        for dx in (-0.05, 0.05):
            R.sphere((s * 0.13 + dx, -0.2, 0.028), (0.014, 0.006, 0.006), 'orange', f'{nm}Foot', seg=6, ring=4)
    return R

def palette_images():
    N = 64; px = np.zeros((N, N, 4), np.float32); em = np.zeros((N, N, 4), np.float32); em[..., 3] = 1; px[..., 3] = 1
    uv = {}
    for i, h in enumerate(PALR):
        cx, cy = (i % 4) * 16, (i // 4) * 16
        col = np.array([int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)], np.float32)
        px[cy:cy + 16, cx:cx + 16, :3] = col
        nm = [k for k, v in CI.items() if v == i][0]
        if nm in EMIT: em[cy:cy + 16, cx:cx + 16, :3] = col * EMIT[nm]
        uv[i] = ((cx + 8) / N, (cy + 8) / N)
    out = []
    for nm, arr in (('rob_palette', px), ('rob_emit', em)):
        im = bpy.data.images.get(nm)
        if im: bpy.data.images.remove(im)
        im = bpy.data.images.new(nm, N, N, alpha=False); im.pixels.foreach_set(arr.ravel()); im.update(); im.pack()
        im.colorspace_settings.name = 'sRGB'; out.append(im)
    return out[0], out[1], uv

def face_atlas():
    N = 512; H = N // 2
    yy, xx = np.mgrid[0:H, 0:H].astype(np.float32) + 0.5
    def quad(kind):
        img = np.zeros((H, H, 3), np.float32)
        img[:] = np.array([0.03, 0.03, 0.06]) + (1 - yy[..., None] / H) * 0.02
        gl = np.zeros((H, H), np.float32)
        def stroke(d, w=11.0):
            return np.clip(1.0 - (d - w / 2) / 2.0, 0, 1)
        for ex in (H * 0.3, H * 0.7):
            ey = H * 0.52
            if kind == 'happy':
                r = H * 0.11; d = np.abs(np.hypot(xx - ex, yy - (ey - r * 0.35)) - r); d[yy < ey - r * 0.35] = 99
                gl = np.maximum(gl, stroke(d))
            elif kind == 'focus':
                s = 1 if ex < H / 2 else -1
                ax, ay = ex - H * 0.1, ey + s * H * 0.035; bx, by = ex + H * 0.1, ey - s * H * 0.035
                t = np.clip(((xx - ax) * (bx - ax) + (yy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
                d = np.hypot(xx - (ax + t * (bx - ax)), yy - (ay + t * (by - ay))); gl = np.maximum(gl, stroke(d, 14))
            elif kind == 'oops':
                for sgn in (-1, 1):
                    ax, ay = ex - H * 0.08, ey - sgn * H * 0.08; bx, by = ex + H * 0.08, ey + sgn * H * 0.08
                    t = np.clip(((xx - ax) * (bx - ax) + (yy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
                    d = np.hypot(xx - (ax + t * (bx - ax)), yy - (ay + t * (by - ay))); gl = np.maximum(gl, stroke(d, 12))
            elif kind == 'sad':
                r = H * 0.11; cy = ey - r * 0.2
                d = np.abs(np.hypot(xx - ex, yy - (cy + r * 0.5)) - r); d[yy > cy + r * 0.5] = 99
                gl = np.maximum(gl, stroke(d))
                if ex > H / 2:
                    td = np.hypot(xx - (ex + H * 0.02), yy - (ey - H * 0.16)) - H * 0.025
                    img[td < 0] = np.array([0.3, 0.75, 1.0])
        col = np.array([0.82, 0.96, 1.0], np.float32)
        img = img * (1 - gl[..., None]) + col * gl[..., None]
        return img
    out = np.zeros((N, N, 4), np.float32); out[..., 3] = 1
    out[H:, :H, :3] = quad('happy'); out[H:, H:, :3] = quad('focus'); out[:H, :H, :3] = quad('oops'); out[:H, H:, :3] = quad('sad')
    im = bpy.data.images.get('rob_face')
    if im: bpy.data.images.remove(im)
    im = bpy.data.images.new('rob_face', N, N, alpha=False); im.pixels.foreach_set(out.ravel()); im.update(); im.pack()
    return im

def mat_tex(name, img, emit_img=None, emit_strength=1.0, rough=0.45):
    m = bpy.data.materials.get(name)
    if m: bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest' if img.size[0] <= 64 else 'Linear'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if emit_img is not None:
        e = nt.nodes.new('ShaderNodeTexImage'); e.image = emit_img; e.interpolation = t.interpolation
        nt.links.new(e.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit_strength
    return m

def face_mesh(coll, arm):
    """The screen: a superellipse patch on the front of the head, UVs in the top-left quarter (happy)."""
    HC = Vector((0, 0, 1.13)); HR = Vector((0.275, 0.26, 0.255))
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    nu, nv = 12, 9; grid = {}
    for i in range(nu + 1):
        for j in range(nv + 1):
            s = -1 + 2 * i / nu; t = -1 + 2 * j / nv
            m = max(abs(s), abs(t)); q = (abs(s) ** 4 + abs(t) ** 4) ** 0.25
            k = m / q if q > 1e-6 else 0
            ps, pt = s * k, t * k
            az = ps * 40 * DEG; el = pt * 27 * DEG - 2 * DEG
            d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
            p = HC + Vector((d.x * HR.x, d.y * HR.y, d.z * HR.z)) * 1.006
            grid[i, j] = (bm.verts.new(p), ((s + 1) / 4, 0.5 + (t + 1) / 4))
    for i in range(nu):
        for j in range(nv):
            q = [grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]]
            f = bm.faces.new([a for a, _ in q][::-1])
            for l in f.loops:
                for a, uv in q:
                    if a == l.vert: l[uvl].uv = uv
            f.smooth = True
    # the bezel round the screen goes into the body mesh (built by build_rob); here only the screen
    me = bpy.data.meshes.new('Face'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('Face', me); coll.objects.link(ob)
    ob.vertex_groups.new(name='mixamorig:Head').add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    ob.parent = arm; md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    return ob

def bezel(R):
    HC = Vector((0, 0, 1.13)); HR = Vector((0.275, 0.26, 0.255))
    def pt(ps, pt_, sc):
        az = ps * 40 * DEG * sc; el = pt_ * 27 * DEG * sc - 2 * DEG
        d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
        return HC + Vector((d.x * HR.x, d.y * HR.y, d.z * HR.z))
    n = 40; inner = []; outer = []
    for i in range(n):
        t = 2 * math.pi * i / n; c, s = math.cos(t), math.sin(t)
        q = (abs(c) ** 4 + abs(s) ** 4) ** 0.25; ps, pt_ = c / q, s / q
        inner.append(R.bm.verts.new(pt(ps, pt_, 1.0) * 1.0 + (pt(ps, pt_, 1.0) - HC).normalized() * 0.012))
        outer.append(R.bm.verts.new(pt(ps, pt_, 1.12) + (pt(ps, pt_, 1.12) - HC).normalized() * 0.003))
    for i in range(n):
        fb = R.bm.faces.new((inner[i], outer[i], outer[(i + 1) % n], inner[(i + 1) % n])); fb.normal_update()
        if fb.normal.dot(fb.calc_center_median() - HC) < 0: fb.normal_flip()
    R._finish(inner + outer, 'cyand', 'Head')

def build_rob():
    S = bpy.data.scenes['Chars']
    c = bpy.data.collections.get('Rob')
    if c:
        for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
    else:
        c = bpy.data.collections.new('Rob'); S.collection.children.link(c)
    # armature
    ad = bpy.data.armatures.new('RobRig'); arm = bpy.data.objects.new('RobRig', ad); c.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects: o.select_set(False)
    arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
    for nm, (h, t, p) in BONES.items():
        b = ad.edit_bones.new(MN(nm)); b.head = h; b.tail = t; b.roll = 0
    for nm, (h, t, p) in BONES.items():
        if p: eb = ad.edit_bones[MN(nm)]; eb.parent = ad.edit_bones[MN(p)]; eb.use_connect = (Vector(ad.edit_bones[MN(p)].tail) - Vector(h)).length < 1e-4
    bpy.ops.object.mode_set(mode='OBJECT')
    # body mesh
    R = build_rob_mesh(); bezel(R)
    pal, emi, uvc = palette_images()
    uvl = R.bm.loops.layers.uv.new('UVMap')
    for f in R.bm.faces:
        u = uvc[f[R.cl]]
        for l in f.loops: l[uvl].uv = u

    me = bpy.data.meshes.new('Rob'); R.bm.to_mesh(me)
    ob = bpy.data.objects.new('Rob', me); c.objects.link(ob)
    for gname in R.groups: ob.vertex_groups.new(name=gname)
    R.bm.free()
    # recalc_face_normals on open / flat pieces can flip: orient every face away from its part's centre is costly;
    # flat decals were wound to face out explicitly, closed shells are consistent.
    me.materials.append(mat_tex('Rob', pal, emi, 1.0))
    ob.parent = arm; md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    fo = face_mesh(c, arm)
    fm = mat_tex('FaceScreen', face_atlas(), None, 0, 0.15)
    nt = fm.node_tree; b = nt.nodes['Principled BSDF']; t = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 1.0
    fo.data.materials.append(fm)
    return arm, ob, fo
