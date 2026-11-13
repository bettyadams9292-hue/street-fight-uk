/**
 * Where each building actually draws its doors, worked out the same way the
 * renderer does (LevelView), without any three.js. The kit snaps a door to the
 * middle of a bay and the shop units clamp theirs clear of the piers, so a door
 * can stand up to a metre from where the level puts its exit. The game uses
 * this to put the place you press E on the door you can see.
 */
import type { LevelDef } from '../world/LevelTypes';
import { KIT_KINDS } from './catalogue';
import { hashString, planFacade } from './compose';
import { kitStreet, planStreet } from './street';

/** How far the scenery carries on past the playable ends (shared with LevelView). */
export const LEVEL_EXTENT = 16;

const cache = new Map<string, number[]>();

/** The x of every door the kit draws in this area (empty where the area has no kit frontage). */
export function drawnDoors(level: LevelDef): number[] {
  const hit = cache.get(level.id);
  if (hit) return hit;
  let out: number[] = [];
  if (kitStreet(level)) out = planStreet(level).doors;
  else {
    const fac = [...level.facades].sort((a, b) => a.x0 - b.x0);
    if (fac.length) {
      const last = fac[fac.length - 1];
      const run = [{ ...fac[0], x0: level.bounds.minX - LEVEL_EXTENT, x1: fac[0].x0, label: undefined }, ...fac, { ...last, x0: last.x1, x1: level.bounds.maxX + LEVEL_EXTENT, label: undefined }];
      let recent: string[] = [];
      for (const f of run) {
        if (f.x1 - f.x0 < 0.05) continue;
        if (!KIT_KINDS.has(f.kind)) {
          recent = [];
          continue;
        }
        const doors = level.exits.filter((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1).map((e) => e.x);
        const plan = planFacade({ kind: f.kind, x0: f.x0, x1: f.x1, label: f.label, theme: level.theme, seed: hashString(`${level.id}:${f.x0}`), doors, recent });
        recent = [...recent, ...plan.buildings.map((b) => b.design.id)].slice(-2);
        out.push(...plan.buildings.flatMap((b) => b.doors));
      }
    }
  }
  cache.set(level.id, out);
  return out;
}

/** Where to stand to use a door exit: on the drawn door if there's one within reach, else the exit's own spot. */
export function doorX(level: LevelDef, exitX: number): number {
  let best = exitX;
  let bestD = 1.25;
  for (const d of drawnDoors(level)) {
    const dd = Math.abs(d - exitX);
    if (dd < bestD) {
      best = d;
      bestD = dd;
    }
  }
  return best;
}
