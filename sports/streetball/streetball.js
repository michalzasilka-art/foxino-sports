// Streetball (Foxino Sports, 2026-11-17, the user: "another game in Sports named Streetball, similar to what we had, but this
// time remodel everything with Blender and use the already generated 3D character"). 1 on 1 against Rob, first to 3 baskets.
// Foxino is the Tripo Football Foxino (penalty/foxino-glb.js) in a basketball kit, driven by the old game's basketball poses
// (poses.js); the court, hoop, fences, wall, city, bleachers and props are the Blender models from the Windows PC
// (models/sb-*.glb, brief blender/BRIEF-streetball.md); until they are there simple stand-ins are drawn.
// Every play stops in slow motion for a question (tap the bubble with the right word, the word is inside the bubble):
//  ATTACK  – right: Foxino crosses over and gets past Rob (wrong: Rob steals it); then SHOOT – right: swish (wrong: it rims out).
//  DEFENCE – the three bubbles are also the lanes LEFT / MIDDLE / RIGHT: the right word is the lane Rob drives into. Right:
//            Foxino is there and steals it. Wrong: Rob drives past; BLOCK IT – right AND quick: a block. Otherwise Rob
//            scores (he still misses a third of them).
// ?list=1: one of the sports picked in the Foxino Sports lobby: starts at once, posts {fb: 'finished', won, score} at the end.
import * as THREE from '/penalty/lib/three.module.min.js';
import { GLTFLoader } from '/penalty/lib/GLTFLoader.js';
import { MeshoptDecoder } from '/adventures/lib/meshopt_decoder.module.js';
import { loadFoxino } from '/penalty/foxino-glb.js?v=3';
import { makeRob, RPOSES } from '/penalty/rob.js';
import { makeBubble } from '/penalty/props.js';
import { sfx, unlock, isMuted, setMuted } from '/penalty/sound.js';
import { paintedSky, makePost } from '../look.js?v=2';
import { BPOSES } from './poses.js?v=1';
import { makeAnimChar } from './charanim.js?v=1';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const LIST = /[?&]list=1/.test(location.search);
if (LIST) document.body.classList.add('list');
const WIN = 3, TOP_Z = 6.6, DEF_Z = 4.9, LANES = [-1.5, 0, 1.5];
const RIM = new THREE.Vector3(0, 2.6, 1.0), RIM_R = 0.23, BALL_R = 0.12;
const TINTS = [0xff6fb5, 0xffcd1c, 0x48d8ff], CSS_TINTS = ['#ff8fc4', '#ffd84a', '#6fe2ff'];

// ---------- renderer, scene, the look ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pr); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xf2d2b0, 45, 140);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
paintedSky(scene, '/adventures/sky/sky-sea-sunset.webp?v=1', { envRenderer: renderer, yaw: 0.25 });
{ const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0xf2c9a0, side: THREE.BackSide }))); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }
// (2026-11-17, "ultimate" pass) golden hour: a low warm sun with long soft shadows, a cool sky fill, a cyan rim from behind
scene.add(new THREE.HemisphereLight(0xffe8d0, 0x5a4a7a, 0.9));
const sun = new THREE.DirectionalLight(0xffd3a2, 2.1); sun.position.set(-13, 10, 11); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
sun.target.position.set(0, 0, 5); scene.add(sun, sun.target);
const back = new THREE.DirectionalLight(0x9fd0ff, 1.15); back.position.set(9, 7, -14); scene.add(back);
const POSTFX = makePost(renderer, { aoRange: 70, focusMul: 1.4, blur: 0.5, grade: { sat: 1.06, warm: 1.05 }, glow: 0.9 });

