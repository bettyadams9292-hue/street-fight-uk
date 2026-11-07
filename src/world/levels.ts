import type { AreaId } from '../progress/Progress';
import type { LevelDef } from './LevelTypes';

/**
 * The neighbourhood. Areas join end to end (walk off an edge) or through
 * doors. Each district's way forward opens when its boss is beaten; the
 * subway lever opens a shortcut back to the estate.
 *
 * Coordinates: x runs along the street, z is depth (negative = towards the
 * buildings). The walkable band is bounds.minZ..maxZ.
 */

const STREET_Z = { minZ: -2, maxZ: 2 };

// ---- home --------------------------------------------------------------------

const home: LevelDef = {
  id: 'home',
  name: 'Home',
  district: '14 Tanner Road',
  theme: 'home',
  bounds: { minX: -20, maxX: 18, minZ: -1.8, maxZ: 1.4 },
  entries: [
    { id: 'start', x: -16, z: 0.4, facing: 1 },
    { id: 'door', x: -8, z: -0.6, facing: 1 },
  ],
  exits: [{ id: 'front_door', kind: 'door', x: -8, z: -1.4, to: 'estate', toEntry: 'home', label: 'Go out (front door)' }],
  facades: [
    { kind: 'room', x0: -20, x1: -13, label: 'Bedroom', colour: '#6d7a8c' },
    { kind: 'room', x0: -13, x1: -4, label: 'Living room', colour: '#8c7a5e' },
    { kind: 'room', x0: -4, x1: 2, label: 'Kitchen', colour: '#c9c2a8' },
    { kind: 'room', x0: 2, x1: 10, label: 'Gym', colour: '#5d6660' },
    { kind: 'room', x0: 10, x1: 18, label: 'Garage', colour: '#6a6a6a' },
  ],
  // Room dividers with a doorway at the front.
  walls: [
    { minX: -13.1, maxX: -12.9, minZ: -2.4, maxZ: 0.1 },
    { minX: -4.1, maxX: -3.9, minZ: -2.4, maxZ: 0.1 },
    { minX: 1.9, maxX: 2.1, minZ: -2.4, maxZ: 0.1 },
    { minX: 9.9, maxX: 10.1, minZ: -2.4, maxZ: 0.1 },
  ],
  props: [
    // bedroom
    { kind: 'bed', x: -18.6, z: -1.0, turned: true },
    { kind: 'wardrobe', x: -15.4, z: -1.45 },
    { kind: 'desk', x: -13.9, z: -1.45 },
    // living room
    { kind: 'sofa', x: -10, z: 0.9 },
    { kind: 'tv', x: -11, z: -1.55 },
    { kind: 'table', x: -5.3, z: -1.3 },
    // kitchen
    { kind: 'counter', x: -1.2, z: -1.45 },
    { kind: 'fridge', x: 1.3, z: -1.45 },
    { kind: 'table', x: -2, z: 0.9 },
    // gym
    { kind: 'weights', x: 3.4, z: -1.4 },
    { kind: 'bag', x: 8.6, z: -1.3 },
    { kind: 'rack', x: 6, z: -1.6 },
    // garage
    { kind: 'homecar', x: 13.5, z: 0.6 },
    { kind: 'workbench', x: 16.6, z: -1.4 },
    { kind: 'shelves', x: 11.6, z: -1.55 },
  ],
  stations: [
    { id: 'wardrobe', x: -15.4, z: -0.8, label: 'Wardrobe: change your look' },
    { id: 'mirror', x: -16.9, z: -1.15, label: 'Mirror: check yourself' },
    { id: 'sofa', x: -10, z: 0.15, label: 'Sofa: catch up and save' },
    { id: 'contacts', x: -5.3, z: -0.75, label: 'Phone: contacts' },
    { id: 'tin', x: -13.9, z: -0.9, label: 'Biscuit tin: your savings' },
    { id: 'kitchen', x: -1.2, z: -0.85, label: 'Kitchen: eat and recover' },
    { id: 'gym', x: 3.4, z: -0.75, label: 'Gym: train and learn' },
    { id: 'sparring', x: 7.6, z: 0.2, label: 'Spar with Mo' },
    { id: 'garage', x: 16.6, z: -0.75, label: 'Garage: weapons and gear' },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: -16.5, y: 2.6, z: -0.3, colour: 0xffd8a0, intensity: 9, range: 9 },
    { x: -8.5, y: 2.6, z: -0.3, colour: 0xffd090, intensity: 10, range: 10 },
    { x: -1, y: 2.6, z: -0.3, colour: 0xf4f6ff, intensity: 10, range: 8 },
    { x: 6, y: 2.6, z: -0.3, colour: 0xe8f0ff, intensity: 10, range: 9 },
    { x: 14, y: 2.6, z: -0.3, colour: 0xd8e4ff, intensity: 9, range: 9 },
  ],
  objective: 'Head out the front door when you’re ready',
};

