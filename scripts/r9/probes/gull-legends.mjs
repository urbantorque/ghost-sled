// Gullhaven's legends: what the world's legends module holds while the Herring Lights play.
export default {
  m: 6,
  tier: 'high',
  query: `&ghosts=0&legend=2`,
  out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-legend2/`,
  settle: 200,
  spot: { z: 2560, line: 'mid', v: 30 },
  wait: 6000,
  variants: [{ name: 'state', get: `(() => { const g = window.__gs.world.gullhaven; const L = g.legends; const sim = window.__gs.run.sim; const b = L.boats; const out = { phase: sim.lg.phase, s: sim.s.z, vis: L.root.children.map((o) => o.visible), parent: !!L.root.parent, sea: g.sea }; if (b) { const m = new (b.matrix.constructor)(); b.getMatrixAt(0, m); out.b0 = m.elements.slice(12, 15); out.count = b.count; } return JSON.stringify(out); })()` }],
};
