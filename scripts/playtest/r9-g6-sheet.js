// Round 9, the g6 lane (from the shop lane's r9-shop-sheet.js): the race-distance sheets on the game's own pieces, the
// shelves as G6 left them (what is sold or found; a piece no longer sold is not on a shelf). A pool rider is replayed as the player (?demo=N) on a virtual clock; at a metre down the run
// each piece is put on through the game's own setters (rider.setHat, setScarf, setFinish, setTracks; world.setTrail),
// a few frames are stepped so the scarf and the trail settle into it, and the chase lens's frame is kept whole and
// cropped round the rider at its own size (nothing scaled). Each shelf's crops are laid out as one sheet in a seeded
// shuffle, numbered, with no names: the key comes back in the result (never the critic's).
//   playwright-cli -s=r9-shop eval "window.__sheetCfg = { base: 'http://127.0.0.1:4960/', shelves: ['hats'] }"
//   playwright-cli -s=r9-shop run-code --filename=scripts/playtest/r9-shop-sheet.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:5010/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/g6/sheet/', tier: 'high', m: 0, demo: 0, z: 300, z0: 200, shelves: ['hats'], settle: 14, seed: 9, reloadEach: ['trails', 'trailsFound', 'trailsA', 'trailsB'] },
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

  // Every look a sheet shoots, by shelf (the key's names are the game's own, garage.ts and paints.ts).
  const SHEETS = {
    hats: ['beanie', 'watch', 'twinpom', 'trapper', 'chullo', 'longcap', 'muffs', 'downcap', 'twintails'].map((id) => ({ key: id, look: { hat: id } })),
    // (G6: every scarf a shelf shows to a rider who has not bought it: the shop's, the Almanac's and the eight sets'.)
    scarvesAll: ['classic', 'creambar', 'inkband', 'snowtip', 'streamer', 'pomtails', 'rope', 'almanacknot', 'almanacveil', 'firchevron', 'fangedge', 'ashmarket', 'petalhem', 'lamproad', 'belltails', 'pennants', 'awning'].map((id) => ({ key: id, look: { scarf: id } })),
    // (G6: the months' trails against the shop's stock; the sets' and the Almanac's against it again.)
    trailsA: ['powder', 'honey', 'glints', 'stardust', 'comet', 'petals', 'streamers', 'kitetails', ...Array.from({ length: 12 }, (_, i) => `ch${i + 1}trail`)].map((id) => ({ key: id, look: { trail: id } })),
    trailsB: ['powder', 'honey', 'glints', 'stardust', 'comet', 'petals', 'streamers', 'kitetails', 'almanacmoth', 'almanacember', 'almanackeeper', 'staglights', 'frostfeathers', 'lavadrops', 'papercranes', 'skylanterns', 'pealrings', 'gulls', 'pinwheels'].map((id) => ({ key: id, look: { trail: id } })),
    ornamentsAll: ['lamp', 'cowbell', 'icefang', 'basaltcrown', 'papercrane', 'greatlantern', 'timingclock', 'lighthouse', 'gablehouse', ...Array.from({ length: 12 }, (_, i) => `ch${i + 1}orn`)].map((id) => ({ key: id, look: { tiers: 4, ornament: id } })),
    // (G6: the rider's colours: each stock sled, and the flow's rim on three of them.)
    colours: [0, 1, 2, 3, 4, 5].map((s) => ({ key: `sled${s}-stock`, look: { sled: s, tiers: 0 } })).concat([0, 1, 4].map((s) => ({ key: `sled${s}-flow`, look: { sled: s, tiers: 0, flow: 4 } }))),
    scarves: ['classic', 'creambar', 'chunky', 'tassel', 'inkband', 'snowtip', 'streamer', 'pomtails', 'rope', 'almanacknot', 'almanacveil'].map((id) => ({ key: id, look: { scarf: id } })),
    scarvesFound: ['firchevron', 'fangedge', 'ashmarket', 'petalhem', 'lamproad', ...Array.from({ length: 12 }, (_, i) => `ch${i + 1}scarf`)].map((id) => ({ key: id, look: { scarf: id } })),
    burn: ['classic', 'creambar', 'inkband', 'awning', 'belltails'].map((id) => ({ key: `${id}-flow`, look: { scarf: id, flow: 4 } })),
    finishes: ['natural', 'pine', 'glacier', 'midnight', 'plum', 'cocoa', 'snow', 'ash', 'almanacdusk'].map((id) => ({ key: id, look: { finish: id } })),
    sleds: [0, 1, 2, 3, 4, 5].map((t) => ({ key: `flyer-${t}`, look: { tiers: t } })).concat([{ key: 'flyer-5-flow', look: { tiers: 5, flow: 4 } }]),
    sledsAll: [0, 1, 2, 3, 4, 5].flatMap((s) => [{ key: `sled${s}-stock`, look: { sled: s, tiers: 0 } }, { key: `sled${s}-5`, look: { sled: s, tiers: 5 } }]),
    ornaments: ['lamp', 'cowbell', 'icefang', 'basaltcrown', 'papercrane', 'greatlantern', ...Array.from({ length: 12 }, (_, i) => `ch${i + 1}orn`)].map((id) => ({ key: id, look: { tiers: 4, ornament: id } })),
    trails: ['powder', 'honey', 'sparks', 'glints', 'stardust', 'comet', 'petals', 'streamers', 'kitetails', 'almanacmoth', 'almanacember', 'almanackeeper'].map((id) => ({ key: id, look: { trail: id } })),
    trailsFound: ['staglights', 'frostfeathers', 'lavadrops', 'papercranes', 'skylanterns', ...Array.from({ length: 12 }, (_, i) => `ch${i + 1}trail`)].map((id) => ({ key: id, look: { trail: id } })),
    probe: [1, 2, 3, 4, 5, 6].map((n) => ({ key: `p${n}`, look: {} })),
    outfits: [
      { key: 'a', look: { hat: 'twintails', scarf: 'belltails', finish: 'snow', tiers: 4, ornament: 'timingclock', trail: 'pealrings' } },
      { key: 'b', look: { hat: 'muffs', scarf: 'pennants', finish: 'cocoa', tiers: 5, ornament: 'lighthouse', trail: 'gulls' } },
      { key: 'c', look: { hat: 'downcap', scarf: 'awning', finish: 'midnight', tiers: 2, trail: 'pinwheels' } },
      { key: 'd', look: { hat: 'trapper', scarf: 'inkband', finish: 'plum', tiers: 4, ornament: 'gablehouse', trail: 'ch9trail' } },
    ],
  };

  // A fresh run from a fresh save, the clock virtual; returns the shelf's looks.
  const boot = async (shelf) => {
    await page.goto(c.base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
    await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
    await page.evaluate(async () => {
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
      // (A calm moment: on the snow, not carving hard, not drifting, so no spray stands between the lens and the rider.)
      window.__shCalm = (n) => {
        for (let i = 0; i < n; i++) {
          const r = window.__gs.run;
          const st = r && r.sim.s;
          if (!st || (st.grounded && Math.abs(st.carve) < 0.3 && !st.drifting && st.speed > 15)) break;
          vc.step(1000 / 60);
        }
        return zNow();
      };
      window.__shSteps = (n) => {
        for (let i = 0; i < n; i++) vc.step(1000 / 60);
        return zNow();
      };
      const G = await import('/src/game/garage.ts');
      const P = await import('/src/game/paints.ts');
      const w = window.__gs.world;
      const r = w.rider;
      const proto = Object.getPrototypeOf(r);
      // A look through the game's own setters; the rider's own glows held still for a shot (no dash shimmer) and
      // Spirit Flow pinned where a look asks for it.
      window.__shApply = (look) => {
        const sled = look.sled ?? 0;
        r.setSled(sled);
        r.setHat(look.hat ?? 'beanie');
        r.setScarf(G.scarfById(look.scarf ?? 'classic'));
        r.setFinish(P.paintById(look.finish ?? 'natural'));
        r.setTracks({ [sled]: look.tiers ?? 0 }, look.ornament ?? 'lamp');
        w.setTrail(G.trailById(look.trail ?? 'powder'));
        delete r.setBurn;
        delete r.setFlow;
        delete r.setSpirit;
        const flow = look.flow ?? 0;
        const burn = flow >= 2 ? Math.min(1, (flow - 1) / 3) : 0;
        r.setSpirit = () => proto.setSpirit.call(r, 0, false, false);
        r.setBurn = () => proto.setBurn.call(r, burn);
        r.setFlow = () => proto.setFlow.call(r, flow, 0);
        proto.setBurn.call(r, burn);
        // (G6: Spirit Flow's own picture, its flame off the scarf's tip, held at the look's flow too: the pilot rides in
        // the flow, and its flame stood in the spray of every tile that did not ask for it.)
        w.devFlow = flow;
      };
      // The rider's box on screen: the sled's base and a point over the head, through the chase lens.
      window.__shBox = () => {
        const cam = w.cam.camera;
        const base = r.root.getWorldPosition(new cam.position.constructor());
        const top = base.clone();
        top.y += 1.75;
        const a = base.clone().project(cam);
        const b = top.clone().project(cam);
        return { x: ((a.x + 1) / 2) * innerWidth, y: ((1 - a.y) / 2) * innerHeight, top: ((1 - b.y) / 2) * innerHeight };
      };
    });
    // (G6, the blotch in the spray: a probe with the drift's heat taken out of the spray, to tell what makes it.)
    if (c.noHeat)
      await page.evaluate(() => {
        const p = window.__gs.world.particles;
        const o = p.spray.bind(p);
        p.spray = (...a) => {
          a[6] = null;
          a[7] = 0;
          a[8] = 0;
          return o(...a);
        };
      });
    return SHEETS[shelf];
  };
  for (const shelf of c.shelves) {
    const to = async (zz) => {
      let z;
      do z = await page.evaluate((q) => window.__shTo(q, 300), zz);
      while (z >= 0 && z < zz);
    };
    // (A trail needs seconds of riding to show, so each trail gets its own run: put on at z0, shot at z, the same
    // place for every one. The rest are put on one after another at z, a few frames apart.)
    const each = (c.reloadEach || []).includes(shelf);
    const items = await boot(shelf);
    // (The ornaments are eighteen in a row: a shorter settle from a little earlier, so the last is shot before the leap.)
    const settle = shelf.startsWith('ornaments') ? 6 : c.settle;
    if (!each) {
      await to(shelf.startsWith('ornaments') ? Math.min(c.z, 400) : c.z);
      await page.evaluate(() => window.__shCalm(240));
    }
    const shots = [];
    const wide = shelf.startsWith('trails') || shelf === 'outfits';
    for (const it of items) {
      if (each) {
        if (shots.length) await boot(shelf);
        await to(c.z0);
        await page.evaluate((l) => window.__shApply(l), it.look);
        await to(c.z);
        await page.evaluate(() => window.__shCalm(240));
      } else {
        // (G6: eight a run at most; the shop lane's eleven in a row reached the leap by the seventeenth, mid-flip.)
        if (shots.length && shots.length % 8 === 0) {
          await boot(shelf);
          await to(shelf.startsWith('ornaments') ? Math.min(c.z, 400) : c.z);
          await page.evaluate(() => window.__shCalm(240));
        }
        await page.evaluate((l) => window.__shApply(l), it.look);
        await page.evaluate((n) => window.__shSteps(n), settle);
      }
      const box = await page.evaluate(() => window.__shBox());
      const h = Math.max(40, box.y - box.top);
      const side = Math.round(Math.min(vp.height, h * (wide ? 3.6 : 2.4)));
      const x = Math.round(Math.max(0, Math.min(vp.width - side, box.x - side / 2)));
      const y = Math.round(Math.max(0, Math.min(vp.height - side, box.top - side * (wide ? 0.3 : 0.28))));
      await page.screenshot({ path: `${c.out}full/${shelf}-${it.key}.png` });
      const crop = shelf === 'outfits' ? await page.screenshot() : await page.screenshot({ clip: { x, y, width: side, height: side } });
      shots.push({ ...it, crop: crop.toString('base64'), box: shelf === 'outfits' ? { side: vp.width, h: vp.height, riderPx: Math.round(h) } : { x, y, side, riderPx: Math.round(h) } });
    }
    // The sheet: a seeded shuffle, numbered tiles at their own size, no names.
    let s = c.seed + shelf.length * 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const order = shots.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (shelf === 'outfits') {
      // (Whole frames, one file each, for the second question: name what the rider wears.)
      for (let n = 0; n < order.length; n++) {
        await page.goto('about:blank');
        await page.setContent(`<!doctype html><html><body style="margin:0;background:#000"><img src="data:image/png;base64,${shots[order[n]].crop}"></body></html>`);
        await (await page.$('img')).screenshot({ path: `${c.out}outfit-${String.fromCharCode(65 + n)}.png` });
      }
    } else {
      const side = Math.max(...shots.map((x) => x.box.side));
      const cols = Math.min(order.length, wide ? 3 : 4);
      const tiles = order.map((k, n) => `<figure><img src="data:image/png;base64,${shots[k].crop}" width="${shots[k].box.side}" height="${shots[k].box.side}"><figcaption>${n + 1}</figcaption></figure>`).join('');
      await page.goto('about:blank');
      await page.setContent(`<!doctype html><html><head><style>body{margin:0;background:#121933;font:800 22px system-ui,sans-serif;color:#F5F3FF}main{display:grid;grid-template-columns:repeat(${cols},${side}px);gap:8px;padding:8px;width:max-content}figure{margin:0;position:relative;width:${side}px;height:${side}px;display:flex;align-items:flex-start;justify-content:center;background:#0b1024}figcaption{position:absolute;left:8px;top:6px;background:#121933;border-radius:999px;padding:2px 10px}</style></head><body><main>${tiles}</main></body></html>`);
      const main = await page.$('main');
      await main.screenshot({ path: `${c.out}${shelf}.png` });
    }
    result.shelves[shelf] = { key: order.map((k, n) => ({ n: n + 1, key: shots[k].key, riderPx: shots[k].box.riderPx })) };
  }
  await page.goto('about:blank');
  return JSON.stringify(result);
}
