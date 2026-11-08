import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, OctahedronGeometry, ShaderMaterial, SphereGeometry, TorusGeometry, Vector3, Vector4 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BiomeId } from '../sim/mountains';
import { makeToonMaterial } from './materials';
import { merge, part, softPart } from './flora';
import type { Palette } from './palette';

// Spectators: little toy-proportioned figures (the rider's proportions, ART.md section 5: the head
// about a third of the height) lining the banks at the course's set pieces. One instanced mesh draws
// every crowd in view, in one draw.
//
// Each mountain dresses its own people (`figureGeometry(biome)`): Pinecrest's villagers in loden coats
// under knit bobble caps, felt hats with a feather and trapper caps, ringing cowbells; Frostfang's
// outpost crew in quilted parkas with fur-ruffed hoods, goggles or fur hats, waving ice axes; Ember
// Peak's ash folk in long dusters and capes under pointed hoods, miners' helmets with a headlamp or a
// face wrap, raising picks; Sakura Ridge's festival-goers in wrap robes with a sash and wide sleeves,
// under straw hats, a bun or a headband, twirling paper parasols. Every figure picks one of three
// headwear variants and one of six habits from its seed, so a row never repeats.
//
// All motion is in the vertex shader off the shared clock. Habits: wavers, clappers, cheerers who pump
// both arms, snowball throwers (a ball arcs out toward the run while the rider is near), prop holders,
// and calm ones who stand arms folded and cup their hands to shout as the rider comes. Heads turn
// further and sooner than bodies and look round idly when nothing is near; bodies lean toward the run
// as the rider approaches and turn to follow it past; a moment made near them (a pass, a stomp, a
// bank) throws arms up in a V and a hop that ripples out; kids (a fifth of them) bounce more. Far
// figures drop their fine parts (eyes, feathers, goggles, collars) and keep the silhouette and the
// motion, and idle bursts keep a far stand stirring.
//
// Never vermillion (the player's colour), marigold, mint, rose or gold-white (ART.md section 1):
// coats in each culture's cool and muted earth range, accents in creams, sky blues, lilacs and pale
// blossom pinks.

/** Figure height, metres (a touch taller than the seated rider, so a crowd on the bank reads). */
export const FIGURE_H = 1.62;
/** Shoulder pivot of the arms, model metres. */
const SHOULDER_X = 0.27;
const SHOULDER_Y = 1.0;
/** Where the mitt hangs at rest (the hand a prop or a lamp is held in). */
const HAND_X = SHOULDER_X + 0.05;
const HAND_Y = SHOULDER_Y - 0.45;

/** Vertex slots: what the per-instance colours paint, and what shows for whom. */
const S_FIXED = 0;
const S_COAT = 1;
const S_HAT = 2;
const S_LAMP = 3;
const S_FLAG = 4;
const S_PROP = 5;
const S_BALL = 6;
/** The coat's colour lifted toward cream (cuffs, fur, a feather, a collar). */
const S_TRIM = 7;
/** The coat's colour taken down (felt, quilting, a cape, a sash's shadow). */
const S_DARK = 8;
/** A headlamp: dim by day, lit at night. */
const S_GLOW = 9;
/** A flag's stick (shown with the flag, its own colour). */
const S_STICK = 10;

/** Vertex groups: how a part moves. */
const G_BODY = 0;
const G_HEAD = 1;
/** Held in the right mitt and turned with the arm (a parasol, an axe, a pick). */
const G_GRIP = 2;
const G_BALL = 3;
/** Hangs from the right mitt and swings (a lantern, a cowbell). */
const G_HANG = 4;

interface Tag {
  arm?: number;
  grp?: number;
  /** Headwear variant 0..2 (shown for figures that drew it); absent: always. */
  v?: number;
  /** A fine part, dropped on far figures. */
  fine?: boolean;
}

/** Tags every vertex of a part: aPart = (slot, arm -1/0/1, group, variant + 10 if fine). */
function tag(g: BufferGeometry, slot: number, o: Tag = {}): BufferGeometry {
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 4);
  const w = (o.v ?? -1) + (o.fine ? 10 : 0);
  for (let i = 0; i < n; i++) {
    a[i * 4] = slot;
    a[i * 4 + 1] = o.arm ?? 0;
    a[i * 4 + 2] = o.grp ?? G_BODY;
    a[i * 4 + 3] = w;
  }
  g.setAttribute('aPart', new BufferAttribute(a, 4));
  return g;
}

/** A sphere shell open at the front (+z) by `open` radians either side: a hood round a face. */
function hood(r: number, open: number, theta = Math.PI * 0.82): SphereGeometry {
  return new SphereGeometry(r, 9, 5, Math.PI / 2 + open, Math.PI * 2 - 2 * open, 0, theta);
}

/** A dome over the crown (a cap, a helmet, hair). */
function dome(r: number, k = 0.52, seg = 8): SphereGeometry {
  return new SphereGeometry(r, seg, 2, 0, Math.PI * 2, 0, Math.PI * k);
}

/** How each mountain cuts its coat: radius at the shoulders and the hem, length and centre height;
 *  the sleeve's radius at the shoulder and the cuff. */
const CUT: Record<BiomeId, { coat: [number, number, number, number]; sleeve: [number, number] }> = {
  alpine: { coat: [0.2, 0.27, 0.62, 0.68], sleeve: [0.06, 0.075] },
  glacier: { coat: [0.23, 0.3, 0.66, 0.67], sleeve: [0.075, 0.09] },
  volcanic: { coat: [0.2, 0.33, 0.86, 0.56], sleeve: [0.06, 0.08] },
  blossom: { coat: [0.2, 0.28, 0.82, 0.58], sleeve: [0.06, 0.13] },
};

/** What a prop holder does with it, per mountain: the right arm's rest (side raise, forward raise,
 *  inward turn) and how it moves (0 a cowbell rung, 1 a tool pumped overhead, 2 a parasol twirled). */
const PROP_REST: Record<BiomeId, [number, number, number, number]> = {
  alpine: [0.35, 0.3, 0.1, 0],
  glacier: [0.12, 0.25, 0, 1],
  volcanic: [0.15, 0.3, 0, 1],
  blossom: [3.15, -0.3, 0, 2],
};

/** The prop holders' style, shared by the one crowd material (set by restyleCrowd). */
export const crowdProp = { value: new Vector4(...PROP_REST.alpine) };

/** One spectator of a mountain, standing on the origin and facing +z. White parts take the instance's
 *  colours. A street holds hundreds at once, so every part is as plain as it can be and still read;
 *  the three headwear variants and the prop collapse in the vertex shader for figures that did not
 *  draw them, and the merged figure is indexed so a smooth part shades each corner once. */
