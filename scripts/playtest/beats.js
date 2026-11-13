// Round 7's directed shots, shot (hero lane): rides the safe line at a pinned speed up to each shot the
// camera was handed (game/shots.ts: the whip onto the reveal, the tracking shot down the street, the held
// wide and its slow hero frame on the biggest leap), lets the sled fly its leaps for real, and screenshots
// through each one as fast as the page allows. Every frame carries a probe (the distance, the camera's
// weights for each shot, its FOV, the cine state it wrote, the render scale and what the director said).
// Real time, no virtual clock: the frames are what a player gets. Against a preview build:
//   playwright-cli -s=r7-hero eval "window.__beatsCfg = { base: 'http://127.0.0.1:4430/', out: 'C:/.../shots/r7/hero/beats/', ms: [0, 1, 2, 3], tier: 'high' }"
//   playwright-cli -s=r7-hero --raw run-code --filename=scripts/playtest/beats.js
// `kinds` picks shots (['whip', 'track', 'wide']); `reduced: true` asks for reduced motion.
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4430/', out: 'shots/r7/hero/beats/', ms: [0, 1, 2, 3], tier: 'high', mood: 0, speed: 30, kinds: ['whip', 'track', 'wide'], reduced: false, tag: '' }, (await page.evaluate(() => window.__beatsCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  if (c.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const report = [];
  const probe = () =>
    page.evaluate(() => {
      const g = window.__gs;
      const cam = g.world.cam;
      const s = g.run.sim.s;
      const ci = cam.cineNow;
      const log = g.director.log || [];
      const r2 = (x) => Math.round(x * 100) / 100;
      return { z: Math.round(s.z), air: !s.grounded, speed: r2(s.speed), wide: r2(cam.wideNow), hero: r2(cam.heroNow), track: r2(cam.trackNow), whip: r2(cam.whipNow), vista: r2(cam.vistaNow), fov: r2(cam.camera.fov), dof: r2(ci.dof), focus: r2(ci.focus), blur: r2(ci.motionBlur), box: r2(ci.letterbox), slow: r2(ci.slow), render: r2(g.director.time.render), feed: r2(g.director.time.feed), hero3: log.filter((e) => e.type === 'heroFrame').length };
    });
  for (const m of c.ms) {
    await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${m}&mood=${c.mood}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const shots = await page.evaluate((speed) => {
      window.__pinSpeed = speed;
      const r = window.__gs.run;
      const sim = r.sim;
      const cc = sim.course;
      // Pinned once per sim tick, on the snow only: a leap is flown as the sim flies it.
      r.input = {
        sample: () => {
          const q = sim.s;
          const v = window.__pinSpeed;
          q.invuln = 10;
          if (q.grounded && !q.crashed && v > 0) {
            q.x = cc.safeX(q.z);
            q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
            q.vz = Math.sqrt(Math.max(1, v * v - q.vx * q.vx));
            q.speed = v;
            q.heading = Math.atan2(q.vx, q.vz);
            q.velHeading = q.heading;
          }
          return { steer: 4, action: false };
        },
      };
      return (window.__gs.world.cam.shots || []).map((s) => ({ kind: s.kind, key: s.key, name: s.name, z0: s.z0, z1: s.z1, at: s.at }));
    }, c.speed);
    for (const shot of shots) {
      if (!c.kinds.includes(shot.kind)) continue;
      // Up to the shot: set down on the snow a little before it.
      const from = shot.kind === 'wide' ? shot.at - 150 : shot.kind === 'whip' ? shot.at - 110 : shot.z0 - 70;
      await page.evaluate((z) => {
        const sim = window.__gs.run.sim;
        const q = sim.s;
        q.z = z;
        q.x = sim.course.safeX(z);
        q.y = sim.course.ground(q.x, z);
        q.vy = 0;
        q.grounded = true;
      }, from);
      const start = shot.kind === 'wide' ? shot.at - 12 : shot.kind === 'whip' ? shot.at - 34 : shot.z0 + 30;
      const stop = shot.kind === 'wide' ? shot.z1 : shot.kind === 'whip' ? shot.at + 40 : shot.z1 + 30;
      await page.waitForFunction((z) => window.__gs.run.sim.s.z >= z, start, { timeout: 30000, polling: 16 });
      const frames = [];
      for (let i = 0; i < 16; i++) {
        const before = await probe();
        if (before.z > stop || (shot.kind === 'wide' && i > 3 && !before.air)) break;
        const file = `${c.out}m${m}-${c.tier}${c.tag}-${shot.kind}-${String(i).padStart(2, '0')}.png`;
        await page.screenshot({ path: file });
        frames.push(Object.assign({ file: file.split('/').pop() }, before));
        if (shot.kind === 'track') await page.waitForTimeout(450);
      }
      report.push({ m, kind: shot.kind, name: shot.name, at: Math.round(shot.at), frames });
    }
  }
  return JSON.stringify({ errors, report });
}
