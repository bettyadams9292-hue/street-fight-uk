import type { AreaId, Progress, PurchaseResult } from '../progress/Progress';
import {
  BIKES,
  CARS,
  DEFAULT_FINISHES,
  FINISHES,
  FURNITURE,
  GARAGE_SPACES,
  MAX_CARS,
  ROOM_IDS,
  resale,
  type RoomId,
} from './catalogue';
import { checkPlacement } from './home';

/** Where a piece of furniture sits. */
export interface PlacedAt {
  room: RoomId;
  x: number;
  z: number;
  /** Quarter turns. */
  rot: number;
}

export interface OwnedFurniture {
  uid: string;
  id: string;
  colour: string;
  /** Null = delivered but not placed yet (in the furniture inventory). */
  at: PlacedAt | null;
}

export interface OwnedVehicle {
  uid: string;
  id: string;
  colour: string;
  /** How you got it. */
  from: 'bought' | 'won';
}

export interface CasinoStats {
  /** Total staked. */
  staked: number;
  /** Total paid out. */
  won: number;
  plays: number;
  biggestWin: number;
  /** Vehicle prizes won (catalogue ids). */
  prizes: string[];
}

/** Your house, its contents, your motors, and your night at the casino. Part of the save. */
export interface PropertySave {
  furniture: OwnedFurniture[];
  finishes: Record<RoomId, { floor: string; wall: string }>;
  cars: OwnedVehicle[];
  /** The car on the drive. */
  activeCar: string | null;
  bikes: OwnedVehicle[];
  /** The bike that's out of the garage, and where it's parked (or that you're on it). */
  bikeOut: { uid: string; area: AreaId; x: number; z: number } | null;
  riding: boolean;
  casino: CasinoStats;
  seq: number;
}

/** Spot outside 14 Tanner Road where a bike is left when you take it out. */
export const BIKE_HOME_SPOT = { area: 'estate' as AreaId, x: -4.2, z: -1.3 };
/** The drive: where the active car parks. */
export const DRIVEWAY = { x: -9.3, z: -1.15 };

/** What came with the house: a bed, a sofa, a coffee table and the telly. */
export function defaultProperty(): PropertySave {
  return {
    furniture: [
      { uid: 'f1', id: 'bed_double', colour: '#3a4a6a', at: { room: 'bedroom', x: -18.8, z: -1.3, rot: 0 } },
      { uid: 'f2', id: 'sofa_3', colour: '#4a5a3a', at: { room: 'living', x: -11.3, z: -1.85, rot: 0 } },
      { uid: 'f3', id: 'coffee_table', colour: '#8a5a32', at: { room: 'living', x: -11.3, z: -0.8, rot: 0 } },
      { uid: 'f4', id: 'tv_43', colour: '#1a1a1a', at: { room: 'living', x: -9.4, z: -2.1, rot: 0 } },
    ],
    finishes: Object.fromEntries(ROOM_IDS.map((r) => [r, { ...DEFAULT_FINISHES[r] }])) as PropertySave['finishes'],
    cars: [],
    activeCar: null,
    bikes: [],
    bikeOut: null,
    riding: false,
    casino: { staked: 0, won: 0, plays: 0, biggestWin: 0, prizes: [] },
    seq: 5,
  };
}

const num = (v: unknown, d: number, min = -1e9, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 64;
const colourOk = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);

