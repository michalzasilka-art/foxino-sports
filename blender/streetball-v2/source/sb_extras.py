# sb-extras: life on the v1 court. Objects: Lights (string-light wires and bunting from the lamps to the wall and
# between the lamps), Bulbs (the emissive bulbs, separate), ShotClock (a box on the hoop pole under the board) and
# ShotClockFace (its front plane, UV 0..1, material ShotClockFace), Cooler, Plants (pots by the wall), Bike (leaning
# on the right fence), BleacherBall, Bird1..Bird4 (pigeons on the wall coping, origin at their feet), Decals (scuffs
# and puddles, flat, 4 mm above the highest v1 paint layer: y 0.028).
PAL.update({'Bulb': 'fff1b8', 'Wire': '2b2a33', 'Puddle': '7f95cf', 'Scuff': '343880', 'Terracotta': 'c8643f', 'Pigeon': '8e95a8',
            'PigeonDark': '5d6375', 'ShotClockFace': '1a1016', 'CoolerBlue': '3f8fd6', 'Tire': '2a2830'})
GLOW['Bulb'] = 4.0

LAMP_HEADS = [(-8.45, 5.4, -2.28), (8.45, 5.4, -2.28)]
WALL_TOP = 6.22

def catenary(p0, p1, sag, n):
    p0, p1 = Vector(p0), Vector(p1)
    return [p0 + (p1 - p0) * (k / n) - Vector((0, sag * 4 * (k / n) * (1 - k / n), 0)) for k in range(n + 1)]

