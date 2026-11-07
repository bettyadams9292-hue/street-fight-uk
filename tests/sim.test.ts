/**
 * Headless tests for the Stage 1 combat and stats simulation.
 * Run with: npm test
 */
import { Simulation } from '../src/core/Simulation';
import { SIM_HZ } from '../src/core/constants';
import type { HitInfo } from '../src/core/GameEvents';
import { STREET_MOVES, STREET_STARTERS } from '../src/data/moves/street';
import { Fighter } from '../src/fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { defaultAttributes, Stats } from '../src/stats/Stats';
import { computeDamage, repetitionMultiplier } from '../src/combat/Damage';
import { createTrainingArena } from '../src/world/Arena';
import { TrainingMode } from '../src/core/TrainingMode';

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
function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

const moveSet = { moves: STREET_MOVES, starters: STREET_STARTERS };

function setup(gap = 1.0, dz = 0, seed = 7) {
  const sim = new Simulation(createTrainingArena(), seed);
  const a = sim.add(new Fighter({ id: 1, name: 'A', team: 'player', attributes: defaultAttributes(5), moveSet, x: 0, z: 0, appearance: undefined }));
  const b = sim.add(new Fighter({ id: 2, name: 'B', team: 'enemy', attributes: { ...defaultAttributes(5), technique: 0 }, moveSet, x: gap, z: dz, appearance: undefined }));
  a.stats.base.technique = 0; // no random clean hits in tests
  const hits: HitInfo[] = [];
  const blocks: HitInfo[] = [];
  sim.bus.on('hit:landed', (h) => hits.push(h));
  sim.bus.on('hit:blocked', (h) => blocks.push(h));
  return { sim, a, b, hits, blocks };
}

function run(sim: Simulation, frames: number, cmdA: (f: number) => CommandFrame = () => emptyCommand(), cmdB: (f: number) => CommandFrame = () => emptyCommand()): void {
  for (let i = 0; i < frames; i++) {
    const m = new Map<number, CommandFrame>();
    m.set(1, cmdA(i));
    m.set(2, cmdB(i));
    sim.step(m);
  }
}

function press(button: 'lp' | 'hp' | 'lk' | 'hk' | 'jump', atFrames: number[]): (f: number) => CommandFrame {
  return (f) => {
    const c = emptyCommand();
    if (atFrames.includes(f)) c.pressed[button] = true;
    return c;
  };
}

function holdBlock(): CommandFrame {
  const c = emptyCommand();
  c.block = true;
  return c;
}

console.log('Stats');

test('derived stats follow the design formulas', () => {
  const s = new Stats(defaultAttributes(5), 1);
  assert(s.maxHealth === 80 + 20 + 20 + 5, `maxHealth ${s.maxHealth}`);
  assert(s.maxStamina === 140, `maxStamina ${s.maxStamina}`);
  assert(near(s.damageMultiplier, 1.15), `damageMult ${s.damageMultiplier}`);
  assert(near(s.defenceReduction, 5 / 45), `defRed ${s.defenceReduction}`);
  assert(near(s.attackSpeed, 1.075), `attackSpeed ${s.attackSpeed}`);
});

test('attack speed is capped at +25%', () => {
  const s = new Stats({ ...defaultAttributes(5), speed: 50 });
  assert(near(s.attackSpeed, 1.25), `attackSpeed ${s.attackSpeed}`);
});

test('modifiers stack and remove cleanly', () => {
  const s = new Stats(defaultAttributes(5));
  s.addModifier({ id: 'wraps', source: 'item', attribute: 'strength', add: 3 });
  s.addModifier({ id: 'buff', source: 'buff', stat: 'damageMult', mul: 1.1 });
  assert(s.attr('strength') === 8, 'strength with wraps');
  assert(near(s.damageMultiplier, (1 + 0.24) * 1.1), `dmg ${s.damageMultiplier}`);
  s.removeModifiersFrom('item');
  assert(s.attr('strength') === 5, 'wraps removed');
});

test('repetition multiplier decays to a floor of 0.6', () => {
  assert(repetitionMultiplier(1) === 1, 'first use');
  assert(near(repetitionMultiplier(2), 0.9), 'second use');
  assert(repetitionMultiplier(20) === 0.6, 'floor');
});

