# Igloo W3 (lane B): pre-fracture the exit plug into WallChunk_NN pieces.
# Spherical-Voronoi cell fracture of a dome patch: seeds on the mid-shell sphere,
# so every cut plane passes through the dome centre (cuts run straight through
# the wall).  Plug faces keep the plug's exact surface, material, UVs, colours and
# normals (barycentric from the plug's own triangles); new cut faces get
# M_Igloo_Fracture with flat normals.
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform


# ---------------------------------------------------------------- plug data
class Plug:
    """World-space triangulated copy of the plug with per-corner data."""

    def __init__(self, ob):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh(preserve_all_data_layers=True, depsgraph=dg)
        mw = ob.matrix_world.copy()
        nm = mw.to_3x3().inverted_safe().transposed()
        self.mats = [s.material for s in ob.material_slots]
        self.V = [mw @ v.co for v in me.vertices]
        me.calc_loop_triangles()
        cn = [Vector(c.vector) for c in me.corner_normals]
        self.tris = []      # (v0,v1,v2)
        self.tloops = []    # (l0,l1,l2)
        self.tmat = []
        for lt in me.loop_triangles:
            self.tris.append(tuple(lt.vertices))
            self.tloops.append(tuple(lt.loops))
            self.tmat.append(me.polygons[lt.polygon_index].material_index)
        self.N = [(nm @ n).normalized() for n in cn]
        self.uv = {}
        for layer in me.uv_layers:
            self.uv[layer.name] = [Vector(d.uv) for d in layer.data]
        self.uv_names = [l.name for l in me.uv_layers]
        self.cols = {}      # name -> (domain, type, values per corner as 4-vectors)
        for ca in me.color_attributes:
            vals = [tuple(d.color) for d in ca.data]
            if ca.domain == 'POINT':
                vals = [vals[l.vertex_index] for l in me.loops]
            elif ca.domain != 'CORNER':
                continue
            self.cols[ca.name] = (ca.domain, ca.data_type, vals)
        self.loop_vert = [l.vertex_index for l in me.loops]
        ev.to_mesh_clear()
        self.bvh = BVHTree.FromPolygons(self.V, self.tris, all_triangles=True)
        self.tri_area = []
        for t in self.tris:
            a, b, c = (self.V[i] for i in t)
            self.tri_area.append((b - a).cross(c - a).length * 0.5)
        self.area = sum(self.tri_area)

    def bmesh(self):
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in self.V]
        for t, m in zip(self.tris, self.tmat):
            try:
                f = bm.faces.new([vs[i] for i in t])
                f.material_index = m
            except ValueError:
                pass
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
        bm.verts.ensure_lookup_table()
        return bm

    def interp(self, ti, p):
        """Barycentric weights of p in plug triangle ti (clamped)."""
        a, b, c = (self.V[i] for i in self.tris[ti])
        w = barycentric_transform(p, a, b, c, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        w = Vector((max(0.0, w.x), max(0.0, w.y), max(0.0, w.z)))
        s = w.x + w.y + w.z
        return w / s if s > 1e-12 else Vector((1 / 3, 1 / 3, 1 / 3))


def fit_sphere(pts):
    A = np.c_[2 * pts, np.ones(len(pts))]
    f = (pts ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, f, rcond=None)
    ctr = c[:3]
    r = math.sqrt(c[3] + ctr @ ctr)
    return Vector(ctr), r


# ---------------------------------------------------------------- seeds
def outer_tris(plug, C):
    out = []
    for i, t in enumerate(plug.tris):
        a, b, c = (plug.V[k] for k in t)
        n = (b - a).cross(c - a)
        if n.length < 1e-12:
            continue
        cen = (a + b + c) / 3
        if n.normalized().dot((cen - C).normalized()) > 0.6:
            out.append(i)
    return out


def sample_surface(plug, tri_ids, n, rng):
    areas = np.array([plug.tri_area[i] for i in tri_ids])
    cdf = np.cumsum(areas) / areas.sum()
    pts = []
    for _ in range(n):
        ti = tri_ids[int(np.searchsorted(cdf, rng.random()))]
        a, b, c = (plug.V[k] for k in plug.tris[ti])
        u, v = rng.random(), rng.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        pts.append(a + (b - a) * u + (c - a) * v)
    return pts


def radius_fn(p, impact, rmin, rmax, ax=1.7, az=1.3, falloff=1.7):
    d = math.sqrt((p.x / ax) ** 2 + ((p.z - impact) / az) ** 2)
    t = min(1.0, d / falloff)
    t = t * t * (3 - 2 * t)
    return rmin + (rmax - rmin) * t


def poisson_seeds(cands, C, Rmid, impact, rmin, rmax, rng):
    order = list(range(len(cands)))
    rng.shuffle(order)
    seeds, rads = [], []
    for k in order:
        p = cands[k]
        s = C + (p - C).normalized() * Rmid
        r = radius_fn(p, impact, rmin, rmax)
        ok = True
        for q, rq in zip(seeds, rads):
            if (s - q).length < 0.5 * (r + rq):
                ok = False
                break
        if ok:
            seeds.append(s)
            rads.append(r)
    return seeds


# ---------------------------------------------------------------- cutting
def cut_cell(bm_src, i, seeds, fract_index, reach):
    si = seeds[i]
    nbrs = sorted((j for j in range(len(seeds)) if j != i and (seeds[j] - si).length < reach),
                  key=lambda j: (seeds[j] - si).length)
    bm = bm_src.copy()
    for j in nbrs:
        sj = seeds[j]
        no = (sj - si).normalized()
        co = (si + sj) * 0.5
        dmax = max(no.dot(v.co - co) for v in bm.verts)
        if dmax <= 2e-4:
            continue
        dmin = min(no.dot(v.co - co) for v in bm.verts)
        if dmin >= -2e-4:
            bm.free()
            return None
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=2e-4, plane_co=co, plane_no=no, clear_outer=True)
        bnd = [e for e in bm.edges if e.is_boundary]
        if bnd:
            r = bmesh.ops.holes_fill(bm, edges=bnd, sides=0)
            nf = r["faces"]
            for f in nf:
                f.material_index = fract_index
            if nf:
                bmesh.ops.triangulate(bm, faces=nf, quad_method='BEAUTY', ngon_method='BEAUTY')
        if not bm.faces:
            bm.free()
            return None
    # cleanup
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=1e-4)
    # re-make the cut faces: merge each flat cap into one n-gon, drop the
    # collinear points left on the crease lines, then triangulate cleanly
    def is_fr(f):
        return f.material_index == fract_index
    fr_edges = [e for e in bm.edges if e.link_faces and all(is_fr(f) for f in e.link_faces)]
    fr_verts = [v for v in bm.verts if v.link_faces and all(is_fr(f) for f in v.link_faces)]
    if fr_edges:
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), use_dissolve_boundaries=False,
                                 verts=fr_verts, edges=fr_edges, delimit={'MATERIAL'})
    ng = [f for f in bm.faces if len(f.verts) > 3]
    if ng:
        bmesh.ops.triangulate(bm, faces=ng, quad_method='BEAUTY', ngon_method='BEAUTY')
    # collapse needles: shortest edge of any near-zero-area triangle
    for _ in range(3):
        bad = [f for f in bm.faces if f.calc_area() < 2e-7]
        if not bad:
            break
        es = {min(f.edges, key=lambda e: e.calc_length()) for f in bad if f.is_valid}
        es = [e for e in es if e.is_valid and e.calc_length() < 3e-3]
        if es:
            bmesh.ops.collapse(bm, edges=es, uvs=False)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=1e-4)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    ng = [f for f in bm.faces if len(f.verts) > 3]
    if ng:
        bmesh.ops.triangulate(bm, faces=ng, quad_method='BEAUTY', ngon_method='BEAUTY')
    return bm


