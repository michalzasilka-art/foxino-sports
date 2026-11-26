// HALFPIPE (the snowboard run): a night course under the floodlights, top to bottom. (2026-11-25, the user: "make there more
// jumps starting with classic jump going on to sliding bar going on to 3 question U ramp and finishing of with 2 question big jump")
//   (2026-11-25, then: "you need to answer a question on the first jump and on the bar. Dont make it all in u ramp make the first and last
//   section outside and the last jump should appear a lot bigger")
//   1. a classic kicker (a question in the air)   2. a candy-cane rail (a question on it): both on the open slope   3. the U-ramp: 3 airs,
//   a question at the top of each   4. out on the open slope again: the BIG AIR, a huge kicker, one long jump, 2 questions in the air. Right words = big tricks (bigger with every right answer in a row); highest score wins.
// With a friend: each phone shows the friend one kicker-length behind (when you land the first jump, they are just leaving its lip).
// (2026-11-25, the user: "longer map surrounded by deep forest, with more unique jumps, so one run equals 12 questions") the course, top to
// bottom: kicker · candy-cane rail · box · table-top · the halfpipe (3 airs) · rainbow rail · gap jump · step-up · the BIG AIR (2 questions)
const HITS = 3, QN = 12;   // (the pipe airs; all the questions)
const FEAT = [   // the open-slope features in order (s/a: metres down the hill). kick = a kicker (a question in the air), rail = a rail or box (a question on it)
  { k: 'kick', id: 'k1', name: 'KICKER', s: 16, len: 4, lip: 1.0, w: 3.6, back: 1.4, T: 1.05, H: 1.4, lipC: 0x36b5e0 },
  { k: 'rail', id: 'r1', name: 'RAIL', a: 44, b: 57, h: 0.5, look: 'cane' },
  { k: 'rail', id: 'r2', name: 'BOX', a: 72, b: 85, h: 0.42, look: 'box' },
  { k: 'kick', id: 'k2', name: 'TABLE TOP', s: 100, len: 4.5, lip: 1.3, w: 5, table: 6, back: 1.8, T: 1.45, H: 1.9, lipC: 0xffb020, spon: 'face' },
  { k: 'pipe', id: 'p', name: 'HALFPIPE' },
  { k: 'rail', id: 'r3', name: 'RAINBOW RAIL', a: 236, b: 250, h: 0.45, arch: 1.0, look: 'rainbow' },
  { k: 'kick', id: 'k3', name: 'GAP JUMP', s: 268, len: 5, lip: 1.5, w: 4.4, back: 1.6, T: 1.35, H: 1.9, lipC: 0x9a5cf0, spon: 'red', gap: true },
  { k: 'kick', id: 'k4', name: 'STEP-UP', s: 298, len: 4, lip: 1.15, w: 4, back: 1.4, T: 1.15, H: 1.6, lipC: 0x2fbf6a, spon: 'face' },
  { k: 'big', id: 'big', name: 'BIG AIR' }];
const BIG = { k: 'big', id: 'big', s: 344, len: 12, lip: 4.6, w: 9, back: 5, T: 3.6, H: 8.5, spon: 'red' };    // the BIG air kicker (out on the open slope below the pipe)
const RAIL = FEAT[1], KICKS = FEAT.filter((f) => f.k === 'kick'), RAILS = FEAT.filter((f) => f.k === 'rail');
let PIPE_A = 136, PIPE_B = 216, STOP_Z = 446, COURSE_END = 458; const DECK = 4.5, GAP = 9.6;   // (the halfpipe from / to; its decks; where the run stops; the friend's distance behind: the kicker's air, so they take off as you land)
// (2026-11-25, the user: "time pressure: when the time runs out or you answer wrong, you fall, then get up, and you lose the streak · better streak =
// more points and a bit faster · faster answering = more points") every question has a clock; a miss = a wipeout; the streak multiplies the points
// and the speed; the quicker the answer, the bigger the speed bonus
const LIMIT = 4.7, FALL = 1.7;   /* (2026-11-26 night, the user: "decrease the time to answer in every discipline": 7 → 4.7 s, a third shorter) */
const railH = (R, z) => R.h + (R.arch ? R.arch * Math.sin(Math.PI * Math.max(0, Math.min(1, (z - R.a) / (R.b - R.a)))) : 0);
// the rail: a right word = a slide (bigger with the streak), a wrong one = a wobble
const RAIL_TRICKS = [['50-50', 0, 100], ['BOARDSLIDE', 1, 150], ['LIPSLIDE', 1, 200], ['NOSE PRESS', 0, 260], ['TAIL PRESS', 0, 320], ['270 BOARDSLIDE', 1, 400], ['BACK LIPSLIDE 270', 1, 480]];
// (2026-11-24, the user: "Add more tricks each one getting more insane based on your streak … show count up points for each trick going to total
// score") 12 tricks, one step up the ladder for every right answer in a row (a perfect, quick answer jumps one more). [name, spins, flips, cork tilt, grab, points]
const TRICKS = [
  ['180 INDY', 0.5, 0, 0, 'indy', 100], ['360 MELON', 1, 0, 0, 'melon', 150], ['BACKFLIP', 0, 1, 0, 'indy', 200], ['540 TAIL GRAB', 1.5, 0, 0, 'tail', 250],
  ['FRONTFLIP 360', 1, -1, 0, 'melon', 320], ['720 METHOD', 2, 0, 0, 'method', 380], ['CORK 540', 1.5, 0, 1, 'indy', 450], ['900 STALEFISH', 2.5, 0, 0, 'stale', 520],
  ['DOUBLE BACKFLIP', 0, 2, 0, 'tail', 620], ['CORK 1080', 3, 0, 1, 'method', 750], ['DOUBLE CORK 1260', 3.5, 0, 2, 'stale', 900], ['TRIPLE CORK 1440!!', 4, 0, 3, 'method', 1200]];
const OOPS = ['OOPS', 0, 0, 0, '', 20];
const S = { a: null, ghost: null, L: 190, SL: Math.tan(17 * Math.PI / 180), R: 5.6, FLAT: 4.6, WALLV: 0.4, s: 0, d: 0, side: 1, phase: 'menu', u: 0, air: 0, airT: 1.15, airH: 3.2, trick: null, spin: 0, flip: 0, pts: 0, hit: 0, v: 8, wob: 0, landT: 0, shotT: 0, asking: false, airTr: [], fbuf: [] };
const W = () => S.FLAT + S.R;
// (2026-11-25, the user: "make the snowboard on the same angle as the hill itself because rn its 0' and it looks like hes slowing down") the
// rider, his board and the friend are tilted with the run's slope (nose down the hill), then rolled on the walls, turned, and tipped up on a kicker
const SLA = () => Math.atan(S.SL), LEAN = 0.09, FRONT = /[?&]front=-1/.test(location.search) ? -1 : 1;   // (FRONT: which way his nose (and so his front hand and his look) points)   // (the slope; Foxino leans a little forward over the board, down the hill)
function pipeY(ad) { if (ad <= S.FLAT) return 0; if (ad <= W()) { const x = ad - S.FLAT; return S.R - Math.sqrt(Math.max(0, S.R * S.R - x * x)); } return S.R + S.WALLV; }
function wallAng(ad) { if (ad <= S.FLAT) return 0; return Math.asin(Math.min(1, (ad - S.FLAT) / S.R)); }
// (2026-11-26, S1, Michal: "Make the turn to jump on the U-ramp more natural") the ride across the U-ramp is physical: along the pipe's curve
// (the flat, the round transition, the short vertical at the top), with the speed of a body under gravity, so he carves fast across the bottom,
// slows as he climbs and still goes UP at the lip; the air is the matching parabola (its height and time give the gravity and the lip speed).
// His heading follows where he is really going (across + down the pipe), so at the top of each air it turns smoothly through "down the pipe"
// and he lands already facing down the same wall: no snap. The lean eases from the wall's angle to upright at the air's top and back.
const PIPE = { a: (lat) => 0 };
function pipeArc() { const F = S.FLAT, R = S.R, La = F + R * Math.PI / 2 + S.WALLV; return { La, at: (a) => { const s = Math.sign(a) || 1, x = Math.abs(a); if (x <= F) return [a, 0, 0];
  if (x <= F + R * Math.PI / 2) { const ph = (x - F) / R; return [s * (F + R * Math.sin(ph)), R * (1 - Math.cos(ph)), s * ph]; } return [s * (F + R), R + (x - F - R * Math.PI / 2), s * Math.PI / 2]; } }; }
function pipeRun(H, T) {   // one crossing for an air of height H and time T: the time table u -> arc position, its duration, the lip speed
  const g = 8 * H / (T * T), vL = g * T / 2, A = pipeArc(), hLip = A.at(A.La)[1], N = 160, ts = [0];
  for (let i = 1; i <= N; i++) { const a0 = -A.La + 2 * A.La * (i - 1) / N, a1 = -A.La + 2 * A.La * i / N, am = (a0 + a1) / 2, v = Math.sqrt(vL * vL + 2 * g * (hLip - A.at(am)[1])); ts.push(ts[i - 1] + (a1 - a0) / v); }
  const Tc = ts[N]; return { A, g, vL, Tc, hLip, aAt: (u) => { const t = Math.max(0, Math.min(1, u)) * Tc; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; } const k = (t - ts[lo]) / Math.max(1e-6, ts[hi] - ts[lo]); return -A.La + 2 * A.La * (lo + k) / N; },
    vAt: (a) => Math.sqrt(vL * vL + 2 * g * (hLip - A.at(a)[1])) }; }
// (2026-11-26, R2, Michal: "make the map randomly generated every time that one time you can have uramp first and one time the big jump
// first and really random") every run lays the 9 sections out in a new order: the 4 kickers, the rail, the box, the rainbow rail, the
// halfpipe (3 airs) and the BIG AIR (2 questions) = always 12 questions. Never 3 kickers or 3 rails in a row; never the same order twice
// in a row (solo: remembered on this phone; a party: both phones build the SAME course from the party code + round; ?seed=123 repeats one).
// Each section gets the room its airs need (the run-in for the question, the air in slow motion, the landing), so the joins are always rideable.
const SECT = FEAT.slice(), RLEN = Object.fromEntries(RAILS.map((r) => [r.id, r.b - r.a]));
const rng32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hashStr = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const okOrder = (o) => { for (let i = 2; i < o.length; i++) if (o[i].k === o[i - 1].k && o[i].k === o[i - 2].k) return false; return true; };
const orderKey = (o) => o.map((f) => f.id).join(',');
function shuffleOrder(seed) { const r = rng32(seed); for (let n = 0; n < 400; n++) { const o = SECT.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } if (okOrder(o)) return o; } return SECT.slice(); }
// the seed for one run: ?seed= (a test), a party (the same on both phones: party code + round + list index), or random (solo)
function runSeeds(runN) {
  const q = new URLSearchParams(location.search), fixed = q.get('seed');
  if (fixed != null) return { fixed: true, cur: hashStr('seed:' + fixed), prev: null };
  if (/^(host|join)$/.test(q.get('mp') || '')) { const party = q.get('mps') || [q.get('name') || '', q.get('fname') || ''].map((x) => x.slice(0, 12)).sort().join('|'), sd = (r, i) => hashStr(`${party}|${r}|${i}|${runN}`), r0 = +(q.get('mpr') || 0), i0 = +(q.get('mpi') || 0); return { party: true, cur: sd(r0, i0), prev: i0 > 0 ? sd(r0, i0 - 1) : sd(r0 - 1, i0) }; }   // (prev = the game before: the one before in this list, else the last round's)
  return { cur: (Math.random() * 4294967296) >>> 0, prev: null };
}
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, lsSet = (k, v) => { try { if (!new URLSearchParams(location.search).has('seed')) localStorage.setItem(k, v); } catch (e) {} };
function pickOrder(sd) {
  if (sd.fixed) return shuffleOrder(sd.cur);
  if (sd.party) { const prev = orderKey(shuffleOrder(sd.prev)); let o = shuffleOrder(sd.cur); for (let k = 1; orderKey(o) === prev && k < 9; k++) o = shuffleOrder(sd.cur + k); return o; }   // (the round before is worked out the same way, so it never repeats)
  const last = lsGet('hp-order'); let o; for (let k = 0; k < 12; k++) { o = shuffleOrder(k ? (Math.random() * 4294967296) >>> 0 : sd.cur); if (orderKey(o) !== last) break; } return o;
}
// (2026-11-26, R3, Michal: "also do generation on different map like one time it can be straight down one time it can be to the right through some rock
// gap one time ti can go to left through some snowtunel ... Or one time to the right and right to deive through igluu") every run also picks a ROUTE:
// the shape of the path down the mountain. Straight down, or a detour: the path bends out (right or left), runs through the route's zone (which
// can hold some of the shuffled sections: their questions and tricks work there as anywhere), and bends back onto the main slope.
// Only the READY routes are picked; ?route=<id> forces one (tests; 'right' / 'left' = a detour with an empty zone). The zones plug in here:
// R4 the rock gap (right), R5 the snow tunnel with rails (left), R6–R8 the igloo (right): set ready, host (which sections can be inside), dress().
// ("right" = to the right on the screen, behind him looking down the hill = -x)
// (2026-11-26, R4, Michal: "one time it can be to the right through some rock gap") THE ROCK GAP: on the right detour the path runs into a narrow
// passage between two low-poly rock walls with snowy tops (made in code, flat-shaded, vertex colours: the course's look); they close in to ~8 m
// either side of the line in the middle and open again; boulders at their feet (the snow-props rocks, instanced), icicles under the overhangs,
// warm lanterns on the walls and two of the floodlights' glows moved into the gap so it reads at night; snow puffs drift off the tops as he passes.
// The ride line stays clear (nothing to dodge): any kicker or rail inside works as everywhere (questions, slow motion, tricks).
const inGap = (z) => !!S.gap && z > S.gap.zA - 4 && z < S.gap.zB + 4;
const gapClose = (z) => { const G = S.gap; if (!G) return 0; const u = (z - G.zA) / (G.zB - G.zA); return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 0.55); };
const gapHW = (z) => 14 - 8 * gapClose(z);   // (the half-width between the walls: 14 at the mouths, ~6 in the middle: a narrow passage, the ride line clear)
const hsh = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
function makeRockGap(E, g, Z) {
  const { THREE } = E, G = S.gap, pos = [], col = [], rows = [], C = new THREE.Color(), snow = new THREE.Color(0xeef3ff), rockA = new THREE.Color(0x7a77a6), rockB = new THREE.Color(0x5b587f);
  for (let z = G.zA; z <= G.zB + 0.01; z += 3) { const k = gapClose(z), hw = gapHW(z), H = 1.2 + 11 * k * (0.85 + 0.3 * hsh(z, 1)), cx = X(z);
    rows.push([-1, 1].map((sd) => { const gy = (lx) => gY(cx + sd * lx, z), n = (i) => (hsh(z, i + (sd > 0 ? 7 : 0)) - 0.5);
      return [[hw - 0.3, gy(hw) - 0.6], [hw + 0.5 + n(1) * 0.8, gy(hw) + H * 0.45], [hw - 0.5 + n(2) * 0.6, gy(hw) + H * 0.82], [hw + 1.8 + n(3), gy(hw) + H], [hw + 5 + n(4) * 2, gy(hw) + H * 0.7], [hw + 9, gy(hw + 9) - 0.4]]
        .map(([lx, y]) => [cx + sd * lx, y, z]); })); }
  const tri = (a, b, c) => { pos.push(...a, ...b, ...c); const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; ny /= l;
    if (Math.abs(ny) > 0.62) C.copy(snow); else C.copy(rockA).lerp(rockB, hsh(a[0], a[2])); for (let i = 0; i < 3; i++) col.push(C.r, C.g, C.b); };
  for (let r = 0; r < rows.length - 1; r++) for (let sd = 0; sd < 2; sd++) { const A = rows[r][sd], B = rows[r + 1][sd];
    for (let i = 0; i < A.length - 1; i++) { if (sd === 0) { tri(A[i], B[i], B[i + 1]); tri(A[i], B[i + 1], A[i + 1]); } else { tri(A[i], A[i + 1], B[i + 1]); tri(A[i], B[i + 1], B[i]); } } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const walls = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, side: THREE.DoubleSide, emissive: 0x1c1838 })); walls.castShadow = false; walls.receiveShadow = true; walls.userData.noCast = true; g.add(walls);
  // boulders at the walls' feet (never on the ride line), icicles under the overhangs, lanterns on the walls
  const rocks = [], ice = [], lamps = [];
  for (let z = G.zA + 6; z < G.zB - 4; z += 7) for (const sd of [-1, 1]) { const k = gapClose(z); if (k < 0.15) continue; const hw = gapHW(z), cx = X(z);
    if (hsh(z, sd + 3) < 0.7) { const lx = hw - 0.6 - hsh(z, sd + 4) * 0.8, x = cx + sd * lx; rocks.push([1 + (hsh(z, sd) < 0.5 ? 0 : 1), x, gY(x, z) - 0.25, z, hsh(z, sd + 5) * 6.28, 0.55 + 0.6 * hsh(z, sd + 6)]); } }
  for (let z = G.zA + 4; z < G.zB - 4; z += 2.2) for (const sd of [-1, 1]) { const k = gapClose(z); if (k < 0.3 || hsh(z, sd + 9) < 0.35) continue; const r = rows[Math.min(rows.length - 1, Math.round((z - G.zA) / 3))][sd < 0 ? 0 : 1][2]; ice.push([r[0] - sd * 0.15, r[1] - 0.1, z, 0.6 + hsh(z, sd + 10) * 1.1]); }
  for (let z = G.zA + 14; z < G.zB - 10; z += 16) for (const sd of [-1, 1]) { const r = rows[Math.min(rows.length - 1, Math.round((z - G.zA) / 3))][sd < 0 ? 0 : 1][1]; lamps.push([r[0] - sd * 0.35, r[1] - 0.6, z]); }
  if (rocks.length) g.add(E.instanceField(rocks, (t) => `Rock${t}`));
  const icg = new THREE.ConeGeometry(0.13, 1, 5); icg.translate(0, -0.5, 0); const icm = new THREE.InstancedMesh(icg, new THREE.MeshStandardMaterial({ color: 0xcfe9ff, roughness: 0.2, metalness: 0.1, emissive: 0x2a4a6a }), ice.length), M4 = new THREE.Matrix4();
  ice.forEach(([x, y, z, l], i) => { icm.setMatrixAt(i, M4.makeScale(1, l, 1).setPosition(x, y, z)); }); icm.userData.noCast = true; g.add(icm);
  const lg = new THREE.SphereGeometry(0.22, 8, 6), lm = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffc46b, toneMapped: false }), lamps.length); lamps.forEach(([x, y, z], i) => lm.setMatrixAt(i, M4.makeTranslation(x, y, z))); lm.userData.noCast = true; g.add(lm);
  E.far(walls); E.far(icm); E.far(lm);
  S.gapTris = pos.length / 9 + ice.length * 10 + lamps.length * 80;
}
const ROUTES = [
  { id: 'straight', name: 'STRAIGHT DOWN', ready: true },
  { id: 'rockgap', name: 'THE ROCK GAP', side: -1, n: 2, ready: true, host: (F) => F.k === 'kick' || F.k === 'rail', dress: (E, g, Z) => makeRockGap(E, g, Z) },   // (R4)
  { id: 'tunnel', name: 'THE SNOW TUNNEL', side: 1, n: 2, ready: false, host: (F) => F.k === 'rail' || F.k === 'kick' },
  { id: 'igloo', name: 'THE IGLOO', side: -1, n: 1, ready: false, host: (F) => F.k === 'kick' || F.k === 'rail' },
  { id: 'right', name: 'DETOUR RIGHT', side: -1, n: 2, test: true, host: (F) => F.k === 'kick' || F.k === 'rail' },
  { id: 'left', name: 'DETOUR LEFT', side: 1, n: 2, test: true, host: (F) => F.k === 'kick' || F.k === 'rail' }];
