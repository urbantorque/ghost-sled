// Ghost Sled UI glyphs. One family: a 24 px grid, 2 px round strokes in currentColor, or solid
// fills for the few glyphs that must read at a glance (play, pause, ghost, footprint).

export type IconName =
  | 'play'
  | 'pause'
  | 'gift'
  | 'ghost'
  | 'gear'
  | 'speaker'
  | 'video'
  | 'trophy'
  | 'link'
  | 'snowflake'
  | 'lock'
  | 'back'
  | 'close'
  | 'check'
  | 'sled'
  | 'chevR'
  | 'chevL'
  | 'mouse'
  | 'mouseHold'
  | 'arrowL'
  | 'arrowR'
  | 'flag'
  | 'alert'
  | 'drag'
  | 'hold'
  | 'avalanche'
  | 'yeti'
  | 'giftstorm'
  | 'ghosttrain'
  | 'sledBold'
  | 'pine'
  | 'rock'
  | 'impact'
  | 'plus'
  | 'minus'
  | 'timer'
  | 'feather'
  | 'bolt'
  | 'slip'
  | 'ghostPlus'
  | 'rider'
  | 'tri';

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const FILL = 'fill="currentColor"';

const r2 = (n: number): string => (Math.round(n * 100) / 100).toString();

function gearPath(): string {
  const n = 8;
  const step = (Math.PI * 2) / n;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    const ring: Array<[number, number]> = [
      [6.9, a - step * 0.32],
      [9.4, a - step * 0.16],
      [9.4, a + step * 0.16],
      [6.9, a + step * 0.32],
    ];
    for (const [r, t] of ring) pts.push(`${r2(12 + Math.cos(t) * r)} ${r2(12 + Math.sin(t) * r)}`);
  }
  return `M${pts.join('L')}Z`;
}

function flakePath(): string {
  let d = '';
  for (let k = 0; k < 6; k++) {
    const t = -Math.PI / 2 + (k * Math.PI) / 3;
    const ux = Math.cos(t);
    const uy = Math.sin(t);
    const px = -uy;
    const py = ux;
    d += `M12 12L${r2(12 + ux * 9)} ${r2(12 + uy * 9)}`;
    const vx = 12 + ux * 6.6;
    const vy = 12 + uy * 6.6;
    const bx = 12 + ux * 4.3;
    const by = 12 + uy * 4.3;
    d += `M${r2(bx + px * 2.4)} ${r2(by + py * 2.4)}L${r2(vx)} ${r2(vy)}L${r2(bx - px * 2.4)} ${r2(by - py * 2.4)}`;
  }
  return d;
}

/** Ghost silhouette with eye holes (evenodd). Shared by the ghost glyphs. */
export const GHOST_PATH =
  'M5 10a7 7 0 0 1 14 0v9a2.33 2.33 0 0 1-4.67 0 2.33 2.33 0 0 1-4.66 0A2.33 2.33 0 0 1 5 19z' +
  'M8.2 10a1.3 1.7 0 1 0 2.6 0 1.3 1.7 0 1 0-2.6 0z' +
  'M13.2 10a1.3 1.7 0 1 0 2.6 0 1.3 1.7 0 1 0-2.6 0z';

const GIFT_INNER =
  '<path d="M4.25 11.5h15.5v7.25a1.75 1.75 0 0 1-1.75 1.75H6a1.75 1.75 0 0 1-1.75-1.75z"/>' +
  '<rect x="2.75" y="7.5" width="18.5" height="4" rx="1.25"/>' +
  '<path d="M12 7.5v13"/>' +
  '<path d="M12 7.5C10.6 4.2 6.9 3.7 6.9 5.9c0 1.3 2 1.6 5.1 1.6zM12 7.5c1.4-3.3 5.1-3.8 5.1-1.6 0 1.3-2 1.6-5.1 1.6z"/>';

