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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BASE = '/models/gym/';

export const GYM_MODELS = [
  'dumbbell_rack', 'flat_bench', 'incline_bench', 'barbell', 'dumbbell_small', 'dumbbell_medium', 'dumbbell_large',
  'plate_stack', 'plate_stack_b', 'punch_bag', 'mat', 'treadmill', 'exercise_bike', 'speed_ball', 'squat_rack', 'glove_rack',
] as const;
export type GymModelId = (typeof GYM_MODELS)[number];

const models = new Map<string, THREE.Object3D>();
let loading: Promise<void> | null = null;

/** Screens and lights glow in their own colour (the file's emissive is plain white). */
function glowFromVertexColours(mesh: THREE.Mesh): void {
  const col = mesh.geometry.getAttribute('color');
  const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
  if (col) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < col.count; i++) {
      r += col.getX(i);
      g += col.getY(i);
      b += col.getZ(i);
    }
    mat.emissive.setRGB(r / col.count, g / col.count, b / col.count);
  }
  mat.emissiveIntensity = 0.9;
  mat.userData.shared = true;
  mesh.material = mat;
}

/** Load every piece once. Never rejects. */
export function loadGym(): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      GYM_MODELS.map(async (id) => {
        try {
          const g = await loader.loadAsync(`${BASE}${id}.glb`);
          g.scene.traverse((o: THREE.Object3D) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Shared: these outlive any level (disposeGroup skips them).
            mesh.userData.shared = true;
            mesh.geometry.userData.shared = true;
            const m = mesh.material as THREE.MeshStandardMaterial;
            m.userData.shared = true;
            if (m.name === 'glow') glowFromVertexColours(mesh);
          });
          models.set(id, g.scene);
        } catch (e) {
          console.warn(`[gym] ${id} failed`, e);
        }
      }),
    );
  })();
  return loading;
}

export function gymReady(): boolean {
  return models.size > 0;
}

/**
 * A gym piece fitted into w × h × d metres, standing on y = 0, centred on x and z, front to +z.
 * `keepAspect` keeps its proportions inside the box; `native` uses it at its modelled size and height
 * (for wall pieces modelled at their mounting height). Null until loaded.
 */
export function gymPiece(id: GymModelId, w: number, h: number, d: number, o: { keepAspect?: boolean; native?: boolean; turn?: number } = {}): THREE.Group | null {
  const src = models.get(id);
  if (!src) return null;
  const inner = src.clone(true);
  inner.rotation.y = o.turn ?? 0;
  const out = new THREE.Group();
  if (o.native) {
    out.add(inner);
    return out;
  }
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  let sx = w / Math.max(1e-3, size.x);
  let sy = h / Math.max(1e-3, size.y);
  let sz = d / Math.max(1e-3, size.z);
  if (o.keepAspect) sx = sy = sz = Math.min(sx, sy, sz);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const holder = new THREE.Group();
  holder.add(inner);
  holder.scale.set(sx, sy, sz);
  out.add(holder);
  return out;
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
