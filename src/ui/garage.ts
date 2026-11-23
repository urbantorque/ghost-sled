import './garage.css';
import { btn, h, type Ctx, type Kid } from './dom';
import { fmt } from './fmt';
import { icon } from './icons';
import type { GarageAct, GarageItemView, GarageShelfKey, GarageSledView, GarageView, GaragePieceShelf } from './garageview';

// Round 9, the shop lane (G1): the garage's UI, over the place (render/garagescene.ts). Loaded on demand with the
// place (menus.ts showGarage), never in the first download. Built on the round's tokens (tokens.css: the one card, the
// one button in three ranks, pills and 18 px cards, vermillion only on the one primary).
//
// What it is: the shelves as tabs (Sled, Hats, Scarves, Trails, Finishes, Sounds); the piece picked in one card (its
// name, what tells it apart, where it comes from, its one action); the shelf's pieces as a strip of tiles. Picking a
// tile puts the piece on the rider in the place at once and turns the camera to it (everything is tried on before it
// is bought). Buying is two taps, as everywhere in the game (Buy arms, Confirm spends; DECISIONS 262). A sled's card
// names its signature trick with a Watch, lists its track's five tiers and, from the fourth, its post's ornament. The
// Lantern Row is in the rafters: its button turns the camera up and the card lists the towns.
//
// Keyboard, pad and touch reach everything: the tabs are a tablist (arrow keys), the tiles and buttons are buttons,
// Escape and the pad's B close it (the close button's data-fk), and focus returns to the door that opened it
// (menus.ts). Reduced motion: no slide, the place's camera cuts.

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
  hat: 'Seen from behind, as on the run. A look only.',
  scarf: 'Your scarf stays vermillion, so you always know which rider is you.',
  trail: 'What your sled leaves in the air behind it. A look only.',
  finish: 'Every sled rides the same in any finish.',
  sound: 'How your own runners sound. Cues that tell you something never change.',
};

/** The children worth appending (a null is a part left out). */
const kids = (...xs: Kid[]): Array<Node | string> => xs.filter((x): x is Node | string => x !== null && x !== undefined && x !== false);

const STATE_WORD: Record<GarageItemView['state'], string> = { on: 'Wearing', owned: 'Yours', buy: '', short: '', found: 'Found', later: 'Later' };

export class GarageUI {
  readonly el: HTMLElement;
  private view: GarageView | null = null;
  private shelf: GarageShelfKey = 'sled';
  /** The piece each shelf's card shows (a sled id on the Sled shelf). */
  private pick: Partial<Record<GarageShelfKey, string>> = {};
  private armed = '';
  private armTimer = 0;
  private rafters = false;
  private readonly tabs: HTMLElement;
  private readonly card: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly wallet: HTMLElement;
  private readonly live: HTMLElement;

