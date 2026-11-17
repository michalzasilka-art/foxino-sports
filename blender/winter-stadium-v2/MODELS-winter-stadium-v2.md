# Winter stadium lobby v2

Made from `blender/BRIEF-winter-stadium-v2.md`. Same layout, cameras, names and style as v1 (`blender/winter-stadium`).

- **Unchanged from v1:** `ws-plaza.glb` and `ws-props.glb`. Keep using the v1 files.
- **This folder:** the new and changed GLBs. Load them all at the origin, except as noted below.

## Triangles (phone frame)

| File | Triangles | Budget |
|---|---:|---:|
| ws-stadium.glb (v2) | 24,840 | 30,000 |
| ws-far.glb (v2) | 4,838 | 8,000 |
| ws-podium.glb (one podium; the code places two) | 974 (×2 = 1,948) | 2,500 |
| ws-front.glb | 2,195 | 8,000 |
| ws-people.glb (8 visitors, 402–512 each) | 3,498 | 5,000 |
| ws-plaza.glb (v1) | 7,405 | |
| ws-props.glb (v1) | 14,750 | |
| **Total scene** | **59,474** | |

With the Foxinos (≈ 11k), the frame is about 70.5k, well under 90k.

## ws-podium.glb

One podium centred at the origin. The code places it at (0, 0, 15.6) and (2, 0, 14.6).

- **`Podium`:** the pedestal.
  - A chunky 12-sided pedestal of snowy stone, radius 1.15 at the base and 1.0 at the top.
  - A gold trim band with gold studs.
  - Two short steps on the +z side, with snow at their ends.
  - A puffy snow drift round the foot, open at the steps, and six small ice crystals in it.
