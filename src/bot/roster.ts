// The signature riders: twelve ghosts with a face, a hat, a sled and a way of riding that shows in their
// recorded runs. The pool generator gives each of them a run on every mountain at their own level, ridden
// by the bot with their style's traits, so a rider who dashes every lantern, or never leaves the safe
// line, really did that on the run you race. The rest of a pool is the crowd: generated handles.
//
// Pure data and pure functions: the bot reads it in a worker and in node, so nothing here touches the DOM.

/** The silhouette a ghost's head carries. Read from behind at 30 m, so each one is a different outline. */
export type HatKind =
  | 'hood' // a tall pointed felt hood
  | 'antlers' // a round hood with two stubby antlers
  | 'topknot' // a tied topknot of hair with a band
  | 'brim' // a wide flat brim
  | 'stovepipe' // a tall narrow top hat
  | 'bobble' // a beanie with a huge pom
  | 'beak' // a hood with a long beak-like peak
  | 'lantern' // a headband carrying a small lantern on a hook
  | 'horns' // a helm with two curled horns
  | 'aviator' // an earflap cap with goggles on top
  | 'foxears' // a hood with two tall pointed ears
  | 'crown'; // a jagged crown

/** A small glyph on the rider's name tag and its tail ribbon. */
export type Emblem = 'snowflake' | 'leaf' | 'flame' | 'petal' | 'bell' | 'star' | 'feather' | 'moon' | 'fang' | 'bolt' | 'wave' | 'crown';

/** How a rider rides, which the bot's traits carry into the record (see `styleTraits`). */
export type RideStyle =
  | 'liner' // the cleanest line on the mountain, few tricks, rarely falls
  | 'dasher' // spends every lantern the moment it lights
  | 'stunt' // spins and flips everything with air under it
  | 'hoarder' // keeps its lanterns as wards and rides through what would floor anyone else
  | 'collector' // chases every light, wide and greedy
  | 'drafter' // sits in slipstreams and slingshots past
  | 'grinder' // takes every rail
  | 'bold' // the fork's risk route, the sky gates, the long way up the wall
  | 'wild'; // very fast and falls a lot

export interface Rider {
  /** Stable id: never shown, used in saves (grudges, mastery). */
  key: string;
  /** The name on the tag and in the race (fits the run record's 16-character rule). */
  name: string;
  hat: HatKind;
  emblem: Emblem;
  /** The rider's own colour: its emblem, its tail ribbon and the edge of its tag. The body stays spectral. */
  accent: string;
  /** The sled it rides (sleds.ts id). */
  sled: number;
  style: RideStyle;
  /** 0..1, where the bot's skill sits for this rider's runs. */
  skill: number;
  /** Mountain index it calls home: it rides there a touch better. */
  home: number;
  /** One line for the rider's card. */
  bio: string;
  /** Short lines in the race: when it passes you, when you pass it, when it beats you, when you beat it. */
  says: { pass: readonly string[]; passed: readonly string[]; won: readonly string[]; lost: readonly string[] };
}

