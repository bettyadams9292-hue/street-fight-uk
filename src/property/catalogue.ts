/**
 * Everything you can buy for the house and the drive: furniture, floor and
 * wall finishes, cars and off-road bikes. Names are made up; prices are in
 * the game's own pounds.
 */

export const ROOM_IDS = ['bathroom', 'bedroom', 'living', 'kitchen'] as const;
export type RoomId = (typeof ROOM_IDS)[number];

/** The customisable rooms of 14 Tanner Road, along the x axis. */
export const ROOMS: Record<RoomId, { name: string; x0: number; x1: number; window: number }> = {
  bathroom: { name: 'Bathroom', x0: -26, x1: -20, window: -24.6 },
  bedroom: { name: 'Bedroom', x0: -20, x1: -13, window: -18.4 },
  living: { name: 'Living room', x0: -13, x1: -4, window: -10.2 },
  kitchen: { name: 'Kitchen', x0: -4, x1: 2, window: -0.8 },
};

export function roomAt(x: number): RoomId | null {
  for (const id of ROOM_IDS) if (x > ROOMS[id].x0 && x < ROOMS[id].x1) return id;
  return null;
}

export type FurnitureCategory = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'decor' | 'lighting';
export const FURNITURE_CATEGORIES: { id: FurnitureCategory; name: string }[] = [
  { id: 'living', name: 'Living room' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'kitchen', name: 'Kitchen & dining' },
  { id: 'bathroom', name: 'Bathroom' },
  { id: 'decor', name: 'Decorations' },
  { id: 'lighting', name: 'Lighting' },
];

/** How a piece sits in the room. */
export type Mount = 'floor' | 'rug' | 'wall';

export interface FurnitureDef {
  id: string;
  name: string;
  cat: FurnitureCategory;
  price: number;
  /** Half width (x) and half depth (z) facing the camera, unrotated. */
  size: [number, number];
  mount: Mount;
  /** Wall pieces: height of their centre. */
  wallY?: number;
  /** Paint and fabric options; the first is the default. */
  colours: string[];
  /** Where it can go (default: any room but the bathroom; bathroom pieces: bathroom only). */
  rooms?: RoomId[];
  /** Somewhere to sit and save (sofas, armchairs). */
  seat?: boolean;
  /** Taller than a window sill: can't stand in front of a window. */
  tall?: boolean;
  blurb: string;
}

const FABRIC = ['#4a5a3a', '#3a4a6a', '#7a2a2a', '#5a5a5e', '#c8b89a', '#2a2a2e'];
const WOOD = ['#8a5a32', '#c8a070', '#4a2e1a', '#e8e4dc', '#2a2a2e'];
const METAL = ['#2a2a2e', '#c9a227', '#c8c8c8', '#e8e4dc'];
const PAINT = ['#e8e4dc', '#2a2a2e', '#3a5a4a', '#1f2a44', '#c8a070'];
const BATH = ['bathroom'] as RoomId[];
const WET = ['bathroom', 'bedroom', 'living', 'kitchen'] as RoomId[];

const F = (d: FurnitureDef): FurnitureDef => d;

