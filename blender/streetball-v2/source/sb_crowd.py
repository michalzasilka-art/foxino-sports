# sb-crowd: six seated fans, Fan1..Fan6, each at the origin: the seat contact point under the bottom, facing +z
# (glTF), feet resting 0.4 m lower and 0.4 m forward (the next footboard). Low poly, flat shaded, arms half up.
PAL.update({'Skin1': 'f3c7a2', 'Skin2': 'c98a5f', 'Skin3': '8c5a3c', 'Hair1': '3a2a22', 'Hair2': 'e8b44a', 'Hair3': '1f1b1d',
            'Jeans': '3b5a9a', 'Shorts': '2d2f45', 'Shoe': 'f2f2f2', 'Sign': 'fffaf0', 'Foam': 'ffcd1c', 'Red': 'ff4a4a'})

def _sphere(mb, c, r, mat, n=8, rings=5, sy=1.0):
    pts = []
    for i in range(rings + 1):
        la = -math.pi / 2 + math.pi * i / rings
        for k in range(n if 0 < i < rings else 1):
            a = 2 * math.pi * k / n + (math.pi / n if i % 2 else 0)
            pts.append((c[0] + r * math.cos(la) * math.cos(a), c[1] + r * sy * math.sin(la), c[2] + r * math.cos(la) * math.sin(a)))
    hull(mb, pts, mat)

def limb(mb, a, b, r0, r1, mat):
    prism(mb, a, b, r0, 6, mat, caps=(False, True), r1=r1)

