"""Headless driver: build, export, preview and QA the ice cave segments.
"C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P run_headless.py -- <icecave_dir> <qa_json> [noprev]
"""
import json
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:]
OUT, QA_JSON = argv[0], argv[1]
DO_PREV = "noprev" not in argv
PREV_DIR = os.path.join(OUT, "previews")
os.makedirs(PREV_DIR, exist_ok=True)

sc = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
sc.name = "LaneA_IceCave"

ns = {"__name__": "icecave"}
exec(open(os.path.join(HERE, "icecave_segment.py")).read(), ns)
info = ns["build_all"](sc)
paths = ns["export_all"](OUT)
report = {"build": info, "glb": {k: os.path.getsize(p) for k, p in paths.items()}}

# QA gate (blender-asset-qa)
sys.path.insert(0, os.path.expanduser(r"~/.claude/skills/blender-asset-qa/scripts"))
import qa_check  # noqa: E402

report["qa"] = {}
for tag in ns["SEGMENTS"]:
    report["qa"][tag] = qa_check.run(objects=[f"SM_IceCave_Segment_{tag}"], profile="game", eps=0.005)


def sheet(tiles, path):
    h, w = tiles[0].shape[:2]
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
    for tag in ns["SEGMENTS"]:
        p = os.path.join(PREV_DIR, f"SM_IceCave_Segment_{tag}.png")
        own = [(f"SM_IceCave_Segment_{tag}", z) for z in (0, 10, 20)]   # the segment tiled with itself
        pv["render_game"](own, 2.0, p, [3.0, 13.0, 23.0])
        pv["render_turntable"](f"SM_IceCave_Segment_{tag}", os.path.join(PREV_DIR, f"SM_IceCave_Segment_{tag}_turntable.png"))
    chain = [("SM_IceCave_Segment_A", 0), ("SM_IceCave_Segment_B", 10), ("SM_IceCave_Segment_A", 20)]
    tiles = []
    for i, cz in enumerate((1.0, 8.0, 15.0)):
        tmp = os.path.join(PREV_DIR, f"_chain_tmp{i}.png")
        pv["render_game"](chain, cz, tmp, [3.0, 13.0, 23.0])
        tiles.append(load(tmp))
        os.remove(tmp)
    sheet(tiles, os.path.join(PREV_DIR, "SM_IceCave_Segment_chain_ABA.png"))
    pv["cleanup"]()

with open(QA_JSON, "w") as f:
    json.dump(report, f, indent=1, default=str)
print("DONE", json.dumps({"glb": report["glb"], "qa_pass": {k: v.get("pass") for k, v in report["qa"].items()}}))
