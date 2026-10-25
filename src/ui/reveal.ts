import type { RevealModel } from './contract';
import { ChaosEvent, eventInfo, Mood, moodInfo } from '../sim/chaos';
import { h } from './dom';
import { MOOD_MOD, type Hud } from './hud';
import { icon } from './icons';
import { EASE_IN, play, reduced, SPRING } from './motion';
import { EVENT_ICON } from './notices';

// Chaos reveal: a slot-machine card at top centre, right under the race row (your place and the next
// ghost stay up, so the run reads as a race from its first frame), in the combo tier's place. The reel
// spins through the mood names and the rolled one is slammed onto a mood-tinted glow at about 1.6x the
// old size, in the mood's own UI accent (Lantern Night moon blue, Comet Night lilac), then held. Under
// it, the one gameplay modifier with its icon (the same icon then lives on in the HUD mood chip) and
// its key number in the accent, and the event chip. No eyebrow and no slab: glowing type on a soft
// ink halo, so the sky (an aurora, a comet) keeps its band. The card then collapses into the mood chip
// under the score.
// Timeline (about 2.2 s, collapse included): card in 0.2 s, reel spins 0.08 to 0.74 s, slam, modifier
// punched in with it at 0.77 s (opaque within two frames), event chip at 0.94 s, hold to 1.94 s,
// collapse 1.94 to 2.22 s.

const T_REEL = 80;
const REEL_MS = 660;
const T_STAMP = T_REEL + REEL_MS;
const T_RULE = T_STAMP + 30;
const T_EVENT = 940;
const HOLD_MS = 1200;
const T_LEAVE = T_STAMP + HOLD_MS;
const LEAVE_MS = 280;

export class Reveal {
  private timers: number[] = [];
  private card: HTMLElement | null = null;
  private resolve: (() => void) | null = null;

  constructor(
    private readonly slot: HTMLElement,
    private readonly hud: Hud,
  ) {}

  run(m: RevealModel): Promise<void> {
    this.finish();
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
      this.start(m);
    });
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private start(m: RevealModel): void {
    const rm = reduced();
    const hasMood = m.mood.id !== Mood.None;
    this.hud.setRevealing(hasMood);

    // Reel strip: a shuffled run of names that always ends on the rolled mood.
    const pool = m.reel.length > 0 ? m.reel.filter((n) => n !== m.mood.name) : [];
    const names: string[] = [];
    const spins = rm ? 0 : 11;
    for (let i = 0; i < spins && pool.length > 0; i++) names.push(pool[(i * 5 + m.mood.id * 3) % pool.length]);
    names.push(m.mood.name);

    const strip = h('div', 'gs-reel-strip');
    for (const n of names) strip.append(h('span', 'gs-reel-item', n));
    const reel = h('div', 'gs-reel', strip);
    const stamp = h('span', 'gs-reel-stamp');
    const reelWrap = h('div', 'gs-reel-wrap', stamp, reel);
    const mod = MOOD_MOD[m.mood.id] ?? MOOD_MOD[Mood.None];
    // The number that changes play ("50%") is set in the mood's accent, like the landed name, so each
    // mood's card reads by its colour before it is read.
    const at = mod.key ? mod.text.indexOf(mod.key) : -1;
    const txt =
      at < 0
        ? h('span', 'gs-reveal-mod-txt', mod.text)
        : h('span', 'gs-reveal-mod-txt', mod.text.slice(0, at), h('b', 'gs-reveal-key', mod.key), mod.text.slice(at + mod.key.length));
    const rule = h('p', 'gs-reveal-mod', icon(mod.icon, 'gs-reveal-mod-ico'), txt);
    const card = h('div', 'gs-reveal', reelWrap, rule);
    card.dataset.mood = moodInfo(m.mood.id).key;
    // The reel of up to 12 names is decoration; the result is announced once through the HUD's live
    // region (a freshly inserted status node is not announced reliably).
    card.setAttribute('aria-hidden', 'true');
    this.hud.say(`Run mood: ${m.mood.name}. ${m.mood.rule}${m.event && m.event.id !== ChaosEvent.None ? `. Watch for ${m.event.name}` : ''}`);

    let chip: HTMLElement | null = null;
    if (m.event && m.event.id !== ChaosEvent.None) {
      chip = h('span', `gs-reveal-ev gs-pill e-${eventInfo(m.event.id).key}`, icon(EVENT_ICON[m.event.id] ?? 'alert'), `Watch for: ${m.event.name}`);
      card.append(chip);
    }
    this.slot.append(card);
    this.card = card;

    play(card, [{ opacity: 0, transform: 'translateY(-10px) scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: SPRING });

    // Spin. The strip travels by a fraction of its own height (equal rows), so nothing reads layout.
    const travel = names.length > 1 ? ((names.length - 1) / names.length) * 100 : 0;
    if (!rm && travel > 0) {
      strip.style.transform = 'translateY(0)';
      this.at(T_REEL, () => {
        play(strip, [{ transform: 'translateY(0)' }, { transform: `translateY(${-travel.toFixed(4)}%)` }], {
          duration: REEL_MS,
          easing: 'cubic-bezier(0.18, 0.62, 0.22, 1)',
          fill: 'forwards',
        });
      });
    }

    // The slam: the tinted pill lands hard behind the name, the name punches in, the card dips.
    this.at(rm ? 200 : T_STAMP, () => {
      reel.classList.add('is-landed');
      stamp.classList.add('is-on');
      play(stamp, [{ opacity: 0, transform: 'scale(1.5, 1.9)' }, { opacity: 1, transform: 'scale(0.96, 0.94)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
      play(reel, [{ transform: 'scale(1.28)' }, { transform: 'scale(0.97)', offset: 0.55 }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
      play(card, [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)', offset: 0.3 }, { transform: 'translateY(0)' }], { duration: 260, delay: 90, easing: 'ease-out' });
    });

    rule.style.opacity = '0';
    this.at(rm ? 260 : T_RULE, () => {
      rule.style.opacity = '';
      play(rule, [{ opacity: 0, transform: 'scale(1.18)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.12 }, { opacity: 1, transform: 'scale(0.98)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    });
    if (chip) {
      const c = chip;
      c.style.opacity = '0';
      this.at(rm ? 300 : T_EVENT, () => {
        c.style.opacity = '';
        play(c, [{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
      });
    }

    this.at(T_LEAVE, () => this.leave(card, hasMood));
  }

  private leave(card: HTMLElement, hasMood: boolean): void {
    const target = hasMood && this.hud.moodVisibleSoon ? this.hud.moodEl.getBoundingClientRect() : null;
    const from = card.getBoundingClientRect();
    let frames: Keyframe[];
    if (target && target.width > 0 && !reduced()) {
      const dx = target.left + target.width / 2 - (from.left + from.width / 2);
      const dy = target.top + target.height / 2 - (from.top + from.height / 2);
      const s = Math.max(0.12, target.width / Math.max(1, from.width));
      frames = [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(3)})` },
      ];
    } else {
      frames = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px) scale(0.96)' }];
    }
    const a = play(card, frames, { duration: LEAVE_MS, easing: EASE_IN, fill: 'forwards' });
    this.at(Math.round(LEAVE_MS * 0.75), () => this.hud.setRevealing(false));
    const done = () => this.finish();
    if (a) a.onfinish = done;
    else this.at(LEAVE_MS, done);
  }

  /** Ends any running reveal immediately and resolves its promise. */
  finish(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    this.card?.remove();
    this.card = null;
    const r = this.resolve;
    this.resolve = null;
    if (r) {
      this.hud.setRevealing(false);
      r();
    }
  }
}
