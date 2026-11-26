/**
 * Ink & Iron (src/tattoo/tattoo.ts), cashpoints (src/money/atm.ts) and street dealers
 * (src/business/streetDealers.ts).
 *
 * - Tattoos: you pay only for what changes; over an old piece it's lasered first; re-inking counts the pieces;
 *   sleeves only on arms; paying writes your own look; the studio is on Hollins with Shaz, and a cab stop.
 * - Cashpoints: every `atm` prop is usable; paying in moves pocket to bank; taking out moves bank to pocket, with
 *   a fee on rough estates and none in town; never more than the balance or the machine's limit.
 * - Street dealers: only once you're dealing and only in rough districts, fixed for the stretch; their corner
 *   cuts your price; buying off him is at trade and limited; tax pays or fights; running him off and winning
 *   drops his stash and gives you the corner (a better price, no rival) for a while; saves load clean.
 */
import assert from 'node:assert/strict';
import { INK_COLOURS, defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { Progress, newSave, sanitiseSave } from '../src/progress/Progress';
import { LASER_PRICE, REINK_PRICE, designPrice, designsFor, getInk, inkOf, quote } from '../src/tattoo/tattoo';
import { ATM_FLAG, ATM_MAX, ATM_SITES, PAY_FEE, atmFee, atmOpen, bankOf, deposit, withdraw } from '../src/money/atm';
import { DEALING_FLAG, DRUG_DEFS, streetPrice } from '../src/business/dealing';
import {
  CORNER_BONUS, CORNER_TRIPS, DEALER_DISTRICTS, RIVAL_CUT, TRADE_MAX, buyOff, competition, cornerYours, dealerIn, rivalIn, stretchOf, takeCorner,
  taxOffer, taxedNow, tradeLeft, tradePrice,
} from '../src/business/streetDealers';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { SHOP_STOPS } from '../src/ui/hub';
import { emptyCommand } from '../src/input/Commands';

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok   ${name}`);
};
const fresh = (body: 'male' | 'female' = 'male') => new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance(body), background: 'estate_scrapper', allocated: emptyAllocation() })));
const count = (p: Progress, id: string) => p.save.inventory.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);

// ---- tattoos ----------------------------------------------------------------------------------------------------

ok('tattoos: nothing changing costs nothing; a new piece costs its price for the place', () => {
  const p = fresh();
  const now = inkOf(p.save.character.appearance);
  assert.deepEqual(quote(now, now), { lines: [], total: 0 });
  p.save.cash.pocket = 1000;
  assert.equal(getInk(p, now).ok, false);
  const want = { ...now, tattoos: { ...now.tattoos, chest: 'crown' as const, neck: 'star' as const } };
  const q = quote(now, want);
  assert.equal(q.total, designPrice('crown', 'chest') + designPrice('star', 'neck'));
  assert.ok(designPrice('crown', 'chest') > designPrice('crown', 'rightForearm'), 'the chest is a bigger job');
});

ok('tattoos: over an old piece it is lasered first; laser alone costs the laser; re-ink counts pieces', () => {
  const p = fresh();
  p.save.character.appearance.tattoos.rightUpperArm = 'rose';
  p.save.character.appearance.tattoos.chest = 'skull';
  const now = inkOf(p.save.character.appearance);
  const over = quote(now, { ...now, tattoos: { ...now.tattoos, rightUpperArm: 'anchor' } });
  assert.equal(over.total, LASER_PRICE + designPrice('anchor', 'rightUpperArm'));
  const off = quote(now, { ...now, tattoos: { ...now.tattoos, chest: 'none' } });
  assert.equal(off.total, LASER_PRICE);
  const other = INK_COLOURS.find((c) => c !== now.inkColour)!;
  assert.equal(quote(now, { ...now, inkColour: other }).total, 2 * REINK_PRICE);
});

ok('tattoos: paying writes your own look, pocket then tin; sleeves only on arms; no money, no ink', () => {
  const p = fresh();
  p.save.cash.pocket = 10;
  p.save.cash.bank = 1000;
  const now = inkOf(p.save.character.appearance);
  const r = getInk(p, { ...now, tattoos: { ...now.tattoos, leftUpperArm: 'sleeve' } });
  assert.ok(r.ok);
  assert.equal(p.save.character.appearance.tattoos.leftUpperArm, 'sleeve');
  assert.equal(p.appearance().tattoos.leftUpperArm, 'sleeve', 'shows on the fighter');
  assert.equal(p.save.cash.pocket, 0);
  assert.equal(p.save.cash.bank, 1010 - designPrice('sleeve', 'leftUpperArm'));
  assert.ok(!designsFor('chest').includes('sleeve') && designsFor('leftForearm').includes('sleeve') === false && designsFor('rightUpperArm').includes('sleeve'));
  assert.equal(getInk(p, { ...inkOf(p.save.character.appearance), tattoos: { ...p.save.character.appearance.tattoos, chest: 'sleeve' } }).ok, false);
  const broke = fresh();
  const n2 = inkOf(broke.save.character.appearance);
  broke.save.cash.pocket = 5;
  broke.save.cash.bank = 0;
  assert.equal(getInk(broke, { ...n2, tattoos: { ...n2.tattoos, neck: 'lettering' } }).ok, false);
  assert.equal(broke.save.character.appearance.tattoos.neck, 'none');
});

ok('tattoos: Ink & Iron is on Hollins, with Shaz, a door both ways and a cab stop', () => {
  const street = LEVELS.residential;
  const door = street.exits.find((e) => e.to === 'tattoo_studio');
  assert.ok(door, 'a door from Hollins');
  assert.ok(street.entries.some((e) => e.id === door!.toEntry || e.id === 'tattoo'));
  const shop = LEVELS.tattoo_studio;
  assert.ok(shop.exits.some((e) => e.to === 'residential' && street.entries.some((x) => x.id === e.toEntry)), 'and back out');
  assert.ok(shop.stations.some((s) => s.id === 'tattoo_chair' && s.npc?.name === 'Shaz'));
  assert.ok(SHOP_STOPS.some((s) => s.area === 'tattoo_studio'));
});

// ---- cashpoints -------------------------------------------------------------------------------------------------

ok('cashpoints: paying in and taking out; the fee only on rough estates; limits', () => {
  const p = fresh();
  p.save.cash.pocket = 120;
  p.save.cash.bank = 300;
  assert.ok(deposit(p, 100).ok);
  assert.deepEqual(p.save.cash, { pocket: 20, bank: 400 });
  assert.ok(deposit(p, Infinity).ok);
  assert.deepEqual(p.save.cash, { pocket: 0, bank: 420 });
  assert.equal(deposit(p, 10).ok, false, 'nothing on you');
  assert.equal(atmFee('High Street'), 0);
  assert.equal(atmFee('City Centre'), 0);
  assert.equal(atmFee('Hollins'), PAY_FEE);
  assert.ok(withdraw(p, 100, 'High Street').ok);
  assert.deepEqual(p.save.cash, { pocket: 100, bank: 320 });
  assert.ok(withdraw(p, 100, 'Hollins').ok);
  assert.deepEqual(p.save.cash, { pocket: 200, bank: 220 - PAY_FEE });
  assert.equal(withdraw(p, ATM_MAX + 20, 'High Street').ok, false, 'over the limit');
  assert.equal(withdraw(p, p.save.cash.bank, 'Hollins').ok, false, 'not enough for the fee');
  assert.ok(p.save.finance.ledger.some((l) => l.amount === -PAY_FEE), 'the fee on the statement');
});

ok('cashpoints: scarce, set into walls, one bank each, shut till the second boss', () => {
  const withAtm = Object.values(LEVELS).filter((lv) => lv.props.some((x) => x.kind === 'atm')).map((lv) => lv.id).sort();
  assert.deepEqual(withAtm, Object.keys(ATM_SITES).sort(), 'only the listed sites have a machine');
  const streets = Object.values(LEVELS).filter((lv) => lv.weather !== 'indoors' || lv.id === 'mall').length;
  assert.ok(withAtm.length <= Math.ceil(streets / 4), `about one for every four districts (${withAtm.length} of ${streets})`);
  for (const id of withAtm) {
    const atm = LEVELS[id as keyof typeof LEVELS].props.find((x) => x.kind === 'atm')!;
    assert.equal(atm.solid, false, `${id}: in the wall, not standing in the street`);
    assert.equal(bankOf(atm.label).id, ATM_SITES[id], `${id}: its bank`);
  }
  const p = fresh();
  assert.equal(atmOpen(p), false, 'no banking before the second boss');
  const w = new World(LEVELS.high_street, p, { entry: 'left', seed: 2, civilians: false });
  assert.match(w.stations.find((s) => s.id === 'atm')!.label, /out of service/);
  p.save.flags[ATM_FLAG] = true;
  assert.equal(atmOpen(p), true);
  const w2 = new World(LEVELS.city, p, { entry: 'left', seed: 2, civilians: false });
  const st = w2.stations.find((s) => s.id === 'atm')!;
  assert.equal(st.tab, 'lloyds');
  assert.match(st.label, /Lloyd’s THC/);
});

ok('cashpoints: no invalid amounts, never more than you have', () => {
  const p = fresh();
  p.save.cash.pocket = 35;
  p.save.cash.bank = 100;
  assert.equal(withdraw(p, 25, 'High Street').ok, false, 'notes only');
  assert.equal(withdraw(p, -10, 'High Street').ok, false);
  assert.equal(withdraw(p, NaN, 'High Street').ok, false);
  assert.equal(deposit(p, 40).ok, false, 'more than is on you');
  assert.equal(deposit(p, -5).ok, false);
  assert.deepEqual(p.save.cash, { pocket: 35, bank: 100 }, 'nothing moved');
  assert.ok(deposit(p, Infinity).ok, 'deposit all');
  assert.deepEqual(p.save.cash, { pocket: 0, bank: 135 });
  assert.ok(p.save.finance.ledger.some((l) => l.kind === 'cash' && l.amount === 35), 'on the mini statement');
});

ok('cashpoints: every cashpoint on a street is something to use', () => {
  for (const id of ['high_street', 'city', 'precinct', 'mall'] as const) {
    const lv = LEVELS[id];
    const atm = lv.props.find((x) => x.kind === 'atm');
    assert.ok(atm, `${id} has a cashpoint`);
    assert.ok(atm!.z <= -1.85, `${id}'s cashpoint is against the wall, out of the walking lanes`);
    const p = fresh();
    const w = new World(lv, p, { entry: 'left', seed: 2, civilians: false });
    assert.ok(w.stations.some((s) => s.id === 'atm' && Math.abs(s.x - atm!.x) < 0.01), `${id}: usable`);
  }
});

