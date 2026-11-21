import type { ChaosEvent, Mood } from '../sim/chaos';
import type { CrashCause } from '../sim/sim';
import type { InputMode, TouchVisual } from '../game/input';
import type { Beat } from '../game/beats';

// The contract between the game layer (src/game) and the DOM overlay (src/ui). The game owns all
// state and calls these methods; the UI owns presentation only and reports intent via handlers.

export type GhostKind = 'pool' | 'you' | 'grudge' | 'friend' | 'daily';

/** Contract C6: on a screen held upright the results card leaves this share of the height open at the top (the
 *  safe-area inset on top of it), and the results lens frames the rider in that band. The visual lift raised it
 *  from 0.28: under the moment's line and the ladder the band kept only a cropped torso, and on a phone the
 *  picture is the game. style.css's portrait results rule says the same share (tests/results-band.test.ts). */
export const RESULTS_BAND = 0.44;

export interface MountainCard {
  id: string;
  name: string;
  tagline: string;
  /** The card's art: the course's biome, or 'lantern' for the finale (its own night and lights). */
  biome: 'alpine' | 'glacier' | 'volcanic' | 'blossom' | 'lantern';
  locked: boolean;
  /** e.g. "Pass 4 ghosts to unlock" */
  unlockText: string;
  best: number;
  /** Your best finish time here, seconds (0 for none): the card reads it before the score. */
  bestTime?: number;
  /** The old course's best, shown as "Old best" until a new one exists (0 for none). */
  oldBest?: number;
  /** Your rank on this mountain's ladder of rankOf places (null with no run here). */
  rank?: number | null;
  rankOf?: number;
  /** You have beaten the top of this ladder. */
  top?: boolean;
  medals?: MedalSet;
  /** Mastery stars held of the mountain's board. */
  stars?: { got: number; of: number };
}

/** Your medals on a mountain: 0 none, 1 bronze, 2 silver, 3 gold, one per stage and the whole run. */
export interface MedalSet {
  stages: number[];
  run: number;
}

/** The weekly Cup on the title. best: your best time this week, seconds (0 for none). */
export interface TitleCup {
  key: string;
  week: number;
  ready: boolean;
  /** The week's mood and event, as the reveal names them. */
  mood: string;
  event: string | null;
  best: number;
  medal: number;
}

/** A signature rider as the screens draw one: the bust's hat and emblem, and the rider's own colour. */
export interface RiderFace {
  key: string;
  name: string;
  hat: string;
  emblem: string;
  accent: string;
}

/** One rung of The Twelve's ladder, gentlest first. */
export interface TwelveRung extends RiderFace {
  /** One line of their character (roster.ts bio). */
  bio: string;
  /** Their home mountain's name, and their time there ("2:12.8"; null when the pool holds no finish). */
  mountain: string;
  time: string | null;
  /** beaten; next (the duel that rides now); open (home open, waiting their turn); locked (home locked). */
  state: 'beaten' | 'next' | 'open' | 'locked';
}

/** The Twelve on the title (game/twelve.ts): the card and the ladder. */
export interface TitleTwelve {
  beaten: number;
  of: number;
  /** "3 of 12 beaten". */
  tally: string;
  /** The rider to duel now (a rung in state 'next'), with the mountain to pick; null with none to ride. */
  next: (TwelveRung & { mountainId: string; here: boolean }) | null;
  /** The last race is what rides next: all twelve on Lanternfall. here: that mountain is selected. */
  final: { mountainId: string; mountain: string; here: boolean } | null;
  /** Nobody can be duelled yet: who waits, and what opens their home ("Pass 3 more ghosts"). */
  waiting: { rider: TwelveRung; opens: string } | null;
  /** What is left before the King ("3 more open Lanternfall"); null once it no longer applies. */
  hook: string | null;
  /** The last race is won. */
  crowned: boolean;
  rungs: TwelveRung[];
}

