// Foxino Sports: the winter lobby (2026-11-17, the user: "re-do the Foxino menu: model an Olympic stadium, you are standing
// in front of it, you can invite a friend as it is now, take time on modelling that stadium, make it winter").
// The player's Foxino stands on his glowing platform on a snowy plaza; behind him the big winter Olympic stadium (Blender,
// from the Windows PC: models/ws-*.glb), the rings sculpture, the cauldron with its flame, flags, lamps, pines, an ice rink.
// The code adds what moves: falling snow, the flame, the waving flags, the glowing windows and lamps, the drifting snow
// sparkle, and a simple stand-in of every piece until the PC's models are there.
// World: metres, Y up. Foxino's platform (0, 0, 15.6), the friend's (≈2, 0, 14.6); the camera ≈ (0.8, 1.8, 22) looking
// toward −z; the stadium's main entrance at z ≈ −40, its bowl centred at (0, 0, −78), outer radius 38 m, ~24 m high.
import * as THREE from '/penalty/lib/three.module.min.js';
import { GLTFLoader } from '/penalty/lib/GLTFLoader.js';
import { MeshoptDecoder } from '/adventures/lib/meshopt_decoder.module.js';
import { loadXmasKit, placeKit, stringLights, bulbGlows } from './xmas.js?v=5';   // (2026-11-24: a Christmas touch on the plaza)

export const WS = { stadium: new THREE.Vector3(0, 0, -78), entrance: new THREE.Vector3(0, 0, -40), cauldron: new THREE.Vector3(13, 0, -14), rings: new THREE.Vector3(-11, 0, -8) };
const FILES = ['ws-stadium', 'ws-plaza', 'ws-props', 'ws-far', 'ws-podium', 'ws-front', 'ws-people'];   // (v2: the podium, the foreground, the visitors)
const LOOSE = new Set(['ws-podium', 'ws-people']);   // (pieces the code places itself: not added where they were modelled)

// ---------- falling snow: soft round flakes in a box that follows the camera (one draw call) ----------
function makeSnow(n = 1400) {
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 2 - 1; pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random() * 2 - 1; rnd[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(26, 16, 34) }, uPx: { value: 1 } },
    vertexShader: `attribute float rnd; uniform float uT, uPx; uniform vec3 uC, uBox; varying float vA;
      void main() {
        vec3 p = position; float sp = .55 + rnd * .6;
        p.y = fract(p.y - uT * sp / uBox.y) ;                                   // falling, wrapping in the box
        vec3 w = vec3(p.x * uBox.x, p.y * uBox.y, p.z * uBox.z) + vec3(uC.x, 0.0, uC.z - uBox.z * .55);
        w.x += sin(uT * (.6 + rnd) + rnd * 40.0) * .45; w.z += cos(uT * (.5 + rnd * .7) + rnd * 20.0) * .3;   // drifting
        vec4 mv = modelViewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mv;
        float d = -mv.z; gl_PointSize = uPx * (2.0 + rnd * 3.5) * clamp(22.0 / d, .4, 3.2);
        vA = smoothstep(60.0, 20.0, d) * smoothstep(.0, .06, p.y) * (.55 + rnd * .45);
      }`,
    fragmentShader: `varying float vA; void main() { vec2 q = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(q)) * vA; gl_FragColor = vec4(vec3(1.0, .99, 1.0) * 1.15, a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; pts.userData.noCast = true;
  return pts;
}

// ---------- the cauldron's flame: three crossed, flickering flame cards (additive) + a warm light ----------
function makeFlame(at, h = 3.2) {
  const g = new THREE.Group(); g.position.copy(at);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(n(i), n(i + vec2(1, 0)), f.x), mix(n(i + vec2(0, 1)), n(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 uv = vUv; float y = uv.y; float w = (1.0 - y) * .5 + .04;
        float fl = sn(vec2(uv.x * 4.0, y * 3.0 - uT * 2.6)) * .5 + sn(vec2(uv.x * 9.0, y * 6.0 - uT * 4.1)) * .3;
        float d = abs(uv.x - .5 + (fl - .4) * .22 * y) / w; float a = smoothstep(1.0, .35, d) * smoothstep(1.0, .55 + fl * .35, y) * smoothstep(0.0, .08, y);
        vec3 c = mix(vec3(1.0, .95, .55), vec3(1.0, .42, .12), smoothstep(.15, .8, y + d * .3));
        gl_FragColor = vec4(c * a * 1.6, a);
      }` });
  for (let i = 0; i < 3; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(h * .62, h), m); q.position.y = h * .5; q.rotation.y = i * Math.PI / 3; q.userData.noCast = true; g.add(q); }
  const light = new THREE.PointLight(0xffa04a, 40, 26, 1.6); light.position.y = h * .4; g.add(light);
  g.userData = { m, light };
  return g;
}

