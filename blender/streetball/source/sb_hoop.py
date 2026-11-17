# sb-hoop: the kid-size hoop. Rim centre (0, 2.6, 1.0), inner radius 0.23; backboard front plane z = 0.6 (x +-0.75,
# y 2.35..3.35); the pole behind the baseline at z = -0.9 with a gooseneck. Objects: Hoop (pole, pad, arm, board),
# Rim (the ring and its bracket) and Net (a diamond lattice of strands), Rim and Net with their origin at the rim centre.
RIM = (0.0, 2.6, 1.0)

def build_hoop():
    c = clear('sb-hoop'); mb = MB()
    PZ = -0.9
    # base plate with bolts, pole with the gooseneck
    bbox(mb, -0.28, 0.28, 0.0, 0.05, PZ - 0.28, PZ + 0.28, 0.015, 'MetalDark', skip_down=True)
    for sx in (-1, 1):
        for sz in (-1, 1):
            prism(mb, (sx * 0.2, 0.05, PZ + sz * 0.2), (sx * 0.2, 0.09, PZ + sz * 0.2), 0.025, 6, 'Metal', caps=(False, True))
    path = [(0, 0.04, PZ), (0, 2.3, PZ), (0, 2.6, PZ), (0, 2.78, PZ + 0.04), (0, 2.88, PZ + 0.15), (0, 2.92, PZ + 0.32), (0, 2.92, 0.52)]
    tube(mb, path, 0.075, 8, 'PurpleDark', caps=(False, True))
    tube(mb, [(0, 2.05, PZ + 0.03), (0, 2.88, 0.1)], 0.035, 6, 'PurpleDark', caps=(True, True))     # the brace
    bbox(mb, -0.3, 0.3, 2.62, 3.12, 0.49, 0.545, 0.01, 'PurpleDark')                                   # board mount
    # the foam pad round the pole: purple with yellow bands
    lathe(mb, [(0.13, 0.05), (0.17, 0.1), (0.17, 1.42), (0.13, 1.5), (0.075, 1.5)], 8, 'Purple', c=(0, 0, PZ),
          mats=['Purple', 'Purple', 'Purple', 'Purple'])
    for y0 in (0.34, 1.12):
        lathe(mb, [(0.175, y0), (0.175, y0 + 0.12)], 8, 'Yellow', c=(0, 0, PZ))
        cap_disc(mb, (0, 0, PZ), 0.175, 8, y0 + 0.12, 'Yellow'); cap_disc(mb, (0, 0, PZ), 0.175, 8, y0, 'Yellow', up=False)
    # backboard: white body, orange border, purple bottom pad, orange shooter's square, "fugio" on top
    bbox(mb, -0.75, 0.75, 2.35, 3.35, 0.54, 0.6, 0.02, 'White')
    F = 0.615; B = 0.055
    for x0, x1, y0, y1 in ((-0.75, 0.75, 3.35 - B, 3.35), (-0.75, 0.75, 2.35, 2.35 + B), (-0.75, -0.75 + B, 2.35, 3.35), (0.75 - B, 0.75, 2.35, 3.35)):
        bbox(mb, x0, x1, y0, y1, 0.585, F, 0.008, 'Orange')
    bbox(mb, -0.78, 0.78, 2.28, 2.4, 0.5, 0.66, 0.03, 'Purple')
    S = 0.045
    for x0, x1, y0, y1 in ((-0.26, 0.26, 3.02 - S, 3.02), (-0.26, 0.26, 2.64, 2.64 + S), (-0.26, -0.26 + S, 2.64, 3.02), (0.26 - S, 0.26, 2.64, 3.02)):
        wpoly(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 0.603, 'Orange')
    for pts in text_polys('fugio', size=0.2, offset=0.008, res=2):
        wpoly(mb, [(x, y + 3.1) for x, y in pts], 0.603, 'Purple')
    build(mb, 'Hoop', c)

    # Rim: a torus (16 x 6) and its bracket to the board
    rm = MB(); cx, cy, cz = RIM; R = 0.23 + 0.018
    tube(rm, [(cx + R * math.cos(2 * math.pi * k / 16), cy, cz + R * math.sin(2 * math.pi * k / 16)) for k in range(16)], 0.018, 6, 'Orange', closed=True)
    bbox(rm, -0.12, 0.12, 2.5, 2.7, 0.6, 0.63, 0.01, 'Orange')
    bbox(rm, -0.07, 0.07, 2.575, 2.61, 0.62, cz - R + 0.01, 0.008, 'Orange')
    for sx in (-1, 1):
        tube(rm, [(sx * 0.08, 2.51, 0.625), (sx * 0.06, 2.585, cz - R + 0.015)], 0.012, 4, 'Orange')
    for k in range(12):                 # little hooks under the rim
        a = 2 * math.pi * (k + 0.5) / 12
        p = (cx + 0.235 * math.cos(a), cy - 0.025, cz + 0.235 * math.sin(a))
        prism(rm, p, (p[0], p[1] - 0.035, p[2]), 0.007, 3, 'Orange', caps=(False, True))
    build(rm, 'Rim', c, origin=RIM)

    # Net: a diamond lattice, 12 strands round, 4 rows down, tapering
    nm = MB()
    rows = [(0.0, 0.232), (-0.13, 0.21), (-0.26, 0.185), (-0.38, 0.165), (-0.48, 0.155)]
    pts = []
    for i, (dy, r) in enumerate(rows):
        off = (0.5 * (i % 2)) * 2 * math.pi / 12 + math.pi / 12
        pts.append([Vector((cx + r * math.cos(off + 2 * math.pi * k / 12), cy - 0.03 + dy, cz + r * math.sin(off + 2 * math.pi * k / 12))) for k in range(12)])
    for i in range(len(rows) - 1):
        for k in range(12):
            a = pts[i][k]
            for b in (pts[i + 1][k], pts[i + 1][(k - 1) % 12] if i % 2 == 0 else pts[i + 1][(k + 1) % 12]):
                prism(nm, a, b, 0.0065, 3, 'Net', caps=(False, False))
    build(nm, 'Net', c, origin=RIM)
