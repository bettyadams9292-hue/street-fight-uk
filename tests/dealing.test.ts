/**
 * Dealing (business/dealing.ts): shut till the Ratcatcher's beaten; bulk from Kez; the prep table in the garage
 * bags it up on the play clock (bags used, upgrades faster and two at once); the grow's stock comes up as bulk
 * weed; deals sell to punters on the street for money and heat, cheaper the more you sell in one place; the
 * police take it all if you're nicked.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { resolveLevel } from '../src/property/levels';
import { book } from '../src/world/custody';
import { UNIT_VALUE } from '../src/business/catalogue';
import {
  BAG_PACK, batchSeconds, BULK_BUYBACK, bulkWorth, buyBags, buyBulk, buyTable, DEALING_FLAG, DRUG_DEFS, DRUGS, fromGrow, GROW_PER_BULK, loadBulk,
  recordSale, sellBulk, streetPrice, takeDeals, tickPrep, undercoverChance,
} from '../src/business/dealing';

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

const fresh = () => {
  const p = new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.cash.pocket = 20000;
  return p;
};
const open = () => {
  const p = fresh();
  p.set(DEALING_FLAG);
  return p;
};
const count = (p: Progress, id: string) => p.save.inventory.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);

console.log('Dealing');

test('shut until the Ratcatcher is beaten: no wholesale, no spot in the garage', () => {
  const p = fresh();
  assert(!buyBulk(p, 'weed').ok, 'Kez won’t sell yet');
  assert(!buyTable(p).ok, 'no table yet');
  assert(!(resolveLevel('home', p.save).stations ?? []).some((s) => s.id === 'prep'), 'no prep spot');
  p.set(DEALING_FLAG);
  assert((resolveLevel('home', p.save).stations ?? []).some((s) => s.id === 'prep'), 'a prep spot once it’s open');
});

test('bulk from Kez: in your pockets as contraband; he buys it back at a loss', () => {
  const p = open();
  const cash = p.save.cash.pocket;
  assert(buyBulk(p, 'coke').ok, 'bought');
  assert(p.save.cash.pocket === cash - DRUG_DEFS.coke.bulkPrice, 'paid');
  const st = p.save.inventory.find((x) => x.id === 'bulk_coke');
  assert(st?.stolen, 'carried, and the police would take it');
  const r = sellBulk(p, 'coke');
  assert(r.ok && r.price === Math.round(DRUG_DEFS.coke.bulkPrice * BULK_BUYBACK), 'sold back');
  assert(!count(p, 'bulk_coke'), 'gone');
});

test('the prep table: bags it up on the play clock, a bag a deal, and the deals wait to be taken', () => {
  const p = open();
  assert(buyTable(p).ok, 'set up');
  assert(resolveLevel('home', p.save).props.some((x) => x.kind === 'table' && x.x > 12), 'the table is in the garage');
  buyBulk(p, 'weed');
  buyBulk(p, 'weed');
  assert(loadBulk(p).weed === 2 && !count(p, 'bulk_weed'), 'both on the table');
  tickPrep(p);
  assert(p.save.dealing.batches.length === 0, 'no bags, no batch');
  buyBags(p);
  tickPrep(p);
  assert(p.save.dealing.batches.length === 1 && p.save.dealing.bags === BAG_PACK - DRUG_DEFS.weed.deals, 'one batch going, its bags used');
  p.save.playTime += batchSeconds('weed', 1) - 1;
  tickPrep(p);
  assert(p.save.dealing.deals.weed === 0, 'not quite');
  p.save.playTime += 2;
  tickPrep(p);
  assert(p.save.dealing.deals.weed === DRUG_DEFS.weed.deals && p.save.dealing.batches.length === 1, 'first batch done, the next going');
  p.save.playTime += 1000;
  tickPrep(p);
  assert(p.save.dealing.deals.weed === 2 * DRUG_DEFS.weed.deals, 'both done');
  const n = takeDeals(p, 'weed');
  assert(n > 0 && count(p, 'deal_weed') === n && p.save.inventory.find((x) => x.id === 'deal_weed')?.stolen, 'deals in your pockets');
});

test('upgrades: digital scales are faster, a second table runs two batches at once', () => {
  const p = open();
  buyTable(p);
  const slow = batchSeconds('coke', 1);
  buyTable(p);
  assert(batchSeconds('coke', 2) < slow, 'faster');
  buyTable(p);
  p.save.dealing.bulk.pills = 2;
  buyBags(p, 2);
  tickPrep(p);
  assert(p.save.dealing.batches.length === 2, 'two at once');
  assert(!buyTable(p).ok, 'nothing more to buy');
});

test('the grow links in: its stock comes up as bulk weed, worth far more bagged than sold by the unit', () => {
  const p = open();
  p.save.basement.business.stock = 2 * GROW_PER_BULK + 3;
  assert(fromGrow(p) === 2 && p.save.basement.business.stock === 3 && p.save.dealing.bulk.weed === 2, 'two bags up, the rest left');
  assert(bulkWorth('weed') > GROW_PER_BULK * UNIT_VALUE * 2, 'bagging pays');
  for (const d of DRUGS) assert(bulkWorth(d) > DRUG_DEFS[d].bulkPrice, `${d}: bulk is cheaper than selling it on`);
});

test('the street: prices by product and how far east, and softer the more you sell in one place', () => {
  const p = open();
  const a = streetPrice(p, 'coke', 'High Street', 0);
  assert(streetPrice(p, 'coke', 'High Street', 6) > a, 'more out east');
  recordSale(p, 'coke', 5, 200, 'High Street');
  assert(streetPrice(p, 'coke', 'High Street', 0) < a, 'softer after selling there');
  assert(streetPrice(p, 'coke', 'Hollins', 0) === a, 'not elsewhere');
  p.save.trips++;
  assert(streetPrice(p, 'coke', 'High Street', 0) === a, 'back up next trip');
  assert(undercoverChance(80) > undercoverChance(0), 'more plain clothes where police heat is up');
});

test('selling to a punter on the street: money, heat and a record', () => {
  const p = open();
  p.save.tutorial.essentialDone = true;
  p.giveItem('deal_pills', 20, { stolen: true });
  const w = new World(LEVELS.high_street, p, { entry: 'left', seed: 4 });
  for (const e of w.encounters) e.status = 'cleared';
  let punters: ReturnType<World['punters']> = [];
  for (let i = 0; i < 60 * 40 && !punters.length; i++) {
    w.step(emptyCommand());
    punters = w.punters();
  }
  assert(punters.length, 'punters about when you’re carrying');
  const f = punters[0];
  let sold: { qty: number; price: number; undercover: boolean } | null = null;
  w.events.on('deal:sold', (e) => (sold = e));
  const cash = p.save.cash.pocket;
  const police = p.heatIn().police;
  for (let i = 0; i < 30 && !sold; i++) {
    w.player.pos.x = f.pos.x - 0.6;
    w.player.pos.z = f.pos.z;
    w.step({ ...emptyCommand(), use: true });
    w.step(emptyCommand());
  }
  assert(sold, 'sold');
  const s = sold as { qty: number; price: number; undercover: boolean };
  assert(count(p, 'deal_pills') === 20 - s.qty, 'deals gone');
  if (!s.undercover) assert(p.save.cash.pocket === cash + s.price && s.price > 0, 'paid');
  assert(p.heatIn().police > police, 'police heat');
  assert(p.save.record.some((r) => r.crime === 'dealing'), 'on your record');
  assert(!w.punters().includes(f), 'they’ve had theirs');
});

test('nicked with it on you: the police take the lot; old saves load clean', () => {
  const p = open();
  buyBulk(p, 'weed');
  p.giveItem('deal_coke', 10, { stolen: true });
  book(p);
  assert(!count(p, 'bulk_weed') && !count(p, 'deal_coke'), 'seized');
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.dealing;
  assert(sanitiseSave(raw)!.dealing.table === 0, 'no table on an old save');
  raw.dealing = { table: 99, bulk: { weed: -3, coke: 'x' }, batches: [{ drug: 'nope' }] };
  const d = sanitiseSave(raw)!.dealing;
  assert(d.table === 3 && d.bulk.weed === 0 && d.bulk.coke === 0 && d.batches.length === 0, 'junk cleaned');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
