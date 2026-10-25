import type { MountainCard } from './contract';

// Tiny flat illustrations for cards: biome ridgelines over the biome sky gradient (the gradient
// itself is CSS), and sled side views. Vermillion appears only on the rider's scarf and beanie and
// on sled runners: the sled is you.

const SIGNAL = '#FF4D2E';

const RIDGES: Record<MountainCard['biome'], string> = {
  alpine:
    '<circle cx="114" cy="60" r="13" fill="#FFE6C9" opacity=".85"/>' +
    '<path d="M0 80V56l22-14 16 9 24-22 22 18 18-10 26 20 32-8v31z" fill="#F5F3FF" opacity=".26"/>' +
    '<path d="M0 80V67l30-20 18 10 30-27 26 23 18-8 38 22v13z" fill="#121933" opacity=".7"/>' +
    '<path d="M70.5 37.2L78 30l7.5 7.2-3.6 1.8-3.9-2.2-3.9 2.2z" fill="#F5F3FF" opacity=".9"/>' +
    '<path d="M20 80l6-13 6 13zM34 80l5-10 5 10zM118 80l6-12 6 12z" fill="#121933" opacity=".85"/>',
  glacier:
    '<circle cx="40" cy="62" r="12" fill="#FFEBDD" opacity=".85"/>' +
    '<path d="M0 80V58l14-6 10-22 8 20 14-6 10-26 10 28 16-10 12-18 10 22 18 6 18-12 20 14v38z" fill="#F5F3FF" opacity=".24"/>' +
    '<path d="M54 80l8-38 8 38zM92 80l6-30 6 30z" fill="#BDF6FF" opacity=".55"/>' +
    '<path d="M0 80V66l20-8 8-22 8 24 22-6 12-28 12 28 20 6 10-16 10 18 38 4v18z" fill="#121933" opacity=".68"/>',
  volcanic:
    '<ellipse cx="80" cy="80" rx="70" ry="18" fill="#FF8A50" opacity=".35"/>' +
    '<path d="M0 80V62l26-8 18 6 20-8 16 4 24-8 22 6 34-6v32z" fill="#F5F3FF" opacity=".16"/>' +
    '<path d="M0 80V71l40-10 26-35h28l26 35 40 10v9z" fill="#1A0E22" opacity=".85"/>' +
    '<path d="M71 27h18" stroke="#FFB26B" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M84 29c-3 12 6 22-4 36-3 5-2 10-1 15" fill="none" stroke="#FF8A50" stroke-width="2" stroke-linecap="round" opacity=".9"/>' +
    '<circle cx="86" cy="14" r="5" fill="#F5F3FF" opacity=".2"/><circle cx="94" cy="8" r="3.5" fill="#F5F3FF" opacity=".16"/>',
  blossom:
    '<circle cx="118" cy="58" r="12" fill="#FFF0F4" opacity=".85"/>' +
    '<path d="M0 80V58c20-14 40-14 60-2s40-22 60-14 30 10 40 14v24z" fill="#F5F3FF" opacity=".26"/>' +
    '<path d="M0 80V68c26-12 52-12 78 0s56-14 82-4v16z" fill="#121933" opacity=".66"/>' +
    '<g fill="#FFC4D6" opacity=".95"><circle cx="30" cy="58" r="6"/><circle cx="38" cy="55" r="5"/><circle cx="24" cy="54" r="4"/><circle cx="132" cy="60" r="5"/><circle cx="139" cy="57" r="4"/></g>' +
    '<path d="M31 80v-18M133 80v-16" stroke="#121933" stroke-width="2" opacity=".7"/>',
};

export function biomeArt(biome: MountainCard['biome']): string {
  return `<svg viewBox="0 0 160 80" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${RIDGES[biome] ?? RIDGES.alpine}</svg>`;
}

