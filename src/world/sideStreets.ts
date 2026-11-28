import type { AreaId } from '../progress/Progress';
import type { ExitDef, LevelDef } from './LevelTypes';

/**
 * Side streets: the town off the main road.
 *
 * The main road is the long street (world/strip.ts): every district end to end, walked without a stop. Side streets
 * leave it at junctions, gaps in the frontage you turn into with USE ("Turn into Mill Lane"), and come back out onto
 * it somewhere else, so there's more than one way between places and the town has loops rather than one line.
 *
 * Each side street is an ordinary outdoor area with its own id, built from the same kits as the main road
 * (city/street.ts registers how it's built). Its two ends are edges: walk off either end and you come out at the
 * junction on the street it joins. A junction only opens where the street on the far side is open by the main
 * road too (the same story flag), so a side street is a different way, never a way round the story
 * (tests/streetGraph.test.ts checks every flag stage).
 *
 * No Three.js here: the simulation, the map and the tests read it.
 */

/** Half the width of the gap in the frontage at a junction (the same as a subway stairwell's). */
export const JUNCTION_GAP = 1.9;

/** Is this exit a turn into a side street (or back out onto the main road through one)? */
export function isJunction(e: ExitDef): boolean {
  return e.kind === 'door' && e.junction === true;
}

/** Where a side street meets another street: the junction's place on that street, and what opens it. */
interface JunctionEnd {
  /** The street it joins. */
  street: AreaId;
  /** Where along that street the junction is (the gap in its frontage). */
  x: number;
  /** Story flag needed to come out onto `street` this way (the same flag its main-road seam needs). */
  requires?: string;
  lockedText?: string;
}

export interface SideStreet {
  level: LevelDef;
  /** Its west end (minX) comes out here... */
  left: JunctionEnd;
  /** ...and its east end (maxX) here. */
  right: JunctionEnd;
  /** What kind of way it is, for the map and the prompt. */
  kind: 'lane' | 'towpath' | 'footpath' | 'passage' | 'service';
}

const LANE = { minZ: -1.6, maxZ: 1.6 };

// ---- Mill Lane: the back lane behind the terraces, Hollins to the Back Alleys ------------------------------------

const millLane: LevelDef = {
  id: 'mill_lane',
  name: 'Mill Lane',
  district: 'Back Alleys',
  theme: 'alleys',
  bounds: { minX: 0, maxX: 64, ...LANE },
  entries: [],
  exits: [],
  facades: [
    { kind: 'terrace', x0: 0, x1: 14, label: 'back' },
    { kind: 'garages', x0: 14, x1: 24 },
    { kind: 'hoarding', x0: 24, x1: 34 },
    { kind: 'terrace', x0: 34, x1: 50, label: 'back' },
    { kind: 'hoarding', x0: 50, x1: 56 },
    { kind: 'terrace', x0: 56, x1: 64, label: 'back' },
  ],
  props: [
    { kind: 'bin', x: 5, z: -1.25 },
    { kind: 'bin', x: 5.8, z: -1.25, colour: '#2d5a2d' },
    { kind: 'rubbish_bags', x: 12, z: -1.3 },
    { kind: 'pallets', x: 27, z: 1.0 },
    { kind: 'skip', x: 31, z: -1.0 },
    { kind: 'bin', x: 41, z: -1.25, colour: '#2a3f7a' },
    { kind: 'cardboard', x: 47, z: -1.25 },
    { kind: 'drum', x: 53, z: -1.2 },
  ],
  pickups: [
    { id: 'garage_tin', kind: 'secret', x: 19, z: -1.5, label: 'In the back of an open garage', reward: { cash: 45, items: ['beanie'] } },
    { id: 'coins', kind: 'cash', x: 37, z: 0.9, amount: 15 },
    { id: 'plank', kind: 'item', item: 'w_pipe', x: 58, z: 0.7 },
  ],
  containers: [
    { id: 'bins', kind: 'bin', x: 5.4, z: -0.6, label: 'Search the wheelie bins', loot: 'bin' },
    { id: 'skip', kind: 'skip', x: 31, z: -0.1, label: 'Search the skip', loot: 'skip' },
  ],
  breakables: [{ id: 'boxes', kind: 'boxes', x: 44, z: 1.1, hp: 1, loot: 'bin' }],
  encounters: [
    // The lane has its regulars: a couple of lads who don't like strangers cutting through.
    { id: 'lane_lads', triggerX: 34, lock: [24, 46], optional: true, waves: [{ enemies: [{ archetype: 'hooded' }, { archetype: 'thug' }] }], reward: { cash: 30, xp: 90 } },
  ],
  lights: [
    { x: 8, y: 3.4, z: -0.6, colour: 0xffd9a0, intensity: 8, range: 10 },
    { x: 32, y: 3.4, z: -0.6, colour: 0xffd9a0, intensity: 8, range: 10 },
    { x: 56, y: 3.4, z: -0.6, colour: 0x9cc4ff, intensity: 8, range: 10 },
  ],
  weather: 'clear',
  objective: 'A back way from Hollins to the alleys',
};

