# Bake all 20 clips onto FoxinoRig (tail) and RobRig (antenna) as NLA tracks named after the clips.
import bpy, math
SPA = r"."  # the folder holding these scripts
exec(open(SPA + r"\anim.py", encoding='utf-8').read(), globals())
exec(open(SPA + r"\clips.py", encoding='utf-8').read(), globals())
finish(mirror)

def secondary(rig, clip, ctr):
    n = len(ctr); loop = clip['loop']
    yaw = [c['hr'][1] * 0.5 + c['hr'][2] * 0.8 + c['hx'] * 150 for c in ctr]
    up = [c['hy'] * 60 for c in ctr]
    if rig.tail:
        ly = spring_track(yaw, 90, 9, loops=loop); lu = spring_track(up, 110, 10, loops=loop)
        for i, c in enumerate(ctr):
            wag = 7 * math.sin(2 * math.pi * i / max(1, n - 1)) if loop else 0.0
            dy = (ly[i] - yaw[i]) * 1.1 + wag; du = (lu[i] - up[i]) * 0.9
            t1 = c['t1']; t2 = c['t2']
            c['t1'] = (t1[0] + du, t1[1] + dy, t1[2]); c['t2'] = (t2[0] + du * 0.6, t2[1] + dy * 0.7, t2[2])
    if rig.antenna:
        sp = [c['hd'][0] + c['sp'][0] * 0.8 + c['hr'][0] + c['hy'] * 40 for c in ctr]
        sr = [c['hd'][2] + c['hr'][2] + c['hx'] * 100 + c['hr'][1] * 0.3 for c in ctr]
        lp = spring_track(sp, 260, 5, loops=loop); lr = spring_track(sr, 260, 5, loops=loop)
        for i, c in enumerate(ctr):
            a = c['an']; c['an'] = (a[0] - (lp[i] - sp[i]) * 1.4, a[1], a[2] - (lr[i] - sr[i]) * 1.4)
    if loop:      # make the last frame exactly the first
        ctr[-1] = dict(ctr[0])
    return ctr

def bake_all(arm, tail=(), antenna=None, prefix=''):
    bpy.context.scene.render.fps = FPS
    rig = Rig(arm, tail, antenna)
    ad = arm.animation_data_create()
    for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
    info = []
    for name in ORDER:
        c = [x for x in CLIPS if x['name'] == name][0]
        act, frames = bake(rig, c, act_name=prefix + name, secondary=secondary)
        push_nla(arm, act, name)
        info.append((name, frames, c['loop'], c['events']))
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    return info
