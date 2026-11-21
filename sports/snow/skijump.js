// SKI JUMP: two jumps from a big hill at golden hour. On the in-run three questions (right = more speed), one at the
// take-off (right = a perfect pop) and one in the air (right = he glides further). The two distances add up; the friend's and
// your best distance show as lines on the hill. Longest total wins.
const S = { a: null, ghost: null, inrun: [], acc: [], LIN: 100, hill: [], phase: 'menu', s: 0, v: 0, z: 0, fl: null, jump: 0, dist: [], bonus: 0, takeoff: false, glide: 0, lines: {}, asking: '', stopT: 0, shotT: 0 };
const THREEp = {};
function hillY(z) { const H = S.hill; if (z <= 0) return H[0][1]; const i = Math.min(H.length - 2, Math.floor(z)), f = Math.min(1, z - i); return H[i][1] * (1 - f) + H[i + 1][1] * f; }
function inrunAt(s, out) {
  s = Math.max(0, Math.min(S.LIN, s)); let i = 1; while (i < S.acc.length - 1 && S.acc[i] < s) i++;
  const f = (s - S.acc[i - 1]) / Math.max(1e-6, S.acc[i] - S.acc[i - 1]), A = S.inrun[i - 1], B = S.inrun[i];
  out.p.set(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f); out.ang = Math.atan2(A[1] - B[1], B[2] - A[2]); return out;
}
const P0 = { tuck(t) { const p = blank(); p.legL = [-1.25, 0, 0.06]; p.legR = [-1.25, 0, -0.06]; p.kneeL = [2.05, 0, 0]; p.kneeR = [2.05, 0, 0]; p.ankleL = [-0.85, 0, 0]; p.ankleR = [-0.85, 0, 0];
    p.spine = [1.05, 0, 0]; p.neck = [-0.4, 0, 0]; p.head = [-0.45, 0, 0]; p.armL = [0.45, 0, 0.12]; p.armR = [0.45, 0, -0.12]; p.elbowL = [-0.15, 0, 0]; p.elbowR = [-0.15, 0, 0]; p.y = -0.3 + 0.005 * Math.sin(t * 9); return p; },
  sit(t) { const p = blank(); p.legL = [-1.4, 0, 0.08]; p.legR = [-1.4, 0, -0.08]; p.kneeL = [1.6, 0, 0]; p.kneeR = [1.6, 0, 0]; p.ankleL = [-0.2, 0, 0]; p.ankleR = [-0.2, 0, 0];
    p.spine = [0.35, 0, 0]; p.armL = [-0.3, 0, 0.6]; p.armR = [-0.3, 0, -0.6]; p.elbowL = [-0.6, 0, 0]; p.elbowR = [-0.6, 0, 0]; p.head = [-0.1, 0.2 * Math.sin(t * 0.8), 0]; p.y = -0.36; return p; },
  fly(t) { const p = blank(), w = 0.03 * Math.sin(t * 5); p.legL = [-0.15, 0, 0.12]; p.legR = [-0.15, 0, -0.12]; p.kneeL = [0.15, 0, 0]; p.kneeR = [0.15, 0, 0]; p.ankleL = [0.25, 0, 0]; p.ankleR = [0.25, 0, 0];
    p.spine = [0.3, 0, 0]; p.neck = [-0.35, 0, 0]; p.head = [-0.4, 0, 0]; p.armL = [0.4, 0, 0.3 + w]; p.armR = [0.4, 0, -0.3 - w]; p.elbowL = [0, 0, 0]; p.elbowR = [0, 0, 0]; return p; },
  pop(t) { const p = P0.fly(t); p.legL = [-0.6, 0, 0.06]; p.legR = [-0.6, 0, -0.06]; p.kneeL = [0.9, 0, 0]; p.kneeR = [0.9, 0, 0]; p.spine = [0.7, 0, 0]; p.armL = [0.6, 0, 0.15]; p.armR = [0.6, 0, -0.15]; return p; },
  telemark(t) { const p = blank(); p.legL = [-0.75, 0, 0.06]; p.kneeL = [1.15, 0, 0]; p.ankleL = [-0.45, 0, 0]; p.legR = [0.25, 0, -0.06]; p.kneeR = [1.05, 0, 0]; p.ankleR = [0.25, 0, 0];
    p.spine = [0.25, 0, 0]; p.armL = [-0.4, 0, 1.25]; p.armR = [-0.4, 0, -1.25]; p.elbowL = [-0.2, 0, 0]; p.elbowR = [-0.2, 0, 0]; p.y = -0.17; return p; },
};
function blank() { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0]; return p; }

