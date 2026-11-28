# Paddling N20 (lane C): preview renders of the exported boats (headless).
# blender -b --factory-startup -P boat_preview.py -- <glb dir> <out dir>
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = argv[0], argv[1]
BOATS = [("Boat_Fox", (0.55, 0.30, 0.75)), ("Boat_Robot", (0.20, 0.75, 0.78)), ("Boat_Bear", (0.62, 0.38, 0.20))]


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


def load(name, dx=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.parent is None:
            o.location.x += dx
        if o.name.endswith("_LOD1") or o.name.split(".")[0].endswith("_LOD1"):
            o.hide_render = True
    return new


def mat(c, rough=0.6):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = tuple(c) + (1,)
    b.inputs["Roughness"].default_value = rough
    return m


def figure(seat, col, facing=1):
    """simple seated stand-in: hips at the bench top, knees forward, feet on the floor."""
    x, y, z = seat.matrix_world.translation   # Blender coords; glTF z = -y
    m = mat(col)
    parts = []

    def add(prim, loc, scale, rot=(0, 0, 0)):
        if prim == "uv":
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1, location=loc)
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1, depth=1, location=loc, rotation=rot)
        o = bpy.context.active_object; o.scale = scale; o.data.materials.append(m); parts.append(o)
    f = -facing  # forward along glTF +z is Blender -y
    add("cyl", (x, y, z + 0.22), (0.15, 0.13, 0.42))                     # torso
    add("uv", (x, y + f * 0.02, z + 0.53), (0.14, 0.14, 0.14))           # head
    for s in (-1, 1):
        add("cyl", (x + s * 0.08, y + f * 0.17, z + 0.02), (0.06, 0.06, 0.34), (math.pi / 2, 0, 0))  # thigh
        add("cyl", (x + s * 0.08, y + f * 0.33, z - 0.17), (0.05, 0.05, 0.36))                      # shin
    return parts


def setup_world(sc):
    sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.68, 0.85, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("sun", 'SUN'); sun.energy = 3.2; sun.color = (1.0, 0.93, 0.82)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(35))
    sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'


def water(sc, size=80):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    o = bpy.context.active_object
    m = bpy.data.materials.new("water"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.05, 0.22, 0.32, 1)
    b.inputs["Roughness"].default_value = 0.12
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 2.5
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.15
    nt.links.new(n.outputs[0], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    o.data.materials.append(m)


def cam(sc, loc, tgt, lens):
    c = bpy.data.cameras.new("cam"); c.lens = lens; c.clip_end = 300
    co = bpy.data.objects.new("cam", c); sc.collection.objects.link(co); sc.camera = co
    co.location = loc
    co.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return co


def race():
    clear()
    sc = bpy.context.scene
    setup_world(sc)
    water(sc)
    for (name, col), dx in ((BOATS[0], -1.5), (BOATS[1], 1.5)):
        objs = load(name, dx)
        bpy.context.view_layer.update()
        for o in objs:
            if o.type == 'EMPTY' and o.name.startswith("Seat_"):
                figure(o, col, facing=-1 if o.name == "Seat_Drum" else 1)
    # race camera: behind (stern side, glTF -z = Blender +y) and above
    cam(sc, (0.0, 11.0, 3.6), (0.0, -2.0, 0.3), 26)
    sc.render.resolution_x, sc.render.resolution_y = 720, 1280
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.compression = 90
    sc.render.filepath = os.path.join(OUT, "boats_C_race.png")
    bpy.ops.render.render(write_still=True)


def turntable():
    tiles = []
    tw, th = 360, 426
    for name, col in BOATS:
        for view in ("bow", "stern"):
            clear()
            sc = bpy.context.scene
            setup_world(sc)
            water(sc, 40)
            load(name)
            if view == "bow":
                cam(sc, (-6.0, -9.0, 4.2), (0, -0.6, 0.5), 30)
            else:
                cam(sc, (6.0, 9.0, 4.2), (0, 0.6, 0.5), 30)
            sc.render.resolution_x, sc.render.resolution_y = tw, th
            p = os.path.join(OUT, "_tile.png")
            sc.render.filepath = p
            sc.render.image_settings.file_format = 'PNG'
            bpy.ops.render.render(write_still=True)
            im = bpy.data.images.load(p)
            a = np.array(im.pixels[:], dtype=np.float32).reshape(th, tw, 4)
            tiles.append(a)
            bpy.data.images.remove(im)
            os.remove(p)
    H, W = 1280, 720
    sheet = np.ones((H, W, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        r, c = divmod(i, 2)
        y0 = H - (r + 1) * th - 1  # pixels are bottom-up
        sheet[y0:y0 + th, c * tw:(c + 1) * tw] = t
    img = bpy.data.images.new("sheet", W, H, alpha=False)
    img.pixels = sheet.ravel()
    img.filepath_raw = os.path.join(OUT, "boats_C_turntable.png"); img.file_format = 'PNG'
    img.save()


def detail():
    for name, col in BOATS:
        clear()
        sc = bpy.context.scene
        setup_world(sc)
        water(sc, 40)
        load(name)
        for tag, loc, tgt in (("head", (-2.6, -8.0, 1.6), (0, -4.6, 0.7)), ("in", (1.2, 3.5, 2.2), (0, -1.0, 0.2))):
            cam(sc, loc, tgt, 35)
            sc.render.resolution_x, sc.render.resolution_y = 800, 600
            sc.render.filepath = os.path.join(OUT, "_det_%s_%s.png" % (name, tag))
            bpy.ops.render.render(write_still=True)


if len(argv) > 2 and argv[2] == "detail":
    detail()
else:
    race()
    turntable()
