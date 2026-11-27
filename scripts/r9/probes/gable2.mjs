// Gablefall's carried faults, second round: ride-through passes (the lens as the frames have it) and overrides set just
// before each render (a hook on the renderer), so what the world sets every frame cannot undo them. GABLE=evensong |
// finish | opening.
const which = process.env.GABLE || 'evensong';
const hook = (code) => `(() => { const r = window.__gs.world.renderer; if (!r.__hooked) { const o = r.render.bind(r); r.render = (s, c) => { if (window.__before) window.__before(); return o(s, c); }; r.__hooked = true; } window.__before = () => { const w = window.__gs.world; const T = w.scene.getObjectByName('terrain').children[0].material.uniforms; const G = w.gablefall; ${code} }; })()`;
const unhook = (restore = '') => `(() => { window.__before = null; ${restore} })()`;
const set = (k) => `(() => { window.__gs.world.scene.getObjectByName('terrain').traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uLookDbg) o.material.uniforms.uLookDbg.value = ${k}; }); })()`;
const out = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable2-' + which + '/';
const cfgs = {
  evensong: {
    hour: 'alt',
    spot: { z: 600, line: 'mid', v: 22 },
    variants: [
      { name: 'base' },
      { name: 'noemis', on: hook(`G.mat.uniforms.uEmissiveStrength.value = 0;`), off: unhook() },
      { name: 'nolocal', on: hook(`T.uLocalProps.value = 0; T.uLocalCount.value = 0;`), off: unhook() },
      { name: 'nolift', on: hook(`T.uLiftK.value.set(0, 0, 0, 0);`), off: unhook() },
      { name: 'nohemi', on: hook(`T.uHemi.value.setRGB(0, 0, 0);`), off: unhook() },
      { name: 'nosun', on: hook(`T.uSunColor.value.setRGB(0, 0, 0);`), off: unhook() },
    ],
  },
  finish: {
    spot: { z: 2758, line: 'mid', v: 22 },
    variants: [{ name: 'base' }, { name: 'nopath', on: set(28), off: set(0) }, { name: 'noaniso', on: set(29), off: set(0) }, { name: 'nomirror', on: set(30), off: set(0) }],
  },
  opening: {
    spot: { z: 26, line: 'mid', v: 18 },
    variants: [
      { name: 'base' },
      { name: 'noshadowmap', on: hook(`w.renderer.shadowMap.autoUpdate = false; w.renderer.shadowMap.needsUpdate = false;`), off: unhook(`window.__gs.world.renderer.shadowMap.autoUpdate = true;`) },
      { name: 'nofar', on: hook(`T.uFarK.value.x = 0;`), off: unhook() },
      { name: 'shadowdbg', on: set(21), off: set(0) },
      { name: 'predbg', on: set(26), off: set(0) },
    ],
  },
};
export default { m: 7, tier: 'high', query: '&ghosts=0', out, settle: 200, pass: true, ...cfgs[which] };
