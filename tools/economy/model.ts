/**
 * The game's economy in one report: what each stage of the game pays, what there is to spend it on, and how
 * long the big purchases take on each kind of income. Run it after changing any price or reward:
 *
 *     npx tsx tools/economy/model.ts
 *
 * tests/economy.test.ts checks the same numbers stay inside the targets in docs/ECONOMY.md.
 */
import { BOSSES } from '../../src/ai/bosses';
import { ARCHETYPES } from '../../src/ai/archetypes';
import { LEVELS } from '../../src/world/levels';
import { ITEMS } from '../../src/items/items';
import { pawnOffer } from '../../src/items/shops';
import { UPGRADES, STYLE_LESSONS, MOVE_UNLOCKS as TECHNIQUES } from '../../src/progress/catalogue';
import { STYLE_CASH } from '../../src/training/styleGyms';
import { PROPERTY_LIST, MONTH, marketRent, valueNow } from '../../src/realty/catalogue';
import { businessStats } from '../../src/business/production';
import type { StrainId } from '../../src/business/catalogue';
import { defaultBasement } from '../../src/business/basement';
import { EQUIPMENT, BUSINESS_UPGRADES, IMPROVEMENT, TIERS, STARTUP_FEE } from '../../src/business/catalogue';
import { CAR_LIST as CARS, BIKE_LIST as BIKES } from '../../src/property/catalogue';
import { JEWEL_LIST, jewelPrice, jewelBuyback } from '../../src/items/jewellery';
import { bossDropValue } from '../../src/items/loot';

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export interface EconomyReport {
  story: { encounters: number; bosses: number; bossDrops: number; grunts: number; total: number };
  towns: { encounters: number; bosses: number; stashes: number; bossDrops: number; total: number };
  costs: { training: number; styles: number; techniques: number };
  business: { name: string; spend: number; perHour: number; payback: number }[];
  rentPerHour: { name: string; price: number; perHour: number; payback: number }[];
  hoursTo: Record<string, number>;
}

/** Cash from a level's encounters, the first time through (optional ones count once, at their full reward). */
function encounterCash(ids: readonly string[]): { enc: number; grunts: number } {
  let enc = 0;
  let grunts = 0;
  for (const id of ids) {
    const l = LEVELS[id as keyof typeof LEVELS];
    if (!l) continue;
    for (const e of l.encounters) {
      enc += e.reward.cash;
      for (const w of e.waves) for (const en of w.enemies) grunts += ARCHETYPES[en.archetype]?.cashDrop ?? 0;
    }
  }
  return { enc, grunts };
}

export function businessSetups(): { name: string; kit: string[]; ups: Partial<Record<string, number>>; imps: string[]; tier: number; strain: StrainId }[] {
  return [
    { name: 'Starter (2×2 tent, 200 W LED, 4-inch fan, Northern Lights)', kit: ['tent_s', 'led_rig', 'fan', 'clip_fan'], ups: {}, imps: [], tier: 0, strain: 'northern_lights' },
    { name: 'Mid (two 4×4s under 600 W HPS, Skunk #1)', kit: ['tent_l', 'tent_l', 'hps', 'hps', 'air_handler', 'fan', 'clip_fan', 'clip_fan', 'shelving', 'workbench2'], ups: { capacity: 1, efficiency: 1, automation: 1 }, imps: ['electrics', 'led_lighting'], tier: 1, strain: 'skunk' },
    { name: 'Full (grow room and twin tent, LED bars, Amnesia Haze)', kit: ['module', 'tent_d', ...Array(7).fill('light_bars'), 'air_system', 'air_system', 'clip_fan', 'clip_fan', 'climate', 'control', 'control', 'sensor', 'pallet_rack', 'workbench2'], ups: { capacity: 3, efficiency: 3, automation: 3, storage: 2 }, imps: ['three_phase', 'led_lighting', 'ducting'], tier: 3, strain: 'amnesia' },
  ];
}

