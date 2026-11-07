import type { ArchetypeId } from '../ai/archetypes';
import type { BossId } from '../ai/bosses';
import type { WeaponId } from '../combat/Weapons';
import type { GearId } from '../progress/catalogue';
import type { AreaId } from '../progress/Progress';

/**
 * Data that describes an area of the world. Gameplay (World.ts) and visuals
 * (LevelView.ts) are both built from this, so what you see is what collides.
 */

export type Theme = 'home' | 'estate' | 'high_street' | 'alleys' | 'industrial' | 'subway' | 'city' | 'territory';

/** Solid things on the ground. Size comes from the kind unless given. */
export type PropKind =
  | 'bin' | 'skip' | 'car' | 'van' | 'phonebox' | 'busstop' | 'bench' | 'barrier' | 'pallets' | 'crates' | 'drum' | 'cone' | 'trolley'
  | 'postbox' | 'bollard' | 'planter' | 'scrap'
  // home
  | 'bed' | 'wardrobe' | 'sofa' | 'tv' | 'table' | 'fridge' | 'cooker' | 'counter' | 'weights' | 'bag' | 'workbench' | 'shelves' | 'homecar' | 'desk' | 'rack';

export interface PropDef {
  kind: PropKind;
  x: number;
  z: number;
  /** Rotate 90 degrees (swap width and depth). */
  turned?: boolean;
  colour?: string;
}

/** Back-wall scenery along the street. */
export type FacadeKind = 'terrace' | 'shop' | 'pub' | 'tower' | 'garages' | 'warehouse' | 'fence' | 'hoarding' | 'subway' | 'office' | 'club' | 'house_front' | 'room';

export interface FacadeDef {
  kind: FacadeKind;
  x0: number;
  x1: number;
  /** Sign text for shops and pubs; room name for interiors. */
  label?: string;
  colour?: string;
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
  x: number;
  z: number;
  to: AreaId;
  toEntry: string;
  /** Needs this progress flag to use. */
  requires?: string;
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

export interface PickupDef {
  id: string;
  kind: 'cash' | 'food' | 'weapon' | 'secret';
  x: number;
  z: number;
  amount?: number;
  weapon?: WeaponId;
  /** Secrets: what you find. */
  reward?: { cosmetic?: string; gear?: GearId; cash?: number };
  label?: string;
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

export type StationId = 'wardrobe' | 'mirror' | 'gym' | 'sparring' | 'kitchen' | 'garage' | 'sofa' | 'contacts' | 'tin';

export interface StationDef {
  id: StationId;
  x: number;
  z: number;
  label: string;
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
  encounters: EncounterDef[];
  stations?: StationDef[];
  lights: LightDef[];
  /** Objective when nothing else is going on. */
  objective: string;
}

/** Collision footprint (half width in x, half depth in z) for each prop. */
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  bin: [0.32, 0.36], skip: [1.25, 0.7], car: [2.0, 0.9], van: [2.5, 1.0], phonebox: [0.5, 0.5], busstop: [1.6, 0.35], bench: [0.9, 0.28],
  barrier: [1.0, 0.15], pallets: [0.6, 0.5], crates: [0.5, 0.5], drum: [0.3, 0.3], cone: [0, 0], trolley: [0.4, 0.3], postbox: [0.3, 0.3],
  bollard: [0.12, 0.12], planter: [0.6, 0.4], scrap: [1.1, 0.8],
  bed: [1.0, 0.75], wardrobe: [0.6, 0.35], sofa: [1.0, 0.45], tv: [0.6, 0.25], table: [0.5, 0.4], fridge: [0.4, 0.35], cooker: [0.4, 0.35],
  counter: [1.2, 0.35], weights: [0.8, 0.4], bag: [0.25, 0.25], workbench: [1.0, 0.4], shelves: [0.8, 0.25], homecar: [2.0, 0.9], desk: [0.7, 0.35], rack: [0.8, 0.2],
};

export function propBox(p: PropDef): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  let [hx, hz] = PROP_SIZE[p.kind];
  if (hx === 0) return null;
  if (p.turned) [hx, hz] = [hz, hx];
  return { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz };
}
