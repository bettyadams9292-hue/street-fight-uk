/** World tests: collision, level connectivity, encounters, bosses, rewards, pickups, saving. */
import { BOSSES } from '../src/ai/bosses';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { BODY_RADIUS } from '../src/core/constants';
import type { Fighter } from '../src/fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { AREA_IDS, newSave, Progress, type AreaId } from '../src/progress/Progress';
import { SaveStore } from '../src/save/SaveStore';
import { Arena } from '../src/world/Arena';
import { propBox } from '../src/world/LevelTypes';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';

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

function freshProgress(): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  return new Progress(newSave(c));
}
function cmd(o: Partial<CommandFrame> & { press?: (keyof CommandFrame['pressed'])[] } = {}): CommandFrame {
  const c = emptyCommand();
  if (o.moveX !== undefined) c.moveX = o.moveX;
  if (o.moveZ !== undefined) c.moveZ = o.moveZ;
  if (o.block) c.block = true;
  for (const p of o.press ?? []) c.pressed[p] = true;
  return c;
}
function run(w: World, frames: number, c: (i: number) => CommandFrame = () => cmd()): void {
  for (let i = 0; i < frames; i++) w.step(c(i));
}
/** Knock a fighter out the way the combat system does. */
function ko(w: World, f: Fighter): void {
  f.vitals.health = 0;
  f.knockOut();
  w.sim.bus.emit('fighter:ko', { fighter: f, by: w.player });
}
/** Put the player somewhere directly (tests skip the walking). */
function place(w: World, x: number, z: number): void {
  w.player.pos.x = x;
  w.player.pos.z = z;
}
function memoryKV() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
/** Is (x,z) somewhere the player could stand? */
function standable(a: Arena, x: number, z: number): boolean {
  const b = a.bounds;
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && !a.blocked(x, z, BODY_RADIUS * 0.95);
}
/** Grid flood fill over standable cells from a start point. */
function reach(a: Arena, sx: number, sz: number): (x: number, z: number) => boolean {
  const step = 0.1;
  const b = a.bounds;
  const W = Math.round((b.maxX - b.minX) / step) + 1;
  const H = Math.round((b.maxZ - b.minZ) / step) + 1;
  const seen = new Uint8Array(W * H);
  const ix = (x: number) => Math.max(0, Math.min(W - 1, Math.round((x - b.minX) / step)));
  const iz = (z: number) => Math.max(0, Math.min(H - 1, Math.round((z - b.minZ) / step)));
  const q: number[] = [];
  const push = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= W || j >= H || seen[j * W + i]) return;
    if (!standable(a, b.minX + i * step, b.minZ + j * step)) return;
    seen[j * W + i] = 1;
    q.push(i, j);
  };
  push(ix(sx), iz(sz));
  while (q.length) {
    const j = q.pop()!;
    const i = q.pop()!;
    push(i + 1, j);
    push(i - 1, j);
    push(i, j + 1);
    push(i, j - 1);
  }
  // Something within ~1 m (interaction range) counts as reachable.
  return (x, z) => {
    for (let dz = -1; dz <= 1; dz += 0.1) for (let dx = -1; dx <= 1; dx += 0.1) {
      if (Math.hypot(dx, dz) > 1) continue;
      const i = ix(x + dx);
      const j = iz(z + dz);
      if (seen[j * W + i] && !a.lineBlocked(b.minX + i * step, b.minZ + j * step, x, z)) return true;
    }
    return false;
  };
}

console.log('World');

test('every exit leads to a real entry, and every area can be reached', () => {
  const reached = new Set<AreaId>(['home']);
  for (const id of AREA_IDS) {
    for (const ex of LEVELS[id].exits) {
      const target = LEVELS[ex.to];
      assert(target, `${id}.${ex.id} -> missing area ${ex.to}`);
      assert(target.entries.some((e) => e.id === ex.toEntry), `${id}.${ex.id} -> ${ex.to} has no entry ${ex.toEntry}`);
      reached.add(ex.to);
    }
  }
  for (const id of AREA_IDS) assert(reached.has(id), `${id} unreachable`);
});

