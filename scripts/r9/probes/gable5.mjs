// Gablefall at Evensong: the toon shader's last terms (LOOKDBG 31, 38 to 41).
const set = (k) => `(() => { window.__gs.world.gablefall.mat.uniforms.uLookDbg.value = ${k}; })()`;
const variants = [{ name: 'base' }];
for (const k of [42, 43]) variants.push({ name: `t${k}`, on: set(k), off: set(0) });
export default {
  m: 7,
  tier: 'high',
  hour: 'alt',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable5-alt/',
  settle: 200,
  pass: true,
  spot: { z: 600, line: 'mid', v: 22 },
  variants,
};