/** Repair the property part of a save. Missing (older saves) = what came with the house. */
export function sanitiseProperty(raw: unknown, areas: readonly string[]): PropertySave {
  const base = defaultProperty();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<PropertySave>;
  const out: PropertySave = { ...base, furniture: [], cars: [], bikes: [] };
  const uids = new Set<string>();
  const uidOk = (u: unknown): u is string => str(u) && !uids.has(u) && (uids.add(u), true);
  if (Array.isArray(r.furniture)) {
    for (const f of r.furniture.slice(0, 300)) {
      if (!f || !FURNITURE[f.id] || !uidOk(f.uid)) continue;
      const def = FURNITURE[f.id];
      const piece: OwnedFurniture = { uid: f.uid, id: f.id, colour: colourOk(f.colour, def.colours[0]), at: null };
      const a = f.at;
      if (a && ROOM_IDS.includes(a.room) && typeof a.x === 'number' && typeof a.z === 'number') {
        const at = { room: a.room, x: num(a.x, 0, -30, 20), z: num(a.z, 0, -3, 2), rot: Math.floor(num(a.rot, 0, 0, 3)) };
        // Anything that no longer fits (rules changed, hand-edited save) goes back in the inventory, never lost.
        if (checkPlacement(out, def, at).ok) piece.at = at;
      }
      out.furniture.push(piece);
    }
  } else out.furniture = base.furniture;
  if (r.finishes && typeof r.finishes === 'object') {
    for (const room of ROOM_IDS) {
      const fin = (r.finishes as Record<string, { floor?: string; wall?: string }>)[room];
      out.finishes[room] = {
        floor: fin && FINISHES[fin.floor ?? '']?.kind === 'floor' ? fin.floor! : DEFAULT_FINISHES[room].floor,
        wall: fin && FINISHES[fin.wall ?? '']?.kind === 'wall' ? fin.wall! : DEFAULT_FINISHES[room].wall,
      };
    }
  }
  const vehicles = (v: unknown, table: Record<string, { colours: string[] }>, cap: number) =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is OwnedVehicle => !!x && !!table[x.id] && uidOk(x.uid))
      .slice(0, cap)
      .map((x) => ({ uid: x.uid, id: x.id, colour: colourOk(x.colour, table[x.id].colours[0]), from: x.from === 'won' ? ('won' as const) : ('bought' as const) }));
  out.cars = vehicles(r.cars, CARS, MAX_CARS);
  out.bikes = vehicles(r.bikes, BIKES, GARAGE_SPACES);
  out.activeCar = out.cars.some((c) => c.uid === r.activeCar) ? r.activeCar! : out.cars[0]?.uid ?? null;
  const bo = r.bikeOut;
  if (bo && out.bikes.some((b) => b.uid === bo.uid) && areas.includes(bo.area)) {
    out.bikeOut = { uid: bo.uid, area: bo.area, x: num(bo.x, BIKE_HOME_SPOT.x), z: num(bo.z, BIKE_HOME_SPOT.z) };
    out.riding = r.riding === true;
  }
  const c = (r.casino ?? {}) as Partial<CasinoStats>;
  out.casino = {
    staked: num(c.staked, 0, 0),
    won: num(c.won, 0, 0),
    plays: num(c.plays, 0, 0),
    biggestWin: num(c.biggestWin, 0, 0),
    prizes: Array.isArray(c.prizes) ? c.prizes.filter((x): x is string => !!CARS[x] || !!BIKES[x]).slice(0, 50) : [],
  };
  // The next uid must be past every one in use.
  let seq = Math.floor(num(r.seq, 1, 1));
  for (const u of uids) {
    const n = Number(u.replace(/^[a-z]+/, ''));
    if (Number.isFinite(n) && n >= seq) seq = n + 1;
  }
  out.seq = Math.max(seq, base.seq);
  return out;
}

// ---- buying, placing and selling ---------------------------------------------------------------

const P = (p: Progress) => p.save.property;
const nextUid = (p: Progress, prefix: string) => `${prefix}${P(p).seq++}`;
const fail = (reason: string): PurchaseResult => ({ ok: false, reason });

