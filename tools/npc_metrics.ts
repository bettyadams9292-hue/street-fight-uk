/**
 * Measures how sensibly pedestrians move, so changes to their brains can be
 * compared by number: time spent stalled, pointless about-turns, and people
 * walking through each other.   tsx tools/npc_metrics.ts
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress } from '../src/progress/Progress';
import { World } from '../src/world/World';
import { emptyCommand } from '../src/input/Commands';
import { LEVELS } from '../src/world/levels';

export interface NpcMetrics {
  civMinutes: number;
  /** Seconds per pedestrian-minute spent meaning to walk but going nowhere. */
  stallPerMin: number;
  /** About-turns per pedestrian-minute. */
  turnsPerMin: number;
  /** Seconds per pedestrian-minute spent overlapping someone (closer than 0.3 m). */
  overlapPerMin: number;
  /** Metres walked per pedestrian-minute. */
  metresPerMin: number;
}

export function measure(areas: readonly string[], seeds: readonly number[], seconds = 60): NpcMetrics {
  let civFrames = 0;
  let stall = 0;
  let turns = 0;
  let overlap = 0;
  let metres = 0;
  for (const area of areas) {
    for (const seed of seeds) {
      const c = createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() });
      const p = new Progress(newSave(c));
      const lvl = (LEVELS as Record<string, (typeof LEVELS)[keyof typeof LEVELS]>)[area];
      const b = lvl.bounds;
      const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: (b.minX + b.maxX) / 2, z: b.maxZ - 0.3 }, seed, keepCleared: (lvl.encounters ?? []).map((e) => e.id) });
      const hist = new Map<number, { x: number[]; dir: number; lastX: number }>();
      for (let i = 0; i < seconds * 60; i++) {
        w.step(emptyCommand());
        const list = w.civilians;
        for (const { f, brain } of list) {
          civFrames++;
          let h = hist.get(f.id);
          if (!h) hist.set(f.id, (h = { x: [], dir: brain.dir, lastX: f.pos.x }));
          metres += Math.abs(f.pos.x - h.lastX);
          h.lastX = f.pos.x;
          if (brain.dir !== h.dir) {
            turns++;
            h.dir = brain.dir;
          }
          h.x.push(f.pos.x);
          if (h.x.length > 90) h.x.shift();
          const walking = brain.activity === 'walk' && !brain.standAt;
          if (walking && h.x.length === 90 && Math.abs(h.x[89] - h.x[0]) < 0.15) stall++;
        }
        for (let a = 0; a < list.length; a++) for (let d = a + 1; d < list.length; d++) {
          const A = list[a].f.pos;
          const B = list[d].f.pos;
          if (Math.hypot(A.x - B.x, A.z - B.z) < 0.3) overlap += 2;
        }
      }
    }
  }
  const mins = civFrames / 3600;
  return { civMinutes: mins, stallPerMin: stall / 60 / mins, turnsPerMin: turns / mins, overlapPerMin: overlap / 60 / mins, metresPerMin: metres / mins };
}

if (process.argv[1]?.endsWith('npc_metrics.ts')) {
  const m = measure(['high_street', 'city', 'market', 'estate', 'mall'], [1, 2, 3, 4]);
  console.log(Object.entries(m).map(([k, v]) => `${k}=${v.toFixed(2)}`).join('  '));
}