// Each body has a lit top edge so the art still reads when the shop shows it large.
const SLEDS: string[] = [
  // Pine Flyer: classic slatted wood sled.
  '<path d="M32 33v10M76 33v10" stroke="#8A5A36" stroke-width="4" stroke-linecap="round"/>' +
    '<rect x="20" y="25" width="70" height="8" rx="4" fill="#C98B5A"/>' +
    '<path d="M24.5 27h61" stroke="#E8B88C" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M34 25v8M48 25v8M62 25v8M76 25v8" stroke="#8A5A36" stroke-width="2"/>',
  // Whirl Saucer.
  '<ellipse cx="60" cy="36" rx="38" ry="10" fill="#6FAEDB"/><ellipse cx="60" cy="34" rx="38" ry="10.5" fill="#9FD3F5"/>' +
    '<ellipse cx="60" cy="31.5" rx="24" ry="5.5" fill="#D9F1FF"/>' +
    '<path d="M38.5 30.2c7-3 17-3.8 26-2.8" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>',
  // Lodge Toboggan: long plank, big front curl, a plum seat cushion.
  '<path d="M14 36h70c14 0 22-8 22-17 0-6-5-9-9-6" fill="none" stroke="#B5774A" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M17 34.4h66c11 0 18-5.4 20-12.6" fill="none" stroke="#D99D6C" stroke-width="1.6" stroke-linecap="round"/>' +
    '<rect x="24" y="27.5" width="44" height="6" rx="3" fill="#7A4A7E"/><path d="M27 29.4h38" stroke="#A774A9" stroke-width="1.4" stroke-linecap="round"/>',
  // Comet Bob: streamlined shell.
  '<path d="M34 36v7M82 36v7" stroke="#121933" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M16 36c0-9 10-15 26-15h30c14 0 26 6 30 15z" fill="#3A4A86"/>' +
    '<path d="M22 33c2.4-5.6 10-8.6 20-8.6h28c8.4 0 15.4 2 20.4 5.6" fill="none" stroke="#6274BE" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M30 29h52" stroke="#F5F3FF" stroke-width="3" stroke-linecap="round"/>',
  // Wisp: slim lilac deck.
  '<path d="M36 31v12M74 31v12" stroke="#8E7FD6" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M18 30h66c10 0 16-4 18-9" fill="none" stroke="#CFC4FF" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M20.5 28.4h63c7.6 0 12.4-2.6 14.6-6" fill="none" stroke="#F1EDFF" stroke-width="1.5" stroke-linecap="round"/>',
  // Tea Tray: flat tray with handles.
  '<rect x="22" y="28" width="76" height="10" rx="5" fill="#C9D2DE"/><rect x="27" y="29.6" width="66" height="2.6" rx="1.3" fill="#EEF2F7"/>' +
    '<path d="M30 28v-4h12M90 28v-4H78" fill="none" stroke="#9AA6BA" stroke-width="3" stroke-linecap="round"/>' +
    '<g fill="#9AA6BA"><circle cx="60" cy="34.6" r="1.6"/><circle cx="54" cy="34.6" r="1.1"/><circle cx="66" cy="34.6" r="1.1"/></g>',
];

const RUNNER = `<path d="M12 46h76c12 0 18-7 16-15-1-5-6-6-9-3" fill="none" stroke="${SIGNAL}" stroke-width="4.5" stroke-linecap="round"/>`;
const SHADOW = '<ellipse cx="58" cy="53" rx="46" ry="3.6" fill="#05081a" opacity=".35"/>';

/** Where the rider sits on each sled (top of the deck), in sled art units. */
const SEATS: Array<[number, number]> = [
  [46, 25],
  [54, 27],
  [40, 28],
  [50, 22],
  [44, 27.5],
  [52, 28.5],
];

