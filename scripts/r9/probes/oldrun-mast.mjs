// The Old Run's dotted vertical line in the sky over the Bend Bells' bend (the third and fourth critics): the scene's
// children hidden by ranges just before each render, the sled held there.
const hook = (code) => `(() => { const r = window.__gs.world.renderer; if (!r.__hooked) { const o = r.render.bind(r); r.render = (s, c) => { if (window.__before) window.__before(); return o(s, c); }; r.__hooked = true; } window.__before = () => { const w = window.__gs.world; ${code} }; })()`;
const restore = `(() => { window.__before = null; window.__gs.world.scene.children.forEach((o) => { if (o.__lookHid) { o.visible = true; o.__lookHid = false; } }); })()`;
const hideRange = (lo, hi) => hook(`w.scene.children.forEach((o, i) => { if (i >= ${lo} && i < ${hi} && o.name !== 'terrain' && (o.visible || o.__lookHid)) { o.visible = false; o.__lookHid = true; } });`);
const LIST = `(() => window.__gs.world.scene.children.map((o, i) => i + ':' + (o.name || o.type) + (o.children.length ? '(' + o.children.slice(0, 6).map((q) => q.name || q.type).join(',') + ')' : '')).join(' | '))()`;
export default {
  m: 5,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/oldrun-mast2/',
  settle: 300,
  pass: true,
  spot: { z: 228, line: 'glaze', v: 32 },
  variants: [
    { name: 'base' },
    { name: 'h9', on: hideRange(9, 10), off: restore },
    { name: 'h10-12', on: hideRange(10, 12), off: restore },
    { name: 'h12-15', on: hideRange(12, 15), off: restore },
    { name: 'h15-20', on: hideRange(15, 20), off: restore },
  ],
};
