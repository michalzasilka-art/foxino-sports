# sb-bleachers: two 4-row metal bleachers outside the side fences (inner edge x = +-9.5, z 4..12), facing the court.
# Coloured seat planks (cyan, yellow, orange, purple from the front), footboards, steel frames every ~1.9 m, a guard
# rail round the back and ends, a purple "GO FOXINO" skirt on the front. Seat.000..019 (left, x < 0) and
# Seat.020..039 (right): empties on the seat tops, 5 per row, front row first, z ascending; each one's local +z
# (glTF) points at the court.
BL_X = 9.5; BZ0, BZ1 = 4.0, 12.0
ROWS = [(0.42 + 0.38 * i, 0.3 + 0.55 * i) for i in range(4)]       # (seat top y, distance out from x = 9.5)
ROWCOL = ['Cyan', 'Yellow', 'Orange', 'Purple']

def build_bleachers():
    c = clear('sb-bleachers'); mb = MB()
    seat_no = 0
    for s in (-1, 1):
        X = lambda u: s * (BL_X + u)
        def bx(u0, u1, y0, y1, z0, z1, b, mat, sd=False):
            xa, xb = sorted((X(u0), X(u1))); bbox(mb, xa, xb, y0, y1, z0, z1, b, mat, skip_down=sd)
        for i, (ys, u) in enumerate(ROWS):
            bx(u - 0.17, u + 0.17, ys - 0.06, ys, BZ0 + 0.05, BZ1 - 0.05, 0.02, ROWCOL[i])
            if i > 0:
                bx(u - 0.5, u - 0.24, ys - 0.42, ys - 0.38, BZ0 + 0.05, BZ1 - 0.05, 0.012, 'Metal')
        # frames: a stringer up the slope, legs under each seat, a foot rail
        fz = [BZ0 + 0.15 + (BZ1 - BZ0 - 0.3) * k / 4 for k in range(5)]
        for z in fz:
            tube(mb, [(X(0.05), 0.0, z), (X(ROWS[-1][1] + 0.2), ROWS[-1][0] - 0.07, z)], 0.04, 4, 'MetalDark', caps=(False, True), rot=0)
            for ys, u in ROWS:
                prism(mb, (X(u), 0.0, z), (X(u), ys - 0.06, z), 0.03, 4, 'MetalDark', caps=(False, False))
            prism(mb, (X(ROWS[-1][1] + 0.3), 0.0, z), (X(ROWS[-1][1] + 0.3), ROWS[-1][0] + 0.95, z), 0.03, 4, 'Metal', caps=(False, True))
        prism(mb, (X(0.05), 0.03, BZ0), (X(0.05), 0.03, BZ1), 0.03, 4, 'MetalDark')
        prism(mb, (X(ROWS[-1][1] + 0.3), 0.03, BZ0), (X(ROWS[-1][1] + 0.3), 0.03, BZ1), 0.03, 4, 'MetalDark')
        # guard rail: back (top and middle), ends following the slope
        topy = ROWS[-1][0] + 0.95; ub = ROWS[-1][1] + 0.3
        for y in (topy, topy - 0.45):
            prism(mb, (X(ub), y, BZ0 + 0.15), (X(ub), y, BZ1 - 0.15), 0.035, 6, 'Metal', caps=(True, True))
        for z in (BZ0 + 0.15, BZ1 - 0.15):
            tube(mb, [(X(ROWS[0][1]), ROWS[0][0] + 0.85, z), (X(ub), topy, z)], 0.03, 6, 'Metal', caps=(True, True))
            prism(mb, (X(ROWS[0][1]), ROWS[0][0], z), (X(ROWS[0][1]), ROWS[0][0] + 0.85, z), 0.03, 6, 'Metal', caps=(False, False))
        # the front skirt with GO FOXINO
        sk = MB()
        nx = -s
        sk.face([(X(0.0), 0.04, BZ0 + 0.1), (X(0.0), 0.04, BZ1 - 0.1), (X(0.0), 0.36, BZ1 - 0.1), (X(0.0), 0.36, BZ0 + 0.1)], 'Purple', (nx, 0, 0))
        for pts in text_polys('GO FOXINO', size=0.26, offset=0.012, res=2):
            sk.face([(X(-0.005), y + 0.11, (BZ0 + BZ1) / 2 + s * x) for x, y in pts], 'Yellow', (nx, 0, 0))
        for k in range(len(sk.f)):
            mb.face([sk.v[i] for i in sk.f[k]], sk.m[k], (nx, 0, 0))
        # seat spots
        for i, (ys, u) in enumerate(ROWS):
            for z in (BZ0 + 0.9, BZ0 + 2.45, BZ0 + 4.0, BZ0 + 5.55, BZ0 + 7.1):
                empty('Seat.%03d' % seat_no, c, (X(u), ys, z), yaw=(math.pi / 2 if s < 0 else -math.pi / 2))
                seat_no += 1
    build(mb, 'Bleachers', c)
