# ws-podium: one winter champion's podium centred at the origin (the code places two). Objects: Podium (a chunky
# faceted pedestal of snowy stone with a gold trim band, two short steps on the +z side, small ice crystals and a puffy
# snow drift round its foot), PodiumTop (the frosted ice disc, top surface exactly y 0.31, material PodiumTop) and
# PodiumRing (a thin glowing ring round the top edge, material PodiumGlow, white: the code tints it).
PAL.update({'PodiumTop': 'e6f8ff', 'PodiumGlow': 'ffffff', 'PodiumStone': 'cfc8e8', 'PodiumStone2': 'bdb5dc'})
GLOW.update({'PodiumGlow': 3.0})
TOPY = 0.31

def build_podium():
    c = clear('ws-podium')
    mb = MB(); N = 12; rot = math.pi / N
    lathe(mb, [(1.15, 0.0), (1.15, 0.06), (1.1, 0.1), (1.06, 0.115), (1.06, 0.17), (1.03, 0.19), (1.0, 0.255), (0.96, 0.255)], N, 'PodiumStone', rot=rot,
          mats=['PodiumStone2', 'PodiumStone', 'PodiumStone', 'Gold', 'PodiumStone', 'PodiumStone', 'PodiumStone'])
    # gold studs on the band
    for k in range(N):
        a = rot + 2 * math.pi * (k + 0.5) / N
        x, z = 1.075 * math.cos(a), 1.075 * math.sin(a)
        hull(mb, [(x + 0.03 * math.cos(a + d), y, z + 0.03 * math.sin(a + d)) for d in (-1.6, 1.6) for y in (0.125, 0.16)] + [(1.1 * math.cos(a), 0.1425, 1.1 * math.sin(a))], 'Gold')
    # two short steps on the front
    for (w, z0, z1, y1) in ((0.95, 1.0, 1.42, 0.1), (0.8, 0.9, 1.2, 0.2)):
        obox(mb, (0, (z0 + z1) / 2), 0, w, z1 - z0, 0.0, y1, 0.025, 'PodiumStone')
    for sx in (-1, 1):          # snow at the step ends
        snowcap(mb, [(sx * 0.42, 1.12), (sx * 0.5, 1.12), (sx * 0.5, 1.38), (sx * 0.4, 1.38)], 0.1, h=0.06, over=0.03, seed=3 + sx)
    # a puffy drift round the foot, open at the steps
    rnd = random.Random(8)
    for k in range(10):
        a0 = math.radians(115 + 31 * k); a1 = a0 + math.radians(30)
        if math.radians(60) < (a0 % (2 * math.pi)) < math.radians(120): continue
        pts = []
        for a in (a0, (a0 + a1) / 2, a1):
            for r, y in ((1.12, 0.0), (1.42 + rnd.uniform(0, 0.12), 0.0), (1.2, 0.13 + rnd.uniform(0, 0.06)), (1.32, 0.09)):
                pts.append((r * math.cos(a), y, r * math.sin(a)))
        hull(mb, pts, snow_mat, skip_down=True)
    # little ice crystals in the drift
    for k, (a, h, r) in enumerate(((200, 0.42, 0.06), (215, 0.3, 0.05), (330, 0.38, 0.055), (345, 0.26, 0.045), (150, 0.32, 0.05), (20, 0.28, 0.045))):
        ar = math.radians(a); cx, cz = 1.28 * math.cos(ar), 1.28 * math.sin(ar)
        tilt = Vector((math.cos(ar) * 0.35, 1, math.sin(ar) * 0.35)).normalized()
        a_, b_ = frame_of(tilt); base = Vector((cx, 0.05, cz))
        ring0 = [base + (a_ * math.cos(2 * math.pi * i / 6) + b_ * math.sin(2 * math.pi * i / 6)) * r for i in range(6)]
        ring1 = [p + tilt * h * 0.75 for p in ring0]; tip = base + tilt * h
        for i in range(6):
            j = (i + 1) % 6
            mb.face([ring0[i], ring0[j], ring1[j], ring1[i]], 'Ice' if i % 2 else 'IceDeep', (ring0[i] + ring0[j]) / 2 - base)
            mb.face([ring1[i], ring1[j], tip], 'Ice' if i % 2 else 'Glow', (ring1[i] + ring1[j]) / 2 - (base + tilt * h * 0.75))
    build_ws(mb, 'Podium', c, jit=0.06, seed=31)
    # the frosted ice top: faceted side, flat top at y 0.31
    tp = MB(); R0 = 0.955
    lathe(tp, [(R0, 0.25), (R0 + 0.01, 0.29), (R0 - 0.01, TOPY)], 24, 'PodiumTop', rot=0)
    pts = [(R0 - 0.01) * Vector((math.cos(2 * math.pi * k / 24), 0, math.sin(2 * math.pi * k / 24))) + Vector((0, TOPY, 0)) for k in range(24)]
    cen = Vector((0, TOPY, 0))
    for k in range(24):         # a fan of facets (all flat at y 0.31) so the frost catches the light in sectors
        tp.face([cen, pts[(k + 1) % 24], pts[k]], 'PodiumTop', (0, 1, 0))
    build_ws(tp, 'PodiumTop', c, jit=0.05, seed=32)
    m = bpy.data.materials.get('PodiumTop')
    if m: m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.2
    # the glowing ring round the top edge
    rg = MB(); n = 48; ri, ro = 0.955, 1.02; y0, y1 = 0.29, TOPY + 0.025
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        P = lambda r, y, a: (r * math.cos(a), y, r * math.sin(a))
        rg.face([P(ri, y1, a0), P(ri, y1, a1), P(ro, y1, a1), P(ro, y1, a0)], 'PodiumGlow', (0, 1, 0))
        rg.face([P(ro, y0, a0), P(ro, y1, a0), P(ro, y1, a1), P(ro, y0, a1)], 'PodiumGlow', (math.cos(a0 + math.pi / n), 0, math.sin(a0 + math.pi / n)))
        rg.face([P(ri, y1, a0), P(ri, TOPY + 0.001, a0), P(ri, TOPY + 0.001, a1), P(ri, y1, a1)], 'PodiumGlow', (-math.cos(a0), 0, -math.sin(a0)))
    build_ws(rg, 'PodiumRing', c, jit=0.0, seed=33)
