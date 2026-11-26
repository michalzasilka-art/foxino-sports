// The question look shared with Snowboard (H33): the sentence on a 3D sign floating in the camera's view, the answers as three big buttons, the
// purple comic pop-ups. Paddling (2026-11-27, P2) adds the RHYTHM BAR: a bar that fills over the answer time; its middle half is GREEN
// (Michal: "even when you guess right as fast as 1 second, there is still no consistency, which would be the green part covering 50%, centered
// in the middle"): a right word in the green = the crew in time with the drum; too early or too late = no rhythm.
export const SIGN = { m: null, cv: null, tex: null, on: false, t0: 0, out: 0, who: '', q: null, res: null, ar: 3 };
export function signDraw(E) {
  const { THREE } = E, q = SIGN.q, r = SIGN.res; if (!q) return;
  const W = 1024, cv = SIGN.cv || (SIGN.cv = document.createElement('canvas')), g = cv.getContext('2d'), pad = 46, maxW = W - pad * 2;
  const fill = r ? q.right : null, ok = r && r.ok;
  const toks = []; const add = (t) => { for (const part of String(t).split(/(\([^)]*\))/)) { if (!part) continue; if (/^\(.*\)$/.test(part)) toks.push({ t: part, hint: 1 }); else for (const w of part.split(/(\s+)/)) if (w && !/^\s+$/.test(w)) toks.push({ t: w }); } };
  add(q.before || ''); toks.push({ gap: 1 }); add(q.after || '');
  let fs = 78, lines = [];
  const font = (f, hint) => `${hint ? 700 : 400} ${Math.round(hint ? f * 0.72 : f)}px 'Lilita One', 'Arial Black', sans-serif`;
  const width = (tk, f) => { if (tk.gap) { g.font = font(f); return fill ? g.measureText(fill).width + f * 0.5 : f * 2.6; } g.font = font(f, tk.hint); return g.measureText(tk.t).width; };
  for (; fs >= 40; fs -= 4) { lines = [[]]; let x = 0; const sp = fs * 0.28;
    for (const tk of toks) { const w = width(tk, fs); if (x > 0 && x + sp + w > maxW) { lines.push([]); x = 0; } lines[lines.length - 1].push({ tk, w }); x += (x > 0 ? sp : 0) + w; }
    if (lines.length <= 3) break; }
  const lh = fs * 1.22, headH = 62, noteH = 58, H = Math.round(pad * 0.7 + headH + lines.length * lh + noteH + pad * 0.5);
  cv.width = W; cv.height = H; SIGN.ar = W / H;
  const rr = (x, y, w, h, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
  g.clearRect(0, 0, W, H); rr(8, 8, W - 16, H - 16, 40); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 12; g.strokeStyle = r ? (ok ? '#2fbf6a' : '#e8456b') : '#7e34f2'; g.stroke();
  g.fillStyle = '#7e34f2'; g.font = "400 40px 'FoxComic', 'Lilita One', sans-serif"; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(SIGN.who.toUpperCase(), W / 2, pad * 0.7 + headH / 2);
  let y = pad * 0.7 + headH + lh / 2; const sp = fs * 0.28; g.textAlign = 'left';
  for (const ln of lines) { const tw = ln.reduce((t, it, i) => t + it.w + (i ? sp : 0), 0); let x = (W - tw) / 2;
    for (const { tk, w } of ln) {
      if (tk.gap) { if (fill) { rr(x, y - fs * 0.62, w, fs * 1.18, 18); g.fillStyle = '#2fbf6a'; g.fill(); g.fillStyle = '#ffffff'; g.font = font(fs); g.fillText(fill, x + fs * 0.25, y + 2); }
        else { g.fillStyle = '#ffc23a'; g.fillRect(x, y + fs * 0.42, w, 10); } }
      else { g.fillStyle = tk.hint ? '#7a6fa8' : '#22164f'; g.font = font(fs, tk.hint); g.fillText(tk.t, x, y + 2); }
      x += w + sp; }
    y += lh; }
  g.textAlign = 'center'; g.font = "700 36px 'Lilita One', 'Arial Black', sans-serif";
  if (!r) { g.fillStyle = '#7a6fa8'; g.fillText('Tap the right word when the bar is green', W / 2, H - pad * 0.5 - noteH / 2); }
  else if (ok) { g.fillStyle = '#1e9e55'; g.fillText('Yes!', W / 2, H - pad * 0.5 - noteH / 2); }
  else { g.fillStyle = '#d23447'; g.fillText(`${r.timeout ? 'Too slow! ' : ''}The right word: ${q.right}`, W / 2, H - pad * 0.5 - noteH / 2); }
  if (SIGN.tex && (SIGN.tex.image.width !== W || SIGN.tw !== W || SIGN.th !== H)) { SIGN.tex.dispose(); SIGN.tex = null; }   // (a new size = a new texture)
  if (!SIGN.tex) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; SIGN.tex = new THREE.CanvasTexture(c2); SIGN.tex.colorSpace = THREE.SRGBColorSpace; SIGN.tex.anisotropy = 4; SIGN.tw = W; SIGN.th = H; }
  SIGN.tex.image.getContext('2d').clearRect(0, 0, W, H); SIGN.tex.image.getContext('2d').drawImage(cv, 0, 0); SIGN.tex.needsUpdate = true; if (SIGN.m) { SIGN.m.material.map = SIGN.tex; SIGN.m.material.needsUpdate = true; }
}
export function signShow(E, who, q) {
  const { THREE } = E; SIGN.who = who; SIGN.q = q; SIGN.res = null; signDraw(E);
  if (!SIGN.m) { SIGN.m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SIGN.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); SIGN.m.renderOrder = 30; SIGN.m.frustumCulled = false; SIGN.m.userData.noCast = true; }
  if (!E.camera.parent) E.scene.add(E.camera); if (SIGN.m.parent !== E.camera) E.camera.add(SIGN.m);
  SIGN.m.material.map = SIGN.tex; SIGN.m.material.needsUpdate = true; SIGN.on = true; SIGN.t0 = performance.now(); SIGN.out = 0; SIGN.m.visible = true; signPlace(E);
}
export function signAnswer(E, r) { if (!SIGN.on || !SIGN.q) return; SIGN.res = r; signDraw(E); SIGN.out = performance.now() + (r.ok ? 650 : 1500); }
export function signPlace(E) {   // every frame: where the sign floats in the camera's view (and its fly-in / fly-off)
  const m = SIGN.m; if (!m || !SIGN.on) return; const now = performance.now(), cam = E.camera, D = 10;
  const vh = 2 * D * Math.tan(cam.fov * Math.PI / 360), vw = vh * cam.aspect, land = cam.aspect > 1;
  const w = Math.min(vw * (land ? 0.62 : 0.94), vh * (land ? 0.36 : 0.27) * SIGN.ar), h = w / SIGN.ar;
  const topPx = (land ? 64 : 86) / innerHeight, fy = Math.max(land ? 0.28 : 0.3, topPx + (h / vh) / 2 + 0.01);
  const kin = Math.min(1, (now - SIGN.t0) / 420), e = 1 - Math.pow(1 - kin, 3), kout = SIGN.out ? Math.max(0, Math.min(1, (now - SIGN.out) / 380)) : 0;
  const d = D + (1 - e) * 34 + kout * 22, sway = Math.sin(now / 900) * 0.025;
  m.position.set(0, vh * (0.5 - fy) * d / D + kout * 3, -d); m.rotation.set(-0.08 * (1 - e) + sway * 0.4, sway, sway * 0.5); m.scale.set(w, h, 1);
  m.material.opacity = Math.min(1, kin * 2) * (1 - kout); SIGN.botPx = (fy + (h / vh) / 2) * innerHeight;
  if (kout >= 1) { SIGN.on = false; m.visible = false; }
}

