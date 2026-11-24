// FoxSports Christmas (2026-11-24, the user: "Work on increasing the graphics in each sport. Dont change the 3d model of the
// character. Make there snow and every sport should have xmas atmosphere."). Shared by every sport:
//   makeSnowfall()  falling snow in a box that follows the camera (one draw call; small, soft flakes that never hide the ball)
//   snowCover()     snow settled on the TOPS of things: a material patch (up-facing surfaces go white, with a patchy edge);
//                   characters (skinned meshes) and anything in `skip` are never touched
//   stringLights()  warm Christmas lights on a sagging wire between posts: bulbs that twinkle, with a soft glow each
//   loadXmasKit()   the shared prop kit from the PC (trees, wreaths, garlands, a snowman, gifts, lanterns…): kitPart(name)
import * as THREE from '/penalty/lib/three.module.min.js';

// ---------- falling snow ----------
export function makeSnowfall({ n = 1100, box = [26, 16, 34], ahead = 0.55, size = 1, alpha = 0.75 } = {}) {
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 2 - 1; pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random() * 2 - 1; rnd[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uF: { value: new THREE.Vector3(0, 0, -1) }, uBox: { value: new THREE.Vector3(...box) }, uPx: { value: 1 }, uS: { value: size }, uA: { value: alpha }, uAhead: { value: ahead } },
    vertexShader: `attribute float rnd; uniform float uT, uPx, uS, uA, uAhead; uniform vec3 uC, uF, uBox; varying float vA;
      void main() {
        vec3 p = position; float sp = .55 + rnd * .6;
        p.y = fract(p.y - uT * sp / uBox.y);
        vec3 w = vec3(p.x * uBox.x, p.y * uBox.y, p.z * uBox.z) + vec3(uC.x, uC.y - uBox.y * .35, uC.z) + uF * uBox.z * uAhead;
        w.x += sin(uT * (.6 + rnd) + rnd * 40.0) * .45; w.z += cos(uT * (.5 + rnd * .7) + rnd * 20.0) * .3;
        vec4 mv = modelViewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mv;
        float d = -mv.z; gl_PointSize = uPx * uS * (2.0 + rnd * 3.2) * clamp(20.0 / d, .4, 2.6);
        vA = uA * smoothstep(60.0, 18.0, d) * smoothstep(1.2, 3.5, d) * smoothstep(.0, .06, p.y) * (.55 + rnd * .45);   // (never right in front of the lens)
      }`,
    fragmentShader: `varying float vA; void main() { vec2 q = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(q)) * vA; gl_FragColor = vec4(vec3(1.0, .99, 1.0) * 1.1, a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; pts.userData.noCast = true;
  const fw = new THREE.Vector3();
  pts.update = (t, camera, pr = 1) => { m.uniforms.uT.value = t; m.uniforms.uC.value.copy(camera.position); camera.getWorldDirection(fw); fw.y = 0; if (fw.lengthSq() > 1e-4) fw.normalize(); m.uniforms.uF.value.copy(fw); m.uniforms.uPx.value = pr; };
  return pts;
}

// ---------- snow on the tops of things ----------
const SNOW = { a: { value: 0.55 }, b: { value: 0.8 }, amt: { value: 1 }, col: { value: new THREE.Color('#f3f7ff') } };
export function snowCover(root, { skip = [], amount = 1, from = 0.55, to = 0.8 } = {}) {
  SNOW.amt.value = amount; SNOW.a.value = from; SNOW.b.value = to;
  const skipSet = new Set(skip);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.noSnow) return;
    for (let q = o; q; q = q.parent) if (skipSet.has(q)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || m.userData.snowed || m.isShaderMaterial || m.transparent || !('color' in m)) continue;
      m.userData.snowed = true; const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
      m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
        sh.uniforms.uSnowA = SNOW.a; sh.uniforms.uSnowB = SNOW.b; sh.uniforms.uSnowAmt = SNOW.amt; sh.uniforms.uSnowCol = SNOW.col;
        sh.vertexShader = 'varying vec3 vSnowN; varying vec3 vSnowP;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          { vec3 sn = objectNormal; vec4 sp = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              sn = mat3(instanceMatrix) * sn; sp = instanceMatrix * sp;
            #endif
            vSnowN = normalize(mat3(modelMatrix) * sn); vSnowP = (modelMatrix * sp).xyz; }`);
        sh.fragmentShader = 'uniform float uSnowA, uSnowB, uSnowAmt; uniform vec3 uSnowCol; varying vec3 vSnowN; varying vec3 vSnowP;\nfloat snoise2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5); float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5); float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5); float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }\n'
          + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          { float nz = snoise2(vSnowP.xz * 1.6) * .6 + snoise2(vSnowP.xz * 5.0) * .4;
            float s = smoothstep(uSnowA, uSnowB, normalize(vSnowN).y + (nz - .5) * .35) * uSnowAmt;
            diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol * (.92 + nz * .1), s); }`); };
      m.customProgramCacheKey = () => prevKey() + '|snow1';
      m.needsUpdate = true;
    }
  });
}

// ---------- Christmas string lights ----------
const BULB_COLS = ['#ffd27a', '#ff6a5a', '#7fe08a', '#7ab8ff', '#ffe9b0', '#ff9ad2'];
let glowTex = null;
function glowTexture() { if (glowTex) return glowTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); return glowTex; }
// posts: [Vector3, …] the wire hangs between each pair; sag in metres; per = bulbs per segment
export function stringLights(parent, posts, { sag = 0.4, per = 10, size = 0.07, glow = 0.55, colors = BULB_COLS, warm = false } = {}) {
  const grp = new THREE.Group(); grp.userData.noCast = true; parent.add(grp);
  const wire = [], bulbs = [], at = (a, b, t) => { const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); return p; };
  for (let s = 0; s < posts.length - 1; s++) { const a = posts[s], b = posts[s + 1];
    for (let i = 0; i < 16; i++) wire.push(at(a, b, i / 16), at(a, b, (i + 1) / 16));
    for (let i = 0; i < per; i++) { const p = at(a, b, (i + 0.5) / per); p.y -= 0.06; bulbs.push(p); } }
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x1d2a1e })));
  const bg = new THREE.IcosahedronGeometry(size, 0), bm = new THREE.MeshBasicMaterial({ toneMapped: false });
  const im = new THREE.InstancedMesh(bg, bm, bulbs.length); im.userData.noCast = true; im.userData.noSnow = true; const M4 = new THREE.Matrix4(), C = new THREE.Color();
  const cols = bulbs.map((_, i) => new THREE.Color(warm ? (i % 2 ? '#ffd27a' : '#ffe9b0') : colors[i % colors.length]));
  bulbs.forEach((p, i) => { M4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, M4); im.setColorAt(i, cols[i]); }); grp.add(im);
  const gp = new Float32Array(bulbs.length * 3), gc = new Float32Array(bulbs.length * 3); bulbs.forEach((p, i) => { gp.set([p.x, p.y, p.z], i * 3); gc.set([cols[i].r, cols[i].g, cols[i].b], i * 3); });
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
  const gm = new THREE.PointsMaterial({ map: glowTexture(), size: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, toneMapped: false });
  const halo = new THREE.Points(gg, gm); halo.userData.noCast = true; grp.add(halo);
  const ph = bulbs.map(() => Math.random() * 6.28), sp = bulbs.map(() => 0.8 + Math.random() * 1.6);
  grp.update = (t) => { for (let i = 0; i < bulbs.length; i++) { const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * sp[i] + ph[i])); C.copy(cols[i]).multiplyScalar(0.5 + k * 0.9); im.setColorAt(i, C); gc[i * 3] = cols[i].r * k; gc[i * 3 + 1] = cols[i].g * k; gc[i * 3 + 2] = cols[i].b * k; }
    im.instanceColor.needsUpdate = true; gg.attributes.color.needsUpdate = true; };
  return grp;
}

// ---------- the shared prop kit (from the PC) ----------
let KIT = null;
export async function loadXmasKit(loader, url = '/sports/models/xmas/xmas-kit.glb?v=1') {
  if (KIT !== null) return KIT; try { const g = await loader.loadAsync(url); KIT = g.scene; KIT.traverse((o) => { if (o.isMesh) { const m = o.material; if (m && /glow/i.test(m.name || '')) { o.material = new THREE.MeshBasicMaterial({ color: m.color || 0xffd27a, map: m.map || null, toneMapped: false }); o.userData.noSnow = true; o.userData.noCast = true; } else { o.castShadow = true; o.receiveShadow = true; } } }); } catch (e) { KIT = false; }
  return KIT;
}
export function kitPart(name) { if (!KIT) return null; const src = KIT.getObjectByName(name); if (!src) return null; const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); return c; }
export function placeKit(parent, name, x, z, { y = 0, rot = 0, s = 1 } = {}) { const o = kitPart(name); if (!o) return null; o.position.set(x, y, z); o.rotation.y = rot; o.scale.setScalar(s); parent.add(o); return o; }
