# foxino-baller texture, v2: per-texel interpolated rest position / normal + region, so the outfit edges are smooth.
import bpy, math
import numpy as np

def geo_raster(mo, tv):
    me = mo.data; vg = {g.index: g.name.split(':')[-1] for g in mo.vertex_groups}
    dom = []
    for v in me.vertices:
        best = max(v.groups, key=lambda e: e.weight, default=None)
        nm = vg[best.group] if best else 'Hips'
        dom.append(11 if v.index in tv else REG.get(nm, 6 if 'Hand' in nm else 0))
    me.calc_loop_triangles(); uv = me.uv_layers.active.data
    me.calc_normals_split() if hasattr(me, 'calc_normals_split') else None
    P = np.zeros((N, N, 3), np.float32); NN = np.zeros((N, N, 3), np.float32); R = np.zeros((N, N), np.int16)
    for t in me.loop_triangles:
        regs = [dom[i] for i in t.vertices]; r = 11 if 11 in regs else max(set(regs), key=regs.count)
        if r == 0: r = 1
        (u0, v0), (u1, v1), (u2, v2) = [(uv[l].uv[0] * N, uv[l].uv[1] * N) for l in t.loops]
        xa, xb = int(max(0, math.floor(min(u0, u1, u2)) - 1)), int(min(N - 1, math.ceil(max(u0, u1, u2)) + 1))
        ya, yb = int(max(0, math.floor(min(v0, v1, v2)) - 1)), int(min(N - 1, math.ceil(max(v0, v1, v2)) + 1))
        if xb < xa or yb < ya: continue
        d = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2)
        if abs(d) < 1e-9: continue
        ys, xs = np.mgrid[ya:yb + 1, xa:xb + 1] + 0.5
        a = ((v1 - v2) * (xs - u2) + (u2 - u1) * (ys - v2)) / d
        b = ((v2 - v0) * (xs - u2) + (u0 - u2) * (ys - v2)) / d
        c = 1 - a - b; e = -1.0 / max(1.0, abs(d) ** 0.5)
        m = (a >= e) & (b >= e) & (c >= e)
        cs = [np.array(me.vertices[i].co) for i in t.vertices]
        ns = [np.array(me.vertices[i].normal) for i in t.vertices]
        pos = a[..., None] * cs[0] + b[..., None] * cs[1] + c[..., None] * cs[2]
        nor = a[..., None] * ns[0] + b[..., None] * ns[1] + c[..., None] * ns[2]
        sl = (slice(ya, yb + 1), slice(xa, xb + 1))
        P[sl][m] = pos[m]; NN[sl][m] = nor[m]; R[sl][m] = r
    # dilate a few texels so seams pick up the right colour
    for _ in range(4):
        z = R == 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            Rs = np.roll(np.roll(R, dy, 0), dx, 1); m = z & (Rs > 0) & (R == 0)
            R[m] = Rs[m]; P[m] = np.roll(np.roll(P, dy, 0), dx, 1)[m]; NN[m] = np.roll(np.roll(NN, dy, 0), dx, 1)[m]
    nl = np.linalg.norm(NN, axis=-1, keepdims=True) + 1e-6
    return P, NN / nl, R

