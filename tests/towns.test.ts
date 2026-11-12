/**
 * The generated towns east of Hale House: the same every time, each one
 * different from the others, each shut until the boss before it is beaten,
 * harder as you go, and what you do there is saved.
 */
import { readFileSync } from 'node:fs';
import { ARCHETYPES } from '../src/ai/archetypes';
import { BOSSES } from '../src/ai/bosses';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { planStreet, type StreetPlan } from '../src/city/street';
import { emptyCommand } from '../src/input/Commands';
import { lockReason, unlocked } from '../src/map/worldMap';
import { AREA_IDS, Progress, newSave, sanitiseSave, type AreaId } from '../src/progress/Progress';
import type { LevelDef } from '../src/world/LevelTypes';
import { DISTRICT_ORDER, LEVELS } from '../src/world/levels';
import { STRIP } from '../src/world/strip';
import { DISTRICTS_PER_TOWN, TOWN_AREA_IDS, TOWN_COUNT, townAreaId, townBossFlag, townBossId } from '../src/world/townIds';
import { GENERATED_TOWNS } from '../src/world/towns';
import { World, exitLocked } from '../src/world/World';

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

const fresh = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
const L = LEVELS as Record<AreaId, LevelDef>;
const kit = JSON.parse(readFileSync('public/models/polyfork/kit.json', 'utf8')) as { models: Record<string, { min: number[]; max: number[] }> };
const plans = new Map<AreaId, StreetPlan>(TOWN_AREA_IDS.map((id) => [id, planStreet(L[id])]));
/** The front row of buildings of a district, west to east. */
function frontRow(id: AreaId): string[] {
  const plan = plans.get(id)!;
  return plan.placements
    .filter((pl) => {
      const m = kit.models[pl.model];
      return m.max[1] * pl.sy > 3.5 && m.max[2] - m.min[2] > 3.5 && pl.z > plan.back - 14 && /bldg-|house|cottage|townhouse|unit|detached-garage|shelter/.test(pl.model);
    })
    .sort((a, b) => a.x - b.x)
    .map((pl) => pl.model);
}

console.log('The generated towns');

test('six towns of four districts carry the street on east of Hale House', () => {
  assert(GENERATED_TOWNS.length === TOWN_COUNT && TOWN_AREA_IDS.length === TOWN_COUNT * DISTRICTS_PER_TOWN, 'wrong number of towns');
  const hq = STRIP.indexOf('hq');
  TOWN_AREA_IDS.forEach((id, i) => {
    assert(STRIP[hq + 1 + i] === id, `${id} is not at place ${i + 1} east of Hale House`);
    assert(L[id] && AREA_IDS.includes(id), `${id} is not a real area`);
    assert(L[id].exits.some((e) => e.seam && e.side === 'left'), `${id} cannot be walked into`);
  });
  assert(new Set(GENERATED_TOWNS.map((t) => t.name)).size === TOWN_COUNT, 'two towns share a name');
});

test('a town is the same every time it is built', () => {
  const again = JSON.stringify(GENERATED_TOWNS.map((t) => t.districts));
  // Building the plans twice gives the same street, piece for piece.
  for (const id of TOWN_AREA_IDS) assert(JSON.stringify(planStreet(L[id])) === JSON.stringify(plans.get(id)), `${id} planned differently the second time`);
  assert(again === JSON.stringify(GENERATED_TOWNS.map((t) => t.districts)), 'the town data changed');
  // Pinned: if this fails, the generator changed and every existing save's towns have moved.
  const d = L.t1d1;
  assert(d.name.startsWith('Saltmere') && d.bounds.maxX >= 72 && d.bounds.maxX <= 112 && d.bounds.maxX % 4 === 0, `t1d1 is now ${d.name}, ${d.bounds.maxX} m`);
});