// ---------- the court: the Blender models, or simple stand-ins until they are delivered ----------
const SB_FILES = ['sb-court', 'sb-hoop', 'sb-fences', 'sb-wall', 'sb-city', 'sb-bleachers', 'sb-props', 'sb-ball'];
const SB = {};   // the loaded models by name
let NET = null, NET_BASE = null, SEATS = [];
async function loadCourt() {
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(SB_FILES.map(async (n) => { try { SB[n] = (await L.loadAsync(`models/${n}.glb?v=1`)).scene; } catch (e) { /* not delivered yet */ } }));
  for (const [n, g] of Object.entries(SB)) {
    if (n === 'sb-ball') continue;
    g.traverse((o) => { if (!o.isMesh) return; if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      if (/^ChainLink/i.test(o.name) || (o.parent && /^ChainLink/i.test(o.parent.name))) o.userData.noCast = true;   // (the PC's own see-through chain texture stays)
      if (/^Glass/i.test(o.name)) { o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.05 }); o.userData.noCast = true; } });
    scene.add(g);
  }
  if (SB['sb-hoop']) { NET = SB['sb-hoop'].getObjectByName('Net'); }
  if (SB['sb-bleachers']) SB['sb-bleachers'].traverse((o) => { if (/^Seat/.test(o.name)) SEATS.push(o.getWorldPosition(new THREE.Vector3())); });
  const missing = SB_FILES.filter((n) => !SB[n] && n !== 'sb-ball');
  if (missing.length) standIns(missing);
  if (NET) { NET_BASE = NET.scale.clone(); NET.userData.base = NET_BASE.clone(); }
  makeCrowd();
}
let chainTex = null;
function chainMat() {
  if (!chainTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = 'rgba(190,200,215,0.95)'; g.lineWidth = 2.2;
    for (let i = -64; i < 128; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
    chainTex = new THREE.CanvasTexture(c); chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping; chainTex.repeat.set(8, 3); }
  return new THREE.MeshStandardMaterial({ map: chainTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
}
// (stand-ins: only until the PC's models are in models/; flat and simple on purpose)
function standIns(missing) {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o));
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  if (missing.includes('sb-court')) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'), S = 512 / 17;
    g.fillStyle = '#3d3f8f'; g.fillRect(0, 0, 512, 512); const X = (x) => (x + 8.5) * S, Z = (z) => (z + 2) * S;
    g.fillStyle = '#6a34c4'; g.fillRect(X(-1.6), Z(0), 3.2 * S, 4.6 * S);
    g.strokeStyle = '#ff9a3c'; g.lineWidth = 5; g.beginPath(); g.arc(X(0), Z(1.0), 5.4 * S, 0, Math.PI); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(X(-7.5), Z(0), 15 * S, 14 * S); g.beginPath(); g.arc(X(0), Z(4.6), 1.6 * S, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const fl = add(new THREE.PlaneGeometry(17, 17), M(0xffffff, { map: t }), 0, 0, 6.5); fl.rotation.x = -Math.PI / 2;
    const gr = add(new THREE.PlaneGeometry(200, 200), M(0x8a8f9c), 0, -0.02, 0); gr.rotation.x = -Math.PI / 2;
  }
  if (missing.includes('sb-hoop')) {
    add(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 10), M(0x2a2c40), 0, 1.4, -0.9);
    add(new THREE.BoxGeometry(0.1, 0.1, 1.5), M(0x2a2c40), 0, 2.7, -0.15);
    add(new THREE.BoxGeometry(1.5, 1.0, 0.06), M(0xffffff), 0, 2.85, 0.6);
    const rim = add(new THREE.TorusGeometry(RIM_R, 0.02, 8, 24), M(0xff6a1a, { roughness: 0.4 }), RIM.x, RIM.y, RIM.z); rim.rotation.x = Math.PI / 2;
    NET = add(new THREE.CylinderGeometry(RIM_R, RIM_R * 0.7, 0.42, 12, 3, true), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true }), RIM.x, RIM.y - 0.21, RIM.z);
  }
  if (missing.includes('sb-wall')) add(new THREE.BoxGeometry(20, 6, 0.6), M(0xb5583a), 0, 3, -4);
  if (missing.includes('sb-fences')) for (const s of [-1, 1]) { const f = add(new THREE.PlaneGeometry(16, 3.2), chainMat(), s * 8.3, 1.6, 6.5); f.rotation.y = Math.PI / 2; }
  if (missing.includes('sb-city')) for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(8, rand(10, 22), 8), M(['#e8a87c', '#c38d9e', '#85b8d6', '#f2d388'][i % 4]), -25 + i * 10, 6, -16 - (i % 2) * 6);
}
// the crowd on the bleachers' seats (or two simple rows)
const CROWD = { body: null, head: null, seats: [], cheer: 0 };
function makeCrowd() {
  let seats = SEATS.slice();
  if (!seats.length) for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let z = 4; z <= 12; z += 1.1) seats.push(new THREE.Vector3(s * (9.6 + r * 0.9), 0.4 + r * 0.5, z));
  CROWD.seats = seats.map((p) => ({ p, ph: Math.random() * 6 }));
  const n = CROWD.seats.length;
  CROWD.body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.52, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  CROWD.head = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const cols = ['#ff5d8f', '#ffb703', '#3ab0ff', '#2fbf6a', '#8f52d9', '#ff7d22', '#ffffff', '#e8403a'], skin = ['#f2c9a0', '#d9a074', '#9c6a44', '#ffd9b8'];
  CROWD.seats.forEach((q, i) => { CROWD.body.setColorAt(i, new THREE.Color(cols[i % cols.length])); CROWD.head.setColorAt(i, new THREE.Color(skin[(i * 7) % skin.length])); });
  scene.add(CROWD.body, CROWD.head);
}
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3(1, 1, 1), _v4 = new THREE.Vector3();
function updateCrowd(t, dt) {
  if (!CROWD.body) return; CROWD.cheer = Math.max(0, CROWD.cheer - dt * 0.5);
  CROWD.seats.forEach((q, i) => { const hop = Math.max(0, Math.sin(t * 9 + q.ph)) * 0.25 * Math.min(1, CROWD.cheer) + Math.min(0.35, Math.max(0, CROWD.cheer - 0.6) * 0.5) + Math.sin(t * 2 + q.ph) * 0.02;
    _v4.set(q.p.x, q.p.y + 0.3 + hop, q.p.z); _m4.compose(_v4, _q4, _s4); CROWD.body.setMatrixAt(i, _m4); _v4.y += 0.42; _m4.compose(_v4, _q4, _s4); CROWD.head.setMatrixAt(i, _m4); });
  CROWD.body.instanceMatrix.needsUpdate = true; CROWD.head.instanceMatrix.needsUpdate = true;
}

// ---------- the ball ----------
let ball;
function makeBall() {
  if (SB['sb-ball']) { const b = SB['sb-ball']; b.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(b); return b; }
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#f07a28'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#2a1408'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.moveTo(32, 0); g.lineTo(32, 64); g.moveTo(96, 0); g.lineTo(96, 64); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); m.castShadow = true; scene.add(m); return m;
}

