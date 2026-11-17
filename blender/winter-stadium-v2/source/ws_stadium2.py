# ws-stadium v2 additions (exec'd after ws_stadium.py): the curved LED Screen above the entrance, a lattice truss on the
# roof ring with spotlight cans, 16 masts with RoofFlag.001..016, two revolving doors, a red carpet up the steps and
# two snowy ice sculptures (a fox head and a ball) beside the steps. The frieze lives in ws_stadium.bay_front.
PAL.update({'Screen': '15112a', 'Truss': '7d74b8', 'Carpet': 'd8304a'})

def screen(mb, c):
    RS = 39.95; W, Hh = 10.4, 5.85; Y0 = 15.9; phi = (W / 2) / RS; n = 16
    sm = MB()
    for i in range(n):
        a0 = -phi + 2 * phi * i / n; a1 = -phi + 2 * phi * (i + 1) / n
        p = [PP(a0, RS, Y0), PP(a1, RS, Y0), PP(a1, RS, Y0 + Hh), PP(a0, RS, Y0 + Hh)]
        sm.face(p, 'Screen', frame((a0 + a1) / 2)[1], uv=[(i / n, 0), ((i + 1) / n, 0), ((i + 1) / n, 1), (i / n, 1)])
    build(sm, 'Screen', c)
    m = bpy.data.materials['Screen']; m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.35
    fb = 0.28; ph = phi + fb / RS
    sweep(mb, [(RS - 0.45, Y0 - fb), (RS + 0.06, Y0 - fb), (RS + 0.06, Y0)], 18, 'Mullion', -ph, ph)
    sweep(mb, [(RS + 0.06, Y0 + Hh), (RS + 0.06, Y0 + Hh + fb), (RS - 0.45, Y0 + Hh + fb)], 18, 'Mullion', -ph, ph)
    for s in (-1, 1):
        a0, a1 = sorted((s * phi, s * ph))
        sweep(mb, [(RS + 0.06, Y0 - fb), (RS + 0.06, Y0 + Hh + fb)], 1, 'Mullion', a0, a1)
        t, nn = frame(s * ph)
        mb.face([PP(s * ph, RS + 0.06, Y0 - fb), PP(s * ph, RS - 0.45, Y0 - fb), PP(s * ph, RS - 0.45, Y0 + Hh + fb), PP(s * ph, RS + 0.06, Y0 + Hh + fb)], 'Mullion', t * s)
    sweep(mb, [(RS - 0.45, Y0 + Hh + fb), (RS - 0.45, Y0 - fb)], 18, 'Mullion', -ph, ph)
    for k in range(22):
        a = -phi + 2 * phi * (k + 0.5) / 22
        for y in (Y0 - fb * 0.5, Y0 + Hh + fb * 0.5):
            t, nn = frame(a); p = PP(a, RS + 0.07, y); up = Vector((0, 0.05, 0))
            mb.face([p - t * 0.07 - up, p + t * 0.07 - up, p + t * 0.07 + up, p - t * 0.07 + up], 'LampLit', nn)
    for s in (-0.6, 0.6):
        a = s * phi
        prism(mb, PP(a, RS - 0.45, Y0 + Hh * 0.75), PP(a, R - 3.3, Y0 + Hh * 0.75), 0.12, 4, 'Truss')
        prism(mb, PP(a, RS - 0.45, Y0 + Hh * 0.2), PP(a, R + 0.6, Y0 + 0.1), 0.12, 4, 'Truss')

def truss(mb):
    RT = 42.05; YB, YT = 21.35, 22.95; A0, A1 = math.radians(-82), math.radians(82); n = 56
    pts_b = [PP(A0 + (A1 - A0) * i / n, RT, YB) for i in range(n + 1)]
    pts_t = [PP(A0 + (A1 - A0) * (i + 0.5) / n, RT, YT) for i in range(n)]
    tube(mb, pts_b, 0.07, 4, 'Truss')
    tube(mb, [PP(A0, RT, YT)] + pts_t + [PP(A1, RT, YT)], 0.07, 4, 'Truss')
    for i in range(n):
        prism(mb, pts_b[i], pts_t[i], 0.045, 3, 'Truss', caps=(False, False))
        prism(mb, pts_t[i], pts_b[i + 1], 0.045, 3, 'Truss', caps=(False, False))
    for i in range(0, n + 1, 4):
        a = A0 + (A1 - A0) * i / n
        prism(mb, PP(a, RT, YB), PP(a, 40.7, 21.85), 0.04, 3, 'Truss', caps=(False, False))
    for i in range(2, n, 6):
        a = A0 + (A1 - A0) * i / n; t, nn = frame(a)
        top = PP(a, RT, YB - 0.05); d = (nn * 0.55 + Vector((0, -1, 0))).normalized()
        ca, cb = frame_of(d)
        r0 = [top + (ca * math.cos(2 * math.pi * k / 8) + cb * math.sin(2 * math.pi * k / 8)) * 0.17 for k in range(8)]
        r1 = [p + d * 0.42 + (p - top) * 0.25 for p in r0]
        for k in range(8):
            j = (k + 1) % 8
            mb.face([r0[k], r0[j], r1[j], r1[k]], 'Mullion', (r0[k] + r0[j]) / 2 - top)
        mb.face(r0, 'Mullion', -d); mb.face(r1, 'Glow', d)

