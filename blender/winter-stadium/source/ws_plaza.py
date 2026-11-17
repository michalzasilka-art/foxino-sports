# ws-plaza: SnowGround (gentle faceted snow bumps, flat under the plaza and the stadium), Paving (the cleared walkway
# x -3.5..3.5 from the platforms to the steps, and the platform square x -6.5..6.5, z 8..26, in lilac stone slabs with
# snowy joints), SnowEdges (puffy banks along the paving, <= 0.3 m in the clear zone), Steps (12 steps up to the
# entrance landing at y 2.4, cheek walls with snow caps, lanterns and planters with small pines), Walls (low snowy
# terrace walls), Fountain (the frozen fountain at (-12, 0, 8): stone basin, Ice surface, ice crystals, icicles,
# lanterns), Benches, Rocks and SnowPiles.
def _noise(x, z):
    return (math.sin(x * 0.11 + 1.3) * math.cos(z * 0.09 - 0.4) + 0.6 * math.sin(x * 0.23 - z * 0.17 + 2.1)
            + 0.35 * math.sin(x * 0.41 + z * 0.37))

def ground_h(x, z):
    d_plaza = math.hypot(max(abs(x) - 12.5, 0.0), max(z - 34.0, -44.0 - z, 0.0))
    d_stad = max(0.0, math.hypot(x, z + 78.0) - 43.0)
    d = min(d_plaza, d_stad)
    a = min(1.0, max(0.0, (d - 1.0) / 22.0))
    far = max(0.0, (abs(x) - 70.0) / 60.0) + max(0.0, (-z - 150.0) / 60.0) + max(0.0, (z - 45.0) / 25.0)
    return a * (0.7 + 0.55 * _noise(x, z)) + far * 3.0

