// The Old Run's pale band: the scribe (14) and the rime (15) turned off in turn (LOOKDBG), with no ghosts to turn the lens.
const set = (k) => `(() => { window.__gs.world.scene.getObjectByName('terrain').traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uLookDbg) o.material.uniforms.uLookDbg.value = ${k}; }); })()`;
export default {
  m: 5,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/oldrun-band3/',
  spot: { z: 228, line: 'glaze', v: 32 },
  settle: 300,
  variants: [{ name: 'base' }, { name: 'noscribe', on: set(14), off: set(0) }, { name: 'norime', on: set(15), off: set(0) }, { name: 'base2' }, { name: 'glaze', on: set(1), off: set(0) }, { name: 'tu', on: set(5), off: set(0) }],
};
