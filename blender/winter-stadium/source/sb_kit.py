# STREETBALL kit. Everything is written in GAME coordinates (x right, y up, z toward the camera; glTF axes) and
# converted to Blender (x, -z, y) when the mesh is built. Every face owns its vertices (flat shading), faces carry a
# material name from PAL, and a normal hint `n` flips a face if its winding disagrees.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

SP = r"."  # the folder holding these scripts
REPO = r"../../.."
OUT = REPO + r"\blender\streetball"

PAL = {
    # court
    'Asphalt': '3d3c4c', 'AsphaltDark': '302f3d', 'Crack': '23222c', 'Court': '4a4fc0', 'Key': '5b2bb0',
    'LineWhite': 'f7f3ea', 'LineOrange': 'ff7d22',
    # Foxino palette
    'Purple': '5b2bb0', 'PurpleDark': '34197a', 'Orange': 'ff7d22', 'Yellow': 'ffcd1c', 'Cyan': '48d8ff',
    'Pink': 'ff5d8f', 'Green': '5fd04c',
    # neutrals
    'White': 'fbfaf6', 'Cream': 'fff0d2', 'Black': '25222c', 'Concrete': 'd3cabc', 'ConcreteDark': 'aaa094',
    'Curb': 'e2dacb', 'Metal': 'aeb7c2', 'MetalDark': '5a6272', 'Rubber': '2c2934', 'Wood': 'c98b55',
    # wall
    'Brick1': 'c9643f', 'Brick2': 'b5532f', 'Brick3': 'd97a4b', 'Mortar': 'e6c3a2', 'Door': '4b8f8c',
    # city
    'Glass': '9bdcf2', 'WinGlass': '5873a8', 'WinLit': 'ffe39a', 'Trim': 'fff3df', 'Roof': '6f6070',
    'Bld1': 'f2b27a', 'Bld2': 'e2785c', 'Bld3': 'f3d48c', 'Bld4': 'e9a0a0', 'Bld5': 'eadcc2', 'Bld6': 'f09a50',
    'Bld7': 'c98b6e', 'Bld8': 'b9a6e0', 'Awning1': 'ff5d8f', 'Awning2': '48d8ff', 'Sidewalk': 'd9d0c3', 'Road': '4a4955',
    'Leaf': '66cc4e', 'Leaf2': '43a94c', 'Trunk': '8c5c3c', 'Tank': 'a0705a',
    # special
    'Net': 'ffffff', 'ChainLink': 'b9c3ce', 'Glow': 'fff1b8', 'BallOrange': 'f2721c', 'BallSeam': '2a1e1a',
}
GLOW = {'Glow': 3.0, 'WinLit': 0.6}

def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def MAT(name):
    m = bpy.data.materials.get(name)
    if m: return m
    h = PAL[name]; rgb = [_lin(int(h[i:i + 2], 16)) for i in (0, 2, 4)]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = 0.85
    b.inputs['Metallic'].default_value = 0.0
    if name in GLOW:
        b.inputs['Emission Color'].default_value = (*rgb, 1); b.inputs['Emission Strength'].default_value = GLOW[name]
    m.diffuse_color = (*rgb, 1)
    return m

def V(*a):
    return Vector(a[0]) if len(a) == 1 else Vector(a)

def newell(pts):
    n = Vector((0, 0, 0))
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y)
    return n

class MB:
    def __init__(s):
        s.v = []; s.f = []; s.m = []; s.uv = []
    def face(s, pts, mat, n=None, uv=None):
        pts = [Vector(p) for p in pts]
        if n is not None and newell(pts).dot(Vector(n)) < 0:
            pts = pts[::-1]; uv = uv[::-1] if uv else None
        i0 = len(s.v); s.v.extend(pts)
        s.f.append(list(range(i0, i0 + len(pts)))); s.m.append(mat); s.uv.append(uv)
    def tris(s):
        return sum(len(f) - 2 for f in s.f)
    def xform(s, M, i0=0):
        for i in range(i0, len(s.v)): s.v[i] = M @ s.v[i]

