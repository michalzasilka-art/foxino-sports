// A course centre line (from the Blender exports: points every `step` metres, three.js coordinates) as a smooth path:
// at(s) -> position, tangent (forward), normal (left), yaw; nearest(x, z, hint) -> s
import * as THREE from '/penalty/lib/three.module.min.js';

export function makePath(center, step, closed = false) {
  const P = center.map((c) => new THREE.Vector3(c[0], c[1], c[2])), n = P.length, L = (n - 1) * step;
  const get = (i) => (closed ? P[((i % n) + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  const out = { p: new THREE.Vector3(), t: new THREE.Vector3(), nrm: new THREE.Vector3(), yaw: 0, slope: 0 };
  // Catmull-Rom between the points
  const cr = (a, b, c, d, f, o) => { const f2 = f * f, f3 = f2 * f;
    o.set(0.5 * ((2 * b.x) + (-a.x + c.x) * f + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * f2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * f3),
      0.5 * ((2 * b.y) + (-a.y + c.y) * f + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * f2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * f3),
      0.5 * ((2 * b.z) + (-a.z + c.z) * f + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * f2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * f3)); return o; };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function pos(s, o) {
    if (closed) s = ((s % L) + L) % L; else s = Math.max(0, Math.min(L - 1e-4, s));
    const u = s / step, i = Math.floor(u), f = u - i;
    return cr(get(i - 1), get(i), get(i + 1), get(i + 2), f, o);
  }
  return {
    L, step, closed, points: P,
    pos,
    at(s) {
      pos(s, out.p); pos(s + 0.6, tmp); pos(s - 0.6, tmp2);
      out.t.copy(tmp).sub(tmp2); const horiz = Math.hypot(out.t.x, out.t.z); out.slope = Math.atan2(-out.t.y, horiz);
      out.t.y = 0; out.t.normalize(); out.nrm.set(out.t.z, 0, -out.t.x);   // left of forward (+z forward -> +x left)
      out.yaw = Math.atan2(out.t.x, out.t.z);
      return out;
    },
    // the s nearest to (x, z), searching round a hint (fast) or everywhere
    nearest(x, z, hint = null, range = 40) {
      let best = 0, bd = Infinity; const a = hint == null ? 0 : Math.floor((hint - range) / step), b = hint == null ? n - 1 : Math.ceil((hint + range) / step);
      for (let i = a; i <= b; i++) { const q = get(i), d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; best = i; } }
      return best * step;
    },
  };
}
