/**
 * Ink & Iron (tattoo/tattoo.ts): your fighter on the studio set, shirt off. Pick a place, then a design, each
 * tried on as you tap it; lasering one off is a tile too, and the Ink tab re-inks everything in a colour. The bill
 * adds up what's changing, and paying makes it yours.
 */
import { walletLine } from '../money/banking';
import { INK_COLOURS, LABELS } from '../character/Appearance';
import { DESIGNS, INK_NAMES, LASER_PRICE, REINK_PRICE, SLOT_NAMES, SLOT_ORDER, STUDIO, designPrice, designsFor, getInk, inkOf, quote, type Ink } from '../tattoo/tattoo';
import type { TattooSlot } from '../character/Appearance';
import type { Progress } from '../progress/Progress';
import { menuButton } from './controls';
import { h } from './dom';
import type { Screen, UIManager } from './UIManager';

export interface TattooActions {
  /** Show this ink on the fighter on the set (and turn them so the place you're looking at faces you). */
  preview(ink: Ink, slot: TattooSlot | null): void;
  rotate(dir: -1 | 1): void;
  zoom(): void;
  /** Paid for: save. */
  changed(): void;
}

type Section = TattooSlot | 'ink';

export function tattooScreen(progress: Progress, ui: UIManager, a: TattooActions, close: () => void): Screen {
  const el = h('div', { class: 'screen shop-screen barber-screen tattoo-screen' });
  const sections: { id: Section; label: string }[] = [...SLOT_ORDER.map((id) => ({ id, label: SLOT_NAMES[id] })), { id: 'ink', label: 'Ink' }];
  let section: Section = 'rightUpperArm';
  let wanted: Ink = inkOf(progress.save.character.appearance);
  let message = `${STUDIO.artist}: “Have a look at the flash. Anything you fancy, I’ll draw it on first.”`;
  let bad = false;
  const slotOf = (): TattooSlot | null => (section === 'ink' ? null : section);

  const choose = (next: Partial<Ink>): void => {
    wanted = { tattoos: { ...wanted.tattoos, ...(next.tattoos ?? {}) }, inkColour: next.inkColour ?? wanted.inkColour };
    a.preview(wanted, slotOf());
    message = '';
    bad = false;
    build(true);
  };

  const tile = (label: string, price: string, on: boolean, current: boolean, pick: () => void, swatch?: string): HTMLElement =>
    h(
      'button',
      { class: `barber-tile${on ? ' selected' : ''}${swatch ? ' tint' : ''}`, 'data-nav': true, 'data-grid': true, 'aria-pressed': on ? 'true' : 'false', onclick: pick },
      swatch ? h('span', { class: 'barber-chip', style: `background:${swatch}` }) : null,
      h('span', { class: 'barber-name', text: label }),
      h('span', { class: 'barber-price', text: current ? 'Yours now' : price }),
    );

  const build = (focusSel = false): void => {
    const s = progress.save;
    const now = inkOf(s.character.appearance);
    let tiles: HTMLElement[] = [];
    let blurb = '';
    if (section === 'ink') {
      const pieces = SLOT_ORDER.filter((x) => wanted.tattoos[x] !== 'none').length;
      tiles = INK_COLOURS.map((c, i) =>
        tile(INK_NAMES[i] ?? `Ink ${i + 1}`, pieces ? `£${REINK_PRICE * pieces}` : 'With your next piece', wanted.inkColour.toLowerCase() === c.toLowerCase(), now.inkColour.toLowerCase() === c.toLowerCase(), () => choose({ inkColour: c }), c),
      );
      blurb = pieces ? `Every piece gone over in the new colour: £${REINK_PRICE} a piece.` : 'The colour your tattoos are done in. Free with a new piece.';
    } else {
      const slot = section;
      const has = now.tattoos[slot];
      const want = wanted.tattoos[slot];
      tiles = [
        tile(has !== 'none' ? 'Laser it off' : 'Bare skin', has !== 'none' ? `£${LASER_PRICE}` : 'Free', want === 'none', has === 'none', () => choose({ tattoos: { [slot]: 'none' } as Ink['tattoos'] })),
        ...designsFor(slot).map((d) => tile(LABELS[d] ?? d, `£${designPrice(d, slot)}`, want === d, has === d, () => choose({ tattoos: { [slot]: d } as Ink['tattoos'] }))),
      ];
      blurb = want === 'none' ? (has === 'none' ? 'Nothing here yet. Pick a design to try it on.' : 'A few sessions with the laser. It fades right out.') : DESIGNS[want].blurb;
    }
    const q = quote(now, wanted);
    const canAfford = progress.canAfford(q.total);
    const bill = h(
      'div',
      { class: 'barber-bill' },
      h('div', { class: 'compare-title', text: q.lines.length ? 'The bill' : 'Nothing changing yet' }),
      ...q.lines.map((l) => h('div', { class: 'barber-line' }, h('span', { text: l.label }), h('span', { text: `£${l.price}` }))),
      q.lines.length ? h('div', { class: 'barber-line total' }, h('span', { text: 'Total' }), h('span', { text: `£${q.total}` })) : null,
    );
    const sum = h('p', { class: 'barber-sum', text: q.lines.length ? `${q.lines.length} job${q.lines.length === 1 ? '' : 's'}: £${q.total}` : 'Tap a design to try it on.' });
    const pay = menuButton(
      q.lines.length ? `Pay £${q.total}` : 'Pick a design',
      () => {
        const r = getInk(progress, wanted);
        if (!r.ok) {
          message = r.reason;
          bad = true;
          return build();
        }
        message = `${STUDIO.artist}: “Keep it clean and out of the sun for a fortnight.” Paid £${r.total}.`;
        bad = false;
        wanted = inkOf(progress.save.character.appearance);
        a.changed();
        a.preview(wanted, slotOf());
        build();
      },
      q.lines.length ? (canAfford ? 'Pocket money first, then the tin' : 'Not enough money') : 'Tap a design to try it on',
      q.lines.length && canAfford ? 'primary' : '',
    );
    const reset = menuButton('Keep my skin', () => choose(inkOf(progress.save.character.appearance)), 'Back to how you came in');
    el.replaceChildren(
      h('div', { class: 'shop-head' }, h('h2', { text: STUDIO.shop }), h('span', { class: 'wallet', text: walletLine(progress) })),
      h(
        'div',
        { class: 'inv-tabs' },
        ...sections.map((x) =>
          h('button', { class: `inv-tab${x.id === section ? ' on' : ''}`, 'data-nav': true, 'data-grid': true, onclick: () => { section = x.id; a.preview(wanted, slotOf()); build(true); } }, x.label),
        ),
      ),
      h(
        'div',
        { class: 'shop-body' },
        h('div', { class: 'barber-grid' }, ...tiles),
        h('div', { class: 'inv-right' }, h('p', { class: 'barber-blurb', text: blurb }), bill, sum, h('div', { class: 'barber-acts' }, pay, reset), h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message })),
      ),
      h('div', { class: 'panel-actions' }, menuButton('↺ Turn', () => a.rotate(-1)), menuButton('Turn ↻', () => a.rotate(1)), menuButton('Zoom', () => a.zoom()), menuButton('Leave', close)),
    );
    if (focusSel) ui.focusElement(el.querySelector('.barber-tile.selected') as HTMLElement | null);
    else ui.keepFocus();
  };

  return {
    el,
    onShow: () => {
      a.preview(wanted, slotOf());
      build();
    },
    onBack: close,
  };
}