/** The Twelve on a run's results: what the duel did. */
export interface ResultsTwelve {
  /** fell: a rider beaten; crowned: the last race won; held: the rider held you off; final: the last race stands. */
  tone: 'fell' | 'crowned' | 'held' | 'final';
  /** "Bram Oakhollow falls. 3 of 12 beaten." */
  line: string;
  rider: RiderFace | null;
  /** What the rider says about it (roster.ts says), when one was duelled. */
  says: string | null;
  beaten: number;
  of: number;
  /** Gifts it paid: already in the wallet, never doubled. */
  gifts: number;
}

export interface MissionView {
  text: string;
  progress: number;
  target: number;
  /** Decimal places its progress reads in: 1 for a mission in seconds ("1.9/2"), else 0. */
  dp?: 0 | 1;
  reward: number;
  done: boolean;
  justCompleted: boolean;
}

export interface PaintCard {
  id: string;
  name: string;
  hex: string;
  price: number;
  owned: boolean;
  on: boolean;
  affordable: boolean;
}

/** A garage shelf (round 6, game/garage.ts): scarves, hats, trails or sled sounds. */
export type GarageShelfId = 'scarf' | 'hat' | 'trail' | 'sound';

/** One item on a garage shelf, as the shop shows it. */
export interface GarageCard {
  id: string;
  name: string;
  /** One plain line on what it looks or sounds like. */
  blurb: string;
  price: number;
  owned: boolean;
  /** Worn (or, for a sound, the one your runners make). */
  on: boolean;
  affordable: boolean;
}

export interface GarageShelf {
  id: GarageShelfId;
  items: GarageCard[];
}

export interface SledCard {
  id: number;
  name: string;
  trait: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
}

export interface TitleModel {
  mountains: MountainCard[];
  selected: string;
  /** medal: today's best Daily medal (0 none, 1 bronze, 2 silver, 3 gold); streak: Daily days in a row, or with
   *  `flame` (round 8) the flame's days in a row with a run of any kind, which takes the Daily-only line's place. */
  daily: { key: string; best: number; ready: boolean; medal?: number; streak?: number; flame?: boolean; time?: number };
  best: number;
  /** Your best finish time on the selected mountain, seconds (0 for none). */
  bestTime?: number;
  /** The selected mountain's old best, until a new one exists (0 for none). */
  oldBest?: number;
  wallet: number;
  sledName: string;
  /** A friend's challenge link was opened. distance: how far their run went; time: its finish in
   *  seconds, when it finished; daily: it was on a Daily Mountain; old: it was ridden on an old course,
   *  so `distance` is a target and no ghost rides; waiting: its mountain's rivals are still being
   *  generated, so Ride cannot start yet. */
  challenge: { name: string; score: number; mountain: string; distance?: number; time?: number | null; daily?: boolean; old?: boolean; waiting?: boolean } | null;
  missions: MissionView[];
  inputMode: InputMode;
  firstVisit: boolean;
  /** The saved master volume, so the first-visit Mute toggle starts in the right state. */
  master?: number;
  /** Ghosts passed across all runs (the selected mountain card shows it). */
  ghostsPassed?: number;
  /** A one-line greeting over the Ride button (progress.titleGreeting), or none. */
  greet?: string | null;
  /** The name above you on the selected mountain's ladder ("Next: SparkleCedar, 2:11.4, 1.6 s up"). */
  nextRung?: string | null;
  /** Round 8, the modes lane: the picked mountain's mirror, once open (its Almanac page, or its home riders all
   *  beaten): whether Ride rides it mirrored. Absent where it is not open. */
  mirror?: { on: boolean } | null;
  /** The weekly Cup, when there is one to show. */
  cup?: TitleCup | null;
  /** The Twelve: the campaign's card and ladder (absent on a first visit). */
  twelve?: TitleTwelve | null;
  /** Round 8: Rider Rank, the flame, contracts, the league, the chapter, the album and the one line of news. */
  spine?: TitleSpine | null;
}

