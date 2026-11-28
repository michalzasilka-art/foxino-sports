import bpy, sys
out = sys.argv[sys.argv.index('--') + 1]
for o in bpy.data.objects:
    if o.name.startswith('Mallet') or o.name == 'Paddle':
        mw = o.matrix_world.copy() if o.name == 'Paddle' else None
        o.parent = None
        o.scale = (1, 1, 1); o.location = (0, 0, 0) if mw is None else mw.translation
        o.rotation_quaternion = (1, 0, 0, 0)
        if o.name == 'Mallet_R': o.location.x = 0.3
        if o.name == 'Mallet_L': o.location.x = -0.3
        if o.name == 'Paddle': o.location = (1.0, 0, 0)
bpy.ops.wm.save_as_mainfile(filepath=out)
