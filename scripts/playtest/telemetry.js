// Fun telemetry: drives scripted runs at three skill levels and logs the beats per minute (passes,
// duels, named moments, missions mid-run), the time to the first pass, whether the race is still live
// when you crash, and music intensity over time. Every UI and audio call is recorded generically (the
// UI facade's methods are wrapped), so new beats show up without edits here.
//
// The pilot runs inside the page, once per sim tick, as the run's input source (analog steering like
// the fairness test's driver): round trips through page.evaluate were too slow to hold a line.
//   novice: wobbly line, slow hands, lapses, stray action taps, sloppy stomps, no kickers or tricks
//   mid:    drafts, pops kickers, spins long flights, drifts long bends, stomps with timing noise
//   expert: the mid pilot with clean hands: no lapses, tight stomps, more spins
// Run against a preview build: playwright-cli -s=gs run-code --filename=scripts/playtest/telemetry.js
// Set window.__teleCfg = { label, base, plan, maxSeconds } on the current page first to change the
// plan. Returns the full result as JSON.
async (page) => {
  const defaults = {
    label: 'run',
    plan: [
      { skill: 'novice', runs: 4, fresh: true },
      { skill: 'mid', runs: 3, fresh: false },
      { skill: 'expert', runs: 2, fresh: true },
    ],
    maxSeconds: 180,
  };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__teleCfg).catch(() => null)) || {}) };
  const BASE = cfg.base || 'http://127.0.0.1:4173/';

  const installPilot = (skill, seed) =>
    page.evaluate(({ skill, seed }) => {
      let a = seed >>> 0;
      const rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const app = window.__gs;
      const tele = { calls: [], intensity: [], live: [], crash: null, firstPassAt: null, skill };
      window.__tele = tele;
      const now = () => (app.run ? app.run.sim.tick / 60 : -1);
      const SKIP = new Set(['constructor', 'updateHud', 'occluders', 'mirrorRect', 'setRiderScreen', 'touchVisual', 'setLoading', 'setMirror', 'markOcc', 'measureOcc', 'syncInert', 'syncHint', 'setMode', 'performed']);
      const wrap = (obj, name, tag) => {
        const f = obj[name];
        if (typeof f !== 'function' || f.__w) return;
        const w = function (...args) {
          try {
            let s = '';
            try { s = JSON.stringify(args); } catch { s = String(args[0]); }
            tele.calls.push({ t: +now().toFixed(2), m: `${tag}.${name}`, a: s.length > 400 ? s.slice(0, 400) : s });
          } catch {}
          return f.apply(this, args);
        };
        w.__w = 1;
        obj[name] = w;
      };
      for (let p = Object.getPrototypeOf(app.ui); p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const k of Object.getOwnPropertyNames(p)) if (!SKIP.has(k)) wrap(app.ui, k, 'ui');
      }
      wrap(app.audio, 'ui', 'audio');
      if (typeof app.audio.beats === 'function') wrap(app.audio, 'beats', 'audio');
      const up = app.audio.update;
      app.audio.update = function (f, dt) {
        if (app.run && app.phase === 'run') {
          const T = app.run.sim.tick / 60;
          if (tele.lastI === undefined || T - tele.lastI >= 0.5) {
            tele.lastI = T;
            tele.intensity.push([+T.toFixed(1), +(+f.intensity).toFixed(3), +f.speed.toFixed(1), f.comboMult, +(app.run.sim.s.flow ?? 0).toFixed(2)]);
          }
        }
        return up.call(this, f, dt);
      };

      const run = app.run;
      const sim = run.sim;
      const c = sim.course;
      const P = { airStart: -1, flight: 0, spin: 0, stompTry: false, stompBias: 0, away: 0, tap: 0, drift: 0, wob: rnd() * 6.28, lvl: 4, nextThink: 0, wasAir: false };
      const timeToLand = (s) => {
        let y = s.y, vy = s.vy, x = s.x, z = s.z, t = 0;
        while (t < 4) { vy -= sim.gravity / 60; y += vy / 60; x += s.vx / 60; z += s.vz / 60; t += 1 / 60; if (y <= c.ground(x, z)) break; }
        return { t, x, z };
      };
      const steerTo = (s, target, gain, lateralGain) => {
        const look = s.z + 4 + s.speed * 0.35;
        const desired = Math.atan2(target(look) - s.x, look - s.z);
        const err = desired - s.velHeading + (c.safeX(s.z) - s.x) * lateralGain;
        return Math.max(0, Math.min(8, Math.round(4 + err * gain)));
      };
      const nextRamp = (s) => {
        for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2; k++) {
          for (const rr of c.zones(k).ramps) {
            if (rr.z + rr.len > s.z + 1 && rr.z - s.z < 70) {
              // Kickers near the bank are skipped: their flight carries into the treeline.
              if (Math.abs(rr.x - c.centerX(rr.z)) > c.halfWidth(rr.z) - 4 || Math.abs(rr.x - c.safeX(rr.z + rr.len)) > 2.5) return null;
              return rr;
            }
          }
        }
        return null;
      };
      const pilot = () => {
        const s = sim.s;
        const T = sim.tick / 60;
        if (s.crashed) return { steer: 4, action: false };
        if (!s.grounded) {
          if (!P.wasAir) {
            P.wasAir = true;
            P.airStart = sim.tick;
            const land = timeToLand(s);
            P.flight = land.t;
            const room = c.halfWidth(land.z) - Math.abs(land.x - c.centerX(land.z));
            // Spin toward the safe line (air steering nudges the sled sideways), and only near it.
            const off = land.x - c.safeX(land.z);
            P.spin = skill !== 'novice' && land.t > 1.45 && room > 4 && Math.abs(off) < 1.5 && rnd() < (skill === 'expert' ? 0.95 : 0.7) ? (off > 0 ? -1 : 1) : 0;
            P.stompTry = skill === 'mid' || skill === 'expert' ? true : skill === 'novice' && rnd() < 0.4;
            P.stompBias = (rnd() - 0.5) * (skill === 'expert' ? 0.05 : skill === 'mid' ? 0.16 : 0.3);
          }
          const land = timeToLand(s);
          let steer = 4;
          // Spin to a whole turn: 360, or 720 on a long flight for the expert. Steering stops once the
          // spin's own deceleration (22 rad/s^2) would carry it the rest of the way.
          let goal = (skill === 'expert' && P.flight > 2.4 ? 4 : 2) * Math.PI;
          // Not enough air left for the 720: settle for the 360.
          if (goal > 2 * Math.PI && land.t < (goal - Math.abs(s.airYaw)) / 9 + 0.3) goal = 2 * Math.PI;
          const coast = (s.spinRate * s.spinRate) / (2 * 22);
          if (P.spin && Math.abs(s.airYaw) + coast < goal - 0.12 && land.t > 0.2) steer = P.spin > 0 ? 8 : 0;
          else if (skill === 'mid' || skill === 'expert') {
            // Air control toward the safe line at the landing spot (trees stand off it).
            const off = land.x - c.safeX(land.z);
            if (Math.abs(off) > 0.8) steer = off > 0 ? 2 : 6;
          }
          const w = land.t - P.stompBias;
          return { steer, action: P.stompTry && w < 0.11 && w > 0.01 };
        }
        P.wasAir = false;
        // The fairness test's driver, as a control for the harness itself.
        if (skill === 'line') return { steer: steerTo(s, (z) => c.safeX(z), 14, 0.08), action: false };
        if (skill === 'novice') {
          // Slow hands: the steer level updates every 0.08 to 0.16 s.
          if (P.away > T) return { steer: 4, action: false };
          if (rnd() < 1 / (60 * 30)) { P.away = T + 0.5 + rnd() * 0.6; return { steer: 4, action: false }; }
          if (T >= P.nextThink) {
            P.nextThink = T + 0.08 + rnd() * 0.08;
            const wob = 0.45 * Math.sin(T * 0.7 + P.wob) + 0.25 * Math.sin(T * 1.9 + P.wob * 2);
            P.lvl = steerTo(s, (z) => c.safeX(z) + wob, 10, 0.06);
          }
          if (P.tap <= T && rnd() < 1 / (60 * 8)) P.tap = T + 0.3 + rnd() * 0.4;
          return { steer: P.lvl, action: P.tap > T };
        }
        // mid
        if (P.away > T) return { steer: 4, action: false };
        if (skill === 'mid' && rnd() < 1 / (60 * 70)) { P.away = T + 0.4 + rnd() * 0.4; return { steer: 4, action: false }; }
        const ramp = nextRamp(s);
        let target = (z) => c.safeX(z);
        const st = app.ghosts.standings(sim.tick, s.z);
        if (!ramp && st.next && st.next.gap > 2 && st.next.gap < 30) {
          const p = {};
          if (app.ghosts.pose(st.next.track, sim.tick, p) && Math.abs(p.x - c.safeX(p.z)) < 1.8) target = () => p.x;
        }
        if (ramp) target = () => ramp.x;
        const bend = c.safeX(s.z + 24) - c.safeX(s.z + 4);
        const room = c.halfWidth(s.z) - Math.abs(s.x - c.centerX(s.z));
        if (!ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) P.drift = T + 0.3 + rnd() * 0.25;
        if (P.drift > T && (room < 4 || Math.abs(s.x - c.safeX(s.z)) > 0.8)) P.drift = T;
        if (P.drift > T) return { steer: bend > 0 ? 8 : 0, action: true };
        // (A negative value is a cooldown: no new drift until that time.)
        if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
        if (P.drift < 0 && T > -P.drift) P.drift = 0;
        const lvl = steerTo(s, target, 14, ramp ? 0 : 0.08);
        let action = false;
        if (ramp) { const u = (s.z - ramp.z) / ramp.len; action = u > -0.7 && u < 0.85; }
        return { steer: lvl, action };
      };
      tele.trace = [];
      run.input = { sample: () => { const o = pilot(); const s = sim.s; tele.trace.push([sim.tick, +s.z.toFixed(1), +s.x.toFixed(2), s.grounded ? 1 : 0, +s.airYaw.toFixed(2), +s.airPitch.toFixed(2), o.steer, o.action ? 1 : 0, +(s.y - c.ground(s.x, s.z)).toFixed(2)]); if (tele.trace.length > 200) tele.trace.shift(); return o; } };

      // Race-live samples every 0.25 s and the crash snapshot, polled from the node side.
      window.__poll = () => {
        const r = app.run;
        if (!r) return { phase: app.phase };
        const s = r.sim.s;
        const T = r.sim.tick / 60;
        const ready = app.ghosts.tracks.filter((t) => t.ready);
        if (tele.firstPassAt === null && app.passedThisRun && app.passedThisRun.size > 0) tele.firstPassAt = +T.toFixed(2);
        if (s.crashed && !tele.crash) {
          const ghosts = ready.map((t) => {
            const end = t.crashTick >= 0 ? t.crashTick : t.ticks;
            return { name: t.entry.name, kind: t.entry.kind, gap: +(app.ghosts.zAt(t, r.sim.tick) - s.z).toFixed(1), riding: r.sim.tick < end, dist: Math.round(t.distance) };
          });
          tele.crash = { t: +T.toFixed(2), distance: Math.round(r.sim.distance), score: r.sim.score, cause: s.crashCause, passed: app.passedThisRun.size, ghosts, liveNear: ghosts.filter((g) => g.riding && Math.abs(g.gap) <= 40).length, riding: ghosts.filter((g) => g.riding).length };
        }
        return { phase: app.phase, crashed: s.crashed, t: T };
      };
      const sampleLive = () => {
        const r = app.run;
        if (!r || r.sim.s.crashed || r !== run) return;
        const T = r.sim.tick / 60;
        let near = 0, riding = 0, nearest = 1e9;
        for (const t of app.ghosts.tracks) {
          if (!t.ready) continue;
          const end = t.crashTick >= 0 ? t.crashTick : t.ticks;
          if (r.sim.tick >= end) continue;
          riding++;
          const gap = app.ghosts.zAt(t, r.sim.tick) - r.sim.s.z;
          if (Math.abs(gap) <= 40) near++;
          nearest = Math.min(nearest, Math.abs(gap));
        }
        tele.live.push([+T.toFixed(2), near, riding, nearest === 1e9 ? -1 : +nearest.toFixed(1)]);
        if (tele.firstPassAt === null && app.passedThisRun && app.passedThisRun.size > 0) tele.firstPassAt = +T.toFixed(2);
      };
      tele.liveTimer = setInterval(sampleLive, 250);
    }, { skill, seed });

  const drive = async (maxMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const d = await page.evaluate(() => window.__poll());
      if (d.crashed) break;
      if (d.t > cfg.maxSeconds) break;
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => clearInterval(window.__tele.liveTimer));
    await page.waitForTimeout(1600);
  };

  const summarize = (tele, extra) => {
    const runT = tele.crash ? tele.crash.t : tele.intensity.length ? tele.intensity[tele.intensity.length - 1][0] : 0;
    const mins = Math.max(1 / 60, runT / 60);
    const inRun = tele.calls.filter((c) => c.t >= 0 && c.t <= runT + 0.05);
    const count = (re) => inRun.filter((c) => re.test(c.m)).length;
    const passesMine = inRun.filter((c) => c.m === 'ui.ghostPass' && /,true\]$/.test(c.a)).length;
    const passedBy = inRun.filter((c) => c.m === 'ui.ghostPass' && /,false\]$/.test(c.a)).length;
    const styles = inRun.filter((c) => c.m === 'ui.popStyle');
    const big = styles.filter((c) => /"(big|perfect)"\]$/.test(c.a)).length;
    const beatTypes = {};
    for (const c of inRun.filter((c) => /beats$/.test(c.m))) for (const m of c.a.matchAll(/"type":"([a-zA-Z]+)"/g)) beatTypes[m[1]] = (beatTypes[m[1]] || 0) + 1;
    const named = big + count(/^ui\.(comboBank|toast|warn)$/) + passesMine;
    const missionsMid = inRun.filter((c) => /mission/i.test(c.m) || (c.m === 'ui.toast' && /mission/i.test(c.a))).length;
    const I = tele.intensity;
    const meanI = I.length ? I.reduce((s, v) => s + v[1], 0) / I.length : 0;
    const iAt = (sec) => { const v = I.find((x) => x[0] >= sec); return v ? v[1] : null; };
    const firstNamed = inRun.find((c) => (c.m === 'ui.popStyle' && /"(big|perfect)"\]$/.test(c.a)) || c.m === 'ui.comboBank' || (c.m === 'ui.ghostPass' && /,true\]$/.test(c.a)));
    const liveFrac = tele.live.length ? tele.live.filter((l) => l[1] > 0).length / tele.live.length : 0;
    return {
      ...extra,
      seconds: +runT.toFixed(1),
      distance: tele.crash ? tele.crash.distance : null,
      score: tele.crash ? tele.crash.score : null,
      cause: tele.crash ? tele.crash.cause : 'timeout',
      passes: passesMine,
      passedBy,
      firstPassAt: tele.firstPassAt,
      firstNamedAt: firstNamed ? firstNamed.t : null,
      namedMoments: named,
      namedPerMin: +(named / mins).toFixed(2),
      passesPerMin: +(passesMine / mins).toFixed(2),
      banks: count(/^ui\.comboBank$/),
      warns: count(/^ui\.warn$/),
      toasts: count(/^ui\.toast$/),
      missionsMidRun: missionsMid,
      beatTypes,
      raceLiveAtCrash: tele.crash ? tele.crash.liveNear > 0 : null,
      liveNearAtCrash: tele.crash ? tele.crash.liveNear : null,
      ridingAtCrash: tele.crash ? tele.crash.riding : null,
      raceLiveFraction: +liveFrac.toFixed(2),
      intensity: { mean: +meanI.toFixed(3), at10: iAt(10), at30: iAt(30), at60: iAt(60), max: I.length ? Math.max(...I.map((v) => v[1])) : 0 },
      crashField: tele.crash ? tele.crash.ghosts : null,
      calls: inRun.filter((c) => !/^audio\.ui$/.test(c.m)).slice(0, 400),
    };
  };

  const out = [];
  let seed = 1234;
  for (const step of cfg.plan) {
    for (let i = 0; i < step.runs; i++) {
      const fresh = step.fresh || i === 0;
      if (fresh) {
        await page.goto(BASE + '?platform=mock&debug&tier=medium');
        await page.evaluate(() => localStorage.clear());
      }
      const demo = step.demo ? `&demo=${step.demo}` : '';
      if (fresh) {
        await page.goto(BASE + `?platform=mock&debug&tier=medium&m=${step.m ?? 0}&autoride=1${demo}`);
        await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
      } else {
        await page.evaluate(() => window.__gs.runAgain());
        await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 30000 });
      }
      await installPilot(step.skill, seed++);
      await drive((cfg.maxSeconds + 40) * 1000);
      const tele = await page.evaluate(() => window.__tele);
      out.push(summarize(tele, { skill: step.skill, run: i + 1 }));
      out[out.length - 1].intensitySeries = tele.intensity.filter((_, k) => k % 4 === 0).map((v) => [v[0], v[1], v[4]]);
    }
  }
  const agg = {};
  for (const r of out) {
    const g = (agg[r.skill] = agg[r.skill] || { runs: 0, seconds: 0, passesPerMin: 0, namedPerMin: 0, live: 0, liveFrac: 0, firstPass: [], firstNamed: [], meanI: 0, missionsMid: 0 });
    g.runs++;
    g.seconds += r.seconds;
    g.passesPerMin += r.passesPerMin;
    g.namedPerMin += r.namedPerMin;
    g.live += r.raceLiveAtCrash ? 1 : 0;
    g.liveFrac += r.raceLiveFraction;
    if (r.firstPassAt !== null) g.firstPass.push(r.firstPassAt);
    if (r.firstNamedAt !== null) g.firstNamed.push(r.firstNamedAt);
    g.meanI += r.intensity.mean;
    g.missionsMid += r.missionsMidRun;
  }
  for (const k of Object.keys(agg)) {
    const g = agg[k];
    agg[k] = {
      runs: g.runs,
      meanSeconds: +(g.seconds / g.runs).toFixed(1),
      passesPerMin: +(g.passesPerMin / g.runs).toFixed(2),
      namedPerMin: +(g.namedPerMin / g.runs).toFixed(2),
      raceLiveAtCrash: `${g.live}/${g.runs}`,
      raceLiveFraction: +(g.liveFrac / g.runs).toFixed(2),
      firstPassAt: g.firstPass.length ? +(g.firstPass.reduce((s, v) => s + v, 0) / g.firstPass.length).toFixed(1) : null,
      firstPassRuns: `${g.firstPass.length}/${g.runs}`,
      firstNamedAt: g.firstNamed.length ? +(g.firstNamed.reduce((s, v) => s + v, 0) / g.firstNamed.length).toFixed(1) : null,
      meanIntensity: +(g.meanI / g.runs).toFixed(3),
      missionsMidRun: g.missionsMid,
    };
  }
  return JSON.stringify({ label: cfg.label, agg, runs: out });
}
