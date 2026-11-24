// Foxino Sports multiplayer (2026-11-25, "Multiplayer patch": two players in a party play each sport TOGETHER).
// One match channel for every sport, through the lobby's party link (the lobby relays: sport frame → lobby → friend's lobby → friend's
// sport frame), so no sport opens a connection of its own. In a sport frame:
//   import { MP } from '/sports/mp.js';   MP.on   (true in a party game)   MP.host (true: this phone is the referee)
//   MP.name, MP.fname                      the two names
//   MP.send(msg)                            to the friend (ordered, reliable; buffered by the lobbies until the friend's frame is up)
//   MP.listen(fn)                           fn(msg) for every message from the friend
//   await MP.ready(ms)                      both frames are up (true), or the friend never came (false: play alone)
//   MP.onLost(fn)                           the friend left or the link dropped: fn() once (the sport goes on alone)
//   MP.alive                                false once the friend is lost
// Test hooks: ?mplag=ms (delay every message, both ways, in the lobby).
const Q = new URLSearchParams(location.search);
const ROLE = Q.get('mp');
const on = (ROLE === 'host' || ROLE === 'join') && window.parent !== window;
const fns = [], lost = [];
let hi = false, theirHi = false, alive = on, waiters = [];
function post(m) { try { window.parent.postMessage(m, '*'); } catch (e) {} }
export const MP = {
  on, host: ROLE === 'host', name: (Q.get('name') || 'You').slice(0, 12), fname: (Q.get('fname') || 'Friend').slice(0, 12),
  get alive() { return alive; },
  send(m) { if (on && alive) post({ mp: m }); },
  listen(fn) { fns.push(fn); },
  onLost(fn) { if (!alive && on) fn(); else lost.push(fn); },
  ready(ms = 25000) {
    if (!on) return Promise.resolve(false);
    if (theirHi) return Promise.resolve(true);
    return new Promise((res) => { const w = { res }; waiters.push(w); w.t = setTimeout(() => { waiters = waiters.filter((x) => x !== w); res(false); }, ms); });
  },
};
function drop() { if (!alive) return; alive = false; const L = lost.splice(0); for (const f of L) { try { f(); } catch (e) { console.warn(e); } } for (const w of waiters.splice(0)) { clearTimeout(w.t); w.res(false); } }
if (on) {
  addEventListener('message', (e) => {
    if (e.source !== window.parent) return; const m = e.data; if (!m || typeof m !== 'object') return;
    if (m.mpLost) { drop(); return; }
    if (!('mpIn' in m)) return; const d = m.mpIn; if (!d || typeof d !== 'object') return;
    if (d.t === '_hi') { if (!theirHi) { theirHi = true; MP.send({ t: '_hi' }); for (const w of waiters.splice(0)) { clearTimeout(w.t); w.res(true); } } return; }
    if (!alive) return;
    for (const f of fns) { try { f(d); } catch (err) { console.warn('mp', err); } }
  });
  post({ mpHello: true });   // (the lobby flushes what came before this frame was up)
  const sayHi = () => { if (theirHi || !alive) return; MP.send({ t: '_hi' }); setTimeout(sayHi, 700); };
  setTimeout(sayHi, 50);
  hi = true;
}
void hi;
