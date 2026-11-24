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
import { makeAnimChar } from './charanim.js?v=3';
import { makeSnowfall, snowCover, stringLights, loadXmasKit, placeKit } from '../xmas.js?v=3';   // (2026-11-24, the user: snow and a Christmas atmosphere in every sport)

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
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x8d8ac6, 45, 140);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
paintedSky(scene, '/sports/art/sky-winter-dusk.webp?v=1', { envRenderer: renderer, yaw: 0.25, onFog: () => scene.fog.color.set(0x8d8ac6) });   // (Christmas: a winter dusk with a soft aurora, a cool haze)
{ const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0xf2c9a0, side: THREE.BackSide }))); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }
// (2026-11-17, "ultimate" pass) golden hour: a low warm sun with long soft shadows, a cool sky fill, a cyan rim from behind
scene.add(new THREE.HemisphereLight(0xe6e8ff, 0x8a86b4, 1.0));   // (Christmas: a cool sky, snow light from below)
const sun = new THREE.DirectionalLight(0xffd3a2, 2.1); sun.position.set(-13, 10, 11); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
sun.target.position.set(0, 0, 5); scene.add(sun, sun.target);
const back = new THREE.DirectionalLight(0x9fd0ff, 1.15); back.position.set(9, 7, -14); scene.add(back);
const POSTFX = makePost(renderer, { aoRange: 70, focusMul: 1.4, blur: 0.5, grade: { sat: 1.06, warm: 1.05 }, glow: 0.9 });

// ---------- the court: the Blender models, or simple stand-ins until they are delivered ----------
const SB_FILES = ['sb-court', 'sb-hoop', 'sb-fences', 'sb-wall', 'sb-city', 'sb-bleachers', 'sb-props', 'sb-ball', 'sb-extras'];
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
  if (SB['sb-bleachers']) { SB['sb-bleachers'].updateMatrixWorld(true); SB['sb-bleachers'].traverse((o) => { if (/^Seat/.test(o.name)) SEATS.push(o.matrixWorld.clone()); }); }
  if (SB['sb-extras']) setupExtras(SB['sb-extras']);
  const missing = SB_FILES.filter((n) => !SB[n] && n !== 'sb-ball' && n !== 'sb-extras');
  if (missing.length) standIns(missing);
  if (NET) { NET_BASE = NET.scale.clone(); NET.userData.base = NET_BASE.clone(); }
  await makeCrowd();
  await xmasDress().catch((e) => console.warn('xmas', e));
}
// ---------- Christmas (2026-11-24): snow round the court and on top of things, lights on the fences and the wall, the shared props, falling snow ----------
const XM = { snow: null, lights: [] };
async function xmasDress() {
  for (const n of ['sb-wall', 'sb-city', 'sb-fences', 'sb-bleachers', 'sb-props', 'sb-hoop', 'sb-extras']) if (SB[n]) snowCover(SB[n]);   // (never the court floor itself)
  { const sh = new THREE.Shape([new THREE.Vector2(-60, -60), new THREE.Vector2(60, -60), new THREE.Vector2(60, 60), new THREE.Vector2(-60, 60)]);   // snow on the ground round the court (a hole where the court is)
    sh.holes.push(new THREE.Path([new THREE.Vector2(-8.45, 3.9), new THREE.Vector2(8.45, 3.9), new THREE.Vector2(8.45, -15.3), new THREE.Vector2(-8.45, -15.3)]));
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#eef2fb'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() < 0.6 ? '160,175,220' : '255,255,255'},${Math.random() * 0.18})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.12, 0.12);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })); m.position.y = 0.015; m.receiveShadow = true; m.userData.noSnow = true; scene.add(m); }
  XM.snow = makeSnowfall({ n: innerWidth * innerHeight < 500000 ? 700 : 1100, box: [22, 12, 26], ahead: 0.45 }); scene.add(XM.snow);
  for (const s of [-1, 1]) XM.lights.push(stringLights(scene, [-2, 2.5, 7, 11.5, 15].map((z) => new THREE.Vector3(s * 8.3, 3.15, z)), { sag: 0.3, per: 8 }));
  XM.lights.push(stringLights(scene, [-9, -4.5, 0, 4.5, 9].map((x) => new THREE.Vector3(x, 5.3, -3.6)), { sag: 0.35, per: 9, warm: true }));   // (along the brick wall behind the hoop)
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  if (await loadXmasKit(L)) {
    for (const s of [-1, 1]) {
      placeKit(scene, 'XmasTree_Small', s * 7.0, -2.9, { rot: s * 0.6, s: 1.45 }); placeKit(scene, 'Snowman', s * 7.5, -0.9, { rot: -s * 0.6 });
      placeKit(scene, 'XmasTree_Big', s * 12.2, -2.2, { rot: s, s: 1.4 }); placeKit(scene, 'XmasTree_Big', s * 13.5, 9, { rot: -s, s: 1.2 });
      placeKit(scene, 'Wreath', s * 3.6, -3.68, { y: 3.4 }); placeKit(scene, 'Lantern', s * 9.0, -3.2, { rot: 0 }); }
    placeKit(scene, 'Gift_A', -7.3, 9.2, { rot: 0.4 }); placeKit(scene, 'Gift_B', -7.6, 9.9, { rot: -0.5 }); placeKit(scene, 'Gift_C', 7.4, 11.0, { rot: 0.9 });
    placeKit(scene, 'SnowDrift_A', -10.5, 3.5, { rot: 1.6 }); placeKit(scene, 'SnowDrift_B', 10.6, 6, { rot: 1.4 }); placeKit(scene, 'SnowPile', 9.4, -3.5);
  }
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
// the crowd: the PC's six low-poly fans (sb-crowd.glb, ~500 triangles each) on the bleachers' 40 seats, instanced
// (one draw per fan part), bouncing when the crowd cheers; simple box people if the file is missing
const CROWD = { seats: [], parts: [], cheer: 0 };
async function makeCrowd() {
  let seats = SEATS.slice();
  if (!seats.length) for (const sd of [-1, 1]) for (let r = 0; r < 3; r++) for (let z = 4; z <= 12; z += 1.1) seats.push(new THREE.Matrix4().makeRotationY(-sd * Math.PI / 2).setPosition(sd * (9.6 + r * 0.9), 0.4 + r * 0.5, z));
  CROWD.seats = seats.map((m, i) => ({ m, ph: Math.random() * 6, fan: (i * 7 + (i >> 2)) % 6, hop: 0 }));
  let fans = null;
  try { const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder); const g = (await L.loadAsync('models/sb-crowd.glb?v=1')).scene; g.updateMatrixWorld(true);
    fans = [1, 2, 3, 4, 5, 6].map((n) => g.getObjectByName('Fan' + n)); if (fans.some((f) => !f)) fans = null; } catch (e) { fans = null; }
  const part = (geo, mat, rel, mine) => { const im = new THREE.InstancedMesh(geo, mat, mine.length); im.userData.noCast = true; im.castShadow = false; im.frustumCulled = false; scene.add(im); CROWD.parts.push({ im, rel, seats: mine }); return im; };
  if (fans) {
    fans.forEach((f, fi) => { const mine = CROWD.seats.filter((q) => q.fan === fi); if (!mine.length) return; const inv = f.matrixWorld.clone().invert();
      f.traverse((o) => { if (o.isMesh) part(o.geometry, o.material, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), mine); }); });
  } else {
    const cols = ['#ff5d8f', '#ffb703', '#3ab0ff', '#2fbf6a', '#8f52d9', '#ff7d22', '#ffffff', '#e8403a'], skin = ['#f2c9a0', '#d9a074', '#9c6a44', '#ffd9b8'];
    const bd = part(new THREE.BoxGeometry(0.38, 0.52, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), new THREE.Matrix4().makeTranslation(0, 0.3, 0), CROWD.seats);
    const hd = part(new THREE.IcosahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), new THREE.Matrix4().makeTranslation(0, 0.72, 0), CROWD.seats);
    CROWD.seats.forEach((q, i) => { bd.setColorAt(i, new THREE.Color(cols[i % cols.length])); hd.setColorAt(i, new THREE.Color(skin[(i * 7) % skin.length])); });
  }
}
const _m4 = new THREE.Matrix4(), _v4 = new THREE.Vector3();
function updateCrowd(t, dt) {
  CROWD.cheer = Math.max(0, CROWD.cheer - dt * 0.5);
  for (const q of CROWD.seats) q.hop = Math.max(0, Math.sin(t * 9 + q.ph)) * 0.25 * Math.min(1, CROWD.cheer) + Math.min(0.35, Math.max(0, CROWD.cheer - 0.6) * 0.5) + Math.sin(t * 2 + q.ph) * 0.02;
  for (const pt of CROWD.parts) { pt.seats.forEach((q, i) => { _m4.makeTranslation(0, q.hop, 0).multiply(q.m).multiply(pt.rel); pt.im.setMatrixAt(i, _m4); }); pt.im.instanceMatrix.needsUpdate = true; }
}

