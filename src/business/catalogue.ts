/**
 * The basement business: equipment sold at the grow shop, business upgrades,
 * basement renovation tiers and improvements. Production is abstract: grow
 * units give "capacity", lights and air handling must keep up with it, and
 * each cycle turns capacity into stock. No real-world method is modelled.
 */

export type EquipmentCategory = 'room' | 'environment' | 'security';
export const EQUIPMENT_CATEGORIES: { id: EquipmentCategory | 'upgrades' | 'basement'; name: string }[] = [
  { id: 'room', name: 'Room equipment' },
  { id: 'environment', name: 'Environmental' },
  { id: 'security', name: 'Security' },
  { id: 'upgrades', name: 'Business upgrades' },
  { id: 'basement', name: 'Basement works' },
];

export interface EquipmentDef {
  id: string;
  name: string;
  cat: EquipmentCategory;
  price: number;
  /** 1 starter, 2 intermediate, 3 professional. */
  tier: 1 | 2 | 3;
  /** Half width and half depth (unrotated). */
  size: [number, number];
  mount: 'floor' | 'wall';
  wallY?: number;
  /** What it does for the business. */
  cap?: number;
  light?: number;
  air?: number;
  /** Fractional efficiency bonus (0.05 = +5%). */
  eff?: number;
  auto?: number;
  sec?: number;
  storage?: number;
  /** Protects stock from theft. */
  lockable?: boolean;
  /** Power draw, kW. */
  power: number;
  /** Running cost, £ per in-game hour. */
  op: number;
  blurb: string;
}

const E = (d: EquipmentDef) => d;

