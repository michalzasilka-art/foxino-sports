// PADDLING (2026-11-27, P1 of 5, Michal: "Paddling → You are answering questions, and based on whether you're right or wrong and on your
// timing, you build your consistency. So even when you guess right as fast as 1 second, there is still no consistency, which would be the green
// part covering 50%, centered in the middle. Around 10 questions, and 4 teams you're competing against.")
// A DRAGON-BOAT sprint on a sunny alpine lake: five long boats with dragon heads, each a crew of animal paddlers and a drummer who beats the
// rhythm; Foxino paddles at the front of the purple boat. A dragon boat is all about paddling together to the drum, so "consistency" is the
// crew's rhythm: every boat's speed AND how in time its paddlers are come from ONE number, its consistency (0..1).
// P1 (this file now): the boats, the crews, the course and the race with a placeholder rule (steady consistency). P2: the questions, the timing
// bar (green = the middle 50 % of the answer time) and the rival AI. P3+: polish.
import { askRhythm, trickCardAfter as trickCard, signPlace, fxRoot } from './askfx.js?v=3';
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
  const { THREE } = E, mat = new THREE.MeshStandardMaterial({ color: 0x2389c6, roughness: 0.22, metalness: 0.08, flatShading: true, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uT = S.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 wq = modelMatrix * vec4(position, 1.0);
    transformed.y += 0.10 * sin(wq.x * 0.55 + uT * 1.5) + 0.08 * sin(wq.z * 0.38 - uT * 1.15) + 0.05 * sin((wq.x + wq.z) * 1.05 + uT * 2.2);`); };
  const g = new THREE.PlaneGeometry(130, 520, 34, 130); g.rotateX(-Math.PI / 2); g.translate(0, 0, L / 2 + 20);
  const w = new THREE.Mesh(g, mat); w.receiveShadow = true; E.scene.add(w);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x2f8fc6, roughness: 0.3 })); far.rotation.x = -Math.PI / 2; far.position.set(0, -0.25, L / 2); E.scene.add(far);
}

// the shores: green hills either side with a sandy edge, trees (round leafy ones and pines), a grandstand of fans by the finish, tents, flags
function makeShores(E) {
  const { THREE } = E, xs = [36, 39, 43, 50, 60, 74, 92, 120, 160], pos = [], col = [], cSand = new THREE.Color(0xe8d6a0), cGrass = new THREE.Color(0x6cbf5a), cGrass2 = new THREE.Color(0x4e9e48), cRock = new THREE.Color(0x8f97a8);
  const h = (x, z) => { const a = Math.abs(x), k = Math.max(0, Math.min(1, (a - 37) / 60)); return -0.5 + k * k * (3 - 2 * k) * (14 + 8 * Math.sin(z * 0.017 + x * 0.03)) + (a > 40 ? 0.6 * Math.sin(x * 0.3 + z * 0.2) : 0); };
  for (const sd of [-1, 1]) for (let z = -120; z < L + 160; z += 10) for (let i = 0; i < xs.length - 1; i++) {
    const q = (xi, zz) => [sd * xs[xi], h(sd * xs[xi], zz), zz], a = q(i, z), b = q(i + 1, z), c = q(i + 1, z + 10), d = q(i, z + 10);
    const C = i === 0 ? cSand : i > 5 && hsh(i, z) > 0.6 ? cRock : hsh(i + 3, z) > 0.5 ? cGrass : cGrass2;
    const tri = (p, q2, r) => { if (sd < 0) pos.push(...p, ...r, ...q2); else pos.push(...p, ...q2, ...r); for (let k = 0; k < 3; k++) col.push(C.r, C.g, C.b); };
    tri(a, b, c); tri(a, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); ground.receiveShadow = true; E.scene.add(ground);
  // trees: leafy (an icosahedron crown on a trunk) and pines (two cones), instanced, coloured per tree
  const leafy = new THREE.IcosahedronGeometry(2.2, 0), pine = new THREE.ConeGeometry(1.7, 4.6, 6), trunk = new THREE.CylinderGeometry(0.22, 0.3, 2.4, 5);
  const trees = []; for (let i = 0; i < 300; i++) { const sd = i % 2 ? 1 : -1, z = -90 + hsh(i, 1) * (L + 220), x = sd * (44 + hsh(i, 2) * 90); if (sd > 0 && z > L - 70 && z < L + 40 && x < 70) continue; trees.push([x, h(x, z), z, 0.8 + hsh(i, 3) * 0.7, hsh(i, 4) > 0.45]); }
  const mk = (geo2, list, colr, dy, sy) => { const im = new THREE.InstancedMesh(geo2, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), list.length), m = new THREE.Matrix4(), C = new THREE.Color();
    list.forEach(([x, y, z, s], k) => { m.compose(new THREE.Vector3(x, y + dy * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k, 0)), new THREE.Vector3(s, s * sy, s)); im.setMatrixAt(k, m); im.setColorAt(k, C.set(colr).multiplyScalar(0.85 + hsh(k, 9) * 0.3)); });
    im.castShadow = false; im.receiveShadow = false; im.userData.noCast = true; E.scene.add(im); return im; };
  const L1 = trees.filter((t) => t[4]), L2 = trees.filter((t) => !t[4]);
  mk(leafy, L1, 0x5cae4a, 3.6, 0.9); mk(trunk, trees, 0x7a5232, 1.1, 1); mk(pine, L2, 0x2f7a4a, 3.3, 1);
  // the grandstand by the finish (right shore): three steps and a crowd of little fans in the teams' colours, cheering
  const gz0 = L - 60, steps = new THREE.Mesh(merge(THREE, [0, 1, 2, 3].map((k) => [new THREE.BoxGeometry(5, 1 + k * 1.1, 80), k % 2 ? 0xdfe6f2 : 0xc9d2e3, M4(THREE, 41 + k * 4, (1 + k * 1.1) / 2 - 0.3, gz0 + 30)])), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
  steps.receiveShadow = true; E.scene.add(steps);
  const fan = merge(THREE, [[new THREE.BoxGeometry(0.5, 0.7, 0.35), 0xffffff, M4(THREE, 0, 0.35, 0)], [new THREE.IcosahedronGeometry(0.24, 0), 0xffffff, M4(THREE, 0, 0.92, 0)]]);
  const fans = []; for (let k = 0; k < 4; k++) for (let z = gz0 - 8; z < gz0 + 68; z += 1.05) if (hsh(k, z) > 0.25) fans.push([41 + k * 4 - 0.6, 0.8 + k * 1.1 - 0.3, z]);
  const cols = [0x7b3fd1, 0xffc23a, 0x2fb7c8, 0xe8304a, 0x2fbf6a, 0xffa21f, 0xff5fa2, 0xffffff];
  const im = new THREE.InstancedMesh(fan, new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), fans.length), m = new THREE.Matrix4(), C = new THREE.Color();
  fans.forEach(([x, y, z], k) => { m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k, m); im.setColorAt(k, C.set(cols[k % cols.length])); });
  im.userData.noCast = true; E.scene.add(im); S.crowd = im; S.fans = fans;
  // tents and flags along the shores at the start and the finish
  const tent = merge(THREE, [[new THREE.ConeGeometry(2.4, 2.2, 4), 0xffffff, M4(THREE, 0, 2.9, 0, 0, Math.PI / 4)], [new THREE.BoxGeometry(3.3, 1.8, 3.3), 0xffffff, M4(THREE, 0, 0.9, 0)]]);
  const tents = [[-42, -14, 0xff5fa2], [-42, -4, 0xffc23a], [42, -10, 0x36b5e0], [-42, L - 10, 0x7b3fd1], [-42, L + 2, 0x2fbf6a], [-42, L + 14, 0xff8a1a]];
  for (const [x, z, c] of tents) { const t = new THREE.Mesh(tent, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })); t.position.set(x, h(x, z), z); t.castShadow = true; E.scene.add(t); }
  S.shoreH = h;
}

// the lanes: lines of floating buoys between the lanes (a bigger yellow one every 50 m), the start pontoon, the start and finish arches
function makeLanes(E) {
  const { THREE } = E, list = [];
  for (let k = 0; k <= NB; k++) { const x = laneX(k) - LANE / 2; for (let z = 0; z <= L + 4; z += 6) list.push([x, z, z % 50 === 0 ? 1 : 0, k]); }
  const geo = new THREE.IcosahedronGeometry(0.28, 0), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4, flatShading: true }), list.length), C = new THREE.Color(), m = new THREE.Matrix4();
  list.forEach(([x, z, big, k], i) => { const s = big ? 1.9 : 1; m.compose(new THREE.Vector3(x, 0.05, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m); im.setColorAt(i, C.set(big ? 0xffd23f : (i % 2 ? 0xff4d4d : 0xffffff))); });
  im.userData.noCast = true; E.scene.add(im); S.buoys = { im, list };
  // the start pontoon: a long wooden walkway across the lanes behind the boats, lane numbers on posts
  const wood = new THREE.MeshStandardMaterial({ color: 0xa8774a, roughness: 0.9, flatShading: true });
  const pont = new THREE.Mesh(new THREE.BoxGeometry(LANE * NB + 6, 0.35, 2.2), wood); pont.position.set(0, 0.18, -8.2); pont.receiveShadow = true; pont.castShadow = true; E.scene.add(pont);
  for (let i = 0; i < NB; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), E.bannerMaterial(String(i + 1), '#16205a')); b.position.set(laneX(i), 1.2, -7.2); E.scene.add(b); const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood); p.position.set(laneX(i), 0.6, -7.25); E.scene.add(p); }
  const arch = (z, text, color, h) => { const post = new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 }), hw = LANE * NB / 2 + 1.5;
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, h + 2, 0.6), post); p.position.set(sd * hw, (h + 2) / 2 - 1, z); p.castShadow = true; E.scene.add(p); const fl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 })); fl.position.set(sd * hw, -0.4, z); E.scene.add(fl); }
    const mt = E.bannerMaterial(text, color), b = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 3.4), mt); b.position.set(0, h + 0.4, z); b.rotation.y = Math.PI; E.scene.add(b);
    const b2 = new THREE.Mesh(b.geometry, mt); b2.position.set(0, h + 0.4, z + 0.02); E.scene.add(b2); return b; };   // (readable from both sides: the finish camera looks back through it)
  arch(-14, 'DRAGON BOAT RACE', '#7b3fd1', 6.2); S.finArch = arch(L, 'FINISH', '#e8304a', 6.4);
  // the finish line itself: a row of red buoys across the lanes
  const fl = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xff2d55, roughness: 0.4, flatShading: true }), 24); for (let i = 0; i < 24; i++) { m.compose(new THREE.Vector3(-LANE * NB / 2 + i * LANE * NB / 23, 0.08, L), new THREE.Quaternion(), new THREE.Vector3(1.3, 1.3, 1.3)); fl.setMatrixAt(i, m); } E.scene.add(fl);
}

export default {
  id: 'paddling', blurb: 'Paddle in time with the drum: the steadier your crew, the faster your dragon boat!',
  light: { sky: 'sunny', skyYaw: 0.55, sunDir: [-0.45, 0.72, 0.5], sun: 0xfff1d6, sunI: 2.6, hemiSky: 0xcfe6ff, hemiGround: 0x6f9a5a, hemi: 0.95, rim: 0xfff4e0, rimI: 0.7, exposure: 1.0, fog: [160, 560], fogColor: 0xcfe2f2, env: 0.6, flakes: 0, flakeA: 0 },
  bestShown: (s) => `${s.toFixed(1)} s`,
  async build(E, prog) {
    const { THREE } = E; S.hulls = {}; S.crews = {}; THREE_V = THREE.Vector3;
    S.vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, flatShading: true });
    const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const w = wc.getContext('2d'), gr = w.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); w.fillStyle = gr; w.beginPath(); w.moveTo(26, 0); w.lineTo(38, 0); w.lineTo(64, 128); w.lineTo(0, 128); w.closePath(); w.fill();
    const wt = new THREE.CanvasTexture(wc); S.wakeMat = new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, opacity: 0.35 }); S.wakeGeo = new THREE.PlaneGeometry(1.8, 5); S.wakeGeo.translate(0, -2.5, 0);
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
      const rate = S.phase === 'menu' || S.phase === 'start' ? 0.18 : B.fin ? 0.25 : 0.55 + 0.9 * B.c, ph0 = B.ph; B.ph += rate * dt;
      const sync = 1 - B.c, bob = 0.06 * Math.sin(t * 1.7 + B.lane), pitch = 0.02 * Math.sin(B.ph * Math.PI * 2) + 0.012 * Math.sin(t * 1.1 + B.lane);
      const rk = B === S.me ? S.rock : 0; B.g.position.set(B.x, bob, B.z); B.g.rotation.set(-pitch, 0, 0.018 * Math.sin(t * 1.3 + B.lane * 2) + 0.09 * rk * Math.sin(t * 11));
      if (B === S.me && S.phase === 'race' && Math.floor(B.ph * 2) !== Math.floor(ph0 * 2)) this.drum(Math.floor(B.ph * 2) % 2 ? 0.45 + 0.2 * B.c : 0.7 + 0.3 * B.c, (1 - B.c) * 0.14 * Math.random());   // (two beats a stroke)
      for (const P of B.pad) { const a = (B.ph + P.j * sync * 0.42) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
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
    E.progress(Math.min(1, S.me.z / L)); if (S.phase === 'race') E.send({ p: Math.min(1, S.me.z / L), v: E.fmtTime(S.time), c: S.pc });
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
    S.paddle.visible = !S.me.fin; if (!bones.RightHand || !bones.LeftHand || S.me.fin) return; A.g.updateMatrixWorld(true);   // (he lets go of it to cheer) bones.RightHand.getWorldPosition(v1); bones.LeftHand.getWorldPosition(v2);
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
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
let THREE_V = null;   // (set in build: the Vector3 class for the splashes)
