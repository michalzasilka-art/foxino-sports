// River Raft (Foxino Sports): the teams race their rafts down a jungle river. Every question three floating gates (A, B, C)
// drift up to each raft; the team's most-voted word steers it through one: the right one gives a boost (bigger when the team
// answered fast and together), a wrong one is a rock bump and a spin. The teacher's page (../index.html) drives it with
// postMessage ({fr: 'setup' | 'teams' | 'go' | 'q' | 'votes' | 'resolve'}); it answers 'ready', 'resolved' and 'finish'.
// Without ?remote=1 it plays a demo race with bot teams.
import * as THREE from '/penalty/lib/three.module.min.js';
import { GLTFLoader } from '/penalty/lib/GLTFLoader.js';
import { MeshoptDecoder } from '/adventures/lib/meshopt_decoder.module.js';
import { loadFoxino } from '/penalty/foxino-glb.js?v=3';
import { POSES, blankPose } from '/penalty/foxino.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const REMOTE = /[?&]remote=1/.test(location.search);
const OPT_C = ['#ff8fc4', '#ffd84a', '#6fe2ff'], LETTERS = ['A', 'B', 'C'];
const LANE = 8.6, MAXT = 4, W = MAXT * LANE + 10, V0 = 3.4, GATE_X = [-2.9, 0, 2.9], RS = 1.45;
let LEN = 640;
const post = (m) => { if (REMOTE && window.parent !== window) window.parent.postMessage(m, '*'); };

// ---------- renderer, scene, camera ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0xc4e9f2);
scene.fog = new THREE.Fog(FOG, 150, 430);
const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.5, 900);

