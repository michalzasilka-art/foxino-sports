"""Ice cave W2, lane B: ice formations (icicle clusters, ice pillars, ice crystals, ice-capped rocks).

Run inside Blender 5.2 (live MCP or headless):
    ns = {}; exec(open(PATH).read(), ns); ns["build_all"]()
Each model: a dense smooth source (lathe / voxel-remeshed union) -> Decimate collapse to the
budget -> smooth-shaded low mesh -> Smart UV -> Cycles bake (normal + base colour; rocks also
roughness + emission mask) from the dense source -> one PBR material -> GLB (+Y up, tangents).
Blender is Z-up; the glTF exporter maps Blender Z to glTF +Y.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

SCN = "IceCave_W2_B"
TEX_DIR = os.environ.get("IB_TEX_DIR", "")
OUT_DIR = os.environ.get("IB_OUT_DIR", "")
TEX = 512

# palette (sRGB hex -> linear in the node helpers)
ICE_DEEP = "2f78c4"
ICE_MID = "58b4e6"
ICE_LIGHT = "a6e4f7"
FROST = "d4eef8"
ROCK_DARK = "55627a"
ROCK_MID = "6f7e96"
ROCK_LIGHT = "8e9cb2"
ICE_EMIT = "6fd8ff"

BUDGET = {"SM_Icicle_Cluster": 400, "SM_Ice_Pillar": 600, "SM_Ice_Crystal": 300, "SM_Rock_Ice": 500}


def srgb(h, a=1.0):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


# ---------------------------------------------------------------- scene / objects
def scene():
    sc = bpy.data.scenes.get(SCN) or bpy.data.scenes.new(SCN)
    if bpy.context.window:
        bpy.context.window.scene = sc
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    return sc


def link(ob):
    sc = scene()
    if ob.name not in sc.collection.objects:
        sc.collection.objects.link(ob)
    return ob


def bm_to_obj(bm, name):
    old = bpy.data.objects.get(name)
    if old:
        me_old = old.data
        bpy.data.objects.remove(old, do_unlink=True)
        if me_old and me_old.users == 0:
            bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    return link(ob)


def tris(ob):
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    return sum(len(p.vertices) - 2 for p in me.polygons)


def fbm(p, oct=3, lac=2.0, gain=0.5):
    s, a, f = 0.0, 1.0, 1.0
    for _ in range(oct):
        s += a * noise.noise(p * f)
        a *= gain
        f *= lac
    return s


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- primitives
def lathe(bm, prof, seg, rad_fn=None, center_fn=None):
    """prof: [(z, r)], r <= 1e-5 -> a pole vertex. Caps the ends that have r > 0 (flat)."""
    rings = []
    for z, r in prof:
        cx, cy = center_fn(z) if center_fn else (0.0, 0.0)
        if r <= 1e-5:
            rings.append([bm.verts.new((cx, cy, z))])
            continue
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            rr = rad_fn(a, z, r) if rad_fn else r
            ring.append(bm.verts.new((cx + rr * math.cos(a), cy + rr * math.sin(a), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for i in range(seg):
                bm.faces.new((A[0], B[i], B[(i + 1) % seg]))
        elif len(B) == 1:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[0]))
        else:
            for i in range(seg):
                j = (i + 1) % seg
                bm.faces.new((A[i], A[j], B[j], B[i]))
    for ring in (rings[0], rings[-1]):
        if len(ring) > 2:
            bm.faces.new(ring)
    return rings


def ellipsoid(bm, c, r, seg=32, rings=16):
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in res["verts"]:
        v.co = Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))
    return res["verts"]


def remesh(ob, voxel, smooth_iter=0, smooth_fac=0.5):
    m = ob.modifiers.new("Remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = voxel
    m.adaptivity = 0.0
    m.use_smooth_shade = True
    if smooth_iter:
        s = ob.modifiers.new("Smooth", "SMOOTH")
        s.factor = smooth_fac
        s.iterations = smooth_iter
    apply_mods(ob)


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    me.name = ob.name


def cut_plane(ob, z, keep_below, fill=False):
    """Bisect at height z and drop the side we don't keep. The cut is left open by default: it is the
    face that sits flush on the floor / ceiling, never seen by the game camera (saves tris and UV space)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=(0, 0, z),
                                 plane_no=(0, 0, 1), clear_outer=keep_below, clear_inner=not keep_below)
    cut_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    for v in bm.verts:
        if abs(v.co.z - z) < 1e-4:
            v.co.z = z
    bnd = [e for e in bm.edges if e.is_boundary]
    if bnd and fill:
        bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=bnd)
    orient_outward(bm)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(cut_edges)


