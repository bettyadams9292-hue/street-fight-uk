import type { LevelDef } from './LevelTypes';

/**
 * Stage 5 districts. Each has its own look (facades, props, lighting and
 * weather), its own enemies, things to search and smash, secrets and, in
 * most, a boss whose defeat opens something up.
 *
 * Map (edges and doors):
 *   Leisure Park <- Hollins Estate <- Tanner Road Estate -> ...
 *   Kirkgate Ground <- Leisure Park (needs the stadium key from the market)
 *   Back Alleys -> Old Market (door)
 *   Industrial -> Canal Docks (door) -> Trading Estate -> Abandoned Factory
 *   Subway -> Deep Line (door, after the Ratcatcher)
 *   City -> Kingsway Precinct (door) -> Riverside Centre -> Multi-storey
 *   City -> Neon Mile (door, needs the VIP pass from the precinct)
 *   The Pit -> Hale House (after Dunc and four district bosses)
 */

const STREET = { minZ: -2, maxZ: 2 };
const NARROW = { minZ: -1.6, maxZ: 1.6 };

// ---- Hollins Estate: the neighbouring estate, run by the Estate King ----------------------------
const residential: LevelDef = {
  id: 'residential',
  name: 'Hollins Estate',
  district: 'Hollins',
  theme: 'residential',
  bounds: { minX: 0, maxX: 86, ...STREET },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 84, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_leisure', kind: 'edge', side: 'left', x: 0, z: 0, to: 'leisure', toEntry: 'right', label: 'Leisure Park' },
    { id: 'to_estate', kind: 'edge', side: 'right', x: 86, z: 0, to: 'estate', toEntry: 'left', label: 'Tanner Road' },
  ],
  facades: [
    { kind: 'semi', x0: 0, x1: 20 },
    { kind: 'tower', x0: 20, x1: 34, label: 'HOLLINS HOUSE 1-64' },
    { kind: 'garages', x0: 34, x1: 46 },
    { kind: 'semi', x0: 46, x1: 62 },
    { kind: 'tower', x0: 62, x1: 76, label: 'FAIRCLOUGH COURT' },
    { kind: 'terrace', x0: 76, x1: 86 },
  ],
  props: [
    { kind: 'car', x: 8, z: 1.4, colour: '#4a4d55' },
    { kind: 'bin', x: 15, z: -1.55 },
    { kind: 'bin', x: 15.8, z: -1.55, colour: '#2a3f7a' },
    { kind: 'abandoned_car', x: 30, z: 1.3 },
    { kind: 'rubbish_bags', x: 38, z: -1.5 },
    { kind: 'trolley', x: 42, z: -0.46 },
    { kind: 'lamp_post', x: 50, z: -1.85 },
    { kind: 'bike_rack', x: 56, z: -1.7 },
    { kind: 'cardboard', x: 66, z: -0.51 },
    { kind: 'dumpster', x: 72, z: -1.3 },
    { kind: 'car', x: 80, z: 1.4, colour: '#7d1a1a' },
  ],
  pickups: [
    { id: 'crisps', kind: 'item', item: 'meal_deal', x: 12, z: -0.6 },
    { id: 'tenner', kind: 'cash', x: 44, z: 0.6, amount: 10 },
    { id: 'hammer', kind: 'item', item: 'w_hammer', x: 58, z: 0.9 },
    { id: 'garden_fork', kind: 'item', item: 'w_garden_fork', x: 5, z: -1.2 },
    { id: 'stairwell_stash', kind: 'secret', x: 27, z: -1.85, label: 'Under the stairwell', reward: { cash: 35, items: ['beanie', 'earring_silver'] } },
    { id: 'garage_stash', kind: 'secret', x: 45.5, z: -1.85, label: 'Inside an open garage', reward: { items: ['rare_trainers_worn'] } },
  ],
  containers: [
    { id: 'bins', kind: 'bin', x: 15.4, z: -1.0, label: 'Search the wheelie bins', loot: 'bin' },
    { id: 'wreck', kind: 'car', x: 30, z: 0.2, label: 'Search the burnt-out car', loot: 'car' },
    { id: 'bags', kind: 'bag', x: 38, z: -0.9, label: 'Search the rubbish bags', loot: 'bin' },
    { id: 'dumpster', kind: 'dumpster', x: 72, z: -0.55, label: 'Search the dumpster', loot: 'dumpster' },
  ],
  breakables: [
    { id: 'boxes', kind: 'boxes', x: 64, z: -1.4, hp: 1, loot: 'bin' },
  ],
  encounters: [
    {
      id: 'stairwell', triggerX: 64, lock: [52, 80], optional: false,
      waves: [{ enemies: [{ archetype: 'hooded' }, { archetype: 'thug' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'runner' }, { archetype: 'tooled', weapon: 'bottle' }] }],
      reward: { cash: 40, xp: 120 }, objective: 'Get past the Hollins lads',
    },
    { id: 'garages', triggerX: 40, optional: true, waves: [{ enemies: [{ archetype: 'hooded' }, { archetype: 'knifeman' }] }], reward: { cash: 30, xp: 80 } },
    {
      id: 'king', triggerX: 18, lock: [4, 32], optional: false, boss: 'estate_king',
      waves: [{ enemies: [{ archetype: 'thug' }] }],
      reward: { cash: 0, xp: 0 }, objective: 'Find the Estate King by Hollins House',
    },
  ],
  lights: [
    { x: 12, y: 4.2, z: 0.6, colour: 0xffb060, intensity: 13, range: 12 },
    { x: 40, y: 4.2, z: 0.6, colour: 0xffb060, intensity: 13, range: 12 },
    { x: 68, y: 4.2, z: 0.6, colour: 0xffb060, intensity: 13, range: 12 },
  ],
  weather: 'rain',
  objective: 'Head west through Hollins',
};

