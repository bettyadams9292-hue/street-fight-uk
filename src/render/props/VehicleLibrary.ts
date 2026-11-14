/**
 * Owned cars and off-road bikes (public/models/vehicles).
 *
 * - Cars: Kenney's Car Kit (CC0) re-exported by tools/models/vehicles (paint split from the
 *   rest so it can be recoloured, dark glass), plus three original cars where the kit has no match
 *   (the two roadsters and the supercar).
 * - Bikes: original low-poly models, one per bike, at their real size.
 *
 * Files have their front along +z; the game wants the nose along +x, so pieces come back turned.
 * The 'paint' material takes the vehicle's colour; 'plate' (bike number boards) can be swapped for
 * a numbered material. Until the files load, or if they can't, callers keep the code-built models.
 */
import * as THREE from 'three';
import { modelSet } from './modelSet';

/** Car id -> model file and the height it is fitted to (null: keep the file's proportions). */
export const CAR_MODELS: Record<string, { file: VehicleFile; height: number | null }> = {
  corvo: { file: 'hatchback-sports', height: 1.45 },
  pixie: { file: 'hatchback-sports', height: 1.42 },
  monarch: { file: 'sedan', height: 1.45 },
  regent: { file: 'sedan', height: 1.45 },
  vixen: { file: 'car-vixen', height: null },
  kestrel: { file: 'car-kestrel', height: null },
  tundra: { file: 'suv-luxury', height: 1.75 },
  sovereign: { file: 'suv', height: 1.75 },
  warden: { file: 'suv', height: 1.8 },
  brute: { file: 'truck', height: 1.75 },
  hornet: { file: 'sedan-sports', height: 1.4 },
  phantom: { file: 'car-phantom', height: null },
};

export const BIKE_IDS = ['pup85', 'trail125', 'mx250', 'mx350', 'mx450r', 'mx450f', 'enduro300', 'enduro500', 'factory450', 'gp500'] as const;

export const VEHICLE_FILES = [
  'hatchback-sports', 'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'truck', 'car-vixen', 'car-kestrel', 'car-phantom',
  ...BIKE_IDS.map((b) => `bike-${b}` as const),
] as const;
export type VehicleFile = (typeof VEHICLE_FILES)[number];

const vehicles = modelSet('vehicles', '/models/vehicles/', VEHICLE_FILES);

export function loadVehicles(): Promise<void> {
  return vehicles.load();
}

const paints = new Map<string, THREE.MeshStandardMaterial>();

/** Paint the body and (for bikes) put numbers on the boards. Materials are shared per colour. */
function dress(root: THREE.Object3D, colour: string, plate?: THREE.Material): void {
  root.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (m.name === 'paint') {
      const key = `${m.uuid}|${colour}`;
      let p = paints.get(key);
      if (!p) {
        const made = m.clone();
        made.color.set(colour);
        made.userData.shared = true;
        paints.set(key, made);
        p = made;
      }
      mesh.material = p;
    } else if (m.name === 'plate' && plate) mesh.material = plate;
    else if (m.name === 'lamp' && m.emissiveIntensity !== 0.6) m.emissiveIntensity = 0.6;
  });
}

/** Stand it on y = 0, centred across (and along, unless `keepLength`), and turn the file's +z front to +x. */
function place(inner: THREE.Object3D, keepLength = false): THREE.Group {
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  holder.add(inner);
  inner.position.x -= c.x;
  if (!keepLength) inner.position.z -= c.z;
  inner.position.y -= box.min.y;
  holder.rotation.y = Math.PI / 2;
  const out = new THREE.Group();
  out.add(holder);
  return out;
}

/**
 * A car `length` × `width` metres (nose along +x), standing on y = 0, or null until loaded.
 * The body is stretched to the car's size; the wheels stay round.
 */
export function carPiece(id: string, colour: string, length: number, width: number): THREE.Group | null {
  const spec = CAR_MODELS[id];
  if (!spec) return null;
  const p = vehicles.piece(spec.file, 0, 0, 0, { native: true });
  if (!p) return null;
  const inner = p.children[0];
  inner.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
  const sx = width / size.x;
  const sz = length / size.z;
  const sy = spec.height === null ? (sx + sz) / 2 : spec.height / size.y;
  const scaler = new THREE.Group();
  scaler.scale.set(sx, sy, sz);
  scaler.add(inner);
  // Round wheels: the same scale every way, a little bigger than the height scale on the long, low cars.
  const k = spec.height === null ? sy : Math.min(sz, (sx + sy) / 2);
  inner.traverse((o: THREE.Object3D) => {
    if (o !== inner && o.name.startsWith('wheel')) o.scale.set(k / sx, k / sy, k / sz);
  });
  dress(inner, colour);
  return place(scaler);
}

/** A bike at its real size (nose along +x, front wheel at +x), or null until loaded. */
export function bikePiece(id: string, colour: string, plate?: THREE.Material): THREE.Group | null {
  if (!(BIKE_IDS as readonly string[]).includes(id)) return null;
  const p = vehicles.piece(`bike-${id}` as VehicleFile, 0, 0, 0, { native: true });
  if (!p) return null;
  const inner = p.children[0];
  dress(inner, colour, plate);
  // Keep the origin midway between the wheels, as the rider's seat is placed from there.
  return place(inner, true);
}
