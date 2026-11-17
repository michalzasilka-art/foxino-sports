# ws-far v2 additions (exec'd after ws_far.py): SkiJump (a lit ski jump on its own hill to the left: in-run on trestles
# with LampLit lights, start house, judges tower, light masts), Chairlift (pylons, cables, coloured cabins up a slope on
# the right, a valley station) and Village (snowy chalets with warm WindowLit windows and chimneys, two little towers).
PAL.update({'Chalet1': 'c98b6e', 'Chalet2': 'e2b48c', 'Chalet3': 'b07a9c', 'ChaletRoof': '6f5a7a'})

def slope(mb, pts):
    hull(mb, pts, lambda n: 'Snow' if n.y > 0.35 else ('SnowShade' if n.y < -0.2 else 'Mountain'), skip_down=True)

def _walls(top='Snow', side='StadiumWhite', bot='Truss'):
    return {'top': top, 'px': side, 'nx': side, 'pz': side, 'nz': side, 'bot': bot}

def ski_jump(mb):
    Z = -192.0; HW = 2.4
    prof = [(-188, 74), (-168, 60), (-150, 48), (-134, 40), (-122, 36.5), (-113, 36.0)]
    slope(mb, [(-215, -2, Z - 30), (-215, -2, Z + 30), (-60, -2, Z - 25), (-60, -2, Z + 28), (-200, 66, Z - 8), (-200, 66, Z + 8),
               (-170, 50, Z - 12), (-170, 50, Z + 12), (-120, 30, Z - 8), (-120, 30, Z + 8), (-95, 12, Z - 12), (-95, 12, Z + 12), (-75, 2, Z - 16), (-75, 2, Z + 16)])
    for (x0, y0), (x1, y1) in zip(prof, prof[1:]):
        mb.face([(x0, y0, Z - HW), (x1, y1, Z - HW), (x1, y1, Z + HW), (x0, y0, Z + HW)], 'Snow', (0, 1, 0))
        for s in (-1, 1):
            mb.face([(x0, y0 - 1.6, Z + s * HW), (x1, y1 - 1.6, Z + s * HW), (x1, y1 + 0.5, Z + s * HW), (x0, y0 + 0.5, Z + s * HW)], 'StadiumPurple', (0, 0, s))
        mb.face([(x0, y0 - 1.6, Z - HW), (x1, y1 - 1.6, Z - HW), (x1, y1 - 1.6, Z + HW), (x0, y0 - 1.6, Z + HW)], 'Truss', (0, -1, 0))
        gy = max(0.0, (y0 - 8) * 0.55)
        for s in (-1, 1):
            prism(mb, (x0, y0 - 1.6, Z + s * HW * 0.8), (x0 + 2, gy, Z + s * HW * 1.6), 0.35, 4, 'Truss', caps=(False, False))
        for t in (0.0, 0.5):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for s in (-1, 1):
                box(mb, x - 0.5, x + 0.5, y + 0.5, y + 1.3, Z + s * HW - 0.4, Z + s * HW + 0.4, 'LampLit')
    box(mb, -194, -184, 73, 79, Z - 4, Z + 4, _walls())
    box(mb, -189, -186.5, 75, 77, Z + 4.01, Z + 4.05, 'WindowLit')
    tx, tz = -100.0, Z + 14
    box(mb, tx - 3, tx + 3, 0, 22, tz - 3, tz + 3, _walls())
    box(mb, tx - 2.6, tx + 2.6, 15.5, 19.5, tz + 3.01, tz + 3.05, 'WindowLit')
    box(mb, tx - 4, tx + 4, 22, 23, tz - 4, tz + 4, _walls('Snow', 'StadiumPurple', 'StadiumPurple'))
    for s in (-1, 1):
        x = -88 + s * 9
        prism(mb, (x, 4, Z + 22), (x, 30, Z + 22), 0.4, 4, 'Truss', caps=(False, False))
        box(mb, x - 2, x + 2, 30, 32, Z + 21, Z + 23, 'Glow')

