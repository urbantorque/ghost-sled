// Beat strips: short frame sequences around the game's named moments, for the play-test phase. Each
// strip is 4 to 6 screenshots: after a director beat lands (frame 0 is the frame the beat was named
// in, keyed on window.__gs.director.log), or, for a place you ride up to (a km arch, a graveyard
// cairn), at set distances before and just past it. Every frame carries a probe (camera mode, roll,
// jolt, crash hold, FOV, the time scale, the director's feel, the tags on screen, what the HUD says
// and which banners are mid-transition), so a strip can be read as numbers too.
//
// USAGE (against a preview build; headless only, a headed browser drops to 2 fps when the display
// sleeps):
//   npx vite build && npx vite preview --port 4182 --host 127.0.0.1 --strictPort
//   playwright-cli -s=gs open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=gs goto http://127.0.0.1:4182/
//   playwright-cli -s=gs eval "window.__stripCfg = { label: 'fun', moments: ['slung', 'missionPop'], fresh: true }"
//   playwright-cli -s=gs run-code --filename=scripts/playtest/strips.js > strips.json
// (A phone: open the session with .playwright/mobile-headless.config.json instead.) The JSON comes
// back on stdout; run-code has no file system, so redirect it. PNGs go to cfg.out.
//
// The default plan rides REAL runs with the merged director, for the fun panel: a pass, Slung past
// (N), Passed Your best (C7), a duel opening and its result, Mission done, New ground, a whisker, a
// stomp streak (2 and 5 or more in a row), drift tier 3 release, bank tier 3, km arch, graveyard,
// finale and the crash orbit, plus a held drift's spray heating through tiers 1 to 3, earned flow
// on the rider and 'In the flow' (each when a run earns it: maxPerType counts it, a run that never
// does leaves it unstripped). Two plans cover the panel between them: the default rivals save (your
// best rides as a ghost, New ground, Passed Your best, a nemesis, a friend) and fresh: true (a first
// visit: the opening slingshot through the bunch and 'Mission done: Pass a ghost' after the first
// pass).
//
// The game runs on a virtual clock while strips are taken: requestAnimationFrame, performance.now and
// setTimeout are driven from here in exact 1/60 s steps, so a screenshot never costs game time and
// every strip is frame-exact (the crash beat's held frame, the 950 or 1,150 ms results). CSS and
// WAAPI animations (banner entries and exits, the race row's fade back, HUD stamps, tag rings) follow
// it too (animClock): each is paused the frame it appears and seeked by the frame's time, so a frozen
// strip never shows a banner half gone over the race row from the wall-clock time a screenshot took.
// Frames caught while a banner or stamp is part way through a transition are still real, and listed
// per strip in midFrames (each probe's bannerMid and anims say which and how far). The clock and the
// paused animations are handed back to the browser before the script returns, error or not:
// playwright-cli waits on the page's own setTimeout after every command, so a page left on the
// virtual clock hangs the next command.
//
// Set window.__stripCfg on the current page first (any page of the build) to change the plan:
//   {
//     label: 'fun',                        // file name prefix
//     base: 'http://127.0.0.1:4182/',
//     params: 'tier=medium&m=0&event=3',   // extra URL parameters (mood=N, event=N, demo=N, tier, m)
//     out: 'C:/.../shots/strips',          // absolute folder for the PNGs
//     moments: ['pass', 'crash'],          // names from MOMENTS below (default: all but duelWon)
//     beats: ['stomp'],                    // also strip these raw director.log types, any entry
//     frames: [0, 4, 10, 18, 30],          // frame offsets for the raw beats
//     maxPerType: 1, maxSeconds: 150, after: 0,   // after: ignore beats before this run time (s)
//     pilot: 'show',                       // 'show' | 'mid' | 'expert' | 'novice' | 'line' | 'none'
//     seed: 4321,                          // the pilot's seed for the first run (+1 each run)
//     rivals: true,                        // a seeded save: your best near 330 m (the gold band), best
//                                          // combo 1,600 (a bigger bank is a real tier 3), a nemesis
//                                          // grudge and a friend's challenge link, all from the pool
//     bestReplay: true,                    // with rivals: your best is a pool run's replay, so 'Your
//                                          // best' rides in the field (false: the band only)
//     fresh: false,                        // a first visit instead (no save at all; rivals off)
//     save: null,                          // or your own: { 'ghostsled.save.v1': {...} }
//     standIns: true,                      // the paths a pilot or this tree cannot reach (below)
//     reduced: false,                      // emulate prefers-reduced-motion: reduce
//     animClock: true,                     // CSS and WAAPI animations on the virtual clock
//     synth: false,                        // legacy stand-ins for an unmerged director (below)
//     runs: 3,                             // runs to ride (Run Again between them) until all are stripped
//   }
// standIns: true covers, and only until each is stripped once, the paths a scripted pilot (or this
// tree) cannot reach: (1) the graveyards: when nothing placed any, the script finds the pool's crash
// clusters (3 or more within 8 m) and calls the real world.setGraveyards at the run's start; (2) drift
// tier 3: the pilot's drifts run under a second, so while one is held the sled's drift charge is
// topped up past tier 3's 2.4; (3) bank tier 3: the pilot's combos bank under 1,500, so once a combo
// holds 3 skill moves its pending pool is raised to bank just over your best combo. In each case the
// sim event, the director's beat and grading, and every consumer (HUD, camera, world, sound) are
// real. Counts are reported in the JSON (standIns). Everything else (slung, passes, duels, missions,
// New ground, stomps, whiskers, flow, the crash) is the pilot's own riding.
// The show pilot is the expert's hands (spins, tight stomps) that also rides at the next ghost's line
// (duels) and, until a whisker is stripped, aims to pass a hazard near the line a quarter metre off its
// edge at speed (the sim grades the real gap).
// synth: true adds, only where the director has not named them, a crash beat with orbitFrom (and the
// crash render curve), a bump beat with its side and ghostTrick beats. The director now names all of
// them, so it is off by default and kept for older trees.
// Returns JSON: { label, reduced, rivals, counts, standIns, runs, error,
//   strips: [{ moment, type, t, label, lag, files, probes, midFrames }] }.
async (page) => {
  /** The named moments: a director.log match and frame offsets, or a place ridden up to and the
   *  distances (metres, negative before it) at which to take each frame. */
  const MOMENTS = {
    pass: { type: 'pass', named: true, frames: [0, 5, 12, 22, 36] },
    // A slingshot pass ('Slung past', or 'Slung past N' through a bunch): the HUD text is in the probes.
    slung: { type: 'pass', named: true, word: 'slung', frames: [0, 4, 10, 18, 30] },
    // Contract C7: a shown pass of your own best ghost (needs a best with a replay: rivals does that).
    passYourBest: { type: 'pass', named: true, you: true, frames: [0, 5, 12, 22, 36] },
    // A duel opening, and its result (won, held off or lost). Same camera nudge.
    duelOpen: { type: 'duel', grade: 'open', frames: [0, 6, 14, 30] },
    duelResult: { type: 'duel', grade: ['won', 'heldOff', 'lost'], frames: [0, 5, 12, 22, 36, 60] },
    // (The older name: a duel that pays, won or held off. Not in the default plan; duelResult covers it.)
    duelWon: { type: 'duel', grade: ['won', 'heldOff'], frames: [0, 5, 12, 22, 36] },
    // 'Mission done' mid-run (on a fresh save the first one is 'Pass a ghost', after the first pass).
    missionPop: { type: 'missionPop', frames: [0, 6, 14, 30, 60, 100] },
    // Crossing your best distance: the gold band's flare and the 'New ground' callout.
    newGround: { type: 'newGround', frames: [0, 4, 10, 20, 36] },
    whisker: { type: 'nearMiss', grade: 'whisker', frames: [0, 2, 5, 9, 16] },
    stompStreak: { type: 'stomp', minTier: 2, frames: [0, 3, 7, 12, 20, 32] },
    // 'Stomp streak N' proper (five in a row or more).
    stomp5: { type: 'stomp', minTier: 5, frames: [0, 3, 7, 12, 20, 32] },
    drift3: { type: 'driftRelease', tier: 3, frames: [0, 3, 7, 12, 20, 32] },
    // A held drift's spray heating through its tiers (the first frame each tier shows).
    heat1: { state: 'driftTier', tier: 1, frames: [0, 4, 8] },
    heat2: { state: 'driftTier', tier: 2, frames: [0, 4, 8] },
    heat3: { state: 'driftTier', tier: 3, frames: [0, 4, 8] },
    // Earned flow burning on the rider (Feel.flow past 0.6: the rim, the scarf and the wider lens),
    // and the 'In the flow' beat itself when a run earns it.
    flow: { state: 'flow', min: 0.6, frames: [0, 6, 12] },
    flowIn: { type: 'flow', grade: 'in', frames: [0, 4, 9, 16, 26] },
    bank3: { type: 'bank', tier: 3, frames: [0, 10, 24, 44, 70, 104] },
    km: { approach: 'km', at: [-60, -38, -20, -8, 1] },
    graveyard: { approach: 'grave', at: [-70, -45, -28, -14, -5] },
    finale: { type: 'finale', frames: [0, 8, 24, 48, 90] },
    // Impact, the held frame, its slow motion, just before and after the cut to the pack, the orbit.
    crash: { type: 'crash', frames: [0, 12, 36, 47, 53, 66] },
  };
  const defaults = {
    label: 'fun',
    base: 'http://127.0.0.1:4182/',
    params: 'tier=medium&m=0&event=3',
    out: null,
    moments: Object.keys(MOMENTS).filter((k) => k !== 'duelWon'),
    beats: [],
    frames: [0, 4, 10, 18, 30],
    maxPerType: 1,
    maxSeconds: 150,
    after: 0,
    pilot: 'show',
    rivals: true,
    standIns: true,
    reduced: false,
    synth: false,
    save: null,
    fresh: false,
    bestReplay: true,
    animClock: true,
    seed: 4321,
    runs: 3,
  };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__stripCfg).catch(() => null)) || {}) };
  if (cfg.fresh) cfg.rivals = false;
  const out = (cfg.out || 'shots/strips').replace(/\\/g, '/').replace(/\/$/, '');
  await page.emulateMedia({ reducedMotion: cfg.reduced ? 'reduce' : 'no-preference' });
  // Every wanted thing to strip: the named moments, then any raw beat types.
  const wants = [
    ...cfg.moments.filter((m) => MOMENTS[m]).map((m) => ({ key: m, ...MOMENTS[m] })),
    ...cfg.beats.map((b) => ({ key: b, type: b, frames: cfg.frames })),
  ];
  let extra = '';
  if (cfg.save || cfg.rivals || cfg.fresh) {
    await page.goto(`${cfg.base}?platform=mock&debug&${cfg.params}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 30000 });
    if (cfg.fresh) {
      // A first visit: nothing stored, so the first run is the session's first (plain) and its
      // missions are the starters ('Pass a ghost' first).
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) if (/ghost/i.test(k)) localStorage.removeItem(k);
      });
    } else if (cfg.save) {
      await page.evaluate((s) => {
        for (const k of Object.keys(localStorage)) if (/ghost/i.test(k)) localStorage.removeItem(k);
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }, cfg.save);
    } else {
      // The rivals save, built from this mountain's own pool: a best near 330 m (with bestReplay, the
      // replay of the pool run nearest it, so 'Your best' rides in the field and can be passed;
      // without, no replay, only the gold band), a best combo of 1,600, a grudge on a three-run
      // streak (a nemesis) and, through the URL, a friend's challenge. Everything else is defaulted
      // by load().
      const link = await page.evaluate((bestReplay) => {
        const app = window.__gs;
        const key = app.mountain.id;
        const pool = app.poolForMountain(app.mountain).slice().sort((a, b) => a.distance - b.distance);
        const near = (d, not = []) => pool.filter((g) => !not.includes(g)).reduce((best, g) => (Math.abs(g.distance - d) < Math.abs(best.distance - d) ? g : best));
        const grudge = near(520);
        const friend = near(760, [grudge]);
        const own = bestReplay ? near(330, [grudge, friend]) : null;
        for (const k of Object.keys(localStorage)) if (/ghost/i.test(k)) localStorage.removeItem(k);
        const save = {
          v: 1,
          name: 'Tester',
          gifts: 120,
          lifetimeGifts: 400,
          ghostsPassed: 30,
          runs: 12,
          mountain: key,
          best: { [key]: own ? { score: Math.min(2500, own.score), distance: own.distance, record: own.record } : { score: 2500, distance: 330, record: '' } },
          grudge: { [key]: { name: grudge.name, score: grudge.score, record: grudge.record, them: 3, streak: 3, by: 40, distance: grudge.distance } },
          stats: { bestScore: 2500, bestCombo: 1600, longestAir: 2, perfects: 20, topSpeed: 30, yetiHops: 0, avalanches: 0 },
          runDists: { [key]: [300, 340, 310, 360, 330] },
        };
        localStorage.setItem('ghostsled.save.v1', JSON.stringify(save));
        return { c: friend.record, friend: friend.name, friendAt: Math.round(friend.distance), grudge: grudge.name, grudgeAt: Math.round(grudge.distance), bestAt: own ? Math.round(own.distance) : 330, bestReplay: !!own };
      }, cfg.bestReplay);
      extra = `&c=${encodeURIComponent(link.c)}`;
      cfg.rivalsInfo = { friend: link.friend, friendAt: link.friendAt, grudge: link.grudge, grudgeAt: link.grudgeAt, bestAt: link.bestAt, bestReplay: link.bestReplay };
    }
  }
  const url = `${cfg.base}?platform=mock&debug&autoride=1&${cfg.params}${extra}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 30000 });

  // The virtual clock. CSS and WAAPI animations follow it too (animClock): each one is paused the
  // frame it first appears and then seeked by exactly the frame's time, so a banner's entry, hold
  // and exit, the race row's fade back and every stamp hold still while a strip freezes on a beat
  // (on the wall clock they ran on during screenshots, and frozen strips showed banners double
  // exposed over the race row).
  await page.evaluate((animClock) => {
    if (window.__vc && window.__vc.on) return;
    const orig = {
      now: performance.now.bind(performance),
      raf: window.requestAnimationFrame.bind(window),
      caf: window.cancelAnimationFrame.bind(window),
      st: window.setTimeout.bind(window),
      ct: window.clearTimeout.bind(window),
    };
    const vc = { t: performance.now(), q: [], timers: [], id: 1, frames: 0, on: true, anims: new Set() };
    window.__vc = vc;
    // Animations: the ones already seen are advanced by dt (finished once past their end, so their
    // finish events and promises fire in step); new ones are caught and paused at their start.
    const seekAnims = (dt) => {
      for (const an of vc.anims) {
        try {
          if (an.playState === 'idle' || an.playState === 'finished') {
            vc.anims.delete(an);
            continue;
          }
          const end = an.effect ? an.effect.getComputedTiming().endTime : Infinity;
          const t = (Number(an.currentTime) || 0) + dt * (an.playbackRate || 1);
          if (Number.isFinite(end) && t >= end) {
            an.finish();
            vc.anims.delete(an);
          } else an.currentTime = t;
        } catch (e) {
          vc.anims.delete(an);
        }
      }
    };
    const catchAnims = () => {
      for (const an of document.getAnimations()) {
        if (vc.anims.has(an) || an.playState === 'finished' || an.playState === 'idle' || an.__vcLet) continue;
        try {
          an.pause();
          vc.anims.add(an);
        } catch (e) {
          an.__vcLet = true;
        }
      }
    };
    // Back to the browser's clock, carrying on from the virtual time (no jump either way), with the
    // queued frame callbacks, timers and paused animations handed over.
    vc.restore = () => {
      if (!vc.on) return;
      vc.on = false;
      const off = orig.now() - vc.t;
      performance.now = () => orig.now() - off;
      // Frame timestamps stay on the same clock as performance.now (a raw browser timestamp, ahead by
      // the time spent on the virtual clock, sent an unclamped count-up on the results card wild).
      window.requestAnimationFrame = (cb) => orig.raf((ts) => cb(ts - off));
      window.cancelAnimationFrame = orig.caf;
      window.setTimeout = orig.st;
      window.clearTimeout = orig.ct;
      for (const cb of vc.q) window.requestAnimationFrame(cb);
      for (const x of vc.timers) orig.st(x.fn, Math.max(0, x.at - vc.t));
      vc.q = [];
      vc.timers = [];
      for (const an of vc.anims) {
        try {
          if (an.playState === 'paused') an.play();
        } catch (e) {
          // (a cancelled animation stays cancelled)
        }
      }
      vc.anims.clear();
    };
    performance.now = () => vc.t;
    window.requestAnimationFrame = (cb) => {
      vc.q.push(cb);
      return vc.id++;
    };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn, ms, ...a) => {
      const id = vc.id++;
      vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} });
      return id;
    };
    window.clearTimeout = (id) => {
      vc.timers = vc.timers.filter((x) => x.id !== id);
    };
    if (animClock) catchAnims();
    vc.step = (n = 1, dt = 1000 / 60) => {
      for (let i = 0; i < n; i++) {
        vc.t += dt;
        if (animClock) seekAnims(dt);
        const due = vc.timers.filter((x) => x.at <= vc.t);
        if (due.length) vc.timers = vc.timers.filter((x) => x.at > vc.t);
        for (const x of due) {
          try {
            x.fn();
          } catch (e) {
            console.error(e);
          }
        }
        const q = vc.q;
        vc.q = [];
        for (const cb of q) cb(vc.t);
        // Whatever this frame started (a banner's entry, a transition) waits for the next frame.
        if (animClock) catchAnims();
        vc.frames++;
      }
    };
  }, cfg.animClock);
  // Legacy stand-ins for beats an unmerged director has not wired (synth: true).
  if (cfg.synth) {
    await page.evaluate(() => {
      const app = window.__gs;
      if (app.__stripSynth) return;
      app.__stripSynth = true;
      const d = app.director;
      const CRASH = [
        { at: 0, scale: 0 },
        { at: 0.07, scale: 0 },
        { at: 0.07, scale: 0.3 },
        { at: 0.38, scale: 0.3 },
        { at: 0.435, scale: 0.409 },
        { at: 0.49, scale: 0.65 },
        { at: 0.545, scale: 0.891 },
        { at: 0.6, scale: 1 },
      ];
      const cursors = new Map();
      let lastWhisper = -1e9;
      const pose = {};
      const step = d.step.bind(d);
      d.step = (f) => {
        const o = step(f);
        const sim = f.sim;
        const s = sim.s;
        const has = (type) => o.beats.some((b) => b.type === type);
        const log = (type, extra) => d.log.push({ t: sim.tick / 60, type, named: true, ...extra });
        for (const p of f.events) {
          const e = p.e;
          if (e.type === 'crash' && !has('crash')) {
            let best = null;
            for (const t of f.tracks) {
              const g = f.poses.get(t.entry.id);
              if (!g || g.done) continue;
              const dz = g.z - s.z;
              const dist = Math.hypot(g.x - s.x, dz);
              if (dz > 3 || dist > 60) continue;
              if (!best || dist < best.dist) best = { dist, from: Math.atan2(g.x - s.x, g.z - s.z) };
            }
            o.beats.push({ type: 'crash', tick: p.tick, cause: e.cause, stake: 0, orbitFrom: best ? best.from : null });
            log('crash');
            if (!f.reduced) d.time.curve(CRASH, 'render');
          } else if (e.type === 'bump' && !has('bump')) {
            let side = 1;
            const k0 = Math.floor(s.z / 64);
            for (let k = Math.max(0, k0 - 2); k <= k0 + 2; k++) {
              for (const ob of sim.course.chunk(k).obstacles) if (ob.id === e.id) side = ob.x > s.x ? -1 : 1;
            }
            o.beats.push({ type: 'bump', tick: p.tick, side, bank: false });
            log('bump');
          }
        }
        if (f.phase === 'run' && !has('ghostTrick')) {
          for (const t of f.tracks) {
            if (!t.ready || !t.tricks) continue;
            let c = cursors.get(t) ?? 0;
            while (c < t.tricks.length && t.tricks[c] <= sim.tick) {
              const [tick, q, half, flips] = [t.tricks[c], t.tricks[c + 1], t.tricks[c + 2], t.tricks[c + 3]];
              c += 4;
              if (sim.tick - tick > 4 || !app.ghosts.pose(t, sim.tick, pose)) continue;
              const gap = pose.z - s.z;
              if (gap > 60 || gap < -20) continue;
              const word = flips > 0 ? (flips === 1 ? 'Backflip' : flips === 2 ? 'Double Backflip' : `${flips} Backflips`) : half > 0 ? `Spin ${half * 180}` : null;
              if (sim.tick - lastWhisper < 90) continue;
              lastWhisper = sim.tick;
              const ghost = { id: t.entry.id, name: t.entry.name, kind: t.entry.kind, dx: pose.x - s.x };
              o.beats.push({ type: 'ghostTrick', tick, ghost, quality: q === 1 ? 'perfect' : q === 2 ? 'sketchy' : 'clean', word, x: pose.x, y: pose.y, z: pose.z });
              log('ghostTrick', { label: word ?? '' });
            }
            cursors.set(t, c);
          }
        }
        return o;
      };
      const beginRun = d.beginRun.bind(d);
      d.beginRun = (r) => {
        cursors.clear();
        lastWhisper = -1e9;
        return beginRun(r);
      };
    });
  }

  // The page side of the plan: which moments are still wanted, the stand-ins, and the per-frame check.
  await page.evaluate(
    ({ wants, standIns }) => {
      const app = window.__gs;
      const S = (window.__strips = { wants, need: Object.fromEntries(wants.map((w) => [w.key, true])), standIns: { graves: null, drift3: 0, bank3: 0 }, done: {} });
      const MERGE = 8;
      // Stand-in 1: the graveyards, from the pool's crash distances (3 or more within 8 m), named
      // from a list, placed through the real World.setGraveyards when the run has none.
      const NAMES = ["Widow's Bend", 'The Long Drop', 'Last Pines', 'Cold Shelf'];
      S.placeGraves = () => {
        if (!standIns || !S.need.graveyard || app.world.graves.length) return;
        const d = app.poolForMountain(app.mountain).map((g) => g.distance).sort((a, b) => a - b);
        const list = [];
        for (let i = 0; i < d.length && list.length < 4; ) {
          let j = i;
          while (j + 1 < d.length && d[j + 1] - d[i] <= MERGE) j++;
          if (j - i + 1 >= 3) {
            list.push({ z: d[Math.floor((i + j) / 2)], name: NAMES[list.length], fell: j - i + 1 });
            i = j + 1;
          } else i++;
        }
        if (list.length) {
          app.world.setGraveyards(list);
          S.standIns.graves = list.map((g) => ({ z: Math.round(g.z), fell: g.fell }));
        }
      };
      // Where a place moment's frames are taken: the next km mark, or the next cairn ahead.
      S.place = (w) => {
        const z = app.run.sim.s.z;
        if (w.approach === 'km') {
          const k = Math.floor((z - w.at[w.at.length - 1]) / 1000) + 1;
          const mark = k * 1000;
          return z >= mark + w.at[0] && z < mark + w.at[1] ? { z: mark, label: `${k} km` } : null;
        }
        for (const g of app.world.graves) if (z >= g.z + w.at[0] && z < g.z + w.at[1]) return { z: g.z, label: `${g.name}: ${g.fell}` };
        return null;
      };
      S.match = (w, e) => {
        if (w.approach || w.state || e.type !== w.type) return false;
        if (w.named && !e.named) return false;
        if (w.grade !== undefined && !(Array.isArray(w.grade) ? w.grade.includes(e.grade) : e.grade === w.grade)) return false;
        if (w.tier !== undefined && e.tier !== w.tier) return false;
        if (w.minTier !== undefined && !((e.tier ?? 0) >= w.minTier)) return false;
        if (w.word !== undefined && e.word !== w.word) return false;
        // Your own best ghost carries your name in the log ('Your best' on screen).
        if (w.you && !(e.word === 'yourBest' || (e.label && e.label === app.save.data.name))) return false;
        return true;
      };
    },
    { wants, standIns: cfg.standIns },
  );

  const installPilot = (skill, seed) =>
    page.evaluate(({ skill, seed, standIns }) => {
      const app = window.__gs;
      const run = app.run;
      window.__strips.placeGraves();
      if (!run || skill === 'none') return;
      let a = seed >>> 0;
      const rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const sim = run.sim;
      const c = sim.course;
      const expert = skill === 'expert' || skill === 'show';
      const novice = skill === 'novice';
      const P = { flight: 0, spin: 0, wasAir: false, drift: 0, bias: 0, stomp: true, away: 0, tap: 0, lvl: 4, next: 0, wob: rnd() * 6.28 };
      const timeToLand = (s) => {
        let y = s.y, vy = s.vy, x = s.x, z = s.z, t = 0;
        while (t < 4) { vy -= sim.gravity / 60; y += vy / 60; x += s.vx / 60; z += s.vz / 60; t += 1 / 60; if (y <= c.ground(x, z)) break; }
        return { t, x, z };
      };
      const steerTo = (s, target, gain, lat) => {
        const look = s.z + 4 + s.speed * 0.35;
        const err = Math.atan2(target(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * lat;
        return Math.max(0, Math.min(8, Math.round(4 + err * gain)));
      };
      const nextRamp = (s) => {
        for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2; k++) {
          for (const rr of c.zones(k).ramps) {
            if (rr.z + rr.len > s.z + 1 && rr.z - s.z < 70) {
              if (Math.abs(rr.x - c.centerX(rr.z)) > c.halfWidth(rr.z) - 4 || Math.abs(rr.x - c.safeX(rr.z + rr.len)) > 2.5) return null;
              return rr;
            }
          }
        }
        return null;
      };
      const pose = {};
      const pilot = () => {
        const s = sim.s;
        const T = sim.tick / 60;
        if (s.crashed) return { steer: 4, action: false };
        if (skill === 'line') return { steer: steerTo(s, (z) => c.safeX(z), 14, 0.08), action: false };
        if (!s.grounded) {
          const land = timeToLand(s);
          if (!P.wasAir) {
            P.wasAir = true;
            P.flight = land.t;
            const off = land.x - c.safeX(land.z);
            const room = c.halfWidth(land.z) - Math.abs(land.x - c.centerX(land.z));
            P.spin = !novice && land.t > 1.45 && room > 4 && Math.abs(off) < 1.5 && rnd() < (expert ? 0.95 : 0.7) ? (off > 0 ? -1 : 1) : 0;
            P.bias = (rnd() - 0.5) * (expert ? 0.05 : novice ? 0.3 : 0.16);
            P.stomp = !novice || rnd() < 0.4;
          }
          let steer = 4;
          let goal = (expert && P.flight > 2.4 ? 4 : 2) * Math.PI;
          if (goal > 2 * Math.PI && land.t < (goal - Math.abs(s.airYaw)) / 9 + 0.3) goal = 2 * Math.PI;
          const coast = (s.spinRate * s.spinRate) / 44;
          if (P.spin && Math.abs(s.airYaw) + coast < goal - 0.12 && land.t > 0.2) steer = P.spin > 0 ? 8 : 0;
          else {
            const off = land.x - c.safeX(land.z);
            if (Math.abs(off) > 0.8) steer = off > 0 ? 2 : 6;
          }
          const w = land.t - P.bias;
          return { steer, action: P.stomp && w < 0.11 && w > 0.01 };
        }
        P.wasAir = false;
        // The novice (telemetry.js's): a wobbly safe line, a look away now and then, stray taps.
        if (novice) {
          if (P.away > T) return { steer: 4, action: false };
          if (rnd() < 1 / (60 * 30)) {
            P.away = T + 0.5 + rnd() * 0.6;
            return { steer: 4, action: false };
          }
          if (T >= P.next) {
            P.next = T + 0.08 + rnd() * 0.08;
            const wob = 0.45 * Math.sin(T * 0.7 + P.wob) + 0.25 * Math.sin(T * 1.9 + P.wob * 2);
            P.lvl = steerTo(s, (z) => c.safeX(z) + wob, 10, 0.06);
          }
          if (P.tap <= T && rnd() < 1 / (60 * 8)) P.tap = T + 0.3 + rnd() * 0.4;
          return { steer: P.lvl, action: P.tap > T };
        }
        const S = window.__strips;
        // Stand-in 3: the pilot's combos bank under 1,500, so once a combo holds 3 skill moves its
        // pending pool is raised to bank just over your best combo (the director grades the real bank).
        if (standIns && S.need.bank3 && sim.combo.active && (app.director.skillChain ?? 0) >= 3 && !P.raised) {
          const best = Math.max(1500, app.director.run ? app.director.run.bestComboAtStart : 0);
          const mult = Math.max(1, sim.combo.multiplier);
          if (sim.combo.pending * mult < best + 300) {
            sim.combo.pending = Math.ceil((best + 400) / mult);
            P.raised = true;
            S.standIns.bank3 = (S.standIns.bank3 || 0) + 1;
          }
        }
        if (!sim.combo.active) P.raised = false;
        const ramp = nextRamp(s);
        let target = (z) => c.safeX(z);
        let lat = 0.08;
        // The show pilot rides at the next ghost's line when it is close and on a clear line (duels).
        if (skill === 'show' && !ramp) {
          const st = app.ghosts.standings(sim.tick, s.z);
          if (st.next && st.next.gap > 1 && st.next.gap < 30 && app.ghosts.pose(st.next.track, sim.tick, pose) && Math.abs(pose.x - c.safeX(pose.z)) < 1.8) target = () => pose.x;
          // ...and, until a whisker is stripped, shaves a hazard near the line at speed: it aims to pass
          // a quarter metre off its edge on the safe line's side (the sim grades the real gap).
          if (S.need.whisker && s.speed >= 19) {
            let hz = null;
            for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 1 && !hz; k++) {
              for (const o of c.chunk(k).obstacles) {
                if (o.soft || o.x2 !== o.x || o.z2 !== o.z || o.z < s.z + 6 || o.z > s.z + 40) continue;
                // (The safe lane keeps every collider 2 m or more off the safe line: one within 4.5 m
                // of it, and well inside the corridor, is shaved and the line rejoined after.)
                if (Math.abs(o.x - c.safeX(o.z)) - o.r > 4.5 || c.edgeExcess(o.x, o.z) > -2.5) continue;
                hz = o;
                break;
              }
            }
            if (hz) {
              const side = c.safeX(hz.z) >= hz.x ? 1 : -1;
              const gx = hz.x + side * (hz.r + 0.55 + 0.22);
              target = () => gx;
              lat = 0;
            }
          }
        }
        if (ramp) target = () => ramp.x;
        const bend = c.safeX(s.z + 24) - c.safeX(s.z + 4);
        const room = c.halfWidth(s.z) - Math.abs(s.x - c.centerX(s.z));
        // (Until the heat strips are taken, a drift is held a little longer for its tiers to show.)
        const heat = standIns && (S.need.heat1 || S.need.heat2 || S.need.heat3);
        if (!ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) {
          P.drift = T + (heat ? 1.0 : 0.4 + rnd() * 0.4);
          P.driftAt = T;
        }
        if (P.drift > T && (room < (heat ? 3 : 4) || Math.abs(s.x - c.safeX(s.z)) > (heat ? 2 : 0.8))) P.drift = T;
        if (P.drift > T) {
          // Stand-in 2b: a held drift's charge is staged through tiers 1, 2 and 3 (0.62, 1.38, 2.45),
          // a fifth of a second each, so its spray can be seen heating (the tiers and spray are real).
          if (heat && s.drifting) {
            const el = T - P.driftAt;
            const want = el > 0.55 ? 2.45 : el > 0.35 ? 1.38 : el > 0.15 ? 0.62 : 0;
            if (s.driftCharge < want) {
              s.driftCharge = want;
              S.standIns.heat = (S.standIns.heat || 0) + 1;
            }
          }
          // Stand-in 2: a held drift is topped up past tier 3 (once, until a tier-3 release is stripped).
          if (standIns && S.need.drift3 && s.drifting && s.driftCharge > 0.3 && s.driftCharge < 2.45 && T > P.drift - 0.25) {
            s.driftCharge = 2.45;
            S.standIns.drift3++;
          }
          return { steer: bend > 0 ? 8 : 0, action: true };
        }
        if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
        if (P.drift < 0 && T > -P.drift) P.drift = 0;
        let action = false;
        if (ramp) {
          const u = (s.z - ramp.z) / ramp.len;
          action = u > -0.7 && u < 0.85;
        }
        return { steer: steerTo(s, target, 14, ramp ? 0 : lat), action };
      };
      run.input = { sample: pilot };
    }, { skill, seed, standIns: cfg.standIns });

  const probe = () =>
    page.evaluate(() => {
      const app = window.__gs;
      const cam = app.world.cam;
      const j = cam.joltNow ?? { right: 0, up: 0, back: 0 };
      const ts = app.director.time;
      const f = app.director.feel ?? {};
      const p = cam.camera.position;
      // The ghost layer's tags on screen right now, by kind.
      const tags = {};
      for (const el of document.querySelectorAll('.ghost-layer .ghost-label')) {
        if (el.style.opacity !== '1') continue;
        const k = el.classList.contains('grave') ? 'grave' : el.classList.contains('line') ? 'line' : el.classList.contains('marker') ? 'marker' : el.classList.contains('dot') ? 'dot' : 'ghost';
        tags[k] = (tags[k] || 0) + 1;
        if (el.classList.contains('duel')) tags.duelRing = 1;
        if (el.classList.contains('trick')) tags.trick = el.textContent;
        if (/nemesis/.test(el.textContent)) tags.nemesis = 1;
      }
      return {
        frame: window.__vc.frames,
        t: app.run ? +(app.run.sim.tick / 60).toFixed(3) : null,
        z: app.run ? +app.run.sim.s.z.toFixed(1) : null,
        phase: app.phase,
        mode: cam.mode,
        roll: +(cam.rollNow ?? 0).toFixed(4),
        jolt: [+j.right.toFixed(4), +j.up.toFixed(4), +j.back.toFixed(4)],
        hold: +(cam.holdNow ?? 0).toFixed(3),
        fov: +cam.camera.fov.toFixed(2),
        lens: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
        feed: ts.feed,
        render: ts.render,
        orbit: +(cam.orbitAngle ?? 0).toFixed(3),
        orbitFrom: cam.orbitFrom ?? null,
        feel: { reduced: f.reduced, drift: f.driftTier, charge: +(f.driftCharge ?? 0).toFixed(2), flow: +(f.flow ?? 0).toFixed(2), streak: f.streak, duel: f.duelId, best: f.bestLine ? f.bestLine.z : null, friend: f.friendLine ? f.friendLine.z : null },
        tags,
        // The off-screen rival chip (contract C1): the ghost it points at, its colour and text.
        chip: (() => {
          const g = app.world.ghosts;
          const el = g.rivalEl;
          return el && el.style.opacity !== '0' && el.style.opacity !== '' ? { id: g.rivalId, c: el.style.getPropertyValue('--c'), txt: g.rivalTxt, op: el.style.opacity, rival: app.director.out && app.director.out.rival ? app.director.out.rival.id : null } : null;
        })(),
        // What the HUD says in this frame (the words a strip is read by: 'Slung past 3', 'Passed Your
        // best', 'Mission done', 'DUEL name', 'New ground', a stamp).
        hud: (() => {
          // (Screen-reader copies, .gs-sr, are left out: the words as drawn.)
          const txt = (el) => {
            if (!el) return null;
            const parts = [];
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!(n.parentElement && n.parentElement.closest('.gs-sr'))) parts.push(n.nodeValue.trim());
            return parts.filter(Boolean).join(' ');
          };
          const shown = (el) => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05;
          const all = (sel) => [...document.querySelectorAll(sel)].filter((el) => shown(el) && !el.classList.contains('gs-sr')).map(txt).filter(Boolean);
          return { race: txt(document.querySelector('.gs-race')), notices: all('.gs-notices > *'), calls: all('.gs-call-wrap'), hero: all('.gs-hero'), bank: all('.gs-bank'), crack: all('.gs-crack') };
        })(),
        // Banners and stamps mid-transition in this frame: each finite animation in progress on the top
        // band (notices, the race row), a callout, a stamp, a bank or the crack, with its progress and
        // its target's opacity. bannerMid is true when one of them is caught part faded (opacity
        // between 0.05 and 0.95): a frame between two states, say a banner over the race row.
        ...(() => {
          const SEL = ['.gs-notices', '.gs-race', '.gs-call-wrap', '.gs-hero', '.gs-bank', '.gs-crack'];
          const anims = [];
          for (const an of document.getAnimations()) {
            const tgt = an.effect && an.effect.target;
            if (!tgt || !tgt.closest) continue;
            const sel = SEL.find((s) => tgt.closest(s));
            if (!sel) continue;
            const ct = an.effect.getComputedTiming();
            if (!Number.isFinite(ct.endTime) || ct.progress === null || ct.progress === undefined) continue;
            const name = an.animationName || an.transitionProperty || an.id || 'waapi';
            // The opacity actually drawn: the target's own times its ancestors' up to the banner root.
            let op = 1;
            for (let el = tgt; el && el !== document.body; el = el.parentElement) {
              op *= +getComputedStyle(el).opacity;
              if (el.matches(sel)) break;
            }
            anims.push({ sel, name, p: +ct.progress.toFixed(2), op: +op.toFixed(2) });
          }
          return { anims, bannerMid: anims.some((a) => a.op > 0.05 && a.op < 0.95) };
        })(),
      };
    });

  const strips = [];
  const runs = [];
  const counts = {};
  const done = () => wants.every((w) => (counts[w.key] || 0) >= cfg.maxPerType);
  let logIdx = 0;
  let seed = cfg.seed;
  let error = null;
  try {
    for (let r = 0; r < cfg.runs && !done(); r++) {
      if (r > 0) {
        await page.evaluate(() => window.__gs.runAgain());
        for (let k = 0; k < 600; k++) {
          const ph = await page.evaluate(() => (window.__vc.step(1), window.__gs.phase));
          if (ph === 'run') break;
        }
        logIdx = 0;
      }
      await installPilot(cfg.pilot, seed++);
      // The field this run rides against (kind:name), and any pool ghost that rides your best's own line
      // (rivals with bestReplay: the pool run your best was made from can be picked again).
      const field = await page.evaluate(() => {
        const tr = window.__gs.ghosts.tracks;
        const you = tr.find((x) => x.entry.kind === 'you');
        return { field: tr.map((x) => x.entry.kind + ':' + x.entry.name), dupOfBest: you ? tr.filter((x) => x !== you && x.entry.record === you.entry.record).map((x) => x.entry.name) : [] };
      });
      // A frame budget per run as well as the sim-time cap: the sim stops at a crash, so a crash that
      // never reached the results would otherwise step forever.
      const frameCap = (await page.evaluate(() => window.__vc.frames)) + Math.ceil(cfg.maxSeconds * 60) + 1200;
      for (;;) {
        const open = wants.filter((w) => (counts[w.key] || 0) < cfg.maxPerType);
        const res = await page.evaluate(
          ({ open, idx, after, maxSeconds, frameCap }) => {
            const app = window.__gs;
            const vc = window.__vc;
            const S = window.__strips;
            for (let i = 0; i < 120; i++) {
              vc.step(1);
              const log = app.director.log;
              if (log.length < idx) idx = 0;
              for (; idx < log.length; idx++) {
                const e = log[idx];
                if (e.t < after) continue;
                const w = open.find((w) => S.match(w, e));
                if (w) return { hit: { key: w.key, type: e.type, t: e.t, label: [e.label, e.word, e.grade, e.tier !== undefined ? 'tier ' + e.tier : null].filter(Boolean).join(' ') || null }, idx: idx + 1 };
              }
              if (app.phase === 'run' && app.run) {
                for (const w of open) {
                  if (w.state === 'driftTier') {
                    const f = app.director.feel;
                    if (app.run.sim.s.drifting && f && f.driftTier === w.tier) return { hit: { key: w.key, type: 'driftTier', t: app.run.sim.tick / 60, label: `tier ${w.tier} charge ${f.driftCharge.toFixed(2)}` }, idx };
                    continue;
                  }
                  if (w.state === 'flow') {
                    const f = app.director.feel;
                    if (f && f.flow >= w.min && !app.run.sim.s.crashed) return { hit: { key: w.key, type: 'flow', t: app.run.sim.tick / 60, label: `flow ${f.flow.toFixed(2)}` }, idx };
                    continue;
                  }
                  if (!w.approach) continue;
                  const at = S.place(w);
                  if (at) return { hit: { key: w.key, type: w.approach, t: app.run.sim.tick / 60, label: at.label, z: at.z }, idx };
                }
              }
              if (app.phase === 'results' || app.phase === 'title') return { end: app.phase, idx };
              if (app.run && app.run.sim.tick / 60 > maxSeconds) return { end: 'time', idx };
              if (vc.frames > frameCap) return { end: 'frames', idx };
            }
            return { idx };
          },
          { open, idx: logIdx, after: cfg.after, maxSeconds: cfg.maxSeconds, frameCap },
        );
        logIdx = res.idx;
        if (res.end) {
          runs.push({ run: r + 1, end: res.end, ...field, ...(await page.evaluate(() => { const a = window.__gs; return a.run ? { t: +(a.run.sim.tick / 60).toFixed(1), distance: Math.round(a.run.sim.distance), score: a.run.sim.score } : {}; })) });
          break;
        }
        if (!res.hit) continue;
        const w = wants.find((x) => x.key === res.hit.key);
        const n = (counts[w.key] = (counts[w.key] || 0) + 1);
        await page.evaluate((k) => (window.__strips.need[k] = false), w.key);
        const strip = { moment: w.key, type: res.hit.type, t: res.hit.t, label: res.hit.label, files: [], probes: [] };
        // Frames between the beat and frame 0 (a beat that landed while another strip was being taken
        // is stripped from where the run is now; lag says how far behind its own frame that is).
        strip.lag = await page.evaluate((t) => (window.__gs.run ? Math.max(0, Math.round((window.__gs.run.sim.tick / 60 - t) * 60)) : 0), res.hit.t);
        const name = (tag) => `${out}/${cfg.label}-${w.key}${n > 1 ? n : ''}-${tag}.png`;
        if (w.approach) {
          // A place: a frame as the sled reaches each distance from it (or wherever it crashed).
          for (const m of w.at) {
            const ok = await page.evaluate(
              ({ z, cap }) => {
                const app = window.__gs;
                for (let i = 0; i < cap; i++) {
                  if (!app.run || app.phase !== 'run') return false;
                  if (app.run.sim.s.z >= z) return true;
                  window.__vc.step(1);
                }
                return false;
              },
              { z: res.hit.z + m, cap: 600 },
            );
            const file = name(`${m < 0 ? 'm' : 'p'}${String(Math.abs(m)).padStart(3, '0')}`);
            await page.screenshot({ path: file });
            strip.files.push(file);
            strip.probes.push({ at: m, ...(await probe()) });
            if (!ok) break;
          }
        } else {
          let at = 0;
          for (const k of w.frames) {
            if (k > at) {
              await page.evaluate((m) => window.__vc.step(m), k - at);
              at = k;
            }
            const file = name(`f${String(k).padStart(3, '0')}`);
            await page.screenshot({ path: file });
            strip.files.push(file);
            strip.probes.push({ k, ...(await probe()) });
          }
        }
        // The frames caught with a banner or stamp part way through a transition (read them as such).
        strip.midFrames = strip.probes.filter((q) => q.bannerMid).map((q) => (q.k !== undefined ? q.k : q.at));
        strips.push(strip);
        // The strip may have ridden through the results: the run is over.
        const ph = await page.evaluate(() => window.__gs.phase);
        if (done() || ph === 'results' || ph === 'title') {
          runs.push({ run: r + 1, end: done() ? 'all stripped' : ph, ...field, ...(await page.evaluate(() => { const a = window.__gs; return a.run ? { t: +(a.run.sim.tick / 60).toFixed(1), distance: Math.round(a.run.sim.distance), score: a.run.sim.score } : {}; })) });
          break;
        }
      }
    }
  } catch (e) {
    error = String((e && e.message) || e);
  } finally {
    await page.evaluate(() => window.__vc && window.__vc.restore()).catch(() => undefined);
  }
  const standIns = await page.evaluate(() => window.__strips && window.__strips.standIns).catch(() => null);
  // (run-code has no file system or timers: the caller keeps the JSON, e.g. by redirecting stdout.)
  return JSON.stringify({ label: cfg.label, reduced: cfg.reduced, rivals: cfg.rivalsInfo ?? null, counts, standIns, runs, error, strips });
}