// ---- Leisure Park: leisure centre, gym, playing fields ---------------------------------------
const leisure: LevelDef = {
  id: 'leisure',
  name: 'Leisure Park',
  district: 'Leisure Park',
  theme: 'leisure',
  bounds: { minX: 0, maxX: 80, ...STREET },
  entries: [
    { id: 'dojo', x: 20, z: -1.0, facing: 1 },
    { id: 'irontemple', x: 47.5, z: -1.0, facing: 1 },
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 78, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'dojo_door', kind: 'door', x: 20, z: -1.6, to: 'karate_dojo', toEntry: 'door', label: 'Into the leisure centre: Okafor Karate & Muay Thai' },
    { id: 'irontemple_door', kind: 'door', x: 47.5, z: -1.6, to: 'gym_store', toEntry: 'door', label: 'Into Iron Temple (gym equipment)' },
    { id: 'to_stadium', kind: 'edge', side: 'left', x: 0, z: 0, to: 'stadium', toEntry: 'right', label: 'Kirkgate Ground', requires: 'has_stadium_key', lockedText: 'The stadium service gate is locked. Someone at the Old Market has a key.' },
    { id: 'to_residential', kind: 'edge', side: 'right', x: 80, z: 0, to: 'residential', toEntry: 'left', label: 'Hollins Estate' },
  ],
  facades: [
    { kind: 'fence', x0: 0, x1: 12 },
    { kind: 'leisure', x0: 12, x1: 44, label: 'KIRKGATE LEISURE CENTRE' },
    { kind: 'shop', x0: 44, x1: 54, label: 'IRON TEMPLE GYM', colour: '#9a1c1c' },
    { kind: 'semi', x0: 54, x1: 80 },
  ],
  props: [
    { kind: 'traffic_light', x: 8, z: -1.85 },
    { kind: 'bike_rack', x: 16, z: -1.7 },
    { kind: 'vending', x: 22, z: -1.55 },
    { kind: 'bench', x: 30, z: -1.65 },
    { kind: 'lamp_post', x: 36, z: -1.85 },
    { kind: 'bin', x: 40, z: -1.55 },
    { kind: 'car', x: 50, z: 1.4, colour: '#2f6fa8' },
    { kind: 'planter', x: 60, z: -1.5 },
    { kind: 'bus', x: 70, z: 1.3 },
  ],
  pickups: [
    { id: 'water', kind: 'item', item: 'water', x: 24, z: -0.8 },
    { id: 'protein', kind: 'item', item: 'protein_bar', x: 47, z: -0.9 },
    { id: 'umbrella', kind: 'item', item: 'w_umbrella', x: 32, z: 0.8 },
    { id: 'rake', kind: 'item', item: 'w_rake', x: 6, z: 0.8 },
    { id: 'pool_stash', kind: 'secret', x: 13, z: -1.85, label: 'Lost property box', reward: { cash: 25, items: ['smartwatch', 'runners'] } },
  ],
  containers: [
    { id: 'lockers', kind: 'locker', x: 28, z: -1.0, label: 'Search the changing room lockers', loot: 'locker' },
    { id: 'gymlockers', kind: 'locker', x: 49, z: -1.0, label: 'Search the gym lockers', loot: 'locker' },
    { id: 'vending', kind: 'cupboard', x: 22, z: -0.9, label: 'Shake the vending machine', fixed: [{ id: 'energy_drink', qty: 2 }, { id: 'can_of_pop' }] },
    { id: 'bin', kind: 'bin', x: 40, z: -1.0, label: 'Search the bin', loot: 'bin' },
  ],
  encounters: [
    {
      id: 'carpark', triggerX: 46, lock: [34, 58], optional: false,
      waves: [{ enemies: [{ archetype: 'runner' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'hooded' }, { archetype: 'brawler' }] }],
      reward: { cash: 60, xp: 200 }, objective: 'The gym regulars want a word',
    },
    { id: 'fields', triggerX: 14, optional: true, waves: [{ enemies: [{ archetype: 'grappler' }, { archetype: 'kickboxer' }] }], reward: { cash: 40, xp: 140 } },
  ],
  lights: [
    { x: 20, y: 4.6, z: 0.4, colour: 0xe8f4ff, intensity: 15, range: 14 },
    { x: 48, y: 4.6, z: 0.4, colour: 0xffd8a0, intensity: 14, range: 13 },
    { x: 70, y: 4.6, z: 0.4, colour: 0xffb060, intensity: 13, range: 12 },
  ],
  weather: 'mist',
  objective: 'The football ground is through the gate to the west',
};

// ---- Kirkgate Ground: football stadium on matchday ----------------------------------------------
const stadium: LevelDef = {
  id: 'stadium',
  name: 'Kirkgate Ground',
  district: 'Kirkgate',
  theme: 'stadium',
  bounds: { minX: 0, maxX: 90, ...STREET },
  entries: [{ id: 'right', x: 88, z: 0, facing: -1 }],
  exits: [{ id: 'to_leisure', kind: 'edge', side: 'right', x: 90, z: 0, to: 'leisure', toEntry: 'left', label: 'Leisure Park' }],
  facades: [
    { kind: 'stand', x0: 0, x1: 40, label: 'KIRKGATE ROVERS F.C.' },
    { kind: 'shop', x0: 40, x1: 50, label: 'CLUB SHOP', colour: '#b3121b' },
    { kind: 'stand', x0: 50, x1: 74, label: 'EAST STAND' },
    { kind: 'terrace', x0: 74, x1: 90 },
  ],
  props: [
    { kind: 'turnstile', x: 10, z: -1.6 },
    { kind: 'turnstile', x: 12, z: -1.6 },
    { kind: 'kiosk', x: 22, z: -1.2 },
    { kind: 'barrier', x: 30, z: 1.6 },
    { kind: 'bollard_row', x: 46, z: -0.28 },
    { kind: 'turnstile', x: 58, z: -1.6 },
    { kind: 'turnstile', x: 60, z: -1.6 },
    { kind: 'bin', x: 66, z: -1.55 },
    { kind: 'barrier', x: 82, z: -1.6 },
  ],
  pickups: [
    { id: 'pie', kind: 'item', item: 'pasty', x: 24, z: -0.2 },
    { id: 'flask', kind: 'item', item: 'flask_tea', x: 54, z: 0.9 },
    { id: 'pole', kind: 'item', item: 'w_pole', x: 36, z: 1.2 },
    { id: 'cone', kind: 'item', item: 'w_cone', x: 70, z: 1.0 },
    { id: 'ticket_stash', kind: 'secret', x: 11, z: -1.15, label: 'Dropped behind the turnstiles', reward: { items: ['match_ticket', 'vintage_football'] } },
  ],
  containers: [
    { id: 'kiosk', kind: 'till', x: 22, z: -0.45, label: 'Search behind the burger kiosk', fixed: [{ id: 'kebab', qty: 2 }], cash: 30 },
    { id: 'clubshop', kind: 'wardrobe', x: 45, z: -1.4, label: 'Rummage in the club shop rails', loot: 'wardrobe_loot' },
    { id: 'bin', kind: 'bin', x: 66, z: -1.0, label: 'Search the bin', loot: 'bin' },
  ],
  encounters: [
    {
      id: 'away_end', triggerX: 64, lock: [52, 80], optional: false,
      waves: [{ enemies: [{ archetype: 'casual' }, { archetype: 'brawler' }, { archetype: 'casual' }] }, { enemies: [{ archetype: 'casual' }, { archetype: 'tooled', weapon: 'bottle' }, { archetype: 'runner' }] }],
      reward: { cash: 70, xp: 240 }, objective: 'The firm is waiting outside the East Stand',
    },
    {
      id: 'top_boy', triggerX: 24, lock: [6, 40], optional: false, boss: 'football_firm',
      waves: [{ enemies: [{ archetype: 'casual' }] }],
      reward: { cash: 0, xp: 0 }, objective: 'Find the firm’s top boy by the main stand',
    },
  ],
  lights: [
    { x: 14, y: 6, z: 0.3, colour: 0xf0f8ff, intensity: 20, range: 18 },
    { x: 45, y: 6, z: 0.3, colour: 0xf0f8ff, intensity: 20, range: 18 },
    { x: 76, y: 4.4, z: 0.4, colour: 0xffb060, intensity: 13, range: 12 },
  ],
  weather: 'mist',
  objective: 'Find the firm’s top boy',
};

