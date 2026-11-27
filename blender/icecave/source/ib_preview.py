"""Preview renders for the lane B ice formations (not exported): a mock cave arch built from the
shared end profile, cave lighting (dim blue fill + warm lantern), the game camera (2.5 m up, 6 m
behind the rider, looking downhill = Blender -Y), and a turntable sheet. Needs the SM_* low meshes."""
import math
import os

import bmesh
import bpy
from mathutils import Vector

PROFILE = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25), (4.95, 4.95),
           (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
NAMES = ["SM_Icicle_Cluster_1", "SM_Icicle_Cluster_2", "SM_Icicle_Cluster_3", "SM_Ice_Pillar_1", "SM_Ice_Pillar_2",
         "SM_Ice_Crystal_1", "SM_Ice_Crystal_2", "SM_Rock_Ice_1", "SM_Rock_Ice_2"]
PSCN = "IB_Preview"


def ceil_z(x):
    x = abs(x)
    pts = sorted(PROFILE)
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
    return 0.0


def _mat(name, col, rough, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = col
    bs.inputs["Roughness"].default_value = rough
    return m


def pscene():
    sc = bpy.data.scenes.get(PSCN)
    if sc:
        for o in list(sc.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        sc = bpy.data.scenes.new(PSCN)
    bpy.context.window.scene = sc
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Base Contrast"
    sc.render.film_transparent = False
    w = bpy.data.worlds.get("IB_CaveWorld") or bpy.data.worlds.new("IB_CaveWorld")
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.010, 0.022, 0.050, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = w
    return sc


def add(sc, ob):
    sc.collection.objects.link(ob)
    return ob


def inst(sc, name, loc, rotz=0.0):
    src = bpy.data.objects[name]
    o = bpy.data.objects.new(name + "_pv", src.data)
    o.location = loc
    o.rotation_euler = (0, 0, rotz)
    return add(sc, o)


def cave_shell(sc, length=80.0):
    bm = bmesh.new()
    pts = [(-x, z) for x, z in reversed(PROFILE)] + [(x, z) for x, z in PROFILE[::-1]][::-1][1:]
    pts = [(-x, z) for x, z in PROFILE] + [(x, z) for x, z in reversed(PROFILE)][1:]
    rows = []
    n = 40
    for k in range(n + 1):
        y = 6.0 - length * k / n
        rows.append([bm.verts.new((x * 1.04, y, z * 1.03)) for x, z in pts])
    for k in range(n):
        for i in range(len(pts) - 1):
            bm.faces.new((rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]))
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new("IB_pv_shell")
    bm.to_mesh(me)
    bm.free()
    o = add(sc, bpy.data.objects.new("IB_pv_shell", me))
    o.data.materials.append(_mat("IB_pv_rock", (0.06, 0.075, 0.10, 1), 0.7))
    fl = bpy.data.meshes.new("IB_pv_floor")
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in ((-8.4, 6, 0), (8.4, 6, 0), (8.4, -74, 0), (-8.4, -74, 0))]
    bm.faces.new(vs)
    bm.to_mesh(fl)
    bm.free()
    of = add(sc, bpy.data.objects.new("IB_pv_floor", fl))
    of.data.materials.append(_mat("IB_pv_snow", (0.55, 0.66, 0.80, 1), 0.8))
    return o


def light(sc, name, kind, loc, energy, col, size=0.3):
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = col
    if kind == "POINT":
        ld.shadow_soft_size = size
    o = add(sc, bpy.data.objects.new(name, ld))
    o.location = loc
    return o


def camera(sc, name, loc, rot, fov_v=60.0):
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(fov_v)
    cd.clip_end = 200
    o = add(sc, bpy.data.objects.new(name, cd))
    o.location = loc
    o.rotation_euler = rot
    sc.camera = o
    return o


def game_shot(path):
    sc = pscene()
    cave_shell(sc)
    # rider at the origin; formations ahead along -Y. Preview only: wall pieces sit ~3-4.5 m off the
    # centre line (the game puts them on the walls) so all nine fit the 9:16 frame.
    for n, x, y, rz in [("SM_Icicle_Cluster_1", -1.9, -7.0, 0.3), ("SM_Icicle_Cluster_2", 1.7, -10.0, 1.2),
                        ("SM_Icicle_Cluster_3", -0.3, -15.0, 2.0)]:
        inst(sc, n, (x, y, ceil_z(x) * 1.03 + 0.04), rz)  # top tucked into the mock shell
    inst(sc, "SM_Ice_Pillar_1", (-4.4, -14.0, 0), 0.4)
    inst(sc, "SM_Ice_Pillar_2", (4.6, -20.0, 0), 1.9)
    inst(sc, "SM_Ice_Crystal_1", (2.3, -4.0, 0), 2.6)
    inst(sc, "SM_Ice_Crystal_2", (-3.2, -19.0, 0), 0.9)
    inst(sc, "SM_Rock_Ice_1", (-2.6, -5.5, 0), 1.4)
    inst(sc, "SM_Rock_Ice_2", (3.4, -10.5, 0), 3.5)
    light(sc, "IB_pv_lantern1", "POINT", (0.4, -6.0, 3.0), 300, (1.0, 0.68, 0.38))
    light(sc, "IB_pv_lantern2", "POINT", (-0.5, -16.0, 3.4), 300, (1.0, 0.66, 0.36))
    light(sc, "IB_pv_blue", "POINT", (0, 2.0, 4.5), 500, (0.45, 0.70, 1.0), 2.0)
    light(sc, "IB_pv_blue2", "POINT", (0, -11.0, 5.0), 400, (0.45, 0.70, 1.0), 2.0)
    camera(sc, "IB_pv_gamecam", (0, 6.0, 2.5), (math.radians(84), 0, math.radians(180)), 62)
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1920
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def turntable(path_dir, angles=(0, 90, 180, 270)):
    """One 4-angle strip per model, rendered on a dark blue backdrop with the cave lights."""
    sc = pscene()
    out = []
    light(sc, "IB_tt_key", "AREA", (3, 4, 5), 400, (1.0, 0.78, 0.55))
    light(sc, "IB_tt_fill", "AREA", (-4, -2, 3), 250, (0.55, 0.75, 1.0))
    for o in sc.objects:
        if o.type == "LIGHT" and o.data.type == "AREA":
            o.data.size = 3.0
            d = Vector((0, 0, 1.5)) - o.location
            o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam = camera(sc, "IB_tt_cam", (0, 0, 0), (0, 0, 0), 40)
    sc.render.resolution_x = 300
    sc.render.resolution_y = 400
    for n in NAMES:
        src = bpy.data.objects[n]
        o = inst(sc, n, (0, 0, 0))
        zs = [v.co.z for v in src.data.vertices]
        zmin, zmax = min(zs), max(zs)
        hgt = zmax - zmin
        if zmax <= 1e-4:  # icicle: show hanging
            o.location.z = hgt + 0.2
            zmin, zmax = 0.2, hgt + 0.2 + 1e-3
        ctr = Vector((0, 0, (zmin + zmax) / 2))
        size = max(hgt, max(src.dimensions.x, src.dimensions.y))
        dist = size / (2 * math.tan(math.radians(20))) * 1.25 + 0.6
        for a in angles:
            o.rotation_euler = (0, 0, math.radians(a))
            el = math.radians(-12 if zmax > hgt else 18)  # icicles: seen from below, as in the game
            cam.location = ctr + Vector((0, -math.cos(el) * dist, math.sin(el) * dist))
            cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
            p = os.path.join(path_dir, f"tt_{n}_{a:03d}.png")
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            out.append(p)
        bpy.data.objects.remove(o, do_unlink=True)
    return out


def sheet(paths, cols, out_path, gap=6, bg=(0.02, 0.04, 0.08)):
    """Tile equally sized PNGs (row-major) into one PNG with Blender's image API (no PIL here)."""
    import numpy as np
    imgs = [bpy.data.images.load(p, check_existing=False) for p in paths]
    w, h = imgs[0].size
    rows = (len(imgs) + cols - 1) // cols
    W, H = cols * w + (cols + 1) * gap, rows * h + (rows + 1) * gap
    canvas = np.empty((H, W, 4), dtype=np.float32)
    canvas[:] = (*bg, 1.0)
    for i, im in enumerate(imgs):
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        px = px.reshape(h, w, 4)
        r, c = divmod(i, cols)
        y0 = H - (r + 1) * (h + gap)  # Blender pixel rows start at the bottom
        x0 = gap + c * (w + gap)
        canvas[y0:y0 + h, x0:x0 + w] = px
        bpy.data.images.remove(im)
    out = bpy.data.images.new("IB_sheet", W, H, alpha=False)
    out.pixels.foreach_set(canvas.ravel())
    out.filepath_raw = out_path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return out_path
