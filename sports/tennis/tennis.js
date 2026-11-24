// Foxino Tennis (Foxino Sports). One 3D court for two uses:
//  · solo (a phone, the Student library): Foxino against Rob the robot. When the ball comes, three word bubbles float on
//    Foxino's side; tap the right word and he hits the ball through that bubble; a wrong word goes into the net. Rob misses
//    some of his shots (more after a fast answer). Tennis scoring: 15, 30, 40, game.
//  · ?remote=1 (inside the teacher's screen): two students on their phones; the teacher's page sends {ft: 'match' | 'ask' |
//    'hit' | 'point' | 'end' | 'idle'} and this court only plays what it is told.
import * as THREE from '/penalty/lib/three.module.min.js';
import { GLTFLoader } from '/penalty/lib/GLTFLoader.js';
import { MeshoptDecoder } from '/adventures/lib/meshopt_decoder.module.js';
import { loadFoxino } from '/penalty/foxino-glb.js?v=3';
import { POSES } from '/penalty/foxino.js';
import { makeRob, RPOSES } from '/penalty/rob.js';
import { makeBubble } from '/penalty/props.js';
import { sfx, unlock, isMuted, setMuted } from '/penalty/sound.js';
import { paintedSky, makePost } from '../look.js?v=1';
import { makeSnowfall, snowCover, stringLights, loadXmasKit, placeKit } from '../xmas.js?v=1';   // (2026-11-24, the user: snow and a Christmas atmosphere in every sport)

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const REMOTE = /[?&]remote=1/.test(location.search), RSLOT = +(new URLSearchParams(location.search).get('slot') || 0);
if (REMOTE) document.body.classList.add('remote');
// (2026-11-17) ?list=1: a sport picked in the Foxino Sports lobby: it starts at once (against Rob, or ?friend=host|join&room=…
// &name=… against the party friend) and tells the lobby the result at the end ({ft: 'finished', won, games})
const LIST = /[?&]list=1/.test(location.search), LP = new URLSearchParams(location.search);
if (LIST) document.body.classList.add('list');
const post = (m) => { if (REMOTE && window.parent !== window) window.parent.postMessage(Object.assign({ slot: RSLOT }, m), '*'); };
const TINTS = [0xff6fb5, 0xffcd1c, 0x48d8ff], CSS_TINTS = ['#ff8fc4', '#ffd84a', '#6fe2ff'];
const HALF_L = 11.885, HALF_W = 5.485, SINGLE_W = 4.115;
const BUB_X = [-2.9, 0, 2.9], TX = [-3.2, 0, 3.2];

// ---------- renderer, scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pr);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x7f88c2, 55, 180);
const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 600);
// (2026-11-17, the user: "increase the graphics of the environment based on how you've worked with Adventures") the
// Foxino Adventures look: the hand-painted sky, the fog in its haze, a warm sun with soft shadows, the post pass (../look.js)
const sky = paintedSky(scene, '/sports/snow/sky/alpine-night.webp?v=1', { envRenderer: renderer, yaw: 0.35, onFog: (c) => scene.fog.color.set(0x7f88c2) });   // (Christmas: a deep blue winter evening with a soft aurora; a cool blue haze, not the picture's pink base)
{ const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0xa8d8ea, side: THREE.BackSide }))); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }
scene.add(new THREE.HemisphereLight(0xe9ecff, 0xb4bde0, 1.15));   // (a cool winter sky, the snow bouncing light back up)
const sun = new THREE.DirectionalLight(0xffc68e, 1.55);   // (a low, warm evening sun)
sun.position.set(-16, 18, -12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 24, bottom: -24, near: 1, far: 90 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun);
const POSTFX = makePost(renderer, { aoRange: 80, focusMul: 1.3, blur: 0.5, grade: { sat: 1.07 } });

