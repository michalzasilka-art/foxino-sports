// PADDLING (2026-11-27, P1 of 5, Michal: "Paddling → You are answering questions, and based on whether you're right or wrong and on your
// timing, you build your consistency. So even when you guess right as fast as 1 second, there is still no consistency, which would be the green
// part covering 50%, centered in the middle. Around 10 questions, and 4 teams you're competing against.")
// A DRAGON-BOAT sprint on a sunny alpine lake: five long boats with dragon heads, each a crew of animal paddlers and a drummer who beats the
// rhythm; Foxino paddles at the front of the purple boat. A dragon boat is all about paddling together to the drum, so "consistency" is the
// crew's rhythm: every boat's speed AND how in time its paddlers are come from ONE number, its consistency (0..1).
// P1 (this file now): the boats, the crews, the course and the race with a placeholder rule (steady consistency). P2: the questions, the timing
// bar (green = the middle 50 % of the answer time) and the rival AI. P3+: polish.
import { askRhythm, trickCardAfter as trickCard, signPlace, fxRoot } from './askfx.js?v=7';
import { isMuted } from '/penalty/sound.js';
const L = 300, LANE = 7, NB = 5;   // (the race length in metres, the lane width, the boats)
// (P2) ten questions, one every 27 m; each has a 6-second rhythm bar, green from 1.5 s to 4.5 s. How an answer moves the crew's consistency:
const QN = 10, T_ANS = 6, MARKS = Array.from({ length: QN }, (_, i) => 18 + i * 27);
const GAIN = { green: 0.16, early: 0.03, late: 0.03, wrong: -0.14, timeout: -0.12 }, C0 = 0.45;
// the rival crews' consistency along the race (their own progress u = 0..1; no rubber-banding: they never look at Foxino), tuned (pdsim.js) so
// all-green answers usually win, mixed answers land mid-pack, careless ones are last: ROB-OTS the strong steady rival, BEAR CREW a fast starter
// that fades, HARE FORCE steady, OWL STARS a slow starter with a late surge
const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const RIV = { rob: (u) => 0.80 + 0.03 * Math.sin(u * 9), bear: (u) => 0.95 - 0.42 * ss(0.2, 0.65, u), hare: (u) => 0.72 + 0.03 * Math.sin(u * 7), owl: (u) => 0.5 + 0.42 * ss(0.4, 0.8, u) };
const TEAMS = {
  fox: { name: 'FOXINO', hull: 0x7b3fd1, trim: 0xffc23a, vest: 0xff8a1a, crew: 'fox', fur: 0x9a5ae0, flag: ['#7b3fd1', '#ffc23a'] },
  friend: { name: 'FRIEND', hull: 0xff7d22, trim: 0xffffff, vest: 0x2b3a7a, crew: 'fox', fur: 0xf08a3a, flag: ['#ff7d22', '#ffffff'] },
  rob: { name: 'ROB-OTS', hull: 0x2fb7c8, trim: 0xe8f0ff, vest: 0x2a3f7a, crew: 'robot', fur: 0xc9d2e3, flag: ['#2fb7c8', '#e8f0ff'] },
  bear: { name: 'BEAR CREW', hull: 0xe8304a, trim: 0xffe0a0, vest: 0xffd23f, crew: 'bear', fur: 0x8a5a3a, flag: ['#e8304a', '#ffe0a0'] },
  hare: { name: 'HARE FORCE', hull: 0x2fbf6a, trim: 0xffffff, vest: 0xff5fa2, crew: 'hare', fur: 0xf4efe6, flag: ['#2fbf6a', '#ffffff'] },
  owl: { name: 'OWL STARS', hull: 0xffa21f, trim: 0x5a3a8a, vest: 0x36b5e0, crew: 'owl', fur: 0xdcc9a6, flag: ['#ffa21f', '#5a3a8a'] } };
const ROWS = [2.3, 0.6, -1.1];   // (the paddlers' rows along the boat, front to back; two per row, left and right)
const S = { boats: [], a: null, phase: 'menu', time: 0, done: 0, place: 0, pc: C0, streak: 0, inR: 0, rock: 0, uT: { value: 0 }, shot: 'chase', shotT: 0, crowd: null, crowdN: 0, paddle: null, me: null };
export const _S = S;
const laneX = (i) => (i - 2) * LANE;
const hsh = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// ---- small geometry helpers: everything is built in code, flat-shaded, one vertex-coloured mesh per object --------------------------------
function merge(THREE, parts) {   // parts: [geometry, colour, matrix?] → one non-indexed geometry with vertex colours
  const pos = [], col = [], C = new THREE.Color();
  for (const [g0, c, m] of parts) { const g = (g0.index ? g0.toNonIndexed() : g0.clone()); if (m) g.applyMatrix4(m); const p = g.attributes.position.array, own = c == null && g.attributes.color ? g.attributes.color.array : null; if (!own) C.set(c);
    for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); const k = 0.94 + hsh(i, p.length) * 0.12; if (own) col.push(own[i], own[i + 1], own[i + 2]); else col.push(C.r * k, C.g * k, C.b * k); } }   // (c = null: keep the part's own colours)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
const M4 = (THREE, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// the hull: a long narrow V-section, pointed at both ends, a dragon-scale stripe along the side, a wooden gunwale; the dragon's neck and head
// at the bow, its curled tail at the stern, the drum at the front
function hullGeo(THREE, T) {
  const N = 16, len = 11.4, pos = [], col = [], cH = new THREE.Color(T.hull), cT = new THREE.Color(T.trim), cW = new THREE.Color(0x8a5a32), cB = new THREE.Color(T.hull).multiplyScalar(0.55);
  const ring = (u) => { const z = (u - 0.5) * len, w = 0.68 * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, u))), 0.55), top = 0.42 + 0.18 * Math.pow(Math.abs(u - 0.5) * 2, 3);
    return [[-w, top, z], [-w * 0.92, 0.12, z], [-w * 0.45, -0.2, z], [w * 0.45, -0.2, z], [w * 0.92, 0.12, z], [w, top, z]]; };
  const tri = (a, b, c, C) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(C.r, C.g, C.b); };
  for (let i = 0; i < N; i++) { const A = ring(i / N), B = ring((i + 1) / N);
    for (let k = 0; k < 5; k++) { const C = k === 0 || k === 4 ? ((i % 2) ? cT : cH) : k === 2 ? cB : cH; tri(A[k], B[k], B[k + 1], C); tri(A[k], B[k + 1], A[k + 1], C); }   // (the outside: the scale stripe takes turns gold / hull colour)
    tri(A[5], B[5], B[0], cW); tri(A[5], B[0], A[0], cW); }   // (the deck / gunwale)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), ico = (r, det = 0) => new THREE.IcosahedronGeometry(r, det), cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
  const parts = [[g, null],
    // the dragon: the neck rising from the bow, the head, the open red mouth, white eyes with dark pupils, golden horns and a mane
    [box(0.36, 1.25, 0.42), T.hull, M4(THREE, 0, 0.95, 5.55, 0.42)], [box(0.62, 0.52, 0.82), T.hull, M4(THREE, 0, 1.62, 6.0, 0.08)], [box(0.5, 0.22, 0.62), T.hull, M4(THREE, 0, 1.5, 6.55, 0.1)],
    [box(0.46, 0.12, 0.55), 0xd83040, M4(THREE, 0, 1.34, 6.6, 0.25)], [ico(0.12), 0xffffff, M4(THREE, -0.27, 1.75, 6.25)], [ico(0.12), 0xffffff, M4(THREE, 0.27, 1.75, 6.25)],
    [ico(0.06), 0x2a1d40, M4(THREE, -0.33, 1.76, 6.3)], [ico(0.06), 0x2a1d40, M4(THREE, 0.33, 1.76, 6.3)],
    [cone(0.08, 0.5), T.trim, M4(THREE, -0.18, 2.02, 5.82, -0.6)], [cone(0.08, 0.5), T.trim, M4(THREE, 0.18, 2.02, 5.82, -0.6)],
    [box(0.1, 0.5, 0.7), T.trim, M4(THREE, 0, 1.45, 5.45, 0.42)],
    // the tail: a curl up at the stern
    [cone(0.22, 1.2, 5), T.hull, M4(THREE, 0, 1.0, -6.05, -0.75)], [cone(0.14, 0.6, 5), T.trim, M4(THREE, 0, 1.62, -6.55, -1.6)],
    // the drum at the front, a seat for the drummer facing the crew
    [new THREE.CylinderGeometry(0.34, 0.34, 0.36, 10), 0xd8b47a, M4(THREE, 0, 0.66, 4.05)], [new THREE.CylinderGeometry(0.35, 0.35, 0.06, 10), 0xc0302a, M4(THREE, 0, 0.86, 4.05)]];
  return merge(THREE, parts);
}