export const _S = S;
export default {
  id: 'skijump', blurb: 'Right words give speed, a perfect take-off and a longer flight. Two jumps!',
  light: { sky: 'gold', skyYaw: 0.55, skyBase: 0.22, sunDir: [0.75, 0.4, 0.45], sun: 0xffe4c4, sunI: 2.5, hemiSky: 0xdde6ff, hemiGround: 0x9a86c8, hemi: 0.9, rim: 0xffb27a, rimI: 1.0, exposure: 0.96, fog: [180, 760], fogColor: 0xf0dcd8, flakes: 120, flakeA: 0.35 },
  bestShown: (s) => `${s.toFixed(1)} m`,
  async build(E, prog) {
    const { THREE } = E; THREEp.T = THREE;
    const [g, J] = await Promise.all([E.loadGLB('models/skijump.glb?v=1'), E.loadJSON('models/skijump.json?v=1')]);
    E.dressModel(g.scene); E.scene.add(g.scene); prog(30, 'Planting the trees…');
    S.inrun = J.inrun; S.hill = J.hill; S.acc = [0]; for (let i = 1; i < S.inrun.length; i++) { const A = S.inrun[i - 1], B = S.inrun[i]; S.acc.push(S.acc[i - 1] + Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2])); } S.LIN = S.acc[S.acc.length - 1];
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
    // distance boards along the hill sides, the K line (red) and lines for your best and the friend's distance
    for (const m of J.props.filter((p) => p[0] === 'Marker')) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#7b3fd1'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#fff'; x.font = '400 44px "Lilita One", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(m[5]), 64, 36);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
      b.position.set(m[1], m[2] + 0.4, m[3]); b.rotation.y = m[1] > 0 ? -Math.PI / 2 : Math.PI / 2; E.scene.add(b);
    }
    const line = (z, col) => { const geo = new THREE.PlaneGeometry(J.hillHalfWidth * 2, 0.35); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2; E.scene.add(m); const set = (zz) => { m.visible = zz > 0; const a = Math.atan2(hillY(zz) - hillY(zz + 1), 1); m.position.set(0, hillY(zz) + 0.06, zz); m.rotation.set(-Math.PI / 2 + a, 0, 0); }; set(z); return { m, set }; };
    S.lines.k = line(J.K, 0xff3d5a); S.lines.best = line(0, 0xffd84a); S.lines.friend = line(0, 0xff7d22); S.lines.last = line(0, 0x6fe2ff);
    await E.addMountains(-300, 0xffe8d8);
    prog(60, 'Waxing the long skis…');
    S.a = await E.makeActor({ gear: 'jump' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'jump', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; }
    E.groundAt = (x, z) => (z > 0 ? hillY(z) : null);
    E.drawDist = 320;
    this.reset(E);
  },
  reset(E) { Object.assign(S, { phase: 'menu', s: 0, v: 0, jump: 0, dist: [], asking: '', fl: null }); E.snapCam(); try { const b = JSON.parse(localStorage.getItem('snow-jump-best1') || 'null'); if (b) S.lines.best.set(b); } catch (e) {} },
  menu() { S.phase = 'menu'; },
  async run(E) {
    this.reset(E);
    for (let j = 0; j < 2; j++) {
      S.jump = j; S.phase = 'bar'; S.s = 0; S.v = 0; S.bonus = 0; S.takeoff = false; S.glide = 0; S.fl = null; E.snapCam();
      E.banner(`JUMP ${j + 1}`, 'OF 2', 1200); await E.wait(1.5);
      E.banner('GO!', '', 700); S.phase = 'inrun';
      for (let q = 0; q < 3; q++) {
        await E.until(() => S.s >= S.LIN * (0.22 + q * 0.24));
        S.asking = 'inrun';
        const r = await E.ask({ who: `SPEED ${q + 1} OF 3`, num: `JUMP ${j + 1}`, size: 0.8, anchors: (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.5), out, 1.9, 1.3) });
        S.asking = ''; const head = S.a.g.position.clone().setY(S.a.g.position.y + 1.2);
        if (r.ok) { S.bonus += 1; S.v += 1.2; E.juice(r, head, '+ speed'); } else { S.v *= 0.9; E.juice(r, head, '- speed'); }
      }
      await E.until(() => S.s >= S.LIN * 0.9);
      S.asking = 'takeoff'; E.cine(true);
      const r2 = await E.ask({ who: 'TAKE-OFF!', num: `JUMP ${j + 1}`, size: 0.8, anchors: (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.5), out, 1.9, 1.3) });
      S.asking = ''; S.takeoff = r2.ok; E.juice(r2, S.a.g.position.clone().setY(S.a.g.position.y + 1.2), r2.ok ? 'perfect take-off' : 'late take-off');
      await E.until(() => S.phase === 'flight' && S.fl.z > S.fl.D * 0.3);
      S.asking = 'flight';
      const r3 = await E.ask({ who: 'FLY FURTHER!', num: `JUMP ${j + 1}`, size: 0.9, anchors: (out) => E.around(S.a.g.position.clone(), out, 2.4, 1.4) });
      S.asking = ''; E.cine(false);
      this.retarget(r3.ok ? 9 : -6); E.juice(r3, S.a.g.position.clone().setY(S.a.g.position.y + 1.2), r3.ok ? 'great glide' : 'short glide');
      await E.until(() => S.phase === 'outrun');
      const d = Math.round(S.fl.D * 2) / 2; S.dist.push(d); S.lines.last.set(d);
      E.banner(`${d.toFixed(1)} m`, d >= 100 ? 'OVER THE K LINE!' : `JUMP ${j + 1}`, 2200); E.shake(0.45);
      E.send({ p: (j + 1) / 2, v: `${S.dist.reduce((a, b) => a + b, 0).toFixed(1)} m`, best: Math.max(...S.dist) });
      try { const b = JSON.parse(localStorage.getItem('snow-jump-best1') || '0'); if (d > b) { localStorage.setItem('snow-jump-best1', JSON.stringify(d)); S.lines.best.set(d); } } catch (e) {}
      await E.until(() => S.phase === 'stop'); await E.wait(1.6);
    }
    const total = Math.round(S.dist.reduce((a, b) => a + b, 0) * 2) / 2;
    E.cine(true); E.banner(`${total.toFixed(1)} m`, 'TWO JUMPS', 1800); await E.wait(2.2); E.cine(false);
    E.finish({ score: total, shown: total.toFixed(1), unit: 'metres', better: 'high', line: `${S.dist[0].toFixed(1)} m + ${S.dist[1].toFixed(1)} m` });
  },
  // the flight: a parabola from where he is now (z0, y0, slope b) that lands exactly at the target distance D
  retarget(dD) { const f = S.fl; if (!f) return; f.D = Math.max(55, Math.min(128, f.D + dD)); const z0 = f.z, y0 = f.y, b = f.slope, L = f.D - z0; f.z0 = z0; f.y0 = y0; f.b = b; f.a = (hillY(f.D) - y0 - b * L) / (L * L); },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E, c = { p: new THREE.Vector3(), ang: 0 };
    let P = P0.sit(t), pitch = 0;
    a.skiFree = false; a.skiYaw = [0, 0]; a.skiPitch = 0;
    if (S.phase === 'menu' || S.phase === 'bar') {
      inrunAt(0.5, c); a.g.position.copy(c.p); pitch = c.ang; P = P0.sit(t);
      const Pp = a.g.position;
      if (S.phase === 'menu') { const ang = t * 0.12 + 0.9; E.cam(new THREE.Vector3(Pp.x + Math.cos(ang) * 4.5, Pp.y + 1.6, Pp.z + Math.sin(ang) * 4.5), Pp.clone().setY(Pp.y + 0.6), 3, 50); }
      else E.cam(new THREE.Vector3(Pp.x + 3.6, Pp.y + 1.4, Pp.z + 2.5), Pp.clone().setY(Pp.y + 0.5).add(new THREE.Vector3(0, -2, 6)), 3, 55);
      E.focusAt = Pp; E.focus = 4.5;
    } else if (S.phase === 'inrun') {
      inrunAt(S.s, c);
      S.v = Math.min(30, S.v + (9.8 * Math.sin(c.ang) * 0.5 - 0.0035 * S.v * S.v) * dt); S.s += S.v * dt;
      a.g.position.copy(c.p); pitch = c.ang; P = S.s > S.LIN - 4 ? P0.pop(t) : P0.tuck(t);
      if (S.s >= S.LIN) { // take-off: the target distance from the answers
        S.phase = 'flight';
        const D = 66 + S.bonus * 7 + (S.takeoff ? 11 : 0) + Math.random() * 2;
        const b = -Math.tan(11 * Math.PI / 180) + (S.takeoff ? 0.06 : -0.02);
        S.fl = { z: 0, y: 0, z0: 0, y0: 0, b, a: 0, D, slope: b, vz: Math.max(20, S.v) * 0.96 }; this.retarget(0);
        E.spray.emit(a.g.position, 16, 0, 2, 3, 1.2);
      }
    } else if (S.phase === 'flight') {
      const f = S.fl; f.z += f.vz * dt; const dz = f.z - f.z0; f.y = f.y0 + f.b * dz + f.a * dz * dz; f.slope = f.b + 2 * f.a * dz;
      a.g.position.set(0, f.y, f.z); pitch = Math.atan(-f.slope) * 0.4 + 0.42; P = P0.fly(t);
      a.skiFree = true; a.skiYaw = [0.3, -0.3]; a.skiPitch = -0.55;
      if (f.z >= f.D) { S.phase = 'land'; S.landT = 0; E.shake(0.6); E.spray.emit(a.g.position, 40, 0, 3, 5, 3); S.v = f.vz; S.z = f.z; }
    } else if (S.phase === 'land' || S.phase === 'outrun' || S.phase === 'stop') {
      S.landT = (S.landT || 0) + dt;
      if (S.phase === 'land' && S.landT > 0.35) S.phase = 'outrun';
      const slope = hillY(S.z) - hillY(S.z + 1);
      S.v = Math.max(0, S.v + (S.z > 165 ? -9 : 9.8 * Math.sin(Math.atan(slope)) * 0.3 - 1.5) * dt); S.z += S.v * dt;
      if (S.z > 168 && S.v > 2) E.spray.emit(a.g.position, 3, 4, 1.5, 0, 1.5);
      if (S.v < 0.3 && S.phase === 'outrun') S.phase = 'stop';
      a.g.position.set(0, hillY(S.z), S.z); pitch = Math.atan(slope) * 0.9;
      P = S.phase === 'stop' ? E.SP.cheer(t) : S.z < (S.fl ? S.fl.D + 12 : 0) ? P0.telemark(t) : E.SP.carve(t, 0, 0.4);
      if (S.phase === 'stop') a.g.rotation.y = 0;
    }
    a.g.rotation.set(0, 0, 0); a.g.rotateX(pitch);
    a.pose(P, S.phase === 'flight' ? 6 : 12, rdt); a.update();
    // the friend: their longest jump as an orange line; their Foxino flies beside you
    if (E.friend && E.friend.best) S.lines.friend.set(E.friend.best);
    if (S.ghost && E.friend && S.phase === 'flight') { S.ghost.g.visible = true; S.ghost.g.position.copy(a.g.position).add(new THREE.Vector3(-3.5, 0.3, -2)); S.ghost.g.rotation.copy(a.g.rotation); S.ghost.pose(P0.fly(t + 1), 6, rdt); S.ghost.skiFree = true; S.ghost.skiYaw = [0.3, -0.3]; S.ghost.skiPitch = -0.55; S.ghost.update(); } else if (S.ghost) S.ghost.g.visible = false;
    const tot = S.dist.reduce((x, y) => x + y, 0);
    E.hud(S.phase === 'flight' ? `${Math.max(0, S.fl.z).toFixed(1)} m` : tot ? `${tot.toFixed(1)} m` : 'SKI JUMP', `JUMP ${S.jump + 1} OF 2${S.phase === 'inrun' ? ` · ${Math.round(S.v * 3.6)} km/h` : ''}`);
    E.progress((S.jump + (S.phase === 'flight' || S.phase === 'land' || S.phase === 'outrun' || S.phase === 'stop' ? 0.5 + 0.5 * (S.phase === 'flight' ? S.fl.z / S.fl.D : 1) : (S.s / S.LIN) * 0.5)) / 2);
    if (S.phase !== 'menu' && S.phase !== 'bar') this.camera(E, rdt);
  },
  camera(E, rdt) {
    const { THREE } = E, P = S.a.g.position; let pos, look, k = 5, fov = 60;
    if (S.phase === 'inrun') {
      if (S.asking === 'takeoff') { pos = new THREE.Vector3(7, P.y + 1.5, P.z + 4); look = P.clone().setY(P.y + 0.4).add(new THREE.Vector3(0, 0, 3)); k = 4; fov = 52; }
      else { const c = inrunAt(S.s, { p: new THREE.Vector3(), ang: 0 }), ca = Math.cos(c.ang), sa = Math.sin(c.ang);
        pos = P.clone().add(new THREE.Vector3(0.5, sa * 5.5 + ca * 2.0, -ca * 5.5 + sa * 2.0)); look = P.clone().add(new THREE.Vector3(0, -sa * 7 + 0.4, ca * 7)); k = 7; fov = 62; }
    } else if (S.phase === 'flight') {
      const f = S.fl, u = f.z / f.D;
      if (S.asking === 'flight' || u < 0.75) { pos = P.clone().add(new THREE.Vector3(8.5, 1.8, -3)); look = P.clone().add(new THREE.Vector3(0, -0.6, 3)); k = 5; fov = 56; }
      else { pos = P.clone().add(new THREE.Vector3(2.5, 2.2, -7)); look = P.clone().add(new THREE.Vector3(0, -2.5, 8)); k = 4; fov = 60; }
    } else {
      pos = P.clone().add(new THREE.Vector3(4.5, 1.6, 7)); look = P.clone().setY(P.y + 0.8); k = 2.5; fov = 52;
      if (S.phase === 'stop') { pos = P.clone().add(new THREE.Vector3(2.2, 1.3, 3.8)); }
    }
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
