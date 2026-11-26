/**
 * Mugging passers-by and pussying out: a random share of your cash to run, rolled per fight; anyone on the
 * street can be mugged, and they either hand it over and run or fight for it.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { MUG_MEMORY, newSave, Progress } from '../src/progress/Progress';
import { ITEMS } from '../src/items/items';
import { LEVELS } from '../src/world/levels';
import { ASSAULT_HEAT, BAIL_MAX, BAIL_MIN, heroChance, MUG_HEAT, MUG_WITNESS_HEAT, mugHaul, mugResistChance, policeCallChance, valuablesOf, World } from '../src/world/World';
import { coolHeat, GANG_GRUDGE, gangMods, HEAT, huntChance, KNOWN_FACE_HEAT } from '../src/progress/heat';
import { arrest } from '../src/world/robbery';
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
    assert(/^Mug (him|her)$/.test(it.label), `you don't see what's in their pockets: ${it.label}`);
    const heat = p.save.heat;
    const pocket0 = p.save.cash.pocket;
    let ev: { witnesses: number; heat: number; items: string[]; cash: number } | null = null;
    w.events.on('mug', (e) => (ev = e));
    const use = { ...emptyCommand(), use: true, pressed: { ...emptyCommand().pressed, use: true } };
    w.step(use as never);
    assert(ev, 'mug event');
    const e = ev as unknown as { witnesses: number; heat: number; items: string[]; cash: number };
    assert(e.heat === MUG_HEAT + e.witnesses * MUG_WITNESS_HEAT && p.save.heat === heat + e.heat, `heat +${MUG_HEAT} and +${MUG_WITNESS_HEAT} a witness (${e.witnesses}): ${p.save.heat - heat}`);
    assert(p.heatIn(street.district).street === HEAT.mug.street + e.witnesses * HEAT.witness.street, 'the locals remember');
    // Whatever the pockets gave up (a roll, mugHaul): all of it on the floor, hot.
    const haul = () => e.items.every((id) => w.items.some((g) => g.stack.id === id && g.stack.stolen)) && (!e.cash || w.cash.some((m) => m.amount === e.cash) || p.save.cash.pocket >= pocket0 + e.cash);
    const nothingYet = () => !e.items.some((id) => w.items.some((g) => g.stack.id === id));
    if (c.f.team === 'enemy') {
      fought++;
      assert(w.enemies.includes(c.f) && !w.civilians.some((x) => x.f === c.f), 'off the street and into the fight');
      assert(nothingYet(), 'nothing dropped yet');
      c.f.knockOut();
      const before = p.save.heat;
      w.sim.bus.emit('fighter:ko', { fighter: c.f, by: w.player });
      assert(p.save.heat === Math.min(100, before + ASSAULT_HEAT), 'putting them down is assault');
      for (let f = 0; f < 200; f++) w.step(emptyCommand());
      assert(haul(), 'down: what they had is on the floor, hot');
    } else {
      handed++;
      assert(haul(), `handed over: what they had at their feet, hot (${JSON.stringify(e.items)} £${e.cash}; floor ${JSON.stringify(w.items.map((g) => g.stack.id))} cash ${JSON.stringify(w.cash.map((m) => m.amount))})`);
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

test('a mugging is a few quid: pockets are a roll, jewellery hardly ever, a worked street gives up less', () => {
  let seed = 11;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = { ...defaultAppearance(), accessories: ['chain'], chainColour: 'gold' } as never;
  const worth = (streak: number) => {
    let total = 0;
    let gold = 0;
    for (let i = 0; i < 4000; i++) {
      const h = mugHaul(next, a, streak);
      total += h.cash + h.items.reduce((t, id) => t + Math.round((ITEMS[id]?.value ?? 0) * 0.5), 0);
      if (h.items.includes('chain_gold')) gold++;
    }
    return { avg: total / 4000, gold: gold / 4000 };
  };
  const first = worth(0);
  const seventh = worth(6);
  assert(first.avg > 8 && first.avg < 30, `a first mugging is worth about £${first.avg.toFixed(0)} at the pawn shop`);
  assert(first.gold < 0.07, `the gold chain comes off ${(first.gold * 100).toFixed(1)}% of the time`);
  assert(seventh.avg < first.avg * 0.35, `the seventh on one street is worth £${seventh.avg.toFixed(0)}, against £${first.avg.toFixed(0)}`);
  let total = 0;
  for (let k = 0; k < 7; k++) total += worth(k).avg;
  assert(total < 80, `robbing seven people in a row comes to about £${total.toFixed(0)}`);
});

test('a street that has just been worked: it remembers for a while, and the heat grows', () => {
  const p = progress();
  assert(p.mugStreak('High Street') === 0);
  p.noteMugging('High Street');
  p.noteMugging('High Street');
  assert(p.mugStreak('High Street') === 2 && p.mugStreak('Hollins') === 0, 'per street');
  p.save.playTime += MUG_MEMORY + 1;
  assert(p.mugStreak('High Street') === 0, 'forgotten after a while');
});

test('consequences scale: witnesses and a reputation bring the police and heroes', () => {
  assert(policeCallChance(0, 0, 0) < policeCallChance(3, 0, 0), 'witnesses ring it in');
  assert(policeCallChance(1, 60, 0) > policeCallChance(1, 0, 0), 'a known mugger gets reported more');
  assert(policeCallChance(0, 0, ARREST_HEAT) === 1, 'once wanted, every time');
  assert(heroChance(60) > heroChance(0) && heroChance(100) <= 0.65, 'heroes likelier, never certain');
});

test('a known face: after enough muggings the nervy cross the road when you come near', () => {
  const p = progress();
  p.addHeatOf({ street: KNOWN_FACE_HEAT }, street.district);
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

test('heat is kept district by district, and save.heat is the police reading where you are', () => {
  const p = progress();
  p.enterDistrict('High Street');
  p.gangProvoked();
  p.setHeat('gang', 0);
  p.addHeat(30);
  p.addHeatOf({ street: 20, gang: 10 });
  assert(p.save.heat === 30, 'wanted here');
  p.enterDistrict('Canal Docks');
  assert(p.save.heat === 0 && p.heatIn('High Street').police === 30, 'not wanted at the docks; still wanted on the High Street');
  p.addHeat(70);
  assert(p.wanted === 70, 'the basement sees the worst of it');
  arrest(p);
  assert(p.heatIn('Canal Docks').police === 0 && p.heatIn('High Street').police === 30, 'nicked at the docks: only their police are done with you');
  p.tick();
  assert(p.heatIn('High Street').police === 30 - 8 && p.heatIn('High Street').street === 20 - 4 && p.heatIn('High Street').gang === 10 - 3, 'cools away from it');
  const m = { A: { police: 10, street: 10, gang: 10 }, B: { police: 4, street: 0, gang: 0 } };
  coolHeat(m, 'A');
  assert(m.A.police === 6 && m.A.gang === 8 && !('B' in m), 'where you are cools at half the rate; cold districts are forgotten');
});

test('old saves: one wanted level lands where you are; a grudge becomes gang heat', () => {
  const p = progress();
  p.save.heat = 50;
  p.gangProvoked('Back Alleys');
  p.setHeat('gang', 0, 'Back Alleys');
  p.set('grudge:Back Alleys');
  p.set('grudge:Old Market');
  p.enterDistrict('High Street');
  assert(p.heatIn('High Street').police === 50 && p.heatIn('Back Alleys').gang === HEAT.bailBroke.gang && !p.has('grudge:Back Alleys'), 'migrated');
  assert(p.heatIn('Old Market').gang === 0 && !p.has('grudge:Old Market'), 'a crew you never provoked lets it go');
});

test('gang heat: their fights hit harder, running raises it, their boss down wipes it', () => {
  assert(!gangMods(GANG_GRUDGE - 1) && gangMods(100)!.dealt === 2 && gangMods(100)!.taken === 0.5, 'grudge scale');
  assert(huntChance(10) === 0 && huntChance(90) > huntChance(55), 'hunting only when it’s high');
  const p = progress();
  p.save.cash.pocket = 0;
  const run = () => {
    const w = new World(street, p, { entry: street.entries[0].id, seed: 2, civilians: false });
    w.spawnEnemy('thug', w.player.pos.x + 2, w.player.pos.z);
    w.step(emptyCommand());
    return w.bailOut();
  };
  assert(run().ok && p.heatIn(street.district).gang === 0, 'before you take on their boss, the crew don’t care');
  p.gangProvoked(street.district);
  assert(p.heatIn(street.district).gang === HEAT.provoke.gang, 'started on the boss: they’re in it');
  assert(run().ok && p.heatIn(street.district).gang === HEAT.provoke.gang + HEAT.bailBroke.gang, 'ran with nothing: they won’t forget');
  p.gangDone(street.district);
  assert(p.heatIn(street.district).gang === 0 && !p.gangOn(street.district), 'boss down: finished with you');
  p.addHeatOf({ gang: 30 }, street.district);
  assert(p.heatIn(street.district).gang === 0, 'and it stays that way');
});

test('gang hunt: with their heat high, lads come looking for you', () => {
  let came = 0;
  for (let seed = 1; seed < 12 && !came; seed++) {
    const p = progress();
    p.gangProvoked(street.district);
    p.addHeatOf({ gang: 100 }, street.district);
    const w = new World(street, p, { entry: street.entries[0].id, seed, civilians: false });
    for (const e of w.encounters) e.status = 'cleared';
    let n = 0;
    w.events.on('gang:hunt', (e) => (n = e.count));
    for (let f = 0; f < 60 * 14 && !n; f++) w.step(emptyCommand());
    if (!n) continue;
    came = n;
    const lads = w.enemies.filter((e) => !e.isKO);
    assert(lads.length === n && lads.every((e) => e.stats.hasModifier('grudge_dealt')), 'they’re out for you');
    let eased = false;
    w.events.on('gang:beaten', () => (eased = true));
    for (const f of lads) {
      f.knockOut();
      w.sim.bus.emit('fighter:ko', { fighter: f, by: w.player });
    }
    for (let f = 0; f < 200; f++) w.step(emptyCommand());
    assert(eased && p.heatIn(street.district).gang === 100 + HEAT.beatHunters.gang, `seen off: ${p.heatIn(street.district).gang}`);
  }
  assert(came >= 2, 'they came');
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