// ---- Old Market: run-down covered market --------------------------------------------------------
const market: LevelDef = {
  id: 'market',
  name: 'Old Market',
  district: 'Old Market',
  theme: 'market',
  bounds: { minX: 0, maxX: 76, ...NARROW },
  entries: [{ id: 'left', x: 2, z: 0, facing: 1 }],
  exits: [{ id: 'to_alleys', kind: 'edge', side: 'left', x: 0, z: 0, to: 'alleys', toEntry: 'market', label: 'Back Alleys' }],
  facades: [{ kind: 'market', x0: 0, x1: 76, label: 'OLD MARKET HALL 1887' }],
  props: [
    { kind: 'market_stall', x: 8, z: -1.0 },
    { kind: 'market_stall', x: 16, z: 1.0 },
    { kind: 'market_stall', x: 24, z: -1.0 },
    { kind: 'cardboard', x: 30, z: 1.25 },
    { kind: 'market_stall', x: 38, z: -1.0 },
    { kind: 'market_stall', x: 46, z: 1.0 },
    { kind: 'rubbish_bags', x: 52, z: -1.25 },
    { kind: 'market_stall', x: 58, z: -1.0 },
    { kind: 'pillar', x: 66, z: 1.2 },
    { kind: 'pillar', x: 66, z: -1.2 },
  ],
  pickups: [
    { id: 'pan', kind: 'item', item: 'w_frying_pan', x: 12, z: 0.0 },
    { id: 'mop', kind: 'item', item: 'w_mop', x: 34, z: 0.3 },
    { id: 'curry', kind: 'item', item: 'curry', x: 42, z: 0.0 },
    { id: 'antique_stash', kind: 'secret', x: 61, z: -0.2, label: 'Hidden in the antiques stall', reward: { items: ['toby_jug', 'candlestick'] } },
  ],
  containers: [
    { id: 'stall1', kind: 'drawers', x: 8, z: -0.2, label: 'Search the jewellery stall', loot: 'drawers' },
    { id: 'stall2', kind: 'cupboard', x: 16, z: 0.2, label: 'Search the food stall', loot: 'cupboard' },
    { id: 'stall3', kind: 'crate', x: 24, z: -0.2, label: 'Search the electronics stall', loot: 'car' },
    { id: 'stall4', kind: 'wardrobe', x: 38, z: -0.2, label: 'Rummage through the clothes stall', loot: 'wardrobe_loot' },
    { id: 'bags', kind: 'bag', x: 52, z: -0.6, label: 'Search the rubbish', loot: 'bin' },
  ],
  breakables: [
    { id: 'crates', kind: 'crate', x: 30, z: -1.25, hp: 2, drops: 'plank', loot: 'crate' },
    { id: 'stalltable', kind: 'table', x: 50, z: 1.25, hp: 2, drops: 'table_leg' },
  ],
  encounters: [
    {
      id: 'traders', triggerX: 28, lock: [18, 44], optional: false,
      waves: [{ enemies: [{ archetype: 'brawler' }, { archetype: 'thug' }, { archetype: 'tooled', weapon: 'hammer' }] }, { enemies: [{ archetype: 'bruiser' }, { archetype: 'knifeman' }] }],
      reward: { cash: 60, xp: 200 }, objective: 'Get through the market',
    },
    {
      id: 'maureen', triggerX: 60, lock: [48, 76], optional: false, boss: 'market_boss',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Maureen Doyle runs the market from the back',
    },
  ],
  lights: [
    { x: 10, y: 3.6, z: 0, colour: 0xffd090, intensity: 10, range: 10 },
    { x: 30, y: 3.6, z: 0, colour: 0xffd090, intensity: 10, range: 10 },
    { x: 50, y: 3.6, z: 0, colour: 0xffd090, intensity: 10, range: 10 },
    { x: 68, y: 3.6, z: 0, colour: 0xff9a60, intensity: 12, range: 11 },
  ],
  weather: 'indoors',
  objective: 'Find Maureen Doyle',
};

// ---- Canal Docks: canal-side warehouses ----------------------------------------------------------
const docks: LevelDef = {
  id: 'docks',
  name: 'Canal Docks',
  district: 'Canal Docks',
  theme: 'docks',
  bounds: { minX: 0, maxX: 96, ...STREET },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 94, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_industrial', kind: 'edge', side: 'left', x: 0, z: 0, to: 'industrial', toEntry: 'towpath', label: 'Canal Side Works' },
    { id: 'to_ind_estate', kind: 'edge', side: 'right', x: 96, z: 0, to: 'ind_estate', toEntry: 'left', label: 'Trading Estate' },
  ],
  facades: [
    { kind: 'dock', x0: 0, x1: 26, label: 'BONDED WAREHOUSE No.3' },
    { kind: 'containers', x0: 26, x1: 46 },
    { kind: 'dock', x0: 46, x1: 70, label: 'SHAW & SONS SHIPPING' },
    { kind: 'containers', x0: 70, x1: 96 },
  ],
  props: [
    { kind: 'bollard_dock', x: 6, z: 1.7 },
    { kind: 'container', x: 16, z: -0.75, turned: false },
    { kind: 'pallets', x: 26, z: 1.3 },
    { kind: 'forklift', x: 34, z: -1.2 },
    { kind: 'bollard_dock', x: 42, z: 1.7 },
    { kind: 'drum', x: 50, z: -1.6 },
    { kind: 'drum', x: 50.7, z: -1.4 },
    { kind: 'crane_leg', x: 60, z: -1.4 },
    { kind: 'bollard_dock', x: 70, z: 1.7 },
    { kind: 'container', x: 84, z: -0.75 },
  ],
  pickups: [
    { id: 'hook_bar', kind: 'item', item: 'w_crowbar', x: 22, z: 1.2 },
    { id: 'tea', kind: 'item', item: 'flask_tea', x: 44, z: -1.2 },
    { id: 'plank', kind: 'item', item: 'w_plank', x: 66, z: 1.1 },
    { id: 'first_aid', kind: 'item', item: 'first_aid', x: 76, z: -1.4 },
    { id: 'container_stash', kind: 'secret', x: 19.5, z: 0.75, label: 'Inside a cracked-open container', reward: { items: ['console', 'headphones'] } },
  ],
  containers: [
    { id: 'container', kind: 'crate', x: 12, z: 0.65, label: 'Search the open container', loot: 'crate' },
    { id: 'office', kind: 'drawers', x: 56, z: -1.4, label: 'Search the dock office desk', loot: 'drawers' },
    { id: 'container2', kind: 'crate', x: 88, z: 0.65, label: 'Search the container', loot: 'crate' },
  ],
  breakables: [
    { id: 'crates1', kind: 'crate', x: 28, z: -1.5, hp: 2, drops: 'plank', loot: 'crate' },
    { id: 'barrel', kind: 'barrel', x: 74, z: 1.3, hp: 1, loot: 'crate' },
  ],
  encounters: [
    {
      id: 'quay', triggerX: 32, lock: [22, 48], optional: false,
      waves: [{ enemies: [{ archetype: 'docker' }, { archetype: 'thug' }, { archetype: 'docker', weapon: 'chain' }] }, { enemies: [{ archetype: 'bruiser' }, { archetype: 'tooled', weapon: 'metal_bar' }] }],
      reward: { cash: 70, xp: 240 }, objective: 'Get along the quay',
    },
    {
      id: 'lenny', triggerX: 78, lock: [66, 94], optional: false, boss: 'dock_bruiser',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Big Lenny runs the docks from the far quay',
    },
  ],
  lights: [
    { x: 12, y: 6, z: 0.2, colour: 0xffc070, intensity: 18, range: 16 },
    { x: 26, y: 4.2, z: 0.4, colour: 0xd8e8ff, intensity: 10, range: 11 },
    { x: 40, y: 6, z: 0.2, colour: 0xffc070, intensity: 18, range: 16 },
    { x: 56, y: 4.2, z: 0.4, colour: 0xd8e8ff, intensity: 10, range: 11 },
    { x: 70, y: 6, z: 0.2, colour: 0xffc070, intensity: 18, range: 16 },
  ],
  weather: 'mist',
  objective: 'Take the docks off Big Lenny',
};