// the sky: a gradient dome with a soft sun
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: new THREE.Vector3(0.45, 0.62, -0.64).normalize() } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
  fragmentShader: `varying vec3 vD; uniform vec3 uSun;
    void main(){ float h = clamp(vD.y, -0.2, 1.0);
      vec3 top = vec3(0.16,0.50,0.92), mid = vec3(0.50,0.80,0.98), hor = vec3(0.80,0.94,0.97);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.2, 0.85, h));
      float s = max(dot(normalize(vD), uSun), 0.0); c += vec3(1.0,0.92,0.7) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);
// fluffy clouds: billboards with a soft round texture
const cloudTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) { const x = 40 + Math.random() * 176, y = 60 + Math.random() * 30, r = 26 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const clouds = new THREE.Group(); scene.add(clouds);
for (let i = 0; i < 16; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 })); m.scale.set(120 + Math.random() * 90, 50 + Math.random() * 30, 1); m.position.set((Math.random() - 0.5) * 700, 110 + Math.random() * 70, -Math.random() * 900 + 100); clouds.add(m); }

const hemi = new THREE.HemisphereLight(0xe2f5ff, 0x4f7a3a, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 1.9);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
// the environment for the water's reflections: the sky itself
{ const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat)); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }

// ---------- the river's path ----------
const cx = (s) => 13 * Math.sin(s * 0.011) + 7 * Math.sin(s * 0.027 + 1.3);
const dcx = (s) => 13 * 0.011 * Math.cos(s * 0.011) + 7 * 0.027 * Math.cos(s * 0.027 + 1.3);
function at(s, off, out = new THREE.Vector3()) { const a = dcx(s), k = 1 / Math.hypot(1, a); return out.set(cx(s) + off * k, 0, -s + off * a * k); }
const heading = (s) => -Math.atan(dcx(s));   // the yaw that turns -z (a raft's front) downstream
const S0 = -80, S1 = () => LEN + 220;

// noise for the banks
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
const bankY = (d, s) => -0.5 + 1.5 * smooth(d / 5) + 5.5 * smooth((d - 9) / 50) + (vnoise(s * 0.05, d * 0.12) - 0.5) * 2.4 * smooth(d / 8) + (vnoise(s * 0.2, d * 0.4) - 0.5) * 0.5;

let world = null, water = null;
// (every triangle of the ground strips faces up: the order is turned round where the first one faces down)
function upIndex(P, I) {
  const a = I[0] * 3, b = I[1] * 3, c = I[2] * 3, ux = P[b] - P[a], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vz = P[c + 2] - P[a + 2];
  if (uz * vx - ux * vz < 0) for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
  return I;
}
const waterU = { uTime: { value: 0 } };
function buildWorld() {
  if (world) { scene.remove(world); world.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  // the water: a strip along the path with a flowing foam shader
  const segS = Math.ceil((S1() - S0) / 2), segX = 12, pos = [], ruv = [], idx = [], v = new THREE.Vector3();
  for (let i = 0; i <= segS; i++) { const s = S0 + i * 2; for (let j = 0; j <= segX; j++) { const u = j / segX; at(s, (u - 0.5) * (W + 2), v); pos.push(v.x, 0, v.z); ruv.push(u, s); } }
  for (let i = 0; i < segS; i++) for (let j = 0; j < segX; j++) { const a = i * (segX + 1) + j, b = a + segX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('rUv', new THREE.Float32BufferAttribute(ruv, 2)); wg.setIndex(upIndex(pos, idx)); wg.computeVertexNormals();
  const wm = new THREE.MeshStandardMaterial({ color: 0x2bb5c9, roughness: 0.2, metalness: 0, envMapIntensity: 0.3 });
  wm.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 rUv; varying vec2 vRiverUv; uniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRiverUv = rUv; transformed.y += 0.07 * sin(rUv.y * 0.8 - uTime * 2.2 + rUv.x * 11.0) + 0.04 * sin(rUv.y * 2.3 + uTime * 1.3);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vRiverUv; uniform float uTime;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float u = vRiverUv.x, v = vRiverUv.y;
        float centre = smoothstep(0.0, 0.32, u) * smoothstep(1.0, 0.68, u);
        vec3 col = mix(vec3(0.16, 0.66, 0.62), vec3(0.01, 0.30, 0.46), centre);
        float n = vn(vec2(u * 34.0, v * 0.12 - uTime * 0.55)) * 0.6 + vn(vec2(u * 80.0, v * 0.35 - uTime * 1.1)) * 0.4;
        float streak = smoothstep(0.8, 0.95, n);
        float edge = 1.0 - smoothstep(0.0, 0.04, min(u, 1.0 - u)); edge *= 0.55 + 0.45 * vn(vec2(v * 0.7 - uTime * 1.1, u * 40.0));
        col = mix(col, vec3(0.93, 0.99, 1.0), clamp(streak * 0.32 + edge * 0.85, 0.0, 1.0));
        diffuseColor.rgb = col; }`);
  };
  water = new THREE.Mesh(wg, wm); water.receiveShadow = true; world.add(water);
  // the banks: vertex-coloured low-poly ground, sand by the water then grass
  const sand = new THREE.Color(0xe7d29a), g1 = new THREE.Color(0x5fae3e), g2 = new THREE.Color(0x3f8f35), g3 = new THREE.Color(0x7cc251), tmp = new THREE.Color();
  for (const side of [-1, 1]) {
    const nS = Math.ceil((S1() - S0) / 3), nD = 16, P = [], C = [], I = [];
    for (let i = 0; i <= nS; i++) { const s = S0 + i * 3; for (let j = 0; j <= nD; j++) { const d = Math.pow(j / nD, 1.6) * 90 - 1.5;
      at(s, side * (W / 2 + d), v); P.push(v.x, bankY(d, s + side * 50), v.z);
      const n = vnoise(s * 0.08, d * 0.1); tmp.copy(d < 3.2 ? sand : n < 0.33 ? g1 : n < 0.66 ? g2 : g3); if (d >= 3.2 && d < 5) tmp.lerp(sand, 0.4); C.push(tmp.r, tmp.g, tmp.b); } }
    for (let i = 0; i < nS; i++) for (let j = 0; j < nD; j++) { const a = i * (nD + 1) + j, b = a + nD + 1; if (side > 0) I.push(a, b, a + 1, b, b + 1, a + 1); else I.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(upIndex(P, I));
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    const m = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); m.receiveShadow = true; world.add(m);
  }
  // far hills
  const hm = new THREE.MeshStandardMaterial({ color: 0x4f9a52, roughness: 1, flatShading: true });
  for (let s = S0; s < S1() + 200; s += 55) for (const side of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(38 + hash(s, side) * 40, 30 + hash(side, s) * 45, 7, 1), hm);
    at(s + hash(s, 3) * 30, side * (W / 2 + 95 + hash(s, side * 7) * 80), h.position); h.position.y = 4; h.rotation.y = hash(s, 9) * 6; world.add(h);
  }
  // the START and FINISH arches
  world.add(arch(0, 'START', false), arch(LEN, 'FINISH', true));
}
function arch(s, text, chk) {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 });
  const half = W / 2 + 1.5;
  for (const side of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 8, 8), wood); p.position.set(side * half, 3, 0); p.castShadow = true; g.add(p); }
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d');
  if (chk) { for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 32, j * 32, 32, 32); } x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(300, 0, 424, 128); }
  else { x.fillStyle = '#ffcd1c'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#ff7d22'; for (let i = 0; i < 1024; i += 64) x.fillRect(i, 0, 32, 128); x.fillStyle = 'rgba(91,43,176,.9)'; x.fillRect(320, 0, 384, 128); }
  x.font = '400 96px "Lilita One", Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(text, 512, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const b = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1, 2.4, 0.4), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })]);
  b.position.y = 6.6; b.castShadow = true; g.add(b);
  at(s, 0, g.position); g.rotation.y = heading(s);
  return g;
}

