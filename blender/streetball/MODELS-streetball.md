# Streetball court: Blender models (for `sports/streetball/`)

Made from `blender/BRIEF-streetball.md`. Low-poly, flat-shaded, Foxino palette. Every file is modelled **in place** on
the shared layout: metres, Y up, the baseline at z = 0, the court running toward +z, and the rim centre at
(0, 2.6, 1.0) with inner radius 0.23. Load all eight at the origin and they line up.

| File | Triangles | Budget | Nodes |
|---|---:|---:|---|
| sb-court.glb | 1,578 | 4k | `Court` |
| sb-hoop.glb | 1,723 | 4k | `Hoop`, `Rim`, `Net` |
| sb-fences.glb | 2,434 | 3k | `Fences`, `ChainLinkLeft`, `ChainLinkRight`, `ChainLinkBack` |
| sb-wall.glb | 2,079 | 4k | `Wall` |
| sb-city.glb | 13,411 | 18k | `Ground`, `Buildings`, `Billboard`, `Trees` |
| sb-bleachers.glb | 1,588 | 3k | `Bleachers`, `Seat.000` to `Seat.039` (empties) |
| sb-props.glb | 2,190 | 5k | `Lamp.000`, `Lamp.001`, `Bench`, `Bag`, `Bottle`, `Boombox`, `TrashCan`, `Cones`, `Hydrant`, `BallRack` |
| sb-ball.glb | 320 | 400 | `Ball` |
| **Total** | **25,323** | **50k** | |

The materials are plain colours: one material per colour, named and shared across the files (`Purple`, `Orange`,
`Yellow`, `Cyan`, `Pink`, `Court`, `Key`, `Brick1`, and so on). They are not metallic, have roughness 0.85 and no vertex
colours. `Glow` (the lamp lenses and the billboard lights) and `WinLit` (a few lit windows) have emission. The only
texture is the 256 px chain-link texture in sb-fences.

## Notes per file

- **sb-court:**
  - The slab is x −8.5…8.5, z −2…15, with its top at y = 0. It has a chamfered concrete curb around it, made of blocks
    (outside edge at x ±8.82, z −2.32…15.32; top at y 0.12).
  - The blue playing area is x ±7.5, z 0…14.
  - Painted markings: a purple key (3.2 m wide, to z 4.6) with the free-throw circle, dashed on its inner half; lane
    hash marks; the orange 3-point arc (r 5.4 around the rim); a no-charge arc; the sidelines, baseline and half-court
    line; and a purple half circle at z 14.
  - A star badge sits at z 9.2, with FOXINO painted at z 11.3…12.0.
  - There are cracks and darker patches.
  - The paint layers sit 6 mm apart (y 0.003…0.024), so no z-fighting.
- **sb-hoop:**
  - `Hoop`: a purple pole at z −0.9 with a foam pad (yellow bands), a gooseneck and a brace. The backboard's front
    plane is z 0.6, x ±0.75, y 2.35…3.35. The board is white with an orange border, an orange shooter's square, a
    purple pad along the bottom, and "fugio" on top.
  - `Rim`: an orange torus (16 × 6) with its bracket and net hooks.
  - `Net`: a diamond lattice of strands, 12 around × 4 rows, from y 2.57 down to y 2.09, tapering from r 0.23 to 0.155.
  - `Rim` and `Net` have their node origin at the rim centre (0, 2.6, 1.0), translation only. Scaling or squashing the
    Net node therefore swishes it around the rim. Every other node in every file has an identity transform, except the
    props (below).
- **sb-fences:**
  - Left and right fences run along x = ±8.98, z −1.6…14.7, and are 2.6 m high.
  - The back fence runs along z = −2.55, x ±7.3, and is 3.6 m high.
  - The two back corners have gaps.
  - The posts have caps and concrete collars; there are top, bottom and (at the back) middle rails.
  - The `ChainLink*` panels have one quad per bay. Their UVs are 1 unit = 0.5 m, along the fence and up, with repeat
    wrap. They come with a see-through chain texture (alpha MASK, double sided), so you can use them as they are or
    swap in your own texture.
