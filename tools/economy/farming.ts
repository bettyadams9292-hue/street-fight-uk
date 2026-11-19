/**
 * Repeat-fight income: optional fights come back on every visit and pay half their reward each time, plus
 * what the lads drop. The balance bot plays each one at the progression a player would have there, and this
 * works out pounds per hour of farming it, counting 20 s to walk back in and set it off again.
 *
 *     npx tsx tools/economy/farming.ts
 */
import { ARCHETYPES } from '../../src/ai/archetypes';
import { LEVELS } from '../../src/world/levels';
import { CHECKPOINTS, playEncounter } from '../../tests/balance';

export const WALK_BACK_SECONDS = 20;
const RUNS = Number(process.env.RUNS ?? 12);

export interface FarmRow { area: string; id: string; perFight: number; seconds: number; win: number; perHour: number }

export function farming(): FarmRow[] {
  const rows: FarmRow[] = [];
  for (const cp of CHECKPOINTS) {
    for (const e of LEVELS[cp.area].encounters) {
      if (!e.optional) continue;
      let drops = 0;
      for (const w of e.waves) for (const en of w.enemies) drops += ARCHETYPES[en.archetype]?.cashDrop ?? 0;
      const perFight = Math.round(e.reward.cash * 0.5) + drops;
      let secs = 0;
      let wins = 0;
      for (let s = 0; s < RUNS; s++) {
        const r = playEncounter(cp, e.id, 'decent', 500 + s * 13);
        secs += r.seconds;
        if (r.won) wins++;
      }
      const seconds = secs / RUNS;
      const win = wins / RUNS;
      rows.push({ area: cp.area, id: e.id, perFight, seconds, win, perHour: (perFight * win * 3600) / (seconds + WALK_BACK_SECONDS) });
    }
  }
  return rows.sort((a, b) => b.perHour - a.perHour);
}

if (process.argv[1]?.endsWith('farming.ts')) {
  const rows = farming();
  for (const r of rows) console.log(`${`${r.area}/${r.id}`.padEnd(30)} £${String(r.perFight).padStart(4)} a fight · ${r.seconds.toFixed(0).padStart(3)} s · win ${Math.round(r.win * 100)}% · £${Math.round(r.perHour).toLocaleString('en-GB')}/h`);
}