// ---------- the court ----------
function courtTexture() {
  const W = 1024, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sx = W / 20, sz = H / 38;   // the texture covers 20 m × 38 m
  g.fillStyle = '#e8eefa'; g.fillRect(0, 0, W, H);   // (Christmas: snow round the court; the court itself is swept clean)
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '170,185,225' : '255,255,255'},${Math.random() * 0.25})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 7, 0, 6.3); g.fill(); }
  g.fillStyle = '#2f6fc4'; g.fillRect(W / 2 - 8.5 * sx, H / 2 - 17 * sz, 17 * sx, 34 * sz);
  // (2026-11-17) worn patches where the players run, a lighter sheen along the middle
  const wear = (x, z, rx, rz, a) => { const gr = g.createRadialGradient(W / 2 + x * sx, H / 2 + z * sz, 0, W / 2 + x * sx, H / 2 + z * sz, rx * sx); gr.addColorStop(0, `rgba(170,205,240,${a})`); gr.addColorStop(1, 'rgba(170,205,240,0)'); g.save(); g.translate(W / 2 + x * sx, H / 2 + z * sz); g.scale(1, rz / rx); g.translate(-(W / 2 + x * sx), -(H / 2 + z * sz)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); };
  for (const zz of [-12.6, 12.6]) { wear(0, zz, 4.5, 1.6, 0.22); wear(-1.5, zz, 2.2, 1.0, 0.12); wear(1.5, zz, 2.2, 1.0, 0.12); }
  for (const zz of [-6.4, 6.4]) wear(0, zz, 1.8, 1.2, 0.1);
  { const gr = g.createLinearGradient(W / 2 - 5 * sx, 0, W / 2 + 5 * sx, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  // a soft grain
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.06 * sx;
  const X = (x) => W / 2 + x * sx, Z = (z) => H / 2 + z * sz;
  const line = (x0, z0, x1, z1) => { g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  g.strokeRect(X(-HALF_W), Z(-HALF_L), 2 * HALF_W * sx, 2 * HALF_L * sz);
  line(-SINGLE_W, -HALF_L, -SINGLE_W, HALF_L); line(SINGLE_W, -HALF_L, SINGLE_W, HALF_L);
  line(-SINGLE_W, -6.4, SINGLE_W, -6.4); line(-SINGLE_W, 6.4, SINGLE_W, 6.4); line(0, -6.4, 0, 6.4);
  line(0, -HALF_L, 0, -HALF_L + 0.2); line(0, HALF_L, 0, HALF_L - 0.2);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.font = `${2.2 * sx}px "Lilita One", sans-serif`; g.textAlign = 'center';
  g.save(); g.translate(X(0), Z(9.2)); g.fillText('FOXINO', 0, 0); g.restore();
  g.save(); g.translate(X(0), Z(-9.2)); g.rotate(Math.PI); g.fillText('FOXINO', 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const world = new THREE.Group(); scene.add(world);
function buildCourt() {
  const gc = document.createElement('canvas'); gc.width = 64; gc.height = 64; const gg = gc.getContext('2d');
  gg.fillStyle = '#eef2fb'; gg.fillRect(0, 0, 64, 64); gg.fillStyle = '#e2e8f7'; gg.fillRect(0, 0, 64, 32);   // (Christmas: snow, with soft blue shading and a little sparkle)
  for (let i = 0; i < 400; i++) { gg.fillStyle = `rgba(${Math.random() < 0.6 ? '160,175,220' : '255,255,255'},${Math.random() * 0.16})`; gg.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  const gtx = new THREE.CanvasTexture(gc); gtx.colorSpace = THREE.SRGBColorSpace; gtx.wrapS = gtx.wrapT = THREE.RepeatWrapping; gtx.repeat.set(1, 55); gtx.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: gtx, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; ground.userData.noSnow = true; world.add(ground);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(20, 38), new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.6, envMapIntensity: 0.6 }));
  court.rotation.x = -Math.PI / 2; court.receiveShadow = true; court.userData.noSnow = true; world.add(court);
  // the net: posts, a mesh with a white tape, a little sag in the middle
  const post = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.5, metalness: 0.4 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 10), post); p.position.set(s * 6.4, 0.55, 0); p.castShadow = true; world.add(p); }
  const nc = document.createElement('canvas'); nc.width = 512; nc.height = 64; const ng = nc.getContext('2d');
  ng.strokeStyle = 'rgba(20,20,30,0.85)'; ng.lineWidth = 1.4; for (let x = 0; x <= 512; x += 6) { ng.beginPath(); ng.moveTo(x, 0); ng.lineTo(x, 64); ng.stroke(); } for (let y = 0; y <= 64; y += 6) { ng.beginPath(); ng.moveTo(0, y); ng.lineTo(512, y); ng.stroke(); }
  const nt = new THREE.CanvasTexture(nc); nt.wrapS = THREE.RepeatWrapping; nt.repeat.set(3, 1);
  const netG = new THREE.PlaneGeometry(12.8, 0.92, 32, 2), np = netG.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i), y = np.getY(i); const sag = 0.08 * (1 - (x / 6.4) ** 2); np.setY(i, y + 0.46 + (y > 0 ? 0.12 * (x / 6.4) ** 2 - sag * 0.6 : 0)); }
  const net = new THREE.Mesh(netG, new THREE.MeshStandardMaterial({ map: nt, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.8 })); net.castShadow = true; world.add(net);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); tape.position.y = 0.93; world.add(tape);
  // the fences and the boards around the court
  const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 64; const bg = bc.getContext('2d');
  const words = ['FOXINO SPORTS', 'fugio.co', 'GUMMY', 'FOXINO SPORTS', 'ROB'];
  bg.fillStyle = '#b3202e'; bg.fillRect(0, 0, 1024, 64); bg.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 40; i++) { bg.beginPath(); bg.arc(Math.random() * 1024, Math.random() * 64, 1.5 + Math.random() * 2.5, 0, 6.3); bg.fill(); } bg.font = '400 40px "Lilita One", sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle';
  words.forEach((w, i) => { bg.fillStyle = i % 2 ? '#ffe08a' : '#ffffff'; bg.fillText(w, 102 + i * 205, 34); });
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.wrapS = THREE.RepeatWrapping;
  const boardM = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 });
  const fc = document.createElement('canvas'); fc.width = 128; fc.height = 128; const fg = fc.getContext('2d'); fg.strokeStyle = 'rgba(30,60,40,0.9)'; fg.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) { fg.beginPath(); fg.moveTo(i, 0); fg.lineTo(i + 128, 128); fg.stroke(); fg.beginPath(); fg.moveTo(i + 128, 0); fg.lineTo(i, 128); fg.stroke(); }
  const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  const fenceM = (w) => { const t = ft.clone(); t.needsUpdate = true; t.repeat.set(w / 1.2, 3.2 / 1.2); return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9, color: 0x2e5a3c }); };
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(20, 3.2), fenceM(20)); f.position.set(0, 1.6 + 0.9, s * 19); world.add(f);
    const b = new THREE.Mesh(new THREE.BoxGeometry(20, 0.9, 0.12), boardM); b.position.set(0, 0.45, s * 18.9); b.castShadow = true; world.add(b);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 38), boardM); sb.position.set(s * 10.1, 0.45, 0); world.add(sb);
  }
  // the stands with a crowd on both sides
  const standM = new THREE.MeshStandardMaterial({ color: 0xe9e4f5, roughness: 0.8 }), standM2 = new THREE.MeshStandardMaterial({ color: 0x8f52d9, roughness: 0.7 });
  const seats = [];
  for (const s of [-1, 1]) for (let r = 0; r < 5; r++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5 + r * 0.6, 34), r % 2 ? standM2 : standM); st.position.set(s * (11.6 + r * 1.4), (0.5 + r * 0.6) / 2, 0); st.receiveShadow = true; world.add(st);
    for (let z = -16; z <= 16; z += 1.05) if (Math.random() < 0.75) seats.push({ x: s * (11.6 + r * 1.4), y: 0.5 + r * 0.6, z: z + rand(-0.15, 0.15), s, ph: Math.random() * 6 });
  }
  // (2026-11-17) behind Rob: a small stand with fans
  for (let r = 0; r < 4; r++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6 + r * 0.7, 1.4), r % 2 ? standM2 : standM); st.position.set(0, (0.6 + r * 0.7) / 2, -(22.2 + r * 1.4)); world.add(st);
    for (let x = -10.2; x <= 10.2; x += 1.0) if (Math.random() < 0.8) seats.push({ x: x + rand(-0.15, 0.15), y: 0.6 + r * 0.7, z: -(22.2 + r * 1.4), s: 0, ph: Math.random() * 6 });
  }
  CROWD.seats = seats;
  const bodyG = new THREE.BoxGeometry(0.38, 0.52, 0.3), headG = new THREE.IcosahedronGeometry(0.18, 0);
  CROWD.body = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), seats.length);
  CROWD.head = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), seats.length);
  const cols = ['#ff5d8f', '#ffb703', '#3ab0ff', '#2fbf6a', '#8f52d9', '#ff7d22', '#ffffff', '#e8403a', '#5a6bff'], skin = ['#f2c9a0', '#d9a074', '#9c6a44', '#ffd9b8', '#c68642'];
  seats.forEach((q, i) => { CROWD.body.setColorAt(i, new THREE.Color(cols[i % cols.length])); CROWD.head.setColorAt(i, new THREE.Color(skin[(i * 7) % skin.length])); });
  CROWD.hat = new THREE.InstancedMesh(new THREE.ConeGeometry(0.15, 0.32, 6).translate(0, 0.16, 0), new THREE.MeshStandardMaterial({ color: 0xd42a35, roughness: 0.7 }), seats.length);   // (Christmas: Santa hats on a third of the fans)
  CROWD.body.userData.noSnow = CROWD.head.userData.noSnow = CROWD.hat.userData.noSnow = true;
  world.add(CROWD.body, CROWD.head, CROWD.hat);
  // roofs over the stands (purple with a white edge, on posts) and a row of flags along each roof
  const roofM = new THREE.MeshStandardMaterial({ color: 0x6a34c4, roughness: 0.6 }), trimM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), poleM = new THREE.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.5, metalness: 0.4 });
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.25, 36), roofM); roof.position.set(s * 15.4, 6.6, 0); roof.rotation.z = s * 0.16; world.add(roof);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 36.2), trimM); edge.position.set(s * 11.3, 6.0, 0); world.add(edge);
    for (let z = -16; z <= 16; z += 8) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6.6, 8), poleM); po.position.set(s * 19.2, 3.3, z); world.add(po); }
    for (let z = -15; z <= 15; z += 6) { const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5), poleM); fp.position.set(s * 13.2, 8.0, z); world.add(fp);
      const fg = new THREE.PlaneGeometry(1.1, 0.65, 8, 2); fg.translate(0.55, 0, 0);
      const fl = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: ['#ffcd1c', '#ff5d8f', '#48d8ff', '#66e08a', '#ff7d22', '#ffffff'][(z + 15) / 6 | 0], roughness: 0.7, side: THREE.DoubleSide }));
      fl.position.set(s * 13.2, 8.75, z); fl.rotation.y = s > 0 ? Math.PI : 0; fl.userData.base = fg.attributes.position.array.slice(); world.add(fl); FLAGS.push(fl); }
  }
  // floodlights in the four corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * 12.2, 0, sz * 20.2);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 12, 8), poleM); pole.position.y = 6; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.35), poleM); head.position.set(0, 12.3, 0); g.add(head);
    const lamps = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1), new THREE.MeshBasicMaterial({ color: 0xfff6d6 })); lamps.position.set(0, 12.3, 0.19); g.add(lamps);
    head.rotation.x = lamps.rotation.x = 0.35; g.rotation.y = Math.atan2(-g.position.x, -g.position.z);
    world.add(g);
  }
  // (2026-11-17) the big score screen behind Rob's end
  const sbc = document.createElement('canvas'); sbc.width = 1024; sbc.height = 320;
  const sbt = new THREE.CanvasTexture(sbc); sbt.colorSpace = THREE.SRGBColorSpace; sbt.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.6), new THREE.MeshBasicMaterial({ map: sbt, toneMapped: false, fog: false }));
  screen.position.set(0, 7.2, -27.2); world.add(screen);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x23233a, roughness: 0.5, metalness: 0.3 });
  const fr = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 0.3), frameM); fr.position.set(0, 7.2, -27.4); world.add(fr);
  for (const x of [-3.6, 3.6]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 6, 8), frameM); leg.position.set(x, 3, -27.5); world.add(leg); }
  SCREEN.c = sbc; SCREEN.t = sbt; drawScreen();
  // the umpire's chair
  const chair = new THREE.Group(); const cm = new THREE.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.6 });
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), cm); l.position.set(x, 1, z); chair.add(l); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.8), cm); seat.position.y = 2; chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), standM2); back.position.set(0.0, 2.4, 0); back.rotation.y = Math.PI / 2; back.position.x = 0.4; chair.add(back);
  chair.position.set(7.6, 0, 0); chair.traverse((o) => { if (o.isMesh) o.castShadow = true; }); world.add(chair);
}
const CROWD = { seats: [], body: null, head: null, cheer: 0 };
const FLAGS = [];
// the big score screen behind Rob: the two names, the points, the games
const SCREEN = { c: null, t: null, a: 'YOU', b: 'ROB', pts: '0 : 0', games: '0 – 0' };
function drawScreen() {
  if (!SCREEN.c) return; const g = SCREEN.c.getContext('2d'), W = 1024, H = 320;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d1450'); bg.addColorStop(1, '#0e0a2c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffcd1c'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
  g.textBaseline = 'middle'; g.font = '400 64px "Lilita One", sans-serif';
  g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.fillText(SCREEN.a.slice(0, 12), 44, 92); g.fillText(SCREEN.b.slice(0, 12), 44, 214);
  g.textAlign = 'center'; g.fillStyle = '#ffcd1c'; g.font = '400 110px "Lilita One", sans-serif';
  const [pa, pb] = SCREEN.pts.split(':').map((x) => x.trim());
  g.fillText(pa || '0', 700, 96); g.fillText(pb || '0', 700, 218);
  g.fillStyle = '#7fe0ff'; g.font = '400 54px "Lilita One", sans-serif'; const [ga, gb] = SCREEN.games.split('–').map((x) => x.trim());
  g.fillText(ga || '0', 900, 92); g.fillText(gb || '0', 900, 214);
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '400 26px "Lilita One", sans-serif'; g.fillText('POINTS', 700, 22); g.fillText('GAMES', 900, 22);
  SCREEN.t.needsUpdate = true;
}
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3(1, 1, 1), _s0 = new THREE.Vector3(0, 0, 0), _v4 = new THREE.Vector3();
function updateCrowd(t, dt) {
  for (const f of FLAGS) { const a = f.geometry.attributes.position, b = f.userData.base; for (let k = 0; k < a.count; k++) { const x = b[k * 3]; a.array[k * 3 + 2] = Math.sin(x * 5 - t * 6 + f.position.z) * 0.1 * x; } a.needsUpdate = true; }
  if (!CROWD.body) return;
  CROWD.cheer = Math.max(0, CROWD.cheer - dt * 0.5);
  CROWD.seats.forEach((q, i) => {
    const hop = Math.max(0, Math.sin(t * 9 + q.ph)) * 0.25 * CROWD.cheer + Math.sin(t * 2 + q.ph) * 0.02;
    _v4.set(q.x, q.y + 0.38 + hop, q.z); _m4.compose(_v4, _q4, _s4); CROWD.body.setMatrixAt(i, _m4);
    _v4.y += 0.42; _m4.compose(_v4, _q4, _s4); CROWD.head.setMatrixAt(i, _m4);
    if (CROWD.hat) { _v4.y += 0.13; _m4.compose(_v4, _q4, i % 3 ? _s0 : _s4); CROWD.hat.setMatrixAt(i, _m4); }
  });
  CROWD.body.instanceMatrix.needsUpdate = true; CROWD.head.instanceMatrix.needsUpdate = true; if (CROWD.hat) CROWD.hat.instanceMatrix.needsUpdate = true;
}
// trees around (the Adventures jungle models)
async function loadTrees() {   // (Christmas 2026-11-24: snowy firs from the snow sports' props and hedges round the court; no palms, grass or flowers in the snow)
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  const [bushG, sp] = await Promise.all([L.loadAsync('/adventures/models/nature-bush.glb?v=1').catch(() => null), L.loadAsync('/sports/snow/models/snow-props.glb?v=1').catch(() => null)]);
  // every prototype is a list of parts (a fir is bark + two greens + snow): one InstancedMesh per part, scaled to 1 m tall, feet at 0
  const proto = (root) => { const r = root.clone(true); r.position.set(0, 0, 0); r.rotation.set(0, 0, 0); r.scale.set(1, 1, 1); r.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(r), h = box.max.y - box.min.y || 1, norm = new THREE.Matrix4().makeTranslation(0, -box.min.y / h, 0).multiply(new THREE.Matrix4().makeScale(1 / h, 1 / h, 1 / h)), parts = [];
    r.traverse((o) => { if (o.isMesh) { if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; parts.push({ g: o.geometry, m: o.material, base: norm.clone().multiply(o.matrixWorld) }); } });
    return { parts, places: [] }; };
  const firs = sp ? ['Pine1', 'Pine2', 'Pine3'].map((n) => sp.scene.getObjectByName(n)).filter(Boolean).map(proto) : [];
  const bush = bushG ? proto(bushG.scene) : null;
  if (firs.length) for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2 + rand(-0.04, 0.04), r = rand(27, 46); const x = Math.cos(a) * r, z = Math.sin(a) * r * 1.25; if (Math.abs(x) < 21 && Math.abs(z) < 25) continue; firs[i % firs.length].places.push([x, z, rand(6, 11), rand(0, 6)]); }
  // a hedge behind the back fences and behind the stands
  if (bush) { for (let x = -10.5; x <= 10.5; x += 1.5) for (const s of [-1, 1]) bush.places.push([x + rand(-0.2, 0.2), s * (20.6 + rand(0, 0.5)), rand(1.4, 2.0), rand(0, 6)]);
    for (let z = -19; z <= 19; z += 2.2) for (const s of [-1, 1]) bush.places.push([s * (20.2 + rand(0, 0.6)), z + rand(-0.3, 0.3), rand(1.6, 2.3), rand(0, 6)]); }
  for (const p of [...firs, bush].filter(Boolean)) for (const part of p.parts) {
    const im = new THREE.InstancedMesh(part.g, part.m, Math.max(1, p.places.length)); im.castShadow = false; im.userData.noCast = true;
    p.places.forEach(([x, z, h, r], i) => { _q4.setFromEuler(new THREE.Euler(0, r, 0)); _m4.compose(new THREE.Vector3(x, 0, z), _q4, new THREE.Vector3(h, h, h)).multiply(part.base); im.setMatrixAt(i, _m4); });
    world.add(im); }
  // two snowmen in the far corners (until the PC's Christmas kit brings its own)
  const sm = sp && sp.scene.getObjectByName('Snowman'); if (sm) for (const s of [-1, 1]) { const o = sm.clone(true); o.position.set(s * 9.3, 0, -15.8); o.rotation.set(0, -s * 0.5, 0); o.traverse((q) => { if (q.isMesh) q.castShadow = true; }); o.name = 'Snowman-fallback'; world.add(o); }
}


