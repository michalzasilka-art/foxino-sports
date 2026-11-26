// Foxino Snow Sports (2026-11-21, the user: "to Foxino Sports create 5 different high quality, nice lighting and camera winter
// sport activities to learn languages from the content I have saved … also accessible for multiplayer with 1 friend").
// One page, five sports (?sport=slalom|halfpipe|skijump|sled|biathlon). This file is the shared engine:
//  · the look: a painted sky dome, soft sun shadows, the snow shader (sparkles, corduroy on the piste), falling snow, the post pass
//  · Foxino from Penalty Star in winter gear (the kit painted as a ski suit; Blender goggles + scarf on his bones; skis, poles,
//    a snowboard or a sled that follow his feet and hands)
//  · the question moment: the world slows almost to a stop, the sentence card + three word bubbles; no clock on the answer
//  · juice (PERFECT/GREAT/GOOD, combo, flash, shake, spray), a camera that damps towards each sport's shots, cinema bars
//  · the result (medal by right answers, the best score per sport), and the friend: inside the Foxino Sports lobby the two
//    phones swap their progress through the lobby's party link; the friend shows as an orange Foxino and in the HUD
// The models are built in Blender from scripts (Foxino/Foxino Sports/Blender Snow/*.py) and exported to models/.
import * as THREE from '/penalty/lib/three.module.min.js';
import { GLTFLoader } from '/penalty/lib/GLTFLoader.js';
import { makeFoxinoGLB } from '/penalty/foxino-glb.js?v=3';
import { blankPose } from '/penalty/foxino.js';
import { makeBubble } from '/penalty/props.js';
import { sfx, unlock, isMuted, setMuted } from '/penalty/sound.js';
import { MP } from '../mp.js?v=3';   // (2026-11-25, multiplayer patch: the two players start together and see each other live)
import { paintedSky, makePost } from '../look.js?v=3';
import { loadXmasKit, placeKit, stringLights, bulbGlows } from '../xmas.js?v=5';   // (2026-11-24, the user: a Christmas atmosphere in every sport)

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const Q = new URLSearchParams(location.search);
const SPORT = (() => { const s = (Q.get('sport') || 'halfpipe').replace(/[^a-z]/g, ''); return ['slalom', 'sled', 'biathlon'].includes(s) && !Q.has('dev') ? 'halfpipe' : s; })();   // (2026-11-24: Slalom, Sled and Biathlon are out for players: ?dev still opens them)
const LIST = Q.get('list') === '1', PARTY = Q.get('party') === '1' && window.parent !== window;
const SPEED = clamp(+Q.get('speed') || 1, 0.25, 8), BOT = Q.get('bot');   // (tests: ?speed=3 runs the game faster, ?bot=1 answers by itself)
const TINTS = [0xff6fb5, 0xffcd1c, 0x48d8ff], CSS_TINTS = ['#ff8fc4', '#ffd84a', '#6fe2ff'];
export const WINTER_KIT = { shirt: '#ffcd2e', trim: '#7b3fd1', shorts: '#4a2a8c', socks: '#4a2a8c', boots: '#36d6e0' };
export const FRIEND_KIT = { shirt: '#ff7d22', trim: '#ffffff', shorts: '#2b3a7a', socks: '#2b3a7a', boots: '#ffffff' };
const NAMES = { slalom: 'SLALOM', halfpipe: 'HALFPIPE', skijump: 'SKI JUMP', sled: 'SLED RUN', biathlon: 'SNOWBALL BIATHLON' };

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pr);
renderer.info.autoReset = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfeaff, 80, 520);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000); scene.add(camera);
const hemi = new THREE.HemisphereLight(0xdbe8ff, 0x9a8fc8, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 220 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xbfd6ff, 0.8); scene.add(rim);
const SUN_DIR = new THREE.Vector3(-0.45, 0.7, -0.55).normalize();
const POSTFX = makePost(renderer, { aoRange: 90, focusMul: 1.6, blur: 0.35, grade: { sat: 1.08, warm: 0.5 }, glow: 0.0 });

// ---------- loading helpers ----------
const loader = new GLTFLoader();
const loadGLB = (url) => loader.loadAsync(url);
const loadJSON = (url) => fetch(url).then((r) => r.json());

// the snow: a soft white with sparkles that twinkle as the camera moves; the groomed piste gets a faint corduroy
const TIME = { value: 0 };
function snowMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ color: kind === 'piste' ? 0xe4ebfb : kind === 'ice' ? 0xcfe6ff : 0xeef2fd, roughness: kind === 'ice' ? 0.18 : kind === 'piste' ? 0.8 : 0.88, metalness: 0, envMapIntensity: kind === 'ice' ? 1.0 : 0.12 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uTime;
      float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${kind === 'piste' ? 'diffuseColor.rgb *= 1.0 - 0.035 * smoothstep(0.35, 0.5, abs(fract(vWp.x * 1.3) - 0.5));' : ''}
        diffuseColor.rgb *= 0.97 + 0.03 * h31(floor(vWp * 2.0));`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        { vec3 cell = floor(vWp * 38.0); float h = h31(cell); vec3 V = normalize(cameraPosition - vWp);
          float tw = step(0.9935, h) * pow(max(0.0, sin(dot(V, vec3(31.0, 17.0, 23.0)) * 4.0 + h * 60.0 + uTime * 0.6)), 6.0);
          float dist = length(cameraPosition - vWp);
          gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * tw * (1.0 - smoothstep(8.0, 45.0, dist)) * 1.6; }`);
  };
  return m;
}
const MATS = { snow: snowMaterial('snow'), piste: snowMaterial('piste'), ice: snowMaterial('ice') };
// the course models: Blender material names -> the game's materials
export function dressModel(root, { banner = null } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.material && o.material.name) || '';
    if (name === 'Snow') o.material = MATS.snow;
    else if (name === 'Piste') o.material = MATS.piste;
    else if (name === 'Ice') o.material = MATS.ice;
    else if (name === 'WindowLit' || name === 'LampLit') { o.material = new THREE.MeshBasicMaterial({ color: name === 'LampLit' ? 0xfff6dc : 0xffd98a, toneMapped: false }); o.userData.noCast = true; }
    else if ((name === 'Banner' || name === 'Banner2') && banner) o.material = banner(name);
    else if (o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.4; if (o.geometry.attributes.color && name === 'Mount') o.material.vertexColors = true; }
    if (o.geometry.boundingSphere == null) o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere.radius;
    o.receiveShadow = true; o.castShadow = r < 25 && name !== 'Snow' && name !== 'Piste';
    if (!o.castShadow) o.userData.noCast = true;
    if (r > 25) FAR.push(o);
  });
  return root;
}
// a banner texture with big text (start / finish arches)
export function bannerMaterial(text, bg = '#7b3fd1', fg = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -128; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 64, 0); g.lineTo(x + 96, 0); g.lineTo(x + 32, 128); g.fill(); }
  g.font = '400 92px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14; g.strokeStyle = 'rgba(29,22,64,.8)'; g.strokeText(text, 512, 70); g.fillStyle = fg; g.fillText(text, 512, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}

