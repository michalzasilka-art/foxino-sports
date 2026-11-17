// Foxino Sports: the Foxino Adventures look, used by Tennis (2026-11-17, the user: "increase the graphics of
// the environment based on how you've worked with Adventures").
//  · paintedSky(): a hand-painted ChatGPT sky (the Adventures sky/*.webp pictures) on a dome that is always infinitely far;
//    one picture covers half the circle and is mirrored on the other half; the fog takes the horizon haze colour.
//  · makePost(): soft sun shadows, then ONE full-screen pass with a cheap ambient occlusion (darker creases and the feet of
//    things), a soft focus far away, a gentle pastel grade and a light vignette. GFX level 2 = everything, 1 = shadows + grade,
//    0 = plain drawing; a slow device steps a level down before it lowers the resolution. ?gfx=0 / ?gfx=1 force a level.
import * as THREE from '/penalty/lib/three.module.min.js';

export function paintedSky(scene, url, { yaw = 0, onFog = null, envRenderer = null, base = 0.18, span = 0.8 } = {}) {   // (base/span: which band of the picture sits at the horizon, opt-in; 2026-11-17 winter lobby)
  const tex = new THREE.TextureLoader().load(url, (tx) => {
    try {
      const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d');
      x.drawImage(tx.image, 0, tx.image.height * 0.86, tx.image.width, tx.image.height * 0.1, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4, col = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
      if (scene.fog) scene.fog.color.copy(col);
      if (onFog) onFog(col);
      // the reflections (water, shiny things) from the painted sky itself
      if (envRenderer) {
        const pm = new THREE.PMREMGenerator(envRenderer), es = new THREE.Scene();
        const m2 = mesh.clone(); m2.material = mesh.material.clone(); m2.material.uniforms.map.value = tex; es.add(m2);
        const old = scene.environment; scene.environment = pm.fromScene(es, 0.0, 0.1, 200).texture; pm.dispose(); if (old && old.dispose) old.dispose();
      }
    } catch (e) { /* (the sky still shows) */ }
  });
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uYaw: { value: yaw }, uB: { value: base }, uS: { value: span } }, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    vertexShader: 'varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform sampler2D map; uniform float uYaw, uB, uS; varying vec3 vD;
      void main() { vec3 d = normalize(vD); float az = atan(d.x, -d.z) / 3.14159265 + uYaw;
        float u = 1.0 - abs(mod(az + 1.0, 2.0) - 1.0);
        float el = asin(clamp(d.y, -1.0, 1.0)) / 1.5707963;
        float v = el >= 0.0 ? uB + el * uS : uB * clamp(1.0 + el * 5.0, 0.0, 1.0);
        gl_FragColor = texture2D(map, vec2(clamp(u, .002, .998), clamp(v, .004, .996)));
        #include <colorspace_fragment>
      }`,
  }));
  mesh.renderOrder = -1000; mesh.frustumCulled = false; scene.add(mesh);
  return mesh;
}

export function makePost(renderer, { aoRange = 120, focusMul = 1.15, blur = 0.75, grade = {}, glow = 0 } = {}) {
  const forced = /[?&]gfx=(\d)/.exec(location.search);
  const GFX = { level: forced ? +forced[1] : 2, forced: !!forced, t: 0 };
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const P = { rt: null, mat: null, sc: null, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sz: new THREE.Vector2() };
  const sat = grade.sat ?? 1.06, warm = grade.warm ?? 1;
  function init(w, h) {
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType;
    P.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: dt, depthBuffer: true });
    P.mat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tC: { value: P.rt.texture }, tD: { value: dt }, uRes: { value: new THREE.Vector2(w, h) }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uAO: { value: 1 }, uBlur: { value: 1 }, uFocus: { value: 20 }, uAOR: { value: aoRange }, uGlow: { value: glow } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tC, tD; uniform vec2 uRes; uniform float uNear, uFar, uAO, uBlur, uFocus, uAOR, uGlow; varying vec2 vUv;
        float lin(vec2 uv) { float z = texture2D(tD, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
        void main() {
          vec2 px = 1.0 / uRes; float d = lin(vUv); vec3 c = texture2D(tC, vUv).rgb;
          // soft focus far away (the sky stays sharp: it is painted)
          float bl = uBlur * smoothstep(uFocus * 1.8, uFocus * 6.0, d) * (1.0 - step(uFar * .97, d));
          if (bl > .01) { vec3 acc = c; float r = 2.4 * bl; for (int i = 0; i < 8; i++) { float a = float(i) * .785398; acc += texture2D(tC, vUv + vec2(cos(a), sin(a)) * px * r * (1.0 + float(i - (i / 2) * 2))).rgb; } c = mix(c, acc / 9.0, bl); }
          // ambient occlusion from the depth: creases, contact under the players and trees, the foot of the walls
          if (uAO > .01 && d < uAOR) { float occ = 0.0; float rad = clamp(20.0 / d, 2.0, 24.0);
            for (int i = 0; i < 10; i++) { float a = float(i) * 2.399963 + .5; float rr = rad * (.35 + .65 * fract(float(i) * .618)); vec2 o = vec2(cos(a), sin(a)) * rr * px; float dd = lin(vUv + o);
              float diff = d - dd; occ += smoothstep(.02, .35, diff) * (1.0 - smoothstep(.6, 2.4, diff)); }
            occ = clamp(occ / 10.0, 0.0, 1.0) * (1.0 - smoothstep(uAOR * .6, uAOR, d)); c *= mix(vec3(1.0), vec3(.6, .6, .78), occ * uAO * .85); }
          // (2026-11-17, Streetball "ultimate") a soft glow round the bright things (lamps, lit windows, neon): the bright part
          // of 16 taps on two rings, added back on top (a cheap one-pass bloom; off when uGlow is 0)
          if (uGlow > .001) { vec3 gl = vec3(0.0); for (int i = 0; i < 16; i++) { float a = float(i) * .3927 + (i > 7 ? .2 : 0.0); float r = (i > 7 ? 22.0 : 9.0);
              vec3 s = texture2D(tC, vUv + vec2(cos(a), sin(a)) * px * r).rgb; gl += max(s - vec3(.95), vec3(0.0)) * (i > 7 ? .6 : 1.0); }
            c += gl * uGlow * .14; }
          // the pastel grade: a little more colour, cool lilac shadows, warm highlights, a soft vignette
          float L = dot(c, vec3(.299, .587, .114));
          c = mix(vec3(L), c, ${sat.toFixed(3)});
          c += vec3(.012, .01, .03) * (1.0 - smoothstep(0.0, .35, L));
          c *= mix(vec3(1.0), vec3(1.0 + .03 * ${warm.toFixed(2)}, 1.0 + .01 * ${warm.toFixed(2)}, 1.0 - .04 * ${warm.toFixed(2)}), smoothstep(.3, 1.0, L));
          vec2 q = vUv - .5; c *= 1.0 - dot(q, q) * .32;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), P.mat); quad.frustumCulled = false; P.sc = new THREE.Scene(); P.sc.add(quad);
  }
  // every lit mesh gets shadows (instanced plants cast them; big ground pieces only receive)
  function sweep(scene) {
    scene.traverse((o) => { if (!o.isMesh || o.userData.sh) return; o.userData.sh = 1; const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || (m.isShaderMaterial && !m.lights) || m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial) return;
      o.receiveShadow = true; if (o.userData.noCast) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) : 1;
      o.castShadow = !m.transparent && (r < 30 || o.isSkinnedMesh || o.isInstancedMesh); });
  }
  let slow = 0, frames = 0;
  return {
    GFX,
    draw(scene, camera, focus) {
      const G = GFX.level; renderer.shadowMap.enabled = G > 0;
      if (G > 0 && (GFX.t++ % 45) === 0) sweep(scene);
      if (G === 0) { renderer.render(scene, camera); return; }
      renderer.getDrawingBufferSize(P.sz); const w = Math.max(1, P.sz.x | 0), h = Math.max(1, P.sz.y | 0);
      if (!P.rt) init(w, h); else if (P.rt.width !== w || P.rt.height !== h) { P.rt.setSize(w, h); P.mat.uniforms.uRes.value.set(w, h); }
      const U = P.mat.uniforms; U.uAO.value = G > 1 ? 1 : 0; U.uBlur.value = G > 1 ? blur : 0; U.uFocus.value = Math.max(3, focus * focusMul); U.uNear.value = camera.near; U.uFar.value = camera.far;
      renderer.setRenderTarget(P.rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(P.sc, P.cam);
    },
    // call once a frame with the real frame time: true when the caller should lower the resolution instead
    governor(dt) {
      frames++; if (dt > 1 / 36) slow++;
      if (frames < 90) return false;
      const bad = slow > 45; frames = 0; slow = 0;
      if (bad && GFX.level > 0 && !GFX.forced) { GFX.level--; return false; }
      return bad;
    },
  };
}
