# Export the lane D ice cave props, one GLB per model (plain glTF: no Draco, no meshopt).
import bpy, os

OUT = r"C:\Users\micha\Pictures\Claude Folder\Blender Lanes\work\d-icecave\blender\icecave"
MODELS = ["SM_Lantern_Ice_1", "SM_Lantern_Ice_2", "SM_IceLedge", "SM_IceLip_Sides", "SM_IceBridge"]


def export_all():
    sc = bpy.data.scenes["IceProps_D"]
    win = bpy.context.window
    win.scene = sc
    vl = sc.view_layers[0]
    done = {}
    for name in MODELS:
        ob = bpy.data.objects[name]
        kids = list(ob.children)
        old = {k: k.name for k in kids}
        for k in kids:
            if k.name.startswith("glow"):
                k.name = "glow"
        for o in vl.objects:
            o.select_set(False, view_layer=vl)
        for o in [ob] + kids:
            o.select_set(True, view_layer=vl)
        vl.objects.active = ob
        path = os.path.join(OUT, name + ".glb")
        with bpy.context.temp_override(window=win, scene=sc, view_layer=vl):
          bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True,
            export_yup=True, export_cameras=False, export_lights=False,
            export_draco_mesh_compression_enable=False, export_image_format='AUTO',
            export_texcoords=True, export_normals=True, export_tangents=False,
            export_materials='EXPORT', export_vertex_color='NONE', export_all_vertex_colors=False,
            export_animations=False, export_skins=False, export_morph=False, export_extras=False)
        for k, n in old.items():
            k.name = n
        done[name] = os.path.getsize(path)
    return done