test('defence reduces damage with diminishing returns', () => {
  const atk = new Stats(defaultAttributes(5));
  const soft = new Stats({ ...defaultAttributes(5), defence: 0 });
  const hard = new Stats({ ...defaultAttributes(5), defence: 40 });
  const dSoft = computeDamage(10, atk, soft);
  const dHard = computeDamage(10, atk, hard);
  assert(near(dSoft, 11.5), `soft ${dSoft}`);
  assert(near(dHard, 5.75), `hard ${dHard}`);
});

console.log('Combat');

test('a jab in range hits during its active frames', () => {
  const { sim, b, hits } = setup(1.0);
  const hp0 = b.vitals.health;
  run(sim, 30, press('lp', [0]));
  assert(hits.length === 1, `expected 1 hit, got ${hits.length}`);
  assert(b.vitals.health < hp0, 'health dropped');
  assert(hits[0].move.id === 'street_jab', 'was a jab');
});

test('a jab out of range whiffs', () => {
  const { sim, hits } = setup(2.5);
  run(sim, 30, press('lp', [0]));
  assert(hits.length === 0, 'should miss');
});

test('sidestepping out of the depth tolerance avoids the hit', () => {
  const { sim, hits } = setup(1.0, 0.9);
  run(sim, 30, press('lp', [0]));
  assert(hits.length === 0, 'should miss on depth');
});

test('each swing hits a target only once', () => {
  const { sim, hits } = setup(1.0);
  run(sim, 40, press('hp', [0]));
  assert(hits.length === 1, `got ${hits.length}`);
});

test('jab chains into jab, hook and haymaker through the combo graph', () => {
  const { sim, hits } = setup(0.9);
  // Mash light punch, then heavy; buffering should carry the chain.
  const presses = new Map<number, 'lp' | 'hp'>([[0, 'lp'], [8, 'lp'], [18, 'lp'], [38, 'hp']]);
  run(sim, 120, (f) => {
    const c = emptyCommand();
    const b = presses.get(f);
    if (b) c.pressed[b] = true;
    return c;
  });
  const ids = hits.map((h) => h.move.id);
  assert(ids.join(',') === 'street_jab,street_jab_2,street_hook,street_haymaker', `got ${ids.join(',')}`);
  assert(hits[3].comboHits === 4, `combo ${hits[3].comboHits}`);
});

test('attacks cost stamina and stamina recovers after a delay', () => {
  const { sim, a } = setup(3);
  const max = a.vitals.maxStamina;
  run(sim, 1, press('hp', [0]));
  const afterSwing = a.vitals.stamina;
  assert(near(afterSwing, max - 16), `stamina ${afterSwing}`);
  run(sim, 30);
  assert(near(a.vitals.stamina, afterSwing), 'no regen during the attack / delay');
  run(sim, 4 * SIM_HZ);
  assert(near(a.vitals.stamina, max), 'regenerated to full');
});

test('blocking takes chip damage, drains stamina and causes blockstun', () => {
  const { sim, b, blocks } = setup(1.0);
  b.facing = -1;
  const hp0 = b.vitals.health;
  const st0 = b.vitals.stamina;
  run(sim, 40, press('hp', [0]), holdBlock);
  assert(blocks.length === 1, `blocks ${blocks.length}`);
  assert(b.vitals.health < hp0 && b.vitals.health > hp0 - 5, `chip ${hp0 - b.vitals.health}`);
  assert(b.vitals.stamina < st0, 'stamina drained');
  assert(b.vitals.recoverable > 0, 'chip is recoverable');
});

test('guard breaks when stamina runs out while blocking', () => {
  const { sim, b, blocks } = setup(1.0);
  let broken = false;
  sim.bus.on('guard:broken', () => (broken = true));
  b.vitals.stamina = 1;
  run(sim, 40, press('hp', [0]), holdBlock);
  assert(blocks.length === 1, 'blocked');
  assert(broken, 'guard broke');
  assert(b.state === 'guardbreak' || b.state === 'idle', `state ${b.state}`);
});

test('fatigue: tired below 30%, exhausted below 10%, clears at 25%', () => {
  const { a } = setup();
  const max = a.vitals.maxStamina;
  a.vitals.spendStamina(max * 0.75, 0);
  assert(a.vitals.fatigue === 'tired', `got ${a.vitals.fatigue}`);
  assert(a.stats.hasTag('state.tired'), 'tired tag');
  a.vitals.spendStamina(max * 0.2, 0);
  assert(a.vitals.fatigue === 'exhausted', `got ${a.vitals.fatigue}`);
  assert(near(a.stats.damageMultiplier, 1.15 * 0.7), `dmg ${a.stats.damageMultiplier}`);
  a.vitals.restoreStamina(max * 0.12); // ~17% -> still exhausted
  assert(a.vitals.fatigue === 'exhausted', 'still exhausted below 25%');
  a.vitals.restoreStamina(max * 0.1); // ~27%
  assert(a.vitals.fatigue === 'tired', `got ${a.vitals.fatigue}`);
});

