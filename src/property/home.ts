import type { ContainerDef, LevelDef, PropDef, StationDef } from '../world/LevelTypes';
import { propHalf } from '../world/LevelTypes';
import { BIKE_SIZE, BIKES, FURNITURE, GARAGE_SPACES, ROOMS, ROOM_IDS, allowedRooms, roomAt, type FurnitureDef, type RoomId } from './catalogue';
import type { PlacedAt, PropertySave } from './state';

/**
 * 14 Tanner Road, built from the save: the fixed fittings (wardrobe, desk,
 * kitchen, gym, workbench) never move; everything you've bought sits where
 * you put it. The same rules decide whether a spot is free in the placement
 * editor and in the collision the game uses, so what you see is what you bump.
 */

/** Furniture stands against the back wall at most this far back... */
export const BACK_Z = -2.3;
/** ...and never reaches into the walkway along the front of the house. */
export const LANE_Z = 0.55;
/** Gap kept from the side walls. */
export const SIDE_MARGIN = 0.15;
export const FRONT_DOOR_X = -8;
/** The cellar door, under the stairs next to the front door. */
export const BASEMENT_DOOR_X = -6.4;
/** Pieces may not touch: keep this much air between them. */
const ALLOWED_GAP = 0.02;

export const HOME_BOUNDS = { minX: -26, maxX: 18, minZ: -1.8, maxZ: 1.4 };

/** Internal walls with a doorway at the front (z 0.1..1.4). */
export const HOME_WALLS = [
  { minX: -20.1, maxX: -19.9, minZ: -2.4, maxZ: 0.1 },
  { minX: -13.1, maxX: -12.9, minZ: -2.4, maxZ: 0.1 },
  { minX: -4.1, maxX: -3.9, minZ: -2.4, maxZ: 0.1 },
  { minX: 1.9, maxX: 2.1, minZ: -2.4, maxZ: 0.1 },
  { minX: 9.9, maxX: 10.1, minZ: -2.4, maxZ: 0.1 },
];

/** Fittings that come with the house. */
export const HOME_FIXTURES: PropDef[] = [
  // bathroom
  { kind: 'bath', x: -24.9, z: -1.9 },
  { kind: 'toilet', x: -23.2, z: -2.0 },
  { kind: 'basin', x: -22.1, z: -2.05 },
  // bedroom
  { kind: 'wardrobe', x: -15.4, z: -1.45 },
  { kind: 'desk', x: -13.9, z: -1.45 },
  { kind: 'furniture', item: 'bedside', x: -17.55, z: -2.08, size: [0.25, 0.22], colour: '#8a5a32' },
  // living room: the hall table with the phone
  { kind: 'table', x: -5.3, z: -1.3 },
  // kitchen
  { kind: 'counter', x: -1.2, z: -1.45 },
  { kind: 'cooker', x: -3.2, z: -1.45 },
  { kind: 'fridge', x: 1.3, z: -1.45 },
  // gym
  { kind: 'weights', x: 3.4, z: -1.4 },
  { kind: 'bag', x: 8.6, z: -1.3 },
  { kind: 'rack', x: 6, z: -1.6 },
  // garage: no car any more, it's the bike store
  { kind: 'workbench', x: 16.6, z: -1.4 },
  { kind: 'chest', x: 14.2, z: -1.55 },
  { kind: 'tyre_stack', x: 15.5, z: 0.1 },
];

const FIXED_STATIONS: StationDef[] = [
  { id: 'wardrobe', x: -15.4, z: -0.8, label: 'Wardrobe: change your look' },
  { id: 'mirror', x: -16.9, z: -1.15, label: 'Mirror: check yourself' },
  { id: 'contacts', x: -5.3, z: -0.75, label: 'Phone: contacts' },
  { id: 'planner', x: -4.55, z: -0.8, label: 'Home planner: furniture, floors and walls' },
  { id: 'tin', x: -13.9, z: -0.9, label: 'Biscuit tin: your savings' },
  { id: 'kitchen', x: -1.2, z: -0.85, label: 'Kitchen: eat and recover' },
  { id: 'gym', x: 3.4, z: -0.75, label: 'Gym: train and learn' },
  { id: 'sparring', x: 7.6, z: 0.2, label: 'Spar with Mo' },
  { id: 'garage', x: 16.6, z: -0.75, label: 'Workbench: repair weapons' },
  { id: 'storage', x: 14.2, z: -0.9, label: 'Stash: your storage chest' },
  { id: 'bike_rack', x: 12.4, z: 0.75, label: 'Bike store: take a bike out or put one away' },
];

