/**
 * Mugging passers-by and pussying out: a random share of your cash to run, rolled per fight; anyone on the
 * street can be mugged, and they either hand it over and run or fight for it.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { BAIL_MAX, BAIL_MIN, MUG_HEAT, mugResistChance, valuablesOf, World } from '../src/world/World';

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
const progress = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
const street = LEVELS.high_street;

console.log('Pussying out and mugging');

test('pussying out costs a random 25–60% of your cash, rolled once per fight and shown before you press it', () => {
  const p = progress();
  const w = new World(street, p, { entry: street.entries[0].id, seed: 3, civilians: false });
  const shares: number[] = [];
  for (let i = 0; i < 6; i++) {
    p.save.cash.pocket = 200;
    const lad = w.spawnEnemy('thug', w.player.pos.x + 2, w.player.pos.z);
    w.step(emptyCommand());
    const a = w.canBail();
    const b = w.canBail();
    assert(a.ok && b.ok, 'can run from a street fight');
    if (!a.ok || !b.ok) return;
    assert(a.share === b.share && a.cost === b.cost, 'the price holds for the whole fight');
    assert(a.share >= BAIL_MIN && a.share <= BAIL_MAX, `share ${a.share} in range`);
    const r = w.bailOut();
    assert(r.ok && r.dropped === a.cost && p.save.cash.pocket === 200 - a.cost, `dropped what the button said (${r.ok && r.dropped} vs ${a.cost})`);
    shares.push(a.share);
    // Done with this one: clear it so the next fight rolls a new price.
    for (let f = 0; f < 60 * 8; f++) w.step(emptyCommand());
    lad.knockOut();
    w.enemies = w.enemies.filter((e) => e !== lad);
    w.sim.remove(lad);
    w.canBail();
  }
  for (let i = 1; i < shares.length; i++) assert(Math.abs(shares[i] - shares[i - 1]) >= 0.05, `never the same twice running: ${shares.join(', ')}`);
});

test('what a passer-by is worth is what they’re seen wearing', () => {
  const a = { ...defaultAppearance(), accessories: ['chain', 'watch'] as never, chainColour: 'gold' as const };
  const v = valuablesOf(a);
  assert(v.includes('chain_gold') && v.includes('watch_basic'), v.join(','));
  assert(mugResistChance('nervy', false, 0, 1) < mugResistChance('steady', true, 0, 1), 'the steady fight more than the nervy');
  assert(mugResistChance('nosy', true, 600, 1) > mugResistChance('nosy', true, 20, 1), 'more worth fighting for, more fight');
  assert(mugResistChance('nosy', true, 100, 20) < mugResistChance('nosy', true, 100, 1), 'a known face gets it handed over');
});

test('mugging: they hand it over and run, or fight for it and drop it when they’re down', () => {
  let handed = 0;
  let fought = 0;
  for (let seed = 1; seed < 60 && (!handed || !fought); seed++) {
    const p = progress();
    const w = new World(street, p, { entry: street.entries[0].id, seed });
    for (const e of w.encounters) e.status = 'cleared';
    const c = w.civilians[0];
    if (!c) continue;
    (c.f.appearance as { accessories: string[] }).accessories = ['chain'];
    (c.f.appearance as { chainColour: string }).chainColour = 'gold';
    w.player.pos.x = c.f.pos.x - 0.6;
    w.player.pos.z = c.f.pos.z;
    w.step(emptyCommand());
    const it = w.interactable;
    if (it?.kind !== 'mug' || it.target !== c.f) continue;
    assert(/^Mug (him|her): gold chain$/.test(it.label), it.label);
    const heat = p.save.heat;
    const use = { ...emptyCommand(), use: true, pressed: { ...emptyCommand().pressed, use: true } };
    w.step(use as never);
    assert(p.save.heat === heat + MUG_HEAT, `heat +${MUG_HEAT}`);
    const chain = () => w.items.find((g) => g.stack.id === 'chain_gold');
    if (c.f.team === 'enemy') {
      fought++;
      assert(w.enemies.includes(c.f) && !w.civilians.some((x) => x.f === c.f), 'off the street and into the fight');
      assert(!chain(), 'nothing dropped yet');
      c.f.knockOut();
      w.sim.bus.emit('fighter:ko', { fighter: c.f, by: w.player });
      for (let f = 0; f < 200; f++) w.step(emptyCommand());
      assert(chain()?.stack.stolen, 'down: the chain’s on the floor, hot');
    } else {
      handed++;
      assert(chain()?.stack.stolen, 'handed over: the chain at their feet, hot');
      assert(c.brain.activity === 'flee', 'and they leg it');
      for (let f = 0; f < 120; f++) w.step(emptyCommand());
      assert(c.brain.activity === 'flee', 'still running two seconds on');
      w.player.pos.x = c.f.pos.x - 0.6;
      w.player.pos.z = c.f.pos.z;
      w.step(emptyCommand());
      assert(w.interactable?.kind !== 'mug', 'can’t mug the same one twice');
    }
  }
  assert(handed > 0 && fought > 0, `saw both: handed ${handed}, fought ${fought}`);
});

test('no mugging in a fight', () => {
  const p = progress();
  const w = new World(street, p, { entry: street.entries[0].id, seed: 4 });
  for (const e of w.encounters) e.status = 'cleared';
  const c = w.civilians[0];
  assert(c, 'someone about');
  w.spawnEnemy('thug', c.f.pos.x + 3, c.f.pos.z);
  w.player.pos.x = c.f.pos.x - 0.6;
  w.player.pos.z = c.f.pos.z;
  w.step(emptyCommand());
  assert(w.interactable?.kind !== 'mug', 'not with a fight on');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
