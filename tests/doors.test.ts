/**
 * Doors make sense everywhere: every door leads to a real spot, the way back out of anywhere you walked into puts
 * you back at the door you used (not home, not another door), streets join end to end in the street's order, no
 * shop has a back way home, nothing stands in front of a for-sale house's front door, and every door and arrival
 * spot can be stood at.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, type AreaId } from '../src/progress/Progress';
import { resolveLevel } from '../src/property/levels';
import { PROPERTY_LIST } from '../src/realty/catalogue';
import { buildPropertyInterior } from '../src/realty/world';
import { LEVELS } from '../src/world/levels';
import { propHalf, type LevelDef } from '../src/world/LevelTypes';
import { STRIP } from '../src/world/strip';
import { World } from '../src/world/World';
import { emptyCommand } from '../src/input/Commands';
import { nextExit, route } from '../src/map/worldMap';

let passed = 0;
let failed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
};

const progress = () => {
  const p = new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.tutorial.essentialDone = true;
  return p;
};
const p = progress();
const level = (id: string, inside?: string): LevelDef => {
  const save = { ...p.save, portfolio: { ...p.save.portfolio, inside: inside ?? null } };
  return resolveLevel(id as AreaId, save as typeof p.save);
};
const AREAS = Object.keys(LEVELS).filter((id) => id !== 'property');

console.log('Doors');

test('every door and edge leads to an arrival spot that exists', () => {
  const bad: string[] = [];
  for (const id of AREAS) {
    for (const ex of level(id).exits) {
      if (ex.to === 'property') {
        if (!PROPERTY_LIST.some((d) => d.id === ex.toEntry)) bad.push(`${id} -> property ${ex.toEntry}`);
        continue;
      }
      if (!level(ex.to).entries.some((e) => e.id === ex.toEntry)) bad.push(`${id} -> ${ex.to}:${ex.toEntry}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the way back out of anywhere you walk into puts you at the door you used', () => {
  const bad: string[] = [];
  for (const id of AREAS) {
    const a = level(id);
    for (const ex of a.exits) {
      if (ex.kind !== 'door') continue;
      if (ex.to === 'property') {
        const b = level('property', ex.toEntry);
        const back = b.exits[0];
        const at = a.entries.find((e) => e.id === back.toEntry);
        if (back.to !== id || !at || Math.abs(at.x - ex.x) > 1.5) bad.push(`${id}@${ex.x} -> ${ex.toEntry}: out to ${back.to}:${back.toEntry}`);
        continue;
      }
      const b = level(ex.to);
      const backs = b.exits.filter((e) => e.to === id);
      const lands = backs.map((bx) => a.entries.find((e) => e.id === bx.toEntry));
      if (!lands.some((e) => e && Math.abs(e.x - ex.x) < 2)) bad.push(`${id}@${ex.x} -> ${ex.to}: back to ${backs.map((x) => `${x.to}:${x.toEntry}`).join(',') || 'nowhere'}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no shop or venue has a back way home: home is only through your own front door (or after the cells)', () => {
  const bad: string[] = [];
  for (const id of AREAS) {
    if (id === 'home' || id === 'basement') continue;
    for (const ex of level(id).exits) if (ex.to === 'home') bad.push(`${id}: ${ex.id} '${ex.label}'`);
  }
  // A street's own door to the house is fine (that's the front door).
  assert.deepEqual(bad.filter((b) => !/home_door/.test(b)), []);
});

test('the long street joins end to end in order, each way', () => {
  for (let i = 0; i + 1 < STRIP.length; i++) {
    const r = LEVELS[STRIP[i]].exits.find((e) => e.kind === 'edge' && e.side === 'right');
    const l = LEVELS[STRIP[i + 1]].exits.find((e) => e.kind === 'edge' && e.side === 'left');
    assert.equal(r?.to, STRIP[i + 1], `${STRIP[i]} east`);
    assert.equal(l?.to, STRIP[i], `${STRIP[i + 1]} west`);
  }
});

test('nothing stands in front of a property front door, and nothing hangs over it', () => {
  const bad: string[] = [];
  for (const d of PROPERTY_LIST) for (const as of ['viewing', 'owner'] as const) {
    const l = buildPropertyInterior(d, as, true, '£1');
    const door = l.exits[0];
    for (const pr of l.props) {
      const [hx] = propHalf(pr);
      if (Math.abs(pr.x - door.x) >= hx + 0.45) continue;
      if (pr.kind === 'staircase' || pr.kind === 'rug') continue;
      bad.push(`${d.id} ${as}: ${pr.kind}${pr.item ? `:${pr.item}` : ''} at x ${pr.x.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('every door can be stood at and every arrival spot is clear', () => {
  const bad: string[] = [];
  for (const id of AREAS) {
    const lv = level(id);
    const w = new World(lv, p, { entry: lv.entries[0]?.id ?? 'start', seed: 1 });
    for (const en of lv.entries) if (w.arena.blocked(en.x, en.z, 0.25)) bad.push(`${id}: arrive ${en.id} inside something`);
    for (const ex of lv.exits) {
      if (ex.kind !== 'door') continue;
      let ok = false;
      for (let dz = 0; dz <= 1.6 && !ok; dz += 0.2) for (let dx = -0.6; dx <= 0.6 && !ok; dx += 0.2) {
        const z = ex.z < 0 ? Math.max(lv.bounds.minZ + 0.2, ex.z + 0.4 + dz) : Math.min(lv.bounds.maxZ - 0.2, ex.z - 0.4 - dz);
        if (!w.arena.blocked(ex.x + dx, z, 0.25)) ok = true;
      }
      if (!ok) bad.push(`${id}: door ${ex.id} blocked`);
    }
  }
  assert.deepEqual(bad, []);
});

test('standing at a door and pressing use takes you through it, to where it says', () => {
  const bad: string[] = [];
  const q = progress();
  for (const f of Object.keys(q.save.flags)) delete q.save.flags[f];
  // Every lock open, so every door can be tried.
  for (const lv of Object.values(LEVELS)) for (const ex of lv.exits) {
    if (ex.requires) q.save.flags[ex.requires] = true;
    for (const r of ex.requiresAll ?? []) q.save.flags[r] = true;
  }
  for (const id of AREAS) {
    // No fights (a door can't be used mid-fight), so every door can be tried.
    const lv = { ...resolveLevel(id as AreaId, q.save), encounters: [] };
    for (const ex of lv.exits.filter((e) => e.kind === 'door' && !e.shop)) {
      const w = new World(lv, q, { entry: lv.entries[0].id, seed: 2 });
      let went: { to: string; entry: string } | null = null;
      w.events.on('area:exit', (e) => (went = { to: e.to, entry: e.entry }));
      w.player.pos.x = ex.x;
      w.player.pos.z = ex.z < 0 ? Math.max(lv.bounds.minZ + 0.25, ex.z + 0.5) : Math.min(lv.bounds.maxZ - 0.25, ex.z - 0.5);
      for (let i = 0; i < 90 && !went; i++) {
        const c = emptyCommand();
        c.use = i > 60 && i % 2 === 1;
        w.step(c);
        if (i < 60) {
          w.player.pos.x = ex.x;
          w.player.pos.z = ex.z < 0 ? Math.max(lv.bounds.minZ + 0.25, ex.z + 0.5) : Math.min(lv.bounds.maxZ - 0.25, ex.z - 0.5);
        }
      }
      const g = went as { to: string; entry: string } | null;
      if (!g || g.to !== ex.to || g.entry !== ex.toEntry) bad.push(`${id}: ${ex.id} -> ${g ? `${g.to}:${g.entry}` : 'nothing'}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('following the route from home reaches every open place, one door or street at a time, never looping', () => {
  const q = progress();
  for (const d of ['boss_gaffer', 'boss_sully', 'boss_ratcatcher', 'boss_docks', 'boss_precinct', 'has_vip_pass']) q.save.flags[d] = true;
  const bad: string[] = [];
  for (const to of AREAS) {
    if (!route(q, 'estate', to as AreaId)) continue;
    let at = 'estate' as AreaId;
    const seen = new Set<string>([at]);
    for (let i = 0; i < 60 && at !== to; i++) {
      const ex = nextExit(q, at, to as AreaId);
      if (!ex) break;
      at = ex.to as AreaId;
      if (seen.has(at)) {
        bad.push(`${to}: loops at ${at}`);
        break;
      }
      seen.add(at);
    }
    if (at !== to && !bad.some((b) => b.startsWith(to))) bad.push(`${to}: stuck at ${at}`);
  }
  assert.deepEqual(bad, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
