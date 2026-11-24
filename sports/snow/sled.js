// SLED RUN: Foxino on a wooden toboggan down a winding forest track. Eight times the track splits into three lanes, each
// with a word bubble: the right lane is the star path (stars + a speed boost), the others are bumpy and slow. Fastest wins.
import { makePath } from './course.js?v=1';

const LANES = [4.4, 0, -4.4];
const S = { a: null, ghost: null, path: null, forks: [], L: 720, s: 0, d: 0, v: 0, time: 0, lane: -1, ok: true, stars: [], got: 0, bumpT: 0, phase: 'menu', asking: -1, shot: 'chase', shotT: 0, curve: 0.012 };
const groundY = (c, d) => c.p.y + S.curve * d * d;

export const _S = S;
export default {
  id: 'sled', blurb: 'Pick the lane with the right word: the star path is the fast one!',
  // (Christmas 2026-11-24: a snowy Christmas night under the moon; it was a sunny day: ?noxmas=1 shows the day again)
  light: /[?&]noxmas=1/.test(location.search) ? { sky: 'sunny', skyYaw: 0.75, sunDir: [-0.4, 0.62, 0.55], sun: 0xfff0d8, sunI: 2.5, hemiSky: 0xd8e8ff, hemiGround: 0x8f9ad0, hemi: 0.95, exposure: 0.95, fog: [120, 460], fogColor: 0xe4ecfb, env: 0.5, flakes: 300, flakeA: 0.5 }
    : { sky: 'night', skyYaw: 0.75, skyBase: 0.26, sunDir: [-0.35, 0.8, 0.45], sun: 0xeef0ff, sunI: 2.3, hemiSky: 0x8fa2ff, hemiGround: 0x3e3a86, hemi: 0.75, rim: 0x9fd8ff, rimI: 1.3, exposure: 1.05, fog: [70, 330], fogColor: 0x464d9e, env: 0.3, flakes: 480, flakeA: 0.8 },
  bestShown: (s) => `${s.toFixed(1)} s`,
  async build(E, prog) {
    const { THREE } = E;
    const [g, J] = await Promise.all([E.loadGLB('models/sled.glb?v=1'), E.loadJSON('models/sled.json?v=1')]);
    E.dressModel(g.scene); E.scene.add(g.scene); prog(30, 'Planting the forest…');
    S.J = J; S.path = makePath(J.center, J.step); S.L = J.length; S.forks = J.forks.map(([a, b]) => ({ a, b })); S.curve = J.curve;
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
    // the finish arch
    const fin = E.prop('Gate'), c = S.path.at(S.L); fin.scale.set(7.6, 3, 3); fin.position.copy(c.p); fin.rotation.y = c.yaw;
    fin.traverse((o) => { if (o.isMesh && o.material.name === 'Banner') o.material = E.bannerMaterial('FINISH', '#ff4d6d'); }); E.scene.add(fin);
    const st0 = E.prop('Gate'), c0 = S.path.at(2); st0.scale.set(7.6, 3, 3); st0.position.copy(c0.p); st0.rotation.y = c0.yaw;
    st0.traverse((o) => { if (o.isMesh && o.material.name === 'Banner') o.material = E.bannerMaterial('SLED RUN', '#36b5e0'); }); E.scene.add(st0);
    // the stars (moved onto the right lane when a fork is answered)
    for (let i = 0; i < 6; i++) { const st = E.prop('Star'); st.visible = false; st.scale.setScalar(1.2); E.scene.add(st); S.stars.push(st); }
    await E.addMountains(-240);
    prog(60, 'Polishing the sled…');
    S.a = await E.makeActor({ gear: 'sled' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'sled', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; }
    E.groundAt = (x, z) => { const s = S.path.nearest(x, z, S.s, 50); return S.path.at(s).p.y + 0.4; };
    E.drawDist = 200;
    this.reset(E);
  },
  // Christmas (2026-11-24): fairy lights along both edges of the run, decorated trees, gifts and snowmen beside it, a big tree at every fork
  xmas(E, X) {
    if (!X.ok) return; const { THREE } = E, hw = S.J.trackHalf, up = new THREE.Vector3(0, 1.1, 0), at = (s, side, w, dy = 0) => { const c = S.path.at(s); return c.p.clone().addScaledVector(c.nrm, side * w).setY(c.p.y + dy); };
    for (const sd of [1, -1]) for (let s0 = 6; s0 < S.L; s0 += 32) { const posts = []; for (let s = s0; s <= Math.min(S.L, s0 + 32); s += 8) posts.push(at(s, sd, hw + 0.7).add(up)); X.lights(posts, { sag: 0.3, per: 5, size: 0.13, glow: 1.1 }); }
    S.forks.forEach((F, i) => { const sd = i % 2 ? 1 : -1, c = S.path.at(F.a - 6);
      X.put('XmasTree_Big', at(F.a - 6, sd, hw + 4), c.yaw + i, 1.3); X.put(['Gift_A', 'Gift_B', 'Gift_C'][i % 3], at(F.a - 8, sd, hw + 2.2), i); X.put('Gift_B', at(F.a - 4.5, sd, hw + 2.4), -i);
      X.put('XmasTree_Small', at(F.b + 8, -sd, hw + 3.2), c.yaw - i, 1.8); if (i % 2 === 0) X.put('Snowman', at(F.b + 2, -sd, hw + 2.3), c.yaw + Math.PI - sd * 0.6); });
    for (const sd of [1, -1]) { X.put('Lantern', at(5, sd, hw + 1.3), S.path.at(5).yaw); X.put('CandyCane', at(12, sd, hw + 0.8), S.path.at(12).yaw); X.put('XmasTree_Small', at(S.L - 6, sd, hw + 2.6), sd, 1.8); }
    X.put('XmasTree_Big', at(S.L + 14, 1, 2), 0.5, 2.0); X.put('Sleigh', at(S.L + 6, -1, hw + 2), S.path.at(S.L).yaw + 2);
  },
  reset(E) { Object.assign(S, { s: 4, d: 0, v: 0, time: 0, lane: -1, got: 0, bumpT: 0, phase: 'menu', asking: -1, shot: 'chase', shotT: 0 }); S.stars.forEach((s) => (s.visible = false)); E.snapCam(); },
  menu() { S.phase = 'menu'; },
  async run(E) {
    this.reset(E); S.phase = 'start';
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', 'SLED RUN', 900); S.phase = 'ride'; S.v = 6;
    for (let i = 0; i < S.forks.length; i++) {
      const F = S.forks[i];
      await E.until(() => S.s >= F.a - 19);
      S.asking = i;
      const r = await E.ask({ who: `FORK ${i + 1} OF ${S.forks.length}`, num: E.fmtTime(S.time), size: 1.0,
        anchors: (out) => { const c = S.path.at(F.a + 3); for (let k = 0; k < 3; k++) out[k].copy(c.p).addScaledVector(c.nrm, LANES[k]).setY(groundY(c, LANES[k]) + 2.3); } });
      S.asking = -1; S.shot = 'chase'; S.shotT = 0;
      S.lane = r.ok ? (r.skipped ? 1 : r.q.correct) : r.k; S.ok = r.ok; S.fork = F;
      if (r.ok) { // the stars along the right lane
        S.stars.forEach((st, k) => { const c = S.path.at(F.a + 6 + k * 6); st.position.copy(c.p).addScaledVector(c.nrm, LANES[S.lane]).setY(groundY(c, LANES[S.lane]) + 0.9); st.visible = k * 6 + 6 < F.b - F.a - 3; st.userData.s = F.a + 6 + k * 6; });
      }
      await E.until(() => S.s >= F.a + 2);
      const head = S.a.g.position.clone().setY(S.a.g.position.y + 1.2);
      if (r.ok) { S.v = Math.min(20, S.v + 3); E.juice(r, head, 'star path!'); } else { S.bumpT = 3.5; E.juice(r, head, 'bumpy lane'); }
      await E.until(() => S.s >= F.b);
      S.lane = -1; S.stars.forEach((st) => (st.visible = false));
      if (i % 2 === 1) { S.shot = ['front', 'side', 'low'][Math.floor(i / 2) % 3]; S.shotT = 0; }
      E.send({ p: S.s / S.L, d: S.d, v: E.fmtTime(S.time) });
    }
    await E.until(() => S.s >= S.L);
    S.phase = 'done'; E.banner('FINISH!', `${E.fmtTime(S.time)} s`, 1800); E.cine(true); E.shake(0.4);
    await E.until(() => S.v < 0.4); await E.wait(1.2); E.cine(false);
    const total = Math.round(S.time * 10) / 10;
    E.finish({ score: total, shown: total.toFixed(1), unit: 'seconds', better: 'low', line: `${S.got} stars collected` });
  },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E;
    let c = S.path.at(Math.max(0, S.s));
    if (S.phase === 'menu' || S.phase === 'start') {
      S.s = 4; c = S.path.at(S.s); a.g.position.copy(c.p).setY(groundY(c, 0)); a.g.rotation.set(0, c.yaw, 0); a.g.rotateX(c.slope);
      a.pose(this.sitPose(t, 0, 0), 8, rdt); a.update();
      const P = a.g.position, ang = t * 0.15 + 2.4;
      E.cam(new THREE.Vector3(P.x + Math.sin(c.yaw + ang) * 3.8, P.y + 1.5, P.z + Math.cos(c.yaw + ang) * 3.8), P.clone().setY(P.y + 0.5), 3, 50);
      E.focusAt = P; E.focus = 4; E.hud('0.0', 'SLED RUN'); return;
    }
    if (S.phase === 'ride') S.time += dt;
    // speed: the slope pulls, the snow and the air slow; bumpy lanes slow more
    S.bumpT = Math.max(0, S.bumpT - dt);
    const target = S.phase === 'done' ? 0 : 15.5 + E.combo * 0.4;
    S.v = S.phase === 'done' ? Math.max(0, S.v - 9 * dt) : E.damp(S.v, S.bumpT > 0 ? 8.5 : target, S.bumpT > 0 ? 2.5 : 0.6, dt);
    S.s += S.v * dt;
    // the line: in a fork the chosen lane, else the sled rides up the outside of each curve
    const ca = S.path.at(S.s + 3), cb = S.path.at(S.s - 3); let dyaw = ca.yaw - cb.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const curv = dyaw / 6, bank = E.clamp(-curv * S.v * S.v * 0.22, -4.2, 4.2);
    const inFork = S.forks.find((F) => S.s > F.a - 10 && S.s < F.b + 3);
    const tgt = inFork && S.lane >= 0 ? LANES[S.lane] : inFork && S.asking >= 0 ? 0 : bank;
    const pd = S.d; S.d = E.damp(S.d, tgt, inFork ? 2.2 : 1.4, dt); const dRate = (S.d - pd) / Math.max(1e-4, dt);
    c = S.path.at(S.s);
    let y = groundY(c, S.d);
    if (S.bumpT > 0) y += Math.abs(Math.sin(S.s * 1.3)) * 0.22;
    a.g.position.copy(c.p).addScaledVector(c.nrm, S.d).setY(y);
    // tilt with the track's sides (d) and the slope
    const sideTilt = Math.atan(2 * S.curve * S.d);
    a.g.rotation.set(0, c.yaw + Math.atan2(dRate, Math.max(4, S.v)) * 0.6, 0); a.g.rotateX(c.slope); a.g.rotateZ(-sideTilt);
    a.pose(S.phase === 'done' && S.v < 0.5 ? E.SP.cheer(t) : this.sitPose(t, E.clamp(-curv * 8, -0.6, 0.6), S.bumpT > 0 ? 1 : 0), 10, rdt); a.update();
    if (S.v > 6 && dt > 0.002) E.spray.emit(a.g.position.clone().addScaledVector(c.t, -0.5), 1, -c.t.x * 2, 1, -c.t.z * 2, 1, 0.1);
    // the stars: spin, collect
    S.stars.forEach((st) => { if (!st.visible) return; st.rotation.y += rdt * 3; if (S.s >= st.userData.s - 0.5) { st.visible = false; S.got++; E.spray.emit(st.position, 12, 0, 2, 0, 2, 0.12); E.sfx.star && E.sfx.star(Math.min(3, S.got % 4)); } });
    if (S.ghost && E.friend && E.friend.p != null) { const gc = S.path.at(E.friend.p * S.L); S.ghost.g.visible = true; S.ghost.g.position.copy(gc.p).addScaledVector(gc.nrm, (E.friend.d || 0) * 0.8 - 1).setY(groundY(gc, (E.friend.d || 0) * 0.8 - 1)); S.ghost.g.rotation.set(0, gc.yaw, 0); S.ghost.g.rotateX(gc.slope); S.ghost.pose(this.sitPose(t + 2, 0, 0), 8, rdt); S.ghost.update(); }
    E.hud(E.fmtTime(S.time), `${S.got} ⭐ · SLED RUN`); E.progress(S.s / S.L);
    if (S.phase === 'ride') E.send({ p: S.s / S.L, d: S.d, v: E.fmtTime(S.time) });
    this.camera(E, rdt, c);
  },
  sitPose(t, lean, bump) {
    const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    const b = bump ? 0.08 * Math.sin(t * 22) : 0.01 * Math.sin(t * 8);
    p.legL = [-1.45, 0, 0.12]; p.legR = [-1.45, 0, -0.12]; p.kneeL = [0.35, 0, 0]; p.kneeR = [0.35, 0, 0]; p.ankleL = [-0.1, 0, 0]; p.ankleR = [-0.1, 0, 0];
    p.spine = [0.15 - bump * 0.2, 0, lean * 0.5]; p.head = [-0.05, 0, -lean * 0.3]; p.hips = [0, 0, lean * 0.2];
    p.armL = [-1.0, 0, 0.3 + bump * 0.6]; p.armR = [-1.0, 0, -0.3 - bump * 0.6]; p.elbowL = [-0.7, 0, 0]; p.elbowR = [-0.7, 0, 0];
    p.y = -0.37 + b; return p;
  },
  camera(E, rdt, c) {
    const { THREE } = E, P = S.a.g.position; S.shotT += rdt;
    let pos, look, k = 5, fov = 60;
    const back = c.t.clone().multiplyScalar(-1);
    if (S.asking >= 0) {
      const F = S.forks[S.asking], cf = S.path.at(F.a + 3);
      pos = P.clone().addScaledVector(back, 4.5).setY(P.y + 3.4); look = cf.p.clone().setY(cf.p.y + 1.2).lerp(P, 0.2); k = 3; fov = 64;
    } else if (S.phase === 'done') {
      pos = P.clone().addScaledVector(c.t, 4).addScaledVector(c.nrm, 2.5).setY(P.y + 1.4); look = P.clone().setY(P.y + 0.5); k = 2; fov = 50;
    } else if (S.shot === 'front' && S.shotT < 3) {
      pos = P.clone().addScaledVector(c.t, 5.5).setY(P.y + 1.3); look = P.clone().setY(P.y + 0.6); k = 6; fov = 56;
    } else if (S.shot === 'side' && S.shotT < 3) {
      pos = P.clone().addScaledVector(c.nrm, 5.5).setY(P.y + 1.6); look = P.clone().setY(P.y + 0.5).addScaledVector(c.t, 2); k = 6; fov = 54;
    } else if (S.shot === 'low' && S.shotT < 2.6) {
      pos = P.clone().addScaledVector(back, 2.4).addScaledVector(c.nrm, 0.8).setY(P.y + 0.5); look = P.clone().setY(P.y + 0.5).addScaledVector(c.t, 5); k = 6; fov = 66;
    } else { S.shot = 'chase'; pos = P.clone().addScaledVector(back, 4.6).setY(P.y + 2.0); look = P.clone().addScaledVector(c.t, 6).setY(P.y + 0.4); k = 5; fov = 62; }
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