export const FURNITURE_LIST: FurnitureDef[] = [
  // ---- living room
  F({ id: 'sofa_3', name: 'Kensal 3-seat sofa', cat: 'living', price: 420, size: [1.1, 0.45], mount: 'floor', colours: FABRIC, seat: true, blurb: 'Deep cushions, proper arms. Seats three, or one after a long day.' }),
  F({ id: 'sofa_2', name: 'Brixton 2-seat sofa', cat: 'living', price: 290, size: [0.8, 0.42], mount: 'floor', colours: FABRIC, seat: true, blurb: 'Compact two-seater for smaller rooms.' }),
  F({ id: 'armchair', name: 'Wingback armchair', cat: 'living', price: 180, size: [0.45, 0.42], mount: 'floor', colours: FABRIC, seat: true, blurb: 'High back, button detail. Your nan would approve.' }),
  F({ id: 'coffee_table', name: 'Oak coffee table', cat: 'living', price: 95, size: [0.6, 0.3], mount: 'floor', colours: WOOD, blurb: 'Low, solid, with a shelf for the remotes.' }),
  F({ id: 'tv_unit', name: 'Media unit', cat: 'living', price: 140, size: [0.8, 0.22], mount: 'floor', colours: WOOD, blurb: 'Long low unit with cable tidy and two cupboards.' }),
  F({ id: 'tv_43', name: '43" TV on stand', cat: 'living', price: 260, size: [0.55, 0.2], mount: 'floor', colours: ['#1a1a1a', '#c8c8c8'], blurb: 'A decent telly on its own little stand.' }),
  F({ id: 'tv_65', name: '65" wall TV', cat: 'living', price: 640, size: [0.75, 0.05], mount: 'wall', wallY: 1.45, colours: ['#1a1a1a'], blurb: 'Wall-mounted, edge to edge. The football will never look better.' }),
  F({ id: 'bookcase', name: 'Tall bookcase', cat: 'living', price: 120, size: [0.45, 0.18], mount: 'floor', tall: true, colours: WOOD, blurb: 'Five shelves of books you’ll get round to reading.' }),
  F({ id: 'shelf_low', name: 'Low shelving', cat: 'living', price: 75, size: [0.6, 0.2], mount: 'floor', colours: WOOD, blurb: 'Cube shelving with baskets.' }),
  F({ id: 'rug_round', name: 'Round rug', cat: 'living', price: 60, size: [0.8, 0.6], mount: 'rug', colours: ['#7a2a2a', '#3a4a6a', '#c8b89a', '#3a5a4a'], blurb: 'Soft, round, ties the room together.' }),
  F({ id: 'rug_long', name: 'Persian-style rug', cat: 'living', price: 110, size: [1.2, 0.7], mount: 'rug', colours: ['#7a2a2a', '#1f2a44', '#8a6a3a'], blurb: 'Patterned runner. Hides a multitude of sins.' }),
  // ---- bedroom
  F({ id: 'bed_double', name: 'Double bed', cat: 'bedroom', price: 380, size: [0.8, 1.0], mount: 'floor', colours: FABRIC, blurb: 'Upholstered headboard, memory foam mattress.' }),
  F({ id: 'bed_single', name: 'Single bed', cat: 'bedroom', price: 190, size: [0.5, 1.0], mount: 'floor', colours: FABRIC, blurb: 'Sturdy single with a pine frame.' }),
  F({ id: 'wardrobe2', name: 'Double wardrobe', cat: 'bedroom', price: 230, size: [0.6, 0.32], mount: 'floor', tall: true, colours: WOOD, blurb: 'Hanging rail, hat shelf, mirror on the inside.' }),
  F({ id: 'bedside', name: 'Bedside table', cat: 'bedroom', price: 45, size: [0.25, 0.22], mount: 'floor', colours: WOOD, blurb: 'One drawer, perfect for a phone charger.' }),
  F({ id: 'drawers', name: 'Chest of drawers', cat: 'bedroom', price: 140, size: [0.5, 0.25], mount: 'floor', colours: WOOD, blurb: 'Four deep drawers.' }),
  F({ id: 'mirror_stand', name: 'Standing mirror', cat: 'bedroom', price: 70, size: [0.3, 0.15], mount: 'floor', tall: true, colours: METAL, blurb: 'Full length, on a tilting frame.' }),
  F({ id: 'desk2', name: 'Writing desk', cat: 'bedroom', price: 130, size: [0.6, 0.3], mount: 'floor', colours: WOOD, blurb: 'Room for a laptop and a stack of letters.' }),
  // ---- kitchen
  F({ id: 'dining_table', name: 'Dining table', cat: 'kitchen', price: 160, size: [0.7, 0.42], mount: 'floor', colours: WOOD, blurb: 'Seats four. Scratches add character.' }),
  F({ id: 'dining_chair', name: 'Dining chair', cat: 'kitchen', price: 35, size: [0.22, 0.22], mount: 'floor', colours: WOOD, blurb: 'Bentwood café chair.' }),
  F({ id: 'fridge2', name: 'American fridge freezer', cat: 'kitchen', price: 520, size: [0.45, 0.35], mount: 'floor', tall: true, colours: ['#c8c8c8', '#1a1a1a', '#e8e4dc'], blurb: 'Side by side with an ice dispenser.' }),
  F({ id: 'cupboard', name: 'Base cupboard', cat: 'kitchen', price: 90, size: [0.4, 0.3], mount: 'floor', colours: PAINT, blurb: 'Kitchen base unit with a worktop.' }),
  F({ id: 'worktop', name: 'Worktop run', cat: 'kitchen', price: 170, size: [0.8, 0.3], mount: 'floor', colours: PAINT, blurb: 'Two units with a long laminate worktop.' }),
  F({ id: 'washer', name: 'Washing machine', cat: 'kitchen', price: 240, size: [0.3, 0.3], mount: 'floor', colours: ['#e8e4dc', '#2a2a2e'], blurb: '9kg drum, 1400 spin.' }),
  F({ id: 'island', name: 'Kitchen island', cat: 'kitchen', price: 300, size: [0.7, 0.35], mount: 'floor', colours: PAINT, blurb: 'Breakfast bar with stools tucked under.' }),
  F({ id: 'wall_cupboards', name: 'Wall cupboards', cat: 'kitchen', price: 110, size: [0.7, 0.18], mount: 'wall', wallY: 1.9, colours: PAINT, rooms: ['kitchen'], blurb: 'A pair of wall units for plates and tins.' }),
  // ---- bathroom
  F({ id: 'bath_cabinet', name: 'Mirror cabinet', cat: 'bathroom', price: 85, size: [0.32, 0.1], mount: 'wall', wallY: 1.6, colours: ['#e8e4dc', '#2a2a2e'], rooms: BATH, blurb: 'Mirrored door, shelves for the bits.' }),
  F({ id: 'bath_mirror', name: 'Round bathroom mirror', cat: 'bathroom', price: 55, size: [0.3, 0.05], mount: 'wall', wallY: 1.6, colours: METAL, rooms: BATH, blurb: 'Brass-rimmed round mirror.' }),
  F({ id: 'bath_tower', name: 'Storage tower', cat: 'bathroom', price: 95, size: [0.22, 0.18], mount: 'floor', tall: true, colours: ['#e8e4dc', '#8a5a32', '#2a2a2e'], rooms: BATH, blurb: 'Tall, slim, full of towels.' }),
  F({ id: 'towel_rail', name: 'Heated towel rail', cat: 'bathroom', price: 120, size: [0.28, 0.06], mount: 'wall', wallY: 1.05, colours: ['#c8c8c8', '#2a2a2e', '#c9a227'], rooms: BATH, blurb: 'Warm towels every morning.' }),
  F({ id: 'laundry', name: 'Laundry basket', cat: 'bathroom', price: 25, size: [0.2, 0.2], mount: 'floor', colours: ['#c8a070', '#e8e4dc'], rooms: WET, blurb: 'Woven basket with a lid.' }),
  F({ id: 'bath_mat', name: 'Bath mat', cat: 'bathroom', price: 20, size: [0.4, 0.25], mount: 'rug', colours: ['#e8e4dc', '#3a5a4a', '#1f2a44'], rooms: BATH, blurb: 'Fluffy, absorbent.' }),
  // ---- decorations
  F({ id: 'painting', name: 'Landscape painting', cat: 'decor', price: 90, size: [0.5, 0.04], mount: 'wall', wallY: 1.75, colours: ['#c9a227', '#2a2a2e', '#e8e4dc'], blurb: 'Hills and sky in a gilt frame.' }),
  F({ id: 'canvas_art', name: 'Abstract canvas', cat: 'decor', price: 70, size: [0.45, 0.03], mount: 'wall', wallY: 1.75, colours: ['#d84a2a', '#2a6aa8', '#e8c040'], blurb: 'Big bold colours on canvas.' }),
  F({ id: 'poster_frame', name: 'Framed gig poster', cat: 'decor', price: 40, size: [0.32, 0.03], mount: 'wall', wallY: 1.7, colours: ['#2a2a2e', '#e8e4dc'], blurb: 'A night you can’t quite remember.' }),
  F({ id: 'wall_clock', name: 'Station clock', cat: 'decor', price: 45, size: [0.22, 0.04], mount: 'wall', wallY: 2.1, colours: ['#2a2a2e', '#c8c8c8', '#7a2a2a'], blurb: 'Railway-style wall clock.' }),
  F({ id: 'wall_shelf', name: 'Floating shelf', cat: 'decor', price: 35, size: [0.45, 0.1], mount: 'wall', wallY: 1.55, colours: WOOD, blurb: 'With a few ornaments and a candle.' }),
  F({ id: 'plant_tall', name: 'Tall plant', cat: 'decor', price: 50, size: [0.25, 0.25], mount: 'floor', tall: true, colours: ['#c8b89a', '#2a2a2e', '#e8e4dc'], rooms: WET, blurb: 'Fiddle-leaf fig in a ceramic pot.' }),
  F({ id: 'plant_small', name: 'Pot plant', cat: 'decor', price: 20, size: [0.15, 0.15], mount: 'floor', colours: ['#a85a3a', '#e8e4dc', '#2a2a2e'], rooms: WET, blurb: 'A little snake plant. Hard to kill.' }),
  F({ id: 'vase', name: 'Floor vase', cat: 'decor', price: 40, size: [0.16, 0.16], mount: 'floor', colours: ['#1f2a44', '#e8e4dc', '#a85a3a'], rooms: WET, blurb: 'Tall glazed vase with dried grasses.' }),
  F({ id: 'trophy_cab', name: 'Trophy cabinet', cat: 'decor', price: 210, size: [0.45, 0.2], mount: 'floor', tall: true, colours: WOOD, blurb: 'Glass-fronted, lit, for belts and medals.' }),
  // ---- lighting
  F({ id: 'floor_lamp', name: 'Floor lamp', cat: 'lighting', price: 65, size: [0.18, 0.18], mount: 'floor', tall: true, colours: METAL, rooms: WET, blurb: 'Linen shade, warm bulb.' }),
  F({ id: 'arc_lamp', name: 'Arc lamp', cat: 'lighting', price: 120, size: [0.25, 0.25], mount: 'floor', tall: true, colours: METAL, blurb: 'Big curved arm over the sofa.' }),
  F({ id: 'wall_light', name: 'Wall light', cat: 'lighting', price: 40, size: [0.12, 0.08], mount: 'wall', wallY: 1.95, colours: METAL, rooms: WET, blurb: 'Brass sconce with a glass shade.' }),
  F({ id: 'neon_sign', name: 'Neon sign', cat: 'lighting', price: 150, size: [0.5, 0.04], mount: 'wall', wallY: 1.9, colours: ['#ff3a8a', '#3ae8ff', '#ffd23d'], blurb: 'Glowing “KNOCKOUT” in neon tube.' }),
];

