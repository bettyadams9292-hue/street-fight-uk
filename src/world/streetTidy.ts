/**
 * Street furniture where it belongs. On every street the kits draw:
 * - a telephone box stands against the building, as a K6 kiosk does, not out in the middle of the pavement;
 * - nothing that stands by the wall (a phone box, a bin, a bench, a vending machine, a bike rack...) is in front of a
 *   door: a way in, a shop's own door (drawn by the shopfront even where it doesn't open) or a house's. It's slid
 *   along the wall to the nearest spot clear of every door and of the other furniture.
 * Run once over the levels when they're built (world/levels.ts), so drawing and collision both see the same place.
 */
import { KERB_Z, kerbFor, kitStreet, planStreet } from '../city/street';
import type { LevelDef, PropDef } from './LevelTypes';
import { propHalf } from './LevelTypes';

/** The building line on a kit street is this far behind the walkable edge (city/street.ts planStreet `back`). */
const WALL_BEHIND = 0.55;
/** Furniture that stands against the wall and would sit in front of a door. */
const BY_THE_WALL = new Set<string>([
  'phonebox', 'bin', 'bench', 'vending', 'bike_rack', 'postbox', 'planter', 'kiosk', 'busstop', 'atm', 'trolley', 'crates', 'cardboard', 'pallets', 'rubbish_bags', 'drum', 'skip', 'dumpster', 'market_stall', 'sign_post', 'lamp_post', 'barrier',
]);
/** Kiosks stand right up against the building. */
const AGAINST_WALL = new Set<string>(['phonebox']);

export interface DoorSpan {
  x: number;
  half: number;
}

/** Every door along this street's building line: ways in, and the shopfronts' and buildings' own doors. */
export function doorsOf(level: LevelDef): DoorSpan[] {
  const out: DoorSpan[] = [];
  for (const ex of level.exits) if (ex.kind === 'door' && ex.z < 0) out.push({ x: ex.x, half: 0.7 });
  if (kitStreet(level)) {
    const plan = planStreet(level);
    for (const d of plan.shopDoors) out.push({ x: d.x, half: d.w / 2 });
  }
  return out;
}

/** Where the kerb was before the pavement was widened. */
const OLD_KERB_Z = -0.1;
/** Vehicles: parked on the road, wheels clear of the kerb (it's 0.3 m deep). */
const VEHICLES = new Set<string>(['car', 'van', 'homecar', 'abandoned_car', 'bus']);

export function tidyStreet(level: LevelDef): void {
  if (!kitStreet(level)) return;
  // The pavement was widened (the kerb moved out from -0.1 to KERB_Z): what stood at the old kerb's edge (lamps,
  // bollards, signs) moves out with it, so it still lines the kerb.
  if (kerbFor(level) !== null)
    for (const p of level.props) {
      if (VEHICLES.has(p.kind) || p.z < -0.5 || p.z > -0.05) continue;
      p.z = Math.round((p.z + (KERB_Z - OLD_KERB_Z)) * 100) / 100;
    }
  if (kerbFor(level) !== null)
    for (const p of level.props) {
      if (!VEHICLES.has(p.kind)) continue;
      const [, hz] = propHalf(p);
      const road = KERB_Z + 0.3 + 0.08;
      if (p.z - hz < road && p.z > KERB_Z - 0.5) p.z = Math.round((road + hz) * 100) / 100;
    }
  const wall = level.bounds.minZ - WALL_BEHIND;
  for (const p of level.props) {
    if (!AGAINST_WALL.has(p.kind) || p.item) continue;
    const [, hz] = propHalf(p);
    if (p.z - hz > wall + 0.1) p.z = Math.round((wall + hz + 0.06) * 100) / 100;
  }
  const doors = doorsOf(level);
  const near = (p: PropDef) => p.z - propHalf(p)[1] < level.bounds.minZ + 0.9;
  const blocking = (p: PropDef, x: number) => {
    const [hx] = propHalf(p);
    return doors.some((d) => Math.abs(x - d.x) < hx + d.half + 0.15);
  };
  const clash = (p: PropDef, x: number) => {
    const [hx, hz] = propHalf(p);
    return level.props.some((o) => {
      if (o === p || o.solid === false) return false;
      const [ox, oz] = propHalf(o);
      return Math.abs(o.x - x) < hx + ox + 0.1 && Math.abs(o.z - p.z) < hz + oz;
    });
  };
  for (const p of level.props) {
    if (!BY_THE_WALL.has(p.kind) || p.item || !near(p) || !blocking(p, p.x)) continue;
    const [hx] = propHalf(p);
    for (let step = 0.25; step < 12; step += 0.25) {
      const xs = [p.x + step, p.x - step].filter((x) => x - hx > level.bounds.minX + 0.3 && x + hx < level.bounds.maxX - 0.3);
      const ok = xs.find((x) => !blocking(p, x) && !clash(p, x));
      if (ok !== undefined) {
        p.x = Math.round(ok * 100) / 100;
        break;
      }
    }
  }
}
