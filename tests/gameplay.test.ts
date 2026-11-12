/**
 * Gameplay plan stages 1–3 (docs/GAMEPLAY_PLAN.md): enemy defence you can read,
 * careful play beats mashing, and crowds that move instead of queueing.
 */
import { ARCHETYPES, type Archetype } from '../src/ai/archetypes';
import { AttackTokens } from '../src/ai/AttackTokens';
import { FighterAI } from '../src/ai/FighterAI';
import { comboStun } from '../src/combat/CombatSystem';
import { BODY_RADIUS } from '../src/core/constants';
import { STYLES } from '../src/data/styles';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { audit } from '../tools/fight_audit';
import { scene, type Scene } from '../tools/sheet_sim';

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
const press = (b: string): CommandFrame => {
  const c = emptyCommand();
  (c.pressed as Record<string, boolean>)[b] = true;
  return c;
};

/** A player (A, pressing buttons) against an AI enemy (B). */
function duel(styleA: string, gap: number, brainOf: Partial<Archetype>, seed = 3) {
  const s = scene(styleA, 'street', gap);
  const brain = new FighterAI(s.b, { ...ARCHETYPES.thug, ...brainOf } as Archetype, s.sim.rng, new AttackTokens(2));
  for (let i = 0; i < seed; i++) s.sim.rng.next();
  const step = (ca?: CommandFrame) => s.step(ca, brain.think(s.sim.frame + 1));
  for (let i = 0; i < 40; i++) step();
  return { s, brain, step };
}
function count(s: Scene) {
  const c = { blocked: 0, parried: 0, landed: 0, tells: [] as number[], parryFrames: [] as number[], enemyHits: 0 };
  s.sim.bus.on('hit:blocked', (h) => h.attacker === s.a && c.blocked++);
  s.sim.bus.on('hit:parried', (h) => {
    if (h.attacker === s.a) {
      c.parried++;
      c.parryFrames.push(s.sim.frame);
    }
  });
  s.sim.bus.on('hit:landed', (h) => (h.attacker === s.a ? c.landed++ : c.enemyHits++));
  s.sim.bus.on('fighter:tell', (t) => t.fighter === s.b && c.tells.push(s.sim.frame));
  return c;
}

console.log('Stage 1: enemy defence you can read');

test('an enemy that means to block, blocks: a late guard is never a free parry', () => {
  let blocked = 0;
  let parried = 0;
  for (let seed = 0; seed < 6; seed++) {
    const { s, step } = duel('street', 0.95, { blockChance: 1, parryChance: 0, dodgeChance: 0, reactionFrames: 6, aggression: 0 }, seed);
    const c = count(s);
    for (let n = 0; n < 6; n++) {
      step(press(n % 2 ? 'hp' : 'lp'));
      for (let i = 0; i < 50; i++) step();
    }
    blocked += c.blocked;
    parried += c.parried;
  }
  assert(blocked >= 20, `only ${blocked} of 36 attacks were blocked`);
  assert(parried === 0, `${parried} attacks were parried by an enemy with no parry in it`);
});

test('enemies only parry slow, readable attacks, and always show the tell in time to see it', () => {
  let jabParries = 0;
  let heavyParries = 0;
  let late = 0;
  for (let seed = 0; seed < 6; seed++) {
    const { s, step } = duel('street', 0.95, { blockChance: 0, parryChance: 1, dodgeChance: 0, reactionFrames: 6, aggression: 0 }, seed);
    const c = count(s);
    for (let n = 0; n < 4; n++) {
      step(press('lp'));
      for (let i = 0; i < 50; i++) step();
    }
    jabParries += c.parried;
    const before = c.parried;
    for (let n = 0; n < 4; n++) {
      step(press('hp'));
      for (let i = 0; i < 70; i++) step();
    }
    heavyParries += c.parried - before;
    for (const p of c.parryFrames) {
      const tell = c.tells.filter((t) => t <= p).pop();
      if (tell === undefined || p - tell < 8) late++;
    }
  }
  assert(jabParries === 0, `${jabParries} jabs were parried`);
  assert(heavyParries >= 12, `a parry-minded enemy only parried ${heavyParries} of 24 haymakers`);
  assert(late === 0, `${late} parries came without a tell at least 8 frames before`);
});