export interface HudModel {
  score: number;
  distance: number;
  /** The run clock, seconds. It stops on the finish line. */
  clock: number;
  /** The stage you are riding (0 based), of how many, and how far down the whole descent (0..1). */
  stage: { index: number; of: number; progress: number } | null;
  /** Get-ups (round 7): how many are left of how many, and how far the next one has come back (0 to 1); null
   *  until the run's first fall. */
  wipeouts: { left: number; of: number; back?: number } | null;
  /** Gifts this run (shown on the results; the run HUD shows the lantern instead). */
  gifts: number;
  /**
   * The lantern: charge 0..300 (100 a lantern), how many are lit, whether a dash is on, and ward/dash/lit
   * counters that tick up when one happens (so the HUD can flash on a change it did not see happen).
   */
  lantern: { charge: number; cells: number; dashing: boolean; wards: number; dashes: number; /** Round 8: a held charm's signal on the lantern (charmsignals.ts SIG bits). */ sig?: number };
  /**
   * stake: the figure at stake (pending x multiplier); fuse: 0..1 tension while a big stake drains
   * (stake.fuseLevel); pace: the stake has passed your lifetime best combo this run.
   */
  combo: { active: boolean; pending: number; mult: number; chain: number; timer: number; stake?: number; fuse?: number; pace?: boolean };
  speed: number;
  /**
   * The nearest ghost ahead of you (or the one just behind if you lead). `gap` is signed, positive
   * ahead. Contract C12: the HUD shows it as a positive number with a word ("6 m ahead", "6 m
   * behind"), in the ghost's kind colour, never a bare sign or a lone triangle.
   */
  nextGhost: { name: string; kind: GhostKind; gap: number; duel?: boolean } | null;
  /** Your race position among live ghosts, 1 = leading. */
  place: { rank: number; of: number };
  /** 0..1 slipstream charge while drafting, 0 otherwise. */
  draft: number;
  driftTier: number;
  /** Avalanche gap in metres when one is chasing you. */
  danger: { kind: 'avalanche'; gap: number } | null;
  mood: Mood;
  /** Metres to your best distance on this mountain while within 250 m, else null. */
  bestIn?: number | null;
  /** The rolled event coming up: metres to its trigger in 10 m steps (400 m or less), else null. */
  countdown?: { event: ChaosEvent; metres: number } | null;
}

export interface RevealModel {
  mood: { id: Mood; name: string; rule: string };
  /** goal: what the event pays and how ("Outrun it: +2,000"). */
  event: { id: ChaosEvent; name: string; goal?: string } | null;
  /** All mood names, for the slot-reel animation. */
  reel: string[];
}

export interface ResultsGhost {
  name: string;
  kind: GhostKind;
  score: number;
  /** Its finish time in seconds; null or absent for a run that did not finish. */
  time?: number | null;
  /**
   * How far its whole run went, in metres. Finishers rank by time, then the rest by this, the number
   * their rows show (a missing value reads as 0).
   */
  distance?: number;
  /** You overtook it at least once during the run (its Passed stamp). */
  passed: boolean;
}

/** The clock at a stage line. vsBest: seconds against your best there, + = behind; null with none. */
export interface ResultsSplit {
  name: string;
  seconds: number;
  vsBest: number | null;
}

/** A run that reached the finish line: the card's finished variant. */
export interface ResultsFinish {
  seconds: number;
  /** 0 none, 1 bronze, 2 silver, 3 gold. */
  medal: number;
  splits: ResultsSplit[];
  /** Your best time before this run, seconds; null with none. */
  bestTime: number | null;
  /** This run's time beat it (or is your first). */
  newBest: boolean;
}

/** A mountain this run unlocked, for the results reveal card. */
export interface UnlockedMountain {
  id: string;
  name: string;
  biome: MountainCard['biome'];
  tagline: string;
}

