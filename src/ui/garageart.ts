import { type HatId, hatById, scarfById, trailById, type ScarfDef, type TrailDef } from '../game/garage';

// The garage's previews (round 6): small procedural drawings of each scarf, hat, trail, sled sound and
// paint, drawn from the same numbers the game builds them from, so a preview never promises a look the
// rider will not wear. Hats are drawn from behind, as the chase lens sees them. Decorative: every tile
// and the preview name the item in words.

const V = '#FF4D2E';
const V_DEEP = '#CC3E25';
const CREAM = '#F3E6D4';
const INK = '#1A2140';
const HAIR = '#8E5534';
const COAT = '#22307A';
const YOKE = '#2C4199';
const SNOW = '#DCE3F7';
const SNOW_SHADE = '#AEBBEA';

const svg = (vb: string, body: string, fit = 'xMidYMid meet') => `<svg viewBox="${vb}" preserveAspectRatio="${fit}" aria-hidden="true" focusable="false">${body}</svg>`;
const f = (n: number) => n.toFixed(1);

/** Mixes two #RRGGBB colours (k = 0 gives a). */
function mix(a: string, b: string, k: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k));
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** A scarf tail streaming from its knot: its length, width, knit pattern and tassels, as rider.ts paints it. */
export function scarfArt(id: string): string {
  const d: ScarfDef = scarfById(id);
  const N = 22;
  const len = 70 + 52 * Math.min(1, (d.length - 0.8) / 0.7);
  const x0 = 18;
  const w0 = 13 * d.width;
  const pts: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const s = Math.min(1, t / 0.18);
    const w = w0 * (0.5 + 0.5 * s * s * (3 - 2 * s)) * (1 - 0.62 * Math.pow(t, 1.4));
    pts.push({ x: x0 + t * len, y: 30 + 7 * Math.sin(t * Math.PI * 2.1 + 0.4) * t, w });
  }
  const rowColor = (t: number): string => {
    const R = 17;
    const r = Math.round(t * (R - 1));
    let k = r < 3 ? 0.86 : 1;
    let accent = false;
    switch (d.pattern) {
      case 'tipStripes':
        if (r === R - 6 || r === R - 3) k = 0.7;
        break;
      case 'bars':
        accent = r === R - 7 || r === R - 6 || r === R - 4 || r === R - 3;
        break;
      case 'tip':
        accent = r >= R - 3;
        break;
      case 'bands':
        accent = r >= 4 && r % 4 === 0;
        break;
      case 'rib':
        k = r % 2 === 0 ? 0.8 : 1;
        break;
      case 'plain':
        break;
    }
    if (accent) return d.accent === 'cream' ? CREAM : d.accent === 'ink' ? INK : V;
    return k >= 1 ? V : mix(V, '#000000', 1 - k);
  };
  let body = '';
  for (let i = 0; i < N; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    body += `<path d="M${f(a.x)} ${f(a.y - a.w / 2)}L${f(b.x + 0.4)} ${f(b.y - b.w / 2)}L${f(b.x + 0.4)} ${f(b.y + b.w / 2)}L${f(a.x)} ${f(a.y + a.w / 2)}Z" fill="${rowColor((i + 0.5) / N)}"/>`;
  }
  if (d.tassels) {
    const e = pts[N];
    const tc = d.accent === 'cream' ? CREAM : V_DEEP;
    for (let j = 0; j < 4; j++) {
      const y = e.y - e.w / 2 + ((j + 0.5) / 4) * e.w;
      body += `<path d="M${f(e.x)} ${f(y)}l${f(9 + (j % 2) * 2)} ${f(1.5 + j * 0.6 - 1.4)}" stroke="${tc}" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }
  body += `<ellipse cx="${x0}" cy="30" rx="${f(6 + 2 * d.width)}" ry="${f(5 + 2 * d.width)}" fill="${V_DEEP}"/>`;
  return svg('0 0 150 60', body);
}

/** The back of the rider's head and shoulders, wearing a hat (meshes.ts playerHat). */
export function hatArt(id: string): string {
  const hat: HatId = hatById(id).id;
  let back = '';
  let front = '';
  const dome = (top = 21) => `<path d="M29 52 C29 ${top} 71 ${top} 71 52 Z" fill="${V}"/>`;
  const cuff = (y = 46, h = 8) => `<rect x="27.5" y="${y}" width="45" height="${h}" rx="${h / 2}" fill="${V_DEEP}"/>` + ribLines(y, h);
  const stripe = (top = 21) => `<path d="M31 42 C32 ${top + 6} 68 ${top + 6} 69 42" stroke="${CREAM}" stroke-width="2.4" fill="none"/>`;
  const seam = (top = 21) => `<path d="M50 ${f(14.5 + 0.75 * top)} V46" stroke="${mix(V, '#000000', 0.3)}" stroke-width="1"/>`;
  const flaps = () => `<ellipse cx="29.5" cy="58" rx="4.6" ry="8.5" fill="${V_DEEP}"/><ellipse cx="70.5" cy="58" rx="4.6" ry="8.5" fill="${V_DEEP}"/>`;
  const pom = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${CREAM}"/>`;
  switch (hat) {
    case 'watch':
      front = dome(28) + stripe(28) + seam(28) + `<rect x="27" y="44" width="46" height="12" rx="6" fill="${V_DEEP}"/>` + ribLines(44, 12) + flaps();
      break;
    case 'twinpom':
      front = dome() + stripe() + seam() + cuff() + flaps() + pom(37, 26, 6.5) + pom(63, 26, 6.5);
      break;
    case 'trapper':
      back = `<ellipse cx="29" cy="63" rx="6.5" ry="13" fill="${V}"/><ellipse cx="71" cy="63" rx="6.5" ry="13" fill="${V}"/><circle cx="29" cy="74" r="5" fill="${CREAM}"/><circle cx="71" cy="74" r="5" fill="${CREAM}"/>`;
      front = `<path d="M30 50 C30 24 70 24 70 50 Z" fill="${V}"/>` + seam(24) + `<path d="M31 52 C33 66 67 66 69 52 Z" fill="${V}"/>` + furBand();
      break;
    case 'bobbles': {
      front = dome() + stripe() + seam() + cuff() + flaps();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.12 + (i / 5) * 0.76);
        front += pom(50 - Math.cos(a) * 17, 31 - Math.sin(a) * 7, 3.8);
      }
      front += pom(50, 22, 4.6);
      break;
    }
    case 'chullo':
      back = `<path d="M26 54 L33 54 L30 72 Z" fill="${V_DEEP}"/><path d="M67 54 L74 54 L70 72 Z" fill="${V_DEEP}"/>`;
      for (const x of [30, 70]) for (let k = 0; k < 5; k++) back += `<circle cx="${x}" cy="${74 + k * 3.4}" r="1.7" fill="${k % 2 ? CREAM : V}"/>`;
      front = `<path d="M28.5 54 C28.5 38 41 26 50 15 C59 26 71.5 38 71.5 54 Z" fill="${V}"/><path d="M30 44 C38 41 62 41 70 44" stroke="${CREAM}" stroke-width="3" fill="none"/>` + pom(50, 14, 3.4);
      break;
    case 'longcap':
      front = dome() + stripe() + seam() + cuff() + flaps() + `<path d="M46 26 C50 12 70 12 80 22 C86 32 88 44 86 56 L81 56 C82 46 79 36 72 31 C64 26 56 28 54 34 Z" fill="${V}"/>` + pom(84, 59, 5.5);
      break;
    case 'beanie':
    default:
      front = dome() + stripe() + seam() + cuff() + flaps() + pom(50, 20, 7);
      break;
  }
  const shoulders = `<path d="M10 100 C14 80 32 74 50 74 C68 74 86 80 90 100 Z" fill="${COAT}"/><path d="M22 84 C30 78 70 78 78 84" stroke="${YOKE}" stroke-width="7" fill="none"/>`;
  const scarf = `<ellipse cx="50" cy="74" rx="19" ry="6.5" fill="${V}"/><circle cx="50" cy="77" r="4.5" fill="${V_DEEP}"/>`;
  const head = `<circle cx="50" cy="55" r="20" fill="${HAIR}"/><path d="M31 62 C36 72 64 72 69 62" stroke="${mix(HAIR, '#000000', 0.18)}" stroke-width="3" fill="none"/>`;
  return svg('0 0 100 100', shoulders + back + scarf + head + front);
}

