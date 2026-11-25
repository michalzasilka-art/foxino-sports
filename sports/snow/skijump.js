import { sponsorTex } from './sponsors.js?v=1';
import { isMuted } from '/penalty/sound.js';
// SKI JUMP: two jumps from a big hill at golden hour. On the in-run three questions (right = more speed), one at the
// take-off (right = a perfect pop) and one in the air (right = he glides further). The two distances add up; the friend's and
// your best distance show as lines on the hill. Longest total wins.
const S = { a: null, ghost: null, inrun: [], acc: [], LIN: 100, hill: [], phase: 'menu', s: 0, v: 0, z: 0, fl: null, jump: 0, dist: [], bonus: 0, takeoff: false, glide: 0, lines: {}, asking: '', stopT: 0, shotT: 0 };
const THREEp = {};
const FR_X = -6.5;   // (the friend's ramp, in a party game)
const RAMP_T = 18, RAMP_END = 0.93, PER_RIGHT = 5.5, V0 = 2.2;   /* (2026-11-25, the user: "Make the ski ramp longer by 50%": the in-run 109 → 169 m, the run 12 → 18 s, the same top speed at the table) */   // (the ramp: ~12 s, speeding up from V0 m/s all the way down; the questions stop at 93 %; metres per right answer) (2026-11-25, the user: "faster acceleration": 15 s → 12 s, a quicker push off)
// (2026-11-24, the user: "make there a motion animation of your jump lenght adding up at the top of the screen when you land make it more
// satysfiing") the metres tick up at the top while he flies; on landing they roll on to the final distance and pop
let JM = null; function jumpMeter(on) { if (!JM) { const st = document.createElement('style'); st.textContent = `
#jumpMeter{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 112px);transform:translateX(-50%) scale(.6);opacity:0;z-index:30;pointer-events:none;text-align:center;transition:opacity .25s,transform .25s;font-family:'Lilita One','Arial Black',sans-serif}
#jumpMeter.on{opacity:1;transform:translateX(-50%) scale(1)} #jumpMeter b{display:block;font-size:clamp(46px,13vw,76px);line-height:1;color:#fff;letter-spacing:.02em;-webkit-text-stroke:3px #2a1e5c;paint-order:stroke fill;text-shadow:0 5px 0 #2a1e5c,0 0 22px rgba(120,200,255,.55);font-weight:400}
#jumpMeter b small{font-size:.5em;margin-left:4px} #jumpMeter span{display:inline-block;margin-top:6px;padding:4px 12px;border-radius:999px;background:#ffd84a;color:#2a1e5c;font-size:clamp(13px,3.6vw,17px);opacity:0;transform:scale(.4)}
#jumpMeter.done b{animation:jmPop .55s cubic-bezier(.2,1.8,.4,1);color:#ffe27a;text-shadow:0 5px 0 #2a1e5c,0 0 30px rgba(255,214,90,.9)} #jumpMeter.done span{animation:jmTag .45s .25s cubic-bezier(.2,1.6,.4,1) forwards}
body:has(#jumpMeter.on) #combo{visibility:hidden}
@media (max-height:520px){#jumpMeter{top:calc(env(safe-area-inset-top,0px) + 54px)} #jumpMeter b{font-size:clamp(34px,10vh,50px);-webkit-text-stroke-width:2px}}
@keyframes jmPop{0%{transform:scale(1)}35%{transform:scale(1.45)}100%{transform:scale(1)}} @keyframes jmTag{to{opacity:1;transform:scale(1)}}`; document.head.appendChild(st);
    JM = document.createElement('div'); JM.id = 'jumpMeter'; JM.innerHTML = '<b>0.0<small>m</small></b><span></span>'; document.body.appendChild(JM); }
  JM.classList.remove('done'); JM.classList.toggle('on', !!on); if (on) jumpMeterLive(0); }
