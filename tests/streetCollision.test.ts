/**
 * Street collision (city/street.ts `streetSolids`, World): lamp columns, the kit's own models and parked bikes are
 * solid for you and everyone else, and a parked bike you've just stepped off settles solid once you're clear of it.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress } from '../src/progress/Progress';
import { streetSolids, LAMP_Z } from '../src/city/street';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { resolveLevel } from '../src/property/levels';

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
};
const fresh = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
const walk = (w: World, frames: number, moveX: number, moveZ = 0) => {
  for (let i = 0; i < frames; i++) {
    const c = emptyCommand();
    c.moveX = moveX;
    c.moveZ = moveZ;
    w.step(c);
  }
};

console.log('Street collision');
ok('every lit kit street has solid lamp columns at the kerb', () => {
  let n = 0;
  for (const l of Object.values(LEVELS)) {
    const lamps = streetSolids(l).filter((d) => d.prop < 0);
    n += lamps.length;
    if (!lamps.length) continue;
    const w = new World(l, fresh(), { entry: l.entries[0].id, seed: 1 });
    for (const d of lamps) assert(w.arena.blocked((d.x0 + d.x1) / 2, LAMP_Z, 0), `${l.id}: lamp at ${d.x0} isn't solid`);
  }
  assert(n > 40, `only ${n} lamps`);
});
ok('you can\'t walk through a lamp column', () => {
  const l = LEVELS.high_street;
  const lamp = streetSolids(l).find((d) => d.prop < 0)!;
  const w = new World(l, fresh(), { entry: l.entries[0].id, seed: 1 });
  for (const e of w.encounters) e.status = 'cleared';
  w.arena.lock = null;
  w.player.pos.x = lamp.x0 - 1.2;
  w.player.pos.z = LAMP_Z;
  for (let i = 0; i < 90; i++) {
    walk(w, 1, 1);
    w.player.pos.z = LAMP_Z;
    const p = w.player.pos;
    assert(!(p.x > lamp.x0 && p.x < lamp.x1), `walked into the lamp: x=${p.x.toFixed(2)}`);
  }
});
ok('the bikes out on the streets are solid', () => {
  const save = newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() }));
  for (const area of ['city', 'precinct'] as const) {
    const lv = resolveLevel(area, save);
    const w = new World(lv, new Progress(save), { entry: lv.entries[0].id, seed: 1 });
    const bikes = lv.props.filter((p) => p.kind === 'vehicle' && p.leanOnWall);
    for (const b of bikes) assert(w.arena.blocked(b.x, b.z, 0), `${area}: ${b.item} isn't solid`);
  }
});
ok('your parked bike settles solid once you step off it', () => {
  const l = LEVELS.high_street;
  const w = new World(l, fresh(), { entry: l.entries[0].id, seed: 1 });
  for (const e of w.encounters) e.status = 'cleared';
  w.arena.lock = null;
  w.player.pos.x = 30;
  w.player.pos.z = 0.5;
  w.settleObstacle('parked_bike', 30, 0.5, 0.95, 0.3);
  assert(!w.arena.blocked(30, 0.5, 0), 'solid under you');
  walk(w, 60, 0, -1);
  assert(w.arena.blocked(30, 0.5, 0), 'still not solid once you stepped away');
  w.clearObstacle('parked_bike');
  assert(!w.arena.blocked(30, 0.5, 0), 'still there after you got on');
});

console.log(`\nstreetCollision: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
