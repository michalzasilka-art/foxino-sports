# Streetball v2: animated Foxino and Rob, court v2

Made from `blender/BRIEF-streetball-v2.md`. Everything is in metres and Y up, with the same layout as v1 (the rim
centre is at (0, 2.6, 1.0)). The v1 court files on branch `blender/streetball` are unchanged and still used. This
folder adds the characters, the crowd and the extras.

## Triangle budget (per frame, phone)

| Item | Triangles | Budget |
|---|---:|---:|
| foxino-baller.glb | 5,990 | 9k |
| rob-baller.glb | 8,538 (Rob 8,322 + Face 216) | 12k |
| Court: v1 files (25,323) + sb-extras.glb (3,146) | 28,469 | 55k |
| sb-crowd.glb: 6 fans, 440 to 546 each (2,950 in the file) | about 19.7k for 40 copies (avg 492) | rest |
| Ball (v1 sb-ball) | 320 | |
| **Total with a full crowd** | **about 63k** | **100k** |

Textures:
- Foxino: one 1024 px atlas.
- Rob: a 64 px palette, a 64 px emissive palette and the 512 px face atlas.
- The court files use plain colour materials.

## foxino-baller.glb

- **Source:** the Football Foxino (`penalty/models/foxino-football.glb`). His face, fur, proportions, UVs and skinning
  are kept, and so are the 65 Mixamo bones (`mixamorig:*`) and their A-pose rest pose.
- **Placement differs from the football file:**
  - He is **centred**: Hips over the origin. The football file sat off-centre, at x 0.088 and z −0.2.
  - He is **real size**: 1.3 m to the ear tips. The football file was 1.0 m tall.
  - **Remove any scale or offset you applied to the football model.**
- **New outfit**, repainted in the atlas by body region and kept as one material `FoxinoBaller`:
  - A yellow #ffcd1c **tank top** with purple #5b2bb0 neck and armhole trim and side panels. The old sleeves were
    pulled in to the arm.
  - A big purple **10** with a white outline on the front and back. These are projected decals joined into the mesh,
    so they are skinned with it.
  - Long purple **shorts**, painted down to the knee, with yellow side stripes.
  - White **high-tops** with purple soles and side flashes, and a purple band at the top.
  - Purple **wristbands**.
- **Tail:** his fluffy tail is back (purple, orange band, cream tip). It has two new bones, **`Tail1` → `Tail2`**,
  parented to `mixamorig:Hips`, and the tail is re-weighted to them. The file has 67 joints.
- **Nodes:** `Foxino` (the skinned mesh) and the skeleton.

## rob-baller.glb

- **The model:** a new, smooth-shaded Rob, 1.39 m to the top of the head (1.55 m to the tip of the heart). He has:
  - a round cyan body with purple trim bands
  - an orange glowing battery window with a yellow bolt
  - a white and cyan tank top with a cyan **7** on the front and back
  - a big round head with a cyan screen bezel
  - orange, purple and white ear pods
  - an antenna with a red heart
  - black joints and black chunky hands
  - white sweatbands
  - cyan boots with black soles and orange lights
- **Mesh `Rob`**, material `Rob`:
  - The base colour is a 64 px palette.
  - The emissive texture is a matching palette that lights only the battery, the bolt and the heart.
- **Mesh `Face`**, material `FaceScreen` (base colour and emissive both use the same atlas):
  - The 512 px atlas `rob-face-atlas.png` is a 2×2 grid. The `Face` UVs cover the top-left quarter.
  - To switch expression, set the texture offset in glTF UV space (top-left origin, as three.js uses with
    `flipY = false`):

    | Expression | Offset |
    |---|---|
    | **happy** | (0, 0) |
    | **focus** | (0.5, 0) |
    | **oops** (crossed eyes) | (0, 0.5) |
    | **sad** (with a tear) | (0.5, 0.5) |

- **Skeleton:** the same Mixamo names as Foxino (`mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`,
  `HeadTop_End`, shoulders, arms, forearms, hands, up-legs, legs, feet, toes and toe ends) plus **`Antenna`** (a child
  of `Head`), with no fingers: 26 joints. The rest pose is the same A-pose as Foxino, with the arms 46.6° below
  horizontal. Rob is a robot, so every part is rigidly weighted to its bone; the body blends from Hips to Spine2.

## Animations

The same 20 clips are in both files, sampled at 30 fps. `ANIMS.md` has the lengths, loop flags and event frames
(`hand_down`, `bounce`, `hand_up`, `release`, `slam`, `poke`, `apex`). Contact sheets show 4 frames per clip:
`contact-foxino.png` and `contact-rob.png`.

## sb-crowd.glb

- Six seated fans, `Fan1`…`Fan6`. Each is at the origin, at the **seat contact point**, facing **+Z**, with feet about
  0.4 m lower and 0.4 m forward (on the footboard). Put a copy on each `Seat.###` empty with its full transform: each
  seat's +Z points at the court.
- The fans:
  1. An adult in an orange tee with a Foxino cap (purple with ears).
  2. An adult in a purple tee with a yellow foam finger.
  3. A kid with a **GO FOXINO** sign.
  4. A kid in a yellow tee with a Foxino cap.
  5. An adult with a **ROB #7** sign.
  6. A kid with pink pompoms.
- They sit with their arms half up or up. The materials are plain colours.

## sb-extras.glb

Each object is in place on the v1 layout.

- `Lights`: string-light wires from both lamp heads to the wall top, between the two lamps (with palette bunting), and
  from the wall pilasters to the lamps.
- `Bulbs`: 76 small bulbs on those wires, with the emissive material `Bulb`.
- `ShotClock`: a box on the hoop pole, just above the pad (y 1.62 to 1.98, facing the court).
- `ShotClockFace`: the clock's front plane (0.38 × 0.26 m, UV 0 to 1, material `ShotClockFace`) for the game's
  texture.
- `Cooler`: by the bench. Its node origin is at its foot.
- `Plants`: three pots between the back fence and the wall.
- `Bike`: leaning on the right fence, outside, near the camera end. Its origin is at the ground under it.
- `BleacherBall`: a ball on the right bleacher.
- `Bird1`…`Bird4`: pigeons on the wall coping. Each origin is at its feet, so they can hop or fly.
- `Decals`: sneaker scuffs on the court and three puddles on the apron.
  - They sit at **y 0.028**: 4 mm above v1's highest paint layer (y 0.024), so they never z-fight.
  - The puddle material is glossy (roughness 0.08).

## Previews

- `preview-court-v2-portrait.png` and `preview-court-v2-wide.png`: the new camera, (0, 4.7, 12.6) → (0, 1.85, 2.6),
  with Foxino dribbling with his back to the camera and Rob defending.
- `preview-extras-hoop.png`, `preview-extras-side.png` (the fans on the seats, the bike, the cones) and
  `preview-crowd.png` (the six fans).

## Source

- `source/foxino-streetball-v2.blend`: the court in scene `Scene` and the characters in scene `Chars`.
- The generator scripts:
  - `fx_*.py`: the Foxino outfit
  - `rob_build.py`: Rob
  - `anim.py`, `clips.py`, `anim_go.py`: the animations
  - `sheet.py`: the contact sheets
  - `sb_crowd.py`, `sb_extras.py`: the court files, using the v1 kit
