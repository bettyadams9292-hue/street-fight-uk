import { Rng } from '../core/Rng';
import type { AreaId } from '../progress/Progress';
import type { FacadeDef, FacadeKind, LevelDef, PropKind } from '../world/LevelTypes';
import { propHalf } from '../world/LevelTypes';
import { onStrip, stripNeighbours, isSubwayStairs, SUBWAY_GAP } from '../world/strip';
import { KIT_METRICS } from './polyKitMetrics';

/**
 * Lays out one district of the long street from the low-poly kits
 * (public/models/polyfork): what the ground is made of and where, which
 * buildings stand along the back of the pavement, what you can see through
 * each shop window, and which kit model stands in for each prop.
 *
 * Pure data, no Three.js: the renderer (render/kit) draws exactly what this
 * returns, and the tests read it to check that pavement is under the
 * pavement, road under the road, and that a furniture shop has furniture in it.
 *
 * Across the street, from the buildings towards the camera:
 *
 *     back ........ kerbZ ..... front ........ far
 *     | pavement    | kerb, parking lane, road  |
 *
 * `back` is the building line and `front` the edge of where you can walk. On
 * a street with a road the kerb is inside the walkable band, so parked cars
 * stand on tarmac and benches on paving. Districts without a road (a
 * precinct, a yard, a quay) are one surface all the way across.
 */

export interface Placement {
  model: string;
  x: number;
  y: number;
  z: number;
  /** Turn about the vertical axis, radians. */
  ry: number;
  sx: number;
  sy: number;
  sz: number;
  /** Multiplies every colour of the model. */
  tint?: string;
  /** A vehicle's bodywork colour. */
  paint?: string;
  /**
   * Built as a mesh of its own under this name (not baked in with the street), so the renderer can
   * fade it: parked vehicles in front of the fight go see-through when someone walks behind them.
   */
  own?: string;
}

/** A plain coloured block: painted lines, sign boards' backing, water. */
export interface Block {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  colour: string;
  glow?: boolean;
  /** Not brick: painted metal or plastic (gutters), left its own colour. */
  plain?: boolean;
}

export interface Sign {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  text: string;
  bg: string;
  fg: string;
  neon?: boolean;
}

export type SurfaceKind = 'pavement' | 'plaza' | 'cobbles' | 'yard' | 'deck' | 'kerb' | 'road' | 'water' | 'shopfloor' | 'garden';

/** A rectangle of ground and what it is. Later entries lie on top of earlier ones. */
export interface Surface {
  kind: SurfaceKind;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export type InteriorKind =
  | 'pub' | 'club' | 'takeaway' | 'cafe' | 'bookies' | 'gadgets' | 'clothes' | 'furniture' | 'pawn' | 'jeweller' | 'casino' | 'office' | 'gym'
  | 'offlicence' | 'bikes' | 'cars' | 'plants' | 'salon' | 'general';

/**
 * Stock that isn't a city-kit piece: a level prop (clothes rail, mannequin, gym kit, motorbike, sofa…) drawn by
 * LevelView.buildProp like any other, turned by `ry` and lifted onto the shop floor by `y`.
 */
export interface ShopGood {
  prop: { kind: PropKind; x: number; z: number; item?: string; size?: [number, number]; colour?: string; label?: string };
  ry: number;
  y: number;
}

/** A shop you can see into: where it is, what kind, and what is inside it. */
export interface Shopfront {
  label: string;
  kind: InteriorKind;
  x0: number;
  x1: number;
  /** Models standing inside, behind the glass. */
  contents: string[];
}

export interface StreetPlan {
  area: AreaId;
  back: number;
  /** Where pavement meets road, or null on a street with no road. */
  kerbZ: number | null;
  front: number;
  x0: number;
  x1: number;
  ground: GroundKind;
  placements: Placement[];
  blocks: Block[];
  signs: Sign[];
  surfaces: Surface[];
  shopfronts: Shopfront[];
  /** Shop stock drawn from the other model sets (see ShopGood). */
  goods: ShopGood[];
  /** Approved British models standing in for the kit's (see APPROVED_STREET): drawn by LevelView, baked per chunk. */
  approved: ApprovedPlacement[];
  /** For each of the level's props, in order: true if a kit model stands in for it. */
  propDone: boolean[];
  /** Doorways the kit buildings provide (x positions), so exits don't draw their own frame. */
  doors: number[];
}

export type GroundKind = 'street' | 'suburb' | 'plaza' | 'lane' | 'yard' | 'quay';

export interface District {
  ground: GroundKind;
  /** Building colour washes, picked per building. */
  tints: string[];
  skyline: 'none' | 'low' | 'city';
  lamp: string;
  trees: boolean;
  /** Paving model, where this district's differs from the usual for its kind of ground. */
  pavement?: string;
  /** This district's own building stock for some kinds of frontage (the generated towns each have their own). */
  solid?: Partial<Record<FacadeKind, string[]>>;
  /** The open-fronted unit its shops are built from. */
  shell?: string;
}

/** Add a district the planner should know how to build (the generated towns register theirs). */
export function registerDistrict(id: AreaId, d: District): void {
  DISTRICTS[id] = d;
}

const WARM = ['#ffffff', '#f0dcc8', '#e6c8b0', '#d9d2c4', '#f4e6d0'];
const COOL = ['#ffffff', '#d4dde2', '#c8cfd6', '#e2e6e8', '#bcc8cc'];
const GRIT = ['#b8b0a8', '#a8a49c', '#c4b8a8', '#9c9890', '#d0c8bc'];
const DARK = ['#8a8684', '#7c7672', '#948c84', '#6e6a68'];

/** How each district of the street is built. */
export const DISTRICTS: Partial<Record<AreaId, District>> = {
  stadium: { ground: 'street', tints: GRIT, skyline: 'low', lamp: 'hood/cobra-head-street-light', trees: false },
  leisure: { ground: 'suburb', tints: COOL, skyline: 'none', lamp: 'hood/cobra-head-street-light', trees: true },
  residential: { ground: 'suburb', tints: WARM, skyline: 'low', lamp: 'hood/cobra-head-street-light', trees: true },
  estate: { ground: 'street', tints: WARM, skyline: 'low', lamp: 'nyc/prop-street-lamp', trees: true },
  high_street: { ground: 'street', tints: WARM, skyline: 'low', lamp: 'nyc/prop-street-lamp', trees: false },
  alleys: { ground: 'lane', tints: GRIT, skyline: 'low', lamp: 'nyc/prop-globe-lamp', trees: false },
  industrial: { ground: 'yard', tints: GRIT, skyline: 'none', lamp: 'hood/cobra-head-street-light', trees: false },
  ind_estate: { ground: 'street', tints: COOL, skyline: 'none', lamp: 'hood/cobra-head-street-light', trees: false },
  market: { ground: 'plaza', tints: WARM, skyline: 'low', lamp: 'nyc/prop-globe-lamp', trees: false },
  subway: { ground: 'street', tints: GRIT, skyline: 'city', lamp: 'nyc/prop-street-lamp', trees: false },
  city: { ground: 'street', tints: COOL, skyline: 'city', lamp: 'nyc/prop-street-lamp', trees: true },
  docks: { ground: 'quay', tints: GRIT, skyline: 'none', lamp: 'hood/cobra-head-street-light', trees: false },
  precinct: { ground: 'plaza', tints: COOL, skyline: 'low', lamp: 'nyc/prop-globe-lamp', trees: true },
  mall: { ground: 'plaza', tints: COOL, skyline: 'city', lamp: 'nyc/prop-globe-lamp', trees: true },
  car_park: { ground: 'yard', tints: GRIT, skyline: 'city', lamp: 'hood/cobra-head-street-light', trees: false },
  nightlife: { ground: 'street', tints: DARK, skyline: 'city', lamp: 'nyc/prop-street-lamp', trees: false },
  factory: { ground: 'yard', tints: DARK, skyline: 'none', lamp: 'hood/cobra-head-street-light', trees: false },
  underground: { ground: 'street', tints: DARK, skyline: 'city', lamp: 'nyc/prop-street-lamp', trees: false },
  territory: { ground: 'yard', tints: DARK, skyline: 'low', lamp: 'hood/cobra-head-street-light', trees: false },
  hq: { ground: 'plaza', tints: COOL, skyline: 'city', lamp: 'nyc/prop-globe-lamp', trees: true },
};

/** How far the scenery carries on past an end of the street that has no neighbour. */
export const STREET_EXTENT = 16;
/** The kerb line on streets with a road: paving behind it, tarmac in front. */
export const KERB_Z = -0.1;
/** Street lamps stand just behind the kerb, on the pavement's road edge. */
export const LAMP_Z = KERB_Z - 0.16;
const KERB_DEPTH = 0.3;
const SHELL = 'cafe/cafe-storefront-unit';
const SHELL_W = 8;
const SHELL_DEPTH = 8;
/** Kinds of frontage that become a shop you can see into, when they carry a name. */
const SHOP_KINDS: ReadonlySet<FacadeKind> = new Set(['shop', 'pub', 'showroom', 'casino', 'gym_front', 'club', 'precinct', 'mall', 'office']);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function size(model: string): { w: number; h: number; d: number; minX: number; minZ: number; maxZ: number; foot: number } {
  const m = KIT_METRICS[model];
  if (!m) throw new Error(`street plan: no kit model called ${model}`);
  return { w: m[3] - m[0], h: m[4], d: m[5] - m[2], minX: m[0], minZ: m[2], maxZ: m[5], foot: m[6] };
}

/** Lettering that shows up on a board of this colour. */
function readable(bg: string): string {
  const n = parseInt(bg.replace('#', ''), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? '#16181c' : '#f4f0e6';
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng.next() * list.length))];
}

// ---- what is inside each kind of shop -----------------------------------------------------