def orient_outward(bm):
    """Open meshes confuse recalc_face_normals; keep the (consistent) winding and only flip all
    faces if the area-weighted normals point toward the centroid."""
    bm.normal_update()
    if not bm.faces:
        return 0.0
    c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    s = sum(f.normal.dot(f.calc_center_median() - c) * f.calc_area() for f in bm.faces)
    if s < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.normal_update()
    return s


def keep_largest_island(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen, islands = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, isl = [v], []
        seen.add(v.index)
        while stack:
            w = stack.pop()
            isl.append(w)
            for e in w.link_edges:
                o = e.other_vert(w)
                if o.index not in seen:
                    seen.add(o.index)
                    stack.append(o)
        islands.append(isl)
    islands.sort(key=len, reverse=True)
    dropped = 0
    for isl in islands[1:]:
        dropped += len(isl)
        bmesh.ops.delete(bm, geom=isl, context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    return len(islands), dropped


# ---------------------------------------------------------------- model sources (dense)
def src_icicles(name, seed, width, depth, icicles):
    """icicles: [(x, y, length, r0, bend_x, bend_y)] hanging from a lump whose top is cut flat at z=0."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    # attach lump: a few overlapping flattened blobs under the ceiling
    ellipsoid(bm, (0, 0, -0.02), (width * 0.5, depth * 0.5, 0.13), 40, 20)
    for (x, y, L, r0, bx, by) in icicles:
        ellipsoid(bm, (x * 0.9, y * 0.9, -0.05), (r0 * 1.9, r0 * 1.7, 0.12 + 0.05 * L), 24, 12)
    for (x, y, L, r0, bx, by) in icicles:
        n = max(24, int(L * 60))
        ph = rnd.uniform(0, 6.28)
        fr = rnd.uniform(5.0, 7.5)
        prof = []
        for k in range(n + 1):
            t = k / n
            z = -0.04 - t * L
            if k == n:
                prof.append((z - 0.004, 0.0))
                continue
            r = r0 * (1 - t) ** 0.8 + 0.006
            r *= 1 + 0.10 * math.sin(fr * t * 6.283 + ph) * (1 - t * 0.5)
            prof.append((z, r))
        off = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0)) * 7.0

        def rad_fn(a, z, r, off=off):
            p = Vector((math.cos(a) * 1.3, math.sin(a) * 1.3, z * 2.2)) + off
            return r * (1 + 0.09 * noise.noise(p))

        def ctr(z, x=x, y=y, L=L, bx=bx, by=by):
            t = min(1.0, max(0.0, (-z - 0.04) / L))
            return (x + bx * t * t, y + by * t * t)

        lathe(bm, prof, 20, rad_fn, ctr)
    ob = bm_to_obj(bm, name + "_HI")
    voxel = 0.009
    remesh(ob, voxel, smooth_iter=3, smooth_fac=0.5)
    cut_plane(ob, 0.0, keep_below=True)
    keep_largest_island(ob)
    return ob


def _angd(a, b):
    return (a - b + math.pi) % (2 * math.pi) - math.pi


def flow_rad_fn(rnd, off, z_lo, z_hi, n_streams, n_lumps, lobes, lobe_amp, base_z, top_z):
    """Radius modifier: frozen drip streams (vertical ridges that wander), drip lumps, lobed flares."""
    streams = [(rnd.uniform(0, 6.283), rnd.uniform(0.18, 0.32), rnd.uniform(0.06, 0.11),
                rnd.uniform(z_lo, z_lo + 1.5), rnd.uniform(z_hi - 1.5, z_hi), rnd.uniform(0.3, 0.7))
               for _ in range(n_streams)]
    lumps = [(rnd.uniform(0, 6.283), rnd.uniform(z_lo + 0.4, z_hi - 0.4), rnd.uniform(0.25, 0.45),
              rnd.uniform(0.2, 0.4), rnd.uniform(0.05, 0.09)) for _ in range(n_lumps)]
    ph_b, ph_t = rnd.uniform(0, 6.283), rnd.uniform(0, 6.283)

    def rad_fn(a, z, r):
        add = 0.0
        for (a0, w, amp, zs, ze, wig) in streams:
            if zs - 0.3 < z < ze + 0.3:
                ac = a0 + wig * math.sin(z * 0.8 + a0 * 3)
                env = smoothstep(zs - 0.3, zs + 0.3, z) * (1 - smoothstep(ze - 0.3, ze + 0.3, z))
                add += amp * env * math.exp(-(_angd(a, ac) / w) ** 2)
        for (a0, zc, wa, wz, amp) in lumps:
            add += amp * math.exp(-(_angd(a, a0) / wa) ** 2 - ((z - zc) / wz) ** 2)
        fb = math.exp(-((z - base_z) / 0.55) ** 2)
        ft = math.exp(-((top_z - z) / 0.65) ** 2)
        add += lobe_amp * fb * math.cos(lobes * a + ph_b) + lobe_amp * ft * math.cos((lobes + 1) * a + ph_t)
        p = Vector((math.cos(a) * 1.3, math.sin(a) * 1.3, z * 0.8)) + off
        return r * (1 + 0.05 * fbm(p, 2)) + add

    return rad_fn


def src_pillar(name, seed, kind):
    rnd = random.Random(seed)
    H = 6.2
    off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50)))
    bm = bmesh.new()

    def ctr(z):
        return (0.06 * math.sin(z * 0.7 + seed), 0.05 * math.cos(z * 0.55 + seed * 2))

    if kind == 1:
        n = 160
        prof = []
        for k in range(n + 1):
            z = H * k / n
            r = 0.42 + 0.30 * math.exp(-(z / 0.5) ** 2) + 0.10 * math.exp(-(z / 1.6) ** 2)
            r += 0.26 * math.exp(-((H - z) / 0.6) ** 2) + 0.10 * math.exp(-((H - z) / 1.8) ** 2)
            r += 0.025 * math.sin(z * 2.1 + 0.6)
            prof.append((z, r))
        rf0 = flow_rad_fn(rnd, off, 0.0, H, 4, 6, 3, 0.06, 0.0, H)

        def rf(a, z, r):  # soft frozen ripple rings on top of the flow
            return rf0(a, z, r) + 0.03 * math.sin(z * 5.0 + 0.9 * math.sin(2 * a + z * 0.4)) * (0.6 + 0.4 * math.sin(a * 3 + z))

        lathe(bm, prof, 64, rf, ctr)
        voxel = 0.02
    else:
        # stalagmite rising from the floor + a drip hanging from the ceiling, fused around z = 3.3
        n = 120
        lo_prof, hi_prof = [], []
        zt = 3.75
        for k in range(n + 1):
            z = zt * k / n
            t = z / zt
            r = 0.30 + 0.28 * (1 - t) ** 1.6 + 0.20 * math.exp(-(z / 0.6) ** 2)
            if t > 0.9:
                r *= math.sqrt(max(0.0, 1 - ((t - 0.9) / 0.1) ** 2)) * 0.9 + 0.1
            lo_prof.append((z, r if k < n else 0.0))
        zb = 2.85
        for k in range(n + 1):
            z = H - (H - zb) * k / n
            t = (H - z) / (H - zb)
            r = 0.27 + 0.30 * (1 - t) ** 1.4 + 0.22 * math.exp(-((H - z) / 0.7) ** 2)
            if t > 0.85:
                r *= max(0.0, 1 - (t - 0.85) / 0.15) * 0.85 + 0.15
            hi_prof.append((z, r if k < n else 0.0))
        rf1 = flow_rad_fn(rnd, off, 0.0, zt, 4, 4, 4, 0.06, 0.0, 99)
        rf2 = flow_rad_fn(rnd, off + Vector((9, 3, 1)), zb, H, 6, 5, 3, 0.07, -99, H)
        lathe(bm, lo_prof, 56, rf1, lambda z: (0.05, -0.04))
        lathe(bm, hi_prof, 56, rf2, lambda z: (-0.06 + 0.02 * math.sin(z), 0.05))
        voxel = 0.02
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = bm_to_obj(bm, name + "_HI")
    # extend past the floor/ceiling planes so the cuts are clean, then union + smooth
    for v in ob.data.vertices:
        if v.co.z <= 1e-6:
            v.co.z = -0.1
        elif v.co.z >= H - 1e-6:
            v.co.z = H + 0.1
    remesh(ob, voxel, smooth_iter=4, smooth_fac=0.5)
    cut_plane(ob, 0.0, keep_below=False)
    cut_plane(ob, H, keep_below=True)
    keep_largest_island(ob)
    return ob


def src_crystals(name, seed, mound, crystals):
    """crystals: [(x, y, height, radius, tilt_deg, azimuth_deg, spin_deg)]"""
    rnd = random.Random(seed)
    bm = bmesh.new()
    ellipsoid(bm, (0, 0, 0.0), mound, 40, 20)
    for _ in range(5):  # lumpy frozen mound
        a = rnd.uniform(0, 6.283)
        d = rnd.uniform(0.4, 0.75)
        ellipsoid(bm, (math.cos(a) * mound[0] * d, math.sin(a) * mound[1] * d, 0.0),
                  (mound[0] * rnd.uniform(0.35, 0.5), mound[1] * rnd.uniform(0.35, 0.5), mound[2] * rnd.uniform(0.9, 1.3)), 24, 12)
    for (x, y, h, rc, tilt, az, spin) in crystals:
        tip = rc * 1.1
        geo = []
        for zz in (-0.25, h - tip):
            ring = []
            for i in range(6):
                a = math.radians(spin + 60 * i)
                ring.append(bm.verts.new((rc * math.cos(a), rc * math.sin(a), zz)))
            geo.append(ring)
        top = bm.verts.new((0, 0, h))
        A, B = geo
        for i in range(6):
            j = (i + 1) % 6
            bm.faces.new((A[i], A[j], B[j], B[i]))
            bm.faces.new((B[i], B[j], top))
        bm.faces.new(list(reversed(A)))
        vs = A + B + [top]
        rot = (Vector((0, 0, 1)).rotation_difference(
            Vector((math.sin(math.radians(tilt)) * math.cos(math.radians(az)),
                    math.sin(math.radians(tilt)) * math.sin(math.radians(az)),
                    math.cos(math.radians(tilt))))))
        for v in vs:
            v.co = rot @ v.co + Vector((x, y, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = bm_to_obj(bm, name + "_HI")
    remesh(ob, 0.006, smooth_iter=12, smooth_fac=0.6)
    cut_plane(ob, 0.0, keep_below=False)
    keep_largest_island(ob)
    return ob


def src_rock(name, seed, scale, lift, drips, cap_h=0.6, thick=0.13):
    """Rock = displaced sphere; ice = the rock's upper skin pushed out (thickness field with drip tongues)."""
    rnd = random.Random(seed)
    off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50)))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=6, radius=1.0)
    for v in bm.verts:
        p = v.co.normalized()
        d = 1 + 0.16 * fbm(p * 1.1 + off, 3) + 0.05 * noise.noise(p * 3.0 + off)
        v.co = Vector((p.x * d * scale[0], p.y * d * scale[1], p.z * d * scale[2] + lift))
    bm.normal_update()
    rock_bm = bm.copy()
    zs = [v.co.z for v in bm.verts]
    z0, z1 = 0.0, max(zs)
    ice = bm  # displace in place to make the ice skin
    vnorm = {v.index: v.normal.copy() for v in ice.verts}
    for v in ice.verts:
        h = (v.co.z - z0) / (z1 - z0)
        th = math.atan2(v.co.y, v.co.x)
        ht = cap_h
        for (ang, depth, w) in drips:
            da = (th - math.radians(ang) + math.pi) % (2 * math.pi) - math.pi
            ht -= depth * math.exp(-(da / w) ** 2)
        ht += 0.03 * noise.noise(v.co * 4 + off)
        cap = smoothstep(ht - 0.03, ht + 0.07, h)
        t = thick * cap * (1 + 0.25 * noise.noise(v.co * 2.5 + off)) - 0.035
        v.co += vnorm[v.index] * t
    ice_me = bpy.data.meshes.new(name + "_ICEtmp")
    ice.to_mesh(ice_me)
    rock_me = bpy.data.meshes.new(name + "_ROCKtmp")
    rock_bm.to_mesh(rock_me)
    bvh_ice = BVHTree.FromBMesh(ice)
    bvh_rock = BVHTree.FromBMesh(rock_bm)
    both = bmesh.new()
    both.from_mesh(rock_me)
    both.from_mesh(ice_me)
    ob = bm_to_obj(both, name + "_HI")
    for me in (ice_me, rock_me):
        bpy.data.meshes.remove(me)
    remesh(ob, 0.010, smooth_iter=2, smooth_fac=0.5)
    cut_plane(ob, 0.0, keep_below=False)
    keep_largest_island(ob)
    # centre the footprint on the origin
    me = ob.data
    base = [v.co for v in me.vertices if v.co.z < 0.02]
    cx = (min(p.x for p in base) + max(p.x for p in base)) / 2
    cy = (min(p.y for p in base) + max(p.y for p in base)) / 2
    for v in me.vertices:
        v.co.x -= cx
        v.co.y -= cy
    # material split: ice where the surface is closer to the ice skin than to the rock
    assign_rock_ice(ob, bvh_ice, bvh_rock, Vector((cx, cy, 0)))
    ob["ib_rock_ice"] = True
    ob["ib_shift"] = (cx, cy)
    ice.free()
    rock_bm.free()
    return ob


