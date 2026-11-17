# ws-props: Rings (five linked rings in one row at (-11, 0, -8) on a snowy rock plinth, snow on their tops, lanterns),
# Cauldron (the tower at (13, 0, -14), ~16 m, with FlameAnchor at the bowl's opening), FlagPoles + Flag.001..018
# (each cloth its own object, origin on the pole at the middle of the hoist edge, pointing +x, a white pictogram),
# Lamps (x +-4.5, z 4..-28 every 8 m), Pines (clusters at the sides and round the stadium), Snowman, Booth, Signposts.
RING_COLS = ['RYellow', 'RPurple', 'RCyan', 'ROrange', 'RPink']
FLAG_COLS = ['RYellow', 'RPurple', 'RCyan', 'ROrange', 'RPink']
PICTOS = ['football', 'tennis', 'basketball', 'skiing', 'skating']

def torus(mb, c, R_, r, n, m, mat, M=None, arc=None, snow=False):
    c = Vector(c); M = M or Matrix.Identity(3)
    a0, a1 = arc if arc else (0.0, 2 * math.pi)
    full = arc is None
    N = n if full else n + 1
    rings = []
    for i in range(N):
        t = a0 + (a1 - a0) * i / n
        ctr = c + M @ Vector((R_ * math.cos(t), R_ * math.sin(t), 0))
        dirv = M @ Vector((math.cos(t), math.sin(t), 0)); ax = M @ Vector((0, 0, 1))
        pts = []
        for j in range(m):
            u = 2 * math.pi * j / m + (math.pi / m)
            rr = r * (1.18 if snow and (dirv * math.cos(u) + ax * math.sin(u)).y > 0.2 else 1.0)
            pts.append(ctr + (dirv * math.cos(u) + ax * math.sin(u)) * rr)
        rings.append((ctr, pts))
    segs = n if full else n
    for i in range(segs):
        (c0, p0), (c1, p1) = rings[i], rings[(i + 1) % N]
        for j in range(m):
            k = (j + 1) % m
            q = [p0[j], p0[k], p1[k], p1[j]]
            mid = sum(q, Vector()) / 4; nrm = mid - (c0 + c1) / 2
            mb.face(q, mat(nrm) if callable(mat) else mat, nrm)
    if not full:
        for (cc, pp), sgn in ((rings[0], -1), (rings[-1], 1)):
            mb.face(pp, mat(Vector((0, 1, 0))) if callable(mat) else mat, None)

def rings(mb):
    X0, Y0, Z0 = -11.0, 3.65, -8.0
    Rr, rt, step = 0.8, 0.17, 1.32
    for i in range(5):
        cx = X0 + (i - 2) * step
        tilt = math.radians(9 if i % 2 else -9)
        M = Matrix.Rotation(tilt, 3, 'X')            # ring plane is local XY (facing +z), tilted to interlock
        zc = Z0 + (0.1 if i % 2 else -0.1)
        torus(mb, (cx, Y0, zc), Rr, rt, 22, 6, RING_COLS[i], M)
        # snow along the top arc
        torus(mb, (cx, Y0 + 0.07, zc), Rr, rt * 0.95, 8, 6, snow_mat, M, arc=(math.radians(35), math.radians(145)), snow=True)
    # the plinth: a stone block on a snowy rock mound
    obox(mb, (X0, Z0), 0, 7.6, 1.4, 1.6, 2.75, 0.12, 'StadiumWhite')
    obox(mb, (X0, Z0 + 0.72), 0, 7.0, 0.06, 1.95, 2.35, 0.01, 'StadiumPurple')
    snowcap_box(mb, (X0, Z0), 0, 7.5, 1.3, 2.75, h=0.2, over=0.06, seed=7)
    rr = random.Random(5)
    pts = []
    for k in range(12):
        a = 2 * math.pi * k / 12 + rr.uniform(-0.15, 0.15)
        pts.append((X0 + 5.0 * math.cos(a) * rr.uniform(0.9, 1.1), rr.uniform(0.0, 0.25), Z0 + 2.7 * math.sin(a) * rr.uniform(0.9, 1.1)))
        pts.append((X0 + 3.9 * math.cos(a + 0.26) * rr.uniform(0.9, 1.05), rr.uniform(0.85, 1.25), Z0 + 1.9 * math.sin(a + 0.26) * rr.uniform(0.9, 1.05)))
    pts += [(X0 + rr.uniform(-2.8, 2.8), rr.uniform(1.45, 1.7), Z0 + rr.uniform(-1.0, 1.0)) for _ in range(5)]
    hull(mb, pts, lambda n: 'Snow' if n.y > 0.55 else ('Rock' if n.y > -0.2 else 'RockShade'), skip_down=True)
    for s in (-1, 1):
        lantern(mb, X0 + s * 3.4, 1.65, Z0 + 1.95, s=1.3)

