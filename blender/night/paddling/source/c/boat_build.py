# Paddling N20 (lane C): clean a Tripo dragon boat to the shared paddling contract.
# Run: blender -b --factory-startup -P boat_build.py -- <fox|robot|bear> <tmpdir> <outdir> [stage]
# Blender axes: +Z up, bow toward -Y (glTF +Z), so glTF z = -Blender y.
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
BOAT = argv[0]
TMP = argv[1]
OUT = argv[2]
STAGE = argv[3] if len(argv) > 3 else "all"

# ---------------------------------------------------------------- per-boat params
# sgn: raw +X (sgn=1) or -X (sgn=-1) is the bow. f = raw floor height, g = raw gunwale (rim) height.
# bow/stern: raw "a" (bow-positive) ranges where the uniform-scaled prow / stern zone blends in.
P = {
    "fox":   dict(sgn=-1, f=0.062, g=0.110, hw=0.128, bow=(0.300, 0.345), stern=(-0.400, -0.440),
                  name="Boat_Fox", team=(0.42, 0.16, 0.62), floor=(0.62, 0.42, 0.24), bench=(0.86, 0.60, 0.30),
                  inner=(0.36, 0.13, 0.52), drum_body=(0.78, 0.10, 0.10), drum_rim=(0.92, 0.70, 0.25),
                  drum_skin=(0.93, 0.86, 0.72), cut_top_extra=True, solver='MANIFOLD', neck_a=0.37),
    "robot": dict(sgn=-1, f=0.022, g=0.088, hw=0.127, bow=(0.295, 0.340), stern=(-0.255, -0.300),
                  name="Boat_Robot", team=(0.10, 0.55, 0.55), floor=(0.55, 0.36, 0.22), bench=(0.10, 0.42, 0.42),
                  inner=(0.70, 0.72, 0.74), drum_body=(0.72, 0.74, 0.78), drum_rim=(0.20, 0.80, 0.85),
                  drum_skin=(0.88, 0.88, 0.86), cut_top_extra=False, solver='MANIFOLD', neck_a=0.385),
    "bear":  dict(sgn=1, f=0.040, g=0.101, hw=0.115, bow=(0.305, 0.345), stern=(-0.380, -0.425),
                  name="Boat_Bear", team=(0.70, 0.12, 0.10), floor=(0.62, 0.40, 0.22), bench=(0.80, 0.52, 0.26),
                  inner=(0.62, 0.12, 0.10), drum_body=(0.55, 0.32, 0.16), drum_rim=(0.85, 0.70, 0.45),
                  drum_skin=(0.93, 0.86, 0.70), cut_top_extra=False, solver='MANIFOLD', neck_a=0.395),
}[BOAT]

LENGTH = 11.4
GUN = 0.42        # gunwale top
FLOOR_Y = 0.03    # the open interior floor (3 cm above the waterline so a water plane at y 0 never shows through)
FLOOR_MAP = 0.07  # where the raw floor lands (the cut floor is made at FLOOR_Y, below it)
DEPTH = 0.15      # hull bottom below the waterline
ROWS = [2.3, 0.6, -1.1]  # glTF z of the bench rows
SEAT_X = 0.42
BENCH_TOP = 0.36
DRUM_SEAT_Z = 4.0
DRUM_Z = 3.55     # drum in front of the drummer (drummer faces -z): 4.0 - 0.45
DRUM_TOP = 0.55


def log(*a):
    print("[N20]", *a, flush=True)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- stage 1: import, weld, deform
def import_raw():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(TMP, "boat-%s.glb" % BOAT))
    new = [o for o in bpy.data.objects if o not in before]
    ob = [o for o in new if o.type == 'MESH'][0]
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o)
    ob.name = "high"
    ob.data.name = "high"
    return ob


