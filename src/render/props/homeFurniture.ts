/**
 * The furniture you buy for your place, drawn with Kenney's Furniture Kit (CC0)
 * so it matches the pieces already in the flat, instead of boxes. Each piece is
 * fitted inside the footprint the catalogue gives it (keeping the model's own
 * proportions), takes the colour you chose (fabric for sofas, beds and rugs;
 * a wood or paint finish for cabinets and tables) and hangs at the right height
 * if it goes on the wall. Anything not listed here, or anything asked for before
 * the kit has loaded, stays with its built-in model (propModels.ts).
 */
import * as THREE from 'three';
import { FURNITURE } from '../../property/catalogue';
import { furniture, type FurnitureId } from './KenneyLibrary';

interface Spec {
  /** Kenney model. */
  k: FurnitureId;
  /** How your colour choice shows: the fabric, the wood/paint finish, or not at all. */
  colour: 'fabric' | 'wood' | 'none';
  /** Long runs (worktops, wall cupboards) are built from units this wide, side by side. */
  unit?: number;
  /** Height for unit runs (metres). */
  h?: number;
  /** Stands on a low media cabinet this tall (metres): the model itself is only the telly. */
  stand?: number;
  /** Seats: stretched to the whole footprint and to this height, so the cushions are where the sitting pose puts you (0.45 m). */
  fitH?: number;
}

export const HOME_MODELS: Record<string, Spec> = {
  sofa_3: { k: 'loungeDesignSofa', colour: 'fabric', fitH: 0.78 },
  sofa_2: { k: 'loungeSofa', colour: 'fabric', fitH: 0.9 },
  armchair: { k: 'loungeChair', colour: 'fabric', fitH: 0.9 },
  coffee_table: { k: 'tableCoffee', colour: 'wood' },
  tv_unit: { k: 'cabinetTelevisionDoors', colour: 'wood' },
  tv_43: { k: 'televisionModern', colour: 'none', stand: 0.48 },
  bookcase: { k: 'bookcaseClosedWide', colour: 'wood' },
  shelf_low: { k: 'bookcaseOpenLow', colour: 'wood' },
  rug_round: { k: 'rugRound', colour: 'fabric' },
  rug_long: { k: 'rugRectangle', colour: 'fabric' },
  bed_double: { k: 'bedDouble', colour: 'fabric' },
  bed_single: { k: 'bedSingle', colour: 'fabric' },
  wardrobe2: { k: 'bookcaseClosedDoors', colour: 'wood' },
  bedside: { k: 'cabinetBedDrawerTable', colour: 'wood' },
  drawers: { k: 'cabinetBedDrawer', colour: 'wood' },
  desk2: { k: 'desk', colour: 'wood' },
  dining_table: { k: 'table', colour: 'wood' },
  dining_chair: { k: 'chairCushion', colour: 'wood' },
  fridge2: { k: 'kitchenFridgeLarge', colour: 'none' },
  cupboard: { k: 'kitchenCabinet', colour: 'wood' },
  worktop: { k: 'kitchenCabinetDrawer', colour: 'wood', unit: 0.6, h: 0.92 },
  washer: { k: 'washer', colour: 'none' },
  island: { k: 'kitchenBar', colour: 'wood' },
  wall_cupboards: { k: 'kitchenCabinetUpperDouble', colour: 'wood', unit: 0.8, h: 0.6 },
  bath_cabinet: { k: 'bathroomMirror', colour: 'none' },
  bath_tower: { k: 'cabinetBedDrawer', colour: 'wood' },
  bath_mat: { k: 'rugDoormat', colour: 'fabric' },
  plant_tall: { k: 'pottedPlant', colour: 'none' },
  plant_small: { k: 'plantSmall2', colour: 'none' },
  floor_lamp: { k: 'lampRoundFloor', colour: 'none' },
  arc_lamp: { k: 'lampSquareFloor', colour: 'none' },
  wall_light: { k: 'lampWall', colour: 'none' },
};

/** The kit model for a catalogue piece in your colour, or null (not mapped, or the kit isn't loaded yet). */
export function homeFurnitureModel(id: string, colour?: string): THREE.Group | null {
  const spec = HOME_MODELS[id];
  const def = FURNITURE[id];
  if (!spec || !def) return null;
  const c = colour ?? def.colours[0];
  const look = { upholstery: spec.colour === 'fabric' ? c : undefined, wood: spec.colour === 'wood' ? c : undefined };
  const W = def.size[0] * 2;
  const D = def.size[1] * 2;
  const g = new THREE.Group();
  if (spec.unit) {
    const n = Math.max(1, Math.round(W / spec.unit));
    for (let i = 0; i < n; i++) {
      const m = furniture(spec.k, W / n, spec.h ?? 0.9, D, look);
      if (!m) return null;
      m.position.x = -W / 2 + (W / n) * (i + 0.5);
      g.add(m);
    }
  } else if (spec.fitH) {
    const m = furniture(spec.k, W, spec.fitH, D, look);
    if (!m) return null;
    g.add(m);
  } else if (spec.stand) {
    const unit = furniture('cabinetTelevision', W, spec.stand, D, { wood: c });
    const tv = furniture(spec.k, W * 0.98, 10, Math.min(D, 0.2), { keepAspect: true });
    if (!unit || !tv) return null;
    tv.position.y = spec.stand;
    g.add(unit, tv);
  } else {
    // Fitted inside the footprint with the model's own proportions; height follows.
    const m = furniture(spec.k, W, 10, D, { ...look, keepAspect: true });
    if (!m) return null;
    g.add(m);
  }
  if (def.mount === 'wall') {
    // Wall pieces are centred on their mounting height, like the built-in ones.
    const box = new THREE.Box3().setFromObject(g);
    g.position.y = (def.wallY ?? 1.6) - (box.max.y - box.min.y) / 2;
    const out = new THREE.Group();
    out.add(g);
    return out;
  }
  return g;
}
