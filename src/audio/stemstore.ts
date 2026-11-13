import type { StemManifest, StemPiece } from './stemform';

// The produced score's files at runtime (round 7): which packs to fetch, when, and what of them is
// decoded. Nothing here runs before the first frame, and nothing blocks a run: a pack that is not there
// (still loading, a failed fetch, a browser that decodes neither format) leaves `ready` false and the live
// band plays as before.
//
// - The format is chosen once by decoding two tiny probe files (a click in silence): Opus in WebM first,
//   AAC in .m4a if that fails. Where the click comes out says how many samples that browser's decoder
//   leaves in front (or trims), and every start is corrected by it, so sections stay on the grid.
// - The tier: 'full' (every layer, at the context's rate) on a desktop on Medium or better; 'lite' (two
//   layers a section, decoded at 32 kHz, a third less memory) on Low and on phones. Without Opus the lite
//   AAC pack is used on every tier.
// - A pack is one file per piece: fetched once (the title's a moment after the first frame, a course's
//   when the course is picked), kept in the Cache API where there is one, and held in memory compressed.
//   Audio is decoded an item at a time (a section's layer, a one-shot) as the deck asks for it, and
//   dropped when the deck no longer lists it: decoded PCM is the dear part (a 20 s stereo layer is 7.7 MB
//   at 48 kHz), compressed bytes are not.

type Format = 'webm' | 'm4a';
export type StemTier = 'full' | 'lite';

interface Pack {
  state: 'loading' | 'ready' | 'failed';
  /** Decoded at the lite tier's rate. */
  lite: boolean;
  failedAt: number;
  bytes: ArrayBuffer | null;
  /** Where the files start in `bytes`. */
  base: number;
  items: Record<string, [number, number, number]>;
  decoded: Map<string, AudioBuffer>;
  decoding: Map<string, Promise<void>>;
  promise: Promise<boolean>;
}

const CACHE = 'gs-music-1';
/** A pack whose fetch failed is asked for again after this long (ms). */
const RETRY_MS = 20000;
const LITE_RATE = 32000;

type DecodeCtx = { decodeAudioData(data: ArrayBuffer, ok?: (b: AudioBuffer) => void, err?: (e: unknown) => void): Promise<AudioBuffer> | void; sampleRate: number };

/** decodeAudioData as a promise on every browser (old WebKit only takes callbacks). */
function decode(ctx: DecodeCtx, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((res, rej) => {
    try {
      const p = ctx.decodeAudioData(data, res, rej);
      if (p && typeof (p as Promise<AudioBuffer>).then === 'function') (p as Promise<AudioBuffer>).then(res, rej);
    } catch (e) {
      rej(e);
    }
  });
}

export function parsePack(bytes: ArrayBuffer): { base: number; version: string; items: Record<string, [number, number, number]> } | null {
  if (bytes.byteLength < 12) return null;
  const v = new DataView(bytes);
  if (v.getUint32(0, false) !== 0x47534d31) return null;
  const n = v.getUint32(4, true);
  if (8 + n > bytes.byteLength) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 8, n))) as { version: string; items: Record<string, [number, number, number]> };
    return { base: 8 + n, version: head.version, items: head.items };
  } catch {
    return null;
  }
}

/** A phone, as far as the music cares: a coarse pointer and a small screen, or little memory. */
function phoneLike(): boolean {
  try {
    const g = globalThis as unknown as { matchMedia?: (q: string) => { matches: boolean }; screen?: { width: number; height: number }; navigator?: { deviceMemory?: number } };
    const coarse = g.matchMedia ? g.matchMedia('(pointer: coarse)').matches : false;
    const small = g.screen ? Math.min(g.screen.width, g.screen.height) < 700 : false;
    const mem = g.navigator?.deviceMemory;
    return (coarse && small) || (typeof mem === 'number' && mem <= 4);
  } catch {
    return false;
  }
}

export class StemStore {
  /** The format this browser decodes, once the probes have run (null: neither, or not known yet). */
  format: Format | null = null;
  /** Seconds the decoder leaves in front of a file's first sample (negative: it trims that much). */
  align = 0;
  /** The decode test is over (whatever it found). */
  probed = false;
  /** Decoded audio held now and at most, bytes. */
  held = 0;
  peak = 0;
  /** Bytes fetched over the network this session (not from the cache), and packs read from the cache. */
  fetched = 0;
  cacheHits = 0;
  private low = false;
  private readonly phone = phoneLike();
  private readonly packs = new Map<string, Pack>();
  private probing: Promise<void> | null = null;
  private rate = 48000;
  private off: DecodeCtx | null = null;
  private offRate = 0;
  private disposed = false;
  private readonly claims = new Map<string, { pack: Pack; names: Set<string> }>();

  constructor(
    readonly manifest: StemManifest,
    /** Where public/music is served from, with its trailing slash. */
    private readonly base: string,
  ) {}

  piece(id: string): StemPiece | null {
    return this.manifest.pieces[id] ?? null;
  }

  /** The render tier ('low' hears the lite packs). */
  setQuality(tier: string): void {
    this.low = tier === 'low';
  }

