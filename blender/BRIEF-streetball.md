# Blender brief: STREETBALL court for Foxino Sports (from Fugio Boss, the Mac session)

The user (2026-11-17): "work on another game in Foxino Sports named Streetball, similar to what we had, but this time
remodel everything with Blender and use the already generated 3D character".

The old game is https://www.fugio.co/streetball/ (everything built in code: see `refs/old-streetball-court.png`).
The NEW game lives at `sports/streetball/` in this repo. The characters are NOT modelled by you: the Mac uses the
existing Tripo **Football Foxino** (`penalty/models/foxino-football.glb`, 1.3 m to the ear tips, Mixamo rig) and **Rob**
the robot (code-built, about 1.4 m). You model **the whole court and its surroundings, the hoop and the ball**.

## Style (the user's rules)
- **Low poly**, clean flat-shaded facets, bright and colourful (like the user's Meshy / FoxKarts / Foxino Adventures
  models, see `refs/foxino-sports-lobby.png`, `refs/tennis-court-style.png`). No code-built-looking primitives: real
  modelled shapes (bevelled curbs, bricks, window frames, rounded posts…).
- Foxino palette accents: purple `#5b2bb0`, orange `#ff7d22`, yellow `#ffcd1c`, cyan `#48d8ff`, pink `#ff5d8f`.
- A sunny late-afternoon street. Fun, readable from a phone held upright (9:16).

## Budget (hard)
The game runs on phones: **at most 100k triangles per frame** in total; the characters and crowd take ~35k. So the whole
environment you deliver must stay **under 50k triangles** together. Textures at most 1024 px (vertex colours are welcome).

## World layout (metres, Y up, the same in every file — please model each file in place so they line up)
- The **baseline** is z = 0, the half-court runs toward **+z** to the half-court line at z = 14. Court width x = −7.5 … 7.5.
- The camera is behind the players at about (0, 3.5, 17) looking toward the hoop (−z).
- **Kid-size hoop** (Foxino is 1.3 m tall): **rim centre (0, 2.6, 1.0)**, rim inner radius **0.23**, backboard plane at
  z = 0.6 (1.5 m wide, 1.0 m tall, its bottom at y = 2.35), the pole behind the baseline at z ≈ −0.9.

## Files (GLB, meters, Y up, applied transforms, named objects)
1. **sb-court.glb** — the asphalt half-court: slab x −8.5…8.5, z −2…15 with a low curb round it; painted purple key
   (3.2 m wide, to z = 4.6) with the free-throw circle, orange 3-point arc (radius 5.4 around the rim), sidelines,
   baseline, half-court line with the half circle, a big "FOXINO" or star logo at mid-court. A few cracks / patches.
   ≤ 4k tris.
2. **sb-hoop.glb** — pole (padded at the bottom), arm, backboard (white with an orange square; the glass can be a
   separate object `Glass` if you want it see-through), **rim** (orange torus, object `Rim`) and the **net** as its own
   object `Net` (a low-poly tube, ~12 sides × 4 rings, so the Mac can make it swish). ≤ 4k tris.
3. **sb-fences.glb** — chain-link fences on the left, right and back of the court (posts + top/bottom rails; the mesh
   panels as separate objects named `ChainLink*` with simple UVs, the Mac puts a see-through chain texture on them).
   Gaps at the corners. ≤ 3k tris.
4. **sb-wall.glb** — behind the hoop (z ≈ −4): a brick wall with a big colourful **FOXINO graffiti** (painted in the
   texture or as coloured flat shapes) like the old game, a few spray-paint tags, pipes, a door. ≤ 4k tris.
5. **sb-city.glb** — the backdrop beyond the wall and on both sides (z −6 … −30, x ±10 … ±40): 5–7 low-poly apartment
   blocks in warm colours with windows, roof water tanks, fire escapes, AC units, a billboard with "fugio.co", a few
   street trees. Seen from far: keep it cheap. ≤ 18k tris.
6. **sb-bleachers.glb** — two small metal bleachers (4 rows) on the left and right sides outside the fence
   (x ≈ ±9.5, z 4 … 12). The Mac puts its own instanced crowd on the steps: please add empty objects named
   `Seat.000`, `Seat.001`, … at the seat spots (about 40). ≤ 3k tris.
7. **sb-props.glb** — separate named objects placed around the court (outside the lines): `Lamp` ×2 (street lamps),
   `Bench`, `TrashCan`, `Boombox`, `Cones` (2–3 traffic cones), `Hydrant`, `BallRack` (with 3 balls), `Bag`
   (a sports bag), `Bottle`. ≤ 5k tris.
8. **sb-ball.glb** — a basketball (radius 0.12 m), orange with the black seams, ≤ 400 tris, centred at the origin.

Please also send a **preview render** (one PNG of the whole scene from the game camera (0, 3.5, 17) → (0, 1.5, 0), and
one from a phone-portrait framing) and the **triangle count per file**.

## Hand-back
- Commit the GLBs to **branch `blender/streetball`** of `michalzasilka-art/foxino-sports` in a folder
  `blender/streetball/` (plus the .blend source if you like, and the preview PNGs), push, and message **Fugio Boss**
  (the Mac) with the commit hash and the triangle counts.
- Don't touch `sports/`, `penalty/` or `shared/` (the Mac publishes those).
