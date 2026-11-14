/**
 * Beating Big Dunc: the fight ends, the rewards can't be lost or doubled, and
 * the way on (Hale House) always says exactly what is still to do.
 */
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { emptyCommand } from '../src/input/Commands';
import { Progress, newSave, sanitiseSave } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { gateNeeds, lockedMessage } from '../src/world/gates';
import { World, exitLocked } from '../src/world/World';

let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const fresh = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
const ON_THE_WAY = ['boss_gaffer', 'boss_sully', 'boss_market', 'has_stadium_key', 'boss_ratcatcher', 'boss_docks', 'boss_precinct', 'has_vip_pass', 'boss_nightclub', 'boss_factory', 'boss_underground'];
const L = LEVELS.territory;
const hq = () => L.exits.find((e) => e.kind === 'edge' && e.to === 'hq')!;

/** Walk into the Pit, wear Dunc down through his phases, and put everyone on the floor. */
function beatDunc(p: Progress): { w: World; left: string[]; items: string[]; defeats: number } {
  // The crew at the top of the street is already dealt with: this is about the Pit.
  p.save.flags['cleared:territory:gauntlet'] = true;
  const w = new World(L, p, { entry: 'left', seed: 1, at: { x: 60, z: 0 } });
  const out = { w, left: [] as string[], items: [] as string[], defeats: 0 };
  w.events.on('boss:defeated', (e) => {
    out.defeats++;
    out.left = e.left;
    out.items = e.items;
  });
  for (let i = 0; i < 300 && !w.activeEncounter; i++) w.step({ ...emptyCommand(), moveX: 1 });
  const enc = w.activeEncounter;
  assert(enc?.boss, 'the Dunc fight did not start');
  for (const frac of [0.6, 0.4, 0.15]) {
    enc.boss.vitals.health = enc.boss.vitals.maxHealth * frac;
    for (let i = 0; i < 60; i++) w.step(emptyCommand());
  }
  assert(enc.enemies.length > 1, 'the crowd never came in');
  for (const f of enc.enemies) {
    f.vitals.health = 0;
    f.knockOut();
  }
  for (let i = 0; i < 300; i++) w.step(emptyCommand());
  return out;
}

const fill = (p: Progress) => {
  for (let i = 0; i < 99 && p.save.inventory.length < p.inventoryCap; i++) p.giveItem('w_bat');
  assert(p.spaceFor('dunc_phone') === 0, 'pockets are not full');
};
const has = (p: Progress, id: string) => p.save.inventory.some((s) => s.id === id);
const count = (p: Progress, w: World | null, id: string) => p.save.inventory.filter((s) => s.id === id).length + p.save.storage.filter((s) => s.id === id).length + (w ? w.items.filter((g) => g.stack.id === id).length : p.save.bossLoot.filter((k) => k.stack.id === id).length);

console.log('Big Dunc and the way on');

test('beating Dunc ends the fight, pays once and puts his phone and chain in your pockets', () => {
  const p = fresh();
  const cash = p.save.cash.pocket;
  const r = beatDunc(p);
  assert(r.defeats === 1, `boss:defeated fired ${r.defeats} times`);
  assert(!r.w.activeEncounter && !r.w.locked, 'the Pit is still locked after the fight');
  assert(p.has('boss_dunc') && p.has('has_dunc_phone'), 'the win was not recorded');
  assert(has(p, 'dunc_phone') && has(p, 'chain_cuban') && r.left.length === 0, 'the rewards are not in your pockets');
  assert(p.save.cash.pocket === cash + 600, `paid £${p.save.cash.pocket - cash}`);
  // Coming back: no second fight, no second reward.
  const again = new World(L, p, { entry: 'left', seed: 2, at: { x: 60, z: 0 } });
  for (let i = 0; i < 200; i++) again.step({ ...emptyCommand(), moveX: 1 });
  assert(!again.activeEncounter && count(p, again, 'dunc_phone') === 1 && count(p, again, 'chain_cuban') === 1 && p.save.cash.pocket === cash + 600, 'the fight or its rewards came round again');
});

