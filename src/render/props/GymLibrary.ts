/**
 * Low-poly gym equipment (public/models/gym, credits in CREDITS.md there):
 * the dumbbell rack, benches, barbell, loose dumbbells, plates, the standing
 * punch bag and the mat come from "LowPoly Gym Assets" by Matrixxy (CC BY 4.0),
 * split into pieces by tools/models/split_gym_pack.py. The treadmill, exercise
 * bike, speed-ball platform, squat rack (carrying that pack's barbell) and
 * glove rack were modelled to match it by tools/models/gym.py.
 *
 * Until the files load, or if they can't, everything keeps its built-in model.
 */
import * as THREE from 'three';
import { modelSet, type PieceOptions } from './modelSet';

const BASE = '/models/gym/';

export const GYM_MODELS = [
  'dumbbell_rack', 'flat_bench', 'incline_bench', 'barbell', 'dumbbell_small', 'dumbbell_medium', 'dumbbell_large',
  'plate_stack', 'plate_stack_b', 'punch_bag', 'mat', 'treadmill', 'exercise_bike', 'speed_ball', 'squat_rack', 'glove_rack',
] as const;
export type GymModelId = (typeof GYM_MODELS)[number];

const gym = modelSet('gym', BASE, GYM_MODELS);

/** Load every piece once. Never rejects. */
export function loadGym(): Promise<void> {
  return gym.load();
}

export function gymReady(): boolean {
  return gym.ready();
}

/**
 * A gym piece fitted into w × h × d metres, standing on y = 0, centred on x and z, front to +z.
 * `keepAspect` keeps its proportions inside the box; `native` uses it at its modelled size and height
 * (for wall pieces modelled at their mounting height). Null until loaded.
 */
export function gymPiece(id: GymModelId, w: number, h: number, d: number, o: PieceOptions = {}): THREE.Group | null {
  return gym.piece(id, w, h, d, o);
}

/**
 * The gym kit you buy (src/training/gym.ts), in its footprint (half sizes in metres). Heights are kept
 * where the fighter trains on them: the treadmill deck at 0.17 m, the bike saddle at 0.86 m, the bar on
 * the squat rack at 1.42 m, the speed ball on the wall at 1.7 m.
 */
export function gymKitPiece(id: string, size: [number, number]): THREE.Group | null {
  const W = size[0] * 2;
  const D = size[1] * 2;
  switch (id) {
    case 'dumbbells':
      return gymPiece('dumbbell_rack', W, 2, D, { keepAspect: true });
    case 'barbell':
      return gymPiece('squat_rack', W, 1.92, D);
    case 'treadmill':
      return gymPiece('treadmill', W, 1.44, D);
    case 'exercise_bike':
      return gymPiece('exercise_bike', Math.min(W, 1.09), 1.24, Math.min(D, 0.56));
    case 'speed_ball':
      return gymPiece('speed_ball', 0, 0, 0, { native: true });
    case 'bag':
      return gymPiece('punch_bag', W, 1.9, D, { keepAspect: true });
    case 'mat':
      return gymPiece('mat', W, 0.1, D, { keepAspect: true });
    default:
      return null;
  }
}