/** The rider seated, facing the curl: ink coat, vermillion beanie and scarf streaming back. */
function rider(sx: number, sy: number): string {
  return (
    `<g transform="translate(${sx} ${sy})">` +
    `<path d="M-1 -27.4c-6.6-2-12 1.6-18.2-1.2-4-1.8-8.4-1.4-12.6 1.6 4-.6 7.4.4 10.4 2.4 5.6 3.6 12.6 1.6 20.4 3z" fill="${SIGNAL}"/>` +
    '<path d="M-2.4 -23c-4 2.6-7.2 5.6-12.6 6.6 4.4 1 8.6-.4 12.4-3.6z" fill="#D9381C"/>' +
    '<path d="M0 -4l14.4-5 9.6 4.4" fill="none" stroke="#1A2248" stroke-width="7.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M21.6 -8.6h4.8a3.8 3.8 0 0 1 0 7.6h-4.8z" fill="#0D1226"/>' +
    '<path d="M-9.5 0c-1.6-8.4-.6-17.6 5.2-22.6 4.6-3.8 11-2.4 12.4 3.8l2.4 14c.5 3-1.2 4.8-4.2 4.8z" fill="#28336A"/>' +
    '<path d="M-7.2 -3.4c-.9-6.8.2-13.8 4.4-17.8" fill="none" stroke="#4A5AA2" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M1.6 -18.6l8.4 6.2 5.6.8" fill="none" stroke="#36438A" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="16.6" cy="-11.4" r="3.3" fill="#0D1226"/>' +
    `<rect x="-6.6" y="-28" width="13.6" height="5.6" rx="2.8" fill="${SIGNAL}"/>` +
    '<circle cx="1.2" cy="-33.6" r="7.6" fill="#F7CDB0"/>' +
    '<circle cx="5.8" cy="-29.8" r="1.8" fill="#FF8C7A" opacity=".7"/>' +
    // Goggles, as on the in-game rider: an ink strap and an amber lens.
    '<path d="M-6.6 -33.4h9" stroke="#121933" stroke-width="2.6"/>' +
    '<rect x="1.4" y="-35.8" width="8.6" height="4.8" rx="2.2" fill="#FFB347" stroke="#121933" stroke-width="1.2"/>' +
    '<path d="M3.4 -34.2h3.2" stroke="#FFE3B0" stroke-width="1" stroke-linecap="round"/>' +
    `<path d="M-6.8 -35.6a7.9 7.9 0 0 1 15.8 0z" fill="${SIGNAL}"/>` +
    '<rect x="-7.4" y="-37.6" width="17" height="3.6" rx="1.8" fill="#FF7457"/>' +
    '<circle cx="-3.4" cy="-43.6" r="3.2" fill="#F5F3FF"/>' +
    '</g>'
  );
}

/** Each sled's own material colour, for the soft backdrop glow behind it on its shop tile. */
const TINTS = ['#E8B88C', '#9FD3F5', '#A774A9', '#6274BE', '#CFC4FF', '#C9D2DE'];

export function sledTint(id: number): string {
  return TINTS[((id % TINTS.length) + TINTS.length) % TINTS.length];
}

/**
 * A sled side view, cropped tight to the sled and its shadow so it fills a tile. With `seated`, the
 * rider sits on it and the view grows upward to fit them.
 */
export function sledArt(id: number, seated = false): string {
  const k = ((id % SLEDS.length) + SLEDS.length) % SLEDS.length;
  // The saucer and tray sit on the snow without runners: give them a vermillion rim instead.
  const runner =
    k === 1
      ? `<ellipse cx="60" cy="37" rx="38" ry="9" fill="none" stroke="${SIGNAL}" stroke-width="3.5"/>`
      : k === 5
        ? `<path d="M24 41h72" stroke="${SIGNAL}" stroke-width="4" stroke-linecap="round"/>`
        : RUNNER;
  const box = seated ? '0 -26 120 86' : '6 8 106 50';
  const who = seated ? rider(SEATS[k][0], SEATS[k][1]) : '';
  return `<svg viewBox="${box}" aria-hidden="true" focusable="false">${SHADOW}${runner}${SLEDS[k]}${who}</svg>`;
}
