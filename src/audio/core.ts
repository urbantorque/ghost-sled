import { Ambience } from './ambience';
import { Bank, createBank } from './buffers';
import { Graph } from './graph';
import { Music } from './music';
import { Prerender } from './prerender';
import { Sfx } from './sfx';
import { NodeReserve, VoicePool } from './voices';

/** Simultaneous one-shot sound effects; the oldest is stolen past this. */
export const SFX_VOICES = 24;
/** Music notes have their own pool so effects never steal the soundtrack (or the reverse). */
export const MUSIC_VOICES = 32;

/** Everything that lives on one AudioContext. It holds no timers or globals, so the same code can
 *  be driven by the real-time scheduler or stepped through an OfflineAudioContext. */
export class Core {
  readonly bank: Bank;
  readonly graph: Graph;
  readonly sfxPool: VoicePool;
  readonly musicPool: VoicePool;
  /** Nodes made ahead in the scheduler pass for both pools' voices (voices.ts NodeReserve). */
  readonly reserve: NodeReserve;
  /** Fixed one-shots rendered once and played as one source (prerender.ts). */
  readonly renders: Prerender;
  readonly music: Music;
  readonly sfx: Sfx;
  readonly ambience: Ambience;
  /** Grid pulses the scheduler keeps in time with the band: the fuse on a draining stake and the
   *  duel heartbeat (0..1 each; set every frame by the engine). */
  readonly pulse = { fuse: 0, duel: 0 };

  constructor(readonly ctx: BaseAudioContext) {
    this.bank = createBank(ctx);
    this.graph = new Graph(ctx, this.bank.impulse);
    this.reserve = new NodeReserve(ctx);
    this.renders = new Prerender(ctx, this.bank);
    this.sfxPool = new VoicePool(ctx, this.bank, SFX_VOICES, this.reserve);
    this.musicPool = new VoicePool(ctx, this.bank, MUSIC_VOICES, this.reserve);
    this.music = new Music(ctx, this.musicPool, this.graph.music);
    this.sfx = new Sfx(ctx, this.sfxPool, this.graph.sfx, () => this.music.key(), this.graph.music);
    this.sfx.renders = this.renders;
    this.ambience = new Ambience(ctx, this.bank, this.graph.sfx);
    this.sfx.bed = (t, hold, depth) => this.ambience.dip(t, hold, depth);
  }

  /** One scheduler pass: fill the music lookahead, place grid pulses, build deferred effect parts,
   *  free finished voices, settle idle ambience, start a take's render. */
  tick(now: number, lookahead: number): void {
    this.music.tick(now, now + lookahead);
    this.sfx.pulses(now, now + lookahead, this.music.grid(), this.pulse.fuse, this.pulse.duel);
    this.sfx.flush(now);
    this.sfxPool.sweep(now);
    this.musicPool.sweep(now);
    this.ambience.watch(now);
    // Between frames: the nodes the next frame's effects will take, and a take asked for meanwhile.
    this.reserve.refill();
    this.renders.pump();
  }

  dispose(): void {
    this.renders.dispose();
    this.music.dispose();
    this.ambience.dispose();
    this.sfxPool.releaseAll();
    this.musicPool.releaseAll();
    this.graph.disconnect();
  }
}