// ---------- the ball, the rackets, the bubbles ----------
const ballTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#d9f23c'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= 128; x++) { const y = 32 + Math.sin(x / 128 * Math.PI * 4) * 14; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.65, emissive: 0x3a4a00, emissiveIntensity: 0.25 }));
ball.castShadow = true; scene.add(ball);
const trail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2ff9a, transparent: true, opacity: 0.35, depthWrite: false }));
trail.geometry.translate(0, -0.5, 0); trail.geometry.rotateX(Math.PI / 2); scene.add(trail);
function makeRacket(color) {
  const g = new THREE.Group();
  const hm = new THREE.MeshStandardMaterial({ color: 0x23233a, roughness: 0.5 }), fm = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.26, 8), hm); handle.position.y = 0.05; g.add(handle);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.16, 6), fm); throat.position.y = 0.24; g.add(throat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 8, 28), fm); ring.scale.set(1, 1.25, 1); ring.position.y = 0.5; g.add(ring);
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d'); sg.strokeStyle = 'rgba(255,255,255,.85)'; sg.lineWidth = 1.5;
  for (let i = 4; i < 64; i += 7) { sg.beginPath(); sg.moveTo(i, 0); sg.lineTo(i, 64); sg.stroke(); sg.beginPath(); sg.moveTo(0, i); sg.lineTo(64, i); sg.stroke(); }
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.148, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  strings.scale.set(1, 1.25, 1); strings.position.y = 0.5; g.add(strings);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g); return g;
}
// (2026-11-17, the user: "make the answers in bubbles, sometimes they bug and I cannot see them") each bubble carries its
// word itself: a sprite drawn on a canvas, in front of everything, inside the bubble
function wordSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  sp.renderOrder = 20; sp.scale.set(2.0, 1.0, 1);
  sp.userData.draw = (word, col) => { const g = c.getContext('2d'); g.clearRect(0, 0, 512, 256);
    let fs = 176; g.font = `400 ${fs}px "Lilita One", "Arial Black", sans-serif`; while (g.measureText(word).width > 470 && fs > 40) { fs -= 6; g.font = `400 ${fs}px "Lilita One", "Arial Black", sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = fs * 0.2; g.strokeStyle = 'rgba(29,22,64,0.92)'; g.strokeText(word, 256, 136);
    g.fillStyle = col || '#ffffff'; g.fillText(word, 256, 136); t.needsUpdate = true; };
  return sp;
}
const bubbles = TINTS.map((c) => { const b = makeBubble(c); b.mesh.visible = false; b.mesh.scale.setScalar(0.62); scene.add(b.mesh);
  const word = wordSprite(); b.mesh.add(word);
  return Object.assign(b, { k: 0, x: 0, y: 0, z: 0, state: 'off', t: 0, word, size: 0.62 }); });
let BUBW = null, POPPED = -1;   // whose bubbles are showing, the set already popped
const labelEls = CSS_TINTS.map((c, k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'blabel'; b.style.setProperty('--c', c); b.innerHTML = '<span></span>';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); if (FR.on) FR.tap(k); else SOLO.tap(k); });
  $('labels').appendChild(b); return b;
});
// a soft round shadow under the ball (it is small, so the real shadow is hard to see)
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; scene.add(blob);

// ---------- the players ----------
const P = { a: null, b: null };
const side = (w) => (w === 'a' ? 1 : -1);
const other = (w) => (w === 'a' ? 'b' : 'a');
const _dir = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _qr = new THREE.Quaternion();
// Foxino's forehand: back swing, the hit (u = 0.5), the follow-through across his body
const FK = [
  { spine: [0.12, 0, 0], armR: [-0.15, 0, -0.22], elbowR: [-0.9, 0, 0], armL: [-0.15, 0, 0.22] },
  { spine: [0.15, 0.85, 0], armR: [0.55, 0, -1.25], elbowR: [-0.35, 0, 0], armL: [-0.9, 0, 0.55] },
  { spine: [0.08, -0.05, 0], armR: [-0.7, 0, -1.3], elbowR: [-0.15, 0, 0], armL: [-0.35, 0, 0.5] },
  { spine: [0.05, -0.85, 0], armR: [-1.7, 0, -0.45], elbowR: [-1.3, 0, 0], armL: [-0.2, 0, 0.35] },
];
function keyPose(K, u) {
  const seg = u < 0.38 ? [0, 1, u / 0.38] : u < 0.5 ? [1, 2, (u - 0.38) / 0.12] : [2, 3, (u - 0.5) / 0.4];
  const A = K[seg[0]], B = K[seg[1]], f = smooth(seg[2]), out = {};
  for (const j in A) out[j] = A[j].map((v, i) => lerp(v, B[j][i], f));
  return out;
}
// Rob's swing: his right arm aimed through the same four directions (his right is -x, he faces +z)
const aimE = new THREE.Euler(), aimQ = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
const aim = (x, y, z) => { _dir.set(x, y, z).normalize(); aimQ.setFromUnitVectors(DOWN, _dir); aimE.setFromQuaternion(aimQ, 'ZXY'); return [aimE.x, aimE.y, aimE.z]; };
const RK = [[-0.75, -0.55, 0.45], [-0.75, -0.05, -0.65], [-0.8, 0.05, 0.6], [0.55, 0.12, 0.85]];
function robSwing(t, u) {
  const p = RPOSES.ready(t), seg = u < 0.38 ? [0, 1, u / 0.38] : u < 0.5 ? [1, 2, (u - 0.38) / 0.12] : [2, 3, (u - 0.5) / 0.4], f = smooth(seg[2]);
  const A = RK[seg[0]], B = RK[seg[1]];
  p.armR = aim(lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)); p.elbowR = [-0.25, 0, 0];
  const tw = seg[0] === 0 ? -0.5 * f : seg[0] === 1 ? lerp(-0.5, 0.1, f) : lerp(0.1, 0.6, f);
  p.body = [0.12, tw, 0];
  return p;
}
function robRun(t, amt) { const p = RPOSES.ready(t), s = Math.sin(t * 13); p.legL = [-0.5 * s * amt, 0, 0.18]; p.legR = [0.5 * s * amt, 0, -0.18]; p.body = [0.18, 0, 0.06 * s * amt]; return p; }
// the far player: Rob (against the computer) or a second Foxino in orange (a friend)
async function setOpponent(kind) {
  const p = P.b; if (!p) return;
  if (kind === 'fox' && !p.fox) {
    p.fox = await loadFoxino().catch(() => null);
    if (p.fox) { p.fox.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(p.fox.root); p.fox.setKit({ shirt: '#ffffff', trim: '#ff7d22', shorts: '#ff7d22', socks: '#ffffff', boots: '#f4f4f4' }); }
  }
  const fox = kind === 'fox' && p.fox;
  if (p.fox) p.fox.root.visible = !!fox; p.rob.root.visible = !fox;
  p.ch = fox ? p.fox : p.rob; p.kind = fox ? 'fox' : 'rob'; p.ch.root.rotation.y = 0;
  p.racket.children.forEach((m) => { if (m.material && m.material.color && m.geometry.type === 'TorusGeometry') m.material.color.set(fox ? 0xff7d22 : 0x3cc6ef); });
}
async function makePlayers(kitA) {
  const fox = await loadFoxino().catch(() => null);
  if (fox) { fox.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); fox.root.rotation.y = Math.PI; scene.add(fox.root); fox.setKit(kitA || { shirt: '#ffffff', trim: '#8f52d9', shorts: '#8f52d9', socks: '#ffffff', boots: '#f4f4f4' }); }
  const rob = makeRob(); rob.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(rob.root);
  P.a = { w: 'a', kind: 'fox', ch: fox, x: 0, z: HALF_L + 0.6, tx: 0, tz: HALF_L + 0.6, swing: -1, mood: '', moodT: 0, racket: makeRacket(0x8f52d9), tag: null };
  P.b = { w: 'b', kind: 'rob', rob, ch: rob, x: 0, z: -HALF_L - 0.6, tx: 0, tz: -HALF_L - 0.6, swing: -1, mood: '', moodT: 0, racket: makeRacket(0x3cc6ef), tag: null };
  for (const w of ['a', 'b']) { const t = document.createElement('div'); t.className = 'tag'; t.style.display = 'none'; $('tags').appendChild(t); P[w].tag = t; }
}
function updatePlayers(dt, t) {
  for (const w of ['a', 'b']) {
    const p = P[w]; if (!p || !p.ch) continue;
    const vx = (p.tx - p.x), vz = (p.tz - p.z);
    p.x = damp(p.x, p.tx, 4.5, dt); p.z = damp(p.z, p.tz, 4.5, dt);
    const moving = Math.min(1, Math.hypot(vx, vz) * 1.4);
    p.ch.root.position.set(p.x, 0, p.z);
    if (p.swing >= 0) p.swing += dt / 0.5;
    if (p.swing > 1) p.swing = -1;
    p.moodT += dt; if (p.moodT > 1.8) p.mood = '';
    if (p.kind === 'fox') {
      let pose;
      if (p.mood === 'cheer') pose = POSES.celebrate(p.moodT);
      else if (p.mood === 'sad') pose = POSES.sad(p.moodT);
      else if (p.swing >= 0) { pose = POSES.ready(t); Object.assign(pose, keyPose(FK, p.swing)); }
      else if (moving > 0.15) { pose = POSES.run(t * 13, 0.55 * moving); pose.armR = [-0.4, 0, -0.5]; pose.elbowR = [-0.8, 0, 0]; }
      else pose = POSES.ready(t);
      p.ch.apply(pose, p.swing >= 0 ? 22 : 12, dt);
    } else {
      let pose;
      if (p.mood === 'cheer') pose = RPOSES.hold ? RPOSES.hold(p.moodT) : RPOSES.ready(t);
      else if (p.mood === 'sad') pose = RPOSES.oops ? RPOSES.oops(p.moodT) : RPOSES.ready(t);
      else if (p.swing >= 0) pose = robSwing(t, p.swing);
      else if (moving > 0.15) pose = robRun(t, moving);
      else pose = RPOSES.ready(t);
      p.ch.apply(pose, p.swing >= 0 ? 22 : 12, dt); p.ch.update(dt, t);
    }
    // the racket in the right paw / glove, along the forearm
    let hand, elbow;
    if (p.kind === 'fox') { const bn = p.ch.bones || {}; if (bn.RightHand && bn.RightForeArm) { hand = bn.RightHand.getWorldPosition(new THREE.Vector3()); elbow = bn.RightForeArm.getWorldPosition(new THREE.Vector3()); } }
    else { const J = p.ch.J; if (J && J.gloveR) { hand = J.gloveR.localToWorld(new THREE.Vector3(0, -0.12, 0)); elbow = J.elbowR ? J.elbowR.getWorldPosition(new THREE.Vector3()) : J.gloveR.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)); } }
    if (hand && elbow) {
      _dir.subVectors(hand, elbow).normalize(); _dir.y += 0.35; _dir.normalize();
      p.racket.position.copy(hand).addScaledVector(_dir, -0.05);
      _qr.setFromUnitVectors(_up, _dir); p.racket.quaternion.copy(_qr);
    }
    p.racket.visible = !!hand;
  }
}

// ---------- the ball's flight ----------
// a flight is a list of arcs {a, b, h, d}: from a to b in d seconds, h metres above the straight line in the middle
const B = { arcs: [], i: 0, u: 0, mode: 'hold', to: null, holder: 'a', pending: null, scale: 1, ask: null, bounced: false, spin: new THREE.Vector3() };
const arcPos = (A, u, out) => out.lerpVectors(A.a, A.b, u).setY(lerp(A.a.y, A.b.y, u) + 4 * A.h * u * (1 - u));
function launch(arcs, to) { B.arcs = arcs; B.i = 0; B.u = 0; B.mode = 'fly'; B.to = to; B.pending = null; }
// over the net: the apex high enough to clear it
function netArc(a, b, d) {
  const un = Math.abs(a.z) / (Math.abs(a.z) + Math.abs(b.z)), yl = lerp(a.y, b.y, un);
  const h = Math.max(1.0, (1.35 - yl) / (4 * un * (1 - un)) + 0.25);
  return { a, b, h, d };
}
// a shot from the hitter's contact point C to the other side: the bounce, then up to where the other player hits it
function shotTo(from, C, k, serve = false) {
  const s = side(from), to = other(from);
  const tx = clamp((k >= 0 ? TX[k] : rand(-3, 3)) + rand(-0.5, 0.5), -SINGLE_W + 0.5, SINGLE_W - 0.5);
  const bz = -s * (serve ? rand(3.8, 5.8) : rand(6.5, 9.8));
  const Bp = new THREE.Vector3(tx, 0.1, bz);
  const hx = clamp(tx * 1.25 + rand(-0.4, 0.4), -SINGLE_W - 0.3, SINGLE_W + 0.3), H = new THREE.Vector3(hx, 1.0, -s * (HALF_L - 0.3));
  P[to].tx = hx + (to === 'a' ? -0.75 : 0.75); P[to].tz = -s * (HALF_L + 0.6);
  launch([netArc(C, Bp, serve ? 0.75 : 1.0), { a: Bp, b: H, h: 0.8, d: 0.55 }], to);
  B.hit = H; B.missed = false; B.netAt = 0; B.netDone = false;
  // the other player's answer came in before this shot: it is played when the ball gets there
  if (B.queued && B.queued.w === to) { const qd = B.queued; B.queued = null; if (qd.k < 0) B.missed = true; else B.pending = qd; }
}
function contactPoint(w) { const p = P[w]; return new THREE.Vector3(p.x + (w === 'a' ? 0.7 : -0.7), 1.0, p.z - side(w) * 0.4); }
// the hitter's decision has arrived: ok → over the net (through the chosen bubble's side), wrong → into the net, k < 0 → missed
function doHit(w, k, ok, serve = false) {
  const C = serve ? B.serveAt.clone() : B.hit ? B.hit.clone() : contactPoint(w);
  if (P[w].swing < 0) P[w].swing = 0.45;
  sfx.kick && sfx.kick();
  if (ok) shotTo(w, C, k, serve);
  else if (k >= 0) { const N = new THREE.Vector3(clamp(C.x * 0.6 + (k - 1) * 1.5, -5, 5), 0.55, side(w) * 0.25); launch([{ a: C, b: N, h: 0.5, d: 0.55 }, { a: N, b: new THREE.Vector3(N.x, 0.1, side(w) * 0.9), h: 0.1, d: 0.35 }], null); B.netAt = 0.55; }
  else { launch([], null); }
  // (the bubbles were popped already when the answer came in: COURT.hit)
}
const _bp = new THREE.Vector3();
function updateBall(dt, t) {
  if (B.mode === 'hold') {
    // bouncing the ball before the serve
    const p = P[B.holder], s = side(B.holder);
    if (!p) return;
    const tb = (t * 1.6) % 1, y = 0.1 + 1.0 * 4 * tb * (1 - tb);
    ball.position.set(p.x + (B.holder === 'a' ? -0.35 : 0.35), y, p.z - s * 0.5);
    B.serveAt = new THREE.Vector3(p.x + (B.holder === 'a' ? 0.4 : -0.4), 2.5, p.z - s * 0.4);
    trail.visible = false;
  } else if (B.mode === 'fly') {
    const A = B.arcs[B.i];
    if (!A) { B.mode = 'dead'; return; }
    // slow motion while the player still has to answer (the ball hangs before the bounce on their side)
    let sc = 1;
    if (B.to && !B.pending && !B.missed && B.i === 0 && B.u > 0.66) sc = 0.045;
    if (B.to && B.pending) sc = 1.25;
    B.scale = damp(B.scale, sc, 8, dt);
    B.u += (dt * B.scale) / A.d;
    // the receiver swings just before the ball reaches the hit point
    if (B.to && B.pending && B.i === B.arcs.length - 1 && (1 - B.u) * A.d < 0.27 && P[B.to].swing < 0 && B.pending.k >= 0) P[B.to].swing = 0;
    if (B.u >= 1) {
      const end = A.b.clone(); B.i++; B.u = 0;
      if (end.y < 0.2) { sfx.thud && sfx.thud(); }
      if (B.i >= B.arcs.length) {
        if (B.to && B.pending) { const { w, k, ok } = B.pending; doHit(w, k, ok); return; }
        if (B.to && B.missed) { // nobody hit it: on past the player to the fence
          const X = new THREE.Vector3(end.x * 1.2, 0.1, side(B.to) * 17.5); launch([{ a: end, b: X, h: 0.6, d: 0.7 }], null); return; }
        B.mode = 'dead'; B.deadT = 0; return;
      }
    }
    arcPos(B.arcs[B.i] || A, B.i < B.arcs.length ? B.u : 1, ball.position);
    if (B.netAt && B.i === 0 && B.u > 0.95 && !B.netDone) { B.netDone = true; sfx.net && sfx.net(); }
    // the trail behind a fast ball
    _bp.copy(ball.position); const A2 = B.arcs[B.i] || A; const nx = arcPos(A2, Math.min(1, B.u + 0.02), new THREE.Vector3());
    _dir.subVectors(nx, _bp); const sp = _dir.length();
    trail.visible = sp > 0.004 && B.scale > 0.4; if (trail.visible) { trail.position.copy(_bp); trail.lookAt(_bp.clone().sub(_dir)); trail.scale.set(1, 1, Math.min(1.6, sp * 40)); }
    ball.rotation.x += dt * 14 * B.scale;
  } else { trail.visible = false; ball.position.y = Math.max(0.1, ball.position.y - dt * 3); }
  blob.position.set(ball.position.x, 0.012, ball.position.z); blob.material.opacity = clamp(0.35 - ball.position.y * 0.08, 0.08, 0.35);
}

// ---------- the bubbles on the answering player's side ----------
let labelGen = 0;
function showBubbles(w, words) {
  const s = side(w); labelGen++; BUBW = w;
  words.forEach((wd, k) => {
    const b = bubbles[k]; if (!b) return;
    b.word.userData.draw(wd); b.word.material.opacity = 1;
    const narrow = camera.aspect < 0.8, spread = s > 0 ? (narrow ? 0.58 : 0.9) : 1.12;
    b.size = s > 0 ? (narrow ? 0.74 : 0.8) : 1.15;
    Object.assign(b, { near: s > 0, x: BUB_X[k] * spread, y: (s > 0 ? 1.55 : 1.6) + (k === 1 ? 0.5 : 0), z: s * (s > 0 ? 6.4 : 3.7), state: 'in', t: -k * 0.1 });
    b.mesh.visible = true; b.u.uAlpha.value = 1; b.u.uGlow.value = 0; b.u.uHot.value = 0; b.mesh.scale.setScalar(0.001);
    const l = labelEls[k]; l.className = 'blabel'; l.firstChild.textContent = wd; l.style.opacity = '1';
  });
  for (let k = words.length; k < 3; k++) { bubbles[k].mesh.visible = false; labelEls[k].style.opacity = '0'; }
  sfx.bubble && sfx.bubble();
}
function popBubbles(k, ok) {
  bubbles.forEach((b, i) => { if (b.state === 'off') return; b.state = i === k ? 'pop' : 'fade'; b.t = 0; });
  labelEls.forEach((l, i) => { if (i === k) l.classList.add('picked'); else l.classList.add('wrong'); });
  const g = labelGen; setTimeout(() => { if (g === labelGen) labelEls.forEach((l) => { l.style.opacity = '0'; }); }, 700);
  if (k >= 0) sfx.pop && sfx.pop();
}
function revealRight(k) { if (labelEls[k]) { labelEls[k].classList.remove('wrong'); labelEls[k].classList.add('right'); }
  const b = bubbles[k]; if (b && b.mesh.visible) { b.u.uGlow.value = 1; b.u.uAlpha.value = 1; b.state = 'right'; b.t = 0; b.word.userData.draw(labelEls[k].firstChild.textContent, '#b9ffcf'); } }
function updateBubbles(dt, t) {
  for (const b of bubbles) {
    if (!b.mesh.visible) continue;
    b.t += dt; b.u.uTime.value = t;
    if (b.state === 'in') { const s = b.size * smooth(b.t / 0.35); b.mesh.scale.setScalar(Math.max(0.001, s)); }
    if (b.state === 'pop') { b.mesh.scale.setScalar(b.size * (1 + b.t * 2)); b.u.uAlpha.value = Math.max(0, 1 - b.t * 3); b.word.material.opacity = Math.max(0, 1 - b.t * 3); if (b.t > 0.35) { b.mesh.visible = false; b.state = 'off'; } }
    if (b.state === 'fade') { b.u.uAlpha.value = Math.max(0, 1 - b.t * 2); b.word.material.opacity = Math.max(0, 1 - b.t * 2.5); if (b.t > 0.5) { b.mesh.visible = false; b.state = 'off'; } }
    if (b.state === 'right') { b.mesh.scale.setScalar(b.size * (1 + 0.08 * Math.sin(b.t * 12))); if (b.t > 1.4) { b.state = 'fade'; b.t = 0; } }
    b.mesh.position.set(b.x + (b.near ? camera.position.x * 0.92 : 0), b.y + Math.sin(t * 2 + b.x) * 0.06, b.z);   // (the near ones stay in front of the camera)
  }
}
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  bubbles.forEach((b, k) => {
    const l = labelEls[k]; if (!b.mesh.visible) return;
    _v4.copy(b.mesh.position).project(camera);
    const d = camera.position.distanceTo(b.mesh.position), px = Math.max(70, (b.size * 1.15 / (d * Math.tan(camera.fov * Math.PI / 360))) * h);
    l.style.width = l.style.height = `${px.toFixed(0)}px`;
    l.style.transform = `translate(${(_v4.x * 0.5 + 0.5) * w}px, ${(-_v4.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
  });
  for (const k of ['a', 'b']) { const p = P[k]; if (!p || !p.tag || p.tag.style.display === 'none') continue;
    _v4.set(p.x, k === 'a' ? 1.85 : 2.1, p.z).project(camera);
    p.tag.style.transform = `translate(${(_v4.x * 0.5 + 0.5) * w}px, ${(-_v4.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`; }
}

// ---------- the court's actions (the same for the teacher's page and the solo game) ----------
const COURT = {
  names: { a: 'YOU', b: 'ROB' }, cols: { a: '#8f52d9', b: '#23a6d4' }, q: null,
  setNames(a, b, ca, cb, tags) {
    this.names = { a, b }; this.cols = { a: ca || '#8f52d9', b: cb || '#23a6d4' };
    for (const w of ['a', 'b']) { const p = P[w]; if (!p) continue; p.tag.textContent = this.names[w]; p.tag.style.setProperty('--c', this.cols[w]); p.tag.style.display = tags ? '' : 'none'; }
  },
  // the player w answers: their bubbles appear; a serve starts with the ball in their hand
  ask(w, q, secs, serve) {
    this.q = q; this.who = w;
    if (serve) { this.resetForServe(w); }
    showBubbles(w, q.words.map((x) => x.text));
    card(w, q, secs);
  },
  resetForServe(w) {
    for (const k of ['a', 'b']) { const p = P[k]; p.tx = (k === w ? 0.9 : -0.9) * (COURT.pointN % 2 ? -1 : 1); p.tz = side(k) * (HALF_L + 0.6); p.swing = -1; }
    B.mode = 'hold'; B.holder = w; B.arcs = []; B.to = null; B.pending = null; B.queued = null; B.missed = false; B.netAt = 0; B.netDone = false; B.hit = null;
  },
  hit(w, k, ok, right) {
    const q = this.q;
    // (2026-11-17, the user: "I had a question and I didn't have the bubbles") the bubbles pop the moment the answer comes in.
    // Before, they popped when the ball reached the racket: after a quick answer the NEXT question's bubbles were already
    // showing by then, and those were popped instead.
    if (BUBW === w && this.who === w && POPPED !== labelGen) { POPPED = labelGen; popBubbles(k, ok); }
    if (B.mode === 'hold' && B.holder === w) { tossServe(w, k, ok); }
    else if (B.mode === 'fly' && B.to === w) { if (k < 0) { B.missed = true; B.pending = null; } else B.pending = { w, k, ok }; }
    else if (B.mode === 'fly' && B.to && B.to !== w) B.queued = { w, k, ok };
    else if (k >= 0) doHit(w, k, ok);
    if (q && this.who === w) { const g = labelGen; if (!ok) setTimeout(() => { if (g === labelGen) revealRight(q.correct); }, 350); cardResult(ok, k, q, right); timerStop(); }
  },
  point(w, label, sub) { banner(label, sub); CROWD.cheer = 1; sfx.cheer && sfx.cheer(); P[w].mood = 'cheer'; P[w].moodT = 0; P[other(w)].mood = 'sad'; P[other(w)].moodT = 0; COURT.pointN = (COURT.pointN || 0) + 1; },
  idle() { $('hud').classList.add('hidden'); bubbles.forEach((b) => { b.mesh.visible = false; }); labelEls.forEach((l) => { l.style.opacity = '0'; }); B.mode = 'hold'; B.holder = 'a'; },
};
COURT.pointN = 0;
function tossServe(w, k, ok) {
  B.mode = 'toss'; const p = P[w], at = B.serveAt.clone(), start = ball.position.clone();
  launch([{ a: start, b: at, h: 0.5, d: 0.45 }], null); B.mode = 'fly';
  setTimeout(() => { P[w].swing = 0.3; }, 250);
  setTimeout(() => { if (k < 0) { B.arcs = []; B.mode = 'dead'; return; } doHit(w, k, ok, true); }, 460);
}

// ---------- the HUD ----------
let timerT = null;
function card(w, q, secs) {
  $('hud').classList.remove('hidden');
  const nm = COURT.names[w];
  $('cardWho').innerHTML = REMOTE ? `<em style="--c:${COURT.cols[w]}">${esc(nm)}</em> answer on your phone!` : w === 'a' ? 'YOUR SHOT' : `${esc(nm)}'S SHOT`;
  $('sentence').innerHTML = `${hints(q.before)}<span class="gap">&nbsp;</span>${hints(q.after)}`;
  $('note').className = ''; $('note').innerHTML = '&nbsp;';
  const f = $('tFill'), bar = f.parentElement; bar.classList.remove('low'); f.style.transition = 'none'; f.style.transform = 'scaleX(1)'; void f.offsetWidth;
  f.style.transition = `transform ${secs}s linear`; f.style.transform = 'scaleX(0)';
  clearTimeout(timerT); timerT = setTimeout(() => bar.classList.add('low'), Math.max(0, secs - 3) * 1000);
}
function timerStop() { const f = $('tFill'); const tr = getComputedStyle(f).transform; f.style.transition = 'none'; f.style.transform = tr === 'none' ? 'scaleX(0)' : tr; clearTimeout(timerT); }
function cardResult(ok, k, q, right) {
  const r = right || q.right;
  $('sentence').innerHTML = `${hints(q.before)}<span class="gap ok">${esc(r)}</span>${hints(q.after)}`;
  $('note').className = ok ? 'good' : 'bad';
  $('note').innerHTML = ok ? ['Great shot!', 'Super!', 'Yes! ✓', 'Brilliant!'][Math.floor(Math.random() * 4)] : k < 0 ? `Too slow! The right word is <b>${esc(r)}</b>` : `Into the net! The right word is <b>${esc(r)}</b>`;
}
function banner(text, sub) { const b = $('banner'); b.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(b._t); b._t = setTimeout(() => { b.innerHTML = ''; }, 1700); }
function setScore(html) { $('score').innerHTML = html; }

// ---------- the solo game: Foxino against Rob ----------
const PACKS = window.FSQ ? FSQ.packs() : [];
let packIds = (store.get('tennis-packs', []) || []).filter((id) => PACKS.some((p) => p.id === id));
if (!packIds.length && PACKS.length) packIds = [(PACKS.find((p) => p.level === 'A1') || PACKS[0]).id];
let gamesToWin = store.get('tennis-len', 2);
const CALL = ['0', '15', '30', '40'];
const SOLO = {
  on: false, pts: [0, 0], games: [0, 0], server: 'a', rally: 0, right: 0, asked: 0, missed: [], q: null, t0: 0, waiting: false, tmo: null,
  start() {
    unlock(); sfx.click && sfx.click();
    Object.assign(SOLO, { on: true, pts: [0, 0], games: [0, 0], server: 'a', rally: 0, right: 0, asked: 0, missed: [] }); combo = 0; renderCombo(); $('againBtn').textContent = 'PLAY AGAIN'; setOpponent('rob'); $('labels').classList.remove('theirs');
    $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
    COURT.setNames('YOU', 'ROB', '#8f52d9', '#23a6d4', false); COURT.pointN = 0;
    SOLO.score(); sfx.whistle && sfx.whistle();
    setTimeout(() => SOLO.serve(), 700);
  },
  score() { const [a, b] = SOLO.pts, [ga, gb] = SOLO.games;
    Object.assign(SCREEN, { a: 'FOXINO', b: 'ROB', pts: `${CALL[Math.min(3, a)]} : ${CALL[Math.min(3, b)]}`, games: `${ga} – ${gb}` }); drawScreen(); setScore(`YOU <b>${a === 3 && b === 3 ? '40 : 40' : CALL[Math.min(3, a)] + ' : ' + CALL[Math.min(3, b)]}</b> ROB · <b>${ga}–${gb}</b>`); },
  serve() {
    if (!SOLO.on) return;
    SOLO.rally = 0;
    if (SOLO.server === 'a') SOLO.ask(true);
    else { COURT.resetForServe('b'); setTimeout(() => { if (!SOLO.on) return; const ok = Math.random() > 0.08; COURT.hit('b', Math.floor(Math.random() * 3), ok); if (ok) setTimeout(() => SOLO.ask(false), 500); else setTimeout(() => SOLO.point(0, 'FAULT!'), 1500); }, 1300); }
  },
  ask(serve) {
    if (!SOLO.on) return;
    const q = FSQ.make(PACKS, packIds, { n: 3, count: SOLO.asked }); if (!q) return;
    SOLO.q = q; SOLO.t0 = performance.now(); SOLO.waiting = true;
    const secs = Math.max(6, 11 - SOLO.rally * 0.8); SOLO.secs = secs;
    COURT.ask('a', q, secs, serve);
    clearTimeout(SOLO.tmo); SOLO.tmo = setTimeout(() => SOLO.answer(-1), secs * 1000);
  },
  tap(k) { if (REMOTE || !SOLO.waiting) return; SOLO.answer(k); },
  answer(k) {
    if (!SOLO.waiting) return; SOLO.waiting = false; clearTimeout(SOLO.tmo);
    const q = SOLO.q, ok = k === q.correct, ms = performance.now() - SOLO.t0;
    SOLO.asked++; if (ok) SOLO.right++; else SOLO.missed.push(q);
    if (k >= 0) sfx.pick && sfx.pick();
    juice(ok, ms, k);
    COURT.hit('a', k, ok);
    if (!ok) { setTimeout(() => SOLO.point(1), k < 0 ? 2300 : 1700); return; }
    SOLO.rally++;
    // Rob: he misses more after a fast answer and in a long rally
    const pMiss = 0.27 + (ms < 3500 ? 0.15 : 0) + Math.min(0.15, SOLO.rally * 0.03);
    const robOk = Math.random() > pMiss;
    setTimeout(() => { if (!SOLO.on) return; COURT.hit('b', Math.floor(Math.random() * 3), robOk); if (robOk) setTimeout(() => SOLO.ask(false), 700); else setTimeout(() => SOLO.point(0, 'ROB MISSED!'), 1500); }, 300);
  },
  point(w, why) {
    if (!SOLO.on) return;
    SOLO.pts[w]++;
    let label, sub = why || '';
    const g = SOLO.pts[w] >= 4;
    if (g) { SOLO.games[w]++; SOLO.pts = [0, 0]; SOLO.server = SOLO.server === 'a' ? 'b' : 'a'; label = w === 0 ? 'GAME YOU!' : 'GAME ROB'; sub = `games ${SOLO.games[0]}–${SOLO.games[1]}`; }
    else label = SOLO.pts[0] === 3 && SOLO.pts[1] === 3 ? 'DEUCE' : `${CALL[SOLO.pts[0]]} – ${CALL[SOLO.pts[1]]}`;
    COURT.point(w === 0 ? 'a' : 'b', label, sub);
    if (w === 1) sfx.aww && setTimeout(() => sfx.aww(), 200);
    SOLO.score();
    if (SOLO.games[w] >= gamesToWin) { SOLO.on = false; setTimeout(() => SOLO.finish(w === 0), 2200); return; }
    setTimeout(() => SOLO.serve(), g ? 2600 : 2000);
  },
  finish(won) {
    $('hud').classList.add('hidden'); bubbles.forEach((b) => { b.mesh.visible = false; }); labelEls.forEach((l) => { l.style.opacity = '0'; });
    const [ga, gb] = SOLO.games, stars = won ? (gb === 0 ? 3 : 2) : ga > 0 ? 1 : 0;
    $('endTitle').textContent = won ? 'You beat Rob!' : 'Rob won this time!';
    $('endGames').textContent = `${ga} – ${gb}`;
    $('endLine').textContent = `${SOLO.right} of ${SOLO.asked} answers right`;
    const st = [...document.querySelectorAll('#stars i')]; st.forEach((e) => e.classList.remove('on')); st.forEach((e, i) => { if (i < stars) setTimeout(() => { e.classList.add('on'); sfx.star && sfx.star(i); }, 500 + i * 300); });
    const list = $('missedList'); list.innerHTML = SOLO.missed.slice(-6).map((q) => `<li>${hints(q.before)}<b>${esc(q.right)}</b>${hints(q.after)}</li>`).join('');
    $('missed').classList.toggle('hidden', !SOLO.missed.length);
    const best = store.get('tennis-best', { wins: 0 }); if (won) { best.wins = (best.wins || 0) + 1; store.set('tennis-best', best); }
    $('end').classList.remove('hidden');
    if (won) { CROWD.cheer = 1; confetti(); P.a.mood = 'cheer'; P.a.moodT = -2; }
    renderStart();
    if (LIST && window.parent !== window) window.parent.postMessage({ ft: 'finished', won, games: [ga, gb], right: SOLO.right, asked: SOLO.asked }, '*');
  },
};
// ---------- the juice (2026-11-17, the user: "make the answering more satisfying") ----------
const BURST = (() => {
  const N = 260, geo = new THREE.BufferGeometry(), Pp = new Float32Array(N * 3), C = new Float32Array(N * 3), S = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setAttribute('size', new THREE.BufferAttribute(S, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, vertexColors: true, uniforms: { uScale: { value: 500 } },
    vertexShader: 'attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; gl_FragColor = vec4(vC * 1.25, smoothstep(0.5, 0.1, r)); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 30; scene.add(pts);
  const parts = Array.from({ length: N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), s: 0 })); let head = 0;
  return {
    emit(pos, n, color, speed = 5, size = 0.16) { const c = new THREE.Color(color); for (let i = 0; i < n; i++) { const q = parts[head = (head + 1) % N]; q.life = 0.5 + Math.random() * 0.5; q.p.copy(pos);
      q.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)); q.c.copy(c); q.s = size * (0.6 + Math.random() * 0.9); } },
    update(dt) { for (let i = 0; i < N; i++) { const q = parts[i]; if (q.life > 0) { q.life -= dt; q.v.y -= 6 * dt; q.v.multiplyScalar(1 - 1.8 * dt); q.p.addScaledVector(q.v, dt); }
      Pp[i * 3] = q.p.x; Pp[i * 3 + 1] = q.life > 0 ? q.p.y : -999; Pp[i * 3 + 2] = q.p.z; C[i * 3] = q.c.r; C[i * 3 + 1] = q.c.g; C[i * 3 + 2] = q.c.b; S[i] = q.life > 0 ? q.s * Math.min(1, q.life * 3) : 0; }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true; },
    scale(h) { mat.uniforms.uScale.value = h * 0.7; },
  };
})();
const vib = (pat) => { try { navigator.vibrate && navigator.vibrate(pat); } catch (e) {} };
let combo = 0;
function popText(pos, text, cls) {
  _v4.copy(pos).project(camera); const el = document.createElement('div'); el.className = 'ptext ' + cls; el.textContent = text;
  el.style.left = `${(_v4.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-_v4.y * 0.5 + 0.5) * innerHeight}px`;
  $('fxText').appendChild(el); setTimeout(() => el.remove(), 1100);
}
function flashScreen(cls) { const f = $('flash2'); f.className = ''; void f.offsetWidth; f.className = cls; }
function renderCombo() { const c = $('combo'); c.hidden = combo < 2; if (combo >= 2) { c.innerHTML = `🔥 <b>${combo}</b> in a row`; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
// the player's own answer: a burst out of the bubble, PERFECT! / GREAT! / GOOD! by speed, the combo, a shake, a buzz
function juice(ok, ms, k) {
  const b = bubbles[k], at = b && b.mesh.visible ? b.mesh.position.clone() : P.a.ch ? P.a.ch.root.position.clone().setY(1.6) : new THREE.Vector3(0, 1.6, 8);
  if (ok) {
    combo++;
    const tier = ms < 2500 ? 'PERFECT!' : ms < 5000 ? 'GREAT!' : 'GOOD!';
    BURST.emit(at, 34, CSS_TINTS[k] || '#ffd84a', 6); BURST.emit(at, 20, '#ffffff', 4, 0.12); if (tier === 'PERFECT!') BURST.emit(at, 30, '#ffd84a', 9, 0.2);
    popText(at, combo >= 2 ? `${tier} ×${combo}` : tier, tier === 'PERFECT!' ? 'perfect' : 'good');
    SHAKE = tier === 'PERFECT!' ? 0.9 : 0.6; FREEZE = 0.06; vib(tier === 'PERFECT!' ? [25, 40, 45] : 30);
    flashScreen('good'); sfx.star && sfx.star(Math.min(2, combo - 1)); CROWD.cheer = Math.max(CROWD.cheer, Math.min(1, 0.35 + combo * 0.15));
  } else {
    combo = 0; popText(at, k < 0 ? 'TOO SLOW!' : 'OOPS!', 'bad'); flashScreen('bad'); vib([70, 40, 70]); SHAKE = 0.5;
  }
  renderCombo();
  trail.material.color.set(combo >= 3 ? 0xff9a3c : 0xf2ff9a); trail.material.opacity = combo >= 3 ? 0.6 : 0.35;
}

// ---------- play a friend (2026-11-17, the user: "add a join part where you can join your friend with a QR code or a code") ----------
// Two phones over PeerJS (WebRTC; the PeerJS server only introduces them). The one who creates the game is the referee
// (questions, times, points) at peer id "fugio-tennis-<code>"; the friend joins with the code or by scanning the QR code
// (the link /sports/tennis/?join=<code>). On each phone you are Foxino in purple at the near end; your friend is Foxino in
// orange at the far end. Messages: begin, ask, hit, point, end (referee → both) · hello, ans, again (friend → referee).
const FR = {
  on: false, host: false, peer: null, conn: null, code: '', names: { h: '', g: '' }, games: 2, pts: [0, 0], gms: [0, 0], server: 'h', rally: 0, turn: null, my: null, n: 0,
  right: 0, asked: 0, missed: [], libs: null,
  me() { return FR.host ? 'h' : 'g'; }, them() { return FR.host ? 'g' : 'h'; },
  loc(who) { return who === FR.me() ? 'a' : 'b'; },
  load(src) { return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); },
  async libsReady() { return FR.libs || (FR.libs = Promise.all([window.Peer ? 0 : FR.load('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'), window.qrcode ? 0 : FR.load('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js')]).catch((e) => { FR.libs = null; throw e; })); },
  name() { const n = $('fName').value.trim().replace(/\s+/g, ' ').slice(0, 12); if (n) store.set('tennis-name', n); return n; },
  err(t) { $('fErr').textContent = t || ''; },
  open(code) {
    unlock(); $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('friend').classList.remove('hidden');
    $('fName').value = store.get('tennis-name', '') || ''; $('fHome').hidden = false; $('fHost').hidden = true; FR.err('');
    if (code) { $('fCode').value = code.replace(/(\d{3})(\d{3})/, '$1 $2'); if ($('fName').value) FR.join(); else $('fName').focus(); }
  },
  close() { FR.on = false; clearTimeout(FR.tmo); try { FR.conn && FR.conn.close(); } catch (e) {} try { FR.peer && FR.peer.destroy(); } catch (e) {} FR.conn = null; FR.peer = null; FR.turn = null; FR.my = null; },
  back() { sfx.click && sfx.click(); FR.close(); $('friend').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.add('hidden'); COURT.idle(); setOpponent('rob'); COURT.setNames('YOU', 'ROB', '#8f52d9', '#23a6d4', false); $('start').classList.remove('hidden'); renderStart(); },
  async create(fixed) {
    const nm = fixed ? FR.fixedName : FR.name(); if (!nm) { FR.err('Type your name first.'); $('fName').focus(); return; }
    FR.err(''); try { await FR.libsReady(); } catch (e) { FR.err('No internet connection.'); return; }
    FR.close(); FR.host = true; FR.names = { h: nm, g: '' }; FR.games = gamesToWin;
    const go = () => {
      FR.code = fixed || String(Math.floor(100000 + Math.random() * 900000));
      const peer = new Peer('fugio-tennis-' + FR.code); FR.peer = peer;
      peer.on('open', () => {
        $('fHome').hidden = true; $('fHost').hidden = false; $('fCodeBig').textContent = FR.code.replace(/(\d{3})(\d{3})/, '$1 $2'); $('fWait').textContent = 'Waiting for your friend…';
        const qr = qrcode(0, 'M'); qr.addData(`${location.origin}/sports/tennis/?join=${FR.code}`); qr.make(); $('fQr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      });
      peer.on('connection', (conn) => {
        if (FR.conn && FR.conn.open) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
        FR.conn = conn; FR.wire(conn);
      });
      peer.on('disconnected', () => { if (FR.peer === peer && !peer.destroyed) peer.reconnect(); });
      peer.on('error', (e) => { if (FR.peer !== peer) return; if (e.type === 'unavailable-id') { peer.destroy(); if (fixed) setTimeout(go, 1500); else go(); } else if (!FR.on) FR.err('Connection problem. Try again.'); });
    };
    go();
  },
  async join(fixed, tries = 0) {
    const nm = fixed ? FR.fixedName : FR.name(); if (!nm) { FR.err('Type your name first.'); $('fName').focus(); return; }
    const code = fixed || $('fCode').value.replace(/\D/g, ''); if (!fixed && code.length !== 6) { FR.err("Type your friend's 6-number code."); return; }
    FR.err('Joining…'); try { await FR.libsReady(); } catch (e) { FR.err('No internet connection.'); return; }
    FR.close(); FR.host = false; FR.code = code;
    const peer = new Peer(); FR.peer = peer;
    peer.on('error', (e) => { if (FR.peer !== peer) return; if (fixed && e.type === 'peer-unavailable' && tries < 20) { setTimeout(() => FR.join(fixed, tries + 1), 1500); return; } FR.err(e.type === 'peer-unavailable' ? 'No game with this code. Check the code on your friend\'s phone.' : 'Connection problem. Try again.'); });
    peer.on('open', () => { const conn = peer.connect('fugio-tennis-' + code, { reliable: true }); FR.conn = conn; FR.wire(conn); conn.on('open', () => conn.send({ t: 'hello', name: nm })); });
  },
  wire(conn) {
    conn.on('data', (m) => { if (m && typeof m === 'object') FR.msg(m, true); });
    conn.on('close', () => { if (FR.conn !== conn) return; const was = FR.on || !$('friend').classList.contains('hidden'); FR.close(); if (was) { banner('YOUR FRIEND LEFT', ''); setTimeout(() => FR.back(), 1800); } });
  },
  send(m) { try { if (FR.conn && FR.conn.open) FR.conn.send(m); } catch (e) {} },
  // the referee: to the friend and to this phone
  cast(m) { FR.send(m); FR.apply(m); },
  msg(m, remote) {
    if (m.t === 'full') { FR.err('That game already has two players.'); return; }
    if (FR.host && remote) {
      if (m.t === 'hello') { FR.names.g = String(m.name || 'Friend').slice(0, 12); $('fWait').textContent = `${FR.names.g} joined!`; setTimeout(() => FR.startMatch(), 700); return; }
      if (m.t === 'ans') { FR.resolve('g', m.id, +m.k, +m.ms); return; }
      if (m.t === 'again') { FR.startMatch(); return; }
      return;
    }
    FR.apply(m);
  },
  startMatch() {
    Object.assign(FR, { pts: [0, 0], gms: [0, 0], server: 'h', rally: 0, n: 0 });
    FR.cast({ t: 'begin', names: FR.names, games: FR.games });
    setTimeout(() => FR.serveNext(), 1600);
  },
  serveNext() { if (!FR.on) return; FR.rally = 0; FR.askTurn(FR.server, true); },
  askTurn(who, serve) {
    if (!FR.on) return;
    const q = FSQ.make(PACKS, packIds, { n: 3, count: FR.n++ }); if (!q) return;
    const secs = Math.max(6, 12 - FR.rally * 0.8), id = (FR.turn ? FR.turn.id : 0) + 1;
    FR.turn = { who, q, id, done: false };
    FR.cast({ t: 'ask', who, q, secs, serve, id });
    clearTimeout(FR.tmo); FR.tmo = setTimeout(() => FR.resolve(who, id, -1, Infinity), secs * 1000 + 900);
  },
  resolve(who, id, k, ms) {
    const T = FR.turn; if (!T || T.id !== id || T.done || T.who !== who) return;
    T.done = true; clearTimeout(FR.tmo);
    const ok = k === T.q.correct;
    FR.cast({ t: 'hit', who, k: k >= 0 && k < 3 ? k : -1, ok, right: T.q.right, ms: Math.round(Math.min(ms, 99999)) });
    if (ok) { FR.rally++; setTimeout(() => FR.askTurn(who === 'h' ? 'g' : 'h', false), 1300); }
    else setTimeout(() => FR.point(who === 'h' ? 'g' : 'h'), k < 0 ? 2300 : 1700);
  },
  point(w) {
    if (!FR.on) return;
    const i = w === 'h' ? 0 : 1; FR.pts[i]++;
    let label, game = false;
    if (FR.pts[i] >= 4) { game = true; FR.gms[i]++; FR.pts = [0, 0]; FR.server = FR.server === 'h' ? 'g' : 'h'; label = `GAME ${FR.names[w].toUpperCase()}`; }
    else label = FR.pts[0] === 3 && FR.pts[1] === 3 ? 'DEUCE' : `${CALL[FR.pts[0]]} – ${CALL[FR.pts[1]]}`;
    const over = FR.gms[i] >= FR.games;
    FR.cast({ t: 'point', w, label, game, pts: FR.pts.slice(), gms: FR.gms.slice() });
    if (over) setTimeout(() => FR.cast({ t: 'end', w, gms: FR.gms.slice() }), 2200);
    else setTimeout(() => FR.serveNext(), game ? 2600 : 2200);
  },
  // both phones: show what the referee says
  apply(m) {
    const me = FR.me(), them = FR.them();
    if (m.t === 'begin') {
      FR.on = true; FR.names = m.names; FR.games = m.games; Object.assign(FR, { right: 0, asked: 0, missed: [] }); combo = 0; renderCombo();
      $('friend').classList.add('hidden'); $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
      setOpponent('fox').then(() => { COURT.setNames('YOU', FR.names[them], '#8f52d9', '#ff7d22', true); P.a.tag.style.display = 'none'; });
      COURT.pointN = 0; COURT.resetForServe(FR.loc('h'));
      FR.scoreLine([0, 0], [0, 0]);
      banner(`YOU vs ${FR.names[them].toUpperCase()}`, `first to ${m.games} game${m.games > 1 ? 's' : ''}`); sfx.whistle && sfx.whistle();
      return;
    }
    if (!FR.on) return;
    if (m.t === 'ask') {
      const mine = m.who === me;
      COURT.ask(FR.loc(m.who), m.q, m.secs, m.serve);
      $('labels').classList.toggle('theirs', !mine);
      FR.my = mine ? { id: m.id, q: m.q, t0: performance.now(), done: false } : null; if (mine) FR.lastQ = m.q;
      if (!mine) $('cardWho').innerHTML = `${esc(FR.names[them].toUpperCase())}'S SHOT · watch!`;
    }
    if (m.t === 'hit') {
      COURT.hit(FR.loc(m.who), m.k, m.ok, m.right);
      if (m.who === me) { FR.asked++; if (m.ok) FR.right++; else if (FR.lastQ) FR.missed.push(FR.lastQ); juice(m.ok, m.ms, m.k); }
      else if (m.ok && bubbles[m.k] && bubbles[m.k].mesh.visible) BURST.emit(bubbles[m.k].mesh.position.clone(), 20, CSS_TINTS[m.k], 5);
    }
    if (m.t === 'point') {
      COURT.point(FR.loc(m.w), m.label, m.game ? `games ${FR.mine(m.gms)}` : '');
      if (m.w !== me) setTimeout(() => sfx.aww && sfx.aww(), 200);
      FR.scoreLine(m.pts, m.gms);
    }
    if (m.t === 'end') { FR.finish(m.w === me, m.gms); }
  },
  mine(arr) { return FR.host ? `${arr[0]}–${arr[1]}` : `${arr[1]}–${arr[0]}`; },
  scoreLine(pts, gms) {
    const a = FR.host ? pts[0] : pts[1], b = FR.host ? pts[1] : pts[0], ga = FR.host ? gms[0] : gms[1], gb = FR.host ? gms[1] : gms[0], th = FR.names[FR.them()] || 'FRIEND';
    setScore(`YOU <b>${CALL[Math.min(3, a)]} : ${CALL[Math.min(3, b)]}</b> ${esc(th.toUpperCase())} · <b>${ga}–${gb}</b>`);
    Object.assign(SCREEN, { a: (FR.names[FR.me()] || 'YOU').toUpperCase(), b: th.toUpperCase(), pts: `${CALL[Math.min(3, a)]} : ${CALL[Math.min(3, b)]}`, games: `${ga} – ${gb}` }); drawScreen();
  },
  tap(k) {
    const M = FR.my; if (!M || M.done) return; M.done = true; FR.lastQ = M.q;
    const ms = performance.now() - M.t0; sfx.pick && sfx.pick();
    if (FR.host) FR.resolve('h', M.id, k, ms); else FR.send({ t: 'ans', id: M.id, k, ms: Math.round(ms) });
  },
  finish(won, gms) {
    FR.on = false; FR.my = null;
    $('hud').classList.add('hidden'); bubbles.forEach((b) => { b.mesh.visible = false; }); labelEls.forEach((l) => { l.style.opacity = '0'; });
    const ga = FR.host ? gms[0] : gms[1], gb = FR.host ? gms[1] : gms[0], th = FR.names[FR.them()];
    $('endTitle').textContent = won ? 'You won!' : `${th} won!`;
    $('endGames').textContent = `${ga} – ${gb}`;
    $('endLine').textContent = `${FR.right} of ${FR.asked} answers right`;
    const stars = won ? (gb === 0 ? 3 : 2) : ga > 0 ? 1 : 0;
    const st = [...document.querySelectorAll('#stars i')]; st.forEach((e) => e.classList.remove('on')); st.forEach((e, i) => { if (i < stars) setTimeout(() => { e.classList.add('on'); sfx.star && sfx.star(i); }, 500 + i * 300); });
    const list = $('missedList'); list.innerHTML = FR.missed.slice(-6).map((q) => `<li>${hints(q.before)}<b>${esc(q.right)}</b>${hints(q.after)}</li>`).join('');
    $('missed').classList.toggle('hidden', !FR.missed.length);
    $('againBtn').textContent = 'REMATCH';
    $('end').classList.remove('hidden');
    if (won) { CROWD.cheer = 1; confetti(); P.a.mood = 'cheer'; P.a.moodT = -2; }
    if (LIST && window.parent !== window) window.parent.postMessage({ ft: 'finished', won, games: [ga, gb], right: FR.right, asked: FR.asked, friend: true }, '*');
  },
};

function renderStart() {
  const ps = packIds.map((id) => PACKS.find((p) => p.id === id)).filter(Boolean);
  const label = (p) => (window.FugioPacks && FugioPacks.label ? FugioPacks.label(p) : p.level);
  $('packBtn').innerHTML = ps.length ? `${esc(ps.length > 1 ? `${ps.length} packages` : ps[0].title)}<small>${esc(ps.map(label).join(' · '))} · change the words ›</small>` : 'Choose the words ›';
  $('lenSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === gamesToWin));
  const best = store.get('tennis-best', { wins: 0 }); $('bestLine').textContent = best.wins ? `You have beaten Rob ${best.wins} time${best.wins > 1 ? 's' : ''}!` : '';
}
$('playBtn').onclick = () => SOLO.start();
$('againBtn').onclick = () => { if (FR.conn && FR.conn.open) { if (FR.host) FR.startMatch(); else { FR.send({ t: 'again' }); $('endTitle').textContent = 'Waiting for your friend…'; } } else SOLO.start(); };
$('menuBtn').onclick = () => { if (FR.conn) { FR.back(); return; } sfx.click && sfx.click(); $('end').classList.add('hidden'); $('start').classList.remove('hidden'); };
$('friendBtn').onclick = () => { sfx.click && sfx.click(); FR.open(); };
$('fCreate').onclick = () => FR.create();
$('fJoin').onclick = () => FR.join();
$('fBack').onclick = () => FR.back();
$('fCode').addEventListener('input', (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; });
$('lenSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; gamesToWin = +b.dataset.v; store.set('tennis-len', gamesToWin); renderStart(); });
$('packBtn').onclick = async () => { if (!window.FugioPacks) return; const ids = await FugioPacks.open(PACKS, packIds, { theme: 'gummy' }); if (ids && ids.length) { packIds = ids; store.set('tennis-packs', ids); renderStart(); } };
$('leaveBtn').onclick = () => { sfx.click && sfx.click(); FR.close(); if (/[?&]from=sports/.test(location.search)) { location.href = '/sports/'; return; } if (window.parent !== window) window.parent.postMessage({ fugio: 'leave' }, '*'); else location.href = '/'; };
const muteBtn = $('muteBtn'); muteBtn.classList.toggle('muted', isMuted()); muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); muteBtn.classList.toggle('muted', isMuted()); };

// ---------- the teacher's page ----------
if (REMOTE) addEventListener('message', (e) => {
  const m = e.data; if (!m || typeof m !== 'object' || !m.ft) return;
  if (RSLOT === 0) unlock();
  if (m.ft === 'match') { COURT.setNames(m.a.name, m.b.name, m.a.c, m.b.c, true); if (P.a.ch) P.a.ch.setKit({ shirt: '#ffffff', trim: m.a.c, shorts: m.a.c, socks: '#ffffff', boots: '#f4f4f4' }); COURT.pointN = 0; COURT.resetForServe('a'); $('hud').classList.add('hidden'); setScore(''); Object.assign(SCREEN, { a: m.a.name.toUpperCase(), b: m.b.name.toUpperCase(), pts: '0 : 0', games: '0 – 0' }); drawScreen(); }
  if (m.ft === 'ask') COURT.ask(m.who, m.q, m.secs, m.serve);
  if (m.ft === 'hit') COURT.hit(m.who, m.k, m.ok, m.right);
  if (m.ft === 'point') { COURT.point(m.w, m.label, m.game ? `games ${m.games[0]}–${m.games[1]}` : ''); Object.assign(SCREEN, { pts: `${CALL[Math.min(3, m.pts[0])]} : ${CALL[Math.min(3, m.pts[1])]}`, games: `${m.games[0]} – ${m.games[1]}` }); drawScreen(); }
  if (m.ft === 'end') { banner(`${COURT.names[m.w]} WINS!`, ''); CROWD.cheer = 1; }
  if (m.ft === 'idle') COURT.idle();
});

// ---------- confetti ----------
function confetti() {
  const cv = $('confetti'), g = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const cols = ['#ffcd1c', '#ff5d8f', '#48d8ff', '#66e08a', '#8f52d9'];
  const bits = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 100, vy: 120 + Math.random() * 240, a: Math.random() * 6, va: (Math.random() - 0.5) * 10, c: cols[Math.floor(Math.random() * 5)], s: 6 + Math.random() * 7 }));
  let t0 = performance.now();
  const st = (now) => { const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; g.clearRect(0, 0, W, H); let n = 0;
    for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 160 * dt; b.a += b.va * dt; if (b.y < H + 20) { n++; g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); } }
    if (n) requestAnimationFrame(st); else g.clearRect(0, 0, W, H); };
  requestAnimationFrame(st);
}

