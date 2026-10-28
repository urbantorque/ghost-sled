import type { Beat, Say, StampPart } from '../game/beats';
import { fmt } from './fmt';
import type { Fx } from './fx';
import type { Hud } from './hud';
import type { Notices } from './notices';

// The beat router: the overlay's half of the beats contract (src/game/beats.ts). The game hands the
// UI every run-time named moment once per frame, in the order the director made them, and this turns
// each one into its fx line, stamp, cash-in, race-row flash or banner. The list is the director's
// reused array: nothing here keeps it.
//
// Where each beat lands:
// - the callout slot (fx.pop): callouts, and the `say` of any beat that has no picture of its own
//   (Whisker, Max drift, In the flow, 1 km...); Streak broken, Best combo pace, New best and a friend
//   beaten get their own words when the director sends none.
// - the hero stamp (fx.stomp, fx.stamp): a stomp, its title and streak line leading the landing's
//   tricks; a finale with stamp:true ("Yeti hop").
// - the cash-in (fx.cashIn) by tier, and the cracked figure of a lost combo (fx.lost).
// - the rival pill (hud): pass words and names, "passed you", race news, duel results, the start-line
//   call; the crown pulse when you take the lead; the stake line's pace punch; the score's New best flash.
// - the banner band (notices), one at a time by priority: grudge settled or nemesis down, finales,
//   mission and unlock pops.
// Muted passes show nothing at all.

/** Beats that draw their own picture: a `say` on them would print the same moment twice. */
const OWN_PICTURE = new Set<Beat['type']>(['callout', 'stomp', 'bank', 'comboLost', 'pass', 'passedBy', 'lead', 'raceNews', 'duel', 'raceCall', 'grudgeSettled', 'finale', 'missionPop', 'unlockPop', 'streakBroken', 'bestComboPace', 'newBest', 'friendBeaten']);

export class BeatRouter {
  constructor(
    private readonly hud: Hud,
    private readonly fx: Fx,
    private readonly notices: Notices,
  ) {}

  handle(list: readonly Beat[]): void {
    for (const b of list) {
      switch (b.type) {
        case 'callout':
          this.say(b.say);
          break;
        case 'stomp':
          // The stamp heads its beat (decision 52): its title, its lead parts ("2 IN A ROW" or
          // "PERFECT +250"), then the tricks this landing already put in the slot.
          this.fx.stomp(b.title, b.lead, b.streak);
          break;
        case 'streakBroken':
          this.say(b.say ?? { label: 'Streak broken', points: 0, tone: 'lost' });
          break;
        case 'bank':
          this.fx.cashIn(b);
          break;
        case 'comboLost':
          this.fx.lost(b.points, b.stake, b.best, b.crack);
          break;
        case 'bestComboPace':
          this.say(b.say ?? { label: 'Best combo pace', points: 0, tone: 'best' });
          this.hud.paceHit();
          break;
        case 'pass':
          if (b.muted) break;
          // The word and the name flash in the race row ("DOUBLE PASS Mika"); passing the grudge also
          // names its "Grudge settled" banner from the same beat (when the settle beat did not already).
          this.hud.flashPass(b.ghost.name, b.ghost.kind, true, b.text, b.word);
          if (b.ghost.kind === 'grudge') this.notices.grudge(b.ghost.name);
          break;
        case 'passedBy':
          if (!b.muted) this.hud.flashPass(b.ghost.name, b.ghost.kind, false);
          break;
        case 'lead':
          this.hud.lead();
          break;
        case 'raceNews':
          this.hud.news(b.ghost.name, b.ghost.kind, b.text);
          break;
        case 'duel':
          this.duel(b);
          break;
        case 'raceCall':
          this.hud.call(b.word, b.ghost.name, b.ghost.kind, b.sr);
          break;
        case 'grudgeSettled':
          this.notices.grudgeSettled(b.ghost.name, b.nemesis, b.after, b.paid);
          break;
        case 'newBest':
          this.say(b.say ?? { label: 'New best', points: 0, tone: 'best' });
          this.hud.flashBest();
          break;
        case 'friendBeaten':
          this.say(b.say ?? { label: `Beat ${b.name}'s ${fmt(b.distance)} m`, points: 0, tone: 'big' });
          break;
        case 'finale':
          this.finale(b);
          break;
        case 'missionPop': {
          const text = /^mission/i.test(b.text) ? b.text : `Mission done: ${b.text}`;
          this.notices.toast(text, 'mission', b.reward > 0 ? `+${fmt(b.reward)} gifts` : undefined);
          break;
        }
        case 'unlockPop':
          this.notices.unlock(b.name, b.biome);
          break;
        default:
          if (b.say && !OWN_PICTURE.has(b.type)) this.say(b.say);
          break;
      }
    }
  }

  private say(s: Say): void {
    this.fx.pop(s.label, s.points, s.tone);
  }

  /** Duel phases: the open duel shows in the pill itself (the model's duel flag); results flash. */
  private duel(b: Extract<Beat, { type: 'duel' }>): void {
    const g = b.ghost;
    switch (b.phase) {
      case 'open':
        this.hud.say(`Duel with ${g.kind === 'you' ? 'your best' : g.name}`);
        break;
      case 'won':
        this.hud.flashPass(g.name, g.kind, true, 'Duel won', 'duelWon');
        break;
      case 'heldOff':
        this.hud.flashPass(g.name, g.kind, true, 'Held off', 'heldOff');
        break;
      case 'lost':
        this.hud.news(g.name, g.kind, `${g.kind === 'you' ? 'Your best' : g.name} pulled away`);
        break;
      default:
        break;
    }
  }

  /**
   * A finale: a stamp (stamp:true, "YETI HOP" with its payoff on the sub-line), a banner in the
   * event's colour, or a callout line.
   */
  private finale(b: Extract<Beat, { type: 'finale' }>): void {
    if (b.stamp) {
      this.fx.stamp(b.text, stampParts(b.text, b.sub));
    } else if (b.banner) {
      this.notices.finale(b.text, b.sub, b.event);
    } else {
      this.say(b.say ?? { label: b.text, points: 0, tone: 'big' });
    }
  }
}

/**
 * A finale stamp's sub-line from its sub text: "Yeti hop +1,500" or "+1,500" becomes one labelled part
 * (the title names it when the sub has no words); anything else is one part with no number.
 */
function stampParts(title: string, sub: string | null): StampPart[] {
  const s = sub?.trim() ?? '';
  if (s === '') return [];
  const m = /^(.*?)\s*\+([\d,]+)(?:\s+(\w+))?$/.exec(s);
  if (!m) return [{ label: s, points: 0 }];
  const points = Number(m[2].replace(/,/g, ''));
  const label = (m[1] || m[3] || title).trim();
  return [{ label, points }];
}
