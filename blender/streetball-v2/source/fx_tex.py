# foxino-baller, step 2: a 1024 px repaint of the Tripo texture by body region. Each face gets a region from its
# dominant bone; its UV triangle is rasterised into a label map; pixels are then recoloured by region + colour key.
import bpy, math
import numpy as np

REG = {'Head': 1, 'Neck': 1, 'HeadTop_End': 1, 'Spine': 2, 'Spine1': 2, 'Spine2': 2, 'LeftShoulder': 2, 'RightShoulder': 2,
       'Hips': 3, 'LeftArm': 4, 'RightArm': 4, 'LeftForeArm': 5, 'RightForeArm': 5, 'LeftUpLeg': 7, 'RightUpLeg': 7,
       'LeftLeg': 8, 'RightLeg': 8, 'LeftFoot': 9, 'RightFoot': 9, 'LeftToeBase': 9, 'RightToeBase': 9, 'LeftToe_End': 9, 'RightToe_End': 9}
N = 1024

def face_labels(mo):
    """Per loop-triangle: (uv coords, region, mean z, normal, mean x)."""
    me = mo.data; vg = {g.index: g.name.split(':')[-1] for g in mo.vertex_groups}
    dom = []
    for v in me.vertices:
        best = max(v.groups, key=lambda e: e.weight, default=None)
        nm = vg[best.group] if best else 'Hips'
        dom.append(REG.get(nm, 6 if 'Hand' in nm else 0))
    me.calc_loop_triangles(); uv = me.uv_layers.active.data
    tris = []
    for t in me.loop_triangles:
        regs = [dom[i] for i in t.vertices]; r = max(set(regs), key=regs.count)
        zs = [me.vertices[i].co.z for i in t.vertices]; xs = [me.vertices[i].co.x for i in t.vertices]
        tris.append(([tuple(uv[l].uv) for l in t.loops], r, sum(zs) / 3, tuple(t.normal), sum(xs) / 3, t.index))
    return tris

def raster(tris, keyfn):
    """Label image (N x N, int) where keyfn(tri) gives the label; 0 = uncovered."""
    lab = np.zeros((N, N), np.int16)
    for tr in tris:
        k = keyfn(tr)
        if k <= 0: continue
        (u0, v0), (u1, v1), (u2, v2) = [(u * N, v * N) for u, v in tr[0]]
        xa, xb = int(max(0, math.floor(min(u0, u1, u2)) - 1)), int(min(N - 1, math.ceil(max(u0, u1, u2)) + 1))
        ya, yb = int(max(0, math.floor(min(v0, v1, v2)) - 1)), int(min(N - 1, math.ceil(max(v0, v1, v2)) + 1))
        if xb < xa or yb < ya: continue
        ys, xs = np.mgrid[ya:yb + 1, xa:xb + 1] + 0.5
        d = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2)
        if abs(d) < 1e-9: continue
        a = ((v1 - v2) * (xs - u2) + (u2 - u1) * (ys - v2)) / d
        b = ((v2 - v0) * (xs - u2) + (u0 - u2) * (ys - v2)) / d
        c = 1 - a - b; e = -0.75 / max(1.0, abs(d) ** 0.5)      # a little outward slack, about a texel
        m = (a >= e) & (b >= e) & (c >= e)
        sub = lab[ya:yb + 1, xa:xb + 1]; sub[m] = k
    return lab

def dilate(lab, n=3):
    for _ in range(n):
        z = lab == 0; L = lab.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(lab, dy, 0), dx, 1); m = z & (L == 0) & (sh > 0); L[m] = sh[m]
        lab = L
    return lab

def load_px(img, n=N):
    im = img.copy(); im.scale(n, n)
    px = np.array(im.pixels[:], np.float32).reshape(n, n, 4)
    bpy.data.images.remove(im)
    return px

def hsv(px):
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    mx = np.max(px[..., :3], -1); mn = np.min(px[..., :3], -1); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    return h, s, mx

def tail_verts(mo):
    """Vertices of the connected pieces that reach out behind / to the right of the body (the tail)."""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(mo.data); bm.verts.ensure_lookup_table()
    seen = set(); out = set()
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; comp = []; seen.add(v.index)
        while st:
            a = st.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); st.append(b)
        if max(a.co.y for a in comp) > 0.2 and min(a.co.z for a in comp) < 0.6 and min(a.co.z for a in comp) > 0.12:
            out.update(a.index for a in comp)
    bm.free()
    return out