def chairlift(mb):
    A = Vector((92, 2, -182)); B = Vector((172, 82, -268)); n = 8
    slope(mb, [(70, -2, -170), (110, -2, -160), (200, -2, -290), (130, -2, -300), (175, 78, -272), (160, 70, -262), (120, 38, -225), (100, 18, -200), (85, 6, -185)])
    tops = []
    for i in range(n + 1):
        p = A + (B - A) * (i / n); top = p + Vector((0, 11, 0)); tops.append(top)
        prism(mb, p, top, 0.45, 4, 'Truss', caps=(False, True))
        prism(mb, top + Vector((-0.2, 0, -3.2)), top + Vector((-0.2, 0, 3.2)), 0.3, 4, 'Truss')
    for s in (-1, 1):
        tube(mb, [t + Vector((0, -0.4, s * 3.0)) for t in tops], 0.12, 3, 'Mullion')
    cols = ['RYellow', 'RPurple', 'RCyan', 'ROrange', 'RPink']
    for k in range(9):
        t = (k + 0.5) / 9.0; s = 1 if k % 2 else -1
        p = tops[0] + (tops[-1] - tops[0]) * t + Vector((0, -0.4, s * 3.0))
        prism(mb, p, p + Vector((0, -2.2, 0)), 0.08, 3, 'Mullion', caps=(False, False))
        cc = p + Vector((0, -3.4, 0))
        box(mb, cc.x - 1.0, cc.x + 1.0, cc.y - 1.2, cc.y + 1.2, cc.z - 0.9, cc.z + 0.9,
            {'top': 'Snow', 'px': cols[k % 5], 'nx': cols[k % 5], 'pz': 'WindowLit', 'nz': cols[k % 5], 'bot': cols[k % 5]})
    box(mb, A.x - 6, A.x + 4, 0, 6, A.z - 5, A.z + 5, _walls())
    box(mb, A.x - 5, A.x + 3, 1.5, 4, A.z + 5.01, A.z + 5.05, 'WindowLit')

def chalet(mb, x, z, w, d, h, yaw, wall):
    R_ = Ry(yaw); C = Vector((x, 0, z)); P = lambda a, b, c_: C + R_ @ Vector((a, b, c_))
    hull(mb, [P(a * w / 2, y, b * d / 2) for a in (-1, 1) for b in (-1, 1) for y in (0, h)], wall)
    rh = h + w * 0.45
    for s in (-1, 1):
        mb.face([P(s * (w / 2 + 0.5), h - 0.3, -d / 2 - 0.5), P(0, rh, -d / 2 - 0.5), P(0, rh, d / 2 + 0.5), P(s * (w / 2 + 0.5), h - 0.3, d / 2 + 0.5)], 'Snow', R_ @ Vector((s, 1.2, 0)))
        mb.face([P(-w / 2, h, s * d / 2), P(w / 2, h, s * d / 2), P(0, rh - 0.2, s * d / 2)], wall, R_ @ Vector((0, 0, s)))
    for wx in (-w * 0.25, w * 0.25):
        mb.face([P(wx - 0.55, h * 0.35, d / 2 + 0.02), P(wx + 0.55, h * 0.35, d / 2 + 0.02), P(wx + 0.55, h * 0.75, d / 2 + 0.02), P(wx - 0.55, h * 0.75, d / 2 + 0.02)], 'WindowLit', R_ @ Vector((0, 0, 1)))
    mb.face([P(-0.4, h + w * 0.12, d / 2 + 0.02), P(0.4, h + w * 0.12, d / 2 + 0.02), P(0.4, h + w * 0.26, d / 2 + 0.02), P(-0.4, h + w * 0.26, d / 2 + 0.02)], 'WindowLit', R_ @ Vector((0, 0, 1)))
    cx = w * 0.22
    hull(mb, [P(cx + a * 0.4, y, -d * 0.2 + b * 0.4) for a in (-1, 1) for b in (-1, 1) for y in (h, rh + 0.6)], 'ChaletRoof')

def village(mb):
    rnd = random.Random(31)
    spots = [(-112, -150), (-102, -158), (-92, -148), (-120, -162), (-84, -160), (-108, -168), (-96, -170),
             (84, -152), (95, -146), (104, -158), (90, -166), (114, -150), (100, -172)]
    for i, (x, z) in enumerate(spots):
        w = rnd.uniform(6, 9); d = rnd.uniform(5, 7); h = rnd.uniform(3.5, 5.5)
        chalet(mb, x, z, w, d, h, rnd.uniform(-0.4, 0.4), ['Chalet1', 'Chalet2', 'Chalet3'][i % 3])
    for x, z in ((-98, -178), (108, -170)):
        box(mb, x - 2, x + 2, 0, 14, z - 2, z + 2, 'StadiumWhite')
        hull(mb, [(x + a * 2.3, 14, z + b * 2.3) for a in (-1, 1) for b in (-1, 1)] + [(x, 21, z)], 'Snow')
        box(mb, x - 0.8, x + 0.8, 9, 11, z + 2.01, z + 2.05, 'WindowLit')

_build_far_v1 = build_far
def build_far():
    _build_far_v1()
    c = bpy.data.collections['ws-far']
    mb = MB(); ski_jump(mb); build_ws(mb, 'SkiJump', c, jit=0.08, seed=23)
    mb = MB(); chairlift(mb); build_ws(mb, 'Chairlift', c, jit=0.08, seed=24)
    mb = MB(); village(mb); build_ws(mb, 'Village', c, jit=0.08, seed=25)
