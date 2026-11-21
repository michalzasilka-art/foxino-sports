// HALFPIPE: a night run on a snowboard under the floodlights. Foxino rides from wall to wall; at the top of every air
// the world slows and three word bubbles float round him: the right word = a big trick (bigger with every right answer in a
// row), a wrong word = a small, wobbly air. 8 airs, the points add up. Highest score wins.
const HITS = 8;
const TRICKS = [['180', 0.5, 0], ['360', 1, 0], ['540 GRAB', 1.5, 0], ['BACKFLIP', 0, 1], ['720 INDY', 2, 0], ['900!', 2.5, 0], ['CORK 720', 2, 1], ['1080!', 3, 0]];
const S = { a: null, ghost: null, L: 190, SL: Math.tan(17 * Math.PI / 180), R: 5.6, FLAT: 4.6, WALLV: 0.4, s: 0, d: 0, side: 1, phase: 'menu', u: 0, air: 0, airT: 1.15, airH: 3.2, trick: null, spin: 0, flip: 0, pts: 0, hit: 0, v: 8, wob: 0, landT: 0, shotT: 0, asking: false };
const W = () => S.FLAT + S.R;
function pipeY(ad) { if (ad <= S.FLAT) return 0; if (ad <= W()) { const x = ad - S.FLAT; return S.R - Math.sqrt(Math.max(0, S.R * S.R - x * x)); } return S.R + S.WALLV; }
function wallAng(ad) { if (ad <= S.FLAT) return 0; return Math.asin(Math.min(1, (ad - S.FLAT) / S.R)); }

