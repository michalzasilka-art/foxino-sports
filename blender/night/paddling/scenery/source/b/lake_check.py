"""Read every GLB back: glTF nodes/materials/bounds/tris, then blender-asset-qa (game profile).
blender -b --factory-startup -P lake_check.py -- <dir> <out.json> SM_Buoy SM_Buoy_Big ..."""
import bpy, sys, json, struct, os
argv = sys.argv[sys.argv.index("--") + 1:]
D, OUTJ, names = argv[0], argv[1], argv[2:]
sys.path.insert(0, r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts")
import qa_check


def gltf_json(path):
    b = open(path, "rb").read()
    n = struct.unpack_from("<I", b, 12)[0]
    return json.loads(b[20:20 + n]), b


res = {}
for nm in names:
    path = os.path.join(D, nm + ".glb")
    g, raw = gltf_json(path)
    info = {"bytes": os.path.getsize(path), "nodes": [], "materials": [], "extensions": g.get("extensionsUsed", [])}
    for n in g["nodes"]:
        info["nodes"].append({"name": n.get("name"), "mesh": "mesh" in n, "children": n.get("children", []),
                              "trs": {k: n[k] for k in ("translation", "rotation", "scale", "matrix") if k in n}})
    for m in g.get("materials", []):
        pbr = m.get("pbrMetallicRoughness", {})
        info["materials"].append({"name": m["name"], "doubleSided": m.get("doubleSided", False),
                                  "base": [round(x, 3) for x in pbr.get("baseColorFactor", [1, 1, 1, 1])],
                                  "rough": pbr.get("roughnessFactor", 1), "metal": pbr.get("metallicFactor", 1)})
    tris, mn, mx = {}, [1e9] * 3, [-1e9] * 3
    for ni, n in enumerate(g["nodes"]):
        if "mesh" not in n:
            continue
        t = 0
        for p in g["meshes"][n["mesh"]]["primitives"]:
            acc = g["accessors"][p["indices"]]
            t += acc["count"] // 3
            pa = g["accessors"][p["attributes"]["POSITION"]]
            mn = [min(a, b) for a, b in zip(mn, pa["min"])]
            mx = [max(a, b) for a, b in zip(mx, pa["max"])]
        tris[n["name"]] = t
    info["tris"] = tris
    info["tris_total"] = sum(tris.values())
    info["bounds_gltf"] = {"min": [round(x, 4) for x in mn], "max": [round(x, 4) for x in mx]}
    # import + QA
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.gltf(filepath=path)
    obs = [o.name for o in bpy.data.objects if o.type == "MESH"]
    tol = 0.012 if nm == "SM_TeamFlag" else 0.002  # SignFace hovers 8 mm in front of the cloth on purpose
    r = qa_check.run(objects=obs, profile="game", tol=tol)
    info["qa"] = {k: r[k] for k in ("pass", "errors", "warnings", "ground_z")}
    info["qa"]["enclosed"] = r.get("enclosed")
    info["qa"]["per"] = {k: {kk: v for kk, v in m.items() if kk in ("tris", "uv_maps", "uv_overlap_pct", "uv_zero_area_faces", "dimensions")}
                         for k, m in r["objects"].items()}
    res[nm] = info
json.dump(res, open(OUTJ, "w"), indent=1)
print("CHECK", json.dumps({k: (v["tris"], v["qa"]["pass"], v["qa"]["errors"]) for k, v in res.items()}))