def bm_volume_centroid(bm):
    vol = 0.0
    cen = Vector((0, 0, 0))
    for f in bm.faces:
        vs = [v.co for v in f.verts]
        for k in range(1, len(vs) - 1):
            a, b, c = vs[0], vs[k], vs[k + 1]
            v6 = a.dot(b.cross(c))
            vol += v6
            cen += (a + b + c) * v6
    if abs(vol) < 1e-12:
        return 0.0, cen
    return vol / 6.0, cen / (4.0 * vol)


def bm_stats(bm):
    closed = all(len(e.link_faces) == 2 for e in bm.edges)
    # islands
    seen, islands = set(), 0
    for f in bm.faces:
        if f.index in seen:
            continue
        islands += 1
        stack = [f]
        seen.add(f.index)
        while stack:
            g = stack.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
    P = np.array([v.co[:] for v in bm.verts])
    Pc = P - P.mean(0)
    _, _, vt = np.linalg.svd(Pc, full_matrices=False)
    ext = [float(np.ptp(Pc @ ax)) for ax in vt]
    vol, _ = bm_volume_centroid(bm)
    min_area = min(f.calc_area() for f in bm.faces)
    return dict(closed=closed, islands=islands, ext=ext, mindim=min(ext), vol=vol,
                tris=len(bm.faces), min_face_area=min_area,
                fr_tris=sum(1 for f in bm.faces if f.material_index >= 1),
                ngons=sum(1 for f in bm.faces if len(f.verts) > 3))


