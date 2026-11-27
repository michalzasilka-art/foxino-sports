# Preview renders for the lane D ice cave props (game camera + turntable sheet).
# Needs the IceProps_D scene from icecave_props_d.py. Lights/cameras live only in the preview scenes.
import bpy, math, os
import numpy as np
from mathutils import Vector

PREV = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\d-icecave\blender\icecave\previews"
SCR = r"C:\Users\micha\AppData\Local\Temp\claude\c036e47f4ddc8e51\5ce5d967-04ae-47cb-9336-95ea1785f125\scratchpad\icecave_d"
SRC = "IceProps_D"
PROF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25), (4.95, 4.95),
        (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]


def G(x, y, z):
    return Vector((x, -z, y))


def fresh_scene(name):
    sc = bpy.data.scenes.get(name)
    if sc:
        for ob in list(sc.collection.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
    else:
        sc = bpy.data.scenes.new(name)
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'None'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    w = bpy.data.worlds.get(name) or bpy.data.worlds.new(name)
    try:
        w.use_nodes = True
    except Exception:
        pass
    sc.world = w
    return sc


def inst(sc, src_name, loc, rot_z=0.0, with_children=True):
    src = bpy.data.objects[src_name]
    ob = bpy.data.objects.new("P_" + src_name, src.data)
    ob.location = loc
    ob.rotation_euler = (0, 0, rot_z)
    sc.collection.objects.link(ob)
    if with_children:
        for ch in src.children:
            c = bpy.data.objects.new("P_" + ch.name, ch.data)
            c.parent = ob
            sc.collection.objects.link(c)
    return ob


def ctx_mat(name, col, rough, nimg_name=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.node_tree.nodes.clear()
    nt = m.node_tree
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    if nimg_name and bpy.data.images.get(nimg_name):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images[nimg_name]
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (0.4, 0.4, 0.4)
        nt.links.new(tc.outputs['Object'], mp.inputs[0])
        nt.links.new(mp.outputs[0], t.inputs[0])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


def cave_context(sc, length=34.0, z0=-8.0):
    import bmesh
    bm = bmesh.new()
    prof = PROF + [(-x, y) for (x, y) in reversed(PROF[:-1])]
    rings = []
    nseg = 34
    for j in range(nseg + 1):
        z = z0 + length * j / nseg
        rings.append([bm.verts.new(G(x * 1.0, y, z)) for (x, y) in prof])
    for j in range(nseg):
        for i in range(len(prof) - 1):
            bm.faces.new([rings[j][i], rings[j + 1][i], rings[j + 1][i + 1], rings[j][i + 1]])
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new("ctx_cave")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("ctx_cave", me)
    me.materials.append(ctx_mat("ctx_rock", (0.20, 0.24, 0.30), 0.75, "T_Rock_N"))
    sc.collection.objects.link(ob)
    # floor (the game's own snow floor)
    bpy.ops.mesh.primitive_plane_add(size=1)
    fl = bpy.context.active_object
    for c in fl.users_collection:
        c.objects.unlink(fl)
    sc.collection.objects.link(fl)
    fl.name = "ctx_floor"
    fl.scale = (16.2, length, 1)
    fl.location = G(0, -0.001, z0 + length / 2)
    fl.data.materials.append(ctx_mat("ctx_snow", (0.70, 0.78, 0.88), 0.8))


def cave_lights(sc, warm_spots):
    w = sc.world
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.02, 0.04, 0.08, 1)
    bg.inputs[1].default_value = 1.0
    # dim blue fill from the cave mouth and from above
    for nm, loc, rot, en in [("ctx_fill", G(0, 5.5, -6), (math.radians(70), 0, 0), 2600.0),
                             ("ctx_top", G(0, 6.0, 12), (0, 0, 0), 1800.0)]:
        ld = bpy.data.lights.new(nm, 'AREA')
        ld.color = (0.45, 0.65, 1.0)
        ld.energy = en
        ld.size = 10
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        lo.rotation_euler = rot
        sc.collection.objects.link(lo)
    for k, p in enumerate(warm_spots):
        ld = bpy.data.lights.new("ctx_warm%d" % k, 'POINT')
        ld.color = (1.0, 0.62, 0.28)
        ld.energy = 120
        ld.shadow_soft_size = 0.15
        lo = bpy.data.objects.new("ctx_warm%d" % k, ld)
        lo.location = p
        sc.collection.objects.link(lo)


def game_preview(path):
    sc = fresh_scene("IceProps_D_Game")
    cave_context(sc)
    inst(sc, "SM_IceLip_Sides", G(0, 0, 3))
    inst(sc, "SM_IceLedge", G(-4.6, 0, 1.5))
    inst(sc, "SM_IceBridge", G(0, 0, 11))
    inst(sc, "SM_Lantern_Ice_1", G(2.2, 6.02, 8))
    inst(sc, "SM_Lantern_Ice_2", G(4.6, 0, 5.2))
    cave_lights(sc, [G(2.2, 5.35, 8), G(4.6, 0.7, 5.2)])
    cd = bpy.data.cameras.new("ctx_cam")
    cd.lens = 22
    cd.sensor_fit = 'HORIZONTAL'
    cd.sensor_width = 36
    cam = bpy.data.objects.new("ctx_cam", cd)
    sc.collection.objects.link(cam)
    cam.location = G(0, 2.5, -4.0)
    tgt = G(0, 1.4, 8.0)
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 720, 1280
    sc.render.filepath = path
    sc.eevee.taa_render_samples = 64
    bpy.context.window.scene = sc
    bpy.ops.render.render(write_still=True)
    return path


def turntable(path, cell=320):
    names = ["SM_IceLedge", "SM_IceLip_Sides", "SM_IceBridge", "SM_Lantern_Ice_1", "SM_Lantern_Ice_2"]
    sc = fresh_scene("IceProps_D_Turn")
    w = sc.world
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.10, 0.13, 0.18, 1)
    bg.inputs[1].default_value = 1.0
    for nm, rot, en, col in [("tt_key", (math.radians(50), 0, math.radians(35)), 3.0, (1.0, 0.92, 0.85)),
                             ("tt_rim", (math.radians(60), 0, math.radians(200)), 2.0, (0.6, 0.8, 1.0))]:
        ld = bpy.data.lights.new(nm, 'SUN')
        ld.energy = en
        ld.color = col
        lo = bpy.data.objects.new(nm, ld)
        lo.rotation_euler = rot
        sc.collection.objects.link(lo)
    cd = bpy.data.cameras.new("tt_cam")
    cd.type = 'ORTHO'
    cam = bpy.data.objects.new("tt_cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = cell
    sc.eevee.taa_render_samples = 32
    bpy.context.window.scene = sc
    sheet = np.zeros((len(names) * cell, 4 * cell, 4), dtype=np.float32)
    for r_, nm in enumerate(names):
        ob = inst(sc, nm, Vector((0, 0, 0)))
        kids = [ob] + list(ob.children)
        bpy.context.view_layer.update()
        pts = [k.matrix_world @ v.co for k in kids for v in k.data.vertices]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        ctr, size = (lo + hi) / 2, (hi - lo).length
        cd.ortho_scale = size * 1.0
        for c_, ang in enumerate([30, 120, 210, 300]):
            a = math.radians(ang)
            d = Vector((math.cos(a), math.sin(a), 0.55)).normalized()
            cam.location = ctr + d * size * 2
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            cd.clip_end = size * 5
            fp = os.path.join(SCR, "tt_%d_%d.png" % (r_, c_))
            sc.render.filepath = fp
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(fp)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(cell, cell, 4)
            bpy.data.images.remove(img)
            row = len(names) - 1 - r_
            sheet[row * cell:(row + 1) * cell, c_ * cell:(c_ + 1) * cell] = px
            os.remove(fp)
        for k in kids:
            bpy.data.objects.remove(k, do_unlink=True)
    out = bpy.data.images.new("tt_sheet", 4 * cell, len(names) * cell, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
    return path
