/**
 * Supplements: stamina boosters ordered from the home computer (its Supplements tab) and delivered at once. They go
 * in the hotbar's stamina slot (items/hotbar.ts). Pay is cash, then the tin (you're at home), then the card
 * (Progress.pay). What won't fit in your pockets goes in the stash.
 */
import type { Progress } from '../progress/Progress';
import { ITEMS } from '../items/items';
import { h } from '../ui/dom';
import { itemIconUrl } from '../ui/itemIcons';

export interface Supply {
  id: string;
  /** What a delivery of `pack` costs. */
  price: number;
  /** How many come in one order. */
  pack: number;
}

export const SUPPLIES: readonly Supply[] = [
  { id: 'energy_drink', price: 8, pack: 4 },
  { id: 'stamina_gel', price: 12, pack: 4 },
  { id: 'stamina_shot', price: 15, pack: 2 },
  { id: 'electrolyte_drink', price: 14, pack: 1 },
];

export function buySupply(p: Progress, id: string): { ok: boolean; text: string } {
  const s = SUPPLIES.find((x) => x.id === id);
  const d = s && ITEMS[s.id];
  if (!s || !d) return { ok: false, text: 'Not something they sell.' };
  if (!p.canAfford(s.price)) return { ok: false, text: `£${s.price} for ${s.pack} × ${d.name}: not enough cash, in the tin or on your card.` };
  p.pay(s.price);
  const over = p.giveItem(s.id, s.pack);
  if (over) p.stashNew(over.id, over.qty);
  return { ok: true, text: over ? `${s.pack} × ${d.name} delivered. Pockets full: ${over.qty} in the stash.` : `${s.pack} × ${d.name} delivered to your pockets.` };
}

/** The home computer's Supplements tab: one row per booster, what it does, the pack and the price. */
export function suppliesBody(p: Progress, saved: () => void) {
  return (msg: (t: string, bad?: boolean) => void, rebuild: () => void): HTMLElement[] => [
    h('p', { class: 'hint', text: 'Stamina boosters, delivered to the door at once. They go on your hotbar’s stamina slot (3).' }),
    h('div', { class: 'sup-list' }, ...SUPPLIES.map((s) => {
      const d = ITEMS[s.id];
      const have = p.save.inventory.filter((x) => x.id === s.id).reduce((n, x) => n + x.qty, 0);
      return h('div', { class: 'sup-row' },
        h('img', { class: 'sup-icon', src: itemIconUrl(s.id), alt: '' }),
        h('div', { class: 'sup-text' }, h('b', { text: `${d.name} × ${s.pack}` }), h('span', { text: `${d.use?.text ?? ''}${have ? `. You've got ${have}` : ''}` })),
        h('button', { class: 'sup-buy', 'data-nav': true, onclick: () => {
          const r = buySupply(p, s.id);
          msg(r.text, !r.ok);
          if (r.ok) saved();
          rebuild();
        } }, `£${s.price}`),
      );
    })),
  ];
}