def roof_flags(mb, c):
    cols = ['RYellow', 'RPurple', 'RCyan', 'ROrange', 'RPink']
    for i in range(16):
        a = math.radians(-76 + 152 * i / 15)
        base = PP(a, 40.6, 23.35); top = base + Vector((0, 2.3, 0))
        prism(mb, base, top, 0.045, 6, 'PoleWhite', caps=(False, False))
        lathe(mb, [(0.0, top.y - 0.02), (0.07, top.y + 0.04), (0.0, top.y + 0.11)], 6, 'Gold', c=(top.x, 0, top.z))
        fm = MB(); W, H, nx, ny = 1.15, 0.72, 6, 3; ytop = top.y - 0.06; x0 = top.x + 0.04; z = top.z
        col = cols[i % 5]
        for ii in range(nx):
            for jj in range(ny):
                u0, u1 = x0 + W * ii / nx, x0 + W * (ii + 1) / nx; v0, v1 = ytop - H + H * jj / ny, ytop - H + H * (jj + 1) / ny
                fm.face([(u0, v0, z), (u1, v0, z), (u1, v1, z), (u0, v1, z)], col, (0, 0, 1))
        white, cut = picto(SPORTS[i % 5]); s_ = 0.19; cx, cy = x0 + W * 0.5, ytop - H / 2
        for side in (1, -1):
            for pts in white: fm.face([(cx + side * u * s_, cy + v * s_, z + side * 0.01) for u, v in pts], 'FlagWhite', (0, 0, side))
        build_ws(fm, 'RoofFlag.%03d' % (i + 1), c, origin=(top.x + 0.04, ytop - H / 2, z), jit=0.03, seed=90 + i)

def revolving_doors(mb):
    for x in (-2.0, 2.0):
        cz = -37.35; r = 0.95; y0, y1 = 2.4, 5.1; n = 12
        for k in range(n):
            a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
            p = lambda a, y, rr=r: (x + rr * math.sin(a), y, cz + rr * math.cos(a))
            if abs(math.sin((a0 + a1) / 2)) > 0.92: continue
            mb.face([p(a0, y0), p(a1, y0), p(a1, y1), p(a0, y1)], 'WindowLit', (math.sin((a0 + a1) / 2), 0, math.cos((a0 + a1) / 2)))
            prism(mb, p(a0, y0, r + 0.02), p(a0, y1, r + 0.02), 0.03, 4, 'Mullion', caps=(False, False))
        lathe(mb, [(r + 0.1, y1), (r + 0.1, y1 + 0.32), (0.0, y1 + 0.34)], n, 'StadiumPurple', c=(x, 0, cz))
        cap_disc(mb, (x, 0, cz), r + 0.1, n, y1, 'StadiumPurple', up=False)
        lathe(mb, [(r + 0.08, y1 + 0.32), (r + 0.12, y1 + 0.36), (r * 0.5, y1 + 0.5), (0.0, y1 + 0.52)], n, 'Snow', c=(x, 0, cz))
        lathe(mb, [(r + 0.06, y0), (r + 0.06, y0 + 0.08)], n, 'Gold', c=(x, 0, cz))
        for a in (0.0, math.pi / 2):
            q = r * 0.95
            mb.face([(x + q * math.sin(a), y0, cz + q * math.cos(a)), (x - q * math.sin(a), y0, cz - q * math.cos(a)),
                     (x - q * math.sin(a), y1, cz - q * math.cos(a)), (x + q * math.sin(a), y1, cz + q * math.cos(a))], 'Mullion', (math.cos(a), 0, -math.sin(a)))
        prism(mb, (x - 0.35, 3.6, cz + r + 0.06), (x + 0.35, 3.6, cz + r + 0.06), 0.025, 4, 'Gold')

def carpet(mb):
    W = 1.5; G = 0.12; e = 0.012
    for i in range(12):
        za, zb = -27.4 - 0.6 * i, -27.4 - 0.6 * (i + 1); y0, y1 = 0.2 * i, 0.2 * (i + 1)
        for (x0, x1, mat) in ((-W + G, W - G, 'Carpet'), (-W, -W + G, 'Gold'), (W - G, W, 'Gold')):
            yb = y0 + (0.03 if i == 0 else 0.0)
            mb.face([(x0, yb, za + e), (x1, yb, za + e), (x1, y1 + e, za + e), (x0, y1 + e, za + e)], mat, (0, 0, 1))
            mb.face([(x0, y1 + e, za + e), (x1, y1 + e, za + e), (x1, y1 + e, zb), (x0, y1 + e, zb)], mat, (0, 1, 0))
        for s in (-1, 1):
            hull(mb, [(s * (W + 0.02), y1, za), (s * (W + 0.02), y1, zb + 0.05), (s * (W + 0.32), y1, za - 0.1), (s * (W + 0.12), y1 + 0.09, (za + zb) / 2)], snow_mat, skip_down=True)
    for (x0, x1, mat) in ((-W + G, W - G, 'Carpet'), (-W, -W + G, 'Gold'), (W - G, W, 'Gold')):
        mb.face([(x0, 2.4 + e, -34.6), (x1, 2.4 + e, -34.6), (x1, 2.4 + e, -37.9), (x0, 2.4 + e, -37.9)], mat, (0, 1, 0))
        mb.face([(x0, 0.045, -24.6), (x1, 0.045, -24.6), (x1, 0.045, -27.4), (x0, 0.045, -27.4)], mat, (0, 1, 0))