const GLYPHS: Record<IconName, string> = {
  play: `<path ${FILL} d="M8 4.9v14.2a1.2 1.2 0 0 0 1.84 1.01l10.9-7.1a1.2 1.2 0 0 0 0-2.02L9.84 3.89A1.2 1.2 0 0 0 8 4.9z"/>`,
  pause: `<g ${FILL}><rect x="6" y="4.5" width="4.3" height="15" rx="1.4"/><rect x="13.7" y="4.5" width="4.3" height="15" rx="1.4"/></g>`,
  gift: `<g ${STROKE}>${GIFT_INNER}</g>`,
  ghost: `<path ${FILL} fill-rule="evenodd" d="${GHOST_PATH}"/>`,
  gear: `<g ${STROKE}><path d="${gearPath()}"/><circle cx="12" cy="12" r="2.8"/></g>`,
  speaker: `<g ${STROKE}><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.4 6.4a8 8 0 0 1 0 11.2"/></g>`,
  video: `<g ${STROKE}><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.4l6-3.4v10l-6-3.4z"/></g>`,
  trophy: `<g ${STROKE}><path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6.2H4.6v.9a3.4 3.4 0 0 0 3.2 3.4M16.5 6.2h2.9v.9a3.4 3.4 0 0 1-3.2 3.4"/><path d="M12 14v3.6M8.6 20.4h6.8"/></g>`,
  link: `<g ${STROKE}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></g>`,
  snowflake: `<path ${STROKE} d="${flakePath()}"/>`,
  lock: `<g ${STROKE}><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/><path d="M12 14.6v2"/></g>`,
  back: `<path ${STROKE} d="M19 12H5.5M11.5 5.5L5 12l6.5 6.5"/>`,
  close: `<path ${STROKE} d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
  check: `<path ${STROKE} d="M4.8 12.6l4.6 4.6L19.4 7.2"/>`,
  sled: `<g ${STROKE}><path d="M2.5 17.5h14.4c2.4 0 4.1-1.8 4.1-4 0-1.3-.9-2.2-2.1-2.2"/><path d="M5 12.5h11.5M7.6 12.5v5M13.6 12.5v5"/></g>`,
  chevR: `<path ${STROKE} d="M9.5 5.5L16 12l-6.5 6.5"/>`,
  chevL: `<path ${STROKE} d="M14.5 5.5L8 12l6.5 6.5"/>`,
  mouse: `<g ${STROKE}><rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 3v6.5M6.5 9.5h11"/></g>`,
  mouseHold: `<path ${FILL} d="M12 3a5.5 5.5 0 0 0-5.5 5.5v1H12z"/><g ${STROKE}><rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 3v6.5M6.5 9.5h11"/></g>`,
  arrowL: `<path ${STROKE} d="M19 12H5.5M11 6l-6 6 6 6"/>`,
  arrowR: `<path ${STROKE} d="M5 12h13.5M13 6l6 6-6 6"/>`,
  flag: `<g ${STROKE}><path d="M5.5 21V4"/><path d="M5.5 4.5h11.8l-2.6 4 2.6 4H5.5"/></g>`,
  alert: `<g ${STROKE}><path d="M12 4.2L2.9 19.6h18.2z"/><path d="M12 10v4.2M12 17.2h.01"/></g>`,
  drag: `<g ${STROKE}><circle cx="12" cy="12" r="3.4"/><path d="M2.8 12h4M17.2 12h4M5.4 9.4L2.8 12l2.6 2.6M18.6 9.4l2.6 2.6-2.6 2.6"/></g>`,
  hold: `<circle ${FILL} cx="12" cy="12" r="3.6"/><circle ${STROKE} cx="12" cy="12" r="8.2"/>`,
  avalanche: `<path ${STROKE} d="M2.5 20.2L9.6 8.4l4 6.4 2.3-3.3 5.6 8.7z"/><g ${FILL}><circle cx="16.4" cy="4.8" r="1.8"/><circle cx="20.2" cy="8.4" r="1.2"/></g>`,
  yeti: `<g ${FILL}><path d="M12 9.8c3 0 5 2.4 5 5.7s-2 5.6-5 5.6-5-2.3-5-5.6 2-5.7 5-5.7z"/><circle cx="7.2" cy="7.3" r="1.6"/><circle cx="10.3" cy="5" r="1.7"/><circle cx="13.7" cy="5" r="1.7"/><circle cx="16.8" cy="7.3" r="1.6"/></g>`,
  giftstorm: `<g fill="none" stroke="currentColor" stroke-width="2.86" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.6 5.4) scale(0.7)">${GIFT_INNER}</g><path ${STROKE} d="M7 2.4L5.7 5.6M12.3 1.8L11 5M17.6 2.4l-1.3 3.2"/>`,
  ghosttrain: `<path ${FILL} fill-rule="evenodd" transform="translate(5.6 2.3) scale(0.8)" d="${GHOST_PATH}"/><path ${STROKE} d="M2 9h3.2M1.5 13h3.8M2.5 17h2.6"/>`,
  // A solid deck over a curled runner: the outline sled turns into a squiggle at nav-button size.
  sledBold: `<path ${FILL} d="M4.4 8.2h11.2a1.7 1.7 0 0 1 0 3.4H4.4a1.7 1.7 0 0 1 0-3.4z"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M7.2 11.6v4.6M13.4 11.6v4.6M2.4 16.8h15.4c2.5 0 4.2-1.8 4.2-4 0-1.3-.9-2.2-2.1-2.2"/>`,
  pine: `<path ${FILL} d="M12 2.2l4.8 6.3h-2.3l4 5.4h-2.7l4 5.5H4.2l4-5.5H5.5l4-5.4H7.2z"/><rect ${FILL} x="10.7" y="19" width="2.6" height="3" rx=".7"/>`,
  rock: `<g ${STROKE}><path d="M2.8 19.6l2.7-7.4 4.6-4.8 5.4 1.3 3.7 4.9 2 6z"/><path d="M10.1 7.4l1.7 5.6-6.3-.8M11.8 13l3.7-4.3M11.8 13l1.3 6.6"/></g>`,
  impact: `<g ${STROKE}><path d="M12 3.2v3.6M12 17.2v3.6M3.2 12h3.6M17.2 12h3.6M5.8 5.8l2.5 2.5M15.7 15.7l2.5 2.5M18.2 5.8l-2.5 2.5M8.3 15.7l-2.5 2.5"/></g><circle ${FILL} cx="12" cy="12" r="2.2"/>`,
  plus: `<path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" d="M12 5.8v12.4M5.8 12h12.4"/>`,
  minus: `<path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" d="M5.8 12h12.4"/>`,
  // Mood modifiers (reveal card and HUD mood chip): combo window, low gravity, drift charge, drafting,
  // extra ghosts.
  timer: `<g ${STROKE}><circle cx="12" cy="13.6" r="7.4"/><path d="M9.6 2.8h4.8M12 2.8v3.4M12 13.6V9.8M12 13.6l2.6 1.8M18.4 5.6l1.6 1.6"/></g>`,
  feather: `<g ${STROKE}><path d="M20.2 3.8C12.6 4 7.6 8.8 7.2 16.6"/><path d="M20.2 3.8c.6 7.6-3.8 12.6-13 12.8"/><path d="M7.2 16.6L3.8 20.2M11.4 12.4l4-.4M9.6 9.8h3.6"/></g>`,
  bolt: `<path ${FILL} d="M13.9 2.2a.6.6 0 0 1 1 .5l-1.5 7.1h5a.6.6 0 0 1 .5 1L10.1 21.8a.6.6 0 0 1-1-.5l1.5-7.1h-5a.6.6 0 0 1-.5-1z"/>`,
  slip: `<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M4.6 5.6L11 12l-6.4 6.4M12.4 5.6L18.8 12l-6.4 6.4"/>`,
  ghostPlus: `<path ${FILL} fill-rule="evenodd" transform="translate(0.6 4) scale(0.82)" d="${GHOST_PATH}"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M19.4 2.6v6.8M16 6h6.8"/>`,
  // The player on a sled, facing right (the avalanche meter's "you").
  rider: `<g ${FILL}><circle cx="11.2" cy="6.4" r="3.1"/><circle cx="12.4" cy="2.6" r="1.3"/><path d="M7.4 10.6h7.2a1.6 1.6 0 0 1 1.6 1.6v3.4H5.8v-3.4a1.6 1.6 0 0 1 1.6-1.6z"/></g><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M2.6 19.2h15.6c2.2 0 3.6-1.5 3.6-3.4 0-1.1-.8-1.9-1.8-1.9"/>`,
  // A solid, rounded arrowhead: bold enough to read its direction at a glance.
  tri: `<path ${FILL} d="M12 4.4a1.7 1.7 0 0 1 1.5.9l6.8 11.6a1.7 1.7 0 0 1-1.5 2.6H5.2a1.7 1.7 0 0 1-1.5-2.6l6.8-11.6a1.7 1.7 0 0 1 1.5-.9z"/>`,
};

/** Raw SVG markup for a glyph (24 x 24 viewBox). */
export function iconSvg(name: IconName): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true">${GLYPHS[name]}</svg>`;
}

/** A decorative glyph wrapped in a sized span. Always aria-hidden: pair it with text or an aria-label. */
export function icon(name: IconName, cls = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls ? `gs-i ${cls}` : 'gs-i';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = iconSvg(name);
  return s;
}
