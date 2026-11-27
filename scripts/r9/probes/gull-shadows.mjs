// Gullhaven's soft figure-like shadows on the snow (DECISIONS 400). No caster's castShadow made a difference (the first
// probe): the snow's relief and the far shadow field, held off in turn, on the shelf at 1,181 m.
const holdU = (expr) => `(() => { window.__uHold = setInterval(() => { ${expr} }, 8); })()`;
const terrU = `window.__gs.world.scene.getObjectByName('terrain').children[0].material.uniforms`;
export default {
  m: 6,
  tier: 'high',
  query: '&ghosts=0',
  out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/gull-shadows/',
  spot: { z: 1181, line: 'mid', v: 28 },
  settle: 500,
  variants: [
    { name: 'base' },
    { name: 'norelief', on: holdU(`${terrU}.uReliefK.value.set(0, 0, 0, 0);`), off: `(() => { clearInterval(window.__uHold); ${terrU}.uReliefK.value.set(0.8, 0.09, 1.2, 1); })()` },
    { name: 'nofar', on: holdU(`${terrU}.uFarK.value.x = 0;`), off: `(() => { clearInterval(window.__uHold); })()` },
    { name: 'base2' },
  ],
};