test('the next hit of a string is never parried, only a fresh swing', () => {
  let parried = 0;
  for (let seed = 0; seed < 6; seed++) {
    const { s, step } = duel('street', 0.9, { blockChance: 0, parryChance: 1, dodgeChance: 0, reactionFrames: 4, aggression: 0 }, seed);
    const c = count(s);
    for (const b of ['lp', 'lp', 'hp']) {
      step(press(b));
      for (let i = 0; i < 9; i++) step();
    }
    for (let i = 0; i < 60; i++) step();
    // The haymaker at the end of the string is a chain, not a fresh swing.
    parried += c.parried;
  }
  assert(parried === 0, `${parried} strings were parried part-way`);
});

console.log('Stage 2: skill pays');

test('a whiffed heavy up close gets punished by a trained enemy', () => {
  let punished = 0;
  for (let seed = 0; seed < 8; seed++) {
    const { s, step } = duel('street', 1.6, { aggression: 0, blockChance: 0, parryChance: 0, dodgeChance: 0, reactionFrames: 8, attributes: { ...ARCHETYPES.thug.attributes, technique: 9 } }, seed);
    const c = count(s);
    const hay = STYLES.street.moves[STYLES.street.starters.hp];
    // Held just past the haymaker's reach until it has missed.
    const hold = () => (s.b.pos.x = s.a.pos.x + hay.reach + BODY_RADIUS * 2 + 0.1);
    hold();
    step(press('hp'));
    for (let i = 0; i < hay.startup + hay.active; i++) {
      hold();
      step();
    }
    for (let i = 0; i < 50; i++) step();
    if (c.enemyHits > 0) punished++;
  }
  assert(punished >= 5, `only ${punished} of 8 whiffed haymakers were punished`);
});

test('combo stun shrinks after the third hit, down to 60%', () => {
  assert(comboStun(20, 1) === 20 && comboStun(20, 3) === 20, 'short combos keep full stun');
  assert(comboStun(20, 4) < 20 && comboStun(20, 5) < comboStun(20, 4), 'longer combos stun less each hit');
  assert(comboStun(20, 30) === 12, `floor is 60% (${comboStun(20, 30)})`);
});

test('against trained enemies, careful play clearly beats mashing', () => {
  // Early thugs can be mashed (that's fine for an opening area); by the City they make you pay for it.
  const careful = audit('city', 6, 'decent', 8);
  const masher = audit('city', 6, 'masher', 8);
  assert(careful.won >= masher.won + 2, `careful won ${careful.won} of 8, masher ${masher.won}`);
  assert(careful.hpLeft > masher.hpLeft, `careful kept ${(careful.hpLeft * 100).toFixed(0)}% health, masher ${(masher.hpLeft * 100).toFixed(0)}%`);
});

console.log('Stage 3: crowds that feel alive');

test('enemies keep moving, put the player under pressure, and some go round the back', () => {
  const r = audit('alleys', 4, 'decent', 4);
  assert(r.enemyIdle < 0.25, `enemies stood idle ${(r.enemyIdle * 100).toFixed(0)}% of the time`);
  assert(r.pressure > 0.25, `someone was attacking the player only ${(r.pressure * 100).toFixed(0)}% of the fight`);
  assert(r.doubled < 0.12, `two attacked at once ${(r.doubled * 100).toFixed(0)}% of the fight: a pile-on`);
});

test('jump-ins are rationed per target, and each one shouts first', () => {
  const t = new AttackTokens(2);
  const s = scene('street', 'street', 1);
  assert(t.jumpIn(s.a, 100), 'the first jump-in is allowed');
  assert(!t.jumpIn(s.a, 200), 'a second one inside four seconds is not');
  assert(t.jumpIn(s.a, 341), 'after four seconds another is allowed');
  assert(t.jumpIn(s.b, 200), 'the limit is per target');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