// ---- The Canal Towpath: along the water, the Industrial Quarter to the Canal Docks --------------------------------

const towpath: LevelDef = {
  id: 'canal_towpath',
  name: 'The Canal Towpath',
  district: 'Canal Docks',
  theme: 'docks',
  bounds: { minX: 0, maxX: 70, ...LANE },
  entries: [],
  exits: [],
  facades: [
    { kind: 'dock', x0: 0, x1: 12 },
    { kind: 'warehouse', x0: 12, x1: 34 },
    { kind: 'hoarding', x0: 34, x1: 42 },
    { kind: 'dock', x0: 42, x1: 60 },
    { kind: 'containers', x0: 60, x1: 70 },
  ],
  props: [
    { kind: 'bollard_dock', x: 7, z: 1.3 },
    { kind: 'pallets', x: 16, z: -1.2 },
    { kind: 'bench', x: 24, z: -1.4 },
    { kind: 'bollard_dock', x: 30, z: 1.3 },
    { kind: 'drum', x: 38, z: -1.2 },
    { kind: 'crates', x: 49, z: -1.1 },
    { kind: 'bollard_dock', x: 55, z: 1.3 },
    { kind: 'lamp_post', x: 63, z: -1.4 },
  ],
  pickups: [
    { id: 'lock_keeper', kind: 'secret', x: 39.5, z: -1.5, label: 'Behind the old lock-keeper’s hut', reward: { cash: 80, items: ['first_aid'] } },
    { id: 'tenner', kind: 'cash', x: 20, z: 0.8, amount: 10 },
    { id: 'hook', kind: 'item', item: 'w_pipe', x: 52, z: 0.8 },
  ],
  containers: [
    { id: 'crates', kind: 'crate', x: 49, z: -0.4, label: 'Search the crates', loot: 'crate' },
  ],
  breakables: [{ id: 'pallets', kind: 'pallet', x: 16, z: -0.5, hp: 2, drops: 'plank' }],
  encounters: [
    { id: 'towpath_crew', triggerX: 44, lock: [34, 58], optional: true, waves: [{ enemies: [{ archetype: 'docker' }, { archetype: 'thug' }] }], reward: { cash: 45, xp: 120 } },
  ],
  lights: [
    { x: 10, y: 3.6, z: -0.6, colour: 0xffb060, intensity: 9, range: 11 },
    { x: 36, y: 3.6, z: -0.6, colour: 0xffb060, intensity: 9, range: 11 },
    { x: 62, y: 3.6, z: -0.6, colour: 0xffb060, intensity: 9, range: 11 },
  ],
  weather: 'clear',
  objective: 'A quiet way along the canal to the docks',
};


// ---- the rest of the town's side streets (Stage B) -----------------------------------------------------------------

type Bits = Pick<LevelDef, 'id' | 'name' | 'district' | 'theme' | 'facades' | 'props' | 'pickups' | 'encounters' | 'lights' | 'objective'> &
  Partial<Pick<LevelDef, 'containers' | 'breakables'>> & { length: number; narrow?: boolean };