def deform(ob):
    sgn, f, g = P["sgn"], P["f"], P["g"]
    s_h = (GUN - FLOOR_MAP) / (g - f)       # vertical scale above the floor; prow/stern zones use it uniformly
    s_lo = (FLOOR_MAP + DEPTH) / f          # below the raw floor (squeezes the deep Tripo keel)
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    # make it a clean closed 2-manifold so the Manifold boolean accepts it
    for it in range(6):
        nm = [e for e in bm.edges if not e.is_manifold and not e.is_boundary]
        if nm:
            fs = set(f for e in nm for v in e.verts for f in v.link_faces)
            if it >= 1:
                fs |= set(f2 for f in list(fs) for v in f.verts for f2 in v.link_faces)
            bmesh.ops.delete(bm, geom=list(fs), context='FACES')
        loose = [v for v in bm.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bd = [e for e in bm.edges if e.is_boundary]
        if bd:
            bmesh.ops.holes_fill(bm, edges=bd, sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        if not any(not e.is_manifold for e in bm.edges):
            break
    log("manifold fix: non-manifold edges left", sum(1 for e in bm.edges if not e.is_manifold))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    a_vals = [sgn * v.co.x for v in bm.verts]
    amin, amax = min(a_vals), max(a_vals)
    b0, b1 = P["bow"]; t0, t1 = P["stern"]

    def w(a):
        return max(smooth(b0, b1, a), smooth(-t0, -t1, -a))
    # integrate s(a) = sL*(1-w) + s_h*w ; choose sL for total length LENGTH
    N = 4000
    grid = [amin + (amax - amin) * i / N for i in range(N + 1)]
    da = (amax - amin) / N
    iw = sum(w(a) for a in grid) * da
    i1w = (amax - amin) - iw
    sL = (LENGTH - s_h * iw) / i1w
    cum = [0.0]
    for i in range(N):
        s0 = sL + (s_h - sL) * w(grid[i]); s1 = sL + (s_h - sL) * w(grid[i + 1])
        cum.append(cum[-1] + 0.5 * (s0 + s1) * da)
    off = cum[-1] / 2.0

    def Lmap(a):
        t = (a - amin) / da
        i = min(N - 1, max(0, int(t)))
        fr = t - i
        return cum[i] * (1 - fr) + cum[i + 1] * fr - off

    # lateral scale: 1.4 m at the widest, but at least 0.67 half-width at the front row
    sx = 0.70 / P["hw"]

    def zmap(z):
        if z < f:
            return -DEPTH + z * s_lo
        return FLOOR_MAP + (z - f) * s_h

    for v in bm.verts:
        x, y, z = v.co
        a = sgn * x
        lat = sgn * y
        ww = w(a)
        X = lat * (sx + (s_h - sx) * ww)
        v.co = Vector((X, -Lmap(a), zmap(z)))
    bm.to_mesh(me); bm.free()
    me.update()
    # calibrate: median rim top over the crew zone -> GUN
    bm2 = bmesh.new(); bm2.from_mesh(me); bvh = BVHTree.FromBMesh(bm2); bm2.free()
    tops = []
    for i in range(60):
        L = -3.5 + 7.5 * i / 59
        for side in (1, -1):
            hx = bvh.ray_cast(Vector((side * 3.0, -L, 0.2)), Vector((-side, 0, 0)))[0]
            if hx is None: continue
            xo = abs(hx.x)
            h = bvh.ray_cast(Vector((side * (xo - 0.035), -L, 3.0)), Vector((0, 0, -1)))[0]
            if h is not None and 0.25 < h.z < 0.6: tops.append(h.z)
    tops.sort(); med = tops[len(tops) // 2]
    k = (GUN - FLOOR_MAP) / (med - FLOOR_MAP)
    for v in me.vertices:
        if v.co.z > FLOOR_MAP:
            v.co.z = FLOOR_MAP + (v.co.z - FLOOR_MAP) * k
    me.update()
    log("rim median before", round(med, 4), "k", round(k, 4), "spread", round(tops[len(tops)//10], 3), round(tops[-len(tops)//10], 3))
    widen(ob)
    info = dict(s_h=s_h, s_lo=s_lo, sL=sL, sx=sx, neck_L=Lmap(P["neck_a"]), bow_start=Lmap(b0), bow_full=Lmap(b1),
                stern_start=Lmap(t0), stern_full=Lmap(t1))
    log("deform", info)
    return info


ROW_HALF = 0.665   # outer hull half-width wanted at the rows (inner wall then >= 0.62)


def widen(ob):
    # the Tripo hulls taper toward the bow; make them fuller where the crew sits so the inner wall
    # stays outside |x| 0.6 above the bench top at every row (the paddlers' space)
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me); bvh = BVHTree.FromBMesh(bm); bm.free()
    Ls = [-4.0 + 9.0 * i / 180 for i in range(181)]
    xr = []
    for L in Ls:
        best = 9.0
        for y in (0.30, 0.36):
            for side in (1, -1):
                h = bvh.ray_cast(Vector((side * 3.0, -L, y)), Vector((-side, 0, 0)))[0]
                if h is not None and h.x * side > 0:
                    best = min(best, abs(h.x))
        xr.append(best if best < 9.0 else 0.3)
    # windowed min (+-0.3 m) then the needed factor, masked to the crew zone, then smoothed
    fac = []
    for i, L in enumerate(Ls):
        win = [xr[j] for j in range(len(Ls)) if abs(Ls[j] - L) <= 0.3]
        m = min(win)
        mask = smooth(-2.9, -1.7, L) * (1 - smooth(2.9, 3.9, L))
        fac.append(1 + mask * (max(1.0, ROW_HALF / m) - 1))
    sm = []
    for i, L in enumerate(Ls):
        ws = 0; acc = 0
        for j in range(len(Ls)):
            d = Ls[j] - L
            if abs(d) <= 0.8:
                wgt = math.exp(-(d / 0.35) ** 2); ws += wgt; acc += wgt * fac[j]
        sm.append(max(fac[i], acc / ws) if abs(L) < 99 else 1)

    def F(L):
        if L <= Ls[0]: return sm[0]
        if L >= Ls[-1]: return sm[-1]
        t = (L - Ls[0]) / (Ls[1] - Ls[0]); i = int(t); fr = t - i
        return sm[i] * (1 - fr) + sm[min(i + 1, len(sm) - 1)] * fr
    for v in me.vertices:
        v.co.x *= F(-v.co.y)
    me.update()
    log("widen max factor", round(max(sm), 3), "at L", round(Ls[sm.index(max(sm))], 2))


def bvh_of(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def x_out_profile(ob, Ls, ys):
    """outer half-width per glTF z (L) and height y, from rays shot inward from both sides."""
    bvh = bvh_of(ob)
    res = {}
    for L in Ls:
        for y in ys:
            vals = []
            for side in (1, -1):
                h = bvh.ray_cast(Vector((side * 3.0, -L, y)), Vector((-side, 0, 0)))
                vals.append(abs(h[0].x) if (h[0] is not None and h[0].x * side > 0) else 9.0)
            res[(L, y)] = min(vals)
    return res


def make_cutter(ob, info):
    """a lofted solid for the open interior: floor cut at y 0, walls kept >= 4.5 cm thick."""
    Lneck = info["neck_L"]   # where the prow's neck starts (picked per boat from the raw side view)
    Lb = max(4.30, Lneck - 0.04)
    Ls = info["stern_start"] - 0.10
    n = 56
    stations = [Ls + (Lb - Ls) * i / n for i in range(n + 1)]
    ys = [FLOOR_Y, 0.12, 0.24, 0.30, 0.36]
    xo = x_out_profile(ob, [Ls - 0.6 + (Lb - Ls + 1.2) * i / 140 for i in range(141)], ys)
    keys = sorted(set(k[0] for k in xo))

    def xout(L, y):
        vals = [xo[(k, y)] for k in keys if abs(k - L) <= 0.45]
        m = min(vals) if vals else 9.0
        return m if m < 9.0 else 0.3
    verts = []; faces = []
    prof = []
    for L in stations:
        wb = xout(L, FLOOR_Y) - 0.07
        wm = min(xout(L, 0.12), xout(L, 0.24)) - 0.06
        wt = min(xout(L, 0.30), xout(L, 0.36)) - 0.045
        wt = min(wt, 0.62)
        wm = min(wm, wt)
        wb = min(wb, wm)
        wb = max(wb, 0.05); wm = max(wm, 0.05); wt = max(wt, 0.05)
        prof.append((round(L, 2), round(wb, 3), round(wm, 3), round(wt, 3)))
        sec = [(-wb, FLOOR_Y), (-wm, 0.18), (-wt, 0.34), (-wt, 2.5), (wt, 2.5), (wt, 0.34), (wm, 0.18), (wb, FLOOR_Y)]
        for (x, y) in sec:
            verts.append((x, -L, y))
    m = 8
    for i in range(n):
        for j in range(m):
            a = i * m + j; b = i * m + (j + 1) % m
            faces.append((a, b, b + m, a + m))
    faces.append(tuple(range(m))[::-1])
    faces.append(tuple(n * m + j for j in range(m)))
    me = bpy.data.meshes.new("cutter"); me.from_pydata(verts, [], faces); me.update()
    co = bpy.data.objects.new("cutter", me); bpy.context.scene.collection.objects.link(co)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    log("neck", round(Lneck, 2), "open", round(Ls, 2), round(Lb, 2), "cutter profile", prof[::7])
    info["profile"] = prof
    return co, Lb, Ls


def boolean(target, tool, op, solver=None):
    md = target.modifiers.new("b", 'BOOLEAN')
    md.operation = op
    md.object = tool
    md.solver = solver or P['solver']
    md.use_self = False
    if md.solver == 'EXACT':
        md.use_hole_tolerant = True
    try:
        md.material_mode = 'TRANSFER'
    except Exception:
        pass
    bpy.context.view_layer.objects.active = target
    for o in bpy.context.scene.objects:
        o.select_set(o is target)
    n0 = len(target.data.polygons)
    keep = target.data.copy()
    bpy.ops.object.modifier_apply(modifier=md.name)
    if len(target.data.polygons) == n0 and md_solver_name(solver) == 'MANIFOLD':
        # the Manifold solver refuses a mesh it does not trust: fall back to Exact
        old = target.data; target.data = keep; bpy.data.meshes.remove(old)
        log("boolean", op, tool.name, "manifold refused, retry exact")
        return boolean(target, tool, op, solver='EXACT')
    bpy.data.meshes.remove(keep)
    log("boolean", op, tool.name, solver or P['solver'], n0, "->", len(target.data.polygons))


def md_solver_name(solver):
    return solver or P['solver']


def box(name, x0, x1, y0, y1, z0, z1, bevel=0.0):
    """axis box in glTF terms (x, y up, z bow) -> Blender (x, -z, y)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        X = x0 + (v.co.x + 0.5) * (x1 - x0)
        Y = y0 + (v.co.z + 0.5) * (y1 - y0)
        Z = z0 + (v.co.y + 0.5) * (z1 - z0)
        v.co = Vector((X, -Z, Y))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # the axis swap mirrors the cube
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES', profile=0.5,
                        clamp_overlap=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- materials (bake sources)
def lin(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    return m, nt, bsdf


def set_col(nt, bsdf, sock):
    nt.links.new(sock, bsdf.inputs["Base Color"])
    nt.links.new(sock, bsdf.inputs["Emission Color"])


def rgb(nt, c):
    n = nt.nodes.new("ShaderNodeRGB"); n.outputs[0].default_value = lin(c); return n.outputs[0]


def mix(nt, fac, a, b):
    n = nt.nodes.new("ShaderNodeMix"); n.data_type = 'RGBA'
    nt.links.new(fac, n.inputs["Factor"]); nt.links.new(a, n.inputs[6]); nt.links.new(b, n.inputs[7])
    return n.outputs[2]


def math_node(nt, op, a, b=None, val=None):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = op
    if isinstance(a, float): n.inputs[0].default_value = a
    else: nt.links.new(a, n.inputs[0])
    if b is not None:
        if isinstance(b, float): n.inputs[1].default_value = b
        else: nt.links.new(b, n.inputs[1])
    return n.outputs[0]


def mat_src(src_mat):
    imgs = [n.image for n in src_mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    base = [i for i in imgs if "basecolor" in i.name.lower()][0]
    nrm = [i for i in imgs if "normal" in i.name.lower()]
    m, nt, bsdf = new_mat("M_src")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = base
    set_col(nt, bsdf, t.outputs[0])
    if nrm:
        nrm[0].colorspace_settings.is_data = True
        tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm[0]
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tn.outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], bsdf.inputs["Normal"])
    return m


def mat_interior():
    """floor (faces looking up): planks along the hull; walls: the team's inner colour."""
    m, nt, bsdf = new_mat("M_interior")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["Normal"], sep.inputs[0])
    up = math_node(nt, 'GREATER_THAN', sep.outputs[2], 0.7)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sx = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sx.inputs[0])
    plank = math_node(nt, 'FRACT', math_node(nt, 'DIVIDE', math_node(nt, 'ADD', sx.outputs[0], 2.0), 0.16))
    gap = math_node(nt, 'LESS_THAN', plank, 0.07)
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    fl = mix(nt, math_node(nt, 'MULTIPLY', noise.outputs[0], 0.35), rgb(nt, P["floor"]),
             rgb(nt, tuple(min(1, c * 1.12) for c in P["floor"])))
    fl = mix(nt, gap, fl, rgb(nt, tuple(c * 0.62 for c in P["floor"])))
    col = mix(nt, up, rgb(nt, P["inner"]), fl)
    set_col(nt, bsdf, col)
    return m


def mat_flat(name, c):
    m, nt, bsdf = new_mat(name)
    set_col(nt, bsdf, rgb(nt, c))
    return m


def mat_bench():
    m, nt, bsdf = new_mat("M_bench")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = 'BANDS'; w.bands_direction = 'X'
    w.inputs["Scale"].default_value = 6.0; w.inputs["Distortion"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], w.inputs["Vector"])
    c = mix(nt, math_node(nt, 'MULTIPLY', w.outputs[1], 0.25), rgb(nt, P["bench"]),
            rgb(nt, tuple(c * 0.75 for c in P["bench"])))
    set_col(nt, bsdf, c)
    return m


def mat_drum_body():
    """team pattern on the drum shell: fox gold swirls band, robot glowing stripes, bear rope zigzag."""
    m, nt, bsdf = new_mat("M_drum_body")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sp.inputs[0])
    ang = math_node(nt, 'ARCTAN2', sp.outputs[1], sp.outputs[0])
    base = rgb(nt, P["drum_body"]); acc = rgb(nt, P["drum_rim"])
    if BOAT == "robot":
        s = math_node(nt, 'SINE', math_node(nt, 'MULTIPLY', ang, 8.0))
        f = math_node(nt, 'GREATER_THAN', s, 0.82)
        col = mix(nt, f, base, acc)
    else:
        # zigzag: |fract(ang*k)-0.5|*2 vs height
        k = 6.0 / (2 * math.pi)
        tri = math_node(nt, 'MULTIPLY', math_node(nt, 'ABSOLUTE', math_node(nt, 'SUBTRACT', math_node(
            nt, 'FRACT', math_node(nt, 'MULTIPLY', ang, k)), 0.5)), 2.0)
        hz = math_node(nt, 'DIVIDE', math_node(nt, 'SUBTRACT', sp.outputs[2], 0.30), 0.20)
        d = math_node(nt, 'ABSOLUTE', math_node(nt, 'SUBTRACT', hz, tri))
        f = math_node(nt, 'LESS_THAN', d, 0.12)
        col = mix(nt, f, base, acc)
    set_col(nt, bsdf, col)
    return m


# ---------------------------------------------------------------- parts
def lofted(name, rings, seg, cap_top=True, cap_bot=True, center=(0, 0), z_bow=0.0, top_dome=0.0):
    """rings [(r, y)] around the vertical axis at glTF (cx, z_bow)."""
    bm = bmesh.new()
    loops = []
    for (r, y) in rings:
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ring.append(bm.verts.new((center[0] + r * math.cos(a), -(z_bow + r * math.sin(a)), y)))
        loops.append(ring)
    faces = {"side": [], "top": [], "bot": []}
    for i in range(len(loops) - 1):
        for k in range(seg):
            f = bm.faces.new((loops[i][k], loops[i][(k + 1) % seg], loops[i + 1][(k + 1) % seg], loops[i + 1][k]))
            faces["side"].append((i, f))
    if cap_top:
        c = bm.verts.new((center[0], -z_bow, rings[-1][1] + top_dome))
        for k in range(seg):
            faces["top"].append(bm.faces.new((loops[-1][k], loops[-1][(k + 1) % seg], c)))
    if cap_bot:
        c = bm.verts.new((center[0], -z_bow, rings[0][1]))
        for k in range(seg):
            faces["bot"].append(bm.faces.new((loops[0][(k + 1) % seg], loops[0][k], c)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    tag = {}
    for (i, f) in faces["side"]:
        tag[f] = ("side", i)
    for f in faces["top"]:
        tag[f] = ("top", 0)
    for f in faces["bot"]:
        tag[f] = ("bot", 0)
    bm.faces.ensure_lookup_table()
    idx = {f.index: tag.get(f) for f in bm.faces}
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    return o, idx


def make_drum(mats):
    """festive drum, top skin at y 0.55, on a short pedestal standing on the floor (<= 200 tris)."""
    body, bidx = lofted("Drum", [(0.172, 0.26), (0.186, 0.30), (0.200, 0.405), (0.186, 0.51), (0.178, 0.55)],
                        16, cap_top=True, cap_bot=True, z_bow=DRUM_Z, top_dome=0.0)
    ped, pidx = lofted("ped", [(0.06, -0.01), (0.05, 0.265)], 8, cap_top=False, cap_bot=False, z_bow=DRUM_Z)
    for mt in mats:
        body.data.materials.append(mt)
        ped.data.materials.append(mt)
    # 0 body, 1 rim, 2 skin
    for p in body.data.polygons:
        kind, i = bidx[p.index]
        p.material_index = 2 if kind == "top" else (1 if kind == "bot" or i in (0, 3) else 0)
    for p in ped.data.polygons:
        p.material_index = 1
    join([body, ped])
    return body


def join(objs):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    return objs[0]


def keep_largest(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen = set(); comps = []
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; seen.add(v.index); comp = []
        while st:
            a = st.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index); st.append(b)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    dropped = [len(c) for c in comps[1:]]
    for c in comps[1:]:
        bmesh.ops.delete(bm, geom=c, context='VERTS')
    pass  # (no dissolve_degenerate here: it opened holes in the cut shell)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    log("floating bits removed", len(dropped), "verts", sum(dropped))


def probe(ob, tag):
    t = bvh_of(ob)
    out = []
    for L in (-2.0, -0.3, 1.5):
        h = t.ray_cast(Vector((0.0, -L, 1.0)), Vector((0, 0, -1)))
        out.append(round(h[0].z, 3) if h[0] is not None else None)
    log("probe floor", tag, ob.name, out)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def decimate(ob, target, vgroup=None, vfac=1.0):
    t0 = tris(ob)
    for it in range(6):
        cur = tris(ob)
        if cur <= target:
            break
        md = ob.modifiers.new("dec", 'DECIMATE')
        md.decimate_type = 'COLLAPSE'
        md.ratio = max(0.02, min(1.0, target / cur * (0.995 if it == 0 else 0.97)))
        md.use_collapse_triangulate = True
        if vgroup:
            md.vertex_group = vgroup
            md.vertex_group_factor = vfac
            md.invert_vertex_group = True
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.scene.objects:
            o.select_set(o is ob)
        bpy.ops.object.modifier_apply(modifier=md.name)
    log("decimate", ob.name, t0, "->", tris(ob))


def snap_floor(ob, info):
    """the decimation can drift the flat cut floor: put interior floor verts back on y 0."""
    prof = info["profile"]
    n = 0
    for v in ob.data.vertices:
        L = -v.co.y
        if info["open_stern"] + 0.05 < L < info["open_bow"] - 0.05 and abs(v.co.z - FLOOR_Y) < 0.08:
            wb = min(prof, key=lambda p: abs(p[0] - L))[1]
            if abs(v.co.x) < wb - 0.005:
                v.co.z = FLOOR_Y; n += 1
    ob.data.update()
    log("snap_floor", ob.name, n)


def bench_parts(info, mats_bench):
    prof = info["profile"]

    def wt_at(L):
        best = min(prof, key=lambda p: abs(p[0] - L))
        return best[3]
    objs = []; parts = []
    for (z, half_w) in [(r, None) for r in ROWS] + [(DRUM_SEAT_Z, 0.24)]:
        hw = half_w if half_w else min(wt_at(z - 0.16), wt_at(z), wt_at(z + 0.16)) + 0.025
        d = 0.16 if half_w is None else 0.13   # drummer stool: keeps a gap to the drum at z 3.55
        for nm, args, bv in (("leg", (-0.07, 0.07, -0.02, BENCH_TOP - 0.045, z - 0.09, z + 0.09), 0.0),
                             ("bench", (-hw, hw, BENCH_TOP - 0.055, BENCH_TOP, z - d, z + d), 0.012)):
            o = box(nm, *args, bevel=bv)
            o.data.materials.append(mats_bench)
            parts.append(o)
    for o in parts:   # bake sources: copies
        c = o.copy(); c.data = o.data.copy(); bpy.context.scene.collection.objects.link(c); objs.append(c)
    return objs, parts


def orient_like(ob, refs):
    """make winding consistent, then flip whole regions (faces joined by manifold edges) whose
    area-weighted normals disagree with the nearest surface of the reference meshes."""
    trees = []
    for r in refs:
        rb = bmesh.new(); rb.from_mesh(r.data); trees.append((BVHTree.FromBMesh(rb), rb))
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.faces.ensure_lookup_table()
    seen = set(); regions = []
    for f in bm.faces:
        if f.index in seen: continue
        st = [f]; seen.add(f.index); reg = []
        while st:
            a = st.pop(); reg.append(a)
            for e in a.edges:
                if len(e.link_faces) != 2: continue
                for b in e.link_faces:
                    if b.index not in seen:
                        seen.add(b.index); st.append(b)
        regions.append(reg)
    flip = []
    for reg in regions:
        vote = 0.0
        for f in reg:
            c = f.calc_center_median()
            best = None
            for t, rb in trees:
                hit = t.find_nearest(c, 0.25)
                if hit[0] is not None and (best is None or hit[3] < best[3]):
                    best = hit
            if best is not None:
                vote += best[1].dot(f.normal) * f.calc_area()
        if vote < 0:
            flip.extend(reg)
    if flip:
        bmesh.ops.reverse_faces(bm, faces=flip)
    bm.to_mesh(ob.data); bm.free()
    for t, rb in trees:
        rb.free()
    ob.data.update()
    log("orient_like", ob.name, "regions", len(regions), "flipped faces", len(flip), "of", len(ob.data.polygons))


def rim_tops(ob, zs=None):
    """per-station rim top (max height of the outer 15 cm band), glTF z stations -2.5..3.0"""
    import numpy as np
    co = np.array([v.co[:] for v in ob.data.vertices])
    X, Y, Z = co[:, 0], co[:, 2], -co[:, 1]
    zs = zs if zs is not None else np.arange(-2.5, 3.01, 0.25)
    out = []
    for z in zs:
        band = np.abs(Z - z) < 0.125
        mid = band & (Y > 0.2) & (Y < 0.5)
        if not mid.any():
            out.append(None); continue
        W = np.abs(X[mid]).max()
        sel = band & (np.abs(X) > W - 0.15) & (Y < 0.7)
        out.append(float(Y[sel].max()) if sel.any() else None)
    return zs, out


def restore_rim(ob, info):
    """decimation rounds the gunwale lip down: stretch the upper hull back so the rim top is GUN again."""
    import numpy as np
    zs = np.arange(info["open_stern"] + 0.3, info["open_bow"] - 0.2, 0.25)
    zs, tops = rim_tops(ob, zs)
    pairs = [(z, t) for z, t in zip(zs, tops) if t is not None]
    if not pairs:
        return
    Zp = np.array([p[0] for p in pairs]); Tp = np.array([p[1] for p in pairs])
    # smooth the measured tops along the hull
    Ts = np.array([np.average(Tp, weights=np.exp(-((Zp - z) / 0.5) ** 2)) for z in Zp])
    base = 0.22
    n = 0
    for v in ob.data.vertices:
        L = -v.co.y
        if v.co.z <= base or v.co.z > 0.75 or not (Zp[0] - 0.4 < L < Zp[-1] + 0.4):
            continue
        t = float(np.interp(L, Zp, Ts))
        k = min(1.5, max(0.85, (GUN - base) / max(1e-3, t - base)))
        fade = min(1.0, max(0.0, (L - (Zp[0] - 0.4)) / 0.4), max(0.0, ((Zp[-1] + 0.4) - L) / 0.4))
        k = 1 + (k - 1) * fade
        v.co.z = base + (v.co.z - base) * k
        n += 1
    ob.data.update()
    zs2, after = rim_tops(ob)
    a = [t for t in after if t is not None]
    log("restore_rim", ob.name, "median before", round(float(np.median(Tp)), 3), "after", round(float(np.median(a)), 3))


def enforce_open(ob):
    """crew space: nothing above the bench top (0.36) inside |x| < 0.6 within 0.5 m of a row.
    Tests triangle corners, edge midpoints and centroids; pushes wall verts out to |x| 0.605 and
    bench-top verts down to 0.36, until clean."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)   # triangulate for real, so the export splits quads the same way
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    total = 0
    for it in range(8):
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        moved = set()

        def bad(p):
            return abs(p.x) < 0.602 and p.z > BENCH_TOP + 5e-5 and any(abs(-p.y - r) <= 0.53 for r in ROWS)
        offenders = []
        for f in bm.faces:
            vs = [v.co for v in f.verts]
            pts = vs + [(vs[0] + vs[1]) / 2, (vs[1] + vs[2]) / 2, (vs[0] + vs[2]) / 2, (vs[0] + vs[1] + vs[2]) / 3]
            if any(bad(p) for p in pts):
                offenders.append(f)
        idx = set(v.index for f in offenders for v in f.verts)
        offenders = len(offenders)
        bm.free()
        if not offenders:
            break
        for i in idx:
            v = me.vertices[i]
            x, y = v.co.x, v.co.z
            if y > BENCH_TOP and abs(x) < 0.55 and y < 0.43:
                v.co.z = BENCH_TOP
            elif y > 0.25 and 0.3 < abs(x) < 0.606:
                v.co.x = math.copysign(0.606, x)
            elif y > BENCH_TOP:
                v.co.z = BENCH_TOP
            total += 1
        me.update()
    log("enforce_open", ob.name, "moved", total, "clean" if not offenders else "NOT CLEAN")


def _pt_in_tri(p, a, b, c, n):
    for u, v in ((a, b), (b, c), (c, a)):
        if (v - u).cross(p - u).dot(n) < -1e-9:
            return False
    return True


def cleanup_faces(ob, eps=0.0012):
    """remove degenerate faces, then coplanar overlaps (z-fighting: drop the smaller face) and hidden
    back-to-back pairs (drop both), the same test the asset-qa gate uses."""
    for it in range(4):
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-9], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.faces.ensure_lookup_table()
        tree = BVHTree.FromBMesh(bm)
        kill = set()
        nz = nb = 0
        for f in bm.faces:
            if f.index in kill:
                continue
            a, b, c = (v.co for v in f.verts)
            n = f.normal
            if n.length < 0.5:
                continue
            cen = (a + b + c) / 3
            vs = set(f.verts)
            for p in (cen, cen.lerp(a, .6), cen.lerp(b, .6), cen.lerp(c, .6)):
                for _, _, j, _ in tree.find_nearest_range(p, eps):
                    if j is None or j == f.index or j in kill:
                        continue
                    g = bm.faces[j]
                    d = n.dot(g.normal)
                    if abs(d) < 0.999:
                        continue
                    a2, b2, c2 = (v.co for v in g.verts)
                    q = p - g.normal * g.normal.dot(p - a2)
                    if _pt_in_tri(q, a2, b2, c2, g.normal):
                        if d > 0:
                            kill.add(f.index if f.calc_area() < g.calc_area() else g.index); nz += 1
                        else:
                            kill.add(f.index); kill.add(g.index); nb += 1
                        break
        if kill:
            bmesh.ops.delete(bm, geom=[bm.faces[i] for i in kill], context='FACES')
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(ob.data); bm.free()
        log("cleanup_faces", ob.name, "pass", it, "z-fight", nz, "back-to-back", nb)
        if not kill:
            break


def smooth_by_angle(ob, deg=40):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(o is ob)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg), keep_sharp_edges=True)


def uv_unwrap(ob, regions):
    """smart UVs, then pack each vertex group's faces into its own band of the one texture.
    regions: [(vertex group name or None for the rest, v0, v1)]"""
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.scene.objects:
        o.select_set(o is ob)
    while ob.data.uv_layers:
        ob.data.uv_layers.remove(ob.data.uv_layers[0])
    ob.data.uv_layers.new(name="UVMap")
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(72), island_margin=0.006, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    me = ob.data
    named = [r[0] for r in regions if r[0]]
    for (grp, u0, u1, v0, v1) in regions:
        bm = bmesh.from_edit_mesh(me)
        uvl = bm.loops.layers.uv.active
        dl = bm.verts.layers.deform.active
        gi = {n: ob.vertex_groups[n].index for n in named}

        def face_group(f):
            for n in named:
                if all(gi[n] in v[dl] for v in f.verts):
                    return n
            return None
        fs = [f for f in bm.faces if face_group(f) == grp]
        for f in bm.faces:
            f.select_set(False)
        h = min(v1 - v0, u1 - u0)
        for f in fs:
            f.select_set(True)
            for l in f.loops:
                u, v = l[uvl].uv
                l[uvl].uv = (u0 + u * h, v0 + v * h)
        # stretch the selection's box to the full region with one small face moved to the far corner
        f0 = min(fs, key=lambda f: f.calc_area())
        du = u1 - max(l[uvl].uv.x for l in f0.loops)
        dv = v1 - max(l[uvl].uv.y for l in f0.loops)
        for l in f0.loops:
            l[uvl].uv.x += du
            l[uvl].uv.y += dv
        bm.select_flush(True)
        bmesh.update_edit_mesh(me)
        bpy.ops.uv.pack_islands(udim_source='ORIGINAL_AABB', rotate=True, rotate_method='AXIS_ALIGNED', margin=0.004, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_maps(low, highs, size_c=1024, size_n=512):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 4
    imc = bpy.data.images.new(P["name"] + "_BaseColor", size_c, size_c, alpha=False)
    imn = bpy.data.images.new(P["name"] + "_Normal", size_n, size_n, alpha=False)
    imn.colorspace_settings.is_data = True
    m, nt, bsdf = new_mat("M_bake")
    tn = nt.nodes.new("ShaderNodeTexImage")
    low.data.materials.clear(); low.data.materials.append(m)
    for p in low.data.polygons: p.material_index = 0
    for o in bpy.context.scene.objects:
        o.select_set(o in highs or o is low)
    bpy.context.view_layer.objects.active = low
    bk = sc.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = 0.035
    bk.max_ray_distance = 0.12
    bk.margin = 4
    for img, typ in ((imc, 'EMIT'), (imn, 'NORMAL')):
        tn.image = img
        nt.nodes.active = tn
        if typ == 'NORMAL':
            bk.normal_space = 'TANGENT'
        bpy.ops.object.bake(type=typ)
        log("baked", typ)
    return imc, imn


def final_material(imc, imn, use_normal=True):
    m, nt, bsdf = new_mat(P["name"])
    bsdf.inputs["Emission Strength"].default_value = 0.0
    tc = nt.nodes.new("ShaderNodeTexImage"); tc.image = imc
    nt.links.new(tc.outputs[0], bsdf.inputs["Base Color"])
    if use_normal:
        tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = imn
        imn.colorspace_settings.is_data = True
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tn.outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.45 if BOAT == "robot" else 0.6
    bsdf.inputs["Metallic"].default_value = 0.15 if BOAT == "robot" else 0.0
    return m


def stage_shape():
    clear()
    ob = import_raw()
    src = ob.data.materials[0]
    info = deform(ob)
    m_src = mat_src(src)
    ob.data.materials.clear(); ob.data.materials.append(m_src)
    cutter, Lb, Ls = make_cutter(ob, info)
    cutter.data.materials.append(mat_interior())
    boolean(ob, cutter, 'DIFFERENCE')
    bpy.data.objects.remove(cutter)
    if P["cut_top_extra"]:
        # fox: the gold rail fence inboard of the gunwale would block every paddle stroke: trim it above the rim
        rim = mat_flat("M_rimcut", (0.93, 0.70, 0.26))
        boxes = [(-1.3, 1.3, Ls - 0.05, Lb), (0.25, 1.3, -6.0, Ls), (-1.3, -0.25, -6.0, Ls)]
        for (x0, x1, z0, z1) in boxes:
            c2 = box("cut2", x0, x1, GUN + 0.005, 3.0, z0, z1)
            c2.data.materials.append(rim)
            boolean(ob, c2, 'DIFFERENCE')
            bpy.data.objects.remove(c2)
    keep_largest(ob)
    info["open_bow"] = Lb; info["open_stern"] = Ls
    return ob, info


def look(path, objs=None):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = 1400; sc.render.resolution_y = 800
    cam = bpy.data.cameras.new("lookcam"); co = bpy.data.objects.new("lookcam", cam)
    sc.collection.objects.link(co); sc.camera = co
    for tag, loc, tgt, lens in (("a", (3.0, 7.5, 3.2), (0, 0.0, 0.3), 24), ("b", (-6.5, -4.0, 2.4), (0, -1.5, 0.4), 24)):
        cam.lens = lens
        co.location = loc
        d = Vector(tgt) - co.location
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = path.replace(".png", "_%s.png" % tag)
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(co)


def build():
    high, info = stage_shape()
    NAME = P["name"]
    # head/stern zone weights (keep the prow readable through decimation)
    vg = high.vertex_groups.new(name="keep")
    for v in high.data.vertices:
        L = -v.co.y
        wgt = max(smooth(info["bow_start"] - 0.4, info["bow_start"] + 0.1, L),
                  smooth(-info["stern_start"] - 0.2, -info["stern_start"] + 0.3, -L))
        if abs(v.co.z - FLOOR_Y) < 0.004 and info["open_stern"] < L < info["open_bow"]:
            wgt = 1.0   # the cut floor
        vg.add([v.index], wgt, "REPLACE")
    low = high.copy(); low.data = high.data.copy(); low.name = NAME
    bpy.context.scene.collection.objects.link(low)
    while low.data.uv_layers:   # the Tripo UV seams block the collapse; the low gets fresh UVs anyway
        low.data.uv_layers.remove(low.data.uv_layers[0])
    head0 = sum(1 for p in low.data.polygons if -p.center.y > info["bow_start"] - 0.3)
    # pass 1: the hull only (prow/stern zones locked), pass 2: everything down to the budget
    probe(low, "pre-dec")
    _z, _t = rim_tops(high)
    log("high rim median", round(sorted(t for t in _t if t)[len([t for t in _t if t]) // 2], 3))
    decimate(low, 3050, vgroup="keep", vfac=1.0)   # pass 1: hull only (prow/stern zones and floor locked)
    probe(low, "pass1")
    decimate(low, 3050)                            # pass 2: everything down to the budget
    snap_floor(low, info)
    probe(low, "decimated")
    log("head-zone faces", head0, "->", sum(1 for p in low.data.polygons if -p.center.y > info["bow_start"] - 0.3))
    # benches and the drummer's seat: bake sources (separate) + unioned into the low hull
    mb = mat_bench()
    bh, bparts = bench_parts(info, mb)
    for bl in bparts:   # leg first, then the plank on top of it
        boolean(low, bl, 'UNION')
        bpy.data.objects.remove(bl)
    keep_largest(low)
    probe(low, "unions")
    log("LOD0 tris", tris(low))
    for g in list(low.vertex_groups):
        low.vertex_groups.remove(g)
    # LOD1 from the LOD0 shape (before UVs, so the collapse is free)
    # LOD1: voxel remesh of the closed, cut high shell (the collapse stalls near 2k tris on the cut shell),
    # decimate, then plain benches unioned in
    l1 = high.copy(); l1.data = high.data.copy(); l1.name = NAME + "_LOD1"
    bpy.context.scene.collection.objects.link(l1)
    for g in list(l1.vertex_groups):
        l1.vertex_groups.remove(g)
    while l1.data.uv_layers:
        l1.data.uv_layers.remove(l1.data.uv_layers[0])
    rm = l1.modifiers.new("rm", 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.02; rm.adaptivity = 0.0
    bpy.context.view_layer.objects.active = l1
    for o in bpy.context.scene.objects:
        o.select_set(o is l1)
    bpy.ops.object.modifier_apply(modifier=rm.name)
    keep_largest(l1)
    decimate(l1, 960 - 190)
    snap_floor(l1, info)
    for (z, half_w) in [(r, None) for r in ROWS] + [(DRUM_SEAT_Z, 0.24)]:
        prof = info["profile"]
        hw = half_w if half_w else min(min(prof, key=lambda p: abs(p[0] - zz))[3] for zz in (z - 0.16, z, z + 0.16)) + 0.025
        d = 0.16 if half_w is None else 0.13
        for args in ((-0.07, 0.07, 0.0, BENCH_TOP - 0.045, z - 0.09, z + 0.09),
                     (-hw, hw, BENCH_TOP - 0.055, BENCH_TOP, z - d, z + d)):
            bx = box("b1", *args)
            boolean(l1, bx, 'UNION')
            bpy.data.objects.remove(bx)
    keep_largest(l1)
    log("LOD1 tris", tris(l1))
    for o in (low, l1):
        restore_rim(o, info)
        restore_rim(o, info)
        enforce_open(o)
        cleanup_faces(o)
        keep_largest(o)
        orient_like(o, [high] + bh)
    # drum
    dm = [mat_drum_body(), mat_flat("M_drum_rim", P["drum_rim"]), mat_flat("M_drum_skin", P["drum_skin"])]
    drum = make_drum(dm)
    drum_hi = drum.copy(); drum_hi.data = drum.data.copy(); bpy.context.scene.collection.objects.link(drum_hi)
    log("Drum tris", tris(drum))
    for o, ang in ((low, 55), (l1, 55), (drum, 40)):
        smooth_by_angle(o, ang)   # organic Tripo surfaces read faceted below ~50 deg after decimation
    drum.vertex_groups.new(name="DRUM").add(list(range(len(drum.data.vertices))), 1.0, 'REPLACE')
    l1.vertex_groups.new(name="L1").add(list(range(len(l1.data.vertices))), 1.0, 'REPLACE')
    joined = join([low, drum, l1])
    # one texture: LOD0 + drum in the left 74 %, LOD1 in the right strip
    uv_unwrap(joined, [(None, 0.0, 0.74, 0.0, 1.0), ("L1", 0.75, 1.0, 0.0, 1.0)])
    imc, imn = bake_maps(joined, [high, drum_hi] + bh)

    def split(grp, name):
        bpy.context.view_layer.objects.active = joined
        for o in bpy.context.scene.objects:
            o.select_set(o is joined)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        joined.vertex_groups.active_index = joined.vertex_groups[grp].index
        bpy.ops.object.vertex_group_select()
        before = set(bpy.context.scene.objects)
        bpy.ops.mesh.separate(type='SELECTED')
        bpy.ops.object.mode_set(mode='OBJECT')
        o = [x for x in bpy.context.scene.objects if x not in before][0]
        o.name = name; o.data.name = name
        return o
    l1 = split("L1", NAME + "_LOD1")
    drum = split("DRUM", "Drum")
    low = joined; low.name = NAME; low.data.name = NAME
    for o in (low, l1, drum):
        for g in list(o.vertex_groups):
            o.vertex_groups.remove(g)
    # textures
    pc = os.path.join(TMP, NAME + "_BaseColor.jpg"); pn = os.path.join(TMP, NAME + "_Normal.jpg")
    for img, p, q in ((imc, pc, 78), (imn, pn, 80)):
        img.file_format = 'JPEG'
        img.save(filepath=p, quality=q)
    imc = bpy.data.images.load(pc); imn = bpy.data.images.load(pn)
    imn.colorspace_settings.is_data = True
    imc.name = NAME + "_BaseColor"; imn.name = NAME + "_Normal"
    fm = final_material(imc, imn, use_normal=True)
    for o in (low, l1, drum):
        o.data.materials.clear(); o.data.materials.append(fm)
        for p in o.data.polygons: p.material_index = 0
    # seats
    seats = []
    # dispatcher correction: facing the bow (+Z) with +Y up, the rider's LEFT is +X
    for nm, x, z in (("Seat_L1", SEAT_X, 2.3), ("Seat_R1", -SEAT_X, 2.3), ("Seat_L2", SEAT_X, 0.6),
                     ("Seat_R2", -SEAT_X, 0.6), ("Seat_L3", SEAT_X, -1.1), ("Seat_R3", -SEAT_X, -1.1),
                     ("Seat_Drum", 0.0, DRUM_SEAT_Z)):
        e = bpy.data.objects.new(nm, None); e.empty_display_size = 0.15
        e.location = (x, -z, BENCH_TOP)
        bpy.context.scene.collection.objects.link(e)
        seats.append(e)
    # drop bake sources, export
    for o in [high, drum_hi] + bh:
        bpy.data.objects.remove(o)
    keep = [low, l1, drum] + seats
    for o in list(bpy.context.scene.objects):
        if o not in keep:
            bpy.data.objects.remove(o)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    for o in (low, l1, drum):
        o.data.name = o.name
    os.makedirs(OUT, exist_ok=True)
    gl = os.path.join(OUT, NAME + ".glb")
    for o in bpy.context.scene.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=gl, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_image_format='AUTO',
                              export_tangents=False, export_cameras=False, export_lights=False,
                              export_animations=False, export_draco_mesh_compression_enable=False,
                              export_extras=False)
    log("exported", gl, os.path.getsize(gl), "tris", tris(low), tris(l1), tris(drum))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(TMP, NAME + "_final.blend"), compress=True)


if __name__ == "__main__":
    if STAGE == "shape":
        ob, info = stage_shape()
        look(os.path.join(TMP, "look_%s.png" % BOAT))
    else:
        build()
