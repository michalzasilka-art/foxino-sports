# ws-front: the foreground. Emblem (a round stone mosaic inlaid in the paving round the podiums, centre (1, 0.035, 15),
# radius 5.5: a lilac base, a gold border ring of slabs, a huge six-armed snowflake of white / cyan slabs, and five rings
# in a row in our colours in front of the podiums; flat layers at y 0.035 / 0.040 / 0.045, snow dust on its edge),
# Planters (two big snowy stone planters at (-7, 0, 20) and (8, 0, 19) with a small pine, a lantern post, presents and
# sports balls in the snow), Drifts (puffy snow along the paving's side edges, z 8..26).
PAL.update({'EmblemBase': '8d7cc9', 'EmblemBase2': 'aa9dd6', 'FlakeWhite': 'fbfaff', 'FlakeCyan': '62d2f4', 'Ribbon': 'ffcd1c'})
EX, EZ, ER = 1.0, 15.0, 5.5

def _ring_slabs(mb, cx, cz, r0, r1, n, y, mat, gap=0.03, a0=0.0):
    for k in range(n):
        a = a0 + 2 * math.pi * k / n; b = a0 + 2 * math.pi * (k + 1) / n
        ga = gap / r1
        pts = []
        for t in (a + ga, (a + b) / 2, b - ga):
            pts.append((cx + r1 * math.cos(t), cz + r1 * math.sin(t)))
        for t in (b - ga * r1 / r0, (a + b) / 2, a + ga * r1 / r0):
            pts.append((cx + r0 * math.cos(t), cz + r0 * math.sin(t)))
        gpoly(mb, pts, y, mat if isinstance(mat, str) else mat[k % len(mat)])

def _bar(mb, x0, z0, x1, z1, w, y, mat, gap=0.03, pieces=1, tip=False):
    d = Vector((x1 - x0, z1 - z0)); L = d.length; u = d / L; n = Vector((-u.y, u.x)) * (w / 2)
    for k in range(pieces):
        a = Vector((x0, z0)) + u * (L * k / pieces + gap); b = Vector((x0, z0)) + u * (L * (k + 1) / pieces - gap)
        if tip and k == pieces - 1:
            gpoly(mb, [tuple(a - n), tuple(b - n * 0.3), tuple(b + u * w * 0.9), tuple(b + n * 0.3), tuple(a + n)], y, mat)
        else:
            gpoly(mb, [tuple(a - n), tuple(b - n), tuple(b + n), tuple(a + n)], y, mat)

def emblem(mb):
    Y0, Y1, Y2 = 0.035, 0.040, 0.045
    n = 48
    gpoly(mb, [(EX + (ER - 0.3) * math.cos(2 * math.pi * k / n), EZ + (ER - 0.3) * math.sin(2 * math.pi * k / n)) for k in range(n)], Y0, 'EmblemBase')
    _ring_slabs(mb, EX, EZ, ER - 0.3, ER, 32, Y0, 'Gold')
    _ring_slabs(mb, EX, EZ, ER - 0.62, ER - 0.48, 32, Y1, 'StadiumPurple', a0=0.05)
    # the snowflake: six arms with side branches, a hexagon in the middle
    for k in range(6):
        a = math.pi / 2 + 2 * math.pi * k / 6; ca, sa = math.cos(a), math.sin(a)
        mat = 'FlakeWhite' if k % 2 == 0 else 'FlakeCyan'
        _bar(mb, EX + 0.75 * ca, EZ + 0.75 * sa, EX + 4.3 * ca, EZ + 4.3 * sa, 0.42, Y1, mat, pieces=4, tip=True)
        for r, L in ((2.0, 1.15), (3.1, 0.85)):
            bx, bz = EX + r * ca, EZ + r * sa
            for s in (-1, 1):
                b = a + s * math.radians(55)
                _bar(mb, bx + 0.15 * math.cos(b), bz + 0.15 * math.sin(b), bx + L * math.cos(b), bz + L * math.sin(b), 0.3, Y1,
                     'FlakeCyan' if mat == 'FlakeWhite' else 'FlakeWhite', pieces=1, tip=True)
    gpoly(mb, [(EX + 0.68 * math.cos(math.pi / 6 + 2 * math.pi * k / 6), EZ + 0.68 * math.sin(math.pi / 6 + 2 * math.pi * k / 6)) for k in range(6)], Y1, 'FlakeCyan')
    gpoly(mb, [(EX + 0.36 * math.cos(2 * math.pi * k / 6), EZ + 0.36 * math.sin(2 * math.pi * k / 6)) for k in range(6)], Y2, 'FlakeWhite')
    # five rings in a row, in front of the podiums (toward the camera)
    cols = ['RYellow', 'RPurple', 'RCyan', 'ROrange', 'RPink']; RZ = EZ + 3.05
    for i in range(5):
        cx = EX + (i - 2) * 1.02
        _ring_slabs(mb, cx, RZ, 0.38, 0.55, 10, Y2 + (0.002 if i % 2 else 0.0), cols[i], gap=0.02, a0=0.3 * i)
    # snow dust lying over the edge
    rnd = random.Random(12)
    for k in range(9):
        a = rnd.uniform(0, 2 * math.pi); r = ER - rnd.uniform(0.0, 0.4)
        x, z = EX + r * math.cos(a), EZ + r * math.sin(a)
        gpoly(mb, blob_pts(x, z, rnd.uniform(0.4, 0.9), rnd.uniform(0.25, 0.5), 9, 600 + k, 0.3), Y2 + 0.004, 'Snow')