/** A side street from its own parts: the bits that make it itself; the ends and arrivals are added by addSideStreets. */
function side(b: Bits): LevelDef {
  const { length, narrow, ...rest } = b;
  return { ...rest, bounds: { minX: 0, maxX: length, ...(narrow ? LANE : { minZ: -2, maxZ: 2 }) }, entries: [], exits: [], weather: 'clear' };
}

const WARM = 0xffc98a;
const SODIUM = 0xffb060;
const COLD = 0x9cc4ff;
const lamps = (xs: number[], colour: number, intensity = 9): LevelDef['lights'] => xs.map((x) => ({ x, y: 3.6, z: -0.6, colour, intensity, range: 11 }));

/** The footpath across the estate's green, Tanner Road to Leisure Park: the way the kids go to the baths. */
const tannerFootpath = side({
  id: 'tanner_footpath', name: 'Tanner Footpath', district: 'Home Estate', theme: 'residential', length: 56, narrow: true,
  facades: [
    { kind: 'terrace', x0: 0, x1: 12, label: 'back' },
    { kind: 'garages', x0: 12, x1: 22 },
    { kind: 'semi', x0: 22, x1: 38 },
    { kind: 'terrace', x0: 38, x1: 56, label: 'back' },
  ],
  props: [
    { kind: 'bench', x: 9, z: -1.35 },
    { kind: 'bin', x: 11, z: -1.25 },
    { kind: 'trolley', x: 26, z: 1.0 },
    { kind: 'planter', x: 33, z: -1.3 },
    { kind: 'bike_rack', x: 45, z: -1.35 },
  ],
  pickups: [
    { id: 'den', kind: 'secret', x: 16.5, z: -1.45, label: 'In the kids’ den behind the garages', reward: { cash: 25, items: ['energy_drink', 'cap_black'] } },
    { id: 'quid', kind: 'cash', x: 30, z: 0.7, amount: 5 },
    { id: 'chips', kind: 'item', item: 'chips', x: 48, z: -0.8 },
  ],
  containers: [{ id: 'bin', kind: 'bin', x: 11, z: -0.6, label: 'Search the bin', loot: 'bin' }],
  encounters: [
    { id: 'kids_on_bikes', triggerX: 28, lock: [18, 40], optional: true, waves: [{ enemies: [{ archetype: 'runner' }, { archetype: 'hothead' }] }], reward: { cash: 20, xp: 60 } },
  ],
  lights: lamps([8, 30, 50], WARM, 8),
  objective: 'The back way from Tanner Road to the leisure centre',
});

/** Behind Hollins to the old ground: a walk along the terraces that saves going past the leisure centre. */
const terraceWalk = side({
  id: 'terrace_walk', name: 'Terrace Walk', district: 'Kirkgate', theme: 'stadium', length: 60, narrow: true,
  facades: [
    { kind: 'semi', x0: 0, x1: 14 },
    { kind: 'terrace', x0: 14, x1: 36 },
    { kind: 'hoarding', x0: 36, x1: 44 },
    { kind: 'terrace', x0: 44, x1: 60, label: 'back' },
  ],
  props: [
    { kind: 'bin', x: 6, z: -1.25, colour: '#2d5a2d' },
    { kind: 'postbox', x: 20, z: -1.4 },
    { kind: 'skip', x: 40, z: -1.0 },
    { kind: 'cone', x: 52, z: 0.6 },
  ],
  pickups: [
    { id: 'programme_box', kind: 'secret', x: 46, z: -1.5, label: 'An old programme box behind the turnstiles', reward: { cash: 60, items: ['watch_gold'] } },
    { id: 'tenner', kind: 'cash', x: 26, z: 0.8, amount: 10 },
  ],
  containers: [{ id: 'skip', kind: 'skip', x: 40, z: -0.1, label: 'Search the skip', loot: 'skip' }],
  encounters: [
    { id: 'away_fans', triggerX: 30, lock: [20, 44], optional: true, waves: [{ enemies: [{ archetype: 'casual' }, { archetype: 'casual' }, { archetype: 'brawler' }] }], reward: { cash: 40, xp: 110 } },
  ],
  lights: lamps([10, 32, 54], SODIUM),
  objective: 'A short cut from Hollins to the ground, if the gate’s open',
});

