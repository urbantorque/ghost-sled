// The Old Run's pale band: the track shader's own terms, one at a time (a temporary LOOKDBG uniform in materials.ts).
const set = (k) => `(() => { window.__gs.world.scene.getObjectByName('terrain').traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uLookDbg) o.material.uniforms.uLookDbg.value = ${k}; }); })()`;
const variants = [{ name: 'base' }];
for (let k = 1; k <= 13; k++) variants.push({ name: `d${String(k).padStart(2, '0')}`, on: set(k), off: set(0) });
export default {
  m: 5,
  tier: 'high',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/oldrun-band2/',
  spot: { z: 228, line: 'glaze', v: 32 },
  settle: 300,
  variants,
};
