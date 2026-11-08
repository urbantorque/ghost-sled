import type { Beat } from '../game/beats';
import { Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { SimEvent } from '../sim/sim';
import { buildLift } from './cues';
import type { AudioEngine, AudioFrame } from './engine';
import type { SectionName } from './form';
import { SLED_SOUNDS, type SledSoundId } from './sledsounds';

// The jukebox (round 6, debug only: ?debug&jukebox). A panel over the title screen that plays any part of the
// score on demand, so the owner can hear it without riding for it: the main theme; each mountain's run music
// by stage and section (intro, verse, chorus with the hook, bridge), a drop, the lift into the last stage
// and the finish's finale; the results' reprise; every set piece's cue and the other cues pitched into the
// score. It drives the real engine with a synthetic frame (a cruise at the drive the slider sets) and
// synthetic beats, the same way the probes do. Loaded with a dynamic import from main.ts behind the debug
// switch, so the shipped game carries none of it.

type Engine = AudioEngine;

const MOUNTAINS: ReadonlyArray<{ biome: BiomeId; name: string }> = [
  { biome: 'alpine', name: 'Pinecrest' },
  { biome: 'glacier', name: 'Frostfang' },
  { biome: 'volcanic', name: 'Ember Peak' },
  { biome: 'blossom', name: 'Sakura Ridge' },
];

const MOODS: ReadonlyArray<{ mood: Mood; name: string }> = [
  { mood: Mood.None, name: 'Clear Skies' },
  { mood: Mood.Blizzard, name: 'Blizzard' },
  { mood: Mood.Lantern, name: 'Lantern Night' },
  { mood: Mood.GlassIce, name: 'Glass Ice' },
  { mood: Mood.Comet, name: 'Comet Night' },
  { mood: Mood.Haunted, name: 'Haunted Hollow' },
  { mood: Mood.Powder, name: 'Powder Day' },
];

const SECTIONS: ReadonlyArray<{ s: SectionName; name: string }> = [
  { s: 'intro', name: 'Intro' },
  { s: 'verse', name: 'Verse' },
  { s: 'chorus', name: 'Chorus (hook)' },
  { s: 'bridge', name: 'Bridge' },
];

const CSS = `
.gs-jb { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); color-scheme: dark; z-index: 2147483000; width: min(380px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px); overflow: auto; overscroll-behavior: contain; box-sizing: border-box;
  padding: 14px 14px 16px; border-radius: 18px; background: rgb(18 25 51 / 0.86);
  box-shadow: inset 0 0 0 1px rgb(245 243 255 / 0.14); color: #F5F3FF;
  font: 600 13px/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-variant-numeric: tabular-nums; }
.gs-jb h2 { margin: 0 0 2px; font-size: 15px; font-weight: 900; letter-spacing: 0.01em; text-wrap: balance; }
.gs-jb h3 { margin: 14px 0 6px; font-size: 13px; font-weight: 800; text-wrap: balance; }
.gs-jb p { margin: 0; color: rgb(245 243 255 / 0.72); font-weight: 600; }
.gs-jb .row { display: flex; flex-wrap: wrap; gap: 6px; }
.gs-jb button { appearance: none; border: 0; border-radius: 999px; padding: 6px 11px; min-height: 30px;
  background: transparent; color: #F5F3FF; box-shadow: inset 0 0 0 1px rgb(245 243 255 / 0.28);
  font: inherit; font-weight: 800; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.gs-jb button:active { transform: translateY(1px); }
.gs-jb button:hover { box-shadow: inset 0 0 0 1px rgb(245 243 255 / 0.6); }
.gs-jb button:focus-visible { outline: 2px solid #F5F3FF; outline-offset: 2px; }
.gs-jb button[aria-pressed='true'] { background: #F5F3FF; color: #121933; box-shadow: none; }
.gs-jb button.primary { background: #FF4D2E; color: #121933; box-shadow: none; }
.gs-jb .top { display: flex; align-items: start; justify-content: space-between; gap: 8px; }
.gs-jb label { display: grid; gap: 4px; margin-top: 10px; font-weight: 800; }
.gs-jb input[type=range] { width: 100%; accent-color: #F5F3FF; }
.gs-jb select { font: inherit; font-weight: 700; color: #F5F3FF; background: #121933; border-radius: 999px;
  border: 1px solid rgb(245 243 255 / 0.28); padding: 5px 10px; min-height: 30px; }
.gs-jb .now { margin-top: 10px; padding: 8px 10px; border-radius: 18px; background: rgb(245 243 255 / 0.06);
  color: rgb(245 243 255 / 0.86); min-height: 2.7em; }
.gs-jb.closed { width: auto; padding: 6px; }
.gs-jb.closed .body { display: none; }
`;

/** A frame for a steady cruise at drive `drive` on stage `stage` (the descent's lift added, as the engine
 *  adds it on a real run from the course). */
function cruise(drive: number, stage: number): AudioFrame {
  return {
    speed: 22,
    grounded: true,
    carve: 0.3,
    drifting: false,
    slip: 0,
    onIce: false,
    boostGlow: 0,
    drafting: false,
    comboChain: 0,
    comboMult: 1,
    intensity: Math.min(1, drive + buildLift(stage, 0)),
    danger: 0,
    crashed: false,
  };
}

const beat = <T extends Beat['type']>(b: Omit<Extract<Beat, { type: T }>, 'tick'> & { type: T }): Beat => ({ tick: 0, ...b }) as unknown as Beat;

export function openJukebox(app: unknown): void {
  const engine = (app as { audio?: Engine }).audio;
  if (!engine || document.querySelector('.gs-jb')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  let biome: BiomeId = 'alpine';
  let mood: Mood = Mood.None;
  let stage = 0;
  let drive = 0.36;
  let scene: 'title' | 'run' | 'results' | 'idle' = 'idle';
  let raf = 0;
  let muted = false;
  let last = 0;

  const el = document.createElement('section');
  el.className = 'gs-jb';
  el.setAttribute('aria-label', 'Jukebox');
  el.innerHTML = `
    <div class="top"><div><h2>Jukebox</h2><p>The score on demand. Debug builds only.</p></div>
      <button type="button" data-act="fold" aria-expanded="true">Hide</button></div>
    <div class="body">
      <h3>Title</h3>
      <div class="row"><button type="button" class="primary" data-act="title">Main Theme</button>
        <button type="button" data-act="results">Results Reprise</button>
        <button type="button" data-act="stop">Silence the Band</button></div>
      <h3>Mountain</h3>
      <div class="row" data-group="biome">${MOUNTAINS.map((m) => `<button type="button" data-biome="${m.biome}" aria-pressed="${m.biome === biome}">${m.name}</button>`).join('')}</div>
      <label>Mood<select name="mood" autocomplete="off" data-act="mood">${MOODS.map((m) => `<option value="${m.mood}">${m.name}</option>`).join('')}</select></label>
      <h3>Stage</h3>
      <div class="row" data-group="stage">${[0, 1, 2].map((s) => `<button type="button" data-stage="${s}" aria-pressed="${s === stage}">Stage ${s + 1}</button>`).join('')}</div>
      <h3>Run Music by Section</h3>
      <div class="row">${SECTIONS.map((s) => `<button type="button" data-sec="${s.s}">${s.name}</button>`).join('')}
        <button type="button" data-act="flow">Let It Flow</button></div>
      <h3>Landings</h3>
      <div class="row"><button type="button" data-land="drop">Build into a Drop</button>
        <button type="button" data-land="lift">Lift a Key</button>
        <button type="button" data-land="finish">Finish Line</button>
        <button type="button" data-act="breakdown">Break Down</button></div>
      <label>Drive <span data-out="drive">0.36</span><input type="range" name="drive" min="0" max="1" step="0.01" value="0.36" data-act="drive"></label>
      <h3>Set Pieces</h3>
      <div class="row"><button type="button" data-cue="enter">Card Call</button>
        <button type="button" data-cue="gates">Gates</button>
        <button type="button" data-cue="rings">Rings</button>
        <button type="button" data-cue="steps">Steps</button>
        <button type="button" data-cue="miss">A Miss</button>
        <button type="button" data-cue="lead">Race Lead</button>
        <button type="button" data-cue="trail">Race Trail</button>
        <button type="button" data-cue="close">Collapse Closing</button>
        <button type="button" data-cue="won">Won</button>
        <button type="button" data-cue="lost">Lost</button></div>
      <h3>Cues in the Score</h3>
      <div class="row"><button type="button" data-cue="lantern">Lantern Lit</button>
        <button type="button" data-cue="dash">Dash</button>
        <button type="button" data-cue="ward">Ward</button>
        <button type="button" data-cue="gate">Sky Gate</button>
        <button type="button" data-cue="pass">Pass</button>
        <button type="button" data-cue="stage">Stage Line</button></div>
      <label>Sled Sound<select name="sled" autocomplete="off" data-act="sled">${SLED_SOUNDS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label>
      <div class="now" aria-live="off" data-out="now">Press a button to start the audio.</div>
    </div>`;
  document.body.appendChild(el);

  const q = <T extends Element>(sel: string): T | null => el.querySelector<T>(sel);
  const press = (group: string, attr: string, val: string): void => {
    for (const b of el.querySelectorAll<HTMLButtonElement>(`[data-group="${group}"] button`)) b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val));
  };

  /** A run on the chosen mountain, mood and stage, driven by our own frames. */
  const startRun = (): void => {
    engine.unlock();
    if (scene !== 'run') {
      engine.setScene('run');
      engine.setMood(mood, biome);
      scene = 'run';
    }
    engine.debugMusic({ stage });
    if (!raf) {
      last = performance.now();
      const loop = (now: number): void => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (scene === 'run') engine.update(cruise(drive, stage), dt);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
  };

  const fire = (beats: Beat[], events: SimEvent[] = []): void => {
    engine.beats(beats);
    for (const e of events) engine.simEvent(e);
  };
  const later = (ms: number, fn: () => void): void => void window.setTimeout(fn, ms);
  const moment = (verb: string, phase: string, n = 1, of = 1): Beat => beat<'moment'>({ type: 'moment', key: 'jukebox', verb: verb as never, phase: phase as never, n, of });

  el.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'fold') {
      const closed = el.classList.toggle('closed');
      b.textContent = closed ? 'Show Jukebox' : 'Hide';
      b.setAttribute('aria-expanded', String(!closed));
      return;
    }
    if (act === 'title') {
      engine.unlock();
      engine.debugMusic(null);
      engine.setScene('title');
      engine.setMood(Mood.None, biome);
      scene = 'title';
      return;
    }
    if (act === 'results') {
      engine.unlock();
      engine.debugMusic(null);
      engine.setScene('results');
      engine.setMood(mood, biome);
      scene = 'results';
      return;
    }
    if (act === 'stop') {
      // The band silenced (the music slider at zero) until another button plays something.
      engine.setVolumes({ master: 1, music: 0, sfx: 0.8 });
      muted = true;
      return;
    }
    if (muted) {
      engine.setVolumes({ master: 1, music: 0.8, sfx: 0.8 });
      muted = false;
    }
    if (b.dataset.biome) {
      biome = b.dataset.biome as BiomeId;
      press('biome', 'data-biome', biome);
      if (scene === 'run') engine.setMood(mood, biome);
      else if (scene === 'title') engine.setMood(Mood.None, biome);
      return;
    }
    if (b.dataset.stage) {
      stage = Number(b.dataset.stage);
      press('stage', 'data-stage', String(stage));
      if (scene === 'run') engine.debugMusic({ stage });
      return;
    }
    if (b.dataset.sec) {
      startRun();
      engine.debugMusic({ stage, section: b.dataset.sec as SectionName });
      return;
    }
    if (act === 'flow') {
      startRun();
      engine.debugMusic({ stage });
      return;
    }
    if (b.dataset.land) {
      startRun();
      engine.debugMusic({ stage });
      const kind = b.dataset.land as 'drop' | 'lift' | 'finish';
      const t = engine.debugLand(kind === 'finish' ? 3.6 : 2.4, kind);
      if (kind === 'finish' && t !== null) {
        // The line crossed as the band lands its finale: the finish beat, a winner's.
        const ctx = engine.debugTap()?.ctx;
        const wait = ctx ? Math.max(0, (t - ctx.currentTime - 0.05) * 1000) : 3500;
        later(wait, () => fire([beat<'finish'>({ type: 'finish', bonus: 0, seconds: 120, rank: 1, of: 6 })]));
      }
      return;
    }
    if (act === 'breakdown') {
      startRun();
      fire([beat<'crash'>({ type: 'crash' } as never)]);
      return;
    }
    const cue = b.dataset.cue;
    if (!cue) return;
    startRun();
    switch (cue) {
      case 'enter':
        fire([beat<'marquee'>({ type: 'marquee', phase: 'enter', key: 'jukebox', name: 'The Jukebox', verb: 'gates', line: '', cam: 'low', light: null, side: 1, took: 0, total: 0, clean: true, won: false })]);
        break;
      case 'gates':
        for (let n = 1; n <= 6; n++) later((n - 1) * 1000, () => fire([moment('gates', 'step', n, 6)]));
        break;
      case 'rings':
        for (let n = 1; n <= 3; n++) later((n - 1) * 450, () => fire([moment('rings', 'step', n, 3)]));
        break;
      case 'steps':
        for (let n = 1; n <= 4; n++) later((n - 1) * 2000, () => fire([moment('steps', 'step', n, 4)]));
        break;
      case 'miss':
        fire([moment('gates', 'miss', 0, 6)]);
        break;
      case 'lead':
      case 'trail':
        fire([moment('race', cue)]);
        break;
      case 'close':
        fire([moment('collapse', 'close')]);
        break;
      case 'won':
      case 'lost':
        fire([moment('gates', cue, 6, 6)]);
        break;
      case 'lantern':
        fire([], [{ type: 'lantern', phase: 'lit', cells: 2 } as SimEvent]);
        break;
      case 'dash':
        fire([], [{ type: 'dash', phase: 'start', cells: 1 } as SimEvent]);
        later(1600, () => fire([], [{ type: 'dash', phase: 'end', cells: 1 } as SimEvent]));
        break;
      case 'ward':
        fire([], [{ type: 'ward', cause: 'tree', cells: 0 } as unknown as SimEvent]);
        break;
      case 'gate':
        fire([], [{ type: 'skyGate', id: 1, stage: 0 } as SimEvent]);
        break;
      case 'pass':
        fire([beat<'pass'>({ type: 'pass', ghost: { id: 7, name: 'Jukebox', kind: 'pool' as never, dx: 1.5 }, word: 'passed', text: '', first: false, chain: 1, ladder: 2, octave: false, gifts: 0, muted: false })]);
        break;
      case 'stage':
        fire([beat<'stage'>({ type: 'stage', index: 0, name: 'Stage line', last: false, seconds: 40, vsGhost: null, vsBest: null })]);
        break;
    }
  });

  el.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement | HTMLSelectElement;
    if (t.dataset.act === 'drive') {
      drive = Number(t.value);
      const out = q<HTMLElement>('[data-out="drive"]');
      if (out) out.textContent = drive.toFixed(2);
    } else if (t.dataset.act === 'mood') {
      mood = Number(t.value) as Mood;
      if (scene === 'run' || scene === 'results') engine.setMood(mood, biome);
    } else if (t.dataset.act === 'sled') engine.setSledSound(t.value as SledSoundId);
  });

  // What is playing, four times a second.
  const sections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Finale'];
  const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  window.setInterval(() => {
    const out = q<HTMLElement>('[data-out="now"]');
    if (!out || el.classList.contains('closed')) return;
    const lv = engine.debugLevels();
    if (!lv.running) return;
    const key = (engine as unknown as { core?: { music: { key(): { tonic: number; bpm: number } } } }).core?.music.key();
    const sec = sections[lv.section as number] ?? '';
    const land = (lv.landingIn as number) >= 0 ? `, drop in ${(lv.landingIn as number).toFixed(1)} s` : '';
    const text = `${scene === 'idle' ? 'Title screen' : scene[0].toUpperCase() + scene.slice(1)}: ${sec} bar ${(lv.bar as number) + 1} of ${lv.cycleBars}${land}. ${key ? `${NAMES[key.tonic % 12]}, ${key.bpm} bpm` : ''}. Drive ${(lv.drive as number).toFixed(2)}${muted ? ', band silenced' : ''}.`;
    if (out.textContent !== text) out.textContent = text;
  }, 250);
}