// ---- the estate ------------------------------------------------------------------

const estate: LevelDef = {
  id: 'estate',
  name: 'Tanner Road Estate',
  district: 'Home Estate',
  theme: 'estate',
  bounds: { minX: -12, maxX: 56, ...STREET_Z },
  entries: [
    { id: 'home', x: -6, z: -1.0, facing: 1 },
    { id: 'right', x: 54, z: 0, facing: -1 },
    { id: 'subway', x: 38, z: -1.0, facing: -1 },
  ],
  exits: [
    { id: 'home_door', kind: 'door', x: -6, z: -1.6, to: 'home', toEntry: 'door', label: 'Go home' },
    { id: 'to_high_street', kind: 'edge', side: 'right', x: 56, z: 0, to: 'high_street', toEntry: 'left', label: 'High Street' },
    { id: 'subway_steps', kind: 'door', x: 38, z: -1.6, to: 'subway', toEntry: 'estate', label: 'Subway steps', requires: 'shortcut_subway', lockedText: 'The subway gate’s chained from the other side' },
  ],
  facades: [
    { kind: 'house_front', x0: -12, x1: 0, label: '14' },
    { kind: 'terrace', x0: 0, x1: 18 },
    { kind: 'tower', x0: 18, x1: 32 },
    { kind: 'garages', x0: 32, x1: 44 },
    { kind: 'terrace', x0: 44, x1: 56 },
  ],
  props: [
    { kind: 'bin', x: -2.5, z: -1.5 },
    { kind: 'bin', x: -1.7, z: -1.5, colour: '#2d5a2d' },
    { kind: 'car', x: 6, z: 1.4 },
    { kind: 'bench', x: 14, z: -1.6 },
    { kind: 'trolley', x: 22, z: 0.9 },
    { kind: 'skip', x: 28, z: -1.2 },
    { kind: 'bollard', x: 34, z: 1.2 },
    { kind: 'bollard', x: 35.5, z: 1.2 },
    { kind: 'cone', x: 42, z: 0.4 },
    { kind: 'car', x: 48, z: 1.4, colour: '#7a1f1f' },
  ],
  pickups: [
    { id: 'tenner', kind: 'cash', x: 28, z: 0.5, amount: 10 },
    { id: 'chips', kind: 'food', x: 15, z: -1.0, amount: 25, label: 'Chips' },
    { id: 'bottle', kind: 'weapon', x: 24, z: -0.6, weapon: 'bottle' },
    { id: 'garages_stash', kind: 'secret', x: 43, z: -1.8, label: 'Behind the garages', reward: { cash: 40, cosmetic: 'acc:cap' } },
  ],
  encounters: [
    {
      id: 'lads', triggerX: 18, lock: [10, 34], optional: false,
      waves: [{ enemies: [{ archetype: 'thug' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'hothead' }, { archetype: 'thug' }] }],
      reward: { cash: 30, xp: 80 }, objective: 'Get past the estate lads',
    },
    { id: 'garage_crew', triggerX: 40, optional: true, waves: [{ enemies: [{ archetype: 'thug' }, { archetype: 'hothead' }] }], reward: { cash: 20, xp: 60 } },
  ],
  lights: [
    { x: 4, y: 4.2, z: 0.6, colour: 0xffb060, intensity: 14, range: 12 },
    { x: 24, y: 4.2, z: 0.6, colour: 0xffb060, intensity: 14, range: 12 },
    { x: 44, y: 4.2, z: 0.6, colour: 0xffb060, intensity: 14, range: 12 },
  ],
  objective: 'Head east to the High Street',
};

// ---- high street -----------------------------------------------------------------

