/**
 * Shop and pawn rules, kept free of UI so they can be tested: what JD Streets
 * stocks, what it charges, what Mr Kaur offers, and buying.
 */
import type { Progress } from '../progress/Progress';
import type { ItemStack } from './Inventory';
import { BAG_SLOTS, ITEMS, type ItemDef } from './items';
import { tierLock } from './shopTiers';

export const SHOP_STOCK: string[] = [
  'hoodie_grey', 'hoodie_black', 'designer_hoodie', 'tracksuit_top', 'tracksuit_top_red', 'tshirt_white', 'tshirt_black', 'football_home', 'football_away',
  'hoodie_navy', 'tshirt_grey', 'tracksuit_top_grey', 'polo_navy', 'polo_white', 'polo_bottle', 'shirt_oxford', 'shirt_check',
  'jumper_navy', 'jumper_oat', 'quarter_zip_black', 'quarter_zip_grey', 'gilet_black', 'gilet_olive', 'windbreaker', 'windbreaker_retro',
  'harrington_stone', 'harrington_black',
  // Luxury and Iconic (tiers 4 and 5): gearBonus.ts
  'designer_tracksuit_top', 'designer_trackies', 'luxury_puffer', 'luxury_leather', 'luxury_jeans', 'designer_trainers', 'luxury_runners',
  'iconic_hoodie', 'iconic_joggers', 'iconic_puffer', 'grail_trainers', 'iconic_boots',
  'bomber_jacket', 'puffer_black', 'puffer_red', 'puffer_navy', 'leather_jacket', 'denim_jacket', 'long_coat', 'vest_white', 'workwear_hivis',
  'trackies_black', 'trackies_navy', 'joggers_grey', 'joggers_black', 'jeans_blue', 'jeans_black', 'jeans_light', 'chinos_stone', 'chinos_navy',
  'cargos_khaki', 'cargo_shorts', 'denim_shorts', 'shorts_black',
  'trainers_white', 'trainers_black', 'trainers_navy', 'runners', 'runners_red', 'hitops_black', 'hitops_white', 'boots_work', 'steel_toecaps',
  'cap_black', 'cap_red', 'cap_navy', 'cap_white', 'beanie', 'beanie_red', 'beanie_grey', 'bucket_hat', 'bucket_hat_black', 'flat_cap',
  // Chains, watches, rings, bracelets and earrings are the jeweller's (H. Sterling, Riverside Centre), not JD Streets'.
  'sunglasses', 'glasses', 'snood', 'belt_leather',
  'wraps', 'mouthguard', 'headguard', 'bag_bumbag', 'bag_rucksack', 'bag_holdall', 'bag_hiking',
];

export function shopPrice(d: ItemDef, mult: number): number {
  return Math.round(d.value * mult);
}

/** Stash Converters on the High Street pays this share of Cash Degenerator's offer: the worst rates in the game. */
export const PAWN_HATCH_RATE = 0.6;

/** What the pawnbroker pays for one. Stolen goods fetch less; quest items and rubbish nothing. */
export function pawnOffer(d: ItemDef, st: Pick<ItemStack, 'stolen'>): number {
  if (d.unsellable || d.questFlag || d.value <= 0) return 0;
  const base = d.category === 'valuable' || d.category === 'collectible' ? 0.55 : d.category === 'misc' ? 0.6 : 0.35;
  return Math.max(1, Math.round(d.value * base * (st.stolen ? 0.6 : 1)));
}

export type BuyResult = { ok: true; price: number; where: 'pocket' | 'storage' | 'worn' } | { ok: false; reason: string };

/** Buy one from a shop: pays pocket first, then the tin; full pockets mean it's delivered home. */
export function buyItem(p: Progress, id: string, mult: number, stock: readonly string[] = SHOP_STOCK): BuyResult {
  const d = ITEMS[id];
  if (!d || !stock.includes(id)) return { ok: false, reason: 'They don’t sell that.' };
  // The better labels come in as the story goes on (items/shopTiers.ts).
  const lock = tierLock(p, d);
  if (lock) return { ok: false, reason: `Not in stock yet. ${lock}.` };
  // A bag: one of each is plenty. A bigger one than you've got on goes straight on your back.
  const bag = BAG_SLOTS[id];
  const worn = p.save.worn.back;
  if (bag && [...p.save.inventory, ...p.save.storage, ...(worn ? [worn] : [])].some((s) => s.id === id)) return { ok: false, reason: 'You’ve already got one of those.' };
  const price = shopPrice(d, mult);
  if (!p.pay(price)) return { ok: false, reason: `You need £${price}. Cash on you first, then your card.` };
  if (bag && (!worn || (BAG_SLOTS[worn.id] ?? 0) < bag)) {
    // The old bag goes in your pockets, or home to the stash if there's no room.
    p.wearNew(id);
    if (worn) {
      const back = p.save.storage.find((x) => x.uid === worn.uid);
      if (back && p.spaceFor(back.id) > 0) p.withdraw(back.uid, 1);
    }
    return { ok: true, price, where: 'worn' };
  }
  const left = p.giveItem(id);
  if (left) {
    p.stashNew(id);
    return { ok: true, price, where: 'storage' };
  }
  return { ok: true, price, where: 'pocket' };
}
