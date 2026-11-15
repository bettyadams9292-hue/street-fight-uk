/**
 * Which library texture goes on what (docs/assets/TEXTURE_ASSIGNMENTS.md is the readable version).
 *
 * The level builder makes most things from a colour, a roughness and a metalness, inside the
 * code for a kind of prop ("sofa", "toilet", "skip"). From those four facts this works out what
 * the thing is made of and picks a suitable set, tinted to the colour the builder asked for, so
 * the look of each object is kept and only its surface becomes real. When it can't tell what
 * something is made of, it leaves it alone: a plain painted surface is better than a wrong one.
 */
import * as THREE from 'three';
import type { LibraryName } from './catalogue';
import { nearest, pick } from './library';

// ---- families: every suitable variant, so the game doesn't use one brick or one oak everywhere ----

export const WOODS: LibraryName[] = ['Wood026', 'Wood049', 'Wood051', 'Wood052', 'Wood066', 'Wood067', 'Wood082B', 'Wood084A', 'Wood084B', 'Wood096'];
export const ROUGH_WOODS: LibraryName[] = ['Planks023A', 'Wood084B', 'Wood049'];
export const WOOD_FLOORS: LibraryName[] = ['WoodFloor014', 'WoodFloor040', 'WoodFloor041', 'WoodFloor043', 'WoodFloor048', 'WoodFloor051', 'WoodFloor053', 'WoodFloor054', 'WoodFloor064', 'WoodFloor070'];
export const BRICKS: LibraryName[] = ['Bricks005', 'Bricks007', 'Bricks070', 'Bricks097'];
export const STONE_WALLS: LibraryName[] = ['Bricks040', 'Bricks041'];
export const CONCRETES: LibraryName[] = ['Concrete034', 'Concrete042A'];
export const STEELS: LibraryName[] = ['Metal038', 'Metal041A', 'Metal052A', 'Metal061A', 'Metal063'];
export const BRASSES: LibraryName[] = ['Metal034', 'Metal042A', 'Metal048B', 'Metal048C'];
export const RUSTY: LibraryName[] = ['Metal022', 'Metal041B', 'Metal055B', 'Metal056B', 'Metal056C', 'Metal062C'];
export const CLOTHS: LibraryName[] = ['Fabric028', 'Fabric029', 'Fabric081A', 'Fabric082A', 'Fabric064'];
export const LEATHERS: LibraryName[] = ['Leather037', 'Leather012', 'Leather033B', 'Leather034C', 'Leather034D', 'Leather025', 'Leather011', 'Leather036B', 'Leather038', 'Leather009', 'Leather008'];
export const LAWNS: LibraryName[] = ['Grass006', 'Grass007', 'Grass004'];
export const FLOOR_TILES: LibraryName[] = ['Tiles055', 'Tiles057', 'Tiles068', 'Tiles138', 'Tiles140', 'Tiles143', 'Tiles144', 'Tiles050'];
export const WALL_TILES: LibraryName[] = ['Tiles105', 'Tiles011', 'Tiles032', 'Tiles037', 'Tiles031'];

/** Floors for a kind of place: the first is the usual choice, the rest are the variants a seed can choose. */
export const PLACE_FLOORS: Record<string, LibraryName[]> = {
  shop: ['Tiles055', 'Tiles057', 'Tiles138'],
  grow_shop: ['Tiles105', 'Tiles068'],
  pawn: ['Fabric025', 'Fabric024'],
  pub: ['WoodFloor041', 'WoodFloor070', 'WoodFloor014', 'Tiles131', 'Tiles117'],
  casino: ['Fabric024', 'Tiles074'],
  jeweller: ['Tiles082', 'Tiles076', 'Tiles077'],
  estate_agent: ['WoodFloor053', 'WoodFloor051'],
  furniture_store: ['WoodFloor040', 'WoodFloor051', 'WoodFloor054'],
  car_showroom: ['Tiles050', 'Tiles052'],
  bike_shop: ['Concrete042A'],
  gym_store: ['Tiles138', 'Concrete042A'],
  wrestling_club: ['Concrete042A'],
  boxing_gym: ['WoodFloor041', 'WoodFloor043'],
  karate_dojo: ['WoodFloor051', 'WoodFloor054'],
  basement: ['Concrete042A'],
};

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** What a prop is upholstered in, or made of, when its colour alone can't say. */
const SOFT = /^(sofa|bed|cinema_seats|terrace_sofa|pool_lounger|changing_booth|dojo_mat|wrestling_mat)$/;
const LEATHER = /^(bar|bag|boxing_ring|casino_cage|roulette_table|blackjack_table|slot_machine)$/;
const GLAZED = /^(toilet|basin|bath|pool_basin)$/;
const WEATHERED = /^(skip|dumpster|drum|scrap|abandoned_car|container|containers|garages|fence|barrier|crane_leg|bollard_dock|forklift|junk|ruin|dock|warehouse)$/;
const ROUGH_TIMBER = /^(pallets|pallet|crates|crate|hoarding|market_stall|workbench|grow_shelf|fence)$/;
const GARDEN = /^(mansion|semi|house_front|terrace|fountain)$/;
const WORKTOP = /^(counter|bar|shop_counter|glass_counter|dressing_island|pub_table)$/;
/** Things whose look is their paint, glow or screen: never textured. */
const LEAVE = /^(car|homecar|van|bus|tv|atm|vending|fruit_machine|jukebox|traffic_light|phonebox|cone|mannequin|computer_desk|terminal_desk|cinema_screen|projector|agent_board|agent_window|jewel_bust|hydro_prop|gym_prop|security_post|window)$/;

