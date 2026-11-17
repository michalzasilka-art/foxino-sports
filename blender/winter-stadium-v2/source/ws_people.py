# ws-people: eight low-poly winter visitors, Visitor1..Visitor8, each its own object at the origin (its feet), facing
# +z, no rig: puffy jackets, bobble hats, scarves, boots and mittens in our colours. One pulls a sled, one carries skis
# on the shoulder, one waves a foam finger, one holds a small Foxino flag. Kids and adults, 1.1 to 1.7 m.
PAL.update({'Skin1': 'f3c7a2', 'Skin2': 'c98a5f', 'Skin3': '8c5a3c', 'Boot': '3a2c3e', 'Pants': '3d4f8f', 'Pants2': '4a3a6e',
            'Hair1': '3a2a22', 'Hair2': 'e8b44a', 'Foam': 'ffcd1c', 'SledRed': 'e8434f'})

def _ball(mb, c, r, mat, n=8, rings=4, sy=1.0):
    pts = []
    for i in range(rings + 1):
        la = -math.pi / 2 + math.pi * i / rings
        for k in range(n if 0 < i < rings else 1):
            a = 2 * math.pi * k / n + (math.pi / n if i % 2 else 0)
            pts.append((c[0] + r * math.cos(la) * math.cos(a), c[1] + r * sy * math.sin(la), c[2] + r * math.cos(la) * math.sin(a)))
    hull(mb, pts, mat)

