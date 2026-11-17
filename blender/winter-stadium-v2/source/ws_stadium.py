# ws-stadium: the winter Olympic stadium, design A. A round bowl, centre (0, 0, -78), facade radius 38: a ring of 32
# tall arches on chamfered piers (colourful faceted panels in the arches, hanging banners with white sport pictograms
# beside the entrance), a ground floor of warm windows, a mid band and a big cornice with snow, a set-back upper tier
# with a purple stripe and lit windows, slim leaning posts carrying a floating white roof ring (snow on top, a puffy
# lip on the edge, floodlights under it), and the big arched glass entrance portal facing +z at z -40 with a canopy,
# doors and lanterns. The front half (|angle| < 85 deg) gets the detail; the back half only its silhouette.
R = 38.0; NB = 32; DTH = 2 * math.pi / NB
BCOL = ['BPurple', 'BMagenta', 'BTeal', 'BOrange', 'BBlue']
SPORTS = ['football', 'tennis', 'basketball', 'skiing', 'skating']

def sweep(mb, prof, n, mat, th0=-math.pi, th1=math.pi):
    for i in range(n):
        a = th0 + (th1 - th0) * i / n; b = th0 + (th1 - th0) * (i + 1) / n; m = (a + b) / 2
        rad = Vector((math.sin(m), 0, math.cos(m)))
        for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
            dr, dy = r1 - r0, y1 - y0
            nrm = rad * dy + Vector((0, -dr, 0))
            q = [PP(a, r0, y0), PP(b, r0, y0), PP(b, r1, y1), PP(a, r1, y1)]
            mb.face(q, mat(nrm.normalized()) if callable(mat) else mat, nrm)

def frame(th):
    t = Vector((math.cos(th), 0, -math.sin(th))); n = Vector((math.sin(th), 0, math.cos(th)))
    return t, n

def picto(kind):
    """White sport pictogram polygons [(u, v)] about (0, 0), ~2 m tall; 'cut' polys are drawn in the banner colour on top."""
    white, cut = [], []
    circ = lambda cx, cy, r, n=14: [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    def bar(x0, y0, x1, y1, w):
        dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); nx, ny = -dy / L * w / 2, dx / L * w / 2
        return [(x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny), (x0 + nx, y0 + ny)]
    if kind == 'football':
        white.append(circ(0, 0, 0.95, 16))
        cut.append([(0.32 * math.cos(math.pi / 2 + 2 * math.pi * k / 5), 0.32 * math.sin(math.pi / 2 + 2 * math.pi * k / 5)) for k in range(5)])
        for k in range(5):
            a = math.pi / 2 + 2 * math.pi * k / 5
            cut.append(bar(0.32 * math.cos(a), 0.32 * math.sin(a), 0.92 * math.cos(a), 0.92 * math.sin(a), 0.08))
    elif kind == 'tennis':
        ring_o = [(0.62 * math.cos(2 * math.pi * k / 16) - 0.15, 0.82 * math.sin(2 * math.pi * k / 16) + 0.25) for k in range(16)]
        white.append(ring_o); cut.append([(0.48 * math.cos(2 * math.pi * k / 16) - 0.15, 0.66 * math.sin(2 * math.pi * k / 16) + 0.25) for k in range(16)])
        white.append(bar(-0.15, -0.55, -0.15, -1.15, 0.2))
        white.append(circ(0.65, -0.65, 0.22, 10))
    elif kind == 'basketball':
        white.append(circ(0, 0, 0.95, 16))
        cut.append(bar(0, -0.95, 0, 0.95, 0.07)); cut.append(bar(-0.95, 0, 0.95, 0, 0.07))
        for s in (-1, 1):
            pts = [(s * (0.95 - 0.55 * math.cos(t)), 0.85 * math.sin(t)) for t in [-1.2 + 2.4 * k / 6 for k in range(7)]]
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]): cut.append(bar(x0, y0, x1, y1, 0.07))
    elif kind == 'skiing':
        white.append(circ(0.35, 0.95, 0.2, 10))
        white.append(bar(0.25, 0.7, -0.15, 0.05, 0.28)); white.append(bar(-0.15, 0.05, 0.25, -0.45, 0.22)); white.append(bar(0.25, -0.45, -0.1, -0.85, 0.2))
        white.append(bar(0.15, 0.55, 0.65, 0.2, 0.14)); white.append(bar(0.65, 0.2, 0.95, -0.95, 0.06))
        white.append(bar(-1.0, -0.75, 1.05, -1.15, 0.1))
    elif kind == 'skating':
        white.append(circ(-0.1, 0.95, 0.2, 10))
        white.append(bar(-0.1, 0.7, 0.05, 0.0, 0.3)); white.append(bar(0.05, 0.0, -0.25, -0.75, 0.2)); white.append(bar(0.05, 0.0, 0.85, 0.15, 0.18))
        white.append(bar(-0.1, 0.55, -0.75, 0.3, 0.12)); white.append(bar(-0.1, 0.55, 0.5, 0.75, 0.12))
        white.append(bar(-0.6, -0.95, 0.15, -0.95, 0.07))
    return white, cut

