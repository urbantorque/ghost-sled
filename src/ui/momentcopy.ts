import type { MomentVerb } from '../game/marquee';

// The words a set piece's chip says while its verb plays and when it is decided (round 6). Short, so a chip
// fits a phone held upright at 390 px; no em dashes, and no pronoun for a rider.

/** The race's machine, by set piece: what the chip calls it. */
const MACHINE: Record<string, string> = {
  mirror: 'cable car',
  crevasse: 'ropeway',
  cindergate: 'ore train',
};

export function machineName(key: string): string {
  return MACHINE[key] ?? 'cable car';
}

export type MomentPhase = 'start' | 'step' | 'miss' | 'lead' | 'trail' | 'close' | 'won' | 'lost';

/** The chip's line for a set piece's beat, or null when the beat changes nothing it says. */
export function momentLine(verb: MomentVerb, key: string, phase: MomentPhase, n: number, of: number): string | null {
  const m = machineName(key);
  switch (verb) {
    case 'race':
      if (phase === 'start') return `The ${m} is away`;
      if (phase === 'lead') return `You lead the ${m}`;
      if (phase === 'trail') return `The ${m} leads`;
      if (phase === 'won') return `Beat the ${m}`;
      if (phase === 'lost') return `The ${m} won`;
      return null;
    case 'gates':
      if (phase === 'start') return `Gate 0 of ${of}`;
      if (phase === 'step') return `Gate ${n} of ${of}`;
      if (phase === 'miss') return 'Missed a gate';
      if (phase === 'won') return `Every gate, ${of} of ${of}`;
      if (phase === 'lost') return 'Not every gate';
      return null;
    case 'rings':
      if (phase === 'start') return `Ring 0 of ${of}`;
      if (phase === 'step') return `Ring ${n} of ${of}`;
      if (phase === 'miss') return 'Missed a ring';
      if (phase === 'won') return 'All three rings';
      if (phase === 'lost') return `${n} of ${of} rings`;
      return null;
    case 'collapse':
      if (phase === 'start') return 'The span is falling';
      if (phase === 'close') return 'Right behind you';
      if (phase === 'won') return 'Outran the fall';
      if (phase === 'lost') return 'The span caught you';
      return null;
    case 'steps':
      if (phase === 'start') return `Step 0 of ${of}`;
      if (phase === 'step') return `Step ${n} of ${of}`;
      if (phase === 'miss') return 'Not a stomp';
      if (phase === 'won') return 'Every step stomped';
      if (phase === 'lost') return `${n} of ${of} stomped`;
      return null;
  }
}