// ---------- the bank plants and rocks (the Adventures jungle models), drawn as instances near the camera ----------
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const KINDS = {
  palm: { files: ['nature-palm', 'nature-palm-2'], h: [7, 11] }, tree: { files: ['nature-tall', 'nature-tall-2', 'nature-round', 'nature-round-2'], h: [8, 13] },
  banana: { files: ['nature-banana', 'nature-heli'], h: [3, 5] }, bush: { files: ['nature-bush', 'nature-fern', 'jungle-plant-1', 'jungle-plant-2', 'jungle-plant-3', 'jungle-plant-4'], h: [1.2, 2.4] },
  rock: { files: ['nature-rock', 'nature-rock-2'], h: [0.8, 2.2] }, boulder: { files: ['nature-rock-2', 'nature-rock'], h: [1.6, 3.0] }, log: { files: ['camp-log-drift'], h: [0.5, 0.8] },
};
const PROTO = {}, INST = [];
async function loadProps() {
  const files = [...new Set(Object.values(KINDS).flatMap((k) => k.files))];
  await Promise.all(files.map(async (f) => {
    try {
      const g = await loader.loadAsync(`/adventures/models/${f}.glb?v=1`);
      g.scene.updateMatrixWorld(true);
      let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return;
      const box = new THREE.Box3().setFromObject(g.scene), h = box.max.y - box.min.y || 1;
      const base = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2 / h, -box.min.y / h, -(box.min.z + box.max.z) / 2 / h).multiply(new THREE.Matrix4().makeScale(1 / h, 1 / h, 1 / h)).multiply(mesh.matrixWorld);
      const mat = mesh.material; if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      PROTO[f] = { geo: mesh.geometry, mat, base, places: [] };
    } catch (e) { console.warn('prop', f, e); }
  }));
}
function placeProps() {
  for (const p of Object.values(PROTO)) p.places = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const put = (kind, s, d, side, extra = {}) => {
    const K = KINDS[kind], files = K.files.filter((f) => PROTO[f]); if (!files.length) return;
    const f = files[Math.floor(rnd() * files.length)], h = lerp(K.h[0], K.h[1], rnd());
    const y = extra.y != null ? extra.y : bankY(d, s + side * 50) - 0.15;
    PROTO[f].places.push({ s, off: side * (W / 2 + d), y, h, rot: rnd() * Math.PI * 2, lean: extra.lean || 0, side });
  };
  for (let s = S0; s < S1(); s += 2.6) for (const side of [-1, 1]) {
    const r = rnd(), ss = s + rnd() * 2;
    if (r < 0.34) put(rnd() < 0.55 ? 'palm' : 'tree', ss, 2.5 + rnd() * 26, side, { lean: rnd() < 0.4 ? 0.18 : 0 });
    else if (r < 0.7) put(rnd() < 0.3 ? 'banana' : 'bush', ss, 0.8 + rnd() * 9, side);
    else if (r < 0.85) put('rock', ss, -0.5 + rnd() * 5, side);
    if (rnd() < 0.12) put('boulder', ss, -1.6 + rnd() * 1.2, side, { y: -0.6 });
    if (rnd() < 0.03) put('log', ss, -0.6, side, { y: -0.15 });
  }
  for (const p of Object.values(PROTO)) {
    p.places.sort((a, b) => a.s - b.s);
    if (p.mesh) { world.remove(p.mesh); p.mesh.dispose(); }
    const n = Math.min(p.places.length, 400);
    p.mesh = new THREE.InstancedMesh(p.geo, p.mat, Math.max(1, n)); p.mesh.count = 0; p.mesh.frustumCulled = false;
    p.mesh.castShadow = true; p.mesh.receiveShadow = true; world.add(p.mesh);
    INST.push(p);
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
let lastWin = -1e9;
function windowProps(sc) {
  if (Math.abs(sc - lastWin) < 6) return; lastWin = sc;
  const a = sc - 40, b = sc + 230;
  for (const p of Object.values(PROTO)) {
    if (!p.mesh) continue;
    let n = 0; const max = p.mesh.instanceMatrix.count;
    for (const q of p.places) { if (q.s < a) continue; if (q.s > b || n >= max) break;
      at(q.s, q.off, _v); _v.y = q.y; _e.set(q.lean * -q.side, q.rot, q.lean * 0.5); _q.setFromEuler(_e); _s.setScalar(q.h);
      _m.compose(_v, _q, _s).multiply(p.base); p.mesh.setMatrixAt(n++, _m); }
    p.mesh.count = n; p.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- the rafts ----------
const wood = new THREE.MeshStandardMaterial({ color: 0x9c6a3a, roughness: 0.85 }), wood2 = new THREE.MeshStandardMaterial({ color: 0x7d5230, roughness: 0.9 });
const rope = new THREE.MeshStandardMaterial({ color: 0xe9d6a4, roughness: 0.9 });
function makeRaftMesh(color) {
  const g = new THREE.Group(), deck = new THREE.Group(); g.add(deck);
  const logG = new THREE.CylinderGeometry(0.21, 0.21, 3.6, 9); logG.rotateX(Math.PI / 2);
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(logG, i % 2 ? wood2 : wood); l.position.set((i - 2.5) * 0.43, 0.05, (hash(i, 2) - 0.5) * 0.25); l.castShadow = true; l.receiveShadow = true; deck.add(l); }
  for (const z of [-1.15, 1.15]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.22), wood2); b.position.set(0, 0.28, z); b.castShadow = true; deck.add(b);
    for (const x of [-1.1, 1.1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 12), rope); r.position.set(x, 0.12, z); r.rotation.y = Math.PI / 2; deck.add(r); } }
  // the mast and the team flag (its cloth waves in update)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.9, 6), wood2); mast.position.set(-1.0, 1.55, 1.25); mast.castShadow = true; deck.add(mast);
  const fg = new THREE.PlaneGeometry(1.3, 0.8, 10, 4); fg.translate(0.65, 0, 0);
  const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide })); flag.position.set(-0.98, 2.6, 1.25); flag.castShadow = true; deck.add(flag);
  flag.userData.base = fg.attributes.position.array.slice();
  // a white wake behind
  const wk = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshBasicMaterial({ map: wakeTex(), transparent: true, depthWrite: false, opacity: 0.8 }));
  wk.rotation.x = -Math.PI / 2; wk.position.set(0, 0.02, 3.2); g.add(wk);
  return { g, deck, flag, wake: wk };
}
let _wake = null;
function wakeTex() { if (_wake) return _wake; const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 70; i++) { const y = Math.random() * 128, w = 2 + (y / 128) * 26, xx = 32 + (Math.random() - 0.5) * w * 2; x.fillStyle = `rgba(255,255,255,${0.5 * (1 - y / 128)})`; x.beginPath(); x.arc(xx, y, 2 + Math.random() * 4, 0, 7); x.fill(); }
  _wake = new THREE.CanvasTexture(c); return _wake; }