export interface ResultsModel {
  score: number;
  distance: number;
  /** Set when the run reached the line. Without it, the wreck's card. */
  finish?: ResultsFinish | null;
  /** The finish line, metres ("85 m short of the finish"). */
  finishZ?: number;
  best: number;
  newBest: boolean;
  giftsEarned: number;
  wallet: number;
  ghosts: ResultsGhost[];
  ghostsPassed: number;
  missions: MissionView[];
  /** How the run ended ('' for a finish). */
  crashCause: string;
  /** What ended the run, for the crash line's glyph. */
  crashKind?: CrashCause | null;
  bestCombo: number;
  perfects: number;
  maxAir: number;
  /** This run's stats that beat the player's own lifetime record (never on a first record). */
  records?: Array<'bestCombo' | 'perfects' | 'maxAir'>;
  mountain: string;
  mood: string;
  canRevive: boolean;
  canDouble: boolean;
  doubled: boolean;
  /** Show the "Challenge a friend" button. */
  canChallenge: boolean;
  unlocked: string[];
  /** The same unlocks with their biome, for the reveal card and its Ride action (names stay above). */
  unlockedMountains?: UnlockedMountain[];
  /** The run's longest stomp streak. */
  bestStreak?: number;
  /** The stake lost to the crash (results append " with 4,960 on the line" from 1,000). */
  lostCombo?: number;
  /** At most ONE extra race line on the card (C6 budget): friend, then grudge, then event note. */
  raceLine?: { text: string; tone: 'friend' | 'grudge' | 'event' | 'crash' | 'rung' | 'medal' } | null;
  /** A signature rider's word on the result (round 5): the one just ahead of you, else the one you just
   *  beat. Its accent is its own colour (roster.ts). */
  quote?: { name: string; text: string; accent: string } | null;
  /** A named mountain's mastery: stars held of the board, and the ones this run earned (each pays 10). */
  mastery?: { got: number; of: number; fresh: string[] } | null;
  /** A wreck short of the town: the rider may ride the rest home as a spirit, outside the race. */
  canRideHome?: boolean;
  /** Where you stood at the crash and who rode on past ("You led at the crash. SparkleCedar rode on
   *  past."): shown in the place note's slot, unless it is the race line itself. */
  crashNote?: string | null;
  /** Your place at the crash, when it was better than where you finished: a phone card, whose race
   *  line takes the crash note's slot, shows it beside the place chip ("Led at the crash"). */
  rankAtCrash?: number | null;
  /** The Run Again button's label ("Rematch Mila") and its accessible name. */
  runAgainLabel?: { text: string; aria: string };
  /** The next unlock to work toward, in the unlock-card slot. */
  nextUnlock?: ResultsNextUnlock | null;
  /** You beat the friend's challenge: Challenge becomes the primary "Send It Back". */
  sendItBack?: boolean;
  /** Your place on the mountain's ladder (a named mountain only). */
  ladder?: ResultsLadder | null;
  /** The stage table (a run that crossed a stage line). */
  stages?: ResultsStages | null;
  /** The Twelve: this run was a duel or the last race, and how it went. */
  twelve?: ResultsTwelve | null;
  /** Round 8: the spine's part of the results (the bar, what opened, the one button). */
  spine?: ResultsSpine | null;
}

/** Your place on this mountain's ladder as the run left it, and what the run earned on it. */
export interface ResultsLadder {
  rank: number | null;
  of: number;
  top: boolean;
  /** "Next: SparkleCedar, 2:11.4, 1.6 s up"; null at the top. */
  next: string | null;
  /** Places this run climbed. */
  up: number;
  medals: MedalSet;
  /** Medals this run raised: 0 to 2 for a stage, 3 for the whole run. */
  fresh: number[];
  /** The climbing moment ("Beat SparkleCedar and 2 more."), null for a run that climbed nothing. */
  moment: string | null;
  /** This run took the top of the ladder. */
  topNow: boolean;
  /** Gifts it paid: already in the wallet, and never doubled. */
  gifts: number;
}

