# foxino-baller, step 1: copy the Football Foxino, centre him (Hips over the origin), scale to 1.3 m ear tips, drop the
# Icosphere helper. Leaves objects FoxinoRig (armature) and Foxino (mesh) in collection 'Foxino' of scene 'Chars'.
import bpy, math
from mathutils import Vector, Matrix

def fx_copy():
    S = bpy.data.scenes['Chars']
    c = bpy.data.collections.get('Foxino')
    if c:
        for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
    else:
        c = bpy.data.collections.new('Foxino'); S.collection.children.link(c)
    arm = bpy.data.objects['Armature']; me = [o for o in arm.children if o.type == 'MESH'][0]
    a2 = arm.copy(); a2.data = arm.data.copy(); a2.name = 'FoxinoRig'; a2.data.name = 'FoxinoRig'
    m2 = me.copy(); m2.data = me.data.copy(); m2.name = 'Foxino'; m2.data.name = 'Foxino'
    c.objects.link(a2); c.objects.link(m2)
    for o in (a2, m2): o.hide_render = False; o.hide_set(False)
    m2.parent = a2; m2.modifiers[0].object = a2
    hips = a2.data.bones['mixamorig:Hips'].head_local.copy()
    s = 1.3 / 0.9995
    a2.scale = (s, s, s); a2.location = (-hips.x * s, -hips.y * s, 0)
    bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects: o.select_set(False)
    a2.select_set(True); m2.select_set(True); bpy.context.view_layer.objects.active = a2
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # hide the source
    for o in (arm, me): o.hide_render = True; o.hide_set(True)
    for o in bpy.data.collections['FoxSrc'].objects:
        if o.name.startswith('Icosphere'): o.hide_render = True; o.hide_set(True)
    return a2, m2

def shrink_sleeves(mo, arm):
    """Pull the old T-shirt sleeve vertices in to the upper-arm radius (a tank top shows the bare arm)."""
    import numpy as np
    B = arm.data.bones; out = {}
    for side, nm in ((1, 'Left'), (-1, 'Right')):
        sh = B[f'mixamorig:{nm}Arm'].head_local; el = B[f'mixamorig:{nm}ForeArm'].head_local
        ad = (el - sh).normalized(); L = (el - sh).length
        vs = mo.data.vertices; gi = mo.vertex_groups[f"mixamorig:{nm}Arm"].index
        dom = lambda v: max(v.groups, key=lambda e: e.weight).group == gi if len(v.groups) else False
        def ap(v):
            w = v.co - sh; a = w.dot(ad); p = w - ad * a; return a, p
        ref = [ap(v)[1].length for v in vs if 0.8 * L < ap(v)[0] < 0.95 * L and ap(v)[1].length < 0.08]
        r = 0.043
        n = 0
        for v in vs:
            a, p = ap(v)
            if 0.1 * L < a < 0.92 * L and p.length < 0.09 and p.length > r and dom(v):
                t = min(1.0, (a - 0.1 * L) / (0.2 * L)) * (1.0 if a < 0.8 * L else max(0.0, (0.92 * L - a) / (0.12 * L)) * 0.6 + 0.4)
                v.co = sh + ad * a + p.normalized() * (p.length + (r - p.length) * t); n += 1
        out[nm] = (round(r, 4), n)
    mo.data.update()
    return out
