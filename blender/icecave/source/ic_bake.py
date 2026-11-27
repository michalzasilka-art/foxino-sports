"""Bake the procedural rock / ice / snow look of an ice-cave mouth into 1024 textures, then give the object
one plain PBR material (base colour, roughness, normal, faint cyan emissive on ice).

Use inside Blender (lane C):  exec(open(PATH).read()); bake_object(ob, out_dir)
"""
import math
import os

import bmesh
import bpy

RES = 1024


def _n(nt, typ, loc, **props):
    nd = nt.nodes.new(typ)
    nd.location = loc
    for k, v in props.items():
        setattr(nd, k, v)
    return nd


def _maprange(nt, loc, a, b, c=0.0, d=1.0, smoothstep=True):
    m = _n(nt, "ShaderNodeMapRange", loc)
    if smoothstep:
        m.interpolation_type = "SMOOTHSTEP"
    m.inputs[1].default_value = a
    m.inputs[2].default_value = b
    m.inputs[3].default_value = c
    m.inputs[4].default_value = d
    return m


def _mixc(nt, loc, fac, a, b):
    m = _n(nt, "ShaderNodeMix", loc)
    m.data_type = "RGBA"
    L = nt.links
    if isinstance(fac, float):
        m.inputs["Factor"].default_value = fac
    else:
        L.new(fac, m.inputs["Factor"])
    for sock, val in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(val, tuple):
            sock.default_value = val + (1.0,) if len(val) == 3 else val
        else:
            L.new(val, sock)
    return m.outputs[2]


def _mixf(nt, loc, fac, a, b):
    m = _n(nt, "ShaderNodeMix", loc)
    m.data_type = "FLOAT"
    L = nt.links
    L.new(fac, m.inputs["Factor"])
    for sock, val in ((m.inputs[2], a), (m.inputs[3], b)):
        if isinstance(val, float):
            sock.default_value = val
        else:
            L.new(val, sock)
    return m.outputs[0]


def _math(nt, loc, op, a, b=None):
    m = _n(nt, "ShaderNodeMath", loc, operation=op)
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, float):
            m.inputs[i].default_value = v
        else:
            nt.links.new(v, m.inputs[i])
    return m.outputs[0]


