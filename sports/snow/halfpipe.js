// HALFPIPE (the snowboard run): a night course under the floodlights, top to bottom down the pipe. (2026-11-25, the user: "make there more
// jumps starting with classic jump going on to sliding bar going on to 3 question U ramp and finishing of with 2 question big jump")
//   1. a classic kicker (a free 360 melon)   2. a candy-cane rail (a boardslide)   3. the U-ramp: 3 airs, a question at the top of each
//   4. the BIG AIR: one long jump, 2 questions in the air. Right words = big tricks (bigger with every right answer in a row); highest score wins.
// With a friend: each phone shows the friend one kicker-length behind (when you land the first jump, they are just leaving its lip).
const HITS = 3, QN = 5;   // (the pipe airs; all the questions)
const KICK = { s: 16, len: 4, lip: 1.0, w: 3.6, back: 1.4, T: 1.05, H: 1.4 };   // the classic kicker (s: where its ramp starts, metres down the pipe)
const BIG = { s: 136, len: 7, lip: 2.2, w: 5.2, back: 2.6, T: 2.6, H: 4.2 };    // the big air kicker
const RAIL = { a: 44, b: 57, h: 0.5 };                                           // the rail (from, to, height)
const PIPE_IN = 64, GAP = 9.6;   // (where the U-ramp starts; the friend's distance behind: the kicker's air, so they take off as you land)
const KICK_T = ['360 MELON', 1, 0, 0, 'melon', 150], RAIL_T = ['BOARDSLIDE', 0, 0, 0, '', 100];
// (2026-11-24, the user: "Add more tricks each one getting more insane based on your streak … show count up points for each trick going to total
// score") 12 tricks, one step up the ladder for every right answer in a row (a perfect, quick answer jumps one more). [name, spins, flips, cork tilt, grab, points]
const TRICKS = [
  ['180 INDY', 0.5, 0, 0, 'indy', 100], ['360 MELON', 1, 0, 0, 'melon', 150], ['BACKFLIP', 0, 1, 0, 'indy', 200], ['540 TAIL GRAB', 1.5, 0, 0, 'tail', 250],
  ['FRONTFLIP 360', 1, -1, 0, 'melon', 320], ['720 METHOD', 2, 0, 0, 'method', 380], ['CORK 540', 1.5, 0, 1, 'indy', 450], ['900 STALEFISH', 2.5, 0, 0, 'stale', 520],
  ['DOUBLE BACKFLIP', 0, 2, 0, 'tail', 620], ['CORK 1080', 3, 0, 1, 'method', 750], ['DOUBLE CORK 1260', 3.5, 0, 2, 'stale', 900], ['TRIPLE CORK 1440!!', 4, 0, 3, 'method', 1200]];
const OOPS = ['OOPS', 0, 0, 0, '', 20];
const S = { a: null, ghost: null, L: 190, SL: Math.tan(17 * Math.PI / 180), R: 5.6, FLAT: 4.6, WALLV: 0.4, s: 0, d: 0, side: 1, phase: 'menu', u: 0, air: 0, airT: 1.15, airH: 3.2, trick: null, spin: 0, flip: 0, pts: 0, hit: 0, v: 8, wob: 0, landT: 0, shotT: 0, asking: false, airTr: [], fbuf: [] };
const W = () => S.FLAT + S.R;
function pipeY(ad) { if (ad <= S.FLAT) return 0; if (ad <= W()) { const x = ad - S.FLAT; return S.R - Math.sqrt(Math.max(0, S.R * S.R - x * x)); } return S.R + S.WALLV; }
function wallAng(ad) { if (ad <= S.FLAT) return 0; return Math.asin(Math.min(1, (ad - S.FLAT) / S.R)); }

