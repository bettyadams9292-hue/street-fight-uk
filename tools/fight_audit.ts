/**
 * Fight audit: a bot plays an area's first fight over several seeds. It reports
 * how the fight actually plays: how long it takes, how often each side blocks,
 * parries and lands hits, and how much of the time enemies stand idle or put
 * pressure on the player. See docs/GAMEPLAY_PLAN.md.
 *
 *   npx tsx tools/fight_audit.ts [area] [level] [decent|casual] [seeds]
 */
import { ARCHETYPES } from '../src/ai/archetypes';
import { AttackTokens } from '../src/ai/AttackTokens';
import { FighterAI } from '../src/ai/FighterAI';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import type { Fighter } from '../src/fighter/Fighter';
import { newSave, Progress, type AreaId } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';

const PLAYERS = {
  decent: { aggression: 0.6, blockChance: 0.45, dodgeChance: 0.15, parryChance: 0.12, comboLength: 3, grabChance: 0.06, specialChance: 0.12, reactionFrames: 12, retreatsWhenTired: true },
  // Mashes buttons: always attacking, never blocks, long strings, slow to read anything.
  masher: { aggression: 1, blockChance: 0, dodgeChance: 0, parryChance: 0, comboLength: 4, grabChance: 0.02, specialChance: 0.05, reactionFrames: 30, retreatsWhenTired: false },
  casual: { aggression: 0.7, blockChance: 0.25, dodgeChance: 0.08, parryChance: 0.03, comboLength: 2, grabChance: 0.05, specialChance: 0.05, reactionFrames: 20, retreatsWhenTired: false },
};

export interface AuditResult {
  fights: number;
  won: number;
  seconds: number;
  hpLeft: number;
  /** Player attacks started, landed, blocked by enemies, parried by enemies. */
  swings: number;
  landed: number;
  enemyBlocked: number;
  enemyParried: number;
  /** Enemy attacks started and landed; player blocks and parries. */
  enemySwings: number;
  enemyLanded: number;
  playerBlocked: number;
  playerParried: number;
  /** Share of enemy time spent standing idle; spent blocking (guard up). */
  enemyIdle: number;
  enemyGuard: number;
  /** Share of the fight in which at least one enemy is attacking the player. */
  pressure: number;
  /** Share of the fight in which two enemies attack at once. */
  doubled: number;
  /** Enemy parry tells shown. */
  tells: number;
}

export function audit(area: AreaId, level: number, who: keyof typeof PLAYERS, seeds = 8): AuditResult {
  const r: AuditResult = { fights: 0, won: 0, seconds: 0, hpLeft: 0, swings: 0, landed: 0, enemyBlocked: 0, enemyParried: 0, enemySwings: 0, enemyLanded: 0, playerBlocked: 0, playerParried: 0, enemyIdle: 0, enemyGuard: 0, pressure: 0, doubled: 0, tells: 0 };
  let enemyFrames = 0;
  let idle = 0;
  let guard = 0;
  let frames = 0;
  let pressure = 0;
  let doubled = 0;
  const lvl = LEVELS[area];
  for (let seed = 1; seed <= seeds; seed++) {
    const alloc = emptyAllocation();
    alloc.strength = 3;
    alloc.endurance = 3;
    alloc.defence = 2;
    alloc.speed = 2;
    const c = createCharacter({ name: 'Bot', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: alloc });
    const p = new Progress(newSave(c));
    p.save.level = level;
    p.wearNew('wraps');
    const w = new World(lvl, p, { entry: lvl.entries[0].id, seed, difficulty: 'normal' });
    const enc = w.encounters.find((e) => e.status !== 'cleared');
    if (!enc) continue;
    for (const e of w.encounters) if (e !== enc) e.status = 'cleared';
    w.player.pos.x = enc.def.triggerX - 0.6;
    w.player.pos.z = 0;
    const me = w.player;
    const brain = new FighterAI(me, { ...ARCHETYPES.thug, ...PLAYERS[who], id: 'rival', name: 'Bot' }, w.sim.rng, new AttackTokens(1), w.arena);
    const bus = w.sim.bus;
    bus.on('move:started', (e) => (e.fighter === me ? r.swings++ : r.enemySwings++));
    bus.on('hit:landed', (h) => (h.attacker === me ? r.landed++ : h.target === me && r.enemyLanded++));
    bus.on('hit:blocked', (h) => (h.attacker === me ? r.enemyBlocked++ : h.target === me && r.playerBlocked++));
    bus.on('hit:parried', (h) => (h.attacker === me ? r.enemyParried++ : h.target === me && r.playerParried++));
    bus.on('fighter:tell', (t) => t.fighter !== me && r.tells++);
    let f = 0;
    let won = false;
    while (f < 60 * 240) {
      const cmd = f < 20 ? { ...brain.think(w.sim.frame), moveX: 1 } : brain.think(w.sim.frame);
      w.step(cmd);
      f++;
      const foes = w.sim.fighters.filter((x: Fighter) => x !== me && x.team !== me.team && !x.isKO);
      let attacking = 0;
      for (const x of foes) {
        enemyFrames++;
        if (x.state === 'idle') idle++;
        if (x.state === 'block' || x.state === 'blockstun') guard++;
        if (x.state === 'attack' && x.target === me) attacking++;
      }
      if (foes.length) {
        frames++;
        if (attacking) pressure++;
        if (attacking >= 2) doubled++;
      }
      if (enc.status === 'cleared') {
        won = true;
        break;
      }
      if (me.isKO) break;
    }
    r.fights++;
    r.won += won ? 1 : 0;
    r.seconds += f / 60;
    r.hpLeft += won ? me.vitals.health / me.vitals.maxHealth : 0;
  }
  const n = Math.max(1, r.fights);
  for (const k of ['seconds', 'hpLeft', 'swings', 'landed', 'enemyBlocked', 'enemyParried', 'enemySwings', 'enemyLanded', 'playerBlocked', 'playerParried', 'tells'] as const) r[k] /= n;
  r.enemyIdle = idle / Math.max(1, enemyFrames);
  r.enemyGuard = guard / Math.max(1, enemyFrames);
  r.pressure = pressure / Math.max(1, frames);
  r.doubled = doubled / Math.max(1, frames);
  return r;
}

export function describe(area: string, who: string, r: AuditResult): string {
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const per = (v: number) => (r.swings ? pc(v / r.swings) : '-');
  return [
    `${area} (${who}): won ${r.won}/${r.fights}, ${r.seconds.toFixed(0)} s a fight, ${pc(r.hpLeft)} health left`,
    `  your attacks: ${r.swings.toFixed(0)} thrown, ${per(r.landed)} landed, ${per(r.enemyBlocked)} blocked, ${per(r.enemyParried)} parried (${r.tells.toFixed(1)} parry tells shown)`,
    `  their attacks: ${r.enemySwings.toFixed(0)} thrown, ${r.enemyLanded.toFixed(0)} landed, you blocked ${r.playerBlocked.toFixed(0)}, parried ${r.playerParried.toFixed(0)}`,
    `  enemies idle ${pc(r.enemyIdle)} of the time, guard up ${pc(r.enemyGuard)}; someone attacking you ${pc(r.pressure)} of the fight, two at once ${pc(r.doubled)}`,
  ].join('\n');
}

if (process.argv[1]?.endsWith('fight_audit.ts')) {
  const area = (process.argv[2] ?? 'estate') as AreaId;
  const level = Number(process.argv[3] ?? 1);
  const who = (process.argv[4] ?? 'decent') as keyof typeof PLAYERS;
  console.log(describe(area, who, audit(area, level, who, Number(process.argv[5] ?? 8))));
}