export function businessReport(): EconomyReport['business'] {
  return businessSetups().map((s) => {
    const b = defaultBasement();
    b.tier = s.tier;
    b.equipment = s.kit.map((id, i) => ({ uid: `u${i}`, id, at: { x: 2 + i, z: -1, rot: 0 } })) as typeof b.equipment;
    for (const [k, v] of Object.entries(s.ups)) (b.upgrades as Record<string, number>)[k] = v!;
    b.improvements = s.imps;
    b.business.unitsSold = s.tier >= 3 ? 2500 : s.tier >= 1 ? 200 : 0;
    b.business.strain = s.strain;
    const st = businessStats(b);
    let spend = STARTUP_FEE + s.kit.reduce((n, id) => n + EQUIPMENT[id].price, 0) + s.imps.reduce((n, id) => n + IMPROVEMENT[id].price, 0);
    for (let t = 1; t <= s.tier; t++) spend += TIERS[t].price;
    for (const [k, v] of Object.entries(s.ups)) for (let l = 0; l < v!; l++) spend += BUSINESS_UPGRADES[k as keyof typeof BUSINESS_UPGRADES].cost[l];
    if (!st.ready) throw new Error(`${s.name}: not ready (${st.missing.join(', ')})`);
    return { name: s.name, spend, perHour: st.profitPerHour, payback: spend / Math.max(1, st.profitPerHour) };
  });
}

/**
 * Play on from the end of the towns, an hour at a time in tenths: the mid business is running, the full one is
 * bought as soon as it's affordable, and every property is bought in price order and let out, at the market's
 * price on the day (the full business first: it pays back fastest). Returns the hours until each place is owned, plus 'first mansion': the hours until the
 * cheapest mansion is affordable if you only buy lettings that cost under a quarter of it on the way.
 */
export function playAfterTowns(startCash: number, business: EconomyReport['business']): Record<string, number> {
  const out: Record<string, number> = {};
  const run = (greedy: boolean) => {
    let cash = Math.max(0, startCash);
    let full = false;
    const owned = new Set<string>();
    const order = [...PROPERTY_LIST].sort((a, b) => a.price - b.price);
    const mansion = order.find((d) => d.cat === 'mansion')!;
    for (let t = 0; t < 400; t += 0.1) {
      const play = 3600 * t;
      if (!full && cash >= business[2].spend - business[1].spend) {
        cash -= business[2].spend - business[1].spend;
        full = true;
        if (!greedy) out['full business'] = t;
      }
      if (!greedy && cash >= valueNow(mansion, play)) {
        out['first mansion'] = t;
        return;
      }
      // The full business pays back fastest, so it comes first; lettings after.
      for (const d of full ? order : []) {
        if (owned.has(d.id)) continue;
        const price = valueNow(d, play);
        if (!greedy && (d.cat === 'mansion' || price > valueNow(mansion, play) * 0.25)) continue;
        if (cash < price) break;
        cash -= price;
        owned.add(d.id);
        if (greedy) out[d.name] = t;
      }
      if (greedy && owned.size === order.length) return;
      let perHour = full ? business[2].perHour : business[1].perHour;
      for (const id of owned) perHour += (marketRent(PROPERTY_LIST.find((d) => d.id === id)!, play) * 3600) / MONTH;
      cash += perHour * 0.1;
    }
  };
  run(false);
  run(true);
  return out;
}