function makePaddle() {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), wood2); sh.position.y = -0.9; g.add(sh);
  const bl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0xffcd1c, roughness: 0.6 })); bl.position.y = -1.85; g.add(bl);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Foxino paddling: leaning forward, both paws on the paddle, the body twisting stroke by stroke (left, right)
function paddlePose(t, rate = 1) {
  const p = blankPose(), ph = t * 3.2 * rate, s = Math.sin(ph), c = Math.cos(ph);
  p.y = -0.12;
  p.legL = [-0.55, 0, 0.12]; p.kneeL = [1.0, 0, 0]; p.ankleL = [-0.35, 0, 0];
  p.legR = [-0.55, 0, -0.12]; p.kneeR = [1.0, 0, 0]; p.ankleR = [-0.35, 0, 0];
  p.spine = [0.35, 0.45 * s, 0.08 * c]; p.neck = [0, -0.25 * s, 0]; p.head = [-0.25, -0.15 * s, 0];
  p.armL = [-1.1 + 0.45 * s, 0, 0.35]; p.elbowL = [-0.7, 0, 0];
  p.armR = [-1.1 - 0.45 * s, 0, -0.35]; p.elbowR = [-0.7, 0, 0];
  return p;
}
const TEAMS = [], tagsEl = $('tags');
async function setupTeams(list) {
  for (const r of TEAMS) { scene.remove(r.g); r.tag.remove(); }
  TEAMS.length = 0;
  const n = list.length;
  await Promise.all(list.map(async (t, i) => {
    const R = makeRaftMesh(t.c);
    const r = Object.assign(R, { i, t, lane: (i - (n - 1) / 2) * LANE, s: -6, v: 0, boost: 0, stall: 0, lat: 0, latT: 0, spin: 0, spinV: 0, done: false, pose: 'paddle', poseT: 0, answered: 0, total: t.members.length });
    try { r.fox = await loadFoxino(); r.fox.setKit({ shirt: t.c, trim: '#ffffff', shorts: '#ffffff', socks: t.c }); r.fox.root.position.set(0.2, 0.18, -0.15); r.fox.root.rotation.y = Math.PI; r.fox.root.scale.setScalar(1.1);
      r.fox.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); r.deck.add(r.fox.root); } catch (e) { console.warn('foxino', e); }
    r.paddle = makePaddle(); r.deck.add(r.paddle);
    r.tag = document.createElement('div'); r.tag.className = 'tag team'; r.tag.style.setProperty('--c', t.c); tagsEl.appendChild(r.tag);
    r.gates = GATE_X.map((x, k) => makeGate(k));
    r.gates.forEach((gt) => scene.add(gt.g));
    r.g.scale.setScalar(RS); r.gates.forEach((gt) => gt.g.scale.setScalar(1.3)); scene.add(r.g); TEAMS[i] = r;
  }));
  renderTeams();
}
function updateTeams(list) { list.forEach((t, i) => { const r = TEAMS[i]; if (r) { r.t = t; r.total = t.members.length; } }); renderTeams(); }

