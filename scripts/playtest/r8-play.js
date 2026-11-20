// Round 8, the play lane: frames of the new mechanics as a player meets them, on a virtual clock (as motion30.js), so
// a frame is the frame the run reaches and a loaded machine shoots the same picture. Three jobs (`job`):
//   gates   rides the safe line at a pinned speed, holding a chosen lane at each charm gate, and shoots its approach
//           (from about 300 m in), its arches close up, the take and the next gate; `lanes` picks a lane a gate.
//   flight  rides to a leap's lip, lets the sim fly it and plays a trick with the real input (a grab held to a tier,
//           a tweak, a spin, a flip), shooting the flight and the landing ring; `trick` picks which.
//   poses   holds the rider in the air on a straight and sets what the sim says it is doing, for every trick's pose
//           (a contact sheet of the rig; the flights show the real ones).
//   showdown starts a showdown against the first rider in the field through the director's own path (a rival rule's
//           event, as rivals.ts makes one) and shoots its start, the marker ahead, and its result.
//   playwright-cli -s=r8-play open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=r8-play eval "window.__r8Cfg = { base: 'http://127.0.0.1:4830/', out: 'C:/.../shots/r8/play/x/', job: 'gates' }"
//   playwright-cli -s=r8-play run-code --filename=scripts/playtest/r8-play.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4830/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/play/x/', job: 'gates', tier: 'high', m: 0, extra: '&charms=all', speed: 40, lanes: [0, 2, 1], trick: 'reach', width: 1280, height: 720, mobile: false, hud: true, poses: null, sled: -1 },
    (await page.evaluate(() => window.__r8Cfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  if (!c.mobile) await page.setViewportSize({ width: c.width, height: c.height });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}${c.extra}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 180000 });
  if (!c.hud) await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  // The virtual clock, and a pilot: the run's input is ours (steer level 0 to 8, 4 centred; the action button).
  await page.evaluate(() => {
    const vc = { t: performance.now(), q: [], timers: [], id: 1 };
    window.__vc = vc;
    performance.now = () => vc.t;
    window.requestAnimationFrame = (cb) => {
      vc.q.push(cb);
      return vc.id++;
    };
    window.cancelAnimationFrame = () => {};
    const st0 = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) => {
      const id = vc.id++;
      vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} });
      return id;
    };
    window.clearTimeout = (id) => {
      vc.timers = vc.timers.filter((x) => x.id !== id);
    };
    window.__realTimeout = st0;
    vc.step = (dt) => {
      vc.t += dt;
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
    };
    const pilot = { steer: 4, action: false, pin: 0, x: null, hold: false };
    window.__pilot = pilot;
    const run = window.__gs.run;
    run.input = { sample: () => ({ steer: pilot.steer, action: pilot.action }) };
    // The pin: before each frame, the sled rides the line (or the lane asked) at the pinned speed on the snow.
    window.__pinNow = () => {
      const rr = window.__gs.run;
      if (!rr || rr.sim.s.crashed || !(pilot.pin > 0)) return;
      const q = rr.sim.s;
      const cc = rr.sim.course;
      const v = pilot.pin;
      const x = pilot.x === null ? cc.safeX(q.z) : pilot.x(q.z);
      q.x = x;
      q.y = cc.ground(q.x, q.z);
      q.vx = ((pilot.x === null ? cc.safeX(q.z + 1) - cc.safeX(q.z - 1) : pilot.x(q.z + 1) - pilot.x(q.z - 1)) * v) / 2;
      q.vz = v;
      q.vy = 0;
      q.speed = v;
      q.grounded = true;
      q.heading = Math.atan2(q.vx, q.vz);
      q.velHeading = q.heading;
      q.invuln = 10;
      // Follow: held beside a rider of the field (its pose at this tick), dz metres ahead and dx across.
      const fo = pilot.follow;
      if (fo) {
        const app = window.__gs;
        const p = window.__fpose || (window.__fpose = {});
        const tr = app.ghosts.tracks[fo.i];
        if (tr && app.ghosts.pose(tr, rr.sim.tick, p) && !p.done) {
          q.z = p.z + fo.dz;
          q.x = p.x + fo.dx;
          q.y = cc.ground(q.x, q.z);
        }
      }
    };
    window.__step = (n) => {
      for (let i = 0; i < n; i++) {
        window.__pinNow();
        vc.step(1000 / 60);
      }
      const r = window.__gs.run;
      return r ? { z: r.sim.s.z, y: r.sim.s.y, air: !r.sim.s.grounded, phase: window.__gs.phase, ttl: window.__gs.world.landing.timeToLand, tier: r.sim.s.grabTier, grab: r.sim.s.grab, move: r.sim.s.move, pose: window.__gs.world.rider.trickName } : { z: -1 };
    };
    // Jump down the course (the chunks and the far shadows catch up on the virtual clock).
    window.__jump = (z) => {
      const r = window.__gs.run;
      r.sim.s.z = z;
      r.sim.s.x = r.sim.course.safeX(z);
      for (let i = 0; i < 40; i++) {
        window.__pinNow();
        vc.step(50);
      }
      return r.sim.s.z;
    };
  });
  const shots = [];
  const shoot = async (name, why) => {
    const st = await page.evaluate(() => {
      const r = window.__gs.run;
      const w = window.__gs.world;
      const info = w.renderer.info;
      return { z: r ? Math.round(r.sim.s.z) : -1, calls: info.render.calls, tris: info.render.triangles, gates: w.charmGates.drawn, pose: w.rider.trickName, charms: r ? r.sim.charms.slice() : [] };
    });
    const file = `${c.out}${name}.png`;
    await page.screenshot({ path: file });
    shots.push({ name, why, ...st });
  };
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  // The renderer's counts are summed over a frame's passes (frames.js does the same).
  await page.evaluate(() => {
    const r = window.__gs.world.renderer;
    r.info.autoReset = false;
    const raf = window.requestAnimationFrame;
    const tick = () => {
      r.info.reset();
      raf(tick);
    };
    raf(tick);
  });
  const prefix = `${c.tier}-m${c.m}-`;

  if (c.job === 'gates') {
    // Lanes are held from 160 m out (the pilot steers across in about a second and a half at 40 m/s).
    const gates = await page.evaluate(() => window.__gs.run.sim.charmGates.map((g) => ({ index: g.index, z: g.z, x: g.x })));
    await page.evaluate((v) => {
      window.__pilot.pin = v;
    }, c.speed);
    for (const g of gates) {
      const lane = c.lanes[g.index] ?? 1;
      if (g.index > 0) await page.evaluate((z) => window.__jump(z), g.z - 340);
      else await step(1);
      // The lane: the safe line until 170 m out, then across to the lane's arch.
      await page.evaluate(({ gz, lane }) => {
        const cc = window.__gs.run.sim.course;
        const gx = window.__gs.run.sim.charmGates.find((q) => q.z === gz).x;
        const lx = gx + (lane - 1) * 4.6;
        window.__pilot.x = (z) => {
          const k = Math.max(0, Math.min(1, (z - (gz - 170)) / 70));
          const s = k * k * (3 - 2 * k);
          return cc.safeX(z) * (1 - s) + lx * s;
        };
      }, { gz: g.z, lane });
      for (const [d, tag] of [[300, 'far300'], [200, 'far200'], [150, 'mid150'], [120, 'mid120'], [90, 'near090'], [40, 'near040'], [12, 'close012'], [-3, 'take'], [-12, 'after']]) {
        let st = await step(1);
        let guard = 0;
        while (st.z >= 0 && st.z < g.z - d && guard++ < 2000) st = await step(1);
        if (st.z < 0) break;
        if (st.z > g.z - d + 6 && d > 0) continue;
        await shoot(`${prefix}gate${g.index}-${tag}`, `gate ${g.index} lane ${lane} at ${d} m`);
      }
      await page.evaluate(() => {
        window.__pilot.x = null;
      });
    }
  }

  if (c.job === 'flight') {
    // The first leap: ride to 60 m before its lip on the line, then let the sim fly it.
    const lip = await page.evaluate(() => {
      const cc = window.__gs.run.sim.course;
      const l = cc.leaps.find((q) => q.z > 300) || cc.leaps[0];
      return l.z;
    });
    await page.evaluate((v) => {
      window.__pilot.pin = v;
    }, 30);
    await page.evaluate((z) => window.__jump(z), lip - 120);
    let st = await step(1);
    while (st.z < lip - 25) st = await step(1);
    await page.evaluate(() => {
      window.__pilot.pin = 0;
    });
    while (!st.air && st.z < lip + 40) st = await step(1);
    const t = c.trick;
    const side = 8; // steer right
    // The press decides: with the steer to a side it is a grab; centred, held, a flip.
    if (t === 'flip' || t === 'twist') {
      await page.evaluate(() => {
        window.__pilot.steer = 4;
        window.__pilot.action = true;
      });
      st = await step(9);
      if (t === 'twist')
        await page.evaluate(() => {
          window.__pilot.steer = 8;
        });
      st = await step(10);
      await shoot(`${prefix}fl-${t}-a`, `${t} under way`);
      st = await step(12);
      await shoot(`${prefix}fl-${t}-b`, `${t} later`);
    } else if (t === 'spin') {
      await page.evaluate(() => {
        window.__pilot.steer = 8;
      });
      st = await step(14);
      await shoot(`${prefix}fl-spin-a`, 'spin under way');
      st = await step(10);
      await shoot(`${prefix}fl-spin-b`, 'spin later');
    } else {
      await page.evaluate((s) => {
        window.__pilot.steer = s;
        window.__pilot.action = true;
      }, side);
      st = await step(3);
      await page.evaluate(() => {
        window.__pilot.steer = 4;
      });
      // Tier 1 at 15 ticks, 2 at 40, 3 at 75.
      st = await step(18);
      await shoot(`${prefix}fl-grab-t1`, `grab tier ${st.tier}`);
      if (t === 'tweak') {
        await page.evaluate(() => {
          window.__pilot.steer = 0;
        });
        st = await step(14);
        await shoot(`${prefix}fl-tweak`, `tweak, tier ${st.tier}`);
        await page.evaluate(() => {
          window.__pilot.steer = 4;
        });
      }
      if (t === 'wheel') {
        await page.evaluate(() => {
          window.__pilot.steer = 8;
        });
        st = await step(14);
        await shoot(`${prefix}fl-wheel`, `paper wheel, tier ${st.tier}`);
        await page.evaluate(() => {
          window.__pilot.steer = 4;
        });
      }
      while (st.air && st.tier < 2) st = await step(2);
      st = await step(4);
      await shoot(`${prefix}fl-grab-t2`, `grab tier ${st.tier}`);
      while (st.air && st.tier < 3 && !(st.ttl < 0.7)) st = await step(2);
      if (st.tier >= 3) await shoot(`${prefix}fl-grab-t3`, `grab tier ${st.tier}`);
      // Held deep toward the snow: the ring warns; then let go inside the window: a stomp.
      while (st.air && !(st.ttl < 0.42)) st = await step(1);
      await shoot(`${prefix}fl-danger`, `deep grab held, ${st.ttl.toFixed(2)} s out`);
      while (st.air && !(st.ttl < 0.12)) st = await step(1);
      await shoot(`${prefix}fl-window`, `in the window, ${st.ttl.toFixed(2)} s out`);
      await page.evaluate(() => {
        window.__pilot.action = false;
      });
    }
    await page.evaluate(() => {
      window.__pilot.action = false;
      window.__pilot.steer = 4;
    });
    while (st.air) st = await step(1);
    st = await step(4);
    await shoot(`${prefix}fl-${t}-landed`, 'landed');
    st = await step(30);
    await shoot(`${prefix}fl-${t}-after`, 'after the landing');
  }

  if (c.job === 'poses') {
    // Hold the run, lift the rider into the air on its line, and set what the sim says it is doing.
    await page.evaluate((v) => {
      window.__pilot.pin = v;
    }, 30);
    await page.evaluate(() => window.__jump(260));
    const list = c.poses || [
      ['spin', { spin: 1 }],
      ['backflip', { flip: 1 }],
      ['railGrab', { grab: 1, tier: 1, move: 3 }],
      ['lanternReach', { grab: 1, tier: 2, move: 4 }],
      ['spiritStretch', { grab: 1, tier: 3, move: 5 }],
      ['paperWheel', { grab: -1, tier: 1, move: 3, spin: 1 }],
      ['craneFold', { grab: 1, tier: 1, move: 3, flip: 1 }],
      ['emberTwist', { spin: 1, flip: 1 }],
      ['spiritKnot', { grab: 1, tier: 1, move: 3, spin: 1, flip: 1 }],
      ['crosswind', { grab: 1, tier: 2, move: 4, tweak: 12 }],
      ['lamppost', { move: 11, grab: 1 }],
      ['snowHare', { move: 12, grab: -1 }],
      ['pineBow', { move: 13 }],
      ['spinningTop', { move: 14, spin: 1 }],
      ['fireside', { move: 15 }],
      ['cometTail', { move: 16 }],
      ['willowisp', { move: 17 }],
      ['teacup', { move: 18, spin: 0.4 }],
    ];
    for (const [name, p] of list) {
      await page.evaluate((p) => {
        const r = window.__gs.run;
        const w = window.__gs.world;
        r.paused = true;
        window.__pilot.pin = 0;
        const s = r.sim.s;
        const lift = 2.4;
        for (const sn of [r.prev, r.cur]) {
          sn.y = r.sim.course.ground(sn.x, sn.z) + lift;
          sn.grounded = false;
          sn.airYaw = 0;
          sn.airPitch = 0;
          sn.vy = 0;
        }
        // (The sim's own sled is lifted too: the frame's snapshot and the contact shadow read it, so height shows.)
        s.y = r.sim.course.ground(s.x, s.z) + lift;
        s.vy = 0;
        s.grounded = false;
        s.move = p.move || 0;
        s.grab = p.grab || 0;
        s.grabTier = p.tier || 0;
        s.tweak = p.tweak || 0;
        window.__poseP = p;
        // The turn the sim would be making, frame by frame (the rates are read off the pose).
        window.__poseTurn = () => {
          for (const sn of [r.prev, r.cur]) {
            sn.airYaw += (p.spin || 0) * 0.14;
            sn.airPitch += (p.flip || 0) * 0.11;
          }
        };
        w.landing.timeToLand = 2;
      }, p);
      for (let i = 0; i < 16; i++) {
        await page.evaluate(() => {
          window.__poseTurn();
          window.__vc.step(1000 / 60);
        });
      }
      await shoot(`${prefix}pose-${name}`, `pose ${name}`);
    }
    await page.evaluate(() => {
      const r = window.__gs.run;
      r.paused = false;
    });
  }

  if (c.job === 'showdown') {
    await page.evaluate((v) => {
      window.__pilot.pin = v;
    }, 36);
    await page.evaluate(() => window.__jump(620));
    // The field's first rider brought level, then the rule's own event as rivals.ts makes it.
    const info = await page.evaluate(() => {
      const app = window.__gs;
      const tracks = app.ghosts.tracks;
      return { n: tracks.length, ready: tracks.filter((t) => t.ready).length, names: tracks.map((t) => `${t.entry.name}:${t.entry.kind}`) };
    });
    shots.push({ name: 'field', why: JSON.stringify(info) });
    let live = false;
    if (info.n > 0 && c.live !== false) {
      // Live: held level with each rider in turn until the rival rules start a showdown on their own (2 s level,
      // only with an eligible rider), then ridden out fast to win it; the next one ridden slow to lose it; then a
      // wisp stolen by passing a rider close across. Nothing here pushes a rival event: rivals.ts decides.
      const seen = () => page.evaluate(() => (window.__gs.director.log || []).filter((e) => /showdown|steal|Showdown|Wisp/i.test(`${e.type} ${e.label || ''}`)).map((e) => `${e.type} ${e.label || ''}`));
      const startOne = async (from) => {
        for (let i = from; i < info.n; i++) {
          const before = (await seen()).length;
          await page.evaluate((k) => {
            window.__pilot.follow = { i: k, dz: 0.5, dx: 2.5 };
          }, i);
          for (let t = 0; t < 10; t++) {
            await step(16);
            const now = await seen();
            if (now.length > before && now.slice(before).some((x) => /start|Showdown:/.test(x))) return i;
          }
        }
        return -1;
      };
      const ride = async (v, secs, name) => {
        await page.evaluate((sp) => {
          window.__pilot.follow = null;
          window.__pilot.pin = sp;
        }, v);
        let st = await step(1);
        const mz = await page.evaluate(() => window.__gs.world.charmGates.marker?.z ?? NaN);
        if (Number.isFinite(mz)) {
          while (st.z < mz - 150) st = await step(2);
          await shoot(`${prefix}${name}-150`, 'live: marker 150 m ahead');
          while (st.z < mz - 40) st = await step(2);
          await shoot(`${prefix}${name}-40`, 'live: marker 40 m ahead');
        }
        for (let k = 0; k < secs * 60; k += 6) {
          st = await step(6);
          const l = (await seen()).slice(-1)[0] || '';
          if (/won|took|lost/i.test(l)) break;
        }
        await step(3);
        await shoot(`${prefix}${name}-end`, 'live: decided');
        await step(20);
        await shoot(`${prefix}${name}-end2`, 'live: decided, 0.35 s on');
      };
      await page.evaluate(() => window.__pilot.pin = 34);
      const a = await startOne(0);
      shots.push({ name: 'live-a', why: `rider ${a}` });
      if (a >= 0) {
        live = true;
        await step(2);
        await shoot(`${prefix}live-start`, 'live: showdown starts');
        await step(70);
        await shoot(`${prefix}live-lean`, 'live: 1.2 s in, the lens leaning toward the rival');
        await ride(52, 14, 'live-win');
        await step(620);
        const b = await startOne(0);
        shots.push({ name: 'live-b', why: `rider ${b}` });
        if (b >= 0) {
          await step(2);
          await shoot(`${prefix}live-start2`, 'live: second showdown starts');
          await ride(18, 20, 'live-lose');
        }
      }
      // A steal: from behind to ahead of a rider, close across, clean.
      for (let i = 0; i < info.n; i++) {
        const before = (await seen()).length;
        await page.evaluate((k) => {
          window.__pilot.pin = 34;
          window.__pilot.follow = { i: k, dz: -2, dx: 0.3 };
        }, i);
        await step(4);
        for (let d = -2; d <= 2; d += 0.5) {
          await page.evaluate((dz) => {
            if (window.__pilot.follow) window.__pilot.follow.dz = dz;
          }, d);
          await step(1);
        }
        await step(3);
        const now = await seen();
        if (now.length > before) {
          await shoot(`${prefix}live-steal`, `live: a wisp stolen from rider ${i}`);
          await step(12);
          await shoot(`${prefix}live-steal2`, 'live: the steal, 0.2 s on');
          break;
        }
      }
      await page.evaluate(() => {
        window.__pilot.follow = null;
      });
      shots.push({ name: 'live-log', why: JSON.stringify(await seen()) });
    }
    if (info.n === 0 || (!live && c.live === false)) {
      // No field (the bundled pools are a sim version behind until they are regenerated): the marker is staged
      // through the world's own call, so its look can still be judged; the beats are covered by director.test.ts.
      await page.evaluate(() => {
        const w = window.__gs.world;
        const C = w.sun.color.constructor;
        const z = window.__gs.run.sim.s.z + 300;
        window.__sdZ = z;
        w.charmGates.showdown(z, new C('#8FF3E4'));
      });
      await step(2);
      await shoot(`${prefix}sd-start`, 'showdown marker 300 m ahead (staged)');
      let st = await step(1);
      const mz = await page.evaluate(() => window.__sdZ);
      while (st.z < mz - 150) st = await step(2);
      await shoot(`${prefix}sd-race150`, 'marker 150 m ahead (staged)');
      while (st.z < mz - 40) st = await step(2);
      await shoot(`${prefix}sd-race40`, 'marker 40 m ahead (staged)');
      while (st.z < mz - 2) st = await step(1);
      await page.evaluate(() => {
        const w = window.__gs.world;
        const C = w.sun.color.constructor;
        w.charmGates.showdownEnd(new C('#FFD34D'), true);
      });
      await step(8);
      await shoot(`${prefix}sd-won`, 'marker bursts for the rider (staged)');
    }
    if (info.n > 0 && c.live === false) {
      await page.evaluate(() => {
        const r = window.__gs.run;
        const z = r.sim.s.z;
        r.rivalPending.push({ tick: r.sim.tick, e: { type: 'showdown', phase: 'start', rival: 0, markerZ: z + 300 } });
        window.__sdZ = z + 300;
      });
      await step(2);
      await shoot(`${prefix}sd-start`, 'showdown starts');
      await step(40);
      await shoot(`${prefix}sd-race1`, 'the race to the marker, 0.7 s in');
      let st = await step(1);
      const mz = await page.evaluate(() => window.__sdZ);
      while (st.z < mz - 150) st = await step(2);
      await shoot(`${prefix}sd-race150`, 'marker 150 m ahead');
      while (st.z < mz - 40) st = await step(2);
      await shoot(`${prefix}sd-race40`, 'marker 40 m ahead');
      while (st.z < mz) st = await step(1);
      await page.evaluate(() => {
        const r = window.__gs.run;
        r.rivalPending.push({ tick: r.sim.tick, e: { type: 'showdown', phase: 'won', rival: 0, markerZ: window.__sdZ } });
        r.tokens.push(2);
      });
      await step(3);
      await shoot(`${prefix}sd-won`, 'showdown won');
      await step(20);
      await shoot(`${prefix}sd-won2`, 'showdown won, 0.35 s on');
      // A steal: a wisp from the same rider.
      await page.evaluate(() => {
        const r = window.__gs.run;
        r.rivalPending.push({ tick: r.sim.tick, e: { type: 'steal', rival: 0 } });
        r.tokens.push(3);
      });
      await step(4);
      await shoot(`${prefix}steal`, 'a wisp stolen');
    }
  }

  const log = await page.evaluate(() => (window.__gs.director.log || []).slice(-80).map((e) => `${e.t.toFixed(1)} ${e.type} ${e.label || ''}`));
  await page.goto('about:blank');
  return JSON.stringify({ shots, errors: errors.slice(0, 30), log });
}