const highStreet: LevelDef = {
  id: 'high_street',
  name: 'The High Street',
  district: 'High Street',
  theme: 'high_street',
  bounds: { minX: 0, maxX: 92, ...STREET_Z },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 90, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_estate', kind: 'edge', side: 'left', x: 0, z: 0, to: 'estate', toEntry: 'right', label: 'Estate' },
    { id: 'to_alleys', kind: 'edge', side: 'right', x: 92, z: 0, to: 'alleys', toEntry: 'left', label: 'Back alleys', requires: 'boss_gaffer', lockedText: 'Gaffer’s lads block the way. Deal with him first.' },
  ],
  facades: [
    { kind: 'shop', x0: 0, x1: 10, label: 'BOOKIES' },
    { kind: 'shop', x0: 10, x1: 20, label: 'CHIPPY', colour: '#1f4f8a' },
    { kind: 'pub', x0: 20, x1: 34, label: 'THE RED LION' },
    { kind: 'shop', x0: 34, x1: 44, label: 'VAPE & PHONE', colour: '#6b2d82' },
    { kind: 'shop', x0: 44, x1: 54, label: 'CORNER SHOP', colour: '#2d6b3a' },
    { kind: 'shop', x0: 54, x1: 62, label: 'TO LET', colour: '#555555' },
    { kind: 'shop', x0: 62, x1: 74, label: 'KEBAB HOUSE', colour: '#9a2a1a' },
    { kind: 'pub', x0: 74, x1: 92, label: 'THE GAFFER’S ARMS', colour: '#2a1a12' },
  ],
  props: [
    { kind: 'busstop', x: 8, z: -1.55 },
    { kind: 'phonebox', x: 18, z: -1.4 },
    { kind: 'postbox', x: 33, z: -1.6 },
    { kind: 'bin', x: 40, z: -1.6 },
    { kind: 'bench', x: 50, z: -1.65 },
    { kind: 'van', x: 58, z: 1.2 },
    { kind: 'planter', x: 66, z: -1.5 },
    { kind: 'barrier', x: 71, z: 1.6 },
    { kind: 'crates', x: 84, z: -1.5 },
  ],
  pickups: [
    { id: 'pint', kind: 'food', x: 26, z: -1.1, amount: 30, label: 'Pint' },
    { id: 'kebab', kind: 'food', x: 64, z: -1.0, amount: 40, label: 'Kebab' },
    { id: 'change', kind: 'cash', x: 47, z: 0.8, amount: 15 },
    { id: 'phonebox_stash', kind: 'secret', x: 18.8, z: -0.7, label: 'Taped in the phone box', reward: { cash: 60 } },
    { id: 'bat', kind: 'weapon', x: 55, z: -0.9, weapon: 'bat' },
  ],
  encounters: [
    {
      id: 'pub_door', triggerX: 28, lock: [18, 42], optional: false,
      waves: [{ enemies: [{ archetype: 'thug' }, { archetype: 'hothead' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'bruiser' }, { archetype: 'tooled', weapon: 'bottle' }] }],
      reward: { cash: 50, xp: 150 }, objective: 'Get past the Red Lion',
    },
    { id: 'kebab_queue', triggerX: 60, optional: true, waves: [{ enemies: [{ archetype: 'defender' }, { archetype: 'thug' }] }], reward: { cash: 30, xp: 90 } },
    {
      id: 'gaffer', triggerX: 80, lock: [70, 92], optional: false, boss: 'gaffer',
      waves: [{ enemies: [{ archetype: 'thug' }] }],
      reward: { cash: 0, xp: 0 }, objective: 'Find the Gaffer at his pub',
    },
  ],
  lights: [
    { x: 12, y: 4.2, z: 0.6, colour: 0xffc070, intensity: 14, range: 13 },
    { x: 34, y: 4.2, z: 0.6, colour: 0xffc070, intensity: 14, range: 13 },
    { x: 56, y: 4.2, z: 0.6, colour: 0xffc070, intensity: 14, range: 13 },
    { x: 80, y: 4.2, z: 0.6, colour: 0xff8050, intensity: 16, range: 14 },
  ],
  objective: 'Find the Gaffer at the end of the High Street',
};

// ---- back alleys -----------------------------------------------------------------