// ---- Trading Estate: big industrial estate -----------------------------------------------------------
const indEstate: LevelDef = {
  id: 'ind_estate',
  name: 'Brackley Trading Estate',
  district: 'Trading Estate',
  theme: 'ind_estate',
  bounds: { minX: 0, maxX: 90, ...STREET },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 88, z: 0, facing: -1 },
    { id: 'bikes', x: 13, z: -1.0, facing: 1 },
    { id: 'grow', x: 37, z: -1.0, facing: 1 },
    { id: 'dealer', x: 81, z: -1.0, facing: -1 },
  ],
  exits: [
    { id: 'bikes_door', kind: 'door', x: 13, z: -1.6, to: 'bike_shop', toEntry: 'door', label: 'Into Mudlark Moto (off-road bikes)' },
    { id: 'grow_door', kind: 'door', x: 37, z: -1.6, to: 'grow_shop', toEntry: 'door', label: 'Into Green Fingers Hydroponics (grow shop)' },
    { id: 'dealer_door', kind: 'door', x: 81, z: -1.6, to: 'car_dealer', toEntry: 'door', label: 'Into Brackley Motors (car showroom)' },
    { id: 'to_docks', kind: 'edge', side: 'left', x: 0, z: 0, to: 'docks', toEntry: 'right', label: 'Canal Docks' },
    { id: 'to_factory', kind: 'edge', side: 'right', x: 90, z: 0, to: 'factory', toEntry: 'left', label: 'Abandoned Factory', requires: 'boss_docks', lockedText: 'Lenny’s men have the factory road chained off.' },
  ],
  facades: [
    { kind: 'showroom', x0: 0, x1: 22, label: 'MUDLARK MOTO', colour: '#e86a10' },
    { kind: 'warehouse', x0: 22, x1: 32, label: 'UNIT 4 — CARPETS' },
    { kind: 'showroom', x0: 32, x1: 42, label: 'GREEN FINGERS', colour: '#2a8a3a' },
    { kind: 'fence', x0: 42, x1: 52 },
    { kind: 'warehouse', x0: 52, x1: 72, label: 'UNIT 9 — BUILDERS MERCHANT' },
    { kind: 'showroom', x0: 72, x1: 90, label: 'BRACKLEY MOTORS', colour: '#1f4fa8' },
  ],
  props: [
    { kind: 'van', x: 5, z: 1.1, colour: '#e8e6e1' },
    { kind: 'pallets', x: 18, z: -1.4 },
    { kind: 'forklift', x: 30, z: -1.25 },
    { kind: 'skip', x: 46, z: -1.2 },
    { kind: 'security_post', item: 'post_high', x: 43.2, z: -1.9 },
    { kind: 'sign_post', x: 52, z: -0.24 },
    { kind: 'security_post', item: 'post_medium', x: 71.4, z: -1.9 },
    { kind: 'pallets', x: 60, z: -1.4 },
    { kind: 'crates', x: 64, z: -1.5 },
    { kind: 'van', x: 78, z: 1.1, colour: '#1f2a44' },
  ],
  pickups: [
    { id: 'shelf', kind: 'item', item: 'w_shelf_bar', x: 26, z: 0.4 },
    { id: 'shovel', kind: 'item', item: 'w_shovel', x: 58, z: 0.9 },
    { id: 'butty', kind: 'item', item: 'bacon_butty', x: 38, z: -1.2 },
    { id: 'tyre_stash', kind: 'secret', x: 4, z: -1.85, label: 'Inside a stack of tyres', reward: { cash: 80, items: ['w_wrench'] } },
  ],
  containers: [
    { id: 'van1', kind: 'car', x: 5, z: -0.05, label: 'Search the van', loot: 'car' },
    { id: 'skip', kind: 'skip', x: 46, z: -0.35, label: 'Search the skip', loot: 'skip' },
    { id: 'merchant', kind: 'crate', x: 62, z: -0.8, label: 'Search the builders’ crates', loot: 'crate' },
    { id: 'van2', kind: 'car', x: 78, z: -0.05, label: 'Search the van', loot: 'car' },
  ],
  breakables: [
    { id: 'pallets', kind: 'pallet', x: 36, z: 1.3, hp: 2, drops: 'plank' },
    { id: 'tvs', kind: 'tv', x: 70, z: 1.3, hp: 1, drops: 'tv' },
  ],
  encounters: [
    {
      id: 'yard', triggerX: 40, lock: [28, 54], optional: false,
      waves: [{ enemies: [{ archetype: 'docker' }, { archetype: 'tooled', weapon: 'hammer' }, { archetype: 'hothead' }] }, { enemies: [{ archetype: 'gang_enforcer' }, { archetype: 'thug' }] }],
      reward: { cash: 80, xp: 260 }, objective: 'Get across the estate',
    },
    { id: 'unit12', triggerX: 76, optional: true, waves: [{ enemies: [{ archetype: 'knifeman' }, { archetype: 'bruiser' }] }], reward: { cash: 50, xp: 160 } },
  ],
  lights: [
    { x: 12, y: 5, z: 0.4, colour: 0xd0ffe0, intensity: 14, range: 14 },
    { x: 44, y: 5, z: 0.4, colour: 0xd0ffe0, intensity: 14, range: 14 },
    { x: 76, y: 5, z: 0.4, colour: 0xd0ffe0, intensity: 14, range: 14 },
  ],
  weather: 'rain',
  objective: 'The old factory is at the far end of the estate',
};

