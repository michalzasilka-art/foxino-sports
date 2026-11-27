"""Ice cave W2b, lane B: floor rocks along the wall base (SM_Rock_Edge_1..3) and free-standing
boulders (SM_Boulder_1..2).

Reuses ib_formations.py (same folder) for the low-poly, UV, bake and GLB export pipeline:
    ns = {}; exec(open(PATH).read(), ns); ns["build_all"](out_dir, tex_dir)
Each model: displaced icosphere + soft weathering planes (+ a flat-ish back facing Blender -X for the
edge rocks) -> voxel remesh + smooth (rounded, friendly) -> carved cracks -> cut at the floor ->
Decimate to budget -> Smart UV -> Cycles bake (base colour with crevice AO and a thin ice glaze on
top, roughness, tangent normal) -> one PBR material, no emission -> GLB (+Y up, JPEG q85, 512).
Blender (x, y, z) -> glTF (x, z, -y): the back stays on -X, long axis along the cave (glTF Z).
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector, noise

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.environ.get("IB_SRC", "")
F = {}
exec(open(os.path.join(_HERE, "ib_formations.py")).read(), F)
F["SCN"] = "IceCave_W2b_B"
srgb, fbm, smoothstep = F["srgb"], F["fbm"], F["smoothstep"]

ROCK_D = "38332f"
ROCK_M = "524a44"
ROCK_L = "6b635c"
ROCK_CRACK = "2b2522"
GLAZE = "8fbcd6"
FROST = "c9dfea"

JOBS = {
    # L = length along the wall (Blender Y), D = depth from the wall (Blender X), H = height
    "SM_Rock_Edge_1": dict(seed=301, L=1.40, D=0.74, H=0.78, back=True, planes=5, cracks=3, budget=400, glaze=0.55),
    "SM_Rock_Edge_2": dict(seed=302, L=1.00, D=0.58, H=0.62, back=True, planes=5, cracks=2, budget=400, glaze=0.45),
    "SM_Rock_Edge_3": dict(seed=303, L=0.62, D=0.40, H=0.44, back=True, planes=3, cracks=2, budget=400, glaze=0.35),
    "SM_Boulder_1": dict(seed=401, L=2.04, D=1.70, H=1.50, back=False, planes=6, cracks=4, budget=600, glaze=0.6),
    "SM_Boulder_2": dict(seed=402, L=1.70, D=1.30, H=1.28, back=False, planes=6, cracks=3, budget=600, glaze=0.5),
}


def src_floorrock(name, j):
    rnd = random.Random(j["seed"])
    off = Vector((rnd.uniform(-60, 60), rnd.uniform(-60, 60), rnd.uniform(-60, 60)))
    L, D, H = j["L"], j["D"], j["H"]
    rx, ry, rz = D * 0.5, L * 0.5, H * 0.60
    cz = H * 0.42
    asym = rnd.uniform(0.12, 0.22) * rnd.choice((-1, 1))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=6, radius=1.0)
    # weathering planes: mostly lateral or tilted up, cut in to 80-90 % of the support distance
    planes = []
    for k in range(j["planes"]):
        a = rnd.uniform(0, 2 * math.pi)
        el = rnd.uniform(0.05, 0.75)
        n = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        if j["back"] and n.x < -0.3:  # keep the free planes on the front/top; the back gets its own
            n.x = -n.x
        n.normalize()
        planes.append((n, rnd.uniform(0.70, 0.84), rnd.uniform(0.80, 0.95)))
    if j["back"]:
        planes.append((Vector((-1, 0, 0)), 0.76, 0.97))  # flat-ish back toward the wall (-X)
    else:
        planes.append((Vector((0.12, -0.08, 1)).normalized(), 0.84, 0.75))  # soft worn top, no peak
    for v in bm.verts:
        p = v.co.normalized()
        d = 1 + 0.14 * fbm(p * 1.1 + off, 3) + 0.035 * noise.noise(p * 3.2 + off)
        q = Vector((p.x * d * rx, p.y * d * ry, p.z * d * rz))
        for n, o, s in planes:
            sup = math.sqrt((n.x * rx) ** 2 + (n.y * ry) ** 2 + (n.z * rz) ** 2)
            over = q.dot(n) - o * sup
            if over > 0:
                q -= n * over * s
        if j["back"]:
            q.x += 0.012 * noise.noise(q * 2.5 + off)  # back not mirror-flat
        q.z *= 1 + asym * q.y / ry  # one end higher: less egg-like
        q.z += cz
        v.co = q
    ob = F["bm_to_obj"](bm, name + "_HI")
    for vv in ob.data.vertices:  # sink the base well below the floor so the cut is clean
        if vv.co.z < 0.0:
            vv.co.z = min(vv.co.z, -0.02)
    voxel = 0.010 if max(L, D) < 1.6 else 0.014
    carve_cracks(ob, rnd, off, j)  # on the icosphere, so the remesh + smooth rounds the groove lips
    F["remesh"](ob, voxel, smooth_iter=6, smooth_fac=0.6)
    F["cut_plane"](ob, 0.0, keep_below=False)
    F["keep_largest_island"](ob)
    me = ob.data
    base = [v.co for v in me.vertices if v.co.z < 0.02]
    cx = (min(p.x for p in base) + max(p.x for p in base)) / 2
    cy = (min(p.y for p in base) + max(p.y for p in base)) / 2
    for v in me.vertices:
        v.co.x -= cx
        v.co.y -= cy
    for p in me.polygons:
        p.use_smooth = True
    return ob


def carve_cracks(ob, rnd, off, j):
    """A few soft grooves: points near a random plane through the rock, limited to a noisy patch,
    pushed in along the normal. Friendly width (3-5 cm), no sharp spikes."""
    me = ob.data
    me.update()
    vs = me.vertices
    zmax = max(v.co.z for v in vs)
    cracks = []
    for k in range(j["cracks"]):
        a = rnd.uniform(0, 2 * math.pi)
        el = rnd.uniform(-0.35, 0.35)
        n = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el))).normalized()
        c = Vector((rnd.uniform(-0.25, 0.25) * j["D"], rnd.uniform(-0.3, 0.3) * j["L"], rnd.uniform(0.3, 0.75) * zmax))
        cracks.append((n, c, rnd.uniform(0.032, 0.045) * (1 + 0.4 * (j["H"] > 1)),
                       rnd.uniform(0.030, 0.045) * (1 + 0.3 * (j["H"] > 1)), Vector((rnd.uniform(-90, 90), rnd.uniform(-90, 90), 0))))
    for v in vs:
        p = v.co
        push = 0.0
        for n, c, w, dep, o2 in cracks:
            dist = (p - c).dot(n) + 0.03 * noise.noise(p * 3.0 + o2)
            if abs(dist) > 3 * w:
                continue
            patch = smoothstep(0.0, 0.25, noise.noise(p * 1.4 + o2 + off) + 0.15)
            push = max(push, dep * math.exp(-(dist / w) ** 2) * patch)
        if push > 0 and p.z > 0.04:
            v.co = p - v.normal * push
    me.update()


def hi_material(name, glaze):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt, bs = F["_nodes"](mat)
    N = nt.nodes.new
    L = nt.links.new
    tc = N("ShaderNodeTexCoord")
    tc.location = (-1700, 0)
    # rock colour: big mottling + fine grain
    n1 = N("ShaderNodeTexNoise")
    n1.location = (-1400, 300)
    n1.inputs["Scale"].default_value = 2.2
    n1.inputs["Detail"].default_value = 6.0
    L(tc.outputs["Object"], n1.inputs["Vector"])
    ramp = F["_ramp"](nt, n1.outputs["Fac"], [(0.33, ROCK_D), (0.50, ROCK_M), (0.68, ROCK_L)], (-1150, 300))
    # crevice darkening from AO (cracks, plane edges)
    ao = N("ShaderNodeAmbientOcclusion")
    ao.location = (-1150, 0)
    ao.inputs["Distance"].default_value = 0.12
    ao.only_local = True
    ao.samples = 8
    aor = N("ShaderNodeMapRange")
    aor.location = (-950, 0)
    aor.inputs["From Min"].default_value = 0.35
    aor.inputs["From Max"].default_value = 0.95
    L(ao.outputs["AO"], aor.inputs["Value"])
    mixc = N("ShaderNodeMix")
    mixc.data_type = "RGBA"
    mixc.location = (-750, 200)
    L(aor.outputs["Result"], mixc.inputs["Factor"])
    mixc.inputs[6].default_value = srgb(ROCK_CRACK)
    L(ramp.outputs["Color"], mixc.inputs[7])
    # glaze mask: upward facing * patchy noise * upper half
    geo = N("ShaderNodeNewGeometry")
    geo.location = (-1700, -400)
    sep = N("ShaderNodeSeparateXYZ")
    sep.location = (-1500, -400)
    L(geo.outputs["Normal"], sep.inputs["Vector"])
    up = N("ShaderNodeMapRange")
    up.location = (-1300, -400)
    up.inputs["From Min"].default_value = 0.35
    up.inputs["From Max"].default_value = 0.80
    up.interpolation_type = "SMOOTHSTEP"
    L(sep.outputs["Z"], up.inputs["Value"])
    n2 = N("ShaderNodeTexNoise")
    n2.location = (-1400, -650)
    n2.inputs["Scale"].default_value = 2.8
    n2.inputs["Detail"].default_value = 3.0
    L(tc.outputs["Object"], n2.inputs["Vector"])
    pr = N("ShaderNodeMapRange")
    pr.location = (-1150, -650)
    pr.inputs["From Min"].default_value = 0.40
    pr.inputs["From Max"].default_value = 0.52
    pr.interpolation_type = "SMOOTHSTEP"
    L(n2.outputs["Fac"], pr.inputs["Value"])
    m1 = N("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    m1.location = (-950, -450)
    L(up.outputs["Result"], m1.inputs[0])
    L(pr.outputs["Result"], m1.inputs[1])
    gl = N("ShaderNodeMath")
    gl.operation = "MULTIPLY"
    gl.use_clamp = True
    gl.location = (-780, -450)
    L(m1.outputs["Value"], gl.inputs[0])
    gl.inputs[1].default_value = glaze
    # glaze colour: pale ice with frost speckle
    n3 = N("ShaderNodeTexNoise")
    n3.location = (-1150, -900)
    n3.inputs["Scale"].default_value = 14.0
    gr = F["_ramp"](nt, n3.outputs["Fac"], [(0.4, GLAZE), (0.7, FROST)], (-950, -900))
    L(tc.outputs["Object"], n3.inputs["Vector"])
    mixg = N("ShaderNodeMix")
    mixg.data_type = "RGBA"
    mixg.location = (-450, 100)
    L(gl.outputs["Value"], mixg.inputs["Factor"])
    L(mixc.outputs[2], mixg.inputs[6])
    L(gr.outputs["Color"], mixg.inputs[7])
    L(mixg.outputs[2], bs.inputs["Base Color"])
    # roughness 0.75 rock -> 0.22 glaze
    rr = N("ShaderNodeMapRange")
    rr.location = (-450, -250)
    rr.inputs["To Min"].default_value = 0.75
    rr.inputs["To Max"].default_value = 0.22
    L(gl.outputs["Value"], rr.inputs["Value"])
    L(rr.outputs["Result"], bs.inputs["Roughness"])
    # fine grain bump (weaker under the glaze)
    vo = N("ShaderNodeTexVoronoi")
    vo.location = (-1150, -1200)
    vo.feature = "SMOOTH_F1"
    vo.inputs["Scale"].default_value = 6.0
    L(tc.outputs["Object"], vo.inputs["Vector"])
    n4 = N("ShaderNodeTexNoise")
    n4.location = (-1150, -1450)
    n4.inputs["Scale"].default_value = 9.0
    n4.inputs["Detail"].default_value = 4.0
    L(tc.outputs["Object"], n4.inputs["Vector"])
    ad = N("ShaderNodeMath")
    ad.operation = "ADD"
    ad.location = (-900, -1300)
    L(vo.outputs["Distance"], ad.inputs[0])
    L(n4.outputs["Fac"], ad.inputs[1])
    bst = N("ShaderNodeMapRange")
    bst.location = (-700, -1100)
    bst.inputs["To Min"].default_value = 0.35
    bst.inputs["To Max"].default_value = 0.08
    L(gl.outputs["Value"], bst.inputs["Value"])
    bp = N("ShaderNodeBump")
    bp.location = (-250, -900)
    bp.inputs["Distance"].default_value = 0.01
    L(bst.outputs["Result"], bp.inputs["Strength"])
    L(ad.outputs["Value"], bp.inputs["Height"])
    L(bp.outputs["Normal"], bs.inputs["Normal"])
    bs.inputs["Emission Strength"].default_value = 0.0
    return mat


def final_material(lo, imgs):
    name = "M_" + lo.name[3:]
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    nt, bs = F["_nodes"](mat)
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    uv.location = (-900, 0)

    def tex(img, loc):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        t.location = loc
        nt.links.new(uv.outputs["UV"], t.inputs["Vector"])
        return t

    tc = tex(imgs["col"], (-500, 300))
    nt.links.new(tc.outputs["Color"], bs.inputs["Base Color"])
    tr = tex(imgs["rgh"], (-500, 0))
    sp = nt.nodes.new("ShaderNodeSeparateColor")
    sp.location = (-200, 0)
    nt.links.new(tr.outputs["Color"], sp.inputs["Color"])
    nt.links.new(sp.outputs["Green"], bs.inputs["Roughness"])
    tn = tex(imgs["nrm"], (-500, -300))
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.location = (-150, -300)
    nm.uv_map = "UVMap"
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
    bs.inputs["Metallic"].default_value = 0.0
    bs.inputs["Emission Color"].default_value = (0, 0, 0, 1)
    bs.inputs["Emission Strength"].default_value = 0.0
    lo.data.materials.clear()
    lo.data.materials.append(mat)
    return mat


def build_source(name):
    j = JOBS[name]
    hi = src_floorrock(name, j)
    hi.data.materials.clear()
    hi.data.materials.append(hi_material("MHI_" + name, j["glaze"]))
    return hi


def build_low(name):
    j = JOBS[name]
    hi = bpy.data.objects[name + "_HI"]
    lo = F["make_low"](hi, name, j["budget"] - 4)
    F["finish_low"](lo, flat_z=(0.0,))
    F["uv_unwrap"](lo, margin=0.01)
    return lo


def bake_and_export(name, out_dir, tex_dir):
    F["TEX_DIR"] = tex_dir
    hi = bpy.data.objects[name + "_HI"]
    lo = bpy.data.objects[name]
    big = JOBS[name]["H"] > 1.0
    ext, ray = (0.07, 0.16) if big else (0.05, 0.12)
    F["scene"]()
    hi.hide_set(False)
    lo.hide_set(False)
    hi.hide_render = False
    # bake(..., rock=True) bakes colour, normal, roughness and an emission map; we drop the emission
    imgs = F["bake"](hi, lo, True, ext, ray)
    emi = imgs.pop("emi", None)
    if emi:
        bpy.data.images.remove(emi)
    final_material(lo, imgs)
    path = os.path.join(out_dir, name + ".glb")
    size = F["export_glb"](lo, path)
    return {"name": name, "tris": F["tris"](lo), "size": size, "dims": tuple(round(d, 3) for d in lo.dimensions)}


def build_all(out_dir, tex_dir, names=None):
    res = []
    for n in names or JOBS:
        build_source(n)
        build_low(n)
        res.append(bake_and_export(n, out_dir, tex_dir))
    return res