def visitor(mb, H, skin, jacket, trim, pants, hat, pom, scarf, pose='walk', prop=None, hair='Hair1'):
    s = H / 1.7
    S = lambda x, y, z: (x * s, y * s, z * s)
    # legs mid-stride, boots
    for sx, fz in ((-1, 0.12), (1, -0.1)):
        hip = S(sx * 0.1, 0.78, 0.0); ank = S(sx * 0.11, 0.12, fz)
        prism(mb, hip, ank, 0.085 * s, 6, pants, caps=(False, False), r1=0.07 * s)
        hull(mb, [S(sx * 0.11 + a * 0.07, y, fz + b) for a in (-1, 1) for y in (0.0, 0.17) for b in (-0.08, 0.15)], 'Boot')
    # puffy jacket: two stacked chamfered blocks (a quilted look), a trim band, collar
    hull(mb, [S(x, y, z) for x, y, z in ((-0.2, 0.7, -0.13), (0.2, 0.7, -0.13), (-0.2, 0.7, 0.14), (0.2, 0.7, 0.14), (-0.24, 0.95, -0.15), (0.24, 0.95, -0.15),
                                         (-0.24, 0.95, 0.17), (0.24, 0.95, 0.17))], jacket)
    hull(mb, [S(x, y, z) for x, y, z in ((-0.24, 0.96, -0.15), (0.24, 0.96, -0.15), (-0.24, 0.96, 0.17), (0.24, 0.96, 0.17), (-0.23, 1.3, -0.13), (0.23, 1.3, -0.13),
                                         (-0.22, 1.3, 0.14), (0.22, 1.3, 0.14), (-0.13, 1.38, -0.08), (0.13, 1.38, -0.08), (-0.13, 1.38, 0.09), (0.13, 1.38, 0.09))], jacket)
    hull(mb, [S(x, y, z) for x, y, z in ((-0.205, 0.68, -0.135), (0.205, 0.68, -0.135), (-0.205, 0.68, 0.145), (0.205, 0.68, 0.145),
                                         (-0.215, 0.76, -0.14), (0.215, 0.76, -0.14), (-0.215, 0.76, 0.155), (0.215, 0.76, 0.155))], trim)
    mb.face([S(-0.025, 0.78, 0.165), S(0.025, 0.78, 0.165), S(0.025, 1.3, 0.155), S(-0.025, 1.3, 0.155)], trim, (0, 0, 1))
    # scarf: a ring and a hanging tail
    lathe(mb, [(0.12 * s, 1.36 * s), (0.13 * s, 1.43 * s), (0.1 * s, 1.47 * s)], 8, scarf)
    hull(mb, [S(0.07 + a * 0.05, y, 0.12 + d) for a in (-1, 1) for y in (1.05, 1.4) for d in (0.0, 0.04)], scarf)
    # head, nose, eyes, hat with a bobble
    hc = S(0, 1.56, 0.01); hr = 0.135 * s * (1.12 if H < 1.3 else 1.0)
    _ball(mb, hc, hr, skin, n=8, rings=4)
    hull(mb, [(hc[0] + 0.022 * a, hc[1] - 0.01 + 0.02 * b, hc[2] + hr * 0.93 + 0.035 * c) for a in (-1, 1) for b in (-1, 1) for c in (0, 1)], skin)
    for ex in (-0.045, 0.045):
        mb.face([(hc[0] + ex * s + dx, hc[1] + 0.025 * s + dy, hc[2] + hr * 0.95) for dx, dy in ((-0.013, -0.016), (0.013, -0.016), (0.013, 0.016), (-0.013, 0.016))], 'Coal', (0, 0, 1))
    lathe(mb, [(hr * 1.06, hc[1] + hr * 0.15), (hr * 1.08, hc[1] + hr * 0.4), (hr * 0.85, hc[1] + hr * 0.95), (hr * 0.3, hc[1] + hr * 1.18), (0, hc[1] + hr * 1.2)], 8, hat, c=(hc[0], 0, hc[2]))
    lathe(mb, [(hr * 1.1, hc[1] + hr * 0.12), (hr * 1.12, hc[1] + hr * 0.42)], 8, trim if trim != hat else 'FlagWhite', c=(hc[0], 0, hc[2]))
    _ball(mb, (hc[0], hc[1] + hr * 1.32, hc[2]), hr * 0.32, pom, n=6, rings=3)
    # arms (puffy sleeves) and mittens
    hands = {}
    for sx in (-1, 1):
        sh = S(sx * 0.27, 1.25, 0.0)
        if pose == 'wave' and sx > 0: el, ha = S(0.42, 1.45, 0.05), S(0.4, 1.85, 0.12)
        elif pose == 'flag' and sx > 0: el, ha = S(0.38, 1.05, 0.2), S(0.32, 1.25, 0.38)
        elif pose == 'skis' and sx < 0: el, ha = S(-0.4, 1.4, 0.1), S(-0.22, 1.55, 0.18)
        elif pose == 'sled' and sx > 0: el, ha = S(0.33, 0.95, -0.15), S(0.32, 0.75, -0.3)
        else:
            swing = 0.14 if sx > 0 else -0.14
            el, ha = S(sx * 0.33, 0.98, swing), S(sx * 0.32, 0.74, swing * 1.6)
        prism(mb, sh, el, 0.075 * s, 6, jacket, caps=(True, False), r1=0.07 * s)
        prism(mb, el, ha, 0.07 * s, 6, jacket, caps=(False, False), r1=0.065 * s)
        _ball(mb, ha, 0.06 * s, trim, n=6, rings=3)
        hands[sx] = Vector(ha)
    # props
    if prop == 'finger':
        h = hands[1]
        bbox(mb, h.x - 0.08 * s, h.x + 0.08 * s, h.y - 0.02, h.y + 0.14 * s, h.z - 0.03, h.z + 0.03, 0.015, 'Foam')
        bbox(mb, h.x - 0.03 * s, h.x + 0.03 * s, h.y + 0.13 * s, h.y + 0.36 * s, h.z - 0.025, h.z + 0.025, 0.012, 'Foam')
    elif prop == 'flag':
        h = hands[1]
        prism(mb, h - Vector((0, 0.12, 0)), h + Vector((0, 0.75 * s, 0)), 0.024, 5, 'Wood')
        fy = h.y + 0.75 * s; fx = h.x
        for side in (1, -1):
            mb.face([(fx, fy - 0.3 * s, h.z), (fx + 0.45 * s, fy - 0.3 * s, h.z), (fx + 0.45 * s, fy, h.z), (fx, fy, h.z)], 'RPurple', (0, 0, side))
        # a little fox face on it: orange head, two ears, white cheeks
        cx, cy = fx + 0.225 * s, fy - 0.15 * s; k = 0.09 * s
        for side in (1, -1):
            z = h.z + side * 0.004
            mb.face([(cx - k, cy + k * 0.6, z), (cx + k, cy + k * 0.6, z), (cx, cy - k * 1.1, z)], 'ROrange', (0, 0, side))
            for ex in (-1, 1):
                mb.face([(cx + ex * k * 0.95, cy + k * 0.6, z), (cx + ex * k * 0.35, cy + k * 0.6, z), (cx + ex * k * 0.8, cy + k * 1.5, z)], 'ROrange', (0, 0, side))
            mb.face([(cx - k * 0.55, cy + k * 0.05, z + side * 0.002), (cx + k * 0.55, cy + k * 0.05, z + side * 0.002), (cx, cy - k * 1.05, z + side * 0.002)], 'FlagWhite', (0, 0, side))
    elif prop == 'skis':
        sh = Vector(S(-0.24, 1.42, 0.0))
        for dx in (-0.04, 0.04):
            a = sh + Vector((dx, 0.0, -0.95 * s)); b = sh + Vector((dx, 0.02, 0.85 * s))
            hull(mb, [a + Vector((e, f, 0)) for e in (-0.035, 0.035) for f in (0, 0.02)] + [b + Vector((e, f, 0)) for e in (-0.035, 0.035) for f in (0, 0.02)] + [b + Vector((0, 0.08, 0.06))], 'ROrange')
    elif prop == 'sled':
        h = hands[1]; sz = -1.25 * s
        bbox(mb, 0.0, 0.62 * s, 0.12 * s, 0.17 * s, sz - 0.42 * s, sz + 0.42 * s, 0.02, 'SledRed')
        for rx in (0.06 * s, 0.56 * s):
            tube(mb, [(rx, 0.12 * s, sz - 0.42 * s), (rx, 0.03, sz - 0.3 * s), (rx, 0.03, sz + 0.38 * s), (rx, 0.1 * s, sz + 0.55 * s)], 0.015, 4, 'Mullion')
        tube(mb, [(0.31 * s, 0.17 * s, sz + 0.45 * s), tuple(h)], 0.008, 3, 'Wood')
        hull(mb, [(0.31 * s + a * 0.18 * s, 0.17 * s + y, sz + b * 0.2 * s) for a in (-1, 1) for b in (-1, 1) for y in (0.0, 0.14 * s)], 'RYellow')