export function figureGeometry(biome: BiomeId = 'alpine'): BufferGeometry {
  const white = '#FFFFFF';
  const skin = new Color('#F2C9A8');
  const boot = new Color('#3A3550');
  const mitt = new Color('#5A5470');
  const ink = new Color('#1E2238');
  const fur = new Color('#E9E2D6');
  const cut = CUT[biome];
  const [rt, rb, ch, cy] = cut.coat;
  const top = cy + ch / 2;
  const P: BufferGeometry[] = [];
  const add = (g: BufferGeometry, slot: number, o?: Tag) => P.push(tag(g, slot, o));
  // The contact shadow: a soft dark-blue blob on the snow (ART.md section 2).
  add(softPart(new CylinderGeometry(0.34, 0.34, 0.02, 7, 1, true), new Color('#5A6496'), { pos: [0, 0.01, 0], scale: [1, 1, 0.8] }), S_FIXED);
  // Boots and legs.
  for (const s of [-1, 1]) add(part(new CylinderGeometry(0.07, 0.085, 0.42, 5, 1, true), boot, { pos: [s * 0.1, 0.2, 0] }), S_FIXED);
  // The coat: a lathed bell, wider at the hem, and the shoulders.
  add(softPart(new CylinderGeometry(rt, rb, ch, 8, 1, true), white, { pos: [0, cy, 0] }), S_COAT);
  add(softPart(new SphereGeometry(rt + 0.005, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2), white, { pos: [0, top, 0], scale: [1, 0.5, 1] }), S_COAT);
  // The head: a big round toy head, a third of the height, and two dark eyes.
  add(softPart(new SphereGeometry(0.235, 8, 5), skin, { pos: [0, 1.32, 0] }), S_FIXED, { grp: G_HEAD });
  for (const s of [-1, 1]) add(softPart(new OctahedronGeometry(0.038, 0), ink, { pos: [s * 0.085, 1.33, 0.212] }), S_FIXED, { grp: G_HEAD, fine: true });
  // The arms hang from the shoulders (the vertex shader swings them), each ending in a mitt.
  for (const s of [-1, 1]) {
    add(part(new CylinderGeometry(cut.sleeve[0], cut.sleeve[1], 0.42, 5, 1, true), white, { pos: [s * SHOULDER_X, SHOULDER_Y - 0.22, 0], rot: [0, 0, s * 0.12] }), S_COAT, { arm: s });
    add(softPart(new OctahedronGeometry(0.085, 0), mitt, { pos: [s * HAND_X, HAND_Y, 0] }), S_FIXED, { arm: s });
  }
  // A lantern hung from the right mitt, shown only for the lamp holders on a night mood.
  add(part(new CylinderGeometry(0.008, 0.008, 0.14, 3), ink, { pos: [HAND_X, HAND_Y - 0.09, 0.02] }), S_LAMP, { arm: 1, grp: G_HANG });
  add(part(new OctahedronGeometry(0.075, 0), new Color('#FFB45E').multiplyScalar(2.6), { pos: [HAND_X, HAND_Y - 0.21, 0.02] }), S_LAMP, { arm: 1, grp: G_HANG });
  // A little flag on a stick in the left mitt, for the flag wavers: the stick runs on down the arm's
  // line, so with the arm thrown up it stands over the head.
  add(part(new CylinderGeometry(0.012, 0.012, 0.62, 3), ink, { pos: [-HAND_X - 0.01, SHOULDER_Y - 0.72, 0.03] }), S_STICK, { arm: -1 });
  add(part(new BoxGeometry(0.3, 0.2, 0.012), white, { pos: [-SHOULDER_X - 0.22, SHOULDER_Y - 0.92, 0.03] }), S_FLAG, { arm: -1 });
  // A snowball, flown by the shader from the right hand toward the run.
  add(part(new OctahedronGeometry(0.11, 1), new Color('#F6F8FF'), {}), S_BALL, { grp: G_BALL });

  if (biome === 'alpine') {
    // A knit scarf: a thick ring at the neck and a tail down the front; a belt that nips the coat in.
    add(softPart(new CylinderGeometry(0.15, 0.17, 0.11, 8, 1, true), white, { pos: [0, 1.06, 0] }), S_HAT);
    add(part(new BoxGeometry(0.1, 0.3, 0.05), white, { pos: [0.09, 0.88, 0.15], rot: [0.15, 0, 0.1], scale: [1, 1, 0.55] }), S_HAT, { fine: true });
    add(part(new CylinderGeometry(0.24, 0.245, 0.05, 8, 1, true), white, { pos: [0, 0.74, 0] }), S_DARK, { fine: true });
    // 0: a bobble beanie, its cuff and pom-pom in a lighter knit.
    add(softPart(dome(0.248), white, { pos: [0, 1.36, -0.01] }), S_HAT, { grp: G_HEAD, v: 0 });
    add(softPart(new CylinderGeometry(0.252, 0.252, 0.08, 8, 1, true), white, { pos: [0, 1.37, -0.01] }), S_TRIM, { grp: G_HEAD, v: 0 });
    add(part(new OctahedronGeometry(0.1, 0), white, { pos: [0, 1.65, -0.02] }), S_TRIM, { grp: G_HEAD, v: 0 });
    // 1: a felt hat: a wide brim, a pinched crown, a band in the accent and a feather.
    add(part(new CylinderGeometry(0.34, 0.34, 0.03, 10), white, { pos: [0, 1.47, 0] }), S_DARK, { grp: G_HEAD, v: 1 });
    add(part(new CylinderGeometry(0.15, 0.2, 0.21, 7), white, { pos: [0, 1.58, -0.01], scale: [1, 1, 0.86] }), S_DARK, { grp: G_HEAD, v: 1 });
    add(part(new CylinderGeometry(0.205, 0.205, 0.05, 7, 1, true), white, { pos: [0, 1.5, -0.01] }), S_HAT, { grp: G_HEAD, v: 1 });
    add(part(new BoxGeometry(0.03, 0.24, 0.06), white, { pos: [0.19, 1.63, -0.08], rot: [0, 0, -0.55] }), S_TRIM, { grp: G_HEAD, v: 1, fine: true });
    // 2: a trapper cap with ear flaps and a turned-up front.
    add(softPart(dome(0.252), white, { pos: [0, 1.36, -0.01] }), S_HAT, { grp: G_HEAD, v: 2 });
    for (const s of [-1, 1]) add(part(new BoxGeometry(0.06, 0.22, 0.17), white, { pos: [s * 0.236, 1.27, -0.01] }), S_TRIM, { grp: G_HEAD, v: 2 });
    add(part(new BoxGeometry(0.32, 0.08, 0.06), white, { pos: [0, 1.53, 0.2], rot: [-0.35, 0, 0] }), S_TRIM, { grp: G_HEAD, v: 2 });
    // The prop: a cowbell on a strap, rung overhead.
    add(part(new BoxGeometry(0.03, 0.14, 0.02), new Color('#3A2E2E'), { pos: [HAND_X, HAND_Y - 0.08, 0] }), S_PROP, { arm: 1, grp: G_HANG });
    add(part(new CylinderGeometry(0.06, 0.12, 0.18, 6), new Color('#8C7B5A'), { pos: [HAND_X, HAND_Y - 0.22, 0] }), S_PROP, { arm: 1, grp: G_HANG });
  } else if (biome === 'glacier') {
    // A quilted expedition parka: two dark bands round it and a fur hem.
    for (const y of [0.56, 0.8]) {
      const r = rb + ((rt - rb) * (y - (cy - ch / 2))) / ch + 0.012;
      add(part(new CylinderGeometry(r, r, 0.035, 8, 1, true), white, { pos: [0, y, 0] }), S_DARK, { fine: true });
    }
    add(softPart(new CylinderGeometry(0.305, 0.31, 0.07, 8, 1, true), fur, { pos: [0, cy - ch / 2 + 0.03, 0] }), S_FIXED);
    // 0: the parka's hood, open round the face, with a fur ruff framing it.
    add(softPart(hood(0.29, 0.85), white, { pos: [0, 1.34, -0.03] }), S_COAT, { grp: G_HEAD, v: 0 });
    add(softPart(new TorusGeometry(0.2, 0.075, 4, 9), fur, { pos: [0, 1.31, 0.15] }), S_FIXED, { grp: G_HEAD, v: 0 });
    // 1: a knit cap with goggles pushed up on it.
    add(softPart(dome(0.25), white, { pos: [0, 1.36, -0.01] }), S_HAT, { grp: G_HEAD, v: 1 });
    add(part(new CylinderGeometry(0.255, 0.255, 0.05, 8, 1, true), ink, { pos: [0, 1.44, 0] }), S_FIXED, { grp: G_HEAD, v: 1 });
    for (const s of [-1, 1]) add(part(new BoxGeometry(0.11, 0.075, 0.05), new Color('#A8DDF2'), { pos: [s * 0.075, 1.46, 0.235] }), S_FIXED, { grp: G_HEAD, v: 1, fine: true });
    // 2: a tall fur hat with a knit crown.
    add(softPart(new CylinderGeometry(0.26, 0.275, 0.2, 8, 1, true), new Color('#BDB6AE'), { pos: [0, 1.48, -0.01] }), S_FIXED, { grp: G_HEAD, v: 2 });
    add(softPart(dome(0.262, 0.5), white, { pos: [0, 1.57, -0.01], scale: [1, 0.45, 1] }), S_HAT, { grp: G_HEAD, v: 2 });
    // The prop: an ice axe, planted like a cane at rest and pumped overhead.
    add(part(new CylinderGeometry(0.018, 0.018, 0.64, 4), new Color('#3A3A4E'), { pos: [HAND_X, HAND_Y - 0.26, 0] }), S_PROP, { arm: 1, grp: G_GRIP });
    add(part(new BoxGeometry(0.04, 0.035, 0.34), new Color('#6A7890'), { pos: [HAND_X, HAND_Y - 0.57, 0.02] }), S_PROP, { arm: 1, grp: G_GRIP });
  } else if (biome === 'volcanic') {
    // A long ash duster under a short cape, a rope belt.
    add(softPart(new ConeGeometry(0.35, 0.34, 8, 1, true), white, { pos: [0, top - 0.06, 0] }), S_DARK);
    add(part(new CylinderGeometry(0.255, 0.26, 0.04, 8, 1, true), white, { pos: [0, 0.74, 0] }), S_TRIM, { fine: true });
    // 0: a pointed ash hood, open round the face, its point falling back.
    add(softPart(hood(0.28, 0.8), white, { pos: [0, 1.34, -0.02] }), S_DARK, { grp: G_HEAD, v: 0 });
    add(part(new ConeGeometry(0.16, 0.36, 6), white, { pos: [0, 1.63, -0.11], rot: [-0.55, 0, 0] }), S_DARK, { grp: G_HEAD, v: 0 });
    // 1: a miner's helmet with a headlamp.
    add(softPart(dome(0.262, 0.5), white, { pos: [0, 1.37, 0] }), S_HAT, { grp: G_HEAD, v: 1 });
    add(part(new CylinderGeometry(0.31, 0.31, 0.025, 10), white, { pos: [0, 1.38, 0.01] }), S_HAT, { grp: G_HEAD, v: 1 });
    add(part(new BoxGeometry(0.1, 0.075, 0.06), new Color('#FFE6B8'), { pos: [0, 1.5, 0.25] }), S_GLOW, { grp: G_HEAD, v: 1 });
    // 2: a face wrap against the ash, under a wrapped cap.
    add(softPart(new CylinderGeometry(0.245, 0.24, 0.13, 8, 1, true), white, { pos: [0, 1.235, 0] }), S_HAT, { grp: G_HEAD, v: 2 });
    add(softPart(dome(0.252), white, { pos: [0, 1.36, -0.01] }), S_DARK, { grp: G_HEAD, v: 2 });
    // The prop: a long-handled pick, carried on the shoulder and raised.
    add(part(new CylinderGeometry(0.02, 0.02, 0.74, 4), new Color('#4A3A34'), { pos: [HAND_X, HAND_Y - 0.3, 0] }), S_PROP, { arm: 1, grp: G_GRIP });
    add(part(new BoxGeometry(0.05, 0.05, 0.38), new Color('#3A3A44'), { pos: [HAND_X, HAND_Y - 0.66, 0.04], rot: [0.15, 0, 0] }), S_PROP, { arm: 1, grp: G_GRIP });
  } else {
    // A wrap robe with a sash in the accent and a crossed collar.
    add(softPart(new CylinderGeometry(0.228, 0.235, 0.1, 8, 1, true), white, { pos: [0, 0.8, 0] }), S_HAT);
    for (const s of [-1, 1]) add(part(new BoxGeometry(0.06, 0.26, 0.02), white, { pos: [s * 0.06, 0.93, 0.205], rot: [0.1, 0, s * 0.38] }), S_TRIM, { fine: true });
    // 0: a wide conical straw hat.
    add(part(new ConeGeometry(0.44, 0.2, 10), new Color('#D6C08E'), { pos: [0, 1.6, 0] }), S_FIXED, { grp: G_HEAD, v: 0 });
    add(part(new CylinderGeometry(0.22, 0.22, 0.04, 8, 1, true), white, { pos: [0, 1.52, 0] }), S_HAT, { grp: G_HEAD, v: 0, fine: true });
    // 1: hair up in a bun, a pin through it.
    const hair = new Color('#2B2333');
    add(softPart(dome(0.246, 0.56), hair, { pos: [0, 1.335, -0.015] }), S_FIXED, { grp: G_HEAD, v: 1 });
    add(softPart(new SphereGeometry(0.1, 6, 4), hair, { pos: [0, 1.6, -0.09] }), S_FIXED, { grp: G_HEAD, v: 1 });
    add(part(new BoxGeometry(0.22, 0.022, 0.022), white, { pos: [0.03, 1.62, -0.09], rot: [0, 0, 0.3] }), S_HAT, { grp: G_HEAD, v: 1, fine: true });
    // 2: a headband in the accent over the hair, its ends tied at the back.
    add(softPart(dome(0.246, 0.56), hair, { pos: [0, 1.335, -0.015] }), S_FIXED, { grp: G_HEAD, v: 2 });
    add(part(new CylinderGeometry(0.252, 0.252, 0.055, 8, 1, true), white, { pos: [0, 1.43, -0.01] }), S_HAT, { grp: G_HEAD, v: 2 });
    add(part(new BoxGeometry(0.06, 0.2, 0.02), white, { pos: [0.05, 1.32, -0.25], rot: [0, 0, 0.35] }), S_HAT, { grp: G_HEAD, v: 2, fine: true });
    // The prop: a paper parasol, held up and twirled.
    add(part(new CylinderGeometry(0.012, 0.012, 0.86, 4), new Color('#5A3A40'), { pos: [HAND_X, HAND_Y - 0.3, 0] }), S_PROP, { arm: 1, grp: G_GRIP });
    add(part(new ConeGeometry(0.56, 0.18, 10), white, { pos: [HAND_X, HAND_Y - 0.66, 0], rot: [Math.PI, 0, 0] }), S_HAT, { arm: 1, grp: G_GRIP, v: 9 });
  }
  // (Keep the custom attributes through the merge: every part carries them. Indexed, so a smooth part
  // shades each of its corners once.)
  const merged = merge(P);
  merged.deleteAttribute('uv');
  return mergeVertices(merged, 1e-4);
}

