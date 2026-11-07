/** Stage 3 tests: styles, parry/counter, dodges, grappling, finishers, AI. */
import { ARCHETYPE_IDS } from '../src/ai/archetypes';
import * as GrappleModule from '../src/combat/Grapple';
import { SIM_HZ } from '../src/core/constants';
import { Simulation } from '../src/core/Simulation';
import { TrainingMode } from '../src/core/TrainingMode';
import { STYLES } from '../src/data/styles';
import { Fighter } from '../src/fighter/Fighter';
import { emptyCommand, type CommandFrame, type PressButton } from '../src/input/Commands';
import { defaultAttributes } from '../src/stats/Stats';
import type { StyleData } from '../src/styles/StyleData';
import { createTrainingArena } from '../src/world/Arena';

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

function setup(styleA: StyleData = STYLES.street, styleB: StyleData = STYLES.street, gap = 1.0, seed = 3) {
  const sim = new Simulation(createTrainingArena(), seed);
  const a = sim.add(new Fighter({ id: 1, name: 'A', team: 'player', attributes: { ...defaultAttributes(5), technique: 0 }, style: styleA, x: 0 }));
  const b = sim.add(new Fighter({ id: 2, name: 'B', team: 'enemy', attributes: { ...defaultAttributes(5), technique: 0 }, style: styleB, x: gap }));
  b.facing = -1;
  const events: string[] = [];
  for (const e of ['hit:landed', 'hit:blocked', 'hit:parried', 'grapple:start', 'grapple:end', 'grapple:escape', 'grapple:sprawl', 'grapple:throw', 'grapple:takedown', 'submission', 'fighter:finished', 'fighter:ko', 'fighter:knockdown', 'fighter:sweep', 'style:swapped'] as const) {
    sim.bus.on(e, () => events.push(e));
  }
  return { sim, a, b, events };
}

type Script = (f: number) => Partial<CommandFrame> & { press?: PressButton[] };
function run(sim: Simulation, frames: number, sa: Script = () => ({}), sb: Script = () => ({})): void {
  for (let i = 0; i < frames; i++) {
    const m = new Map<number, CommandFrame>();
    for (const [id, s] of [[1, sa], [2, sb]] as const) {
      const c = emptyCommand();
      const o = s(i);
      if (o.moveX !== undefined) c.moveX = o.moveX;
      if (o.moveZ !== undefined) c.moveZ = o.moveZ;
      if (o.block) c.block = true;
      if (o.special) c.special = true;
      for (const p of o.press ?? []) c.pressed[p] = true;
      m.set(id, c);
    }
    sim.step(m);
  }
}
const at = (frame: number, ...press: PressButton[]): Script => (f) => (f === frame ? { press } : {});

console.log('Styles');

test('every style’s moves, combo links, specials and grapple moves exist', () => {
  for (const s of Object.values(STYLES)) {
    const ids = [
      ...Object.values(s.starters), ...Object.values(s.specials), s.clinch.strike, s.clinch.throw, s.clinch.power,
      s.getupAttack, s.finisher, `${s.id}_grab`, ...(s.ground ? [s.ground.strike, s.ground.submission] : []),
    ];
    for (const id of ids) assert(s.moves[id!], `${s.id}: missing ${id}`);
    for (const m of Object.values(s.moves)) {
      for (const n of Object.values(m.next)) assert(s.moves[n!], `${s.id}: ${m.id} links to missing ${n}`);
      assert(m.style === s.id, `${m.id} style tag`);
    }
  }
});

test('boxing has no kicks: kick buttons throw punches', () => {
  const b = STYLES.boxing;
  for (const btn of ['lk', 'hk'] as const) {
    const m = b.moves[b.starters[btn]];
    assert(m.limb !== 'leadFoot' && m.limb !== 'rearFoot', `${btn} is ${m.name}`);
  }
});

test('stance swap changes style and costs stamina', () => {
  const sim = new Simulation(createTrainingArena(), 1);
  const f = sim.add(new Fighter({ id: 1, name: 'A', team: 'player', attributes: defaultAttributes(5), style: STYLES.muay_thai, secondaryStyle: STYLES.boxing }));
  const st = f.vitals.stamina;
  run(sim, 2, at(0, 'swap'));
  assert(f.style.id === 'boxing', `style ${f.style.id}`);
  assert(f.vitals.stamina < st, 'stamina spent');
  run(sim, 2, at(0, 'swap'));
  assert(f.style.id === 'boxing', 'cooldown stops instant swap back');
});

console.log('Defence');

test('parry: block pressed just before impact negates the hit and opens a counter', () => {
  const { sim, a, b, events } = setup();
  // A's haymaker: 14 startup / 1.075 speed = 13 frames. B presses block at frame 9.
  run(sim, 40, at(0, 'hp'), (f) => (f >= 9 && f < 30 ? { block: true } : {}));
  assert(events.includes('hit:parried'), `events ${events.join(',')}`);
  assert(!events.includes('hit:landed') && b.vitals.health === b.vitals.maxHealth, 'no damage');
});

