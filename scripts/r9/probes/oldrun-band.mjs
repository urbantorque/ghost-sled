// The Old Run's pale band on the near wall (DECISIONS 397): what draws it. Held in the Bend Bells' bend on the glaze.
const LIST = `(() => {
  const w = window.__gs.world;
  const out = [];
  w.scene.children.forEach((o, i) => {
    let n = 0, tris = 0, transparent = 0;
    o.traverse((q) => { if (q.isMesh || q.isPoints || q.isLine) { n++; if (q.material && q.material.transparent) transparent++; } });
    out.push(i + ' ' + (o.name || o.type) + ' vis=' + o.visible + ' meshes=' + n + ' transp=' + transparent + ' ro=' + o.renderOrder);
  });
  return out.join('\\n');
})()`;
const hideIdx = (lo, hi) => `(() => { const w = window.__gs.world; window.__hid = []; w.scene.children.forEach((o, i) => { if (i >= ${lo} && i < ${hi} && o.visible) { o.visible = false; window.__hid.push(o); } }); })()`;
const unhide = `(() => { (window.__hid || []).forEach((o) => (o.visible = true)); window.__hid = []; })()`;
export default {
  m: 5,
  tier: 'high',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/oldrun-band/',
  spot: { z: 228, line: 'glaze', v: 32 },
  variants: [
    { name: 'base', get: LIST },
    { name: 'h0-10', on: hideIdx(0, 10), off: unhide },
    { name: 'h10-20', on: hideIdx(10, 20), off: unhide },
    { name: 'h20-30', on: hideIdx(20, 30), off: unhide },
    { name: 'h30-60', on: hideIdx(30, 60), off: unhide },
    { name: 'h60-200', on: hideIdx(60, 200), off: unhide },
    { name: 'nopost', on: `(() => { const w = window.__gs.world; window.__post = w.post; })()` },
  ],
};
