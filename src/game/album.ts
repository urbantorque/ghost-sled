import { HOME_RIDERS, ROSTER, type Rider } from '../bot/roster';
import { MOODS, Mood } from '../sim/chaos';
import { courseFor } from '../sim/course';
import { planMoments } from '../sim/moments';
import { MOUNTAINS } from '../sim/mountains';
import { SYNERGIES } from '../sim/charms';
import { TRICKS } from '../sim/tricks';
import { CHARM_IDS, CHARM_NAMES, TRICK_NAMES } from './almanac';
import { riderTimeOn } from './twelve';
import type { AlbumSave } from './spinesave';
import { ALBUM_RUNS } from './spinesave';

// The Spirit Album (round 8, G8): a sticker book of everything there is to see, and what makes run 50 still new.
// Its silhouettes show what has not been seen, each with where to find it. Every sticker is the game's own data:
//   v:<mountain>:<set piece>:<variant>   a set piece's variant won
//   l:<mountain>:<slot>                  a legend met
//   m:<mountain>:<mood>                  a mood ridden to the line there
//   rv:<mountain>:<rider>                a signature rider's record beaten to the line on that mountain
//   x:<mountain>                         its mirror finished
//   t:<trick>                            a named trick landed (the sim's tricks)
//   w:<rider>                            one of The Twelve beaten in a duel
//   c:<charm>   s:<synergy>              a charm ridden, a named pair found
//   n:<depth>                            the Long Night ridden this many legs deep
// A sticker's frame is the run that earned it: the save keeps that run's record for the last ALBUM_RUNS such runs
// (spinesave.ts); an older sticker shows its kind's painted card.
//
// Pure: no DOM, render or audio imports.

export interface Sticker {
  id: string;
  /** Its mountain's id, or '' for one that belongs to no mountain. */
  mountain: string;
  group: 'variant' | 'legend' | 'mood' | 'rival' | 'mirror' | 'trick' | 'duel' | 'charm' | 'synergy' | 'night';
  name: string;
  /** Where to find it, for its silhouette. */
  hint: string;
}

/** The sim's named tricks (tricks.ts TRICKS ids 1 to 18 by key) and synergies (charms.ts SYNERGIES), stable from
 *  r8-sim c20e5e4. */
export const TRICK_KEYS: readonly string[] = ['spin', 'backflip', 'railGrab', 'lanternReach', 'spiritStretch', 'paperWheel', 'craneFold', 'emberTwist', 'spiritKnot', 'crosswind', 'lamppost', 'snowHare', 'pineBow', 'spinningTop', 'fireside', 'cometTail', 'willowisp', 'teacup'];
export const SYNERGY_KEYS: readonly string[] = ['ghostRider', 'cometChain', 'phoenix', 'paperStorm', 'nightChorus', 'shrineKeeper', 'blackIce'];
const NIGHT_DEPTHS = 5;
const LEGEND_NAMES = ['first legend', 'second legend'];

let catalogue: Sticker[] | null = null;

/** A mountain's home riders (round 9: the new mountains' own, bot/roster.ts HOME_RIDERS; none on the five). */
function homeOf(mountainId: string): readonly Rider[] {
  const mi = MOUNTAINS.findIndex((m) => m.id === mountainId);
  return HOME_RIDERS.filter((r) => r.home === mi);
}

/** The signature riders whose records a mountain's rival stickers ask you to beat: The Twelve, and (round 9) the
 *  mountain's own home riders after them. */
function rivalsOn(mountainId: string): readonly Rider[] {
  return [...ROSTER, ...homeOf(mountainId)];
}

/** A rival sticker's id. A home rider's is marked as one ('rv:gablefall:wren.home'): Gablefall's Wren Slater has the key
 *  of The Twelve's Old Wren, who rides there too. */
function rivalId(mountainId: string, r: Rider): string {
  return `rv:${mountainId}:${r.key}${ROSTER.includes(r) ? '' : '.home'}`;
}