/** Dresses the one crowd geometry for a mountain: swaps its per-vertex attributes for that biome's
 *  figure (the instanced ones stay) and sets the prop holders' style. */
export function restyleCrowd(geo: BufferGeometry, biome: BiomeId): void {
  crowdProp.value.set(...PROP_REST[biome]);
  if (geo.userData.biome === biome) return;
  const g = figureGeometry(biome);
  geo.dispose();
  for (const name of ['position', 'normal', 'color', 'aPart']) geo.setAttribute(name, g.getAttribute(name));
  geo.setIndex(g.getIndex());
  geo.userData.biome = biome;
}

/** A crowd's colour range per culture: coats (cool, muted earth) and accents (headwear, scarves,
 *  sashes, parasols). Never a signal colour. */
const DRESS: Record<BiomeId, { coats: string[]; hats: string[] }> = {
  // Loden greens, charcoal, wine-plum and oatmeal; cream, sky and heather knits.
  alpine: { coats: ['#4E6B4C', '#3A4058', '#2F5A52', '#2E3A66', '#6A4058', '#CFC2A8', '#4A6390', '#6B5646', '#7A8C6A'], hats: ['#F0E8D8', '#9CC0EE', '#3F5A44', '#B9A6E0', '#FFFFFF', '#5B8FD6', '#8A6E5A', '#D7E3F4'] },
  // Expedition parkas: steel blue, deep teal, glacier white, slate, a muted ochre, indigo.
  glacier: { coats: ['#4C6FA8', '#2D6670', '#DDE6EF', '#55607A', '#9C8452', '#34406E', '#6A86B8', '#3E4A62'], hats: ['#E8E0D2', '#BDEBFF', '#9CB4D8', '#F4F6FA', '#5B8FD6', '#7A8AA6'] },
  // Ash folk: ash grey, charcoal, basalt plum, slate teal, umber and dusty lilac.
  volcanic: { coats: ['#5E5A62', '#3A3640', '#4A3E5A', '#3A5058', '#5A4A44', '#7A6A86', '#48424E', '#6A5E58'], hats: ['#B9AAB4', '#D8D0C8', '#2E2A34', '#8E8296', '#6A7A84', '#A89A8E'] },
  // Festival robes: indigo, plum, sage, cream, blossom pink, deep teal, wine lacquer.
  blossom: { coats: ['#34406E', '#6A4C86', '#7E9A88', '#EDE4D8', '#D9B6C4', '#2F6E78', '#5A2F42', '#8A7DB8'], hats: ['#F4CFDC', '#F2EBDD', '#EBC2D4', '#B9A6E0', '#9CC0EE', '#FFFFFF', '#5B6E9A'] },
};