def fracture_cells(plug, seeds, fract_index):
    bm_src = plug.bmesh()
    reach = 4.0
    cells = []
    for i in range(len(seeds)):
        bm = cut_cell(bm_src, i, seeds, fract_index, reach)
        if bm is None or not bm.faces:
            continue
        bm.faces.index_update()
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        cells.append((i, bm))
    bm_src.free()
    return cells


def plan(plug, C, Rmid, impact, target=(32, 38), rmin=0.55, rmax=1.3, seed=1, ncand=20000):
    rng = random.Random(seed)
    tri_ids = outer_tris(plug, C)
    cands = sample_surface(plug, tri_ids, ncand, rng)
    scale = 1.0
    best = None
    for _ in range(14):
        seeds = poisson_seeds(cands, C, Rmid, impact, rmin * scale, rmax * scale, random.Random(seed * 7 + 3))
        n = len(seeds)
        best = seeds
        if target[0] <= n <= target[1]:
            break
        scale *= math.sqrt(n / ((target[0] + target[1]) / 2))
    return best


# ---------------------------------------------------------------- chunk objects
def make_fracture_material(name="M_Igloo_Fracture"):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (0.80, 0.86, 0.93, 1.0)   # packed snow, a touch blue
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Metallic"].default_value = 0.0
    m.use_backface_culling = True
    return m


def chunk_object(plug, bm, name, fract_mat, coll, parent):
    """bm in world space -> object with pivot at the volume centroid."""
    vol, cen = bm_volume_centroid(bm)
    for coll_ in (bpy.data.objects, bpy.data.meshes):
        old_ = coll_.get(name)
        if old_ is not None:
            coll_.remove(old_)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    nmat = len(plug.mats)
    for m in plug.mats:
        me.materials.append(m)
    me.materials.append(fract_mat)
    # per-corner data
    L = len(me.loops)
    nrm = [None] * L
    uvs = {n: [None] * L for n in plug.uv_names}
    cols = {n: [None] * L for n in plug.cols}
    for poly in me.polygons:
        li = list(poly.loop_indices)
        if poly.material_index < nmat:
            cen_f = Vector((0, 0, 0))
            for l in li:
                cen_f += me.vertices[me.loops[l].vertex_index].co
            cen_f /= len(li)
            hit = plug.bvh.find_nearest(cen_f)
            ti = hit[2]
            tl = plug.tloops[ti]
            for l in li:
                p = me.vertices[me.loops[l].vertex_index].co
                w = plug.interp(ti, p)
                n = plug.N[tl[0]] * w.x + plug.N[tl[1]] * w.y + plug.N[tl[2]] * w.z
                nrm[l] = n.normalized()
                for nme, arr in plug.uv.items():
                    uvs[nme][l] = arr[tl[0]] * w.x + arr[tl[1]] * w.y + arr[tl[2]] * w.z
                for nme, (_, _, arr) in plug.cols.items():
                    cols[nme][l] = tuple(arr[tl[0]][k] * w.x + arr[tl[1]][k] * w.y + arr[tl[2]][k] * w.z
                                         for k in range(4))
        else:
            fn = poly.normal.copy()
            ax = max(range(3), key=lambda k: abs(fn[k]))
            for l in li:
                p = me.vertices[me.loops[l].vertex_index].co
                nrm[l] = fn
                q = [p[k] for k in range(3) if k != ax]
                for nme in uvs:
                    uvs[nme][l] = Vector((q[0] * 0.5, q[1] * 0.5))
                for nme in cols:
                    cols[nme][l] = (1.0, 1.0, 1.0, 1.0)
    me.transform(Matrix.Translation(-cen))
    for nme in plug.uv_names:
        lay = me.uv_layers.new(name=nme)
        for l in range(L):
            lay.data[l].uv = uvs[nme][l]
    for nme, (dom, typ, _) in plug.cols.items():
        ca = me.color_attributes.new(nme, typ, 'CORNER')
        for l in range(L):
            ca.data[l].color = cols[nme][l]
    for p in me.polygons:
        p.use_smooth = True
    me.normals_split_custom_set([tuple(n) for n in nrm])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.parent = parent
    ob.location = cen
    return ob, vol, cen