// ---------- the props (trees, rocks, gates, gear) and instancing in cells, so far-away cells are not drawn ----------
let PROPS = null;
// Christmas (2026-11-24): a sport's xmas(E, X) hook places the shared kit beside its course; X.put / X.lights also join FAR
const XMAS = { lights: [] };
const XK = {
  put(name, p, yaw = 0, s = 1) { const o = placeKit(scene, name, p.x, p.z, { y: p.y, rot: yaw, s }); if (o) { o.traverse((m) => { if (m.isMesh) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); FAR.push(m); } }); const gl = /^(XmasTree_Big|Garland)$/.test(name) && bulbGlows(o); if (gl) XMAS.lights.push(gl); } return o; },
  far(obj) { obj.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); if (!FAR.includes(m)) FAR.push(m); } }); },   // (hide it when it is past the draw distance)
  lights(posts, opt) { const g = stringLights(scene, posts, opt); XMAS.lights.push(g); g.traverse((m) => { if (m.isInstancedMesh) { m.computeBoundingSphere(); FAR.push(m); } }); return g; },
};
const FAR = [];   // meshes hidden when far from the camera (tree cells, ground pieces): fewer triangles on phones
const _fc = new THREE.Vector3();
async function loadProps() {
  if (PROPS) return PROPS;
  const g = await loadGLB('models/snow-props.glb?v=1');
  PROPS = {};
  g.scene.children.forEach((o) => { PROPS[o.name.replace(/\.\d+$/, '')] = o; });
  for (const k in PROPS) dressModel(PROPS[k]);
  return PROPS;
}
export function prop(name) { const p = PROPS[name]; if (!p) throw new Error('no prop ' + name); const c = p.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); return c; }
// list: [[type, x, y, z, rot, scale], …]; names(type) -> prop name. One InstancedMesh per (cell, prop part).
export function instanceField(list, names, cell = 36) {
  const cells = new Map();
  for (const it of list) { const key = `${Math.floor(it[1] / cell)},${Math.floor(it[3] / cell)}|${names(it[0])}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(it); }
  const group = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let tris = 0;
  for (const [key, items] of cells) {
    const proto = PROPS[key.split('|')[1]]; if (!proto) continue;
    proto.updateMatrixWorld(true);
    proto.traverse((part) => {
      if (!part.isMesh) return;
      const im = new THREE.InstancedMesh(part.geometry, part.material, items.length);
      const local = part.matrixWorld.clone().premultiply(new THREE.Matrix4().copy(proto.matrixWorld).invert());
      items.forEach((it, i) => { p.set(it[1], it[2], it[3]); q.setFromAxisAngle(Y, it[4]); s.setScalar(it[5]); m4.compose(p, q, s).multiply(local); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true;
      tris += (part.geometry.index ? part.geometry.index.count : part.geometry.attributes.position.count) / 3 * items.length;
      group.add(im);
    });
  }
  group.userData.tris = tris;
  group.children.forEach((im) => FAR.push(im));
  return group;
}
// the far mountains: two rings that stay centred on the camera (always far away), sunk to the course's height
let MOUNT = null;
export async function addMountains(yBase = -200, tint = 0xffffff) {
  const g = await loadGLB('models/mountains.glb?v=1'); MOUNT = g.scene;
  MOUNT.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshStandardMaterial({ vertexColors: true, color: tint, roughness: 0.95, envMapIntensity: 0.2 }); o.userData.noCast = true; o.receiveShadow = false; o.frustumCulled = false; } });
  MOUNT.userData.y = yBase; scene.add(MOUNT); return MOUNT;
}

// ---------- Foxino in winter gear ----------
const FOX_URL = '/penalty/models/foxino-football.glb?v=1';
let GEAR = null;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
// (2026-11-25, the user: "make new models using tripo ai on my computer to create new skis and snowboard so it already has the snow boots on it
// and you remove foxino feet to just make it look better attached") Tripo models (Foxino/Foxino Sports/Snow Gear (Tripo)): the snowboard with both
// boots strapped in, and the skis with a boot clipped into each. Foxino's feet are hidden (the foot bones shrunk to nothing) and each boot's top
// sits at his ankle. ?gear=0 brings back the old board and skis.
const NEWGEAR = !/[?&]gear=0/.test(location.search);
let TGEAR = null;
function bakedGeo(root) { let mesh = null; root.updateMatrixWorld(true); root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; }); const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); const mat = mesh.material; if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace; mat.roughness = 0.7; mat.metalness = 0; return { geo: geo.index ? geo.toNonIndexed() : geo, mat }; }
// the boot: the vertices well above the board/ski; its top-centre becomes the origin (just under the rim, so the shin goes into it)
function bootOf(P, idx, y0, y1) { let x = 0, z = 0, n = 0, top = -1e9; for (const i of idx) { const y = P[i * 3 + 1]; if (y < y0 + (y1 - y0) * 0.42) continue; x += P[i * 3]; z += P[i * 3 + 2]; n++; if (y > top) top = y; } return n ? { x: x / n, z: z / n, top } : null; }
function prepBoard(root) {
  const { geo, mat } = bakedGeo(root), P = geo.attributes.position.array, N = P.length / 3; geo.computeBoundingBox(); const bb = geo.boundingBox;
  const all = [...Array(N).keys()], L = bootOf(P, all.filter((i) => P[i * 3] < 0), bb.min.y, bb.max.y), R = bootOf(P, all.filter((i) => P[i * 3] >= 0), bb.min.y, bb.max.y);
  const ox = (L.x + R.x) / 2, oz = (L.z + R.z) / 2, oy = Math.max(L.top, R.top) - (bb.max.y - bb.min.y) * 0.12, minY = bb.min.y, len = bb.max.x - bb.min.x;
  geo.translate(-ox, -oy, -oz);   // (2026-11-25: the base read BEFORE the move: reading it after counted the move twice and the board floated ~12 cm)
  return { geo, mat, gap: Math.hypot(R.x - L.x, R.z - L.z), bottom: minY - oy - 0.014, len };   // (the base ON the groomed snow, which lies 2 cm over the ground mesh: deeper hides the thin board)
}
function prepSkis(root) {
  const { geo, mat } = bakedGeo(root), P = geo.attributes.position.array, N = P.length / 3; geo.computeBoundingBox(); const bb = geo.boundingBox, out = [];
  for (const side of [-1, 1]) {   // (split the pair: the triangles on each side of the middle)
    const pos = []; for (let t = 0; t < N / 3; t++) { const cz = (P[t * 9 + 2] + P[t * 9 + 5] + P[t * 9 + 8]) / 3; if ((cz < 0 ? -1 : 1) === side) for (let k = 0; k < 9; k++) pos.push(P[t * 9 + k]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uvAll = geo.attributes.uv.array, uv = []; for (let t = 0; t < N / 3; t++) { const cz = (P[t * 9 + 2] + P[t * 9 + 5] + P[t * 9 + 8]) / 3; if ((cz < 0 ? -1 : 1) === side) for (let k = 0; k < 6; k++) uv.push(uvAll[t * 6 + k]); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (geo.attributes.normal) { const nA = geo.attributes.normal.array, nr = []; for (let t = 0; t < N / 3; t++) { const cz = (P[t * 9 + 2] + P[t * 9 + 5] + P[t * 9 + 8]) / 3; if ((cz < 0 ? -1 : 1) === side) for (let k = 0; k < 9; k++) nr.push(nA[t * 9 + k]); } g.setAttribute('normal', new THREE.Float32BufferAttribute(nr, 3)); } else g.computeVertexNormals();
    const Q = g.attributes.position.array, M = Q.length / 3, idx = [...Array(M).keys()], b = bootOf(Q, idx, bb.min.y, bb.max.y);
    let xmin = 1e9, xmax = -1e9; for (const i of idx) { xmin = Math.min(xmin, Q[i * 3]); xmax = Math.max(xmax, Q[i * 3]); }
    let hiMin = -1e9, hiMax = -1e9; for (const i of idx) { const x = Q[i * 3], y = Q[i * 3 + 1]; if (x < xmin + 0.08) hiMin = Math.max(hiMin, y); if (x > xmax - 0.08) hiMax = Math.max(hiMax, y); }
    g.translate(-b.x, -(b.top - (bb.max.y - bb.min.y) * 0.1), -b.z);
    g.rotateY(hiMax > hiMin ? -Math.PI / 2 : Math.PI / 2);   // (the curved-up tip points forward, +z)
    out.push({ geo: g, mat, bottom: bb.min.y - (b.top - (bb.max.y - bb.min.y) * 0.1) });
  }
  return out;   // [the -z one, the +z one]
}
// stretch a ski's front and back (not the boot): the jumping skis are long
function stretchSki(geo, k, r = 0.13) { if (k === 1) return geo; const g = geo.clone(), Q = g.attributes.position.array; for (let i = 2; i < Q.length; i += 3) { const z = Q[i], a = Math.abs(z); if (a > r) Q[i] = Math.sign(z) * (r + (a - r) * k); } return g; }
function loadTGear() { return TGEAR || (TGEAR = Promise.all([loadGLB('models/snowboard-boots.glb?v=1'), loadGLB('models/skis-boots.glb?v=1')]).then(([b, s]) => ({ board: prepBoard(b.scene), skis: prepSkis(s.scene) }))); }
export async function makeActor({ kit = WINTER_KIT, gear = 'ski' } = {}) {
  const [fg, gg] = await Promise.all([loadGLB(FOX_URL), GEAR || (GEAR = loadGLB('models/fox-gear.glb?v=1'))]);
  const raw = fg.scene; raw.updateMatrixWorld(true);
  const bonesRaw = {}; raw.traverse((o) => { if (o.isBone) bonesRaw[o.name.replace(/^mixamorig:?/, '')] = o; });
  const restInv = {}; for (const k of ['Head', 'Neck', 'Spine2']) restInv[k] = bonesRaw[k].matrixWorld.clone().invert();
  const fox = makeFoxinoGLB(raw);
  // the goggles on the forehead and the scarf, attached to the head / neck bones (exported in the model's rest space)
  const gs = gg.scene.clone(true); gs.updateMatrixWorld(true);
  const parts = []; gs.traverse((o) => { if (o.isMesh) parts.push(o); });
  for (const o of parts) {
    const bone = /^Scarf$/.test(o.name) ? 'Neck' : /^ScarfEnd/.test(o.name) ? 'Spine2' : 'Head';
    const mesh = o.clone(); mesh.matrixAutoUpdate = true;
    _m.copy(restInv[bone]).multiply(o.matrixWorld); _m.decompose(mesh.position, mesh.quaternion, mesh.scale);
    const n = (o.material && o.material.name) || '';
    if (n === 'GoggleLens') mesh.material = new THREE.MeshPhysicalMaterial({ color: 0xb98cff, roughness: 0.08, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.8, envMapIntensity: 1.6 });
    else if (n === 'Scarf' || n === 'ScarfStripe') mesh.material = new THREE.MeshStandardMaterial({ color: kit === FRIEND_KIT ? 0x36d6e0 : 0xff4d6d, roughness: 0.95 });
    else if (mesh.material) { mesh.material = mesh.material.clone(); mesh.material.roughness = Math.min(0.6, mesh.material.roughness); }
    mesh.castShadow = true; mesh.frustumCulled = false;
    fox.bones[bone].add(mesh);
  }
  fox.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  try { await fox.setKit(kit); } catch (e) { /* (the football kit stays) */ }
  const g = new THREE.Group(); g.add(fox.root); scene.add(g);
  const A = { g, fox, gear, kit, skis: [], poles: [], board: null, sled: null, ball: null,
    skiYaw: [0, 0], skiPitch: 0, skiRoll: 0, skiFree: false, poleDir: [new THREE.Vector3(0.15, -1, -0.55), new THREE.Vector3(-0.15, -1, -0.55)], poleOn: true };
  await loadProps();
  const TG = NEWGEAR && (gear === 'board' || gear === 'ski' || gear === 'jump') ? await loadTGear() : null; A.tg = !!TG;
  if (TG) { for (const b of [fox.bones.LeftFoot, fox.bones.RightFoot]) b.scale.setScalar(0.001); }   // (his feet hidden: the boots are his feet now)
  if (gear === 'ski' || gear === 'xc' || gear === 'jump') {
    for (let i = 0; i < 2; i++) { let s;
      if (TG) { const k = gear === 'jump' ? 1.7 : 1.2, sk = TG.skis[i]; s = new THREE.Mesh(stretchSki(sk.geo, k), sk.mat); s.userData.bottom = sk.bottom; }
      else { s = prop('Ski'); if (gear === 'jump') s.scale.set(1, 1, 1.55); else if (gear === 'xc') s.scale.set(0.8, 1, 1.25); }
      g.add(s); A.skis.push(s); }
    if (gear !== 'jump') for (let i = 0; i < 2; i++) { const p = prop('Pole'); g.add(p); A.poles.push(p); }
  }
  if (gear === 'board') { A.board = TG ? new THREE.Mesh(TG.board.geo, TG.board.mat) : prop('Snowboard'); if (TG) A.board.userData.tb = TG.board; g.add(A.board); fox.root.rotation.y = -Math.PI / 2; }
  if (gear === 'sled') { A.sled = prop('Sled'); g.add(A.sled); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  A.pose = (P, k = 12, dt = 1 / 60) => fox.apply(P, k, dt);
  // the gear follows the feet and the hands every frame
  A.update = () => {
    // (2026-11-25, the user: "the legs arent matching ... there are 2 sticks holding it above it, i want the plank touching the slope") with the
    // Tripo gear the board and skis lie flat on the snow and his body is lifted (or lowered) so his ankles end exactly at the boot tops: his shins
    // never poke out under the board or the skis
    if (A.tg && A.baseY == null) A.baseY = fox.root.position.y;
    if (A.tg && (A.board || (A.skis.length && !A.skiFree))) {
      fox.root.position.y = A.baseY; g.updateMatrixWorld(true);
      fox.bones.LeftFoot.getWorldPosition(_v); fox.bones.RightFoot.getWorldPosition(_v2); g.worldToLocal(_v); g.worldToLocal(_v2);
      const H = A.board ? -A.board.userData.tb.bottom * (A.bScale || 1) : Math.max(-A.skis[0].userData.bottom, -A.skis[1].userData.bottom);
      const lift = A.board ? H - (_v.y + _v2.y) / 2 : H - Math.min(_v.y, _v2.y);
      A.lift = lift; fox.root.position.y = A.baseY + lift;
    } else if (A.tg && A.baseY != null) { fox.root.position.y = A.baseY; A.lift = 0; }
    g.updateMatrixWorld(true);
    const feet = [fox.bones.LeftFoot, fox.bones.RightFoot], hands = [fox.bones.LeftHand, fox.bones.RightHand];
    if (A.skis.length) feet.forEach((b, i) => {
      const s = A.skis[i]; b.getWorldPosition(_v); g.worldToLocal(_v);
      if (A.tg) { s.position.copy(_v); }   // (the boot top at the ankle: on the snow the body was lifted so the lower ski's base is on the snow)
      else if (A.skiFree) { s.position.copy(_v).add(_v2.set(0, -0.09, 0.05)); }
      else { s.position.set(_v.x, Math.max(0, _v.y - 0.1), _v.z + 0.04); }
      s.rotation.set(A.skiPitch, A.skiYaw[i], A.skiRoll, 'YXZ');
    });
    if (A.poles.length) hands.forEach((b, i) => {
      const p = A.poles[i]; p.visible = A.poleOn; b.getWorldPosition(_v); g.worldToLocal(_v); p.position.copy(_v);
      _v2.copy(A.poleDir[i]).normalize(); p.quaternion.setFromUnitVectors(_v.set(0, -1, 0), _v2);
    });
    if (A.board && A.board.userData.tb) {   // (the Tripo board: centred between his ankles, turned along them, sized once so the boots sit under his shins)
      const tb = A.board.userData.tb; fox.bones.LeftFoot.getWorldPosition(_v); fox.bones.RightFoot.getWorldPosition(_v2); g.worldToLocal(_v); g.worldToLocal(_v2);
      if ((A.bN = (A.bN || 0) + 1) < 40) { const d = Math.hypot(_v2.x - _v.x, _v2.z - _v.z); A.bScale = Math.max(A.bScale || 0.8, Math.min(2.2, d / tb.gap)); A.board.scale.setScalar(A.bScale); }   // (sized over the first frames, to his widest stance)
      const yaw = Math.atan2(-(_v2.z - _v.z), _v2.x - _v.x); _v.add(_v2).multiplyScalar(0.5);
      A.board.position.set(_v.x, -tb.bottom * A.bScale, _v.z); A.board.rotation.set(0, yaw, 0);   // (the base flat on the snow; his ankles were brought to the boot tops above)
    } else if (A.board) { fox.bones.LeftFoot.getWorldPosition(_v); fox.bones.RightFoot.getWorldPosition(_v2); _v.add(_v2).multiplyScalar(0.5); g.worldToLocal(_v); A.board.position.set(_v.x * 0.3, Math.max(0, _v.y - 0.1), _v.z * 0.3); }
  };
  return A;
}
// (2026-11-25) the Snowboard Foxino (Tripo + Claudee RCC, blender/foxino-snowboard): his own snowboard gear, no tail, the board in the model,
// 19 animation clips. A.want(name) cross-fades to a clip (once-clips hold their last frame); A.update(dt) runs the clips.
const ONCE_CLIPS = new Set(['drop_in', 'takeoff', 'windup_spin', 'windup_flip', 'spot_land', 'wipeout_back', 'grab_indy', 'grab_melon', 'grab_tail', 'grab_method', 'grab_stalefish', 'land', 'land_wobble', 'fall_sit', 'sad', 'wipeout']);
// (2026-11-25, the user: "Make 2 separate models / Ski / Foxino / Make the foxino so it just attached to the skis / Make sure that the skis arent
// deformed ...") the skier: Foxino (Tripo + Claudee RCC, rigged, his own clips) and ONE straight ski model hung on his SkiL / SkiR mount bones.
// jump: the ski-jumping skis are longer in front and behind (not at the binding).
// (2026-11-26, F1+F2: Foxino's face, Michal: "his mouth is also most of the times closed only opened when hes clebrating",
// "eyes with natural blinking and closed eyes to 15%" = the lids rest 15% closed, plus natural blinks; neutral on a fail or crash)
// The face's shape keys (MouthClosed, MouthSmile, MouthOpen, EyesClosed or EyeClosedL/R; a model without them = no-op), blended smoothly.
// Mouth: one state, 'closed' (default) | 'smile' | 'open'; auto(clip) opens it only for the celebrating clips.
// (F5, the shared rule for both Foxinos) a short closed SMILE for small happy moments (smile(secs): a right answer, a clean landing);
// the open grin only when he celebrates (the cheer); a crash (wipeout clips) is always neutral, even mid-smile.
// Eyes: rest 0.15; a blink (0.12-0.2 s) every 2-6 s at random (real time), sometimes a double; never on the money shots (take-off, early flight, the cheer's first 2 s).
const MOUTH = { closed: { MouthClosed: 1 }, smile: { MouthClosed: 1, MouthSmile: 1 }, open: { MouthOpen: 1 } };
const MOUTH_OPEN_CLIPS = new Set(['cheer']);
const NO_BLINK = (clip, t) => clip === 'takeoff' || (clip === 'cheer' && t < 2) || (clip === 'fly' && t < 1.2) || /^windup/.test(clip) || (/^grab_/.test(clip) && t < 0.7) || (clip === 'land' && t < 0.5);   // (+ the snowboarder (F4): the pop, the wind-up and the first part of the trick, the landing)   // (the cheer's pose for 2 s; then he blinks again while the results show)
const EYE_REST = 0.15, rnd = (a, b) => a + Math.random() * (b - a);
function faceRig(root) {
  const ms = []; root.traverse((o) => { if (o.isMesh && o.morphTargetDictionary && Object.keys(o.morphTargetDictionary).some((n) => /^(Mouth|Eye)/.test(n))) ms.push(o); });
  const keys = new Set(); for (const m of ms) for (const n in m.morphTargetDictionary) keys.add(n);
  const eyeKeys = keys.has('EyesClosed') ? ['EyesClosed'] : ['EyeClosedL', 'EyeClosedR'].filter((n) => keys.has(n));
  const F = { ok: ms.length > 0, state: 'closed', hold: null, w: {}, keys: [...keys], eyeKeys, clip: '', clipT: 0,
    eye: EYE_REST, next: rnd(1, 4), bt: -1, bd: 0.16, dbl: false, blinks: [], T: 0,
    set(state) { if (MOUTH[state]) F.state = state; },
    smileT: 0, smile(secs = 1.2) { F.smileT = Math.max(F.smileT, secs); },
    auto(clip) { if (clip !== F.clip) { F.clip = clip; F.clipT = 0; } if (/^wipeout/.test(clip)) F.smileT = 0; if (!F.hold) F.state = MOUTH_OPEN_CLIPS.has(clip) ? 'open' : F.smileT > 0 ? 'smile' : 'closed'; },
    blinkAt(dt) {   // the eyelids' value now: rest, or a blink's quick close (40%) and slower open (60%)
      F.T += dt; F.clipT += dt;
      if (F.bt < 0) { F.next -= dt; if (F.next <= 0) { if (NO_BLINK(F.clip, F.clipT)) F.next = rnd(0.25, 0.6); else { F.bt = 0; F.bd = rnd(0.12, 0.2); F.blinks.push(+F.T.toFixed(2)); if (F.blinks.length > 40) F.blinks.shift(); } } }
      if (F.bt >= 0) { F.bt += dt; const u = F.bt / F.bd; if (u >= 1) { F.bt = -1; if (!F.dbl && Math.random() < 0.18) { F.dbl = true; F.next = rnd(0.08, 0.16); } else { F.dbl = false; F.next = rnd(2, 6); } return EYE_REST; }
        const c = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6, e = c * c * (3 - 2 * c); return EYE_REST + (1 - EYE_REST) * e; }
      return EYE_REST; },
    update(dt, snap = false) { if (!F.ok) return; F.smileT = Math.max(0, F.smileT - dt); const tgt = MOUTH[F.hold || F.state], k = snap ? 1 : 1 - Math.exp(-dt * 20);
      for (const n of F.keys) { if (!/^Mouth/.test(n)) continue; const want = tgt[n] || 0, cur = F.w[n] == null ? want : F.w[n]; F.w[n] = cur + (want - cur) * k; }
      if (F.eyeKeys.length) { F.eye = F.blinkAt(dt); for (const n of F.eyeKeys) F.w[n] = F.eye; }
      for (const m of ms) for (const n in F.w) { const i = m.morphTargetDictionary[n]; if (i != null) m.morphTargetInfluences[i] = F.w[n]; } } };
  F.update(0, true); return F;
}
export async function makeSkier({ friend = false, jump = false, url = 'models/foxino-skier.glb?v=4', skiUrl = 'models/ski.glb?v=2' } = {}) {
  const [gl, sk] = await Promise.all([loadGLB(url), loadGLB(skiUrl)]), inner = gl.scene;
  inner.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(inner), s = 1.3 / Math.max(0.1, box.max.y - box.min.y);
  inner.scale.setScalar(s); inner.position.y = 0.032 * s;   // (he faces +Z in the file, the skis' noses +Z; lifted so the ski bases, 32 mm under his soles, are on the snow)
  const dress = (o) => { o.frustumCulled = false; o.castShadow = !friend; if (friend) o.userData.noCast = true; const m = o.material = o.material.clone(); if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; m.roughness = 0.75; if (friend && o.isSkinnedMesh) m.color.set(0xffd7b0); };
  inner.traverse((o) => { if (o.isMesh) dress(o); });
  const mounts = []; inner.traverse((o) => { if (o.isBone && /^Ski[LR]$/.test(o.name)) mounts[o.name === 'SkiL' ? 0 : 1] = o; });
  const skis = mounts.map((b) => { const m = sk.scene.clone(true); m.traverse((o) => { if (o.isMesh) { if (jump) { const bg = bakeGeo(o); o.geometry = stretchSki(bg, 1.45, bindingReach(bg)); o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1); } dress(o); } }); b.add(m); return m; });   // (no offsets: the mounts' frame is the ski's)
  const g = new THREE.Group(); g.add(inner); scene.add(g);
  const mixer = new THREE.AnimationMixer(inner), acts = {};
  for (const c of gl.animations) { const a = mixer.clipAction(c); if (SKI_ONCE.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } acts[c.name] = a; }
  const A = { g, isClip: true, cur: '', skiMeshes: skis, skis: [], poles: [], board: null, skiYaw: [0, 0], skiPitch: 0, skiFree: false, clips: Object.keys(acts),
    want(name, fade = 0.2, speed = 1) { const a = acts[name]; if (!a) return; a.timeScale = speed; if (name === A.cur) return; const old = acts[A.cur]; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play(); if (old) a.crossFadeFrom(old, fade, false); A.cur = name; },
    again(name, speed = 1) { A.cur = ''; A.want(name, 0.12, speed); },
    pose() {}, update(dt = 1 / 60) { mixer.update(Math.min(0.1, dt)); A.face.auto(A.cur); A.face.update(E.freeze ? 0 : Math.min(0.1, dt)); } };   // (real time: a blink stays a quick blink in the slow motion while answering; paused on a frozen frame)
  A.face = faceRig(inner); A.smile = (s) => A.face.smile(s); A.mouth = (st) => { A.face.hold = st || null; };   // (A.mouth('open'|'smile'|'closed') holds a state; A.mouth() = back to auto)
  A.want('stance_idle', 0);
  return A;
}
// a mesh's geometry in its parent's frame, as plain floats (gltfpack stores positions as small integers plus a node scale: stretching those
// raw numbers stretched the whole ski)
function bakeGeo(o) { const g = o.geometry.clone(); for (const k of ['position', 'normal']) { const a = g.attributes[k]; if (!a) continue; const f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); } g.setAttribute(k, new THREE.BufferAttribute(f, 3)); }
  o.updateMatrix(); g.applyMatrix4(o.matrix); return g; }
// how far the binding reaches along the ski (front or back), so the jump skis only grow beyond it and the binding stays round the boot
function bindingReach(g) { const P = g.attributes.position; let r = 0.12; for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = Math.abs(P.getZ(i)); if (y > 0.003 && z < 0.45 && z > r) r = z; } return r + 0.01; }
const SKI_ONCE = new Set(['start_push', 'takeoff', 'land_telemark', 'stop', 'wipeout', 'sad']);
export async function makeBoarder({ friend = false, url = 'models/foxino-snowboard.glb?v=1' } = {}) {   // (2026-11-25: url: models/foxino-snowrider.glb = the whole Foxino on his board, purple jacket, black ski pants, from Tripo + Claudee RCC)
  const gl = await loadGLB(url), inner = gl.scene;
  inner.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(inner), s = 1.3 / Math.max(0.1, box.max.y - box.min.y);
  inner.scale.setScalar(s); inner.rotation.y = -Math.PI / 2;   // (faces +Z, board nose +X in the file: turned like the old rider, sideways down the slope)
  inner.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = !friend; if (friend) o.userData.noCast = true; const m = o.material = o.material.clone(); if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; m.roughness = 0.75; if (friend) m.color.set(0xffd7b0); } });
  const g = new THREE.Group(); g.add(inner); scene.add(g);
  const mixer = new THREE.AnimationMixer(inner), acts = {};
  for (const c of gl.animations) { const a = mixer.clipAction(c); if (ONCE_CLIPS.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } acts[c.name] = a; }
  const A = { g, isClip: true, cur: '', skis: [], poles: [], board: null, skiYaw: [0, 0], skiPitch: 0, skiFree: false, clips: Object.keys(acts), dur: Object.fromEntries(gl.animations.map((c) => [c.name, c.duration])),
    want(name, fade = 0.18, speed = 1) { const a = acts[name]; if (!a) return; a.timeScale = speed; if (name === A.cur) return; const old = acts[A.cur]; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play(); if (old) a.crossFadeFrom(old, fade, false); A.cur = name; },
    again(name, speed = 1) { A.cur = ''; A.want(name, 0.12, speed); },
    pose() {}, update(dt = 1 / 60) { mixer.update(Math.min(0.1, dt)); A.face.auto(A.cur); A.face.update(E.freeze ? 0 : Math.min(0.1, dt)); } };   // (F3/F4: the same face as the skier)
  A.face = faceRig(inner); A.smile = (s) => A.face.smile(s); A.mouth = (st) => { A.face.hold = st || null; };
  A.want('stance_idle', 0);
  return A;
}
// the ski poses (the old rig's joints: legs/arms negative x = forward, knees positive = bend, spine positive = lean forward)
export const SP = {
  tuck(t, k = 1) { const p = blankPose(), b = 0.01 * Math.sin(t * 7);
    p.legL = [-1.0 * k - 0.1, 0, 0.05]; p.legR = [-1.0 * k - 0.1, 0, -0.05]; p.kneeL = [1.55 * k + 0.2, 0, 0]; p.kneeR = [1.55 * k + 0.2, 0, 0];
    p.ankleL = [-0.6 * k - 0.1, 0, 0]; p.ankleR = [-0.6 * k - 0.1, 0, 0]; p.spine = [0.75 * k + 0.1, 0, 0]; p.neck = [-0.35 * k, 0, 0]; p.head = [-0.35 * k, 0, 0];
    p.armL = [-0.9, 0, 0.25]; p.armR = [-0.9, 0, -0.25]; p.elbowL = [-1.4, 0, 0]; p.elbowR = [-1.4, 0, 0]; p.y = -0.13 * k - 0.02 + b; return p; },
  // carving: lean (rad, + = into a left turn), knees bent, arms forward with the poles
  carve(t, lean = 0, crouch = 0.5) { const p = blankPose(), b = 0.008 * Math.sin(t * 9);
    const c = 0.35 + crouch * 0.5;
    p.legL = [-c, 0, 0.06 + lean * 0.3]; p.legR = [-c, 0, -0.06 + lean * 0.3]; p.kneeL = [c * 1.6, 0, 0]; p.kneeR = [c * 1.6, 0, 0];
    p.ankleL = [-c * 0.6, 0, 0]; p.ankleR = [-c * 0.6, 0, 0]; p.hips = [0, -lean * 0.4, lean * 0.5]; p.spine = [0.3 + crouch * 0.25, lean * 0.2, -lean * 0.45];
    p.head = [-0.2, lean * 0.25, lean * 0.3]; p.armL = [-0.55, 0, 0.32 + lean * 0.2]; p.armR = [-0.55, 0, -0.32 + lean * 0.2]; p.elbowL = [-0.9, 0, 0]; p.elbowR = [-0.9, 0, 0];
    p.y = -0.06 - crouch * 0.07 + b; return p; },
  stand(t) { const p = blankPose(), br = Math.sin(t * 2.2);
    p.legL = [-0.2, 0, 0.05]; p.legR = [-0.2, 0, -0.05]; p.kneeL = [0.35, 0, 0]; p.kneeR = [0.35, 0, 0]; p.ankleL = [-0.15, 0, 0]; p.ankleR = [-0.15, 0, 0];
    p.spine = [0.12, 0, 0]; p.armL = [-0.3, 0, 0.3]; p.armR = [-0.3, 0, -0.3]; p.elbowL = [-0.8, 0, 0]; p.elbowR = [-0.8, 0, 0]; p.head = [0.02 * br, 0.1 * Math.sin(t * 0.6), 0]; p.y = -0.02 + 0.004 * br; return p; },
  cheer(t) { const p = blankPose(), b = Math.abs(Math.sin(t * 6));
    p.armL = [-0.6, 0, 2.5]; p.armR = [-0.6, 0, -2.5]; p.elbowL = [-0.4, 0, 0]; p.elbowR = [-0.4, 0, 0]; p.spine = [-0.1, 0, 0]; p.head = [-0.25, 0, 0];
    p.legL = [-0.15, 0, 0.06]; p.legR = [-0.15, 0, -0.06]; p.kneeL = [0.25, 0, 0]; p.kneeR = [0.25, 0, 0]; p.y = 0.05 * b; return p; },
  wobble(t) { const p = SP.carve(t, Math.sin(t * 14) * 0.5, 0.2); p.armL = [-0.8, 0, 1.4 + Math.sin(t * 11) * 0.4]; p.armR = [-0.8, 0, -1.4 + Math.sin(t * 13) * 0.4]; p.elbowL = [-0.2, 0, 0]; p.elbowR = [-0.2, 0, 0]; return p; },
};

// ---------- particles: falling snow round the camera, snow spray from the skis ----------
function makeFlakes(n = 700) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), sp = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; sp[i] = 0.6 + Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('sp', new THREE.BufferAttribute(sp, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uA: { value: 0.8 } },
    vertexShader: `attribute float sp; uniform float uT; uniform vec3 uC; varying float vA;
      void main() { vec3 p = position; p.y = mod(p.y - uT * sp * 1.6, 30.0); p.x += sin(uT * sp + p.y) * 0.6;
        p.xz = mod(p.xz - uC.xz + 30.0, 60.0) - 30.0 + uC.xz; p.y += uC.y - 12.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(sp * 70.0 / -mv.z, 1.5, 9.0); vA = smoothstep(0.5, 4.0, -mv.z); }`,
    fragmentShader: `uniform float uA; varying float vA; void main() { vec2 d = gl_PointCoord - .5; float a = smoothstep(.5, .15, length(d)); gl_FragColor = vec4(1.0, 1.0, 1.0, a * vA * uA); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts); return pts;
}
const SPRAY = (() => {
  const N = 260, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), life = new Float32Array(N), size = new Float32Array(N);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('life', new THREE.BufferAttribute(life, 1)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const vel = new Float32Array(N * 3); let next = 0;
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'attribute float life; attribute float size; varying float vL; void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * (1.0 + (1.0 - life) * 1.5) * 260.0 / -mv.z; }',
    fragmentShader: 'varying float vL; void main(){ if (vL <= 0.0) discard; vec2 d = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(d)) * vL * 0.85; gl_FragColor = vec4(0.96, 0.98, 1.0, a); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  return {
    emit(p, n, vx = 0, vy = 2, vz = 0, spread = 1.5, sz = 0.12) {
      for (let k = 0; k < n; k++) { const i = next; next = (next + 1) % N;
        pos[i * 3] = p.x + (Math.random() - 0.5) * 0.3; pos[i * 3 + 1] = p.y + Math.random() * 0.1; pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.3;
        vel[i * 3] = vx + (Math.random() - 0.5) * spread; vel[i * 3 + 1] = vy * (0.5 + Math.random()); vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread; life[i] = 1; size[i] = sz * (0.6 + Math.random() * 0.8); }
    },
    update(dt) {
      for (let i = 0; i < N; i++) { if (life[i] <= 0) continue; life[i] -= dt * 1.4; vel[i * 3 + 1] -= 6 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; }
      g.attributes.position.needsUpdate = true; g.attributes.life.needsUpdate = true; g.attributes.size.needsUpdate = true;
    },
  };
})();