/** A crowd's colour range for a biome: coats and accents. */
export function crowdColors(biome: BiomeId, p: Palette): { coats: Color[]; hats: Color[] } {
  const d = DRESS[biome];
  // A trace of the mood's light in the coats, so a night crowd is not a row of day colours.
  const k = p.lantern || p.moon ? 0.72 : 1;
  return { coats: d.coats.map((h) => new Color(h).multiplyScalar(k)), hats: d.hats.map((h) => new Color(h).multiplyScalar(k)) };
}

// ---------------------------------------------------------------- the still crowd

/** A spectator baked into a piece: where it stands (piece space, facing the run along +-x) and its
 *  colours. */
export interface StillFigure {
  x: number;
  y: number;
  z: number;
  coat: Color;
  hat: Color;
  /** Which way it faces the run: +1 toward +x, -1 toward -x; 0 or absent, both (either bank). */
  face?: number;
}

/** Most triangles one still figure can take (a hood, both arms, a flag). */
const STILL_TRIS = 56;

function hash3(x: number, z: number, salt: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Hundreds of still spectators in one geometry: the far rows of a stand on every tier, and on Low,
 *  which draws no animated crowd, every crowd there is. They cost no draw and no shader, so they are
 *  posed instead: about two thirds have an arm or both thrown up, a flag or the mountain's prop, and
 *  each wears its culture's headwear in a silhouette that reads from the far rows (a felt hat's brim, a
 *  fur ruff round the face, a pointed ash hood, a wide straw hat). Boxes and slabs, wound to face the
 *  run on the figure's own bank (`face`; both banks if it has none), up the slope and the sky: about
 *  20 triangles a figure. `bold` scales them up (Low: fewer, bigger, livelier figures). */
