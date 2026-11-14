import type { ArchetypeId } from '../ai/archetypes';
import type { BossId } from '../ai/bosses';
import type { WeaponId } from '../combat/Weapons';
import type { AreaId } from '../progress/Progress';

/**
 * Data that describes an area of the world. Gameplay (World.ts) and visuals
 * (LevelView.ts) are both built from this, so what you see is what collides.
 */

export type Theme =
  | 'home' | 'estate' | 'high_street' | 'alleys' | 'industrial' | 'subway' | 'city' | 'territory'
  | 'residential' | 'leisure' | 'stadium' | 'market' | 'docks' | 'ind_estate' | 'factory' | 'precinct' | 'mall' | 'car_park'
  | 'nightlife' | 'underground' | 'hq' | 'shop' | 'pawn' | 'pub'
  | 'furniture_store' | 'car_showroom' | 'bike_shop' | 'casino'
  | 'basement' | 'grow_shop'
  | 'gym_store' | 'boxing_gym' | 'karate_dojo' | 'wrestling_club'
  | 'jeweller' | 'estate_agent' | 'ashcombe';

/** Solid things on the ground. Size comes from the kind unless given. */
export type PropKind =
  | 'bin' | 'skip' | 'car' | 'van' | 'phonebox' | 'busstop' | 'bench' | 'barrier' | 'pallets' | 'crates' | 'drum' | 'cone' | 'trolley'
  | 'postbox' | 'bollard' | 'planter' | 'scrap'
  // home
  | 'bed' | 'wardrobe' | 'sofa' | 'tv' | 'table' | 'fridge' | 'cooker' | 'counter' | 'weights' | 'bag' | 'workbench' | 'shelves' | 'homecar' | 'desk' | 'rack'
  | 'chest'
  // streets (Stage 5)
  | 'dumpster' | 'rubbish_bags' | 'cardboard' | 'abandoned_car' | 'container' | 'market_stall' | 'turnstile' | 'pillar' | 'bike_rack'
  | 'lamp_post' | 'traffic_light' | 'sign_post' | 'bollard_row' | 'bus' | 'forklift' | 'bollard_dock' | 'crane_leg' | 'kiosk' | 'fountain'
  | 'escalator' | 'mall_planter' | 'atm' | 'vending'
  // shops and pubs
  | 'shop_rail' | 'mannequin' | 'display_cabinet' | 'glass_counter' | 'shop_counter' | 'shop_shelf' | 'changing_booth'
  | 'bar' | 'pool_table' | 'pub_table' | 'fruit_machine' | 'jukebox' | 'dj_booth'
  // Stage 6: furniture and vehicles (sized per item), bathroom, casino and showrooms
  | 'furniture' | 'vehicle' | 'bath' | 'toilet' | 'basin'
  | 'slot_machine' | 'roulette_table' | 'blackjack_table' | 'casino_cage' | 'prize_podium' | 'tyre_stack' | 'bike_stand'
  // Stage 7: basement business and the grow shop
  | 'equipment' | 'basement_stairs' | 'terminal_desk' | 'junk' | 'grow_shelf'
  // Stage 8: house computer, gym kit, garage stairwell, fighting gyms
  | 'computer_desk' | 'coach_board' | 'stairwell' | 'gym_kit' | 'boxing_ring' | 'dojo_mat' | 'wrestling_mat' | 'gym_rack'
  // Gym dressing: benches, plates and loose dumbbells (`item` is a GymLibrary model, `size` its footprint)
  | 'gym_prop'
  // Hydroponics dressing at real size (`item` is a HydroLibrary model, `rot` quarter turns)
  | 'hydro_prop'
  // A CCTV post at real size (`item` is post_high, post_medium or post_short from SecurityLibrary)
  | 'security_post'
  // Property and jewellery: stairs up to a landing, an agent's board on a post (`label` is what it says), a necklace bust
  | 'staircase' | 'agent_board' | 'jewel_bust'
  // Keys & Co's window display; the big rooms' fittings (pool, cinema, conservatory, roof terrace, dressing room)
  | 'agent_window' | 'pool_basin' | 'pool_lounger' | 'cinema_screen' | 'projector' | 'cinema_seats'
  | 'conservatory_glazing' | 'terrace_balustrade' | 'terrace_deck' | 'terrace_sofa' | 'terrace_table' | 'wardrobe_wall' | 'dressing_island';