export const HOME_CONTAINERS: ContainerDef[] = [
  { id: 'bedside', kind: 'drawers', x: -17.55, z: -1.6, label: 'Search the bedside drawers', fixed: [{ id: 'coin_silver', qty: 2 }, { id: 'plasters', qty: 2 }] },
  { id: 'cupboards', kind: 'cupboard', x: 0.6, z: -0.9, label: 'Search the kitchen cupboards', loot: 'cupboard' },
];

/** Bike bays in the garage: pointing into the room, side by side. */
export const GARAGE_SLOTS = [10.75, 11.65, 12.55].slice(0, GARAGE_SPACES).map((x) => ({ x, z: -0.85 }));

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const overlap = (a: Box, b: Box, gap = 0) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;

/** Spots that must stay clear so every station, cupboard and door can be reached from the walkway. */
function clearZones(): Box[] {
  const z: Box[] = [];
  for (const s of FIXED_STATIONS) z.push({ minX: s.x - 0.4, maxX: s.x + 0.4, minZ: s.z - 0.3, maxZ: 1.4 });
  for (const c of HOME_CONTAINERS) z.push({ minX: c.x - 0.4, maxX: c.x + 0.4, minZ: c.z - 0.3, maxZ: 1.4 });
  for (const d of [FRONT_DOOR_X, BASEMENT_DOOR_X]) z.push({ minX: d - 0.8, maxX: d + 0.8, minZ: -2.4, maxZ: 1.4 });
  return z;
}
const CLEAR = clearZones();

function fixtureBoxes(): Box[] {
  return HOME_FIXTURES.map((p) => {
    const [hx, hz] = propHalf(p);
    return { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz };
  });
}
const FIXED = fixtureBoxes();

/** Footprint of a piece at a spot (x/z half extents swap on quarter turns). */
export function footprint(def: FurnitureDef, at: { x: number; z: number; rot: number }): Box {
  let [hx, hz] = def.size;
  if (def.mount !== 'wall' && at.rot % 2 === 1) [hx, hz] = [hz, hx];
  return { minX: at.x - hx, maxX: at.x + hx, minZ: at.z - hz, maxZ: at.z + hz };
}

/** Where a wall piece hangs: its z is fixed against the back wall. */
export function wallZ(def: FurnitureDef): number {
  return BACK_Z - 0.03 + def.size[1];
}

export type PlacementCheck = { ok: true; room: RoomId } | { ok: false; reason: string };

/**
 * Can this piece go here? Checks the room, the walls, the walkway, doors,
 * stations, the fixed fittings and everything else you've placed.
 */
export function checkPlacement(prop: PropertySave, def: FurnitureDef, at: { x: number; z: number; rot: number }, ignoreUid?: string): PlacementCheck {
  const room = roomAt(at.x);
  if (!room) return { ok: false, reason: 'Pick a room you can decorate' };
  if (!allowedRooms(def).includes(room)) return { ok: false, reason: `That belongs in the ${allowedRooms(def).map((r) => ROOMS[r].name.toLowerCase()).join(' or ')}` };
  const r = ROOMS[room];
  const box = footprint(def, at);
  if (box.minX < r.x0 + SIDE_MARGIN || box.maxX > r.x1 - SIDE_MARGIN) return { ok: false, reason: 'Hits the wall' };
  const others = prop.furniture.filter((f) => f.uid !== ignoreUid && f.at && FURNITURE[f.id]);
  if (def.mount === 'wall') {
    if (Math.abs(at.x - FRONT_DOOR_X) < 0.75 + def.size[0]) return { ok: false, reason: 'That’s where the front door is' };
    if (Math.abs(at.x - BASEMENT_DOOR_X) < 0.75 + def.size[0]) return { ok: false, reason: 'That’s the basement door' };
    if (Math.abs(at.x - r.window) < (room === 'bathroom' ? 0.5 : 1.12) + def.size[0]) return { ok: false, reason: 'Covers the window' };
    if (room === 'bedroom' && Math.abs(at.x + 16.9) < 0.4 + def.size[0]) return { ok: false, reason: 'Covers the mirror' };
    for (const o of others) {
      const od = FURNITURE[o.id];
      if (od.mount !== 'wall') continue;
      const oy = od.wallY ?? 1.6;
      const y = def.wallY ?? 1.6;
      if (Math.abs(o.at!.x - at.x) < od.size[0] + def.size[0] + 0.05 && Math.abs(oy - y) < 0.6) return { ok: false, reason: `Overlaps the ${od.name.toLowerCase()}` };
    }
    return { ok: true, room };
  }
  if (box.minZ < BACK_Z - 0.001) return { ok: false, reason: 'Hits the wall' };
  if (def.tall && box.minZ < BACK_Z + 0.6 && box.minX < r.window + 1.0 && box.maxX > r.window - 1.0) return { ok: false, reason: 'Too tall to stand in front of the window' };
  if (box.maxZ > LANE_Z + 0.001) return { ok: false, reason: 'Blocks the walkway' };
  if (def.mount === 'rug') {
    for (const o of others) {
      const od = FURNITURE[o.id];
      if (od.mount === 'rug' && overlap(box, footprint(od, o.at!))) return { ok: false, reason: 'Overlaps another rug' };
    }
    return { ok: true, room };
  }
  for (const w of HOME_WALLS) if (overlap(box, w)) return { ok: false, reason: 'Hits the wall' };
  for (const c of CLEAR) if (overlap(box, c)) return { ok: false, reason: 'Blocks a door, cupboard or station' };
  for (const f of FIXED) if (overlap(box, f, ALLOWED_GAP)) return { ok: false, reason: 'Clips into the fittings' };
  for (const o of others) {
    const od = FURNITURE[o.id];
    if (od.mount !== 'floor') continue;
    if (overlap(box, footprint(od, o.at!), ALLOWED_GAP)) return { ok: false, reason: `Overlaps the ${od.name.toLowerCase()}` };
  }
  return { ok: true, room };
}