/** The gasworks road: a service road behind the yards, the alleys to the trading estate past the works. */
const gasworksRoad = side({
  id: 'gasworks_road', name: 'Gasworks Road', district: 'Industrial Quarter', theme: 'industrial', length: 72,
  facades: [
    { kind: 'warehouse', x0: 0, x1: 20, label: 'NORTHERN GAS' },
    { kind: 'fence', x0: 20, x1: 30 },
    { kind: 'warehouse', x0: 30, x1: 50 },
    { kind: 'garages', x0: 50, x1: 60 },
    { kind: 'warehouse', x0: 60, x1: 72 },
  ],
  props: [
    { kind: 'pallets', x: 8, z: -1.5 },
    { kind: 'drum', x: 24, z: -1.6 },
    { kind: 'drum', x: 24.7, z: -1.5 },
    { kind: 'van', x: 40, z: 1.3 },
    { kind: 'scrap', x: 56, z: -1.4 },
    { kind: 'forklift', x: 66, z: -1.3 },
  ],
  pickups: [
    { id: 'meter_cupboard', kind: 'secret', x: 27, z: -1.85, label: 'Inside a meter cupboard', reward: { cash: 70, items: ['w_wrench'] } },
    { id: 'wrench', kind: 'item', item: 'w_wrench', x: 46, z: 0.4 },
  ],
  containers: [
    { id: 'van', kind: 'car', x: 40, z: 0.2, label: 'Search the works van', loot: 'car' },
    { id: 'crates', kind: 'crate', x: 9, z: -0.8, label: 'Search the pallets', loot: 'crate' },
  ],
  breakables: [{ id: 'crates', kind: 'crate', x: 62, z: -1.3, hp: 2, loot: 'crate' }],
  encounters: [
    { id: 'night_shift', triggerX: 34, lock: [24, 48], optional: true, waves: [{ enemies: [{ archetype: 'docker' }, { archetype: 'tooled', weapon: 'pipe' }] }], reward: { cash: 45, xp: 130 } },
  ],
  lights: lamps([10, 36, 62], SODIUM, 10),
  objective: 'The service road from the alleys to the trading estate',
});

/** Under the railway: the arches from the trading estate to the Ring Road underpass, a garage or a gym in each. */
const railwayArches = side({
  id: 'railway_arches', name: 'The Railway Arches', district: 'Old Market', theme: 'subway', length: 64,
  facades: [
    { kind: 'garages', x0: 0, x1: 16 },
    { kind: 'warehouse', x0: 16, x1: 30, label: 'ARCH 14 MOTORS' },
    { kind: 'hoarding', x0: 30, x1: 38 },
    { kind: 'warehouse', x0: 38, x1: 52, label: 'ARCH 17' },
    { kind: 'garages', x0: 52, x1: 64 },
  ],
  props: [
    { kind: 'tyre_stack', x: 6, z: -1.5 },
    { kind: 'car', x: 22, z: 1.3, colour: '#2a2d33' },
    { kind: 'rubbish_bags', x: 34, z: -1.5 },
    { kind: 'tyre_stack', x: 46, z: -1.5 },
    { kind: 'bin', x: 58, z: -1.5 },
  ],
  pickups: [
    { id: 'arch_safe', kind: 'secret', x: 35.5, z: -1.85, label: 'Behind the loose hoarding panel', reward: { cash: 90, items: ['chain_silver'] } },
    { id: 'bar', kind: 'item', item: 'w_metal_bar', x: 50, z: 0.6 },
  ],
  containers: [
    { id: 'car', kind: 'car', x: 22, z: 0.2, label: 'Search the car on bricks', loot: 'car' },
    { id: 'bin', kind: 'bin', x: 58, z: -0.9, label: 'Search the bin', loot: 'bin' },
  ],
  encounters: [
    { id: 'chop_shop', triggerX: 26, lock: [16, 38], optional: true, waves: [{ enemies: [{ archetype: 'brawler' }, { archetype: 'knifeman' }] }], reward: { cash: 50, xp: 140 } },
  ],
  lights: lamps([8, 30, 56], COLD, 8),
  objective: 'Under the railway from the trading estate to the underpass',
});

