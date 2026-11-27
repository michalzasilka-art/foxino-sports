"""Headless runner:  blender -b --factory-startup -P ig_props_run.py -- [build] [layout] [inside] [turn]
build: build + asset QA + export GLBs + read them back;  layout: layout json + footprint check;
inside / turn: preview renders. Writes a JSON summary to the lane's temp folder."""
import json
import os
import sys

import bpy

SRC = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(SRC)))), "c-tmp")
QA = os.path.join(os.path.expanduser("~"), ".claude", "skills", "blender-asset-qa", "scripts")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["build", "layout", "inside", "turn"]
out = {}


def load(name):
    g = {"__name__": name}
    p = os.path.join(SRC, name + ".py")
    exec(compile(open(p, encoding="utf-8").read(), p, "exec"), g)
    return g


if "build" in args:
    b = load("ig_props_build")
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    obs = b["build_all"]()
    sys.path.insert(0, QA)
    import qa_check
    out["qa"], out["glb"] = {}, {}
    for n, o in obs.items():
        names = [o.name] + [c.name for c in o.children_recursive]
        r = qa_check.run(objects=names, profile="game")
        out["qa"][n] = {"pass": r["pass"], "errors": r["errors"], "warnings": r["warnings"]}
    if all(v["pass"] for v in out["qa"].values()):
        for m in b["MODELS"]:
            p = b["export_model"](m)
            i = b["glb_info"](p)
            i["size"] = os.path.getsize(p)
            out["glb"][m] = i
if any(a in args for a in ("layout", "inside", "turn")):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    L = load("ig_props_layout")
    out["layout"] = L["run"](render_inside="inside" in args, render_turn="turn" in args)
with open(os.path.join(TMP, "run_" + "_".join(args) + ".json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, default=str)
print("RUN-DONE")
