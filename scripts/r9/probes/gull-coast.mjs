// Gullhaven's far coast's pale cliff with a fringe of teeth (the critics' frosted cake): the mid-ground, the terrain and
// the panorama hidden in turn just before each render, in the air over the Great Geo.
const hook = (code) => `(() => { const r = window.__gs.world.renderer; if (!r.__hooked) { const o = r.render.bind(r); r.render = (s, c) => { if (window.__before) window.__before(); return o(s, c); }; r.__hooked = true; } window.__before = () => { const w = window.__gs.world; ${code} }; })()`;
const unhook = `(() => { window.__before = null; })()`;
export default {
  m: 6,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-coast/',
  settle: 200,
  spot: { z: 2262, line: 'air', h: 18, v: 31 },
  variants: [
    { name: 'base' },
    { name: 'nomid', on: hook(`w.scene.getObjectByName('midground').visible = false;`), off: `(() => { window.__before = null; window.__gs.world.scene.getObjectByName('midground').visible = true; })()` },
    { name: 'noterrain', on: hook(`w.scene.getObjectByName('terrain').visible = false;`), off: `(() => { window.__before = null; window.__gs.world.scene.getObjectByName('terrain').visible = true; })()` },
    { name: 'nomassif', on: hook(`w.sky.massif.root.visible = false;`), off: `(() => { window.__before = null; window.__gs.world.sky.massif.root.visible = true; })()` },
  ],
};