/** Chandler's Lane: the old lane down to the water from the underpass, past the ship's chandlers. */
const chandlersLane = side({
  id: 'chandlers_lane', name: 'Chandler’s Lane', district: 'Canal Docks', theme: 'docks', length: 60, narrow: true,
  facades: [
    { kind: 'terrace', x0: 0, x1: 14, label: 'back' },
    { kind: 'shop', x0: 14, x1: 22, label: 'J. ROPER CHANDLERS', colour: '#1f3a4a' },
    { kind: 'warehouse', x0: 22, x1: 40 },
    { kind: 'dock', x0: 40, x1: 60 },
  ],
  props: [
    { kind: 'crates', x: 10, z: -1.3 },
    { kind: 'bench', x: 28, z: -1.4 },
    { kind: 'bollard_dock', x: 46, z: 1.3 },
    { kind: 'drum', x: 52, z: -1.3 },
  ],
  pickups: [
    { id: 'net_loft', kind: 'secret', x: 36, z: -1.85, label: 'Up in the old net loft', reward: { cash: 75, items: ['first_aid'] } },
    { id: 'hook', kind: 'item', item: 'w_crowbar', x: 56, z: 0.7 },
  ],
  containers: [{ id: 'crates', kind: 'crate', x: 10, z: -0.6, label: 'Search the crates', loot: 'crate' }],
  encounters: [
    { id: 'lennys_lookouts', triggerX: 30, lock: [22, 42], optional: true, waves: [{ enemies: [{ archetype: 'docker' }, { archetype: 'thug' }] }], reward: { cash: 45, xp: 120 } },
  ],
  lights: lamps([8, 30, 52], SODIUM),
  objective: 'Down to the water from the underpass',
});

/** Cooper's Yard: the delivery yard behind Kingsway, the precinct to the multi-storey. */
const coopersYard = side({
  id: 'coopers_yard', name: 'Cooper’s Yard', district: 'Kingsway', theme: 'car_park', length: 60,
  facades: [
    { kind: 'warehouse', x0: 0, x1: 16, label: 'GOODS IN' },
    { kind: 'fence', x0: 16, x1: 26 },
    { kind: 'warehouse', x0: 26, x1: 44, label: 'KINGSWAY SERVICE' },
    { kind: 'garages', x0: 44, x1: 60 },
  ],
  props: [
    { kind: 'dumpster', x: 8, z: -1.3 },
    { kind: 'van', x: 20, z: 1.3, colour: '#e8e6e1' },
    { kind: 'trolley', x: 34, z: -1.4 },
    { kind: 'pallets', x: 52, z: -1.4 },
  ],
  pickups: [
    { id: 'returns_cage', kind: 'secret', x: 38, z: -1.85, label: 'Left in the returns cage', reward: { cash: 40, items: ['rare_trainers_worn'] } },
    { id: 'meal', kind: 'item', item: 'meal_deal', x: 28, z: 0.6 },
  ],
  containers: [
    { id: 'dumpster', kind: 'dumpster', x: 8, z: -0.55, label: 'Search the dumpster', loot: 'dumpster' },
    { id: 'van', kind: 'car', x: 20, z: 0.2, label: 'Search the delivery van', loot: 'car' },
  ],
  encounters: [
    { id: 'shoplifters', triggerX: 30, lock: [20, 44], optional: true, waves: [{ enemies: [{ archetype: 'runner' }, { archetype: 'hooded' }, { archetype: 'hooded' }] }], reward: { cash: 35, xp: 100 } },
  ],
  lights: lamps([10, 32, 54], COLD, 10),
  objective: 'The goods yard from Kingsway to the multi-storey',
});

