# sb-ball: a basketball, radius 0.12, centred at the origin. A latitude / longitude sphere whose seam bands (the
# equator and two great circles through the poles) are narrow rows of black faces: 320 triangles.
def basketball(mb, c, R, base=16, lats=(-67.5, -45, -22.5, 22.5, 45, 67.5), seam=0.045):
    c = Vector(c)
    longs = []; seamcol = set()
    for k in range(base):
        a = 2 * math.pi * k / base
        if k % (base // 4) == 0: longs += [a - seam, a + seam]; seamcol.add(len(longs) - 2)
        else: longs.append(a)
    L = [-math.pi / 2] + [math.radians(d) for d in lats if d < 0] + [-seam, seam] + [math.radians(d) for d in lats if d > 0] + [math.pi / 2]
    seamrow = L.index(-seam)
    P = lambda la, lo: c + Vector((R * math.cos(la) * math.cos(lo), R * math.sin(la), R * math.cos(la) * math.sin(lo)))
    n = len(longs)
    for i in range(len(L) - 1):
        for j in range(n):
            j1 = (j + 1) % n
            mat = 'BallSeam' if (i == seamrow or j in seamcol) else 'BallOrange'
            a, b = L[i], L[i + 1]
            if i == 0: q = [P(a, longs[j]), P(b, longs[j1]), P(b, longs[j])]
            elif i == len(L) - 2: q = [P(a, longs[j]), P(a, longs[j1]), P(b, longs[j])]
            else: q = [P(a, longs[j]), P(a, longs[j1]), P(b, longs[j1]), P(b, longs[j])]
            mb.face(q, mat, sum(q, Vector()) / len(q) - c)

def build_ball():
    c = clear('sb-ball'); mb = MB()
    basketball(mb, (0, 0, 0), 0.12)
    build(mb, 'Ball', c)