test('entries, stations, pickups and doors are clear of collision and reachable', () => {
  for (const id of AREA_IDS) {
    const lvl = LEVELS[id];
    const w = new World(lvl, freshProgress(), { entry: lvl.entries[0].id, seed: 1 });
    // Open every gate: with all flags set everything should be reachable.
    for (const g of lvl.gates ?? []) {
      const o = w.arena.obstacles.find((x) => x.id === g.id);
      if (o) o.solid = false;
    }
    for (const e of lvl.entries) assert(standable(w.arena, e.x, e.z), `${id}: entry ${e.id} is inside something`);
    const canReach = reach(w.arena, lvl.entries[0].x, lvl.entries[0].z);
    for (const e of lvl.entries) assert(canReach(e.x, e.z), `${id}: entry ${e.id} not reachable`);
    for (const ex of lvl.exits) if (ex.kind === 'door') assert(canReach(ex.x, ex.z), `${id}: door ${ex.id} not reachable`);
    for (const s of lvl.stations ?? []) assert(canReach(s.x, s.z), `${id}: station ${s.id} not reachable`);
    for (const p of lvl.pickups) assert(canReach(p.x, p.z), `${id}: pickup ${p.id} not reachable`);
    for (const l of lvl.levers ?? []) assert(canReach(l.x, l.z), `${id}: lever ${l.id} not reachable`);
    for (const enc of lvl.encounters) assert(canReach(enc.triggerX, 0) || canReach(enc.triggerX, -0.8), `${id}: encounter ${enc.id} trigger not reachable`);
  }
});

test('a closed gate really blocks, and the lever is reachable without it', () => {
  const lvl = LEVELS.subway;
  const w = new World(lvl, freshProgress(), { entry: 'left', seed: 1 });
  const canReach = reach(w.arena, 2, 0);
  assert(!canReach(66, -1.5), 'stairs door reachable through a closed gate');
  assert(canReach(44, -1.2), 'lever not reachable');
});

test('the player cannot walk through walls or props', () => {
  const w = new World(LEVELS.home, freshProgress(), { entry: 'start', seed: 1 });
  // Bedroom to living room through the divider (back part), pushing right at z=-1.5.
  place(w, -14.2, -0.6);
  run(w, 240, () => cmd({ moveX: 1, moveZ: -1 }));
  assert(w.player.pos.x < -13.1 - BODY_RADIUS + 0.05, `walked through the bedroom wall: x=${w.player.pos.x.toFixed(2)}`);
  // Walk into the car in the garage.
  const s = new World(LEVELS.estate, freshProgress(), { entry: 'home', seed: 1 });
  place(s, 2.5, 1.4);
  run(s, 200, () => cmd({ moveX: 1 }));
  const car = propBox({ kind: 'car', x: 6, z: 1.4 })!;
  assert(s.player.pos.x <= car.minX - BODY_RADIUS + 0.05 || s.player.pos.z > car.maxZ, `walked into the car: ${s.player.pos.x.toFixed(2)},${s.player.pos.z.toFixed(2)}`);
});

test('home: you can walk the front of the house end to end without snagging', () => {
  const w = new World(LEVELS.home, freshProgress(), { entry: 'start', seed: 1 });
  place(w, -19, 1.0);
  run(w, 60 * 14, () => cmd({ moveX: 1, moveZ: 0.4 }));
  assert(w.player.pos.x > 10.3, `got stuck at x=${w.player.pos.x.toFixed(2)}, z=${w.player.pos.z.toFixed(2)}`);
});

test('interaction prompts do not work through walls', () => {
  const w = new World(LEVELS.home, freshProgress(), { entry: 'start', seed: 1 });
  // Kitchen station is at x=-1.2; stand on the other side of the kitchen/living wall.
  place(w, -4.45, -0.9);
  run(w, 1);
  assert(w.interactable?.kind !== 'station' || w.interactable.station.id !== 'kitchen', 'kitchen usable through the wall');
  place(w, -1.2, -0.3);
  run(w, 1);
  assert(w.interactable?.kind === 'station' && w.interactable.station.id === 'kitchen', `no kitchen prompt in front of it: ${w.interactable?.label}`);
  let opened = '';
  w.events.on('station', ({ id }) => (opened = id));
  run(w, 1, () => cmd({ press: ['grab'] }));
  assert(opened === 'kitchen', 'interact did not open the kitchen');
});