// ---------- game time: waits run on frames (slow phones never race) ----------
const E = {
  THREE, scene, camera, renderer, sun, hemi, rim, POSTFX, T: 0, dt: 0, timeScale: 1, slow: 1, sport: SPORT,
  loadGLB, loadJSON, dressModel, bannerMaterial, instanceField, addMountains, makeActor, makeBoarder, makeSkier, prop, SP, clamp, lerp, damp, smooth, spray: SPRAY,
  drawDist: 230, sfx, waiters: [], camPos: new THREE.Vector3(0, 5, -10), camLook: new THREE.Vector3(), camFov: 60, camK: 5, shakeA: 0, groundAt: null, focus: 12,
  combo: 0, right: 0, asked: 0, missed: [], running: false, FRIEND_KIT, WINTER_KIT,
};
E.faceRig = faceRig;   // (tests)
E.wait = (s) => new Promise((res) => E.waiters.push({ t: E.T + s, res }));
E.until = (fn) => new Promise((res) => E.waiters.push({ fn, res }));
E.shake = (a) => { E.shakeA = Math.max(E.shakeA, a); };
E.cine = (on) => document.body.classList.toggle('cine', !!on);
// the camera: the sports set a target (position, look-at, fov); it damps there (k), never goes under the ground
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3(), _sh = new THREE.Vector3();
let camInit = false;
// (2026-11-25) a sport can add its own far-away pieces (instanced forests): hidden past the draw distance like the props
E.far = (obj) => obj.traverse((m) => { if (!m.isMesh) return; if (m.isInstancedMesh) { if (!m.boundingSphere) m.computeBoundingSphere(); } else if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); if (!FAR.includes(m)) FAR.push(m); });
E.cam = (pos, look, k = 5, fov = null) => { E.camTargetPos = pos; E.camTargetLook = look; E.camK = k; if (fov) E.camFov = fov; };
E.snapCam = () => { camInit = false; };
// three bubble positions round a point, spread across the screen (the camera's right) and a little up: left, top, right
const _cr = new THREE.Vector3(), _cu = new THREE.Vector3();
E.around = (P, out, spread = 2.2, up = 1.6) => {
  _cr.setFromMatrixColumn(camera.matrixWorld, 0).normalize(); _cu.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  out[0].copy(P).addScaledVector(_cr, -spread).addScaledVector(_cu, up * 0.7);
  out[1].copy(P).addScaledVector(_cu, up * 1.35);
  out[2].copy(P).addScaledVector(_cr, spread).addScaledVector(_cu, up * 0.7);
};
function updateCamera(rdt) {
  if (E.camOverride) { E.camTargetPos = E.camOverride.pos; E.camTargetLook = E.camOverride.look; E.camK = 50; }   // (tests)
  if (!E.camTargetPos) return;
  if (!camInit) { _cp.copy(E.camTargetPos); _cl.copy(E.camTargetLook); camInit = true; }
  const k = 1 - Math.exp(-E.camK * rdt);
  _cp.lerp(E.camTargetPos, k); _cl.lerp(E.camTargetLook, Math.min(1, k * 1.6));
  if (E.groundAt) { const gy = E.groundAt(_cp.x, _cp.z); if (gy != null && _cp.y < gy + 0.8) _cp.y = gy + 0.8; }
  camera.position.copy(_cp);
  E.shakeA = Math.max(0, E.shakeA - rdt * 2.5);
  if (E.shakeA > 0) { const s = E.shakeA * E.shakeA * 0.35; _sh.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s); camera.position.add(_sh); }
  camera.lookAt(_cl);
  const asp = innerWidth / innerHeight, base = asp < 1 ? E.camFov : E.camFov * 0.78;
  if (Math.abs(camera.fov - base) > 0.05) { camera.fov = damp(camera.fov, base, 4, rdt); camera.updateProjectionMatrix(); }
}