export interface PropDef {
  kind: PropKind;
  x: number;
  z: number;
  /** Rotate 90 degrees (swap width and depth). */
  turned?: boolean;
  colour?: string;
  /** Text on signs and kiosks. */
  label?: string;
  /** Furniture or vehicle catalogue id (kind 'furniture' / 'vehicle'). */
  item?: string;
  /** Quarter turns (0..3). Odd turns swap width and depth. */
  rot?: number;
  /** Half extents, overriding the kind's size. */
  size?: [number, number];
  /** False for things you walk over or that hang on the wall. */
  solid?: boolean;
  /** Wall pieces: height of their centre. */
  wallY?: number;
  /** Showroom display: stand it on a lit plinth. */
  plinth?: boolean;
}

/** Back-wall scenery along the street. */
export type FacadeKind =
  | 'terrace' | 'shop' | 'pub' | 'tower' | 'garages' | 'warehouse' | 'fence' | 'hoarding' | 'subway' | 'office' | 'club' | 'house_front' | 'room'
  | 'semi' | 'precinct' | 'mall' | 'stand' | 'leisure' | 'dock' | 'containers' | 'market' | 'car_park' | 'ruin' | 'platform' | 'fortress'
  | 'interior' | 'showroom' | 'casino' | 'basement' | 'gym_front'
  // A big house set back behind gates and railings (Ashcombe Park); `label` is its name, `flags` its style
  | 'mansion';

export interface FacadeDef {
  kind: FacadeKind;
  x0: number;
  x1: number;
  /** Sign text for shops and pubs; room name for interiors. */
  label?: string;
  colour?: string;
  /** Rooms at home: floor and wall finish ids, and where the window goes (null = none). */
  floor?: string;
  wall?: string;
  windowX?: number | null;
  /** Extra build switches (the basement's tier and improvements). */
  flags?: string[];
}

export interface EntryDef {
  id: string;
  x: number;
  z: number;
  facing: 1 | -1;
}

export interface ExitDef {
  id: string;
  /** 'edge' = walk off the end of the area; 'door' = press interact at it. */
  kind: 'edge' | 'door';
  side?: 'left' | 'right';
  /** An edge that joins the next district on the long street: you walk across it without a stop (see strip.ts). */
  seam?: boolean;
  x: number;
  z: number;
  to: AreaId;
  toEntry: string;
  /** Needs this progress flag to use. */
  requires?: string;
  /** Needs all of these flags. */
  requiresAll?: string[];
  /** A shop door: shut while the shop is closed (after a robbery). */
  shop?: string;
  lockedText?: string;
  label: string;
}

/** A barrier across the street that opens when a flag is set. */
export interface GateDef {
  id: string;
  x: number;
  z0: number;
  z1: number;
  openFlag: string;
  label: string;
}

export interface LeverDef {
  id: string;
  x: number;
  z: number;
  sets: string;
  label: string;
  doneText: string;
}

/**
 * Something lying about. Cash is collected by walking over it; items are
 * picked up with the interact button. Cash and secrets are one-time; plain
 * items come back each visit unless `once` is set.
 */
export interface PickupDef {
  id: string;
  kind: 'cash' | 'item' | 'secret';
  x: number;
  z: number;
  amount?: number;
  /** Item id (see items.ts), e.g. 'kebab', 'w_bat', 'watch_gold'. */
  item?: string;
  qty?: number;
  once?: boolean;
  /** Secrets: what you find. */
  reward?: { cash?: number; items?: string[] };
  label?: string;
}

export type ContainerKind = 'bin' | 'skip' | 'car' | 'drawers' | 'cupboard' | 'wardrobe' | 'crate' | 'locker' | 'bag' | 'dumpster' | 'till';

/** Something you can search with the interact button. */
export interface ContainerDef {
  id: string;
  kind: ContainerKind;
  x: number;
  z: number;
  label: string;
  /** Random contents from a loot table (refills every few trips)... */
  loot?: string;
  /** ...or fixed contents (found once). */
  fixed?: { id: string; qty?: number }[];
  cash?: number;
  /** Needs this flag (a key) to open. */
  requires?: string;
  lockedText?: string;
}

