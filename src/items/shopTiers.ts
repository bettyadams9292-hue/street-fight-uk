/**
 * Shop tiers: what the shops will sell you depends on how far into the story you are. Early on it's the basics
 * (Tier 1: Basic and Branded clothes, the everyday kit); once Sully's beaten the better labels come in (Tier 2:
 * Designer); once Big Dunc's down, the premium gear (Tier 3: Luxury and Iconic). Everything's still on the rails to
 * look at and try on, with what it takes to unlock it, so there's always something better to work towards.
 *
 * The clothes' own tiers are their rarity (items/gearBonus.ts `TIER_OF`, Basic to Iconic); this maps them onto the
 * three shop tiers. Bags, fight kit and non-clothing stay Tier 1 (bags are priced by size already). Used by
 * `buyItem` (items/shops.ts) and the JD Streets screen.
 */
import type { Progress } from '../progress/Progress';
import { TIER_OF } from './gearBonus';
import type { ItemDef } from './items';

export type ShopTier = 1 | 2 | 3;

export const SHOP_TIER_NAMES: Record<ShopTier, string> = { 1: 'Everyday', 2: 'Better labels', 3: 'Premium' };

/** The story boss that brings each shop tier in, and how the shops put it. */
export const SHOP_TIER_UNLOCK: Record<ShopTier, { flag: string | null; text: string }> = {
  1: { flag: null, text: '' },
  2: { flag: 'boss_sully', text: 'Comes in once you’ve dealt with Sully' },
  3: { flag: 'boss_dunc', text: 'Comes in once Big Dunc’s been put down' },
};

/** The best shop tier open to you now. */
export function shopTier(p: Progress): ShopTier {
  if (p.has(SHOP_TIER_UNLOCK[3].flag!)) return 3;
  if (p.has(SHOP_TIER_UNLOCK[2].flag!)) return 2;
  return 1;
}

/** Which shop tier an item belongs to: clothes by their own tier, everything else Tier 1. */
export function itemShopTier(d: ItemDef): ShopTier {
  if (d.category !== 'clothing' || d.id.startsWith('bag_')) return 1;
  const t = TIER_OF[d.rarity] ?? 1;
  return t >= 4 ? 3 : t === 3 ? 2 : 1;
}

/** Null if you can buy it; otherwise why not yet. */
export function tierLock(p: Progress, d: ItemDef): string | null {
  const need = itemShopTier(d);
  return need <= shopTier(p) ? null : SHOP_TIER_UNLOCK[need].text;
}
