// Gullhaven's Herring Lights from the air: what joins the boats' lamps "by a wire-like line" (the sixth critic). Shot
// through look-frames.js with one of the fleet's layers off (HIDE=lie, the lamps' light on the swell; HIDE=wake, the
// wakes; HIDE unset, nothing), by turning its material off, which the legend's update never touches.
//   HIDE=lie node scripts/r9/look-run.mjs --script look-frames.js --var __lookCfg --cfg scripts/r9/probes/gull-fleet-wire.mjs
const HIDE = process.env.HIDE || '';
const mat = HIDE === 'lie' ? 'lieMat' : HIDE === 'wake' ? 'wakeMat' : '';
export default {
  base: 'http://127.0.0.1:5044/',
  out: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-fleet-wire/${process.env.SET || 'now'}/`,
  tag: `${HIDE || 'base'}-`,
  m: 6,
  tier: 'high',
  hour: 'day',
  query: '&ghosts=0&legend=2',
  prep: mat
    ? `(() => { const hide = () => { const L = window.__gs && window.__gs.world && window.__gs.world.gullhaven && window.__gs.world.gullhaven.legends; if (L && L.${mat}) L.${mat}.visible = false; requestAnimationFrame(hide); }; hide(); })()`
    : undefined,
  spots: [
    { name: 'fleet-b-lit', z: 2560, line: 'mid', v: 30 },
    { name: 'fleet-c-air', z: 2262, line: 'air', v: 31, h: 18, vy: -1 },
  ],
};