/** A prop you can smash, dropping what was in or made of it. */
export interface BreakableDef {
  id: string;
  kind: 'crate' | 'pallet' | 'chair' | 'table' | 'tv' | 'boxes' | 'window' | 'barrel';
  x: number;
  z: number;
  hp: number;
  /** Weapon left behind (a smashed chair leaves a chair leg). */
  drops?: WeaponId;
  loot?: string;
}

export interface WaveDef {
  enemies: { archetype: ArchetypeId; weapon?: WeaponId }[];
}

export interface EncounterDef {
  id: string;
  /** Starts when you walk past this x. */
  triggerX: number;
  /** Walls you in until it's done. Optional fights have no lock. */
  lock?: [number, number];
  optional: boolean;
  waves: WaveDef[];
  boss?: BossId;
  reward: { cash: number; xp: number };
  /** Shown as the objective while it's waiting. */
  objective?: string;
}

export type StationId =
  | 'wardrobe' | 'mirror' | 'gym' | 'sparring' | 'kitchen' | 'garage' | 'sofa' | 'contacts' | 'tin' | 'storage'
  | 'clothes_counter' | 'changing' | 'pawn_counter' | 'bar'
  | 'planner' | 'bike_rack' | 'car' | 'bike' | 'furniture_counter' | 'car_counter' | 'bike_counter'
  | 'casino_slots' | 'casino_roulette' | 'casino_blackjack' | 'casino_cashier'
  | 'terminal' | 'grow_counter' | 'grow_display'
  | 'computer' | 'train' | 'style_coach' | 'style_drill' | 'recruit' | 'gym_counter'
  | 'fridge' | 'cupboard' | 'cooker' | 'sink' | 'dining' | 'tv' | 'shower' | 'toilet' | 'basin' | 'bed' | 'bath_cabinet'
  // Jewellery and property
  | 'jeweller_counter' | 'jeweller_case' | 'agent_desk' | 'agent_window' | 'prop_info' | 'prop_rest';

/** A non-hostile character standing at a station (shopkeepers, barmen). */
export interface NpcDef {
  name: string;
  /** Seed for their look. */
  seed: number;
  body?: 'male' | 'female';
  top?: string;
  topColour?: string;
  /** Offset from the station point (they stand behind the counter). */
  dz?: number;
}

export interface StationDef {
  id: StationId;
  x: number;
  z: number;
  label: string;
  npc?: NpcDef;
  /** Which shop this is (for shop state: robberies, closures). */
  shop?: string;
  /** Which part of a shop screen to open at (product displays). */
  tab?: string;
}

export interface LightDef {
  x: number;
  y: number;
  z: number;
  colour: number;
  intensity: number;
  range?: number;
}

export interface LevelDef {
  id: AreaId;
  name: string;
  /** District name for the banner. */
  district: string;
  theme: Theme;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  entries: EntryDef[];
  exits: ExitDef[];
  facades: FacadeDef[];
  props: PropDef[];
  /** Extra solid boxes (walls, room dividers). */
  walls?: { minX: number; maxX: number; minZ: number; maxZ: number; visual?: 'wall' | 'none' }[];
  gates?: GateDef[];
  levers?: LeverDef[];
  pickups: PickupDef[];
  containers?: ContainerDef[];
  breakables?: BreakableDef[];
  encounters: EncounterDef[];
  stations?: StationDef[];
  /** Weather and time of day. */
  weather?: 'clear' | 'rain' | 'mist' | 'indoors';
  lights: LightDef[];
  /** Objective when nothing else is going on. */
  objective: string;
  /**
   * How far past the home town this is (the generated towns: 1, 2, 3...). Enemies here are a level stronger
   * per point, react sooner and string longer combinations together.
   */
  threat?: number;
}

