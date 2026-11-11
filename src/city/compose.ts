/**
 * Turns level frontages into buildings made of kit pieces.
 *
 * Pure data in, pure data out (no Three.js), so it is tested directly:
 *   planFacade()    splits a run of frontage into plots and picks a design for each
 *   composeBuilding() lays a design's pieces across its plot, storey by storey
 *
 * Deterministic: the same frontage, theme and seed always give the same street.
 */
import type { FacadeKind } from '../world/LevelTypes';
import { DESIGNS, type BuildingDesign, type Palette } from './catalogue';
import { districtProfile } from './districts';
import { BAY, PIECES, STOREY, type PieceId } from './pieces';

export interface Placement {
  piece: PieceId;
  /** Origin of the piece in level space. z is relative to the back wall line. */
  x: number;
  y: number;
  z: number;
  /** Horizontal fit to the plot (always within 0.85 to 1.15). */
  sx: number;
  /** Index into the plan's buildings, for its palette. */
  building: number;
  /** Window interiors: how bright the room is (0 dark .. 1 lit). */
  lit: number;
}

export interface PlannedBuilding {
  design: BuildingDesign;
  x0: number;
  x1: number;
  floors: number;
  palette: Palette;
  /** Top of the roofline (m). */
  height: number;
  /** Where its doors are (m), for signs and anything else that needs them. */
  doors: number[];
}

export interface FacadePlan {
  buildings: PlannedBuilding[];
  placements: Placement[];
}

export interface FacadeRequest {
  kind: FacadeKind;
  x0: number;
  x1: number;
  label?: string;
  theme: string;
  seed: number;
  /** Doors the game needs at exact positions (exits into buildings). */
  doors?: number[];
  /** Designs used just before this run, so the street doesn't repeat itself. */
  recent?: string[];
}

/** Kinds that are one business with one sign: never split into plots. */
const SINGLE: ReadonlySet<FacadeKind> = new Set(['shop', 'pub', 'club', 'casino', 'office', 'showroom', 'gym_front', 'market', 'leisure', 'house_front', 'precinct', 'dock']);

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The designs that may stand in for a frontage, with their weights in this district. */
export function candidates(kind: FacadeKind, theme: string, label?: string): { design: BuildingDesign; weight: number }[] {
  if (kind === 'terrace' && label === 'back') return DESIGNS.filter((d) => d.id === 'res_terrace_back').map((design) => ({ design, weight: 1 }));
  const bias = districtProfile(theme).bias;
  return DESIGNS.filter((d) => d.kinds.includes(kind) && d.weight! > 0)
    .map((design) => ({ design, weight: design.weight! * (bias[design.id] ?? 1) }))
    .filter((c) => c.weight > 0);
}

function pick<T>(items: { design: T; weight: number }[], rnd: () => number): T {
  const total = items.reduce((s, c) => s + c.weight, 0);
  let r = rnd() * total;
  for (const c of items) {
    r -= c.weight;
    if (r <= 0) return c.design;
  }
  return items[items.length - 1].design;
}

export function planFacade(req: FacadeRequest): FacadePlan {
  const rnd = mulberry(req.seed);
  const all = candidates(req.kind, req.theme, req.label);
  const plan: FacadePlan = { buildings: [], placements: [] };
  if (!all.length) return plan;
  const recent = [...(req.recent ?? [])];
  const width = req.x1 - req.x0;
  let x = req.x0;
  while (req.x1 - x > 0.05) {
    // Never the same design as either of the last two buildings, if there is any choice.
    const fresh = all.filter((c) => !recent.slice(-2).includes(c.design.id));
    const design = pick(fresh.length ? fresh : all, rnd);
    let w: number;
    if (SINGLE.has(req.kind) || width <= design.plot[1] + 1) w = req.x1 - x;
    else {
      const lo = design.plot[0];
      const hi = design.plot[1];
      w = lo + BAY * Math.floor(rnd() * ((hi - lo) / BAY + 1));
      // Don't leave a sliver: the last plot takes what remains.
      if (req.x1 - (x + w) < Math.max(4, lo)) w = req.x1 - x;
    }
    const doors = (req.doors ?? []).filter((d) => d >= x - 0.01 && d <= x + w + 0.01);
    const b = composeBuilding(design, x, x + w, plan.buildings.length, rnd, {
      doors,
      lastInRun: x + w >= req.x1 - 0.05,
      lit: districtProfile(req.theme).lit,
      centreDoor: req.kind === 'house_front',
    });
    plan.buildings.push(b.building);
    plan.placements.push(...b.placements);
    recent.push(design.id);
    x += w;
  }
  return plan;
}