export const _S = S;
// (2026-11-25) the Snowboard Foxino with his own clips: ?nb=1 while it is tested (the old rider stays the default until then)
const NB = /[?&]nb=1/.test(location.search);   /* (2026-11-25 02:00: the old rider is the default again for the school test: the new Snowboard Foxino read dark and hunched at phone size; ?nb=1 = the new one) */
// the clip for where he is: on the walls he carves, at the lips he pumps, in the air a tuck or the trick's grab, then the landing
function clipFor(st) {
  if (st.ph === 'menu' || st.ph === 'drop') return ['stance_idle', 1];
  if (st.ph === 'stop' || st.ph === 'out' && st.u > 0.7) return ['cheer', 1];
  if (st.ph === 'air') { if (st.gk && st.gkk > 0.02) return ['grab_' + st.gk, st.gs || 1]; return st.air < 0.32 && !st.tr ? ['takeoff', 1.3] : ['air_tuck', 1]; }
  if (st.landT > 0) return [st.oops ? 'land_wobble' : 'land', st.oops ? 1.2 : 1.4];
  if (st.u > 0.86) return ['pump', 1.2];
  return [st.roll > 0.2 ? 'carve_left' : st.roll < -0.2 ? 'carve_right' : 'ride', 1];
}
let FX = null; function fxRoot() { if (FX) return FX; const st = document.createElement('style'); st.textContent = `
#trickCard{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 84px);transform:translateX(-50%) scale(.5);opacity:0;z-index:31;pointer-events:none;text-align:center;font-family:'Lilita One','Arial Black',sans-serif;white-space:nowrap}
#trickCard.go{animation:tcIn .35s cubic-bezier(.2,1.7,.4,1) forwards} #trickCard.out{animation:none;transition:opacity .3s,transform .3s;opacity:0;transform:translateX(-50%) translateY(-16px) scale(.9)} body.asking #trickCard{display:none}
#trickCard b{display:block;font-size:clamp(24px,7vw,40px);font-weight:400;color:#fff;-webkit-text-stroke:2px #2a1e5c;paint-order:stroke fill;text-shadow:0 4px 0 #2a1e5c,0 0 18px rgba(255,120,220,.6)}
#trickCard i{display:inline-block;margin-top:4px;padding:3px 10px;border-radius:999px;background:#ff5fa8;color:#fff;font-style:normal;font-size:clamp(12px,3.4vw,15px);box-shadow:0 3px 0 #2a1e5c}
#trickCard.lv3 b{color:#ffe27a} #trickCard.lv6 b{color:#7fe8ff;font-size:clamp(28px,8vw,46px)} #trickCard.lv9 b{color:#ff9ad6;font-size:clamp(30px,8.6vw,50px);animation:tcShake .12s linear infinite}
#trickCard.oops b{color:#ffb0b0}
.scoreFly{position:fixed;z-index:32;pointer-events:none;transform:translate(-50%,-50%);font:400 clamp(30px,8vw,48px)/1 'Lilita One',sans-serif;color:#ffe27a;-webkit-text-stroke:2px #2a1e5c;paint-order:stroke fill;text-shadow:0 4px 0 #2a1e5c,0 0 22px rgba(255,214,90,.8)}
body:has(#trickCard) #combo{display:none} #hudBig.bump{animation:hbBump .4s cubic-bezier(.2,1.8,.4,1)} 
@keyframes tcIn{to{opacity:1;transform:translateX(-50%) scale(1)}} @keyframes tcShake{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-1px)}75%{transform:translate(-1px,1px)}} @keyframes hbBump{0%{transform:scale(1)}40%{transform:scale(1.5);color:#ffe27a}100%{transform:scale(1)}}`;
  document.head.appendChild(st); FX = document.createElement('div'); FX.id = 'trickCard'; document.body.appendChild(FX); return FX; }
function trickCard(name, streak, oops = false) { const c = fxRoot(); c.className = ''; void c.offsetWidth; c.innerHTML = `<b>${name}</b>${streak >= 2 ? `<i>🔥 ${streak} in a row</i>` : ''}`;
  c.classList.add('go'); if (oops) c.classList.add('oops'); else if (streak >= 9) c.classList.add('lv9'); else if (streak >= 6) c.classList.add('lv6'); else if (streak >= 3) c.classList.add('lv3'); }
