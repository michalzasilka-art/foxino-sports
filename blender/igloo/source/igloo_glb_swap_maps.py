# Replace the embedded images of a GLB by name, keeping every other byte of the binary chunk (geometry) as is.
# Usage: python igloo_glb_swap_maps.py <in.glb> <out.glb> <ImageName>=<file.jpg> [...]
import json, struct, sys


def swap(src, dst, repl):
    b = open(src, "rb").read()
    assert b[:4] == b"glTF"
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack_from("<I", b, o)[0]
    binc = b[o + 8:o + 8 + bl]
    new_bytes = {}
    for im in js.get("images", []):
        nm = im.get("name")
        if nm in repl:
            new_bytes[im["bufferView"]] = open(repl[nm], "rb").read()
            im["mimeType"] = "image/jpeg"
    missing = set(repl) - {im.get("name") for im in js.get("images", [])}
    assert not missing, missing
    out = bytearray()
    for i, bv in enumerate(js["bufferViews"]):
        data = new_bytes.get(i, binc[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]])
        while len(out) % 4:
            out += b"\0"
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(data)
        out += data
    while len(out) % 4:
        out += b"\0"
    js["buffers"][0]["byteLength"] = len(out)
    jb = json.dumps(js, separators=(",", ":")).encode()
    while len(jb) % 4:
        jb += b" "
    total = 12 + 8 + len(jb) + 8 + len(out)
    with open(dst, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, total))
        f.write(struct.pack("<I", len(jb)) + b"JSON" + jb)
        f.write(struct.pack("<I", len(out)) + b"BIN\0" + bytes(out))
    return total


if __name__ == "__main__":
    repl = dict(a.split("=", 1) for a in sys.argv[3:])
    print(swap(sys.argv[1], sys.argv[2], repl))