// ---------- the question moment ----------
const PACKS = window.FSQ ? FSQ.packs() : [];
let packIds = (store.get('sports-packs', null) || store.get('tennis-packs', []) || []).filter((id) => PACKS.some((p) => p.id === id));
if (!packIds.length && PACKS.length) packIds = [PACKS[0].id];
const bubbles = TINTS.map((c) => { const b = makeBubble(c); b.mesh.visible = false; b.mesh.renderOrder = 6; scene.add(b.mesh); return Object.assign(b, { at: new THREE.Vector3(), s: 0, target: 0 }); });
const labelEls = CSS_TINTS.map((c, k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'blabel'; b.style.setProperty('--c', c); b.innerHTML = '<span></span>';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); if (ASK && !ASK.done) answer(k); });
  $('labels').appendChild(b); return b;
});
addEventListener('keydown', (e) => { if (ASK && !ASK.done && /^[1-3]$/.test(e.key)) answer(+e.key - 1); });
let ASK = null;
// (universal content) the word labels stay on screen, below the sentence card and apart from each other, whatever their length
const LAY = [0, 1, 2].map(() => ({ x: 0, y: 0, on: false }));
function layoutLabels() {
  if (document.body.classList.contains('tabs')) { for (const el of labelEls) el.style.transform = ''; return; }   // (2026-11-26, H33: the answers as buttons: the sport's CSS lays them out)
  const W = innerWidth, H = innerHeight, cardEl = $('card'), top = (!cardEl.classList.contains('hidden') ? cardEl.getBoundingClientRect().bottom : 60) + 8, bot = H - 50, gap = 6;
  const L = LAY.map((p, i) => ({ i, x: p.x, y: p.y, w: labelEls[i].offsetWidth || 80, h: labelEls[i].offsetHeight || 50, on: p.on && !labelEls[i].hidden })).filter((p) => p.on);
  if (!L.length) return;
  L.sort((a, b) => a.x - b.x);
  const total = L.reduce((t, p) => t + p.w, 0) + gap * (L.length - 1);
  if (total <= W - 12) {
    for (let k = 1; k < L.length; k++) { const a = L[k - 1], b = L[k]; const min = a.x + a.w / 2 + gap + b.w / 2; if (b.x < min) b.x = min; }
    const over = L[L.length - 1].x + L[L.length - 1].w / 2 - (W - 6); if (over > 0) L.forEach((p) => { p.x -= over; });
    const under = 6 - (L[0].x - L[0].w / 2); if (under > 0) L.forEach((p) => { p.x += under; });
  } else {
    // too wide for one row: left and right on one row, the middle one under them
    const row = [L[0], L[L.length - 1]], mid = L.length === 3 ? L[1] : null;
    row[0].x = 6 + row[0].w / 2; row[1].x = W - 6 - row[1].w / 2;
    if (mid) { mid.x = W / 2; mid.y = Math.max(mid.y, Math.max(row[0].y + row[0].h / 2, row[1].y + row[1].h / 2) + gap + mid.h / 2); }
  }
  for (const p of L) {
    p.x = clamp(p.x, 6 + p.w / 2, W - 6 - p.w / 2); p.y = clamp(p.y, top + p.h / 2, bot - p.h / 2);
    labelEls[p.i].style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`; LAY[p.i].fx = p.x; LAY[p.i].fy = p.y;
  }
  // rows that now overlap vertically after the clamp: push the lower one down
  L.sort((a, b) => a.y - b.y);
  for (let k = 1; k < L.length; k++) { const a = L[k - 1], b = L[k]; if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && b.y - a.y < (a.h + b.h) / 2 + gap) { b.y = a.y + (a.h + b.h) / 2 + gap; labelEls[b.i].style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`; LAY[b.i].fy = b.y; } }
  // the 3D bubble follows its label (same depth)
  for (const p of L) { const q = LAY[p.i]; _pv.set(q.fx / W * 2 - 1, -(q.fy / H) * 2 + 1, q.z).unproject(camera); bubbles[p.i].mesh.position.copy(_pv); }
}
// opts.anchors(out[3]) fills three world positions for the bubbles (updated every frame); opts.size: bubble radius
E.ask = (opts = {}) => new Promise((resolve) => {
  const q = window.FSQ ? FSQ.make(PACKS, packIds, { n: 3, count: E.asked }) : null;
  if (!q) { resolve({ ok: true, k: 0, skipped: true }); return; }
  E.asked++;
  ASK = { q, opts, t0: performance.now(), done: false, resolve, pos: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
  $('sentence').innerHTML = `${hints(q.before)}<span class="gap">&nbsp;</span>${hints(q.after)}`;
  $('note').className = ''; $('note').textContent = opts.note || 'Tap the right word';
  $('cardWho').textContent = opts.who || 'TAP THE RIGHT WORD'; $('cardNum').textContent = opts.num || '';
  const tabs = !!opts.tabs; document.body.classList.toggle('tabs', tabs); if (!tabs) $('card').classList.remove('hidden'); document.body.classList.add('asking');   // (H33: opts.tabs = no card, no bubbles: buttons)
  q.words.forEach((w, i) => { const el = labelEls[i]; el.querySelector('span').textContent = w.text; el.classList.toggle('long', w.text.length > 12); el.className = el.className.replace(/\b(right|wrong|off)\b/g, '').trim(); el.classList.add('on'); el.hidden = false; });
  for (let i = q.words.length; i < 3; i++) labelEls[i].hidden = true;
  bubbles.forEach((b, i) => { b.target = !tabs && i < q.words.length ? 1 : 0; b.u.uGlow.value = 0; b.u.uAlpha.value = 1; });
  E.slow = opts.slow ?? 0.06; if (opts.onQ) { try { opts.onQ(q); } catch (e) { console.warn(e); } }
  sfx.bubble && sfx.bubble();
  // (tests) the bot answers by itself: right, except every 4th question (?bot=1), or always wrong (?bot=wrong)
  if (BOT) setTimeout(() => { if (ASK && ASK.q === q && !ASK.done) answer(BOT === 'wrong' ? (q.correct + 1) % q.words.length : (BOT === '1' && E.asked % 4 === 0) ? (q.correct + 1) % q.words.length : q.correct); }, 900 / SPEED);
});
// (2026-11-24) a question can be closed unanswered (Ski Jump: the ramp ends while it is up): it counts neither way
window.MPBOT = { q: () => (ASK && !ASK.done ? { id: 's' + E.asked, correct: ASK.q.correct, n: ASK.q.words.length } : null), answer: (k) => answer(k) };   // (tests: the two-player bot)
E.cancelAsk = () => { const A = ASK; if (!A) return; A.done = true; labelEls.forEach((el) => el.classList.remove('on')); bubbles.forEach((b) => { b.target = 0; });
  $('card').classList.add('hidden'); document.body.classList.remove('asking', 'tabs'); E.slow = 1; ASK = null; A.resolve({ ok: false, cancelled: true, skipped: true }); };
E.sfx = sfx;
function answer(k) {
  const A = ASK; if (!A || A.done) return; A.done = true;
  const q = A.q, ok = k === q.correct, secs = (performance.now() - A.t0) / 1000;
  labelEls.forEach((el, i) => { el.classList.add('off'); if (i === q.correct) el.classList.add('right'); else if (i === k) el.classList.add('wrong'); else el.classList.add('wrong'); });
  bubbles.forEach((b, i) => { if (i === q.correct) { b.u.uGlow.value = 1; } });
  $('sentence').innerHTML = `${hints(q.before)}<span class="gap ok">${esc(q.right)}</span>${hints(q.after)}`;
  $('note').className = ok ? 'good' : 'bad'; $('note').innerHTML = ok ? 'Yes!' : `The right word: <b>${esc(q.right)}</b>`;
  if (ok) { E.right++; E.combo++; sfx.pop && sfx.pop(true); vib(25); } else { E.combo = 0; E.missed.push(q); sfx.pop && sfx.pop(false); vib([40, 50, 40]); }
  renderCombo();
  setTimeout(() => {
    if (ASK !== A) return;   // (a newer question is up already)
    labelEls.forEach((el) => el.classList.remove('on')); bubbles.forEach((b) => { b.target = 0; });
    $('card').classList.add('hidden'); document.body.classList.remove('asking', 'tabs'); E.slow = 1; ASK = null;
  }, ok ? 650 : 1500);
  A.resolve({ ok, k, secs, q, grade: !ok ? 'bad' : secs < 4 ? 'perfect' : secs < 8 ? 'great' : 'good' });
}
function renderCombo() {
  const el = $('combo');
  if (E.combo >= 2) { el.hidden = false; el.innerHTML = `🔥 <b>${E.combo}</b> in a row`; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } else el.hidden = true;
}
// a floating word over a point in the world (PERFECT! / OOPS!) and a coloured edge flash
const _pv = new THREE.Vector3();
E.pop = (text, at, cls = 'perfect', small = '') => {
  _pv.copy(at).project(camera); let x = (_pv.x * 0.5 + 0.5) * innerWidth, y = (-_pv.y * 0.5 + 0.5) * innerHeight;
  const d = document.createElement('div'); d.className = `ptext ${cls}`;
  d.innerHTML = `${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}`; $('fxText').appendChild(d); const ew = d.offsetWidth * 1.3, eh = d.offsetHeight * 1.3;
  // (2026-11-26 night: a word over Foxino goes to a clear spot: above any answer bubbles still showing, else beside them, never on them or the card)
  const rs = []; bubbles.forEach((b) => { if (!b.mesh.visible || b.s < 0.3) return; const r = ((ASK && ASK.opts.size) || 0.75) * b.s; _pv.copy(b.at).project(camera); const cy = (-_pv.y * 0.5 + 0.5) * innerHeight, cx = (_pv.x * 0.5 + 0.5) * innerWidth;
    _pv.copy(b.at).setY(b.at.y + r).project(camera); const rp = Math.abs(cy - (-_pv.y * 0.5 + 0.5) * innerHeight); rs.push([cx - rp, cy - rp, cx + rp, cy + rp]); });
  const cardEl = $('card'), card = cardEl && !cardEl.classList.contains('hidden') ? cardEl.getBoundingClientRect().bottom : 0;
  if (rs.length) { const top = Math.min(...rs.map((r) => r[1])), bot = Math.max(...rs.map((r) => r[3])), lo = Math.min(...rs.map((r) => r[0])), hi = Math.max(...rs.map((r) => r[2]));
    if (y + eh / 2 > top - 8 && y - eh / 2 < bot + 8) {
      if (top - 10 - eh >= card + 8) { x = (lo + hi) / 2; y = top - 10 - eh / 2; }
      else if (innerWidth - hi >= ew + 20) { x = hi + 10 + ew / 2; y = (top + bot) / 2; }
      else if (lo >= ew + 20) { x = lo - 10 - ew / 2; y = (top + bot) / 2; }
      else { x = (lo + hi) / 2; y = Math.max(card + eh / 2 + 6, top - 10 - eh / 2); } } }   /* (never below: that is where Foxino is) */
  y = Math.max(y, card + eh / 2 + 6);
  d.style.left = `${clamp(x, ew / 2 + 6, innerWidth - ew / 2 - 6)}px`; d.style.top = `${clamp(y, 60, innerHeight - 60)}px`;
  setTimeout(() => d.remove(), 1300); E._popUntil = performance.now() + 1000;
  const bn = $('banner'); if (bn && !bn.hidden && bn.innerHTML) bn.classList.add('cm-lift');   /* (a banner already up moves out of its way) */
};
E.flash = (col) => { const f = $('flash'); f.style.transition = 'none'; f.style.boxShadow = `inset 0 0 120px 30px ${col}`; f.style.opacity = '1'; void f.offsetWidth; f.style.transition = 'opacity .6s'; f.style.opacity = '0'; };
E.juice = (r, at, extra = '') => {
  bubbles.forEach((b) => { if (!b.target) b.s = Math.min(b.s, 0.25); });   /* (2026-11-26 night: the answered bubbles snap away as the word pops, so it never sits on them) */
  if (r.ok) { const w = { perfect: 'PERFECT!', great: 'GREAT!', good: 'GOOD!' }[r.grade] || 'GOOD!'; E.pop(w, at, r.grade === 'perfect' ? 'perfect' : 'good', extra); E.flash('rgba(120,255,170,.55)'); E.shake(0.35); sfx.star && sfx.star(Math.min(3, E.combo)); }
  else { E.pop('OOPS!', at, 'bad', extra); E.flash('rgba(255,80,100,.6)'); E.shake(0.6); sfx.thud && sfx.thud(); }
};
E.banner = (txt, small = '', ms = 1400) => { const wait = (E._popUntil || 0) - performance.now(); if (wait > 0 && innerHeight < 560) { setTimeout(() => E.banner(txt, small, ms), wait); return; }   /* (a short landscape screen has no room for both: the call-out waits until the word over Foxino has gone) */
  const b = $('banner'); b.innerHTML = `${esc(txt)}${small ? `<small>${esc(small)}</small>` : ''}`;
  b.classList.toggle('cm-bad', /WIPEOUT|OOPS|TOO SLOW|WEAK|LEFT/i.test(`${txt} ${small}`)); b.classList.toggle('cm-lift', $('fxText').children.length > 0);   /* (2026-11-26 night: the comic style; never on top of a word floating over Foxino) */ b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); b.hidden = false; clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, ms); };