function jumpMeterLive(m) { if (JM && JM.classList.contains('on') && !JM.classList.contains('done')) JM.querySelector('b').innerHTML = `${m.toFixed(1)}<small>m</small>`; }
async function countUp(E, d, tag) { if (!JM) jumpMeter(true); const b = JM.querySelector('b'), from = Math.min(d, parseFloat(b.textContent) || 0), t0 = performance.now(), dur = 700; let last = -1;
  await new Promise((res) => { const step = () => { const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = from + (d - from) * e;
    b.innerHTML = `${v.toFixed(1)}<small>m</small>`; const whole = Math.floor(v); if (whole !== last) { last = whole; try { E.sfx.click && E.sfx.click(); } catch (x) {} }
    if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  b.innerHTML = `${d.toFixed(1)}<small>m</small>`; JM.querySelector('span').textContent = tag; JM.classList.add('done'); try { E.sfx.star && E.sfx.star(); if (d >= S.J.K) E.sfx.cheer && E.sfx.cheer(); } catch (x) {}
  await E.wait(2.4); JM.classList.remove('on'); }
const IRW = 2.4;
// (2026-11-25) the in-run's top section copied above itself: the start (hut, deck, its lights) moves up by EXT
const EXT = { dy: 0, dz: 0, n: 2, secY: 17.207, secZ: 24.575 };   // (half the in-run's width, for its Christmas lights)
function hillY(z) { const H = S.hill; if (z <= 0) return H[0][1]; const i = Math.min(H.length - 2, Math.floor(z)), f = Math.min(1, z - i); return H[i][1] * (1 - f) + H[i + 1][1] * f; }
function inrunAt(s, out) {
  s = Math.max(0, Math.min(S.LIN, s)); let i = 1; while (i < S.acc.length - 1 && S.acc[i] < s) i++;
  const f = (s - S.acc[i - 1]) / Math.max(1e-6, S.acc[i] - S.acc[i - 1]), A = S.inrun[i - 1], B = S.inrun[i];
  out.p.set(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f); out.ang = Math.atan2(A[1] - B[1], B[2] - A[2]); return out;
}
// (2026-11-25, the user: "Make 2 separate models / Ski / Foxino ...") ?sk=1 (on this address or the Sports lobby's) = the new skier: the rigged
// Foxino with his own clips and the straight skis on his ski mounts (Tripo + Claudee RCC); the old jumper stays the default until it is approved
const QALL = (() => { let q = location.search; try { if (window.parent !== window) q += '&' + window.parent.location.search.slice(1); } catch (e) {} return q; })();
const SK = !/[?&]sk=0/.test(QALL);   /* (2026-11-25 night: the new skier is the default jumper (the user asked for the remake); ?sk=0 = the old one) */
function skiClip(ph, s, z, D) {
  if (ph === 'inrun') return s > S.LIN - 4 ? 'takeoff' : s < 2.5 ? 'start_push' : 'tuck';
  if (ph === 'flight') return 'fly';
  if (ph === 'land') return 'land_telemark';
  if (ph === 'outrun') return z < (D || 0) + 12 ? 'land_telemark' : 'glide';
  if (ph === 'stop') return 'cheer';
  return 'stance_idle';
}
const P0 = { tuck(t) { const p = blank(); p.legL = [-1.25, 0, 0.06]; p.legR = [-1.25, 0, -0.06]; p.kneeL = [2.05, 0, 0]; p.kneeR = [2.05, 0, 0]; p.ankleL = [-0.85, 0, 0]; p.ankleR = [-0.85, 0, 0];
    p.spine = [1.05, 0, 0]; p.neck = [-0.4, 0, 0]; p.head = [-0.45, 0, 0]; p.armL = [0.45, 0, 0.12]; p.armR = [0.45, 0, -0.12]; p.elbowL = [-0.15, 0, 0]; p.elbowR = [-0.15, 0, 0]; p.y = -0.3 + 0.005 * Math.sin(t * 9); return p; },
  sit(t) { const p = blank(); p.legL = [-1.4, 0, 0.08]; p.legR = [-1.4, 0, -0.08]; p.kneeL = [1.6, 0, 0]; p.kneeR = [1.6, 0, 0]; p.ankleL = [-0.2, 0, 0]; p.ankleR = [-0.2, 0, 0];
    p.spine = [0.35, 0, 0]; p.armL = [-0.3, 0, 0.6]; p.armR = [-0.3, 0, -0.6]; p.elbowL = [-0.6, 0, 0]; p.elbowR = [-0.6, 0, 0]; p.head = [-0.1, 0.2 * Math.sin(t * 0.8), 0]; p.y = -0.36; return p; },
  fly(t) { const p = blank(), w = 0.03 * Math.sin(t * 5); p.legL = [-0.15, 0, 0.12]; p.legR = [-0.15, 0, -0.12]; p.kneeL = [0.15, 0, 0]; p.kneeR = [0.15, 0, 0]; p.ankleL = [0.25, 0, 0]; p.ankleR = [0.25, 0, 0];
    p.spine = [0.3, 0, 0]; p.neck = [-0.35, 0, 0]; p.head = [-0.4, 0, 0]; p.armL = [0.4, 0, 0.3 + w]; p.armR = [0.4, 0, -0.3 - w]; p.elbowL = [0, 0, 0]; p.elbowR = [0, 0, 0]; return p; },
  pop(t) { const p = P0.fly(t); p.legL = [-0.6, 0, 0.06]; p.legR = [-0.6, 0, -0.06]; p.kneeL = [0.9, 0, 0]; p.kneeR = [0.9, 0, 0]; p.spine = [0.7, 0, 0]; p.armL = [0.6, 0, 0.15]; p.armR = [0.6, 0, -0.15]; return p; },
  telemark(t) { const p = blank(); p.legL = [-0.75, 0, 0.06]; p.kneeL = [1.15, 0, 0]; p.ankleL = [-0.45, 0, 0]; p.legR = [0.25, 0, -0.06]; p.kneeR = [1.05, 0, 0]; p.ankleR = [0.25, 0, 0];
    p.spine = [0.25, 0, 0]; p.armL = [-0.4, 0, 1.25]; p.armR = [-0.4, 0, -1.25]; p.elbowL = [-0.2, 0, 0]; p.elbowR = [-0.2, 0, 0]; p.y = -0.17; return p; },
};
function blank() { const p = { y: 0, tail: 0 }; for (const j of ['hips', 'spine', 'neck', 'head', 'armL', 'elbowL', 'armR', 'elbowR', 'legL', 'kneeL', 'ankleL', 'legR', 'kneeR', 'ankleR']) p[j] = [0, 0, 0]; return p; }

export const _S = S;
// (2026-11-25, the user: "this is the intro fix it make it so it doesnt cover the screen") a camera in front of him down the ramp, looking back
// up at him (ang: the in-run's slope at him), so the start screen and the first metres show Foxino, the ramp and the hill, not the start tower
function frontCam(P, ang, sway) { const ca = Math.cos(ang), sa = Math.sin(ang), down = { x: 0, y: -sa, z: ca }, up = { x: 0, y: ca, z: sa };
  const pos = P.clone(); pos.x += 1.3 + sway; pos.y += down.y * 6.5 + up.y * 1.7; pos.z += down.z * 6.5 + up.z * 1.7;
  const look = P.clone(); look.y += up.y * 0.55; look.z += up.z * 0.55; return { pos, look }; }
// (2026-11-25, the user: "increase the model quality of that ski jumping building, more Christmas, better colours") the start tower made in code
// in the FoxSports winter palette (whites and deep blues, warm red and gold accents): a deck on top of the in-run with a railing, a white chalet
// start hut (navy frame, wine-red roof under thick snow, warm windows, a START sign and a wreath in the gable); railings and snow along the whole
// in-run; the sponsors on the in-run's sides (ours only). xo: the x of the ramp (the friend's ramp in a party game gets the same, without banners)
const PAL = { white: 0xeef3fb, navy: 0x26346a, steel: 0x8a9bc6, roof: 0xa8233b, snow: 0xfbfdff, warm: 0xffcf7a, green: 0x2f7a4a, gold: 0xffc23a };
function buildTower(THREE, xo, banners, gy) {
  const G = new THREE.Group(), M = {}, mat = (k, o = {}) => (M[k + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: PAL[k] ?? k, roughness: 0.7, ...o }));
  const box = (w, h, d, x, y, z, m, ry = 0, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x + xo, y, z); b.rotation.set(0, ry, rz); G.add(b); return b; };
  const top = 53.45 + EXT.dy, z0 = -98.3 + EXT.dz, z1 = -93.55 + EXT.dz, hw = 2.6, wallH = 3.3, peak = top + wallH + 1.55;
  // the deck under the hut and its railing (navy posts, a white rail)
  box(7, 0.3, 6.6, 0, top - 0.15, -95.8 + EXT.dz, mat('navy'));
  for (const sd of [-1, 1]) { for (let z = -98.9 + EXT.dz; z <= -92.7 + EXT.dz; z += 1.55) box(0.12, 1.0, 0.12, sd * 3.4, top + 0.5, z, mat('navy')); box(0.1, 0.1, 6.4, sd * 3.4, top + 1.02, -95.8 + EXT.dz, mat('white')); }
  // the hut: white walls, navy corner posts and a band at the foot, warm windows
  box(hw * 2, wallH, z1 - z0, 0, top + wallH / 2, (z0 + z1) / 2, mat('white'));
  for (const sx of [-1, 1]) for (const zz of [z0, z1]) box(0.24, wallH + 0.05, 0.24, sx * hw, top + wallH / 2, zz, mat('navy'));
  box(hw * 2 + 0.1, 0.35, z1 - z0 + 0.1, 0, top + 0.17, (z0 + z1) / 2, mat('navy'));
  const glow = mat('warm', { emissive: 0xffb24a, emissiveIntensity: 0.9 });
  box(3.6, 0.95, 0.06, 0, top + 2.0, z1 + 0.04, glow); box(0.06, 0.9, 2.6, -hw - 0.04, top + 2.0, (z0 + z1) / 2, glow); box(0.06, 0.9, 2.6, hw + 0.04, top + 2.0, (z0 + z1) / 2, glow);
  for (const x of [-0.9, 0, 0.9]) box(0.08, 0.95, 0.08, x, top + 2.0, z1 + 0.08, mat('navy'));
  // the START sign under the eave
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#a8233b'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = '400 46px "Lilita One", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('START', 128, 35);
  const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: st, roughness: 0.6 })); sign.position.set(xo, top + 2.95, z1 + 0.09); G.add(sign);
  // the gable ends (white triangles) and the roof: two wine-red slopes under thick snow, a chimney
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-hw, 0, 0, hw, 0, 0, 0, 1.55, 0], 3)); tri.computeVertexNormals();
  for (const zz of [z1 + 0.01, z0 - 0.01]) { const t = new THREE.Mesh(tri, mat('white', { side: THREE.DoubleSide })); t.position.set(xo, top + wallH, zz); G.add(t); }
  const ang = Math.atan2(1.55, hw), len = Math.hypot(hw, 1.55) + 0.45;
  for (const sd of [-1, 1]) { const cx = sd * (hw / 2 + 0.12), cy = top + wallH + 0.78;
    box(len, 0.2, z1 - z0 + 0.9, cx, cy + 0.05, (z0 + z1) / 2, mat('roof'), 0, -sd * ang);
    box(len - 0.25, 0.22, z1 - z0 + 0.7, cx - sd * 0.05, cy + 0.24, (z0 + z1) / 2, mat('snow'), 0, -sd * ang); }
  box(0.55, 1.1, 0.55, 1.2, peak - 0.3, z0 + 1.2, mat('navy')); box(0.65, 0.2, 0.65, 1.2, peak + 0.3, z0 + 1.2, mat('snow'));
  // a Christmas wreath in the front gable: a green ring, a red bow, gold berries
  const wr = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 6, 14), mat('green')); wr.position.set(xo, top + wallH + 0.62, z1 + 0.12); G.add(wr);
  box(0.36, 0.16, 0.06, 0, top + wallH + 0.25, z1 + 0.2, mat('roof'));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(0.09, 0.09, 0.09, Math.cos(a) * 0.42, top + wallH + 0.62 + Math.sin(a) * 0.42, z1 + 0.22, mat('gold', { emissive: 0xffaa22, emissiveIntensity: 0.6 })); }
  // the in-run: a railing on both walls (navy posts every 4.5 m, a white rail) and snow along the wall tops
  const P = S.inrun, at = (s) => { let acc = 0; for (let i = 1; i < P.length; i++) { const A = P[i - 1], B = P[i], d = Math.hypot(B[1] - A[1], B[2] - A[2]); if (acc + d >= s) { const f = (s - acc) / d; return [A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f, Math.atan2(A[1] - B[1], B[2] - A[2])]; } acc += d; } const L = P[P.length - 1]; return [L[1], L[2], 0]; };
  for (let s0 = 0; s0 < S.LIN - 1; s0 += 4.5) { const [y, z, a] = at(s0), [y2, z2] = at(Math.min(S.LIN, s0 + 4.5)), mid = [(y + y2) / 2, (z + z2) / 2], seg = Math.hypot(y2 - y, z2 - z);
    for (const sd of [-1, 1]) { box(0.1, 0.85, 0.1, sd * 2.12, y + 0.9 + 0.42, z, mat('navy'));
      const r = box(0.08, 0.08, seg, sd * 2.12, mid[0] + 1.78, mid[1], mat('white')); r.rotation.x = a;
      const sn = box(0.36, 0.1, seg, sd * 2.05, mid[0] + 0.95, mid[1], mat('snow')); sn.rotation.x = a;
      // (2026-11-25, "more Christmas") snow lying on the top rail and a cap of snow on each post
      if (banners) { const sr = new THREE.Mesh(new THREE.PlaneGeometry(0.15, seg * 0.96), mat('snow')); sr.position.set(xo + sd * 2.12, mid[0] + 1.825, mid[1]); sr.rotation.set(-Math.PI / 2 + a, 0, 0); G.add(sr);   /* (a flat strip: 2 triangles) */ box(0.2, 0.09, 0.2, sd * 2.12, y + 1.81, z, mat('snow')); } } }   /* (the friend's ramp in a party game: without, under 100k a frame) */
  // (2026-11-25) the deck at the new top stands on four steel legs down to the snow, braced
  if (gy) { const st = mat(PAL.steel, { metalness: 0.25, roughness: 0.5 }); for (const sx of [-3.1, 3.1]) for (const zz of [z0 - 0.3, z1 + 0.3]) { const gb = gy(xo + sx, zz), h = top - 0.3 - gb; if (h > 0.5) { box(0.4, h + 1, 0.4, sx, gb + h / 2 - 0.5, zz, st); for (const f of [0.35, 0.7]) box(0.18, 0.18, z1 - z0 + 0.6, sx, gb + h * f, (z0 + z1) / 2, st); } }
    for (const f of [0.35, 0.7]) for (const zz of [z0 - 0.3, z1 + 0.3]) { const gb = gy(xo, zz); box(6.2, 0.18, 0.18, 0, gb + (top - 0.3 - gb) * f, zz, st); } }
  // the sponsors on the in-run's outer sides (each side its own order)
  if (banners) for (const [s, k] of [[22, 'red'], [56, 'face'], [92, 'red'], [128, 'face']]) for (const sd of [-1, 1]) { const [y, z, a] = at(s), kind = sd > 0 ? k : (k === 'red' ? 'face' : 'red');
    const b = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshStandardMaterial({ map: sponsorTex(THREE, kind), roughness: 0.6 }));
    b.position.set(xo + sd * 2.24, y - 0.2, z); b.rotation.set(a, sd * Math.PI / 2, 0, 'YXZ'); G.add(b); }
  G.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.userData.noCast = true; } });
  return G;
}
// the judges' tower beside the landing hill: four legs, a white cabin with a blue glass band facing the hill, a red roof under snow, a flag
function buildJudges(THREE, x, z, yb) {
  const G = new THREE.Group(), m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }), box = (w, h, d, px, py, pz, mm) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm); b.position.set(px, py, pz); G.add(b); return b; };
  const top = yb + 9, nv = m(PAL.navy);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.3, 1.3]) box(0.3, top - yb + 1, 0.3, x + sx, (yb + top) / 2 - 0.5, z + sz, nv);
  box(4.4, 0.3, 3.4, x, top, z, nv); box(4.2, 2.6, 3.2, x, top + 1.45, z, m(PAL.white)); box(0.06, 1.0, 2.8, x + 2.13, top + 1.7, z, m(0x9fd8ff, { emissive: 0x3a8ed0, emissiveIntensity: 0.5 }));
  box(4.8, 0.3, 3.8, x, top + 2.9, z, m(PAL.roof)); box(4.6, 0.22, 3.6, x, top + 3.14, z, m(PAL.snow));
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#26346a'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = '400 40px "Lilita One", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('JUDGES', 128, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: t })); sg.position.set(x + 2.14, top + 2.45, z); sg.rotation.y = Math.PI / 2; G.add(sg);
  box(0.08, 2.4, 0.08, x - 1.8, top + 4.3, z - 1.4, nv); box(0.05, 0.6, 0.9, x - 1.8, top + 5.2, z - 0.95, m(0xe8304a));
  G.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noCast = true; } });
  return G;
}
// ---------- (2026-11-25, the user: "Make the ski ramp longer by 50% ... Make the forest deeper") ----------
// the model's ground as a height grid (its triangles rasterised every 4 m): where the new legs, the hillside behind the tower and the firs stand
function heightGrid(meshes, cell = 4) {
  const X0 = -200, Z0 = -112, NX = Math.ceil(390 / cell) + 1, NZ = Math.ceil(425 / cell) + 1, H = new Float32Array(NX * NZ).fill(NaN);
  for (const mesh of meshes) { mesh.updateMatrixWorld(true); const g = mesh.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count, m = mesh.matrixWorld.elements;
    const W = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; };
    for (let t = 0; t < n; t += 3) { const a = W(I ? I.getX(t) : t), b = W(I ? I.getX(t + 1) : t + 1), c = W(I ? I.getX(t + 2) : t + 2);
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-9) continue;
      const ix0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - X0) / cell)), ix1 = Math.min(NX - 1, Math.floor((Math.max(a[0], b[0], c[0]) - X0) / cell));
      const iz0 = Math.max(0, Math.ceil((Math.min(a[2], b[2], c[2]) - Z0) / cell)), iz1 = Math.min(NZ - 1, Math.floor((Math.max(a[2], b[2], c[2]) - Z0) / cell));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) { const px = X0 + ix * cell, pz = Z0 + iz * cell;
        const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d, l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue; const y = l1 * a[1] + l2 * b[1] + l3 * c[1], k = iz * NX + ix; if (!(H[k] >= y)) H[k] = y; } } }
  return { at(x, z) { const fx = (x - X0) / cell, fz = (z - Z0) / cell, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= NX - 1 || iz >= NZ - 1) return NaN;
    const tx = fx - ix, tz = fz - iz, v = [H[iz * NX + ix], H[iz * NX + ix + 1], H[(iz + 1) * NX + ix], H[(iz + 1) * NX + ix + 1]];
    if (v.some(Number.isNaN)) return NaN; return (v[0] * (1 - tx) + v[1] * tx) * (1 - tz) + (v[2] * (1 - tx) + v[3] * tx) * tz; } };
}
// the hillside behind the start tower (the model's ground ends at z -110): it carries on from the ground's back edge and climbs away
const BACK_Z = -110, BACK = { edge: null };
function backY(x, z) { const E0 = BACK.edge, i = Math.max(0, Math.min(E0.length - 2, Math.floor((x + 200) / 8))), f = Math.max(0, Math.min(1, (x + 200) / 8 - i)), e = E0[i] * (1 - f) + E0[i + 1] * f, d = Math.max(0, BACK_Z - z);
  return e + d * 0.42 + Math.min(1, d / 30) * (Math.sin(x * 0.045 + z * 0.03) * 3 + Math.sin(x * 0.11 - z * 0.07) * 1.4); }
