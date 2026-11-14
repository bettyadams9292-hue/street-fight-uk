/**
 * The pickup model list (no three.js, so tests can read it): Game ids, files in
 * public/models/pickups and display sizes. Loaded by pickups.ts.
 */

const ids = [
  // Food and first aid
  'chips', 'kebab', 'pasty', 'sausage_roll', 'meal_deal', 'bacon_butty', 'curry', 'fry_up', 'protein_bar',
  'energy_drink', 'can_of_pop', 'water', 'flask_tea', 'plasters', 'first_aid',
  's_crisps', 's_chocolate', 's_fruit', 's_biscuits',
  'm_sandwich', 'm_toast', 'm_cereal', 'm_beans_toast', 'm_scrambled', 'm_full_english', 'm_sausage_mash',
  'm_chicken_chips', 'm_steak', 'm_pasta', 'm_burger', 'm_curry',
  // Groceries and materials
  'g_bread', 'g_butter', 'g_cheese', 'g_ham', 'g_eggs', 'g_milk', 'g_cereal', 'g_beans', 'g_bacon', 'g_sausages',
  'g_potatoes', 'g_chicken', 'g_steak', 'g_pasta', 'g_sauce', 'g_mince', 'g_buns', 'g_curry_sauce', 'g_rice',
  'g_onions', 'g_mushrooms', 'g_tomatoes', 'g_peas', 'g_oven_chips',
  'scrap_metal', 'duct_tape', 'bolts', 'leather_strip', 'steel_bar', 'spring_steel', 'carbon_fibre', 'lighter',
  'bus_pass', 'bag_bumbag', 'bag_rucksack', 'bag_holdall',
  // Collectibles
  'signed_shirt', 'programme_1966', 'vintage_football', 'pocket_watch', 'toby_jug', 'candlestick', 'vinyl_rare', 'match_ticket',
  // Quest items
  'gaffer_ledger', 'lockup_key', 'vip_pass', 'dunc_phone', 'stadium_key',
] as const;
export type PickupId = (typeof ids)[number];
export const PICKUP_IDS: readonly PickupId[] = ids;

/** Game id -> file in public/models/pickups. */
export const PICKUP_FILES = Object.fromEntries(ids.map((id) => [id, `${id.replace(/_/g, '-')}.glb`])) as Record<PickupId, string>;

/** How big each one shows on the ground (largest side, metres): small things smaller, bags bigger. */
const SMALL: readonly PickupId[] = ['protein_bar', 'plasters', 's_chocolate', 's_fruit', 'lighter', 'bus_pass', 'match_ticket', 'pocket_watch', 'lockup_key', 'vip_pass', 'dunc_phone', 'stadium_key', 'bolts'];
const LARGE: readonly PickupId[] = ['bag_rucksack', 'bag_holdall', 'signed_shirt', 'first_aid'];
export function pickupSize(id: string): number | undefined {
  if (!(id in PICKUP_FILES)) return undefined;
  if (SMALL.includes(id as PickupId)) return 0.3;
  if (LARGE.includes(id as PickupId)) return 0.42;
  return 0.34;
}
