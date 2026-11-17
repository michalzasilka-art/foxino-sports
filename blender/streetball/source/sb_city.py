# sb-city: the backdrop. Ground (sidewalks round the court, side streets x +-14.5..20.5, a cross street in front of the
# side blocks, a far ground plane), seven apartment blocks behind the wall and to the sides (z -7 .. -36, x -42 .. 41)
# in warm colours with framed windows (some lit), floor bands and cornices, shops with striped awnings on the side
# blocks, fire escapes, roof water tanks, AC units and bulkheads, a "fugio.co" billboard on the block behind the
# hoop, and street trees. Objects: Ground, Buildings, Billboard, Trees.

def _L(o, r, u, n, a, b, d):
    return o + r * a + u * b + n * d

def fquad(mb, o, r, u, n, a0, a1, b0, b1, d, mat):
    mb.face([_L(o, r, u, n, a0, b0, d), _L(o, r, u, n, a1, b0, d), _L(o, r, u, n, a1, b1, d), _L(o, r, u, n, a0, b1, d)], mat, n)

def fbox(mb, o, r, u, n, a0, a1, b0, b1, d0, d1, mat, bottom=False):
    """A box standing out of a facade: front + sides (+ bottom), no back."""
    P = lambda a, b, d: _L(o, r, u, n, a, b, d)
    mb.face([P(a0, b0, d1), P(a1, b0, d1), P(a1, b1, d1), P(a0, b1, d1)], mat, n)
    mb.face([P(a0, b1, d0), P(a1, b1, d0), P(a1, b1, d1), P(a0, b1, d1)], mat, u)
    mb.face([P(a0, b0, d0), P(a0, b0, d1), P(a0, b1, d1), P(a0, b1, d0)], mat, -r)
    mb.face([P(a1, b0, d0), P(a1, b1, d0), P(a1, b1, d1), P(a1, b0, d1)], mat, r)
    if bottom: mb.face([P(a0, b0, d0), P(a1, b0, d0), P(a1, b0, d1), P(a0, b0, d1)], mat, -u)

def window(mb, o, r, u, n, a, b, w, h, rnd, lit=0.15):
    fbox(mb, o, r, u, n, a - w / 2 - 0.12, a + w / 2 + 0.12, b - 0.12, b + h + 0.1, 0.0, 0.07, 'Trim')
    fquad(mb, o, r, u, n, a - w / 2, a + w / 2, b, b + h, 0.075, 'WinLit' if rnd.random() < lit else 'WinGlass')
    fquad(mb, o, r, u, n, a - 0.035, a + 0.035, b, b + h, 0.08, 'Trim')
    fquad(mb, o, r, u, n, a - w / 2, a + w / 2, b + h * 0.62, b + h * 0.62 + 0.06, 0.081, 'Trim')
    fbox(mb, o, r, u, n, a - w / 2 - 0.2, a + w / 2 + 0.2, b - 0.24, b - 0.12, 0.0, 0.2, 'Trim', bottom=True)

def ac_unit(mb, o, r, u, n, a, b):
    fbox(mb, o, r, u, n, a - 0.4, a + 0.4, b, b + 0.55, 0.0, 0.5, 'Metal', bottom=True)
    fquad(mb, o, r, u, n, a - 0.3, a + 0.3, b + 0.08, b + 0.47, 0.505, 'MetalDark')

def awning(mb, o, r, u, n, a0, a1, b, cols):
    k = 6; out = 1.1; drop = 0.6
    for i in range(k):
        x0 = a0 + (a1 - a0) * i / k; x1 = a0 + (a1 - a0) * (i + 1) / k; m = cols[i % 2]
        mb.face([_L(o, r, u, n, x0, b, 0.05), _L(o, r, u, n, x1, b, 0.05), _L(o, r, u, n, x1, b - drop, out), _L(o, r, u, n, x0, b - drop, out)], m, n + u)
        mb.face([_L(o, r, u, n, x0, b - drop, out), _L(o, r, u, n, x1, b - drop, out), _L(o, r, u, n, x1, b - drop - 0.28, out), _L(o, r, u, n, x0, b - drop - 0.28, out)], m, n)
    for a in (a0, a1):
        mb.face([_L(o, r, u, n, a, b, 0.05), _L(o, r, u, n, a, b - drop, out), _L(o, r, u, n, a, b - drop - 0.28, out)], cols[0], r * (1 if a == a1 else -1))

