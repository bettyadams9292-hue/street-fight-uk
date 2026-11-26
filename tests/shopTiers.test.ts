/**
 * Shop tiers in every shop (items/shopTiers.ts): each shop's everyday stock is there from the start, its better
 * stock comes in after Sully, and its premium stock after Big Dunc; a locked piece can't be bought and says why.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { Progress, newSave } from '../src/progress/Progress';
import { BIKE_LIST, CAR_LIST, FURNITURE_LIST } from '../src/property/catalogue';
import { buyBike, buyCar, buyFurniture } from '../src/property/state';
import { GYM_KIT_LIST, buyGymKit } from '../src/training/gym';
import { EQUIPMENT_LIST } from '../src/business/catalogue';
import { buyEquipment } from '../src/business/basement';
import { JEWEL_LIST } from '../src/items/jewellery';
import { buyJewel } from '../src/items/jewelleryBox';
import { priceTier, rarityTier, SHOP_TIER_UNLOCK, type ShopTier } from '../src/items/shopTiers';

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
};

function fresh(flags: string[] = []): Progress {
  const p = new Progress(newSave(createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.cash.bank = 10_000_000;
  for (const f of flags) p.save.flags[f] = true;
  return p;
}
const stages: [string, string[], ShopTier][] = [['start', [], 1], ['after Sully', ['boss_sully'], 2], ['after Big Dunc', ['boss_sully', 'boss_dunc'], 3]];

interface Shop { name: string; tiers: ShopTier[]; buy: (p: Progress, i: number) => { ok: boolean; reason?: string } }
const shops: Shop[] = [
  { name: 'Sofa So Good', tiers: FURNITURE_LIST.map((f) => priceTier('furniture', f.price)), buy: (p, i) => buyFurniture(p, FURNITURE_LIST[i].id, FURNITURE_LIST[i].colours[0]) },
  { name: 'Arnold Shark', tiers: CAR_LIST.map((c) => priceTier('cars', c.price)), buy: (p, i) => buyCar(p, CAR_LIST[i].id, CAR_LIST[i].colours[0]) },
  { name: 'Halfrauds', tiers: BIKE_LIST.map((b) => priceTier('bikes', b.price)), buy: (p, i) => buyBike(p, BIKE_LIST[i].id, BIKE_LIST[i].colours[0]) },
  { name: 'PureGraft', tiers: GYM_KIT_LIST.map((k) => priceTier('gym', k.price)), buy: (p, i) => ((p.save.gym.owned = []), buyGymKit(p, GYM_KIT_LIST[i].id)) },
  { name: 'B&THC', tiers: EQUIPMENT_LIST.map((e) => e.tier), buy: (p, i) => buyEquipment(p, EQUIPMENT_LIST[i].id) },
  { name: 'H. Sterling', tiers: JEWEL_LIST.map((j) => rarityTier(j.rarity)), buy: (p, i) => buyJewel(p, JEWEL_LIST[i].id, JEWEL_LIST[i].finishes[0]) },
];

console.log('Shop tiers');
for (const s of shops) {
  ok(`${s.name}: something at every tier, and a start-of-game choice`, () => {
    for (const t of [1, 2, 3] as ShopTier[]) assert(s.tiers.includes(t), `tier ${t}`);
    assert(s.tiers.filter((t) => t === 1).length >= 2, 'at least two pieces from the start');
  });
  for (const [when, flags, top] of stages) {
    ok(`${s.name} ${when}: tiers up to ${top} sell, the rest are refused with the reason`, () => {
      s.tiers.forEach((t, i) => {
        if (s.name === 'B&THC' && EQUIPMENT_LIST[i].price === 0) return;
        const r = s.buy(fresh(flags), i);
        if (t <= top) assert(r.ok, `#${i} (tier ${t}) should sell: ${r.reason}`);
        else assert(!r.ok && r.reason === SHOP_TIER_UNLOCK[t].text, `#${i} (tier ${t}) should be locked, got ${r.reason}`);
      });
    });
  }
}

console.log(`\nshopTiers: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
