/**
 * Modelled props: weapons, loot and street furniture from public/models/props
 * (packed by tools/props/pack.py; sources in public/models/props/SOURCES.md).
 *
 * Loaded once at boot. Every user gets a clone that shares geometry and
 * materials (marked `userData.shared`, so disposeGroup leaves them alone).
 * Anything that fails to load falls back to the game's built-in version.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pickupSize, pickupSource } from './pickups';

export const PROP_FILES = {
  claw_hammer: 'claw-hammer.glb',
  crowbar: 'crowbar.glb',
  wrench: 'wrench.glb',
  baseball_bat: 'baseball-bat.glb',
  rusty_pipe: 'rusty-pipe.glb',
  dumpster: 'dumpster.glb',
  keyring: 'keyring.glb',
  smartphone: 'smartphone.glb',
  sunglasses: 'sunglasses.glb',
  wristwatch: 'wristwatch.glb',
} as const;
export type PropId = keyof typeof PROP_FILES;

/** Weapons drawn from a model instead of primitives. */
export const WEAPON_MODELS: Readonly<Partial<Record<string, PropId>>> = {
  hammer: 'claw_hammer',
  crowbar: 'crowbar',
  wrench: 'wrench',
  baseball_bat: 'baseball_bat',
  pipe: 'rusty_pipe',
};

/** Item kinds shown as a model when they lie on the ground. */
export const ITEM_MODELS: Readonly<Partial<Record<string, PropId>>> = {
  sunglasses: 'sunglasses',
  watch: 'wristwatch',
  smartwatch: 'wristwatch',
  phone: 'smartphone',
  key: 'keyring',
};

const loaded = new Map<PropId, THREE.Object3D>();
let loading: Promise<void> | null = null;

function share(o: THREE.Object3D): THREE.Object3D {
  o.traverse((c: THREE.Object3D) => {
    c.userData.shared = true;
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

/** Load every prop (once). Never rejects; a prop that fails just isn't available. */
export function loadProps(base = '/models/props/'): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      (Object.entries(PROP_FILES) as [PropId, string][]).map(async ([id, file]) => {
        try {
          const gltf = await loader.loadAsync(base + file);
          loaded.set(id, share(gltf.scene));
        } catch (e) {
          console.warn(`[props] ${file} failed to load; using the built-in version`, e);
        }
      }),
    );
  })();
  return loading;
}

export function hasProp(id: PropId): boolean {
  return loaded.has(id);
}

/** A clone of the model as authored (shared geometry and materials), or null. */
export function cloneProp(id: PropId): THREE.Object3D | null {
  const src = loaded.get(id);
  return src ? share(src.clone(true)) : null;
}

/** Vertices of a model in its own space, for measuring. */
function points(o: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  o.updateMatrixWorld(true);
  o.traverse((c: THREE.Object3D) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const p = m.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(p.count / 1500));
    for (let i = 0; i < p.count; i += step) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
  });
  return out;
}

const fitCache = new Map<PropId, THREE.Matrix4>();

/**
 * How to stand a tool up the game's way: long axis along +y, the grip end at
 * the origin, the working end (head, barrel, hook: the wider end) at the top.
 * Worked out from the geometry once per model.
 */
function weaponFit(id: PropId, src: THREE.Object3D): THREE.Matrix4 {
  const cached = fitCache.get(id);
  if (cached) return cached;
  const pts = points(src);
  const box = new THREE.Box3().setFromPoints(pts);
  const size = box.getSize(new THREE.Vector3());
  const axis: 'x' | 'y' | 'z' = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  // Rotate the long axis onto +y.
  const rot = new THREE.Matrix4();
  if (axis === 'x') rot.makeRotationZ(Math.PI / 2);
  else if (axis === 'z') rot.makeRotationX(-Math.PI / 2);
  const turned = pts.map((p) => p.clone().applyMatrix4(rot));
  const tb = new THREE.Box3().setFromPoints(turned);
  const len = tb.max.y - tb.min.y;
  // Which end is wider? Compare the spread of points in the bottom and top fifths.
  const spread = (lo: number, hi: number) => {
    const sel = turned.filter((p) => p.y >= lo && p.y <= hi);
    if (!sel.length) return 0;
    const b = new THREE.Box3().setFromPoints(sel);
    return Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  };
  const bottom = spread(tb.min.y, tb.min.y + len * 0.2);
  const top = spread(tb.max.y - len * 0.2, tb.max.y);
  const flip = new THREE.Matrix4();
  if (bottom > top) flip.makeRotationX(Math.PI);
  const m = new THREE.Matrix4().multiplyMatrices(flip, rot);
  // Grip at the origin, centred on the axis.
  const fb = new THREE.Box3().setFromPoints(pts.map((p) => p.clone().applyMatrix4(m)));
  const c = fb.getCenter(new THREE.Vector3());
  m.premultiply(new THREE.Matrix4().makeTranslation(-c.x, -fb.min.y, -c.z));
  m.premultiply(new THREE.Matrix4().makeScale(1 / len, 1 / len, 1 / len));
  fitCache.set(id, m);
  return m;
}

/** The model for a weapon, grip at the origin, extending `length` metres up +y. Null if there is no model. */
export function weaponModel(weaponId: string, length: number): THREE.Group | null {
  const id = WEAPON_MODELS[weaponId];
  if (!id) return null;
  const src = loaded.get(id);
  if (!src) return null;
  const inner = share(src.clone(true));
  const fit = weaponFit(id, src);
  inner.matrixAutoUpdate = false;
  inner.matrix.copy(fit);
  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.setScalar(length);
  return outer;
}

/**
 * A small item sized for picking up off the ground, centred, lying flat. `kind` is a Game id with
 * its own pickup model (food, groceries, materials, collectibles, quest items: pickups.ts) or an
 * icon kind in ITEM_MODELS (watch, phone, keys, sunglasses).
 */
export function lootModel(kind: string, size = pickupSize(kind) ?? 0.34): THREE.Group | null {
  const id = ITEM_MODELS[kind];
  const src = pickupSource(kind) ?? (id ? loaded.get(id) : undefined);
  if (!src) return null;
  const inner = share(src.clone(true));
  const box = new THREE.Box3().setFromObject(src);
  const s = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  inner.position.sub(c);
  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.setScalar(size / Math.max(s.x, s.y, s.z));
  return outer;
}

/** A street prop scaled to fill a footprint (w along x, d along z), standing on y = 0. */
export function fittedProp(id: PropId, w: number, h: number | null, d: number): THREE.Group | null {
  const src = loaded.get(id);
  if (!src) return null;
  const inner = share(src.clone(true));
  const box = new THREE.Box3().setFromObject(src);
  const s = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const outer = new THREE.Group();
  outer.add(inner);
  const k = Math.min(w / s.x, d / s.z);
  outer.scale.set(k, h ? h / s.y : k, k);
  return outer;
}