def cauldron(mb, c):
    X, Z = 13.0, -14.0
    lathe(mb, [(3.4, 0.0), (3.4, 0.6), (3.2, 0.7), (2.6, 0.7), (2.6, 1.3), (2.45, 1.4), (1.75, 1.4)], 8, 'Stone', c=(X, 0, Z),
          mats=['StoneDark', 'Stone', 'Stone', 'StoneDark', 'Stone', 'Stone'])
    for (r, y) in ((3.25, 0.7), (2.5, 1.4)):
        snowcap(mb, [(X + r * math.cos(math.pi / 8 + 2 * math.pi * k / 8), Z + r * math.sin(math.pi / 8 + 2 * math.pi * k / 8)) for k in range(8)], y, h=0.2, over=0.08, seed=int(r * 10))
    # tapered faceted shaft with glowing slits and purple / cyan bands
    lathe(mb, [(1.75, 1.4), (1.55, 5.0), (1.35, 9.0), (1.15, 12.6)], 8, 'StadiumWhite', c=(X, 0, Z), mats=['StadiumWhite', 'StadiumWhite', 'StadiumWhite'])
    for y0, col in ((4.0, 'StadiumPurple'), (8.4, 'StadiumCyan')):
        r = 1.75 - (y0 - 1.4) / 11.2 * 0.6
        lathe(mb, [(r + 0.06, y0), (r + 0.04, y0 + 0.5)], 8, col, c=(X, 0, Z))
        cap_disc(mb, (X, 0, Z), r + 0.06, 8, y0, col, up=False); cap_disc(mb, (X, 0, Z), r + 0.04, 8, y0 + 0.5, 'Snow')
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 4
        for (y0, y1) in ((1.9, 3.7), (5.0, 8.1), (9.3, 12.0)):
            r0 = 1.75 - (y0 - 1.4) / 11.2 * 0.6 + 0.012; r1 = 1.75 - (y1 - 1.4) / 11.2 * 0.6 + 0.012
            w = 0.16
            tx, tz = -math.sin(a), math.cos(a)
            p = lambda r, y, s: (X + r * math.cos(a) + s * w * tx, y, Z + r * math.sin(a) + s * w * tz)
            mb.face([p(r0, y0, -1), p(r0, y0, 1), p(r1, y1, 1), p(r1, y1, -1)], 'LampLit', (math.cos(a), 0.05, math.sin(a)))
    # capital and the bowl
    lathe(mb, [(1.15, 12.6), (1.6, 13.2), (1.7, 13.5), (1.2, 13.6)], 8, 'StadiumWhite', c=(X, 0, Z))
    snowcap(mb, [(X + 1.62 * math.cos(math.pi / 8 + 2 * math.pi * k / 8), Z + 1.62 * math.sin(math.pi / 8 + 2 * math.pi * k / 8)) for k in range(8)], 13.5, h=0.12, over=0.05, seed=31)
    lathe(mb, [(0.6, 13.6), (1.7, 14.3), (2.6, 15.2), (2.75, 15.55), (2.55, 15.6)], 10, 'Bronze', c=(X, 0, Z), mats=['Bronze', 'Gold', 'Gold', 'Bronze'])
    lathe(mb, [(2.55, 15.6), (1.6, 15.1), (0.0, 14.95)], 10, 'Coal', c=(X, 0, Z))
    em = empty('FlameAnchor', c, (X, 15.35, Z), size=0.6)
    return em