const alleys: LevelDef = {
  id: 'alleys',
  name: 'The Back Alleys',
  district: 'Back Alleys',
  theme: 'alleys',
  bounds: { minX: 0, maxX: 72, minZ: -1.6, maxZ: 1.6 },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 70, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_high_street', kind: 'edge', side: 'left', x: 0, z: 0, to: 'high_street', toEntry: 'right', label: 'High Street' },
    { id: 'to_industrial', kind: 'edge', side: 'right', x: 72, z: 0, to: 'industrial', toEntry: 'left', label: 'Industrial Quarter' },
  ],
  facades: [
    { kind: 'fence', x0: 0, x1: 16 },
    { kind: 'terrace', x0: 16, x1: 30, label: 'back' },
    { kind: 'hoarding', x0: 30, x1: 44 },
    { kind: 'fence', x0: 44, x1: 58 },
    { kind: 'terrace', x0: 58, x1: 72, label: 'back' },
  ],
  props: [
    { kind: 'bin', x: 6, z: -1.2 },
    { kind: 'bin', x: 6.8, z: -1.2 },
    { kind: 'pallets', x: 12, z: 1.0 },
    { kind: 'skip', x: 22, z: -0.9 },
    { kind: 'crates', x: 33, z: 0.9 },
    { kind: 'drum', x: 39, z: -1.2 },
    { kind: 'drum', x: 39.7, z: -1.0 },
    { kind: 'bin', x: 50, z: 1.2 },
    { kind: 'pallets', x: 62, z: -1.0 },
  ],
  pickups: [
    { id: 'pipe', kind: 'weapon', x: 16, z: -0.6, weapon: 'pipe' },
    { id: 'pasty', kind: 'food', x: 45, z: 0, amount: 30, label: 'Pasty' },
    { id: 'skip_stash', kind: 'secret', x: 22, z: 0.1, label: 'Under the skip', reward: { cash: 50, cosmetic: 'top:bomber' } },
    { id: 'coins', kind: 'cash', x: 58, z: -1.2, amount: 20 },
  ],
  encounters: [
    {
      id: 'ambush', triggerX: 26, lock: [16, 40], optional: false,
      waves: [{ enemies: [{ archetype: 'hothead' }, { archetype: 'hothead' }] }, { enemies: [{ archetype: 'tooled', weapon: 'pipe' }, { archetype: 'thug' }, { archetype: 'thug' }] }],
      reward: { cash: 50, xp: 160 }, objective: 'Get through the alleys',
    },
    { id: 'dealers', triggerX: 54, optional: true, waves: [{ enemies: [{ archetype: 'defender' }, { archetype: 'tooled', weapon: 'bottle' }] }], reward: { cash: 40, xp: 110 } },
  ],
  lights: [
    { x: 10, y: 3.4, z: -0.6, colour: 0xffe0a0, intensity: 9, range: 10 },
    { x: 34, y: 3.4, z: -0.6, colour: 0x90c0ff, intensity: 9, range: 10 },
    { x: 58, y: 3.4, z: -0.6, colour: 0xffe0a0, intensity: 9, range: 10 },
  ],
  objective: 'Cut through to the Industrial Quarter',
};

// ---- industrial quarter ------------------------------------------------------------