E.hud = (big, small = '') => { $('hudBig').textContent = big; $('hudSmall').textContent = small; };
E.progress = (u) => { $('progMe').style.left = `${clamp(u, 0, 1) * 100}%`; };
E.fmtTime = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : r.toFixed(1); };

// ---------- (2026-11-25) the match channel: a start together (E.sync), our live state 10 times a second (E.mpSend), theirs (E.mpFriend) ----------
E.MP = MP; E.mpFriend = null; E.mpMsgs = [];
const SEEN = new Set(), SYNCW = [];
let mpLast = 0;
E.mpSend = (st) => { if (!MP.on || !MP.alive) return; const now = performance.now(); if (now - mpLast < 95) return; mpLast = now; MP.send({ t: 'st', st }); };
E.sync = (tag, ms = 15000) => { if (!MP.on || !MP.alive) return Promise.resolve(false); MP.send({ t: 'sync', tag }); if (SEEN.has(tag)) return Promise.resolve(true);
  return new Promise((res) => { const w = { tag, res }; SYNCW.push(w); w.t = setTimeout(() => { SYNCW.splice(SYNCW.indexOf(w), 1); res(false); }, ms); }); };
if (MP.on) {
  MP.listen((m) => {
    if (m.t === 'st') { E.mpFriend = Object.assign(E.mpFriend || {}, m.st, { at: performance.now() }); return; }
    if (m.t === 'sync') { SEEN.add(m.tag); for (const w of SYNCW.slice()) if (w.tag === m.tag) { clearTimeout(w.t); SYNCW.splice(SYNCW.indexOf(w), 1); w.res(true); } return; }
    E.mpMsgs.push(m); if (E.onMp) E.onMp(m);
  });
  MP.onLost(() => { E.mpFriend = null; for (const w of SYNCW.splice(0)) { clearTimeout(w.t); w.res(false); } E.banner(`${MP.fname.toUpperCase()} LEFT`, 'you go on alone', 1800); });
}
// ---------- the friend (inside the lobby: the parent page relays our state to the friend's phone and theirs to us) ----------
E.friend = null;   // {name, p (progress 0..1), v (display value), x, y, z, yaw, extra, done, score}
let lastSend = 0;
E.send = (st) => { if (!PARTY) return; const now = performance.now(); if (now - lastSend < 160 && !st.done) return; lastSend = now; window.parent.postMessage({ snow: 'state', sport: SPORT, st }, '*'); };
addEventListener('message', (e) => {
  const m = e.data; if (!m || typeof m !== 'object' || e.source !== window.parent) return;
  if (m.snowFriend && m.sport === SPORT) { E.friend = Object.assign(E.friend || {}, m.snowFriend); if (m.name) E.friend.name = m.name; }
});
if (PARTY) { $('friendChip').classList.remove('hidden'); $('progFr').classList.remove('hidden'); $('friendName').textContent = (Q.get('fname') || 'FRIEND').toUpperCase().slice(0, 12); }
function updateFriendHud() {
  if (!PARTY || !E.friend) return;
  $('friendVal').textContent = E.friend.v ?? '–';
  $('progFr').style.left = `${clamp(E.friend.p || 0, 0, 1) * 100}%`;
}

