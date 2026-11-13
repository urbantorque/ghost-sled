import type { MomentVerb } from '../game/marquee';

// The words a set piece's chip says while its verb plays and when it is decided (round 6; round 7's verbs). Short,
// so a chip fits a phone held upright at 390 px; no em dashes, and no pronoun for a rider.

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
      // (A chase counts the cars it passes; a sprint only leads and trails.)
      if (phase === 'start') return `The ${m} is away`;
      if (phase === 'lead') return `You lead the ${m}`;
      if (phase === 'trail') return `The ${m} leads`;
      if (phase === 'step') return n < of ? `Car ${n} of ${of} caught` : null;
      if (phase === 'won') return n > 0 ? `Caught the ${m}` : `Beat the ${m}`;
      if (phase === 'lost') return n > 0 || of > 1 ? `The ${m} got home` : `The ${m} won`;
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
      // (n is 1 when the span falls from its far end.)
      if (phase === 'start') return n === 1 ? 'The far end is falling' : 'The span is falling';
      if (phase === 'close') return n === 1 ? 'Here it comes' : 'Right behind you';
      if (phase === 'won') return n === 1 ? 'Past the keystone' : 'Outran the fall';
      if (phase === 'lost') return n === 1 ? 'The fall met you' : 'The span caught you';
      return null;
    case 'steps':
      if (phase === 'start') return `Stomp 0 of ${of}`;
      if (phase === 'step') return `Stomp ${n} of ${of}`;
      if (phase === 'miss') return n === 0 ? 'The row is broken' : 'A sketchy landing';
      if (phase === 'won') return `Stomped, ${of} of ${of}`;
      if (phase === 'lost') return `${n} of ${of} stomped`;
      return null;
    case 'slide':
      // (One long slide counts quarters; a slide each way counts its two.)
      if (phase === 'start') return of === 2 ? 'Slide 0 of 2' : 'Slide: hold the drift';
      if (phase === 'step') return of === 2 ? `Slide ${n} of 2` : n >= 3 ? 'Nearly there' : 'Hold it';
      if (phase === 'miss') return 'The slide let go';
      if (phase === 'won') return of === 2 ? 'A slide each way' : 'One long slide';
      if (phase === 'lost') return 'No slide held';
      return null;
    case 'shatter':
      if (phase === 'start') return `Bell 0 of ${of}`;
      if (phase === 'step') return `Bell ${n} of ${of}`;
      if (phase === 'miss') return 'Missed a bell';
      if (phase === 'won') return `Every bell, ${of} of ${of}`;
      if (phase === 'lost') return `${n} of ${of} bells`;
      return null;
    case 'surge':
      // (`of` is the speed the far shelf wants; a step is the speed off the lip.)
      if (phase === 'start') return `Hit the lip at ${of} m/s`;
      if (phase === 'step') return `${n} m/s off the lip`;
      if (phase === 'won') return 'Cleared to the shelf';
      if (phase === 'lost') return 'Short of the shelf';
      return null;
    case 'flourish':
      if (phase === 'start') return 'Land the trick clean';
      if (phase === 'won') return 'Landed it clean';
      if (phase === 'lost') return 'Not this time';
      return null;
    case 'follow':
      if (phase === 'start') return 'Find its wake';
      if (phase === 'lead') return 'In its wake';
      if (phase === 'trail') return 'Out of its wake';
      if (phase === 'step') return `In its wake, ${n} of ${of}`;
      if (phase === 'won') return 'The light is with you';
      if (phase === 'lost') return 'The light went on alone';
      return null;
    case 'kindle':
      if (phase === 'start') return `Lamp 0 of ${of}`;
      if (phase === 'step') return n >= of ? 'Now the other row' : `Lamp ${n} of ${of}`;
      if (phase === 'miss') return 'A hit lights nothing';
      if (phase === 'won') return 'The road is alight';
      if (phase === 'lost') return `${n} of ${of} lamps`;
      return null;
    case 'carry':
      // (n is the flame, in tenths.)
      if (phase === 'start') return n < 10 ? 'A low flame' : 'The flame is yours';
      if (phase === 'step') return n <= 3 ? 'The flame is low' : null;
      if (phase === 'close') return 'The flame leaps';
      if (phase === 'won') return 'The great lantern is lit';
      if (phase === 'lost') return 'The flame went out';
      return null;
  }
}