/** One stage of a run, in its own time: you, and your rival and your best on the same stretch. */
export interface ResultsStageRow {
  name: string;
  seconds: number;
  /** The medal this run earned here (0 none). */
  medal: number;
  rival: number | null;
  best: number | null;
}

/** The stage table: what decided it, stage by stage. */
export interface ResultsStages {
  rival: { name: string; kind: GhostKind } | null;
  /** Your own best rode, so its splits show. */
  best: boolean;
  /** "You lost 2.1 s to Mila in Stage 2." */
  line: string | null;
  rows: ResultsStageRow[];
}

/** The next unlock on the results card: a mountain by ghosts passed, else a sled by gifts. */
export type ResultsNextUnlock = { kind: 'mountain'; name: string; biome: MountainCard['biome']; have: number; need: number } | { kind: 'sled'; name: string; gifts: number };

export interface SettingsModel {
  master: number;
  music: number;
  sfx: number;
  quality: 'auto' | 'low' | 'medium' | 'high' | 'ultra';
  currentTier: 'low' | 'medium' | 'high' | 'ultra';
  /** Whether Ultra is offered (not on a touch device: absent reads as offered). */
  ultra?: boolean;
  hints: boolean;
  /** The gamepad's rumble. */
  rumble: boolean;
}

export interface UIHandlers {
  onRide(): void;
  onRunAgain(): void;
  onRevive(): void;
  onDouble(): void;
  onChallenge(): void;
  /** Watch your run (round 7): the highlight reel cut from the run's own record. */
  onWatchReel?(): void;
  /** Ride home as a spirit after a wreck (round 5): outside the race, to the finish town. */
  onRideHome?(): void;
  onHome(): void;
  onPause(paused: boolean): void;
  /** The lantern button (touch, or a click on it): a dash, if one is lit. */
  onSpirit?(): void;
  onSelectMountain(id: string): void;
  onDaily(): void;
  /** Select the weekly Cup. */
  onCup?(): void;
  onSelectSled(id: number): void;
  onBuySled(id: number): void;
  /** A sled paint: buy it (if not owned) and put it on. */
  onPaint?(id: string): void;
  /** A garage item (scarf, hat, trail or sled sound): buy it (if not owned) and wear it. */
  onGarage?(shelf: GarageShelfId, id: string): void;
  /** Round 8: light the next lantern of a finish town's Lantern Row (LanternTownView.next.id), for gifts. */
  onLightLantern?(id: string): void;
  /** Round 8: the results' secondary action: swap a mission held too long (ResultsSpine.swap.id). */
  onSwapMission?(id: string): void;
  /** Round 8: a beat of the results' sequence landed (ui/sequence.ts), for its sound: the rank bar starts a stretch of
   *  its fill, a page turns at the top, a card turns over (i its index), the one button comes forward. */
  onResultsBeat?(kind: 'fill' | 'page' | 'card' | 'button', i: number): void;
  /** Round 8: open the Almanac or the Spirit Album (the title's and the garage's way in). */
  onOpenAlmanac?(): void;
  onOpenAlbum?(): void;
  /** Round 8, the modes lane: the title's mirror toggle for the picked mountain, and an Almanac page's Ride (a mirror
   *  mountain, or the Long Night from its first leg). */
  onMirror?(on: boolean): void;
  onRideMode?(mode: { kind: 'night' } | { kind: 'mirror'; mountain: string }): void;
  /** Round 8 (the photo lane): photo mode, from pause or from the results while the scene stands. */
  onPhoto?(): void;
  /** A sled sound's Listen button: a few seconds of it under a carving rider, bought or not. */
  onListenSound?(id: string): void;
  onSettings(s: Partial<SettingsModel>): void;
  /** Any UI click/tap (for audio unlock and UI sounds). */
  onUiSound(kind: 'tap' | 'confirm' | 'back'): void;
  /**
   * A results reward has just landed in the wallet (the fly-in arrived, or the card skipped the flight
   * because the row or the wallet is scrolled out of view). `row` is the mission's index in
   * ResultsModel.missions. The app plays the coin here, so the sound follows the picture whichever
   * path the card took. Optional: without it the app keeps the coin on its own timeline.
   */
  onRewardLanded?(row: number): void;
  /**
   * A mission's Done stamp has just started on screen (its animation began with the row in view, or
   * at once under reduced motion). `row` is its index in ResultsModel.missions. The app plays the
   * mission chime here, so a row folded away or scrolled out of view makes no sound. Optional:
   * without it the app keeps the chimes on its own timeline.
   */
  onMissionStamp?(row: number): void;
}