def ice_sculptures(mb):
    icem = lambda n: 'IceDeep' if (n.x * 0.7 + n.z * 0.4 - n.y * 0.3) > 0.35 else 'Ice'
    for s, kind in ((-1, 'fox'), (1, 'ball')):
        cx, cz = s * 12.8, -25.4
        obox(mb, (cx, cz), 0, 2.0, 1.8, 0.0, 1.0, 0.1, 'Stone')
        obox(mb, (cx, cz + 0.91), 0, 1.6, 0.04, 0.35, 0.65, 0.01, 'StadiumPurple')
        snowcap_box(mb, (cx, cz), 0, 1.95, 1.75, 1.0, h=0.18, over=0.07, seed=7 + s)
        for dx in (-0.8, 0.8): lantern(mb, cx + dx, 1.12, cz + 0.72, s=0.9)
        if kind == 'fox':
            y0 = 1.12
            P = lambda x, y, z: (cx + x, y0 + y, cz + z)
            pts = [P(sx * a, b, c_) for sx in (-1, 1) for a, b, c_ in ((0.62, 0.05, -0.35), (0.72, 0.65, -0.25), (0.48, 1.18, -0.3), (0.42, 0.08, 0.25),
                                                                       (0.92, 0.35, 0.2), (0.6, 0.9, 0.3), (0.2, 0.32, 0.92), (0.15, 0.6, 0.85))]
            hull(mb, pts + [P(0, 1.3, -0.12), P(0, 0.05, -0.62), P(0, 0.48, 1.12), P(0, 0.28, 1.02)], icem)
            for sx in (-1, 1):
                hull(mb, [P(sx * 0.22, 1.02, -0.32), P(sx * 0.66, 0.88, -0.32), P(sx * 0.5, 1.05, 0.02), P(sx * 0.3, 1.12, 0.0), P(sx * 0.6, 2.0, -0.18)], icem)
                hull(mb, [P(sx * a, b, c_) for a, b, c_ in ((0.3, 0.7, 0.62), (0.42, 0.72, 0.5), (0.36, 0.84, 0.52), (0.33, 0.76, 0.66))], 'IceDeep')
            hull(mb, [P(a * 0.09, 0.48 + b * 0.06, 1.12 + c_ * 0.05) for a in (-1, 1) for b in (-1, 1) for c_ in (0, 1)], 'IceDeep')
            snowcap(mb, [(cx + 0.35 * math.cos(t), cz - 0.15 + 0.25 * math.sin(t)) for t in [2 * math.pi * k / 6 for k in range(6)]], y0 + 1.2, h=0.12, over=0.05, seed=5)
        else:
            b2 = bmesh.new(); bmesh.ops.create_icosphere(b2, subdivisions=0, radius=1.0)
            base_dirs = [v.co.normalized() for v in b2.verts]; b2.free()
            bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.92)
            ctr = Vector((cx, 1.12 + 0.92, cz))
            for f in bm.faces:
                q = [ctr + v.co for v in f.verts]; nrm = f.normal.copy()
                mb.face(q, 'IceDeep' if max(nrm.dot(d) for d in base_dirs) > 0.9 else 'Ice', nrm)
            bm.free()
            snowcap(mb, [(cx + 0.38 * math.cos(t), cz + 0.38 * math.sin(t)) for t in [2 * math.pi * k / 6 for k in range(6)]], 1.12 + 1.7, h=0.12, over=0.06, seed=9)

def build_stadium():
    """v2: the v1 stadium plus the additions."""
    c = clear('ws-stadium'); mb = MB()
    DET = math.radians(86)
    for k in range(-NB // 2, NB // 2):
        th = (k + 0.5) * DTH
        bay_front(mb, k, abs(th) < DET)
        pier(mb, k, abs(k * DTH) < DET + DTH / 2)
        if k in BANNERS: banner(mb, k)
    upper_and_ring(mb)
    portal(mb)
    screen(mb, c); truss(mb); roof_flags(mb, c); revolving_doors(mb); carpet(mb); ice_sculptures(mb)
    build_ws(mb, 'Stadium', c, seed=3)
    return mb.tris()
