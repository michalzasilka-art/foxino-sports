# Winter Olympic Stadium (Foxino Sports lobby)

Made from `blender/BRIEF-winter-stadium.md`, following design A (`refs/winter-stadium-concept.png`).

- **Placement:** everything is modelled in place on the brief's layout (metres, Y up, camera looking toward −z), so
  load the four files at the origin.
- **Clear zone:** x −6…6, z 8…30 holds nothing taller than 0.3 m (paving and the low snow edges only).
- **Style:** low poly with flat facets and chamfered big forms. Snow is lilac-white (`Snow` #f4f1ff, `SnowShade`
  #c9c2ea), never grey.

## Triangles

| File | Triangles | Budget |
|---|---:|---:|
| ws-stadium.glb | 18,846 | 35,000 |
| ws-plaza.glb | 7,405 | 12,000 |
| ws-props.glb | 14,750 | 15,000 |
| ws-far.glb | 3,352 | 6,000 |
| **Total** | **44,353** | |

That is the whole scene, all of it inside or behind the frame. With the Foxinos (≈ 11k) and the platforms, the phone
frame is about 56k, well under 100k.

## Materials

- **Plain materials:** every material is a plain colour, matte (roughness 0.85), with no textures.
- **Per-face shading:** every mesh carries a vertex colour `COLOR_0` (attribute `Col`). It is a per-face shade between
  0.91 and 1.0, so each facet is a slightly different shade, as the style asks. three.js multiplies it with the
  material colour automatically.
- **Glow materials:** these faces have a vertex colour of exactly 1.0 and an emissive colour.
  - `WindowLit`: warm #ffcf7a. Used for the entrance glass and the hall behind it, the ground-floor windows, the
    upper-tier window strip and the booth window.
  - `LampLit`: warm #ffcf7a. Used for the lamp heads, all the lanterns, the canopy downlights and the glowing slits on
    the cauldron tower.
  - `Glow`: white-cyan #e8fbff. Used for the roof-ring floodlights and the sparkling tips of the ice crystals.
- **`Ice`:** #bfe6ff, roughness 0.1, also exactly 1.0 in the vertex colour. Used for the frozen fountain's surface and
  crystals, and the icicles under the cornice, the roof ring and the fountain rim. `IceDeep` is a darker crystal facet.
- **Palette accents:**

  | Use | Colours |
  |---|---|
  | Stadium | `StadiumWhite` #f7f5ff, `StadiumShade`, `StadiumPurple` #5b3fb0, `StadiumCyan` #3cc6ef, `Mullion` (dark purple frames) |
  | Arch panels and banners | `BPurple`, `BMagenta`, `BTeal`, `BOrange`, `BBlue` |
  | Rings and flags | `RYellow` #ffcd1c, `RPurple` #8f52d9, `RCyan` #3cc6ef, `ROrange` #ff7d22, `RPink` #ff5fb8 |

## Objects and names

### ws-stadium.glb

- `Stadium`: one mesh, with the bowl centre at (0, 0, −78) and the facade at radius 38.
  - **Arches:** a ring of 32 arches on chamfered piers.
    - In each arch is a faceted colour panel with a cyan trim and a keystone.
    - Six hanging banners carry white pictograms (football, tennis, basketball, skiing, skating) beside the entrance.
  - **Lower facade:** a ground floor of warm windows with snowy sills, a mid band with snow, and wall lanterns on the
    front piers.
  - **Top:** a big cornice with a snow cap and icicles, and a set-back upper tier with a purple stripe, a lit window
    strip and snowy coping.
  - **Roof ring:** 32 slim leaning posts carry the floating white roof ring (r 30.6–41.6, top y 23). It has snow on
    top, a puffy snow lip over the edge, icicles and floodlights under it.
  - **Entrance portal:** faces +z at z −40. It has:
    - a landing at y 2.4
    - an arch frame (white, cyan inner trim, purple outer band, a keystone with snow)
    - warm arched glass with mullions, four doors, and a warm hall seen behind the glass
    - a snowy canopy with downlights, and lanterns on the piers
  - **Detail:** the front half (|angle| < 86°) is detailed; the back half is silhouette only.

### ws-plaza.glb

- **`SnowGround`:** gentle faceted snow bumps. It is flat (y 0) under the plaza, the walkway and the stadium, and rises
  into hills at the far edges.
- **`Paving`:** lilac stone slabs with snowy joints (the joints show the snow below), at y 0.03. It covers the platform
  square (x −6.6…6.6, z 7.6…26.4) and the walkway (x −3.6…3.6, z 7.6…−27.4).
- **`SnowEdges`:** puffy banks along the paving. They are 0.22–0.28 m in the clear zone and up to 0.45 m along the
  walkway.
- **`Steps`:** 12 steps (rise 0.2, run 0.6, x ±9) from z −27.4 up to the entrance landing at z −34.6, y 2.4. It also
  includes:
  - snow drifts at the step ends
  - sloped cheek walls with snow caps and three lanterns on each
  - a planter with a small snowy pine at each foot
- **`Walls`:** low snowy terrace walls along z −27.6.
- **`Fountain`:** the frozen fountain at (−12, 0, 8), built **instead of the ice rink** as the brief asks. It has an
  octagonal stone basin with snow on the rim, icicles, four lanterns, an `Ice` surface, and seven ice crystals with
  glowing tips.
- **`Benches`:** four benches with snow on the seat and back.
- **`Rocks`:** ten snowy rocks.
- **`SnowPiles`:** piles round the plaza and drifts along the stadium's base.

### ws-props.glb

- **`Rings`:** five linked rings in **one row**, coloured yellow, purple, cyan, orange and pink. Centre (−11, 3.65, −8),
  7 m wide, facing +z. It includes snow on the ring tops, a white plinth with a purple band and a snow cap, a snowy rock
  mound and two lanterns.
- **`Cauldron`:** the tower at (13, 0, −14):
  - a snowy stepped base
  - a tapered white shaft with purple and cyan bands and glowing slits
  - a capital, and a bronze and gold bowl whose top is at y 15.6
- **`FlameAnchor`:** an empty at **(13, 15.35, −14)**, the centre of the bowl's opening.
- **`FlagPoles`:** 18 poles at x = ±7, z = 6, 1, … −34. Each is 7 m tall, with a gold ball and snow on top and a snowy
  base.
- **`Flag.001` … `Flag.018`:** each flag is its own object, a 1.8 × 1.1 m cloth of 6 × 3 quads.
  - **Origin:** on the pole, at the middle of the hoist edge (x pole + 0.05, y 6.3).
  - **Direction:** the cloth points **+x**.
  - **Look:** one colour each (yellow, purple, cyan, orange, pink in turn) with a white pictogram on both sides.
  - **Order:** 001 is the front-left flag; they are numbered front to back, left before right.
- **`Lamps`:** ten lamp posts at x ±4.5, z 4, −4, −12, −20, −28, 4.4 m tall. Each has a `LampLit` lantern, a purple
  roof and snow on top.
- **`Pines`:** 75 snowy pines (3 tiers, about 67 triangles each) in clusters beyond |x| 16 and round the stadium's
  sides.
- **`Snowman`:** at (10.2, 0, 11). He has a purple hat, a pink scarf, a carrot nose and stick arms.
- **`Booth`:** a ticket booth at (−10.5, 0, −21), with a lit window and a snowy roof.
- **`Signposts`:** two snowy signposts with coloured arrows and no text.

### ws-far.glb

- **`Mountains`:** a ring of faceted peaks, 30–110 m high, 180–330 m away (all at z < −160 or |x| > 120). They have
  lilac slopes and snowy tops.
- **`Forest`:** two belts of blue pine silhouettes with snowy tips, 95–155 m out.

## Previews

The previews use dusk light (a cool front light and a warm rim light from behind the stadium), with the per-face shade
on, composited over `refs/winter-sky.png`.

- `preview-phone.png`: 1080×1920, from (0.78, 1.55, 23.4) → (0.6, 4.2, −6), vertical FOV 58°.
- `preview-wide.png`: 1920×1080, from (1.1, 1.5, 21.8) → (0.7, 3.4, −6), vertical FOV 40°.
- Close-ups: `closeup-entrance.png`, `closeup-rings.png` and `closeup-cauldron-fountain.png` (a higher overview of
  the plaza).
- The platforms, Foxino, the flame and the falling snow come from the game and are not shown.

## Source

- `source/foxino-winter-stadium.blend`.
- The generator scripts: `ws_kit.py`, `ws_stadium.py`, `ws_plaza.py`, `ws_props.py`, `ws_far.py` and the driver
  `ws_go.py`, plus `sb_kit.py`, the base kit they extend.