# ---------------------------------------------------------------------------------------------------------- shapes
def box(mb, x0, x1, y0, y1, z0, z1, mat, skip=()):
    P = lambda x, y, z: Vector((x, y, z))
    F = {'top': ([P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], (0, 1, 0)),
         'bot': ([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], (0, -1, 0)),
         'px': ([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], (1, 0, 0)),
         'nx': ([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], (-1, 0, 0)),
         'pz': ([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], (0, 0, 1)),
         'nz': ([P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], (0, 0, -1))}
    for k, (pts, n) in F.items():
        if k in skip: continue
        mb.face(pts, mat[k] if isinstance(mat, dict) else mat, n)

def hull(mb, pts, mat, skip_down=False):
    """Convex hull of points, planar faces merged. mat may be a function(face_normal) -> name."""
    bm = bmesh.new()
    for p in pts: bm.verts.new(Vector(p))
    r = bmesh.ops.convex_hull(bm, input=bm.verts)
    for g in r.get('geom_interior', []) + r.get('geom_unused', []):
        if isinstance(g, bmesh.types.BMVert) and g.is_valid: bm.verts.remove(g)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for f in bm.faces:
        q = [v.co.copy() for v in f.verts]; fc = sum(q, Vector()) / len(q)
        n = newell(q)
        if n.dot(fc - c) < 0: n = -n
        if skip_down and n.normalized().y < -0.9: continue
        mb.face(q, mat(n.normalized()) if callable(mat) else mat, n)
    bm.free()

def bbox(mb, x0, x1, y0, y1, z0, z1, b, mat, skip_down=False):
    """A box with every edge chamfered by b."""
    pts = []
    for x, sx in ((x0, 1), (x1, -1)):
        for y, sy in ((y0, 1), (y1, -1)):
            for z, sz in ((z0, 1), (z1, -1)):
                pts += [(x + sx * b, y, z + sz * b * 0.999), (x, y + sy * b, z + sz * b), (x + sx * b, y + sy * b * 1.001, z)]
    hull(mb, pts, mat, skip_down)

def frame_of(d):
    d = Vector(d).normalized()
    u = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
    a = d.cross(u).normalized(); b = d.cross(a).normalized()
    return a, b

def ring(c, d, r, n, rot=0.0, a=None, b=None, rx=None):
    if a is None: a, b = frame_of(d)
    rx = rx or r
    return [Vector(c) + a * math.cos(rot + 2 * math.pi * k / n) * rx + b * math.sin(rot + 2 * math.pi * k / n) * r for k in range(n)]

def prism(mb, p0, p1, r, n, mat, caps=(True, True), rot=None, r1=None, cmat=None):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0
    rot = math.pi / n if rot is None else rot
    a, b = frame_of(d)
    A = ring(p0, d, r, n, rot, a, b); B = ring(p1, d, r if r1 is None else r1, n, rot, a, b)
    for k in range(n):
        q = [A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]]
        fc = sum(q, Vector()) / 4; ax = p0 + d * ((fc - p0).dot(d) / d.length_squared)
        mb.face(q, mat, fc - ax)
    if caps[0]: mb.face(A, cmat or mat, -d)
    if caps[1]: mb.face(B, cmat or mat, d)

def tube(mb, path, r, n, mat, caps=(False, False), closed=False, rot=None):
    path = [Vector(p) for p in path]
    rot = math.pi / n if rot is None else rot
    rings = []
    a0, b0 = frame_of(path[1] - path[0])
    for i, p in enumerate(path):
        if closed: d = path[(i + 1) % len(path)] - path[i - 1]
        else: d = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)])
        d = d.normalized()
        a = (a0 - d * a0.dot(d)).normalized(); b = d.cross(a)
        rings.append(ring(p, d, r, n, rot, a, b)); a0 = a
    segs = len(path) if closed else len(path) - 1
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % len(path)]
        for k in range(n):
            q = [A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]]
            fc = sum(q, Vector()) / 4; pc = (path[i] + path[(i + 1) % len(path)]) / 2
            mb.face(q, mat, fc - pc)
    if caps[0] and not closed: mb.face(rings[0], mat, path[0] - path[1])
    if caps[1] and not closed: mb.face(rings[-1], mat, path[-1] - path[-2])

