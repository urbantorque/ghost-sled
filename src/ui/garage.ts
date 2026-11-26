import './garage.css';
import { btn, h, type Ctx, type Kid } from './dom';
import { fmt } from './fmt';
import { icon } from './icons';
import { b9 } from './kit9';
import { curly } from './words';
import type { GarageAct, GarageItemView, GarageShelfKey, GarageSledView, GarageView, GaragePieceShelf } from './garageview';

// Round 9, the shop lane (G1): the garage's UI, over the place (render/garagescene.ts). Loaded on demand with the
// place (menus.ts showGarage), never in the first download.
//
// Round 9, G6: in the round's language (kit9.ts, kit9.css, tokens.css), as the other screens were brought into it (U4):
// one ink sheet from the logo's side as every room's (the left of a desk, where the place keeps the rider right of it;
// the bottom on a phone, under the rider), its heading "Garage" in italic 900 with a quiet Close beside it, as every room and sheet
// has; the gifts in their marigold, as the results draw them; the shelves as pills, the picked one pressed as
// settings' quality is (never a filled off-white tab); body words at the system's text weight; the one vermillion
// only on a purchase or a tier being fitted. The critics of U4's family test found the old kit out of family (an
// off-white filled tab, regular-weight body copy, a header of mixed pills over the scene).
//
// What it is: the shelves as tabs (Sled, Hats, Scarves, Trails, Finishes, Sounds); the shelf's pieces as tiles; the
// piece picked, its name, what tells it apart, where it comes from and its one action. Picking a tile puts the piece
// on the rider in the place at once and turns the camera to it (everything is tried on before it is bought). Buying is
// two taps, as everywhere in the game (Buy arms, Confirm spends; DECISIONS 262). A sled's card names its signature
// trick with a Watch, lists its track's five tiers and, from the fourth, its post's ornament. The Lantern Row is in
// the rafters: its button turns the camera up and the card lists the towns.
//
// Keyboard, pad and touch reach everything: the tabs are a tablist (arrow keys), the tiles and buttons are buttons,
// Escape, Backspace and the pad's B close it alone (ui.ts back, the close button's data-fk), and focus returns to the
// door that opened it (menus.ts). Reduced motion: no slide (every duration a token that is zero under it), the place's
// camera cuts.

const SHELVES: ReadonlyArray<{ key: GarageShelfKey; label: string }> = [
  { key: 'sled', label: 'Sled' },
  { key: 'hat', label: 'Hats' },
  { key: 'scarf', label: 'Scarves' },
  { key: 'trail', label: 'Trails' },
  { key: 'finish', label: 'Finishes' },
  { key: 'sound', label: 'Sounds' },
];

/** What the shelf's pieces are for, in one line under the card (a look only, never an edge). */
const NOTE: Record<GarageShelfKey, string> = {
  sled: 'Each sled rides its own way. Its track only changes how it looks.',
  hat: 'From behind first, as on the run. Pick it again to see its front.',
  scarf: 'Your scarf stays vermillion, so you always know which rider is you.',
  trail: 'What your sled leaves in the air behind it. A look only.',
  finish: 'Every sled rides the same in any finish.',
  sound: 'How your own runners sound. Cues that tell you something never change.',
};

/** The children worth appending (a null is a part left out). */
const kids = (...xs: Kid[]): Array<Node | string> => xs.filter((x): x is Node | string => x !== null && x !== undefined && x !== false);

/** A tile's state in words (a price is said with its word instead). */
const STATE_WORD: Record<GarageItemView['state'], string> = { on: 'Wearing', owned: 'Yours', buy: '', short: '', found: 'Earned in play', later: 'In its month' };

/** A piece's, a sled's or a town's name: never translated (the game's names, as U4 marks them). */
const noTr = <T extends HTMLElement>(el: T): T => {
  el.setAttribute('translate', 'no');
  return el;
};

/** The gifts as the results draw them: the glyph and the figure with its word, in marigold. */
const gifts = (n: number, cls = ''): HTMLElement => h('span', `gs-gar-gifts${cls ? ` ${cls}` : ''}`, icon('gift'), `${fmt(n)} gifts`);

export class GarageUI {
  readonly el: HTMLElement;
  private view: GarageView | null = null;
  private shelf: GarageShelfKey = 'sled';
  /** The piece each shelf's card shows (a sled id on the Sled shelf). */
  private pick: Partial<Record<GarageShelfKey, string>> = {};
  private armed = '';
  private armTimer = 0;
  private rafters = false;
  private readonly sheet: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly card: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly wallet: HTMLElement;
  private readonly rowBtn: HTMLButtonElement;
  private readonly live: HTMLElement;

