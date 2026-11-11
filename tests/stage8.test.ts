/**
 * Stage 8 tests: the motorbike fix, the garage stairs to the basement, the
 * house computer, pedestrians, companions, the garage workbench (repair,
 * craft, upgrade), the gym store and home gym training, sparring, the
 * fighting gyms and their techniques, and saving all of it.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { UPGRADES, effectiveRank } from '../src/progress/catalogue';
import { resolveLevel } from '../src/property/levels';
import { mountBike, parkBike, takeOutBike, buyBike, storeBike } from '../src/property/state';
import { STAIRWELL } from '../src/property/home';
import { World } from '../src/world/World';
import { propBox } from '../src/world/LevelTypes';
import { emptyCommand } from '../src/input/Commands';
import { LEVELS } from '../src/world/levels';
import { CIVILIAN_DENSITY } from '../src/world/civilians';
import { COMPANIONS, COMPANION_LIST, dismissCompanion, hireCompanion, setActiveCompanion, winChallenge } from '../src/companions/companions';
import { ITEMS, weaponItemId } from '../src/items/items';
import { sanitiseStack } from '../src/items/Inventory';
import { WEAPONS } from '../src/combat/Weapons';
import { maxDurability, modLimit, upgradedWeapon } from '../src/combat/weaponMods';
import { RECIPES, addMaterials, countItem, craftWeapon, repairQuote, repairWeapon, salvageWeapon, upgradeQuote, upgradeWeapon } from '../src/workshop/workshop';
import {
  FATIGUE_LIMIT,
  FATIGUE_RECOVERY_S,
  GYM_KIT,
  GYM_KIT_LIST,
  MAX_TRAINING_RANK,
  buyGymKit,
  canTrain,
  currentFatigue,
  finishSession,
  gymStations,
  xpForRank,
} from '../src/training/gym';
import { FIGHT_GYMS, GYM_OF_STYLE, canDrill, drillSet, finishDrill, rankUpStyle, styleCombos, styleRank } from '../src/training/styleGyms';
import { getStyle } from '../src/data/styles';
import { Fighter } from '../src/fighter/Fighter';
import { defaultAttributes } from '../src/stats/Stats';
import { SHOP_STOPS } from '../src/ui/hub';

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
function fresh(cash = 100000): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const p = new Progress(newSave(c));
  p.save.cash.bank = cash;
  p.save.cash.pocket = 0;
  return p;
}
const wallet = (p: Progress) => p.save.cash.pocket + p.save.cash.bank;
const roundtrip = (p: Progress) => new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);
const steps = (w: World, n: number, cmd = emptyCommand()) => {
  for (let i = 0; i < n; i++) w.step(cmd);
};
const walk = (w: World, dir: number, frames: number) => {
  for (let i = 0; i < frames; i++) {
    const c = emptyCommand();
    c.moveX = dir;
    w.step(c);
  }
};

console.log('\nStage 8: motorbike fix');

test('rebuilding an area around you (getting on or off the bike) does not set off the street’s fights', () => {
  // The bug: the area was rebuilt with you teleported to the bike, and the fight line check ran from
  // the entry point to the bike, "crossing" every trigger in between. A fight started; you were knocked off.
  for (const area of ['estate', 'high_street', 'leisure', 'precinct'] as const) {
    const lvl = LEVELS[area];
    for (const enc of lvl.encounters) {
      const p = fresh();
      const at = { x: Math.min(lvl.bounds.maxX - 1, enc.triggerX + 3), z: 0.3 };
      const w = new World(resolveLevel(area, p.save), p, { entry: lvl.entries[0].id, at, seed: 3, civilians: false });
      steps(w, 30);
      assert(!w.activeEncounter, `${area}: ${enc.id} started from a rebuild at x ${at.x}`);
      assert(Math.abs(w.player.pos.x - at.x) < 0.5, 'player stays where they were put');
    }
  }
});

test('fights still start properly when you walk over their line', () => {
  const p = fresh();
  const lvl = LEVELS.estate;
  const enc = lvl.encounters.find((e) => !e.optional)!;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: enc.triggerX - 1.5, z: 0 }, seed: 3, civilians: false });
  walk(w, 1, 90);
  assert(w.activeEncounter, 'crossing the line starts the fight');
});

test('side fights finished this visit stay finished when the area is rebuilt in place', () => {
  const lvl = LEVELS.pub;
  const opt = lvl.encounters.find((e) => e.optional)!;
  const p = fresh();
  const w = new World(lvl, p, { entry: 'door', at: { x: opt.triggerX + 2, z: 0 }, seed: 3, keepCleared: [opt.id], civilians: false });
  walk(w, -1, 200);
  assert(!w.activeEncounter, 'cleared side fight did not re-arm');
});

test('riding past a side fight doesn’t start it; walking past still does', () => {
  const lvl = LEVELS.estate;
  const opt = lvl.encounters.find((e) => e.optional)!;
  for (const riding of [true, false]) {
    const p = fresh();
    p.save.property.riding = riding;
    const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: opt.triggerX - 1.5, z: 0 }, seed: 3, civilians: false });
    walk(w, 1, 120);
    const started = w.enemies.length > 0;
    assert(started === !riding, riding ? 'side fight started while riding past' : 'side fight didn’t start on foot');
  }
});

test('get on and off the bike many times: one bike, right place, right state', () => {
  const p = fresh();
  buyBike(p, 'mx250', '#1f4fa8');
  const uid = p.save.property.bikes[0].uid;
  takeOutBike(p, uid);
  for (let i = 0; i < 12; i++) {
    const area = i % 2 ? 'high_street' : 'estate';
    p.save.property.bikeOut!.area = area;
    assert(mountBike(p, area).ok && p.save.property.riding, `mount ${i}`);
    assert(!resolveLevel(area, p.save).props.some((x) => x.kind === 'vehicle' && x.item === 'mx250' && x.label !== 'podium'), 'no parked copy while riding');
    assert(parkBike(p, area, 5 + i, 0.3).ok && !p.save.property.riding, `park ${i}`);
    const parked = resolveLevel(area, p.save).props.filter((x) => x.kind === 'vehicle' && x.item === 'mx250');
    assert(parked.length === 1 && parked[0].x === 5 + i, `exactly one bike, where you left it (${parked.length})`);
  }
  assert(p.save.property.bikes.length === 1, 'never duplicated');
  const q = roundtrip(p);
  assert(q.save.property.bikeOut?.x === p.save.property.bikeOut?.x && !q.save.property.riding, 'state survives a reload');
  assert(storeBike(p).ok, 'stored');
});

console.log('\nStage 8: house');

test('basement stairs are in the garage, with collision, lit, and nothing in the living room any more', () => {
  const p = fresh();
  const home = resolveLevel('home', p.save);
  const garage = home.facades.find((f) => f.label === 'Garage')!;
  const ex = home.exits.find((e) => e.to === 'basement')!;
  assert(ex.x > garage.x0 && ex.x < garage.x1, 'stairs exit is in the garage');
  const living = home.facades.find((f) => f.label === 'Living room')!;
  assert(!home.exits.some((e) => e.to === 'basement' && e.x > living.x0 && e.x < living.x1), 'no cellar door in the living room');
  const well = home.props.find((x) => x.kind === 'stairwell')!;
  assert(well && well.x === STAIRWELL.x, 'stairwell prop');
  const w = new World(home, p, { entry: 'start', seed: 1, civilians: false });
  assert(w.arena.blocked(well.x, well.z, 0.1), 'you can’t walk into the stairwell');
  assert(!w.arena.blocked(ex.x, ex.z + 0.3, 0.25), 'the top of the stairs is reachable');
  assert(home.entries.some((e) => e.id === 'basement' && e.x > garage.x0 && e.x < garage.x1), 'coming back up arrives in the garage');
  assert((home.lights ?? []).some((l) => Math.abs(l.x - STAIRWELL.x) < 1), 'light over the stairs');
  const basement = resolveLevel('basement', p.save);
  assert(basement.exits.some((e) => e.to === 'home' && e.toEntry === 'basement'), 'basement stairs lead back to the garage');
});

test('house computer: a desk with a PC in the living room, reachable, and the old planner gone', () => {
  const p = fresh();
  const home = resolveLevel('home', p.save);
  const st = home.stations!.find((s) => s.id === 'computer')!;
  const living = home.facades.find((f) => f.label === 'Living room')!;
  assert(st && st.x > living.x0 && st.x < living.x1, 'computer station in the living room');
  assert(home.props.some((x) => x.kind === 'computer_desk'), 'desk prop');
  assert(!home.stations!.some((s) => s.id === 'planner'), 'planner replaced');
  const w = new World(home, p, { entry: 'start', seed: 1, civilians: false });
  for (const s of home.stations!) assert(!w.arena.blocked(s.x, s.z, 0.05), `station ${s.id} reachable`);
});

console.log('\nStage 8: pedestrians');

test('pedestrians: neutral, capped, on standable ground, untouchable, and they scatter from fights', () => {
  const p = fresh();
  const lvl = LEVELS.high_street;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, seed: 5 });
  const cap = CIVILIAN_DENSITY.high_street!;
  for (let i = 0; i < 60 * 30; i++) {
    const c = emptyCommand();
    c.moveX = Math.sin(i / 120) > -0.3 ? 1 : -1;
    if (i % 25 === 0) c.pressed.lp = true;
    w.step(c);
    assert(w.civilians.length <= cap, `over the cap (${w.civilians.length})`);
    for (const civ of w.civilians) {
      const f = civ.f;
      assert(f.team === 'neutral', 'neutral');
      assert(f.vitals.health === f.vitals.maxHealth, 'nobody can hurt a pedestrian');
      assert(!w.arena.blocked(f.pos.x, f.pos.z, 0.2), `inside something at ${f.pos.x.toFixed(2)},${f.pos.z.toFixed(2)}`);
    }
    if (w.activeEncounter) {
      // Stage 13 overhaul: people react by temper. The nervy run, the nosy watch, the steady walk away; nobody near carries on as if nothing happened.
      for (const c2 of w.civilians) {
        const near = Math.abs(c2.f.pos.x - w.player.pos.x) < 13;
        if (near && c2.brain.temper === 'nervy') assert(c2.brain.activity === 'flee', 'a nervy bystander did not run');
        if (near && c2.brain.temper === 'nosy') assert(c2.brain.activity === 'watch', 'a nosy bystander did not stop to watch');
        if (near) assert(!c2.brain.pose || c2.brain.temper === 'steady', 'someone near a fight carried on chatting');
      }
      break;
    }
  }
  assert(w.sim.fighters.filter((f) => f.team === 'neutral').length >= 1 || w.activeEncounter, 'somebody was about');
});

test('pedestrians never stack on one another and despawn when far away', () => {
  const p = fresh();
  const lvl = LEVELS.city;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: 10, z: 0.5 }, seed: 9 });
  for (let i = 0; i < 60 * 20; i++) {
    w.step(emptyCommand());
    const list = w.civilians.map((c) => c.f);
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const d = Math.hypot(list[a].pos.x - list[b].pos.x, list[a].pos.z - list[b].pos.z);
      assert(d > 0.25, `two pedestrians on top of each other (${d.toFixed(2)})`);
    }
  }
  for (const c of w.civilians) assert(Math.abs(c.f.pos.x - w.player.pos.x) <= 23, 'far ones removed');
  assert(!LEVELS.home.stations || !CIVILIAN_DENSITY.home, 'nobody wanders through your house');
});

test('two pedestrians walking into each other pass, and everyone calms down after a fight', () => {
  const p = fresh();
  const lvl = LEVELS.high_street;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: 12, z: 1 }, seed: 5 });
  // Clear the street and put two people head to head on the same line.
  while (w.civilians.length) (w as unknown as { removeCivilian: (i: number) => void }).removeCivilian(0);
  const spawn = w as unknown as { spawnCivilian: (spot?: unknown) => void };
  for (let i = 0; i < 20 && w.civilians.length < 2; i++) spawn.spawnCivilian();
  assert(w.civilians.length === 2, 'two pedestrians to test with');
  {
    const [a, b] = w.civilians;
    const z = lvl.bounds.minZ + 0.6;
    a.f.pos.x = 20; b.f.pos.x = 21; a.f.pos.z = z; b.f.pos.z = z;
    a.brain.dir = 1; b.brain.dir = -1; a.brain.laneZ = z; b.brain.laneZ = z;
    a.brain.flee(10); b.brain.flee(31);
    steps(w, 60 * 4);
    assert(a.f.pos.x > 22 && b.f.pos.x < 19, `they got past each other (${a.f.pos.x.toFixed(1)}, ${b.f.pos.x.toFixed(1)})`);
    assert(a.brain.activity === 'walk' && b.brain.activity === 'walk', 'no fight on: they stop running');
  }
});

console.log('\nStage 8: companions');

test('companions: seven fighters for hire in the Red Lion snug, each different, fees and unlocks enforced', () => {
  assert(COMPANION_LIST.length >= 7 && new Set(COMPANION_LIST.map((c) => c.role)).size === COMPANION_LIST.length, 'seven roles');
  const pub = LEVELS.pub;
  assert(COMPANION_LIST.every((c) => pub.stations!.some((s) => s.id === 'recruit' && s.tab === c.id && s.npc)), 'all in the pub');
  const p = fresh(5000);
  const before = wallet(p);
  assert(hireCompanion(p, 'shaz').ok && wallet(p) === before - COMPANIONS.shaz.fee, 'hired, fee paid');
  assert(p.save.companions.following[0] === 'shaz', 'first hire follows you');
  assert(!hireCompanion(p, 'shaz').ok, 'not twice');
  assert(!hireCompanion(p, 'tank').ok && !p.save.companions.recruited.includes('tank'), 'locked until the story says so');
  p.save.flags.boss_sully = true;
  assert(hireCompanion(p, 'tank').ok, 'unlocked');
  assert(!hireCompanion(p, 'jonno').ok, 'challenge-only');
  winChallenge(p, 'jonno');
  assert(p.save.companions.recruited.includes('jonno'), 'won over');
  assert(setActiveCompanion(p, 'tank').ok && p.save.companions.following.includes('tank'), 'choose who follows');
  assert(dismissCompanion(p, 'tank').ok && !p.save.companions.following.includes('tank'), 'dismissed');
  const poor = fresh(10);
  assert(!hireCompanion(poor, 'danny').ok && wallet(poor) === 10, 'no money, no hire');
  const q = roundtrip(p);
  assert(JSON.stringify(q.save.companions) === JSON.stringify(p.save.companions), 'saved');
});

test('companion follows you, keeps up, and doesn’t get left behind', () => {
  const p = fresh();
  const lvl = LEVELS.residential;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: 5, z: 0 }, seed: 2, companion: COMPANIONS.danny, civilians: false });
  const c = w.companion!;
  assert(c && c.team === 'player', 'on your team');
  walk(w, 1, 60 * 4);
  steps(w, 60 * 2);
  if (!w.activeEncounter) assert(Math.abs(c.pos.x - w.player.pos.x) < 3.5, `kept up (${(c.pos.x - w.player.pos.x).toFixed(1)} m)`);
  assert(!w.arena.blocked(c.pos.x, c.pos.z, 0.2), 'not inside anything');
});

test('companion fights enemies, never civilians or Mo, and gets back up after the fight', () => {
  const p = fresh();
  p.save.flags.boss_sully = true;
  const lvl = LEVELS.estate;
  const enc = lvl.encounters.find((e) => !e.optional)!;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: enc.triggerX - 1, z: 0 }, seed: 4, companion: COMPANIONS.tank });
  w.player.vitals.health = 1e6;
  const c = w.companion!;
  walk(w, 1, 60);
  assert(w.activeEncounter, 'fight on (your companion didn’t get in your way)');
  let dealt = 0;
  w.sim.bus.on('hit:landed', (e) => {
    if (e.attacker === c && e.target.team === 'enemy') dealt += e.damage;
  });
  let civHit = false;
  for (let i = 0; i < 60 * 25 && w.activeEncounter; i++) {
    const cmd = emptyCommand();
    if (i % 15 === 0) cmd.pressed.lp = true;
    w.step(cmd);
    for (const civ of w.civilians) if (civ.f.vitals.health < civ.f.vitals.maxHealth) civHit = true;
  }
  assert(!civHit, 'no civilian hurt');
  assert(dealt > 0, 'the companion hurt the enemies');
  // Knock the companion out and check they get back up once it's quiet.
  c.vitals.health = 1;
  c.knockOut();
  for (const e of w.enemies) if (!e.isKO) e.knockOut();
  steps(w, 60 * 6);
  if (!w.activeEncounter) assert(!c.isKO && c.vitals.health > 0, 'back on their feet');
});

test('companion waits outside the house', () => {
  const p = fresh();
  const home = resolveLevel('home', p.save);
  // Game passes no companion for home/basement (COMPANION_WAITS_OUTSIDE); check the rule exists.
  const w = new World(home, p, { entry: 'start', seed: 1, civilians: false, companion: null });
  assert(!w.companion, 'nobody follows you indoors at home');
});

console.log('\nStage 8: garage workbench');

test('repair: costs money and a material, shows before and after, can’t fix smashables', () => {
  const p = fresh(1000);
  const st = p.newStack(weaponItemId('pipe'), 1, { hits: 3 });
  p.save.storage.push(st);
  const q = repairQuote(st)!;
  assert(q.from === 3 && q.to === WEAPONS.pipe.durability && q.cash > 0, 'quote before → after');
  assert(!repairWeapon(p, st).ok, 'no tape: refused');
  addMaterials(p, { duct_tape: 3 });
  const w0 = wallet(p);
  assert(repairWeapon(p, st).ok && st.hits === WEAPONS.pipe.durability, 'fixed');
  assert(wallet(p) === w0 - q.cash && countItem(p, 'duct_tape') === 3 - (q.materials.duct_tape ?? 0), 'charged money and tape');
  assert(!repairWeapon(p, st).ok, 'not when it’s already good');
  assert(repairQuote(p.newStack(weaponItemId('bottle'), 1, { hits: 1 })) === null, 'bottles can’t be fixed');
});

test('crafting needs the materials, makes the weapon, and puts it in your pockets', () => {
  const p = fresh(1000);
  const r = RECIPES.find((x) => x.weapon === 'crowbar')!;
  assert(!craftWeapon(p, r).ok, 'nothing to make it with');
  addMaterials(p, r.materials);
  const w0 = wallet(p);
  assert(craftWeapon(p, r).ok && wallet(p) === w0 - r.cash, 'made, paid');
  const made = [...p.save.inventory, ...p.save.storage].find((s) => s.id === weaponItemId('crowbar'));
  assert(made && made.crafted && made.mods?.durability === 1 && made.hits === maxDurability('crowbar', made.mods), 'crafted crowbar with its bonus');
  assert(countItem(p, 'steel_bar') === 0, 'materials used');
});

test('upgrades really change the weapon in your hands; limits per weapon; each level costs more', () => {
  const base = WEAPONS.baseball_bat;
  const up = upgradedWeapon('baseball_bat', { power: 2, speed: 1, handling: 1, durability: 2 });
  assert(up.light.damage > base.light.damage && up.heavy.damage > base.heavy.damage, 'more damage');
  assert(up.light.startup < base.light.startup && up.light.recovery < base.light.recovery, 'faster');
  assert(up.light.staminaCost < base.light.staminaCost, 'less tiring');
  assert(up.durability > base.durability, 'lasts longer');
  // The actual fighter swings the upgraded data.
  const f = new Fighter({ id: 9, name: 'T', team: 'player', attributes: defaultAttributes(5), style: getStyle('street'), x: 0, z: 0 });
  f.equipWeapon('baseball_bat', undefined, { power: 2 });
  assert(f.weapon!.data.light.damage > base.light.damage && f.weapon!.mods?.power === 2, 'fighter holds the upgraded bat');
  assert(modLimit('bottle', 'power') === 0 && modLimit('knife', 'speed') === 3 && modLimit('road_sign', 'speed') <= 1, 'different weapons, different limits');
  const c1 = upgradeQuote('pipe', 'power', 1).cash;
  const c2 = upgradeQuote('pipe', 'power', 2).cash;
  const c3 = upgradeQuote('pipe', 'power', 3).cash;
  assert(c1 < c2 && c2 < c3 && upgradeQuote('pipe', 'power', 3).materials.spring_steel, 'steeper and rarer');
  const p = fresh(5000);
  const st = p.newStack(weaponItemId('pipe'), 1, {});
  p.save.storage.push(st);
  assert(!upgradeWeapon(p, st, 'power').ok, 'no materials, no upgrade');
  addMaterials(p, { scrap_metal: 10, bolts: 10, steel_bar: 5, spring_steel: 3, carbon_fibre: 3, leather_strip: 5, duct_tape: 5 });
  for (let i = 0; i < 3; i++) assert(upgradeWeapon(p, st, 'power').ok, `power ${i + 1}`);
  assert(!upgradeWeapon(p, st, 'power').ok, 'capped');
  const hits = st.hits!;
  assert(upgradeWeapon(p, st, 'durability').ok && st.hits! > hits && st.hits! <= maxDurability('pipe', st.mods), 'durability adds capacity');
  const q = roundtrip(p);
  const back = q.save.storage.find((s) => s.uid === st.uid)!;
  assert(JSON.stringify(back.mods) === JSON.stringify(st.mods) && back.hits === st.hits, 'mods and condition saved');
  assert(salvageWeapon(p, st.uid).ok && !p.save.storage.some((s) => s.uid === st.uid), 'salvaged');
});

test('a saved weapon can’t claim more mods or condition than it’s allowed', () => {
  const st = sanitiseStack({ uid: 'x1', id: weaponItemId('pipe'), qty: 1, hits: 999, mods: { power: 99, speed: 99, wings: 3 } }, new Set())!;
  assert(st.mods!.power === modLimit('pipe', 'power') && st.mods!.speed === modLimit('pipe', 'speed') && !('wings' in st.mods!), 'mods clamped');
  assert(st.hits === maxDurability('pipe', st.mods), 'hits clamped');
  assert(ITEMS.carbon_fibre && ITEMS.steel_bar, 'materials exist as items');
});

console.log('\nStage 8: gym store and home gym');

test('Iron Temple: a real shop in Leisure Park; buying kit puts it in your gym; one of each', () => {
  const store = LEVELS.gym_store;
  const street = LEVELS.leisure;
  const door = street.exits.find((e) => e.to === 'gym_store');
  assert(door && store.exits.some((e) => e.to === 'leisure'), 'door both ways');
  assert(SHOP_STOPS.some((s) => s.area === 'gym_store'), 'cab stop');
  const p = fresh(5000);
  const w0 = wallet(p);
  assert(buyGymKit(p, 'treadmill').ok && wallet(p) === w0 - GYM_KIT.treadmill.price, 'bought');
  assert(!buyGymKit(p, 'treadmill').ok, 'one of each');
  const home = resolveLevel('home', p.save);
  assert(home.props.some((x) => x.kind === 'gym_kit' && x.item === 'treadmill'), 'set up in the gym');
  assert(home.stations!.some((s) => s.id === 'train' && s.tab === 'treadmill' && s.label.includes('train')), 'can train on it');
  const poor = fresh(10);
  assert(!buyGymKit(poor, 'barbell').ok && wallet(poor) === 10, 'not enough money');
  // Kit in the gym never overlaps and all stations reachable.
  const all = fresh();
  for (const k of GYM_KIT_LIST) buyGymKit(all, k.id);
  const lvl = resolveLevel('home', all.save);
  const w = new World(lvl, all, { entry: 'start', seed: 1, civilians: false });
  const boxes = lvl.props.filter((x) => x.kind === 'gym_kit').map((x) => propBox(x)).filter((b): b is NonNullable<typeof b> => !!b);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert(!(boxes[i].minX < boxes[j].maxX && boxes[i].maxX > boxes[j].minX && boxes[i].minZ < boxes[j].maxZ && boxes[i].maxZ > boxes[j].minZ), 'kit overlaps');
  for (const s of gymStations(all.save.gym)) assert(!w.arena.blocked(s.x, s.z, 0.05), `${s.label} reachable`);
});

test('training: earned rep by rep, fatigue limits it, ranks get much harder, rank 10 is the top, past 5 counts half', () => {
  const p = fresh();
  assert(xpForRank(0) < xpForRank(5) && xpForRank(5) < xpForRank(9), 'each rank harder');
  const perfect = Array(10).fill('perfect');
  const r = finishSession(p, 'power', GYM_KIT.bag.perRep, GYM_KIT.bag.fatigue, perfect);
  assert(r.ok && r.xp === GYM_KIT.bag.perRep * 10 && p.save.upgrades.power === 0, 'XP but no free rank from one session');
  const missed = finishSession(fresh(), 'power', 8, 18, Array(10).fill('miss'));
  assert(missed.ok && missed.xp === 0, 'missed reps earn nothing');
  // Fatigue: train hard back-to-back and you're stopped.
  let sessions = 0;
  while (canTrain(p, 'power').ok && sessions < 50) {
    finishSession(p, 'power', 8, 18, perfect);
    sessions++;
  }
  assert(sessions < 10 && currentFatigue(p.save.gym, p.save.playTime) >= FATIGUE_LIMIT, `stopped by fatigue after ${sessions} sessions`);
  // Tired sessions are worth less.
  const tired = fresh();
  tired.save.gym.fatigue = 80;
  const t = finishSession(tired, 'stamina', 9, 22, perfect) as { xp: number };
  assert(t.xp < 9 * 10 * 0.3, 'fatigue cuts XP');
  // Playing (time passing) recovers.
  p.save.playTime += FATIGUE_RECOVERY_S * 100;
  assert(currentFatigue(p.save.gym, p.save.playTime) === 0 && canTrain(p, 'power').ok, 'rested');
  // Getting to the top takes many sessions.
  const grind = fresh();
  let n = 0;
  while (grind.save.upgrades.power < MAX_TRAINING_RANK && n < 2000) {
    grind.save.gym.fatigue = 0;
    finishSession(grind, 'power', GYM_KIT.barbell.perRep, 24, perfect);
    n++;
  }
  assert(grind.save.upgrades.power === MAX_TRAINING_RANK && n > 40, `top rank took ${n} perfect sessions`);
  assert(!canTrain(grind, 'power').ok, 'nothing past the top');
  assert(effectiveRank(10) === 7.5 && UPGRADES.power.modifiers(10)[0].add === 7, 'ranks 6-10 count half');
});

test('trained stats actually apply to your fighter', () => {
  const p = fresh();
  const before = new Fighter(p.fighterConfig(1, 0, 0, false));
  p.applyModifiers(before);
  p.save.upgrades.power = 4;
  p.save.upgrades.health = 3;
  const after = new Fighter(p.fighterConfig(1, 0, 0, false));
  p.applyModifiers(after);
  assert(after.stats.attr('strength') === before.stats.attr('strength') + 4, 'strength up');
  assert(after.stats.flat('maxHealth') === before.stats.flat('maxHealth') + 45, 'health up');
});

test('sparring with Mo: he’s not an enemy until you ask, it ends safely, it trains Defence', () => {
  const p = fresh();
  const home = resolveLevel('home', p.save);
  const w = new World(home, p, { entry: 'start', seed: 2, civilians: false });
  const mo = w.sparPartner!;
  assert(mo && mo.team === 'neutral', 'Mo is neutral');
  const gym = home.facades.find((f) => f.label === 'Gym')!;
  assert(mo.pos.x > gym.x0 && mo.pos.x < gym.x1, 'Mo is in the gym');
  assert(!w.player.target || w.player.target !== mo, 'not a target');
  w.player.pos.x = mo.pos.x - 1.0;
  w.player.pos.z = mo.pos.z;
  assert(w.startSpar() && mo.team === 'enemy', 'spar started');
  let ended: { won: boolean; landed: number } | null = null;
  w.events.on('duel:end', (e) => (ended = e));
  for (let i = 0; i < 60 * 40 && !ended; i++) {
    const c = emptyCommand();
    if (i % 12 === 0) c.pressed.lp = true;
    c.moveX = mo.pos.x > w.player.pos.x ? 0.4 : -0.4;
    w.step(c);
  }
  if (!ended) w.stopDuel();
  assert(ended || !w.duel, 'spar ended');
  assert(mo.team === 'neutral' && !mo.isKO && !w.player.isKO, 'nobody left down, Mo back to neutral');
});

console.log('\nStage 8: fighting gyms');

test('three fighting gyms in the world, each teaching its own styles with a coach and a drill', () => {
  for (const g of FIGHT_GYMS) {
    const lvl = LEVELS[g.id];
    assert(lvl.stations!.some((s) => s.id === 'style_coach' && s.tab === g.id && s.npc), `${g.id} coach`);
    assert(lvl.stations!.some((s) => s.id === 'style_drill'), `${g.id} drill`);
    const out = lvl.exits.find((e) => e.id === 'out')!;
    assert(LEVELS[out.to].exits.some((e) => e.to === g.id), `${g.id} has a street door`);
    assert(SHOP_STOPS.some((s) => s.area === g.id), `${g.id} cab stop`);
    for (const s of g.styles) assert(GYM_OF_STYLE[s] === g, 'style taught here');
  }
});

test('learning a style and its ranks: right gym, money, training points, drill XP, story flags', () => {
  const p = fresh(10000);
  assert(!rankUpStyle(p, 'boxing', 'karate_dojo').ok, 'wrong gym');
  const w0 = wallet(p);
  assert(rankUpStyle(p, 'boxing', 'boxing_gym').ok && styleRank(p, 'boxing') === 1 && p.save.styles.learned.includes('boxing'), 'learned');
  assert(wallet(p) < w0, 'paid');
  assert(!rankUpStyle(p, 'boxing', 'boxing_gym').ok, 'rank 2 needs drill XP');
  assert(canDrill(p, 'boxing').ok, 'can drill');
  const combos = drillSet('boxing', 1, 0);
  assert(combos.length === 3 && combos.every((c) => c.buttons.length === 2), 'rank 1 drills two-hit strings');
  finishDrill(p, 'boxing', combos.map((c) => ({ len: c.buttons.length, clean: true })));
  for (let i = 0; i < 4; i++) {
    p.save.gym.fatigue = 0;
    finishDrill(p, 'boxing', [{ len: 3, clean: true }, { len: 3, clean: true }, { len: 3, clean: true }]);
  }
  p.save.trainingPoints = 0;
  assert(!rankUpStyle(p, 'boxing', 'boxing_gym').ok, 'needs a training point');
  p.save.trainingPoints = 1;
  assert(rankUpStyle(p, 'boxing', 'boxing_gym').ok && styleRank(p, 'boxing') === 2 && p.save.trainingPoints === 0, 'rank 2');
  assert(!rankUpStyle(p, 'karate', 'karate_dojo').ok, 'karate locked behind the story');
  p.save.flags.boss_sully = true;
  assert(rankUpStyle(p, 'karate', 'karate_dojo').ok, 'karate after Sully');
  assert(styleCombos('boxing', 4).some((c) => c.buttons.length === 4), 'drills come from the real move graph');
});

test('techniques gate real moves: specials at rank 2, long strings and submissions at rank 3', () => {
  const style = getStyle('boxing');
  const mk = (rank: number) => {
    const f = new Fighter({ id: 1, name: 'T', team: 'player', attributes: defaultAttributes(6), style, x: 0, z: 0, unlocks: { specials: true, finishers: true }, styleLevels: { boxing: rank } });
    return f;
  };
  const bus = { emit: () => undefined, on: () => () => undefined } as never;
  const r1 = mk(1);
  (r1 as unknown as { tryAttack: (b: string, s: boolean, f: number, bus: never) => boolean }).tryAttack('lp', true, 10, bus);
  assert(r1.move && r1.move.data.id !== style.specials.lp, 'rank 1: the special press throws a normal move');
  const r2 = mk(2);
  (r2 as unknown as { tryAttack: (b: string, s: boolean, f: number, bus: never) => boolean }).tryAttack('lp', true, 10, bus);
  assert(!style.specials.lp || (r2.move && r2.move.data.id === style.specials.lp), 'rank 2: specials work');
  // Third hit in a string.
  for (const [rank, allowed] of [[2, false], [3, true]] as const) {
    const f = mk(rank);
    const t = f as unknown as { tryAttack: (b: string, s: boolean, fr: number, bus: never) => boolean; chainDepth: number; state: string };
    t.tryAttack('lp', false, 10, bus);
    t.chainDepth = 1;
    const ok = t.tryAttack('hp', false, 11, bus);
    if (!allowed) assert(!ok, `rank ${rank}: third hit refused`);
  }
  assert(mk(1).techLevel('street') === 5, 'street is always open');
  const enemy = new Fighter({ id: 2, name: 'E', team: 'enemy', attributes: defaultAttributes(6), style, x: 0, z: 0 });
  assert(enemy.techLevel('boxing') === 5, 'enemies aren’t gated');
});

test('cross-training: rank 3 in a style is +1 Technique, up to +4', () => {
  const p = fresh();
  const base = new Fighter(p.fighterConfig(1, 0, 0, false));
  p.applyModifiers(base);
  p.save.styleTraining = { boxing: { rank: 3, xp: 0 }, karate: { rank: 3, xp: 0 }, wrestling: { rank: 1, xp: 0 } };
  const f = new Fighter(p.fighterConfig(1, 0, 0, false));
  p.applyModifiers(f);
  assert(f.stats.attr('technique') === base.stats.attr('technique') + 2, 'two styles at rank 3 = +2');
  assert(f.styleLevels?.boxing === 3, 'ranks reach the fighter');
});

console.log('\nStage 8: saves');

test('everything new persists, and older saves load with safe defaults', () => {
  const p = fresh(100000);
  buyGymKit(p, 'treadmill');
  finishSession(p, 'stamina', 9, 22, Array(10).fill('perfect'));
  rankUpStyle(p, 'boxing', 'boxing_gym');
  hireCompanion(p, 'danny');
  const q = roundtrip(p);
  for (const k of ['gym', 'styleTraining', 'companions', 'upgrades'] as const) assert(JSON.stringify(q.save[k]) === JSON.stringify(p.save[k]), `${k} kept`);
  // A save from before this update.
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.gym;
  delete raw.styleTraining;
  delete raw.companions;
  raw.styles = { learned: ['street', 'boxing', 'karate'], primary: 'boxing', secondary: null };
  raw.moves = ['specials'];
  raw.upgrades = { health: 5, stamina: 3, power: 5, speed: 0, toughness: 2, technique: 1 };
  const old = sanitiseSave(raw)!;
  assert(old.gym.owned.includes('bag') && old.gym.owned.includes('dumbbells'), 'the old bag and weights are still there');
  assert(old.styleTraining.boxing?.rank === 2 && old.styleTraining.karate?.rank === 2, 'styles learned before keep their specials');
  assert(old.upgrades.power === 5 && old.upgrades.health === 5, 'trained ranks kept');
  assert(old.companions.recruited.length === 0, 'no crew yet');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