def flagpole(mb, x, z):
    obox(mb, (x, z), 0, 0.5, 0.5, 0.0, 0.35, 0.05, 'Stone')
    snowcap_box(mb, (x, z), 0, 0.46, 0.46, 0.35, h=0.1, over=0.03, seed=int(x * 7 + z))
    prism(mb, (x, 0.35, z), (x, 7.0, z), 0.055, 8, 'PoleWhite', caps=(False, False), r1=0.045)
    lathe(mb, [(0.0, 6.98), (0.09, 7.05), (0.1, 7.12), (0.07, 7.2), (0.0, 7.22)], 8, 'Gold', c=(x, 0, z))
    lathe(mb, [(0.075, 7.14), (0.08, 7.2), (0.0, 7.29)], 8, 'Snow', c=(x, 0, z))

def flag(c, idx, x, z):
    """Cloth 1.8 x 1.1 m, 6 x 3 quads, hoist edge on the pole, pointing +x; a white pictogram both sides."""
    mb = MB(); col = FLAG_COLS[idx % 5]; kind = PICTOS[idx % 5]
    W, H, nx, ny = 1.8, 1.1, 6, 3; ytop = 6.85; x0 = x + 0.06
    for i in range(nx):
        for j in range(ny):
            u0, u1 = x0 + W * i / nx, x0 + W * (i + 1) / nx; v0, v1 = ytop - H + H * j / ny, ytop - H + H * (j + 1) / ny
            mb.face([(u0, v0, z), (u1, v0, z), (u1, v1, z), (u0, v1, z)], col, (0, 0, 1))
    white, cut = picto(kind)
    s = 0.3; cx, cy = x0 + W * 0.5, ytop - H / 2
    for side in (1, -1):
        for pts in white:
            mb.face([(cx + side * u * s, cy + v * s, z + side * 0.012) for u, v in pts], 'FlagWhite', (0, 0, side))
        for pts in cut:
            mb.face([(cx + side * u * s, cy + v * s, z + side * 0.018) for u, v in pts], col, (0, 0, side))
    return build_ws(mb, 'Flag.%03d' % (idx + 1), c, origin=(x + 0.05, ytop - H / 2, z), jit=0.03, seed=idx)

def lamp(mb, x, z):
    obox(mb, (x, z), 0, 0.45, 0.45, 0.0, 0.4, 0.06, 'Mullion')
    prism(mb, (x, 0.4, z), (x, 3.6, z), 0.075, 8, 'Mullion', caps=(False, False), r1=0.06)
    lathe(mb, [(0.1, 1.2), (0.13, 1.3), (0.1, 1.4)], 8, 'StadiumPurple', c=(x, 0, z))
    lathe(mb, [(0.06, 3.6), (0.16, 3.62), (0.16, 3.68)], 8, 'Mullion', c=(x, 0, z))
    box(mb, x - 0.2, x + 0.2, 3.68, 4.05, z - 0.2, z + 0.2, 'LampLit', skip=('bot', 'top'))
    for (a, b) in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        prism(mb, (x + a * 0.2, 3.68, z + b * 0.2), (x + a * 0.2, 4.05, z + b * 0.2), 0.02, 4, 'Mullion', caps=(False, False))
    hull(mb, [(x + a * 0.27, 4.05, z + b * 0.27) for a in (-1, 1) for b in (-1, 1)] + [(x, 4.32, z)], 'StadiumPurple')
    hull(mb, [(x + a * 0.2, 4.13, z + b * 0.2) for a in (-1, 1) for b in (-1, 1)] + [(x, 4.4, z)] + [(x + a * 0.28, 4.08, z + b * 0.28) for a in (-1, 1) for b in (-1, 1)], 'Snow')
    lathe(mb, [(0.05, 4.32), (0.06, 4.42), (0.0, 4.5)], 6, 'Gold', c=(x, 0, z))

