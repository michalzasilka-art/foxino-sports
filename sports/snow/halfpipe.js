// HALFPIPE: a night run on a snowboard under the floodlights. Foxino rides from wall to wall; at the top of every air
// the world slows and three word bubbles float round him: the right word = a big trick (bigger with every right answer in a
// row), a wrong word = a small, wobbly air. 8 airs, the points add up. Highest score wins.
const HITS = 8;
// (2026-11-24, the user: "Add more tricks each one getting more insane based on your streak … show count up points for each trick going to total
// score") 12 tricks, one step up the ladder for every right answer in a row (a perfect, quick answer jumps one more). [name, spins, flips, cork tilt, grab, points]
const TRICKS = [
  ['180 INDY', 0.5, 0, 0, 'indy', 100], ['360 MELON', 1, 0, 0, 'melon', 150], ['BACKFLIP', 0, 1, 0, 'indy', 200], ['540 TAIL GRAB', 1.5, 0, 0, 'tail', 250],
  ['FRONTFLIP 360', 1, -1, 0, 'melon', 320], ['720 METHOD', 2, 0, 0, 'method', 380], ['CORK 540', 1.5, 0, 1, 'indy', 450], ['900 STALEFISH', 2.5, 0, 0, 'stale', 520],
  ['DOUBLE BACKFLIP', 0, 2, 0, 'tail', 620], ['CORK 1080', 3, 0, 1, 'method', 750], ['DOUBLE CORK 1260', 3.5, 0, 2, 'stale', 900], ['TRIPLE CORK 1440!!', 4, 0, 3, 'method', 1200]];
const OOPS = ['OOPS', 0, 0, 0, '', 20];
const S = { a: null, ghost: null, L: 190, SL: Math.tan(17 * Math.PI / 180), R: 5.6, FLAT: 4.6, WALLV: 0.4, s: 0, d: 0, side: 1, phase: 'menu', u: 0, air: 0, airT: 1.15, airH: 3.2, trick: null, spin: 0, flip: 0, pts: 0, hit: 0, v: 8, wob: 0, landT: 0, shotT: 0, asking: false };
const W = () => S.FLAT + S.R;
function pipeY(ad) { if (ad <= S.FLAT) return 0; if (ad <= W()) { const x = ad - S.FLAT; return S.R - Math.sqrt(Math.max(0, S.R * S.R - x * x)); } return S.R + S.WALLV; }
function wallAng(ad) { if (ad <= S.FLAT) return 0; return Math.asin(Math.min(1, (ad - S.FLAT) / S.R)); }

