import bpy, sys, json
argv = sys.argv[sys.argv.index("--") + 1:]
GLB, objs = argv[0], argv[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
sys.path.insert(0, r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts")
import qa_check
r = qa_check.run(objects=objs, profile="game")
print("QA", json.dumps({k: r[k] for k in ("pass", "errors", "warnings")}))