// ---- street dealers ---------------------------------------------------------------------------------------------

const dealing = () => {
  const p = fresh();
  p.set(DEALING_FLAG);
  p.save.cash.pocket = 5000;
  return p;
};
/** A trip on which this district has a dealer. */
const tripWithRival = (p: Progress, district: string): void => {
  for (let t = 0; t < 400; t++) {
    p.save.trips = t;
    if (rivalIn(p, district)) return;
  }
  throw new Error(`no dealer in ${district} in 400 trips`);
};

ok('dealers: only once you are dealing, only on rough streets, fixed for the stretch', () => {
  const p = fresh();
  for (let t = 0; t < 40; t++) {
    p.save.trips = t;
    assert.equal(rivalIn(p, 'Hollins'), false, 'not before dealing');
  }
  const d = dealing();
  for (let t = 0; t < 40; t++) {
    d.save.trips = t;
    assert.equal(rivalIn(d, 'City Centre'), false, 'not in town');
  }
  assert.ok(DEALER_DISTRICTS.has('Hollins'));
  tripWithRival(d, 'Hollins');
  const who = dealerIn(d, 'Hollins');
  const st = stretchOf(d.save.trips);
  for (let t = st * 4; t < st * 4 + 4; t++) {
    d.save.trips = t;
    assert.ok(rivalIn(d, 'Hollins'), 'there all stretch');
    assert.deepEqual(dealerIn(d, 'Hollins'), who, 'the same man');
  }
});

