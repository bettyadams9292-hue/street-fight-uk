/**
 * Parking the car you drove (map → Drive, `Game.driveTo`): where it's left at the other end, so it's there on the
 * street when you come back out, in its own model and paint (`resolveLevel` draws it from `save.property.carOut`).
 *
 * It parks on the road side of an outdoor street, near where you're dropped: the street itself, or for a shop, pub
 * or gym the street its front door is on. Never across the pavement or a doorway (the road is z > 0; doors and
 * subway stairs are on the building line), never on top of other props, and clear of the street's ends so the way
 * on stays open. Somewhere with no outdoor street (the shopping centre, the subway, the Deep Line) has no parking.
 */
import type { AreaId } from '../progress/Progress';
import { LEVELS } from '../world/levels';
import type { LevelDef } from '../world/LevelTypes';
import { propHalf } from '../world/LevelTypes';
import { CARS } from './catalogue';

export interface ParkingSpot {
  area: AreaId;
  x: number;
  z: number;
}

/** Back on the drive at 14 Tanner Road (carOut null). */
export const DRIVE_HOME: ReadonlySet<string> = new Set(['home', 'estate', 'basement']);

const outdoors = (lv: LevelDef | undefined): lv is LevelDef => !!lv && lv.weather !== 'indoors' && !lv.deep && lv.bounds.maxZ >= 1.9;

/** The street you'd park on for `area`, and how far along it the place is. */
export function parkingStreet(area: AreaId, entry?: string): { level: LevelDef; x: number } | null {
  const lv = (LEVELS as Record<string, LevelDef>)[area];
  if (outdoors(lv)) {
    const e = lv.entries.find((x) => x.id === entry) ?? lv.entries[0];
    return { level: lv, x: e?.x ?? (lv.bounds.minX + lv.bounds.maxX) / 2 };
  }
  // A shop, pub or gym: the outdoor street with its front door.
  for (const st of Object.values(LEVELS) as LevelDef[]) {
    if (!outdoors(st)) continue;
    const door = st.exits.find((x) => x.to === area && x.kind === 'door');
    if (door) return { level: st, x: door.x };
  }
  return null;
}

/** The first clear bit of road near `x` big enough for this car. */
export function parkingSpot(area: AreaId, carId: string, entry?: string): ParkingSpot | null {
  const at = parkingStreet(area, entry);
  const def = CARS[carId];
  if (!at || !def) return null;
  const { level: lv } = at;
  const [hx, hz] = def.size;
  const z = Math.min(1.35, lv.bounds.maxZ - hz + 0.25);
  const lo = lv.bounds.minX + hx + 3;
  const hi = lv.bounds.maxX - hx - 3;
  if (hi <= lo) return null;
  const clear = (x: number) => {
    for (const p of lv.props) {
      const [pw, ph] = propHalf(p);
      const px = p.x;
      const pz1 = p.z + Math.max(ph, 0.3);
      // Anything reaching out into the road beside us.
      if (pz1 > z - hz - 0.2 && Math.abs(px - x) < hx + pw + 0.6) return false;
    }
    // Nor on anything lying in the road: things to pick up, search or smash.
    for (const o of [...(lv.pickups ?? []), ...(lv.containers ?? []), ...(lv.breakables ?? [])]) if (o.z > z - hz - 0.4 && Math.abs(o.x - x) < hx + 0.8) return false;
    // Not where people come and go at the ends of the street.
    for (const e of lv.exits) if (e.kind === 'edge' && Math.abs(e.x - x) < hx + 3) return false;
    return true;
  };
  // Just past the drop-off point first (so you're not stood in it), then further out either way.
  for (let d = hx + 1.2; d < lv.bounds.maxX - lv.bounds.minX; d += 0.5) {
    for (const x of [at.x + d, at.x - d]) if (x >= lo && x <= hi && clear(x)) return { area: lv.id as AreaId, x: Math.round(x * 10) / 10, z };
  }
  return null;
}