test('front door takes you to the estate; locked exits explain themselves', () => {
  const w = new World(LEVELS.home, freshProgress(), { entry: 'start', seed: 1 });
  place(w, -8, -0.8);
  let to = '';
  w.events.on('area:exit', (e) => (to = `${e.to}:${e.entry}`));
  run(w, 2, (i) => cmd({ press: i === 1 ? ['grab'] : [] }));
  assert(to === 'estate:home', `front door went to ${to}`);

  const h = new World(LEVELS.high_street, freshProgress(), { entry: 'right', seed: 1 });
  // Mark encounters done so nothing triggers.
  for (const e of h.encounters) e.status = 'cleared';
  let locked = '';
  let exited = false;
  h.events.on('area:locked', (e) => (locked = e.text));
  h.events.on('area:exit', () => (exited = true));
  run(h, 120, () => cmd({ moveX: 1 }));
  assert(locked.length > 0 && !exited, 'locked edge let you through or said nothing');
});

test('encounters lock the area, spawn waves, and pay once', () => {
  const p = freshProgress();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 4 });
  place(w, 18.5, 0);
  run(w, 2);
  const e = w.activeEncounter;
  assert(e && e.def.id === 'lads', 'encounter did not start');
  assert(w.locked && w.arena.lock!.minX === 10, 'no lock');
  // Try to leave left: the lock holds.
  run(w, 200, () => cmd({ moveX: -1, moveZ: 1 }));
  assert(w.player.pos.x >= 10 - 0.01, `escaped the lock: ${w.player.pos.x}`);
  const before = p.save.cash.pocket;
  let waves = 0;
  let cleared = 0;
  w.events.on('encounter:wave', () => waves++);
  w.events.on('encounter:cleared', () => cleared++);
  for (let guard = 0; guard < 10 && w.activeEncounter; guard++) {
    for (const f of [...w.activeEncounter.enemies]) if (!f.isKO) ko(w, f);
    run(w, 2);
  }
  assert(waves === 1 && cleared === 1, `waves ${waves} cleared ${cleared}`);
  assert(!w.locked, 'still locked after clearing');
  assert(p.save.cash.pocket - before === 30, `paid ${p.save.cash.pocket - before}`);
  assert(p.has('cleared:estate:lads'), 'not marked cleared');
  // Coming back: the fight is gone and pays nothing.
  const w2 = new World(LEVELS.estate, p, { entry: 'home', seed: 4 });
  place(w2, 20, 0);
  run(w2, 5);
  assert(!w2.activeEncounter, 'mandatory fight came back');
});

test('beaten enemies drop cash and are removed', () => {
  const p = freshProgress();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 4 });
  place(w, 18.5, 0);
  run(w, 2);
  const f = w.activeEncounter!.enemies[0];
  ko(w, f);
  run(w, 160);
  assert(!w.sim.fighters.includes(f), 'body still in the sim');
  const drop = w.pickups.find((x) => x.kind === 'drop');
  assert(drop && drop.amount > 0, 'no cash dropped');
});

