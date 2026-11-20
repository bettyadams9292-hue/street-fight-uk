/**
 * Bikes and scooters out in the world (the 30 approved models): bicycles locked to the bike racks, hire e-bikes and
 * e-scooters at the kerb in shopping streets, and a delivery moped outside the takeaways. They're scenery: nobody
 * rides them, and they never block the pavement (pedestrians and you walk past them).
 */
import type { LevelDef, PropDef } from './LevelTypes';
import { interiorFor, KERB_Z } from '../city/street';

const RACK_BIKES = ['b01_roadster_1950', 'b02_shopper_1970', 'b04_school_bike', 'b06_hybrid_commuter', 'b07_road_racer', 'b08_gravel', 'b10_mtb_hardtail', 'b12_bmx', 'b13_folding', 'b05_city_stepthrough'];
/** The kerb line for anything parked on the pavement's road edge. */
const KERB_PARK = KERB_Z - 0.38;

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const bike = (item: string, x: number, z: number, rot = 0): PropDef => ({ kind: 'vehicle', item, x, z, rot, size: [0.85, 0.25], solid: false, plinth: false });

/** The bikes this street gets, given what's already on it. Interiors get none. */
export function streetBikes(level: LevelDef): PropDef[] {
  if (level.deep || level.facades.some((f) => f.kind === 'interior' || f.kind === 'room' || f.kind === 'basement')) return [];
  const r = rng(level.id);
  const out: PropDef[] = [];
  const taken = [...level.props];
  const doors = level.exits.filter((e) => e.kind === 'door').map((e) => e.x);
  const clear = (x: number, z: number, hx: number) =>
    x > level.bounds.minX + 1 && x < level.bounds.maxX - 1 &&
    !doors.some((d) => Math.abs(d - x) < hx + 0.9) &&
    !taken.some((p) => p.kind !== 'bike_rack' && Math.abs(p.x - x) < hx + (p.size?.[0] ?? 0.4) + 0.2 && Math.abs(p.z - z) < 0.9);
  const put = (p: PropDef) => (out.push(p), taken.push(p));

  // A couple of bicycles at every rack, alongside it against the wall.
  for (const rack of level.props.filter((p) => p.kind === 'bike_rack')) {
    const n = 1 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) put(bike(RACK_BIKES[Math.floor(r() * RACK_BIKES.length)], rack.x + (i ? 0.45 : -0.4), rack.z + 0.06, r() < 0.5 ? 0 : 2));
  }

  const shops = level.facades.filter((f) => f.label && (f.kind === 'shop' || f.kind === 'precinct' || f.kind === 'mall'));
  // A delivery moped at the kerb outside each takeaway.
  for (const f of shops) {
    if (interiorFor(f.kind, f.label!) !== 'takeaway') continue;
    const x = Math.min(f.x1 - 0.8, f.x0 + 1.2 + r() * Math.max(0, f.x1 - f.x0 - 2.4));
    if (clear(x, KERB_PARK, 0.9)) put(bike('b28_delivery_moped', x, KERB_PARK, r() < 0.5 ? 0 : 2));
  }
  // Shopping streets: a hire e-bike and e-scooters at the kerb, about one bay per 35 m.
  if (shops.length >= 3) {
    const len = level.bounds.maxX - level.bounds.minX;
    const bays = Math.max(1, Math.round(len / 35));
    for (let b = 0; b < bays; b++) {
      const x = level.bounds.minX + (len * (b + 0.3 + r() * 0.4)) / bays;
      if (!clear(x, KERB_PARK, 1.6)) continue;
      put(bike('b18_rental_ebike', x - 0.9, KERB_PARK));
      put(bike('b29_standup_escooter', x + 0.35, KERB_PARK + 0.05, 2));
      if (r() < 0.6) put(bike('b29_standup_escooter', x + 0.95, KERB_PARK - 0.05));
    }
  }
  return out;
}
