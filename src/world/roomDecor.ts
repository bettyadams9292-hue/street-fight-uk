/**
 * Dressing for rooms at their real depth: approved models (the interior furniture pack and the other approved
 * sets) that make a room read as what it is, on the floor in front of the walkway, against the side walls and in
 * the corners. They're props of kind 'decor' (drawn from the approved prototypes, solid at their real size).
 *
 * Every set is laid out relative to the room (x0..x1), and `addDecor` drops any piece that would touch something
 * already there (bought furniture, fittings, walls, the walkway, the stations), so a room dressed this way never
 * blocks anything you use.
 */
import { DECOR_SIZE } from './decorSizes';
import { propBox, type LevelDef, type PropDef } from './LevelTypes';

/** The walkway along the front of every room stays clear: decor stands at this z or further forward. */
export const DECOR_MIN_Z = 1.75;

/** A piece of decor: an approved model id, where, which way it faces (rot as for any prop: 1 faces -x, 3 faces +x). */
export function D(id: string, x: number, z: number, extra: Partial<PropDef> = {}): PropDef {
  const s = DECOR_SIZE[id] ?? [0.3, 0.3, 1];
  return { kind: 'decor', item: id, x, z, size: [s[0], s[1]], ...extra };
}

/** Half size of a piece once turned. */
function half(id: string, rot = 0): [number, number] {
  const s = DECOR_SIZE[id] ?? [0.3, 0.3, 1];
  return rot % 2 === 1 ? [s[1], s[0]] : [s[0], s[1]];
}

type Side = 'left' | 'right' | 'mid';
interface Slot { id: string; side: Side; z: number; rot?: number; dx?: number; colour?: string }

/** Against a side wall (facing into the room) or in the middle, `dx` along from there. */
function place(x0: number, x1: number, s: Slot): PropDef {
  // Facing the front (the camera) unless a slot says otherwise: a piece side-on to the view reads as a dark slab.
  const rot = s.rot ?? 0;
  const [hx] = half(s.id, rot);
  const m = 0.12;
  const x = s.side === 'left' ? x0 + m + hx + (s.dx ?? 0) : s.side === 'right' ? x1 - m - hx - (s.dx ?? 0) : (x0 + x1) / 2 + (s.dx ?? 0);
  return D(s.id, x, s.z, { rot, ...(s.colour ? { colour: s.colour } : {}) });
}

export type DecorRoom = 'living' | 'kitchen' | 'dining' | 'bedroom' | 'bathroom' | 'hall' | 'study' | 'garage' | 'utility' | 'office';

