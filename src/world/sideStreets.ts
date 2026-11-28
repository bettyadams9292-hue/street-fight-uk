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
  kind: 'lane' | 'towpath' | 'footpath' | 'passage';
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
