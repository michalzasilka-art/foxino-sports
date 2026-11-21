// SNOWBALL BIATHLON: cross-country skiing round a snowy valley loop with two stops at the range. At the range three
// targets stand in a row with a word bubble over each: tap the right word and Foxino's snowball splats that target (HIT!),
// a wrong word misses (+5 seconds). 5 throws per stop, 2 stops. Fastest time wins.
import { makePath } from './course.js?v=1';

const START = 400, LO = 520, FIN = 2 * LO + 100, THROWS = 5;
const S = { a: null, ghost: null, path: null, R: null, targets: [], faces: [], s: START, v: 0, time: 0, pen: 0, hits: 0, phase: 'menu', stand: 0, ball: null, ballT: -1, ballFrom: null, ballTo: null, ballHit: false, throwT: -1, shot: 'chase', shotT: 0, splat: [] };
const TINTS = ['#ff8fc4', '#ffd84a', '#6fe2ff'];
function faceCanvas(tint, hit) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const rings = [[124, '#ffffff'], [104, tint], [80, '#ffffff'], [58, tint], [36, '#ffffff'], [18, '#1d1640']];
  for (const [r, col] of rings) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); }
  if (hit) { g.fillStyle = 'rgba(255,255,255,.96)'; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * 60; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 16 + Math.random() * 24, 0, 6.28); g.fill(); } }
  return c;
}
export const _S = S;
export default {
  id: 'biathlon', blurb: 'Ski the valley loop, then hit the target with the right word. No guns, only snowballs!',
  light: { sky: 'snowy', skyYaw: 0.35, skyBase: 0.24, sunDir: [-0.5, 0.55, -0.6], sun: 0xffe6d6, sunI: 2.1, hemiSky: 0xe0dcff, hemiGround: 0xa093cf, hemi: 1.0, exposure: 0.98, fog: [110, 480], fogColor: 0xe8dcec, env: 0.4, flakes: 900, flakeA: 0.9 },
  bestShown: (s) => `${s.toFixed(1)} s`,
  async build(E, prog) {
    const { THREE } = E;
    const [g, J] = await Promise.all([E.loadGLB('models/biathlon.glb?v=1'), E.loadJSON('models/biathlon.json?v=1')]);
    E.dressModel(g.scene); E.scene.add(g.scene); prog(30, 'Planting the forest…');
    S.path = makePath(J.center, J.step, true); S.R = J.range;
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
    // the three targets on the range, facing the mat
    const side = new THREE.Vector3(...S.R.side), along = new THREE.Vector3(...S.R.along), T0 = new THREE.Vector3(...S.R.targets);
    const yaw = Math.atan2(-side.x, -side.z);   // their faces look back at the thrower
    for (let k = 0; k < 3; k++) {
      const t = E.prop('Target'); t.scale.setScalar(2.0); t.position.copy(T0).addScaledVector(along, (1 - k) * 4.2); t.position.y = T0.y; t.rotation.y = yaw; E.scene.add(t); S.targets.push(t);
      t.traverse((o) => { if (o.isMesh && o.material.name === 'TargetFace') { o.geometry = o.geometry.clone(); const pa = o.geometry.attributes.position, uv = new Float32Array(pa.count * 2); for (let i = 0; i < pa.count; i++) { uv[i * 2] = 0.5 - pa.getX(i) / 0.86; uv[i * 2 + 1] = 0.5 + (pa.getY(i) - 1.15) / 0.86; } o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); const tx = new THREE.CanvasTexture(faceCanvas(TINTS[k], false)); tx.colorSpace = THREE.SRGBColorSpace; o.material = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 }); S.faces[k] = o; } });
    }
    // little snowmen cheering along the range, the start/finish arch
    const sm = []; for (let i = 0; i < 4; i++) { const p = new THREE.Vector3(...S.R.mat).addScaledVector(side, -9).addScaledVector(along, -8 + i * 5.3); sm.push([0, p.x, p.y, p.z, yaw + Math.PI, 0.9]); }
    E.scene.add(E.instanceField(sm, () => 'Snowman'));
    const fin = E.prop('Gate'), cf = S.path.at(FIN - 2 * LO); fin.scale.set(4.4, 2.6, 2.6); fin.position.copy(cf.p); fin.rotation.y = cf.yaw;
    fin.traverse((o) => { if (o.isMesh && o.material.name === 'Banner') o.material = E.bannerMaterial('FINISH', '#ff4d6d'); }); E.scene.add(fin);
    S.ball = E.prop('Snowball'); S.ball.visible = false; S.ball.scale.setScalar(1.3); E.scene.add(S.ball);
    await E.addMountains(-200, 0xf4e8ff);
    prog(60, 'Rolling snowballs…');
    S.a = await E.makeActor({ gear: 'xc' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'xc', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; }
    E.groundAt = (x, z) => { const s = S.path.nearest(x, z, S.s % LO, 40); return S.path.at(s).p.y; };
    E.drawDist = 150;
    this.reset(E);
  },
  reset(E) { Object.assign(S, { s: START, v: 0, time: 0, pen: 0, hits: 0, phase: 'menu', stand: 0, ballT: -1, throwT: -1, shot: 'chase', shotT: 0 }); S.ball.visible = false; E.snapCam(); },
  menu() { S.phase = 'menu'; },
  async run(E) {
    const { THREE } = E;
    this.reset(E); S.phase = 'start';
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', 'SNOWBALL BIATHLON', 900); S.phase = 'ski'; S.v = 3;
    for (let st = 0; st < 2; st++) {
      const at = LO * (st + 1);
      await E.until(() => S.s >= at - 0.2);
      S.phase = 'range'; S.stand = st; S.v = 0; E.banner(`RANGE ${st + 1}`, '5 SNOWBALLS', 1300);
      await E.wait(1.2);
      for (let k = 0; k < THROWS; k++) {
        S.phase = 'aim';
        const r = await E.ask({ who: `SNOWBALL ${k + 1} OF ${THROWS}`, num: `RANGE ${st + 1}`, size: 1.15,
          anchors: (out) => { for (let i = 0; i < 3; i++) out[i].copy(S.targets[i].position).setY(S.targets[i].position.y + 4.3); } });
        const k2 = r.skipped ? 1 : r.ok ? r.q.correct : r.k;
        // the throw: wind up, release at 0.45, the ball flies 0.7 s
        S.phase = 'throw'; S.throwT = 0; S.ballHit = r.ok; S.target = k2;
        await E.until(() => S.throwT >= 0.45);
        const hand = new THREE.Vector3(); S.a.fox.bones.RightHand.getWorldPosition(hand);
        S.ballFrom = hand; S.ballTo = S.targets[k2].position.clone().setY(S.targets[k2].position.y + 2.3 * (r.ok ? 1 : 0.4)).addScaledVector(new THREE.Vector3(...S.R.along), r.ok ? 0 : 1.6);
        S.ballT = 0; S.ball.visible = true; E.sfx.kick && E.sfx.kick();
        await E.until(() => S.ballT >= 1);
        S.ball.visible = false; S.ballT = -1;
        const tp = S.ballTo.clone().setY(S.ballTo.y + 0.6);
        E.spray.emit(S.ballTo, 26, 0, 3, 0, 3, 0.14);
        if (r.ok) { S.hits++; this.paint(E, k2, true); E.juice(r, tp, 'HIT!'); setTimeout(() => this.paint(E, k2, false), 1600); }
        else { S.pen += 5; E.juice(r, tp, 'MISS · +5 seconds'); }
        await E.wait(0.9);
      }
      S.phase = 'ski'; S.v = 2; E.send({ p: (S.s - START) / (FIN - START), v: E.fmtTime(S.time + S.pen) });
    }
    await E.until(() => S.s >= FIN);
    S.phase = 'done'; const total = Math.round((S.time + S.pen) * 10) / 10;
    E.banner('FINISH!', `${E.fmtTime(total)} s`, 1800); E.cine(true); E.shake(0.4);
    await E.until(() => S.v < 0.4); await E.wait(1.2); E.cine(false);
    E.finish({ score: total, shown: total.toFixed(1), unit: 'seconds', better: 'low', line: `${S.hits} of ${THROWS * 2} targets hit${S.pen ? ` · +${S.pen} s` : ''}` });
  },
  paint(E, k, hit) { const o = S.faces[k]; if (!o) return; o.material.map.image = faceCanvas(TINTS[k], hit); o.material.map.needsUpdate = true; },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E;
    if (S.phase === 'ski' || S.phase === 'start' || S.phase === 'done' || S.phase === 'menu') {
      if (S.phase === 'ski') { S.time += dt; S.v = E.damp(S.v, 10.5 + E.combo * 0.25, 0.8, dt); }
      if (S.phase === 'done') S.v = Math.max(0, S.v - 6 * dt);
      if (S.phase === 'menu' || S.phase === 'start') S.v = 0;
      S.s += S.v * dt;
      const c = S.path.at(S.s);
      a.g.position.copy(c.p); a.g.rotation.set(0, c.yaw, 0); a.g.rotateX(c.slope);
      const ph = S.s * 0.9;
      a.pose(S.v > 1 ? this.skate(ph) : S.phase === 'done' ? E.SP.cheer(t) : E.SP.stand(t), 10, rdt);
      a.skiYaw = S.v > 1 ? [0.22, -0.22] : [0, 0];
      const pole = 0.5 + 0.5 * Math.sin(ph * 2); a.poleDir[0].set(0.15, -1, -0.2 - pole * 0.9); a.poleDir[1].set(-0.15, -1, -0.2 - pole * 0.9);
      a.update();
      if (S.v > 3 && dt > 0.002) E.spray.emit(a.g.position, 1, 0, 0.6, 0, 0.8, 0.08);
    } else {
      // at the mat: face the targets; aim, wind up, throw
      const m = new THREE.Vector3(...S.R.mat), side = new THREE.Vector3(...S.R.side);
      a.g.position.copy(m); a.g.rotation.set(0, Math.atan2(side.x, side.z), 0);
      if (S.phase === 'throw') { S.throwT += dt * 1.25; }
      a.pose(S.phase === 'throw' ? this.throwPose(S.throwT) : this.aimPose(t), 14, rdt);
      a.skiYaw = [0, 0]; a.poleOn = false; a.update(); a.poleOn = true;
    }
    if (S.ballT >= 0 && S.ballFrom) {
      S.ballT = Math.min(1, S.ballT + dt / 0.7); const u = S.ballT;
      S.ball.position.copy(S.ballFrom).lerp(S.ballTo, u); S.ball.position.y += Math.sin(Math.PI * u) * 3.2; S.ball.rotation.x += dt * 12;
    }
    if (S.ghost && E.friend && E.friend.p != null) { const gs = START + E.friend.p * (FIN - START), gc = S.path.at(gs); S.ghost.g.visible = true; S.ghost.g.position.copy(gc.p).addScaledVector(gc.nrm, 1.6); S.ghost.g.rotation.set(0, gc.yaw, 0); S.ghost.pose(this.skate(gs * 0.9), 8, rdt); S.ghost.skiYaw = [0.22, -0.22]; S.ghost.update(); }
    E.hud(E.fmtTime(S.time + S.pen), S.pen ? `+${S.pen} s · ${S.hits} hits` : `${S.hits} hits · BIATHLON`);
    E.progress((S.s - START) / (FIN - START));
    if (S.phase === 'ski') E.send({ p: (S.s - START) / (FIN - START), v: E.fmtTime(S.time + S.pen) });
    this.camera(E, rdt);
  },
  skate(ph) {
    const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    const s = Math.sin(ph), pp = 0.5 + 0.5 * Math.sin(ph * 2);
    p.legL = [-0.35, 0, 0.08 + 0.32 * Math.max(0, s)]; p.legR = [-0.35, 0, -0.08 - 0.32 * Math.max(0, -s)];
    p.kneeL = [0.6 - 0.25 * Math.max(0, s), 0, 0]; p.kneeR = [0.6 - 0.25 * Math.max(0, -s), 0, 0]; p.ankleL = [-0.25, 0, 0]; p.ankleR = [-0.25, 0, 0];
    p.hips = [0, 0, 0.12 * s]; p.spine = [0.35 + 0.15 * pp, 0, -0.1 * s]; p.head = [-0.25, 0, 0];
    p.armL = [-1.3 + 1.6 * pp, 0, 0.22]; p.armR = [-1.3 + 1.6 * pp, 0, -0.22]; p.elbowL = [-0.6 + 0.4 * pp, 0, 0]; p.elbowR = [-0.6 + 0.4 * pp, 0, 0];
    p.y = -0.07 + 0.02 * Math.abs(s); return p;
  },
  aimPose(t) { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0];
    p.legL = [-0.15, 0, 0.12]; p.legR = [0.1, 0, -0.12]; p.kneeL = [0.3, 0, 0]; p.kneeR = [0.25, 0, 0]; p.spine = [0.08, 0, 0]; p.head = [0.05, 0.03 * Math.sin(t), 0];
    p.armR = [-0.6, 0, -0.35]; p.elbowR = [-1.3, 0, 0]; p.armL = [-0.7, 0, 0.3]; p.elbowL = [-0.4, 0, 0]; p.y = -0.03; return p; },
  throwPose(u) { const p = this.aimPose(0), w = Math.min(1, u / 0.4), r = Math.max(0, Math.min(1, (u - 0.4) / 0.25));
    p.armR = [-0.6 + 1.8 * w - 2.6 * r, 0, -0.35 - 0.3 * w]; p.elbowR = [-1.3 - 0.4 * w + 1.4 * r, 0, 0]; p.spine = [0.08 + 0.25 * r, -0.5 * w + 0.9 * r, 0]; p.armL = [-1.1 + 0.6 * r, 0, 0.5]; return p; },
  camera(E, rdt) {
    const { THREE } = E, P = S.a.g.position; S.shotT += rdt; let pos, look, k = 5, fov = 60;
    if (S.phase === 'aim' || S.phase === 'throw' || S.phase === 'range') {
      // over his shoulder: him in front, all three targets in the frame
      const side = new THREE.Vector3(...S.R.side), T0 = new THREE.Vector3(...S.R.targets);
      pos = P.clone().addScaledVector(side, -3.2).add(new THREE.Vector3(0, 2.4, 0)).addScaledVector(new THREE.Vector3(...S.R.along), 1.4); look = T0.clone().setY(T0.y + 2.4).lerp(P, 0.1); k = 3.5; fov = 50;
      if (S.ballT >= 0) { look = S.ball.position.clone().lerp(T0.clone().setY(T0.y + 1.6), 0.6); k = 4; }
    } else {
      const c = S.path.at(S.s), back = c.t.clone().multiplyScalar(-1);
      if (S.phase === 'done' || S.phase === 'start' || S.phase === 'menu') { const ang = E.T * 0.15 + (S.phase === 'done' ? 0.8 : 2.4); pos = P.clone().add(new THREE.Vector3(Math.sin(c.yaw + ang) * 4, 1.5, Math.cos(c.yaw + ang) * 4)); look = P.clone().setY(P.y + 0.7); k = 3; fov = 50; }
      else {
        const cyc = Math.floor(S.time / 5) % 4;
        if (cyc === 1) { pos = P.clone().addScaledVector(c.nrm, 5).addScaledVector(c.t, 1.5).setY(P.y + 1.5); look = P.clone().setY(P.y + 0.7).addScaledVector(c.t, 1.5); k = 5; fov = 54; }
        else if (cyc === 3) { pos = P.clone().addScaledVector(c.t, 5.5).addScaledVector(c.nrm, -1.2).setY(P.y + 1.3); look = P.clone().setY(P.y + 0.8); k = 5; fov = 54; }
        else { pos = P.clone().addScaledVector(back, 4.8).setY(P.y + 2.2); look = P.clone().addScaledVector(c.t, 6).setY(P.y + 0.5); k = 5; fov = 60; }
      }
    }
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
