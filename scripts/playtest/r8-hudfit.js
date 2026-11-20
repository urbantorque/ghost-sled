// Round 8, the screens lane: the phone's HUD measured against its edges and the thumbs' zones. Opens each harness
// scenario (ui-harness.html, touch mode, bare), waits for its beats to land, and reads the box of every visible piece
// of the HUD, its callouts, stamps, hints and notices: one that runs off an edge, or sits in the thumbs' band (the
// bottom 22% of a phone held upright, fx.ts LOW_FLOOR), is a fault. The touch controls that belong under a thumb
// (the lantern button, the zones' own labels and rings while a touch hint teaches them) are not.
//   playwright-cli -s=r8-screens eval "window.__fitCfg = { base: 'http://127.0.0.1:4800/', out: 'C:/.../shots/r8/screens/hudfit/', tag: 'after' }"
//   playwright-cli -s=r8-screens --raw run-code --filename=scripts/playtest/r8-hudfit.js
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:4800/',
      out: 'shots/r8/screens/hudfit/',
      tag: 'after',
      mode: 'touch',
      shots: true,
      scenarios: ['hud', 'hud-long', 'callouts', 'callouts-landing', 'callouts-landing-big', 'callouts-perfect', 'callouts-late-stomp', 'callouts-pass', 'callouts-chase', 'tricks-long', 'stamp-long', 'queue', 'race-call', 'pops', 'pop-mission', 'toasts', 'countdown', 'chase-stake', 'danger-chase', 'hint-steer', 'hint-stomp', 'hint-draft', 'hint-dash', 'hint-flipspin', 'warn-avalanche', 'streak-5', 'stake-fuse'],
      wait: 900,
    },
    (await page.evaluate(() => window.__fitCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
  });
  const report = [];
  for (const s of c.scenarios) {
    await page.goto(`${c.base}ui-harness.html?s=${s}&mode=${c.mode}&bare=1`);
    await page.waitForTimeout(c.wait);
    const r = await page.evaluate(() => {
      const vw = innerWidth;
      const vh = innerHeight;
      const floor = vh > vw ? 0.78 * vh : vh;
      const out = { vw, vh, off: [], thumb: [] };
      const exempt = (el) => !!el.closest('.gs-lantern, .gs-touch, .gs-zones, .gs-results, .gs-title, .gs-sheetwrap, .gs-pause, .gs-pause-btn, [data-fk="pause"]');
      const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 3).join('.')}: ${(el.textContent || '').trim().slice(0, 40)}`;
      for (const el of document.querySelectorAll('.gs-ui *')) {
        if (!(el instanceof HTMLElement) || exempt(el)) continue;
        // Leaves only (a box with its own words or a glyph), so a wide wrapper never counts for its child.
        if (el.children.length > 0 && !el.matches('.gs-call, .gs-hero-in, .gs-hint, .gs-toast, .gs-pill')) continue;
        // An empty layer (the callout and hint layers span the screen) draws nothing.
        if (!(el.textContent || '').trim() && !el.matches('.gs-i, .gs-lan-cell, .gs-ring, svg, svg *')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        let o = 1;
        for (let p = el; p && p !== document.body; p = p.parentElement) o *= Number(getComputedStyle(p).opacity);
        if (o < 0.2) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) out.off.push({ el: name(el), box: [b.left, b.top, b.right, b.bottom].map(Math.round) });
        else if (b.bottom > floor + 0.5) out.thumb.push({ el: name(el), box: [b.left, b.top, b.right, b.bottom].map(Math.round) });
      }
      return out;
    });
    report.push({ s, ...r });
    if (c.shots) await page.screenshot({ path: `${c.out}${c.tag}-${s}.png` }).catch(() => {});
  }
  await page.goto('about:blank');
  const faults = report.filter((r) => r.off.length || r.thumb.length).map((r) => ({ s: r.s, off: r.off, thumb: r.thumb }));
  return JSON.stringify({ scenarios: report.length, faulty: faults.length, faults, errors }, null, 1);
}
