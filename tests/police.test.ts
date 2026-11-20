/**
 * Police, step 1 (docs/POLICE_PLAN.md): your record, the charge sheet, bail and a night in the cells, the
 * front counter, and the Central Police Station itself.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { ITEMS } from '../src/items/items';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import {
  ageRecord,
  BAIL_BASE,
  bailPrice,
  chargesFor,
  courtFine,
  CRIME_SPENT_TRIPS,
  RECORD_MAX,
  settlePrice,
  type CrimeEntry,
} from '../src/progress/record';
import { book, canPayBail, nightInCells, payBail } from '../src/world/custody';
import { LEVELS } from '../src/world/levels';

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

const fresh = (cash = 0, bank = 0): Progress => {
  const p = new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.cash.pocket = cash;
  p.save.cash.bank = bank;
  p.enterDistrict('High Street');
  return p;
};

test('crimes go on the record where they happen, and drop off once spent', () => {
  const p = fresh();
  p.logCrime('mugging');
  p.logCrime('robbery', 'City Centre');
  assert(p.save.record.length === 2 && p.save.record[0].district === 'High Street' && p.save.record[1].district === 'City Centre', 'logged with districts');
  for (let i = 0; i < 40; i++) p.logCrime('assault');
  assert(p.save.record.length === RECORD_MAX, `kept ${p.save.record.length}`);
  const r: CrimeEntry[] = [{ crime: 'mugging', district: 'X', trip: 0 }, { crime: 'assault', district: 'X', trip: 50 }];
  ageRecord(r, CRIME_SPENT_TRIPS + 5);
  assert(r.length === 1 && r[0].crime === 'assault', 'the old mugging is spent');
});

test('charges are this district’s crimes, worst first; or the worst anywhere', () => {
  const r: CrimeEntry[] = [
    { crime: 'mugging', district: 'A', trip: 1 },
    { crime: 'robbery', district: 'A', trip: 2 },
    { crime: 'assault_police', district: 'B', trip: 3 },
  ];
  const a = chargesFor(r, 'A');
  assert(a.length === 2 && a[0].crime === 'robbery', 'district A, worst first');
  const c = chargesFor(r, 'C');
  assert(c.length === 3 && c[0].crime === 'assault_police', 'nothing in C: worst anywhere');
});

test('bail: the worst charge sets it, more charges, arrests and stolen goods add to it, capped by level', () => {
  const one: CrimeEntry[] = [{ crime: 'mugging', district: 'A', trip: 0 }];
  assert(bailPrice(one, 0, 0, 10) === BAIL_BASE[1], `one mugging £${bailPrice(one, 0, 0, 10)}`);
  const two: CrimeEntry[] = [...one, { crime: 'robbery', district: 'A', trip: 1 }];
  assert(bailPrice(two, 0, 0, 10) === Math.round((BAIL_BASE[3] * 1.5) / 5) * 5, 'robbery sets it, the mugging adds half');
  assert(bailPrice(two, 2, 0, 10) > bailPrice(two, 0, 0, 10), 'past arrests cost more');
  assert(bailPrice(one, 0, 1000, 10) === BAIL_BASE[1] + 100, 'stolen goods add 10%');
  const lots: CrimeEntry[] = Array.from({ length: 5 }, (_, i) => ({ crime: 'assault_police' as const, district: 'A', trip: i }));
  assert(bailPrice(lots, 5, 0, 1) <= 1050, 'capped at level 1');
  assert(bailPrice([], 0, 0, 10) > 0, 'wanted with no record still costs something');
  assert(courtFine(1000) === 400, 'court fine is 40% of bail');
});

test('booked in: stolen goods seized and valued, charges read, an arrest counted', () => {
  const p = fresh(500);
  p.logCrime('mugging');
  p.giveItem('watch_silver', 1, { stolen: true });
  const value = ITEMS.watch_silver.value;
  const b = book(p);
  assert(b.seized === 1 && b.seizedValue === value, `seized ${b.seized} worth ${b.seizedValue}`);
  assert(!p.save.inventory.some((s) => s.stolen), 'stolen goods gone');
  assert(b.charges.length === 1 && b.charges[0].crime === 'mugging', 'charged with the mugging');
  assert(b.bail === bailPrice(b.charges, 0, value, p.save.level), 'bail priced');
  assert(p.save.stats.arrests === 1, 'arrest counted');
});

test('pay bail: charges and police heat cleared; refused if you can’t cover it', () => {
  const p = fresh(1000);
  p.logCrime('robbery');
  p.logCrime('mugging', 'City Centre');
  p.addHeatOf({ police: 70 });
  const b = book(p);
  assert(canPayBail(p, b) && payBail(p, b), 'paid');
  assert(p.save.cash.pocket === 1000 - b.bail, 'bail taken');
  assert(p.save.record.length === 1 && p.save.record[0].district === 'City Centre', 'only the High Street charge cleared');
  assert(p.heatIn('High Street').police === 0 && p.save.heat === 0, 'police heat wiped where nicked');
  const broke = fresh(10);
  broke.logCrime('assault_police');
  const b2 = book(broke);
  assert(!canPayBail(broke, b2) && !payBail(broke, b2) && broke.save.cash.pocket === 10, 'can’t pay, nothing taken');
});

test('a night in the cells: time passes, a court fine from what you have, police cool everywhere', () => {
  const p = fresh(1000);
  p.logCrime('robbery');
  p.addHeatOf({ police: 40 }, 'City Centre');
  const trips = p.save.trips;
  const b = book(p);
  const taken = nightInCells(p, b);
  assert(taken === b.fine && p.save.cash.pocket === 1000 - b.fine, `fined ${taken}`);
  assert(p.save.trips >= trips + 4, 'time passed');
  assert(p.save.record.length === 0, 'charges dealt with');
  assert(p.heatIn('City Centre').police < 40, 'police elsewhere cooled');
  const broke = fresh(0);
  broke.logCrime('robbery');
  assert(nightInCells(broke, book(broke)) === 0, 'nothing to take, nothing taken');
});

test('the front counter prices settling up by heat and what’s on file', () => {
  const r: CrimeEntry[] = [{ crime: 'robbery', district: 'A', trip: 0 }];
  assert(settlePrice(r, 'A', 50) > settlePrice(r, 'A', 0) && settlePrice(r, 'A', 0) > settlePrice([], 'A', 0), 'more heat and more crimes cost more');
  assert(settlePrice([], 'A', 0) >= 25, 'never free');
});

test('the record survives a save and load, junk dropped', () => {
  const p = fresh();
  p.logCrime('assault');
  const raw = JSON.parse(JSON.stringify(p.save));
  raw.record.push({ crime: 'jaywalking', district: 'A', trip: 1 }, null);
  const back = sanitiseSave(raw)!;
  assert(back.record.length === 1 && back.record[0].crime === 'assault', `${JSON.stringify(back.record)}`);
  const old = JSON.parse(JSON.stringify(p.save));
  delete old.record;
  assert(sanitiseSave(old)!.record.length === 0, 'old saves start with a clean record');
});

test('Central Police Station: a door on Market Square, a cell to wake in, the front counter', () => {
  const st = LEVELS.police_station;
  assert(st, 'no station');
  assert(st.entries.some((e) => e.id === 'cell') && st.entries.some((e) => e.id === 'door'), 'entries');
  assert(st.stations?.some((s) => s.id === 'front_desk'), 'front counter');
  const out = st.exits.find((e) => e.to === 'city');
  assert(out && LEVELS.city.entries.some((e) => e.id === out.toEntry), 'way out lands on Market Square');
  const door = LEVELS.city.exits.find((e) => e.to === 'police_station');
  assert(door && st.entries.some((e) => e.id === door.toEntry), 'door from Market Square');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