test('boss: phases fire, defeat fires once, rewards once, unlocks the next district', () => {
  const p = freshProgress();
  const w = new World(LEVELS.high_street, p, { entry: 'left', seed: 9 });
  for (const e of w.encounters) if (e.def.id !== 'gaffer') e.status = 'cleared';
  place(w, 80.5, 0);
  run(w, 2);
  const enc = w.activeEncounter!;
  assert(enc && enc.boss && enc.bossDef?.id === 'gaffer', 'boss did not spawn');
  const boss = enc.boss;
  assert(boss.vitals.maxHealth > 200, `boss health only ${boss.vitals.maxHealth}`);
  let phases = 0;
  let defeated = 0;
  w.events.on('boss:phase', () => phases++);
  w.events.on('boss:defeated', () => defeated++);
  const count = w.enemies.length;
  boss.vitals.health = boss.vitals.maxHealth * 0.5;
  run(w, 2);
  assert(phases === 1 && w.enemies.length > count, `phase 1: ${phases}, summoned ${w.enemies.length - count}`);
  boss.vitals.health = boss.vitals.maxHealth * 0.2;
  run(w, 2);
  assert(phases === 2, `phases ${phases}`);
  const cash = p.save.cash.pocket;
  for (let guard = 0; guard < 10 && w.activeEncounter; guard++) {
    for (const f of [...w.activeEncounter.enemies]) if (!f.isKO) ko(w, f);
    run(w, 2);
  }
  run(w, 300);
  assert(defeated === 1, `boss:defeated fired ${defeated} times`);
  assert(p.has('boss_gaffer'), 'district not unlocked');
  assert(p.save.cash.pocket - cash >= BOSSES.gaffer.reward.cash, 'reward not paid');
  // A second visit: no boss, no second payout.
  const w2 = new World(LEVELS.high_street, p, { entry: 'right', seed: 9 });
  place(w2, 85, 0);
  run(w2, 5);
  assert(!w2.activeBoss, 'boss came back');
  assert(!p.claim('boss:gaffer'), 'boss reward claimable twice');
  // The way on is open now.
  let to = '';
  w2.events.on('area:exit', (e) => (to = e.to));
  place(w2, 91.9, 0);
  run(w2, 30, () => cmd({ moveX: 1 }));
  assert(to === 'alleys', `exit went to "${to}"`);
});

test('one-time pickups stay collected; food comes back', () => {
  const p = freshProgress();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 1 });
  for (const e of w.encounters) e.status = 'cleared';
  const cash = p.save.cash.pocket;
  place(w, 28, 0.5);
  run(w, 2);
  assert(p.save.cash.pocket === cash + 10, 'tenner not picked up');
  place(w, 43, -1.6);
  run(w, 2);
  assert(p.save.stats.secrets === 1 && p.save.cosmetics.includes('acc:cap'), 'secret not found');
  w.player.vitals.health = 10;
  place(w, 15, -1.0);
  run(w, 2);
  assert(w.player.vitals.health > 10, 'food did not heal');
  const w2 = new World(LEVELS.estate, p, { entry: 'home', seed: 1 });
  assert(!w2.pickups.some((x) => x.key === 'tenner' || x.key === 'garages_stash'), 'one-time pickups came back');
  assert(w2.pickups.some((x) => x.key === 'chips'), 'food did not come back');
});

test('weapons: pick up, swing, drop on knockdown, and go in the garage', () => {
  const p = freshProgress();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 1 });
  for (const e of w.encounters) e.status = 'cleared';
  place(w, 24, 0);
  run(w, 2);
  assert(w.interactable?.kind === 'weapon', `no weapon prompt: ${w.interactable?.kind}`);
  run(w, 1, () => cmd({ press: ['grab'] }));
  assert(w.player.weapon?.data.id === 'bottle', 'not holding the bottle');
  assert(p.save.weapons.includes('bottle'), 'bottle not in the garage');
  run(w, 2, (i) => cmd({ press: i === 0 ? ['hp'] : [] }));
  assert(w.player.move?.data.style === 'weapon', `swing was ${w.player.move?.data.id}`);
  run(w, 60);
  w.player.weapon && w.player.dropWeapon();
  run(w, 2);
  assert(w.items.some((i) => i.weapon.id === 'bottle'), 'dropped bottle not on the ground');
});

test('subway lever opens the gate and the estate shortcut', () => {
  const p = freshProgress();
  const w = new World(LEVELS.subway, p, { entry: 'left', seed: 1 });
  for (const e of w.encounters) e.status = 'cleared';
  place(w, 44, -0.6);
  run(w, 1);
  assert(w.interactable?.kind === 'lever', 'no lever prompt');
  run(w, 1, () => cmd({ press: ['grab'] }));
  assert(p.has('shortcut_subway') && w.isGateOpen(LEVELS.subway.gates![0]), 'gate not open');
  const canReach = reach(w.arena, 2, 0);
  assert(canReach(66, -1.5), 'stairs still unreachable');
  const e = new World(LEVELS.estate, p, { entry: 'home', seed: 1 });
  const door = e['findInteractable'];
  void door;
  place(e, 38, -1.0);
  for (const x of e.encounters) x.status = 'cleared';
  let to = '';
  e.events.on('area:exit', (ev) => (to = ev.to));
  run(e, 2, (i) => cmd({ press: i === 1 ? ['grab'] : [] }));
  assert(to === 'subway', `shortcut went to "${to}"`);
});

