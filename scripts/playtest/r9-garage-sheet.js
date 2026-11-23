// Round 9, the garage lane: the race-distance sheet. A pool rider is replayed as the player (?demo=N) on a virtual
// clock, as stills.js does, and at a metre down the run each garage piece (today's, through the rider's own setters;
// a proposal, through prototypes/r9/garage/items.ts, which the dev server serves into the same module graph) is put
// on, a few frames are stepped so the scarf and the trail settle into it, and the chase lens's frame is kept whole
// and cropped round the rider at its own size (nothing scaled up). Then each shelf's crops are laid out as one sheet
// in a shuffled order, numbered, with no names: the key comes back in the result, for the main lane, never the critic.
//   playwright-cli -s=r9-garage eval "window.__sheetCfg = { base: 'http://127.0.0.1:4940/', shelves: ['hats'] }"
//   playwright-cli -s=r9-garage run-code --filename=scripts/playtest/r9-garage-sheet.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4940/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/garage/sheet/', tier: 'high', m: 0, demo: 0, z: 300, shelves: ['hats', 'scarves', 'burn', 'finishes', 'sleds', 'trails'], settle: 14, trailSettle: 80, seed: 9 },
    (await page.evaluate(() => window.__sheetCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  if (c.width && c.height) await page.setViewportSize({ width: c.width, height: c.height });
  const vp = page.viewportSize();
  const result = { cfg: { tier: c.tier, m: c.m, demo: c.demo, z: c.z, viewport: vp }, shelves: {}, errors };

  for (const shelf of c.shelves) {
    await page.goto(c.base);
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
    await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
    const items = await page.evaluate(async (shelfName) => {
      const vc = { t: performance.now(), q: [], timers: [], id: 1 };
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
      const zNow = () => {
        const r = window.__gs.run;
        return r && window.__gs.phase === 'run' ? r.sim.s.z : -1;
      };
      window.__shTo = (z, n) => {
        for (let i = 0; i < n; i++) {
          const now = zNow();
          if (now < 0 || now >= z) break;
          vc.step(1000 / 60);
        }
        return zNow();
      };
      window.__shSteps = (n) => {
        for (let i = 0; i < n; i++) vc.step(1000 / 60);
        return zNow();
      };
      const proto = await import('/prototypes/r9/garage/items.ts');
      const garage = await import('/src/game/garage.ts');
      const w = window.__gs.world;
      window.__shApply = (look) => proto.applyLook(w.rider, w.scene, look, (id) => w.setTrail(garage.trailById(id)));
      // The rider's box on screen: the sled's base and a point over the head, through the chase lens.
      window.__shBox = () => {
        const cam = w.cam.camera;
        const base = w.rider.root.getWorldPosition(new cam.position.constructor());
        const top = base.clone();
        top.y += 1.75;
        const a = base.clone().project(cam);
        const b = top.clone().project(cam);
        const W = innerWidth;
        const H = innerHeight;
        return { x: ((a.x + 1) / 2) * W, y: ((1 - a.y) / 2) * H, top: ((1 - b.y) / 2) * H };
      };
      return proto.SHEET[shelfName].map((it) => ({ key: it.key, name: it.name, today: it.today, look: it.look }));
    }, shelf);
    let z;
    do z = await page.evaluate((zz) => window.__shTo(zz, 300), c.z);
    while (z >= 0 && z < c.z);
    const shots = [];
    for (const it of items) {
      await page.evaluate((look) => window.__shApply(look), it.look);
      await page.evaluate((n) => window.__shSteps(n), shelf === 'trails' ? c.trailSettle : c.settle);
      const box = await page.evaluate(() => window.__shBox());
      const h = Math.max(40, box.y - box.top);
      const side = Math.round(Math.min(vp.height, h * (shelf === 'trails' ? 3.6 : 2.4)));
      const x = Math.round(Math.max(0, Math.min(vp.width - side, box.x - side / 2)));
      const y = Math.round(Math.max(0, Math.min(vp.height - side, box.top - side * (shelf === 'trails' ? 0.3 : 0.28))));
      await page.screenshot({ path: `${c.out}full/${shelf}-${it.key}.png` });
      const crop = await page.screenshot({ clip: { x, y, width: side, height: side } });
      shots.push({ ...it, crop: crop.toString('base64'), box: { x, y, side, riderPx: Math.round(h) } });
    }
    // The sheet: a seeded shuffle, numbered tiles at their own size, no names.
    let s = c.seed + shelf.length * 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const order = shots.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const side = Math.max(...shots.map((x) => x.box.side));
    const cols = Math.min(order.length, shelf === 'trails' ? 3 : 4);
    const tiles = order.map((k, n) => `<figure><img src="data:image/png;base64,${shots[k].crop}" width="${shots[k].box.side}" height="${shots[k].box.side}"><figcaption>${n + 1}</figcaption></figure>`).join('');
    await page.goto('about:blank');
    await page.setContent(`<!doctype html><html><head><style>body{margin:0;background:#121933;font:800 22px system-ui,sans-serif;color:#F5F3FF}main{display:grid;grid-template-columns:repeat(${cols},${side}px);gap:8px;padding:8px;width:max-content}figure{margin:0;position:relative;width:${side}px;height:${side}px;display:flex;align-items:flex-start;justify-content:center;background:#0b1024}figcaption{position:absolute;left:8px;top:6px;background:#121933;border-radius:999px;padding:2px 10px}</style></head><body><main>${tiles}</main></body></html>`);
    const main = await page.$('main');
    await main.screenshot({ path: `${c.out}${shelf}.png` });
    result.shelves[shelf] = { key: order.map((k, n) => ({ n: n + 1, key: shots[k].key, name: shots[k].name, today: shots[k].today, riderPx: shots[k].box.riderPx })) };
  }
  await page.goto('about:blank');
  return JSON.stringify(result);
}