PEOPLE = [
    dict(H=1.15, skin='Skin1', jacket='RPink', trim='FlagWhite', pants='Pants', hat='RYellow', pom='FlagWhite', scarf='RCyan', pose='sled', prop='sled'),
    dict(H=1.7, skin='Skin2', jacket='RPurple', trim='RYellow', pants='Pants2', hat='ROrange', pom='RYellow', scarf='ROrange', pose='skis', prop='skis'),
    dict(H=1.25, skin='Skin1', jacket='RCyan', trim='RPurple', pants='Pants', hat='RPurple', pom='RPink', scarf='RYellow', pose='wave', prop='finger'),
    dict(H=1.62, skin='Skin3', jacket='ROrange', trim='FlagWhite', pants='Pants', hat='RCyan', pom='FlagWhite', scarf='RPurple', pose='flag', prop='flag'),
    dict(H=1.55, skin='Skin1', jacket='RYellow', trim='RPurple', pants='Pants2', hat='RPink', pom='RPurple', scarf='RPink'),
    dict(H=1.1, skin='Skin2', jacket='RPurple', trim='RCyan', pants='Pants', hat='RCyan', pom='RYellow', scarf='ROrange', pose='wave'),
    dict(H=1.68, skin='Skin2', jacket='RCyan', trim='FlagWhite', pants='Pants2', hat='RPurple', pom='RCyan', scarf='RYellow'),
    dict(H=1.3, skin='Skin3', jacket='RPink', trim='RYellow', pants='Pants', hat='ROrange', pom='FlagWhite', scarf='RPurple', pose='flag', prop='flag'),
]

def build_people():
    c = clear('ws-people'); out = {}
    for i, p in enumerate(PEOPLE):
        mb = MB(); visitor(mb, **p)
        o = build_ws(mb, f'Visitor{i + 1}', c, jit=0.06, seed=80 + i); out[o.name] = mb.tris()
    return out