def bake_material(name, seed=0.0):
    mat = bpy.data.materials.new(name + "_BAKE")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    L = nt.links
    out = _n(nt, "ShaderNodeOutputMaterial", (1400, 0))
    bsdf = _n(nt, "ShaderNodeBsdfPrincipled", (1100, 0))
    L.new(bsdf.outputs[0], out.inputs[0])
    tc = _n(nt, "ShaderNodeTexCoord", (-1400, 0))
    obj = tc.outputs["Object"]
    a_ice = _n(nt, "ShaderNodeAttribute", (-1400, 400), attribute_name="ice").outputs["Fac"]
    a_snow = _n(nt, "ShaderNodeAttribute", (-1400, 250), attribute_name="snow").outputs["Fac"]
    a_throat = _n(nt, "ShaderNodeAttribute", (-1400, 100), attribute_name="throat").outputs["Fac"]
    geo = _n(nt, "ShaderNodeNewGeometry", (-1400, -300))
    sep = _n(nt, "ShaderNodeSeparateXYZ", (-1200, -300))
    L.new(geo.outputs["Normal"], sep.inputs[0])
    nz = sep.outputs["Z"]

    def noise(loc, scale, detail, rough=0.55, w=0.0):
        nd = _n(nt, "ShaderNodeTexNoise", loc)
        nd.noise_dimensions = "4D"
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Detail"].default_value = detail
        nd.inputs["Roughness"].default_value = rough
        nd.inputs["W"].default_value = seed + w
        L.new(obj, nd.inputs["Vector"])
        return nd.outputs["Fac"]

    n1 = noise((-1100, 600), 0.35, 4.0)
    n2 = noise((-1100, 300), 2.2, 6.0, 0.6, 3.0)
    n3 = noise((-1100, 0), 9.0, 3.0, 0.5, 7.0)
    vor = _n(nt, "ShaderNodeTexVoronoi", (-1100, -600))
    vor.inputs["Scale"].default_value = 0.9
    L.new(obj, vor.inputs["Vector"])
    vdist = vor.outputs["Distance"]
    # strata: stretched noise along z for layered rock
    strata_map = _n(nt, "ShaderNodeMapping", (-1250, -900))
    strata_map.inputs["Scale"].default_value = (0.3, 0.3, 1.3)
    L.new(obj, strata_map.inputs["Vector"])
    strata = _n(nt, "ShaderNodeTexNoise", (-1050, -900))
    strata.inputs["Scale"].default_value = 0.8
    strata.inputs["Detail"].default_value = 3.0
    L.new(strata_map.outputs[0], strata.inputs["Vector"])
    strata = strata.outputs["Fac"]

    # masks
    snow_in = _math(nt, (-800, 500), "ADD", a_snow, _math(nt, (-950, 500), "MULTIPLY", _math(nt, (-1050, 500), "SUBTRACT", n1, 0.5), 0.9))
    snow_attr_m = _maprange(nt, (-650, 500), 0.42, 0.6).outputs[0]
    L.new(snow_in, snow_attr_m.node.inputs[0])
    up = _maprange(nt, (-800, -300), 0.55, 0.8).outputs[0]
    L.new(nz, up.node.inputs[0])
    up_m = _math(nt, (-650, -300), "MULTIPLY", up, _math(nt, (-750, -400), "SUBTRACT", 1.0, a_ice))
    up_m = _math(nt, (-500, -300), "MULTIPLY", up_m, _maprange_out(nt, (-600, -450), n2, 0.35, 0.55))
    snow_m = _math(nt, (-450, 500), "MAXIMUM", snow_attr_m, up_m)
    # W2b: no snow inside the throat (it is a dark rock hole)
    snow_m = _math(nt, (-380, 560), "MULTIPLY", snow_m, _math(nt, (-450, 620), "SUBTRACT", 1.0,
                                                               _maprange_out(nt, (-560, 620), a_throat, 0.05, 0.3)))
    ice_in = _math(nt, (-800, 300), "ADD", a_ice, _math(nt, (-950, 300), "MULTIPLY", _math(nt, (-1050, 250), "SUBTRACT", n1, 0.5), 0.6))
    ice_m0 = _maprange(nt, (-650, 300), 0.3, 0.55).outputs[0]
    L.new(ice_in, ice_m0.node.inputs[0])
    ice_m = _math(nt, (-450, 300), "MULTIPLY", ice_m0, _math(nt, (-550, 200), "SUBTRACT", 1.0, snow_m))

    # colours (no pure black or white). W2b: dark grey-brown rock, deep cyan-blue ice, the throat darkens inward
    rock = _mixc(nt, (-300, -100), n2, (0.12, 0.11, 0.098), (0.245, 0.228, 0.205))  # grey-brown rock
    rock = _mixc(nt, (-150, -100), _maprange_out(nt, (-300, -250), strata, 0.5, 0.72), rock, (0.305, 0.29, 0.27))
    crev = _maprange_out(nt, (-300, -400), vdist, 0.0, 0.22, 0.62, 1.0)
    rock = _mixc_mul(nt, (0, -150), rock, crev)
    ice_t = _maprange_out(nt, (-300, 150), _math(nt, (-450, 150), "ADD", n2, _math(nt, (-550, 100), "MULTIPLY", a_ice, 0.25)), 0.4, 0.85)
    ice = _mixc(nt, (-150, 150), ice_t, (0.03, 0.13, 0.27), (0.17, 0.48, 0.66))
    snow = _mixc(nt, (-150, 350), n3, (0.70, 0.78, 0.88), (0.83, 0.89, 0.95))
    base = _mixc(nt, (150, 0), ice_m, rock, ice)
    base = _mixc(nt, (300, 0), snow_m, base, snow)
    dark = _maprange_out(nt, (300, 150), a_throat, 0.0, 1.0, 1.0, 0.45)  # deep in the throat: 45 % of the albedo
    darkc = _n(nt, "ShaderNodeCombineXYZ", (400, 150))
    for i in range(3):
        L.new(dark, darkc.inputs[i])
    base = _mixc_mul(nt, (450, 0), base, darkc.outputs[0])
    L.new(base, bsdf.inputs["Base Color"])
    rough = _mixf(nt, (150, -300), ice_m, 0.75, 0.15)
    rough = _mixf(nt, (300, -300), snow_m, rough, 0.8)
    L.new(rough, bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = 0.0
    # emissive only where the ice is thick (frozen flows in the cracks, icicles), never in the throat
    thick = _maprange_out(nt, (100, 450), a_ice, 0.7, 0.95)
    thick = _math(nt, (200, 450), "MULTIPLY", thick, ice_m)
    thick = _math(nt, (250, 500), "MULTIPLY", thick, _math(nt, (150, 550), "SUBTRACT", 1.0, a_throat))
    emis = _mixc(nt, (300, 250), thick, (0.0, 0.0, 0.0), (0.40, 0.82, 1.0))
    L.new(emis, bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    # height for bump: rock cells + strata, ice soft ripples, snow fine grain
    h_rock = _math(nt, (0, -600), "ADD", _math(nt, (-150, -600), "MULTIPLY", vdist, 0.9),
                   _math(nt, (-150, -700), "MULTIPLY", strata, 0.5))
    h_rock = _math(nt, (100, -600), "ADD", h_rock, _math(nt, (-150, -800), "MULTIPLY", n2, 0.35))
    h_ice = _math(nt, (0, -900), "MULTIPLY", n1, 0.6)
    h_snow = _math(nt, (0, -1000), "MULTIPLY", n3, 0.12)
    h = _mixf(nt, (250, -700), ice_m, h_rock, h_ice)
    h = _mixf(nt, (400, -700), snow_m, h, h_snow)
    bump = _n(nt, "ShaderNodeBump", (800, -500))
    bump.inputs["Strength"].default_value = 0.75
    bump.inputs["Distance"].default_value = 0.25
    L.new(h, bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _maprange_out(nt, loc, src, a, b, c=0.0, d=1.0):
    m = _maprange(nt, loc, a, b, c, d)
    nt.links.new(src, m.inputs[0])
    return m.outputs[0]


def _mixc_mul(nt, loc, col, fac):
    m = _n(nt, "ShaderNodeMix", loc)
    m.data_type = "RGBA"
    m.blend_type = "MULTIPLY"
    m.inputs["Factor"].default_value = 1.0
    nt.links.new(col, m.inputs[6])
    nt.links.new(fac, m.inputs[7])
    return m.outputs[2]


def mark_sharp(ob, angle_deg=35.0):
    """Auto-smooth equivalent: smooth faces, sharp edges above the angle on the rock sheet only (icicles stay round)."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    kind = bm.verts.layers.int.get("rowkind")
    lim = math.radians(angle_deg)
    n = 0
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = True
        if len(e.link_faces) == 2 and kind is not None and e.verts[0][kind] != 5:
            if e.calc_face_angle(0.0) > lim:
                e.smooth = False
                n += 1
    bm.to_mesh(me)
    bm.free()
    return n


def bake_object(ob, out_dir, prefix):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "GPU"
    sc.cycles.samples = 8
    sc.render.bake.margin = 8
    seed = 3.0 if "Exit" in ob.name else 0.0
    bmat = bake_material(ob.name, seed)
    ob.data.materials.clear()
    ob.data.materials.append(bmat)
    for o in sc.objects:
        o.select_set(False)
    ob.hide_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    nt = bmat.node_tree
    imgs = {}
    jobs = (("BaseColor", "DIFFUSE", {"COLOR"}, False), ("Roughness", "ROUGHNESS", set(), True),
            ("Emissive", "EMIT", set(), False), ("Normal", "NORMAL", set(), True))
    for label, btype, pf, data in jobs:
        iname = f"{prefix}_{label}"
        old = bpy.data.images.get(iname)
        if old:
            bpy.data.images.remove(old)
        img = bpy.data.images.new(iname, RES, RES, alpha=False, float_buffer=False, is_data=data)
        if data:
            img.colorspace_settings.is_data = True
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = img
        for nd in nt.nodes:
            nd.select = False
        tn.select = True
        nt.nodes.active = tn
        kw = dict(type=btype, margin=8, use_clear=True)
        if pf:
            kw["pass_filter"] = pf
        if btype == "NORMAL":
            kw.update(normal_space="TANGENT")
        bpy.ops.object.bake(**kw)
        img.filepath_raw = os.path.join(out_dir, iname + ".png")
        img.file_format = "PNG"
        img.save()
        nt.nodes.remove(tn)
        imgs[label] = img
    # final plain PBR material
    mname = "M_" + ob.name[3:]
    old = bpy.data.materials.get(mname)
    if old:
        bpy.data.materials.remove(old)
    mat = bpy.data.materials.new(mname)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    L = nt.links
    out = _n(nt, "ShaderNodeOutputMaterial", (600, 0))
    bsdf = _n(nt, "ShaderNodeBsdfPrincipled", (300, 0))
    L.new(bsdf.outputs[0], out.inputs[0])
    t_bc = _n(nt, "ShaderNodeTexImage", (-300, 300), image=imgs["BaseColor"])
    t_r = _n(nt, "ShaderNodeTexImage", (-300, 0), image=imgs["Roughness"])
    t_e = _n(nt, "ShaderNodeTexImage", (-300, -300), image=imgs["Emissive"])
    t_n = _n(nt, "ShaderNodeTexImage", (-300, -600), image=imgs["Normal"])
    nm = _n(nt, "ShaderNodeNormalMap", (0, -600))
    L.new(t_bc.outputs[0], bsdf.inputs["Base Color"])
    L.new(t_r.outputs[0], bsdf.inputs["Roughness"])
    L.new(t_e.outputs[0], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.08  # W2b: faint, thick ice only (the game adds its own glow)
    L.new(t_n.outputs[0], nm.inputs["Color"])
    L.new(nm.outputs[0], bsdf.inputs["Normal"])
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.use_backface_culling = True  # single-sided in glTF
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    bpy.data.materials.remove(bmat)
    return {k: v.name for k, v in imgs.items()}


def export_glb(ob, path):
    """Plain GLB (+Y up, no Draco/meshopt), textures as JPEG quality 85."""
    sc = bpy.context.scene
    for o in sc.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True,
                              export_apply=True, export_yup=True, export_image_format="JPEG",
                              export_jpeg_quality=85, export_image_quality=85, export_cameras=False, export_lights=False,
                              export_vertex_color="NONE", export_attributes=False,
                              export_draco_mesh_compression_enable=False, export_extras=False,
                              export_animations=False, export_skins=False, export_morph=False)
    return os.path.getsize(path)
