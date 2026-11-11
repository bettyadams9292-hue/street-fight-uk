/**
 * The MegaKit modules the city builder uses, with the facts the composer
 * needs: width along the street and how the piece sits on its origin.
 * Measured from public/models/city/kit.json; tests/city.test.ts checks them
 * against the file so they can't drift.
 *
 * Every wall module stands on y = 0 with its street face at z = 0, interior
 * towards -z. A storey is 3 m.
 */

export const STOREY = 3;
/** The kit's bay: 2 m wall modules (some are double, 4 m). */
export const BAY = 2;

export interface PieceInfo {
  /** Width along the street (x). */
  w: number;
  /** Where the piece's centre is relative to its origin along x (most are centred: 0). */
  cx?: number;
  /** Height (y). */
  h: number;
}

export const PIECES = {
  // Brick walls
  Brick_Plain_3: { w: 2, h: 3 },
  Brick_Plain_3_noWear: { w: 2, h: 3 },
  Brick_Plain_1: { w: 2, h: 1 },
  Brick_Plain_4: { w: 2, h: 4 },
  Brick_BottomTrim: { w: 2, h: 3 },
  Brick_TopTrim: { w: 2, h: 3 },
  Brick_HalfTrim: { w: 2, h: 3 },
  Brick_Inset: { w: 4, h: 3 },
  Brick_Inset_Window: { w: 4, h: 3 },
  Brick_Inset_Window_Curved: { w: 4, h: 3 },
  Brick_Inset_Window_Curved_Small: { w: 4, h: 3 },
  Brick_RedWhite_DoubleWindow: { w: 4, h: 3 },
  Brick_Window_CurvedDouble: { w: 4, h: 3 },
  Brick_Window_Square_Single: { w: 2, h: 3 },
  Brick_Window_Trim: { w: 2, h: 3 },
  Brick_Window_Trim_Single: { w: 2, h: 3 },
  Brick_Ornament_Horizontal: { w: 2, h: 0.31 },
  Brick_HalfColumn_Bottom: { w: 1.11, h: 3 },
  Brick_HalfColumn_Center: { w: 0.93, h: 3 },
  Brick_HalfColumn_Top: { w: 1.11, h: 3 },
  // Metal and concrete
  Metal_Plain_3: { w: 2, h: 3 },
  Metal_Plain_1: { w: 2, h: 1 },
  Metal_Window: { w: 4, h: 3 },
  Metal_Window_Half: { w: 2, h: 3 },
  Metal_FullWindow: { w: 2, h: 3 },
  Metal_FirstFloor_Wall: { w: 2, h: 3 },
  Metal_FirstFloor_Wall_1: { w: 2, h: 1 },
  Metal_FirstFloor_Window: { w: 2, h: 3 },
  Metal_Column_Bottom: { w: 0.57, h: 3 },
  Metal_Column_Center: { w: 0.5, h: 3 },
  Metal_Column_Top: { w: 0.64, h: 3 },
  // Stucco / painted trim
  Trim_Plain_3: { w: 2, h: 3 },
  Trim_Window: { w: 2, h: 3 },
  Trim_FirstFloor_Wall: { w: 2, h: 3 },
  Trim_FirstFloor_Window_001: { w: 2, h: 3 },
  Trim_FirstFloor_Window_Columns: { w: 2.15, h: 2.34 },
  Trim_Wall_Guard: { w: 2, h: 0.64 },
  Trim_Column_Bottom: { w: 0.72, h: 3 },
  Trim_Column_Center: { w: 0.67, h: 3 },
  Trim_Column_Top: { w: 0.72, h: 3 },
  // Doors
  DoorFrame_Metal_Single: { w: 2, h: 3 },
  DoorFrame_Trim: { w: 2, h: 3 },
  DoorFrame_Wooden: { w: 2.3, h: 3 },
  Door_1: { w: 1, cx: -0.5, h: 2.2 },
  Door_2: { w: 1, cx: -0.5, h: 2.2 },
  Door_3: { w: 1, cx: -0.5, h: 2.2 },
  // Rooflines
  Cornice_Brick_Center: { w: 2, h: 1 },
  Cornice_Metal_Center: { w: 2, h: 1 },
  Cornice_Trim_Center: { w: 2, h: 1 },
  Roof_Slate_Center: { w: 2, h: 3 },
  Roof_Slate_Window_1: { w: 2, h: 3 },
  Roof_SlateCornice_Center: { w: 2, h: 3.2 },
  Roof_SlateCornice_Window_1: { w: 2, h: 3.2 },
  Roof_2x2: { w: 2, h: 0 },
  Prop_ACUnit: { w: 0.89, h: 0.6 },
  // Street
  Sidewalk_Straight_3m: { w: 3, h: 0.15 },
  Prop_Bollard: { w: 0.22, h: 0.89 },
  Prop_Drain: { w: 0.59, h: 0.04 },
  Prop_ManholeCover: { w: 0.93, h: 0.03 },
  Prop_Planter_Single: { w: 2, h: 0.6 },
  Sidewalk_Planter: { w: 1.97, h: 0.51 },
} as const satisfies Record<string, PieceInfo>;

export type PieceId = keyof typeof PIECES;