def fit_centre(plug, C0=Vector((0, 0, 0)), iters=4):
    """Least-squares point nearest to the normal lines of the plug's outer/inner faces."""
    C = C0.copy()
    for _ in range(iters):
        A = np.zeros((3, 3)); b = np.zeros(3); n_used = 0
        for t, ar in zip(plug.tris, plug.tri_area):
            a, bb, c = (plug.V[k] for k in t)
            n = (bb - a).cross(c - a)
            if n.length < 1e-12:
                continue
            n = n.normalized(); cen = (a + bb + c) / 3
            if abs(n.dot((cen - C).normalized())) < 0.97:
                continue
            nn = np.array(n[:]); P = np.eye(3) - np.outer(nn, nn)
            A += ar * P; b += ar * P @ np.array(cen[:]); n_used += 1
        C = Vector(np.linalg.solve(A, b))
    rs = [(plug.V[k] - C).length for t in plug.tris for k in t]
    return C, min(rs), max(rs)


def search(plug, C, Rmid, impact, tries=12, target=(32, 38), rmin=0.55, rmax=1.3,
           max_total=6000, max_chunk=300, log=None, prefer_n=36):
    fi = len(plug.mats)
    best = None
    for sd in range(1, tries + 1):
        seeds = plan(plug, C, Rmid, impact, target=target, rmin=rmin, rmax=rmax, seed=sd)
        cells = fracture_cells(plug, seeds, fi)
        st = [bm_stats(bm) for _, bm in cells]
        tot = sum(s["tris"] for s in st)
        ok = (all(s["closed"] and s["islands"] == 1 and s["mindim"] >= 0.12 and s["min_face_area"] > 1e-8
                  and s["tris"] <= max_chunk for s in st) and 28 <= len(cells) <= 40)
        rec = dict(seed=sd, n=len(cells), tris=tot, ok=ok, maxc=max(s["tris"] for s in st),
                   multi=sum(1 for s in st if s["islands"] > 1))
        if log is not None:
            log.append(rec)
        sc_ = (abs(len(cells) - prefer_n), tot)
        if ok and tot <= max_total and (best is None or sc_ < best[4]):
            if best:
                for _, bm in best[2]:
                    bm.free()
            best = (tot, sd, cells, seeds, sc_)
        else:
            for _, bm in cells:
                bm.free()
    return best


def surface_area_orig(bm, nmat):
    return sum(f.calc_area() for f in bm.faces if f.material_index < nmat)


def coverage(plug, chunk_obs, nmat, nsamp=6000, seed=5):
    """Plug surface vs chunk plug-faces, both ways; area and volume sums."""
    rng = random.Random(seed)
    # union BVH of chunk plug-faces (world space)
    V, F = [], []
    for ob in chunk_obs:
        mw = ob.matrix_world
        me = ob.data
        base = len(V)
        V += [mw @ v.co for v in me.vertices]
        for p in me.polygons:
            if p.material_index < nmat:
                F.append([base + k for k in p.vertices])
    cb = BVHTree.FromPolygons(V, F)
    pts = sample_surface(plug, list(range(len(plug.tris))), nsamp, rng)
    d1 = [cb.find_nearest(p)[3] for p in pts]
    # chunk -> plug
    d2 = []
    area_c = 0.0
    for f in F:
        a = V[f[0]]
        for k in range(1, len(f) - 1):
            b, c = V[f[k]], V[f[k + 1]]
            area_c += (b - a).cross(c - a).length * 0.5
            for _ in range(2):
                u, v = rng.random(), rng.random()
                if u + v > 1:
                    u, v = 1 - u, 1 - v
                d2.append(plug.bvh.find_nearest(a + (b - a) * u + (c - a) * v)[3])
            for q in (a, b, c):
                d2.append(plug.bvh.find_nearest(q)[3])
    # volume
    vol_c = 0.0
    for ob in chunk_obs:
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
        vol_c += bm_volume_centroid(bm)[0]; bm.free()
    bmp = plug.bmesh(); vol_p = bm_volume_centroid(bmp)[0]; bmp.free()
    # overlap probe: random interior points of the plug must lie in exactly one chunk
    bvhs = []
    for ob in chunk_obs:
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
        bvhs.append(BVHTree.FromBMesh(bm)); bm.free()
    multi = zero = 0
    probes = 0
    d = Vector((0.2113, 0.5774, 0.7887)).normalized()
    pin = sample_surface(plug, list(range(len(plug.tris))), 600, rng)
    for p in pin:
        # step inside along the inward face normal
        hit = plug.bvh.find_nearest(p)
        q = p - hit[1] * 0.02
        # keep only probes that really are inside the plug (parity against the plug)
        n_hits, o = 0, q.copy()
        for _ in range(40):
            loc, nrm, idx, dist = plug.bvh.ray_cast(o, d)
            if loc is None:
                break
            n_hits += 1
            o = loc + d * 1e-5
        if n_hits % 2 == 0:
            continue
        cnt = 0
        for bv in bvhs:
            n_hits, o = 0, q.copy()
            for _ in range(40):
                loc, nrm, idx, dist = bv.ray_cast(o, d)
                if loc is None:
                    break
                n_hits += 1
                o = loc + d * 1e-5
            cnt += n_hits % 2
        probes += 1
        if cnt > 1:
            multi += 1
        elif cnt == 0:
            zero += 1
    return dict(plug_to_chunks_max_mm=round(max(d1) * 1000, 4),
                chunks_to_plug_max_mm=round(max(d2) * 1000, 4),
                area_plug=round(plug.area, 5), area_chunks=round(area_c, 5),
                area_diff_pct=round(100 * (area_c - plug.area) / plug.area, 4),
                vol_plug=round(vol_p, 5), vol_chunks=round(vol_c, 5),
                vol_diff_pct=round(100 * (vol_c - vol_p) / vol_p, 4),
                probes=probes, probes_in_two=multi, probes_in_none=zero)