def lathe(mb, prof, n, mat, c=(0, 0, 0), rot=None, mats=None):
    """prof: [(r, y)] bottom to top; r == 0 closes with a fan. Axis vertical through c (game coords)."""
    c = Vector(c); rot = math.pi / n if rot is None else rot
    R = [[c + Vector((math.cos(rot + 2 * math.pi * k / n) * r, y, math.sin(rot + 2 * math.pi * k / n) * r)) for k in range(n)] for r, y in prof]
    for i in range(len(prof) - 1):
        m = mats[i] if mats else mat
        (r0, y0), (r1, y1) = prof[i], prof[i + 1]
        for k in range(n):
            k1 = (k + 1) % n
            if r0 == 0: q = [R[i][k], R[i + 1][k1], R[i + 1][k]]
            elif r1 == 0: q = [R[i][k], R[i][k1], R[i + 1][k]]
            else: q = [R[i][k], R[i][k1], R[i + 1][k1], R[i + 1][k]]
            fc = sum(q, Vector()) / len(q)
            out = Vector((fc.x - c.x, 0, fc.z - c.z)).normalized()
            dn = Vector((0, -(r1 - r0), 0)) * 0 + out * (y1 - y0) + Vector((0, r0 - r1, 0))
            mb.face(q, m, dn)
    if prof[0][0] > 0 and mats is None: pass

def cap_disc(mb, c, r, n, y, mat, up=True, rot=None):
    rot = math.pi / n if rot is None else rot
    pts = [Vector((c[0] + math.cos(rot + 2 * math.pi * k / n) * r, y, c[2] + math.sin(rot + 2 * math.pi * k / n) * r)) for k in range(n)]
    mb.face(pts, mat, (0, 1 if up else -1, 0))

# ---------------------------------------------------------------------------------------------- flat paint helpers
def gpoly(mb, pts2, y, mat):
    """A flat polygon on the ground plane at height y; pts2 = [(x, z)]."""
    mb.face([(x, y, z) for x, z in pts2], mat, (0, 1, 0))

def grect(mb, x0, x1, z0, z1, y, mat):
    gpoly(mb, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y, mat)

def garc(mb, cx, cz, r, w, a0, a1, segs, y, mat):
    """A painted arc line of width w: angles in radians, x = cx + r cos a, z = cz + r sin a."""
    for k in range(segs):
        t0 = a0 + (a1 - a0) * k / segs; t1 = a0 + (a1 - a0) * (k + 1) / segs
        ri, ro = r - w / 2, r + w / 2
        gpoly(mb, [(cx + ri * math.cos(t0), cz + ri * math.sin(t0)), (cx + ro * math.cos(t0), cz + ro * math.sin(t0)),
                   (cx + ro * math.cos(t1), cz + ro * math.sin(t1)), (cx + ri * math.cos(t1), cz + ri * math.sin(t1))], y, mat)

def wpoly(mb, pts2, z, mat, nz=1):
    """A flat polygon on a vertical plane facing +z (or -z); pts2 = [(x, y)]."""
    mb.face([(x, y, z) for x, y in pts2], mat, (0, 0, nz))

def star_pts(cx, cy, r, ri, n=5, rot=math.pi / 2):
    return [(cx + (r if k % 2 == 0 else ri) * math.cos(rot + math.pi * k / n), cy + (r if k % 2 == 0 else ri) * math.sin(rot + math.pi * k / n)) for k in range(2 * n)]

def blob_pts(cx, cy, rx, ry, n, seed, j=0.22):
    rnd = random.Random(seed)
    return [(cx + rx * (1 + rnd.uniform(-j, j)) * math.cos(2 * math.pi * k / n), cy + ry * (1 + rnd.uniform(-j, j)) * math.sin(2 * math.pi * k / n)) for k in range(n)]

# ------------------------------------------------------------------------------------------------------------- text
def text_polys(txt, size=1.0, offset=0.0, shear=0.0, res=3, font=None, align='CENTER', spacing=1.0):
    """Polygons of a text as lists of 2D points (x right, y up), centred horizontally, baseline y = 0."""
    cu = bpy.data.curves.new('tmp_txt', 'FONT'); cu.body = txt; cu.size = size; cu.offset = offset
    cu.shear = shear; cu.resolution_u = res; cu.align_x = align; cu.space_character = spacing
    if font: cu.font = font
    ob = bpy.data.objects.new('tmp_txt', cu); bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg); me = ev.to_mesh()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    out = [[(v.co.x, v.co.y) for v in f.verts] for f in bm.faces]
    bm.free(); ev.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    return out