// ---------- stand-ins (only until the PC's models are in) ----------
function standIns(scene, missing) {
  const M = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, flatShading: true, emissive: e ? c : 0, emissiveIntensity: e });
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  if (missing.includes('ws-plaza')) {
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(240, 240, 1, 1).rotateX(-Math.PI / 2), M('#eef0ff')); snow.position.set(0, 0, -30); snow.receiveShadow = true; scene.add(snow);
    add(new THREE.BoxGeometry(9, .06, 60), M('#c9c6e8'), 0, .03, 0);   // the walkway
  }
  if (missing.includes('ws-stadium')) {
    const s = WS.stadium;
    add(new THREE.CylinderGeometry(36, 38, 18, 40, 1, true), M('#f3f1ff'), s.x, 9, s.z);
    for (let i = 0; i < 28; i++) { const a = -Math.PI / 2 + (i / 28) * Math.PI * 2; const x = s.x + Math.cos(a) * 38.5, z = s.z + Math.sin(a) * 38.5; if (z < s.z) continue; add(new THREE.BoxGeometry(1.4, 22, 1.4), M('#dcd8f5'), x, 11, z, -a); }
    add(new THREE.TorusGeometry(37, 1.6, 6, 48), M('#ffffff'), s.x, 23, s.z).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(14, 9, 3), M('#ffcf7a', .9), 0, 4.5, WS.entrance.z);
  }
  if (missing.includes('ws-props')) {
    const cols = ['#ffcd1c', '#8f52d9', '#3cc6ef', '#ff7d22', '#ff5fb8'];
    cols.forEach((c, i) => { const k = i < 3 ? i : i - 2.5; add(new THREE.TorusGeometry(1.1, .2, 8, 28), M(c), WS.rings.x + (k - 1) * 2.4, 5.4 - (i > 2 ? 1.1 : 0), WS.rings.z); });
    add(new THREE.BoxGeometry(6, 3.6, 1.4), M('#e8e4ff'), WS.rings.x, 1.8, WS.rings.z);
    add(new THREE.CylinderGeometry(.9, 1.6, 15, 8), M('#e8e4ff'), WS.cauldron.x, 7.5, WS.cauldron.z);
    add(new THREE.CylinderGeometry(2.4, 1.2, 1.4, 12), M('#ffcd1c'), WS.cauldron.x, 15.7, WS.cauldron.z);
    for (const sx of [-1, 1]) for (let z = 6; z >= -34; z -= 5) add(new THREE.CylinderGeometry(.07, .07, 7, 6), M('#ffffff'), sx * 7, 3.5, z);
    for (const sx of [-1, 1]) for (let z = 10; z >= -34; z -= 8) add(new THREE.CylinderGeometry(.09, .12, 4.2, 6), M('#2b2f4a'), sx * 4.5, 2.1, z);
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) add(new THREE.ConeGeometry(1.8, 6, 7), M('#3f7d6a'), sx * (17 + (k % 3) * 4), 3, 12 - k * 6);
    add(new THREE.BoxGeometry(10, .1, 6), M('#bfe6ff'), -15, .05, 6);
  }
}

// ---------- (v2) the LED screen: slides of the logo and the sports (art/*.webp), cross-fading ----------
function makeScreen(o) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  o.traverse((m) => { if (!m.isMesh) return; m.material = mat; m.userData.noCast = true;
    // (packing drops UVs a material does not use: rebuild them from the face, left→right and top→bottom)
    const g = m.geometry; if (!g.attributes.uv) { g.computeBoundingBox(); const b = g.boundingBox, P = g.attributes.position, uv = new Float32Array(P.count * 2), w = Math.max(1e-6, b.max.x - b.min.x), h = Math.max(1e-6, b.max.y - b.min.y);
      for (let i = 0; i < P.count; i++) { uv[i * 2] = (P.getX(i) - b.min.x) / w; uv[i * 2 + 1] = (b.max.y - P.getY(i)) / h; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); } });
  const base = new URL('art/', import.meta.url).href;
  const slides = [{ img: 'logo.webp', t: '' }, { img: 'card-penalties.webp', t: 'PENALTIES' }, { img: 'card-tennis.webp', t: 'TENNIS' }, { img: 'card-halfpipe.webp', t: 'HALFPIPE', v: 2 }, { img: 'card-skijump.webp', t: 'SKI JUMP', v: 2 }].map((s) => { const im = new Image(); im.src = base + s.img + '?v=' + (s.v || 1);   /* (2026-11-25: Streetball is out: the screen shows the four sports left) */ return { ...s, im }; });
  const draw = (sl, a) => { if (!sl.im.complete || !sl.im.naturalWidth) return; g.globalAlpha = a;
    if (!sl.t) { g.fillStyle = '#2a1466'; g.fillRect(0, 0, 1024, 576); const r = Math.min(900 / sl.im.naturalWidth, 420 / sl.im.naturalHeight); const w = sl.im.naturalWidth * r, h = sl.im.naturalHeight * r; g.drawImage(sl.im, 512 - w / 2, 288 - h / 2, w, h); }
    else { const r = 1024 / sl.im.naturalWidth, h = sl.im.naturalHeight * r; g.drawImage(sl.im, 0, 288 - h / 2, 1024, h); g.fillStyle = 'rgba(20,10,50,.55)'; g.fillRect(0, 470, 1024, 106);
      g.font = '800 64px Lilita One, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd84a'; g.fillText(sl.t, 512, 525); }
    g.globalAlpha = 1; };
  let i = 0, t = 0, fade = 1, last = -1;
  return { update(dt) { t += dt; if (t > 4.2) { t = 0; i = (i + 1) % slides.length; fade = 0; } fade = Math.min(1, fade + dt * 1.6);
    if (fade < 1 || last !== i) { draw(slides[(i + slides.length - 1) % slides.length], 1); draw(slides[i], fade); g.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 0; y < 576; y += 4) g.fillRect(0, y, 1024, 1); tex.needsUpdate = true; if (fade >= 1) last = i; } } };
}