export function stillCrowd(list: ReadonlyArray<StillFigure>, biome: BiomeId, bold = 1): BufferGeometry {
  const cap = list.length * STILL_TRIS * 3;
  const pos = new Float32Array(cap * 3);
  const nor = new Float32Array(cap * 3);
  const col = new Float32Array(cap * 3);
  let o = 0;
  const ax = new Vector3();
  const bx = new Vector3();
  const nn = new Vector3();
  const vert = (p: number[], k: Color) => {
    pos[o] = p[0];
    pos[o + 1] = p[1];
    pos[o + 2] = p[2];
    nor[o] = nn.x;
    nor[o + 1] = nn.y;
    nor[o + 2] = nn.z;
    col[o] = k.r;
    col[o + 1] = k.g;
    col[o + 2] = k.b;
    o += 3;
  };
  /** A triangle facing `out` (a direction it is wound toward), its corners coloured ka, kb, kc. */
  const tri = (a: number[], b: number[], c: number[], out: number[], ka: Color, kb = ka, kc = ka) => {
    if (o + 9 > pos.length) return;
    ax.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    bx.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    nn.crossVectors(ax, bx).normalize();
    if (nn.x * out[0] + nn.y * out[1] + nn.z * out[2] < 0) {
      nn.negate();
      vert(a, ka);
      vert(c, kc);
      vert(b, kb);
    } else {
      vert(a, ka);
      vert(b, kb);
      vert(c, kc);
    }
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], out: number[], ka: Color, kc = ka) => {
    tri(a, b, c, out, ka, ka, kc);
    tri(a, c, d, out, ka, kc, kc);
  };
  // Which way each figure faces the run: +1 toward +x, -1 toward -x, 0 both.
  let face = 0;
  const sides = () => (face === 0 ? [-1, 1] : [face]);
  /** A box's faces a stand ever shows: toward the run, up the slope and (with `lid`) the top; with
   *  `top` the sides' upper corners and the top take it (a cap on a head). */
  const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, side: Color, top: Color = side, lid = true) => {
    const P = (sx: number, sy: number, sz: number) => [x + sx * hx, y + sy * hy, z + sz * hz];
    for (const sx of sides()) quad(P(sx, -1, -1), P(sx, -1, 1), P(sx, 1, 1), P(sx, 1, -1), [sx, 0, 0], side, top);
    quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), [0, 0, 1], side, top);
    if (lid) quad(P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1), [0, 1, 0], top);
  };
  /** A flat bar from a to b in the y-z plane, `w` wide, toward the run (an arm, a stick). */
  const slab = (a: number[], b: number[], w: number, k: Color) => {
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const l = Math.hypot(dy, dz) || 1;
    const py = (-dz / l) * w * 0.5;
    const pz = (dy / l) * w * 0.5;
    for (const sx of sides()) quad([a[0], a[1] + py, a[2] + pz], [a[0], a[1] - py, a[2] - pz], [b[0], b[1] - py, b[2] - pz], [b[0], b[1] + py, b[2] + pz], [sx, 0, 0], k);
  };
  /** A four-sided cone over (x, y, z): a pointed hood, a straw hat, a parasol. */
  const pyr = (x: number, y: number, z: number, h: number, hw: number, k: Color) => {
    const apex = [x, y + h, z];
    const q = [
      [x - hw, y, z - hw],
      [x + hw, y, z - hw],
      [x + hw, y, z + hw],
      [x - hw, y, z + hw],
    ];
    for (let i = 0; i < 4; i++) {
      const a = q[i];
      const b = q[(i + 1) % 4];
      const out = [(a[0] + b[0]) / 2 - x, 0.3 * hw, (a[2] + b[2]) / 2 - z];
      // (The side away from the run on its bank, and the one down the slope, never show.)
      if ((face !== 0 && out[0] * face < -1e-6) || out[2] < -1e-6) continue;
      tri(a, b, apex, out, k);
    }
  };
  const skin = new Color('#F2C9A8');
  const fur = new Color('#E9E2D6');
  const furGrey = new Color('#BDB6AE');
  const straw = new Color('#D6C08E');
  const hair = new Color('#2B2333');
  const ink = new Color('#2A2E44');
  const bell = new Color('#8C7B5A');
  const dark = new Color();
  for (const f of list) {
    face = f.face ?? 0;
    const h = (salt: number) => hash3(f.x, f.z, salt);
    const s = bold * (h(1) < 0.15 ? 0.76 : 0.94 + h(2) * 0.12);
    const { x, y, z } = f;
    dark.copy(f.coat).multiplyScalar(0.55);
    const v = Math.floor(h(4) * 3);
    // The body (its top is under the head), and the head with its crown in the headwear's colour.
    box(x, y + 0.42 * s, z, 0.17 * s, 0.42 * s, 0.23 * s * (0.9 + 0.2 * h(3)), f.coat, f.coat, false);
    let crown = f.hat;
    if (biome === 'alpine' && v === 1) crown = dark;
    else if (biome === 'volcanic' && v !== 1) crown = dark;
    else if (biome === 'blossom' && v !== 0) crown = hair;
    const hy = y + 1.02 * s;
    const top = y + 1.19 * s;
    if (biome === 'glacier' && v === 0) {
      // A fur ruff round the face: the face shows through it toward the run.
      box(x, hy + 0.02 * s, z, 0.13 * s, 0.22 * s, 0.24 * s, fur);
      box(x, hy, z, 0.17 * s, 0.13 * s, 0.13 * s, skin);
    } else box(x, hy, z, 0.17 * s, 0.17 * s, 0.17 * s, skin, crown);
    if (biome === 'alpine') {
      // (0, a bobble beanie, is the crown alone: its pom-pom is lost from the far rows.)
      if (v === 1) {
        box(x, top + 0.01 * s, z, 0.27 * s, 0.022 * s, 0.27 * s, dark);
        box(x, top + 0.1 * s, z, 0.13 * s, 0.08 * s, 0.13 * s, dark);
      } else if (v === 2) box(x, hy - 0.04 * s, z, 0.19 * s, 0.1 * s, 0.2 * s, f.hat);
    } else if (biome === 'glacier') {
      if (v === 1) box(x, hy + 0.09 * s, z, 0.178 * s, 0.03 * s, 0.178 * s, ink);
      else if (v === 2) box(x, top + 0.1 * s, z, 0.19 * s, 0.11 * s, 0.19 * s, furGrey, f.hat);
    } else if (biome === 'volcanic') {
      if (v === 0) pyr(x, top - 0.08 * s, z, 0.46 * s, 0.22 * s, dark);
      else if (v === 1) box(x, top - 0.01 * s, z, 0.25 * s, 0.02 * s, 0.25 * s, f.hat);
      else box(x, hy - 0.08 * s, z, 0.18 * s, 0.06 * s, 0.18 * s, f.hat);
    } else {
      if (v === 0) pyr(x, top - 0.03 * s, z, 0.17 * s, 0.36 * s, straw);
      else if (v === 1) box(x, top + 0.06 * s, z, 0.075 * s, 0.075 * s, 0.075 * s, hair);
      else box(x, hy + 0.12 * s, z, 0.178 * s, 0.03 * s, 0.178 * s, f.hat);
    }
    // A pose of its own: both arms up, one waving, a flag, the mountain's prop, or arms down.
    const pp = h(5);
    const lively = bold > 1 ? 0.1 : 0;
    const sy = y + 0.78 * s;
    const fx = x + face * 0.12 * s;
    const arm = (side: number, reach = 0.46) => {
      const hand = [fx, y + 1.42 * s, z + side * reach * s];
      slab([fx, sy, z + side * 0.2 * s], hand, 0.1 * s, f.coat);
      return hand;
    };
    const side = h(6) < 0.5 ? -1 : 1;
    if (pp < 0.34 + lively) {
      arm(-1);
      arm(1);
    } else if (pp < 0.52 + lively * 1.5) arm(side);
    else if (pp < 0.64 + lively * 2) {
      const hand = arm(side, 0.34);
      const tip = [hand[0], hand[1] + 0.55 * s, hand[2] + side * 0.05 * s];
      slab(hand, tip, 0.035 * s, ink);
      for (const sx of sides()) quad(tip, [tip[0], tip[1] - 0.2 * s, tip[2]], [tip[0], tip[1] - 0.2 * s, tip[2] + side * 0.3 * s], [tip[0], tip[1], tip[2] + side * 0.3 * s], [sx, 0, 0], f.hat);
    } else if (pp < 0.72 + lively * 2) {
      const hand = arm(side, 0.3);
      const tip = [hand[0], hand[1] + 0.5 * s, hand[2] - side * 0.1 * s];
      slab(hand, tip, 0.035 * s, ink);
      if (biome === 'blossom') pyr(tip[0], tip[1] - 0.08 * s, tip[2], 0.14 * s, 0.42 * s, f.hat);
      else box(tip[0], tip[1], tip[2], 0.04 * s, 0.035 * s, 0.17 * s, biome === 'alpine' ? bell : ink);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos.slice(0, o), 3));
  g.setAttribute('normal', new BufferAttribute(nor.slice(0, o), 3));
  g.setAttribute('color', new BufferAttribute(col.slice(0, o), 3));
  return g;
}