# ---------------------------------------------------------------------------------------------- objects and files
def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def clear(name):
    c = bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):
            d = o.data; bpy.data.objects.remove(o, do_unlink=True)
            if d is not None and d.users == 0 and isinstance(d, bpy.types.Mesh): bpy.data.meshes.remove(d)
    return coll(name)

def build(mb, name, c, origin=(0, 0, 0)):
    o = Vector(origin)
    me = bpy.data.meshes.new(name)
    me.from_pydata([(p.x - o.x, -(p.z - o.z), p.y - o.y) for p in mb.v], [], mb.f)
    mats = sorted(set(mb.m))
    for m in mats: me.materials.append(MAT(m))
    for poly, m in zip(me.polygons, mb.m):
        poly.material_index = mats.index(m); poly.use_smooth = False
    if any(u is not None for u in mb.uv):
        lay = me.uv_layers.new(name='UVMap')
        for poly, u in zip(me.polygons, mb.uv):
            for j, li in enumerate(poly.loop_indices):
                lay.data[li].uv = u[j] if u else (0.0, 0.0)
    me.update()
    ob = bpy.data.objects.new(name, me); ob.location = (o.x, -o.z, o.y)
    c.objects.link(ob)
    return ob

def empty(name, c, pos, yaw=0.0, size=0.2):
    e = bpy.data.objects.new(name, None); e.empty_display_type = 'ARROWS'; e.empty_display_size = size
    e.location = (pos[0], -pos[2], pos[1]); e.rotation_euler = (0, 0, yaw)
    c.objects.link(e); return e

def tri_count(c):
    n = 0
    for o in c.all_objects:
        if o.type == 'MESH': n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n

def export(cname, fname=None):
    import os
    os.makedirs(OUT, exist_ok=True)
    c = bpy.data.collections[cname]
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.all_objects: o.select_set(True)
    vl = bpy.context.view_layer
    vl.objects.active = next(iter(c.all_objects))
    path = OUT + '\\' + (fname or cname) + '.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_animations=False, export_cameras=False, export_lights=False, export_extras=False,
                              export_materials='EXPORT', export_texcoords=True, export_normals=True)
    bpy.ops.object.select_all(action='DESELECT')
    return os.path.getsize(path)

# ---------------------------------------------------------------------------------------------------------- preview
def look(cam_ob, pos, tgt):
    p = Vector((pos[0], -pos[2], pos[1])); t = Vector((tgt[0], -tgt[2], tgt[1]))
    cam_ob.location = p; cam_ob.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler()

def preview_setup():
    sc = bpy.context.scene
    c = coll('Preview')
    cam = bpy.data.objects.get('PrevCam')
    if cam is None:
        cam = bpy.data.objects.new('PrevCam', bpy.data.cameras.new('PrevCam')); c.objects.link(cam)
    sun = bpy.data.objects.get('PrevSun')
    if sun is None:
        sun = bpy.data.objects.new('PrevSun', bpy.data.lights.new('PrevSun', 'SUN')); c.objects.link(sun)
    sun.data.energy = 3.6; sun.data.color = (1.0, 0.88, 0.72); sun.data.angle = math.radians(2)
    sun.rotation_euler = Vector((-0.55, 0.75, -0.62)).to_track_quat('-Z', 'Y').to_euler()   # from the camera side, right, high
    w = sc.world or bpy.data.worlds.new('World'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.42, 0.66, 1.0, 1); bg.inputs[1].default_value = 0.85
    sc.camera = cam; cam.data.clip_end = 400; cam.data.clip_start = 0.1
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0.0
    sc.render.film_transparent = False
    return cam

def render(path, pos, tgt, res=(1280, 720), vfov=50.0):
    sc = bpy.context.scene; cam = preview_setup()
    look(cam, pos, tgt)
    cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(vfov)
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