// ---------- the players ----------
const P = { me: null, rob: null };
const aimE = new THREE.Euler(), aimQ = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0), _d = new THREE.Vector3();
const aim = (x, y, z) => { _d.set(x, y, z).normalize(); aimQ.setFromUnitVectors(DOWN, _d); aimE.setFromQuaternion(aimQ, 'ZXY'); return [aimE.x, aimE.y, aimE.z]; };
// Rob's basketball poses (his right arm is on -x, he faces +z)
const RB = {
  stance: (t) => RPOSES.ready(t),
  dribble(t, b) { const p = RPOSES.ready(t); p.armR = aim(-0.35, -0.95, 0.35 + 0.1 * b); p.elbowR = [-0.2 - 0.3 * b, 0, 0]; p.armL = aim(0.6, -0.2, 0.55); p.body = [0.22, -0.1, 0]; return p; },
  run(t, amt) { const p = RPOSES.ready(t), s = Math.sin(t * 13); p.legL = [-0.55 * s * amt, 0, 0.18]; p.legR = [0.55 * s * amt, 0, -0.18]; p.body = [0.22, 0, 0.06 * s * amt]; return p; },
  shoot(u) { const p = RPOSES.ready(0), up = smooth(u / 0.5); p.armR = aim(-0.15, lerp(-0.6, 1, up), lerp(0.6, 0.25, up)); p.armL = aim(0.15, lerp(-0.6, 0.9, up), lerp(0.6, 0.3, up)); p.elbowR = [lerp(-0.9, 0, up), 0, 0]; p.elbowL = [lerp(-0.9, 0, up), 0, 0]; p.body = [lerp(0.15, -0.1, up), 0, 0]; return p; },
  steal(u) { const p = RPOSES.ready(0), k = Math.sin(Math.PI * clamp(u / 0.7, 0, 1)); p.armR = aim(-0.2, -0.25, 1); p.body = [0.25 + 0.3 * k, 0.2 * k, 0]; return p; },
  stumble: (u, t) => (RPOSES.oops ? RPOSES.oops(t) : RPOSES.ready(t)),
  cheer: (t) => (RPOSES.hold ? RPOSES.hold(t) : RPOSES.ready(t)),
};
async function loadAnimChar(file, opts) {
  try { const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder); const g = await L.loadAsync(`models/${file}?v=1`);
    if (!g.animations || g.animations.length < 5) return null; const ch = makeAnimChar(g, opts); scene.add(ch.root); return ch; } catch (e) { return null; }
}
async function makePlayers() {
  // (the animated Blender characters when they are there; else the Tripo Foxino with code poses and the code-built Rob)
  const [fa, ra] = await Promise.all([loadAnimChar('foxino-baller.glb', { height: 1.3, kind: 'fox' }), loadAnimChar('rob-baller.glb', { height: 1.45, kind: 'rob' })]);
  const fox = fa || await loadFoxino().catch(() => null);
  if (fox && !fa) { fox.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(fox.root); fox.setKit({ shirt: '#ffcd1c', trim: '#5b2bb0', shorts: '#5b2bb0', socks: '#ffffff', boots: '#f4f4f4' }); }
  const rob = ra || makeRob(); if (!ra) { rob.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(rob.root); }
  P.me = { ch: fox, x: 0, z: TOP_Z, tx: 0, tz: TOP_Z, yaw: Math.PI, act: 'idle', u: 0, dir: 1 };
  P.rob = { ch: rob, x: 0, z: DEF_Z, tx: 0, tz: DEF_Z, yaw: 0, act: 'stance', u: 0, y: 0 };
}
const hand = (who, out) => {
  const C = P[who] && P[who].ch;
  if (C && C.isAnim && C.bones.RightHand) return C.bones.RightHand.getWorldPosition(out);
  if (who === 'me' && P.me.ch && P.me.ch.bones && P.me.ch.bones.RightHand) return P.me.ch.bones.RightHand.getWorldPosition(out);
  if (who === 'rob' && P.rob.ch.J && P.rob.ch.J.gloveR) return P.rob.ch.J.gloveR.localToWorld(out.set(0, -0.15, 0));
  const p = P[who]; return out.set(p.x + 0.3, 0.9, p.z);
};
function updatePlayers(dt, t, ts) {
  for (const k of ['me', 'rob']) {
    const p = P[k]; if (!p || !p.ch) continue;
    const vx = p.tx - p.x, vz = p.tz - p.z, sp = Math.hypot(vx, vz);
    p.x = damp(p.x, p.tx, p.fast ? 5 : 3.2, ts); p.z = damp(p.z, p.tz, p.fast ? 5 : 3.2, ts);
    const moving = clamp(sp * 1.2, 0, 1) * (ts / Math.max(dt, 1e-4) > 0.2 ? 1 : 0.25);
    p.u = Math.min(1, p.u + ts / (p.dur || 0.7));
    let pose;
    if (p.ch.isAnim) {   // the real clips: the action → a clip, sideways shuffles by which way he moves
      let act = p.act;
      if (act === 'dribble' && moving > 0.2) act = 'drive';
      if (act === 'stance' && moving > 0.2) { const lx = Math.cos(p.yaw), lz = -Math.sin(p.yaw); act = vx * lx + vz * lz > 0 ? 'slideL' : 'slideR'; }
      if (k === 'rob' && p.ch.face) p.ch.face(act === 'cheer' ? 'happy' : act === 'stumble' ? 'oops' : act === 'sad' ? 'sad' : act === 'stance' || act === 'slideL' || act === 'slideR' ? 'focus' : 'happy');
      p.ch.play(act); p.ch.update(ts);
      p.ch.root.position.set(p.x, 0, p.z); p.ch.root.rotation.y = p.yaw;
      continue;
    }
    if (k === 'me') {
      const b = 0.5 + 0.5 * Math.sin(t * 9);
      switch (p.act) {
        case 'dribble': pose = moving > 0.2 ? BPOSES.drive(t * 13, b) : BPOSES.dribble(t, b); break;
        case 'cross': pose = BPOSES.crossover(p.u, t); break;
        case 'shoot': pose = BPOSES.shoot(p.u); break;
        case 'stance': pose = BPOSES.stance(t, moving); break;
        case 'steal': pose = BPOSES.steal(p.u, t); break;
        case 'block': pose = BPOSES.block(p.u); break;
        case 'stumble': pose = BPOSES.stumble(p.u, t); break;
        case 'cheer': pose = BPOSES.celebrate(t); break;
        case 'sad': pose = BPOSES.sad(t); break;
        case 'run': pose = BPOSES.run(t * 13, 1); break;
        default: pose = BPOSES.hold ? BPOSES.hold(t) : BPOSES.stand(t);
      }
      p.ch.apply(pose, 14, dt);
      p.ch.root.position.set(p.x, 0, p.z); p.ch.root.rotation.y = p.yaw;
    } else {
      switch (p.act) {
        case 'dribble': pose = moving > 0.2 ? RB.run(t, moving) : RB.dribble(t, 0.5 + 0.5 * Math.sin(t * 9)); break;
        case 'shoot': pose = RB.shoot(p.u); break;
        case 'steal': pose = RB.steal(p.u); break;
        case 'stumble': pose = RB.stumble(p.u, t); break;
        case 'cheer': pose = RB.cheer(t); break;
        default: pose = moving > 0.2 ? RB.run(t, moving) : RB.stance(t);
      }
      p.ch.apply(pose, 14, dt); p.ch.update(dt, t);
      p.y = p.act === 'shoot' ? 0.35 * Math.sin(Math.PI * clamp((p.u - 0.25) / 0.6, 0, 1)) : damp(p.y || 0, 0, 8, dt);
      p.ch.root.position.set(p.x, p.y, p.z); p.ch.root.rotation.y = p.yaw;
    }
  }
}

