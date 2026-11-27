"""Previews for the W2b floor rocks (not exported). Reuses ib_preview.py (mock cave shell from the
shared end profile, lights, camera, sheet). Needs the SM_Rock_Edge_* / SM_Boulder_* low meshes.

floor_rocks.png: the rider rides near the left wall (camera 2.5 m up, 6 m behind, x = -4.8, turned 14 deg
toward the wall) so the wall base is in the 9:16 frame; the edge rocks sit with their backs
(-X) against the left wall, one mirrored copy on the right wall shows the mirror use.
"""
import math
import os

import bpy

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.environ.get("IB_SRC", "")
PV = {}
exec(open(os.path.join(_HERE, "ib_preview.py")).read(), PV)
NAMES = ["SM_Rock_Edge_1", "SM_Rock_Edge_2", "SM_Rock_Edge_3", "SM_Boulder_1", "SM_Boulder_2"]
WALL_X = 8.0 * 1.04  # mock shell is scaled 1.04 in x


def wall_rock(sc, name, y, rz=0.0, right=False):
    src = bpy.data.objects[name]
    back = min(v.co.x for v in src.data.vertices)  # back face (-X) offset from the origin
    o = PV["inst"](sc, name, (0, y, 0), rz)
    x = -WALL_X - back - 0.03
    if right:
        o.scale.x = -1.0
        x = -x
    o.location.x = x
    return o


def game_shot(path):
    sc = PV["pscene"]()
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.006, 0.012, 0.028, 1)
    PV["cave_shell"](sc)
    fl = bpy.data.materials["IB_pv_snow"].node_tree.nodes["Principled BSDF"]
    fl.inputs["Base Color"].default_value = (0.30, 0.38, 0.50, 1)
    wall_rock(sc, "SM_Rock_Edge_2", -1.2, 0.05)
    wall_rock(sc, "SM_Rock_Edge_1", -4.0, -0.04)
    PV["inst"](sc, "SM_Boulder_2", (-6.5, -7.4, 0), 0.6)
    wall_rock(sc, "SM_Rock_Edge_3", -9.6, 0.1)
    wall_rock(sc, "SM_Rock_Edge_1", -12.0, 0.0)
    PV["inst"](sc, "SM_Boulder_1", (-6.0, -16.0, 0), 2.2)
    wall_rock(sc, "SM_Rock_Edge_2", -8.0, 0.0, right=True)  # mirrored copy on the right wall
    PV["light"](sc, "IB_pv_lantern1", "POINT", (-3.6, -5.5, 3.0), 140, (1.0, 0.72, 0.45))
    PV["light"](sc, "IB_pv_lantern2", "POINT", (-3.0, -15.5, 3.2), 140, (1.0, 0.70, 0.42))
    PV["light"](sc, "IB_pv_blue", "POINT", (-4.0, 1.0, 4.0), 300, (0.45, 0.68, 1.0), 2.0)
    PV["light"](sc, "IB_pv_blue2", "POINT", (-4.0, -10.0, 4.6), 300, (0.45, 0.68, 1.0), 2.0)
    PV["camera"](sc, "IB_pv_gamecam", (-4.8, 6.0, 2.5), (math.radians(80), 0, math.radians(180 - 14)), 62)
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1920
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def turntable(tmp_dir, out_path):
    PV["NAMES"][:] = NAMES
    paths = PV["turntable"](tmp_dir)
    PV["sheet"](paths, 4, out_path)
    for p in paths:
        os.remove(p)
    return out_path
