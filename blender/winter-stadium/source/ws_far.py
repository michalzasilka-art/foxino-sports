# ws-far: Mountains (a ring of big faceted snowy peaks far behind and to the sides, z < -160 or |x| > 120) and Forest
# (a belt of simple blue-green pine silhouettes with snowy tips between the plaza and the mountains).
def mountain(mb, cx, cz, h, r, seed):
    rnd = random.Random(seed)
    n = 8; base = []; mid = []
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.uniform(-0.2, 0.2)
        rr = r * rnd.uniform(0.75, 1.15)
        base.append(Vector((cx + rr * math.cos(a), -2.0, cz + rr * math.sin(a))))
        mid.append(Vector((cx + rr * 0.48 * math.cos(a + 0.2), h * rnd.uniform(0.45, 0.6), cz + rr * 0.48 * math.sin(a + 0.2))))
    peak = Vector((cx + rnd.uniform(-0.1, 0.1) * r, h, cz + rnd.uniform(-0.1, 0.1) * r))
    snowline = h * 0.5
    for k in range(n):
        j = (k + 1) % n
        for tri in ((base[k], base[j], mid[j]), (base[k], mid[j], mid[k])):
            cen = sum(tri, Vector()) / 3
            mat = 'Mountain' if (cen - Vector((cx, 0, cz))).normalized().z > -0.2 else 'MountainShade'
            mb.face(list(tri), mat, cen - Vector((cx, h * 0.3, cz)))
        tri = (mid[k], mid[j], peak); cen = sum(tri, Vector()) / 3
        mb.face(list(tri), 'Snow' if (k % 3) else 'SnowShade', cen - Vector((cx, h * 0.5, cz)))

def build_far():
    c = clear('ws-far'); rnd = random.Random(9)
    mb = MB()
    peaks = []
    for k in range(17):                   # behind, an arc from left to right
        a = math.radians(-80 + 160 * k / 16 + rnd.uniform(-3, 3))
        d = rnd.uniform(240, 330)
        x, z = d * math.sin(a), -60 - d * math.cos(a)
        if z > -160 and abs(x) < 120: continue
        peaks.append((x, z, rnd.uniform(55, 110) * (1.0 if abs(a) < math.radians(50) else 0.8), rnd.uniform(70, 110)))
    for k in range(6):                    # lower ridges in front of the big peaks
        a = math.radians(-60 + 120 * k / 5 + rnd.uniform(-6, 6)); d = rnd.uniform(180, 210)
        peaks.append((d * math.sin(a), -60 - d * math.cos(a), rnd.uniform(30, 45), rnd.uniform(50, 70)))
    for i, (x, z, h, r) in enumerate(peaks): mountain(mb, x, z, h, r, 40 + i)
    build_ws(mb, 'Mountains', c, jit=0.1, seed=21)
    fb = MB()
    # the forest belt: rings of cone silhouettes (5 sides, no underside), snow on the tips
    for band, (rmin, rmax, n) in enumerate(((95, 120, 150), (125, 155, 130))):
        for k in range(n):
            a = math.radians(-125 + 250 * k / n + rnd.uniform(-0.6, 0.6))
            d = rnd.uniform(rmin, rmax)
            x, z = d * math.sin(a), -60 - d * math.cos(a)
            if z > 30 or (abs(x) < 50 and z > -40): continue
            h = rnd.uniform(9, 16); r = h * 0.32
            y0 = ground_h(x, z) - 0.5 if 'ground_h' in globals() else 0.0
            lathe(fb, [(r, y0), (0.0, y0 + h)], 5, 'Forest' if band == 0 else 'ForestDark', c=(x, 0, z), rot=rnd.uniform(0, 1))
            lathe(fb, [(r * 0.32, y0 + h * 0.68), (0.0, y0 + h + 0.2)], 5, 'Snow', c=(x, 0, z), rot=rnd.uniform(0, 1))
    build_ws(fb, 'Forest', c, jit=0.1, seed=22)
