// Gablefall's opening: the dotted seam across the nave's brink. Each of the world's pieces hidden in turn just before each
// render, ride-through passes from the start.
const hook = (code) => `(() => { const r = window.__gs.world.renderer; if (!r.__hooked) { const o = r.render.bind(r); r.render = (s, c) => { if (window.__before) window.__before(); return o(s, c); }; r.__hooked = true; } window.__before = () => { const W = window.__gs.world.scene.getObjectByName('gablefall-world'); ${code} }; })()`;
const unhook = `(() => { window.__before = null; })()`;
const hideNamed = (n) => hook(`W.traverse((o) => { if (o.name === '${n}') o.visible = false; });`);
export default {
  m: 7,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable8/',
  settle: 200,
  pass: true,
  spot: { z: 36, line: 'mid', v: 18, runIn: 36 },
  variants: [
    { name: 'base' },
    { name: 'nonear', on: hideNamed('town-near'), off: unhook },
    { name: 'nofar', on: hideNamed('town-far'), off: unhook },
    { name: 'novalley', on: hideNamed('valley'), off: unhook },
    { name: 'nochurch', on: hideNamed('church'), off: unhook },
    { name: 'nosets', on: hideNamed('gablefall-pieces'), off: unhook },
    { name: 'nomarket', on: hideNamed('market'), off: unhook },
  ],
};
