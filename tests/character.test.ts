/** Tests for character creation rules, appearance data and the character store. */
import { defaultAppearance, randomAppearance, sanitiseAppearance } from '../src/character/Appearance';
import {
  BACKGROUNDS,
  CREATION_POINTS,
  canAdd,
  canRemove,
  createCharacter,
  emptyAllocation,
  finalAttributes,
  pointsLeft,
  sanitiseCharacter,
} from '../src/character/Character';
import { TrainingMode } from '../src/core/TrainingMode';
import { CharacterStore } from '../src/save/CharacterStore';
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
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

console.log('Character');

test('allocation: 10 points, nothing above 10 at creation', () => {
  const a = emptyAllocation();
  assert(pointsLeft(a) === CREATION_POINTS, 'starts with 10');
  for (let i = 0; i < 5; i++) a.strength++;
  assert(!canAdd(a, 'strength'), 'strength capped at 10');
  assert(canAdd(a, 'speed'), 'other attributes still open');
  for (let i = 0; i < 5; i++) a.speed++;
  assert(pointsLeft(a) === 0 && !canAdd(a, 'technique'), 'out of points');
  assert(canRemove(a, 'speed') && !canRemove(a, 'technique'), 'remove rules');
});

test('background bonus applies on top of allocation and can pass the cap', () => {
  const a = emptyAllocation();
  a.strength = 5;
  const attrs = finalAttributes(a, 'estate_scrapper');
  assert(attrs.strength === 12 && attrs.endurance === 7 && attrs.speed === 5, JSON.stringify(attrs));
});

test('createCharacter rejects overspending and cleans the name', () => {
  const a = emptyAllocation();
  a.strength = 5;
  a.speed = 5;
  a.agility = 1;
  let threw = false;
  try {
    createCharacter({ name: 'x', appearance: defaultAppearance(), background: 'dancer', allocated: a });
  } catch {
    threw = true;
  }
  assert(threw, 'overspend rejected');
  a.agility = 0;
  const c = createCharacter({ name: '  Big   <Dave>  ', appearance: defaultAppearance(), background: 'doorman', allocated: a });
  assert(c.name === 'Big Dave', `name "${c.name}"`);
  assert(c.money === 200, 'doorman starts with £200');
});

test('estate scrapper Street Fighting rank 2 adds 5% damage', () => {
  const c = createCharacter({ name: 'A', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const mode = new TrainingMode({ character: c });
  assert(Math.abs(mode.player.masteryMultiplier('street') - 1.05) < 1e-9, `mastery ${mode.player.masteryMultiplier('street')}`);
  const plain = new TrainingMode({ character: createCharacter({ name: 'B', appearance: defaultAppearance(), background: 'dancer', allocated: emptyAllocation() }) });
  assert(plain.player.masteryMultiplier('street') === 1, 'rank 1 = no bonus');
});

test('player fighter uses the character’s name, attributes and appearance', () => {
  const a = emptyAllocation();
  a.endurance = 5;
  const app = randomAppearance(() => 0.3);
  const c = createCharacter({ name: 'Shaz', appearance: app, background: 'rugby', allocated: a });
  const mode = new TrainingMode({ character: c });
  assert(mode.player.name === 'Shaz', 'name');
  assert(mode.player.stats.attr('endurance') === 10, `endurance ${mode.player.stats.attr('endurance')}`);
  assert(mode.player.vitals.maxStamina === 180, `stamina ${mode.player.vitals.maxStamina}`);
  assert(mode.player.appearance.hair === app.hair, 'appearance carried over');
  mode.step(emptyCommand());
});

test('random appearances are always valid', () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const a = randomAppearance(rnd);
    const s = sanitiseAppearance(a);
    assert(JSON.stringify(a) === JSON.stringify(s), `appearance ${i} changed by sanitise`);
  }
});

test('sanitise repairs broken appearance data', () => {
  const s = sanitiseAppearance({ body: 'female', muscle: 7, hair: 'nonsense', skinTone: 'red', tattoos: { chest: 'rose' }, accessories: ['chain', 'jetpack'] });
  assert(s.muscle === 1 && s.hair === 'ponytail' && s.skinTone.startsWith('#'), JSON.stringify(s));
  assert(s.tattoos.chest === 'rose' && s.tattoos.neck === 'none', 'tattoos');
  assert(s.accessories.length === 1 && s.accessories[0] === 'chain', 'accessories');
});

test('character store saves, loads and rejects garbage', () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  const store = new CharacterStore(storage);
  assert(store.load() === null, 'empty');
  const c = createCharacter({ name: 'Kez', appearance: defaultAppearance('female'), background: 'amateur_boxer', allocated: emptyAllocation() });
  assert(store.save(c), 'saved');
  const back = store.load();
  assert(back && back.name === 'Kez' && back.appearance.body === 'female' && back.background === 'amateur_boxer', 'round trip');
  mem.set('sfuk.character.v1', '{not json');
  assert(store.load() === null, 'corrupt -> null');
  assert(sanitiseCharacter({ background: 'astronaut' }) === null, 'unknown background rejected');
  store.clear();
  assert(store.load() === null, 'cleared');
});

test('every background has a perk and a two-attribute bonus', () => {
  for (const bg of Object.values(BACKGROUNDS)) {
    const total = Object.values(bg.bonus).reduce((s, v) => s + (v ?? 0), 0);
    assert(total === 4 && Object.keys(bg.bonus).length === 2, `${bg.id} bonus`);
    assert(bg.perk.text.length > 0, `${bg.id} perk`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