/** 4 m pieces fall back to these where only one bay is left. */
const SINGLE_BAY: Partial<Record<PieceId, PieceId>> = {
  Brick_Inset: 'Brick_Plain_3',
  Brick_Inset_Window: 'Brick_Window_Trim_Single',
  Brick_Inset_Window_Curved: 'Brick_Window_Trim_Single',
  Brick_Inset_Window_Curved_Small: 'Brick_Window_Square_Single',
  Brick_RedWhite_DoubleWindow: 'Brick_Window_Square_Single',
  Brick_Window_CurvedDouble: 'Brick_Window_Trim',
  Metal_Window: 'Metal_Window_Half',
};

const WINDOWS: ReadonlySet<PieceId> = new Set<PieceId>([
  'Brick_Inset_Window', 'Brick_Inset_Window_Curved', 'Brick_Inset_Window_Curved_Small', 'Brick_RedWhite_DoubleWindow', 'Brick_Window_CurvedDouble',
  'Brick_Window_Square_Single', 'Brick_Window_Trim', 'Brick_Window_Trim_Single', 'Metal_Window', 'Metal_Window_Half', 'Metal_FullWindow',
  'Metal_FirstFloor_Window', 'Trim_Window', 'Trim_FirstFloor_Window_001', 'Roof_Slate_Window_1', 'Roof_SlateCornice_Window_1',
  'DoorFrame_Metal_Single', 'DoorFrame_Trim', 'DoorFrame_Wooden',
]);

const ROOF_HEIGHT: Record<BuildingDesign['roof'], number> = {
  slate: 3, slate_dormer: 3, slate_cornice: 3.2, slate_cornice_dormer: 3.2, flat_brick: 2, flat_metal: 2, flat_trim: 1, flat_plant: 1.6,
};

interface ComposeOpts {
  doors: number[];
  lastInRun: boolean;
  lit: number;
  centreDoor?: boolean;
}