def present(mb, x, z, s, col, ribbon, yaw=0.0):
    obox(mb, (x, z), yaw, s, s, 0.0, s * 0.85, 0.02, col)
    R = Ry(yaw)
    for d in (Vector((1, 0, 0)), Vector((0, 0, 1))):
        dd = R @ d; n = R @ Vector((-d.z, 0, d.x)) * 0.05 * s / 0.4
        p0 = Vector((x, s * 0.86, z)) - dd * s * 0.51; p1 = Vector((x, s * 0.86, z)) + dd * s * 0.51
        mb.face([p0 - n, p1 - n, p1 + n, p0 + n], ribbon, (0, 1, 0))
    hull(mb, [(x + a * 0.07 * s / 0.4, s * 0.86 + h, z + b * 0.07 * s / 0.4) for a in (-1, 1) for b in (-1, 1) for h in (0.0, 0.08 * s / 0.4)], ribbon)

def planter(mb, x, z, seed, balls):
    rnd = random.Random(seed)
    N = 8; rot = math.pi / 8
    lathe(mb, [(0.95, 0.0), (0.95, 0.08), (0.9, 0.12), (0.88, 0.62), (0.95, 0.66), (0.95, 0.78), (0.8, 0.8)], N, 'Stone', c=(x, 0, z), rot=rot,
          mats=['StoneDark', 'Stone', 'Stone', 'StoneDark', 'Stone', 'Stone'])
    lathe(mb, [(0.86, 0.36), (0.88, 0.44)], N, 'StadiumPurple', c=(x, 0, z), rot=rot)
    snowcap(mb, [(x + 0.97 * math.cos(rot + 2 * math.pi * k / N), z + 0.97 * math.sin(rot + 2 * math.pi * k / N)) for k in range(N)], 0.78, h=0.24, over=0.06, seed=seed)
    pine(mb, x + 0.1, z - 0.1, 2.8, seed=seed + 1, tiers=3, y=0.9)
    # a lantern post in the planter
    lantern(mb, x - 0.5, 0.95, z + 0.35, s=1.35, post=1.5)
    # presents and balls in the snow at its foot (toward the plaza)
    side = -1 if x > 0 else 1
    gx = x + side * 1.25
    present(mb, gx, z + 0.6, 0.42, 'RPink', 'Ribbon', 0.4)
    present(mb, gx + side * 0.25, z + 1.15, 0.32, 'RCyan', 'FlakeWhite', -0.3)
    present(mb, gx - side * 0.35, z + 1.0, 0.3, 'RPurple', 'Ribbon', 0.9)
    for k, (dx, dz, kind) in enumerate(balls):
        cx, cz = x + side * dx, z + dz
        if kind == 'basket':
            basketball(mb, (cx, 0.12, cz), 0.12, base=12, lats=(-50, 50), seam=0.05)
        else:
            pts = []
            for i in range(4):
                la = -math.pi / 2 + math.pi * i / 3
                for j in range(6 if 0 < i < 3 else 1):
                    a = 2 * math.pi * j / 6 + (0.5 if i % 2 else 0)
                    pts.append((cx + 0.11 * math.cos(la) * math.cos(a), 0.11 + 0.11 * math.sin(la), cz + 0.11 * math.cos(la) * math.sin(a)))
            hull(mb, pts, lambda n: 'Coal' if (abs(n.x) > 0.8 or abs(n.z) > 0.8) and n.y > -0.2 else 'FlagWhite')
    # a snow drift round the planter's foot
    snowcap(mb, [(x + 1.25 * math.cos(2 * math.pi * k / 9), z + 1.1 * math.sin(2 * math.pi * k / 9)) for k in range(9)], 0.0, h=0.3, over=0.2, seed=seed + 5)

def build_front():
    c = clear('ws-front')
    mb = MB(); emblem(mb); build_ws(mb, 'Emblem', c, jit=0.08, seed=41)
    mb = MB()
    planter(mb, -7.15, 20.0, 51, [(1.0, 1.5, 'foot'), (1.55, 0.35, 'basket')])
    planter(mb, 8.1, 19.0, 61, [(0.9, 1.55, 'basket'), (1.5, 0.3, 'foot')])
    build_ws(mb, 'Planters', c, jit=0.07, seed=42)
    mb = MB(); rnd = random.Random(70)
    for s in (-1, 1):
        z = 8.4
        while z < 26.0:
            L = rnd.uniform(1.4, 2.6); x0 = s * 6.85; w = rnd.uniform(0.9, 1.5); h = rnd.uniform(0.35, 0.6)
            if s < 0 and 18.5 < z < 21.5: z += L; continue
            if s > 0 and 17.5 < z < 20.5: z += L; continue
            pts = [(x0, 0, z), (x0, 0, z + L), (x0 + s * w, 0, z + 0.15), (x0 + s * w, 0, z + L - 0.1),
                   (x0 + s * w * 0.45, h, z + L * 0.35), (x0 + s * w * 0.55, h * rnd.uniform(0.75, 1.0), z + L * 0.7), (x0 + s * 0.1, h * 0.35, z + L * 0.5)]
            hull(mb, pts, snow_mat, skip_down=True); z += L * 0.8
    build_ws(mb, 'Drifts', c, jit=0.07, seed=43)
