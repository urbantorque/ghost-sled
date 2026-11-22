import type { PerspectiveCamera, Vector3 } from 'three';
import type { RunRecord } from '../sim/replay';
import type { Sim, SimEvent } from '../sim/sim';
import type { Course } from '../sim/course';
import type { Snap } from './run';
import type { GhostPose } from './ghosts';
import { IDLE_FEEL } from './beats';
import { ReelPlayer, ReelScanner, cutOnBars, planReel, type ReelRider, type ReelShot } from './reel';
import { ReelCam } from '../render/reelcam';
import { resetCine } from '../render/cine';
import { ReelUi } from '../ui/reelui';
import { reelCard, reelKicker } from '../ui/reelcopy';
import { clipCut } from './clip';
import type { ClipLook } from './cliptake';

// The reel as it plays (round 7): this file, the reel's lenses and its cards are one lazy chunk, loaded
// the first time a player asks to watch a run. It scans the record a slice a frame under an opening
// card, cuts the reel, then rides the record again: running on to each window under a dip to ink, and
// playing it with the shot's lens on. It owns nothing of the game's: the app hands it the world to draw
// in, the ghosts as they rode, and somewhere to send the sound, and takes the world back when it ends.

/** What the reel needs of the world (render/world.ts), and no more. */
export interface ReelWorld {
  course: Course;
  lens: ((camera: PerspectiveCamera, focus: Vector3, dir: Vector3, dt: number) => void) | null;
  beginRun(snap: Snap, event: number, sled: number): void;
  reelCut(snap: Snap): void;
  frame(v: {
    mode: 'run';
    labels: boolean;
    snap: Snap;
    dt: number;
    time: number;
    events: SimEvent[];
    collected: Set<number>;
    destroyed: Set<number>;
    sim: Sim;
    airTicks: number;
    ghostPoses: Map<number, GhostPose | null>;
    playerVisible: boolean;
    beats: readonly never[];
    feel: typeof IDLE_FEEL;
  }): void;
}

export interface ReelHost {
  record: RunRecord;
  /** The run's own ghosts, for the scan (none for a friend's link). */
  riders: readonly ReelRider[];
  world: ReelWorld;
  /** Where the cards go (.gs-ui). */
  root: HTMLElement;
  /** Fills the ghosts' poses at a tick of the race as it was ridden. */
  poses(tick: number, out: Map<number, GhostPose | null>): void;
  /** The frame's sound: the sim as it stands, the tick's events, and the seconds played. */
  sound(sim: Sim, events: readonly SimEvent[], dt: number): void;
  /** A UI click. */
  click(kind: 'tap' | 'back'): void;
  /** Seconds a bar of the score lasts, when the audio can say (the shots are whole bars long); else null. */
  bar(): number | null;
  /** Seconds until the score's next bar line and its next beat, when the audio can say (a cut waits for
   *  one); else null, and a cut falls as its card ends. */
  toLine?(): { toBar: number; toBeat: number } | null;
  /** The game's render clock: the reel draws on it and hands it back. */
  time(): number;
  setTime(t: number): void;
  reduced(): boolean;
  /** Your place over the line, for the finish card (null when the reel has no race to speak of). */
  rank: number | null;
  /** Sends the reel as a link (absent: no Share button). */
  share?: () => void;
  /** Round 8, G11: the reel plays to be saved as a clip (absent: it is only watched). */
  clip?: ReelClip;
  /** The reel has ended or been skipped: the app takes the picture back. */
  done(): void;
}

/** A reel played into a clip (game/cliptake.ts through the app). The clip is the reel's best shots (clip.ts clipCut);
 *  the reel says what it shows over the picture each frame, starts the recording at its first cut, and ends it after
 *  its last frame, or drops it when the player cancels. */
export interface ReelClip {
  look: ClipLook;
  /** The first cut: false where the browser will not record (the reel then ends, and the app says so). */
  start(): boolean;
  /** The last frame is in. */
  end(): void;
  /** The player cancelled (Cancel, or Escape). */
  cancel(): void;
}

/** Ticks of the record scanned or run on in one frame, and the wall time a frame may spend on it (ms). */
const SLICE_TICKS = 900;
const SLICE_MS = 7;
/** A card stands this long over the dip before its shot plays (s), and the opening card at least this. */
const CARD_S = 0.45;
/** A cut lands on the score: on the bar line when one comes within this long of the card's end (s), else on
 *  the next beat, and never held longer than CUT_HOLD_MAX for either. */
const CUT_BAR_REACH = 0.6;
const CUT_HOLD_MAX = 0.9;

