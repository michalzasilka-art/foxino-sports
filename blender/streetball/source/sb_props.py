# sb-props: separate objects round the court, outside the lines, each with its origin at its foot (translation only):
# Lamp.000 / Lamp.001 (street lamps at the back corners outside the fence, heads over the court), Bench (left side
# inside the fence), Bag and Bottle (on the bench), Boombox (by the bench), TrashCan (back right), Cones (3, right
# side), Hydrant (on the sidewalk, left, near the camera), BallRack (right side, 3 balls).

def _obj(name, c, fn, origin):
    mb = MB(); fn(mb); return build(mb, name, c, origin=origin)

def lamp(mb, x, z, s):
    bbox(mb, x - 0.2, x + 0.2, 0.0, 0.25, z - 0.2, z + 0.2, 0.04, 'MetalDark', skip_down=True)
    prism(mb, (x, 0.25, z), (x, 5.0, z), 0.075, 8, 'PurpleDark', caps=(False, False), r1=0.055)
    lathe(mb, [(0.1, 0.25), (0.1, 0.9), (0.08, 1.0)], 8, 'Purple', c=(x, 0, z))
    tube(mb, [(x, 4.9, z), (x, 5.25, z + 0.05), (x + s * 0.25, 5.5, z + 0.18), (x + s * 0.8, 5.55, z + 0.5), (x + s * 1.2, 5.45, z + 0.75)], 0.05, 6, 'PurpleDark', caps=(False, True))
    hx, hz = x + s * 1.3, z + 0.82
    hull(mb, [(hx + a, 5.48, hz + b) for a in (-0.32, 0.32) for b in (-0.2, 0.2)] + [(hx + a * 0.4, 5.62, hz + b * 0.4) for a in (-0.32, 0.32) for b in (-0.2, 0.2)] +
         [(hx + a * 0.95, 5.32, hz + b * 0.95) for a in (-0.32, 0.32) for b in (-0.2, 0.2)], lambda n: 'Glow' if n.y < -0.9 else 'PurpleDark')

def bench(mb, x, z0, z1):
    for z in (z0 + 0.25, z1 - 0.25):
        bbox(mb, x - 0.22, x + 0.22, 0.0, 0.42, z - 0.05, z + 0.05, 0.015, 'MetalDark', skip_down=True)
        hull(mb, [(x - 0.24, 0.42, z - 0.05), (x - 0.24, 0.42, z + 0.05), (x - 0.24, 0.9, z - 0.05), (x - 0.24, 0.9, z + 0.05),
                  (x - 0.18, 0.42, z - 0.05), (x - 0.18, 0.42, z + 0.05), (x - 0.29, 0.9, z - 0.05), (x - 0.29, 0.9, z + 0.05)], 'MetalDark')
    for k in range(3):
        u = x - 0.21 + 0.145 * k
        bbox(mb, u, u + 0.13, 0.42, 0.47, z0, z1, 0.015, 'Orange')
    for y in (0.58, 0.76):
        bbox(mb, x - 0.3, x - 0.25, y, y + 0.12, z0, z1, 0.015, 'Orange')

def bag(mb, x, y, z):
    pts = []
    for k in range(8):
        a = 2 * math.pi * k / 8
        for zz in (-0.3, 0.3):
            pts.append((x + 0.16 * math.cos(a), y + 0.13 + 0.13 * math.sin(a), z + zz * (1 if abs(math.sin(a)) > 0.5 else 0.88)))
    hull(mb, pts, 'Purple')
    for zz in (-0.2, 0.2):
        prism(mb, (x, y + 0.135, z + zz - 0.025), (x, y + 0.135, z + zz + 0.025), 0.165, 8, 'Yellow', rot=0)
    tube(mb, [(x - 0.04, y + 0.25, z - 0.14), (x - 0.03, y + 0.42, z - 0.08), (x - 0.03, y + 0.42, z + 0.08), (x - 0.04, y + 0.25, z + 0.14)], 0.018, 4, 'Black')

def bottle(mb, x, y, z):
    lathe(mb, [(0.0, y), (0.04, y), (0.042, y + 0.15), (0.032, y + 0.19), (0.018, y + 0.21)], 8, 'Cyan', c=(x, 0, z),
          mats=['Cyan', 'Cyan', 'Cyan', 'Cyan'])
    lathe(mb, [(0.02, y + 0.21), (0.02, y + 0.25), (0.0, y + 0.25)], 8, 'White', c=(x, 0, z))

def boombox(mb, x, z):
    bbox(mb, x - 0.1, x + 0.1, 0.0, 0.3, z - 0.3, z + 0.3, 0.025, 'Pink', skip_down=True)
    for zz in (-0.16, 0.16):
        prism(mb, (x + 0.09, 0.14, z + zz), (x + 0.115, 0.14, z + zz), 0.105, 10, 'Black', caps=(False, True))
        prism(mb, (x + 0.115, 0.14, z + zz), (x + 0.125, 0.14, z + zz), 0.05, 8, 'MetalDark', caps=(False, True))
    bbox(mb, x + 0.09, x + 0.11, 0.22, 0.28, z - 0.07, z + 0.07, 0.005, 'Cyan')
    tube(mb, [(x, 0.29, z - 0.24), (x, 0.42, z - 0.2), (x, 0.42, z + 0.2), (x, 0.29, z + 0.24)], 0.018, 4, 'Black')
    prism(mb, (x - 0.06, 0.3, z + 0.27), (x - 0.06, 0.62, z + 0.27), 0.006, 3, 'Metal')