function pickRoute(sd) {
  const want = new URLSearchParams(QALL).get('route'),   /* (also on the lobby's address: /sports/?route=right) */ forced = want && ROUTES.find((r) => r.id === want); if (forced) return forced;
  const can = ROUTES.filter((r) => r.ready && !r.test); if (can.length === 1) return can[0];
  const at = (seed) => can[Math.floor(rng32(seed ^ 0x5bd1e995)() * can.length)];
  if (sd.fixed) return at(sd.cur);
  if (sd.party) { const prev = at(sd.prev); let r = at(sd.cur); for (let k = 1; r === prev && k < 9; k++) r = at(sd.cur + k); return r; }   // (never the same route twice in a row)
  const last = lsGet('hp-route'); let r = at(sd.cur); for (let k = 1; r.id === last && k < 12; k++) r = at(sd.cur + k * 7919); return r;
}
// the path: a table down the hill of how far the course swings sideways (X) and its gentle rolls (V, a real run, not a flat strip)
const PZ0 = -140, PST = 0.25, PN = Math.round((860 - PZ0) / PST) + 1, PX = new Float32Array(PN), PV = new Float32Array(PN);
const tab = (T, z) => { const f = Math.max(0, Math.min(PN - 1.001, (z - PZ0) / PST)), i = f | 0; return T[i] + (T[i + 1] - T[i]) * (f - i); };
const X = (z) => tab(PX, z), routeX = X, V = (z) => tab(PV, z), Xd = (z) => X(z + 0.5) - X(z - 0.5), Xdd = (z) => (X(z + 2) - 2 * X(z) + X(z - 2)) / 4, Vd = (z) => V(z + 0.5) - V(z - 0.5);
const bankAt = (z) => Math.max(-0.14, Math.min(0.14, 0.5 * Math.atan(72 * Xdd(z) / 9.8)));   // (the piste banks a little into a turn)
const ss5 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
const TURN = 45, SWING = 16;
function layout(o, route, seed) {
  // the detour: which shuffled sections ride inside its zone (n in a row that the zone can hold, never the first section)
  let i0 = -1, n = 0; if (route.side) { const r = rng32(seed ^ 0x27d4eb2f), N = route.n || 1, cand = [];
    for (let i = 1; i + N <= o.length; i++) if (o.slice(i, i + N).every((F) => route.host(F))) cand.push(i);
    if (cand.length) { i0 = cand[Math.floor(r() * cand.length)]; n = N; } else { for (let i = 1; i < o.length; i++) if (route.host(o[i])) { i0 = i; n = 1; break; } } }
  let z = 6; const Z = { side: route.side || 0 };
  o.forEach((F, i) => { const last = i === o.length - 1;
    if (i === i0) { Z.a = z; z += TURN; Z.b = z; }
    if (F.k === 'kick') { F.s = z + 12; z = F.s + F.len + (F.table || 0) + F.back + F.T * 11 + 4; }
    else if (F.k === 'rail') { F.a = z + 6; F.b = F.a + RLEN[F.id]; z = F.b + 12; }
    else if (F.k === 'pipe') { PIPE_A = z + 14; PIPE_B = PIPE_A + 80; z = PIPE_B + 12; }
    else { BIG.s = z + 32; z = BIG.s + BIG.len + 96 + (last ? 20 : 22); }   /* (the big air: up to ~95 m of flight at full speed with slow-motion tricks) */
    if (i0 >= 0 && i === i0 + n - 1) { Z.c = z; z += TURN; Z.d = z; } });
  STOP_Z = z; COURSE_END = STOP_Z + 12; FEAT.length = 0; FEAT.push(...o); S.order = orderKey(o); S.L = COURSE_END; S.lastF = o[o.length - 1];
  S.route = route; S.zone = i0 >= 0 ? Z : null; S.gap = route.id === 'rockgap' && i0 >= 0 ? { zA: Z.b - 14, zB: Z.c + 14 } : null; S.inZone = i0 >= 0 ? o.slice(i0, i0 + n).map((F) => F.id) : [];
  // X: 0 on the main slope; in a detour it bends out over TURN metres (a smooth S), holds SWING metres to the side through the zone, bends back
  for (let i = 0; i < PN; i++) { const zz = PZ0 + i * PST; let x = 0; if (S.zone) { const D = Z.side * SWING; x = zz < Z.a ? 0 : zz < Z.b ? D * ss5((zz - Z.a) / TURN) : zz < Z.c ? D : zz < Z.d ? D * (1 - ss5((zz - Z.c) / TURN)) : 0; } PX[i] = x; }
  // V: gentle rolls (whoops) in the free stretches between the sections; flat on every feature, its run-in and landing, the pipe, the turns
  const busy = [[-1e9, 8], [STOP_Z - 24, 1e9]];
  for (const F of o) { if (F.k === 'kick') busy.push([F.s - 5, F.s + F.len + (F.table || 0) + F.back + F.T * 11 + 2]); else if (F.k === 'rail') busy.push([F.a - 4, F.b + 4]); else if (F.k === 'pipe') busy.push([PIPE_A - 6, PIPE_B + 6]); else busy.push([BIG.s - 10, BIG.s + BIG.len + 100]); }
  if (S.zone) busy.push([Z.a - 2, Z.b + 2], [Z.c - 2, Z.d + 2]);
  busy.sort((p, q) => p[0] - q[0]); const free = []; let at = -1e9; for (const [p, q] of busy) { if (p > at + 12) free.push([at, p]); at = Math.max(at, q); }
  PV.fill(0); S.rolls = 0;
  for (const [fa, fb] of free) { const L = fb - fa, nn = Math.max(1, Math.round(L / 22)), w = L / nn, fast = Math.abs(fb - (BIG.s - 10)) < 1, A = Math.min(1.5, w * w * 0.005) * (fast ? 0.35 : 1);   /* (on the big air's run-in he goes 15 m/s: lower rolls) */   /* (up to 1.5 m; a short roll lower, so he never lifts off a crest at riding speed) */
    for (let i = Math.max(0, Math.floor((fa - PZ0) / PST)); i < PN && PZ0 + i * PST <= fb; i++) { const zz = PZ0 + i * PST; PV[i] = A * Math.pow(Math.sin(Math.PI * (zz - fa) / w), 2); } S.rolls += nn; }
  for (const K of KICKS) K.x = X(K.s); for (const R of RAILS) R.x = X(R.a); BIG.x = X(BIG.s); S.pipeX = X(PIPE_A);
  lsSet('hp-order', S.order); lsSet('hp-route', route.id);
}
export const _S = S; export const _fx = { trickCard: (...a) => trickCard(...a), scoreFly: (...a) => scoreFly(...a) };   /* (tests: the pop-up gallery) */
// (2026-11-25) the Snowboard Foxino with his own clips: ?nb=1 while it is tested (the old rider stays the default until then)
const QALL = (() => { let q = location.search; try { if (window.parent !== window) q += '&' + window.parent.location.search.slice(1); } catch (e) {} return q; })();   // (the switch also works on the Sports lobby's address: /sports/?nb=2)
const NB = !/[?&]nb=0/.test(QALL), RIDER_URL = /[?&]nb=1/.test(QALL) ? 'models/foxino-snowboard.glb?v=1' : 'models/foxino-snowrider.glb?v=3';   /* (F5: v3 = with his face) */   /* (2026-11-25 night: the snowrider (v2 clips) is the default rider; ?nb=0 = the old rider, ?nb=1 = the first Snowboard Foxino) */   /* (2026-11-25: ?nb=2 = the snowrider: the whole Foxino on his board in a purple jacket and black ski pants (Tripo + Claudee RCC, 19 clips), behind a switch until it is approved) */   /* (2026-11-25 02:00: the old rider is the default again for the school test: the new Snowboard Foxino read dark and hunched at phone size; ?nb=1 = the new one) */
// (2026-11-25 night, the user: "The snowboard foxino should have bend knees bend a bit forward and jump while jump and until he makes a trick it
// is natural like hes slowly going to do that trick because we already know what he will do if he fails he falls. Make it on every trick")
// every trick's time in the air: a wind-up (his body leads, the board barely turns), the turn with the grab, then he spots the landing.
// A missed word = he still goes for the trick he was about to do, but late: still turning as he lands, so he crashes. The air runs at TSLOW
// while a trick is on, so the build-up reads.
const TW = { wind: 0.28, spot: 0.84 }, TSLOW = 0.72, GRAB = { stale: 'stalefish' };
// (the trick starts when the word is answered: the less air is left, the slower the air runs, so every trick takes about the same time)
const slowFor = (len) => Math.max(0.3, Math.min(TSLOW, len / 0.5 * TSLOW));
function trickAt(T, w, fail) {
  w = Math.max(0, Math.min(1, w));
  const k = fail ? Math.pow(Math.max(0, (w - TW.wind) / (1 - TW.wind)), 1.5) : w < TW.wind ? 0.04 * smoothStep(w / TW.wind) : 0.04 + 0.96 * smoothStep((w - TW.wind) / (TW.spot - TW.wind + 0.06));
  const seg = w < TW.wind ? 'wind' : fail || w < TW.spot ? 'grab' : 'spot';
  const clip = seg === 'wind' ? (T[1] ? 'windup_spin' : 'windup_flip') : seg === 'grab' ? 'grab_' + (GRAB[T[4]] || T[4] || 'indy') : 'spot_land';
  const frac = seg === 'wind' ? TW.wind : seg === 'grab' ? (fail ? 1 - TW.wind : TW.spot - TW.wind) : 1 - TW.spot;
  return { k, clip, frac };
}
const failTrick = (c0) => Object.assign(TRICKS[Math.max(0, Math.min(TRICKS.length - 1, c0))].slice(), { fail: true });
// the clip for where he is: on the walls he carves, at the lips he pumps, in the air a tuck or the trick's grab, then the landing
function clipFor(st) {
  if (st.ph === 'menu' || st.ph === 'drop') return ['stance_idle', 1];
  if (st.fall && st.has && st.has.wipeout) return [st.fallBack && st.has.wipeout_back ? 'wipeout_back' : 'wipeout', 1];   // (the snowrider's own wipeout: down, slide, up)
  if (st.rail && st.has && st.has.boardslide) return ['boardslide', 1];
  if (st.ph === 'stop' || st.ph === 'out' && st.u > 0.7) return ['cheer', 1];
  if (st.ph === 'air' && st.tc && st.has && st.has[st.tc[0]]) return st.tc;
  if (st.ph === 'air' && st.has && st.has.windup_spin) return st.air < 0.3 ? ['takeoff', 1] : ['air_tuck', 1];
  if (st.ph === 'air') { if (st.gk && st.gkk > 0.02) return ['grab_' + st.gk, st.gs || 1]; return st.air < 0.32 && !st.tr ? ['takeoff', 1.3] : ['air_tuck', 1]; }
  if (st.landT > 0) return [st.oops && (!st.has || st.has.land_wobble) ? 'land_wobble' : 'land', st.oops ? 1.2 : 1.4];
  if (st.pump) return ['pump', st.pump];   // (S1: compress into the transition, extend up the wall to the lip)
  return [st.roll > 0.2 ? 'carve_left' : st.roll < -0.2 ? 'carve_right' : 'ride', 1];
}
let FX = null; function fxRoot() { if (FX) return FX; const st = document.createElement('style'); st.textContent = `
#trickCard{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 84px);transform:translateX(-50%) scale(.5);opacity:0;z-index:31;pointer-events:none;text-align:center;font-family:'Lilita One','Arial Black',sans-serif;white-space:nowrap}
#trickCard.go{animation:tcIn .75s cubic-bezier(.2,1.4,.4,1) forwards} #trickCard.out{animation:none;transition:opacity .6s,transform .6s;opacity:0;transform:translateX(-50%) translateY(-16px) scale(.9)} body.asking #trickCard{display:none}
#trickCard b{display:block;font-size:clamp(24px,7vw,40px);font-weight:400;color:#fff;-webkit-text-stroke:2px #2a1e5c;paint-order:stroke fill;text-shadow:0 4px 0 #2a1e5c,0 0 18px rgba(255,120,220,.6)}
#trickCard i{display:inline-block;margin-top:4px;padding:3px 10px;border-radius:999px;background:#ff5fa8;color:#fff;font-style:normal;font-size:clamp(12px,3.4vw,15px);box-shadow:0 3px 0 #2a1e5c}
#trickCard.lv3 b{color:#ffe27a} #trickCard.lv6 b{color:#7fe8ff;font-size:clamp(28px,8vw,46px)} #trickCard.lv9 b{color:#ff9ad6;font-size:clamp(30px,8.6vw,50px);animation:tcShake .12s linear infinite}
#trickCard.oops b{color:#ffb0b0} #trickCard i.x{background:#2fbf6a;margin-left:6px}
body.tabs #labels{top:auto;bottom:0;left:0;right:0;height:auto;display:flex;justify-content:center;align-items:stretch;gap:10px;padding:0 max(12px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 52px) max(12px,env(safe-area-inset-left,0px))}
body.tabs .blabel{position:relative;left:auto;top:auto;transform:none!important;flex:1 1 0;max-width:230px;min-width:0;padding:0}
body.tabs .blabel span{height:100%;box-sizing:border-box;min-height:60px;display:flex;align-items:center;justify-content:center;padding:10px 8px;border-radius:18px;background:#2a1e5c;border:4px solid var(--c);box-shadow:0 5px 0 #140d33;font-size:clamp(19px,5.2vw,30px);overflow-wrap:anywhere}
body.tabs .blabel.long span{font-size:clamp(15px,4vw,22px)} body.tabs .blabel.on.wrong{opacity:.3}
@media (min-aspect-ratio:1/1){body.tabs #labels{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 40px)} body.tabs .blabel{max-width:210px} body.tabs .blabel span{min-height:48px;font-size:clamp(17px,3.2vw,26px)}}
.hpClock{position:fixed!important;left:max(16px,env(safe-area-inset-left,0px))!important;right:max(16px,env(safe-area-inset-right,0px))!important;bottom:calc(env(safe-area-inset-bottom,0px) + 124px)!important;height:8px!important;z-index:4;background:rgba(255,255,255,.35)!important}
@media (min-aspect-ratio:1/1){.hpClock{bottom:calc(env(safe-area-inset-bottom,0px) + 98px)!important;left:25%!important;right:25%!important}}
@media (min-aspect-ratio:3/2) and (max-height:560px){body.tabs #labels{top:0;bottom:0;left:auto;right:0;width:auto;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:8px;padding:0 max(12px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 40px) 0}
 body.tabs .blabel{flex:0 0 auto;width:min(210px,23vw);max-width:none} body.tabs .blabel span{min-height:50px}
 .hpClock{left:auto!important;right:max(12px,env(safe-area-inset-right,0px))!important;width:min(210px,23vw);bottom:calc(env(safe-area-inset-bottom,0px) + 222px)!important}}   /* (a landscape phone: the buttons in a column at the lower right, clear of Foxino in the middle) */
.hpTime{position:absolute;left:14px;right:14px;bottom:5px;height:6px;border-radius:3px;background:rgba(42,30,92,.14);overflow:hidden;pointer-events:none}
.hpTime i{position:absolute;inset:0;border-radius:3px;background:linear-gradient(90deg,#ff5f6d,#ffb020,#2fbf6a);transform-origin:left;animation:hpT var(--t) linear forwards}
@keyframes hpT{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.scoreFly{position:fixed;z-index:32;pointer-events:none;transform:translate(-50%,-50%);font:400 clamp(30px,8vw,48px)/1 'Lilita One',sans-serif;color:#ffe27a;-webkit-text-stroke:2px #2a1e5c;paint-order:stroke fill;text-shadow:0 4px 0 #2a1e5c,0 0 22px rgba(255,214,90,.8)}
body:has(#trickCard) #combo{display:none} #hudBig.bump{animation:hbBump .4s cubic-bezier(.2,1.8,.4,1)} 
@keyframes tcIn{to{opacity:1;transform:translateX(-50%) scale(1)}} @keyframes tcShake{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-1px)}75%{transform:translate(-1px,1px)}} @keyframes hbBump{0%{transform:scale(1)}40%{transform:scale(1.5);color:#ffe27a}100%{transform:scale(1)}}`;
  document.head.appendChild(st); FX = document.createElement('div'); FX.id = 'trickCard'; document.body.appendChild(FX); return FX; }