export const EQUIPMENT_LIST: EquipmentDef[] = [
  // ---- room equipment
  E({ id: 'tent_s', name: 'Starter grow tent', cat: 'room', price: 350, tier: 1, size: [0.5, 0.5], mount: 'floor', cap: 4, power: 0.3, op: 4, blurb: 'Compact reflective tent. Small capacity, cheap to run.' }),
  E({ id: 'tent_d', name: 'Double grow tent', cat: 'room', price: 900, tier: 2, size: [1.0, 0.5], mount: 'floor', cap: 10, power: 0.6, op: 9, blurb: 'Twice the room in one frame, with a split door.' }),
  E({ id: 'module', name: 'Commercial grow module', cat: 'room', price: 3200, tier: 3, size: [1.4, 0.6], mount: 'floor', cap: 22, power: 1.2, op: 22, blurb: 'Insulated walk-in module with racking. Serious capacity.' }),
  E({ id: 'shelving', name: 'Industrial shelving', cat: 'room', price: 180, tier: 1, size: [0.8, 0.25], mount: 'floor', storage: 20, power: 0, op: 0, blurb: 'Boltless steel shelving. Holds 20 more units of stock.' }),
  E({ id: 'cabinet', name: 'Lockable steel cabinet', cat: 'room', price: 260, tier: 1, size: [0.45, 0.25], mount: 'floor', storage: 15, sec: 3, lockable: true, power: 0, op: 0, blurb: 'Lockable storage. Stock inside is harder to steal.' }),
  E({ id: 'workbench2', name: 'Workbench', cat: 'room', price: 220, tier: 1, size: [0.9, 0.35], mount: 'floor', eff: 0.05, power: 0.1, op: 1, blurb: 'Somewhere to prep and pack. +5% efficiency.' }),
  E({ id: 'pallet_rack', name: 'Commercial storage rack', cat: 'room', price: 950, tier: 3, size: [1.4, 0.4], mount: 'floor', storage: 60, power: 0, op: 0, blurb: 'Pallet racking. Holds 60 more units.' }),
  // ---- environmental
  E({ id: 'led_rig', name: 'LED light rig', cat: 'environment', price: 250, tier: 1, size: [0.35, 0.3], mount: 'floor', light: 6, power: 0.5, op: 5, blurb: 'Light for up to 6 capacity.' }),
  E({ id: 'led_array', name: 'Pro LED array', cat: 'environment', price: 900, tier: 2, size: [0.6, 0.3], mount: 'floor', light: 16, power: 1.2, op: 12, blurb: 'Light for up to 16 capacity.' }),
  E({ id: 'light_bars', name: 'Commercial light bar system', cat: 'environment', price: 2600, tier: 3, size: [1.0, 0.3], mount: 'floor', light: 36, power: 2.4, op: 24, blurb: 'Light for up to 36 capacity.' }),
  E({ id: 'fan', name: 'Inline fan & filter', cat: 'environment', price: 200, tier: 1, size: [0.25, 0.25], mount: 'floor', air: 6, power: 0.2, op: 2, blurb: 'Air handling for up to 6 capacity.' }),
  E({ id: 'air_handler', name: 'Air handling unit', cat: 'environment', price: 1100, tier: 2, size: [0.6, 0.4], mount: 'floor', air: 18, power: 0.7, op: 8, blurb: 'Air handling for up to 18 capacity.' }),
  E({ id: 'air_system', name: 'Industrial air system', cat: 'environment', price: 3000, tier: 3, size: [0.9, 0.5], mount: 'floor', air: 40, power: 1.4, op: 16, blurb: 'Air handling for up to 40 capacity.' }),
  E({ id: 'cooler', name: 'Portable cooling unit', cat: 'environment', price: 450, tier: 1, size: [0.3, 0.3], mount: 'floor', eff: 0.08, power: 0.9, op: 8, blurb: 'Keeps the room steady. +8% efficiency.' }),
  E({ id: 'climate', name: 'Climate control unit', cat: 'environment', price: 1800, tier: 3, size: [0.5, 0.3], mount: 'floor', eff: 0.15, power: 1.5, op: 14, blurb: 'Full climate control. +15% efficiency.' }),
  E({ id: 'control', name: 'Electrical control panel', cat: 'environment', price: 600, tier: 2, size: [0.35, 0.08], mount: 'wall', wallY: 1.5, auto: 1, power: 0.05, op: 1, blurb: 'Timers and controllers. +1 automation (faster cycles).' }),
  E({ id: 'sensor', name: 'Environment monitor', cat: 'environment', price: 350, tier: 1, size: [0.18, 0.05], mount: 'wall', wallY: 1.6, eff: 0.05, power: 0.02, op: 0, blurb: 'Readouts on the wall. +5% efficiency.' }),
  // ---- security
  E({ id: 'cctv', name: 'CCTV camera', cat: 'security', price: 280, tier: 1, size: [0.16, 0.14], mount: 'wall', wallY: 2.35, sec: 8, power: 0.02, op: 0, blurb: 'Watches the room. +8 security.' }),
  E({ id: 'monitors', name: 'Security monitor desk', cat: 'security', price: 900, tier: 2, size: [0.6, 0.3], mount: 'floor', sec: 12, power: 0.2, op: 2, blurb: 'Four screens on a desk. +12 security.' }),
  E({ id: 'alarm', name: 'Alarm system', cat: 'security', price: 650, tier: 2, size: [0.16, 0.06], mount: 'wall', wallY: 2.0, sec: 10, power: 0.02, op: 1, blurb: 'Keypad and siren. +10 security.' }),
  E({ id: 'safe', name: 'Floor safe', cat: 'security', price: 1200, tier: 2, size: [0.3, 0.3], mount: 'floor', sec: 6, lockable: true, storage: 10, power: 0, op: 0, blurb: 'Heavy safe. +6 security; theft takes far less.' }),
];

export const EQUIPMENT: Record<string, EquipmentDef> = Object.fromEntries(EQUIPMENT_LIST.map((e) => [e.id, e]));

// ---- business upgrades (bought, not placed) -------------------------------------------------------