// ---- Abandoned Factory --------------------------------------------------------------------------------
const factory: LevelDef = {
  id: 'factory',
  name: 'Harrow & Lowe Works',
  district: 'Abandoned Factory',
  theme: 'factory',
  bounds: { minX: 0, maxX: 84, ...NARROW },
  entries: [{ id: 'left', x: 2, z: 0, facing: 1 }],
  exits: [{ id: 'to_ind_estate', kind: 'edge', side: 'left', x: 0, z: 0, to: 'ind_estate', toEntry: 'right', label: 'Trading Estate' }],
  facades: [
    { kind: 'ruin', x0: 0, x1: 30, label: 'HARROW & LOWE LTD' },
    { kind: 'ruin', x0: 30, x1: 58 },
    { kind: 'ruin', x0: 58, x1: 84, label: 'NO ENTRY' },
  ],
  props: [
    { kind: 'scrap', x: 10, z: 1.0 },
    { kind: 'pillar', x: 18, z: -1.1 },
    { kind: 'drum', x: 26, z: 1.2 },
    { kind: 'pillar', x: 34, z: -1.1 },
    { kind: 'pallets', x: 42, z: 1.2 },
    { kind: 'pillar', x: 50, z: -1.1 },
    { kind: 'forklift', x: 60, z: 1.0 },
    { kind: 'pillar', x: 66, z: -1.1 },
  ],
  pickups: [
    { id: 'bar', kind: 'item', item: 'w_metal_bar', x: 14, z: 0.2 },
    { id: 'monitor', kind: 'item', item: 'w_monitor', x: 38, z: -0.6 },
    { id: 'aid', kind: 'item', item: 'first_aid', x: 54, z: 0.6 },
    { id: 'office_stash', kind: 'secret', x: 46, z: -1.4, label: 'In the old manager’s safe', reward: { cash: 150, items: ['old_fiver', 'pocket_watch'] } },
  ],
  containers: [
    { id: 'lockers', kind: 'locker', x: 22, z: -1.2, label: 'Search the rusted lockers', loot: 'locker' },
    { id: 'desk', kind: 'drawers', x: 46, z: -0.8, label: 'Search the manager’s desk', loot: 'drawers' },
  ],
  breakables: [
    { id: 'chairs', kind: 'chair', x: 30, z: -1.2, hp: 1, drops: 'chair_leg' },
    { id: 'window', kind: 'window', x: 62, z: -1.3, hp: 1, drops: 'broken_bottle' },
  ],
  encounters: [
    {
      id: 'floor', triggerX: 28, lock: [16, 42], optional: false,
      waves: [{ enemies: [{ archetype: 'gang_enforcer' }, { archetype: 'hooded' }] }, { enemies: [{ archetype: 'knifeman' }, { archetype: 'kickboxer' }, { archetype: 'thug' }] }],
      reward: { cash: 90, xp: 300 }, objective: 'Clear the factory floor',
    },
    {
      id: 'kasia', triggerX: 66, lock: [54, 84], optional: false, boss: 'industrial_enforcer',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'The Enforcer is waiting on the loading floor',
    },
  ],
  lights: [
    { x: 14, y: 4.5, z: 0, colour: 0x9ab8ff, intensity: 14, range: 13 },
    { x: 28, y: 4.0, z: 0.3, colour: 0xffc890, intensity: 9, range: 11 },
    { x: 40, y: 4.5, z: 0, colour: 0x9ab8ff, intensity: 14, range: 13 },
    { x: 56, y: 4.0, z: 0.3, colour: 0xffc890, intensity: 9, range: 11 },
    { x: 70, y: 4.5, z: 0, colour: 0xff8040, intensity: 16, range: 14 },
  ],
  weather: 'mist',
  objective: 'Find Kasia Nowak',
};

// ---- Kingsway Precinct: 1960s concrete shopping precinct ---------------------------------------------
const precinct: LevelDef = {
  id: 'precinct',
  name: 'Kingsway Precinct',
  district: 'Kingsway',
  theme: 'precinct',
  bounds: { minX: 0, maxX: 88, ...STREET },
  entries: [
    { id: 'wrestling', x: 79, z: -1.0, facing: -1 },
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 86, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'wrestling_door', kind: 'door', x: 79, z: -1.6, to: 'wrestling_club', toEntry: 'door', label: 'Upstairs: Kev’s Wrestling & Grappling' },
    { id: 'to_city', kind: 'edge', side: 'left', x: 0, z: 0, to: 'city', toEntry: 'precinct', label: 'Market Square' },
    { id: 'to_mall', kind: 'edge', side: 'right', x: 88, z: 0, to: 'mall', toEntry: 'left', label: 'Riverside Centre' },
  ],
  facades: [
    { kind: 'precinct', x0: 0, x1: 16, label: 'BARGAIN BOOZE' },
    { kind: 'precinct', x0: 16, x1: 30, label: 'POUND PALACE', colour: '#d81e1e' },
    { kind: 'precinct', x0: 30, x1: 44, label: 'BOOKMAKERS', colour: '#1f6a3a' },
    { kind: 'precinct', x0: 44, x1: 56, label: 'NAILS & BEAUTY', colour: '#c060a0' },
    { kind: 'precinct', x0: 56, x1: 70, label: 'FRIED CHICKEN', colour: '#d84a1a' },
    { kind: 'precinct', x0: 70, x1: 88, label: 'KEV’S WRESTLING', colour: '#1f2a44' },
  ],
  props: [
    { kind: 'mall_planter', x: 8, z: 1.2 },
    { kind: 'bench', x: 20, z: -1.65 },
    { kind: 'atm', x: 34, z: -1.7 },
    { kind: 'fountain', x: 44, z: 0.6 },
    { kind: 'bin', x: 52, z: -1.55 },
    { kind: 'kiosk', x: 62, z: 1.0 },
    { kind: 'bench', x: 74, z: -1.65 },
    { kind: 'mall_planter', x: 82, z: 1.2 },
  ],
  pickups: [
    { id: 'chicken', kind: 'item', item: 'kebab', x: 58, z: -1.0 },
    { id: 'pop', kind: 'item', item: 'can_of_pop', x: 18, z: -0.9 },
    { id: 'club', kind: 'item', item: 'w_club', x: 28, z: 1.2 },
    { id: 'fountain_coins', kind: 'secret', x: 44, z: 1.85, label: 'Coins in the fountain', reward: { cash: 45, items: ['coin_rare'] } },
  ],
  containers: [
    { id: 'bin', kind: 'bin', x: 52, z: -1.0, label: 'Search the bin', loot: 'bin' },
    { id: 'kiosk', kind: 'till', x: 62, z: 0.0, label: 'Search the phone-repair kiosk', fixed: [{ id: 'phone_cheap', qty: 2 }, { id: 'tablet' }] },
  ],
  breakables: [
    { id: 'boxes', kind: 'boxes', x: 76, z: 1.3, hp: 1, loot: 'bin' },
  ],
  encounters: [
    {
      id: 'shutters', triggerX: 30, lock: [18, 44], optional: false,
      waves: [{ enemies: [{ archetype: 'security' }, { archetype: 'thug' }, { archetype: 'hooded' }] }, { enemies: [{ archetype: 'boxer' }, { archetype: 'tooled', weapon: 'baseball_bat' }] }],
      reward: { cash: 70, xp: 240 }, objective: 'Get through the precinct',
    },
    {
      id: 'pryce', triggerX: 72, lock: [58, 86], optional: false, boss: 'precinct_enforcer',
      waves: [{ enemies: [{ archetype: 'thug' }] }],
      reward: { cash: 0, xp: 0 }, objective: 'Dean Pryce collects his money at the far end',
    },
  ],
  lights: [
    { x: 10, y: 4, z: 0.4, colour: 0xf4f0d8, intensity: 13, range: 12 },
    { x: 40, y: 4, z: 0.4, colour: 0xf4f0d8, intensity: 13, range: 12 },
    { x: 70, y: 4, z: 0.4, colour: 0xf4f0d8, intensity: 13, range: 12 },
  ],
  weather: 'rain',
  objective: 'Find Dean Pryce',
};

