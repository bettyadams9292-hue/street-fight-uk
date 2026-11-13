/**
 * A folder of low-poly .glb models (gym, shop): loads them once, and hands out
 * fitted copies. Glow parts light up in their own colour; glass is see-through.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
}

export interface ModelSet<Id extends string> {
  /** Load every piece once. Never rejects. */
  load(): Promise<void>;
  ready(): boolean;
  /** A piece fitted into w × h × d metres, standing on y = 0, centred on x and z, front to +z. Null until loaded. */
  piece(id: Id, w: number, h: number, d: number, o?: PieceOptions): THREE.Group | null;
}

export function modelSet<Id extends string>(name: string, base: string, ids: readonly Id[]): ModelSet<Id> {
  const models = new Map<string, THREE.Object3D>();
  let loading: Promise<void> | null = null;
  return {
    load() {
      loading ??= (async () => {
        const loader = new GLTFLoader();
        await Promise.all(
          ids.map(async (id) => {
            try {
              const g = await loader.loadAsync(`${base}${id}.glb`);
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
            }
          }),
        );
      })();
      return loading;
    },
    ready() {
      return models.size > 0;
    },
    piece(id, w, h, d, o = {}) {
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
    },
  };
}
