// Foxino Sports: the student's phone. Join the teacher's game with the code (PeerJS to "fugio-sports-<code>"), then answer the
// questions the big screen sends: shooter / keeper / fan in Penalties, the team vote in River Raft, the hits in Tennis.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hints = (t) => esc(t).replace(/\(([^)]*)\)/g, '<i>($1)</i>');
  const ls = { get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const AV = [
    { c: '#ff5d8f', e: '🦊' }, { c: '#ffb703', e: '⚽' }, { c: '#3ab0ff', e: '🐬' }, { c: '#2fbf6a', e: '🐸' }, { c: '#8f52d9', e: '🦄' },
    { c: '#ff7d22', e: '🐯' }, { c: '#00b8ad', e: '🐢' }, { c: '#e8403a', e: '🦀' }, { c: '#5a6bff', e: '🚀' }, { c: '#b88a00', e: '🦁' },
    { c: '#7a5230', e: '🐻' }, { c: '#ff4fd8', e: '🐙' },
  ];
  const OPT_C = ['#ff8fc4', '#ffd84a', '#6fe2ff', '#8ef0a8'];
  const PREFIX = 'fugio-sports-';
  let token = ls.get('sports-token'); if (!token) { token = Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set('sports-token', token); }
  let av = Math.max(0, Math.min(AV.length - 1, +ls.get('sports-av', String(Math.floor(Math.random() * AV.length))) | 0));
  const me = { name: ls.get('sports-name'), av, joined: false };
  const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id)); }
  function tint(c) { document.body.classList.toggle('tinted', !!c); if (c) document.body.style.setProperty('--accent', c); }
  function renderMe() { ['me1', 'me2', 'me3'].forEach((id) => { const el = $(id); el.style.setProperty('--c', AV[me.av].c); el.innerHTML = `<i>${AV[me.av].e}</i>${esc(me.name)}`; }); }

  // ---------- join form ----------
  const qs = new URLSearchParams(location.search);
  $('code').value = (qs.get('c') || sessionStorage.getItem('sports-code') || '').replace(/\D/g, '').replace(/(\d{3})(\d{1,3})/, '$1 $2');
  $('name').value = me.name;
  $('avs').innerHTML = AV.map((a, i) => `<button type="button" data-i="${i}" style="--c:${a.c}" class="${i === me.av ? 'on' : ''}" aria-label="Picture ${i + 1}">${a.e}</button>`).join('');
  $('avs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; me.av = +b.dataset.i; ls.set('sports-av', me.av); $('avs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  $('code').addEventListener('input', (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; });
  if (!$('code').value) $('code').focus(); else if (!me.name) $('name').focus();
  $('joinForm').onsubmit = (e) => {
    e.preventDefault();
    const code = $('code').value.replace(/\D/g, ''), name = $('name').value.trim().replace(/\s+/g, ' ').slice(0, 14);
    if (code.length !== 6) return err('The code has 6 numbers. Look at the big screen.');
    if (!name) return err('Type your name.');
    me.name = name; ls.set('sports-name', name); sessionStorage.setItem('sports-code', code);
    connect(code);
  };
  function err(t) { $('err').textContent = t; $('goBtn').disabled = false; $('goBtn').textContent = 'JOIN'; }

  // ---------- the connection ----------
  const NET = { peer: null, conn: null, code: '', retry: 0, lib: null };
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  async function connect(code) {
    $('goBtn').disabled = true; $('goBtn').textContent = 'JOINING…'; $('err').textContent = '';
    try { await (NET.lib || (NET.lib = window.Peer ? Promise.resolve() : load('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'))); } catch (e) { NET.lib = null; return err('No internet connection.'); }
    NET.code = code;
    if (!NET.peer || NET.peer.destroyed) {
      NET.peer = new Peer();
      NET.peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') { if (me.joined) return retry(); return err('No game with this code. Check the big screen.'); }
        if (!me.joined) err('Could not connect. Try again.'); else retry();
      });
      NET.peer.on('disconnected', () => { try { NET.peer.reconnect(); } catch (e) {} });
      await new Promise((res) => { if (NET.peer.open) res(); else NET.peer.once('open', res); });
    }
    const conn = NET.peer.connect(PREFIX + code, { reliable: true });
    NET.conn = conn;
    const to = setTimeout(() => { if (!conn.open && !me.joined) err('No game with this code. Check the big screen.'); }, 9000);
    conn.on('open', () => { clearTimeout(to); NET.retry = 0; conn.send({ t: 'hello' }); conn.send({ t: 'join', token, name: me.name, av: me.av }); setConn(''); });
    conn.on('data', onMsg);
    conn.on('close', () => { if (NET.conn === conn && me.joined) retry(); });
  }
  function retry() {
    setConn('Reconnecting…');
    clearTimeout(NET.rt);
    NET.rt = setTimeout(() => { if (!NET.conn || !NET.conn.open) connect(NET.code); }, Math.min(5000, 1200 + NET.retry++ * 800));
  }
  function setConn(t) { $('conn1').textContent = t; }
  const send = (m) => { try { if (NET.conn && NET.conn.open) NET.conn.send(m); } catch (e) {} };

  // ---------- messages from the big screen ----------
  let Q = null;
  function onMsg(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'err') { me.joined = false; return err(m.msg); }
    if (m.t === 'joined') { me.joined = true; me.name = m.name; me.av = m.av; renderMe(); if (!document.querySelector('.screen.show') || $('join').classList.contains('show')) waitScreen({ title: "You're in!", msg: 'Look at the big screen.', kind: 'lobby' }); return; }
    if (m.t === 'wait') return waitScreen(m);
    if (m.t === 'q') return question(m);
    if (m.t === 'res') return result(m);
    if (m.t === 'end') return endScreen(m);
    if (m.t === 'bye') { me.joined = false; tint(''); show('join'); err('The game has ended. Join again with a new code.'); }
  }
  const ICO = { lobby: '📺', team: '🛶', match: '🏟️', win: '🏆', lose: '💪', locked: '✅' };
  function waitScreen(m) {
    if (Q && m.kind === 'locked' && $('ask').classList.contains('show')) { $('locked').textContent = m.msg; return; }
    Q = null;
    tint(m.accent || '');
    $('wIco').textContent = ICO[m.kind] || '📺';
    $('wTitle').textContent = m.title || ''; $('wMsg').textContent = m.msg || '';
    show('wait');
    if (m.kind === 'win') vib([60, 60, 120]);
  }
  function question(m) {
    Q = { id: m.id, t0: performance.now(), done: false, secs: m.secs };
    tint(m.accent || (m.role === 'shoot' ? '#e2541a' : m.role === 'keep' ? '#1f7fc4' : m.role === 'fan' ? '' : ''));
    $('qTitle').textContent = m.title || ''; $('qSub').textContent = m.sub || '';
    $('qText').innerHTML = `${hints(m.before)}<span class="gap">&nbsp;</span>${hints(m.after)}`;
    const letters = ['A', 'B', 'C', 'D'];
    $('opts').className = 'opts';
    $('opts').innerHTML = m.opts.map((o, i) => `<button class="opt" type="button" data-i="${i}" style="--c:${m.colors ? OPT_C[i % OPT_C.length] : '#ffffff'}"><span class="k">${letters[i]}</span>${esc(o)}</button>`).join('');
    $('locked').hidden = true; $('locked').textContent = 'Locked in! Look at the big screen 👀';
    show('ask'); vib(40);
    const bar = $('tBar'), tm = bar.parentElement;
    tm.classList.remove('low'); bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; void bar.offsetWidth;
    bar.style.transition = `transform ${m.secs}s linear`; bar.style.transform = 'scaleX(0)';
    clearTimeout(Q.lowT); Q.lowT = setTimeout(() => tm.classList.add('low'), Math.max(0, m.secs - 3.5) * 1000);
  }
  $('opts').addEventListener('click', (e) => {
    const b = e.target.closest('.opt'); if (!b || !Q || Q.done) return;
    Q.done = true;
    const ms = Math.round(performance.now() - Q.t0);
    send({ t: 'ans', id: Q.id, i: +b.dataset.i, ms });
    b.classList.add('pick'); $('opts').classList.add('done'); $('locked').hidden = false;
    const bar = $('tBar'); const w = getComputedStyle(bar).transform; bar.style.transition = 'none'; bar.style.transform = w;
    vib(25);
  });
  function result(m) {
    Q = null;
    tint(m.accent || '');
    const box = document.querySelector('.rbox');
    box.classList.toggle('bad', !m.ok);
    $('rIco').textContent = m.ok ? '✓' : '✗';
    $('rTitle').textContent = m.title || (m.ok ? 'RIGHT!' : 'NOT QUITE');
    $('rRight').innerHTML = m.right ? `The right word: <b>${esc(m.right)}</b>` : '';
    $('rMsg').textContent = m.msg || '';
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    show('res'); vib(m.ok ? [30, 40, 30] : 120);
  }
  function endScreen(m) {
    Q = null; tint('');
    $('eMedal').textContent = m.place === 1 ? '🏆' : m.place === 2 ? '🥈' : m.place === 3 ? '🥉' : '⭐';
    $('eTitle').textContent = m.title || 'WELL PLAYED!';
    $('ePlace').textContent = `${m.place}. of ${m.of}`;
    $('ePts').textContent = m.pts; $('eRight').textContent = `${m.right}/${m.asked}`;
    show('end'); vib([50, 50, 50, 50, 120]);
  }
  renderMe();
  // a phone that already joined this game (reload, the screen was locked) joins again by itself
  if (qs.get('c') == null && sessionStorage.getItem('sports-code') && me.name && sessionStorage.getItem('sports-auto') === '1') connect(sessionStorage.getItem('sports-code'));
  addEventListener('pagehide', () => { if (me.joined) sessionStorage.setItem('sports-auto', '1'); });
  window.FSP = { me, get Q() { return Q; }, NET };
})();
