# sb-wall: the brick wall behind the hoop, front face z = -4.0, x -13..13, 6 m tall, with brick pilasters at the ends,
# a concrete coping and plinth; every brick is its own raised face over the mortar. On it: a big FOXINO graffiti
# (dark shadow, cream outline, bright letters) on a purple / pink / cyan spray cloud with drips, tags (a star, a heart,
# "1 ON 1", a crown, an arrow), a steel door with a lamp and step, drainpipes with brackets, an electric box.
WZ = -4.0; WX = 13.0; WH = 6.0

def _inside(px, py, poly):
    ins = False; n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0): ins = not ins
    return ins

def build_wall():
    c = clear('sb-wall'); mb = MB(); rnd = random.Random(7)
    zf = WZ + 0.012
    # the cloud behind the letters (kept as the no-brick zone)
    cloud = blob_pts(0.0, 3.05, 9.3, 2.2, 26, 5, 0.12)
    blobs = [(cloud, 'Purple'), (blob_pts(-6.6, 4.3, 2.6, 1.5, 14, 8, 0.2), 'Pink'), (blob_pts(6.9, 2.1, 2.7, 1.4, 14, 9, 0.2), 'Cyan'),
             (blob_pts(2.4, 4.9, 2.0, 1.0, 12, 12, 0.2), 'Pink')]
    # mortar face and bricks (running bond), not under the cloud
    wpoly(mb, [(-WX, 0.3), (WX, 0.3), (WX, WH), (-WX, WH)], WZ - 0.03, 'Mortar')
    BW, BH, G = 0.9, 0.36, 0.05
    nrow = int((WH - 0.3) / (BH + G))
    for r in range(nrow):
        y0 = 0.3 + G / 2 + r * (BH + G); y1 = y0 + BH
        x = -WX + G / 2 - (BW / 2 if r % 2 else 0)
        while x < WX:
            x0, x1 = max(x, -WX + G / 2), min(x + BW, WX - G / 2)
            if x1 - x0 > 0.15:
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                if not all(_inside(px, py, cloud) for px, py in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))) and not (9.95 < cx < 11.25 and cy < 2.55):
                    wpoly(mb, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], WZ, rnd.choice(('Brick1', 'Brick1', 'Brick2', 'Brick3')))
            x += BW + G
    # plinth, coping, end pilasters
    bbox(mb, -WX, WX, 0.0, 0.32, WZ - 0.1, WZ + 0.06, 0.03, 'ConcreteDark', skip_down=True)
    bbox(mb, -WX - 0.15, WX + 0.15, WH, WH + 0.2, WZ - 0.5, WZ + 0.12, 0.04, 'Concrete')
    for s in (-1, 1):
        x0, x1 = sorted((s * (WX - 0.35), s * (WX + 0.45)))
        bbox(mb, x0, x1, 0.0, WH + 0.35, WZ - 0.55, WZ + 0.25, 0.04, 'Brick2', skip_down=True)
        bbox(mb, x0 - 0.08, x1 + 0.08, WH + 0.35, WH + 0.55, WZ - 0.63, WZ + 0.33, 0.04, 'Concrete')
    # graffiti: clouds, drips
    for k, (pts, col) in enumerate(blobs):
        wpoly(mb, pts, zf + 0.008 * k, col)
    for k in range(14):
        x = rnd.uniform(-8.6, 8.6); col = rnd.choice(('Purple', 'Purple', 'Pink', 'Cyan'))
        ytop = 1.15 + rnd.uniform(0, 0.3); L = rnd.uniform(0.35, 0.9); w = rnd.uniform(0.05, 0.09)
        wpoly(mb, [(x - w / 2, ytop - L), (x + w / 2, ytop - L), (x + w / 2, ytop + 0.3), (x - w / 2, ytop + 0.3)], zf, col)
        cap_pts = [(x + w * 0.75 * math.cos(2 * math.pi * j / 6), ytop - L + w * 0.75 * math.sin(2 * math.pi * j / 6)) for j in range(6)]
        wpoly(mb, cap_pts, zf, col)
    # FOXINO letters, each with a shadow, a cream outline and a bright fill, bouncing a little
    letters = 'FOXINO'; cols = ['Orange', 'Yellow', 'Pink', 'Cyan', 'Orange', 'Yellow']
    S = 2.7; xs = [-6.5, -3.9, -1.35, 0.6, 2.75, 5.6]
    for i, ch in enumerate(letters):
        ang = math.radians((-6, 4, -3, 5, -4, 6)[i]); dy = (0.15, -0.1, 0.2, -0.05, 0.12, -0.12)[i]
        R = Matrix.Rotation(ang, 2)
        def place(pts, ox=0.0, oy=0.0):
            return [tuple(Vector((xs[i] + ox, 2.0 + dy + oy)) + R @ Vector(p)) for p in pts]
        for pts in text_polys(ch, size=S, offset=0.2, shear=0.12, res=3):
            wpoly(mb, place(pts, 0.17, -0.17), zf + 0.04, 'PurpleDark')
        for pts in text_polys(ch, size=S, offset=0.2, shear=0.12, res=3):
            wpoly(mb, place(pts), zf + 0.05, 'Cream')
        for pts in text_polys(ch, size=S, offset=0.06, shear=0.12, res=3):
            wpoly(mb, place(pts), zf + 0.06, cols[i])
    wpoly(mb, star_pts(-10.6, 4.6, 0.75, 0.32, rot=math.pi / 2 + 0.2), zf, 'Yellow')
    wpoly(mb, star_pts(9.4, 5.15, 0.45, 0.19), zf, 'Pink')
    heart = [(math.sin(t) ** 3, (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 16) for t in [2 * math.pi * k / 20 for k in range(20)]]
    wpoly(mb, [(11.6 + 0.55 * x, 4.0 + 0.55 * y) for x, y in heart], zf, 'Pink')
    wpoly(mb, blob_pts(-10.5, 2.2, 1.35, 0.75, 12, 21, 0.15), zf, 'Cyan')
    for pts in text_polys('1 ON 1', size=0.62, offset=0.03, shear=0.2, res=2):
        wpoly(mb, [(x - 10.5, y + 1.98) for x, y in pts], zf + 0.01, 'White')
    crown = [(-0.5, 0), (0.5, 0), (0.6, 0.55), (0.3, 0.25), (0.0, 0.62), (-0.3, 0.25), (-0.6, 0.55)]
    wpoly(mb, [(-11.6 + x, 3.4 + y) for x, y in crown], zf, 'Yellow')
    arrow = [(0, -0.08), (1.1, -0.08), (1.1, -0.28), (1.5, 0.0), (1.1, 0.28), (1.1, 0.08), (0, 0.08)]
    wpoly(mb, [(7.6 + x, 5.35 + y) for x, y in arrow], zf, 'Yellow')
    # the door at x 10.6: frame, steel door with panels and a handle, a lamp, a step
    DX = 10.6
    for x0, x1, y0, y1 in ((DX - 0.68, DX - 0.55, 0.0, 2.45), (DX + 0.55, DX + 0.68, 0.0, 2.45), (DX - 0.68, DX + 0.68, 2.32, 2.5)):
        bbox(mb, x0, x1, y0, y1, WZ - 0.05, WZ + 0.08, 0.02, 'Concrete', skip_down=True)
    wpoly(mb, [(DX - 0.55, 0.12), (DX + 0.55, 0.12), (DX + 0.55, 2.32), (DX - 0.55, 2.32)], WZ - 0.02, 'Door')
    for y0 in (0.35, 1.35):
        bbox(mb, DX - 0.42, DX + 0.42, y0, y0 + 0.8, WZ - 0.02, WZ + 0.01, 0.01, 'Door')
    prism(mb, (DX + 0.4, 1.12, WZ - 0.02), (DX + 0.4, 1.12, WZ + 0.06), 0.03, 6, 'Metal')
    bbox(mb, DX + 0.3, DX + 0.48, 1.09, 1.15, WZ + 0.04, WZ + 0.08, 0.01, 'Metal')
    bbox(mb, DX - 0.8, DX + 0.8, 0.0, 0.14, WZ, WZ + 0.45, 0.025, 'Concrete', skip_down=True)
    bbox(mb, DX - 0.14, DX + 0.14, 2.62, 2.8, WZ, WZ + 0.12, 0.02, 'MetalDark')
    hull(mb, [(DX + sx * 0.11, 2.62, WZ + 0.12 + sz * 0.1) for sx in (-1, 1) for sz in (0, 1)] + [(DX + sx * 0.08, 2.5, WZ + 0.14 + sz * 0.07) for sx in (-1, 1) for sz in (0, 1)], 'Glow')
    # drainpipes with brackets and elbows
    for x in (-12.1, 12.05):
        tube(mb, [(x, WH + 0.05, WZ - 0.3), (x, WH - 0.05, WZ + 0.12), (x, 0.45, WZ + 0.12), (x, 0.22, WZ + 0.3), (x + (0.3 if x < 0 else -0.3), 0.1, WZ + 0.45)], 0.07, 6, 'MetalDark', caps=(False, True))
        for y in (1.2, 2.7, 4.2, 5.4):
            bbox(mb, x - 0.1, x + 0.1, y - 0.04, y + 0.04, WZ, WZ + 0.2, 0.01, 'Metal')
    tube(mb, [(-12.1, 5.35, WZ + 0.12), (-8.6, 5.35, WZ + 0.12), (-8.4, 5.15, WZ + 0.12), (-8.4, 4.5, WZ + 0.12)], 0.05, 6, 'MetalDark', caps=(False, True))
    # electric box with a lightning sticker
    bbox(mb, -8.75, -8.15, 0.9, 1.75, WZ, WZ + 0.22, 0.02, 'Metal')
    wpoly(mb, [(-8.47, 1.62), (-8.62, 1.3), (-8.48, 1.32), (-8.56, 1.03), (-8.3, 1.4), (-8.44, 1.38), (-8.33, 1.62)], WZ + 0.222, 'Yellow')
    build(mb, 'Wall', c)