def bay_front(mb, k, detail):
    """One bay between boundary angles (k, k+1) * DTH."""
    a0, a1 = k * DTH, (k + 1) * DTH; th = (a0 + a1) / 2
    t, n = frame(th); hw = R * math.sin(DTH / 2); M = PP(th, R * math.cos(DTH / 2), 0)
    P = lambda u, y, d: M + t * u + n * d + Vector((0, y, 0))
    face = lambda pts, mat, nrm=None: mb.face(pts, mat, nrm if nrm is not None else n)
    entrance = k in (-1, 0)
    uo = hw - 0.72               # opening half width (between piers)
    ys, ytop = 13.9 - uo, 13.9   # arch spring, crown
    # plinth band and the ground floor
    obox(mb, (M.x + n.x * 0.15, M.z + n.z * 0.15), th, 2 * hw + 0.1, 0.9, 0.0, 0.7, 0.08, 'StadiumShade')
    face([P(-hw, 0.7, -0.5), P(hw, 0.7, -0.5), P(hw, 4.4, -0.5), P(-hw, 4.4, -0.5)], 'StadiumWhite')
    if detail and not entrance:
        for u in (-1.35, 1.35):
            obox(mb, (P(u, 0, -0.45).x, P(u, 0, -0.45).z), th, 1.5, 0.22, 1.0, 3.3, 0.04, 'Mullion')
            face([P(u - 0.6, 1.1, -0.3), P(u + 0.6, 1.1, -0.3), P(u + 0.6, 3.2, -0.3), P(u - 0.6, 3.2, -0.3)], 'WindowLit')
            face([P(u - 0.035, 1.1, -0.29), P(u + 0.035, 1.1, -0.29), P(u + 0.035, 3.2, -0.29), P(u - 0.035, 3.2, -0.29)], 'Mullion')
            face([P(u - 0.6, 2.5, -0.29), P(u + 0.6, 2.5, -0.29), P(u + 0.6, 2.57, -0.29), P(u - 0.6, 2.57, -0.29)], 'Mullion')
            sp = P(u, 0, -0.25); snowcap_box(mb, (sp.x, sp.z), th, 1.45, 0.3, 1.02, h=0.1, over=0.03, seed=k * 7 + int(u * 10))
        # v2: a frieze over the windows, white sport figures on purple
        face([P(-hw + 0.78, 3.42, -0.43), P(hw - 0.78, 3.42, -0.43), P(hw - 0.78, 4.33, -0.43), P(-hw + 0.78, 4.33, -0.43)], 'StadiumPurple')
        for ii, u in enumerate((-1.35, 1.35)):
            white, cut = picto(SPORTS[(k * 2 + ii) % 5])
            for pts in white: face([P(u + px * 0.34, 3.875 + py * 0.34, -0.4) for px, py in pts], 'FlagWhite')
            for pts in cut: face([P(u + px * 0.34, 3.875 + py * 0.34, -0.39) for px, py in pts], 'StadiumPurple')
        face([P(-hw + 0.78, 3.38, -0.42), P(hw - 0.78, 3.38, -0.42), P(hw - 0.78, 3.44, -0.42), P(-hw + 0.78, 3.44, -0.42)], 'Gold')
    # mid band with snow
    mid = P(0, 0, 0.05)
    obox(mb, (mid.x, mid.z), th, 2 * hw + 0.05, 0.9, 4.4, 5.0, 0.06, 'StadiumWhite')
    if detail: snowcap_box(mb, (mid.x, mid.z), th, 2 * hw, 0.85, 5.0, h=0.18, over=0.06, seed=k)
    # the arch zone: spandrel ring round the opening, soffit, coloured panel
    ns = 10
    arch = [(-uo, 5.0)] + [(-uo * math.cos(math.pi * i / ns), ys + uo * math.sin(math.pi * i / ns)) for i in range(ns + 1)] + [(uo, 5.0)]
    outer = [(-hw, 5.0)] + [(-hw, ys)] + [(-hw + (2 * hw) * i / (ns - 2), 15.6) for i in range(ns - 1)] + [(hw, ys), (hw, 5.0)]
    # pair the two polylines into quads
    A = arch; B = outer
    for i in range(len(A) - 1):
        j0 = min(len(B) - 1, round(i * (len(B) - 1) / (len(A) - 1))); j1 = min(len(B) - 1, round((i + 1) * (len(B) - 1) / (len(A) - 1)))
        q = [P(A[i][0], A[i][1], 0), P(A[i + 1][0], A[i + 1][1], 0)]
        if j1 != j0: q += [P(B[j1][0], B[j1][1], 0), P(B[j0][0], B[j0][1], 0)]
        else: q += [P(B[j0][0], B[j0][1], 0)]
        face(q, 'StadiumWhite')
    depth = 1.3 if detail else 0.6
    for (u0, y0), (u1, y1) in zip(arch, arch[1:]):
        um, vm = (u0 + u1) / 2, (y0 + y1) / 2
        hint = (P(0, ys, 0) - P(um, max(vm, ys), 0)) if (abs(um) > 1e-3 or vm > ys) else Vector((0, 1, 0))
        face([P(u0, y0, 0), P(u1, y1, 0), P(u1, y1, -depth), P(u0, y0, -depth)], 'StadiumShade', hint)
    col = BCOL[k % 5]
    if detail:
        # a faceted panel: a fan from a point low in the arch
        c0 = (uo * 0.3 * (1 if k % 2 else -1), 6.2)
        for (u0, y0), (u1, y1) in zip(arch, arch[1:]):
            face([P(c0[0], c0[1], -depth), P(u1, y1, -depth), P(u0, y0, -depth)], col)
        face([P(-uo, 5.0, -depth), P(uo, 5.0, -depth), P(c0[0], c0[1], -depth)], col)
        # cyan trim round the arch
        for (u0, y0), (u1, y1) in zip(arch[1:-1], arch[2:-1]):
            mu0, mv0 = u0 * 1.04, ys + (y0 - ys) * 1.04 if y0 > ys else y0
            mu1, mv1 = u1 * 1.04, ys + (y1 - ys) * 1.04 if y1 > ys else y1
            face([P(u0, y0, 0.02), P(u1, y1, 0.02), P(mu1, mv1 + (0.12 if y1 > ys else 0), 0.02), P(mu0, mv0 + (0.12 if y0 > ys else 0), 0.02)], 'StadiumCyan')
        # snow on the arch crown (a little cap on the keystone)
        kp = P(0, 0, 0.1); obox(mb, (kp.x, kp.z), th, 0.9, 0.5, ytop - 0.1, ytop + 0.9, 0.06, 'StadiumWhite')
    else:
        face([P(-uo, 5.0, -depth)] + [P(u, y, -depth) for u, y in arch[1:-1]] + [P(uo, 5.0, -depth)], col)
    return th, t, n, P

