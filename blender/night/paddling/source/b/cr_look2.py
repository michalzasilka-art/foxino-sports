# look at a clip frame with a bench + water plane: blender -b anim.blend -P look2.py -- out.png clip frame views [lod]
import bpy, sys, math, os
import numpy as np
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
OUT, CLIP, FR = argv[0], argv[1], float(argv[2]); VIEWS = argv[3].split(','); LOD = argv[4] if len(argv) > 4 else ''
sc = bpy.context.scene
for o in sc.objects:
    if o.animation_data:
        for tr in o.animation_data.nla_tracks:
            tr.mute = (tr.name != CLIP)
        o.animation_data.action = None
    if o.type == 'MESH' and o.name.startswith('Crew'):
        o.hide_render = (o.name.endswith('_LOD1') != (LOD == 'lod1'))
sc.frame_set(int(FR))
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.36 - 0.03)); b = bpy.context.active_object; b.scale = (1.3, 0.28, 0.06)
bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, 0)); w = bpy.context.active_object
mw = bpy.data.materials.new('w'); mw.diffuse_color = (0.2, 0.45, 0.8, 0.5); w.data.materials.append(mw)
mb = bpy.data.materials.new('b'); mb.diffuse_color = (0.5, 0.35, 0.2, 1); b.data.materials.append(mb)
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = 500; sc.render.resolution_y = 500
cam_d = bpy.data.cameras.new('c'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = float(os.environ.get('OS', '1.9'))
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
C = Vector(tuple(float(x) for x in os.environ.get('CC', '0,-0.3,0.45').split(',')))
dirs = {'front': (0, -1, 0.0), 'side': (1, 0, 0.0), 'lside': (-1, 0, 0), 'back': (0, 1, 0.0), 'tq': (0.8, -0.8, 0.5),
        'top': (0, 0.0001, 1), 'game': (0, 1.2, 0.9), 'tqb': (-0.7, 0.8, 0.6)}
tiles = []
for v in VIEWS:
    d = Vector(dirs[v]).normalized()
    cam.location = C + d * 5
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = OUT + '.tmp.png'
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(sc.render.filepath)
    tiles.append(np.array(im.pixels[:]).reshape(im.size[1], im.size[0], 4)); bpy.data.images.remove(im)
sheet = np.concatenate(tiles, axis=1); h, ww = sheet.shape[:2]
img = bpy.data.images.new('sheet', ww, h); img.pixels[:] = sheet.ravel()
img.filepath_raw = OUT; img.file_format = 'PNG'; img.save(); os.remove(OUT + '.tmp.png')
