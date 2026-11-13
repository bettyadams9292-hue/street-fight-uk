/** Phase 3 street pass: it only dresses streets that exist and have lamps, it can be switched off, and it changes no gameplay data. */
import { SLICE_LEVELS, streetPassEnabled } from '../src/render/street/slice';
import { LEVELS } from '../src/world/levels';
import { propBox } from '../src/world/LevelTypes';
import { SHOT_NAMES } from '../src/debug/shotList';

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
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

console.log('Street pass');

test('the pass is on by default and ?street=classic turns it off', () => {
  assert(streetPassEnabled('') === true, 'off by default');
  assert(streetPassEnabled('?look=off&shot=estate') === true, 'other switches turned it off');
  assert(streetPassEnabled('?street=classic') === false, '?street=classic ignored');
  assert(streetPassEnabled('?street=anything') === true, 'an unknown value turned it off');
});

test('every slice street exists, is an outdoor street and has lamps to pool light under', () => {
  assert(SLICE_LEVELS.length >= 1, 'no slice streets');
  const levels = LEVELS as Record<string, (typeof LEVELS)[keyof typeof LEVELS]>;
  for (const id of SLICE_LEVELS) {
    const l = levels[id];
    assert(l, `${id} is not a level`);
    assert(l.lights.length >= 2, `${id} has too few lamps`);
    assert(l.facades.length >= 2, `${id} has no frontages to dress`);
    for (const lamp of l.lights) assert(lamp.x >= l.bounds.minX - 12 && lamp.x <= l.bounds.maxX + 12 && lamp.y > 1, `${id} has a lamp out of place`);
  }
});

test('the estate still plays the same: its solid props, exits and fights are untouched', () => {
  const e = LEVELS.estate;
  const solid = e.props.map((p) => propBox(p)).filter(Boolean).length;
  assert(e.props.length === 10 && solid >= 6, `props changed: ${e.props.length} props, ${solid} solid`);
  // Five of its own, plus two front doors of properties for sale (9 Tanner Road, Flat 3 Lowry House).
  assert(e.exits.length === 7 && e.exits.filter((x) => x.to === 'property').length === 2, `exits changed: ${e.exits.length}`);
  assert((e.encounters ?? []).some((x) => x.id === 'lads'), 'the first fight is missing');
  assert(e.bounds.minX === -12 && e.bounds.maxX === 56, 'the street changed length');
});

test('the visual tests photograph the whole slice street', () => {
  for (const n of ['estate', 'estate_terrace', 'estate_fight', 'estate_garages', 'estate_gym']) assert((SHOT_NAMES as readonly string[]).includes(n), `no picture of ${n}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