export interface Guess {
  set: LibraryName;
  /** Keep the builder's colour (true for everything except a few sets that are right in their own colours). */
  tint: boolean;
  rough?: number;
  normal?: number;
  /** Relief and sheen only, under a flat coat of the colour (paint). */
  plain?: boolean;
}

/**
 * The library set for something the level builder drew with this colour, roughness and
 * metalness while building `kind` (a prop or building kind, or '' for the room itself).
 * Null when it should stay as plain paint.
 */
export function guess(colour: THREE.ColorRepresentation, rough: number, metal: number, kind: string, seed: number): Guess | null {
  if (LEAVE.test(kind)) return null;
  const c = new THREE.Color(colour);
  const hsl: Hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const hue = hsl.h * 360;
  // Grey by chroma, not saturation: near white or black, saturation swings wildly on a hair of tint.
  const srgb = c.clone().convertLinearToSRGB();
  const grey = Math.max(srgb.r, srgb.g, srgb.b) - Math.min(srgb.r, srgb.g, srgb.b) < 0.1;
  const brown = hue >= 14 && hue <= 46 && hsl.s >= 0.18 && hsl.s <= 0.85 && hsl.l >= 0.1 && hsl.l <= 0.62;

  if (metal >= 0.35) {
    if (WEATHERED.test(kind)) return { set: pick(RUSTY, seed), tint: true, rough: 1 };
    // Gold, brass and copper keep their own colour: that is what makes them read as those metals.
    if (hue >= 36 && hue <= 58 && hsl.s > 0.4) return { set: nearest(BRASSES, c, seed), tint: true };
    if (hue >= 14 && hue < 36 && hsl.s > 0.4 && hsl.l > 0.3) return { set: 'Metal035', tint: true };
    // Painted or coated metal: the paint's colour over a metal surface.
    if (!grey) return { set: 'Metal050C', tint: true, plain: true };
    return { set: nearest(STEELS, c, seed), tint: true };
  }
  // A swimming pool is lined in blue mosaic, in its own colours.
  if (kind === 'pool_basin' && hue > 170 && hue < 250 && !grey) return { set: 'Tiles132A', tint: false, rough: 0.6 };
  // Lawns in front of houses.
  if (GARDEN.test(kind) && hue > 70 && hue < 160 && !grey && rough >= 0.8) return { set: pick(LAWNS, seed), tint: true };
  // Dark polished worktops are slate; wooden ones are butcher's block or oak strip.
  if (WORKTOP.test(kind) && grey && hsl.l < 0.35 && rough < 0.6) return { set: 'Rock058', tint: true, rough: 0.7 };
  if (WORKTOP.test(kind) && brown) return { set: nearest(['Wood071', 'Wood082B', 'Wood026'], c, seed, 2), tint: true, rough: 0.8 };
  if (GLAZED.test(kind) && grey) return { set: hsl.l > 0.45 ? 'Porcelain001' : 'Porcelain003', tint: true };
  if (SOFT.test(kind) && !brown && hsl.l > 0.06) return { set: nearest(CLOTHS, c, seed, 3), tint: true, rough: 1 };
  if (LEATHER.test(kind) && !grey && !brown && rough < 0.75) return { set: nearest(LEATHERS, c, seed, 3), tint: true };
  if (brown) {
    if (ROUGH_TIMBER.test(kind) || WEATHERED.test(kind)) return { set: nearest(ROUGH_WOODS, c, seed, 3), tint: true };
    return { set: nearest(WOODS, c, seed, 3), tint: true, rough: rough < 0.5 ? 0.75 : 1 };
  }
  // White and glossy, not metal: glazed ceramic (worktop edges, white goods, tiles).
  if (grey && hsl.l > 0.8 && rough <= 0.4) return { set: 'Porcelain001', tint: true };
  // Grey and matt: concrete, render and stone. Near-black is rubber or plastic and stays plain.
  if (grey && rough >= 0.7 && hsl.l > 0.1) return { set: hsl.l > 0.42 ? 'Concrete034' : 'Concrete042A', tint: true, normal: 0.8 };
  return null;
}