  /** The live context's sample rate, so full-tier audio is decoded at it and plays without resampling. */
  setRate(rate: number): void {
    if (Number.isFinite(rate) && rate >= 8000) this.rate = rate;
  }

  get tier(): StemTier {
    return this.low || this.phone || this.format === 'm4a' ? 'lite' : 'full';
  }

  /** A piece keeps the pack it was first asked for in: a tier that changes mid-run (the game dropping to
   *  Low) never leaves a playing deck without its audio. The next piece asked for takes the new tier. */
  private readonly keys = new Map<string, string>();
  /** Loads asked for before the decode test was over, by piece. */
  private readonly asked = new Map<string, Promise<boolean>>();

  private key(piece: string): string {
    return this.keys.get(piece) ?? `${piece}.${this.tier}.${this.format ?? 'webm'}`;
  }

  private url(piece: string): string {
    return `${this.base}${this.key(piece)}.bin`;
  }

  /** An offline context to decode in: no gesture needed, and the lite tier's lower rate. */
  private decoder(lite = this.tier === 'lite'): DecodeCtx | null {
    const want = lite ? LITE_RATE : this.rate;
    if (this.off && this.offRate === want) return this.off;
    const g = globalThis as unknown as { OfflineAudioContext?: new (ch: number, len: number, rate: number) => DecodeCtx; webkitOfflineAudioContext?: new (ch: number, len: number, rate: number) => DecodeCtx };
    const Ctor = g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
    if (!Ctor) return null;
    for (const r of [want, this.rate, 44100]) {
      try {
        this.off = new Ctor(2, 1, r);
        this.offRate = want;
        return this.off;
      } catch {
        // A rate this browser will not make a context at: try the next.
      }
    }
    return null;
  }