// the crews: little animal paddlers (the same chunky low-poly style as FoxSports), one body mesh + one arms-and-paddle mesh each (~130 triangles)
function crewGeo(THREE, T) {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), ico = (r, det = 0) => new THREE.IcosahedronGeometry(r, det), cone = (r, h, s = 4) => new THREE.ConeGeometry(r, h, s);
  const fur = T.fur, P = [[box(0.42, 0.5, 0.32), T.vest, M4(THREE, 0, 0.3, 0)], [box(0.3, 0.2, 0.36), 0x3a3a6a, M4(THREE, 0, 0.04, 0.06)]];   // (the life vest, the shorts)
  if (T.crew === 'robot') P.push([box(0.38, 0.34, 0.36), fur, M4(THREE, 0, 0.74, 0)], [box(0.3, 0.12, 0.05), 0x46e6ff, M4(THREE, 0, 0.76, 0.18)], [new THREE.CylinderGeometry(0.02, 0.02, 0.22, 4), 0x9aa6c0, M4(THREE, 0, 1.0, 0)], [ico(0.05), 0xff4d6d, M4(THREE, 0, 1.12, 0)]);
  else { P.push([ico(0.24, 0), fur, M4(THREE, 0, 0.76, 0, 0, 0, 0, 1, 0.95, 1)]);
    if (T.crew === 'fox') P.push([cone(0.09, 0.24), fur, M4(THREE, -0.13, 1.0, 0, 0, 0, 0.25)], [cone(0.09, 0.24), fur, M4(THREE, 0.13, 1.0, 0, 0, 0, -0.25)], [cone(0.08, 0.18), 0xfff4e6, M4(THREE, 0, 0.72, 0.22, Math.PI / 2)]);
    if (T.crew === 'bear') P.push([ico(0.08), fur, M4(THREE, -0.17, 0.95, 0)], [ico(0.08), fur, M4(THREE, 0.17, 0.95, 0)], [ico(0.1), 0xd9b48a, M4(THREE, 0, 0.7, 0.2)]);
    if (T.crew === 'hare') P.push([box(0.08, 0.36, 0.05), fur, M4(THREE, -0.08, 1.12, 0, 0, 0, 0.12)], [box(0.08, 0.36, 0.05), fur, M4(THREE, 0.08, 1.12, 0, 0, 0, -0.12)], [box(0.04, 0.26, 0.02), 0xff9ac0, M4(THREE, -0.08, 1.12, 0.03, 0, 0, 0.12)], [box(0.04, 0.26, 0.02), 0xff9ac0, M4(THREE, 0.08, 1.12, 0.03, 0, 0, -0.12)]);
    if (T.crew === 'owl') P.push([ico(0.09), 0xffffff, M4(THREE, -0.09, 0.8, 0.19)], [ico(0.09), 0xffffff, M4(THREE, 0.09, 0.8, 0.19)], [ico(0.045), 0x2a1d40, M4(THREE, -0.09, 0.8, 0.26)], [ico(0.045), 0x2a1d40, M4(THREE, 0.09, 0.8, 0.26)], [cone(0.05, 0.12), 0xffb020, M4(THREE, 0, 0.7, 0.22, Math.PI / 2)], [cone(0.05, 0.14), fur, M4(THREE, -0.15, 0.97, 0, 0, 0, 0.4)], [cone(0.05, 0.14), fur, M4(THREE, 0.15, 0.97, 0, 0, 0, -0.4)]);
    if (T.crew !== 'owl' && T.crew !== 'robot') P.push([ico(0.035), 0x2a1d40, M4(THREE, -0.08, 0.8, 0.21)], [ico(0.035), 0x2a1d40, M4(THREE, 0.08, 0.8, 0.21)]); }
  const body = merge(THREE, P);
  // the arms and the paddle (built for a paddler on the boat's LEFT; mirrored for the right): pivot at the shoulders, the shaft down and out to the blade
  const arm = merge(THREE, [[box(0.1, 0.1, 0.46), T.vest, M4(THREE, -0.12, 0.05, 0.2, 0.3)], [box(0.1, 0.1, 0.46), T.vest, M4(THREE, 0.12, -0.05, 0.2, 0.55)],
    [new THREE.CylinderGeometry(0.03, 0.03, 1.75, 5), 0xd8b47a, M4(THREE, -0.32, -0.25, 0.42, 0, 0, 0.55)], [box(0.05, 0.42, 0.2), T.trim, M4(THREE, -0.72, -0.98, 0.42, 0, 0, 0.55)],
    [ico(0.07), fur, M4(THREE, -0.1, 0.0, 0.44)], [ico(0.07), fur, M4(THREE, -0.45, -0.45, 0.44)]]);
  return { body, arm };
}