/** Neon Alley: the clubs' back doors and fire escapes, the Riverside Centre to the Neon Mile. */
const neonAlley = side({
  id: 'neon_alley', name: 'Neon Alley', district: 'Neon Mile', theme: 'nightlife', length: 58, narrow: true,
  facades: [
    { kind: 'club', x0: 0, x1: 16, label: 'STAFF ONLY' },
    { kind: 'terrace', x0: 16, x1: 28, label: 'back' },
    { kind: 'club', x0: 28, x1: 44, label: 'FIRE EXIT' },
    { kind: 'terrace', x0: 44, x1: 58, label: 'back' },
  ],
  props: [
    { kind: 'dumpster', x: 6, z: -1.3 },
    { kind: 'crates', x: 22, z: -1.4 },
    { kind: 'rubbish_bags', x: 34, z: -1.5 },
    { kind: 'dumpster', x: 50, z: -1.3 },
  ],
  pickups: [
    { id: 'dropped_takings', kind: 'secret', x: 25, z: -1.6, label: 'A night’s takings dropped behind the crates', reward: { cash: 120 } },
    { id: 'kebab', kind: 'item', item: 'kebab', x: 40, z: 0.6 },
  ],
  containers: [
    { id: 'dumpster', kind: 'dumpster', x: 6, z: -0.55, label: 'Search the dumpster', loot: 'dumpster' },
    { id: 'dumpster2', kind: 'dumpster', x: 50, z: -0.55, label: 'Search the dumpster', loot: 'dumpster' },
  ],
  encounters: [
    { id: 'door_staff', triggerX: 30, lock: [20, 42], optional: true, waves: [{ enemies: [{ archetype: 'bouncer' }, { archetype: 'bouncer' }] }], reward: { cash: 60, xp: 150 } },
  ],
  lights: [{ x: 10, y: 3.4, z: -0.6, colour: 0xff3d9a, intensity: 9, range: 10 }, { x: 30, y: 3.4, z: -0.6, colour: 0x3dd9ff, intensity: 9, range: 10 }, { x: 50, y: 3.4, z: -0.6, colour: 0xff3d9a, intensity: 9, range: 10 }],
  objective: 'Round the back of the clubs to the Neon Mile',
});

/** Harrow Cut: through the dead works, the old factory to the Pit. */
const harrowCut = side({
  id: 'harrow_cut', name: 'Harrow Cut', district: 'The Pit', theme: 'territory', length: 62,
  facades: [
    { kind: 'ruin', x0: 0, x1: 22 },
    { kind: 'hoarding', x0: 22, x1: 32 },
    { kind: 'ruin', x0: 32, x1: 50 },
    { kind: 'garages', x0: 50, x1: 62 },
  ],
  props: [
    { kind: 'scrap', x: 8, z: -1.4 },
    { kind: 'abandoned_car', x: 20, z: 1.3 },
    { kind: 'drum', x: 36, z: -1.5 },
    { kind: 'skip', x: 46, z: -1.0 },
  ],
  pickups: [
    { id: 'foremans_office', kind: 'secret', x: 28, z: -1.85, label: 'In the foreman’s old office', reward: { cash: 110, items: ['w_crowbar'] } },
  ],
  containers: [
    { id: 'wreck', kind: 'car', x: 20, z: 0.2, label: 'Search the burnt-out car', loot: 'car' },
    { id: 'skip', kind: 'skip', x: 46, z: -0.1, label: 'Search the skip', loot: 'skip' },
  ],
  encounters: [
    { id: 'duncs_lads', triggerX: 34, lock: [24, 48], optional: true, waves: [{ enemies: [{ archetype: 'gang_enforcer' }, { archetype: 'bruiser' }] }, { enemies: [{ archetype: 'tooled', weapon: 'bottle' }] }], reward: { cash: 80, xp: 220 } },
  ],
  lights: lamps([12, 40], SODIUM, 7),
  objective: 'Through the dead works to the Pit',
});

