import type { LevelDef } from './LevelTypes';

/**
 * Buildings you can walk into. Same rules as the streets: what you see is
 * what you bump into.
 */

const ROOM = { minZ: -1.6, maxZ: 1.4 };

// ---- Threads: clothes shop on the High Street -------------------------------------------------
const clothesShop: LevelDef = {
  id: 'clothes_shop',
  name: 'Threads',
  district: 'High Street',
  theme: 'shop',
  bounds: { minX: 0, maxX: 16, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [{ id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'high_street', toEntry: 'clothes', label: 'Back out to the High Street' }],
  facades: [{ kind: 'interior', x0: 0, x1: 16, label: 'THREADS', colour: '#e8e4dc' }],
  props: [
    { kind: 'mannequin', x: 2.6, z: -1.35 },
    { kind: 'shop_rail', x: 4.6, z: -1.3 },
    { kind: 'shop_rail', x: 4.6, z: 1.0 },
    { kind: 'shop_shelf', x: 7.6, z: -1.4 },
    { kind: 'mannequin', x: 9.2, z: 1.15 },
    { kind: 'shop_counter', x: 11.4, z: -0.6 },
    { kind: 'shop_rail', x: 13.4, z: 1.0 },
    { kind: 'changing_booth', x: 15.0, z: -1.0 },
  ],
  stations: [
    {
      id: 'clothes_counter', x: 11.4, z: 0.2, label: 'Talk to Priya (shop)', shop: 'threads',
      npc: { name: 'Priya', seed: 4411, body: 'female', top: 'tshirt', topColour: '#101012', dz: -1.65 },
    },
    { id: 'changing', x: 15.0, z: 0.05, label: 'Changing room: try things on', shop: 'threads' },
  ],
  pickups: [],
  containers: [
    { id: 'till', kind: 'till', x: 12.4, z: 0.2, label: 'Empty the till', loot: 'till', requires: 'threads_robbable', lockedText: 'Priya’s stood right there.' },
  ],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.2, colour: 0xfff8f0, intensity: 9, range: 9 },
    { x: 12, y: 2.8, z: -0.2, colour: 0xfff8f0, intensity: 9, range: 9 },
  ],
  weather: 'indoors',
  objective: 'Browse, try things on, pay at the counter',
};

// ---- Pawn & Gold: pawn shop in the City Centre --------------------------------------------------
const pawnShop: LevelDef = {
  id: 'pawn_shop',
  name: 'Pawn & Gold',
  district: 'City Centre',
  theme: 'pawn',
  bounds: { minX: 0, maxX: 14, ...ROOM },
  entries: [{ id: 'door', x: 12.6, z: 0.4, facing: -1 }],
  exits: [{ id: 'out', kind: 'door', x: 13.4, z: 0.9, to: 'city', toEntry: 'pawn', label: 'Back out to Market Square' }],
  facades: [{ kind: 'interior', x0: 0, x1: 14, label: 'PAWN & GOLD — WE BUY GOLD', colour: '#3a3428' }],
  props: [
    { kind: 'display_cabinet', x: 1.6, z: -1.25 },
    { kind: 'display_cabinet', x: 4.2, z: -1.25 },
    { kind: 'glass_counter', x: 7.2, z: -0.6 },
    { kind: 'shop_shelf', x: 10.4, z: -1.4 },
    { kind: 'display_cabinet', x: 3.4, z: 1.05 },
    { kind: 'atm', x: 12.6, z: -1.35 },
  ],
  stations: [
    {
      id: 'pawn_counter', x: 7.2, z: 0.2, label: 'Talk to Mr Kaur (pawnbroker)', shop: 'pawn',
      npc: { name: 'Mr Kaur', seed: 9031, body: 'male', top: 'coat', topColour: '#3a3d44', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 3, y: 2.8, z: -0.4, colour: 0xfff0c8, intensity: 8, range: 8 },
    { x: 9, y: 2.8, z: -0.4, colour: 0xfff0c8, intensity: 8, range: 8 },
  ],
  weather: 'indoors',
  objective: 'Sell your valuables at the counter',
};

// ---- The Red Lion: pub on the High Street -------------------------------------------------------
const pub: LevelDef = {
  id: 'pub',
  name: 'The Red Lion',
  district: 'High Street',
  theme: 'pub',
  bounds: { minX: 0, maxX: 22, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [{ id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'high_street', toEntry: 'pub', label: 'Back out to the High Street' }],
  facades: [{ kind: 'interior', x0: 0, x1: 22, label: 'THE RED LION', colour: '#3a1a12' }],
  props: [
    { kind: 'bar', x: 6.5, z: -0.6 },
    { kind: 'fruit_machine', x: 10.2, z: -1.35 },
    { kind: 'pool_table', x: 14.2, z: 0.45 },
    { kind: 'jukebox', x: 17.2, z: -1.35 },
    { kind: 'pub_table', x: 3.4, z: 0.9 },
    { kind: 'pub_table', x: 20.2, z: 0.8 },
  ],
  stations: [
    {
      id: 'bar', x: 6.5, z: 0.2, label: 'Order at the bar (Ray)',
      npc: { name: 'Ray', seed: 2210, body: 'male', top: 'tshirt', topColour: '#2b2e35', dz: -1.65 },
    },
  ],
  pickups: [
    { id: 'cue', kind: 'item', item: 'w_pool_cue', x: 12.4, z: -0.6 },
    { id: 'cue2', kind: 'item', item: 'w_pool_cue', x: 16.2, z: 1.15 },
  ],
  containers: [
    { id: 'fruit', kind: 'till', x: 10.2, z: -0.8, label: 'Shake the fruit machine', fixed: [{ id: 'coin_rare' }], cash: 12 },
  ],
  breakables: [
    { id: 'chair1', kind: 'chair', x: 2.4, z: 0.2, hp: 1, drops: 'chair' },
    { id: 'chair2', kind: 'chair', x: 19.0, z: 0.1, hp: 1, drops: 'chair' },
    { id: 'table3', kind: 'table', x: 8.6, z: 1.0, hp: 2, drops: 'table_leg' },
  ],
  encounters: [
    {
      id: 'lock_in', triggerX: 12, optional: true,
      waves: [{ enemies: [{ archetype: 'brawler' }, { archetype: 'brawler' }] }, { enemies: [{ archetype: 'casual' }, { archetype: 'tooled', weapon: 'pool_cue' }] }],
      reward: { cash: 50, xp: 140 },
    },
  ],
  lights: [
    { x: 5, y: 2.6, z: -0.3, colour: 0xffb060, intensity: 8, range: 8 },
    { x: 14, y: 2.6, z: 0.3, colour: 0xffd090, intensity: 9, range: 8 },
    { x: 20, y: 2.6, z: -0.3, colour: 0xffb060, intensity: 7, range: 8 },
  ],
  weather: 'indoors',
  objective: 'A pint, a game of pool, and the regulars looking for trouble',
};

export const INTERIORS = { clothes_shop: clothesShop, pawn_shop: pawnShop, pub };
