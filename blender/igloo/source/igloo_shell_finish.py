# Igloo W3 part 2: texture, material, booleans, normals, export.
# Run after igloo_shell_build.py in the same namespace: exec(open(build).read()); exec(open(this).read()); build_all()


def make_textures(CH=0.57, W=1024, H=256, seed=7):
    LT = G["LT"]
    rs = np.random.RandomState(seed)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    U, V = np.meshgrid(u, v)                       # row 0 = bottom (V ~ 0)
    ub = np.array(UB + [1.0])
    du = np.min(np.abs(U[..., None] - ub[None, None, :]), axis=-1) * LT
    dv = np.minimum(V, 1 - V) * CH
    bi = np.searchsorted(np.array(UB[1:]), U, side='right')
    r, g, depth = 0.055, 0.004, 0.03
    qx = np.maximum(r - np.maximum(du - g, 0), 0)
    qy = np.maximum(r - np.maximum(dv - g, 0), 0)
    t = np.clip((r - np.sqrt(qx ** 2 + qy ** 2)) / r, 0, 1)
    hb = np.sqrt(1 - (1 - t) ** 2)
    st = np.array(UB)[bi]
    wd = (np.array(UB[1:] + [1.0]) - np.array(UB))[bi]
    fu = np.clip((U - st) / wd, 0, 1)
    pill = np.sin(np.pi * fu) ** 0.6 * np.sin(np.pi * V) ** 0.6
    Hm = depth * hb + 0.007 * pill * hb
    nz = np.zeros_like(U)
    for _ in range(70):
        lam = math.exp(rs.uniform(math.log(0.04), math.log(0.7)))
        ang = rs.uniform(0, math.pi)
        ku = round(math.cos(ang) * LT / lam)
        kv = round(math.sin(ang) * CH / lam)
        if ku == 0 and kv == 0:
            continue
        nz += (lam ** 1.1) * np.sin(TWO * (ku * U + kv * V) + rs.uniform(0, TWO))
    nz /= np.abs(nz).max()
    Hm = Hm + 0.0035 * nz * (0.4 + 0.6 * hb)
    px, py = LT / W, CH / H
    dx = (np.roll(Hm, -1, axis=1) - np.roll(Hm, 1, axis=1)) / (2 * px)
    dy = (np.roll(Hm, -1, axis=0) - np.roll(Hm, 1, axis=0)) / (2 * py)
    n = np.dstack([-dx, -dy, np.ones_like(dx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    nrm = np.dstack([(n + 1) * 0.5, np.ones((H, W, 1))])
    snow = np.array([0.918, 0.937, 0.961])
    blue = np.array([0.80, 0.865, 0.945])
    blockvar = np.array([0.0, 0.012, -0.008, 0.006])[bi][..., None]
    w = (0.85 * (1 - hb) ** 1.4)[..., None]
    col = snow[None, None, :] * (1 + blockvar + 0.012 * nz[..., None]) * (1 - w) + blue[None, None, :] * w
    col = np.clip(col, 0, 1)
    col = np.dstack([col, np.ones((H, W, 1))])
    paths = {}
    for nm, arr in (("T_IglooSnow_BaseColor", col), ("T_IglooSnow_Normal", nrm)):
        img = bpy.data.images.new(nm + "_gen", W, H, alpha=False)
        if nm.endswith("Normal"):
            img.colorspace_settings.is_data = True
        img.pixels.foreach_set(arr.astype(np.float32).ravel())
        p = os.path.join(TMP, nm + ".jpg")
        img.filepath_raw = p
        img.file_format = 'JPEG'
        img.save(filepath=p, quality=85)
        bpy.data.images.remove(img)
        paths[nm] = p
    return paths


def make_material(paths):
    for nm in ("T_IglooSnow_BaseColor", "T_IglooSnow_Normal"):
        old = bpy.data.images.get(nm)
        if old:
            bpy.data.images.remove(old)
    m = bpy.data.materials.get(MAT) or bpy.data.materials.new(MAT)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Roughness'].default_value = 0.85
    bs.inputs['Metallic'].default_value = 0.0
    tc = nt.nodes.new('ShaderNodeTexImage')
    ic = bpy.data.images.load(paths["T_IglooSnow_BaseColor"])
    ic.name = "T_IglooSnow_BaseColor"
    tc.image = ic
    tn = nt.nodes.new('ShaderNodeTexImage')
    inn = bpy.data.images.load(paths["T_IglooSnow_Normal"])
    inn.name = "T_IglooSnow_Normal"
    inn.colorspace_settings.is_data = True
    tn.image = inn
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tc.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(bs.outputs[0], out.inputs[0])
    return m


def scene():
    sc = bpy.data.scenes.get("IglooW3") or bpy.data.scenes.new("IglooW3")
    bpy.context.window.scene = sc
    return sc


def new_obj(name, me, sc, mat):
    old = bpy.data.objects.get(name)
    if old:
        om = old.data
        bpy.data.objects.remove(old)
        if om and om.users == 0:
            bpy.data.meshes.remove(om)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def closed_fix(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def boolean(ob, other, op):
    m = ob.modifiers.new("bool", 'BOOLEAN')
    m.operation = op
    m.solver = 'EXACT'
    m.object = other
    for o in bpy.context.scene.objects:
        if o is not None:
            o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=m.name)


def on_prof(x, z, prof, tol=0.02):
    a, zw, b = prof
    if z <= zw + 1e-4:
        return abs(abs(x) - a) < tol
    return abs(math.hypot(x / a, (z - zw) / b) - 1.0) < tol / b


def set_normals(ob, smooth_deg=40.0):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    cls = {}
    for f in bm.faces:
        c = f.calc_center_median()
        n = f.normal
        rs = [v.co.length for v in f.verts]
        rad = c.normalized()
        k = 0
        if min(rs) > RO - 0.03 and max(rs) < RO + 0.002 and n.dot(rad) > 0.9:
            k = 1
        elif min(rs) > RI - 0.03 and max(rs) < RI + 0.002 and n.dot(rad) < -0.9:
            k = 2
        elif abs(n.y) < 0.02 and all(v.co.y > 4.0 for v in f.verts):
            if all(on_prof(v.co.x, v.co.z, TUN_OUT) for v in f.verts):
                k = 3
            elif all(on_prof(v.co.x, v.co.z, TUN_IN) for v in f.verts):
                k = 4
        cls[f.index] = k
    cs = math.cos(math.radians(smooth_deg))
    out = []
    for f in bm.faces:
        k = cls[f.index]
        for l in f.loops:
            p = l.vert.co
            if k == 1:
                nn = p.normalized()
            elif k == 2:
                nn = -p.normalized()
            elif k == 3:
                nn = prof_normal(p.x, p.z, *TUN_OUT)
            elif k == 4:
                nn = -prof_normal(p.x, p.z, *TUN_IN)
            else:
                acc = Vector()
                for g in l.vert.link_faces:
                    if cls[g.index] == 0 and g.normal.dot(f.normal) >= cs:
                        acc += g.normal * g.calc_area()
                nn = acc.normalized() if acc.length > 1e-12 else f.normal.copy()
            out.append(tuple(nn))
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.normals_split_custom_set(out)
    from collections import Counter
    return dict(Counter(cls.values()))


def export_glb(ob, path):
    sc = bpy.data.scenes["IglooW3"]
    bpy.context.window.scene = sc
    vl = sc.view_layers[0]
    for o in sc.objects:
        o.select_set(False, view_layer=vl)
    ob.select_set(True, view_layer=vl)
    with bpy.context.temp_override(scene=sc, view_layer=vl):
        bpy.ops.export_scene.gltf(use_active_scene=True, filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                                  export_yup=True, export_tangents=True, export_cameras=False, export_lights=False,
                                  export_image_format='AUTO', export_materials='EXPORT', export_animations=False,
                                  export_skins=False, export_morph=False, export_attributes=False, export_extras=False)


def build_all(pick=True):
    info = {}
    if pick:
        info["pick"] = pick_lt()
    sc = scene()
    paths = make_textures()
    mat = make_material(paths)
    P, shell, plug, PR, side = dome_meshes()
    obS = new_obj("SM_Igloo_Shell", make_mesh("SM_Igloo_Shell", P, shell), sc, mat)
    obP = new_obj("SM_Igloo_ExitPlug", make_mesh("SM_Igloo_ExitPlug", P, plug), sc, mat)
    closed_fix(obS)
    closed_fix(obP)
    vB, fB = tunnel_outer()
    vC, fC = tunnel_cutter()
    obB = new_obj("_tunB", make_mesh("_tunB", vB, fB), sc, mat)
    obC = new_obj("_tunC", make_mesh("_tunC", vC, fC), sc, mat)
    closed_fix(obB)
    closed_fix(obC)
    info["pre_tris"] = sum(len(p.vertices) - 2 for p in obS.data.polygons)
    boolean(obS, obB, 'UNION')
    boolean(obS, obC, 'DIFFERENCE')
    for o in (obB, obC):
        me = o.data
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
    for ob in (obS, obP):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        if ob is obS:
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
            bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-4)
        bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
        bm.to_mesh(ob.data)
        bm.free()
    info["cls_shell"] = set_normals(obS)
    info["cls_plug"] = set_normals(obP)
    for ob in (obS, obP):
        a = ob.data.attributes.get("kind")
        if a:
            ob.data.attributes.remove(a)
    info.update({"LT": G["LT"], "PH": G["PH"], "plug": {k: [round(math.degrees(x), 3) for x in v] for k, v in PR.items()},
                 "tris": {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (obS, obP)}})
    return info
