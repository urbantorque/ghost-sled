// Gullhaven's marks (DECISIONS 400): the pale posts on the sea under the Great Geo (in the air over it, as the frames'
// d-air), and the soft shadow blobs: the relief's own shadows, or the far shadow field, held off in turn.
const hide = (name) => `(() => { const r = window.__gs.world.scene.getObjectByName('gullhaven-world'); window.__hid = []; r.traverse((o) => { if (o.name === '${name}' && o.visible) { o.visible = false; window.__hid.push(o); } }); window.__hidHold = setInterval(() => window.__hid.forEach((o) => (o.visible = false)), 16); })()`;
const unhide = `(() => { clearInterval(window.__hidHold); (window.__hid || []).forEach((o) => (o.visible = true)); window.__hid = []; })()`;
const holdU = (expr) => `(() => { window.__uHold = setInterval(() => { ${expr} }, 8); })()`;
const unholdU = `(() => { clearInterval(window.__uHold); })()`;
const terrU = `window.__gs.world.scene.getObjectByName('terrain').children[0].material.uniforms`;
export default {
  m: 6,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-marks/',
  spot: { z: 2262, line: 'air', h: 18, v: 31 },
  settle: 400,
  variants: [
    { name: 'base' },
    { name: 'nostacks', on: hide('sea-stacks'), off: unhide },
    { name: 'nosurf', on: hide('surf'), off: unhide },
    { name: 'nodrift', on: hide('spindrift'), off: unhide },
    { name: 'norelief', on: holdU(`${terrU}.uReliefK.value.set(0, 0, 0, 0);`), off: `(() => { clearInterval(window.__uHold); ${terrU}.uReliefK.value.set(0.8, 0.09, 1.2, 1); })()` },
    { name: 'nofar', on: holdU(`${terrU}.uFarK.value.x = 0;`), off: unholdU },
  ],
};