test('exhausted fighters cannot throw heavies', () => {
  const { sim, a, hits } = setup(1.0);
  let refused = false;
  sim.bus.on('action:refused', () => (refused = true));
  a.vitals.spendStamina(a.vitals.maxStamina, 0);
  run(sim, 40, press('hp', [0]));
  assert(refused, 'refused');
  assert(hits.length === 0, 'no hit');
});

test('heavy roundhouse on a poise-broken target knocks down; fighter can get up', () => {
  const { sim, b } = setup(1.1);
  let knocked = false;
  sim.bus.on('fighter:knockdown', () => (knocked = true));
  b.poise = 1;
  run(sim, 40, press('hk', [0]));
  assert(knocked, 'knocked down');
  run(sim, 120);
  assert(b.state === 'idle', `back up, state ${b.state}`);
});

test('reaching 0 health knocks the fighter out', () => {
  const { sim, b } = setup(1.0);
  let ko = false;
  sim.bus.on('fighter:ko', () => (ko = true));
  b.vitals.health = 1;
  run(sim, 30, press('lp', [0]));
  assert(ko && b.state === 'ko', `ko ${ko} state ${b.state}`);
});

test('fighters cannot walk through each other', () => {
  const { sim, a, b } = setup(1.5);
  run(sim, 120, () => ({ ...emptyCommand(), moveX: 1 }));
  assert(b.pos.x - a.pos.x >= 0.59, `gap ${b.pos.x - a.pos.x}`);
});

test('jump leaves the ground and lands back in idle', () => {
  const { sim, a } = setup(4);
  run(sim, 10, press('jump', [0]));
  assert(a.pos.y > 0.3, `height ${a.pos.y}`);
  run(sim, 60);
  assert(a.pos.y === 0 && a.state === 'idle', `landed ${a.pos.y} ${a.state}`);
});

test('out-of-combat health regenerates to 50% only', () => {
  const { sim, a } = setup(5);
  a.vitals.health = 10;
  run(sim, 60 * SIM_HZ);
  assert(near(a.vitals.health, a.vitals.maxHealth * 0.5, 0.01), `health ${a.vitals.health}`);
});


test('front kick chains into roundhouse as a true combo', () => {
  const { sim, hits } = setup(1.2);
  run(sim, 90, (f) => {
    const c = emptyCommand();
    if (f === 0) c.pressed.lk = true;
    if (f === 12) c.pressed.hk = true;
    return c;
  });
  const ids = hits.map((h) => h.move.id).join(',');
  assert(ids === 'street_front_kick,street_roundhouse', `got ${ids}`);
  assert(hits[1].comboHits === 2, `combo ${hits[1].comboHits}`);
});

console.log('Training mode');

test('sparring partner closes in and attacks using the same commands as the player', () => {
  const mode = new TrainingMode();
  mode.setDummyMode('spar');
  let dummyAttacks = 0;
  mode.sim.bus.on('move:started', ({ fighter }) => {
    if (fighter === mode.dummy) dummyAttacks++;
  });
  for (let i = 0; i < 10 * SIM_HZ; i++) mode.step(emptyCommand());
  assert(dummyAttacks > 0, 'dummy never attacked');
  assert(mode.player.vitals.health < mode.player.vitals.maxHealth || mode.player.vitals.recoverable >= 0, 'player state valid');
});

test('a knocked-out fighter gets back up after 3 seconds in training', () => {
  const mode = new TrainingMode();
  mode.dummy.vitals.health = 1;
  mode.dummy.pos.x = mode.player.pos.x + 1;
  let ko = false;
  mode.sim.bus.on('fighter:ko', () => (ko = true));
  for (let i = 0; i < 30; i++) {
    const c = emptyCommand();
    if (i === 0) c.pressed.lp = true;
    mode.step(c);
  }
  assert(ko, 'dummy KO');
  for (let i = 0; i < 3 * SIM_HZ + 5; i++) mode.step(emptyCommand());
  assert(mode.dummy.state === 'idle' && mode.dummy.vitals.health === mode.dummy.vitals.maxHealth, `state ${mode.dummy.state}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