export const FURNITURE: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE_LIST.map((f) => [f.id, f]));

export function allowedRooms(d: FurnitureDef): RoomId[] {
  return d.rooms ?? (d.cat === 'bathroom' ? ['bathroom'] : ['bedroom', 'living', 'kitchen']);
}

/** Sale price back to you: half what it cost. */
export const resale = (price: number) => Math.floor(price / 2);

// ---- floors and walls -------------------------------------------------------------------------

export interface FinishDef {
  id: string;
  name: string;
  kind: 'floor' | 'wall';
  price: number;
  /** Base colour; pattern says how it's drawn. */
  colour: string;
  colour2?: string;
  pattern: 'paint' | 'boards' | 'carpet' | 'tiles' | 'stripes' | 'brick' | 'panelling';
}

export const FINISH_LIST: FinishDef[] = [
  { id: 'f_oak', name: 'Oak boards', kind: 'floor', price: 220, colour: '#9a7a5a', pattern: 'boards' },
  { id: 'f_walnut', name: 'Walnut boards', kind: 'floor', price: 280, colour: '#5a3a22', pattern: 'boards' },
  { id: 'f_grey_carpet', name: 'Grey carpet', kind: 'floor', price: 160, colour: '#6a6a70', pattern: 'carpet' },
  { id: 'f_cream_carpet', name: 'Cream carpet', kind: 'floor', price: 160, colour: '#c8bca4', pattern: 'carpet' },
  { id: 'f_plum_carpet', name: 'Plum carpet', kind: 'floor', price: 140, colour: '#6d5a7a', pattern: 'carpet' },
  { id: 'f_red_carpet', name: 'Red carpet', kind: 'floor', price: 140, colour: '#7a3a2c', pattern: 'carpet' },
  { id: 'f_check_tiles', name: 'Black & white tiles', kind: 'floor', price: 240, colour: '#e8e4dc', colour2: '#1a1a1a', pattern: 'tiles' },
  { id: 'f_stone_tiles', name: 'Stone tiles', kind: 'floor', price: 200, colour: '#d8d2c0', colour2: '#6f6a60', pattern: 'tiles' },
  { id: 'f_slate_tiles', name: 'Slate tiles', kind: 'floor', price: 260, colour: '#3a3e44', colour2: '#22252a', pattern: 'tiles' },
  { id: 'w_magnolia', name: 'Magnolia paint', kind: 'wall', price: 60, colour: '#e8dcc0', pattern: 'paint' },
  { id: 'w_white', name: 'Brilliant white', kind: 'wall', price: 60, colour: '#f0eee8', pattern: 'paint' },
  { id: 'w_sage', name: 'Sage green paint', kind: 'wall', price: 70, colour: '#8a9a7a', pattern: 'paint' },
  { id: 'w_navy', name: 'Navy paint', kind: 'wall', price: 70, colour: '#22304a', pattern: 'paint' },
  { id: 'w_charcoal', name: 'Charcoal paint', kind: 'wall', price: 70, colour: '#3a3c40', pattern: 'paint' },
  { id: 'w_blush', name: 'Blush pink paint', kind: 'wall', price: 70, colour: '#d8a8a0', pattern: 'paint' },
  { id: 'w_slate_blue', name: 'Slate blue paint', kind: 'wall', price: 60, colour: '#6d7a8c', pattern: 'paint' },
  { id: 'w_stone', name: 'Stone paint', kind: 'wall', price: 60, colour: '#8c7a5e', pattern: 'paint' },
  { id: 'w_stripes', name: 'Regency stripe wallpaper', kind: 'wall', price: 140, colour: '#d8ccb0', colour2: '#a89870', pattern: 'stripes' },
  { id: 'w_brick', name: 'Exposed brick slips', kind: 'wall', price: 220, colour: '#8a4a32', pattern: 'brick' },
  { id: 'w_panelling', name: 'Wood panelling', kind: 'wall', price: 260, colour: '#6a4a2a', colour2: '#e8e4dc', pattern: 'panelling' },
  { id: 'w_tiles', name: 'White metro tiles', kind: 'wall', price: 180, colour: '#e8e2cc', colour2: '#9a9480', pattern: 'tiles' },
];
export const FINISHES: Record<string, FinishDef> = Object.fromEntries(FINISH_LIST.map((f) => [f.id, f]));