/** How long a cut waits past its card to land on the score: to the bar line if it is near, else to the beat. */
export function cutHold(line: { toBar: number; toBeat: number } | null): number {
  if (!line) return 0;
  const { toBar, toBeat } = line;
  if (toBar >= 0 && toBar <= CUT_BAR_REACH) return toBar;
  return toBeat >= 0 && toBeat <= CUT_HOLD_MAX ? toBeat : 0;
}
const OPEN_S = 0.9;
/** The slow frame at a leap's apex: the reel's own clock eases to this, over these seconds round the apex. */
const SLOW_RATE = 0.28;
const SLOW_SPAN = 0.42;
/** The last frame's hold (s): a clip's is longer, for the run's card to be read. */
const END_S = 1.1;
const CLIP_END_S = 1.8;

type Stage = 'scan' | 'seek' | 'play' | 'end';

export class ReelShow {
  private readonly ui: ReelUi;
  private readonly cam: ReelCam;
  private readonly player: ReelPlayer;
  private scanner: ReelScanner | null;
  private shots: ReelShot[] = [];
  private stage: Stage = 'scan';
  private i = 0;
  private wait = 0;
  private paused = false;
  private over = false;
  private readonly posesNow = new Map<number, GhostPose | null>();
  private readonly none: SimEvent[] = [];

  constructor(private readonly host: ReelHost) {
    this.player = new ReelPlayer(host.record);
    this.scanner = new ReelScanner(host.record, host.riders);
    this.cam = new ReelCam(host.world.course);
    this.ui = new ReelUi(host.root, {
      onPause: () => this.setPaused(!this.paused),
      onReplay: () => this.replay(),
      onSkip: () => this.finish(false),
      onShare: host.clip ? undefined : host.share,
      sound: host.click,
      recording: !!host.clip,
    });
    this.ui.say(host.clip ? 'Your run, as a clip' : 'Your run, directed', host.clip ? 'Cutting the clip…' : 'Cutting the reel…');
    this.ui.cut(true);
    host.world.beginRun(this.player.view, host.record.chaos.event, host.record.sled);
    host.world.lens = this.cam.frame;
  }

  /** The shots, once cut (play-tests read them). */
  get plan(): readonly ReelShot[] {
    return this.shots;
  }

  /** Where the reel is (play-tests): its stage, the shot, and the seconds into it. */
  get now(): { stage: Stage; shot: number; t: number; paused: boolean } {
    const s = this.shots[this.i];
    return { stage: this.stage, shot: this.i, t: s ? (this.player.drawn - s.t0) / 60 : 0, paused: this.paused };
  }

  /** This cut has taken its wait for the score's line. */
  private lined = false;

  setPaused(on: boolean): void {
    // (A clip records the reel as it plays: it has no pause of its own; the game's pause holds the recording.)
    if (this.host.clip) return;
    this.paused = on;
    this.ui.paused(on);
  }

  /** From the top: the record runs again from its first tick. */
  replay(): void {
    if (this.stage === 'scan' || this.over || this.host.clip) return;
    this.setPaused(false);
    this.i = 0;
    this.begin();
  }

  /** The clip's recording has started (at the first cut). */
  private rolling = false;

  /** The reel is over: played to its end (`whole`) or skipped. A clip played whole is saved, one skipped is dropped. */
  private finish(whole: boolean): void {
    if (this.over) return;
    this.over = true;
    this.host.world.lens = null;
    resetCine();
    this.ui.dispose();
    const clip = this.host.clip;
    if (clip) {
      if (whole && this.rolling) clip.end();
      else clip.cancel();
    }
    this.host.done();
  }

  /** Sets the next shot up: its card over the dip, and the record running on to its first tick. */
  private begin(): void {
    const s = this.shots[this.i];
    if (!s) return this.finish(true);
    this.stage = 'seek';
    this.lined = false;
    this.wait = CARD_S;
    this.ui.cut(true);
    const kicker = reelKicker(s);
    const line = reelCard(s);
    this.ui.say(kicker, line);
    this.ui.progress(this.i, 0);
    const look = this.host.clip?.look;
    if (look) Object.assign(look, { dip: true, kicker, line, cardT: 0, shotT: -1, endT: -1 });
  }

