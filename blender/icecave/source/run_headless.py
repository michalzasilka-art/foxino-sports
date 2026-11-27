"""Headless driver: build, export, preview and QA the ice cave segments A, B and C (W2b).
"C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P run_headless.py -- <icecave_dir> <qa_json> [noprev] [tmpdir=<dir>]
"""
import itertools
import json
import os
import struct
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:]
OUT, QA_JSON = argv[0], argv[1]
DO_PREV = "noprev" not in argv
TMP = next((a.split("=", 1)[1] for a in argv if a.startswith("tmpdir=")), os.path.dirname(QA_JSON))
PREV_DIR = os.path.join(OUT, "previews")
os.makedirs(PREV_DIR, exist_ok=True)

sc = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
sc.name = "LaneA_IceCave"

ns = {"__name__": "icecave"}
exec(open(os.path.join(HERE, "icecave_segment.py")).read(), ns)
TAGS = list(ns["SEGMENTS"])
info = ns["build_all"](sc)
paths = ns["export_all"](OUT)
report = {"build": info, "glb": {k: os.path.getsize(p) for k, p in paths.items()}}


# ---- rock share and texture seam, measured on the exported (JPEG) base colour
def glb_image(path, which="baseColorTexture"):
    b = open(path, "rb").read()
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    binc = b[20 + jl + 8:]
    pbr = js["materials"][0]["pbrMetallicRoughness"]
    ti = pbr[which]["index"] if which in pbr else js["materials"][0][which]["index"]
    img = js["images"][js["textures"][ti]["source"]]
    bv = js["bufferViews"][img["bufferView"]]
    data = binc[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
    tmp = os.path.join(TMP, f"_probe_{os.path.basename(path)}_{which}.jpg")
    open(tmp, "wb").write(data)
    im = bpy.data.images.load(tmp)
    w, h = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., :3]
    bpy.data.images.remove(im)
    os.remove(tmp)
    return px, img.get("mimeType")


tex = {}
for tag in TAGS:
    px, mime = glb_image(paths[tag])
    tex[tag] = px
    W = px.shape[1]
    inner = px[:, : int(ns["U1"] * W) - 2]
    rock = (inner[..., 2] - inner[..., 0]) < 0.06            # grey-brown (blue not above red) = bare rock
    ys = (np.arange(inner.shape[1]) + 0.5) / W / ns["U1"] * ns["L"]
    yy = np.interp(ys, ns["SC"], ns["PC"][:, 1])
    bands = {}
    for nm, lo, hi in (("y0-1", 0, 1), ("y1-2.5", 1, 2.5), ("y2.5-4.5", 2.5, 4.5), ("y4.5+", 4.5, 9)):
        m = (yy >= lo) & (yy < hi)
        bands[nm] = round(float(rock[:, m].mean()), 3)
    report.setdefault("rock_share", {})[tag] = dict(share=round(float(rock.mean()), 4), bands=bands, mime=mime)
seam = {}
for a, b in itertools.product(TAGS, TAGS):
    W = tex[a].shape[1]
    cu = int(ns["U1"] * W) - 2
    d = np.abs(tex[a][-1, :cu] - tex[b][0, :cu]).mean()
    seam[f"{a}->{b}"] = round(float(d), 4)
ref = {t: round(float(np.abs(tex[t][1:, :int(ns["U1"] * tex[t].shape[1]) - 2] -
                              tex[t][:-1, :int(ns["U1"] * tex[t].shape[1]) - 2]).mean()), 4) for t in TAGS}
report["texture_seam_mean_abs_diff"] = dict(pairs=seam, neighbour_rows_inside=ref)

# QA gate (blender-asset-qa)
sys.path.insert(0, os.path.expanduser(r"~/.claude/skills/blender-asset-qa/scripts"))
import qa_check  # noqa: E402

report["qa"] = {}
for tag in TAGS:
    report["qa"][tag] = qa_check.run(objects=[f"SM_IceCave_Segment_{tag}"], profile="game", eps=0.005)


def sheet(tiles, path):
    h = tiles[0].shape[0]
    arr = np.concatenate(tiles, 1)
    im = bpy.data.images.new("sheet_tmp", arr.shape[1], h, alpha=True)
    im.pixels.foreach_set(arr.ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def load(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(im)
    return px


if DO_PREV:
    pv = {"__name__": "icecave_prev"}
    exec(open(os.path.join(HERE, "icecave_preview.py")).read(), pv)
    for tag in TAGS:
        p = os.path.join(PREV_DIR, f"SM_IceCave_Segment_{tag}.png")
        own = [(f"SM_IceCave_Segment_{tag}", z) for z in (0, 10, 20)]   # the segment tiled with itself
        pv["render_game"](own, 2.0, p, [3.0, 13.0, 23.0])
        pv["render_turntable"](f"SM_IceCave_Segment_{tag}", os.path.join(PREV_DIR, f"SM_IceCave_Segment_{tag}_turntable.png"))
    chain = [("SM_IceCave_Segment_A", 0), ("SM_IceCave_Segment_B", 10), ("SM_IceCave_Segment_C", 20)]
    tiles = []
    for i, cz in enumerate((0.5, 5.5, 10.5)):
        tmp = os.path.join(TMP, f"_chain_tmp{i}.png")
        pv["render_game"](chain, cz, tmp, [3.0, 13.0, 23.0])
        tiles.append(load(tmp))
        os.remove(tmp)
    sheet(tiles, os.path.join(PREV_DIR, "SM_IceCave_Segment_chain_ABC.png"))
    # extra: wide inside views of the A->B->C chain (left and right walls), same dark lighting
    wsc = pv["fresh_scene"]()
    for n, z in chain:
        pv["inst"](wsc, n, z)
    pv["floor"](wsc, 0, 30)
    pv["cave_lights"](wsc, [5.0, 15.0, 25.0])
    wt = []
    for i, (cx, tx) in enumerate(((-3, 4), (3, -4))):
        pv["camera"](wsc, pv["g2b"](cx, 2.5, 1), pv["g2b"](tx, 2.2, 14), lens=14, w=1280, h=720)
        tmp = os.path.join(TMP, f"_wide_tmp{i}.png")
        pv["render"](wsc, tmp)
        wt.append(load(tmp))
        os.remove(tmp)
    h0 = wt[0].shape[0]
    arr = np.concatenate([wt[1], wt[0]], 0)          # pixel rows go bottom-up: right-wall view on top
    im = bpy.data.images.new("wide_tmp", arr.shape[1], arr.shape[0], alpha=True)
    im.pixels.foreach_set(arr.ravel())
    im.filepath_raw = os.path.join(PREV_DIR, "SM_IceCave_Segment_chain_ABC_wide.png")
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)
    pv["cleanup"]()

with open(QA_JSON, "w") as f:
    json.dump(report, f, indent=1, default=str)
print("DONE", json.dumps({"glb": report["glb"], "rock": {k: v["share"] for k, v in report["rock_share"].items()},
                          "qa_pass": {k: v.get("pass") for k, v in report["qa"].items()}}))