- **`PodiumTop`:** the frosted ice disc. Material `PodiumTop` (#e6f8ff, roughness 0.2), a fan of flat facets. **Its top
  surface is exactly at y = 0.31.**
- **`PodiumRing`:** a thin ring round the top edge, radius 0.955–1.02, from y 0.29 to 0.335. Material `PodiumGlow`
  (white, emissive), ready for the code to tint.
- No text.

## ws-front.glb

- **`Emblem`:** the round mosaic inlaid in the paving, centre (1, 15), radius 5.5. It is flat, in three layers:
  y 0.035 (the base and the border), 0.040 (the snowflake) and 0.045 (the rings, the centre and the snow dust).
  - A lilac base with a gold border ring of 32 slabs, and a thin purple inner ring.
  - A huge six-armed snowflake of white and cyan stone slabs, with side branches and a hexagon centre.
  - **Five rings in a row** (yellow, purple, cyan, orange, pink), each made of 10 stone segments, at z 18.05 in front of
    the podiums, so they fill the bottom of the phone picture.
  - Snow dust patches on the edge.
- **`Planters`:** two big octagonal snowy stone planters at (−7.15, 0, 20) and (8.1, 0, 19), outside x ±6. Each has:
  - a small snowy pine and a lantern post with a `LampLit` head
  - three presents with ribbons, a football and a basketball in a snow drift
- **`Drifts`:** puffy snow drifts along the paving's side edges (x ±6.85 outward, z 8–26). They leave gaps at the
  planters.
- **Camera note:** with the brief's wide camera at z 21.8, x ±7 at z 19–20 is outside the view. The planters show up
  when the camera sits further back. If you want them nearer the centre, move the node, or tell me and I'll move them.

## ws-people.glb

- **Objects:** `Visitor1` … `Visitor8`. Each is at the origin, at its feet, faces +z and has no rig.
- **Look:** puffy two-tone jackets with a trim band and zip, bobble hats, scarves, boots and mittens in our colours.
  Heights are 1.1–1.7 m.

| Visitor | Who | Height | Props / pose |
|---|---|---|---|
| 1 | Kid | 1.15 m | Pulls a red sled with a yellow cushion behind them |
| 2 | Adult | 1.7 m | Orange skis on the shoulder |
| 3 | Kid | 1.25 m | Waves a yellow foam finger |
| 4 | Adult | 1.62 m | Holds a small purple Foxino flag (an orange fox face) |
| 5 | Adult | 1.55 m | — |
| 6 | Kid | 1.1 m | Waving |
| 7 | Adult | 1.68 m | — |
| 8 | Kid | 1.3 m | Holds a Foxino flag |

- Each visitor uses plain materials, and the per-face shade is in COLOR_0.

## ws-stadium.glb (v2)

v1's stadium is kept. These are added on the front half:

- **`Screen`:** a curved LED screen above the entrance arch. Material `Screen` (dark; give it your texture).
  - It is **10.4 × 5.85 m (16:9)**, on radius 39.95, from y 15.9 to 21.75. UVs are 0–1 over the whole face (u left →
    right, v bottom → top).
  - **Why smaller than the brief's 14 × 7.9 m:** the screen has to fit between the entrance arch (top ≈ 15.5) and the
    floating roof ring (underside y 21.8). 14 × 7.9 m would cut into the ring.
  - It has a dark frame with 44 small `LampLit` lights along its top and bottom, and two brackets back to the upper
    tier.
- **Roof ring:**
  - A lattice truss along the ring's outer face (front ±82°): top and bottom chords with zig-zag diagonals, stand-offs
    to the ring, and 10 spotlight cans with `Glow` lenses under the bottom chord.
  - 16 white masts with gold balls on top of the ring.
- **`RoofFlag.001` … `RoofFlag.016`:** each flag is its own object, set up like the plaza flags.
  - **Origin:** on the mast, at the middle of the hoist edge.
  - **Shape:** 1.15 × 0.72 m, 6 × 3 quads, the cloth pointing +x.
  - **Look:** our colours, with a white pictogram on both sides.
- **Frieze:** over the ground-floor windows of every front bay (the windows are now a little shorter), a purple panel
  with two white sport figures (football, tennis, basketball, skiing, skating) and a gold rule under it.
- **Entrance:**
  - **Revolving doors:** two drums at x ±2.0, z −37.35, radius 0.95, with lit glass, mullions, wings seen through the
    open sides, a purple cap with snow, and gold rings and push bars.
  - **Red carpet:** a runner (material `Carpet`, #d8304a, with gold edges) up all 12 steps and across the landing to
    the doors, plus a short apron on the walkway. It has snow at its edges on every step.
  - **Ice sculptures:** on snowy stone pedestals with lanterns at (±12.8, 0, −25.4).
    - A faceted fox head on the left.
    - A football on the right, an icosphere with darker pentagon patches.

  The doors and the carpet sit in place over the v1 steps and landing (`ws-plaza`).
- **Vertex colours:** the `Screen` mesh has no vertex colours. Every other mesh has COLOR_0, as in v1.

## ws-far.glb (v2)

v1's `Mountains` and `Forest` are kept. New:

- **`SkiJump`:**
  - On its own snowy hill to the left: the in-run on trestles from (−188, 74) down to the take-off at (−113, 36),
    at z −192.
  - Purple side walls, and `LampLit` lights along both sides.
  - A start house with a lit window.
  - The judges' tower, 22 m tall with a lit cabin, at (−100, z −178).
  - Two light masts (`Glow`) by the landing.
- **`Chairlift`:** nine pylons up a slope on the right, from (92, 2, −182) to (172, 82, −268). It has two cables, nine
  hanging cabins in our colours with lit windows, and a valley station with a lit window.
- **`Village`:** thirteen snowy chalets with warm `WindowLit` windows and chimneys, in two groups at the foot of the
  mountains (x ≈ ±85…120, z ≈ −145…−172), and two little church towers.

## Previews

The previews use dusk light over `refs/winter-sky.png`, with the podiums at (0, 0, 15.6) and (2, 0, 14.6) and the
visitors placed along the walkway sides.

- `preview-phone.png` and `preview-wide.png`: the two cameras from the brief.
- **Close-ups:**
  - `closeup-screen.png`: the screen shows a stand-in gradient; the exported material is plain dark.
  - `closeup-podium.png`
  - `closeup-emblem-planters.png`
  - `closeup-visitors.png`: the eight visitors in a line.

## Source

- `source/foxino-winter-stadium-v2.blend`.
- The scripts:
  - new: `ws_podium.py`, `ws_front.py`, `ws_people.py`, `ws_stadium2.py`, `ws_far2.py`
  - updated: `ws_stadium.py`, `ws_go.py`
  - the v1 kit they use: `ws_kit.py`, `ws_plaza.py`, `ws_props.py`, `ws_far.py`, `sb_kit.py`, `sb_ball.py`
