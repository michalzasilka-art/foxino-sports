"""Preview renders for the ice cave segments (game camera, chained run, turntable sheet).
Lights/cameras live in a throwaway scene and never reach the GLBs.
Run in Blender after icecave_segment.py: exec(open(f).read()); render_*()
"""
import math

import bpy
import numpy as np
from mathutils import Vector

PREV = "LaneA_IceCave_Preview"
FILL_W, LANTERN_W = 170, 320


def g2b(x, y, z):
    return Vector((x, -z, y))


def fresh_scene():
    sc = bpy.data.scenes.get(PREV)
    if sc:
        for ob in list(sc.objects):
            if ob.type in {"CAMERA", "LIGHT"} or ob.get("prev_inst"):
                bpy.data.objects.remove(ob)
        bpy.data.scenes.remove(sc)
    sc = bpy.data.scenes.new(PREV)
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.get("LaneA_CaveWorld") or bpy.data.worlds.new("LaneA_CaveWorld")
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.015, 0.025, 0.05, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = w
    return sc


def inst(sc, name, zoff):
    src = bpy.data.objects[name]
    ob = bpy.data.objects.new(f"prev_{name}_{zoff}", src.data)
    ob.location = g2b(0, 0, zoff)
    ob["prev_inst"] = 1
    sc.collection.objects.link(ob)
    return ob


def light(sc, kind, name, pos, energy, color, size=0.3):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind in {"POINT", "SPOT"}:
        ld.shadow_soft_size = size
    if kind == "AREA":
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    ob.location = pos
    sc.collection.objects.link(ob)
    return ob


def camera(sc, pos, target, lens=24, w=720, h=1280):
    cd = bpy.data.cameras.new("prev_cam")
    cd.lens = lens
    cd.clip_end = 200
    cam = bpy.data.objects.new("prev_cam", cd)
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    return cam


def cave_lights(sc, zs):
    # dark mood: dim cool fill along the run + two warm lantern points on alternating walls
    for i, z in enumerate(zs):
        light(sc, "POINT", f"prev_fill_{i}", g2b(0, 4.0, z), FILL_W, (0.50, 0.70, 1.0), 4.0)
    for i, z in enumerate(zs[:2]):
        side = 1 if i % 2 == 0 else -1
        light(sc, "POINT", f"prev_lantern_{i}", g2b(6.3 * side, 2.2, z + 3), LANTERN_W, (1.0, 0.66, 0.34), 0.15)


def render(sc, path):
    sc.render.filepath = path
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True, scene=sc.name)


def cleanup():
    sc = bpy.data.scenes.get(PREV)
    if sc:
        for ob in list(sc.objects):
            bpy.data.objects.remove(ob)
        bpy.data.scenes.remove(sc)
    for blk in (bpy.data.cameras, bpy.data.lights, bpy.data.meshes, bpy.data.materials):
        for d in list(blk):
            if d.users == 0:
                blk.remove(d)


def floor(sc, z0, z1):
    """Preview-only snow floor (the game builds its own)."""
    me = bpy.data.meshes.new("prev_floor")
    me.from_pydata([g2b(-8, 0, z0), g2b(8, 0, z0), g2b(8, 0, z1), g2b(-8, 0, z1)], [], [(0, 1, 2, 3)])
    m = bpy.data.materials.get("prev_snow") or bpy.data.materials.new("prev_snow")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.36, 0.42, 0.52, 1)
    b.inputs["Roughness"].default_value = 0.8
    me.materials.append(m)
    ob = bpy.data.objects.new("prev_floor", me)
    ob["prev_inst"] = 1
    sc.collection.objects.link(ob)


def render_game(names_offsets, cam_z, path, lights_z):
    sc = fresh_scene()
    for n, z in names_offsets:
        inst(sc, n, z)
    floor(sc, min(z for _, z in names_offsets), max(z for _, z in names_offsets) + 10)
    cave_lights(sc, lights_z)
    camera(sc, g2b(0, 2.6, cam_z), g2b(0, 1.5, cam_z + 14), lens=26)
    render(sc, path)


def render_turntable(name, path, cell=512):
    """2x3 sheet: 4 orbit views from below the floor line (the floor is open), and both end views."""
    sc = fresh_scene()
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.35, 0.40, 0.48, 1)
    inst(sc, name, 0)
    light(sc, "SUN", "prev_sun", Vector((0, 0, 0)), 2.0, (1.0, 0.97, 0.92))
    light(sc, "POINT", "prev_in", g2b(0, 3.0, 5), 900, (1.0, 0.95, 0.9), 2.0)
    c = g2b(0, 3.0, 5.0)
    views = []
    for az in (30, 120, 210, 300):
        a = math.radians(az)
        views.append((c + Vector((17 * math.cos(a), 17 * math.sin(a), -8.5)), c))
    views.append((g2b(0, 3.0, -9.0), g2b(0, 3.0, 5.0)))
    views.append((g2b(0, 3.0, 19.0), g2b(0, 3.0, 5.0)))
    tiles = []
    for i, (p, t) in enumerate(views):
        for ob in [o for o in sc.objects if o.type == "CAMERA"]:
            bpy.data.objects.remove(ob)
        camera(sc, p, t, lens=24, w=cell, h=cell)
        tmp = path.replace(".png", f"_tmp{i}.png")
        render(sc, tmp)
        im = bpy.data.images.load(tmp)
        px = np.array(im.pixels[:], dtype=np.float32).reshape(cell, cell, 4)
        tiles.append(px)
        bpy.data.images.remove(im)
        import os
        os.remove(tmp)
    rows = [np.concatenate(tiles[0:3], 1), np.concatenate(tiles[3:6], 1)]
    sheet = np.concatenate([rows[1], rows[0]], 0)  # pixel rows go bottom-up
    out = bpy.data.images.new("prev_sheet", cell * 3, cell * 2, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