export const ROSTER: readonly Rider[] = [
  {
    key: 'crown', name: 'The Hollow King', hat: 'crown', emblem: 'crown', accent: '#E8D9FF', sled: 3, style: 'liner', skill: 1, home: 0,
    bio: 'Holds the top of every ladder and has never been seen to fall.',
    says: { pass: ['Kneel, little sled.', 'Make way.'], passed: ['Bold.', 'Enjoy the view.'], won: ['As it always is.'], lost: ['Again. Tomorrow.'] },
  },
  {
    key: 'mila', name: 'Mila Frost', hat: 'hood', emblem: 'snowflake', accent: '#BFE6FF', sled: 0, style: 'liner', skill: 0.92, home: 1,
    bio: 'Rides Frostfang like she drew it. Never wastes a metre.',
    says: { pass: ['Mind the ice.', 'Too wide.'], passed: ['Enjoy it while it lasts.', 'Hm.'], won: ['Cold as ever.'], lost: ['Well ridden.'] },
  },
  {
    key: 'suki', name: 'Suki Ember', hat: 'topknot', emblem: 'flame', accent: '#FFB38A', sled: 3, style: 'dasher', skill: 0.86, home: 2,
    bio: 'Lights a lantern, spends it. Lights another. Spends it.',
    says: { pass: ['Burn bright!', 'Keep up!'], passed: ['I was saving that.', 'Not for long.'], won: ['Too slow, cinder.'], lost: ['Rematch. Now.'] },
  },
  {
    key: 'ivo', name: 'Ivo Crag', hat: 'horns', emblem: 'fang', accent: '#F2C18D', sled: 1, style: 'bold', skill: 0.82, home: 2,
    bio: 'Takes the ice, the sky gates and the wall. Every time.',
    says: { pass: ['Long way round!', 'Up here!'], passed: ['Lucky line.', 'Grr.'], won: ['Fortune and the brave.'], lost: ['Next time the ice.'] },
  },
  {
    key: 'kaito', name: 'Kaito Mori', hat: 'brim', emblem: 'petal', accent: '#FFC9DA', sled: 1, style: 'stunt', skill: 0.8, home: 3,
    bio: 'Spins everything with air under it, and lands most of it.',
    says: { pass: ['Watch this.', 'Spin it!'], passed: ['Style points, though.'], won: ['Clean landing.'], lost: ['You flew well.'] },
  },
  {
    key: 'wren', name: 'Old Wren', hat: 'stovepipe', emblem: 'bell', accent: '#E6E0C8', sled: 2, style: 'hoarder', skill: 0.72, home: 0,
    bio: 'Keeps every lantern lit. Hit a tree? Wren rides on.',
    says: { pass: ['Slow and lit.', 'Steady now.'], passed: ['Go on then.'], won: ['Patience, child.'], lost: ['Ha. Well done.'] },
  },
  {
    key: 'tavi', name: 'Tavi Rook', hat: 'beak', emblem: 'feather', accent: '#C7D0FF', sled: 4, style: 'drafter', skill: 0.7, home: 1,
    bio: 'Sits in your wake, then slingshots past at the worst moment.',
    says: { pass: ['Thanks for the tow!', 'Caw.'], passed: ['Lead on.'], won: ['Wake rider wins.'], lost: ['Couldn\'t catch your tail.'] },
  },
  {
    key: 'nessa', name: 'Nessa Lumen', hat: 'lantern', emblem: 'moon', accent: '#FFE7A8', sled: 5, style: 'grinder', skill: 0.64, home: 3,
    bio: 'Every rail on the mountain, all the way to its end.',
    says: { pass: ['Rail line!', 'Sparks!'], passed: ['Light the way.'], won: ['Followed the rails home.'], lost: ['Bright run.'] },
  },
  {
    key: 'juno', name: 'Juno Vale', hat: 'bobble', emblem: 'star', accent: '#FFD1F0', sled: 0, style: 'collector', skill: 0.56, home: 0,
    bio: 'Every light on the mountain is hers. She will go a long way for one.',
    says: { pass: ['Mine!', 'Shiny!'], passed: ['You missed some.'], won: ['Got them all.'], lost: ['Fair. Shiny run.'] },
  },
  {
    key: 'pip', name: 'Pip Thistle', hat: 'aviator', emblem: 'bolt', accent: '#D9F2A6', sled: 3, style: 'wild', skill: 0.5, home: 1,
    bio: 'Fastest thing on two runners for thirty seconds at a time.',
    says: { pass: ['Wheee!', 'Coming through!'], passed: ['Oops.'], won: ['Didn\'t even fall!'], lost: ['Fell. Twice.'] },
  },
  {
    key: 'bram', name: 'Bram Oakhollow', hat: 'antlers', emblem: 'leaf', accent: '#CFE8B8', sled: 2, style: 'liner', skill: 0.4, home: 0,
    bio: 'Pinecrest born. Rides it slow, rides it all.',
    says: { pass: ['Afternoon.', 'Lovely day.'], passed: ['After you.'], won: ['Steady wins.'], lost: ['Good on you.'] },
  },
  {
    key: 'rosa', name: 'Rosa Quill', hat: 'foxears', emblem: 'wave', accent: '#FFC4B3', sled: 1, style: 'stunt', skill: 0.3, home: 3,
    bio: 'Learning everything at once, mostly upside down.',
    says: { pass: ['Hi!', 'Look, I\'m winning!'], passed: ['Aw.'], won: ['I won? I won!'], lost: ['Teach me that.'] },
  },
];

const BY_NAME = new Map(ROSTER.map((r) => [r.name, r]));
const BY_KEY = new Map(ROSTER.map((r) => [r.key, r]));

/** The signature rider behind a ghost's name, or null for the crowd. */
export function riderByName(name: string | null | undefined): Rider | null {
  return (name && BY_NAME.get(name)) || null;
}

export function riderByKey(key: string | null | undefined): Rider | null {
  return (key && BY_KEY.get(key)) || null;
}

/** A rider's skill on one mountain: a touch better at home. */
export function riderSkill(r: Rider, mountain: number): number {
  const s = r.skill + (r.home === mountain ? 0.05 : 0);
  return s > 1 ? 1 : s;
}
