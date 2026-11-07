/**
 * Robbing a shop, and getting nicked for it. Pure rules on Progress and World,
 * so the consequences can be tested: every robbery closes the shop for a while,
 * raises your prices there, gets you a reputation with the police, pays less
 * each time and gets harder each time. Stolen goods are marked and are what the
 * police take off you.
 */
import type { Fighter } from '../fighter/Fighter';
import { ITEMS } from '../items/items';
import { SHOP_STOCK } from '../items/shops';
import type { Progress } from '../progress/Progress';
import type { World } from './World';

/** Trips the shop stays shut after a robbery. */
export const ROBBERY_CLOSED_TRIPS = 8;
/** Heat at or above this and any defeat on the street means you're nicked. */
export const ARREST_HEAT = 60;

export interface RobberyOutcome {
  grabbed: string[];
  /** The shopkeeper fought back instead of handing over the till. */
  resisted: boolean;
  /** A security guard joined in (repeat robberies). */
  guard: Fighter | null;
  till: number;
  heat: number;
  /** Police on the way: how many, and in how many frames. */
  police: number;
  alarmIn: number;
}

/** The shops you can rob, who's behind the counter, and what you can grab. */
export const ROBBABLE: Record<string, { area: 'clothes_shop' | 'pawn_shop' | 'pub'; counter: string; keeper: string; grab: readonly string[] }> = {
  threads: {
    area: 'clothes_shop',
    counter: 'clothes_counter',
    keeper: 'Priya',
    grab: SHOP_STOCK.filter((id) => ITEMS[id]?.category === 'clothing' && ITEMS[id].value >= 25),
  },
  pawn: {
    area: 'pawn_shop',
    counter: 'pawn_counter',
    keeper: 'Mr Kaur',
    // Out of the display cabinets.
    grab: ['watch_basic', 'watch_silver', 'chain_silver', 'chain_gold', 'ring_signet', 'phone_cheap', 'headphones', 'coin_silver', 'earring_silver', 'smartwatch', 'handheld'].filter((id) => ITEMS[id]),
  },
  pub: {
    area: 'pub',
    counter: 'bar',
    keeper: 'Ray',
    // The night's takings bagged up behind the bar, and whatever's in the lost-property box.
    grab: ['cash_bundle', 'cash_bundle', 'lighter', 'phone_cheap'].filter((id) => ITEMS[id]),
  },
};

/** What robbing `shopId` would do right now (without doing it): for the confirm prompt. */
export function robberyRisk(p: Progress, shopId: string): { times: number; heat: number } {
  const times = p.shop(shopId).robberies;
  return { times, heat: 45 + times * 15 };
}

export function robShop(p: Progress, w: World, shopId: string, keeper: Fighter | null, rng: () => number = Math.random): RobberyOutcome {
  const shop = p.shop(shopId);
  const times = shop.robberies;
  shop.robberies++;
  shop.closedUntil = p.save.trips + ROBBERY_CLOSED_TRIPS;
  shop.priceMult = Math.min(2, shop.priceMult + 0.25);
  p.save.stats.robberies++;
  const heat = 45 + times * 15;
  p.addHeat(heat);
  // Grab what's on display: fewer each time (they've moved the good stuff), all marked stolen.
  const pool = ROBBABLE[shopId]?.grab ?? [];
  const grabbed: string[] = [];
  const n = Math.max(1, 3 - times);
  for (let i = 0; i < n && pool.length; i++) {
    const id = pool[Math.floor(rng() * pool.length) % pool.length];
    const left = p.giveItem(id, 1, { stolen: true });
    if (left) w.dropOnGround(left, w.player.pos.x, w.player.pos.z);
    grabbed.push(id);
  }
  // First time she might just hand it over; after that she's ready for you.
  const resists = times > 0 || rng() < 0.35;
  let guard: Fighter | null = null;
  let till = 0;
  if (resists && keeper) {
    w.turnHostile(keeper, 'defender');
    if (times > 0) {
      guard = w.spawnEnemy('security', w.player.pos.x + 3, 0.2);
      guard.facing = -1;
    }
    // The till is there for the taking if you get past her.
    p.set(`${shopId}_robbable`);
  } else {
    till = Math.round((60 + rng() * 80) / (1 + times));
    p.addCash(till);
  }
  const police = times > 0 ? 3 : 2;
  const alarmIn = 60 * 12;
  w.raiseAlarm(shopId, alarmIn, police);
  return { grabbed, resisted: resists && !!keeper, guard, till, heat, police, alarmIn };
}

/** Caught: stolen goods seized, a fine (15%, at least £25, never more than you have), heat wiped. */
export function arrest(p: Progress): { fine: number; seized: number } {
  const seized = p.confiscateStolen();
  const total = p.save.cash.bank + p.save.cash.pocket;
  const fine = Math.min(total, Math.max(25, Math.round(total * 0.15)));
  p.pay(fine);
  p.save.heat = 0;
  p.save.stats.arrests++;
  return { fine, seized };
}
