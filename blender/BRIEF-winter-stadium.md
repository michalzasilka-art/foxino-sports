# Blender brief: the WINTER OLYMPIC STADIUM for the Foxino Sports lobby (from Fugio Boss, the Mac)

The user (2026-11-17): "Re-do the Foxino menu: model an Olympic stadium, you're standing in front of it, you can invite a
friend as it is now, **take time on modelling that stadium**, make it winter."

fugio.co/sports is a 3D lobby. Today it stands inside Penalty Star's stadium. The new lobby stands OUTSIDE:
- On a snowy plaza at dusk, two glowing platforms: yours with your Foxino, and an empty one for a friend ("+ ADD FRIEND").
- Behind them, the big winter Olympic stadium.

The Mac already has the scene code. It loads your files from `sports/models/`. Until then it uses the grey stand-ins you
see in `blender/refs/winter-layout-phone.png` and `winter-layout-wide.png`. The code makes everything that moves:
- falling snow, the cauldron's flame, the waving flags, the glow of windows and lamps
- the two platforms, Foxino and the friend

**The concept to follow:** `blender/refs/winter-stadium-concept.png`. This is the user's chosen ChatGPT design, **Design A**:
- a round bowl stadium with a ring of tall arches round the outside
- colourful panels with sport pictograms in the arches (purple, magenta, teal, orange, blue)
- a white roof ring floating above the stands on slim posts, with snow on top
- a big arched, warm-lit glass entrance in the middle, with a wide flight of steps, lanterns on the steps, and planters
  with small snowy pines

The concept's plaza is part of the job too:
- the chain of five rings on the left
- the cauldron tower with the flame on the right
- flag poles and lamp posts
- a frozen fountain with ice crystals (left front): build it **instead of** the ice rink in the table below, near (−12, 0, 8)
- benches and a snowman (right front)
- snowy rocks and pines at the sides
- mountains far behind

The sky (`blender/refs/winter-sky.png`) is the game's painted sky dome; you don't need to model it. Please take your
time and make it beautiful: it is the first thing every student sees.

## The view (build for these two cameras; things they never see can be very simple)
World: metres, Y up. The camera looks toward −z.

| What | Where |
|---|---|
| Phone (9:16, the main one) | camera (0.78, 1.55, 23.4), looking at (0.6, 4.2, −6), vertical FOV 58° |
| Wide (16:9) | camera (1.1, 1.5, 21.8), looking at (0.7, 3.4, −6), vertical FOV 40° |
| Your platform (code) | (0, 0, 15.6), radius 1.1 |
| The friend's platform (code) | about (2, 0, 14.6) |

**Keep the area clear:** x −6…6, z 8…30 has nothing taller than 0.3 m (the platforms, the camera and the UI are there).
The walkway in front of them is paved and cleared of snow.

## Layout (follow it; small changes are fine if they look better from the cameras)

| Piece | Where | Size |
|---|---|---|
| Stadium bowl | centre (0, 0, −78), outer radius ≈ 38 m | ≈ 24 m to the top of the roof ring |
| Main entrance (front facade) | facing +z at z ≈ −40: steps, a canopy, warm-lit glass doors and windows | |
| Walkway | from the platforms (z 15) straight to the entrance (z −40), x −3.5…3.5, paved | |
| Rings sculpture | at (−11, 0, −8), on a snowy plinth, facing +z | ≈ 6–7 m wide |
| Cauldron tower | at (13, 0, −14), the bowl on top | ≈ 16 m |
| Flag poles | two rows along the walkway at x = ±7, from z = 6 to −34, every 5 m | poles 7 m |
| Lamp posts | at x = ±4.5, from z = 4 to −34, every 8 m | 4.2 m |
| Ice rink | near (−15, 0, 6) | ≈ 10 × 6 m |
| Snowy pines | in clusters at x beyond ±16, from z 20 to −40, and round the stadium's sides | |
| Snowman, benches, signposts, snow piles, a small ticket booth | your choice, by the sides | |
| Far background | snowy mountains (a ring, far away, z < −160 or \|x\| > 120), a belt of pine forest | |