const industrial: LevelDef = {
  id: 'industrial',
  name: 'Canal Side Works',
  district: 'Industrial Quarter',
  theme: 'industrial',
  bounds: { minX: 0, maxX: 92, ...STREET_Z },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 90, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_alleys', kind: 'edge', side: 'left', x: 0, z: 0, to: 'alleys', toEntry: 'right', label: 'Back alleys' },
    { id: 'to_subway', kind: 'edge', side: 'right', x: 92, z: 0, to: 'subway', toEntry: 'left', label: 'Subway', requires: 'boss_sully', lockedText: 'Sully’s gym runs this yard. Beat him first.' },
  ],
  facades: [
    { kind: 'warehouse', x0: 0, x1: 22, label: 'H. BRIGGS & SONS' },
    { kind: 'fence', x0: 22, x1: 32 },
    { kind: 'warehouse', x0: 32, x1: 56, label: 'UNIT 7' },
    { kind: 'garages', x0: 56, x1: 66 },
    { kind: 'warehouse', x0: 66, x1: 92, label: 'KANE’S BOXING' },
  ],
  props: [
    { kind: 'pallets', x: 7, z: -1.4 },
    { kind: 'drum', x: 14, z: 1.3 },
    { kind: 'drum', x: 14.7, z: 1.5 },
    { kind: 'scrap', x: 26, z: -1.1 },
    { kind: 'van', x: 40, z: 1.0, colour: '#d8d8d0' },
    { kind: 'crates', x: 50, z: -1.4 },
    { kind: 'crates', x: 51, z: -1.4 },
    { kind: 'barrier', x: 60, z: 1.6 },
    { kind: 'pallets', x: 72, z: -1.4 },
    { kind: 'skip', x: 86, z: -1.2 },
  ],
  pickups: [
    { id: 'pipe', kind: 'weapon', x: 20, z: 0.2, weapon: 'pipe' },
    { id: 'butty', kind: 'food', x: 46, z: -1.2, amount: 35, label: 'Bacon butty' },
    { id: 'scrap_stash', kind: 'secret', x: 26, z: -0.1, label: 'In the scrap pile', reward: { gear: 'steel_caps', cash: 30 } },
    { id: 'wages', kind: 'cash', x: 64, z: 1.4, amount: 25 },
  ],
  encounters: [
    {
      id: 'yard', triggerX: 30, lock: [20, 46], optional: false,
      waves: [{ enemies: [{ archetype: 'bruiser' }, { archetype: 'thug' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'boxer' }, { archetype: 'tooled', weapon: 'pipe' }] }],
      reward: { cash: 70, xp: 220 }, objective: 'Get across the yard',
    },
    { id: 'loading_bay', triggerX: 58, optional: true, waves: [{ enemies: [{ archetype: 'kickboxer' }, { archetype: 'defender' }] }], reward: { cash: 50, xp: 150 } },
    {
      id: 'sully', triggerX: 78, lock: [68, 92], optional: false, boss: 'sully',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Find Sully at his boxing gym',
    },
  ],
  lights: [
    { x: 10, y: 5, z: 0.4, colour: 0xd0ffe0, intensity: 14, range: 14 },
    { x: 40, y: 5, z: 0.4, colour: 0xd0ffe0, intensity: 14, range: 14 },
    { x: 80, y: 5, z: 0.4, colour: 0xffd0a0, intensity: 16, range: 14 },
  ],
  objective: 'Find Sully Kane’s gym',
};

// ---- subway ------------------------------------------------------------------------

const subway: LevelDef = {
  id: 'subway',
  name: 'Ring Road Subway',
  district: 'The Subway',
  theme: 'subway',
  bounds: { minX: 0, maxX: 72, minZ: -1.6, maxZ: 1.6 },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 70, z: 0, facing: -1 },
    { id: 'estate', x: 66, z: -0.9, facing: -1 },
  ],
  exits: [
    { id: 'to_industrial', kind: 'edge', side: 'left', x: 0, z: 0, to: 'industrial', toEntry: 'right', label: 'Industrial Quarter' },
    { id: 'to_city', kind: 'edge', side: 'right', x: 72, z: 0, to: 'city', toEntry: 'left', label: 'City Centre' },
    { id: 'estate_stairs', kind: 'door', x: 66, z: -1.5, to: 'estate', toEntry: 'subway', label: 'Stairs up to the estate' },
  ],
  facades: [
    { kind: 'subway', x0: 0, x1: 72 },
  ],
  // The gate fences off the estate stairs until the lever is pulled.
  walls: [{ minX: 62, maxX: 72, minZ: -0.6, maxZ: -0.45 }],
  gates: [{ id: 'stairs_gate', x: 62, z0: -1.7, z1: -0.45, openFlag: 'shortcut_subway', label: 'Stairs gate' }],
  levers: [{ id: 'gate_lever', x: 44, z: -1.2, sets: 'shortcut_subway', label: 'Pull the gate lever', doneText: 'Shortcut open: the subway stairs now lead to the estate' }],
  props: [
    { kind: 'bin', x: 8, z: -1.25 },
    { kind: 'trolley', x: 20, z: 1.0 },
    { kind: 'barrier', x: 30, z: -1.4 },
    { kind: 'cone', x: 36, z: 0.6 },
    { kind: 'bin', x: 52, z: 1.25 },
    { kind: 'crates', x: 64, z: 1.1 },
  ],
  pickups: [
    { id: 'meal_deal', kind: 'food', x: 26, z: 0.4, amount: 35, label: 'Meal deal' },
    { id: 'busker_hat', kind: 'cash', x: 12, z: -1.0, amount: 15 },
    { id: 'tile_stash', kind: 'secret', x: 70, z: -1.3, label: 'Behind a loose tile', reward: { gear: 'mouthguard', cosmetic: 'acc:chain' } },
  ],
  encounters: [
    {
      id: 'underpass', triggerX: 22, lock: [12, 36], optional: false,
      waves: [{ enemies: [{ archetype: 'kickboxer' }, { archetype: 'hothead' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'grappler' }, { archetype: 'tooled', weapon: 'bat' }] }],
      reward: { cash: 80, xp: 260 }, objective: 'Get through the underpass',
    },
    { id: 'night_bus_lot', triggerX: 54, optional: true, waves: [{ enemies: [{ archetype: 'elite' }] }], reward: { cash: 60, xp: 180 } },
  ],
  lights: [
    { x: 8, y: 2.8, z: -0.4, colour: 0xe8fff0, intensity: 8, range: 9 },
    { x: 24, y: 2.8, z: -0.4, colour: 0xe8fff0, intensity: 8, range: 9 },
    { x: 40, y: 2.8, z: -0.4, colour: 0xe8fff0, intensity: 8, range: 9 },
    { x: 58, y: 2.8, z: -0.4, colour: 0xe8fff0, intensity: 8, range: 9 },
  ],
  objective: 'Through the subway to the City Centre',
};