/** A viewport rectangle in CSS px, top-left origin. */
export interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The avalanche rear-view mirror's rectangle in CSS px, top-left origin (contract C2). */
export interface MirrorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type StyleTone = 'normal' | 'big' | 'perfect' | 'lost' | 'best';
export type ToastTone = 'ghost' | 'mission' | 'gift' | 'warn' | 'info' | 'grudge' | 'finale' | 'unlock';
export type HintKind = 'steer' | 'crouch' | 'drift' | 'pop' | 'stomp' | 'draft' | 'spin' | 'flip' | 'boostPop' | 'dash' | 'flipSpin';

export interface GameUI {
  showTitle(m: TitleModel): void;
  hideTitle(): void;
  showHud(): void;
  hideHud(): void;
  updateHud(m: HudModel): void;
  /**
   * Trick callout. Lines sit under the combo meter ("Backflip +600"); a perfect landing is one hero
   * stamp beside the rider that folds in the same landing's tricks.
   */
  popStyle(label: string, points: number, mult: number, tone: StyleTone): void;
  /** Combo banked: big cash-in number. */
  comboBank(points: number, mult: number): void;
  toast(text: string, tone: ToastTone, sub?: string): void;
  /**
   * Every run-time named moment (src/game/beats.ts). Called once per frame when non-empty; never
   * retain the array (the director reuses it next frame).
   */
  beats(list: readonly Beat[]): void;
  /** You passed a ghost (passed=true) or a ghost passed you. */
  ghostPass(name: string, kind: GhostKind, passed: boolean): void;
  /** Slot-reel chaos reveal at run start. Never blocks gameplay; resolves when the card leaves. */
  reveal(m: RevealModel): Promise<void>;
  /** Telegraph banner for a mid-run event. */
  warn(text: string, event: ChaosEvent): void;
  /**
   * Onboarding hint. `learned` is true once the player has steered and drifted: the touch zone
   * outlines then fade out for good and only the labels remain.
   */
  hint(kind: HintKind | null, mode: InputMode, learned?: boolean): void;
  showResults(m: ResultsModel): void;
  /** Round 8: the Almanac and the Spirit Album (the screens lane builds them; optional until it does). */
  showAlmanac?(m: AlmanacModel): void;
  showAlbum?(m: AlbumModel): void;
  updateResults(m: ResultsModel): void;
  hideResults(): void;
  /** missions: the run's live mission progress, shown on the pause card (at most 3 rows). */
  showPause(settings: SettingsModel, missions?: MissionView[]): void;
  hidePause(): void;
  /** The garage: sleds, then (when given) paints and the round 6 shelves. */
  /** lanterns (round 8): the Lantern Row's towns, listed in the garage until the screens lane draws them. */
  showSleds(cards: SledCard[], wallet: number, paints?: PaintCard[], shelves?: GarageShelf[], lanterns?: LanternTownView[]): void;
  showSettings(m: SettingsModel): void;
  closeMenus(): void;
  touchVisual(v: TouchVisual, visible: boolean): void;
  /** Show the in-world landing ring helper text etc. Projected screen position of the rider. */
  setRiderScreen(x: number, y: number): void;
  setLoading(p: number | null): void;
  /**
   * Viewport rects (CSS px, top-left origin) of the visible HUD pills, callouts, banners and meters,
   * so the world can hide ghost name tags under them. Cached: re-measured only after the HUD layout
   * changes, never with a forced layout per call. The returned array is reused between calls.
   * Contract C8: every trick callout line and the perfect-landing stamp are in it for as long as they
   * are on screen (a line from the frame it pops until it starts to leave), so a ghost's name pill can hide
   * whenever it would sit on one.
   */
  occluders(): Array<{ x0: number; y0: number; x1: number; y1: number }>;
  /**
   * Where the avalanche rear-view mirror goes (contract C2): its rectangle in CSS px, top-left origin,
   * laid out by the HUD top-centre under the combo and callout slot, with the danger meter 6 px under
   * it. Null when no avalanche is chasing you (it is already out from the avalanche telegraph, and it
   * holds through the mirror's fade-out after the chase). Cached from the last layout; the object is
   * reused. In portrait the unit hangs right under the race row instead. Contract C9: the mirror sits
   * in its slot from the chase's first frame, with its AVALANCHE nameplate and the gap meter showing;
   * there is no opening enlargement. The renderer reads it every frame all the same (a resize or a
   * banner over the race row can move the unit). The unit hangs right under the race row in both
   * orientations; on a phone held upright the gap meter rides in the race row itself and the mirror
   * (about 25% smaller) hangs under it alone, so the rect is the mirror's own box either way.
   */
  mirrorRect(): { x: number; y: number; w: number; h: number } | null;
  /** True while any overlay that captures input is open. */
  readonly modal: boolean;
}