function flagTex(THREE, T) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = T.flag[0]; g.fillRect(0, 0, 256, 160); g.fillStyle = T.flag[1]; g.fillRect(0, 118, 256, 42);
  g.font = '900 38px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(29,22,64,.85)'; g.strokeText(T.name, 128, 62); g.fillStyle = '#fff'; g.fillText(T.name, 128, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- (N19–N22, night 27→28 Nov, Michal: "make models for the team members using Tripo ... every boat unique") the lanes' real boats and crews ----
// Five dragon boats (fox, robot, bear, hare, owl: LOD0 ~3.3k / LOD1 ~0.9k, seats as empties), five animal crews (skinned, ~1.2k / 0.39k, clips
// paddle_L / paddle_R / cheer / drum with the paddle and mallets keyed), and the summer-lake kit (the race arch, the start pontoon, lane posts,
// tents, team flags). They load after the code-built race is up and take its place; each paddler's clip is driven by the boat's stroke phase, so
// the crew's rhythm (and how out of time it gets when the consistency drops) works exactly as before.
const PK_FILES = { boats: ['Boat_Fox', 'Boat_Robot', 'Boat_Bear', 'Boat_Hare', 'Boat_Owl'], crews: ['Crew_Fox', 'Crew_Robot', 'Crew_Bear', 'Crew_Hare', 'Crew_Owl'], scenery: ['SM_RaceArch', 'SM_Pontoon', 'SM_LanePost', 'SM_Tent', 'SM_TeamFlag'], 'night/trees': ['SM_Tree_Tall', 'SM_Tree_Full', 'SM_Tree_Young'] };
const TEAMK = { fox: 'Fox', friend: 'Fox', rob: 'Robot', bear: 'Bear', hare: 'Hare', owl: 'Owl' }, SEATS = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'Drum'];
let PK_P = null;
function padKit(E) { return PK_P || (PK_P = Promise.all(Object.entries(PK_FILES).flatMap(([d, L]) => L.map((n) => E.loadGLB(`models/${d.includes('/') ? d : 'paddling/' + d}/${n}.glb?v=1`).then((gl) => [n, gl]).catch(() => [n, null])))).then((L) => Object.fromEntries(L.filter(([, o]) => o)))); }
function cloneSkinned(src) {   // (a skinned model's copy with its own skeleton: the bones re-bound to the copy's own bones)
  const c = src.clone(true), map = new Map(), par = (a, b) => { map.set(a, b); for (let i = 0; i < a.children.length; i++) par(a.children[i], b.children[i]); }; par(src, c);
  src.traverse((a) => { if (!a.isSkinnedMesh) return; const b = map.get(a), sk = a.skeleton.clone(); sk.bones = a.skeleton.bones.map((bn) => map.get(bn)); b.bind(sk, a.bindMatrix); }); return c;
}
const signTx = (tex) => { const t = tex.clone(); t.flipY = false; t.needsUpdate = true; return t; };   // (glTF UVs)
function numTex(THREE, n) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#16205a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffc23a'; g.fillRect(14, 14, 228, 228); g.fillStyle = '#16205a';
  g.font = '400 190px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 128, 140); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function padDress(E, kit) {
  const { THREE } = E, mat = (o, f) => o.traverse((m) => { if (m.isMesh) f(m, (m.material && m.material.name) || ''); });
  for (const B of S.boats) { const k = TEAMK[B.team], boat = kit['Boat_' + k], crew = kit['Crew_' + k]; if (!boat || !crew) continue;
    for (const o of [...B.g.children]) if (o.isMesh && o.geometry === S.hulls[B.team]) B.g.remove(o);
    for (const P of B.pad) B.g.remove(P.g); B.g.remove(B.dr); B.g.remove(B.flag); for (const o of [...B.g.children]) if (o.isMesh && o.geometry.type === 'CylinderGeometry') B.g.remove(o);   // (the code flag and its pole: the dragon boat has its own tail)
    const bs = boat.scene.clone(true); B.g.add(bs); const me = B === S.me;
    mat(bs, (m) => { m.castShadow = me && !/_LOD1$/.test(m.name); m.userData.noCast = !m.castShadow; m.receiveShadow = true; });
    if (B.team === 'friend') mat(bs, (m) => { m.material = m.material.clone(); m.material.color.setRGB(1.25, 0.82, 0.55); });   // (the friend's boat: the fox boat in warm orange)
    B.kl0 = bs.getObjectByName('Boat_' + k); B.kl1 = bs.getObjectByName('Boat_' + k + '_LOD1'); const clips = Object.fromEntries(crew.animations.map((c) => [c.name, c])); B.kc = [];
    for (const sn of SEATS) { if (me && sn === 'L1') continue; const seat = bs.getObjectByName('Seat_' + sn); if (!seat) continue;
      const c = cloneSkinned(crew.scene); c.position.set(seat.position.x, 0, seat.position.z); if (sn === 'Drum') c.rotation.y = Math.PI; B.g.add(c); const l0 = [], l1 = [];
      c.traverse((o) => { if (o.isSkinnedMesh) (/_LOD1$/.test(o.name) ? l1 : l0).push(o); if (o.isMesh) { o.castShadow = me && !/_LOD1$/.test(o.name) && o.isSkinnedMesh; o.userData.noCast = !o.castShadow; o.receiveShadow = true; } });
      c.traverse((o) => { if (/^Mallet/.test(o.name)) o.visible = sn === 'Drum'; else if (/^Paddle/.test(o.name)) o.visible = sn !== 'Drum'; });   /* (a prop keyed to scale 0 is still drawn: hide the ones this seat never uses) */
      const mx = new THREE.AnimationMixer(c), clip = sn === 'Drum' ? clips.drum : sn[0] === 'L' ? clips.paddle_L : clips.paddle_R, act = mx.clipAction(clip); act.play();
      for (const m of l0) m.visible = me; for (const m of l1) m.visible = !me;   /* (the right level of detail from the first frame) */
      B.kc.push({ c, mx, act, cheer: clips.cheer ? mx.clipAction(clips.cheer) : null, drum: sn === 'Drum', dur: clip.duration, l0, l1, j: hsh(B.lane * 7 + SEATS.indexOf(sn), 5) * 2 - 1, cheering: false }); }
    if (me && B.kl0) {   // (v96 B4: his hull, right in front of the camera: crisp painted dragon scales and a gold trim band laid over the baked texture in the
      // hull's own space (sharp at any distance, no new UVs needed), only along the sides between the dragon's head and tail)
      const hm = B.kl0.material.clone(); if (hm.map) { hm.map.anisotropy = 8; } hm.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp; varying vec3 vLn;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position; vLn = normal;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp; varying vec3 vLn;').replace('#include <map_fragment>', `#include <map_fragment>
          float sideK = (1.0 - smoothstep(0.55, 0.8, vLn.y)) * (1.0 - smoothstep(4.4, 4.9, abs(vLp.z))) * step(vLp.y, 0.5);
          vec2 q = vec2(vLp.z * 3.2, vLp.y * 7.5); q.x += 0.5 * floor(q.y); vec2 f = fract(q) - vec2(0.5, 0.0); float arc = length(vec2(f.x, f.y * 0.9));
          float edge = smoothstep(0.42, 0.48, arc) * (1.0 - smoothstep(0.5, 0.58, arc));
          vec3 paint = mix(vec3(0.20, 0.05, 0.64), vec3(0.34, 0.11, 0.78), smoothstep(0.0, 0.5, f.y)); paint = mix(paint, vec3(0.06, 0.02, 0.24), edge);
          paint = mix(paint, vec3(1.0, 0.30, 0.03), smoothstep(0.04, -0.02, vLp.y));
          float aa = max(fwidth(vLp.y), 0.002); diffuseColor.rgb = mix(diffuseColor.rgb, paint, sideK * (1.0 - smoothstep(0.34 - aa, 0.34 + aa, vLp.y)));
          float trim = smoothstep(0.34 - aa, 0.34 + aa, vLp.y) * (1.0 - smoothstep(0.5 - aa, 0.5 + aa, vLp.y)) * sideK;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.55, 0.05), trim);`); };
      hm.customProgramCacheKey = () => 'foxhull-v4'; B.kl0.material = hm; }
    if (me) {   // (N19–N22b, v96: his own boat, right in front of the camera: a 4th row of paddlers and a steerer at the stern on little benches, so the
      // whole length is crewed, and a crisp painted plank deck over the boat's own (smeary close up) floor)
      const wood = new THREE.MeshStandardMaterial({ color: 0xb07a46, roughness: 0.7 }), extra = [['X1', 0.42, -2.75, 'paddle_L'], ['X2', -0.42, -2.75, 'paddle_R'], ['ST', 0, -4.3, 'steer']];
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.3), wood); bench.position.set(0, 0.33, -2.75); bench.castShadow = bench.receiveShadow = true; B.g.add(bench);
      const stool = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.34), wood); stool.position.set(0, 0.18, -4.3); stool.castShadow = stool.receiveShadow = true; B.g.add(stool);
      const pc = document.createElement('canvas'); pc.width = 256; pc.height = 1024; const pg = pc.getContext('2d'); for (let i = 0; i < 4; i++) { pg.fillStyle = ['#c48a52', '#b97d47', '#cf9760', '#bd8249'][i]; pg.fillRect(i * 64, 0, 64, 1024); pg.fillStyle = 'rgba(70,40,20,.55)'; pg.fillRect(i * 64, 0, 3, 1024); for (let y = (i * 173) % 256; y < 1024; y += 256) { pg.fillRect(i * 64, y, 64, 3); pg.fillStyle = 'rgba(60,35,15,.7)'; pg.beginPath(); pg.arc(i * 64 + 10, y + 12, 2.5, 0, 7); pg.arc(i * 64 + 54, y + 12, 2.5, 0, 7); pg.fill(); pg.fillStyle = 'rgba(70,40,20,.55)'; } }
      const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8; pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(1, 3);
      const deck = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 8.0), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.75 })); deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.05, -0.4); deck.receiveShadow = true; B.g.add(deck);
      for (const [nm, x, z, cl] of extra) { const c = cloneSkinned(crew.scene); c.position.set(x, 0, z); B.g.add(c); const l0 = [], l1 = [];
        c.traverse((o) => { if (o.isSkinnedMesh) (/_LOD1$/.test(o.name) ? l1 : l0).push(o); if (o.isMesh) { o.castShadow = false; o.userData.noCast = true; o.receiveShadow = true; } if (/^Mallet/.test(o.name)) o.visible = false; });
        for (const m of l1) m.visible = false; const mx = new THREE.AnimationMixer(c), clip = cl === 'paddle_L' ? clips.paddle_L : clips.paddle_R, act = mx.clipAction(clip); act.play();
        B.kc.push({ c, mx, act, cheer: clips.cheer ? mx.clipAction(clips.cheer) : null, drum: false, steer: cl === 'steer', dur: clip.duration, l0, l1, j: hsh(B.lane * 7 + nm.length, 9) * 2 - 1, cheering: false }); } }
    if (B.kl0) B.kl0.visible = me; if (B.kl1) B.kl1.visible = !me; B.kit = true; }
  padTrees(E, kit); S.a.g.position.set(0.42, 0.36, ROWS[0]);   /* (v97: seat L1, +X = his left: the side his paddle stroke reaches, so the blade is in the water outside the hull) */   // (Foxino sits on seat R1 of his boat: the boat's -X side, his paddle on that side as before)
  // the summer-lake kit: the race arches, the start pontoon and lane posts, the tents and team flags
  if (kit.SM_RaceArch) for (const A of S.archG || []) { const a = kit.SM_RaceArch.scene.clone(true); a.position.set(0, 0, A.z);
    mat(a, (m, n) => { if (/tint/i.test(n)) m.material = new THREE.MeshStandardMaterial({ color: A.color, roughness: 0.5 }); else if (/signface/i.test(n)) { m.material = new THREE.MeshBasicMaterial({ map: signTx(E.bannerMaterial(A.text, A.color).map), toneMapped: false }); const back = m.clone(); back.rotation.y += Math.PI; back.userData.sfBack = true; (A.backs || (A.backs = [])).push([m.parent, back]); } m.castShadow = false; m.userData.noCast = true; });
    for (const [par, bk] of A.backs || []) if (!bk.parent) par.add(bk);   // (the banner reads the right way round from both sides: a second face turned to the far side)
    E.scene.remove(A.ag); E.scene.add(a); }
  if (kit.SM_Pontoon) { for (const o of S.pont || []) if (o.parent) o.parent.remove(o);
    for (let i = 0; i < NB; i++) { const p = kit.SM_Pontoon.scene.clone(true); p.position.set(laneX(i), 0, -8.2); mat(p, (m) => { m.receiveShadow = true; m.castShadow = false; m.userData.noCast = true; }); E.scene.add(p);
      if (kit.SM_LanePost) { const q = kit.SM_LanePost.scene.clone(true); q.position.set(laneX(i) + 2.6, 0.35, -8.6); q.rotation.y = Math.PI; mat(q, (m, n) => { if (/signface/i.test(n)) m.material = new THREE.MeshBasicMaterial({ map: signTx(numTex(THREE, i + 1)), toneMapped: false }); m.userData.noCast = true; }); E.scene.add(q); } } }
  if (kit.SM_Tent) for (const [t, x, z, c] of S.tents || []) { const n = kit.SM_Tent.scene.clone(true); n.position.set(x, t.position.y, z); n.rotation.y = hsh(x, z) * 6.28; mat(n, (m, nm) => { if (/tint/i.test(nm)) m.material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }); m.castShadow = false; m.userData.noCast = true; }); if (t.parent) t.parent.remove(t); E.scene.add(n); }
  if (kit.SM_TeamFlag && S.shoreH) { const cols = [0x7b3fd1, 0x2fb7c8, 0xe8304a, 0x2fbf6a, 0xffa21f]; let i = 0;
    for (const [x0, z0] of [[-39, -24], [39, -24], [-39, L - 24], [39, L + 18]]) for (let k = 0; k < 3; k++, i++) { const x = x0 + Math.sign(x0) * (k % 2) * 1.5, z = z0 + k * 4, f = kit.SM_TeamFlag.scene.clone(true), col = cols[i % 5];
      f.position.set(x, S.shoreH(x, z), z); f.rotation.y = x0 < 0 ? Math.PI / 2 : -Math.PI / 2; mat(f, (m, n) => { if (/tint|signface/i.test(n)) m.material = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide }); m.castShadow = false; m.userData.noCast = true; }); E.scene.add(f); } }
}
// (v96) the shore trees: lane D's snowy trees (their cheap LOD1, ~130 tris) along the near shores; far up the hills crossed-quad snowy firs drawn
// on a canvas (4 triangles each), so the 300 trees cost about as much as the old faceted ones
function snowFirTex(THREE) { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#5a3c26'; g.fillRect(58, 214, 12, 42);
  for (let i = 0; i < 5; i++) { const y = 30 + i * 40, w = 26 + i * 12; g.fillStyle = i % 2 ? '#24573f' : '#2a6448'; g.beginPath(); g.moveTo(64, y - 30); g.lineTo(64 - w, y + 26); g.lineTo(64 + w, y + 26); g.closePath(); g.fill();
    g.fillStyle = '#f3f7ff'; g.beginPath(); g.moveTo(64, y - 30); g.lineTo(64 - w * 0.55, y + 2); g.quadraticCurveTo(64, y + 10, 64 + w * 0.55, y + 2); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function padTrees(E, kit) {
  const { THREE } = E, T = ['SM_Tree_Tall', 'SM_Tree_Full', 'SM_Tree_Young'].map((k) => kit[k]); if (!T.every(Boolean) || !S.shoreTrees) return; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const near = S.shoreTrees.filter((t) => Math.abs(t[0]) < 62), far = S.shoreTrees.filter((t) => Math.abs(t[0]) >= 62);
  T.forEach((src, ti) => { const L2 = near.filter((t, k) => k % 3 === ti); if (!L2.length) return; src.scene.updateMatrixWorld(true); src.scene.traverse((part) => { if (!part.isMesh || !/_LOD1$/i.test(part.name)) return;
    const im = new THREE.InstancedMesh(part.geometry, part.material, L2.length); L2.forEach(([x, y, z, s2], k) => { q.setFromAxisAngle(Y, k * 2.1); im.setMatrixAt(k, m4.compose(p.set(x, y - 0.2, z), q, sc.setScalar([0.75, 1.0, 1.9][ti] * s2)).multiply(part.matrixWorld)); });
    im.computeBoundingSphere(); im.castShadow = false; im.userData.noCast = true; im.receiveShadow = true; E.scene.add(im); }); });
  const qg = new THREE.PlaneGeometry(1, 2), q2 = qg.clone().rotateY(Math.PI / 2), geo = new THREE.BufferGeometry(), pa = [...qg.attributes.position.array, ...q2.attributes.position.array], ua = [...qg.attributes.uv.array, ...q2.attributes.uv.array];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(ua, 2)); geo.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]); geo.translate(0, 1, 0);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: snowFirTex(THREE), alphaTest: 0.5, side: THREE.DoubleSide, color: 0xd8dcf0 }), far.length);
  far.forEach(([x, y, z, s2], k) => im.setMatrixAt(k, m4.compose(p.set(x, y - 0.2, z), q.setFromAxisAngle(Y, k * 0.7), sc.set(3.4 * s2, 4.2 * s2, 3.4 * s2)))); im.computeBoundingSphere(); im.userData.noCast = true; E.scene.add(im);
  for (const o of S.treeIMs || []) if (o.parent) o.parent.remove(o);
}
function buoyLod(E) { if (!S.bChunks) return; const cz = E.camera.position.z; for (const c of S.bChunks) { const n = c.z > cz - 15 && c.z < cz + 40; c.near.visible = n; c.far.visible = !n; } }
function padAnim(E, B, t, sync, slow) {   // every frame: the boat's and crew's level of detail, and each paddler's clip at the boat's stroke phase
  const d = E.camera.position.distanceTo(B.g.position), near = B === S.me ? d < 40 : B === S.friendB ? false : d < (S.shot === 'start' ? 0 : 6);   /* (only his own boat in full detail, the others when right beside the camera) */ if (B.kl0) B.kl0.visible = near; if (B.kl1) B.kl1.visible = !near;
  if (!near && slow) return;
  for (const K of B.kc) { for (const m of K.l0) m.visible = near; for (const m of K.l1) m.visible = !near;
    if (B.fin && K.cheer && !K.drum) { if (!K.cheering) { K.act.stop(); K.cheer.play(); K.cheering = true; } K.mx.setTime(((t * 0.9 + K.j) % 1.5 + 1.5) % 1.5); continue; }
    if (K.cheering) { K.cheer.stop(); K.act.play(); K.cheering = false; }
    const f = K.steer ? 0.45 + 0.05 * Math.sin(t * 1.3) : K.drum ? ((B.ph % 1) + 1) % 1 : (((B.ph + K.j * sync * 0.42 + 0.25) % 1) + 1) % 1; K.mx.setTime(f * K.dur * 0.999); }   /* (the steerer holds his blade in the water behind, moving it gently) */
}
function makeBoat(E, team, lane) {
  const { THREE } = E, T = TEAMS[team], grp = new THREE.Group(), mat = S.vmat;
  const hull = new THREE.Mesh(S.hulls[team] || (S.hulls[team] = hullGeo(THREE, T)), mat); hull.castShadow = true; hull.receiveShadow = true; grp.add(hull);
  const cg = S.crews[team] || (S.crews[team] = crewGeo(THREE, T)), pad = [];
  ROWS.forEach((z, r) => [-1, 1].forEach((sd, k) => {
    const p = new THREE.Group(); p.position.set(sd * 0.3, 0.38, z);
    const body = new THREE.Mesh(cg.body, mat); body.castShadow = true; p.add(body);
    const arms = new THREE.Group(); arms.position.set(0, 0.62, 0.02); const am = new THREE.Mesh(cg.arm, mat); am.castShadow = true; if (sd > 0) am.scale.x = -1; arms.add(am); p.add(arms);
    grp.add(p); pad.push({ g: p, body, arms, sd, row: r, j: hsh(lane * 7 + r, k) * 2 - 1 }); }));
  // the drummer at the front, facing the crew, beating the drum on every stroke
  const dr = new THREE.Group(); dr.position.set(0, 0.42, 4.65); dr.rotation.y = Math.PI; const dBody = new THREE.Mesh(cg.body, mat); dr.add(dBody);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0xd8b47a, roughness: 0.8 })); const sticks = new THREE.Group(); sticks.position.set(0, 0.62, 0.05); stick.position.set(0.12, 0, 0.27); sticks.add(stick); dr.add(sticks); grp.add(dr);
  // the team flag at the stern
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 })); pole.position.set(0, 1.3, -5.1); grp.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), new THREE.MeshStandardMaterial({ map: flagTex(THREE, T), side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(0, 1.85, -5.6); flag.rotation.y = Math.PI / 2; grp.add(flag);
  // the wake: a soft white V behind the boat (stretches with the speed)
  const wake = new THREE.Mesh(S.wakeGeo, S.wakeMat); wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.04, -6.0); wake.renderOrder = 2; grp.add(wake);
  E.scene.add(grp);
  return { team, T, lane, x: laneX(lane), z: 0, v: 0, c: 0.6, ph: hsh(lane, 3), g: grp, pad, dr, sticks, flag, wake, fin: false, finT: 0, catch: 0 };
}

// the water: a faceted lake that moves (waves in the vertex shader, flat shading = sparkling facets); a big flat far plane under the fog
function makeWater(E) {
  const { THREE } = E, mat = new THREE.MeshStandardMaterial({ color: 0x113560, roughness: 0.25, metalness: 0.0, envMapIntensity: 0.15 });   /* (v96: open, cold, dark-blue winter water) */
  mat.onBeforeCompile = (sh) => { sh.uniforms.uT = S.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 wq = modelMatrix * vec4(position, 1.0);
    transformed.y += 0.10 * sin(wq.x * 0.55 + uT * 1.5) + 0.08 * sin(wq.z * 0.38 - uT * 1.15) + 0.05 * sin((wq.x + wq.z) * 1.05 + uT * 2.2);
    vWq = wq.xyz;`).replace('#include <common>', '#include <common>\nvarying vec3 vWq;');
    // (v97: cold water: a deep blue, the dusk sky only at grazing angles (fresnel), fine ripples glinting)
    sh.fragmentShader = 'uniform float uT;\nvarying vec3 vWq;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      { vec3 V = normalize(cameraPosition - vWq); float rip = sin(vWq.x * 3.7 + uT * 2.1) * sin(vWq.z * 2.9 - uT * 1.7) + 0.6 * sin((vWq.x - vWq.z) * 6.3 + uT * 3.0);
        float fr = pow(1.0 - clamp(V.y + 0.04 * rip, 0.0, 1.0), 5.0); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.62, 0.74, 0.92), fr * 0.4);
        float gl = smoothstep(1.25, 1.55, rip) * (1.0 - smoothstep(30.0, 110.0, length(cameraPosition - vWq))); gl_FragColor.rgb += vec3(0.55, 0.62, 0.75) * gl * 0.35; }`); };
  const g = new THREE.PlaneGeometry(130, 520, 18, 72); g.rotateX(-Math.PI / 2); g.translate(0, 0, L / 2 + 20);
  const w = new THREE.Mesh(g, mat); w.receiveShadow = true; E.scene.add(w);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x24527c, roughness: 0.25 })); far.rotation.x = -Math.PI / 2; far.position.set(0, -0.25, L / 2); E.scene.add(far);
}

// the shores: green hills either side with a sandy edge, trees (round leafy ones and pines), a grandstand of fans by the finish, tents, flags
function makeShores(E) {
  const { THREE } = E, xs = [36, 39, 43, 50, 60, 74, 92, 120, 160], pos = [], col = [], cSand = new THREE.Color(0xe8d6a0), cGrass = new THREE.Color(0x6cbf5a), cGrass2 = new THREE.Color(0x4e9e48), cRock = new THREE.Color(0x8f97a8);
  const h = (x, z) => { const a = Math.abs(x), k = Math.max(0, Math.min(1, (a - 37) / 60)); return -0.5 + k * k * (3 - 2 * k) * (14 + 8 * Math.sin(z * 0.017 + x * 0.03)) + (a > 40 ? 0.6 * Math.sin(x * 0.3 + z * 0.2) : 0); };
  // (v96, Michal's standing rules: a snowy Christmas look, smooth not low poly) snowy shores: one smooth grid a side (shared vertices), icy at the
  // water's edge, snow up the hills, a blue-grey tint where it steepens and grey rock showing on the high steep parts
  void pos; void col; void cSand; void cGrass; void cGrass2; void cRock; const xsF = [36, 37.5, 39, 42, 46, 50, 55, 62, 74, 92, 120, 160];
  for (const sd of [-1, 1]) { const P = [], Cc = [], I = [], zs = []; for (let z = -120; z <= L + 160; z += 8) zs.push(z); const C = new THREE.Color();
    for (const z of zs) for (const x0 of xsF) { const x = sd * x0, y = h(x, z), e = (h(x + sd * 1.5, z) - h(x - sd * 1.5, z)) / 3, st = Math.min(1, Math.abs(e) * 1.6), rk = x0 > 70 && st > 0.45 ? Math.min(1, (st - 0.45) * 3) * (0.5 + 0.5 * Math.sin(z * 0.13 + x0)) : 0;
      if (x0 < 38) C.setHex(0xcfe0f2); else C.setRGB(0.95 - 0.12 * st, 0.96 - 0.08 * st, 1.0 - 0.02 * st); if (rk > 0) C.lerp(new THREE.Color(0x8b93a6), rk * 0.8); P.push(x, y, z); Cc.push(C.r, C.g, C.b); }
    const n = xsF.length; for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < n - 1; i++) { const a2 = j * n + i, b3 = a2 + 1, c2 = a2 + n, d2 = c2 + 1; if (sd > 0) I.push(a2, b3, d2, a2, d2, c2); else I.push(a2, d2, b3, a2, c2, d2); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); gg.setIndex(I); gg.computeVertexNormals();
    const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); ground.receiveShadow = true; E.scene.add(ground); }
  // trees: leafy (an icosahedron crown on a trunk) and pines (two cones), instanced, coloured per tree
  const leafy = new THREE.IcosahedronGeometry(2.2, 0), pine = new THREE.ConeGeometry(1.7, 4.6, 6), trunk = new THREE.CylinderGeometry(0.22, 0.3, 2.4, 5);
  const trees = []; for (let i = 0; i < 300; i++) { const sd = i % 2 ? 1 : -1, z = -90 + hsh(i, 1) * (L + 220), x = sd * (44 + hsh(i, 2) * 90); if (sd > 0 && z > L - 70 && z < L + 40 && x < 70) continue; trees.push([x, h(x, z), z, 0.8 + hsh(i, 3) * 0.7, hsh(i, 4) > 0.45]); }
  const mk = (geo2, list, colr, dy, sy) => { const im = new THREE.InstancedMesh(geo2, new THREE.MeshStandardMaterial({ roughness: 0.9 }), list.length), m = new THREE.Matrix4(), C = new THREE.Color();
    list.forEach(([x, y, z, s], k) => { m.compose(new THREE.Vector3(x, y + dy * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k, 0)), new THREE.Vector3(s, s * sy, s)); im.setMatrixAt(k, m); im.setColorAt(k, C.set(colr).multiplyScalar(0.85 + hsh(k, 9) * 0.3)); });
    im.castShadow = false; im.receiveShadow = false; im.userData.noCast = true; E.scene.add(im); (S.treeIMs || (S.treeIMs = [])).push(im); return im; };
  const L1 = trees.filter((t) => t[4]), L2 = trees.filter((t) => !t[4]);
  mk(leafy, L1, 0x3f7a5a, 3.6, 0.9); mk(trunk, trees, 0x6a4a32, 1.1, 1); mk(pine, L2, 0x2c6a4e, 3.3, 1); S.shoreTrees = trees;   /* (until the lanes' snowy trees load: winter greens) */
  // the grandstand by the finish (right shore): three steps and a crowd of little fans in the teams' colours, cheering
  const gz0 = L - 60, steps = new THREE.Mesh(merge(THREE, [0, 1, 2, 3].map((k) => [new THREE.BoxGeometry(5, 1 + k * 1.1, 80), k % 2 ? 0xdfe6f2 : 0xc9d2e3, M4(THREE, 41 + k * 4, (1 + k * 1.1) / 2 - 0.3, gz0 + 30)])), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
  steps.receiveShadow = true; E.scene.add(steps);
  const fan = merge(THREE, [[new THREE.BoxGeometry(0.5, 0.7, 0.35), 0xffffff, M4(THREE, 0, 0.35, 0)], [new THREE.IcosahedronGeometry(0.24, 0), 0xffffff, M4(THREE, 0, 0.92, 0)]]);
  const fans = []; for (let k = 0; k < 4; k++) for (let z = gz0 - 8; z < gz0 + 68; z += 1.6) if (hsh(k, z) > 0.25) fans.push([41 + k * 4 - 0.6, 0.8 + k * 1.1 - 0.3, z]);
  const cols = [0x7b3fd1, 0xffc23a, 0x2fb7c8, 0xe8304a, 0x2fbf6a, 0xffa21f, 0xff5fa2, 0xffffff];
  const im = new THREE.InstancedMesh(fan, new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), fans.length), m = new THREE.Matrix4(), C = new THREE.Color();
  fans.forEach(([x, y, z], k) => { m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k, m); im.setColorAt(k, C.set(cols[k % cols.length])); });
  im.userData.noCast = true; E.scene.add(im); S.crowd = im; S.fans = fans;
  // tents and flags along the shores at the start and the finish
  const tent = merge(THREE, [[new THREE.ConeGeometry(2.4, 2.2, 4), 0xffffff, M4(THREE, 0, 2.9, 0, 0, Math.PI / 4)], [new THREE.BoxGeometry(3.3, 1.8, 3.3), 0xffffff, M4(THREE, 0, 0.9, 0)]]);
  const tents = [[-42, -14, 0xff5fa2], [-42, -4, 0xffc23a], [42, -10, 0x36b5e0], [-42, L - 10, 0x7b3fd1], [-42, L + 2, 0x2fbf6a], [-42, L + 14, 0xff8a1a]];
  for (const [x, z, c] of tents) { const t = new THREE.Mesh(tent, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })); t.position.set(x, h(x, z), z); t.castShadow = true; E.scene.add(t); (S.tents || (S.tents = [])).push([t, x, z, c]); }
  S.shoreH = h;
}

// the lanes: lines of floating buoys between the lanes (a bigger yellow one every 50 m), the start pontoon, the start and finish arches
function makeLanes(E) {
  const { THREE } = E, list = [];
  for (let k = 0; k <= NB; k++) { const x = laneX(k) - LANE / 2; for (let z = 0; z <= L + 4; z += 9) list.push([x, z, z % 54 === 0 ? 1 : 0, k]); }
  // (v96) round regatta buoys on the lane lines, in 30 m chunks: smooth spheres near the camera, tiny 8-triangle ones far down the course (buoyLod)
  const geo = new THREE.IcosahedronGeometry(0.28, 0), gN = new THREE.SphereGeometry(0.28, 10, 6), gF = new THREE.SphereGeometry(0.28, 4, 2), bm = new THREE.MeshStandardMaterial({ roughness: 0.35 }), C = new THREE.Color(), m = new THREE.Matrix4(); S.bChunks = [];
  for (let z0 = -10; z0 <= L + 10; z0 += 30) { const sub = list.map((it, i) => [it, i]).filter(([it]) => it[1] >= z0 && it[1] < z0 + 30); if (!sub.length) continue; const ims = [gN, gF].map((gg) => { const im = new THREE.InstancedMesh(gg, bm, sub.length);
      sub.forEach(([[x, z, big], i], k) => { const s = big ? 1.9 : 1; m.compose(new THREE.Vector3(x, 0.08, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.9, s)); im.setMatrixAt(k, m); im.setColorAt(k, C.set(big ? 0xffd23f : (i % 2 ? 0xff4d4d : 0xffffff))); }); im.computeBoundingSphere(); im.userData.noCast = true; E.scene.add(im); return im; });
    S.bChunks.push({ z: z0 + 15, near: ims[0], far: ims[1] }); ims[1].visible = false; }
  S.buoys = { im: S.bChunks.length ? S.bChunks[0].near : null, list };
  // the start pontoon: a long wooden walkway across the lanes behind the boats, lane numbers on posts
  const wood = new THREE.MeshStandardMaterial({ color: 0xa8774a, roughness: 0.9, flatShading: true });
  const pont = new THREE.Mesh(new THREE.BoxGeometry(LANE * NB + 6, 0.35, 2.2), wood); pont.position.set(0, 0.18, -8.2); pont.receiveShadow = true; pont.castShadow = true; E.scene.add(pont); S.pont = [pont];
  for (let i = 0; i < NB; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), E.bannerMaterial(String(i + 1), '#16205a')); b.position.set(laneX(i), 1.2, -7.2); E.scene.add(b); const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood); p.position.set(laneX(i), 0.6, -7.25); E.scene.add(p); S.pont.push(b, p); }
  const arch = (z, text, color, h) => { const post = new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 }), hw = LANE * NB / 2 + 1.5, ag = new THREE.Group(); E.scene.add(ag); (S.archG || (S.archG = [])).push({ ag, z, text, color });
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, h + 2, 0.6), post); p.position.set(sd * hw, (h + 2) / 2 - 1, z); p.castShadow = true; ag.add(p); const fl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 })); fl.position.set(sd * hw, -0.4, z); ag.add(fl); }
    const mt = E.bannerMaterial(text, color), b = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 3.4), mt); b.position.set(0, h + 0.4, z); b.rotation.y = Math.PI; ag.add(b);
    const b2 = new THREE.Mesh(b.geometry, mt); b2.position.set(0, h + 0.4, z + 0.02); ag.add(b2); return b; };   // (readable from both sides: the finish camera looks back through it)
  arch(-14, 'DRAGON BOAT RACE', '#7b3fd1', 6.2); S.finArch = arch(L, 'FINISH', '#e8304a', 6.4);
  // the finish line itself: a row of red buoys across the lanes
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 5), new THREE.MeshStandardMaterial({ color: 0xff2d55, roughness: 0.35 }), 24); for (let i = 0; i < 24; i++) { m.compose(new THREE.Vector3(-LANE * NB / 2 + i * LANE * NB / 23, 0.08, L), new THREE.Quaternion(), new THREE.Vector3(1.3, 1.3, 1.3)); fl.setMatrixAt(i, m); } fl.userData.noCast = true; fl.castShadow = false; E.scene.add(fl);
}

export default {
  id: 'paddling', blurb: 'Paddle in time with the drum: the steadier your crew, the faster your dragon boat!',
  // (v96) Christmas on the lake: string lights over both race arches and between the tents, decorated trees and snowmen by the start and the finish
  xmas(E, X) {
    if (!X.ok) return; const { THREE } = E, V3 = (x, y, z) => new THREE.Vector3(x, y, z), hgt = (x, z) => (S.shoreH ? S.shoreH(x, z) : 0);
    for (const z of [-14, L]) { const posts = []; for (let x = -19; x <= 19.01; x += 4.75) posts.push(V3(x, 9.9, z - 1.3)); X.lights(posts, { sag: 0.35, per: 5, size: 0.16, glow: 1.2 }); }
    const T = (S.tents || []).map(([t, x, z]) => [x, z]); for (const sd of [-1, 1]) { const row = T.filter(([x]) => Math.sign(x) === sd).sort((a2, b2) => a2[1] - b2[1]);
      for (let i = 0; i < row.length - 1; i++) { const [x1, z1] = row[i], [x2, z2] = row[i + 1]; if (Math.abs(z2 - z1) > 20) continue; X.lights([V3(x1, hgt(x1, z1) + 3.1, z1), V3(x2, hgt(x2, z2) + 3.1, z2)], { sag: 0.5, per: 6, size: 0.15, glow: 1.1 }); } }
    [[-41, -20, 'XmasTree_Big', 1.4], [41, -18, 'XmasTree_Small', 1.8], [-40, L + 22, 'XmasTree_Big', 1.3], [40, L - 30, 'XmasTree_Small', 1.8], [-38.5, -8, 'Snowman', 1], [38.5, L + 6, 'Snowman', 1]].forEach(([x, z, n, sc], i) => X.put(n, V3(x, hgt(x, z), z), i, sc));
  },
  light: { sky: 'alpine-gold', skyYaw: 0.55, skyBase: 0.22, sunDir: [-0.55, 0.42, 0.5], sun: 0xfff0e0, sunI: 2.4, hemiSky: 0xdfe8ff, hemiGround: 0xb8b6dc, hemi: 0.95, rim: 0xffb27a, rimI: 0.9, exposure: 0.98, fog: [160, 620], fogColor: 0xeadcea, env: 0.5, flakes: 220, flakeA: 0.5 },   /* (v96: a snowy Christmas lake at golden dusk, light snowfall) */
  bestShown: (s) => `${s.toFixed(1)} s`,
  async build(E, prog) {
    const { THREE } = E; S.hulls = {}; S.crews = {}; THREE_V = THREE.Vector3;
    S.vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, flatShading: true });
    const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const w = wc.getContext('2d'), gr = w.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); w.fillStyle = gr; w.beginPath(); w.moveTo(26, 0); w.lineTo(38, 0); w.lineTo(64, 128); w.lineTo(0, 128); w.closePath(); w.fill();
    const wt = new THREE.CanvasTexture(wc); S.wakeMat = new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, opacity: 0.55 }); S.wakeGeo = new THREE.PlaneGeometry(1.8, 5); S.wakeGeo.translate(0, -2.5, 0);
    makeWater(E); prog(25, 'Filling the lake…'); makeShores(E); makeLanes(E); prog(45, 'Painting the dragons…');
    await E.addMountains(-240, 0x9db7d6);
    // the boats: Foxino's purple boat in the middle lane; in a party the friend's orange boat beside it; the rival crews in the other lanes
    const party = /[?&]party=1/.test(location.search), rivals = ['rob', 'bear', 'hare', 'owl'], order = party ? ['bear', 'friend', 'fox', 'rob', 'hare'] : ['bear', 'rob', 'fox', 'hare', 'owl'];
    S.boats = order.map((team, i) => makeBoat(E, team, i)); S.me = S.boats[2]; S.friendB = party ? S.boats[1] : null; void rivals;
    prog(60, 'Waxing the paddles…');
    // Foxino himself paddles at the front left of his boat (the code crew member there steps out); his paddle follows his hands
    S.a = await E.makeActor({ kit: { shirt: '#ff8a1a', trim: '#7b3fd1', shorts: '#4a2a8c', socks: '#4a2a8c', boots: '#ffc23a' }, gear: 'none' });
    S.a.g.traverse((o) => { if (o.isMesh && o.parent && o.parent.isBone) o.visible = false; });   // (no winter goggles or scarf on a summer lake)
    S.me.pad[0].g.visible = false; S.me.g.add(S.a.g); S.a.g.position.set(-0.3, 0.36, ROWS[0]);
    S.paddle = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshStandardMaterial({ color: 0xd8b47a, roughness: 0.7 })); sh.position.y = -0.5; const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.22), new THREE.MeshStandardMaterial({ color: 0xffc23a, roughness: 0.6 })); bl.position.y = -1.0; S.paddle.add(sh, bl); S.paddle.userData.sh = sh; S.paddle.userData.bl = bl; sh.castShadow = bl.castShadow = true; E.scene.add(S.paddle);
    E.groundAt = () => 0.6; E.drawDist = 400;
    this.reset(E);
    padKit(E).then((kit) => padDress(E, kit)).catch((e) => console.warn('paddling kit', e));   // (N19–N22: the lanes' boats, crews and lake kit replace the code ones)
  },
  reset(E) { S.pc = C0; S.streak = 0; S.inR = 0; S.rock = 0; S.time = 0; S.clock = 0; S.done = 0; S.place = 0; S.phase = 'menu'; S.shot = 'start'; S.shotT = 0; S.boats.forEach((B) => Object.assign(B, { z: 0, v: 0, c: 0.6, fin: false, finT: 0, place: 0 })); E.snapCam(); },
  menu() { S.phase = 'menu'; },
  // P1's placeholder rule: every crew keeps a steady consistency with a slow drift (P2 sets Foxino's from the answers, and the rival AI)
  consistency(B, E) { if (B === S.me) return S.pc; if (B === S.friendB) return E.friend && E.friend.c != null ? E.friend.c : C0; return (RIV[B.team] || (() => 0.6))(Math.min(1, B.z / L)); },
  async run(E) {
    this.reset(E); S.phase = 'start'; S.shot = 'start';
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', 'TAP THE RIGHT WORD WHEN THE BAR IS GREEN!', 1100); S.phase = 'race'; S.shot = 'chase'; S.shotT = 0; fxRoot();
    const seed = this.partySeed();
    for (let i = 0; i < QN; i++) {
      await E.until(() => S.me.z >= MARKS[i]);
      // (2-player: both phones get the same question: the question picker's dice are seeded by the party for this one call)
      const R = Math.random; if (seed != null) { let a = (seed + i * 7919) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
      S.asking = true; let pr; try { pr = askRhythm(E, { who: `STROKE ${i + 1} OF ${QN}`, num: '', size: 0.9, slow: 0.5, onQ: (q) => this.botAnswer(q, i), anchors: (out) => { for (let k = 0; k < 3; k++) out[k].set(S.me.x + (k - 1) * 2.2, 2.6, S.me.z + 9); } }, T_ANS); } finally { Math.random = R; }
      const r = await pr; S.asking = false; this.rhythm(E, r);
    }
    await E.until(() => S.me.fin); S.phase = 'done'; S.shot = 'finish'; S.shotT = 0; E.snapCam();
    const order = this.order(), pl = order.indexOf(S.me) + 1, sfx = ['ST', 'ND', 'RD', 'TH', 'TH'][pl - 1];
    E.banner(`${pl}${sfx}!`, `${E.fmtTime(S.me.finT)} s`, 2000); E.cine(true); if (pl === 1) { E.shake(0.3); try { E.sfx.cheer && E.sfx.cheer(); } catch (e) {} }
    await E.wait(2.6); E.cine(false);
    await this.results(E, order);
    const total = Math.round(S.me.finT * 10) / 10;
    E.finish({ score: total, shown: total.toFixed(1), unit: 'seconds', better: 'low', line: `${pl}${sfx.toLowerCase()} of ${NB} boats · ${S.inR} of ${QN} in rhythm` });
  },
  // an answer → the crew's consistency + the feedback: in the green = the crew locks into the drum; too fast / too late = no rhythm; wrong = out of time
  rhythm(E, r) {
    const z = r.ok ? r.zone : r.timeout ? 'timeout' : 'wrong', dc = GAIN[z]; S.pc = Math.max(0.1, Math.min(1, S.pc + dc)); const B = S.me, at = new E.THREE.Vector3(B.x, 1.2, B.z + 4);
    if (z === 'green') { S.streak++; S.inR++; trickCard('IN RHYTHM!', S.streak, 'good'); E.flash('rgba(120,255,170,.28)'); E.spray.emit(at, 18, 0, 2.6, 0, 1.6, 0.1); this.drum(1.3, 0); }
    else { S.streak = 0;
      if (z === 'early') trickCard('TOO FAST!', 0, 'meh', 'wait for the green');
      else if (z === 'late') trickCard('TOO LATE!', 0, 'meh', 'tap in the green');
      else { trickCard(z === 'timeout' ? 'TOO SLOW!' : 'OUT OF TIME!', 0, 'oops'); E.flash('rgba(255,80,100,.35)'); E.shake(0.3); S.rock = z === 'timeout' ? 0.6 : 1;
        for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) E.spray.emit(new E.THREE.Vector3(B.x + sd * 1.1, 0.3, B.z + 3 - k * 1.8), 24, sd * 2.2, 3.4, 0, 2.2, 0.17);   /* (a big messy splash: paddles hitting the water out of time) */ try { E.sfx.thud && E.sfx.thud(); } catch (e) {} } }
    E.send({ p: Math.min(1, B.z / L), v: E.fmtTime(S.time), c: S.pc });
  },
  // the finishing order: boats home by their time, the rest by when they will get there (so the board shows at once, the same on both phones)
  order() { const eta = (B) => (B.fin ? B.finT : S.clock + (L - B.z) / Math.max(1, B.v)); S.boats.forEach((B) => (B.eta = eta(B))); return S.boats.slice().sort((a, b) => a.eta - b.eta); },
  async results(E, order) {
    const stars = S.inR >= 8 ? 3 : S.inR >= 5 ? 2 : S.inR >= 2 ? 1 : 0, name = (B) => B === S.me ? 'TEAM FOXINO (you)' : B === S.friendB ? `${(E.friend && E.friend.name) || 'FRIEND'}'s team` : B.T.name;
    const el = document.createElement('div'); el.className = 'pdRes';
    el.innerHTML = `<div class="card"><h3>RACE RESULTS</h3><ol>${order.map((B, i) => `<li class="${B === S.me ? 'me' : ''}"><b>${i + 1}${['st', 'nd', 'rd', 'th', 'th'][i]}</b><i style="background:#${B.T.hull.toString(16).padStart(6, '0')}"></i><span>${name(B)}</span><em>${B.eta.toFixed(1)} s</em></li>`).join('')}</ol>
      <div class="st"><big>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</big>In rhythm: <b>${S.inR}</b> of ${QN} strokes</div></div>`;
    document.body.appendChild(el); await E.wait(4.2); el.remove();
  },
  partySeed() { const q = new URLSearchParams(location.search); if (!/^(host|join)$/.test(q.get('mp') || '')) return null; const k = `${q.get('mps') || ''}|${q.get('mpr') || 0}|${q.get('mpi') || 0}`; let h = 2166136261; for (const ch of k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; },
  // (tests) ?pbot=good|mixed|bad answers by itself at a chosen moment on the bar
  botAnswer(q, i) { const m = /[?&]pbot=(\w+)/.exec(location.search); if (!m || !window.MPBOT) return;
    const P = { good: 'GGGGGGGGGG', mixed: 'GEGWGLGGEW', bad: 'WTEWWLTWEW', fast: 'EEEEEEEEEE' }[m[1]] || 'GGGGGGGGGG', z = P[i % P.length];
    if (z === 'T') return; const ms = { G: 2800, E: 700, L: 5100, W: 2500 }[z] || 2800;
    setTimeout(() => { const cq = window.MPBOT.q(); if (cq) window.MPBOT.answer(z === 'W' ? (cq.correct + 1) % cq.n : cq.correct); }, ms); },
  // the drum: Foxino's drummer beats each stroke; tight and steady when the crew is in rhythm, late, uneven and softer when it is not
  drum(vol = 1, late = 0) {
    if (isMuted()) return; try { const A = S.ac || (S.ac = new (window.AudioContext || window.webkitAudioContext)()); if (A.state === 'suspended') { A.resume(); return; }
      const t = A.currentTime + late, o = A.createOscillator(), g = A.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g).connect(A.destination); o.start(t); o.stop(t + 0.3); } catch (e) {} },
  update(E, dt, rdt) {
    const t = E.T; S.uT.value = t; if (!S.boats.length) return; signPlace(E); S.rock = Math.max(0, S.rock - rdt * 0.8);
    if (!S.unlockA) { S.unlockA = true; addEventListener('pointerdown', () => { try { if (S.ac && S.ac.state === 'suspended') S.ac.resume(); } catch (e) {} }); }
    if (S.phase === 'race') S.time += dt; if (S.phase === 'race' || S.phase === 'done') S.clock += dt;   // (the race clock runs on until every boat is home)
    for (const B of S.boats) {
      const friendDriven = B === S.friendB && E.friend && E.friend.p != null;
      if (S.phase === 'race' || (S.phase === 'done' && !B.fin) || B.fin) {
        if (!B.fin && S.phase !== 'menu' && S.phase !== 'start') B.c = this.consistency(B, E);
        const tv = B.fin ? 1.2 : S.phase === 'race' || S.phase === 'done' ? 2.6 + 3.8 * B.c : 0;
        B.v = E.damp(B.v, tv, B.fin ? 0.6 : 1.1, dt);
        if (friendDriven) { const zf = E.friend.p * L; B.z = E.damp(B.z, zf, 4, dt); B.v = Math.max(0, (zf - B.z) * 0 + (E.friend.done ? 1.2 : 4.6)); }
        else B.z += B.v * (1 + 0.1 * Math.sin(B.ph * Math.PI * 2)) * dt;
        if (!B.fin && B.z >= L) { B.fin = true; B.finT = S.clock; B.place = ++S.done; }
      } else { B.v = 0; }
      // the strokes: the crew's rhythm comes from its consistency: faster strokes, and the lower it is the more out of time the paddlers are
      const rate = S.phase === 'menu' || S.phase === 'start' ? 0.18 : B.fin ? 0.25 : 0.55 + 0.9 * B.c, ph0 = B.ph; B.ph += rate * dt; if (window.__pdPh != null) B.ph = window.__pdPh;   /* (test hook: a fixed stroke phase, for frame-by-frame stroke sheets) */
      const sync = 1 - B.c, bob = 0.06 * Math.sin(t * 1.7 + B.lane), pitch = 0.02 * Math.sin(B.ph * Math.PI * 2) + 0.012 * Math.sin(t * 1.1 + B.lane);
      const rk = B === S.me ? S.rock : 0; B.g.position.set(B.x, bob, B.z); B.g.rotation.set(-pitch, 0, 0.018 * Math.sin(t * 1.3 + B.lane * 2) + 0.09 * rk * Math.sin(t * 11));
      if (B === S.me && S.phase === 'race' && Math.floor(B.ph * 2) !== Math.floor(ph0 * 2)) this.drum(Math.floor(B.ph * 2) % 2 ? 0.45 + 0.2 * B.c : 0.7 + 0.3 * B.c, (1 - B.c) * 0.14 * Math.random());   // (two beats a stroke)
      if (B.kit) padAnim(E, B, t, sync, (S.fr = (S.fr || 0) + 1) % 2 === 0); else for (const P of B.pad) { const a = (B.ph + P.j * sync * 0.42) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        P.body.rotation.x = 0.22 + 0.22 * c; P.arms.rotation.x = 0.75 * c - 0.1; P.arms.rotation.z = P.sd * -0.18 * Math.max(0, s); }
      B.sticks.rotation.x = -0.9 * Math.max(0, Math.sin(B.ph * Math.PI * 4));   // (the drummer: two beats a stroke)
      B.flag.rotation.z = 0.12 * Math.sin(t * 3 + B.lane); B.wake.scale.set(0.7 + B.v * 0.1, 0.3 + B.v * 0.16, 1);
      if (Math.floor(B.ph) !== Math.floor(ph0) && B.v > 1 && dt > 0.002 && (B === S.me || Math.abs(B.z - S.me.z) < 25)) for (const sd of [-1, 1]) E.spray.emit(new THREE_V(B.x + sd * 1.05, 0.15, B.z + 0.8), 3, sd * 0.6, 1.6, -0.6, 1.0, 0.09);
    }
    // places on the go (for the HUD); Foxino's own stroke + his paddle through his hands
    const ahead = S.phase === 'done' ? this.order().indexOf(S.me) + 1 : S.boats.filter((B) => B !== S.me && (B.fin ? !S.me.fin || B.finT < S.me.finT : B.z > S.me.z)).length + 1;
    const A = S.a, B = S.me, a = B.ph * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    A.pose(B.fin ? this.cheerPose(t) : this.paddlePose(t, c, s), B.fin ? 8 : 14, rdt); A.update(); this.placePaddle(E);
    if (S.crowd) { const m = S.cm || (S.cm = new E.THREE.Matrix4()), q = S.cq || (S.cq = new E.THREE.Quaternion().setFromEuler(new E.THREE.Euler(0, -Math.PI / 2, 0))), v3 = S.cv || (S.cv = new E.THREE.Vector3()), one = S.c1 || (S.c1 = new E.THREE.Vector3(1, 1, 1)), near = S.boats.some((b) => b.z > L - 60);
      if (near || (S.crowdT = (S.crowdT || 0) + rdt) > 0.2) { S.crowdT = 0; S.fans.forEach(([x, y, z], k) => { m.compose(v3.set(x, y + (near ? Math.max(0, Math.sin(t * 9 + k)) * 0.25 : 0), z), q, one); S.crowd.setMatrixAt(k, m); }); S.crowd.instanceMatrix.needsUpdate = true; } }
    E.hud(E.fmtTime(S.phase === 'done' ? S.me.finT : S.time), S.phase === 'menu' || S.phase === 'start' ? 'PADDLING' : `PADDLING · ${ahead}${['ST', 'ND', 'RD', 'TH', 'TH'][ahead - 1]} PLACE`);
    buoyLod(E); E.progress(Math.min(1, S.me.z / L)); if (S.phase === 'race') E.send({ p: Math.min(1, S.me.z / L), v: E.fmtTime(S.time), c: S.pc });
    this.camera(E, rdt);
  },
  // Foxino sitting, paddling on the boat's left: he leans forward to reach (the catch), pulls back, lifts the paddle out and swings it forward
  paddlePose(t, c, s) {
    const p = { y: -0.37, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    p.legL = [-1.45, 0, 0.12]; p.legR = [-1.45, 0, -0.12]; p.kneeL = [0.5, 0, 0]; p.kneeR = [0.5, 0, 0];
    p.spine = [0.18 + 0.2 * c, 0.25, 0.08]; p.neck = [-0.1 - 0.1 * c, -0.15, 0]; p.head = [-0.05, -0.1, 0];
    p.armR = [-1.25 - 0.35 * c, 0, -0.55 - 0.2 * Math.max(0, s)]; p.elbowR = [-0.6, 0, 0];   // (the top hand, high on the grip)
    p.armL = [-0.75 - 0.45 * c, 0, 0.35 + 0.25 * Math.max(0, s)]; p.elbowL = [-0.35, 0, 0];   // (the lower hand, down the shaft, outboard)
    return p;
  },
  cheerPose(t) { const p = this.paddlePose(t, 1, 0), w = Math.sin(t * 7); p.spine = [-0.1, 0, 0]; p.armR = [-2.7 + 0.15 * w, 0, -0.35]; p.armL = [-2.7 - 0.15 * w, 0, 0.35]; p.elbowR = [-0.2, 0, 0]; p.elbowL = [-0.2, 0, 0]; p.head = [-0.15, 0, 0]; return p; },   // (both arms up: he won it / he made it)
  placePaddle(E) {
    const A = S.a, bones = A.fox.bones, v1 = S.pv1 || (S.pv1 = new E.THREE.Vector3()), v2 = S.pv2 || (S.pv2 = new E.THREE.Vector3()), up = S.pup || (S.pup = new E.THREE.Vector3(0, 1, 0));
    S.paddle.visible = !S.me.fin; if (!bones.RightHand || !bones.LeftHand || S.me.fin) return; A.g.updateMatrixWorld(true);   /* (he lets go of it to cheer) */ bones.RightHand.getWorldPosition(v1); bones.LeftHand.getWorldPosition(v2);
    const dir = v2.clone().sub(v1); if (dir.lengthSq() < 1e-4) dir.set(-0.5, -1, 0.2); dir.normalize(); if (dir.y > -0.35) { dir.y = -0.35; dir.normalize(); }   // (always down to the water)
    S.paddle.position.copy(v1).addScaledVector(dir, -0.12); S.paddle.quaternion.setFromUnitVectors(up, dir.clone().negate()); S.paddle.userData.sh.scale.y = 1.6; S.paddle.userData.sh.position.y = -0.8; S.paddle.userData.bl.position.y = -1.55;
  },
  camera(E, rdt) {
    const { THREE } = E, B = S.me, P = new THREE.Vector3(B.x, 0.8, B.z); S.shotT += rdt;
    let pos, look, k = 4, fov = 58;
    if (S.phase === 'menu' || S.phase === 'start') {   // the start line: all five boats, from the front and a little to the side, drifting
      const pr = innerWidth < innerHeight, d = pr ? 1.45 : 1; pos = new THREE.Vector3(7 * d - S.shotT * 0.2, 5.2 * d, 22 * d - S.shotT * 0.3); look = new THREE.Vector3(0, 0.2, -1); k = 2; fov = 58;   /* (from the front: all five boats on the line; further back on a portrait phone) */
    } else if (S.phase === 'done') {   // the finish: from the side of the line, the boats coming through
      pos = P.clone().add(new THREE.Vector3(-4.5, 2.2, 16)); look = P.clone().add(new THREE.Vector3(0, 1.4, -3)); k = 6; fov = 50;   /* (in front of his boat, looking back at him and the crew, the FINISH arch behind them) */
    } else {
      if (S.asking) { S.shot = 'chase'; S.shotT = 0; }   // (a question = the steady chase camera)
      if (S.shotT > 9) { S.shot = { chase: 'side', side: 'front', front: 'chase' }[S.shot] || 'chase'; S.shotT = 0; }
      if (S.shot === 'side') { pos = P.clone().add(new THREE.Vector3(-4.6, 3.3, 5.0));   /* (over the buoy line, never in the next lane; ahead and to the side: the crew in profile) */ look = P.clone().add(new THREE.Vector3(0, 0.4, 0.5)); k = 5; fov = 54; }
      else if (S.shot === 'front') { pos = P.clone().add(new THREE.Vector3(3.5, 3.2, 15)); look = P.clone().add(new THREE.Vector3(0, 0.5, 0)); k = 5; fov = 56; }
      else { const pr = innerWidth < innerHeight; pos = P.clone().add(pr ? new THREE.Vector3(1.1, 4.0, -9.5) : new THREE.Vector3(3.2, 4.4, -11.5)); look = P.clone().add(pr ? new THREE.Vector3(0, 0.6, 7) : new THREE.Vector3(0, 0.6, 9)); k = 5; fov = pr ? 64 : 56; }   /* (a portrait phone: closer and centred on his boat) */
    }
    if (/[?&]pdcam=side/.test(location.search) && S.me) { const B = S.me; pos = new E.THREE.Vector3(B.x + 4.2, 1.3, B.z + 0.6); look = new E.THREE.Vector3(B.x, 0.45, B.z + 0.6); k = 30; fov = 48; }   /* (test hook: a close side view of his boat's crew, for checking the strokes) */
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
let THREE_V = null;   // (set in build: the Vector3 class for the splashes)