// ---- city centre -------------------------------------------------------------------

const city: LevelDef = {
  id: 'city',
  name: 'Market Square',
  district: 'City Centre',
  theme: 'city',
  bounds: { minX: 0, maxX: 92, ...STREET_Z },
  entries: [
    { id: 'left', x: 2, z: 0, facing: 1 },
    { id: 'right', x: 90, z: 0, facing: -1 },
  ],
  exits: [
    { id: 'to_subway', kind: 'edge', side: 'left', x: 0, z: 0, to: 'subway', toEntry: 'right', label: 'Subway' },
    { id: 'to_territory', kind: 'edge', side: 'right', x: 92, z: 0, to: 'territory', toEntry: 'left', label: 'The Pit', requires: 'boss_ratcatcher', lockedText: 'The Ratcatcher’s crew won’t let you past' },
  ],
  facades: [
    { kind: 'office', x0: 0, x1: 18, label: 'MERIDIAN HOUSE' },
    { kind: 'shop', x0: 18, x1: 30, label: 'GREGGS-ISH BAKERY', colour: '#1b3d6e' },
    { kind: 'club', x0: 30, x1: 46, label: 'VELVET' },
    { kind: 'office', x0: 46, x1: 62 },
    { kind: 'shop', x0: 62, x1: 72, label: 'CASH CONVERTERS', colour: '#c9a227' },
    { kind: 'club', x0: 72, x1: 92, label: 'RAT & CASTLE' },
  ],
  props: [
    { kind: 'bollard', x: 6, z: 1.2 },
    { kind: 'bollard', x: 7.5, z: 1.2 },
    { kind: 'busstop', x: 14, z: -1.55 },
    { kind: 'planter', x: 24, z: -1.5 },
    { kind: 'barrier', x: 38, z: 1.6 },
    { kind: 'car', x: 52, z: 1.3, colour: '#111111' },
    { kind: 'bench', x: 60, z: -1.65 },
    { kind: 'phonebox', x: 70, z: -1.4 },
    { kind: 'barrier', x: 82, z: -1.6 },
  ],
  pickups: [
    { id: 'sausage_roll', kind: 'food', x: 22, z: -0.8, amount: 35, label: 'Sausage roll' },
    { id: 'dropped_wallet', kind: 'cash', x: 44, z: 1.5, amount: 40 },
    { id: 'bat', kind: 'weapon', x: 56, z: -0.6, weapon: 'bat' },
    { id: 'club_stash', kind: 'secret', x: 31, z: -1.8, label: 'Club bins', reward: { gear: 'leather_jacket', cosmetic: 'top:tracksuit' } },
    { id: 'curry', kind: 'food', x: 66, z: 0.8, amount: 45, label: 'Curry' },
  ],
  encounters: [
    {
      id: 'square', triggerX: 32, lock: [20, 46], optional: false,
      waves: [{ enemies: [{ archetype: 'boxer' }, { archetype: 'hothead' }, { archetype: 'thug' }] }, { enemies: [{ archetype: 'kickboxer' }, { archetype: 'tooled', weapon: 'bat' }] }],
      reward: { cash: 100, xp: 320 }, objective: 'Get across the square',
    },
    { id: 'doormen', triggerX: 62, optional: true, waves: [{ enemies: [{ archetype: 'defender' }, { archetype: 'defender' }] }], reward: { cash: 70, xp: 200 } },
    {
      id: 'ratcatcher', triggerX: 80, lock: [70, 92], optional: false, boss: 'ratcatcher',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Find the Ratcatcher at the Rat & Castle',
    },
  ],
  lights: [
    { x: 10, y: 4.6, z: 0.6, colour: 0xfff0d0, intensity: 15, range: 14 },
    { x: 38, y: 4.6, z: 0.6, colour: 0xff70c0, intensity: 15, range: 14 },
    { x: 64, y: 4.6, z: 0.6, colour: 0xfff0d0, intensity: 15, range: 14 },
    { x: 82, y: 4.6, z: 0.6, colour: 0xa070ff, intensity: 16, range: 14 },
  ],
  objective: 'Find the Ratcatcher',
};