// ---------- the camera ----------
// (2026-11-17, the user: "make the tennis game more from behind") low behind Foxino, looking down the court at Rob
const CAMV = { pos: new THREE.Vector3(), look: new THREE.Vector3(), x: 0 };
let SHAKE = 0, FREEZE = 0;
function fitCamera() {
  const a = camera.aspect;
  // (2026-11-17, the user: "make the tennis camera more up close")
  if (a < 0.8) { camera.fov = 60; CAMV.pos.set(0, 4.5, 18.3); CAMV.look.set(0, 0.45, 1.0); CAMV.follow = 0.82; }
  else if (a < 1.25) { camera.fov = 54; CAMV.pos.set(0, 4.5, 18.8); CAMV.look.set(0, 0.6, 0.5); CAMV.follow = 0.72; }
  else { camera.fov = 46; CAMV.pos.set(0, 4.3, 19.2); CAMV.look.set(0, 0.7, 0.0); CAMV.follow = 0.62; }
  camera.updateProjectionMatrix(); placeCamera(0);
}
function placeCamera(dt) {
  const fx = P.a ? clamp(P.a.x, -6, 6) : 0; CAMV.x = dt ? damp(CAMV.x, fx, 2.2, dt) : fx;
  SHAKE = Math.max(0, SHAKE - (dt || 0) * 1.6); const sh = SHAKE * SHAKE * 0.35;
  camera.position.set(CAMV.pos.x + CAMV.x * (CAMV.follow || 0.5) + (Math.random() - 0.5) * sh, CAMV.pos.y + (Math.random() - 0.5) * sh, CAMV.pos.z); camera.lookAt(CAMV.look.x + CAMV.x * (CAMV.follow || 0.5) * 0.5, CAMV.look.y, CAMV.look.z);
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; fitCamera(); BURST.scale(h * pr); }
addEventListener('resize', resize);