def assign_rock_ice(ob, bvh_ice, bvh_rock, shift):
    me = ob.data
    while len(me.materials) < 2:
        me.materials.append(None)
    for p in me.polygons:
        c = p.center + shift
        hi = bvh_ice.find_nearest(c)
        hr = bvh_rock.find_nearest(c)
        di = hi[3] if hi[0] else 9
        dr = hr[3] if hr[0] else 9
        p.material_index = 1 if di < dr - 0.004 else 0


# ---------------------------------------------------------------- low poly
def make_low(hi, name, target):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    if bpy.data.meshes.get(name):
        bpy.data.meshes.remove(bpy.data.meshes[name])
    me = hi.data.copy()
    me.name = name
    lo = link(bpy.data.objects.new(name, me))
    lo.location = hi.location
    n = tris(lo)
    for _ in range(6):
        if n <= target:
            break
        m = lo.modifiers.new("Dec", "DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.ratio = (target * (0.985 if _ == 0 else 0.995)) / n
        m.use_collapse_triangulate = True
        apply_mods(lo)
        n = tris(lo)
    return lo


def finish_low(lo, flat_z=(), hang=False):
    """Snap flat caps, clean, smooth shade everything, recalc normals."""
    bm = bmesh.new()
    bm.from_mesh(lo.data)
    for v in bm.verts:
        for z in flat_z:
            if abs(v.co.z - z) < 0.012:
                v.co.z = z
        if hang and v.co.z > 0:
            v.co.z = 0.0
        if not hang and v.co.z < 0:
            v.co.z = 0.0
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges[:])
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    orient_outward(bm)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(lo.data)
    bm.free()
    me = lo.data
    for a in ("sharp_edge", "sharp_face"):
        if a in me.attributes:
            me.attributes.remove(me.attributes[a])
    me.update()


