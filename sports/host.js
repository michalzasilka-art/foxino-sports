// Foxino Sports: the teacher's big screen. (2026-11-17, the user: "Foxino Sports on the Teachers platform: student or teacher;
// the students join by code; the teacher presses play; penalties (random pairs, a goalkeeper and a shooter, two games side by
// side when there are enough players), ... tennis 1v1"). (2026-11-17, the user: "delete that adventures game, only keep tennis and penalties": the River Raft team race is gone.)
// The phones talk to this page over PeerJS (WebRTC; the free PeerJS server only introduces the devices), like Gummy's phone mode:
// this page is the hub at peer id "fugio-sports-<code>". The 3D matches run in iframes (Penalty Star ?remote=1, tennis/)
// that this page drives with postMessage.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // the players' pictures (the same list on the phones)
  const AV = [
    { c: '#ff5d8f', e: '🦊' }, { c: '#ffb703', e: '⚽' }, { c: '#3ab0ff', e: '🐬' }, { c: '#2fbf6a', e: '🐸' }, { c: '#8f52d9', e: '🦄' },
    { c: '#ff7d22', e: '🐯' }, { c: '#00b8ad', e: '🐢' }, { c: '#e8403a', e: '🦀' }, { c: '#5a6bff', e: '🚀' }, { c: '#b88a00', e: '🦁' },
    { c: '#7a5230', e: '🐻' }, { c: '#ff4fd8', e: '🐙' },
  ];
  const GAMES = { penalty: 'Penalties', tennis: 'Tennis' };
  const SET = Object.assign({ game: 'penalty', teams: 2, kicks: 3, games: 2, secs: 15, packs: [] }, store.get('sports-set', {}));
  const PACKS = FSQ.packs();
  if (!GAMES[SET.game]) SET.game = 'penalty';
  SET.packs = (SET.packs || []).filter((id) => PACKS.some((p) => p.id === id));
  if (!SET.packs.length && PACKS.length) SET.packs = [(PACKS.find((p) => p.level === 'A1') || PACKS[0]).id];
  const save = () => store.set('sports-set', SET);

  // ---------- screens ----------
  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id)); }
  { const im = new Image(); im.onload = () => $('bg').classList.add('art'); im.src = 'art/lobby-bg.webp?v=1'; }
  $('pickTeacher').onclick = () => { show('lobby'); netOpen(); renderLobby(); };
  $('lobbyBack').onclick = () => { netClose(); show('role'); };
  if (/[?&]host=1/.test(location.search)) { show('lobby'); netOpen(); }

  // ---------- the network (PeerJS), as in Gummy the Fisherman's phone mode ----------
  const PREFIX = 'fugio-sports-', MAX = 60;
  const NET = { peer: null, code: '', status: 'off', libs: null };
  const PL = [];   // players: {id, name, av, conn, pts, right, asked, wins, pend, team}
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const libs = () => NET.libs || (NET.libs = Promise.all([
    window.Peer ? 0 : load('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'),
    window.qrcode ? 0 : load('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'),
  ]));
  async function netOpen() {
    if (NET.peer && !NET.peer.destroyed) return;
    NET.status = 'connecting'; renderJoin();
    try { await libs(); } catch (e) { NET.status = 'error'; NET.libs = null; renderJoin(); return; }
    NET.code = String(Math.floor(100000 + Math.random() * 900000));
    const peer = new Peer(PREFIX + NET.code); NET.peer = peer;
    peer.on('open', () => { if (NET.peer === peer) { NET.status = 'ready'; renderJoin(); } });
    peer.on('connection', onConn);
    peer.on('disconnected', () => { if (NET.peer === peer && !peer.destroyed) peer.reconnect(); });
    peer.on('error', (err) => {
      if (NET.peer !== peer) return;
      if (err.type === 'unavailable-id') { peer.destroy(); NET.peer = null; netOpen(); return; }
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) { NET.status = 'error'; renderJoin(); }
    });
  }
  function netClose() {
    PL.forEach((p) => send(p, { t: 'bye' }));
    if (NET.peer) NET.peer.destroy();
    NET.peer = null; NET.status = 'off'; PL.length = 0;
  }
  function send(p, m) { try { if (p && p.conn && p.conn.open) p.conn.send(m); } catch (e) {} }
  const taken = (name, id) => PL.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase());
  function onConn(conn) {
    conn.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hello') { conn.send({ t: 'hello', ok: true, game: GAME ? GAME.key : '' }); return; }
      if (m.t === 'join') {
        const id = String(m.token || '').slice(0, 40), name = String(m.name || '').trim().replace(/\s+/g, ' ').slice(0, 14);
        const av = Math.max(0, Math.min(AV.length - 1, +m.av | 0));
        let p = PL.find((x) => x.id === id), fresh = false;
        if (!p) {
          if (!name) return conn.send({ t: 'err', msg: 'Type your name.', field: 'name' });
          if (taken(name, id)) return conn.send({ t: 'err', msg: `"${name}" is already playing. Add a letter to your name.`, field: 'name' });
          if (PL.length >= MAX) return conn.send({ t: 'err', msg: 'The class is full.' });
          p = { id, name, av, pts: 0, right: 0, asked: 0, wins: 0, pend: null, team: -1 }; PL.push(p); fresh = true;
        } else if (!GAME) { if (name && !taken(name, id)) p.name = name; p.av = av; }
        if (p.conn && p.conn !== conn) { try { p.conn.close(); } catch (e) {} }
        p.conn = conn; conn.pl = p;
        conn.send({ t: 'joined', name: p.name, av: p.av });
        if (GAME) { GAME.join(p, fresh); } else send(p, { t: 'wait', title: "You're in!", msg: 'Look at the big screen. The game starts soon.', kind: 'lobby' });
        if (p.pend) resendQ(p);
        renderLobby(); ticker();
        return;
      }
      const p = conn.pl; if (!p) return;
      if (m.t === 'ans') answer(p, m);
      if (m.t === 'leave') { removePlayer(p); }
    });
    conn.on('close', () => { const p = conn.pl; if (p && p.conn === conn) { p.conn = null; renderLobby(); ticker(); } });
  }
  function removePlayer(p) {
    const i = PL.indexOf(p); if (i < 0) return;
    if (p.pend) { const cb = p.pend.cb; clearTimeout(p.pend.timer); p.pend = null; cb(-1, Infinity); }
    PL.splice(i, 1); send(p, { t: 'bye' });
    if (GAME) GAME.leave(p);
    renderLobby(); ticker();
  }

  // ---------- questions on the phones ----------
  // ask(): the question goes to one phone; cb(i, ms) runs once: with the tapped word, or (-1, Infinity) when the time is up
  let QID = 0;
  function ask(p, o, cb) {
    if (p.pend) { const old = p.pend; clearTimeout(old.timer); p.pend = null; old.cb(-1, Infinity); }
    const id = ++QID, secs = o.secs || SET.secs;
    const msg = { t: 'q', id, role: o.role, title: o.title, sub: o.sub || '', accent: o.accent || '', before: o.q.before, after: o.q.after, opts: o.q.words.map((w) => w.text), secs, colors: o.colors || null };
    p.pend = { id, cb, msg, t0: performance.now(), timer: setTimeout(() => { if (p.pend && p.pend.id === id) { p.pend = null; cb(-1, Infinity); } }, secs * 1000 + 600) };
    send(p, msg);
    return id;
  }
  function resendQ(p) { const m = Object.assign({}, p.pend.msg); m.secs = Math.max(1, m.secs - (performance.now() - p.pend.t0) / 1000); send(p, m); }
  function answer(p, m) {
    const P = p.pend; if (!P || m.id !== P.id) return;
    const i = +m.i; if (!(i >= 0 && i < P.msg.opts.length)) return;
    clearTimeout(P.timer); p.pend = null;
    const ms = Math.max(0, Math.min(+m.ms || (performance.now() - P.t0), P.msg.secs * 1000));
    P.cb(i, ms);
  }
  const reply = (p, o) => send(p, Object.assign({ t: 'res' }, o));
  const watch = (p, title, msg, o = {}) => send(p, Object.assign({ t: 'wait', title, msg }, o));
  const present = () => PL.filter((p) => p.conn);

  // ---------- the lobby ----------
  function renderJoin() {
    $('code').textContent = NET.code ? NET.code.replace(/(\d{3})(\d{3})/, '$1 $2') : '··· ···';
    $('barCode').textContent = NET.code;
    const st = $('netStatus');
    st.className = 'status' + (NET.status === 'error' ? ' err' : '');
    st.textContent = NET.status === 'ready' ? 'Open the address on your phone and type the code.' : NET.status === 'error' ? 'No connection. Check the internet and reload the page.' : 'Connecting…';
    const host = location.host.replace(/^www\./, '');
    $('joinUrl').textContent = host + '/sports/play';
    if (NET.status === 'ready' && window.qrcode) {
      const qr = qrcode(0, 'M'); qr.addData(`${location.origin}/sports/play/?c=${NET.code}`); qr.make();
      $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } else $('qr').innerHTML = '';
  }
  const chip = (p, x = true) => `<span class="chip${p.conn ? '' : ' off'}" style="--c:${AV[p.av].c}"><i>${AV[p.av].e}</i>${esc(p.name)}${x ? `<button type="button" data-kick="${esc(p.id)}" title="Remove">✕</button>` : ''}</span>`;
  function renderLobby() {
    $('pCount').textContent = PL.length ? `· ${PL.length}` : '';
    $('plist').innerHTML = PL.length ? PL.map((p) => chip(p)).join('') : '<p class="empty">Waiting for the class to join…</p>';
    document.querySelectorAll('#games .game').forEach((b) => b.classList.toggle('on', b.dataset.game === SET.game));
    $('optKicks').hidden = SET.game !== 'penalty'; $('optGames').hidden = SET.game !== 'tennis';
    document.querySelectorAll('.seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === SET[s.dataset.opt])));
    const n = present().length;
    $('playBtn').disabled = n < 2;
    $('need').textContent = n < 2 ? 'Two players needed' : n >= 4 ? 'Two matches at once' : 'One match at a time';
    renderPack();
  }
  function renderPack() {
    const ps = SET.packs.map((id) => PACKS.find((p) => p.id === id)).filter(Boolean);
    const label = (p) => (window.FugioPacks && FugioPacks.label ? FugioPacks.label(p) : p.level);
    $('packBtn').innerHTML = ps.length ? `${esc(ps.length > 1 ? `${ps.length} packages` : ps[0].title)}<small>${esc(ps.length > 1 ? ps.map(label).join(' · ') : label(ps[0]))} · change the words ›</small>` : 'Choose the words ›';
  }
  $('plist').addEventListener('click', (e) => { const b = e.target.closest('[data-kick]'); if (!b) return; const p = PL.find((x) => x.id === b.dataset.kick); if (p) removePlayer(p); });
  document.querySelectorAll('#games .game').forEach((b) => b.onclick = () => { SET.game = b.dataset.game; save(); renderLobby(); });
  document.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; SET[s.dataset.opt] = +b.dataset.v; save(); renderLobby(); }));
  $('packBtn').onclick = async () => {
    if (!window.FugioPacks) return;
    const ids = await FugioPacks.open(PACKS, SET.packs, { theme: 'gummy' });
    if (ids && ids.length) { SET.packs = ids; save(); renderPack(); }
  };
  $('playBtn').onclick = () => startGame(SET.game);
  $('endBtn').onclick = () => endGame(true);
  $('podLobby').onclick = () => { show('lobby'); PL.forEach((p) => watch(p, "You're in!", 'Look at the big screen. The next game starts soon.', { kind: 'lobby' })); renderLobby(); };
  $('podAgain').onclick = () => startGame(LAST || SET.game);

  // ---------- the game area ----------
  let GAME = null, LAST = null;
  const slotsEl = $('slots');
  addEventListener('message', (e) => { if (GAME && e.data && typeof e.data === 'object') GAME.msg(e.source, e.data); });
  function clock(el, secs) {
    const c = el.querySelector('.clock'); if (!c) return; const i = c.firstElementChild;
    c.classList.remove('low'); i.style.transition = 'none'; i.style.transform = 'scaleX(1)'; void i.offsetWidth;
    i.style.transition = `transform ${secs}s linear`; i.style.transform = 'scaleX(0)';
    clearTimeout(c._low); c._low = setTimeout(() => c.classList.add('low'), Math.max(0, secs - 3.5) * 1000);
  }
  function clockStop(el) { const c = el.querySelector('.clock'); if (!c) return; const i = c.firstElementChild; const w = getComputedStyle(i).transform; i.style.transition = 'none'; i.style.transform = w === 'none' ? 'scaleX(0)' : w; clearTimeout(c._low); }
  function mcard(el, html, ms) {
    const old = el.querySelector('.mcard'); if (old) old.remove();
    if (!html) return;
    const d = document.createElement('div'); d.className = 'mcard'; d.innerHTML = `<div>${html}</div>`; el.appendChild(d);
    if (ms) setTimeout(() => d.remove(), ms);
  }
  const whoHTML = (p, small = '') => `<div class="who" style="--c:${AV[p.av].c}"><i>${AV[p.av].e}</i><b>${esc(p.name)}</b>${small ? `<small>${small}</small>` : ''}</div>`;
  function ticker() {
    if (!GAME) return;
    const top = PL.slice().sort((a, b) => b.pts - a.pts).slice(0, 6);
    $('ticker').innerHTML = `<span class="tk">LEADERS</span>${top.map((p, i) => `<span class="lead">${i + 1}. ${esc(p.name)} <em>${p.pts}</em></span>`).join('')}${GAME.next ? `<span class="tk" style="margin-left:auto">NEXT</span><span>${GAME.next()}</span>` : ''}`;
  }
  function startGame(key) {
    if (present().length < 2) { show('lobby'); renderLobby(); return; }
    if (GAME) GAME.stop();
    PL.forEach((p) => { p.pts = 0; p.right = 0; p.asked = 0; p.wins = 0; p.team = -1; });
    LAST = key;
    slotsEl.innerHTML = '';
    $('barMid').textContent = GAMES[key];
    show('stage');
    GAME = Duel(GAMES[key] ? key : 'penalty');
    GAME.key = key;
    GAME.start();
    ticker();
  }
  function endGame(byTeacher) {
    if (!GAME) return;
    const g = GAME; GAME = null; g.stop();
    PL.forEach((p) => { if (p.pend) { clearTimeout(p.pend.timer); p.pend = null; } });
    slotsEl.innerHTML = '';
    const rank = PL.slice().sort((a, b) => b.pts - a.pts || b.right - a.right);
    $('podKick').textContent = `${GAMES[g.key].toUpperCase()} · FINAL RESULTS`;
    $('podTitle').textContent = g.title || (rank[0] ? `${rank[0].name} is the champion!` : 'Well played!');
    if (g.teamsRank) {
      $('steps').innerHTML = g.teamsRank.slice(0, 3).map((t, i) => `<div class="step p${i + 1}" style="--c:${t.c}"><i>${t.e}</i><b>${esc(t.name)}</b><div class="blk">${i + 1}</div></div>`).join('');
    } else {
      $('steps').innerHTML = rank.slice(0, 3).map((p, i) => `<div class="step p${i + 1}" style="--c:${AV[p.av].c}"><i>${AV[p.av].e}</i><b>${esc(p.name)}</b><div class="blk">${i + 1}</div></div>`).join('');
    }
    $('table').innerHTML = rank.map((p) => `<li style="--c:${AV[p.av].c}"><i></i><span>${esc(p.name)}</span><em>${p.right}/${p.asked} right</em><b>${p.pts}</b></li>`).join('');
    rank.forEach((p, i) => send(p, { t: 'end', place: i + 1, of: rank.length, pts: p.pts, right: p.right, asked: p.asked, title: i === 0 ? 'CHAMPION! 🏆' : i < 3 ? `${['', '', '2nd', '3rd'][i + 1]} PLACE!` : 'WELL PLAYED!', team: g.teamsRank && p.team >= 0 ? g.teamsRank.findIndex((t) => t.i === p.team) + 1 : 0 }));
    show('podium');
    confetti();
  }

  // ---------- 1 v 1 games: Penalties and Tennis ----------
  // Pairs from a queue (shuffled at the start). Up to two matches at once (four players or more); when a match ends both
  // players go to the back of the queue and the next two play. Everybody waiting answers the same questions as a "fan".
  function Duel(key) {
    const PEN = key === 'penalty';
    const G = { slots: [], queue: [], live: true, title: '' };
    const inMatch = (p) => G.slots.some((s) => s.m && (s.m.a === p || s.m.b === p));
    G.start = () => {
      G.queue = shuffle(present());
      const n = present().length >= 4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const el = document.createElement('div'); el.className = 'slot';
        const src = PEN ? `/penalty/?remote=1&slot=${i}` : `tennis/?remote=1&slot=${i}`;
        el.innerHTML = `<iframe src="${src}" allow="autoplay; fullscreen" title="${GAMES[key]} ${i + 1}"></iframe><div class="clock"><i></i></div><div class="sb" hidden></div>`;
        slotsEl.appendChild(el);
        const s = { i, el, frame: el.querySelector('iframe'), ready: false, m: null, sbHide: () => { el.querySelector('.sb').hidden = true; } };
        G.slots.push(s);
        mcard(el, `<p class="kick">${GAMES[key].toUpperCase()}</p><h3>Getting the ${PEN ? 'pitch' : 'court'} ready…</h3>`);
      }
      PL.forEach((p) => watch(p, 'Get ready!', 'Look at the big screen.'));
    };
    G.stop = () => { G.live = false; G.slots.forEach((s) => { clearTimeout(s.timer); s.m = null; }); };
    G.post = (s, m) => { try { s.frame.contentWindow.postMessage(m, '*'); } catch (e) {} };
    G.msg = (src, d) => {
      const s = G.slots.find((x) => x.frame.contentWindow === src); if (!s) return;
      const t = d.fs || d.ft;
      if (t === 'ready' && !s.ready) { s.ready = true; nextMatch(s); }
      if (t === 'done' && s.done) { const f = s.done; s.done = null; f(); }
    };
    G.join = (p, fresh) => {
      if (!inMatch(p) && !G.queue.includes(p)) G.queue.push(p);
      if (!inMatch(p)) watch(p, "You're in the queue!", `Wait for your ${PEN ? 'penalty match' : 'tennis match'}. Answer the fan questions to score points!`);
      G.slots.forEach((s) => { if (s.ready && !s.m && !s.starting) nextMatch(s); });
    };
    G.leave = (p) => { G.queue = G.queue.filter((x) => x !== p); };
    G.next = () => { const q = G.queue.filter((p) => p.conn); return q.length >= 2 ? `${esc(q[0].name)} v ${esc(q[1].name)}` : 'everybody plays'; };
    function take2() {
      const free = G.queue.filter((p) => p.conn && PL.includes(p) && !inMatch(p));
      if (free.length < 2) return null;
      const a = free[0], b = free[1];
      G.queue = G.queue.filter((x) => x !== a && x !== b);
      return [a, b];
    }
    async function nextMatch(s) {
      if (!G.live || s.m || s.starting) return;
      const pair = take2();
      if (!pair) { s.sbHide(); mcard(s.el, `<p class="kick">${GAMES[key].toUpperCase()}</p><h3>Waiting for players…</h3><p>The next match starts when two players are free.</p>`); G.post(s, { fs: 'idle', ft: 'idle' }); return; }
      s.starting = true;
      const [a, b] = pair;
      s.m = { a, b, n: 0, results: [], g: [0, 0], pts: [0, 0], games: [0, 0], server: 0, rally: 0 };
      mcard(s.el, `<p class="kick">${PEN ? `MATCH · ${SET.kicks} PENALTIES EACH` : `MATCH · FIRST TO ${SET.games} GAME${SET.games > 1 ? 'S' : ''}`}</p><div class="vs">${whoHTML(a, PEN ? 'shoots first ⚽' : 'serves first 🎾')}<span class="v">VS</span>${whoHTML(b, PEN ? 'in goal first 🧤' : '')}</div>`);
      watch(a, 'YOUR MATCH!', `You play against ${b.name}. Look at the big screen!`, { kind: 'match' });
      watch(b, 'YOUR MATCH!', `You play against ${a.name}. Look at the big screen!`, { kind: 'match' });
      ticker();
      if (!PEN) G.post(s, { ft: 'match', a: { name: a.name, c: AV[a.av].c }, b: { name: b.name, c: AV[b.av].c }, games: SET.games });
      await wait(3400);
      s.starting = false;
      if (!G.live || !s.m) return;
      mcard(s.el, null);
      renderSB(s);
      if (PEN) kick(s); else serve(s);
    }
    function renderSB(s) {
      const m = s.m, sb = s.el.querySelector('.sb'); if (!m) { sb.hidden = true; return; }
      sb.hidden = false;
      const side = (p, r, tag) => `<div class="side${r ? ' r' : ''}" style="--c:${AV[p.av].c}"><i>${AV[p.av].e}</i><b>${esc(p.name)}</b><span class="tick${m.ans && m.ans[tag] ? ' on' : ''}">✓</span></div>`;
      let score;
      if (PEN) score = `${m.g[0]} – ${m.g[1]}<small>KICK ${Math.min(m.n + 1, SET.kicks * 2)} / ${SET.kicks * 2}</small>`;
      else { const L = ['0', '15', '30', '40']; score = `${m.games[0]} – ${m.games[1]}<small>${L[Math.min(3, m.pts[0])]} : ${L[Math.min(3, m.pts[1])]}</small>`; }
      sb.innerHTML = `${side(m.a, false, 'a')}<div class="score">${score}</div>${side(m.b, true, 'b')}`;
    }
    const fansAsk = (q, secs) => {
      for (const p of present()) {
        if (inMatch(p) || p.pend) continue;
        ask(p, { role: 'fan', title: 'FAN QUIZ 📣', sub: 'Right answers score points too!', q, secs }, (i) => {
          const ok = i === q.correct; p.asked++; if (ok) { p.right++; p.pts += 1; }
          reply(p, { ok, title: ok ? 'RIGHT! +1' : i < 0 ? 'TOO SLOW!' : 'NOT QUITE', right: q.right, msg: ok ? 'Great fan!' : '' });
          ticker();
        });
      }
    };

    // ----- penalties -----
    function kick(s) {
      const m = s.m; if (!G.live || !m) return;
      const total = SET.kicks * 2, aShoots = m.n % 2 === 0, S = aShoots ? m.a : m.b, K = aShoots ? m.b : m.a;
      const q = FSQ.make(PACKS, SET.packs, { n: 4, count: m.n }); if (!q) return;
      m.q = q; m.ans = {}; m.kid = (m.kid || 0) + 1; const kid = m.kid;
      G.post(s, { fs: 'kick', n: m.n, total, shooter: S.name, keeper: K.name, sc: [AV[S.av].c, AV[K.av].c], results: m.results, q });
      renderSB(s); clock(s.el, SET.secs);
      m.ansTag = aShoots ? { s: 'a', k: 'b' } : { s: 'b', k: 'a' };
      const got = (tag) => (i, ms) => { if (m.kid !== kid) return; m.ans[tag] = { i, ms }; if (i >= 0) m.ans[m.ansTag[tag]] = 1; renderSB(s); if (m.ans.s && m.ans.k) resolveKick(s, kid); };
      ask(S, { role: 'shoot', title: 'YOU SHOOT! ⚽', sub: `Tap the right word to score against ${K.name}`, q, colors: true }, got('s'));
      ask(K, { role: 'keep', title: 'SAVE IT! 🧤', sub: `${S.name} shoots: tap the right word to dive there`, q, colors: true }, got('k'));
      fansAsk(q, SET.secs);
    }
    function resolveKick(s, kid) {
      const m = s.m; if (!m || m.kid !== kid || m.done) return;
      m.kid++; clockStop(s.el);
      const aShoots = m.n % 2 === 0, S = aShoots ? m.a : m.b, K = aShoots ? m.b : m.a, q = m.q;
      const sa = m.ans.s || { i: -1, ms: Infinity }, ka = m.ans.k || { i: -1, ms: Infinity };
      const sOk = sa.i === q.correct, kOk = ka.i === q.correct;
      const goal = sOk && (!kOk || sa.ms <= ka.ms);
      const R = `<b>${esc(q.right)}</b>`;
      const note = goal ? (kOk ? `GOAL! ${esc(S.name)} was faster · ${R}` : `GOAL for ${esc(S.name)}! · ${R}`)
        : sOk ? `SAVED! ${esc(K.name)} was faster · ${R}` : sa.i < 0 ? `Too slow! The right word is ${R}` : `Missed! The right word is ${R}`;
      G.post(s, { fs: 'shot', k: sa.i, goal, note });
      m.results[m.n] = goal ? 'goal' : 'save'; if (goal) m.g[aShoots ? 0 : 1]++;
      S.asked++; K.asked++;
      if (sOk) { S.right++; S.pts += 1; } if (kOk) { K.right++; K.pts += 1; }
      if (goal) S.pts += 2; else if (kOk) K.pts += 2;
      reply(S, { ok: goal, title: goal ? 'GOAL! ⚽' : sOk ? 'SAVED…' : sa.i < 0 ? 'TOO SLOW!' : 'MISSED!', msg: goal ? (kOk ? `You were faster than ${K.name}!` : 'Great shot!') : sOk ? `Right word, but ${K.name} was faster.` : '', right: q.right });
      reply(K, { ok: !goal, title: goal ? 'GOAL AGAINST YOU' : 'SAVED! 🧤', msg: goal ? (kOk ? `Right word, but ${S.name} was faster.` : '') : kOk ? 'Brilliant keeping!' : `${S.name} missed!`, right: q.right });
      renderSB(s); ticker();
      const go = () => { if (!G.live || s.m !== m) return; m.n++; if (m.n >= SET.kicks * 2) endMatch(s); else { s.timer = setTimeout(() => kick(s), 400); } };
      s.done = go; clearTimeout(s.timer); s.timer = setTimeout(() => { if (s.done === go) { s.done = null; go(); } }, 7000);
    }
    // ----- tennis -----
    const CALL = ['0', '15', '30', '40'];
    function serve(s) { const m = s.m; if (!G.live || !m) return; m.rally = 0; hit(s, m.server); }
    function hit(s, w) {
      const m = s.m; if (!G.live || !m) return;
      const P = w === 0 ? m.a : m.b, O = w === 0 ? m.b : m.a, tag = w === 0 ? 'a' : 'b';
      const q = FSQ.make(PACKS, SET.packs, { n: 3, count: m.rally + m.games[0] + m.games[1] }); if (!q) return;
      const secs = Math.max(6, SET.secs - m.rally * 1.5);
      m.ans = {}; m.kid = (m.kid || 0) + 1; const kid = m.kid;
      const isServe = m.rally === 0;
      G.post(s, { ft: 'ask', who: tag, q, secs, serve: isServe });
      renderSB(s); clock(s.el, secs);
      watch(O, isServe ? `${P.name} serves` : 'Get ready!', `Your turn comes when the ball is on your side.`, { kind: 'match' });
      ask(P, { role: 'hit', title: isServe ? 'YOUR SERVE! 🎾' : 'HIT IT BACK! 🎾', sub: 'Tap the right word to hit the ball', q, secs, colors: true }, (i, ms) => {
        if (m.kid !== kid || s.m !== m) return;
        m.ans[tag] = 1; renderSB(s); clockStop(s.el);
        const ok = i === q.correct; P.asked++; if (ok) { P.right++; P.pts += 1; }
        G.post(s, { ft: 'hit', who: tag, k: i, ok, right: q.right });
        reply(P, { ok, title: ok ? 'GREAT SHOT! 🎾' : i < 0 ? 'TOO SLOW!' : 'MISSED!', right: q.right, msg: ok ? 'The ball flies back!' : `The point goes to ${O.name}.` });
        ticker();
        if (ok) { m.rally++; s.timer = setTimeout(() => hit(s, 1 - w), 1300); }
        else s.timer = setTimeout(() => point(s, 1 - w), 1700);
      });
      fansAsk(q, secs);
    }
    function point(s, w) {
      const m = s.m; if (!G.live || !m) return;
      m.pts[w]++;
      const W = w === 0 ? m.a : m.b; W.pts += 1;
      let label, game = false;
      if (m.pts[w] >= 4) { game = true; m.games[w]++; m.pts = [0, 0]; m.server = 1 - m.server; label = `GAME ${W.name}!`; }
      else label = m.pts[0] === 3 && m.pts[1] === 3 ? 'DEUCE · next point wins' : `${CALL[m.pts[0]]} – ${CALL[m.pts[1]]}`;
      const over = m.games[w] >= SET.games;
      G.post(s, { ft: 'point', w: w === 0 ? 'a' : 'b', label, game, pts: m.pts, games: m.games });
      renderSB(s); ticker();
      s.timer = setTimeout(() => { if (over) endMatch(s, w); else serve(s); }, game ? 3000 : 2300);
    }
    function endMatch(s, wIdx) {
      const m = s.m; if (!m) return;
      let W = null, line;
      if (PEN) { W = m.g[0] > m.g[1] ? m.a : m.g[1] > m.g[0] ? m.b : null; line = `${m.g[0]} – ${m.g[1]}`; }
      else { W = wIdx === 0 ? m.a : m.b; line = `${m.games[0]} – ${m.games[1]} in games`; }
      if (W) { W.pts += 3; W.wins++; }
      const L = W ? (W === m.a ? m.b : m.a) : null;
      mcard(s.el, `<p class="kick">MATCH OVER · ${line}</p>${W ? `<div class="vs">${whoHTML(W, '🏆 +3 points')}</div><h3 style="margin-top:10px">${esc(W.name)} wins!</h3>` : `<h3>It's a draw!</h3><p>Great match, ${esc(m.a.name)} and ${esc(m.b.name)}!</p>`}`);
      if (W) { watch(W, 'YOU WON! 🏆', `${line} · +3 points. Well done!`, { kind: 'win' }); watch(L, 'GOOD MATCH!', `${W.name} won ${line}. Next time!`, { kind: 'lose' }); }
      else { watch(m.a, "IT'S A DRAW!", line); watch(m.b, "IT'S A DRAW!", line); }
      if (!PEN) G.post(s, { ft: 'end', w: W === m.a ? 'a' : 'b' });
      const a = m.a, b = m.b; s.m = null; s.sbHide(); ticker();
      clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        if (!G.live) return;
        [a, b].forEach((p) => { if (PL.includes(p) && !G.queue.includes(p)) { G.queue.push(p); watch(p, "You're in the queue!", 'Answer the fan questions while you wait!'); } });
        mcard(s.el, null);
        G.slots.forEach((x) => { if (x.ready && !x.m) nextMatch(x); });
      }, 4500);
      confetti(s.el.getBoundingClientRect());
    }
    return G;
  }

  // ---------- confetti ----------
  function confetti(rect) {
    const cv = $('confetti'), g = cv.getContext('2d'), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const r = rect || { left: 0, width: W, top: 0, height: H };
    const cols = ['#ffcd1c', '#ff5d8f', '#48d8ff', '#66e08a', '#8f52d9', '#ff7d22'];
    const bits = Array.from({ length: rect ? 90 : 220 }, () => ({ x: r.left + Math.random() * r.width, y: r.top - 20 - Math.random() * r.height * 0.4, vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 260, a: Math.random() * 6, va: (Math.random() - 0.5) * 10, c: cols[Math.floor(Math.random() * cols.length)], s: 6 + Math.random() * 8 }));
    let t0 = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      g.clearRect(0, 0, W, H); let alive = 0;
      for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 200 * dt; b.a += b.va * dt; if (b.y < H + 20) { alive++; g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); } }
      if (alive) requestAnimationFrame(step); else g.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(step);
  }

  renderJoin(); renderLobby();
  // test hooks
  window.FS = { PL, SET, get GAME() { return GAME; }, NET, start: startGame, end: endGame };
})();
