// Per-tick input and the compact input log.
//
// One byte per tick: bits 0-3 steer level (0..8, 4 = centre), bit 4 action held, bit 5 draft.
// The log stores runs of identical bytes as [value][varint run length]. Bytes >= 0x80 are event
// tokens that apply at the start of the tick that follows them.

/** Hard cap on run length (one hour of sim time). The recorder and decoder share it. */
export const MAX_RUN_TICKS = 60 * 60 * 60;
export const STEER_LEVELS = 9;
export const STEER_CENTER = 4;
export const ACTION_BIT = 1 << 4;
export const DRAFT_BIT = 1 << 5;

export enum LogEvent {
  Revive = 1,
}

export function packInput(steerLevel: number, action: boolean, draft: boolean): number {
  const s = steerLevel < 0 ? 0 : steerLevel > 8 ? 8 : steerLevel | 0;
  return s | (action ? ACTION_BIT : 0) | (draft ? DRAFT_BIT : 0);
}

export function steerOf(input: number): number {
  return ((input & 15) - STEER_CENTER) / STEER_CENTER;
}

export function actionOf(input: number): boolean {
  return (input & ACTION_BIT) !== 0;
}

export function draftOf(input: number): boolean {
  return (input & DRAFT_BIT) !== 0;
}

/** Records one input byte per tick and encodes it compactly. */
export class InputRecorder {
  private bytes: number[] = [];
  private runValue = -1;
  private runLength = 0;
  private ticks = 0;

  get tickCount(): number {
    return this.ticks;
  }

  push(input: number): void {
    const v = input & 0x3f;
    if (v === this.runValue) {
      this.runLength++;
    } else {
      this.flush();
      this.runValue = v;
      this.runLength = 1;
    }
    this.ticks++;
  }

  /** Event applied at the start of the next pushed tick. */
  event(code: LogEvent): void {
    this.flush();
    this.bytes.push(0x80 | code);
  }

  private flush(): void {
    if (this.runLength <= 0) return;
    this.bytes.push(this.runValue);
    writeVarint(this.bytes, this.runLength - 1);
    this.runValue = -1;
    this.runLength = 0;
  }

  encode(): Uint8Array {
    const out = this.bytes.slice();
    if (this.runLength > 0) {
      out.push(this.runValue);
      writeVarint(out, this.runLength - 1);
    }
    return Uint8Array.from(out);
  }
}

function writeVarint(out: number[], n: number): void {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

/** Decoded log: one input byte per tick plus the events that precede ticks. */
export interface DecodedLog {
  inputs: Uint8Array;
  /** Map from tick index to event codes applied at the start of that tick. */
  events: Map<number, LogEvent[]>;
}

export function decodeLog(data: Uint8Array, maxTicks = MAX_RUN_TICKS + 8): DecodedLog {
  const inputs: number[] = [];
  const events = new Map<number, LogEvent[]>();
  let i = 0;
  while (i < data.length) {
    const b = data[i++];
    if (b & 0x80) {
      const t = inputs.length;
      const list = events.get(t) ?? [];
      list.push((b & 0x7f) as LogEvent);
      events.set(t, list);
      continue;
    }
    let n = 0;
    let mul = 1;
    for (;;) {
      if (i >= data.length) throw new Error('input log truncated');
      const c = data[i++];
      n += (c & 0x7f) * mul;
      if ((c & 0x80) === 0) break;
      mul *= 128;
      if (mul > 268435456) throw new Error('input log varint overflow');
    }
    const len = n + 1;
    if (inputs.length + len > maxTicks) throw new Error('input log too long');
    for (let k = 0; k < len; k++) inputs.push(b);
  }
  return { inputs: Uint8Array.from(inputs), events };
}