def shopfront(mb, o, r, u, n, a0, a1, rnd, sign, cols):
    W = a1 - a0; k = max(1, int(W / 4.5))
    for i in range(k):
        s0 = a0 + W * i / k + 0.35; s1 = a0 + W * (i + 1) / k - 0.35
        fbox(mb, o, r, u, n, s0 - 0.12, s1 + 0.12, 0.25, 2.75, 0.0, 0.08, 'Trim')
        dw = 1.0 if i == k // 2 else 0
        if dw:
            fquad(mb, o, r, u, n, s0, s0 + dw, 0.25, 2.5, 0.085, 'Door')
            fquad(mb, o, r, u, n, s0 + dw + 0.1, s1, 0.7, 2.5, 0.085, 'Glass')
        else:
            fquad(mb, o, r, u, n, s0, s1, 0.7, 2.5, 0.085, 'Glass')
    fbox(mb, o, r, u, n, a0 + 0.2, a1 - 0.2, 2.85, 3.3, 0.0, 0.14, sign, bottom=True)
    awning(mb, o, r, u, n, a0 + 0.4, a1 - 0.4, 2.8, cols)

def fire_escape(mb, o, r, u, n, a0, a1, floors):
    for f in range(1, floors):
        y = 3.4 + 3.0 * (f - 1) - 0.1
        fbox(mb, o, r, u, n, a0, a1, y, y + 0.08, 0.0, 1.1, 'MetalDark', bottom=True)
        for a in (a0, a1):
            p0 = _L(o, r, u, n, a, y + 0.08, 1.08); prism(mb, p0, p0 + u * 1.0, 0.025, 4, 'MetalDark', caps=(False, True))
        p0 = _L(o, r, u, n, a0, y + 1.05, 1.08); p1 = _L(o, r, u, n, a1, y + 1.05, 1.08)
        prism(mb, p0, p1, 0.03, 4, 'MetalDark'); prism(mb, p0 - u * 0.5, p1 - u * 0.5, 0.018, 4, 'MetalDark')
        if f < floors - 1:     # the ladder up to the next landing
            for d in (0.25, 0.65):
                prism(mb, _L(o, r, u, n, a1 - 0.5, y + 0.08, d), _L(o, r, u, n, a0 + 0.5, y + 3.0, d), 0.03, 4, 'MetalDark')

def water_tank(mb, x, y, z, rad=1.0):
    for sx in (-1, 1):
        for sz in (-1, 1):
            prism(mb, (x + sx * rad * 0.6, y, z + sz * rad * 0.6), (x + sx * rad * 0.6, y + 1.2, z + sz * rad * 0.6), 0.07, 4, 'MetalDark', caps=(False, False))
    lathe(mb, [(rad * 0.95, y + 1.2), (rad, y + 1.35), (rad, y + 3.2), (rad * 1.12, y + 3.25), (0.08, y + 4.2), (0, y + 4.35)], 8, 'Tank', c=(x, 0, z),
          mats=['Tank', 'Tank', 'Roof', 'Roof', 'Roof'])
    cap_disc(mb, (x, 0, z), rad * 0.95, 8, y + 1.2, 'Tank', up=False)
    for yy in (y + 1.8, y + 2.6):
        lathe(mb, [(rad + 0.03, yy), (rad + 0.03, yy + 0.08)], 8, 'MetalDark', c=(x, 0, z))

def tree(mb, x, z, h, seed):
    rnd = random.Random(seed)
    bbox(mb, x - 0.55, x + 0.55, -0.02, 0.08, z - 0.55, z + 0.55, 0.03, 'ConcreteDark', skip_down=True)
    prism(mb, (x, 0.05, z), (x + 0.05, h * 0.55, z), 0.13, 5, 'Trunk', caps=(False, False), r1=0.09)
    for k in range(3):
        cx = x + rnd.uniform(-0.6, 0.6); cy = h * (0.62 + 0.13 * k); cz = z + rnd.uniform(-0.5, 0.5); R = h * (0.27 - 0.04 * k)
        pts = []
        for j in range(11):
            t = rnd.uniform(0, 2 * math.pi); p = rnd.uniform(-1, 1); q = math.sqrt(1 - p * p)
            pts.append((cx + R * q * math.cos(t), cy + R * p * 0.85, cz + R * q * math.sin(t)))
        hull(mb, pts, 'Leaf' if k != 1 else 'Leaf2')

