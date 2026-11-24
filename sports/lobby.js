// Foxino Sports: the lobby (2026-11-17, the user: "make the menu a big 3D stadium where you stand in front of it, you can add a
// friend like in Fortnite, and after you press play you select activities in a similar design as choosing the map in
// FoxKarts, but this time you can select or unselect, then you press play and that's it").
//  · the stadium is Penalty Star's (its Blender models); Foxino stands on a glowing platform on the pitch in his football kit
//    (the one from Penalty Star's Locker room); drag him to turn him round
//  · ADD FRIEND: a party of two over PeerJS ("fugio-party-<code>"): MAKE A PARTY shows a QR code and a code, the friend
//    scans / types it (/sports/?join=CODE); the friend's Foxino (orange kit) appears on the platform beside you
//  · PLAY → CHOOSE YOUR SPORTS: tap the cards to pick or drop them, PLAY plays them one after another in a frame here
//    (/penalty/?list=1, tennis/?list=1); in a party the one who made it chooses, Tennis is played against each other
//    (tennis/?list=1&friend=host|join&room=…) and in Penalties both play and the points are compared
import * as THREE from '/penalty/lib/three.module.min.js';
import { RoomEnvironment } from '/penalty/lib/RoomEnvironment.js';
import { makeWinterPlaza } from './winter.js?v=5';
import { loadFoxino } from '/penalty/foxino-glb.js?v=3';
import { POSES } from '/penalty/foxino.js';
import { makeBall } from '/penalty/props.js';
import { sfx, unlock } from '/penalty/sound.js';
import { makePost, paintedSky } from './look.js?v=3';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
// (2026-11-24, the user: "I want to remove Sledge, biathlon, Slalom sport activities from this game") they are out for players; their code and
// art stay (snow/slalom.js, sled.js, biathlon.js): take an id out of HIDDEN_ACTS to bring it back
const HIDDEN_ACTS = new Set(['slalom', 'sled', 'biathlon']);
const ACTS = [
  { id: 'penalty', name: 'Penalties', tag: 'FOOTBALL', pic: 'art/card-penalties.webp?v=1' },
  { id: 'tennis', name: 'Tennis', tag: 'TENNIS', pic: 'art/card-tennis.webp?v=1' },
  { id: 'streetball', name: 'Streetball', tag: 'BASKETBALL', pic: 'art/card-streetball.webp?v=1' },
  // (2026-11-21) the five snow sports (snow/index.html?sport=…): solo for the best score, with a friend side by side
  { id: 'slalom', name: 'Slalom', tag: 'SKI', pic: 'art/card-slalom.webp?v=2', snow: true },
  { id: 'halfpipe', name: 'Halfpipe', tag: 'SNOWBOARD', pic: 'art/card-halfpipe.webp?v=2', snow: true },
  { id: 'skijump', name: 'Ski Jump', tag: 'SKI JUMP', pic: 'art/card-skijump.webp?v=2', snow: true },
  { id: 'sled', name: 'Sled Run', tag: 'SLED', pic: 'art/card-sled.webp?v=2', snow: true },
  { id: 'biathlon', name: 'Biathlon', tag: 'SNOWBALLS', pic: 'art/card-biathlon.webp?v=2', snow: true },
].filter((a) => !HIDDEN_ACTS.has(a.id));
const isSnow = (id) => !!(ACTS.find((a) => a.id === id) || {}).snow;
const FRIEND_KIT = { shirt: '#ffffff', trim: '#ff7d22', shorts: '#ff7d22', socks: '#ff7d22' };
let myName = store.get('tennis-name', '') || '';

// ---------- the renderer and the winter plaza in front of the Olympic stadium (v3, 2026-11-17) ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pr); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;   // (ACES: Neutral is far slower in Safari)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200); scene.add(camera);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose(); }
// winter dusk: a blue-violet sky light with a lilac snow bounce, a cool moon-white key from the front, the warm sunset
// glow from behind the stadium as a rim light; warm windows, lamps and the cauldron's flame glow in the post pass
scene.fog = new THREE.Fog(0xe6c8d8, 90, 380);   // (the stadium stays crisp; the far mountains melt into the horizon glow)
const WINTER_SKY = 'art/sky-winter-dusk.webp?v=1';
scene.add(new THREE.HemisphereLight(0x9aa6ff, 0xb3a3dc, 0.75));
const key = new THREE.DirectionalLight(0xe4e9ff, 1.75); key.position.set(9, 22, 30); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 80 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
key.target.position.set(0, 0, 15); scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xffb27a, 2.2); rim.position.set(-6, 9, -40); scene.add(rim);   // the sunset behind the stadium
const POSTFX = makePost(renderer, { aoRange: 70, focusMul: 2.2, blur: 0.22, grade: { sat: 1.1, warm: 0.6 }, glow: 1.0 });
let stadium = null;