/** Which kind of shop a sign names. The frontage kind settles it where the name alone would mislead. */
export function interiorFor(kind: FacadeKind, label: string): InteriorKind {
  const t = label.toUpperCase();
  if (kind === 'casino') return 'casino';
  if (kind === 'gym_front' || /BOXING|TEMPLE|WRESTLING|GYM|KARATE/.test(t)) return 'gym';
  if (/MOTORS/.test(t)) return 'cars';
  if (/MOTO/.test(t)) return 'bikes';
  if (/GREEN FINGERS|GARDEN|HYDRO/.test(t)) return 'plants';
  if (/HEARTH|FURNITURE|CARPET/.test(t)) return 'furniture';
  if (/PAWN/.test(t)) return 'pawn';
  if (/JEWEL|HALDEN|GOLDSMITH/.test(t)) return 'jeweller';
  if (/GOLD\b/.test(t)) return 'pawn';
  if (kind === 'club' || /VELVET|PULSE|ELECTRIC/.test(t)) return 'club';
  if (kind === 'pub' || /LION|ARMS|CASTLE|TAVERN/.test(t)) return 'pub';
  if (/CHIPPY|KEBAB|CHICKEN|FOOD COURT|BAKERY/.test(t)) return 'takeaway';
  if (/CAFE|COFFEE/.test(t)) return 'cafe';
  if (/BOOKIES|BOOKMAKERS/.test(t)) return 'bookies';
  if (/VAPE|PHONE|TECH/.test(t)) return 'gadgets';
  if (/THREADS|FASHION|SPORTS|CLUB SHOP|DEPARTMENT/.test(t)) return 'clothes';
  if (/BOOZE|OFF LICENCE/.test(t)) return 'offlicence';
  if (/NAILS|BEAUTY|HAIR|BARBER|CUTZ/.test(t)) return 'salon';
  if (kind === 'office') return 'office';
  return 'general';
}

/** One thing in a shop: u across the unit (-3.4 to 3.4), v back from the glass (0 to 7), in metres. */
interface Item {
  /** A city-kit model, or 'prop:<kind>[/<item>]' for stock from the other model sets (`g`). */
  m: string;
  g?: { kind: PropKind; item?: string; size?: [number, number]; colour?: string };
  /** An approved model (src/render/approved/registry.ts), drawn by LevelView at real size. */
  a?: string;
  u: number;
  v: number;
  y?: number;
  ry?: number;
  s?: number;
  paint?: string;
}

const HALF_PI = Math.PI / 2;

/** Stock from the other model sets (clothes rails, mannequins, gym kit, motorbikes, furniture…), placed like any other item. */
function G(kind: PropKind, u: number, v: number, o: { item?: string; size?: [number, number]; colour?: string; ry?: number; y?: number } = {}): Item {
  return { m: `prop:${kind}${o.item ? `/${o.item}` : ''}`, u, v, y: o.y, ry: o.ry, g: { kind, item: o.item, size: o.size, colour: o.colour } };
}
/** An approved model in a shop (A for approved), at real size, on the floor unless `y` says otherwise. */
function A(id: string, u: number, v: number, o: { ry?: number; y?: number } = {}): Item {
  return { m: `approved:${id}`, u, v, y: o.y, ry: o.ry, a: id };
}
/** Faces into the shop from the left wall (+u), or from the right wall (−u). */
const FROM_LEFT = HALF_PI;
const FROM_RIGHT = -HALF_PI;

/**
 * What stands in each kind of shop: what that shop really sells, where you'd expect it. Café and office kit only
 * where a café or an office is what the shop is; the goods come from the shop, gym, furniture and vehicle sets.
 */
