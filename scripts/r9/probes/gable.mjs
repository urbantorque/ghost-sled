// Gablefall's carried faults (DECISIONS 402), one config a place: GABLE=opening | evensong | finish | quay.
const which = process.env.GABLE || 'opening';
const holdU = (expr) => `(() => { window.__uHold = setInterval(() => { ${expr} }, 8); })()`;
const unholdU = `(() => { clearInterval(window.__uHold); })()`;
const hideObj = (find) => `(() => { window.__hid = []; ${find}; window.__hidHold = setInterval(() => window.__hid.forEach((o) => (o.visible = false)), 8); })()`;
const unhide = `(() => { clearInterval(window.__hidHold); (window.__hid || []).forEach((o) => (o.visible = true)); window.__hid = []; })()`;
const byName = (n) => `window.__gs.world.scene.traverse((o) => { if (o.name === '${n}') window.__hid.push(o); })`;
const set = (k) => `(() => { window.__gs.world.scene.getObjectByName('terrain').traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uLookDbg) o.material.uniforms.uLookDbg.value = ${k}; }); })()`;
const houseU = `window.__gs.world.scene.getObjectByName('gablefall-world').children.find((m) => m.material && m.material.uniforms && m.material.uniforms.uEmissiveStrength).material.uniforms`;
const out = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gable-' + which + '/';
const cfgs = {
  opening: {
    spot: { z: 26, line: 'mid', v: 18 },
    variants: [
      { name: 'base' },
      { name: 'nomassif', on: hideObj(`window.__hid.push(window.__gs.world.sky.massif.root)`), off: unhide },
      { name: 'novalley', on: hideObj(byName('valley')), off: unhide },
      { name: 'nosun', on: `(() => { const l = window.__gs.world.scene.children.find((o) => o.isDirectionalLight); window.__l = l; l.castShadow = false; })()`, off: `(() => { window.__l.castShadow = true; })()` },
      { name: 'nofar', on: holdU(`window.__gs.world.scene.getObjectByName('terrain').children[0].material.uniforms.uFarK.value.x = 0;`), off: unholdU },
      { name: 'shadowdbg', on: set(21), off: set(0) },
      { name: 'predbg', on: set(26), off: set(0) },
    ],
  },
  evensong: {
    hour: 'alt',
    spot: { z: 600, line: 'mid', v: 22 },
    variants: [
      { name: 'base' },
      { name: 'noemis', on: holdU(`${houseU}.uEmissiveStrength.value = 0;`), off: unholdU },
      { name: 'nolamp', on: holdU(`window.__gs.world.scene.getObjectByName('terrain').children[0].material.uniforms.uLampK.value = 0;`), off: unholdU },
      { name: 'nolocal', on: holdU(`window.__gs.world.scene.getObjectByName('terrain').children[0].material.uniforms.uLocalProps.value = 0;`), off: unholdU },
    ],
  },
  finish: {
    spot: { z: 2758, line: 'mid', v: 22 },
    variants: [{ name: 'base' }, { name: 'nopath', on: set(28), off: set(0) }, { name: 'noaniso', on: set(29), off: set(0) }, { name: 'nomirror', on: set(30), off: set(0) }],
  },
};
export default { m: 7, tier: 'high', query: '&ghosts=0', out, settle: 400, ...cfgs[which] };
