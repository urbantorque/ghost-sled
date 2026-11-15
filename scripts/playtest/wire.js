// Round 7, the wire lane: a legend ridden with everything that is wired to it. For each run named the sled
// is put on the safe line before the legend is said and ridden through it at a pinned speed, twice: once
// with the legend look taken out of the lens (`off`) and once as shipped (`on`), a frame at each of six
// places. With each frame: the card on screen, the lens's turn and lift, the cues the audio has played, and
// any AudioParam set outside its range (with the stack that set it). Console errors and warnings are kept.
//   playwright-cli -s=r7-wire open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=r7-wire eval "window.__wireCfg = { base: 'http://127.0.0.1:4540/', out: 'C:/.../shots/r7/wire/legend', runs: [{ m: 2, legend: 1 }] }"
//   playwright-cli -s=r7-wire --raw run-code --filename=scripts/playtest/wire.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4540/', out: 'shots/r7/wire/legend', tier: 'high', speed: 34, pilot: 'pin', extra: '', passes: ['off', 'on'], runs: [{ m: 2, legend: 1 }] }, (await page.evaluate(() => window.__wireCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const notes = [];
  page.on('pageerror', (e) => notes.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') notes.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.addInitScript(() => {
    // Any AudioParam handed a value past what a 48 kHz context can hold, and who handed it.
    window.__clamps = [];
    const note = (how, v) => {
      if (typeof v === 'number' && Math.abs(v) > 20000 && window.__clamps.length < 12) window.__clamps.push({ how, v: Math.round(v), stack: String(new Error().stack).split('\n').slice(2, 8).join(' | ') });
    };
    const P = window.AudioParam && window.AudioParam.prototype;
    if (!P) return;
    const d = Object.getOwnPropertyDescriptor(P, 'value');
    Object.defineProperty(P, 'value', { get: d.get, set(v) { note('value', v); d.set.call(this, v); }, configurable: true });
    for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
      const f = P[k];
      P[k] = function (v, ...rest) { note(k, v); return f.call(this, v, ...rest); };
    }
  });
  const log = [];
  for (const run of cfg.runs) {
    for (const pass of cfg.passes) {
      try {
      await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${run.m}&autoride=1&legend=${run.legend}${cfg.extra}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
      await page.evaluate(() => window.__gs.audio.unlock());
      await page.waitForTimeout(1500);
      const lg = await page.evaluate(({ speed, off, pilot }) => {
        const g = window.__gs;
        const sim = g.run.sim;
        const l = sim.legend;
        if (!l) return null;
        if (off) {
          g.world.marquee.legendShot = () => null;
          g.world.lantern.legendShot = () => null;
        }
        sim.s.z = l.z0 - 300;
        window.__pinSpeed = pilot === 'line' ? 0 : speed;
        if (pilot === 'line') {
          // A real ride from here: the safe line steered, the action never pressed, nothing written to the sim.
          const c = sim.course;
          sim.s.y = c.ground(sim.s.x, sim.s.z);
          g.run.input = { sample: () => { const s = sim.s; if (!s.grounded) return { steer: 4, action: false }; const look = s.z + 4 + s.speed * 0.35; const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08; return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false }; } };
        }
        // Where the legend's card is first and last on screen (metres down the run), and what it says.
        window.__card = { from: null, to: null, text: null };
        const watch = () => {
          const el = document.querySelector('.gs-legend');
          const rr = window.__gs.run;
          if (el && rr) {
            const z = Math.round(rr.sim.s.z);
            if (window.__card.from === null) window.__card.from = z;
            window.__card.to = z;
            window.__card.text = el.textContent;
          }
          requestAnimationFrame(watch);
        };
        watch();
        const pin = () => {
          const rr = window.__gs.run;
          if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
            const s = rr.sim.s;
            const cc = rr.sim.course;
            const v = window.__pinSpeed;
            s.x = cc.safeX(s.z);
            s.y = cc.ground(s.x, s.z);
            s.vx = ((cc.safeX(s.z + 1) - cc.safeX(s.z - 1)) * v) / 2;
            s.vz = v;
            s.vy = 0;
            s.speed = v;
            s.grounded = true;
            s.heading = Math.atan2(s.vx, s.vz);
            s.velHeading = s.heading;
            s.invuln = 10;
          }
          requestAnimationFrame(pin);
        };
        pin();
        return { key: l.key, name: l.name, kind: l.kind, z0: Math.round(l.z0), z1: Math.round(l.z1), side: l.side };
      }, { speed: cfg.speed, off: pass === 'off', pilot: cfg.pilot });
      if (!lg) {
        log.push({ run, none: true });
        break;
      }
      const tag = `${dev}-${lg.key}-${pass}${cfg.pilot === 'line' ? '-ride' : ''}`;
      const len = lg.z1 - lg.z0;
      const at = [lg.z0 - 150, lg.z0 - 40, lg.z0 + len * 0.25, lg.z0 + len * 0.5, lg.z0 + len * 0.8, lg.z1 + 70];
      for (let i = 0; i < at.length; i++) {
        await page.waitForFunction((z) => !window.__gs.run || window.__gs.run.sim.s.z >= z || window.__gs.phase !== 'run', at[i], { timeout: 60000, polling: 16 });
        const st = await page.evaluate(() => {
          const g = window.__gs;
          if (!g.run || g.phase !== 'run') return null;
          const sim = g.run.sim;
          const look = g.world.cam.legendLook;
          const shot = g.world.marquee.legendShot() || g.world.lantern.legendShot();
          const rs = g.world.riderScreen;
          return {
            z: Math.round(sim.s.z),
            phase: sim.lg.phase,
            card: document.querySelector('.gs-legend')?.textContent ?? null,
            look: { yawDeg: +((look.yaw * 180) / Math.PI).toFixed(2), lift: +look.lift.toFixed(2) },
            peak: shot ? +shot.peak.toFixed(2) : null,
            rider: rs ? { x: +(rs.x / innerWidth).toFixed(3), y: +(rs.y / innerHeight).toFixed(3) } : null,
            cues: g.audio.debugCues(),
          };
        });
        if (!st) break;
        await page.screenshot({ path: `${cfg.out}/${tag}-${i}.png` });
        log.push({ shot: `${tag}-${i}`, ...st });
      }
      await page.evaluate(() => { window.__pinSpeed = 0; });
      log.push({ pass: tag, legend: lg, card: await page.evaluate(() => window.__card) });
      // (Only an oscillator's frequency is held to the context's range: a gain may be any size.)
      const clamps = (await page.evaluate(() => window.__clamps)).filter((c) => c.how === 'value');
      if (clamps.length) log.push({ clamps });
      } catch (e) {
        log.push({ run, pass, failed: String(e).slice(0, 160) });
      }
    }
  }
  return log.map((l) => JSON.stringify(l)).join(' ;; ') + ' ;; notes: ' + JSON.stringify([...new Set(notes)]);
}