def uv_unwrap(lo, margin=0.012):
    sc = scene()
    for o in sc.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = lo
    lo.select_set(True)
    me = lo.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=margin,
                             area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


# ---------------------------------------------------------------- materials
def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bs.location = (300, 0)
    nt.links.new(bs.outputs["BSDF"], out.inputs["Surface"])
    return nt, bs


def _ramp(nt, fac_socket, stops, loc):
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.location = loc
    el = r.color_ramp.elements
    while len(el) > len(stops):
        el.remove(el[-1])
    while len(el) < len(stops):
        el.new(0.5)
    for e, (pos, col) in zip(el, stops):
        e.position = pos
        e.color = srgb(col)
    nt.links.new(fac_socket, r.inputs["Fac"])
    return r


def hi_material_ice(name, hang=False, length=1.0, bump=0.35):
    """Procedural source look for baking: deep-blue core variation, cyan, frost streaks; soft bump."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt, bs = _nodes(mat)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tc.location = (-1400, 0)
    # big colour variation
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.location = (-1100, 200)
    n1.inputs["Scale"].default_value = 1.6
    n1.inputs["Detail"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    ramp = _ramp(nt, n1.outputs["Fac"], [(0.30, ICE_DEEP), (0.52, ICE_MID), (0.72, ICE_LIGHT)], (-850, 200))
    # vertical frost streaks
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.location = (-1150, -150)
    mp.inputs["Scale"].default_value = (4.0, 4.0, 0.8)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.location = (-950, -150)
    n2.inputs["Scale"].default_value = 1.8
    n2.inputs["Detail"].default_value = 2.0
    nt.links.new(mp.outputs["Vector"], n2.inputs["Vector"])
    fr = nt.nodes.new("ShaderNodeMapRange")
    fr.location = (-750, -150)
    fr.inputs["From Min"].default_value = 0.55
    fr.inputs["From Max"].default_value = 0.78
    fr.inputs["To Max"].default_value = 0.35
    nt.links.new(n2.outputs["Fac"], fr.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.location = (-500, 100)
    nt.links.new(fr.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], mix.inputs[6])
    mix.inputs[7].default_value = srgb(FROST)
    col_out = mix.outputs[2]
    if hang:
        # lighter, more cyan toward the tips (z goes down to -length)
        sx = nt.nodes.new("ShaderNodeSeparateXYZ")
        sx.location = (-950, -400)
        nt.links.new(tc.outputs["Object"], sx.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.location = (-750, -400)
        mr.inputs["From Min"].default_value = -0.1
        mr.inputs["From Max"].default_value = -length
        mr.inputs["To Max"].default_value = 0.55
        nt.links.new(sx.outputs["Z"], mr.inputs["Value"])
        m2 = nt.nodes.new("ShaderNodeMix")
        m2.data_type = "RGBA"
        m2.location = (-250, 100)
        nt.links.new(mr.outputs["Result"], m2.inputs["Factor"])
        nt.links.new(col_out, m2.inputs[6])
        m2.inputs[7].default_value = srgb(ICE_LIGHT)
        col_out = m2.outputs[2]
    nt.links.new(col_out, bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.12
    bs.inputs["Emission Color"].default_value = srgb(ICE_EMIT)
    bs.inputs["Emission Strength"].default_value = 1.0
    # soft bump: smooth ripples + vertical melt streaks
    n3 = nt.nodes.new("ShaderNodeTexNoise")
    n3.location = (-750, -650)
    n3.inputs["Scale"].default_value = 5.0
    n3.inputs["Detail"].default_value = 2.0
    nt.links.new(tc.outputs["Object"], n3.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    add.location = (-450, -650)
    nt.links.new(n3.outputs["Fac"], add.inputs[0])
    nt.links.new(n2.outputs["Fac"], add.inputs[1])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.location = (-200, -500)
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.02
    nt.links.new(add.outputs["Value"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])
    return mat


def hi_material_rock(name):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt, bs = _nodes(mat)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tc.location = (-1300, 0)
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.location = (-1050, 150)
    n1.inputs["Scale"].default_value = 2.5
    n1.inputs["Detail"].default_value = 5.0
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    _r = _ramp(nt, n1.outputs["Fac"], [(0.32, ROCK_DARK), (0.5, ROCK_MID), (0.70, ROCK_LIGHT)], (-800, 150))
    nt.links.new(_r.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.7
    bs.inputs["Emission Color"].default_value = (0, 0, 0, 1)
    bs.inputs["Emission Strength"].default_value = 1.0
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.location = (-800, -300)
    vo.feature = "SMOOTH_F1"
    vo.inputs["Scale"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    add.location = (-500, -300)
    nt.links.new(vo.outputs["Distance"], add.inputs[0])
    nt.links.new(n1.outputs["Fac"], add.inputs[1])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.location = (-250, -300)
    bp.inputs["Strength"].default_value = 0.45
    bp.inputs["Distance"].default_value = 0.03
    nt.links.new(add.outputs["Value"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])
    return mat


def new_image(name, data=False):
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, TEX, TEX, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color" if data else "sRGB"
    img.generated_color = (0.5, 0.5, 1.0, 1.0) if data else (0.3, 0.6, 0.8, 1.0)
    return img


def save_image(img):
    path = os.path.join(TEX_DIR, img.name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    img.filepath = path
    img.reload()
    return path


def bake(hi, lo, rock, extrusion, ray):
    sc = scene()
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 8
    sc.render.bake.margin = 6
    sc.render.bake.margin_type = "EXTEND"
    sc.render.bake.use_selected_to_active = True
    sc.render.bake.cage_extrusion = extrusion
    sc.render.bake.max_ray_distance = ray
    sc.render.bake.normal_space = "TANGENT"
    sc.render.bake.target = "IMAGE_TEXTURES"
    base = lo.name
    imgs = {"col": new_image("T_" + base[3:] + "_BaseColor"), "nrm": new_image("T_" + base[3:] + "_Normal", True)}
    if rock:
        imgs["rgh"] = new_image("T_" + base[3:] + "_Roughness", True)
        imgs["emi"] = new_image("T_" + base[3:] + "_Emission")
    # bake target material on the low
    bm_mat = bpy.data.materials.new(base + "_BAKE")
    bm_mat.use_nodes = True
    tnode = bm_mat.node_tree.nodes.new("ShaderNodeTexImage")
    lo.data.materials.clear()
    lo.data.materials.append(bm_mat)
    for p in lo.data.polygons:
        p.material_index = 0
    for o in sc.objects:
        o.select_set(False)
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    passes = [("nrm", "NORMAL", set()), ("col", "DIFFUSE", {"COLOR"})]
    if rock:
        passes += [("rgh", "ROUGHNESS", set()), ("emi", "EMIT", set())]
    for key, typ, filt in passes:
        tnode.image = imgs[key]
        bm_mat.node_tree.nodes.active = tnode
        if filt:
            bpy.ops.object.bake(type=typ, pass_filter=filt, use_selected_to_active=True,
                                cage_extrusion=extrusion, max_ray_distance=ray, margin=6)
        else:
            bpy.ops.object.bake(type=typ, use_selected_to_active=True,
                                cage_extrusion=extrusion, max_ray_distance=ray, margin=6)
        save_image(imgs[key])
    lo.data.materials.clear()
    bpy.data.materials.remove(bm_mat)
    return imgs


def final_material(lo, imgs, rock):
    name = "M_" + lo.name[3:]
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    nt, bs = _nodes(mat)
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
    tn = tex(imgs["nrm"], (-500, -300))
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.location = (-150, -300)
    nm.uv_map = "UVMap"
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
    bs.inputs["Metallic"].default_value = 0.0
    if rock:
        tr = tex(imgs["rgh"], (-500, 0))
        sp = nt.nodes.new("ShaderNodeSeparateColor")
        sp.location = (-200, 0)
        nt.links.new(tr.outputs["Color"], sp.inputs["Color"])
        nt.links.new(sp.outputs["Green"], bs.inputs["Roughness"])
        te = tex(imgs["emi"], (-500, -650))
        nt.links.new(te.outputs["Color"], bs.inputs["Emission Color"])
    else:
        bs.inputs["Roughness"].default_value = 0.12
        bs.inputs["Emission Color"].default_value = srgb(ICE_EMIT)
    bs.inputs["Emission Strength"].default_value = 0.1
    lo.data.materials.clear()
    lo.data.materials.append(mat)
    return mat


# ---------------------------------------------------------------- export
def export_glb(lo, path):
    sc = scene()
    loc = lo.location.copy()
    lo.location = (0, 0, 0)
    for o in sc.objects:
        o.select_set(False)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True,
        export_yup=True, export_texcoords=True, export_normals=True, export_tangents=True,
        export_materials="EXPORT", export_image_format="AUTO", export_cameras=False,
        export_lights=False, export_animations=False, export_skins=False, export_morph=False,
        export_extras=False, export_draco_mesh_compression_enable=False)
    lo.location = loc
    return os.path.getsize(path)


# ---------------------------------------------------------------- jobs
JOBS = {
    "SM_Icicle_Cluster_1": dict(kind="icicles", seed=11, width=0.95, depth=0.55, hang=True, length=0.6, icicles=[
        (-0.34, 0.06, 0.38, 0.055, 0.01, 0.0), (-0.18, -0.10, 0.52, 0.065, -0.01, 0.01),
        (0.00, 0.08, 0.60, 0.075, 0.0, -0.02), (0.17, -0.06, 0.46, 0.06, 0.02, 0.0),
        (0.33, 0.07, 0.32, 0.05, 0.0, 0.01), (-0.06, -0.16, 0.26, 0.045, 0.0, 0.0),
        (0.10, 0.18, 0.30, 0.045, 0.01, 0.01)]),
    "SM_Icicle_Cluster_2": dict(kind="icicles", seed=23, width=0.65, depth=0.45, hang=True, length=1.2, icicles=[
        (-0.18, 0.02, 0.78, 0.075, 0.02, 0.0), (0.0, -0.05, 1.20, 0.10, 0.0, 0.03),
        (0.17, 0.06, 0.92, 0.08, -0.02, 0.0), (0.06, 0.14, 0.45, 0.055, 0.0, 0.0),
        (-0.08, -0.15, 0.55, 0.055, 0.01, -0.01)]),
    "SM_Icicle_Cluster_3": dict(kind="icicles", seed=37, width=0.6, depth=0.5, hang=True, length=2.0, icicles=[
        (0.0, 0.0, 2.00, 0.15, 0.03, 0.02), (-0.20, 0.06, 1.25, 0.09, -0.03, 0.0),
        (0.19, -0.05, 1.45, 0.10, 0.03, -0.01), (0.04, 0.17, 0.70, 0.06, 0.0, 0.02)]),
    "SM_Ice_Pillar_1": dict(kind="pillar", seed=5, pk=1),
    "SM_Ice_Pillar_2": dict(kind="pillar", seed=9, pk=2),
    "SM_Ice_Crystal_1": dict(kind="crystal", seed=3, mound=(0.44, 0.38, 0.20), crystals=[
        (0.0, 0.0, 1.00, 0.19, 6, 30, 0), (-0.20, 0.11, 0.68, 0.14, 24, 160, 10),
        (0.21, 0.06, 0.60, 0.13, 26, 15, 20), (0.05, -0.19, 0.50, 0.12, 30, 280, 5),
        (-0.12, -0.15, 0.38, 0.10, 38, 220, 30)]),
    "SM_Ice_Crystal_2": dict(kind="crystal", seed=4, mound=(0.52, 0.42, 0.18), crystals=[
        (-0.14, 0.02, 0.82, 0.16, 10, 150, 0), (0.15, 0.05, 0.72, 0.15, 14, 20, 15),
        (0.02, 0.19, 0.52, 0.12, 28, 95, 25), (0.34, -0.08, 0.44, 0.11, 34, 345, 8),
        (-0.35, -0.06, 0.42, 0.11, 36, 195, 12), (0.02, -0.20, 0.36, 0.10, 40, 270, 40),
        (-0.17, 0.24, 0.30, 0.09, 42, 120, 33)]),
    "SM_Rock_Ice_1": dict(kind="rock", seed=101, scale=(0.80, 0.68, 0.62), lift=0.30,
                          drips=[(20, 0.30, 0.20), (110, 0.38, 0.16), (200, 0.26, 0.22), (290, 0.34, 0.18)],
                          cap_h=0.66, thick=0.14),
    "SM_Rock_Ice_2": dict(kind="rock", seed=202, scale=(0.86, 0.62, 0.52), lift=0.22,
                          drips=[(-30, 0.40, 0.15), (60, 0.30, 0.25), (150, 0.44, 0.14), (230, 0.28, 0.2), (320, 0.22, 0.12)],
                          cap_h=0.62, thick=0.15),
}


def budget(name):
    for k, v in BUDGET.items():
        if name.startswith(k):
            return v - 4
    raise KeyError(name)


def build_source(name):
    j = JOBS[name]
    if j["kind"] == "icicles":
        hi = src_icicles(name, j["seed"], j["width"], j["depth"], j["icicles"])
        hi.data.materials.clear()
        hi.data.materials.append(hi_material_ice("MHI_" + name, hang=True, length=j["length"]))
    elif j["kind"] == "pillar":
        hi = src_pillar(name, j["seed"], j["pk"])
        hi.data.materials.clear()
        hi.data.materials.append(hi_material_ice("MHI_" + name))
    elif j["kind"] == "crystal":
        hi = src_crystals(name, j["seed"], j["mound"], j["crystals"])
        hi.data.materials.clear()
        hi.data.materials.append(hi_material_ice("MHI_" + name, bump=0.2))
    else:
        hi = src_rock(name, j["seed"], j["scale"], j["lift"], j["drips"], j["cap_h"], j["thick"])
        me = hi.data
        idx = [p.material_index for p in me.polygons]
        me.materials.clear()
        me.materials.append(hi_material_rock("MHI_" + name + "_Rock"))
        ice = hi_material_ice("MHI_" + name + "_Ice", bump=0.3)
        bs = ice.node_tree.nodes["Principled BSDF"]
        me.materials.append(ice)
        for p, i in zip(me.polygons, idx):
            p.material_index = i
    for p in hi.data.polygons:
        p.use_smooth = True
    return hi


def build_low(name):
    j = JOBS[name]
    hi = bpy.data.objects[name + "_HI"]
    lo = make_low(hi, name, budget(name))
    if j["kind"] == "icicles":
        finish_low(lo, flat_z=(0.0,), hang=True)
    elif j["kind"] == "pillar":
        finish_low(lo, flat_z=(0.0, 6.2))
    else:
        finish_low(lo, flat_z=(0.0,))
    uv_unwrap(lo)
    return lo


def bake_and_export(name, out_dir=None):
    j = JOBS[name]
    hi = bpy.data.objects[name + "_HI"]
    lo = bpy.data.objects[name]
    rock = j["kind"] == "rock"
    ext = {"icicles": (0.03, 0.08), "pillar": (0.05, 0.12), "crystal": (0.03, 0.08), "rock": (0.05, 0.12)}[j["kind"]]
    hi.hide_render = False
    imgs = bake(hi, lo, rock, *ext)
    final_material(lo, imgs, rock)
    out = out_dir or OUT_DIR
    path = os.path.join(out, name + ".glb")
    size = export_glb(lo, path)
    return {"name": name, "tris": tris(lo), "size": size, "dims": tuple(round(d, 3) for d in lo.dimensions)}