BANNERS = {-3: ('BPurple', 'football'), -2: ('BTeal', 'tennis'), 1: ('BOrange', 'basketball'), 2: ('BBlue', 'skiing'), 3: ('BMagenta', 'skating'), -4: ('BOrange', 'skating')}

def banner(mb, k):
    col, kind = BANNERS[k]
    a0, a1 = k * DTH, (k + 1) * DTH; th = (a0 + a1) / 2
    t, n = frame(th); M = PP(th, R * math.cos(DTH / 2), 0)
    P = lambda u, y, d: M + t * u + n * d + Vector((0, y, 0))
    d = -0.7; W = 1.75; top, bot = 12.6, 6.3
    mb.face([P(-W, bot + 0.6, d), P(0, bot, d), P(W, bot + 0.6, d), P(W, top, d), P(-W, top, d)], col, n)
    mb.face([P(-W, bot + 0.6, d - 0.02), P(-W, top, d - 0.02), P(W, top, d - 0.02), P(W, bot + 0.6, d - 0.02), P(0, bot, d - 0.02)], col, -n)
    prism(mb, P(-W - 0.15, top + 0.05, d), P(W + 0.15, top + 0.05, d), 0.06, 6, 'Mullion')
    for u in (-W + 0.2, W - 0.2):
        prism(mb, P(u, top + 0.05, d), P(u * 0.6, 13.4, -0.2), 0.02, 3, 'Mullion', caps=(False, False))
    white, cut = picto(kind)
    s = 1.25; cy = (top + bot) / 2 + 0.6
    for pts in white: mb.face([P(u * s, cy + v * s, d + 0.03) for u, v in pts], 'FlagWhite', n)
    for pts in cut: mb.face([P(u * s, cy + v * s, d + 0.05) for u, v in pts], col, n)

