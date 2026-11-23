/**
 * The Red Lion's lock-in (an optional fight) is on only some visits: about one in three, rolled once per trip
 * (World.fightIsOn), so it doesn't kick off every time you walk in, and a rebuild mid-visit keeps the answer.
 * Optional fights with no `chance` are unchanged.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { LOCK_IN_CHANCE } from '../src/world/interiors';
import { fightIsOn, World } from '../src/world/World';

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

const progress = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
const pub = LEVELS.pub;
const lockIn = pub.encounters.find((e) => e.id === 'lock_in')!;

console.log('Pub fights');

test('the lock-in has a chance, about one visit in three', () => {
  assert(lockIn && lockIn.optional && lockIn.chance === LOCK_IN_CHANCE, 'chance set');
  let on = 0;
  const N = 3000;
  for (let t = 0; t < N; t++) if (fightIsOn(lockIn, 'pub', t)) on++;
  const share = on / N;
  assert(Math.abs(share - LOCK_IN_CHANCE) < 0.04, `on ${(share * 100).toFixed(1)}% of visits`);
});

test('not every visit, and never long without one: no run of 15 quiet visits in the first 300', () => {
  let run = 0;
  let worst = 0;
  for (let t = 0; t < 300; t++) {
    run = fightIsOn(lockIn, 'pub', t) ? 0 : run + 1;
    worst = Math.max(worst, run);
  }
  assert(worst < 15, `longest quiet run ${worst}`);
});

test('walking in: the fight is waiting only when it is on, and the same trip gives the same answer', () => {
  let seenOn = false;
  let seenOff = false;
  for (let trips = 0; trips < 20; trips++) {
    const p = progress();
    p.save.trips = trips;
    const on = fightIsOn(lockIn, 'pub', trips);
    const w = new World(pub, p, { entry: 'door', seed: 1, civilians: false });
    const status = w.encounters.find((e) => e.def.id === 'lock_in')!.status;
    assert(status === (on ? 'waiting' : 'cleared'), `trip ${trips}: ${status} but on=${on}`);
    const again = new World(pub, p, { entry: 'door', seed: 9, civilians: false });
    assert(again.encounters.find((e) => e.def.id === 'lock_in')!.status === status, 'a rebuild keeps it');
    if (on) seenOn = true;
    else seenOff = true;
  }
  assert(seenOn && seenOff, 'some visits on, some off');
});

test('optional street fights with no chance still wait every visit', () => {
  const street = LEVELS.high_street;
  const k = street.encounters.find((e) => e.id === 'kebab_queue')!;
  assert(k.chance === undefined, 'no chance on the kebab queue');
  for (let t = 0; t < 20; t++) assert(fightIsOn(k, 'high_street', t), 'always on');
});

console.log(`\npub fights: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
