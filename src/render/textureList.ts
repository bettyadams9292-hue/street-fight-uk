/**
 * The texture files in public/textures (made by tools/textures/gen_textures.py) and the layout of
 * their atlases. Kept free of three.js so the unit tests can check the folder against it; the
 * loading is in textureFiles.ts.
 */

/** Every file the game reads: colour maps, each with a `_n` normal map unless hasNormal says not. */
export const TEXTURE_NAMES = [
  'street/brick', 'street/paving', 'street/road', 'street/markings', 'street/concrete', 'street/plaster', 'street/corrugated',
  'street/tiles', 'street/shutter', 'street/wood_floor', 'street/sign_board', 'street/windows', 'street/graffiti', 'street/posters',
  'furniture/wood_light', 'furniture/wood_dark', 'furniture/weave', 'furniture/brushed_metal',
  'character/brow', 'character/lash',
  'character/fabric_fleece', 'character/fabric_knit', 'character/fabric_nylon', 'character/fabric_denim', 'character/fabric_leather', 'character/fabric_cotton', 'character/fabric_canvas',
  'home/f_oak', 'home/f_walnut', 'home/f_grey_carpet', 'home/f_cream_carpet', 'home/f_plum_carpet', 'home/f_red_carpet', 'home/f_check_tiles', 'home/f_stone_tiles', 'home/f_slate_tiles',
  'home/w_magnolia', 'home/w_white', 'home/w_sage', 'home/w_navy', 'home/w_charcoal', 'home/w_blush', 'home/w_slate_blue', 'home/w_stone', 'home/w_stripes', 'home/w_brick', 'home/w_panelling', 'home/w_tiles',
  'fx/particles', 'fx/rain',
] as const;
export type TextureName = (typeof TEXTURE_NAMES)[number];

/** Effects have no normal map. */
export const hasNormal = (name: string): boolean => !name.startsWith('fx/');

/** Cells of the window atlas (4 × 2, each 128 × 256), in order. */
export const WINDOW_CELLS = ['unlit', 'unlit_blinds', 'lit_warm', 'lit_warm2_curtains', 'lit_cool', 'lit_cream_blinds', 'lit_amber_curtains', 'lit_tv'] as const;
export type WindowCell = (typeof WINDOW_CELLS)[number];
/** Cells of the particle atlas (4 × 2, each 128 px), in order. */
export const FX_CELLS = ['hit', 'heavy', 'block', 'glint', 'danger', 'dot', 'smoke', 'drop'] as const;