// the court extras (sb-extras.glb): string lights, a shot clock that counts the question's seconds, pigeons on the wall
const EXTRA = { clock: null, birds: [], shown: '' };
function setupExtras(g) {
  g.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.name || '') + ' ' + (o.parent ? o.parent.name : '');
    if (/Decals|Bulbs|Lights/.test(n)) { o.userData.noCast = true; o.castShadow = false; }
    if (o.material && o.material.name === 'Bulb') { o.material.emissiveIntensity = 2.2; o.material.toneMapped = false; }
    if (/ShotClockFace/.test(n)) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 88; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
      o.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); EXTRA.clock = { c, g: c.getContext('2d'), tex };
    }
  });
  for (let i = 1; i <= 4; i++) { const b = g.getObjectByName('Bird' + i); if (b) EXTRA.birds.push({ o: b, base: b.position.clone(), yaw: b.rotation.y, next: rand(1, 5), hop: 0, away: 0, out: 0, dir: new THREE.Vector3() }); }
  drawClock('24');
}
function drawClock(txt) {
  const C = EXTRA.clock; if (!C || txt === EXTRA.shown) return; EXTRA.shown = txt; const g = C.g;
  g.fillStyle = '#120c18'; g.fillRect(0, 0, 128, 88); g.font = 'bold 70px "Lilita One", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,60,40,0.14)'; g.fillText('88', 64, 48); g.fillStyle = txt.length && +txt <= 3 ? '#ffd23a' : '#ff4a2e'; g.fillText(txt, 64, 48); C.tex.needsUpdate = true;
}
function updateExtras(dt) {
  if (EXTRA.clock) { const A = G.ask; drawClock(A && !A.done ? String(Math.max(0, Math.ceil(A.secs - (performance.now() - A.t0) / 1000))) : String(Math.min(24, 12 + G.score[0] + G.score[1]))); }
  for (const b of EXTRA.birds) {   // they peck and hop; a big cheer scares them off the wall, they come back later
    if (b.away === 0 && CROWD.cheer > 0.95) { b.away = 0.001; b.out = rand(4, 7); b.dir.set(rand(-1, 1), 0, rand(-1, -0.2)).normalize(); }
    if (b.away > 0) {
      if (b.out > 0) { b.away = Math.min(1, b.away + dt / 1.6); if (b.away >= 1) b.out -= dt; } else { b.away = Math.max(0, b.away - dt / 2.6); }
      const k = smooth(b.away); b.o.position.copy(b.base).addScaledVector(b.dir, k * 16).add(_v4.set(0, k * 9 + Math.sin(k * Math.PI) * 2, 0));
      b.o.rotation.set(Math.sin(T * 30) * 0.25 * Math.min(1, k * 5), Math.atan2(b.dir.x, b.dir.z) * (k > 0.02 ? 1 : 0) + b.yaw * (k > 0.02 ? 0 : 1), 0);
      continue;
    }
    b.next -= dt; if (b.next < 0) { b.next = rand(0.8, 4); b.hop = 0.3; b.yaw += rand(-0.9, 0.9); }
    b.hop = Math.max(0, b.hop - dt); const h = b.hop > 0 ? Math.sin(Math.PI * b.hop / 0.3) * 0.12 : 0;
    b.o.position.set(b.base.x, b.base.y + h, b.base.z); b.o.rotation.set(Math.sin(T * 7 + b.base.x) > 0.8 ? 0.4 : 0, b.yaw, 0);
  }
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
  try { const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder); const g = await L.loadAsync(`models/${file}?v=2`);
    if (!g.animations || g.animations.length < 5) return null; const ch = makeAnimChar(g, opts); scene.add(ch.root); return ch; } catch (e) { return null; }
}
async function makePlayers() {
  // (the animated Blender characters when they are there; else the Tripo Foxino with code poses and the code-built Rob)
  const [fa, ra] = await Promise.all([loadAnimChar('foxino-baller.glb', { kind: 'fox' }), loadAnimChar('rob-baller.glb', { kind: 'rob' })]);
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
const DERIVED_HOLD = 0.3;   // (s: a clip chosen from the movement - drive, the slides - stays at least this long: no flicker)
function bodyPhysics(p, ts) {
  // lean into the run and the slides on a spring (it overshoots a little when he stops), the feet stay planted
  if (ts < 1e-5) return; const vx = (p.x - (p.px ?? p.x)) / ts, vz = (p.z - (p.pz ?? p.z)) / ts; p.px = p.x; p.pz = p.z;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), fwd = vx * sy + vz * cy, lat = vx * cy - vz * sy;
  const tf = clamp(fwd * 0.05, -0.12, 0.16), tl = clamp(-lat * 0.045, -0.14, 0.14);
  p.lf = p.lf || 0; p.ll = p.ll || 0; p.vf = p.vf || 0; p.vl = p.vl || 0;
  const n = Math.ceil(ts / 0.01), h = ts / n;
  for (let i = 0; i < n; i++) { p.vf += ((tf - p.lf) * 90 - p.vf * 11) * h; p.lf += p.vf * h; p.vl += ((tl - p.ll) * 90 - p.vl * 11) * h; p.ll += p.vl * h; }
}
function separate() {
  const a = P.me, b = P.rob; if (!a || !b) return; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), MIN = 0.62;
  if (d < MIN && d > 1e-4) { const k = (MIN - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
}
function updatePlayers(dt, t, ts) {
  separate();
  for (const k of ['me', 'rob']) {
    const p = P[k]; if (!p || !p.ch) continue;
    const vx = p.tx - p.x, vz = p.tz - p.z, sp = Math.hypot(vx, vz);
    p.x = damp(p.x, p.tx, p.fast ? 5 : 3.2, ts); p.z = damp(p.z, p.tz, p.fast ? 5 : 3.2, ts);
    const moving = clamp(sp * 1.2, 0, 1) * (ts / Math.max(dt, 1e-4) > 0.2 ? 1 : 0.25);
    p.u = Math.min(1, p.u + ts / (p.dur || 0.7));
    let pose;
    if (p.ch.isAnim) {   // the real clips: the action → a clip, sideways shuffles by which way he moves
      let act = p.act;
      // (hysteresis: start the run / the slide above one speed, stop it below a lower one)
      if (act === 'dribble') { if (moving > 0.3) p.drv = true; else if (moving < 0.1) p.drv = false; if (p.drv) act = 'drive'; } else p.drv = false;
      if (act === 'stance') { const lat = vx * Math.cos(p.yaw) - vz * Math.sin(p.yaw); if (moving > 0.3 && Math.abs(lat) > 0.15) p.sl = lat > 0 ? 'slideL' : 'slideR'; else if (moving < 0.1) p.sl = null; if (p.sl) act = p.sl; } else p.sl = null;
      const derived = act !== p.act, now = performance.now() / 1000;
      if (p.force || (act !== p.shown && (!derived || now - (p.shownT || 0) > DERIVED_HOLD) && (!p.shownDerived || now - (p.shownT || 0) > DERIVED_HOLD || !derived))) { p.ch.play(act, 0.22, p.force); p.shown = act; p.shownT = now; p.shownDerived = derived; p.force = false; }
      if (k === 'rob' && p.ch.face) { const a2 = p.shown; p.ch.face(a2 === 'cheer' || a2 === 'dance' ? 'happy' : a2 === 'stumble' ? 'oops' : a2 === 'sad' ? 'sad' : a2 === 'stance' || a2 === 'slideL' || a2 === 'slideR' || a2 === 'block' || a2 === 'steal' ? 'focus' : 'happy'); }
      p.ch.update(ts); bodyPhysics(p, ts);
      p.yawS = p.yawS == null ? p.yaw : p.yawS + Math.atan2(Math.sin(p.yaw - p.yawS), Math.cos(p.yaw - p.yawS)) * (1 - Math.exp(-10 * ts));   // (turns smoothly)
      p.ch.root.rotation.order = 'YXZ'; p.ch.root.position.set(p.x, 0, p.z); p.ch.root.rotation.set(p.lf, p.yawS, p.ll);
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
const _h = new THREE.Vector3(), _hl = new THREE.Vector3(), _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _ax = new THREE.Vector3();
let lastBounce = 0;
// the dribble clips' events (frames at 30 fps, from the PC's ANIMS.md): R / L = in that hand, F = on the floor
const DSEG = {
  dribble: [[0, 4, 'R', 'R'], [4, 9, 'R', 'F'], [9, 15, 'F', 'R'], [15, 18, 'R', 'R']],
  crossover: [[0, 3, 'R', 'R'], [3, 8, 'R', 'F'], [8, 12, 'F', 'L'], [12, 14, 'L', 'L'], [14, 16, 'L', 'F'], [16, 21, 'F', 'R']],
};
DSEG.dribble_run = DSEG.dribble;
function palm(C, side, out, p) {   // the ball's centre under that palm
  const bone = side === 'L' ? C.bones.LeftHand : C.bones.RightHand; if (!bone) return hand(BL.who, out);
  bone.getWorldPosition(out); return out.add(_v4.set(Math.sin(p.yawS ?? p.yaw) * 0.06, -0.13, Math.cos(p.yawS ?? p.yaw) * 0.06));
}
function floorPt(C, p, from, to, out) {   // where the bounce hits the floor: in front of him, under the hand(s)
  palm(C, 'R', _fa, p); palm(C, 'L', _fb, p);
  const y = p.yawS ?? p.yaw, sy = Math.sin(y), cy = Math.cos(y);
  const k = C.clip === 'crossover' ? 0.5 : 0;   // (the crossover bounces between the feet, a dribble under the right hand)
  out.lerpVectors(_fa, _fb, k); const lx = (out.x - p.x) * cy - (out.z - p.z) * sy;
  return out.set(p.x + lx * cy + sy * 0.3, BALL_R, p.z - lx * sy + cy * 0.3);
}
function ballFromClip(C, p) {
  const len = C.clip === 'crossover' ? 21 : 18, raw = C.time * 30, fr = C.clip === 'crossover' ? Math.min(raw, 20.999) : raw % len, segs = DSEG[C.clip];
  const sg = segs.find((g) => fr >= g[0] && fr < g[1]) || segs[segs.length - 1], u = clamp((fr - sg[0]) / (sg[1] - sg[0]), 0, 1);
  const at = (key, out) => (key === 'F' ? floorPt(C, p, sg[2], sg[3], out) : palm(C, key, out, p));
  const A = at(sg[2], new THREE.Vector3()), B = at(sg[3], new THREE.Vector3());
  const e = sg[3] === 'F' ? u * u : sg[2] === 'F' ? 1 - (1 - u) * (1 - u) : u;
  ball.position.lerpVectors(A, B, e);
  const bounceNow = sg[3] === 'F' ? false : sg[2] === 'F' && u < 0.2;
  if (bounceNow && performance.now() - lastBounce > 180) { lastBounce = performance.now(); sfx.thud && sfx.thud(); }
}
// physics: gravity, the rim (a ring), the backboard, the net's drag, the floor, the fences and the two players
const BP = { v: new THREE.Vector3(), noIn: false, ignore: null, ignT: 0, swished: false, rimT: 0 };
const GRAV = 9.8, BOARD_Z = 0.6;
function launch(from, target, tf, opts = {}) {   // the velocity that reaches the target in tf seconds
  BL.mode = 'phys'; ball.position.copy(from);
  BP.v.set((target.x - from.x) / tf, (target.y - from.y) / tf + 0.5 * GRAV * tf, (target.z - from.z) / tf);
  BP.noIn = !!opts.noIn; BP.ignore = opts.ignore || null; BP.ignT = 0.45; BP.swished = false;
}
function knock(v, opts = {}) { BL.mode = 'phys'; BP.v.copy(v); BP.noIn = true; BP.ignore = opts.ignore || null; BP.ignT = 0.3; BP.swished = false; }
function physBall(ts) {
  const n = Math.max(1, Math.ceil(ts / 0.006)), h = ts / n, p = ball.position, v = BP.v;
  for (let i = 0; i < n; i++) {
    v.y -= GRAV * h; BP.ignT -= h; BP.rimT -= h;
    const rx = p.x - RIM.x, rz = p.z - RIM.z, rr = Math.hypot(rx, rz);
    // the net: a soft funnel under the rim that slows the ball and keeps it inside
    if (!BP.noIn && p.y < RIM.y && p.y > RIM.y - 0.5 && rr < RIM_R + 0.02) {
      v.x *= 1 - 5 * h; v.z *= 1 - 5 * h; v.y = Math.max(v.y, -3.2);
      if (rr > RIM_R - BALL_R * 0.7) { const k = (RIM_R - BALL_R * 0.7) / rr; p.x = RIM.x + rx * k; p.z = RIM.z + rz * k; }
      if (!BP.swished) { BP.swished = true; swish(); }
    }
    const py = p.y; p.addScaledVector(v, h);
    // a "miss" never drops in: the ring is a lid for it (it rattles out)
    if (BP.noIn && rr < RIM_R && py >= RIM.y && p.y < RIM.y + 0.02 && v.y < 0) { p.y = RIM.y + 0.02; v.y = Math.abs(v.y) * 0.5; v.z += 0.8; }
    // the rim: the nearest point of the ring
    const qx = p.x - RIM.x, qz = p.z - RIM.z, qr = Math.hypot(qx, qz);
    if (qr > 1e-4) {
      _ax.set(RIM.x + qx / qr * RIM_R, RIM.y, RIM.z + qz / qr * RIM_R); const dx = p.x - _ax.x, dy = p.y - _ax.y, dz = p.z - _ax.z, d = Math.hypot(dx, dy, dz), R = BALL_R + 0.018;
      if (d < R && d > 1e-5) { const nx = dx / d, ny = dy / d, nz = dz / d; p.set(_ax.x + nx * R, _ax.y + ny * R, _ax.z + nz * R);
        const vn = v.x * nx + v.y * ny + v.z * nz; if (vn < 0) { v.x -= 1.55 * vn * nx; v.y -= 1.55 * vn * ny; v.z -= 1.55 * vn * nz; v.multiplyScalar(0.88); if (BP.rimT <= 0) { BP.rimT = 0.12; sfx.kick && sfx.kick(); SHAKE = Math.max(SHAKE, 0.25); } } }
    }
    // the backboard (its front plane z 0.6, x ±0.75, y 2.35…3.35)
    if (p.z - BALL_R < BOARD_Z && p.z > BOARD_Z - 0.15 && Math.abs(p.x) < 0.75 + BALL_R && p.y > 2.35 - BALL_R && p.y < 3.35 + BALL_R && v.z < 0) { p.z = BOARD_Z + BALL_R; v.z = -v.z * 0.62; v.x *= 0.9; if (BP.rimT <= 0) { BP.rimT = 0.12; sfx.thud && sfx.thud(); } }
    // the floor: bounces lose energy, then it rolls and slows down
    if (p.y < BALL_R) { p.y = BALL_R; if (v.y < 0) { if (-v.y > 1.1) { sfx.thud && sfx.thud(); if (-v.y > 3) dust(p.x, p.z); } v.y = -v.y * 0.7; v.x *= 0.92; v.z *= 0.92; if (v.y < 0.45) v.y = 0; } }
    if (p.y <= BALL_R + 1e-3 && v.y === 0) { const f = Math.exp(-0.9 * h); v.x *= f; v.z *= f; }
    // the fences
    if (Math.abs(p.x) > 8.75) { p.x = Math.sign(p.x) * 8.75; v.x = -v.x * 0.45; }
    if (p.z < -2.35) { p.z = -2.35; v.z = -v.z * 0.45; } if (p.z > 14.3) { p.z = 14.3; v.z = -v.z * 0.45; }
    // the players: upright capsules (not the shooter for a moment after the release)
    for (const k of ['me', 'rob']) {
      const q = P[k]; if (!q || (k === BP.ignore && BP.ignT > 0) || p.y > 1.45) continue;
      const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz), R = 0.3 + BALL_R;
      if (d < R && d > 1e-4) { const nx = dx / d, nz = dz / d; p.x = q.x + nx * R; p.z = q.z + nz * R; const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= 1.5 * vn * nx; v.z -= 1.5 * vn * nz; } }
    }
  }
  // it spins the way it rolls / flies
  const sp = Math.hypot(v.x, v.z); if (sp > 0.02) { _ax.set(v.z, 0, -v.x).normalize(); ball.rotateOnWorldAxis(_ax, sp / BALL_R * ts * (p.y <= BALL_R + 1e-3 ? 1 : 0.35)); }
}
// someone runs to the loose ball and picks it up (it can still bounce and roll away from him)
async function fetchBall(who, maxT = 3) {
  const q = P[who]; q.fast = true; let t = 0;
  while (G.on && t < maxT) {
    q.tx = clamp(ball.position.x, -8, 8); q.tz = clamp(ball.position.z + 0.25, -1.5, 13.5);
    const d = Math.hypot(ball.position.x - q.x, ball.position.z - q.z);
    if (d < 0.55 && ball.position.y < 1.2) break;
    await wait(0.05); t += 0.05;
  }
  q.fast = false; BL.mode = 'dribble'; BL.who = who;
}
function updateBall(dt, t, ts) {
  if (!ball) return;
  if (BL.mode === 'dribble' || BL.mode === 'hold') {
    const p = P[BL.who], C = p.ch, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);   // (his front)
    if (C && C.isAnim && BL.mode === 'dribble' && DSEG[C.clip]) { ballFromClip(C, p); return; }
    if (C && C.isAnim && BL.mode === 'hold') { if (/ready|catch|idle/.test(C.clip)) { palm(C, 'R', _fa, p); palm(C, 'L', _fb, p); ball.position.lerpVectors(_fa, _fb, 0.5).add(_v4.set(fx * 0.1, 0.06, fz * 0.1)); } else palm(C, 'R', ball.position, p); return; }
    hand(BL.who, _h);
    if (BL.mode === 'hold') { ball.position.copy(_h).add(_v4.set(fx * 0.12, -0.05, fz * 0.12)); return; }
    const ph = (t * 9 / (Math.PI * 2)) % 1, b = Math.abs(Math.cos(Math.PI * ph));
    ball.position.set(_h.x + fx * 0.1, lerp(BALL_R, Math.max(BALL_R, _h.y - 0.1), b), _h.z + fz * 0.1);
    if (b < 0.08 && t - lastBounce > 0.3 && ts / Math.max(dt, 1e-4) > 0.5) { lastBounce = t; sfx.thud && sfx.thud(); }
    ball.rotation.x += ts * 6;
    return;
  }
  if (BL.mode === 'phys') { physBall(ts); return; }
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
  if (!ball || !(BL.mode === 'fly' || (BL.mode === 'phys' && ball.position.y > 1.0))) { trail.visible = false; _tp.copy(ball ? ball.position : _tp); return; }
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
function swishSlow() { SLOWMO = 0.6; CROWD.cheer = 0.6; }
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
  shot('play', { k: 7 });
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
function setPlay(meAct, robAct) { if (meAct) { P.me.act = meAct; P.me.u = 0; P.me.force = true; } if (robAct) { P.rob.act = robAct; P.rob.u = 0; P.rob.force = true; } }
const relMe = () => (P.me.ch && P.me.ch.isAnim ? 0.7 : 0.48), relRob = () => (P.rob.ch && P.rob.ch.isAnim ? 0.7 : 0.4);
async function attack() {
  // Foxino at the top with the ball, Rob guarding him
  Object.assign(P.me, { tx: rand(-0.6, 0.6), tz: TOP_Z, yaw: Math.PI, fast: false }); Object.assign(P.rob, { tx: P.me.tx * 0.6 - 0.55, tz: DEF_Z, yaw: 0 }); setPlay('dribble', 'stance'); CAMV.side = 0.6;
  BL.mode = 'dribble'; BL.who = 'me';
  const side = Math.random() < 0.5 ? -1 : 1;
  shot('low', { who: 'me', s: -side, cut: true });
  await wait(1.1); if (!G.on) return;
  const r1 = await ask(ME, 'beat Rob: tap the right word!', [[-1.45, 2.4, 5.5], [0, 2.95, 5.2], [1.45, 2.4, 5.5]]);
  if (!G.on) return;
  if (!r1.ok) {   // Rob pokes the ball away
    shot('side', { who: 'rob', s: side, cut: true }); SLOWMO = 0.5;
    setPlay(null, 'steal'); P.rob.tz = P.me.z - 0.6; await wait(0.3); knock(new THREE.Vector3(rand(-1.2, 1.2), 1.6, -2.2), { ignore: 'me' }); setPlay('stumble'); banner('STOLEN!', 'Rob has the ball'); sfx.aww && sfx.aww(); shot('face', { who: 'rob', a0: 0.4, speed: 0.25, r: 2.8, y: 1.3 });
    await fetchBall('rob', 1.6); setPlay(null, 'dribble'); await wait(0.6); return 'rob';
  }
  // the crossover and the drive past him
  shot('side', { who: 'me', s: side, cut: true }); SLOWMO = 0.55; SHAKE = Math.max(SHAKE, 0.35);
  setPlay('cross', 'stumble'); P.me.dur = 0.55; await wait(0.55);
  shot('chase', { who: 'me', k: 2.6 });
  Object.assign(P.me, { tx: side * 1.3, tz: 2.6, fast: true }); setPlay('dribble'); P.rob.tx = -side * 0.8; P.rob.tz = DEF_Z + 0.4; await wait(1.0); if (!G.on) return;
  const r2 = await ask(ME, 'shoot! tap the right word', [[-1.6, 3.0, 2.6], [0, 3.55, 2.3], [1.6, 3.0, 2.6]]);
  if (!G.on) return;
  shot('ball', { s: -side, cut: true });
  BL.mode = 'hold'; setPlay('shoot'); P.me.dur = 0.9; await wait(relMe()); setTimeout(() => dust(P.me.x, P.me.z), 450);
  const from = ball.position.clone();
  if (r2.ok) {   // swish: the physics ball through the middle of the ring, slowed by the net, bouncing under the hoop
    launch(from, RIM.clone().add(_v4.set(0, 0, -0.03)), 0.85, { ignore: 'me' });
    await wait(0.62); shot('net', { s: side, cut: true }); celebrate(true); SLOWMO = 0.75;
    await wait(0.6); G.score[0]++; score(); banner('SCORE!', `${G.score[0]} : ${G.score[1]}`); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); setPlay('cheer'); BURST.emit(RIM.clone(), 50, '#ffd84a', 6, 0.18); vib([30, 40, 60]);
    shot('face', { who: 'me', a0: 0.6 * side, speed: 0.45, cut: true });
    await wait(1.9); return 'rob';
  }
  // off the front of the rim and out: Rob takes the rebound
  launch(from, RIM.clone().add(_v4.set(rand(-0.07, 0.07), 0.04, RIM_R + 0.03)), 0.8, { noIn: true, ignore: 'me' });   // (onto the front of the rim: it bounces out)
  await wait(0.9); shot('low', { who: 'rob', s: side, k: 2.6 }); banner('NO GOOD!', 'Rob gets the rebound'); setPlay('sad');
  await fetchBall('rob', 3); setPlay(null, 'dribble'); await wait(0.9);
  return 'rob';
}
async function defence() {
  // Rob at the top with the ball, Foxino guarding (he faces Rob)
  Object.assign(P.rob, { tx: rand(-0.5, 0.5), tz: TOP_Z, yaw: Math.PI }); Object.assign(P.me, { tx: P.rob.tx * 0.6 + 0.5, tz: DEF_Z, yaw: 0, fast: false }); setPlay('stance', 'dribble'); CAMV.side = 2.4;   // (the camera steps to the side: Rob is between it and Foxino)
  BL.mode = 'dribble'; BL.who = 'rob';
  shot('face', { who: 'rob', a0: -0.5, speed: 0.22, y: 0.7, ly: 1.1, roll: 0.1, cut: true });
  await wait(1.1); if (!G.on) return;
  const lane = Math.floor(Math.random() * 3);
  const r1 = await ask(DEF, 'where will Rob go? the right word is his lane', LANES.map((x) => [x * 1.38, 2.35, DEF_Z - 0.6]), 10, lane);
  if (!G.on) return;
  const pick = r1.k >= 0 ? r1.k : 1;
  Object.assign(P.me, { tx: LANES[pick], fast: true });
  if (r1.ok) {   // Foxino is in his lane: the steal
    shot('side', { who: 'me', s: LANES[lane] >= 0 ? 1 : -1, cut: true }); SLOWMO = 0.5;
    P.rob.tx = LANES[lane]; P.rob.tz = DEF_Z + 0.7; await wait(0.45); setPlay('steal'); P.me.dur = 0.6; await wait(0.27); SHAKE = Math.max(SHAKE, 0.5);
    knock(new THREE.Vector3(rand(-0.8, 0.8), 1.5, -1.6), { ignore: 'rob' }); setPlay(null, 'stumble'); banner('STEAL!', 'your ball'); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); shot('face', { who: 'me', a0: 0.4, speed: 0.25, r: 2.8, y: 1.3 });
    await fetchBall('me', 1.6); setPlay('dribble'); await wait(0.6); return 'me';
  }
  // Rob drives past into the lane
  shot('side', { who: 'rob', s: LANES[lane] >= 0 ? -1 : 1, cut: true }); SLOWMO = 0.4;
  Object.assign(P.rob, { tx: LANES[lane] * 0.9, tz: 2.3 }); setPlay('stumble', 'dribble'); await wait(1.0); if (!G.on) return;
  P.me.tx = LANES[lane] * 0.6; P.me.tz = 3.0;
  const QUICK = 4.5;   // (seconds: right AND this fast = the block)
  const r2 = await ask({ t: 'BLOCK IT!', c: '#e8403a' }, 'right AND fast!', [[-1.6, 3.0, 2.8], [0, 3.55, 2.5], [1.6, 3.0, 2.8]], 7);
  if (!G.on) return;
  P.rob.yaw = Math.PI; BL.mode = 'hold'; setPlay(null, 'shoot'); P.rob.dur = 0.9;
  const blocked = r2.ok && r2.ms < QUICK * 1000;
  if (blocked) { shot('block', { who: 'me', s: P.me.x >= 0 ? 1 : -1, cut: true }); SLOWMO = 0.8; setPlay('block'); P.me.dur = 0.9; P.me.tx = P.rob.x * 0.7; P.me.tz = P.rob.z - 0.75; }
  await wait(blocked ? 0.5 : relRob());
  if (!blocked) shot('ball', { s: P.rob.x >= 0 ? 1 : -1, cut: true });
  const from = ball.position.clone();
  if (r2.ok && r2.ms < QUICK * 1000) {   // the block
    SHAKE = Math.max(SHAKE, 0.7); setTimeout(() => dust(P.me.x, P.me.z), 650); sfx.kick && sfx.kick(); vib(40);
    knock(new THREE.Vector3(rand(-2.2, 2.2), 2.4, 3.6), { ignore: 'me' });   // (swatted away, out toward the camera)
    banner('BLOCKED!', 'your ball'); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); BURST.emit(from, 40, '#6fe2ff', 6, 0.18); setPlay(null, 'stumble');
    await wait(0.8); await fetchBall('me', 3); setPlay('dribble'); await wait(0.5); return 'me';
  }
  if (r2.ok) banner('TOO LATE!', 'jump faster next time');
  const make = Math.random() > 0.33;
  if (make) {
    launch(from, RIM.clone().add(_v4.set(0, 0, -0.03)), 0.85, { ignore: 'rob' });
    await wait(0.62); shot('net', { s: -1, cut: true }); swishSlow();
    await wait(0.6); G.score[1]++; score(); banner('ROB SCORES', `${G.score[0]} : ${G.score[1]}`); sfx.aww && sfx.aww(); setPlay('sad', 'cheer');
    shot('face', { who: 'rob', a0: 0.4, speed: 0.4, cut: true }); await wait(1.8); return 'me';
  }
  launch(from, RIM.clone().add(_v4.set(rand(-0.07, 0.07), 0.04, RIM_R + 0.03)), 0.8, { noIn: true, ignore: 'rob' });
  await wait(0.9); banner('ROB MISSED!', 'your ball'); shot('low', { who: 'me', s: 1, k: 2.6 });
  await fetchBall('me', 3); setPlay('dribble'); await wait(0.6); return 'me';
}
async function match() {
  Object.assign(G, { on: true, score: [0, 0], asked: 0, right: 0, missed: [] }); combo = 0; renderCombo(); score(); $('score').classList.remove('hidden');
  $('start').classList.add('hidden'); $('end').classList.add('hidden');
  sfx.whistle && sfx.whistle(); banner('1 ON 1', `first to ${WIN} baskets`);
  shot('face', { who: 'me', a0: -0.9, speed: 0.7, r: 2.6, cut: true }); BL.mode = 'dribble'; BL.who = 'me'; setPlay('dribble', 'stance'); await wait(1.6); if (!G.on) return;
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
  $('end').classList.remove('hidden'); setPlay(won ? 'dance' : 'sad', won ? 'sad' : 'dance');
  shot('face', { who: won ? 'me' : 'rob', a0: 0, speed: 0.3, r: 2.8, y: 1.4, cut: true });
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
  if (a < 0.8) { BASEFOV = 58; CAMV.pos.set(0, 4.7, 12.6); CAMV.look.set(0, 1.85, 2.6); }
  else if (a < 1.3) { BASEFOV = 54; CAMV.pos.set(0, 4.6, 13.4); CAMV.look.set(0, 1.75, 2.8); }
  else { BASEFOV = 46; CAMV.pos.set(0, 4.4, 14.8); CAMV.look.set(0, 1.5, 3.0); }
  if (!DIR.init) camera.fov = BASEFOV;
  camera.updateProjectionMatrix();
}
/* ---------- the camera director (2026-11-17, the user: "make the camera action: it moves close up with the player,
   sometimes tilts, and some things") ----------
   The questions always use the steady game view ('play': the bubbles must be easy to tap). Between them the plays cut or
   glide to TV-style shots: low close-ups beside the player, a chase behind the drive, the ball's flight from under the
   hoop, the net from below, a slow orbit round the player who scores, a worm's-eye block — with a dutch tilt (roll),
   a little zoom and a hand-held wobble. The camera never leaves the court (inside the fences). */
