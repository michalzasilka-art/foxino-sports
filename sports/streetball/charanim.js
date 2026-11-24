// Streetball characters with real skeletal animations (2026-11-17, the user: "ultimate graphics/models ... 20 animations,
// basically Unity rules"). The Blender PC delivers foxino-baller.glb and rob-baller.glb, each with the same 20 clips
// (idle, ready, dribble, dribble_run, crossover, jump_shot, layup, dunk, pass, catch, defense, slide_left, slide_right,
// steal, block, stumble, celebrate, dance, sad, high_five). This wraps one of them: an AnimationMixer that cross-fades
// to the clip of the character's current action, its hand bone for the ball, and (Rob) the face screen's expressions.
import * as THREE from '/penalty/lib/three.module.min.js';

// the game's actions → the clips
const ACT = { idle: 'ready', dribble: 'dribble', drive: 'dribble_run', cross: 'crossover', shoot: 'jump_shot', layup: 'layup', dunk: 'dunk',
  stance: 'defense', slideL: 'slide_left', slideR: 'slide_right', steal: 'steal', block: 'block', stumble: 'stumble',
  cheer: 'celebrate', dance: 'dance', sad: 'sad', wave: 'high_five', run: 'dribble_run', pass: 'pass', catch: 'catch' };
const ONCE = new Set(['crossover', 'jump_shot', 'layup', 'dunk', 'pass', 'catch', 'steal', 'block', 'stumble', 'celebrate', 'sad', 'high_five']);

export function makeAnimChar(gltf, { height = null, kind = 'fox' } = {}) {
  const scene = gltf.scene, root = new THREE.Group(); root.add(scene);
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
  if (height) { scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(scene, true), h = b.max.y - b.min.y; if (h > 0.01) scene.scale.setScalar(height / h); }
  // (2026-11-24, the user: "On every foxino character's tail from now on in FoxSports dont do or remove it") Foxino has no tail: its two tail
  // bones are folded to nothing (the tail closes into its root on his back, no hole), and no clip moves them any more
  const TAILS = []; if (kind === 'fox') { scene.traverse((o) => { if (o.isBone && /tail/i.test(o.name)) { o.scale.setScalar(1e-4); TAILS.push(o); } });
    for (const c of gltf.animations) c.tracks = c.tracks.filter((t) => !/tail/i.test(t.name.split('.')[0])); }
  const mixer = new THREE.AnimationMixer(scene), clips = {}, actions = {};
  for (const c of gltf.animations) { clips[c.name] = c; const a = mixer.clipAction(c); if (ONCE.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } actions[c.name] = a; }
  const find = (n) => { let r = null; scene.traverse((o) => { if (!r && o.name && o.name.replace(/[:.]/g, '').toLowerCase().endsWith(n.toLowerCase())) r = o; }); return r; };
  const bones = { RightHand: find('RightHand'), LeftHand: find('LeftHand'), Head: find('Head'), Hips: find('Hips') };
  // Rob's face screen: a 2×2 atlas (happy, focus / oops, sad)
  let faceMat = null; scene.traverse((o) => { if (o.isMesh && o.material && /face/i.test(o.material.name || '')) faceMat = o.material; });
  // (the PC's atlas, offsets in glTF UV space = three.js with flipY false: happy, focus / oops, sad)
  const FACES = { happy: [0, 0], focus: [0.5, 0], oops: [0, 0.5], sad: [0.5, 0.5] };
  let faceNow = '';
  let cur = null, curName = '';
  const ch = {
    root, bones, mixer, clips, isAnim: true, kind,
    has: (n) => !!actions[n],
    play(act, fade = 0.2, force = false) {
      const name = ACT[act] || act; if (!actions[name] || (name === curName && !(force && ONCE.has(name)))) return;
      if (name === curName) { cur.reset(); cur.play(); return; }
      const next = actions[name]; next.reset(); next.enabled = true; next.setEffectiveTimeScale(1); next.setEffectiveWeight(1);
      if (cur) next.crossFadeFrom(cur, fade, false); next.play(); cur = next; curName = name;
    },
    get clip() { return curName; },
    get time() { return cur ? cur.time : 0; },
    duration: (n) => (clips[n] ? clips[n].duration : 1),
    face(kind) { if (!faceMat || !FACES[kind] || kind === faceNow) return; faceNow = kind; for (const t of [faceMat.map, faceMat.emissiveMap]) if (t) { t.offset.set(FACES[kind][0], FACES[kind][1]); t.updateMatrix(); } },
    update(ts) { mixer.update(ts); },
    // (the old pose API, so code that still calls these does nothing harmful)
    apply() {}, setKit() {},
  };
  ch.play('idle', 0);
  return ch;
}
