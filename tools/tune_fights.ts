/**
 * Sets the per-fight difficulty dials in src/world/fightTuning.ts
 * (docs/GAMEPLAY_PLAN.md, stage 4).
 *
 * Every main fight is played by the balance bots, a careful one and a casual
 * one, at the progress a player roughly has by then. Each fight's strength is
 * searched (by halving the range on a log scale) until their average win rate
 * lands on the target curve:
 * - ordinary fights start at 95% and ease down to 75% by the last area;
 * - a boss sits 12 points below its area's ordinary fights.
 *
 *   npx tsx tools/tune_fights.ts            # tune everything and write fightTuning.ts
 *   RUNS=8 STEPS=4 npx tsx tools/tune_fights.ts docks   # one area, quicker
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHECKPOINTS, playEncounter } from '../tests/balance';
import { FIGHT_STRENGTH } from '../src/world/fightTuning';
import { LEVELS } from '../src/world/levels';

const RUNS = Number(process.env.RUNS ?? 12);
const STEPS = Number(process.env.STEPS ?? 5);
const LO = 0.5;
const HI = 2.0;
const onlyArea = process.argv[2];

const fights: { area: string; id: string; boss: boolean; cp: (typeof CHECKPOINTS)[number] }[] = [];
for (const cp of CHECKPOINTS) for (const enc of LEVELS[cp.area].encounters) if (!enc.optional) fights.push({ area: cp.area, id: enc.id, boss: !!enc.boss, cp });

/** Where on the curve each fight sits: by its area's position in the game. */
const areas = [...new Set(fights.map((f) => f.area))];
export function target(area: string, boss: boolean): number {
  const i = areas.indexOf(area);
  const t = 95 - (20 * i) / Math.max(1, areas.length - 1);
  return boss ? t - 12 : t;
}

function winRate(f: (typeof fights)[number], strength: number): number {
  FIGHT_STRENGTH[`${f.area}/${f.id}`] = strength;
  let won = 0;
  for (const who of ['decent', 'casual'] as const) for (let s = 0; s < RUNS; s++) if (playEncounter(f.cp, f.id, who, 1000 + s * 17).won) won++;
  return (100 * won) / (RUNS * 2);
}

const result: Record<string, number> = { ...FIGHT_STRENGTH };
for (const f of fights) {
  if (onlyArea && f.area !== onlyArea) continue;
  const goal = target(f.area, f.boss);
  let lo = Math.log(LO);
  let hi = Math.log(HI);
  const tried: { s: number; win: number }[] = [];
  for (let step = 0; step < STEPS; step++) {
    const mid = (lo + hi) / 2;
    const s = Math.exp(mid);
    const win = winRate(f, s);
    tried.push({ s, win });
    // Winning too often: make it stronger.
    if (win > goal) lo = mid;
    else hi = mid;
  }
  // Each test is noisy, so rather than trust one point, interpolate (on a log scale) between the
  // nearest strength that won too often and the nearest that won too rarely.
  tried.sort((x, y) => x.s - y.s);
  const above = tried.filter((t) => t.win > goal).pop();
  const below = tried.find((t) => t.win <= goal && (!above || t.s > above.s));
  let pick: number;
  if (above && below && below.win !== above.win) {
    const k = (above.win - goal) / (above.win - below.win);
    pick = Math.exp(Math.log(above.s) + k * (Math.log(below.s) - Math.log(above.s)));
  } else pick = (above ?? below ?? tried[0]).s;
  pick = Math.round(pick * 100) / 100;
  const check = winRate(f, pick);
  result[`${f.area}/${f.id}`] = pick;
  FIGHT_STRENGTH[`${f.area}/${f.id}`] = pick;
  console.log(`${`${f.area}/${f.id}${f.boss ? ' (boss)' : ''}`.padEnd(30)} target ${goal.toFixed(0)}%  strength ${pick.toFixed(2)}  won ${check.toFixed(0)}%`);
}

// Write the table back into fightTuning.ts, in game order.
const file = 'src/world/fightTuning.ts';
const src = readFileSync(file, 'utf8');
const body = fights
  .filter((f) => result[`${f.area}/${f.id}`] !== undefined)
  .map((f) => `  '${f.area}/${f.id}': ${result[`${f.area}/${f.id}`].toFixed(2)},`)
  .join('\n');
writeFileSync(file, src.replace(/export const FIGHT_STRENGTH: Record<string, number> = \{[\s\S]*?\n?\};/, `export const FIGHT_STRENGTH: Record<string, number> = {\n${body}\n};`));
console.log(`\nWrote ${Object.keys(result).length} dials to ${file}`);