  /** One frame. The app calls it in place of its own run frame while the reel is up. */
  frame(dt: number): void {
    if (this.over) return;
    const host = this.host;
    if (this.stage === 'scan') {
      // The scoring pass, a slice a frame, under the opening card.
      this.wait += dt;
      const sc = this.scanner!;
      const t0 = performance.now();
      let done = false;
      while (!(done = sc.step(SLICE_TICKS / 6)) && performance.now() - t0 < SLICE_MS);
      this.draw(0, this.none);
      if (done && this.wait >= OPEN_S) {
        const scan = sc.result();
        this.scanner = null;
        const bar = host.bar();
        // (A clip keeps the reel's best shots, a short cut a phone can share: clip.ts clipCut.)
        const plan = planReel(scan);
        this.shots = cutOnBars(host.clip ? clipCut(plan) : plan, bar ? Math.round(bar * 60) : 0);
        for (const s of this.shots) if (s.kind === 'finish' && host.rank) s.rank = host.rank;
        this.ui.setShots(this.shots.map((s) => s.t1 - s.t0));
        this.i = 0;
        this.begin();
      }
      return;
    }
    const look = host.clip?.look;
    if (this.stage === 'end') return this.hold(dt);
    const s = this.shots[this.i];
    if (!s) return this.finish(true);
    if (look) look.cardT += this.paused ? 0 : dt;
    if (this.stage === 'seek') {
      if (!this.paused) this.wait -= dt;
      const t0 = performance.now();
      let there = false;
      while (!(there = this.player.seek(s.t0, SLICE_TICKS / 6)) && performance.now() - t0 < SLICE_MS);
      if (there && this.wait <= 0 && !this.lined) {
        // The card has stood and the record is there: the cut now waits for the score's line (once).
        this.lined = true;
        this.wait = this.paused ? 0 : cutHold(host.toLine?.() ?? null);
      }
      if (there && this.wait <= 0) {
        // The cut: the world is made fresh where the window opens, and the lens set down.
        host.world.reelCut(this.player.view);
        this.cam.cut();
        this.stage = 'play';
        this.ui.cut(false);
        if (look) {
          look.dip = false;
          look.shotT = 0;
        }
        // A clip starts recording on its first cut, so it opens on the picture, not on ink.
        if (host.clip && !this.rolling) {
          if (!host.clip.start()) return this.finish(false);
          this.rolling = true;
          this.ui.recording('on');
        }
      }
      this.lensFor(s, 1);
      this.draw(0, this.none);
      return;
    }
    if (this.stage === 'play') {
      const reduced = host.reduced();
      // The slow frame: round a leap's apex the reel's own clock eases down, and the flight hangs.
      let rate = 1;
      if (s.kind === 'leap' && s.cam === 'orbit' && !reduced) {
        const d = Math.abs(this.player.drawn - s.peak) / 60;
        const k = d >= SLOW_SPAN ? 0 : 1 - d / SLOW_SPAN;
        rate = 1 - (1 - SLOW_RATE) * k * k * (3 - 2 * k);
      }
      const step = this.paused ? 0 : dt * rate;
      const more = this.paused ? true : this.player.advance(step);
      this.lensFor(s, rate);
      this.draw(step, this.paused ? this.none : this.player.events);
      if (!this.paused) host.sound(this.player.sim, this.player.events, step);
      this.ui.progress(this.i, (this.player.drawn - s.t0) / Math.max(1, s.t1 - s.t0));
      if (look) look.shotT += dt;
      if (!more || this.player.drawn >= s.t1) {
        this.i++;
        if (this.i >= this.shots.length) {
          // The last frame holds a moment, then the results come back (a clip's a little longer, under the run's card).
          this.stage = 'end';
          this.wait = host.clip ? CLIP_END_S : END_S;
          if (look) look.endT = 0;
        } else this.begin();
      }
      return;
    }
  }

  /** The end: the last frame held. (Round 8: it was reached only past the last shot, where the frame's first look
   *  for a shot ended the reel at once; it now holds, as it says, and a clip's last second carries the run's card.) */
  private hold(dt: number): void {
    const look = this.host.clip?.look;
    this.wait -= this.paused ? 0 : dt;
    if (look) look.endT += this.paused ? 0 : dt;
    this.lensFor(this.shots[this.shots.length - 1], 1);
    this.draw(0, this.none);
    if (this.wait <= 0) this.finish(true);
  }

  private lensFor(s: ReelShot, rate: number): void {
    this.cam.reduced = this.host.reduced();
    this.cam.tall = window.innerWidth < window.innerHeight;
    this.cam.shot = { cam: s.cam, side: s.side, t: (this.player.drawn - s.t0) / 60, len: (s.t1 - s.t0) / 60, peak: (s.peak - s.t0) / 60, slow: rate };
  }

  private draw(dt: number, events: SimEvent[]): void {
    const host = this.host;
    const p = this.player;
    host.poses(Math.max(0, p.drawn), this.posesNow);
    host.setTime(host.time() + dt);
    host.world.frame({
      mode: 'run',
      // The riders' names stay on in the reel: a pass reads by who was passed.
      labels: this.stage === 'play',
      snap: p.view,
      dt,
      time: host.time(),
      events,
      collected: p.sim.collected,
      destroyed: p.sim.destroyed,
      sim: p.sim,
      airTicks: p.airTicks,
      ghostPoses: this.posesNow,
      playerVisible: true,
      beats: [],
      feel: host.reduced() ? { ...IDLE_FEEL, reduced: true } : IDLE_FEEL,
    });
  }
}
