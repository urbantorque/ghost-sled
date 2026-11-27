// Gablefall's finish: the streak on the river's ice toward the lens, with the moment kit's glows hidden just before each
// render (the climax's beams over the line are its glows; the kit sets their visibility every frame), at both hours.
const hook = (code) => `(() => { const r = window.__gs.world.renderer; if (!r.__hooked) { const o = r.render.bind(r); r.render = (s, c) => { if (window.__before) window.__before(); return o(s, c); }; r.__hooked = true; } window.__before = () => { ${code} }; })()`;
const unhook = `(() => { window.__before = null; })()`;
export default {
  m: 7,
  tier: 'high',
  hour: process.env.HOUR || 'alt',
  query: '&ghosts=0',
  out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable6-${process.env.HOUR || 'alt'}/`,
  settle: 200,
  pass: true,
  spot: { z: 2758, line: 'mid', v: 22 },
  variants: [
    { name: 'base' },
    { name: 'noglow', on: hook(`window.__gs.world.scene.traverse((o) => { if (o.isMesh && o.renderOrder === 7) o.visible = false; });`), off: unhook },
    { name: 'nofw', on: hook(`window.__gs.world.spirit.fireworks.mesh.visible = false;`), off: unhook },
  ],
};
