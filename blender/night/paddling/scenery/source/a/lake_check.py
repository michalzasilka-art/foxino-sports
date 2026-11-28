"""Read the exported GLBs back and check the contract + asset QA (headless).
blender -b --factory-startup -P lake_check.py -- <glb> [<glb> ...]
Works in glTF axes for the contract numbers (x, y up, z forward)."""
import bpy, sys, json, struct, os
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
sys.path.insert(0, r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts")


def glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    ln = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + ln])
    binln = struct.unpack_from("<I", data, 20 + ln)[0]
    binb = data[28 + ln:28 + ln + binln]
    return j, binb


def accessor(j, binb, i):
    a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]
    comp = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a["componentType"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = np.frombuffer(binb, comp, a["count"] * n, off)
    return arr.reshape(-1, n) if n > 1 else arr


report = {}
for path in argv:
    j, binb = glb_json(path)
    name = os.path.splitext(os.path.basename(path))[0]
    r = {"size_bytes": os.path.getsize(path), "nodes": [], "materials": [], "images": [],
         "extensions": j.get("extensionsUsed", []), "cameras": len(j.get("cameras", [])),
         "lights": "KHR_lights_punctual" in j.get("extensionsUsed", [])}
    for m in j["materials"]:
        pbr = m.get("pbrMetallicRoughness", {})
        r["materials"].append({"name": m["name"], "doubleSided": m.get("doubleSided", False),
                               "baseTex": "baseColorTexture" in pbr, "normalTex": "normalTexture" in m,
                               "rough": pbr.get("roughnessFactor", 1), "metal": pbr.get("metallicFactor", 1),
                               "baseFactor": pbr.get("baseColorFactor")})
    for im in j.get("images", []):
        r["images"].append({"mime": im.get("mimeType"), "bytes": j["bufferViews"][im["bufferView"]]["byteLength"]})
    allpos = []
    for nd in j["nodes"]:
        e = {"name": nd["name"], "trs": [k for k in ("translation", "rotation", "scale", "matrix") if k in nd],
             "children": [j["nodes"][c]["name"] for c in nd.get("children", [])]}
        if "mesh" in nd:
            me = j["meshes"][nd["mesh"]]; tris = 0; pos = []
            prims = []
            for pr in me["primitives"]:
                idx = accessor(j, binb, pr["indices"]); tris += len(idx) // 3
                P = accessor(j, binb, pr["attributes"]["POSITION"]).copy(); pos.append(P)
                prims.append({"material": j["materials"][pr["material"]]["name"], "tris": len(idx) // 3,
                              "attrs": sorted(pr["attributes"].keys())})
                if "TEXCOORD_0" in pr["attributes"]:
                    uv = accessor(j, binb, pr["attributes"]["TEXCOORD_0"])
                    prims[-1]["uv_range"] = [uv.min(0).round(4).tolist(), uv.max(0).round(4).tolist()]
                    if nd["name"] == "SignFace":
                        prims[-1]["corner_uvs"] = {str(P[i].round(3).tolist()): uv[i].round(3).tolist()
                                                   for i in range(len(P))}
                if nd["name"] == "SignFace":
                    N = accessor(j, binb, pr["attributes"]["NORMAL"])
                    prims[-1]["normal_mean"] = N.mean(0).round(3).tolist()
            P = np.vstack(pos); allpos.append(P)
            e.update({"tris": tris, "prims": prims, "min": P.min(0).round(4).tolist(), "max": P.max(0).round(4).tolist()})
        r["nodes"].append(e)
    P = np.vstack(allpos)
    r["bounds_min"] = P.min(0).round(5).tolist(); r["bounds_max"] = P.max(0).round(5).tolist()
    r["tris_total"] = sum(n.get("tris", 0) for n in r["nodes"])
    if name == "SM_RaceArch":
        bad = P[(np.abs(P[:, 0]) < 19.0 - 1e-4) & (P[:, 1] < 6.2 - 1e-4)]
        r["check_inside_span_below_6.2"] = int(len(bad))
        body = [n for n in r["nodes"] if n["name"] == "SM_RaceArch"][0]
        # inner leg faces: nearest |x| of geometry below the banner top
        Q = P[P[:, 1] < 6.2 - 1e-4]
        r["check_min_abs_x_below_6.2"] = float(np.abs(Q[:, 0]).min().round(5))
        sf = [n for n in r["nodes"] if n["name"] == "SignFace"][0]
        r["check_signface_size"] = [round(sf["max"][0] - sf["min"][0], 4), round(sf["max"][1] - sf["min"][1], 4)]
        r["check_banner_bottom_y"] = sf["min"][1]
    if name == "SM_Pontoon":
        r["check_x_bounds"] = [float(P[:, 0].min()), float(P[:, 0].max())]
        r["check_z_bounds"] = [float(P[:, 2].min()), float(P[:, 2].max())]
        deck = P[np.abs(P[:, 0]) > 3.0]          # away from the cleats
        r["check_deck_top_y"] = float(deck[:, 1].max())
        # tiling: 5 modules every 7.4 m -> gaps / overlaps between neighbours
        spans = [(-3.7 + 7.4 * k + float(P[:, 0].min()) + 3.7, 7.4 * k + float(P[:, 0].max())) for k in range(5)]
        r["check_tiling_gaps"] = [round(spans[k + 1][0] - spans[k][1], 7) for k in range(4)]
    if name == "SM_LanePost":
        sf = [n for n in r["nodes"] if n["name"] == "SignFace"][0]
        r["check_signface_size"] = [round(sf["max"][0] - sf["min"][0], 4), round(sf["max"][1] - sf["min"][1], 4)]
        r["check_base_y"] = float(P[:, 1].min())
    # Blender import + asset QA
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    import importlib, qa_check
    importlib.reload(qa_check)
    obs = [o.name for o in bpy.data.objects if o.type == "MESH"]
    q = qa_check.run(objects=obs, profile="game")
    r["qa"] = {k: q[k] for k in ("pass", "errors", "warnings")}
    report[name] = r
print("CHECK", json.dumps(report, indent=1))
