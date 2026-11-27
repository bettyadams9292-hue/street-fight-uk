/**
 * Supplements: stamina boosters ordered from the home computer (its Supplements tab) and delivered at once. They go
 * in the hotbar's stamina slot (items/hotbar.ts). Pay is cash, then the card (never the tin)
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

/**
 * One rate for stamina, so what you pay is what you get: `STAMINA_PER_POUND` stamina a pound, before a pack
 * discount (bigger packs a little cheaper a point). A stronger booster costs more each and does more each use: a gel
 * is small and cheap, a shot or an electrolyte drink a big refill when you're blowing.
 */
export const STAMINA_PER_POUND = 20;
const PACK_DISCOUNT: Record<number, number> = { 1: 1, 2: 0.95, 4: 0.9, 6: 0.85 };
const priced = (id: string, pack: number): Supply => {
  const per = ITEMS[id]?.use?.stamina ?? 0;
  return { id, pack, price: Math.max(1, Math.round(((per * pack) / STAMINA_PER_POUND) * (PACK_DISCOUNT[pack] ?? 1))) };
};

/** Cheapest a point first: gel 6 × 30, energy drink 4 × 60, shot 2 × 100, electrolyte 1 × 150. */
export const SUPPLIES: readonly Supply[] = [priced('stamina_gel', 6), priced('energy_drink', 4), priced('stamina_shot', 2), priced('electrolyte_drink', 1)];

/** Stamina a pack gives in all. */
export const packStamina = (s: Supply): number => (ITEMS[s.id]?.use?.stamina ?? 0) * s.pack;

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
    h('p', { class: 'hint', text: 'Stamina boosters, delivered to the door at once. You pay for stamina: the stronger the booster, the more each one does. They go on your hotbar’s stamina slot (3): 12 s between them, three a fight, two against a boss.' }),
    h('div', { class: 'sup-list' }, ...SUPPLIES.map((s) => {
      const d = ITEMS[s.id];
      const have = p.save.inventory.filter((x) => x.id === s.id).reduce((n, x) => n + x.qty, 0);
      return h('div', { class: 'sup-row' },
        h('img', { class: 'sup-icon', src: itemIconUrl(s.id), alt: '' }),
        h('div', { class: 'sup-text' }, h('b', { text: `${d.name} × ${s.pack}` }), h('span', { text: `${d.use?.text ?? ''} each, ${packStamina(s)} in all${have ? `. You've got ${have}` : ''}` })),
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