const INTERIORS: Record<string, Item[]> = {
  // A British local: back-bar bottle shelves, the bar with stools along it, booths down the side, the pool table,
  // a fruit machine, the dartboard on the back wall and the chalkboard by the door (approved pub kit, B02-B07).
  pub: [
    A('backBarShelves', -1.2, 6.5), A('backBarShelves', 1.2, 6.5),
    { m: 'cafe/service-counter-module', u: -2, v: 4.8 }, { m: 'cafe/service-counter-module', u: 0, v: 4.8 }, { m: 'cafe/service-counter-module', u: 2, v: 4.8 },
    A('wineBottle', -1.6, 4.8, { y: 0.92 }), A('wineBottle', -1.45, 4.85, { y: 0.92 }),
    A('pubStool', -2, 4.0), A('pubStool', -1, 4.0), A('pubStool', 0, 4.0), A('pubStool', 1, 4.0), A('pubStool', 2, 4.0),
    A('poolTable', 0.4, 2.4),
    A('pubBooth', -2.85, 1.6, { ry: FROM_LEFT }), A('pubBooth', -2.85, 3.0, { ry: FROM_LEFT }),
    A('fruitMachine', 3.0, 3.4, { ry: FROM_RIGHT }), A('pubDartboard', 3.1, 6.78), A('chalkboardMenu', 2.7, 0.8),
    { m: 'cars/jukebox', u: 3.1, v: 5.4, ry: -HALF_PI },
  ],
  club: [
    { m: 'cafe/back-bar-shelf-unit', u: 2, v: 6.4 }, { m: 'cafe/service-counter-module', u: 1.2, v: 5 }, { m: 'cafe/service-counter-module', u: 3, v: 5 },
    { m: 'cafe/poseur-table', u: -2.6, v: 1.6 }, { m: 'cafe/poseur-table', u: -0.6, v: 2.8 }, { m: 'cafe/poseur-table', u: 1.6, v: 1.8 },
    { m: 'cafe/queue-belt-post', u: -1, v: 0.7 }, { m: 'cafe/queue-belt-post', u: 1, v: 0.7 },
    { m: 'cafe/banquette-bench-run', u: -3, v: 3.4, ry: HALF_PI }, { m: 'cafe/festoon-light-run', u: 0, v: 3.6, y: 2.4 },
    G('dj_booth', -1.6, 6.2, { size: [1.0, 0.45] }),
  ],
  takeaway: [
    { m: 'cafe/service-counter-module', u: -2, v: 3.6 }, { m: 'cafe/service-counter-module', u: 0, v: 3.6 }, { m: 'cafe/pastry-display-case', u: 2.2, v: 3.6 },
    { m: 'cafe/pos-terminal', u: -1.6, v: 3.6, y: 0.92 }, { m: 'cafe/commercial-range', u: -1.4, v: 6.3 }, { m: 'cafe/extraction-canopy', u: -1.4, v: 6.3 },
    { m: 'cafe/stainless-prep-table', u: 0.8, v: 6.3 }, { m: 'cafe/drinks-fridge', u: 3, v: 6.2 }, { m: 'cafe/chalkboard-menu-board', u: -3, v: 6.6 },
    { m: 'cafe/queue-belt-post', u: -1.2, v: 1.6 }, { m: 'cafe/queue-belt-post', u: 0.8, v: 1.6 }, { m: 'cafe/waste-sorting-station', u: 3, v: 1.4, ry: -HALF_PI },
    { m: 'cafe/pass-heat-lamp', u: 0, v: 3.6 },
  ],
  // The chippy: the serving counter and heated display at the front, the fryer range under its canopy behind,
  // the menu over the range, a queue by the door. Nothing hot where customers stand.
  takeaway_chippy: [
    A('takeawayCounter', -1.1, 3.4), { m: 'cafe/service-counter-module', u: 1.2, v: 3.4 }, A('chippyWarmer', 1.2, 3.4, { y: 0.92 }),
    A('fishChipFryer', -1.2, 6.3), { m: 'cafe/extraction-canopy', u: -1.2, v: 6.3 }, A('takeawayMenuBoard', 1.4, 6.82, { y: 1.35 }),
    { m: 'cafe/stainless-prep-table', u: 1.4, v: 6.3 }, A('drinksFridge', 3.0, 6.2),
    A('queueBarrierOpen', -1.0, 1.5), { m: 'cafe/waste-sorting-station', u: 3, v: 1.4, ry: -HALF_PI },
  ],
  // Kebab and fried chicken: counter and heated display, the grill under its canopy, menu over it.
  takeaway_grill: [
    A('takeawayCounter', -1.1, 3.4), { m: 'cafe/service-counter-module', u: 1.2, v: 3.4 }, A('chippyWarmer', 1.2, 3.4, { y: 0.92 }),
    { m: 'cafe/commercial-range', u: -1.4, v: 6.3 }, { m: 'cafe/extraction-canopy', u: -1.4, v: 6.3 }, A('takeawayMenuBoard', 1.0, 6.82, { y: 1.35 }),
    A('drinksFridge', 3.0, 6.2), A('queueBarrierOpen', -1.0, 1.5),
  ],
  // The bakery: bread on the display and in trays behind, pastries in the hot cabinet, the counter by the door.
  takeaway_bakery: [
    A('bakeryDisplay', -1.7, 3.4), A('takeawayCounter', 0.9, 3.4), A('pastryCabinet', 2.8, 3.4),
    { m: 'cafe/stainless-prep-table', u: -1.4, v: 6.3 }, A('breadTray', -1.7, 6.3, { y: 0.92 }), A('breadTray', -1.05, 6.3, { y: 0.92 }), A('breadTray', -1.4, 6.3, { y: 1.18 }),
    A('takeawayMenuBoard', 1.4, 6.82, { y: 1.35 }), A('drinksFridge', 3.0, 6.2),
  ],
  cafe: [
    { m: 'cafe/service-counter-module', u: -2, v: 4.6 }, { m: 'cafe/service-counter-module', u: 0, v: 4.6 }, { m: 'cafe/pastry-display-case', u: 2.2, v: 4.6 },
    { m: 'cafe/espresso-machine', u: -2, v: 4.6, y: 0.92 }, { m: 'cafe/coffee-grinder', u: -0.8, v: 4.6, y: 0.92 }, { m: 'cafe/cake-stand', u: 0.4, v: 4.6, y: 0.92 },
    { m: 'cafe/back-bar-shelf-unit', u: -1, v: 6.4 }, { m: 'cafe/shop-coffee-roaster', u: 2.8, v: 6.2 },
    { m: 'cafe/bistro-table', u: -2.2, v: 1.8 }, { m: 'cafe/bistro-chair', u: -3, v: 1.8, ry: HALF_PI }, { m: 'cafe/bistro-chair', u: -1.4, v: 1.8, ry: -HALF_PI },
    { m: 'cafe/bistro-table', u: 1.8, v: 2.2 }, { m: 'cafe/bistro-chair', u: 1, v: 2.2, ry: HALF_PI }, { m: 'cafe/bistro-chair', u: 2.6, v: 2.2, ry: -HALF_PI },
    { m: 'cafe/chalkboard-menu-board', u: 3.1, v: 3.6, ry: -HALF_PI }, { m: 'cafe/neon-window-sign', u: -2.6, v: 0.5 },
  ],
  bookies: [
    // Racing on the screens, betting machines down the wall, stands to fill in your slip, and the counter.
    { m: 'office/wall-display', u: -2.2, v: 6.9 }, { m: 'office/wall-display', u: 0, v: 6.9 }, { m: 'office/wall-display', u: 2.2, v: 6.9 },
    { m: 'office/reception-counter', u: 2.2, v: 4.6 }, { m: 'cafe/pos-terminal', u: 2.2, v: 4.6, y: 1.05 },
    G('slot_machine', -3.0, 2.6, { ry: FROM_LEFT }), G('slot_machine', -3.0, 3.5, { ry: FROM_LEFT }), G('slot_machine', -3.0, 4.4, { ry: FROM_LEFT }),
    { m: 'cafe/poseur-table', u: -0.6, v: 2.6 }, { m: 'cafe/poseur-table', u: -0.6, v: 4.6 }, { m: 'office/paper-stack', u: -0.6, v: 2.6, y: 1.05 },
    { m: 'office/wastepaper-bin', u: 0.6, v: 1.4 }, { m: 'office/wall-clock', u: 3.3, v: 6.9 },
  ],
  gadgets: [
    // Phones and vapes in the glass counter and the cabinet, the till on its own counter, ads on the wall.
    G('glass_counter', -1.0, 3.4, { size: [1.4, 0.4] }), G('shop_counter', 2.0, 3.6, { size: [1.0, 0.4] }),
    { m: 'office/laptop', u: 1.6, v: 3.6, y: 1.0 }, G('display_cabinet', -3.0, 5.6, { ry: FROM_LEFT }), G('shop_shelf', 1.4, 6.6, { size: [1.2, 0.22] }),
    { m: 'office/wall-display', u: -1, v: 6.9 }, { m: 'office/wall-display', u: 2.6, v: 6.9 },
  ],
  clothes: [
    // Dressed mannequins in the window, rails of clothes on the floor, folded stock on the back wall, a fitting room.
    G('mannequin', -2.8, 0.9), G('mannequin', 2.8, 0.9),
    G('shop_rail', -1.8, 2.2, { size: [0.8, 0.3] }), G('shop_rail', 0.8, 2.6, { size: [0.8, 0.3] }), G('shop_rail', -1.2, 4.4, { size: [0.8, 0.3] }),
    G('shop_shelf', 0.6, 6.6, { size: [1.2, 0.22] }), G('changing_booth', -2.8, 6.3), G('shop_counter', 2.3, 5.2, { size: [0.9, 0.4] }),
  ],
  furniture: [
    // Room sets: a living room at the front, a bedroom at the back, a dining set between.
    G('furniture', -1.8, 1.8, { item: 'rug_long', size: [1.2, 0.7] }), G('furniture', -1.8, 2.4, { item: 'sofa_3' }), G('furniture', -1.8, 1.4, { item: 'coffee_table' }),
    G('furniture', 0.4, 1.8, { item: 'armchair', ry: FROM_RIGHT }), G('furniture', -3.1, 2.4, { item: 'floor_lamp' }),
    G('furniture', 1.8, 3.6, { item: 'dining_table' }), G('furniture', 1.4, 3.0, { item: 'dining_chair', ry: Math.PI }), G('furniture', 2.2, 3.0, { item: 'dining_chair', ry: Math.PI }),
    G('furniture', 1.4, 4.2, { item: 'dining_chair' }), G('furniture', 2.2, 4.2, { item: 'dining_chair' }),
    G('furniture', -1.4, 5.6, { item: 'bed_double' }), G('furniture', -2.6, 6.4, { item: 'bedside' }), G('furniture', 1.2, 6.5, { item: 'wardrobe2' }),
    G('furniture', 2.9, 6.5, { item: 'plant_tall' }),
  ],
  pawn: [
    // Rings and watches in the glass counter, gadgets in the cabinet, second-hand tellies and stereos.
    G('glass_counter', -1.2, 3.8, { size: [1.4, 0.4] }), G('shop_counter', 2.0, 3.8, { size: [1.0, 0.4] }),
    G('display_cabinet', -3.0, 5.6, { ry: FROM_LEFT }), G('tv', 1.4, 6.5), G('shop_shelf', -0.6, 6.6, { size: [1.0, 0.22] }),
    { m: 'cars/boombox', u: -2.6, v: 1.2 }, { m: 'cars/suitcase', u: -1.6, v: 1.3 }, { m: 'office/wall-clock', u: -2, v: 6.9 }, { m: 'office/wall-clock', u: -0.6, v: 6.9 },
  ],
  jeweller: [
    // Glass cases of rings and watches, tall cabinets either side, a necklace on its bust.
    G('glass_counter', -1.6, 2.6, { size: [1.0, 0.4] }), G('glass_counter', 1.6, 2.6, { size: [1.0, 0.4] }), G('glass_counter', 0, 4.8, { size: [1.6, 0.4] }),
    G('display_cabinet', -3.0, 5.4, { ry: FROM_LEFT }), G('display_cabinet', 3.0, 5.4, { ry: FROM_RIGHT }), G('jewel_bust', 0, 4.8, { y: 1.1 }),
    { m: 'cafe/potted-olive-tree', u: -3.1, v: 1.0 }, { m: 'cafe/potted-olive-tree', u: 3.1, v: 1.0 }, { m: 'office/wall-clock', u: 0, v: 6.9 },
  ],
  casino: [
    // Roulette and blackjack at the front, slots down the wall, the cashier's cage at the back.
    G('roulette_table', -1.5, 2.6, { size: [1.15, 0.6] }), G('blackjack_table', 1.7, 2.7),
    G('slot_machine', -3.0, 4.4, { ry: FROM_LEFT }), G('slot_machine', -3.0, 5.2, { ry: FROM_LEFT }), G('slot_machine', -3.0, 6.0, { ry: FROM_LEFT }),
    G('casino_cage', 1.6, 6.3, { size: [1.4, 0.4] }), { m: 'cafe/queue-belt-post', u: -1.2, v: 0.8 }, { m: 'cafe/queue-belt-post', u: 1.2, v: 0.8 },
  ],
  office: [
    { m: 'office/reception-counter', u: 0, v: 3.2 }, { m: 'office/directory-totem', u: -2.8, v: 1.2 }, { m: 'office/planter-divider', u: 2.8, v: 1.4 },
    { m: 'office/sit-stand-desk', u: -2, v: 5.6 }, { m: 'office/task-chair', u: -2, v: 6.3, ry: Math.PI }, { m: 'office/monitor-arm', u: -2, v: 5.5, y: 0.74 },
    { m: 'office/sit-stand-desk', u: 1.8, v: 5.6 }, { m: 'office/task-chair', u: 1.8, v: 6.3, ry: Math.PI }, { m: 'office/laptop', u: 1.8, v: 5.6, y: 0.74 },
    { m: 'office/breakout-sofa', u: -2.6, v: 3, ry: HALF_PI }, { m: 'office/whiteboard', u: 0, v: 6.9 }, { m: 'office/multifunction-printer', u: 3.1, v: 3.6, ry: -HALF_PI },
  ],
  // Gyms: what the sign says goes on. A boxing club has a ring and bags, a wrestling or martial arts club its mats,
  // a gym its machines and weights. All of them have lockers and somewhere to sign in.
  gym: [
    G('gym_kit', -2.4, 2.0, { item: 'treadmill' }), G('gym_kit', -0.4, 2.0, { item: 'treadmill' }), G('gym_kit', 1.8, 2.0, { item: 'exercise_bike' }),
    G('gym_kit', -1.0, 4.4, { item: 'barbell' }), G('gym_kit', 1.4, 4.4, { item: 'dumbbells' }), G('gym_kit', 2.9, 4.6, { item: 'bag' }),
    { m: 'office/locker-bank', u: -2.8, v: 6.5 }, { m: 'office/locker-bank', u: -1.2, v: 6.5 }, { m: 'cafe/drinks-fridge', u: 3, v: 6.2 },
    { m: 'office/wall-clock', u: 0, v: 6.9 },
  ],
  gym_boxing: [
    G('boxing_ring', 0.8, 3.6, { size: [1.9, 1.3] }), G('gym_kit', -2.6, 2.0, { item: 'bag' }), G('gym_kit', -2.6, 4.0, { item: 'bag' }),
    { m: 'office/locker-bank', u: -2.8, v: 6.5 }, { m: 'office/locker-bank', u: -1.2, v: 6.5 }, { m: 'cafe/banquette-bench-run', u: 1.2, v: 6.4 },
    { m: 'office/first-aid-box', u: 2.6, v: 6.9 }, { m: 'office/wall-clock', u: 0.2, v: 6.9 },
  ],
  gym_mats: [
    G('wrestling_mat', 0, 3.4, { size: [2.6, 1.6] }),
    { m: 'office/locker-bank', u: -2.8, v: 6.5 }, { m: 'office/locker-bank', u: -1.2, v: 6.5 }, { m: 'cafe/banquette-bench-run', u: 1.2, v: 6.4 },
    { m: 'office/first-aid-box', u: 2.6, v: 6.9 }, { m: 'office/wall-clock', u: 0.2, v: 6.9 }, G('gym_kit', 3.0, 1.2, { item: 'bag' }),
  ],
  offlicence: [
    A('stockedShelves', -1.9, 6.5), A('drinksFridge', 0.1, 6.3), A('drinksFridge', 1.0, 6.3), A('drinksFridge', 1.9, 6.3),
    A('shopCounterTill', 2.1, 2.6), A('wineBottle', 1.5, 2.45, { y: 1.0 }), A('wineBottle', 1.62, 2.5, { y: 1.0 }),
    A('stockedShelves', -2.9, 3.6, { ry: FROM_LEFT }), A('cardboardBox', -1.2, 1.2), A('cardboardBox', -0.55, 1.1),
  ],
  bikes: [
    // Motorbikes on the floor (the sign says MOTO), tyres and a workbench at the back.
    G('vehicle', -2.1, 1.8, { item: 'b24_petrol_mx', colour: '#c0392b' }), G('vehicle', 0.7, 1.8, { item: 'b28_delivery_moped' }),
    G('vehicle', -1.0, 3.6, { item: 'b17_city_ebike' }), G('vehicle', 1.8, 3.8, { item: 'b26_sportbike', colour: '#e0a020' }),
    G('tyre_stack', 3.0, 6.2), G('workbench', 0.6, 6.4), G('shop_counter', -2.2, 5.4, { size: [0.9, 0.4] }), { m: 'cars/oil-drum', u: -3.1, v: 6.4 },
  ],
  cars: [
    { m: 'cars/muscle-car-60s', u: -1.2, v: 2.6, ry: HALF_PI + 0.25, paint: '#b3261e' }, { m: 'cars/wedge-coupe-80s', u: 1, v: 5.2, ry: HALF_PI - 0.2, paint: '#d8dde0' },
    { m: 'office/reception-counter', u: 2.8, v: 1.8, ry: -HALF_PI }, { m: 'office/directory-totem', u: -3.1, v: 0.9 }, { m: 'cafe/potted-olive-tree', u: 3.1, v: 6.4 },
  ],
  plants: [
    { m: 'office/planter-divider', u: -2.6, v: 1.6 }, { m: 'cafe/planter-trough-divider', u: -0.6, v: 1.8 }, { m: 'cafe/potted-olive-tree', u: 1.4, v: 1.6 }, { m: 'cars/planter', u: 2.8, v: 2 },
    { m: 'cafe/hanging-plant-basket', u: -1.6, v: 3.6 }, { m: 'cafe/hanging-plant-basket', u: 1.6, v: 3.6 }, { m: 'cafe/wire-shelving-rack', u: -2.6, v: 6.5 },
    { m: 'cafe/wire-shelving-rack', u: -1.4, v: 6.5 }, { m: 'cafe/table-herb-pot', u: 1.9, v: 4.8, y: 0.92 }, { m: 'cafe/service-counter-module', u: 2.2, v: 4.8 },
    { m: 'cafe/pos-terminal', u: 2.6, v: 4.8, y: 0.92 }, { m: 'hood/trimmed-foundation-shrub', u: 0.2, v: 5.8 }, { m: 'hood/columnar-evergreen-shrub', u: 3.1, v: 6.3, s: 0.8 },
  ],
  // Nail bars: little tables with a chair each side, polish on the shelves.
  salon: [
    G('furniture', -1.6, 2.4, { item: 'desk2' }), G('furniture', -1.6, 1.8, { item: 'dining_chair', ry: Math.PI }), G('furniture', -1.6, 3.0, { item: 'dining_chair' }),
    G('furniture', 1.2, 2.4, { item: 'desk2' }), G('furniture', 1.2, 1.8, { item: 'dining_chair', ry: Math.PI }), G('furniture', 1.2, 3.0, { item: 'dining_chair' }),
    G('shop_shelf', -1.4, 6.6, { size: [1.4, 0.2] }), G('shop_counter', 2.3, 5.2, { size: [0.9, 0.4] }),
    { m: 'office/breakout-sofa', u: -2.9, v: 4.8, ry: HALF_PI }, { m: 'cafe/potted-olive-tree', u: 3.1, v: 6.3 },
  ],
  // Hairdressers: chairs facing the mirrors, a basin to wash at, somewhere to wait.
  salon_hair: [
    G('furniture', -2.0, 6.5, { item: 'mirror_stand' }), G('furniture', 0, 6.5, { item: 'mirror_stand' }),
    { m: 'office/task-chair', u: -2.0, v: 5.6, ry: Math.PI }, { m: 'office/task-chair', u: 0, v: 5.6, ry: Math.PI },
    G('basin', 2.2, 6.5), G('shop_counter', 2.3, 2.4, { size: [0.9, 0.4] }),
    { m: 'office/breakout-sofa', u: -2.9, v: 2.6, ry: HALF_PI }, { m: 'cafe/potted-olive-tree', u: 3.1, v: 1.0 },
  ],
  // Corner shops and pound shops: stocked shelves round the walls and down the middle, the till by the door.
  general: [
    A('stockedShelves', -1.6, 6.5), A('stockedShelves', -1.0, 3.4), A('stockedShelves', -1.0, 4.9, { ry: Math.PI }),
    A('shopCounterTill', 2.1, 2.2), A('drinksFridge', 2.0, 6.3), A('drinksFridge', 2.9, 6.3),
    A('milkCrate', 3.0, 4.6), A('milkCrate', 3.0, 4.6, { y: 0.3 }), A('shoppingBasket', 0.9, 1.0), A('shoppingBasket', 0.9, 1.0, { y: 0.12 }),
  ],
  general_hardware: [
    G('shop_shelf', -1.6, 6.6, { size: [1.8, 0.22] }), G('shop_shelf', -1.0, 3.6, { size: [1.6, 0.22] }), G('workbench', 2.0, 6.3),
    G('shop_counter', 2.3, 2.2, { size: [0.9, 0.4] }), { m: 'cars/oil-drum', u: -3.0, v: 1.2 }, { m: 'cars/tire', u: 0.8, v: 1.3 },
    { m: 'office/delivery-box', u: -2.4, v: 1.2 },
  ],
};

