/**
 * The basement grow: kit sold at the grow shop, business upgrades, basement
 * renovation tiers and improvements. It works like a real indoor grow, in
 * game terms: tents hold plants (2×2 ft fits 2, 4×4 ft fits 6), every plant
 * needs light in watts (about 100 W a plant, less for autoflowers, more for
 * a haze), every tent needs its air changed by an extraction fan through a
 * carbon filter (sized in CFM), a clip fan keeps air moving inside each tent,
 * and lamps make heat that the extraction and any air con must take away.
 * The strain sets how long a crop takes (veg, then flower, then drying) and
 * how much each plant gives. Each harvest is counted in units of stock.
 */

export type EquipmentCategory = 'tents' | 'lights' | 'air' | 'room' | 'security';
export const EQUIPMENT_CATEGORIES: { id: EquipmentCategory | 'upgrades' | 'basement'; name: string }[] = [
  { id: 'tents', name: 'Tents' },
  { id: 'lights', name: 'Lights' },
  { id: 'air', name: 'Air & climate' },
  { id: 'room', name: 'Room & storage' },
  { id: 'security', name: 'Security' },
  { id: 'upgrades', name: 'Business upgrades' },
  { id: 'basement', name: 'Basement works' },
];

/** Lamp types: how much crop a watt grows, and how much of each watt comes off as heat. */
export type LightKind = 'led' | 'cmh' | 'hps';
export const LIGHT_KINDS: Record<LightKind, { name: string; yield: number; heat: number; blurb: string }> = {
  led: { name: 'LED', yield: 1, heat: 0.55, blurb: 'Most crop per watt and runs cool.' },
  cmh: { name: 'CMH', yield: 0.95, heat: 0.8, blurb: 'Ceramic metal halide: full spectrum, a sativa favourite.' },
  hps: { name: 'HPS', yield: 0.9, heat: 1, blurb: 'High pressure sodium: cheap, hot, dense indica buds.' },
};

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
  /** A tent: how many plants it holds, and the air it needs changed (CFM). */
  plants?: number;
  needCfm?: number;
  /** A lamp: its draw in watts and its kind. */
  watts?: number;
  lamp?: LightKind;
  /** An extraction fan with its carbon filter: air moved, CFM. */
  cfm?: number;
  /** Clip fans keeping air moving inside a tent (one a tent). */
  circ?: number;
  /** Heat taken out by air con, kW. */
  cool?: number;
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
  // ---- tents: the footprint sets the plants, the volume sets the air it needs
  E({ id: 'tent_s', name: '2×2 grow tent', cat: 'tents', price: 120, tier: 1, size: [0.32, 0.32], mount: 'floor', plants: 2, needCfm: 60, power: 0, op: 0, blurb: '60 × 60 cm, mylar lined. Room for 2 plants under about 200 W.' }),
  E({ id: 'tent_m', name: '3×3 grow tent', cat: 'tents', price: 180, tier: 1, size: [0.46, 0.46], mount: 'floor', plants: 4, needCfm: 120, power: 0, op: 0, blurb: '90 × 90 cm. 4 plants under 300–400 W; a 4-inch fan keeps up.' }),
  E({ id: 'tent_l', name: '4×4 grow tent', cat: 'tents', price: 260, tier: 2, size: [0.61, 0.61], mount: 'floor', plants: 6, needCfm: 200, power: 0, op: 0, blurb: '120 × 120 cm, the favourite size. 6 plants under 600 W; wants a 6-inch fan.' }),
  E({ id: 'tent_xl', name: '5×5 grow tent', cat: 'tents', price: 380, tier: 2, size: [0.76, 0.76], mount: 'floor', plants: 9, needCfm: 320, power: 0, op: 0, blurb: '150 × 150 cm. 9 plants under 900 W or so.' }),
  E({ id: 'tent_d', name: '2 × 1 m twin tent', cat: 'tents', price: 480, tier: 2, size: [1.0, 0.5], mount: 'floor', plants: 10, needCfm: 340, power: 0, op: 0, blurb: 'Two 1 × 1 m chambers behind a split door: 10 plants under about 1,000 W.' }),
  E({ id: 'module', name: 'Walk-in grow room', cat: 'tents', price: 2400, tier: 3, size: [1.4, 0.6], mount: 'floor', plants: 24, needCfm: 900, power: 0.1, op: 2, blurb: 'Insulated walk-in room with racking, reservoir and pump. 24 plants.' }),
  // ---- lights: about 100 W a plant
  E({ id: 'led_rig', name: '200 W LED panel', cat: 'lights', price: 180, tier: 1, size: [0.35, 0.3], mount: 'floor', watts: 200, lamp: 'led', power: 0.2, op: 2, blurb: 'Covers a 2×2: 2 plants. Cool running.' }),
  E({ id: 'cmh', name: '315 W CMH lamp', cat: 'lights', price: 260, tier: 1, size: [0.35, 0.3], mount: 'floor', watts: 315, lamp: 'cmh', power: 0.33, op: 3, blurb: 'Ceramic metal halide, sunlike spectrum. 3 plants; hazes love it.' }),
  E({ id: 'led_array', name: '480 W LED quantum board', cat: 'lights', price: 520, tier: 2, size: [0.6, 0.3], mount: 'floor', watts: 480, lamp: 'led', power: 0.48, op: 4, blurb: 'Covers a 3×3 or most of a 4×4: 4–5 plants.' }),
  E({ id: 'hps', name: '600 W HPS lamp & ballast', cat: 'lights', price: 220, tier: 1, size: [0.4, 0.3], mount: 'floor', watts: 600, lamp: 'hps', power: 0.63, op: 5, blurb: 'Cheap watts and lots of heat. 6 plants; indicas bulk up under it.' }),
  E({ id: 'light_bars', name: '720 W LED bar light', cat: 'lights', price: 950, tier: 3, size: [0.62, 0.3], mount: 'floor', watts: 720, lamp: 'led', power: 0.72, op: 6, blurb: 'Eight bars, commercial grade. Lights a 4×4 or 5×5: 7 plants.' }),
  // ---- air: extraction through a carbon filter (no smell out), circulation, cooling
  E({ id: 'fan', name: '4-inch extractor & carbon filter', cat: 'air', price: 140, tier: 1, size: [0.25, 0.25], mount: 'floor', cfm: 190, power: 0.05, op: 1, blurb: 'Moves 190 CFM: a 2×2 or 3×3. The filter keeps the smell in.' }),
  E({ id: 'air_handler', name: '6-inch extractor & carbon filter', cat: 'air', price: 280, tier: 2, size: [0.6, 0.4], mount: 'floor', cfm: 400, power: 0.1, op: 1, blurb: 'Moves 400 CFM: a 4×4 with HPS, or a twin tent.' }),
  E({ id: 'air_system', name: '8-inch extraction system', cat: 'air', price: 650, tier: 3, size: [0.9, 0.5], mount: 'floor', cfm: 750, power: 0.2, op: 2, blurb: 'Moves 750 CFM through two big filters: a grow room.' }),
  E({ id: 'clip_fan', name: 'Oscillating clip fan', cat: 'air', price: 25, tier: 1, size: [0.15, 0.15], mount: 'floor', circ: 1, power: 0.02, op: 0, blurb: 'One in each tent keeps stems strong and stops bud rot (−10% without).' }),
  E({ id: 'cooler', name: 'Portable air conditioner', cat: 'air', price: 400, tier: 1, size: [0.3, 0.3], mount: 'floor', cool: 1.5, power: 0.9, op: 6, blurb: 'Takes 1.5 kW of lamp heat out of the room.' }),
  E({ id: 'climate', name: 'Climate controller & dehumidifier', cat: 'air', price: 1600, tier: 3, size: [0.5, 0.3], mount: 'floor', cool: 3, eff: 0.1, power: 1.1, op: 8, blurb: 'Holds temperature and humidity steady: 3 kW of cooling, +10% yield.' }),
  E({ id: 'control', name: 'Timer & contactor panel', cat: 'air', price: 450, tier: 2, size: [0.35, 0.08], mount: 'wall', wallY: 1.5, auto: 1, power: 0.05, op: 0, blurb: 'Lights switch to 12/12 on the day and pumps water on time: quicker turnaround between crops.' }),
  E({ id: 'sensor', name: 'Temperature & humidity monitor', cat: 'air', price: 120, tier: 1, size: [0.18, 0.05], mount: 'wall', wallY: 1.6, eff: 0.05, power: 0.02, op: 0, blurb: 'Readouts on the wall so you catch a hot day. +5% yield.' }),
  // ---- room and storage
  E({ id: 'shelving', name: 'Drying & storage shelving', cat: 'room', price: 180, tier: 1, size: [0.8, 0.25], mount: 'floor', storage: 20, power: 0, op: 0, blurb: 'Boltless steel shelving for cured stock. Holds 20 more units.' }),
  E({ id: 'cabinet', name: 'Lockable steel cabinet', cat: 'room', price: 260, tier: 1, size: [0.45, 0.25], mount: 'floor', storage: 15, sec: 3, lockable: true, power: 0, op: 0, blurb: 'Lockable storage. Stock inside is harder to steal.' }),
  E({ id: 'workbench2', name: 'Trimming bench', cat: 'room', price: 220, tier: 1, size: [0.9, 0.35], mount: 'floor', eff: 0.05, power: 0.1, op: 1, blurb: 'Somewhere to trim and pot up. +5% yield.' }),
  E({ id: 'pallet_rack', name: 'Commercial storage rack', cat: 'room', price: 950, tier: 3, size: [1.4, 0.4], mount: 'floor', storage: 60, power: 0, op: 0, blurb: 'Pallet racking. Holds 60 more units.' }),
  // ---- security
  E({ id: 'cctv', name: 'CCTV camera', cat: 'security', price: 280, tier: 1, size: [0.16, 0.14], mount: 'wall', wallY: 2.35, sec: 8, power: 0.02, op: 0, blurb: 'Watches the room. +8 security.' }),
  E({ id: 'monitors', name: 'Security monitor desk', cat: 'security', price: 900, tier: 2, size: [0.6, 0.3], mount: 'floor', sec: 12, power: 0.2, op: 2, blurb: 'Four screens on a desk. +12 security.' }),
  E({ id: 'alarm', name: 'Alarm system', cat: 'security', price: 650, tier: 2, size: [0.16, 0.06], mount: 'wall', wallY: 2.0, sec: 10, power: 0.02, op: 1, blurb: 'Keypad and siren. +10 security.' }),
  E({ id: 'safe', name: 'Floor safe', cat: 'security', price: 1200, tier: 2, size: [0.3, 0.3], mount: 'floor', sec: 6, lockable: true, storage: 10, power: 0, op: 0, blurb: 'Heavy safe. +6 security; theft takes far less.' }),
];

