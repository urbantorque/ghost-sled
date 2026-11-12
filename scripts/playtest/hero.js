// The hero up close (round 7 hero lane): pins the rider to the safe line at a speed, as readability.js does,
// and shoots it from a ring of lenses round it (the chase lens first, then close turntable views with the
// real light, the real materials and the real pose), so a change to the rider's build, its motion or its
// light can be read at a size the chase lens never shows. Optional `pose` forces a sim state for the shot
// ('air', 'drift', 'crouch', 'lean'), and `ghosts: true` leaves the camera on the field's nearest ghost.
//   playwright-cli -s=r7-hero eval "window.__heroCfg = { base: 'http://127.0.0.1:4430/', out: 'C:/.../shots/r7/hero/turn/', m: 0, tier: 'high', z: 900, speed: 30 }"
//   playwright-cli -s=r7-hero run-code --filename=scripts/playtest/hero.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4430/', out: 'shots/r7/hero/turn/', m: 0, tier: 'high', mood: 0, z: 900, speed: 30, tag: '', pose: null, ghosts: false, views: null, wait: 900 }, (await page.evaluate(() => window.__heroCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 200)); });
  await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=${c.mood}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.evaluate(({ z, speed, pose }) => {
    const r = window.__gs.run;
    const sim = r.sim;
    const cc = sim.course;
    const g = { x: 0, z: 0 };
    sim.s.z = z;
    r.input = {
      sample: () => {
        const q = sim.s;
        q.x = cc.safeX(q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * speed) / 2;
        q.vz = Math.sqrt(Math.max(1, speed * speed - q.vx * q.vx));
        cc.gradient(q.x, q.z, g);
        q.speed = speed;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 10;
        q.boostPool = 0;
        q.flow = 0;
        if (pose === 'air') {
          q.y = cc.ground(q.x, q.z) + 2.4;
          q.vy = 0;
          q.grounded = false;
        } else {
          q.y = cc.ground(q.x, q.z);
          q.vy = g.x * q.vx + g.z * q.vz;
          q.grounded = true;
        }
        q.drifting = pose === 'drift';
        if (pose === 'drift') {
          q.driftDir = 1;
          q.driftCharge = 2;
          q.slip = 0.5;
        }
        q.lean = pose === 'lean' ? 0.55 : pose === 'drift' ? 0.4 : 0;
        return { steer: 4, action: pose === 'crouch' };
      },
    };
    // The turntable: after the game's own camera has run, the lens is put where the shot wants it.
    const w = window.__gs.world;
    const cam = w.cam;
    const orig = cam.update.bind(cam);
    window.__heroView = null;
    // Forced acting (cfg.acts): after the world's own moments have set the rider's act, the shot's values go over it.
    window.__heroAct = null;
    const mo = w.moments;
    const mu = mo.update.bind(mo);
    mo.update = (v, dt) => {
      mu(v, dt);
      if (window.__heroAct) Object.assign(mo.act, window.__heroAct);
    };
    cam.update = (t, dt) => {
      orig(t, dt);
      const v = window.__heroView;
      if (!v) return;
      const s = sim.s;
      const h = s.heading;
      // Azimuth 0 is straight behind the rider, PI in front of it; + toward its right.
      const a = v.az;
      const bx = -Math.sin(h);
      const bz = Math.cos(h);
      const rx = Math.cos(h);
      const rz = Math.sin(h);
      const fx = t.pos.x;
      const fy = t.pos.y + (v.look ?? 0.75);
      const fz = t.pos.z;
      const k = cam.camera;
      k.position.set(fx + (bx * Math.cos(a) + rx * Math.sin(a)) * v.r, fy + v.up, fz + (bz * Math.cos(a) + rz * Math.sin(a)) * v.r);
      k.up.set(0, 1, 0);
      k.fov = v.fov ?? 30;
      k.updateProjectionMatrix();
      k.lookAt(fx, fy, fz);
    };
  }, { z: c.z, speed: c.speed, pose: c.pose });
  await page.waitForTimeout(1800);
  const views = c.views || [
    { name: 'chase', view: null },
    { name: 'back', view: { az: 0, r: 4.2, up: 0.9 } },
    { name: 'back34', view: { az: 0.7, r: 4.2, up: 0.7 } },
    { name: 'side', view: { az: Math.PI / 2, r: 4.4, up: 0.35 } },
    { name: 'front34', view: { az: Math.PI - 0.6, r: 4.2, up: 0.5 } },
    { name: 'front', view: { az: Math.PI, r: 3.4, up: 0.3, look: 0.95 } },
    { name: 'face', view: { az: Math.PI - 0.35, r: 2.0, up: 0.15, look: 1.25, fov: 26 } },
  ];
  const shots = [];
  for (const a of c.acts || [{ name: '', set: null }]) {
    await page.evaluate((set) => { window.__heroAct = set; }, a.set);
    for (const v of views) {
      await page.evaluate((view) => { window.__heroView = view; }, v.view);
      await page.waitForTimeout(c.wait);
      const file = `${c.out}m${c.m}-${c.tier}${c.tag ? '-' + c.tag : ''}${a.name ? '-' + a.name : ''}-${v.name}.png`;
      await page.screenshot({ path: file });
      shots.push(file);
    }
  }
  const info = await page.evaluate(() => {
    const i = window.__gs.world.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles };
  }).catch(() => null);
  await page.goto('about:blank');
  return JSON.stringify({ shots, info, errors });
}