/** Which layout a shop gets: its kind, and for some kinds what the sign says it does. */
export function layoutFor(kind: InteriorKind, label: string): string {
  const t = label.toUpperCase();
  if (kind === 'gym') return /BOXING/.test(t) ? 'gym_boxing' : /WRESTLING|GRAPPLING|KARATE|DOJO|JUDO|MARTIAL/.test(t) ? 'gym_mats' : 'gym';
  if (kind === 'salon') return /HAIR|BARBER/.test(t) ? 'salon_hair' : 'salon';
  if (kind === 'general') return /HARDWARE|DIY/.test(t) ? 'general_hardware' : 'general';
  if (kind === 'takeaway') return /CHIPPY|CHIP|FISH/.test(t) ? 'takeaway_chippy' : /BAKER/.test(t) ? 'takeaway_bakery' : /KEBAB|CHICKEN|GRILL/.test(t) ? 'takeaway_grill' : 'takeaway';
  return kind;
}

/** The shop layouts, for the tests to check nothing stands outside its unit. */
export const INTERIORS_FOR_TEST: Readonly<Record<string, readonly { m: string; u: number; v: number }[]>> = INTERIORS;

/** Sign board colours for each kind of shop: [board, letters]. */
/** Shops that would have a striped awning over the window (not pubs, clubs, banks, offices, showrooms or jewellers). */
const AWNING_KINDS: ReadonlySet<InteriorKind> = new Set(['takeaway', 'cafe', 'general', 'offlicence', 'salon', 'plants', 'furniture', 'gadgets', 'pawn', 'bookies']);

const SIGN_STYLE: Record<InteriorKind, [string, string, boolean?]> = {
  pub: ['#3a1512', '#e8c36a'], club: ['#16081f', '#ff5ac8', true], takeaway: ['#b3261e', '#fff3d6'], cafe: ['#3d2a1c', '#f2e2c4'], bookies: ['#12452a', '#ffffff'],
  gadgets: ['#1c2a4a', '#7fd4ff'], clothes: ['#111111', '#ffffff'], furniture: ['#2f4a3a', '#f2e8d0'], pawn: ['#1a1a1a', '#e2b93b'], jeweller: ['#0f1a2a', '#f2e2b0'], casino: ['#3a0d12', '#ffd75a', true],
  office: ['#2a3340', '#dfe6ee'], gym: ['#16171a', '#e03a2f'], offlicence: ['#5a1a6a', '#ffe94a'], bikes: ['#1d3a1d', '#c8f06a'], cars: ['#10203a', '#ffffff'],
  plants: ['#1f4a2b', '#e6f2d0'], salon: ['#7a2a5a', '#ffe6f2'], general: ['#c0262a', '#ffe94a'],
};

/** Floor tile for each kind of shop. */
const SHOP_FLOOR: Record<InteriorKind, { model: string; scale: number; tint?: string }> = {
  pub: { model: 'cafe/timber-deck-tile', scale: 5 }, club: { model: 'office/carpet-tile', scale: 2.5, tint: '#6a4a7a' }, takeaway: { model: 'cafe/kitchen-resin-floor-tile', scale: 1 },
  cafe: { model: 'cafe/cafe-encaustic-floor-tile', scale: 1 }, bookies: { model: 'office/carpet-tile', scale: 2.5, tint: '#7a9a80' }, gadgets: { model: 'office/access-floor-tile', scale: 2.5 },
  clothes: { model: 'cafe/timber-deck-tile', scale: 5, tint: '#e6e0d6' }, furniture: { model: 'cafe/timber-deck-tile', scale: 5 }, pawn: { model: 'office/carpet-tile', scale: 2.5, tint: '#9a6a5a' }, jeweller: { model: 'office/carpet-tile', scale: 2.5, tint: '#2a3550' },
  casino: { model: 'office/carpet-tile', scale: 2.5, tint: '#a04048' }, office: { model: 'office/carpet-tile', scale: 2.5 }, gym: { model: 'cafe/kitchen-resin-floor-tile', scale: 1, tint: '#7a8088' },
  offlicence: { model: 'cafe/kitchen-resin-floor-tile', scale: 1 }, bikes: { model: 'cafe/kitchen-resin-floor-tile', scale: 1, tint: '#9aa0a4' }, cars: { model: 'office/access-floor-tile', scale: 2.5 },
  plants: { model: 'cafe/kitchen-resin-floor-tile', scale: 1, tint: '#a8b89a' }, salon: { model: 'cafe/cafe-encaustic-floor-tile', scale: 1, tint: '#e8d0dc' }, general: { model: 'cafe/kitchen-resin-floor-tile', scale: 1 },
};

// ---- buildings with solid fronts -----------------------------------------------------------