let BASEFOV = 58;
const DIR = { shot: 'play', o: {}, t: 0, k: 3, cut: true, init: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), cp: new THREE.Vector3(), cl: new THREE.Vector3(), roll: 0, r: 0, fov: 1 };
function shot(name, o = {}) { DIR.avS = null; DIR.shot = name; DIR.o = o; DIR.t = 0; DIR.k = o.k ?? (name === 'play' ? 5 : 3.4); if (o.cut) DIR.cut = true; }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function aimShot(dt) {
  const o = DIR.o, t = DIR.t, wob = (f, a) => Math.sin(T * f) * a;
  const who = P[o.who || 'me'] || P.me, px = who ? who.x : 0, pz = who ? who.z : 6, sd = o.s || 1;
  let roll = 0, fov = 1;
  switch (DIR.shot) {
    case 'side':     // low beside the player, a bit in front, tilted: the crossover, the drive past, the steal
      DIR.pos.set(px + sd * 2.3, 1.05 + wob(1.3, 0.03), pz + 1.3 - t * 0.25); DIR.look.set(px - sd * 0.25, 0.95, pz - 0.7); roll = -sd * 0.11; fov = 0.86; break;
    case 'low': {    // a worm's-eye close-up from his front-side, up at the player
      const y0 = who ? (who.yawS ?? who.yaw) : 0, fx = Math.sin(y0), fz = Math.cos(y0), rx = Math.cos(y0), rz = -Math.sin(y0);
      DIR.pos.set(px + fx * 1.25 + rx * sd * 1.45, 0.42, pz + fz * 1.25 + rz * sd * 1.45); DIR.look.set(px, 1.05, pz); roll = sd * 0.12 + wob(0.9, 0.02); fov = 0.9; break; }
    case 'chase':    // behind and above the shoulder, chasing the drive to the hoop
      DIR.pos.set(px + 0.35, 1.65 + wob(5, 0.02), pz + 2.5); DIR.look.set(px * 0.5, 1.7, pz - 3); roll = wob(1.7, 0.035); fov = 0.95; break;
    case 'ball':     // from low under the hoop, following the ball in the air
      DIR.pos.set(sd * 1.7, 0.75, 3.9); DIR.look.copy(ball ? ball.position : RIM); roll = sd * 0.12; fov = 0.92; break;
    case 'net':      // the net from just below and to the side
      DIR.pos.set(RIM.x + sd * 1.05, RIM.y - 0.6, RIM.z + 1.55); DIR.look.set(RIM.x, RIM.y - 0.15, RIM.z); roll = -sd * 0.15; fov = 0.78; break;
    case 'face': {   // in front of the player, orbiting slowly (scores, the match end, the start of a possession)
      const base = (who ? who.yaw : 0) + (o.a0 || 0.5);
      if (o.dirS == null) { const oth = P[(o.who || 'me') === 'rob' ? 'me' : 'rob']; let sg = 1; if (oth && who) { const ao = Math.atan2(oth.x - px, oth.z - pz); sg = Math.sign(Math.atan2(Math.sin(base - ao), Math.cos(base - ao))) || 1; } o.dirS = sg; }   // (it orbits away from the other player)
      const a0 = base + o.dirS * t * Math.abs(o.speed ?? 0.35), r = o.r || 2.2;
      DIR.pos.set(px + Math.sin(a0) * r, (o.y ?? 1.15) + wob(0.8, 0.04), pz + Math.cos(a0) * r); DIR.look.set(px, o.ly ?? 0.9, pz); roll = (o.roll ?? 0.07) * Math.sin(t * 0.7); fov = 0.8; break; }
    case 'block':    // a worm's-eye from behind the defender up at the block
      DIR.pos.set(px + sd * 1.3, 0.42, pz + 2.3); DIR.look.set(px, 2.1, pz - 0.6); roll = sd * 0.17; fov = 0.95; break;
    default: {       // 'play': the steady game view (the questions)
      const sh = SHAKE * SHAKE * 0.3;
      CAMV.p = damp(CAMV.p, CAMV.punch, 4, dt); CAMV.punch = Math.max(0, CAMV.punch - dt * 0.7); const pk = smooth(CAMV.p) * 0.28;
      DIR.pos.set(lerp(CAMV.pos.x + CAMV.x * 0.5 + CAMV.s, RIM.x, pk) + (Math.random() - 0.5) * sh, lerp(CAMV.pos.y, RIM.y + 0.6, pk) + (Math.random() - 0.5) * sh, lerp(CAMV.pos.z, RIM.z + 4, pk));
      DIR.look.set(lerp(CAMV.look.x + CAMV.x * 0.35, RIM.x, pk * 2), lerp(CAMV.look.y, RIM.y, pk * 2), lerp(CAMV.look.z, RIM.z, pk * 2));
    }
  }
  if (DIR.shot !== 'play' && SHAKE > 0) { const sh = SHAKE * SHAKE * 0.25; DIR.pos.x += (Math.random() - 0.5) * sh; DIR.pos.y += (Math.random() - 0.5) * sh; }
  if (DIR.shot !== 'play') avoidPlayers(DIR.pos, o.who || 'me');
  // inside the fences, above the floor
  DIR.pos.x = clamp(DIR.pos.x, -8.3, 8.3); DIR.pos.z = clamp(DIR.pos.z, -1.3, 15.5); DIR.pos.y = Math.max(0.3, DIR.pos.y);
  DIR.roll = roll; DIR.fov = fov;
}
// the camera never goes into a player: pushed out sideways (more room for the one it films)
function avoidPlayers(v, subject) {
  if (v.y > 2.2) return;
  // the other player must not stand between the camera and the one it films: swing round him (always to the same side in one shot)
  const sj = P[subject], ot = P[subject === 'me' ? 'rob' : 'me'];
  if (sj && ot && DIR.shot !== 'ball' && DIR.shot !== 'net') {
    const cx = v.x - sj.x, cz = v.z - sj.z, dc = Math.hypot(cx, cz), ox = ot.x - sj.x, oz = ot.z - sj.z, dO = Math.hypot(ox, oz);
    if (dO > 0.05 && dO < dc + 0.4) {
      const ac = Math.atan2(cx, cz), ao = Math.atan2(ox, oz), m = Math.atan2(0.75, dO) + 0.15, df = Math.atan2(Math.sin(ac - ao), Math.cos(ac - ao));
      if (Math.abs(df) < m) { if (DIR.avS == null) DIR.avS = df >= 0 ? 1 : -1; const a = ao + DIR.avS * m; v.x = sj.x + Math.sin(a) * dc; v.z = sj.z + Math.cos(a) * dc; }
    }
  }
  for (const k of ['me', 'rob']) { const q = P[k]; if (!q) continue; const dx = v.x - q.x, dz = v.z - q.z, d = Math.hypot(dx, dz), min = k === subject ? 1.5 : 1.0;
    if (d < min) { if (d < 1e-3) { v.z += min; continue; } v.x = q.x + dx / d * min; v.z = q.z + dz / d * min; } }
}
function placeCamera(dt) {
  const fx = P.me ? clamp((P.me.x + (P.rob ? P.rob.x : 0)) / 2, -3, 3) : 0; CAMV.x = damp(CAMV.x, fx, 2, dt);
  CAMV.s = damp(CAMV.s, CAMV.side, 1.6, dt);
  SHAKE = Math.max(0, SHAKE - dt * 1.6);
  DIR.t += dt; aimShot(dt);
  if (DIR.cut || !DIR.init) { DIR.cp.copy(DIR.pos); DIR.cl.copy(DIR.look); DIR.r = DIR.roll; DIR.cut = false; DIR.init = true; }
  else { const k = 1 - Math.exp(-DIR.k * dt); DIR.cp.lerp(DIR.pos, k); DIR.cl.lerp(DIR.look, Math.min(1, k * 1.6)); DIR.r = damp(DIR.r, DIR.roll, 4, dt); }
  if (DIR.shot !== 'play') avoidPlayers(DIR.cp, DIR.o.who || 'me');
  camera.position.copy(DIR.cp); camera.lookAt(DIR.cl); if (Math.abs(DIR.r) > 1e-4) camera.rotateZ(DIR.r);
  const f = damp(camera.fov, BASEFOV * DIR.fov, 3.5, dt); if (Math.abs(f - camera.fov) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
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
  updatePlayers(dt, GT, ts); updateBall(dt, GT, ts); updateBubbles(dt, T); updateNet(dt); updateCrowd(T, dt); updateExtras(dt); BURST.update(dt); updateTrail(); placeCamera(dt);
  if (XM.snow) XM.snow.update(T, camera, pr); for (const l of XM.lights) l.update(T);
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
  window.SB = { G, P, BL, answer, get ask() { return G.ask; }, renderer, scene, camera, POSTFX, models: () => Object.keys(SB) };
})();