/** Buy one or more of a piece; they're delivered to the house, ready to place. */
export function buyFurniture(p: Progress, id: string, colour: string, qty = 1): PurchaseResult {
  const def = FURNITURE[id];
  if (!def) return fail('Not in the catalogue');
  const n = Math.max(1, Math.min(10, Math.floor(qty)));
  if (!def.colours.includes(colour)) colour = def.colours[0];
  const total = def.price * n;
  if (P(p).furniture.length + n > 300) return fail('The house is full to the rafters');
  if (!p.pay(total)) return fail(`Need £${total}`);
  for (let i = 0; i < n; i++) P(p).furniture.push({ uid: nextUid(p, 'f'), id, colour, at: null });
  return { ok: true };
}

export function placeFurniture(p: Progress, uid: string, at: PlacedAt): PurchaseResult {
  const piece = P(p).furniture.find((f) => f.uid === uid);
  if (!piece) return fail('You don’t own that');
  const chk = checkPlacement(P(p), FURNITURE[piece.id], at, uid);
  if (!chk.ok) return fail(chk.reason);
  piece.at = { room: chk.room, x: Math.round(at.x * 100) / 100, z: Math.round(at.z * 100) / 100, rot: ((Math.floor(at.rot) % 4) + 4) % 4 };
  return { ok: true };
}

/** Pick it up and put it back in the furniture inventory. */
export function storeFurniture(p: Progress, uid: string): PurchaseResult {
  const piece = P(p).furniture.find((f) => f.uid === uid);
  if (!piece) return fail('You don’t own that');
  piece.at = null;
  return { ok: true };
}

/** Sell it back for half. */
export function sellFurniture(p: Progress, uid: string): { ok: true; refund: number } | { ok: false; reason: string } {
  const i = P(p).furniture.findIndex((f) => f.uid === uid);
  if (i < 0) return { ok: false, reason: 'You don’t own that' };
  const refund = resale(FURNITURE[P(p).furniture[i].id].price);
  P(p).furniture.splice(i, 1);
  p.save.cash.pocket += refund;
  return { ok: true, refund };
}

export function recolourFurniture(p: Progress, uid: string, colour: string): PurchaseResult {
  const piece = P(p).furniture.find((f) => f.uid === uid);
  if (!piece) return fail('You don’t own that');
  if (!FURNITURE[piece.id].colours.includes(colour)) return fail('Not available in that colour');
  piece.colour = colour;
  return { ok: true };
}

/** Lay a floor or paint/paper the walls of a room. */
export function buyFinish(p: Progress, room: RoomId, finishId: string): PurchaseResult {
  const def = FINISHES[finishId];
  if (!def || !ROOM_IDS.includes(room)) return fail('Not available');
  const cur = P(p).finishes[room];
  if (cur[def.kind] === finishId) return fail('Already done that');
  if (!p.pay(def.price)) return fail(`Need £${def.price}`);
  cur[def.kind] = finishId;
  return { ok: true };
}

// ---- cars and bikes ----------------------------------------------------------------------------

/** Add a vehicle to your collection (bought or won). Cars go on the drive if it's empty. */
export function addCar(p: Progress, id: string, colour: string, from: OwnedVehicle['from']): OwnedVehicle {
  const v: OwnedVehicle = { uid: nextUid(p, 'c'), id, colour: CARS[id].colours.includes(colour) ? colour : CARS[id].colours[0], from };
  P(p).cars.push(v);
  if (!P(p).activeCar) P(p).activeCar = v.uid;
  return v;
}

export function addBike(p: Progress, id: string, colour: string, from: OwnedVehicle['from']): OwnedVehicle {
  const v: OwnedVehicle = { uid: nextUid(p, 'b'), id, colour: BIKES[id].colours.includes(colour) ? colour : BIKES[id].colours[0], from };
  P(p).bikes.push(v);
  return v;
}

export function buyCar(p: Progress, id: string, colour: string): PurchaseResult {
  const def = CARS[id];
  if (!def) return fail('Not on the forecourt');
  if (P(p).cars.length >= MAX_CARS) return fail(`You’ve got ${MAX_CARS} cars already. Sell one first.`);
  if (!p.pay(def.price)) return fail(`Need £${def.price.toLocaleString('en-GB')}`);
  addCar(p, id, colour, 'bought');
  return { ok: true };
}