// ---- Riverside Centre: indoor shopping centre ---------------------------------------------------------
const mall: LevelDef = {
  id: 'mall',
  name: 'Riverside Shopping Centre',
  district: 'Riverside Centre',
  theme: 'mall',
  bounds: { minX: 0, maxX: 92, ...STREET },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 90, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_precinct', kind: 'edge', side: 'left', x: 0, z: 0, to: 'precinct', toEntry: 'right', label: 'Kingsway Precinct' },
    { id: 'to_car_park', kind: 'edge', side: 'right', x: 92, z: 0, to: 'car_park', toEntry: 'left', label: 'Multi-storey car park' },
  ],
  facades: [
    { kind: 'mall', x0: 0, x1: 14, label: 'SPORTS WORLD' },
    { kind: 'mall', x0: 14, x1: 28, label: 'TECH ZONE', colour: '#1f6fd8' },
    { kind: 'mall', x0: 28, x1: 40, label: 'JEWELLERS', colour: '#c9a227' },
    { kind: 'mall', x0: 40, x1: 56, label: 'FOOD COURT', colour: '#d84a1a' },
    { kind: 'mall', x0: 56, x1: 70, label: 'FASHION', colour: '#101012' },
    { kind: 'mall', x0: 70, x1: 92, label: 'DEPARTMENT STORE', colour: '#2a3f7a' },
  ],
  props: [
    { kind: 'mall_planter', x: 7, z: 0.4 },
    { kind: 'escalator', x: 20, z: -0.95 },
    { kind: 'bench', x: 32, z: 1.5 },
    { kind: 'kiosk', x: 46, z: 0.9 },
    { kind: 'mall_planter', x: 60, z: 0.4 },
    { kind: 'vending', x: 66, z: -1.55 },
    { kind: 'escalator', x: 80, z: -0.95 },
  ],
  pickups: [
    { id: 'meal', kind: 'item', item: 'meal_deal', x: 48, z: -0.8 },
    { id: 'water', kind: 'item', item: 'water', x: 66, z: -0.8 },
    { id: 'golf', kind: 'item', item: 'w_golf_club', x: 6, z: -1.2 },
    { id: 'mop', kind: 'item', item: 'w_mop', x: 54, z: 1.3 },
    { id: 'fountain_stash', kind: 'secret', x: 7, z: 1.0, label: 'Under the planter', reward: { items: ['sunglasses_designer'] } },
  ],
  containers: [
    { id: 'sports', kind: 'wardrobe', x: 9, z: -1.4, label: 'Rummage through the sale bins', loot: 'wardrobe_loot' },
    { id: 'tech', kind: 'crate', x: 24, z: -1.4, label: 'Search the returns trolley', loot: 'car' },
    { id: 'kiosk', kind: 'cupboard', x: 46, z: 0.15, label: 'Search the coffee kiosk', loot: 'cupboard' },
  ],
  breakables: [
    { id: 'display', kind: 'tv', x: 18, z: 1.3, hp: 1, drops: 'monitor' },
  ],
  encounters: [
    {
      id: 'security', triggerX: 34, lock: [24, 50], optional: false,
      waves: [{ enemies: [{ archetype: 'security' }, { archetype: 'security' }] }, { enemies: [{ archetype: 'hooded' }, { archetype: 'runner' }, { archetype: 'knifeman' }] }],
      reward: { cash: 70, xp: 240 }, objective: 'Get through the centre',
    },
    { id: 'food_court', triggerX: 62, optional: true, waves: [{ enemies: [{ archetype: 'casual' }, { archetype: 'brawler' }] }], reward: { cash: 50, xp: 150 } },
  ],
  lights: [
    { x: 12, y: 4.4, z: 0.2, colour: 0xffffff, intensity: 15, range: 14 },
    { x: 40, y: 4.4, z: 0.2, colour: 0xfff4e0, intensity: 15, range: 14 },
    { x: 70, y: 4.4, z: 0.2, colour: 0xffffff, intensity: 15, range: 14 },
  ],
  weather: 'indoors',
  objective: 'Through the centre to the car park',
};