// ---------- the ball's states: held / dribbled by someone, or flying ----------
const BL = { mode: 'dribble', who: 'me', arcs: [], i: 0, u: 0, onEnd: null };
const arcPos = (A, u, out) => out.lerpVectors(A.a, A.b, u).setY(lerp(A.a.y, A.b.y, u) + 4 * A.h * u * (1 - u));
function fly(arcs, onEnd) { BL.mode = 'fly'; BL.arcs = arcs; BL.i = 0; BL.u = 0; BL.onEnd = onEnd; }
const _h = new THREE.Vector3();
let lastBounce = 0;
function updateBall(dt, t, ts) {
  if (!ball) return;
  if (BL.mode === 'dribble' || BL.mode === 'hold') {
    hand(BL.who, _h);
    const p = P[BL.who], fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);   // (his front)
    if (BL.mode === 'hold') { ball.position.copy(_h).add(_v4.set(fx * 0.12, -0.05, fz * 0.12)); return; }
    const ph = (t * 9 / (Math.PI * 2)) % 1, b = Math.abs(Math.cos(Math.PI * ph));
    ball.position.set(_h.x + fx * 0.1, lerp(BALL_R, Math.max(BALL_R, _h.y - 0.1), b), _h.z + fz * 0.1);
    if (b < 0.08 && t - lastBounce > 0.3 && ts / Math.max(dt, 1e-4) > 0.5) { lastBounce = t; sfx.thud && sfx.thud(); }
    ball.rotation.x += ts * 6;
    return;
  }
  if (BL.mode === 'fly') {
    const A = BL.arcs[BL.i]; if (!A) { BL.mode = 'rest'; return; }
    BL.u += ts / A.d; ball.rotation.x -= ts * 8;
    if (BL.u >= 1) { BL.i++; BL.u = 0; if (A.sound) sfx[A.sound] && sfx[A.sound](); if (A.net) swish(); if (BL.i >= BL.arcs.length) { arcPos(A, 1, ball.position); BL.mode = 'rest'; const f = BL.onEnd; BL.onEnd = null; if (f) f(); return; } }
    arcPos(BL.arcs[BL.i], BL.u, ball.position);
  }
}
// a soft trail behind the flying ball
const trail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb36a, transparent: true, opacity: 0.4, depthWrite: false }));
trail.geometry.translate(0, -0.5, 0); trail.geometry.rotateX(Math.PI / 2); trail.visible = false;
const _tp = new THREE.Vector3();
function updateTrail() {
  if (BL.mode !== 'fly' || !ball) { trail.visible = false; _tp.copy(ball ? ball.position : _tp); return; }
  if (!trail.parent) scene.add(trail);
  const d = ball.position.distanceTo(_tp); trail.visible = d > 0.01;
  if (trail.visible) { trail.position.copy(ball.position); trail.lookAt(_tp); trail.scale.set(1, 1, Math.min(1.8, d * 18)); trail.material.color.set(combo >= 3 ? 0xff7a2a : 0xffd8a0); }
  _tp.copy(ball.position);
}
let netT = -9;
function swish() { netT = 0; sfx.net && sfx.net(); }
const CONF = ['#ffcd1c', '#ff5d8f', '#48d8ff', '#66e08a', '#8f52d9', '#ff7d22'];
function celebrate(big) {
  CROWD.cheer = 1.4; CAMV.punch = 1; SLOWMO = 0.45;
  for (let i = 0; i < (big ? 6 : 3); i++) BURST.emit(RIM.clone().add(_v4.set(0, 0.2, 0)), 22, CONF[i % CONF.length], 7, 0.17);
}
function dust(x, z) { BURST.emit(new THREE.Vector3(x, 0.06, z), 14, '#c9b49a', 2.2, 0.16); }
function updateNet(dt) { if (!NET) return; netT += dt; const k = netT < 0.6 ? Math.sin(netT * 22) * Math.exp(-netT * 5) : 0; const b = NET.userData.base || (NET.userData.base = NET.scale.clone());
  NET.scale.set(b.x * (1 - 0.12 * k), b.y * (1 + 0.25 * Math.abs(k)), b.z * (1 - 0.12 * k)); }

