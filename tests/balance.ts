/**
 * Balance report (not part of `npm test`): a bot plays each district's main
 * fights and boss at the progression a player would roughly have by then, over
 * many seeds. Run with `npx tsx tests/balance.ts`.
 */
import { ARCHETYPES, type Archetype } from '../src/ai/archetypes';
import { AttackTokens } from '../src/ai/AttackTokens';
import { FighterAI } from '../src/ai/FighterAI';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import type { GearId, UpgradeId } from '../src/progress/catalogue';
import { newSave, Progress, type AreaId } from '../src/progress/Progress';
import type { StyleId } from '../src/styles/StyleData';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';

interface Checkpoint {
  area: AreaId;
  level: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  style: StyleId;
  gear: GearId | null;
  moves: ('specials' | 'finishers')[];
  flags: string[];
}

/** Roughly where a player is when they reach each district's fights. */
const CHECKPOINTS: Checkpoint[] = [
  { area: 'estate', level: 1, upgrades: {}, style: 'street', gear: 'wraps', moves: [], flags: [] },
  { area: 'high_street', level: 3, upgrades: { health: 1 }, style: 'street', gear: 'wraps', moves: ['specials'], flags: [] },
  { area: 'alleys', level: 4, upgrades: { health: 1, power: 1 }, style: 'boxing', gear: 'wraps', moves: ['specials'], flags: ['boss_gaffer'] },
  { area: 'industrial', level: 4, upgrades: { health: 2, power: 1 }, style: 'boxing', gear: 'wraps', moves: ['specials', 'finishers'], flags: ['boss_gaffer'] },
  { area: 'subway', level: 5, upgrades: { health: 2, power: 1, toughness: 1 }, style: 'boxing', gear: 'steel_caps', moves: ['specials', 'finishers'], flags: ['boss_gaffer', 'boss_sully'] },
  { area: 'city', level: 6, upgrades: { health: 3, power: 2, toughness: 1 }, style: 'boxing', gear: 'mouthguard', moves: ['specials', 'finishers'], flags: ['boss_gaffer', 'boss_sully'] },
  { area: 'territory', level: 7, upgrades: { health: 3, power: 2, toughness: 2, stamina: 1 }, style: 'boxing', gear: 'leather_jacket', moves: ['specials', 'finishers'], flags: ['boss_gaffer', 'boss_sully', 'boss_ratcatcher'] },
];

/** How a decent player behaves; a "casual" one blocks and reads less. */
const PLAYERS: Record<'decent' | 'casual', Partial<Archetype>> = {
  decent: { aggression: 0.6, blockChance: 0.45, dodgeChance: 0.15, parryChance: 0.12, comboLength: 3, grabChance: 0.06, specialChance: 0.12, reactionFrames: 12, retreatsWhenTired: true },
  casual: { aggression: 0.7, blockChance: 0.25, dodgeChance: 0.08, parryChance: 0.03, comboLength: 2, grabChance: 0.05, specialChance: 0.05, reactionFrames: 20, retreatsWhenTired: false },
};

function progressFor(cp: Checkpoint): Progress {
  const alloc = emptyAllocation();
  alloc.strength = 3;
  alloc.endurance = 3;
  alloc.defence = 2;
  alloc.speed = 2;
  const c = createCharacter({ name: 'Bot', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: alloc });
  const p = new Progress(newSave(c));
  p.save.level = cp.level;
  for (const [k, v] of Object.entries(cp.upgrades)) p.save.upgrades[k as UpgradeId] = v!;
  p.save.styles.learned = ['street', cp.style];
  p.save.styles.primary = cp.style;
  p.save.equipped.gear = cp.gear;
  if (cp.gear && !p.save.gear.includes(cp.gear)) p.save.gear.push(cp.gear);
  p.save.moves = [...cp.moves];
  for (const f of cp.flags) p.set(f);
  return p;
}