def pier(mb, k, detail):
    a = k * DTH
    c = PP(a, R - 0.2, 0)
    if detail:
        obox(mb, (c.x, c.z), a, 1.5, 1.8, 0.0, 15.6, 0.14, 'StadiumWhite')
        cp = PP(a, R + 0.05, 0); obox(mb, (cp.x, cp.z), a, 1.8, 1.5, 15.0, 15.6, 0.06, 'StadiumShade')
    else:
        obox(mb, (c.x, c.z), a, 1.5, 1.8, 0.0, 15.6, 0.0001, 'StadiumWhite')

def portal(mb):
    Z0, Z1 = -38.8, -35.4; YB = 2.4
    obox(mb, (0, -37.6), 0, 19.0, 6.0, 0.0, YB, 0.12, 'StadiumShade')
    for s in (-1, 1):
        obox(mb, (s * 5.5, (Z0 + Z1) / 2), 0, 2.0, Z1 - Z0, YB, 8.0, 0.14, 'StadiumWhite')
        obox(mb, (s * 5.5, (Z0 + Z1) / 2 + 0.1), 0, 2.3, Z1 - Z0 + 0.2, YB, YB + 0.6, 0.06, 'StadiumShade')
        lantern(mb, s * 5.5, 4.2, Z1 + 0.25, s=1.4)
    # the arch band (inner r 4.5, outer r 6.5, spring y 8)
    n = 14; ri, ro, cy = 4.5, 6.5, 8.0
    pts = [(math.cos(math.pi * i / n), math.sin(math.pi * i / n)) for i in range(n + 1)]
    for (c0, s0), (c1, s1) in zip(pts, pts[1:]):
        mb.face([(ri * c0, cy + ri * s0, Z1), (ri * c1, cy + ri * s1, Z1), (ro * c1, cy + ro * s1, Z1), (ro * c0, cy + ro * s0, Z1)], 'StadiumWhite', (0, 0, 1))
        mb.face([(ri * c0, cy + ri * s0, Z1), (ri * c0, cy + ri * s0, Z0), (ri * c1, cy + ri * s1, Z0), (ri * c1, cy + ri * s1, Z1)], 'StadiumShade', (-c0 - c1, -s0 - s1, 0))
        mb.face([(ro * c0, cy + ro * s0, Z1), (ro * c1, cy + ro * s1, Z1), (ro * c1, cy + ro * s1, Z0), (ro * c0, cy + ro * s0, Z0)], 'StadiumWhite', (c0 + c1, s0 + s1, 0))
        # cyan trim on the inner edge, purple on the outer
        rt = ri + 0.25
        mb.face([(ri * c0, cy + ri * s0, Z1 + 0.03), (ri * c1, cy + ri * s1, Z1 + 0.03), (rt * c1, cy + rt * s1, Z1 + 0.03), (rt * c0, cy + rt * s0, Z1 + 0.03)], 'StadiumCyan', (0, 0, 1))
        rp = ro - 0.3
        mb.face([(rp * c0, cy + rp * s0, Z1 + 0.03), (rp * c1, cy + rp * s1, Z1 + 0.03), (ro * c1, cy + ro * s1, Z1 + 0.03), (ro * c0, cy + ro * s0, Z1 + 0.03)], 'StadiumPurple', (0, 0, 1))
    # snow along the top of the arch
    for (c0, s0), (c1, s1) in zip(pts[2:-2], pts[3:-2]):
        p0 = (ro * c0, cy + ro * s0); p1 = (ro * c1, cy + ro * s1)
        hull(mb, [(x + dx * 0.0, y + dy, z) for (x, y) in (p0, p1) for dy in (0.0, 0.28 + 0.06 * math.sin(7 * x)) for dx in (0,) for z in (Z0 + 0.25, Z1 + 0.12)] +
             [((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 0.36, (Z0 + Z1) / 2)], snow_mat)
    obox(mb, (0, Z1 - 0.2), 0, 1.3, 1.0, cy + ro - 0.45, cy + ro + 0.7, 0.1, 'StadiumPurple')
    snowcap_box(mb, (0, Z1 - 0.2), 0, 1.25, 0.95, cy + ro + 0.7, h=0.25, over=0.08, seed=3)
    # the glass: rectangle + half disc at z -38.3, mullions in front
    ZG = -38.3; G = [(-ri, YB)] + [(-ri * math.cos(math.pi * i / 16), cy + ri * math.sin(math.pi * i / 16)) for i in range(17)] + [(ri, YB)]
    mb.face([(x, y, ZG) for x, y in G], 'WindowLit', (0, 0, 1))
    def bar(x0, y0, x1, y1, w=0.09):
        d = Vector((x1 - x0, y1 - y0, 0)); L = d.length; nn = Vector((-d.y, d.x, 0)) / L * w / 2
        mb.face([(x0 - nn.x, y0 - nn.y, ZG + 0.06), (x1 - nn.x, y1 - nn.y, ZG + 0.06), (x1 + nn.x, y1 + nn.y, ZG + 0.06), (x0 + nn.x, y0 + nn.y, ZG + 0.06)], 'Mullion', (0, 0, 1))
    for x in (-3.375, -2.25, -1.125, 0.0, 1.125, 2.25, 3.375):
        yt = cy + math.sqrt(max(0.0, ri * ri - x * x)); bar(x, YB, x, yt)
    for y in (5.3, 6.7, 8.0):
        bar(-ri, y, ri, y)
    for i in range(1, 6):
        a = math.pi * i / 6; bar(2.0 * math.cos(a), cy + 2.0 * math.sin(a), ri * math.cos(a), cy + ri * math.sin(a))
    ring = [(2.0 * math.cos(math.pi * i / 8), cy + 2.0 * math.sin(math.pi * i / 8)) for i in range(9)]
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]): bar(x0, y0, x1, y1)
    # doors: four darker frames at the bottom
    for x in (-3.0, -1.0, 1.0, 3.0):
        for (x0, y0, x1, y1) in ((x - 0.85, YB, x - 0.75, 5.25), (x + 0.75, YB, x + 0.85, 5.25), (x - 0.85, 5.15, x + 0.85, 5.25)):
            mb.face([(x0, y0, ZG + 0.1), (x1, y0, ZG + 0.1), (x1, y1, ZG + 0.1), (x0, y1, ZG + 0.1)], 'Mullion', (0, 0, 1))
        mb.face([(x - 0.06, 3.5, ZG + 0.1), (x + 0.06, 3.5, ZG + 0.1), (x + 0.06, 4.1, ZG + 0.1), (x - 0.06, 4.1, ZG + 0.1)], 'Gold', (0, 0, 1))
    # canopy over the doors with snow and downlights
    obox(mb, (0, -36.9), 0, 10.6, 3.2, 5.6, 5.85, 0.05, 'StadiumWhite')
    snowcap_box(mb, (0, -36.9), 0, 10.4, 3.0, 5.85, h=0.2, over=0.07, seed=11)
    for x in (-3.6, -1.2, 1.2, 3.6):
        mb.face([(x - 0.3, 5.59, -36.2), (x + 0.3, 5.59, -36.2), (x + 0.3, 5.59, -35.8), (x - 0.3, 5.59, -35.8)], 'LampLit', (0, -1, 0))
    for s in (-1, 1):
        prism(mb, (s * 5.1, 5.6, -35.6), (s * 5.1, YB, -35.6), 0.09, 6, 'StadiumWhite')
    # the warm hall behind the glass (seen through the doors)
    box(mb, -4.6, 4.6, YB, 12.5, -40.6, -38.6, {'top': 'WindowLit', 'px': 'WindowLit', 'nx': 'WindowLit', 'pz': 'WindowLit', 'nz': 'WindowLit', 'bot': 'WindowLit'}, skip=('pz', 'bot'))