/** How much bigger Low's baked crowd stands, and the share of a site's spots it keeps: fewer, bolder
 *  figures, posed, where Medium and High draw the animated crowd. */
export const LOW_BOLD = 1.16;
const LOW_KEEP = 0.5;

/** Low's crowd in a street: the spots the animated crowd would fill behind the barrier, thinned and
 *  baked as still figures in the culture's dress, each facing the way its spot does. (Low draws no
 *  bank piece, so a leap's shoulders have no crowd to bake.) Nothing on Medium and High. */
export function lowCrowd(spots: ReadonlyArray<{ x: number; y: number; z: number; yaw: number }>, biome: BiomeId, p: Palette): BufferGeometry[] {
  const { coats, hats } = crowdColors(biome, p);
  const list: StillFigure[] = [];
  for (const sp of spots) {
    if (hash3(sp.x, sp.z, 11) > LOW_KEEP) continue;
    list.push({ x: sp.x, y: sp.y, z: sp.z, face: Math.sign(Math.sin(sp.yaw)), coat: coats[Math.floor(hash3(sp.x, sp.z, 12) * coats.length)], hat: hats[Math.floor(hash3(sp.x, sp.z, 13) * hats.length)] });
  }
  return list.length ? [stillCrowd(list, biome, LOW_BOLD)] : [];
}

/** The crowds' roar, 0 to 1: a sustained lift over the moment's cheer, every figure near the rider up
 *  on its toes with its arms in the air (moments.ts: a max drift, a passed ghost, the finish). */
export const crowdRoar = { value: 0 };

/** The crowd's cheer and the rider, shared by every figure (world coordinates). */
export interface CrowdUniforms {
  /** x, z where the moment was made, the time it was, and its strength (0..1). */
  uCheer: { value: Vector4 };
  /** The rider (world). */
  uRider: { value: Vector3 };
  /** Lamps lit (night moods): 1 shows the lamp holders' lanterns. */
  uLamps: { value: number };
  /** 0 to 1 while the rider rides a village's street: the crowd does a wave that runs down the run
   *  alongside the rider. */
  uWave: { value: number };
}

const ATTRS = /* glsl */ `
  attribute vec4 aPart;
  attribute vec3 aCoat;
  attribute vec3 aHat;
  attribute vec4 aSeed;
  uniform vec4 uCheer;
  uniform vec3 uRider;
  uniform float uLamps;
  uniform float uWave;
  uniform float uRoar;
  uniform vec4 uProp;
  // An arm's point q (from its shoulder) raised forward by fp, out to the side by sr and turned in
  // across the body by yw.
  vec3 crowdArm(vec3 q, float arm, float sr, float fp, float yw) {
    float c = cos(fp);
    float s = -sin(fp);
    q.yz = vec2(q.y * c - q.z * s, q.y * s + q.z * c);
    float a = sr * arm;
    c = cos(a);
    s = sin(a);
    q.xy = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
    a = yw * arm;
    c = cos(a);
    s = sin(a);
    q.xz = vec2(q.x * c - q.z * s, q.x * s + q.z * c);
    return q;
  }
`;

const SX = SHOULDER_X.toFixed(3);
const SY = SHOULDER_Y.toFixed(3);
const HX = HAND_X.toFixed(3);
const HY = HAND_Y.toFixed(3);