// ---- strains --------------------------------------------------------------------------------------

export type StrainId = 'blueberry_auto' | 'northern_lights' | 'skunk' | 'amnesia';
export interface StrainDef {
  id: StrainId;
  name: string;
  type: 'Autoflower' | 'Indica' | 'Hybrid' | 'Sativa';
  /** Weeks under 18/6 light growing, then weeks flowering under 12/12. Autos flower on their own. */
  veg: number;
  flower: number;
  /** Units of stock a plant gives with full light. */
  yield: number;
  /** Watts of light a plant needs. */
  wpp: number;
  /** Price per unit against the basic. */
  value: number;
  /** Lamps it does best under (+10% yield). */
  likes: LightKind[];
  /** Business level needed for the seeds. */
  level: number;
  blurb: string;
}
export const STRAINS: StrainDef[] = [
  { id: 'blueberry_auto', name: 'Blueberry Auto', type: 'Autoflower', veg: 0, flower: 10, yield: 1.2, wpp: 75, value: 1.05, likes: ['led', 'cmh'], level: 1, blurb: 'Flowers on its own: seed to harvest in 10 weeks. Small plants, 75 W each. Keep the heat down: LED or CMH.' },
  { id: 'northern_lights', name: 'Northern Lights', type: 'Indica', veg: 4, flower: 8, yield: 2, wpp: 100, value: 1, likes: ['hps', 'led'], level: 1, blurb: 'The forgiving classic: 4 weeks veg, 8 flowering. Dense buds under HPS.' },
  { id: 'skunk', name: 'Skunk #1', type: 'Hybrid', veg: 4, flower: 9, yield: 2.4, wpp: 100, value: 1, likes: ['hps', 'cmh'], level: 2, blurb: 'Big yields in 9 weeks of flower. Loud: the filters work for it, and a raid is likelier.' },
  { id: 'amnesia', name: 'Amnesia Haze', type: 'Sativa', veg: 5, flower: 11, yield: 2.9, wpp: 130, value: 1.3, likes: ['led', 'cmh'], level: 3, blurb: 'Tall and slow, 11 weeks flowering and 130 W a plant, but it sells for more.' },
];
export const STRAIN: Record<StrainId, StrainDef> = Object.fromEntries(STRAINS.map((s) => [s.id, s])) as Record<StrainId, StrainDef>;
export const DEFAULT_STRAIN: StrainId = 'northern_lights';
/** Seconds of play a grow week takes. */
export const WEEK = 40;
/** Weeks to dry and cure a harvest, and to clean down and replant (timers take half a week off each). */
export const DRY_WEEKS = 1;
export const TURNAROUND_WEEKS = 2;
/** Extra air a watt of HPS needs (its heat), CFM. */
export const HPS_CFM_PER_W = 0.15;
/** Heat a CFM of extraction carries out, kW. */
export const KW_PER_CFM = 1 / 400;

