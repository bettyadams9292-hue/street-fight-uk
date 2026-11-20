/**
 * Mugging passers-by and pussying out: a random share of your cash to run, rolled per fight; anyone on the
 * street can be mugged, and they either hand it over and run or fight for it.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { ASSAULT_HEAT, BAIL_MAX, BAIL_MIN, heroChance, KNOWN_FACE, MUG_HEAT, MUG_WITNESS_HEAT, mugResistChance, policeCallChance, valuablesOf, World } from '../src/world/World';
import { ARREST_HEAT } from '../src/world/robbery';
import { ago } from '../src/ui/phone/Phone';

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
    let ev: { witnesses: number; heat: number } | null = null;
    w.events.on('mug', (e) => (ev = e));
    const use = { ...emptyCommand(), use: true, pressed: { ...emptyCommand().pressed, use: true } };
    w.step(use as never);
    assert(ev, 'mug event');
    const e = ev as unknown as { witnesses: number; heat: number };
    assert(e.heat === MUG_HEAT + e.witnesses * MUG_WITNESS_HEAT && p.save.heat === heat + e.heat, `heat +${MUG_HEAT} and +${MUG_WITNESS_HEAT} a witness (${e.witnesses}): ${p.save.heat - heat}`);
    assert(w.mugCount === 1, 'the district remembers');
    const chain = () => w.items.find((g) => g.stack.id === 'chain_gold');
    if (c.f.team === 'enemy') {
      fought++;
      assert(w.enemies.includes(c.f) && !w.civilians.some((x) => x.f === c.f), 'off the street and into the fight');
      assert(!chain(), 'nothing dropped yet');
      c.f.knockOut();
      const before = p.save.heat;
      w.sim.bus.emit('fighter:ko', { fighter: c.f, by: w.player });
      assert(p.save.heat === Math.min(100, before + ASSAULT_HEAT), 'putting them down is assault');
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

test('consequences scale: witnesses and a reputation bring the police and heroes', () => {
  assert(policeCallChance(0, 0, 0) < policeCallChance(3, 0, 0), 'witnesses ring it in');
  assert(policeCallChance(1, 3, 0) > policeCallChance(1, 0, 0), 'a known mugger gets reported more');
  assert(policeCallChance(0, 0, ARREST_HEAT) === 1, 'once wanted, every time');
  assert(heroChance(3) > heroChance(0) && heroChance(9) <= 0.65, 'heroes likelier, never certain');
});

test('a known face: after enough muggings the nervy cross the road when you come near', () => {
  const p = progress();
  for (let n = 1; n <= KNOWN_FACE; n++) p.set(`mugged:${street.district}:${n}`);
  let checked = 0;
  for (let seed = 1; seed < 40 && checked < 3; seed++) {
    const w = new World(street, p, { entry: street.entries[0].id, seed });
    for (const e of w.encounters) e.status = 'cleared';
    let said = false;
    w.events.on('known:face', () => (said = true));
    const c = w.civilians.find((x) => x.brain.temper === 'nervy' && x.brain.activity === 'walk');
    if (!c) continue;
    w.player.pos.x = c.f.pos.x - 1.2;
    w.player.pos.z = c.f.pos.z;
    for (let f = 0; f < 20; f++) w.step(emptyCommand());
    assert(said, 'told once you walk in');
    assert(c.brain.activity === 'flee', `a nervy one runs (${c.brain.activity})`);
    checked++;
  }
  assert(checked > 0, 'found a nervy walker');
});

test('phone times read like a phone', () => {
  assert(ago(1000, 1000 + 10_000) === 'now' && ago(0, 5) === '' && ago(1, 1 + 4 * 60_000) === '4m' && ago(1, 1 + 2 * 3_600_000) === '2h', 'now, 4m, 2h');
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
