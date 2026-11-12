/**
 * Pedestrians keep to the pavement: on kit streets with a road the kerb is at
 * KERB_Z, and nobody walks out over it.
 */
import { LEVELS } from '../src/world/levels';
import { kerbFor, KERB_Z, kitStreet, planStreet } from '../src/city/street';
import { CIVILIAN_DENSITY } from '../src/world/civilians';
import { World } from '../src/world/World';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { newSave, Progress } from '../src/progress/Progress';
import { emptyCommand } from '../src/input/Commands';

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

function freshProgress(): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  return new Progress(newSave(c));
}

console.log('Kerb');
const withRoad = Object.values(LEVELS).filter((l) => kerbFor(l) !== null);
const busy = withRoad.filter((l) => (CIVILIAN_DENSITY as Record<string, number>)[l.id] > 0);
test('some streets have a road and a kerb', () => {
  assert(withRoad.length >= 3, `${withRoad.length} streets with a kerb`);
  for (const l of withRoad) assert(kerbFor(l) === KERB_Z, `${l.id} kerb at ${kerbFor(l)}`);
});

for (const level of busy.slice(0, 6)) {
  test(`${level.id}: pedestrians stay behind the kerb for two minutes`, () => {
    const w = new World(level, freshProgress(), { entry: level.entries[0].id, seed: 3 });
    let worst = -Infinity;
    let seen = 0;
    for (let f = 0; f < 60 * 120; f++) {
      w.step(emptyCommand());
      for (const c of (w as unknown as { civilians: { f: { pos: { z: number } } }[] }).civilians) {
        worst = Math.max(worst, c.f.pos.z);
        seen++;
      }
    }
    assert(seen > 1000, `hardly anyone about (${seen} person-frames)`);
    assert(worst < KERB_Z, `someone reached z = ${worst.toFixed(2)} (kerb ${KERB_Z})`);
  });
}

console.log('Parked vehicles');
test('vehicles parked in front of the fight are built on their own (so they can fade), the rest are baked', () => {
  let own = 0;
  for (const l of Object.values(LEVELS)) {
    if (!kitStreet(l)) continue;
    const plan = planStreet(l);
    for (const pl of plan.placements) if (pl.own) {
      own++;
      assert(pl.own.startsWith('vehicle:'), `${l.id}: ${pl.own}`);
      assert(pl.z > 0.6, `${l.id}: ${pl.model} at z ${pl.z} is not in front`);
    }
  }
  assert(own > 0, 'no vehicles to fade anywhere');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