export const UPGRADE_KEYS = ['capacity', 'automation', 'efficiency', 'storage', 'security'] as const;
export type UpgradeKey = (typeof UPGRADE_KEYS)[number];
export const BUSINESS_UPGRADES: Record<UpgradeKey, { name: string; per: string; cost: [number, number, number] }> = {
  capacity: { name: 'Production capacity', per: '+10% capacity per level', cost: [900, 2600, 7000] },
  automation: { name: 'Automation', per: '+1 automation per level (faster cycles)', cost: [800, 2400, 6000] },
  efficiency: { name: 'Efficiency', per: '+8% output per level', cost: [700, 2000, 5500] },
  storage: { name: 'Storage', per: '+25 stock storage per level', cost: [400, 1200, 3000] },
  security: { name: 'Security', per: '+10 security per level', cost: [500, 1500, 4000] },
};
export const MAX_UPGRADE = 3;

// ---- basement works -------------------------------------------------------------------------------

/** Renovation tiers. Each needs the one before. */
export const TIERS = [
  { name: 'Basic basement', price: 0, width: 14, blurb: 'Bare concrete, a single bulb and years of junk.' },
  { name: 'Renovated basement', price: 1500, width: 14, blurb: 'Junk cleared, walls repointed, floor sealed, strip lights.' },
  { name: 'Expanded basement', price: 6000, width: 22, blurb: 'Knock through under the garden: 8 more metres of room.' },
  { name: 'Professional setup', price: 18000, width: 30, blurb: 'Another 8 metres, tiled walls, office area and branded fit-out.' },
] as const;

export interface ImprovementDef {
  id: string;
  name: string;
  price: number;
  /** Basement tier needed first. */
  needsTier: number;
  blurb: string;
  sec?: number;
  eff?: number;
  /** New power supply, kW. */
  supply?: number;
}

export const IMPROVEMENTS: ImprovementDef[] = [
  { id: 'epoxy_floor', name: 'Epoxy floor coating', price: 600, needsTier: 1, blurb: 'Grey resin floor with safety lines.' },
  { id: 'white_walls', name: 'Painted walls', price: 400, needsTier: 1, blurb: 'Whitewashed brick: brighter, cleaner.' },
  { id: 'tiled_walls', name: 'Tiled walls', price: 1200, needsTier: 2, blurb: 'White tiles to shoulder height. Professional.' },
  { id: 'led_lighting', name: 'LED ceiling lighting', price: 800, needsTier: 1, blurb: 'Bright ceiling panels. +5% efficiency.', eff: 0.05 },
  { id: 'ducting', name: 'Ceiling ducting', price: 700, needsTier: 1, blurb: 'Galvanised ducts along the ceiling. +5% efficiency.', eff: 0.05 },
  { id: 'security_door', name: 'Reinforced steel door', price: 2000, needsTier: 1, blurb: 'Steel door at the stairs. +15 security.', sec: 15 },
  { id: 'electrics', name: 'Electrical upgrade', price: 1500, needsTier: 1, blurb: 'New consumer unit and cabling: 12 kW supply.', supply: 12 },
  { id: 'three_phase', name: 'Three-phase supply', price: 5000, needsTier: 2, blurb: 'Industrial supply: 30 kW.', supply: 30 },
  { id: 'lounge', name: 'Office lounge', price: 900, needsTier: 1, blurb: 'Sofa, rug, neon and a coffee machine by the terminal.' },
];
export const IMPROVEMENT: Record<string, ImprovementDef> = Object.fromEntries(IMPROVEMENTS.map((i) => [i.id, i]));

/** Power available before any electrical work, kW. */
export const BASE_SUPPLY = 4;
/** One-off cost to start the business (supplies and setup). */
export const STARTUP_FEE = 200;
/** What one unit of stock sells for, £ (before level bonus). */
export const UNIT_VALUE = 10;
/** Seconds of play per production cycle with no automation. */
export const BASE_CYCLE = 480;
/** Stock storage before shelving. */
export const BASE_STORAGE = 30;
/** Bills over this and the power company cuts you off until you pay. */
export const OWED_LIMIT = 300;
/** Business level thresholds (units sold). */
export const LEVEL_UNITS = [0, 200, 800, 2500, 8000];
/** Resale value of equipment. */
export const equipmentResale = (price: number) => Math.floor(price / 2);
