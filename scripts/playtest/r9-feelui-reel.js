// Round 9, the feelui lane: the title reel's loop, measured on every mountain. For each mountain picked (`?debug&m=<i>`
// on a stage's title) it waits for the reel to cut back to the start of its shot, and from the frame before the cut to
// about 1.5 s after it keeps, every frame, how far the lens stands from the hero (metres, lens to the rider's chest)
// and whether the hero is inside the picture (its chest projected through the lens). At 0, 60, 150, 300, 500 and 800 ms
// after the cut it grabs the canvas as it is drawn (World.onPicture: the scene alone, no DOM, no tags), and lays the
// grabs out as one contact sheet over the page to shoot. Console errors are kept.
//   playwright-cli -s=r9-feelui eval "window.__rl = { base: 'http://127.0.0.1:5050/', out: 'C:/.../shots/r9/feelui/reel/before/', tag: 'desk', tier: 'high', stage: 'mid-50', mtns: [0, 1, 2, 3, 4, 5, 6, 7] }"
//   playwright-cli -s=r9-feelui --raw run-code --filename=scripts/playtest/r9-feelui-reel.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:5050/', out: 'shots/r9/feelui/reel/', tag: 'desk', tier: 'high', stage: 'mid-50', mtns: [0, 1, 2, 3, 4, 5, 6, 7], wait: 45000 }, (await page.evaluate(() => window.__rl).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
  });
  const out = { tag: c.tag, stage: c.stage, mountains: [], errors };
  for (const i of c.mtns) {
    await page.goto(`${c.base}?debug&tier=${c.tier}&save=${c.stage}&m=${i}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 90000, polling: 100 }).catch(() => {});
    await page.waitForTimeout(3500);
    const r = await page.evaluate(
      async ({ wait }) => {
        const g = window.__gs;
        const id = g.mountain && g.mountain.id;
        const cam = g.world.cam.camera;
        const rec = { id, samples: [], grabs: [], cutAt: -1, cuts: 0 };
        const ui = g.ui;
        const orig = ui.titleCut;
        ui.titleCut = function () {
          rec.cuts++;
          if (rec.cutAt < 0) rec.cutAt = performance.now();
          return orig.apply(this, arguments);
        };
        const GRAB = [0, 60, 150, 300, 500, 800];
        let next = 0;
        const t0 = performance.now();
        const hero = () => {
          const v = g.view;
          const x = v.x;
          const y = v.y + 0.8;
          const z = -v.z;
          const p = cam.position;
          const dist = Math.hypot(p.x - x, p.y - y, p.z - z);
          const m = cam.matrixWorldInverse.elements;
          const q = cam.projectionMatrix.elements;
          const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
          const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
          const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
          const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
          const px = q[0] * cx + q[4] * cy + q[8] * cz + q[12] * cw;
          const py = q[1] * cx + q[5] * cy + q[9] * cz + q[13] * cw;
          const pw = q[3] * cx + q[7] * cy + q[11] * cz + q[15] * cw;
          const nx = pw > 0 ? px / pw : 9;
          const ny = pw > 0 ? py / pw : 9;
          return { z: Math.round(v.z), dist: Math.round(dist * 10) / 10, inFrame: pw > 0 && Math.abs(nx) <= 1 && Math.abs(ny) <= 1, nx: Math.round(nx * 100) / 100, ny: Math.round(ny * 100) / 100 };
        };
        await new Promise((done) => {
          let last = null;
          const step = () => {
            const now = performance.now();
            const h = hero();
            if (rec.cutAt < 0) {
              last = { t: 0, ...h };
              if (now - t0 > wait) return done();
            } else {
              const t = Math.round(now - rec.cutAt);
              if (rec.samples.length === 0 && last) rec.samples.push({ ...last, t: -16 });
              rec.samples.push({ t, ...h });
              if (next < GRAB.length && t >= GRAB[next]) {
                next++;
                g.world.onPicture = (cv) => {
                  g.world.onPicture = null;
                  rec.grabs.push({ t: Math.round(performance.now() - rec.cutAt), url: cv.toDataURL('image/jpeg', 0.72) });
                };
              }
              if (t > 1600) return done();
            }
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        ui.titleCut = orig;
        return rec;
      },
      { wait: c.wait },
    );
    const s = r.samples;
    const before = s.length ? s[0] : null;
    const after = s.slice(1);
    const firstIn = after.find((x) => x.inFrame && x.dist < 30);
    const summary = {
      i,
      id: r.id,
      cut: r.cutAt >= 0,
      jump: before && after.length ? before.z - after[after.length - 1].z : null,
      distBefore: before ? before.dist : null,
      distAt: [0, 50, 100, 200, 300, 500, 800, 1200].map((t) => {
        const x = after.find((y) => y.t >= t);
        return x ? { t, dist: x.dist, inFrame: x.inFrame } : null;
      }),
      outOfFrameMs: (() => {
        let ms = 0;
        for (let k = 1; k < after.length; k++) if (!after[k - 1].inFrame || after[k - 1].dist > 30) ms += after[k].t - after[k - 1].t;
        return ms;
      })(),
      heroBackAtMs: firstIn ? firstIn.t : null,
      maxDistAfter: after.reduce((a, x) => Math.max(a, x.dist), 0),
    };
    out.mountains.push({ ...summary, samples: s.slice(0, 120) });
    // The contact sheet: the grabs in a row, each with how long after the cut it was drawn.
    if (r.grabs.length) {
      await page.evaluate(
        ({ grabs, label }) => {
          const d = document.createElement('div');
          d.id = 'rl-sheet';
          d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b1020;display:flex;flex-wrap:wrap;align-content:flex-start;gap:6px;padding:8px;font:700 14px system-ui;color:#f5f3ff';
          const h = document.createElement('div');
          h.style.cssText = 'flex-basis:100%;padding:2px 4px';
          h.textContent = label;
          d.append(h);
          const tall = innerHeight > innerWidth;
          for (const gr of grabs) {
            const f = document.createElement('figure');
            f.style.cssText = `margin:0;width:${tall ? 'calc(33.3% - 6px)' : 'calc(33.3% - 6px)'};`;
            const im = document.createElement('img');
            im.src = gr.url;
            im.style.cssText = 'display:block;width:100%;height:auto;border-radius:6px';
            const cap = document.createElement('figcaption');
            cap.textContent = `+${gr.t} ms`;
            f.append(im, cap);
            d.append(f);
          }
          document.body.append(d);
        },
        { grabs: r.grabs, label: `${r.id} (${c.tag}, ${c.stage}): the reel's cut, the canvas from the cut on` },
      );
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${c.out}${c.tag}-reel-${r.id}.png` }).catch((e) => errors.push(`shot ${r.id}: ${String(e).slice(0, 120)}`));
      await page.evaluate(() => document.getElementById('rl-sheet')?.remove());
    }
  }
  await page.goto('about:blank').catch(() => {});
  return JSON.stringify(out);
}
