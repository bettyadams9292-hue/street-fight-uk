/**
 * Police, step 1 (docs/POLICE_PLAN.md): your record, the charge sheet, bail and a night in the cells, the
 * front counter, and the Kirkgate Constabulary itself.
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
import { book, canPayBail, crewToRing, kerriganCool, kerriganGearBack, losePaperwork, payBail, release, repayCrew, ringCrew, sentenceSeconds, serveTime, SENTENCE_MAX, timeLeft } from '../src/world/custody';
import { exitLocked } from '../src/world/World';
import { sanitisePolice } from '../src/progress/cops';
import { BENT_BASE, BENT_SARGE, BRIBERY_HEAT, BUNG_COOL, bentChance, bungPrice, CAUGHT_HEAT, copFor, owedFor, ROSTER_SIZE, roster, sargeOnDuty } from '../src/progress/cops';
import { COMPANIONS, followMe } from '../src/companions/companions';
import { World } from '../src/world/World';
import { emptyCommand } from '../src/input/Commands';
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
  p.save.bank = 'califax';
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

test('can’t pay: you do time in the cell, longer for worse and more charges; the door stays locked till it’s done', () => {
  const p = fresh(0);
  p.logCrime('mugging');
  p.addHeatOf({ police: 40 }, 'City Centre');
  const light = sentenceSeconds(p, book(p));
  const q = fresh(0);
  q.logCrime('robbery');
  q.logCrime('assault');
  q.logCrime('assault_police');
  const bq = book(q);
  const heavy = sentenceSeconds(q, bq);
  assert(heavy > light, `worse charges, longer (${light} vs ${heavy})`);
  assert(heavy <= SENTENCE_MAX, 'capped');
  const secs = serveTime(q, bq);
  assert(secs === heavy && q.save.record.length === 0, 'charges dealt with, nothing taken');
  assert(timeLeft(q) === secs && q.save.cash.pocket === 0);
  const door = LEVELS.police_station.exits.find((e) => e.id === 'out')!;
  assert(exitLocked(door, q), 'the door is locked while you serve');
  q.save.playTime += secs + 1;
  assert(timeLeft(q) === 0 && release(q) && !exitLocked(door, q), 'free once it’s done');
  assert(sanitisePolice(JSON.parse(JSON.stringify({ ...q.save.police, serving: { until: 5, total: 90 } })), (x) => x as never).serving?.total === 90, 'kept across a save');
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

test('Kirkgate Constabulary: a door on Market Square, the cells, the front counter, and the only way out goes home', () => {
  const st = LEVELS.police_station;
  assert(st, 'no station');
  assert(st.entries.some((e) => e.id === 'cell') && st.entries.some((e) => e.id === 'door'), 'entries');
  assert(st.stations?.some((s) => s.id === 'front_desk'), 'front counter');
  // Leaving never puts you back on Market Square: every way out of the station goes straight home.
  assert(st.exits.length > 0 && st.exits.every((e) => e.to === 'home'), `exits: ${st.exits.map((e) => e.to)}`);
  for (const e of st.exits) assert(LEVELS.home.entries.some((n) => n.id === e.toEntry), `home has no entry ${e.toEntry}`);
  // Furnished from the owner's police sets: the holding cells and the charge desk at least.
  const items = new Set(st.props.map((p) => p.item));
  for (const id of ['policeHoldingCellDouble', 'policeHoldingCellSingle', 'policeChargeDesk', 'policeCustodyDesk']) assert(items.has(id), `no ${id}`);
  // Nobody wakes up or walks in inside something solid.
  for (const n of st.entries) for (const p of st.props) {
    if (p.solid === false || !p.size) continue;
    const [hx, hz] = (p.rot ?? 0) % 2 ? [p.size[1], p.size[0]] : p.size;
    assert(Math.abs(n.x - p.x) > hx + 0.2 || Math.abs(n.z - p.z) > hz + 0.2, `entry ${n.id} inside ${p.item ?? p.kind}`);
  }
  const door = LEVELS.city.exits.find((e) => e.to === 'police_station');
  assert(door && st.entries.some((e) => e.id === door.toEntry), 'door from Market Square');
});


// ---- step 2: bent and straight cops, the bent sergeant, ringing your crew, the phone at the desk ----

test('every district has its own officers, the same each game, bent more on rough streets and at least one anywhere', () => {
  const a = roster('Back Alleys');
  assert(JSON.stringify(a) === JSON.stringify(roster('Back Alleys')), 'roster changes');
  assert(a.length === ROSTER_SIZE && new Set(a.map((c) => c.name)).size === ROSTER_SIZE, 'names');
  for (const d of ['City Centre', 'High Street', 'Back Alleys', 'Kingsway']) assert(roster(d).some((c) => c.bent), `${d}: nobody bent`);
  assert(bentChance('Back Alleys') > bentChance('High Street') && bentChance('High Street') > bentChance('City Centre'), 'odds by district');
  // Over many districts' worth of officers about one in four are bent (a bit more: every district has one).
  let bent = 0, n = 0;
  for (let i = 0; i < 400; i++) for (const c of roster(`Somewhere ${i}`)) (n++, bent += c.bent ? 1 : 0);
  assert(bent / n >= BENT_BASE - 0.02 && bent / n < BENT_BASE + 0.08, `bent share ${(bent / n).toFixed(3)}`);
  // Most officers are straight, even on the roughest street.
  assert(roster('Back Alleys').filter((c) => c.bent).length < ROSTER_SIZE / 2 + 1, 'Back Alleys mostly bent');
});

test('a bung costs more the hotter they are and the more of them there are', () => {
  assert(bungPrice(40, 2) > bungPrice(40, 1) && bungPrice(80, 1) > bungPrice(40, 1), 'price');
  assert(bungPrice(0, 1) === 40, `${bungPrice(0, 1)}`);
});

function streetWithPolice(bent: boolean): { p: Progress; w: World } {
  const p = fresh(5000);
  // The lead officer is the district's officer number trips × 2: pick a trip where he's bent (or straight).
  let t = 0;
  while (copFor('High Street', t * 2).bent !== bent) t++;
  p.save.trips = t;
  p.setHeat('police', 50, 'High Street');
  const w = new World(LEVELS.high_street, p, { entry: 'start', seed: 5 });
  let lead = '';
  w.events.on('police:arrive', (e) => (lead = e.lead));
  w.raiseAlarm('test', 1, 2);
  for (let i = 0; i < 5; i++) w.step(emptyCommand());
  assert(w.policeActive && lead === copFor('High Street', t * 2).name, `police ${w.policeActive} ${lead}`);
  return { p, w };
}

test('a bent copper takes the bung: they walk off, the street cools, you know him after', () => {
  const { p, w } = streetWithPolice(true);
  const price = w.bungPrice();
  const before = p.heatIn('High Street').police;
  assert(w.bung() === 'taken', 'not taken');
  assert(!w.policeActive, 'still a fight');
  assert(p.save.cash.pocket === 5000 - price, `paid ${5000 - p.save.cash.pocket} of ${price}`);
  assert(p.heatIn('High Street').police === before - BUNG_COOL, `heat ${p.heatIn('High Street').police}`);
  assert(Object.values(p.save.police.known).includes('bent'), 'not remembered');
  assert(!p.save.record.some((e) => e.crime === 'bribery'), 'bribery logged for a bent one');
});

test('a straight copper won\u2019t have it: bribery on your record, more heat, and they hit harder', () => {
  const { p, w } = streetWithPolice(false);
  const before = p.heatIn('High Street').police;
  assert(w.bung() === 'refused', 'not refused');
  assert(w.policeActive && p.save.cash.pocket === 5000, 'money taken or police gone');
  assert(p.save.record.some((e) => e.crime === 'bribery'), 'no bribery charge');
  assert(p.heatIn('High Street').police === before + BRIBERY_HEAT, `heat ${p.heatIn('High Street').police}`);
  assert(w.police.every((f) => f.stats.hasModifier('bribed_dealt')), 'not angrier');
  assert(Object.values(p.save.police.known).includes('straight'), 'not remembered');
});

test('a night in the cells: you wake inside the single cell, walled each side, and walk out of the front', () => {
  const st = LEVELS.police_station;
  const cell = st.entries.find((e) => e.id === 'cell')!;
  const walls = st.walls ?? [];
  const inWall = (x: number, z: number) => walls.some((w) => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ);
  const box = st.props.find((p) => p.item === 'policeHoldingCellSingle')!;
  const [hw, hd] = box.size!;
  assert(Math.abs(cell.x - box.x) < hw - 0.3 && Math.abs(cell.z - box.z) < hd - 0.3, 'wakes outside the cell');
  assert(!inWall(cell.x, cell.z), 'wakes in a wall');
  // Walls each side of you; the front is open (drawn cut away), so you walk out that way.
  assert(inWall(box.x - hw + 0.08, cell.z) && inWall(box.x + hw - 0.08, cell.z), 'no side walls');
  for (let x = box.x - hw + 0.3; x < box.x + hw - 0.3; x += 0.2) assert(!inWall(x, box.z + hd - 0.1), `front blocked at x ${x.toFixed(1)}`);
});

test('booked in: they take your phone and the stolen gear goes into the property store', () => {
  const p = fresh(0);
  const st = p.newStack('chain_silver', 1);
  st.stolen = true;
  p.pocket(st);
  const b = book(p);
  assert(p.save.police.custody, 'phone not taken');
  assert(b.seized >= 1 && p.save.police.seized.length >= 1, 'nothing in the property store');
  assert(LEVELS.police_station.exits.every((e) => e.to === 'home'), 'the station lets you out somewhere but home');
});

test('Kerrigan on the desk loses the paperwork for half the bail, then he\u2019s your contact', () => {
  const p = fresh(5000);
  p.logCrime('robbery');
  let t = 0;
  while (!sargeOnDuty(t, 0, false)) t++;
  p.save.trips = t;
  const b = book(p);
  assert(b.bent && b.sarge === BENT_SARGE && b.paperwork < b.bail, `sarge ${b.sarge} ${b.paperwork}/${b.bail}`);
  assert(losePaperwork(p, b), 'not lost');
  assert(p.save.cash.pocket === 5000 - b.paperwork && !p.save.record.length && p.save.police.contact, 'paperwork deal');
  // A straight sergeant has no such deal.
  const q = fresh(5000);
  let u = 0;
  while (sargeOnDuty(u, 0, false)) u++;
  q.save.trips = u;
  const c = book(q);
  assert(!c.bent && !losePaperwork(q, c) && q.save.cash.pocket === 5000, 'straight sergeant took money');
  assert(!sargeOnDuty(t, 0, true), 'on duty after being caught');
});

test('Kerrigan cools a district and gets your gear back; if he\u2019s caught, the heat comes down everywhere', () => {
  const p = fresh(5000);
  p.save.police.contact = true;
  p.setHeat('police', 60, 'Back Alleys');
  const f = kerriganCool(p, 'Back Alleys', 0.9);
  assert(f.ok && !f.caught && p.heatIn('Back Alleys').police === 0 && p.save.cash.pocket === 5000 - f.price, 'cool');
  p.save.police.seized = [{ ...p.newStack('chain_silver', 1), stolen: true }];
  const g = kerriganGearBack(p, 0.9);
  assert(g.ok && !p.save.police.seized.length && p.save.storage.some((x) => x.id === 'chain_silver' && x.stolen), 'gear back');
  p.save.police.seized = [p.newStack('chain_silver', 1)];
  const h = kerriganGearBack(p, 0);
  assert(h.ok && h.caught && !p.save.police.contact && p.save.police.burned, 'caught');
  assert(p.heatIn('Back Alleys').police >= CAUGHT_HEAT && p.heatIn('High Street').police >= CAUGHT_HEAT, 'no heat everywhere');
  assert(!kerriganCool(p, 'Back Alleys', 0.9).ok, 'favour after being caught');
});

test('ring your crew: they pay, you owe them a quarter on top from the tin, and they won\u2019t follow you till then', () => {
  const p = fresh(0, 0);
  const id = Object.keys(COMPANIONS)[0];
  p.save.companions.recruited.push(id);
  p.save.companions.following.push(id);
  p.logCrime('assault');
  const b = book(p);
  assert(crewToRing(p).includes(id) && ringCrew(p, b, id), 'ring');
  assert(!p.save.record.length && p.save.police.owed?.left === owedFor(b.bail) && owedFor(b.bail) > b.bail, 'owed');
  assert(!p.save.companions.following.includes(id) && !followMe(p, id).ok, 'still following');
  assert(!crewToRing(p).length, 'can ring again while owing');
  p.save.cash.tin = 100;
  repayCrew(p);
  assert(p.save.cash.tin === 0 && p.save.police.owed!.left === owedFor(b.bail) - 100, 'part paid');
  p.save.cash.tin = 5000;
  repayCrew(p);
  assert(!p.save.police.owed && followMe(p, id).ok, 'square again');
});

test('the police state survives a save and load', () => {
  const p = fresh();
  p.save.police = { known: { 'PC Tate': 'bent', x: 'junk' as never }, contact: true, burned: false, seized: [p.newStack('chain_silver', 1)], owed: { id: 'x', left: 120 }, custody: true };
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)))!;
  assert(back.police.known['PC Tate'] === 'bent' && !('x' in back.police.known), 'known');
  assert(back.police.contact && back.police.seized.length === 1 && back.police.owed?.left === 120 && back.police.custody, JSON.stringify(back.police));
  const old = JSON.parse(JSON.stringify(p.save));
  delete old.police;
  assert(!sanitiseSave(old)!.police.contact, 'old saves');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