/** A sensible first spot for a new piece in a room: against the back wall, first free gap from the left. */
export function suggestSpot(prop: PropertySave, def: FurnitureDef, room: RoomId, ignoreUid?: string): PlacedAt | null {
  const r = ROOMS[room];
  const rots = def.mount === 'wall' ? [0] : [0, 1];
  for (const rot of rots) {
    let [hx, hz] = def.size;
    if (rot % 2 === 1 && def.mount !== 'wall') [hx, hz] = [hz, hx];
    const zs = def.mount === 'wall' ? [wallZ(def)] : [BACK_Z + hz, BACK_Z + hz + 0.4, LANE_Z - hz];
    for (const z of zs) {
      for (let x = r.x0 + SIDE_MARGIN + hx + 0.02; x <= r.x1 - SIDE_MARGIN - hx; x += 0.1) {
        const at = { room, x: Math.round(x * 10) / 10, z: Math.round(z * 100) / 100, rot };
        if (checkPlacement(prop, def, at, ignoreUid).ok) return at;
      }
    }
  }
  return null;
}

/** Where to sit down and save: in front of the first sofa or armchair, or a floor cushion. */
export function seatStation(prop: PropertySave): StationDef {
  for (const room of ['living', 'bedroom', 'kitchen'] as RoomId[]) {
    const seat = prop.furniture.find((f) => f.at?.room === room && FURNITURE[f.id]?.seat);
    if (seat) return { id: 'sofa', x: seat.at!.x, z: 0.75, label: `${FURNITURE[seat.id].name}: catch up and save` };
  }
  return { id: 'sofa', x: -10.6, z: 0.8, label: 'Floor cushion: catch up and save (buy a sofa!)' };
}

/** Props for the garage's bike bays. */
export function garageBikes(prop: PropertySave): PropDef[] {
  const inside = prop.bikes.filter((b) => !(prop.bikeOut && prop.bikeOut.uid === b.uid));
  return inside.slice(0, GARAGE_SLOTS.length).map((b, i) => ({
    kind: 'vehicle', item: b.id, colour: b.colour, x: GARAGE_SLOTS[i].x, z: GARAGE_SLOTS[i].z, rot: 1, size: [BIKE_SIZE[0], Math.max(0.28, BIKES[b.id].wheel * 0.8)] as [number, number],
  }));
}

/** The whole house from the save. */
export function buildHomeLevel(base: LevelDef, prop: PropertySave): LevelDef {
  const props: PropDef[] = [...HOME_FIXTURES, ...garageBikes(prop)];
  for (const f of prop.furniture) {
    const def = FURNITURE[f.id];
    if (!def || !f.at) continue;
    props.push({
      kind: 'furniture', item: f.id, colour: f.colour, x: f.at.x, z: f.at.z, rot: f.at.rot, size: def.size,
      solid: def.mount === 'floor', wallY: def.mount === 'wall' ? def.wallY : undefined,
    });
  }
  const facades = base.facades.map((fac) => {
    const room = ROOM_IDS.find((r) => ROOMS[r].name === fac.label);
    if (!room) return fac;
    const fin = prop.finishes[room];
    return { ...fac, floor: fin.floor, wall: fin.wall, windowX: ROOMS[room].window };
  });
  return {
    ...base,
    bounds: { ...HOME_BOUNDS },
    facades,
    walls: HOME_WALLS.map((w) => ({ ...w })),
    props,
    stations: [...FIXED_STATIONS, seatStation(prop)],
    containers: HOME_CONTAINERS.map((c) => ({ ...c })),
  };
}
