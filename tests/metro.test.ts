/**
 * The Metro in play (travel/metro.ts, world/metroLevels.ts): every station is an area you can get down to and up
 * from; a visit rolls once whether a train's in; the gates hold you till you tap in or hop; tapping in needs the
 * dearest fare and tapping out charges the real one; hopping can cost a penalty and a record; people use the stairs.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress, type AreaId } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { GATE_X, ENTRANCE } from '../src/world/metroLevels';
import { STATIONS, fare } from '../src/travel/subway';
import { arriveBy, hop, maxFare, metroArea, rollTrain, setMetroVisit, tapIn, tapOut } from '../src/travel/metro';

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok   ${name}`);
};
const fresh = () => {
  const p = new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  for (const st of STATIONS) if (st.opens) p.save.flags[st.opens] = true;
  return p;
};

ok('every station is an area, with stairs down from its street and back up to the same spot', () => {
  for (const st of STATIONS) {
    const area = metroArea(st.id);
    const lv = LEVELS[area];
    assert.ok(lv, area);
    const up = lv.exits.find((e) => e.id === 'metro_stairs')!;
    assert.equal(up.to, ENTRANCE[st.id].area);
    const street = LEVELS[up.to];
    const down = street.exits.find((e) => e.to === area);
    assert.ok(down, `${up.to} has stairs down to ${area}`);
    assert.ok(street.entries.some((e) => e.id === up.toEntry), `${up.to} has the spot you come up to`);
    assert.ok(lv.entries.some((e) => e.id === 'platform') && lv.entries.some((e) => e.id === down!.toEntry));
  }
});

ok('a visit rolls once whether a train is in: sometimes yes, sometimes no; off a train it is always there', () => {
  const p = fresh();
  const seen = new Set<boolean>();
  for (let i = 0; i < 30; i++) seen.add(rollTrain(p, 'high_street').train);
  assert.deepEqual([...seen].sort(), [false, true]);
  const a = arriveBy('riverside');
  assert.ok(a.train && a.through && a.arrived);
  const v = rollTrain(p, 'high_street');
  if (!v.train) assert.ok(v.minutes >= 2 && v.minutes <= 8);
});

ok('tapping in needs the dearest fare from here; tapping out charges the ride', () => {
  const p = fresh();
  p.save.cash.pocket = 1;
  assert.equal(tapIn(p, 'tanner_road').ok, false);
  p.save.cash.pocket = 20;
  assert.ok(maxFare(p, 'tanner_road') >= fare('tanner_road', 'riverside'));
  assert.ok(tapIn(p, 'tanner_road').ok);
  const charged = tapOut(p, 'market_square');
  assert.equal(charged, fare('tanner_road', 'market_square'));
  assert.equal(p.save.cash.pocket, 20 - Math.ceil(charged));
  assert.equal(p.save.metro.tappedIn, null);
  assert.equal(tapOut(p, 'riverside'), 0, 'no tap-in, nothing taken');
});

ok('hopping: caught costs the penalty fare, police heat and fare evasion on the record', () => {
  const p = fresh();
  p.save.cash.pocket = 100;
  assert.equal(hop(p, 'market_square', 0.99).ok && (hop(p, 'market_square', 0.99) as { caught?: boolean }).caught, false);
  const r = hop(p, 'market_square', 0);
  assert.ok(r.ok && r.caught && r.fine === 50);
  assert.equal(p.save.cash.pocket, 50);
  assert.ok(p.save.record.some((c) => c.crime === 'fare_evasion'));
});

ok('the gates hold you in the ticket hall until you are through', () => {
  const p = fresh();
  const lv = LEVELS['metro_high_street' as AreaId];
  setMetroVisit({ station: 'high_street', train: true, minutes: 0, through: false, arrived: false });
  const w = new World(lv, p, { entry: 'street', seed: 1 });
  const right = () => {
    const c = emptyCommand();
    c.moveX = 1;
    return c;
  };
  for (let i = 0; i < 600; i++) w.step(right());
  assert.ok(w.player.pos.x <= GATE_X - 0.7, `held at the gates (${w.player.pos.x.toFixed(2)})`);
  setMetroVisit({ station: 'high_street', train: true, minutes: 0, through: true, arrived: false });
  for (let i = 0; i < 300; i++) w.step(right());
  assert.ok(w.player.pos.x > GATE_X + 2, 'through once tapped in');
  setMetroVisit(null);
});

ok('people use the station stairs: some go down to the street and come down from it', () => {
  const p = fresh();
  setMetroVisit({ station: 'high_street', train: false, minutes: 4, through: false, arrived: false });
  const w = new World(LEVELS['metro_high_street' as AreaId], p, { entry: 'street', seed: 3 });
  let onStairs = 0;
  for (let i = 0; i < 60 * 40; i++) {
    w.step(emptyCommand());
    onStairs = Math.max(onStairs, w.sim.fighters.filter((f) => f !== w.player && Math.abs(f.pos.y) > 0.5).length);
  }
  assert.ok(onStairs > 0, 'someone was on the stairs');
  setMetroVisit(null);
});

ok('on a street with a station, passers-by turn in at the stairs and walk down out of sight', () => {
  const p = fresh();
  const w = new World(LEVELS.high_street, p, { entry: 'metro_high_street', seed: 5 });
  const before = new Set(w.sim.fighters);
  let down = 0;
  for (let i = 0; i < 60 * 90; i++) {
    w.step(emptyCommand());
    for (const f of w.sim.fighters) if (f !== w.player && f.pos.y < -0.5) down++;
  }
  assert.ok(down > 0, 'someone went down the stairs');
  assert.ok(before.size > 0);
});

console.log(`metro: ${passed} passed, 0 failed`);