test('fights behind you do not trigger when you arrive from the far end', () => {
  const w = new World(LEVELS.high_street, freshProgress(), { entry: 'right', seed: 3 });
  run(w, 30, () => cmd({ moveX: -1 }));
  assert(!w.activeEncounter && !w.locked, 'a fight started on arrival');
  for (const e of w.encounters) if (e.def.id !== 'pub_door') e.status = 'cleared';
  place(w, 45, 0);
  run(w, 1);
  place(w, 27.5, 0);
  run(w, 2);
  assert(w.activeEncounter?.def.id === 'pub_door', 'crossing from the right did not start the fight');
});

test('player defeat fires once', () => {
  const w = new World(LEVELS.estate, freshProgress(), { entry: 'home', seed: 1 });
  let n = 0;
  w.events.on('player:defeated', () => n++);
  ko(w, w.player);
  run(w, 400);
  assert(n === 1, `fired ${n}`);
});

test('AI walks round obstacles instead of grinding into them', () => {
  const w = new World(LEVELS.alleys, freshProgress(), { entry: 'left', seed: 2 });
  for (const e of w.encounters) e.status = 'cleared';
  // Skip at x=22, z=-0.9 (x 20.75..23.25). Enemy behind it, player in front.
  place(w, 25.5, -1.2);
  const f = w.spawnEnemy('thug', 18.5, -1.2);
  run(w, 360, () => cmd({ block: true }));
  assert(Math.abs(f.pos.x - w.player.pos.x) < 2.5, `enemy stuck at x=${f.pos.x.toFixed(2)} z=${f.pos.z.toFixed(2)}`);
  assert(!w.arena.blocked(f.pos.x, f.pos.z, BODY_RADIUS * 0.9), 'enemy inside the skip');
});

test('save/load round trip, backup recovery and legacy migration', () => {
  const kv = memoryKV();
  const store = new SaveStore(kv);
  const p = freshProgress();
  p.addCash(77);
  p.set('boss_gaffer');
  p.claim('boss:gaffer');
  p.save.area = 'alleys';
  assert(store.write(p.save), 'write failed');
  const loaded = store.load()!;
  assert(loaded && !loaded.recovered && loaded.save.cash.pocket === 77 && loaded.save.flags.boss_gaffer, 'round trip lost data');
  // Second write backs up the first; then corrupt main.
  p.addCash(1);
  store.write(p.save);
  kv.setItem('sfuk.save.v2', '{not json');
  const rec = store.load()!;
  assert(rec && rec.recovered && rec.save.flags.boss_gaffer, 'did not recover from backup');
  // Garbage fields get repaired, not crash.
  kv.setItem('sfuk.save.v2', JSON.stringify({ ...p.save, cash: { pocket: -50, bank: 'lots' }, area: 'narnia', flags: { x: 'yes', y: true } }));
  const fixed = store.load()!;
  assert(fixed.save.cash.pocket >= 0 && typeof fixed.save.cash.bank === 'number' && fixed.save.area === 'home' && !fixed.save.flags.x && fixed.save.flags.y, 'sanitise failed');
});