// ---------- the word bubbles (the word drawn inside each one), as in Foxino Tennis ----------
function wordSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.renderOrder = 20; sp.scale.set(2.0, 1.0, 1);
  sp.userData.draw = (word, col) => { const g = c.getContext('2d'); g.clearRect(0, 0, 512, 256); let fs = 176; g.font = `400 ${fs}px "Lilita One", sans-serif`;
    while (g.measureText(word).width > 470 && fs > 40) { fs -= 6; g.font = `400 ${fs}px "Lilita One", sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = fs * 0.2; g.strokeStyle = 'rgba(29,22,64,0.92)'; g.strokeText(word, 256, 136); g.fillStyle = col || '#fff'; g.fillText(word, 256, 136); t.needsUpdate = true; };
  return sp;
}
const bubbles = TINTS.map((c) => { const b = makeBubble(c); b.mesh.visible = false; scene.add(b.mesh); const w = wordSprite(); b.mesh.add(w); return Object.assign(b, { word: w, x: 0, y: 0, z: 0, state: 'off', t: 0, size: 0.6 }); });
const labelEls = CSS_TINTS.map((c, k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'blabel'; b.style.setProperty('--c', c); b.innerHTML = '<span></span>';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); answer(k); }); $('labels').appendChild(b); return b; });
let bubGen = 0;
function showBubbles(words, spots) {
  bubGen++;
  words.forEach((wd, k) => { const b = bubbles[k], s = spots[k]; b.word.userData.draw(wd); b.word.material.opacity = 1;
    const narrow = camera.aspect < 0.8;   // (an upright phone: the bubbles closer together, round the camera's line, so none is cut off)
    // the middle of the camera's view at this bubble's depth (where the camera is heading, it may still be sliding)
    const camX = CAMV.pos.x + CAMV.x * 0.5 + CAMV.side, lookX = CAMV.look.x + CAMV.x * 0.35, tt = clamp((CAMV.pos.z - s[2]) / (CAMV.pos.z - CAMV.look.z), 0, 1.5), cx = camX + (lookX - camX) * tt;
    Object.assign(b, { x: narrow ? cx + s[0] * 0.74 : (CAMV.side ? cx + s[0] : s[0]), y: s[1], z: s[2], state: 'in', t: -k * 0.08, size: (s[3] || 0.6) * (narrow ? 0.92 : 1) }); b.mesh.visible = true; b.u.uAlpha.value = 1; b.u.uGlow.value = 0; b.u.uHot.value = 0; b.mesh.scale.setScalar(0.001);
    labelEls[k].style.opacity = '1'; labelEls[k].dataset.word = wd; });
  for (let k = words.length; k < 3; k++) { bubbles[k].mesh.visible = false; labelEls[k].style.opacity = '0'; }
  sfx.bubble && sfx.bubble();
}
function popBubbles(k, rightK) {
  bubbles.forEach((b, i) => { if (b.state === 'off') return; b.state = i === k && k === rightK ? 'pop' : i === rightK ? 'right' : 'fade'; b.t = 0; if (i === rightK && k !== rightK) { b.u.uGlow.value = 1; b.word.userData.draw(labelEls[i].dataset.word, '#b9ffcf'); } });
  const g = bubGen; setTimeout(() => { if (g === bubGen) labelEls.forEach((l) => { l.style.opacity = '0'; }); }, 300);
}
function updateBubbles(dt, t) {
  for (const b of bubbles) {
    if (!b.mesh.visible) continue; b.t += dt; b.u.uTime.value = t;
    if (b.state === 'in') b.mesh.scale.setScalar(Math.max(0.001, b.size * smooth(b.t / 0.3)));
    if (b.state === 'pop') { b.mesh.scale.setScalar(b.size * (1 + b.t * 2)); b.u.uAlpha.value = Math.max(0, 1 - b.t * 3); b.word.material.opacity = Math.max(0, 1 - b.t * 3); if (b.t > 0.35) { b.mesh.visible = false; b.state = 'off'; } }
    if (b.state === 'fade') { b.u.uAlpha.value = Math.max(0, 1 - b.t * 2); b.word.material.opacity = Math.max(0, 1 - b.t * 2.5); if (b.t > 0.5) { b.mesh.visible = false; b.state = 'off'; } }
    if (b.state === 'right') { b.mesh.scale.setScalar(b.size * (1 + 0.08 * Math.sin(b.t * 12))); if (b.t > 1.3) { b.state = 'fade'; b.t = 0; } }
    b.mesh.position.set(b.x, b.y + Math.sin(t * 2 + b.x) * 0.05, b.z);
  }
}
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  bubbles.forEach((b, k) => { const l = labelEls[k]; if (!b.mesh.visible) return; _v4.copy(b.mesh.position).project(camera);
    const d = camera.position.distanceTo(b.mesh.position), px = Math.max(70, (b.size * 1.15 / (d * Math.tan(camera.fov * Math.PI / 360))) * h);
    l.style.width = l.style.height = `${px.toFixed(0)}px`; l.style.transform = `translate(${(_v4.x * 0.5 + 0.5) * w}px, ${(-_v4.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`; });
}

// ---------- the juice (bursts, PERFECT!, the combo, the shake) ----------
const BURST = (() => {
  const N = 240, geo = new THREE.BufferGeometry(), Pp = new Float32Array(N * 3), C = new Float32Array(N * 3), S = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setAttribute('size', new THREE.BufferAttribute(S, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexColors: true, uniforms: { uScale: { value: 500 } },
    vertexShader: 'attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; gl_FragColor = vec4(vC * 1.25, smoothstep(0.5, 0.1, r)); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 30; scene.add(pts);
  const parts = Array.from({ length: N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), s: 0 })); let head = 0;
  return {
    emit(pos, n, color, speed = 5, size = 0.15) { const c = new THREE.Color(color); for (let i = 0; i < n; i++) { const q = parts[head = (head + 1) % N]; q.life = 0.5 + Math.random() * 0.5; q.p.copy(pos);
      q.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)); q.c.copy(c); q.s = size * (0.6 + Math.random() * 0.9); } },
    update(dt) { for (let i = 0; i < N; i++) { const q = parts[i]; if (q.life > 0) { q.life -= dt; q.v.y -= 6 * dt; q.v.multiplyScalar(1 - 1.8 * dt); q.p.addScaledVector(q.v, dt); }
      Pp[i * 3] = q.p.x; Pp[i * 3 + 1] = q.life > 0 ? q.p.y : -999; Pp[i * 3 + 2] = q.p.z; C[i * 3] = q.c.r; C[i * 3 + 1] = q.c.g; C[i * 3 + 2] = q.c.b; S[i] = q.life > 0 ? q.s * Math.min(1, q.life * 3) : 0; }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true; },
    scale(h) { mat.uniforms.uScale.value = h * 0.7; },
  };
})();
let SHAKE = 0, combo = 0, SLOWMO = 0;
function popText(pos, text, cls) { _v4.copy(pos).project(camera); const el = document.createElement('div'); el.className = 'ptext ' + cls; el.textContent = text;
  el.style.left = `${(_v4.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-_v4.y * 0.5 + 0.5) * innerHeight}px`; $('fxText').appendChild(el); setTimeout(() => el.remove(), 1100); }
function flashScreen(cls) { const f = $('flash2'); f.className = ''; void f.offsetWidth; f.className = cls; }
function renderCombo() { const c = $('combo'); c.hidden = combo < 2; if (combo >= 2) { c.innerHTML = `🔥 <b>${combo}</b> in a row`; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
function juice(ok, ms, k) {
  const b = bubbles[k], at = b && b.mesh.visible ? b.mesh.position.clone() : new THREE.Vector3(0, 1.6, 6);
  if (ok) { combo++; const tier = ms < 2500 ? 'PERFECT!' : ms < 5000 ? 'GREAT!' : 'GOOD!';
    BURST.emit(at, 34, CSS_TINTS[k] || '#ffd84a', 6); BURST.emit(at, 20, '#ffffff', 4, 0.12); if (tier === 'PERFECT!') BURST.emit(at, 30, '#ffd84a', 9, 0.2);
    popText(at, combo >= 2 ? `${tier} ×${combo}` : tier, tier === 'PERFECT!' ? 'perfect' : 'good'); SHAKE = tier === 'PERFECT!' ? 0.9 : 0.6; vib(tier === 'PERFECT!' ? [25, 40, 45] : 30);
    flashScreen('good'); sfx.star && sfx.star(Math.min(2, combo - 1)); CROWD.cheer = Math.max(CROWD.cheer, Math.min(1, 0.35 + combo * 0.15)); }
  else { combo = 0; popText(at, k < 0 ? 'TOO SLOW!' : 'OOPS!', 'bad'); flashScreen('bad'); vib([70, 40, 70]); SHAKE = 0.5; }
  renderCombo();
}

// ---------- the questions ----------
const PACKS = window.FSQ ? FSQ.packs() : [];
let packIds = (store.get('sports-packs', null) || store.get('tennis-packs', []) || []).filter((id) => PACKS.some((p) => p.id === id));
if (!packIds.length && PACKS.length) packIds = [(PACKS.find((p) => p.level === 'A1') || PACKS[0]).id];
const G = { on: false, score: [0, 0], asked: 0, right: 0, missed: [], slow: 1, ask: null };
let timerT = null;
// ask(): the question card, the bubbles at `spots`, slow motion; resolves {k, ok, ms} on a tap or when the time is up
function ask(title, sub, spots, secs = 10, fixRight = -1) {
  const q = FSQ.make(PACKS, packIds, { n: 3, count: G.asked }); if (!q) return Promise.resolve({ k: -1, ok: false, ms: 0, q: null });
  // (defence: the right word goes into the lane Rob drives into)
  if (fixRight >= 0 && fixRight !== q.correct) { const w = q.words.slice(); [w[fixRight], w[q.correct]] = [w[q.correct], w[fixRight]]; q.words = w; q.correct = fixRight; }
  $('hud').classList.remove('hidden');
  $('cardWho').innerHTML = `<em style="--c:${title.c}">${esc(title.t)}</em> ${esc(sub)}`;
  $('sentence').innerHTML = `${hints(q.before)}<span class="gap">&nbsp;</span>${hints(q.after)}`;
  $('note').className = ''; $('note').innerHTML = '&nbsp;';
  const f = $('tFill'), bar = f.parentElement; bar.classList.remove('low'); f.style.transition = 'none'; f.style.transform = 'scaleX(1)'; void f.offsetWidth; f.style.transition = `transform ${secs}s linear`; f.style.transform = 'scaleX(0)';
  clearTimeout(timerT); timerT = setTimeout(() => bar.classList.add('low'), Math.max(0, secs - 3) * 1000);
  showBubbles(q.words.map((w) => w.text), spots);
  G.slow = 0.04;
  return new Promise((res) => { G.ask = { q, t0: performance.now(), res, done: false, secs }; G.ask.tmo = setTimeout(() => answer(-1), secs * 1000); });
}
function answer(k) {
  const A = G.ask; if (!A || A.done) return; A.done = true; clearTimeout(A.tmo); clearTimeout(timerT);
  const ms = performance.now() - A.t0, ok = k === A.q.correct;
  G.asked++; if (ok) G.right++; else G.missed.push(A.q);
  if (k >= 0) sfx.pick && sfx.pick();
  juice(ok, ms, k); popBubbles(k, A.q.correct);
  const f = $('tFill'); const tr = getComputedStyle(f).transform; f.style.transition = 'none'; f.style.transform = tr === 'none' ? 'scaleX(0)' : tr;
  $('sentence').innerHTML = `${hints(A.q.before)}<span class="gap ok">${esc(A.q.right)}</span>${hints(A.q.after)}`;
  $('note').className = ok ? 'good' : 'bad'; $('note').innerHTML = ok ? ['Great!', 'Super!', 'Yes! ✓', 'Brilliant!'][Math.floor(Math.random() * 4)] : `${k < 0 ? 'Too slow!' : 'Not that one!'} The right word is <b>${esc(A.q.right)}</b>`;
  G.slow = 1; G.ask = null;
  A.res({ k, ok, ms, q: A.q });
}
// waits in GAME time (the frames), so slow phones never let a timer run ahead of the animation
const waits = [];
const wait = (s) => new Promise((res) => waits.push({ t: s, res }));
function tickWaits(ts) { for (let i = waits.length - 1; i >= 0; i--) { waits[i].t -= ts; if (waits[i].t <= 0) { const w = waits.splice(i, 1)[0]; w.res(); } } }
function banner(text, sub) { const b = $('banner'); b.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(b._t); b._t = setTimeout(() => { b.innerHTML = ''; }, 1600); }
function score() { $('score').innerHTML = `FOXINO <b>${G.score[0]}</b> : <b>${G.score[1]}</b> ROB · first to ${WIN}`; }
const ME = { t: 'YOUR BALL', c: '#ff7d22' }, DEF = { t: 'DEFENCE', c: '#2a9cd8' };

// ---------- the plays ----------
function setPlay(meAct, robAct) { if (meAct) { P.me.act = meAct; P.me.u = 0; } if (robAct) { P.rob.act = robAct; P.rob.u = 0; } }
async function attack() {
  // Foxino at the top with the ball, Rob guarding him
  Object.assign(P.me, { tx: rand(-0.6, 0.6), tz: TOP_Z, yaw: Math.PI, fast: false }); Object.assign(P.rob, { tx: P.me.tx * 0.6 - 0.55, tz: DEF_Z, yaw: 0 }); setPlay('dribble', 'stance'); CAMV.side = 0.6;
  BL.mode = 'dribble'; BL.who = 'me';
  await wait(1.1); if (!G.on) return;
  const side = Math.random() < 0.5 ? -1 : 1;
  const r1 = await ask(ME, 'beat Rob: tap the right word!', [[-1.45, 2.4, 5.5], [0, 2.95, 5.2], [1.45, 2.4, 5.5]]);
  if (!G.on) return;
  if (!r1.ok) {   // Rob pokes the ball away
    setPlay(null, 'steal'); P.rob.tz = P.me.z - 0.6; await wait(0.35); BL.mode = 'dribble'; BL.who = 'rob'; setPlay('stumble', 'dribble'); banner('STOLEN!', 'Rob has the ball'); sfx.aww && sfx.aww(); await wait(1.4); return 'rob';
  }
  // the crossover and the drive past him
  setPlay('cross', 'stumble'); P.me.dur = 0.55; await wait(0.55);
  Object.assign(P.me, { tx: side * 1.3, tz: 2.6, fast: true }); setPlay('dribble'); P.rob.tx = -side * 0.8; P.rob.tz = DEF_Z + 0.4; await wait(1.0); if (!G.on) return;
  const r2 = await ask(ME, 'shoot! tap the right word', [[-1.6, 3.0, 2.6], [0, 3.55, 2.3], [1.6, 3.0, 2.6]]);
  if (!G.on) return;
  setPlay('shoot'); P.me.dur = 0.9; await wait(0.48); setTimeout(() => dust(P.me.x, P.me.z), 450);
  hand('me', _h); const from = _h.clone().add(_v4.set(0, 0.25, -0.1));
  if (r2.ok) {   // swish: over the rim, down through the net, a bounce under the hoop
    fly([{ a: from, b: RIM.clone().add(_v4.set(0, 0.08, 0)), h: 1.1, d: 0.85 }, { a: RIM.clone().add(_v4.set(0, 0.08, 0)), b: RIM.clone().add(_v4.set(0, -0.45, 0)), h: 0, d: 0.18, net: true },
      { a: RIM.clone().add(_v4.set(0, -0.45, 0)), b: new THREE.Vector3(rand(-0.4, 0.4), BALL_R, 1.6), h: 0, d: 0.32, sound: 'thud' }, { a: new THREE.Vector3(0, BALL_R, 1.6), b: new THREE.Vector3(rand(-0.6, 0.6), BALL_R, 2.6), h: 0.35, d: 0.45 }]);
    celebrate(true); await wait(1.2); G.score[0]++; score(); banner('SCORE!', `${G.score[0]} : ${G.score[1]}`); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); setPlay('cheer'); BURST.emit(RIM.clone(), 50, '#ffd84a', 6, 0.18); vib([30, 40, 60]);
    await wait(1.6); return 'rob';
  }
  // off the front of the rim and out: Rob takes the rebound
  const front = RIM.clone().add(_v4.set(rand(-0.1, 0.1), 0.02, 0.2));
  fly([{ a: from, b: front, h: 1.0, d: 0.8, sound: 'thud' }, { a: front, b: new THREE.Vector3(rand(-1.2, 1.2), BALL_R, 3.4), h: 0.7, d: 0.7 }]);
  await wait(1.0); P.rob.tx = ball.position.x; P.rob.tz = 3.6; await wait(0.6); banner('NO GOOD!', 'Rob gets the rebound'); BL.mode = 'dribble'; BL.who = 'rob'; setPlay('sad', 'dribble'); await wait(1.4);
  return 'rob';
}
async function defence() {
  // Rob at the top with the ball, Foxino guarding (he faces Rob)
  Object.assign(P.rob, { tx: rand(-0.5, 0.5), tz: TOP_Z, yaw: Math.PI }); Object.assign(P.me, { tx: P.rob.tx * 0.6 + 0.5, tz: DEF_Z, yaw: 0, fast: false }); setPlay('stance', 'dribble'); CAMV.side = 2.4;   // (the camera steps to the side: Rob is between it and Foxino)
  BL.mode = 'dribble'; BL.who = 'rob';
  await wait(1.1); if (!G.on) return;
  const lane = Math.floor(Math.random() * 3);
  const r1 = await ask(DEF, 'where will Rob go? the right word is his lane', LANES.map((x) => [x * 1.38, 2.35, DEF_Z - 0.6]), 10, lane);
  if (!G.on) return;
  const pick = r1.k >= 0 ? r1.k : 1;
  Object.assign(P.me, { tx: LANES[pick], fast: true });
  if (r1.ok) {   // Foxino is in his lane: the steal
    P.rob.tx = LANES[lane]; P.rob.tz = DEF_Z + 0.7; await wait(0.45); setPlay('steal'); P.me.dur = 0.6; await wait(0.3);
    BL.mode = 'dribble'; BL.who = 'me'; setPlay(null, 'stumble'); banner('STEAL!', 'your ball'); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); await wait(1.4); return 'me';
  }
  // Rob drives past into the lane
  Object.assign(P.rob, { tx: LANES[lane] * 0.9, tz: 2.3 }); setPlay('stumble', 'dribble'); await wait(1.0); if (!G.on) return;
  P.me.tx = LANES[lane] * 0.6; P.me.tz = 3.0;
  const QUICK = 4.5;   // (seconds: right AND this fast = the block)
  const r2 = await ask({ t: 'BLOCK IT!', c: '#e8403a' }, 'right AND fast!', [[-1.6, 3.0, 2.8], [0, 3.55, 2.5], [1.6, 3.0, 2.8]], 7);
  if (!G.on) return;
  P.rob.yaw = Math.PI; setPlay(null, 'shoot'); P.rob.dur = 0.9; await wait(0.4);
  hand('rob', _h); const from = _h.clone().add(_v4.set(0, 0.2, -0.1));
  if (r2.ok && r2.ms < QUICK * 1000) {   // the block
    setPlay('block'); P.me.dur = 0.9; await wait(0.25); setTimeout(() => dust(P.me.x, P.me.z), 650);
    fly([{ a: from, b: new THREE.Vector3(from.x + rand(-2, 2), BALL_R, from.z + 3.2), h: 1.2, d: 0.8, sound: 'thud' }]);
    banner('BLOCKED!', 'your ball'); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); BURST.emit(from, 40, '#6fe2ff', 6, 0.18); await wait(1.4); BL.mode = 'dribble'; BL.who = 'me'; return 'me';
  }
  if (r2.ok) banner('TOO LATE!', 'jump faster next time');
  const make = Math.random() > 0.33;
  if (make) {
    fly([{ a: from, b: RIM.clone().add(_v4.set(0, 0.08, 0)), h: 1.1, d: 0.85 }, { a: RIM.clone().add(_v4.set(0, 0.08, 0)), b: RIM.clone().add(_v4.set(0, -0.45, 0)), h: 0, d: 0.18, net: true },
      { a: RIM.clone().add(_v4.set(0, -0.45, 0)), b: new THREE.Vector3(0, BALL_R, 1.7), h: 0, d: 0.32, sound: 'thud' }]);
    await wait(1.2); G.score[1]++; score(); banner('ROB SCORES', `${G.score[0]} : ${G.score[1]}`); sfx.aww && sfx.aww(); setPlay('sad', 'cheer'); await wait(1.6); return 'me';
  }
  const front = RIM.clone().add(_v4.set(0.1, 0.02, 0.2));
  fly([{ a: from, b: front, h: 1.0, d: 0.8, sound: 'thud' }, { a: front, b: new THREE.Vector3(rand(-1, 1), BALL_R, 3.6), h: 0.7, d: 0.7 }]);
  await wait(1.2); banner('ROB MISSED!', 'your ball'); BL.mode = 'dribble'; BL.who = 'me'; await wait(1.2); return 'me';
}
async function match() {
  Object.assign(G, { on: true, score: [0, 0], asked: 0, right: 0, missed: [] }); combo = 0; renderCombo(); score(); $('score').classList.remove('hidden');
  $('start').classList.add('hidden'); $('end').classList.add('hidden');
  sfx.whistle && sfx.whistle(); banner('1 ON 1', `first to ${WIN} baskets`);
  let poss = 'me';
  while (G.on && G.score[0] < WIN && G.score[1] < WIN) poss = (await (poss === 'me' ? attack() : defence())) || (poss === 'me' ? 'rob' : 'me');
  if (!G.on) return;
  G.on = false; finish(G.score[0] >= WIN);
}
function finish(won) {
  $('hud').classList.add('hidden'); bubbles.forEach((b) => { b.mesh.visible = false; }); labelEls.forEach((l) => { l.style.opacity = '0'; });
  const [a, b] = G.score, stars = won ? (b === 0 ? 3 : 2) : a > 0 ? 1 : 0;
  $('endTitle').textContent = won ? 'You beat Rob!' : 'Rob won this time!';
  $('endGames').textContent = `${a} – ${b}`; document.querySelector('.endscore span').textContent = 'baskets';
  $('endLine').textContent = `${G.right} of ${G.asked} answers right`;
  const st = [...document.querySelectorAll('#stars i')]; st.forEach((e) => e.classList.remove('on')); st.forEach((e, i) => { if (i < stars) setTimeout(() => { e.classList.add('on'); sfx.star && sfx.star(i); }, 500 + i * 300); });
  $('missedList').innerHTML = G.missed.slice(-6).map((q) => `<li>${hints(q.before)}<b>${esc(q.right)}</b>${hints(q.after)}</li>`).join(''); $('missed').classList.toggle('hidden', !G.missed.length);
  const best = store.get('streetball-best', { wins: 0 }); if (won) { best.wins = (best.wins || 0) + 1; store.set('streetball-best', best); }
  $('end').classList.remove('hidden'); setPlay(won ? 'cheer' : 'sad', won ? 'sad' : 'cheer');
  if (won) { CROWD.cheer = 1; confetti(); }
  renderStart();
  if (LIST && window.parent !== window) window.parent.postMessage({ fb: 'finished', won, score: [a, b], right: G.right, asked: G.asked }, '*');
}
function confetti() {
  const cv = $('confetti'), g = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight), cols = ['#ffcd1c', '#ff5d8f', '#48d8ff', '#66e08a', '#8f52d9'];
  const bits = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 100, vy: 120 + Math.random() * 240, a: Math.random() * 6, va: (Math.random() - 0.5) * 10, c: cols[Math.floor(Math.random() * 5)], s: 6 + Math.random() * 7 }));
  let t0 = performance.now(); const st = (now) => { const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; g.clearRect(0, 0, W, H); let n = 0;
    for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 160 * dt; b.a += b.va * dt; if (b.y < H + 20) { n++; g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); } }
    if (n) requestAnimationFrame(st); else g.clearRect(0, 0, W, H); }; requestAnimationFrame(st);
}

// ---------- the start screen ----------
function renderStart() {
  const ps = packIds.map((id) => PACKS.find((p) => p.id === id)).filter(Boolean), label = (p) => (window.FugioPacks && FugioPacks.label ? FugioPacks.label(p) : p.level);
  $('packBtn').innerHTML = ps.length ? `${esc(ps.length > 1 ? `${ps.length} packages` : ps[0].title)}<small>${esc(ps.map(label).join(' · '))} · change the words ›</small>` : 'Choose the words ›';
  const best = store.get('streetball-best', { wins: 0 }); $('bestLine').textContent = best.wins ? `You have beaten Rob ${best.wins} time${best.wins > 1 ? 's' : ''}!` : '';
}
$('playBtn').onclick = () => { unlock(); sfx.click && sfx.click(); match(); };
$('againBtn').onclick = () => { unlock(); match(); };
$('menuBtn').onclick = () => { sfx.click && sfx.click(); $('end').classList.add('hidden'); $('start').classList.remove('hidden'); };
$('packBtn').onclick = async () => { if (!window.FugioPacks) return; const ids = await FugioPacks.open(PACKS, packIds, { theme: 'gummy' }); if (ids && ids.length) { packIds = ids; store.set('sports-packs', ids); renderStart(); } };
$('leaveBtn').onclick = () => { sfx.click && sfx.click(); G.on = false; if (/[?&]from=sports/.test(location.search)) { location.href = '/sports/'; return; } if (window.parent !== window) window.parent.postMessage({ fugio: 'leave' }, '*'); else location.href = '/'; };
const muteBtn = $('muteBtn'); muteBtn.classList.toggle('muted', isMuted()); muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); muteBtn.classList.toggle('muted', isMuted()); };

// ---------- the camera: behind the top of the key, the hoop up ahead ----------
const CAMV = { pos: new THREE.Vector3(), look: new THREE.Vector3(), x: 0, side: 0, s: 0, punch: 0, p: 0 };
function fitCamera() {
  const a = camera.aspect;
  if (a < 0.8) { camera.fov = 58; CAMV.pos.set(0, 4.7, 12.6); CAMV.look.set(0, 1.85, 2.6); }
  else if (a < 1.3) { camera.fov = 54; CAMV.pos.set(0, 4.6, 13.4); CAMV.look.set(0, 1.75, 2.8); }
  else { camera.fov = 46; CAMV.pos.set(0, 4.4, 14.8); CAMV.look.set(0, 1.5, 3.0); }
  camera.updateProjectionMatrix();
}
function placeCamera(dt) {
  const fx = P.me ? clamp((P.me.x + (P.rob ? P.rob.x : 0)) / 2, -3, 3) : 0; CAMV.x = damp(CAMV.x, fx, 2, dt);
  CAMV.s = damp(CAMV.s, CAMV.side, 1.6, dt);
  SHAKE = Math.max(0, SHAKE - dt * 1.6); const sh = SHAKE * SHAKE * 0.3;
  CAMV.p = damp(CAMV.p, CAMV.punch, 4, dt); CAMV.punch = Math.max(0, CAMV.punch - dt * 0.7);   // (a basket: a quick push in toward the hoop)
  const pk = smooth(CAMV.p) * 0.28;
  camera.position.set(lerp(CAMV.pos.x + CAMV.x * 0.5 + CAMV.s, RIM.x, pk) + (Math.random() - 0.5) * sh, lerp(CAMV.pos.y, RIM.y + 0.6, pk) + (Math.random() - 0.5) * sh, lerp(CAMV.pos.z, RIM.z + 4, pk));
  camera.lookAt(lerp(CAMV.look.x + CAMV.x * 0.35, RIM.x, pk * 2), lerp(CAMV.look.y, RIM.y, pk * 2), lerp(CAMV.look.z, RIM.z, pk * 2));
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; fitCamera(); BURST.scale(h * pr); }
addEventListener('resize', resize);

// ---------- the loop ----------
let last = performance.now(), T = 0, GT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  SLOWMO = Math.max(0, SLOWMO - dt); const ts = dt * G.slow * (SLOWMO > 0 ? 0.4 : 1); GT += ts;
  tickWaits(ts);
  updatePlayers(dt, GT, ts); updateBall(dt, GT, ts); updateBubbles(dt, T); updateNet(dt); updateCrowd(T, dt); BURST.update(dt); updateTrail(); placeCamera(dt);
  POSTFX.draw(scene, camera, 9);
  updateLabels();
  if (POSTFX.governor(dt) && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); }
}
(async () => {
  resize();
  if (document.fonts) await document.fonts.load('40px "Lilita One"').catch(() => {});
  $('loadFill').style.width = '25%';
  await loadCourt();
  $('loadText').textContent = 'Foxino is warming up…'; $('loadFill').style.width = '65%';
  await makePlayers(); ball = makeBall();
  $('loadFill').style.width = '100%';
  requestAnimationFrame(frame);
  setTimeout(() => $('loading').classList.add('gone'), 150);
  renderStart();
  if (LIST) { unlock(); match(); } else $('start').classList.remove('hidden');
  window.SB = { G, P, BL, answer, get ask() { return G.ask; }, renderer, scene, POSTFX, models: () => Object.keys(SB) };
})();