def build_chunks(plug, cells, seeds, impact, coll, root_name="SM_Igloo_WallChunks", fract_mat=None):
    """Make the root empty + WallChunk_NN objects, numbered from the hit point outward."""
    fract_mat = fract_mat or make_fracture_material()
    if bpy.data.objects.get(root_name):
        bpy.data.objects.remove(bpy.data.objects[root_name])
    root = bpy.data.objects.new(root_name, None)
    root.empty_display_size = 0.5
    coll.objects.link(root)
    hit = Vector((0, 0, impact))

    def key(c):
        _, cen = bm_volume_centroid(c[1])
        return (Vector((cen.x, 0, cen.z)) - hit).length
    order = sorted(cells, key=key)
    obs = []
    for n, (i, bm) in enumerate(order, 1):
        ob, vol, cen = chunk_object(plug, bm, "WallChunk_%02d" % n, fract_mat, coll, root)
        obs.append(ob)
    return root, obs


def export_glb(root, obs, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    root.select_set(True)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True,
                              export_apply=True, export_cameras=False, export_lights=False,
                              export_extras=False, export_draco_mesh_compression_enable=False,
                              export_animations=False, export_skins=False, export_morph=False, export_tangents=True,
                              export_materials='EXPORT', export_image_format='AUTO')


def read_glb(path):
    import json, struct
    with open(path, 'rb') as fh:
        data = fh.read()
    jl = struct.unpack_from('<I', data, 12)[0]
    js = json.loads(data[20:20 + jl])
    out = {"nodes": [], "materials": [m.get("name") for m in js.get("materials", [])],
           "images": [(im.get("name"), im.get("mimeType")) for im in js.get("images", [])],
           "extensionsUsed": js.get("extensionsUsed", []), "size": len(data)}
    tri_total = 0
    for nd in js["nodes"]:
        rec = {"name": nd.get("name"), "t": [round(x, 4) for x in nd.get("translation", [0, 0, 0])],
               "r": nd.get("rotation"), "s": nd.get("scale"), "children": len(nd.get("children", []))}
        if "mesh" in nd:
            tris = 0
            mins, maxs = [1e9] * 3, [-1e9] * 3
            for pr in js["meshes"][nd["mesh"]]["primitives"]:
                acc = js["accessors"][pr["indices"]] if "indices" in pr else js["accessors"][pr["attributes"]["POSITION"]]
                tris += acc["count"] // 3
                pa = js["accessors"][pr["attributes"]["POSITION"]]
                mins = [min(a, b) for a, b in zip(mins, pa["min"])]
                maxs = [max(a, b) for a, b in zip(maxs, pa["max"])]
            rec["tris"] = tris
            rec["bbox_centre"] = [round((a + b) / 2, 3) for a, b in zip(mins, maxs)]
            rec["prims"] = [(js["materials"][p.get("material", 0)]["name"], sorted(p["attributes"])) for p in js["meshes"][nd["mesh"]]["primitives"]]
            tri_total += tris
        out["nodes"].append(rec)
    out["tri_total"] = tri_total
    out["scene_roots"] = [js["nodes"][i].get("name") for i in js["scenes"][0]["nodes"]]
    return out


def bm_volume_centroid_mesh(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    r = bm_volume_centroid(bm); bm.free()
    return r