// ---- Multi-storey car park --------------------------------------------------------------------------
const carPark: LevelDef = {
  id: 'car_park',
  name: 'Riverside Multi-storey',
  district: 'Multi-storey',
  theme: 'car_park',
  bounds: { minX: 0, maxX: 80, ...STREET },
  entries: [{ id: 'left', x: 2, z: 0, facing: 1 }],
  exits: [{ id: 'to_mall', kind: 'edge', side: 'left', x: 0, z: 0, to: 'mall', toEntry: 'right', label: 'Riverside Centre' }],
  facades: [{ kind: 'car_park', x0: 0, x1: 80, label: 'LEVEL 3' }],
  props: [
    { kind: 'pillar', x: 10, z: -1.5 },
    { kind: 'car', x: 16, z: 1.35, colour: '#e8e6e1' },
    { kind: 'pillar', x: 24, z: -1.5 },
    { kind: 'abandoned_car', x: 32, z: -1.0 },
    { kind: 'pillar', x: 38, z: -1.5 },
    { kind: 'car', x: 46, z: 1.35, colour: '#1b1d22' },
    { kind: 'pillar', x: 52, z: -1.5 },
    { kind: 'car', x: 60, z: 1.35, colour: '#7d1a1a' },
    { kind: 'pillar', x: 66, z: -1.5 },
    { kind: 'trolley', x: 72, z: 0.9 },
  ],
  pickups: [
    { id: 'skate', kind: 'item', item: 'w_skateboard', x: 20, z: 0.6 },
    { id: 'torch', kind: 'item', item: 'w_torch', x: 42, z: -1.0 },
    { id: 'energy', kind: 'item', item: 'energy_drink', x: 56, z: -1.0 },
    { id: 'boot_stash', kind: 'secret', x: 76, z: -1.85, label: 'Taped behind the pay machine', reward: { cash: 120, items: ['bag_rucksack'] } },
  ],
  containers: [
    { id: 'car1', kind: 'car', x: 16, z: 0.25, label: 'Search the car', loot: 'car' },
    { id: 'wreck', kind: 'car', x: 32, z: 0.1, label: 'Search the abandoned car', loot: 'car' },
    { id: 'car2', kind: 'car', x: 46, z: 0.25, label: 'Search the car', loot: 'car' },
    { id: 'car3', kind: 'car', x: 60, z: 0.25, label: 'Search the car', loot: 'car' },
  ],
  encounters: [
    {
      id: 'level3', triggerX: 36, lock: [26, 50], optional: false,
      waves: [{ enemies: [{ archetype: 'runner' }, { archetype: 'hooded' }, { archetype: 'tooled', weapon: 'crowbar' }] }, { enemies: [{ archetype: 'gang_enforcer' }, { archetype: 'knifeman' }] }],
      reward: { cash: 90, xp: 280 }, objective: 'Someone’s running a chop shop up here',
    },
    { id: 'roof', triggerX: 66, optional: true, waves: [{ enemies: [{ archetype: 'elite' }] }], reward: { cash: 80, xp: 200 } },
  ],
  lights: [
    { x: 12, y: 3.2, z: -0.2, colour: 0xe8ffe8, intensity: 9, range: 11 },
    { x: 34, y: 3.2, z: -0.2, colour: 0xe8ffe8, intensity: 9, range: 11 },
    { x: 56, y: 3.2, z: -0.2, colour: 0xe8ffe8, intensity: 9, range: 11 },
    { x: 74, y: 3.2, z: -0.2, colour: 0xe8ffe8, intensity: 9, range: 11 },
  ],
  weather: 'indoors',
  objective: 'Clear out the chop shop',
};

// ---- Neon Mile: nightclub district ------------------------------------------------------------------------
const nightlife: LevelDef = {
  id: 'nightlife',
  name: 'The Neon Mile',
  district: 'Neon Mile',
  theme: 'nightlife',
  bounds: { minX: 0, maxX: 90, ...STREET },
  entries: [{ id: 'left', x: 2, z: 0, facing: 1 }],
  exits: [{ id: 'to_city', kind: 'edge', side: 'left', x: 0, z: 0, to: 'city', toEntry: 'neon', label: 'Market Square' }],
  facades: [
    { kind: 'club', x0: 0, x1: 18, label: 'PULSE' },
    { kind: 'shop', x0: 18, x1: 26, label: 'KEBAB KING', colour: '#d84a1a' },
    { kind: 'club', x0: 26, x1: 44, label: 'ELECTRIC' },
    { kind: 'shop', x0: 44, x1: 52, label: 'OFF LICENCE', colour: '#1f6a3a' },
    { kind: 'club', x0: 52, x1: 90, label: 'VELVET' },
  ],
  props: [
    { kind: 'barrier', x: 8, z: -1.6 },
    { kind: 'phonebox', x: 20, z: -1.4 },
    { kind: 'bin', x: 30, z: -1.55 },
    { kind: 'barrier', x: 36, z: 1.6 },
    { kind: 'cardboard', x: 48, z: -1.5 },
    { kind: 'car', x: 58, z: 1.35, colour: '#101012' },
    { kind: 'barrier', x: 70, z: -1.6 },
  ],
  pickups: [
    { id: 'kebab', kind: 'item', item: 'kebab', x: 22, z: -0.8 },
    { id: 'bottle', kind: 'item', item: 'w_bottle', x: 46, z: -0.8 },
    { id: 'bottle2', kind: 'item', item: 'w_bottle', x: 32, z: 1.2 },
    { id: 'cue', kind: 'item', item: 'w_pool_cue', x: 12, z: 0.9 },
    { id: 'vip_stash', kind: 'secret', x: 89, z: -1.85, label: 'Behind the VIP rope', reward: { items: ['chain_gold', 'designer_hoodie'] } },
  ],
  containers: [
    { id: 'bin', kind: 'bin', x: 30, z: -1.0, label: 'Search the bin', loot: 'bin' },
    { id: 'offie', kind: 'till', x: 48, z: -0.9, label: 'Search the off-licence bins', fixed: [{ id: 'can_of_pop', qty: 3 }] },
    { id: 'car', kind: 'car', x: 58, z: 0.25, label: 'Search the car', loot: 'car' },
  ],
  encounters: [
    {
      id: 'kicking_out', triggerX: 30, lock: [20, 46], optional: false,
      waves: [{ enemies: [{ archetype: 'brawler' }, { archetype: 'casual' }, { archetype: 'brawler' }] }, { enemies: [{ archetype: 'bouncer' }, { archetype: 'tooled', weapon: 'bottle' }] }],
      reward: { cash: 80, xp: 260 }, objective: 'Chucking-out time on the Mile',
    },
    {
      id: 'simone', triggerX: 72, lock: [58, 90], optional: false, boss: 'nightclub_owner',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Simone Achebe owns Velvet. Go and see her.',
    },
  ],
  lights: [
    { x: 9, y: 4, z: 0.6, colour: 0x40e0ff, intensity: 16, range: 13 },
    { x: 35, y: 4, z: 0.6, colour: 0xff40c0, intensity: 16, range: 13 },
    { x: 60, y: 4, z: 0.6, colour: 0xa070ff, intensity: 16, range: 13 },
    { x: 80, y: 4, z: 0.6, colour: 0xff4080, intensity: 16, range: 13 },
  ],
  weather: 'rain',
  objective: 'Find the owner of Velvet',
};