def fan(mb, sk, shirt, legs, hair, kid=False, cap=None, prop=None, arms='up', seed=0):
    s = 0.8 if kid else 1.0
    S = lambda v: tuple(x * s for x in v)
    # legs: thighs forward, shins down to the footboard
    for sx in (-1, 1):
        hipp = S((sx * 0.09, 0.08, 0.02)); knee = S((sx * 0.1, 0.1, 0.4)); foot = S((sx * 0.11, -0.36, 0.44))
        limb(mb, hipp, knee, 0.075 * s, 0.065 * s, legs); limb(mb, knee, foot, 0.06 * s, 0.05 * s, legs if legs != 'Shorts' else sk)
        bbox(mb, foot[0] - 0.05 * s, foot[0] + 0.05 * s, foot[1] - 0.06 * s, foot[1] + 0.0, foot[2] - 0.05 * s, foot[2] + 0.12 * s, 0.02, 'Shoe')
    # torso (a chamfered block that narrows at the waist) and neck
    hull(mb, [(x * s, y * s, z * s) for x, y, z in ((-0.15, 0.04, -0.1), (0.15, 0.04, -0.1), (-0.15, 0.04, 0.12), (0.15, 0.04, 0.12),
                                                     (-0.18, 0.42, -0.08), (0.18, 0.42, -0.08), (-0.17, 0.44, 0.08), (0.17, 0.44, 0.08),
                                                     (-0.1, 0.5, -0.05), (0.1, 0.5, -0.05), (-0.1, 0.5, 0.05), (0.1, 0.5, 0.05))], shirt)
    limb(mb, S((0, 0.48, 0)), S((0, 0.58, 0.01)), 0.045 * s, 0.045 * s, sk)
    # head, hair or cap, nose
    hc = S((0, 0.68, 0.02)); hr = 0.115 * (1.1 if kid else 1.0) * s
    _sphere(mb, hc, hr, sk, n=8, rings=5)
    hull(mb, [(hc[0] + 0.02 * a, hc[1] + 0.0 + 0.02 * b, hc[2] + hr * 0.95 + 0.025 * c) for a in (-1, 1) for b in (-1, 1) for c in (0, 1)], sk)
    for sx in (-1, 1):      # eyes
        mb.face([(hc[0] + sx * 0.04 * s + dx, hc[1] + 0.02 * s + dy, hc[2] + hr * 0.93) for dx, dy in ((-0.012, -0.015), (0.012, -0.015), (0.012, 0.015), (-0.012, 0.015))], 'Black', (0, 0, 1))
    if cap:
        lathe(mb, [(hr * 1.06, hc[1] + 0.01 * s), (hr * 0.95, hc[1] + hr * 0.6), (hr * 0.45, hc[1] + hr * 1.0), (0, hc[1] + hr * 1.08)], 8, cap, c=(hc[0], 0, hc[2]))
        hull(mb, [(hc[0] + a * hr * 0.8, hc[1] + 0.01 * s + d, hc[2] + hr * (0.6 + b)) for a in (-1, 1) for b in (0.0, 0.75) for d in (0, 0.015)], 'Orange')
        if cap == 'Purple':     # Foxino cap: two little ears
            for sx in (-1, 1):
                hull(mb, [(hc[0] + sx * hr * 0.55, hc[1] + hr * 0.75, hc[2] - 0.03), (hc[0] + sx * hr * 0.9, hc[1] + hr * 0.6, hc[2] - 0.03),
                          (hc[0] + sx * hr * 0.75, hc[1] + hr * 1.35, hc[2] - 0.02), (hc[0] + sx * hr * 0.7, hc[1] + hr * 0.7, hc[2] + 0.02)], 'Purple')
    else:
        lathe(mb, [(hr * 1.05, hc[1] - 0.01 * s), (hr * 0.98, hc[1] + hr * 0.55), (hr * 0.5, hc[1] + hr * 1.02), (0, hc[1] + hr * 1.1)], 8, hair, c=(hc[0], 0, hc[2] - 0.012))
    # arms: shoulders out, hands half up (or up high)
    hands = []
    for sx in (-1, 1):
        sh = S((sx * 0.19, 0.42, 0.0))
        if arms == 'up': el = S((sx * 0.3, 0.55, 0.08)); ha = S((sx * 0.3, 0.8, 0.12))
        elif arms == 'sign': el = S((sx * 0.28, 0.6, 0.1)); ha = S((sx * 0.22, 0.88, 0.14))
        else: el = S((sx * 0.28, 0.5, 0.12)); ha = S((sx * 0.22, 0.7, 0.24))
        if prop == 'finger' and sx > 0: el = S((sx * 0.28, 0.6, 0.06)); ha = S((sx * 0.26, 0.86, 0.1))
        limb(mb, sh, el, 0.05 * s, 0.045 * s, shirt); limb(mb, el, ha, 0.042 * s, 0.038 * s, sk)
        _sphere(mb, ha, 0.045 * s, sk, n=6, rings=3)
        hands.append(ha)
    if prop == 'finger':        # a foam finger on the left hand ("#1")
        h = hands[1]
        bbox(mb, h[0] - 0.07, h[0] + 0.07, h[1] - 0.04, h[1] + 0.12, h[2] - 0.03, h[2] + 0.03, 0.015, 'Foam')
        bbox(mb, h[0] - 0.025, h[0] + 0.025, h[1] + 0.1, h[1] + 0.3, h[2] - 0.025, h[2] + 0.025, 0.012, 'Foam')
        mb.face([(h[0] - 0.05, h[1] - 0.02, h[2] + 0.032), (h[0] + 0.05, h[1] - 0.02, h[2] + 0.032), (h[0] + 0.05, h[1] + 0.07, h[2] + 0.032), (h[0] - 0.05, h[1] + 0.07, h[2] + 0.032)], 'Purple', (0, 0, 1))
    if prop in ('go', 'rob'):  # a sign held up in both hands
        (x0, y0, z0), (x1, y1, z1) = hands
        cy = (y0 + y1) / 2 + 0.13 * s; cz = max(z0, z1) + 0.03
        W, H = 0.58 * s, 0.3 * s
        bbox(mb, -W / 2, W / 2, cy - H / 2, cy + H / 2, cz, cz + 0.02, 0.008, 'Sign')
        txt, col = ('GO FOXINO', 'Purple') if prop == 'go' else ('ROB #7', 'Cyan')
        for pts in text_polys(txt, size=0.11 * s if prop == 'go' else 0.14 * s, offset=0.004, res=1):
            mb.face([(x, y + cy - 0.04 * s, cz + 0.022) for x, y in pts], col, (0, 0, 1))
        mb.face([(-W / 2 + 0.02, cy - H / 2 + 0.02, cz + 0.021), (W / 2 - 0.02, cy - H / 2 + 0.02, cz + 0.021), (W / 2 - 0.02, cy - H / 2 + 0.05, cz + 0.021),
                 (-W / 2 + 0.02, cy - H / 2 + 0.05, cz + 0.021)], 'Orange' if prop == 'go' else 'Purple', (0, 0, 1))
    if prop == 'pompom':
        for h in hands:
            pts = [(h[0] + 0.09 * math.cos(a) * math.cos(b), h[1] + 0.06 + 0.09 * math.sin(b), h[2] + 0.09 * math.sin(a) * math.cos(b))
                   for a in [k * 1.1 for k in range(6)] for b in (-0.6, 0.3, 1.2)]
            hull(mb, pts, 'Pink')

FANS = [
    dict(sk='Skin1', shirt='Orange', legs='Jeans', hair='Hair1', cap='Purple', prop=None, arms='up'),
    dict(sk='Skin2', shirt='Purple', legs='Shorts', hair='Hair3', prop='finger', arms='half'),
    dict(sk='Skin1', shirt='Cyan', legs='Jeans', hair='Hair2', prop='go', arms='sign', kid=True),
    dict(sk='Skin3', shirt='Yellow', legs='Shorts', hair='Hair3', cap='Purple', arms='up', kid=True),
    dict(sk='Skin2', shirt='White', legs='Jeans', hair='Hair1', prop='rob', arms='sign'),
    dict(sk='Skin1', shirt='Pink', legs='Shorts', hair='Hair2', prop='pompom', arms='half', kid=True),
]

def build_crowd():
    c = clear('sb-crowd'); out = {}
    for i, f in enumerate(FANS):
        mb = MB(); fan(mb, seed=i, **f)
        o = build(mb, f'Fan{i + 1}', c); out[o.name] = mb.tris()
    return out