def trash(mb, x, z):
    lathe(mb, [(0.26, 0.0), (0.3, 0.9), (0.33, 0.92), (0.33, 0.98)], 8, 'Green', c=(x, 0, z), mats=['Green', 'Green', 'Green'])
    for y in (0.2, 0.6):
        lathe(mb, [(0.28 + y * 0.045, y), (0.28 + y * 0.045, y + 0.05)], 8, 'MetalDark', c=(x, 0, z))
    lathe(mb, [(0.33, 0.98), (0.2, 1.06), (0.0, 1.08)], 8, 'MetalDark', c=(x, 0, z))
    cap_disc(mb, (x, 0, z), 0.26, 8, 0.0, 'Green', up=False)

def cone(mb, x, z):
    bbox(mb, x - 0.2, x + 0.2, 0.0, 0.04, z - 0.2, z + 0.2, 0.02, 'Orange', skip_down=True)
    lathe(mb, [(0.14, 0.04), (0.105, 0.2), (0.09, 0.27), (0.065, 0.39), (0.03, 0.52), (0.0, 0.53)], 8, 'Orange', c=(x, 0, z),
          mats=['Orange', 'White', 'Orange', 'Orange', 'Orange'])

def hydrant(mb, x, z):
    lathe(mb, [(0.17, 0.0), (0.17, 0.08), (0.12, 0.1), (0.12, 0.62), (0.15, 0.65), (0.15, 0.7), (0.11, 0.8), (0.04, 0.86), (0.04, 0.9), (0.0, 0.92)], 8, 'Yellow', c=(x, 0, z),
          mats=['Yellow', 'Yellow', 'Yellow', 'Yellow', 'Yellow', 'Yellow', 'Yellow', 'MetalDark', 'MetalDark'])
    for d in ((1, 0), (-1, 0), (0, 1)):
        p0 = Vector((x, 0.45, z)); p1 = p0 + Vector((d[0] * 0.21, 0, d[1] * 0.21))
        prism(mb, p0, p1, 0.055, 6, 'Yellow', caps=(False, True))
        prism(mb, p1, p1 + Vector((d[0] * 0.03, 0, d[1] * 0.03)), 0.04, 6, 'MetalDark', caps=(False, True))

def ball_rack(mb, x, z):
    for zz in (-0.5, 0.5):
        tube(mb, [(x - 0.2, 0.0, z + zz), (x - 0.15, 0.55, z + zz), (x + 0.15, 0.55, z + zz), (x + 0.2, 0.0, z + zz)], 0.022, 4, 'MetalDark', caps=(True, True))
    for xx in (-0.1, 0.1):
        prism(mb, (x + xx, 0.56, z - 0.55), (x + xx, 0.56, z + 0.55), 0.018, 4, 'Purple', caps=(True, True))
    prism(mb, (x, 0.25, z - 0.5), (x, 0.25, z + 0.5), 0.016, 4, 'MetalDark', caps=(False, False))
    for k in range(3):
        basketball(mb, (x, 0.56 + 0.13, z - 0.3 + 0.3 * k), 0.12, base=12, lats=(-50, 50), seam=0.05)

def build_props():
    c = clear('sb-props')
    for i, s in enumerate((-1, 1)):
        _obj('Lamp.%03d' % i, c, lambda mb, s=s: lamp(mb, -s * 9.75, -3.1, s), (-s * 9.75, 0, -3.1))
    _obj('Bench', c, lambda mb: bench(mb, -8.45, 0.6, 2.4), (-8.45, 0, 1.5))
    _obj('Bag', c, lambda mb: bag(mb, -8.43, 0.47, 1.05), (-8.43, 0.47, 1.05))
    _obj('Bottle', c, lambda mb: bottle(mb, -8.4, 0.47, 1.62), (-8.4, 0.47, 1.62))
    _obj('Boombox', c, lambda mb: boombox(mb, -8.4, 3.3), (-8.4, 0, 3.3))
    _obj('TrashCan', c, lambda mb: trash(mb, 8.05, -1.35), (8.05, 0, -1.35))
    def cones(mb):
        cone(mb, 8.0, 9.6); cone(mb, 8.1, 10.9); cone(mb, 7.95, 12.2)
    _obj('Cones', c, cones, (8.0, 0, 10.9))
    _obj('Hydrant', c, lambda mb: hydrant(mb, -9.75, 14.4), (-9.75, 0, 14.4))
    _obj('BallRack', c, lambda mb: ball_rack(mb, 8.3, 2.3), (8.3, 0, 2.3))