export function buyBike(p: Progress, id: string, colour: string): PurchaseResult {
  const def = BIKES[id];
  if (!def) return fail('Not in the shop');
  if (P(p).bikes.length >= GARAGE_SPACES) return fail(`The garage only holds ${GARAGE_SPACES} bikes. Sell one first.`);
  if (!p.pay(def.price)) return fail(`Need £${def.price.toLocaleString('en-GB')}`);
  addBike(p, id, colour, 'bought');
  return { ok: true };
}

export function setActiveCar(p: Progress, uid: string): PurchaseResult {
  if (!P(p).cars.some((c) => c.uid === uid)) return fail('Not yours');
  P(p).activeCar = uid;
  return { ok: true };
}

export function sellCar(p: Progress, uid: string): { ok: true; refund: number } | { ok: false; reason: string } {
  const prop = P(p);
  const i = prop.cars.findIndex((c) => c.uid === uid);
  if (i < 0) return { ok: false, reason: 'Not yours' };
  const refund = resale(CARS[prop.cars[i].id].price);
  prop.cars.splice(i, 1);
  if (prop.activeCar === uid) prop.activeCar = prop.cars[0]?.uid ?? null;
  p.save.cash.pocket += refund;
  return { ok: true, refund };
}

export function sellBike(p: Progress, uid: string): { ok: true; refund: number } | { ok: false; reason: string } {
  const prop = P(p);
  const i = prop.bikes.findIndex((b) => b.uid === uid);
  if (i < 0) return { ok: false, reason: 'Not yours' };
  if (prop.bikeOut?.uid === uid && prop.riding) return { ok: false, reason: 'Get off it first' };
  const refund = resale(BIKES[prop.bikes[i].id].price);
  prop.bikes.splice(i, 1);
  if (prop.bikeOut?.uid === uid) prop.bikeOut = null;
  p.save.cash.pocket += refund;
  return { ok: true, refund };
}

/** Wheel a bike out of the garage: it's left outside the front of the house. */
export function takeOutBike(p: Progress, uid: string): PurchaseResult {
  const prop = P(p);
  if (!prop.bikes.some((b) => b.uid === uid)) return fail('Not yours');
  if (prop.bikeOut) return fail(prop.bikeOut.uid === uid ? 'It’s already out' : 'Put the other bike away first');
  prop.bikeOut = { uid, ...BIKE_HOME_SPOT };
  prop.riding = false;
  return { ok: true };
}

/** Put the bike back in the garage (wherever you left it: the lads bring it back). */
export function storeBike(p: Progress): PurchaseResult {
  const prop = P(p);
  if (!prop.bikeOut) return fail('No bike out');
  prop.bikeOut = null;
  prop.riding = false;
  return { ok: true };
}

export function mountBike(p: Progress, area: AreaId): PurchaseResult {
  const prop = P(p);
  if (!prop.bikeOut || prop.bikeOut.area !== area) return fail('No bike here');
  prop.riding = true;
  return { ok: true };
}

/** Get off and leave it parked here. */
export function parkBike(p: Progress, area: AreaId, x: number, z: number): PurchaseResult {
  const prop = P(p);
  if (!prop.bikeOut) return fail('No bike out');
  prop.bikeOut = { uid: prop.bikeOut.uid, area, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
  prop.riding = false;
  return { ok: true };
}

export const ridingBike = (p: Progress) => {
  const prop = P(p);
  if (!prop.riding || !prop.bikeOut) return null;
  const b = prop.bikes.find((x) => x.uid === prop.bikeOut!.uid);
  return b ? { owned: b, def: BIKES[b.id] } : null;
};

export const activeCar = (p: Progress) => {
  const prop = P(p);
  const c = prop.cars.find((x) => x.uid === prop.activeCar);
  return c ? { owned: c, def: CARS[c.id] } : null;
};