def snowman(mb, x, z, yaw=0.0):
    R_ = Ry(yaw); C = Vector((x, 0, z)); P = lambda v: C + R_ @ Vector(v)
    def ball(cy, r, n=8, rings_=5):
        pts = []
        for i in range(rings_ + 1):
            la = -math.pi / 2 + math.pi * i / rings_
            for k in range(n if 0 < i < rings_ else 1):
                a = 2 * math.pi * k / n + (math.pi / n if i % 2 else 0)
                pts.append(P((r * math.cos(la) * math.cos(a), cy + r * math.sin(la) * 0.92, r * math.cos(la) * math.sin(a))))
        hull(mb, pts, snow_mat)
    ball(0.55, 0.62); ball(1.38, 0.45); ball(1.98, 0.32, 8, 4)
    hull(mb, [P((a * 0.035, 1.98 + b * 0.035, 0.3)) for a in (-1, 1) for b in (-1, 1)] + [P((0.0, 1.97, 0.58))], 'Carrot')
    for ex in (-0.11, 0.11):
        hull(mb, [P((ex + a * 0.03, 2.06 + b * 0.03, 0.29 + d)) for a in (-1, 1) for b in (-1, 1) for d in (0, 0.03)], 'Coal')
    for by in (1.25, 1.42, 1.6):
        hull(mb, [P((a * 0.035, by + b * 0.035, 0.43 + d)) for a in (-1, 1) for b in (-1, 1) for d in (-0.02, 0.03)], 'Coal')
    lathe(mb, [(0.3, 2.18), (0.31, 2.3), (0.22, 2.48), (0.0, 2.55)], 8, 'Hat', c=(x, 0, z))
    lathe(mb, [(0.33, 2.17), (0.33, 2.26)], 8, 'Scarf', c=(x, 0, z))
    hull(mb, [(x + 0.09 * a, 2.6 + 0.09 * b, z + 0.09 * d) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)], 'Snow')
    lathe(mb, [(0.36, 1.68), (0.38, 1.82), (0.33, 1.84)], 8, 'Scarf', c=(x, 0, z))
    hull(mb, [P((0.18 + a * 0.08, 1.75 - t * 0.45, 0.25 + b * 0.03)) for a in (-1, 1) for b in (-1, 1) for t in (0, 1)], 'Scarf')
    for s in (-1, 1):
        tube(mb, [P((s * 0.4, 1.45, 0)), P((s * 0.8, 1.75, 0.05)), P((s * 1.0, 2.0, 0.02))], 0.025, 4, 'Trunk')
        tube(mb, [P((s * 0.8, 1.75, 0.05)), P((s * 0.95, 1.7, 0.1))], 0.018, 3, 'Trunk')

def booth(mb, x, z, yaw):
    R_ = Ry(yaw); C = (x, z)
    obox(mb, C, yaw, 2.2, 1.8, 0.0, 2.3, 0.06, 'StadiumWhite')
    P = lambda v: Vector((x, 0, z)) + R_ @ Vector(v)
    mb.face([P((-0.7, 1.0, 0.91)), P((0.7, 1.0, 0.91)), P((0.7, 1.8, 0.91)), P((-0.7, 1.8, 0.91))], 'WindowLit', R_ @ Vector((0, 0, 1)))
    hull(mb, [P((a * 0.75, 0.95, 0.9 + d)) for a in (-1, 1) for d in (0, 0.3)] + [P((a * 0.75, 1.0, 1.2)) for a in (-1, 1)], 'StadiumPurple')
    hull(mb, [P((a * 1.35, 2.3, b * 1.15)) for a in (-1, 1) for b in (-1, 1)] + [P((a * 1.1, 2.75, b * 0.9)) for a in (-1, 1) for b in (-1, 1)], 'StadiumPurple')
    hull(mb, [P((a * 1.3, 2.62, b * 1.1)) for a in (-1, 1) for b in (-1, 1)] + [P((a * 1.0, 2.98, b * 0.8)) for a in (-1, 1) for b in (-1, 1)], snow_mat)
    for s in (-1, 1):
        q = P((s * 0.9, 2.3, 0.6)); lantern(mb, q.x, 2.32, q.z, s=0.7)

