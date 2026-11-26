/**
 * The economy stays inside the targets in docs/ECONOMY.md. The numbers come from tools/economy/model.ts, which
 * prints the full report; this only checks the targets, so a price change that breaks the curve fails here.
 */
import { economyReport } from '../tools/economy/model';
import { BOSSES } from '../src/ai/bosses';
import { bossDropValue } from '../src/items/loot';
import { ITEMS } from '../src/items/items';
import { JEWEL_ITEMS, JEWELS, jewelPrice } from '../src/items/jewellery';
import { SHOP_STOCK } from '../src/items/shops';
import { arrestFine, FINE_CAP_BASE, FINE_CAP_PER_LEVEL } from '../src/world/robbery';
import { LEVEL_CAP } from '../src/progress/catalogue';
import { marketIndex } from '../src/realty/catalogue';
import { COMP_PRIZES, COMP_TICKET, DRAW_PRIZES, DRAW_TICKET, SLOT_PAYS, SLOT_SYMBOLS, SLOT_WEIGHTS, compOdds, prizeValue, rouletteReturn } from '../src/property/casino';

let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}

const r = economyReport();
console.log('Economy');

test('the story pays £20k–£40k, enough for most of your training', () => {
  assert(r.story.total >= 20000 && r.story.total <= 40000, `story £${Math.round(r.story.total)}`);
  assert(r.story.total >= r.costs.training * 1.2, 'the story does not cover training');
});

test('the towns pay £50k–£90k, enough for the full business by the end', () => {
  assert(r.towns.total >= 50000 && r.towns.total <= 90000, `towns £${Math.round(r.towns.total)}`);
  assert(r.story.total + r.towns.total - (r.costs.training + r.costs.styles) * 0.6 >= r.business[2].spend - r.business[1].spend, 'the full business is out of reach after the towns');
});

test('bosses pay mostly in cash: every purse is at least 90% of what its drops sell for', () => {
  for (const b of Object.values(BOSSES)) {
    const drops = bossDropValue(b.drops ?? []);
    assert(b.reward.cash >= drops * 0.9, `${b.name}: £${b.reward.cash} cash, £${drops} of loot`);
  }
});

test('every business setup pays for itself within 8 hours of play', () => {
  for (const b of r.business) assert(b.payback <= 8, `${b.name}: ${b.payback.toFixed(1)} h`);
});

test('every property pays for itself in 8–20 hours of letting', () => {
  for (const p of r.rentPerHour) assert(p.payback >= 8 && p.payback <= 20, `${p.name}: ${p.payback.toFixed(0)} h`);
});

test('after the towns: the first mansion in 20–40 hours, everything in 40–70', () => {
  const first = r.hoursTo['first mansion'];
  const all = Math.max(...Object.entries(r.hoursTo).filter(([k]) => k !== 'first mansion' && k !== 'full business').map(([, v]) => v));
  assert(first >= 20 && first <= 40, `first mansion ${first.toFixed(1)} h`);
  assert(all >= 40 && all <= 70, `everything ${all.toFixed(1)} h`);
});

test('house prices grow gently and settle: never more than 1.8x, never runaway', () => {
  for (const tier of ['budget', 'mid', 'prime', 'super'] as const) {
    const at30h = marketIndex(tier, 180);
    assert(at30h < 1.6, `${tier} is ${at30h.toFixed(2)}x after 30 hours`);
  }
});

test('loot jewellery is a real jeweller piece, priced the same both ways, and JD Streets does not sell jewellery', () => {
  for (const [id, look] of Object.entries(JEWEL_ITEMS)) {
    const d = JEWELS[look.id];
    assert(d && d.finishes.includes(look.finish), `${id}: no such piece`);
    assert(ITEMS[id].value === jewelPrice(d, look.finish), `${id}: £${ITEMS[id].value} as loot, £${jewelPrice(d, look.finish)} at the jeweller`);
  }
  for (const id of SHOP_STOCK) assert(!['chain_silver', 'chain_gold', 'watch_basic', 'ring_signet'].includes(id) && !JEWEL_ITEMS[id], `JD Streets sells ${id}`);
});

test('the arrest fine is capped by level and never more than you have', () => {
  for (let lvl = 1; lvl <= LEVEL_CAP; lvl++) assert(arrestFine(1e6, 1e7, lvl) === FINE_CAP_BASE + FINE_CAP_PER_LEVEL * lvl, `level ${lvl}`);
  assert(arrestFine(12, 0, 5) === 12, 'fined more than you had');
});

test('medicine heals more per pound than any food, so it is worth buying', () => {
  const perPound = (id: string) => ((ITEMS[id].use?.heal ?? 0) + (ITEMS[id].use?.healPct ?? 0) * 150) / ITEMS[id].value;
  const meds = Math.min(perPound('plasters'), perPound('first_aid'));
  for (const d of Object.values(ITEMS)) if (d.use?.needs && d.value > 0) assert(perPound(d.id) < meds, `${d.name} heals £${perPound(d.id).toFixed(1)}/£ against medicine's ${meds.toFixed(1)}`);
});

test('the casino never pays back more than it takes, on any game', () => {
  const total = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  const pr = (k: keyof typeof SLOT_WEIGHTS) => SLOT_WEIGHTS[k] / total;
  let slots = SLOT_SYMBOLS.reduce((n, k) => n + pr(k) ** 3 * SLOT_PAYS[k], 0);
  slots += 3 * pr('🍒') ** 2 * (1 - pr('🍒')) * 2;
  assert(slots < 1, `slots return ${(slots * 100).toFixed(0)}%`);
  for (const bet of [{ kind: 'red' }, { kind: 'even' }, { kind: 'low' }, { kind: 'dozen', dozen: 1 }, { kind: 'number', number: 7 }] as const) {
    let ret = 0;
    for (let n = 0; n <= 36; n++) ret += rouletteReturn(bet, n, 1) / 37;
    assert(ret < 1, `roulette ${bet.kind} returns ${(ret * 100).toFixed(1)}%`);
  }
  const draw = DRAW_PRIZES.reduce((n, d) => n + (d.weight / 100) * d.cash, 0) / DRAW_TICKET;
  assert(draw < 1, `prize draw returns ${(draw * 100).toFixed(0)}%`);
  for (const p of COMP_PRIZES) {
    const ev = prizeValue(p) / compOdds(p) / COMP_TICKET;
    assert(ev < 1, `competition on ${p.id} returns ${(ev * 100).toFixed(0)}%`);
  }
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
if (failed) process.exit(1);
