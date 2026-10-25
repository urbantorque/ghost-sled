/// <reference lib="webworker" />
import { generatePool } from '../bot/pool';
import { recordFromString, replayRecord } from '../sim/replay';
import {
  F_AIRPITCH,
  F_AIRYAW,
  F_CARVE,
  F_FLAGS,
  F_HEADING,
  F_LEAN,
  F_SPEED,
  F_X,
  F_Y,
  F_Z,
  FLAG_CRASHED,
  FLAG_DRIFTING,
  FLAG_GROUNDED,
  FRAME_STRIDE,
  SAMPLE_EVERY,
  WorkerIn,
  WorkerOut,
} from '../game/ghostdata';

// Replays ghost runs through the real Sim off the main thread and streams back compact
// trajectories. Also runs the bot to generate the Daily Mountain's fresh rivals.

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerOut, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function replay(id: number, recordStr: string): void {
  try {
    const rec = recordFromString(recordStr);
    const cap = Math.ceil((rec.ticks + 4) / SAMPLE_EVERY) + 2;
    let frames = new Float32Array(cap * FRAME_STRIDE);
    let n = 0;
    const tricks: number[] = [];
    let crashTick = -1;
    const sim = replayRecord(rec, (s) => {
      for (const e of s.events) {
        if (e.type === 'land' && (e.quality === 'perfect' || e.halfTurns > 0 || e.flips > 0)) {
          tricks.push(s.tick, e.quality === 'perfect' ? 1 : e.quality === 'sketchy' ? 2 : 0, e.halfTurns, e.flips);
        }
        if (e.type === 'crash' && crashTick < 0) crashTick = s.tick;
      }
      if (s.tick % SAMPLE_EVERY !== 0) return;
      if ((n + 1) * FRAME_STRIDE > frames.length) {
        const grown = new Float32Array(frames.length * 2);
        grown.set(frames);
        frames = grown;
      }
      const st = s.s;
      const o = n * FRAME_STRIDE;
      frames[o + F_X] = st.x;
      frames[o + F_Y] = st.y;
      frames[o + F_Z] = st.z;
      frames[o + F_HEADING] = st.heading;
      frames[o + F_AIRYAW] = st.airYaw;
      frames[o + F_AIRPITCH] = st.airPitch;
      frames[o + F_LEAN] = st.lean;
      frames[o + F_SPEED] = st.speed;
      frames[o + F_FLAGS] = (st.grounded ? FLAG_GROUNDED : 0) | (st.drifting ? FLAG_DRIFTING : 0) | (st.crashed ? FLAG_CRASHED : 0);
      frames[o + F_CARVE] = st.carve;
      n++;
    });
    const out = frames.slice(0, n * FRAME_STRIDE);
    const tr = Int32Array.from(tricks);
    post(
      {
        type: 'trajectory',
        id,
        frames: out,
        samples: n,
        ticks: sim.tick,
        crashTick: crashTick >= 0 ? crashTick : sim.s.crashed ? sim.s.crashTick : -1,
        score: sim.score,
        distance: sim.distance,
        tricks: tr,
      },
      [out.buffer, tr.buffer],
    );
  } catch (err) {
    post({ type: 'error', id, message: String(err) });
  }
}

ctx.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type === 'replay') {
    for (const job of msg.jobs) replay(job.id, job.record);
  } else if (msg.type === 'pool') {
    try {
      const ghosts = generatePool(msg.seed, msg.count, msg.salt, { budgetRuns: msg.budgetRuns, maxTicks: msg.maxTicks });
      post({ type: 'pool', reqId: msg.reqId, ghosts });
    } catch (err) {
      post({ type: 'error', id: -msg.reqId, message: String(err) });
    }
  }
};