SH_PURPLE = np.array([0x5b, 0x2b, 0xb0], np.float32) / 255
SH_YELLOW = np.array([0xff, 0xcd, 0x1c], np.float32) / 255
WHITE = np.array([0.96, 0.96, 0.97], np.float32)
FUR = np.array([0.624, 0.192, 0.561], np.float32)

def repaint(mo, src_img, name='FoxinoBaller'):
    tv = tail_verts(mo)
    tris = face_labels(mo)
    me = mo.data
    def key(t):
        uv, r, z, n, x, ti = t
        vs = me.loop_triangles[ti].vertices
        if any(i in tv for i in vs): return 11
        lat = abs(n[0]) > 0.72 and n[0] * x > 0
        if r == 3: return 12 if (lat and z < 0.62) else 3
        if r == 7:
            if z > 0.345: return 12 if (lat and z < 0.62) else 18
            return 13
        if r == 8: return 8 if z < 0.15 else (16 if z < 0.172 else 17)
        if r == 9:
            if n[2] < -0.5 or z < 0.022: return 14
            if abs(n[0]) > 0.55 and 0.035 < z < 0.085: return 15
            return 9
        return r if r else 1
    lab = dilate(raster(tris, key), 4)
    px = load_px(src_img); h, s, v = hsv(px)
    yel = (h > 0.10) & (h < 0.2) & (s > 0.3) & (v > 0.4)
    ora = (h > 0.0) & (h <= 0.10) & (s > 0.45) & (v > 0.4)
    wht = (s < 0.2) & (v > 0.7)
    drk = v < 0.35
    fur = (h > 0.7) & (h < 0.97) & (s > 0.2)
    out = px.copy()
    def put(m, col, ref, lo=0.75, hi=1.12):
        r = np.clip(v[m] / ref, lo, hi)[:, None]
        out[..., :3][m] = np.clip(col[None, :] * r, 0, 1)
    L = lab
    put((L == 2) & yel, SH_YELLOW, 0.953); put((L == 3) & yel, SH_YELLOW, 0.953)
    put((L == 2) & wht, SH_PURPLE, 0.95); put((L == 3) & wht, SH_PURPLE, 0.95)
    put((L == 3) & ora, SH_PURPLE, 0.95)
    put((L == 18) & (ora | fur | yel), SH_PURPLE, 0.9)
    put((L == 12) & (ora | fur), SH_YELLOW, 0.92); put((L == 12) & yel, SH_YELLOW, 0.953)
    put((L == 4) & (yel | wht), FUR, 0.953)
    put((L == 8) & (yel | fur), WHITE, 0.95, 0.85, 1.04)
    put((L == 16) & (yel | fur), SH_PURPLE, 0.95)
    put((L == 17) & yel, FUR, 0.953)
    put((L == 9) & (drk | wht), WHITE, 0.224, 0.82, 1.04)
    put(((L == 14) | (L == 15)) & (drk | wht), SH_PURPLE, 0.224, 0.8, 1.1)
    # colour swatches in a free corner for the added parts (decals, wristbands): find an uncovered 48 px block
    free = None
    for by in range(0, N - 48, 16):
        for bx in range(0, N - 48, 16):
            if not L[by:by + 48, bx:bx + 48].any(): free = (bx, by); break
        if free: break
    sw = {}
    if free:
        bx, by = free
        for i, (nm, col) in enumerate((('purple', SH_PURPLE), ('yellow', SH_YELLOW), ('white', WHITE), ('orange', np.array([1.0, 0.49, 0.13], np.float32)))):
            x0 = bx + (i % 2) * 24; y0 = by + (i // 2) * 24
            out[y0:y0 + 24, x0:x0 + 24, :3] = col; out[y0:y0 + 24, x0:x0 + 24, 3] = 1
            sw[nm] = ((x0 + 12) / N, (y0 + 12) / N)
    im = bpy.data.images.get(name)
    if im: bpy.data.images.remove(im)
    im = bpy.data.images.new(name, N, N, alpha=False)
    im.pixels.foreach_set(out.ravel()); im.update(); im.pack()
    return im, sw, len(tv)
