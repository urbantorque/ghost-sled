// Round 7's effects on demand (the fx lane): rides the safe line at a pinned speed (as frames.js) and stages
// one effect after another through the game's own code paths, shooting each as it plays. Plans:
//   carve     a hard carve held with a real key at 38 m/s (the rooster tail, its trailing body, the groove)
//   land      a drop from 14 m onto the line (the landing's burst and, after 1.5 s of air, the wave)
//   shed      the line moved out to the treeline, so the trees shake and shed as the rider passes
//   ghostshed a tree 30 m down the run shaken as a ghost would shake it
//   breaks    every breakable thing within 60 m broken at once, and an icicle fall
//   dash      a dash's wake, burst and tail (the sim's own dash, a full lantern given)
//   ward      a ward's lantern cracking (the effect started where the rider is)
//   gate      the next sky gate, from 60 m and as it bursts
//   show      the street's fireworks; win: the finale over the square
//   still     nothing staged: frames at `at` distances (weather, trees in the wind)
// One page per call; frames go to cfg.out as <dev>-<tier>-m<m>[-mood<n>]-<plan>-<k>.png.
//   playwright-cli -s=r7-fx eval "window.__fxCfg = { base: 'http://127.0.0.1:4470/', out: 'C:/.../shots/r7/fx/x', tier: 'high', m: 0, plans: ['carve', 'land'] }"
//   playwright-cli -s=r7-fx --raw run-code --filename=scripts/playtest/fxshots.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4470/', out: 'shots/r7/fx/x', tier: 'high', m: 0, mood: 0, speed: 34, z: 300, plans: ['carve'], at: [], reduced: false, hud: true, extra: '' }, (await page.evaluate(() => window.__fxCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  if (c.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=${c.mood}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate((cfg) => {
    window.__pin = { speed: cfg.speed, off: 0, on: true };
    const pin = () => {
      const rr = window.__gs.run;
      const P = window.__pin;
      if (rr && !rr.sim.s.crashed && P.on) {
        const q = rr.sim.s;
        const cc = rr.sim.course;
        const v = P.speed;
        q.x = cc.safeX(q.z) + P.off;
        q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
        q.vz = v;
        q.vy = 0;
        q.speed = v;
        q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
    const r = window.__gs.world && window.__gs.world.renderer;
    if (r && r.info) {
      r.info.autoReset = false;
      const tick = () => { window.__frameInfo = { calls: r.info.render.calls, tris: r.info.render.triangles, points: r.info.render.points }; r.info.reset(); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  }, c);
  if (!c.hud) await page.addStyleTag({ content: '#ui, .gs-hud, [class*="hud"] { visibility: hidden !important; }' });
  const tag = `${dev}-${c.tier}-m${c.m}${c.mood ? '-mood' + c.mood : ''}${c.reduced ? '-calm' : ''}`;
  const report = [];
  const shoot = async (k) => {
    await page.screenshot({ path: `${c.out}/${tag}-${k}.png` });
    const st = await page.evaluate(() => ({ info: window.__frameInfo || null, z: Math.round(window.__gs.run ? window.__gs.run.sim.s.z : -1) }));
    report.push({ k, z: st.z, calls: st.info && st.info.calls, tris: st.info && st.info.tris });
  };
  const goto = async (z) => {
    await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 40);
    await page.waitForFunction(() => window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
    await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
  };
  let z = c.z;
  for (const plan of c.plans) {
    await page.evaluate(() => { window.__pin.on = true; window.__pin.off = 0; });
    await goto(z);
    if (plan === 'still') {
      for (const d of c.at.length ? c.at : [z + 60]) {
        await goto(d);
        await shoot('z' + d);
        z = d;
      }
    } else if (plan === 'carve') {
      // (Unpinned: the carve is the sim's own, from a real key.)
      await page.evaluate(() => { const q = window.__gs.run.sim.s; q.vz = 38; q.speed = 38; q.invuln = 10; window.__pin.on = false; });
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(380);
      await shoot('carve-a');
      await page.waitForTimeout(300);
      await shoot('carve-b');
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(450);
      await shoot('carve-c');
      await page.keyboard.up('ArrowRight');
      await page.evaluate((v) => { window.__pin.speed = v; }, c.speed);
    } else if (plan === 'land') {
      await page.evaluate(() => {
        const q = window.__gs.run.sim.s;
        window.__pin.on = false;
        q.y += 14;
        q.vy = 0;
        q.grounded = false;
        q.invuln = 10;
      });
      await page.waitForFunction(() => window.__gs.run.sim.s.grounded, null, { timeout: 6000, polling: 8 }).catch(() => {});
      await page.waitForTimeout(90);
      await shoot('land-a');
      await page.waitForTimeout(220);
      await shoot('land-b');
      await page.waitForTimeout(420);
      await shoot('land-c');
    } else if (plan === 'shed') {
      await page.evaluate(() => {
        const cc = window.__gs.run.sim.course;
        const q = window.__gs.run.sim.s;
        // Out to the foot of the treeline wall on the right.
        window.__pin.off = cc.centerX(q.z) + cc.halfWidth(q.z) + cc.shapeAt(q.z).limit - 0.4 - cc.safeX(q.z);
      });
      await page.waitForTimeout(900);
      await shoot('shed-a');
      await page.waitForTimeout(500);
      await shoot('shed-b');
      await page.waitForTimeout(500);
      await shoot('shed-c');
    } else if (plan === 'ghostshed') {
      await page.evaluate(() => {
        const w = window.__gs.world;
        const q = window.__gs.run.sim.s;
        const buf = new Array(48).fill(0);
        const n = w.props.treesNear(q.x, q.z + 22, 40, 14, buf);
        window.__shook = n;
        for (let k = 0; k < Math.min(n, 4); k++) {
          w.spirit.trees.shiver(buf[k * 3 + 1], buf[k * 3 + 2], 1);
          w.spirit.trees.fall(buf[k * 3 + 1], buf[k * 3 + 2], 1, true);
        }
      });
      await page.waitForTimeout(200);
      await shoot('ghostshed-a');
      await page.waitForTimeout(300);
      await shoot('ghostshed-b');
    } else if (plan === 'breaks') {
      const n = await page.evaluate(() => {
        const w = window.__gs.world;
        const q = window.__gs.run.sim.s;
        return w.spirit.breaks ? w.spirit.breaks.demo(q.x, q.z) : -1;
      });
      report.push({ k: 'breaks', broke: n });
      for (const [k, ms] of [['a', 120], ['b', 260], ['c', 420]]) {
        await page.waitForTimeout(ms);
        await shoot('breaks-' + k);
      }
    } else if (plan === 'dash') {
      await page.evaluate(() => { const q = window.__gs.run.sim.s; if ('lantern' in q) q.lantern = 3; if ('charge' in q) q.charge = 3; });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(140);
      await shoot('dash-a');
      await page.waitForTimeout(420);
      await shoot('dash-b');
      await page.waitForTimeout(700);
      await shoot('dash-c');
    } else if (plan === 'ward') {
      await page.evaluate(() => {
        const w = window.__gs.world;
        const q = window.__gs.run.sim.s;
        w.spirit.onEvent({ type: 'ward', cause: 'rock', cells: 2 }, { x: q.x, y: q.y, z: q.z, vx: q.vx, vy: 0, vz: q.vz });
      });
      for (const [k, ms] of [['a', 50], ['b', 130], ['c', 260], ['d', 420]]) {
        await page.waitForTimeout(ms);
        await shoot('ward-' + k);
      }
    } else if (plan === 'gate') {
      const g = await page.evaluate(() => { const q = window.__gs.run.sim.s; const gs = window.__gs.run.sim.course.skyGates.filter((x) => x.z > q.z + 80); return gs.length ? { id: gs[0].id, z: gs[0].z } : null; });
      if (g) {
        await goto(g.z - 60);
        await shoot('gate-60m');
        await goto(g.z - 14);
        await page.evaluate((gg) => { const w = window.__gs.world; const q = window.__gs.run.sim.s; w.spirit.onEvent({ type: 'skyGate', id: gg.id, stage: 0 }, { x: q.x, y: q.y, z: q.z, vx: q.vx, vy: 0, vz: q.vz }); }, g);
        await page.waitForTimeout(110);
        await shoot('gate-burst-a');
        await page.waitForTimeout(240);
        await shoot('gate-burst-b');
        z = g.z + 30;
      }
    } else if (plan === 'show' || plan === 'win') {
      await page.evaluate((win) => {
        const w = window.__gs.world;
        w.spirit.beats([win ? { type: 'finish', rank: 1 } : { type: 'moment', verb: 'gates', phase: 'won' }]);
      }, plan === 'win');
      for (const [k, ms] of plan === 'win' ? [['a', 900], ['b', 500], ['c', 600], ['d', 700], ['e', 900], ['f', 1100], ['g', 1400]] : [['a', 1100], ['b', 450], ['c', 500], ['d', 600], ['e', 700]]) {
        await page.waitForTimeout(ms);
        await shoot(plan + '-' + k);
      }
    }
    z = (await page.evaluate(() => window.__gs.run.sim.s.z)) + 120;
  }
  const end = await page.evaluate(() => ({ shook: window.__shook || 0, shed: window.__gs.world.spirit.trees ? window.__gs.world.spirit.trees.shed : -1 }));
  await page.goto('about:blank');
  return JSON.stringify({ report, end, errors });
}