test('with full pockets the rewards wait on the ground: through leaving, saving and reloading, and only once', () => {
  const p = fresh();
  fill(p);
  const r = beatDunc(p);
  assert(r.left.length === 2 && r.items.length === 0, `left ${r.left.length}, took ${r.items.length}`);
  assert(p.has('has_dunc_phone'), 'the phone on the floor does not count');
  assert(r.w.items.filter((g) => g.kept).length === 2 && p.save.bossLoot.length === 2, 'the rewards are not on the ground');
  // Leave (the world is thrown away), save, close the game, load, walk back in.
  const loaded = sanitiseSave(JSON.parse(JSON.stringify(p.save)));
  assert(loaded, 'the save did not load');
  const p2 = new Progress(loaded);
  assert(p2.save.bossLoot.length === 2, 'the save forgot the rewards');
  const w2 = new World(L, p2, { entry: 'left', seed: 3 });
  const phone = w2.items.find((g) => g.stack.id === 'dunc_phone');
  const chain = w2.items.find((g) => g.stack.id === 'chain_cuban');
  assert(phone && chain, 'the rewards were gone when you came back');
  // Still no room: they stay put.
  assert(!w2.pickUp(phone) && w2.items.includes(phone) && p2.save.bossLoot.length === 2, 'picked up with no room');
  // Make room and take them.
  p2.save.inventory.splice(0, 2);
  assert(w2.pickUp(phone) && w2.pickUp(chain), 'could not pick the rewards up');
  assert(has(p2, 'dunc_phone') && has(p2, 'chain_cuban') && p2.save.bossLoot.length === 0, 'the save still thinks they are on the ground');
  // Come back again: nothing there to take twice.
  const w3 = new World(L, new Progress(sanitiseSave(JSON.parse(JSON.stringify(p2.save)))!), { entry: 'left', seed: 4 });
  assert(!w3.items.some((g) => g.stack.id === 'dunc_phone' || g.stack.id === 'chain_cuban'), 'the rewards came back after being taken');
});

test('a tampered save can never hold the same reward in your pockets and on the ground', () => {
  const p = fresh();
  fill(p);
  beatDunc(p);
  const raw = JSON.parse(JSON.stringify(p.save));
  raw.inventory.pop();
  raw.inventory.push(raw.bossLoot[1].stack); // the chain, in both places
  const loaded = sanitiseSave(raw)!;
  const all = [...loaded.inventory, ...loaded.bossLoot.map((k) => k.stack)].filter((s) => s.id === 'chain_cuban');
  assert(all.length === 1, `${all.length} Cuban chains after loading`);
});

test('an old save with no bossLoot loads', () => {
  const raw = JSON.parse(JSON.stringify(fresh().save));
  delete raw.bossLoot;
  const loaded = sanitiseSave(raw);
  assert(loaded && Array.isArray(loaded.bossLoot) && loaded.bossLoot.length === 0, 'old save broke');
});

test('Hale House opens straight away if the Firm is already beaten', () => {
  const p = fresh();
  for (const f of [...ON_THE_WAY, 'boss_stadium']) p.save.flags[f] = true;
  assert(exitLocked(hq(), p), 'open before Dunc');
  const r = beatDunc(p);
  assert(!exitLocked(hq(), p) && gateNeeds(hq(), p, 'territory').length === 0, 'still locked with everything done');
  assert(/open/.test(r.w.objective), `objective: ${r.w.objective}`);
  let left = false;
  r.w.events.on('area:exit', (e) => (left = e.to === 'hq'));
  r.w.player.pos.x = L.bounds.maxX - 0.4;
  for (let i = 0; i < 120 && !left; i++) r.w.step({ ...emptyCommand(), moveX: 1 });
  assert(left, 'could not walk on to Hale House');
});

test('if the Firm is still standing, the gate, the objective and the message all say so (and nothing else)', () => {
  const p = fresh();
  for (const f of ON_THE_WAY) p.save.flags[f] = true;
  const r = beatDunc(p);
  const needs = gateNeeds(hq(), p, 'territory');
  assert(needs.length === 1 && needs[0].flag === 'boss_stadium' && needs[0].area === 'stadium', `needs: ${needs.map((n) => n.flag)}`);
  const msg = lockedMessage(hq(), p, 'territory');
  assert(/Kirkgate/.test(msg) && /west/.test(msg), msg);
  assert(!/Docks|Precinct|Neon|Dunc/.test(msg), `lists things already done: ${msg}`);
  assert(/Kirkgate/.test(r.w.objective) && !/End it with Big Dunc/.test(r.w.objective), `objective: ${r.w.objective}`);
  let told = '';
  r.w.events.on('area:locked', (e) => (told = e.text));
  r.w.player.pos.x = L.bounds.maxX - 0.4;
  for (let i = 0; i < 200 && !told; i++) r.w.step({ ...emptyCommand(), moveX: 1 });
  assert(told === msg, `walked into the gate and was told: ${told}`);
  // Beat the Firm and it opens.
  p.save.flags.boss_stadium = true;
  assert(!exitLocked(hq(), p), 'the Firm did not open Hale House');
});

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