// the gates: a floating buoy with a flag in the answer's colour, its letter above
function makeGate(k) {
  const g = new THREE.Group(), col = new THREE.Color(OPT_C[k]);
  const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); fl.position.y = 0.1; g.add(fl);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.47, 0.22, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })); band.position.y = 0.12; g.add(band);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, emissive: col, emissiveIntensity: 0.15 })); top.position.y = 0.48; g.add(top);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), wood2); pole.position.y = 1.2; g.add(pole);
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.75, -0.25, 0], 3)); fgeo.computeVertexNormals();
  const flag = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.6 })); flag.position.y = 1.98; g.add(flag);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  const tag = document.createElement('div'); tag.className = 'tag gate'; tag.style.setProperty('--c', OPT_C[k]); tag.textContent = LETTERS[k]; tag.style.opacity = '0'; tagsEl.appendChild(tag);
  return { g, tag, k, top, alive: false, sink: 0 };
}

// ---------- splashes and sparkles ----------
const FX = (() => {
  const N = 600, geo = new THREE.BufferGeometry(), P = new Float32Array(N * 3), C = new Float32Array(N * 3), S = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setAttribute('size', new THREE.BufferAttribute(S, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true, uniforms: { uScale: { value: 400 } },
    vertexShader: 'attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; gl_FragColor = vec4(vC, smoothstep(0.5, 0.2, r)); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const parts = []; for (let i = 0; i < N; i++) parts.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), s: 0 });
  let head = 0;
  return {
    emit(pos, n, color, speed = 4, up = 4, size = 0.35) {
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i++) { const q = parts[head = (head + 1) % N]; q.life = 0.7 + Math.random() * 0.6; q.p.copy(pos); q.v.set((Math.random() - 0.5) * speed, up * (0.5 + Math.random()), (Math.random() - 0.5) * speed); q.c.copy(c); q.s = size * (0.6 + Math.random() * 0.8); }
    },
    update(dt) {
      for (let i = 0; i < N; i++) { const q = parts[i]; if (q.life > 0) { q.life -= dt; q.v.y -= 9 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0 && q.v.y < 0) { q.p.y = 0; q.v.multiplyScalar(0.3); } }
        P[i * 3] = q.p.x; P[i * 3 + 1] = q.life > 0 ? q.p.y : -999; P[i * 3 + 2] = q.p.z; C[i * 3] = q.c.r; C[i * 3 + 1] = q.c.g; C[i * 3 + 2] = q.c.b; S[i] = q.life > 0 ? q.s : 0; }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true;
    },
    scale(h) { mat.uniforms.uScale.value = h * 0.6; },
  };
})();

// ---------- the race ----------
const R = { phase: 'wait', t: 0, q: null, qT: 0, secs: 15, gateD: 30, gatePass: false, res: null, resT: 0, order: [], finishT: 0, n: 0 };
function startRace() { R.phase = 'race'; TEAMS.forEach((r) => { r.v = 0.5; }); }
function newQuestion(m) {
  R.q = m.q; R.secs = m.secs || 15; R.qT = 0; R.res = null; R.gatePass = false; R.n = m.n || R.n + 1;
  TEAMS.forEach((r) => { r.answered = 0; r.gates.forEach((gt) => { gt.alive = true; gt.sink = 0; gt.g.visible = true; gt.tag.className = 'tag gate'; gt.tag.style.opacity = '1'; }); r.resCls = ''; });
  const card = $('qcard'); card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  $('qNum').textContent = `QUESTION ${R.n}`;
  $('qs').innerHTML = `${hints(m.q.before)}<span class="gap">&nbsp;</span>${hints(m.q.after)}`;
  $('qopts').className = 'qopts';
  $('qopts').innerHTML = m.q.words.slice(0, 3).map((w, k) => `<span style="--c:${OPT_C[k]}"><b>${LETTERS[k]}</b>${esc(w.text)}</span>`).join('');
  renderTeams();
}
function resolveQ(m) {
  R.res = m; R.resT = 0;
  $('qs').innerHTML = `${hints(R.q.before)}<span class="gap ok">${esc(m.right)}</span>${hints(R.q.after)}`;
  $('qopts').classList.add('done'); [...$('qopts').children].forEach((el, k) => el.classList.toggle('ok', k === m.correct));
  TEAMS.forEach((r, i) => {
    const x = m.res[i] || { choice: -1, ok: false, quality: 0 };
    r.choice = x.choice; r.ok = x.ok; r.quality = x.quality;
    const c = x.choice >= 0 ? x.choice : (m.correct === 1 ? 0 : 1);   // (no answer: the raft drifts into a wrong gate)
    r.steerK = c; r.latT = GATE_X[c];
    r.gates.forEach((gt) => gt.tag.classList.add(gt.k === m.correct ? 'right' : 'wrong'));
  });
}
function applyResult(r) {
  const pos = r.g.position.clone(); pos.y = 0.4;
  if (r.ok) {
    r.boost += 6.5 * (0.4 + 0.6 * r.quality); r.pose = 'cheer'; r.poseT = 0;
    FX.emit(pos, 60, '#ffd84a', 6, 6, 0.45); FX.emit(pos, 40, '#ffffff', 5, 4, 0.4);
    r.resCls = 'res-ok'; r.tag.classList.remove('ok'); void r.tag.offsetWidth; r.tag.classList.add('ok');
  } else {
    r.stall = 1.9; r.spinV = Math.PI * 2 / 1.3; r.spin = 0; r.pose = 'sad'; r.poseT = 0;
    FX.emit(pos, 70, '#ffffff', 7, 5, 0.5); FX.emit(pos, 20, '#8fd9ff', 5, 3, 0.4);
    r.resCls = 'res-bad';
  }
  renderTeams();
}
// the team panels and the race track
function renderTeams() {
  const rank = TEAMS.slice().sort((a, b) => b.s - a.s);
  $('teams').innerHTML = TEAMS.map((r) => `<div class="tp ${r.resCls || ''}" style="--c:${r.t.c}"><i>${r.t.e}</i><div><b>${esc(r.t.name)}</b><small>${r.t.members.map(esc).join(', ') || '—'}</small>
    <span class="dots">${Array.from({ length: Math.max(1, r.total) }, (_, k) => `<s class="${k < r.answered ? 'on' : ''}"></s>`).join('')}</span></div><span class="pos">${rank.indexOf(r) + 1}.</span></div>`).join('');
  $('lane').innerHTML = TEAMS.map((r) => `<b style="--c:${r.t.c};left:${clamp(r.s / LEN, 0, 1) * 100}%">${r.t.e}</b>`).join('');
}
let laneT = 0;
function bigText(html, ms = 1100) { const b = $('big'); b.innerHTML = html; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(b._t); if (ms) b._t = setTimeout(() => { b.innerHTML = ''; }, ms); }
async function countdown() { for (const t of ['3', '2', '1']) { bigText(t, 800); await new Promise((r) => setTimeout(r, 850)); } bigText('GO!', 1000); startRace(); }

