// Critique-loop capture: drives the real game with REAL keyboard input via an autopilot and
// screenshots the moments the brief asks for, plus frame-time stats.
// Run: playwright-cli -s=gs run-code --filename=scripts/playtest/shots.js
async (page) => {
  const BASE = 'http://127.0.0.1:4173/';
  const report = [];
  const shot = async (name) => {
    await page.screenshot({ path: `shots/crit-${name}.png` });
    const stats = await page.evaluate(() => (window.__gs.frameStats ? window.__gs.frameStats() : null));
    report.push({ name, stats });
  };

  const installPilot = () =>
    page.evaluate(() => {
      window.__pilot = { phase: 'ground', airStart: 0, flight: 0, spin: 0 };
      window.__decide = () => {
        const app = window.__gs;
        const r = app.run;
        if (!r) return { keys: [], phase: app.phase };
        const sim = r.sim, s = sim.s, c = sim.course, P = window.__pilot;
        if (s.crashed) return { keys: [], crashed: true, phase: app.phase };
        let ramp = null;
        for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2 && !ramp; k++) {
          for (const rr of c.zones(k).ramps) if (rr.z + rr.len > s.z + 2 && rr.z - s.z < 80) { ramp = rr; break; }
        }
        const keys = [];
        if (s.grounded) {
          P.phase = 'ground';
          let tx = c.safeX(s.z + 10);
          // Tuck in behind the nearest ghost ahead when one is close (drafting).
          const st = app.ghosts.standings(sim.tick, s.z);
          if (st.next && st.next.gap > 2 && st.next.gap < 30) {
            const pose = { x: 0, y: 0, z: 0 };
            const p = {}; if (app.ghosts.pose(st.next.track, sim.tick, p)) tx = p.x;
          }
          if (ramp) tx = ramp.x;
          const look = s.z + 6 + s.speed * 0.3;
          const err = Math.atan2(tx - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * (ramp ? 0 : 0.02);
          if (err > 0.05) keys.push('ArrowRight'); else if (err < -0.05) keys.push('ArrowLeft');
          if (ramp) { const u = (s.z - ramp.z) / ramp.len; if (u > -0.7 && u < 0.85) keys.push('Space'); }
        } else {
          let y = s.y, vy = s.vy, x = s.x, z = s.z, t = 0;
          while (t < 4) { vy -= sim.gravity / 60; y += vy / 60; x += s.vx / 60; z += s.vz / 60; t += 1 / 60; if (y <= c.ground(x, z)) break; }
          if (P.phase !== 'air') { P.phase = 'air'; P.airStart = sim.tick; P.flight = t; P.spin = t > 1.25 ? 1 : 0; }
          const since = (sim.tick - P.airStart) / 60;
          if (P.spin && since < Math.min(0.55, P.flight - 0.6)) keys.push('ArrowRight');
          if (t < 0.12 && t > 0.02) keys.push('Space');
        }
        return { keys, phase: app.phase, air: !s.grounded, speed: s.speed, carve: s.carve, steer: s.steer, perfects: sim.stats.perfects, passed: app.passedThisRun.size, t: sim.tick / 60 };
      };
    });

  // Drive until `until(d)` returns true or the time limit; returns the last decision.
  const drive = async (ms, until) => {
    const held = new Set();
    const t0 = Date.now();
    let d = null;
    while (Date.now() - t0 < ms) {
      d = await page.evaluate(() => window.__decide());
      if (until && (await until(d))) break;
      if (d.crashed) break;
      const want = new Set(d.keys);
      for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
      await page.waitForTimeout(16);
    }
    for (const k of held) await page.keyboard.up(k);
    return d;
  };

  // Returning player: onboarding hints already learned, so the shots show the game, not the tutorial.
  await page.goto(BASE + '?platform=mock&tier=high&debug');
  await page.evaluate(() => { const k = 'ghostsled.save.v1'; const d = JSON.parse(localStorage.getItem(k) || 'null'); if (d) { d.hints = { steer: 3, drift: 3, pop: 3, stomp: 3, draft: 3 }; d.runs = Math.max(d.runs, 5); localStorage.setItem(k, JSON.stringify(d)); } });
  // 1. Title.
  await page.goto(BASE + '?platform=mock&tier=high&debug&fps');
  await page.waitForTimeout(5000);
  await shot('01-title');

  // 2-4. Showcase moments from an expert run (dev demo mode replays a top pool ghost's inputs).
  await page.goto(BASE + '?platform=mock&tier=high&debug&fps&autoride=1&m=0&demo=1');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  let gotCarve = false, gotPass = false, gotPerfect = false, lastPerf = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000 && !(gotCarve && gotPass && gotPerfect)) {
    const d = await page.evaluate(() => { const a = window.__gs; const r = a.run; if (!r) return null; const s = r.sim.s; return { phase: a.phase, air: !s.grounded, speed: s.speed, carve: s.carve, steer: s.steer, drift: s.drifting, perfects: r.sim.stats.perfects, passed: a.passedThisRun.size, alongside: (() => { for (const g of a.ghostPoses.values()) { if (!g || g.done) continue; const dz = g.z - s.z, dx = Math.abs(g.x - s.x); if (dz > 0.6 && dz < 3.5 && dx > 1.1 && dx < 4 && s.speed > g.speed) return true; } return false; })(), t: r.sim.tick / 60 }; });
    if (!d || d.phase !== 'run') break;
    if (!gotCarve && d.t > 4 && !d.air && d.speed > 16 && (d.carve > 0.5 || d.drift)) { gotCarve = true; await shot('02-deep-carve'); }
    // The overtake is the moment just before the pass: a live ghost a couple of metres ahead and
    // alongside while you close on it. Once passed it sits beside the lens, out of the frame.
    if (!gotPass && d.t > 3 && d.alongside) { gotPass = true; await shot('03-ghost-overtake'); }
    if (d.perfects > lastPerf) { lastPerf = d.perfects; if (!gotPerfect) { gotPerfect = true; await page.waitForTimeout(70); await shot('04-perfect-landing'); } }
    await page.waitForTimeout(30);
  }
  // A plain run to the crash for the results screen.
  await page.goto(BASE + '?platform=mock&tier=high&debug&fps&autoride=1&m=0');
  await page.waitForTimeout(2000);
  await installPilot();
  await drive(60000);
  await page.waitForTimeout(3400);
  await shot('09-results');

  // 5-8. Chaos reveal and moods.
  const moods = [
    { id: 2, name: 'lantern' },
    { id: 1, name: 'blizzard' },
    { id: 4, name: 'comet' },
    { id: 3, name: 'glassice' },
  ];
  let first = true;
  for (const m of moods) {
    await page.goto(BASE + `?platform=mock&tier=high&debug&fps&autoride=1&m=${first ? 0 : m.id === 4 ? 2 : 1}&mood=${m.id}`);
    await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
    await page.waitForTimeout(first ? 750 : 2500);
    if (first) await shot('05-chaos-reveal');
    await installPilot();
    await drive(9000);
    await shot(`0${first ? 6 : 7}-mood-${m.name}`);
    first = false;
  }
  return JSON.stringify(report);
}