// the purple comic pop-ups (the same style as Snowboard's trick cards) + the answer buttons' layout + the rhythm bar
let FX = null;
export function fxRoot() { if (FX) return FX; const st = document.createElement('style'); st.textContent = `
#trickCard{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 84px);transform:translateX(-50%) scale(.5);opacity:0;z-index:31;pointer-events:none;text-align:center;font-family:'Lilita One','Arial Black',sans-serif;white-space:nowrap}
#trickCard.go{animation:tcIn .75s cubic-bezier(.2,1.4,.4,1) forwards} #trickCard.out{animation:none;transition:opacity .6s,transform .6s;opacity:0;transform:translateX(-50%) translateY(-16px) scale(.9)} body.asking #trickCard{display:none}
#trickCard b{display:block;font-size:clamp(26px,7.4vw,44px);font-weight:400;color:#fff;-webkit-text-stroke:2px #2a1e5c;paint-order:stroke fill;text-shadow:0 4px 0 #2a1e5c,0 0 18px rgba(255,120,220,.6)}
#trickCard i{display:inline-block;margin-top:4px;padding:3px 10px;border-radius:999px;background:#ff5fa8;color:#fff;font-style:normal;font-size:clamp(12px,3.4vw,15px);box-shadow:0 3px 0 #2a1e5c}
#trickCard.good b{color:#9dffc4} #trickCard.meh b{color:#ffe27a} #trickCard.oops b{color:#ffb0b0} #trickCard i.x{background:#2fbf6a;margin-left:6px}
body.tabs #labels{top:auto;bottom:0;left:0;right:0;height:auto;display:flex;justify-content:center;align-items:stretch;gap:10px;padding:0 max(12px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 52px) max(12px,env(safe-area-inset-left,0px))}
body.tabs .blabel{position:relative;left:auto;top:auto;transform:none!important;flex:1 1 0;max-width:230px;min-width:0;padding:0}
body.tabs .blabel span{height:100%;box-sizing:border-box;min-height:60px;display:flex;align-items:center;justify-content:center;padding:10px 8px;border-radius:18px;background:#2a1e5c;border:4px solid var(--c);box-shadow:0 5px 0 #140d33;font-size:clamp(19px,5.2vw,30px);overflow-wrap:anywhere}
body.tabs .blabel.long span{font-size:clamp(15px,4vw,22px)} body.tabs .blabel.on.wrong{opacity:.3}
@media (min-aspect-ratio:1/1){body.tabs #labels{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 40px)} body.tabs .blabel{max-width:210px} body.tabs .blabel span{min-height:48px;font-size:clamp(17px,3.2vw,26px)}}
.rBar{position:fixed;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 128px);height:30px;z-index:5;pointer-events:none;display:flex;border-radius:15px;overflow:hidden;border:3px solid #2a1e5c;box-shadow:0 4px 0 #140d33;font:400 clamp(11px,3vw,14px)/24px 'Lilita One',sans-serif;letter-spacing:.5px;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.4)}
.rBar s{flex:1 1 25%;text-decoration:none;text-align:center;background:#ff8f6b;opacity:.85} .rBar s.g{flex:2 1 50%;background:#2fbf6a;opacity:1} .rBar s.l{background:#ffb020}
.rBar u{position:absolute;top:-4px;bottom:-4px;left:0;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 0 2px #2a1e5c,0 0 10px #fff;animation:rB var(--t) linear forwards}
.rBar.done u{animation-play-state:paused} .rBar.hit-green{box-shadow:0 4px 0 #140d33,0 0 0 4px rgba(47,191,106,.6)} .rBar.hit-bad{box-shadow:0 4px 0 #140d33,0 0 0 4px rgba(232,69,107,.6)}
@keyframes rB{from{left:0}to{left:100%}}
@media (min-aspect-ratio:1/1){.rBar{bottom:calc(env(safe-area-inset-bottom,0px) + 102px);left:25%;right:25%}}
@media (min-aspect-ratio:3/2) and (max-height:560px){body.tabs #labels{top:0;bottom:0;left:auto;right:0;width:auto;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:8px;padding:0 max(12px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 40px) 0}
 body.tabs .blabel{flex:0 0 auto;width:min(210px,23vw);max-width:none} body.tabs .blabel span{min-height:50px}
 .rBar{left:auto;right:max(12px,env(safe-area-inset-right,0px));width:min(210px,23vw);bottom:calc(env(safe-area-inset-bottom,0px) + 226px)}}
.pdRes{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(26,12,70,.6),rgba(26,12,70,.25) 70%);animation:pdIn .35s ease-out}
.pdRes .card{width:min(88vw,420px);padding:16px 18px 14px;border-radius:24px;background:#fff;box-shadow:0 9px 0 #2a0b57,0 0 0 5px #7e34f2,0 18px 40px rgba(0,0,0,.35);font-family:'Lilita One',sans-serif;color:#22164f;text-align:center}
.pdRes h3{margin:0 0 8px;font:400 clamp(22px,6vw,30px)/1 'FoxComic','Lilita One',sans-serif;color:#7e34f2;letter-spacing:.04em}
.pdRes ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px} .pdRes li{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:12px;background:#f2eefc;font-size:clamp(14px,4vw,18px)}
.pdRes li.me{background:#ffe9a8;box-shadow:0 0 0 3px #ffc23a} .pdRes li b{width:34px;text-align:left;color:#7e34f2} .pdRes li i{width:14px;height:14px;border-radius:4px;flex:none} .pdRes li span{flex:1;text-align:left} .pdRes li em{font-style:normal;color:#6a5aa0}
.pdRes .st{margin-top:10px;font-size:clamp(15px,4.2vw,19px)} .pdRes .st big{display:block;font-size:clamp(28px,8vw,38px);letter-spacing:4px;color:#ffc23a;-webkit-text-stroke:1.5px #2a1e5c;paint-order:stroke fill}
@media (min-aspect-ratio:3/2) and (max-height:560px){.pdRes .card{padding:10px 14px 10px} .pdRes h3{margin-bottom:4px} .pdRes li{padding:3px 10px} .pdRes .st{margin-top:4px}}
@keyframes pdIn{from{opacity:0}to{opacity:1}}
@keyframes tcIn{to{opacity:1;transform:translateX(-50%) scale(1)}}`;
  document.head.appendChild(st); FX = document.createElement('div'); FX.id = 'trickCard'; document.body.appendChild(FX); return FX; }
