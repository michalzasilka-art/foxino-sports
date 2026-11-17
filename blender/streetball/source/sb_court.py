# sb-court: the asphalt half-court. Slab x -8.5..8.5, z -2..15 (top y = 0) inside a chamfered concrete curb; the blue
# playing area x +-7.5, z 0..14 with white lines, a purple key with the free-throw circle, the orange 3-point arc
# (r 5.4 round the rim at z = 1.0), the half-court line with its half circle, a star badge and FOXINO painted on it,
# cracks and patches.
def build_court():
    c = clear('sb-court'); mb = MB()
    rnd = random.Random(11)
    # slab and curb
    grect(mb, -8.5, 8.5, -2.0, 15.0, 0.0, 'Asphalt')
    def curb_run(axis, fixed0, fixed1, a0, a1, n):
        for k in range(n):
            u0 = a0 + (a1 - a0) * k / n + 0.015; u1 = a0 + (a1 - a0) * (k + 1) / n - 0.015
            if axis == 'z': bbox(mb, fixed0, fixed1, -0.12, 0.12, u0, u1, 0.035, 'Curb', skip_down=True)
            else: bbox(mb, u0, u1, -0.12, 0.12, fixed0, fixed1, 0.035, 'Curb', skip_down=True)
    curb_run('z', -8.82, -8.5, -2.32, 15.32, 7); curb_run('z', 8.5, 8.82, -2.32, 15.32, 7)
    curb_run('x', -2.32, -2.0, -8.5, 8.5, 6); curb_run('x', 15.0, 15.32, -8.5, 8.5, 6)
    # asphalt patches on the apron, cracks
    for k, (x, z, rx, rz) in enumerate(((-8.0, 6.0, 0.4, 0.9), (7.95, 11.2, 0.45, 0.7), (-3.5, -1.4, 0.9, 0.4), (4.6, 14.55, 0.8, 0.35))):
        gpoly(mb, blob_pts(x, z, rx, rz, 9, 30 + k, 0.18), 0.003, 'AsphaltDark')
    grect(mb, -7.5, 7.5, 0.0, 14.0, 0.006, 'Court')
    # the key, the top of the key filled too
    grect(mb, -1.6, 1.6, 0.0, 4.6, 0.012, 'Key')
    gpoly(mb, [(1.6 * math.cos(math.pi * k / 16), 4.6 + 1.6 * math.sin(math.pi * k / 16)) for k in range(17)], 0.012, 'Key')
    W = 0.08; Y = 0.018
    for s in (-1, 1):
        grect(mb, s * 1.6 - W / 2, s * 1.6 + W / 2, 0.0, 4.6, Y, 'LineWhite')
        for zz in (1.7, 2.6, 3.5):      # lane hash marks
            x0, x1 = sorted((s * 1.6, s * 1.92)); grect(mb, x0, x1, zz - W / 2, zz + W / 2, Y, 'LineWhite')
        grect(mb, s * 7.5 - W / 2, s * 7.5 + W / 2, 0.0, 14.0, Y, 'LineWhite')     # sidelines
        x0, x1 = sorted((s * (5.4 - 0.05), s * (5.4 + 0.05))); grect(mb, x0, x1, 0.0, 1.0, Y, 'LineOrange')
    grect(mb, -1.6, 1.6, 4.6 - W / 2, 4.6 + W / 2, Y, 'LineWhite')
    garc(mb, 0, 4.6, 1.6, W, 0, math.pi, 12, Y, 'LineWhite')
    for k in range(6):                  # the dashed inner half of the free-throw circle
        a = math.pi + math.pi * (k + 0.25) / 6
        garc(mb, 0, 4.6, 1.6, W, a, a + math.pi / 12, 2, Y, 'LineWhite')
    garc(mb, 0, 1.0, 5.4, 0.1, 0, math.pi, 40, Y, 'LineOrange')        # the 3-point arc
    garc(mb, 0, 1.0, 1.25, 0.06, 0, math.pi, 12, Y, 'LineWhite')        # the no-charge arc under the rim
    grect(mb, -7.54, 7.54, -W / 2, W / 2, Y, 'LineWhite')               # baseline
    grect(mb, -7.54, 7.54, 14.0 - W / 2, 14.0 + W / 2, Y, 'LineWhite')  # half-court line
    gpoly(mb, [(1.8 * math.cos(math.pi + math.pi * k / 16), 14.0 + 1.8 * math.sin(math.pi + math.pi * k / 16)) for k in range(17)], 0.012, 'Purple')
    garc(mb, 0, 14.0, 1.8, W, math.pi, 2 * math.pi, 16, Y, 'LineWhite')
    # the star badge at mid-court: yellow ring, purple disc, yellow star
    BZ = 9.2
    garc(mb, 0, BZ, 1.62, 0.2, 0, 2 * math.pi, 28, 0.012, 'Yellow')
    gpoly(mb, [(1.52 * math.cos(2 * math.pi * k / 28), BZ + 1.52 * math.sin(2 * math.pi * k / 28)) for k in range(28)], 0.012, 'Purple')
    gpoly(mb, [(x, BZ - y) for x, y in star_pts(0, 0, 1.18, 0.5)], Y, 'Yellow')
    gpoly(mb, [(x, BZ - y) for x, y in star_pts(0, 0, 0.55, 0.23)], Y + 0.004, 'Orange')
    # FOXINO painted between the badge and the half-court line, upright for the camera
    for pts in text_polys('FOXINO', size=1.0, offset=0.025, shear=0.12, res=2):
        gpoly(mb, [(x, 12.0 - y) for x, y in pts], Y, 'White')
    # cracks
    for k in range(5):
        x, z = [(-6.2, 2.4), (5.9, 7.6), (-2.6, 11.4), (3.6, -1.2), (-7.9, 12.9)][k]
        a = rnd.uniform(0, math.pi); pts = [(x, z)]
        for j in range(5):
            a += rnd.uniform(-0.8, 0.8); L = rnd.uniform(0.25, 0.5)
            pts.append((min(8.3, max(-8.3, pts[-1][0] + L * math.cos(a))), min(14.8, max(-1.8, pts[-1][1] + L * math.sin(a)))))
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            if abs(x1 - x0) + abs(z1 - z0) < 0.02: continue
            d = Vector((x1 - x0, z1 - z0)).normalized(); nx, nz = -d.y * 0.018, d.x * 0.018
            gpoly(mb, [(x0 - nx, z0 - nz), (x1 - nx, z1 - nz), (x1 + nx, z1 + nz), (x0 + nx, z0 + nz)], 0.024, 'Crack')
    build(mb, 'Court', c)