export function economyReport(): EconomyReport {
  const storyLevels = Object.keys(LEVELS).filter((id) => !/^t\d+d\d+$/.test(id));
  const townLevels = Object.keys(LEVELS).filter((id) => /^t\d+d\d+$/.test(id));
  const s = encounterCash(storyLevels);
  const t = encounterCash(townLevels);
  const bosses = Object.values(BOSSES);
  const storyBosses = bosses.filter((b) => !/^town\d+$/.test(b.id));
  const townBosses = bosses.filter((b) => /^town\d+$/.test(b.id));
  const drops = (list: typeof bosses) => list.reduce((n, b) => n + bossDropValue(b.drops ?? []), 0);
  let stashes = 0;
  for (const id of townLevels) for (const p of LEVELS[id as keyof typeof LEVELS].pickups) if (p.kind === 'cash') stashes += p.amount ?? 0;
  const story = { encounters: s.enc, bosses: storyBosses.reduce((n, b) => n + b.reward.cash, 0), bossDrops: drops(storyBosses), grunts: s.grunts, total: 0 };
  story.total = story.encounters + story.bosses + story.bossDrops + story.grunts;
  const towns = { encounters: t.enc + t.grunts, bosses: townBosses.reduce((n, b) => n + b.reward.cash, 0), stashes, bossDrops: drops(townBosses), total: 0 };
  towns.total = towns.encounters + towns.bosses + towns.stashes + towns.bossDrops;

  const training = Object.values(UPGRADES).reduce((n, u) => { let c = 0; for (let r = 0; r < u.maxRank; r++) c += u.cost(r); return n + c; }, 0);
  const styles = STYLE_LESSONS.reduce((n, l) => n + l.cost, 0) + STYLE_LESSONS.length * STYLE_CASH.reduce((a, b) => a + b, 0);
  const techniques = Object.values(TECHNIQUES).reduce((n, x) => n + x.cost, 0);

  const business = businessReport();
  const rentPerHour = PROPERTY_LIST.map((d) => {
    const perHour = (marketRent(d, 0) * 3600) / MONTH;
    return { name: d.name, price: d.price, perHour, payback: d.price / perHour };
  });

  const hoursTo = playAfterTowns(story.total + towns.total - (training + styles + techniques) * 0.6, business);
  return { story, towns, costs: { training, styles, techniques }, business, rentPerHour, hoursTo };
}

if (process.argv[1]?.endsWith('model.ts')) {
  const r = economyReport();
  console.log('STORY (first time through)');
  console.log(`  encounters ${gbp(r.story.encounters)} · grunts ${gbp(r.story.grunts)} · boss cash ${gbp(r.story.bosses)} · boss drops (pawn/buyback) ${gbp(r.story.bossDrops)} · total ${gbp(r.story.total)}`);
  console.log('TOWNS 1-6');
  console.log(`  encounters ${gbp(r.towns.encounters)} · boss cash ${gbp(r.towns.bosses)} · stashes ${gbp(r.towns.stashes)} · boss drops ${gbp(r.towns.bossDrops)} · total ${gbp(r.towns.total)}`);
  console.log('SPEND ON YOURSELF');
  console.log(`  training ${gbp(r.costs.training)} · styles ${gbp(r.costs.styles)} · techniques ${gbp(r.costs.techniques)}`);
  console.log('BUSINESS');
  for (const b of r.business) console.log(`  ${b.name}: spend ${gbp(b.spend)} · ${gbp(b.perHour)}/h · pays back in ${b.payback.toFixed(1)} h`);
  console.log('RENT (going rate, per hour of play)');
  for (const p of r.rentPerHour) console.log(`  ${p.name.padEnd(36)} ${gbp(p.price).padStart(11)} · ${gbp(p.perHour)}/h · pays back in ${p.payback.toFixed(0)} h`);
  console.log('HOURS AFTER THE TOWNS (market prices on the day; lettings bought in price order and let)');
  for (const [k, v] of Object.entries(r.hoursTo)) console.log(`  ${k.padEnd(36)} ${v.toFixed(1)} h`);
  console.log('CARS', CARS.map((c) => `${c.name} ${gbp(c.price)}`).join(' · '));
  console.log('BIKES', BIKES.map((c) => `${c.name} ${gbp(c.price)}`).join(' · '));
  const jp = JEWEL_LIST.map((j) => jewelPrice(j, 'gold9'));
  console.log(`JEWELLERY ${JEWEL_LIST.length} designs, 9ct ${gbp(Math.min(...jp))}–${gbp(Math.max(...jp))}, buyback ${gbp(jewelBuyback(JEWEL_LIST[0], 'gold9'))} on the cheapest`);
  void ITEMS;
  void pawnOffer;
}