export const _S = S;
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
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'board', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; }
    E.groundAt = (x, z) => -z * S.SL + pipeY(Math.abs(x)) - 0.2;
    E.drawDist = 260;
    this.reset(E);
  },
  reset(E) { Object.assign(S, { airN: 0, s: -3, d: -W(), side: 1, phase: 'menu', u: 0, air: 0, trick: null, spin: 0, flip: 0, pts: 0, hit: 0, v: 6.5, wob: 0, landT: 0, shotT: 0, asking: false }); E.snapCam(); },
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
      if (r.ok) { const T = TRICKS[Math.min(TRICKS.length - 1, E.combo - 1 + (r.grade === 'perfect' ? 1 : 0))]; S.trick = T; const p = 55 + Math.min(40, E.combo * 6) + (r.grade === 'perfect' ? 5 : 0); S.pts += p; E.juice(r, head, `${T[0]} · +${p}`); }
      else { S.trick = ['OOPS', 0, 0]; S.pts += 20; S.wob = 1.2; E.juice(r, head, '+20'); }
      S.spin = 0; S.flip = 0;
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
        else { S.phase = 'air'; S.airN = (S.airN || 0) + 1; S.air = 0; S.airT = 1.15; S.trick = null; E.spray.emit(a.g.position, 14, 0, 3, 0, 1.6); }
      }
      if (S.phase === 'out' && S.u > 0.5) { S.v = Math.max(0, S.v - 6 * dt); S.d = E.damp(S.d, 0, 2, dt); y = pipeY(Math.abs(S.d)); if (S.v < 0.5) S.phase = 'stop'; }
    } else if (S.phase === 'air') {
      S.air += dt; const f = Math.min(1, S.air / S.airT);
      S.d = S.side * (W() + 0.25 * Math.sin(Math.PI * f));
      y = S.R + S.WALLV * 0.5 + 4 * S.airH * f * (1 - f) * (S.trick && S.trick[0] === 'OOPS' ? 0.55 : 1);
      roll = S.side * Math.PI / 2 * (1 - 2 * f) * 0.0;
      // the trick: spins round the vertical, flips; a grab in the middle
      const T = S.trick, k = T ? smoothStep((S.air - 0.42 * S.airT) / (0.5 * S.airT)) : 0;
      S.spin = T ? T[1] * Math.PI * 2 * k : 0; S.flip = T ? T[2] * Math.PI * 2 * k : 0;
      P = T && T[0] !== 'OOPS' && k > 0.1 && k < 0.92 ? this.grabPose(t) : this.ridePose(t, 0.6);
      if (f >= 1) { S.phase = 'cross'; S.u = 0; S.side = -S.side; S.spin = 0; S.flip = 0; S.landT = 0.25; E.shake(0.25); E.spray.emit(a.g.position, 20, 0, 2.5, 0, 2); }
    } else { P = E.SP.cheer(t); y = pipeY(Math.abs(S.d)); }
    // place: on the wall the board stands on the wall (roll), in the air the trick turns him
    a.g.position.set(S.d, -S.s * S.SL + y, S.s);
    const face = S.phase === 'air' ? -S.side : (S.d >= 0 ? 1 : -1) * (S.phase === 'cross' && S.u < 0.5 ? -1 : 1);
    const dd = dt > 1e-5 ? (S.d - (S.dPrev ?? S.d)) / dt : 0; S.dPrev = S.d;
    S.head = E.damp(S.head || 0, S.phase === 'air' ? S.side * 1.25 : Math.atan2(dd, Math.max(2, S.v)), 10, rdt);
    a.g.rotation.set(0, 0, 0); a.g.rotateX(-S.SL * 0.0); a.g.rotateZ(roll); a.g.rotateY(S.head);
    if (S.phase === 'air') { a.g.rotateY(S.spin); a.g.rotateX(S.flip); }
    void face;
    a.pose(P, 12, rdt); a.update();
    if (S.ghost && E.friend && E.friend.p != null) { const gs = E.friend.p * S.L; S.ghost.g.visible = true; S.ghost.g.position.set(-S.d * 0.8, -gs * S.SL + pipeY(Math.abs(S.d * 0.8)), gs); S.ghost.g.rotation.set(0, 0, -Math.sign(S.d) * wallAng(Math.abs(S.d * 0.8))); S.ghost.pose(this.ridePose(t + 1, 0.5), 8, rdt); S.ghost.update(); }
    E.hud(`${S.pts}`, `AIR ${Math.min(HITS, S.hit + (S.phase === 'air' ? 1 : 0))} OF ${HITS}`); E.progress(S.hit / HITS);
    this.camera(E, rdt);
  },
  ridePose(t, crouch) { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    const c = 0.45 + 0.35 * crouch, b = 0.01 * Math.sin(t * 6);
    p.legL = [-c * 0.6, 0, 0.32]; p.legR = [-c * 0.6, 0, -0.32]; p.kneeL = [c * 1.3, 0, 0]; p.kneeR = [c * 1.3, 0, 0]; p.ankleL = [-c * 0.7, 0, -0.25]; p.ankleR = [-c * 0.7, 0, 0.25];
    p.spine = [0.25 + crouch * 0.2, 0, 0]; p.head = [-0.2, 0.55, 0]; p.armL = [-0.3, 0, 0.95]; p.armR = [-0.3, 0, -0.95]; p.elbowL = [-0.5, 0, 0]; p.elbowR = [-0.5, 0, 0];
    p.y = -0.08 - crouch * 0.07 + b; return p; },
  grabPose(t) { const p = this.ridePose(t, 1); p.legL = [-1.2, 0, 0.3]; p.legR = [-1.2, 0, -0.3]; p.kneeL = [1.9, 0, 0]; p.kneeR = [1.9, 0, 0];
    p.armR = [-1.3, 0, -0.15]; p.elbowR = [-0.3, 0, 0]; p.armL = [-0.2, 0, 1.6]; p.elbowL = [-0.2, 0, 0]; p.spine = [0.5, 0, 0]; p.y = 0.05; return p; },
  camera(E, rdt) {
    const { THREE } = E, P = S.a.g.position; S.shotT += rdt;
    let pos, look, k = 4, fov = 60;
    if (S.phase === 'air' || S.asking) {
      // from the bottom of the pipe, looking up at him over the lip
      pos = new THREE.Vector3(S.side * 3.5, -(S.s - 7.5) * S.SL + S.R * 0.9, S.s - 7.5); look = new THREE.Vector3(P.x, P.y + 0.9, P.z); k = 3.5; fov = 60;
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
