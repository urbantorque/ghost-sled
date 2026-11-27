// Round 9, the wiring lane: the title reel over time on one mountain and fixture: a frame every `every` ms, with the
// reel's tick, its hero and duel partner, where the hero is (z, x, height over the ground, in the air or not) and where
// the lens is. Staged by script; the console is read.
//   playwright-cli -s=r9-wiring eval "window.__wpr = { save: 'mid-50', m: 6, n: 10, every: 1500 }"
//   playwright-cli -s=r9-wiring --raw run-code --filename=scripts/r9/wiring-reelprobe.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:5030/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/wiring/reel/', tag: 'desk', save: 'mid-50', m: 6, n: 10, every: 1500, first: 2500 },
    (await page.evaluate(() => window.__wpr).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${c.save}&m=${c.m}`, { timeout: 240000 });
  await page.waitForSelector('.gs9-t-aim', { timeout: 180000 });
  await page.waitForTimeout(c.first);
  const rows = [];
  for (let k = 0; k < c.n; k++) {
    const r = await page.evaluate(() => {
      const gs = window.__gs;
      const tracks = gs.ghosts.tracks;
      const hero = tracks.find((t) => t.entry.id === gs.attract.focus);
      const p = {};
      const ok = hero ? gs.ghosts.pose(hero, gs.attract.tick, p) : false;
      const cc = gs.world.course;
      const cam = gs.world.cam && gs.world.cam.camera ? gs.world.cam.camera.position : null;
      return {
        tick: Math.round(gs.attract.tick),
        reel: { from: Math.round(gs.reel.from), to: Math.round(gs.reel.to), end: Math.round(gs.reel.end), staged: gs.reel.staged },
        hero: hero ? hero.entry.name : null,
        ok,
        z: p.z !== undefined ? Math.round(p.z) : null,
        x: p.x !== undefined ? Math.round(p.x * 10) / 10 : null,
        over: p.y !== undefined ? Math.round((p.y - cc.ground(p.x, p.z)) * 10) / 10 : null,
        grounded: p.grounded,
        done: p.done,
        cam: cam ? [Math.round(cam.x), Math.round(cam.y), Math.round(cam.z)] : null,
        field: tracks.map((t) => t.entry.name),
      };
    });
    await page.screenshot({ path: `${c.out}${c.tag}-${c.save}-m${c.m}-${String(k).padStart(2, '0')}.png` });
    rows.push(r);
    await page.waitForTimeout(c.every);
  }
  return JSON.stringify({ rows, errors }, null, 1);
}