let CARDN = 0;
export function trickCard(name, streak = 0, kind = 'good', extra = '') { const c = fxRoot(); c.className = '';
  { const h = document.getElementById('hudMain'), r = h && h.getBoundingClientRect(); c.style.setProperty('top', `${Math.max(r && r.height ? 20 : 84, r && r.height ? r.bottom + 12 : 0)}px`, 'important'); }   /* (P3: always below the HUD's title, never over it) */
  c.dataset.gen = String(++CARDN); void c.offsetWidth;
  c.innerHTML = `<b>${name}</b>${streak >= 2 ? `<i>🥁 ${streak} in rhythm</i>` : ''}${extra ? `<i class="x">${extra}</i>` : ''}`;
  c.classList.add('go', kind); const gen = c.dataset.gen; setTimeout(() => { if (c.dataset.gen === gen) c.classList.add('out'); }, 1900); }

// the card right after a question: it waits until the question has closed (the sign and the buttons are gone), then shows for its full time
export function trickCardAfter(...a) { const go = () => (document.body.classList.contains('asking') ? requestAnimationFrame(go) : trickCard(...a)); go(); }
// a question with the rhythm bar: T seconds; returns the answer plus where on the bar it came: 'early' | 'green' | 'late' | 'timeout'
export async function askRhythm(E, opts, T = 6) {
  fxRoot(); let to = null; const bar = document.createElement('div'); bar.className = 'rBar'; bar.style.setProperty('--t', T + 's');
  bar.innerHTML = '<s>FAST</s><s class="g">IN RHYTHM</s><s class="l">LATE</s><u></u>';
  const prev = opts.onQ; opts.tabs = true; opts.onQ = (q) => { signShow(E, opts.who || '', q); document.body.appendChild(bar); if (prev) prev(q); };
  const t0 = performance.now();
  const r = await Promise.race([E.ask(opts), new Promise((res) => { to = setTimeout(() => res({ ok: false, timeout: true, grade: 'bad', secs: T }), T * 1000); })]);
  clearTimeout(to); const secs = r.timeout ? T : (performance.now() - t0) / 1000, u = secs / T;
  const zone = r.timeout ? 'timeout' : u < 0.25 ? 'early' : u <= 0.75 ? 'green' : 'late';
  bar.classList.add('done', zone === 'green' && r.ok ? 'hit-green' : 'hit-bad'); const mk = bar.querySelector('u'); if (mk) { mk.style.animation = 'none'; mk.style.left = `${Math.min(100, u * 100)}%`; }
  setTimeout(() => bar.remove(), r.ok ? 700 : 1400);
  signAnswer(E, r); if (r.timeout) { E.cancelAsk(); E.combo = 0; }
  return Object.assign(r, { secs, zone, u });
}