test('each town opens only when the boss before it is beaten', () => {
  const p = fresh();
  // Everything in the home town done except Hale.
  for (const d of DISTRICT_ORDER) if (!d.flag.startsWith('boss_town') && d.flag !== 'boss_final') p.save.flags[d.flag] = true;
  p.save.flags.has_dunc_phone = p.save.flags.has_vip_pass = p.save.flags.has_stadium_key = true;
  assert(unlocked(p, 'hq') && !unlocked(p, 't1d1'), 'the first town is open before Hale is beaten');
  assert(/Hale/.test(lockReason(p, 't1d1') ?? ''), `the map says: ${lockReason(p, 't1d1')}`);
  p.save.flags.boss_final = true;
  for (let t = 1; t <= TOWN_COUNT; t++) {
    for (let d = 1; d <= DISTRICTS_PER_TOWN; d++) assert(unlocked(p, townAreaId(t, d)), `town ${t} district ${d} is shut after its gate boss`);
    if (t < TOWN_COUNT) {
      const next = townAreaId(t + 1, 1);
      assert(!unlocked(p, next), `town ${t + 1} is open before town ${t}'s boss is beaten`);
      const seam = L[townAreaId(t, DISTRICTS_PER_TOWN)].exits.find((e) => e.seam && e.to === next)!;
      assert(exitLocked(seam, p) && seam.lockedText!.includes(GENERATED_TOWNS[t - 1].boss.name), `the seam into town ${t + 1} does not name who holds it`);
    }
    p.save.flags[townBossFlag(t)] = true;
  }
  // Walking back west is never locked.
  for (const id of TOWN_AREA_IDS) assert(!L[id].exits.find((e) => e.seam && e.side === 'left')!.requires, `${id}: the way home is locked`);
});

test('every town has a boss at its far end, and each is harder than the last', () => {
  const sum = (a: Record<string, number>): number => Object.values(a).reduce((n, v) => n + v, 0);
  let prev = BOSSES.the_boss;
  const styles = new Set<string>();
  GENERATED_TOWNS.forEach((t, i) => {
    const b = BOSSES[townBossId(i + 1)];
    assert(b === t.boss && b.flag === townBossFlag(i + 1), `town ${i + 1}'s boss is not registered`);
    const last = t.districts[DISTRICTS_PER_TOWN - 1];
    const fight = last.encounters.find((e) => e.boss === b.id);
    assert(fight && fight.lock && !fight.optional && fight.triggerX > last.bounds.maxX - 30, `${t.name}: no boss fight at the far end`);
    for (const d of t.districts.slice(0, -1)) assert(!d.encounters.some((e) => e.boss), `${d.id} has a boss part-way through the town`);
    assert(sum(b.attributes) > sum(prev.attributes) && b.level > prev.level && b.bonusHealth > prev.bonusHealth, `${b.name} is not stronger than ${prev.name}`);
    assert(b.brain.reactionFrames <= prev.brain.reactionFrames && b.brain.blockChance >= prev.brain.blockChance, `${b.name} is not sharper than ${prev.name}`);
    assert(b.reward.cash > prev.reward.cash && b.reward.xp > prev.reward.xp, `${b.name} pays no more than ${prev.name}`);
    assert(b.phases.length >= 3 && b.phases.every((ph, k) => k === 0 || ph.below < b.phases[k - 1].below), `${b.name}'s phases are out of order`);
    assert(b.secondaryStyle && b.secondaryStyle !== b.style, `${b.name} has one style`);
    styles.add(`${b.style}>${b.secondaryStyle}`);
    assert(b.intro.length > 20 && b.defeat.length > 10 && b.name !== prev.name, `${b.name} has nothing to say`);
    prev = b;
  });
  assert(styles.size === TOWN_COUNT, 'two town bosses fight the same way');
  // Harder is not just more health: no two bosses share the same set of phase tricks.
  const tricks = GENERATED_TOWNS.map((t) => t.boss.phases.map((ph) => (ph.summon ? 'S' : ph.swap ? 'W' : ph.weapon ? 'K' : ph.parryBonus ? 'G' : ph.grabBonus ? 'R' : 'A')).join(''));
  assert(new Set(tricks).size === TOWN_COUNT, `two bosses run the same phases: ${tricks.join(' ')}`);
});

test('ordinary enemies get stronger and sharper with every town', () => {
  const stats = (area: AreaId) => {
    const w = new World(L[area], fresh(), { entry: 'left', seed: 3 });
    const f = w.spawnEnemy('boxer', 20, 0);
    return { level: f.stats.level, strength: f.stats.base.strength, speed: f.stats.base.speed };
  };
  const home = stats('city');
  assert(home.level === ARCHETYPES.boxer.level && home.strength === ARCHETYPES.boxer.attributes.strength, 'the home town changed');
  let prev = home;
  for (let t = 1; t <= TOWN_COUNT; t++) {
    const s = stats(townAreaId(t, 1));
    assert(L[townAreaId(t, 1)].threat === t, `town ${t} threat`);
    assert(s.level === prev.level + 1 && s.strength === prev.strength + 1 && s.speed === prev.speed + 1, `a boxer in town ${t} is ${JSON.stringify(s)}`);
    prev = s;
  }
  // And the crowds differ: no two towns send the same set of enemies at you.
  const crowds = GENERATED_TOWNS.map((t) => [...new Set(t.districts.flatMap((d) => d.encounters.flatMap((e) => e.waves.flatMap((w) => w.enemies.map((x) => x.archetype)))))].sort().join(','));
  assert(new Set(crowds).size === TOWN_COUNT, 'two towns have the same crowd');
});