test('full loop: home, out, boss, home, bank, train, save, reload, next district', () => {
  const kv = memoryKV();
  const store = new SaveStore(kv);
  const p = freshProgress();
  const startBank = p.save.cash.bank;
  // Home -> estate through the front door.
  let w = new World(LEVELS.home, p, { entry: 'start', seed: 1 });
  let exit: { to: AreaId; entry: string } | null = null;
  w.events.on('area:exit', (e) => (exit = e));
  place(w, -8, -0.8);
  run(w, 2, (i) => cmd({ press: i === 1 ? ['grab'] : [] }));
  assert(exit && exit!.to === 'estate', 'front door did not lead out');
  // Estate -> high street, beat the Gaffer.
  const hs = new World(LEVELS.high_street, p, { entry: 'left', seed: 2, carry: w.carry() });
  for (const e of hs.encounters) if (e.def.id !== 'gaffer') e.status = 'cleared';
  place(hs, 80.5, 0);
  run(hs, 2);
  for (let guard = 0; guard < 10 && hs.activeEncounter; guard++) {
    for (const f of [...hs.activeEncounter.enemies]) if (!f.isKO) ko(hs, f);
    run(hs, 2);
  }
  assert(p.has('boss_gaffer') && p.save.cash.pocket > 0, 'boss not beaten or nothing earned');
  // Home: bank it and train.
  w = new World(LEVELS.home, p, { entry: 'door', seed: 3, carry: hs.carry() });
  const banked = p.bankAll();
  assert(banked > 0 && p.save.cash.bank === startBank + banked && p.save.cash.pocket === 0, 'banking failed');
  const hpBefore = w.player.vitals.maxHealth;
  assert(p.save.trainingPoints > 0, 'no training points after a boss');
  const r = p.buyUpgrade('health');
  assert(r.ok, `upgrade refused: ${!r.ok ? r.reason : ''}`);
  const w2 = new World(LEVELS.home, p, { entry: 'door', seed: 3 });
  assert(w2.player.vitals.maxHealth === hpBefore + 15, `upgrade not applied: ${hpBefore} -> ${w2.player.vitals.maxHealth}`);
  // Save, reload, and the alleys are open with nothing reset.
  p.save.area = 'home';
  assert(store.write(p.save), 'save failed');
  const reloaded = new Progress(store.load()!.save);
  assert(reloaded.has('boss_gaffer') && reloaded.save.upgrades.health === 1 && reloaded.save.cash.bank === p.save.cash.bank, 'progress lost on reload');
  const hs2 = new World(LEVELS.high_street, reloaded, { entry: 'right', seed: 4 });
  assert(!hs2.activeBoss && hs2.encounters.find((e) => e.def.id === 'gaffer')!.status === 'cleared', 'boss back after reload');
  let to = '';
  hs2.events.on('area:exit', (e) => (to = e.to));
  place(hs2, 91.9, 0);
  run(hs2, 30, () => cmd({ moveX: 1 }));
  assert(to === 'alleys', 'alleys still locked after reload');
});

test('getting battered costs a share of your pocket, never the tin or progress', () => {
  const p = freshProgress();
  p.addCash(100);
  p.set('boss_gaffer');
  const bank = p.save.cash.bank;
  const lost = p.losePocket(0.25);
  assert(lost === 25 && p.save.cash.pocket === 75 && p.save.cash.bank === bank && p.has('boss_gaffer'), 'wrong penalty');
});

test('soak: AI groups in every area for 40 s without errors or escapes', () => {
  for (const id of AREA_IDS) {
    if (id === 'home') continue;
    const lvl = LEVELS[id];
    const p = freshProgress();
    const w = new World(lvl, p, { entry: lvl.entries[0].id, seed: 7 });
    const first = w.encounters.find((e) => !e.def.optional)!;
    place(w, first.def.triggerX + 0.5, 0);
    w.player.vitals.health = 1e6;
    for (let i = 0; i < 40 * 60; i++) {
      w.step(cmd({ press: i % 20 === 0 ? ['lp'] : [], moveX: Math.sin(i / 50) }));
      for (const f of w.sim.fighters) {
        assert(Number.isFinite(f.pos.x) && Number.isFinite(f.pos.z), `${id}: NaN position`);
        const b = w.arena.bounds;
        assert(f.pos.x >= b.minX - 0.01 && f.pos.x <= b.maxX + 0.01 && f.pos.z >= b.minZ - 0.01 && f.pos.z <= b.maxZ + 0.01, `${id}: ${f.name} out of bounds`);
        if (!f.grapple) assert(!w.arena.blocked(f.pos.x, f.pos.z, BODY_RADIUS * 0.7), `${id}: ${f.name} inside an obstacle at ${f.pos.x.toFixed(2)},${f.pos.z.toFixed(2)}`);
      }
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
