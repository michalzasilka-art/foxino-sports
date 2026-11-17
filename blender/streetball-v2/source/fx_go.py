# Build foxino-baller from the Football Foxino: exec this with g = {} ; result in g['FX'].
import bpy, json
from mathutils import Vector
SPX = r"."  # the folder holding these scripts
for _f in ('sb_kit.py', 'fx_build.py', 'fx_tex.py', 'fx_tex2.py', 'fx_build2.py'):
    exec(open(SPX + '\\' + _f, encoding='utf-8').read(), globals())

def build_foxino():
    arm, mo = fx_copy()
    shrink_sleeves(mo, arm)
    src = [n.image for n in bpy.data.objects['Armature'].children[0].data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE'][0]
    im, sw, ntail = repaint2(mo, arm, src)
    m = bpy.data.materials['FoxinoBaller']
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE': n.image = im
    mo.data.materials[0] = m
    tv = tail_verts(mo)
    tail = add_tail(arm, mo, tv)
    coll = bpy.data.collections['Foxino']
    obs = number_decals(mo, text_polys, sw, coll) + wristbands(mo, arm, sw, coll)
    tris = join_into(mo, arm, obs)
    return {'tris': tris, 'tail': tail}

def shoot(names_dirs, tgt=(0, 0, 0.62), scale=1.6, res=(1200, 800), prefix='fb'):
    S = bpy.data.scenes['Chars']; cam = bpy.data.objects['CharCam']
    cam.data.ortho_scale = scale; S.render.resolution_x, S.render.resolution_y = res
    out = []
    for nm, d in names_dirs:
        t = Vector(tgt); cam.location = t + Vector(d).normalized() * 4
        cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
        S.render.filepath = SPX + rf"\{prefix}_{nm}.png"; bpy.ops.render.render(write_still=True); out.append(S.render.filepath)
    return out