// on landing: the trick's points count up over Foxino, then fly into the total at the top, which ticks up and bumps
async function scoreFly(E, pts, at) { const c = fxRoot(); const v = at.clone().project(E.camera); let x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x = Math.max(70, Math.min(innerWidth - 70, x)); y = Math.max(150, Math.min(innerHeight - 120, y));
  const d = document.createElement('div'); d.className = 'scoreFly'; d.style.left = x + 'px'; d.style.top = y + 'px'; d.textContent = '+0'; document.body.appendChild(d);
  const t0 = performance.now(), up = 520; let last = -1; S.shown = S.pts;
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t0) / up), n = Math.round(pts * (1 - Math.pow(1 - k, 3))); d.textContent = '+' + n; if ((n / 10 | 0) !== last) { last = n / 10 | 0; try { E.sfx.click && E.sfx.click(); } catch (e) {} } if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  c.classList.add('out'); await new Promise((r) => setTimeout(r, 180));
  const hb = document.getElementById('hudBig').getBoundingClientRect(), tx = hb.left + hb.width / 2, ty = hb.top + hb.height / 2, t1 = performance.now(), fly = 430;
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t1) / fly), e = k * k * (3 - 2 * k); d.style.left = (x + (tx - x) * e) + 'px'; d.style.top = (y + (ty - y) * e - Math.sin(Math.PI * k) * 60) + 'px'; d.style.transform = `translate(-50%,-50%) scale(${1 - 0.55 * e})`; if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  d.remove(); const from = S.pts, t2 = performance.now(), tick = 450; const hbEl = document.getElementById('hudBig'); hbEl.classList.remove('bump'); void hbEl.offsetWidth; hbEl.classList.add('bump'); try { E.sfx.star && E.sfx.star(); } catch (e) {}
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t2) / tick); S.shown = from + pts * k; if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); S.shown = null; }
const AIRS = { air: 1, kair: 1, bair: 1 };   // (the three kinds of air: pipe, kicker, big air)
const kickH = (K, z) => K.lip * Math.pow(Math.max(0, Math.min(1, (z - K.s) / K.len)), 1.7);
const kickSlope = (K, z) => { const zz = Math.max(0, Math.min(1, (z - K.s) / K.len)); return K.lip * 1.7 * Math.pow(zz, 0.7) / K.len; };
// a kicker made in code: the curved ramp up to the lip, a short table, the back down to the snow; a blue line on the lip
function makeKicker(THREE, K, mat, lipMat, sideMat) {
  const prof = [], n = 12; for (let i = 0; i <= n; i++) prof.push([K.len * i / n, K.lip * Math.pow(i / n, 1.7)]); prof.push([K.len + 0.35, K.lip]); prof.push([K.len + 0.35 + K.back, 0]);
  const hw = K.w / 2, Y = (z, h) => -(K.s + z) * S.SL + h, Z = (z) => K.s + z, pos = [], side = [];
  const quad = (a, b, c, d, o = pos) => o.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < prof.length - 1; i++) { const [z0, h0] = prof[i], [z1, h1] = prof[i + 1];
    quad([-hw, Y(z0, h0) + 0.02, Z(z0)], [hw, Y(z0, h0) + 0.02, Z(z0)], [hw, Y(z1, h1) + 0.02, Z(z1)], [-hw, Y(z1, h1) + 0.02, Z(z1)]);
    for (const x of [-hw, hw]) quad([x, Y(z0, -0.3), Z(z0)], [x, Y(z0, h0) + 0.02, Z(z0)], [x, Y(z1, h1) + 0.02, Z(z1)], [x, Y(z1, -0.3), Z(z1)], side); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true;
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(side, 3)); g2.computeVertexNormals(); const sm = new THREE.Mesh(g2, sideMat); sm.receiveShadow = true;   // (the sides a pale blue: the kicker reads against the snow)
  const lipB = new THREE.Mesh(new THREE.BoxGeometry(K.w + 0.04, 0.09, 0.36), lipMat); lipB.position.set(0, Y(K.len + 0.17, K.lip) + 0.06, Z(K.len + 0.17));
  const grp = new THREE.Group(); grp.add(m, sm, lipB); return grp;
}
// the rail: a candy-cane bar on three posts
function makeRail(THREE) {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 16, 64); x.fillStyle = '#e8304a'; x.fillRect(0, 0, 16, 32);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  const A = new THREE.Vector3(0, -RAIL.a * S.SL + RAIL.h, RAIL.a), B = new THREE.Vector3(0, -RAIL.b * S.SL + RAIL.h, RAIL.b), len = A.distanceTo(B);
  tx.repeat.set(1, len / 0.5);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8, 1), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35, metalness: 0.2 }));
  bar.position.copy(A).lerp(B, 0.5); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); bar.castShadow = true;
  const g = new THREE.Group(); g.add(bar); const postM = new THREE.MeshStandardMaterial({ color: 0x5b5f8c, roughness: 0.6 });
  for (const f of [0.04, 0.5, 0.96]) { const p = A.clone().lerp(B, f), post = new THREE.Mesh(new THREE.BoxGeometry(0.1, RAIL.h + 0.3, 0.1), postM); post.position.set(0, p.y - (RAIL.h + 0.3) / 2, p.z); g.add(post); }
  return g;
}
export default {
  id: 'halfpipe', blurb: 'A kicker, a rail, the halfpipe and a BIG AIR. Right words make big tricks!',
  light: { sky: 'alpine-night', skyYaw: 0.1, skyBase: 0.3, skySpan: 1.0, sunDir: [0.3, 0.85, -0.35], sun: 0xf2f4ff, sunI: 2.3, hemiSky: 0x7f96ff, hemiGround: 0x34307a, hemi: 0.65, rim: 0x8fd6ff, rimI: 1.4, exposure: 1.05, fog: [60, 330], fogColor: 0x3a3f9a, env: 0.25, flakes: 500, flakeA: 0.8 },
  bestShown: (s) => `${s} points`,
  async build(E, prog) {
    const { THREE } = E;
    const [g, J] = await Promise.all([E.loadGLB('models/halfpipe.glb?v=1'), E.loadJSON('models/halfpipe.json?v=1')]);
    Object.assign(S, { L: J.length, SL: Math.tan(J.slope * Math.PI / 180), R: J.R, FLAT: J.flat, WALLV: J.wallV });
    E.dressModel(g.scene, { banner: (n) => (n === 'Banner' ? E.bannerMaterial('DROP IN', '#36b5e0') : E.bannerMaterial('FINISH', '#ff4d6d')) });
    E.scene.add(g.scene); prog(30, 'Planting the trees…');
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
    E.scene.add(E.instanceField(J.props.map((p) => [0, p[1], p[2], p[3], p[4], 1]), () => 'Floodlight', 400));
    // the floodlights' glow on the snow: a few warm point lights along the pipe (no shadows), the "sun" is the main floodlight
    for (let i = 0; i < 4; i++) { const pl = new THREE.PointLight(0xffe2b0, 60, 55, 1.6); pl.position.set(i % 2 ? 9 : -9, -((20 + i * 48) * S.SL) + 12, 20 + i * 48); E.scene.add(pl); }
    // the course on the pipe's floor: the kicker, the rail, the big air kicker
    const snow = new THREE.MeshStandardMaterial({ color: 0xf2f5ff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), lip = new THREE.MeshStandardMaterial({ color: 0x36b5e0, roughness: 0.5, emissive: 0x0d3a52 }), sideM = new THREE.MeshStandardMaterial({ color: 0x9fb4f2, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    E.scene.add(makeKicker(THREE, KICK, snow, lip, sideM), makeKicker(THREE, BIG, snow, lip, sideM), makeRail(THREE));
    await E.addMountains(-240, 0x8890c8);
    prog(60, 'Waxing the board…');
    S.a = NB ? await E.makeBoarder() : await E.makeActor({ gear: 'board' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = NB ? await E.makeBoarder({ friend: true }) : await E.makeActor({ gear: 'board', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; S.ghost.g.traverse((o) => { o.castShadow = false; o.userData.noCast = true; }); }   /* (2026-11-25: the friend casts no shadow: under 100k a frame) */
    E.groundAt = (x, z) => -z * S.SL + pipeY(Math.abs(x)) - 0.2;
    E.drawDist = E.MP.on ? 140 : 170;   /* (2026-11-24: 260 → 170 m: the bigger airs look further down the pipe; under 100k a frame) */
    this.reset(E);
  },
  xmas(E, X) {
    if (!X.ok) return; const { THREE } = E, W0 = W(), deckY = (z) => -z * S.SL + S.R + S.WALLV, P = (x, z, dy = 0) => new THREE.Vector3(x, deckY(z) + dy, z);
    for (const sd of [1, -1]) for (let z0 = -6; z0 < S.L + 6; z0 += 30) { const posts = []; for (let z = z0; z <= z0 + 30; z += 6) posts.push(P(sd * (W0 + 0.45), z, 1.15)); X.lights(posts, { sag: 0.25, per: 6, size: 0.14, glow: 1.1 }); }
    for (let z = 28, i = 0; z < S.L; z += 36, i++) { const sd = i % 2 ? 1 : -1;
      X.put('XmasTree_Big', P(sd * (W0 + 4.2), z), i, 1.3); X.put('XmasTree_Small', P(-sd * (W0 + 3.4), z + 12), -i, 1.8);
      X.put(['Gift_A', 'Gift_B', 'Gift_C'][i % 3], P(sd * (W0 + 2.4), z - 1.5), i); X.put('Gift_B', P(sd * (W0 + 2.7), z + 1.4), -i);
      if (i % 2 === 0) X.put('Snowman', P(-sd * (W0 + 2.2), z - 6), sd * 1.2); }
    for (const sd of [1, -1]) { X.put('Lantern', P(sd * (W0 + 1.2), -4), sd); X.put('CandyCane', P(sd * (W0 + 0.9), 4), sd); X.put('XmasTree_Small', P(sd * (W0 + 3), -8), sd, 1.6); }
    X.put('XmasTree_Big', new THREE.Vector3(0, -(S.L + 14) * S.SL - 0.3, S.L + 14), 0.4, 2.2);
    // (2026-11-25) lights along both sides of the big air kicker, and at the rail's ends
    for (const sd of [1, -1]) { const posts = []; for (let i = 0; i <= 6; i++) { const z = BIG.s + (BIG.len + 0.35) * i / 6; posts.push(new THREE.Vector3(sd * (BIG.w / 2 + 0.1), -z * S.SL + kickH(BIG, z) + 0.5, z)); } X.lights(posts, { sag: 0.1, per: 4, size: 0.1, glow: 1.1 }); }
    X.put('CandyCane', new THREE.Vector3(1.2, -(RAIL.a - 1) * S.SL, RAIL.a - 1), 1); X.put('CandyCane', new THREE.Vector3(-1.2, -(RAIL.b + 1) * S.SL, RAIL.b + 1), -1); X.put('Sleigh', P(W0 + 3.5, S.L - 4), 2.4);
  },
  reset(E) { Object.assign(S, { airN: 0, pN: 0, s: 1, d: 0, side: 1, phase: 'menu', u: 0, air: 0, trick: null, airTr: [], bOops: false, spin: 0, flip: 0, cork: 0, pts: 0, shown: null, due: 0, hit: 0, v: 4, wob: 0, landT: 0, shotT: 0, asking: false, k1: 0, r1: 0, p1: 0, b1: 0, head: 0, fbuf: [], fAt: 0, fTrickK: '' }); E.snapCam(); },
  menu() { S.phase = 'menu'; },
  async run(E) {
    this.reset(E); S.phase = 'drop';
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', 'KICKER · RAIL · PIPE · BIG AIR', 900); S.phase = 'line';
    const at = (dy = 1.5) => S.a.g.position.clone().setY(S.a.g.position.y + dy);
    let chain = Promise.resolve();   // (the free points fly into the total one after another)
    const free = (T) => { chain = chain.then(() => scoreFly(E, T[5], at())).then(() => { S.pts += T[5]; E.send({ p: Math.min(0.95, S.s / 186), v: `${S.pts}` }); }); };
    // 1) the classic kicker: a 360 melon for free
    await E.until(() => S.phase === 'kair'); S.airTr = [{ T: KICK_T, f0: 0.12, f1: 0.86 }]; trickCard(KICK_T[0], 0);
    await E.until(() => S.phase !== 'kair'); free(KICK_T);
    // 2) the rail: a boardslide
    await E.until(() => S.phase === 'rail' && S.s >= RAIL.a + 1); trickCard(RAIL_T[0], 0);
    await E.until(() => S.phase !== 'rail'); free(RAIL_T);
    // 3) the U-ramp: a question at the top of each of the 3 airs
    for (let i = 0; i < HITS; i++) {
      await E.until(() => S.phase === 'air' && S.pN > i && S.air > 0.42 * S.airT);
      S.asking = true;
      const r = await E.ask({ who: `HALFPIPE · AIR ${i + 1} OF ${HITS}`, num: `${S.pts} pts`, size: 0.95,
        anchors: (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.9), out, 2.3, 1.5) });
      S.asking = false; S.hit++;
      if (r.ok) { const T = TRICKS[Math.min(TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))]; S.trick = T; S.due = T[5] + (r.grade === 'perfect' ? 25 : 0); trickCard(T[0], E.combo); E.juice(r, at(1.4), ''); }
      else { S.trick = OOPS; S.due = 20; S.wob = 1.2; trickCard('OOPS!', 0, true); E.juice(r, at(1.4), ''); }
      S.spin = 0; S.flip = 0;
      await E.until(() => S.phase !== 'air'); await chain; await scoreFly(E, S.due, at()); S.pts += S.due; S.due = 0;
      E.send({ p: Math.min(0.95, S.s / 186), v: `${S.pts}` });
    }
    // 4) the BIG AIR: two questions in one long jump, a trick for each right word
    await E.until(() => S.phase === 'bair' && S.air / S.airT >= 0.16); let due = 0;
    for (let q = 0; q < 2; q++) {
      if (q === 1) await E.until(() => S.phase !== 'bair' || S.air / S.airT >= 0.56);
      if (S.phase !== 'bair') break;
      S.asking = true;
      const r = await E.ask({ who: `BIG AIR · QUESTION ${q + 1} OF 2`, num: `${S.pts} pts`, size: 0.95,
        anchors: (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.9), out, 2.3, 1.5) });
      S.asking = false; S.hit++; const f = S.air / S.airT;
      if (r.ok) { const T = TRICKS[Math.min(TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))]; S.airTr.push({ T, f0: f + 0.02, f1: Math.min(0.95, f + 0.33) }); due += T[5] + (r.grade === 'perfect' ? 25 : 0); trickCard(T[0], E.combo); E.juice(r, at(1.4), ''); }
      else { S.bOops = true; due += 20; trickCard('OOPS!', 0, true); E.juice(r, at(1.4), ''); }
    }
    await E.until(() => S.phase !== 'bair'); await chain; if (due) { await scoreFly(E, due, at()); S.pts += due; }
    E.send({ p: 1, v: `${S.pts}` });
    await E.until(() => S.phase === 'stop');
    E.banner(`${S.pts}`, 'POINTS', 1800); E.cine(true); E.shake(0.3);
    await E.wait(2.4); E.cine(false);
    E.finish({ score: S.pts, shown: `${S.pts}`, unit: 'points', better: 'high', line: `${QN} questions` });
  },
  // takeoff from a kicker: a parabola from the lip down to the slope (heights over the slope line)
  takeoff(E, ph, K) { S.phase = ph; S.air = 0; S.airT = K.T; S.airH = K.H; S.lip = K.lip; S.airN = (S.airN || 0) + 1; if (ph === 'bair') S.airTr = []; S.bOops = false; S.trick = null; E.spray.emit(S.a.g.position, 16, 0, 3, 3, 1.6); },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E;
    let y = 0, roll = 0, pitch = 0, P, act = null;
    if (S.phase === 'menu' || S.phase === 'drop') {
      S.s = 1; S.d = 0; S.v = 4; y = 0;
      a.g.position.set(0, -S.s * S.SL, S.s); a.g.rotation.set(0, 0, 0);
      if (a.isClip) { a.want('stance_idle'); a.update(dt || rdt); } else { a.pose(this.ridePose(t, 0), 8, rdt); a.update(); }
      const Pp = a.g.position, ang = t * 0.15 + 0.6;
      E.cam(new THREE.Vector3(Pp.x + Math.cos(ang) * 3.6, Pp.y + 1.5, Pp.z + Math.sin(ang) * 3.6), new THREE.Vector3(Pp.x, Pp.y + 0.8, Pp.z), 3, 50);
      E.focusAt = Pp; E.focus = 4; E.hud('0', 'SNOWBOARD'); if (S.ghost && E.MP.on) this.friendGhost(E, t, rdt); return;
    }
    S.s += S.v * dt;
    if (S.phase === 'cross' || S.phase === 'out') {
      // from one lip across the flat to the other lip (u: 0 -> 1)
      S.u += dt / 1.55;
      const u = Math.min(1, S.u);
      S.d = -S.side * W() * Math.cos(Math.PI * u);
      y = pipeY(Math.abs(S.d)); roll = Math.sign(S.d) * wallAng(Math.abs(S.d));
      S.wob = Math.max(0, S.wob - dt);
      P = S.wob > 0 ? E.SP.wobble(t) : this.ridePose(t, Math.sin(Math.PI * u));
      if (Math.abs(S.d) < S.FLAT && dt > 0.002) E.spray.emit(a.g.position, 1, 0, 0.8, 0, 0.8, 0.09);
      if (S.pN >= HITS && S.u >= 0.5) { S.phase = 'line'; S.d = 0; }   // (the 3 pipe airs done: straight down the middle to the big air)
      else if (S.u >= 1) { const lv = Math.min(11, E.combo); S.phase = 'air'; S.airN = (S.airN || 0) + 1; S.pN++; S.air = 0; S.airT = 1.15 + lv * 0.06; S.airH = 3.2 + lv * 0.16; S.trick = null; E.spray.emit(a.g.position, 14, 0, 3, 0, 1.6); }
    } else if (S.phase === 'air') {
      S.air += dt; const f = Math.min(1, S.air / S.airT);
      S.d = S.side * (W() + 0.25 * Math.sin(Math.PI * f));
      y = S.R + S.WALLV * 0.5 + 4 * S.airH * f * (1 - f) * (S.trick === OOPS ? 0.55 : 1);
      // the trick: spins round the vertical, flips; a grab in the middle
      const T = S.trick, k = T ? smoothStep((S.air - 0.42 * S.airT) / (0.5 * S.airT)) : 0;
      S.spin = T ? T[1] * Math.PI * 2 * k : 0; S.flip = T ? T[2] * Math.PI * 2 * k : 0; S.cork = T ? T[3] * 0.55 * Math.sin(Math.PI * k) : 0;
      if (T && T !== OOPS && k > 0.02 && k < 0.99) act = { T, k };
      P = T && T !== OOPS && k > 0.08 && k < 0.93 ? this.grabPose(t, T[4], Math.min(1, Math.sin(Math.PI * k) * 1.6)) : this.ridePose(t, 0.6 + (f < 0.12 || f > 0.88 ? 0.4 : 0));
      if (f >= 1) { S.phase = 'cross'; S.u = 0; S.side = -S.side; S.spin = 0; S.flip = 0; S.landT = 0.25; E.shake(0.25); E.spray.emit(a.g.position, 20, 0, 2.5, 0, 2); }
    } else if (S.phase === 'line' || S.phase === 'rail' || S.phase === 'end') {
      // the course down the middle: speed up for the kickers, steady over the rail, slower into the pipe, flat out to the big air
      const z = S.s; let tv = z < KICK.s + KICK.len ? 9 : z < PIPE_IN - 4 ? 8.5 : S.pN >= HITS ? 12 : 6.5; if (S.phase === 'end') tv = 0;
      S.v = S.v < tv ? Math.min(tv, S.v + 3 * dt) : Math.max(tv, S.v - (S.phase === 'end' ? 6 : 3) * dt);
      S.d = E.damp(S.d, 0, 3, dt); y = pipeY(Math.abs(S.d)); S.wob = Math.max(0, S.wob - dt);
      let crouch = 0.25;
      if (S.phase === 'rail') {
        if (z < RAIL.a + 1) { const f = smoothStep((z - (RAIL.a - 1.4)) / 2.4); y = RAIL.h * f + 0.45 * Math.sin(Math.PI * f); }
        else if (z < RAIL.b - 1) { y = RAIL.h + 0.07; if (dt > 0.002 && Math.random() < 0.5) E.spray.emit(a.g.position, 1, 0, 0.6, 0, 0.5, 0.07); }
        else { const f = Math.min(1, (z - (RAIL.b - 1)) / 3); y = (RAIL.h + 0.07) * (1 - f) + 0.5 * Math.sin(Math.PI * f); if (f >= 1) { S.phase = 'line'; S.landT = 0.25; E.shake(0.2); E.spray.emit(a.g.position, 14, 0, 2, 0, 1.5); } }
        crouch = 0.5;
      } else if (S.phase === 'line') {
        for (const K of [KICK, BIG]) if (z >= K.s && z < K.s + K.len) { y += kickH(K, z); pitch = Math.atan(kickSlope(K, z)); crouch = 0.4 + 0.5 * (z - K.s) / K.len; }
        if (!S.k1 && z >= KICK.s + KICK.len) { S.k1 = 1; this.takeoff(E, 'kair', KICK); }
        else if (!S.r1 && z >= RAIL.a - 1.4) { S.r1 = 1; S.phase = 'rail'; }
        else if (!S.p1 && z >= PIPE_IN) { S.p1 = 1; S.phase = 'cross'; S.u = 0.5; S.side = 1; }
        else if (!S.b1 && S.pN >= HITS && z >= BIG.s + BIG.len) { S.b1 = 1; this.takeoff(E, 'bair', BIG); }
        if (S.phase === 'kair' || S.phase === 'bair') y = pipeY(0) + S.lip;
      } else if (S.v < 0.4) { S.phase = 'stop'; S.v = 0; }
      P = S.wob > 0 ? E.SP.wobble(t) : S.phase === 'stop' ? E.SP.cheer(t) : this.ridePose(t, crouch);
      if (S.phase === 'line' && Math.abs(S.d) < 1 && dt > 0.002 && Math.random() < 0.4) E.spray.emit(a.g.position, 1, 0, 0.8, 0, 0.8, 0.09);
    } else if (S.phase === 'kair' || S.phase === 'bair') {
      S.air += dt; const f = Math.min(1, S.air / S.airT);
      S.d = E.damp(S.d, 0, 3, dt); y = S.lip * (1 - f) + 4 * S.airH * f * (1 - f) * (S.bOops ? 0.8 : 1);
      S.spin = 0; S.flip = 0; S.cork = 0;
      for (const tr of S.airTr) { const k = smoothStep((f - tr.f0) / Math.max(0.05, tr.f1 - tr.f0)); S.spin += tr.T[1] * Math.PI * 2 * k; S.flip += tr.T[2] * Math.PI * 2 * k; S.cork += tr.T[3] * 0.55 * Math.sin(Math.PI * k); if (k > 0.02 && k < 0.99) act = { T: tr.T, k }; }
      P = act && act.T[4] && act.k > 0.08 && act.k < 0.93 ? this.grabPose(t, act.T[4], Math.min(1, Math.sin(Math.PI * act.k) * 1.6)) : this.ridePose(t, 0.6 + (f < 0.12 || f > 0.88 ? 0.4 : 0));
      if (f >= 1) { const big = S.phase === 'bair'; S.phase = big ? 'end' : 'line'; S.spin = 0; S.flip = 0; S.cork = 0; S.landT = 0.25; S.wob = S.bOops ? 1.2 : 0; E.shake(big ? 0.5 : 0.3); E.spray.emit(a.g.position, big ? 40 : 22, 0, 2.5, 3, 2.4); }
    } else { P = E.SP.cheer(t); y = pipeY(Math.abs(S.d)); }
    // place: on the wall the board stands on the wall (roll), on a kicker it tips up, in the air the trick turns him
    a.g.position.set(S.d, -S.s * S.SL + y, S.s);
    const dd = dt > 1e-5 ? (S.d - (S.dPrev ?? S.d)) / dt : 0; S.dPrev = S.d;
    S.head = E.damp(S.head || 0, S.phase === 'air' ? S.side * 1.25 : S.phase === 'rail' ? Math.PI / 2 : Math.atan2(dd, Math.max(2, S.v)), 10, rdt);
    S.pitch = E.damp(S.pitch || 0, pitch, 12, rdt);
    a.g.rotation.set(0, 0, 0); a.g.rotateZ(roll); a.g.rotateY(S.head); a.g.rotateX(-S.pitch);
    if (AIRS[S.phase]) { a.g.rotateY(S.spin); a.g.rotateZ(S.cork || 0); a.g.rotateX(S.flip); }
    const air = !!AIRS[S.phase], gkk = act ? Math.min(1, Math.sin(Math.PI * act.k) * 1.6) : 0;
    if (a.isClip) { S.landClk = air ? 0.75 : Math.max(0, (S.landClk || 0) - dt);
      if (air) S.wasOops = S.phase === 'air' ? S.trick === OOPS : S.bOops;
      const st = { ph: air ? 'air' : S.phase === 'stop' ? 'stop' : 'cross', u: S.phase === 'cross' ? S.u : 0.5, air: S.air / S.airT, tr: act ? act.T[0] : '', gk: act && act.T[4] ? act.T[4] : '', gkk: act ? act.k : 0, gs: 1.2 / Math.max(0.3, 0.5 * S.airT), landT: !air && S.landClk > 0 && S.landClk < 0.75 ? S.landClk : 0, oops: S.wasOops, roll };
      const [cl, sp] = clipFor(st); if (cl !== S.clip) { S.clip = cl; a.want(cl, cl.startsWith('grab_') ? 0.1 : 0.18, sp); } a.update(dt); S.clipSt = st; }
    else { a.pose(P, 12, rdt); a.update(); }
    E.mpSend({ ph: S.phase, s: S.s, d: S.d, y: a.g.position.y + S.s * S.SL, roll, head: S.head, pitch: S.pitch, spin: S.spin, flip: S.flip, cork: S.cork || 0, tr: act ? act.T[0] : S.phase === 'air' && S.trick === OOPS ? 'OOPS' : '', gk: act && act.T[4] ? act.T[4] : '', gkk, pts: S.pts, n: S.airN || 0, cl: S.clip || '', cs: S.clipSt ? clipFor(S.clipSt)[1] : 1 });
    if (S.ghost && E.MP.on) this.friendGhost(E, t, rdt);
    else if (S.ghost && E.friend && E.friend.p != null) { const gs = E.friend.p * S.L; S.ghost.g.visible = true; S.ghost.g.position.set(-S.d * 0.8, -gs * S.SL + pipeY(Math.abs(S.d * 0.8)), gs); S.ghost.g.rotation.set(0, 0, -Math.sign(S.d) * wallAng(Math.abs(S.d * 0.8))); S.ghost.pose(this.ridePose(t + 1, 0.5), 8, rdt); S.ghost.update(); }
    const where = S.s < KICK.s + KICK.len + 12 ? 'KICKER' : S.s < RAIL.b + 3 ? 'RAIL' : S.pN < HITS || S.phase === 'cross' || S.phase === 'air' ? `HALFPIPE · AIR ${Math.min(HITS, S.pN + (S.phase === 'air' ? 0 : 1))} OF ${HITS}` : 'BIG AIR';
    E.hud(`${Math.round(S.shown ?? S.pts)}`, where); E.progress(Math.min(1, S.s / 186));
    this.camera(E, rdt);
  },
  ridePose(t, crouch) { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    const c = 0.45 + 0.35 * crouch, b = 0.01 * Math.sin(t * 6);
    p.legL = [-c * 0.6, 0, 0.32]; p.legR = [-c * 0.6, 0, -0.32]; p.kneeL = [c * 1.3, 0, 0]; p.kneeR = [c * 1.3, 0, 0]; p.ankleL = [-c * 0.7, 0, -0.25]; p.ankleR = [-c * 0.7, 0, 0.25];
    p.spine = [0.25 + crouch * 0.2, 0, 0]; p.head = [-0.2, 0.55, 0]; p.armL = [-0.3, 0, 0.95]; p.armR = [-0.3, 0, -0.95]; p.elbowL = [-0.5, 0, 0]; p.elbowR = [-0.5, 0, 0];
    p.y = -0.08 - crouch * 0.07 + b; return p; },
  // (2026-11-25, the user: "when you go with your friend you are going behind each other like when you land the first jump hes already leaving
  // the ground for that same jump like that far from each other") the friend's run is kept by where they were on the course (metres down the
  // pipe), and shown GAP metres behind us: their own airs, tricks and grabs at the same spots. If they are really further back, they are shown
  // where they really are.
  friendGhost(E, t, rdt) {
    const G = S.ghost, F = E.mpFriend, { THREE } = E; if (!F || !E.MP.alive) { G.g.visible = false; return; }
    const B = S.fbuf;
    if (F.at !== S.fAt && F.ph && F.ph !== 'menu' && F.ph !== 'drop' && F.s != null) { S.fAt = F.at; if (!B.length || F.s >= B[B.length - 1].s) B.push(Object.assign({}, F)); }
    if (!B.length) {   // (the friend is still at the top: standing there, until they drop in)
      if (S.phase === 'menu' || S.phase === 'drop' || F.ph === 'menu' || F.ph === 'drop') { G.g.visible = true; G.g.position.set(-2.2, -1 * S.SL, 1); G.g.rotation.set(0, 0, 0); if (G.isClip) { G.want('stance_idle'); G.update(rdt); } else { G.pose(this.ridePose(t + 0.7, 0), 8, rdt); G.update(); } }
      else G.g.visible = false;
      return; }
    const want = S.s - GAP; let A0, A1, k = 0;
    if (B[B.length - 1].s <= want) A0 = A1 = B[B.length - 1]; else if (B[0].s >= want) A0 = A1 = B[0];
    else { let lo = 0, hi = B.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m].s <= want) lo = m; else hi = m; } A0 = B[lo]; A1 = B[hi]; k = (want - A0.s) / Math.max(1e-4, A1.s - A0.s); }
    const same = A0.ph === A1.ph, L = (p) => (A0[p] ?? 0) + ((A1[p] ?? 0) - (A0[p] ?? 0)) * k, Fr = k < 0.5 ? A0 : A1, Ang = (p) => (same ? L(p) : Fr[p] || 0);
    const gs = L('s'), pos = new THREE.Vector3(L('d'), -gs * S.SL + L('y'), gs);
    if (!G.g.visible || G.g.position.distanceTo(pos) > 12) G.g.position.copy(pos); else G.g.position.lerp(pos, 1 - Math.exp(-rdt * 16));
    G.g.visible = true; G.g.rotation.set(0, 0, 0); G.g.rotateZ(Ang('roll')); G.g.rotateY(Ang('head')); G.g.rotateX(-Ang('pitch'));
    const air = !!AIRS[Fr.ph]; if (air) { G.g.rotateY(Ang('spin')); G.g.rotateZ(Ang('cork')); G.g.rotateX(Ang('flip')); }
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
    if (S.phase === 'air') {
      // from the bottom of the pipe, looking up at him over the lip
      const up = Math.max(0, (S.airH || 3.2) - 3.2);   /* (bigger airs on a long streak: the camera backs off a little and keeps up) */
      pos = new THREE.Vector3(S.side * (3.5 + up * 0.4), -(S.s - 7.5) * S.SL + S.R * 0.9 + up * 0.6, S.s - 7.5 - up * 0.6); look = new THREE.Vector3(P.x, P.y + 0.9, P.z); k = 6; fov = 60 + up * 2;
    } else if (S.phase === 'kair' || (S.phase === 'line' && S.s > KICK.s - 4 && S.s < KICK.s + KICK.len + GAP + 2)) {
      // the kicker from below its landing, looking back up the hill: he flies at us, the friend behind him leaves the same lip
      const zc = KICK.s + KICK.len + GAP + 5; pos = new THREE.Vector3(3.2, -zc * S.SL + 2.4, zc); look = new THREE.Vector3(P.x * 0.5, P.y + 0.4, P.z - 1.5); k = 4; fov = 58;
    } else if (S.phase === 'bair' || S.phase === 'end' || (S.phase === 'line' && S.pN >= HITS && S.s > BIG.s - 12)) {
      // the big air: ahead of him and to the side, looking back up at the jump (the friend comes over the kicker behind)
      const zc = S.s + 8.5; pos = new THREE.Vector3(4.8, -zc * S.SL + 2.8 + Math.max(0, P.y + zc * S.SL - 3) * 0.35, zc); look = new THREE.Vector3(P.x * 0.5, P.y + 0.5, P.z - 1); k = S.asking ? 3 : 4.5; fov = 62;
    } else if (S.phase === 'stop') {
      pos = new THREE.Vector3(P.x + 2.5, P.y + 1.5, P.z + 4.5); look = P.clone().setY(P.y + 0.8); k = 2; fov = 50;
    } else {
      // following down the pipe, a little above
      pos = new THREE.Vector3(P.x * 0.7, P.y + 2.6, S.s - 6.2); look = new THREE.Vector3(P.x * 0.85, P.y + 0.7, P.z + 4); k = 5; fov = 60;
    }
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
function smoothStep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
