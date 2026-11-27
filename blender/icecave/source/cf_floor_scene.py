"""Lane D, W2b: SM_CaveFloor_Tile.glb (4 x 4 m, M_CaveFloor) + QA + previews.

"C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P cf_floor_scene.py -- <icecave_dir> <qa_json>
Expects the three T_CaveFloor_*.jpg maps in <icecave_dir> (from cf_floor_textures.py).
Blender is Z-up; the glTF exporter maps Blender (x, y, z) -> glTF (x, z, -y), so game +Z (downhill) = Blender -Y.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, QA_JSON = argv[0], argv[1]
PREV = os.path.join(OUT, "previews")
os.makedirs(PREV, exist_ok=True)
MAPS = {k: os.path.join(OUT, f"T_CaveFloor_{k}.jpg") for k in ("BaseColor", "Normal", "Roughness")}

sc = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)
sc.unit_settings.system = "METRIC"
sc.unit_settings.scale_length = 1.0


# ---------------- material ----------------
def floor_material():
    mat = bpy.data.materials.new("M_CaveFloor")
    mat.use_nodes = True
    mat.use_backface_culling = True                    # floor is only seen from above: single-sided
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (250, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.31            # ice
    bsdf.inputs["Emission Strength"].default_value = 0.0

    def tex(key, y, data):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.location = (-500, y)
        img = bpy.data.images.load(MAPS[key], check_existing=True)
        img.colorspace_settings.name = "Non-Color" if data else "sRGB"
        n.image = img
        n.interpolation = "Linear"
        n.extension = "REPEAT"
        return n

    base = tex("BaseColor", 300, False)
    nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
    rough = tex("Roughness", 0, True)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    sep.location = (-150, 0)
    nt.links.new(rough.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    nrm = tex("Normal", -300, True)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.location = (-150, -300)
    nm.space = "TANGENT"
    nm.inputs["Strength"].default_value = 1.0
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def simple_mat(name, col, rough, noise_scale=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    if noise_scale:
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = noise_scale
        nz.inputs["Detail"].default_value = 8
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, 1)
        ramp.color_ramp.elements[1].color = (col[0] * 1.5, col[1] * 1.5, col[2] * 1.5, 1)
        nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.4
        nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


# ---------------- the tile ----------------
mat = floor_material()
bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0, 0))
tile = bpy.context.active_object
tile.name = tile.data.name = "SM_CaveFloor_Tile"
tile.data.uv_layers[0].name = "UVMap"
tile.data.materials.append(mat)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.shade_smooth()
uvs = np.zeros(len(tile.data.loops) * 2)
tile.data.uv_layers[0].data.foreach_get("uv", uvs)

# ---------------- export ----------------
glb = os.path.join(OUT, "SM_CaveFloor_Tile.glb")
bpy.ops.object.select_all(action="DESELECT")
tile.select_set(True)
bpy.context.view_layer.objects.active = tile
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                          export_yup=True, export_image_format="AUTO", export_jpeg_quality=85,
                          export_image_quality=85, export_cameras=False, export_lights=False,
                          export_draco_mesh_compression_enable=False, export_materials="EXPORT",
                          export_tangents=False)


def glb_use_jpeg_roughness(path, jpg):
    """The exporter re-packs Roughness (via Separate G) into a new PNG. Put the original greyscale
    JPEG back (G = roughness; B is only read as metallic, and metallicFactor is 0) and repack the buffer."""
    import struct
    b = open(path, "rb").read()
    jlen = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20:20 + jlen])
    blen = struct.unpack_from("<I", b, 20 + jlen)[0]
    binb = b[28 + jlen:28 + jlen + blen]
    views = [binb[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in j["bufferViews"]]
    for im in j["images"]:
        if im["name"] == "T_CaveFloor_Roughness":
            views[im["bufferView"]] = open(jpg, "rb").read()
            im["mimeType"] = "image/jpeg"
    out = bytearray()
    for v, data in zip(j["bufferViews"], views):
        out += b"\0" * ((-len(out)) % 4)
        v["byteOffset"] = len(out)
        v["byteLength"] = len(data)
        out += data
    out += b"\0" * ((-len(out)) % 4)
    j["buffers"][0]["byteLength"] = len(out)
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    glb_bytes = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
    glb_bytes += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(out), 0x004E4942) + bytes(out)
    open(path, "wb").write(glb_bytes)


glb_use_jpeg_roughness(glb, MAPS["Roughness"])

# ---------------- QA gate ----------------
sys.path.insert(0, os.path.expanduser(r"~/.claude/skills/blender-asset-qa/scripts"))
import qa_check  # noqa: E402

report = {"uv_min": float(uvs.min()), "uv_max": float(uvs.max()), "glb_bytes": os.path.getsize(glb),
          "dims": list(tile.dimensions), "qa": qa_check.run(objects=["SM_CaveFloor_Tile"], profile="game")}
json.dump(report, open(QA_JSON, "w"), indent=1, default=str)

# ---------------- preview scene (never exported) ----------------
# 3 tiles across (game x -6..6); along the run 3 tiles in the lit zone + 3 more fading into the dark
ROWS = int(os.environ.get("CF_ROWS", "6"))
for ix in (-1, 0, 1):
    for iz in range(ROWS):
        ob = tile if (ix == 0 and iz == 0) else tile.copy()
        if ob is not tile:
            sc.collection.objects.link(ob)
        ob.location = (4 * ix, 2 - 4 * iz, 0)      # game z centres -2, 2, 6, ...

wall_mat = simple_mat("PV_RockWall", (0.10, 0.092, 0.085), 0.75, noise_scale=1.6)

# simple rock arch over the floor: the W2 end profile, x scaled to the 12 m preview floor
PROF = [(8.00, 0.00), (7.95, 0.80), (7.75, 1.70), (7.35, 2.60), (6.75, 3.45), (5.95, 4.25), (4.95, 4.95),
        (3.75, 5.55), (2.45, 5.95), (1.20, 6.15), (0.00, 6.20)]
ring = [(x * 0.75, h) for x, h in PROF] + [(-x * 0.75, h) for x, h in reversed(PROF[:-1])]
verts, faces = [], []
NS = 90
for j in range(NS + 1):
    y = 6.0 - j * (4.0 * ROWS + 6.0) / NS
    for (x, h) in ring:
        p = Vector((x * 0.4, y * 0.35, h * 0.4))
        d = 0.45 * noise.noise(p) + 0.18 * noise.noise(p * 3.1) + 0.06 * noise.noise(p * 8.0)
        d = max(d, -0.25) if h < 0.3 else d
        n = Vector((x, 0, h - 2.0)).normalized()   # outward-ish from the tunnel axis
        q = Vector((x, y, h)) + n * d
        verts.append((q.x, q.y, max(q.z, -0.02)))
R = len(ring)
for j in range(NS):
    for i in range(R - 1):
        a = j * R + i
        faces.append((a, a + 1, a + 1 + R, a + R))
me = bpy.data.meshes.new("PV_RockArch")
me.from_pydata(verts, [], faces)
me.materials.append(wall_mat)
arch = bpy.data.objects.new("PV_RockArch", me)
sc.collection.objects.link(arch)
for poly in me.polygons:
    poly.use_smooth = True
c = me.polygons[len(me.polygons) // 2]
if c.normal.dot(Vector((0, 0, 3)) - c.center) < 0:     # make normals face into the tunnel
    me.flip_normals()

# lighting: dim cool fill + warm lanterns, light cool haze
world = bpy.data.worlds.new("PV_World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.010, 0.016, 0.030, 1)
bg.inputs["Strength"].default_value = 1.0
vol = world.node_tree.nodes.new("ShaderNodeVolumePrincipled")
vol.inputs["Color"].default_value = (0.25, 0.35, 0.5, 1)
vol.inputs["Density"].default_value = 0.022
world.node_tree.links.new(vol.outputs["Volume"], world.node_tree.nodes["World Output"].inputs["Volume"])


def light(kind, name, loc, col, energy, size=0.2, rot=None):
    ld = bpy.data.lights.new(name, kind)
    ld.color = col
    ld.energy = energy
    if kind == "AREA":
        ld.size = size
    else:
        ld.shadow_soft_size = size
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    if rot:
        lo.rotation_euler = rot
    sc.collection.objects.link(lo)
    return lo


light("AREA", "PV_CoolFill", (0, -3, 5.6), (0.55, 0.72, 1.0), 420, size=7)
light("AREA", "PV_CoolFill2", (0, -14, 5.6), (0.55, 0.72, 1.0), 260, size=7)
light("POINT", "PV_Lantern_L", (-4.2, -2.5, 1.6), (1.0, 0.62, 0.30), 130, size=0.12)
light("POINT", "PV_Lantern_R", (4.1, -9.5, 1.6), (1.0, 0.62, 0.30), 130, size=0.12)
glow = bpy.data.materials.new("PV_LanternGlow")
glow.use_nodes = True
gb = glow.node_tree.nodes["Principled BSDF"]
gb.inputs["Emission Color"].default_value = (1.0, 0.62, 0.30, 1)
gb.inputs["Emission Strength"].default_value = 3.0
for loc in ((-4.35, -2.5, 1.6), (4.25, -9.5, 1.6)):     # the lantern globes, just wall-side of the lights
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=loc)
    bpy.context.active_object.data.materials.append(glow)
    bpy.context.active_object.visible_shadow = False

cam_d = bpy.data.cameras.new("PV_Cam")
cam_d.lens = 30
cam_d.sensor_fit = "AUTO"
cam = bpy.data.objects.new("PV_Cam", cam_d)
sc.collection.objects.link(cam)
cam.location = (0, 6.0, 2.5)                        # game (0, 2.5, -6): behind and above the rider
cam.rotation_euler = (math.radians(90 - 14), 0, math.pi)  # looking down game +Z a little
sc.camera = cam

r = sc.render
r.engine = "BLENDER_EEVEE"
r.resolution_x, r.resolution_y, r.resolution_percentage = 720, 1280, 100
r.film_transparent = False
sc.eevee.taa_render_samples = 64
try:
    sc.eevee.use_shadows = True
    sc.eevee.use_raytracing = True
except AttributeError:
    pass
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "None"
sc.view_settings.exposure = 0.7
r.image_settings.file_format = "PNG"
r.filepath = os.path.join(PREV, "cave_floor.png")
bpy.ops.render.render(write_still=True)

print("CFSCENE " + json.dumps({k: v for k, v in report.items() if k != "qa"}) + " QA_PASS=" + str(report["qa"].get("pass")))