function step(dt, t) {
  waterU.uTime.value = t;
  if (R.q && !R.res) R.qT += dt;
  if (R.res) R.resT += dt;
  // the gates come up to every raft: from 30 m to 8 m while the teams answer, then (the answer is in) the raft paddles through
  const dAsk = lerp(30, 8, clamp(R.qT / R.secs, 0, 1)), dRes = R.res ? lerp(R.resStart ?? dAsk, -3, smooth(R.resT / 1.5)) : dAsk;
  if (R.res && R.resStart == null) R.resStart = dAsk;
  if (!R.res) R.resStart = null;
  for (const r of TEAMS) {
    // speed
    r.boost *= Math.exp(-dt / 6);
    r.stall = Math.max(0, r.stall - dt);
    const tv = R.phase === 'wait' ? 0 : R.phase === 'end' && r.done ? 1.5 : r.stall > 0 ? 0.7 : V0 + r.boost;
    r.v = damp(r.v, tv, 1.4, dt);
    r.s += r.v * dt;
    if (!r.done && r.s >= LEN && R.phase === 'race') { r.done = true; R.order.push(r.i); if (R.order.length === 1) { bigText(`${r.t.e} ${esc(r.t.name)}<small>WIN THE RACE!</small>`, 3600); FX.emit(r.g.position.clone().setY(1), 140, r.t.c, 10, 9, 0.5); R.finishT = t; } }
    // steering into the chosen gate, back to the middle afterwards
    if (R.res && R.resT > 1.7) r.latT = 0;
    r.lat = damp(r.lat, r.latT, R.res ? 3.2 : 1.5, dt);
    r.spin += r.spinV * dt; if (r.spin >= Math.PI * 2) { r.spin = 0; r.spinV = 0; }
    const bob = Math.sin(t * 2.1 + r.i * 1.7), roll = Math.sin(t * 1.6 + r.i);
    at(r.s, r.lane + r.lat, r.g.position); r.g.position.y = 0.06 + 0.06 * bob;
    const latV = (r.latT - r.lat);
    r.g.rotation.set(0.03 * bob, heading(r.s) - latV * 0.12 + r.spin, 0.04 * roll + latV * 0.04);
    r.wake.material.opacity = clamp(r.v / 6, 0.2, 0.9);
    // the flag
    const fp = r.flag.geometry.attributes.position, b = r.flag.userData.base;
    for (let k = 0; k < fp.count; k++) { const x = b[k * 3]; fp.array[k * 3 + 2] = Math.sin(x * 4 - t * 7 + r.i) * 0.12 * x; }
    fp.needsUpdate = true;
    // Foxino
    if (r.fox) {
      r.poseT += dt;
      if ((r.pose === 'cheer' && r.poseT > 1.6) || (r.pose === 'sad' && r.poseT > 2.0)) r.pose = 'paddle';
      const P = r.pose === 'cheer' ? POSES.celebrate(r.poseT) : r.pose === 'sad' ? POSES.sad(r.poseT) : paddlePose(t + r.i * 0.7, R.phase === 'wait' ? 0.25 : 0.7 + r.v * 0.12);
      if (R.phase === 'wait' && r.pose === 'paddle') { P.armL[0] *= 0.6; P.armR[0] *= 0.6; }
      r.fox.apply(P, 10, dt);
      // the paddle between his paws, the blade down in the water on the stroke side
      const lh = r.fox.bones.LeftHand, rh = r.fox.bones.RightHand;
      if (lh && rh) {
        const a = lh.getWorldPosition(new THREE.Vector3()), c = rh.getWorldPosition(new THREE.Vector3());
        r.deck.worldToLocal(a); r.deck.worldToLocal(c);
        const hi = a.y > c.y ? a : c, side = Math.sin((t + r.i * 0.7) * 3.2 * (R.phase === 'wait' ? 0.25 : 0.7 + r.v * 0.12));
        const B = new THREE.Vector3(side * 1.7, -0.25, hi.z + 0.2 * Math.cos((t + r.i * 0.7) * 3.2));
        const dir = B.sub(hi).normalize();
        r.paddle.visible = r.pose === 'paddle';
        r.paddle.position.copy(hi).addScaledVector(dir, -0.25);
        r.paddle.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      }
    }
    // the gates for this raft
    for (const gt of r.gates) {
      if (!gt.alive) { gt.g.visible = false; gt.tag.style.opacity = '0'; continue; }
      const d = dRes;
      if (R.res && d < 0.8 && !r.passed) { r.passed = true; applyResult(r); }
      if (R.res && d < -1) gt.sink = Math.min(1, gt.sink + dt * 1.2);
      at(r.s + d, r.lane + GATE_X[gt.k], gt.g.position);
      gt.g.position.y = 0.05 * Math.sin(t * 2.4 + gt.k * 2 + r.i) - gt.sink * 1.6;
      gt.g.rotation.set(0.06 * Math.sin(t * 1.9 + gt.k), heading(r.s + d), 0.06 * Math.cos(t * 1.7 + gt.k));
      gt.g.visible = gt.sink < 1;
      if (gt.sink >= 1) { gt.alive = false; }
      gt.tag.style.opacity = gt.sink > 0.3 ? '0' : '';
    }
    if (!R.res) r.passed = false;
  }
  // the end of the question: everybody through the gates
  if (R.res && R.resT > 2.8 && !R.resPosted) { R.resPosted = true; post({ fr: 'resolved' }); if (!REMOTE) setTimeout(demoNext, 600); }
  if (!R.res) R.resPosted = false;
  // the finish
  if (R.order.length && R.phase === 'race' && (t - R.finishT > 3.2 || R.order.length === TEAMS.length)) {
    R.phase = 'end';
    const rest = TEAMS.filter((r) => !r.done).sort((a, b) => b.s - a.s).map((r) => r.i);
    post({ fr: 'finish', order: [...R.order, ...rest] });
    $('qcard').hidden = true;
  }
  laneT += dt; if (laneT > 0.35) { laneT = 0; renderTrack(); }
}
function renderTrack() { [...$('lane').children].forEach((b, i) => { const r = TEAMS[i]; if (r) b.style.left = `${clamp(r.s / LEN, 0, 1) * 100}%`; });
  const rank = TEAMS.slice().sort((a, b) => b.s - a.s); [...$('teams').children].forEach((el, i) => { const p = el.querySelector('.pos'); if (p && TEAMS[i]) p.textContent = `${rank.indexOf(TEAMS[i]) + 1}.`; }); }

