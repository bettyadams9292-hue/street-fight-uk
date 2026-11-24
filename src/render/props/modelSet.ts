/**
 * A folder of low-poly .glb models (gym, shop): loads them once, and hands out
 * fitted copies. Glow parts light up in their own colour; glass is see-through.
 */
import * as THREE from 'three';
import { loadGlb } from '../../performance/assetFetch';
import { bump, PRIORITY } from '../../performance/requests';

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

export interface PieceOptions {
  /** Keep its proportions inside the box. */
  keepAspect?: boolean;
  /** Use it at its modelled size and height (for pieces modelled at their real size or mounting height). */
  native?: boolean;
  turn?: number;
  /** Lights off: anything that glows is dimmed (its own copy of the material). */
  dim?: boolean;
  /** Paint: the textured (non-glass) parts are multiplied by this colour (materials shared per colour). */
  tint?: string;
}

export interface ModelSet<Id extends string> {
  /** Load every piece once (in the background, behind anything asked for with `prepare`). Never rejects. */
  load(): Promise<void>;
  /** Load these pieces first (a level about to be built). Ids from other sets are ignored. Never rejects. */
  prepare(ids: readonly string[], priority?: number): Promise<void>;
  /** This piece is loaded. */
  has(id: string): boolean;
  /** This piece has finished loading, or failed (and its built-in version stands in). */
  settled(id: string): boolean;
  /** Every piece in the set. */
  readonly ids: readonly Id[];
  ready(): boolean;
  /** A piece fitted into w × h × d metres, standing on y = 0, centred on x and z, front to +z. Null until loaded. */
  piece(id: Id, w: number, h: number, d: number, o?: PieceOptions): THREE.Group | null;
}

/** Every model set by name, for the level dependency lists (`performance/levelAssets.ts`). */
export const SETS = new Map<string, ModelSet<string>>();

/**
 * Recording what a level asks for (tools/assets/levelDeps.ts builds every level in Node with this on):
 * `ready()` says yes and every `piece()` asked for is noted by set, then returns null as if not loaded.
 */
export const recorder = { on: false, used: new Map<string, Set<string>>() };

export function modelSet<Id extends string>(name: string, base: string, ids: readonly Id[]): ModelSet<Id> {
  const models = new Map<string, THREE.Object3D>();
  const tinted = new Map<string, THREE.MeshStandardMaterial>();
  const bounds = new Map<string, THREE.Box3>();
  let loading: Promise<void> | null = null;
  const known = new Set<string>(ids);
  // One download per model, whoever asks first; asking again at a higher priority moves it up the queue.
  const pending = new Map<string, Promise<void>>();
  const done = new Set<string>();
  const one = (id: Id, priority: number): Promise<void> => {
    const url = `${base}${id}.glb`;
    const hit = pending.get(id);
    if (hit) {
      bump(url, priority);
      return hit;
    }
    const p = (async () => {
      try {
        const g = await loadGlb(url, priority);
        g.scene.traverse((o: THREE.Object3D) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const m = mesh.material as THREE.MeshStandardMaterial;
          const glass = m.name === 'glass';
          mesh.castShadow = !glass;
          mesh.receiveShadow = !glass;
          // Shared: these outlive any level (disposeGroup skips them).
          mesh.userData.shared = true;
          mesh.geometry.userData.shared = true;
          m.userData.shared = true;
          if (glass) {
            m.transparent = true;
            m.depthWrite = false;
          }
          if (m.name === 'glow') glowFromVertexColours(mesh);
        });
        models.set(id, g.scene);
      } catch (e) {
        console.warn(`[${name}] ${id} failed`, e);
      } finally {
        done.add(id);
      }
    })();
    pending.set(id, p);
    return p;
  };
  const set: ModelSet<Id> = {
    load() {
      loading ??= Promise.all(ids.map((id) => one(id, PRIORITY.background))).then(() => undefined);
      return loading;
    },
    prepare(want, priority = PRIORITY.now) {
      return Promise.all(want.filter((id) => known.has(id)).map((id) => one(id as Id, priority))).then(() => undefined);
    },
    has(id) {
      return models.has(id);
    },
    settled(id) {
      return done.has(id) || !known.has(id);
    },
    ids,
    ready() {
      return models.size > 0 || recorder.on;
    },
    piece(id, w, h, d, o = {}) {
      if (recorder.on) {
        let u = recorder.used.get(name);
        if (!u) recorder.used.set(name, (u = new Set()));
        u.add(id);
      }
      const src = models.get(id);
      if (!src) return null;
      const inner = src.clone(true);
      inner.rotation.y = o.turn ?? 0;
      if (o.tint) {
        inner.traverse((n: THREE.Object3D) => {
          const mesh = n as THREE.Mesh;
          const m = mesh.isMesh ? (mesh.material as THREE.MeshStandardMaterial) : null;
          if (!m || m.transparent) return;
          const key = `${m.uuid}|${o.tint}`;
          let t = tinted.get(key);
          if (!t) {
            t = m.clone();
            t.color.set(o.tint!);
            t.userData.shared = true;
            tinted.set(key, t);
          }
          mesh.material = t;
        });
      }
      if (o.dim) {
        inner.traverse((n: THREE.Object3D) => {
          const mesh = n as THREE.Mesh;
          const m = mesh.isMesh ? (mesh.material as THREE.MeshStandardMaterial) : null;
          if (!m || !m.emissive || m.emissive.getHex() === 0) return;
          const off = m.clone();
          off.emissiveIntensity = 0.05;
          off.userData.shared = false;
          off.userData.instanceOwned = true;
          mesh.material = off; // not shared: disposed with the level
        });
      }
      const out = new THREE.Group();
      if (o.native) {
        out.add(inner);
        return out;
      }
      const boundsKey = `${id}|${o.turn ?? 0}`;
      let box = bounds.get(boundsKey);
      if (!box) {
        inner.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(inner);
        bounds.set(boundsKey, box);
        // Bound unusual rotations without affecting live instances.
        if (bounds.size > 512) {
          const oldest = bounds.keys().next();
          if (!oldest.done) bounds.delete(oldest.value);
        }
      }
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
    },
  };
  SETS.set(name, set as unknown as ModelSet<string>);
  return set;
}