// ---------- the result ----------
const MEDALS = ['', '🥉', '🥈', '🥇'];
E.medalFor = () => { const f = E.asked ? E.right / E.asked : 1; return f >= 0.9 ? 3 : f >= 0.7 ? 2 : f >= 0.4 ? 1 : 0; };
E.finish = async ({ score, shown, unit, better = 'high', line = '' }) => {
  E.running = false;
  const medal = E.medalFor(), key = `snow-best-${(MOD && MOD.bestKey) || SPORT}`, best = store.get(key, null);   // (a sport can keep a new best when its run changes)
  const isBest = best == null || (better === 'high' ? score > best : score < best);
  if (isBest) store.set(key, score);
  E.send({ done: true, score, v: shown, medal });
  if (LIST && window.parent !== window) window.parent.postMessage({ fsnow: 'finished', sport: SPORT, score, shown, unit, better, medal, right: E.right, asked: E.asked }, '*');
  await E.wait(LIST ? 2.2 : 1.6);
  if (LIST) return;
  $('endKick').textContent = NAMES[SPORT]; $('endMedal').textContent = MEDALS[medal] || '';
  $('endTitle').textContent = medal === 3 ? 'Gold medal!' : medal === 2 ? 'Silver medal!' : medal === 1 ? 'Bronze medal!' : 'Keep practising!';
  $('endScore').textContent = shown; $('endUnit').textContent = unit;
  $('endLine').innerHTML = `${E.right} of ${E.asked} right${isBest ? ' · <b>new best!</b>' : best != null ? ` · best ${esc(E.bestShown ? E.bestShown(best) : best)}` : ''}${line ? `<br>${esc(line)}` : ''}`;
  const ml = $('missedList'); ml.innerHTML = E.missed.slice(-6).map((q) => `<li>${hints(q.before)}<b>${esc(q.right)}</b>${hints(q.after)}</li>`).join('');
  $('missed').classList.toggle('hidden', !E.missed.length);
  $('end').classList.remove('hidden'); $('hud').classList.add('hidden');
  if (medal >= 2) { sfx.cheer && sfx.cheer(); vib([30, 40, 60]); }
};

