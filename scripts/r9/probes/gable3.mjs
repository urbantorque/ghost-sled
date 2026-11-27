// Gablefall at Evensong: what lights the fronts warm. The house material's tint to nothing, the bloom off, the grade's
// gain neutral, each set just before every render (a hook on the renderer).
const hook = (code) => `(() => { const r = window.__gs.world.renderer; if (!r.__hooked) { const o = r.render.bind(r); r.render = (s, c) => { if (window.__before) window.__before(); return o(s, c); }; r.__hooked = true; } window.__before = () => { const w = window.__gs.world; const G = w.gablefall; ${code} }; })()`;
const unhook = `(() => { window.__before = null; })()`;
export default {
  m: 7,
  tier: 'high',
  hour: 'alt',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable3-evensong/',
  settle: 200,
  pass: true,
  spot: { z: 600, line: 'mid', v: 22 },
  variants: [
    { name: 'base', get: `(() => { const G = window.__gs.world.gablefall; const u = G.mat.uniforms; return JSON.stringify({ tint: u.uTint && u.uTint.value, cool: u.uCool && u.uCool.value, em: u.uEmissive && u.uEmissive.value, es: u.uEmissiveStrength.value, shadeTint: u.uShadeTint && u.uShadeTint.value, sun: u.uSunColor.value, hemi: u.uHemi.value, skySide: u.uSkySide && u.uSkySide.value, bounce: u.uBounce && u.uBounce.value, lift: u.uLiftK && u.uLiftK.value }); })()` },
    { name: 'tint0', on: hook(`G.mat.uniforms.uTint.value.setRGB(0, 0, 0);`), off: `(() => { window.__before = null; window.__gs.world.gablefall.mat.uniforms.uTint.value.setRGB(1, 1, 1); })()` },
    { name: 'nobloom', on: hook(`w.post.moodBloom = 0;`), off: unhook },
    { name: 'nogain', on: hook(`w.post.composite.uniforms.uGain.value.setRGB(1, 1, 1); w.post.composite.uniforms.uLift.value.setRGB(0, 0, 0);`), off: unhook },
  ],
};
