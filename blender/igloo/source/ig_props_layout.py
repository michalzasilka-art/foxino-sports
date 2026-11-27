"""Igloo W3 (lane C): props layout, numeric footprint check and previews.

Run inside Blender 5.2 after ig_props_build.py exported the GLBs:  exec(open(PATH).read())
- imports every exported GLB into scene "IglooPropsPreview", places it per LAYOUT,
- checks every real footprint (all mesh vertices, game coords) against the ride line, the fire circle,
  the 9.0 m inner radius and the exit patch, and writes blender/igloo/igloo_props_layout.json,
- renders previews/Props_inside.png (game camera, 9:16) and previews/Props_turntable.png.
Game / glTF coords: +Y up, -Z = entrance (uphill), +Z = exit. Blender (x, y, z) = glTF (x, -z, y).
Yaw rot_y_deg turns a model about +Y (three.js rotation.y); the models face +Z.
"""
import json
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ROOT = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\c-igloo\blender\igloo"
TMP = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\c-tmp"
SHELL = os.path.join(ROOT, "SM_Igloo_Shell.glb")     # lane A's shell, used when present
SCN = "IglooPropsPreview"
RIDE_X, FIRE, FIRE_R, R_IN = 2.6, (4.4, 0.5), 1.2, 9.0
EXIT_X = 3.0

SHELF_DC = 9.0 - 0.25
_sh = (-0.55, 0.835)
LAYOUT = [
    # model, x, y, z, yaw
    ("SM_Igloo_Rug_1", 4.0, 0.0, -2.0, 0.0),
    ("SM_Igloo_Rug_2", 6.9, 0.0, 0.6, 90.0),
    ("SM_Igloo_Rug_3", 3.85, 0.0, 2.95, 20.0),
    ("SM_Igloo_Pots", 5.6, 0.0, 2.45, 30.0),
    ("SM_Igloo_Table", 3.65, 0.0, 5.7, 90.0),
    ("SM_Igloo_SleepFurs", -3.75, 0.0, 3.6, 80.0),
    ("SM_Igloo_Shelf", _sh[0] * SHELF_DC, 0.0, _sh[1] * SHELF_DC, math.degrees(math.atan2(-_sh[0], -_sh[1]))),
    ("SM_Igloo_Lantern", -3.3, 2.9, 6.2, 0.0),
]
NOTES = {
    "SM_Igloo_Rug_1": "round cream fur rug on the fire circle's entrance side",
    "SM_Igloo_Rug_2": "big brown oval rug on the fire's far (+x) side, long axis along z",
    "SM_Igloo_Rug_3": "small grey rug on the fire circle's exit side",
    "SM_Igloo_Pots": "cooking pot, clay jar and bowl beside the fire, on its exit side",
    "SM_Igloo_Table": "low table ahead on the fire side, long axis along z, close to the ride line so the camera sees it",
    "SM_Igloo_SleepFurs": "sleeping furs on the side away from the fire, pillow toward the entrance",
    "SM_Igloo_Shelf": "snow shelf flush against the inner wall (its back is the r = 9.0 m curve), facing the centre",
    "SM_Igloo_Lantern": "hangs with its top hang point at y = 2.9 between the furs and the shelf; the game adds a cord up to the dome",
}


# ------------------------------------------------------------------ scene helpers
def get_scene(name):
    if bpy.app.background:            # headless: reuse the one context scene
        return bpy.context.scene
    sc = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    for w in bpy.context.window_manager.windows:
        w.scene = sc
    return sc


def wipe_scene(sc):
    for o in list(sc.objects):
        bpy.data.objects.remove(o)
    for c in list(sc.collection.children):
        bpy.data.collections.remove(c)


def import_glb(sc, path, coll_name):
    coll = bpy.data.collections.new(coll_name)
    sc.collection.children.link(coll)
    vl = sc.view_layers[0]
    vl.active_layer_collection = vl.layer_collection.children[coll.name]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    return roots, new