  constructor(
    private readonly ctx: Ctx,
    private readonly act: (a: GarageAct) => void,
  ) {
    this.wallet = h('span', 'gs9-num');
    const close = btn(ctx, { cls: 'gs9-b gs9-b-quiet gs-gar-close', icon: 'back', label: 'Back', sound: 'back', fk: 'close-garage', onClick: () => this.act({ kind: 'close' }) });
    const title = h('h2', 'gs-gar-title', 'Garage');
    title.id = 'gs-gar-title';
    const purse = h('span', 'gs-gar-wallet gs9-tag', icon('gift'), this.wallet, h('span', 'gs-gar-wallet-w', ' gifts'));
    const row = btn(ctx, { cls: 'gs9-b gs9-b-secondary gs-gar-rafters', icon: 'lantern', label: 'Lantern Row', fk: 'g-rafters', onClick: () => this.toggleRafters() });
    const head = h('div', 'gs-gar-head', close, title, purse, row);
    this.tabs = h('div', 'gs-gar-tabs');
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', 'Shelves');
    this.tabs.addEventListener('keydown', (e) => this.tabKeys(e));
    this.card = h('section', 'gs-gar-card gs9-card');
    this.card.id = 'gs-gar-panel';
    this.card.setAttribute('role', 'tabpanel');
    this.strip = h('div', 'gs-gar-strip');
    this.strip.setAttribute('role', 'group');
    this.strip.setAttribute('aria-label', 'Pieces on this shelf');
    this.live = h('p', 'gs9-sr');
    this.live.setAttribute('aria-live', 'polite');
    const side = h('div', 'gs-gar-side', this.tabs, this.card, this.strip);
    this.el = h('div', 'gs-gar', head, side, this.live);
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', title.id);
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
    this.momentEl = h('p', 'gs-gar-moment', lead, name ? h('b', '', name) : null);
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
    this.wallet.textContent = fmt(v.wallet);
    const fk = document.activeElement instanceof HTMLElement && this.el.contains(document.activeElement) ? document.activeElement.dataset.fk : undefined;
    this.render();
    if (fk) this.el.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
    if (first) {
      this.tryPicked();
      this.el.querySelector<HTMLElement>('[data-fk="close-garage"]')?.focus({ preventScroll: true });
    }
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    this.renderTabs();
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
        b.tabIndex = on ? 0 : -1;
        return b;
      }),
    );
  }

  private tabKeys(e: KeyboardEvent): void {
    const i = SHELVES.findIndex((s) => s.key === this.shelf);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = SHELVES[(i + d + SHELVES.length) % SHELVES.length].key;
    this.setShelf(next);
    this.tabs.querySelector<HTMLElement>(`[data-fk="g-tab-${next}"]`)?.focus({ preventScroll: true });
  }

  private setShelf(k: GarageShelfKey): void {
    this.rafters = false;
    this.shelf = k;
    this.disarm();
    this.render();
    this.tryPicked();
  }

  private toggleRafters(): void {
    this.rafters = !this.rafters;
    this.disarm();
    this.act({ kind: 'rafters', on: this.rafters });
    this.render();
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

  /** The card's one action for a shop piece: Buy (primary) or Confirm, Wear, Wearing, or what it waits on. */
  private action(shelf: GaragePieceShelf, it: { id: string; name: string; price: number; state: GarageItemView['state'] }, wallet: number): HTMLElement {
    const key = `${shelf}:${it.id}`;
    if (it.state === 'on') return h('p', 'gs-gar-state', icon('check'), shelf === 'sled' ? 'Your sled' : shelf === 'sound' || shelf === 'finish' || shelf === 'trail' || shelf === 'ornament' ? 'On your sled' : 'Wearing');
    if (it.state === 'owned') return btn(this.ctx, { cls: 'gs9-b gs9-b-secondary gs-gar-act', label: shelf === 'sled' ? 'Ride This Sled' : 'Wear', fk: 'g-act', sound: 'confirm', onClick: () => this.act(shelf === 'sled' ? { kind: 'ride', sled: Number(it.id) } : { kind: 'wear', shelf, id: it.id }) });
    if (it.state === 'buy') {
      const armed = this.armed === key;
      return btn(this.ctx, { cls: 'gs9-b gs9-b-primary gs-gar-act', label: armed ? `Confirm ${fmt(it.price)} Gifts` : `Buy for ${fmt(it.price)} Gifts`, fk: 'g-act', sound: armed ? 'confirm' : 'tap', onClick: () => this.spend(key, () => this.act({ kind: 'buy', shelf, id: it.id })) });
    }
    if (it.state === 'short') return h('p', 'gs-gar-state', icon('gift'), `${fmt(it.price - wallet)} more gifts`, h('span', 'gs-gar-dim', ` (${fmt(it.price)} in all)`));
    if (it.state === 'later') return h('p', 'gs-gar-state', 'On sale in its month');
    return h('p', 'gs-gar-state', icon('book'), 'Not sold: found, not bought');
  }

  private renderShelf(v: GarageView, k: Exclude<GarageShelfKey, 'sled'>): void {
    const it = this.itemPicked(v, k);
    const listen = k === 'sound' && it ? btn(this.ctx, { cls: 'gs9-b gs9-b-quiet', icon: 'speaker', label: 'Listen', fk: 'g-listen', onClick: () => this.act({ kind: 'listen', id: it.id }) }) : null;
    this.card.replaceChildren(...kids(
      ...(it
        ? [
            h('h3', 'gs-gar-name', it.name),
            h('p', 'gs-gar-blurb', it.blurb),
            it.from ? h('p', 'gs-gar-from', it.from) : null,
            h('div', 'gs-gar-acts', this.action(k, it, v.wallet), listen),
          ]
        : []),
      h('p', 'gs-gar-note', NOTE[k]),
    ));
    this.strip.replaceChildren(...v.shelves[k].map((p) => this.tile(k, p, p.id === it?.id)));
  }

  private tile(k: GarageShelfKey, p: { id: string; name: string; price: number; state: GarageItemView['state']; isNew?: boolean }, on: boolean): HTMLElement {
    const word = p.state === 'buy' || p.state === 'short' ? `${fmt(p.price)} gifts` : STATE_WORD[p.state];
    const b = btn(this.ctx, {
      cls: `gs-gar-tile${on ? ' is-on' : ''} is-${p.state}`,
      fk: `g-tile-${k}-${p.id}`,
      onClick: () => {
        this.pick[k] = p.id;
        this.disarm();
        this.render();
        if (k === 'sled') this.act({ kind: 'try', shelf: 'sled', id: p.id });
        else this.act({ kind: 'try', shelf: k, id: p.id });
        this.live.textContent = `${p.name}, on in the garage`;
      },
    });
    b.append(...kids(h('span', 'gs-gar-tile-name', p.name), h('span', 'gs-gar-tile-state', p.state === 'buy' || p.state === 'short' ? icon('gift') : null, word), p.isNew ? h('span', 'gs9-tag gs-gar-new', 'New') : null));
    b.setAttribute('aria-pressed', String(on));
    return b;
  }

  private renderSled(v: GarageView): void {
    const s = this.sledPicked(v);
    if (!s) return;
    const sledItem = { id: String(s.id), name: s.name, price: s.price, state: s.state };
    const tiers = h(
      'ol',
      'gs-gar-tiers',
      ...s.tiers.map((t, i) => {
        const fitNow = t.state === 'open';
        const key = `fit:${s.id}:${i}`;
        const owned = s.state === 'on' || s.state === 'owned';
        const what =
          t.state === 'fitted'
            ? h('span', 'gs-gar-tier-state is-fitted', icon('check'), 'Fitted')
            : t.state === 'later'
              ? h('span', 'gs-gar-tier-state', 'After the one before')
              : t.state === 'ride'
                ? h('span', 'gs-gar-tier-state', `Ride ${fmt(t.linesToGo)} more stage lines on it`)
                : t.state === 'short'
                  ? h('span', 'gs-gar-tier-state', icon('gift'), `${fmt(t.price - v.wallet)} more gifts`)
                  : owned
                    ? btn(this.ctx, {
                        cls: 'gs9-b gs9-b-primary gs-gar-fit',
                        label: this.armed === key ? `Confirm ${fmt(t.price)} Gifts` : `Fit for ${fmt(t.price)} Gifts`,
                        fk: 'g-act',
                        onClick: () => this.spend(key, () => this.act({ kind: 'fit', sled: s.id })),
                      })
                    : h('span', 'gs-gar-tier-state', 'Once the sled is yours');
        const li = h('li', `gs-gar-tier is-${t.state}${fitNow ? ' is-next' : ''}`, h('span', 'gs-gar-tier-name', t.name), h('span', 'gs-gar-tier-what', t.what), what);
        return li;
      }),
    );
    const postOpen = s.tiers[3]?.state === 'fitted';
    const ornaments = postOpen
      ? h(
          'div',
          'gs-gar-orns',
          h('h4', 'gs-gar-sub', 'On the post'),
          h(
            'div',
            'gs-gar-orn-row',
            ...v.ornaments.map((o) => {
              const b = btn(this.ctx, {
                cls: `gs-gar-chip${o.state === 'on' ? ' is-on' : ''} is-${o.state}`,
                label: o.name,
                fk: `g-orn-${o.id}`,
                disabled: o.state === 'found' || o.state === 'later',
                onClick: () => {
                  this.act({ kind: 'try', shelf: 'ornament', id: o.id });
                  if (o.state === 'owned') this.act({ kind: 'wear', shelf: 'ornament', id: o.id });
                  if (o.state === 'buy') this.spend(`ornament:${o.id}`, () => this.act({ kind: 'buy', shelf: 'ornament', id: o.id }));
                },
              });
              b.title = o.state === 'found' ? `${o.name}: ${o.from}` : o.blurb;
              if (o.state === 'found' || o.state === 'later') b.setAttribute('aria-label', `${o.name}, ${o.state === 'found' ? o.from : 'on sale in its month'}`);
              b.setAttribute('aria-pressed', String(o.state === 'on'));
              return b;
            }),
          ),
        )
      : null;
    this.card.replaceChildren(...kids(
      h('h3', 'gs-gar-name', s.name),
      h('p', 'gs-gar-blurb', s.trait),
      h('div', 'gs-gar-sig', h('p', 'gs-gar-sig-line', h('strong', '', s.signature), `: ${s.signatureHow}`), btn(this.ctx, { cls: 'gs9-b gs9-b-quiet', icon: 'play', label: 'Watch', fk: 'g-watch', onClick: () => this.act({ kind: 'watch', sled: s.id }) })),
      s.from ? h('p', 'gs-gar-from', s.from) : null,
      h('div', 'gs-gar-acts', this.action('sled', sledItem, v.wallet)),
      s.state === 'on' || s.state === 'owned' ? h('h4', 'gs-gar-sub', `Its track: ${fmt(s.lines)} stage lines ridden on it`) : h('h4', 'gs-gar-sub', 'Its track'),
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
      h('p', 'gs-gar-blurb', 'Lanterns you light hang over the finish town and here in the rafters.'),
      towns.length
        ? h(
            'ul',
            'gs-gar-towns',
            ...towns.map((t) => {
              const n = t.next;
              const key = `light:${t.mountain}`;
              const act = n
                ? n.affordable
                  ? btn(this.ctx, { cls: 'gs9-b gs9-b-secondary', icon: 'lantern', label: this.armed === key ? `Confirm ${fmt(n.price)} Gifts` : `Light One for ${fmt(n.price)} Gifts`, fk: `g-light-${t.mountain}`, onClick: () => this.spend(key, () => this.act({ kind: 'light', town: n.id })) })
                  : h('span', 'gs-gar-tier-state', icon('gift'), `${fmt(n.price - v.wallet)} more gifts for the next`)
                : h('span', 'gs-gar-tier-state is-fitted', icon('check'), 'Every lantern lit');
              return h('li', 'gs-gar-town', h('span', 'gs-gar-town-name', t.town.charAt(0).toUpperCase() + t.town.slice(1)), h('span', 'gs-gar-town-lit', `${t.lit} of ${t.of} lit`), act);
            }),
          )
        : h('p', 'gs-gar-note', 'Open a mountain to light its finish town.'),
    ));
    this.strip.replaceChildren();
  }
}
