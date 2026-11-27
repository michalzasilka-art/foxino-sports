"""Preview renders of the five kicker GLBs (imported back from the exported files).

  blender -b --factory-startup -P render_previews.py -- <kickers_dir>

Writes previews/kickers_gamecam.png (720x1280, behind and above, looking down +Z / downhill)
and previews/kickers_side.png (720x1280, orthographic side view, the five profiles stacked).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

D = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
PREV = os.path.join(D, "previews")
os.makedirs(PREV, exist_ok=True)
NAMES = ["SM_Kicker", "SM_StepUp", "SM_GapJump", "SM_TableTop", "SM_BigAir"]
LEN = {"SM_Kicker": 5.75, "SM_StepUp": 5.75, "SM_GapJump": 6.95, "SM_TableTop": 12.65, "SM_BigAir": 17.35}
LIP = {"SM_Kicker": 1.0, "SM_StepUp": 1.15, "SM_GapJump": 1.5, "SM_TableTop": 1.3, "SM_BigAir": 4.6}

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
sc = bpy.context.scene
roots = {}
for n in NAMES:
    bpy.ops.import_scene.gltf(filepath=os.path.join(D, n + ".glb"))
    roots[n] = bpy.data.objects[n]
snow = bpy.data.materials["M_SnowGroomed"]


def box(name, loc, size, mat):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    o.data.materials.append(mat)
    return o


def ground(name, cx, cy, sx, sy, z=-0.003):
    bpy.ops.mesh.primitive_plane_add(location=(cx, cy, z))
    g = bpy.context.object
    g.name = name
    g.scale = (sx / 2, sy / 2, 1)
    bpy.ops.object.transform_apply(scale=True)
    for lp in g.data.loops:                      # world-scale UVs, 2 m tiles like the kickers
        co = g.data.vertices[lp.vertex_index].co
        g.data.uv_layers.active.data[lp.index].uv = ((co.x + cx) / 2.0, (co.y + cy) / 2.0)
    g.data.materials.append(snow)
    return g


# ---------------------------------------------------------------- world, light, look
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.image_settings.compression = 90
sc.view_settings.view_transform = "AgX"
sc.view_settings.exposure = 0.0
try:
    sc.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass
try:
    sc.eevee.taa_render_samples = 32
except AttributeError:
    pass
world = bpy.data.worlds.new("Sky")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
sun_d = bpy.data.lights.new("Sun", "SUN")
sun_d.energy = 4.5
sun_d.color = (1.0, 0.95, 0.88)
sun_d.angle = math.radians(3)
sun = bpy.data.objects.new("Sun", sun_d)
sc.collection.objects.link(sun)
cam_d = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_d)
sc.collection.objects.link(cam)
sc.camera = cam


def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------- 1) game camera
layout = {"SM_Kicker": (-0.8, 0.0), "SM_StepUp": (2.8, -11.0), "SM_GapJump": (-3.0, -22.0),
          "SM_TableTop": (3.2, -34.5), "SM_BigAir": (0.0, -53.0)}
for n, (x, y) in layout.items():
    roots[n].location = (x, y, 0)
g1 = ground("Ground", 0, -40, 160, 160)
bg.inputs["Color"].default_value = (0.42, 0.60, 0.90, 1)
bg.inputs["Strength"].default_value = 0.55
sun.rotation_euler = (math.radians(58), 0, math.radians(-60))
cam_d.type = "PERSP"
cam_d.sensor_fit = "VERTICAL"
cam_d.angle = math.radians(58)
cam.location = (0, 10.0, 6.8)
aim(cam, (0, -24, 0))
sc.render.filepath = os.path.join(PREV, "kickers_gamecam.png")
bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- 2) side view (profiles)
g1.hide_render = True
dark = bpy.data.materials.new("Band")
dark.use_nodes = True
b = next(nd for nd in dark.node_tree.nodes if nd.type == "BSDF_PRINCIPLED")
b.inputs["Base Color"].default_value = (0.10, 0.16, 0.28, 1)
b.inputs["Roughness"].default_value = 0.9
order = ["SM_BigAir", "SM_TableTop", "SM_GapJump", "SM_StepUp", "SM_Kicker"]   # bottom to top
z = 0.0
for n in order:
    roots[n].location = (0, 0, z)
    box("Band_" + n, (0, -9.0, z - 0.12), (20, 22, 0.24), dark).visible_shadow = False
    z += LIP[n] + 3.0
top = z - 3.0
bg.inputs["Color"].default_value = (0.16, 0.24, 0.40, 1)
bg.inputs["Strength"].default_value = 0.6
sun.rotation_euler = (math.radians(55), 0, math.radians(-100))     # light the -X side the camera sees
cam_d.type = "ORTHO"
cam_d.sensor_fit = "VERTICAL"
cam_d.ortho_scale = 33.0
cam.location = (-40, -17.35 / 2, top / 2 - 0.4)
cam.rotation_euler = (math.radians(90), 0, math.radians(-90))       # look +X, downhill to the right
sc.render.filepath = os.path.join(PREV, "kickers_side.png")
bpy.ops.render.render(write_still=True)
print("PREVIEWS_DONE")
