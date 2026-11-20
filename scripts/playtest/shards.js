// Round 8, the forest lane: the widest flat triangle in each fixed frame (frames-r7.json), by what drew it. It rides
// the safe line at a pinned speed to each frame's distance exactly as frames.js does, then reads the scene: every mesh
// within 40 m of the lens, each triangle of it (an instanced batch's instances within reach, a variant batch's own
// variant only) projected and clipped to the frame, its breadth (twice its area over its longest span: a sliver of
// trunk is not a shard) a share of the frame's width. A triangle counts when it is
// flat (its corners share a normal) and the material would draw it (the near fades a toon material dissolves by are
// evaluated at its middle, with a material's own `userData.gsKeep` where it carries one). Occlusion is ignored, so the
// figure is an upper bound. With `shoot`, each frame is also saved as frames.js names it.
//   playwright-cli -s=r8-forest eval "window.__shardsCfg = { base: 'http://127.0.0.1:4730/', tier: 'high', ms: [0], at: <frames-r7.json> }"
//   playwright-cli -s=r8-forest run-code --filename=scripts/playtest/shards.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4730/', tier: 'high', speed: 30, ms: [0], mood: 0, at: null, out: '', top: 4, lead: 30 }, (await page.evaluate(() => window.__shardsCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  for (const m of c.ms) {
    await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${m}&mood=${c.mood}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    await page.evaluate((speed) => {
      window.__pinSpeed = speed;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          q.x = cc.safeX(q.z);
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
          q.vz = v;
          q.vy = 0;
          q.speed = v;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
      // The measure: read at the frame the shot is of.
      window.__shards = (top) => {
        const W = window.__gs.world;
        const cam = W.cam.camera;
        cam.updateMatrixWorld();
        const V = cam.matrixWorldInverse.elements;
        const P = cam.projectionMatrix.elements;
        const cp = cam.position;
        const asp = cam.aspect || 16 / 9;
        const fwd = [-V[2], -V[6], -V[10]];
        const names = new Map();
        const props = W.props;
        if (props && props.batches) for (const [k, b] of props.batches) names.set(b.mesh, k);
        const label = (o) => {
          if (names.has(o)) return 'props:' + names.get(o);
          const path = [];
          for (let p = o; p && path.length < 4; p = p.parent) if (p.name) path.push(p.name);
          const g = o.geometry;
          const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
          return (path.join('<') || o.type) + (m0 && m0.defines && m0.defines.ICE ? '[ice]' : '') + '#' + (g && g.attributes.position ? g.attributes.position.count : 0);
        };
        const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
        let best = [];
        const worldPt = [0, 0, 0];
        const mul = (M, x, y, z, out) => {
          out[0] = M[0] * x + M[4] * y + M[8] * z + M[12];
          out[1] = M[1] * x + M[5] * y + M[9] * z + M[13];
          out[2] = M[2] * x + M[6] * y + M[10] * z + M[14];
          return out;
        };
        const clip = (p) => {
          const vx = V[0] * p[0] + V[4] * p[1] + V[8] * p[2] + V[12];
          const vy = V[1] * p[0] + V[5] * p[1] + V[9] * p[2] + V[13];
          const vz = V[2] * p[0] + V[6] * p[1] + V[10] * p[2] + V[14];
          return [P[0] * vx + P[4] * vy + P[8] * vz + P[12], P[1] * vx + P[5] * vy + P[9] * vz + P[13], P[2] * vx + P[6] * vy + P[10] * vz + P[14], P[3] * vx + P[7] * vy + P[11] * vz + P[15]];
        };
        // Width on screen (a fraction of the frame's width) of a triangle given in clip space, clipped to the near plane.
        const width = (a, b, d) => {
          let poly = [a, b, d];
          const out = [];
          for (let i = 0; i < poly.length; i++) {
            const p = poly[i];
            const q = poly[(i + 1) % poly.length];
            const dp = p[2] + p[3];
            const dq = q[2] + q[3];
            if (dp >= 0) out.push(p);
            if ((dp >= 0) !== (dq >= 0)) {
              const t = dp / (dp - dq);
              out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, p[3] + (q[3] - p[3]) * t]);
            }
          }
          if (out.length < 3) return 0;
          // On screen, in units of the frame's height (x by the aspect), clipped to the frame.
          let poly2 = out.map((p) => { const w = Math.max(p[3], 1e-5); return [(p[0] / w) * asp, p[1] / w]; });
          for (const [ax, lim, sg] of [[0, asp, 1], [0, -asp, -1], [1, 1, 1], [1, -1, -1]]) {
            const next = [];
            for (let i = 0; i < poly2.length; i++) {
              const p = poly2[i];
              const q = poly2[(i + 1) % poly2.length];
              const ip = sg * (lim - p[ax]) >= 0;
              const iq = sg * (lim - q[ax]) >= 0;
              if (ip) next.push(p);
              if (ip !== iq) {
                const t = (lim - p[ax]) / (q[ax] - p[ax]);
                next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
              }
            }
            poly2 = next;
            if (poly2.length < 3) return 0;
          }
          // Its breadth: twice its area over its longest span (a triangle's height off its longest edge), so a sliver
          // of trunk a frame tall is not a shard and a broad plane is, as a share of the frame's width.
          let area = 0;
          let span = 0;
          for (let i = 0; i < poly2.length; i++) {
            const p = poly2[i];
            const q = poly2[(i + 1) % poly2.length];
            area += p[0] * q[1] - q[0] * p[1];
            for (let j = i + 1; j < poly2.length; j++) span = Math.max(span, Math.hypot(poly2[j][0] - p[0], poly2[j][1] - p[1]));
          }
          area = Math.abs(area) / 2;
          return span > 0 ? (2 * area) / span / (2 * asp) : 0;
        };
        const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
        // The toon material's own near fades (materials.ts), at a triangle's middle.
        const keepOf = (mat, mid, ndcX, inst) => {
          if (mat.userData && typeof mat.userData.gsKeep === 'function') {
            const k = mat.userData.gsKeep(mid, inst, cp, fwd);
            if (k < 0.5) return k;
          }
          const u = mat.uniforms;
          if (!u || !u.uNearFade) return 1;
          const dx = cp.x - mid[0], dy = cp.y - mid[1], dz = cp.z - mid[2];
          const d = Math.hypot(dx, dy, dz);
          let keep = sm(u.uNearFade.value.x, u.uNearFade.value.y, d);
          const F = u.uFocus ? u.uFocus.value : null;
          if (F) {
            const sx = F.x - cp.x, sy = F.y - cp.y, sz = F.z - cp.z;
            const sl = Math.hypot(sx, sy, sz) || 1;
            const along = ((mid[0] - cp.x) * sx + (mid[1] - cp.y) * sy + (mid[2] - cp.z) * sz) / sl;
            if (along > 0 && along < sl - 0.8) {
              const px = cp.x + (sx / sl) * along - mid[0], py = cp.y + (sy / sl) * along - mid[1], pz = cp.z + (sz / sl) * along - mid[2];
              keep = Math.min(keep, sm(0.7, 2.2, Math.hypot(px, py, pz)));
            }
            if (mat.defines && mat.defines.HAZARD) {
              const rd = sx * fwd[0] + sy * fwd[1] + sz * fwd[2];
              const ahead = (mid[0] - cp.x) * fwd[0] + (mid[1] - cp.y) * fwd[1] + (mid[2] - cp.z) * fwd[2];
              const side = sm(0.6, 0.9, Math.abs(ndcX)) * sm(rd + 2.5, rd + 0.5, ahead);
              keep = Math.min(keep, 1 + (sm(3, 7, d) - 1) * side);
            }
          }
          return keep;
        };
        const R = 40;
        const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
        const consider = (o, mat, M, inst, pick) => {
          const g = o.geometry;
          const pos = g.attributes.position;
          const nrm = g.attributes.normal;
          const aVar = g.attributes.aVar;
          if (!pos || pos.itemSize !== 3) return;
          const idx = g.index;
          const dr = g.drawRange;
          const n = idx ? idx.count : pos.count;
          const start = Math.max(0, dr.start);
          const end = Math.min(n, dr.count === Infinity ? n : start + dr.count);
          const lab = label(o);
          // (What this lane answers for: the forest, the run's hazards, the bank's dressing, the near trees, and ice and rock
          // a set piece stands at the lens. Not the snow, the far ground, nor a building's wall, which is a plane by design.)
          const scope = lab.startsWith('props:') || lab.startsWith('near-forest') || !!(mat.defines && (mat.defines.ICE || mat.defines.HAZARD));
          for (let t = start; t + 2 < end; t += 3) {
            const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
            if (aVar && pick !== null && Math.abs(aVar.getX(i0) - pick) > 0.5) continue;
            mul(M, pos.getX(i0), pos.getY(i0), pos.getZ(i0), A);
            mul(M, pos.getX(i1), pos.getY(i1), pos.getZ(i1), B);
            mul(M, pos.getX(i2), pos.getY(i2), pos.getZ(i2), C);
            const near = Math.min(Math.hypot(A[0] - cp.x, A[1] - cp.y, A[2] - cp.z), Math.hypot(B[0] - cp.x, B[1] - cp.y, B[2] - cp.z), Math.hypot(C[0] - cp.x, C[1] - cp.y, C[2] - cp.z));
            if (near > R) continue;
            let flat = true;
            if (nrm) {
              const d01 = Math.abs(nrm.getX(i0) - nrm.getX(i1)) + Math.abs(nrm.getY(i0) - nrm.getY(i1)) + Math.abs(nrm.getZ(i0) - nrm.getZ(i1));
              const d02 = Math.abs(nrm.getX(i0) - nrm.getX(i2)) + Math.abs(nrm.getY(i0) - nrm.getY(i2)) + Math.abs(nrm.getZ(i0) - nrm.getZ(i2));
              flat = d01 + d02 < 0.05;
            }
            const ca = clip(A), cb = clip(B), cc = clip(C);
            const w = width(ca, cb, cc);
            if (w < 0.02) continue;
            const mid = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
            const cm = clip(mid);
            const keep = keepOf(mat, mid, cm[3] > 0 ? cm[0] / cm[3] : 0, inst);
            if (keep < 0.5) continue;
            best.push({ w, flat, lab, scope, d: Math.round(near * 10) / 10, at: [A, B, C].map((q) => q.map((v) => Math.round(v * 10) / 10)) });
          }
        };
        const M = new Array(16);
        const IM = new Array(16);
        const mulM = (a, b, out) => {
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
          return out;
        };
        W.scene.traverse((o) => {
          if (!o.isMesh || !visible(o) || !o.geometry || o.isSkinnedMesh) return;
          const mat = Array.isArray(o.material) ? o.material[0] : o.material;
          if (!mat || mat.visible === false || mat.depthWrite === false) return;
          const g = o.geometry;
          if (!g.attributes.position) return;
          if (!g.boundingSphere) g.computeBoundingSphere();
          const mw = o.matrixWorld.elements;
          if (o.isInstancedMesh) {
            const im = o.instanceMatrix.array;
            const picks = g.attributes.aPick;
            const r = g.boundingSphere ? g.boundingSphere.radius : 10;
            for (let k = 0; k < o.count; k++) {
              for (let e = 0; e < 16; e++) IM[e] = im[k * 16 + e];
              mulM(mw, IM, M);
              const sc = Math.hypot(M[0], M[1], M[2]) + Math.hypot(M[4], M[5], M[6]);
              const dx = M[12] - cp.x, dy = M[13] - cp.y, dz = M[14] - cp.z;
              if (Math.hypot(dx, dy, dz) > R + r * sc) continue;
              let pick = null;
              if (picks) { pick = picks.getX(k); if (pick >= 15.5) pick -= 16; }
              consider(o, mat, M.slice(), [M[12], M[13], M[14]], pick);
            }
          } else {
            const bs = g.boundingSphere;
            if (bs) {
              const ctr = mul(mw, bs.center.x, bs.center.y, bs.center.z, [0, 0, 0]);
              const sc = Math.hypot(mw[0], mw[1], mw[2]);
              if (Math.hypot(ctr[0] - cp.x, ctr[1] - cp.y, ctr[2] - cp.z) > R + bs.radius * sc) return;
            }
            consider(o, mat, mw, null, null);
          }
        });
        best.sort((a, b) => b.w - a.w);
        const flat = best.filter((b) => b.flat);
        const byLab = new Map();
        for (const b of flat) if (!byLab.has(b.lab)) byLab.set(b.lab, b);
        const sc = flat.filter((b) => b.scope);
        const scLab = new Map();
        for (const b of sc) if (!scLab.has(b.lab)) scLab.set(b.lab, b);
        const nearN = window.__gs.world.nearForest ? window.__gs.world.nearForest.drawn : -1;
        return { nearN, maxScope: sc.length ? Math.round(sc[0].w * 1000) / 1000 : 0, topScope: [...scLab.values()].slice(0, top).map((b) => `${b.lab} ${Math.round(b.w * 1000) / 10}% @${b.d}m`), worst: sc.length ? { lab: sc[0].lab, at: sc[0].at, eye: [cp.x, cp.y, cp.z].map((v) => Math.round(v * 10) / 10) } : null, maxFlat: flat.length ? Math.round(flat[0].w * 1000) / 1000 : 0, maxAny: best.length ? Math.round(best[0].w * 1000) / 1000 : 0, top: [...byLab.values()].slice(0, top).map((b) => `${b.lab} ${Math.round(b.w * 1000) / 10}% @${b.d}m`) };
      };
    }, c.speed);
    const list = c.at[m];
    let last = -1e9;
    for (const f of list) {
      const z = f.z;
      // (A shorter run-up than frames.js's 70 m: the lens has settled within a second of riding, and nothing measured
      // waits on the far shadows.)
      if (z - last > c.lead + 10) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - c.lead);
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - c.lead);
      }
      // Hold the page on the frame the run reaches z, as frames.js's `hold`, so the scene measured is the one shot.
      await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      const name = `m${m}-z${String(z).padStart(4, '0')}`;
      const r = await page.evaluate((top) => { const sp = window.__pinSpeed; window.__pinSpeed = 0.01; const out = window.__shards(top); window.__pinSpeed = sp; return out; }, c.top);
      if (c.out) await page.screenshot({ path: c.out + name + '.png' });
      report.push({ name, ...r });
      last = z;
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
