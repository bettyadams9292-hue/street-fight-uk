/**
 * Pedestrian behaviour: people get past each other without dithering, find
 * another way when blocked, and react to trouble as individuals.
 */
import { measure } from '../tools/npc_metrics';
import { CivilianBrain } from '../src/world/civilians';
import { Arena } from '../src/world/Arena';
import { Fighter } from '../src/fighter/Fighter';
import { Rng } from '../src/core/Rng';
import { defaultAttributes } from '../src/stats/Stats';
import { getStyle } from '../src/data/styles';
import { Simulation } from '../src/core/Simulation';

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

const BOUNDS = { minX: -20, maxX: 20, minZ: -2, maxZ: 2 };
function street(obstacles: { minX: number; maxX: number; minZ: number; maxZ: number }[] = []): { sim: Simulation; arena: Arena } {
  const arena = new Arena(BOUNDS, 'test', obstacles);
  return { sim: new Simulation(arena, 1), arena };
}
let nextId = 1;
function walker(sim: Simulation, arena: Arena, x: number, z: number, dir: 1 | -1, seed: number, speed = 0.55): { f: Fighter; brain: CivilianBrain } {
  const f = new Fighter({ id: nextId++, name: 'P', team: 'neutral', attributes: defaultAttributes(4), style: getStyle('street'), x, z });
  f.stats.addModifier({ id: 'stroll', source: 'civilian', stat: 'moveSpeedMult', mul: speed });
  sim.add(f);
  const brain = new CivilianBrain(f, arena, new Rng(seed), [z], 'walk', () => sim.fighters);
  brain.dir = dir;
  brain.laneZ = z;
  return { f, brain };
}
function run(sim: Simulation, people: { f: Fighter; brain: CivilianBrain }[], frames: number, each?: (i: number) => void): void {
  for (let i = 0; i < frames; i++) {
    const cmds = new Map<number, ReturnType<CivilianBrain['think']>>();
    for (const p of people) cmds.set(p.f.id, p.brain.think(sim.frame));
    sim.step(cmds);
    each?.(i);
  }
}

console.log('Pedestrians');

test('two people walking straight at each other pass without stopping, turning back or touching', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { sim, arena } = street();
    const a = walker(sim, arena, -4, 0, 1, seed);
    const b = walker(sim, arena, 4, 0, -1, seed + 50);
    let closest = 9;
    run(sim, [a, b], 60 * 14, () => {
      closest = Math.min(closest, Math.hypot(a.f.pos.x - b.f.pos.x, a.f.pos.z - b.f.pos.z));
    });
    assert(a.brain.dir === 1 && b.brain.dir === -1, `seed ${seed}: somebody turned back`);
    assert(a.f.pos.x > 3 && b.f.pos.x < -3, `seed ${seed}: they did not get past (a ${a.f.pos.x.toFixed(1)}, b ${b.f.pos.x.toFixed(1)})`);
    assert(closest > 0.38, `seed ${seed}: they brushed through each other (${closest.toFixed(2)} m)`);
  }
});

test('a quicker walker overtakes a slower one and does not weave', () => {
  const { sim, arena } = street();
  const slow = walker(sim, arena, 0, 0, 1, 3, 0.35);
  const quick = walker(sim, arena, -3, 0, 1, 4, 0.75);
  let changes = 0;
  let lastSign = 0;
  run(sim, [slow, quick], 60 * 16, () => {
    const s = Math.sign(Math.round(quick.f.vel.z * 10));
    if (s !== 0 && s !== lastSign) {
      changes++;
      lastSign = s;
    }
  });
  assert(quick.f.pos.x > slow.f.pos.x + 0.5, `never got past (quick ${quick.f.pos.x.toFixed(1)}, slow ${slow.f.pos.x.toFixed(1)})`);
  assert(changes <= 3, `wove from side to side ${changes} times`);
});

test('with one side walled off, they go round on the open side', () => {
  const { sim, arena } = street();
  const stander = walker(sim, arena, 0, 1.6, 1, 9);
  const mover = walker(sim, arena, -4, 1.6, 1, 10);
  run(sim, [mover], 60 * 14, () => {
    stander.f.pos.x = 0;
    stander.f.pos.z = 1.6;
  });
  assert(mover.f.pos.x > 2, `stuck behind someone standing by the kerb (${mover.f.pos.x.toFixed(1)})`);
  assert(mover.brain.dir === 1, 'turned back when there was room to pass');
});

test('boxed in by scenery and a person, they find another line across the pavement', () => {
  // A skip fills the wall side; someone stands in the gap by the kerb.
  const { sim, arena } = street([{ minX: -0.8, maxX: 0.8, minZ: -2, maxZ: 0.2 }]);
  const stander = walker(sim, arena, 0, 0.75, 1, 11);
  const mover = walker(sim, arena, -4, 0.75, 1, 12);
  run(sim, [mover], 60 * 20, () => {
    stander.f.pos.x = 0;
    stander.f.pos.z = 0.75;
  });
  assert(mover.f.pos.x > 2, `never found the way round (${mover.f.pos.x.toFixed(1)}, ${mover.f.pos.z.toFixed(1)})`);
});

test('a fight makes people react, and not all in the same way', () => {
  const { sim, arena } = street();
  const crowd = Array.from({ length: 24 }, (_, i) => walker(sim, arena, -9 + i * 0.8, -1.5 + (i % 4), i % 2 ? 1 : -1, 100 + i));
  for (const c of crowd) c.brain.react(0, sim.frame);
  const acts = new Set(crowd.map((c) => c.brain.activity));
  assert(acts.has('flee') && acts.has('watch') && acts.has('walk'), `only saw: ${[...acts].join(', ')}`);
  run(sim, crowd, 60 * 6);
  for (const c of crowd) {
    const d = Math.abs(c.f.pos.x);
    if (c.brain.activity === 'watch') assert(d >= 4.3, `a watcher stood ${d.toFixed(1)} m from the fight`);
    if (c.brain.activity === 'watch') assert(c.f.facing === (c.f.pos.x > 0 ? -1 : 1), 'a watcher was not looking at the fight');
    if (c.brain.activity === 'flee') assert(d > 5, `someone fleeing was still ${d.toFixed(1)} m away after six seconds`);
  }
  // Once it has been quiet a while, everyone goes back to their day.
  for (const c of crowd) c.brain.calm(sim.frame + 600);
  assert(crowd.every((c) => c.brain.activity === 'walk' || c.brain.activity === 'wait'), 'someone stayed frightened after it was over');
});

test('people far from the trouble take no notice', () => {
  const { sim, arena } = street();
  const far = walker(sim, arena, 18, 0, 1, 7);
  far.brain.react(0, sim.frame);
  assert(far.brain.activity === 'walk', 'someone 18 m away reacted');
});

test('on real streets: little stalling, few about-turns, nobody walking through anybody', () => {
  const m = measure(['high_street', 'city', 'market', 'estate', 'mall'], [1, 2], 45);
  assert(m.civMinutes > 30, 'not enough pedestrians to measure');
  assert(m.stallPerMin < 1.0, `stalled ${m.stallPerMin.toFixed(2)} s per pedestrian-minute`);
  assert(m.turnsPerMin < 1.8, `${m.turnsPerMin.toFixed(2)} about-turns per pedestrian-minute`);
  assert(m.overlapPerMin < 0.05, `overlapping ${m.overlapPerMin.toFixed(2)} s per pedestrian-minute`);
  assert(m.metresPerMin > 36, `only ${m.metresPerMin.toFixed(1)} m walked per pedestrian-minute`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
