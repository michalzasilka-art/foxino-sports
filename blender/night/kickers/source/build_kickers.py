"""FoxSports snowboard kickers (night job N10).

Builds SM_Kicker, SM_TableTop, SM_GapJump, SM_StepUp, SM_BigAir as packed-snow bodies with
a groomed-snow (corduroy) PBR texture set, and a child "Lip" strip at the take-off edge.

Run headless:
  blender -b --factory-startup -P build_kickers.py -- <out_dir> [--tex-only]

Game axes (glTF): +Y up, +Z downhill. Blender build: (x, -z_game, y_game).
Riding surface (|x| <= w/2), along game z:
  ramp   0 .. len                : y = lip * (z/len)^1.7
  table  len .. len+0.35+table   : y = lip
  back   .. +back (linear)       : y = lip * (1 - (z - zt1)/back)
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(ARGS[0]) if ARGS else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(OUT, "source", "textures")
QA_DIR = r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts"

PAD = 0.35          # flat pad after the lip (part of the game profile)
LIP_DEPTH = 0.12    # Lip strip depth along z, ending at the take-off edge
TILE = 2.0          # metres per texture tile
RIDGES = 48         # corduroy ridges per tile (~4.2 cm)

MODELS = [
    # name, len, lip, w, table, back, budget, riding segs, shoulder segs, chord tol, max ring gap
    ("SM_Kicker",   dict(len=4.0,  lip=1.0,  w=3.6, table=0.0, back=1.4), 1500, 6, 10, 0.001, 0.35),
    ("SM_TableTop", dict(len=4.5,  lip=1.3,  w=5.0, table=6.0, back=1.8), 1500, 6, 10, 0.001, 0.4),
    ("SM_GapJump",  dict(len=5.0,  lip=1.5,  w=4.4, table=0.0, back=1.6), 1500, 6, 10, 0.001, 0.4),
    ("SM_StepUp",   dict(len=4.0,  lip=1.15, w=4.0, table=0.0, back=1.4), 1500, 6, 10, 0.001, 0.35),
    ("SM_BigAir",   dict(len=12.0, lip=4.6,  w=9.0, table=0.0, back=5.0), 4000, 10, 16, 0.001, 0.45),
]


# ----------------------------------------------------------------------------- profile
def zones(P):
    L = P["len"]
    zt1 = L + PAD + P["table"]
    ze = zt1 + P["back"]
    return L, zt1, ze


def prof(z, P):
    L, zt1, ze = zones(P)
    if z <= L:
        return P["lip"] * (max(z, 0.0) / L) ** 1.7
    if z <= zt1:
        return P["lip"]
    return P["lip"] * max(0.0, 1.0 - (z - zt1) / P["back"])


def chord_err(z0, z1, P):
    h0, h1 = prof(z0, P), prof(z1, P)
    e = 0.0
    for i in range(1, 24):
        z = z0 + (z1 - z0) * i / 24
        e = max(e, abs(prof(z, P) - (h0 + (h1 - h0) * i / 24)))
    return e


def rings_z(P, tol, gap):
    L, zt1, ze = zones(P)
    z0 = L - LIP_DEPTH
    ramp = [0.0, z0, L]

    def refine(a, b):
        if chord_err(a, b, P) > tol or (b - a) > gap:
            m = 0.5 * (a + b)
            return refine(a, m) + [m] + refine(m, b)
        return []
    zs = []
    for a, b in zip(ramp[:-1], ramp[1:]):
        zs += [a] + refine(a, b)
    zs.append(L)
    # table (incl. the 0.35 pad): straight, a ring every <= 2 m for texture/lighting
    n = max(1, math.ceil((zt1 - L) / 2.0))
    zs += [L + (zt1 - L) * i / n for i in range(1, n + 1)]
    # back slope: straight line, a ring every <= 2.5 m
    n = max(1, math.ceil((ze - zt1) / 2.5))
    zs += [zt1 + (ze - zt1) * i / n for i in range(1, n + 1)]
    return zs, z0, L


# ----------------------------------------------------------------------------- section
def bez(t, a=0.32, b=0.5):
    """Normalised shoulder: (0,1) -> (1,0); horizontal tangent at the top (rounded edge)
    and at the foot (the flared snow wing)."""
    mt = 1 - t
    x = 3 * mt * mt * t * a + 3 * mt * t * t * (1 - b) + t ** 3
    y = mt ** 3 + 3 * mt * mt * t
    return x, y


def spread(h):
    return 0.25 + 0.75 * h


def ring(h, w, nr, ns):
    s = spread(h)
    pts = []
    for j in range(ns, 0, -1):
        bx_, by_ = bez(j / ns)
        pts.append((-(w / 2 + s * bx_), h * by_))
    for k in range(nr + 1):
        pts.append((-w / 2 + w * k / nr, h))
    for j in range(1, ns + 1):
        bx_, by_ = bez(j / ns)
        pts.append((w / 2 + s * bx_, h * by_))
    return pts


# ----------------------------------------------------------------------------- textures
def periodic_noise(n, beta, seed):
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((n, n)))
    fx = np.fft.fftfreq(n)[None, :]
    fy = np.fft.fftfreq(n)[:, None]
    r = np.sqrt(fx * fx + fy * fy)
    r[0, 0] = 1.0
    f *= 1.0 / r ** beta
    f[0, 0] = 0
    a = np.real(np.fft.ifft2(f))
    a -= a.min()
    return a / a.max()


def height_field(n):
    v, u = np.mgrid[0:n, 0:n] / n                    # rows = v (bottom up), cols = u
    wob = (0.10 * np.sin(2 * np.pi * (2 * v + 0.3)) + 0.05 * np.sin(2 * np.pi * (5 * v + 0.7))
           + 0.6 * (periodic_noise(n, 2.2, 7) - 0.5))
    ph = u * RIDGES + wob
    ridge = np.abs(np.sin(np.pi * ph)) ** 0.55       # broad rounded ridges, narrow grooves
    amp = 0.75 + 0.5 * periodic_noise(n, 2.0, 11)    # pass-to-pass variation
    low = periodic_noise(n, 1.8, 3)
    grain = periodic_noise(n, 0.9, 5)
    return ridge * amp, low, grain


def save_jpeg(name, rgb, path):
    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=False)
    rgba = np.concatenate([rgb, np.ones(rgb.shape[:2] + (1,))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = "JPEG"
    img.filepath_raw = path
    img.save(filepath=path, quality=85)
    bpy.data.images.remove(img)


def make_textures():
    os.makedirs(TEX_DIR, exist_ok=True)
    paths = {k: os.path.join(TEX_DIR, f"T_SnowGroomed_{k}.jpg") for k in ("BaseColor", "Normal", "ORM")}
    # normal (1024, OpenGL +Y as glTF wants)
    n = 1024
    r, low, grain = height_field(n)
    H = 0.55 * r + 0.30 * low + 0.10 * grain
    k = 7.0
    du = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) * 0.5 * n / RIDGES / 6.0
    dv = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) * 0.5 * n / RIDGES / 6.0
    nx, ny, nz = -du * k, -dv * k, np.ones_like(H)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    save_jpeg("nrm", np.stack([nx / ln, ny / ln, nz / ln], 2) * 0.5 + 0.5, paths["Normal"])
    # base colour + ORM (512)
    n = 512
    r, low, grain = height_field(n)
    shade = 0.935 + 0.05 * r + 0.03 * (low - 0.5) + 0.015 * (grain - 0.5)
    base = np.array([0.885, 0.925, 0.975])           # cool white snow (sRGB), never pure white
    groove = np.array([0.80, 0.86, 0.95])            # faint blue in the grooves
    t = (1 - r)[..., None] ** 2
    col = (base * (1 - t) + groove * t) * shade[..., None]
    save_jpeg("col", np.clip(col, 0, 0.98), paths["BaseColor"])
    rough = 0.85 + 0.04 * (low - 0.5) + 0.03 * (1 - r) - 0.02 * (grain - 0.5)
    ao = 0.88 + 0.12 * r
    save_jpeg("orm", np.stack([ao, rough, np.zeros_like(r)], 2), paths["ORM"])
    return paths


def snow_material(paths):
    m = bpy.data.materials.new("M_SnowGroomed")
    m.use_nodes = True
    m.use_backface_culling = True
    nt = m.node_tree
    bsdf = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")

    def tex(key, x, y, data):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(paths[key], check_existing=True)
        t.image.colorspace_settings.is_data = data
        t.location = (x, y)
        return t
    c = tex("BaseColor", -700, 300, False)
    nt.links.new(c.outputs["Color"], bsdf.inputs["Base Color"])
    o = tex("ORM", -700, 0, True)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    sep.location = (-400, 0)
    nt.links.new(o.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    nm = tex("Normal", -700, -300, True)
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.location = (-400, -300)
    nmap.inputs["Strength"].default_value = 1.0
    nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def lip_material():
    m = bpy.data.materials.new("Lip")
    m.use_nodes = True
    m.use_backface_culling = True
    bsdf = next(nd for nd in m.node_tree.nodes if nd.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.62, 0.05, 0.05, 1.0)   # festive red, game recolours it
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (0.62, 0.05, 0.05, 1.0)
    return m


# ----------------------------------------------------------------------------- mesh
def to_bl(x, y, z):
    return (x, -z, y)


def build(name, P, nr, ns, tol, gap, mat_snow, mat_lip):
    zs, zlip0, zlip1 = rings_z(P, tol, gap)
    w = P["w"]
    hs = [prof(z, P) for z in zs]
    secs = [ring(h, w, nr, ns) for h in hs]
    ncol = len(secs[0])
    # centreline arc length along z (v) and per-ring section arc (u)
    S = [0.0]
    for i in range(1, len(zs)):
        S.append(S[-1] + math.hypot(zs[i] - zs[i - 1], hs[i] - hs[i - 1]))
    mid = ns + nr // 2

    def sec_arc(pts):
        a = [0.0] * len(pts)
        for c in range(mid + 1, len(pts)):
            a[c] = a[c - 1] + math.dist(pts[c], pts[c - 1])
        for c in range(mid - 1, -1, -1):
            a[c] = a[c + 1] - math.dist(pts[c], pts[c + 1])
        return a
    arcs = [sec_arc(p) for p in secs]

    i0, i1 = zs.index(zlip0), zs.index(zlip1)
    ride = range(ns, ns + nr)                       # riding quad columns

    def make(mesh_name, sel):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        vmap = {}

        def V(i, c):
            if (i, c) not in vmap:
                x, y = secs[i][c]
                vmap[(i, c)] = bm.verts.new(to_bl(x, y, zs[i]))
            return vmap[(i, c)]
        for i in range(len(zs) - 1):
            for c in range(ncol - 1):
                if not sel(i, c):
                    continue
                q = [(i, c), (i + 1, c), (i + 1, c + 1), (i, c + 1)]   # wound so normals point up
                f = bm.faces.new([V(*k) for k in q])
                f.smooth = True
                for lp, (ii, cc) in zip(f.loops, q):
                    lp[uvl].uv = (arcs[ii][cc] / TILE, S[ii] / TILE)
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        for f in bm.faces:
            if f.normal.z < -1e-6:
                raise RuntimeError(f"{mesh_name}: downward face")
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle() > math.radians(35):
                e.smooth = False
        me = bpy.data.meshes.new(mesh_name)
        bm.to_mesh(me)
        bm.free()
        return me

    in_lip = lambda i, c: i0 <= i < i1 and c in ride
    me_body = make(name, lambda i, c: not in_lip(i, c))
    me_lip = make("Lip", in_lip)
    me_body.materials.append(mat_snow)
    me_lip.materials.append(mat_lip)
    body = bpy.data.objects.new(name, me_body)
    lip = bpy.data.objects.new("Lip", me_lip)
    bpy.context.scene.collection.objects.link(body)
    bpy.context.scene.collection.objects.link(lip)
    lip.parent = body
    return body, lip, len(zs)


def main():
    tex_only = "--tex-only" in ARGS
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    paths = make_textures()
    if tex_only:
        return
    mat_snow, mat_lip = snow_material(paths), lip_material()
    sys.path.insert(0, QA_DIR)
    import qa_check
    report = {}
    for name, P, budget, nr, ns, tol, gap in MODELS:
        body, lip, nrings = build(name, P, nr, ns, tol, gap, mat_snow, mat_lip)
        qa = qa_check.run(objects=[body.name, lip.name], profile="game")
        tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (body, lip)}
        report[name] = dict(rings=nrings, tris=tris, total=sum(tris.values()), budget=budget,
                            qa_pass=qa["pass"], qa_errors=qa["errors"], qa_warnings=qa["warnings"],
                            dims=[round(d, 3) for d in body.dimensions])
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        lip.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", use_selection=True,
            export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
            export_image_format="JPEG", export_jpeg_quality=85, export_materials="EXPORT",
            export_draco_mesh_compression_enable=False, export_animations=False,
            export_extras=False, export_tangents=False)
        for o in (lip, body):
            me = o.data
            bpy.data.objects.remove(o)
            bpy.data.meshes.remove(me)
    tmp = os.environ.get("KICKER_TMP", os.path.join(OUT, "source"))
    with open(os.path.join(tmp, "build_report.json"), "w") as f:
        json.dump(report, f, indent=1)
    print("BUILD_REPORT", json.dumps(report))


main()
