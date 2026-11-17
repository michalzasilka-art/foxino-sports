# Contact sheets: render frames of baked actions for a rig and tile them with numpy; a label text object rides on
# the camera.
import bpy, math, os
import numpy as np
from mathutils import Vector
SPS = r"."  # the folder holding these scripts

def _cam(S):
    cam = bpy.data.objects['CharCam']; cam.data.type = 'PERSP'; cam.data.lens = 50
    S.camera = cam; return cam

def _label(S, cam, text):
    t = bpy.data.objects.get('SheetLabel')
    if t is None:
        cu = bpy.data.curves.new('SheetLabel', 'FONT'); t = bpy.data.objects.new('SheetLabel', cu)
        S.collection.objects.link(t)
        m = bpy.data.materials.get('LabelMat') or bpy.data.materials.new('LabelMat'); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.05, 0.03, 0.15, 1)
        b.inputs['Emission Color'].default_value = (0.05, 0.03, 0.15, 1); b.inputs['Emission Strength'].default_value = 0.0
        cu.materials.append(m)
    t.data.body = text; t.data.size = 0.06; t.data.align_x = 'LEFT'
    t.parent = cam; t.location = (-0.34, 0.3, -1.0); t.rotation_euler = (0, 0, 0)
    t.hide_render = False
    return t

def render_frames(arm, shots, cam_pos, tgt, res=240, out_prefix='sh', show=()):
    """shots: [(action_name, frame, label)] -> list of image arrays."""
    S = bpy.context.scene; cam = _cam(S)
    cam.location = Vector(cam_pos); cam.rotation_euler = (Vector(tgt) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    S.render.resolution_x = S.render.resolution_y = res; S.render.resolution_percentage = 100
    ad = arm.animation_data
    for tr in ad.nla_tracks: tr.mute = True
    imgs = []
    for k, (act, fr, lab) in enumerate(shots):
        ad.action = bpy.data.actions[act]
        S.frame_set(fr + 1)
        _label(S, cam, lab)
        p = os.path.join(SPS, f'{out_prefix}_{k:03d}.png'); S.render.filepath = p
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(p); a = np.array(im.pixels[:], np.float32).reshape(res, res, 4); bpy.data.images.remove(im)
        imgs.append(a)
    ad.action = None
    for tr in ad.nla_tracks: tr.mute = False
    lab = bpy.data.objects.get('SheetLabel')
    if lab: lab.hide_render = True
    return imgs

def tile(imgs, cols, path):
    h, w = imgs[0].shape[:2]; rows = (len(imgs) + cols - 1) // cols
    out = np.ones((rows * h, cols * w, 4), np.float32)
    for i, a in enumerate(imgs):
        r, c = i // cols, i % cols
        out[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a
    im = bpy.data.images.new('sheet_tmp', cols * w, rows * h, alpha=True)
    im.pixels.foreach_set(out.ravel()); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)
    return path