// ---------- (2026-11-24) Christmas on the plaza: lights between the walkway lamps, decorated trees by the entrance, a snowman, gifts ----------
async function xmasPlaza(scene, L) {
  const out = []; try { if (!(await loadXmasKit(L))) return out; } catch (e) { return out; }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const sx of [-1, 1]) { const posts = []; for (let z = 10; z >= -34; z -= 8) posts.push(V(sx * 4.5, 3.55, z)); out.push(stringLights(scene, posts, { sag: 0.45, per: 9, size: 0.09, glow: 0.7 })); }
  for (const sx of [-1, 1]) { const t = placeKit(scene, 'XmasTree_Big', sx * 8.6, -26.5, { rot: sx, s: 2.0 }); const g = t && bulbGlows(t, { glow: 1.0 }); if (g) out.push(g);
    placeKit(scene, 'Gift_A', sx * 7.3, -24.6, { rot: sx }); placeKit(scene, 'Gift_C', sx * 9.9, -24.2, { rot: -sx }); placeKit(scene, 'Gift_B', sx * 8.4, -23.6, { rot: 0.5 }); }
  placeKit(scene, 'Snowman', -7.4, 5.2, { rot: 0.6, s: 1.2 }); placeKit(scene, 'XmasTree_Small', -11.5, 3.5, { rot: 1, s: 1.8 }); placeKit(scene, 'CandyCane', -6.6, 7.4, { rot: 0.3 });
  scene.traverse((o) => { if (o.isMesh && o.parent && /Xmas|Gift|Snowman|Candy/.test(o.parent.name || o.name)) o.castShadow = true; });
  return out;
}