// ---------- Christmas (2026-11-24): falling snow, lights on the fences and roofs, snow on the tops of things, the shared props ----------
const XM = { snow: null, lights: [] };
window.FT = { scene, camera, renderer, world };   // (test hook: the frame's triangles, measured by the test page)
async function xmasDress() {
  XM.snow = makeSnowfall({ n: innerWidth * innerHeight < 500000 ? 750 : 1150, box: [24, 14, 30], ahead: 0.5 }); scene.add(XM.snow);
  for (const s of [-1, 1]) XM.lights.push(stringLights(world, [-10, -5, 0, 5, 10].map((x) => new THREE.Vector3(x, 4.15, s * 19.05)), { sag: 0.35, per: 9 }));
  for (const s of [-1, 1]) XM.lights.push(stringLights(world, [-18, -9, 0, 9, 18].map((z) => new THREE.Vector3(s * 11.2, 5.72, z)), { sag: 0.45, per: 10, warm: true }));
  XM.lights.push(stringLights(world, [-4.2, -1.4, 1.4, 4.2].map((x) => new THREE.Vector3(x, 8.6, -27.25)), { sag: 0.15, per: 6 }));   // (along the top of the score screen)
  snowCover(world);
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  if (await loadXmasKit(L)) {   // (the PC's prop kit: until it is in, the court is dressed with snow and lights only)
    for (const s of [-1, 1]) { placeKit(world, 'XmasTree_Big', s * 14.2, -24.6, { rot: s * 0.4 }); placeKit(world, 'XmasTree_Small', s * 10.9, -21.1, { rot: s }); if (placeKit(world, 'Snowman', s * 9.2, -15.5, { rot: -s * 0.5 })) world.children.filter((c) => c.name === 'Snowman-fallback').forEach((c) => world.remove(c));
      placeKit(world, 'Lantern', s * 10.7, -9, { rot: s * Math.PI / 2 }); placeKit(world, 'Lantern', s * 10.7, 9, { rot: s * Math.PI / 2 }); placeKit(world, 'Wreath', s * 4.5, 0, { y: 7.2, rot: 0 })?.position.set(s * 4.55, 7.2, -27.0); }
    placeKit(world, 'Gift_A', 8.5, 0.9, { rot: 0.3 }); placeKit(world, 'Gift_B', 8.9, 0.2, { rot: -0.4 }); placeKit(world, 'Gift_C', 8.4, -0.7, { rot: 0.9 });
    placeKit(world, 'Sleigh', -15.5, -21.5, { rot: 0.6 }); placeKit(world, 'SnowDrift_A', 13.5, -19.6); placeKit(world, 'SnowDrift_B', -12.8, 19.8, { rot: 2 });
    snowCover(world); }
}

