# Blender brief v2: STREETBALL ultimate — characters with 20 animations + court v2 (from Fugio Boss, the Mac)

The user (2026-11-17): "now work on ultimate graphics/models improvement, max 100k triangles and 20 animations, basically
Unity rules" — for Streetball (fugio.co/sports/streetball/). Your v1 court (branch blender/streetball, 31e1af5) is live
and looks great; this is the next step. Today the characters move with code-made poses: we want **real skeletal
animations** baked in the GLBs, played with three.js AnimationMixer (cross-fades between clips).

## Budget (hard, per frame on a phone)
**≤ 100k triangles in total**: Foxino ≤ 9k · Rob ≤ 12k · the whole court ≤ 55k (v1 is 25k) · the rest is for the crowd,
effects and the ball. Textures ≤ 1024 px (one atlas per character is ideal).

## 1. foxino-baller.glb — Foxino the basketball player
- Start from `penalty/models/foxino-football.glb` in this repo (the Tripo Football Foxino: 5.6k tris, Mixamo skeleton
  `mixamorig:*`, 65 bones, 1.3 m to the ear tips, one 2K texture). **Keep his face, fur, proportions and the skeleton
  (same bone names, same rest pose)** — only the outfit changes.
- Outfit: a basketball tank top (yellow `#ffcd1c` with purple `#5b2bb0` trim and a big purple **10** on front and back),
  long purple basketball shorts with yellow side stripes, white high-top sneakers with purple accents, a purple
  wristband, an optional sweatband. Low poly, ≤ 9k tris.
- He has no tail in Penalty Star (cut out); for basketball **give him back his fluffy tail** (purple → orange band →
  cream tip) with two tail bones `Tail1`, `Tail2` parented to `mixamorig:Hips` so the animations can swing it.

## 2. rob-baller.glb — Rob the robot as a basketball player (a real model, replacing the code-built one)
- Exactly Rob (see the Rob pictures in `blender/refs/` and the in-game Rob in `refs/foxino-sports-lobby.png`): round
  chubby **cyan** robot with dark purple trim lines, a big round head with a **black glossy screen face**, an antenna
  with a small **red heart**, orange-and-purple ear pods, an orange glowing **battery window** in his belly, black jointed
  hands, cyan boots. For basketball: a white-and-cyan tank top with a cyan **7**, sweatbands. ≤ 12k tris, about 1.4 m.
- **The face screen as its own mesh `Face`** with 4 face textures in one small atlas (happy curved eyes, focus,
  oops (crossed), sad) laid out 2×2 so the Mac can switch them by UV offset; name the material `FaceScreen`.
- **Rig him with the SAME Mixamo bone names** (`mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, shoulders,
  arms, forearms, hands (fingers optional), up-legs, legs, feet, toes) + `Antenna` bone (wobbles).

## 3. The 20 animations (both characters, the same names; 30 fps; in place unless "root motion" is written)
The game moves the characters around the court itself, so keep them **in place** (no hips drift in X/Z, the hips may go
up/down). The basketball is NOT in the files: the game puts it in the right hand (bone `mixamorig:RightHand`) or bounces
it. Please write the **key frames** in a notes file (see the "events" column) so the game can sync the ball.

| # | name | loop | length | what / events |
|---|---|---|---|---|
| 1 | `idle` | loop | 2–3 s | relaxed breathing, looks around a little |
| 2 | `ready` | loop | 1–1.5 s | athletic stance, bouncing on the toes, ball held at the chest (both hands) |
| 3 | `dribble` | loop | 0.6 s | low dribble on the spot with the RIGHT hand. events: `hand_down` (ball leaves the hand), `bounce` (ball hits the floor), `hand_up` (ball back in the hand) |
| 4 | `dribble_run` | loop | 0.6 s | running in place while dribbling (same events) |
| 5 | `crossover` | once | 0.7 s | quick between-the-legs / crossover from the right to the left hand and back, a body fake. events: `bounce` |
| 6 | `jump_shot` | once | 1.2 s | gather, jump (~0.4 m), release over the head, follow-through, land. events: `release` |
| 7 | `layup` | once | 1.1 s | two steps and a one-hand layup off the right foot, high reach. events: `release` |
| 8 | `dunk` | once | 1.4 s | (kid hoop!) a big jump, both hands up, hangs on the rim for a moment, lands. events: `slam` |
| 9 | `pass` | once | 0.6 s | two-hand chest pass forward. events: `release` |
| 10 | `catch` | once | 0.5 s | catches a pass at the chest |
| 11 | `defense` | loop | 1 s | low wide defensive stance, arms out, small shuffles in place |
| 12 | `slide_left` | loop | 0.6 s | defensive side-shuffle step to HIS left (in place, the game moves him) |
| 13 | `slide_right` | loop | 0.6 s | the same to his right |
| 14 | `steal` | once | 0.6 s | a quick lunge and poke with the right hand low in front. events: `poke` |
| 15 | `block` | once | 0.9 s | a big vertical jump with both arms straight up (~0.5 m). events: `apex` |
| 16 | `stumble` | once | 1.0 s | beaten by a crossover: off balance, a spin, nearly falls, recovers |
| 17 | `celebrate` | once (or loop) | 1.6 s | fist pumps and a jump, very happy |
| 18 | `dance` | loop | 2 s | a little victory dance (for winning the match) |
| 19 | `sad` | once | 1.6 s | disappointed: hands on the head, head down |
| 20 | `high_five` | once | 1.0 s | a high five / wave to the camera |

Style: snappy and cartoony (squash-and-stretch feel in the timing), like a kids' animated sports game. Rob moves a bit
heavier and robotic (his antenna wobbles, heart bounces). Foxino's tail follows the motion.

## 4. Court v2 (≤ 55k triangles for every court file together)
Keep v1's layout and look; add life and detail where the camera sees it (camera ≈ (0, 4.7, 12.6) → (0, 1.85, 2.6),
phone portrait, plus a wide 16:9 view):
- **sb-crowd.glb**: 6 different low-poly fans (≤ 600 tris each, kids/adults, colourful clothes, some with Foxino caps,
  foam fingers or signs "GO FOXINO" / "ROB #7"), seated, arms half up; each one its own object `Fan1`…`Fan6`. The game
  places copies on the Seat empties and makes them bounce.
- **sb-extras.glb**: string lights / bunting across the court from the lamps to the wall (object `Lights`, the bulbs as
  a separate emissive `Bulbs`), a shot clock on the hoop pole (a box with a front plane `ShotClockFace` with UVs 0–1 for a
  game texture), a scorer's table or a cooler by the bench, a few plants in pots, a bike leaning on the fence, a
  basketball on the bleachers, pigeons on the wall (3–4 tiny birds, objects `Bird1..`), sneaker scuff marks and a few
  puddle decals (flat, 4 mm above the court).
- Optional: one more building row with more detail on the faces the camera sees, roof-top neon "FOXINO" sign (emissive).

## Hand-back
Branch **`blender/streetball-v2`** of `michalzasilka-art/foxino-sports`, folder `blender/streetball-v2/`:
`foxino-baller.glb`, `rob-baller.glb` (each with all 20 clips as glTF animations, the exact names above),
`sb-crowd.glb`, `sb-extras.glb` (+ any v1 file you improve, same names), `ANIMS.md` (the clip lengths and the event
frames), previews (the two characters' contact sheets of the 20 clips, the court), and the triangle counts. Push and
message **Fugio Boss** with the commit hash. Don't touch `sports/`, `penalty/` or `shared/`.