/** Every side street, by id. Add one here and it's on the map, the route finder and the graph tests. */
export const SIDE_STREETS: Record<string, SideStreet> = {
  mill_lane: {
    level: millLane,
    kind: 'lane',
    left: { street: 'residential', x: 60 },
    // Coming out into the alleys is the same as walking in along the main road: the Gaffer's lads hold it.
    right: { street: 'alleys', x: 52, requires: 'boss_gaffer', lockedText: 'Gaffer’s lads are stood at the end of the lane. Deal with him first.' },
  },
  canal_towpath: {
    level: towpath,
    kind: 'towpath',
    left: { street: 'industrial', x: 30 },
    right: { street: 'docks', x: 43, requires: 'boss_ratcatcher', lockedText: 'The Ratcatcher’s crew have the dock gate on the towpath. Not yet.' },
  },
  tanner_footpath: { level: tannerFootpath, kind: 'footpath', left: { street: 'leisure', x: 73 }, right: { street: 'estate', x: 3 } },
  terrace_walk: {
    level: terraceWalk,
    kind: 'footpath',
    left: { street: 'stadium', x: 30, requires: 'has_stadium_key', lockedText: 'The ground’s service gate is locked this end too. Someone at the Old Market has a key.' },
    right: { street: 'residential', x: 10 },
  },
  gasworks_road: {
    level: gasworksRoad,
    kind: 'service',
    left: { street: 'alleys', x: 33 },
    right: { street: 'ind_estate', x: 54, requires: 'boss_sully', lockedText: 'Sully’s lads have the gate on the trading estate. Beat him first.' },
  },
  railway_arches: { level: railwayArches, kind: 'passage', left: { street: 'ind_estate', x: 24 }, right: { street: 'subway', x: 18.5 } },
  chandlers_lane: {
    level: chandlersLane,
    kind: 'lane',
    left: { street: 'subway', x: 51.5 },
    right: { street: 'docks', x: 24.4, requires: 'boss_ratcatcher', lockedText: 'The Ratcatcher’s crew have the bottom of the lane. Not yet.' },
  },
  coopers_yard: { level: coopersYard, kind: 'service', left: { street: 'precinct', x: 41.5 }, right: { street: 'car_park', x: 17 } },
  neon_alley: {
    level: neonAlley,
    kind: 'lane',
    left: { street: 'mall', x: 42 },
    right: { street: 'nightlife', x: 78, requires: 'has_vip_pass', lockedText: 'A bouncer on the fire door: "VIP pass or you’re going nowhere."' },
  },
  harrow_cut: { level: harrowCut, kind: 'passage', left: { street: 'factory', x: 10 }, right: { street: 'territory', x: 20 } },
};

export const SIDE_STREET_IDS: ReadonlySet<string> = new Set(Object.keys(SIDE_STREETS));

export function isSideStreet(id: string): boolean {
  return SIDE_STREET_IDS.has(id);
}

/** The entry on the main road where you come out of a side street. */
export function junctionEntry(side: string): string {
  return `from_${side}`;
}

/**
 * Wire the side streets in: each one's ends become edges out to its junctions, and each street it joins gets the
 * junction (a gap you turn into) and an arrival spot in front of it. Run once the main road is joined.
 */
export function addSideStreets(levels: Record<AreaId, LevelDef>): void {
  for (const [id, s] of Object.entries(SIDE_STREETS)) {
    const lv = s.level;
    levels[id as AreaId] = lv;
    const { minX, maxX } = lv.bounds;
    lv.entries = [
      { id: 'left', x: minX + 1.5, z: 0, facing: 1 },
      { id: 'right', x: maxX - 1.5, z: 0, facing: -1 },
    ];
    lv.exits = (['left', 'right'] as const).map((side) => {
      const end = s[side];
      const there = levels[end.street];
      return {
        id: `to_${end.street}`,
        kind: 'edge',
        side,
        x: side === 'left' ? minX : maxX,
        z: 0,
        to: end.street,
        toEntry: junctionEntry(id),
        label: there.name,
        ...(end.requires ? { requires: end.requires, lockedText: end.lockedText } : {}),
      } satisfies ExitDef;
    });
    for (const side of ['left', 'right'] as const) {
      const end = s[side];
      const host = levels[end.street];
      if (host.entries.some((e) => e.id === junctionEntry(id))) continue;
      host.entries.push({ id: junctionEntry(id), x: end.x, z: -0.9, facing: side === 'left' ? 1 : -1 });
      host.exits.push({ id: `turn_${id}`, kind: 'door', junction: true, x: end.x, z: -1.5, to: id as AreaId, toEntry: side, label: `Turn into ${lv.name}` });
    }
  }
}