def place(root, x, y, z, yaw):
    root.location = (x, -z, y)
    root.rotation_mode = "XYZ"          # the glTF importer leaves QUATERNION
    root.rotation_euler = (0, 0, math.radians(yaw))


# ------------------------------------------------------------------ footprint maths (game x, z)
def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def seg_dist(p, a, b):
    ax, ay = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / (ax * ax + ay * ay or 1)))
    return math.hypot(p[0] - a[0] - t * ax, p[1] - a[1] - t * ay)


def inside(p, poly):
    c = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


def world_pts(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts, ys = [], []
    for o in objs:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = o.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            pts.append((round(w.x, 5), round(-w.y, 5)))     # game (x, z)
            ys.append(w.z)
        ev.to_mesh_clear()
    return pts, (min(ys), max(ys))


def check(name, objs):
    pts, (y0, y1) = world_pts(objs)
    h = hull(pts)
    xs = [p[0] for p in pts]
    one_side = min(xs) > 0 or max(xs) < 0
    min_abs_x = min(abs(x) for x in xs)
    fire_d = min(seg_dist(FIRE, h[i], h[i - 1]) for i in range(len(h)))
    fire_in = inside(FIRE, h)
    max_r = max(math.hypot(*p) for p in pts)
    exit_hit = any(abs(p[0]) <= EXIT_X and p[1] > 0 and math.hypot(*p) > R_IN - 1.5 for p in pts)
    ok = one_side and min_abs_x >= RIDE_X and not fire_in and fire_d >= FIRE_R and max_r <= R_IN + 1e-3 \
        and not exit_hit
    return {"ok": ok, "min_abs_x": round(min_abs_x, 3), "fire_clearance": round(fire_d - FIRE_R, 3),
            "max_radius": round(max_r, 3), "y_range": [round(y0, 3), round(y1, 3)],
            "footprint_hull_xz": [[round(a, 3), round(b, 3)] for a, b in h]}


def overlaps(hulls):
    """pairs whose hulls intersect (separating axis on convex polygons)."""
    def sep(p, q):
        for poly in (p, q):
            for i in range(len(poly)):
                a, b = poly[i - 1], poly[i]
                nx, ny = b[1] - a[1], a[0] - b[0]
                pa = [nx * v[0] + ny * v[1] for v in p]
                qa = [nx * v[0] + ny * v[1] for v in q]
                if max(pa) < min(qa) or max(qa) < min(pa):
                    return True
        return False
    names = list(hulls)
    return [(a, b) for i, a in enumerate(names) for b in names[i + 1:] if not sep(hulls[a], hulls[b])]


def shell_fit(shell_obs, placed):
    """against lane A's real shell: how far any prop vertex pokes past the inner wall (ray from the dome
    axis at the vertex height), and the gap between the shelf back and the wall."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    vs, tris = [], []
    for o in shell_obs:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        off = len(vs)
        vs += [o.matrix_world @ v.co for v in me.vertices]
        tris += [tuple(i + off for i in t.vertices) for t in me.loop_triangles]
        o.evaluated_get(dg).to_mesh_clear()
    bvh = BVHTree.FromPolygons(vs, tris)
    out = {}
    for name, (root, new) in placed.items():
        worst, gaps = -1e9, []
        for o in new:
            if o.type != "MESH":
                continue
            for v in o.data.vertices:
                w = o.matrix_world @ v.co
                orig = Vector((0, 0, w.z))
                d = (w - orig)
                if d.length < 1e-6:
                    continue
                hit, _, _, dist = bvh.ray_cast(orig, d.normalized())
                if hit is None:
                    continue
                worst = max(worst, d.length - dist)
                if name == "SM_Igloo_Shelf" and abs(d.length - math.sqrt(max(R_IN ** 2 - w.z ** 2, 0))) < 0.02:
                    gaps.append(dist - d.length)
        rec = {"max_poke_past_wall_m": round(worst, 4)}
        if gaps:
            rec["shelf_back_gap_m"] = [round(min(gaps), 4), round(max(gaps), 4)]
        out[name] = rec
    return out


# ------------------------------------------------------------------ stand-ins and lights
def mat(name, rgb, rough=0.8, emis=None, es=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    if emis:
        b.inputs["Emission Color"].default_value = (*emis, 1)
        b.inputs["Emission Strength"].default_value = es
    return m


def stand_in_dome(coll):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=R_IN)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context="VERTS")
    # doorway on the entrance side (game -Z = Blender +Y): |x| < 2.5, height < 4.1
    door = [f for f in bm.faces if f.calc_center_median().y > 5 and abs(f.calc_center_median().x) < 2.5
            and f.calc_center_median().z < 4.1]
    bmesh.ops.delete(bm, geom=door, context="FACES")
    me = bpy.data.meshes.new("StandIn_Dome")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat("StandIn_Snow", (0.74, 0.8, 0.9), 0.85, emis=(0.5, 0.64, 0.9), es=0.06))
    ob = bpy.data.objects.new("StandIn_Dome", me)
    coll.objects.link(ob)
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=R_IN + 0.3, fill_type="NGON")
    fl = bpy.context.active_object
    for c in fl.users_collection:
        c.objects.unlink(fl)
    coll.objects.link(fl)
    fl.name = "StandIn_Floor"
    fl.data.materials.append(mat("StandIn_FloorSnow", (0.72, 0.76, 0.84), 0.85))
    # entrance tunnel stub so the doorway does not show the sky
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.7, depth=7.0, location=(0, 12.0, 0), end_fill_type="NOTHING",
                                        rotation=(math.radians(90), 0, 0))
    tn = bpy.context.active_object
    for c in tn.users_collection:
        c.objects.unlink(tn)
    coll.objects.link(tn)
    tn.name = "StandIn_Tunnel"
    tn.scale = (2.6 / 2.7, 4.1 / 2.7, 1.0)    # inner width ~5.2, rounded top at 4.1 (camera sits inside it)
    tn.data.materials.append(bpy.data.materials["StandIn_Snow"])


def stand_in_fire(coll):
    fx, fz = FIRE
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.35, depth=0.8, location=(fx, -fz, 0.4))
    f = bpy.context.active_object
    for c in f.users_collection:
        c.objects.unlink(f)
    coll.objects.link(f)
    f.name = "StandIn_Flame"
    f.data.materials.append(mat("StandIn_Flame", (1.0, 0.5, 0.15), 0.5, emis=(1.0, 0.45, 0.1), es=12.0))
    for k in range(5):
        a = k * math.tau / 5
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.07, depth=0.9,
                                            location=(fx + 0.15 * math.cos(a), -fz + 0.15 * math.sin(a), 0.08),
                                            rotation=(math.radians(80), 0, a + math.pi / 2))
        lg = bpy.context.active_object
        for c in lg.users_collection:
            c.objects.unlink(lg)
        coll.objects.link(lg)
        lg.name = f"StandIn_Log{k}"
        lg.data.materials.append(mat("StandIn_Log", (0.25, 0.14, 0.08), 0.7))
    ld = bpy.data.lights.new("FireGlow", "POINT")
    ld.energy, ld.color, ld.shadow_soft_size = 14000, (1.0, 0.5, 0.2), 0.4
    lo = bpy.data.objects.new("FireGlow", ld)
    lo.location = (fx, -fz, 0.8)
    coll.objects.link(lo)


def lights(sc, coll, lantern_pos):
    w = bpy.data.worlds.get("IglooPreviewWorld") or bpy.data.worlds.new("IglooPreviewWorld")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.45, 0.58, 0.8, 1)
    bg.inputs[1].default_value = 0.12
    ld = bpy.data.lights.new("LanternGlow", "POINT")
    ld.energy, ld.color, ld.shadow_soft_size = 600, (1.0, 0.6, 0.28), 0.1
    lo = bpy.data.objects.new("LanternGlow", ld)
    lo.location = lantern_pos
    coll.objects.link(lo)
    # soft cool daylight through the snow roof
    ld = bpy.data.lights.new("SnowDay", "POINT")
    ld.energy, ld.color, ld.shadow_soft_size = 700, (0.7, 0.8, 1.0), 2.5
    lo = bpy.data.objects.new("SnowDay", ld)
    lo.location = (0, -2.0, 5.0)
    coll.objects.link(lo)


def render(sc, cam, path, rx, ry, samples=48):
    sc.camera = cam
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = rx, ry, 100
    sc.eevee.taa_render_samples = samples
    sc.view_settings.view_transform = "AgX"
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    return path


# ------------------------------------------------------------------ main
def run(render_inside=True, render_turn=True):
    sc = get_scene(SCN)
    wipe_scene(sc)
    placed, report, hulls = {}, {}, {}
    for name, x, y, z, yaw in LAYOUT:
        roots, new = import_glb(sc, os.path.join(ROOT, name + ".glb"), "P_" + name)
        root = [r for r in roots if r.name.startswith(name)][0]
        place(root, x, y, z, yaw)
        placed[name] = (root, new)
    bpy.context.view_layer.update()
    for name, (root, new) in placed.items():
        report[name] = check(name, new)
        hulls[name] = [tuple(p) for p in report[name]["footprint_hull_xz"]]
    ov = overlaps(hulls)
    data = {
        "about": "Suggested placement of the igloo interior props (lane C, W3). Game/glTF coords in metres: +Y up, "
                 "origin = dome floor centre, -Z = entrance (uphill), +Z = exit (downhill). rot_y_deg = yaw about +Y "
                 "(three.js rotation.y); every model faces +Z. Models' origins: base centre on y = 0, lantern: top "
                 "hang point.",
        "rules": {"ride_line_abs_x_min": RIDE_X, "fire_circle": {"x": FIRE[0], "z": FIRE[1], "r": FIRE_R},
                  "inner_radius": R_IN, "exit_patch_abs_x": EXIT_X},
        "props": [], "all_ok": True, "footprint_overlaps": [list(p) for p in ov],
    }
    for name, x, y, z, yaw in LAYOUT:
        r = report[name]
        data["all_ok"] &= r["ok"]
        data["props"].append({"model": name + ".glb", "x": round(x, 3), "y": round(y, 3), "z": round(z, 3),
                              "rot_y_deg": round(yaw, 2), "note": NOTES[name],
                              "check": {k: v for k, v in r.items() if k != "footprint_hull_xz"},
                              "footprint_hull_xz": r["footprint_hull_xz"]})
    with open(os.path.join(ROOT, "igloo_props_layout.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
    summary = {n: {k: v for k, v in r.items() if k != "footprint_hull_xz"} for n, r in report.items()}

    # ---- inside preview
    if render_inside:
        rig = bpy.data.collections.new("PreviewRig")
        sc.collection.children.link(rig)
        if os.path.exists(SHELL):
            _, shell_obs = import_glb(sc, SHELL, "P_Shell")
            plug = os.path.join(ROOT, "SM_Igloo_ExitPlug.glb")
            if os.path.exists(plug):
                import_glb(sc, plug, "P_ExitPlug")
            bpy.context.view_layer.update()
            fit = shell_fit(shell_obs, placed)
            data["shell_fit"] = fit
            summary["shell_fit"] = fit
            with open(os.path.join(ROOT, "igloo_props_layout.json"), "w", encoding="utf-8") as f:
                json.dump(data, f, indent=1)
            bpy.ops.mesh.primitive_circle_add(vertices=64, radius=R_IN + 0.3, fill_type="NGON")
            fl = bpy.context.active_object
            fl.data.materials.append(mat("StandIn_FloorSnow", (0.8, 0.85, 0.92), 0.85))
        else:
            stand_in_dome(rig)
        stand_in_fire(rig)
        ln = [e for e in LAYOUT if e[0] == "SM_Igloo_Lantern"][0]
        lights(sc, rig, (ln[1], -ln[3], ln[2] - 0.29))
        cam = bpy.data.objects.new("GameCam", bpy.data.cameras.new("GameCam"))
        rig.objects.link(cam)
        rider_z, back, up = -3.5, 6.0, 2.5
        cam.location = (0, -(rider_z - back), up)
        pitch = math.atan2(up - 1.0, back)
        cam.rotation_euler = (math.radians(90) - pitch, 0, math.radians(180))
        cam.data.lens, cam.data.sensor_fit = 22, "AUTO"
        render(sc, cam, os.path.join(ROOT, "previews", "Props_inside.png"), 720, 1280, 64)
    if render_turn:
        turntable()
    return {"all_ok": data["all_ok"], "overlaps": ov, "summary": summary}


def turntable():
    """one row per model, four views (front, right, back, left) framed on the model's bounds."""
    sc = get_scene("IglooPropsTurn")
    wipe_scene(sc)
    rig = bpy.data.collections.new("TurnRig")
    sc.collection.children.link(rig)
    bpy.ops.mesh.primitive_plane_add(size=200)
    fl = bpy.context.active_object
    for c in fl.users_collection:
        c.objects.unlink(fl)
    rig.objects.link(fl)
    fl.data.materials.append(mat("Turn_Floor", (0.55, 0.6, 0.68), 0.9))
    w = bpy.data.worlds.get("IglooTurnWorld") or bpy.data.worlds.new("IglooTurnWorld")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.6, 0.66, 0.78, 1)
    bg.inputs[1].default_value = 0.7
    for nm, rot, en, colr in (("Key", (50, 0, 35), 3.2, (1.0, 0.9, 0.78)),
                              ("Fill", (60, 0, 215), 0.9, (0.75, 0.85, 1.0))):
        ld = bpy.data.lights.new("Turn" + nm, "SUN")
        ld.energy, ld.color, ld.angle = en, colr, math.radians(8)
        lo = bpy.data.objects.new("Turn" + nm, ld)
        lo.rotation_euler = tuple(math.radians(a) for a in rot)
        rig.objects.link(lo)
    cam = bpy.data.objects.new("TurnCam", bpy.data.cameras.new("TurnCam"))
    rig.objects.link(cam)
    cam.data.lens = 50
    models = {}
    for name, *_ in LAYOUT:
        roots, new = import_glb(sc, os.path.join(ROOT, name + ".glb"), "T_" + name)
        root = [r for r in roots if r.name.startswith(name)][0]
        if name == "SM_Igloo_Lantern":
            root.location.z = 0.5           # hang it just above the floor
        models[name] = new
    bpy.context.view_layer.update()
    tw, th = 320, 240
    rows = []
    for name, new in models.items():
        for n2, other in models.items():
            for o in other:
                o.hide_render = n2 != name
        pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        ctr, rad = (lo + hi) / 2, (hi - lo).length / 2
        fov = 2 * math.atan(18 / cam.data.lens) * (th / tw)
        d = rad / math.sin(fov / 2) * 1.05
        tiles = []
        for k, az in enumerate((0, 90, 180, 270)):
            a, el = math.radians(az), math.radians(28)
            cam.location = ctr + Vector((d * math.cos(el) * math.sin(a), -d * math.cos(el) * math.cos(a),
                                         d * math.sin(el)))
            cam.rotation_euler = (math.radians(90) - el, 0, a)
            p = render(sc, cam, os.path.join(TMP, f"turn_{k}.png"), tw, th, 24)
            im = bpy.data.images.load(p)
            tiles.append(np.array(im.pixels[:], np.float32).reshape(th, tw, 4))
            bpy.data.images.remove(im)
            os.remove(p)
        rows.append(np.concatenate(tiles, 1))
    sheet = np.concatenate(rows[::-1], 0)               # image rows start at the bottom
    out = bpy.data.images.new("Props_turntable", sheet.shape[1], sheet.shape[0])
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.join(ROOT, "previews", "Props_turntable.png")
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