// ---------- the loop ----------
let last = performance.now(), T = 0, slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  const bdt = FREEZE > 0 ? 0 : dt; FREEZE = Math.max(0, FREEZE - dt);
  updatePlayers(dt, T); updateBall(bdt, T); updateBubbles(dt, T); updateCrowd(T, dt); BURST.update(dt); placeCamera(dt);
  if (XM.snow) XM.snow.update(T, camera, pr); for (const l of XM.lights) l.update(T);
  POSTFX.draw(scene, camera, 30);
  updateLabels();
  if (POSTFX.governor(dt) && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); }
}
(async () => {
  resize();
  if (document.fonts) await document.fonts.load('40px "Lilita One"').catch(() => {});
  $('loadFill').style.width = '30%';
  buildCourt();
  $('loadText').textContent = 'Calling the players…'; $('loadFill').style.width = '60%';
  await Promise.all([makePlayers(), loadTrees().catch(() => {})]); await xmasDress().catch((e) => console.warn('xmas', e));
  COURT.resetForServe('a');
  $('loadFill').style.width = '100%';
  requestAnimationFrame(frame);
  setTimeout(() => $('loading').classList.add('gone'), 150);
  if (REMOTE) post({ ft: 'ready' }); else { renderStart(); const jc = (new URLSearchParams(location.search).get('join') || '').replace(/\D/g, '');
    if (LIST) { const fm = LP.get('friend'), room = LP.get('room'); FR.fixedName = (LP.get('name') || 'Player').slice(0, 12);
      if (fm && room) { try { await FR.libsReady(); } catch (e) {} if (fm === 'host') FR.create(room); else FR.join(room); } else SOLO.start(); }
    else if (jc.length === 6) FR.open(jc); else $('start').classList.remove('hidden'); }
  window.TN = { COURT, SOLO, FR, B, P, renderer, scene, THREE, POSTFX, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls }) };
})();