// ---------- the loop ----------
let last = performance.now(), MOD = null, flakes = null;
function resize() { renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
const _sun = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
  renderer.info.reset();
  if (POSTFX.governor(rdt) && pr > 1) { pr = Math.max(1, pr - 0.25); resize(); }
  // the question slow-motion eases in and out
  E.timeScale = damp(E.timeScale, E.slow, E.slow < 1 ? 9 : 4, rdt);
  const dt = E.freeze ? 0 : rdt * E.timeScale; E.dt = dt; E.rdt = rdt; E.T += dt; TIME.value += rdt;   // (E.freeze: tests and card pictures)
  for (let i = E.waiters.length - 1; i >= 0; i--) { const w = E.waiters[i]; if ((w.fn && w.fn()) || (!w.fn && E.T >= w.t)) { E.waiters.splice(i, 1); w.res(); } }
  if (MOD && MOD.update) MOD.update(E, dt, rdt);
  // the bubbles follow their anchors
  if (ASK && ASK.opts.anchors) ASK.opts.anchors(ASK.pos);
  bubbles.forEach((b, i) => {
    b.s = damp(b.s, b.target, b.target ? 10 : 14, rdt); b.mesh.visible = b.s > 0.02; b.u.uTime.value += rdt;
    if (ASK) b.at.copy(ASK.pos[i]);
    const r = (ASK && ASK.opts.size) || 0.75;
    b.mesh.position.copy(b.at); b.mesh.scale.setScalar(r * b.s * (1 + 0.04 * Math.sin(E.T * 3 + i)));
    if (b.mesh.visible) { _pv.copy(b.at).project(camera); LAY[i].x = (_pv.x * 0.5 + 0.5) * innerWidth; LAY[i].y = (-_pv.y * 0.5 + 0.5) * innerHeight; LAY[i].z = _pv.z; LAY[i].on = true; } else LAY[i].on = false;
  });
  layoutLabels();
  updateCamera(rdt);
  // the sun's shadow box follows the camera's focus
  if (E.focusAt) { _sun.copy(SUN_DIR).multiplyScalar(90); sun.position.copy(E.focusAt).add(_sun); sun.target.position.copy(E.focusAt); rim.position.copy(E.focusAt).add(_sun.set(0.5, 0.4, 0.8).multiplyScalar(60)); rim.target = sun.target; }
  for (const o of FAR) { const bs = o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere; if (!bs) continue; _fc.copy(bs.center).applyMatrix4(o.matrixWorld); o.visible = _fc.distanceTo(camera.position) - bs.radius * (o.isInstancedMesh ? 1 : o.matrixWorld.getMaxScaleOnAxis()) < E.drawDist; }
  if (E.fogColor != null) scene.fog.color.setHex(E.fogColor);
  if (MOUNT) MOUNT.position.set(camera.position.x, camera.position.y + MOUNT.userData.y, camera.position.z);
  if (flakes) { flakes.material.uniforms.uT.value += rdt; flakes.material.uniforms.uC.value.copy(camera.position); }
  for (const l of XMAS.lights) l.update(TIME.value);
  SPRAY.update(dt);
  updateFriendHud();
  POSTFX.draw(scene, camera, E.focus);
  E.tris = renderer.info.render.triangles; E.calls = renderer.info.render.calls; E.maxTris = Math.max(E.maxTris || 0, E.tris);
}

