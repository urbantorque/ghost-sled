import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { inRock, visualGround } from '../src/render/ground';
import { Rider } from '../src/render/rider';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';

// A wall's rock is drawn past where the sim's ground stops, so a wreck bounced on the sim's ground went
// straight on under it, and the results looked at solid rock. It stops at the face, in the open.

const c = courseFor(MOUNTAINS[1].seed);

function ravineZ(): number {
  for (let z = 0; z < c.finishZ; z += 5) if (c.section(z).kind === 'ravine' && c.shapeAt(z).wall >= 12) return z + 30;
  throw new Error('no ravine');
}

describe('a wreck and a wall of rock', () => {
  const z = ravineZ();
  const sh = c.shapeAt(z);
  const edge = (side: number, e: number) => c.centerX(z) + side * (c.halfWidth(z) + e);

  it('knows what is rock: past the limit and under what is drawn, never on the snow inside it', () => {
    const x = edge(1, sh.limit + 5);
    const top = visualGround(c, x, z);
    expect(inRock(c, x, top - 1, z)).toBe(true);
    expect(inRock(c, x, top + 0.5, z)).toBe(false);
    const inside = edge(1, sh.limit - 1);
    expect(inRock(c, inside, c.ground(inside, z) - 1, z)).toBe(false);
  });

  // (A bounce scrubs its speed per contact frame, so a slow frame rate throws a wreck much further.)
  for (const fps of [60, 30, 24, 15]) {
    it(`stops a real crash at the rock at ${fps} fps: Frostfang, the sled lost on a landing at 17 m/s`, () => {
      // Where and how that crash went, from the sim. On the sim's ground the wreck ran on up to 25 m past
      // the edge at 24 fps and came to rest under what is drawn.
      const x = 11.82;
      const at = 1249.9;
      const rider = new Rider();
      rider.update({ pos: new Vector3(x, c.ground(x, at), -at), heading: 0.5, airYaw: 0, airPitch: 0, normal: new Vector3(0, 1, 0), lean: 0, crouch: 0, drifting: false, driftDir: 0, airborne: false, speed: 17, wobble: 0, vel: new Vector3(), perfectPulse: 0 }, 1 / 60, 0);
      rider.startCrash(new Vector3(8.12, -6.47, -15.07));
      let w = new Vector3();
      for (let i = 0; i < fps * 6; i++) {
        w = rider.updateCrash(1 / fps, c) ?? w;
        expect(visualGround(c, w.x, -w.z)).toBeLessThan(w.y + 0.05);
      }
      expect(c.edgeExcess(w.x, -w.z)).toBeLessThan(c.edgeLimit(-w.z) + 5);
    });
  }
});