// ---------------------------------------------------------------- round 8: the spine (game/rank.ts and its systems)
// What the screens lane builds the results sequence, the Almanac, the title's flame and the album from. The game
// layer fills these (game/spineview.ts) from the save and the spine's settle; nothing here is computed by a screen.

/** A reward as its card shows it: what it is and where it came from (an Almanac page, or a chapter's). */
export interface RewardCard {
  kind: 'charm' | 'gate' | 'feature' | 'sled' | 'mirror' | 'hour' | 'flourish' | 'garage' | 'title' | 'gifts' | 'legs' | 'open';
  name: string;
  page: number;
  /** The chapter's month key ('2026-12') for a chapter page, else null. */
  chapter: string | null;
  /** A mirror's mountain id (its page rides it). */
  mountain?: string;
}

/** Rider Rank's bar: the page turned, the XP into the next and what it still needs, and the next page's rewards. */
export interface RankBarView {
  page: number;
  of: number;
  xp: number;
  into: number;
  need: number;
  /** The next page's rewards (null once page 50 is turned). */
  next: RewardCard[] | null;
  /** The title worn, if any. */
  title: string | null;
}

/** One tick of the bar on the results ("Mission +40"). */
export interface XpTickView {
  source: string;
  label: string;
  xp: number;
}

/** A sticker as its card shows it; `frame` when the save holds the run it came from (the reel can render it). */
export interface StickerCard {
  id: string;
  name: string;
  mountain: string;
  group: string;
  hint: string;
  frame: boolean;
  /** Round 8 (the photo lane): the frame kept from the run it happened in (an object URL), when one was kept. */
  img?: string;
}

/** The results' one primary button (game/goals.ts primaryButton). */
export interface PrimaryButtonView {
  kind: 'rematch' | 'mission' | 'duel' | 'daily' | 'again';
  text: string;
  /** The line under it ("12 m short", "Page 8: 60 to go"), or null. */
  sub: string | null;
  aria: string;
}

/** A contract's row. */
export interface ContractView {
  text: string;
  /** A named mountain's id, 'daily' or 'any'. */
  on: string;
  done: boolean;
  xp: number;
}

/** Keep the lantern lit: the title's flame and the seven-day calendar. */
export interface FlameView {
  streak: number;
  litToday: boolean;
  alive: boolean;
  /** Not ridden today, and the flame goes out (or spends the ember) if today passes without a run. */
  atRisk: boolean;
  ember: boolean;
  best: number;
  /** The calendar's seven days, which one is next, and what each pays. */
  calendar: Array<{ day: number; xp: number; gifts: number; ember: boolean }>;
  nextDay: number;
}

