// Foxino Sports: the questions. Gap-fill sentences from the shared Fugio packages (packages.js: "text [right|wrong|wrong]
// (hint) text"), the same ones Penalty Star, Gummy and Adventures use. One builder for every sport:
//   FSQ.make(packs, ids, {n: 3|4, round: 0..2}) → {before, after, right, words: [{text, ok}], correct}
// The words are sorted the same way every time (never the right one first), and a capital letter never gives it away.
(function () {
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const SLOT = new Set(['do', 'does', "don't", "doesn't", 'did', "didn't", 'was', 'were', "wasn't", "weren't", 'is', 'are', 'am',
    "isn't", "aren't", 'a', 'an', 'the', 'more', 'most', 'less', 'least', 'because', 'so', 'and', 'but', 'or', 'have', 'has', 'not']);
  const slotKey = (t) => t.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean).map((w) => (SLOT.has(w) ? w : '_')).join(' ');
  function packIndex(pk) {
    if (pk._ix) return pk._ix;
    const byRight = new Map(), byWrong = new Map(), byKind = new Map(), add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
    for (const q of pk.rounds.flat()) {
      const m = q.match(/\[([^\]]+)\]/); if (!m) continue; const [r, ...w] = m[1].split('|');
      for (const x of w) { add(byRight, r.toLowerCase(), x); for (const y of w) if (y !== x) add(byWrong, y.toLowerCase(), x); add(byKind, slotKey(x) + '#' + x.split(' ').length, x); }
    }
    return (pk._ix = { byRight, byWrong, byKind });
  }
  function extraWrongs(pk, right, wrong, n) {
    const ix = packIndex(pk), have = new Set([right, ...wrong].map((t) => t.toLowerCase())), out = [];
    const take = (set) => { for (const t of shuffle([...(set || [])])) { if (out.length >= n) return; if (!have.has(t.toLowerCase())) { have.add(t.toLowerCase()); out.push(t); } } };
    take(ix.byRight.get(right.toLowerCase())); for (const w of wrong) take(ix.byWrong.get(w.toLowerCase()));
    for (const w of wrong) take(ix.byKind.get(slotKey(w) + '#' + w.split(' ').length));
    return out;
  }
  function fill(s, pk, NB) {
    const m = s.match(/\[([^\]]+)\]/);
    const [right, ...wrong0] = m[1].split('|');
    const wrong = shuffle(wrong0).slice(0, NB - 1);
    if (pk && wrong.length < NB - 1) {
      const cap = /^[A-Z]/.test(right) && !/^I\b/.test(right), fix = (t) => (/^I\b/.test(t) ? t : cap ? t[0].toUpperCase() + t.slice(1) : t[0].toLowerCase() + t.slice(1));
      wrong.push(...extraWrongs(pk, right, wrong, NB - 1 - wrong.length).map(fix).filter((t) => t.toLowerCase() !== right.toLowerCase()));
    }
    const before0 = s.slice(0, m.index), start = !before0.trim() || /[.!?]["')]?\s*$/.test(before0), small = !start && (/^[a-z]/.test(right) || /^I\b/.test(right));
    const look = (t) => (/^I\b/.test(t) ? t : start ? t[0].toUpperCase() + t.slice(1) : small ? t[0].toLowerCase() + t.slice(1) : t);
    const seen = new Set(), words = [{ text: look(right), ok: true }, ...wrong.map((t) => ({ text: look(t), ok: false }))]
      .filter((w) => { const k = w.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    words.sort((x, y) => slotKey(x.text).localeCompare(slotKey(y.text)) || x.text.localeCompare(y.text));
    return { before: s.slice(0, m.index), after: s.slice(m.index + m[0].length), right: look(right), words, correct: words.findIndex((w) => w.ok) };
  }
  const used = new Set();
  function sentence(pk, r) {
    const ok = (q) => /\[[^\]]+\|[^\]]+\]/.test(q);
    const mine = (pk.rounds[r] || []).filter(ok), rest = pk.rounds.filter((_, i) => i !== r).flat().filter(ok);
    const free = (l) => l.filter((q) => !used.has(q));
    let pool = free(mine); if (!pool.length) pool = free(rest);
    if (!pool.length) { used.clear(); pool = mine.length ? mine : rest; }
    const q = pick(pool); used.add(q); return q;
  }
  function merged(packs, ids) {
    if (window.FugioPacks && FugioPacks.merge) { const m = FugioPacks.merge(packs, ids); if (m) return m; }
    return packs.find((p) => p.id === ids[0]) || packs[0];
  }
  window.FSQ = {
    packs: () => (window.FugioPacks ? FugioPacks.sort(window.GUMMY_PACKAGES || []) : (window.GUMMY_PACKAGES || [])),
    // r: which third of the package (0 easy … 2 hard); when not given it climbs slowly with the question count
    make(packs, ids, { n = 3, round = null, count = 0 } = {}) {
      const pk = merged(packs, ids); if (!pk) return null;
      const r = round != null ? round : count < 4 ? 0 : count < 9 ? 1 : 2;
      for (let tries = 0; tries < 6; tries++) {
        const q = fill(sentence(pk, r), pk, n);
        if (q.words.length >= 2 && q.correct >= 0) return q;
      }
      return null;
    },
    hints: (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/\(([^)]*)\)/g, '<i>($1)</i>'),
  };
})();