export const _S = S;
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
export default {
  id: 'halfpipe', blurb: 'Answer at the top of every air. Right words make big tricks!',
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
    await E.addMountains(-240, 0x8890c8);
    prog(60, 'Waxing the board…');
    S.a = await E.makeActor({ gear: 'board' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'board', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; S.ghost.g.traverse((o) => { o.castShadow = false; o.userData.noCast = true; }); }   /* (2026-11-25: the friend casts no shadow: under 100k a frame) */
    E.groundAt = (x, z) => -z * S.SL + pipeY(Math.abs(x)) - 0.2;
    E.drawDist = E.MP.on ? 140 : 170;   /* (2026-11-24: 260 → 170 m: the bigger airs look further down the pipe; under 100k a frame) */
    this.reset(E);
  },
  // Christmas (2026-11-24): lights along both lips, decorated trees, gifts and snowmen on the decks, a big tree past the finish
  xmas(E, X) {
    if (!X.ok) return; const { THREE } = E, W0 = W(), deckY = (z) => -z * S.SL + S.R + S.WALLV, P = (x, z, dy = 0) => new THREE.Vector3(x, deckY(z) + dy, z);
    for (const sd of [1, -1]) for (let z0 = -6; z0 < S.L + 6; z0 += 30) { const posts = []; for (let z = z0; z <= z0 + 30; z += 6) posts.push(P(sd * (W0 + 0.45), z, 1.15)); X.lights(posts, { sag: 0.25, per: 6, size: 0.14, glow: 1.1 }); }
    for (let z = 28, i = 0; z < S.L; z += 36, i++) { const sd = i % 2 ? 1 : -1;
      X.put('XmasTree_Big', P(sd * (W0 + 4.2), z), i, 1.3); X.put('XmasTree_Small', P(-sd * (W0 + 3.4), z + 12), -i, 1.8);
      X.put(['Gift_A', 'Gift_B', 'Gift_C'][i % 3], P(sd * (W0 + 2.4), z - 1.5), i); X.put('Gift_B', P(sd * (W0 + 2.7), z + 1.4), -i);
      if (i % 2 === 0) X.put('Snowman', P(-sd * (W0 + 2.2), z - 6), sd * 1.2); }
    for (const sd of [1, -1]) { X.put('Lantern', P(sd * (W0 + 1.2), -4), sd); X.put('CandyCane', P(sd * (W0 + 0.9), 4), sd); X.put('XmasTree_Small', P(sd * (W0 + 3), -8), sd, 1.6); }
    X.put('XmasTree_Big', new THREE.Vector3(0, -(S.L + 14) * S.SL - 0.3, S.L + 14), 0.4, 2.2); X.put('Sleigh', P(W0 + 3.5, S.L - 4), 2.4);
  },
  reset(E) { Object.assign(S, { airN: 0, s: -3, d: -W(), side: 1, phase: 'menu', u: 0, air: 0, trick: null, spin: 0, flip: 0, cork: 0, pts: 0, shown: null, due: 0, hit: 0, v: 6.5, wob: 0, landT: 0, shotT: 0, asking: false }); E.snapCam(); },
  menu() { S.phase = 'menu'; },
  async run(E) {
    this.reset(E); S.phase = 'drop';
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('DROP IN!', 'HALFPIPE', 900); S.phase = 'cross'; S.u = 0; S.side = 1; S.d = -W();
    for (let i = 0; i < HITS; i++) {
      await E.until(() => S.phase === 'air' && S.airN > i && S.air > 0.42 * S.airT);
      S.asking = true;
      const r = await E.ask({ who: `AIR ${i + 1} OF ${HITS}`, num: `${S.pts} pts`, size: 0.95,
        anchors: (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.9), out, 2.3, 1.5) });
      S.asking = false; S.hit = i + 1;
      const head = S.a.g.position.clone().setY(S.a.g.position.y + 1.4);
      if (r.ok) { const T = TRICKS[Math.min(TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))]; S.trick = T; S.due = T[5] + (r.grade === 'perfect' ? 25 : 0); trickCard(T[0], E.combo); E.juice(r, head, ''); }
      else { S.trick = OOPS; S.due = 20; S.wob = 1.2; trickCard('OOPS!', 0, true); E.juice(r, head, ''); }
      S.spin = 0; S.flip = 0;
      await E.until(() => S.phase !== 'air'); await scoreFly(E, S.due, S.a.g.position.clone().setY(S.a.g.position.y + 1.5)); S.pts += S.due; S.due = 0;
      E.send({ p: (i + 1) / HITS, v: `${S.pts}` });
    }
    await E.until(() => S.phase === 'cross' && S.u > 0.5);
    S.phase = 'out';
    await E.until(() => S.phase === 'stop');
    E.banner(`${S.pts}`, 'POINTS', 1800); E.cine(true); E.shake(0.3);
    await E.wait(2.4); E.cine(false);
    E.finish({ score: S.pts, shown: `${S.pts}`, unit: 'points', better: 'high', line: `${HITS} airs` });
  },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E;
    let y = 0, roll = 0, P;
    if (S.phase === 'menu' || S.phase === 'drop') {
      S.s = -3; S.d = -W() - 1.5; y = S.R + S.WALLV;
      a.g.position.set(S.d, -S.s * S.SL + y, S.s); a.g.rotation.set(0, Math.PI * 0.5, 0);
      a.pose(this.ridePose(t, 0), 8, rdt); a.update();
      const Pp = a.g.position, ang = t * 0.15 + 0.6;
      E.cam(new THREE.Vector3(Pp.x + 1.5 + Math.cos(ang) * 3.6, Pp.y + 1.5, Pp.z + Math.sin(ang) * 3.6), new THREE.Vector3(Pp.x, Pp.y + 0.8, Pp.z), 3, 50);
      E.focusAt = Pp; E.focus = 4; E.hud('0', 'HALFPIPE'); return;
    }
    S.s += S.v * dt;
    if (S.phase === 'cross' || S.phase === 'out') {
      // from one lip across the flat to the other lip (u: 0 -> 1)
      S.u += dt / 1.55;
      const u = Math.min(1, S.u);
      S.d = -S.side * W() * Math.cos(Math.PI * u) * (S.phase === 'out' && u > 0.5 ? 1 - (u - 0.5) * 1.2 : 1);
      y = pipeY(Math.abs(S.d)); roll = Math.sign(S.d) * wallAng(Math.abs(S.d));
      S.wob = Math.max(0, S.wob - dt);
      P = S.wob > 0 ? E.SP.wobble(t) : this.ridePose(t, Math.sin(Math.PI * u));
      if (Math.abs(S.d) < S.FLAT && dt > 0.002) E.spray.emit(a.g.position, 1, 0, 0.8, 0, 0.8, 0.09);
      if (S.u >= 1) {
        if (S.phase === 'out') { S.phase = 'stop'; S.v = 0; }
        else { const lv = Math.min(11, E.combo); S.phase = 'air'; S.airN = (S.airN || 0) + 1; S.air = 0; S.airT = 1.15 + lv * 0.06; S.airH = 3.2 + lv * 0.16; S.trick = null; E.spray.emit(a.g.position, 14, 0, 3, 0, 1.6); }
      }
      if (S.phase === 'out' && S.u > 0.5) { S.v = Math.max(0, S.v - 6 * dt); S.d = E.damp(S.d, 0, 2, dt); y = pipeY(Math.abs(S.d)); if (S.v < 0.5) S.phase = 'stop'; }
    } else if (S.phase === 'air') {
      S.air += dt; const f = Math.min(1, S.air / S.airT);
      S.d = S.side * (W() + 0.25 * Math.sin(Math.PI * f));
      y = S.R + S.WALLV * 0.5 + 4 * S.airH * f * (1 - f) * (S.trick === OOPS ? 0.55 : 1);
      roll = S.side * Math.PI / 2 * (1 - 2 * f) * 0.0;
      // the trick: spins round the vertical, flips; a grab in the middle
      const T = S.trick, k = T ? smoothStep((S.air - 0.42 * S.airT) / (0.5 * S.airT)) : 0;
      S.spin = T ? T[1] * Math.PI * 2 * k : 0; S.flip = T ? T[2] * Math.PI * 2 * k : 0; S.cork = T ? T[3] * 0.55 * Math.sin(Math.PI * k) : 0;
      P = T && T !== OOPS && k > 0.08 && k < 0.93 ? this.grabPose(t, T[4], Math.min(1, Math.sin(Math.PI * k) * 1.6)) : this.ridePose(t, 0.6 + (f < 0.12 || f > 0.88 ? 0.4 : 0));
      if (f >= 1) { S.phase = 'cross'; S.u = 0; S.side = -S.side; S.spin = 0; S.flip = 0; S.landT = 0.25; E.shake(0.25); E.spray.emit(a.g.position, 20, 0, 2.5, 0, 2); }
    } else { P = E.SP.cheer(t); y = pipeY(Math.abs(S.d)); }
    // place: on the wall the board stands on the wall (roll), in the air the trick turns him
    a.g.position.set(S.d, -S.s * S.SL + y, S.s);
    const face = S.phase === 'air' ? -S.side : (S.d >= 0 ? 1 : -1) * (S.phase === 'cross' && S.u < 0.5 ? -1 : 1);
    const dd = dt > 1e-5 ? (S.d - (S.dPrev ?? S.d)) / dt : 0; S.dPrev = S.d;
    S.head = E.damp(S.head || 0, S.phase === 'air' ? S.side * 1.25 : Math.atan2(dd, Math.max(2, S.v)), 10, rdt);
    a.g.rotation.set(0, 0, 0); a.g.rotateX(-S.SL * 0.0); a.g.rotateZ(roll); a.g.rotateY(S.head);
    if (S.phase === 'air') { a.g.rotateY(S.spin); a.g.rotateZ(S.cork || 0); a.g.rotateX(S.flip); }
    void face;
    a.pose(P, 12, rdt); a.update();
    E.mpSend({ ph: S.phase, s: S.s, d: S.d, y: a.g.position.y + S.s * S.SL, roll, head: S.head, spin: S.spin, flip: S.flip, cork: S.cork || 0, tr: S.trick ? S.trick[0] : '', gk: S.trick && S.trick !== OOPS ? S.trick[4] : '', gkk: S.phase === 'air' && S.trick ? Math.min(1, Math.sin(Math.PI * smoothStep((S.air - 0.42 * S.airT) / (0.5 * S.airT))) * 1.6) : 0, pts: S.pts, n: S.airN || 0 });
    if (S.ghost && E.MP.on) this.friendGhost(E, t, rdt);
    else if (S.ghost && E.friend && E.friend.p != null) { const gs = E.friend.p * S.L; S.ghost.g.visible = true; S.ghost.g.position.set(-S.d * 0.8, -gs * S.SL + pipeY(Math.abs(S.d * 0.8)), gs); S.ghost.g.rotation.set(0, 0, -Math.sign(S.d) * wallAng(Math.abs(S.d * 0.8))); S.ghost.pose(this.ridePose(t + 1, 0.5), 8, rdt); S.ghost.update(); }
    E.hud(`${Math.round(S.shown ?? S.pts)}`, `AIR ${Math.min(HITS, S.hit + (S.phase === 'air' ? 1 : 0))} OF ${HITS}`); E.progress(S.hit / HITS);
    this.camera(E, rdt);
  },
  ridePose(t, crouch) { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    const c = 0.45 + 0.35 * crouch, b = 0.01 * Math.sin(t * 6);
    p.legL = [-c * 0.6, 0, 0.32]; p.legR = [-c * 0.6, 0, -0.32]; p.kneeL = [c * 1.3, 0, 0]; p.kneeR = [c * 1.3, 0, 0]; p.ankleL = [-c * 0.7, 0, -0.25]; p.ankleR = [-c * 0.7, 0, 0.25];
    p.spine = [0.25 + crouch * 0.2, 0, 0]; p.head = [-0.2, 0.55, 0]; p.armL = [-0.3, 0, 0.95]; p.armR = [-0.3, 0, -0.95]; p.elbowL = [-0.5, 0, 0]; p.elbowR = [-0.5, 0, 0];
    p.y = -0.08 - crouch * 0.07 + b; return p; },
  // (2026-11-25, multiplayer: "you and your friend ride right behind each other and can see each other's tricks") the friend rides just
  // behind us (their own rhythm from wall to wall, their own spins, flips and grabs), and their trick's name pops up over them
  friendGhost(E, t, rdt) {
    const G = S.ghost, F = E.mpFriend, { THREE } = E; if (!F || !E.MP.alive || F.ph === 'menu' || F.ph === 'drop' && S.phase === 'menu') { G.g.visible = false; return; }
    const gs = S.s - 4.2 + Math.max(-2.5, Math.min(2.5, ((F.s ?? S.s) - S.s) * 0.4));   // (just behind, wherever they really are)
    const want = new THREE.Vector3(F.d ?? 0, -gs * S.SL + (F.y ?? 0), gs);
    if (!G.g.visible || G.g.position.distanceTo(want) > 12) G.g.position.copy(want); else G.g.position.lerp(want, 1 - Math.exp(-rdt * 14));
    G.g.visible = true; G.g.rotation.set(0, 0, 0); G.g.rotateZ(F.roll || 0); G.g.rotateY(F.head || 0);
    if (F.ph === 'air') { G.g.rotateY(F.spin || 0); G.g.rotateZ(F.cork || 0); G.g.rotateX(F.flip || 0); }
    const P = F.ph === 'air' && F.gk && F.gkk > 0.05 ? this.grabPose(t + 0.5, F.gk, F.gkk) : F.ph === 'stop' ? E.SP.cheer(t) : this.ridePose(t + 0.7, F.ph === 'air' ? 0.6 : 0);
    G.pose(P, 12, rdt); G.update();
    if (F.ph === 'air' && F.tr && (F.n !== S.fTrickN) && !document.body.classList.contains('asking')) { S.fTrickN = F.n; E.pop(F.tr === 'OOPS' ? `${E.MP.fname}: OOPS!` : `${E.MP.fname}: ${F.tr}`, G.g.position.clone().setY(G.g.position.y + 1.6), F.tr === 'OOPS' ? 'bad' : 'good'); }
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
    if (S.phase === 'air' || S.asking) {
      // from the bottom of the pipe, looking up at him over the lip
      const up = Math.max(0, (S.airH || 3.2) - 3.2);   /* (bigger airs on a long streak: the camera backs off a little and keeps up) */
      pos = new THREE.Vector3(S.side * (3.5 + up * 0.4), -(S.s - 7.5) * S.SL + S.R * 0.9 + up * 0.6, S.s - 7.5 - up * 0.6); look = new THREE.Vector3(P.x, P.y + 0.9, P.z); k = 6; fov = 60 + up * 2;
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
