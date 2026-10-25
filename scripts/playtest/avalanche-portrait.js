// Avalanche mirror check at the session's viewport (named portrait, or WxH): brings the event forward, rides the safe line with the keyboard pilot and
// screenshots the mirror and meter at two gaps. Run in the `mob` session (.playwright/mobile.config.json).
async (page) => {
  await page.goto('http://127.0.0.1:4173/?platform=mock&debug&autoride=1&m=0&event=1');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  await page.evaluate(() => { const r = window.__gs.run; r.sim.dyn.triggerZ = r.sim.s.z + 40; });
  const held = new Set();
  const t0 = Date.now();
  const vp = page.viewportSize();
  const tag = vp.width < vp.height ? 'portrait' : `${vp.width}x${vp.height}`;
  const shots = [[44, `shots/r3-lead-av-${tag}-44m.png`], [20, `shots/r3-lead-av-${tag}-20m.png`]];
  const out = [];
  while (Date.now() - t0 < 90000 && shots.length) {
    const d = await page.evaluate(() => {
      const a = window.__gs; const r = a.run; if (!r || a.phase !== 'run') return { done: true };
      const s = r.sim.s, c = r.sim.course, av = r.sim.dyn.avalanche;
      const look = s.z + 8 + s.speed * 0.3;
      const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.05;
      return { keys: s.grounded ? (err > 0.05 ? ['ArrowRight'] : err < -0.05 ? ['ArrowLeft'] : []) : [], phase: av.phase, gap: s.z - av.z, rider: a.world.riderScreen };
    });
    if (d.done) break;
    const want = new Set(d.keys);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    if (d.phase === 2 && d.gap < shots[0][0]) {
      await page.waitForTimeout(200);
      await page.screenshot({ path: shots[0][1] });
      out.push({ gap: Math.round(d.gap), riderY: Math.round(d.rider.y), riderX: Math.round(d.rider.x) });
      shots.shift();
    }
    await page.waitForTimeout(16);
  }
  for (const k of held) await page.keyboard.up(k);
  return JSON.stringify({ out, left: shots.length });
}