test('a hit inside the counter window is a counter: 1.5x damage and a stagger', () => {
  const { sim, a, b } = setup();
  let counter = false;
  let dmg = 0;
  sim.bus.on('hit:landed', (h) => {
    if (h.attacker === b) {
      counter = h.counter;
      dmg = h.damage;
    }
  });
  run(sim, 16, at(0, 'hp'), (f) => (f >= 9 && f < 12 ? { block: true } : {}));
  run(sim, 30, () => ({}), at(2, 'lp'));
  assert(counter, 'counter flagged');
  assert(a.state === 'stagger' || a.state === 'idle', `state ${a.state}`);
  assert(dmg > 5 * 1.15 * (1 - 5 / 45) * 1.4, `damage ${dmg}`);
});

test('holding block from early does not parry', () => {
  const { sim, events } = setup();
  run(sim, 40, at(0, 'hp'), () => ({ block: true }));
  assert(events.includes('hit:blocked') && !events.includes('hit:parried'), events.join(','));
});

test('sidestep into the screen dodges a jab', () => {
  const { sim, events } = setup();
  run(sim, 30, at(0, 'lp'), (f) => (f === 1 ? { press: ['dodge'], moveZ: -1 } : {}));
  assert(!events.includes('hit:landed'), events.join(','));
});

test('boxing slip dodges in place', () => {
  const { sim, b, events } = setup(STYLES.street, STYLES.boxing);
  const x = b.pos.x;
  run(sim, 30, at(0, 'lp'), at(2, 'dodge'));
  assert(!events.includes('hit:landed'), events.join(','));
  assert(Math.abs(b.pos.x - x) < 0.3, `moved ${b.pos.x - x}`);
});

test('kickboxing check: blocked kicks do no chip damage', () => {
  const { sim, b, events } = setup(STYLES.street, STYLES.kickboxing, 1.2);
  run(sim, 40, at(0, 'lk'), () => ({ block: true }));
  assert(events.includes('hit:blocked'), events.join(','));
  assert(b.vitals.health === b.vitals.maxHealth, `chip ${b.vitals.maxHealth - b.vitals.health}`);
});

test('leg kicks slow the target', () => {
  const { sim, b } = setup(STYLES.muay_thai, STYLES.street, 1.0);
  const before = b.stats.moveSpeedMultiplier;
  run(sim, 30, at(0, 'lk'));
  assert(b.stats.moveSpeedMultiplier < before, `speed ${b.stats.moveSpeedMultiplier}`);
});

test('body shots drain stamina', () => {
  const { sim, b } = setup(STYLES.boxing, STYLES.street, 0.9);
  run(sim, 25, at(0, 'lk'));
  assert(b.vitals.stamina < b.vitals.maxStamina - 9, `stamina ${b.vitals.stamina}`);
});

test('get-up attack: pressing an attack while down gets up swinging', () => {
  const { sim, b } = setup();
  b.enterHitReaction('knockdown', 0);
  let started = '';
  sim.bus.on('move:started', ({ fighter, move }) => {
    if (fighter === b) started = move.id;
  });
  run(sim, 80, () => ({}), at(20, 'lk'));
  assert(started === 'street_getup_kick', `started ${started}`);
});

test('BJJ sweep from the floor knocks the opponent down', () => {
  const { sim, b, events } = setup(STYLES.street, STYLES.bjj, 0.8);
  b.enterHitReaction('knockdown', 0);
  run(sim, 30, () => ({}), at(20, 'grab'));
  assert(events.includes('fighter:sweep'), events.join(','));
});

console.log('Grappling');

test('grab into clinch, clinch strike lands, throw ends it with a knockdown', () => {
  const { sim, a, b, events } = setup(STYLES.street, STYLES.street, 0.7);
  run(sim, 20, at(0, 'grab'));
  assert(a.grapple && b.grapple && b.state === 'clinched', `states ${a.state} ${b.state}`);
  const hp = b.vitals.health;
  run(sim, 30, at(0, 'lp'));
  assert(b.vitals.health < hp, 'clinch strike hurt');
  run(sim, 40, at(0, 'lk'));
  assert(events.includes('grapple:throw') && !a.grapple && !b.grapple, events.join(','));
  assert(b.state === 'knockdown' || b.state === 'getup', `b ${b.state}`);
});

test('sprawl: a blocking wrestler can’t be grabbed', () => {
  const { sim, a, events } = setup(STYLES.street, STYLES.wrestling, 0.7);
  run(sim, 20, at(0, 'grab'), () => ({ block: true }));
  assert(events.includes('grapple:sprawl') && !a.grapple, events.join(','));
  assert(a.state === 'parried', `a ${a.state}`);
});