const SOLID: Partial<Record<FacadeKind, string[]>> = {
  terrace: ['hood/townhouse-row-unit', 'hood/townhouse-row-unit', 'nyc/bldg-walkup-infill'],
  tower: ['nyc/bldg-postwar-apartment', 'nyc/bldg-prewar-apartment'],
  garages: ['hood/detached-garage'],
  warehouse: ['nyc/bldg-loft-warehouse', 'nyc/bldg-auto-garage', 'nyc/bldg-firehouse'],
  dock: ['nyc/bldg-loft-warehouse', 'nyc/bldg-auto-garage'],
  semi: ['hood/two-storey-family-house', 'hood/split-level-house', 'hood/porch-front-cottage', 'hood/single-storey-ranch-house'],
  office: ['nyc/bldg-office-tower', 'nyc/bldg-bank', 'nyc/bldg-setback-tower'],
  club: ['nyc/bldg-movie-palace', 'nyc/bldg-corner-tenement'],
  casino: ['nyc/bldg-movie-palace', 'nyc/bldg-corner-tenement'],
  stand: ['nyc/bldg-public-school', 'nyc/bldg-parking-garage'],
  leisure: ['nyc/bldg-public-school'],
  car_park: ['nyc/bldg-parking-garage'],
  mall: ['nyc/bldg-department-store', 'nyc/bldg-shop-row'],
  precinct: ['nyc/bldg-shop-row', 'nyc/bldg-corner-shop'],
  market: ['nyc/bldg-shop-row', 'nyc/bldg-corner-shop', 'nyc/bldg-walkup-infill'],
  ruin: ['nyc/bldg-loft-warehouse', 'nyc/bldg-tenement', 'nyc/bldg-auto-garage'],
  fortress: ['nyc/bldg-bank', 'nyc/bldg-setback-tower', 'nyc/bldg-prewar-apartment'],
  platform: ['nyc/bldg-tenement', 'nyc/bldg-corner-tenement', 'nyc/bldg-walkup-infill', 'nyc/bldg-brownstone'],
  subway: ['nyc/bldg-tenement', 'nyc/bldg-loft-warehouse', 'nyc/bldg-walkup-infill', 'nyc/bldg-brownstone'],
  shop: ['nyc/bldg-shop-row', 'nyc/bldg-corner-shop', 'nyc/bldg-walkup-infill'],
  pub: ['nyc/bldg-corner-shop', 'nyc/bldg-brownstone'],
  showroom: ['nyc/bldg-auto-garage', 'nyc/bldg-shop-row'],
  gym_front: ['nyc/bldg-firehouse', 'nyc/bldg-auto-garage'],
  containers: ['nyc/bldg-auto-garage', 'nyc/bldg-loft-warehouse'],
  house_front: ['hood/two-storey-family-house'],
};

const SKYLINE: Record<'low' | 'city', string[]> = {
  low: ['nyc/bldg-tenement', 'nyc/bldg-brownstone', 'nyc/bldg-walkup-infill', 'nyc/bldg-loft-warehouse', 'nyc/bldg-corner-tenement'],
  city: ['nyc/bldg-office-tower', 'nyc/bldg-setback-tower', 'nyc/bldg-postwar-apartment', 'nyc/bldg-prewar-apartment', 'nyc/bldg-department-store', 'nyc/bldg-office-tower'],
};

/** Sign colours for named buildings with solid fronts. */
const PLAIN_SIGN: [string, string] = ['#20242c', '#e8e2d4'];

// ---- kit models standing in for props -------------------------------------------------------

interface PropModel {
  models: string[];
  /** Extra turn so the model's long side runs the way the prop's does. */
  ry?: number;
  /** 'fit' scales the model to the prop's collision box; 'natural' keeps its own size (it is already close). */
  size?: 'fit' | 'natural';
  paints?: string[];
  tint?: string;
  /** Several copies along the prop's length. */
  repeat?: number;
}

const CAR_PAINTS = ['#c8ccd0', '#1c1e22', '#f2f2ee', '#27457a', '#8c1d1d', '#5c6068', '#2e5a3c', '#a8a290'];

const PROP_MODELS: Partial<Record<PropKind, PropModel>> = {
  bin: { models: ['hood/roll-out-wheelie-bin'], size: 'natural' },
  skip: { models: ['nyc/prop-dumpster'], tint: '#e0b83a' },
  dumpster: { models: ['nyc/prop-dumpster'] },
  car: { models: ['cars/hatchback-80s', 'nyc/veh-compact-car', 'hood/family-crossover-suv', 'cars/boxy-sedan-70s', 'nyc/veh-town-car', 'cars/station-wagon-70s'], ry: HALF_PI, paints: CAR_PAINTS },
  abandoned_car: { models: ['cars/boxy-sedan-70s', 'cars/wedge-coupe-80s'], ry: HALF_PI, paints: ['#5a4a40', '#4a4f52'], tint: '#9a928a' },
  van: { models: ['hood/family-minivan', 'cars/camper-van'], ry: HALF_PI, paints: ['#f2f2ee', '#c8ccd0', '#27457a'] },
  bus: { models: ['nyc/veh-bus'], ry: HALF_PI, paints: ['#b3261e'] },
  phonebox: { models: ['cars/phone-booth'], tint: '#e04a40' },
  busstop: { models: ['nyc/prop-bus-shelter'] },
  bench: { models: ['nyc/prop-bench'] },
  barrier: { models: ['nyc/prop-barricade'] },
  drum: { models: ['cars/oil-drum'], size: 'natural' },
  cone: { models: ['nyc/prop-traffic-cone'], size: 'natural' },
  bollard: { models: ['nyc/prop-bollard'], size: 'natural' },
  bollard_dock: { models: ['nyc/prop-bollard'], size: 'natural' },
  bollard_row: { models: ['nyc/prop-bollard'], size: 'natural', repeat: 4 },
  planter: { models: ['cars/planter'] },
  mall_planter: { models: ['office/planter-divider', 'cafe/planter-trough-divider'] },
  bike_rack: { models: ['nyc/prop-bike-rack'] },
  lamp_post: { models: ['nyc/prop-globe-lamp'], size: 'natural' },
  traffic_light: { models: ['cars/traffic-light'], size: 'natural' },
  sign_post: { models: ['hood/street-sign-post'], size: 'natural' },
  kiosk: { models: ['nyc/prop-newsstand'] },
  market_stall: { models: ['nyc/prop-newsstand', 'nyc/prop-hotdog-cart'] },
  trolley: { models: ['cafe/bus-tub-trolley'] },
  vending: { models: ['cafe/drinks-fridge'] },
  fountain: { models: ['hood/garden-birdbath'] },
  pillar: { models: ['office/column-casing'] },
  turnstile: { models: ['office/access-gate'] },
  crates: { models: ['office/delivery-box'] },
  cardboard: { models: ['office/delivery-box'] },
};

/**
 * An approved model in place of a level prop (or as architecture), with the slot it has to fit: the prop's own
 * collision box (`fit`, half sizes). LevelView draws it at its real size, shrunk only if that slot is too small.
 */
export interface ApprovedPlacement {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  fit?: { hx: number; hz: number };
  /** Stock behind shop glass: baked without shadows. */
  indoor?: boolean;
  /** Per-axis scale (an awning stretched to its shopfront, a downpipe to its eaves); real size if left out. */
  scale?: [number, number, number];
  /** Repaint one colour of the model, e.g. an awning's stripes in the shop's own colour: [from, to] hex. */
  recolour?: [string, string][];
}

/**
 * Street props drawn with the owner's approved British models (src/render/approved/registry.ts) instead of the
 * city kit's, where the approved one is the better and the right thing (a K6 kiosk, not a US phone booth).
 * Choices between several are picked per prop, the same every visit. Kept on the kit: the kiosk (the approved
 * rack is no kiosk), the planter (18k triangles for now), vehicles, fountains, pillars and turnstiles.
 */
const APPROVED_STREET: Partial<Record<PropKind, { ids: readonly string[]; repeat?: number }>> = {
  phonebox: { ids: ['telephoneBox'] },
  postbox: { ids: ['pillarPostBox'] },
  busstop: { ids: ['busShelter'] },
  lamp_post: { ids: ['streetLamp'] },
  sign_post: { ids: ['roadSign'] },
  traffic_light: { ids: ['trafficLight'] },
  bench: { ids: ['parkBench'] },
  bike_rack: { ids: ['bikeRack'] },
  bin: { ids: ['wheelieBinBlack', 'wheelieBinGreen', 'wheelieBinBlue', 'wheelieBinBrown'] },
  bollard: { ids: ['bollard'] },
  bollard_dock: { ids: ['bollard'] },
  bollard_row: { ids: ['bollard'], repeat: 4 },
  atm: { ids: ['cashMachine'] },
  vending: { ids: ['vendingMachine'] },
  market_stall: { ids: ['marketStall'] },
  skip: { ids: ['skipBin'] },
  dumpster: { ids: ['dumpster'] },
  cone: { ids: ['trafficCone'] },
  barrier: { ids: ['roadBarrier'] },
  trolley: { ids: ['shoppingTrolley'] },
  drum: { ids: ['oilDrum'] },
  crates: { ids: ['woodenCrate'] },
  cardboard: { ids: ['cardboardBox'] },
  rubbish_bags: { ids: ['rubbishBags'] },
  pallets: { ids: ['palletStack'] },
  scrap: { ids: ['scrapHeap'] },
  container: { ids: ['shippingContainer'] },
};

/** Street furniture that belongs on paving. Where one stands out in the road, the pavement is built out round it. */
const PAVEMENT_PROPS: ReadonlySet<PropKind> = new Set([
  'bin', 'bench', 'planter', 'mall_planter', 'bollard', 'bollard_row', 'bollard_dock', 'phonebox', 'vending', 'kiosk', 'market_stall', 'fountain', 'pillar', 'turnstile',
  'bike_rack', 'lamp_post', 'traffic_light', 'sign_post', 'postbox', 'busstop', 'atm', 'trolley', 'crates', 'cardboard', 'pallets', 'rubbish_bags', 'drum', 'escalator',
]);

// ---- the plan ---------------------------------------------------------------------------------

/** True where the kits draw this district (the outdoor districts of the long street). */
export function kitStreet(level: LevelDef): boolean {
  return onStrip(level.id) && !!DISTRICTS[level.id];
}

/** Where the kerb is on this district's street (z), or null where there's no road. For pedestrians. */
export function kerbFor(level: LevelDef): number | null {
  if (!kitStreet(level)) return null;
  const g = DISTRICTS[level.id]?.ground;
  return g === 'street' || g === 'suburb' ? KERB_Z : null;
}

/** Props that are vehicles (parked on the road in front of the fight, they fade when you walk behind). */
const VEHICLES = new Set<string>(['car', 'homecar', 'van', 'abandoned_car']);