BLOCKS = [  # x0, x1, z0 (back), z1 (front), floors, colour, extras
    dict(x0=-11.5, x1=-1.2, z0=-20.0, z1=-7.0, fl=6, col='Bld1', seed=1, ac=3),
    dict(x0=0.0, x1=12.5, z0=-20.0, z1=-7.5, fl=2, col='Bld2', seed=2, bill=True),
    dict(x0=8.0, x1=20.0, z0=-40.0, z1=-27.0, fl=7, col='Bld8', seed=8, tank=(15.0, -33.0)),
    dict(x0=-7.0, x1=7.0, z0=-36.0, z1=-24.0, fl=9, col='Bld7', seed=3, tank=(-3.5, -29.0)),
    dict(x0=-28.0, x1=-14.0, z0=-24.0, z1=-10.5, fl=4, col='Bld3', seed=4, shop=('Yellow', ('Awning1', 'White')), fire=(-25.0, -20.5)),
    dict(x0=14.0, x1=27.0, z0=-24.0, z1=-10.5, fl=5, col='Bld4', seed=5, shop=('Cyan', ('Awning2', 'White')), tank=(22.5, -17.0)),
    dict(x0=-42.0, x1=-29.0, z0=-28.0, z1=-10.5, fl=7, col='Bld5', seed=6, shop=('Pink', ('Orange', 'White')), tank=(-36.0, -19.0)),
    dict(x0=28.0, x1=41.0, z0=-30.0, z1=-10.5, fl=6, col='Bld6', seed=7, shop=('Purple', ('Awning1', 'Yellow')), fire=(35.5, 39.5), ac=2),
]

def block(mb, B):
    rnd = random.Random(B['seed'] * 13)
    x0, x1, z0, z1, fl, col = B['x0'], B['x1'], B['z0'], B['z1'], B['fl'], B['col']
    H = 3.4 + 3.0 * (fl - 1)
    box(mb, x0, x1, 0.0, H, z0, z1, {'top': 'Roof', 'px': col, 'nx': col, 'pz': col, 'bot': col, 'nz': col}, skip=('bot', 'nz'))
    # cornice / parapet, floor bands
    for xa, xb, za, zb in ((x0 - 0.25, x1 + 0.25, z1 - 0.35, z1 + 0.25), (x0 - 0.25, x0 + 0.35, z0, z1 - 0.35), (x1 - 0.35, x1 + 0.25, z0, z1 - 0.35)):
        box(mb, xa, xb, H - 0.25, H + 0.7, za, zb, 'Trim', skip=('nz',))
    up = Vector((0, 1, 0))
    faces = [(Vector((0, 0, z1)), Vector((1, 0, 0)), Vector((0, 0, 1)), x0, x1, True)]
    inner = 'px' if (x0 + x1) < 0 else 'nx'
    if inner == 'px': faces.append((Vector((x1, 0, 0)), Vector((0, 0, -1)), Vector((1, 0, 0)), -z1, -z0, False))
    else: faces.append((Vector((x0, 0, 0)), Vector((0, 0, 1)), Vector((-1, 0, 0)), z0, z1, False))
    for k, (o, r, n, a0, a1, front) in enumerate(faces):
        for f in range(1, fl):
            yb = 3.4 + 3.0 * (f - 1) - 0.12
            fbox(mb, o, r, up, n, a0 - 0.02, a1 + 0.02, yb, yb + 0.16, 0.0, 0.08, 'Trim', bottom=True)
        W = a1 - a0; nw = max(1, int(W / 2.7)); wins = [a0 + W * (i + 0.5) / nw for i in range(nw)]
        for f in range(1, fl):
            for i, a in enumerate(wins):
                window(mb, o, r, up, n, a, 3.4 + 3.0 * (f - 1) + 0.75, 1.15, 1.55, rnd)
                if B.get('ac') and front and rnd.random() < 0.12 * B['ac'] and f < fl - 1:
                    ac_unit(mb, o, r, up, n, a + 0.95, 3.4 + 3.0 * (f - 1) + 0.25)
        if front and B.get('shop'):
            shopfront(mb, o, r, up, n, a0 + 0.3, a1 - 0.3, rnd, B['shop'][0], B['shop'][1])
        elif front:
            for i, a in enumerate(wins):
                window(mb, o, r, up, n, a, 0.95, 1.15, 1.55, rnd, lit=0.0)
        if front and B.get('fire'):
            fire_escape(mb, o, r, up, n, B['fire'][0], B['fire'][1], fl)
    # the roof: bulkhead, AC units, tank
    rx = x0 + (x1 - x0) * 0.25; rz = z0 + (z1 - z0) * 0.35
    box(mb, rx - 1.2, rx + 1.2, H, H + 2.4, rz - 1.4, rz + 1.4, {'top': 'Roof', 'px': col, 'nx': col, 'pz': col, 'nz': col}, skip=('bot',))
    for k in range(2):
        ax = x0 + (x1 - x0) * (0.55 + 0.2 * k); az = z0 + (z1 - z0) * 0.55
        box(mb, ax - 0.6, ax + 0.6, H, H + 0.9, az - 0.5, az + 0.5, 'Metal', skip=('bot',))
        cap_disc(mb, (ax, 0, az), 0.35, 8, H + 0.91, 'MetalDark')
    if B.get('tank'): water_tank(mb, B['tank'][0], H, B['tank'][1], 1.1)