// aSeed: x phase (0..1), y temperament (0..1), z lamp holder (1), w flag waver (1). Everything else a
// figure is (its headwear, its habit, a kid or not, its build) is hashed from x and y.
const ANIMATE = /* glsl */ `#include <begin_vertex>
  {
    vec3 ip = instanceMatrix[3].xyz;
    float isc = length(instanceMatrix[0].xyz);
    float ph = aSeed.x * 6.2831;
    float hA = fract(aSeed.x * 7.31 + aSeed.y * 3.17);
    float hB = fract(aSeed.x * 13.7 + aSeed.y * 5.31);
    float hC = fract(aSeed.x * 3.91 + aSeed.y * 11.13);
    float slot = aPart.x;
    float arm = aPart.y;
    float grp = aPart.z;
    float fine = step(9.5, aPart.w);
    float vari = aPart.w - 10.0 * fine;
    bool flagger = aSeed.w > 0.5;
    bool lamper = aSeed.z > 0.5 && uLamps > 0.5;
    // A fifth are kids (the short ones the site placed, and more): they cheer, wave and clap.
    bool kid = isc < 0.85 || hC < 0.1;
    // The habit: 0 waves, 1 claps, 2 cheers, 3 throws snow, 4 holds the mountain's prop, 5 calm.
    float pose = floor(hA * 6.0);
    if (kid) pose = mod(pose, 3.0);
    if (lamper && abs(pose - 4.0) < 0.5) pose = 0.0;
    float hat = floor(hB * 3.0);
    float camD = distance(ip, cameraPosition);
    // The thrower's cycle (2.2 s) and how much it is at it: while the rider is close, and on a cheer.
    vec2 toR = uRider.xz - ip.xz;
    float dR = length(toR);
    float nearK = 1.0 - smoothstep(20.0, 70.0, dR);
    float closeK = 1.0 - smoothstep(8.0, 30.0, dR);
    float headK = 1.0 - smoothstep(35.0, 120.0, dR);
    float dC = distance(ip.xz, uCheer.xy);
    float tc = uTime - uCheer.z - dC / 40.0;
    float cheer = uCheer.w * smoothstep(0.0, 0.1, tc) * (1.0 - smoothstep(1.3, 2.8, tc)) * (1.0 - smoothstep(60.0, 120.0, dC));
    float tcyc = fract(uTime * 0.45 + aSeed.x);
    float act = clamp(max(closeK * 1.3, cheer), 0.0, 1.0);
    bool hide = (vari > -0.5 && vari < 8.5 && abs(vari - hat) > 0.5)
      || (slot > 2.5 && slot < 3.5 && !lamper)
      || (((slot > 3.5 && slot < 4.5) || slot > 9.5) && !flagger)
      || ((slot > 4.5 && slot < 5.5 || vari > 8.5) && abs(pose - 4.0) > 0.5)
      || (slot > 5.5 && slot < 6.5 && (abs(pose - 3.0) > 0.5 || act < 0.3 || tcyc < 0.4 || tcyc > 0.78))
      || (fine > 0.5 && camD > 46.0 * isc);
    if (hide) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }
    // The street's wave: a band of raised arms running down the run at about a rider's speed (52 m
    // apart), over the stretch round the rider.
    float wv = sin(-ip.z * 0.12 - uTime * 3.2);
    float waveK = uWave * pow(max(wv, 0.0), 6.0) * (1.0 - smoothstep(60.0, 140.0, dR));
    // The roar: everyone within about 120 m, each going up at its own moment.
    float roarK = uRoar * (1.0 - smoothstep(110.0, 220.0, dR)) * (0.75 + 0.25 * sin(uTime * 2.6 + ph * 2.0));
    // A stand with nothing near still stirs: now and then someone throws their arms up.
    float idle = smoothstep(0.8, 0.97, sin(uTime * 0.31 + ph * 5.0 + hC * 9.0)) * (1.0 - nearK);
    float ex = clamp(max(max(cheer, closeK * 0.7), max(waveK, roarK)), 0.0, 1.0);
    if (kid) ex = min(1.0, ex * 1.3);
    float wave = sin(uTime * (4.0 + aSeed.y * 3.0) + ph);
    if (grp > 2.5 && grp < 3.5) {
      // The snowball: out of the raised hand, over the shoulder and away toward the run.
      float u = (tcyc - 0.4) / 0.38;
      float T = u * 0.85;
      vec3 bp = vec3(0.25 - 0.2 * T, 1.75 + 3.2 * T - 4.9 * T * T, -0.05 + 7.0 * T);
      transformed = bp + transformed * smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.88, 1.0, u)) * 1.3;
    } else {
      if (arm != 0.0) {
        // Arms: a side raise (sr), a forward raise (fp) and a turn in across the body (yw).
        float sr = 0.18 + 0.06 * sin(uTime * 1.3 + ph);
        float fp = 0.0;
        float yw = 0.0;
        float up = 2.55 + 0.3 * sin(uTime * 9.0 + ph + arm);
        float vK = ex;
        if (pose < 0.5) {
          if (arm > 0.0) sr = 2.35 + 0.42 * wave;
        } else if (pose < 1.5) {
          // Claps out in front, faster and harder when it counts.
          float k = max(max(ex, idle), 0.25 + 0.25 * sin(uTime * 0.7 + ph));
          fp = 1.3 * k;
          yw = (0.4 + 0.14 * sin(uTime * (11.0 + 4.0 * ex) + ph)) * k;
          sr = mix(sr, 0.05, k);
          vK = cheer > 0.5 ? cheer * 0.6 : 0.0;
        } else if (pose < 2.5) {
          vK = max(ex, idle);
        } else if (pose < 3.5) {
          // A throw: wind up over the shoulder, whip through, follow down; the other arm out for balance.
          float wind = smoothstep(0.0, 0.32, tcyc) * (1.0 - smoothstep(0.36, 0.46, tcyc));
          float follow = smoothstep(0.36, 0.46, tcyc) * (1.0 - smoothstep(0.62, 0.95, tcyc));
          if (arm > 0.0) {
            sr = mix(sr, mix(mix(0.2, 2.75, wind), 1.0, follow), act);
            fp = mix(0.0, mix(mix(0.0, -0.6, wind), 1.3, follow), act);
          } else {
            fp = 0.6 * act;
            sr = mix(sr, 0.5, act);
          }
          vK = act > 0.3 ? 0.0 : max(ex, idle) * 0.7;
        } else if (pose < 4.5) {
          if (arm > 0.0) {
            sr = uProp.x;
            fp = uProp.y;
            yw = uProp.z;
            // Rung, pumped or held high when it counts.
            float k = max(ex, idle);
            if (uProp.w < 0.5) { sr = mix(sr, 2.6 + 0.25 * sin(uTime * 16.0 + ph), k); fp = mix(fp, 0.0, k); yw = mix(yw, 0.0, k); }
            else if (uProp.w < 1.5) { sr = mix(sr, 2.5 + 0.35 * sin(uTime * 6.0 + ph), k); fp = mix(fp, 0.25, k); yw = mix(yw, 0.0, k); }
            else sr += 0.12 * k * sin(uTime * 5.0 + ph);
            vK = 0.0;
          } else vK = max(ex, idle) * 0.8;
        } else {
          // Arms folded; hands cupped at the mouth to shout as the rider comes.
          float k = max(ex, idle * 0.6);
          fp = mix(0.85, 2.15, k);
          yw = mix(0.82, 0.5, k);
          sr = mix(0.02, 0.1, k);
          vK = cheer > 0.6 ? cheer * 0.8 : 0.0;
        }
        if (flagger && arm < 0.0) {
          sr = 2.45 + 0.45 * sin(uTime * 5.5 + ph);
          fp = 0.0;
          yw = 0.0;
        }
        if (lamper && arm > 0.0) {
          sr = 0.5 + 0.08 * wave;
          fp = 0.0;
          yw = 0.0;
          vK = 0.0;
        }
        sr = mix(sr, up, vK);
        fp = mix(fp, 0.0, vK);
        yw = mix(yw, 0.0, vK);
        vec3 sh = vec3(arm * ${SX}, ${SY}, 0.0);
        if (grp > 3.5) {
          // A lantern or a bell hangs from the hand wherever the arm goes, and swings.
          vec3 hand = crowdArm(vec3(arm * ${HX}, ${HY}, 0.0) - sh, arm, sr, fp, yw) + sh;
          vec3 off = transformed - vec3(arm * ${HX}, ${HY}, 0.0);
          float sw = 0.25 * sin(uTime * (uProp.w < 0.5 && pose > 3.5 ? 15.0 : 2.4) + ph) * (0.4 + ex);
          off.xy = vec2(off.x * cos(sw) - off.y * sin(sw), off.x * sin(sw) + off.y * cos(sw));
          transformed = hand + off;
        } else {
          if (grp > 1.5 && uProp.w > 1.5) {
            // A parasol turns on its stick.
            float tw = uTime * 1.6 + ph;
            vec2 r = transformed.xz - vec2(arm * ${HX}, 0.0);
            r = vec2(r.x * cos(tw) - r.y * sin(tw), r.x * sin(tw) + r.y * cos(tw));
            transformed.xz = r + vec2(arm * ${HX}, 0.0);
          }
          transformed = crowdArm(transformed - sh, arm, sr, fp, yw) + sh;
          objectNormal = crowdArm(objectNormal, arm, sr, fp, yw);
        }
      }
      // The head turns further and sooner than the body, toward the rider; with nothing near it
      // looks round at its neighbours.
      vec3 lr0 = transpose(mat3(instanceMatrix)) * vec3(toR.x, 0.0, toR.y);
      float want = atan(lr0.x, max(lr0.z, -0.2));
      float yaw = clamp(want, -1.2, 1.2) * nearK;
      if (grp > 0.5 && grp < 1.5) {
        float hy = clamp(want - yaw, -0.8, 0.8) * headK + 0.5 * sin(uTime * 0.23 + ph * 2.0) * (1.0 - headK);
        float nod = 0.12 * headK;
        vec3 q = transformed - vec3(0.0, 1.1, 0.0);
        q.yz = vec2(q.y * cos(nod) - q.z * sin(nod), q.y * sin(nod) + q.z * cos(nod));
        q.xz = vec2(q.x * cos(hy) + q.z * sin(hy), -q.x * sin(hy) + q.z * cos(hy));
        transformed = q + vec3(0.0, 1.1, 0.0);
        objectNormal.xz = vec2(objectNormal.x * cos(hy) + objectNormal.z * sin(hy), -objectNormal.x * sin(hy) + objectNormal.z * cos(hy));
      }
      // Leaning out toward the run as the rider comes down to them, upright again once it is by.
      float coming = smoothstep(-8.0, 6.0, uRider.z - ip.z);
      float lean = (0.16 * nearK * coming + 0.1 * ex) * (pose > 4.5 ? 1.5 : 1.0);
      float lw = smoothstep(0.3, 0.62, transformed.y) * lean;
      vec3 q = transformed - vec3(0.0, 0.42, 0.0);
      q.yz = vec2(q.y * cos(lw) - q.z * sin(lw), q.y * sin(lw) + q.z * cos(lw));
      transformed = q + vec3(0.0, 0.42, 0.0);
      // A build of its own (stockier or slighter), and a kid's size.
      if (grp < 0.5) transformed.xz *= vec2(0.9 + 0.22 * fract(hC * 7.7), 0.95 + 0.1 * fract(hC * 7.7));
    }
    if (kid && isc >= 0.85) transformed *= 0.74;
    // Turned toward the rider as it comes by (at most about 70 degrees off their own facing).
    vec3 lr = transpose(mat3(instanceMatrix)) * vec3(toR.x, 0.0, toR.y);
    float byaw = clamp(atan(lr.x, max(lr.z, -0.2)), -1.2, 1.2) * nearK;
    // A sway from side to side, livelier when excited, and a bob on the knees.
    float sway = sin(uTime * 1.7 + ph) * (0.05 + 0.06 * ex);
    float cy = cos(byaw);
    float sy = sin(byaw);
    if (transformed.y > 0.05) {
      transformed.xz = vec2(transformed.x * cy + transformed.z * sy, -transformed.x * sy + transformed.z * cy);
      objectNormal.xz = vec2(objectNormal.x * cy + objectNormal.z * sy, -objectNormal.x * sy + objectNormal.z * cy);
      if (grp < 2.5 || grp > 3.5) {
        transformed.x += sway * transformed.y;
        float hop = max(cheer, roarK) * abs(sin(uTime * 7.5 + ph)) * (kid ? 0.55 : 0.42) + nearK * (kid ? 0.16 : 0.08) * abs(sin(uTime * 6.0 + ph)) + waveK * 0.3 + idle * 0.12 * abs(sin(uTime * 6.5 + ph));
        transformed.y += 0.03 * sin(uTime * 2.2 + ph) + hop;
      }
    }
  }`;

