// Round 7, the wire lane: The Twelve ridden in the browser. Two kinds of run:
//   duel:  a fresh save rides Pinecrest, which is the first duel a new player can reach. The start line, the
//          rival, the finish, the results' line and what the save holds after are read back.
//   final: a save with all twelve beaten rides Lanternfall: the last race, thirteen ghosts with your own best
//          (twelve without). It is watched from the start line to the results.
// The pilot is a script, not a person. 'line' steers the safe line and never presses the action (an honest
// ride, and a slow one); 'pin' holds the sled on the safe line at a fixed speed by writing the sim's state
// each frame (not a ride at all: it only shows that the game's flow from a win to the save works).
//   playwright-cli -s=r7-wire eval "window.__twCfg = { base: 'http://127.0.0.1:4540/', out: 'C:/.../shots/r7/wire/twelve', kind: 'duel', pilot: 'pin', speed: 40 }"
//   playwright-cli -s=r7-wire --raw run-code --filename=scripts/playtest/wire-twelve.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4540/', out: 'shots/r7/wire/twelve', kind: 'duel', pilot: 'line', speed: 40, tier: 'low', maxS: 400 }, (await page.evaluate(() => window.__twCfg).catch(() => null)) || {});
  const notes = [];
  page.on('pageerror', (e) => notes.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') notes.push(m.type() + ': ' + m.text().slice(0, 200));
  });
  const m = cfg.kind === 'final' ? 4 : 0;
  const tag = `${cfg.kind}-${cfg.pilot}`;
  await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${m}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 90000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${m}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const setup = await page.evaluate((kind) => {
    const g = window.__gs;
    const d = g.save.data;
    if (kind === 'final') d.twelve = { beaten: ['rosa', 'nessa', 'bram', 'pip', 'tavi', 'juno', 'wren', 'mila', 'ivo', 'kaito', 'suki', 'crown'] };
    // Words the band says while the run is young (the duel's start line is a toast).
    window.__said = [];
    const seen = new Set();
    const watch = () => {
      for (const el of document.querySelectorAll('.gs-ui [class*="toast"], .gs-ui [class*="notice"], .gs-ui [class*="banner"]')) {
        const t = (el.textContent || '').trim();
        if (t && !seen.has(t) && window.__said.length < 30) {
          seen.add(t);
          window.__said.push(t.slice(0, 120));
        }
      }
      requestAnimationFrame(watch);
    };
    watch();
    g.audio.unlock();
    g.ride();
    return { twelve: d.twelve ?? null, runs: d.runs };
  }, cfg.kind);
  await page.waitForFunction(() => window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 90000 });
  const start = await page.evaluate(({ pilot, speed }) => {
    const g = window.__gs;
    const sim = g.run.sim;
    const c = sim.course;
    if (pilot === 'line') {
      g.run.input = {
        sample: () => {
          const s = sim.s;
          if (!s.grounded) return { steer: 4, action: false };
          const look = s.z + 4 + s.speed * 0.35;
          const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
          return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false };
        },
      };
    } else {
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && rr.sim === sim && !sim.s.crashed && !sim.finished && window.__gs.phase === 'run') {
          const s = sim.s;
          s.x = c.safeX(s.z);
          s.y = c.ground(s.x, s.z);
          s.vx = ((c.safeX(s.z + 1) - c.safeX(s.z - 1)) * speed) / 2;
          s.vz = speed;
          s.vy = 0;
          s.speed = speed;
          s.grounded = true;
          s.heading = Math.atan2(s.vx, s.vz);
          s.velHeading = s.heading;
          s.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
    }
    // Frames drawn, for a rough rate (never a claim about speed: seven lanes share this machine).
    window.__frames = 0;
    const count = () => { window.__frames++; requestAnimationFrame(count); };
    count();
    return { duel: g.duel ? (g.duel.kind === 'final' ? 'final' : g.duel.rider.name) : null, ghosts: g.ghosts.tracks.length, names: g.ghosts.tracks.map((t) => t.entry?.name ?? t.name ?? '?'), finishZ: Math.round(c.finishZ) };
  }, { pilot: cfg.pilot, speed: cfg.speed });
  const t0 = Date.now();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${cfg.out}/${tag}-0-start.png` });
  const early = await page.evaluate(() => ({ said: window.__said.slice(), ready: window.__gs.ghosts.tracks.filter((t) => t.ready).length, z: Math.round(window.__gs.run.sim.s.z) }));
  let shotMid = false;
  let state = null;
  while (Date.now() - t0 < cfg.maxS * 1000) {
    state = await page.evaluate(() => { const g = window.__gs; return { phase: g.phase, z: g.run ? Math.round(g.run.sim.s.z) : -1, tick: g.run ? g.run.sim.tick : -1, fin: g.run ? g.run.sim.finished : false }; });
    if (!shotMid && state.z > start.finishZ * 0.5) {
      shotMid = true;
      await page.screenshot({ path: `${cfg.out}/${tag}-1-mid.png` });
    }
    if (state.phase !== 'run') break;
    await page.waitForTimeout(1000);
  }
  const frames = await page.evaluate(() => window.__frames);
  const rideS = (Date.now() - t0 + 4500) / 1000;
  await page.screenshot({ path: `${cfg.out}/${tag}-2-end.png` });
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${cfg.out}/${tag}-3-results.png` });
  const end = await page.evaluate(() => {
    const g = window.__gs;
    const sim = g.run?.sim;
    return {
      phase: g.phase,
      finished: sim ? sim.finished : null,
      crashed: sim ? sim.s.crashed : null,
      seconds: sim && sim.finished ? +(sim.s.finishTick / 60).toFixed(2) : null,
      line: document.querySelector('.gs-res-line.is-twelve')?.textContent ?? null,
      twelve: g.save.data.twelve ?? null,
      said: window.__said,
      cues: g.audio.debugCues(),
    };
  });
  return JSON.stringify({ tag, setup, start, early, state, wallS: +rideS.toFixed(1), fps: +(frames / rideS).toFixed(1), end, notes: [...new Set(notes)] });
}