/** Everything there is to see, in album order: each mountain's stickers, then the rest. */
export function albumCatalogue(): readonly Sticker[] {
  if (catalogue) return catalogue;
  const out: Sticker[] = [];
  for (const m of MOUNTAINS) {
    for (const s of planMoments(courseFor(m.seed))) for (let v = 0; v < s.variants; v++) out.push({ id: `v:${m.id}:${s.key}:${v}`, mountain: m.id, group: 'variant', name: `${s.name}, ${v + 1} of ${s.variants}`, hint: `${s.line} (its variants come by turn)` });
    for (let slot = 1; slot <= 2; slot++) out.push({ id: `l:${m.id}:${slot}`, mountain: m.id, group: 'legend', name: `${m.name}'s ${LEGEND_NAMES[slot - 1]}`, hint: 'About one run in ten meets a legend' });
    for (const mood of MOODS) if (mood.id !== Mood.None) out.push({ id: `m:${m.id}:${mood.id}`, mountain: m.id, group: 'mood', name: `${mood.name} on ${m.name}`, hint: `Finish ${m.name} in ${mood.name}` });
    for (const r of rivalsOn(m.id)) if (riderTimeOn(r, m.id) !== null) out.push({ id: rivalId(m.id, r), mountain: m.id, group: 'rival', name: `${r.name} on ${m.name}`, hint: `Beat ${r.name}'s record on ${m.name} to the line` });
    // (Round 9: a new mountain's mirror opens when its riders are beaten, almanac.ts mirrorOpen.)
    const how = homeOf(m.id).length ? `beating its ${homeOf(m.id).length} riders to the line opens it` : 'an Almanac page opens it';
    out.push({ id: `x:${m.id}`, mountain: m.id, group: 'mirror', name: `Mirror ${m.name}`, hint: `Finish ${m.name} mirrored (${how})` });
  }
  for (const k of TRICK_KEYS) out.push({ id: `t:${k}`, mountain: '', group: 'trick', name: TRICK_NAMES[k] ?? TRICKS.find((t) => t.key === k)?.name ?? k, hint: 'Land it' });
  for (const r of ROSTER) out.push({ id: `w:${r.key}`, mountain: '', group: 'duel', name: r.name, hint: `Beat ${r.name} in a duel` });
  for (const k of Object.keys(CHARM_IDS)) out.push({ id: `c:${k}`, mountain: '', group: 'charm', name: CHARM_NAMES[k] ?? k, hint: 'Ride through its gate' });
  for (const k of SYNERGY_KEYS) out.push({ id: `s:${k}`, mountain: '', group: 'synergy', name: SYNERGIES.find((x) => x.key === k)?.name ?? k, hint: 'Hold the two charms it pairs' });
  for (let n = 1; n <= NIGHT_DEPTHS; n++) out.push({ id: `n:${n}`, mountain: '', group: 'night', name: `${n} ${n === 1 ? 'leg' : 'legs'} of the Long Night`, hint: 'Ride the Long Night this deep' });
  return (catalogue = out);
}

/** What a run did, as the album reads it. */
export interface AlbumRun {
  /** A named mountain's id ('' for a Daily or a Cup, whose stickers are not the album's). */
  mountain: string;
  mirror: boolean;
  finished: boolean;
  time: number | null;
  mood: number;
  legend: number;
  moments: ReadonlyArray<{ key: string; variant: number; won: boolean }>;
  /** Named tricks landed, by key. */
  tricks: readonly string[];
  /** The Twelve's rider beaten in a duel this run. */
  duelWon: string | null;
  /** Charm keys ridden and synergy keys found. */
  charms: readonly string[];
  synergies: readonly string[];
  /** Long Night legs ridden, when this was one. */
  nightLegs?: number;
}

/** The stickers a run earns that the album does not hold yet. */
export function stickersFor(a: AlbumSave | undefined, run: AlbumRun): string[] {
  const got = a?.got ?? {};
  const ids: string[] = [];
  const m = run.mountain;
  if (m) {
    for (const q of run.moments) if (q.won) ids.push(`v:${m}:${q.key}:${q.variant}`);
    if (run.legend > 0) ids.push(`l:${m}:${run.legend}`);
    if (run.finished && run.mood !== Mood.None) ids.push(`m:${m}:${run.mood}`);
    if (run.finished && run.time !== null) for (const r of rivalsOn(m)) {
      const t = riderTimeOn(r, m);
      if (t !== null && run.time < t) ids.push(rivalId(m, r));
    }
    if (run.mirror && run.finished) ids.push(`x:${m}`);
  }
  for (const k of run.tricks) ids.push(`t:${k}`);
  if (run.duelWon) ids.push(`w:${run.duelWon}`);
  for (const k of run.charms) ids.push(`c:${k}`);
  for (const k of run.synergies) ids.push(`s:${k}`);
  for (let n = 1; n <= Math.min(NIGHT_DEPTHS, run.nightLegs ?? 0); n++) ids.push(`n:${n}`);
  const known = new Set(albumCatalogue().map((s) => s.id));
  return [...new Set(ids)].filter((id) => known.has(id) && got[id] === undefined);
}

/** Puts a run's new stickers in the album, with the run's record for their frame (`runNo`: save.runs). */
export function awardStickers(a: AlbumSave | undefined, ids: readonly string[], runNo: number, record?: string): AlbumSave | undefined {
  if (!ids.length) return a;
  const out: AlbumSave = { got: { ...(a?.got ?? {}) }, ...(a?.runs ? { runs: { ...a.runs } } : {}) };
  for (const id of ids) out.got[id] = runNo;
  if (record) {
    const runs = { ...(out.runs ?? {}), [String(runNo)]: record };
    const keep = Object.keys(runs).sort((x, y) => Number(y) - Number(x)).slice(0, ALBUM_RUNS);
    out.runs = Object.fromEntries(keep.map((k) => [k, runs[k]]));
  }
  return out;
}

/** Completion: held of all, overall and per mountain. */
export function albumCompletion(a: AlbumSave | undefined): { got: number; of: number; byMountain: Record<string, { got: number; of: number }> } {
  const got = a?.got ?? {};
  const byMountain: Record<string, { got: number; of: number }> = {};
  let n = 0;
  const all = albumCatalogue();
  for (const s of all) {
    const has = got[s.id] !== undefined;
    if (has) n++;
    if (!s.mountain) continue;
    const b = (byMountain[s.mountain] ??= { got: 0, of: 0 });
    b.of++;
    if (has) b.got++;
  }
  return { got: n, of: all.length, byMountain };
}
