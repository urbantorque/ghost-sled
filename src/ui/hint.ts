import type { HintKind } from './contract';
import type { InputMode } from '../game/input';
import { h, kbd, kbdIcon } from './dom';
import { icon } from './icons';
import { play } from './motion';

// Contextual onboarding along the bottom. Keyboard and mouse get a pill with control glyphs, seated
// just above the bottom safe area (never on the corridor under the sled); touch gets the two real
// input zones drawn on screen (left 60% drag, right 40% hold), each glyph on an ink disc and each
// label on an ink pill. A zone's soft ink pool goes after its first successful use (the steer zone's
// once you have steered, the hold zone's once you have drifted), and for good once both are learned.

const TEXT: Record<HintKind, string> = {
  steer: 'Steer',
  crouch: 'Hold to crouch',
  drift: 'Hold while turning to drift',
  pop: 'Release to pop',
  // The landing ring closes as you come down (the stomp ticks count it in by ear): the words name what
  // you see, so they hold with the sound off.
  stomp: 'Tap as the ring closes',
  draft: 'Tuck in behind a ghost',
  // Taught as players reach them (teach-moves): a spin is steering in the air, so it shows the steer
  // keys (the mouse sweep, the left zone); a flip and the boosted pop are holds, so they show the hold.
  spin: 'Steer in the air to spin',
  flip: 'Press and hold in the air to flip',
  boostPop: 'Hold, then let go at the lip',
};

export class Hint {
  readonly el: HTMLElement;
  /** Called when a hint comes or goes (the occluder cache). */
  onLayout: () => void = () => undefined;
  private key = '';
  private zones: HTMLElement | null = null;
  private learned = false;
  private occ: Element[] = [];

  constructor(parent: HTMLElement) {
    this.el = h('div', 'gs-hintlayer');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    parent.append(this.el);
  }

  /** The visible hint's pill, or the zone glyphs and labels, for the occluder cache. */
  occluders(): readonly Element[] {
    return this.occ;
  }

  set(kind: HintKind | null, mode: InputMode, learned = this.learned): void {
    const key = kind ? `${kind}:${mode}` : '';
    const wasLearned = this.learned;
    this.learned = learned;
    if (key === this.key) {
      // Learned while the zones are up: their pools fade out where they are.
      if (learned && !wasLearned && this.zones) this.zones.classList.add('is-learned');
      return;
    }
    this.key = key;
    const old = Array.from(this.el.children) as HTMLElement[];
    for (const o of old) {
      const a = play(o, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' });
      if (a) a.onfinish = () => o.remove();
      else o.remove();
    }
    this.zones = null;
    this.occ = [];
    if (!kind) {
      this.onLayout();
      return;
    }
    let node: HTMLElement;
    if (mode === 'touch' && kind !== 'draft') {
      node = touchZones(kind, learned);
      this.zones = node;
      this.occ = Array.from(node.querySelectorAll('.gs-zone-mark, .gs-zone-txt'));
    } else {
      node = pill(kind, mode);
      this.occ = [node];
    }
    this.el.append(node);
    play(node, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    this.onLayout();
  }
}

function pill(kind: HintKind, mode: InputMode): HTMLElement {
  const glyphs = h('span', 'gs-hint-keys');
  let text = TEXT[kind];
  const space = () => kbd('Space', 'gs-kbd-wide');
  const plus = () => h('span', 'gs-hint-plus', '+');
  const steerKeys = (): HTMLElement[] => [kbd('A'), kbd('D'), h('span', 'gs-hint-or', 'or'), kbdIcon('arrowL', 'Left arrow'), kbdIcon('arrowR', 'Right arrow')];

  if (kind === 'draft') {
    glyphs.append(icon('ghost', 'gs-hint-ghost'));
  } else if (mode === 'mouse') {
    if (kind === 'steer' || kind === 'spin') {
      glyphs.append(icon('arrowL', 'gs-hint-arrow'), icon('mouse', 'gs-hint-mouse'), icon('arrowR', 'gs-hint-arrow'));
      text = kind === 'spin' ? 'Move in the air to spin' : 'Move to steer';
    } else if (kind === 'drift') {
      glyphs.append(icon('mouseHold', 'gs-hint-mouse'), plus(), icon('arrowL', 'gs-hint-arrow'), icon('arrowR', 'gs-hint-arrow'));
    } else {
      glyphs.append(icon('mouseHold', 'gs-hint-mouse'));
      if (kind === 'crouch') text = 'Hold button to crouch';
    }
  } else {
    if (kind === 'steer' || kind === 'spin') glyphs.append(...steerKeys());
    else if (kind === 'drift') glyphs.append(space(), plus(), kbd('A'), kbd('D'));
    else glyphs.append(space());
  }
  const el = h('div', `gs-hint gs-panel gs-pill is-${kind}`, glyphs, h('span', 'gs-hint-txt', text));
  return el;
}

/** Short labels for the right (hold) zone, per hint: always the verb, so the zone says what it does. */
const HOLD_TEXT: Record<HintKind, string> = {
  steer: 'Hold to drift',
  crouch: 'Hold to crouch',
  drift: 'Hold to drift',
  pop: 'Release to pop',
  stomp: 'Tap as the ring closes',
  draft: 'Hold to drift',
  // A spin is taught on the left (drag) zone; the hold zone keeps its plain air verb.
  spin: 'Hold to flip',
  flip: 'Hold in the air to flip',
  boostPop: 'Hold, then let go at the lip',
};

/** The left (drag) zone's label when a hint is about steering. */
const DRAG_TEXT: Partial<Record<HintKind, string>> = {
  steer: 'Drag to steer',
  drift: 'Drag to steer',
  spin: 'Drag in the air to spin',
};

/**
 * The two input zones along the bottom of the screen, each with its glyph and a short label, and a
 * soft radial pool of ink (about 18% at its heart, no edge line: a dashed outline read as a debug
 * overlay) until that zone has been used once. Steering comes first (the steer hint is the only one
 * shown before it), so the steer zone keeps its pool for that hint alone; the hold zone keeps its own
 * until the player has drifted. One soft thumb ring marks where the thumb goes for
 * this hint: on the left for steering, on the right for every hold, tap or release.
 */
function touchZones(kind: HintKind, learned: boolean): HTMLElement {
  const drag = DRAG_TEXT[kind];
  const steerOn = drag !== undefined;
  const holdOn = kind !== 'steer' && kind !== 'spin';
  const ringLeft = kind === 'steer' || kind === 'spin';
  const left = zone('l', 'drag', drag ?? 'Steer', steerOn, ringLeft, !learned && kind === 'steer');
  const right = zone('r', 'hold', HOLD_TEXT[kind], holdOn, !ringLeft, !learned);
  return h('div', 'gs-zones', left, right);
}

function zone(side: 'l' | 'r', glyph: 'drag' | 'hold', text: string, active: boolean, ring: boolean, pool: boolean): HTMLElement {
  const mark = h('span', `gs-zone-mark${ring ? ` has-ring is-${glyph}` : ''}`, icon(glyph));
  const edge = pool ? h('span', 'gs-zone-edge') : null;
  return h('div', `gs-zone gs-zone-${side}${active ? ' is-active' : ''}`, edge, mark, h('span', 'gs-zone-txt', text));
}
