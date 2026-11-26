// (copied unchanged from Foxino Adventures' flamekit.js for the igloo's campfire in FoxSports (R8, Michal: "the fire should be copied from the source as
// it was in adventure game"); only the three.js import and the texture paths differ)
// Patrik Sobek's "Foxino Flame Kit" (claude.ai/artifact/KvZkKsJebCANf4xFZTsvZD, shared in #game-design on 2026-11-11 for
// fires in our games): the flame is three nested lathe shells (outer red-orange, middle orange, inner pale-yellow core)
// whose surface is pushed by simplex noise into licking tongues, painted with a flowing flame texture and cut by it at
// the edges, premultiplied-alpha blended. This is its core, trimmed for Foxino Adventures (no side tongues, sparks or
// smoke): makeFlame({ height, width, seed, lean }) returns { object, update(dt) } that always turns to the camera.
import * as THREE from '/penalty/lib/three.module.min.js';   // (FoxSports copy, 2026-11-27, R8: the same three.js as the snow engine)
const VERT = `
uniform float uTime; uniform float uSpeed; uniform float uSeed; uniform float uWild; uniform float uFlare; uniform float uLean;
varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vP;

vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
void main(){
  float T = uTime * uSpeed;
  vec3 p = position;
  float h = clamp(p.y, 0., 1.);
  vH = h;
  float ang = atan(p.z, p.x);
  vec2 dir = vec2(cos(ang), sin(ang));
  // tongues: the surface pushed out and in, more towards the top, running upwards
  float n1 = snoise(vec3(dir * 1.25 + uSeed, h * 2.1 - T * 1.9));
  float n2 = snoise(vec3(dir * 2.7 - uSeed, h * 4.2 - T * 3.3));
  float push = (n1 * 0.6 + n2 * 0.28) * (0.12 + h * 1.05) * uWild;
  p.xz *= max(0.05, 1. + push);
  // the tip licks: it stretches, and the top sways
  float lick = snoise(vec3(uSeed * 3.1, T * 1.25, 0.5));
  p.y = h * (1. + 0.07 * sin(T * 7.3 + uSeed * 4.) + 0.17 * lick + uFlare * 0.32);
  p.x += (sin(T * 1.9 + h * 2.4 + uSeed) * 0.13 + lick * 0.1) * h * h;
  p.z += cos(T * 1.4 + h * 2.1 + uSeed) * 0.06 * h * h;
  // the wind: the flame leans, its top the most, and gusts a little
  p.x += uLean * (0.55 + 0.12 * lick) * h * h;
  vP = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uEdge; uniform float uAlpha; uniform float uBright; uniform float uSoft;
uniform sampler2D uMap; uniform float uTime; uniform float uSpeed; uniform vec2 uShell; uniform float uPaint; uniform float uCut;
uniform float uOpacity; uniform float uGain; uniform float uFlow; uniform float uSoftK; uniform float uTeeth; uniform float uRound;
uniform float uFlip; uniform mat3 uHue; uniform float uSat;
varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vP;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
vec4 paintAt(vec2 uv){
  vec4 c = texture2D(uMap, uv);
  return (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) ? vec4(0.) : c;
}
void main(){
  float T = uTime * uSpeed;
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float rim = 1. - facing;
  // the shell's own heat gradient
  float t = clamp(vH * 0.8 + rim * 0.6, 0., 1.);
  vec3 g = mix(uCore, uMid, smoothstep(0.0, 0.55, t));
  g = mix(g, uEdge, smoothstep(0.5, 1.0, t));
  // the painting across the whole flame (the body's units: 1 wide at the belly, 1 high), flowing up: two phases
  vec2 b = vec2(vP.x * uShell.x, vP.y * uShell.y);
  vec2 uv = vec2(0.5 + b.x * 0.78 * uFlip, b.y * 0.9 + 0.02);
  float sp = 1.2 * uFlow;
  float p1 = fract(T * sp), p2 = fract(T * sp + 0.5);
  vec2 wob = vec2((vnoise(vec2(uv.x * 5., uv.y * 3. - T * 2.4)) - 0.5) * 0.07, 0.);
  vec2 rise = vec2(0., -0.5);
  vec4 pa = paintAt(uv + wob + rise * (p1 - 0.5));
  vec4 pb = paintAt(uv + wob * -0.7 + rise * (p2 - 0.5));
  vec4 pc = mix(pa, pb, abs(p1 * 2. - 1.));
  float lum = dot(pc.rgb * pc.a, vec3(0.3, 0.55, 0.15));
  // the painted colour and its light and dark licks over the shell's heat (the inner shells keep more of their glow)
  vec3 c = mix(g, pc.rgb, uPaint * pc.a) * (0.7 + 0.75 * lum);
  // small teeth rising along the edge (two scales of noise moving up, larger towards the top)
  float teeth = (vnoise(vec2(b.x * 14. + T * 0.4, b.y * 7. - T * 5.6)) - 0.5) * 0.34
              + (vnoise(vec2(b.x * 27. - 3., b.y * 12. - T * 9.5)) - 0.5) * 0.16;
  teeth *= (0.35 + b.y) * uTeeth;
  // every edge fades over a wide band, eased
  float a = uAlpha * pow(smoothstep(0.0, uSoft * 3.2 * uSoftK, facing + teeth * 0.4), 1.4);
  // (uRound) the lower part filled solid: a plain round bottom instead of a foot cut by the painting
  float keep = uRound * (1. - smoothstep(0.12, 0.5, b.y));
  a = mix(a, uAlpha, keep);
  a *= mix(1., 0.45 + 0.75 * pc.a, uPaint);
  // the outline: the shell cut by the flowing painting, the teeth in its threshold
  float thr = 0.2 + teeth;
  a *= mix(1., smoothstep(thr - 0.3 * uSoftK, thr + 0.42 * uSoftK, pc.a), uCut * (1. - keep));
  a *= mix(1., 1. / max(0.45, 0.45 + 0.75 * pc.a), keep * uPaint);
  a *= 1. - smoothstep(0.78, 1.02, vH) * 0.7;
  // a little see-through at its foot (what it burns on shows through)
  a *= mix(mix(0.6, 1., smoothstep(0.02, 0.3, b.y)), 1., uRound);
  // the colour of the fire: hue turned, more or less saturated
  vec3 col = uHue * (c * uBright * uGain);
  col = max(vec3(0.), mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, uSat));
  gl_FragColor = vec4(col * a, a * uOpacity);
  #include <colorspace_fragment>
}`;
const SHELLS = [
  { s: 1, h: 1, cols: ['#ff9a2a', '#ff6a14', '#f2380f'], alpha: .96, soft: .22, wild: 1, seed: 0, bright: 1, paint: 1, cut: 1, gain: .8 },
  { s: .7, h: .78, cols: ['#ffd25a', '#ff9a1e', '#ff6512'], alpha: .97, soft: .24, wild: .85, seed: 3.7, bright: 1.08, paint: .7, cut: .6, gain: .36 },
  { s: .42, h: .52, cols: ['#fff6d2', '#ffe48a', '#ffb43a'], alpha: 1, soft: .22, wild: .6, seed: 7.9, bright: 1.18, paint: .35, cut: .15, gain: .22 },
];
let GEO = null, MAPS = null; const HUE = new THREE.Matrix3();
function shellGeo() {   // the flame's body: a round belly, a long tapering tongue (Patrik's profile)
  if (GEO) return GEO; const pts = [], N = 16;   // (2026-11-24: 16 rings x 12 sides = 384 tris, was 22 x 18 = 792: six torches on the temple door shot took it over 100k a frame)
  for (let e = 0; e <= N; e++) { const t = e / N, n = .26, a = t < n ? Math.sqrt(Math.max(0, 1 - ((n - t) / n) ** 2)) : (1 - (t - n) / .74) ** 1.15 * (1 - .15 * Math.sin((t - n) / .74 * Math.PI)); pts.push(new THREE.Vector2(Math.max(1e-4, a * .5), t)); }
  GEO = new THREE.LatheGeometry(pts, 12); GEO.computeVertexNormals(); return GEO;
}
function maps() { if (MAPS) return MAPS; const L = new THREE.TextureLoader(); MAPS = ['/sports/snow/fx/flame1.webp?v=1', '/sports/snow/fx/flame2.webp?v=1'].map((u) => { const t = L.load(u); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }); return MAPS; }
export function makeFlame({ height = 1, width = 1, seed = 1, lean = 0, opacity = 1, map = 0 } = {}) {
  const object = new THREE.Group(), turn = new THREE.Group(), body = new THREE.Group(); object.add(turn); turn.add(body);
  const shells = SHELLS.map((d, i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: {
      uTime: { value: 0 }, uSpeed: { value: 1.3 }, uSeed: { value: d.seed + seed * 1.37 }, uWild: { value: d.wild * 1.9 }, uFlare: { value: 0 }, uLean: { value: lean },
      uCore: { value: new THREE.Color(d.cols[0]) }, uMid: { value: new THREE.Color(d.cols[1]) }, uEdge: { value: new THREE.Color(d.cols[2]) }, uAlpha: { value: d.alpha }, uBright: { value: d.bright }, uSoft: { value: d.soft },
      uMap: { value: maps()[(map + i) % 2] }, uShell: { value: new THREE.Vector2(d.s, d.h) }, uPaint: { value: d.paint }, uCut: { value: d.cut }, uOpacity: { value: .5 * opacity }, uGain: { value: d.gain },
      uFlow: { value: 1 }, uSoftK: { value: 1 }, uTeeth: { value: 1 }, uRound: { value: 0 }, uFlip: { value: seed % 2 ? -1 : 1 }, uHue: { value: HUE }, uSat: { value: 1 } } });
    mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    const m = new THREE.Mesh(shellGeo(), mat); m.scale.set(d.s * width * height * .72, d.h * height, d.s * width * height * .72); m.position.z = i * .004; m.frustumCulled = false; m.renderOrder = 5; body.add(m); return mat; });
  let t = Math.random() * 10; const _v = new THREE.Vector3();
  return { object, update(dt, camera) { t += dt; for (const m of shells) m.uniforms.uTime.value = t; if (camera) { object.getWorldPosition(_v); turn.rotation.y = Math.atan2(camera.position.x - _v.x, camera.position.z - _v.z); } } };
}
