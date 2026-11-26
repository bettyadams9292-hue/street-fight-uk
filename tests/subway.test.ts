/**
 * The Brack Metro groundwork (travel/subway.ts, docs/SUBWAY_PLAN.md): the line and its stations are real places in
 * the game, fares sit between a bus and a cab, hopping the barriers is a real risk, and scraps underground are rare
 * on your first rides.
 */
import assert from 'node:assert/strict';
import { LEVELS } from '../src/world/levels';
import { CAB_MIN } from '../src/ui/hub';
import { carriageScrap, fare, hopCaught, platformScrap, rideSeconds, STATIONS, stopsBetween, waitSeconds, PENALTY_FARE } from '../src/travel/subway';

let passed = 0;
let failed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
};

console.log('Brack Metro');
test('every station stands on a real street, inside it, and away from that street\'s doors', () => {
  for (const s of STATIONS) {
    const l = LEVELS[s.area];
    assert(l, `${s.id}: no area ${s.area}`);
    assert(s.x > l.bounds.minX + 2 && s.x < l.bounds.maxX - 2, `${s.id} at ${s.x} is off ${s.area}`);
    for (const e of l.exits) if (e.kind === 'door' && e.to !== 'subway') assert(Math.abs(e.x - s.x) > 1.5, `${s.id} is on top of ${e.id}`);
  }
  assert(new Set(STATIONS.map((s) => s.id)).size === STATIONS.length, 'ids are unique');
});
test('the line runs both ways and stops at each station between', () => {
  assert.deepEqual(stopsBetween('high_street', 'canal_docks'), ['high_street', 'market_square', 'canal_docks']);
  assert.deepEqual(stopsBetween('canal_docks', 'high_street'), ['canal_docks', 'market_square', 'high_street']);
  assert(rideSeconds('tanner_road', 'deep_line') > rideSeconds('tanner_road', 'high_street'));
});
test('fares: a few quid, by the zones crossed, always under the cab minimum', () => {
  assert(fare('high_street', 'high_street') === 0);
  for (const a of STATIONS) for (const b of STATIONS) if (a !== b) assert(fare(a.id, b.id) >= 2 && fare(a.id, b.id) < CAB_MIN, `${a.id}→${b.id} £${fare(a.id, b.id)}`);
  assert(fare('tanner_road', 'deep_line') > fare('high_street', 'market_square'), 'further zones cost more');
  assert(PENALTY_FARE >= 10 * fare('tanner_road', 'deep_line'), 'getting caught costs far more than paying');
});
test('hopping the barriers: worth a go, riskier in town, when you keep doing it, and when you\'re wanted', () => {
  assert(hopCaught(3, 0, 0) < hopCaught(1, 0, 0));
  assert(hopCaught(1, 4, 0) > hopCaught(1, 0, 0));
  assert(hopCaught(1, 0, 60) > hopCaught(1, 0, 0));
  assert(hopCaught(1, 99, 99) <= 0.8, 'never certain');
  assert(hopCaught(2, 0, 0) < 0.3, 'usually you get away with it');
});
test('waiting and scraps: no scrap on your first rides, more at night and on rough stations', () => {
  assert(waitSeconds(0, false) >= 8 && waitSeconds(1, true) <= 60);
  assert(platformScrap(3, true, 50, 0) === 0 && carriageScrap(6, true, 1) === 0, 'first rides are quiet');
  assert(platformScrap(3, true, 0, 5) > platformScrap(1, false, 0, 5));
  assert(platformScrap(3, true, 100, 9) <= 0.6 && carriageScrap(20, true, 9) <= 0.45);
});

console.log(`\nsubway: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
