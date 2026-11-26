import { makeFlame } from './flamekit.js?v=1';   // (2026-11-27, R8: Patrik's Flame Kit, copied from Foxino Adventures, for the igloo's campfire)
// HALFPIPE (the snowboard run): a night course under the floodlights, top to bottom. (2026-11-25, the user: "make there more
// jumps starting with classic jump going on to sliding bar going on to 3 question U ramp and finishing of with 2 question big jump")
//   (2026-11-25, then: "you need to answer a question on the first jump and on the bar. Dont make it all in u ramp make the first and last
//   section outside and the last jump should appear a lot bigger")
//   1. a classic kicker (a question in the air)   2. a candy-cane rail (a question on it): both on the open slope   3. the U-ramp: 3 airs,
//   a question at the top of each   4. out on the open slope again: the BIG AIR, a huge kicker, one long jump, 2 questions in the air. Right words = big tricks (bigger with every right answer in a row); highest score wins.
// With a friend: each phone shows the friend one kicker-length behind (when you land the first jump, they are just leaving its lip).
// (2026-11-25, the user: "longer map surrounded by deep forest, with more unique jumps, so one run equals 12 questions") the course, top to
// bottom: kicker · candy-cane rail · box · table-top · the halfpipe (3 airs) · rainbow rail · gap jump · step-up · the BIG AIR (2 questions)
const HITS = 5, QN = 15;   // (the pipe airs; all the questions)   (2026-11-27, S3, Michal: "Make each now 15 questions long": 3 → 5 pipe airs + the FUN BOX = 15)
const FEAT = [   // the open-slope features in order (s/a: metres down the hill). kick = a kicker (a question in the air), rail = a rail or box (a question on it)
  { k: 'kick', id: 'k1', name: 'KICKER', s: 16, len: 4, lip: 1.0, w: 3.6, back: 1.4, T: 1.05, H: 1.4, lipC: 0x36b5e0 },
  { k: 'rail', id: 'r1', name: 'RAIL', a: 44, b: 57, h: 0.5, look: 'cane' },
  { k: 'rail', id: 'r2', name: 'BOX', a: 72, b: 85, h: 0.42, look: 'box' },
  { k: 'kick', id: 'k2', name: 'TABLE TOP', s: 100, len: 4.5, lip: 1.3, w: 5, table: 6, back: 1.8, T: 1.45, H: 1.9, lipC: 0xffb020, spon: 'face' },
  { k: 'pipe', id: 'p', name: 'HALFPIPE' },
  { k: 'rail', id: 'r4', name: 'FUN BOX', a: 0, b: 12, h: 0.5, look: 'box' },   // (S3: a 4th rail section)
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
// (2026-11-27, S2, Michal: "add tricks on pipes & bars for right answers") a real jib for every right word on a rail/box, climbing with the streak:
// [name, yaw on the rail (0 = along it, ±π/2 = across), points, clip, entry ('shifty' | '270'), exit ('270')]; a turned-round trick (tail press,
// tailslide) is the same clip with the yaw half a turn on. Entry and exit are a hop with the turn; the clip holds the balanced middle.
const RAIL_TRICKS = [['50-50', 0, 100, 'ride'], ['BOARDSLIDE', Math.PI / 2, 150, 'boardslide'], ['NOSE PRESS', 0, 200, 'press'], ['LIPSLIDE', -Math.PI / 2, 240, 'boardslide'],
  ['SHIFTY 50-50', 0, 280, 'ride', 'shifty'], ['TAIL PRESS', Math.PI, 320, 'press'], ['NOSESLIDE', Math.PI / 2, 380, 'noseslide'], ['TAILSLIDE', -Math.PI / 2, 440, 'noseslide'],
  ['270 ON BOARDSLIDE', Math.PI / 2, 520, 'boardslide', '270'], ['BACK LIPSLIDE 270 OUT', -Math.PI / 2, 600, 'boardslide', '', '270'], ['270 ON NOSESLIDE 270 OUT', Math.PI / 2, 720, 'noseslide', '270', '270']];
// the clips the new rider may not have (S2 folded some in): a stand-in that looks right
const CLIPSUB = { takeoff: ['windup_flip', 1], air_tuck: ['grab_indy', 0.2], press: ['ride', 1], noseslide: ['boardslide', 1], shifty: ['ride', 1] };
const clipOr = (has, name, sp = 1) => (!has || has[name] || !CLIPSUB[name]) ? [name, sp] : [CLIPSUB[name][0], sp * CLIPSUB[name][1]];
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
// halfpipe (3 airs; 5 since S3) and the BIG AIR (2 questions) = always 12 questions (15 since S3, with the FUN BOX). Never 3 kickers or 3 rails in a row; never the same order twice
// in a row (solo: remembered on this phone; a party: both phones build the SAME course from the party code + round; ?seed=123 repeats one).
// Each section gets the room its airs need (the run-in for the question, the air in slow motion, the landing), so the joins are always rideable.
const SECT = FEAT.slice(), RLEN = Object.fromEntries(RAILS.map((r) => [r.id, r.b - r.a]));
// (2026-11-27, S5, Michal: "Norway will be part freeride and part normal jumps and pipes. In the freeride part you will go through a narrow path
// in the forest, then do some natural jumps, and instead of a pipe there will be a fallen log over a (frozen) river") NORWAY = two halves, each in a
// random order: the PARK (kicker, rail, box, table top, the U-ramp: 9 questions), then the FREERIDE down a narrow winding forest path (a rock drop,
// a wind lip, a log kicker, the fallen log over the frozen river: 4), out of the trees over THE CORNICE (a big natural jump: 2) = 15.
const PARK = SECT.filter((F) => ['k1', 'r1', 'r2', 'k2', 'p'].includes(F.id));
const NFEAT = [
  { k: 'kick', id: 'n1', name: 'ROCK DROP', s: 0, len: 3.6, lip: 1.2, w: 4.2, back: 0.9, T: 1.25, H: 1.8, lipC: 0xdfe8ff, look: 'rock', fr: 1 },
  { k: 'kick', id: 'n2', name: 'WIND LIP', s: 0, len: 5, lip: 1.4, w: 5.2, back: 2.4, T: 1.35, H: 1.9, lipC: 0xffffff, look: 'wind', fr: 1 },
  { k: 'kick', id: 'n3', name: 'LOG KICKER', s: 0, len: 4, lip: 1.1, w: 4.2, back: 1.3, T: 1.15, H: 1.6, lipC: 0x8a5a32, look: 'log', fr: 1 },
  { k: 'rail', id: 'lg', name: 'FALLEN LOG', a: 0, b: 14, h: 0.55, look: 'log', fr: 1 }];
const NBIG = { k: 'big', id: 'big', name: 'THE CORNICE' }; RLEN.lg = 14;
const PG = 12;   // (the forest path: extra room before every freeride section, for the path to wind)
// (2026-11-27, S6, Michal: "In Alaska it will be mostly freeride, so lots of natural jumps, riding through an ice cave") ALASKA = no park: 10 natural
// jumps down the big mountain (wind lips, rock drops, pillow lines, spines, a cornice drop, a step-down), a FALLEN SPRUCE to slide, the ICE CAVE (a
// glowing glacier cave on a detour: an ICE LIP to pop and an ICE LEDGE to slide inside), and THE BIG LINE (a huge cornice: 2) = 15. Random order;
// the cave never first; jumps may follow jumps (it is freeride).
const AFEAT = [
  { k: 'kick', id: 'a1', name: 'WIND LIP', s: 0, len: 5, lip: 1.4, w: 5.2, back: 2.4, T: 1.35, H: 1.9, look: 'wind' },
  { k: 'kick', id: 'a2', name: 'ROCK DROP', s: 0, len: 3.6, lip: 1.2, w: 4.2, back: 0.9, T: 1.25, H: 1.8, look: 'rock' },
  { k: 'kick', id: 'a3', name: 'PILLOW LINE', s: 0, len: 4.2, lip: 1.15, w: 4.6, back: 1.6, T: 1.2, H: 1.7, look: 'pillow' },
  { k: 'kick', id: 'a4', name: 'SPINE', s: 0, len: 4.4, lip: 1.3, w: 3.0, back: 1.4, T: 1.3, H: 1.8, look: 'spine' },
  { k: 'kick', id: 'a5', name: 'CORNICE DROP', s: 0, len: 4.6, lip: 1.5, w: 5.6, back: 1.0, T: 1.4, H: 2.0, look: 'cornice' },
  { k: 'kick', id: 'a6', name: 'BIG ROCK DROP', s: 0, len: 4, lip: 1.6, w: 4.6, back: 1.0, T: 1.45, H: 2.1, look: 'rock' },
  { k: 'kick', id: 'a7', name: 'SNOW PILLOW', s: 0, len: 3.8, lip: 1.0, w: 4.4, back: 1.4, T: 1.1, H: 1.5, look: 'pillow' },
  { k: 'kick', id: 'a8', name: 'RIDGE HIT', s: 0, len: 4.4, lip: 1.3, w: 3.2, back: 1.4, T: 1.3, H: 1.8, look: 'spine' },
  { k: 'kick', id: 'a9', name: 'WIND SCOOP', s: 0, len: 5, lip: 1.5, w: 5.4, back: 2.4, T: 1.4, H: 2.0, look: 'wind' },
  { k: 'kick', id: 'a10', name: 'STEP-DOWN', s: 0, len: 3.8, lip: 1.2, w: 4.4, back: 0.9, T: 1.3, H: 1.8, look: 'rock' },
  { k: 'kick', id: 'ic', name: 'ICE LIP', s: 0, len: 4, lip: 1.1, w: 4.2, back: 1.3, T: 1.15, H: 1.6, look: 'icelip', cave: 1 },
  { k: 'rail', id: 'sp', name: 'FALLEN SPRUCE', a: 0, b: 14, h: 0.55, look: 'log' },
  { k: 'rail', id: 'il', name: 'ICE LEDGE', a: 0, b: 12, h: 0.5, look: 'ice', cave: 1 }];
const ABIG = { k: 'big', id: 'big', name: 'THE BIG LINE' }; RLEN.sp = 14; RLEN.il = 12;
const rng32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hashStr = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const okOrder = (o) => { for (let i = 2; i < o.length; i++) if (o[i].k === o[i - 1].k && o[i].k === o[i - 2].k) return false; return true; };
const orderKey = (o) => o.map((f) => f.id).join(',');
function shuffleOrder(seed) { const r = rng32(seed), sh = (L) => { const o = L.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }, nor = S.loc && S.loc.id === 'norway';
  if (S.loc && S.loc.id === 'alaska') { const o = sh(AFEAT.filter((F) => !F.cave)), cv = sh(AFEAT.filter((F) => F.cave)); o.splice(1 + Math.floor(r() * (o.length - 1)), 0, ...cv); return [...o, ABIG]; }   // (S6: the cave's two sections together, never first)
  for (let n = 0; n < 400; n++) { const o = nor ? [...sh(PARK), ...sh(NFEAT), NBIG] : sh(SECT); if (okOrder(o)) return o; } return nor ? [...PARK, ...NFEAT, NBIG] : SECT.slice(); }   // (S5: Norway = the park half, then the freeride half, the cornice last)
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
const gapHW = (z) => S.gap && (S.gap.kind === 'tunnel' || S.gap.kind === 'forest' || S.gap.kind === 'icecave') ? S.gap.hw : 14 - 8 * gapClose(z);   // (the half-width between the walls: 14 at the mouths, ~6 in the middle: a narrow passage, the ride line clear)
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
// (2026-11-27, R5, Michal: "one time ti can go to left through some snowtunel a here are bars to slide on") THE SNOW TUNNEL: the left detour
// runs through a tunnel carved in deep snow: a rounded snowy shell outside, an icy blue arch inside (a soft glow), thick snowy mouths, icicles at
// both ends, cool lanterns and glints on the ice, two of the floodlight glows inside (tinted blue). It holds the course's rails (1–2): their
// questions (on the approach, in slow motion) and S2's jib tricks work as everywhere. The camera stays under the roof and inside the walls.
// (S6) {ice: true} = Alaska's ICE CAVE in a glacier: glowing deep-blue ice walls with pale streaks, a glacier-blue shell, many more icicles, shafts of
// light falling through cracks in the roof (no lanterns), its own blue glows. The same shape and camera rules as the snow tunnel.
function makeTunnel(E, g, Z, opt = {}) {
  const ic = !!opt.ice, { THREE } = E, G = S.gap, hw = G.hw, H = G.h, N = 14, inner = [], outer = [], ci = [], co = [], C = new THREE.Color(), iceA = new THREE.Color(ic ? 0x2f8fe0 : 0x8ccaf5), iceB = new THREE.Color(ic ? 0x9fe8ff : 0xd2ecff), snowC = new THREE.Color(ic ? 0xcfe8ff : 0xf1f5ff), rows = [];
  for (let z = G.zA; z <= G.zB + 0.01; z += 2.5) { const cx = X(z), base = gY(cx, z) - 0.35, ri = [], ro = [];
    for (let k = 0; k <= N; k++) { const th = Math.PI * k / N, wob = 1 + (hsh(z, k) - 0.5) * 0.06;
      ri.push([cx + hw * wob * Math.cos(th), base + H * Math.sin(th) * (0.97 + hsh(z, k + 30) * 0.06), z]);
      ro.push([cx + (hw + 2.4 + hsh(z, k + 60) * 0.8) * Math.cos(th), base - 0.4 + (H + 2.6 + hsh(z, k + 90) * 0.8) * Math.sin(th), z]); }
    rows.push([ri, ro]); }
  const quad = (P, Cs, a, b, c, d, col) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) Cs.push(col.r, col.g, col.b); };
  for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < N; k++) { const A = rows[r], B = rows[r + 1];
    C.copy(iceA).lerp(iceB, hsh(r, k)); if (hsh(k, r + 5) > 0.93) C.lerp(snowC, 0.7); quad(inner, ci, A[0][k], B[0][k], B[0][k + 1], A[0][k + 1], C.clone());
    C.copy(snowC).multiplyScalar(0.94 + hsh(r, k + 7) * 0.06); quad(outer, co, A[1][k], A[1][k + 1], B[1][k + 1], B[1][k], C.clone()); }
  for (const r of [0, rows.length - 1]) for (let k = 0; k < N; k++) { const R = rows[r]; C.copy(snowC); quad(outer, co, R[0][k], R[1][k], R[1][k + 1], R[0][k + 1], C.clone()); }   // (the two mouths: thick snowy arches)
  const mk = (P, Cs, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(Cs, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = true; m.userData.noCast = true; g.add(m); E.far(m); return m; };
  mk(inner, ci, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ic ? 0.12 : 0.25, metalness: 0.1, flatShading: true, side: THREE.DoubleSide, emissive: ic ? 0x2470d0 : 0x1d4a80, emissiveIntensity: ic ? 0.95 : 0.55 }));
  mk(outer, co, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }));
  // icicles hanging from the roof near both mouths, cool lanterns along the walls, glints on the ice
  const ice = [], lamps = [], glint = [], shafts = [], M4 = new THREE.Matrix4();
  for (let r = 0; r < rows.length; r++) { const z = rows[r][0][0][2], nearMouth = r < 4 || r > rows.length - 5;
    for (let k = 3; k <= N - 3; k++) { if (hsh(r, k + 11) < (ic ? (nearMouth ? 0.25 : 0.55) : nearMouth ? 0.45 : 0.85)) continue; const p = rows[r][0][k]; ice.push([p[0], p[1] - 0.05, z, 0.5 + hsh(r, k + 12) * (nearMouth ? 1.3 : 0.7)]); }
    if (!ic && r % 5 === 2) for (const k of [2, N - 2]) { const p = rows[r][0][k], cx = X(z); lamps.push([p[0] + (cx - p[0]) * 0.06, p[1], z]); }
    if (ic && r % 5 === 3 && r > 1 && r < rows.length - 2) shafts.push([X(z) + (r % 10 === 3 ? 2.4 : -2.6), gY(X(z), z) - 0.3, z]);
    for (let k = 1; k < N; k++) if (hsh(r, k + 40) > 0.82) { const p = rows[r][0][k], cx = X(z); glint.push(p[0] + (cx - p[0]) * 0.02, p[1] - 0.05, z); } }
  const icg = new THREE.ConeGeometry(0.12, 1, 5); icg.translate(0, -0.5, 0); const icm = new THREE.InstancedMesh(icg, new THREE.MeshStandardMaterial({ color: 0xd6f0ff, roughness: 0.15, metalness: 0.1, emissive: 0x2a5a8a }), Math.max(1, ice.length));
  ice.forEach(([x, y, z, l], i) => icm.setMatrixAt(i, M4.makeScale(1, l, 1).setPosition(x, y, z))); icm.count = ice.length; icm.userData.noCast = true; g.add(icm); E.far(icm);
  const lm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc4ecff, toneMapped: false }), Math.max(1, lamps.length)); lamps.forEach(([x, y, z], i) => lm.setMatrixAt(i, M4.makeTranslation(x, y, z))); lm.count = lamps.length; lm.userData.noCast = true; g.add(lm); E.far(lm);
  if (shafts.length) { const sg = new THREE.CylinderGeometry(0.45, 1.5, H, 10, 1, true); sg.translate(0, H / 2, 0); const sm = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xcdefff, transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), shafts.length);
    shafts.forEach(([x, y, z], i) => sm.setMatrixAt(i, M4.makeTranslation(x, y, z))); sm.userData.noCast = true; g.add(sm); }   // (S6: light falling through the cracks in the roof)
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(glint, 3)); const pts = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false })); pts.userData.noCast = true; g.add(pts);
}
// (2026-11-27, R6, Michal: "one time to the right and right to deive through igluu ... you just ride and break thriugh their wall on the way out
// on the way in youre going theough entrence") THE IGLOO: on the right detour he rides IN through the igloo's entrance tunnel, across the round
// inside (snow blocks, warm light, furs, a little table and pots), and SMASHES OUT through the far wall: the blocks burst outward (pooled chunks),
// a snow puff, a crunch, a short slow-motion moment. Every igloo run; never tied to an answer. A clear spot beside his line waits for the fire and
// the people (R7/R8): a placeholder glow for now. The camera comes lower and closer round the igloo, so it never touches the dome or the tunnel.
const IG = { wall: null, deb: null, vel: [], t: -1, grp: null };
function makeIgloo(E, g, Z) {
  const { THREE } = E, G = S.gap, Rd = G.R, cx = X(G.cz), grp = new THREE.Group(); grp.position.set(cx, gY(cx, G.cz) - 0.15, G.cz); grp.rotation.x = Math.atan(S.SL); IG.grp = grp;
  const blockC = (i, j, k = 0) => new THREE.Color().setHSL(0.58, 0.25 + 0.1 * hsh(i, j + k), 0.9 + 0.07 * hsh(j, i + k));
  // the dome: snow blocks (a hemisphere, flat-shaded, block-coloured rows), with the entrance and the exit openings cut out
  const sg = new THREE.SphereGeometry(Rd, 44, 12, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), P = sg.attributes.position, cols = [], keep = [];
  for (let t = 0; t < P.count; t += 3) { let mx = 0, my = 0, mz = 0; for (let k = 0; k < 3; k++) { mx += P.getX(t + k) / 3; my += P.getY(t + k) / 3; mz += P.getZ(t + k) / 3; }
    let cut = false; for (let k = 0; k < 3; k++) if (Math.abs(P.getX(t + k)) < 2.5 && P.getY(t + k) < 4.1) cut = true; if (cut) continue;   // (the doorway in and the hole out: every face touching the way through)
    const c = blockC(Math.round(my * 1.4), Math.round(Math.atan2(mx, mz) * 4)); for (let k = 0; k < 3; k++) { keep.push(P.getX(t + k), P.getY(t + k), P.getZ(t + k)); cols.push(c.r, c.g, c.b); } }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); dg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); dg.computeVertexNormals();
  const dome = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide, emissive: 0x3a2a1a, emissiveIntensity: 0.35 })); dome.userData.noCast = true; grp.add(dome);
  // the entrance tunnel (a half-pipe of blocks on the uphill side)
  const tg = new THREE.CylinderGeometry(2.6, 2.6, 7, 12, 3, true, Math.PI / 2, Math.PI); tg.rotateX(Math.PI / 2); tg.translate(0, 0, -Rd - 2.2);
  const tunnel = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xe9f1ff, roughness: 0.85, flatShading: true, side: THREE.DoubleSide })); tunnel.userData.noCast = true; grp.add(tunnel);
  // the far wall: separate blocks filling the exit hole (the ones that burst)
  const bg = new THREE.BoxGeometry(0.82, 0.62, 0.55), slots = [];
  for (let y = 0.35; y < 4.75; y += 0.64) for (let x = -2.95; x <= 2.96; x += 0.84) { const r2 = Rd * Rd - x * x - y * y; if (r2 <= 0) continue; slots.push([x + ((Math.round(y / 0.64) % 2) ? 0.2 : 0), y, Math.sqrt(r2)]); }
  const wall = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xf2f7ff, roughness: 0.8, flatShading: true }), slots.length), deb = new THREE.InstancedMesh(bg, wall.material, slots.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V0 = new THREE.Vector3(), One = new THREE.Vector3(1, 1, 1);
  slots.forEach(([x, y, z], i) => { Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V0.set(x, 0, z).normalize()); M4.compose(V0.set(x, y, z), Q, One); wall.setMatrixAt(i, M4); wall.setColorAt(i, blockC(i, 3)); });
  deb.visible = false; wall.userData.noCast = deb.userData.noCast = true; grp.add(wall, deb); IG.wall = wall; IG.deb = deb; IG.slots = slots; IG.t = -1;
  // inside: furs (rugs), a little table, pots, and the fire spot (a ring of stones + a warm glow) beside his line
  const fx = 4.4, fz = 0.5, rugM = [0x8a5a3a, 0x6e4a32, 0xa57148].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  for (const [x, z, r, m] of [[fx - 1.6, fz - 1.4, 1.3, 0], [fx + 0.6, fz + 1.9, 1.1, 1], [fx - 1.2, fz + 1.7, 1.0, 2], [-4.6, 2.5, 1.2, 1]]) { const rug = new THREE.Mesh(new THREE.CircleGeometry(r, 9), rugM[m]); rug.rotation.x = -Math.PI / 2; rug.position.set(x, 0.18, z); grp.add(rug); }
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4f2e, roughness: 0.9 }), table = new THREE.Group(), part = (geo, x, y, z) => { const m = new THREE.Mesh(geo, wood); m.position.set(x, y, z); table.add(m); }; part(new THREE.BoxGeometry(1.4, 0.1, 0.8), 0, 0.62, 0);
  for (const [a, b] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) part(new THREE.BoxGeometry(0.08, 0.6, 0.08), a, 0.3, b); table.position.set(-4.8, 0.15, -2.2); grp.add(table);
  const potM = new THREE.MeshStandardMaterial({ color: 0x3d3f52, roughness: 0.6, metalness: 0.3 }); for (const [x, z, s2] of [[-4.6, -2.1, 0.22], [-4.95, -2.35, 0.16], [-6.2, 0.8, 0.3], [6.4, -2.6, 0.26]]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(s2, s2 * 0.85, s2 * 1.4, 8), potM); pot.position.set(x, x === -6.2 || x === 6.4 ? 0.15 + s2 * 0.7 : 0.69 + s2 * 0.7, z); grp.add(pot); }
  // (2026-11-27, R8, Michal: "the fire should be copied from the source as it was in adventure game") Foxino Adventures' campfire, copied:
  // its fire pit (camp-firepit.glb: the ring of stones and the logs), Patrik's three flames (a big one and two smaller, the same offsets), the
  // embers floating up, the warm light flickering by the same formula; all ×2 (the Adventures camp is at a smaller scale). New here only: a
  // little smoke that rises and fades well under the roof.
  const SC = 2, base = 0.15; IG.flames = []; IG.embers = []; IG.smoke = [];
  // (as Adventures' inst() dresses a model: glow parts unlit and bright, the rest matte and flat-shaded; the tripod with its pot over the fire)
  const dressKit = (o) => o.traverse((m) => { if (!m.isMesh) return; m.castShadow = false; m.userData.noCast = true; const ms = Array.isArray(m.material) ? m.material : [m.material];
    m.material = ms.map((mt) => { mt = mt.clone(); if (/glow/i.test(mt.name)) return new THREE.MeshBasicMaterial({ color: mt.color, vertexColors: mt.vertexColors, toneMapped: false }); if (mt.isMeshStandardMaterial) { mt.roughness = Math.max(0.75, mt.roughness ?? 1); mt.metalness = Math.min(0.15, mt.metalness ?? 0); mt.flatShading = true; } return mt; }); if (m.material.length === 1) m.material = m.material[0]; });
  if (S.firepit) { const fp = S.firepit.clone(true); dressKit(fp); fp.scale.set(SC, SC * 1.35, SC); fp.position.set(fx, base + 0.006, fz); fp.rotation.y = 0.3; grp.add(fp); }   // (a little taller: it reads from the game's higher camera)
  if (S.tripod) { const tp = S.tripod.clone(true); dressKit(tp); tp.scale.setScalar(0.86 * SC); tp.position.set(fx, base + 0.006, fz); tp.rotation.y = 0.3; grp.add(tp); }
  else { const stoneM = new THREE.MeshStandardMaterial({ color: 0x55586a, roughness: 1, flatShading: true }); for (let i = 0; i < 8; i++) { const a2 = i * Math.PI / 4, st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneM); st.position.set(fx + Math.cos(a2) * 0.75, 0.25, fz + Math.sin(a2) * 0.75); grp.add(st); } }
  for (const [dx, dy, dz, sc, seed, map] of [[0, 0.08, 0, 1.25, 1, 0], [0.14, 0.06, -0.08, 0.85, 2, 1], [-0.13, 0.06, 0.07, 0.75, 3, 0]]) {
    const fk = makeFlame({ height: 0.5, width: 1, seed, map }), fg = new THREE.Group(); fk.object.position.y = -0.04; fg.add(fk.object); fg.position.set(fx + dx * SC, base + dy * SC, fz + dz * SC); fg.scale.setScalar(sc * SC); grp.add(fg); IG.flames.push(fk); }
  { const em = new THREE.MeshBasicMaterial({ color: '#ffb24a', toneMapped: false }), eg = new THREE.OctahedronGeometry(0.018 * SC, 0);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(eg, em); grp.add(m); IG.embers.push({ m, t: i / 12 * 2.4, x: (hsh(i, 1) - 0.5) * 0.2, z: (hsh(i, 2) - 0.5) * 0.2 }); } }
  { const c = document.createElement('canvas'); c.width = c.height = 64; const x2 = c.getContext('2d'), gr = x2.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(210,205,215,.55)'); gr.addColorStop(1, 'rgba(210,205,215,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
    const st = new THREE.CanvasTexture(c); for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0 })); grp.add(sp); IG.smoke.push({ sp, t: i / 8 * 3.2 }); } }
  IG.fire = { x: fx, y: base, z: fz, SC };
  g.add(grp); grp.traverse((o) => { if (o.isMesh && o !== wall && o !== deb) E.far(o); });   // (the wall and the debris switch on and off themselves: the far-culling would undo that)
  IG.fireWorld = new THREE.Vector3(fx, 1.6, fz).applyMatrix4(grp.matrixWorld.compose(grp.position, grp.quaternion, grp.scale));
}
function iglooFire(E, dt) {
  const F = IG.fire; if (!F) return; const T = E.T;
  for (const fk of IG.flames) fk.update(dt, E.camera);
  for (const e of IG.embers) { e.t = (e.t + dt) % 2.4; const k = e.t / 2.4; e.m.position.set(F.x + (e.x + Math.sin(T * 2 + e.t * 5) * 0.08 * k) * F.SC, F.y + (0.5 + k * 2.2) * F.SC * 0.8, F.z + e.z * F.SC); e.m.scale.setScalar(1 - k); }
  for (const p of IG.smoke) { p.t = (p.t + dt) % 3.2; const k = p.t / 3.2; p.sp.position.set(F.x + Math.sin(T * 0.7 + p.t * 3) * 0.3 * k, F.y + 1.6 + k * 2.6, F.z + Math.cos(T * 0.5 + p.t * 2) * 0.2 * k); p.sp.scale.setScalar(0.5 + k * 1.6); p.sp.material.opacity = 0.35 * Math.sin(Math.PI * k); }   // (gone by ~4.4 m: well under the roof)
  if (IG.light) { const k = 1 + Math.sin(T * 17) * 0.12 + Math.sin(T * 7.3) * 0.08; IG.light.intensity = IG.lightI * k; }   // (the Adventures flicker)
}
function iglooSmash(E) {   // the wall bursts: the blocks fly outward and down, a snow puff, a crunch, a short slow motion
  const { THREE } = E; if (!IG.wall || IG.t >= 0) return; IG.t = 0; IG.wall.visible = false; IG.deb.visible = true; IG.vel = IG.slots.map(([x, y, z]) => { const sx = Math.sign(x) || (Math.random() < 0.5 ? -1 : 1), mid = 1 - Math.min(1, Math.abs(x) / 3); return [sx * (1.4 + 2.6 * mid + Math.random() * 1.8), 3.8 + Math.random() * 3.6 + y * 0.4, 6 + Math.random() * 4, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10]; });   // (out to both sides and up: the middle clears, he bursts through with blocks flying round him)
  IG.pos = IG.slots.map((p) => p.slice()); IG.rot = IG.slots.map(() => [0, 0]);
  const at = new THREE.Vector3(0, 1.6, S.gap.R).applyMatrix4(IG.grp.matrixWorld); E.spray.emit(at, 60, 0, 3, 6, 2.6, 0.22); E.shake(0.55); try { E.sfx.thud && E.sfx.thud(); E.sfx.pop && E.sfx.pop(true); } catch (e) {}
  if (!S.asking) { E.slow = 0.5; setTimeout(() => { if (!S.asking && E.slow === 0.5) E.slow = 1; }, 700); }
}
function iglooTick(E, dt) {
  if (IG.t < 0 || !IG.deb) return; IG.t += dt; S.igT = IG.t; const { THREE } = E, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E3 = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  IG.pos.forEach((p, i) => { const v = IG.vel[i]; v[1] -= 9.8 * dt; p[0] += v[0] * dt; p[1] = Math.max(0.3, p[1] + v[1] * dt); p[2] += v[2] * dt; if (p[1] <= 0.3) { v[0] *= 0.9; v[2] *= 0.9; v[1] = Math.abs(v[1]) * 0.25; }
    IG.rot[i][0] += v[3] * dt; IG.rot[i][1] += v[4] * dt; const k = Math.max(0, 1 - Math.max(0, IG.t - 2.2) / 0.8); M4.compose(V.set(p[0], p[1], p[2]), Q.setFromEuler(E3.set(IG.rot[i][0], IG.rot[i][1], 0)), Sc.set(k, k, k)); IG.deb.setMatrixAt(i, M4); });
  IG.deb.instanceMatrix.needsUpdate = true; if (IG.t > 3.1) { IG.deb.visible = false; IG.t = 99; }
}
const ROUTES = [
  { id: 'straight', name: 'STRAIGHT DOWN', ready: true },
  { id: 'rockgap', name: 'THE ROCK GAP', side: -1, n: 2, ready: true, host: (F) => F.k === 'kick' || F.k === 'rail', dress: (E, g, Z) => makeRockGap(E, g, Z) },   // (R4)
  { id: 'tunnel', name: 'THE SNOW TUNNEL', side: 1, n: 2, ready: true, host: (F) => F.k === 'rail', dress: (E, g, Z) => makeTunnel(E, g, Z) },   // (R5: the rails (bars) ride inside)
  { id: 'igloo', name: 'THE IGLOO', side: -1, n: 0, len: 34, ready: true, host: () => false, dress: (E, g, Z) => makeIgloo(E, g, Z) },   // (R6: an empty zone: the igloo, in and smash out)
  { id: 'right', name: 'DETOUR RIGHT', side: -1, n: 2, test: true, host: (F) => F.k === 'kick' || F.k === 'rail' },
  { id: 'left', name: 'DETOUR LEFT', side: 1, n: 2, test: true, host: (F) => F.k === 'kick' || F.k === 'rail' },
  { id: 'forest', name: 'THE FOREST PATH', ready: true },
  { id: 'icecave', name: 'THE ICE CAVE', side: 1, n: 2, ready: true, host: (F) => !!F.cave, dress: (E, g, Z) => makeTunnel(E, g, Z, { ice: true }) }];   // (S6: Alaska's glacier cave on the left detour)   // (S5: Norway's own: the freeride half down the narrow forest path; laid out in layout())
