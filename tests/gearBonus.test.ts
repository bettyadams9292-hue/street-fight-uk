/**
 * Clothes and jewellery bonuses (src/items/gearBonus.ts): every piece of clothing has stats from its style and
 * tier, better tiers give more, a whole fit or a matching set adds a buff, and worn jewellery gives an XP bonus
 * (capped) and a buff that reaches the fighter.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { ITEMS, type ItemStat } from '../src/items/items';
import { SHOP_STOCK } from '../src/items/shops';
import { JEWELS } from '../src/items/jewellery';
import { clothingStats, jewelBonus, outfitBuffs, tierOf, xpBonusOf, XP_BONUS_CAP } from '../src/items/gearBonus';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}

const fresh = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
/** How big a stat is, whatever its kind: attributes and flats by their add, multipliers by how far from 1. */
const size = (st: ItemStat[] | undefined) => (st ?? []).reduce((n, s) => n + Math.abs(s.add ?? 0) + Math.abs((s.mul ?? 1) - 1) * 100, 0);
const wear = (p: Progress, id: string) => {
  const d = ITEMS[id];
  p.save.worn[d.wear!.slot] = p.newStack(id, 1);
};
const fighter = (p: Progress) => new World(LEVELS.estate, p, { entry: LEVELS.estate.entries[0].id, seed: 1, civilians: false }).player;

console.log('Clothes and jewellery bonuses');

test('every top, pair of bottoms and pair of shoes has stats', () => {
  for (const d of Object.values(ITEMS)) if (d.category === 'clothing') assert(d.stats?.length, `${d.id} has no stats`);
});

test('a better tier of the same style gives more', () => {
  for (const style of ['tracksuit', 'puffer', 'hoodie', 'leather'] as const) {
    let last = -1;
    for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const) {
      const n = size(clothingStats({ rarity, wear: { slot: 'top', top: style, colour: '#000' } }));
      assert(n > last, `${style} ${rarity}: ${n} after ${last}`);
      last = n;
    }
  }
});

test('JD Streets sells every tier, from Basic to Iconic', () => {
  const tiers = new Set(SHOP_STOCK.filter((id) => ITEMS[id]?.category === 'clothing').map((id) => tierOf(ITEMS[id].rarity)));
  for (const t of [1, 2, 3, 4, 5]) assert(tiers.has(t), `no tier ${t} clothes for sale`);
});

test('what you wear reaches your fighter', () => {
  const p = fresh();
  const base = fighter(p).stats.attr('speed');
  wear(p, 'designer_tracksuit_top');
  assert(fighter(p).stats.attr('speed') === base + 4, 'a Luxury tracksuit top is +4 Speed');
});

test('a whole fit in one tier, and a matching set, add buffs that reach the fighter', () => {
  const p = fresh();
  wear(p, 'tracksuit_top');
  wear(p, 'trackies_black');
  wear(p, 'trainers_white');
  const names = p.buffs().map((b) => b.name);
  assert(names.includes('Full tracky'), `tracky set: ${names}`);
  assert(!names.some((n) => n === 'Fresh'), 'all Basic: no fit buff');
  const f0 = fighter(p);
  wear(p, 'designer_tracksuit_top');
  wear(p, 'designer_trackies');
  wear(p, 'designer_trainers');
  const n2 = p.buffs().map((b) => b.name);
  assert(n2.includes('Dripping') && n2.includes('Full tracky'), `Luxury fit: ${n2}`);
  const f1 = fighter(p);
  assert(f1.stats.damageMultiplier > f0.stats.damageMultiplier, 'the fit buff adds damage');
  assert(f1.stats.damageTakenMultiplier < f0.stats.damageTakenMultiplier, 'and takes some off');
  assert(outfitBuffs({}).length === 0, 'nothing on, no buffs');
});

test('jewellery: rarer pieces and better metals give more XP; a diamond more again', () => {
  const steel = jewelBonus(JEWELS.w_digital, 'steel').xp;
  const plat = jewelBonus(JEWELS.r_halo, 'platinum').xp;
  const gold = jewelBonus(JEWELS.r_halo, 'white').xp;
  assert(steel > 0 && plat > gold && gold > steel, `${steel} ${gold} ${plat}`);
  assert(jewelBonus(JEWELS.r_solitaire, 'white').xp > jewelBonus(JEWELS.r_designer, 'white').xp, 'diamond adds XP');
  for (const d of Object.values(JEWELS)) for (const f of d.finishes) assert(jewelBonus(d, f).stats.length, `${d.id} ${f} has a buff`);
});

test('worn jewellery adds XP to what you earn, and the bonus is capped', () => {
  const p = fresh();
  p.save.jewellery.owned.push({ uid: 'j1', id: 'r_champion', finish: 'gold18', paid: 0, at: 0 });
  p.save.jewellery.worn.ring = 'j1';
  const bonus = p.xpBonus;
  assert(bonus > 0.1, `champion's ring: ${bonus}`);
  const before = p.save.xp;
  p.addXp(20);
  assert(p.save.xp - before === Math.round(20 * (1 + bonus)), `got ${p.save.xp - before}`);
  const all = Object.values(JEWELS).filter((d) => d.rarity === 'legendary').slice(0, 6).map((d) => ({ id: d.id, finish: d.finishes[0] }));
  assert(xpBonusOf([...all, ...all]) === XP_BONUS_CAP, 'capped');
  const q = fresh();
  const b2 = q.save.xp;
  q.addXp(20);
  assert(q.save.xp - b2 === 20, 'no jewellery, no bonus');
});

test('jewellery buffs reach the fighter, and four or more pieces is drip', () => {
  const p = fresh();
  const f0 = fighter(p);
  const pieces = [['ring', 'r_signet_onyx', 'gold9'], ['watch', 'w_chrono', 'steel'], ['necklace', Object.values(JEWELS).find((d) => d.cat === 'necklace')!.id, ''], ['bracelet', 'b_curb', 'gold9']] as const;
  pieces.forEach(([cat, id, fin], i) => {
    const d = JEWELS[id];
    p.save.jewellery.owned.push({ uid: `j${i}`, id, finish: (fin || d.finishes[0]) as never, paid: 0, at: 0 });
    p.save.jewellery.worn[cat] = `j${i}`;
  });
  const f1 = fighter(p);
  assert(f1.stats.damageMultiplier > f0.stats.damageMultiplier, 'ring: damage');
  assert(f1.stats.maxPoise > f0.stats.maxPoise, 'necklace and onyx: poise');
  assert(p.buffs().some((b) => b.id === 'drip'), 'drip');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
