# sb-fences: chain-link fences on the left (x = -8.98), right (x = +8.98) and back (z = -2.55) of the court, gaps at the
# two back corners. Posts with caps and concrete collars, top / middle / bottom rails (object Fences); the mesh panels
# are ChainLinkLeft / ChainLinkRight / ChainLinkBack (one quad per bay, UV: 1 unit = 0.5 m along and up), with a 256 px
# see-through chain texture (alpha mask) so they work as they come.
FX = 8.98; FZ0, FZ1 = -1.6, 14.7; FB_Z = -2.55; FB_X = 7.3; HS, HB = 2.6, 3.6

def chain_image():
    import numpy as np
    im = bpy.data.images.get('sb_chainlink')
    if im: return im
    N = 256; im = bpy.data.images.new('sb_chainlink', N, N, alpha=True)
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) + 0.5
    P = N / 4.0                       # 4 diamonds across a tile
    d1 = np.abs(((x + y) % P) - P / 2); d2 = np.abs(((x - y) % P) - P / 2)
    w = 2.6
    a = np.clip(w - np.minimum(P / 2 - d1, P / 2 - d2) + 0.5, 0, 1)
    rgba = np.zeros((N, N, 4), np.float32)
    rgba[..., 0] = 0.66; rgba[..., 1] = 0.7; rgba[..., 2] = 0.76; rgba[..., 3] = a
    im.pixels.foreach_set(rgba.ravel()); im.update(); im.pack()
    return im

def chain_mat():
    m = bpy.data.materials.get('ChainLink')
    if m and m.node_tree.nodes.get('Image Texture'): return m
    m = MAT('ChainLink'); nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = chain_image()
    rd = nt.nodes.new('ShaderNodeMath'); rd.operation = 'ROUND'
    nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tx.outputs['Alpha'], rd.inputs[0]); nt.links.new(rd.outputs[0], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = 0.6
    m.use_backface_culling = False
    try: m.surface_render_method = 'DITHERED'
    except Exception: pass
    return m

def build_fences():
    c = clear('sb-fences'); mb = MB()
    chain_mat()
    def post(x, z, h, big=False):
        r = 0.055 if big else 0.042
        bbox(mb, x - 0.11, x + 0.11, -0.02, 0.07, z - 0.11, z + 0.11, 0.025, 'ConcreteDark', skip_down=True)
        prism(mb, (x, 0.06, z), (x, h + 0.03, z), r, 8, 'Metal', caps=(False, False))
        lathe(mb, [(r + 0.012, h + 0.03), (r + 0.012, h + 0.07), (r * 0.6, h + 0.11), (0, h + 0.12)], 8, 'Metal', c=(x, 0, z))
    def run(p0, p1, n, h, name, mid=False):
        p0, p1 = Vector(p0), Vector(p1)
        L = (p1 - p0).length; pm = MB()
        for k in range(n + 1):
            p = p0 + (p1 - p0) * k / n; post(p.x, p.z, h, big=(k in (0, n)))
        for y, r in ((h - 0.02, 0.03), (0.12, 0.018)) + (((h * 0.55, 0.022),) if mid else ()):
            prism(mb, (p0.x, y, p0.z), (p1.x, y, p1.z), r, 6, 'Metal', caps=(True, True))
        nrm = Vector((0, 1, 0)).cross(p1 - p0)       # panels face this side (double sided anyway)
        for k in range(n):
            a = p0 + (p1 - p0) * k / n; b = p0 + (p1 - p0) * (k + 1) / n
            u0, u1 = 2 * L * k / n, 2 * L * (k + 1) / n; y0, y1 = 0.1, h - 0.03
            pm.face([(a.x, y0, a.z), (b.x, y0, b.z), (b.x, y1, b.z), (a.x, y1, a.z)], 'ChainLink', nrm,
                    uv=[(u0, 2 * y0), (u1, 2 * y0), (u1, 2 * y1), (u0, 2 * y1)])
        build(pm, name, c)
    run((-FX, 0, FZ1), (-FX, 0, FZ0), 7, HS, 'ChainLinkLeft')
    run((FX, 0, FZ0), (FX, 0, FZ1), 7, HS, 'ChainLinkRight')
    run((-FB_X, 0, FB_Z), (FB_X, 0, FB_Z), 6, HB, 'ChainLinkBack', mid=True)
    build(mb, 'Fences', c)