export function planStreet(level: LevelDef): StreetPlan {
  const d = DISTRICTS[level.id];
  if (!d) throw new Error(`street plan: ${level.id} is not on the street`);
  const { minX, maxX, minZ, maxZ } = level.bounds;
  const near = stripNeighbours(level.id);
  const back = minZ - 0.55;
  const front = maxZ + 0.4;
  const x0 = near.left ? minX : minX - STREET_EXTENT;
  const x1 = near.right ? maxX : maxX + STREET_EXTENT;
  const hasRoad = kerbFor(level) !== null;
  const plan: StreetPlan = {
    area: level.id, back, kerbZ: hasRoad ? KERB_Z : null, front, x0, x1, ground: d.ground,
    placements: [], blocks: [], signs: [], surfaces: [], shopfronts: [], goods: [], approved: [], propDone: level.props.map(() => false), doors: [],
  };
  const rng = new Rng(hash(`street:${level.id}`));
  const put = (model: string, x: number, y: number, z: number, o: Partial<Placement> = {}): void => {
    size(model);
    plan.placements.push({ model, x, y, z, ry: 0, sx: 1, sy: 1, sz: 1, ...o });
  };

  /** Covers a rectangle with a tile model, stretched slightly so whole tiles fit exactly. */
  const tile = (kind: SurfaceKind, model: string, ax0: number, ax1: number, az0: number, az1: number, o: { y?: number; scale?: number; tint?: string; ry?: number } = {}): void => {
    if (ax1 - ax0 < 0.02 || az1 - az0 < 0.02) return;
    plan.surfaces.push({ kind, x0: ax0, x1: ax1, z0: az0, z1: az1 });
    const s = size(model);
    const turned = Math.abs((o.ry ?? 0) % Math.PI) > 0.1;
    const tw = (turned ? s.d : s.w) * (o.scale ?? 1);
    const td = (turned ? s.w : s.d) * (o.scale ?? 1);
    const nx = Math.max(1, Math.round((ax1 - ax0) / tw));
    const nz = Math.max(1, Math.round((az1 - az0) / td));
    const cw = (ax1 - ax0) / nx;
    const cd = (az1 - az0) / nz;
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        // A turned tile's own x runs across the street, so its scales swap.
        const along = cw / (turned ? s.d : s.w);
        const across = cd / (turned ? s.w : s.d);
        put(model, ax0 + cw * (i + 0.5), o.y ?? 0, az0 + cd * (k + 0.5), { ry: o.ry ?? 0, sx: turned ? across : along, sz: turned ? along : across, tint: o.tint });
      }
    }
  };

  // ---- ground -----------------------------------------------------------------------------
  const far = front + 6.4;
  if (d.ground === 'street' || d.ground === 'suburb') {
    const suburb = d.ground === 'suburb';
    const paving = d.pavement ?? (suburb ? 'hood/sidewalk-slab-tile' : 'nyc/tile-sidewalk');
    tile('pavement', paving, x0, x1, back, KERB_Z, { y: size(paving).h > 0.01 ? -size(paving).h : 0 });
    // Kerb stones, then the parking lane with its dashed edge line, then the carriageway.
    plan.surfaces.push({ kind: 'kerb', x0, x1, z0: KERB_Z, z1: KERB_Z + KERB_DEPTH });
    {
      const s = size('nyc/curb-strip');
      const n = Math.max(1, Math.round((x1 - x0) / s.w));
      const cw = (x1 - x0) / n;
      for (let i = 0; i < n; i++) put('nyc/curb-strip', x0 + cw * (i + 0.5), 0, KERB_Z + KERB_DEPTH / 2, { sx: cw / s.w, sy: 0.6 });
    }
    tile('road', 'cars/lane-marking-decal', x0, x1, KERB_Z + KERB_DEPTH, KERB_Z + KERB_DEPTH + 4, { y: -0.02 });
    tile('road', 'cars/road-tile', x0, x1, KERB_Z + KERB_DEPTH + 4, far, { y: -0.05 });
    // Double yellow lines along the kerb.
    plan.blocks.push({ x: (x0 + x1) / 2, y: 0.006, z: KERB_Z + KERB_DEPTH + 0.14, w: x1 - x0, h: 0.012, d: 0.07, colour: '#d9b521' });
    plan.blocks.push({ x: (x0 + x1) / 2, y: 0.006, z: KERB_Z + KERB_DEPTH + 0.29, w: x1 - x0, h: 0.012, d: 0.07, colour: '#d9b521' });
    // Drains in the gutter and covers in the road.
    // UK utility covers (approved), sat into the road with just their rim proud.
    for (let x = x0 + 9 + rng.next() * 6; x < x1 - 4; x += 22 + rng.next() * 8) plan.approved.push({ id: 'manholeCover', x, y: -0.075, z: KERB_Z + KERB_DEPTH + 1.9 + rng.next(), ry: 0 });
  } else {
    // Districts with no pavement and kerb of their own (a precinct, a lane, a yard, a quay) keep
    // their ground where you walk, then a kerb and the road carry on in front, so the road runs
    // the whole length of the city.
    const edge = front;
    if (d.ground === 'plaza') {
      tile('plaza', d.pavement ?? 'nyc/tile-plaza', x0, x1, back, edge, { y: d.pavement && size(d.pavement).h > 0.01 ? -size(d.pavement).h : 0 });
    } else if (d.ground === 'lane') {
      tile('cobbles', 'nyc/tile-plaza', x0, x1, back, edge, { tint: '#8c8780', scale: 0.5 });
    } else if (d.ground === 'yard') {
      tile('yard', 'hood/driveway-slab-tile', x0, x1, back, edge, { y: -0.05, tint: '#b9b6ae' });
    } else {
      // A quay: paving out to a timber fender along the old quay edge.
      tile('yard', 'hood/driveway-slab-tile', x0, x1, back, edge - 0.4, { y: -0.05, tint: '#aeb0ac' });
      tile('deck', 'cafe/timber-deck-tile', x0, x1, edge - 0.4, edge, { scale: 2, y: -0.02 });
    }
    plan.surfaces.push({ kind: 'kerb', x0, x1, z0: edge, z1: edge + KERB_DEPTH });
    {
      const s = size('nyc/curb-strip');
      const n = Math.max(1, Math.round((x1 - x0) / s.w));
      const cw = (x1 - x0) / n;
      for (let i = 0; i < n; i++) put('nyc/curb-strip', x0 + cw * (i + 0.5), 0, edge + KERB_DEPTH / 2, { sx: cw / s.w, sy: 0.6 });
    }
    tile('road', 'cars/lane-marking-decal', x0, x1, edge + KERB_DEPTH, edge + KERB_DEPTH + 4, { y: -0.02 });
    tile('road', 'cars/road-tile', x0, x1, edge + KERB_DEPTH + 4, far + 4, { y: -0.05 });
    plan.blocks.push({ x: (x0 + x1) / 2, y: 0.006, z: edge + KERB_DEPTH + 0.14, w: x1 - x0, h: 0.012, d: 0.07, colour: '#d9b521' });
    plan.blocks.push({ x: (x0 + x1) / 2, y: 0.006, z: edge + KERB_DEPTH + 0.29, w: x1 - x0, h: 0.012, d: 0.07, colour: '#d9b521' });
  }

  // ---- props ------------------------------------------------------------------------------
  level.props.forEach((p, i) => {
    const [hx, hz] = propHalf(p);
    // Street furniture standing out past the kerb: build the pavement out round it.
    if (hasRoad && PAVEMENT_PROPS.has(p.kind) && p.z + hz > KERB_Z && p.solid !== false) {
      const bx0 = Math.max(x0, p.x - hx - 0.7);
      const bx1 = Math.min(x1, p.x + hx + 0.7);
      const bz1 = Math.min(front, p.z + hz + 0.45);
      tile('pavement', d.ground === 'suburb' ? 'hood/sidewalk-slab-tile' : 'nyc/tile-sidewalk', bx0, bx1, KERB_Z - 0.02, bz1, { y: d.ground === 'suburb' ? -0.04 : 0.012 });
      const s = size('nyc/curb-strip');
      put('nyc/curb-strip', (bx0 + bx1) / 2, 0.012, bz1 + KERB_DEPTH / 2, { sx: (bx1 - bx0 + 2 * KERB_DEPTH) / s.w, sy: 0.6 });
      put('nyc/curb-strip', bx0 - KERB_DEPTH / 2, 0.012, (KERB_Z + bz1) / 2 + KERB_DEPTH / 2, { ry: HALF_PI, sx: (bz1 - KERB_Z) / s.w, sy: 0.6 });
      put('nyc/curb-strip', bx1 + KERB_DEPTH / 2, 0.012, (KERB_Z + bz1) / 2 + KERB_DEPTH / 2, { ry: HALF_PI, sx: (bz1 - KERB_Z) / s.w, sy: 0.6 });
      plan.surfaces.push({ kind: 'kerb', x0: bx0 - KERB_DEPTH, x1: bx1 + KERB_DEPTH, z0: bz1, z1: bz1 + KERB_DEPTH });
    }
    const ap = p.item ? undefined : APPROVED_STREET[p.kind];
    if (ap) {
      const prng = new Rng(hash(`${level.id}:prop:${i}:${p.kind}`));
      const id = pick(prng, ap.ids);
      const ry = ((p.turned ? 1 : 0) + (p.rot ?? 0)) * HALF_PI;
      const copies = ap.repeat ?? 1;
      for (let c = 0; c < copies; c++) {
        const cx = copies === 1 ? p.x : p.x - hx + ((c + 0.5) * hx * 2) / copies;
        plan.approved.push({ id, x: cx, y: 0, z: p.z, ry, fit: { hx: hx / copies, hz } });
      }
      plan.propDone[i] = true;
      return;
    }
    const pm = PROP_MODELS[p.kind];
    if (!pm || p.item) return;
    const prng = new Rng(hash(`${level.id}:prop:${i}:${p.kind}`));
    const model = pick(prng, pm.models);
    const s = size(model);
    const quarter = (p.turned ? 1 : 0) + (p.rot ?? 0);
    const ry = (pm.ry ?? 0) + quarter * HALF_PI;
    // The model's footprint once turned, against the prop's collision box.
    const swap = Math.abs(Math.sin(ry)) > 0.7;
    const mw = swap ? s.d : s.w;
    const md = swap ? s.w : s.d;
    const copies = pm.repeat ?? 1;
    let k = 1;
    if ((pm.size ?? 'fit') === 'fit') k = Math.max(0.55, Math.min(1.35, Math.min((hx * 2) / copies / mw, (hz * 2) / md) * 1.02));
    const paint = pm.paints ? pick(prng, pm.paints) : undefined;
    for (let c = 0; c < copies; c++) {
      const cx = copies === 1 ? p.x : p.x - hx + ((c + 0.5) * hx * 2) / copies;
      const own = VEHICLES.has(p.kind) && p.z > 0.6 ? `vehicle:${i}:${c}` : undefined;
      put(model, cx, 0, p.z, { ry, sx: k, sy: k, sz: k, paint, tint: pm.tint ?? p.colour, own });
    }
    plan.propDone[i] = true;
  });

  // ---- buildings ----------------------------------------------------------------------------
  const facades = [...level.facades].filter((f) => f.x1 - f.x0 > 0.05).sort((a, b) => a.x0 - b.x0);
  if (facades.length) {
    // Carry the end buildings on past an open end of the street, so the camera never sees a gap.
    const first = facades[0];
    const last = facades[facades.length - 1];
    const run: FacadeDef[] = [];
    if (first.x0 > x0 + 0.05) run.push({ ...first, x0, x1: first.x0, label: undefined });
    run.push(...facades);
    if (last.x1 < x1 - 0.05) run.push({ ...last, x0: last.x1, x1, label: undefined });
    // Gaps in the frontage where stairs go down to the subway (LevelView draws the stairwell there).
    const gaps = level.exits.filter((e) => isSubwayStairs(level, e)).map((e) => [e.x - SUBWAY_GAP, e.x + SUBWAY_GAP] as const);
    if (gaps.length) {
      const cut: FacadeDef[] = [];
      for (const f of run) {
        let pieces: FacadeDef[] = [f];
        for (const [g0, g1] of gaps) {
          pieces = pieces.flatMap((p) => (g1 <= p.x0 || g0 >= p.x1 ? [p] : [{ ...p, x1: g0 }, { ...p, x0: g1, label: undefined }]).filter((q) => q.x1 - q.x0 > 1.2));
        }
        cut.push(...pieces);
      }
      run.splice(0, run.length, ...cut);
    }
    let prev = '';
    for (const f of run) {
      const label = f.label && f.label !== 'back' ? f.label : '';
      const doors = level.exits.filter((e) => e.kind === 'door' && e.x > f.x0 && e.x < f.x1).map((e) => e.x);
      const frng = new Rng(hash(`${level.id}:${f.kind}:${Math.round(f.x0 * 10)}`));
      if (f.kind === 'fence' || f.kind === 'hoarding') {
        fence(f, frng, doors);
      } else if (f.kind === 'house_front') {
        house(f, doors);
      } else if (label && SHOP_KINDS.has(f.kind)) {
        shops(f, label, doors, frng);
      } else {
        prev = solid(f, label, frng, prev);
      }
    }
  }

  /** A run of buildings with solid fronts, stretched slightly so they fill the frontage exactly. */
  function solid(f: FacadeDef, label: string, frng: Rng, prev: string): string {
    const palette = d!.solid?.[f.kind] ?? SOLID[f.kind] ?? ['nyc/bldg-tenement', 'nyc/bldg-walkup-infill'];
    const span = f.x1 - f.x0;
    const chosen: string[] = [];
    let left = span;
    let guard = 0;
    while (left > 1.6 && guard++ < 40) {
      let options = palette.filter((m) => size(m).w <= left * 1.3);
      if (!options.length) options = [[...palette].sort((a, b) => size(a).w - size(b).w)[0]];
      // Never two of the same building side by side: if only the last one fits, take another and let it stretch.
      let fresh = options.filter((m) => m !== prev);
      if (!fresh.length) fresh = palette.filter((m) => m !== prev).sort((a, b) => size(a).w - size(b).w).slice(0, 1);
      // A stock of one: break the run with a narrow infill building.
      if (!fresh.length && prev !== 'nyc/bldg-walkup-infill' && !/townhouse-row-unit|detached-garage/.test(prev)) fresh = ['nyc/bldg-walkup-infill'];
      const m = pick(frng, fresh.length ? fresh : options);
      chosen.push(m);
      prev = m;
      left -= size(m).w;
    }
    if (!chosen.length) chosen.push([...palette].sort((a, b) => size(a).w - size(b).w)[0]);
    const total = chosen.reduce((n, m) => n + size(m).w, 0);
    const k = span / total;
    let x = f.x0;
    const dark = f.kind === 'ruin';
    for (const m of chosen) {
      const s = size(m);
      put(m, x - s.minX * k, 0, back - s.foot, { sx: k, tint: dark ? pick(frng, ['#6a6460', '#5c5855', '#74706a']) : pick(frng, d!.tints) });
      // A derelict front is boarded and scaffolded.
      if (dark && s.w * k > 7 && frng.chance(0.6)) put('nyc/prop-scaffold', x + (s.w * k) / 2, 0, back - 0.9, { sx: Math.min(1.6, (s.w * k) / 5), tint: '#8a8680' });
      x += s.w * k;
    }
    if (label) {
      const [bg, fg] = PLAIN_SIGN;
      const w = Math.min(span - 0.8, Math.max(3.2, label.length * 0.36));
      plan.signs.push({ x: (f.x0 + f.x1) / 2, y: 3.5, z: back + 0.08, w, h: 0.6, text: label, bg: f.colour ?? bg, fg: f.colour ? readable(f.colour) : fg });
    }
    return prev;
  }

  /**
   * A fence run from the approved expansion, its gate always of the same make: galvanised palisade round yards,
   * docks and works; chain-link on estates and back streets; close-board timber in the suburbs. Rough districts mix
   * in damaged panels of the same kind (sagging wire, missing boards; a broken timber gate). A way through the fence
   * (an exit door) is drawn as the gate itself, never a door in the fence; a suburb fence with a way through is
   * palisade, as there's no sound timber gate. A long run with no exit gets a gate in the middle where there is one.
   */
  function approvedFence(f: FacadeDef, frng: Rng, doors: number[]): void {
    const yard = d!.ground === 'yard' || d!.ground === 'quay';
    const rough = d!.tints === GRIT || d!.tints === DARK || level.theme === 'estate' || level.theme === 'alleys';
    const make: 'palisade' | 'chain' | 'timber' = yard || (d!.ground === 'suburb' && doors.length) ? 'palisade' : d!.ground === 'suburb' ? 'timber' : 'chain';
    const SET = {
      palisade: { panel: 'palisadeFence', worn: 'palisadeFence', gate: 'palisadeGate' as string | null },
      chain: { panel: 'chainLinkFence', worn: 'poorChainLinkFence', gate: 'chainLinkGate' as string | null },
      timber: { panel: 'timberFence', worn: 'poorTimberFence', gate: rough ? 'poorTimberGate' : null },
    }[make];
    const W: Record<string, number> = {
      palisadeFence: 3.17, timberFence: 2.87, chainLinkFence: 3.15, poorTimberFence: 2.87, poorChainLinkFence: 3.15,
      palisadeGate: 1.88, chainLinkGate: 1.61, poorTimberGate: 1.22,
    };
    const gates = doors.length ? doors : SET.gate && f.x1 - f.x0 > 6 ? [(f.x0 + f.x1) / 2] : [];
    const gw = SET.gate ? W[SET.gate] : 0;
    // The runs of panel between the gates.
    const cuts = [f.x0, ...gates.flatMap((x) => [x - gw / 2, x + gw / 2]), f.x1];
    for (const x of gates) {
      if (!SET.gate) break;
      plan.approved.push({ id: SET.gate, x, y: 0, z: back - 0.12, ry: 0 });
      plan.doors.push(x);
    }
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const [a, b] = [cuts[i], cuts[i + 1]];
      const len = b - a;
      if (len < 0.4) continue;
      const n = Math.max(1, Math.round(len / W[SET.panel]));
      const cw = len / n;
      for (let k = 0; k < n; k++) {
        const id = rough && frng.chance(0.4) ? SET.worn : SET.panel;
        plan.approved.push({ id, x: a + cw * (k + 0.5), y: 0, z: back - 0.12, ry: 0, scale: [cw / W[id], 1, 1] });
      }
    }
  }

  /** Fences and hoardings: panels along the building line, with yards and far buildings behind. */
  function fence(f: FacadeDef, frng: Rng, doors: number[] = []): void {
    const span = f.x1 - f.x0;
    if (f.kind === 'hoarding') {
      const model = 'nyc/prop-hoarding-panel';
      const s = size(model);
      const n = Math.max(1, Math.round(span / s.w));
      const cw = span / n;
      for (let i = 0; i < n; i++) put(model, f.x0 + cw * (i + 0.5), 0, back - s.maxZ, { sx: cw / s.w });
    } else approvedFence(f, frng, doors);
    plan.surfaces.push({ kind: 'garden', x0: f.x0, x1: f.x1, z0: back - 9, z1: back });
    tile('garden', 'hood/driveway-slab-tile', f.x0, f.x1, back - 9, back, { y: -0.05, tint: f.kind === 'hoarding' ? '#8a8478' : '#7f9068' });
    plan.surfaces.pop();
    if (f.kind === 'hoarding') {
      if (span > 7) put('nyc/prop-scaffold', (f.x0 + f.x1) / 2, 0, back - 2.4, { sx: Math.min(2, span / 6), sy: 1.4, tint: '#8a8680' });
    } else {
      for (let x = f.x0 + 2 + frng.next() * 2; x < f.x1 - 1.5; x += 5 + frng.next() * 4) {
        put(frng.chance(0.5) ? 'hood/broad-canopy-shade-tree' : 'hood/ornamental-front-yard-tree', x, 0, back - 3 - frng.next() * 3, { sx: 0.9, sy: 0.9 + frng.next() * 0.3, sz: 0.9, ry: frng.next() * 6 });
      }
    }
    // Something to see beyond the fence.
    const behind = pick(frng, SKYLINE.low);
    const bs = size(behind);
    if (span > bs.w * 0.7) put(behind, (f.x0 + f.x1) / 2, 0, back - 9 - bs.foot, { sx: Math.min(1.4, span / bs.w), tint: pick(frng, d!.tints) });
  }

  /** Your house: a family house with its front door where the game's door is, a hedge, a gate and a drive. */
  function house(f: FacadeDef, doors: number[]): void {
    const model = 'hood/two-storey-family-house';
    const s = size(model);
    const doorX = doors[0] ?? (f.x0 + f.x1) / 2;
    const hx = Math.max(f.x0 + s.w / 2, Math.min(f.x1 - s.w / 2, doorX));
    put(model, hx, 0, back - s.foot, { tint: '#f2e2d0' });
    plan.doors.push(doorX);
    // Whatever frontage is left either side is hedge, with the garage beyond on the wider side.
    const sides: [number, number][] = [[f.x0, hx - s.w / 2], [hx + s.w / 2, f.x1]];
    for (const [a, b] of sides) {
      if (b - a < 0.4) continue;
      const g = size('hood/detached-garage');
      if (b - a >= g.w * 0.45) put('hood/detached-garage', (a + b) / 2, 0, back - g.foot - 0.6, { sx: Math.min(1, (b - a) / g.w), tint: '#f2e2d0' });
      else {
        const h = size('hood/clipped-boundary-hedge-run');
        put('hood/clipped-boundary-hedge-run', (a + b) / 2, 0, back - h.maxZ, { sx: (b - a) / h.w });
      }
    }
    if (f.label) plan.signs.push({ x: doorX + 0.9, y: 1.6, z: back + 0.05, w: 0.36, h: 0.3, text: f.label, bg: '#1d2b22', fg: '#e8e2c8' });
  }

  /** Shops you can see into: open-fronted units, glazed across, with the right things inside and the name over the door. */
  function shops(f: FacadeDef, label: string, doors: number[], frng: Rng): void {
    // Its own random stream, so adding awnings leaves every other choice on the street as it was.
    const awningRng = new Rng(hash(`${level.id}:awning:${Math.round(f.x0 * 10)}`));
    const span = f.x1 - f.x0;
    const kind = interiorFor(f.kind, label);
    // How many units: near 8.6 m each, but pick the count that leaves every door clear of the piers between units.
    const ideal = Math.max(1, Math.round(span / 8.6));
    const clearOfPiers = (count: number): number => {
      const w = span / count;
      return Math.min(1e3, ...doors.map((x) => {
        const into = (x - f.x0) % w;
        return Math.min(into, w - into) - (0.5 * w) / SHELL_W;
      }));
    };
    let n = ideal;
    for (const c of [ideal, ideal + 1, ideal - 1]) {
      if (c < 1 || span / c < 6.2 || span / c > 11.5) continue;
      if (clearOfPiers(c) > clearOfPiers(n) + 0.2 && clearOfPiers(n) < 1.0) n = c;
    }
    const cw = span / n;
    const k = cw / SHELL_W;
    const tint = pick(frng, d!.tints);
    const contents: string[] = [];
    const floor = SHOP_FLOOR[kind];
    for (let c = 0; c < n; c++) {
      const cx = f.x0 + cw * (c + 0.5);
      put(d!.shell ?? SHELL, cx, 0, back - SHELL_DEPTH / 2, { sx: k, tint });
      // The shop floor, a step up from the pavement.
      tile('shopfloor', floor.model, cx - 3.62 * k, cx + 3.62 * k, back - 7.3, back - 0.34, { y: 0.1, scale: floor.scale, tint: floor.tint });
      // What is inside. A wide shop repeats its layout, mirrored in alternate units so it doesn't look stamped.
      const mirror = c % 2 === 1 ? -1 : 1;
      for (const it of INTERIORS[layoutFor(kind, label)]) {
        const sc = it.s ?? 1;
        const x = cx + it.u * mirror * k;
        const z = back - 0.34 - it.v;
        if (it.a) plan.approved.push({ id: it.a, x, y: 0.15 + (it.y ?? 0), z, ry: (it.ry ?? 0) * mirror, indoor: true });
        else if (it.g) plan.goods.push({ prop: { ...it.g, x, z }, ry: (it.ry ?? 0) * mirror, y: 0.15 + (it.y ?? 0) });
        else put(it.m, x, 0.15 + (it.y ?? 0), z, { ry: (it.ry ?? 0) * mirror, sx: sc, sy: sc, sz: sc, paint: it.paint });
        contents.push(it.m);
      }
      // Glass across the front, with a gap where the door is.
      const open0 = cx - 3.5 * k;
      const open1 = cx + 3.5 * k;
      // A door close to a pier still gets its gap, as near to it as the opening allows.
      const mine = doors.find((x) => x >= cx - cw / 2 && x < cx + cw / 2);
      const door = mine === undefined ? undefined : Math.max(open0 + 0.75, Math.min(open1 - 0.75, mine));
      const glass = (a: number, b: number): void => {
        if (b - a < 0.25) return;
        const g = size('cafe/glazed-shopfront-screen');
        const m = Math.max(1, Math.round((b - a) / 2.1));
        const w = (b - a) / m;
        for (let i = 0; i < m; i++) put('cafe/glazed-shopfront-screen', a + w * (i + 0.5), 0.1, back - g.maxZ, { sx: w / g.w, sy: 2.82 / g.h });
      };
      if (door !== undefined) {
        glass(open0, door - 0.7);
        glass(door + 0.7, open1);
        plan.doors.push(mine!);
      } else glass(open0, open1);
      // A striped awning (approved) over the glass of shops that would have one, in the shop's own colour: its
      // back rail fixed to the wall just under the fascia, the valance at 2.7 m, clear of everyone's head.
      if (AWNING_KINDS.has(kind) && awningRng.chance(0.75)) {
        const span = open1 - open0 + 0.3;
        plan.approved.push({ id: 'shopAwning', x: cx, y: 2.55, z: back + 0.72, ry: 0, scale: [span / 2.76, 1, 1], recolour: [['#b12e2a', f.colour ?? SIGN_STYLE[kind][0]]] });
      }
    }
    // A pub hangs its sign out: bracketed to the wall at the end of the frontage, under the fascia, in its colour.
    if (kind === 'pub') plan.approved.push({ id: 'pubHangingSign', x: f.x0 + 0.32, y: 1.0, z: back + 0.05, ry: 0, recolour: [['#36664b', f.colour ?? SIGN_STYLE[kind][0]]] });
    const [bg, fg, neon] = SIGN_STYLE[kind];
    const w = Math.min(span - 0.6, Math.max(3.4, label.length * 0.4));
    plan.signs.push({ x: (f.x0 + f.x1) / 2, y: 3.56, z: back + 0.1, w, h: 0.66, text: label, bg: f.colour ?? bg, fg: f.colour ? readable(f.colour) : fg, neon: !!neon });
    plan.shopfronts.push({ label, kind, x0: f.x0, x1: f.x1, contents });
  }

  // ---- behind the front row: the skyline ---------------------------------------------------------
  if (d.skyline !== 'none') {
    const srng = new Rng(hash(`${level.id}:skyline`));
    let x = x0 - 4;
    while (x < x1 + 4) {
      const m = pick(srng, SKYLINE[d.skyline]);
      const s = size(m);
      const k = 0.9 + srng.next() * 0.35;
      put(m, x - s.minX * k, 0, back - 24 - srng.next() * 10 - s.foot, { sx: k, sy: 0.85 + srng.next() * 0.4, sz: 1, tint: pick(srng, DARK) });
      x += s.w * k + 1 + srng.next() * 5;
    }
  }

  // ---- street lamps and trees ------------------------------------------------------------------
  // Lit roads and suburbs get the approved British column at the kerb, its arm out over the road (and a glowing
  // lens under its head, as the kit lamps have). Never on the building line: shopfronts stand forward of it, so a
  // column there ended up inside the shop. Plazas, lanes and yards keep their own lights.
  const ukLamp = d.ground === 'street' || d.ground === 'suburb';
  for (const l of level.lights) {
    if (ukLamp) {
      plan.approved.push({ id: 'streetLamp', x: l.x, y: 0, z: LAMP_Z, ry: -HALF_PI });
      plan.blocks.push({ x: l.x, y: 4.13, z: LAMP_Z + 1.12, w: 0.2, h: 0.05, d: 0.32, colour: '#fff1d0', glow: true });
      continue;
    }
    const s = size(d.lamp);
    // The lamp stands on the building line, clear of where anyone walks, with its head out over the pavement.
    const tall = s.h > 6.5;
    put(d.lamp, l.x, 0, back + 0.18, { ry: d.lamp === 'nyc/prop-globe-lamp' ? 0 : -HALF_PI, sx: tall ? 0.72 : 0.9, sy: tall ? 0.72 : 0.9, sz: tall ? 0.72 : 0.9 });
  }
  if (d.trees) {
    // Trees stand in pits at the foot of the buildings, between doorways and shop windows, never where anyone walks.
    for (let x = x0 + 6 + rng.next() * 5; x < x1 - 4; x += 17 + rng.next() * 9) {
      const clear =
        level.exits.every((e) => e.kind === 'edge' || Math.abs(e.x - x) > 2.2) &&
        level.props.every((p) => Math.abs(p.x - x) > propHalf(p)[0] + 1 || p.z - propHalf(p)[1] > back + 1.1) &&
        (level.stations ?? []).every((st) => Math.abs(st.x - x) > 1.6) &&
        level.lights.every((l) => Math.abs(l.x - x) > 1.5) &&
        !plan.shopfronts.some((sf) => x > sf.x0 - 0.5 && x < sf.x1 + 0.5);
      if (clear) put('nyc/prop-street-tree', x, 0, back + 0.45, { sx: 0.8, sy: 0.85 + rng.next() * 0.25, sz: 0.8, ry: rng.next() * 6 });
    }
  }
  return plan;
}

/** What kind of ground is under a point: the last surface laid there. */
export function surfaceAt(plan: StreetPlan, x: number, z: number): SurfaceKind | null {
  for (let i = plan.surfaces.length - 1; i >= 0; i--) {
    const s = plan.surfaces[i];
    if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.kind;
  }
  return null;
}
