import { Ambience } from './ambience';
import { Bank, createBank } from './buffers';
import { Graph } from './graph';
import { Music } from './music';
import { Sfx } from './sfx';
import { VoicePool } from './voices';

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
  readonly music: Music;
  readonly sfx: Sfx;
  readonly ambience: Ambience;

  constructor(readonly ctx: BaseAudioContext) {
    this.bank = createBank(ctx);
    this.graph = new Graph(ctx, this.bank.impulse);
    this.sfxPool = new VoicePool(ctx, this.bank, SFX_VOICES);
    this.musicPool = new VoicePool(ctx, this.bank, MUSIC_VOICES);
    this.music = new Music(ctx, this.musicPool, this.graph.music);
    this.sfx = new Sfx(ctx, this.sfxPool, this.graph.sfx, () => this.music.key());
    this.ambience = new Ambience(ctx, this.bank, this.graph.sfx);
  }

  /** One scheduler pass: fill the music lookahead, build deferred effect parts, free finished
   *  voices, settle idle ambience. */
  tick(now: number, lookahead: number): void {
    this.music.tick(now, now + lookahead);
    this.sfx.flush(now);
    this.sfxPool.sweep(now);
    this.musicPool.sweep(now);
    this.ambience.watch(now);
  }

  dispose(): void {
    this.music.dispose();
    this.ambience.dispose();
    this.sfxPool.releaseAll();
    this.musicPool.releaseAll();
    this.graph.disconnect();
  }
}