interface Result {
  won: boolean;
  seconds: number;
  hpLeft: number;
}

function playEncounter(cp: Checkpoint, encId: string, who: keyof typeof PLAYERS, seed: number): Result {
  const p = progressFor(cp);
  const lvl = LEVELS[cp.area];
  const w = new World(lvl, p, { entry: lvl.entries[0].id, seed, difficulty: (process.env.DIFF as 'easy' | 'normal' | 'hard') ?? 'normal' });
  for (const e of w.encounters) if (e.def.id !== encId) e.status = 'cleared';
  if (process.env.TAKEN) w.player.stats.addModifier({ id: 'x_taken', source: 'balance', stat: 'damageTakenMult', mul: Number(process.env.TAKEN) });
  if (process.env.DEALT) w.player.stats.addModifier({ id: 'x_dealt', source: 'balance', stat: 'damageMult', mul: Number(process.env.DEALT) });
  const enc = w.encounters.find((e) => e.def.id === encId)!;
  w.player.pos.x = enc.def.triggerX - 0.6;
  w.player.pos.z = 0;
  // Step across the trigger.
  const brain = new FighterAI(w.player, { ...ARCHETYPES.thug, ...PLAYERS[who], id: 'rival', name: 'Bot' }, w.sim.rng, new AttackTokens(1), w.arena);
  if (process.env.WHY) {
    w.sim.bus.on('hit:landed', (h) => {
      if (h.target !== w.player) return;
      const k = `${h.attacker.name}:${h.move.name}`;
      WHY.set(k, (WHY.get(k) ?? 0) + h.damage);
    });
    w.sim.bus.on('submission', (e) => {
      if (e.held !== w.player) return;
      const k = `${e.holder.name}:SUBMISSION`;
      WHY.set(k, (WHY.get(k) ?? 0) + e.damage);
    });
  }
  let defeated = false;
  w.events.on('player:defeated', () => (defeated = true));
  let frames = 0;
  const LIMIT = 60 * 240;
  while (frames < LIMIT) {
    const cmd = frames < 20 ? { ...brain.think(w.sim.frame), moveX: 1 } : brain.think(w.sim.frame);
    w.step(cmd);
    frames++;
    if (enc.status === 'cleared') return { won: true, seconds: frames / 60, hpLeft: w.player.vitals.health / w.player.vitals.maxHealth };
    if (w.player.isKO || defeated) return { won: false, seconds: frames / 60, hpLeft: 0 };
  }
  return { won: false, seconds: frames / 60, hpLeft: w.player.vitals.health / w.player.vitals.maxHealth };
}

const WHY = new Map<string, number>();
process.on('exit', () => {
  if (!process.env.WHY) return;
  console.log('\nDamage taken by source:');
  for (const [k, v] of [...WHY].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k.padEnd(40)} ${Math.round(v)}`);
});
const RUNS = Number(process.env.RUNS ?? 12);
const only = process.argv[2];
console.log(`${'area/fight'.padEnd(28)} ${'who'.padEnd(7)} win%   avg s  hp left`);
for (const cp of CHECKPOINTS) {
  for (const enc of LEVELS[cp.area].encounters) {
    if (enc.optional) continue;
    if (only && enc.id !== only) continue;
    for (const who of ['decent', 'casual'] as const) {
      const rs: Result[] = [];
      for (let s = 0; s < RUNS; s++) rs.push(playEncounter(cp, enc.id, who, 1000 + s * 17));
      const wins = rs.filter((r) => r.won);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      console.log(
        `${`${cp.area}/${enc.id}${enc.boss ? ' (boss)' : ''}`.padEnd(28)} ${who.padEnd(7)} ${String(Math.round((wins.length / RUNS) * 100)).padStart(4)}%  ${avg(rs.map((r) => r.seconds)).toFixed(0).padStart(5)}  ${Math.round(avg(wins.map((r) => r.hpLeft)) * 100)}%`,
      );
    }
  }
}
