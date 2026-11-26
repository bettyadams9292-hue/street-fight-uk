/**
 * Bikes and scooters out in the world (the 30 approved models), as scenery: nobody rides them. See streetBikes.
 */
import type { LevelDef, PropDef } from './LevelTypes';
import { interiorFor } from '../city/street';

const RACK_BIKES = ['b01_roadster_1950', 'b02_shopper_1970', 'b04_school_bike', 'b06_hybrid_commuter', 'b07_road_racer', 'b08_gravel', 'b10_mtb_hardtail', 'b12_bmx', 'b13_folding', 'b05_city_stepthrough'];

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** A bike leaning on the shop wall behind the pavement, out of everyone's way; solid all the same. */
const bike = (item: string, x: number, z: number, rot = 0): PropDef => ({ kind: 'vehicle', item, x, z, rot, size: [0.85, 0.2], plinth: false, leanOnWall: true });

/**
 * The bikes this street gets, given what's already on it: few and far between, as on a real street. A bicycle locked
 * at each rack; a delivery moped outside one of the takeaways; now and then a hire e-scooter dumped against a shop.
 * Every one leans on the wall at the back of the pavement (the building line, LevelView's back wall), parallel to
 * it, never at the kerb and never two in one spot. Interiors get none.
 */
export function streetBikes(level: LevelDef): PropDef[] {
  if (level.deep || level.facades.some((f) => f.kind === 'interior' || f.kind === 'room' || f.kind === 'basement')) return [];
  const r = rng(level.id);
  const out: PropDef[] = [];
  const doors = level.exits.filter((e) => e.kind === 'door').map((e) => e.x);
  // Against the building: its front is 0.55 m behind the walkable edge; a bike's middle sits 0.3 m off it.
  const wallZ = level.bounds.minZ - 0.25;
  const clear = (x: number, hx: number) =>
    x > level.bounds.minX + 1.5 && x < level.bounds.maxX - 1.5 &&
    !doors.some((d) => Math.abs(d - x) < hx + 1.0) &&
    !level.props.some((p) => p.kind !== 'bike_rack' && Math.abs(p.x - x) < hx + (p.size?.[0] ?? 0.5) + 0.4 && p.z < level.bounds.minZ + 0.8) &&
    !out.some((p) => Math.abs(p.x - x) < hx + 1.2);
  const facing = () => (r() < 0.5 ? 0 : 2);

  // One bicycle locked at each rack, alongside it.
  for (const rack of level.props.filter((p) => p.kind === 'bike_rack')) {
    const x = rack.x + (r() < 0.5 ? -1 : 1) * (0.9 + 0.2);
    if (clear(x, 0.85)) out.push(bike(RACK_BIKES[Math.floor(r() * RACK_BIKES.length)], x, wallZ, facing()));
  }

  const shops = level.facades.filter((f) => f.label && (f.kind === 'shop' || f.kind === 'precinct' || f.kind === 'mall'));
  // A delivery moped outside one takeaway (half the time).
  const takeaways = shops.filter((f) => interiorFor(f.kind, f.label!) === 'takeaway');
  if (takeaways.length && r() < 0.5) {
    const f = takeaways[Math.floor(r() * takeaways.length)];
    const x = f.x0 + 1.2 + r() * Math.max(0, f.x1 - f.x0 - 2.4);
    if (clear(x, 0.9)) out.push(bike('b28_delivery_moped', x, wallZ, facing()));
  }
  // A shopping street sometimes has a hire e-scooter left against a shop.
  if (shops.length >= 3 && r() < 0.5) {
    const f = shops[Math.floor(r() * shops.length)];
    const x = f.x0 + 1 + r() * Math.max(0, f.x1 - f.x0 - 2);
    if (clear(x, 0.6)) out.push(bike('b29_standup_escooter', x, wallZ, facing()));
  }
  return out;
}
