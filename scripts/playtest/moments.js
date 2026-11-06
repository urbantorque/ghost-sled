// Feel strips: frame sequences of the moments a pilot rarely reaches on demand, taken on a virtual
// clock (exact 1/60 s steps, as strips.js), so a screenshot never costs game time. Each moment is set up
// by moving the sled in the sim from outside and then runs through the real sim events, director beats
// and every consumer: a wipeout, a scrape off the edge, a wall ride, a rail, a long flight, a stage line,
// the finish, and a stomp near a bank. Every frame carries a probe (speed, FOV, lens back, tumble,
// grinding, wall ticks, camera mode, sloughs sliding, the audio's descent state).
//   playwright-cli -s=lane-feel eval "window.__momentCfg = { base: 'http://127.0.0.1:4351/', out: 'C:/.../shots/moments/', tier: 'high', m: 0, only: ['finish'] }"
//   playwright-cli -s=lane-feel --raw run-code --filename=scripts/playtest/moments.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4173/', out: 'shots/moments/', tier: 'high', m: 0, mood: 0, speed: 34, only: null, reduced: false, label: '' }, (await page.evaluate(() => window.__momentCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 220)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 220));
  });
  await page.emulateMedia({ reducedMotion: c.reduced ? 'reduce' : 'no-preference' });
  const out = {};

  const boot = async () => {
    await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=${c.mood}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const orig = { now: performance.now.bind(performance) };
      const vc = { t: performance.now(), q: [], timers: [], id: 1, frames: 0 };
      window.__vc = vc;
      performance.now = () => vc.t;
      window.requestAnimationFrame = (cb) => {
        vc.q.push(cb);
        return vc.id++;
      };
      window.cancelAnimationFrame = () => {};
      const st = window.setTimeout.bind(window);
      window.__realTimeout = st;
      window.setTimeout = (fn, ms, ...a) => {
        const id = vc.id++;
        vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} });
        return id;
      };
      window.clearTimeout = (id) => {
        vc.timers = vc.timers.filter((x) => x.id !== id);
      };
      vc.step = (n = 1) => {
        for (let i = 0; i < n; i++) {
          vc.t += 1000 / 60;
          const due = vc.timers.filter((x) => x.at <= vc.t);
          if (due.length) vc.timers = vc.timers.filter((x) => x.at > vc.t);
          for (const x of due) x.fn();
          const q = vc.q;
          vc.q = [];
          for (const cb of q) cb(vc.t);
          vc.frames++;
        }
      };
      // The sled on rails from outside: hold(fn) runs once per sim tick before the sim steps.
      const app = window.__gs;
      const sim = app.run.sim;
      const cc = sim.course;
      const g = { x: 0, z: 0 };
      const S = (window.__m = { hold: null, log: [], sim, cc, g });
      S.line = (speed, xAt) => {
        const q = sim.s;
        q.x = xAt ? xAt(q.z) : cc.safeX(q.z);
        q.y = cc.ground(q.x, q.z);
        const x1 = xAt ? xAt(q.z + 1) : cc.safeX(q.z + 1);
        const x0 = xAt ? xAt(q.z - 1) : cc.safeX(q.z - 1);
        q.vx = ((x1 - x0) * speed) / 2;
        q.vz = Math.sqrt(Math.max(1, speed * speed - q.vx * q.vx));
        cc.gradient(q.x, q.z, g);
        q.vy = g.x * q.vx + g.z * q.vz;
        q.speed = speed;
        q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 10;
        q.drifting = false;
      };
      app.run.input = {
        sample: () => {
          if (S.hold) S.hold();
          return { steer: 4, action: false };
        },
      };
      S.probe = () => {
        const a = window.__gs;
        const w = a.world;
        const s = sim.s;
        const cam = w.cam.camera;
        const rp = w.rider.root.position;
        const aud = a.audio && a.audio.debugLevels ? a.audio.debugLevels() : null;
        return {
          z: +s.z.toFixed(1),
          speed: +s.speed.toFixed(1),
          vz: +s.vz.toFixed(1),
          air: !s.grounded,
          fov: +cam.fov.toFixed(1),
          back: +Math.hypot(cam.position.x - rp.x, cam.position.z - rp.z).toFixed(2),
          up: +(cam.position.y - rp.y).toFixed(2),
          mode: w.cam.mode,
          tumble: s.tumble,
          grinding: s.grinding,
          wall: s.wallTicks,
          finished: s.finished,
          shown: +(-rp.z).toFixed(1),
          vista: +w.cam.vistaNow.toFixed(2),
          left: +w.landing.timeToLand.toFixed(2),
          sloughs: w.sloughs.sliding,
          roll: +w.cam.rollNow.toFixed(3),
          aud: aud ? { stage: aud.stage, climax: aud.climax && +aud.climax.toFixed(2), build: aud.build && +aud.build.toFixed(2), open: aud.bandOpen && +aud.bandOpen.toFixed(2) } : null,
        };
      };
    });
    // (A frame the browser already owed the app runs once more and lands on the virtual clock.)
    await page.waitForTimeout(150);
  };

  const stepTo = (n) => page.evaluate((k) => window.__vc.step(k), n);
  /** Screenshots at each frame offset from now (the page stands still between them). */
  const strip = async (name, frames) => {
    const files = [];
    const probes = [];
    let at = 0;
    for (const f of frames) {
      await stepTo(f - at);
      at = f;
      const file = `${c.label}${name}-${String(f).padStart(3, '0')}.png`;
      await page.screenshot({ path: c.out + file });
      files.push(file);
      probes.push(await page.evaluate(() => window.__m.probe()));
    }
    out[name] = { files, probes };
  };
  const want = (n) => !c.only || c.only.includes(n);

  // A wipeout, from riding: the roll, the burst and the lens holding on it, then back on the line.
  if (want('tumble')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      S.sim.s.z = 900;
      S.hold = () => S.line(speed);
    }, { speed: c.speed });
    await stepTo(120);
    await page.evaluate(() => {
      const S = window.__m;
      S.hold = () => {
        S.hold = null;
        S.sim.s.invuln = 0;
        S.sim.wipeout('tree');
      };
    });
    await strip('tumble', [1, 6, 14, 26, 40, 54, 66, 70, 80]);
  }

  // Into the wall at speed: the side spray, the jolt.
  if (want('scrape')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      S.sim.s.z = 1100;
      const cc = S.cc;
      // High on the bank, a metre short of what stands at its top.
      S.hold = () => S.line(speed, (z) => cc.centerX(z) + cc.halfWidth(z) + cc.edgeLimit(z) - 1.2);
    }, { speed: c.speed });
    await stepTo(150);
    await page.evaluate(() => {
      const S = window.__m;
      const cc = S.cc;
      let n = 0;
      S.hold = () => {
        const q = S.sim.s;
        if (++n > 1 || q.tumble > 0) {
          S.hold = null;
          return;
        }
        q.x = cc.centerX(q.z) + cc.halfWidth(q.z) + cc.edgeLimit(q.z) - 0.04;
        q.y = cc.ground(q.x, q.z);
        q.vx = 10;
        q.vz = Math.sqrt(Math.max(1, q.speed * q.speed - 100));
        q.velHeading = q.heading = Math.atan2(q.vx, q.vz);
      };
    });
    await strip('scrape', [1, 4, 9, 16, 26, 40]);
  }

  // Riding the wall: leaned in, spray up it, through the posts.
  if (want('wall')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      S.sim.s.z = 1300;
      const cc = S.cc;
      S.hold = () => S.line(speed, (z) => cc.centerX(z) + cc.halfWidth(z) + 1.7);
    }, { speed: c.speed });
    await strip('wall', [30, 60, 75, 90, 105, 120, 135]);
  }

  // A rail: the slide, the sparks.
  if (want('grind')) {
    await boot();
    const found = await page.evaluate(({ speed }) => {
      const S = window.__m;
      const cc = S.cc;
      let rail = null;
      for (let k = 2; k < 400 && !rail; k++) {
        const list = cc.zones(k).rails;
        if (list && list.length) rail = list[0];
      }
      if (!rail) {
        // (No rails on this branch's courses yet: one is put in the zone for the strip, as the course
        // lane's will be.)
        const k = 40;
        const z0 = k * 64 + 20;
        const x0 = cc.safeX(z0);
        rail = { id: 9001, x0, z0, x1: cc.safeX(z0 + 26), z1: z0 + 26, h: 0.8 };
        cc.zones(k).rails.push(rail);
        cc.zones(k + 1).rails.push(rail);
      }
      S.sim.s.z = rail.z0 - speed * 1.4;
      S.rail = rail;
      S.hold = () => {
        const q = S.sim.s;
        if (q.grinding) return;
        if (q.z >= rail.z0 - 0.4) {
          S.hold = null;
          q.z = rail.z0 + 0.2;
          S.line(speed, () => rail.x0);
          q.heading = q.velHeading = 0;
          q.vx = 0;
          q.vz = speed;
          return;
        }
        const u = rail.x0;
        S.line(speed, () => u);
      };
      return { z0: rail.z0, z1: rail.z1, h: rail.h };
    }, { speed: c.speed });
    if (found) {
      await stepTo(70);
      await strip('grind', [8, 16, 24, 32, 44, 60]);
      out.grind.rail = found;
    } else out.grind = { missed: 'no rail on this course' };
  }

  // A long flight at speed (cfg.vy decides how long): the vista, and the touchdown near the bank.
  if (want('leap')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      S.sim.s.z = 1500;
      S.hold = () => S.line(speed);
    }, { speed: 40 });
    await stepTo(90);
    await page.evaluate(({ vy }) => {
      const S = window.__m;
      S.hold = () => {
        const q = S.sim.s;
        S.hold = null;
        q.vy = vy;
        q.y += 1;
        q.grounded = false;
      };
    }, { vy: c.vy ?? 9 });
    const frames = [];
    for (let f = 6; f <= (c.leapFrames ?? 260); f += 22) frames.push(f);
    await strip('leap', frames);
    // On past the touchdown, a strip keyed to it.
    const land = await page.evaluate(() => {
      const log = window.__gs.director.log;
      return log.slice(-12).map((e) => e.type);
    });
    out.leap.log = land;
  }

  // Riding just inside the edge at two speeds: the strobe of posts past the lens.
  if (want('posts')) {
    for (const v of [30, 44]) {
      await boot();
      await page.evaluate(({ speed, z }) => {
        const S = window.__m;
        S.sim.s.z = z;
        const cc = S.cc;
        S.hold = () => S.line(speed, (zz) => cc.centerX(zz) + cc.halfWidth(zz) - 2.5);
      }, { speed: v, z: c.postsZ ?? 2300 });
      await stepTo(100);
      await strip('posts' + v, [0, 5, 10, 15, 20, 25].map((f) => f + 1));
    }
  }

  // Down to the first stage line.
  if (want('stage')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      S.sim.s.z = S.cc.stages[0].z1 - 62;
      S.hold = () => S.line(speed);
    }, { speed: c.speed });
    await stepTo(90);
    await strip('stage', [10, 30, 45, 60, 75, 100]);
  }

  // The last run in to the line: the climax's state, then the finish.
  if (want('finish')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      const st = S.cc.stages;
      const q = S.sim.s;
      q.z = st[0].z1 + 1;
      let k = 0;
      S.hold = () => {
        k++;
        if (k === 2) q.z = st[1].z1 + 1;
        if (k === 3) q.z = st[2].z1 - 60;
        if (k >= 3) S.line(speed);
      };
    }, { speed: c.speed + 4 });
    await stepTo(60);
    const f = [10, 40, 70, 90, 110, 130, 150, 175, 200, 230, 260, 300, 340, 400, 460];
    await page.evaluate(() => {
      // Off the rails as it crosses: the sim coasts on its own.
      const S = window.__m;
      const hold = S.hold;
      S.hold = () => {
        if (S.sim.s.finished) {
          S.hold = null;
          return;
        }
        hold();
      };
    });
    await strip('finish', f);
  }

  // A stomp near a bank, and a settled grudge's answer on the same bank.
  if (want('slough')) {
    await boot();
    await page.evaluate(({ speed }) => {
      const S = window.__m;
      S.sim.s.z = 1700;
      const cc = S.cc;
      S.hold = () => S.line(speed, (z) => cc.centerX(z) + cc.halfWidth(z) - 3);
    }, { speed: c.speed });
    await stepTo(120);
    await page.evaluate(() => {
      const a = window.__gs;
      const v = a.view;
      a.world.moments.beats([{ type: 'stomp', tick: 0, streak: 1, late: false, title: '', lead: [], x: v.x, z: v.z, heading: 0, yetiHop: false }], v);
    });
    await strip('slough', [4, 16, 28, 40, 52, 66, 84]);
    await page.evaluate(() => {
      const a = window.__gs;
      a.world.moments.beats([{ type: 'grudgeSettled', tick: 0, ghost: { id: 1, name: 'x', kind: 'grudge', dx: 2 }, nemesis: true, after: 0, paid: 0 }], a.view);
    });
    await strip('grudge', [6, 20, 40, 66]);
  }

  await page.goto('about:blank').catch(() => {});
  return JSON.stringify({ out, errors });
}