def build_city():
    c = clear('sb-city')
    # ground
    g = MB()
    grect(g, -120, 120, -120, 80, -0.04, 'Sidewalk')
    CX0, CX1, CZ0, CZ1 = -8.82, 8.82, -2.32, 15.32       # the court with its curb (sb-court)
    SX, SZ0, SZ1 = 14.5, -9.0, 60.0
    for xa, xb, za, zb in ((-SX, SX, CZ1, SZ1), (-SX, SX, SZ0, CZ0), (-SX, CX0, CZ0, CZ1), (CX1, SX, CZ0, CZ1)):
        grect(g, xa, xb, za, zb, 0.0, 'Sidewalk')
    for s in (-1, 1):
        xa, xb = sorted((s * 14.5, s * 20.5)); grect(g, xa, xb, -6.6, SZ1, 0.0, 'Road')
        xa, xb = sorted((s * 14.5, s * 60.0)); grect(g, xa, xb, -9.0, -6.6, 0.0, 'Road')
        for k in range(14):
            z = -4.5 + 3.4 * k; xa, xb = sorted((s * 17.42, s * 17.58)); grect(g, xa, xb, z, z + 1.7, 0.01, 'Yellow')
        for k in range(8):       # a zebra crossing over each side street near the camera
            xa, xb = sorted((s * (14.8 + 0.72 * k), s * (15.2 + 0.72 * k))); grect(g, xa, xb, 19.0, 21.4, 0.01, 'White')
        for k in range(5):       # kerbs along the side streets
            xa, xb = sorted((s * 14.35, s * 14.6)); bbox(g, xa, xb, -0.05, 0.12, -6.5 + 12 * k + 0.05, -6.5 + 12 * (k + 1) - 0.05, 0.03, 'Curb', skip_down=True)
    for k in range(10):          # paving joints round the court
        z = -6.0 + 2.6 * k
        for s in (-1, 1):
            xa, xb = sorted((s * 9.1, s * 14.3)); grect(g, xa, xb, z, z + 0.05, 0.008, 'ConcreteDark')
    build(g, 'Ground', c)
    # buildings
    b = MB()
    for B in BLOCKS: block(b, B)
    build(b, 'Buildings', c)
    # the billboard on block 2
    bb = MB(); H2 = 3.4 + 3.0 * 1; BZ = -10.0; X0, X1, Y0, Y1 = 0.3, 8.7, H2 + 1.2, H2 + 4.4
    for x in (1.3, 4.5, 7.7):
        prism(bb, (x, H2, BZ - 0.3), (x, Y0 + 0.4, BZ - 0.3), 0.09, 4, 'MetalDark', caps=(False, True))
        prism(bb, (x, H2, BZ - 2.2), (x, Y0 + 0.2, BZ - 0.4), 0.06, 4, 'MetalDark', caps=(False, True))
    bbox(bb, X0 - 0.25, X1 + 0.25, Y0 - 0.25, Y1 + 0.25, BZ - 0.25, BZ, 0.05, 'Purple')
    wpoly(bb, [(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)], BZ + 0.01, 'Yellow')
    for pts in text_polys('fugio.co', size=2.3, offset=0.04, res=2):
        wpoly(bb, [(x + 5.1, y + Y0 + 0.75) for x, y in pts], BZ + 0.03, 'Purple')
    wpoly(bb, star_pts(X0 + 0.95, Y0 + 1.6, 0.75, 0.32), BZ + 0.03, 'Orange')
    bbox(bb, X0 - 0.3, X1 + 0.3, Y0 - 0.45, Y0 - 0.3, BZ - 0.3, BZ + 0.7, 0.03, 'MetalDark')
    for x in (1.7, 4.5, 7.3):
        tube(bb, [(x, Y1 + 0.25, BZ - 0.1), (x, Y1 + 0.75, BZ + 0.15), (x, Y1 + 0.75, BZ + 0.75)], 0.035, 4, 'MetalDark')
        bbox(bb, x - 0.2, x + 0.2, Y1 + 0.55, Y1 + 0.75, BZ + 0.65, BZ + 1.0, 0.03, 'MetalDark')
        bb.face([(x - 0.16, Y1 + 0.545, BZ + 0.67), (x + 0.16, Y1 + 0.545, BZ + 0.67), (x + 0.16, Y1 + 0.545, BZ + 0.98), (x - 0.16, Y1 + 0.545, BZ + 0.98)], 'Glow', (0, -1, 0))
    build(bb, 'Billboard', c)
    # street trees
    t = MB()
    for k, (x, z, h) in enumerate(((-12.9, -1.8, 5.2), (12.9, -1.8, 5.0), (-13.1, 6.5, 5.6), (13.1, 7.8, 5.3), (-12.9, 15.5, 5.0), (12.9, 16.2, 5.4),
                                   (-22.5, -5.0, 6.0), (23.0, -5.2, 5.8))):
        tree(t, x, z, h, 100 + k)
    build(t, 'Trees', c)
