/**
 * Peaky Barbers (barber/barber.ts): your fighter in the chair on the studio set, close on the face. Pick a cut, a
 * beard and a colour, each one tried on as you tap it; the bill adds up what's changing, and paying makes it
 * yours. Hats come off while you're in the chair, so you can see the cut.
 */
import { LABELS } from '../character/Appearance';
import { BARBER, BEARDS, COLOUR_NAMES, COLOUR_PRICE, GREYS, HAIRCUTS, cutOf, getCut, greyOf, menuFor, quote, type Cut } from '../barber/barber';
import type { Progress } from '../progress/Progress';
import { menuButton } from './controls';
import { h } from './dom';
import type { Screen, UIManager } from './UIManager';

export interface BarberActions {
  /** Show this cut on the fighter in the chair. */
  preview(cut: Cut): void;
  rotate(dir: -1 | 1): void;
  zoom(): void;
  /** Paid for: save. */
  changed(): void;
}

type Section = 'hair' | 'beard' | 'colour';

export function barberScreen(progress: Progress, ui: UIManager, a: BarberActions, close: () => void): Screen {
  const el = h('div', { class: 'screen shop-screen barber-screen' });
  const body = progress.save.character.appearance.body;
  const menu = menuFor(body);
  const sections: { id: Section; label: string }[] = [
    { id: 'hair', label: 'Haircut' },
    ...(menu.beard.length ? [{ id: 'beard' as const, label: 'Beard' }] : []),
    { id: 'colour', label: 'Colour' },
  ];
  let section: Section = 'hair';
  let wanted: Cut = cutOf(progress.save.character.appearance);
  let message = `${BARBER.barber}: “Sit yourself down. What we doing today?”`;
  let bad = false;

  const choose = (next: Partial<Cut>): void => {
    wanted = { ...wanted, ...next };
    a.preview(wanted);
    message = '';
    bad = false;
    build(true);
  };

  /** One choice on the board: its name, its price (or "You've got it"), picked if it's in the cut you're trying. */
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
    const now = cutOf(s.character.appearance);
    let tiles: HTMLElement[] = [];
    let blurb = '';
    if (section === 'hair') {
      tiles = menu.hair.map((id) => tile(LABELS[id] ?? id, `£${HAIRCUTS[id].price}`, wanted.hair === id, now.hair === id, () => choose({ hair: id })));
      blurb = HAIRCUTS[wanted.hair].blurb;
    } else if (section === 'beard') {
      tiles = menu.beard.map((id) => tile(id === 'none' ? 'Clean shave' : LABELS[id] ?? id, `£${BEARDS[id].price}`, wanted.facialHair === id, now.facialHair === id, () => choose({ facialHair: id })));
      blurb = BEARDS[wanted.facialHair].blurb;
    } else {
      tiles = [
        ...menu.colours.map((c, i) => tile(COLOUR_NAMES[i] ?? `Shade ${i + 1}`, `£${COLOUR_PRICE}`, wanted.hairColour.toLowerCase() === c.toLowerCase(), now.hairColour.toLowerCase() === c.toLowerCase(), () => choose({ hairColour: c }), c)),
        ...GREYS.map((g) => tile(g.name, `£${g.price}`, greyOf(wanted.greying).id === g.id, greyOf(now.greying).id === g.id, () => choose({ greying: g.amount }))),
      ];
      blurb = 'Colour from the chart, and the grey covered, touched in or all over.';
    }
    const q = quote(now, wanted);
    const canAfford = s.cash.pocket + s.cash.bank >= q.total;
    const bill = h(
      'div',
      { class: 'barber-bill' },
      h('div', { class: 'compare-title', text: q.lines.length ? 'The bill' : 'Nothing changing yet' }),
      ...q.lines.map((l) => h('div', { class: 'barber-line' }, h('span', { text: l.label }), h('span', { text: `£${l.price}` }))),
      q.lines.length ? h('div', { class: 'barber-line total' }, h('span', { text: 'Total' }), h('span', { text: `£${q.total}` })) : null,
    );
    // Where there's no room for the bill (a phone held either way), one line says what you're paying for.
    const sum = h('p', { class: 'barber-sum', text: q.lines.length ? q.lines.map((l) => `${l.label} £${l.price}`).join(' · ') : 'Tap a cut, a beard or a colour to try it on.' });
    const pay = menuButton(
      q.lines.length ? `Pay £${q.total}` : 'Pick something new',
      () => {
        const r = getCut(progress, wanted);
        if (!r.ok) {
          message = r.reason;
          bad = true;
          return build();
        }
        message = `${BARBER.barber}: “There you go. Sharp.” Paid £${r.total}.`;
        bad = false;
        wanted = cutOf(progress.save.character.appearance);
        a.changed();
        a.preview(wanted);
        build();
      },
      q.lines.length ? (canAfford ? 'Pocket money first, then the tin' : 'Not enough money') : 'Tap a cut, a beard or a colour to try it',
      q.lines.length && canAfford ? 'primary' : '',
    );
    const reset = menuButton('Keep my look', () => choose(cutOf(progress.save.character.appearance)), 'Back to how you came in');
    el.replaceChildren(
      h('div', { class: 'shop-head' }, h('h2', { text: BARBER.shop }), h('span', { class: 'wallet', text: `£${s.cash.pocket} on you · £${s.cash.bank} in the tin` })),
      h('div', { class: 'inv-tabs' }, ...sections.map((x) => h('button', { class: `inv-tab${x.id === section ? ' on' : ''}`, 'data-nav': true, 'data-grid': true, onclick: () => { section = x.id; build(true); } }, x.label))),
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
      a.preview(wanted);
      build();
    },
    onBack: close,
  };
}