def build_stadium():
    c = clear('ws-stadium'); mb = MB()
    DET = math.radians(86)
    for k in range(-NB // 2, NB // 2):
        th = (k + 0.5) * DTH
        det = abs(th) < DET
        bay_front(mb, k, det)
        pier(mb, k, abs(k * DTH) < DET + DTH / 2)
        if k in BANNERS: banner(mb, k)
    upper_and_ring(mb)
    portal(mb)
    build_ws(mb, 'Stadium', c, seed=3)
    return mb.tris()

def upper_and_ring(mb):
    # cornice ring (+ snow), upper tier (+ purple stripe, coping, snow)
    sweep(mb, [(R - 0.6, 15.6), (R + 0.6, 15.6), (R + 0.75, 15.9), (R + 0.75, 16.35), (R + 0.55, 16.6), (R - 2.0, 16.6)], 64, 'StadiumWhite')
    sweep(mb, [(R + 0.5, 16.55), (R + 0.85, 16.62), (R + 0.8, 16.85), (R + 0.45, 16.98), (R - 2.0, 16.95)], 64, snow_mat)
    RU = R - 3.5
    sweep(mb, [(RU, 16.5), (RU, 17.1)], 64, 'StadiumWhite')
    sweep(mb, [(RU, 17.1), (RU + 0.12, 17.15), (RU + 0.12, 17.6), (RU, 17.65)], 64, 'StadiumPurple')
    sweep(mb, [(RU, 17.65), (RU, 19.8), (RU + 0.25, 19.8), (RU + 0.25, 20.15), (RU - 1.0, 20.15)], 64, 'StadiumWhite')
    sweep(mb, [(RU + 0.2, 20.12), (RU + 0.42, 20.2), (RU + 0.35, 20.42), (RU - 0.9, 20.45)], 64, snow_mat)
    for k in range(-NB // 2, NB // 2):           # a row of small lit windows on the upper tier, front half
        th = (k + 0.5) * DTH
        if abs(th) > math.radians(80): continue
        for f in (-0.33, 0.0, 0.33):
            a = th + f * DTH
            t, n = frame(a); p = PP(a, RU + 0.02, 0)
            mb.face([p + t * -0.45 + Vector((0, 18.1, 0)), p + t * 0.45 + Vector((0, 18.1, 0)), p + t * 0.45 + Vector((0, 19.1, 0)), p + t * -0.45 + Vector((0, 19.1, 0))], 'WindowLit', n)
    # posts leaning out to the floating roof ring
    for k in range(-NB // 2, NB // 2, 2):
        a = k * DTH
        b0 = PP(a, RU - 0.3, 20.1); b1 = PP(a, RU + 2.6, 21.85)
        prism(mb, b0, b1, 0.2, 6, 'StadiumWhite', caps=(False, False))
        prism(mb, PP(a, RU - 0.3, 19.8), b0, 0.26, 6, 'StadiumShade', caps=(False, True))
    # the roof ring, its snow, its floodlights
    sweep(mb, [(30.6, 22.25), (31.2, 21.8), (40.6, 21.8), (41.6, 22.3), (41.5, 22.95), (30.9, 23.05), (30.6, 22.25)], 96, 'StadiumWhite')
    sweep(mb, [(31.1, 23.0), (41.45, 22.9), (41.75, 23.0), (41.85, 23.18), (41.6, 23.42), (40.0, 23.5), (31.3, 23.45), (31.1, 23.0)], 96, snow_mat)
    sweep(mb, [(40.4, 21.79), (40.9, 21.79)], 96, 'StadiumPurple')
    for k in range(-NB // 2, NB // 2):
        a = (k + 0.5) * DTH
        if abs(a) > math.radians(100): continue
        t, n = frame(a); p = PP(a, 38.6, 21.8)
        hull(mb, [p + t * u + n * d + Vector((0, y, 0)) for u in (-0.45, 0.45) for d in (-0.25, 0.25) for y in (0.0, -0.35)],
             lambda nn: 'Glow' if nn.y < -0.8 else 'StadiumShade')
    # wall lanterns on the front piers, icicles under the cornice and the roof ring edge
    for k in range(-NB // 2, NB // 2 + 1):
        a = k * DTH
        if abs(a) > math.radians(80) or k in (-1, 0, 1): continue
        t, n = frame(a); p = PP(a, R + 0.72, 0)
        lantern(mb, p.x, 3.1, p.z, s=1.15)
    rr = random.Random(4)
    for ring_r, ring_y, cnt in ((R + 0.72, 15.62, 120), (41.55, 22.28, 150)):
        for i in range(cnt):
            a = math.radians(-82 + 164 * (i + rr.random() * 0.6) / cnt)
            if abs(PP(a, ring_r, 0).x) < 6.6 and ring_r < 40: continue
            t, n = frame(a); p = PP(a, ring_r, ring_y); L = rr.uniform(0.25, 0.7) * (1.4 if ring_r > 40 else 1.0)
            hull(mb, [p + t * 0.07, p - t * 0.07, p - n * 0.1, p + Vector((0, -L, 0)) + n * 0.01], 'Ice')