let CARDN = 0;
function trickCard(name, streak, oops = false, extra = '') { const c = fxRoot(); c.style.setProperty('--n', String(name).length);   /* (the comic font is wide: a long trick name is sized to fit the screen) */ c.className = ''; c.dataset.gen = String(++CARDN); void c.offsetWidth; c.innerHTML = `<b>${name}</b>${streak >= 2 ? `<i>🔥 ${streak} in a row</i>` : ''}${extra ? `<i class="x">${extra}</i>` : ''}`;
  c.classList.add('go'); if (oops) c.classList.add('oops'); else if (streak >= 9) c.classList.add('lv9'); else if (streak >= 6) c.classList.add('lv6'); else if (streak >= 3) c.classList.add('lv3'); }
// on landing: the trick's points count up over Foxino, then fly into the total at the top, which ticks up and bumps
async function scoreFly(E, pts, at) { if (!(pts > 0)) return; while (S.fall > 0) await new Promise((r) => setTimeout(r, 120));   /* (2026-11-26: no score while he is down in a crash; never a +0) */
  const c = fxRoot(), gen = c.dataset.gen; const v = at.clone().project(E.camera); let x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x = Math.max(70, Math.min(innerWidth - 70, x)); y = Math.max(SIGN.on ? (SIGN.botPx || 0) + 34 : 150, 150, Math.min(innerHeight - 120, y));   /* (H33: never over the question's sign) */
  const d = document.createElement('div'); d.className = 'scoreFly'; d.style.left = x + 'px'; d.style.top = y + 'px'; d.textContent = ''; document.body.appendChild(d);   // (2026-11-26: the old '+0' beat read like a broken score: it starts counting at once)
  const t0 = performance.now(), up = 1100; let last = -1; S.shown = S.pts;   /* (2026-11-25, the user: "make the animation slower": the count-up 0.52 → 1.1 s, the flight 0.43 → 0.85 s, the total 0.45 → 0.8 s) */
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t0) / up), n = Math.round(pts * (1 - Math.pow(1 - k, 3))); d.textContent = '+' + n; if ((n / 10 | 0) !== last) { last = n / 10 | 0; try { E.sfx.click && E.sfx.click(); } catch (e) {} } if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  await new Promise((r) => setTimeout(r, 450)); if (c.dataset.gen === gen) c.classList.add('out'); await new Promise((r) => setTimeout(r, 300));
  const hb = document.getElementById('hudBig').getBoundingClientRect(), tx = hb.left + hb.width / 2, ty = hb.top + hb.height / 2, t1 = performance.now(), fly = 850;
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t1) / fly), e = k * k * (3 - 2 * k); d.style.left = (x + (tx - x) * e) + 'px'; d.style.top = (y + (ty - y) * e - Math.sin(Math.PI * k) * 60) + 'px'; d.style.transform = `translate(-50%,-50%) scale(${1 - 0.55 * e})`; if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  d.remove(); const from = S.pts, t2 = performance.now(), tick = 800; const hbEl = document.getElementById('hudBig'); hbEl.classList.remove('bump'); void hbEl.offsetWidth; hbEl.classList.add('bump'); try { E.sfx.star && E.sfx.star(); } catch (e) {}
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t2) / tick); S.shown = from + pts * k; if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); S.shown = null; }
const AIRS = { air: 1, kair: 1, bair: 1 };   // (the three kinds of air: pipe, kicker, big air)
const kickH = (K, z) => K.lip * Math.pow(Math.max(0, Math.min(1, (z - K.s) / K.len)), 1.7);
const kickSlope = (K, z) => { const zz = Math.max(0, Math.min(1, (z - K.s) / K.len)); return K.lip * 1.7 * Math.pow(zz, 0.7) / K.len; };
// a kicker made in code: the curved ramp up to the lip, a short table, the back down to the snow; a blue line on the lip
function makeKicker(THREE, K, mat, lipMat, sideMat) {
  const prof = [], n = 12; for (let i = 0; i <= n; i++) prof.push([K.len * i / n, K.lip * Math.pow(i / n, 1.7)]); prof.push([K.len + 0.35 + (K.table || 0), K.lip]); prof.push([K.len + 0.35 + (K.table || 0) + K.back, 0]);
  const hw = K.w / 2, Y = (z, h) => -(K.s + z) * S.SL + h, Z = (z) => K.s + z, pos = [], side = [], kx = K.x || 0;
  const quad = (a, b, c, d, o = pos) => o.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < prof.length - 1; i++) { const [z0, h0] = prof[i], [z1, h1] = prof[i + 1];
    quad([kx - hw, Y(z0, h0) + 0.02, Z(z0)], [kx + hw, Y(z0, h0) + 0.02, Z(z0)], [kx + hw, Y(z1, h1) + 0.02, Z(z1)], [kx - hw, Y(z1, h1) + 0.02, Z(z1)]);
    for (const x of [kx - hw, kx + hw]) quad([x, Y(z0, -0.3), Z(z0)], [x, Y(z0, h0) + 0.02, Z(z0)], [x, Y(z1, h1) + 0.02, Z(z1)], [x, Y(z1, -0.3), Z(z1)], side); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true;
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(side, 3)); g2.computeVertexNormals(); const sm = new THREE.Mesh(g2, sideMat); sm.receiveShadow = true;   // (the sides a pale blue: the kicker reads against the snow)
  const lipB = new THREE.Mesh(new THREE.BoxGeometry(K.w + 0.04, 0.09, 0.36), lipMat); lipB.position.set(kx, Y(K.len + 0.17, K.lip) + 0.06, Z(K.len + 0.17));
  const grp = new THREE.Group(); grp.add(m, sm, lipB);
  // (2026-11-25) the sponsor on both sides of the kicker (a parody brand: see sponsorTex)
  if (K.spon) { const tex = sponsorTex(THREE, K.spon), L = Math.min(K.len + (K.table || 0), 9), h = Math.max(0.55, Math.min(2.2, K.lip * 0.62)), dm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sd of [-1, 1]) { const zc = K.s + K.len * 0.55 + (K.table || 0) * 0.5, hz = Math.min(K.lip, kickH(K, zc) || K.lip), d = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, Math.min(h, hz * 0.8 + 0.25)), dm);
      d.position.set(kx + sd * (hw + 0.02), -zc * S.SL + Math.max(0.3, hz * 0.45), zc); d.rotation.set(0, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0); d.rotateX(sd > 0 ? -Math.atan(S.SL) : Math.atan(S.SL)); grp.add(d); } }
  return grp;
}
// the rails: a candy-cane bar on three posts, a wide purple box, a rainbow rail (an arch)
function makeRail(THREE, R) {
  const g = new THREE.Group(), postM = new THREE.MeshStandardMaterial({ color: 0x5b5f8c, roughness: 0.6 }), N = R.arch ? 14 : 1, pt = (z) => new THREE.Vector3(R.x || 0, -z * S.SL + railH(R, z), z);
  if (R.look === 'box') {   // a wide low box: a purple top with a yellow edge
    const len = Math.hypot(R.b - R.a, (R.b - R.a) * S.SL), box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, len), [0x2a2f5c, 0x2a2f5c, 0x8b55e8, 0x2a2f5c, 0xffc23a, 0xffc23a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })));
    const A = pt(R.a), B = pt(R.b); box.position.copy(A).lerp(B, 0.5).add(new THREE.Vector3(0, -0.08, 0)); box.rotation.x = Math.atan(S.SL); box.castShadow = true; g.add(box);
    for (const f of [0.1, 0.5, 0.9]) { const p = A.clone().lerp(B, f), post = new THREE.Mesh(new THREE.BoxGeometry(0.5, R.h, 0.18), postM); post.position.set(p.x, p.y - R.h / 2 - 0.1, p.z); g.add(post); }
    return g; }
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 64; const x = cv.getContext('2d');
  if (R.look === 'rainbow') { ['#e8304a', '#ff9f1c', '#ffd23f', '#2fbf6a', '#36b5e0', '#8b55e8'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * 64 / 6, 16, 64 / 6 + 1); }); }
  else { x.fillStyle = '#fff'; x.fillRect(0, 0, 16, 64); x.fillStyle = '#e8304a'; x.fillRect(0, 0, 16, 32); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35, metalness: 0.2 });
  for (let i = 0; i < N; i++) { const A = pt(R.a + (R.b - R.a) * i / N), B = pt(R.a + (R.b - R.a) * (i + 1) / N), len = A.distanceTo(B), t2 = tx.clone(); t2.repeat.set(1, len / 0.5); t2.needsUpdate = true;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len + 0.02, 8, 1), R.look === 'rainbow' ? mat : new THREE.MeshStandardMaterial({ map: t2, roughness: 0.35, metalness: 0.2 }));
    bar.position.copy(A).lerp(B, 0.5); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); bar.castShadow = true; g.add(bar); }
  for (const f of R.arch ? [0.03, 0.3, 0.5, 0.7, 0.97] : [0.04, 0.5, 0.96]) { const z = R.a + (R.b - R.a) * f, p = pt(z), hh = railH(R, z) + 0.3, post = new THREE.Mesh(new THREE.BoxGeometry(0.1, hh, 0.1), postM); post.position.set(p.x, p.y - hh / 2, p.z); g.add(post); }
  return g;
}
// (2026-11-25, the user: "add the blue lines like in a real snow park") blue dye on the snow: dashed edges down the open slope, lines framing
// every kicker and rail, a line at each take-off approach and landing, along the pipe's flat bottom; one mesh
function makeBlueLines(THREE) {
  const pos = [], q = (x0, z0, x1, z1, w) => { x0 += X(z0); x1 += X(z1); const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2, Y = (x, z) => gY(x, z) + 0.035;
    const a = [x0 + nx, Y(x0 + nx, z0 + nz), z0 + nz], b = [x1 + nx, Y(x1 + nx, z1 + nz), z1 + nz], c = [x1 - nx, Y(x1 - nx, z1 - nz), z1 - nz], d = [x0 - nx, Y(x0 - nx, z0 - nz), z0 - nz]; pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (const [a, b] of [[-4, PIPE_A - 4], [PIPE_B + 4, STOP_Z + 4]]) for (const sd of [-1, 1]) for (let z = a; z < b; z += 5) if (!inGap(z)) q(sd * 9.5, z, sd * 9.5, z + 2.6, 0.2);   // (the dashed edges)
  for (const K of [...KICKS, BIG]) { const hw = K.w / 2 + 0.35, e = K.s + K.len + 0.35 + (K.table || 0) + K.back, land = K.s + K.len + K.T * (K === BIG ? 15 : 8.5);
    q(-hw - 0.6, K.s - 3, hw + 0.6, K.s - 3, 0.28); for (const sd of [-1, 1]) q(sd * hw, K.s - 3, sd * hw, e, 0.2);   // (the approach line, the kicker framed)
    q(-hw - 1.2, land - 2, hw + 1.2, land - 2, 0.3); q(-hw - 1.2, land + 2, hw + 1.2, land + 2, 0.3); }   // (the landing zone)
  for (const R of RAILS) { q(-1.6, R.a - 3, 1.6, R.a - 3, 0.26); for (const sd of [-1, 1]) q(sd * 0.9, R.a - 3, sd * 0.9, R.a, 0.16); }
  for (const sd of [-1, 1]) q(sd * S.FLAT, PIPE_A + 1, sd * S.FLAT, PIPE_B - 1, 0.22);   // (the pipe's flat bottom edges)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2b6be8, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.renderOrder = 1; return m;
}
// (2026-11-25, the user: "add sponsors that imitate real companies ... Red Fox (Red Bull), The Fox Face (The North Face)") our own PARODY brands,
// drawn here: their own fox logos, colours and lettering (nothing copied from the real brands)
const SPONSOR = {};
function sponsorTex(THREE, kind) { if (SPONSOR[kind]) return SPONSOR[kind];
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const fox = (x, y, r, col, face) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - r, y - r * 0.2); g.lineTo(x - r * 0.75, y - r * 1.15); g.lineTo(x - r * 0.25, y - r * 0.55); g.lineTo(x + r * 0.25, y - r * 0.55); g.lineTo(x + r * 0.75, y - r * 1.15); g.lineTo(x + r, y - r * 0.2); g.lineTo(x, y + r * 0.95); g.closePath(); g.fill();
    g.fillStyle = face; g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.05); g.lineTo(x, y + r * 0.8); g.lineTo(x + r * 0.55, y + r * 0.05); g.lineTo(x, y + r * 0.3); g.closePath(); g.fill(); g.beginPath(); g.arc(x, y + r * 0.72, r * 0.1, 0, 7); g.fillStyle = '#1b1b2a'; g.fill(); };
  const round = (x, y, w, h, r, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); };
  if (kind === 'red') {   // RED FOX: a cream card, an orange fox head, navy lettering, "GIVES YOU SPEED!"
    round(6, 6, 500, 244, 34, '#fff6e6'); round(6, 196, 500, 54, 0, '#ff5a1f'); fox(110, 104, 70, '#ff5a1f', '#fff6e6');
    g.fillStyle = '#16205a'; g.font = '900 italic 84px "Lilita One", "Arial Black", sans-serif'; g.textBaseline = 'middle'; g.fillText('RED', 200, 72); g.fillText('FOX', 200, 148);
    g.fillStyle = '#fff6e6'; g.font = '800 30px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('GIVES YOU SPEED!', 256, 224); }
  else {   // THE FOX FACE: a dark teal card, a white fox face in a rounded square, white lettering, "NEVER STOP RIDING"
    round(6, 6, 500, 244, 30, '#0f3d44'); round(28, 40, 150, 150, 28, '#ffffff'); fox(103, 112, 52, '#ff8a2a', '#ffffff');
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.font = '800 40px "Lilita One", "Arial Black", sans-serif'; g.fillText('THE', 200, 66); g.font = '900 64px "Lilita One", "Arial Black", sans-serif'; g.fillText('FOX FACE', 196, 124);
    g.fillStyle = '#7fe0d4'; g.font = '800 24px "Lilita One", "Arial Black", sans-serif'; g.fillText('NEVER STOP RIDING', 200, 182); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (SPONSOR[kind] = t); }
// a sponsor board standing in the snow beside the course, facing the riders coming down
function makeBoard(THREE, kind, x, z) { const rx = x; x = X(z) + rx; const grp = new THREE.Group(), y0 = gY(x, z), post = new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ map: sponsorTex(THREE, kind), roughness: 0.6 })); b.position.set(x, y0 + 1.35, z); b.rotation.y = Math.PI + (rx > 0 ? 0.35 : -0.35); grp.add(b);
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), post); p.position.set(x + sd * 1.4 * Math.cos(b.rotation.y), y0 + 0.7, z - sd * 1.4 * Math.sin(b.rotation.y)); grp.add(p); }
  return grp; }