const COLOUR = /* glsl */ `vColor = color;
  if (aPart.x > 0.5 && aPart.x < 1.5) vColor = aCoat;
  else if (aPart.x > 1.5 && aPart.x < 2.5) vColor = aHat;
  else if (aPart.x > 3.5 && aPart.x < 4.5) vColor = aHat;
  else if (aPart.x > 6.5 && aPart.x < 7.5) vColor = mix(aCoat, vec3(0.94, 0.91, 0.86), 0.62);
  else if (aPart.x > 7.5 && aPart.x < 8.5) vColor = aCoat * 0.55 + vec3(0.02, 0.02, 0.035);
  else if (aPart.x > 8.5 && aPart.x < 9.5) vColor = color * mix(0.75, 2.6, uLamps);`;

/** The crowd's material: the shared toon model, patched to colour and animate each figure. */
export function crowdMaterial(u: CrowdUniforms): ShaderMaterial {
  const m = makeToonMaterial({ coolShade: 0.4, rim: 0.42, nearFade: [1.8, 3.6] });
  if (!m.vertexShader.includes('#include <begin_vertex>') || !m.vertexShader.includes('vColor = color;')) throw new Error('crowdMaterial: shader hooks missing');
  m.vertexShader = ATTRS + m.vertexShader.replace('vColor = color;', COLOUR).replace('#include <begin_vertex>', ANIMATE);
  Object.assign(m.uniforms, u, { uRoar: crowdRoar, uProp: crowdProp });
  return m;
}
