// Audio capture, headless. Taps the master (the ceiling trim after the limiter, the last node before
// the speakers) with an AnalyserNode per channel, samples both every animation frame and returns the
// L/R RMS series in 128-sample blocks (2.7 ms, dBFS, on AudioContext time), a per-frame sub band
// (under 100 Hz), onset times and a marker for every sound the scenario fires. Where the director's
// side is not wired yet the scenarios fire synthetic beats through window.__gs.audio.beats() and
// raw events through simEvent(), in the app's order (beats first), so the engine path is the real one.
//
// Scenarios (window.__capCfg.scenarios; default: all):
//   cruise    20 s of a live plain run under a line pilot: the mix level and the band layers over time
//   drop      a 9,000 tier-2 bank: the band ducks into a gap before the figure lands, then the slam
//   massive   a 24,000 tier-3 bank: the cymbal swell, the gap, the slam
//   lost      a crash with 2,500 at stake: the stumble, the sub drop on the tonic, the hard duck
//   escape    outran the avalanche: the band drops out 0.45 s, then the fanfare lands on a slam
//   whisker   a Whisker on the left then on the right: the rush sits in that channel
//   stomp     the stomp metronome (ticks 0.45 and 0.30 s out, the open note 0.15 s out) and the
//             perfect landing it counts in: the ticks sit well under the landing chord
//   chimes    Best combo pace, New ground and New best, 1.6 s apart (three contours)
//   shoulder  a ghost 2 m to the left closing from 5.5 m to 0.5 m behind: the hiss sits left and
//             rises; then the same while drafting and under danger (silent)
//   results   the results card's timeline (engine.cueResults), one sound class at a time: every onset
//             against its CSS beat (30 ms), then reduced motion (everything at t = 0)
//   reveal    the reveal timeline (engine.cueReveal): the reel ticks and the slam at T_STAMP
//   cancel    the results timeline cut by cancelPending() at 400 ms (Run Again): nothing after
// Every scenario asserts the AudioContext is running (a real key press unlocks it first).
// Run against a preview build: playwright-cli -s=audio run-code --filename=scripts/playtest/audio-capture.js
// Set window.__capCfg = { base, scenarios } on the current page first.
async (page) => {
  const cfg = { scenarios: null, ...((await page.evaluate(() => window.__capCfg).catch(() => null)) || {}) };
  const BASE = cfg.base || 'http://127.0.0.1:4173/';
  const ALL = ['cruise', 'drop', 'massive', 'lost', 'escape', 'whisker', 'stomp', 'chimes', 'shoulder', 'results', 'reveal', 'cancel'];
  const list = cfg.scenarios || ALL;
  // Mirrors of reveal.ts REVEAL_TIMING and results.ts RESULTS_TIMING (the CSS beats).
  const REVEAL = { T_REEL: 80, REEL_MS: 660, T_STAMP: 740, T_RULE: 770, T_EVENT: 940, T_LEAVE: 1640, LEAVE_MS: 280 };
  const RESULTS = { COUNT_MS: 650, PLACE_MS: 300, NEW_BEST_MS: 560, BEAT_MS: 860, BEAT_STEP: 110, DONE_MS: 1050, DONE_STEP: 140, FLY_MS: 1470, FLY_STEP: 140, FLY_DUR: 680 };

  // ---------------------------------------------------------------- page side
  const install = () =>
    page.evaluate(() => {
      const app = window.__gs;
      const a = app.audio;
      const tap = a.debugTap();
      if (!tap) return { ok: false };
      const { ctx, out } = tap;
      const split = ctx.createChannelSplitter(2);
      out.connect(split);
      const an = [0, 1].map((i) => {
        const x = ctx.createAnalyser();
        x.fftSize = 8192; // 170 ms at 48 kHz: survives a slow frame without a gap in the series
        x.smoothingTimeConstant = 0;
        split.connect(x, i);
        return x;
      });
      const bufs = an.map((x) => new Float32Array(x.fftSize));
      const spec = new Float32Array(an[0].frequencyBinCount);
      const B = 128;
      const sr = ctx.sampleRate;
      const subBins = Math.max(1, Math.floor((100 / (sr / 2)) * spec.length));
      const db = (p) => (p > 1e-12 ? 10 * Math.log10(p) : -120);
      const cap = { t: [], l: [], r: [], pk: [], sub: [], markers: [], last: -1, on: true, frames: 0, sr };
      const tick = () => {
        if (!cap.on) return;
        const now = ctx.currentTime;
        an[0].getFloatTimeDomainData(bufs[0]);
        an[1].getFloatTimeDomainData(bufs[1]);
        const n = bufs[0].length;
        for (let b = 0; b < n / B; b++) {
          const tEnd = now - (n - (b + 1) * B) / sr;
          if (tEnd <= cap.last + 1e-6) continue;
          let sl = 0;
          let sr2 = 0;
          let pk = 0;
          for (let i = b * B; i < (b + 1) * B; i++) {
            const x = bufs[0][i];
            const y = bufs[1][i];
            sl += x * x;
            sr2 += y * y;
            const m = Math.max(Math.abs(x), Math.abs(y));
            if (m > pk) pk = m;
          }
          cap.t.push(+tEnd.toFixed(4));
          cap.l.push(+db(sl / B).toFixed(1));
          cap.r.push(+db(sr2 / B).toFixed(1));
          cap.pk.push(+(pk > 0 ? 20 * Math.log10(pk) : -120).toFixed(1));
        }
        // The sub band of the newest window (both channels share the low end): per frame.
        an[0].getFloatFrequencyData(spec);
        let e = 0;
        for (let k = 1; k <= subBins; k++) e += Math.pow(10, spec[k] / 10);
        cap.sub.push([+now.toFixed(4), +db(e).toFixed(1)]);
        cap.last = now;
        cap.frames++;
        requestAnimationFrame(tick);
      };
      cap.mark = (label) => cap.markers.push({ t: +ctx.currentTime.toFixed(4), label });
      cap.stop = () => {
        cap.on = false;
        try {
          out.disconnect(split);
        } catch {}
      };
      window.__cap = cap;
      window.__sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      // Pilot: the fairness test's driver holds the safe line, so a run lives through the capture.
      if (app.run && app.phase === 'run') {
        const sim = app.run.sim;
        const c = sim.course;
        const steerTo = (s) => {
          const look = s.z + 4 + s.speed * 0.35;
          const desired = Math.atan2(c.safeX(look) - s.x, look - s.z);
          const err = desired - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
          return Math.max(0, Math.min(8, Math.round(4 + err * 14)));
        };
        app.run.input = { sample: () => (sim.s.grounded ? { steer: steerTo(sim.s), action: false } : { steer: 4, action: false }) };
      }
      // Frame overrides (the shoulder, drafting, danger) ride on the app's own update() calls.
      if (!a.__wrapped) {
        const up = a.update;
        a.update = function (f, dt) {
          if (window.__inject) Object.assign(f, window.__inject(f));
          return up.call(this, f, dt);
        };
        // Moment scenarios hold the run's own one-shots (a pass or a gift landing in a 0.2 s gap
        // would mask it) and fire theirs through the unheld originals: the band, the ambience and
        // the engine path stay live.
        for (const k of ['beats', 'simEvent']) {
          const f = a[k];
          a['__' + k] = f.bind(a);
          a[k] = function (...args) {
            if (window.__hold) return undefined;
            return f.apply(this, args);
          };
        }
        a.__wrapped = true;
      }
      window.__hold = !!window.__holdNext;
      requestAnimationFrame(tick);
      return { ok: true, sr, running: a.debugLevels().running === 1 };
    });

  const open = async (query) => {
    await page.goto(BASE + '?platform=mock&debug&m=0&mood=0&event=0' + (query || ''));
    await page.waitForFunction(() => window.__gs && window.__gs.audio && (window.__gs.phase === 'title' || window.__gs.phase === 'run'), null, { timeout: 30000 });
    // A real key press is the gesture that lets the context start (q is bound to nothing).
    await page.keyboard.press('q');
    await page.waitForFunction(() => window.__gs.audio.debugLevels().running === 1, null, { timeout: 5000 }).catch(() => null);
    if (query && query.includes('autoride')) await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 30000 });
    // Diagnosis: window.__capCfg.volumes ({ master, music, sfx }) solos a bus for every scenario.
    if (cfg.volumes) await page.evaluate((v) => window.__gs.audio.setVolumes(v), cfg.volumes);
    await page.evaluate((h) => (window.__holdNext = h), hold);
    return install();
  };
  /** Every scenario but the cruise holds the run's own one-shots. */
  let hold = false;

  const collect = () =>
    page.evaluate(() => {
      const c = window.__cap;
      c.stop();
      return { t: c.t, l: c.l, r: c.r, pk: c.pk, sub: c.sub, markers: c.markers, frames: c.frames, sr: c.sr };
    });

  // ---------------------------------------------------------------- analysis (node side)
  const pow = (d) => Math.pow(10, d / 10);
  const mono = (s, i) => 10 * Math.log10((pow(s.l[i]) + pow(s.r[i])) / 2 + 1e-12);
  const median = (xs) => {
    if (!xs.length) return null;
    const v = [...xs].sort((a, b) => a - b);
    return +v[Math.floor(v.length / 2)].toFixed(3);
  };
  const windowDb = (s, a, b, ch) => {
    const out = [];
    for (let i = 0; i < s.t.length; i++) if (s.t[i] >= a && s.t[i] < b) out.push(ch === 'l' ? s.l[i] : ch === 'r' ? s.r[i] : mono(s, i));
    return out;
  };
  const meanPowDb = (xs) => (xs.length ? +(10 * Math.log10(xs.reduce((acc, d) => acc + pow(d), 0) / xs.length + 1e-12)).toFixed(1) : null);
  const peakIn = (s, a, b) => {
    let p = -120;
    for (let i = 0; i < s.t.length; i++) if (s.t[i] >= a && s.t[i] < b && s.pk[i] > p) p = s.pk[i];
    return p;
  };
  /** Onsets: a block 8 dB over the median of the previous 8 blocks (about 21 ms) and over -50 dBFS;
   *  25 ms refractory. */
  const onsets = (s, a = -1e9, b = 1e9, rise = 8, floor = -50) => {
    const out = [];
    let lastOn = -1;
    for (let i = 8; i < s.t.length; i++) {
      if (s.t[i] < a || s.t[i] >= b) continue;
      const prev = [];
      for (let k = i - 8; k < i; k++) prev.push(mono(s, k));
      prev.sort((x, y) => x - y);
      const base = prev[4];
      const m = mono(s, i);
      if (m > floor && m - base >= rise && s.t[i] - lastOn > 0.025) {
        // The onset sits at the start of the rising block.
        out.push(+(s.t[i] - 128 / s.sr).toFixed(4));
        lastOn = s.t[i];
      }
    }
    return out;
  };
  /** The sharpest attack (a block's peak over the louder of the two blocks before it) within win
   *  of t, if it rises at least minRise dB: the start of that block, else null. */
  const attackNear = (s, t, win, minRise) => {
    let best = null;
    let bestRise = minRise;
    for (let i = 2; i < s.t.length; i++) {
      if (s.t[i] < t - win || s.t[i] > t + win + 128 / s.sr) continue;
      const rise = s.pk[i] - Math.max(s.pk[i - 1], s.pk[i - 2]);
      if (rise >= bestRise) {
        bestRise = rise;
        best = s.t[i] - 128 / s.sr;
      }
    }
    return best;
  };
  const nearest = (xs, t) => xs.reduce((best, x) => (best === null || Math.abs(x - t) < Math.abs(best - t) ? x : best), null);
  const mark = (s, label) => (s.markers.find((m) => m.label === label) || {}).t;
  /** 20 ms mean-power windows (dBFS) from a to b, for reading a moment's shape by eye. */
  const env20 = (s, a, b) => {
    const out = [];
    for (let w = a; w < b - 1e-6; w += 0.02) out.push(meanPowDb(windowDb(s, w, w + 0.02)));
    return out.join(' ');
  };
  const subAt = (s, a, b) => {
    const v = s.sub.filter(([t]) => t >= a && t < b).map(([, d]) => d);
    return v.length ? Math.max(...v) : null;
  };

  // ---------------------------------------------------------------- scenarios
  const results = {};
  const fire = (js) => page.evaluate(js);

  for (const sc of list) {
    hold = sc !== 'cruise';
    try {
      if (sc === 'cruise') {
        const ins = await open('&autoride=1');
        const lv = await page.evaluate(async () => {
          const a = window.__gs.audio;
          window.__cap.mark('start');
          const rows = [];
          for (let k = 0; k < 40; k++) {
            await window.__sleep(500);
            const d = a.debugLevels();
            const r = window.__gs.run;
            rows.push([+(r ? r.sim.tick / 60 : 0).toFixed(1), +d.intensity.toFixed(3), +(d.bass ?? 0).toFixed(2), +(d.hat ?? 0).toFixed(2), +(r ? r.sim.s.speed : 0).toFixed(1), window.__gs.phase]);
          }
          return rows;
        });
        const s = await collect();
        const t0 = mark(s, 'start');
        const body = windowDb(s, t0 + 4, t0 + 20);
        const after4 = lv.filter((r) => r[0] >= 4 && r[5] === 'run');
        results.cruise = {
          running: ins.running,
          rmsDb: meanPowDb(body),
          peakDb: peakIn(s, t0 + 4, t0 + 20),
          bassAudibleShare: after4.length ? +(after4.filter((r) => r[2] > 0.15).length / after4.length).toFixed(2) : null,
          hatAudibleShare: after4.length ? +(after4.filter((r) => r[3] > 0.15).length / after4.length).toFixed(2) : null,
          medianIntensity: median(after4.map((r) => r[1])),
          levels: lv,
        };
      } else if (sc === 'drop' || sc === 'massive') {
        const ins = await open('&autoride=1');
        const tier = sc === 'drop' ? 2 : 3;
        const points = sc === 'drop' ? 9000 : 24000;
        await page.evaluate(() => window.__sleep(5000)); // the band up to cruise
        await page.evaluate(({ tier, points }) => {
          const a = window.__gs.audio;
          window.__cap.mark('bank');
          a.__beats([{ type: 'bank', tick: 0, points, mult: 8, origin: Math.round(points / 8), tier, header: tier === 3 ? 'Massive' : null, bump: false }]);
          a.__simEvent({ type: 'comboBank', points, mult: 8 });
        }, { tier, points });
        await page.evaluate(() => window.__sleep(2500));
        const s = await collect();
        const tb = mark(s, 'bank') + 0.006;
        const land = tb + 0.12 + (tier === 2 ? 0.6 : 0.9);
        const before = meanPowDb(windowDb(s, tb - 1.2, tb - 0.05));
        const gap = meanPowDb(windowDb(s, land - 0.17, land - 0.03));
        const slamOn = nearest(onsets(s, land - 0.08, land + 0.08, 6), land);
        results[sc] = {
          running: ins.running,
          beforeDb: before,
          gapDb: gap,
          dropDb: before !== null && gap !== null ? +(before - gap).toFixed(1) : null,
          slamPeakDb: peakIn(s, land - 0.01, land + 0.15),
          slamOnsetErrMs: slamOn !== null ? Math.round((slamOn - land) * 1000) : null,
          onsets: onsets(s, tb - 0.05, land + 0.3).map((t) => Math.round((t - tb) * 1000)),
          env20FromLandMinus400: env20(s, land - 0.4, land + 0.2),
        };
      } else if (sc === 'lost') {
        const ins = await open('&autoride=1');
        await page.evaluate(() => window.__sleep(5000));
        await page.evaluate(() => {
          const a = window.__gs.audio;
          window.__cap.mark('lost');
          a.__beats([
            { type: 'comboLost', tick: 0, points: 500, stake: 2500, best: false, crack: true },
            { type: 'crash', tick: 0, cause: 'tree', stake: 2500, orbitFrom: null },
          ]);
          a.__simEvent({ type: 'comboLost', points: 500 });
          a.__simEvent({ type: 'crash', cause: 'tree' });
        });
        await page.evaluate(() => window.__sleep(2000));
        const s = await collect();
        const t = mark(s, 'lost');
        results.lost = {
          running: ins.running,
          subBeforeDb: subAt(s, t - 1, t - 0.05),
          subAfterDb: subAt(s, t + 0.02, t + 0.6),
          subLateDb: subAt(s, t + 0.9, t + 1.4),
          beforeDb: meanPowDb(windowDb(s, t - 1, t - 0.05)),
          duckWindowDb: meanPowDb(windowDb(s, t + 0.45, t + 0.25 + 0.7)),
        };
      } else if (sc === 'escape') {
        const ins = await open('&autoride=1');
        await page.evaluate(() => window.__sleep(5000));
        await page.evaluate(() => {
          const a = window.__gs.audio;
          window.__cap.mark('escape');
          a.__beats([{ type: 'finale', tick: 0, event: 1, outcome: 'outran', text: 'Outran the avalanche', sub: '+2,000 style', gifts: 0, grade: 1, banner: true, stamp: false }]);
          a.__simEvent({ type: 'chaos', phase: 'success', event: 1 });
          a.__simEvent({ type: 'style', kind: 'avalanche', points: 2000, chain: 1, mult: 1 });
        });
        await page.evaluate(() => window.__sleep(2000));
        const s = await collect();
        const t = mark(s, 'escape') + 0.006;
        const slamOn = nearest(onsets(s, t + 0.35, t + 0.55, 6), t + 0.45);
        results.escape = {
          running: ins.running,
          beforeDb: meanPowDb(windowDb(s, t - 1, t - 0.05)),
          dropOutDb: meanPowDb(windowDb(s, t + 0.1, t + 0.42)),
          slamOnsetErrMs: slamOn !== null ? Math.round((slamOn - t - 0.45) * 1000) : null,
          slamPeakDb: peakIn(s, t + 0.44, t + 0.6),
        };
      } else if (sc === 'whisker') {
        const ins = await open('&autoride=1');
        await page.evaluate(async () => {
          const a = window.__gs.audio;
          a.setVolumes({ master: 1, music: 0, sfx: 1 });
          await window.__sleep(2500);
          for (const side of [-1, 1]) {
            window.__cap.mark(side < 0 ? 'left' : 'right');
            a.__beats([{ type: 'nearMiss', tick: 0, grade: 'whisker', gap: 0.12, side, x: 0, z: 0, obs: 'pine', speed: 24 }]);
            a.__simEvent({ type: 'style', kind: 'nearMiss', points: 120, chain: 3, mult: 2, side });
            await window.__sleep(1200);
          }
        });
        const s = await collect();
        const side = (label) => {
          const t = mark(s, label);
          const L = meanPowDb(windowDb(s, t, t + 0.25, 'l'));
          const R = meanPowDb(windowDb(s, t, t + 0.25, 'r'));
          return { lDb: L, rDb: R, lrDb: +(L - R).toFixed(1) };
        };
        results.whisker = { running: ins.running, left: side('left'), right: side('right') };
      } else if (sc === 'stomp') {
        const ins = await open('&autoride=1');
        await page.evaluate(async () => {
          const a = window.__gs.audio;
          a.setVolumes({ master: 1, music: 0, sfx: 1 });
          await window.__sleep(2500);
          const at = [[3, false], [4, false], [5, true]];
          window.__cap.mark('first');
          for (const [step, open] of at) {
            window.__cap.mark('tick' + step);
            a.__beats([{ type: 'stompTick', tick: 0, step, open }]);
            await window.__sleep(150);
          }
          window.__cap.mark('land');
          a.__beats([{ type: 'stomp', tick: 0, streak: 1, late: false, title: 'Perfect landing', lead: [], x: 0, z: 0, heading: 0, yetiHop: false }]);
          a.__simEvent({ type: 'style', kind: 'perfect', points: 400, chain: 2, mult: 1 });
          a.__simEvent({ type: 'land', quality: 'perfect', airtime: 1.2, halfTurns: 0, flips: 0, impact: 8, late: false });
          await window.__sleep(1500);
        });
        const s = await collect();
        const tl = mark(s, 'land');
        const ticks = [3, 4, 5].map((k) => {
          const t = mark(s, 'tick' + k);
          return { step: k, peakDb: peakIn(s, t, t + 0.12), onsetMs: (() => { const o = nearest(onsets(s, t - 0.02, t + 0.06, 6, -60), t + 0.006); return o !== null ? Math.round((o - t) * 1000) : null; })() };
        });
        results.stomp = { running: ins.running, ticks, landPeakDb: peakIn(s, tl, tl + 0.5), marginDb: +(peakIn(s, tl, tl + 0.5) - Math.max(...ticks.map((x) => x.peakDb))).toFixed(1) };
      } else if (sc === 'chimes') {
        const ins = await open('&autoride=1');
        await page.evaluate(async () => {
          const a = window.__gs.audio;
          a.setVolumes({ master: 1, music: 0, sfx: 1 });
          await window.__sleep(2500);
          const list = [
            ['pace', { type: 'bestComboPace', tick: 0, stake: 2400 }],
            ['ground', { type: 'newGround', tick: 0, z: 1240 }],
            ['best', { type: 'newBest', tick: 0, score: 5100 }],
          ];
          for (const [label, b] of list) {
            window.__cap.mark(label);
            a.__beats([b]);
            await window.__sleep(1600);
          }
        });
        const s = await collect();
        const one = (label) => {
          const t = mark(s, label);
          const on = onsets(s, t - 0.01, t + 1.2, 5, -60).map((x) => Math.round((x - t) * 1000));
          return { onsetsMs: on, peakDb: peakIn(s, t, t + 1.2), rmsDb: meanPowDb(windowDb(s, t, t + 1.2)) };
        };
        results.chimes = { running: ins.running, pace: one('pace'), ground: one('ground'), best: one('best') };
      } else if (sc === 'shoulder') {
        const ins = await open('&autoride=1');
        await page.evaluate(async () => {
          const a = window.__gs.audio;
          a.setVolumes({ master: 1, music: 0, sfx: 1 });
          await window.__sleep(2500);
          const run = async (label, extra) => {
            window.__cap.mark(label + '-off');
            window.__inject = null;
            await window.__sleep(1000);
            window.__cap.mark(label);
            const t0 = performance.now();
            window.__inject = () => {
              const k = Math.min(1, (performance.now() - t0) / 3000);
              const gap = 5.5 - 5 * k; // metres behind
              return { shoulder: { amt: Math.pow(1 - gap / 6, 2), pan: Math.max(-0.85, Math.min(0.85, -2 / 3)) }, ...extra };
            };
            await window.__sleep(3000);
            window.__cap.mark(label + '-end');
          };
          await run('plain', {});
          await run('drafting', { drafting: true });
          await run('danger', { danger: 0.6 });
          window.__inject = null;
        });
        const s = await collect();
        const part = (label) => {
          const off = mark(s, label + '-off');
          const t = mark(s, label);
          const lr = (a, b) => {
            const L = meanPowDb(windowDb(s, a, b, 'l'));
            const R = meanPowDb(windowDb(s, a, b, 'r'));
            return { lDb: L, rDb: R, lrDb: +(L - R).toFixed(1) };
          };
          return { off: lr(off + 0.3, t), early: lr(t + 0.3, t + 1.2), close: lr(t + 2.1, t + 3) };
        };
        results.shoulder = { running: ins.running, plain: part('plain'), drafting: part('drafting'), danger: part('danger') };
      } else if (sc === 'results' || sc === 'cancel') {
        const ins = await open('');
        const R = RESULTS;
        // Stamps of one class overlap at the card's real steps (a mission chime is 240 ms long, the
        // next starts 140 ms later), so the stamp classes run on a spread timeline: index i at its
        // class's start + SPREAD * i. That checks every index's placement without one chime masking
        // the next; each class's start and the whole count run on the real timings.
        const SPREAD = 1000;
        const spread = { ...R, BEAT_STEP: SPREAD, DONE_STEP: SPREAD, FLY_STEP: SPREAD };
        const expect = {
          tick: Array.from({ length: 10 }, (_, i) => (R.COUNT_MS * (1 - Math.cbrt(1 - (i + 1) / 10))) / 1000),
          // The same count stretched 10x: all ten ticks resolvable (the first five sit 25 ms apart on
          // the real count, closer than the attack finder can always split).
          tickSlow: Array.from({ length: 10 }, (_, i) => (10 * R.COUNT_MS * (1 - Math.cbrt(1 - (i + 1) / 10))) / 1000),
          stamp: [R.PLACE_MS / 1000],
          mallet: [0, 1, 2].map((i) => (R.BEAT_MS + SPREAD * i) / 1000),
          mission: [0, 1].map((i) => (R.DONE_MS + SPREAD * i) / 1000),
          coin: [0, 1].map((i) => (R.FLY_MS + R.FLY_DUR + SPREAD * i) / 1000),
          newBestChord: [R.NEW_BEST_MS / 1000],
        };
        if (sc === 'cancel') {
          await page.evaluate(async (R) => {
            const a = window.__gs.audio;
            a.setVolumes({ master: 1, music: 0, sfx: 1 });
            await window.__sleep(800);
            window.__cap.mark('open');
            a.cueResults({ count: true, newBest: true, beats: 3, missions: 2, coins: 2 }, R, false);
            await window.__sleep(400);
            window.__cap.mark('cancel');
            a.cancelPending();
            await window.__sleep(2600);
          }, R);
          const s = await collect();
          const tc = mark(s, 'cancel');
          const stray = onsets(s, tc + 0.05, tc + 2.5, 6, -60).map((t) => Math.round((t - tc) * 1000));
          results.cancel = { running: ins.running, straysAfterCancelMs: stray, tailDb: meanPowDb(windowDb(s, tc + 0.9, tc + 2.4)) };
          continue;
        }
        // One sound class at a time, so nothing masks an onset.
        const runs = [
          ['tick', { count: true, newBest: false, beats: 0, missions: 0, coins: 0, noStamp: true }, 1200],
          ['tickSlow', { count: true, newBest: false, beats: 0, missions: 0, coins: 0, noStamp: true, slow: true }, 7000],
          ['stamp', { count: false, newBest: false, beats: 0, missions: 0, coins: 0 }, 1200],
          ['mallet', { count: false, newBest: false, beats: 3, missions: 0, coins: 0, noStamp: true, spread: true }, 3400],
          ['mission', { count: false, newBest: false, beats: 0, missions: 2, coins: 0, noStamp: true, spread: true }, 2800],
          ['coin', { count: false, newBest: false, beats: 0, missions: 0, coins: 2, noStamp: true, spread: true }, 3900],
          ['newBestChord', { count: false, newBest: true, beats: 0, missions: 0, coins: 0, noStamp: true }, 2000],
          ['reduced', { count: true, newBest: true, beats: 3, missions: 2, coins: 2, reduced: true }, 2000],
        ];
        await page.evaluate(() => window.__gs.audio.setVolumes({ master: 1, music: 0, sfx: 1 }));
        await page.evaluate(() => window.__sleep(800));
        for (const [label, r, ms] of runs) {
          await page.evaluate(
            async ({ label, r, R, spread, ms }) => {
              const a = window.__gs.audio;
              // The stamp always plays with the card; mute it out of the classes it would mask by
              // starting those runs on a stamp-free timeline (PLACE_MS pushed far past the capture).
              let t = r.spread ? spread : R;
              if (r.slow) t = { ...t, COUNT_MS: 10 * R.COUNT_MS };
              if (r.noStamp) t = { ...t, PLACE_MS: 60000 };
              window.__cap.mark(label);
              a.cueResults(r, t, r.reduced === true);
              await window.__sleep(ms);
              a.cancelPending();
              await window.__sleep(400);
            },
            { label, r, R, spread, ms },
          );
        }
        const s = await collect();
        const out = { running: ins.running };
        for (const [label, , ms] of runs) {
          const t0 = mark(s, label) + 0.006;
          if (label === 'reduced') {
            const found = onsets(s, t0 - 0.03, t0 + ms / 1000, 6, -62);
            out.reduced = { onsetsMs: found.map((x) => Math.round((x - t0) * 1000)), allNearZero: found.length > 0 && found.every((x) => x - t0 < 0.06) };
            continue;
          }
          // Each expected beat: the sharpest attack near it. The count's ticks are 25 ms apart at
          // the start, so their window is narrower than the spacing. (The new-best arpeggio starts
          // 420 ms early; its chord is the attack at NEW_BEST_MS.)
          // Windows centre 6 ms late: the block grid and the attack ramps read that late everywhere
          // (the stamp, missions and coins all measure +4 to +7 ms).
          const win = label === 'tick' ? 0.012 : 0.04;
          const rise = label.startsWith('tick') ? 4 : label === 'newBestChord' ? 3 : 6;
          const errs = expect[label].map((w) => {
            const o = attackNear(s, t0 + w + 0.006, win, rise);
            return o === null ? null : Math.round((o - t0 - w) * 1000);
          });
          const hit = errs.filter((e) => e !== null);
          out[label] = { expectedMs: expect[label].map((w) => Math.round(w * 1000)), errMs: errs, found: hit.length + '/' + errs.length, within30: hit.length > 0 && hit.every((e) => Math.abs(e) <= 30), allFound: hit.length === errs.length };
        }
        results.results = out;
      } else if (sc === 'reveal') {
        const ins = await open('');
        await page.evaluate(async (T) => {
          const a = window.__gs.audio;
          a.setVolumes({ master: 1, music: 0, sfx: 1 });
          await window.__sleep(800);
          window.__cap.mark('reveal');
          a.cueReveal(T, false);
          await window.__sleep(2000);
          window.__cap.mark('reduced');
          a.cueReveal(T, true);
          await window.__sleep(1200);
        }, REVEAL);
        const s = await collect();
        const t0 = mark(s, 'reveal') + 0.006;
        const found = onsets(s, t0 - 0.02, t0 + 1.2, 5, -62);
        const slam = nearest(found, t0 + REVEAL.T_STAMP / 1000);
        const tr = mark(s, 'reduced') + 0.006;
        const slamR = nearest(onsets(s, tr - 0.02, tr + 0.6, 6, -62), tr + 0.2);
        results.reveal = {
          running: ins.running,
          onsetsMs: found.map((x) => Math.round((x - t0) * 1000)),
          slamErrMs: slam !== null ? Math.round((slam - t0 - REVEAL.T_STAMP / 1000) * 1000) : null,
          reducedSlamErrMs: slamR !== null ? Math.round((slamR - tr - 0.2) * 1000) : null,
        };
      }
    } catch (err) {
      results[sc] = { error: String(err && err.message ? err.message : err) };
    }
  }
  const running = Object.values(results).every((r) => !r || r.error || r.running !== false);
  return JSON.stringify({ allRunning: running, results }, null, 1);
}
