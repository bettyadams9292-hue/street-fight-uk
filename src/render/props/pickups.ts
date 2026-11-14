/**
 * Pickup models for food, groceries, first aid, materials, collectibles and quest items
 * (public/models/pickups; built by tools/pickups, credits in public/models/pickups/SOURCES.md).
 *
 * Keyed by Game id: the item-to-model registry for these items, alongside PropLibrary's
 * ITEM_MODELS (which maps icon kinds to the older props). Loaded once at boot;
 * PropLibrary.lootModel() shows them on the ground. Anything that fails to load falls
 * back to the floating icon card.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { PICKUP_FILES, PICKUP_IDS } from './pickupList';

export { PICKUP_FILES, PICKUP_IDS, pickupSize, type PickupId } from './pickupList';

const loaded = new Map<string, THREE.Object3D>();
let loading: Promise<void> | null = null;

/** Load every pickup model (once). Never rejects; one that fails just isn't available. */
export function loadPickups(base = '/models/pickups/'): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    await Promise.all(
      PICKUP_IDS.map(async (id) => {
        try {
          const gltf = await loader.loadAsync(base + PICKUP_FILES[id]);
          gltf.scene.traverse((c: THREE.Object3D) => {
            c.userData.shared = true;
            if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
          });
          loaded.set(id, gltf.scene);
        } catch (e) {
          console.warn(`[pickups] ${PICKUP_FILES[id]} failed to load; using the icon card`, e);
        }
      }),
    );
  })();
  return loading;
}

/** The loaded model for an item (shared; clone before use), or null. */
export function pickupSource(id: string): THREE.Object3D | null {
  return loaded.get(id) ?? null;
}
