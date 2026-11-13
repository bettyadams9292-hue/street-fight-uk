/**
 * Hydroponics kit (public/models/hydro): "Low Poly Hydroponics Pack" by
 * reodesuxz (licence in LICENSE.txt there: use in games allowed, no
 * redistributing the files on their own). Used for everything you grow with:
 * the grow tents, rack system, reservoir and pump, grow lights, fan, potting
 * bench, crates, trays and nutrients, in the grow shop and the basement. The crop
 * itself is "Cannabis Plant 0nE" by -X-ScornGames (CC BY 4.0, credited in
 * CREDITS.md there), cut from a million triangles to a few thousand.
 *
 * Until the files load, or if they can't, everything keeps its built-in model.
 */
import type * as THREE from 'three';
import { modelSet, type PieceOptions } from './modelSet';

export const HYDRO_MODELS = [
  'grow_tent', 'reservoir', 'water_pump', 'potting_bench', 'grow_light', 'fan', 'harvest_crate', 'seedling_tray',
  'nutrient_bottles', 'ph_meter', 'watering_can', 'dwc_bucket', 'vertical_tower', 'strawberry_planter',
  // "Cannabis Plant 0nE" by -X-ScornGames (CC BY 4.0), cut down by tools/models/decimate_plant.py.
  'cannabis_plant',
] as const;
export type HydroModelId = (typeof HYDRO_MODELS)[number];

const hydro = modelSet('hydro', '/models/hydro/', HYDRO_MODELS);

export function loadHydro(): Promise<void> {
  return hydro.load();
}

export function hydroReady(): boolean {
  return hydro.ready();
}

/** A hydroponics piece fitted into w × h × d metres (its models are at real size: `native` keeps that). Null until loaded. */
export function hydroPiece(id: HydroModelId, w: number, h: number, d: number, o: PieceOptions = {}): THREE.Group | null {
  return hydro.piece(id, w, h, d, o);
}