export function composeBuilding(
  design: BuildingDesign,
  x0: number,
  x1: number,
  index: number,
  rnd: () => number,
  opts: ComposeOpts,
): { building: PlannedBuilding; placements: Placement[] } {
  const w = x1 - x0;
  const n = Math.max(1, Math.round(w / BAY));
  const sx = w / (n * BAY);
  const bayW = BAY * sx;
  const bayX = (i: number) => x0 + bayW * (i + 0.5);
  const floors = design.floors[0] + Math.floor(rnd() * (design.floors[1] - design.floors[0] + 1));
  const palette = design.palettes[Math.floor(rnd() * design.palettes.length)];
  const out: Placement[] = [];
  const put = (piece: PieceId, x: number, y: number, z = 0) => {
    const info = PIECES[piece] as { cx?: number };
    out.push({ piece, x: x - (info.cx ?? 0) * sx, y, z, sx, building: index, lit: WINDOWS.has(piece) ? litLevel(rnd, opts.lit) : 0 });
  };

  // ---- where the doors go ----
  const doorBays = new Set<number>();
  for (const d of opts.doors) doorBays.add(Math.min(n - 1, Math.max(0, Math.floor((d - x0) / bayW))));
  if (!doorBays.size) {
    switch (design.ground) {
      case 'house':
      case 'stucco':
        doorBays.add(opts.centreDoor ? Math.floor(n / 2) : 0);
        break;
      case 'house_back':
        break;
      case 'lobby':
        doorBays.add(Math.floor(n / 2));
        break;
      case 'pub':
        doorBays.add(0);
        if (n >= 5) doorBays.add(n - 1);
        break;
      case 'blank':
        doorBays.add(Math.min(1, n - 1));
        break;
      default:
        doorBays.add(n - 1);
    }
  }

  // ---- ground floor ----
  const plainWall = (): PieceId =>
    design.wall === 'metal' ? 'Metal_FirstFloor_Wall' : design.wall === 'trim' ? 'Trim_FirstFloor_Wall' : design.bands.plinth ? 'Brick_BottomTrim' : 'Brick_Plain_3';
  for (let i = 0; i < n; i++) {
    const x = bayX(i);
    if (doorBays.has(i)) {
      switch (design.ground) {
        case 'house':
          put('DoorFrame_Wooden', x, 0);
          put('Door_1', x, 0, -0.17);
          break;
        case 'stucco':
        case 'shop_trim':
        case 'pub':
          put('DoorFrame_Trim', x, 0);
          put('Door_2', x, 0, -0.16);
          break;
        case 'lobby':
          put('DoorFrame_Metal_Single', x, 0);
          put('Door_2', x, 0, -0.16);
          break;
        default:
          put('DoorFrame_Metal_Single', x, 0);
          put('Door_3', x, 0, -0.16);
      }
      continue;
    }
    switch (design.ground) {
      case 'house':
        put(design.wall === 'trim' ? 'Trim_Window' : 'Brick_Window_Trim_Single', x, 0);
        break;
      case 'house_back':
        put(i % 2 ? 'Brick_Plain_3' : 'Brick_Window_Square_Single', x, 0);
        break;
      case 'stucco':
        put('Trim_Window', x, 0);
        break;
      case 'shop_metal':
        put('Metal_FirstFloor_Window', x, 0);
        break;
      case 'shop_trim':
      case 'pub':
        put('Trim_FirstFloor_Window_001', x, 0);
        put('Trim_FirstFloor_Window_Columns', x, 0, 0.02);
        break;
      case 'shop_glass':
      case 'lobby':
        put('Metal_FullWindow', x, 0);
        break;
      case 'blank':
        put(plainWall(), x, 0);
        break;
    }
  }

  // ---- upper storeys ----
  for (let f = 1; f < floors; f++) {
    const y = f * STOREY;
    const top = f === floors - 1;
    let k = 0;
    for (let i = 0; i < n; ) {
      let piece: PieceId = design.upper[k % design.upper.length];
      k++;
      const pw = PIECES[piece].w;
      if (pw > BAY + 0.01) {
        if (i + 1 < n) {
          put(piece, x0 + bayW * (i + 1), y);
          i += 2;
          continue;
        }
        piece = SINGLE_BAY[piece] ?? 'Brick_Plain_3';
      }
      if (top && design.bands.top && piece === 'Brick_Plain_3') piece = 'Brick_TopTrim';
      put(piece, bayX(i), y);
      i++;
    }
    if (design.bands.string && design.wall === 'brick') for (let i = 0; i < n; i++) put('Brick_Ornament_Horizontal', bayX(i), y, 0.02);
  }

  // ---- roofline ----
  const ry = floors * STOREY;
  for (let i = 0; i < n; i++) {
    const x = bayX(i);
    const dormer = i % 2 === 1 && i < n - 1;
    switch (design.roof) {
      case 'slate':
        put('Roof_Slate_Center', x, ry);
        break;
      case 'slate_dormer':
        put(dormer ? 'Roof_Slate_Window_1' : 'Roof_Slate_Center', x, ry);
        break;
      case 'slate_cornice':
        put('Roof_SlateCornice_Center', x, ry);
        break;
      case 'slate_cornice_dormer':
        put(dormer ? 'Roof_SlateCornice_Window_1' : 'Roof_SlateCornice_Center', x, ry);
        break;
      case 'flat_brick':
        put('Brick_Plain_1', x, ry);
        put('Cornice_Brick_Center', x, ry + 1);
        break;
      case 'flat_metal':
        put('Metal_Plain_1', x, ry);
        put('Cornice_Metal_Center', x, ry + 1);
        break;
      case 'flat_trim':
        put('Cornice_Trim_Center', x, ry);
        break;
      case 'flat_plant':
        put('Metal_FirstFloor_Wall_1', x, ry);
        if (i % 3 === 1) put('Prop_ACUnit', x, ry + 0.4, -1.4);
        break;
    }
  }

  // ---- pilasters at the party walls ----
  if (design.pilasters !== 'none') {
    const set: Record<Exclude<BuildingDesign['pilasters'], 'none'>, [PieceId, PieceId, PieceId]> = {
      brick: ['Brick_HalfColumn_Bottom', 'Brick_HalfColumn_Center', 'Brick_HalfColumn_Top'],
      trim: ['Trim_Column_Bottom', 'Trim_Column_Center', 'Trim_Column_Top'],
      metal: ['Metal_Column_Bottom', 'Metal_Column_Center', 'Metal_Column_Top'],
    };
    const [bottom, centre, topPiece] = set[design.pilasters];
    const edges = opts.lastInRun ? [x0, x1] : [x0];
    for (const ex of edges)
      for (let f = 0; f < floors; f++) {
        const piece = f === 0 ? bottom : f === floors - 1 ? topPiece : centre;
        out.push({ piece, x: ex, y: f * STOREY, z: 0.03, sx: 1, building: index, lit: 0 });
      }
  }

  const doors = [...doorBays].map((i) => bayX(i));
  return {
    building: { design, x0, x1, floors, palette, height: floors * STOREY + ROOF_HEIGHT[design.roof], doors },
    placements: out,
  };
}

function litLevel(rnd: () => number, share: number): number {
  return rnd() < share ? 0.6 + rnd() * 0.4 : rnd() * 0.15;
}
