/**
 * The building catalogue: every design the city builder can put up, as data.
 *
 * A design is an architectural composition, not a colour: its ground floor,
 * the rhythm of bays on the floors above, the wall material, horizontal bands,
 * pilasters and roofline. tests/city.test.ts checks that no two designs share
 * a composition, so a recolour never counts as a new design.
 *
 * Colours come from a palette chosen per building, on top of the design.
 */
import type { FacadeKind } from '../world/LevelTypes';
import type { PieceId } from './pieces';

export type Category = 'residential' | 'commercial' | 'office' | 'industrial' | 'entertainment' | 'civic';

/** How the street-level storey is built. */
export type GroundKind =
  | 'house' // brick, a front door per house, a window beside it
  | 'house_back' // back of a terrace: small windows, no front doors
  | 'stucco' // painted render, panelled door
  | 'shop_metal' // dark metal shopfront, glazed door
  | 'shop_trim' // traditional painted timber shopfront with columns
  | 'shop_glass' // full-height glazing
  | 'lobby' // office lobby: glass with central doors
  | 'blank' // brick with a service door
  | 'pub'; // painted timber pub front, panelled doors

export type WallKind = 'brick' | 'metal' | 'trim';
export type RoofKind = 'slate' | 'slate_dormer' | 'slate_cornice' | 'slate_cornice_dormer' | 'flat_brick' | 'flat_metal' | 'flat_trim' | 'flat_plant';
export type PilasterKind = 'none' | 'brick' | 'trim' | 'metal';

export interface Palette {
  /** Multiplies the brick texture: '#ffffff' is the kit's red brick. */
  brick: string;
  /** Painted render, window surrounds and shopfront timber. */
  trim: string;
  /** Concrete and metal panels. */
  metal: string;
}

export interface BuildingDesign {
  id: string;
  name: string;
  category: Category;
  /** The facade kinds (from level data) this design may stand in for. */
  kinds: readonly FacadeKind[];
  /** Storeys including the ground floor. */
  floors: readonly [number, number];
  /** Plot width range (m) when a run is split into separate buildings. */
  plot: readonly [number, number];
  ground: GroundKind;
  /** Upper-floor bays, repeated across the frontage. 4 m pieces take two bays. */
  upper: readonly PieceId[];
  wall: WallKind;
  bands: { readonly plinth?: boolean; readonly string?: boolean; readonly top?: boolean };
  pilasters: PilasterKind;
  roof: RoofKind;
  palettes: readonly Palette[];
  /** Relative chance of being picked where several designs fit. */
  weight?: number;
}

// ---- palettes ---------------------------------------------------------------------------------

const P = (brick: string, trim: string, metal: string): Palette => ({ brick, trim, metal });
/** Victorian and Edwardian red brick with cream, white or stone dressings. */
const RED = [P('#ffffff', '#f4efe2', '#9a9a96'), P('#e6cfc4', '#ffffff', '#8a8c8e'), P('#c9ada2', '#e8dcc0', '#7a7c80')];
/** Soot-darkened northern brick. */
const SOOT = [P('#a89890', '#d8d0c0', '#6a6c70'), P('#8f8079', '#c8c0b0', '#5a5c60')];
/** Painted stucco fronts. */
const STUCCO = [P('#ffffff', '#ffffff', '#9a9a96'), P('#ffffff', '#f0e6c8', '#9a9a96'), P('#ffffff', '#dfe6e8', '#8a8c8e'), P('#ffffff', '#efd8c8', '#9a9a96')];
/** Shopfront and pub colours: bottle green, oxblood, navy, black. */
const SHOPFRONT = [P('#ffffff', '#3a5a40', '#2a2c30'), P('#e6cfc4', '#6a2a2a', '#2a2c30'), P('#ffffff', '#2c3a5a', '#3a3c40'), P('#c9ada2', '#2a2a2a', '#2a2c30')];
/** Post-war concrete and panels. */
const CONCRETE = [P('#c9ada2', '#d8d4cc', '#b8b8b4'), P('#a89890', '#c8c4bc', '#a0a29e'), P('#e6cfc4', '#e0dcd2', '#c8c8c2')];
/** Corporate glass and steel. */
const CORPORATE = [P('#c9ada2', '#e8e8e8', '#cfd2d4'), P('#a89890', '#c0c0c0', '#8a9096'), P('#e6cfc4', '#ffffff', '#b4b8bc')];
/** Industrial brick and painted steel. */
const WORKS = [P('#ffffff', '#c8c0b0', '#7a8a7a'), P('#a89890', '#b8b0a0', '#6a7a8a'), P('#c9ada2', '#d0c8b8', '#8a7a6a')];
/** Nightlife: dark trim, deep colours. */
const NIGHT = [P('#8f8079', '#2a2a2a', '#1e1f22'), P('#a89890', '#4a1a3a', '#1e1f22'), P('#c9ada2', '#1a2a4a', '#2a2c30')];

