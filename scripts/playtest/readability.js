// The hazard read at a pinned speed: how far ahead the frame's road stays usable, and how tall a tree
// stands in it. Pins the rider to the safe line (as sweep.js does) at each speed and, every `step`
// metres, reads the live chase camera against the course:
//   road    metres ahead of the rider along the run for which the road's middle stays in the frame
//           (and under the top HUD band), is not hidden by the terrain, stands out of the fog, keeps
//           half of a 6 m strip of road clear of the rider's own outline, and a metre of height there
//           still spans at least 6 px of a 720p frame;
//   tree    pixels tall (720p) of a 6.5 m tree on the road 45 m ahead of the rider;
//   rider   pixels tall of the rider (sled base to the top of the beanie, 1.25 m), and its row;
//   lens    metres behind the rider, height over the snow, and the FOV.
// Medians and worst cases per speed. Run against a preview build:
//   playwright-cli -s=lane-feel eval "window.__readCfg = { base: 'http://127.0.0.1:4351/', speeds: [30, 44], ms: [0, 1, 2, 3] }"
//   playwright-cli -s=lane-feel run-code --filename=scripts/playtest/readability.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4173/', speeds: [30, 44], ms: [0], tier: 'high', from: 300, step: 40, n: 14, shots: null }, (await page.evaluate(() => window.__readCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const out = [];
  for (const m of c.ms) {
    for (const speed of c.speeds) {
      await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=${m}&mood=0`);
      await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
      await page.waitForTimeout(600);
      await page.evaluate(({ z, speed }) => {
        const r = window.__gs.run;
        r.sim.s.z = z;
        // Pinned once per sim tick, on the safe line and on the snow (a pin per frame left the sled
        // flying off the slope between pins, and the lens with it).
        const sim = r.sim;
        const cc = sim.course;
        const g = { x: 0, z: 0 };
        r.input = {
          sample: () => {
            const q = sim.s;
            q.x = cc.safeX(q.z);
            q.y = cc.ground(q.x, q.z);
            q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * speed) / 2;
            q.vz = Math.sqrt(Math.max(1, speed * speed - q.vx * q.vx));
            cc.gradient(q.x, q.z, g);
            q.vy = g.x * q.vx + g.z * q.vz;
            q.speed = speed;
            q.grounded = true;
            q.heading = Math.atan2(q.vx, q.vz);
            q.velHeading = q.heading;
            q.invuln = 10;
            q.drifting = false;
            q.boostPool = 0;
            q.flow = 0;
            return { steer: 4, action: false };
          },
        };
        window.__readProbe = () => {
          const app = window.__gs;
          const w = app.world;
          const cam = w.cam.camera;
          const cc = app.run.sim.course;
          const s = app.run.sim.s;
          cam.updateMatrixWorld();
          const v = cam.matrixWorldInverse.elements;
          const pr = cam.projectionMatrix.elements;
          // World (three.js) to view depth and NDC.
          const proj = (x, y, z) => {
            const vx = v[0] * x + v[4] * y + v[8] * z + v[12];
            const vy = v[1] * x + v[5] * y + v[9] * z + v[13];
            const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
            const d = Math.max(0.01, -vz);
            return { x: (pr[0] * vx) / d, y: (pr[5] * vy) / d, d, in: -vz > 0.05 };
          };
          const lp = cam.position;
          const H = 720;
          const tanV = Math.tan((cam.fov * Math.PI) / 360);
          const pxPerM = (d) => H / 2 / (tanV * d);
          // The rider's outline on screen: a box round sled and body.
          const rp = w.rider.root.position;
          const rx = rp.x;
          const rz = rp.z;
          const ry = rp.y;
          const rA = proj(rx, ry, rz);
          const rB = proj(rx, ry + 1.25, rz);
          const rw = (0.55 * pxPerM(rA.d)) / (H / 2) / w.cam.camera.aspect;
          const fogFar = w.palette.fogFar;
          const fogNear = w.palette.fogNear;
          let road = 0;
          let why = 'far';
          for (let D = 4; D <= 200; D += 1) {
            const z = -rz + D;
            const x = cc.safeX(z);
            const y = cc.ground(x, z);
            const p = proj(x, y + 0.05, -z);
            if (!p.in || Math.abs(p.x) > 0.98) { why = 'side'; break; }
            if (p.y > 0.72) { why = 'top'; break; }
            if (p.y < -0.98) continue;
            // Terrain between the lens and the point.
            let hid = false;
            for (let i = 1; i < 24; i++) {
              const u = i / 24;
              const qx = lp.x + (x - lp.x) * u;
              const qz = lp.z + (-z - lp.z) * u;
              const qy = lp.y + (y + 0.3 - lp.y) * u;
              if (cc.ground(qx, -qz) > qy + 0.05) { hid = true; break; }
            }
            if (hid) { why = 'terrain'; break; }
            const fog = Math.min(1, Math.max(0, (p.d - fogNear) / (fogFar - fogNear)));
            if (fog > 0.72) { why = 'fog'; break; }
            if (pxPerM(p.d) < 6) { why = 'px'; break; }
            // A 6 m strip of road, against the rider's outline.
            const half = (3 * pxPerM(p.d)) / (H / 2) / w.cam.camera.aspect;
            const a = p.x - half;
            const b = p.x + half;
            const cover = p.y < rB.y && p.y > rA.y ? Math.max(0, Math.min(b, rA.x + rw) - Math.max(a, rA.x - rw)) / (b - a) : 0;
            // (The rider stands on the first stretch of road by design: only the road it hides past 25 m
            // counts against the read.)
            if (cover > 0.5 && D >= 25) { why = 'rider'; break; }
            road = D;
          }
          const tz = -rz + 45;
          const tx = cc.safeX(tz);
          const ty = cc.ground(tx, tz);
          const t0 = proj(tx, ty, -tz);
          const t1 = proj(tx, ty + 6.5, -tz);
          const tree = (Math.abs(t1.y - t0.y) * H) / 2;
          const back = Math.hypot(lp.x - rx, lp.z - rz);
          const fpx = (Math.abs(rB.y - rA.y) * H) / 2;
          return { road, why, tree: +tree.toFixed(1), rider: +fpx.toFixed(1), riderRow: +(((1 - (rA.y + rB.y) / 2) / 2) * 100).toFixed(1), back: +back.toFixed(2), up: +(lp.y - cc.ground(lp.x, -lp.z)).toFixed(2), fov: +cam.fov.toFixed(1), z: Math.round(s.z), treeRow: +(((1 - t0.y) / 2) * 100).toFixed(1) };
        };
      }, { z: c.from, speed });
      await page.waitForTimeout(1600);
      const rows = [];
      for (let i = 0; i < c.n; i++) {
        const z = c.from + 100 + i * c.step * (speed / 30);
        const ok = await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).then(() => true, () => false);
        if (!ok) break;
        rows.push(await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(() => res(window.__readProbe()), 0)))));
        if (c.shots && i === Math.floor(c.n / 2)) await page.screenshot({ path: `${c.shots}m${m}-v${speed}.png` });
      }
      const med = (k) => { const a = rows.map((r) => r[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
      const lo = (k) => Math.min(...rows.map((r) => r[k]));
      const why = {};
      for (const r of rows) why[r.why] = (why[r.why] ?? 0) + 1;
      out.push({ m, speed, n: rows.length, roadMed: med('road'), roadMin: lo('road'), treeMed: med('tree'), treeMin: lo('tree'), riderMed: med('rider'), riderRow: med('riderRow'), backMed: med('back'), upMed: med('up'), fov: med('fov'), treeRow: med('treeRow'), why });
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ out, errors });
}
