/**
 * Where the jewellery and property systems meet the streets: Halden & Crane
 * the jewellers in the Riverside Centre, Keys & Co the estate agents in
 * Meridian House, Ashcombe Park (the gated road of big houses off Leisure
 * Park), a front door on the street for every property for sale, and the
 * inside of each property, built from what kind of home it is.
 */
import type { EntryDef, ExitDef, FacadeDef, LevelDef, LightDef, PropDef, StationDef } from '../world/LevelTypes';
import { PROP_SIZE } from '../world/LevelTypes';
import { FURNITURE } from '../property/catalogue';
import type { AreaId } from '../progress/Progress';
import { PROPERTIES, PROPERTY_LIST, QUALITY_LABELS, formatPounds, type PropertyDef, type RoomKind } from './catalogue';

const ROOM = { minZ: -1.6, maxZ: 1.4 };
const F = (item: string, x: number, z: number, extra: Partial<PropDef> = {}): PropDef => ({
  kind: 'furniture', item, x, z, size: FURNITURE[item].size, colour: extra.colour ?? FURNITURE[item].colours[0], solid: FURNITURE[item].mount === 'floor', wallY: FURNITURE[item].wallY, ...extra,
});

// ---- Halden & Crane, jewellers (Riverside Centre) ----------------------------------------------
export const JEWELLER: LevelDef = {
  id: 'jeweller',
  name: 'Halden & Crane',
  district: 'Riverside Centre',
  theme: 'jeweller',
  bounds: { minX: 0, maxX: 18, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [{ id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'mall', toEntry: 'jeweller', label: 'Back out to the shopping centre' }],
  facades: [{ kind: 'interior', x0: 0, x1: 18, label: 'HALDEN & CRANE — FINE JEWELLERS SINCE 1962', colour: '#1c1c24' }],
  props: [
    { kind: 'display_cabinet', x: 3.2, z: -1.3, label: 'rings' },
    { kind: 'glass_counter', x: 5.6, z: -0.55 },
    { kind: 'display_cabinet', x: 7.6, z: -1.3, label: 'watches' },
    { kind: 'jewel_bust', x: 9.6, z: -1.35 },
    { kind: 'jewel_bust', x: 10.3, z: -1.35, colour: '#2a1a2a' },
    { kind: 'jewel_bust', x: 11.0, z: -1.35 },
    { kind: 'display_cabinet', x: 13.0, z: -1.3, label: 'grills' },
    { kind: 'shop_counter', x: 15.6, z: -0.6 },
    F('plant_tall', 17.4, -1.85, { colour: '#e8e4dc' }),
    F('wall_light', 4.4, -2.0, { colour: '#c9a227' }),
    F('wall_light', 12.0, -2.0, { colour: '#c9a227' }),
    F('rug_long', 9.0, 0.2, { colour: '#1f2a44', solid: false }),
  ],
  stations: [
    { id: 'jeweller_case', x: 3.2, z: -0.65, label: 'RINGS|Look at the rings', tab: 'ring' },
    { id: 'jeweller_case', x: 7.6, z: -0.65, label: 'WATCHES|Look at the watches', tab: 'watch' },
    { id: 'jeweller_case', x: 10.3, z: -0.75, label: 'NECKLACES|Look at the chains', tab: 'necklace' },
    { id: 'jeweller_case', x: 13.0, z: -0.65, label: 'GRILLS|Look at the grills', tab: 'grill' },
    {
      id: 'jeweller_counter', x: 15.6, z: 0.2, label: 'Talk to Marcus (buy, sell back)',
      npc: { name: 'Marcus', seed: 9152, body: 'male', top: 'tshirt', topColour: '#101014', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 3.2, y: 2.6, z: -0.8, colour: 0xfff4e0, intensity: 11, range: 6 },
    { x: 7.6, y: 2.6, z: -0.8, colour: 0xfff4e0, intensity: 11, range: 6 },
    { x: 10.3, y: 2.6, z: -0.8, colour: 0xfff0d8, intensity: 11, range: 6 },
    { x: 13.0, y: 2.6, z: -0.8, colour: 0xfff4e0, intensity: 11, range: 6 },
    { x: 15.6, y: 2.8, z: -0.4, colour: 0xffe8c8, intensity: 8, range: 7 },
  ],
  weather: 'indoors',
  objective: 'Browse the cases, buy at the counter. Everything you buy goes in your jewellery box',
};

// ---- Keys & Co, estate agents (Meridian House, City Centre) ------------------------------------
export const ESTATE_AGENT: LevelDef = {
  id: 'estate_agent',
  name: 'Keys & Co',
  district: 'City Centre',
  theme: 'estate_agent',
  bounds: { minX: 0, maxX: 14, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [{ id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'city', toEntry: 'agent', label: 'Back out to Market Square' }],
  facades: [{ kind: 'interior', x0: 0, x1: 14, label: 'KEYS & CO — SALES · LETTINGS · MANAGEMENT', colour: '#e8e4dc' }],
  props: [
    { kind: 'agent_board', x: 2.6, z: -1.9, label: 'FOR SALE', solid: false },
    { kind: 'agent_board', x: 3.6, z: -1.9, label: 'TO LET', solid: false },
    F('canvas_art', 5.4, -2.0, { colour: '#2a6aa8' }),
    { kind: 'computer_desk', x: 7.0, z: -0.5, size: [0.7, 0.35] },
    { kind: 'computer_desk', x: 10.4, z: -0.5, size: [0.7, 0.35] },
    F('armchair', 5.0, -1.7, { colour: '#3a4a6a' }),
    F('plant_tall', 12.6, -1.85),
    F('bookcase', 13.2, -1.95, { colour: '#e8e4dc' }),
    F('wall_clock', 8.7, -2.0),
  ],
  stations: [
    { id: 'agent_window', x: 3.1, z: -1.0, label: 'LISTINGS|Browse property for sale' },
    {
      id: 'agent_desk', x: 7.0, z: 0.25, label: 'Talk to Fiona (buy, sell, let, your portfolio)',
      npc: { name: 'Fiona', seed: 6203, body: 'female', top: 'tshirt', topColour: '#1f2a44', dz: -1.6 },
    },
    {
      id: 'agent_desk', x: 10.4, z: 0.25, label: 'Talk to Raj (lettings and your tenants)', tab: 'rentals',
      npc: { name: 'Raj', seed: 3318, body: 'male', top: 'tshirt', topColour: '#e8e4dc', dz: -1.6 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 3.5, y: 2.8, z: -0.4, colour: 0xfff4e8, intensity: 9, range: 8 },
    { x: 9.5, y: 2.8, z: -0.4, colour: 0xfff4e8, intensity: 9, range: 8 },
  ],
  weather: 'indoors',
  objective: 'Buy, sell and let property. Your whole portfolio is at the desk',
};

// ---- Ashcombe Park: the gated road off Leisure Park ---------------------------------------------
const STREET_Z = { minZ: -2, maxZ: 2 };
export const ASHCOMBE: LevelDef = {
  id: 'ashcombe',
  name: 'Ashcombe Park',
  district: 'Ashcombe Park',
  theme: 'ashcombe',
  bounds: { minX: 0, maxX: 196, ...STREET_Z },
  entries: [
    { id: 'gate', x: 3, z: 0, facing: 1 },
    { id: 'left', x: 2, z: 0, facing: 1 },
  ],
  exits: [{ id: 'to_leisure', kind: 'edge', side: 'left', x: 0, z: 0, to: 'leisure', toEntry: 'ashcombe', label: 'Leisure Park' }],
  facades: [
    { kind: 'fence', x0: 0, x1: 12 },
    { kind: 'semi', x0: 12, x1: 30 },
    { kind: 'office', x0: 30, x1: 44, label: 'ASHCOMBE TOWER' },
    { kind: 'tower', x0: 44, x1: 58, label: 'BELGRAVE MANSIONS' },
    { kind: 'mansion', x0: 58, x1: 74, label: 'WYVERN HALL', flags: ['brick'] },
    { kind: 'showroom', x0: 74, x1: 90 },
    { kind: 'office', x0: 90, x1: 106, label: 'THE PINNACLE' },
    { kind: 'mansion', x0: 106, x1: 126, label: 'ASHCOMBE MANOR', flags: ['georgian'] },
    { kind: 'mansion', x0: 126, x1: 146, label: 'THE GLASSHOUSE', flags: ['modern'] },
    { kind: 'mansion', x0: 146, x1: 166, label: 'HEATHFIELD HOUSE', flags: ['stone'] },
    { kind: 'mansion', x0: 166, x1: 186, label: 'KENSINGTON LODGE', flags: ['georgian'] },
    { kind: 'fence', x0: 186, x1: 196 },
  ],
  props: [
    { kind: 'security_post', x: 8, z: -1.85, item: 'post_high' },
    { kind: 'barrier', x: 10.5, z: 1.4 },
    { kind: 'car', x: 26, z: 1.4, colour: '#1a1a1a' },
    { kind: 'planter', x: 33, z: -1.55 },
    { kind: 'lamp_post', x: 46, z: -1.85 },
    { kind: 'car', x: 62, z: 1.4, colour: '#e8e4dc' },
    { kind: 'planter', x: 77.5, z: -1.55 },
    { kind: 'lamp_post', x: 92, z: -1.85 },
    { kind: 'car', x: 101, z: 1.4, colour: '#2a3a5a' },
    { kind: 'bench', x: 110, z: 1.55 },
    { kind: 'lamp_post', x: 128, z: -1.85 },
    { kind: 'car', x: 141, z: 1.4, colour: '#7a1414' },
    { kind: 'security_post', x: 149, z: -1.85, item: 'post_medium' },
    { kind: 'lamp_post', x: 168, z: -1.85 },
    { kind: 'car', x: 181, z: 1.4, colour: '#c9a227' },
    { kind: 'planter', x: 190, z: -1.55 },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 20, y: 4, z: 0, colour: 0xffe2b0, intensity: 14, range: 16 },
    { x: 66, y: 4, z: 0, colour: 0xffe2b0, intensity: 14, range: 16 },
    { x: 116, y: 4, z: 0, colour: 0xffe2b0, intensity: 14, range: 16 },
    { x: 156, y: 4, z: 0, colour: 0xffe2b0, intensity: 14, range: 16 },
  ],
  weather: 'clear',
  objective: 'Private road. The big houses are for sale through Keys & Co: have a look round',
};

/** Doors that lead to the new places from existing streets: [area, exit, matching entry]. */
const NEW_DOORS: { area: AreaId; exit: ExitDef; entry: EntryDef }[] = [
  {
    area: 'mall',
    exit: { id: 'jeweller_door', kind: 'door', x: 34, z: -1.6, to: 'jeweller', toEntry: 'door', shop: 'jeweller', label: 'Into Halden & Crane (jewellers)' },
    entry: { id: 'jeweller', x: 34, z: -1.0, facing: -1 },
  },
  {
    area: 'city',
    exit: { id: 'agent_door', kind: 'door', x: 9, z: -1.6, to: 'estate_agent', toEntry: 'door', label: 'Into Keys & Co (estate agents)' },
    entry: { id: 'agent', x: 9, z: -1.0, facing: 1 },
  },
  {
    area: 'leisure',
    exit: { id: 'ashcombe_gate', kind: 'door', x: 4, z: -1.6, to: 'ashcombe', toEntry: 'gate', label: 'Ashcombe Road (private estate)' },
    entry: { id: 'ashcombe', x: 4, z: -1.0, facing: 1 },
  },
];

const exitId = (id: string) => `prop_${id}`;

/** Put every property's front door, the jeweller's, the agent's and the Ashcombe gate on their streets. */
export function addPropertyDoors(levels: Record<AreaId, LevelDef>): void {
  for (const d of NEW_DOORS) {
    const l = levels[d.area];
    if (!l.exits.some((e) => e.id === d.exit.id)) l.exits.push(d.exit);
    if (!l.entries.some((e) => e.id === d.entry.id)) l.entries.push(d.entry);
  }
  for (const p of PROPERTY_LIST) {
    const l = levels[p.area];
    if (l.exits.some((e) => e.id === exitId(p.id))) continue;
    l.exits.push({ id: exitId(p.id), kind: 'door', x: p.x, z: -1.6, to: 'property', toEntry: p.id, label: `${p.name}: ${p.type.toLowerCase()} for sale` });
    l.entries.push({ id: exitId(p.id), x: p.x, z: -1.0, facing: 1 });
  }
}

/** What a property's door says and does, for this save: see realty/levels in property/levels.ts. */
export interface DoorState {
  label: string;
  locked?: string;
  board?: string;
}

/** Put the door labels, locks and agents' boards on a street for this save. */
export function dressStreet(level: LevelDef, state: (id: string) => DoorState): LevelDef {
  const here = PROPERTY_LIST.filter((p) => p.area === level.id);
  if (!here.length) return level;
  const props: PropDef[] = [];
  const exits = level.exits.map((e) => {
    const p = e.to === 'property' ? PROPERTIES[e.toEntry] : undefined;
    if (!p) return e;
    const s = state(p.id);
    if (s.board) props.push({ kind: 'agent_board', x: p.x + (p.cat === 'mansion' ? -2.6 : 1.3), z: -1.85, label: s.board, solid: false });
    return s.locked ? { ...e, label: s.label, requires: 'never:let', lockedText: s.locked } : { ...e, label: s.label };
  });
  return { ...level, exits, props: [...level.props, ...props] };
}

// ---- inside a property ----------------------------------------------------------------------------

const ROOM_NAMES: Record<RoomKind, string> = {
  hall: 'Hallway', living: 'Living room', kitchen: 'Kitchen', dining: 'Dining room', bedroom: 'Bedroom', master: 'Master bedroom',
  bathroom: 'Bathroom', ensuite: 'En-suite', studio: 'Studio', study: 'Study', cinema: 'Cinema room', games: 'Games room', gym: 'Home gym',
  bar: 'Bar', pool: 'Pool room', dressing: 'Dressing room', conservatory: 'Conservatory', terrace: 'Roof terrace',
};
const ROOM_WIDTH: Record<RoomKind, number> = {
  hall: 3.4, living: 6.2, kitchen: 4.6, dining: 4.6, bedroom: 4.4, master: 5.6, bathroom: 3.4, ensuite: 3.0, studio: 7.4, study: 4.2,
  cinema: 6.0, games: 6.6, gym: 5.6, bar: 5.0, pool: 9.0, dressing: 3.8, conservatory: 5.4, terrace: 5.6,
};
const WET: RoomKind[] = ['kitchen', 'bathroom', 'ensuite', 'pool'];

/** Floors and walls by fit-out: [floor, wall] for dry rooms, then wet rooms. */
const FINISH_BY_QUALITY: Record<number, { dry: [string, string][]; wet: [string, string] }> = {
  1: { dry: [['f_grey_carpet', 'w_magnolia'], ['f_grey_carpet', 'w_white']], wet: ['f_stone_tiles', 'w_tiles'] },
  2: { dry: [['f_cream_carpet', 'w_magnolia'], ['f_oak', 'w_sage'], ['f_plum_carpet', 'w_slate_blue']], wet: ['f_stone_tiles', 'w_tiles'] },
  3: { dry: [['f_oak', 'w_white'], ['f_cream_carpet', 'w_sage'], ['f_oak', 'w_stripes']], wet: ['f_stone_tiles', 'w_tiles'] },
  4: { dry: [['f_walnut', 'w_charcoal'], ['f_oak', 'w_brick'], ['f_cream_carpet', 'w_navy']], wet: ['f_slate_tiles', 'w_tiles'] },
  5: { dry: [['f_walnut', 'w_panelling'], ['f_check_tiles', 'w_stripes'], ['f_walnut', 'w_charcoal'], ['f_cream_carpet', 'w_navy']], wet: ['f_slate_tiles', 'w_tiles'] },
};

const FABRIC_BY_Q = ['', '#5a5a5e', '#3a4a6a', '#4a5a3a', '#2a2a2e', '#7a2a2a'];
const WOOD_BY_Q = ['', '#c8a070', '#c8a070', '#8a5a32', '#4a2e1a', '#2a2a2e'];

/** What goes in each kind of room, best fit-out last; pieces that don't fit the wall are left out. */
function furnishing(kind: RoomKind, q: number): (string | PropDef['kind'])[] {
  const posh = q >= 4;
  switch (kind) {
    case 'hall':
      return ['table', posh ? 'painting' : 'wall_clock', 'plant_small'];
    case 'living':
      return [posh ? 'arc_lamp' : 'floor_lamp', q >= 2 ? 'sofa_3' : 'sofa_2', 'coffee_table', posh ? 'tv_65' : 'tv_43', 'armchair', 'bookcase', posh ? 'canvas_art' : 'painting'];
    case 'studio':
      return ['bed_single', 'sofa_2', 'tv_43', 'counter', 'cooker', 'fridge', 'poster_frame'];
    case 'kitchen':
      return ['cooker', 'counter', q >= 3 ? 'fridge2' : 'fridge', posh ? 'island' : 'washer', 'wall_cupboards'];
    case 'dining':
      return ['dining_chair', 'dining_table', 'dining_chair', posh ? 'painting' : 'wall_clock', 'plant_tall'];
    case 'bedroom':
      return [q >= 2 ? 'bed_double' : 'bed_single', 'bedside', 'wardrobe2', 'drawers', 'poster_frame'];
    case 'master':
      return ['bedside', 'bed_double', 'bedside', 'wardrobe2', 'mirror_stand', posh ? 'tv_65' : 'painting'];
    case 'bathroom':
    case 'ensuite':
      return ['bath', 'toilet', 'basin', 'bath_cabinet', 'towel_rail'];
    case 'study':
      return ['bookcase', 'desk2', 'armchair', 'bookcase', 'wall_clock'];
    case 'cinema':
      return ['sofa_3', 'tv_65', 'sofa_3', 'neon_sign'];
    case 'games':
      return ['pool_table', 'jukebox', 'fruit_machine', 'neon_sign'];
    case 'gym':
      return ['weights', 'bag', 'rack', 'mirror_stand'];
    case 'bar':
      return ['bar', 'wall_shelf', 'neon_sign', 'pub_table'];
    case 'pool':
      return ['plant_tall', 'fountain', 'bench', 'plant_tall'];
    case 'dressing':
      return ['wardrobe2', 'mirror_stand', 'drawers', 'trophy_cab'];
    case 'conservatory':
      return ['plant_tall', 'armchair', 'coffee_table', 'armchair', 'plant_tall'];
    case 'terrace':
      return ['plant_tall', 'bench', 'arc_lamp', 'plant_tall'];
  }
}

const BACK_Z = -2.3;

/**
 * The inside of a property: its rooms side by side along the walkway, each with its own floor, walls and
 * furniture, front door in the hallway. `as` says whether you're viewing it (the brochure) or it's yours.
 */
export function buildPropertyInterior(p: PropertyDef, as: 'viewing' | 'owner', personal: boolean, priceText: string): LevelDef {
  const scale = [0, 0.85, 0.92, 1, 1.08, 1.2][p.quality];
  const fin = FINISH_BY_QUALITY[p.quality];
  const facades: FacadeDef[] = [];
  const props: PropDef[] = [];
  const walls: NonNullable<LevelDef['walls']> = [];
  const lights: LightDef[] = [];
  const stations: StationDef[] = [];
  let x = 0;
  let dry = 0;
  let bedX: number | null = null;
  p.rooms.forEach((kind, i) => {
    // A hall with stairs needs room for the front door and the flight side by side.
    const w = Math.max(kind === 'hall' && p.stairs ? 4.4 : 0, Math.round(ROOM_WIDTH[kind] * scale * 10) / 10);
    const x0 = x;
    const x1 = x + w;
    const [floor, wall] = WET.includes(kind) ? fin.wet : fin.dry[dry++ % fin.dry.length];
    facades.push({ kind: 'room', x0, x1, label: ROOM_NAMES[kind], floor, wall });
    if (i > 0) walls.push({ minX: x0 - 0.1, maxX: x0 + 0.1, minZ: -2.4, maxZ: 0.1 });
    lights.push({ x: (x0 + x1) / 2, y: 2.6, z: -0.3, colour: WET.includes(kind) ? 0xf4f6ff : p.quality >= 4 ? 0xffe0b0 : 0xffd8a0, intensity: 9, range: Math.max(7, w + 2) });
    // Stairs up from the hallway.
    let cursor = x0 + 0.35;
    if (kind === 'hall') {
      if (p.stairs) {
        props.push({ kind: 'staircase', x: x1 - 1.25, z: -1.75, size: [1.1, 0.5], colour: WOOD_BY_Q[p.quality] });
      }
      cursor = x0 + 1.9;
    }
    const limit = kind === 'hall' && p.stairs ? x1 - 2.5 : x1 - 0.3;
    for (const item of furnishing(kind, p.quality)) {
      const fdef = FURNITURE[item];
      if (fdef) {
        const [hx, hz] = fdef.size;
        if (fdef.mount === 'wall') {
          // Wall pieces hang over whatever's in the middle of the room.
          props.push(F(item, (x0 + x1) / 2 + (props.length % 2 ? -0.6 : 0.6), -2.25, { colour: fdef.colours[(p.quality + i) % fdef.colours.length] }));
          continue;
        }
        if (cursor + hx * 2 > limit) continue;
        const colour = fdef.cat === 'living' || fdef.cat === 'bedroom' ? (fdef.colours.includes(FABRIC_BY_Q[p.quality]) ? FABRIC_BY_Q[p.quality] : fdef.colours[0]) : fdef.colours.includes(WOOD_BY_Q[p.quality]) ? WOOD_BY_Q[p.quality] : fdef.colours[0];
        const mount = fdef.mount === 'rug' ? { z: -0.9 } : { z: BACK_Z + hz };
        props.push(F(item, cursor + hx, mount.z, { colour }));
        if ((item === 'bed_double' || item === 'bed_single') && bedX === null) bedX = cursor + hx;
        if (fdef.mount !== 'rug') cursor += hx * 2 + 0.2;
      } else {
        const k = item as PropDef['kind'];
        const [hx, hz] = PROP_SIZE[k];
        if (cursor + hx * 2 > limit) continue;
        props.push({ kind: k, x: cursor + hx, z: Math.max(-1.95, BACK_Z + hz), ...(k === 'fountain' ? { size: [0.9, 0.5] as [number, number] } : {}) });
        cursor += hx * 2 + 0.25;
      }
    }
    x = x1;
  });
  const hallMid = 1.0;
  const exits: ExitDef[] = [{ id: 'front_door', kind: 'door', x: 0.9, z: -1.4, to: p.area, toEntry: exitId(p.id), label: 'Go out (front door)' }];
  const entries: EntryDef[] = [{ id: p.id, x: 1.4, z: -0.4, facing: 1 }];
  stations.push({
    id: 'prop_info', x: hallMid + 1.2, z: 0.3,
    label: as === 'viewing' ? `BROCHURE|${p.type}, ${priceText}: details and buy` : `YOUR PROPERTY|${p.name}: let, sell or manage`,
  });
  if (as === 'owner' && personal && bedX !== null) stations.push({ id: 'prop_rest', x: bedX, z: -0.15, label: 'BED|Rest here' });
  return {
    id: 'property',
    name: p.name,
    district: p.locality,
    theme: 'home',
    bounds: { minX: 0, maxX: x, minZ: -1.8, maxZ: 1.4 },
    entries,
    exits,
    facades,
    walls,
    props,
    pickups: [],
    encounters: [],
    stations,
    lights,
    weather: 'indoors',
    objective: as === 'viewing' ? `Viewing: ${p.type.toLowerCase()}, ${QUALITY_LABELS[p.quality].toLowerCase()} fit-out. The brochure's in the hall` : personal ? `${p.name}. Yours` : `${p.name}. Yours, on the market to let`,
  };
}

/**
 * The fixed stand-in for the inside of a property (the real one is built from the save when you go in).
 * It has an entry for every property so every front door on the street leads somewhere.
 */
export function propertyPlaceholder(): LevelDef {
  const first = PROPERTY_LIST[0];
  const base = buildPropertyInterior(first, 'viewing', false, formatPounds(first.price));
  return { ...base, entries: PROPERTY_LIST.map((p) => ({ id: p.id, x: 1.4, z: -0.4, facing: 1 as const })) };
}
