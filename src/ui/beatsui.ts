import type { Beat } from '../game/beats';
import type { Fx } from './fx';
import type { Hud } from './hud';
import type { Notices } from './notices';

// The beat router: the overlay's half of the beats contract (src/game/beats.ts). The game hands the
// UI every run-time named moment once per frame, in the order the director made them, and this turns
// each one into its fx line, stamp, cash-in, race-row flash or banner. The list is the director's
// reused array: nothing here keeps it.
//
// Scaffold forwarding: each beat makes exactly the call the game made directly before the beats
// contract existed (same labels, tones, numbers and order). Beat types with no presentation yet
// are no-ops.

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
          this.fx.pop(b.say.label, b.say.points, b.say.tone);
          break;
        case 'stomp':
          // The perfect-landing stamp: its title, the landing's own points, and (folded in by Fx) the
          // tricks this landing already put in the slot.
          this.fx.pop(b.title, b.lead[0]?.points ?? 0, 'perfect');
          break;
        case 'bank':
          this.fx.bank(b.points, b.mult);
          break;
        case 'comboLost':
          this.fx.pop('Combo lost', b.points, 'lost');
          break;
        case 'grudgeSettled':
          // Arrives just before the grudge's pass beat, which names the banner (notices.grudge).
          this.notices.toast('Grudge settled', 'grudge', `+${b.paid} gifts`);
          break;
        case 'pass':
          if (b.muted) break;
          // Passes flash inside the race row; passing the grudge also names the "Grudge settled"
          // banner from the same beat. While a landing stamp is up the flash waits its turn (Hud).
          this.hud.flashPass(b.ghost.name, b.ghost.kind, true);
          if (b.ghost.kind === 'grudge') this.notices.grudge(b.ghost.name);
          break;
        case 'passedBy':
          if (!b.muted) this.hud.flashPass(b.ghost.name, b.ghost.kind, false);
          break;
        case 'finale':
          this.notices.toast(b.text, 'info', b.sub ?? undefined);
          break;
        default:
          break;
      }
    }
  }
}
