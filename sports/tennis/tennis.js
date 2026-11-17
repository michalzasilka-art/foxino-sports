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

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const REMOTE = /[?&]remote=1/.test(location.search), RSLOT = +(new URLSearchParams(location.search).get('slot') || 0);
if (REMOTE) document.body.classList.add('remote');
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
scene.fog = new THREE.Fog(0xcbeaf5, 70, 170);
const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 600);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: new THREE.Vector3(-0.4, 0.62, -0.68).normalize() } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
  fragmentShader: `varying vec3 vD; uniform vec3 uSun; void main(){ float h = clamp(vD.y, -0.2, 1.0);
    vec3 c = mix(vec3(0.80,0.93,0.97), vec3(0.47,0.77,0.97), smoothstep(0.0, 0.25, h)); c = mix(c, vec3(0.17,0.48,0.90), smoothstep(0.25, 0.9, h));
    float s = max(dot(normalize(vD), uSun), 0.0); c += vec3(1.0,0.93,0.75) * (pow(s, 500.0) * 3.0 + pow(s, 10.0) * 0.22); gl_FragColor = vec4(c, 1.0); }` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); scene.add(sky);
{ const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat)); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }
scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x5c8a4a, 0.85));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
sun.position.set(-14, 26, -12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);

// ---------- the court ----------
function courtTexture() {
  const W = 1024, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sx = W / 20, sz = H / 38;   // the texture covers 20 m × 38 m
  g.fillStyle = '#3e9a5b'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2f6fc4'; g.fillRect(W / 2 - 8.5 * sx, H / 2 - 17 * sz, 17 * sx, 34 * sz);
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0x5aa84a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; world.add(ground);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(20, 38), new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.75 }));
  court.rotation.x = -Math.PI / 2; court.receiveShadow = true; world.add(court);
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
  bg.fillStyle = '#5b2bb0'; bg.fillRect(0, 0, 1024, 64); bg.font = '400 40px "Lilita One", sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle';
  words.forEach((w, i) => { bg.fillStyle = i % 2 ? '#ffcd1c' : '#ffffff'; bg.fillText(w, 102 + i * 205, 34); });
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
  CROWD.seats = seats;
  const bodyG = new THREE.CapsuleGeometry(0.2, 0.35, 2, 6), headG = new THREE.SphereGeometry(0.17, 7, 5);
  CROWD.body = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), seats.length);
  CROWD.head = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), seats.length);
  const cols = ['#ff5d8f', '#ffb703', '#3ab0ff', '#2fbf6a', '#8f52d9', '#ff7d22', '#ffffff', '#e8403a', '#5a6bff'], skin = ['#f2c9a0', '#d9a074', '#9c6a44', '#ffd9b8', '#c68642'];
  seats.forEach((q, i) => { CROWD.body.setColorAt(i, new THREE.Color(cols[i % cols.length])); CROWD.head.setColorAt(i, new THREE.Color(skin[(i * 7) % skin.length])); });
  world.add(CROWD.body, CROWD.head);
  // the umpire's chair
  const chair = new THREE.Group(); const cm = new THREE.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.6 });
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), cm); l.position.set(x, 1, z); chair.add(l); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.8), cm); seat.position.y = 2; chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), standM2); back.position.set(0.0, 2.4, 0); back.rotation.y = Math.PI / 2; back.position.x = 0.4; chair.add(back);
  chair.position.set(7.6, 0, 0); chair.traverse((o) => { if (o.isMesh) o.castShadow = true; }); world.add(chair);
}
const CROWD = { seats: [], body: null, head: null, cheer: 0 };
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3(1, 1, 1), _v4 = new THREE.Vector3();
function updateCrowd(t, dt) {
  if (!CROWD.body) return;
  CROWD.cheer = Math.max(0, CROWD.cheer - dt * 0.5);
  CROWD.seats.forEach((q, i) => {
    const hop = Math.max(0, Math.sin(t * 9 + q.ph)) * 0.25 * CROWD.cheer + Math.sin(t * 2 + q.ph) * 0.02;
    _v4.set(q.x, q.y + 0.38 + hop, q.z); _m4.compose(_v4, _q4, _s4); CROWD.body.setMatrixAt(i, _m4);
    _v4.y += 0.42; _m4.compose(_v4, _q4, _s4); CROWD.head.setMatrixAt(i, _m4);
  });
  CROWD.body.instanceMatrix.needsUpdate = true; CROWD.head.instanceMatrix.needsUpdate = true;
}
// trees around (the Adventures jungle models)
async function loadTrees() {
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  const files = ['nature-tall', 'nature-tall-2', 'nature-pine', 'nature-palm', 'nature-palm-2'];
  const protos = (await Promise.all(files.map((f) => L.loadAsync(`/adventures/models/${f}.glb?v=1`).catch(() => null)))).filter(Boolean).map((g) => {
    g.scene.updateMatrixWorld(true); let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    const box = new THREE.Box3().setFromObject(g.scene), h = box.max.y - box.min.y || 1;
    const base = new THREE.Matrix4().makeTranslation(0, -box.min.y / h, 0).multiply(new THREE.Matrix4().makeScale(1 / h, 1 / h, 1 / h)).multiply(mesh.matrixWorld);
    if (mesh.material.map) mesh.material.map.colorSpace = THREE.SRGBColorSpace;
    return { mesh, base, places: [] };
  });
  if (!protos.length) return;
  for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2 + rand(-0.04, 0.04), r = rand(26, 46); const x = Math.cos(a) * r * 1.0, z = Math.sin(a) * r * 1.25; if (Math.abs(x) < 20 && Math.abs(z) < 24) continue; protos[i % protos.length].places.push([x, z, rand(6, 12), rand(0, 6)]); }
  for (const p of protos) {
    const im = new THREE.InstancedMesh(p.mesh.geometry, p.mesh.material, Math.max(1, p.places.length)); im.castShadow = false;
    p.places.forEach(([x, z, h, r], i) => { _q4.setFromEuler(new THREE.Euler(0, r, 0)); _m4.compose(new THREE.Vector3(x, 0, z), _q4, new THREE.Vector3(h, h, h)).multiply(p.base); im.setMatrixAt(i, _m4); });
    world.add(im);
  }
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
const bubbles = TINTS.map((c) => { const b = makeBubble(c); b.mesh.visible = false; b.mesh.scale.setScalar(0.62); scene.add(b.mesh); return Object.assign(b, { k: 0, x: 0, y: 0, z: 0, state: 'off', t: 0 }); });
const labelEls = CSS_TINTS.map((c, k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'blabel'; b.style.setProperty('--c', c); b.innerHTML = '<span></span>';
  b.addEventListener('click', (e) => { e.preventDefault(); unlock(); SOLO.tap(k); });
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
async function makePlayers(kitA) {
  const fox = await loadFoxino().catch(() => null);
  if (fox) { fox.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); fox.root.rotation.y = Math.PI; scene.add(fox.root); fox.setKit(kitA || { shirt: '#ffffff', trim: '#8f52d9', shorts: '#8f52d9', socks: '#ffffff', boots: '#f4f4f4' }); }
  const rob = makeRob(); rob.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(rob.root);
  P.a = { w: 'a', ch: fox, x: 0, z: HALF_L + 0.6, tx: 0, tz: HALF_L + 0.6, swing: -1, mood: '', moodT: 0, racket: makeRacket(0x8f52d9), tag: null };
  P.b = { w: 'b', ch: rob, x: 0, z: -HALF_L - 0.6, tx: 0, tz: -HALF_L - 0.6, swing: -1, mood: '', moodT: 0, racket: makeRacket(0x3cc6ef), tag: null };
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
    if (w === 'a') {
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
    if (w === 'a') { const bn = p.ch.bones || {}; if (bn.RightHand && bn.RightForeArm) { hand = bn.RightHand.getWorldPosition(new THREE.Vector3()); elbow = bn.RightForeArm.getWorldPosition(new THREE.Vector3()); } }
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
  popBubbles(k, ok);
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
  const s = side(w); labelGen++;
  words.forEach((wd, k) => {
    const b = bubbles[k]; if (!b) return;
    Object.assign(b, { x: BUB_X[k], y: (s > 0 ? 1.7 : 1.25) + (k === 1 ? 0.35 : 0), z: s * (s > 0 ? 5.6 : 4.6), state: 'in', t: -k * 0.1 });
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
function revealRight(k) { if (labelEls[k]) { labelEls[k].classList.remove('wrong'); labelEls[k].classList.add('right'); } if (bubbles[k]) { bubbles[k].u.uGlow.value = 1; } }
function updateBubbles(dt, t) {
  for (const b of bubbles) {
    if (!b.mesh.visible) continue;
    b.t += dt; b.u.uTime.value = t;
    if (b.state === 'in') { const s = 0.62 * smooth(b.t / 0.35); b.mesh.scale.setScalar(Math.max(0.001, s)); }
    if (b.state === 'pop') { b.mesh.scale.setScalar(0.62 * (1 + b.t * 2)); b.u.uAlpha.value = Math.max(0, 1 - b.t * 3); if (b.t > 0.35) { b.mesh.visible = false; b.state = 'off'; } }
    if (b.state === 'fade') { b.u.uAlpha.value = Math.max(0, 1 - b.t * 2); if (b.t > 0.5) { b.mesh.visible = false; b.state = 'off'; } }
    b.mesh.position.set(b.x, b.y + Math.sin(t * 2 + b.x) * 0.06, b.z);
  }
}
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  bubbles.forEach((b, k) => {
    const l = labelEls[k]; if (!b.mesh.visible) return;
    _v4.copy(b.mesh.position).project(camera);
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
    if (B.mode === 'hold' && B.holder === w) { tossServe(w, k, ok); }
    else if (B.mode === 'fly' && B.to === w) { if (k < 0) { B.missed = true; B.pending = null; } else B.pending = { w, k, ok }; }
    else if (B.mode === 'fly' && B.to && B.to !== w) B.queued = { w, k, ok };
    else if (k >= 0) doHit(w, k, ok);
    if (q) { if (!ok) setTimeout(() => revealRight(q.correct), 350); cardResult(ok, k, q, right); }
    timerStop();
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
    Object.assign(SOLO, { on: true, pts: [0, 0], games: [0, 0], server: 'a', rally: 0, right: 0, asked: 0, missed: [] });
    $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
    COURT.setNames('YOU', 'ROB', '#8f52d9', '#23a6d4', false); COURT.pointN = 0;
    SOLO.score(); sfx.whistle && sfx.whistle();
    setTimeout(() => SOLO.serve(), 700);
  },
  score() { const [a, b] = SOLO.pts, [ga, gb] = SOLO.games; setScore(`YOU <b>${a === 3 && b === 3 ? '40 : 40' : CALL[Math.min(3, a)] + ' : ' + CALL[Math.min(3, b)]}</b> ROB · <b>${ga}–${gb}</b>`); },
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
$('againBtn').onclick = () => SOLO.start();
$('menuBtn').onclick = () => { sfx.click && sfx.click(); $('end').classList.add('hidden'); $('start').classList.remove('hidden'); };
$('lenSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; gamesToWin = +b.dataset.v; store.set('tennis-len', gamesToWin); renderStart(); });
$('packBtn').onclick = async () => { if (!window.FugioPacks) return; const ids = await FugioPacks.open(PACKS, packIds, { theme: 'gummy' }); if (ids && ids.length) { packIds = ids; store.set('tennis-packs', ids); renderStart(); } };
$('leaveBtn').onclick = () => { sfx.click && sfx.click(); if (window.parent !== window) window.parent.postMessage({ fugio: 'leave' }, '*'); else location.href = '/'; };
const muteBtn = $('muteBtn'); muteBtn.classList.toggle('muted', isMuted()); muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); muteBtn.classList.toggle('muted', isMuted()); };

// ---------- the teacher's page ----------
if (REMOTE) addEventListener('message', (e) => {
  const m = e.data; if (!m || typeof m !== 'object' || !m.ft) return;
  if (RSLOT === 0) unlock();
  if (m.ft === 'match') { COURT.setNames(m.a.name, m.b.name, m.a.c, m.b.c, true); if (P.a.ch) P.a.ch.setKit({ shirt: '#ffffff', trim: m.a.c, shorts: m.a.c, socks: '#ffffff', boots: '#f4f4f4' }); COURT.pointN = 0; COURT.resetForServe('a'); $('hud').classList.add('hidden'); setScore(''); }
  if (m.ft === 'ask') COURT.ask(m.who, m.q, m.secs, m.serve);
  if (m.ft === 'hit') COURT.hit(m.who, m.k, m.ok, m.right);
  if (m.ft === 'point') { COURT.point(m.w, m.label, m.game ? `games ${m.games[0]}–${m.games[1]}` : ''); }
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
function fitCamera() {
  const a = camera.aspect;
  if (a < 0.8) { camera.fov = 58; camera.position.set(0, 11.2, 23.2); camera.lookAt(0, 0, -1.6); }
  else if (a < 1.25) { camera.fov = 54; camera.position.set(0, 12.5, 25.5); camera.lookAt(0, 0, 0.2); }
  else { camera.fov = 44; camera.position.set(0, 10.5, 24.5); camera.lookAt(0, 0, 0.4); }
  camera.updateProjectionMatrix();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; fitCamera(); }
addEventListener('resize', resize);

// ---------- the loop ----------
let last = performance.now(), T = 0, slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  updatePlayers(dt, T); updateBall(dt, T); updateBubbles(dt, T); updateCrowd(T, dt);
  renderer.render(scene, camera);
  updateLabels();
  frames++; if (dt > 1 / 35) slow++;
  if (frames >= 120) { if (slow > 60 && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); } frames = 0; slow = 0; }
}
(async () => {
  resize();
  if (document.fonts) await document.fonts.load('40px "Lilita One"').catch(() => {});
  $('loadFill').style.width = '30%';
  buildCourt();
  $('loadText').textContent = 'Calling the players…'; $('loadFill').style.width = '60%';
  await Promise.all([makePlayers(), loadTrees().catch(() => {})]);
  COURT.resetForServe('a');
  $('loadFill').style.width = '100%';
  requestAnimationFrame(frame);
  setTimeout(() => $('loading').classList.add('gone'), 150);
  if (REMOTE) post({ ft: 'ready' }); else { renderStart(); $('start').classList.remove('hidden'); }
  window.TN = { COURT, SOLO, B, P, renderer, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls }) };
})();