// ---- Deep Line: disused underground station ----------------------------------------------------------------
const underground: LevelDef = {
  id: 'underground',
  name: 'Deep Line',
  district: 'Deep Line',
  theme: 'underground',
  bounds: { minX: 0, maxX: 88, ...NARROW },
  entries: [{ id: 'left', x: 2, z: -0.2, facing: 1 }],
  exits: [{ id: 'to_subway', kind: 'edge', side: 'left', x: 0, z: 0, to: 'subway', toEntry: 'platform', label: 'Ring Road Subway' }],
  facades: [{ kind: 'platform', x0: 0, x1: 88, label: 'KIRKGATE ROAD' }],
  props: [
    { kind: 'bench', x: 10, z: -1.3 },
    { kind: 'vending', x: 18, z: -1.25 },
    { kind: 'pillar', x: 26, z: -1.25 },
    { kind: 'rubbish_bags', x: 34, z: -0.51 },
    { kind: 'pillar', x: 44, z: -1.25 },
    { kind: 'bench', x: 52, z: -1.3 },
    { kind: 'pillar', x: 62, z: -1.25 },
    { kind: 'cardboard', x: 70, z: -0.51 },
  ],
  pickups: [
    { id: 'torch', kind: 'item', item: 'w_torch', x: 6, z: 0.6 },
    { id: 'aid', kind: 'item', item: 'first_aid', x: 40, z: 1.0 },
    { id: 'bar', kind: 'item', item: 'w_crowbar', x: 58, z: 0.8 },
    { id: 'tunnel_stash', kind: 'secret', x: 84, z: -1.45, label: 'In a maintenance alcove', reward: { cash: 200, items: ['coin_sovereign'] } },
  ],
  containers: [
    { id: 'vending', kind: 'cupboard', x: 18, z: -0.6, label: 'Break into the vending machine', fixed: [{ id: 'energy_drink', qty: 2 }, { id: 'protein_bar', qty: 2 }] },
    { id: 'bags', kind: 'bag', x: 34, z: 0.55, label: 'Search the bags', loot: 'dumpster' },
    { id: 'office', kind: 'drawers', x: 74, z: -1.2, label: 'Search the station office', loot: 'drawers' },
  ],
  encounters: [
    {
      id: 'platform', triggerX: 32, lock: [20, 48], optional: false,
      waves: [{ enemies: [{ archetype: 'hooded' }, { archetype: 'knifeman' }, { archetype: 'runner' }] }, { enemies: [{ archetype: 'gang_enforcer' }, { archetype: 'grappler' }] }],
      reward: { cash: 100, xp: 320 }, objective: 'Down the platform',
    },
    {
      id: 'crane', triggerX: 70, lock: [58, 88], optional: false, boss: 'underground_king',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Silas Crane holds court at the end of the line',
    },
  ],
  lights: [
    { x: 10, y: 2.9, z: -0.3, colour: 0xd8ffe0, intensity: 12, range: 11 },
    { x: 20, y: 2.9, z: -0.3, colour: 0xd8ffe0, intensity: 7, range: 9 },
    { x: 30, y: 2.9, z: -0.3, colour: 0xd8ffe0, intensity: 9, range: 10 },
    { x: 40, y: 2.9, z: -0.3, colour: 0xd8ffe0, intensity: 7, range: 9 },
    { x: 50, y: 2.9, z: -0.3, colour: 0xd8ffe0, intensity: 12, range: 11 },
    { x: 62, y: 2.9, z: -0.3, colour: 0xd8ffe0, intensity: 7, range: 9 },
    { x: 74, y: 2.9, z: -0.3, colour: 0xff6040, intensity: 14, range: 12 },
  ],
  weather: 'indoors',
  objective: 'Find the Underground King',
};

// ---- Hale House: final headquarters -----------------------------------------------------------------------
const hq: LevelDef = {
  id: 'hq',
  name: 'Hale House',
  district: 'Hale House',
  theme: 'hq',
  bounds: { minX: 0, maxX: 96, ...STREET },
  entries: [{ id: 'left', x: 2, z: 0, facing: 1 }],
  exits: [{ id: 'to_territory', kind: 'edge', side: 'left', x: 0, z: 0, to: 'territory', toEntry: 'right', label: 'The Pit' }],
  facades: [
    { kind: 'fortress', x0: 0, x1: 32, label: 'HALE HOLDINGS' },
    { kind: 'fortress', x0: 32, x1: 64 },
    { kind: 'fortress', x0: 64, x1: 96, label: 'PRIVATE' },
  ],
  props: [
    { kind: 'bollard_row', x: 8, z: 1.75 },
    { kind: 'car', x: 18, z: 1.35, colour: '#101012' },
    { kind: 'planter', x: 28, z: -1.5 },
    { kind: 'pillar', x: 40, z: -1.5 },
    { kind: 'fountain', x: 52, z: 0.4 },
    { kind: 'pillar', x: 64, z: -1.5 },
    { kind: 'car', x: 74, z: 1.35, colour: '#e8e6e1' },
  ],
  pickups: [
    { id: 'aid', kind: 'item', item: 'first_aid', x: 34, z: -0.8 },
    { id: 'fry', kind: 'item', item: 'fry_up', x: 60, z: -1.0 },
    { id: 'golf', kind: 'item', item: 'w_golf_club', x: 24, z: 0.9 },
    { id: 'vault', kind: 'secret', x: 95, z: -1.85, label: 'Hale’s private vault', reward: { cash: 500, items: ['programme_1966', 'bag_holdall'] } },
  ],
  containers: [
    { id: 'car', kind: 'car', x: 18, z: 0.25, label: 'Search the Range Rover', loot: 'car' },
    { id: 'office', kind: 'drawers', x: 46, z: -1.2, label: 'Search the security desk', loot: 'drawers' },
  ],
  encounters: [
    {
      id: 'gate', triggerX: 22, lock: [10, 36], optional: false,
      waves: [{ enemies: [{ archetype: 'bouncer' }, { archetype: 'gang_enforcer' }] }, { enemies: [{ archetype: 'elite' }, { archetype: 'knifeman' }, { archetype: 'tooled', weapon: 'baseball_bat' }] }],
      reward: { cash: 150, xp: 450 }, objective: 'Break through the gate',
    },
    {
      id: 'courtyard', triggerX: 54, lock: [42, 66], optional: false,
      waves: [{ enemies: [{ archetype: 'rival' }, { archetype: 'gang_enforcer' }] }],
      reward: { cash: 150, xp: 450 }, objective: 'Across the courtyard',
    },
    {
      id: 'hale', triggerX: 80, lock: [68, 96], optional: false, boss: 'the_boss',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Victor Hale. End it.',
    },
  ],
  lights: [
    { x: 14, y: 4.6, z: 0.4, colour: 0xfff0d0, intensity: 15, range: 14 },
    { x: 48, y: 4.6, z: 0.4, colour: 0xfff0d0, intensity: 15, range: 14 },
    { x: 82, y: 4.6, z: 0.4, colour: 0xff5030, intensity: 18, range: 16 },
  ],
  weather: 'rain',
  objective: 'Find Victor Hale',
};

export const DISTRICTS = { residential, leisure, stadium, market, docks, ind_estate: indEstate, factory, precinct, mall, car_park: carPark, nightlife, underground, hq };