// ---------- the camera: behind the pack, wider when the rafts spread out ----------
const CAM = { s: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
function updateCamera(dt) {
  let lo = 0, hi = 0;
  if (TEAMS.length) { lo = Math.min(...TEAMS.map((r) => r.s)); hi = Math.max(...TEAMS.map((r) => r.s)); }
  // (the last raft sits above the team panels, the leader still in view: at most 70 m between them on screen)
  const spread = Math.min(hi - lo, 70), lo2 = hi - spread;
  const aspect = camera.aspect, wide = aspect < 1.2 ? 1.5 : 1;
  const back = (17 + spread * 0.22) * wide, up = (15 + spread * 0.42) * wide;
  const p = at(lo2 - back, 0).setY(up), l = at(lo2 + 5 + spread * 0.42, 0).setY(0.5);
  const k = CAM.init ? 1 - Math.exp(-2.2 * dt) : 1; CAM.init = true;
  CAM.pos.lerp(p, k); CAM.look.lerp(l, k);
  camera.position.copy(CAM.pos); camera.lookAt(CAM.look);
  sun.target.position.copy(CAM.look); sun.position.copy(CAM.look).add(new THREE.Vector3(28, 62, 22));
  sky.position.copy(camera.position);
  clouds.position.z = camera.position.z * 0.85;
  windowProps((lo + hi) / 2);
}
// the labels over the rafts and the gates
const _p = new THREE.Vector3();
function updateTags() {
  const w = innerWidth, h = innerHeight;
  const place = (el, v) => { const d = camera.position.distanceTo(v), k = clamp(32 / d, 0.55, 1.15); _p.copy(v).project(camera); if (_p.z > 1 || _p.z < -1) { el.style.visibility = 'hidden'; return; } el.style.visibility = ''; el.style.transform = `translate(${(_p.x * 0.5 + 0.5) * w}px, ${(-_p.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${k.toFixed(3)})`; el.style.transformOrigin = '50% 100%'; };
  const placeUnder = (el, v) => { place(el, v); el.style.transform = el.style.transform.replace('translate(-50%, -100%)', 'translate(-50%, 4px)'); el.style.transformOrigin = '50% 0'; };
  for (const r of TEAMS) {
    r.tag.innerHTML = `<i>${r.t.e}</i>${esc(r.t.name)}`;
    placeUnder(r.tag, at(r.s - 2.6 * RS, r.lane + r.lat, _v).setY(0));
    for (const gt of r.gates) if (gt.g.visible) place(gt.tag, _v.copy(gt.g.position).setY(3.1));
  }
}

// ---------- the loop ----------
let last = performance.now(), T = 0, slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  step(dt, T); FX.update(dt); updateCamera(dt); updateTags();
  renderer.render(scene, camera);
  frames++; if (dt > 1 / 35) slow++;
  if (frames >= 120) { if (slow > 60 && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); } frames = 0; slow = 0; }
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.2 ? 60 : 46; camera.updateProjectionMatrix(); FX.scale(h * pr); }
addEventListener('resize', resize);