def build_plaza():
    c = clear('ws-plaza'); rnd = random.Random(42)
    # ---------------------------------------------------------------- the ground
    g = MB()
    XS = [-160, -110, -75, -52, -38, -28, -21, -16, -12.5, -9, -6.5, -3.5, 0, 3.5, 6.5, 9, 12.5, 16, 21, 28, 38, 52, 75, 110, 160]
    ZS = [70, 48, 36, 30, 26, 20, 14, 8, 3, -2, -8, -14, -20, -27.4, -34, -40, -48, -58, -70, -85, -100, -118, -140, -165, -200, -240]
    H = {}
    for i, x in enumerate(XS):
        for j, z in enumerate(ZS):
            jx = 0 if abs(x) <= 12.5 or abs(x) >= 160 else rnd.uniform(-1.2, 1.2)
            jz = 0 if (-44 < z < 34 and abs(x) <= 12.5) or z in (70, -240) else rnd.uniform(-1.0, 1.0)
            X, Z = x + jx, z + jz
            H[i, j] = Vector((X, ground_h(X, Z) + (rnd.uniform(-0.06, 0.06) if ground_h(X, Z) > 0.05 else 0), Z))
    for i in range(len(XS) - 1):
        for j in range(len(ZS) - 1):
            a, b, cc, d = H[i, j], H[i + 1, j], H[i + 1, j + 1], H[i, j + 1]
            if (i + j) % 2: g.face([a, b, cc], 'Snow', (0, 1, 0)); g.face([a, cc, d], 'Snow', (0, 1, 0))
            else: g.face([a, b, d], 'Snow', (0, 1, 0)); g.face([b, cc, d], 'Snow', (0, 1, 0))
    build_ws(g, 'SnowGround', c, jit=0.09, seed=1)
    # ---------------------------------------------------------------- paving
    pv = MB()
    def slabs(x0, x1, z0, z1, sx, sz):
        nx = int(round((x1 - x0) / sx)); nz = int(round((z1 - z0) / sz))
        for i in range(nx):
            for j in range(nz):
                off = (sx / 2 if j % 2 else 0.0)
                a = x0 + i * sx + off; b = min(x1, a + sx)
                if a >= x1: continue
                za, zb = z0 + j * sz, z0 + (j + 1) * sz
                grect(pv, a + 0.035, b - 0.035, za + 0.035, zb - 0.035, 0.03, rnd.choice(('Paving', 'Paving', 'Paving2', 'Paving3')))
                if j % 2 and i == 0: grect(pv, x0 + 0.035, x0 + off - 0.035, za + 0.035, zb - 0.035, 0.03, 'Paving2')
    slabs(-6.6, 6.6, 7.6, 26.4, 1.2, 1.2)
    slabs(-3.6, 3.6, -27.4, 7.6, 1.2, 1.2)
    build_ws(pv, 'Paving', c, jit=0.06, seed=2)
    # ---------------------------------------------------------------- snow banks along the paving
    se = MB()
    def bank(x0, z0, x1, z1, h, seg=2.0, w=0.8, side=(0, 0)):
        L = math.hypot(x1 - x0, z1 - z0); n = max(1, int(L / seg))
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            ax, az = x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0; bx, bz = x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1
            hh = h * rnd.uniform(0.75, 1.0); ox, oz = side[0] * w, side[1] * w
            pts = [(ax, 0.0, az), (bx, 0.0, bz), (ax + ox, 0.0, az + oz), (bx + ox, 0.0, bz + oz),
                   (ax + ox * 0.45 + (bx - ax) * 0.1, hh, az + oz * 0.45 + (bz - az) * 0.1), (bx + ox * 0.45 - (bx - ax) * 0.1, hh * rnd.uniform(0.8, 1.0), bz + oz * 0.45 - (bz - az) * 0.1),
                   (ax + ox * 0.15, hh * 0.55, az + oz * 0.15), (bx + ox * 0.85, hh * 0.45, bz + oz * 0.85)]
            hull(se, pts, snow_mat, skip_down=True)
    for s in (-1, 1):
        bank(s * 6.75, 26.6, s * 6.75, 7.4, 0.26, side=(s, 0))
        bank(s * 3.75, 7.4, s * 3.75, -27.2, 0.45, side=(s, 0), w=1.0)
        bank(s * 3.8, 7.42, s * 6.7, 7.42, 0.28, side=(0, -1), w=0.9)
    bank(-6.75, 26.65, 6.75, 26.65, 0.22, side=(0, 1), w=0.9)
    build_ws(se, 'SnowEdges', c, jit=0.07, seed=3)
    # ---------------------------------------------------------------- the steps
    st = MB()
    Z0, RUN, RISE, NS = -27.4, 0.6, 0.2, 12
    for i in range(NS):
        za, zb = Z0 - i * RUN, Z0 - (i + 1) * RUN; y = RISE * (i + 1)
        st.face([(-9, y, za), (9, y, za), (9, y, zb), (-9, y, zb)], 'Paving' if i % 2 else 'Paving3', (0, 1, 0))
        st.face([(-9, y - RISE, za), (9, y - RISE, za), (9, y, za), (-9, y, za)], 'StoneDark', (0, 0, 1))
        for s in (-1, 1):       # little snow drifts at the step ends
            hull(st, [(s * 8.95, y, za), (s * 8.95, y, zb), (s * 8.1, y, za - 0.05), (s * 8.4, y, zb), (s * 8.8, y + 0.18, (za + zb) / 2), (s * 8.4, y + 0.1, za - 0.1)], snow_mat, skip_down=True)
    # cheek walls with a sloped top, snow caps, lanterns, planters
    for s in (-1, 1):
        xa, xb = sorted((s * 9.0, s * 10.8))
        top0, top1 = 0.95, 2.4 + 0.95
        pts = [(x, y, z) for x in (xa, xb) for (z, y) in ((Z0 + 0.6, 0.0), (Z0 + 0.6, top0), (-34.6, 0.0), (-34.6, top1))]
        hull(st, pts, lambda n: 'Stone' if n.y < 0.6 else 'StoneDark')
        for k in range(6):
            t0, t1 = k / 6, (k + 1) / 6
            za, zb = Z0 + 0.6 + (-34.6 - Z0 - 0.6) * t0, Z0 + 0.6 + (-34.6 - Z0 - 0.6) * t1
            ya, yb = top0 + (top1 - top0) * t0, top0 + (top1 - top0) * t1
            hull(st, [(xa - 0.08, ya, za), (xb + 0.08, ya, za), (xa - 0.08, yb, zb), (xb + 0.08, yb, zb),
                      ((xa + xb) / 2, ya + 0.25, za - 0.1), ((xa + xb) / 2, yb + 0.22, zb + 0.1), (xa + 0.1, ya + 0.15, (za + zb) / 2), (xb - 0.1, yb + 0.16, (za + zb) / 2)], snow_mat)
        for t in (0.15, 0.5, 0.85):
            z = Z0 + 0.6 + (-34.6 - Z0 - 0.6) * t; y = top0 + (top1 - top0) * t + 0.12
            lantern(st, (xa + xb) / 2, y, z, s=1.1)
        # planter at the foot of the cheek wall, with a little pine
        px = s * 10.0; pz = Z0 + 1.6
        obox(st, (px, pz), 0, 1.6, 1.6, 0.0, 0.8, 0.08, 'StoneDark')
        snowcap_box(st, (px, pz), 0, 1.5, 1.5, 0.8, h=0.18, over=0.05, seed=50 + s)
        pine(st, px, pz, 2.4, seed=60 + s, tiers=2, y=0.9)
    build_ws(st, 'Steps', c, jit=0.06, seed=4)
    # ---------------------------------------------------------------- low terrace walls in front of the stadium
    wl = MB()
    for s in (-1, 1):
        for (x0, x1) in ((10.8, 15.5), (15.7, 20.5), (20.7, 25.0)):
            xa, xb = sorted((s * x0, s * x1))
            obox(wl, ((xa + xb) / 2, -27.6), 0, xb - xa, 0.7, 0.0, 0.9, 0.08, 'Stone')
            snowcap_box(wl, ((xa + xb) / 2, -27.6), 0, xb - xa, 0.65, 0.9, h=0.22, over=0.08, seed=int(x0 * 10) + s)
    build_ws(wl, 'Walls', c, jit=0.06, seed=5)
    # ---------------------------------------------------------------- the frozen fountain
    fo = MB(); FX, FZ = -12.0, 8.0
    n = 8; Ro, Ri = 3.1, 2.6
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n + math.pi / 8, 2 * math.pi * (k + 1) / n + math.pi / 8
        am = (a0 + a1) / 2; L = 2 * Ro * math.sin(math.pi / n)
        cxm, czm = FX + (Ro + Ri) / 2 * math.cos(am) * math.cos(math.pi / n), FZ + (Ro + Ri) / 2 * math.sin(am) * math.cos(math.pi / n)
        yaw = math.atan2(math.cos(am), math.sin(am))
        obox(fo, (cxm, czm), yaw, L * 0.97, Ro - Ri, 0.0, 0.55, 0.06, 'Stone')
        snowcap_box(fo, (cxm, czm), yaw, L * 0.85, Ro - Ri - 0.05, 0.55, h=0.16, over=0.05, seed=70 + k)
        # icicles hanging off the rim, outside
        for f in (-0.3, 0.05, 0.32):
            ox = FX + Ro * 1.005 * math.cos(am + f * 0.7); oz = FZ + Ro * 1.005 * math.sin(am + f * 0.7)
            L2 = rnd.uniform(0.18, 0.34)
            hull(fo, [(ox + 0.05 * math.cos(am + 1.57), 0.5, oz + 0.05 * math.sin(am + 1.57)), (ox - 0.05 * math.cos(am + 1.57), 0.5, oz - 0.05 * math.sin(am + 1.57)),
                      (ox + 0.05 * math.cos(am), 0.5, oz + 0.05 * math.sin(am)), (ox, 0.5 - L2, oz)], 'Ice')
        if k % 2 == 0: lantern(fo, FX + (Ro + Ri) / 2 * math.cos(am), 0.6, FZ + (Ro + Ri) / 2 * math.sin(am), s=0.9)
    fo.face([(FX + Ri * 1.02 * math.cos(2 * math.pi * k / 16), 0.38, FZ + Ri * 1.02 * math.sin(2 * math.pi * k / 16)) for k in range(16)], 'Ice', (0, 1, 0))
    lathe(fo, [(0.9, 0.38), (0.7, 0.75), (0.75, 0.85), (0.0, 0.88)], 8, 'Stone', c=(FX, 0, FZ))
    for k, (dx, dz, h, r, tilt) in enumerate(((0, 0, 2.7, 0.32, 0.0), (0.45, 0.2, 1.9, 0.24, 0.25), (-0.4, 0.25, 2.1, 0.25, -0.22), (0.2, -0.45, 1.6, 0.2, 0.18),
                                               (-0.3, -0.35, 1.4, 0.18, -0.3), (0.55, -0.15, 1.2, 0.16, 0.38), (-0.55, 0.0, 1.25, 0.17, -0.4))):
        b = Vector((FX + dx, 0.82, FZ + dz)); ax = Vector((math.sin(tilt) * (1 if dx >= 0 else 1), 1, math.sin(tilt * 0.6) * (1 if dz >= 0 else -1))).normalized()
        a_, b_ = frame_of(ax)
        ring0 = [b + (a_ * math.cos(2 * math.pi * i / 6) + b_ * math.sin(2 * math.pi * i / 6)) * r for i in range(6)]
        ring1 = [p + ax * h * 0.78 for p in ring0]
        tip = b + ax * h
        for i in range(6):
            j = (i + 1) % 6
            fo.face([ring0[i], ring0[j], ring1[j], ring1[i]], 'Ice' if i % 2 else 'IceDeep', (ring0[i] + ring0[j]) / 2 - b)
            fo.face([ring1[i], ring1[j], tip], 'Ice' if (i + k) % 2 else 'Glow', (ring1[i] + ring1[j]) / 2 - (b + ax * h * 0.78))
    build_ws(fo, 'Fountain', c, jit=0.05, seed=6)
    # ---------------------------------------------------------------- benches, rocks, snow piles
    bn = MB()
    for (bx, bz, yaw) in ((-9.0, 16.5, math.radians(70)), (9.2, 15.8, math.radians(-70)), (-8.6, -3.0, math.radians(90)), (8.6, -9.0, math.radians(-90))):
        R_ = Ry(yaw); C = Vector((bx, 0, bz))
        P = lambda x, y, z: C + R_ @ Vector((x, y, z))
        for lx in (-0.75, 0.75):
            hull(bn, [P(lx + a, y, z) for a in (-0.05, 0.05) for y in (0, 0.45) for z in (-0.22, 0.22)], 'Mullion')
            hull(bn, [P(lx + a, y, -0.24 + dz) for a in (-0.04, 0.04) for y in (0.45, 0.95) for dz in (0, 0.08)], 'Mullion')
        for k in range(3):
            z = -0.18 + 0.14 * k
            hull(bn, [P(x, y, z + dz) for x in (-1.0, 1.0) for y in (0.45, 0.5) for dz in (-0.06, 0.06)], 'Wood')
        for y in (0.62, 0.82):
            hull(bn, [P(x, y + dy, -0.27 + dz) for x in (-1.0, 1.0) for dy in (-0.07, 0.07) for dz in (0, 0.05)], 'Wood')
        hull(bn, [P(x, 0.5, z) for x in (-0.95, 0.95) for z in (-0.2, 0.2)] + [P(x, 0.62, z) for x in (-0.8, 0.8) for z in (-0.12, 0.12)] + [P(0, 0.66, 0)], snow_mat)
        hull(bn, [P(x, 0.89, -0.27 + dz) for x in (-0.95, 0.95) for dz in (-0.02, 0.07)] + [P(x, 0.98, -0.24) for x in (-0.8, 0.8)], snow_mat)
    build_ws(bn, 'Benches', c, jit=0.06, seed=7)
    rk = MB()
    for k, (x, z, s) in enumerate(((-17.5, 13.0, 1.6), (-19.5, 4.0, 2.2), (18.0, 10.0, 1.8), (21.0, 0.0, 2.6), (-22.0, -18.0, 2.8), (24.0, -22.0, 2.4),
                                    (-15.0, 22.0, 1.2), (16.0, 22.5, 1.4), (-9.5, -8.5, 1.0), (11.2, -6.0, 0.9))):
        rr = random.Random(100 + k)
        pts = [(x + s * rr.uniform(-1, 1), s * rr.uniform(0, 0.7), z + s * rr.uniform(-0.8, 0.8)) for _ in range(11)] + [(x, -0.2, z)]
        hull(rk, pts, lambda n: 'RockShade' if n.y < -0.1 else 'Rock', skip_down=True)
        top = max(p[1] for p in pts)
        snowcap(rk, [(x + s * 0.55 * math.cos(a), z + s * 0.45 * math.sin(a)) for a in [2 * math.pi * i / 7 for i in range(7)]], top * 0.72, h=0.32 * s, over=0.12, seed=k)
    sp = MB()
    for k in range(26):
        rr = random.Random(200 + k)
        while True:
            x = rr.uniform(-34, 34); z = rr.uniform(-40, 30)
            if abs(x) > 8 or z < -30: break
        if abs(x) < 10.8 and -36 < z < -26: continue
        s = rr.uniform(0.5, 1.3)
        snowcap(sp, [(x + s * math.cos(a), z + s * 0.8 * math.sin(a)) for a in [2 * math.pi * i / 7 + rr.random() for i in range(7)]], 0.0, h=0.45 * s, over=0.15, seed=300 + k)
    for k in range(18):         # drifts along the stadium's base
        a = math.radians(-70 + 140 * k / 17); r = 38.9
        x, z = r * math.sin(a), CZ + r * math.cos(a)
        if abs(x) < 10: continue
        s = 1.1
        snowcap(sp, [(x + s * 1.4 * math.cos(b), z + s * 0.6 * math.sin(b)) for b in [2 * math.pi * i / 7 for i in range(7)]], 0.0, h=0.55, over=0.2, seed=400 + k)
    build_ws(rk, 'Rocks', c, jit=0.08, seed=8)
    build_ws(sp, 'SnowPiles', c, jit=0.07, seed=9)
