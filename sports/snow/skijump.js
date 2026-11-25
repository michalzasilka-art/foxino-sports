import { sponsorTex } from './sponsors.js?v=1';
// SKI JUMP: two jumps from a big hill at golden hour. On the in-run three questions (right = more speed), one at the
// take-off (right = a perfect pop) and one in the air (right = he glides further). The two distances add up; the friend's and
// your best distance show as lines on the hill. Longest total wins.
const S = { a: null, ghost: null, inrun: [], acc: [], LIN: 100, hill: [], phase: 'menu', s: 0, v: 0, z: 0, fl: null, jump: 0, dist: [], bonus: 0, takeoff: false, glide: 0, lines: {}, asking: '', stopT: 0, shotT: 0 };
const THREEp = {};
const FR_X = -6.5;   // (the friend's ramp, in a party game)
const RAMP_T = 12, RAMP_END = 0.93, PER_RIGHT = 5.5, V0 = 2.2;   // (the ramp: ~12 s, speeding up from V0 m/s all the way down; the questions stop at 93 %; metres per right answer) (2026-11-25, the user: "faster acceleration": 15 s → 12 s, a quicker push off)
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
const IRW = 2.4;   // (half the in-run's width, for its Christmas lights)
function hillY(z) { const H = S.hill; if (z <= 0) return H[0][1]; const i = Math.min(H.length - 2, Math.floor(z)), f = Math.min(1, z - i); return H[i][1] * (1 - f) + H[i + 1][1] * f; }
function inrunAt(s, out) {
  s = Math.max(0, Math.min(S.LIN, s)); let i = 1; while (i < S.acc.length - 1 && S.acc[i] < s) i++;
  const f = (s - S.acc[i - 1]) / Math.max(1e-6, S.acc[i] - S.acc[i - 1]), A = S.inrun[i - 1], B = S.inrun[i];
  out.p.set(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f); out.ang = Math.atan2(A[1] - B[1], B[2] - A[2]); return out;
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
function buildTower(THREE, xo, banners) {
  const G = new THREE.Group(), M = {}, mat = (k, o = {}) => (M[k + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: PAL[k] ?? k, roughness: 0.7, ...o }));
  const box = (w, h, d, x, y, z, m, ry = 0, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x + xo, y, z); b.rotation.set(0, ry, rz); G.add(b); return b; };
  const top = 53.45, z0 = -98.3, z1 = -93.55, hw = 2.6, wallH = 3.3, peak = top + wallH + 1.55;
  // the deck under the hut and its railing (navy posts, a white rail)
  box(7, 0.3, 6.6, 0, top - 0.15, -95.8, mat('navy'));
  for (const sd of [-1, 1]) { for (let z = -98.9; z <= -92.7; z += 1.55) box(0.12, 1.0, 0.12, sd * 3.4, top + 0.5, z, mat('navy')); box(0.1, 0.1, 6.4, sd * 3.4, top + 1.02, -95.8, mat('white')); }
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
      const sn = box(0.36, 0.1, seg, sd * 2.05, mid[0] + 0.95, mid[1], mat('snow')); sn.rotation.x = a; } }
  // the sponsors on the in-run's outer sides (each side its own order)
  if (banners) for (const [s, k] of [[22, 'red'], [48, 'face'], [74, 'red']]) for (const sd of [-1, 1]) { const [y, z, a] = at(s), kind = sd > 0 ? k : (k === 'red' ? 'face' : 'red');
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
    // (2026-11-25, multiplayer: "exactly 2 ramps side by side, you see your friend right next to you") the friend's in-run, a copy of ours
    // 6.5 m to the left (the cameras look from the right, so it never comes between them and Foxino)
    if (E.MP.on) { for (const o of g.scene.children.slice()) if (/^(Inrun|Brace|Pillar|Start)/.test(o.name)) { const c = o.clone(); c.position.x += FR_X; c.traverse((m) => { m.castShadow = false; m.userData.noCast = true; }); g.scene.add(c); } }
    S.J = J; S.inrun = J.inrun; S.hill = J.hill; S.acc = [0]; for (let i = 1; i < S.inrun.length; i++) { const A = S.inrun[i - 1], B = S.inrun[i]; S.acc.push(S.acc[i - 1] + Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2])); } S.LIN = S.acc[S.acc.length - 1];
    E.scene.add(buildTower(THREE, 0, true)); if (E.MP.on) E.scene.add(buildTower(THREE, FR_X, false));
    E.scene.add(buildJudges(THREE, -24, 52, hillY(52) - 1.5));
    E.scene.add(E.instanceField(J.trees, (t) => `Pine${t}`)); E.scene.add(E.instanceField(J.rocks, (t) => `Rock${t}`));
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
    S.a = await E.makeActor({ gear: 'jump' });
    if (/[?&]party=1/.test(location.search)) { S.ghost = await E.makeActor({ gear: 'jump', kit: E.FRIEND_KIT }); S.ghost.g.visible = false; S.ghost.g.traverse((o) => { o.castShadow = false; o.userData.noCast = true; }); }   /* (2026-11-25: the friend casts no shadow: under 100k a frame) */
    E.groundAt = (x, z) => (z > 0 ? hillY(z) : null);
    E.drawDist = E.MP.on ? 160 : 235;   /* (2026-11-25: 195 → 160 m with the Tripo skis and boots on both jumpers) (a party game draws a second ramp and the friend: a bit less far away) */   /* (2026-11-24: 320 → 235 m, the slower ramp keeps the long view on screen: under 100k a frame) */
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
    inrunAt(0, c); X.put('StarLight', new THREE.Vector3(0, 53.45 + 3.3 + 1.55 + 0.55, -95.9), 0, 1.6); for (const sd of [1, -1]) X.put('Lantern', c.p.clone().add(new THREE.Vector3(sd * (IRW + 0.4), 0, 1)), sd);
    // (2026-11-25) the hut: lights along both roof edges and the eaves, a little tree on each front corner of the deck
    const tp = 53.45 + 3.3; X.lights([new THREE.Vector3(-2.95, tp - 0.1, -93.05), new THREE.Vector3(0, tp + 1.62, -93.05), new THREE.Vector3(2.95, tp - 0.1, -93.05)], { sag: 0.05, per: 9, size: 0.1, glow: 1.2 });
    for (const sd of [-1, 1]) { X.lights([new THREE.Vector3(sd * 2.95, tp - 0.1, -93.05), new THREE.Vector3(sd * 2.95, tp - 0.1, -98.75)], { sag: 0.12, per: 7, size: 0.1, glow: 1.1 }); X.put('XmasTree_Small', new THREE.Vector3(sd * 2.9, 53.45, -93.2), sd, 0.9); }
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
        if (r.ok) { S.got++; E.juice(r, head(), `+${PER_RIGHT} m`); } else { S.miss++; E.juice(r, head(), 'no extra'); }
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
    else if (F.ph === 'flight') { pos = new THREE.Vector3(0, F.y || 0, F.z || 0); P = P0.fly(t + 1); pitch = 0.42; G.skiFree = true; G.skiYaw = [0.3, -0.3]; G.skiPitch = -0.55; }
    else { const z = F.z || 0; pos = new THREE.Vector3(0, hillY(z), z); pitch = Math.atan(hillY(z) - hillY(z + 1)) * 0.9; P = F.ph === 'stop' ? E.SP.cheer(t) : P0.telemark(t); }
    if (F.ph !== 'flight') { G.skiFree = false; G.skiYaw = [0, 0]; G.skiPitch = 0; }
    pos.x += FR_X; const jump = !G.g.visible || G.g.position.distanceTo(pos) > 25;
    if (jump) G.g.position.copy(pos); else G.g.position.lerp(pos, 1 - Math.exp(-rdt * 12));
    G.g.visible = true; G.g.rotation.set(0, 0, 0); G.g.rotateX(pitch); G.pose(P, 8, rdt); G.update();
  },
  // the flight: a parabola from where he is now (z0, y0, slope b) that lands exactly at the target distance D
  retarget(dD) { const f = S.fl; if (!f) return; f.D = Math.max(55, Math.min(128, f.D + dD)); const z0 = f.z, y0 = f.y, b = f.slope, L = f.D - z0; f.z0 = z0; f.y0 = y0; f.b = b; f.a = (hillY(f.D) - y0 - b * L) / (L * L); },
  update(E, dt, rdt) {
    const a = S.a; if (!a) return; const t = E.T, { THREE } = E, c = { p: new THREE.Vector3(), ang: 0 };
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
      a.g.position.set(0, f.y, f.z); pitch = Math.atan(-f.slope) * 0.4 + 0.42; P = P0.fly(t);
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
    a.pose(P, S.phase === 'flight' ? 6 : 12, rdt); a.update();
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
          pos.set(0, 0, 0).addScaledVector(F.pos, q * q).addScaledVector(M, 2 * q * b).addScaledVector(pos.clone(), b * b);   // (a curve: front → over his head → behind, never through him)
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
    E.cam(pos, look, k, fov); E.focusAt = P; E.focus = P.distanceTo(E.camera.position);
  },
};