// ---------- start ----------
function renderStart() {
  $('startTitle').textContent = NAMES[SPORT]; $('startSub').textContent = (MOD && MOD.blurb) || '';
  const best = store.get(`snow-best-${(MOD && MOD.bestKey) || SPORT}`, null); $('bestLine').textContent = best != null ? `Your best: ${MOD && MOD.bestShown ? MOD.bestShown(best) : best}` : '';
  const ps = packIds.map((id) => PACKS.find((p) => p.id === id)).filter(Boolean);
  const label = (p) => (window.FugioPacks && FugioPacks.label ? FugioPacks.label(p) : p.level);
  $('packBtn').innerHTML = ps.length ? `${esc(ps.length > 1 ? `${ps.length} packages` : ps[0].title)}<small>${esc(ps.map(label).join(' · '))} · change the words ›</small>` : 'Choose the words ›';
}
$('packBtn').onclick = async () => { if (!window.FugioPacks) return; const ids = await FugioPacks.open(PACKS, packIds, { theme: 'gummy' }); if (ids && ids.length) { packIds = ids; store.set('sports-packs', ids); renderStart(); } };
async function play() {
  $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
  E.right = 0; E.asked = 0; E.combo = 0; E.missed = []; renderCombo(); E.running = true;
  if (MP.on && !E.mpStarted) { E.mpStarted = true; E.banner('GET READY', `with ${MP.fname}`, 1500); const ok = await MP.ready(90000); if (ok) await E.sync('start', 30000); }
  await MOD.run(E);
}
$('playBtn').onclick = () => { unlock(); sfx.click && sfx.click(); play(); };
$('againBtn').onclick = () => { unlock(); sfx.click && sfx.click(); MOD.reset && MOD.reset(E); play(); };
$('menuBtn').onclick = () => { sfx.click && sfx.click(); $('end').classList.add('hidden'); MOD.reset && MOD.reset(E); MOD.menu && MOD.menu(E); $('start').classList.remove('hidden'); renderStart(); };
$('leaveBtn').onclick = () => { sfx.click && sfx.click(); if (window.parent !== window) window.parent.postMessage({ fugio: 'leave' }, '*'); else location.href = '/sports/'; };
$('muteBtn').onclick = () => { setMuted(!isMuted()); $('muteBtn').classList.toggle('muted', isMuted()); };
$('muteBtn').classList.toggle('muted', isMuted());

(async () => {
  resize();
  const bar = (p, t) => { $('loadBar').style.width = `${p}%`; if (t) $('loadTxt').textContent = t; };
  $('loadTitle').textContent = NAMES[SPORT] || 'SNOW SPORTS';
  try {
    bar(10, 'Grooming the snow…');
    MOD = (await import(`./${SPORT}.js?v=${({ slalom: 9, halfpipe: 25, skijump: 12, sled: 3, biathlon: 3 })[SPORT] || 2}`)).default;   // (per-sport cache versions: bump one sport without the others)
    await loadProps();
    bar(35, 'Building the course…');
    const L = MOD.light || {};
    paintedSky(scene, `sky/${L.sky || 'day'}.webp?v=2`, { yaw: L.skyYaw ?? 0.3, envRenderer: renderer, onFog: () => { if (L.fogColor != null) scene.fog.color.set(L.fogColor); }, base: L.skyBase ?? 0.2, span: L.skySpan ?? 0.85 });
    hemi.color.set(L.hemiSky ?? 0xdbe8ff); hemi.groundColor.set(L.hemiGround ?? 0x9a8fc8); hemi.intensity = L.hemi ?? 1.0;
    sun.color.set(L.sun ?? 0xfff0dc); sun.intensity = L.sunI ?? 2.2; if (L.sunDir) SUN_DIR.set(...L.sunDir).normalize();
    rim.color.set(L.rim ?? 0xbfd6ff); rim.intensity = L.rimI ?? 0.8;
    renderer.toneMappingExposure = L.exposure ?? 1.0;
    if (L.fog) { scene.fog.near = L.fog[0]; scene.fog.far = L.fog[1]; }
    if (L.fogColor != null) E.fogColor = L.fogColor;
    if (L.env != null) scene.environmentIntensity = L.env;
    flakes = makeFlakes(L.flakes ?? 500); flakes.material.uniforms.uA.value = L.flakeA ?? 0.7;
    await MOD.build(E, (p, t) => bar(35 + p * 0.6, t));
    if (MOD.xmas && !/[?&]noxmas=1/.test(location.search)) { try { XK.ok = !!(await loadXmasKit(loader)); await MOD.xmas(E, XK); } catch (e) { console.warn('xmas', e); } }
    bar(100, 'Ready!');
  } catch (e) { console.error(e); $('loadTxt').textContent = 'Could not load: ' + e.message; return; }
  requestAnimationFrame((t) => { last = t; frame(t); });
  setTimeout(() => $('loading').classList.add('gone'), 250);
  renderStart();
  window.SNOW = E;
  if (LIST) play(); else { $('start').classList.remove('hidden'); MOD.menu && MOD.menu(E); }
})();
export default E;
