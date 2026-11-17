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
  const mixer = new THREE.AnimationMixer(scene), clips = {}, actions = {};
  for (const c of gltf.animations) { clips[c.name] = c; const a = mixer.clipAction(c); if (ONCE.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } actions[c.name] = a; }
  const find = (n) => { let r = null; scene.traverse((o) => { if (!r && o.name && o.name.replace(/[:.]/g, '').toLowerCase().endsWith(n.toLowerCase())) r = o; }); return r; };
  const bones = { RightHand: find('RightHand'), LeftHand: find('LeftHand'), Head: find('Head'), Hips: find('Hips') };
  // Rob's face screen: a 2×2 atlas (happy, focus / oops, sad)
  let faceMat = null; scene.traverse((o) => { if (o.isMesh && o.material && /face/i.test(o.material.name || '')) faceMat = o.material; });
  const FACES = { happy: [0, 0.5], focus: [0.5, 0.5], oops: [0, 0], sad: [0.5, 0] };
  let cur = null, curName = '';
  const ch = {
    root, bones, mixer, clips, isAnim: true, kind,
    has: (n) => !!actions[n],
    play(act, fade = 0.16) {
      const name = ACT[act] || act; if (!actions[name] || name === curName) return;
      const next = actions[name]; next.reset(); next.enabled = true; next.setEffectiveTimeScale(1); next.setEffectiveWeight(1);
      if (cur) next.crossFadeFrom(cur, fade, false); next.play(); cur = next; curName = name;
    },
    get clip() { return curName; },
    get time() { return cur ? cur.time : 0; },
    duration: (n) => (clips[n] ? clips[n].duration : 1),
    face(kind) { if (!faceMat || !faceMat.map || !FACES[kind]) return; faceMat.map.offset.set(FACES[kind][0], FACES[kind][1]); },
    update(ts) { mixer.update(ts); },
    // (the old pose API, so code that still calls these does nothing harmful)
    apply() {}, setKit() {},
  };
  ch.play('idle', 0);
  return ch;
}
