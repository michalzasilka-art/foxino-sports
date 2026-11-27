# Igloo W3 lane B headless run:
#   blender -b --factory-startup -P w3_headless.py -- <stage>
# stage "build": fracture the real plug, export SM_Igloo_WallChunks.glb, coverage, QA
# stage "previews": re-import plug, shell and the exported chunks GLB, render previews
import bpy, sys, os, json, math, time
import numpy as np

TMP = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\b-tmp"
IG = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\b-igloo\blender\igloo"
QA = r"C:\Users\micha\.claude\skills\blender-asset-qa\scripts"
for p in (TMP, QA):
    if p not in sys.path:
        sys.path.insert(0, p)
import wc_fracture as wf
import wc_preview as wp
import wc_run as wr

PLUG = os.path.join(IG, "SM_Igloo_ExitPlug.glb")
SHELL = os.path.join(IG, "SM_Igloo_Shell.glb")
OUT = os.path.join(IG, "SM_Igloo_WallChunks.glb")
PREV = os.path.join(IG, "previews")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["build"]
stage = argv[0]


def clean_start():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def dump(name, rep):
    with open(os.path.join(TMP, name), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, default=str)


sc = bpy.context.scene
clean_start()

if stage == "build":
    t0 = time.time()
    rep, objs = wr.fracture(PLUG, OUT, sc, impact=1.75, tries=24, max_total=6000)
    if objs:
        P, plug_ob, root, obs = objs
        import qa_check
        names = [o.name for o in obs]
        q = qa_check.run(objects=names, profile="game")
        rep["qa_all"] = {k: q[k] for k in ("pass", "errors", "warnings", "floating", "zfighting")}
        rep["qa_all"]["n_back_to_back"] = len(q["back_to_back"])
        per_fail = []
        for n in names:
            qi = qa_check.run(objects=[n], profile="game")
            if not qi["pass"] or qi["warnings"]:
                per_fail.append((n, qi["errors"], qi["warnings"]))
        rep["qa_per_chunk_issues"] = per_fail
        qp = qa_check.run(objects=[plug_ob.name], profile="game")
        rep["qa_plug_alone"] = {k: qp[k] for k in ("pass", "errors", "warnings")}
        # tris per material
        fr = sum(1 for o in obs for p_ in o.data.polygons if p_.material_index >= len(P.mats))
        rep["fracture_tris"] = fr
    rep["time_s"] = round(time.time() - t0, 1)
    dump("w3_build.json", rep)

elif stage == "previews":
    shell_c, shell_obs = wr.import_into(SHELL, "W3_Shell", sc)
    plug_c, plug_obs = wr.import_into(PLUG, "W3_Plug", sc)
    ch_c, ch_obs = wr.import_into(OUT, "W3_Chunks", sc)
    chunks = [o for o in ch_obs if o.type == 'MESH']
    rep = {"chunks": len(chunks)}
    c, co = wp.setup(sc, interior=True)

    def show(plug_on, chunks_on):
        for o in plug_obs:
            o.hide_render = not plug_on
        for o in chunks:
            o.hide_render = not chunks_on

    wp.game_cam(sc, co)
    show(True, False)
    a = wp.render(sc, os.path.join(TMP, "intact_plug.png"))
    show(False, True)
    b = wp.render(sc, os.path.join(PREV, "WallChunks_intact.png"))
    ia = bpy.data.images.load(a); ib = bpy.data.images.load(b)
    A = np.array(ia.pixels[:]).reshape(-1, 4)[:, :3]
    B = np.array(ib.pixels[:]).reshape(-1, 4)[:, :3]
    d = np.abs(A - B).max(1) * 255
    rep["intact_diff"] = dict(mean=round(float(d.mean()), 4), max=round(float(d.max()), 2),
                              px_over_2=int((d > 2).sum()), px_over_8=int((d > 8).sum()), px=int(d.size))
    # diff heat image for inspection
    h = np.zeros((d.size, 4), np.float32); h[:, 0] = np.clip(d / 16, 0, 1); h[:, 3] = 1
    hi = bpy.data.images.new("diff", ia.size[0], ia.size[1]); hi.pixels = h.ravel()
    hi.filepath_raw = os.path.join(TMP, "intact_diff.png"); hi.file_format = 'PNG'; hi.save()
    # exploded: chunks fly outward (+Z glTF = -Y Blender), seen from inside, a bit off-axis
    saved = wp.explode(chunks, push=3.2, spin=55, spread=0.9)
    co.location = (2.6, 3.2, 2.9)
    wp.look_at(co, (0.0, -10.5, 2.0))
    wp.render(sc, os.path.join(PREV, "WallChunks_exploded.png"))
    wp.restore(saved)
    # turntable: chunks alone, slightly apart, no shell
    for o in shell_obs:
        o.hide_render = True
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    for n in ("W3_Fire",):
        bpy.data.objects[n].location = (3.0, -13.0, 3.0)
    saved = wp.explode(chunks, push=0.5, spin=6)
    wp.turntable(sc, co, (0.0, -9.6, 2.3), 10.5, 1.8, 6, TMP, os.path.join(PREV, "WallChunks_turntable.png"),
                 lens=45, res=(640, 640), cols=3)
    wp.restore(saved)
    dump("w3_prev.json", rep)
