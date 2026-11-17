# Blender brief v2: the winter stadium lobby, IMPROVED (from Fugio Boss, the Mac)

The user (2026-11-17): "work on improving the Foxino Sports menu models".

Your v1 (`blender/winter-stadium`, 9a6f625) is live at fugio.co/sports and looks lovely. See the screenshots in `blender/refs/`:
- `winter-live-v011-phone.png`: the phone view
- `winter-live-v011-wide.png`: the wide view
- `winter-live-v011-party.png`: two players

The same layout, cameras, names and style rules as `BRIEF-winter-stadium.md` apply.

**What looks weak today** (please fix these):
1. **The two platforms** are code-made dark-navy discs with a glow. They look plain and out of style in the winter scene,
   and they are the closest thing to the camera.
2. **The bottom third of the phone picture** is empty paving.
3. **The plaza has no life**: nobody is there but Foxino.
4. **The stadium's big flat bands:** the roof ring is one plain band, and the space above the entrance arch is empty.
   The phone camera looks straight at both.
5. **The far horizon** is hidden behind the stadium on a phone. On a wide screen it shows plain mountains only.

## The frame budget
The frame today is about 54.5k triangles. **After v2 it must stay ≤ 90k on a phone** (100k is the hard limit, and we
keep 10 % spare). Below are the budgets per file. Spend them where the cameras look.

## 1. `ws-podium.glb`: the player platform (≤ 2,500 tris), NEW
- **One podium, centred at the origin.** The code places two copies: yours at (0, 0, 15.6) and the friend's at
  about (2, 0, 14.6).
- **Size:** radius about 1.0 at the top and 1.15 at the base. **The top surface must be at y = 0.31** (Foxino stands
  there).
- **The look:** a winter champion's podium.
  - a chunky faceted pedestal of snowy stone with a gold trim band
  - the top is a frosted ice disc (material `PodiumTop`, very light cyan, roughness 0.2)
  - a few small ice crystals and a puffy snow drift round its foot
  - two or three short steps on the front (+z) side are welcome
- **The glowing ring:** its own object `PodiumRing`, with material `PodiumGlow` (white), a thin ring round the top edge.
  The code tints it per player: yellow for you, cyan when empty, orange when the friend is there.
- **No text.**

## 2. `ws-front.glb`: the foreground (≤ 8,000 tris), NEW
- **The paving emblem:** a big round mosaic inlaid in the paving round the two podiums. It is centred about (1, 0.035, 15),
  radius about 5–6 m.
  - A huge snowflake with five rings in a row inside it, in our colours: yellow #ffcd1c, purple #8f52d9, cyan #3cc6ef,
    orange #ff7d22, pink #ff5fb8.
  - Use coloured stone slabs on a lilac base, with a gold border ring.
  - It must be flat (y 0.035, just above your `Paving` at 0.03), so it does not z-fight. Some snow dust lies on its edge.
  - This is what makes the empty bottom of the phone picture beautiful.
- **Two planters:** big snowy stone planters with a small pine, a lantern post (`LampLit` head) and a few presents or
  sports balls in the snow.
  - They sit at the bottom left and right corners, about (−7, 0, 20) and (8, 0, 19). In the wide view they frame the
    picture; on a phone they are just at the edge.
  - They must stay outside x −6…6 (the clear zone).
- **Snow drifts:** a few puffy drifts along the paving's side edges, between z 8 and 26.

## 3. `ws-people.glb`: visitors (≤ 5,000 tris in total), NEW
- **8 low-poly visitors in winter clothes**, each its own object `Visitor1` … `Visitor8`.
  - Each one has its origin at its feet, faces +z, and needs no rig.
  - Height is 1.1–1.7 m: some kids, some adults.
  - They wear bobble hats, scarves and puffy jackets in our colours. One pulls a sled, one carries skis on the shoulder,
    one waves a foam finger, one holds a small Foxino flag.
  - **Each one ≤ 600 tris, one material set** (vertex colours or plain materials).
- The code walks them along the walkway sides (x ±4.5…6.5, z −30…6), with a small bob and turns. Make them read well
  from 10–40 m away: big simple silhouettes and bright colours.

## 4. `ws-stadium.glb` v2 (≤ 30,000 tris; v1 was 18.8k)
Keep v1's design. Spend the extra triangles on the front half:
- **A big curved LED screen** above the entrance arch, on the upper tier.
  - Object `Screen`, material `Screen`, UVs 0–1 over the whole face, 16:9, about 14 × 7.9 m.
  - The code shows the Foxino Sports logo and the sports on it.
  - Give it a dark frame with small lights.
- **The roof ring:** a lattice truss along its outer face (triangles in the steel), with a few spotlight cans under it.
  Add **16 small flags on short masts round the top of the ring**, as their own objects `RoofFlag.001…016`, set up like
  the plaza flags (origin at the pole, cloth pointing +x, 6 × 3 quads, our colours).
- **A frieze over the ground-floor windows:** relief panels with simple sport figures (football, tennis, basketball,
  skiing, skating) in white on purple.
- **The entrance:** two revolving doors, a red carpet runner up the steps (with snow at its edges), and two big snowy
  ice sculptures beside the steps: a fox head and a ball.
- The back half stays silhouette only.

## 5. `ws-far.glb` v2 (≤ 8,000 tris; v1 was 3.4k)
- **A ski jump** on the mountain to the left (an x of about −120…−200, z < −160): the in-run, the take-off, the judges'
  tower, and a row of `LampLit` lights along it.
- **A chairlift:** a line of pylons with little cabins up a slope.
- **A small village** at the foot of the mountains, with warm-lit windows (`WindowLit`) and chimneys.
- Keep the mountains and the forest.

## Names the code uses (new in v2)
`Podium`, `PodiumRing` (material `PodiumGlow`), `PodiumTop`, `Screen` (material `Screen`), `Visitor1..8`,
`RoofFlag.###`. Glow materials as before: `WindowLit`, `LampLit`, `Glow`.

## Hand-back
Push branch **`blender/winter-stadium-v2`** with folder `blender/winter-stadium-v2/`:
- the GLBs that changed or are new: ws-stadium, ws-far, ws-podium, ws-front, ws-people
- `MODELS-winter-stadium-v2.md` with the triangle counts
- previews from the phone and wide cameras, with the podiums placed at (0, 0, 15.6) and (2, 0, 14.6)
- close-ups: the screen, the podium, the visitors line-up

Then message **Fugio Boss** with the commit hash. Don't touch `sports/`, `penalty/` or `shared/`.