/** The Cup's league this week: your division, your place, the nineteen records (shown as records, never as live
 *  players) and how last week ended. */
export interface LeagueView {
  week: string;
  division: number;
  place: number | null;
  rows: Array<{ name: string; time: number; you?: boolean }>;
  last: { division: number; place: number | null; moved: number } | null;
}

/** This month's chapter: its pages and its set (on the garage's shelf for gifts too). */
export interface ChapterView {
  key: string;
  name: string;
  line: string;
  page: number;
  of: number;
  into: number;
  need: number;
  set: Array<{ id: string; shelf: string; name: string; price: number; owned: boolean }>;
  /** Earlier chapters not finished, which XP goes to once this one is done. */
  older: string[];
}

/** The spine's part of the results: the bar filling, what opened, the stickers, the flame, the contracts, the league
 *  and the one button. Each step of the sequence (V8, G5) reads one of these. */
export interface ResultsSpine {
  ticks: XpTickView[];
  before: RankBarView;
  after: RankBarView;
  opened: RewardCard[];
  stickers: StickerCard[];
  flame: { lit: boolean; streak: number; calendarDay: number; embered: boolean; emberEarned: boolean };
  contracts: { met: string[]; bonus: boolean; form: string | null; today: ContractView[]; formNext: ContractView | null };
  league: { place: number | null; was: number | null; division: number } | null;
  primary: PrimaryButtonView;
  /** A mission held too long, offered as a swap (a secondary action), or null. */
  swap: { id: string; text: string } | null;
}

/** The spine's part of the title. */
export interface TitleSpine {
  bar: RankBarView;
  flame: FlameView;
  contracts: ContractView[];
  form: ContractView | null;
  league: LeagueView | null;
  chapter: ChapterView | null;
  album: { got: number; of: number; byMountain: Record<string, { got: number; of: number }> } | null;
  /** One line of what is new today for a returning player, or null. */
  whatsNew: string | null;
  /** The Long Night's legs open and best depth, once it is open. */
  longNight: { legs: number; best: { legs: number; z: number } | null } | null;
  mirrors: string[];
  hours: string[];
  titles: string[];
  /** The Lantern Row, a town a mountain that is open. */
  lanterns: LanternTownView[];
}

/** The Lantern Row (game/lanterns.ts): one finish town's row of eight, as the title, the garage and the world read it.
 *  A look only, bought with gifts: nothing in it reaches a race. The world hangs exactly the lit ones, in row order
 *  from the first, in the town at the finish and on the mountain's title shot, marigold (the lantern's and the
 *  gifts' role, ART.md 1). */
export interface LanternTownView {
  mountain: string;
  town: string;
  lit: number;
  of: number;
  lanterns: Array<{ id: string; index: number; price: number; lit: boolean }>;
  /** The next to light, its price and whether the wallet holds it; null once the row is full. */
  next: { id: string; price: number; affordable: boolean } | null;
}

/** The Almanac's screen: every page, its state and rewards. */
export interface AlmanacModel {
  bar: RankBarView;
  pages: Array<{ n: number; state: 'opened' | 'turned' | 'next' | 'ahead'; rewards: RewardCard[] }>;
  chapter: ChapterView | null;
  /** Round 8, the modes lane: what the opened pages let you ride from here (only on the title): the Long Night (its
   *  legs and your deepest night in words) and the mirrors open, by mountain id. */
  modes?: { night: { legs: number; best: string | null } | null; mirrors: string[] };
}

/** The Spirit Album's screen: each mountain's stickers and the rest, held or a silhouette with where to find it. */
export interface AlbumModel {
  got: number;
  of: number;
  sections: Array<{ id: string; name: string; got: number; of: number; stickers: Array<StickerCard & { got: boolean }> }>;
}
