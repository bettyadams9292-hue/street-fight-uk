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
const fresh = () => new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
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

console.log(`\ntravel: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