  /** The decode test: which format, and its offset. Runs once; safe to call again. */
  probe(): Promise<void> {
    if (this.probing) return this.probing;
    this.probing = (async () => {
      for (const f of ['webm', 'm4a'] as const) {
        try {
          const ctx = this.decoder();
          if (!ctx) break;
          const res = await fetch(`${this.base}probe.${f}`);
          if (!res.ok) continue;
          const buf = await decode(ctx, await res.arrayBuffer());
          const d = buf.getChannelData(0);
          let at = -1;
          let pk = 0;
          for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > pk) {
              pk = a;
              at = i;
            }
          }
          const off = at / buf.sampleRate - this.manifest.probe.click / this.manifest.rate;
          if (pk < 0.05 || Math.abs(off) > 0.12) continue;
          this.format = f;
          this.align = Math.abs(off) < 0.0002 ? 0 : off;
          break;
        } catch {
          // This format does not decode here: the next one.
        }
      }
      this.probed = true;
    })();
    return this.probing;
  }

  /** Fetches a piece's pack (from the cache when it is there). Resolves true once it can be decoded from. */
  load(piece: string): Promise<boolean> {
    if (this.disposed || !this.manifest.pieces[piece]) return Promise.resolve(false);
    const k0 = this.probed ? this.key(piece) : null;
    const have = k0 ? this.packs.get(k0) : undefined;
    // (A fetch that failed is tried again after a while: the connection may be back.)
    if (have && !(have.state === 'failed' && this.format && Date.now() - have.failedAt > RETRY_MS)) return have.promise;
    if (have && k0) this.packs.delete(k0);
    const early = this.asked.get(piece);
    if (!k0 && early) return early;
    const pack: Pack = { state: 'loading', lite: false, failedAt: 0, bytes: null, base: 0, items: {}, decoded: new Map(), decoding: new Map(), promise: Promise.resolve(false) };
    pack.promise = (async (): Promise<boolean> => {
      await this.probe();
      if (!this.format) {
        pack.state = 'failed';
        return false;
      }
      const k = this.key(piece);
      const again = this.packs.get(k);
      if (again && again !== pack) return again.promise;
      this.keys.set(piece, k);
      pack.lite = k.includes('.lite.');
      this.packs.set(k, pack);
      try {
        const bytes = await this.read(this.url(piece));
        const p = bytes ? parsePack(bytes) : null;
        if (!bytes || !p) throw new Error('bad pack');
        pack.bytes = bytes;
        pack.base = p.base;
        pack.items = p.items;
        pack.state = 'ready';
        return true;
      } catch {
        pack.state = 'failed';
        pack.failedAt = Date.now();
        return false;
      }
    })();
    if (!k0) this.asked.set(piece, pack.promise);
    if (k0) this.packs.set(k0, pack);
    return pack.promise;
  }

  private async read(url: string): Promise<ArrayBuffer | null> {
    const g = globalThis as unknown as { caches?: CacheStorage };
    let cache: Cache | null = null;
    try {
      cache = g.caches ? await g.caches.open(CACHE) : null;
      const hit = cache ? await cache.match(url) : undefined;
      if (hit) {
        const b = await hit.arrayBuffer();
        // A pack from another build of the score is thrown away and fetched again.
        if (parsePack(b)?.version === this.manifest.version) {
          this.cacheHits++;
          return b;
        }
        await cache?.delete(url);
      }
    } catch {
      cache = null;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const copy = cache ? res.clone() : null;
    const b = await res.arrayBuffer();
    this.fetched += b.byteLength;
    if (cache && copy) cache.put(url, copy).catch(() => undefined);
    return b;
  }

  private pack(piece: string): Pack | null {
    if (!this.probed || !this.format) return null;
    const p = this.packs.get(this.key(piece));
    return p && p.state === 'ready' ? p : null;
  }

  /** 'ready' (its pack is in memory), 'loading', 'failed', or 'none' (never asked for, or no format). */
  state(piece: string): 'none' | 'loading' | 'ready' | 'failed' {
    if (!this.probed) return this.probing ? 'loading' : 'none';
    if (!this.format) return 'failed';
    return this.packs.get(this.key(piece))?.state ?? 'none';
  }

  /** The layers a section ships in on this tier (the pack's own index says). */
  layersOf(piece: string, section: string): string[] {
    const p = this.pack(piece);
    if (!p) return [];
    const out: string[] = [];
    for (const k of Object.keys(p.items)) if (k.startsWith(`${section}.`)) out.push(k.slice(section.length + 1));
    return out;
  }

  /** A decoded item (`section.layer`, or a one-shot's id), or null. */
  buffer(piece: string, name: string): AudioBuffer | null {
    return this.pack(piece)?.decoded.get(name) ?? null;
  }

  /** Every layer of a section is decoded. */
  sectionReady(piece: string, section: string): boolean {
    const p = this.pack(piece);
    if (!p) return false;
    const ls = this.layersOf(piece, section);
    return ls.length > 0 && ls.every((l) => p.decoded.has(`${section}.${l}`));
  }

  /**
   * What an owner (a deck, or the engine getting the next piece ready) wants decoded now: these sections
   * of a piece (all their layers) and these one-shots. Each owner's claim replaces its last; whatever no
   * owner claims is dropped, so two decks crossing over (a run's finale under its results' reprise) never
   * throw each other's audio away.
   */
  claim(owner: string, piece: string, sections: readonly string[], shots: readonly string[] = []): void {
    const p = this.pack(piece);
    if (!p) return;
    const names = new Set<string>(shots);
    for (const s of sections) for (const l of this.layersOf(piece, s)) names.add(`${s}.${l}`);
    const was = this.claims.get(owner);
    let same = was !== undefined && was.pack === p && was.names.size === names.size;
    if (same && was) for (const n of names) if (!was.names.has(n)) same = false;
    if (same) return;
    this.claims.set(owner, { pack: p, names });
    this.settle();
  }

  /** An owner is done (its deck is gone): what only it held is dropped. */
  release(owner: string): void {
    if (this.claims.delete(owner)) this.settle();
  }

  private settle(): void {
    for (const p of this.packs.values()) {
      for (const [k, b] of p.decoded) {
        let held = false;
        for (const c of this.claims.values()) if (c.pack === p && c.names.has(k)) held = true;
        if (held) continue;
        p.decoded.delete(k);
        this.held -= b.length * b.numberOfChannels * 4;
      }
    }
    for (const c of this.claims.values()) for (const n of c.names) this.decodeItem(c.pack, n);
  }

  private drop(p: Pack): void {
    for (const b of p.decoded.values()) this.held -= b.length * b.numberOfChannels * 4;
    p.decoded.clear();
  }

  private decodeItem(p: Pack, name: string): void {
    if (p.decoded.has(name) || p.decoding.has(name) || !p.bytes) return;
    const it = p.items[name];
    const ctx = this.decoder(p.lite);
    if (!it || !ctx) return;
    const slice = p.bytes.slice(p.base + it[0], p.base + it[0] + it[1]);
    const job = decode(ctx, slice)
      .then((b) => {
        if (this.disposed) return;
        let wanted = false;
        for (const c of this.claims.values()) if (c.pack === p && c.names.has(name)) wanted = true;
        if (!wanted) return;
        p.decoded.set(name, b);
        this.held += b.length * b.numberOfChannels * 4;
        if (this.held > this.peak) this.peak = this.held;
      })
      .catch(() => undefined)
      .then(() => void p.decoding.delete(name));
    p.decoding.set(name, job);
  }

  /** Something asked for of this piece is still being decoded. */
  busy(piece: string): boolean {
    const p = this.pack(piece);
    return p ? p.decoding.size > 0 : false;
  }

  /** Probe: what is held, per pack. */
  debug(): Record<string, unknown> {
    const packs: Record<string, unknown> = {};
    for (const [k, p] of this.packs) packs[k] = { state: p.state, bytes: p.bytes?.byteLength ?? 0, decoded: [...p.decoded.keys()], decoding: p.decoding.size };
    return { format: this.format, align: this.align, tier: this.tier, heldMB: Math.round(this.held / 104857.6) / 10, peakMB: Math.round(this.peak / 104857.6) / 10, fetched: this.fetched, cacheHits: this.cacheHits, packs };
  }

  dispose(): void {
    this.disposed = true;
    this.claims.clear();
    for (const p of this.packs.values()) this.drop(p);
    this.packs.clear();
  }
}