/** What each room had before you started decorating. */
export const DEFAULT_FINISHES: Record<RoomId, { floor: string; wall: string }> = {
  bathroom: { floor: 'f_stone_tiles', wall: 'w_tiles' },
  bedroom: { floor: 'f_plum_carpet', wall: 'w_slate_blue' },
  living: { floor: 'f_red_carpet', wall: 'w_stone' },
  kitchen: { floor: 'f_stone_tiles', wall: 'w_tiles' },
};

// ---- vehicles ------------------------------------------------------------------------------------

export type CarClass = 'hatchback' | 'saloon' | 'sports' | 'suv' | '4x4' | 'performance';
export const CAR_CLASSES: { id: CarClass; name: string }[] = [
  { id: 'hatchback', name: 'Hatchbacks' },
  { id: 'saloon', name: 'Saloons' },
  { id: 'sports', name: 'Sports cars' },
  { id: 'suv', name: 'SUVs' },
  { id: '4x4', name: '4x4s' },
  { id: 'performance', name: 'Performance' },
];

export interface CarDef {
  id: string;
  name: string;
  cls: CarClass;
  price: number;
  /** mph */
  topSpeed: number;
  /** 0-60 mph, seconds */
  zeroSixty: number;
  /** 1..10 */
  handling: number;
  seats: number;
  colours: string[];
  /** Collision half extents (x, z). */
  size: [number, number];
  blurb: string;
}

