import { DECOR_SIZE } from './decorSizes';
import type { LevelDef, PropDef } from './LevelTypes';
import { FURNITURE } from '../property/catalogue';
import { EQUIPMENT } from '../business/catalogue';
import { GYM_KIT } from '../training/gym';
import { COMPANION_LIST } from '../companions/companions';
import type { AreaId } from '../progress/Progress';
import { ROOM_EXTRA, deepRoom } from './rooms';
import { D, addDecor } from './roomDecor';

/**
 * Buildings you can walk into. Same rules as the streets: what you see is
 * what you bump into.
 */

const ROOM = { minZ: -1.6, maxZ: 1.4 };

/** A catalogue furniture piece as dressing (wall pieces go at z -2.0 with their wallY). */
const F = (item: string, x: number, z: number, extra: Partial<PropDef> = {}): PropDef => ({ kind: 'furniture', item, x, z, size: FURNITURE[item].size, colour: extra.colour ?? FURNITURE[item].colours[0], solid: FURNITURE[item].mount === 'floor', wallY: FURNITURE[item].wallY, ...extra });

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
    // Window display by the door, then rails and stocked shelving down both walls, the till, the changing room.
    // The middle (z -0.6 to 0.6) stays clear: it's the way from the door to the counter.
    F('plant_tall', 1.9, -1.85),
    { kind: 'mannequin', x: 2.6, z: -1.35 },
    { kind: 'mannequin', x: 3.3, z: -1.45 },
    F('poster_frame', 2.9, -2.0, { wallY: 1.95 }),
    { kind: 'shop_rail', x: 4.6, z: -1.3 },
    { kind: 'shop_rail', x: 4.6, z: 1.0 },
    { kind: 'shop_rail', x: 6.4, z: 1.0 },
    { kind: 'shop_shelf', x: 6.3, z: -1.4 },
    { kind: 'shop_shelf', x: 7.6, z: -1.4 },
    F('neon_sign', 7.0, -2.0, { wallY: 2.3, colour: '#ff3a5a' }),
    F('rug_long', 8.0, 0.0, { colour: '#2a2a30', solid: false }),
    { kind: 'mannequin', x: 9.2, z: 1.15 },
    { kind: 'shop_shelf', x: 9.2, z: -1.4 },
    { kind: 'shop_counter', x: 11.4, z: -0.6 },
    F('wall_clock', 11.4, -2.0, { wallY: 2.2 }),
    { kind: 'shop_rail', x: 13.4, z: 1.0 },
    { kind: 'shop_rail', x: 13.2, z: -1.3 },
    F('mirror_stand', 14.0, 1.15),
    { kind: 'changing_booth', x: 15.0, z: -1.0 },
    F('plant_small', 15.6, 1.2),
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
    // On the walls: old photos, the clock, a neon sign over the pool table, the trophy cabinet in the snug.
    F('painting', 2.6, -2.0, { wallY: 1.8 }),
    F('poster_frame', 4.0, -2.0, { wallY: 1.8 }),
    F('wall_clock', 6.5, -2.0, { wallY: 2.35 }),
    F('neon_sign', 14.2, -2.0, { wallY: 2.2, colour: '#ffb030' }),
    F('canvas_art', 18.8, -2.0, { wallY: 1.9 }),
    F('wall_light', 9.0, -2.0, { wallY: 2.1 }),
    F('wall_light', 24.0, -2.0, { wallY: 2.1 }),
    F('trophy_cab', 28.2, -1.78),
    F('painting', 31.5, -2.0, { wallY: 1.85 }),
    F('armchair', 33.0, -1.55, { colour: '#5a1a14' }),
    F('plant_tall', 36.3, -1.85),
    F('rug_long', 30.0, 0.2, { colour: '#4a1a14', solid: false }),
    // Somewhere to sit by the door, and a corner seat in the snug.
    F('armchair', 1.9, -1.55, { colour: '#3a1a12' }),
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
    F('dining_chair', 12.95, -1.3, { rot: 3 }),
    F('dining_chair', 15.05, -1.3, { rot: 1 }),
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
  facades: [{ kind: 'interior', x0: 0, x1: 20, label: 'MUDLARK MOTO & CYCLES — BIKES · SCOOTERS · MOTOS', colour: '#2a2c30' }],
  props: [
    { kind: 'bike_stand', x: 3.0, z: -1.25 },
    V('b23_mini_e_mx', 3.0, -1.25, '#3a9a3a', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 5.1, z: -1.25 },
    V('b24_petrol_mx', 5.1, -1.25, '#1f4fa8', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 7.2, z: -1.25 },
    V('b25_supermoto', 7.2, -1.25, '#e8e4dc', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 9.3, z: -1.25 },
    V('b26_sportbike', 9.3, -1.25, '#c82a2a', [0.95, 0.3], { plinth: false, solid: false }),
    { kind: 'bike_stand', x: 11.4, z: -1.25 },
    V('b27_cruiser', 11.4, -1.25, '#1a1a1a', [0.95, 0.3], { plinth: false, solid: false }),
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
      // The club's floor at full size, out in the room: a 5.2 m ring (solid, steps up the near side), or mats you walk on.
      floor === 'boxing_ring' ? { kind: floor, x: 9.5, z: 2.9, size: [2.6, 2.6] } : { kind: floor, x: 9.2, z: 2.6, size: [3.6, 2.4], solid: false },
      { kind: 'bench', x: 3.2, z: 5.2, size: [1.0, 0.25] },
      { kind: 'bench', x: 16.2, z: 5.2, size: [1.0, 0.25] },
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
      { id: 'style_drill', x: floor === 'boxing_ring' ? 13.2 : 9.2, z: floor === 'boxing_ring' ? 2.9 : 2.6, label: 'Drill combinations on the pads', tab: id },
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

// ---- the floor in front: rooms at their real depth ---------------------------------------------
// Each room is about 8 m deep now (world/rooms.ts). What it always had stays against the back wall; this is what
// fills the rest of the floor, the way the place would really be laid out. Everything here stands at z 1.8 or more,
// clear of the walkway, the doors and every counter you use.
const P = (kind: PropDef['kind'], x: number, z: number, extra: Partial<PropDef> = {}): PropDef => ({ kind, x, z, ...extra });
/** A table with a chair either side, facing it. */
const tableFor2 = (x: number, z: number, colour = '#7a1414'): PropDef[] => [
  D('f02_05', x, z, { colour: '#4a2e1a' }),
  F('dining_chair', x - 0.75, z, { rot: 3, colour }),
  F('dining_chair', x + 0.75, z, { rot: 1, colour }),
];
const FRONT: Record<string, PropDef[]> = {
  pub: [...tableFor2(6, 3.2), ...tableFor2(10.5, 4.4), ...tableFor2(15, 3.0), ...tableFor2(21.5, 3.8), ...tableFor2(26, 4.6), ...tableFor2(30.5, 3.2), P('fruit_machine', 35.6, 2.6), P('jukebox', 35.6, 4.2)],
  casino: [
    P('roulette_table', 5.5, 3.2), P('blackjack_table', 11.5, 3.4), P('blackjack_table', 16.8, 3.0),
    ...[20.6, 21.5, 22.4, 23.3, 24.2].map((x) => P('slot_machine', x, 4.8)), ...[20.6, 21.5, 22.4, 23.3, 24.2].map((x) => P('slot_machine', x, 2.4, { rot: 2 })),
  ],
  clothes_shop: [P('shop_rail', 3.4, 2.6), P('shop_rail', 6.6, 3.8), P('shop_rail', 9.8, 2.6), P('mannequin', 12.8, 2.2), P('mannequin', 13.8, 4.2), P('mannequin', 1.4, 4.6), P('shop_shelf', 9.8, 5.0, { size: [1.2, 0.3] })],
  pawn_shop: [P('glass_counter', 5.0, 3.0), P('display_cabinet', 9.4, 3.8), P('shop_shelf', 12.2, 4.8, { size: [1.0, 0.3] }), P('tv', 2.6, 4.4)],
  furniture_shop: [
    F('rug_long', 4.2, 3.4, { solid: false }), F('sofa_3', 4.2, 2.6), F('coffee_table', 4.2, 3.7), F('armchair', 6.6, 3.6, { rot: 1 }), F('floor_lamp', 2.0, 2.4),
    F('bed_double', 11.0, 3.6), F('bedside', 12.2, 2.9), F('bedside', 9.8, 2.9), F('wardrobe2', 13.8, 4.8),
    F('dining_table', 18.0, 3.6), F('dining_chair', 17.4, 2.9), F('dining_chair', 18.6, 2.9), F('dining_chair', 17.4, 4.3, { rot: 2 }), F('dining_chair', 18.6, 4.3, { rot: 2 }),
  ],
  car_dealer: [F('desk2', 23.5, 3.4), F('dining_chair', 23.5, 4.1, { rot: 2 }), F('dining_chair', 23.5, 2.7), F('sofa_2', 19.0, 4.6), F('coffee_table', 19.0, 3.7), F('plant_tall', 26.8, 4.8), F('plant_tall', 15.4, 4.8)],
  // The front floor: a row of bicycles and e-bikes, then the scooters and the moped by the counter.
  bike_shop: [
    ...(['b07_road_racer', 'b10_mtb_hardtail', 'b12_bmx', 'b05_city_stepthrough', 'b17_city_ebike', 'b20_e_mtb'] as const).map((id, i) => V(id, 2.6 + i * 1.75, 3.6, '', [0.85, 0.25], { plinth: false, solid: false })),
    V('b29_standup_escooter', 13.2, 4.6, '', [0.55, 0.2], { plinth: false, solid: false }),
    V('b30_seated_escooter', 14.4, 4.6, '', [0.75, 0.25], { plinth: false, solid: false }),
    V('b28_delivery_moped', 15.9, 4.6, '', [0.9, 0.3], { plinth: false, solid: false }),
    P('tyre_stack', 13.0, 3.0), P('tyre_stack', 13.9, 3.2), P('shop_shelf', 17.6, 4.8, { size: [1.2, 0.3] }),
  ],
  gym_store: [
    P('gym_kit', 4.0, 3.0, { item: 'treadmill' }), P('gym_kit', 7.0, 3.0, { item: 'treadmill' }), P('gym_kit', 10.0, 3.2, { item: 'exercise_bike' }),
    P('gym_kit', 13.5, 4.4, { item: 'dumbbells' }), P('gym_kit', 17.0, 3.2, { item: 'bag' }), P('gym_kit', 19.6, 4.2, { item: 'mat', solid: false }),
  ],
  grow_shop: [P('grow_shelf', 6.0, 3.6), P('grow_shelf', 9.0, 3.6), P('shop_shelf', 13.5, 4.6, { size: [1.2, 0.3] }), P('crates', 17.0, 4.4)],
  jeweller: [P('glass_counter', 4.8, 3.0, { size: [1.0, 0.4] }), P('glass_counter', 9.0, 3.0, { size: [1.0, 0.4] }), P('glass_counter', 13.2, 3.0, { size: [1.0, 0.4] }), P('jewel_bust', 9.0, 4.6), F('plant_tall', 1.4, 4.8), F('plant_tall', 16.6, 4.8)],
  estate_agent: [
    P('computer_desk', 4.0, 3.2), F('dining_chair', 4.0, 3.9), P('computer_desk', 8.0, 3.2), F('dining_chair', 8.0, 3.9),
    F('sofa_2', 11.6, 4.4), F('coffee_table', 11.6, 3.5), F('plant_tall', 1.2, 4.8),
  ],
};

/**
 * Approved models dressing each place, on top of FRONT: pub booths, poseur tables and stools, the dartboard and
 * the chalkboard; filing cabinets and a waiting sofa at the agents; more room sets in the furniture showroom. Kept
 * only where they touch nothing (world/roomDecor.ts addDecor).
 */
const W = (id: string, x: number, wallY: number): PropDef => D(id, x, -2.0, { wallY });
const poseur = (x: number, z: number): PropDef[] => [D('highTable', x, z), D('pubStool', x - 0.84, z), D('pubStool', x + 0.84, z)];
const DECOR: Record<string, PropDef[]> = {
  pub: [
    D('chalkboardMenu', 2.4, 2.1), D('pubBooth', 0.6, 2.9, { rot: 3 }), D('pubBooth', 0.6, 4.6, { rot: 3 }),
    ...poseur(8.4, 5.1), ...poseur(13.0, 5.1), ...poseur(18.6, 5.2), ...poseur(23.8, 2.3), ...poseur(33.0, 5.1),
    D('kegRack', 36.2, 5.3, { rot: 1 }), D('pottedTree', 36.4, 2.2), D('f03_27', 28.4, 2.1),
    W('pubDartboard', 24.0, 1.25), W('wallClock', 12.0, 2.25),
  ],
  casino: [D('pottedTree', 1.2, 2.4), D('pottedTree', 25.2, 5.1), D('f05_12', 8.4, 5.0), D('f02_13', 10.1, 5.0)],
  estate_agent: [D('f03_22', 12.7, 2.1), D('f03_22', 13.3, 2.1), D('pottedTree', 13.4, 5.0), D('f01_21', 1.6, 2.6)],
  car_dealer: [D('waitingSofa', 11.0, 4.8), D('f02_13', 12.4, 4.8), D('pottedTree', 1.2, 2.2)],
  jeweller: [D('waitingSofa', 6.8, 5.0), D('f05_22', 11.2, 5.0)],
  furniture_shop: [
    D('f04_19', 21.0, 2.7), D('f03_08', 1.2, 5.0), D('f05_20', 6.9, 4.95), D('f05_11', 15.6, 2.5),
    D('f02_06', 15.6, 4.9), D('f04_05', 14.6, 4.9, { rot: 3 }), D('f04_05', 16.6, 4.9, { rot: 1 }), D('f03_28', 20.6, 5.0),
  ],
  clothes_shop: [D('f01_19', 15.0, 4.8), D('f06_12', 4.8, 4.8), D('pottedTree', 1.2, 2.2)],
  pawn_shop: [D('f03_30', 1.6, 2.4), D('arcadeCabinet', 12.8, 2.3), D('f01_07', 6.8, 5.0), D('poorSafe', 10.4, 2.3)],
  // Gyms (the approved expansion): mirrors on the back wall, a dumbbell rack and squat rack out on the floor, a bike.
  gym_store: [W('gymMirror', 9.0, 0), D('olympicBar20kg', 6.0, 4.9), D('safeSmall', 18.4, 2.1), D('safeMedium', 19.6, 2.3), D('squatRack', 3.4, 4.3), D('dumbbellRack', 11.5, 4.9)],
  boxing_gym: [W('gymMirror', 6.0, 0), W('gymMirror', 8.2, 0), D('dumbbellRack', 18.4, 4.9), D('exerciseBike', 1.4, 2.4)],
  karate_dojo: [W('gymMirror', 6.0, 0), W('gymMirror', 8.2, 0), D('dumbbellRack', 17.6, 4.9)],
  wrestling_club: [W('gymMirror', 6.0, 0), W('gymMirror', 8.2, 0), D('squatRack', 17.6, 4.4), D('exerciseBike', 1.4, 2.4)],
  bike_shop: [D('f01_18', 1.6, 2.4), D('cardboardBox', 15.6, 2.4), D('cardboardBox', 16.3, 2.4)],
  grow_shop: [D('f01_18', 1.6, 2.4), D('cardboardBox', 2.4, 5.0)],
};

/** An interior with its front floor filled (see FRONT) and dressed (DECOR). */
export function fitOut<T extends LevelDef>(level: T): T {
  const extra = FRONT[level.id];
  const withFront = extra ? { ...level, props: [...level.props, ...extra.map((p) => ({ ...p }))] } : level;
  const decor = DECOR[level.id];
  return decor ? { ...withFront, props: [...withFront.props, ...addDecor(withFront, decor.map((p) => ({ ...p })), withFront.bounds.maxZ + ROOM_EXTRA)] } : withFront;
}

// ---- Central Police Station: the front desk, and through the back the custody suite --------------
/**
 * Central Police Station (police step 1, furnished from the owner's police sets): the custody block at the left
 * end (two holding cells and the interview room against the back wall, the custody sergeant's desk, fingerprints
 * and the property store beside them), the public side at the right (the charge desk where Sgt Hollis keeps the
 * front counter, waiting benches, the noticeboard). Leaving takes you straight home, never back onto Market
 * Square: you come here by cab, by the station door or in the back of a van, and go home when it's sorted.
 */
/** The back wall, and how far a piece of a given half depth stands in front of it. */
const BACK = ROOM.minZ;
const atBack = (id: string) => BACK + 0.06 + DECOR_SIZE[id][1];
const policeStation: LevelDef = {
  id: 'police_station',
  name: 'Central Police Station',
  district: 'City Centre',
  theme: 'shop',
  bounds: { minX: 0, maxX: 26, ...ROOM },
  entries: [
    { id: 'door', x: 24.8, z: 0.4, facing: -1 },
    // Let out of the cells in the morning (or straight after paying bail): in front of the holding cells.
    { id: 'cell', x: 3.2, z: 3.0, facing: 1 },
  ],
  exits: [{ id: 'out', kind: 'door', x: 25.6, z: 0.9, to: 'home', toEntry: 'door', label: 'Leave: straight home' }],
  facades: [{ kind: 'interior', x0: 0, x1: 26, label: 'CENTRAL POLICE STATION', colour: '#16243f' }],
  props: [
    // Custody: the holding cells and the interview room stand against the back wall, their barred doors facing out.
    D('policeHoldingCellDouble', 2.45, atBack('policeHoldingCellDouble')),
    D('policeHoldingCellSingle', 6.5, atBack('policeHoldingCellSingle')),
    D('policeInterviewRoom', 10.4, atBack('policeInterviewRoom')),
    D('policeCustodyDesk', 14.2, atBack('policeCustodyDesk')),
    D('policeFingerprintStation', 16.6, atBack('policeFingerprintStation')),
    D('policePropertyStorage', 18.9, atBack('policePropertyStorage')),
    // The custody floor in front: the bench you wait on, the evidence trolley, lockers and files on the end wall.
    D('policeCustodyBench', 4.6, 4.9),
    D('policeEvidenceTrolley', 9.2, 4.4),
    D('policeStaffLockers', 0.12 + 0.35, 4.2, { rot: 3 }),
    D('policeFilingCabinet', 13.0, 4.8),
    // The public side: the charge desk is the front counter, the waiting bench and the noticeboard by the door.
    D('policeChargeDesk', 21.6, -0.45),
    D('policeNoticeboard', 23.95, BACK + 0.09, { solid: false, wallY: 0 }),
    D('policeCorridorBench', 21.6, 4.9),
    { kind: 'vending', x: 25.2, z: 4.8 },
  ],
  stations: [
    {
      id: 'front_desk', x: 21.6, z: 0.75, label: 'Front counter (your record, settle fines)',
      npc: { name: 'Sgt Hollis', seed: 7713, body: 'male', top: 'shirt', topColour: '#f1f3f5', dz: -2.1 },
    },
  ],
  pickups: [],
  encounters: [],
  lights: [
    { x: 4, y: 2.8, z: -0.4, colour: 0xe8f0ff, intensity: 8, range: 8 },
    { x: 13, y: 2.8, z: -0.4, colour: 0xe8f0ff, intensity: 8, range: 8 },
    { x: 22.5, y: 2.8, z: 1.2, colour: 0xe8f0ff, intensity: 9, range: 8 },
  ],
  objective: 'Sort it out at the front counter, or go home',
  weather: 'indoors',
};

// Every room at its real depth (world/rooms.ts), its front floor filled.
export const INTERIORS = {
  gym_store: deepRoom(fitOut(gymStore)),
  boxing_gym: deepRoom(boxingGym),
  karate_dojo: deepRoom(karateDojo),
  wrestling_club: deepRoom(wrestlingClub),
  grow_shop: deepRoom(fitOut(growShop)),
  clothes_shop: deepRoom(fitOut(clothesShop)), pawn_shop: deepRoom(fitOut(pawnShop)), pub: deepRoom(fitOut(pub)),
  police_station: deepRoom(policeStation),
  furniture_shop: deepRoom(fitOut(furnitureShop)), car_dealer: deepRoom(fitOut(carDealer)), bike_shop: deepRoom(fitOut(bikeShop)), casino: deepRoom(fitOut(casino)),
};