ok('dealers: their corner cuts your price; buying off them is at trade and limited', () => {
  const p = dealing();
  tripWithRival(p, 'Hollins');
  const plain = streetPrice(p, 'weed', 'Hollins', 0);
  assert.equal(competition(p, 'Hollins'), RIVAL_CUT);
  assert.ok(streetPrice(p, 'weed', 'Hollins', 0, competition(p, 'Hollins')) < plain);
  assert.ok(tradePrice('weed') < DRUG_DEFS.weed.street);
  const cash = p.save.cash.pocket;
  const r = buyOff(p, 'Hollins', 'weed', 3);
  assert.ok(r.ok);
  assert.equal(count(p, 'deal_weed'), 3);
  assert.ok(p.save.inventory.find((x) => x.id === 'deal_weed')!.stolen, 'contraband');
  assert.equal(p.save.cash.pocket, cash - 3 * tradePrice('weed'));
  assert.equal(tradeLeft(p, 'Hollins'), TRADE_MAX - 3);
  buyOff(p, 'Hollins', 'weed', 99);
  assert.equal(tradeLeft(p, 'Hollins'), 0);
  assert.equal(buyOff(p, 'Hollins', 'weed', 1).ok, false, 'no more this stretch');
});

ok('dealers: tax pays or fights, once a stretch; taking the corner beats the rival for a while', () => {
  const p = dealing();
  tripWithRival(p, 'Hollins');
  const cash = p.save.cash.pocket;
  const street = p.heatIn('Hollins').street;
  const paid = taxOffer(p, 'Hollins', 0);
  assert.ok('paid' in paid && paid.paid > 0 && p.save.cash.pocket === cash + paid.paid);
  assert.ok(taxedNow(p, 'Hollins'));
  assert.ok(p.heatIn('Hollins').street > street, 'heat');
  assert.ok('fights' in taxOffer(dealing(), 'Hollins', 0.999), 'a high roll fights');
  takeCorner(p, 'Hollins');
  assert.ok(cornerYours(p, 'Hollins'));
  assert.equal(rivalIn(p, 'Hollins'), false);
  assert.equal(competition(p, 'Hollins'), CORNER_BONUS);
  p.save.trips += CORNER_TRIPS;
  assert.equal(cornerYours(p, 'Hollins'), false, 'runs out');
});