export const CAR_LIST: CarDef[] = [
  { id: 'corvo', name: 'Vauxford Corvo 1.2', cls: 'hatchback', price: 3200, topSpeed: 105, zeroSixty: 12.8, handling: 6, seats: 5, colours: ['#c8c8c8', '#7a1414', '#1f2a44', '#e8e4dc'], size: [1.9, 0.85], blurb: 'First car of half the country. Cheap insurance, cheap parts.' },
  { id: 'pixie', name: 'Mintie Pixie Cooper', cls: 'hatchback', price: 7800, topSpeed: 124, zeroSixty: 8.9, handling: 8, seats: 4, colours: ['#2a5a3a', '#e8e4dc', '#c82a2a', '#1a1a1a'], size: [1.8, 0.85], blurb: 'Go-kart handling and a white roof.' },
  { id: 'monarch', name: 'Fordley Monarch', cls: 'saloon', price: 9500, topSpeed: 128, zeroSixty: 9.6, handling: 6, seats: 5, colours: ['#1f2a44', '#6b6b70', '#1a1a1a'], size: [2.3, 0.9], blurb: 'Minicab favourite. Big boot, comfy seats.' },
  { id: 'regent', name: 'Bavaria Regent 520', cls: 'saloon', price: 21000, topSpeed: 150, zeroSixty: 7.2, handling: 7, seats: 5, colours: ['#1a1a1a', '#e8e4dc', '#2a3a5a'], size: [2.35, 0.92], blurb: 'Leather, quiet, and everyone moves over.' },
  { id: 'vixen', name: 'Lotte Vixen S', cls: 'sports', price: 28000, topSpeed: 158, zeroSixty: 5.1, handling: 9, seats: 2, colours: ['#e8c020', '#c82a2a', '#1a1a1a', '#e8e4dc'], size: [2.1, 0.88], blurb: 'Light, low, lairy. Two seats, no boot.' },
  { id: 'kestrel', name: 'Kestrel GT Roadster', cls: 'sports', price: 46000, topSpeed: 171, zeroSixty: 4.4, handling: 8, seats: 2, colours: ['#2a6a3a', '#1a1a1a', '#c8c8c8'], size: [2.2, 0.9], blurb: 'British racing green, soft top, burble at idle.' },
  { id: 'tundra', name: 'Kiyo Tundra', cls: 'suv', price: 14500, topSpeed: 118, zeroSixty: 10.4, handling: 6, seats: 7, colours: ['#6b6b70', '#e8e4dc', '#3a2a1a'], size: [2.3, 0.95], blurb: 'Seven seats, school-run tank.' },
  { id: 'sovereign', name: 'Range Sovereign', cls: 'suv', price: 62000, topSpeed: 140, zeroSixty: 6.3, handling: 7, seats: 5, colours: ['#1a1a1a', '#e8e4dc', '#2a3a2a'], size: [2.35, 0.98], blurb: 'Tinted windows and a waiting list.' },
  { id: 'warden', name: 'Landmark Warden 110', cls: '4x4', price: 24000, topSpeed: 98, zeroSixty: 13.5, handling: 5, seats: 5, colours: ['#3a4a2a', '#e8e4dc', '#1f2a44'], size: [2.2, 1.0], blurb: 'Snorkel, roof rack, goes anywhere slowly.' },
  { id: 'brute', name: 'Ironhill Brute Pickup', cls: '4x4', price: 31000, topSpeed: 110, zeroSixty: 9.8, handling: 5, seats: 5, colours: ['#c82a2a', '#1a1a1a', '#c8c8c8'], size: [2.4, 1.0], blurb: 'Double cab, load bed, tow bar.' },
  { id: 'hornet', name: 'Hornet RS Evo', cls: 'performance', price: 38000, topSpeed: 162, zeroSixty: 4.6, handling: 9, seats: 4, colours: ['#1f4fa8', '#e8e4dc', '#1a1a1a'], size: [2.0, 0.9], blurb: 'Rally-bred, all-wheel drive, giant wing.' },
  { id: 'phantom', name: 'Velocita Phantom V12', cls: 'performance', price: 185000, topSpeed: 211, zeroSixty: 2.9, handling: 10, seats: 2, colours: ['#c82a2a', '#1a1a1a', '#e8c020', '#e8e4dc'], size: [2.3, 0.95], blurb: 'Supercar. The neighbours will talk.' },
];
export const CARS: Record<string, CarDef> = Object.fromEntries(CAR_LIST.map((c) => [c.id, c]));

