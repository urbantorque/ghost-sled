// Gablefall at Evensong: the house material's own terms (a temporary LOOKDBG uniform in the toon shader, 31 to 37).
const set = (k) => `(() => { window.__gs.world.gablefall.mat.uniforms.uLookDbg.value = ${k}; })()`;
const variants = [{ name: 'base' }];
for (let k = 31; k <= 37; k++) variants.push({ name: `t${k}`, on: set(k), off: set(0) });
export default {
  m: 7,
  tier: 'high',
  hour: process.env.HOUR || 'alt',
  query: '&ghosts=0',
  out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable4-${process.env.HOUR || 'alt'}/`,
  settle: 200,
  pass: true,
  spot: { z: 600, line: 'mid', v: 22 },
  variants,
};
