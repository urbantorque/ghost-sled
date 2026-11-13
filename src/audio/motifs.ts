import { riderByName } from '../bot/roster';

// The signature riders' motifs (round 7): each of the twelve has a few notes of their own, heard when they
// are called as your rival on the start line and when they pass you. Data: a new rider is one entry. The
// notes are semitones over the key's bright root (the major key, or a minor key's relative major) and
// only ever the major pentatonic's (0, 2, 4, 7, 9 and their octaves), so a motif sits in whatever key and
// mode the mountain's music is in; times and lengths are in eighths of the music's beat, so it plays at
// the music's tempo, on its grid. Every motif is original, and no two share a contour and a rhythm
// (tests/audiostems.test.ts).

export type MotifVoice = 'brass' | 'bell' | 'glass' | 'pluck' | 'whistle';

export interface Motif {
  /** What it is, for the listening guide. */
  says: string;
  voice: MotifVoice;
  /** Octaves over the middle register. */
  oct: number;
  /** [semitones over the bright root, the eighth it starts on, eighths long]. */
  notes: ReadonlyArray<readonly [number, number, number]>;
}

/** By the rider's key in src/bot/roster.ts. */
export const MOTIFS: Readonly<Record<string, Motif>> = {
  crown: { says: 'The Hollow King: low brass, up a fifth and slowly home', voice: 'brass', oct: -1, notes: [[0, 0, 3], [7, 3, 1], [4, 4, 2], [0, 6, 4]] },
  mila: { says: 'Mila Frost: a run of glass falling four notes and turning back up', voice: 'glass', oct: 1, notes: [[12, 0, 1], [9, 1, 1], [7, 2, 1], [4, 3, 1], [7, 4, 4]] },
  suki: { says: 'Suki Ember: one plucked note struck twice, then a dash up to the octave', voice: 'pluck', oct: 0, notes: [[0, 0, 1], [0, 1, 1], [7, 2, 1], [9, 3, 1], [12, 4, 3]] },
  ivo: { says: 'Ivo Crag: a hammered fifth that drops to the root and stands on the third', voice: 'brass', oct: -1, notes: [[7, 0, 1], [7, 1, 1], [0, 2, 2], [4, 4, 4]] },
  kaito: { says: 'Kaito Mori: a plucked turn, up three and back down four', voice: 'pluck', oct: 1, notes: [[4, 0, 1], [7, 1, 1], [9, 2, 1], [7, 3, 1], [4, 4, 1], [2, 5, 1], [4, 6, 3]] },
  wren: { says: 'Old Wren: two slow bells, the fifth and then the root under it', voice: 'bell', oct: 0, notes: [[7, 0, 3], [0, 3, 6]] },
  tavi: { says: 'Tavi Rook: a whistle climbing the chord to a held high third', voice: 'whistle', oct: 1, notes: [[0, 0, 1], [4, 1, 1], [7, 2, 1], [12, 3, 1], [16, 4, 4]] },
  nessa: { says: 'Nessa Lumen: glass rocking on the sixth before it lifts to the octave', voice: 'glass', oct: 0, notes: [[9, 0, 2], [7, 2, 1], [9, 3, 1], [12, 4, 4]] },
  juno: { says: 'Juno Vale: bells stepping down three, then up five to the sixth', voice: 'bell', oct: 1, notes: [[4, 0, 1], [2, 1, 1], [0, 2, 1], [2, 3, 1], [4, 4, 1], [7, 5, 1], [9, 6, 3]] },
  pip: { says: 'Pip Thistle: plucked leaps, high then low then high, never where expected', voice: 'pluck', oct: 0, notes: [[12, 0, 1], [0, 1, 1], [9, 2, 1], [2, 3, 1], [7, 4, 3]] },
  bram: { says: 'Bram Oakhollow: a horn call, a long root and two unhurried steps up', voice: 'brass', oct: 0, notes: [[0, 0, 3], [2, 3, 1], [4, 4, 5]] },
  rosa: { says: 'Rosa Quill: a whistled wave, over the fifth and under it and back', voice: 'whistle', oct: 0, notes: [[7, 0, 1], [9, 1, 1], [7, 2, 1], [4, 3, 1], [2, 4, 1], [4, 5, 1], [7, 6, 3]] },
};

/** The motif of the signature rider behind a ghost's name, or null for the crowd. */
export function motifFor(name: string | null | undefined): Motif | null {
  const r = riderByName(name);
  return r ? (MOTIFS[r.key] ?? null) : null;
}

/** A motif's shape, whatever note it starts on: its intervals and its rhythm (the test's measure of
 *  two motifs being the same tune). */
export function motifShape(m: Motif): string {
  const first = m.notes[0][0];
  return m.notes.map(([p, at, len]) => `${p - first}@${at}+${len}`).join(' ');
}