/** The trapper's cream fur brim: a band round the head, its edge in soft tufts. */
function furBand(): string {
  let s = `<path d="M25 46 C25 39 75 39 75 46 L75 52 C75 58 25 58 25 52 Z" fill="${CREAM}"/>`;
  for (let i = 0; i < 9; i++) {
    const x = 27 + i * 5.75;
    const y = 54 + Math.sin((i / 8) * Math.PI) * 2.6;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="${CREAM}"/>`;
  }
  return s;
}

function ribLines(y: number, h: number): string {
  let s = '';
  for (let x = 31; x < 70; x += 4) s += `<path d="M${x} ${y + 1.5} V${y + h - 1.5}" stroke="${mix(V_DEEP, '#000000', 0.18)}" stroke-width="1"/>`;
  return s;
}

/** What the sled leaves: the snow's groove, the spray (tinted as the trail tints it) and the motes. */
export function trailArt(id: string): string {
  const d: TrailDef = trailById(id);
  const spray = d.tint ? mix('#FFFFFF', d.tint, d.tintK) : '#FFFFFF';
  let body = `<path d="M0 39 C40 31 110 30 150 34 V60 H0 Z" fill="${SNOW}"/><path d="M0 46 C50 41 104 40 150 42" stroke="${SNOW_SHADE}" stroke-width="3" fill="none"/><path d="M0 51 C50 46 104 45 150 47" stroke="${SNOW_SHADE}" stroke-width="2" fill="none"/>`;
  // The sled, small, at the head of its groove.
  body += `<path d="M114 38 h24 c3 0 4 -3 3 -5" stroke="${V}" stroke-width="2.2" fill="none" stroke-linecap="round"/><rect x="115" y="31" width="20" height="5" rx="2" fill="#B07840"/>`;
  // The plume off the runner.
  const puffs: [number, number, number][] = [[108, 30, 5.5], [99, 25, 6.5], [89, 22, 6], [80, 21, 5], [72, 22, 4]];
  for (const [x, y, r] of puffs) body += `<circle cx="${x}" cy="${y}" r="${r}" fill="${spray}" opacity="0.92"/>`;
  if (d.mote) {
    const m = d.mote;
    const dots: [number, number, number][] =
      d.moteStyle === 'flick'
        ? [[104, 20, 1.8], [96, 14, 1.6], [86, 12, 1.9], [77, 14, 1.5], [92, 9, 1.3], [70, 17, 1.4]]
        : d.moteStyle === 'twinkle'
          ? [[100, 40, 1.6], [88, 43, 1.9], [74, 41, 1.4], [62, 44, 1.8], [50, 42, 1.3], [38, 45, 1.6], [26, 43, 1.2]]
          : [[110, 34, 2.1], [98, 34.5, 1.9], [86, 35, 1.8], [74, 35.6, 1.6], [62, 36.2, 1.4], [50, 36.8, 1.2], [38, 37.4, 1]];
    for (const [x, y, r] of dots) body += `<circle cx="${x}" cy="${y}" r="${f(r * 3.2)}" fill="${m}" opacity="0.3"/><circle cx="${x}" cy="${y}" r="${f(r * 1.45)}" fill="${m}"/>`;
  }
  return svg('0 0 150 60', body, 'xMidYMax slice');
}

/** A sled sound as a drawn wave: steel hiss, bells, creaking timber, a glass tone, the lantern's hum. */
export function soundArt(id: string): string {
  const pts: string[] = [];
  let extra = '';
  let color = '#F5F3FF';
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = 8 + t * 134;
    let y = 30;
    switch (id) {
      case 'bells':
        y += Math.sin(t * Math.PI * 14) * 9 * Math.exp(-((t * 4) % 1) * 3);
        break;
      case 'timber':
        y += (Math.sin(t * Math.PI * 7) > 0 ? 1 : -1) * 6 * (0.6 + 0.4 * Math.sin(t * 9.3));
        break;
      case 'glass':
        y += Math.sin(t * Math.PI * 18) * 7;
        break;
      case 'lantern':
        y += Math.sin(t * Math.PI * 9) * (3 + 11 * t);
        color = '#FFD34D';
        break;
      default: {
        // Steel on packed snow: a fine, uneven hiss.
        const n = Math.sin(i * 12.9898) * 43758.5453;
        y += (n - Math.floor(n) - 0.5) * 10;
      }
    }
    pts.push(`${f(x)},${f(y)}`);
  }
  if (id === 'bells') for (const x of [32, 70, 108]) extra += `<path d="M${x - 5} 50 q5 -11 10 0 z" fill="#FFD34D"/><circle cx="${x}" cy="51" r="1.4" fill="#FFD34D"/>`;
  return svg('0 0 150 60', `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${extra}`);
}

/** A sled deck in its paint over the wood's grain, on its vermillion runner. */
export function paintArt(hex: string): string {
  const deck = hex || '#C98A50';
  let grain = '';
  for (let i = 0; i < 5; i++) grain += `<path d="M${22 + i * 3} ${24 + i * 3.2} C60 ${22 + i * 3.2} 92 ${26 + i * 3.2} ${126 - i * 2} ${24 + i * 3.2}" stroke="${mix(deck, '#000000', 0.22)}" stroke-width="0.9" fill="none" opacity="0.7"/>`;
  return svg(
    '0 0 150 60',
    `<path d="M14 46 H118 C130 46 136 40 134 32" stroke="${V}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M14 49 H120" stroke="#B9C3D8" stroke-width="1.6"/><rect x="18" y="20" width="108" height="20" rx="6" fill="${deck}"/>${grain}<rect x="30" y="38" width="4" height="8" fill="${V}"/><rect x="104" y="38" width="4" height="8" fill="${V}"/>`,
  );
}
