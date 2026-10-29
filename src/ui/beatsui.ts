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
//   tricks; a finale with stamp:true ("Yeti hop"). A crash, a lost combo or a broken streak retires
//   a stamp still up (fx.retireStamp), so the loss owns its beat.
// - the cash-in (fx.cashIn) by tier, and the cracked figure of a lost combo (fx.lost).
// - the rival pill (hud): pass words and names, "passed you", race news, duel results, the start-line
//   call; the crown pulse when you take the lead; the stake line's pace punch; the score's New best flash.
// - the banner band (notices), one at a time by priority: grudge settled or nemesis down, finales,
//   mission and unlock pops.
// Muted passes show nothing at all.

/** Beats that draw their own picture: a `say` on them would print the same moment twice. */
const OWN_PICTURE = new Set<Beat['type']>(['callout', 'stomp', 'bank', 'comboLost', 'pass', 'passedBy', 'lead', 'raceNews', 'duel', 'raceCall', 'grudgeSettled', 'finale', 'missionPop', 'unlockPop', 'streakBroken', 'bestComboPace', 'newBest', 'friendBeaten']);

/**
 * The unlock tease ("1 more ghost opens Frostfang Glacier") only ever comes with the pass that made it
 * true, so it always waits behind that pass's flash: it may wait as long as a pass would (the hud's
 * PEND_MS), where other news goes stale after 1.3 s.
 */
const TEASE_WAIT_MS = 2600;
/** A duel lost and its "pulled away" news arrive together: the news is the same line, shown once. */
const SAME_LINE_MS = 500;

/** Race news names your own best "Your best", never your name (contract C7). */
function newsText(b: Extract<Beat, { type: 'raceNews' }>): string {
  const t = b.text.trim();
  const name = b.ghost.name;
  if (b.ghost.kind !== 'you' || name === '' || !t.startsWith(name)) return t;
  const rest = t.slice(name.length);
  return rest === '' || rest[0] === ' ' || rest[0] === "'" ? `Your best${rest}` : t;
}

export class BeatRouter {
  /** The ghost whose duel was just lost, and when: its "pulled away" news is the same line. */
  private lostDuel = { id: -1, at: -1e9 };
  /**
   * The unlock tease still waiting or up ("1 more ghost opens Frostfang Glacier"). The next first pass
   * of any ghost opens that mountain (jostles and wrecks count), so from then on it is not true.
   */
  private tease: string | null = null;

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
          // The loss owns its beat: the streak's stamp ("QUAD STOMP") retires before the line says so.
          this.fx.retireStamp();
          this.say(b.say ?? { label: 'Streak broken', points: 0, tone: 'lost' });
          break;
        case 'bank':
          this.fx.cashIn(b);
          break;
        case 'crash':
          // No picture of its own here (the world stages it), but a stamp still up retires at once.
          this.fx.retireStamp();
          break;
        case 'comboLost':
          // fx.lost retires any stamp too, then cracks the figure (or prints the line).
          this.fx.lost(b.points, b.stake, b.best, b.crack);
          break;
        case 'bestComboPace':
          this.say(b.say ?? { label: 'Best combo pace', points: 0, tone: 'best' });
          this.hud.paceHit();
          break;
        case 'pass':
          if (b.first) this.dropTease();
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
          this.news(b);
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
          this.dropTease();
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

  /**
   * Race news in the pass-flash slot. A duel lost already said "Mila pulled away" from the same beat, so
   * its news says nothing more; the unlock tease may wait out the pass it came with.
   */
  private news(b: Extract<Beat, { type: 'raceNews' }>): void {
    if (b.news === 'pulledAway' && b.ghost.id === this.lostDuel.id && performance.now() - this.lostDuel.at < SAME_LINE_MS) return;
    const text = newsText(b);
    if (b.news === 'unlockTease') {
      this.dropTease();
      this.tease = text;
      this.hud.news(b.ghost.name, b.ghost.kind, text, TEASE_WAIT_MS);
      return;
    }
    this.hud.news(b.ghost.name, b.ghost.kind, text);
  }

  private dropTease(): void {
    if (this.tease === null) return;
    this.hud.retract(this.tease);
    this.tease = null;
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
        this.lostDuel.id = g.id;
        this.lostDuel.at = performance.now();
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
