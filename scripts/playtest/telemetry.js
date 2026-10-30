// Fun telemetry: drives scripted runs at five skill levels and logs the beats per minute (passes,
// duels, named moments, missions mid-run), the time to the first pass, whether the race is still live
// when you crash, music intensity over time, and the fun-pass metrics (flow, drift tiers, near-miss
// grades, kickers, stomp streaks, hints, mission pops, the field, the rival pill, banner overlaps).
// Every UI and audio call is recorded generically (the UI facade's methods are wrapped), so new beats
// show up without edits here.
//
// USAGE
//   Build and serve the game, open a headless session, then run this file:
//     npx vite build
//     npx vite preview --port 4206 --host 127.0.0.1 --strictPort
//     playwright-cli -s=tele open --config=.playwright/cli-headless.config.json
//     playwright-cli -s=tele run-code --filename=scripts/playtest/telemetry.js
//   The result (one JSON string) prints under "### Result". To change the plan, set window.__teleCfg on
//   the current page first (any page of the build; a goto to the build, then an eval):
//     playwright-cli -s=tele goto http://127.0.0.1:4206/
//     playwright-cli -s=tele eval "window.__teleCfg = { base: 'http://127.0.0.1:4206/', plan: [{ skill: 'stunt', runs: 3, fresh: true, m: 1 }] }"
//
// CONFIG (window.__teleCfg; every field optional)
//   label       name echoed in the output                                    default 'run'
//   base        build URL, with the trailing slash                           default http://127.0.0.1:4173/
//   plan        list of steps (below)                     default 4 novice, 3 mid, 2 expert, 3 stunt
//   maxSeconds  stop a run that is still riding after this many sim seconds  default 180
//   seed        first pilot seed; every run takes the next one               default 1234
//   lean        true drops the per-run call and beat logs (calls, beatLog) from the output
// PLAN STEP
//   { skill, runs, fresh, m, tier, mood, event, demo }
//   skill  'novice' | 'mid' | 'expert' | 'line' | 'stunt'
//   runs   how many runs this step rides
//   fresh  true: clear the save and reload before every run of the step. false: only the first run of
//          the step clears the save and loads the page; the rest go through Run Again (window.__gs.runAgain)
//   m      mountain 0..3 (default 0); tier 'low' | 'medium' | 'high' (default medium)
//   mood   1..6, event 1..4 (dev overrides, applied on a page load only), demo N (dev replay)
//
// PILOTS
// The pilot runs inside the page, once per sim tick, as the run's input source (analog steering like
// the fairness test's driver): round trips through page.evaluate were too slow to hold a line.
// novice, mid, expert and line are frozen (before/after comparability across builds):
//   novice: wobbly line, slow hands, lapses, stray action taps, sloppy stomps, no kickers or tricks
//   mid:    drafts, spins long flights, short drifts on long bends, stomps with timing noise (its kicker
//           filter wants a ramp within 2.5 m of the safe line, which the course never places)
//   expert: the mid pilot with clean hands: no lapses, tight stomps, more spins
//   line:   the fairness test's driver, holding the safe line
// stunt is a skilled, human-like rider who reaches the moments the fun pass added (makeStuntPilot below):
//   it aims at kickers inside the corridor (boosted pop at the top), holds drifts of 0.6 to 2.0 s on long
//   bends for tier 1 to 3, grazes an obstacle at 0.3 to 0.6 m now and then, spins or flips long flights,
//   stomps its landings and drafts and slingshots ghosts. It checks a move before committing to it by
//   riding a copy of the run's own sim forward (the sim is deterministic), so its crashes come from a
//   human error budget (misjudged air, blind grazes and kickers, mistimed stomps), not from bad driving:
//   runs last about 40 to 150 s.
//
// OUTPUT: JSON { label, agg, runs }.
//   agg[skill]: the per-pilot means and counts (meanSeconds, passesPerMin, namedPerMin, raceLiveAtCrash,
//     raceLiveStrict, ...) plus agg[skill].fun, the fun-pass summary over the runs.
//   runs[i]: one run. The original fields keep their names and meanings (seconds, distance, score, cause,
//     gifts, passBonus, passes, passedBy, firstPassAt, firstNamedAt, namedMoments, namedPerMin,
//     passesPerMin, banks, warns, toasts, missionsMidRun, raceLiveAtCrash, raceLiveStrict, liveNearAtCrash,
//     ridingAtCrash, raceLiveFraction, intensity, crashField, calls, beatLog, intensitySeries, and on the
//     newer build namedAll, namedAllPerMin, namedKindsMin1, beatTypes). runs[i].fun holds the fun-pass
//     metrics; a metric the build cannot report is 'n/a' (the baseline build has no director or beats).
//   fun fields: flow { maxShown, maxSim, in, snuff }, drift { sim: releases by tier from the sim's own
//     events, beats: driftRelease beats by tier }, nearMiss { sim, gaps, simGrade, beats }, kickers
//     { hit, boostPops }, drafts { seconds, slingshots }, landings, tricks, stompStreakPeak, hints
//     (showings by kind), missions { met,
//     popped, dropped, delays, list }, unlockPopAt, fieldGoneAt (sim s from which no riding ghost is ahead
//     within 150 m; null while one still is at the crash), aheadAt30 / aheadAt60 ({ riding, within150 }
//     ghosts ahead), rivalPill { ticks, done, far, frac } (ticks where the rival pill names a done ghost
//     or one more than 150 m away), live { strict, lax }, firstShownPassAt, firstAnyPassAt, passWords
//     { shown, muted }, banners { samples, two, overRow } (100 ms DOM samples with two banners drawn at
//     once, or a banner drawn over the race row), pilot (the stunt pilot's own counters).
async (page) => {
  const defaults = {
    label: 'run',
    plan: [
      { skill: 'novice', runs: 4, fresh: true },
      { skill: 'mid', runs: 3, fresh: false },
      { skill: 'expert', runs: 2, fresh: true },
      { skill: 'stunt', runs: 3, fresh: true },
    ],
    maxSeconds: 180,
  };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__teleCfg).catch(() => null)) || {}) };
  const BASE = cfg.base || 'http://127.0.0.1:4173/';

  /* STUNT:BEGIN */
  // The stunt pilot. makeStuntPilot(sim, opts) returns { sample, stats }: sample() is called once per sim
  // tick, before the step, and returns { steer: 0..8 (4 = centre), action }. It reads only the sim and
  // its course (plus opts.ghosts for drafting), so it runs the same in the page and in node
  // (scripts/playtest/stunt-sim.ts). Its randomness is a seeded generator: a seed and a course make the
  // same run. opts: { seed, ghosts(tick, x, z) -> { x, z } | null (the ghost ahead to draft),
  // draft(tick, x, y, z) -> bool (the run's draft probe, for the look-ahead), err (the error budget below) }.
  function makeStuntPilot(sim, opts) {
    opts = opts || {};
    const c = sim.course;
    const PI = Math.PI;
    const TAU = 2 * Math.PI;
    const SR = 0.55;
    const CH = 64;
    let seedA = opts.seed >>> 0 || 7;
    const rnd = () => {
      seedA = (seedA + 0x6d2b79f5) >>> 0;
      let t = seedA;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
    // The error budget: how a human misjudges. Every move is looked over first (ridden on a copy of the
    // sim), except: greed, the share of tricks thrown on a gut feel for the air left (felt with a greedSd
    // relative error) and not checked; grazeSloppy, the share of grazes whose aim is off by grazeAimSd
    // metres (one sigma) after the check; kickBlind, the share of kickers taken without a look; stompSd,
    // the stomp timing error (s); lapsePerMin, from lapseAfter seconds on, a moment (0.3 to 0.7 s) where
    // the hands freeze on the last input.
    const E = Object.assign({ greed: 0.35, greedSd: 0.12, stompSd: 0.02, grazeSloppy: 0.3, grazeAimSd: 0.15, kickBlind: 0.1, lapsePerMin: 1, lapseAfter: 40 }, opts.err || {});
    const ghosts = typeof opts.ghosts === 'function' ? opts.ghosts : null;
    // The run's draft probe (tick, x, y, z) -> bool, so a look-ahead drafts the field exactly as the run will.
    const draftP = typeof opts.draft === 'function' ? opts.draft : null;
    const dbg = typeof opts.debug === 'function' ? opts.debug : null;
    const sp = sim.sled || {};
    const mp = sim.mood || {};
    const spinMax = 9 * (sp.spin ?? 1) * (mp.spin ?? 1);
    const flipMax = 6.8 * (sp.flip ?? 1) * (mp.spin ?? 1);
    const stats = { kickTries: 0, kickers: 0, kickSkips: 0, kickBlind: 0, driftTries: 0, driftPlans: 0, driftBails: 0, releases: [0, 0, 0, 0], grazeTries: 0, grazeBlind: 0, grazes: 0, tricks: {}, greedy: 0, lapses: 0, rollouts: 0, rollTicks: 0, msMax: 0 };
    const P = { mode: 'cruise', air: null, K: null, D: null, G: null, after: null, RJ: null, dq: null, last: null, lapseUntil: 0, skipRamp: null, kickFor: null, kickBlind: false, kickRetry: 0, driftAt: 3 + rnd() * 2, grazeAt: 5 + rnd() * 5, bias: 0, biasTo: 0, biasAt: 0, pullAt: 70 + rnd() * 50, pullUntil: 0, pullSide: 1 };
    const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
    const lvl = (v) => (v < 0 ? 0 : v > 8 ? 8 : Math.round(v));
    const wrap = (a) => a - TAU * Math.round(a / TAU);

    // ---- Air rotation tables, from the sim's own air rules (steer smoothing 8 or 10 per s, spin accel
    // 34 and decel 22 rad/s^2 with a 2.6 rad/s snap to the nearest half turn; flips start after 7 held
    // ticks, accel 20 and decel 26 with a 2.4 rad/s snap): the seconds a rotation needs to settle.
    function spinNeed(goal) {
      let st = 0;
      let rate = 0;
      let yaw = 0;
      let on = true;
      for (let i = 1; i < 400; i++) {
        if (on && yaw + (rate * rate) / 44 >= goal - 0.12) on = false;
        const tg = on ? 1 : 0;
        st = approach(st, tg, (Math.abs(tg) < Math.abs(st) ? 10 : 8) / 60);
        if (Math.abs(st) > 0.3) rate = approach(rate, st * spinMax, 34 / 60);
        else {
          rate = approach(rate, 0, 22 / 60);
          yaw = approach(yaw, PI * Math.round(yaw / PI), 2.6 / 60);
        }
        yaw += rate / 60;
        if (!on && Math.abs(rate) < 0.6 && Math.abs(yaw - goal) < 0.3) return i / 60;
      }
      return 99;
    }
    function flipNeed(goal) {
      let rate = 0;
      let pitch = 0;
      let on = true;
      for (let i = 1; i < 400; i++) {
        if (on && pitch + (rate * rate) / 52 >= goal - 0.1) on = false;
        if (on && i >= 8) rate = approach(rate, flipMax, 20 / 60);
        else {
          rate = approach(rate, 0, 26 / 60);
          if (rate < 1.5) pitch = approach(pitch, TAU * Math.round(pitch / TAU), 2.4 / 60);
        }
        pitch += rate / 60;
        if (!on && rate < 0.6 && Math.abs(pitch - goal) < 0.35) return i / 60;
      }
      return 99;
    }
    const NEED = { spin: [0, spinNeed(PI), spinNeed(2 * PI), spinNeed(3 * PI), spinNeed(4 * PI)], flip: flipNeed(TAU), combo: Math.max(flipNeed(TAU), spinNeed(2 * PI)) + 0.12 };

    // ---- Geometry: hard obstacles near a stretch, edge gaps, clear points and paths.
    const obs = [];
    function gather(z0, z1, k) {
      obs.length = 0;
      const sm = k || sim;
      for (let i = Math.max(0, Math.floor(z0 / CH) - 1); i <= Math.floor(z1 / CH) + 1; i++) {
        for (const o of c.chunk(i).obstacles) {
          if (o.soft || (sm.destroyed && sm.destroyed.has(o.id))) continue;
          if (Math.max(o.z, o.z2) + o.r + 1 < z0 || Math.min(o.z, o.z2) - o.r - 1 > z1) continue;
          obs.push(o);
        }
      }
      return obs;
    }
    function gapTo(o, x, z) {
      let px = o.x;
      let pz = o.z;
      if (o.x2 !== o.x || o.z2 !== o.z) {
        const ex = o.x2 - o.x;
        const ez = o.z2 - o.z;
        let t = ((x - o.x) * ex + (z - o.z) * ez) / (ex * ex + ez * ez);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        px = o.x + ex * t;
        pz = o.z + ez * t;
      }
      return Math.hypot(x - px, z - pz) - o.r - SR;
    }
    function clearAt(list, x, z, m, skip) {
      if (c.edgeExcess(x, z) > -1.2) return false;
      for (const o of list) if (o !== skip && gapTo(o, x, z) < m) return false;
      return true;
    }
    function pathClear(x0, z0, x1, z1, m, skip) {
      const list = gather(Math.min(z0, z1) - 2, Math.max(z0, z1) + 2);
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0)));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        if (!clearAt(list, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, m, skip)) return false;
      }
      return true;
    }
    function rampAhead(s, reach) {
      let best = null;
      for (let i = Math.floor(s.z / CH) - 1; i <= Math.floor((s.z + reach) / CH); i++) {
        if (i < 0) continue;
        for (const r of c.zones(i).ramps) if (r.z + r.len * 0.7 > s.z && r.z - s.z < reach && (!best || r.z < best.z)) best = r;
      }
      return best;
    }
    function onRamp(s, r) {
      const u = (s.z - r.z) / r.len;
      return u > 0.4 && u < 1.2 && Math.abs(s.x - r.x) < r.w * 0.5 + 0.6;
    }
    function predictLand(k) {
      const s = k.s;
      const g = k.gravity;
      let y = s.y;
      let vy = s.vy;
      let x = s.x;
      let z = s.z;
      let t = 0;
      while (t < 5) {
        vy -= g / 60;
        x += s.vx / 60;
        z += s.vz / 60;
        y += vy / 60;
        t += 1 / 60;
        if (y <= c.ground(x, z)) break;
      }
      return { t, x, z };
    }

    // ---- Controllers. Each is a function of a sim (the run's or a copy) and its own state, and returns
    // the input, or null when its move is over. Same state in, same input out: a plan checked on a copy
    // of the sim plays out the same on the run.
    // Toward a point, never cutting across the slope at more than 0.32 rad (a drop or a mogul taken at
    // a steep angle throws the sled far off the line).
    const steerAt = (s, xt, zt, gain) => {
      let d = Math.atan2(xt - s.x, Math.max(1, zt - s.z));
      d = d > 0.32 ? 0.32 : d < -0.32 ? -0.32 : d;
      return lvl(4 + (d - s.velHeading) * (gain || 14));
    };
    function steerLine(s, f, lat) {
      const look = s.z + 4 + s.speed * 0.35;
      return lvl(4 + (Math.atan2(f(look) - s.x, look - s.z) - s.velHeading + (f(s.z) - s.x) * lat) * 14);
    }
    // Back onto the safe line along a clear straight; the safe line itself is always clear.
    function rejoin(s) {
      for (const L of [9, 13, 18, 24, 31, 40]) {
        const zt = s.z + L;
        const xt = c.safeX(zt);
        if (pathClear(s.x, s.z, xt, zt, 0.3)) return steerAt(s, xt, zt);
      }
      return steerAt(s, c.safeX(s.z + 12), s.z + 12);
    }
    // The safe line, for a ride on the copy: off it, the straight-line rejoin point is refreshed every 10
    // ticks (a fresh controller per ride, so the same ride always steers the same).
    function mkLine() {
      let R = null;
      let at = -99;
      return (k) => {
        const s = k.s;
        if (Math.abs(s.x - c.safeX(s.z)) > 1.6) {
          if (!R || k.tick >= at + 10 || s.z > R.zt - 3) {
            at = k.tick;
            R = null;
            for (const L of [9, 13, 18, 24, 31, 40]) {
              const zt = s.z + L;
              if (pathClear(s.x, s.z, c.safeX(zt), zt, 0.3)) {
                R = { xt: c.safeX(zt), zt };
                break;
              }
            }
            if (!R) R = { xt: c.safeX(s.z + 12), zt: s.z + 12 };
          }
          return { steer: steerAt(s, R.xt, R.zt), action: false };
        }
        R = null;
        return { steer: steerLine(s, (z) => c.safeX(z), 0.08), action: false };
      };
    }
    const lineCtl = (k) => {
      const s = k.s;
      return { steer: Math.abs(s.x - c.safeX(s.z)) > 1.6 ? rejoin(s) : steerLine(s, (z) => c.safeX(z), 0.08), action: false };
    };
    // Air: a trick by plan, air control toward the safe line at the landing spot (levels 3 and 5 stay
    // inside the spin dead zone), and the stomp in the last 0.11 s.
    function airCtl(k, A) {
      const s = k.s;
      // The landing guess is refreshed every 8 ticks, and every tick in the last 0.4 s (the stomp).
      let fl = A.fl;
      if (!fl || k.tick >= A.flAt + 8 || fl.t - (k.tick - A.flAt) / 60 < 0.4) {
        fl = A.fl = predictLand(k);
        A.flAt = k.tick;
      } else fl = { t: fl.t - (k.tick - A.flAt) / 60, x: fl.x, z: fl.z };
      let steer = 4;
      let action = false;
      if (A.spin) {
        const coast = (s.spinRate * s.spinRate) / 44;
        if (Math.abs(s.airYaw) + coast < A.spin - 0.12 && fl.t > 0.12) steer = A.dir > 0 ? 8 : 0;
      }
      if (steer === 4) {
        const off = fl.x - c.safeX(fl.z);
        if (Math.abs(off) > 0.7) steer = off > 0 ? 3 : 5;
      }
      if (A.flip && !A.flipDone) {
        const coast = (s.pitchRate * s.pitchRate) / 52;
        if (Math.abs(s.airPitch) + coast < A.flip - 0.1 && fl.t > 0.15) action = true;
        else A.flipDone = true;
      }
      const w = fl.t - A.bias;
      if (w < 0.11 && w > 0.004 && (A.stomping || !s.action)) {
        A.stomping = true;
        action = true;
      }
      return { steer, action };
    }
    function kickCtl(k, K) {
      const s = k.s;
      const r = K.r;
      const u = (s.z - r.z) / r.len;
      if (!s.grounded || u > 1.25) return null;
      const dx = r.x - s.x;
      const look = Math.max(r.z + r.len, s.z + 6);
      let d = Math.atan2(dx, look - s.z) + dx * 0.05;
      d = d > 0.5 ? 0.5 : d < -0.5 ? -0.5 : d;
      let steer = lvl(4 + (d - s.velHeading) * 14);
      // Hold the crouch up the face (a full charge is 36 ticks) and release near the top: a boosted pop.
      // Steering stays inside +-0.25 while held, so the hold never turns into a drift.
      const go = u > -0.65 && u < 0.86 && (K.held > 0 || (Math.abs(dx) < r.w * 0.5 - 0.5 && Math.abs(s.steer) < 0.6) || u > -0.15);
      if (go) {
        K.held++;
        steer = steer < 3 ? 3 : steer > 5 ? 5 : steer;
      }
      return { steer, action: go };
    }
    // A drift: carve away from the bend until the sled runs D.A rad off the line's direction (the flick),
    // swing the stick into the bend (the sim takes the drift's direction from the smoothed steer when the
    // hold starts), then hold. While drifting the stick only sets how fast the nose comes round (yaw
    // factor 0.2, full counter-steer, to 1, full in) and the sled only turns toward the drift's side, at
    // a rate set by the slip. Charge needs slip over 0.18, so the hold keeps the slip just over it (D.sig):
    // the least turning per unit of charge. The velocity sweeps from -A through the line's direction, and
    // the release (which pops) goes once charged.
    function driftCtl(k, D) {
      const s = k.s;
      if (!s.grounded) return null;
      if (D.ph === 0) {
        const lineDir = Math.atan2(c.safeX(s.z + 10) - c.safeX(s.z), 10);
        if ((s.velHeading - lineDir) * D.dir > -D.A && D.i++ < 70) return { steer: D.dir > 0 ? 0 : 8, action: false };
        D.ph = 1;
        D.i = 0;
      }
      if (D.ph === 1) {
        if (s.steer * D.dir < 0.2 && D.i++ < 30) return { steer: D.dir > 0 ? 8 : 0, action: false };
        D.ph = 2;
      }
      if (D.ph === 2) {
        D.held++;
        const done = (s.drifting && s.driftCharge >= D.target) || D.held > D.max || (D.held > 10 && !s.drifting);
        if (!done) {
          if (!s.drifting) return { steer: D.dir > 0 ? 8 : 0, action: true };
          const dd = s.driftDir;
          let f = 0.2 + D.Ks * (D.sig - s.slip * dd);
          f = f < 0.2 ? 0.2 : f > 1 ? 1 : f;
          return { steer: lvl(4 + 4 * dd * ((f - 0.6) / 0.4)), action: true };
        }
        D.ph = 3;
      }
      return null;
    }
    function grazeCtl(k, G) {
      const s = k.s;
      if (!s.grounded || s.z > G.oz + G.r + 1.2) return null;
      // Follow the line x = xt, so the sled is running parallel to the obstacle when it passes it.
      return { steer: steerLine(s, () => G.xt, 0.1), action: false };
    }
    // After a move: no-trick air (with the stomp), then the safe line for `rest` grounded ticks.
    function afterCtl(rest) {
      const A = { spin: 0, flip: 0, dir: 0, bias: 0.02, flipDone: true, stomping: false };
      const line = mkLine();
      let n = 0;
      return (k) => {
        if (!k.s.grounded) return airCtl(k, A);
        if (n++ >= rest) return null;
        return line(k);
      };
    }
    const seq = (a, b) => (k) => a(k) || b(k);

    // ---- Look-ahead: copy the run's sim into a private one and ride a controller forward on it.
    let twin = null;
    function copySim() {
      if (twin === null) {
        try {
          twin = new sim.constructor(sim.config);
        } catch (e) {
          twin = false;
        }
      }
      if (!twin) return null;
      const k = twin;
      Object.assign(k.s, sim.s);
      k.tick = sim.tick;
      k.maxZ = sim.maxZ;
      k.gifts = sim.gifts;
      k.giftScore = sim.giftScore;
      for (const f of ['prevAction', 'coyote', 'coyoteRamp', 'airPressed', 'ventCooldown']) if (f in sim) k[f] = sim[f];
      if (sim.lateTricks) k.lateTricks = Object.assign({}, sim.lateTricks);
      const a = k.combo;
      const b = sim.combo;
      a.pending = b.pending;
      a.chain = b.chain;
      a.timer = b.timer;
      a.banked = b.banked;
      a.best = b.best;
      a.lastMult = b.lastMult;
      for (const f of ['destroyed', 'resolvedObstacles']) {
        if (!(k[f] instanceof Set) || !(sim[f] instanceof Set)) continue;
        k[f].clear();
        for (const id of sim[f]) k[f].add(id);
      }
      if (k.nearMiss instanceof Map && sim.nearMiss instanceof Map) {
        k.nearMiss.clear();
        for (const [id, d] of sim.nearMiss) k.nearMiss.set(id, d);
      }
      if (k.collected instanceof Set) k.collected.clear();
      const d = k.dyn;
      const e = sim.dyn;
      if (d && e) {
        d.triggerZ = e.triggerZ;
        Object.assign(d.avalanche, e.avalanche);
        Object.assign(d.yeti, e.yeti);
        d.storm = e.storm.map((g) => Object.assign({}, g));
        d.spirits = e.spirits.map((g) => Object.assign({}, g));
        for (const f of ['stormPhase', 'stormTicks', 'trainPhase', 'trainTicks', 'warnTicks']) d[f] = e[f];
      }
      if (k.chaosRng && sim.chaosRng) Object.assign(k.chaosRng, sim.chaosRng);
      Object.assign(k.stats, sim.stats);
      k.events.length = 0;
      return k;
    }
    function rollout(ctl, max, ramp) {
      const k = copySim();
      if (!k) return null;
      stats.rollouts++;
      const res = { crash: false, bump: false, sketchy: false, release: 0, near: [], kicked: false, ticks: 0, k, ramp: ramp || null };
      // A ride never ends in the air: it goes on until the sled is back on the snow (and 20 ticks more).
      let land = -1;
      for (let i = 0; i < max + 260; i++) {
        if (i >= max) {
          if (land < 0 && k.s.grounded) land = i;
          if (land >= 0 && i >= land + 20) break;
        }
        const inp = ctl(k);
        if (!inp) break;
        const wasGround = k.s.grounded;
        const db = draftP && draftP(k.tick, k.s.x, k.s.y, k.s.z) ? 32 : 0;
        k.step((inp.steer | 0) | (inp.action ? 16 : 0) | db);
        stats.rollTicks++;
        res.ticks++;
        for (const e of k.events) {
          if (e.type === 'crash') res.crash = true;
          else if (e.type === 'bump') res.bump = true;
          else if (e.type === 'land' && e.quality === 'sketchy') res.sketchy = true;
          else if (e.type === 'drift' && e.phase === 'release') res.release = e.tier;
          else if (e.type === 'style' && e.kind === 'nearMiss') res.near.push(e);
        }
        if (wasGround && !k.s.grounded && res.ramp && onRamp(k.s, res.ramp)) res.kicked = true;
        if (res.crash || k.s.crashed) {
          res.crash = true;
          break;
        }
      }
      return res;
    }
    const settled = (res) => {
      const s = res.k.s;
      return Math.abs(s.x - c.safeX(s.z)) < 10 && c.edgeExcess(s.x, s.z) < -2;
    };
    // Off the line after a move: head for a point on the safe line ahead, the nearest one whose way back
    // rides clean on the copy (a straight-line check misses the curve the sled actually rides).
    function rjCtl(k, R) {
      const s = k.s;
      if (s.z > R.zt - 3) return null;
      return { steer: s.grounded ? steerAt(s, R.xt, R.zt) : 4, action: false };
    }
    function rejoinPlan(s) {
      const L0 = Math.max(10, Math.abs(s.x - c.safeX(s.z)) * 1.6);
      let best = null;
      let bestTicks = -1;
      for (const f of [1, 1.45, 2.1, 3]) {
        const zt = s.z + L0 * f;
        const R = { xt: c.safeX(zt), zt };
        const res = rollout(seq((k) => rjCtl(k, R), mkLine()), Math.ceil(((L0 * f) / Math.max(10, s.speed)) * 60) + 45);
        if (!res) return null;
        if (!res.crash && !res.bump) return R;
        if (res.ticks > bestTicks) {
          bestTicks = res.ticks;
          best = R;
        }
      }
      return best;
    }

    // ---- Moves.
    function tryKick(s, T) {
      if (T < P.kickRetry) return null;
      const r = rampAhead(s, 70);
      if (!r || r === P.skipRamp || r.z < s.z + 3) return null;
      const skip = () => {
        P.skipRamp = r;
        stats.kickSkips++;
        return null;
      };
      // Inside the corridor, with room to land.
      if (Math.abs(r.x - c.centerX(r.z)) > c.halfWidth(r.z) - r.w * 0.5 - 1.6) return skip();
      const dz = r.z - s.z;
      const dx = r.x - s.x;
      if (Math.abs(dx) > 12) return null;
      const need = Math.sqrt(4 * Math.abs(dx) * Math.max(12, s.speed)) + 4;
      if (dz > need + 12) return null;
      if (dz < need * 0.6 && Math.abs(dx) > r.w * 0.5 - 0.3) return skip();
      if (P.kickFor !== r) {
        P.kickFor = r;
        P.kickBlind = rnd() < E.kickBlind;
      }
      if (P.kickBlind) stats.kickBlind++;
      else {
        const K = { r, held: 0 };
        const t0 = Date.now();
        const res = rollout(seq((k) => kickCtl(k, K), afterCtl(50)), 420, r);
        stats.msMax = Math.max(stats.msMax, Date.now() - t0);
        if (!res || res.crash || res.bump || res.sketchy || !res.kicked || !settled(res)) {
          P.kickRetry = T + 0.12;
          return null;
        }
      }
      stats.kickTries++;
      P.mode = 'kick';
      P.K = { r, held: 0 };
      return kickCtl(sim, P.K);
    }
    function tryDrift(s, T) {
      if (T < P.driftAt || s.speed < 14 || s.wobble > 0 || Math.abs(s.steer) > 0.45 || s.drafting) return null;
      if (Math.abs(s.x - c.safeX(s.z)) > 1.3 || rampAhead(s, 55)) return null;
      const bend = c.safeX(s.z + 32) - c.safeX(s.z + 6);
      if (Math.abs(bend) < 2.2) {
        P.driftAt = T + 0.3;
        P.dq = null;
        return null;
      }
      const dir = bend > 0 ? 1 : -1;
      // Aim for a tier, then look for a drift that gets there and lands clean: how far to flick away from
      // the bend (A) and the slip to hold (sig). One candidate is ridden on the copy per tick (from that
      // tick's state), so the search also spreads over start points.
      if (!P.dq || P.dq.dir !== dir || T > P.dq.until) {
        stats.driftTries++;
        const roll = rnd();
        const goal = roll < 0.3 ? 1 : roll < 0.72 ? 2 : 3;
        const OPT = [null, { A: [0.08, 0.16], sig: [0.24, 0.32] }, { A: [0.22, 0.32], sig: [0.23, 0.3] }, { A: [0.4, 0.55], sig: [0.23, 0.3] }];
        // The goal tier's candidates three times over (each from a later start point), then one pass
        // of the tier below.
        const list = [];
        for (let g = goal; g >= Math.max(1, goal - 1); g--) {
          for (let pass = 0; pass < (g === goal ? 3 : 1); pass++) {
            const tier = [];
            for (const A of OPT[g].A) for (const sig of OPT[g].sig) tier.push({ g, A, sig });
            for (let i = tier.length - 1; i > 0; i--) {
              const j = Math.floor(rnd() * (i + 1));
              [tier[i], tier[j]] = [tier[j], tier[i]];
            }
            list.push(...tier);
          }
        }
        P.dq = { dir, list, until: T + 3 };
      }
      const cd = P.dq.list.shift();
      if (!cd) {
        P.dq = null;
        P.driftAt = T + 0.6;
        return null;
      }
      const TARGET = [0, 0.66, 1.42, 2.46];
      const MAX = [0, 80, 140, 200];
      const plan = () => ({ dir, A: cd.A, sig: cd.sig, Ks: 4, target: TARGET[cd.g], max: MAX[cd.g], ph: 0, i: 0, held: 0, goal: cd.g });
      const t0 = Date.now();
      const D = plan();
      const res = rollout(seq((k) => driftCtl(k, D), afterCtl(60)), MAX[cd.g] + 300);
      stats.msMax = Math.max(stats.msMax, Date.now() - t0);
      if (dbg && res) dbg('drift', { t: T, z: s.z, goal: cd.g, pre: cd.A, yaw: cd.sig, crash: res.crash, bump: res.bump, sketchy: res.sketchy, release: res.release, settled: settled(res), held: D.held, ticks: res.ticks, endOff: res.k.s.x - c.safeX(res.k.s.z), cause: res.k.s.crashCause });
      if (!res || res.crash || res.bump || res.sketchy || res.release < cd.g || !settled(res)) return null;
      P.dq = null;
      stats.driftPlans++;
      P.mode = 'drift';
      P.D = plan();
      P.driftAt = T + 2.5 + rnd() * 2.5;
      return driftCtl(sim, P.D);
    }
    function driftExec(T) {
      const D = P.D;
      // Every 12 held ticks, check the rest of the drift still lands clean (a draft can push the line);
      // if not, cut it short now.
      if (D.ph === 2 && D.held > 0 && D.held % 12 === 0) {
        const bad = (r) => !r || r.crash || r.bump || r.sketchy || !settled(r);
        const Dc = Object.assign({}, D);
        const res = rollout(seq((k) => driftCtl(k, Dc), afterCtl(60)), D.max - D.held + 300);
        if (res && bad(res)) {
          // Rescue it: release now, or change the arc; else release now anyway.
          stats.driftBails++;
          let alt = { target: 0 };
          for (const a of [{ target: 0 }, { sig: 0.2 }, { sig: 0.42 }]) {
            const Da = Object.assign({}, D, a);
            if (!bad(rollout(seq((k) => driftCtl(k, Da), afterCtl(60)), D.max - D.held + 300))) {
              alt = a;
              break;
            }
          }
          Object.assign(D, alt);
        }
      }
      const out = driftCtl(sim, D);
      if (!out) P.driftAt = Math.max(P.driftAt, T + 2);
      return out;
    }
    function tryGraze(s, T) {
      if (T < P.grazeAt || s.speed < 18.5 || s.drifting || s.wobble > 0 || Math.abs(s.x - c.safeX(s.z)) > 1.2 || rampAhead(s, 45)) return null;
      P.grazeAt = T + 0.3;
      const list = gather(s.z + 18, s.z + 40).slice();
      let best = null;
      for (const o of list) {
        if (o.x2 !== o.x || o.z2 !== o.z) continue;
        const dz = o.z - s.z;
        if (dz < 20 || dz > 38) continue;
        const sx = c.safeX(o.z);
        // Only obstacles standing close to the lane: the side-step stays small, so the sled is running
        // parallel by the time it passes.
        if (Math.abs(o.x - sx) - o.r > 2.45 + 0.8) continue;
        if (!best || dz < best.z - s.z) best = o;
      }
      if (!best) return null;
      const o = best;
      const side = Math.sign(c.safeX(o.z) - o.x) || 1;
      const want = 0.3 + rnd() * 0.3;
      const xt = o.x + side * (o.r + SR + want);
      if (!pathClear(s.x, s.z, xt, o.z - 6, 0.5, o) || !pathClear(xt, o.z - 6, xt, o.z + 4, 0.5, o)) return null;
      const G = { oz: o.z, r: o.r, xt, id: o.id, want };
      const t0 = Date.now();
      const res = rollout(seq((k) => grazeCtl(k, G), mkLine()), Math.ceil(((o.z - s.z) / s.speed) * 60) + 40);
      stats.msMax = Math.max(stats.msMax, Date.now() - t0);
      const hit = res && res.near.some((e) => e.id === undefined || e.id === o.id);
      if (!res || res.crash || res.bump || !hit) {
        P.grazeAt = T + 0.6;
        return null;
      }
      // A sloppy hand: the line checked was right, the line ridden is a little off (more often, and by
      // more, as the run wears on).
      const tired = Math.max(0, T - 60) / 60;
      if (rnd() < E.grazeSloppy + tired * 0.25) {
        G.xt += gauss() * E.grazeAimSd * (1 + tired);
        stats.grazeBlind++;
      }
      stats.grazeTries++;
      P.mode = 'graze';
      P.G = G;
      P.grazeAt = T + 5 + rnd() * 9;
      return grazeCtl(sim, G);
    }
    // A flight, then the safe line for `rest` grounded ticks: the trick check's ride.
    function airThen(A, rest) {
      const line = mkLine();
      let n = 0;
      return (k) => {
        if (!k.s.grounded) return airCtl(k, A);
        if (n++ >= rest) return null;
        return line(k);
      };
    }
    function planAir(s) {
      const fl = predictLand(sim);
      const bias = 0.02 + gauss() * E.stompSd;
      const mk = (spin, flip, dir) => ({ spin, flip, dir, bias, flipDone: !flip, stomping: false, fl: null, flAt: 0, t: fl.t });
      // Judge the air left and pick the biggest trick that fits, sometimes one less. A greedy rider goes
      // on feel (with an error) and does not look; otherwise the trick is ridden on the copy first and
      // stepped down until it lands clean.
      // Confidence grows with the run: past a minute, more tricks go on feel.
      const greedy = rnd() < E.greed + Math.max(0, sim.tick / 60 - 60) * 0.003;
      const feel = fl.t * (1 + (greedy ? gauss() * E.greedSd : 0));
      const room = c.halfWidth(fl.z) - Math.abs(fl.x - c.centerX(fl.z));
      if (feel < 0.62 || room < 3) return mk(0, 0, 0);
      const off = fl.x - c.safeX(fl.z);
      const dir = Math.abs(off) > 0.5 ? (off > 0 ? -1 : 1) : rnd() < 0.5 ? -1 : 1;
      let half = 0;
      for (let h = 4; h >= 1; h--) if (NEED.spin[h] + 0.18 < feel) { half = h; break; }
      if (half > 1 && rnd() < 0.3) half--;
      const r = rnd();
      const opts = [];
      if (feel > NEED.combo + 0.25 && r < 0.18) opts.push(mk(2 * PI, TAU, dir));
      if (feel > NEED.flip + 0.2 && r < 0.5) opts.push(mk(0, TAU, dir));
      for (let h = half; h >= 1; h--) opts.push(mk(h * PI, 0, dir));
      opts.push(mk(0, 0, dir));
      if (greedy) return Object.assign(opts[0], { greedy: true });
      for (const A of opts) {
        if (!A.spin && !A.flip) return A;
        const res = rollout(airThen(Object.assign({}, A), 40), 420);
        if (res && !res.crash && !res.bump && !res.sketchy && settled(res)) return A;
      }
      return opts[opts.length - 1];
    }
    function cruise(s, T) {
      if (T > P.biasAt) {
        P.biasAt = T + 1.5 + rnd() * 2.5;
        P.biasTo = (rnd() - 0.5) * 1.4;
      }
      P.bias += (P.biasTo - P.bias) * 0.03;
      if (Math.abs(s.x - c.safeX(s.z)) > 1.6) {
        if (!P.RJ || T > P.RJ.until || s.z > P.RJ.zt - 3) {
          const R = rejoinPlan(s);
          P.RJ = R ? Object.assign(R, { until: T + 0.25 }) : null;
        }
        return P.RJ ? rjCtl(sim, P.RJ) || lineCtl(sim) : lineCtl(sim);
      }
      P.RJ = null;
      let f = (z) => c.safeX(z) + P.bias;
      const g = ghosts ? ghosts(sim.tick, s.x, s.z) : null;
      if (g && Math.abs(g.x - c.safeX(g.z)) < 1.6) {
        // Tuck in behind, and once the draft is charged pull out of it: the slingshot.
        if (s.draftTicks >= P.pullAt && T > P.pullUntil) {
          P.pullUntil = T + 0.9;
          P.pullSide = g.x > c.safeX(g.z) ? -1 : 1;
          P.pullAt = 70 + rnd() * 50;
        }
        const gx = g.x;
        f = T < P.pullUntil ? () => gx + P.pullSide * 2.6 : () => gx;
      }
      return { steer: steerLine(s, f, 0.08), action: false };
    }
    function sample() {
      const T = sim.tick / 60;
      for (const e of sim.events) if (e.type === 'drift' && e.phase === 'release') stats.releases[e.tier]++;
      // A lapse: the hands hold the last input and the head is elsewhere.
      if (P.lapseUntil > T && P.last && !sim.s.crashed) return P.last;
      // Fatigue: lapses come more often the longer the run goes.
      if (T > E.lapseAfter && rnd() < (E.lapsePerMin * (1 + (T - E.lapseAfter) / 50)) / 3600 && P.last) {
        P.lapseUntil = T + 0.3 + rnd() * 0.4;
        stats.lapses++;
        return P.last;
      }
      P.last = decide(T);
      return P.last;
    }
    function decide(T) {
      const s = sim.s;
      if (s.crashed) {
        P.mode = 'cruise';
        P.air = null;
        return { steer: 4, action: false };
      }
      if (!s.grounded) {
        if (!P.air) {
          P.air = planAir(s);
          if (P.mode === 'kick' && P.K && onRamp(s, P.K.r)) stats.kickers++;
          P.mode = 'cruise';
          const key = (P.air.flip ? 'flip' : '') + (P.air.spin ? 'spin' + Math.round((P.air.spin / PI) * 180) : '') || 'none';
          stats.tricks[key] = (stats.tricks[key] || 0) + 1;
          if (P.air.greedy) stats.greedy++;
        }
        return airCtl(sim, P.air);
      }
      // Just landed: ride the line the way the checked moves were ridden for a moment (the same
      // controller), so the run plays out the way the check said it would.
      if (P.air) P.after = { line: mkLine(), n: 0 };
      P.air = null;
      if (P.mode === 'cruise' && P.after) {
        if (P.after.n++ < 50) {
          const o = T > 2 ? tryKick(s, T) : null;
          return o || P.after.line(sim);
        }
        P.after = null;
      }
      if (P.mode === 'drift') {
        const o = driftExec(T);
        if (o) return o;
        P.mode = 'cruise';
      } else if (P.mode === 'kick') {
        const o = kickCtl(sim, P.K);
        if (o) return o;
        P.mode = 'cruise';
      } else if (P.mode === 'graze') {
        const o = grazeCtl(sim, P.G);
        if (o) return o;
        stats.grazes++;
        P.mode = 'cruise';
      }
      if (T > 2) {
        const o = tryKick(s, T) || tryDrift(s, T) || tryGraze(s, T);
        if (o) return o;
      }
      return cruise(s, T);
    }
    return { sample, stats, P };
  }
  /* STUNT:END */

  const installPilot = (skill, seed) =>
    page.evaluate(({ skill, seed, stuntSrc }) => {
      let a = seed >>> 0;
      const rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const app = window.__gs;
      const tele = { calls: [], beats: [], intensity: [], live: [], crash: null, firstPassAt: null, skill };
      window.__tele = tele;
      const now = () => (app.run ? app.run.sim.tick / 60 : -1);
      const SKIP = new Set(['constructor', 'updateHud', 'occluders', 'mirrorRect', 'setRiderScreen', 'touchVisual', 'setLoading', 'setMirror', 'markOcc', 'measureOcc', 'syncInert', 'syncHint', 'setMode', 'performed']);
      // Wrappers outlive a run (Run Again keeps the page), so they always log into the current run's record.
      const wrap = (obj, name, tag) => {
        const f = obj[name];
        if (typeof f !== 'function' || f.__w) return;
        const w = function (...args) {
          try {
            const tele = window.__tele;
            const t = +now().toFixed(2);
            if (name === 'beats' && Array.isArray(args[0])) {
              // Beats are logged one by one, compactly (a whole list can be long).
              for (const b of args[0]) {
                tele.beats.push({ t, type: b.type, tone: b.say ? b.say.tone : undefined, label: b.say ? b.say.label : b.text || b.title || undefined, muted: !!b.muted, wreck: b.wreck || undefined, word: b.word, grade: b.grade, tier: b.tier, phase: b.phase, gifts: b.gifts, streak: b.streak, news: b.news, outcome: b.outcome, id: typeof b.id === 'string' ? b.id : undefined, gap: typeof b.gap === 'number' ? +b.gap.toFixed(2) : undefined });
              }
            } else {
              let s = '';
              try { s = JSON.stringify(args); } catch { s = String(args[0]); }
              tele.calls.push({ t, m: `${tag}.${name}`, a: s.length > 400 ? s.slice(0, 400) : s });
            }
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
      const up = app.audio.update.__w ? null : app.audio.update;
      if (up) app.audio.update = Object.assign(function (f, dt) {
        const tele = window.__tele;
        if (app.run && app.phase === 'run') {
          const T = app.run.sim.tick / 60;
          if (tele.lastI === undefined || T - tele.lastI >= 0.5) {
            tele.lastI = T;
            tele.intensity.push([+T.toFixed(1), +(+f.intensity).toFixed(3), +f.speed.toFixed(1), f.comboMult, +(app.run.sim.s.flow ?? 0).toFixed(2)]);
          }
        }
        return up.call(this, f, dt);
      }, { __w: 1 });

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

      // The stunt pilot (makeStuntPilot, handed in as source). It drafts the nearest riding ghost ahead.
      let stunt = null;
      if (skill === 'stunt') {
        const make = new Function('return (' + stuntSrc + ')')();
        const pose = {};
        stunt = make(sim, {
          seed,
          draft: (tick, x, y, z) => (run.draftProbe ? run.draftProbe(tick, x, y, z) : false),
          ghosts: (tick, x, z) => {
            let best = null;
            for (const t of app.ghosts.tracks) {
              if (!t.ready || !app.ghosts.pose(t, tick, pose) || pose.done) continue;
              const ahead = pose.z - z;
              if (ahead < 1.5 || ahead > 30) continue;
              if (!best || ahead < best.ahead) best = { x: pose.x, z: pose.z, ahead };
            }
            return best;
          },
        });
        tele.stunt = stunt.stats;
      }

      // ---- Per-tick fun metrics, read from the sim's own events (both builds) and the director (newer
      // build only; every read is guarded so an older build reports n/a).
      const F = (tele.fun = {
        simRel: [0, 0, 0, 0], simNear: 0, simGaps: [], simGrade: { whisker: 0, near: 0, unknown: 0 }, kickers: 0, boostPops: 0, slingshots: 0, draftTicks: 0,
        land: { perfect: 0, clean: 0, sketchy: 0, hop: 0, late: 0 }, tricks: {}, maxSimFlow: 0, maxShown: null, flowFields: false,
        pillTicks: 0, pillDone: 0, pillFar: 0, pillOk: false, met: {}, metOk: app.missionsPopped instanceof Set, lastAheadNear: null, hadAheadNear: false,
        aheadAt30: null, aheadAt60: null, banner: { samples: 0, two: 0, overRow: 0 },
      });
      let prevNear = null;
      const rampAt = (s) => {
        for (let k = Math.floor(s.z / 64) - 1; k <= Math.floor(s.z / 64); k++) {
          if (k < 0) continue;
          for (const r of c.zones(k).ramps) { const u = (s.z - r.z) / r.len; if (u > 0.4 && u < 1.2 && Math.abs(s.x - r.x) < r.w * 0.5 + 0.6) return r; }
        }
        return null;
      };
      const obsById = (id) => { for (const o of c.chunk(Math.floor(id / 256)).obstacles) if (o.id === id) return o; return null; };
      const endOf = (t) => (t.crashTick >= 0 ? t.crashTick : t.ticks);
      let wasGround = true;
      const tickHook = () => {
        const s = sim.s;
        // sim.events holds the previous step's events until the next step starts.
        for (const e of sim.events) {
          if (e.type === 'drift' && e.phase === 'release') F.simRel[e.tier] = (F.simRel[e.tier] || 0) + 1;
          else if (e.type === 'style' && e.kind === 'boostPop') F.boostPops++;
          else if (e.type === 'style' && e.kind === 'slingshot') F.slingshots++;
          else if (e.type === 'style' && e.kind === 'nearMiss') {
            F.simNear++;
            let gap = typeof e.gap === 'number' ? e.gap : null;
            if (gap === null && prevNear) {
              // Older build: the gap is not on the event; read it from the sim's own closest-approach map.
              for (const [id, d] of prevNear) if (!(sim.nearMiss && sim.nearMiss.has(id))) { const o = obsById(id); if (o) { gap = Math.max(0, d - o.r - 0.55); break; } }
            }
            if (gap === null) F.simGrade.unknown++;
            else {
              F.simGaps.push(+gap.toFixed(2));
              if (gap < 0.45 && s.speed >= 18) F.simGrade.whisker++;
              else F.simGrade.near++;
            }
          } else if (e.type === 'land') {
            F.land[e.quality] = (F.land[e.quality] || 0) + 1;
            if (e.late) F.land.late++;
            if (e.halfTurns || e.flips) { const k = (e.flips ? 'flip' + e.flips : '') + (e.halfTurns ? 'spin' + e.halfTurns * 180 : ''); F.tricks[k] = (F.tricks[k] || 0) + 1; }
          }
        }
        prevNear = sim.nearMiss instanceof Map ? new Map(sim.nearMiss) : null;
        if (wasGround && !s.grounded && rampAt(s)) F.kickers++;
        wasGround = s.grounded;
        if ((s.flow ?? 0) > F.maxSimFlow) F.maxSimFlow = s.flow;
        if (sim.stats) F.draftTicks = sim.stats.draftTicks || 0;
        const d = app.director;
        const shown = d ? d.flowShown : undefined;
        if (typeof shown === 'number') { F.flowFields = true; if (F.maxShown === null || shown > F.maxShown) F.maxShown = shown; }
        // The rival pill: director.out.rival names a GhostEntry id.
        const rv = d && d.out ? d.out.rival : undefined;
        if (d && d.out && 'rival' in d.out) {
          F.pillOk = true;
          if (rv && !s.crashed) {
            F.pillTicks++;
            const t = app.ghosts.tracks.find((x) => x.entry && x.entry.id === rv.id);
            if (t && sim.tick >= endOf(t)) F.pillDone++;
            else if (t && Math.abs(app.ghosts.zAt(t, sim.tick) - s.z) > 150) F.pillFar++;
          }
        }
        if (F.metOk) for (const id of app.missionsPopped) if (!(id in F.met)) F.met[id] = +(sim.tick / 60).toFixed(2);
      };
      tele.trace = [];
      const source = stunt ? stunt.sample : pilot;
      run.input = { sample: () => { try { tickHook(); } catch {} const o = source(); const s = sim.s; tele.trace.push([sim.tick, +s.z.toFixed(1), +s.x.toFixed(2), s.grounded ? 1 : 0, +s.airYaw.toFixed(2), +s.airPitch.toFixed(2), o.steer, o.action ? 1 : 0, +(s.y - c.ground(s.x, s.z)).toFixed(2)]); if (tele.trace.length > 200) tele.trace.shift(); return o; } };

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
          tele.crash = { t: +T.toFixed(2), distance: Math.round(r.sim.distance), score: r.sim.score, cause: s.crashCause, passed: app.passedThisRun.size, gifts: (r.sim.gifts || 0) + (app.passBonus || 0), passBonus: app.passBonus || 0, ghosts, liveNear: ghosts.filter((g) => g.riding && Math.abs(g.gap) <= 40).length, riding: ghosts.filter((g) => g.riding).length };
        }
        return { phase: app.phase, crashed: s.crashed, t: T };
      };
      const sampleLive = () => {
        const r = app.run;
        if (!r || r.sim.s.crashed || r !== run) return;
        const T = r.sim.tick / 60;
        let near = 0, riding = 0, nearest = 1e9, ahead = 0, ahead150 = 0;
        for (const t of app.ghosts.tracks) {
          if (!t.ready) continue;
          const end = t.crashTick >= 0 ? t.crashTick : t.ticks;
          if (r.sim.tick >= end) continue;
          riding++;
          const gap = app.ghosts.zAt(t, r.sim.tick) - r.sim.s.z;
          if (Math.abs(gap) <= 40) near++;
          if (gap > 0) { ahead++; if (gap <= 150) ahead150++; }
          nearest = Math.min(nearest, Math.abs(gap));
        }
        tele.live.push([+T.toFixed(2), near, riding, nearest === 1e9 ? -1 : +nearest.toFixed(1)]);
        if (tele.firstPassAt === null && app.passedThisRun && app.passedThisRun.size > 0) tele.firstPassAt = +T.toFixed(2);
        if (ahead150 > 0) { F.lastAheadNear = +T.toFixed(2); F.hadAheadNear = true; }
        F.lastLiveT = +T.toFixed(2);
        F.liveTimes = F.liveTimes || [];
        F.liveTimes.push(+T.toFixed(2));
        if (F.aheadAt30 === null && T >= 30) F.aheadAt30 = { riding: ahead, within150: ahead150 };
        if (F.aheadAt60 === null && T >= 60) F.aheadAt60 = { riding: ahead, within150: ahead150 };
      };
      tele.liveTimer = setInterval(sampleLive, 250);
      // Banners: two drawn at once, or one drawn over the race row (100 ms DOM samples while riding).
      const op = (el) => { let v = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; v *= +cs.opacity; } return v; };
      const sampleBanner = () => {
        const r = app.run;
        if (!r || r.sim.s.crashed || r !== run || app.phase !== 'run') return;
        const stage = document.querySelector('.gs-notices .gs-stage');
        if (!stage) return;
        F.banner.samples++;
        const shown = [...stage.children].filter((el) => op(el) > 0.25);
        if (shown.length >= 2) F.banner.two++;
        const row = document.querySelector('.gs-race');
        if (shown.length && row && op(row) > 0.25) F.banner.overRow++;
      };
      tele.bannerTimer = setInterval(() => { try { sampleBanner(); } catch {} }, 100);
    }, { skill, seed, stuntSrc: makeStuntPilot.toString() });

  const drive = async (maxMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const d = await page.evaluate(() => window.__poll());
      if (d.crashed) break;
      if (d.t > cfg.maxSeconds) break;
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => { clearInterval(window.__tele.liveTimer); clearInterval(window.__tele.bannerTimer); });
    await page.waitForTimeout(1600);
  };

  // Named moments, counted the same way on both builds (parity): big, perfect and best callouts,
  // stamps, banks, banners and toasts, warns, and passes that were shown. The new build also reports
  // every named beat (namedAll), which the old build has no equivalent for.
  const summarize = (tele, extra) => {
    const runT = tele.crash ? tele.crash.t : tele.intensity.length ? tele.intensity[tele.intensity.length - 1][0] : 0;
    const mins = Math.max(1 / 60, runT / 60);
    const inRun = tele.calls.filter((c) => c.t >= 0 && c.t <= runT + 0.05);
    const beats = tele.beats.filter((b) => b.t >= 0 && b.t <= runT + 0.05);
    const count = (re) => inRun.filter((c) => re.test(c.m)).length;
    const legacy = !beats.length && inRun.some((c) => c.m === 'ui.popStyle' || c.m === 'ui.ghostPass');
    const BIG = /^(big|perfect|best)$/;
    let shown, passedBy, wreckPassed = 0, banks, bigCallouts, toasts, missions, firstPass, firstNamed;
    if (legacy || !beats.length) {
      const passes = inRun.filter((c) => c.m === 'ui.ghostPass' && /,true]$/.test(c.a));
      shown = passes.length;
      passedBy = inRun.filter((c) => c.m === 'ui.ghostPass' && /,false]$/.test(c.a)).length;
      banks = count(/^ui.comboBank$/);
      bigCallouts = inRun.filter((c) => c.m === 'ui.popStyle' && /"(big|perfect)"]$/.test(c.a)).length;
      toasts = count(/^ui.toast$/);
      missions = 0;
      firstPass = passes.length ? passes[0].t : null;
      const fn = inRun.find((c) => (c.m === 'ui.popStyle' && /"(big|perfect)"]$/.test(c.a)) || c.m === 'ui.comboBank' || (c.m === 'ui.ghostPass' && /,true]$/.test(c.a)));
      firstNamed = fn ? fn.t : null;
    } else {
      const passes = beats.filter((b) => b.type === 'pass' && !b.muted);
      shown = passes.length;
      // Ghosts riding past your wreck after the crash are counted apart, so passedBy stays like for like.
      passedBy = beats.filter((b) => b.type === 'passedBy' && !b.muted && !b.wreck).length;
      wreckPassed = beats.filter((b) => b.type === 'passedBy' && b.wreck).length;
      banks = beats.filter((b) => b.type === 'bank').length;
      bigCallouts = beats.filter((b) => b.type === 'stomp' || (b.tone && BIG.test(b.tone) && b.type !== 'bank')).length;
      toasts = beats.filter((b) => ['finale', 'grudgeSettled', 'missionPop', 'unlockPop'].includes(b.type)).length + count(/^ui.toast$/);
      missions = beats.filter((b) => b.type === 'missionPop').length;
      firstPass = passes.length ? passes[0].t : null;
      const NAMED = new Set(['stomp', 'nearMiss', 'driftRelease', 'flow', 'bank', 'comboLost', 'bestComboPace', 'pass', 'lead', 'raceNews', 'duel', 'raceCall', 'grudgeSettled', 'newGround', 'newBest', 'friendBeaten', 'finale', 'missionPop', 'unlockPop', 'crash', 'km', 'graveyard']);
      const isNamed = (b) => NAMED.has(b.type) && !b.muted && !(b.type === 'nearMiss' && b.grade !== 'whisker') && b.type !== 'crash';
      const fn = beats.find(isNamed);
      firstNamed = fn ? fn.t : null;
      extra.namedAll = beats.filter(isNamed).length;
      extra.namedAllPerMin = +(extra.namedAll / mins).toFixed(2);
      extra.namedKindsMin1 = [...new Set(beats.filter((b) => b.t <= 60 && isNamed(b)).map((b) => (b.type === 'pass' ? 'pass:' + b.word : b.type)))];
      const bt = {};
      for (const b of beats) { const k = b.type + (b.word ? ':' + b.word : '') + (b.grade ? ':' + b.grade : '') + (b.phase ? ':' + b.phase : '') + (b.type === 'bank' ? ':t' + b.tier : ''); bt[k] = (bt[k] || 0) + 1; }
      extra.beatTypes = bt;
    }
    const warns = count(/^ui.warn$/);
    const named = bigCallouts + banks + toasts + warns + shown;
    const I = tele.intensity;
    const meanI = I.length ? I.reduce((s, v) => s + v[1], 0) / I.length : 0;
    const iAt = (sec) => { const v = I.find((x) => x[0] >= sec); return v ? v[1] : null; };
    const liveFrac = tele.live.length ? tele.live.filter((l) => l[1] > 0).length / tele.live.length : 0;
    const g = tele.crash ? tele.crash.ghosts.filter((x) => x.riding) : [];
    const strict = g.filter((x) => Math.abs(x.gap) <= 40).length >= 2 || g.some((x) => Math.abs(x.gap) <= 25);
    const fun = funMetrics(tele, beats, inRun, runT, legacy || !beats.length, firstPass, strict);
    return {
      ...extra,
      seconds: +runT.toFixed(1),
      distance: tele.crash ? tele.crash.distance : null,
      score: tele.crash ? tele.crash.score : null,
      cause: tele.crash ? tele.crash.cause : 'timeout',
      gifts: tele.crash ? tele.crash.gifts : null,
      passBonus: tele.crash ? tele.crash.passBonus : null,
      passes: shown,
      passedBy,
      wreckPassed,
      firstPassAt: firstPass,
      firstNamedAt: firstNamed,
      namedMoments: named,
      namedPerMin: +(named / mins).toFixed(2),
      passesPerMin: +(shown / mins).toFixed(2),
      banks,
      warns,
      toasts,
      missionsMidRun: missions,
      raceLiveAtCrash: tele.crash ? tele.crash.liveNear > 0 : null,
      raceLiveStrict: tele.crash ? strict : null,
      liveNearAtCrash: tele.crash ? tele.crash.liveNear : null,
      ridingAtCrash: tele.crash ? tele.crash.riding : null,
      raceLiveFraction: +liveFrac.toFixed(2),
      intensity: { mean: +meanI.toFixed(3), at10: iAt(10), at30: iAt(30), at60: iAt(60), max: I.length ? Math.max(...I.map((v) => v[1])) : 0 },
      crashField: tele.crash ? tele.crash.ghosts : null,
      fun,
      calls: cfg.lean ? undefined : inRun.filter((c) => !/^audio.ui$/.test(c.m)).slice(0, 300),
      beatLog: cfg.lean ? undefined : beats.slice(0, 400),
    };
  };

  // The fun-pass metrics for one run. NA marks what this build cannot report (no director, no beats).
  const NA = 'n/a';
  const funMetrics = (tele, beats, inRun, runT, noBeats, firstPass, strict) => {
    const F = tele.fun || {};
    const B = (type) => beats.filter((b) => b.type === type);
    const byKey = (list, key) => { const o = {}; for (const b of list) { const k = b[key] === undefined ? '?' : String(b[key]); o[k] = (o[k] || 0) + 1; } return o; };
    // Hints: each ui.hint(kind, ...) call that changes the kind on screen is one showing of that kind.
    const hints = {};
    let cur = null;
    let hintCalls = 0;
    for (const call of inRun) {
      if (call.m !== 'ui.hint') continue;
      hintCalls++;
      let kind = null;
      try { kind = JSON.parse(call.a)[0]; } catch {}
      if (kind && kind !== cur) hints[kind] = (hints[kind] || 0) + 1;
      cur = kind || null;
    }
    // Missions: met (the app's missionsPopped set gaining the id) against popped (a missionPop beat).
    let missions = NA;
    if (F.metOk && !noBeats) {
      const pops = B('missionPop');
      const list = Object.entries(F.met).filter(([, t]) => t <= runT + 0.05).map(([id, t]) => {
        const p = pops.find((b) => b.id === id);
        return { id, met: t, popped: p ? p.t : null, delay: p ? +(p.t - t).toFixed(2) : null };
      });
      const delays = list.filter((m) => m.delay !== null).map((m) => m.delay);
      missions = { met: list.length, popped: list.filter((m) => m.popped !== null).length, dropped: list.filter((m) => m.popped === null).length, delays, meanDelay: delays.length ? +(delays.reduce((s, v) => s + v, 0) / delays.length).toFixed(2) : null, list };
    }
    const unlock = noBeats ? NA : (B('unlockPop')[0] || {}).t ?? null;
    // Field gone: from the first live sample after the last one with a riding ghost ahead within 150 m.
    let fieldGoneAt = null;
    const lt = F.liveTimes || [];
    if (!F.hadAheadNear) fieldGoneAt = lt.length ? lt[0] : null;
    else if (F.lastAheadNear !== null && F.lastAheadNear < (F.lastLiveT ?? 0)) fieldGoneAt = lt.find((t) => t > F.lastAheadNear) ?? null;
    const passes = B('pass');
    const shownWords = byKey(passes.filter((b) => !b.muted), 'word');
    const mutedWords = byKey(passes.filter((b) => b.muted), 'word');
    let legacyShown = null;
    if (noBeats) legacyShown = inRun.filter((c) => c.m === 'ui.ghostPass' && /,true]$/.test(c.a)).length;
    const anyPass = tele.firstPassAt;
    const nearBeats = B('nearMiss');
    const streaks = B('stomp').map((b) => b.streak || 0);
    return {
      flow: { maxShown: F.flowFields ? +F.maxShown.toFixed(2) : NA, maxSim: +(F.maxSimFlow || 0).toFixed(2), in: noBeats ? NA : B('flow').filter((b) => b.phase === 'in').length, snuff: noBeats ? NA : B('flow').filter((b) => b.phase === 'snuff').length },
      drift: { sim: { t1: F.simRel ? F.simRel[1] : 0, t2: F.simRel ? F.simRel[2] : 0, t3: F.simRel ? F.simRel[3] : 0 }, beats: noBeats ? NA : { t1: B('driftRelease').filter((b) => b.tier === 1).length, t2: B('driftRelease').filter((b) => b.tier === 2).length, t3: B('driftRelease').filter((b) => b.tier === 3).length } },
      nearMiss: { sim: F.simNear || 0, gaps: (F.simGaps || []).slice(0, 60), simGrade: F.simGrade || NA, beats: noBeats ? NA : { whisker: nearBeats.filter((b) => b.grade === 'whisker').length, near: nearBeats.filter((b) => b.grade === 'near').length } },
      kickers: { hit: F.kickers || 0, boostPops: F.boostPops || 0 },
      drafts: { seconds: +((F.draftTicks || 0) / 60).toFixed(1), slingshots: F.slingshots || 0 },
      landings: F.land || NA,
      tricks: F.tricks || {},
      stompStreakPeak: noBeats ? NA : streaks.length ? Math.max(...streaks) : 0,
      hints: hintCalls ? hints : {},
      missions,
      unlockPopAt: unlock,
      fieldGoneAt,
      aheadAt30: F.aheadAt30 ?? null,
      aheadAt60: F.aheadAt60 ?? null,
      rivalPill: F.pillOk ? { ticks: F.pillTicks, done: F.pillDone, far: F.pillFar, frac: F.pillTicks ? +((F.pillDone + F.pillFar) / F.pillTicks).toFixed(3) : 0 } : NA,
      live: { strict: tele.crash ? strict : null, lax: tele.crash ? tele.crash.liveNear > 0 : null },
      firstShownPassAt: firstPass,
      firstAnyPassAt: anyPass,
      passWords: noBeats ? { shown: legacyShown === null ? NA : { passed: legacyShown }, muted: NA } : { shown: shownWords, muted: mutedWords },
      banners: F.banner || NA,
      pilot: tele.stunt || null,
    };
  };

  // Per-pilot fun summary: totals, means, and how many runs reached each moment.
  const funAgg = (runs) => {
    const n = runs.length;
    const num = (v) => (typeof v === 'number' ? v : null);
    const nums = (f) => runs.map(f).map(num).filter((v) => v !== null);
    const sum = (f) => nums(f).reduce((s, v) => s + v, 0);
    const mean = (f) => { const v = nums(f); return v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2) : NA; };
    const max = (f) => { const v = nums(f); return v.length ? Math.max(...v) : NA; };
    const runsWith = (f) => `${runs.filter((r) => { const v = f(r); return typeof v === 'number' && v > 0; }).length}/${n}`;
    const anyNA = (f) => runs.every((r) => f(r) === NA);
    const merge = (f) => { const o = {}; for (const r of runs) { const v = f(r); if (v && typeof v === 'object') for (const k of Object.keys(v)) if (typeof v[k] === 'number') o[k] = (o[k] || 0) + v[k]; } return o; };
    const fm = (r) => r.fun;
    const mis = runs.map((r) => fm(r).missions).filter((m) => m && m !== NA);
    const pill = runs.map((r) => fm(r).rivalPill).filter((p) => p && p !== NA);
    const gone = runs.map((r) => fm(r).fieldGoneAt);
    const delays = mis.flatMap((m) => m.delays);
    const lax = runs.filter((r) => fm(r).live.lax === true).length;
    const strict = runs.filter((r) => fm(r).live.strict === true).length;
    return {
      runs: n,
      flow: { maxShown: anyNA((r) => fm(r).flow.maxShown) ? NA : max((r) => fm(r).flow.maxShown), meanMaxShown: anyNA((r) => fm(r).flow.maxShown) ? NA : mean((r) => fm(r).flow.maxShown), maxSim: max((r) => fm(r).flow.maxSim), in: anyNA((r) => fm(r).flow.in) ? NA : sum((r) => fm(r).flow.in), snuff: anyNA((r) => fm(r).flow.snuff) ? NA : sum((r) => fm(r).flow.snuff), runsIn: runsWith((r) => fm(r).flow.in) },
      driftSim: merge((r) => fm(r).drift.sim),
      driftBeats: anyNA((r) => fm(r).drift.beats) ? NA : merge((r) => fm(r).drift.beats),
      runsWithTier2Plus: `${runs.filter((r) => fm(r).drift.sim.t2 + fm(r).drift.sim.t3 > 0).length}/${n}`,
      nearMissSim: sum((r) => fm(r).nearMiss.sim),
      nearMissSimGrade: merge((r) => fm(r).nearMiss.simGrade),
      nearMissBeats: anyNA((r) => fm(r).nearMiss.beats) ? NA : merge((r) => fm(r).nearMiss.beats),
      kickers: sum((r) => fm(r).kickers.hit),
      runsWithKicker: runsWith((r) => fm(r).kickers.hit),
      boostPops: sum((r) => fm(r).kickers.boostPops),
      draftSeconds: mean((r) => fm(r).drafts.seconds),
      slingshots: sum((r) => fm(r).drafts.slingshots),
      landings: merge((r) => fm(r).landings),
      tricks: merge((r) => fm(r).tricks),
      stompStreakPeak: anyNA((r) => fm(r).stompStreakPeak) ? NA : max((r) => fm(r).stompStreakPeak),
      hints: merge((r) => fm(r).hints),
      missions: mis.length ? { met: mis.reduce((s, m) => s + m.met, 0), popped: mis.reduce((s, m) => s + m.popped, 0), dropped: mis.reduce((s, m) => s + m.dropped, 0), meanDelay: delays.length ? +(delays.reduce((s, v) => s + v, 0) / delays.length).toFixed(2) : null, maxDelay: delays.length ? Math.max(...delays) : null } : NA,
      unlockPopAt: anyNA((r) => fm(r).unlockPopAt) ? NA : runs.map((r) => fm(r).unlockPopAt),
      fieldGoneAt: gone,
      fieldGoneMean: mean((r) => fm(r).fieldGoneAt),
      aheadAt30: runs.map((r) => (fm(r).aheadAt30 ? fm(r).aheadAt30.within150 : null)),
      aheadAt60: runs.map((r) => (fm(r).aheadAt60 ? fm(r).aheadAt60.within150 : null)),
      rivalPill: pill.length ? { ticks: pill.reduce((s, p) => s + p.ticks, 0), done: pill.reduce((s, p) => s + p.done, 0), far: pill.reduce((s, p) => s + p.far, 0) } : NA,
      live: { strict: `${strict}/${n}`, lax: `${lax}/${n}` },
      firstShownPassAt: mean((r) => fm(r).firstShownPassAt),
      passWordsShown: merge((r) => (fm(r).passWords.shown === NA ? null : fm(r).passWords.shown)),
      passWordsMuted: merge((r) => (fm(r).passWords.muted === NA ? null : fm(r).passWords.muted)),
      banners: merge((r) => fm(r).banners),
    };
  };

  const out = [];
  let seed = cfg.seed ?? 1234;
  for (const step of cfg.plan) {
    for (let i = 0; i < step.runs; i++) {
      const fresh = step.fresh || i === 0;
      const tier = step.tier || 'medium';
      if (fresh) {
        await page.goto(BASE + `?platform=mock&debug&tier=${tier}`);
        await page.evaluate(() => localStorage.clear());
      }
      const demo = step.demo ? `&demo=${step.demo}` : '';
      const dev = (step.mood ? `&mood=${step.mood}` : '') + (step.event ? `&event=${step.event}` : '');
      if (fresh) {
        await page.goto(BASE + `?platform=mock&debug&tier=${tier}&m=${step.m ?? 0}&autoride=1${demo}${dev}`);
        await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
      } else {
        await page.evaluate(() => window.__gs.runAgain());
        await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 30000 });
      }
      await installPilot(step.skill, seed++);
      await drive((cfg.maxSeconds + 40) * 1000);
      const tele = await page.evaluate(() => window.__tele);
      out.push(summarize(tele, { skill: step.skill, run: i + 1, m: step.m ?? 0 }));
      out[out.length - 1].intensitySeries = tele.intensity.filter((_, k) => k % 4 === 0).map((v) => [v[0], v[1], v[4]]);
    }
  }
  const agg = {};
  for (const r of out) {
    const g = (agg[r.skill] = agg[r.skill] || { runs: 0, seconds: 0, passesPerMin: 0, namedPerMin: 0, namedAllPerMin: 0, live: 0, strict: 0, liveFrac: 0, firstPass: [], firstNamed: [], meanI: 0, missionsMid: 0, gifts: 0 });
    g.runs++;
    g.seconds += r.seconds;
    g.passesPerMin += r.passesPerMin;
    g.namedPerMin += r.namedPerMin;
    g.live += r.raceLiveAtCrash ? 1 : 0;
    g.strict += r.raceLiveStrict ? 1 : 0;
    g.namedAllPerMin += r.namedAllPerMin || 0;
    g.gifts += r.gifts || 0;
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
      raceLiveStrict: `${g.strict}/${g.runs}`,
      namedAllPerMin: +(g.namedAllPerMin / g.runs).toFixed(2),
      giftsPerRun: +(g.gifts / g.runs).toFixed(1),
      raceLiveFraction: +(g.liveFrac / g.runs).toFixed(2),
      firstPassAt: g.firstPass.length ? +(g.firstPass.reduce((s, v) => s + v, 0) / g.firstPass.length).toFixed(1) : null,
      firstPassRuns: `${g.firstPass.length}/${g.runs}`,
      firstNamedAt: g.firstNamed.length ? +(g.firstNamed.reduce((s, v) => s + v, 0) / g.firstNamed.length).toFixed(1) : null,
      meanIntensity: +(g.meanI / g.runs).toFixed(3),
      missionsMidRun: g.missionsMid,
      fun: funAgg(out.filter((r) => r.skill === k)),
    };
  }
  return JSON.stringify({ label: cfg.label, agg, runs: out });
}