**Rings sculpture:** five linked rings in **ONE ROW** (not the official three-over-two Olympic layout). Use our colours:
yellow `#ffcd1c`, purple `#8f52d9`, cyan `#3cc6ef`, orange `#ff7d22`, pink `#ff5fb8`. Snow sits on their tops.

**Cauldron:** put an empty named `FlameAnchor` at the centre of the bowl's opening, where the flame starts (the code
draws the flame and its light there).

No real logos, trademarks or text, except simple sport pictograms on banners (football, tennis, basketball, skiing,
skating).

## Files (hand-back branch `blender/winter-stadium`, folder `blender/winter-stadium/`) and HARD budgets
The whole phone frame must stay ≤ 100,000 triangles with the Foxinos (≈ 11k) and the platforms. So:

| File | Content | Max triangles |
|---|---|---|
| `ws-stadium.glb` | the stadium (bowl, roof ring, facade, entrance, banners, roof floodlights, snow on ledges and the roof edge) | **35,000** |
| `ws-plaza.glb` | the ground (gentle snow bumps, the walkway, snow edges and piles), the ice rink, low snowy walls, steps up to the entrance, benches | **12,000** |
| `ws-props.glb` | the rings sculpture, the cauldron tower (+ `FlameAnchor`), flag poles + flags, lamp posts, pines, snowman, booth, signposts | **15,000** |
| `ws-far.glb` | far mountains and the forest belt | **6,000** |

**Spend the triangles where the cameras look:**
- The front half of the stadium (z > −78) and the entrance get the detail.
- The back half only needs its silhouette and the roof ring.
- Pines are low-poly cones with 2–3 snowy tiers, ≤ 150 tris each.
- Far things are very simple.

## Names and materials the code uses
- **Glow materials**, any of these names: `WindowLit`, `LampLit`, `Glow`. Warm `#ffcf7a` for the windows, the doors and
  the lamp heads; white-cyan for the roof floodlights. The code makes them full-bright, and the post pass adds a soft glow.
- **`Ice`:** the ice rink (light cyan, smooth, roughness 0.1; the code may add reflections).
- **Flags:** each flag cloth is its own object, `Flag.001`, `Flag.002`…
  - Its origin is on the pole, where the flag is fixed.
  - The cloth points +x from the pole.
  - Make a few rows of quads so it can bend.
  - The code swings and ripples it.
  - Use our colours (yellow, purple, cyan, orange, pink), each flag one colour with a white pictogram.
- **`FlameAnchor`:** an empty, as above.
- **Snow ground:** a big object named `SnowGround`. It only receives shadows, and the code makes sure it casts none.
- **Everything else:** plain materials or vertex colours, matte (roughness ≈ 0.85), no textures, except one small atlas
  (≤ 1024) for the banner pictograms if you need it.

## Style (very important: the user's rules)
- **Low poly**, like ISLANDERS and Lonely Mountains: Downhill:
  - big clean flat facets, flat shading
  - strong simple silhouettes
  - bevelled (chamfered) edges on the big forms
  - each face a slightly different shade
- **Snow is never grey:** lit snow `#f4f1ff`, shaded snow `#c9c2ea` (lilac), ice `#bfe6ff`.
- **Stadium:** white `#f7f5ff` with purple `#5b3fb0` and cyan `#3cc6ef` accents; warm `#ffcf7a` windows.
- **Snow lies where it would:** on the roof edge, the ledges, the tops of the rings, the lamps, the flag poles, the pines
  and the benches. These are separate slightly puffy snow caps (part of the meshes), not textures.
- **Light (the code):** dusk, a cool front light, a warm pink-orange sunset glow from behind the stadium (a rim light),
  warm lamps. Make it read well in that light.

## Hand-back
Push branch **`blender/winter-stadium`** of `michalzasilka-art/foxino-sports` with folder `blender/winter-stadium/`:
- the four GLBs
- `MODELS-winter-stadium.md`: the triangle counts and the object names
- previews rendered from the two cameras above (`preview-phone.png` 1080×1920, `preview-wide.png` 1920×1080), plus a
  close-up of the entrance and of the rings
- `source/` with the .blend and the scripts

Then message **Fugio Boss** with the commit hash. Don't touch `sports/`, `penalty/` or `shared/`.