// ---------- the platforms (a dark disc, a glowing ring, light rising round the edge) ----------
const SPOT = { me: new THREE.Vector3(0, 0, 15.6), fr: new THREE.Vector3(2.15, 0, 14.7) };
function makePlatform(col) {
  const g = new THREE.Group(), c = new THREE.Color(col);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, 0.28, 40), new THREE.MeshStandardMaterial({ color: 0x241a5c, roughness: 0.35, metalness: 0.3 })); base.position.y = 0.14; base.receiveShadow = true; base.castShadow = true; g.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 40), new THREE.MeshStandardMaterial({ color: 0x3a2a8c, roughness: 0.25, metalness: 0.4 })); top.position.y = 0.29; top.receiveShadow = true; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.29; g.add(ring);
  const glowM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uC: { value: c }, uT: { value: 0 }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uC; uniform float uT, uA; void main(){ float a = (1.0 - vUv.y) * (0.35 + 0.15 * sin(vUv.x * 40.0 + uT * 2.0)) * uA; gl_FragColor = vec4(uC * a, a); }' });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.9, 48, 1, true), glowM); glow.position.y = 0.74; g.add(glow);
  g.userData = { ring, glowM };
  return g;
}
const platMe = makePlatform(0xffd84a), platFr = makePlatform(0x6fe2ff);
// (winter v2) the PC's winter podium replaces the code disc: a clone in each platform; its PodiumRing takes the player's colour
function dressPlatform(g, podium, col) {
  const c = podium.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); g.add(c);
  g.children.forEach((o) => { if (o !== c && o.userData.glowM !== true && !o.material?.uniforms) o.visible = false; });   // (the code base, top and ring go; the light glow stays)
  let ring = null; c.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; if (/PodiumRing/.test(o.name) || /PodiumGlow/.test(o.material?.name || '')) ring = o; });
  if (ring) { ring.material = new THREE.MeshBasicMaterial({ color: col, toneMapped: false }); g.userData.ring = ring; }
  g.userData.glowM.uniforms.uA.value = .5;
}
platMe.position.copy(SPOT.me); platFr.position.copy(SPOT.fr); scene.add(platMe, platFr);
let ball = null;

