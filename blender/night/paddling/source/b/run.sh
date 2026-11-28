#!/bin/sh
# Lane B, N19 crews hare + owl. Rebuild from the raw Tripo GLBs (blender/night/tripo-raw/crews/crew-{hare,owl}.glb).
# All headless. B = Blender 5.2, W = a temp folder holding the raw GLBs.
B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"; PY="C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe"
S=$(dirname "$0"); W=${W:?set W to a temp folder}
mkdir -p "$W/hare" "$W/owl" "$W/prev"
# 1. clean, scale (hare 1.3, owl 0.9), symmetric Mixamo skeleton, LOD0/LOD1 decimate, bake base colour, mirrored weights
"$B" -b --factory-startup -P "$S/cr_prep.py" -- "$W/crew-hare.glb" Crew_Hare 1.3 Left "$W/hare"
"$B" -b --factory-startup -P "$S/cr_prep.py" -- "$W/crew-owl.glb" Crew_Owl 0.9 Right "$W/owl"
# 2. seated rest pose, Paddle/Mallets, 4 clips (per-frame paddle solver + analytic 2-bone IK baked to bones), GLB export
"$B" -b "$W/hare/Crew_Hare_prep.blend" -P "$S/cr_anim.py" -- Crew_Hare "$W/hare" "$W/hare/Crew_Hare.glb"
"$B" -b "$W/owl/Crew_Owl_prep.blend" -P "$S/cr_anim.py" -- Crew_Owl "$W/owl" "$W/owl/Crew_Owl.glb"
# 3. independent numeric check of the GLB (own glTF evaluator: tris, bones, clips, bounds, blade/mallet positions, stretch)
"$PY" "$S/cr_glbcheck.py" "$W/hare/Crew_Hare.glb" > "$W/check_hare.json"
"$PY" "$S/cr_glbcheck.py" "$W/owl/Crew_Owl.glb" > "$W/check_owl.json"
# 4. previews (BOAT = optional boat GLB with Seat_* empties)
"$B" -b --factory-startup -P "$S/cr_preview.py" -- "$W/hare/Crew_Hare.glb" "$W/owl/Crew_Owl.glb" "$W/prev" all