// (2026-11-25, the user: "surrounded by deep forest") rows and rows of low-poly firs (two stacked 6-sided cones, 12 triangles), dark at the
// bottom and snowy at the top, in 50 m chunks (so the ones behind the camera are skipped) all down both sides of the course
function makeForest(THREE, rnd) {
  const a = new THREE.ConeGeometry(1.6, 3.2, 6, 1, true), b = new THREE.ConeGeometry(1.15, 2.6, 6, 1, true); a.translate(0, 2.2, 0); b.translate(0, 4.1, 0);
  const geo = new THREE.BufferGeometry(), pa = a.toNonIndexed().attributes.position, pb = b.toNonIndexed().attributes.position, pos = new Float32Array((pa.count + pb.count) * 3), col = [];
  pos.set(pa.array, 0); pos.set(pb.array, pa.count * 3); for (let i = 0; i < pa.count + pb.count; i++) { const y = pos[i * 3 + 1]; const c = y > 4.6 ? [0.92, 0.95, 1] : y > 3.3 ? [0.16, 0.34, 0.27] : [0.11, 0.25, 0.2]; col.push(...c); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), grp = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (let z0 = -90; z0 < COURSE_END + 90; z0 += 50) { const items = [];
    for (let z = z0; z < z0 + 50; z += 3.1) for (const sd of [-1, 1]) { const near = (z > PIPE_A - 3 && z < PIPE_B + 3 ? W() + DECK + 8 : 21);
      for (const [x0, span, p] of [[near, 10, 1], [near + 10, 14, 0.75], [near + 24, 28, 0.4]]) if (rnd() < p) { const zz0 = z + rnd() * 3.1, x = X(zz0) + sd * (x0 + rnd() * span), zz = zz0, s = 0.9 + rnd() * 0.9; items.push([x, gY(x, zz) - 0.2, zz, s, rnd() * 6.28]); } }
    const im = new THREE.InstancedMesh(geo, mat, items.length); items.forEach(([x, y, z, s, r], i) => { m4.compose(ps.set(x, y, z), q.setFromAxisAngle(Y, r), sc.set(s, s * (0.9 + (i % 5) * 0.08), s)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); im.receiveShadow = false; im.castShadow = false; im.userData.noCast = true; grp.add(im); }
  return grp;
}
// the open slope: flat down the course (|x| < 14), rolling gently up into snowy hills beside it
function gY(x, z) { const lx = x - X(z), ax = Math.abs(lx), k = Math.max(0, Math.min(1, (ax - 14) / 12)); return -z * S.SL + V(z) - Math.sign(lx) * Math.min(ax, 16) * Math.tan(bankAt(z)) + k * k * (3 - 2 * k) * ((ax - 14) * 0.16 + Math.sin(x * 0.13 + z * 0.07) * 0.9 + Math.sin(x * 0.05 - z * 0.11) * 1.3); }   // (R3: along the route: its swing X, its rolls V, banked a little in the turns)
function gridMesh(THREE, xs, zs, f, mat, xo = () => 0) {
  const pos = [], idx = []; for (const z of zs) { const o = xo(z); for (const x of xs) pos.push(o + x, f(o + x, z), z); }
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
function makeGround(THREE, snowM, pisteM) {   // (R3: in 50 m pieces that follow the route; the far pieces are not drawn)
  const side = [14, 17, 21, 26, 32, 40, 50, 62, 78, 98, 124], xs = [...side.map((x) => -x).reverse(), ...side], grp = new THREE.Group();
  for (let z0 = -100; z0 < COURSE_END + 130; z0 += 50) { const zs = []; for (let z = z0; z <= z0 + 50; z += 2.5) zs.push(z);
    grp.add(gridMesh(THREE, xs, zs, gY, snowM, X), gridMesh(THREE, [-14, -7, 0, 7, 14], zs, (x, z) => gY(x, z) + 0.02, pisteM, X)); }   // (the groomed course: piste lines)
  return grp;
}
// the halfpipe, built standing on the slope from PIPE_A to PIPE_B: the curved walls, the vertical bit, the decks, the outer walls, both ends closed
function makePipe(THREE, mat) {
  const prof = []; for (let i = 0; i <= 10; i++) { const x = S.FLAT + S.R * i / 10; prof.push([x, pipeY(x)]); }
  const top = S.R + S.WALLV; prof.push([W(), top]); prof.push([W() + DECK, top]); prof.push([W() + DECK, -0.6]);
  const pos = [], quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const sd of [1, -1]) for (let z0 = PIPE_A; z0 < PIPE_B; z0 += 8) { const z1 = Math.min(PIPE_B, z0 + 8);
    for (let i = 0; i < prof.length - 1; i++) { const [x0, h0] = prof[i], [x1, h1] = prof[i + 1], Y = (z, h) => -z * S.SL + h;
      const o = S.pipeX || 0; quad([o + sd * x0, Y(z0, h0), z0], [o + sd * x1, Y(z0, h1), z0], [o + sd * x1, Y(z1, h1), z1], [o + sd * x0, Y(z1, h0), z1]); } }
  // the two ends: each side's cross-section filled down to the snow
  for (const z of [PIPE_A, PIPE_B]) for (const sd of [1, -1]) for (let i = 0; i < prof.length - 1; i++) { const [x0, h0] = prof[i], [x1, h1] = prof[i + 1], b = -z * S.SL - 0.6;
    const o = S.pipeX || 0; quad([o + sd * x0, -z * S.SL + h0, z], [o + sd * x1, -z * S.SL + h1, z], [o + sd * x1, b, z], [o + sd * x0, b, z]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; m.userData.noCast = true;   // (2026-11-25: its own shadow cost ~10k triangles a frame in the shadow pass; it still takes the others')
  // the blue coping along both lips
  const grp = new THREE.Group(); grp.add(m); const cop = new THREE.MeshStandardMaterial({ color: 0x36b5e0, roughness: 0.45, emissive: 0x0d3a52 }), len = (PIPE_B - PIPE_A) / Math.cos(Math.atan(S.SL));
  for (const sd of [1, -1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, len), cop); const zm = (PIPE_A + PIPE_B) / 2; c.position.set((S.pipeX || 0) + sd * (W() + 0.1), -zm * S.SL + top + 0.05, zm); c.rotation.x = Math.atan(S.SL); grp.add(c); }
  return grp;
}
// an arch over the course: two posts and a banner facing the riders coming down
function makeArch(E, text, color, z, hw, h, mat = null) {
  const { THREE } = E, grp = new THREE.Group(), postM = new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 }), y0 = -z * S.SL + V(z), ax = X(z);
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, h + 1.6, 0.35), postM); p.position.set(ax + sd * hw, y0 + (h + 1.6) / 2 - 0.3, z); p.castShadow = true; grp.add(p); }
  const b = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, mat ? hw : Math.min(2.2, hw * 2 / 8)), mat || E.bannerMaterial(text, color)); b.position.set(ax, y0 + h + 0.6, z); b.rotation.y = Math.PI; grp.add(b);
  return grp;
}
// (2026-11-26, H33, Michal: "Make the questions or the sentences as questions in a 3D soace not in the tab and answers normal tabs for answers")
// The sentence flies in as a 3D sign floating ahead on the slope (in the camera's space, so it is always in his view and the same size on every
// screen; facing the camera; drawn over the scenery, high in the view, clear of Foxino); the answers are three big buttons at the bottom.
// The sign keeps everything the card had: what the question is for and its number, the sentence with its hints "(be)", the gap, then the
// right word filled in (green) and "Yes!" / "The right word: …"; the answer clock runs just above the buttons. Then it flies off up the hill.
const SIGN = { m: null, cv: null, tex: null, on: false, t0: 0, out: 0, who: '', q: null, res: null, ar: 3 };
function signDraw(E) {
  const { THREE } = E, q = SIGN.q, r = SIGN.res; if (!q) return;
  const W = 1024, cv = SIGN.cv || (SIGN.cv = document.createElement('canvas')), g = cv.getContext('2d'), pad = 46, maxW = W - pad * 2;
  const fill = r ? q.right : null, ok = r && r.ok;
  // the words: before / the gap / after; "(hints)" small and grey
  const toks = []; const add = (t) => { for (const part of String(t).split(/(\([^)]*\))/)) { if (!part) continue; if (/^\(.*\)$/.test(part)) toks.push({ t: part, hint: 1 }); else for (const w of part.split(/(\s+)/)) if (w && !/^\s+$/.test(w)) toks.push({ t: w }); } };
  add(q.before || ''); toks.push({ gap: 1 }); add(q.after || '');
  let fs = 78, lines = [];
  const font = (f, hint) => `${hint ? 700 : 400} ${Math.round(hint ? f * 0.72 : f)}px 'Lilita One', 'Arial Black', sans-serif`;
  const width = (tk, f) => { if (tk.gap) { g.font = font(f); return fill ? g.measureText(fill).width + f * 0.5 : f * 2.6; } g.font = font(f, tk.hint); return g.measureText(tk.t).width; };
  for (; fs >= 40; fs -= 4) { lines = [[]]; let x = 0; const sp = fs * 0.28;
    for (const tk of toks) { const w = width(tk, fs); if (x > 0 && x + sp + w > maxW) { lines.push([]); x = 0; } lines[lines.length - 1].push({ tk, w }); x += (x > 0 ? sp : 0) + w; }
    if (lines.length <= 3) break; }
  const lh = fs * 1.22, headH = 62, noteH = 58, H = Math.round(pad * 0.7 + headH + lines.length * lh + noteH + pad * 0.5);
  cv.width = W; cv.height = H; SIGN.ar = W / H;
  const rr = (x, y, w, h, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
  g.clearRect(0, 0, W, H); rr(8, 8, W - 16, H - 16, 40); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 12; g.strokeStyle = r ? (ok ? '#2fbf6a' : '#e8456b') : '#7e34f2'; g.stroke();
  g.fillStyle = '#7e34f2'; g.font = "400 40px 'FoxComic', 'Lilita One', sans-serif"; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(SIGN.who.toUpperCase(), W / 2, pad * 0.7 + headH / 2);
  let y = pad * 0.7 + headH + lh / 2; const sp = fs * 0.28; g.textAlign = 'left';
  for (const ln of lines) { const tw = ln.reduce((t, it, i) => t + it.w + (i ? sp : 0), 0); let x = (W - tw) / 2;
    for (const { tk, w } of ln) {
      if (tk.gap) { if (fill) { rr(x, y - fs * 0.62, w, fs * 1.18, 18); g.fillStyle = ok ? '#2fbf6a' : '#2fbf6a'; g.fill(); g.fillStyle = '#ffffff'; g.font = font(fs); g.fillText(fill, x + fs * 0.25, y + 2); }
        else { g.fillStyle = '#ffc23a'; g.fillRect(x, y + fs * 0.42, w, 10); } }
      else { g.fillStyle = tk.hint ? '#7a6fa8' : '#22164f'; g.font = font(fs, tk.hint); g.fillText(tk.t, x, y + 2); }
      x += w + sp; }
    y += lh; }
  g.textAlign = 'center'; g.font = "700 36px 'Lilita One', 'Arial Black', sans-serif";
  if (!r) { g.fillStyle = '#7a6fa8'; g.fillText('Tap the right word', W / 2, H - pad * 0.5 - noteH / 2); }
  else if (ok) { g.fillStyle = '#1e9e55'; g.fillText('Yes!', W / 2, H - pad * 0.5 - noteH / 2); }
  else { g.fillStyle = '#d23447'; g.fillText(`${r.timeout ? 'Too slow! ' : ''}The right word: ${q.right}`, W / 2, H - pad * 0.5 - noteH / 2); }
  if (SIGN.tex && (SIGN.tex.image.width !== W || SIGN.tw !== W || SIGN.th !== H)) { SIGN.tex.dispose(); SIGN.tex = null; }   // (a new size = a new texture: a GPU texture keeps its first size)
  if (!SIGN.tex) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; SIGN.tex = new THREE.CanvasTexture(c2); SIGN.tex.colorSpace = THREE.SRGBColorSpace; SIGN.tex.anisotropy = 4; SIGN.tw = W; SIGN.th = H; }
  SIGN.tex.image.getContext('2d').clearRect(0, 0, W, H); SIGN.tex.image.getContext('2d').drawImage(cv, 0, 0); SIGN.tex.needsUpdate = true; if (SIGN.m) { SIGN.m.material.map = SIGN.tex; SIGN.m.material.needsUpdate = true; }
}
function signShow(E, who, q) {
  const { THREE } = E; SIGN.who = who; SIGN.q = q; SIGN.res = null; signDraw(E);
  if (!SIGN.m) { SIGN.m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SIGN.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); SIGN.m.renderOrder = 30; SIGN.m.frustumCulled = false; SIGN.m.userData.noCast = true; }
  if (!E.camera.parent) E.scene.add(E.camera); if (SIGN.m.parent !== E.camera) E.camera.add(SIGN.m);
  SIGN.m.material.map = SIGN.tex; SIGN.m.material.needsUpdate = true; SIGN.on = true; SIGN.t0 = performance.now(); SIGN.out = 0; SIGN.m.visible = true; signPlace(E);
}
function signAnswer(E, r) { if (!SIGN.on || !SIGN.q) return; SIGN.res = r; signDraw(E); SIGN.out = performance.now() + (r.ok ? 650 : 1500); }
function signPlace(E) {   // every frame: where the sign floats in the camera's view (and its fly-in / fly-off)
  const m = SIGN.m; if (!m || !SIGN.on) return; const now = performance.now(), cam = E.camera, D = 10;
  const vh = 2 * D * Math.tan(cam.fov * Math.PI / 360), vw = vh * cam.aspect, land = cam.aspect > 1;
  let w = Math.min(vw * (land ? 0.62 : 0.94), vh * (land ? 0.36 : 0.27) * SIGN.ar), h = w / SIGN.ar;
  const topPx = (land ? 64 : 86) / innerHeight, fy = Math.max(land ? 0.28 : 0.3, topPx + (h / vh) / 2 + 0.01);
  const kin = Math.min(1, (now - SIGN.t0) / 420), e = 1 - Math.pow(1 - kin, 3), kout = SIGN.out ? Math.max(0, Math.min(1, (now - SIGN.out) / 380)) : 0;
  const d = D + (1 - e) * 34 + kout * 22, sway = Math.sin(now / 900) * 0.025;
  m.position.set(0, vh * (0.5 - fy) * d / D + kout * 3, -d); m.rotation.set(-0.08 * (1 - e) + sway * 0.4, sway, sway * 0.5); m.scale.set(w, h, 1);
  m.material.opacity = Math.min(1, kin * 2) * (1 - kout); SIGN.botPx = (fy + (h / vh) / 2) * innerHeight;   // (where its bottom edge is on screen: the count-ups stay below it)
  if (kout >= 1) { SIGN.on = false; m.visible = false; }
}
// a question with a clock: the bar runs down just above the answer buttons; when it is empty the question is gone (a miss)
async function askT(E, opts) { let bar = null, to = null;
  opts.tabs = true; opts.onQ = (q) => signShow(E, opts.who || '', q);
  const r = await Promise.race([E.ask(opts), new Promise((res) => { to = setTimeout(() => res({ ok: false, timeout: true, grade: 'bad', secs: LIMIT }), LIMIT * 1000);
    setTimeout(() => { bar = document.createElement('div'); bar.className = 'hpTime hpClock'; bar.innerHTML = '<i></i>'; bar.style.setProperty('--t', LIMIT + 's'); document.body.appendChild(bar); }, 0); })]);
  clearTimeout(to); if (bar) bar.remove(); signAnswer(E, r); if (r.timeout) { E.cancelAsk(); E.combo = 0; } return r; }
