// Round 9, the feelui lane: the title reel over its whole loop, not only across the cut (r9-feelui-reel.js). For each
// mountain picked (`?debug&m=<i>` on a stage's title) it samples every frame from the title's phase for `ms`: the lens's
// distance from the hero, whether the hero is inside the picture, the hero's course position and whether a hero is
// picked yet; and grabs the canvas at the first frame the hero is out of the picture after the first second.
//   playwright-cli -s=r9-feelui eval "window.__rw = { base: 'http://127.0.0.1:5050/', out: 'C:/.../reelwhole/', tag: 'phone', tier: 'medium', stage: 'mid-50', mtns: [6], ms: 20000 }"
//   playwright-cli -s=r9-feelui --raw run-code --filename=scripts/playtest/r9-feelui-reelwhole.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:5050/', out: 'shots/r9/feelui/reelwhole/', tag: 'desk', tier: 'high', stage: 'mid-50', mtns: [0, 1, 2, 3, 4, 5, 6, 7], ms: 20000, label: '' }, (await page.evaluate(() => window.__rw).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
  });
  const out = { tag: c.tag, stage: c.stage, label: c.label, mountains: [], errors };
  for (const i of c.mtns) {
    await page.goto(`${c.base}?debug&tier=${c.tier}&save=${c.stage}&m=${i}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 90000, polling: 100 }).catch(() => {});
    const r = await page.evaluate(
      async ({ ms }) => {
        const g = window.__gs;
        const cam = g.world.cam.camera;
        const rec = { id: g.mountain && g.mountain.id, samples: [], grab: null, cuts: [] };
        const ui = g.ui;
        const orig = ui.titleCut;
        const t0 = performance.now();
        ui.titleCut = function () {
          rec.cuts.push(Math.round(performance.now() - t0));
          return orig.apply(this, arguments);
        };
        await new Promise((done) => {
          const step = () => {
            const t = Math.round(performance.now() - t0);
            const v = g.view;
            const x = v.x;
            const y = v.y + 0.8;
            const z = -v.z;
            const m = cam.matrixWorldInverse.elements;
            const q = cam.projectionMatrix.elements;
            const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
            const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
            const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
            const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
            const px = q[0] * cx + q[4] * cy + q[8] * cz + q[12] * cw;
            const py = q[1] * cx + q[5] * cy + q[9] * cz + q[13] * cw;
            const pw = q[3] * cx + q[7] * cy + q[11] * cz + q[15] * cw;
            const inFrame = pw > 0 && Math.abs(px / pw) <= 1 && Math.abs(py / pw) <= 1;
            const p = cam.position;
            rec.samples.push({ t, z: Math.round(v.z), dist: Math.round(Math.hypot(p.x - x, p.y - y, p.z - z) * 10) / 10, inFrame, hero: g.attract ? g.attract.focus : null });
            if (!rec.grab && !inFrame && t > 1000) {
              rec.grab = { t };
              g.world.onPicture = (cv) => {
                g.world.onPicture = null;
                rec.grab.url = cv.toDataURL('image/jpeg', 0.7);
              };
            }
            if (t > ms) return done();
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        ui.titleCut = orig;
        return rec;
      },
      { ms: c.ms },
    );
    const s = r.samples;
    const spans = [];
    let from = null;
    for (const x of s) {
      const out = !x.inFrame;
      if (out && from === null) from = x;
      if (!out && from !== null) {
        spans.push({ from: from.t, to: x.t, z: from.z, dist: from.dist, hero: from.hero });
        from = null;
      }
    }
    if (from) spans.push({ from: from.t, to: s[s.length - 1].t, z: from.z, dist: from.dist, hero: from.hero, open: true });
    const after1 = s.filter((x) => x.t > 1000);
    out.mountains.push({ i, id: r.id, cuts: r.cuts, frames: s.length, outAfter1s: after1.filter((x) => !x.inFrame).length, of: after1.length, spans: spans.slice(0, 12) });
    if (r.grab && r.grab.url) {
      await page.evaluate(
        ({ url, label }) => {
          const d = document.createElement('div');
          d.id = 'rw-sheet';
          d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b1020;padding:8px;font:700 14px system-ui;color:#f5f3ff';
          d.innerHTML = `<div style="padding:2px 4px">${label}</div>`;
          const im = document.createElement('img');
          im.src = url;
          im.style.cssText = 'display:block;max-width:100%;max-height:92vh;border-radius:6px';
          d.append(im);
          document.body.append(d);
        },
        { url: r.grab.url, label: `${r.id} (${c.tag} ${c.label}): the first frame without the hero after the first second, at ${r.grab.t} ms` },
      );
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${c.out}${c.tag}${c.label ? `-${c.label}` : ''}-out-${r.id}.png` }).catch(() => {});
      await page.evaluate(() => document.getElementById('rw-sheet')?.remove());
    }
  }
  await page.goto('about:blank').catch(() => {});
  return JSON.stringify(out);
}
