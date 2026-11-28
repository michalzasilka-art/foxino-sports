# Paddling N20 (lane C): blender-asset-qa on the exported GLBs (each LOD with the drum).
# blender -b --factory-startup -P boat_qa.py -- <glb dir> <qa skill scripts dir>
import bpy, sys, os, json
argv = sys.argv[sys.argv.index("--") + 1:]
GLB, QA = argv[0], argv[1]
sys.path.insert(0, QA)
import qa_check

out = {}
for name in ("Boat_Fox", "Boat_Robot", "Boat_Bear"):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, name + ".glb"))
    for objs in ([name, "Drum"], [name + "_LOD1", "Drum"]):
        r = qa_check.run(objects=objs, profile="game")
        out[objs[0]] = {"pass": r["pass"], "errors": r["errors"], "warnings": r["warnings"],
                        "tris": {k: v.get("tris") for k, v in r["objects"].items()}}
print("QAJSON" + json.dumps(out))
