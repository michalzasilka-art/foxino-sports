"""Igloo W3 (lane C): cosy interior props of the igloo, built procedurally.

Run inside Blender 5.2 (live or headless):  exec(open(PATH).read())  or  blender -b -P ig_props_build.py
Builds scene "IglooProps" with one root object per model at the world origin (Blender Z-up,
model front = Blender -Y = glTF +Z), generated 512 px maps, and exports one GLB per model to
blender/igloo/ (plain glTF, +Y up, JPEG q85 maps, no Draco/meshopt).
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, noise

ROOT = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\c-igloo\blender\igloo"
SCN = "IglooProps"
N = 512                      # map size
RW = 9.0                     # inner dome radius (shelf back follows it)
TAU = 2 * math.pi


# ============================================================ textures
def _freq(n):
    f = np.fft.fftfreq(n)
    return np.meshgrid(f, f)          # fx along columns (u), fy along rows (v)


def blur_noise(n, sig_a, sig_b=None, ang=0.0, seed=0):
    """Tileable gaussian-filtered noise, std 1. sig_a along direction ang (radians, in uv), sig_b across."""
    sig_b = sig_a if sig_b is None else sig_b
    w = np.random.default_rng(seed).standard_normal((n, n))
    fx, fy = _freq(n)
    c, s = math.cos(ang), math.sin(ang)
    fa, fb = fx * c + fy * s, -fx * s + fy * c
    h = np.exp(-2 * math.pi ** 2 * ((sig_a * fa) ** 2 + (sig_b * fb) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * h))
    out -= out.mean()
    return out / (out.std() + 1e-9)


def fur_height(n, ang, seed):
    """Fur strands: long thin streaks along ang, broken into clumps."""
    st = blur_noise(n, 5, 0.9, ang, seed)
    tuft = blur_noise(n, 3.5, 3.5, 0, seed + 1)
    clump = blur_noise(n, 12, 12, 0, seed + 2)
    return 0.35 * st + 0.4 * tuft + 0.55 * clump


def normal_from_height(h, strength):
    h = h * strength
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nz = np.ones_like(h)
    ln = np.sqrt(dx * dx + dy * dy + 1)
    return np.stack([-dx / ln, -dy / ln, nz / ln], 2) * 0.5 + 0.5


def uvgrid(n=N):
    u = (np.arange(n) + 0.5) / n
    return np.meshgrid(u, u)          # uu (cols), vv (rows) ; row 0 = v 0 (bottom)


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return np.asarray(a)[None, None, :] * (1 - t) + np.asarray(b)[None, None, :] * t if np.ndim(a) == 1 \
        else a * (1 - t) + b * t


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def col(rgb, shape=(N, N)):
    return np.broadcast_to(np.asarray(rgb, np.float32), shape + (3,)).copy()


def make_image(name, rgb, data=False):
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=False)
    if data:
        img.colorspace_settings.name = "Non-Color"
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((n, n, 1))], 2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    img.pack()
    return img


def make_mat(name, base=None, nrm=None, mr=None, rough=0.8, metal=0.0, base_rgb=(0.8, 0.8, 0.8),
             emis=None, emis_strength=1.0, nrm_strength=1.0):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Base Color"].default_value = (*[c ** 2.2 for c in base_rgb], 1)
    if base:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image, t.location = base, (-500, 300)
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if mr:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image, t.location = mr, (-700, 0)
        sp = nt.nodes.new("ShaderNodeSeparateColor")
        sp.location = (-400, 0)
        nt.links.new(t.outputs["Color"], sp.inputs[0])
        nt.links.new(sp.outputs[1], b.inputs["Roughness"])
        nt.links.new(sp.outputs[2], b.inputs["Metallic"])
    if nrm:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image, t.location = nrm, (-700, -350)
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.location = (-400, -350)
        nm.inputs["Strength"].default_value = nrm_strength
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs[0], b.inputs["Normal"])
    if emis:
        b.inputs["Emission Color"].default_value = (*[c ** 2.2 for c in emis], 1)
        b.inputs["Emission Strength"].default_value = emis_strength
    return m


# ============================================================ geometry
class Part:
    """verts, faces, per-face uv lists (0..1) and the atlas rect the uvs are squeezed into."""

    def __init__(self, verts, faces, uvs=None, region=(0, 0, 1, 1), uvmode=None):
        self.verts, self.faces, self.uvs, self.region, self.uvmode = verts, faces, uvs, region, uvmode

    def transform(self, mat):
        self.verts = [mat @ v for v in self.verts]
        return self


def sgnpow(x, p):
    return math.copysign(abs(x) ** p, x)


def lathe(profile, n, outline=None, disp=None, region=(0, 0, 1, 1), uvmode="cyl"):
    """Revolve profile [(t, z)] (first/last t == 0 become poles) around Z.
    outline(theta) -> (x, y) of the unit ring (default circle). disp(co, theta, i) -> co."""
    outline = outline or (lambda th: (math.cos(th), math.sin(th)))
    verts, rings = [], []
    lens = [0.0]
    for i in range(1, len(profile)):
        lens.append(lens[-1] + math.dist(profile[i - 1], profile[i]))
    tot = lens[-1] or 1
    for i, (t, z) in enumerate(profile):
        if t == 0 and i in (0, len(profile) - 1):
            co = Vector((0, 0, z))
            if disp:
                co = disp(co, 0.0, i)
            verts.append(co)
            rings.append([len(verts) - 1])
            continue
        ring = []
        for j in range(n):
            th = TAU * j / n
            ox, oy = outline(th)
            co = Vector((t * ox, t * oy, z))
            if disp:
                co = disp(co, th, i)
            verts.append(co)
            ring.append(len(verts) - 1)
        rings.append(ring)
    faces, uvs = [], []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        va, vb = lens[i] / tot, lens[i + 1] / tot
        for j in range(n):
            j1 = (j + 1) % n
            ua, ub = j / n, (j + 1) / n
            if len(a) == 1:
                faces.append((a[0], b[j1], b[j]))
                uvs.append([((ua + ub) / 2, va), (ub, vb), (ua, vb)])
            elif len(b) == 1:
                faces.append((a[j], a[j1], b[0]))
                uvs.append([(ua, va), (ub, va), ((ua + ub) / 2, vb)])
            else:
                faces.append((a[j], a[j1], b[j1], b[j]))
                uvs.append([(ua, va), (ub, va), (ub, vb), (ua, vb)])
    return Part(verts, faces, uvs if uvmode == "cyl" else None, region, uvmode)


def torus(R, r, nu, nv, region=(0, 0, 1, 1)):
    verts, faces, uvs = [], [], []
    for i in range(nu):
        a = TAU * i / nu
        for j in range(nv):
            b = TAU * j / nv
            verts.append(Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a),
                                 r * math.sin(b))))
    for i in range(nu):
        for j in range(nv):
            i1, j1 = (i + 1) % nu, (j + 1) % nv
            faces.append((i * nv + j, i1 * nv + j, i1 * nv + j1, i * nv + j1))
            uvs.append([(i / nu, j / nv), ((i + 1) / nu, j / nv), ((i + 1) / nu, (j + 1) / nv),
                        (i / nu, (j + 1) / nv)])
    return Part(verts, faces, uvs, region, "cyl")


def bm_part(bm, region=(0, 0, 1, 1), uvmode="box"):
    bm.verts.ensure_lookup_table()
    verts = [v.co.copy() for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    return Part(verts, faces, None, region, uvmode)


def build_object(name, parts, mat, sharp_deg=40.0, px_margin=5):
    verts, faces, uvs = [], [], []
    for p in parts:
        off = len(verts)
        verts += p.verts
        if p.uvmode in ("planar", "box"):
            xs = [v.x for v in p.verts]
            ys = [v.y for v in p.verts]
            zs = [v.z for v in p.verts]
            mn = Vector((min(xs), min(ys), min(zs)))
            ext = Vector((max(xs) - mn.x, max(ys) - mn.y, max(zs) - mn.z))
            big = max(ext) or 1
        m = px_margin / N
        u0, v0, u1, v1 = p.region
        u0, v0, u1, v1 = u0 + m, v0 + m, u1 - m, v1 - m
        for fi, f in enumerate(p.faces):
            faces.append(tuple(i + off for i in f))
            if p.uvmode == "cyl":
                fuv = p.uvs[fi]
            elif p.uvmode == "planar":
                fuv = [((p.verts[i].x - mn.x) / (ext.x or 1), (p.verts[i].y - mn.y) / (ext.y or 1)) for i in f]
            else:   # box: per face dominant axis
                vs = [p.verts[i] for i in f]
                nrm = (vs[1] - vs[0]).cross(vs[2] - vs[0])
                ax = max(range(3), key=lambda k: abs(nrm[k]))
                ka, kb = [(1, 2), (0, 2), (0, 1)][ax]
                fuv = [((v[ka] - mn[ka]) / big, (v[kb] - mn[kb]) / big) for v in vs]
            uvs.append([(u0 + a * (u1 - u0), v0 + b * (v1 - v0)) for a, b in fuv])
    me = bpy.data.meshes.get(name)
    if me:
        me.name = name + "_old"
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    li = 0
    for poly, fuv in zip(me.polygons, uvs):
        for k in range(poly.loop_total):
            uvl.data[poly.loop_start + k].uv = fuv[k]
        li += 1
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.validate()
    for poly in me.polygons:
        poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(sharp_deg))
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    return ob


# ============================================================ scene
def get_scene():
    if bpy.app.background:            # headless: work in the one context scene
        sc = bpy.context.scene
        sc.name = SCN
        return sc
    sc = bpy.data.scenes.get(SCN) or bpy.data.scenes.new(SCN)
    sc.unit_settings.system = "METRIC"
    for w in bpy.context.window_manager.windows:
        w.scene = sc
    return sc


def put(sc, ob, coll_name):
    coll = bpy.data.collections.get(coll_name)
    if not coll:
        coll = bpy.data.collections.new(coll_name)
        sc.collection.children.link(coll)
    coll.objects.link(ob)
    return ob


def clear_model(name):
    coll = bpy.data.collections.get("C_" + name)
    if coll:
        for o in list(coll.objects):
            me = o.data
            bpy.data.objects.remove(o)
            if me and me.users == 0:
                bpy.data.meshes.remove(me)
        bpy.data.collections.remove(coll)


# ============================================================ RUGS
RUGS = {
    # name: semi-axes, top height, wobble, seed, colours (inner, band, outer), band range
    "SM_Igloo_Rug_1": dict(a=1.0, b=1.0, top=0.045, blob=0.0, seed=11,
                           c=((0.86, 0.79, 0.65), (0.55, 0.36, 0.22), (0.79, 0.71, 0.57)), band=(0.70, 0.82)),
    "SM_Igloo_Rug_2": dict(a=1.3, b=0.85, top=0.05, blob=0.0, seed=23,
                           c=((0.60, 0.43, 0.29), (0.47, 0.31, 0.20), (0.37, 0.24, 0.15)), band=(0.30, 0.55)),
    "SM_Igloo_Rug_3": dict(a=0.95, b=0.80, top=0.04, blob=0.05, seed=37,
                           c=((0.62, 0.60, 0.57), (0.80, 0.74, 0.63), (0.52, 0.50, 0.48)), band=(0.62, 0.74)),
}


def rug_outline(a, b, blob, seed):
    ph = seed * 0.7

    def f(th):
        r = 1.0 / math.sqrt((math.cos(th) / a) ** 2 + (math.sin(th) / b) ** 2)
        r *= 1 + 0.02 * math.sin(7 * th + ph) + 0.008 * math.sin(10 * th + 2 * ph) \
            + blob * (math.sin(2 * th + ph) * 0.6 + math.sin(3 * th + 1.3 * ph) * 0.4)
        return r * math.cos(th), r * math.sin(th)
    return f


def rug_textures(name, d):
    n = N
    uu, vv = uvgrid()
    t = 2 * np.sqrt((uu - 0.5) ** 2 + (vv - 0.5) ** 2)          # 0 centre .. ~1 edge
    ang = np.arctan2(vv - 0.5, uu - 0.5)
    # radial strands: streak texture sampled in polar coords
    pol = fur_height(n, math.pi / 2, d["seed"])               # streaks along rows
    ri = np.clip((t * 0.5 * n).astype(int), 0, n - 1)
    ci = (((ang + math.pi) / TAU) * n).astype(int) % n
    h = pol[ri, ci] + 0.35 * blur_noise(n, 2.2, 2.2, 0, d["seed"] + 5)
    lo = blur_noise(n, 40, 40, 0, d["seed"] + 9)
    c0, c1, c2 = d["c"]
    b0, b1 = d["band"]
    band = smoothstep(b0 - 0.03, b0 + 0.03, t) * (1 - smoothstep(b1 - 0.03, b1 + 0.03, t))
    outer = smoothstep(b1 - 0.02, b1 + 0.04, t)
    rgb = col(c0)
    rgb = mix(rgb, col(c2), outer)
    rgb = mix(rgb, col(c1), band)
    rgb *= (0.9 + 0.045 * np.tanh(h * 0.8) + 0.04 * lo)[..., None]
    rgb *= (1 - 0.12 * smoothstep(0.9, 1.02, t))[..., None]     # soft edge shade
    base = make_image("T_" + name[3:] + "_BaseColor", rgb)
    nrm = make_image("T_" + name[3:] + "_Normal", normal_from_height(h, 0.45), data=True)
    return base, nrm


def build_rug(sc, name):
    d = RUGS[name]
    clear_model(name)
    top = d["top"]
    prof = [(0, top), (0.5, top - 0.002), (0.84, top - 0.004), (0.955, top - 0.01), (1.0, top * 0.5),
            (0.96, 0.0), (0, 0.0)]
    seed = d["seed"]

    def disp(co, th, i):
        if 0 < i < 4:   # gentle fur lumps on the top
            co.z += 0.004 * noise.noise(Vector((co.x * 3 + seed, co.y * 3, 0.5)))
        return co
    p = lathe(prof, 48, rug_outline(d["a"], d["b"], d["blob"], seed), disp, uvmode="planar")
    base, nrm = rug_textures(name, d)
    mat = make_mat("M_" + name[3:], base=base, nrm=nrm, rough=0.92, nrm_strength=0.8)
    ob = build_object(name, [p], mat, sharp_deg=180)
    return put(sc, ob, "C_" + name)


# ============================================================ SLEEP FURS
def slab(a, b, c, zc, seed, region, rot=0.0, off=(0, 0), droop=0.0):
    phis = [-90, -72, -38, 0, 38, 72, 90]
    prof = []
    for ph in phis:
        p = math.radians(ph)
        t = abs(math.cos(p)) ** 0.6 if abs(ph) != 90 else 0
        z = zc + c * sgnpow(math.sin(p), 0.6)
        prof.append((t, z))
    sp = seed * 1.3

    def outline(th):
        x = a * sgnpow(math.cos(th), 0.72)
        y = b * sgnpow(math.sin(th), 0.72)
        k = 1 + 0.022 * math.sin(5 * th + sp) + 0.008 * math.sin(8 * th + 2 * sp)
        return x * k, y * k

    def disp(co, th, i):
        nz = noise.noise(Vector((co.x * 1.6 + sp, co.y * 1.6, co.z * 2)))
        if 0 < i < len(phis) - 1:
            s = 1 + 0.02 * nz
            co.x *= s
            co.y *= s
        if co.z > zc:
            co.z += 0.018 * nz
        if droop and i in (1, 2, 3):      # soft edge sags over the fur below
            co.z -= droop * (0.6 if i == 1 else 1.0)
        co.z = max(co.z, 0.0)
        return co
    p = lathe(prof, 36, outline, disp, region, "planar")
    return p.transform(Matrix.Translation((off[0], off[1], 0)) @ Matrix.Rotation(rot, 4, "Z"))


def sleep_textures():
    uu, vv = uvgrid()
    h = fur_height(N, 0.0, 51)
    lo = blur_noise(N, 36, 36, 0, 57)
    fu, fv = (uu * 2) % 1, (vv * 2) % 1                 # local coords inside each quarter
    q = (uu >= 0.5).astype(int) + 2 * (vv >= 0.5).astype(int)
    tq = np.maximum(np.abs(fu - 0.5), np.abs(fv - 0.5)) * 2
    cols = [(0.44, 0.29, 0.19), (0.85, 0.78, 0.65), (0.69, 0.66, 0.62), (0.84, 0.76, 0.62)]
    edge = [(0.34, 0.22, 0.14), (0.76, 0.68, 0.55), (0.58, 0.55, 0.52), (0.84, 0.76, 0.62)]
    rgb = np.zeros((N, N, 3))
    for k in range(4):
        m = q == k
        c = mix(col(cols[k]), col(edge[k]), smoothstep(0.6, 0.95, tq))
        rgb[m] = c[m]
    # pillow (quarter 3): warm brown stripes around the roll
    stripe = smoothstep(0.42, 0.47, fv) * (1 - smoothstep(0.53, 0.58, fv)) + \
        smoothstep(0.16, 0.2, fv) * (1 - smoothstep(0.24, 0.28, fv)) + \
        smoothstep(0.72, 0.76, fv) * (1 - smoothstep(0.80, 0.84, fv))
    p3 = mix(rgb, col((0.52, 0.34, 0.21)), stripe)
    rgb[q == 3] = p3[q == 3]
    rgb *= (0.9 + 0.045 * np.tanh(h * 0.8) + 0.04 * lo)[..., None]
    base = make_image("T_Igloo_SleepFurs_BaseColor", rgb)
    nrm = make_image("T_Igloo_SleepFurs_Normal", normal_from_height(h, 0.45), data=True)
    return base, nrm


def build_sleepfurs(sc):
    name = "SM_Igloo_SleepFurs"
    clear_model(name)
    parts = [
        slab(1.0, 0.6, 0.07, 0.07, 1, (0, 0, 0.5, 0.5)),
        slab(0.95, 0.565, 0.065, 0.18, 2, (0.5, 0, 1, 0.5), rot=math.radians(3.5), off=(0.03, 0.01),
             droop=0.025),
        slab(0.88, 0.52, 0.06, 0.28, 3, (0, 0.5, 0.5, 1), rot=math.radians(-2.5), off=(0.05, -0.01),
             droop=0.03),
    ]
    # rolled fur pillow across the head end (Blender +X end), lying along Y
    pr = [(0, -0.42), (0.05, -0.415), (0.078, -0.39), (0.085, -0.3), (0.088, 0.0), (0.085, 0.3),
          (0.078, 0.39), (0.05, 0.415), (0, 0.42)]
    pil = lathe(pr, 14, region=(0.5, 0.5, 1, 1))
    pil.transform(Matrix.Translation((0.64, 0.0, 0.39)) @ Matrix.Rotation(math.radians(-90), 4, "X"))
    parts.append(pil)
    base, nrm = sleep_textures()
    mat = make_mat("M_Igloo_SleepFurs", base=base, nrm=nrm, rough=0.92, nrm_strength=0.8)
    ob = build_object(name, parts, mat, sharp_deg=180)
    return put(sc, ob, "C_" + name)


# ============================================================ TABLE
def wood(uu, vv, along_u, seed, base=(0.60, 0.38, 0.21), dark=(0.45, 0.27, 0.14)):
    w = blur_noise(N, 30, 6, 0 if along_u else math.pi / 2, seed)
    x = vv if along_u else uu
    g = np.sin((x * 14 + 0.12 * w) * TAU) * 0.5 + 0.5
    g = g ** 4
    fine = blur_noise(N, 14, 0.8, 0 if along_u else math.pi / 2, seed + 1)
    rgb = mix(col(base), col(dark), 0.3 * g + 0.07 * np.tanh(fine) + 0.08 * np.tanh(w * 0.5))
    return rgb, 0.6 * g + 0.15 * fine


def build_table(sc):
    name = "SM_Igloo_Table"
    clear_model(name)
    a, b, p = 0.7, 0.4, 0.5

    def outline(th):
        return a * sgnpow(math.cos(th), p), b * sgnpow(math.sin(th), p)
    zt, zb = 0.45, 0.38
    prof = [(0, zt), (0.93, zt), (0.975, zt - 0.006), (1.0, (zt + zb) / 2 + 0.008), (0.98, zb + 0.006),
            (0.94, zb), (0, zb)]
    top = lathe(prof, 40, outline, region=(0, 0, 1, 0.5), uvmode="planar")
    parts = [top]
    leg = [(0, 0), (0.042, 0), (0.05, 0.012), (0.054, 0.2), (0.058, zb + 0.012), (0, zb + 0.012)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            lp = lathe(leg, 12, region=(0, 0.5, 1, 1))
            lp.transform(Matrix.Translation((sx * 0.5, sy * 0.24, 0)))
            parts.append(lp)
    uu, vv = uvgrid()
    r1, h1 = wood(uu, vv, True, 61)
    r2, h2 = wood(uu, vv, False, 67)
    top_m = (vv < 0.5)[..., None]
    rgb = np.where(top_m, r1, r2)
    h = np.where(top_m[..., 0], h1, h2)
    base = make_image("T_Igloo_Table_BaseColor", rgb)
    nrm = make_image("T_Igloo_Table_Normal", normal_from_height(h, 0.35), data=True)
    mat = make_mat("M_Igloo_Table", base=base, nrm=nrm, rough=0.6)
    ob = build_object(name, parts, mat)
    return put(sc, ob, "C_" + name)


# ============================================================ POTS
def build_pots(sc):
    name = "SM_Igloo_Pots"
    clear_model(name)
    # metal cooking pot with lid (region left half)
    pot = [(0, 0), (0.15, 0), (0.195, 0.012), (0.22, 0.06), (0.226, 0.14), (0.215, 0.225), (0.222, 0.248),
           (0.2, 0.262), (0.16, 0.29), (0.08, 0.312), (0.03, 0.318), (0.032, 0.335), (0.045, 0.352),
           (0.03, 0.368), (0, 0.37)]
    pp = lathe(pot, 18, region=(0, 0, 0.5, 1))
    parts = [pp]
    for s in (-1, 1):   # side loop handles, in the radial vertical plane
        hd = torus(0.042, 0.011, 10, 5, region=(0, 0, 0.5, 1))
        hd.transform(Matrix.Translation((s * 0.238, 0, 0.2)) @ Matrix.Rotation(math.radians(90), 4, "X"))
        parts.append(hd)
    # clay jar with a wooden-coloured stopper (region right-bottom)
    jar = [(0, 0), (0.085, 0), (0.115, 0.02), (0.148, 0.12), (0.143, 0.22), (0.1, 0.3), (0.064, 0.33),
           (0.07, 0.355), (0.058, 0.366), (0.05, 0.39), (0, 0.395)]
    jp = lathe(jar, 16, region=(0.5, 0, 1, 0.5))
    d = 0.226 + 0.148 - 0.014
    a = math.radians(-35)
    jp.transform(Matrix.Translation((d * math.cos(a), d * math.sin(a), 0)))
    parts.append(jp)
    # small clay bowl (region right-top)
    bowl = [(0, 0), (0.06, 0), (0.09, 0.014), (0.12, 0.058), (0.131, 0.09), (0.12, 0.096), (0.104, 0.062),
            (0.07, 0.034), (0, 0.028)]
    bp = lathe(bowl, 16, region=(0.5, 0.5, 1, 1))
    d2 = 0.226 + 0.131 - 0.016    # bowl rim (z .09) touches the pot belly
    a2 = math.radians(150)
    bp.transform(Matrix.Translation((d2 * math.cos(a2), d2 * math.sin(a2), 0)))
    parts.append(bp)
    # recentre on the footprint
    allv = [v for p in parts for v in p.verts]
    cx = (min(v.x for v in allv) + max(v.x for v in allv)) / 2
    cy = (min(v.y for v in allv) + max(v.y for v in allv)) / 2
    for p in parts:
        p.transform(Matrix.Translation((-cx, -cy, 0)))
    uu, vv = uvgrid()
    lo = blur_noise(N, 24, 24, 0, 71)
    rgb = np.zeros((N, N, 3))
    mr = np.zeros((N, N, 3))
    left = uu < 0.5
    # metal pot: warm copper, darker at the base, lid a touch lighter
    lv = vv
    metal = mix(col((0.62, 0.36, 0.22)), col((0.40, 0.24, 0.15)), 1 - smoothstep(0.02, 0.25, lv))
    metal = mix(metal, col((0.70, 0.45, 0.28)), smoothstep(0.62, 0.66, lv))
    metal *= (0.95 + 0.04 * lo)[..., None]
    rgb[left] = metal[left]
    mr[left] = (0, 0.38, 1.0)
    # jar: terracotta with two cream bands and a wood stopper
    jr = vv < 0.5
    fv = vv * 2
    jar_c = col((0.72, 0.41, 0.25))
    band = smoothstep(0.50, 0.52, fv) * (1 - smoothstep(0.56, 0.58, fv)) + \
        smoothstep(0.62, 0.635, fv) * (1 - smoothstep(0.665, 0.68, fv))
    jar_c = mix(jar_c, col((0.87, 0.76, 0.58)), band)
    jar_c = mix(jar_c, col((0.52, 0.35, 0.2)), smoothstep(0.86, 0.88, fv))
    jar_c *= (0.95 + 0.04 * lo)[..., None]
    m = (~left) & jr
    rgb[m] = jar_c[m]
    mr[m] = (0, 0.72, 0)
    # bowl: ochre glaze outside, lighter cream glaze inside
    fv2 = (vv - 0.5) * 2
    bowl_c = mix(col((0.80, 0.56, 0.30)), col((0.90, 0.75, 0.52)), smoothstep(0.62, 0.66, fv2))
    bowl_c *= (0.96 + 0.03 * lo)[..., None]
    m = (~left) & (~jr)
    rgb[m] = bowl_c[m]
    mr[m] = (0, 0.5, 0)
    base = make_image("T_Igloo_Pots_BaseColor", rgb)
    mrimg = make_image("T_Igloo_Pots_MetalRough", mr, data=True)
    mat = make_mat("M_Igloo_Pots", base=base, mr=mrimg)
    ob = build_object(name, parts, mat, sharp_deg=50)
    return put(sc, ob, "C_" + name)


# ============================================================ SHELF
SHELF_DEPTH = 0.5
SHELF_DC = RW - SHELF_DEPTH / 2          # origin -> dome centre distance


def shelf_warp(u, v, h):
    """unrolled (u along wall, v inward from wall, h up) -> shelf-local Blender coords."""
    th = u / RW
    r = math.sqrt(max(RW * RW - h * h, 0)) - v
    return Vector((r * math.sin(th), r * math.cos(th) - SHELF_DC, h))


def snow_block(u0, u1, v1, h0, h1, cuts, bevel, seed):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((v.co.x + 0.5) * (u1 - u0) + u0, (v.co.y + 0.5) * v1, (v.co.z + 0.5) * (h1 - h0) + h0))
    for k in range(1, cuts + 1):
        x = u0 + (u1 - u0) * k / (cuts + 1)
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    edges = [e for e in bm.edges if e.calc_face_angle(0) > math.radians(30)]
    bmesh.ops.bevel(bm, geom=edges, offset=bevel, offset_type="OFFSET", segments=2, profile=0.5,
                    affect="EDGES", clamp_overlap=True)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    for v in bm.verts:
        u, vv, h = v.co
        co = shelf_warp(u, vv, h)
        if vv > 0.01 and h > 0.01:   # soft hand-carved wobble, back and floor stay exact
            nz = noise.noise(Vector((u * 2.3 + seed, vv * 2.3, h * 2.3)))
            co += Vector((0, 0, 0.006 * nz)) if h > h1 - 0.01 else Vector((0, -0.008 * nz, 0))
        v.co = co
    return bm


def build_shelf(sc):
    name = "SM_Igloo_Shelf"
    clear_model(name)
    snow_r = (0, 0, 1, 0.5)
    lower = bm_part(snow_block(-1.0, 1.0, SHELF_DEPTH, 0.0, 0.6, 8, 0.06, 3), snow_r)
    upper = bm_part(snow_block(-0.72, 0.72, 0.3, 0.5, 1.15, 6, 0.05, 7), snow_r)
    # snow uv: one shared box projection over both blocks
    allv = lower.verts + upper.verts
    lower.uvmode = upper.uvmode = None
    snow = Part(allv, lower.faces + [tuple(i + len(lower.verts) for i in f) for f in upper.faces],
                None, snow_r, "box")
    parts = [snow]
    sink = 0.01

    def place(p, u, v, h):
        c = shelf_warp(u, v, h)
        return p.transform(Matrix.Translation((c.x, c.y, h - sink)))
    jarA = [(0, 0), (0.05, 0), (0.068, 0.02), (0.075, 0.09), (0.062, 0.16), (0.04, 0.18), (0.044, 0.2),
            (0.03, 0.205), (0, 0.205)]
    jarB = [(0, 0), (0.055, 0), (0.07, 0.015), (0.08, 0.06), (0.074, 0.11), (0.05, 0.13), (0.054, 0.145),
            (0.04, 0.15), (0, 0.15)]
    parts.append(place(lathe(jarA, 14, region=(0, 0.5, 0.5, 0.75)), -0.55, 0.4, 0.6))
    parts.append(place(lathe(jarB, 14, region=(0.5, 0.5, 1, 0.75)), 0.35, 0.4, 0.6))
    parts.append(place(lathe(jarA, 14, region=(0, 0.5, 0.5, 0.75)).transform(Matrix.Scale(0.85, 4)),
                       0.42, 0.15, 1.15))
    bowl = [(0, 0), (0.05, 0), (0.085, 0.012), (0.118, 0.05), (0.128, 0.075), (0.117, 0.08), (0.1, 0.05),
            (0.06, 0.026), (0, 0.022)]
    parts.append(place(lathe(bowl, 16, region=(0, 0.75, 1, 1)), -0.3, 0.15, 1.15))
    uu, vv = uvgrid()
    lo = blur_noise(N, 30, 30, 0, 81)
    fine = blur_noise(N, 3, 3, 0, 83)
    rgb = np.zeros((N, N, 3))
    mr = np.zeros((N, N, 3))
    hgt = np.zeros((N, N))
    snow_m = vv < 0.5
    sn = mix(col((0.88, 0.91, 0.95)), col((0.80, 0.86, 0.94)), 0.5 + 0.35 * lo)
    rgb[snow_m] = sn[snow_m]
    mr[snow_m] = (0, 0.85, 0)
    hgt[snow_m] = (0.6 * lo + 0.25 * fine)[snow_m]
    jm = (vv >= 0.5) & (vv < 0.75)
    terr = col((0.72, 0.42, 0.26))
    honey = col((0.82, 0.60, 0.31))
    fv = (vv - 0.5) * 4
    lid = smoothstep(0.84, 0.87, fv)
    terr = mix(terr, col((0.86, 0.76, 0.58)), smoothstep(0.55, 0.57, fv) * (1 - smoothstep(0.62, 0.64, fv)))
    honey = mix(honey, col((0.55, 0.37, 0.22)), lid)
    ja = jm & (uu < 0.5)
    jb = jm & (uu >= 0.5)
    rgb[ja] = terr[ja]
    mr[ja] = (0, 0.7, 0)
    rgb[jb] = honey[jb]
    mr[jb] = (0, 0.42, 0)
    wm = vv >= 0.75
    wr, wh = wood(uu, vv, False, 89, base=(0.58, 0.37, 0.20))
    rgb[wm] = wr[wm]
    mr[wm] = (0, 0.6, 0)
    hgt[wm] = 0.5 * wh[wm]
    base = make_image("T_Igloo_Shelf_BaseColor", rgb)
    mrimg = make_image("T_Igloo_Shelf_MetalRough", mr, data=True)
    nrm = make_image("T_Igloo_Shelf_Normal", normal_from_height(hgt, 0.5), data=True)
    mat = make_mat("M_Igloo_Shelf", base=base, nrm=nrm, mr=mrimg)
    ob = build_object(name, parts, mat, sharp_deg=50)
    return put(sc, ob, "C_" + name)


# ============================================================ LANTERN
def build_lantern(sc):
    name = "SM_Igloo_Lantern"
    clear_model(name)
    ring = torus(0.033, 0.0075, 10, 5)
    ring.transform(Matrix.Translation((0, 0, -0.0405)) @ Matrix.Rotation(math.radians(90), 4, "X"))
    cap = lathe([(0, -0.07), (0.026, -0.074), (0.032, -0.09), (0.075, -0.125), (0.118, -0.16),
                 (0.112, -0.18), (0, -0.182)], 16)
    base = lathe([(0, -0.4), (0.112, -0.4), (0.122, -0.418), (0.105, -0.445), (0.06, -0.47), (0.02, -0.497),
                  (0, -0.5)], 16)
    parts = [ring, cap, base]
    for k in range(4):
        a = math.radians(45 + 90 * k)
        bar = lathe([(0, -0.185), (0.009, -0.185), (0.009, -0.405), (0, -0.405)], 6)
        bar.transform(Matrix.Translation((0.1 * math.cos(a), 0.1 * math.sin(a), 0)))
        parts.append(bar)
    frame_mat = make_mat("M_Igloo_Lantern", rough=0.4, metal=0.85, base_rgb=(0.42, 0.27, 0.15))
    ob = build_object(name, parts, frame_mat)
    put(sc, ob, "C_" + name)
    gl = lathe([(0, -0.168), (0.066, -0.172), (0.088, -0.19), (0.095, -0.24), (0.095, -0.35), (0.088, -0.395),
                (0.066, -0.41), (0, -0.412)], 16)
    gmat = make_mat("glow", rough=0.3, base_rgb=(1.0, 0.82, 0.55), emis=(1.0, 0.6, 0.25), emis_strength=2.5)
    g = build_object("glow", [gl], gmat, sharp_deg=60)
    put(sc, g, "C_" + name)
    g.parent = ob
    return ob


# ============================================================ export
MODELS = ["SM_Igloo_Rug_1", "SM_Igloo_Rug_2", "SM_Igloo_Rug_3", "SM_Igloo_SleepFurs", "SM_Igloo_Table",
          "SM_Igloo_Pots", "SM_Igloo_Shelf", "SM_Igloo_Lantern"]


def build_all():
    sc = get_scene()
    out = {}
    for n in MODELS[:3]:
        out[n] = build_rug(sc, n)
    out["SM_Igloo_SleepFurs"] = build_sleepfurs(sc)
    out["SM_Igloo_Table"] = build_table(sc)
    out["SM_Igloo_Pots"] = build_pots(sc)
    out["SM_Igloo_Shelf"] = build_shelf(sc)
    out["SM_Igloo_Lantern"] = build_lantern(sc)
    # spread the models out in the build scene for viewing (exports reset to origin)
    return out


def export_model(name, path=None):
    sc = get_scene()
    ob = bpy.data.objects[name]
    obs = [ob] + list(ob.children_recursive)
    vl = sc.view_layers[0]
    for o in sc.objects:
        o.select_set(False, view_layer=vl)
    for o in obs:
        o.hide_set(False, view_layer=vl)
        o.select_set(True, view_layer=vl)
    vl.objects.active = ob
    path = path or os.path.join(ROOT, name + ".glb")
    with bpy.context.temp_override(scene=sc, view_layer=vl):
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                                  export_apply=True, export_image_format="JPEG", export_jpeg_quality=85,
                                  export_cameras=False, export_lights=False, export_extras=False,
                                  export_draco_mesh_compression_enable=False,
                                  export_meshopt_compression_enable=False, export_materials="EXPORT",
                                  export_texcoords=True, export_normals=True, export_tangents=False)
    return path


def glb_info(path):
    """nodes, triangle count per mesh, image types and position bounds read back from a GLB."""
    import json as _j
    import struct
    with open(path, "rb") as f:
        data = f.read()
    ln = struct.unpack_from("<I", data, 12)[0]
    js = _j.loads(data[20:20 + ln])
    acc = js["accessors"]
    meshes = {}
    lo, hi = [1e9] * 3, [-1e9] * 3
    for m in js["meshes"]:
        t = 0
        for pr in m["primitives"]:
            t += acc[pr["indices"]]["count"] // 3
            pa = acc[pr["attributes"]["POSITION"]]
            lo = [min(a, b) for a, b in zip(lo, pa["min"])]
            hi = [max(a, b) for a, b in zip(hi, pa["max"])]
        meshes[m["name"]] = t
    return {"nodes": [(n.get("name"), n.get("children", []), n.get("translation"), n.get("rotation"), n.get("scale"))
                      for n in js["nodes"]],
            "tris": meshes, "images": [i.get("mimeType") for i in js.get("images", [])],
            "materials": [m["name"] for m in js.get("materials", [])],
            "ext": js.get("extensionsUsed", []), "bounds": [lo, hi],
            "extra": [k for k in ("cameras", "lights", "animations", "skins") if k in js]}


if __name__ == "__main__":
    build_all()
    for m in MODELS:
        export_model(m)
