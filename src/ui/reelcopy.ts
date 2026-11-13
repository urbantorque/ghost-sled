import type { ReelShot } from '../game/reel';
import { clock } from '../game/standing';
import { fmt, ordinal } from './fmt';

// The reel's title cards, in the UI's language: a short line a shot, every number with its unit, no em
// dashes and no pronoun for a rider. Pure, so the tests read the same words a player does.

/** The card for a shot: "Best leap, 3.1 s", "Passed Mila Frost at the Serac Gate". */
export function reelCard(s: ReelShot): string {
  switch (s.kind) {
    case 'leap':
      return `${s.second ? 'Big air' : 'Best leap'}, ${(s.seconds ?? 0).toFixed(1)} s`;
    case 'pass':
      return s.place ? `Passed ${s.name} at ${s.place}` : `Passed ${s.name}`;
    case 'piece':
      return `${s.name}, won`;
    case 'legend':
      return s.name ?? 'A legend';
    case 'speed':
      return `Top speed, ${Math.round(s.speed ?? 0)} m/s`;
    case 'finish':
      return s.rank ? `${ordinal(s.rank)} over the line, ${clock(s.seconds ?? 0)}` : `Over the line, ${clock(s.seconds ?? 0)}`;
    case 'wreck':
      return `The run ended at ${fmt(Math.round(s.metres ?? 0))} m`;
  }
}

/** The small word over a card: what kind of moment it is. */
export function reelKicker(s: ReelShot): string {
  return { leap: 'In the air', pass: 'The race', piece: 'Set piece', legend: 'Legend', speed: 'Flat out', finish: 'The finish', wreck: 'The end' }[s.kind];
}