// ---------- the scene ----------
export async function makeWinterPlaza(scene) {
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder); const MODELS = {};
  await Promise.all(FILES.map(async (n) => { try { MODELS[n] = (await L.loadAsync(new URL(`models/${n}.glb?v=1`, import.meta.url).href)).scene; } catch (e) { /* not delivered yet */ } }));
  const flags = [], glows = [];
  for (const [n, g] of Object.entries(MODELS)) {
    if (LOOSE.has(n)) continue;
    g.traverse((o) => {
      if (!o.isMesh) return; const m = o.material;
      if (m && m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      if (m && /glow|window|lit|bulb|lamp/i.test(m.name || '')) { o.material = new THREE.MeshBasicMaterial({ color: m.emissive && m.emissive.getHex() ? m.emissive : (m.color || new THREE.Color(1, .85, .5)), map: m.emissiveMap || m.map || null, toneMapped: false }); o.userData.noCast = true; glows.push(o); }
      if (/^(Roof)?Flag/i.test(o.name) || (o.parent && /^(Roof)?Flag/i.test(o.parent.name))) flags.push(o);
      if (/Snow(Ground|Field)|Ground|Decal/i.test(o.name)) o.userData.noCast = true;
    });
    scene.add(g);
  }
  const missing = FILES.filter((n) => !MODELS[n] && ['ws-stadium', 'ws-plaza', 'ws-props'].includes(n));
  { const pl = MODELS['ws-front'] && MODELS['ws-front'].getObjectByName('Planters'); if (pl) pl.position.z -= 7.5; }   // (the PC put them at z 19-20, beside the wide camera: forward, into the picture)
  if (missing.length) standIns(scene, missing);
  // the flame: on the PC's FlameAnchor (an empty on top of the cauldron), or on the stand-in cauldron
  let anchor = null; for (const g of Object.values(MODELS)) { const a = g.getObjectByName('FlameAnchor'); if (a) anchor = a; }
  const fp = anchor ? anchor.getWorldPosition(new THREE.Vector3()) : WS.cauldron.clone().setY(16.3);
  const flame = makeFlame(fp, anchor ? 3.4 : 3.2); scene.add(flame);
  const snow = makeSnow(); scene.add(snow);
  const xmas = /[?&]noxmas=1/.test(location.search) ? [] : await xmasPlaza(scene, L);
  // (v2) the LED screen over the entrance: the Foxino Sports logo and the three sports, changing every few seconds
  let screen = null; for (const g of Object.values(MODELS)) { const o = g.getObjectByName('Screen'); if (o) screen = o; }
  if (screen) screen = makeScreen(screen);
  // (v2) visitors walking up and down the walkway sides, a few standing and looking at the stadium
  const walkers = []; const P = MODELS['ws-people'];
  if (P) { P.updateMatrixWorld(true); const kinds = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => P.getObjectByName('Visitor' + i)).filter(Boolean);
    const spots = [[-5.2, 4, 1], [5.6, 1, -1], [-6, -6, 1], [5, -9, -1], [-5.4, -15, -1], [6.1, -19, 1], [-4.8, -24, 1], [5.4, -28, -1], [-8.6, 2.5, 0], [9.4, 1, 0], [-10.5, -4.5, 0], [11.5, -9.5, 0]];
    spots.forEach(([x, z, dir], i) => { const src = kinds[i % kinds.length]; if (!src) return; const v = src.clone(true); v.position.set(x, 0, z); v.rotation.set(0, dir === 0 ? Math.PI + (x < 0 ? .5 : -.5) : dir > 0 ? Math.PI : 0, 0);
      v.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noCast = true; } }); scene.add(v); walkers.push({ v, x, z, dir, sp: .7 + Math.random() * .5, ph: Math.random() * 6, z0: -30, z1: 6, turn: 0 }); }); }
  const podium = MODELS['ws-podium'] ? (MODELS['ws-podium'].getObjectByName('Podium') || MODELS['ws-podium']) : null;
  // the flags ripple: a travelling wave along the cloth, stronger away from the pole (x = local distance from the pole)
  const FLAGU = { uT: { value: 0 } };
  flags.forEach((f, i) => {
    f.userData.ph = Math.random() * 6; f.userData.r0 = f.rotation.clone();
    if (!f.material || f.userData.rip) return; f.userData.rip = 1;
    const m = f.material.clone(); m.side = THREE.DoubleSide; const ph = (i * 1.7).toFixed(2);
    m.onBeforeCompile = (sh) => { sh.uniforms.uT = FLAGU.uT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float fx = max(position.x, 0.0); transformed.z += sin(fx * 3.2 - uT * 5.0 + ${ph}) * .12 * fx + sin(fx * 7.0 - uT * 8.3 + ${ph}) * .03 * fx;
        transformed.y -= fx * fx * .04;`); };
    m.customProgramCacheKey = () => 'flag' + ph; f.material = m;
  });
  return {
    MODELS, missing, podium,
    update(dt, T, camera, pr) {
      snow.material.uniforms.uT.value = T; snow.material.uniforms.uC.value.copy(camera.position); snow.material.uniforms.uPx.value = pr;
      flame.userData.m.uniforms.uT.value = T; FLAGU.uT.value = T; flame.userData.light.intensity = 36 + Math.sin(T * 17) * 4 + Math.sin(T * 7.3) * 5;
      if (screen) screen.update(dt, T);
      for (const x of xmas) x.update(T);
      for (const w of walkers) {
        if (w.dir === 0) { w.v.rotation.z = Math.sin(T * .9 + w.ph) * .03; w.v.position.y = 0; continue; }   // (standing: a little sway)
        if (w.turn > 0) { w.turn -= dt; w.v.rotation.y += dt * Math.PI / .8; continue; }
        w.z -= w.dir * w.sp * dt; if (w.z < w.z0 || w.z > w.z1) { w.dir *= -1; w.z = Math.max(w.z0, Math.min(w.z1, w.z)); w.turn = .8; }
        w.v.position.set(w.x, Math.abs(Math.sin(T * w.sp * 5.5 + w.ph)) * .045, w.z); w.v.rotation.z = Math.sin(T * w.sp * 5.5 + w.ph) * .04; }
      for (const f of flags) { const r = f.userData.r0; f.rotation.set(r.x, r.y + Math.sin(T * 1.1 + f.userData.ph) * .14, r.z); }
    },
  };
}
