// SLALOM: Foxino skis down a long piste. Ten times three gates stand across the slope, each with a word bubble above it:
// tap the right word and he carves through that gate (green, a speed boost); a wrong gate costs 3 seconds. Lowest time wins.
import { makePath } from './course.js?v=1';

const SETS = 10, FIRST = 70, GAP = 54, LANES = [6.2, 0, -6.2];   // three gates: left, middle, right (lateral metres, + = left)
const S = { a: null, path: null, s: 0, d: 0, dT: 0, v: 0, time: 0, pen: 0, gates: [], set: -1, lane: 1, flags: [], ghost: null, shot: 'chase', shotT: 0, wob: 0, carveT: 0, done: false, finishS: 640 };

export const _S = S;
export default {
  id: 'slalom', blurb: 'Ski through the gate with the right word. Fast and clean wins!',
  light: { sky: 'alpine-day', skyYaw: 0.2, sunDir: [-0.55, 0.5, 0.45], sun: 0xfff3e0, sunI: 2.4, hemiSky: 0xd6e6ff, hemiGround: 0xa79bd6, hemi: 1.05, exposure: 0.95, fog: [170, 640], fogColor: 0xd8eafc, env: 0.5, flakes: 260, flakeA: 0.45 },
  bestShown: (s) => `${s.toFixed(1)} s`,
  async build(E, prog) {
    const { THREE } = E;
    const [g, J] = await Promise.all([E.loadGLB('models/slalom.glb?v=1'), E.loadJSON('models/slalom.json?v=1')]);
    E.dressModel(g.scene, { banner: (n) => (n === 'Banner' ? E.bannerMaterial('START', '#7b3fd1') : E.bannerMaterial('FINISH', '#ff4d6d')) });
    E.scene.add(g.scene); prog(25, 'Planting the trees…');
    S.path = makePath(J.center, J.step); S.finishS = J.finish;
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
    // orange A-nets along both edges of the piste, a few snowmen at the finish
    const nets = [];
    for (let s = 6; s < J.finish + 40; s += 4.2) for (const side of [1, -1]) { const c = S.path.at(s); nets.push([0, c.p.x + c.nrm.x * side * (J.halfWidth + 1.5), c.p.y + 0.05, c.p.z + c.nrm.z * side * (J.halfWidth + 1.5), c.yaw + Math.PI / 2, 1]); }
    E.scene.add(E.instanceField(nets, () => 'Fence', 50));
    const extras = [];
    for (let i = 0; i < 5; i++) { const c = S.path.at(J.finish + 12 + i * 5); extras.push([0, c.p.x + c.nrm.x * (i % 2 ? 1 : -1) * (14 + i), c.p.y, c.p.z + c.nrm.z * (i % 2 ? 1 : -1) * (14 + i), c.yaw + Math.PI + (i - 2) * 0.3, 1]); }
    E.scene.add(E.instanceField(extras, () => 'Snowman'));
    await E.addMountains(-260);
    prog(55, 'Setting the gates…');
    // the gates (three per set; the banner takes its bubble's colour)
    const TINT = [0xff8fc4, 0xffd84a, 0x6fe2ff];
    for (let i = 0; i < SETS; i++) {
      const s = FIRST + i * GAP, c = S.path.at(s), set = [];
      for (let k = 0; k < 3; k++) {
        const gt = E.prop('Gate'); gt.position.copy(c.p).addScaledVector(c.nrm, LANES[k]); gt.rotation.y = c.yaw;
        gt.traverse((o) => { if (o.isMesh && o.material.name === 'Banner') { o.material = o.material.clone(); o.material.color.set(TINT[k]); o.material.emissive = new THREE.Color(0); set.banner = set.banner || []; set.banner[k] = o; } });
        E.scene.add(gt); set.push(gt);
      }
      set.s = s; S.gates.push(set);
    }
    // little blue and red flag poles between the sets: Foxino weaves round them on his own
    for (let s = FIRST - 40; s < J.finish - 10; s += 11) {
      if (S.gates.some((st) => Math.abs(st.s - s) < 16)) continue;
      const c = S.path.at(s), side = Math.round(s / 11) % 2 ? 1 : -1, gt = E.prop('Gate');
      gt.scale.set(0.35, 0.7, 0.7); gt.position.copy(c.p).addScaledVector(c.nrm, side * 4.2); gt.rotation.y = c.yaw;
      gt.traverse((o) => { if (o.isMesh && o.material.name === 'Banner') { o.material = o.material.clone(); o.material.color.set(side > 0 ? 0x3d6bff : 0xff3d5a); } });
      E.scene.add(gt); S.flags.push({ s, side });
    }
    prog(75, 'Waxing the skis…');
    S.a = await E.makeActor({ gear: 'ski' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'ski', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; }
    E.groundAt = (x, z) => { const s = S.path.nearest(x, z, S.s, 60); return S.path.at(s).p.y; };
    E.drawDist = 175;
    this.reset(E); this.place(E, 0);
  },
  reset(E) { Object.assign(S, { s: -2, d: 0, dT: 0, v: 0, time: 0, pen: 0, set: -1, lane: 1, wob: 0, done: false, shot: 'chase', shotT: 0 }); S.gates.forEach((st) => st.banner && st.banner.forEach((b) => b.material.emissive.set(0))); E.snapCam(); },
  menu(E) { S.menu = true; },
  place(E, rdt) {
    const c = S.path.at(Math.max(0, S.s)), a = S.a;
    a.g.position.copy(c.p).addScaledVector(c.nrm, S.d);
    const carveYaw = Math.atan2(S.dRate || 0, Math.max(4, S.v)) ;
    a.g.rotation.set(0, c.yaw + carveYaw, 0); a.g.rotateX(c.slope * 0.92);
  },
  async run(E) {
    S.menu = false; this.reset(E);
    E.banner('3', '', 700); await E.wait(0.8); E.banner('2', '', 700); await E.wait(0.8); E.banner('1', '', 700); await E.wait(0.8);
    E.banner('GO!', 'SLALOM', 900); S.go = true; E.shake(0.3);
    for (let i = 0; i < SETS; i++) {
      const st = S.gates[i];
      await E.until(() => S.s >= st.s - 17);
      S.asking = i; S.shot = 'question';
      const r = await E.ask({ who: `GATE ${i + 1} OF ${SETS}`, num: E.fmtTime(S.time + S.pen), size: 1.25,
        anchors: (out) => { const c = S.path.at(st.s); for (let k = 0; k < 3; k++) out[k].copy(c.p).addScaledVector(c.nrm, LANES[k]).add(c.t.clone().multiplyScalar(0)).setY(c.p.y + 3.2); } });
      S.asking = -1;
      const right = r.skipped ? 1 : r.q.correct;
      S.lane = r.ok ? right : r.k; S.dT = LANES[S.lane]; S.pendingOk = r.ok; S.pendingR = r; S.pendingSet = st; S.shot = 'chase'; S.shotT = 0;
      await E.until(() => S.s >= st.s - 0.5);
      // through the gate
      const head = S.a.g.position.clone().setY(S.a.g.position.y + 1.6);
      if (r.ok) { st.banner[S.lane].material.emissive.set(0x2fbf6a); S.v = Math.min(22, S.v + 3); E.juice(r, head, '+ speed'); }
      else { st.banner[S.lane].material.emissive.set(0x991122); S.pen += 3; S.v *= 0.72; S.wob = 1.1; E.juice(r, head, '+3 seconds'); }
      E.spray.emit(S.a.g.position, 30, 0, 2.5, 0, 3);
      E.send({ p: S.s / S.finishS, d: S.d, v: E.fmtTime(S.time + S.pen) });
      if (i % 3 === 1) { S.shot = ['side', 'front', 'low'][Math.floor(i / 3) % 3]; S.shotT = 0; }
    }
    await E.until(() => S.s >= S.finishS);
    S.done = true; E.banner('FINISH!', `${E.fmtTime(S.time + S.pen)} s`, 1800); E.shake(0.4); E.cine(true);
    await E.wait(2.4); E.cine(false);
    const total = Math.round((S.time + S.pen) * 10) / 10;
    E.finish({ score: total, shown: `${total.toFixed(1)}`, unit: 'seconds', better: 'low', line: S.pen ? `${S.pen} penalty seconds` : 'No missed gates!' });
  },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return;
    const t = E.T;
    if (S.menu || !S.go) {
      // standing at the start, the camera slowly round him
      S.s = -2; S.d = 0; this.place(E, rdt); a.pose(E.SP.stand(t), 8, rdt); a.poleDir[0].set(0.25, -1, 0.15); a.poleDir[1].set(-0.25, -1, 0.15); a.update();
      const c = S.path.at(0), ang = t * 0.15 + 2.6, P = a.g.position;
      E.cam(new E.THREE.Vector3(P.x + Math.sin(c.yaw + ang) * 4.2, P.y + 1.8, P.z + Math.cos(c.yaw + ang) * 4.2), new E.THREE.Vector3(P.x, P.y + 0.9, P.z), 3, 50);
      E.focusAt = P; E.focus = 4.5; return;
    }
    if (!S.done) {
      S.time += dt;
      // speed: gravity down the slope against the snow and the air; a little faster on a combo
      const c0 = S.path.at(Math.max(0, S.s));
      S.v = Math.min(21 + E.combo * 0.3, S.v + (9.8 * Math.sin(c0.slope) * 0.55 - 0.02 * S.v * S.v * 0.12) * dt);
      S.v = Math.max(S.v, 9);
      S.s += S.v * dt;
      // the line: the chosen gate before a set, else a weave round the little flags
      let target = S.dT;
      if (S.asking < 0) {
        const nextSet = S.gates.find((st) => st.s > S.s - 2);
        const flag = S.flags.find((f) => f.s > S.s && f.s < S.s + 14);
        if (!nextSet || nextSet.s - S.s > 26 || S.s > (nextSet.s + 2)) { target = flag ? -flag.side * 2.2 : S.d; if (!nextSet || S.s > nextSet.s) S.dT = target; }
      } else target = S.d;
      const prevD = S.d; S.d = E.damp(S.d, target, 1.6, dt); S.dRate = (S.d - prevD) / Math.max(1e-4, dt);
    } else {
      S.v = Math.max(0, S.v - 18 * dt); S.s += S.v * dt; S.dRate = 0;
      if (S.v > 1) E.spray.emit(a.g.position, 3, 3, 1.5, 0, 1.5);
    }
    this.place(E, rdt);
    // the pose: lean into the turn, a tuck on the straights, a wobble after a wrong gate
    S.wob = Math.max(0, S.wob - dt);
    const lean = E.clamp(-(S.dRate || 0) * 0.09, -0.7, 0.7);
    let P;
    if (S.done && S.v < 1) P = E.SP.cheer(t);
    else if (S.wob > 0) P = E.SP.wobble(t);
    else if (Math.abs(lean) < 0.12 && S.v > 15) P = E.SP.tuck(t, 0.8);
    else P = E.SP.carve(t, lean, 0.5);
    a.pose(P, 10, rdt);
    a.skiRoll = lean * 0.6; a.skiYaw[0] = a.skiYaw[1] = 0;
    a.poleDir[0].set(0.2, -1, -0.9); a.poleDir[1].set(-0.2, -1, -0.9);
    a.update();
    if (Math.abs(lean) > 0.25 && !S.done && dt > 0.002) { const side = Math.sign(lean); E.spray.emit(a.g.position.clone().addScaledVector(S.path.at(S.s).nrm, -side * 0.4), 2, -side * 3 * S.path.at(S.s).nrm.x, 1.2, -side * 3 * S.path.at(S.s).nrm.z, 1.2); }
    // the friend's orange Foxino
    if (S.ghost && E.friend && E.friend.p != null) {
      const gs = E.friend.p * S.finishS, c = S.path.at(Math.max(0, gs)); S.ghost.g.visible = true;
      S.ghost.g.position.copy(c.p).addScaledVector(c.nrm, (E.friend.d || 0) + 1.2); S.ghost.g.rotation.set(0, c.yaw, 0); S.ghost.g.rotateX(c.slope * 0.92);
      S.ghost.pose(E.SP.carve(t + 1, 0, 0.5), 8, rdt); S.ghost.update();
    }
    E.hud(E.fmtTime(S.time + S.pen), S.pen ? `+${S.pen} s penalties` : 'SLALOM');
    E.progress(S.s / S.finishS);
    if (!S.done) E.send({ p: S.s / S.finishS, d: S.d, v: E.fmtTime(S.time + S.pen) });
    this.camera(E, rdt);
  },
  camera(E, rdt) {
    const { THREE } = E, a = S.a, P = a.g.position, c = S.path.at(Math.max(0, S.s));
    S.shotT += rdt;
    let pos, look, k = 4, fov = 60;
    const back = c.t.clone().multiplyScalar(-1);
    if (S.asking >= 0) {
      // the question: high behind him, all three gates in the frame
      const st = S.gates[S.asking], cg = S.path.at(st.s);
      pos = P.clone().addScaledVector(back, 5.5).setY(P.y + 3.6); pos.addScaledVector(c.nrm, -S.d * 0.6);
      look = cg.p.clone().setY(cg.p.y + 1.6).lerp(P, 0.25); k = 3; fov = 64;
    } else if (S.done) {
      pos = P.clone().addScaledVector(c.t, 6).addScaledVector(c.nrm, 3).setY(P.y + 1.6); look = P.clone().setY(P.y + 0.9); k = 2; fov = 50;
    } else if (S.shot === 'side' && S.shotT < 3.2) {
      pos = P.clone().addScaledVector(c.nrm, 6.5).addScaledVector(c.t, 1.5).setY(P.y + 1.3); look = P.clone().setY(P.y + 0.8).addScaledVector(c.t, 1.5); k = 6; fov = 52;
    } else if (S.shot === 'front' && S.shotT < 2.8) {
      pos = P.clone().addScaledVector(c.t, 7).addScaledVector(c.nrm, -1.5).setY(P.y + 1.2); look = P.clone().setY(P.y + 0.9); k = 7; fov = 50;
    } else if (S.shot === 'low' && S.shotT < 2.6) {
      pos = P.clone().addScaledVector(back, 3.2).addScaledVector(c.nrm, 1.4).setY(P.y + 0.45); look = P.clone().setY(P.y + 0.9).addScaledVector(c.t, 4); k = 6; fov = 64;
    } else {
      S.shot = 'chase';
      pos = P.clone().addScaledVector(back, 5.2).setY(P.y + 2.4); look = P.clone().addScaledVector(c.t, 7).setY(P.y + 0.6); k = 5; fov = 60;
    }
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