/** What each kind of room has round its edges. Ordered by importance: in a narrow room the later ones drop out. */
const SETS: Record<DecorRoom, Slot[]> = {
  living: [
    { id: 'f01_06', side: 'left', z: 3.0 }, // cube shelving
    { id: 'f04_16', side: 'right', z: 4.4 }, // club armchair
    { id: 'f02_13', side: 'right', z: 3.4 }, // side table
    { id: 'f03_06', side: 'left', z: 4.7 }, // low sideboard
    { id: 'pottedTree', side: 'right', z: 2.2 },
  ],
  kitchen: [
    { id: 'f03_19', side: 'left', z: 2.3 }, // pantry cabinet
    { id: 'f02_01', side: 'mid', z: 3.9, dx: 0.6 }, // round table
    { id: 'f04_04', side: 'mid', z: 3.9, dx: -0.15, rot: 3 }, // Windsor chairs either side
    { id: 'f04_04', side: 'mid', z: 3.9, dx: 1.35, rot: 1 },
    { id: 'f01_17', side: 'right', z: 2.4 }, // open shelving
    { id: 'clothesAirer', side: 'right', z: 4.9 },
  ],
  dining: [
    { id: 'f03_08', side: 'left', z: 3.0 }, // Welsh dresser
    { id: 'f03_07', side: 'right', z: 3.0 }, // long sideboard
    { id: 'f03_27', side: 'left', z: 4.8 }, // drinks cabinet
    { id: 'pottedTree', side: 'right', z: 4.9 },
  ],
  bedroom: [
    { id: 'f03_13', side: 'left', z: 2.4 }, // chest of drawers
    { id: 'f02_22', side: 'right', z: 2.6 }, // dressing table
    { id: 'f06_12', side: 'right', z: 2.6, dx: 0.75 }, // its stool
    { id: 'f06_13', side: 'mid', z: 4.9 }, // storage bench
    { id: 'f03_14', side: 'left', z: 4.4 }, // tallboy
  ],
  bathroom: [
    { id: 'f01_25', side: 'right', z: 2.1 }, // bathroom shelf
    { id: 'clothesAirer', side: 'left', z: 4.4 },
    { id: 'f03_20', side: 'right', z: 4.6 }, // vanity unit
  ],
  hall: [
    { id: 'f06_14', side: 'left', z: 2.1 }, // coat stand
    { id: 'f06_15', side: 'right', z: 2.3 }, // shoe bench
    { id: 'f02_16', side: 'left', z: 3.6 }, // hallway table
    { id: 'pottedTree', side: 'right', z: 4.6 },
  ],
  study: [
    { id: 'f02_18', side: 'mid', z: 3.6 }, // office desk
    { id: 'f04_10', side: 'mid', z: 4.35, rot: 2 }, // executive chair at it
    { id: 'f03_22', side: 'left', z: 2.2 }, // filing cabinet
    { id: 'f01_21', side: 'right', z: 2.4 }, // magazine shelf
    { id: 'f03_30', side: 'right', z: 4.7 }, // record cabinet
  ],
  office: [
    { id: 'f03_22', side: 'left', z: 2.2 },
    { id: 'f03_22', side: 'left', z: 2.2, dx: 0.6 },
    { id: 'waitingSofa', side: 'right', z: 4.6 },
    { id: 'pottedTree', side: 'right', z: 2.3 },
    { id: 'f05_25', side: 'left', z: 4.8 }, // hallway bench
  ],
  garage: [
    // Racking down both side walls, turned to face into the garage; boxes stacked in the front corner.
    { id: 'f01_18', side: 'left', z: 2.6, rot: 3 }, // metal utility rack
    { id: 'storageRack', side: 'left', z: 4.4, rot: 3 },
    { id: 'f03_24', side: 'right', z: 2.4, rot: 1 }, // utility cupboard
    { id: 'oilDrum', side: 'right', z: 3.5 },
    { id: 'cardboardBox', side: 'mid', z: 5.1, dx: -2.6 },
    { id: 'cardboardBox', side: 'mid', z: 5.1, dx: -1.95 },
  ],
  utility: [
    { id: 'laundretteWasher', side: 'left', z: 2.2 },
    { id: 'clothesAirer', side: 'right', z: 3.4 },
    { id: 'f01_16', side: 'left', z: 4.4 }, // pantry shelving
  ],
};

/** A room's dressing, before anything is checked against it. */
export function roomDecor(kind: DecorRoom, x0: number, x1: number): PropDef[] {
  return SETS[kind].map((s) => place(x0, x1, s));
}

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const hit = (a: Box, b: Box, gap: number) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;

/**
 * Add decor to a level's props, keeping only pieces that touch nothing: other props, walls, stations (with room to
 * stand at them), exits, and the walkway in front (z under DECOR_MIN_Z). Also inside the level's floor.
 */
export function addDecor(level: Pick<LevelDef, 'props' | 'walls' | 'stations' | 'exits' | 'bounds'>, decor: PropDef[], frontZ: number): PropDef[] {
  const taken: Box[] = [];
  for (const p of level.props) {
    const b = propBox(p);
    if (b) taken.push(b);
  }
  for (const w of level.walls ?? []) taken.push(w);
  for (const s of level.stations ?? []) taken.push({ minX: s.x - 0.5, maxX: s.x + 0.5, minZ: s.z - 0.6, maxZ: s.z + 0.8 });
  for (const e of level.exits) taken.push({ minX: e.x - 0.8, maxX: e.x + 0.8, minZ: -3, maxZ: 1.7 });
  const out: PropDef[] = [];
  for (const d of decor) {
    // On the back wall (a dartboard, a clock): only kept clear of other wall pieces.
    if (d.wallY !== undefined) {
      out.push({ ...d, solid: false });
      continue;
    }
    const b = propBox(d)!;
    if (b.minZ < DECOR_MIN_Z || b.maxZ > frontZ - 0.25) continue;
    if (b.minX < level.bounds.minX + 0.05 || b.maxX > level.bounds.maxX - 0.05) continue;
    if (taken.some((t) => hit(b, t, 0.08))) continue;
    taken.push(b);
    out.push(d);
  }
  return out;
}