// ---------- messages from the teacher's page ----------
addEventListener('message', async (e) => {
  const m = e.data; if (!m || typeof m !== 'object' || !m.fr) return;
  if (m.fr === 'setup') { if (m.secs) { LEN = Math.round((V0 * (m.secs + 3) + 18) * 8); buildWorld(); placeProps(); lastWin = -1e9; } await setupTeams(m.teams); }
  if (m.fr === 'teams') updateTeams(m.teams);
  if (m.fr === 'go') countdown();
  if (m.fr === 'q') newQuestion(m);
  if (m.fr === 'votes') { const r = TEAMS[m.team]; if (r) { r.answered = m.answered; r.total = m.total; renderTeams(); } }
  if (m.fr === 'resolve') resolveQ(m);
});

// ---------- the demo (no teacher's page): three bot teams ----------
const DEMO_Q = [
  { before: 'She ', after: ' (be) my best friend.', right: 'is', words: [{ text: 'am' }, { text: 'are' }, { text: 'is', ok: true }] },
  { before: 'They ', after: ' football every day.', right: 'play', words: [{ text: 'play', ok: true }, { text: 'plays' }, { text: 'playing' }] },
  { before: 'There ', after: ' two cats in the garden.', right: 'are', words: [{ text: 'is' }, { text: 'are', ok: true }, { text: 'am' }] },
  { before: 'I ', after: ' got a new bike.', right: 'have', words: [{ text: 'has' }, { text: 'have', ok: true }, { text: 'having' }] },
];
let demoN = 0;
function demoNext() {
  if (R.phase !== 'race') return;
  const q = DEMO_Q[demoN++ % DEMO_Q.length], secs = 6;
  newQuestion({ n: demoN, q, secs });
  setTimeout(() => {
    const correct = q.words.findIndex((w) => w.ok);
    resolveQ({ right: q.right, correct, res: TEAMS.map(() => { const ok = Math.random() < 0.65; return { ok, choice: ok ? correct : (correct + 1) % 3, quality: Math.random() }; }) });
  }, secs * 1000 * 0.75);
}

// ---------- start ----------
(async () => {
  resize();
  if (document.fonts) await document.fonts.load('96px "Lilita One"').catch(() => {});
  buildWorld();
  $('loadTxt').textContent = 'Planting the jungle…';
  await loadProps(); placeProps();
  requestAnimationFrame(frame);
  $('loading').classList.add('gone');
  if (REMOTE) post({ fr: 'ready' });
  else {
    await setupTeams([{ name: 'Red Crabs', c: '#ff4d5e', e: '🦀', members: ['Anna', 'Petr', 'Eva'] }, { name: 'Blue Dolphins', c: '#2f8cff', e: '🐬', members: ['Jan', 'Tom'] }, { name: 'Green Frogs', c: '#25b85e', e: '🐸', members: ['Ema', 'Max', 'Lucie'] }]);
    setTimeout(async () => { await countdown(); setTimeout(demoNext, 1500); }, 800);
  }
  window.RAFT = { R, TEAMS, renderer, THREE, get water() { return water; }, scene, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls }), LEN: () => LEN };
})();
