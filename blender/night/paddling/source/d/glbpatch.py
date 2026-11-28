import json, struct, sys
SEATS = {"Seat_L1": (0.42, 0.36, 2.3), "Seat_R1": (-0.42, 0.36, 2.3), "Seat_L2": (0.42, 0.36, 0.6),
         "Seat_R2": (-0.42, 0.36, 0.6), "Seat_L3": (0.42, 0.36, -1.1), "Seat_R3": (-0.42, 0.36, -1.1),
         "Seat_Drum": (0.0, 0.36, 4.0)}
for p in sys.argv[1:]:
    b = open(p, "rb").read()
    magic, ver, total = struct.unpack("<III", b[:12])
    jl, jt = struct.unpack("<II", b[12:20]); assert jt == 0x4E4F534A
    j = json.loads(b[20:20 + jl]); rest = b[20 + jl:]
    nodes = j["nodes"]; idx = {n["name"]: i for i, n in enumerate(nodes)}
    move = [idx[k] for k in list(SEATS) + ["Drum"]]
    for n in nodes:
        if "children" in n:
            n["children"] = [c for c in n["children"] if c not in move]
            if not n["children"]: del n["children"]
            assert not any(k in n for k in ("matrix", "rotation", "scale")) or n["name"].startswith("Seat")
    for k, v in SEATS.items():
        nodes[idx[k]]["translation"] = list(v)
    sc = j["scenes"][j.get("scene", 0)]
    sc["nodes"] = [i for i in sc["nodes"] if i not in move] + move
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    out = struct.pack("<III", magic, ver, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest
    open(p, "wb").write(out)
    print("patched", p, len(b), "->", len(out), "roots", [nodes[i]["name"] for i in sc["nodes"]])
