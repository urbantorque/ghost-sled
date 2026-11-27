// Gullhaven's soft shadow blobs: the snow shader's own terms on the shelf (a temporary LOOKDBG uniform, 21 to 27).
const set = (k) => `(() => { window.__gs.world.scene.getObjectByName('terrain').traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uLookDbg) o.material.uniforms.uLookDbg.value = ${k}; }); })()`;
const variants = [{ name: 'base' }];
for (let k = 21; k <= 27; k++) variants.push({ name: `d${k}`, on: set(k), off: set(0) });
export default {
  m: 6,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-shadows2/',
  spot: { z: 1181, line: 'mid', v: 28 },
  settle: 300,
  variants,
};
