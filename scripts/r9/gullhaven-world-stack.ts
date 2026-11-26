// Round 9, Gullhaven's world: a sea stack's form, its colours and normals (probe, notes only).
import { Color } from 'three';
import { strata } from '../../src/render/rockforms';

const g = strata({ rx: 0.5, rz: 0.4, h: 5, layers: 13, sides: 8, rock: [new Color('#26283C'), new Color('#363850'), new Color('#4C4E68')], lie: null, taper: 0.28, shift: 0.12, dip: 0.07, warp: 0.25, bays: 0.25, rough: 0.3, seed: 0x5ea });
const c = g.getAttribute('color');
const n = g.getAttribute('normal');
const p = g.getAttribute('position');
let lo = 9, hi = 0, up = 0;
for (let i = 0; i < c.count; i++) {
  const l = c.getX(i) + c.getY(i) + c.getZ(i);
  lo = Math.min(lo, l);
  hi = Math.max(hi, l);
  if (n.getY(i) > 0.5) up++;
}
let ymin = 9, ymax = -9, xr = 0;
for (let i = 0; i < p.count; i++) { ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); xr = Math.max(xr, Math.abs(p.getX(i))); }
console.log({ verts: c.count, colourSum: [lo.toFixed(3), hi.toFixed(3)], upFacing: up, y: [ymin.toFixed(2), ymax.toFixed(2)], xr: xr.toFixed(2) });