export type BikeClass = 'beginner' | 'motocross' | 'mx_pro' | 'enduro' | 'racing';
export const BIKE_CLASSES: { id: BikeClass; name: string }[] = [
  { id: 'beginner', name: 'Beginner' },
  { id: 'motocross', name: 'Motocross' },
  { id: 'mx_pro', name: 'High-performance MX' },
  { id: 'enduro', name: 'Enduro' },
  { id: 'racing', name: 'Pro racing' },
];

export interface BikeDef {
  id: string;
  name: string;
  cls: BikeClass;
  price: number;
  /** mph */
  topSpeed: number;
  /** 1..10 */
  accel: number;
  handling: number;
  braking: number;
  suspension: number;
  /** Engine size, cc. */
  cc: number;
  colours: string[];
  /** Wheel radius (m); smaller for the kids' bikes. */
  wheel: number;
  blurb: string;
}

export const BIKE_LIST: BikeDef[] = [
  { id: 'pup85', name: 'Kawa Pup 85', cls: 'beginner', price: 1400, topSpeed: 48, accel: 4, handling: 7, braking: 5, suspension: 4, cc: 85, colours: ['#3a9a3a', '#e8e4dc'], wheel: 0.28, blurb: 'Small, forgiving, first bike.' },
  { id: 'trail125', name: 'Hondo Trail 125', cls: 'beginner', price: 2100, topSpeed: 58, accel: 5, handling: 6, braking: 5, suspension: 5, cc: 125, colours: ['#c82a2a', '#1a1a1a'], wheel: 0.32, blurb: 'Learner-legal and indestructible.' },
  { id: 'mx250', name: 'Yamo YZ 250F', cls: 'motocross', price: 4800, topSpeed: 68, accel: 7, handling: 7, braking: 6, suspension: 7, cc: 250, colours: ['#1f4fa8', '#e8e4dc'], wheel: 0.36, blurb: 'The track-day standard.' },
  { id: 'mx350', name: 'Kato SX 350', cls: 'motocross', price: 5900, topSpeed: 72, accel: 8, handling: 7, braking: 7, suspension: 7, cc: 350, colours: ['#e86a10', '#1a1a1a'], wheel: 0.36, blurb: 'Orange, angry, light.' },
  { id: 'mx450r', name: 'Kawa KX 450R', cls: 'mx_pro', price: 8400, topSpeed: 80, accel: 9, handling: 8, braking: 8, suspension: 9, cc: 450, colours: ['#3a9a3a', '#1a1a1a'], wheel: 0.37, blurb: 'Factory-spec forks and a launch mode.' },
  { id: 'mx450f', name: 'Hondo CRF 450 Works', cls: 'mx_pro', price: 9800, topSpeed: 82, accel: 9, handling: 9, braking: 8, suspension: 9, cc: 450, colours: ['#c82a2a', '#e8e4dc'], wheel: 0.37, blurb: 'Titanium exhaust, works graphics.' },
  { id: 'enduro300', name: 'Husk TE 300', cls: 'enduro', price: 7600, topSpeed: 76, accel: 7, handling: 8, braking: 7, suspension: 8, cc: 300, colours: ['#e8e4dc', '#1f2a44'], wheel: 0.37, blurb: 'Lights, kickstand, and tons of torque.' },
  { id: 'enduro500', name: 'Beta RR 500', cls: 'enduro', price: 9200, topSpeed: 88, accel: 8, handling: 7, braking: 8, suspension: 8, cc: 500, colours: ['#c82a2a', '#1a1a1a'], wheel: 0.37, blurb: 'Big four-stroke for long days in the hills.' },
  { id: 'factory450', name: 'Kato Factory Edition 450', cls: 'racing', price: 12800, topSpeed: 90, accel: 10, handling: 9, braking: 9, suspension: 10, cc: 450, colours: ['#e86a10', '#1f2a44'], wheel: 0.38, blurb: 'What the pros race. Carbon everything.' },
  { id: 'gp500', name: 'Suzu RM-Z GP Replica', cls: 'racing', price: 14500, topSpeed: 93, accel: 10, handling: 10, braking: 9, suspension: 10, cc: 450, colours: ['#e8c020', '#1a1a1a'], wheel: 0.38, blurb: 'Championship replica, numbered.' },
];
export const BIKES: Record<string, BikeDef> = Object.fromEntries(BIKE_LIST.map((b) => [b.id, b]));

/** Half extents of a parked bike (long in x). */
export const BIKE_SIZE: [number, number] = [0.95, 0.3];
/** How many bikes the garage holds. */
export const GARAGE_SPACES = 3;
/** Most cars you can own (the rest of the street needs parking too). */
export const MAX_CARS = 8;

/** Riding speed: quicker bikes move you faster. */
export function bikeSpeedMult(b: BikeDef): number {
  return 1.45 + (b.topSpeed - 45) / 60 + b.accel * 0.02;
}
