// glcount.js's ride and count, with every GL call put down to the three.js draw it belongs to: the renderer's
// renderBufferDirect is wrapped on the live instance, so calls between two draws go to the first (its state and
// uniforms come before its draw call), and calls outside any draw go to the pass that made them (by render target).
//   playwright-cli -s=r8-lowperf eval "window.__dlCfg = { base: 'http://127.0.0.1:4880/', m: 2, tier: 'low' }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/drawlist.js
async (page) => {
  const cfg = { m: 0, tier: 'low', warm: 8, seconds: 10, query: '', ...((await page.evaluate(() => window.__dlCfg).catch(() => null)) || {}) };
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.addInitScript(() => {
    if (WebGL2RenderingContext.prototype.__dl2) return;
    WebGL2RenderingContext.prototype.__dl2 = true;
    const st = { on: false, cur: '(outside)', calls: new Map(), draws: new Map(), outside: new Map() };
    window.__dls2 = st;
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const P = C.prototype;
      for (const k of Object.getOwnPropertyNames(P)) {
        const d = Object.getOwnPropertyDescriptor(P, k);
        if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
        const f = d.value;
        P[k] = function (...a) {
          if (st.on) {
            st.calls.set(st.cur, (st.calls.get(st.cur) ?? 0) + 1);
            if (!st.inDraw) st.outside.set(k, (st.outside.get(k) ?? 0) + 1);
          }
          return f.apply(this, a);
        };
      }
    }
  });
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
  await page.evaluate(() => {
    const app = window.__gs;
    const sim = app.run.sim;
    const c = sim.course;
    app.run.input = {
      sample: () => {
        const s = sim.s;
        if (!s.grounded) return { steer: 4, action: false };
        const look = s.z + 4 + s.speed * 0.35;
        const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
        return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false };
      },
    };
    const st = window.__dls2;
    const r = app.world.renderer;
    const rbd = r.renderBufferDirect.bind(r);
    let pass = '(screen)';
    const srt = r.setRenderTarget.bind(r);
    r.setRenderTarget = (t, ...a) => {
      pass = t ? `rt:${t.texture?.name || t.width + 'x' + t.height}` : '(screen)';
      st.cur = pass;
      return srt(t, ...a);
    };
    r.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
      const names = [];
      for (let o = object; o && names.length < 3; o = o.parent) if (o.name) names.push(o.name);
      const k = `${pass} ${names.join('<') || object.type}:${object.type}/${material.name || material.type}${material.isShaderMaterial ? '#' + (material.vertexShader?.length ?? 0) : ''}${material.uniforms ? ' ' + Object.keys(material.uniforms).filter((u) => !/^(modelMatrix|viewMatrix|projectionMatrix|normalMatrix|cameraPosition|uTime|uFarTable|uFog.*|fog.*|uSun.*|uSky.*)$/.test(u)).slice(0, 4).join(',') : ''}`;
      st.cur = k;
      st.inDraw = true;
      if (st.on) st.draws.set(k, (st.draws.get(k) ?? 0) + 1);
      const out = rbd(camera, scene, geometry, material, object, group);
      st.cur = pass + ' (between)';
      st.inDraw = false;
      return out;
    };
    window.__dlf = 0;
    const tick = () => {
      window.__dlf++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(cfg.warm * 1000);
  const z0 = await page.evaluate(() => {
    const st = window.__dls2;
    st.calls.clear();
    st.draws.clear();
    st.on = true;
    window.__dlf0 = window.__dlf;
    return Math.round(window.__gs.run.sim.s.z);
  });
  await page.waitForTimeout(cfg.seconds * 1000);
  const r = await page.evaluate(() => {
    const st = window.__dls2;
    st.on = false;
    return { outside: [...st.outside], calls: [...st.calls], draws: [...st.draws], frames: window.__dlf - window.__dlf0, z: Math.round(window.__gs.run?.sim.s.z ?? 0) };
  });
  const f = Math.max(1, r.frames);
  const draws = new Map(r.draws);
  const total = r.calls.reduce((a, [, v]) => a + v, 0);
  const rows = r.calls.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / f).toFixed(1)} calls ${((draws.get(k) ?? 0) / f).toFixed(2)} draws  ${k}`);
  return JSON.stringify({ cfg: { m: cfg.m, tier: cfg.tier, base: cfg.base, query: cfg.query }, z: [z0, r.z], frames: r.frames, callsPerFrame: +(total / f).toFixed(1), drawsPerFrame: +([...draws.values()].reduce((a, b) => a + b, 0) / f).toFixed(1), rows, outside: r.outside.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / f).toFixed(2)} ${k}`) }, null, 1);
}
