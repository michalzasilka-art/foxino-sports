# Streetball: the 20 clips (foxino-baller.glb and rob-baller.glb)

Both files carry the same 20 glTF animations with the same names.

- **Sampling:** 30 fps. Every frame is sampled, and every clip keys every bone (translation, rotation and scale), so
  cross-fades never leave a bone behind.
- **Time:** each clip starts at t = 0. An event at frame *f* happens at **t = f / 30 s**.
- **Loops:** in looping clips the last frame equals the first.
- **In place:**
  - The hips only move up and down for jumps and crouches.
  - The sideways sway in `defense`, the slides, `stumble` and `dance` peaks at 6 cm on Foxino (4 cm on Rob) and comes
    back to 0.
  - Forward and back (Z) drift is 0 in every clip.
- **The ball** is not in the files. Hold it in `mixamorig:RightHand`, or between both hands where the notes say
  "chest".

| # | clip | loop | length | frames | events (frame, at 30 fps) | notes |
|---|---|---|---|---|---|---|
| 1 | `idle` | loop | 2.5 s | 75 | — | breathing, looks left and right |
| 2 | `ready` | loop | 1.2 s | 36 | — | athletic stance, ball at the chest in both hands, two bounces on the toes |
| 3 | `dribble` | loop | 0.6 s | 18 | `hand_down` 4 · `bounce` 9 · `hand_up` 15 | right hand; left arm guards |
| 4 | `dribble_run` | loop | 0.6 s | 18 | `hand_down` 4 · `bounce` 9 · `hand_up` 15 | running in place, one stride per loop |
| 5 | `crossover` | once | 0.7 s | 21 | `bounce` 8 (right → left) · `bounce` 16 (left → right) | body fake to his left between the bounces; the left hand has the ball between frames 12 and 14 |
| 6 | `jump_shot` | once | 1.2 s | 36 | `release` 21 | gathers at frame 8, takes off at 14; apex at frame 20 (Foxino 0.41 m, Rob 0.28 m); lands at 30 |
| 7 | `layup` | once | 1.1 s | 33 | `release` 21 | two steps (frames 6 and 12), right knee drive, high right-hand reach; lands at 27 |
| 8 | `dunk` | once | 1.4 s | 42 | `slam` 24 | deep crouch at frame 10; apex at 22 (Foxino 0.59 m, Rob 0.41 m); hangs on the rim from 24 to 30; lands at 36 |
| 9 | `pass` | once | 0.6 s | 18 | `release` 9 | two-hand chest pass with a step forward; thumbs-down follow-through |
| 10 | `catch` | once | 0.5 s | 15 | (hands meet the ball at frame 4) | hands up front, then absorbed to the chest by frame 8 |
| 11 | `defense` | loop | 1.0 s | 30 | — | low wide stance, arms out, small shuffles |
| 12 | `slide_left` | loop | 0.6 s | 18 | — | one side-shuffle step to **his** left (the game moves him) |
| 13 | `slide_right` | loop | 0.6 s | 18 | — | the mirror of `slide_left` |
| 14 | `steal` | once | 0.6 s | 18 | `poke` 8 | lunge on the right foot, low right-hand poke |
| 15 | `block` | once | 0.9 s | 27 | `apex` 15 | both arms straight up (Foxino 0.51 m, Rob 0.35 m) |
| 16 | `stumble` | once | 1.0 s | 30 | — | lurch to his left, a full 360° spin, nearly falls back at frame 20, recovers into defense |
| 17 | `celebrate` | once | 1.6 s | 48 | — | jump with both fists up (frame 10), two "yes!" fist pumps, arms wide |
| 18 | `dance` | loop | 2.0 s | 60 | — | side steps with alternating arm waves, a hip twist with both arms rolling |
| 19 | `sad` | once | 1.6 s | 48 | — | hands on the head and a head shake, then slumps; ends slumped |
| 20 | `high_five` | once | 1.0 s | 30 | (contact at frame 11) | high five to the camera, then a wave |

## Secondary motion

- **Foxino's tail** (`Tail1`, `Tail2`) follows the body with a spring lag and wags a little in the loops. It droops in
  `sad`.
- **Rob's `Antenna`** wobbles on a spring after every head or body move, so the heart bounces. In `sad` it droops
  forward.
- **Rob is heavier:** his clips are the same keys on his rig, but jump heights scale with his shorter legs, so he
  jumps lower.

## How the clips are built

- Every clip is a set of body-relative key poses:
  - hips height and lean
  - spine and head angles
  - IK targets for the hands, relative to the shoulders and measured in arm lengths
  - IK targets for the feet, relative to the rest ankles and measured in leg lengths
- The poses are solved per frame for each rig, so the same keys fit Foxino's and Rob's proportions.
- Source: `source/anim.py` (solver), `source/clips.py` (the 20 clips) and `source/anim_go.py` (bake).