export default {
  id: 'halfpipe', blurb: 'A kicker, a rail, the halfpipe and a HUGE big air. Right words make big tricks!',
  light: { sky: 'alpine-night', skyYaw: 0.1, skyBase: 0.3, skySpan: 1.0, sunDir: [0.3, 0.85, -0.35], sun: 0xf2f4ff, sunI: 2.3, hemiSky: 0x7f96ff, hemiGround: 0x34307a, hemi: 0.65, rim: 0x8fd6ff, rimI: 1.4, exposure: 1.05, fog: [60, 330], fogColor: 0x3a3f9a, env: 0.25, flakes: 500, flakeA: 0.8 },
  bestShown: (s) => `${s} points`,
  async build(E, prog) {
    const { THREE } = E;
    const [g, J] = await Promise.all([E.loadGLB('models/halfpipe.glb?v=1'), E.loadJSON('models/halfpipe.json?v=1')]);
    Object.assign(S, { L: COURSE_END, SL: Math.tan(J.slope * Math.PI / 180), R: J.R, FLAT: J.flat, WALLV: J.wallV });
    // (2026-11-25, the user: "dont make it all in u ramp make the first and last section outside and the last jump should appear a lot bigger")
    // the course is made here: one long open slope, a short halfpipe standing on it in the middle, the kickers and the rail. The old long pipe
    // model is only used for its snow materials (the same look).
    const names = new Map(); g.scene.traverse((o) => { if (o.isMesh && o.material) names.set(o, o.material.name); });
    E.dressModel(g.scene, { banner: () => E.bannerMaterial('', '#36b5e0') });
    let snowM = null, pisteM = null; for (const [o, n] of names) { if (n === 'Snow' && !snowM) snowM = o.material; if (n === 'Piste' && !pisteM) pisteM = o.material; }
    snowM = snowM || new THREE.MeshStandardMaterial({ color: 0xeef2fd, roughness: 0.88 }); pisteM = pisteM || new THREE.MeshStandardMaterial({ color: 0xe4ebfb, roughness: 0.8 });
    const wallM = pisteM.clone(); wallM.side = THREE.DoubleSide; wallM.onBeforeCompile = pisteM.onBeforeCompile;
    prog(30, 'Planting the trees…');
    S.wallM = wallM; S.snowM = snowM; S.pisteM = pisteM; this.course(E);   // (R2/R3: the ground, the pipe, the features and everything round them, for this run's order and route)   // (R2: the pipe, the features and everything round them, for this run's order)
    await E.addMountains(-240, 0x8890c8);
    prog(60, 'Waxing the board…');
    S.a = NB ? await E.makeBoarder({ url: RIDER_URL }) : await E.makeActor({ gear: 'board' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = NB ? await E.makeBoarder({ friend: true, url: RIDER_URL }) : await E.makeActor({ gear: 'board', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; S.ghost.g.traverse((o) => { o.castShadow = false; o.userData.noCast = true; }); }   /* (2026-11-25: the friend casts no shadow: under 100k a frame) */
    E.groundAt = (x, z) => gY(x, z) + (z > PIPE_A && z < PIPE_B && Math.abs(x - (S.pipeX || 0)) < W() + DECK ? pipeY(Math.abs(x - (S.pipeX || 0))) : 0) - 0.2;
    E.drawDist = E.MP.on ? 118 : 155;   /* (2026-11-25: the longer course in deep forest: the far rows are the cheap firs; under 100k a frame) */
    this.reset(E);
  },
  // (2026-11-26, R2) the course for one run: lays the sections out in a new order, then builds everything that depends on where they are
  // (the pipe, the kickers and rails, the blue lines, the arches, the boards, the trees and lights next to the pipe, the Christmas kit) in one
  // group, so PLAY AGAIN gets a new course without reloading. The ground, the rocks (all outside the pipe's decks) and the mountains stay.
  course(E) {
    const { THREE } = E; if (S.cg) E.scene.remove(S.cg);
    const sd = runSeeds(S.runN || 0); layout(pickOrder(sd), pickRoute(sd), sd.cur); S.L = COURSE_END;
    const g = new THREE.Group(); S.cg = g; const ground = makeGround(THREE, S.snowM, S.pisteM); g.add(ground, makePipe(THREE, S.wallM));
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = [], lights = [], inPipe = (z) => z > PIPE_A - 3 && z < PIPE_B + 3;
    // (2026-11-25, the user: "surrounded by deep forest") a thick wall of pines on both sides all the way down, thinning out into the hills
    // (the detailed pines: one row along the course; behind them the deep forest of cheap low-poly firs, see makeForest)
    for (let z = -80; z < COURSE_END + 70; z += 12) for (const sd of [-1, 1]) { const near = (inPipe(z) ? W() + DECK + 4 : 16.5), rx = sd * (near + rnd() * 5), zz = z + rnd() * 4, x = X(zz) + rx; trees.push([1 + Math.floor(rnd() * 3), x, gY(x, zz) - 0.15, zz, rnd() * 6.28, 0.85 + rnd() * 0.6]); }
    g.add(makeForest(THREE, rnd));
    for (let z = 6; z < COURSE_END; z += 40) for (const sd of [-1, 1]) { if (inGap(z)) continue; const x = X(z) + sd * (inPipe(z) ? W() + DECK + 2.5 : 12.5); lights.push([0, x, gY(x, z), z, sd < 0 ? 0 : Math.PI, 1]); }
    g.add(E.instanceField(trees, (t) => `Pine${t}`), E.instanceField(lights, () => 'Floodlight', 400));
    // the floodlights' glow on the snow: 7 warm point lights spread down the course (no shadows; always 7, so no shader rebuild)
    const gz = S.gap ? [S.gap.zA + (S.gap.zB - S.gap.zA) * 0.3, S.gap.zA + (S.gap.zB - S.gap.zA) * 0.72] : [];   // (R4: two of the glows light the rock gap)
    for (let i = 0; i < 7; i++) { const z = i < gz.length ? gz[i] : 14 + i * (STOP_Z - 14) / 6, inG = i < gz.length, pl = new THREE.PointLight(0xffe2b0, inG ? 70 : 60, 55, 1.6); pl.position.set(X(z) + (inG ? (i % 2 ? 3 : -3) : i % 2 ? 9 : -9), -z * S.SL + (inG ? 8 : 12), z); g.add(pl); }
    const rocks = []; for (let i = 0; i < 46; i++) { const sd = rnd() < 0.5 ? -1 : 1, z = -50 + rnd() * (COURSE_END + 60), x = X(z) + sd * (17 + rnd() * 60); rocks.push([1 + Math.floor(rnd() * 2), x, gY(x, z) - 0.3, z, rnd() * 6.28, 0.9 + rnd() * 0.7]); }
    g.add(E.instanceField(rocks, (t) => `Rock${t}`));
    // the features: the kickers, the rails, the BIG kicker; arches over the pipe's entrance, the big air and the finish
    const M = S.fm || (S.fm = { snow: new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), sideM: new THREE.MeshStandardMaterial({ color: 0x9fb4f2, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }), bigLip: new THREE.MeshStandardMaterial({ color: 0xff4d8d, roughness: 0.5, emissive: 0x5a0d2a }) });
    for (const K of KICKS) g.add(makeKicker(THREE, K, M.snow, new THREE.MeshStandardMaterial({ color: K.lipC, roughness: 0.5, emissive: new THREE.Color(K.lipC).multiplyScalar(0.25) }), M.sideM));
    g.add(makeKicker(THREE, BIG, M.snow, M.bigLip, M.sideM)); for (const R of RAILS) g.add(makeRail(THREE, R));
    g.add(makeBlueLines(THREE));
    g.add(makeArch(E, 'DROP IN', '#36b5e0', PIPE_A - 3, W() + DECK + 0.3, 9.5), makeArch(E, 'RED FOX BIG AIR', '#ff5a1f', BIG.s - 10, 8, 7.5), makeArch(E, 'FINISH', '#0f3d44', STOP_Z + 8, 9, 6.5));
    // the sponsor boards down both edges of the open slopes (the parody brands, taking turns)
    let bi = 0; for (const [a, b] of [[8, PIPE_A - 10], [PIPE_B + 10, STOP_Z - 6]]) for (let z = a; z < b; z += 26) for (const sd of [-1, 1]) if (!inGap(z)) g.add(makeBoard(THREE, (bi++ + (sd > 0 ? 1 : 0)) % 2 ? 'red' : 'face', sd * 12, z));
    E.scene.add(g); E.far(ground);
    if (S.route && S.route.dress && S.zone) S.route.dress(E, g, S.zone);   // (R4+: the route's zone: the rock gap, the snow tunnel, the igloo)
    if (S.X) this.xmas(E, S.X);   // (a new run: the Christmas kit again, round the new course)
  },
  // Christmas: lights along the pipe's lips and down both edges of the open slopes, trees, gifts and snowmen beside the course
  xmas(E, X) {
    S.X = X; if (!X.ok) return; const n0 = E.scene.children.length; const { THREE } = E, W0 = W(), deckY = (z) => -z * S.SL + S.R + S.WALLV, P = (x, z, dy = 0) => new THREE.Vector3((S.pipeX || 0) + x, deckY(z) + dy, z), G = (x, z, dy = 0) => new THREE.Vector3(routeX(z) + x, gY(routeX(z) + x, z) + dy, z);   // (R3: x along the route; X here is the kit)
    for (const sd of [1, -1]) for (let z0 = PIPE_A; z0 < PIPE_B; z0 += 32) { const posts = []; for (let z = z0; z <= Math.min(PIPE_B, z0 + 32); z += 6.4) posts.push(P(sd * (W0 + 0.45), z, 1.15)); if (posts.length > 1) X.lights(posts, { sag: 0.25, per: 6, size: 0.14, glow: 1.1 }); }
    for (const [a, b] of [[-6, PIPE_A - 6], [PIPE_B + 4, STOP_Z + 6]]) for (const sd of [1, -1]) for (let z0 = a; z0 < b - 3; z0 += 30)   /* (R2: never a string with one post: the stretches have any length now) */ { if (inGap(z0) || inGap(Math.min(b, z0 + 30))) continue; const posts = []; for (let z = z0; z <= Math.min(b, z0 + 30); z += 6) posts.push(G(sd * 11, z, 1.0)); if (posts.length > 1) X.lights(posts, { sag: 0.25, per: 6, size: 0.13, glow: 1.1 }); }
    const spots = []; for (let z = 8, i = 0; z < STOP_Z - 10; z += 31) if ((z < PIPE_A - 14 || z > PIPE_B + 6) && !inGap(z) && !inGap(z + 10)) spots.push([z, i++]);   /* (R2: beside the open slopes of this run's course, never on the pipe's decks) */
    for (const [z, i] of spots) { const sd = i % 2 ? 1 : -1;
      X.put(i % 2 ? 'XmasTree_Small' : 'XmasTree_Big', G(sd * 15, z), i, i % 2 ? 1.9 : 1.3); X.put('XmasTree_Small', G(-sd * 14, z + 10), -i, 1.8);
      X.put(['Gift_A', 'Gift_B', 'Gift_C'][i % 3], G(sd * 13, z - 1.5), i); X.put('Gift_B', G(sd * 13.3, z + 1.4), -i);
      if (i % 2 === 0) X.put('Snowman', G(-sd * 13, z - 6), sd * 1.2); }
    for (const sd of [1, -1]) { X.put('Lantern', G(sd * 3.5, -3), sd); X.put('XmasTree_Small', G(sd * 6, -8), sd, 1.6); X.put('XmasTree_Small', P(sd * (W0 + 3), PIPE_A + 3), sd, 1.6); }
    X.put('Sleigh', G(8, STOP_Z + 2), 2.4);   // (2026-11-26, Michal: "Make sure the tree at the finish line is removed": the big tree that stood on the line past the stop is gone; the finish is open)
    for (const sd of [1, -1]) { const posts = []; for (let i = 0; i <= 8; i++) { const z = BIG.s + (BIG.len + 0.35) * i / 8; posts.push(new THREE.Vector3((BIG.x || 0) + sd * (BIG.w / 2 + 0.1), -z * S.SL + kickH(BIG, z) + 0.5, z)); } X.lights(posts, { sag: 0.1, per: 4, size: 0.12, glow: 1.2 }); }
    for (const R of RAILS) { X.put('CandyCane', G(1.2, R.a - 1), 1); X.put('CandyCane', G(-1.2, R.b + 1), -1); }
    if (S.cg) for (const o of E.scene.children.slice(n0)) S.cg.add(o);   // (R2: the kit joins this run's course group: a new run rebuilds it)
  },
  reset(E) { SIGN.on = false; if (SIGN.m) SIGN.m.visible = false; Object.assign(S, { pend: null, nextTrick: null, airN: 0, pN: 0, s: 1, d: 0, side: 1, phase: 'menu', u: 0, air: 0, trick: null, airTr: [], bOops: false, spin: 0, flip: 0, cork: 0, pts: 0, shown: null, due: 0, hit: 0, v: 4, wob: 0, landT: 0, shotT: 0, asking: false, k1: 0, r1: 0, p1: 0, b1: 0, done: {}, kick: null, rail: null, fall: 0, fr: 0, railFall: false, railSide: 1, head: 0, fbuf: [], fAt: 0, fTrickK: '', gOn: false, fin: false, pr: null, pHead: null, pRoll: 0, pRoll0: null }); E.snapCam(); },
  menu() { S.phase = 'menu'; },
  async run(E) {
    if (S.ran) { S.runN = (S.runN || 0) + 1; this.course(E); } S.ran = true;   // (R2: PLAY AGAIN = a new order)
    this.reset(E); S.phase = 'drop'; fxRoot();   // (H33: the answer-button styles are there from the first question)
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', `${QN} QUESTIONS · KICKERS · RAILS · PIPE · BIG AIR`, 900); S.phase = 'line';
    const at = (dy = 1.5) => S.a.g.position.clone().setY(S.a.g.position.y + dy);
    let chain = Promise.resolve();   // (the points fly into the total one after another)
    const free = (pts) => { chain = chain.then(() => scoreFly(E, pts, at())).then(() => { S.pts += pts; E.send({ p: Math.min(0.95, S.s / STOP_Z), v: `${S.pts}` }); }); };
    const anchors = (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.9), out, 2.3, 1.5);
    const ask = (who, slow) => askT(E, { who: `${who} · ${S.hit + 1}/${QN}`, num: `${S.pts} pts`, size: 0.95, anchors, slow });
    // (2026-11-26 night, the user: "when youre waiting for answer it is like doing stuff slow mo") while a question is up he keeps riding in slow
    // motion toward the moment it is for (the lip, the end of the rail), timed so he gets there as the clock runs out; an answer = full speed
    const slowTo = (tKey) => Math.max(0.08, Math.min(0.6, tKey / LIMIT));
    const ladder = (r) => TRICKS[Math.min(TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))];
    // the points: the trick × the streak (×1.1 for every right answer in a row, up to ×2) + a speed bonus (up to 80 for an instant answer)
    const score = (r, base) => { const mult = 1 + 0.1 * Math.min(10, Math.max(0, E.combo - 1)), fast = Math.round(80 * Math.max(0, 1 - (r.secs || LIMIT) / LIMIT));
      return { pts: Math.round(base * mult) + fast, chip: [mult > 1.001 ? `×${mult.toFixed(1)}` : '', fast ? `+${fast} FAST` : ''].filter(Boolean).join(' · ') }; };
    // (2026-11-25, the user: "make the congratulation text remove": no PERFECT!/GREAT!/GOOD! pop-ups over Foxino any more; a soft flash, a small
    // shake and the sound only; the trick card (or WIPEOUT! / TOO SLOW!) still says what happened)
    const react = (r) => { try { if (r.ok) { E.flash('rgba(120,255,170,.35)'); E.shake(0.2); E.sfx.star && E.sfx.star(Math.min(3, E.combo)); } else { E.flash('rgba(255,80,100,.45)'); E.shake(0.45); E.sfx.thud && E.sfx.thud(); } } catch (e) {} };
    // a trick decided before the take-off waits in S.pend; one answered in the air goes straight in
    const giveTrick = (tr, oops, phase) => { if (S.phase === phase) { const f = S.air / S.airT; if (tr) S.airTr.push({ ...tr, f0: f + 0.02 }); if (oops) S.bOops = true; } else S.pend = { tr, oops }; };
    for (const F of FEAT) {
      if (F.k === 'kick') {   // a kicker: the question on the run-in (slow motion up to the lip); a right word = a trick in the air; a miss = the trick, late, and a crash
        await E.until(() => S.phase === 'line' && S.s >= F.s + F.len - Math.max(4, S.v) * 1.25);
        const c0 = E.combo; S.asking = true; const r = await ask(F.name, slowTo((F.s + F.len - S.s) / Math.max(3, S.v))); S.asking = false; S.hit++; let due = 0;
        if (r.ok) { const T = ladder(r), sc = score(r, T[5]); giveTrick({ T, f0: 0.1, f1: 0.95 }, false, 'kair'); due = sc.pts; trickCard(T[0], E.combo, false, sc.chip); }
        else { giveTrick(S.a.isClip ? { T: failTrick(c0), f0: 0.1, f1: 0.995, fail: true } : null, true, 'kair'); trickCard(r.timeout ? 'TOO SLOW!' : 'WIPEOUT!', 0, true); }
        react(r); await E.until(() => S.phase === 'kair' && S.kick === F); await E.until(() => S.phase !== 'kair'); if (due) free(due);
      } else if (F.k === 'rail') {   // a rail or box: the question on it (sliding on in slow motion); a right word = a slide; a miss = a wobble, then off and down at the end
        await E.until(() => S.phase === 'rail' && S.rail === F && S.s >= F.a + 1.2);
        S.asking = true; const r = await ask(F.name, slowTo((F.b - 1 - S.s) / Math.max(2, S.v))); S.asking = false; S.hit++; let due = 0;
        if (r.ok) { const T = RAIL_TRICKS[Math.min(RAIL_TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))], sc = score(r, T[2]); S.railSide = T[1]; due = sc.pts; trickCard(T[0], E.combo, false, sc.chip); }
        else { S.wob = 1.3; S.railFall = true; trickCard(r.timeout ? 'TOO SLOW!' : 'WOBBLE!', 0, true); }
        react(r); await E.until(() => S.phase !== 'rail'); if (due) free(due);
      } else if (F.k === 'pipe') {   // the U-ramp: a question while he rides up the wall to each of the 3 airs (slow motion, knees loading at the lip)
        for (let i = 0; i < HITS; i++) {
          await E.until(() => (S.phase === 'cross' && S.pN === i && S.u >= (i === 0 ? 0.6 : 0.4)) || (S.phase === 'air' && S.pN > i));
          const tKey = S.phase === 'cross' ? (1 - S.u) * (S.pr ? S.pr.Tc : 1.55) / (S.fall > 0 ? 0.55 : 1) : 0.3;
          const c0 = E.combo; S.asking = true; const r = await ask(`HALFPIPE AIR ${i + 1}`, slowTo(tKey)); S.asking = false; S.hit++;
          const T = r.ok ? ladder(r) : S.a.isClip ? failTrick(c0) : OOPS;
          if (r.ok) { const sc = score(r, T[5]); S.due = sc.pts; trickCard(T[0], E.combo, false, sc.chip); } else { S.due = 0; trickCard(r.timeout ? 'TOO SLOW!' : 'WIPEOUT!', 0, true); }
          if (S.phase === 'air' && S.pN > i) { S.trick = T; S.tw0 = Math.min(0.8, S.air / S.airT); S.spin = 0; S.flip = 0; } else S.nextTrick = T;
          react(r);
          await E.until(() => S.phase === 'air' && S.pN > i); await E.until(() => S.phase !== 'air'); if (S.due) free(S.due); S.due = 0;
          E.send({ p: Math.min(0.95, S.s / STOP_Z), v: `${S.pts}` });
        }
      } else if (F.k === 'big') {   // the BIG AIR: question 1 on the run-in (slow motion to the lip), question 2 at the top of the flight (a slow float)
        await E.until(() => S.phase === 'line' && S.s >= BIG.s + BIG.len - Math.max(4, S.v) * 1.25); let due = 0, failed = false;
        { const c0 = E.combo; S.asking = true; const r = await ask('BIG AIR 1', slowTo((BIG.s + BIG.len - S.s) / Math.max(3, S.v))); S.asking = false; S.hit++;
          if (r.ok) { const T = ladder(r), sc = score(r, T[5]); giveTrick({ T, f0: 0.1, f1: 0.46 }, false, 'bair'); due += sc.pts; trickCard(T[0], E.combo, false, sc.chip); }
          else { failed = true; giveTrick(S.a.isClip ? { T: failTrick(c0), f0: 0.1, f1: 0.995, fail: true } : null, true, 'bair'); trickCard(r.timeout ? 'TOO SLOW!' : 'WIPEOUT!', 0, true); }
          react(r); }
        await E.until(() => S.phase !== 'line' || S.s > BIG.s + BIG.len + 1);
        if (!failed) { await E.until(() => S.phase !== 'bair' || S.air / S.airT >= 0.52);
          if (S.phase === 'bair') { const c0 = E.combo; S.asking = true; const r = await ask('BIG AIR 2', slowTo((0.93 - S.air / S.airT) * S.airT * 0.6)); S.asking = false; S.hit++; const f = S.air / S.airT;
            if (r.ok) { const T = ladder(r), sc = score(r, T[5]); S.airTr.push({ T, f0: f + 0.02, f1: 0.95 }); due += sc.pts; trickCard(T[0], E.combo, false, sc.chip); }
            else { if (S.a.isClip) S.airTr.push({ T: failTrick(c0), f0: f + 0.02, f1: 0.995, fail: true }); S.bOops = true; trickCard(r.timeout ? 'TOO SLOW!' : 'WIPEOUT!', 0, true); }
            react(r); } }
        else S.hit++;   /* (a crash on question 1: no second trick in that air) */
        await E.until(() => S.phase !== 'bair'); if (due) free(due);   /* (R2: no waiting for the count-ups here: a section can follow the big air) */
      }
    }
    S.fin = true;   // (R2: every section done: he rides out to the finish and stops, whatever came last)
    await chain; E.send({ p: 1, v: `${S.pts}` });
    await E.until(() => S.phase === 'stop');
    E.banner(`${S.pts}`, 'POINTS', 1800); { const bn = document.getElementById('banner'); if (bn) bn.classList.add('cm-lift'); }   /* (2026-11-26: the finish is clear: the points call-out sits high, over the sky, so his cheer shows) */ E.cine(true); E.shake(0.3);
    await E.wait(2.4); E.cine(false);
    E.finish({ score: S.pts, shown: `${S.pts}`, unit: 'points', better: 'high', line: `${QN} questions` });
  },
  // a wipeout (a wrong word or the clock ran out): he goes down, slides, gets up; the streak is gone
  wipe(E) { if (S.fall > 0) return; const dr = S.a && S.a.dur; S.fall = dr ? Math.max(FALL, (S.fallBack && dr.wipeout_back ? dr.wipeout_back : dr.wipeout || FALL) - 0.1) : FALL; E.combo = 0; E.shake(0.55); E.spray.emit(S.a.g.position, 36, 0, 2.2, 2, 2.4); try { E.sfx.thud && E.sfx.thud(); } catch (e) {} },
  // takeoff from a kicker: a parabola from the lip down to the slope (heights over the slope line)
  takeoff(E, ph, K) { S.tc = null; S.phase = ph; S.air = 0; S.airT = K.T; S.airH = K.H; S.lip = K.lip; S.airN = (S.airN || 0) + 1; S.airTr = []; S.bOops = false; S.trick = null;
    if (S.pend) { if (S.pend.tr) S.airTr.push(S.pend.tr); if (S.pend.oops) S.bOops = true; S.pend = null; } E.spray.emit(S.a.g.position, 16, 0, 3, 3, 1.6); },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E;
    let y = 0, roll = 0, pitch = 0, P, act = null;
    if (S.phase === 'menu' || S.phase === 'drop') {
      S.s = 1; S.d = 0; S.v = 4; y = 0;
      a.g.position.set(0, -S.s * S.SL, S.s); a.g.rotation.set(0, 0, 0); a.g.rotateX(SLA());
      if (a.isClip) { a.want('stance_idle'); a.update(dt || rdt); } else { a.pose(this.ridePose(t, 0), 8, rdt); a.update(); }
      const Pp = a.g.position, ang = t * 0.15 + 0.6;
      E.cam(new THREE.Vector3(Pp.x + Math.cos(ang) * 3.6, Pp.y + 1.5, Pp.z + Math.sin(ang) * 3.6), new THREE.Vector3(Pp.x, Pp.y + 0.8, Pp.z), 3, 50);
      E.focusAt = Pp; E.focus = 4; E.hud('0', 'SNOWBOARD'); if (S.ghost && E.MP.on) this.friendGhost(E, t, rdt); return;
    }
    S.s += S.v * dt;
    if (S.fall > 0) { S.fall = Math.max(0, S.fall - dt); const k = 1 - S.fall / FALL; S.fr = a.isClip && (a.clips || []).includes('wipeout') ? 0 : 1.35 * (k < 0.18 ? k / 0.18 : k < 0.62 ? 1 : 1 - (k - 0.62) / 0.38); } else S.fr = 0;   // (down, sliding, back up)
    if (S.phase === 'cross' || S.phase === 'out') {
      // from one lip across the flat to the other lip (u: 0 -> 1)
      if (!S.pr) { const lv = Math.min(11, E.combo); S.pr = pipeRun(3.2 + lv * 0.16, 1.15 + lv * 0.06); }   // (S1: this crossing's physics, for the air it leads to)
      S.u += dt / S.pr.Tc * (S.fall > 0 ? 0.55 : 1); S.v = E.damp(S.v, 6.5 * (1 + Math.min(6, E.combo) * 0.025), 2.5, dt);   /* (R2: a fast entry (after the big air) settles to the pipe's speed) */
      const u = Math.min(1, S.u), aa = S.pr.aAt(u), [lat, hh, wa] = S.pr.A.at(aa);
      S.d = S.side * lat; y = hh; roll = Math.sign(S.d) * Math.abs(wa) * (1 - 0.28 * smoothStep(Math.abs(wa) / (Math.PI / 2)));   // (he leans with the wall, a little less near the top)
      S.pHead = S.side * Math.atan2(S.pr.vAt(aa), Math.max(2, S.v)); S.pRoll = roll;   // (his heading: where he really goes, across and down the pipe)
      S.wob = Math.max(0, S.wob - dt);
      P = S.fall > 0 ? this.ridePose(t, 1) : S.wob > 0 ? E.SP.wobble(t) : this.ridePose(t, Math.sin(Math.PI * u));
      if (Math.abs(S.d) < S.FLAT && dt > 0.002) E.spray.emit(a.g.position, 1, 0, 0.8, 0, 0.8, 0.09);
      if (S.pN >= HITS && S.u >= 0.5) { S.phase = 'line'; S.d = 0; }   // (the 3 pipe airs done: straight down the middle to the big air)
      else if (S.u >= 1) { const lv = Math.min(11, E.combo); S.pRoll0 = S.pRoll; S.phase = 'air'; S.airN = (S.airN || 0) + 1; S.pN++; S.air = 0; S.airT = 1.15 + lv * 0.06; S.airH = 3.2 + lv * 0.16; S.trick = S.nextTrick || null; S.nextTrick = null; S.tw0 = S.trick ? 0.1 : null; S.tc = null; E.spray.emit(a.g.position, 14, 0, 3, 0, 1.6); }
    } else if (S.phase === 'air') {
      const T = S.trick, TA = T && T !== OOPS && a.isClip, t0 = S.tw0 ?? 0.42, t1 = T && T.fail ? 0.995 : 0.95, w0 = (S.air / S.airT - t0) / (t1 - t0), sl = TA && w0 >= 0 && w0 < 1 ? slowFor(t1 - t0) : 1;
      S.air += dt * sl; const f = Math.min(1, S.air / S.airT);   // (a trick on: the air in gentle slow motion)
      S.d = S.side * (W() + 0.25 * Math.sin(Math.PI * f));
      y = S.R + S.WALLV + 4 * S.airH * f * (1 - f) * (S.trick === OOPS ? 0.55 : 1);   // (S1: from the lip's top, no drop)
      { const vL = S.pr ? S.pr.vL : 11, r0 = S.pRoll0 ?? S.side * 1.13; S.pHead = S.side * Math.atan2(vL * (1 - 2 * f), Math.max(2, S.v)); roll = r0 * (1 - Math.sin(Math.PI * f)); }   // (S1: up, over the top facing down the pipe, down: one smooth turn; upright at the top)
      // the trick: spins round the vertical, flips; a grab in the middle (the new rider: wind-up, turn + grab, spot the landing)
      const w = (f - t0) / (t1 - t0), TT = TA ? trickAt(T, w, !!T.fail) : null; if (TT) S.tc = [TT.clip, (a.dur && a.dur[TT.clip] || 1) / Math.max(0.12, TT.frac * (t1 - t0) * S.airT / slowFor(t1 - t0))]; else S.tc = null;
      const k = TT ? TT.k : T ? smoothStep(w) : 0;
      S.spin = T ? T[1] * Math.PI * 2 * k : 0; S.flip = T ? (T[2] + (a.isClip ? T[3] : 0)) * Math.PI * 2 * k : 0;   /* (a cork = an off-axis flip with the spin) */ S.cork = T ? T[3] * 0.55 * Math.sin(Math.PI * k) : 0;
      if (T && T !== OOPS && !T.fail && k > 0.02 && k < 0.99) act = { T, k };
      P = T && T !== OOPS && k > 0.08 && k < 0.93 ? this.grabPose(t, T[4], Math.min(1, Math.sin(Math.PI * k) * 1.6)) : this.ridePose(t, 0.6 + (f < 0.12 || f > 0.88 ? 0.4 : 0));
      if (f >= 1) { S.phase = 'cross'; S.u = 0; S.side = -S.side; S.pr = null; if (S.trick && S.trick !== OOPS && !S.trick.fail && S.a.smile) S.a.smile(0.9);   /* (F5: a clean trick landing = a smile) */ S.spin = 0; S.flip = 0; S.landT = 0.25; E.shake(0.25); E.spray.emit(a.g.position, 20, 0, 2.5, 0, 2); if (S.trick === OOPS || (S.trick && S.trick.fail)) { S.fallBack = !S.trick[1]; this.wipe(E); } S.tc = null; }
    } else if (S.phase === 'line' || S.phase === 'rail' || S.phase === 'end') {
      // the course down the middle: speed up for the kickers, steady over the rail, slower into the pipe, flat out to the big air
      const z = S.s, late = !S.b1 && z > BIG.s - 32 && z < BIG.s + BIG.len; let tv = late ? 15 : z >= PIPE_A - 4 && S.pN < HITS ? 6.5 : 8.5; if (S.phase === 'end') tv = 0;   /* (R2: flat out on the big air's run-in, slower into the pipe, wherever they are) */
      tv *= (1 + Math.min(6, E.combo) * 0.025) * (S.fall > 0 ? 0.4 : 1);   // (the streak: up to 15 % faster; a wipeout: slowed right down)
      S.v = S.v < tv ? Math.min(tv, S.v + (late ? 3.6 : 3) * dt) : Math.max(tv, S.v - (S.phase === 'end' ? 6 : S.fall > 0 ? 7 : 3) * dt);
      S.d = E.damp(S.d, 0, 3, dt); y = pipeY(Math.abs(S.d)); S.wob = Math.max(0, S.wob - dt);
      let crouch = 0.25;
      if (S.phase === 'rail') {
        const R = S.rail || RAIL, top = R.look === 'box' ? 0.02 : 0.07;
        if (z < R.a + 1) { const f = smoothStep((z - (R.a - 1.4)) / 2.4); y = (railH(R, z) + top) * f + 0.45 * Math.sin(Math.PI * f); }
        else if (z < R.b - 1) { y = railH(R, z) + top; pitch = R.arch ? Math.atan(R.arch * Math.PI / (R.b - R.a) * Math.cos(Math.PI * (z - R.a) / (R.b - R.a))) : 0; if (dt > 0.002 && Math.random() < 0.5) E.spray.emit(a.g.position, 1, 0, 0.6, 0, 0.5, 0.07); }
        else { const f = Math.min(1, (z - (R.b - 1)) / 3); y = (railH(R, R.b - 1) + top) * (1 - f) + 0.5 * Math.sin(Math.PI * f); if (f >= 1) { S.phase = 'line'; S.landT = 0.25; E.shake(0.2); E.spray.emit(a.g.position, 14, 0, 2, 0, 1.5); if (S.railFall) { S.railFall = false; this.wipe(E); } else if (S.a.smile) S.a.smile(0.9); }   /* (F5: off a rail cleanly = a smile) */ }
        crouch = 0.5;
      } else if (S.phase === 'line') {
        for (const K of [...KICKS, BIG]) if (z >= K.s && z < K.s + K.len) { y += kickH(K, z); pitch = Math.atan(kickSlope(K, z)); crouch = 0.4 + 0.5 * (z - K.s) / K.len; }
        const K = KICKS.find((k) => !S.done[k.id] && z >= k.s + k.len), R = RAILS.find((r) => !S.done[r.id] && z >= r.a - 1.4);
        if (K) { S.done[K.id] = 1; S.kick = K; this.takeoff(E, 'kair', K); }
        else if (R) { S.done[R.id] = 1; S.rail = R; S.phase = 'rail'; }
        else if (!S.p1 && z >= PIPE_A) { S.p1 = 1; S.phase = 'cross'; S.u = 0.5; S.side = 1; S.pT = 0; }
        else if (!S.b1 && z >= BIG.s + BIG.len) { S.b1 = 1; this.takeoff(E, 'bair', BIG); }
        else if (S.fin && z >= STOP_Z - 12) S.phase = 'end';   // (R2: past the last section: slow down to the finish)
        if (S.phase === 'kair' || S.phase === 'bair') y = pipeY(0) + S.lip;
      } else if (S.v < 0.4) { S.phase = 'stop'; S.v = 0; }
      if (S.phase === 'line' || S.phase === 'end') { pitch += Math.atan(Vd(z)); roll = -Math.max(-0.35, Math.min(0.35, Math.atan(S.v * S.v * Xdd(z) / 9.8))); }   // (R3: over the rolls; leaning into the route's turns)
      P = S.fall > 0 ? this.ridePose(t, 1) : S.wob > 0 ? E.SP.wobble(t) : S.phase === 'stop' ? E.SP.cheer(t) : this.ridePose(t, crouch);
      if (S.phase === 'line' && Math.abs(S.d) < 1 && dt > 0.002 && Math.random() < 0.4) E.spray.emit(a.g.position, 1, 0, 0.8, 0, 0.8, 0.09);
    } else if (S.phase === 'kair' || S.phase === 'bair') {
      const f0 = S.air / S.airT, on = a.isClip && S.airTr.find((tr) => f0 > tr.f0 && f0 < tr.f1);
      S.air += dt * (on ? slowFor(on.f1 - on.f0) : 1); const f = Math.min(1, S.air / S.airT);   // (a trick on: the air in gentle slow motion)
      S.d = E.damp(S.d, 0, 3, dt); y = S.lip * (1 - f) + 4 * S.airH * f * (1 - f) * (S.bOops ? 0.8 : 1);
      S.spin = 0; S.flip = 0; S.cork = 0; S.tc = null;
      for (const tr of S.airTr) { const w = (f - tr.f0) / Math.max(0.05, tr.f1 - tr.f0), TT = a.isClip ? trickAt(tr.T, w, !!tr.fail) : null, k = TT ? TT.k : smoothStep(w);
        // (the latest trick that has started decides the clip; a trick done early in the big air goes back to the calm air pose, not spotting a landing)
        if (TT && w > 0) { const early = tr.f1 < 0.8, cl = TT.clip === 'spot_land' && early ? 'air_tuck' : TT.clip;
          S.tc = w >= 1 ? (tr.fail ? S.tc : [early || f <= 0.82 ? 'air_tuck' : 'spot_land', 1]) : [cl, (a.dur && a.dur[cl] || 1) / Math.max(0.12, TT.frac * (tr.f1 - tr.f0) * S.airT / slowFor(tr.f1 - tr.f0))]; }
        if (tr.fail) S.fallBack = !tr.T[1]; S.spin += tr.T[1] * Math.PI * 2 * k; S.flip += (tr.T[2] + (a.isClip ? tr.T[3] : 0)) * Math.PI * 2 * k; S.cork += tr.T[3] * 0.55 * Math.sin(Math.PI * k); if (k > 0.02 && k < 0.99) act = { T: tr.T, k }; }
      P = act && act.T[4] && act.k > 0.08 && act.k < 0.93 ? this.grabPose(t, act.T[4], Math.min(1, Math.sin(Math.PI * act.k) * 1.6)) : this.ridePose(t, 0.6 + (f < 0.12 || f > 0.88 ? 0.4 : 0));
      if (f >= 1) { const big = S.phase === 'bair'; if (!S.bOops && S.airTr.length && S.a.smile) S.a.smile(big ? 1.6 : 0.9); S.phase = big && S.lastF && S.lastF.k === 'big' ? 'end' : 'line'; S.spin = 0; S.flip = 0; S.cork = 0; S.landT = 0.25; S.wob = 0; if (S.bOops) this.wipe(E); E.shake(big ? 0.5 : 0.3); E.spray.emit(a.g.position, big ? 40 : 22, 0, 2.5, 3, 2.4); }
    } else { P = E.SP.cheer(t); y = pipeY(Math.abs(S.d)); }
    // place: on the wall the board stands on the wall (roll), on a kicker it tips up, in the air the trick turns him
    if (S.gap && dt > 0 && inGap(S.s + 10) && Math.random() < dt * 1.6) { const z = S.s + 6 + Math.random() * 16, k = gapClose(z); if (k > 0.4) { const sd = Math.random() < 0.5 ? -1 : 1, hw = gapHW(z), x = X(z) + sd * (hw + 1.4); E.spray.emit(new THREE.Vector3(x, gY(x, z) + 1.2 + 11 * k * 0.95, z), 10, -sd * 1.1, -0.4, 0, 1.4, 0.18); } }   // (R4: snow drifting off the rock tops)
    const wx = X(S.s) + S.d; a.g.position.set(wx, -S.s * S.SL + y + V(S.s), S.s);   // (R3: on the route: its swing sideways, its rolls)
    const dd = dt > 1e-5 ? (wx - (S.dPrev ?? wx)) / dt : 0; S.dPrev = wx;   // (he faces where he goes: down the route's turns too)
    S.pT = (S.pT ?? 9) + rdt; S.head = (S.phase === 'cross' || S.phase === 'air') && S.pHead != null && S.fall <= 0 ? E.damp(S.head || 0, S.pHead, S.pT < 0.7 ? 6 : 30, rdt) :   /* (S1: a gentle carve into the first crossing) */ E.damp(S.head || 0, S.phase === 'air' ? S.side * 1.25 : S.phase === 'rail' ? (S.railSide === 0 ? 0.05 : Math.PI / 2) : Math.atan2(dd, Math.max(2, S.v)), 10, rdt);
    S.pitch = E.damp(S.pitch || 0, pitch, 12, rdt);
    a.g.rotation.set(0, 0, 0); a.g.rotateX(SLA()); a.g.rotateZ(roll); a.g.rotateY(S.head); a.g.rotateX(-S.pitch); if (S.fr) a.g.rotateZ(S.fr);
    if (a.fox) a.fox.root.rotation.x = E.damp(a.fox.root.rotation.x, AIRS[S.phase] || S.phase === 'stop' || S.phase === 'menu' || S.phase === 'drop' ? 0 : LEAN, 6, rdt);   // (riding: his body a little forward over the board, the board stays flush)
    if (AIRS[S.phase]) { a.g.rotateY(S.spin); a.g.rotateZ(S.cork || 0); a.g.rotateX(S.flip); }
    const air = !!AIRS[S.phase], gkk = act ? Math.min(1, Math.sin(Math.PI * act.k) * 1.6) : 0;
    if (a.isClip) { S.landClk = air ? 0.75 : Math.max(0, (S.landClk || 0) - dt);
      if (air) S.wasOops = S.phase === 'air' ? S.trick === OOPS : S.bOops; if (S.fall > 0) S.landClk = 0.4;
      const pumpOn = S.phase === 'cross' && S.pr && S.u > 0.5 && Math.abs(S.d) > S.FLAT - 0.6, st = { pump: pumpOn ? Math.max(0.7, Math.min(2, ((a.dur && a.dur.pump) || 1) / Math.max(0.2, (1 - S.u) * S.pr.Tc))) : 0, has: a.has || (a.has = Object.fromEntries((a.clips || []).map((c) => [c, 1]))), fall: S.fall > 0, rail: S.phase === 'rail', ph: air ? 'air' : S.phase === 'stop' ? 'stop' : 'cross', u: S.phase === 'cross' ? S.u : 0.5, air: S.air / S.airT, tr: act ? act.T[0] : '', gk: act && act.T[4] ? act.T[4] : '', gkk: act ? act.k : 0, gs: 1.2 / Math.max(0.3, 0.5 * S.airT), landT: !air && S.landClk > 0 && S.landClk < 0.75 ? S.landClk : 0, oops: S.wasOops, roll, tc: S.tc, fallBack: !!S.fallBack };
      const [cl, sp] = clipFor(st); if (cl !== S.clip) { S.clip = cl; a.want(cl, cl.startsWith('grab_') ? 0.1 : 0.18, sp); } a.update(dt); S.clipSt = st; }
    else { a.pose(P, 12, rdt); a.update(); }
    E.mpSend({ ph: S.phase, s: S.s, d: S.d, y: a.g.position.y + S.s * S.SL - V(S.s), roll, head: S.head, pitch: S.pitch, fr: S.fr || 0, spin: S.spin, flip: S.flip, cork: S.cork || 0, tr: act ? act.T[0] : S.phase === 'air' && S.trick === OOPS ? 'OOPS' : '', gk: act && act.T[4] ? act.T[4] : '', gkk, pts: S.pts, n: S.airN || 0, cl: S.clip || '', cs: S.clipSt ? clipFor(S.clipSt)[1] : 1 });
    if (S.ghost && E.MP.on) this.friendGhost(E, t, rdt);
    else if (S.ghost && E.friend && E.friend.p != null) { const gs = E.friend.p * S.L; S.ghost.g.visible = true; S.ghost.g.position.set(X(gs) - S.d * 0.8, -gs * S.SL + V(gs) + pipeY(Math.abs(S.d * 0.8)), gs); S.ghost.g.rotation.set(0, 0, -Math.sign(S.d) * wallAng(Math.abs(S.d * 0.8))); S.ghost.pose(this.ridePose(t + 1, 0.5), 8, rdt); S.ghost.update(); }
    const nx = FEAT.find((f) => (f.k === 'pipe' ? !(S.pN >= HITS && S.phase !== 'cross' && S.phase !== 'air') : f.k === 'big' ? !S.b1 || S.phase === 'bair' : !S.done[f.id] || (S.kick === f && S.phase === 'kair') || (S.rail === f && S.phase === 'rail')));
    const where = !nx ? 'FINISH' : nx.k === 'big' ? 'BIG AIR' : nx.k === 'pipe' ? `HALFPIPE · AIR ${Math.min(HITS, S.pN + (S.phase === 'air' ? 0 : 1))} OF ${HITS}` : nx.name;
    E.hud(`${Math.round(S.shown ?? S.pts)}`, where); E.progress(Math.min(1, S.s / STOP_Z));
    this.camera(E, rdt);
  },
  // (2026-11-25, the user: "animate the character when he's driving forward so he has knees bent and looking focused with his hands more from
  // his body; look up some snowboard poses") a real riding stance (the guides: knees and ankles flexed, low and centred over the board, head up
  // looking ahead down the hill, shoulders in line with the board, the front hand out over the nose and the back hand out over the tail for
  // balance). Slow, small breathing and arm sway only: lively, never jittery. crouch 0..1 = how low (deeper into a take-off or a landing).
  ridePose(t, crouch) { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    const c = 0.62 + 0.3 * crouch, br = Math.sin(t * 2.1), sw = Math.sin(t * 1.3 + 0.7);
    p.legL = [-c * 0.72, 0, 0.36]; p.legR = [-c * 0.72, 0, -0.36]; p.kneeL = [c * 1.5, 0, 0]; p.kneeR = [c * 1.5, 0, 0]; p.ankleL = [-c * 0.78, 0, -0.26]; p.ankleR = [-c * 0.78, 0, 0.26];
    p.hips = [0, FRONT * 0.12, 0]; p.spine = [0.3 + crouch * 0.16 + 0.015 * br, FRONT * 0.22, 0]; p.neck = [-0.12, FRONT * 0.2, 0]; p.head = [-0.3, FRONT * 0.62, 0];
    // the arms out from the body: the front one higher, reaching over the nose; the back one lower, out over the tail
    const fa = [-0.75 + 0.04 * sw, 0, 1.25], ba = [0.25 - 0.04 * sw, 0, 1.05];
    if (FRONT > 0) { p.armL = fa; p.armR = [ba[0], 0, -ba[2]]; } else { p.armR = [fa[0], 0, -fa[2]]; p.armL = ba; }
    p.elbowL = [-0.38, 0, 0]; p.elbowR = [-0.38, 0, 0];
    p.y = -0.12 - crouch * 0.08 + 0.006 * br; return p; },
  // (2026-11-25, the user: "when you go with your friend you are going behind each other like when you land the first jump hes already leaving
  // the ground for that same jump like that far from each other") the friend's run is kept by where they were on the course (metres down the
  // pipe), and shown GAP metres behind us: their own airs, tricks and grabs at the same spots. If they are really further back, they are shown
  // where they really are.
  friendGhost(E, t, rdt) {
    const G = S.ghost, F = E.mpFriend, { THREE } = E; if (!F || !E.MP.alive) { G.g.visible = false; return; }
    const B = S.fbuf;
    if (F.at !== S.fAt && F.ph && F.ph !== 'menu' && F.ph !== 'drop' && F.s != null) { S.fAt = F.at; if (!B.length || F.s >= B[B.length - 1].s) B.push(Object.assign({}, F)); }
    if (!B.length) {   // (the friend is still at the top: standing there, until they drop in)
      if (S.phase === 'menu' || S.phase === 'drop' || F.ph === 'menu' || F.ph === 'drop') { G.g.visible = true; G.g.position.set(-2.2, -1 * S.SL, 1); G.g.rotation.set(0, 0, 0); G.g.rotateX(SLA()); if (G.isClip) { G.want('stance_idle'); G.update(rdt); } else { G.pose(this.ridePose(t + 0.7, 0), 8, rdt); G.update(); } }
      else G.g.visible = false;
      return; }
    const want = S.s - GAP; let A0, A1, k = 0;
    if (B[B.length - 1].s <= want) A0 = A1 = B[B.length - 1]; else if (B[0].s >= want) A0 = A1 = B[0];
    else { let lo = 0, hi = B.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m].s <= want) lo = m; else hi = m; } A0 = B[lo]; A1 = B[hi]; k = (want - A0.s) / Math.max(1e-4, A1.s - A0.s); }
    const same = A0.ph === A1.ph, L = (p) => (A0[p] ?? 0) + ((A1[p] ?? 0) - (A0[p] ?? 0)) * k, Fr = k < 0.5 ? A0 : A1, Ang = (p) => (same ? L(p) : Fr[p] || 0);
    const gs = L('s'), pos = new THREE.Vector3(X(gs) + L('d'), -gs * S.SL + L('y') + V(gs), gs);   // (R3: the same route on both phones)
    if (!S.gOn || G.g.position.distanceTo(pos) > 12) G.g.position.copy(pos); else G.g.position.lerp(pos, 1 - Math.exp(-rdt * 16)); S.gOn = true;
    G.g.visible = G.g.position.distanceTo(E.camera.position) > 5;   // (never right in front of the camera: it would cover the question)
    G.g.rotation.set(0, 0, 0); G.g.rotateX(SLA()); G.g.rotateZ(Ang('roll')); G.g.rotateY(Ang('head')); G.g.rotateX(-Ang('pitch')); if (Ang('fr')) G.g.rotateZ(Ang('fr'));
    const air = !!AIRS[Fr.ph]; if (G.fox) G.fox.root.rotation.x = E.damp(G.fox.root.rotation.x, air || Fr.ph === 'stop' ? 0 : LEAN, 6, rdt);
    if (air) { G.g.rotateY(Ang('spin')); G.g.rotateZ(Ang('cork')); G.g.rotateX(Ang('flip')); }
    if (G.isClip) { if (Fr.cl && Fr.cl !== G.cur) G.want(Fr.cl, Fr.cl.startsWith('grab_') ? 0.1 : 0.18, Fr.cs || 1); G.update(rdt); }
    else { const P = air && Fr.gk && Fr.gkk > 0.05 ? this.grabPose(t + 0.5, Fr.gk, Fr.gkk) : Fr.ph === 'stop' ? E.SP.cheer(t) : this.ridePose(t + 0.7, air ? 0.6 : Fr.ph === 'rail' ? 0.5 : 0.25); G.pose(P, 12, rdt); G.update(); }
    const key = Fr.n + ':' + Fr.tr;
    const sp = G.g.position.clone().setY(G.g.position.y + 1.6).project(E.camera), onScr = sp.z < 1 && Math.abs(sp.x) < 0.6 && Math.abs(sp.y) < 0.8;   // (only over the friend when they are in view)
    if (air && Fr.tr && key !== S.fTrickK && onScr && !document.body.classList.contains('asking')) { S.fTrickK = key; E.pop(Fr.tr === 'OOPS' ? `${E.MP.fname}: OOPS!` : `${E.MP.fname}: ${Fr.tr}`, G.g.position.clone().setY(G.g.position.y + 1.6), Fr.tr === 'OOPS' ? 'bad' : 'good'); }
  },
  // the grabs: one hand on the board, the body tucked; k blends from the riding stance into the grab and back
  grabPose(t, kind = 'indy', k = 1) { const r = this.ridePose(t, 1), p = this.ridePose(t, 1);
    p.legL = [-1.2, 0, 0.3]; p.legR = [-1.2, 0, -0.3]; p.kneeL = [1.9, 0, 0]; p.kneeR = [1.9, 0, 0]; p.spine = [0.5, 0, 0]; p.y = 0.05;
    if (kind === 'indy') { p.armR = [-1.3, 0, -0.15]; p.elbowR = [-0.3, 0, 0]; p.armL = [-0.2, 0, 1.6]; p.elbowL = [-0.2, 0, 0]; }
    else if (kind === 'melon') { p.armL = [-1.3, 0, 0.15]; p.elbowL = [-0.3, 0, 0]; p.armR = [-0.2, 0, -1.6]; p.elbowR = [-0.2, 0, 0]; p.head = [-0.1, -0.4, 0]; }
    else if (kind === 'tail') { p.armR = [0.9, 0, -0.5]; p.elbowR = [-0.2, 0, 0]; p.armL = [-0.4, 0, 1.5]; p.spine = [0.2, -0.3, 0]; p.legL = [-0.9, 0, 0.3]; p.legR = [-1.5, 0, -0.3]; }
    else if (kind === 'method') { p.spine = [-0.35, 0, 0]; p.legL = [-0.4, 0, 0.3]; p.legR = [-0.4, 0, -0.3]; p.kneeL = [2.2, 0, 0]; p.kneeR = [2.2, 0, 0]; p.armL = [0.6, 0, 0.3]; p.elbowL = [-0.6, 0, 0]; p.armR = [-0.6, 0, -1.9]; p.head = [-0.4, 0.3, 0]; }
    else if (kind === 'stale') { p.armR = [0.4, 0, -0.9]; p.elbowR = [-0.5, 0, 0]; p.armL = [-0.5, 0, 1.7]; p.spine = [0.6, 0.2, 0]; }
    for (const j in p) if (Array.isArray(p[j])) p[j] = p[j].map((v, i) => r[j][i] + (v - r[j][i]) * k); p.y = r.y + (p.y - r.y) * k; return p; },
  camera(E, rdt) {
    const { THREE } = E, P = S.a.g.position; S.shotT += rdt;
    let pos, look, k = 4, fov = 60;
    // (2026-11-26, Michal: "Make it that its from bhind like always roght now hes too on the left or right but i want him centered":
    // the camera is always behind him; the older side cameras for the air, the kicker and the big air are gone)
    if (S.fall > 0 && (S.phase === 'end' || S.phase === 'line') && !(S.phase === 'line' && KICKS.some((K) => S.s > K.s - 4 && S.s < K.s + K.len + K.T * 8.5 + 2))) {   // (2026-11-26: a crash after the big air or on the run: framed on him, never off the edge)
      pos = new THREE.Vector3(X(P.z - 4.8) + (P.x - X(P.z)) * 0.9 + 1.6, P.y + 2.1, P.z - 4.8); look = P.clone().setY(P.y + 0.5); k = 6; fov = 54;   // (from behind and a little to the side, close)
    } else if (S.phase === 'stop') {
      pos = new THREE.Vector3(P.x - 2.6, P.y + 1.6, P.z - 3.6); look = P.clone().setY(P.y + 0.8); k = 3; fov = 50;   // (behind him on the side he faces: his cheer and face still show)
    } else {
      // following down the course, a little above (higher and further back on the run-in to the huge kicker, so it towers ahead)
      const big = !S.b1 && S.phase === 'line' && S.s > BIG.s - 40;   /* (R2: the big air's run-in, wherever it is) */
      const inPipe = S.phase === 'cross';
      // behind him, following his line across the pipe (a little less than he moves, so the walls still read), and aimed THROUGH him:
      // the look point is on the line from the camera through Foxino, so he sits in the horizontal centre on the walls, in the air,
      // on landings, the run-ins and the big air. (From where the camera is now, so a quick move across the pipe never leaves him off-centre.)
      const wide = S.phase === 'air' || inPipe || Math.abs(P.x) > 2, air = S.phase === 'air', back = big ? 8.5 : air ? 8.4 : 6.2, ahead = big ? 8 : 4;
      const lim = wide ? W() * 0.7 : 99;   // (never out over the lip among the trees: inside the pipe)
      const rel = P.x - X(S.s); pos = new THREE.Vector3(X(S.s - back) + Math.max(-lim, Math.min(lim, rel * (wide ? 0.82 : 0.9))),   /* (R3: on the route behind him, so through a turn it follows the path) */ air ? Math.max(S.R * 0.55 - S.s * S.SL, P.y - 1.6) : P.y + (big ? 3.4 : 2.6), S.s - back);   /* (in the air: from behind and a little below, so he flies against the sky, not the trees) */
      { const cz = pos.z, R = RAILS.find((r) => cz > r.a - 1 && cz < r.b + 1); if (R) { const top = -cz * S.SL + V(cz) + railH(R, Math.max(R.a, Math.min(R.b, cz))) + 0.2; pos.y = Math.max(pos.y, top + 2.2); } }   // (never sitting on a rail (the rainbow arch passed just under the lens): over it)
      look = new THREE.Vector3(P.x, P.y + (big ? 1.6 : 0.7), P.z + ahead); k = wide ? (innerWidth < innerHeight ? 11 : 7) : 5; fov = air && innerWidth > innerHeight ? 50 : 60;   /* (a portrait phone: a narrow screen shows any lag, so it keeps up faster) */
    }
    if (inGap(pos.z)) { const cx = X(pos.z), lim2 = gapHW(pos.z) - 2; pos.x = cx + Math.max(-lim2, Math.min(lim2, pos.x - cx)); }   // (R4: never inside the rock walls)
    // every shot aims THROUGH him, seen from where the camera is now (so he stays in the horizontal centre even while the camera moves)
    const C = E.camera.position, dx = P.x - C.x, dz = P.z - C.z, dl = Math.hypot(dx, dz);
    // (the aim point is put at his own distance, the height scaled to keep the same tilt: it moves exactly with him, never swings wider)
    if (dl > 0.5) { const L = Math.max(0.5, Math.hypot(look.x - C.x, look.z - C.z)), f = dl / L; look.y = C.y + (look.y - C.y) * f; look.x = P.x; look.z = P.z; }
    // (the camera smooths its aim, which trails a fast rider by speed / rate: aim that far ahead along his sideways motion, so he stays centred)
    const CV = S.camV || (S.camV = { x: 0, px: P.x, ok: false }); if (rdt > 0) { const vx = CV.ok ? (P.x - CV.px) / rdt : 0; CV.x = E.damp(CV.x, Math.max(-25, Math.min(25, vx)), 12, rdt); CV.px = P.x; CV.ok = true; }
    look.x += CV.x / (k * 1.6);
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
    signPlace(E);   // (H33: the question's 3D sign)
  },
};
function smoothStep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