def repaint2(mo, arm, src_img, name='FoxinoBaller'):
    tv = tail_verts(mo)
    P, NN, R = geo_raster(mo, tv)
    px = load_px(src_img); h, s, v = hsv(px)
    yel = (h > 0.10) & (h < 0.2) & (s > 0.3) & (v > 0.4)
    ora = (h > 0.0) & (h <= 0.10) & (s > 0.45) & (v > 0.4)
    wht = (s < 0.2) & (v > 0.7)
    drk = v < 0.35
    fur = (h > 0.7) & (h < 0.97) & (s > 0.2)
    X, Y, Z = P[..., 0], P[..., 1], P[..., 2]; side = np.sign(X)
    B = arm.data.bones
    sh = np.array(B['mixamorig:LeftArm'].head_local); el = np.array(B['mixamorig:LeftForeArm'].head_local)
    ad = (el - sh) / np.linalg.norm(el - sh)
    Q = np.stack([np.abs(X), Y, Z], -1)
    along = ((Q - sh) * ad).sum(-1)
    body = (R != 11) & (R != 1) & (R != 6) & (R != 5)
    perp = np.linalg.norm((Q - sh) - along[..., None] * ad, axis=-1)
    sleeve = body & (along > -0.012) & (perp < 0.07) & (Z > 0.5)
    knee = B['mixamorig:LeftLeg'].head_local.z; ank = B['mixamorig:LeftFoot'].head_local.z
    out = px.copy()
    def put(m, col, ref, lo=0.75, hi=1.12):
        r = np.clip(v[m] / ref, lo, hi)[:, None]
        out[..., :3][m] = np.clip(col[None, :] * r, 0, 1)
    torso = body & ~sleeve & (Z > 0.45)
    lat = (NN[..., 0] * side > 0.45) & (np.abs(X) > 0.088)
    legs = body & (Z <= 0.62) & ~torso
    shorts_zone = legs & (Z > knee + 0.045)
    put(torso & yel, SH_YELLOW, 0.953)
    put(torso & (wht | ora), SH_PURPLE, 0.95)
    # armhole trim: a purple band just inside the sleeve cut
    trim = body & (along > -0.035) & (along <= -0.012) & (perp < 0.085) & (Z > 0.5) & (yel | wht)
    put(trim, SH_PURPLE, 0.95)
    put(sleeve & (yel | wht), FUR, 0.953)
    sz = (shorts_zone & (ora | fur | (yel & (Z < 0.6)))) | (legs & ora & (Z > knee + 0.01))
    put(sz & ~lat, SH_PURPLE, 0.92)
    put(sz & lat, SH_YELLOW, 0.92)
    # shins: yellow socks -> white high-top collar low, a purple band, fur above
    shin = body & (Z <= knee + 0.045) & (Z > ank - 0.04)
    put(shin & (yel | fur) & (Z < 0.185), WHITE, 0.95, 0.85, 1.04)
    put(shin & (yel | fur) & (Z >= 0.185) & (Z < 0.21), SH_PURPLE, 0.95)
    put(shin & yel & (Z >= 0.21), FUR, 0.953)
    foot = body & (Z <= ank + 0.03) & (drk | wht | yel)
    sole = foot & ((NN[..., 2] < -0.45) | (Z < 0.028))
    swoosh = foot & ~sole & (np.abs(NN[..., 0]) > 0.6) & (Z > 0.045) & (Z < 0.1)
    put(foot & ~sole & ~swoosh, WHITE, 0.3, 0.82, 1.04)
    put(sole | swoosh, SH_PURPLE, 0.3, 0.8, 1.1)
    sw = swatches(None, {'purple': sz & ~lat, 'yellow': torso & yel, 'white': foot & ~sole & ~swoosh, 'orange': (R == 1) & ora})
    im = bpy.data.images.get(name)
    if im: bpy.data.images.remove(im)
    im = bpy.data.images.new(name, N, N, alpha=False)
    im.pixels.foreach_set(out.ravel()); im.update(); im.pack()
    return im, sw, len(tv)

def swatches(im, masks):
    """Texel centres deep inside each mask (5x5 all inside), for flat-coloured add-ons."""
    sw = {}
    for nm, m in masks.items():
        e = m.copy()
        for dy in range(-3, 4):
            for dx in range(-3, 4): e &= np.roll(np.roll(m, dy, 0), dx, 1)
        ys, xs = np.nonzero(e)
        if len(ys): k = len(ys) // 2; sw[nm] = ((xs[k] + 0.5) / N, (ys[k] + 0.5) / N)
    return sw