// ---- the catalogue ----------------------------------------------------------------------------

type Row = [
  id: string,
  name: string,
  category: Category,
  kinds: readonly FacadeKind[],
  floors: readonly [number, number],
  plot: readonly [number, number],
  ground: GroundKind,
  upper: readonly PieceId[],
  wall: WallKind,
  bands: BuildingDesign['bands'],
  pilasters: PilasterKind,
  roof: RoofKind,
  palettes: readonly Palette[],
  weight?: number,
];

const TERRACE: readonly FacadeKind[] = ['terrace', 'house_front'];
const HOUSES: readonly FacadeKind[] = ['terrace', 'semi', 'house_front'];
const SHOPS: readonly FacadeKind[] = ['shop', 'precinct'];
const NIGHTSPOTS: readonly FacadeKind[] = ['club', 'casino', 'pub'];
const WORKSHOPS: readonly FacadeKind[] = ['warehouse', 'dock'];

const ROWS: Row[] = [
  // ---- Residential (15) ----
  ['res_bylaw_terrace', 'By-law terrace', 'residential', TERRACE, [2, 2], [4, 6], 'house', ['Brick_Window_Trim_Single'], 'brick', {}, 'none', 'slate', RED, 3],
  ['res_bay_terrace', 'Bay-fronted terrace', 'residential', TERRACE, [2, 2], [4, 6], 'house', ['Brick_Window_Trim'], 'brick', { plinth: true }, 'brick', 'slate', RED, 3],
  ['res_dormer_terrace', 'Terrace with attic dormers', 'residential', TERRACE, [2, 2], [4, 6], 'house', ['Brick_Window_Trim_Single'], 'brick', { string: true }, 'none', 'slate_dormer', SOOT, 2],
  ['res_three_storey', 'Three-storey town house', 'residential', HOUSES, [3, 3], [4, 6], 'house', ['Brick_Window_Trim', 'Brick_Window_Trim_Single'], 'brick', { plinth: true, string: true }, 'brick', 'slate_cornice', RED, 2],
  ['res_stucco_villa', 'Stucco villa', 'residential', HOUSES, [3, 3], [6, 8], 'stucco', ['Trim_Window'], 'trim', { plinth: true }, 'trim', 'flat_trim', STUCCO, 1],
  ['res_stucco_terrace', 'Regency stucco terrace', 'residential', TERRACE, [3, 4], [6, 8], 'stucco', ['Trim_Window', 'Trim_Plain_3'], 'trim', {}, 'none', 'slate_cornice_dormer', STUCCO, 1],
  ['res_pale_semi', 'Inter-war semi', 'residential', ['semi'], [2, 2], [8, 8], 'stucco', ['Brick_Window_Square_Single', 'Trim_Window'], 'trim', {}, 'none', 'slate', STUCCO, 3],
  ['res_brick_semi', 'Brick semi with dormers', 'residential', ['semi'], [2, 2], [8, 8], 'house', ['Brick_Window_Square_Single'], 'brick', { plinth: true }, 'none', 'slate_dormer', RED, 2],
  ['res_tenement', 'Victorian tenement', 'residential', ['terrace', 'tower'], [4, 5], [8, 12], 'blank', ['Brick_Inset_Window_Curved_Small'], 'brick', { string: true, top: true }, 'brick', 'flat_brick', SOOT, 1],
  ['res_mansion_flats', 'Mansion flats', 'residential', ['tower', 'semi'], [5, 6], [10, 14], 'stucco', ['Brick_RedWhite_DoubleWindow'], 'brick', { plinth: true, string: true }, 'trim', 'slate_cornice', RED, 1],
  ['res_council_slab', 'Council slab block', 'residential', ['tower'], [8, 10], [12, 16], 'lobby', ['Metal_Window', 'Metal_Plain_3'], 'metal', {}, 'metal', 'flat_plant', CONCRETE, 2],
  ['res_point_block', 'Point block', 'residential', ['tower'], [10, 12], [12, 14], 'lobby', ['Metal_Window_Half'], 'metal', {}, 'none', 'flat_metal', CONCRETE, 2],
  ['res_deck_access', 'Deck-access flats', 'residential', ['tower'], [6, 7], [12, 16], 'blank', ['Metal_Window_Half', 'Metal_Window_Half', 'Metal_Plain_3'], 'metal', { plinth: true }, 'metal', 'flat_metal', CONCRETE, 1],
  ['res_terrace_back', 'Terrace backs', 'residential', ['terrace'], [2, 2], [4, 6], 'house_back', ['Brick_Window_Square_Single', 'Brick_Plain_3'], 'brick', {}, 'none', 'slate', SOOT, 0],
  ['res_warehouse_flats', 'Converted warehouse flats', 'residential', ['tower', 'terrace'], [5, 6], [10, 14], 'shop_glass', ['Brick_Inset_Window'], 'brick', { top: true }, 'brick', 'flat_brick', RED, 1],

  // ---- Commercial (15) ----
  ['com_parade', 'Victorian shop parade', 'commercial', SHOPS, [3, 3], [8, 12], 'shop_trim', ['Brick_Window_Trim_Single'], 'brick', { string: true }, 'brick', 'slate', RED, 3],
  ['com_parade_dormer', 'Shop with attic flat', 'commercial', SHOPS, [2, 2], [8, 12], 'shop_metal', ['Brick_Window_Trim'], 'brick', {}, 'none', 'slate_dormer', SOOT, 3],
  ['com_corner_bank', 'Former bank', 'commercial', ['shop', 'showroom'], [3, 3], [10, 14], 'shop_glass', ['Brick_Window_CurvedDouble'], 'brick', { plinth: true, top: true }, 'trim', 'flat_trim', RED, 1],
  ['com_stucco_shops', 'Stucco shops', 'commercial', SHOPS, [3, 3], [8, 12], 'shop_trim', ['Trim_Window'], 'trim', {}, 'trim', 'flat_trim', STUCCO, 2],
  ['com_draper', 'Edwardian draper', 'commercial', ['shop'], [3, 4], [10, 14], 'shop_trim', ['Brick_Inset_Window_Curved'], 'brick', { string: true }, 'brick', 'slate_cornice', RED, 1],
  ['com_sixties_parade', 'Sixties parade', 'commercial', ['shop', 'precinct'], [2, 2], [10, 14], 'shop_metal', ['Metal_Window'], 'metal', {}, 'none', 'flat_metal', CONCRETE, 2],
  ['com_precinct_block', 'Precinct block', 'commercial', ['precinct'], [3, 3], [12, 18], 'shop_glass', ['Metal_Window_Half', 'Metal_Plain_3'], 'metal', { plinth: true }, 'metal', 'flat_plant', CONCRETE, 3],
  ['com_precinct_low', 'Single-storey precinct unit', 'commercial', ['precinct'], [2, 2], [10, 16], 'shop_metal', ['Metal_Plain_3'], 'metal', {}, 'metal', 'flat_metal', CONCRETE, 2],
  ['com_flats_over', 'Flats over shops', 'commercial', SHOPS, [4, 4], [10, 14], 'shop_metal', ['Brick_Inset_Window'], 'brick', { top: true }, 'none', 'flat_brick', SOOT, 2],
  ['com_double_fronted', 'Double-fronted shop', 'commercial', ['shop'], [3, 3], [8, 12], 'shop_trim', ['Brick_RedWhite_DoubleWindow'], 'brick', {}, 'none', 'slate', RED, 2],
  ['com_glass_store', 'Glass-fronted store', 'commercial', ['shop', 'showroom'], [2, 3], [10, 14], 'shop_glass', ['Metal_FullWindow', 'Metal_Plain_3'], 'metal', {}, 'metal', 'flat_metal', CORPORATE, 1],
  ['com_arcade', 'Arcade frontage', 'commercial', ['shop'], [3, 3], [8, 12], 'shop_metal', ['Brick_Window_Square_Single', 'Brick_Plain_3'], 'brick', { plinth: true, string: true }, 'brick', 'flat_brick', SOOT, 1],
  ['com_showroom', 'Motor showroom', 'commercial', ['showroom'], [2, 2], [12, 22], 'shop_glass', ['Metal_Plain_3', 'Metal_Window_Half'], 'metal', {}, 'metal', 'flat_plant', CORPORATE, 3],
  ['com_furniture', 'Furniture warehouse store', 'commercial', ['showroom'], [2, 2], [8, 14], 'shop_glass', ['Brick_Plain_3'], 'brick', { top: true }, 'metal', 'flat_metal', WORKS, 2],
  ['com_tall_shop', 'Four-storey shop', 'commercial', ['shop'], [4, 4], [8, 12], 'shop_trim', ['Brick_Window_Trim', 'Brick_Window_Trim_Single', 'Brick_Window_Trim'], 'brick', { string: true, top: true }, 'brick', 'slate_cornice_dormer', RED, 1],

  // ---- Offices (10) ----
  ['off_glass_tower', 'Glass office', 'office', ['office'], [7, 8], [14, 20], 'lobby', ['Metal_FullWindow'], 'metal', {}, 'metal', 'flat_plant', CORPORATE, 2],
  ['off_banded', 'Banded office', 'office', ['office'], [6, 7], [14, 20], 'lobby', ['Metal_Window'], 'metal', { plinth: true }, 'none', 'flat_metal', CORPORATE, 2],
  ['off_chambers', 'Victorian chambers', 'office', ['office', 'showroom'], [5, 5], [12, 18], 'lobby', ['Brick_Window_Trim'], 'brick', { plinth: true, string: true }, 'trim', 'flat_trim', RED, 2],
  ['off_insurance', 'Insurance building', 'office', ['office'], [6, 6], [14, 20], 'lobby', ['Brick_Window_CurvedDouble'], 'brick', { plinth: true, top: true }, 'brick', 'slate_cornice', RED, 1],
  ['off_seventies', 'Seventies office block', 'office', ['office', 'tower'], [6, 8], [14, 20], 'lobby', ['Metal_Window_Half', 'Metal_Plain_3', 'Metal_Window_Half'], 'metal', {}, 'metal', 'flat_plant', CONCRETE, 1],
  ['off_stucco', 'Stucco offices', 'office', ['office'], [4, 5], [12, 16], 'lobby', ['Trim_Window', 'Trim_Window', 'Trim_Plain_3'], 'trim', { plinth: true }, 'trim', 'slate_cornice_dormer', STUCCO, 1],
  ['off_redbrick_inset', 'Red-brick offices', 'office', ['office'], [5, 6], [12, 18], 'lobby', ['Brick_Inset_Window'], 'brick', {}, 'metal', 'flat_metal', RED, 1],
  ['off_curved', 'Arched-window offices', 'office', ['office'], [5, 5], [12, 18], 'lobby', ['Brick_Inset_Window_Curved'], 'brick', { top: true }, 'brick', 'flat_brick', SOOT, 1],
  ['off_mixed', 'Glass and brick offices', 'office', ['office'], [6, 6], [14, 18], 'lobby', ['Metal_FullWindow', 'Brick_Plain_3'], 'brick', { string: true }, 'metal', 'flat_metal', CORPORATE, 1],
  ['off_square', 'Square-window offices', 'office', ['office'], [4, 5], [12, 16], 'lobby', ['Brick_Window_Square_Single'], 'brick', { plinth: true, top: true }, 'metal', 'flat_plant', CONCRETE, 1],

  // ---- Industrial (10) ----
  ['ind_mill', 'Brick mill', 'industrial', WORKSHOPS, [3, 4], [16, 26], 'blank', ['Brick_Inset_Window_Curved_Small'], 'brick', { string: true }, 'brick', 'flat_brick', SOOT, 2],
  ['ind_bonded', 'Bonded warehouse', 'industrial', ['dock', 'warehouse'], [4, 5], [16, 26], 'blank', ['Brick_Inset_Window', 'Brick_Inset'], 'brick', { plinth: true, top: true }, 'brick', 'flat_brick', RED, 2],
  ['ind_works', 'Works with offices', 'industrial', WORKSHOPS, [2, 2], [16, 26], 'lobby', ['Brick_Window_Square_Single', 'Brick_Plain_3', 'Brick_Plain_3'], 'brick', {}, 'metal', 'flat_metal', WORKS, 2],
  ['ind_unit', 'Steel-clad unit', 'industrial', ['warehouse'], [2, 2], [16, 26], 'blank', ['Metal_Plain_3'], 'metal', {}, 'metal', 'flat_plant', WORKS, 3],
  ['ind_depot', 'Depot', 'industrial', ['warehouse'], [2, 2], [16, 26], 'shop_metal', ['Metal_Plain_3', 'Metal_Window_Half'], 'metal', { plinth: true }, 'none', 'flat_metal', WORKS, 2],
  ['ind_printworks', 'Printworks', 'industrial', WORKSHOPS, [3, 3], [16, 26], 'blank', ['Brick_Window_Trim_Single', 'Brick_Plain_3'], 'brick', { plinth: true }, 'brick', 'slate', SOOT, 1],
  ['ind_brewery', 'Brewery building', 'industrial', WORKSHOPS, [4, 4], [16, 26], 'blank', ['Brick_Window_CurvedDouble'], 'brick', { string: true, top: true }, 'brick', 'slate_cornice', RED, 1],
  ['ind_loading', 'Loading shed', 'industrial', ['warehouse', 'dock'], [2, 2], [16, 26], 'blank', ['Brick_Inset'], 'brick', { top: true }, 'none', 'flat_brick', WORKS, 2],
  ['ind_engineering', 'Engineering works', 'industrial', ['warehouse'], [3, 3], [16, 26], 'lobby', ['Metal_Window', 'Brick_Plain_3'], 'brick', {}, 'metal', 'flat_plant', SOOT, 1],
  ['ind_cooperage', 'Cooperage', 'industrial', ['dock', 'warehouse'], [3, 3], [16, 26], 'blank', ['Brick_Window_Trim'], 'brick', { string: true }, 'none', 'slate_dormer', RED, 1],

  // ---- Entertainment and hospitality (10) ----
  ['ent_victorian_pub', 'Victorian pub', 'entertainment', ['pub'], [3, 3], [10, 18], 'pub', ['Brick_Window_Trim'], 'brick', { string: true }, 'brick', 'slate_cornice', SHOPFRONT, 3],
  ['ent_corner_pub', 'Street-corner local', 'entertainment', ['pub'], [2, 2], [10, 18], 'pub', ['Brick_Window_Trim_Single'], 'brick', { plinth: true }, 'none', 'slate_dormer', SHOPFRONT, 3],
  ['ent_gin_palace', 'Gin palace', 'entertainment', ['pub', 'casino'], [3, 3], [12, 18], 'pub', ['Brick_Inset_Window_Curved'], 'brick', { plinth: true, top: true }, 'trim', 'flat_trim', SHOPFRONT, 1],
  ['ent_stucco_inn', 'Stucco coaching inn', 'entertainment', ['pub'], [3, 3], [12, 18], 'pub', ['Trim_Window'], 'trim', { plinth: true }, 'trim', 'slate', STUCCO, 1],
  ['ent_club_box', 'Club in a converted unit', 'entertainment', ['club'], [2, 3], [14, 20], 'blank', ['Metal_Plain_3'], 'metal', {}, 'metal', 'flat_metal', NIGHT, 2],
  ['ent_club_brick', 'Club in an old picture house', 'entertainment', ['club'], [3, 3], [14, 24], 'shop_glass', ['Brick_Inset', 'Brick_Inset_Window_Curved_Small'], 'brick', { top: true }, 'brick', 'flat_brick', NIGHT, 2],
  ['ent_casino', 'Casino', 'entertainment', ['casino'], [3, 4], [14, 20], 'lobby', ['Brick_Window_CurvedDouble'], 'brick', { plinth: true, string: true }, 'trim', 'flat_trim', NIGHT, 2],
  ['ent_hotel', 'Station hotel', 'entertainment', ['casino', 'club'], [5, 6], [14, 20], 'lobby', ['Brick_RedWhite_DoubleWindow'], 'brick', { string: true, top: true }, 'brick', 'slate_cornice_dormer', RED, 1],
  ['ent_bar', 'Bar with flats over', 'entertainment', NIGHTSPOTS, [3, 3], [10, 16], 'shop_metal', ['Brick_Inset_Window'], 'brick', {}, 'metal', 'flat_metal', NIGHT, 1],
  ['ent_takeaway', 'Takeaway row', 'entertainment', ['shop'], [2, 2], [8, 10], 'shop_metal', ['Brick_Window_Square_Single', 'Brick_Window_Square_Single'], 'brick', { top: true }, 'none', 'flat_brick', SOOT, 1],

  // ---- Civic and services (10) ----
  ['civ_market_hall', 'Victorian market hall', 'civic', ['market'], [3, 3], [20, 30], 'shop_trim', ['Brick_Window_CurvedDouble', 'Brick_Inset'], 'brick', { plinth: true, string: true, top: true }, 'brick', 'slate_cornice_dormer', RED, 1],
  ['civ_boxing_club', 'Boxing club in a chapel hall', 'civic', ['gym_front'], [2, 2], [10, 14], 'blank', ['Brick_Inset_Window_Curved'], 'brick', { plinth: true }, 'brick', 'slate', SOOT, 2],
  ['civ_gym_unit', 'Gym in a shopfront', 'civic', ['gym_front', 'shop'], [2, 2], [10, 14], 'shop_glass', ['Brick_Inset'], 'brick', { top: true }, 'metal', 'flat_metal', SOOT, 1],
  ['civ_leisure', 'Leisure centre', 'civic', ['leisure'], [2, 2], [20, 32], 'lobby', ['Metal_Plain_3', 'Metal_Window'], 'metal', { plinth: true }, 'metal', 'flat_plant', CONCRETE, 2],
  ['civ_library', 'Carnegie library', 'civic', ['leisure', 'office', 'market'], [3, 3], [14, 22], 'lobby', ['Brick_Inset_Window_Curved', 'Brick_Inset'], 'brick', { plinth: true, string: true }, 'trim', 'flat_trim', RED, 1],
  ['civ_police', 'Police station', 'civic', ['office'], [3, 3], [12, 18], 'blank', ['Brick_Window_Trim', 'Brick_Plain_3'], 'brick', { plinth: true, top: true }, 'brick', 'flat_brick', RED, 1],
  ['civ_surgery', 'Health centre', 'civic', ['precinct', 'leisure'], [2, 2], [12, 18], 'lobby', ['Metal_Window_Half', 'Brick_Plain_3'], 'brick', {}, 'none', 'flat_metal', CONCRETE, 1],
  ['civ_town_hall', 'Town hall annexe', 'civic', ['office', 'market'], [4, 4], [16, 24], 'lobby', ['Brick_RedWhite_DoubleWindow', 'Brick_Inset'], 'brick', { plinth: true, string: true, top: true }, 'trim', 'slate_cornice', RED, 1],
  ['civ_community', 'Community centre', 'civic', ['gym_front', 'leisure', 'precinct'], [2, 2], [12, 18], 'shop_glass', ['Metal_Window', 'Brick_Plain_3'], 'brick', { plinth: true }, 'none', 'flat_plant', CONCRETE, 1],
  ['civ_baths', 'Public baths', 'civic', ['leisure', 'gym_front'], [3, 3], [16, 24], 'stucco', ['Brick_Window_CurvedDouble', 'Brick_Plain_3'], 'brick', { top: true }, 'trim', 'slate_dormer', RED, 1],
];

export const DESIGNS: readonly BuildingDesign[] = ROWS.map(
  ([id, name, category, kinds, floors, plot, ground, upper, wall, bands, pilasters, roof, palettes, weight]) => ({
    id, name, category, kinds, floors, plot, ground, upper, wall, bands, pilasters, roof, palettes, weight: weight ?? 1,
  }),
);

export const DESIGN_BY_ID: Readonly<Record<string, BuildingDesign>> = Object.fromEntries(DESIGNS.map((d) => [d.id, d]));

/** A design's composition, everything that makes it architecturally different. Colours and sizes are left out on purpose. */
export function compositionKey(d: BuildingDesign): string {
  return JSON.stringify([d.ground, d.upper, d.wall, d.bands.plinth ?? false, d.bands.string ?? false, d.bands.top ?? false, d.pilasters, d.roof]);
}

/** Facade kinds the kit rebuilds. Anything else keeps its own builder. */
export const KIT_KINDS: ReadonlySet<FacadeKind> = new Set(DESIGNS.flatMap((d) => d.kinds));