- **sb-wall:**
  - The front face is at z = −4.0, x ±13, 6 m tall. It has brick end pilasters, a coping and a plinth. Each brick is
    its own raised face over the mortar.
  - The FOXINO graffiti has bouncing letters, each with a dark shadow, a cream outline and a bright fill. It sits on a
    purple, pink and cyan spray cloud with drips.
  - Tags: a star, a heart, "1 ON 1", a crown and an arrow.
  - Also on the wall: a teal steel door at x 10.6 with a lamp and step, drainpipes, and an electric box.
- **sb-city:**
  - `Ground`:
    - Sidewalks around the court, with a hole for the court slab, so nothing z-fights.
    - Side streets at x ±14.5…20.5 with dashed lines, kerbs and zebra crossings.
    - A cross street at z −9…−6.6.
    - A far ground plane at y −0.04.
  - `Buildings`: eight blocks behind z −7.
    - They have framed windows (some lit), floor bands, cornices and parapets.
    - The side blocks have shops with striped awnings.
    - There are two fire escapes, water tanks, AC units and roof bulkheads.
    - Only the faces the camera can see have windows, and the backs are open.
  - `Billboard`: "fugio.co" on the low block right behind the wall (x 0.3…8.7, y 7.6…10.8). It shows above the wall
    from the game camera.
  - `Trees`: 8 street trees.
- **sb-bleachers:**
  - Two 4-row bleachers, inner edge x = ±9.5, z 4…12, facing the court. The seat planks are cyan, yellow, orange and
    purple from the front. They have steel frames, a guard rail, and a purple "GO FOXINO" skirt.
  - There are 40 `Seat.###` empties at the seat tops (y 0.42, 0.80, 1.18, 1.56), 5 per row.
    - `Seat.000` to `Seat.019` are on the left (x < 0); `Seat.020` to `Seat.039` are on the right.
    - Each side is numbered front row first, with z ascending.
    - Each seat's local +Z points at the court (a ±90° rotation about Y).
  - three.js's GLTFLoader strips the dots from node names, so they arrive as `Seat000`, `Seat001` and so on (and
    `Lamp000`, `Lamp001`).
- **sb-props:** each prop has its node origin at its foot (translation only), so it can be moved.
  - `Lamp.000`: x +9.75, z −3.1.
  - `Lamp.001`: x −9.75, z −3.1.
    - Both lamps stand at the back corners outside the fence, with their heads over the court.
  - `Bench`: x −8.45, z 0.6…2.4, facing the court.
  - `Bag` and `Bottle`: on the bench.
  - `Boombox`: x −8.4, z 3.3.
  - `TrashCan`: x 8.05, z −1.35.
  - `Cones`: three along x 8, z 9.6…12.2.
  - `Hydrant`: on the sidewalk, x −9.75, z 14.4.
  - `BallRack`: x 8.3, z 2.3, with 3 balls.
- **sb-ball:** radius 0.12, centred at the origin. It is a latitude–longitude sphere whose seam rows (the equator and
  two great circles) are black faces.

## Previews

The previews are lit with a warm sun and include the Football Foxino from `penalty/models/foxino-football.glb`, scaled
to 1.3 m, for scale.

- `preview-game-camera.png`: camera (0, 3.5, 17) → (0, 1.5, 0), 16:9, vertical FOV 50°.
- `preview-phone-portrait.png`: the same camera, 9:16, vertical FOV 66°.
- `preview-overview.png`: a view from above.

## Source

- `source/foxino-streetball.blend` is the Blender scene. Each file is a collection named `sb-*`.
- `source/*.py` are the generator scripts, written in game coordinates. `sb_go.py` builds and exports them.
