/**
 * Getting about (map → Drive, property/parking.ts): your own car is free, goes from wherever it's parked, and is
 * left on a clear bit of road at the other end, one place at a time; the save keeps where it is.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { Progress, newSave, sanitiseSave, type AreaId } from '../src/progress/Progress';
import { addCar, sellCar } from '../src/property/state';
import { CAR_LIST, CARS } from '../src/property/catalogue';
import { parkingSpot } from '../src/property/parking';
import { resolveLevel } from '../src/property/levels';
import { driveOption, travelOptions } from '../src/map/worldMap';
import { SHOP_STOPS, TAXI_STOPS } from '../src/ui/hub';
import { LEVELS } from '../src/world/levels';
import { propHalf } from '../src/world/LevelTypes';
import { AMBUSH_MAX, ambushChance, jumped, journeyRisk } from '../src/travel/onFoot';
import { World } from '../src/world/World';
import { fitMod, fitted, optionFor, paintOf } from '../src/property/carMods';
import { route } from '../src/map/worldMap';
/** Tests here pay as a player with a bank account would (money/banking.ts): card after cash. */
const account = (p: Progress): Progress => ((p.save.bank = 'califax'), p);

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n${(e as Error).stack}`);
  }
};
const fresh = () => account(new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() }))));
const openAll = (p: Progress) => {
  for (const f of ['boss_gaffer', 'boss_sully', 'boss_ratcatcher', 'boss_dunc', 'boss_estate_king', 'boss_market', 'boss_docks', 'boss_factory', 'boss_precinct', 'boss_nightclub', 'boss_stadium', 'boss_underground']) p.save.flags[f] = true;
};

ok('no car, no Drive; a car on the drive drives from home, free', () => {
  const p = fresh();
  assert.equal(driveOption(p, 'estate', 'high_street', true), null);
  addCar(p, CAR_LIST[0].id, CAR_LIST[0].colours[1], 'bought');
  const d = driveOption(p, 'estate', 'high_street', true)!;
  assert.ok(d.ok, d.why);
  assert.equal(d.cost, 0);
  assert.ok(d.park && d.park.area === 'high_street');
  assert.equal(driveOption(p, 'city', 'high_street', true)!.ok, false, 'the car is at home, not here');
  assert.equal(driveOption(p, 'estate', 'high_street', false)!.ok, false, 'not mid-fight');
  assert.ok(travelOptions(p, 'estate', 'high_street', true).some((t) => t.kind === 'drive'));
});

ok('every stop you can drive to parks on clear road, never the pavement, a doorway or the street ends', () => {
  const p = fresh();
  openAll(p);
  for (const car of CAR_LIST) {
    for (const s of [...SHOP_STOPS, ...TAXI_STOPS]) {
      const spot = parkingSpot(s.area, car.id, s.entry);
      if (!spot) continue;
      const lv = LEVELS[spot.area];
      const [hx, hz] = car.size;
      assert.ok(lv.weather !== 'indoors', `${s.area}: parks outdoors (${spot.area})`);
      assert.ok(spot.z - hz > -0.3, `${s.area}/${car.id}: on the road, not the pavement (z ${spot.z})`);
      assert.ok(spot.x - hx > lv.bounds.minX + 2 && spot.x + hx < lv.bounds.maxX - 2, `${s.area}/${car.id}: clear of the street ends`);
      for (const pr of lv.props) {
        const [pw, ph] = propHalf(pr);
        const overlapX = Math.abs(pr.x - spot.x) < hx + pw;
        const overlapZ = Math.abs(pr.z - spot.z) < hz + ph;
        assert.ok(!(overlapX && overlapZ), `${s.area}/${car.id}: not on top of the ${pr.kind} at ${pr.x}`);
      }
    }
  }
  // Most stops have somewhere to park.
  const parks = [...SHOP_STOPS, ...TAXI_STOPS].filter((s) => parkingSpot(s.area, CAR_LIST[0].id, s.entry)).length;
  assert.ok(parks >= (SHOP_STOPS.length + TAXI_STOPS.length) * 0.6, `${parks} stops have parking`);
});

ok('the car is left where you drove it, drawn in its own paint, and only there', () => {
  const p = fresh();
  openAll(p);
  const car = addCar(p, 'corvo', '#7a1414', 'bought');
  const d = driveOption(p, 'estate', 'high_street', true)!;
  p.save.property.carOut = { uid: car.uid, ...d.park! };
  const there = resolveLevel('high_street', p.save).props.filter((x) => x.kind === 'vehicle' && x.item === 'corvo');
  assert.equal(there.length, 1);
  assert.equal(there[0].colour, '#7a1414');
  assert.ok(resolveLevel('high_street', p.save).stations?.some((s) => s.id === 'car'), 'you can get back in');
  assert.equal(resolveLevel('estate', p.save).props.filter((x) => x.kind === 'vehicle' && x.item === 'corvo').length, 0, 'not also on the drive');
  // Drive on from there; home again puts it back on the drive.
  assert.ok(driveOption(p, 'high_street', 'city', true)!.ok);
  assert.equal(driveOption(p, 'estate', 'city', true)!.ok, false, 'it is on the High Street, not at home');
  const home = driveOption(p, 'high_street', 'home', true)!;
  assert.ok(home.ok && home.park === null);
});

ok('where the car is survives a reload; a sold or swapped car comes home', () => {
  const p = fresh();
  const car = addCar(p, 'corvo', CARS.corvo.colours[0], 'bought');
  p.save.property.carOut = { uid: car.uid, area: 'high_street', x: 30, z: 1.3 };
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)))!;
  assert.deepEqual(back.property.carOut, { uid: car.uid, area: 'high_street', x: 30, z: 1.3 });
  const junk = sanitiseSave(JSON.parse(JSON.stringify({ ...p.save, property: { ...p.save.property, carOut: { uid: 'nope', area: 'moon', x: 'a' } } })))!;
  assert.equal(junk.property.carOut, null);
  sellCar(p, car.uid);
  assert.equal(p.save.property.carOut, null);
});

ok('Drive respects locked districts', () => {
  const p = fresh();
  addCar(p, 'corvo', CARS.corvo.colours[0], 'bought');
  const locked = (Object.keys(LEVELS) as AreaId[]).find((a) => a === 'hq')!;
  const d = driveOption(p, 'estate', locked, true)!;
  assert.equal(d.ok, false);
});

// ---- on foot ------------------------------------------------------------------------------------------------

ok('on foot: no ambushes while learning, indoors or at home; rough streets riskier than clean ones', () => {
  const p = fresh();
  assert.equal(ambushChance(p, 'high_street'), 0, 'not before the first lessons are done');
  p.save.tutorial.essentialDone = true;
  assert.ok(ambushChance(p, 'high_street') > 0);
  assert.equal(ambushChance(p, 'pub'), 0, 'not inside');
  assert.equal(ambushChance(p, 'home'), 0);
  assert.ok(ambushChance(p, 'alleys') > ambushChance(p, 'high_street'), 'Back Alleys are rough');
  assert.ok(ambushChance(p, 'city') < ambushChance(p, 'high_street'), 'the City Centre is clean');
  for (const a of Object.keys(LEVELS) as AreaId[]) assert.ok(ambushChance(p, a) <= AMBUSH_MAX);
});

ok('on foot: longer journeys through rough streets carry more risk, but walking stays worth it', () => {
  const p = fresh();
  p.save.tutorial.essentialDone = true;
  openAll(p);
  const short = route(p, 'estate', 'high_street')!;
  const long = route(p, 'estate', 'docks')!;
  assert.ok(long.length > short.length);
  assert.ok(journeyRisk(p, long.slice(0, -1)) > journeyRisk(p, short.slice(0, -1)));
  assert.ok(journeyRisk(p, long.slice(0, -1)) < 0.6, `even a long run is usually clear (${journeyRisk(p, long.slice(0, -1)).toFixed(2)})`);
  // Fixed for a journey: asking again doesn't re-roll.
  assert.equal(jumped(p, 'alleys', 123), jumped(p, 'alleys', 123));
  let hits = 0;
  for (let j = 0; j < 2000; j++) if (jumped(p, 'alleys', j)) hits++;
  const c = ambushChance(p, 'alleys');
  assert.ok(Math.abs(hits / 2000 - c) < 0.04, `rolls land near the chance (${hits / 2000} vs ${c})`);
});

ok('on foot: an ambush is an ordinary street fight, never on top of another', () => {
  const p = fresh();
  const w = new World(LEVELS.high_street, p, { entry: 'left', seed: 5, civilians: false });
  const before = w.enemies.length;
  assert.ok(w.ambush(2));
  assert.equal(w.enemies.length - before, 2);
  assert.equal(w.ambush(2), false, 'not while they are still up');
});

// ---- car mods ---------------------------------------------------------------------------------------------

ok('mods: paid once, only what suits the car, kept through a reload and on the parked car', () => {
  const p = fresh();
  const car = addCar(p, 'corvo', CARS.corvo.colours[0], 'bought');
  p.save.cash.pocket = 0;
  p.save.cash.bank = 2000;
  const wheels = optionFor('corvo', 'wheels', 'gold')!;
  const r = fitMod(p, car.uid, 'wheels', 'gold');
  assert.ok(r.ok);
  assert.equal(p.save.cash.bank, 2000 - wheels.price);
  assert.equal(fitMod(p, car.uid, 'wheels', 'gold').ok, false, 'not twice');
  assert.equal(p.save.cash.bank, 2000 - wheels.price, 'charged once');
  assert.equal(fitMod(p, car.uid, 'ride', 'lifted').ok, false, 'no lift on a hatchback');
  const suv = addCar(p, 'tundra', CARS.tundra.colours[0], 'bought');
  assert.equal(fitMod(p, suv.uid, 'spoiler', 'wing').ok, false, 'no wing on an SUV');
  assert.ok(fitMod(p, suv.uid, 'ride', 'lifted').ok);
  assert.ok(fitMod(p, car.uid, 'paint', '#c8102e').ok);
  assert.ok(fitMod(p, car.uid, 'plate', 'GR4 FTY').ok);
  p.save.cash.bank = 0;
  assert.equal(fitMod(p, car.uid, 'tint', 'limo').ok, false, 'not without the money');
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)))!;
  const c2 = back.property.cars.find((c) => c.uid === car.uid)!;
  assert.equal(fitted(c2, 'wheels'), 'gold');
  assert.equal(paintOf(c2), '#c8102e');
  assert.equal(c2.mods?.plate, 'GR4 FTY');
  const junk = sanitiseSave(JSON.parse(JSON.stringify({ ...p.save, property: { ...p.save.property, cars: [{ ...car, mods: { wheels: 'rainbow', ride: 'lifted', plate: 'X' } }] } })))!;
  assert.equal(junk.property.cars[0].mods, undefined, 'unknown or unsuitable mods dropped');
  // The parked car carries them.
  p.save.property.activeCar = car.uid;
  const prop = resolveLevel('estate', p.save).props.find((x) => x.kind === 'vehicle' && x.item === 'corvo')!;
  assert.equal(prop.colour, '#c8102e');
  assert.equal(prop.mods?.wheels, 'gold');
});

console.log(`\ntravel: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