/** Collision footprint (half width in x, half depth in z) for each prop. */
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  bin: [0.32, 0.36], skip: [1.25, 0.7], car: [2.0, 0.9], van: [2.5, 1.0], phonebox: [0.5, 0.5], busstop: [1.6, 0.35], bench: [0.9, 0.28],
  barrier: [1.0, 0.15], pallets: [0.6, 0.5], crates: [0.5, 0.5], drum: [0.3, 0.3], cone: [0, 0], trolley: [0.4, 0.3], postbox: [0.3, 0.3],
  bollard: [0.12, 0.12], planter: [0.6, 0.4], scrap: [1.1, 0.8],
  bed: [1.0, 0.75], wardrobe: [0.6, 0.35], sofa: [1.0, 0.45], tv: [0.6, 0.25], table: [0.5, 0.4], fridge: [0.4, 0.35], cooker: [0.4, 0.35],
  counter: [1.2, 0.35], weights: [0.8, 0.4], bag: [0.25, 0.25], workbench: [1.0, 0.4], shelves: [0.8, 0.25], homecar: [2.0, 0.9], desk: [0.7, 0.35], rack: [0.8, 0.2],
  chest: [0.6, 0.35],
  dumpster: [1.0, 0.6], rubbish_bags: [0.5, 0.35], cardboard: [0.45, 0.35], abandoned_car: [2.0, 0.9], container: [3.0, 1.2], market_stall: [1.3, 0.6],
  turnstile: [0.4, 0.3], pillar: [0.3, 0.3], bike_rack: [0.9, 0.15], lamp_post: [0.1, 0.1], traffic_light: [0.1, 0.1], sign_post: [0.08, 0.08],
  bollard_row: [1.5, 0.12], bus: [5.0, 1.2], forklift: [1.1, 0.65], bollard_dock: [0.22, 0.22], crane_leg: [0.5, 0.5], kiosk: [1.0, 0.8], fountain: [1.2, 1.0],
  escalator: [2.4, 0.6], mall_planter: [1.0, 0.5], atm: [0.35, 0.25], vending: [0.45, 0.35],
  shop_rail: [0.9, 0.3], mannequin: [0.25, 0.25], display_cabinet: [0.8, 0.35], glass_counter: [1.2, 0.4], shop_counter: [1.3, 0.4], shop_shelf: [1.0, 0.25],
  changing_booth: [0.6, 0.6], bar: [2.5, 0.45], pool_table: [1.3, 0.75], pub_table: [0.45, 0.45], fruit_machine: [0.35, 0.3], jukebox: [0.45, 0.3], dj_booth: [1.2, 0.5],
  furniture: [0.5, 0.5], vehicle: [1.0, 0.5], bath: [0.85, 0.4], toilet: [0.22, 0.3], basin: [0.3, 0.22],
  slot_machine: [0.38, 0.32], roulette_table: [1.2, 0.6], blackjack_table: [1.1, 0.55], casino_cage: [1.4, 0.4], prize_podium: [2.6, 1.15], tyre_stack: [0.4, 0.4], bike_stand: [1.0, 0.35],
  equipment: [0.5, 0.5], basement_stairs: [0.75, 0.75], terminal_desk: [0.7, 0.32], junk: [0.6, 0.5], grow_shelf: [1.0, 0.25],
  computer_desk: [0.6, 0.32], coach_board: [0.4, 0.06], stairwell: [0.85, 0.9], gym_kit: [0.5, 0.5], boxing_ring: [2.2, 1.0], dojo_mat: [2.4, 1.1], wrestling_mat: [2.4, 1.1], gym_rack: [0.9, 0.3], gym_prop: [0.4, 0.3], hydro_prop: [0.3, 0.3], security_post: [0.12, 0.12],
  staircase: [1.1, 0.5], agent_board: [0.35, 0.08], jewel_bust: [0.22, 0.2],
  agent_window: [1.05, 0.2], pool_basin: [2.8, 0.8], pool_lounger: [0.95, 0.33], cinema_screen: [2.3, 0.12], projector: [0.18, 0.15], cinema_seats: [1.15, 0.45],
  conservatory_glazing: [3.0, 0.24], terrace_balustrade: [3.0, 0.24], terrace_deck: [3.0, 1.9], terrace_sofa: [1.0, 0.43], terrace_table: [0.75, 0.5], wardrobe_wall: [1.7, 0.31], dressing_island: [0.8, 0.35],
};

/** Half extents after rotation. */
export function propHalf(p: PropDef): [number, number] {
  let [hx, hz] = p.size ?? PROP_SIZE[p.kind];
  if (p.turned) [hx, hz] = [hz, hx];
  if ((p.rot ?? 0) % 2 === 1) [hx, hz] = [hz, hx];
  return [hx, hz];
}

export function propBox(p: PropDef): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (p.solid === false) return null;
  const [hx, hz] = propHalf(p);
  if (hx === 0) return null;
  return { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz };
}