ok('dealers: on the street, USE talks to him; run him off and win for his stash and the corner', () => {
  const p = dealing();
  p.save.tutorial.essentialDone = true;
  tripWithRival(p, 'Hollins');
  const w = new World(LEVELS.residential, p, { entry: 'right', seed: 3 });
  for (const e of w.encounters) e.status = 'cleared';
  assert.ok(w.rival, 'he’s on the street');
  assert.ok(w.jobMarks().some((m) => m.kind === 'dealer'), 'a badge over him');
  const r = w.rival!;
  let talked = false;
  w.events.on('dealer:talk', () => (talked = true));
  for (let i = 0; i < 10 && !talked; i++) {
    w.player.pos.x = r.f.pos.x - 0.6;
    w.player.pos.z = r.f.pos.z;
    w.step({ ...emptyCommand(), use: true });
    w.step(emptyCommand());
  }
  assert.ok(talked, 'USE talks to him');
  const stock = { ...r.d.stock };
  w.runOffDealer();
  assert.ok(r.hostile && r.f.team === 'enemy' && r.mates.length >= 1, 'squares up with his mates');
  let down = false;
  w.events.on('dealer:down', () => (down = true));
  r.f.knockOut();
  for (let i = 0; i < 5 && !down; i++) w.step(emptyCommand());
  assert.ok(down, 'down');
  assert.ok(cornerYours(p, 'Hollins'), 'the corner is yours');
  const dropped = w.items.filter((g) => g.stack.id.startsWith('deal_'));
  for (const [drug, n] of Object.entries(stock)) if (n > 0) assert.ok(dropped.some((g) => g.stack.id === `deal_${drug}` && g.stack.qty === n && g.stack.stolen), `his ${drug} on the floor`);
});

ok('dealers: old and junk saves load clean', () => {
  const p = dealing();
  tripWithRival(p, 'Hollins');
  buyOff(p, 'Hollins', 'weed', 1);
  takeCorner(p, 'Kingsway');
  const raw = JSON.parse(JSON.stringify(p.save));
  const back = new Progress(sanitiseSave(raw)!);
  assert.ok(cornerYours(back, 'Kingsway'), 'kept');
  raw.dealing.corners = { until: { X: 'no' }, taxed: 5, bought: { Y: null } };
  const junk = new Progress(sanitiseSave(raw)!);
  assert.equal(cornerYours(junk, 'X'), false);
  delete raw.dealing.corners;
  assert.equal(cornerYours(new Progress(sanitiseSave(raw)!), 'Kingsway'), false, 'old save: no corners');
});

console.log(`\nstreet life: ${passed} passed`);
