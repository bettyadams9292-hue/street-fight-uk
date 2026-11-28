/**
 * The Metro in play (travel/metro.ts, world/metroLevels.ts): every station is an area you can get down to and up
 * from; trains run to a timetable and come while you wait; no barriers, you walk straight to the platform and pay as you board;
 * each station is shuttered until its district's boss is beaten; people use the stairs.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress, type AreaId } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { ENTRANCE, PLATFORM_X0 } from '../src/world/metroLevels';
import { safeResume } from '../src/progress/resume';
import { exitLocked } from '../src/world/World';
import { STATIONS, fare } from '../src/travel/subway';
import { ARRIVE, arriveBy, boardWhen, CLOSE, destinations, DWELL, enterStation, HEADWAY, metroArea, metroVisit, OPEN, payRide, rideRefusal, setMetroVisit, trainAt, type MetroVisit } from '../src/travel/metro';

/** A visit with its doors open now (in), or with the train away. */
const at = (station: MetroVisit['station'], doorsOpen = true): MetroVisit => ({ station, start: doorsOpen ? ARRIVE + OPEN + 2 : ARRIVE + OPEN + DWELL + CLOSE + 20, t: 0, arrived: false });

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok   ${name}`);
};
const fresh = () => {
  const p = new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  for (const st of STATIONS) p.save.flags[st.opens] = true;
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

ok('trains run to a timetable: wait on the platform and one comes in, opens, shuts and goes; never go back up for one', () => {
  const p = fresh();
  const v = enterStation(p, 'high_street');
  const seen = new Set<string>();
  let opened = -1;
  let prev = trainAt(v).eta;
  // Two whole headways: every phase in order, the board counting down between trains.
  for (let i = 0; i < HEADWAY * 2 * 10; i++) {
    const st = trainAt(v);
    seen.add(st.phase);
    if (st.phase === 'away' || st.phase === 'leaving') assert.ok(st.eta <= prev + 1e-9 || prev === 0, 'the board counts down');
    if (st.boardable && opened < 0) opened = v.t;
    assert.ok(!st.boardable || (st.doors === 1 && st.x === 0), 'only boardable stopped with the doors open');
    if (st.phase === 'arriving') assert.ok(st.x! < 0 && st.doors === 0, 'comes in shut');
    if (st.phase === 'leaving') assert.ok(st.x! > 0 && st.doors === 0, 'goes out shut');
    prev = st.eta;
    v.t += 0.1;
  }
  for (const ph of ['away', 'arriving', 'opening', 'in', 'closing', 'leaving']) assert.ok(seen.has(ph), `saw ${ph}`);
  assert.ok(opened >= 0 && opened <= HEADWAY, `a train within one headway of waiting (${opened.toFixed(1)} s)`);
  assert.equal(boardWhen({ phase: 'away', x: null, doors: 0, eta: 100, boardable: false }), '2 min');
  assert.equal(boardWhen({ phase: 'away', x: null, doors: 0, eta: 20, boardable: false }), 'Due');
});

ok('where the timetable is is fixed by the station and visit (a reload finds it the same); off a train its doors are open', () => {
  const a = fresh();
  const b = fresh();
  assert.equal(enterStation(a, 'riverside').start, enterStation(b, 'riverside').start, 'same visit, same place');
  const off = arriveBy('riverside');
  assert.ok(trainAt(off).boardable && off.arrived, 'stepping off: doors open');
  off.t += 8;
  assert.ok(!trainAt(off).boardable, 'and it goes a few seconds later');
});

ok('the station clock runs on the World: stand on the platform and the train comes', () => {
  const p = fresh();
  p.save.flags.boss_gaffer = true;
  setMetroVisit({ station: 'high_street', start: ARRIVE + OPEN + DWELL + CLOSE + 30, t: 0, arrived: false });
  const w = new World(LEVELS['metro_high_street' as AreaId], p, { entry: 'platform', seed: 2 });
  let boardable = false;
  for (let i = 0; i < 60 * HEADWAY && !boardable; i++) {
    w.step(emptyCommand());
    boardable = trainAt(metroVisit()).boardable;
  }
  assert.ok(boardable, 'the train came');
  setMetroVisit(null);
});

ok('when the doors open, people step off the train onto the platform', () => {
  const p = fresh();
  setMetroVisit({ station: 'high_street', start: ARRIVE - 0.5, t: 0, arrived: false });
  const w = new World(LEVELS['metro_high_street' as AreaId], p, { entry: 'platform', seed: 4 });
  let off = 0;
  for (let i = 0; i < 60 * 8; i++) {
    w.step(emptyCommand());
    off = Math.max(off, w.sim.fighters.filter((f) => f !== w.player && f.pos.z < -2.4).length);
  }
  assert.ok(off > 0, 'someone was in a doorway');
  setMetroVisit(null);
});

ok('no barriers: from the stairs you walk straight down the hall onto the platform', () => {
  const p = fresh();
  setMetroVisit(at('high_street'));
  const w = new World(LEVELS['metro_high_street' as AreaId], p, { entry: 'street', seed: 1 });
  assert.ok(!w.level.stations?.some((s) => (s.id as string) === 'metro_gates'), 'no gate station');
  const c = emptyCommand();
  c.moveX = 1;
  for (let i = 0; i < 900; i++) w.step(c);
  assert.ok(w.player.pos.x > PLATFORM_X0 + 2, `on the platform (${w.player.pos.x.toFixed(1)})`);
  setMetroVisit(null);
});

ok('you pay as you board: cash, then card; not enough and you stay', () => {
  const p = fresh();
  const v = at('tanner_road');
  p.save.cash.pocket = 1;
  assert.equal(payRide(p, 'tanner_road', 'riverside', v).ok, false);
  p.save.cash.pocket = 20;
  const r = payRide(p, 'tanner_road', 'market_square', v);
  assert.ok(r.ok && r.paid === Math.ceil(fare('tanner_road', 'market_square')));
  assert.equal(p.save.cash.pocket, 20 - Math.ceil(fare('tanner_road', 'market_square')));
});

ok('each station is shuttered until its district boss is down, and only open stations are on the train', () => {
  const p = new Progress(newSave(createCharacter({ name: 'B', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  for (const st of STATIONS) {
    const down = LEVELS[ENTRANCE[st.id].area].exits.find((e) => e.to === metroArea(st.id))!;
    assert.ok(exitLocked(down, p), `${st.name} shut at the start`);
    assert.ok(down.lockedText?.includes('opens once'), 'says what opens it');
  }
  p.save.flags.boss_gaffer = true;
  assert.deepEqual(destinations(p, 'tanner_road'), ['high_street']);
  const hs = LEVELS.high_street.exits.find((e) => e.to === metroArea('high_street'))!;
  assert.ok(!exitLocked(hs, p), 'High Street opens with the Gaffer');
  assert.ok(exitLocked(LEVELS.city.exits.find((e) => e.to === metroArea('market_square'))!, p), 'Market Square waits for the Ratcatcher');
});

ok('people use the station stairs: some go down to the street and come down from it', () => {
  const p = fresh();
  setMetroVisit(at('high_street', false));
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


ok('the travel layer refuses every ride the screen would: locked, same station, no train, stale choices', () => {
  const p = new Progress(newSave(createCharacter({ name: 'B', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.cash.pocket = 500;
  const v = (station: 'tanner_road' | 'high_street', train = true) => at(station, train);
  // Nothing open yet: not even a ride from a station you somehow stand in.
  assert.ok(rideRefusal(p, 'tanner_road', 'high_street', v('tanner_road')));
  p.save.flags.boss_gaffer = true;
  assert.equal(rideRefusal(p, 'tanner_road', 'high_street', v('tanner_road')), null, 'both open, train in');
  assert.ok(rideRefusal(p, 'tanner_road', 'market_square', v('tanner_road'))?.includes('shuttered'), 'a locked destination');
  assert.ok(rideRefusal(p, 'tanner_road', 'tanner_road', v('tanner_road')), 'same station');
  assert.ok(rideRefusal(p, 'tanner_road', 'high_street', v('tanner_road', false)), 'no train in');
  assert.ok(rideRefusal(p, 'tanner_road', 'high_street', v('high_street')), 'a visit to another station');
  assert.ok(rideRefusal(p, 'tanner_road', 'high_street', null), 'no visit at all (a reload)');
  assert.ok(rideRefusal(p, 'tanner_road', 'nowhere' as never, v('tanner_road')), 'not a station');
  const before = p.save.cash.pocket;
  assert.equal(payRide(p, 'tanner_road', 'market_square', v('tanner_road')).ok, false);
  assert.equal(p.save.cash.pocket, before, 'a refused ride costs nothing');
  assert.equal(p.save.metro.rides, 0);
});
ok('an old save left in a shut station comes back up to the street; a lost arrival spot falls back', async () => {
  const { safeResume } = await import('../src/progress/resume');
  const p = new Progress(newSave(createCharacter({ name: 'C', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.area = 'metro_market_square' as AreaId;
  p.save.entry = 'platform';
  assert.deepEqual(safeResume(p), { area: ENTRANCE.market_square.area, entry: 'metro_market_square' });
  p.save.flags.boss_ratcatcher = true;
  assert.deepEqual(safeResume(p), { area: 'metro_market_square', entry: 'platform' }, 'open: stays');
  p.save.area = 'high_street' as AreaId;
  p.save.entry = 'cab_home_gone';
  assert.equal(safeResume(p).entry, LEVELS.high_street.entries[0].id);
});
console.log(`metro: ${passed} passed, 0 failed`);