console.log('Variety');

test('no building stands next to a copy of itself, except terraces and garages, which are rows by nature', () => {
  const ROWS = /townhouse-row-unit|detached-garage|storefront-unit|restaurant-unit/;
  for (const id of TOWN_AREA_IDS) {
    const row = frontRow(id);
    assert(row.length >= 5, `${id}: only ${row.length} buildings`);
    for (let i = 1; i < row.length; i++) assert(row[i] !== row[i - 1] || ROWS.test(row[i]), `${id}: two ${row[i]} side by side`);
  }
});

test('no two districts are laid out alike, and the districts of a town are four different kinds of street', () => {
  const shape = (id: AreaId): string => L[id].facades.map((f) => `${f.kind}${Math.round((f.x1 - f.x0) / 4)}`).join(' ');
  const shapes = TOWN_AREA_IDS.map(shape);
  assert(new Set(shapes).size === shapes.length, 'two districts have the same run of buildings');
  for (const t of GENERATED_TOWNS) {
    const grounds = t.districts.map((d) => `${plans.get(d.id)!.ground}/${d.theme}`);
    assert(new Set(grounds).size >= 3, `${t.name}: its streets are ${grounds.join(', ')}`);
    // Next-door districts never share a kind of street.
    for (let i = 1; i < grounds.length; i++) assert(grounds[i] !== grounds[i - 1], `${t.name}: two ${grounds[i]} districts in a row`);
  }
});

test('each town is built from its own stock: any two towns share fewer than six in ten of their building models', () => {
  const stock = GENERATED_TOWNS.map((t) => new Set(t.districts.flatMap((d) => frontRow(d.id))));
  for (let a = 0; a < stock.length; a++) {
    assert(stock[a].size >= 6, `${GENERATED_TOWNS[a].name} is built from only ${stock[a].size} models`);
    for (let b = a + 1; b < stock.length; b++) {
      const both = [...stock[a]].filter((m) => stock[b].has(m)).length;
      const either = new Set([...stock[a], ...stock[b]]).size;
      assert(both / either < 0.6, `${GENERATED_TOWNS[a].name} and ${GENERATED_TOWNS[b].name} share ${both} of ${either} building models`);
    }
  }
  // Paving, lamps, light and weather differ too, not just walls.
  const looks = GENERATED_TOWNS.map((t) => {
    const p = plans.get(t.districts[1].id)!;
    const paving = p.placements.find((pl) => /sidewalk|slab|plaza|driveway/.test(pl.model))?.model;
    const lamp = p.placements.find((pl) => /lamp|street-light/.test(pl.model))?.model;
    return `${paving}|${lamp}|${t.districts[1].weather}|${t.districts[1].lights[0].colour}`;
  });
  assert(new Set(looks).size === TOWN_COUNT, `two towns look alike underfoot: ${looks.join('  ')}`);
});

test('every shop name is used once, and shops of one kind are never side by side', () => {
  const names: string[] = [];
  for (const id of TOWN_AREA_IDS) {
    const shops = plans.get(id)!.shopfronts;
    for (const s of shops) names.push(s.label);
    const ordered = [...shops].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < ordered.length; i++) {
      if (Math.abs(ordered[i].x0 - ordered[i - 1].x1) > 0.1) continue;
      assert(ordered[i].kind !== ordered[i - 1].kind, `${id}: two ${ordered[i].kind} shops side by side (${ordered[i - 1].label}, ${ordered[i].label})`);
    }
  }
  assert(names.length >= 40, `only ${names.length} shops in the towns`);
  assert(new Set(names).size === names.length, `a shop name repeats: ${names.find((n, i) => names.indexOf(n) !== i)}`);
});