def signpost(mb, x, z, yaw, cols):
    prism(mb, (x, 0, z), (x, 2.6, z), 0.07, 6, 'Wood', caps=(False, True))
    hull(mb, [(x + 0.1 * a, 2.6 + 0.12 * b, z + 0.1 * d) for a in (-1, 1) for b in (0, 1) for d in (-1, 1)], 'Snow')
    R_ = Ry(yaw)
    for k, (y, dirn) in enumerate(((2.25, 1), (1.85, -1), (1.45, 1))):
        if k >= len(cols): break
        L = 1.1
        pts = [(0.05 * dirn, -0.15), ((L - 0.25) * dirn, -0.15), (L * dirn, 0.0), ((L - 0.25) * dirn, 0.15), (0.05 * dirn, 0.15)]
        for dz, sg in ((0.075, 1), (-0.075, -1)):
            mb.face([Vector((x, y, z)) + R_ @ Vector((u, v, dz)) for u, v in pts], cols[k], R_ @ Vector((0, 0, sg)))
        hull(mb, [Vector((x, y, z)) + R_ @ Vector((u, 0.15, dz)) for u, v in pts for dz in (-0.075, 0.075)] +
             [Vector((x, y, z)) + R_ @ Vector((u * 0.9, 0.24, 0)) for u, v in pts[1:4]], 'Snow')

PINES = []
def pine_spots():
    rnd = random.Random(77); pts = []
    def ok(x, z):
        if abs(x) < 15.5 and -44 < z < 32: return False
        if math.hypot(x, z + 78) < 44: return False
        return all(math.hypot(x - a, z - b) > 2.6 for a, b, h in pts)
    clusters = [(-20, 18, 5), (-24, 8, 5), (-19, -2, 4), (-23, -14, 5), (-21, -30, 5), (-27, -40, 4), (20, 19, 5), (25, 9, 5), (19, 0, 4),
                (23, -12, 4), (21, -28, 5), (28, -42, 4), (-44, -58, 4), (44, -60, 4), (-48, -80, 3), (48, -84, 3), (-34, 26, 3), (35, 26, 3)]
    for cx, cz, n in clusters:
        tries = 0
        while n > 0 and tries < 60:
            tries += 1
            x, z = cx + rnd.uniform(-4.5, 4.5), cz + rnd.uniform(-4.5, 4.5)
            if ok(x, z):
                pts.append((x, z, rnd.uniform(4.5, 8.5))); n -= 1
    return pts

def build_props():
    c = clear('ws-props')
    mb = MB(); rings(mb); build_ws(mb, 'Rings', c, seed=11)
    mb = MB(); cauldron(mb, c); build_ws(mb, 'Cauldron', c, seed=12)
    mb = MB(); idx = 0; FL = []
    for s in (-1, 1):
        for k in range(9):
            z = 6.0 - 5.0 * k; x = s * 7.0
            flagpole(mb, x, z); FL.append((x, z))
    build_ws(mb, 'FlagPoles', c, seed=13)
    for i, (x, z) in enumerate(sorted(FL, key=lambda p: (-p[1], p[0]))):
        flag(c, i, x, z)
    mb = MB()
    for s in (-1, 1):
        for z in (4.0, -4.0, -12.0, -20.0, -28.0):
            lamp(mb, s * 4.5, z)
    build_ws(mb, 'Lamps', c, seed=14)
    mb = MB()
    for i, (x, z, h) in enumerate(pine_spots()):
        pine(mb, x, z, h, seed=500 + i, tiers=3)
    build_ws(mb, 'Pines', c, jit=0.08, seed=15)
    mb = MB(); snowman(mb, 10.2, 11.0, yaw=math.radians(-25)); build_ws(mb, 'Snowman', c, origin=(10.2, 0, 11.0), seed=16)
    mb = MB(); booth(mb, -10.5, -21.0, math.radians(35)); build_ws(mb, 'Booth', c, origin=(-10.5, 0, -21.0), seed=17)
    mb = MB(); signpost(mb, 9.0, 4.5, math.radians(-15), ['RCyan', 'ROrange', 'RPurple']); signpost(mb, -9.4, 20.5, math.radians(10), ['RPink', 'RYellow'])
    build_ws(mb, 'Signposts', c, seed=18)
