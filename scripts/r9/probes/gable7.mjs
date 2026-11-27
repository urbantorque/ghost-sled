// Gablefall's finish: the river ice's own terms in turn (LOOKDBG 28 the sun's path, 29 its sheen, 30 the mirror, 44 the
// wind's tongues of snow, 45 the spindrift), ride-through passes.
const set = (k) => `(() => { window.__gs.world.scene.getObjectByName('terrain').traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uLookDbg) o.material.uniforms.uLookDbg.value = ${k}; }); })()`;
const variants = [{ name: 'base' }];
for (const k of [28, 29, 30, 44, 45]) variants.push({ name: `d${k}`, on: set(k), off: set(0) });
export default {
  m: 7,
  tier: 'high',
  hour: process.env.HOUR || 'alt',
  query: '&ghosts=0',
  out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable7-${process.env.HOUR || 'alt'}/`,
  settle: 200,
  pass: true,
  spot: { z: 2758, line: 'mid', v: 22 },
  variants,
};
