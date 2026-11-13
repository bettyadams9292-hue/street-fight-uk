import type { LevelDef, PropDef } from './LevelTypes';
import { FURNITURE } from '../property/catalogue';
import { EQUIPMENT } from '../business/catalogue';
import { GYM_KIT } from '../training/gym';
import { COMPANION_LIST } from '../companions/companions';
import type { AreaId } from '../progress/Progress';

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
  exits: [
    { id: 'out', kind: 'door', x: 13.4, z: 0.9, to: 'city', toEntry: 'pawn', label: 'Back out to Market Square' },
    // Lets you come here by cab before you've fought your way to Market Square.
    { id: 'cab_home', kind: 'door', x: 0.8, z: 0.9, to: 'home', toEntry: 'door', label: 'Back door: Dave’s cab home' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 14, label: 'PAWN & GOLD — WE BUY GOLD', colour: '#3a3428' }],
  props: [
    { kind: 'display_cabinet', x: 2.3, z: -1.25 },
    { kind: 'display_cabinet', x: 4.2, z: -1.25 },
    { kind: 'glass_counter', x: 7.2, z: -0.6 },
    { kind: 'shop_shelf', x: 10.4, z: -1.4 },
    { kind: 'display_cabinet', x: 3.4, z: 1.05 },
    { kind: 'atm', x: 12.0, z: -1.35 },
  ],
  containers: [
    { id: 'pawn_till', kind: 'till', x: 8.4, z: 0.2, label: 'Empty the till', loot: 'till', requires: 'pawn_robbable', lockedText: 'Mr Kaur’s watching you like a hawk.' },
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
  bounds: { minX: 0, maxX: 37, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [{ id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'high_street', toEntry: 'pub', label: 'Back out to the High Street' }],
  facades: [
    { kind: 'interior', x0: 0, x1: 22, label: 'THE RED LION', colour: '#3a1a12' },
    { kind: 'interior', x0: 22, x1: 37, label: 'THE SNUG — FIGHTERS FOR HIRE', colour: '#2a1410' },
  ],
  props: [
    { kind: 'bar', x: 6.5, z: -0.6 },
    { kind: 'fruit_machine', x: 10.2, z: -1.35 },
    { kind: 'pool_table', x: 14.2, z: 0.45 },
    { kind: 'jukebox', x: 17.2, z: -1.35 },
    { kind: 'dj_booth', x: 20.6, z: -1.3 },
    { kind: 'pub_table', x: 3.4, z: 0.9 },
    { kind: 'pub_table', x: 20.2, z: 0.8 },
    { kind: 'pub_table', x: 26.0, z: 0.95 },
    { kind: 'pub_table', x: 30.4, z: 0.95 },
    { kind: 'pub_table', x: 34.8, z: 0.95 },
  ],
  stations: [
    {
      id: 'bar', x: 6.5, z: 0.2, label: 'Order at the bar (Ray)', shop: 'pub',
      npc: { name: 'Ray', seed: 2210, body: 'male', top: 'tshirt', topColour: '#2b2e35', dz: -1.65 },
    },
    ...COMPANION_LIST.map((c, i) => ({
      id: 'recruit' as const, x: 22.9 + i * 1.3, z: -0.25, label: `${c.name}, ${c.role.toLowerCase()}`, tab: c.id,
      npc: { name: c.nickname, seed: c.seed, body: c.body, top: c.look.top ?? 'tshirt', topColour: c.look.topColour, dz: -0.95 },
    })),
  ],
  pickups: [
    { id: 'cue', kind: 'item', item: 'w_pool_cue', x: 12.4, z: -0.6 },
    { id: 'cue2', kind: 'item', item: 'w_pool_cue', x: 16.2, z: 1.15 },
  ],
  containers: [
    { id: 'fruit', kind: 'till', x: 10.2, z: -0.8, label: 'Shake the fruit machine', fixed: [{ id: 'coin_rare' }], cash: 12 },
    { id: 'pub_till', kind: 'till', x: 7.8, z: 0.2, label: 'Empty the till', loot: 'till', requires: 'pub_robbable', lockedText: 'Ray’s got one eye on the till.' },
  ],
  breakables: [
    { id: 'chair1', kind: 'chair', x: 2.4, z: 0.2, hp: 1, drops: 'chair' },
    { id: 'chair2', kind: 'chair', x: 17.9, z: 0.95, hp: 1, drops: 'chair' },
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

// ---- Home & Hearth: furniture shop on the High Street ----------------------------------------------
const F = (item: string, x: number, z: number, extra: Partial<PropDef> = {}): PropDef => ({ kind: 'furniture', item, x, z, size: FURNITURE[item].size, colour: extra.colour ?? FURNITURE[item].colours[0], solid: FURNITURE[item].mount === 'floor', wallY: FURNITURE[item].wallY, ...extra });

const furnitureShop: LevelDef = {
  id: 'furniture_shop',
  name: 'Home & Hearth',
  district: 'High Street',
  theme: 'furniture_store',
  bounds: { minX: 0, maxX: 22, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [
    { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'high_street', toEntry: 'furniture', label: 'Back out to the High Street' },
    { id: 'cab_home', kind: 'door', x: 21.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Loading bay: ride home in the delivery van' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 22, label: 'HOME & HEARTH — FURNITURE · LIGHTING · DECOR', colour: '#e8e0d0' }],
  props: [
    F('rug_long', 3.2, -0.9, { colour: '#8a6a3a' }),
    F('sofa_3', 3.2, -1.65, { colour: '#3a4a6a' }),
    F('coffee_table', 3.2, -0.65),
    F('floor_lamp', 4.85, -1.9, { colour: '#c9a227' }),
    F('painting', 3.2, -2.0),
    F('armchair', 6.0, -1.65, { colour: '#7a2a2a' }),
    F('bed_double', 8.6, -1.1, { colour: '#c8b89a' }),
    F('bedside', 9.75, -1.85),
    F('canvas_art', 8.6, -2.0, { wallY: 2.05 }),
    F('wardrobe2', 11.3, -1.78, { colour: '#e8e4dc' }),
    F('dining_table', 14.0, -1.3, { colour: '#c8a070' }),
    F('dining_chair', 12.95, -1.3, { rot: 1 }),
    F('dining_chair', 15.05, -1.3, { rot: 3 }),
    F('neon_sign', 14.0, -2.0, { wallY: 2.05 }),
    F('plant_tall', 16.1, -1.85),
    F('fridge2', 17.0, -1.75),
    { kind: 'shop_counter', x: 19.2, z: -0.6 },
  ],
  stations: [
    {
      id: 'furniture_counter', x: 19.2, z: 0.2, label: 'Talk to Bev (furniture, floors and walls)',
      npc: { name: 'Bev', seed: 7731, body: 'female', top: 'tshirt', topColour: '#2a4a3a', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.4, colour: 0xffe8c8, intensity: 9, range: 9 },
    { x: 11, y: 2.8, z: -0.4, colour: 0xffe8c8, intensity: 9, range: 9 },
    { x: 18, y: 2.8, z: -0.4, colour: 0xfff4e0, intensity: 8, range: 8 },
  ],
  weather: 'indoors',
  objective: 'Browse the showroom, buy at the counter: it’s delivered to your house',
};

// ---- Brackley Motors: car showroom on the trading estate --------------------------------------------
const V = (item: string, x: number, z: number, colour: string, size: [number, number], extra: Partial<PropDef> = {}): PropDef => ({ kind: 'vehicle', item, x, z, colour, size, plinth: true, ...extra });

const carDealer: LevelDef = {
  id: 'car_dealer',
  name: 'Brackley Motors',
  district: 'Trading Estate',
  theme: 'car_showroom',
  bounds: { minX: 0, maxX: 28, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [
    { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'ind_estate', toEntry: 'dealer', label: 'Back out to the trading estate' },
    { id: 'cab_home', kind: 'door', x: 27.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Side door: courtesy car home' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 28, label: 'BRACKLEY MOTORS — NEW & USED', colour: '#e8ecf0' }],
  props: [
    V('corvo', 4.0, -1.05, '#7a1414', [2.1, 1.0]),
    V('regent', 9.2, -1.05, '#1a1a1a', [2.5, 1.0]),
    V('phantom', 14.4, -1.05, '#e8c020', [2.5, 1.0]),
    V('warden', 19.6, -1.05, '#3a4a2a', [2.45, 1.0]),
    { kind: 'shop_counter', x: 24.4, z: -0.6 },
  ],
  stations: [
    {
      id: 'car_counter', x: 24.4, z: 0.2, label: 'Talk to Gav (cars)',
      npc: { name: 'Gav', seed: 3307, body: 'male', top: 'coat', topColour: '#1f2a44', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.9, z: -0.3, colour: 0xf4f8ff, intensity: 11, range: 10 },
    { x: 12, y: 2.9, z: -0.3, colour: 0xf4f8ff, intensity: 11, range: 10 },
    { x: 20, y: 2.9, z: -0.3, colour: 0xf4f8ff, intensity: 11, range: 10 },
  ],
  weather: 'indoors',
  objective: 'Pick a motor. It’ll be parked on your drive.',
};

// ---- Mudlark Moto: off-road bike shop on the trading estate ------------------------------------------
const bikeShop: LevelDef = {
  id: 'bike_shop',
  name: 'Mudlark Moto',
  district: 'Trading Estate',
  theme: 'bike_shop',
  bounds: { minX: 0, maxX: 20, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [
    { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'ind_estate', toEntry: 'bikes', label: 'Back out to the trading estate' },
    { id: 'cab_home', kind: 'door', x: 19.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Workshop door: van home' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 20, label: 'MUDLARK MOTO — OFF-ROAD · MX · ENDURO', colour: '#2a2c30' }],
  props: [
    { kind: 'bike_stand', x: 3.0, z: -1.25 },
    V('pup85', 3.0, -1.25, '#3a9a3a', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 5.1, z: -1.25 },
    V('mx250', 5.1, -1.25, '#1f4fa8', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 7.2, z: -1.25 },
    V('mx450r', 7.2, -1.25, '#3a9a3a', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 9.3, z: -1.25 },
    V('enduro300', 9.3, -1.25, '#e8e4dc', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 11.4, z: -1.25 },
    V('factory450', 11.4, -1.25, '#e86a10', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'tyre_stack', x: 13.1, z: -1.75 },
    { kind: 'workbench', x: 14.9, z: -1.7 },
    { kind: 'shop_counter', x: 17.6, z: -0.6 },
  ],
  stations: [
    {
      id: 'bike_counter', x: 17.6, z: 0.2, label: 'Talk to Deano (bikes)',
      npc: { name: 'Deano', seed: 5519, body: 'male', top: 'hoodie', topColour: '#e86a10', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.4, colour: 0xfff0d8, intensity: 9, range: 9 },
    { x: 11, y: 2.8, z: -0.4, colour: 0xfff0d8, intensity: 9, range: 9 },
    { x: 17, y: 2.8, z: -0.4, colour: 0xe8f0ff, intensity: 8, range: 8 },
  ],
  weather: 'indoors',
  objective: 'Pick a bike. It’ll be waiting in your garage.',
};

// ---- The Golden Lion: casino on Market Square ---------------------------------------------------------
const casino: LevelDef = {
  id: 'casino',
  name: 'The Golden Lion',
  district: 'City Centre',
  theme: 'casino',
  bounds: { minX: 0, maxX: 26, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [
    { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'city', toEntry: 'casino', label: 'Back out to Market Square' },
    { id: 'cab_home', kind: 'door', x: 25.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Rear exit: house cab home' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 26, label: 'THE GOLDEN LION', colour: '#3a0e14' }],
  props: [
    { kind: 'casino_cage', x: 4.0, z: -0.6 },
    { kind: 'prize_podium', x: 9.4, z: -1.0 },
    { kind: 'slot_machine', x: 13.4, z: -1.75 },
    { kind: 'slot_machine', x: 14.3, z: -1.75 },
    { kind: 'slot_machine', x: 15.2, z: -1.75 },
    { kind: 'slot_machine', x: 16.1, z: -1.75 },
    { kind: 'roulette_table', x: 19.2, z: -0.45 },
    { kind: 'blackjack_table', x: 23.2, z: -0.45 },
  ],
  stations: [
    {
      id: 'casino_cashier', x: 4.0, z: 0.2, label: 'Cashier (Vee): prize draw and the motor competition',
      npc: { name: 'Vee', seed: 8812, body: 'female', top: 'coat', topColour: '#1a1a1a', dz: -1.65 },
    },
    { id: 'casino_slots', x: 14.75, z: -0.9, label: 'Play the slots' },
    {
      id: 'casino_roulette', x: 19.2, z: 0.55, label: 'Roulette table',
      npc: { name: 'Marco', seed: 6604, body: 'male', top: 'coat', topColour: '#1a1a1a', dz: -2.0 },
    },
    {
      id: 'casino_blackjack', x: 23.2, z: 0.55, label: 'Blackjack table',
      npc: { name: 'Jade', seed: 4417, body: 'female', top: 'coat', topColour: '#1a1a1a', dz: -2.0 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.2, colour: 0xffc070, intensity: 9, range: 9 },
    { x: 10, y: 2.8, z: -0.2, colour: 0xffe0a0, intensity: 10, range: 9 },
    { x: 15, y: 2.6, z: -0.6, colour: 0xff4aa0, intensity: 6, range: 6 },
    { x: 21, y: 2.8, z: -0.2, colour: 0xffc070, intensity: 9, range: 9 },
  ],
  weather: 'indoors',
  objective: 'Slots, roulette, blackjack, and a motor on the podium. Play responsibly: it’s only game money.',
};

// ---- Green Fingers Hydroponics: grow shop on the trading estate ------------------------------------
const EQ = (item: string, x: number, z: number, extra: Partial<PropDef> = {}): PropDef => ({
  kind: 'equipment', item, x, z, size: EQUIPMENT[item].size, solid: EQUIPMENT[item].mount === 'floor', wallY: EQUIPMENT[item].wallY, plinth: EQUIPMENT[item].mount === 'floor', label: 'ok|0|on', ...extra,
});

const growShop: LevelDef = {
  id: 'grow_shop',
  name: 'Green Fingers Hydroponics',
  district: 'Trading Estate',
  theme: 'grow_shop',
  bounds: { minX: 0, maxX: 20, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [
    { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'ind_estate', toEntry: 'grow', label: 'Back out to the trading estate' },
    { id: 'cab_home', kind: 'door', x: 19.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Back door: Kez’s van home' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 20, label: 'GREEN FINGERS — HYDROPONICS · LIGHTING · VENTILATION', colour: '#e8ece4' }],
  props: [
    { kind: 'grow_shelf', x: 3.0, z: -1.85, label: 'room' },
    { kind: 'grow_shelf', x: 5.6, z: -1.85, label: 'environment' },
    EQ('tent_d', 8.7, -1.55),
    EQ('led_array', 11.1, -1.75),
    EQ('air_handler', 12.9, -1.65),
    EQ('monitors', 14.9, -1.8),
    EQ('cctv', 14.9, -2.0, { plinth: false }),
    EQ('control', 10.0, -2.0, { plinth: false }),
    { kind: 'shop_counter', x: 17.6, z: -0.6 },
    // Display pieces between the stands (hydroponics pack, real size).
    { kind: 'hydro_prop', item: 'vertical_tower', x: 7.15, z: -1.8, size: [0.4, 0.4] },
    { kind: 'hydro_prop', item: 'cannabis_plant', x: 10.1, z: -1.9, size: [0.3, 0.3] },
    { kind: 'hydro_prop', item: 'dwc_bucket', x: 15.9, z: -2.0, size: [0.25, 0.25] },
  ],
  stations: [
    { id: 'grow_display', x: 3.0, z: -1.1, label: 'Browse room equipment', tab: 'room' },
    { id: 'grow_display', x: 5.6, z: -1.1, label: 'Browse lighting, air and climate kit', tab: 'environment' },
    { id: 'grow_display', x: 8.7, z: -0.55, label: 'Look at the grow tents', tab: 'room' },
    { id: 'grow_display', x: 12.0, z: -0.85, label: 'Look at the environmental kit', tab: 'environment' },
    { id: 'grow_display', x: 14.9, z: -1.1, label: 'Browse security', tab: 'security' },
    {
      id: 'grow_counter', x: 17.6, z: 0.2, label: 'Talk to Kez (checkout, upgrades, basement works)', tab: 'upgrades',
      npc: { name: 'Kez', seed: 6120, body: 'female', top: 'hoodie', topColour: '#2a8a3a', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.4, colour: 0xf0fff0, intensity: 9, range: 9 },
    { x: 10, y: 2.6, z: -0.8, colour: 0xd8b0ff, intensity: 6, range: 6 },
    { x: 16, y: 2.8, z: -0.4, colour: 0xf0fff0, intensity: 9, range: 9 },
  ],
  weather: 'indoors',
  objective: 'Kit out the basement. Everything you buy goes into basement storage.',
};

// ---- Iron Temple: gym equipment store (Leisure Park) ------------------------------------------------
/** Gym dressing (GymLibrary models): `size` is the half footprint; small pieces don't block the way. */
const GYM = (item: string, x: number, z: number, size: [number, number]): PropDef => ({ kind: 'gym_prop', item, x, z, size, solid: size[0] > 0.3 });
const KIT = (item: string, x: number, z: number): PropDef => ({ kind: 'gym_kit', item, x, z, size: GYM_KIT[item].size, solid: GYM_KIT[item].solid, plinth: true });

const gymStore: LevelDef = {
  id: 'gym_store',
  name: 'Iron Temple Fitness',
  district: 'Leisure Park',
  theme: 'gym_store',
  bounds: { minX: 0, maxX: 22, ...ROOM },
  entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
  exits: [
    { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: 'leisure', toEntry: 'irontemple', label: 'Back out to Leisure Park' },
    { id: 'cab_home', kind: 'door', x: 21.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Delivery bay: ride home with the van' },
  ],
  facades: [{ kind: 'interior', x0: 0, x1: 22, label: 'IRON TEMPLE — HOME GYM EQUIPMENT', colour: '#2a2c30' }],
  props: [
    KIT('dumbbells', 3.0, -1.85),
    KIT('barbell', 5.2, -1.75),
    KIT('treadmill', 7.9, -1.7),
    KIT('exercise_bike', 10.3, -1.8),
    KIT('bag', 12.2, -1.55),
    KIT('mat', 14.6, -1.3),
    KIT('speed_ball', 16.3, -2.0),
    { kind: 'shop_counter', x: 19.2, z: -0.6 },
    // Dressing between the displays: plates, a pair of dumbbells, an incline bench by the till.
    GYM('plate_stack', 4.0, -2.15, [0.2, 0.2]),
    GYM('plate_stack_b', 6.45, -2.15, [0.2, 0.2]),
    GYM('dumbbell_medium', 13.3, -2.2, [0.16, 0.16]),
    GYM('incline_bench', 17.55, -1.9, [0.45, 0.22]),
  ],
  stations: [
    { id: 'gym_counter', x: 3.0, z: -1.0, label: 'Dumbbell rack: strength', tab: 'dumbbells' },
    { id: 'gym_counter', x: 5.2, z: -0.9, label: 'Barbell & squat rack: strength', tab: 'barbell' },
    { id: 'gym_counter', x: 7.9, z: -0.9, label: 'Treadmill: stamina', tab: 'treadmill' },
    { id: 'gym_counter', x: 10.3, z: -1.0, label: 'Exercise bike: conditioning', tab: 'exercise_bike' },
    { id: 'gym_counter', x: 12.2, z: -0.85, label: 'Heavy bag: punch power', tab: 'bag' },
    { id: 'gym_counter', x: 14.6, z: 0.3, label: 'Training mat: agility', tab: 'mat' },
    { id: 'gym_counter', x: 16.3, z: -1.0, label: 'Speed ball: technique', tab: 'speed_ball' },
    {
      id: 'gym_counter', x: 19.2, z: 0.2, label: 'Talk to Sam (all equipment)', tab: 'dumbbells',
      npc: { name: 'Sam', seed: 4471, body: 'male', top: 'vest', topColour: '#9a1c1c', dz: -1.65 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.4, colour: 0xf4f8ff, intensity: 10, range: 9 },
    { x: 11, y: 2.8, z: -0.4, colour: 0xf4f8ff, intensity: 10, range: 9 },
    { x: 18, y: 2.8, z: -0.4, colour: 0xfff4e0, intensity: 8, range: 8 },
  ],
  weather: 'indoors',
  objective: 'Kit out the home gym. Everything’s delivered and set up for you.',
};

// ---- fighting gyms ------------------------------------------------------------------------------------
function fightGym(
  id: 'boxing_gym' | 'karate_dojo' | 'wrestling_club',
  name: string,
  district: string,
  street: AreaId,
  streetEntry: string,
  floor: 'boxing_ring' | 'dojo_mat' | 'wrestling_mat',
  coach: { name: string; seed: number; body: 'male' | 'female'; top: string; colour: string },
  sign: string,
  wall: string,
): LevelDef {
  return {
    id,
    name,
    district,
    theme: id,
    bounds: { minX: 0, maxX: 20, ...ROOM },
    entries: [{ id: 'door', x: 1.4, z: 0.4, facing: 1 }],
    exits: [
      { id: 'out', kind: 'door', x: 0.6, z: 0.9, to: street, toEntry: streetEntry, label: 'Back outside' },
      { id: 'cab_home', kind: 'door', x: 19.4, z: 0.9, to: 'home', toEntry: 'door', label: 'Fire exit: lift home' },
    ],
    facades: [{ kind: 'interior', x0: 0, x1: 20, label: sign, colour: wall }],
    props: [
      { kind: floor, x: 8.5, z: -1.0 },
      { kind: 'bag', x: 13.4, z: -1.55 },
      { kind: 'bag', x: 15.0, z: -1.55 },
      { kind: 'gym_rack', x: 17.6, z: -1.85 },
      GYM('flat_bench', 3.4, -1.5, [0.6, 0.2]),
      GYM('plate_stack', 19.0, -2.1, [0.2, 0.2]),
      GYM('dumbbell_large', 12.3, -2.15, [0.17, 0.17]),
    ],
    stations: [
      {
        id: 'style_coach', x: 4.6, z: -0.6, label: `Talk to ${coach.name} (learn styles and techniques)`, tab: id,
        npc: { name: coach.name, seed: coach.seed, body: coach.body, top: coach.top, topColour: coach.colour, dz: -0.9 },
      },
      { id: 'style_drill', x: 8.5, z: 0.45, label: 'Drill combinations on the pads', tab: id },
    ],
    pickups: [],
    encounters: [],
    lights: [
      { x: 5, y: 2.8, z: -0.4, colour: 0xfff0d8, intensity: 9, range: 9 },
      { x: 9, y: 2.6, z: -0.8, colour: 0xffffff, intensity: 10, range: 7 },
      { x: 15, y: 2.8, z: -0.4, colour: 0xfff0d8, intensity: 8, range: 8 },
    ],
    weather: 'indoors',
    objective: `${coach.name} teaches here. Learn the style, drill it, earn its techniques.`,
  };
}

const boxingGym = fightGym('boxing_gym', 'Del’s Boxing Club', 'Tanner Road Estate', 'estate', 'boxing', 'boxing_ring', { name: 'Coach Del', seed: 3301, body: 'male', top: 'tshirt', colour: '#7a1414' }, 'DEL’S BOXING CLUB — EST. 1979', '#5a2a22');
const karateDojo = fightGym('karate_dojo', 'Okafor Karate & Muay Thai', 'Leisure Park', 'leisure', 'dojo', 'dojo_mat', { name: 'Mrs Okafor', seed: 3302, body: 'female', top: 'tshirt', colour: '#f0eee8' }, 'OKAFOR KARATE & MUAY THAI', '#e8e0d0');
const wrestlingClub = fightGym('wrestling_club', 'Kev’s Wrestling & Grappling', 'Kingsway Precinct', 'precinct', 'wrestling', 'wrestling_mat', { name: 'Big Kev', seed: 3303, body: 'male', top: 'vest', colour: '#1f2a44' }, 'KEV’S WRESTLING & GRAPPLING', '#3a4a5a');

export const INTERIORS = {
  gym_store: gymStore,
  boxing_gym: boxingGym,
  karate_dojo: karateDojo,
  wrestling_club: wrestlingClub,
  grow_shop: growShop,
  clothes_shop: clothesShop, pawn_shop: pawnShop, pub,
  furniture_shop: furnitureShop, car_dealer: carDealer, bike_shop: bikeShop, casino,
};
