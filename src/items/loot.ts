import type { ArchetypeId } from '../ai/archetypes';
import { ITEMS } from './items';

/**
 * Loot tables: what enemies drop and what you find searching bins, skips,
 * cars and drawers. Most rolls give a little cash or nothing much; good
 * valuables are rare, and the best things come from bosses and secrets.
 */
export interface LootEntry {
  id: string;
  weight: number;
  qty?: [number, number];
}

export interface LootTable {
  cash: [number, number];
  /** Chance that cash drops at all. */
  cashChance: number;
  /** Rolls on the item list. */
  rolls: number;
  /** Weight of "nothing" on each roll. */
  nothing: number;
  entries: LootEntry[];
}

const T = (cash: [number, number], cashChance: number, rolls: number, nothing: number, entries: LootEntry[]): LootTable => ({ cash, cashChance, rolls, nothing, entries });
const e = (id: string, weight: number, qty?: [number, number]): LootEntry => ({ id, weight, qty });

export const LOOT: Record<string, LootTable> = {
  // ---- enemies -----------------------------------------------------------------------
  street_basic: T([3, 10], 0.85, 1, 70, [
    e('phone_cheap', 8), e('watch_cheap', 6), e('chain_cheap', 5), e('can_of_pop', 6), e('sausage_roll', 5), e('lighter', 3), e('coin_rare', 1), e('bus_pass', 2),
  ]),
  street_mid: T([6, 18], 0.9, 1, 55, [
    e('phone_cheap', 8), e('watch_cheap', 5), e('watch_silver', 3), e('chain_silver', 2), e('bracelet_silver', 3), e('headphones', 2), e('energy_drink', 6),
    e('kebab', 4), e('cash_bundle', 1), e('ring_gold', 1), e('plasters', 4),
  ]),
  fighter: T([10, 25], 0.9, 1, 50, [
    e('phone_flagship', 2), e('watch_silver', 4), e('smartwatch', 3), e('headphones', 3), e('chain_silver', 3), e('protein_bar', 8), e('energy_drink', 8),
    e('mouthguard', 1), e('ring_gold', 2), e('first_aid', 2),
  ]),
  enforcer: T([20, 45], 1, 2, 45, [
    e('phone_flagship', 4), e('watch_gold', 3), e('chain_rope', 3), e('bracelet_gold', 2), e('earrings_diamond', 1), e('cash_bundle', 4), e('tablet', 2),
    e('sunglasses_designer', 2), e('coin_sovereign', 1), e('first_aid', 3), e('console', 1),
  ]),
  security: T([0, 8], 0.4, 1, 70, [e('torch', 0), e('water', 8), e('plasters', 5), e('w_torch', 3), e('protein_bar', 4)]),
  // ---- containers -----------------------------------------------------------------------
  bin: T([1, 5], 0.35, 1, 55, [
    e('can_of_pop', 6), e('chips', 4), e('phone_cheap', 2), e('scrap_metal', 4, [1, 2]), e('w_bottle', 6), e('match_ticket', 1), e('coin_rare', 1), e('plasters', 2),
  ]),
  dumpster: T([2, 8], 0.4, 2, 50, [
    e('scrap_metal', 8, [1, 3]), e('w_bottle', 5), e('w_plank', 3), e('w_chair_leg', 3), e('phone_cheap', 2), e('toby_jug', 1), e('vinyl_rare', 1), e('can_of_pop', 4),
  ]),
  skip: T([0, 6], 0.3, 2, 45, [
    e('scrap_metal', 10, [1, 4]), e('w_plank', 5), e('w_metal_bar', 3), e('w_pipe', 3), e('w_brick', 6), e('w_tv', 2), e('w_monitor', 2), e('candlestick', 1), e('lighter', 2),
  ]),
  car: T([2, 15], 0.7, 1, 40, [
    e('phone_cheap', 6), e('sunglasses', 5), e('headphones', 3), e('w_torch', 4), e('w_crowbar', 2), e('w_wrench', 2), e('can_of_pop', 5), e('cash_bundle', 1), e('smartwatch', 1),
  ]),
  drawers: T([5, 20], 0.7, 1, 35, [
    e('watch_cheap', 6), e('ring_gold', 3), e('earring_silver', 3), e('bracelet_silver', 3), e('coin_silver', 4, [1, 3]), e('old_fiver', 1), e('pocket_watch', 1), e('plasters', 5),
  ]),
  cupboard: T([0, 5], 0.3, 1, 35, [
    e('chips', 3), e('meal_deal', 3), e('flask_tea', 4), e('w_frying_pan', 3), e('w_knife', 2), e('first_aid', 2), e('w_mop', 3), e('w_broom', 3),
  ]),
  wardrobe_loot: T([0, 10], 0.4, 1, 35, [
    e('hoodie_grey', 3), e('tshirt_black', 3), e('jeans_black', 2), e('beanie', 3), e('cap_red', 2), e('belt_leather', 3), e('w_umbrella', 3), e('handbag_designer', 1),
  ]),
  crate: T([0, 4], 0.2, 1, 45, [e('scrap_metal', 8, [1, 3]), e('w_crowbar', 2), e('w_hammer', 3), e('w_wrench', 3), e('camera', 1), e('console', 1), e('energy_drink', 4)]),
  locker: T([3, 15], 0.6, 1, 40, [
    e('wraps', 3), e('protein_bar', 6), e('water', 6), e('headphones', 2), e('watch_silver', 2), e('runners', 1), e('mouthguard', 2), e('energy_drink', 4),
  ]),
  till: T([60, 140], 1, 0, 1, []),
};

/** Which table each kind of enemy drops from. */
export function lootTableFor(archetype: ArchetypeId | string): string {
  switch (archetype) {
    case 'thug':
    case 'hothead':
    case 'runner':
    case 'hooded':
      return 'street_basic';
    case 'bruiser':
    case 'defender':
    case 'tooled':
    case 'knifeman':
    case 'casual':
      return 'street_mid';
    case 'boxer':
    case 'kickboxer':
    case 'grappler':
      return 'fighter';
    case 'security':
      return 'security';
    default:
      return 'enforcer';
  }
}

export interface LootRoll {
  cash: number;
  items: { id: string; qty: number }[];
}

export function rollLoot(tableId: string, rng: () => number): LootRoll {
  const t = LOOT[tableId];
  const out: LootRoll = { cash: 0, items: [] };
  if (!t) return out;
  if (rng() < t.cashChance) out.cash = Math.round(t.cash[0] + rng() * (t.cash[1] - t.cash[0]));
  const entries = t.entries.filter((x) => ITEMS[x.id] && x.weight > 0);
  const total = entries.reduce((n, x) => n + x.weight, 0) + t.nothing;
  for (let r = 0; r < t.rolls; r++) {
    let pick = rng() * total;
    for (const x of entries) {
      pick -= x.weight;
      if (pick < 0) {
        const [lo, hi] = x.qty ?? [1, 1];
        out.items.push({ id: x.id, qty: lo + Math.floor(rng() * (hi - lo + 1)) });
        break;
      }
    }
  }
  return out;
}
