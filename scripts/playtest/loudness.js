// Loudness, live. Taps the master's last node (engine.debugTap) with a ScriptProcessor, records a real
// run's output as PCM, and measures it to ITU-R BS.1770-4 / EBU R128 in the page:
//   lufs      integrated loudness (K-weighted, 400 ms blocks at 75% overlap, -70 LUFS absolute and
//             -10 LU relative gates)
//   stMax     the loudest 3 s short-term window; mMax the loudest 400 ms momentary window
//   lra       loudness range (short-term windows, -20 LU relative gate, 10th to 95th percentile)
//   tp        true peak, dBTP (4x oversampled, windowed-sinc interpolation)
//   peak, rms sample peak and RMS, dBFS
//   corr      L/R correlation (1 mono, 0 wide, negative cancels in mono)
//   monoLoss  how much quieter the mono fold-down (L+R)/2 measures than the stereo, LU
//   phoneLoss how much quieter it measures through a phone speaker's band (a 4th-order 250 Hz
//             high-pass and a gentle top roll-off at 9 kHz), LU
// Passes (window.__loudCfg.passes, each a fresh run of the same replayed ghost, ?demo=N):
//   { m, part: 'mix' | 'music' | 'sfx', seconds }   music: effects slider 0; sfx: music slider 0
// Works on any build with engine.debugTap (round 3 on), so two builds measure alike.
//   playwright-cli -s=loud eval "window.__loudCfg = { base: 'http://127.0.0.1:4310/' }"
//   playwright-cli -s=loud run-code --filename=scripts/playtest/loudness.js
async (page) => {
  const cfg = Object.assign(
    { base: 'http://127.0.0.1:4173/', demo: 0, seconds: 60, passes: null, tier: 'medium' },
    (await page.evaluate(() => window.__loudCfg).catch(() => null)) || {},
  );
  const passes = cfg.passes || [
    { m: 0, part: 'mix' },
    { m: 1, part: 'mix' },
    { m: 2, part: 'mix' },
    { m: 3, part: 'mix' },
    { m: 0, part: 'music' },
    { m: 0, part: 'sfx' },
  ];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const out = [];
  for (const p of passes) {
    const seconds = p.seconds || cfg.seconds;
    await page.goto(cfg.base + '?platform=mock');
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${p.m}&autoride=1&demo=${p.demo ?? cfg.demo}`);
    await page.waitForFunction(() => window.__gs && window.__gs.audio, null, { timeout: 60000 });
    await page.keyboard.press('q');
    const res = await page.evaluate(async ([part, seconds]) => {
      const g = window.__gs;
      const a = g.audio;
      const t0 = performance.now();
      while (!a.debugTap() && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
      const tap = a.debugTap();
      if (!tap) return { error: 'no tap' };
      const { ctx, out } = tap;
      if (ctx.state !== 'running') await ctx.resume().catch(() => null);
      a.setVolumes({ master: 1, music: part === 'sfx' ? 0 : 0.8, sfx: part === 'music' ? 0 : 0.8 });
      const sr = ctx.sampleRate;
      const L = [];
      const R = [];
      const sp = ctx.createScriptProcessor(4096, 2, 2);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      sp.onaudioprocess = (e) => {
        L.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        R.push(new Float32Array(e.inputBuffer.getChannelData(1)));
      };
      out.connect(sp);
      sp.connect(sink).connect(ctx.destination);
      // From the run's start (the count-in included) for `seconds`, or to the results.
      const start = performance.now();
      // Round 6 on: the true-peak limiter's and the sidechain's deepest gain each quarter second.
      const lim = [];
      const side = [];
      while (performance.now() - start < seconds * 1000) {
        await new Promise((r) => setTimeout(r, 250));
        if (a.debugMaster) {
          const m = await a.debugMaster();
          if (m) {
            lim.push(m.limiter);
            side.push(m.side);
          }
        }
        if (g.phase === 'results' && performance.now() - start > 8000) {
          await new Promise((r) => setTimeout(r, 4000));
          break;
        }
      }
      out.disconnect(sp);
      sp.disconnect();
      const n = L.reduce((s, b) => s + b.length, 0);
      const cat = (bs) => { const x = new Float32Array(n); let o = 0; for (const b of bs) { x.set(b, o); o += b.length; } return x; };
      const l = cat(L);
      const r = cat(R);

      const biquad = (x, b, a2) => {
        const y = new Float32Array(x.length);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < x.length; i++) {
          const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a2[1] * y1 - a2[2] * y2;
          x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
        }
        return y;
      };
      // K-weighting for any sample rate (the BS.1770 analogue prototypes, bilinear).
      const kw = (x) => {
        let K = Math.tan((Math.PI * 1681.974450955533) / sr);
        const Vh = Math.pow(10, 3.999843853973347 / 20);
        const Vb = Math.pow(Vh, 0.4996667741545416);
        let Q = 0.7071752369554196;
        let a0 = 1 + K / Q + K * K;
        const s1b = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0];
        const s1a = [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
        K = Math.tan((Math.PI * 38.13547087602444) / sr);
        Q = 0.5003270373238773;
        a0 = 1 + K / Q + K * K;
        const s2a = [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
        return biquad(biquad(x, s1b, s1a), [1, -2, 1], s2a);
      };
      // Butterworth sections for the phone-speaker band.
      const hp = (x, f) => { const w = Math.tan((Math.PI * f) / sr); const q = Math.SQRT1_2; const a0 = 1 + w / q + w * w; return biquad(x, [1 / a0, -2 / a0, 1 / a0], [1, (2 * (w * w - 1)) / a0, (1 - w / q + w * w) / a0]); };
      const lp = (x, f) => { const w = Math.tan((Math.PI * f) / sr); const q = Math.SQRT1_2; const a0 = 1 + w / q + w * w; return biquad(x, [(w * w) / a0, (2 * w * w) / a0, (w * w) / a0], [1, (2 * (w * w - 1)) / a0, (1 - w / q + w * w) / a0]); };

      const blockMS = (kl, kr, i0, len) => {
        let s = 0;
        for (let i = i0; i < i0 + len; i++) s += kl[i] * kl[i] + kr[i] * kr[i];
        return s / len;
      };
      const lufsOf = (ms) => -0.691 + 10 * Math.log10(ms + 1e-30);
      const measure = (ll, rr) => {
        const kl = kw(ll);
        const kr = kw(rr);
        const B = Math.round(0.4 * sr);
        const H = Math.round(0.1 * sr);
        const blocks = [];
        for (let i = 0; i + B <= kl.length; i += H) blocks.push(blockMS(kl, kr, i, B));
        const abs = blocks.filter((z) => lufsOf(z) > -70);
        const mean = (xs) => xs.reduce((s, z) => s + z, 0) / Math.max(1, xs.length);
        const rel = lufsOf(mean(abs)) - 10;
        const gated = abs.filter((z) => lufsOf(z) > rel);
        const lufs = lufsOf(mean(gated));
        const mMax = Math.max(...blocks.map(lufsOf));
        const S = Math.round(3 * sr);
        const st = [];
        for (let i = 0; i + S <= kl.length; i += sr) st.push(lufsOf(blockMS(kl, kr, i, S)));
        const stAbs = st.filter((z) => z > -70);
        const stMean = lufsOf(stAbs.map((z) => Math.pow(10, (z + 0.691) / 10)).reduce((s, z) => s + z, 0) / Math.max(1, stAbs.length));
        const stG = stAbs.filter((z) => z > stMean - 20).sort((a2, b2) => a2 - b2);
        const pct = (q) => stG[Math.min(stG.length - 1, Math.floor(q * (stG.length - 1)))];
        return { lufs, mMax, stMax: Math.max(...st), lra: stG.length ? pct(0.95) - pct(0.1) : 0 };
      };
      // True peak: 4x oversampling through a 48-tap windowed sinc per phase.
      const truePeak = (x) => {
        const taps = 12;
        const ph = 4;
        const h = [];
        for (let p = 1; p < ph; p++) {
          const row = [];
          for (let k = -taps; k < taps; k++) {
            const t = k + 1 - p / ph;
            const sinc = Math.abs(t) < 1e-9 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
            const w = 0.42 + 0.5 * Math.cos((Math.PI * t) / taps) + 0.08 * Math.cos((2 * Math.PI * t) / taps);
            row.push(sinc * w);
          }
          h.push(row);
        }
        let m = 0;
        for (let i = taps; i < x.length - taps; i++) {
          const a0 = Math.abs(x[i]);
          if (a0 > m) m = a0;
          // Only look between samples where the signal is already loud.
          if (a0 < 0.25 && Math.abs(x[i + 1]) < 0.25) continue;
          for (const row of h) {
            let s = 0;
            for (let k = 0; k < row.length; k++) s += row[k] * x[i - taps + 1 + k];
            const v = Math.abs(s);
            if (v > m) m = v;
          }
        }
        return m;
      };
      const db = (v) => (v > 1e-9 ? 20 * Math.log10(v) : -180);
      let pk = 0, ss = 0, sl = 0, sr2 = 0, slr = 0;
      for (let i = 0; i < n; i++) {
        const a1 = l[i], b1 = r[i];
        pk = Math.max(pk, Math.abs(a1), Math.abs(b1));
        ss += a1 * a1 + b1 * b1;
        sl += a1 * a1; sr2 += b1 * b1; slr += a1 * b1;
      }
      const full = measure(l, r);
      const mono = new Float32Array(n);
      for (let i = 0; i < n; i++) mono[i] = 0.5 * (l[i] + r[i]);
      const monoM = measure(mono, mono);
      const phoneBand = (x) => lp(hp(hp(x, 250), 250), 9000);
      const pm = phoneBand(mono);
      const phoneM = measure(pm, pm);
      const tp = Math.max(truePeak(l), truePeak(r));
      const r1 = (v) => Math.round(v * 10) / 10;
      return {
        part,
        seconds: r1(n / sr),
        sr,
        lufs: r1(full.lufs),
        mMax: r1(full.mMax),
        stMax: r1(full.stMax),
        lra: r1(full.lra),
        tp: r1(db(tp)),
        peak: r1(db(pk)),
        rms: r1(db(Math.sqrt(ss / (2 * n)))),
        corr: Math.round((slr / Math.sqrt(sl * sr2 + 1e-30)) * 100) / 100,
        monoLoss: r1(full.lufs - monoM.lufs),
        phoneLoss: r1(full.lufs - phoneM.lufs),
        // The limiter's deepest gain reduction (dB), and the share of quarter seconds it took more than 1 dB and
        // more than 3 dB; the sidechain's deepest duck and the share it ducked the music more than 1 dB.
        ...(lim.length
          ? {
              limMaxDb: r1(-20 * Math.log10(Math.max(1e-6, Math.min(...lim)))),
              lim1: Math.round((lim.filter((g) => g < 0.891).length / lim.length) * 1000) / 1000,
              lim3: Math.round((lim.filter((g) => g < 0.708).length / lim.length) * 1000) / 1000,
              sideMaxDb: r1(-20 * Math.log10(Math.max(1e-6, Math.min(...side)))),
              side1: Math.round((side.filter((g) => g < 0.891).length / side.length) * 1000) / 1000,
            }
          : {}),
      };
    }, [p.part, seconds]);
    out.push({ m: p.m, ...res });
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors, out }, null, 0);
}