  constructor(
    private readonly ctx: Ctx,
    private readonly act: (a: GarageAct) => void,
  ) {
    this.heading = h('h2', 'gs9-sheet-h gs-gar-title', 'Garage');
    this.heading.id = 'gs-gar-title';
    this.heading.tabIndex = -1;
    const close = b9(ctx, 'quiet', 'Close', { icon: 'close', fk: 'close-garage', sound: 'back', cls: 'gs-gar-close', onClick: () => this.act({ kind: 'close' }) });
    const head = h('header', 'gs9-sheet-head gs-gar-head', this.heading, close);
    this.wallet = h('p', 'gs-gar-wallet');
    this.rowBtn = b9(ctx, 'secondary', 'Lantern Row', { icon: 'lantern', fk: 'g-rafters', cls: 'gs9-b-s gs-gar-rafters', onClick: () => this.toggleRafters() });
    const bar = h('div', 'gs-gar-bar', this.wallet, this.rowBtn);
    this.tabs = h('div', 'gs-gar-tabs');
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', 'Shelves');
    this.tabs.addEventListener('keydown', (e) => this.tabKeys(e));
    this.card = h('section', 'gs-gar-card');
    this.card.id = 'gs-gar-panel';
    this.card.setAttribute('role', 'tabpanel');
    this.strip = h('div', 'gs-gar-strip');
    this.strip.setAttribute('role', 'group');
    this.strip.setAttribute('aria-label', 'Pieces on this shelf');
    this.live = h('p', 'gs9-sr');
    this.live.setAttribute('aria-live', 'polite');
    // (From the logo's side, as every room and sheet comes: the place keeps the rider right of it. The family test found
    // the garage's sheet on the far edge the one sheet out of step.)
    this.sheet = h('section', 'gs9-sheet gs-gar-sheet', head, bar, this.tabs, this.strip, this.card, this.live);
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-labelledby', this.heading.id);
    this.el = h('div', 'gs-gar', this.sheet);
    // Escape closes (on CrazyGames the browser takes it first in fullscreen); any key or tap skips a moment.
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.act({ kind: 'close' });
      }
    });
  }

  /** Forgets the last open's state (the next opens at the worn sled). */
  reset(): void {
    this.view = null;
    this.pick = {};
    this.shelf = 'sled';
    this.rafters = false;
    this.disarm();
    this.moment(null);
  }

  private momentEl: HTMLElement | null = null;
  private momentTimer = 0;

  /** The purchase's one line over the place ("Yours: the Pom Muffs"), for a couple of seconds; null clears it. */
  moment(text: string | null): void {
    window.clearTimeout(this.momentTimer);
    this.momentEl?.remove();
    this.momentEl = null;
    if (!text) return;
    const [lead, name] = text.split('|');
    this.momentEl = h('p', 'gs-gar-moment', curly(lead), name ? h('b', '', curly(name)) : null);
    this.momentEl.setAttribute('role', 'status');
    this.el.append(this.momentEl);
    this.momentTimer = window.setTimeout(() => this.moment(null), 2600);
  }

  /** Shows the garage's state; a refresh keeps the shelf and the piece picked (focus kept by data-fk). */
  show(v: GarageView): void {
    const first = this.view === null;
    this.view = v;
    if (first && v.focus) {
      this.shelf = v.focus.shelf;
      this.pick[v.focus.shelf] = v.focus.id;
    }
    this.wallet.replaceChildren(gifts(v.wallet), h('span', 'gs-gar-wallet-w', ' to spend'));
    const fk = document.activeElement instanceof HTMLElement && this.el.contains(document.activeElement) ? document.activeElement.dataset.fk : undefined;
    this.render();
    if (fk) this.el.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
    if (first) {
      this.card.scrollTop = 0;
      this.strip.scrollTop = 0;
      this.strip.scrollLeft = 0;
      this.tryPicked();
      // (As every sheet: focus lands on its words, not on Close; the picked tile is then a Tab away.)
      this.heading.focus({ preventScroll: true });
      this.el.querySelector<HTMLElement>('.gs-gar-tile[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    this.renderTabs();
    this.rowBtn.setAttribute('aria-pressed', String(this.rafters));
    this.sheet.classList.toggle('is-rafters', this.rafters);
    this.card.setAttribute('aria-labelledby', this.rafters ? 'gs-gar-title' : `gs-gar-tab-${this.shelf}`);
    if (this.rafters) this.renderLanterns(v);
    else if (this.shelf === 'sled') this.renderSled(v);
    else this.renderShelf(v, this.shelf);
  }

  private renderTabs(): void {
    this.tabs.replaceChildren(
      ...SHELVES.map(({ key, label }) => {
        const on = key === this.shelf && !this.rafters;
        const b = btn(this.ctx, { cls: `gs9-b gs-gar-tab${on ? ' is-on' : ''}`, label, fk: `g-tab-${key}`, onClick: () => this.setShelf(key) });
        b.setAttribute('role', 'tab');
        b.id = `gs-gar-tab-${key}`;
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('aria-controls', 'gs-gar-panel');
        b.tabIndex = on || (this.rafters && key === this.shelf) ? 0 : -1;
        return b;
      }),
    );
  }

  private tabKeys(e: KeyboardEvent): void {
    const i = SHELVES.findIndex((s) => s.key === this.shelf);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? SHELVES.length - 1 : d ? (i + d + SHELVES.length) % SHELVES.length : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = SHELVES[to].key;
    this.setShelf(next);
    this.tabs.querySelector<HTMLElement>(`[data-fk="g-tab-${next}"]`)?.focus({ preventScroll: true });
  }

  private setShelf(k: GarageShelfKey): void {
    this.rafters = false;
    this.shelf = k;
    this.disarm();
    this.render();
    this.card.scrollTop = 0;
    this.strip.scrollTop = 0;
    this.strip.scrollLeft = 0;
    this.tryPicked();
  }

  private toggleRafters(): void {
    this.rafters = !this.rafters;
    this.disarm();
    this.act({ kind: 'rafters', on: this.rafters });
    this.render();
    if (!this.rafters) this.tryPicked();
  }

  /** The picked piece of the shelf (the worn one by default), tried on in the place. */
  private tryPicked(): void {
    const v = this.view;
    if (!v || this.rafters) return;
    if (this.shelf === 'sled') {
      const s = this.sledPicked(v);
      if (s) this.act({ kind: 'try', shelf: 'sled', id: String(s.id) });
      return;
    }
    const it = this.itemPicked(v, this.shelf);
    if (it) this.act({ kind: 'try', shelf: this.shelf, id: it.id });
  }

  private sledPicked(v: GarageView): GarageSledView | undefined {
    const id = this.pick.sled;
    return v.sleds.find((s) => String(s.id) === id) ?? v.sleds.find((s) => s.state === 'on') ?? v.sleds[0];
  }

  private itemPicked(v: GarageView, k: Exclude<GarageShelfKey, 'sled'>): GarageItemView | undefined {
    const list = v.shelves[k];
    return list.find((i) => i.id === this.pick[k]) ?? list.find((i) => i.state === 'on') ?? list[0];
  }

  private disarm(): void {
    window.clearTimeout(this.armTimer);
    this.armed = '';
  }

  /** Buy arms, Confirm spends (two taps everywhere); the arm lapses after a few seconds. */
  private spend(key: string, go: () => void): void {
    if (this.armed === key) {
      this.disarm();
      go();
      return;
    }
    this.armed = key;
    window.clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => {
      this.armed = '';
      this.render();
    }, 4000);
    this.render();
    this.card.querySelector<HTMLElement>('[data-fk="g-act"]')?.focus({ preventScroll: true });
  }

  /** What a piece still waits on, said with its figure's word: "80 gifts, 30 more to go". */
  private short(price: number, wallet: number): HTMLElement {
    return h('p', 'gs-gar-state', gifts(price), h('span', 'gs-gar-dim', `, ${fmt(Math.max(0, price - wallet))} more to go`));
  }

  /** The card's one action for a piece: Buy (the primary) or Confirm, Wear, what it is now, or what it waits on. */
  private action(shelf: GaragePieceShelf, it: { id: string; name: string; price: number; state: GarageItemView['state'] }, wallet: number): HTMLElement {
    const key = `${shelf}:${it.id}`;
    if (it.state === 'on') return h('p', 'gs-gar-state is-on', icon('check'), shelf === 'sled' ? 'Your sled' : shelf === 'sound' || shelf === 'finish' || shelf === 'trail' || shelf === 'ornament' ? 'On your sled' : 'Wearing it');
    if (it.state === 'owned') return b9(this.ctx, 'secondary', shelf === 'sled' ? 'Ride This Sled' : 'Wear It', { fk: 'g-act', sound: 'confirm', cls: 'gs-gar-act', onClick: () => this.act(shelf === 'sled' ? { kind: 'ride', sled: Number(it.id) } : { kind: 'wear', shelf, id: it.id }) });
    if (it.state === 'buy') {
      const armed = this.armed === key;
      return b9(this.ctx, 'primary', armed ? `Confirm ${fmt(it.price)} Gifts` : `Buy for ${fmt(it.price)} Gifts`, { fk: 'g-act', sound: armed ? 'confirm' : 'tap', cls: 'gs-gar-act', onClick: () => this.spend(key, () => this.act({ kind: 'buy', shelf, id: it.id })) });
    }
    if (it.state === 'short') return this.short(it.price, wallet);
    if (it.state === 'later') return h('p', 'gs-gar-state', 'On sale in its month');
    return h('p', 'gs-gar-state', icon('book'), 'Never sold: earned in play');
  }

  private renderShelf(v: GarageView, k: Exclude<GarageShelfKey, 'sled'>): void {
    const it = this.itemPicked(v, k);
    const listen = k === 'sound' && it ? b9(this.ctx, 'quiet', 'Listen', { icon: 'speaker', fk: 'g-listen', onClick: () => this.act({ kind: 'listen', id: it.id }) }) : null;
    this.card.replaceChildren(...kids(
      ...(it
        ? [
            noTr(h('h3', 'gs-gar-name', curly(it.name))),
            h('p', 'gs-gar-blurb', curly(it.blurb)),
            it.from ? h('p', 'gs-gar-from', curly(it.from)) : null,
            h('div', 'gs-gar-acts', this.action(k, it, v.wallet), listen),
          ]
        : []),
      h('p', 'gs-gar-note', NOTE[k]),
    ));
    this.strip.replaceChildren(...v.shelves[k].map((p) => this.tile(k, p, p.id === it?.id)));
  }

  private tile(k: GarageShelfKey, p: { id: string; name: string; price: number; state: GarageItemView['state']; isNew?: boolean }, on: boolean): HTMLElement {
    const word = p.state === 'buy' || p.state === 'short' ? `${fmt(p.price)} gifts` : k === 'sled' && p.state === 'on' ? 'Your sled' : STATE_WORD[p.state];
    const b = btn(this.ctx, {
      // (The picked tile is is-picked: is-on is the state of a piece worn, and the two read as one.)
      cls: `gs-gar-tile${on ? ' is-picked' : ''} is-${p.state}`,
      fk: `g-tile-${k}-${p.id}`,
      onClick: () => {
        this.pick[k] = p.id;
        this.disarm();
        this.render();
        this.act({ kind: 'try', shelf: k, id: p.id });
        this.live.textContent = `${curly(p.name)}, on in the garage`;
      },
    });
    const glyph = p.state === 'buy' || p.state === 'short' ? icon('gift') : p.state === 'on' ? icon('check') : null;
    b.append(...kids(noTr(h('span', 'gs-gar-tile-name', curly(p.name))), h('span', 'gs-gar-tile-state', glyph, word), p.isNew ? h('span', 'gs9-tag gs-gar-new', 'New') : null));
    b.setAttribute('aria-pressed', String(on));
    return b;
  }

  private renderSled(v: GarageView): void {
    const s = this.sledPicked(v);
    if (!s) return;
    const sledItem = { id: String(s.id), name: s.name, price: s.price, state: s.state };
    const owned = s.state === 'on' || s.state === 'owned';
    const tiers = h(
      'ol',
      'gs-gar-tiers',
      ...s.tiers.map((t, i) => {
        const key = `fit:${s.id}:${i}`;
        const what =
          t.state === 'fitted'
            ? h('span', 'gs-gar-tier-state is-fitted', icon('check'), 'Fitted')
            : t.state === 'later'
              ? h('span', 'gs-gar-tier-state', `Opens after the ${s.tiers[i - 1]?.name.toLowerCase() ?? 'one before'}`)
              : !owned
                ? h('span', 'gs-gar-tier-state', 'Once the sled is yours')
                : t.state === 'ride'
                  ? h('span', 'gs-gar-tier-state', `Ride ${fmt(t.linesToGo)} more ${t.linesToGo === 1 ? 'stage' : 'stages'} on it`)
                  : t.state === 'short'
                    ? h('span', 'gs-gar-tier-state', gifts(t.price), h('span', 'gs-gar-dim', `, ${fmt(Math.max(0, t.price - v.wallet))} more to go`))
                    : b9(this.ctx, 'primary', this.armed === key ? `Confirm ${fmt(t.price)} Gifts` : `Fit for ${fmt(t.price)} Gifts`, { fk: 'g-act', cls: 'gs9-b-s gs-gar-fit', onClick: () => this.spend(key, () => this.act({ kind: 'fit', sled: s.id })) });
        return h('li', `gs-gar-tier is-${t.state}${t.state === 'open' && owned ? ' is-next' : ''}`, h('span', 'gs-gar-tier-name', t.name), h('span', 'gs-gar-tier-what', curly(t.what)), what);
      }),
    );
    const postOpen = s.tiers[3]?.state === 'fitted';
    const ornaments = postOpen
      ? h(
          'section',
          'gs-gar-orns',
          h('h4', 'gs9-cap gs-gar-sub', 'On the Post'),
          h(
            'div',
            'gs-gar-orn-row',
            ...v.ornaments.map((o) => {
              const b = btn(this.ctx, {
                cls: `gs-gar-chip${o.state === 'on' ? ' is-on' : ''} is-${o.state}`,
                label: curly(o.name),
                fk: `g-orn-${o.id}`,
                disabled: o.state === 'found' || o.state === 'later',
                onClick: () => {
                  this.act({ kind: 'try', shelf: 'ornament', id: o.id });
                  if (o.state === 'owned') this.act({ kind: 'wear', shelf: 'ornament', id: o.id });
                  if (o.state === 'buy') this.spend(`ornament:${o.id}`, () => this.act({ kind: 'buy', shelf: 'ornament', id: o.id }));
                },
              });
              b.title = curly(o.state === 'found' ? `${o.name}: ${o.from}` : o.blurb);
              if (o.state === 'found' || o.state === 'later') b.setAttribute('aria-label', curly(`${o.name}, ${o.state === 'found' ? o.from : 'on sale in its month'}`));
              b.setAttribute('aria-pressed', String(o.state === 'on'));
              return b;
            }),
          ),
        )
      : null;
    this.card.replaceChildren(...kids(
      noTr(h('h3', 'gs-gar-name', curly(s.name))),
      h('p', 'gs-gar-blurb', curly(s.trait)),
      s.from ? h('p', 'gs-gar-from', curly(s.from)) : null,
      h('div', 'gs-gar-acts', this.action('sled', sledItem, v.wallet)),
      h('div', 'gs-gar-sig', h('p', 'gs-gar-sig-line', h('strong', '', curly(s.signature)), curly(`: ${s.signatureHow}`)), b9(this.ctx, 'quiet', 'Watch', { icon: 'play', fk: 'g-watch', cls: 'gs9-b-s', onClick: () => this.act({ kind: 'watch', sled: s.id }) })),
      h('h4', 'gs9-cap gs-gar-sub', 'Its Track'),
      owned ? h('p', 'gs-gar-from', `${fmt(s.lines)} ${s.lines === 1 ? 'stage' : 'stages'} ridden on this sled. Each part opens once you have ridden enough of them; then you fit it for gifts.`) : null,
      tiers,
      ornaments,
      h('p', 'gs-gar-note', NOTE.sled),
    ));
    this.strip.replaceChildren(...v.sleds.map((x) => this.tile('sled', { id: String(x.id), name: x.name, price: x.price, state: x.state }, x.id === s.id)));
  }

  private renderLanterns(v: GarageView): void {
    const towns = v.lanterns;
    this.card.replaceChildren(...kids(
      h('h3', 'gs-gar-name', 'The Lantern Row'),
      h('p', 'gs-gar-blurb', 'Lanterns you light hang over the finish town, and here in the rafters.'),
      towns.length
        ? h(
            'ul',
            'gs-gar-towns',
            ...towns.map((t) => {
              const n = t.next;
              const key = `light:${t.mountain}`;
              const act = n
                ? n.affordable
                  ? b9(this.ctx, 'secondary', this.armed === key ? `Confirm ${fmt(n.price)} Gifts` : `Light One for ${fmt(n.price)} Gifts`, { icon: 'lantern', fk: `g-light-${t.mountain}`, cls: 'gs9-b-s', onClick: () => this.spend(key, () => this.act({ kind: 'light', town: n.id })) })
                  : h('span', 'gs-gar-tier-state', 'The next ', gifts(n.price), h('span', 'gs-gar-dim', `, ${fmt(Math.max(0, n.price - v.wallet))} more to go`))
                : h('span', 'gs-gar-tier-state is-fitted', icon('check'), 'Every lantern lit');
              return h('li', 'gs-gar-town', noTr(h('span', 'gs-gar-town-name', curly(t.town.charAt(0).toUpperCase() + t.town.slice(1)))), h('span', 'gs-gar-town-lit', `${fmt(t.lit)} of ${fmt(t.of)} lit`), act);
            }),
          )
        : h('p', 'gs-gar-note', 'Open a mountain to light its finish town.'),
    ));
    this.strip.replaceChildren();
  }
}
