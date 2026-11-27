// Gullhaven's Beacon Keeper: where the world's legends module has him while he walks.
export default {
  m: 6,
  tier: 'high',
  query: `&ghosts=0&legend=1`,
  out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-keeper/`,
  settle: 200,
  spot: { z: 1110, line: 'mid', v: 26 },
  wait: 6000,
  variants: [{ name: 'state', get: `(() => { const g = window.__gs.world.gullhaven; const L = g.legends; const sim = window.__gs.run.sim; const k = L.keeper; const cam = window.__gs.world.cam.camera.position; return JSON.stringify({ phase: sim.lg.phase, head: sim.lg.head, s: [sim.s.x, sim.s.y, sim.s.z], vis: L.root.children.map((o) => o.visible), kpos: k && [k.position.x, k.position.y, k.position.z], cam: [cam.x, cam.y, cam.z], op: L.figMat.opacity }); })()` }],
};