// (2026-11-27, S4, Michal: "Make 3 different locations for it: Austria (current one), Norway, Alaska ... Before each game, let there be a little
// cutscene of the cart rotating and zooming on that location, the lighting, and you're riding") the LOCATION is picked first (the same seed:
// the same on both phones; never twice in a row once several are ready; ?loc=<id> for tests), then its routes and the order. Austria = the course
// as it was; Norway (S5) and Alaska (S6) get their own terrain, sky, light, scenery, parts and routes: set ready and fill them in.
const LOCS = [
  { id: 'austria', name: 'AUSTRIA', sub: 'The Tyrol Alps · night run', flag: ['#ef3340', '#ffffff', '#ef3340'], ready: true, routes: ['straight', 'rockgap', 'tunnel', 'igloo'] },
  { id: 'norway', name: 'NORWAY', sub: 'Fjord forest · the frozen river', flag: 'norway', ready: true, routes: ['forest'] },   // (S5)
  { id: 'alaska', name: 'ALASKA', sub: 'Big mountain · the ice cave', flag: 'alaska', ready: true, routes: ['icecave'] }];   // (S6)
function pickLoc(sd) {
  const want = new URLSearchParams(QALL).get('loc'), forced = want && LOCS.find((l) => l.id === want && l.ready); if (forced) return forced;
  const wr = new URLSearchParams(QALL).get('route'), rl = wr && LOCS.find((l) => l.ready && l.routes.includes(wr)); if (rl) return rl;   // (a test's ?route=igloo: the location that has it)
  const can = LOCS.filter((l) => l.ready); if (can.length === 1) return can[0];
  const at = (seed) => can[Math.floor(rng32(seed ^ 0x1b873593)() * can.length)];
  if (sd.fixed) return at(sd.cur);
  if (sd.party) { const prev = at(sd.prev); let l = at(sd.cur); for (let k = 1; l === prev && k < 9; k++) l = at(sd.cur + k); return l; }
  const last = lsGet('hp-loc'); let l = at(sd.cur); for (let k = 1; l.id === last && k < 12; k++) l = at(sd.cur + k * 7919); return l;
}
function pickRoute(sd, loc = LOCS[0]) {
  const want = new URLSearchParams(QALL).get('route'),   /* (also on the lobby's address: /sports/?route=right) */ forced = want && ROUTES.find((r) => r.id === want && (r.test || !loc || loc.routes.includes(r.id))); if (forced) return forced;
  const can = ROUTES.filter((r) => r.ready && !r.test && (!loc || loc.routes.includes(r.id))); if (can.length === 1) return can[0];
  const at = (seed) => can[Math.floor(rng32(seed ^ 0x5bd1e995)() * can.length)];
  if (sd.fixed) return at(sd.cur);
  if (sd.party) { const prev = at(sd.prev); let r = at(sd.cur); for (let k = 1; r === prev && k < 9; k++) r = at(sd.cur + k); return r; }   // (never the same route twice in a row)
  const last = lsGet('hp-route'); let r = at(sd.cur); for (let k = 1; r.id === last && k < 12; k++) r = at(sd.cur + k * 7919); return r;
}
// the path: a table down the hill of how far the course swings sideways (X) and its gentle rolls (V, a real run, not a flat strip)
const PZ0 = -140, PST = 0.25, PN = Math.round((1000 - PZ0) / PST) + 1, PX = new Float32Array(PN), PV = new Float32Array(PN);
const tab = (T, z) => { const f = Math.max(0, Math.min(PN - 1.001, (z - PZ0) / PST)), i = f | 0; return T[i] + (T[i + 1] - T[i]) * (f - i); };
const X = (z) => tab(PX, z), routeX = X, V = (z) => tab(PV, z), Xd = (z) => X(z + 0.5) - X(z - 0.5), Xdd = (z) => (X(z + 2) - 2 * X(z) + X(z - 2)) / 4, Vd = (z) => V(z + 0.5) - V(z - 0.5);
const bankAt = (z) => Math.max(-0.14, Math.min(0.14, 0.5 * Math.atan(72 * Xdd(z) / 9.8)));   // (the piste banks a little into a turn)
const ss5 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
const TURN = 45, SWING = 16;
function layout(o, route, seed) {
  // the detour: which shuffled sections ride inside its zone (n in a row that the zone can hold, never the first section)
  let i0 = -1, n = 0; if (route.side && route.n === 0) { const r = rng32(seed ^ 0x27d4eb2f); i0 = 1 + Math.floor(r() * (o.length - 1)); }   // (R6: an empty zone (the igloo) between two sections)
  else if (route.side) { const r = rng32(seed ^ 0x27d4eb2f), N = route.n || 1, cand = [];
    for (let i = 1; i + N <= o.length; i++) if (o.slice(i, i + N).every((F) => route.host(F))) cand.push(i);
    if (cand.length) { i0 = cand[Math.floor(r() * cand.length)]; n = N; } else { for (let i = 1; i < o.length; i++) if (route.host(o[i])) { i0 = i; n = 1; break; } } }
  const nor = S.loc && S.loc.id === 'norway', FR = { a: null, b: null }; S.forest = null; S.river = null;
  KICKS.length = 0; KICKS.push(...o.filter((F) => F.k === 'kick')); RAILS.length = 0; RAILS.push(...o.filter((F) => F.k === 'rail'));   // (S5: this run's sections)
  const ak = S.loc && S.loc.id === 'alaska'; S.wild = ak; PIPE_A = PIPE_B = 1e9;   // (S6: Alaska has no U-ramp: the pipe is nowhere unless the order has it)
  Object.assign(BIG, nor ? { name: 'THE CORNICE', spon: null, look: 'cornice' } : ak ? { name: 'THE BIG LINE', spon: null, look: 'cornice' } : { name: 'BIG AIR', spon: 'red', look: null });
  let z = 6; const Z = { side: route.side || 0 };
  o.forEach((F, i) => { const last = i === o.length - 1;
    if (F.fr) { if (FR.a == null) FR.a = z; z += PG; }
    if (i === i0) { Z.a = z; z += TURN; Z.b = z; if (route.n === 0) { z += route.len; Z.c = z; z += TURN; Z.d = z; } }
    if (F.k === 'kick') { F.s = z + 12; z = F.s + F.len + (F.table || 0) + F.back + F.T * 11 + 4; }
    else if (F.k === 'rail') { F.a = z + 6; F.b = F.a + RLEN[F.id]; z = F.b + 12; }
    else if (F.k === 'pipe') { PIPE_A = z + 14; PIPE_B = PIPE_A + 125; z = PIPE_B + 12; }   // (S3: 5 airs need 125 m)
    else { BIG.s = z + 32; z = BIG.s + BIG.len + 96 + (last ? 20 : 22); }   /* (the big air: up to ~95 m of flight at full speed with slow-motion tricks) */
    if (F.fr) FR.b = z;
    if (i0 >= 0 && n > 0 && i === i0 + n - 1) { Z.c = z; z += TURN; Z.d = z; } });
  STOP_Z = z; COURSE_END = STOP_Z + 12; FEAT.length = 0; FEAT.push(...o); S.secs = o; S.big = BIG; S.pipeA = () => PIPE_A; S.order = orderKey(o); S.L = COURSE_END; S.lastF = o[o.length - 1];
  S.route = route; S.zone = i0 >= 0 ? Z : null; S.gap = route.id === 'igloo' && i0 >= 0 ? { kind: 'igloo', zA: Z.b - 2, zB: Z.c + 2, hw: 8, ent: Z.b + 4, cz: Z.b + 19, R: 9, exit: Z.b + 28 } : route.id === 'rockgap' && i0 >= 0 ? { kind: 'rockgap', zA: Z.b - 14, zB: Z.c + 14 } : route.id === 'tunnel' && i0 >= 0 ? { kind: 'tunnel', zA: Z.b - 8, zB: Z.c + 8, hw: 7, h: 6.4 } : route.id === 'icecave' && i0 >= 0 ? { kind: 'icecave', zA: Z.b - 8, zB: Z.c + 8, hw: 8, h: 8.2 } : null; S.inZone = i0 >= 0 ? o.slice(i0, i0 + n).map((F) => F.id) : []; if (route.n === 0 && i0 >= 0) S.inZone = ['(empty)'];
  // X: 0 on the main slope; in a detour it bends out over TURN metres (a smooth S), holds SWING metres to the side through the zone, bends back
  for (let i = 0; i < PN; i++) { const zz = PZ0 + i * PST; let x = 0; if (S.zone) { const D = Z.side * SWING; x = zz < Z.a ? 0 : zz < Z.b ? D * ss5((zz - Z.a) / TURN) : zz < Z.c ? D : zz < Z.d ? D * (1 - ss5((zz - Z.c) / TURN)) : 0; } PX[i] = x; }
  // (S5) Norway's forest path winds: every freeride section sits a little to one side (the sides take turns), the path swings smoothly between them
  // (only in the free stretches: each kicker, log and landing is straight), and back to the middle for the cornice's run-in
  if (nor && FR.a != null) { const r = rng32(seed ^ 0x2545f491), sp = []; let sg = r() < 0.5 ? -1 : 1;
    for (const F of o) if (F.fr) { const p = F.k === 'kick' ? F.s - 5 : F.a - 4, q = F.k === 'kick' ? F.s + F.len + (F.table || 0) + F.back + F.T * 11 + 2 : F.b + 4; sp.push([p, q, sg * (1.6 + r() * 2.6)]); sg = -sg; }
    const pts = [[FR.a, 0], ...sp.flatMap(([p, q, ox]) => [[p, ox], [q, ox]]), [BIG.s - 14, 0]];
    for (let i = 0; i < PN; i++) { const zz = PZ0 + i * PST; if (zz <= FR.a || zz >= BIG.s - 14) continue; let j = 0; while (j < pts.length - 2 && zz > pts[j + 1][0]) j++; const [z0, x0] = pts[j], [z1, x1] = pts[j + 1]; PX[i] = x0 + (x1 - x0) * ss5((zz - z0) / Math.max(1e-3, z1 - z0)); }
    S.forest = { zA: FR.a + 6, zB: FR.b }; S.gap = { kind: 'forest', zA: S.forest.zA - 6, zB: S.forest.zB + 4, hw: 5.6 };
    const lg = o.find((F) => F.id === 'lg'); if (lg) S.river = { a: lg.a + 2.6, b: lg.b - 2.6 }; }
  // V: gentle rolls (whoops) in the free stretches between the sections; flat on every feature, its run-in and landing, the pipe, the turns
  const busy = [[-1e9, 8], [STOP_Z - 24, 1e9]];
  for (const F of o) { if (F.k === 'kick') busy.push([F.s - 5, F.s + F.len + (F.table || 0) + F.back + F.T * 11 + 2]); else if (F.k === 'rail') busy.push([F.a - 4, F.b + 4]); else if (F.k === 'pipe') busy.push([PIPE_A - 6, PIPE_B + 6]); else busy.push([BIG.s - 10, BIG.s + BIG.len + 100]); }
  if (S.zone) busy.push([Z.a - 2, Z.b + 2], [Z.c - 2, Z.d + 2]); if (S.gap && S.gap.kind === 'igloo') busy.push([Z.b, Z.c]);   // (no rolls through the igloo)
  busy.sort((p, q) => p[0] - q[0]); const free = []; let at = -1e9; for (const [p, q] of busy) { if (p > at + 12) free.push([at, p]); at = Math.max(at, q); }
  PV.fill(0); S.rolls = 0;
  for (const [fa, fb] of free) { const L = fb - fa, nn = Math.max(1, Math.round(L / 22)), w = L / nn, fast = Math.abs(fb - (BIG.s - 10)) < 1, A = Math.min(1.5, w * w * 0.005) * (fast ? 0.35 : 1);   /* (on the big air's run-in he goes 15 m/s: lower rolls) */   /* (up to 1.5 m; a short roll lower, so he never lifts off a crest at riding speed) */
    for (let i = Math.max(0, Math.floor((fa - PZ0) / PST)); i < PN && PZ0 + i * PST <= fb; i++) { const zz = PZ0 + i * PST; PV[i] = A * Math.pow(Math.sin(Math.PI * (zz - fa) / w), 2); } S.rolls += nn; }
  for (const K of KICKS) K.x = X(K.s); for (const R of RAILS) R.x = X(R.a); BIG.x = X(BIG.s); S.pipeX = X(PIPE_A);
  lsSet('hp-order', S.order); lsSet('hp-route', route.id);
}
// (S5) each location's look: the painted sky (Norway: the northern lights), the fog, the ambient light, the rim light (Norway: aurora green), the mountains
function applyLook(E) {
  const nor = S.loc && S.loc.id === 'norway', ak = S.loc && S.loc.id === 'alaska', { THREE } = E;
  if (!S.look0) S.look0 = { fog: E.fogColor, hs: E.hemi.color.getHex(), hg: E.hemi.groundColor.getHex(), hi: E.hemi.intensity, rc: E.rim.color.getHex(), ri: E.rim.intensity };
  if (!S.sky) { S.sky = E.scene.children.find((o) => o.material && o.material.uniforms && o.material.uniforms.uYaw); if (S.sky) { const U = S.sky.material.uniforms; S.skyA = { map: U.map.value, b: U.uB.value, s: U.uS.value, y: U.uYaw.value }; } }
  if (S.sky) { const U = S.sky.material.uniforms;
    if (ak) { if (!S.skyK) { const t = S.skyK = new THREE.TextureLoader().load('sky/alaska-night.webp?v=1'); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; } U.map.value = S.skyK; U.uB.value = 0.59; U.uS.value = 0.75; U.uYaw.value = 0.9; }   /* (the big round moon ~18° off his line, ~16° up: in the riding view) */
    else if (nor) { if (!S.skyN) { const t = S.skyN = new THREE.TextureLoader().load('sky/norway-night.webp?v=1'); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; } U.map.value = S.skyN; U.uB.value = 0.38; U.uS.value = 1.05; U.uYaw.value = 0.25;   /* (the lower curtain of the northern lights just over the mountains, in the riding view) */ }
    else { U.map.value = S.skyA.map; U.uB.value = S.skyA.b; U.uS.value = S.skyA.s; U.uYaw.value = S.skyA.y; } }
  const L0 = S.look0; E.fogColor = ak ? 0x2d3274 : nor ? 0x1d3c6c : L0.fog; E.hemi.color.setHex(ak ? 0x8a9fe0 : nor ? 0x6a9cd8 : L0.hs); E.hemi.groundColor.setHex(ak ? 0x2a2a5e : nor ? 0x24305c : L0.hg); E.hemi.intensity = ak ? 0.6 : nor ? 0.55 : L0.hi;
  E.rim.color.setHex(ak ? 0xc7d8ff : nor ? 0x7dffc0 : L0.rc); E.rim.intensity = ak ? 1.3 : nor ? 1.5 : L0.ri;
  if (S.mount) { S.mount.visible = !ak; S.mount.traverse((o) => { if (o.isMesh) o.material.color.setHex(nor ? 0x5a78a8 : 0x8890c8); }); }
  if (ak && !S.peaks) { S.peaks = makePeaks(THREE); E.scene.add(S.peaks); } if (S.peaks) S.peaks.visible = ak;   // (S6: Alaska's own huge peaks instead)
}
export const _S = S; export const _fx = { trickCard: (...a) => trickCard(...a), scoreFly: (...a) => scoreFly(...a) };   /* (tests: the pop-up gallery) */
// (2026-11-25) the Snowboard Foxino with his own clips: ?nb=1 while it is tested (the old rider stays the default until then)
const QALL = (() => { let q = location.search; try { if (window.parent !== window) q += '&' + window.parent.location.search.slice(1); } catch (e) {} return q; })();   // (the switch also works on the Sports lobby's address: /sports/?nb=2)
const NB = !/[?&]nb=0/.test(QALL), RIDER_URL = /[?&]nb=1/.test(QALL) ? 'models/foxino-snowboard.glb?v=1' : 'models/foxino-snowrider.glb?v=4';   /* (F5: v3 = with his face; S2: v4 = the new tricks: press, noseslide, shifty, reworked grabs and wind-ups) */   /* (2026-11-25 night: the snowrider (v2 clips) is the default rider; ?nb=0 = the old rider, ?nb=1 = the first Snowboard Foxino) */   /* (2026-11-25: ?nb=2 = the snowrider: the whole Foxino on his board in a purple jacket and black ski pants (Tripo + Claudee RCC, 19 clips), behind a switch until it is approved) */   /* (2026-11-25 02:00: the old rider is the default again for the school test: the new Snowboard Foxino read dark and hunched at phone size; ?nb=1 = the new one) */
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
  const k = fail ? Math.pow(Math.max(0, (w - TW.wind) / (1 - TW.wind)), 1.5) : w < TW.wind ? 0.04 * smoothStep(w / TW.wind) : 0.04 + 0.96 * ss5((w - TW.wind) / (TW.spot - TW.wind + 0.06));   // (S2: the turn eases in and out, quicker in the middle, like a real rider's)
  const seg = w < TW.wind ? 'wind' : fail || w < TW.spot ? 'grab' : 'spot';
  const grab = 'grab_' + (GRAB[T[4]] || T[4] || 'indy'), clip = seg === 'wind' ? (T[1] ? 'windup_spin' : 'windup_flip') : seg === 'grab' || S.noSpot ? grab : 'spot_land';   // (S2: a rider whose grabs end by spotting the landing keeps the grab clip to the end)
  const frac = seg === 'wind' ? TW.wind : seg === 'grab' ? (fail || S.noSpot ? 1 - TW.wind : TW.spot - TW.wind) : S.noSpot ? 1 - TW.wind : 1 - TW.spot;
  return { k, clip, frac };
}
const failTrick = (c0) => Object.assign(TRICKS[Math.max(0, Math.min(TRICKS.length - 1, c0))].slice(), { fail: true });
// the clip for where he is: on the walls he carves, at the lips he pumps, in the air a tuck or the trick's grab, then the landing
function clipFor(st) {
  if (st.ph === 'menu' || st.ph === 'drop') return ['stance_idle', 1];
  if (st.fall && st.has && st.has.wipeout) return [st.fallBack && st.has.wipeout_back ? 'wipeout_back' : 'wipeout', 1];   // (the snowrider's own wipeout: down, slide, up)
  if (st.rail && st.has) return clipOr(st.has, st.railClip || 'ride');   // (S2: the jib's own clip: 50-50 / boardslide / press / noseslide, shifty on the hop)
  if (st.ph === 'stop' || st.ph === 'out' && st.u > 0.7) return ['cheer', 1];
  if (st.ph === 'air' && st.tc && st.has && st.has[st.tc[0]]) return st.tc;
  if (st.ph === 'air' && st.tc && st.has && /^(spot_land|air_tuck)$/.test(st.tc[0])) return st.lastGrab && st.has[st.lastGrab] ? [st.lastGrab, 0.5] : clipOr(st.has, 'air_tuck');
  if (st.ph === 'air' && st.has && st.has.windup_spin) return st.air < 0.3 ? clipOr(st.has, 'takeoff') : clipOr(st.has, 'air_tuck');
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
  c.classList.add('go'); if (oops) { c.classList.add('oops'); const gen = c.dataset.gen; setTimeout(() => { if (c.dataset.gen === gen) c.classList.add('out'); }, 2600); }   /* (R6: a WIPEOUT!/TOO SLOW! card fades by itself: no points follow it) */ else if (streak >= 9) c.classList.add('lv9'); else if (streak >= 6) c.classList.add('lv6'); else if (streak >= 3) c.classList.add('lv3'); }