def build_extras():
    c = clear('sb-extras')
    wires = [catenary(LAMP_HEADS[0], (0, WALL_TOP + 0.05, -4.0), 0.9, 16), catenary(LAMP_HEADS[1], (0, WALL_TOP + 0.05, -4.0), 0.9, 16),
             catenary(LAMP_HEADS[0], LAMP_HEADS[1], 1.0, 24),
             catenary((-12.95, WALL_TOP + 0.4, -3.9), LAMP_HEADS[0], 0.4, 8), catenary((12.95, WALL_TOP + 0.4, -3.9), LAMP_HEADS[1], 0.4, 8)]
    lw = MB(); bl = MB()
    for w in wires:
        tube(lw, w, 0.012, 3, 'Wire')
        L = sum((b - a).length for a, b in zip(w, w[1:])); n = int(L / 0.55)
        for k in range(1, n):
            # walk along the polyline
            t = k / n * L; acc = 0.0
            for a, b in zip(w, w[1:]):
                seg = (b - a).length
                if acc + seg >= t:
                    p = a + (b - a) * ((t - acc) / seg); break
                acc += seg
            r = 0.045
            hull(bl, [(p.x + dx, p.y - 0.07 + dy, p.z + dz) for dx, dy, dz in ((r, 0, 0), (-r, 0, 0), (0, 0, r), (0, 0, -r), (0, r * 1.4, 0), (0, -r * 1.4, 0))], 'Bulb')
            prism(lw, (p.x, p.y, p.z), (p.x, p.y - 0.035, p.z), 0.015, 4, 'Wire', caps=(False, True))
    # bunting on the lamp-to-lamp wire: little triangles in the palette
    w = wires[2]; cols = ['Purple', 'Orange', 'Yellow', 'Cyan', 'Pink']
    for k in range(1, len(w) - 1):
        a, b = w[k], w[k + 1]
        m = (a + b) / 2
        lw.face([(a.x, a.y, a.z), (b.x, b.y, b.z), (m.x, m.y - 0.3, m.z)], cols[k % 5], (0, 0, 1))
        lw.face([(b.x, b.y, b.z), (a.x, a.y, a.z), (m.x, m.y - 0.3, m.z)], cols[k % 5], (0, 0, -1))
    build(lw, 'Lights', c); build(bl, 'Bulbs', c)
    # shot clock on the hoop pole, under the board, facing the court
    sc = MB(); PZ = -0.9
    bbox(sc, -0.24, 0.24, 1.62, 1.98, PZ + 0.08, PZ + 0.24, 0.02, 'Black')
    bbox(sc, -0.05, 0.05, 1.7, 1.9, PZ + 0.05, PZ + 0.09, 0.01, 'MetalDark')
    bbox(sc, -0.26, 0.26, 1.96, 2.0, PZ + 0.06, PZ + 0.3, 0.01, 'Orange')
    build(sc, 'ShotClock', c)
    fm = MB()
    fm.face([(-0.19, 1.67, PZ + 0.245), (0.19, 1.67, PZ + 0.245), (0.19, 1.93, PZ + 0.245), (-0.19, 1.93, PZ + 0.245)], 'ShotClockFace', (0, 0, 1),
            uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    build(fm, 'ShotClockFace', c)
    # a cooler by the bench, plants in pots by the wall, a ball on the right bleacher
    co = MB(); x, z = -8.35, 4.35
    bbox(co, x - 0.2, x + 0.2, 0.0, 0.34, z - 0.3, z + 0.3, 0.03, 'CoolerBlue', skip_down=True)
    bbox(co, x - 0.21, x + 0.21, 0.34, 0.4, z - 0.31, z + 0.31, 0.02, 'White')
    tube(co, [(x, 0.4, z - 0.22), (x, 0.47, z - 0.18), (x, 0.47, z + 0.18), (x, 0.4, z + 0.22)], 0.012, 4, 'White')
    build(co, 'Cooler', c, origin=(x, 0, z))
    pl = MB(); rnd = random.Random(5)
    for k, (x, z) in enumerate(((-5.2, -3.55), (-2.6, -3.6), (4.6, -3.55))):
        lathe(pl, [(0.18, 0.0), (0.24, 0.42), (0.27, 0.46), (0.27, 0.5)], 8, 'Terracotta', c=(x, 0, z))
        cap_disc(pl, (x, 0, z), 0.25, 8, 0.48, 'Trunk')
        for j in range(5):
            a = 2 * math.pi * j / 5 + rnd.uniform(0, 0.6); h = rnd.uniform(0.5, 0.85)
            tip = (x + 0.32 * math.cos(a), 0.48 + h, z + 0.32 * math.sin(a))
            base = [(x + 0.06 * math.cos(a + d), 0.48, z + 0.06 * math.sin(a + d)) for d in (-0.6, 0.6)]
            mid = (x + 0.22 * math.cos(a), 0.48 + h * 0.65, z + 0.22 * math.sin(a))
            hull(pl, base + [mid, tip, (mid[0], mid[1] + 0.05, mid[2])], 'Leaf' if j % 2 else 'Leaf2')
    build(pl, 'Plants', c)
    bb = MB(); basketball(bb, (10.65, 1.18 + 0.12, 10.6), 0.12, base=12, lats=(-50, 50), seam=0.05)
    build(bb, 'BleacherBall', c)
    # a bike leaning on the right fence, outside, near the camera end
    bk = MB(); bx, bz = 9.22, 13.6; lean = 0.18
    def P(u, v):     # u along the bike (z), v up; lean the frame toward +x (the fence)
        return (bx + v * lean, v, bz + u)
    for u in (-0.52, 0.52):
        pts = [P(u + 0.33 * math.cos(2 * math.pi * k / 14), 0.34 + 0.33 * math.sin(2 * math.pi * k / 14)) for k in range(14)]
        tube(bk, pts, 0.025, 4, 'Tire', closed=True)
        prism(bk, P(u - 0.05, 0.34), P(u + 0.05, 0.34), 0.03, 6, 'Metal')
    frame = [P(-0.52, 0.34), P(-0.05, 0.36), P(0.35, 0.78), P(-0.2, 0.8), P(-0.05, 0.36)]
    tube(bk, frame, 0.022, 4, 'Orange')
    tube(bk, [P(-0.2, 0.8), P(-0.52, 0.34)], 0.018, 4, 'Orange')
    tube(bk, [P(0.52, 0.34), P(0.35, 0.78), P(0.32, 0.98)], 0.02, 4, 'Orange')
    hb = P(0.32, 0.98); prism(bk, (hb[0] - 0.24, hb[1], hb[2]), (hb[0] + 0.24, hb[1], hb[2]), 0.016, 4, 'Black')
    st = P(-0.22, 0.92); bbox(bk, st[0] - 0.06, st[0] + 0.06, st[1], st[1] + 0.05, st[2] - 0.12, st[2] + 0.08, 0.015, 'Black')
    prism(bk, P(-0.2, 0.8), P(-0.22, 0.92), 0.012, 4, 'Metal')
    build(bk, 'Bike', c, origin=(bx, 0, bz))
    # pigeons on the wall coping
    for i, (x, rz) in enumerate(((-6.2, 0.4), (-5.55, -0.5), (3.9, 2.6), (7.3, -0.2))):
        bm_ = MB(); y = WALL_TOP; z = -4.1
        R = Matrix.Rotation(rz, 3, 'Y')
        def Q(p): return tuple(Vector((x, y, z)) + R @ Vector(p))
        hull(bm_, [Q(p) for p in ((0, 0.05, -0.1), (0.05, 0.08, -0.02), (-0.05, 0.08, -0.02), (0, 0.13, 0.0), (0, 0.04, 0.06), (0.04, 0.1, 0.05), (-0.04, 0.1, 0.05))], 'Pigeon')
        hull(bm_, [Q(p) for p in ((0, 0.12, 0.05), (0.03, 0.15, 0.07), (-0.03, 0.15, 0.07), (0, 0.19, 0.08), (0, 0.15, 0.11))], 'PigeonDark')
        hull(bm_, [Q(p) for p in ((0, 0.16, 0.11), (0.006, 0.165, 0.13), (-0.006, 0.165, 0.13), (0, 0.17, 0.11))], 'Orange')
        hull(bm_, [Q(p) for p in ((0.025, 0.06, -0.09), (-0.025, 0.06, -0.09), (0, 0.07, -0.17), (0, 0.09, -0.12))], 'PigeonDark')
        for sx in (-1, 1):
            prism(bm_, Q((sx * 0.02, 0.05, 0.01)), Q((sx * 0.02, 0.0, 0.02)), 0.006, 3, 'Orange', caps=(False, False))
        build(bm_, f'Bird{i + 1}', c, origin=(x, y, z))
    # decals: sneaker scuffs on the court, puddles on the apron
    dc = MB(); rnd = random.Random(9); Y = 0.028
    for k in range(9):
        cx, cz = rnd.uniform(-5, 5), rnd.uniform(1.5, 9.5); a = rnd.uniform(0, math.pi); L = rnd.uniform(0.3, 0.6)
        for j in range(2):
            o = j * 0.07
            d = Vector((math.cos(a), math.sin(a))); n = Vector((-d.y, d.x))
            p0 = Vector((cx, cz)) + n * o; p1 = p0 + d * L
            garc(dc, cx + n.x * o, cz + n.y * o, L, 0.025, a - 0.18, a + 0.18, 4, Y, 'Scuff')
    for k, (x, z, rx, rz) in enumerate(((-8.0, 13.6, 0.5, 0.32), (7.9, -1.0, 0.35, 0.45), (-6.4, -1.55, 0.7, 0.3))):
        gpoly(dc, blob_pts(x, z, rx, rz, 12, 40 + k, 0.2), Y, 'Puddle')
    build(dc, 'Decals', c)
    m = bpy.data.materials.get('Puddle')
    if m: m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.08
