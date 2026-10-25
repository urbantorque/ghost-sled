// Autopilot play-test with REAL keyboard input: the page reports state, Node presses keys.
// Hunts kickers, pops at the lip, spins in the air, stomps the landing. Screens key moments.
async (page) => {
  await page.evaluate(() => {
    window.__pilot = { phase: 'cruise', target: null, shots: [], log: [] };
    window.__decide = () => {
      const r = window.__gs.run, sim = r.sim, s = sim.s, c = sim.course, P = window.__pilot;
      if (s.crashed) return { keys: [], crashed: true, cause: s.crashCause, z: s.z };
      // Find the next ramp ahead.
      let ramp = null;
      for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2 && !ramp; k++) {
        for (const rr of c.zones(k).ramps) if (rr.z + rr.len > s.z + 2 && rr.z - s.z < 90) { ramp = rr; break; }
      }
      const keys = [];
      let tx = c.safeX(s.z + 12);
      if (s.grounded) {
        if (ramp) tx = ramp.x;
        const look = s.z + 6 + s.speed * 0.3;
        const desired = Math.atan2(tx - s.x, look - s.z);
        const err = desired - s.velHeading;
        if (err > 0.06) keys.push('ArrowRight'); else if (err < -0.06) keys.push('ArrowLeft');
        // Crouch on the approach, release near the lip to pop.
        if (ramp) {
          const u = (s.z - ramp.z) / ramp.len;
          if (u > -0.6 && u < 0.82) keys.push('Space');
        }
        P.phase = 'ground';
      } else {
        // In the air: predict time to landing with a coarse ballistic march.
        let y = s.y, vy = s.vy, x = s.x, z = s.z, t = 0;
        while (t < 4) { vy -= 9.81 / 60; y += vy / 60; x += s.vx / 60; z += s.vz / 60; t += 1 / 60; if (y <= c.ground(x, z)) break; }
        if (P.phase !== 'air') { P.phase = 'air'; P.airStart = sim.tick; P.flight = t; }
        // Spin early if there is time for a full 360, then centre.
        const spinTime = Math.min(0.6, P.flight - 0.55);
        if ((sim.tick - P.airStart) / 60 < spinTime) keys.push('ArrowLeft');
        if (t < 0.11 && t > 0.02) keys.push('Space');
        P.tLand = t;
      }
      return { keys, z: s.z, v: s.speed, air: !s.grounded, tLand: P.tLand };
    };
  });
  const held = new Set();
  const results = [];
  let lastAir = false, shots = 0, landings = [];
  page.on('console', () => {});
  const t0 = Date.now();
  while (Date.now() - t0 < 26000) {
    const d = await page.evaluate(() => window.__decide());
    if (d.crashed) { results.push('crashed ' + d.cause + ' at ' + d.z.toFixed(0)); break; }
    const want = new Set(d.keys);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    if (d.air && !lastAir && shots < 6) { await page.waitForTimeout(250); await page.screenshot({ path: `shots/kick-air-${shots}.png` }); shots++; }
    if (!d.air && lastAir && shots < 12) { await page.waitForTimeout(40); await page.screenshot({ path: `shots/kick-land-${shots}.png` }); shots++; }
    lastAir = d.air;
    await page.waitForTimeout(16);
  }
  for (const k of held) await page.keyboard.up(k);
  const ev = await page.evaluate(() => {
    const r = window.__gs.run; const st = r.sim.stats;
    return { z: r.sim.s.z, score: r.sim.score, perfects: st.perfects, cleans: st.cleans, sketchies: st.sketchies, maxAir: st.maxAirtime, maxSpin: st.maxHalfTurns, crashed: r.sim.s.crashed, cause: r.sim.s.crashCause };
  });
  return JSON.stringify({ results, ev });
}