// ---- the pit -------------------------------------------------------------------------

const territory: LevelDef = {
  id: 'territory',
  name: 'The Pit',
  district: 'Dunc’s Territory',
  theme: 'territory',
  bounds: { minX: 0, maxX: 80, ...STREET_Z },
  entries: [{ id: 'left', x: 2, z: 0, facing: 1 }],
  exits: [{ id: 'to_city', kind: 'edge', side: 'left', x: 0, z: 0, to: 'city', toEntry: 'right', label: 'City Centre' }],
  facades: [
    { kind: 'warehouse', x0: 0, x1: 20, label: 'CONDEMNED' },
    { kind: 'hoarding', x0: 20, x1: 36 },
    { kind: 'garages', x0: 36, x1: 48 },
    { kind: 'warehouse', x0: 48, x1: 80, label: 'THE PIT' },
  ],
  props: [
    { kind: 'drum', x: 8, z: -1.4 },
    { kind: 'scrap', x: 18, z: 1.0 },
    { kind: 'skip', x: 30, z: -1.2 },
    { kind: 'van', x: 42, z: 1.1, colour: '#202020' },
    { kind: 'pallets', x: 50, z: -1.4 },
    { kind: 'drum', x: 76, z: -1.5 },
    { kind: 'drum', x: 76.7, z: -1.3 },
  ],
  pickups: [
    { id: 'pipe', kind: 'weapon', x: 12, z: 0.3, weapon: 'pipe' },
    { id: 'energy', kind: 'food', x: 34, z: 0.6, amount: 50, label: 'Energy drink' },
    { id: 'van_stash', kind: 'secret', x: 42, z: -0.2, label: 'In the van', reward: { gear: 'lucky_chain', cosmetic: 'acc:headguard', cash: 100 } },
  ],
  encounters: [
    {
      id: 'gauntlet', triggerX: 22, lock: [10, 38], optional: false,
      waves: [
        { enemies: [{ archetype: 'bruiser' }, { archetype: 'tooled', weapon: 'bat' }, { archetype: 'hothead' }] },
        { enemies: [{ archetype: 'elite' }, { archetype: 'thug' }] },
      ],
      reward: { cash: 150, xp: 450 }, objective: 'Get through Dunc’s crew',
    },
    {
      id: 'dunc', triggerX: 62, lock: [52, 80], optional: false, boss: 'dunc',
      waves: [{ enemies: [] }],
      reward: { cash: 0, xp: 0 }, objective: 'Into the Pit. Big Dunc is waiting.',
    },
  ],
  lights: [
    { x: 14, y: 4.4, z: 0.2, colour: 0xff7a40, intensity: 13, range: 13 },
    { x: 38, y: 4.4, z: 0.2, colour: 0xff7a40, intensity: 13, range: 13 },
    { x: 66, y: 4.4, z: 0.2, colour: 0xff3020, intensity: 18, range: 16 },
  ],
  objective: 'End it with Big Dunc',
};

export const LEVELS: Record<AreaId, LevelDef> = {
  home,
  estate,
  high_street: highStreet,
  alleys,
  industrial,
  subway,
  city,
  territory,
};

/** Which district boss you need to beat next, for the story screen. */
export const DISTRICT_ORDER: { flag: string; area: AreaId; label: string }[] = [
  { flag: 'boss_gaffer', area: 'high_street', label: 'Take the High Street from the Gaffer' },
  { flag: 'boss_sully', area: 'industrial', label: 'Beat Sully Kane in the Industrial Quarter' },
  { flag: 'boss_ratcatcher', area: 'city', label: 'Take down the Ratcatcher in the City Centre' },
  { flag: 'boss_dunc', area: 'territory', label: 'Finish Big Dunc in the Pit' },
];
