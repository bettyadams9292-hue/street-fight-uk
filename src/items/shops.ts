/**
 * Shop and pawn rules, kept free of UI so they can be tested: what Threads
 * stocks, what it charges, what Mr Kaur offers, and buying.
 */
import type { Progress } from '../progress/Progress';
import type { ItemStack } from './Inventory';
import { ITEMS, type ItemDef } from './items';

export const SHOP_STOCK: string[] = [
  'hoodie_grey', 'hoodie_black', 'designer_hoodie', 'tracksuit_top', 'tracksuit_top_red', 'tshirt_white', 'tshirt_black', 'football_home', 'football_away',
  'bomber_jacket', 'puffer_black', 'puffer_red', 'leather_jacket', 'denim_jacket', 'long_coat', 'vest_white', 'workwear_hivis',
  'trackies_black', 'joggers_grey', 'jeans_blue', 'jeans_black', 'cargos_khaki', 'shorts_black',
  'trainers_white', 'runners', 'hitops_black', 'boots_work', 'steel_toecaps',
  'cap_black', 'cap_red', 'beanie', 'sunglasses', 'snood', 'chain_silver', 'chain_gold', 'watch_basic', 'earring_silver', 'ring_signet', 'belt_leather',
  'wraps', 'mouthguard', 'headguard', 'bag_bumbag', 'bag_rucksack', 'bag_holdall',
];

export function shopPrice(d: ItemDef, mult: number): number {
  return Math.round(d.value * mult);
}

/** What the pawnbroker pays for one. Stolen goods fetch less; quest items and rubbish nothing. */
export function pawnOffer(d: ItemDef, st: Pick<ItemStack, 'stolen'>): number {
  if (d.unsellable || d.questFlag || d.value <= 0) return 0;
  const base = d.category === 'valuable' || d.category === 'collectible' ? 0.55 : d.category === 'misc' ? 0.6 : 0.35;
  return Math.max(1, Math.round(d.value * base * (st.stolen ? 0.6 : 1)));
}

export type BuyResult = { ok: true; price: number; where: 'pocket' | 'storage' } | { ok: false; reason: string };

/** Buy one from a shop: pays pocket first, then the tin; full pockets mean it's delivered home. */
export function buyItem(p: Progress, id: string, mult: number, stock: readonly string[] = SHOP_STOCK): BuyResult {
  const d = ITEMS[id];
  if (!d || !stock.includes(id)) return { ok: false, reason: 'They don’t sell that.' };
  const price = shopPrice(d, mult);
  if (!p.pay(price)) return { ok: false, reason: `You need £${price}. Pocket money first, then the tin at home.` };
  const left = p.giveItem(id);
  if (left) {
    p.stashNew(id);
    return { ok: true, price, where: 'storage' };
  }
  return { ok: true, price, where: 'pocket' };
}