export const EQUIPMENT: Record<string, EquipmentDef> = Object.fromEntries(EQUIPMENT_LIST.map((e) => [e.id, e]));

// ---- business upgrades (bought, not placed) -------------------------------------------------------

export const UPGRADE_KEYS = ['capacity', 'automation', 'efficiency', 'storage', 'security'] as const;
export type UpgradeKey = (typeof UPGRADE_KEYS)[number];
export const BUSINESS_UPGRADES: Record<UpgradeKey, { name: string; per: string; cost: [number, number, number] }> = {
  capacity: { name: 'Plant training', per: 'Topping and low-stress training: +10% yield per level', cost: [900, 2600, 7000] },
  automation: { name: 'Auto-watering', per: 'Drippers and a timed pump: +1 automation per level (quicker turnaround)', cost: [800, 2400, 6000] },
  efficiency: { name: 'Better nutrients', per: 'A proper feed schedule: +8% yield per level', cost: [700, 2000, 5500] },
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
export const UNIT_VALUE = 14;
/** Stock storage before shelving. */
export const BASE_STORAGE = 30;
/** Bills over this and the power company cuts you off until you pay. */
export const OWED_LIMIT = 300;
/** Business level thresholds (units sold). */
export const LEVEL_UNITS = [0, 200, 800, 2500, 8000];
/** Resale value of equipment. */
export const equipmentResale = (price: number) => Math.floor(price / 2);
