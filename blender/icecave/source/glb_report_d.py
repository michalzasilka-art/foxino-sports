# Read GLBs back: nodes, meshes, triangles, materials, textures, bounds (game axes: +Y up, +Z run).
import json, struct, sys, os


def report(path):
    b = open(path, "rb").read()
    magic, ver, length = struct.unpack_from("<III", b, 0)
    clen, ctype = struct.unpack_from("<II", b, 12)
    j = json.loads(b[20:20 + clen])
    acc = j["accessors"]
    tris, lo, hi = {}, [1e9] * 3, [-1e9] * 3
    for m in j.get("meshes", []):
        t = 0
        for p in m["primitives"]:
            t += acc[p["indices"]]["count"] // 3
            a = acc[p["attributes"]["POSITION"]]
            for i in range(3):
                lo[i] = min(lo[i], a["min"][i])
                hi[i] = max(hi[i], a["max"][i])
        tris[m["name"]] = t
    nodes = [(n.get("name"), n.get("mesh"), n.get("children", []), n.get("translation"), n.get("rotation"), n.get("scale"))
             for n in j.get("nodes", [])]
    imgs = [(im.get("name"), im.get("mimeType"), j["bufferViews"][im["bufferView"]]["byteLength"]) for im in j.get("images", [])]
    mats = []
    for m in j.get("materials", []):
        pb = m.get("pbrMetallicRoughness", {})
        mats.append({"name": m["name"], "base": pb.get("baseColorFactor"), "rough": pb.get("roughnessFactor"),
                     "metal": pb.get("metallicFactor"), "emissive": m.get("emissiveFactor"),
                     "ext": list(m.get("extensions", {}).keys()), "tex": [k for k in ("baseColorTexture", "metallicRoughnessTexture") if k in pb] + (["normal"] if "normalTexture" in m else [])})
    return {"file": os.path.basename(path), "bytes": len(b), "tris_total": sum(tris.values()), "tris": tris,
            "nodes": nodes, "bbox_min": [round(x, 3) for x in lo], "bbox_max": [round(x, 3) for x in hi],
            "materials": mats, "images": imgs, "extensionsUsed": j.get("extensionsUsed", []),
            "cameras": len(j.get("cameras", [])), "lights": "KHR_lights_punctual" in j.get("extensionsUsed", [])}


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(json.dumps(report(p), indent=1))