test('furniture stands where it belongs, the middle of the street is clear, and fights have room', () => {
  for (const id of TOWN_AREA_IDS) {
    const lvl = L[id];
    for (const p of lvl.props) {
      assert(Math.abs(p.z) >= 0.9, `${id}: a ${p.kind} stands in the middle of the street at x ${p.x}`);
      for (const e of lvl.encounters) if (e.lock) assert(p.x < e.lock[0] - 0.5 || p.x > e.lock[1] + 0.5, `${id}: a ${p.kind} at x ${p.x} is inside the ${e.id} fight`);
    }
    const kinds = lvl.props.map((p) => p.kind);
    assert(kinds.length >= 5 && new Set(kinds).size >= 3, `${id}: ${kinds.length} props of ${new Set(kinds).size} kinds`);
    assert(lvl.lights.length >= 3, `${id}: ${lvl.lights.length} lamps`);
  }
});

console.log('What you do there is saved');

test('a fight won, a thing found and a boss beaten are still so after leaving, coming back and reloading', () => {
  const p = fresh();
  for (const d of DISTRICT_ORDER) if (!d.flag.startsWith('boss_town')) p.save.flags[d.flag] = true;
  p.save.flags.has_dunc_phone = p.save.flags.has_vip_pass = p.save.flags.has_stadium_key = true;
  // Win the main fight on the first street of the first town.
  const w = new World(L.t1d1, p, { entry: 'left', seed: 5 });
  const main = L.t1d1.encounters.find((e) => e.id === 'main')!;
  w.player.pos.x = main.triggerX + 0.5;
  let started = false;
  let cleared = false;
  w.events.on('encounter:start', () => (started = true));
  w.events.on('encounter:cleared', () => (cleared = true));
  for (let i = 0; i < 20 && !started; i++) w.step(emptyCommand());
  assert(started, 'the fight never started');
  for (let i = 0; i < 4000 && !cleared; i++) {
    // Knock each enemy out the way the combat system does, wave after wave.
    for (const f of w.sim.fighters) {
      if (f.team !== 'enemy' || f.isKO) continue;
      f.vitals.health = 0;
      f.knockOut();
      w.sim.bus.emit('fighter:ko', { fighter: f, by: w.player });
    }
    w.step(emptyCommand());
  }
  assert(cleared, 'the fight never finished');
  // Pick up the cash by standing on it.
  const stash = L.t1d1.pickups.find((x) => x.id === 'stash')!;
  const before = p.save.cash.pocket;
  w.player.pos.x = stash.x;
  w.player.pos.z = stash.z;
  for (let i = 0; i < 30; i++) w.step(emptyCommand());
  assert(p.save.cash.pocket > before, 'the stash was not picked up');
  // The boss of the town, beaten (the flag is how every boss in the game is recorded).
  p.save.flags[townBossFlag(1)] = true;
  // Leave, go three districts away, come back: same street, fight still won, stash still gone.
  const layout = JSON.stringify(planStreet(L.t1d1));
  new World(L.t1d4, p, { entry: 'left', seed: 9 });
  const back = new World(L.t1d1, p, { entry: 'left', seed: 11 });
  assert(JSON.stringify(planStreet(back.level)) === layout, 'the street changed while you were away');
  let again = false;
  back.events.on('encounter:start', () => (again = true));
  back.player.pos.x = main.triggerX + 0.5;
  for (let i = 0; i < 40; i++) back.step(emptyCommand());
  assert(!again, 'the fight you won started again');
  const pocket = p.save.cash.pocket;
  back.player.pos.x = stash.x;
  back.player.pos.z = stash.z;
  for (let i = 0; i < 30; i++) back.step(emptyCommand());
  assert(p.save.cash.pocket === pocket, 'the stash came back');
  // Save, reload, and it all still holds, including being stood in a generated district.
  p.save.area = 't1d1';
  p.save.visited.push('t1d1');
  const reloaded = new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);
  assert(reloaded.save.area === 't1d1' && reloaded.save.visited.includes('t1d1'), 'the save forgot where you were');
  assert(reloaded.has(townBossFlag(1)) && unlocked(reloaded, 't2d1'), 'the save forgot the boss');
  const later = new World(L.t1d1, reloaded, { entry: 'left', seed: 2 });
  let third = false;
  later.events.on('encounter:start', () => (third = true));
  later.player.pos.x = main.triggerX + 0.5;
  for (let i = 0; i < 40; i++) later.step(emptyCommand());
  assert(!third, 'the fight came back after reloading');
  // An old save from before the towns existed still loads, at home, with nothing lost.
  const old = JSON.parse(JSON.stringify(fresh().save));
  assert(sanitiseSave(old)!.area === 'home', 'an old save no longer loads');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
