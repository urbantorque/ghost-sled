// Holds the safe line with real key presses, then throws a hard carve into a drift and shoots it.
async (page) => {
  await page.goto('http://127.0.0.1:4173/?platform=mock&tier=high&debug&fps&autoride=1&m=0');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  const held = new Set();
  const set = async (keys) => {
    const want = new Set(keys);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const read = () => page.evaluate(() => {
    const a = window.__gs; const r = a.run; if (!r || a.phase !== 'run') return null;
    const s = r.sim.s, c = r.sim.course;
    const look = s.z + 8 + s.speed * 0.3;
    const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.05;
    return { t: r.sim.tick / 60, err, grounded: s.grounded, speed: s.speed, carve: s.carve, drift: s.drifting, room: c.centerX(s.z) - s.x };
  });
  const t0 = Date.now();
  let shot = false;
  while (Date.now() - t0 < 60000 && !shot) {
    const d = await read();
    if (!d) break;
    if (d.t < 6 || !d.grounded || d.speed < 18) {
      await set(d.grounded ? (d.err > 0.05 ? ['ArrowRight'] : d.err < -0.05 ? ['ArrowLeft'] : []) : []);
      await page.waitForTimeout(16);
      continue;
    }
    // Turn toward the middle of the corridor so the drift has room.
    const dirKey = d.room > 0 ? 'ArrowRight' : 'ArrowLeft';
    await set([dirKey, 'Space']);
    const t1 = Date.now();
    while (Date.now() - t1 < 1500) {
      const e = await read();
      if (!e) break;
      if (e.drift && Date.now() - t1 > 450) {
        await page.screenshot({ path: 'shots/crit-02-deep-carve.png' });
        shot = true;
        break;
      }
      await page.waitForTimeout(16);
    }
    await set([]);
    await page.waitForTimeout(1200);
  }
  await set([]);
  return shot ? 'ok' : 'no shot';
}