// on landing: the trick's points count up over Foxino, then fly into the total at the top, which ticks up and bumps
async function scoreFly(E, pts, at) { if (!(pts > 0)) return; while (S.fall > 0) await new Promise((r) => setTimeout(r, 120));   /* (2026-11-26: no score while he is down in a crash; never a +0) */
  const c = fxRoot(), gen = c.dataset.gen; const v = at.clone().project(E.camera); let x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x = Math.max(70, Math.min(innerWidth - 70, x)); y = Math.max(SIGN.on ? (SIGN.botPx || 0) + 34 : 150, 150, Math.min(innerHeight - 120, y));   /* (H33: never over the question's sign) */
  if (S.a) {   // (S6, the N4 rule: a points pop-up never sits on Foxino: beside him (right, else left), level with his head)
    const P = S.a.g.position, f = P.clone().project(E.camera), h = P.clone().setY(P.y + 1.9).project(E.camera), fx = (f.x * 0.5 + 0.5) * innerWidth, fy = (-f.y * 0.5 + 0.5) * innerHeight, hy = (-h.y * 0.5 + 0.5) * innerHeight, hw = Math.max(26, (fy - hy) * 0.42), bw = 64, bh = 30;
    if (f.z < 1 && x + bw > fx - hw && x - bw < fx + hw && y + bh > hy - 12 && y - bh < fy + 8) { const R = fx + hw + bw + 6, L = fx - hw - bw - 6; if (R < innerWidth - 66) x = R; else if (L > 66) x = L; else y = Math.max(SIGN.on ? (SIGN.botPx || 0) + 34 : 150, hy - bh - 16); } }
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
  if (R.look === 'ice') {   // (S6) the ICE LEDGE in the ice cave: a long glassy block of glacier ice on an ice base
    const len = Math.hypot(R.b - R.a, (R.b - R.a) * S.SL), im = new THREE.MeshStandardMaterial({ color: 0xa8e4ff, roughness: 0.1, metalness: 0.15, emissive: 0x2a7fd0, emissiveIntensity: 0.7, flatShading: true }), A = pt(R.a), B = pt(R.b);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, len), im); top.position.copy(A).lerp(B, 0.5).add(new THREE.Vector3(0, -0.11, 0)); top.rotation.x = Math.atan(S.SL); top.castShadow = true; g.add(top);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, R.h, len * 0.96), new THREE.MeshStandardMaterial({ color: 0x5fb6ee, roughness: 0.2, emissive: 0x1d5aa8, emissiveIntensity: 0.6, flatShading: true })); base.position.copy(A).lerp(B, 0.5).add(new THREE.Vector3(0, -0.22 - R.h / 2 + 0.02, 0)); base.rotation.x = Math.atan(S.SL); g.add(base);
    return g; }
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
  for (const [a, b] of [[-4, PIPE_A - 4], [PIPE_B + 4, STOP_Z + 4]]) for (const sd of [-1, 1]) for (let z = a; z < b; z += 5) if (!inGap(z) && !(S.forest && z > S.forest.zA - 8)) q(sd * 9.5, z, sd * 9.5, z + 2.6, 0.2);   // (the dashed edges)
  for (const K of [...KICKS, BIG].filter((K) => !K.look)) { const hw = K.w / 2 + 0.35, e = K.s + K.len + 0.35 + (K.table || 0) + K.back, land = K.s + K.len + K.T * (K === BIG ? 15 : 8.5);
    q(-hw - 0.6, K.s - 3, hw + 0.6, K.s - 3, 0.28); for (const sd of [-1, 1]) q(sd * hw, K.s - 3, sd * hw, e, 0.2);   // (the approach line, the kicker framed)
    q(-hw - 1.2, land - 2, hw + 1.2, land - 2, 0.3); q(-hw - 1.2, land + 2, hw + 1.2, land + 2, 0.3); }   // (the landing zone)
  for (const R of RAILS.filter((R) => R.look !== 'log')) { q(-1.6, R.a - 3, 1.6, R.a - 3, 0.26); for (const sd of [-1, 1]) q(sd * 0.9, R.a - 3, sd * 0.9, R.a, 0.16); }
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
  const FO = S.forest, inF = (z) => !!FO && z > FO.zA - 8 && z < FO.zB + 6;
  for (let z0 = -90; z0 < COURSE_END + 90; z0 += 50) { const items = [];
    for (let z = z0; z < z0 + 50; z += inF(z) ? 2.3 : 3.1) for (const sd of [-1, 1]) { if (inF(z)) {   // (S5: the forest path: trees close on both sides, deep behind; none on the river)
        if (!inRiver(z, 1.2)) for (const [x0, span, p, s0, sr] of [[7, 3, 1, 0.8, 0.45], [10.5, 5, 1, 0.9, 0.7], [15.5, 8, 0.9, 0.9, 0.9], [23.5, 14, 0.8, 0.9, 0.9], [37.5, 22, 0.6, 0.9, 0.9]]) if (rnd() < p) { const zz = z + rnd() * 2.3, x = X(zz) + sd * (x0 + rnd() * span), s = s0 + rnd() * sr; items.push([x, gY(x, zz) - 0.2, zz, s, rnd() * 6.28]); }
        continue; }
      const near = (z > PIPE_A - 3 && z < PIPE_B + 3 ? W() + DECK + 8 : 21);
      for (const [x0, span, p] of [[near, 10, 1], [near + 10, 14, 0.75], [near + 24, 28, 0.4]]) if (rnd() < p * (S.wild ? 0.42 : 1)) { const zz0 = z + rnd() * 3.1, x = X(zz0) + sd * (x0 + rnd() * span), zz = zz0, s = 0.9 + rnd() * 0.9; if (inRiver(zz, 1.2)) continue; items.push([x, gY(x, zz) - 0.2, zz, s, rnd() * 6.28]); } }
    const im = new THREE.InstancedMesh(geo, mat, items.length); items.forEach(([x, y, z, s, r], i) => { m4.compose(ps.set(x, y, z), q.setFromAxisAngle(Y, r), S.wild ? sc.set(s * 0.7, s * (0.9 + (i % 5) * 0.08) * 1.5, s * 0.7) : sc.set(s, s * (0.9 + (i % 5) * 0.08), s));   /* (S6: Alaska: sparse, tall, narrow spruce) */ im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); im.receiveShadow = false; im.castShadow = false; im.userData.noCast = true; grp.add(im); }
  return grp;
}
// the open slope: flat down the course (|x| < 14), rolling gently up into snowy hills beside it
// (S5) in Norway's forest the open slope narrows to a path (flat ~5.6 m either side, snowy banks up into the trees); the frozen river cuts a channel across
const fz = (z) => { const F = S.forest; return F ? ss5((z - (F.zA - 14)) / 12) * (1 - ss5((z - (F.zB + 4)) / 12)) : 0; };
const riverDip = (z) => { const R = S.river; return R ? 1.9 * ss5((z - (R.a - 1.6)) / 1.6) * (1 - ss5((z - R.b) / 1.6)) : 0; };
const inRiver = (z, m = 0) => !!S.river && z > S.river.a - 1.6 - m && z < S.river.b + 1.6 + m;
function gY(x, z) { const lx = x - X(z), ax = Math.abs(lx), f = fz(z), fw = 14 - 8.4 * f, k = Math.max(0, Math.min(1, (ax - fw) / 12)), bk = f ? f * 1.1 * Math.pow(Math.max(0, Math.min(1, (ax - fw) / 3)), 2) : 0; return -z * S.SL + V(z) - Math.sign(lx) * Math.min(ax, 16) * Math.tan(bankAt(z)) + k * k * (3 - 2 * k) * ((ax - fw) * 0.16 + Math.sin(x * 0.13 + z * 0.07) * 0.9 + Math.sin(x * 0.05 - z * 0.11) * 1.3) * (S.wild ? 2.3 : 1) + bk - (S.river ? riverDip(z) : 0); }   // (R3: along the route: its swing X, its rolls V, banked a little in the turns)
function gridMesh(THREE, xs, zs, f, mat, xo = () => 0) {
  const pos = [], idx = []; for (const z of zs) { const o = xo(z); for (const x of xs) pos.push(o + x, f(o + x, z), z); }
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
function makeGround(THREE, snowM, pisteM) {   // (R3: in 50 m pieces that follow the route; the far pieces are not drawn)
  const side = [14, 17, 21, 26, 32, 40, 50, 62, 78, 98, 124], xs = [...side.map((x) => -x).reverse(), ...side], grp = new THREE.Group(), mid = [-11, -8, -5.5, -3, 0, 3, 5.5, 8, 11], xsF = [...side.map((x) => -x).reverse(), ...mid, ...side];
  for (let z0 = -100; z0 < COURSE_END + 130; z0 += 50) { const zs = []; for (let z = z0; z <= z0 + 50; z += 2.5) zs.push(z);
    const R = S.river, F = S.forest, inF = F && z0 + 50 > F.zA - 30 && z0 < F.zB + 22;   // (S5: the forest's banks and the river's channel need the extra rows)
    if (R) { for (const q of [R.a - 1.6, R.a - 0.8, R.a, R.b, R.b + 0.8, R.b + 1.6]) if (q > z0 && q < z0 + 50) zs.push(q); zs.sort((a, b) => a - b); }
    grp.add(gridMesh(THREE, inF ? xsF : xs, zs, gY, snowM, X), gridMesh(THREE, inF ? [-14, ...mid, 14] : [-14, -7, 0, 7, 14], zs, (x, z) => gY(x, z) + 0.02, pisteM, X)); }   // (the groomed course: piste lines)
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
// (S5) Norway's natural jumps: the same kicker shape (the same air) dressed as nature: a ROCK DROP (rock sides, snowy boulders at the lip), a WIND LIP
// (all snow, a curled lip), a LOG KICKER (a snow ramp up to a log lying across), THE CORNICE (the big air as a huge snow lip between snowy rocks)
function makeNatural(THREE, K, M) {
  const big = K === BIG, icy = K.look === 'icelip', grp = makeKicker(THREE, K, icy ? M.ice : M.snow, icy ? M.ice : M.snow, K.look === 'rock' ? M.rock : icy ? M.ice : M.snowSide), kx = K.x || 0, hw = K.w / 2, zl = K.s + K.len, yl = -zl * S.SL + K.lip;
  const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  const ico = M.ico || (M.ico = new THREE.IcosahedronGeometry(1, 0)), cyl = M.cyl || (M.cyl = new THREE.CylinderGeometry(1, 1, 1, 9, 1));
  if (K.look === 'rock' || big || K.look === 'cornice') for (const sd of [-1, 1]) { const s = big ? 2.4 : 1.15, x = kx + sd * (hw + s * 0.75), z = zl - s * 0.3, y0 = -z * S.SL;
    add(ico, M.rock, x, y0 + s * 0.45, z, s * 1.1, s * 0.95, s, 0, sd, 0); add(ico, M.snow, x, y0 + s * 1.12, z, s * 0.92, s * 0.3, s * 0.82, 0, sd + 0.3, 0);
    add(ico, M.rock, x + sd * s * 1.1, y0 + s * 0.25, z - s * 1.6, s * 0.7, s * 0.6, s * 0.75, 0, sd * 2, 0); }
  if (K.look === 'rock') add(ico, M.rock, kx, yl - 0.75, zl + 0.75, hw * 0.9, 0.7, 0.7, 0, 0.4, 0);   // (the rock face under the lip)
  if (K.look === 'wind' || big || K.look === 'cornice') { const r = big ? 0.55 : K.look === 'cornice' ? 0.45 : 0.32; add(cyl, M.snow, kx, yl - r, zl + r * 0.4, r, K.w + 0.3, r * 1.25, 0, 0, Math.PI / 2); }   // (the curled lip)
  if (K.look === 'cornice' && !big) add(ico, M.snow, kx, yl - 0.25, zl + 0.6, hw * 0.95, 0.38, 0.9, 0, 0, 0);   // (S6: the cornice's overhanging snow)
  if (K.look === 'pillow') { const pg = M.pil || (M.pil = new THREE.IcosahedronGeometry(1, 1)); for (const sd of [-1, 1]) for (const [dz, s] of [[-5, 1.1], [-1.5, 1.4], [1.5, 1.25], [K.len + 2.5, 1.0]]) { const z = K.s + dz; add(pg, M.snow, kx + sd * (hw + s * 0.95), -z * S.SL + s * 0.25, z, s * 1.25, s * 0.7, s * 1.3, 0, sd, 0); } }   // (S6: round snow pillows either side)
  if (K.look === 'spine') { const P = [];   // (S6: sharp snow spines running down either side: a triangular ridge, its crest following the slope)
    for (const sd of [-1, 1]) { const x0 = kx + sd * (hw + 1.7), za = K.s - 9, zb = K.s + K.len + 3, hh = 1.9, ww = 1.6, y = (z) => -z * S.SL - 0.2, A = [x0 - ww, y(za), za], B = [x0 + ww, y(za), za], Ct = [x0, y(za) + hh * 0.4, za], A2 = [x0 - ww, y(zb), zb], B2 = [x0 + ww, y(zb), zb], C2 = [x0, y(zb) + hh * 0.4, zb], Cm = [x0, y((za + zb) / 2) + hh, (za + zb) / 2];
      P.push(...A, ...Ct, ...Cm, ...Ct, ...B, ...Cm, ...A, ...Cm, ...A2, ...Cm, ...C2, ...A2, ...B, ...B2, ...Cm, ...Cm, ...B2, ...C2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, M.snowSide); m.receiveShadow = true; m.castShadow = true; grp.add(m); }
  if (icy) for (const sd of [-1, 1]) add(ico, M.ice, kx + sd * (hw + 0.7), -(zl - 0.5) * S.SL + 0.5, zl - 0.5, 0.8, 1.1, 0.9, 0, sd, 0);   // (S6: blocks of ice at the lip)
  if (K.look === 'log') { add(cyl, M.bark, kx, yl - 0.3, zl + 0.12, 0.32, K.w + 1.4, 0.32, 0, 0, Math.PI / 2); add(cyl, M.snow, kx, yl + 0.02, zl + 0.12, 0.2, K.w + 0.9, 0.24, 0, 0, Math.PI / 2); }
  return grp;
}
// (S5) the FALLEN LOG over the frozen river: a long trunk lying down the hill (snow along its top, a root ball at the top end, broken branch stubs)
let LOGM = null;
function makeLog(THREE, R) {   // (S6: chunkier, a thick snow cap along the top, broken branch stubs sticking up, so it reads as a real fallen tree from behind)
  const M = LOGM || (LOGM = { bark: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.95, flatShading: true }), bark2: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.95, flatShading: true }), root: new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 1, flatShading: true }), snow: new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.9, flatShading: true }) });
  const g = new THREE.Group(), r = 0.68, pt = (z) => new THREE.Vector3(R.x || 0, -z * S.SL + railH(R, z), z), A = pt(R.a - 1.6), B = pt(R.b + 1.6), len = A.distanceTo(B), dir = B.clone().sub(A).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const up = new THREE.Vector3(0, 1, 0), C = A.clone().lerp(B, 0.5).addScaledVector(up, -0.72);   // (the log's axis: its snow cap's top is where the board slides)
  const log = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, len, 10, 1), M.bark); log.position.copy(C); log.quaternion.copy(q); log.castShadow = true; log.receiveShadow = true; g.add(log);
  const end = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 10), M.bark2); end.position.copy(B).addScaledVector(up, -0.72).addScaledVector(dir, 0.01); end.lookAt(end.position.clone().add(dir)); g.add(end);   // (the broken end: paler wood)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, len * 0.94, 10, 1), M.snow); cap.position.copy(C).addScaledVector(up, r * 0.7); cap.quaternion.copy(q); cap.scale.set(1.08, 1, 0.42); cap.receiveShadow = true; g.add(cap);
  const rb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), M.root); rb.position.copy(B).add(new THREE.Vector3(0.4, -0.95, 0.7)); rb.scale.set(1.5, 1.25, 0.6); rb.castShadow = true; g.add(rb);   // (the root ball at the far end: ahead of him, never filling the camera)
  for (const [dz, sx, sy, sz] of [[-0.4, 1.7, 1.0, 1.7], [0.9, 1.25, 0.65, 1.2]]) { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), M.snow); d.position.set(A.x + (dz > 0 ? 0.4 : -0.25), A.y - 0.75 + (dz > 0 ? 0.05 : 0.15), A.z + dz); d.scale.set(sx, sy, sz); d.receiveShadow = true; g.add(d); }   // (its top end buried in a snowdrift)
  for (const [f, sd, l, tilt] of [[0.22, 1, 1.5, 0.55], [0.47, -1, 1.2, 0.7], [0.7, 1, 1.0, 0.85], [0.86, -1, 1.35, 0.5]]) {   // (broken branch stubs out of the sides, angled up and out: visible from the game camera)
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, l, 6, 1), M.bark); b.position.copy(C.clone().lerp(C, 0)).copy(A.clone().lerp(B, f)).addScaledVector(up, -0.5).add(new THREE.Vector3(sd * (r * 0.9 + l * 0.5 * Math.sin(tilt)), l * 0.5 * Math.cos(tilt), 0)); b.rotation.z = -sd * tilt; b.castShadow = true; g.add(b);
    const sc = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), M.snow); sc.position.copy(b.position).add(new THREE.Vector3(sd * l * 0.25 * Math.sin(tilt), l * 0.3 * Math.cos(tilt) + 0.08, 0)); sc.scale.set(1.2, 0.55, 1.2); g.add(sc); }
  return g;
}
// (S5) the frozen river: cracked blue ice down in its channel, right across the valley
function makeIce(THREE) {
  const R = S.river; if (!R) return null; const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#a6dcf6'); gr.addColorStop(0.5, '#62ade3'); gr.addColorStop(1, '#93d2f3'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  let sd = 11; const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) { const cx = rn() * 256, cy = rn() * 256, rr = 14 + rn() * 40, rg = x.createRadialGradient(cx, cy, 0, cx, cy, rr); rg.addColorStop(0, 'rgba(235,250,255,.38)'); rg.addColorStop(1, 'rgba(235,250,255,0)'); x.fillStyle = rg; x.fillRect(0, 0, 256, 256); }
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineCap = 'round';
  const crack = (px, py, a, n, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(px, py); for (let i = 0; i < n; i++) { a += (rn() - 0.5) * 1.1; px += Math.cos(a) * 9; py += Math.sin(a) * 9; x.lineTo(px, py); if (rn() < 0.18 && w > 0.8) { x.stroke(); crack(px, py, a + (rn() < 0.5 ? 1 : -1) * 0.9, 4 + rn() * 5, w * 0.6); x.lineWidth = w; x.beginPath(); x.moveTo(px, py); } } x.stroke(); };
  for (let i = 0; i < 7; i++) crack(rn() * 256, rn() * 256, rn() * 6.28, 9 + rn() * 10, 1.8);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4;
  const pos = [], uv = [], idx = [], xs = [], zs = [R.a - 0.9, R.a - 0.3, R.a + 1.5, (R.a + R.b) / 2, R.b - 1.5, R.b + 0.3, R.b + 0.9]; for (let v = -126; v <= 126; v += 6) xs.push(v);
  for (const z of zs) for (const v of xs) { const wx = X(z) + v; pos.push(wx, gY(wx, z) + 0.05, z); uv.push(wx / 9, z / 9); }
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.16, metalness: 0.08, emissive: 0x1b4f7a, emissiveIntensity: 0.55 })); m.receiveShadow = true; m.userData.noCast = true; return m;
}
// (S5) lanterns on posts along the forest path (taking turns left and right), so the narrow path reads at night
function makeLanterns(THREE) {
  const F = S.forest; if (!F) return null; const items = []; for (let z = F.zA - 2, i = 0; z < F.zB + 4; z += 13, i++) { if (inRiver(z, 1)) continue; const sd = i % 2 ? 1 : -1, x = X(z) + sd * 4.9; items.push([x, gY(x, z), z]); }
  const g = new THREE.Group(), m4 = new THREE.Matrix4(), parts = [[new THREE.BoxGeometry(0.14, 1.7, 0.14), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.9 }), 0.85], [new THREE.BoxGeometry(0.3, 0.34, 0.3), new THREE.MeshBasicMaterial({ color: 0xffc36a, toneMapped: false }), 1.85], [new THREE.ConeGeometry(0.3, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x2a1d15, roughness: 0.9 }), 2.13]];
  for (const [geo, mat, dy] of parts) { const im = new THREE.InstancedMesh(geo, mat, items.length); items.forEach(([x, y, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, y + dy, z))); im.computeBoundingSphere(); im.userData.noCast = true; g.add(im); }
  return g;
}
// (S5) the Norwegian night out on the hills: red wooden cabins with snowy roofs and warm windows, and a stave church on a hill (a dark silhouette
// with its stacked roofs, against the northern lights)
function makeVillage(THREE, rnd, ak = false) {
  const g = new THREE.Group(), m4 = new THREE.Matrix4(), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), cab = [];
  for (let i = 0; i < (ak ? 3 : 10); i++) { const z = 20 + rnd() * (COURSE_END - 20), sd = i % 2 ? 1 : -1, x = X(z) + sd * (46 + rnd() * 40); if (inRiver(z, 6)) continue; cab.push([x, gY(x, z) - 0.2, z, (sd > 0 ? -Math.PI / 2 : Math.PI / 2) + (rnd() - 0.5) * 0.8, 0.9 + rnd() * 0.4]); }
  const roofG = new THREE.CylinderGeometry(1, 1, 1, 3, 1); roofG.rotateZ(Math.PI / 2); roofG.rotateX(-Math.PI / 2);   // (a prism along the cabin, its ridge up)
  const parts = [[new THREE.BoxGeometry(4.2, 2.6, 3.4), new THREE.MeshStandardMaterial({ color: ak ? 0x5a3b26 : 0x8b2a1f, roughness: 0.9, flatShading: true }), [0, 1.3, 0], [1, 1, 1], 0],
    [roofG, new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.9, flatShading: true }), [0, 3.15, 0], [4.8, 1.35, 2.3], 0],
    [new THREE.PlaneGeometry(0.8, 0.7), new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }), [-0.9, 1.4, 1.72], [1, 1, 1], 0],
    [new THREE.PlaneGeometry(0.8, 0.7), new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }), [0.9, 1.4, 1.72], [1, 1, 1], 0]];
  for (const [geo, mat, off, sc] of parts) { const im = new THREE.InstancedMesh(geo, mat, cab.length);
    cab.forEach(([x, y, z, ry, s], i) => { m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, ry), new THREE.Vector3(s, s, s)); mm.compose(new THREE.Vector3(...off), new THREE.Quaternion(), new THREE.Vector3(...sc)); im.setMatrixAt(i, m4.clone().multiply(mm)); });
    im.computeBoundingSphere(); im.userData.noCast = true; g.add(im); }
  if (ak) return g;   // (Alaska: log cabins only)
  // the stave church: far out on a hill, the same side every run; ~120 triangles, always drawn (it is the skyline)
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.95, flatShading: true }), roof = new THREE.MeshStandardMaterial({ color: 0x241913, roughness: 0.95, flatShading: true }), win = new THREE.MeshBasicMaterial({ color: 0xffb04a, toneMapped: false });
  const ch = new THREE.Group(), box = (w, h, d, y, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = y; ch.add(b); }, pyr = (r, h, y) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4, 1), roof); c.position.y = y; c.rotation.y = Math.PI / 4; ch.add(c); };
  box(6, 4, 8, 2, wood); pyr(5.6, 2.8, 5.4); box(3.6, 2.4, 3.6, 7.4, wood); pyr(3.6, 2.2, 9.6); box(2, 1.8, 2, 11.4, wood); pyr(1.7, 5, 14.8); box(0.7, 1.1, 0.05, 2.2, win); ch.children[ch.children.length - 1].position.z = 4.03;
  const cz = STOP_Z * 0.42, cx = X(cz) - 92; ch.position.set(cx, gY(cx, cz) - 0.4, cz); ch.rotation.y = Math.PI / 2 + 0.4; ch.scale.setScalar(1.5); ch.traverse((o) => { if (o.isMesh) o.userData.noCast = true; }); g.add(ch);
  return g;
}
// (S6) the heli drop's landing spot at the top of the Alaska run: an orange pad with an H, a pole with an orange flag (a freeride nod)
function makeHeli(THREE) {
  const g = new THREE.Group(), z = -6, x = X(z) + 11, y = gY(x, z), cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#ff7a1a'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 8; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.font = '900 64px Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 64, 68);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const pad = new THREE.Mesh(new THREE.CircleGeometry(2.3, 20), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 })); pad.position.set(x, y + 0.06, z); pad.rotation.x = -Math.PI / 2 + Math.atan(S.SL); pad.receiveShadow = true; g.add(pad);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), new THREE.MeshStandardMaterial({ color: 0xdfe4f0, roughness: 0.6 })); pole.position.set(x + 2.8, y + 1.7, z); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x5a2000 })); flag.position.set(x + 3.45, y + 3.0, z); flag.rotation.y = 0.5; g.add(flag);
  return g;
}
// (S6) Alaska's huge steep peaks: a ring of tall craggy low-poly mountains (white snow, blue-grey rock on the steep faces, glacier blue), always far
// away (they follow the camera, like the painted mountains), drawn crisp (no fog: their own haze in the colours); ~700 triangles
function makePeaks(THREE) {
  let sd = 5; const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), pos = [], col = [], C = new THREE.Color(), haze = new THREE.Color(0x5c68b8), nv = new THREE.Vector3(), tv = new THREE.Vector3(), MOON = new THREE.Vector3(-0.5, 0.6, 0.62).normalize();
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + rn() * 0.25, d = 430 + rn() * 140, R = 70 + rn() * 70, Hh = 170 + rn() * 170, cx = Math.sin(a) * d, cz = Math.cos(a) * d, n = 6, rings = [[1, 0], [0.62, 0.4], [0.28, 0.75]];
    const ring = (rk, hk, k) => { const th = (k / n) * Math.PI * 2 + i, w = rk * (0.8 + rn() * 0.4); return [cx + Math.cos(th) * R * w, Hh * hk + (rk < 1 ? (rn() - 0.5) * Hh * 0.08 : 0), cz + Math.sin(th) * R * w]; };
    const V = rings.map(([rk, hk]) => Array.from({ length: n }, (_, k) => ring(rk, hk, k))), top = [cx + (rn() - 0.5) * R * 0.3, Hh, cz + (rn() - 0.5) * R * 0.3];
    const tri = (p, q, r, hk) => { pos.push(...p, ...q, ...r); const steep = rn() < 0.4; nv.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]).cross(tv.set(r[0] - p[0], r[1] - p[1], r[2] - p[2])).normalize(); const lit = 0.58 + 0.5 * Math.max(0, Math.abs(nv.dot(MOON)));   // (moonlight baked in: they are drawn unlit)
      C.set(hk > 0.55 ? 0xf4f7ff : steep ? 0x6a76a2 : hk > 0.3 && rn() < 0.4 ? 0x9fd4ff : 0xe6edff).multiplyScalar(lit).lerp(haze, 0.22 + (d - 430) / 140 * 0.1); for (let j = 0; j < 3; j++) col.push(C.r, C.g, C.b); };
    for (let rI = 0; rI < 2; rI++) for (let k = 0; k < n; k++) { const a0 = V[rI][k], a1 = V[rI][(k + 1) % n], b0 = V[rI + 1][k], b1 = V[rI + 1][(k + 1) % n]; tri(a0, b0, a1, rings[rI][1] + 0.2); tri(a1, b0, b1, rings[rI + 1][1]); }
    for (let k = 0; k < n; k++) tri(V[2][k], top, V[2][(k + 1) % n], 0.9); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.userData.noCast = true; m.renderOrder = -500; return m;
}
function lookTick(E) { if (S.peaks && S.peaks.visible) { const c = E.camera.position; S.peaks.position.set(c.x, c.y - 165, c.z); } }
// an arch over the course: two posts and a banner facing the riders coming down
function bannerFade(E, rdt) {   // (S5) an arch's banner never sits behind the HUD (the score and "HALFPIPE · AIR 1 OF 5" at the top): it fades out there
  const B = S.banners; if (!B || !B.length) return; S.hudT = (S.hudT ?? 9) + rdt;
  if (S.hudT > 0.5) { S.hudT = 0; const el = document.getElementById('hudMain'), hd = document.getElementById('hud'), r = el && hd && !hd.classList.contains('hidden') ? el.getBoundingClientRect() : null; S.hudB = r && r.height ? r.bottom + 28 : 0;   /* (with a margin: it is gone before it touches the title) */ }
  const yH = 1 - 2 * (S.hudB || 0) / innerHeight, v = S._bv || (S._bv = new E.THREE.Vector3());
  for (const b of B) { const h = b.userData.h / 2; v.set(b.position.x, b.position.y + h, b.position.z).project(E.camera); const top = v.y, front = v.z < 1; v.set(b.position.x, b.position.y - h, b.position.z).project(E.camera);
    const over = S.hudB > 0 && front && v.y < 1 && top > yH, o = E.damp(b.material.opacity, over ? 0 : 1, 12, rdt); b.material.opacity = o; b.visible = o > 0.02; }
}
function makeArch(E, text, color, z, hw, h, mat = null) {
  const { THREE } = E, grp = new THREE.Group(), postM = new THREE.MeshStandardMaterial({ color: 0x2a2f5c, roughness: 0.6 }), y0 = -z * S.SL + V(z), ax = X(z);
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, h + 1.6, 0.35), postM); p.position.set(ax + sd * hw, y0 + (h + 1.6) / 2 - 0.3, z); p.castShadow = true; grp.add(p); }
  const bh = mat ? hw : Math.min(2.2, hw * 2 / 8), b = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, bh), mat || E.bannerMaterial(text, color)); b.position.set(ax, y0 + h + 0.6, z); b.rotation.y = Math.PI; grp.add(b);
  b.material.transparent = true; b.userData.h = bh; (S.banners || (S.banners = [])).push(b);   // (S5: it fades out while it would sit behind the HUD's title)
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
  bestShown: (s) => `${s} points`, bestKey: 'halfpipe15',   // (S3: 15-question runs score more: their own best, not compared with the 12-question ones)
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
    [S.firepit, S.tripod] = await Promise.all(['camp-firepit', 'camp-tripod'].map((n) => E.loadGLB(`models/${n}.glb?v=1`).then((gl) => gl.scene).catch(() => null)));   // (R8: the Adventures fire pit and its tripod with the pot)
    S.wallM = wallM; S.snowM = snowM; S.pisteM = pisteM; this.course(E);   // (R2/R3: the ground, the pipe, the features and everything round them, for this run's order and route)   // (R2: the pipe, the features and everything round them, for this run's order)
    S.mount = await E.addMountains(-240, 0x8890c8); applyLook(E);   // (S5: the location's sky, light and mountains)
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
    const sd = runSeeds(S.runN || 0); S.loc = pickLoc(sd); lsSet('hp-loc', S.loc.id); layout(pickOrder(sd), pickRoute(sd, S.loc), sd.cur); S.L = COURSE_END;   // (S4: the location first)
    S.banners = []; applyLook(E); const nor = S.loc.id === 'norway', FO = S.forest, inF = (z) => !!FO && z > FO.zA - 8 && z < FO.zB + 6;
    const g = new THREE.Group(); S.cg = g; const ground = makeGround(THREE, S.snowM, S.wild ? S.snowM : S.pisteM); g.add(ground); if (PIPE_A < 1e8) g.add(makePipe(THREE, S.wallM));   // (S6: Alaska: no groomed piste, no U-ramp)
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = [], lights = [], inPipe = (z) => z > PIPE_A - 3 && z < PIPE_B + 3;
    // (2026-11-25, the user: "surrounded by deep forest") a thick wall of pines on both sides all the way down, thinning out into the hills
    // (the detailed pines: one row along the course; behind them the deep forest of cheap low-poly firs, see makeForest)
    for (let z = -80; z < COURSE_END + 70; z += 12) for (const sd of [-1, 1]) { if (S.wild && (z / 12 | 0) % 2) continue; const near = (inPipe(z) ? W() + DECK + 4 : inF(z) ? 8.6 : 16.5), rx = sd * (near + rnd() * 5), zz = z + rnd() * 4, x = X(zz) + rx; if (inRiver(zz, 2.5)) { rnd(); rnd(); rnd(); continue; } trees.push([1 + Math.floor(rnd() * 3), x, gY(x, zz) - 0.15, zz, rnd() * 6.28, 0.85 + rnd() * 0.6]); }
    g.add(makeForest(THREE, rnd));
    for (let z = 6; z < COURSE_END; z += 40) for (const sd of [-1, 1]) { if (inGap(z) || S.wild) continue;   /* (S6: no floodlights on the wild mountain) */ const x = X(z) + sd * (inPipe(z) ? W() + DECK + 2.5 : 12.5); lights.push([0, x, gY(x, z), z, sd < 0 ? 0 : Math.PI, 1]); }
    g.add(E.instanceField(trees, (t) => `Pine${t}`), E.instanceField(lights, () => 'Floodlight', 400));
    // the floodlights' glow on the snow: 7 warm point lights spread down the course (no shadows; always 7, so no shader rebuild)
    const gz = S.gap ? (S.gap.kind === 'forest' ? [0.15, 0.5, 0.85] : [0.3, 0.72]).map((f) => S.gap.zA + (S.gap.zB - S.gap.zA) * f) : [];   // (R4: two of the glows light the rock gap)
    for (let i = 0; i < 7; i++) { const z = i < gz.length ? gz[i] : 14 + i * (STOP_Z - 14) / 6, inG = i < gz.length, tun = inG && (S.gap.kind === 'tunnel' || S.gap.kind === 'icecave'), igl = inG && S.gap.kind === 'igloo', fo = inG && S.gap.kind === 'forest', pl = new THREE.PointLight(tun ? 0xa8dcff : igl ? 0xffa25a : fo ? 0xffc890 : S.wild ? 0x9fb8ff : 0xffe2b0, igl ? 45 : fo ? 55 : inG ? 70 : S.wild ? 28 : 60, igl ? 24 : fo ? 40 : 55, 1.6); const iz = igl ? S.gap.cz + (i ? 0.5 : -2) : z; pl.position.set(X(iz) + (igl ? (i ? 4.4 : -3) : inG ? (i % 2 ? 3 : -3) : i % 2 ? 9 : -9), -iz * S.SL + V(iz) + (tun ? 4.6 : igl ? (i ? 1.4 : 3.2) : fo ? 5 : inG ? 8 : 12), iz); g.add(pl); if (igl && i === 1) { IG.light = pl; IG.lightI = pl.intensity; } }   // (R8: the fire's own flickering light)   // (R6: warm light inside the igloo, by the fire spot)
    const rocks = []; for (let i = 0; i < 46; i++) { const sd = rnd() < 0.5 ? -1 : 1, z = -50 + rnd() * (COURSE_END + 60), x = X(z) + sd * (17 + rnd() * 60); if (inRiver(z, 2)) { rnd(); rnd(); continue; } rocks.push([1 + Math.floor(rnd() * 2), x, gY(x, z) - 0.3, z, rnd() * 6.28, 0.9 + rnd() * 0.7]); }
    if (S.wild) for (let i = 0; i < 70; i++) { const sd = rnd() < 0.5 ? -1 : 1, z = -40 + rnd() * (COURSE_END + 50), x = X(z) + sd * (12.5 + rnd() * 48); if (inGap(z)) { rnd(); rnd(); rnd(); continue; } rocks.push([1 + Math.floor(rnd() * 2), x, gY(x, z) - 0.4, z, rnd() * 6.28, 1 + rnd() * 1.6]); }   // (S6: a rocky big mountain)
    g.add(E.instanceField(rocks, (t) => `Rock${t}`));
    // the features: the kickers, the rails, the BIG kicker; arches over the pipe's entrance, the big air and the finish
    const M = S.fm || (S.fm = { snow: new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), sideM: new THREE.MeshStandardMaterial({ color: 0x9fb4f2, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }), bigLip: new THREE.MeshStandardMaterial({ color: 0xff4d8d, roughness: 0.5, emissive: 0x5a0d2a }) });
    if (!M.rock) Object.assign(M, { rock: new THREE.MeshStandardMaterial({ color: 0x5f667c, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }), snowSide: new THREE.MeshStandardMaterial({ color: 0xd9e5ff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), bark: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.95, flatShading: true }) });   // (S5: nature)
    if (!M.ice) M.ice = new THREE.MeshStandardMaterial({ color: 0xa6e2ff, roughness: 0.1, metalness: 0.12, emissive: 0x2470c8, emissiveIntensity: 0.65, flatShading: true, side: THREE.DoubleSide });   // (S6: glacier ice)
    for (const K of KICKS) g.add(K.look ? makeNatural(THREE, K, M) : makeKicker(THREE, K, M.snow, new THREE.MeshStandardMaterial({ color: K.lipC, roughness: 0.5, emissive: new THREE.Color(K.lipC).multiplyScalar(0.25) }), M.sideM));
    g.add(BIG.look ? makeNatural(THREE, BIG, M) : makeKicker(THREE, BIG, M.snow, M.bigLip, M.sideM)); for (const R of RAILS) g.add(R.look === 'log' ? makeLog(THREE, R) : makeRail(THREE, R));
    if (!S.wild) g.add(makeBlueLines(THREE));
    if (PIPE_A < 1e8) g.add(makeArch(E, 'DROP IN', '#36b5e0', PIPE_A - 3, W() + DECK + 0.3, 9.5)); if (!S.wild) g.add(nor && FO ? makeArch(E, 'FREERIDE', '#2f7a52', FO.zA - 6, 6.4, 6) : makeArch(E, 'RED FOX BIG AIR', '#ff5a1f', BIG.s - 10, 8, 7.5)); g.add(makeArch(E, 'FINISH', '#0f3d44', STOP_Z + 8, 9, 6.5));
    if (nor) { for (const o of [makeIce(THREE), makeLanterns(THREE)]) if (o) { g.add(o); E.far(o); } g.add(makeVillage(THREE, rnd)); }
    if (S.wild) { g.add(makeVillage(THREE, rnd, true), makeHeli(THREE)); }   // (S6: a far-off log cabin or two and the heli drop's landing flag at the top)   // (S5: the frozen river, the path's lanterns, the cabins and the stave church)
    // the sponsor boards down both edges of the open slopes (the parody brands, taking turns)
    let bi = 0; for (const [a, b] of [[8, PIPE_A - 10], [PIPE_B + 10, STOP_Z - 6]]) for (let z = a; z < b; z += 26) for (const sd of [-1, 1]) if (!S.wild && !inGap(z) && !(FO && z > FO.zA - 8))   /* (S5: none from the forest on: the freeride half is nature) */ g.add(makeBoard(THREE, (bi++ + (sd > 0 ? 1 : 0)) % 2 ? 'red' : 'face', sd * 12, z));
    E.scene.add(g); E.far(ground);
    if (S.route && S.route.dress && S.zone) S.route.dress(E, g, S.zone);   // (R4+: the route's zone: the rock gap, the snow tunnel, the igloo)
    if (S.X) this.xmas(E, S.X);   // (a new run: the Christmas kit again, round the new course)
  },
  // Christmas: lights along the pipe's lips and down both edges of the open slopes, trees, gifts and snowmen beside the course
  xmas(E, X) {
    S.X = X; if (!X.ok || S.wild) return;   /* (S6: no Christmas kit on the wild Alaska mountain) */ const n0 = E.scene.children.length; const { THREE } = E, W0 = W(), deckY = (z) => -z * S.SL + S.R + S.WALLV, P = (x, z, dy = 0) => new THREE.Vector3((S.pipeX || 0) + x, deckY(z) + dy, z), G = (x, z, dy = 0) => new THREE.Vector3(routeX(z) + x, gY(routeX(z) + x, z) + dy, z);   // (R3: x along the route; X here is the kit)
    for (const sd of [1, -1]) for (let z0 = PIPE_A; z0 < PIPE_B; z0 += 32) { const posts = []; for (let z = z0; z <= Math.min(PIPE_B, z0 + 32); z += 6.4) posts.push(P(sd * (W0 + 0.45), z, 1.15)); if (posts.length > 1) X.lights(posts, { sag: 0.25, per: 6, size: 0.14, glow: 1.1 }); }
    for (const [a, b] of [[-6, PIPE_A - 6], [PIPE_B + 4, STOP_Z + 6]]) for (const sd of [1, -1]) for (let z0 = a; z0 < b - 3; z0 += 30)   /* (R2: never a string with one post: the stretches have any length now) */ { if (inGap(z0) || inGap(Math.min(b, z0 + 30))) continue; const posts = []; for (let z = z0; z <= Math.min(b, z0 + 30); z += 6) posts.push(G(sd * 11, z, 1.0)); if (posts.length > 1) X.lights(posts, { sag: 0.25, per: 6, size: 0.13, glow: 1.1 }); }
    const spots = []; for (let z = 8, i = 0; z < STOP_Z - 10; z += 31) if ((z < PIPE_A - 14 || z > PIPE_B + 6) && !inGap(z) && !inGap(z + 10)) spots.push([z, i++]);   /* (R2: beside the open slopes of this run's course, never on the pipe's decks) */
    for (const [z, i] of spots) { const sd = i % 2 ? 1 : -1;
      X.put(i % 2 ? 'XmasTree_Small' : 'XmasTree_Big', G(sd * 15, z), i, i % 2 ? 1.9 : 1.3); X.put('XmasTree_Small', G(-sd * 14, z + 10), -i, 1.8);
      X.put(['Gift_A', 'Gift_B', 'Gift_C'][i % 3], G(sd * 13, z - 1.5), i); X.put('Gift_B', G(sd * 13.3, z + 1.4), -i);
      if (i % 2 === 0) X.put('Snowman', G(-sd * 13, z - 6), sd * 1.2); }
    for (const sd of [1, -1]) { X.put('Lantern', G(sd * 3.5, -3), sd); X.put('XmasTree_Small', G(sd * 6, -8), sd, 1.6); X.put('XmasTree_Small', P(sd * (W0 + 3), PIPE_A + 3), sd, 1.6); }
    X.put('Sleigh', G(8, STOP_Z + 2), 2.4);   // (2026-11-26, Michal: "Make sure the tree at the finish line is removed": the big tree that stood on the line past the stop is gone; the finish is open)
    if (!BIG.look) for (const sd of [1, -1]) { const posts = []; for (let i = 0; i <= 8; i++) { const z = BIG.s + (BIG.len + 0.35) * i / 8; posts.push(new THREE.Vector3((BIG.x || 0) + sd * (BIG.w / 2 + 0.1), -z * S.SL + kickH(BIG, z) + 0.5, z)); } X.lights(posts, { sag: 0.1, per: 4, size: 0.12, glow: 1.2 }); }
    for (const R of RAILS.filter((R) => R.look !== 'log')) { X.put('CandyCane', G(1.2, R.a - 1), 1); X.put('CandyCane', G(-1.2, R.b + 1), -1); }
    if (S.cg) for (const o of E.scene.children.slice(n0)) S.cg.add(o);   // (R2: the kit joins this run's course group: a new run rebuilds it)
    E.scene.updateMatrixWorld();   // (S4: the kit's world positions before the first far-cull: else the first intro frame drew every tree and snowman, ~105k)
  },
  reset(E) { SIGN.on = false; if (SIGN.m) SIGN.m.visible = false; Object.assign(S, { pend: null, nextTrick: null, airN: 0, pN: 0, s: 1, d: 0, side: 1, phase: 'menu', u: 0, air: 0, trick: null, airTr: [], bOops: false, spin: 0, flip: 0, cork: 0, pts: 0, shown: null, due: 0, hit: 0, v: 4, wob: 0, landT: 0, shotT: 0, asking: false, k1: 0, r1: 0, p1: 0, b1: 0, done: {}, kick: null, rail: null, fall: 0, fr: 0, railFall: false, rt: null, railWob: false, railYaw: 0, railClip: "", head: 0, fbuf: [], fAt: 0, fTrickK: '', gOn: false, fin: false, pr: null, pHead: null, pRoll: 0, pRoll0: null }); E.snapCam(); },
  menu() { S.phase = 'menu'; },
  // (S4) the intro: a location card (its flag, its name) spins in and zooms into the place (~1.3 s; a tap skips it: alone you go straight on, in a
  // party it only hides it, so nobody starts earlier); then the camera sweeps from a high, wide look at the slope and the sky down to behind him,
  // while the 3-2-1 runs, and lands there on GO. ?nointro=1 for tests.
  async intro(E) {
    if (/[?&]nointro=1/.test(QALL)) { S.intro = null; return; }
    const L = S.loc || LOCS[0], party = !!(E.MP && E.MP.on), CARD = (S.runN || 0) > 0 ? 1000 : 1300;
    S.intro = { t0: performance.now(), card: CARD, sweep: CARD + 2400, skip: false }; E.snapCam(); E.camFov = 52; E.camera.fov = 52; E.camera.updateProjectionMatrix();   /* (the intro lens from the first frame: the wider 60° first frame drew ~105k) */
    const flag = L.flag === 'norway' ? '<i class="nor"></i>' : L.flag === 'alaska' ? '<i class="ak"></i>' : L.flag.map((c) => `<i style="background:${c}"></i>`).join('');
    const ov = document.createElement('div'); ov.id = 'hpIntro'; ov.innerHTML = `<div class="hpCard" style="--d:${CARD}ms"><div class="hpFlag">${flag}</div><b>${L.name}</b><small>${L.sub}</small></div><div class="hpSkip">tap to skip</div>`;
    if (!document.getElementById('hpIntroCss')) { const st = document.createElement('style'); st.id = 'hpIntroCss'; st.textContent = `
#hpIntro{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;perspective:900px;background:radial-gradient(circle,rgba(26,12,70,.55),rgba(26,12,70,.15) 70%);animation:hpFade var(--d,1300ms) linear forwards;pointer-events:auto}
.hpCard{width:min(72vw,330px);padding:16px 16px 14px;border-radius:24px;background:#fff;text-align:center;box-shadow:0 9px 0 #2a0b57,0 0 0 5px #7e34f2,0 18px 40px rgba(0,0,0,.35);animation:hpCard var(--d,1300ms) cubic-bezier(.25,.8,.25,1) forwards;transform-style:preserve-3d}
.hpFlag{display:flex;flex-direction:column;height:clamp(70px,20vw,96px);border-radius:12px;overflow:hidden;margin-bottom:10px;box-shadow:inset 0 0 0 3px rgba(42,11,87,.15)} .hpFlag i{flex:1;display:block}
.hpFlag i.nor{background:linear-gradient(90deg,transparent 28%,#fff 28%,#fff 31%,#00205b 31%,#00205b 39%,#fff 39%,#fff 42%,transparent 42%),linear-gradient(0deg,transparent 40%,#fff 40%,#fff 44%,#00205b 44%,#00205b 56%,#fff 56%,#fff 60%,transparent 60%),#ba0c2f}
.hpFlag i.ak{background:radial-gradient(circle at 84% 20%,#ffd200 0 5.5%,transparent 6.5%),radial-gradient(circle at 12% 50%,#ffd200 0 3%,transparent 4%),radial-gradient(circle at 22% 56%,#ffd200 0 3%,transparent 4%),radial-gradient(circle at 31% 63%,#ffd200 0 3%,transparent 4%),radial-gradient(circle at 40% 69%,#ffd200 0 3%,transparent 4%),radial-gradient(circle at 43% 86%,#ffd200 0 3%,transparent 4%),radial-gradient(circle at 57% 88%,#ffd200 0 3%,transparent 4%),radial-gradient(circle at 60% 71%,#ffd200 0 3%,transparent 4%),#0f204b}
.hpCard b{display:block;font:400 clamp(32px,10vw,50px)/1 'FoxComic','Lilita One',sans-serif;color:#7e34f2;letter-spacing:.04em;-webkit-text-stroke:.05em #2a0b57;paint-order:stroke fill}
.hpCard small{display:block;margin-top:6px;font:700 clamp(12px,3.4vw,15px)/1.2 'Lilita One',sans-serif;color:#6a5aa0}
.hpSkip{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 54px);left:0;right:0;text-align:center;font:700 13px 'Lilita One',sans-serif;color:rgba(255,255,255,.75)}
@keyframes hpCard{0%{transform:rotateY(-540deg) scale(.3);opacity:0}52%{transform:rotateY(0) scale(1);opacity:1}76%{transform:rotateY(0) scale(1.04);opacity:1}100%{transform:rotateY(0) scale(6);opacity:0}}
@keyframes hpFade{0%,70%{opacity:1}100%{opacity:0}}`; document.head.appendChild(st); }
    document.body.appendChild(ov); ov.addEventListener('pointerdown', () => { S.intro.skip = true; ov.remove(); });
    await new Promise((res) => { const tick = () => { if (!S.intro) return res(); const t = performance.now() - S.intro.t0; if (t >= CARD || (S.intro.skip && !party)) return res(); requestAnimationFrame(tick); }; tick(); });
    ov.remove(); if (S.intro && S.intro.skip && !party) S.intro.t0 = performance.now() - CARD;   // (alone: the sweep starts now)
  },
  introCam(E, THREE, Pp) {   // the sweep: high and wide, looking back up the slope at the sky; round behind him; his riding view (where the follow camera starts)
    const I = S.intro, t = performance.now() - I.t0, u = ss5((t - I.card * 0.75) / (I.sweep - I.card * 0.75)), sl = Math.atan(S.SL);
    const P = (dx, dy, dz) => new THREE.Vector3(Pp.x + dx, Pp.y + dy, Pp.z + dz), b2 = (a, b, c, k) => a.clone().multiplyScalar((1 - k) * (1 - k)).add(b.clone().multiplyScalar(2 * k * (1 - k))).add(c.clone().multiplyScalar(k * k));
    const pos = b2(P(7, 12, -9), P(-13, 8, -13), P(0, 2.6, -6.2), u), look = b2(P(-8, 6, 90), P(4, 0, 26), P(0, 0.7, 4), u);   // (S5: higher and looking out further first: the valley, the forest, the lights and the sky, over the arches)   // (first out over the valley: the night sky, the mountains, the lit slope; then round behind him)
    E.cam(pos, look, u >= 1 ? 8 : 40, 60 - 8 * (1 - u)); if (u >= 1) I.done = true; },
  async run(E) {
    if (S.ran) { S.runN = (S.runN || 0) + 1; this.course(E); } S.ran = true;   // (R2: PLAY AGAIN = a new order)
    this.reset(E); S.phase = 'drop'; fxRoot();   // (H33: the answer-button styles are there from the first question)
    await this.intro(E);   // (S4: the location card spins in and zooms into the place; the camera sweeps down to him during the count)
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', S.loc && S.loc.id === 'alaska' ? `${QN} QUESTIONS · NATURAL JUMPS · ICE CAVE · BIG LINE` : S.loc && S.loc.id === 'norway' ? `${QN} QUESTIONS · PARK · FOREST PATH · FROZEN RIVER` : `${QN} QUESTIONS · KICKERS · RAILS · PIPE · BIG AIR`, 900); S.phase = 'line';
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
        // (S2: the question on the approach, in slow motion up to the hop, so the trick (its 270 or shifty on) is known before he gets on)
        await E.until(() => (S.phase === 'line' && S.s >= F.a - 1.4 - Math.max(4, S.v) * 1.25) || (S.phase === 'rail' && S.rail === F));
        S.asking = true; const r = await ask(F.name, slowTo(Math.max(0.3, (F.a - 1.4 - S.s) / Math.max(2, S.v)))); S.asking = false; S.hit++; let due = 0;
        const onIt = S.phase === 'rail' && S.rail === F;
        if (r.ok) { const T = RAIL_TRICKS[Math.min(RAIL_TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))], sc = score(r, T[2]); S.rt = { T, z0: onIt ? S.s : null, rail: F }; due = sc.pts; trickCard(T[0], E.combo, false, sc.chip); }
        else { S.wob = 1.3; S.railWob = true; S.railFall = true; trickCard(r.timeout ? 'TOO SLOW!' : 'WOBBLE!', 0, true); }
        react(r); await E.until(() => S.phase === 'rail' && S.rail === F); await E.until(() => S.phase !== 'rail'); if (due) free(due);
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
        { const c0 = E.combo; S.asking = true; const r = await ask(`${BIG.name || 'BIG AIR'} 1`, slowTo((BIG.s + BIG.len - S.s) / Math.max(3, S.v))); S.asking = false; S.hit++;
          if (r.ok) { const T = ladder(r), sc = score(r, T[5]); giveTrick({ T, f0: 0.1, f1: 0.46 }, false, 'bair'); due += sc.pts; trickCard(T[0], E.combo, false, sc.chip); }
          else { failed = true; giveTrick(S.a.isClip ? { T: failTrick(c0), f0: 0.1, f1: 0.995, fail: true } : null, true, 'bair'); trickCard(r.timeout ? 'TOO SLOW!' : 'WIPEOUT!', 0, true); }
          react(r); }
        await E.until(() => S.phase !== 'line' || S.s > BIG.s + BIG.len + 1);
        if (!failed) { await E.until(() => S.phase !== 'bair' || S.air / S.airT >= 0.52);
          if (S.phase === 'bair') { const c0 = E.combo; S.asking = true; const r = await ask(`${BIG.name || 'BIG AIR'} 2`, slowTo((0.93 - S.air / S.airT) * S.airT * 0.6)); S.asking = false; S.hit++; const f = S.air / S.airT;
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
      bannerFade(E, rdt); lookTick(E); if (S.phase === 'drop' && S.intro) this.introCam(E, THREE, Pp); else E.cam(new THREE.Vector3(Pp.x + Math.cos(ang) * 3.6, Pp.y + 1.5, Pp.z + Math.sin(ang) * 3.6), new THREE.Vector3(Pp.x, Pp.y + 0.8, Pp.z), 3, 50);
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
        const RT = S.rt, tg = RT ? RT.T[1] : 0, sg = Math.sign(tg) || 1, zin = RT && RT.z0 != null ? RT.z0 : R.a - 1.4, fin = Math.max(0, Math.min(1, (z - zin) / 2.4)), fout = Math.max(0, Math.min(1, (z - (R.b - 1)) / 3));
        { const y0 = RT && RT.T[4] === '270' ? tg - sg * 1.5 * Math.PI : 0, y1 = RT && RT.T[5] === '270' ? tg + sg * 1.5 * Math.PI : Math.abs(tg) > 2 ? tg + Math.PI : 0;   // (S2: the trick's turn on the hop, its turn off)
          S.railYaw = fout > 0 ? tg + (y1 - tg) * ss5(fout) : y0 + (tg - y0) * ss5(fin); S.railClip = !RT ? 'ride' : RT.T[4] === 'shifty' && fin < 0.85 ? 'shifty' : RT.T[3];
          if (RT && RT.z0 != null && z < RT.z0 + 2.4) y += 0.3 * Math.sin(Math.PI * fin);   // (a trick decided on the rail: a little hop into it)
          if (RT && RT.T[3] === 'press' && !(a.has && a.has.press)) pitch -= 0.22 * Math.min(fin, 1 - fout);   // (no press clip yet: the whole rider tips onto the nose)
          if (S.railWob) S.wob = Math.max(S.wob, 0.6); }
        if (z < R.a + 1) { const f = smoothStep((z - (R.a - 1.4)) / 2.4); y = (railH(R, z) + top) * f + 0.45 * Math.sin(Math.PI * f); }
        else if (z < R.b - 1) { y = railH(R, z) + top; pitch = R.arch ? Math.atan(R.arch * Math.PI / (R.b - R.a) * Math.cos(Math.PI * (z - R.a) / (R.b - R.a))) : 0; if (dt > 0.002 && Math.random() < 0.5) E.spray.emit(a.g.position, 1, 0, 0.6, 0, 0.5, 0.07); }
        else { const f = Math.min(1, (z - (R.b - 1)) / 3); y = (railH(R, R.b - 1) + top) * (1 - f) + 0.5 * Math.sin(Math.PI * f); if (f >= 1) { S.phase = 'line'; S.landT = 0.25; S.head = Math.atan2(Math.sin(S.railYaw || 0), Math.cos(S.railYaw || 0)); S.rt = null; S.railWob = false; S.railYaw = 0; S.railClip = ''; E.shake(0.2); E.spray.emit(a.g.position, 14, 0, 2, 0, 1.5); if (S.railFall) { S.railFall = false; this.wipe(E); } else if (S.a.smile) S.a.smile(0.9); }   /* (F5: off a rail cleanly = a smile) */ }
        crouch = 0.5; if (S.wob > 0) roll += Math.sin(t * 9) * 0.12 * Math.min(1, S.wob);
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
    if (S.gap && S.gap.kind === 'rockgap' && dt > 0 && inGap(S.s + 10) && Math.random() < dt * 1.6) { const z = S.s + 6 + Math.random() * 16, k = gapClose(z); if (k > 0.4) { const sd = Math.random() < 0.5 ? -1 : 1, hw = gapHW(z), x = X(z) + sd * (hw + 1.4); E.spray.emit(new THREE.Vector3(x, gY(x, z) + 1.2 + 11 * k * 0.95, z), 10, -sd * 1.1, -0.4, 0, 1.4, 0.18); } }   // (R4: snow drifting off the rock tops)
    if (S.gap && S.gap.kind === 'igloo') { if (IG.t < 0 && S.s >= S.gap.exit - 3.4) iglooSmash(E); iglooTick(E, dt); iglooFire(E, dt); }   // (R6, R8: the campfire)
    const wx = X(S.s) + S.d; a.g.position.set(wx, -S.s * S.SL + y + V(S.s), S.s);   // (R3: on the route: its swing sideways, its rolls)
    const dd = dt > 1e-5 ? (wx - (S.dPrev ?? wx)) / dt : 0; S.dPrev = wx;   // (he faces where he goes: down the route's turns too)
    S.pT = (S.pT ?? 9) + rdt; S.head = (S.phase === 'cross' || S.phase === 'air') && S.pHead != null && S.fall <= 0 ? E.damp(S.head || 0, S.pHead, S.pT < 0.7 ? 6 : 30, rdt) :   /* (S1: a gentle carve into the first crossing) */ E.damp(S.head || 0, S.phase === 'air' ? S.side * 1.25 : S.phase === 'rail' ? (S.railYaw ?? 0) : Math.atan2(dd, Math.max(2, S.v)), 10, rdt);
    S.pitch = E.damp(S.pitch || 0, pitch, 12, rdt);
    a.g.rotation.set(0, 0, 0); a.g.rotateX(SLA()); a.g.rotateZ(roll); a.g.rotateY(S.head); a.g.rotateX(-S.pitch); if (S.fr) a.g.rotateZ(S.fr);
    if (a.fox) a.fox.root.rotation.x = E.damp(a.fox.root.rotation.x, AIRS[S.phase] || S.phase === 'stop' || S.phase === 'menu' || S.phase === 'drop' ? 0 : LEAN, 6, rdt);   // (riding: his body a little forward over the board, the board stays flush)
    if (AIRS[S.phase]) { a.g.rotateY(S.spin); a.g.rotateZ(S.cork || 0); a.g.rotateX(S.flip); }
    const air = !!AIRS[S.phase], gkk = act ? Math.min(1, Math.sin(Math.PI * act.k) * 1.6) : 0;
    if (a.isClip) { S.landClk = air ? 0.75 : Math.max(0, (S.landClk || 0) - dt);
      if (air) S.wasOops = S.phase === 'air' ? S.trick === OOPS : S.bOops; if (S.fall > 0) S.landClk = 0.4;
      if (a.has) S.noSpot = !a.has.spot_land; if (S.tc && /^grab_/.test(S.tc[0])) S.lastGrab = S.tc[0];
      const pumpOn = S.phase === 'cross' && S.pr && S.u > 0.5 && Math.abs(S.d) > S.FLAT - 0.6, st = { pump: pumpOn ? Math.max(0.7, Math.min(2, ((a.dur && a.dur.pump) || 1) / Math.max(0.2, (1 - S.u) * S.pr.Tc))) : 0, has: a.has || (a.has = Object.fromEntries((a.clips || []).map((c) => [c, 1]))), fall: S.fall > 0, rail: S.phase === 'rail', railClip: S.railClip || 'ride', lastGrab: S.lastGrab || '', ph: air ? 'air' : S.phase === 'stop' ? 'stop' : 'cross', u: S.phase === 'cross' ? S.u : 0.5, air: S.air / S.airT, tr: act ? act.T[0] : '', gk: act && act.T[4] ? act.T[4] : '', gkk: act ? act.k : 0, gs: 1.2 / Math.max(0.3, 0.5 * S.airT), landT: !air && S.landClk > 0 && S.landClk < 0.75 ? S.landClk : 0, oops: S.wasOops, roll, tc: S.tc, fallBack: !!S.fallBack };
      const [cl, sp] = clipFor(st); if (cl !== S.clip) { S.clip = cl; a.want(cl, cl.startsWith('grab_') ? 0.1 : 0.18, sp); } a.update(dt); S.clipSt = st; }
    else { a.pose(P, 12, rdt); a.update(); }
    E.mpSend({ ph: S.phase, s: S.s, d: S.d, y: a.g.position.y + S.s * S.SL - V(S.s), roll, head: S.head, pitch: S.pitch, fr: S.fr || 0, spin: S.spin, flip: S.flip, cork: S.cork || 0, tr: act ? act.T[0] : S.phase === 'air' && S.trick === OOPS ? 'OOPS' : '', gk: act && act.T[4] ? act.T[4] : '', gkk, pts: S.pts, n: S.airN || 0, cl: S.clip || '', cs: S.clipSt ? clipFor(S.clipSt)[1] : 1 });
    if (S.ghost && E.MP.on) this.friendGhost(E, t, rdt);
    else if (S.ghost && E.friend && E.friend.p != null) { const gs = E.friend.p * S.L; S.ghost.g.visible = true; S.ghost.g.position.set(X(gs) - S.d * 0.8, -gs * S.SL + V(gs) + pipeY(Math.abs(S.d * 0.8)), gs); S.ghost.g.rotation.set(0, 0, -Math.sign(S.d) * wallAng(Math.abs(S.d * 0.8))); S.ghost.pose(this.ridePose(t + 1, 0.5), 8, rdt); S.ghost.update(); }
    const nx = FEAT.find((f) => (f.k === 'pipe' ? !(S.pN >= HITS && S.phase !== 'cross' && S.phase !== 'air') : f.k === 'big' ? !S.b1 || S.phase === 'bair' : !S.done[f.id] || (S.kick === f && S.phase === 'kair') || (S.rail === f && S.phase === 'rail')));
    const where = !nx ? 'FINISH' : nx.k === 'big' ? (BIG.name || 'BIG AIR') : nx.k === 'pipe' ? `HALFPIPE · AIR ${Math.min(HITS, S.pN + (S.phase === 'air' ? 0 : 1))} OF ${HITS}` : nx.name;
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
    if (inGap(pos.z) && (S.gap.kind === 'tunnel' || S.gap.kind === 'icecave')) pos.y = Math.min(pos.y, gY(X(pos.z), pos.z) + S.gap.h - 1.4);   // (R5: under the tunnel's roof)
    if (S.gap && S.gap.kind === 'igloo' && S.phase !== 'stop' && P.z > S.gap.ent - 14 && P.z < S.gap.exit + 5) { const cz = P.z - 4.4; pos.set(X(cz) + Math.max(-0.8, Math.min(0.8, (P.x - X(P.z)) * 0.5)), gY(X(cz), cz) + 1.55, cz); look.y = Math.min(look.y, P.y + 0.8); k = Math.max(k, 6); }   // (R6: low and close through the igloo)
    // every shot aims THROUGH him, seen from where the camera is now (so he stays in the horizontal centre even while the camera moves)
    const C = E.camera.position, dx = P.x - C.x, dz = P.z - C.z, dl = Math.hypot(dx, dz);
    // (the aim point is put at his own distance, the height scaled to keep the same tilt: it moves exactly with him, never swings wider)
    if (dl > 0.5) { const L = Math.max(0.5, Math.hypot(look.x - C.x, look.z - C.z)), f = dl / L; look.y = C.y + (look.y - C.y) * f; look.x = P.x; look.z = P.z; }
    // (the camera smooths its aim, which trails a fast rider by speed / rate: aim that far ahead along his sideways motion, so he stays centred)
    const CV = S.camV || (S.camV = { x: 0, px: P.x, ok: false }); if (rdt > 0) { const vx = CV.ok ? (P.x - CV.px) / rdt : 0; CV.x = E.damp(CV.x, Math.max(-25, Math.min(25, vx)), 12, rdt); CV.px = P.x; CV.ok = true; }
    look.x += CV.x / (k * 1.6);
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
    bannerFade(E, rdt); lookTick(E); signPlace(E);   // (H33: the question's 3D sign)
  },
};
function smoothStep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