// ---------- the Foxinos ----------
const ME = { fox: null, yaw: 0.25, vel: 0, drag: null, waveT: 4, cheerT: -9 }, FRD = { fox: null, waveT: 0, on: false };
async function addFox(kit) {
  const f = await loadFoxino();
  f.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(f.root);
  if (kit && Object.keys(kit).length) f.setKit(kit);
  return f;
}
const myKit = () => store.get('penalty-kit', {}) || {};
function poseFox(F, t, dt, mood) {
  if (!F.fox) return;
  let p;
  if (mood === 'cheer') p = POSES.celebrate(t);
  else if (mood === 'wave') p = POSES.wave(t);
  else p = POSES.stand(t);
  F.fox.apply(p, 9, dt);
}
// turn yourself round by dragging (like the Locker room)
{
  const c = $('gl');
  c.addEventListener('pointerdown', (e) => { ME.drag = { x: e.clientX, yaw: ME.yaw, t: performance.now() }; c.setPointerCapture(e.pointerId); unlock(); });
  c.addEventListener('pointermove', (e) => { if (!ME.drag) return; const nx = ME.drag.yaw + (e.clientX - ME.drag.x) * 0.012; ME.vel = (nx - ME.yaw) * 30; ME.yaw = nx; });
  const up = () => { ME.drag = null; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
}

// ---------- the camera: like a game lobby, a little to the side, the stadium soft behind ----------
const CAM = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
function fitCamera() {
  const a = camera.aspect;
  // (v3) a low camera in front of the two platforms, looking a little up: the stadium fills the top of the picture
  if (a < 0.8) { camera.fov = 58; CAM.pos.set(0.78, 1.55, 23.4); CAM.look.set(0.6, 4.2, -6); SPOT.fr.set(1.6, 0, 13.9); }
  else if (a < 1.3) { camera.fov = 46; CAM.pos.set(1.05, 1.5, 22.2); CAM.look.set(0.8, 3.6, -6); SPOT.fr.set(2.0, 0, 14.4); }
  else { camera.fov = 40; CAM.pos.set(1.1, 1.5, 21.8); CAM.look.set(0.7, 3.4, -6); SPOT.fr.set(2.25, 0, 14.7); }
  platFr.position.copy(SPOT.fr); if (FRD.fox) FRD.fox.root.position.set(SPOT.fr.x, 0.31, SPOT.fr.z);
  camera.updateProjectionMatrix();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; fitCamera(); }
addEventListener('resize', resize);

// ---------- the labels over the platforms ----------
const _v = new THREE.Vector3();
function place(el, x, y, z, ax = '-50%', ay = '-100%') {
  _v.set(x, y, z).project(camera); if (_v.z > 1) { el.style.visibility = 'hidden'; return; } el.style.visibility = '';
  el.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(${ax}, ${ay})`;
}
function updateTags() {
  place($('meTag'), SPOT.me.x, 1.95, SPOT.me.z);
  if (FRD.on) place($('frTag'), SPOT.fr.x, 1.95, SPOT.fr.z);
  else place($('slot'), SPOT.fr.x, 1.05, SPOT.fr.z, '-50%', '-50%');
  $('meName').textContent = (myName || 'YOU').toUpperCase();
}

// ---------- the loop ----------
let last = performance.now(), T = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  if ($('game').hidden) {
    // me: idle, a wave now and then, cheering when the friend arrives
    ME.waveT -= dt; if (ME.waveT < -1.6) ME.waveT = 6 + Math.random() * 5;
    if (!ME.drag) { ME.yaw += ME.vel * dt; ME.vel *= Math.exp(-3 * dt); if (Math.abs(ME.vel) < 0.3) ME.yaw = damp(ME.yaw, 0.25, 1.2, dt); }
    if (ME.fox) { ME.fox.root.position.set(SPOT.me.x, 0.31, SPOT.me.z); ME.fox.root.rotation.y = ME.yaw; ME.cheerT += dt;
      poseFox(ME, T, dt, ME.cheerT < 1.8 ? 'cheer' : ME.waveT < 0 ? 'wave' : ''); }
    if (FRD.fox) { FRD.fox.root.visible = FRD.on; FRD.waveT += dt; FRD.fox.root.rotation.y = -0.25; poseFox(FRD, T + 1.3, dt, FRD.waveT < 2.2 ? 'wave' : ''); }
    for (const p of [platMe, platFr]) { p.userData.glowM.uniforms.uT.value = T; }
    platFr.userData.glowM.uniforms.uC.value.set(FRD.on ? 0xff9a3c : 0x6fe2ff);
    platFr.userData.ring.material.color.set(FRD.on ? 0xff9a3c : 0x6fe2ff);
    if (stadium) stadium.update(dt, T, camera, pr);
    const sw = Math.sin(T * 0.35) * 0.12;
    camera.position.set(CAM.pos.x + sw, CAM.pos.y + Math.sin(T * 0.5) * 0.03, CAM.pos.z); camera.lookAt(CAM.look);
    POSTFX.draw(scene, camera, camera.position.distanceTo(SPOT.me));
    updateTags();
    if (POSTFX.governor(dt) && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); }
  }
}

// ---------- toasts ----------
function toast(html, ms = 2400) { const d = document.createElement('div'); d.innerHTML = html; $('toast').appendChild(d); setTimeout(() => d.remove(), ms); }

// ---------- the party (two phones) ----------
const PT = { peer: null, conn: null, host: false, code: '', friend: null, libs: null, round: 0 };
const loadJs = (src) => new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
const libs = () => PT.libs || (PT.libs = Promise.all([window.Peer ? 0 : loadJs('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'), window.qrcode ? 0 : loadJs('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js')]).catch((e) => { PT.libs = null; throw e; }));
const inParty = () => !!(PT.conn && PT.conn.open && PT.friend);
const leader = () => !inParty() || PT.host;
function pErr(t) { $('pErr').textContent = t || ''; }
function readName() { const n = $('pName').value.trim().replace(/\s+/g, ' ').slice(0, 12); if (n) { myName = n; store.set('tennis-name', n); } return n; }
function openParty(code) {
  unlock(); sfx.click && sfx.click();
  $('party').hidden = false; $('pName').value = myName; pErr('');
  if (PT.host && PT.peer && !PT.friend) { $('pHome').hidden = true; $('pHost').hidden = false; } else { $('pHome').hidden = false; $('pHost').hidden = true; }
  if (code) { $('pCode').value = code.replace(/(\d{3})(\d{3})/, '$1 $2'); if (myName) joinParty(); else $('pName').focus(); }
}
function closePeer() { try { PT.conn && PT.conn.close(); } catch (e) {} try { PT.peer && PT.peer.destroy(); } catch (e) {} PT.conn = null; PT.peer = null; }
async function makeParty() {
  if (!readName()) { pErr('Type your name first.'); $('pName').focus(); return; }
  pErr(''); try { await libs(); } catch (e) { pErr('No internet connection.'); return; }
  closePeer(); PT.host = true; PT.friend = null;
  const go = () => {
    PT.code = String(Math.floor(100000 + Math.random() * 900000));
    const peer = new Peer('fugio-party-' + PT.code); PT.peer = peer;
    peer.on('open', () => {
      $('pHome').hidden = true; $('pHost').hidden = false; $('pCodeBig').textContent = PT.code.replace(/(\d{3})(\d{3})/, '$1 $2');
      const qr = qrcode(0, 'M'); qr.addData(`${location.origin}/sports/?join=${PT.code}`); qr.make(); $('pQr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      $('partyCode').hidden = false; $('partyCode').textContent = `PARTY ${PT.code.replace(/(\d{3})(\d{3})/, '$1 $2')}`;
    });
    peer.on('connection', (conn) => {
      if (PT.conn && PT.conn.open) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      PT.conn = conn; wire(conn);
    });
    peer.on('disconnected', () => { if (PT.peer === peer && !peer.destroyed) peer.reconnect(); });
    peer.on('error', (e) => { if (PT.peer !== peer) return; if (e.type === 'unavailable-id') { peer.destroy(); go(); } else pErr('Connection problem. Try again.'); });
  };
  go();
}
async function joinParty() {
  if (!readName()) { pErr('Type your name first.'); $('pName').focus(); return; }
  const code = $('pCode').value.replace(/\D/g, ''); if (code.length !== 6) { pErr("Type your friend's 6-number code."); return; }
  pErr('Joining…'); try { await libs(); } catch (e) { pErr('No internet connection.'); return; }
  closePeer(); PT.host = false; PT.code = code; PT.friend = null;
  const peer = new Peer(); PT.peer = peer;
  peer.on('error', (e) => { if (PT.peer !== peer) return; pErr(e.type === 'peer-unavailable' ? "No party with this code. Check the code on your friend's phone." : 'Connection problem. Try again.'); });
  peer.on('open', () => { const conn = peer.connect('fugio-party-' + code, { reliable: true }); PT.conn = conn; wire(conn); conn.on('open', () => conn.send({ t: 'hello', name: myName, kit: myKit() })); });
}
function wire(conn) {
  conn.on('data', (m) => { if (m && typeof m === 'object') onParty(m); });
  conn.on('close', () => { if (PT.conn !== conn) return; const nm = PT.friend && PT.friend.name; PT.conn = null; friendGone(nm ? `${esc(nm)} left the party` : ''); });
}
const send = (m) => { try { if (PT.conn && PT.conn.open) PT.conn.send(m); } catch (e) {} };
async function friendArrived(f) {
  PT.friend = f; $('party').hidden = true; FRD.on = true; FRD.waveT = 0; ME.cheerT = 0; vib([30, 40, 60]); sfx.whistle && sfx.whistle();
  $('frTag').hidden = false; $('slot').hidden = true; $('frName').textContent = f.name.toUpperCase();
  if (!PT.host) { $('partyCode').hidden = false; $('partyCode').textContent = `PARTY ${PT.code.replace(/(\d{3})(\d{3})/, '$1 $2')}`; }
  toast(`🎉 ${esc(f.name)} joined the party!`);
  if (!FRD.fox) FRD.fox = await addFox(f.kit && Object.keys(f.kit).length ? f.kit : FRIEND_KIT); else FRD.fox.setKit(f.kit && Object.keys(f.kit).length ? f.kit : FRIEND_KIT);
  FRD.fox.root.position.set(SPOT.fr.x, 0.31, SPOT.fr.z);
  renderMode();
}
function friendGone(msg) {
  PT.friend = null; FRD.on = false; $('frTag').hidden = true; $('slot').hidden = false; $('partyCode').hidden = !(PT.host && PT.peer);
  if (msg) toast(msg);
  if (!$('picker').hidden && $('acts').classList.contains('view')) closePicker();
  if (!$('game').hidden && RUN && RUN.list[RUN.i] === 'penalty') { /* (the sport goes on alone) */ }
  if (!PT.host) { closePeer(); $('partyCode').hidden = true; }
  renderMode();
}
function onParty(m) {
  if (m.t === 'full') { pErr('That party already has two players.'); return; }
  if (m.t === 'hello' && PT.host) { const f = { name: String(m.name || 'Friend').slice(0, 12), kit: m.kit || {} }; send({ t: 'welcome', name: myName, kit: myKit() }); friendArrived(f); return; }
  if (m.t === 'welcome' && !PT.host) { friendArrived({ name: String(m.name || 'Friend').slice(0, 12), kit: m.kit || {} }); return; }
  if (m.t === 'bye') { const nm = PT.friend && PT.friend.name; friendGone(nm ? `${esc(nm)} left the party` : ''); return; }
  if (m.t === 'pick' && !PT.host) { if (m.open) openPicker(m.sel, true); else closePicker(); return; }
  if (m.t === 'start' && !PT.host) { closePicker(); runList(m.list, m.round); return; }
  if (m.t === 'score') { if (RUN) { RUN.their[m.i] = m.r; if (RUN.waitTheirs === m.i) showResult(m.i); } return; }
  if (m.t === 'snow') { if (RUN && RUN.i === m.i) { try { $('frame').contentWindow.postMessage({ snowFriend: m.st, sport: m.sport, name: PT.friend ? PT.friend.name : '' }, '*'); } catch (e) {} } return; }
  if (m.t === 'next' && !PT.host) { if (RUN && RUN.i === m.i) nextSport(); return; }
  if (m.t === 'abort') { if (RUN) { stopList(); toast(`${esc(PT.friend ? PT.friend.name : 'Your friend')} left the game`); } return; }
}
$('slot').onclick = () => openParty();
$('pCreate').onclick = makeParty;
$('pJoin').onclick = joinParty;
$('pClose').onclick = () => { sfx.click && sfx.click(); $('party').hidden = true; };
$('pCode').addEventListener('input', (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; });
$('frLeave').onclick = () => { sfx.click && sfx.click(); send({ t: 'bye' }); const h = PT.host; friendGone('You left the party'); if (h) { closePeer(); PT.host = false; $('partyCode').hidden = true; } };
$('meTag').onclick = () => { openParty(); setTimeout(() => $('pName').focus(), 50); };
function renderMode() {
  const b = $('playBtn');
  if (inParty()) {
    $('modeLine').textContent = `PARTY · you and ${PT.friend.name}`;
    if (PT.host) { b.classList.remove('waiting'); b.firstChild.textContent = 'PLAY'; b.disabled = false; }
    else { b.classList.add('waiting'); b.firstChild.textContent = `${PT.friend.name.toUpperCase()} CHOOSES…`; b.disabled = true; }
  } else { $('modeLine').textContent = 'SOLO · against Rob'; b.classList.remove('waiting'); b.firstChild.textContent = 'PLAY'; b.disabled = false; }
}

// ---------- choose the sports ----------
let SEL = (store.get('sports-sel', null) || ['halfpipe', 'skijump']).filter((id) => ACTS.some((a) => a.id === id));
if (!SEL.length) SEL = ACTS.map((a) => a.id);
function renderPicker(view) {
  $('acts').classList.toggle('view', !!view);
  $('acts').innerHTML = ACTS.map((a) => { const i = SEL.indexOf(a.id); return `<button class="act${i >= 0 ? ' on' : ''}" type="button" data-id="${a.id}"><span class="pic" style="background-image:url('${a.pic}')"></span><span class="tag">${a.tag}</span>${a.snow ? '<span class="new">NEW</span>' : ''}${i >= 0 && SEL.length > 1 ? `<span class="num">${ordinal(i)}</span>` : ''}<span class="tick">✓</span><span class="nm">${a.name}</span></button>`; }).join('');
  $('pickPlay').disabled = !SEL.length;
  $('pickPlay').hidden = !!view; $('pickBack').hidden = !!view;
  $('pickSub').textContent = view ? `${PT.friend ? PT.friend.name : 'Your friend'} is choosing the sports…` : SEL.length ? 'Tap to pick · tap again to drop · they are played one after another' : 'Pick at least one sport';
}
const ordinal = (i) => ['1ST', '2ND', '3RD'][i] || `${i + 1}TH`;
function openPicker(sel, view) { if (sel) SEL = sel.filter((id) => ACTS.some((x) => x.id === id)); renderPicker(view); $('picker').hidden = false; }
function closePicker() { $('picker').hidden = true; }
$('playBtn').onclick = () => { unlock(); if (!leader()) return; sfx.click && sfx.click(); vib(20); openPicker(null, false); send({ t: 'pick', open: true, sel: SEL }); };
$('acts').addEventListener('click', (e) => {
  const b = e.target.closest('.act'); if (!b || $('acts').classList.contains('view')) return;
  const id = b.dataset.id, i = SEL.indexOf(id);
  if (i >= 0) SEL.splice(i, 1); else { SEL.push(id); SEL.sort((x, y) => ACTS.findIndex((a) => a.id === x) - ACTS.findIndex((a) => a.id === y)); }
  store.set('sports-sel', SEL); sfx.pick && sfx.pick(); vib(15); renderPicker(false); send({ t: 'pick', open: true, sel: SEL });
});
$('pickBack').onclick = () => { sfx.click && sfx.click(); closePicker(); send({ t: 'pick', open: false }); };
$('pickPlay').onclick = () => {
  if (!SEL.length) return; unlock(); sfx.whistle && sfx.whistle(); vib([20, 30, 40]);
  closePicker(); PT.round++;
  const list = SEL.slice(); if (inParty()) send({ t: 'start', list, round: PT.round });
  runList(list, PT.round);
};

// ---------- playing the chosen sports one after another ----------
let RUN = null;
function runList(list, round) {
  RUN = { list, round, i: -1, mine: [], their: [], waitTheirs: -1 };
  $('game').hidden = false; nextSport();
}
function srcFor(id, i) {
  if (id === 'penalty') return '/penalty/?list=1';
  if (id === 'tennis') {
    if (inParty()) return `tennis/?list=1&friend=${PT.host ? 'host' : 'join'}&room=${PT.code}r${RUN.round}s${i}&name=${encodeURIComponent(myName || 'Player')}`;
    return 'tennis/?list=1';
  }
  if (id === 'streetball') return 'streetball/?list=1';
  if (isSnow(id)) return `snow/index.html?sport=${id}&list=1${inParty() ? `&party=1&fname=${encodeURIComponent(PT.friend.name)}` : ''}`;
  return 'about:blank';
}
function nextSport() {
  if (!RUN) return;
  RUN.i++; $('result').hidden = true;
  if (RUN.i >= RUN.list.length) { stopList(); return; }
  const id = RUN.list[RUN.i];
  $('game').hidden = false; $('frame').src = srcFor(id, RUN.i);
}
function stopList() { RUN = null; $('frame').src = 'about:blank'; $('game').hidden = true; $('result').hidden = true; renderMode(); }
addEventListener('message', (e) => {
  const m = e.data; if (!m || typeof m !== 'object' || !RUN || e.source !== $('frame').contentWindow) return;
  if (m.fugio === 'leave') { send({ t: 'abort' }); stopList(); return; }
  const i = RUN.i, id = RUN.list[i];
  if (m.fs === 'finished' && id === 'penalty') { const r = { goals: m.goals, of: m.of || 10, stars: m.stars }; RUN.mine[i] = r; if (inParty()) send({ t: 'score', i, r }); setTimeout(() => showResult(i), 2600); }
  if (m.fb === 'finished' && id === 'streetball') { const r = { goals: m.score[0], vs: m.score[1], won: !!m.won }; RUN.mine[i] = r; if (inParty()) send({ t: 'score', i, r }); setTimeout(() => showResult(i), 2600); }
  // the snow sports: the result, and the live state for the friend (relayed over the party link)
  if (m.snow === 'state' && isSnow(id) && m.sport === id) { if (inParty()) send({ t: 'snow', i, sport: m.sport, st: m.st }); return; }
  if (m.fsnow === 'finished' && isSnow(id)) { const r = { score: m.score, shown: m.shown, unit: m.unit, better: m.better, medal: m.medal, right: m.right, asked: m.asked }; RUN.mine[i] = r; if (inParty()) send({ t: 'score', i, r }); setTimeout(() => showResult(i), 2400); }
  if (m.ft === 'finished' && id === 'tennis') { const r = { won: !!m.won, games: m.games, friend: !!m.friend }; RUN.mine[i] = r; setTimeout(() => showResult(i), 2600); }
});
function showResult(i) {
  if (!RUN || RUN.i !== i) return;
  const id = RUN.list[i], r = RUN.mine[i] || {}, last = i >= RUN.list.length - 1, fname = PT.friend ? PT.friend.name : 'Friend';
  let body = '';
  if (id === 'penalty') {
    const th = RUN.their[i];
    if (inParty() && !th) { RUN.waitTheirs = i; body = `<p class="kick">PENALTIES</p><h2>${r.goals} / ${r.of}</h2><p class="line">Waiting for ${esc(fname)} to finish…</p>`; }
    else if (th) { const win = r.goals > th.goals, draw = r.goals === th.goals;
      body = `<p class="kick">PENALTIES</p><h2>${draw ? "It's a draw!" : win ? 'You win!' : `${esc(fname)} wins!`}</h2><div class="vs"><div class="who${win ? ' win' : ''}"><b>${r.goals}</b><span>YOU</span></div><b>–</b><div class="who${!win && !draw ? ' win' : ''}"><b>${th.goals}</b><span>${esc(fname.toUpperCase())}</span></div></div>`; }
    else body = `<p class="kick">PENALTIES</p><h2>${r.goals} / ${r.of} points</h2><p class="line">${'⭐'.repeat(r.stars || 1)}</p>`;
  } else if (id === 'streetball') {
    const th = RUN.their[i];
    if (inParty() && !th) { RUN.waitTheirs = i; body = `<p class="kick">STREETBALL</p><h2>${r.goals} – ${r.vs}</h2><p class="line">Waiting for ${esc(fname)} to finish…</p>`; }
    else if (th) { const md = r.goals - r.vs, td = th.goals - th.vs, win = md > td, draw = md === td;
      body = `<p class="kick">STREETBALL · against Rob</p><h2>${draw ? "It's a draw!" : win ? 'You win!' : `${esc(fname)} wins!`}</h2><div class="vs"><div class="who${win ? ' win' : ''}"><b>${r.goals}–${r.vs}</b><span>YOU</span></div><b>·</b><div class="who${!win && !draw ? ' win' : ''}"><b>${th.goals}–${th.vs}</b><span>${esc(fname.toUpperCase())}</span></div></div>`; }
    else body = `<p class="kick">STREETBALL</p><h2>${r.won ? 'You beat Rob!' : 'Rob won this time'}</h2><div class="vs"><div class="who${r.won ? ' win' : ''}"><b>${r.goals}</b><span>YOU</span></div><b>–</b><div class="who${!r.won ? ' win' : ''}"><b>${r.vs}</b><span>ROB</span></div></div><p class="line">baskets</p>`;
  } else if (isSnow(id)) {
    const A = ACTS.find((a) => a.id === id), th = RUN.their[i], MED = ['', '🥉 ', '🥈 ', '🥇 '];
    if (inParty() && !th) { RUN.waitTheirs = i; body = `<p class="kick">${esc(A.name.toUpperCase())}</p><h2>${esc(r.shown)} <small>${esc(r.unit)}</small></h2><p class="line">Waiting for ${esc(fname)} to finish…</p>`; }
    else if (th) { const better = r.better === 'low' ? r.score < th.score : r.score > th.score, draw = r.score === th.score;
      body = `<p class="kick">${esc(A.name.toUpperCase())}</p><h2>${draw ? "It's a draw!" : better ? 'You win!' : `${esc(fname)} wins!`}</h2><div class="vs"><div class="who${better ? ' win' : ''}"><b>${esc(r.shown)}</b><span>YOU</span></div><b>·</b><div class="who${!better && !draw ? ' win' : ''}"><b>${esc(th.shown)}</b><span>${esc(fname.toUpperCase())}</span></div></div><p class="line">${esc(r.unit)}</p>`; }
    else body = `<p class="kick">${esc(A.name.toUpperCase())}</p><h2>${MED[r.medal || 0]}${esc(r.shown)} <small>${esc(r.unit)}</small></h2><p class="line">${r.right ?? 0} of ${r.asked ?? 0} right</p>`;
  } else {
    const g = r.games || [0, 0];
    body = `<p class="kick">TENNIS</p><h2>${r.won ? (r.friend ? 'You win!' : 'You beat Rob!') : r.friend ? `${esc(fname)} wins!` : 'Rob won this time'}</h2><div class="vs"><div class="who${r.won ? ' win' : ''}"><b>${g[0]}</b><span>YOU</span></div><b>–</b><div class="who${!r.won ? ' win' : ''}"><b>${g[1]}</b><span>${esc((r.friend ? fname : 'ROB').toUpperCase())}</span></div></div><p class="line">games</p>`;
  }
  if (RUN.waitTheirs === i && !(inParty() && !RUN.their[i])) RUN.waitTheirs = -1;
  let btns;
  if (last) {
    const sum = RUN.list.map((sid, k) => { const x = RUN.mine[k] || {}; return `<li><span>${ACTS.find((a) => a.id === sid).name}</span><em>${sid === 'penalty' ? `${x.goals ?? '–'} points` : sid === 'streetball' ? `${x.goals ?? '–'}–${x.vs ?? '–'}` : isSnow(sid) ? `${x.shown ?? '–'} ${x.unit || ''}` : x.won ? 'WON' : 'lost'}</em></li>`; }).join('');
    btns = `${RUN.list.length > 1 ? `<ul class="list">${sum}</ul>` : ''}<div class="btns"><button class="big" type="button" id="rDone">BACK TO THE STADIUM</button></div>`;
  } else if (!inParty() || PT.host) btns = `<div class="btns"><button class="big" type="button" id="rNext">NEXT: ${ACTS.find((a) => a.id === RUN.list[i + 1]).name.toUpperCase()} ›</button></div>`;
  else btns = `<p class="line">Waiting for ${esc(fname)}…</p>`;
  $('rcard').innerHTML = body + btns; $('result').hidden = false;
  if ((id === 'penalty' && (r.stars || 0) >= 2) || r.won || (r.medal || 0) >= 2) { sfx.cheer && sfx.cheer(); vib([30, 40, 60]); }
  const n = $('rNext'); if (n) n.onclick = () => { sfx.click && sfx.click(); send({ t: 'next', i: RUN.i }); nextSport(); };
  const d = $('rDone'); if (d) d.onclick = () => { sfx.click && sfx.click(); stopList(); ME.cheerT = 0; };
}

// ---------- leave ----------
$('leaveBtn').onclick = () => { sfx.click && sfx.click(); send({ t: 'bye' }); closePeer(); if (window.parent !== window) window.parent.postMessage({ fugio: 'leave' }, '*'); else location.href = '/'; };

// ---------- start ----------
(async () => {
  resize();
  const bar = (p, t) => { $('loadBar').style.width = `${p}%`; if (t) $('loadTxt').textContent = t; };
  bar(20, 'Opening the stadium…');
  paintedSky(scene, WINTER_SKY, { yaw: 0.5, envRenderer: renderer, base: 0.34, span: 1.05 });   // (v2: higher up the picture: the aurora shows) scene.environmentIntensity = 0.3;
  try { stadium = await makeWinterPlaza(scene); if (stadium.podium) { dressPlatform(platMe, stadium.podium, 0xffd84a); dressPlatform(platFr, stadium.podium, 0x6fe2ff); } } catch (e) { console.warn('winter plaza', e); }
  bar(65, 'Foxino is on his way…');
  try { ME.fox = await addFox(myKit()); } catch (e) { console.warn('foxino', e); }
  ball = makeBall(); ball.castShadow = true; ball.position.set(SPOT.me.x - 0.55, 0.31 + 0.11, SPOT.me.z + 0.35); scene.add(ball);
  bar(100, 'Ready!');
  requestAnimationFrame(frame);
  setTimeout(() => $('loading').classList.add('gone'), 200);
  renderMode();
  const jc = (new URLSearchParams(location.search).get('join') || '').replace(/\D/g, '');
  if (jc.length === 6) openParty(jc);
  window.LOBBY = { PT, ME, FRD, get RUN() { return RUN; }, SEL, renderer, POSTFX, scene, camera, get stadium() { return stadium; } };
})();
