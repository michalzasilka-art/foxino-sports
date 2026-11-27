"""Preview renders from the exported GLBs (EEVEE, 720x1280).
blender -b --factory-startup -P rl_render.py -- <glb_dir> <png_dir>
game.png: behind and above, looking down +Z (downhill) at all four on snow.
side.png: orthographic side view, the four pieces stacked in rows (top to bottom: Rainbow, FunBox, Box, Cane).
"""
import bpy, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
GLB, PNG = argv[0], argv[1]
os.makedirs(PNG, exist_ok=True)
NAMES = ['SM_Rail_Cane', 'SM_Box', 'SM_Rail_Rainbow', 'SM_FunBox']


def B(gx, gy, gz):
    return Vector((gx, -gz, gy))


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)


def load(name, loc):
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, name + '.glb'))
    for ob in bpy.context.selected_objects:
        if ob.parent is None:
            ob.location = loc
    return bpy.context.selected_objects


def snow_mat():
    m = bpy.data.materials.new('SnowGround')
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.80, 0.86, 0.95, 1)
    bsdf.inputs['Roughness'].default_value = 0.8
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 3.0
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.15
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def ground(cx, cy, cz, sx, sy, mat):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, cz))
    p = bpy.context.active_object; p.scale = (sx, sy, 1); p.data.materials.append(mat)
    return p


def setup_world():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 720, 1280, 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.compression = 90
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.eevee.taa_render_samples = 32
    except Exception:
        pass
    w = bpy.data.worlds.new('Sky'); sc.world = w
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.42, 0.62, 0.95, 1); bg.inputs['Strength'].default_value = 0.8
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 2.6; sun.angle = math.radians(8)
    so = bpy.data.objects.new('Sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-30))


def cam(loc, target, lens=None, ortho=None):
    c = bpy.data.cameras.new('Cam')
    if ortho:
        c.type = 'ORTHO'; c.ortho_scale = ortho
    else:
        c.lens = lens
    c.clip_end = 200
    o = bpy.data.objects.new('Cam', c); bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = o
    return o


clear(); setup_world()
sm = snow_mat()
# --- game camera shot
xs = {'SM_Rail_Cane': -2.35, 'SM_Box': -1.05, 'SM_Rail_Rainbow': 0.35, 'SM_FunBox': 1.95}
for n in NAMES:
    load(n, B(xs[n], 0, 0))
ground(0, -10, 0, 40, 60, sm)
cam(B(0, 2.9, -3.6), B(0, 0.0, 6.5), lens=17)
bpy.context.scene.render.filepath = os.path.join(PNG, 'rails_game.png')
bpy.ops.render.render(write_still=True)

# --- side view
clear(); setup_world()
rows = {'SM_Rail_Cane': 0.0, 'SM_Box': 6.3, 'SM_FunBox': 12.6, 'SM_Rail_Rainbow': 18.9}
for n in NAMES:
    load(n, Vector((0, 0, rows[n])))
    ground(0, -7, rows[n], 4.0, 17.0, sm)
mid = Vector((0, -7.0, 10.4))
cam(mid + Vector((30, 0, 30 * math.tan(math.radians(6)))), mid, ortho=26.0)
bpy.context.scene.render.filepath = os.path.join(PNG, 'rails_side.png')
bpy.ops.render.render(write_still=True)
if len(argv) > 2:   # extra close-up for checking only
    clear(); setup_world()
    load('SM_Rail_Cane', B(-0.6, 0, 0)); load('SM_FunBox', B(1.2, 0, 0)); load('SM_Box', B(-2.0, 0, 0))
    ground(0, -10, 0, 40, 60, sm)
    cam(B(-2.2, 1.3, 9.2), B(0.0, 0.35, 12.0), lens=30)
    bpy.context.scene.render.filepath = os.path.join(argv[2], 'closeup.png')
    bpy.ops.render.render(write_still=True)
print('RENDERED')
