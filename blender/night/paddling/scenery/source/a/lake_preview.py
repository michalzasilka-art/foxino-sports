"""Summer lake lane A previews (headless, EEVEE).
blender -b --factory-startup -P lake_preview.py -- <race|turntable> <out.png> <glb_dir> [<boat_dir>]
race: start area (arch at glTF z -14, 5 pontoons at z -8, lane posts, boats) seen from behind, 720x1280.
turntable: 2x3 sheet of the three models as exported (Tint left light grey)."""
import bpy, sys, math, os
import numpy as np
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:]
MODE, OUT, GD = argv[0], argv[1], argv[2]
BD = argv[3] if len(argv) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        sc.render.engine = eng; break
    except TypeError:
        pass
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGB"
sc.render.image_settings.compression = 90
try:
    sc.eevee.taa_render_samples = 48
except Exception:
    pass
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; bg = wn["Background"]
# soft vertical sky gradient
tc = wn.new("ShaderNodeTexCoord"); sep = wn.new("ShaderNodeSeparateXYZ"); ramp = wn.new("ShaderNodeValToRGB")
world.node_tree.links.new(tc.outputs["Generated"], sep.inputs[0])
world.node_tree.links.new(sep.outputs["Z"], ramp.inputs[0])
world.node_tree.links.new(ramp.outputs[0], bg.inputs[0])
ramp.color_ramp.elements[0].position = 0.5; ramp.color_ramp.elements[0].color = (0.78, 0.88, 0.97, 1)
ramp.color_ramp.elements[1].position = 0.8; ramp.color_ramp.elements[1].color = (0.30, 0.55, 0.92, 1)
bg.inputs[1].default_value = 1.0
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 4.0; sun.data.color = (1.0, 0.96, 0.88)
sun.rotation_euler = Euler((math.radians(42), math.radians(0), math.radians(150)))
sun.data.angle = math.radians(2)


def mat(name, col, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def imp(path, loc=(0, 0, 0)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.parent is None:
            o.location += Vector(loc)
    return new


def g2b(x, y, z):          # glTF -> Blender
    return (x, -z, y)


cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.clip_end = 1500


def look(loc, tgt, lens, ortho=None):
    cam.location = Vector(loc); cam.data.lens = lens
    if ortho:
        cam.data.type = "ORTHO"; cam.data.ortho_scale = ortho
    else:
        cam.data.type = "PERSP"
    cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat("-Z", "Y").to_euler()


ARCH, PONT, POST = (os.path.join(GD, n + ".glb") for n in ("SM_RaceArch", "SM_Pontoon", "SM_LanePost"))
LANES = [-14, -7, 0, 7, 14]

if MODE == "race":
    water = mat("water", (0.05, 0.30, 0.48), 0.06)
    nt = water.node_tree
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.35
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.12
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    bpy.ops.mesh.primitive_plane_add(size=1400, location=(0, 0, 0)); bpy.context.object.data.materials.append(water)
    # far summer shore: green hills and blue-grey peaks (preview only)
    grass = mat("hill", (0.22, 0.52, 0.20), 0.9); rock = mat("peak", (0.42, 0.50, 0.62), 0.8)
    for i in range(14):
        a = math.radians(-80 + i * 12.5); d = 330 + 40 * math.sin(i * 1.7)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=(d * math.sin(a), -d * math.cos(a), -6))
        o = bpy.context.object; o.scale = (55, 40, 20 + 8 * math.sin(i * 2.3)); o.data.materials.append(grass)
        bpy.ops.object.shade_smooth()
    for i in range(6):
        a = math.radians(-60 + i * 24); d = 620
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=150, depth=150 + 30 * math.sin(i * 1.3),
                                        location=(d * math.sin(a), -d * math.cos(a), 40))
        o = bpy.context.object; o.data.materials.append(rock); bpy.ops.object.shade_smooth()
    new = imp(ARCH, g2b(0, 0, -14))
    # preview the game tint: a sunny orange instead of the exported light grey
    m = bpy.data.materials.get("Tint")
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.95, 0.36, 0.08, 1)
    for k in range(5):
        imp(PONT, g2b(-14.8 + 7.4 * k, 0, -8))
    for x in LANES:
        imp(POST, g2b(x, 0.35, -8 - 0.75))
    if BD:
        boats = sorted(f for f in os.listdir(BD) if f.endswith(".glb"))
        for x, f in zip(LANES, boats):
            # racers come from -Z: the boats wait behind the start arch, bows toward it
            imp(os.path.join(BD, f), g2b(x, 0, -14 - 2.2 - 1.0 - 5.7))
    look((0, 47, 10.0), (0, 6, 1.8), 14.5)
    sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
else:
    floor = mat("floor", (0.55, 0.70, 0.82), 0.5)
    bpy.ops.mesh.primitive_plane_add(size=1400, location=(200, 0, -0.02)); bpy.context.object.data.materials.append(floor)
    groups = {}
    groups["arch"] = imp(ARCH)
    groups["pont"] = []
    for k in range(5):
        groups["pont"] += imp(PONT, (-14.8 + 7.4 * k + 200, 0, 0))
    groups["post"] = imp(POST, (400, 0, 0))
    W, H = 360, 426
    sc.render.resolution_x, sc.render.resolution_y = W, H
    shots = [  # (group, camera, target, lens)
        ("arch", (26, 36, 9), (0, 0, 5.0), 27),        # front three-quarter (racers' side)
        ("arch", (29, -11, 5), (19.5, 0, 3.6), 30),    # back: leg, float and tethers
        ("pont", (200 + 14, 19, 7), (200, 0, 0.0), 30),   # 5 tiled modules
        ("pont", (200 - 14.8 + 4.6, -5.6, 2.2), (200 - 14.8, 0, 0.15), 30),   # one module, boat side
        ("post", (400 + 1.8, 4.6, 2.0), (400, 0, 1.3), 36),           # front (SignFace)
        ("post", (400 - 2.4, -3.8, 2.2), (400, 0, 1.3), 36),          # back
    ]
    tiles = []
    for i, (g, loc, tgt, lens) in enumerate(shots):
        look(loc, tgt, lens)
        p = OUT + "_t%d.png" % i; sc.render.filepath = p; bpy.ops.render.render(write_still=True); tiles.append(p)
    sheet = np.zeros((H * 3, W * 2, 4), np.float32)
    for i, p in enumerate(tiles):
        im = bpy.data.images.load(p); a = np.array(im.pixels[:], np.float32).reshape(H, W, 4)
        r, c = i // 2, i % 2
        sheet[(2 - r) * H:(3 - r) * H, c * W:(c + 1) * W] = a
        bpy.data.images.remove(im); os.remove(p)
    sheet[..., 3] = 1
    out = bpy.data.images.new("sheet", W * 2, H * 3, alpha=False)
    out.pixels.foreach_set(sheet.ravel()); out.file_format = "PNG"
    out.filepath_raw = OUT; out.save()
print("PREVIEW", OUT)