test('double-leg takes it to the ground; submission without defence does 35% damage', () => {
  const { sim, a, b, events } = setup(STYLES.wrestling, STYLES.street, 1.0);
  run(sim, 30, at(0, 'lk'));
  assert(a.state === 'ground_top' && b.state === 'ground_bottom', `${a.state} ${b.state}`);
  const max = b.vitals.maxHealth;
  run(sim, 200, at(0, 'hp'));
  assert(events.includes('submission'), events.join(','));
  assert(Math.abs(b.vitals.health - (max - max * 0.35)) < 2, `health ${b.vitals.health}`);
});

test('the held fighter can escape a clinch by trying (stamina contest)', () => {
  let escapes = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const { sim, a, events } = setup(STYLES.street, STYLES.street, 0.7, seed);
    run(sim, 15, at(0, 'grab'));
    assert(a.grapple, 'clinched');
    run(sim, 140, () => ({}), (f) => (f % 25 === 0 ? { press: ['grab'] } : {}));
    if (events.includes('grapple:escape')) escapes++;
  }
  assert(escapes >= 4, `escaped in ${escapes} of 8 fights`);
});

test('a stronger grappler is much harder to escape', () => {
  const { sim, a, b } = setup(STYLES.wrestling, STYLES.boxing, 0.7);
  run(sim, 15, at(0, 'grab'));
  assert(a.grapple, 'clinched');
  const { escapeChance } = GrappleModule;
  const vsWrestler = escapeChance(a, b, 'clinch');
  const { sim: sim2, a: a2, b: b2 } = setup(STYLES.boxing, STYLES.wrestling, 0.7);
  run(sim2, 15, at(0, 'grab'));
  const vsBoxer = escapeChance(a2, b2, 'clinch');
  assert(vsBoxer > vsWrestler + 0.2, `${vsBoxer.toFixed(2)} vs ${vsWrestler.toFixed(2)}`);
});

test('clinch times out if nothing happens', () => {
  const { sim, a } = setup(STYLES.street, STYLES.street, 0.7);
  run(sim, 15, at(0, 'grab'));
  run(sim, 200);
  assert(!a.grapple, 'released');
});

console.log('Finishers');

test('finisher on a staggered opponent below 15% health knocks them out', () => {
  const { sim, b, events } = setup(STYLES.street, STYLES.street, 0.9);
  b.vitals.health = b.vitals.maxHealth * 0.1;
  b.enterHitReaction('stagger', 40);
  run(sim, 40, (f) => (f === 1 ? { press: ['hp'], special: true } : {}));
  assert(events.includes('fighter:finished') && b.isKO, events.join(','));
});

test('no finisher above 15% health: Special + HP is the style special instead', () => {
  const { sim, b, events } = setup(STYLES.street, STYLES.street, 0.9);
  b.enterHitReaction('stagger', 40);
  run(sim, 40, (f) => (f === 1 ? { press: ['hp'], special: true } : {}));
  assert(!events.includes('fighter:finished') && !b.isKO, events.join(','));
});

console.log('AI');

test('group fight: never more than two enemies attacking at once', () => {
  const mode = new TrainingMode();
  mode.setMode('group');
  assert(mode.enemies.length === 3, 'three enemies');
  let max = 0;
  for (let i = 0; i < 20 * SIM_HZ; i++) {
    mode.step(emptyCommand());
    max = Math.max(max, mode.tokens.count(mode.player));
  }
  assert(max <= 2 && max >= 1, `max token holders ${max}`);
});

test('the boss goes berserk below half health', () => {
  const mode = new TrainingMode();
  mode.setArchetype('boss');
  mode.setMode('spar');
  const boss = mode.enemies[0];
  boss.vitals.health = boss.vitals.maxHealth * 0.4;
  mode.step(emptyCommand());
  assert(mode.brainOf(boss)?.enraged, 'enraged');
  assert(boss.stats.derived('damageMult') > 1.1, 'damage buff');
});

test('every archetype fights for 40 seconds without errors and lands hits', () => {
  for (const id of ARCHETYPE_IDS) {
    const mode = new TrainingMode();
    mode.setArchetype(id);
    mode.setMode('spar');
    let hits = 0;
    mode.sim.bus.on('hit:landed', (h) => {
      if (h.attacker.team === 'enemy') hits++;
    });
    for (let i = 0; i < 40 * SIM_HZ; i++) {
      const c = emptyCommand();
      const e = mode.enemies[0];
      c.moveX = Math.sign(e.pos.x - mode.player.pos.x) * (i % 120 < 80 ? 1 : 0);
      if (i % 37 === 0) c.pressed.lp = true;
      if (i % 91 === 0) c.pressed.hk = true;
      if (i % 53 === 0) c.pressed.grab = true;
      mode.step(c);
      for (const f of mode.sim.fighters) {
        if (![f.pos.x, f.pos.z, f.vitals.health, f.vitals.stamina].every(Number.isFinite)) throw new Error(`${id}: NaN`);
      }
    }
    assert(hits > 0, `${id} never landed a hit`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