function makeBack(THREE, mat, ground) {
  // the back edge: rays straight down onto the ground 5 cm inside its edge, every 8 m; the trench under the in-run filled across
  const rc = new THREE.Raycaster(), E0 = []; for (let x = -200; x <= 192; x += 8) { rc.set(new THREE.Vector3(x, 400, BACK_Z + 0.05), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObject(ground, false)[0]; E0.push(h ? h.point.y : NaN); }
  for (let i = 0; i < E0.length; i++) if (Number.isNaN(E0[i])) { let a = i - 1, b = i + 1; while (a >= 0 && Number.isNaN(E0[a])) a--; while (b < E0.length && Number.isNaN(E0[b])) b++; const va = a >= 0 ? E0[a] : E0[b], vb = b < E0.length ? E0[b] : va; E0[i] = va + (vb - va) * (i - a) / Math.max(1, b - a) - 2; }
  BACK.edge = E0;
  const xs = []; for (let x = -200; x <= 192; x += 8) xs.push(x); const zs = [BACK_Z + 0.6, BACK_Z]; for (let z = BACK_Z - 6; z >= -280; z -= z > -170 ? 8 : 14) zs.push(z);
  const pos = [], idx = []; for (const z of zs) for (const x of xs) pos.push(x, z > BACK_Z ? backY(x, BACK_Z) - 0.6 : backY(x, z), z);
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; idx.push(a, b, c, b, d, c); }
  // a skirt hanging from the edge, facing the hill: no slit of sky between the two grounds from below
  const k0 = pos.length / 3; for (const x of xs) pos.push(x, backY(x, BACK_Z) - 0.1, BACK_Z + 0.02, x, backY(x, BACK_Z) - 9, BACK_Z + 0.02);
  for (let i = 0; i < xs.length - 1; i++) { const a = k0 + i * 2, b = a + 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; m.userData.noCast = true; m.name = 'BackHill'; return m;
}
// a cheap low-poly fir: two five-sided cones (10 triangles), dark green with snowy tips; no shadows
function firGeo(THREE) {
  const pos = [], col = [], tier = (r, y0, h, c0, c1) => { for (let i = 0; i < 5; i++) { const a0 = i / 5 * Math.PI * 2, a1 = (i + 1) / 5 * Math.PI * 2;
    pos.push(Math.cos(a0) * r, y0, Math.sin(a0) * r, 0, y0 + h, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r); col.push(...c0, ...c1, ...c0); } };
  tier(1.7, 0.6, 3.4, [0.1, 0.24, 0.19], [0.2, 0.4, 0.31]); tier(1.2, 2.6, 2.9, [0.13, 0.3, 0.24], [0.93, 0.96, 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function makeFirs(THREE, list, cell = 40) {
  const geo = firGeo(THREE), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), grp = new THREE.Group(), cells = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const t of list) { const k = `${Math.floor(t[0] / cell)},${Math.floor(t[2] / cell)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(t); }
  for (const items of cells.values()) { const im = new THREE.InstancedMesh(geo, mat, items.length); items.forEach(([x, y, z, s, r], i) => { m4.compose(ps.set(x, y, z), q.setFromAxisAngle(Y, r), sc.set(s, s * (0.85 + (i % 7) * 0.06), s)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = false; im.userData.noCast = true; grp.add(im); }
  grp.userData.count = list.length; return grp;
}
// where the new firs go: layered rows down both sides of the in-run and the landing hill, out into the distance, and the hillside behind the tower
function forestList(gy, rnd) {
  const out = [], keep = (x, z) => { if (z < 4 && Math.abs(x) < 9) return false; if (z >= -6 && Math.abs(x) < 23) return false; if (z > 200 && Math.abs(x) < 30) return false; return true; };
  // (spacing: ~6 m in the near rows, 8, 11 and 14 m further out: thick near the course, thinning into the distance)
  for (let z = -270; z < 300; z += 4.2) for (const sd of [-1, 1]) for (const [x0, x1, sp] of [[10, 40, 6], [40, 80, 8.5], [80, 130, 13], [130, 190, 18]]) {
    const want = (x1 - x0) * 4.2 / (sp * sp); for (let k = 0; k < Math.floor(want) + (rnd() < want % 1 ? 1 : 0); k++) {
      const x = sd * (x0 + rnd() * (x1 - x0)), zz = z + rnd() * 4.2; if (!keep(x, zz)) continue;
      const y = gy(x, zz); if (!Number.isFinite(y)) continue; out.push([x, y - 0.3, zz, 0.85 + rnd() * 0.9, rnd() * 6.28]); } }
  return out;
}
// ---------- (2026-11-25, the user: "when you answer right it will make a screen like you speed up not actually") ----------
// a right answer on the ramp: speed lines rush out from the middle of the screen, the view widens for a moment (FOV), snow sprays off the
// skis and the wind whooshes; then it all eases back. His real speed and the jump's distance are not touched.
let RUSH = null, AC = null;
function rushFx(E, pos) {
  if (!RUSH) { const st = document.createElement('style'); st.textContent = `
#sjRush{position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;mix-blend-mode:screen;
  background:repeating-conic-gradient(from 0deg at 50% 52%,rgba(255,255,255,0) 0deg 2.1deg,rgba(235,245,255,.85) 2.4deg 2.75deg,rgba(255,255,255,0) 3.1deg 5.3deg),
             repeating-conic-gradient(from 1.3deg at 50% 52%,rgba(255,255,255,0) 0deg 4.6deg,rgba(200,225,255,.55) 4.9deg 5.2deg,rgba(255,255,255,0) 5.5deg 8.9deg);
  -webkit-mask-image:radial-gradient(ellipse 62% 58% at 50% 52%,transparent 38%,rgba(0,0,0,.55) 62%,#000 100%);mask-image:radial-gradient(ellipse 62% 58% at 50% 52%,transparent 38%,rgba(0,0,0,.55) 62%,#000 100%)}
#sjRush.go{animation:sjRush .95s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes sjRush{0%{opacity:0;transform:scale(.92) rotate(0)}14%{opacity:1}55%{opacity:.75}100%{opacity:0;transform:scale(1.35) rotate(1.5deg)}}`;
    document.head.appendChild(st); RUSH = document.createElement('div'); RUSH.id = 'sjRush'; document.body.appendChild(RUSH); }
  RUSH.classList.remove('go'); void RUSH.offsetWidth; RUSH.classList.add('go');
  S.rush = 1; try { E.spray.emit(pos, 22, 0, 2.6, 3.4, 1.5); } catch (e) {}
  whoosh();
}
function whoosh() {
  try { if (isMuted && isMuted()) return; AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime, d = 0.75, buf = AC.createBuffer(1, Math.floor(AC.sampleRate * d), AC.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(280, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3); bp.frequency.exponentialRampToValueAtTime(600, t + d);
    const gn = AC.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.32, t + 0.1); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp).connect(gn).connect(AC.destination); src.start(t); src.stop(t + d); } catch (e) {}
}
// a candy stripe texture (the arch at the top of the in-run)
function stripeTex(THREE) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fbfdff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d9203e';
  for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 + 64, 64); x.lineTo(i + 64, 64); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
export default {
  id: 'skijump', blurb: 'Right words give speed, a perfect take-off and a longer flight. Two jumps!',
  light: { sky: 'alpine-gold', skyYaw: 0.55, skyBase: 0.22, sunDir: [0.75, 0.4, 0.45], sun: 0xfff0e0, sunI: 2.4, hemiSky: 0xdfe8ff, hemiGround: 0x9a8ed0, hemi: 0.95, rim: 0xffb27a, rimI: 1.0, exposure: 0.96, fog: [180, 760], fogColor: 0xeadcea, flakes: 160, flakeA: 0.45 },   /* (2026-11-25: a little cooler and snowier: whites and blues, the gold sunset as the warm accent) */
  bestShown: (s) => `${s.toFixed(1)} m`,
  async build(E, prog) {
    const { THREE } = E; THREEp.T = THREE;
    const [g, J] = await Promise.all([E.loadGLB('models/skijump.glb?v=1'), E.loadJSON('models/skijump.json?v=1')]);
    E.dressModel(g.scene); E.scene.add(g.scene); prog(30, 'Planting the trees…');
    // (2026-11-25) the winter palette on the model: the in-run's walls deep blue, the supports steel blue; the old box cabin replaced (buildTower)
    const reMat = { WoodDark: new THREE.MeshStandardMaterial({ color: PAL.navy, roughness: 0.75 }), MastGrey: new THREE.MeshStandardMaterial({ color: PAL.steel, roughness: 0.5, metalness: 0.25 }) };
    g.scene.traverse((o) => { if (!o.isMesh) return; if (/^Start/.test(o.name)) o.visible = false; const set = (mm) => (mm && reMat[mm.name]) || mm; o.material = Array.isArray(o.material) ? o.material.map(set) : set(o.material); });
    // (2026-11-25, the user: "Make the ski ramp longer by 50%") the in-run's straight top section (Inrun_00: 30 m, cut square at both ends)
    // copied twice above itself up the same 35° line: 109 → 169 m. Steel legs carry the new part to the snow; the start goes to the new top;
    // a hillside carries on behind the tower (the model's ground ends at z -110)
    const grounds = ['JumpGround_00', 'JumpGround_01', 'JumpGround_02'].map((n) => g.scene.getObjectByName(n)).filter(Boolean), HG = heightGrid(grounds);
    E.scene.add(makeBack(THREE, grounds[2].material, grounds[2]));
    const gy = (x, z) => { if (z < BACK_Z) return backY(x, z); let y = HG.at(x, z); if (Number.isFinite(y)) return y; const l = HG.at(x - 12, z), r = HG.at(x + 12, z); return Math.min(Number.isFinite(l) ? l : 99, Number.isFinite(r) ? r : 99) - 1.5; };
    S.gy = gy; EXT.dy = EXT.secY * EXT.n; EXT.dz = -EXT.secZ * EXT.n;
    const sec = g.scene.getObjectByName('Inrun_00'), legM = reMat.MastGrey;
    for (let k = 1; k <= EXT.n && sec; k++) {
      const c = sec.clone(); c.name = `Inrun_x${k}`; c.position.y += EXT.secY * k; c.position.z -= EXT.secZ * k; g.scene.add(c);
      const legs = new THREE.Group(); legs.name = `Pillar_x${k}`;
      for (let i = 0; i < 4; i++) { const z = -93.151 - EXT.secZ * k + i * EXT.secZ / 4 + 0.6, yt = 53.946 + EXT.secY * k - (z + 93.151 + EXT.secZ * k) * EXT.secY / EXT.secZ - 0.25;
        const gb = Math.min(gy(-1.75, z), gy(1.75, z)), h = yt - gb; if (h < 1) continue;
        for (const sx of [-1.75, 1.75]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, h + 1.5, 0.42), legM); p.position.set(sx, gb + h / 2 - 0.75, z); legs.add(p); }
        for (const f of [0.3, 0.62, 0.94]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 0.22), legM); b.position.set(0, gb + h * f, z); legs.add(b); }
        if (i % 2 === 0) { const z2 = z + EXT.secZ / 4, gb2 = Math.min(gy(-1.75, z2), gy(1.75, z2)), hh = Math.min(h, yt - EXT.secY / 4 - gb2) * 0.62; for (const sx of [-1.75, 1.75]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, EXT.secZ / 4), legM); d.position.set(sx, gb + hh, (z + z2) / 2); legs.add(d); } } }
      legs.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.userData.noCast = true; } }); g.scene.add(legs); }
    // (2026-11-25, multiplayer: "exactly 2 ramps side by side, you see your friend right next to you") the friend's in-run, a copy of ours
    // 6.5 m to the left (the cameras look from the right, so it never comes between them and Foxino)
    if (E.MP.on) { for (const o of g.scene.children.slice()) if (/^(Inrun|Brace|Pillar|Start)/.test(o.name)) { const c = o.clone(); c.position.x += FR_X; c.traverse((m) => { m.castShadow = false; m.userData.noCast = true; }); g.scene.add(c); } }
    const ext = []; { const [, y0, z0] = J.inrun[0], N = Math.round(EXT.secZ * EXT.n / 1.6384); for (let i = N; i >= 1; i--) ext.push([0, y0 + EXT.dy * i / N, z0 + EXT.dz * i / N]); }
    S.J = J; S.inrun = [...ext, ...J.inrun]; S.hill = J.hill; S.acc = [0]; for (let i = 1; i < S.inrun.length; i++) { const A = S.inrun[i - 1], B = S.inrun[i]; S.acc.push(S.acc[i - 1] + Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2])); } S.LIN = S.acc[S.acc.length - 1];
    E.scene.add(buildTower(THREE, 0, true, gy)); if (E.MP.on) E.scene.add(buildTower(THREE, FR_X, false, gy));
    E.scene.add(buildJudges(THREE, -24, 52, hillY(52) - 1.5));
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
    // (2026-11-25, the user: "Make the forest deeper") layered rows of cheap firs (10 triangles, no shadows) out into the distance and behind the tower
    { let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const F = makeFirs(THREE, forestList(gy, rnd)); E.scene.add(F); E.far(F); S.firs = F.userData.count; S.firsG = F; }
    // distance boards along the hill sides, the K line (red) and lines for your best and the friend's distance
    for (const m of J.props.filter((p) => p[0] === 'Marker')) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#7b3fd1'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#fff'; x.font = '400 44px "Lilita One", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(m[5]), 64, 36);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
      b.position.set(m[1], m[2] + 0.4, m[3]); b.rotation.y = m[1] > 0 ? -Math.PI / 2 : Math.PI / 2; E.scene.add(b);
    }
    const line = (z, col) => { const geo = new THREE.PlaneGeometry(J.hillHalfWidth * 2, 0.35); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2; E.scene.add(m); const set = (zz) => { m.visible = zz > 0; const a = Math.atan2(hillY(zz) - hillY(zz + 1), 1); m.position.set(0, hillY(zz) + 0.06, zz); m.rotation.set(-Math.PI / 2 + a, 0, 0); }; set(z); return { m, set }; };
    S.lines.k = line(J.K, 0xff3d5a); S.lines.best = line(0, 0xffd84a); S.lines.friend = line(0, 0xff7d22); S.lines.last = line(0, 0x6fe2ff);
    await E.addMountains(-300, 0xf2ecff);
    prog(60, 'Waxing the long skis…');
    S.a = SK ? await E.makeSkier({ jump: true }) : await E.makeActor({ gear: 'jump' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = SK ? await E.makeSkier({ jump: true, friend: true }) : await E.makeActor({ gear: 'jump', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; S.ghost.g.traverse((o) => { o.castShadow = false; o.userData.noCast = true; }); }   /* (2026-11-25: the friend casts no shadow: under 100k a frame) */
    E.groundAt = (x, z) => (z > 0 ? hillY(z) : null);
    E.drawDist = E.MP.on ? 120 : 185;   /* (2026-11-25 v054: 2-player 130 → 120: a sideways phone reached 100.2k once) */   /* (2026-11-25: 235/160 → 185/130 with the longer in-run, its decorations and the deeper forest: under 100k a frame) */   /* (2026-11-25: 195 → 160 m with the Tripo skis and boots on both jumpers) (a party game draws a second ramp and the friend: a bit less far away) */   /* (2026-11-24: 320 → 235 m, the slower ramp keeps the long view on screen: under 100k a frame) */
    this.reset(E);
  },
  // Christmas (2026-11-24): lights up the in-run and down both sides of the hill, decorated trees and gifts beside the landing, a big tree and a sleigh in the outrun
  xmas(E, X) {
    if (!X.ok) return; const { THREE } = E, hw = S.J.hillHalfWidth, H = (x, z, dy = 0) => new THREE.Vector3(x, hillY(z) + dy, z), c = { p: new THREE.Vector3(), ang: 0 };
    for (const sd of [1, -1]) { for (let s0 = 0; s0 < S.LIN; s0 += 27) { const posts = []; for (let s = s0; s <= Math.min(S.LIN, s0 + 27); s += 4.5) { inrunAt(s, c); posts.push(c.p.clone().add(new THREE.Vector3(sd * 2.12, 1.82, 0))); } if (posts.length > 1) X.lights(posts, { sag: 0.2, per: 4, size: 0.09, glow: 0.9 }); }
      for (let z0 = 0; z0 < 180; z0 += 36) { const posts = []; for (let z = z0; z <= z0 + 36; z += 9) posts.push(H(sd * (hw + 0.8), z, 1.2)); X.lights(posts, { sag: 0.35, per: 5, size: 0.15, glow: 1.1 }); } }
    for (let z = 40, i = 0; z < 190; z += 45, i++) { const sd = i % 2 ? 1 : -1;
      X.put('XmasTree_Big', H(sd * (hw + 4.5), z), i, 1.35); X.put('XmasTree_Small', H(-sd * (hw + 3.6), z + 14), -i, 1.8);
      X.put(['Gift_A', 'Gift_B', 'Gift_C'][i % 3], H(sd * (hw + 2.6), z - 2), i); 
      if (i % 2) X.put('Snowman', H(-sd * (hw + 2.4), z - 5), -sd * 1.4); }
    X.put('XmasTree_Small', H(-9, 234), 0.3, 2.6); X.put('Sleigh', H(6, 222), -2.4); X.put('Gift_A', H(-7, 229), 1);
    inrunAt(0, c); X.put('StarLight', new THREE.Vector3(0, 53.45 + EXT.dy + 3.3 + 1.55 + 0.55, -95.9 + EXT.dz), 0, 1.6); for (const sd of [1, -1]) X.put('Lantern', c.p.clone().add(new THREE.Vector3(sd * (IRW + 0.4), 0, 1)), sd);
    // (2026-11-25) the hut: lights along both roof edges and the eaves, a little tree on each front corner of the deck
    const tp = 53.45 + EXT.dy + 3.3, zf = -93.05 + EXT.dz, zb = -98.75 + EXT.dz; X.lights([new THREE.Vector3(-2.95, tp - 0.1, zf), new THREE.Vector3(0, tp + 1.62, zf), new THREE.Vector3(2.95, tp - 0.1, zf)], { sag: 0.05, per: 9, size: 0.1, glow: 1.2 });
    for (const sd of [-1, 1]) { X.lights([new THREE.Vector3(sd * 2.95, tp - 0.1, zf), new THREE.Vector3(sd * 2.95, tp - 0.1, zb)], { sag: 0.12, per: 7, size: 0.1, glow: 1.1 }); X.put('XmasTree_Small', new THREE.Vector3(sd * 2.9, 53.45 + EXT.dy, -93.2 + EXT.dz), sd, 0.9); }
    this.xmasRamp(E, X);
  },
  // (2026-11-25, the user: "make the ramp more to Christmas style") the in-run, building on the chalet: a second, warm string of lights low on both
  // walls; green garlands with red and gold baubles swinging between the railing posts; wreaths on the outer walls; decorated firs where the
  // in-run meets the snow and beside the tower; a candy-cane gate at the start hut's door
  xmasRamp(E, X) {
    const { THREE } = E, c = { p: new THREE.Vector3(), ang: 0 }, V = (x, y, z) => new THREE.Vector3(x, y, z), at = (s) => inrunAt(s, { p: new THREE.Vector3(), ang: 0 });
    for (const sd of [1, -1]) for (let s0 = 0; s0 < S.LIN - 1; s0 += 27) { const posts = []; for (let s = s0; s <= Math.min(S.LIN, s0 + 27); s += 4.5) { inrunAt(s, c); posts.push(c.p.clone().add(V(sd * 2.22, 1.06, 0))); } if (posts.length > 1) X.lights(posts, { sag: 0.06, per: 3, size: 0.075, glow: 0.75, warm: true }); }
    // the garlands: one merged mesh of swags (8 × 4 tube segments each) and the baubles at their low points
    const parts = [], balls = [];
    for (const sd of [1, -1]) for (let s = 0; s < S.LIN - 4.6; s += 4.5) { const A = at(s), B = at(s + 4.5), a = A.p.clone().add(V(sd * 2.2, 1.72, 0)), b = B.p.clone().add(V(sd * 2.2, 1.72, 0)), m = a.clone().lerp(b, 0.5); m.y -= 0.42; m.x += sd * 0.06;
      parts.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 6, 0.08, 3, false).toNonIndexed()); balls.push([m.x + sd * 0.02, m.y - 0.02, m.z]); }
    let n = 0; for (const g of parts) n += g.attributes.position.count; const P = new Float32Array(n * 3), N = new Float32Array(n * 3); n = 0;
    for (const g of parts) { P.set(g.attributes.position.array, n * 3); N.set(g.attributes.normal.array, n * 3); n += g.attributes.position.count; g.dispose(); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(P, 3)); gg.setAttribute('normal', new THREE.BufferAttribute(N, 3)); gg.computeBoundingSphere();
    const gar = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: 0x1f6b3c, roughness: 0.85, flatShading: true })); gar.userData.noCast = true; E.scene.add(gar); S.garG = [gar];
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.35 }), balls.length), M4 = new THREE.Matrix4(), cols = [0xd9203e, 0xffc23a, 0xd9203e, 0x7ab8ff].map((h) => new THREE.Color(h));
    balls.forEach(([x, y, z], i) => { M4.makeTranslation(x, y, z); bm.setMatrixAt(i, M4); bm.setColorAt(i, cols[i % cols.length]); }); bm.computeBoundingSphere(); bm.userData.noCast = true; E.scene.add(bm); S.garG.push(bm);
    // wreaths on the outer walls between the sponsor boards
    for (const s of [39, 74, 110, 146]) if (s < S.LIN - 6) for (const sd of [1, -1]) { const A = at(s); X.put('Wreath', A.p.clone().add(V(sd * 2.32, 0.05, 0)), sd * Math.PI / 2, 1.1); }
    // decorated firs where the in-run comes down to the snow, and beside the tower on the hillside
    for (const [s, sd] of [[136, 1], [152, -1]]) { const A = at(s), x = sd * 5.2, gb = S.gy(x, A.p.z); if (Number.isFinite(gb) && A.p.y - gb < 7) X.put('XmasTree_Small', V(x, gb, A.p.z), s, 1.7); }
    { const A = at(0); for (const sd of [1, -1]) { const x = sd * 9.5, z = A.p.z - 4; X.put('XmasTree_Big', V(x, S.gy(x, z) - 0.2, z), sd, 1.5); X.put('Gift_A', V(sd * 7.6, S.gy(sd * 7.6, z + 2), z + 2), sd); } }
    // the candy-cane gate at the hut's door: it frames Foxino at the start and the hut's star
    { const A = at(1.4), y0 = A.p.y + 0.85, h = 3.7, r = 2.45, tex = stripeTex(THREE), pm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }), grp = new THREE.Group();
      for (const sd of [1, -1]) { const t2 = tex.clone(); t2.repeat.set(1, h * 1.6); t2.needsUpdate = true; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, h, 8), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.45 })); p.position.set(sd * r, y0 + h / 2, A.p.z); grp.add(p); }
      const arcC = new THREE.Curve(); arcC.getPoint = (t, o = new THREE.Vector3()) => o.set(-Math.cos(t * Math.PI) * r, y0 + h + Math.sin(t * Math.PI) * r * 0.75, A.p.z);
      const at2 = tex.clone(); at2.repeat.set(14, 1); at2.needsUpdate = true; grp.add(new THREE.Mesh(new THREE.TubeGeometry(arcC, 24, 0.17, 6, false), new THREE.MeshStandardMaterial({ map: at2, roughness: 0.45 })));
      grp.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.noCast = true; } }); E.scene.add(grp);
      const lp = []; for (let i = 0; i <= 10; i++) lp.push(arcC.getPoint(i / 10).add(V(0, 0.2, 0.18))); X.lights(lp, { sag: 0.0, per: 3, size: 0.09, glow: 1.0 });}
  },
  reset(E) { if (JM) JM.classList.remove('on', 'done'); Object.assign(S, { phase: 'menu', s: 0, v: 0, jump: 0, dist: [], asking: '', fl: null }); E.snapCam(); try { const b = JSON.parse(localStorage.getItem('snow-jump-best1') || 'null'); if (b) S.lines.best.set(b); } catch (e) {} },
  menu() { S.phase = 'menu'; },
  async run(E) {
    this.reset(E);
    for (let j = 0; j < 2; j++) {
      S.jump = j; S.phase = 'bar'; S.s = 0; S.v = 0; S.bonus = 0; S.takeoff = false; S.glide = 0; S.fl = null; E.snapCam();
      // (2026-11-25, the user: "make there no intro just normal start answering make sure there is nothing in the way from the start") no JUMP 1 / GO!
      // banners and no waiting: the first question comes at once (the question card says which jump it is)
      const duo = E.MP.on && E.MP.alive; await E.wait(j ? 0.4 : 0.05);
      if (duo) await E.sync('jump' + j, 20000);   /* (2026-11-25: both jumpers start at the same moment) */
      // (2026-11-24, the user: "only answer questions on the ramp ... a bit slower speed around 15 seconds to jump and you need to answer as many
      // questions possible") a steady run down the in-run, about 15 s; question after question at full speed (no slow motion); every right answer
      // is more distance. Nothing to answer at the take-off or in the air.
      S.phase = 'inrun'; S.got = 0; S.miss = 0; let qn = 0;
      const head = () => S.a.g.position.clone().setY(S.a.g.position.y + 1.2), END = S.LIN * RAMP_END;
      while (S.s < END - 3) { qn++; S.asking = 'inrun';
        const r = await Promise.race([E.ask({ who: `RAMP · QUESTION ${qn}`, num: `JUMP ${j + 1}`, size: 0.54, slow: 1, anchors: (out) => E.around(S.a.g.position.clone().setY(S.a.g.position.y + 0.5), out, 1.15, 1.0) })   /* (2026-11-25, the user: "the bubbles a bit smaller and closer to each other": 0.8 → 0.54, spread 1.9 → 1.15) */, E.until(() => S.s >= END).then(() => null)]);
        S.asking = ''; if (!r) { E.cancelAsk(); break; }
        if (r.ok) { S.got++; E.juice(r, head(), `+${PER_RIGHT} m`); rushFx(E, S.a.g.position); } else { S.miss++; E.juice(r, head(), 'no extra'); }
        await E.wait(r.ok ? 0.5 : 1.1); }
      E.cancelAsk(); S.asking = ''; S.takeoff = S.got >= 3 && S.miss === 0;
      if (S.got) E.banner(`${S.got} RIGHT!`, S.takeoff ? 'PERFECT RAMP · TAKE-OFF!' : 'TAKE-OFF!', 1100);
      E.cine(true); await E.until(() => S.phase === 'flight'); jumpMeter(true);
      await E.until(() => S.phase === 'outrun'); E.cine(false);
      const d = Math.round(S.fl.D * 2) / 2; S.dist.push(d); S.lines.last.set(d);
      if (E.MP.on && E.MP.alive) E.MP.send({ t: 'land', j, d });
      await countUp(E, d, d >= S.J.K ? 'OVER THE K LINE!' : `JUMP ${j + 1}`); E.shake(0.45);
      if (E.MP.on && E.MP.alive) {   // (2026-11-25: once both have jumped, who jumped further)
        const got = () => E.mpMsgs.find((m) => m.t === 'land' && m.j === j);
        for (let w = 0; w < 30 && !got() && E.MP.alive; w++) { if (w === 2) E.banner(`WAITING FOR ${E.MP.fname.toUpperCase()}…`, '', 1400); await E.wait(0.5); }
        const fm = got(); if (fm) { const fd = fm.d, win = d > fd, draw = d === fd; E.banner(draw ? 'A DRAW!' : win ? 'YOU WIN!' : `${E.MP.fname.toUpperCase()} WINS!`, `jump ${j + 1}: you ${d.toFixed(1)} m · ${E.MP.fname} ${fd.toFixed(1)} m`, 2600); if (win) { E.sfx.cheer && E.sfx.cheer(); } await E.wait(2.8); } }
      E.send({ p: (j + 1) / 2, v: `${S.dist.reduce((a, b) => a + b, 0).toFixed(1)} m`, best: Math.max(...S.dist) });
      try { const b = JSON.parse(localStorage.getItem('snow-jump-best1') || '0'); if (d > b) { localStorage.setItem('snow-jump-best1', JSON.stringify(d)); S.lines.best.set(d); } } catch (e) {}
      await E.until(() => S.phase === 'stop'); await E.wait(1.6);
    }
    const total = Math.round(S.dist.reduce((a, b) => a + b, 0) * 2) / 2;
    E.cine(true); E.banner(`${total.toFixed(1)} m`, 'TWO JUMPS', 1800); await E.wait(2.2); E.cine(false);
    E.finish({ score: total, shown: total.toFixed(1), unit: 'metres', better: 'high', line: `${S.dist[0].toFixed(1)} m + ${S.dist[1].toFixed(1)} m` });
  },
  // the friend's jumper on the friend's ramp: their phase and position, eased so it glides between updates
  friendGhost(E, t, rdt) {
    const G = S.ghost, F = E.mpFriend, { THREE } = E; if (!F || !E.MP.alive) { G.g.visible = false; return; }
    const c = { p: new THREE.Vector3(), ang: 0 }; let pos, pitch = 0, P;
    if (F.ph === 'menu' || F.ph === 'bar') { inrunAt(0.5, c); pos = c.p.clone(); pitch = c.ang; P = P0.sit(t); }
    else if (F.ph === 'inrun') { inrunAt(F.s || 0, c); pos = c.p.clone(); pitch = c.ang; P = (F.s || 0) > S.LIN - 4 ? P0.pop(t) : P0.tuck(t); }
    else if (F.ph === 'flight') { pos = new THREE.Vector3(0, F.y || 0, F.z || 0); P = P0.fly(t + 1); pitch = G.isClip ? 0.1 : 0.42; G.skiFree = true; G.skiYaw = [0.3, -0.3]; G.skiPitch = -0.55; }
    else { const z = F.z || 0; pos = new THREE.Vector3(0, hillY(z), z); pitch = Math.atan(hillY(z) - hillY(z + 1)) * 0.9; P = F.ph === 'stop' ? E.SP.cheer(t) : P0.telemark(t); }
    if (F.ph !== 'flight') { G.skiFree = false; G.skiYaw = [0, 0]; G.skiPitch = 0; }
    pos.x += FR_X; const jump = !G.g.visible || G.g.position.distanceTo(pos) > 25;
    if (jump) G.g.position.copy(pos); else G.g.position.lerp(pos, 1 - Math.exp(-rdt * 12));
    G.g.visible = true; G.g.rotation.set(0, 0, 0); G.g.rotateX(pitch); if (G.isClip) { G.want(skiClip(F.ph, F.s || 0, F.z || 0, F.d)); G.update(rdt); } else { G.pose(P, 8, rdt); G.update(); }
  },
  // the flight: a parabola from where he is now (z0, y0, slope b) that lands exactly at the target distance D
  retarget(dD) { const f = S.fl; if (!f) return; f.D = Math.max(55, Math.min(128, f.D + dD)); const z0 = f.z, y0 = f.y, b = f.slope, L = f.D - z0; f.z0 = z0; f.y0 = y0; f.b = b; f.a = (hillY(f.D) - y0 - b * L) / (L * L); },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; S.rush = Math.max(0, (S.rush || 0) - rdt * 1.5); const t = E.T, { THREE } = E, c = { p: new THREE.Vector3(), ang: 0 };
    let P = P0.sit(t), pitch = 0;
    a.skiFree = false; a.skiYaw = [0, 0]; a.skiPitch = 0;
    if (S.phase === 'menu' || S.phase === 'bar') {
      inrunAt(0.5, c); a.g.position.copy(c.p); pitch = c.ang; P = P0.sit(t);
      const Pp = a.g.position;
      // (2026-11-25, the user: "this is the intro fix it make it so it doesnt cover the screen") the start screen: a wide shot from beside and in
      // front of the start bar, the ramp and the hill behind him (the old orbit went through the start tower and filled the screen)
      { const o = frontCam(Pp, c.ang, S.phase === 'menu' ? Math.sin(t * 0.25) * 0.7 : 0); E.cam(o.pos, o.look, 3, 52); }   // (in front of him, looking back up at the start bar: the whole start in view)
      E.focusAt = Pp; E.focus = 4.5;
    } else if (S.phase === 'inrun') {
      inrunAt(S.s, c);
      { const END = S.LIN * RAMP_END, acc = 2 * (END - V0 * RAMP_T) / (RAMP_T * RAMP_T); S.v = S.s < END ? Math.max(V0, S.v) + acc * dt : Math.min(26, S.v + 16 * dt); } S.s += S.v * dt;   /* (2026-11-25, the user: "make there acceleration so you dont go constant speed all the time": speeding up all the way down like gravity, still ~15 s to the table, then the push off it) */
      a.g.position.copy(c.p); pitch = c.ang; P = S.s > S.LIN - 4 ? P0.pop(t) : P0.tuck(t);
      if (S.s >= S.LIN) { // take-off: the target distance from the answers
        S.phase = 'flight';
        const D = 58 + Math.min(10, S.got || 0) * 5.5 + (S.takeoff ? 8 : 0) + Math.random() * 2;   /* (every right answer on the ramp = 5.5 m) */
        const b = -Math.tan(11 * Math.PI / 180) + (S.takeoff ? 0.06 : -0.02);
        S.fl = { z: 0, y: 0, z0: 0, y0: 0, b, a: 0, D: Math.min(128, D), slope: b, vz: Math.max(20, S.v) * 0.96 }; this.retarget(0);
        E.spray.emit(a.g.position, 16, 0, 2, 3, 1.2);
      }
    } else if (S.phase === 'flight') {
      const f = S.fl; f.z += f.vz * dt; const dz = f.z - f.z0; f.y = f.y0 + f.b * dz + f.a * dz * dz; f.slope = f.b + 2 * f.a * dz;
      a.g.position.set(0, f.y, f.z); pitch = Math.atan(-f.slope) * 0.4 + (a.isClip ? 0.1 : 0.42); P = P0.fly(t);   /* (the new skier's fly clip leans forward itself) */
      a.skiFree = true; a.skiYaw = [0.3, -0.3]; a.skiPitch = -0.55;
      jumpMeterLive(f.z);
      if (f.z >= f.D) { S.phase = 'land'; S.landT = 0; E.shake(0.6); E.spray.emit(a.g.position, 40, 0, 3, 5, 3); S.v = f.vz; S.z = f.z; }
    } else if (S.phase === 'land' || S.phase === 'outrun' || S.phase === 'stop') {
      S.landT = (S.landT || 0) + dt;
      if (S.phase === 'land' && S.landT > 0.35) S.phase = 'outrun';
      const slope = hillY(S.z) - hillY(S.z + 1);
      S.v = Math.max(0, S.v + (S.z > 165 ? -9 : 9.8 * Math.sin(Math.atan(slope)) * 0.3 - 1.5) * dt); S.z += S.v * dt;
      if (S.z > 168 && S.v > 2) E.spray.emit(a.g.position, 3, 4, 1.5, 0, 1.5);
      if (S.v < 0.3 && S.phase === 'outrun') S.phase = 'stop';
      a.g.position.set(0, hillY(S.z), S.z); pitch = Math.atan(slope) * 0.9;
      P = S.phase === 'stop' ? E.SP.cheer(t) : S.z < (S.fl ? S.fl.D + 12 : 0) ? P0.telemark(t) : E.SP.carve(t, 0, 0.4);
      if (S.phase === 'stop') a.g.rotation.y = 0;
    }
    a.g.rotation.set(0, 0, 0); a.g.rotateX(pitch);
    if (a.isClip) { a.want(skiClip(S.phase, S.s, S.z, S.fl && S.fl.D)); a.update(rdt); } else { a.pose(P, S.phase === 'flight' ? 6 : 12, rdt); a.update(); }
    E.mpSend({ ph: S.phase, s: S.s, z: S.phase === 'flight' && S.fl ? S.fl.z : S.z, y: S.fl ? S.fl.y : 0, j: S.jump });
    // the friend: their longest jump as an orange line; their Foxino flies beside you
    if (E.friend && E.friend.best) S.lines.friend.set(E.friend.best);
    if (S.ghost && E.MP.on) { this.friendGhost(E, t, rdt); } else if (S.ghost && E.friend && S.phase === 'flight') { S.ghost.g.visible = true; S.ghost.g.position.copy(a.g.position).add(new THREE.Vector3(-3.5, 0.3, -2)); S.ghost.g.rotation.copy(a.g.rotation); S.ghost.pose(P0.fly(t + 1), 6, rdt); S.ghost.skiFree = true; S.ghost.skiYaw = [0.3, -0.3]; S.ghost.skiPitch = -0.55; S.ghost.update(); } else if (S.ghost) S.ghost.g.visible = false;
    const tot = S.dist.reduce((x, y) => x + y, 0);
    E.hud(tot ? `${tot.toFixed(1)} m` : 'SKI JUMP',   /* (the jump itself is counted big by the meter) */ `JUMP ${S.jump + 1} OF 2${S.phase === 'inrun' ? ` · ${Math.round(S.v * 3.6)} km/h` : ''}`);
    E.progress((S.jump + (S.phase === 'flight' || S.phase === 'land' || S.phase === 'outrun' || S.phase === 'stop' ? 0.5 + 0.5 * (S.phase === 'flight' ? S.fl.z / S.fl.D : 1) : (S.s / S.LIN) * 0.5)) / 2);
    if (S.phase !== 'menu' && S.phase !== 'bar') this.camera(E, rdt);
  },
  camera(E, rdt) {
    const { THREE } = E, P = S.a.g.position; let pos, look, k = 5, fov = 60;
    if (S.phase === 'inrun') {
      if (S.asking === 'takeoff') { pos = new THREE.Vector3(7, P.y + 1.5, P.z + 4); look = P.clone().setY(P.y + 0.4).add(new THREE.Vector3(0, 0, 3)); k = 4; fov = 52; }
      else { const c = inrunAt(S.s, { p: new THREE.Vector3(), ang: 0 }), ca = Math.cos(c.ang), sa = Math.sin(c.ang);
        pos = P.clone().add(new THREE.Vector3(0.5, sa * 5.5 + ca * 2.0, -ca * 5.5 + sa * 2.0)); look = P.clone().add(new THREE.Vector3(0, -sa * 7 + 0.4, ca * 7)); k = 7; fov = 62;
        // (2026-11-25) the first metres: 5.5 m behind him is still inside the start tower (a pink/orange screen while he speeds up), so the
        // camera starts in front of him looking back up (as on the start screen), then cranes up over his head to behind him once he is clear
        const out = Math.max(0, Math.min(1, (S.s - 7) / 20)), b = out * out * (3 - 2 * out);
        if (b < 1) { const F = frontCam(P, c.ang, 0), M = P.clone().add(new THREE.Vector3(1.0, 0, 0)).addScaledVector(new THREE.Vector3(0, ca, sa), 5.2).addScaledVector(new THREE.Vector3(0, -sa, ca), -0.6), q = 1 - b;
          const behind = pos.clone(); pos.set(0, 0, 0).addScaledVector(F.pos, q * q).addScaledVector(M, 2 * q * b).addScaledVector(behind, b * b);   // (a curve: front → over his head → behind, never through him) (2026-11-25 fix: the end point was read after the reset, so the camera flew ~100 m away at 17-28 m)
          look.lerp(P.clone().addScaledVector(new THREE.Vector3(0, ca, sa), 0.6), Math.min(1, q * 2.2)); fov = 54 + 8 * b; k = 12; }
      }
    } else if (S.phase === 'flight') {
      const f = S.fl, u = f.z / f.D;
      if (S.asking === 'flight' || u < 0.75) { pos = P.clone().add(new THREE.Vector3(8.5, 1.8, -3)); look = P.clone().add(new THREE.Vector3(0, -0.6, 3)); k = 5; fov = 56; }
      else { pos = P.clone().add(new THREE.Vector3(2.5, 2.2, -7)); look = P.clone().add(new THREE.Vector3(0, -2.5, 8)); k = 4; fov = 60; }
    } else {
      pos = P.clone().add(new THREE.Vector3(4.5, 1.6, 7)); look = P.clone().setY(P.y + 0.8); k = S.v > 6 ? 9 : 2.5; fov = 52;   /* (2026-11-24: it catches up at once on landing, so he is in the shot while the metres count up) */
      if (S.phase === 'stop') { pos = P.clone().add(new THREE.Vector3(2.2, 1.3, 3.8)); }
    }
    if (S.phase === 'inrun' && S.rush > 0) fov += 16 * Math.sin(Math.min(1, S.rush) * Math.PI / 2);   /* (the speed rush: the view widens, then eases back) */
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
